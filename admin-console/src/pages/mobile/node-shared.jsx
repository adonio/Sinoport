import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TablePagination from '@mui/material/TablePagination';
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
  acceptMobileTask,
  completeMobileTask,
  startMobileTask,
  uploadMobileTaskEvidence,
  useGetMobileNodeDetail,
  useGetMobileNodeFlow,
  useGetMobileTasks
} from 'api/station';
import { openSnackbar } from 'api/snackbar';
import { useMobileState } from 'hooks/useMobileState';
import { localizeMobileText, readMobileLanguage } from 'utils/mobile/i18n';
import { getMobileFlowStorageKey, readMobileSession } from 'utils/mobile/session';
import { buildMobileQueueEntry, recordMobileAction, useMobileOpsStorage } from 'utils/mobile/task-ops';

const PAGE_SIZE = 20;

function mt(value) {
  return localizeMobileText(readMobileLanguage() || readMobileSession()?.language, value);
}

function buildTaskActionMessage(language, taskId, actionLabel, failed = false) {
  return localizeMobileText(language, failed ? `任务动作 ${actionLabel} 失败` : `任务 ${taskId} 已执行 ${actionLabel}`);
}

function defaultActionState(detail) {
  return {
    assignedPositions: Object.fromEntries((detail.uldAssignments || []).map((item) => [item.uld, item.position || ''])),
    status: detail.status,
    evidenceUploaded: false,
    signed: false,
    note: mt('尚未执行现场动作。')
  };
}

function buildActionPatch(label, title) {
  if (label.includes('发车')) {
    return { status: '已发车', note: `${title} ${mt('已发车。')}` };
  }
  if (label.includes('放行')) {
    return { status: '已放行', note: `${title} ${mt('已放行。')}` };
  }
  if (label.includes('接机')) {
    return { status: '已接机', note: `${title} ${mt('已接机。')}` };
  }
  if (label.includes('完成') || label.includes('关闭') || label.includes('归档')) {
    return { status: '已完成', note: `${title} ${mt('已完成。')}` };
  }
  if (label.includes('签')) {
    return { signed: true, note: `${label} ${mt('已记录。')}` };
  }
  if (label.includes('上传')) {
    return { evidenceUploaded: true, note: `${label} ${mt('已记录。')}` };
  }
  if (label.includes('挂起')) {
    return { status: '暂时挂起', note: `${title} ${mt('已挂起。')}` };
  }
  if (label.includes('异常')) {
    return { status: '警戒', note: `${title} ${mt('已标记异常。')}` };
  }

  return { status: '运行中', note: `${label} ${mt('已记录。')}` };
}

function matchNodeTask(task, flowKey, itemId) {
  if (task.task_id === itemId || task.related_object_id === itemId || task.flight_no === itemId || task.awb_no === itemId) {
    return true;
  }

  const executionNode = task.execution_node || '';

  if (flowKey === 'flightRuntime') return executionNode.includes('Runtime') || task.flight_no === itemId;
  if (flowKey === 'destinationRamp') return executionNode.includes('Ramp') || task.flight_no === itemId;
  if (flowKey === 'exportRamp') return executionNode.includes('Ramp') || task.flight_no === itemId;
  if (flowKey === 'delivery') return executionNode.includes('Delivery');
  if (flowKey === 'tailhaul') return executionNode.includes('Tail') || executionNode.includes('Truck');
  if (flowKey === 'headhaul') return executionNode.includes('Truck') || executionNode.includes('Headhaul');
  if (flowKey === 'preWarehouse') return executionNode.includes('Warehouse') || executionNode.includes('Receiving');

  return false;
}

