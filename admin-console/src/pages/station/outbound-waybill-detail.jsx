import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { useGetObjectAudit, useGetOutboundWaybillDetail } from 'api/station';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import ObjectAuditTrail from 'components/sinoport/ObjectAuditTrail';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { buildStationCopilotUrl } from 'utils/copilot';

function buildGateItems(detail) {
  return detail.documents.map((item) => {
    const blocking = item.required_for_release && !['Released', 'Approved', 'Validated'].includes(item.document_status);
    return {
      gateId: item.required_for_release ? `DOC-${item.document_type}` : undefined,
      node: item.document_type,
      required: item.required_for_release ? '必须达到可放行状态' : '仅要求文件存在并留痕',
      impact: blocking ? '仍阻断收货 / 装载 / Manifest 链路' : '当前不阻断主链',
      status: item.document_status,
      blocker: blocking ? `${item.document_type} 仍未完成校验` : '',
      recovery: blocking ? '补传或批准后重试对应动作' : '',
      releaseRole: item.required_for_release ? 'document_desk / station_supervisor' : ''
    };
  });
}

export default function StationOutboundWaybillDetailPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const { awb } = useParams();
  const { outboundWaybillDetail } = useGetOutboundWaybillDetail(awb);
  const { objectAuditEvents, objectAuditTransitions } = useGetObjectAudit('AWB', awb);

  if (!outboundWaybillDetail) {
    return (
      <Grid container rowSpacing={3} columnSpacing={3}>
        <Grid size={12}>
          <PageHeader
            eyebrow={m('出港 / 提单 / 详情')}
            title={m('未找到提单')}
            description={localizeUiText(locale, `未找到提单 ${awb || ''}，请返回提单列表重新选择。`)}
            action={
              <Button component={RouterLink} to="/station/outbound/waybills" variant="contained">
                {m('返回提单列表')}
              </Button>
            }
          />
        </Grid>
      </Grid>
    );
  }

  const { awb: awbDetail, documents, tasks, exceptions, recovery_summary: recoverySummary } = outboundWaybillDetail;
  const gateItems = buildGateItems(outboundWaybillDetail);
  const recoveryItems = [
    {
      gateId: 'OUTBOUND-AWB-RECOVERY',
      node: '出港恢复摘要',
      required: '先解除阻断异常，再推进出港动作',
      impact:
        recoverySummary.gate_status === 'blocked'
          ? '当前提单仍阻断出港动作链'
          : recoverySummary.gate_status === 'completed'
            ? '当前提单的出港动作链已完成'
            : '当前提单可继续推进出港动作',
      status: recoverySummary.gate_status,
      blocker: recoverySummary.blocker_reasons.join(' / '),
      recovery: recoverySummary.recovery_actions.join(' / '),
      releaseRole: 'station_supervisor / document_desk'
    }
  ];

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('出港 / 提单 / 详情')}
          title={`${m('提单详情')} / ${awbDetail.awb_no}`}
          description={m('出港提单详情页直接读取真实 AWB、Document、Task、Exception 与对象审计。')}
          chips={[awbDetail.flight_no, awbDetail.destination_code, localizeUiText(locale, awbDetail.loading_status)]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to={`/station/shipments/${encodeURIComponent(`out-${awbDetail.awb_no}`)}`} variant="outlined">
                {m('履约链路')}
              </Button>
              <Button component={RouterLink} to={buildStationCopilotUrl('AWB', awbDetail.awb_no)} variant="outlined">
                {m('Copilot')}
              </Button>
              <Button component={RouterLink} to="/station/outbound/waybills" variant="outlined">
                {m('返回提单列表')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('预报')}
          value={localizeUiText(locale, awbDetail.forecast_status)}
          helper={awbDetail.flight_no}
          chip={m('FFM')}
          color="primary"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('收货')}
          value={localizeUiText(locale, awbDetail.receipt_status)}
          helper={awbDetail.destination_code}
          chip={m('收货')}
          color="warning"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('主单')}
          value={localizeUiText(locale, awbDetail.master_status)}
          helper={`${awbDetail.pieces} pcs / ${awbDetail.gross_weight} kg`}
          chip={m('主单')}
          color="secondary"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('装载 / Manifest')}
          value={localizeUiText(locale, awbDetail.loading_status)}
          helper={localizeUiText(locale, awbDetail.manifest_status)}
          chip={m('装载')}
          color="success"
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title={m('AWB 基础信息')}>
          <Stack sx={{ gap: 1.25 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('提单 ID')}</Typography>
              <Typography fontWeight={600}>{awbDetail.awb_id}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('履约对象 ID')}</Typography>
              <Typography fontWeight={600}>{awbDetail.shipment_id}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('目的站')}</Typography>
              <Typography fontWeight={600}>{awbDetail.destination_code}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('件重体')}</Typography>
              <Typography fontWeight={600}>
                {awbDetail.pieces} pcs / {awbDetail.gross_weight} kg
              </Typography>
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard
          title={m('任务摘要')}
          emptyText={m('当前提单没有关联任务。')}
          items={tasks.map((item) => ({
            id: item.task_id,
            title: localizeUiText(locale, item.task_type),
            description: item.task_id,
            meta: item.blocker_code ? `${m('阻断码')} ${item.blocker_code}` : m('无阻断码'),
            status: item.task_status,
            actions: [{ label: m('打开任务中心'), to: '/station/tasks', variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard
          title={m('异常摘要')}
          emptyText={m('当前提单没有开放异常。')}
          items={exceptions.map((item) => ({
            id: item.exception_id,
            title: localizeUiText(locale, item.exception_type),
            description: `${item.exception_id} · ${localizeUiText(locale, item.severity)}`,
            meta: item.blocker_flag ? m('当前阻断主链') : m('仅需跟进'),
            status: item.exception_status,
            actions: [{ label: m('打开异常中心'), to: `/station/exceptions/${item.exception_id}`, variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={12}>
        <DocumentStatusCard title={m('文件门槛摘要')} items={gateItems} />
      </Grid>

      <Grid size={12}>
        <DocumentStatusCard title={m('阻断与恢复摘要')} items={recoveryItems} />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('关联文件')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('文件类型')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
                <TableCell>{m('放行要求')}</TableCell>
                <TableCell align="right">{m('操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((item) => (
                <TableRow key={item.document_id} hover>
                  <TableCell>{localizeUiText(locale, item.document_type)}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.document_status)} />
                  </TableCell>
                  <TableCell>{item.required_for_release ? m('必须') : m('可选')}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to="/station/documents" size="small" variant="outlined">
                      {m('打开单证中心')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <ObjectAuditTrail events={objectAuditEvents} transitions={objectAuditTransitions} title={m('出港提单对象审计')} />
      </Grid>
    </Grid>
  );
}
