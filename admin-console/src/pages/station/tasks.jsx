import { useState } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import { Link as RouterLink } from 'react-router-dom';

import BlockingReasonAlert from 'components/sinoport/BlockingReasonAlert';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import LifecycleStepList from 'components/sinoport/LifecycleStepList';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { openSnackbar } from 'api/snackbar';
import {
  assignStationTask,
  escalateStationTask,
  raiseStationTaskException,
  reworkStationTask,
  useGetStationTasks,
  verifyStationTask
} from 'api/station';

const mobileOfficeMatrix = [
  {
    mobileNode: '前置仓收货',
    pdaAction: '现场收货、扫码、件重体确认',
    officeAction: '提前建批次、锁定计划 AWB、确认异常口径',
    links: [
      { label: '作业任务', to: '/station/tasks' },
      { label: '单证中心', to: '/station/documents' }
    ]
  },
  {
    mobileNode: '头程卡车',
    pdaAction: '确认 CMR、发车、到站交接',
    officeAction: '先分配 Trip、车牌、司机、Collection Note',
    links: [
      { label: '车辆计划', to: '/station/resources/vehicles' },
      { label: '作业任务', to: '/station/tasks' }
    ]
  },
  {
    mobileNode: '进港点数 / 打托 / 装车',
    pdaAction: '理货、组托、按计划装车',
    officeAction: '先排托盘、装车计划、车牌/司机/Collection Note',
    links: [
      { label: '进港航班', to: '/station/inbound/flights' },
      { label: '车辆计划', to: '/station/resources/vehicles' }
    ]
  },
  {
    mobileNode: '出港收货 / 集装器 / 装机',
    pdaAction: '按计划收货、ULD 执行、机坪装机',
    officeAction: '先排航班计划、ULD、机位、Manifest/UWS',
    links: [
      { label: '出港航班', to: '/station/outbound/flights' },
      { label: '单证中心', to: '/station/documents' }
    ]
  },
  {
    mobileNode: '到港 / 出港机坪',
    pdaAction: '按机位执行卸载或装机并回填状态',
    officeAction: '先下发 ULD 与机位顺序、放行门槛和执行要求',
    links: [
      { label: '作业任务', to: '/station/tasks' },
      { label: '出港航班', to: '/station/outbound/flights' }
    ]
  },
  {
    mobileNode: '航班运行 Runtime',
    pdaAction: '确认 Airborne/Landed、异常上报',
    officeAction: '后台维护运行态、关键字段和后续联动条件',
    links: [
      { label: '进港航班', to: '/station/inbound/flights' },
      { label: '出港航班', to: '/station/outbound/flights' }
    ]
  }
];

function getTaskDocumentPath(task) {
  if (task.title.includes('POD')) return '/station/documents/pod';
  if (task.title.includes('NOA')) return '/station/documents/noa';
  return '/station/documents';
}

function getTaskExceptionPath(task) {
  return task.exceptionId ? `/station/exceptions/${task.exceptionId}` : '/station/exceptions';
}