export function MobileNodeListPage({ flowKey, pathOf }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { session: mobileSession, roleView, items, listTitle, mobileNodeLoading, mobileNodePage, statusOptions } = useGetMobileNodeFlow(flowKey, {
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword: keyword.trim(),
    status: statusFilter
  });
  const session = mobileSession?.roleKey ? mobileSession : readMobileSession();
  const language = readMobileLanguage() || session?.language;

  if (mobileNodeLoading && !items.length) {
    return (
      <MainCard>
        <Typography variant="body2" color="text.secondary">
          {localizeMobileText(language, '正在加载节点数据...')}
        </Typography>
      </MainCard>
    );
  }

  if (!items.length) {
    return (
      <MainCard>
        <Stack sx={{ gap: 1 }}>
          <Typography variant="h5">{localizeMobileText(language, roleView.label)}</Typography>
          <Typography variant="body2" color="text.secondary">
            {localizeMobileText(language, '当前节点暂时没有样例任务，角色信息仅用于演示标识，不做权限限制。')}
          </Typography>
        </Stack>
      </MainCard>
    );
  }

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard>
        <Stack sx={{ gap: 1.5 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h5">{localizeMobileText(language, listTitle || roleView.label)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {localizeMobileText(language, '当前角色：')}{localizeMobileText(language, roleView.label)}。{localizeMobileText(language, '角色信息仅用于演示标识，不限制任务查看或操作。')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {localizeMobileText(language, '当前列表共')} {mobileNodePage.total || items.length} {localizeMobileText(language, '条')}，{localizeMobileText(language, '默认每页')} {PAGE_SIZE} {localizeMobileText(language, '条')}。
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.25 }}>
            <TextField
              fullWidth
              label={localizeMobileText(language, '关键字')}
              placeholder={localizeMobileText(language, '按任务号、标题或摘要筛选')}
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(0);
              }}
            />
            <TextField
              select
              fullWidth
              label={localizeMobileText(language, '状态')}
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">{localizeMobileText(language, '全部状态')}</MenuItem>
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {localizeMobileText(language, option.label)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      </MainCard>
      {items.map((item) => (
        <MainCard
          key={item.id}
          sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
          onClick={() => navigate(pathOf(item.id))}
        >
          <Stack sx={{ gap: 1.25 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
              <Typography variant="h5">{localizeMobileText(language, item.title)}</Typography>
              <Typography variant="subtitle2" color="primary.main">
              {localizeMobileText(language, item.priority)}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {localizeMobileText(language, item.subtitle)}
            </Typography>
            <Button variant="outlined">{localizeMobileText(language, '查看任务')}</Button>
          </Stack>
        </MainCard>
      ))}
      <MainCard>
        <TablePagination
          component="div"
          rowsPerPageOptions={[PAGE_SIZE]}
          rowsPerPage={PAGE_SIZE}
          count={mobileNodePage.total || items.length}
          page={Math.max(0, Number(mobileNodePage.page || 1) - 1)}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
        />
      </MainCard>
    </Stack>
  );
}

export function MobileNodeDetailPage({ flowKey, itemId, backPath }) {
  const navigate = useNavigate();
  const nodeData = useGetMobileNodeDetail(flowKey, itemId);
  const session = nodeData.session?.roleKey ? nodeData.session : readMobileSession();
  const roleView = nodeData.roleView;
  const language = readMobileLanguage() || session?.language;
  const [activeSection, setActiveSection] = useState(flowKey === 'flightRuntime' ? 'summary' : 'ops');
  const storage = useMobileState(getMobileFlowStorageKey(session, `${flowKey}-${itemId}`), {});
  const opsStorage = useMobileOpsStorage(`node-${flowKey}-${itemId}`);
  const { mobileTasks } = useGetMobileTasks();
  const loading = nodeData.mobileNodeDetailLoading && !nodeData.detail;
  const detail = nodeData.detail;
  const taskCard = nodeData.taskCard || detail;
  const state = useMemo(() => {
    if (!detail) return null;
    return storage.state[itemId] || defaultActionState(detail);
  }, [detail, itemId, storage.state]);

  if (loading) {
    return (
      <MainCard>
        <Typography variant="body2" color="text.secondary">
          {localizeMobileText(language, '正在加载任务详情...')}
        </Typography>
      </MainCard>
    );
  }

  if (!detail || !state) {
    return null;
  }

  const liveTasks = mobileTasks.filter((task) => matchNodeTask(task, flowKey, itemId));

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
      note: offline ? `${localizeMobileText(language, label)} ${localizeMobileText(language, '已离线记录，待补传。')}` : patch.note
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

  const taskActions = (taskCard.actions || []).map((action) => ({
    ...action,
    onClick: () => runTaskAction(action.label)
  }));

  const blockers = taskCard.blockers || [];
  const sectionItems = [
    { key: 'ops', label: localizeMobileText(language, '操作'), icon: ToolOutlined },
    { key: 'task', label: localizeMobileText(language, '任务'), icon: ProfileOutlined },
    { key: 'summary', label: localizeMobileText(language, '摘要'), icon: AppstoreOutlined },
    { key: 'records', label: localizeMobileText(language, '记录'), icon: FileTextOutlined }
  ];

  const handleLiveTaskAction = async (task, action) => {
    try {
      if (action === 'accept') await acceptMobileTask(task.task_id, { note: `Accepted from ${flowKey} detail` });
      if (action === 'start') await startMobileTask(task.task_id, { note: `Started from ${flowKey} detail` });
      if (action === 'evidence') {
        await uploadMobileTaskEvidence(task.task_id, {
          note: `Evidence from ${flowKey} detail`,
          evidence_summary: `${detail.title} evidence summary`
        });
      }
      if (action === 'complete') await completeMobileTask(task.task_id, { note: `Completed from ${flowKey} detail` });

      openSnackbar({
        open: true,
        message: buildTaskActionMessage(language, task.task_id, localizeMobileText(language, action)),
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || buildTaskActionMessage(language, task.task_id, localizeMobileText(language, action), true),
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

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
              {localizeMobileText(language, detail.priority)}
            </Typography>
          </Stack>
        </MainCard>

        {flowKey === 'flightRuntime' && detail.flightInfoRows?.length ? (
          <ObjectSummaryCard
            title={localizeMobileText(language, '航班必须信息')}
            subtitle={localizeMobileText(language, '进入运行确认前，先核对航班主信息、当前阶段和关键文件状态。')}
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
            contextChips={[
              `${localizeMobileText(language, '节点')} ${localizeMobileText(language, detail.node)}`,
              `${localizeMobileText(language, '角色')} ${localizeMobileText(language, roleView.label)}`,
              localizeMobileText(language, `SLA ${detail.sla}`)
            ]}
            liveTasks={liveTasks}
            onTaskAction={handleLiveTaskAction}
            quickLinks={[
              { label: localizeMobileText(language, '返回列表'), variant: 'outlined', onClick: () => navigate(backPath) },
              { label: localizeMobileText(language, '节点选择'), variant: 'outlined', onClick: () => navigate('/mobile/select') }
            ]}
            onSuspend={() => setCurrentState((prev) => ({ ...prev, status: '暂时挂起', note: `${detail.title} ${mt('已挂起。')}` }))}
            onRecover={() => setCurrentState((prev) => ({ ...prev, status: detail.status, note: `${detail.title} ${mt('已恢复。')}` }))}
          />
        ) : null}

        {activeSection === 'task' ? (
          <>
            {flowKey === 'exportRamp' && detail.uldAssignments?.length ? (
              <MainCard title={localizeMobileText(language, '当前飞机 ULD 与机位')}>
                <Stack sx={{ gap: 1.25 }}>
                  {detail.uldAssignments.map((item) => (
                    <Box key={item.uld} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start' }}>
                        <Stack sx={{ gap: 0.35, minWidth: 0 }}>
                          <Typography variant="subtitle2">{item.uld}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {localizeMobileText(language, '目的地')} {localizeMobileText(language, item.destination)} · {item.pieces} · {item.weight}
                          </Typography>
                        </Stack>
                        <TextField
                          select
                          size="small"
                          label={localizeMobileText(language, '位置')}
                          value={state.assignedPositions?.[item.uld] || ''}
                          onChange={(event) =>
                            setCurrentState((prev) => ({
                              ...prev,
                              assignedPositions: {
                                ...(prev.assignedPositions || {}),
                                [item.uld]: event.target.value
                              },
                              note: `${item.uld} ${localizeMobileText(language, '已标记机位')} ${event.target.value || localizeMobileText(language, '未指定')}。`
                            }))
                          }
                          sx={{ minWidth: 112 }}
                        >
                          <MenuItem value="">{localizeMobileText(language, '未指定')}</MenuItem>
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
              <MainCard title={localizeMobileText(language, '飞机舱位卸载任务')}>
                <Stack sx={{ gap: 1.25 }}>
                  {detail.unloadTasks.map((item, index) => (
                    <Box key={`${itemId}-unload-${index}`} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
                        <Stack sx={{ gap: 0.35 }}>
                          <Typography variant="subtitle2">
                            {item.position} / {item.uld}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {localizeMobileText(language, '货物：')}{localizeMobileText(language, item.cargo)}
                          </Typography>
                        </Stack>
                        <Stack sx={{ alignItems: 'flex-end', gap: 0.75 }}>
                          <Typography variant="caption" color="primary.main">
                            {localizeMobileText(language, '待卸载')}
                          </Typography>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() =>
                              setCurrentState((prev) => ({
                                ...prev,
                                note: `${item.uld} / ${item.position} ${localizeMobileText(language, '已完成卸载。')}`
                              }))
                            }
                          >
                            {localizeMobileText(language, '卸载完成')}
                          </Button>
                        </Stack>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {localizeMobileText(language, '卸载要求：')}{localizeMobileText(language, item.requirement)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </MainCard>
            ) : null}

            <TaskCard
              title={localizeMobileText(language, taskCard.title)}
              node={localizeMobileText(language, taskCard.node)}
              role={localizeMobileText(language, taskCard.role)}
              status={state.status}
              priority={taskCard.priority}
              sla={taskCard.sla}
              description={localizeMobileText(language, taskCard.description)}
              evidence={taskCard.evidence.map((item) => localizeMobileText(language, item))}
              blockers={blockers.map((item) => localizeMobileText(language, item))}
              actions={taskActions}
            />
          </>
        ) : null}

        {activeSection === 'summary' ? (
          <>
            {detail.flightInfoRows?.length ? (
              <ObjectSummaryCard
                title={localizeMobileText(language, '航班必须信息')}
                subtitle={localizeMobileText(language, '用于运行确认、异常升级和后续节点联动的关键字段。')}
                status={state.status}
                rows={detail.flightInfoRows.map((item) => ({
                  label: localizeMobileText(language, item.label),
                  value: localizeMobileText(language, item.value)
                }))}
              />
            ) : null}

            {detail.flightDocuments?.length ? (
              <TaskQueueCard
                title={localizeMobileText(language, '关键文件状态')}
                items={detail.flightDocuments.map((item) => ({
                  id: `${itemId}-${item.title}`,
                  title: localizeMobileText(language, item.title),
                  description: localizeMobileText(language, item.description),
                  status: localizeMobileText(language, item.status),
                  meta: localizeMobileText(language, item.meta)
                }))}
              />
            ) : null}

            <ObjectSummaryCard
              title={localizeMobileText(language, '对象摘要')}
              subtitle={localizeMobileText(language, detail.description)}
              status={state.status}
              rows={[
                { label: localizeMobileText(language, '当前角色'), value: localizeMobileText(language, roleView.label) },
                ...taskCard.summaryRows.map((item) => ({
                  label: localizeMobileText(language, item.label),
                  value: localizeMobileText(language, item.value)
                }))
              ]}
            />

            {taskCard.forecastWaybills?.length ? (
              <TaskQueueCard
                title={localizeMobileText(language, '车载提单预报')}
                items={taskCard.forecastWaybills.map((item) => ({
                  id: `${itemId}-${item.awb}`,
                  title: item.awb,
                  description: localizeMobileText(language, item.consignee),
                  status: `${item.pieces} pcs`,
                  meta: `${localizeMobileText(language, '重量')} ${item.weight}`
                }))}
              />
            ) : null}
          </>
        ) : null}

        {activeSection === 'records' ? (
          <>
            <MainCard title={localizeMobileText(language, '现场记录')}>
              <Stack sx={{ gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {state.note}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {localizeMobileText(language, '证据上传：')}{state.evidenceUploaded ? localizeMobileText(language, '已完成') : localizeMobileText(language, '待上传')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {localizeMobileText(language, '签字状态：')}{state.signed ? localizeMobileText(language, '已签字') : localizeMobileText(language, '待签字')}
                </Typography>
              </Stack>
            </MainCard>

            <TaskQueueCard
              title={localizeMobileText(language, '关键检查项')}
              items={taskCard.records.map((item, index) => ({
                id: `${itemId}-${index}`,
                title: localizeMobileText(language, item),
                status: index === 0 ? state.status : localizeMobileText(language, '待处理')
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
