import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Link as RouterLink } from 'react-router-dom';

import BlockingReasonAlert from 'components/sinoport/BlockingReasonAlert';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import LifecycleStepList from 'components/sinoport/LifecycleStepList';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import {
  exceptionDetailRows,
  getGateEvaluationsForTask,
  getHardGatePolicy,
  inboundDocumentGates,
  outboundDocumentGates,
  scenarioTimelineRows,
  stationBlockerQueue,
  stationReviewQueue,
  stationTaskBoard,
  stationTaskSummary
} from 'data/sinoport-adapters';
import { useLocalStorage } from 'hooks/useLocalStorage';

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

const OFFICE_TASK_STORAGE_KEY = 'sinoport-station-task-office-state-v1';

function getTaskDocumentPath(task) {
  if (task.title.includes('POD')) return '/station/documents/pod';
  if (task.title.includes('NOA')) return '/station/documents/noa';
  return '/station/documents';
}

function getTaskExceptionPath(task) {
  return exceptionDetailRows.find((item) => item.objectTo === task.objectTo || item.gateId === task.gateIds[0])?.id
    ? `/station/exceptions/${exceptionDetailRows.find((item) => item.objectTo === task.objectTo || item.gateId === task.gateIds[0]).id}`
    : '/station/exceptions';
}

export default function StationTasksPage() {
  const { state: officeTaskState, setState: setOfficeTaskState } = useLocalStorage(OFFICE_TASK_STORAGE_KEY, {});

  const getOfficeState = (taskId) =>
    officeTaskState[taskId] || {
      planStatus: '待排计划',
      dispatchStatus: '未下发',
      reviewStatus: '待复核'
    };

  const updateOfficeState = (taskId, patch) =>
    setOfficeTaskState((prev) => ({
      ...prev,
      [taskId]: {
        ...getOfficeState(taskId),
        ...patch
      }
    }));

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
        <BlockingReasonAlert title="当前硬门槛阻断" reasons={stationBlockerQueue.map((item) => `${item.title} · ${item.description}`)} />
      </Grid>

      {stationTaskSummary.map((item) => (
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
              {stationTaskBoard.map((item) => {
                const officeState = getOfficeState(item.id);

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
                          <StatusChip label={officeState.reviewStatus} color={officeState.reviewStatus === '已复核' ? 'success' : 'info'} />
                        </Stack>
                        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                          <Button size="small" variant="outlined" onClick={() => updateOfficeState(item.id, { planStatus: '已排计划' })}>
                            标记已排计划
                          </Button>
                          <Button size="small" variant="outlined" onClick={() => updateOfficeState(item.id, { dispatchStatus: '已下发 PDA' })}>
                            下发到 PDA
                          </Button>
                          <Button size="small" variant="outlined" onClick={() => updateOfficeState(item.id, { reviewStatus: '已复核' })}>
                            完成复核
                          </Button>
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
            ...stationReviewQueue.map((item) => ({
              ...item,
              meta: `${getHardGatePolicy(item.gateId)?.releaseRole || '需独立复核或主管确认'} · ${item.description}`,
              actions: [
                { label: '单证中心', to: '/station/documents', variant: 'outlined' },
                { label: '履约链路', to: '/station/shipments', variant: 'outlined' }
              ]
            })),
            {
              id: 'ESC-0408-001',
              title: 'HG-08 · SE913 机坪放行已超时',
              description: 'Manifest 未冻结导致 Loaded 确认延迟，建议升级到 Export Supervisor。',
              meta: getHardGatePolicy('HG-08')?.recovery,
              status: '待升级',
              actions: [
                { label: '异常中心', to: '/station/exceptions', variant: 'outlined' },
                { label: '单证中心', to: '/station/documents', variant: 'outlined' }
              ]
            }
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <DocumentStatusCard title="进港门槛摘要" items={inboundDocumentGates} />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <DocumentStatusCard title="出港门槛摘要" items={outboundDocumentGates} />
      </Grid>

      <Grid size={12}>
        <MainCard title="标准场景编排">
          <LifecycleStepList steps={scenarioTimelineRows.map((item, index) => ({ ...item, progress: Math.max(18, 100 - index * 20) }))} />
        </MainCard>
      </Grid>

      <Grid size={12}>
        <TaskQueueCard
          title="任务与硬门槛映射"
          items={stationTaskBoard.flatMap((item) =>
            getGateEvaluationsForTask(item.id).map((evaluation) => ({
              id: `${item.id}-${evaluation.gateId}`,
              title: `${item.title} · ${evaluation.gateId}`,
              description: evaluation.blockingReason,
              meta: `恢复动作：${evaluation.recoveryAction} · 放行角色：${evaluation.releaseRole}`,
              status: evaluation.status,
              actions: [
                { label: '对象详情', to: item.objectTo, variant: 'outlined' },
                { label: '单证中心', to: '/station/documents', variant: 'outlined' },
                { label: '异常中心', to: '/station/exceptions', variant: 'outlined' }
              ]
            }))
          )}
        />
      </Grid>
    </Grid>
  );
}
