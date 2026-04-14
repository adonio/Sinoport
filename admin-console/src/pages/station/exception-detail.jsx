import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { resolveStationException, useGetObjectAudit, useGetStationExceptionDetail } from 'api/station';
import { openSnackbar } from 'api/snackbar';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MainCard from 'components/MainCard';
import ObjectAuditTrail from 'components/sinoport/ObjectAuditTrail';
import ObjectSummaryCard from 'components/sinoport/ObjectSummaryCard';
import PageHeader from 'components/sinoport/PageHeader';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { buildStationCopilotUrl } from 'utils/copilot';

function buildObjectLink(detail) {
  if (detail.related_object_type === 'Flight') {
    return `/station/inbound/flights/${encodeURIComponent(detail.related_object_label.split(' / ')[0] || '')}`;
  }

  if (detail.related_object_type === 'AWB') {
    return `/station/inbound/waybills/${encodeURIComponent(detail.related_object_label.split(' / ')[0] || '')}`;
  }

  if (detail.related_object_type === 'Shipment') {
    return '/station/shipments';
  }

  return '/station/tasks';
}

export default function StationExceptionDetailPage() {
  const { exceptionId } = useParams();
  const { stationExceptionDetail } = useGetStationExceptionDetail(exceptionId);
  const { objectAuditEvents, objectAuditTransitions } = useGetObjectAudit('Exception', undefined, exceptionId);

  const handleResolve = async () => {
    if (!stationExceptionDetail?.exception_id) return;

    try {
      await resolveStationException(stationExceptionDetail.exception_id, {
        note: 'Resolved from exception detail',
        resolution: stationExceptionDetail.recovery_action || 'Resolved from exception detail'
      });
      openSnackbar({
        open: true,
        message: `${stationExceptionDetail.exception_id} 已恢复`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || '异常恢复失败',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  if (!stationExceptionDetail) {
    return (
      <Grid container rowSpacing={3} columnSpacing={3}>
        <Grid size={12}>
          <PageHeader
            eyebrow="Exception Detail"
            title="未找到异常"
            description={`未找到异常 ${exceptionId || ''}，请返回异常中心重新选择。`}
            action={
              <Button component={RouterLink} to="/station/exceptions" variant="contained">
                返回异常中心
              </Button>
            }
          />
        </Grid>
      </Grid>
    );
  }

  const gatePolicy = stationExceptionDetail.gatePolicySummary?.[0];
  const gateItems = [
    {
      gateId: stationExceptionDetail.gate_id || 'EXC',
      node: stationExceptionDetail.exception_type,
      required: gatePolicy?.required || stationExceptionDetail.required_gate || '需完成异常恢复与复核',
      impact: gatePolicy?.impact || (stationExceptionDetail.blocker_flag ? '当前阻断主链推进' : '当前不阻断主链'),
      status: gatePolicy?.status || stationExceptionDetail.exception_status,
      blocker: gatePolicy?.blocker || stationExceptionDetail.root_cause || '',
      recovery: gatePolicy?.recovery || stationExceptionDetail.recovery_action || stationExceptionDetail.action_taken || '',
      releaseRole: gatePolicy?.releaseRole || stationExceptionDetail.owner_role
    }
  ];
  const objectTo = buildObjectLink(stationExceptionDetail);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Exception Detail"
          title={`异常详情 / ${stationExceptionDetail.exception_id}`}
          description="异常详情页直接读取真实 Exception 对象、关联文件、阻断任务与对象审计。"
          chips={[stationExceptionDetail.exception_type, stationExceptionDetail.related_object_label, stationExceptionDetail.severity]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to={objectTo} variant="outlined">
                关联对象
              </Button>
              <Button component={RouterLink} to={buildStationCopilotUrl('Exception', stationExceptionDetail.exception_id)} variant="outlined">
                Copilot
              </Button>
              <Button component={RouterLink} to={stationExceptionDetail.linked_task_id ? '/station/tasks' : '/station/documents'} variant="outlined">
                当前动作
              </Button>
              <Button variant="contained" onClick={handleResolve}>
                恢复异常
              </Button>
              <Button component={RouterLink} to="/station/exceptions" variant="outlined">
                返回异常中心
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <ObjectSummaryCard
          title="异常摘要"
          subtitle="当前异常对象与阻断信息均来自真实后端。"
          status={stationExceptionDetail.exception_status}
          rows={[
            { label: '异常类型', value: stationExceptionDetail.exception_type },
            { label: '关联对象', value: stationExceptionDetail.related_object_label },
            { label: 'Owner', value: [stationExceptionDetail.owner_role, stationExceptionDetail.owner_team_id].filter(Boolean).join(' / ') || '--' },
            { label: 'SLA', value: stationExceptionDetail.severity },
            { label: 'Linked Task', value: stationExceptionDetail.linked_task_label || stationExceptionDetail.linked_task_id || '--' }
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 8 }}>
        <TaskQueueCard
          title="阻断任务与恢复动作"
          items={[
            {
              id: `${stationExceptionDetail.exception_id}-task`,
              title: stationExceptionDetail.linked_task_label || stationExceptionDetail.linked_task_id || '未挂接任务',
              description: stationExceptionDetail.blocker_flag ? '当前异常阻断主链推进' : '当前异常仅需跟进',
              meta: stationExceptionDetail.required_gate || '待补充门槛规则',
              status: stationExceptionDetail.exception_status,
              actions: [{ label: '打开任务中心', to: '/station/tasks', variant: 'outlined' }]
            },
            {
              id: `${stationExceptionDetail.exception_id}-recovery`,
              title: stationExceptionDetail.recovery_action || stationExceptionDetail.action_taken || '待补充恢复动作',
              description: stationExceptionDetail.root_cause || '请补齐异常原因与恢复动作。',
              meta: `放行角色 ${gatePolicy?.releaseRole || stationExceptionDetail.owner_role}`,
              status: stationExceptionDetail.exception_status,
              actions: [{ label: '打开关联对象', to: objectTo, variant: 'outlined' }]
            }
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="关联文件">
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {(stationExceptionDetail.related_files || []).map((entry) => (
              <Button key={entry.document_id} component={RouterLink} to="/station/documents" size="small" variant="outlined">
                {entry.label}
              </Button>
            ))}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <DocumentStatusCard title="命中的门槛" items={gateItems} />
      </Grid>

      <Grid size={12}>
        <ObjectAuditTrail events={objectAuditEvents} transitions={objectAuditTransitions} title="异常对象审计" />
      </Grid>
    </Grid>
  );
}
