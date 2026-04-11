import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import ProfileOutlined from '@ant-design/icons/ProfileOutlined';
import ToolOutlined from '@ant-design/icons/ToolOutlined';

import MainCard from 'components/MainCard';
import ObjectSummaryCard from 'components/sinoport/ObjectSummaryCard';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import TaskCard from 'components/sinoport/mobile/TaskCard';
import TaskOpsPanel from 'components/sinoport/mobile/TaskOpsPanel';
import {
  filterMobileActionsByRole,
  getMobileNodeDetail,
  getMobileNodeItems,
  getMobileRoleView,
  isMobileFlowAllowed,
  isMobileRoleAllowed
} from 'data/sinoport-adapters';
import { useLocalStorage } from 'hooks/useLocalStorage';
import { localizeMobileText, readMobileLanguage } from 'utils/mobile/i18n';
import { getMobileFlowStorageKey, getMobileRoleKey, readMobileSession } from 'utils/mobile/session';
import { buildMobileQueueEntry, recordMobileAction, useMobileOpsStorage } from 'utils/mobile/task-ops';

function defaultActionState(detail) {
  return {
    assignedPositions: Object.fromEntries((detail.uldAssignments || []).map((item) => [item.uld, item.position || ''])),
    status: detail.status,
    evidenceUploaded: false,
    signed: false,
    note: '尚未执行现场动作。'
  };
}

function buildActionPatch(label, title) {
  if (label.includes('发车')) {
    return { status: '已发车', note: `${title} 已发车。` };
  }
  if (label.includes('放行')) {
    return { status: '已放行', note: `${title} 已放行。` };
  }
  if (label.includes('接机')) {
    return { status: '已接机', note: `${title} 已接机。` };
  }
  if (label.includes('完成') || label.includes('关闭') || label.includes('归档')) {
    return { status: '已完成', note: `${title} 已完成。` };
  }
  if (label.includes('签')) {
    return { signed: true, note: `${label} 已记录。` };
  }
  if (label.includes('上传')) {
    return { evidenceUploaded: true, note: `${label} 已记录。` };
  }
  if (label.includes('挂起')) {
    return { status: '暂时挂起', note: `${title} 已挂起。` };
  }
  if (label.includes('异常')) {
    return { status: '警戒', note: `${title} 已标记异常。` };
  }

  return { status: '运行中', note: `${label} 已记录。` };
}

function useNodeRoleContext(flowKey) {
  const session = readMobileSession();
  const roleKey = getMobileRoleKey(session);
  const roleView = getMobileRoleView(roleKey);
  const language = session?.language || readMobileLanguage();

  return { session, roleKey, roleView, language, flowAllowed: isMobileFlowAllowed(roleKey, flowKey) };
}