export default function StationTasksPage() {
  const {
    stationTasks,
    stationTaskSummaryCards,
    stationTaskBlockerQueue,
    stationTaskReviewQueue,
    stationTaskInboundDocumentGates,
    stationTaskOutboundDocumentGates,
    stationTaskTimelineRows,
    stationTaskGateEvaluationRows
  } = useGetStationTasks();
  const [activeMutationId, setActiveMutationId] = useState('');
  const [assignDialogTask, setAssignDialogTask] = useState(null);
  const [exceptionDialogTask, setExceptionDialogTask] = useState(null);
  const [assignForm, setAssignForm] = useState(null);
  const [exceptionForm, setExceptionForm] = useState(null);

  const getOfficeState = (task) => ({
    planStatus: ['Created'].includes(task.status) ? '待排计划' : '已排计划',
    dispatchStatus: ['Created'].includes(task.status) ? '待下发' : '已下发 PDA',
    reviewStatus: ['Completed', 'Verified', 'Closed'].includes(task.status)
      ? '已复核'
      : task.status === 'Exception Raised'
        ? '异常待处理'
        : '待复核'
  });

  const getSuggestedAssignee = (task) => {
    if (task.title.includes('NOA')) {
      return {
        assigned_role: 'document_desk',
        assigned_team_id: 'TEAM-DD-01',
        assigned_worker_id: 'WORKER-DOC-001',
        due_at: '2026-04-08T20:25:00Z',
        task_sla: '15m',
        reason: 'Auto-assigned from task center'
      };
    }

    if (task.title.includes('Inventory') || task.title.includes('Check')) {
      return {
        assigned_role: 'check_worker',
        assigned_team_id: 'TEAM-CK-01',
        assigned_worker_id: 'WORKER-CK-007',
        due_at: '2026-04-08T19:45:00Z',
        task_sla: '30m',
        reason: 'Auto-assigned from task center'
      };
    }

    return {
      assigned_role: 'inbound_operator',
      assigned_team_id: 'TEAM-IN-01',
      assigned_worker_id: 'WORKER-PDA-001',
      due_at: '2026-04-08T19:30:00Z',
      task_sla: '30m',
      reason: 'Auto-assigned from task center'
    };
  };

  const getSuggestedException = (task) => ({
    exception_type: 'PiecesMismatch',
    severity: task.priority === 'P1' ? 'P1' : 'P2',
    blocker_flag: true,
    owner_role: task.role === 'check_worker' ? 'check_worker' : 'inbound_operator',
    owner_team_id: task.role === 'check_worker' ? 'TEAM-CK-01' : 'TEAM-IN-01',
    root_cause: `task center reported blocker ${task.blocker || 'manual review required'}`,
    action_taken: 'hold further task progression',
    note: 'Raised from task center quick action'
  });

  const handleWorkflowAction = async (task, action) => {
    try {
      setActiveMutationId(`${action}:${task.id}`);
      if (action === 'verify') {
        await verifyStationTask(task.id, { note: 'Verified from task center' });
      }
      if (action === 'rework') {
        await reworkStationTask(task.id, { note: 'Rework requested from task center', reason: 'Manual rework request' });
      }
      if (action === 'escalate') {
        await escalateStationTask(task.id, { note: 'Escalated from task center', reason: 'Supervisor escalation' });
      }

      openSnackbar({
        open: true,
        message: `${task.title} 已执行 ${action}。`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || `${action} 失败`,
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveMutationId('');
    }
  };

  const openAssignDialog = (task) => {
    setAssignDialogTask(task);
    setAssignForm(getSuggestedAssignee(task));
  };

  const openExceptionDialog = (task) => {
    setExceptionDialogTask(task);
    setExceptionForm(getSuggestedException(task));
  };

  const submitAssignDialog = async () => {
    if (!assignDialogTask || !assignForm) return;

    try {
      setActiveMutationId(`assign:${assignDialogTask.id}`);
      await assignStationTask(assignDialogTask.id, assignForm);
      setAssignDialogTask(null);
      openSnackbar({
        open: true,
        message: `${assignDialogTask.title} 已完成真实分派。`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || '任务分派失败',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveMutationId('');
    }
  };

  const submitExceptionDialog = async () => {
    if (!exceptionDialogTask || !exceptionForm) return;

    try {
      setActiveMutationId(`exception:${exceptionDialogTask.id}`);
      await raiseStationTaskException(exceptionDialogTask.id, exceptionForm);
      setExceptionDialogTask(null);
      openSnackbar({
        open: true,
        message: `${exceptionDialogTask.title} 已上报异常。`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || '异常上报失败',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveMutationId('');
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Task Orchestration"
          title="作业指令中心"
          description="货站端以任务为第一视角管理站内执行，展示任务池、待复核、待升级、阻断原因和标准场景编排。"
          chips={['Task Pool', 'Assignment', 'Escalation', 'Blockers', 'Scenario Timeline']}
          action={
            <Grid container spacing={1} sx={{ width: 'auto' }}>
              <Grid>
                <Button component={RouterLink} to="/station/documents" variant="outlined">
                  单证与指令中心
                </Button>
              </Grid>
              <Grid>
                <Button component={RouterLink} to="/station/shipments" variant="outlined">
                  提单与履约链路
                </Button>
              </Grid>
              <Grid>
                <Button component={RouterLink} to="/station/exceptions" variant="outlined">
                  异常中心
                </Button>
              </Grid>
            </Grid>
          }
        />
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title="当前硬门槛阻断" reasons={stationTaskBlockerQueue.map((item) => `${item.title} · ${item.description}`)} />
      </Grid>

      {stationTaskSummaryCards.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={12}>
        <MainCard title="PDA 对应后台动作矩阵">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>移动端节点</TableCell>
                <TableCell>PDA 现场动作</TableCell>
                <TableCell>后台管理人员动作</TableCell>
                <TableCell align="right">后台入口</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mobileOfficeMatrix.map((item) => (
                <TableRow key={item.mobileNode} hover>
                  <TableCell>{item.mobileNode}</TableCell>
                  <TableCell>{item.pdaAction}</TableCell>
                  <TableCell>{item.officeAction}</TableCell>
                  <TableCell align="right">
                    <Grid container spacing={1} sx={{ width: 'auto', justifyContent: 'flex-end' }}>
                      {item.links.map((link) => (
                        <Grid key={`${item.mobileNode}-${link.to}`}>
                          <Button component={RouterLink} to={link.to} size="small" variant="outlined">
                            {link.label}
                          </Button>
                        </Grid>
                      ))}
                    </Grid>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title="站内任务池">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>任务</TableCell>
                <TableCell>节点</TableCell>
                <TableCell>角色</TableCell>
                <TableCell>责任班组</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell>优先级</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>办公室编排</TableCell>
                <TableCell>Gate</TableCell>
                <TableCell>阻断</TableCell>
                <TableCell align="right">跳转</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationTasks.map((item) => {
                const officeState = getOfficeState(item);

                return (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{item.node}</TableCell>
                    <TableCell>{item.role}</TableCell>
                    <TableCell>{item.owner}</TableCell>
                    <TableCell>{item.due}</TableCell>
                    <TableCell>{item.priority}</TableCell>
                    <TableCell>
                      <StatusChip label={item.status} />
                    </TableCell>
                    <TableCell>
                      <Stack sx={{ gap: 0.75 }}>
                        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                          <StatusChip label={officeState.planStatus} color={officeState.planStatus === '已排计划' ? 'success' : 'warning'} />
                          <StatusChip label={officeState.dispatchStatus} color={officeState.dispatchStatus === '已下发 PDA' ? 'success' : 'secondary'} />
                          <StatusChip label={officeState.reviewStatus} color={officeState.reviewStatus === '已复核' ? 'success' : officeState.reviewStatus === '异常待处理' ? 'warning' : 'info'} />
                        </Stack>
                      </Stack>
                    </TableCell>
                    <TableCell>{item.gateIds.join(', ')}</TableCell>
                    <TableCell>{item.blocker}</TableCell>
                    <TableCell align="right">
                      <Grid container spacing={1} sx={{ width: 'auto', justifyContent: 'flex-end' }}>
                        <Grid>
                          <Button component={RouterLink} to={item.objectTo} size="small" variant="outlined">
                            对象详情
                          </Button>
                        </Grid>
                        <Grid>
                          <Button component={RouterLink} to={getTaskDocumentPath(item)} size="small" variant="outlined">
                            单证
                          </Button>
                        </Grid>
                        <Grid>
                          <Button component={RouterLink} to={getTaskExceptionPath(item)} size="small" variant="outlined">
                            异常
                          </Button>
                        </Grid>
                        <Grid>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openAssignDialog(item)}
                            disabled={activeMutationId === `assign:${item.id}` || ['Completed', 'Verified', 'Closed'].includes(item.status)}
                          >
                            真实分派
                          </Button>
                        </Grid>
                        <Grid>
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            onClick={() => openExceptionDialog(item)}
                            disabled={activeMutationId === `exception:${item.id}` || item.status === 'Exception Raised'}
                          >
                            上报异常
                          </Button>
                        </Grid>
                        <Grid>
                          <Button
                            size="small"
                            color="success"
                            variant="outlined"
                            onClick={() => handleWorkflowAction(item, 'verify')}
                            disabled={activeMutationId === `verify:${item.id}` || !['Completed', 'Evidence Uploaded'].includes(item.status)}
                          >
                            复核
                          </Button>
                        </Grid>
                        <Grid>
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            onClick={() => handleWorkflowAction(item, 'rework')}
                            disabled={activeMutationId === `rework:${item.id}` || ['Closed', 'Rejected'].includes(item.status)}
                          >
                            返工
                          </Button>
                        </Grid>
                        <Grid>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => handleWorkflowAction(item, 'escalate')}
                            disabled={activeMutationId === `escalate:${item.id}` || ['Verified', 'Closed'].includes(item.status)}
                          >
                            升级
                          </Button>
                        </Grid>
                      </Grid>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <TaskQueueCard
          title="待复核与待升级"
          items={[
            ...stationTaskReviewQueue.map((item) => ({
              ...item,
              actions: [
                { label: '单证中心', to: '/station/documents', variant: 'outlined' },
                { label: '履约链路', to: '/station/shipments', variant: 'outlined' }
              ]
            }))
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <DocumentStatusCard title="进港门槛摘要" items={stationTaskInboundDocumentGates} />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <DocumentStatusCard title="出港门槛摘要" items={stationTaskOutboundDocumentGates} />
      </Grid>

      <Grid size={12}>
        <MainCard title="标准场景编排">
          <LifecycleStepList steps={stationTaskTimelineRows} />
        </MainCard>
      </Grid>

      <Grid size={12}>
        <TaskQueueCard
          title="任务与硬门槛映射"
          items={stationTaskGateEvaluationRows}
        />
      </Grid>

      <Dialog open={Boolean(assignDialogTask)} onClose={() => setAssignDialogTask(null)} fullWidth maxWidth="sm">
        <DialogTitle>任务分派</DialogTitle>
        <DialogContent dividers>
          <Stack sx={{ gap: 1.5, pt: 0.5 }}>
            <TextField
              label="角色"
              value={assignForm?.assigned_role || ''}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, assigned_role: event.target.value }))}
            />
            <TextField
              label="班组"
              value={assignForm?.assigned_team_id || ''}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, assigned_team_id: event.target.value }))}
            />
            <TextField
              label="人员"
              value={assignForm?.assigned_worker_id || ''}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, assigned_worker_id: event.target.value }))}
            />
            <TextField
              label="截止时间"
              value={assignForm?.due_at || ''}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, due_at: event.target.value }))}
            />
            <TextField
              label="SLA"
              value={assignForm?.task_sla || ''}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, task_sla: event.target.value }))}
            />
            <TextField
              label="原因"
              multiline
              minRows={3}
              value={assignForm?.reason || ''}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, reason: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogTask(null)}>取消</Button>
          <Button onClick={submitAssignDialog} variant="contained" disabled={activeMutationId === `assign:${assignDialogTask?.id || ''}`}>
            提交
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(exceptionDialogTask)} onClose={() => setExceptionDialogTask(null)} fullWidth maxWidth="sm">
        <DialogTitle>上报异常</DialogTitle>
        <DialogContent dividers>
          <Stack sx={{ gap: 1.5, pt: 0.5 }}>
            <TextField
              label="异常类型"
              value={exceptionForm?.exception_type || ''}
              onChange={(event) => setExceptionForm((prev) => ({ ...prev, exception_type: event.target.value }))}
            />
            <TextField
              label="严重等级"
              value={exceptionForm?.severity || ''}
              onChange={(event) => setExceptionForm((prev) => ({ ...prev, severity: event.target.value }))}
            />
            <TextField
              label="责任角色"
              value={exceptionForm?.owner_role || ''}
              onChange={(event) => setExceptionForm((prev) => ({ ...prev, owner_role: event.target.value }))}
            />
            <TextField
              label="责任班组"
              value={exceptionForm?.owner_team_id || ''}
              onChange={(event) => setExceptionForm((prev) => ({ ...prev, owner_team_id: event.target.value }))}
            />
            <TextField
              label="根因"
              multiline
              minRows={2}
              value={exceptionForm?.root_cause || ''}
              onChange={(event) => setExceptionForm((prev) => ({ ...prev, root_cause: event.target.value }))}
            />
            <TextField
              label="已采取动作"
              multiline
              minRows={2}
              value={exceptionForm?.action_taken || ''}
              onChange={(event) => setExceptionForm((prev) => ({ ...prev, action_taken: event.target.value }))}
            />
            <TextField
              label="备注"
              multiline
              minRows={2}
              value={exceptionForm?.note || ''}
              onChange={(event) => setExceptionForm((prev) => ({ ...prev, note: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExceptionDialogTask(null)}>取消</Button>
          <Button onClick={submitExceptionDialog} variant="contained" disabled={activeMutationId === `exception:${exceptionDialogTask?.id || ''}`}>
            提交
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
