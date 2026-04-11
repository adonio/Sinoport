import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { Link as RouterLink, useParams } from 'react-router-dom';

import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MainCard from 'components/MainCard';
import ObjectSummaryCard from 'components/sinoport/ObjectSummaryCard';
import PageHeader from 'components/sinoport/PageHeader';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { exceptionDetailRows, getGateEvaluationsForException, getHardGatePolicy } from 'data/sinoport-adapters';

export default function StationExceptionDetailPage() {
  const { exceptionId } = useParams();
  const item = exceptionDetailRows.find((entry) => entry.id === exceptionId) || exceptionDetailRows[0];
  const gatePolicy = getHardGatePolicy(item.gateId);
  const gateItems = getGateEvaluationsForException(item.id).map((entry) => ({
    gateId: entry.gateId,
    node: entry.node,
    required: entry.required,
    impact: entry.impact,
    status: entry.status,
    blocker: entry.blockingReason,
    recovery: entry.recoveryAction,
    releaseRole: entry.releaseRole
  }));

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Exception Detail"
          title={`异常详情 / ${item.id}`}
          description="异常详情页固定展示异常摘要、阻断任务、门槛规则、恢复动作和关联对象跳转。"
          chips={[item.type, item.object, item.sla]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to={item.objectTo} variant="outlined">
                关联对象
              </Button>
              <Button component={RouterLink} to={item.jumpTo} variant="outlined">
                当前动作
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证中心
              </Button>
              <Button component={RouterLink} to="/station/exceptions" variant="outlined">
                返回异常中心
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <ObjectSummaryCard
          title="异常摘要"
          subtitle="第二批把异常从列表升级成独立详情对象。"
          status={item.status}
          rows={[
            { label: '异常类型', value: item.type },
            { label: '对象', value: item.object },
            { label: 'Owner', value: item.owner },
            { label: 'SLA', value: item.sla },
            { label: 'Gate', value: item.gateId }
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <TaskQueueCard
          title="阻断任务与恢复动作"
          items={[
            {
              id: `${item.id}-1`,
              title: `阻断任务：${item.blockedTask}`,
              description: `命中规则：${item.gateId} / ${item.requiredGate}`,
              meta: `阻断结果：${gatePolicy?.blocker}`,
              status: item.status,
              actions: [
                { label: '作业指令中心', to: '/station/tasks', variant: 'outlined' },
                { label: '关联对象', to: item.objectTo, variant: 'outlined' }
              ]
            },
            {
              id: `${item.id}-2`,
              title: `恢复动作：${item.recoveryAction}`,
              description: '按恢复动作补齐文件、任务或签收后解除阻断。',
              meta: `放行角色：${gatePolicy?.releaseRole}`,
              status: '待处理',
              actions: [
                { label: '执行恢复动作', to: item.jumpTo, variant: 'contained' },
                { label: '打开单证中心', to: '/station/documents', variant: 'outlined' }
              ]
            }
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="关联文件">
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {item.relatedFiles.map((entry) => (
              <Button key={entry.label} component={RouterLink} to={entry.to} variant="outlined" size="small">
                {entry.label}
              </Button>
            ))}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="关联跳转">
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Button component={RouterLink} to={item.jumpTo} variant="contained">
              打开关联页面
            </Button>
            <Button component={RouterLink} to={item.objectTo} variant="outlined">
              打开关联对象
            </Button>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <DocumentStatusCard title="命中的硬门槛" items={gateItems} />
      </Grid>
    </Grid>
  );
}
