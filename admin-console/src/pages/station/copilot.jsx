import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CommentOutlined from '@ant-design/icons/CommentOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import SendOutlined from '@ant-design/icons/SendOutlined';
import ToolOutlined from '@ant-design/icons/ToolOutlined';

import {
  createAgentSession,
  postAgentMessage,
  useGetAgentSessionContext,
  useGetAgentSessionPlan,
  useGetAgentTools,
  useGetAgentWorkflows,
  executeAgentTool
} from 'api/agent';
import {
  useGetInboundFlights,
  useGetInboundWaybills,
  useGetObjectAudit,
  useGetOutboundFlights,
  useGetOutboundWaybills,
  useGetStationExceptions,
  useGetStationShipments
} from 'api/station';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { buildStationObjectDetailUrl, buildStationObjectLabel } from 'utils/copilot';

const STORAGE_KEY = 'sinoport-copilot-sessions-v1';
const ACTIVE_KEY = 'sinoport-copilot-active-session-v1';

const objectTypeOptions = [
  { value: 'station', label: 'Station' },
  { value: 'Flight', label: 'Flight' },
  { value: 'AWB', label: 'AWB' },
  { value: 'Shipment', label: 'Shipment' },
  { value: 'Exception', label: 'Exception' }
];

function createId(prefix = 'cp') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readLocalSessions() {
  if (typeof window === 'undefined') return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const sessions = raw ? safeJsonParse(raw, []) : [];

  return Array.isArray(sessions) ? sessions : [];
}

function writeLocalSessions(sessions) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function readActiveSessionId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ACTIVE_KEY) || '';
}

function writeActiveSessionId(sessionId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_KEY, sessionId);
}

function formatTime(value) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function buildFocusKey(objectType, objectKey) {
  return `${objectType || 'station'}:${objectKey || 'MME'}`;
}

function buildSessionTitle(objectType, objectKey) {
  return objectType === 'station' ? '站点 Copilot' : `${objectType} / ${objectKey || '--'}`;
}

function buildSystemMessage(context) {
  if (!context) {
    return '正在加载实时上下文...';
  }

  return [
    `Session: ${context.session_id}`,
    `Actor: ${context.actor?.userId || context.actor?.user_id || '--'} / ${context.actor?.roleIds?.join(', ') || context.actor?.role_ids?.join(', ') || '--'}`,
    `Stations: ${context.actor?.stationScope?.join(', ') || context.actor?.station_scope?.join(', ') || '--'}`,
    `Focus: ${context.focus ? `${context.focus.object_type} / ${context.focus.object_key}` : 'station-wide'}`,
    `Tools: ${(context.available_tools || []).join(', ') || '--'}`,
    `Workflows: ${(context.available_workflows || []).join(', ') || '--'}`
  ].join('\n');
}

function buildAssistantIntro(plan, focusLabel) {
  const steps = plan?.steps || [];

  if (!steps.length) {
    return `已打开 ${focusLabel} 的 Copilot 交互层。`;
  }

  return [`已打开 ${focusLabel} 的 Copilot 交互层。`, '建议步骤：', ...steps.map((step, index) => `${index + 1}. ${step}`)].join('\n');
}

function buildToolPayload(toolName, objectType, objectKey) {
  if (toolName === 'get_flight_context') {
    return JSON.stringify({ object_type: objectType, object_key: objectKey, flight_no: objectType === 'Flight' ? objectKey : undefined }, null, 2);
  }

  if (toolName === 'list_blocking_documents') {
    return JSON.stringify({ object_type: objectType === 'station' ? 'AWB' : objectType, object_key: objectKey }, null, 2);
  }

  if (toolName === 'list_open_exceptions') {
    return JSON.stringify({ object_type: objectType === 'station' ? undefined : objectType, object_key: objectKey }, null, 2);
  }

  if (toolName === 'request_task_assignment') {
    return JSON.stringify(
      {
        task_id: '',
        assigned_role: 'inbound_operator',
        assigned_team_id: 'TEAM-IN-01',
        assigned_worker_id: 'WORKER-PDA-001',
        reason: `Requested from ${objectType || 'station'} / ${objectKey || 'MME'}`
      },
      null,
      2
    );
  }

  return JSON.stringify({ object_type: objectType, object_key: objectKey }, null, 2);
}

