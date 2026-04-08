import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
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

export default function StationTasksPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Task Orchestration"
          title="作业指令中心"
          description="货站端以任务为第一视角管理站内执行，展示任务池、待复核、待升级、阻断原因和标准场景编排。"
          chips={['Task Pool', 'Assignment', 'Escalation', 'Blockers', 'Scenario Timeline']}
          action={
            <Button component={RouterLink} to="/station/documents" variant="outlined">
              查看单证门槛
            </Button>
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
                <TableCell>Gate</TableCell>
                <TableCell>阻断</TableCell>
                <TableCell align="right">跳转</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationTaskBoard.map((item) => (
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
                  <TableCell>{item.gateIds.join(', ')}</TableCell>
                  <TableCell>{item.blocker}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to={item.objectTo} size="small" variant="outlined">
                      对象详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
              meta: `${getHardGatePolicy(item.gateId)?.releaseRole || '需独立复核或主管确认'} · ${item.description}`
            })),
            {
              id: 'ESC-0408-001',
              title: 'HG-08 · SE913 机坪放行已超时',
              description: 'Manifest 未冻结导致 Loaded 确认延迟，建议升级到 Export Supervisor。',
              meta: getHardGatePolicy('HG-08')?.recovery,
              status: '待升级'
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
              status: evaluation.status
            }))
          )}
        />
      </Grid>
    </Grid>
  );
}
