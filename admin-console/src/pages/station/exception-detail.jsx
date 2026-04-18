import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { useIntl } from 'react-intl';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { resolveStationException, useGetObjectAudit, useGetStationExceptionDetail } from 'api/station';
import { openSnackbar } from 'api/snackbar';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MainCard from 'components/MainCard';
import ObjectAuditTrail from 'components/sinoport/ObjectAuditTrail';
import ObjectSummaryCard from 'components/sinoport/ObjectSummaryCard';
import PageHeader from 'components/sinoport/PageHeader';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
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
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
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
        message: `${stationExceptionDetail.exception_id} ${m('已恢复')}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || m('异常恢复失败'),
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
            eyebrow={m('异常详情')}
            title={m('未找到异常')}
            description={m(`未找到异常 ${exceptionId || ''}，请返回异常中心重新选择。`)}
            action={
              <Button component={RouterLink} to="/station/exceptions" variant="contained">
                {m('返回异常中心')}
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
          eyebrow={m('异常详情')}
          title={`${m('异常详情')} / ${stationExceptionDetail.exception_id}`}
          description={m('异常详情页直接读取真实 Exception 对象、关联文件、阻断任务与对象审计。')}
          chips={[
            localizeUiText(locale, stationExceptionDetail.exception_type),
            localizeUiText(locale, stationExceptionDetail.related_object_label),
            localizeUiText(locale, stationExceptionDetail.severity)
          ]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to={objectTo} variant="outlined">
                {m('关联对象')}
              </Button>
              <Button
                component={RouterLink}
                to={buildStationCopilotUrl('Exception', stationExceptionDetail.exception_id)}
                variant="outlined"
              >
                {m('Copilot')}
              </Button>
              <Button
                component={RouterLink}
                to={stationExceptionDetail.linked_task_id ? '/station/tasks' : '/station/documents'}
                variant="outlined"
              >
                {m('当前动作')}
              </Button>
              <Button variant="contained" onClick={handleResolve}>
                {m('恢复异常')}
              </Button>
              <Button component={RouterLink} to="/station/exceptions" variant="outlined">
                {m('返回异常中心')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <ObjectSummaryCard
          title={m('异常摘要')}
          subtitle={m('当前异常对象与阻断信息均来自真实后端。')}
          status={stationExceptionDetail.exception_status}
          rows={[
            { label: m('异常类型'), value: localizeUiText(locale, stationExceptionDetail.exception_type) },
            { label: m('关联对象'), value: localizeUiText(locale, stationExceptionDetail.related_object_label) },
            {
              label: m('负责人'),
              value:
                [localizeUiText(locale, stationExceptionDetail.owner_role), stationExceptionDetail.owner_team_id]
                  .filter(Boolean)
                  .join(' / ') || '--'
            },
            { label: m('SLA'), value: localizeUiText(locale, stationExceptionDetail.severity) },
            {
              label: m('关联任务'),
              value: localizeUiText(locale, stationExceptionDetail.linked_task_label || stationExceptionDetail.linked_task_id || '--')
            }
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 8 }}>
        <TaskQueueCard
          title={m('阻断任务与恢复动作')}
          items={[
            {
              id: `${stationExceptionDetail.exception_id}-task`,
              title: localizeUiText(
                locale,
                stationExceptionDetail.linked_task_label || stationExceptionDetail.linked_task_id || m('未挂接任务')
              ),
              description: stationExceptionDetail.blocker_flag ? m('当前异常阻断主链推进') : m('当前异常仅需跟进'),
              meta: localizeUiText(locale, stationExceptionDetail.required_gate || m('待补充门槛规则')),
              status: stationExceptionDetail.exception_status,
              actions: [{ label: m('打开任务中心'), to: '/station/tasks', variant: 'outlined' }]
            },
            {
              id: `${stationExceptionDetail.exception_id}-recovery`,
              title: localizeUiText(
                locale,
                stationExceptionDetail.recovery_action || stationExceptionDetail.action_taken || m('待补充恢复动作')
              ),
              description: localizeUiText(locale, stationExceptionDetail.root_cause || m('请补齐异常原因与恢复动作。')),
              meta: `${m('放行角色')} ${localizeUiText(locale, gatePolicy?.releaseRole || stationExceptionDetail.owner_role)}`,
              status: stationExceptionDetail.exception_status,
              actions: [{ label: m('打开关联对象'), to: objectTo, variant: 'outlined' }]
            }
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={m('关联文件')}>
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
        <DocumentStatusCard title={m('命中的门槛')} items={gateItems} />
      </Grid>

      <Grid size={12}>
        <ObjectAuditTrail events={objectAuditEvents} transitions={objectAuditTransitions} title={m('异常对象审计')} />
      </Grid>
    </Grid>
  );
}