function formatToolResult(result) {
  if (result == null) return '--';
  if (typeof result === 'string') return result;

  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function createMessage(role, content, extra = {}) {
  return {
    id: createId(role),
    role,
    content,
    time: new Date().toISOString(),
    ...extra
  };
}

function normalizeSessions(rawSessions, fallbackSession) {
  const sessions = Array.isArray(rawSessions) ? rawSessions : [];

  if (!sessions.length) {
    return [fallbackSession];
  }

  return sessions
    .map((session) => ({
      ...session,
      messages: Array.isArray(session.messages) ? session.messages : [],
      updatedAt: session.updatedAt || session.createdAt || new Date().toISOString()
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function buildObjectOptions(inboundFlights, inboundWaybills, outboundFlights, outboundWaybills, shipments, exceptions) {
  return {
    station: [{ value: 'MME', label: 'MME / 货站总览' }],
    Flight: [
      ...inboundFlights.map((item) => ({
        value: item.flightNo,
        label: `${item.flightNo} / Inbound / ${item.source} → ${item.destination || 'MME'}`
      })),
      ...outboundFlights.map((item) => ({
        value: item.flightNo,
        label: `${item.flightNo} / Outbound / ${item.stage || item.status || '运行中'}`
      }))
    ],
    AWB: [
      ...inboundWaybills.map((item) => ({
        value: item.awb,
        label: `${item.awb} / Inbound / ${item.consignee}`
      })),
      ...outboundWaybills.map((item) => ({
        value: item.awb,
        label: `${item.awb} / Outbound / ${item.destination}`
      }))
    ],
    Shipment: shipments.map((item) => ({
      value: item.id,
      label: `${item.id} / ${item.direction} / ${item.priority}`
    })),
    Exception: exceptions.map((item) => ({
      value: item.id,
      label: `${item.id} / ${item.type} / ${item.status}`
    }))
  };
}

function buildSessionDisplayLabel(session) {
  const focusLabel = buildStationObjectLabel(session.objectType, session.objectKey);
  return session.title || focusLabel;
}

function buildSessionCardLabel(session) {
  return `${session.objectType || 'station'} / ${session.objectKey || 'MME'}`;
}

function buildAuditItems(events = [], transitions = []) {
  return [
    ...events.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.action,
      description: item.note || item.object,
      status: 'Audit',
      meta: `${item.time} · ${item.actor}`
    })),
    ...transitions.slice(0, 2).map((item) => ({
      id: `${item.id}-transition`,
      title: item.action,
      description: item.note || item.object,
      status: 'State',
      meta: `${item.time} · ${item.actor}`
    }))
  ];
}

export default function StationCopilotPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { inboundFlights } = useGetInboundFlights();
  const { inboundWaybills } = useGetInboundWaybills();
  const { outboundFlights } = useGetOutboundFlights();
  const { outboundWaybills } = useGetOutboundWaybills();
  const { stationShipments } = useGetStationShipments();
  const { stationExceptions } = useGetStationExceptions();
  const { agentTools } = useGetAgentTools();
  const { agentWorkflows } = useGetAgentWorkflows();

  const initialObjectType = searchParams.get('object_type') || 'station';
  const initialObjectKey = searchParams.get('object_key') || 'MME';
  const [objectType, setObjectType] = useState(initialObjectType);
  const [objectKey, setObjectKey] = useState(initialObjectKey);
  const [sessions, setSessions] = useState(() => {
    const fallbackSession = {
      id: createId('session'),
      title: buildSessionTitle(initialObjectType, initialObjectKey),
      objectType: initialObjectType,
      objectKey: initialObjectKey,
      messages: [createMessage('assistant', '正在加载 Copilot 会话。')],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return normalizeSessions(readLocalSessions(), fallbackSession);
  });
  const [activeSessionId, setActiveSessionId] = useState(() => readActiveSessionId() || sessions[0]?.id || '');
  const [draft, setDraft] = useState('');
  const [selectedToolName, setSelectedToolName] = useState('');
  const [toolPayload, setToolPayload] = useState(() => buildToolPayload('', initialObjectType, initialObjectKey));
  const [toolResult, setToolResult] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (!sessions.length) return;
    writeLocalSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      writeActiveSessionId(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (!sessions.length) return;

    if (!sessions.some((session) => session.id === activeSessionId)) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    const nextType = searchParams.get('object_type') || 'station';
    const nextKey = searchParams.get('object_key') || 'MME';
    setObjectType(nextType);
    setObjectKey(nextKey);
  }, [location.search, searchParams]);

  const activeSession = useMemo(() => sessions.find((item) => item.id === activeSessionId) || sessions[0] || null, [activeSessionId, sessions]);
  const activeFocusObjectType = activeSession?.objectType || objectType;
  const activeFocusObjectKey = activeSession?.objectKey || objectKey;
  const focusLabel = buildStationObjectLabel(activeFocusObjectType, activeFocusObjectKey);
  const selectedObjectOptions = buildObjectOptions(inboundFlights, inboundWaybills, outboundFlights, outboundWaybills, stationShipments, stationExceptions);
  const currentOptions = selectedObjectOptions[objectType] || selectedObjectOptions.station;
  const currentDetailPath = buildStationObjectDetailUrl(activeFocusObjectType, activeFocusObjectKey);

  const agentSessionId = activeSession?.id || 'session-default';
  const { agentSessionContext } = useGetAgentSessionContext(agentSessionId, activeFocusObjectType, activeFocusObjectKey, refreshNonce);
  const { agentSessionPlan } = useGetAgentSessionPlan(agentSessionId, activeFocusObjectType, activeFocusObjectKey, refreshNonce);
  const auditType = activeFocusObjectType === 'station' ? null : activeFocusObjectType;
  const { objectAuditEvents, objectAuditTransitions } = useGetObjectAudit(auditType || undefined, activeFocusObjectKey);

  useEffect(() => {
    if (!sessions.length) return;

    const focusKey = buildFocusKey(objectType, objectKey);
    const matched = sessions.find((session) => buildFocusKey(session.objectType, session.objectKey) === focusKey);

    if (matched && matched.id !== activeSessionId) {
      setActiveSessionId(matched.id);
      return;
    }

    if (!matched && activeSession) {
      setSessions((prev) =>
        prev
          .map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  objectType,
                  objectKey,
                  title: buildSessionTitle(objectType, objectKey),
                  updatedAt: new Date().toISOString()
                }
              : session
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
    }
  }, [activeSession, activeSessionId, objectKey, objectType, sessions]);

  useEffect(() => {
    if (!agentTools.length) return;
    if (!selectedToolName || !agentTools.some((tool) => tool.name === selectedToolName)) {
      const nextTool = agentTools[0]?.name || '';
      setSelectedToolName(nextTool);
      setToolPayload(buildToolPayload(nextTool, activeFocusObjectType, activeFocusObjectKey));
    }
  }, [agentTools, activeFocusObjectKey, activeFocusObjectType, selectedToolName]);

  useEffect(() => {
    if (selectedToolName) {
      setToolPayload((prev) => (prev && prev.trim() ? prev : buildToolPayload(selectedToolName, activeFocusObjectType, activeFocusObjectKey)));
    }
  }, [activeFocusObjectKey, activeFocusObjectType, selectedToolName]);

  const sessionFeed = useMemo(() => {
    const baseTime = activeSession?.updatedAt || new Date().toISOString();
    const contextMessage = {
      id: `context-${agentSessionId}-${refreshNonce}`,
      role: 'system',
      content: buildSystemMessage(agentSessionContext),
      time: baseTime
    };
    const planMessage = {
      id: `plan-${agentSessionId}-${refreshNonce}`,
      role: 'assistant',
      content: buildAssistantIntro(agentSessionPlan, focusLabel),
      time: baseTime
    };

    return [contextMessage, planMessage, ...(activeSession?.messages || [])];
  }, [activeSession, agentSessionContext, agentSessionPlan, agentSessionId, focusLabel, refreshNonce]);

  const auditPreviewItems = useMemo(() => buildAuditItems(objectAuditEvents, objectAuditTransitions), [objectAuditEvents, objectAuditTransitions]);

  const sessionCards = useMemo(() => {
    return [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [sessions]);

  const refreshSessionContext = () => {
    setRefreshNonce((prev) => prev + 1);
  };

  const createNewSession = async () => {
    const created = await createAgentSession({
      object_type: objectType,
      object_key: objectKey,
      initial_message: `Open copilot for ${focusLabel}`
    }).catch(() => null);
    const sessionId = created?.data?.session_id || createId('session');
    const now = new Date().toISOString();
    const nextSession = {
      id: sessionId,
      title: buildSessionTitle(objectType, objectKey),
      objectType,
      objectKey,
      messages: [createMessage('assistant', `已创建新的 Copilot 会话，当前对象为 ${focusLabel}。`)],
      createdAt: now,
      updatedAt: now
    };

    setSessions((prev) => [nextSession, ...prev.filter((item) => item.id !== sessionId)]);
    setActiveSessionId(sessionId);
  };

  const activateSession = (session) => {
    setActiveSessionId(session.id);
    setObjectType(session.objectType || 'station');
    setObjectKey(session.objectKey || 'MME');
    setSearchParams({ object_type: session.objectType || 'station', object_key: session.objectKey || 'MME' }, { replace: true });
  };

  const applyObjectFocus = () => {
    const nextKey = objectKey || (objectType === 'station' ? 'MME' : '');
    if (!nextKey) return;

    setSearchParams({ object_type: objectType, object_key: nextKey }, { replace: true });

    setSessions((prev) => {
      const now = new Date().toISOString();
      const existing = prev.find((session) => buildFocusKey(session.objectType, session.objectKey) === buildFocusKey(objectType, nextKey));

      if (existing) {
        return prev.map((session) =>
          session.id === existing.id
            ? {
                ...session,
                title: buildSessionTitle(objectType, nextKey),
                objectType,
                objectKey: nextKey,
                updatedAt: now
              }
            : session
        );
      }

      const sessionId = activeSession?.id || createId('session');
      const nextSession = {
        id: sessionId,
        title: buildSessionTitle(objectType, nextKey),
        objectType,
        objectKey: nextKey,
        messages: activeSession?.messages || [createMessage('assistant', `已切换到 ${buildStationObjectLabel(objectType, nextKey)}。`)],
        createdAt: activeSession?.createdAt || now,
        updatedAt: now
      };

      setActiveSessionId(sessionId);
      return [nextSession, ...prev.filter((session) => session.id !== sessionId)];
    });
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeSession) return;

    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSession.id
          ? {
              ...session,
              messages: [...session.messages, createMessage('user', text)],
              updatedAt: new Date().toISOString()
            }
          : session
      )
    );
    setDraft('');

    try {
      const response = await postAgentMessage(activeSession.id, {
        message: text,
        object_type: activeFocusObjectType,
        object_key: activeFocusObjectKey
      });
      const assistantReply = response?.data?.assistant_message || `已记录你的问题。当前对象 ${focusLabel} 的建议步骤已在右侧显示。`;

      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession.id
            ? {
                ...session,
                messages: [...session.messages, createMessage('assistant', assistantReply, { emphasis: 'copilot' })],
                updatedAt: new Date().toISOString()
              }
            : session
        )
      );
    } catch {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession.id
            ? {
                ...session,
                messages: [
                  ...session.messages,
                  createMessage('assistant', `当前对象 ${focusLabel} 已加载实时上下文。建议优先查看右侧对象留痕和工具面板。`, {
                    emphasis: 'copilot'
                  })
                ],
                updatedAt: new Date().toISOString()
              }
            : session
        )
      );
    }
  };

  const handleExecuteTool = async () => {
    if (!selectedToolName) return;

    let payload = {};
    try {
      payload = toolPayload.trim() ? JSON.parse(toolPayload) : {};
    } catch (error) {
      setToolResult({ error: '工具入参不是合法 JSON。', details: String(error) });
      return;
    }

    try {
      setToolLoading(true);
      const response = await executeAgentTool(selectedToolName, payload);
      const result = response?.data ?? response;
      const formatted = formatToolResult(result);
      setToolResult(result);

      if (activeSession) {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  messages: [...session.messages, createMessage('tool', formatted, { toolName: selectedToolName })],
                  updatedAt: new Date().toISOString()
                }
              : session
          )
        );
      }
    } catch (error) {
      const message = error?.response?.data?.error?.message || error?.message || '工具执行失败';
      setToolResult({ error: message });
      if (activeSession) {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  messages: [...session.messages, createMessage('tool', `工具执行失败: ${message}`, { toolName: selectedToolName })],
                  updatedAt: new Date().toISOString()
                }
              : session
          )
        );
      }
    } finally {
      setToolLoading(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station / Copilot"
          title="Copilot 交互层"
          description="站内 Copilot 采用独立页面承载会话列表、消息流、工具调用和对象上下文，和业务详情页解耦。"
          chips={[buildStationObjectLabel(activeFocusObjectType, activeFocusObjectKey), `Session ${activeSession?.id || '--'}`, `Tools ${agentTools.length}`]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component="button" onClick={createNewSession} variant="contained" startIcon={<PlusOutlined />}>
                新建会话
              </Button>
              <Button component="button" onClick={applyObjectFocus} variant="outlined">
                应用对象
              </Button>
              <Button onClick={() => navigate(currentDetailPath)} variant="outlined">
                打开对象详情
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 3 }}>
        <MainCard title="会话列表" secondary={<StatusChip label={`${sessionCards.length} threads`} />}>
          <Stack sx={{ gap: 1.5 }}>
            <List disablePadding sx={{ gap: 1, display: 'grid' }}>
              {sessionCards.map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <ListItemButton
                    key={session.id}
                    selected={active}
                    onClick={() => activateSession(session)}
                    sx={(theme) => ({
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: active ? theme.palette.primary.main : theme.palette.divider,
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                      alignItems: 'flex-start'
                    })}
                  >
                    <CommentOutlined style={{ fontSize: 18, marginTop: 2 }} />
                    <ListItemText
                      sx={{ ml: 1.25 }}
                      primary={
                        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                          <Typography variant="subtitle2">{buildSessionDisplayLabel(session)}</Typography>
                          <Chip size="small" label={session.messages?.length || 0} variant="light" color="secondary" />
                        </Stack>
                      }
                      secondary={
                        <Stack sx={{ gap: 0.35, mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {buildSessionCardLabel(session)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            更新 {formatTime(session.updatedAt)}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard
          title={
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Stack sx={{ gap: 0.35 }}>
                <Typography variant="subtitle1">{buildSessionDisplayLabel(activeSession || { objectType, objectKey })}</Typography>
                <Typography variant="caption" color="text.secondary">
                  消息流会记录本地输入、工具执行结果和实时上下文摘要。
                </Typography>
              </Stack>
              <Button size="small" variant="outlined" startIcon={<ReloadOutlined />} onClick={refreshSessionContext}>
                刷新上下文
              </Button>
            </Stack>
          }
          contentSX={{ p: 0 }}
        >
          <Stack sx={{ minHeight: { xs: 560, xl: 760 }, maxHeight: { xs: 'auto', xl: 'calc(100vh - 220px)' } }}>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
              <Stack sx={{ gap: 1.5 }}>
                {sessionFeed.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      display: 'flex',
                      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <Box
                      sx={(theme) => ({
                        maxWidth: '92%',
                        borderRadius: 3,
                        p: 1.5,
                        bgcolor:
                          message.role === 'user'
                            ? alpha(theme.palette.primary.main, 0.12)
                            : message.role === 'tool'
                              ? alpha(theme.palette.warning.main, 0.1)
                              : alpha(theme.palette.grey[500], 0.08),
                        border: '1px solid',
                        borderColor:
                          message.role === 'user'
                            ? theme.palette.primary.main
                            : message.role === 'tool'
                              ? theme.palette.warning.main
                              : theme.palette.divider
                      })}
                    >
                      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mb: 1 }}>
                        <StatusChip label={message.role} />
                        {message.toolName ? <Chip size="small" label={message.toolName} variant="outlined" /> : null}
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(message.time)}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: message.role === 'tool' ? 'monospace' : undefined
                        }}
                      >
                        {message.content}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ p: 2.5 }}>
              <Stack sx={{ gap: 1.25 }}>
                <TextField
                  label="输入问题或操作说明"
                  multiline
                  minRows={3}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="例如：检查当前对象的阻断原因，并给出可执行步骤。"
                />
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={focusLabel} variant="outlined" />
                  <Button startIcon={<SendOutlined />} variant="contained" onClick={handleSend} disabled={!draft.trim()}>
                    发送消息
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 3 }}>
        <Stack sx={{ gap: 2.5 }}>
          <MainCard title="对象上下文">
            <Stack sx={{ gap: 1.25 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  当前对象
                </Typography>
                <StatusChip label={activeFocusObjectType} />
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Object Key
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {activeFocusObjectKey}
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  目标详情页
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {currentDetailPath}
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {(agentSessionContext?.available_tools || []).map((tool) => (
                  <Chip key={tool} label={tool} size="small" variant="outlined" />
                ))}
              </Stack>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {(agentWorkflows || []).slice(0, 4).map((workflow) => (
                  <Chip key={workflow.name} label={workflow.name} size="small" color="secondary" variant="light" />
                ))}
              </Stack>
              <Divider />
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {agentSessionContext?.system_prompt || '上下文尚未加载。'}
              </Typography>
            </Stack>
          </MainCard>

          <TaskQueueCard
            title="建议步骤"
            items={(agentSessionPlan?.steps || []).map((step, index) => ({
              id: `${agentSessionId}-step-${index}`,
              title: step,
              description: `Step ${index + 1}`,
              status: index === 0 ? 'Next' : 'Queued'
            }))}
            emptyText="当前没有可用建议步骤。"
          />

          <TaskQueueCard title="对象留痕" items={auditPreviewItems} emptyText="当前对象还没有审计记录。" />

          <MainCard
            title="工具调用器"
            secondary={<ToolOutlined style={{ fontSize: 18 }} />}
            contentSX={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
          >
            <TextField
              select
              label="工具"
              value={selectedToolName}
              onChange={(event) => {
                const nextTool = event.target.value;
                setSelectedToolName(nextTool);
                setToolPayload(buildToolPayload(nextTool, activeFocusObjectType, activeFocusObjectKey));
              }}
            >
              {agentTools.map((tool) => (
                <MenuItem key={tool.name} value={tool.name}>
                  {tool.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="JSON payload"
              multiline
              minRows={10}
              value={toolPayload}
              onChange={(event) => setToolPayload(event.target.value)}
              placeholder="请输入工具参数 JSON"
            />
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                onClick={() => setToolPayload(buildToolPayload(selectedToolName, activeFocusObjectType, activeFocusObjectKey))}
                disabled={!selectedToolName}
              >
                填充当前对象
              </Button>
              <Button variant="contained" onClick={handleExecuteTool} disabled={!selectedToolName || toolLoading}>
                {toolLoading ? '执行中...' : '执行工具'}
              </Button>
            </Stack>
            <Divider />
            <Box
              sx={(theme) => ({
                borderRadius: 2,
                border: '1px solid',
                borderColor: toolResult?.error ? theme.palette.error.main : theme.palette.divider,
                bgcolor: alpha(theme.palette.grey[500], 0.04),
                p: 1.25,
                minHeight: 140
              })}
            >
              <Typography variant="caption" color="text.secondary">
                最近结果
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                {formatToolResult(toolResult) || '暂无工具结果。'}
              </Typography>
            </Box>
          </MainCard>

          <MainCard title="对象切换器" contentSX={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <TextField
              select
              label="对象类型"
              value={objectType}
              onChange={(event) => {
                const nextType = event.target.value;
                setObjectType(nextType);
                const nextOptions = selectedObjectOptions[nextType] || selectedObjectOptions.station;
                setObjectKey(nextOptions[0]?.value || 'MME');
              }}
            >
              {objectTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="对象键" value={objectKey} onChange={(event) => setObjectKey(event.target.value)}>
              {currentOptions.map((option) => (
                <MenuItem key={`${objectType}-${option.value}`} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                选择对象后点击“应用对象”即可同步消息流与上下文。
              </Typography>
              <Button variant="outlined" onClick={applyObjectFocus}>
                应用对象
              </Button>
            </Stack>
          </MainCard>
        </Stack>
      </Grid>
    </Grid>
  );
}