export function MobileNodeListPage({ flowKey, pathOf }) {
  const navigate = useNavigate();
  const { roleKey, roleView, language, flowAllowed } = useNodeRoleContext(flowKey);

  const items = getMobileNodeItems(flowKey)
    .map((item) => {
      const detail = getMobileNodeDetail(flowKey, item.id);
      const allowed = detail ? isMobileRoleAllowed(roleKey, detail.role) || flowAllowed : flowAllowed;

      return {
        ...item,
        title: localizeMobileText(language, item.title),
        subtitle: localizeMobileText(language, item.subtitle),
        allowed
      };
    })
    .filter((item) => item.allowed);

  if (!items.length) {
    return (
      <MainCard>
        <Stack sx={{ gap: 1 }}>
          <Typography variant="h5">{localizeMobileText(language, roleView.label)}</Typography>
          <Typography variant="body2" color="text.secondary">
            当前节点暂时没有样例任务，角色信息仅用于演示标识，不做权限限制。
          </Typography>
        </Stack>
      </MainCard>
    );
  }

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard>
        <Typography variant="body2" color="text.secondary">
          当前角色：{localizeMobileText(language, roleView.label)}。角色信息仅用于演示标识，不限制任务查看或操作。
        </Typography>
      </MainCard>
      {items.map((item) => (
        <MainCard
          key={item.id}
          sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
          onClick={() => navigate(pathOf(item.id))}
        >
          <Stack sx={{ gap: 1.25 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
              <Typography variant="h5">{item.title}</Typography>
              <Typography variant="subtitle2" color="primary.main">
                {item.priority}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {item.subtitle}
            </Typography>
            <Button variant="outlined">查看任务</Button>
          </Stack>
        </MainCard>
      ))}
    </Stack>
  );
}

export function MobileNodeDetailPage({ flowKey, itemId, backPath }) {
  const navigate = useNavigate();
  const { session, roleKey, roleView, language, flowAllowed } = useNodeRoleContext(flowKey);
  const [activeSection, setActiveSection] = useState(flowKey === 'flightRuntime' ? 'summary' : 'ops');
  const detail = getMobileNodeDetail(flowKey, itemId);
  const storage = useLocalStorage(getMobileFlowStorageKey(session, `${flowKey}-${itemId}`), {});
  const opsStorage = useMobileOpsStorage(`node-${flowKey}-${itemId}`);

  const state = useMemo(() => {
    if (!detail) return null;
    return storage.state[itemId] || defaultActionState(detail);
  }, [detail, itemId, storage.state]);

  if (!detail || !state) {
    return null;
  }

  const roleAllowed = isMobileRoleAllowed(roleKey, detail.role) || flowAllowed;

  const setCurrentState = (updater) => {
    storage.setState((prev) => {
      const current = prev[itemId] || defaultActionState(detail);
      const next = typeof updater === 'function' ? updater(current) : updater;

      return {
        ...prev,
        [itemId]: next
      };
    });
  };

  const runTaskAction = (label) => {
    const patch = buildActionPatch(label, detail.title);
    const offline = opsStorage.state.deviceMode === 'offline';

    setCurrentState((prev) => ({
      ...prev,
      ...patch,
      note: offline ? `${label} 已离线记录，待补传。` : patch.note
    }));

    opsStorage.setState((prev) =>
      recordMobileAction(
        prev,
        buildMobileQueueEntry(session, {
          label,
          taskLabel: detail.title,
          payloadSummary: `${detail.node} / ${detail.role}`,
          roleLabel: roleView.label
        })
      )
    );
  };

  const taskActions = filterMobileActionsByRole(
    roleKey,
    detail.actions.map((action) => ({
      ...action,
      onClick: () => runTaskAction(action.label)
    }))
  );

  const blockers = roleAllowed ? detail.blockers : [...detail.blockers, `当前角色 ${roleView.label} 仅可查看，不可执行 ${detail.role} 任务。`];
  const sectionItems = [
    { key: 'ops', label: '操作', icon: ToolOutlined },
    { key: 'task', label: '任务', icon: ProfileOutlined },
    { key: 'summary', label: '摘要', icon: AppstoreOutlined },
    { key: 'records', label: '记录', icon: FileTextOutlined }
  ];

  return (
    <Box sx={{ pb: 12 }}>
      <Stack sx={{ gap: 1.5 }}>
        <MainCard contentSX={{ p: 2 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start' }}>
            <Stack sx={{ gap: 0.5 }}>
              <Typography variant="overline" color="primary.main">
                {localizeMobileText(language, detail.node)}
              </Typography>
              <Typography variant="h5">{localizeMobileText(language, detail.title)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {localizeMobileText(language, detail.description)}
              </Typography>
            </Stack>
            <Typography variant="subtitle2" color="primary.main">
              {detail.priority}
            </Typography>
          </Stack>
        </MainCard>

        {flowKey === 'flightRuntime' && detail.flightInfoRows?.length ? (
          <ObjectSummaryCard
            title="航班必须信息"
            subtitle="进入运行确认前，先核对航班主信息、当前阶段和关键文件状态。"
            status={state.status}
            rows={detail.flightInfoRows.map((item) => ({
              label: localizeMobileText(language, item.label),
              value: localizeMobileText(language, item.value)
            }))}
          />
        ) : null}

        {activeSection === 'ops' ? (
          <TaskOpsPanel
            scopeKey={`node-${flowKey}-${itemId}`}
            currentLabel={detail.title}
            contextChips={[`节点 ${detail.node}`, `角色 ${roleView.label}`, `SLA ${detail.sla}`]}
            quickLinks={[
              { label: '返回列表', variant: 'outlined', onClick: () => navigate(backPath) },
              { label: '节点选择', variant: 'outlined', onClick: () => navigate('/mobile/select') }
            ]}
            onSuspend={() => setCurrentState((prev) => ({ ...prev, status: '暂时挂起', note: `${detail.title} 已挂起。` }))}
            onRecover={() => setCurrentState((prev) => ({ ...prev, status: detail.status, note: `${detail.title} 已恢复。` }))}
          />
        ) : null}

        {activeSection === 'task' ? (
          <>
            {flowKey === 'exportRamp' && detail.uldAssignments?.length ? (
              <MainCard title="当前飞机 ULD 与机位">
                <Stack sx={{ gap: 1.25 }}>
                  {detail.uldAssignments.map((item) => (
                    <Box key={item.uld} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start' }}>
                        <Stack sx={{ gap: 0.35, minWidth: 0 }}>
                          <Typography variant="subtitle2">{item.uld}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            目的地 {item.destination} · {item.pieces} · {item.weight}
                          </Typography>
                        </Stack>
                        <TextField
                          select
                          size="small"
                          label="位置"
                          value={state.assignedPositions?.[item.uld] || ''}
                          onChange={(event) =>
                            setCurrentState((prev) => ({
                              ...prev,
                              assignedPositions: {
                                ...(prev.assignedPositions || {}),
                                [item.uld]: event.target.value
                              },
                              note: `${item.uld} 已标记机位 ${event.target.value || '未指定'}。`
                            }))
                          }
                          sx={{ minWidth: 112 }}
                        >
                          <MenuItem value="">未指定</MenuItem>
                          {(detail.positionOptions || []).map((position) => (
                            <MenuItem key={position} value={position}>
                              {position}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </MainCard>
            ) : null}

            {flowKey === 'destinationRamp' && detail.unloadTasks?.length ? (
              <MainCard title="飞机舱位卸载任务">
                <Stack sx={{ gap: 1.25 }}>
                  {detail.unloadTasks.map((item, index) => (
                    <Box key={`${itemId}-unload-${index}`} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
                        <Stack sx={{ gap: 0.35 }}>
                          <Typography variant="subtitle2">
                            {item.position} / {item.uld}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            货物：{item.cargo}
                          </Typography>
                        </Stack>
                        <Stack sx={{ alignItems: 'flex-end', gap: 0.75 }}>
                          <Typography variant="caption" color="primary.main">
                            待卸载
                          </Typography>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() =>
                              setCurrentState((prev) => ({
                                ...prev,
                                note: `${item.uld} / ${item.position} 已完成卸载。`
                              }))
                            }
                          >
                            卸载完成
                          </Button>
                        </Stack>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        卸载要求：{item.requirement}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </MainCard>
            ) : null}

            <TaskCard
              title={localizeMobileText(language, detail.title)}
              node={localizeMobileText(language, detail.node)}
              role={localizeMobileText(language, detail.role)}
              status={state.status}
              priority={detail.priority}
              sla={detail.sla}
              description={localizeMobileText(language, detail.description)}
              evidence={detail.evidence.map((item) => localizeMobileText(language, item))}
              blockers={blockers.map((item) => localizeMobileText(language, item))}
              actions={roleAllowed ? taskActions : []}
            />
          </>
        ) : null}

        {activeSection === 'summary' ? (
          <>
            {detail.flightInfoRows?.length ? (
              <ObjectSummaryCard
                title="航班必须信息"
                subtitle="用于运行确认、异常升级和后续节点联动的关键字段。"
                status={state.status}
                rows={detail.flightInfoRows.map((item) => ({
                  label: localizeMobileText(language, item.label),
                  value: localizeMobileText(language, item.value)
                }))}
              />
            ) : null}

            {detail.flightDocuments?.length ? (
              <TaskQueueCard
                title="关键文件状态"
                items={detail.flightDocuments.map((item) => ({
                  id: `${itemId}-${item.title}`,
                  title: item.title,
                  description: localizeMobileText(language, item.description),
                  status: localizeMobileText(language, item.status),
                  meta: localizeMobileText(language, item.meta)
                }))}
              />
            ) : null}

            <ObjectSummaryCard
              title="对象摘要"
              subtitle={localizeMobileText(language, detail.description)}
              status={state.status}
              rows={[
                { label: '当前角色', value: localizeMobileText(language, roleView.label) },
                ...detail.summaryRows.map((item) => ({
                  label: localizeMobileText(language, item.label),
                  value: localizeMobileText(language, item.value)
                }))
              ]}
            />

            {detail.forecastWaybills?.length ? (
              <TaskQueueCard
                title="车载提单预报"
                items={detail.forecastWaybills.map((item) => ({
                  id: `${itemId}-${item.awb}`,
                  title: item.awb,
                  description: item.consignee,
                  status: `${item.pieces} pcs`,
                  meta: `重量 ${item.weight}`
                }))}
              />
            ) : null}
          </>
        ) : null}

        {activeSection === 'records' ? (
          <>
            <MainCard title="现场记录">
              <Stack sx={{ gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {state.note}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  证据上传：{state.evidenceUploaded ? '已完成' : '待上传'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  签字状态：{state.signed ? '已签字' : '待签字'}
                </Typography>
              </Stack>
            </MainCard>

            <TaskQueueCard
              title="关键检查项"
              items={detail.records.map((item, index) => ({
                id: `${itemId}-${index}`,
                title: localizeMobileText(language, item),
                status: index === 0 ? state.status : '待处理'
              }))}
            />
          </>
        ) : null}
      </Stack>

      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          bottom: 'calc(12px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 24px)',
          maxWidth: 456,
          borderRadius: 4,
          px: 1,
          py: 0.75,
          zIndex: 12
        }}
      >
        <Stack direction="row" sx={{ gap: 1 }}>
          {sectionItems.map((item) => {
            const active = activeSection === item.key;
            const Icon = item.icon;

            return (
              <Button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                variant={active ? 'contained' : 'text'}
                color={active ? 'primary' : 'inherit'}
                sx={{ flex: 1, minWidth: 0, px: 0.75, py: 1.15, borderRadius: 2.5, color: active ? 'common.white' : 'text.primary' }}
              >
                <Stack sx={{ alignItems: 'center', gap: 0.6, width: '100%' }}>
                  <Icon />
                  <Typography variant="caption" sx={{ lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                    {item.label}
                  </Typography>
                </Stack>
              </Button>
            );
          })}
        </Stack>
      </Paper>
    </Box>
  );
}
