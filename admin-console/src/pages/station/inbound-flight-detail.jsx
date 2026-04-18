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

import { useGetInboundFlightDetail, useGetObjectAudit } from 'api/station';
import MainCard from 'components/MainCard';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MetricCard from 'components/sinoport/MetricCard';
import ObjectAuditTrail from 'components/sinoport/ObjectAuditTrail';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { buildStationCopilotUrl } from 'utils/copilot';

function formatTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function buildGateItems(detail, localize) {
  return detail.document_summary.map((item) => {
    const blocking = item.required_for_release && !['Released', 'Approved', 'Validated'].includes(item.document_status);
    return {
      gateId: item.required_for_release ? `DOC-${item.document_type}` : undefined,
      node: item.document_type,
      required: item.required_for_release ? 'Must be Released / Approved / Validated' : 'Upload and retain audit trace only',
      impact: blocking ? 'Currently blocks the release lane' : 'Does not block the main flow',
      status: item.document_status,
      blocker: blocking ? `${localize(item.document_type)} has not reached release status` : '',
      recovery: blocking ? 'Re-upload, validate, or approve before proceeding to downstream tasks' : '',
      releaseRole: item.required_for_release ? 'document_desk / station_supervisor' : ''
    };
  });
}

export default function StationInboundFlightDetailPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const { flightNo } = useParams();
  const { inboundFlightDetail } = useGetInboundFlightDetail(flightNo);
  const { objectAuditEvents, objectAuditTransitions } = useGetObjectAudit('Flight', flightNo);

  if (!inboundFlightDetail) {
    return (
      <Grid container rowSpacing={3} columnSpacing={3}>
        <Grid size={12}>
          <PageHeader
            eyebrow={m('进港 / 航班 / 详情')}
            title={m('未找到航班')}
            description={m(`未找到航班 ${flightNo || ''}，请返回进港航班列表重新选择。`)}
            action={
              <Button component={RouterLink} to="/station/inbound/flights" variant="contained">
                {m('返回航班列表')}
              </Button>
            }
          />
        </Grid>
      </Grid>
    );
  }

  const { flight, kpis, waybill_summary: waybills, task_summary: tasks, exception_summary: exceptions } = inboundFlightDetail;
  const gateItems = buildGateItems(inboundFlightDetail, (value) => localizeUiText(locale, value));

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('进港 / 航班 / 详情')}
          title={`${m('航班详情')} / ${flight.flight_no}`}
          description={m('航班详情页直接读取真实 Flight、AWB、Task、Document、Exception 链，不再使用本地编排状态。')}
          chips={[
            `${flight.origin_code} → ${flight.destination_code}`,
            `ETA ${formatTime(flight.eta)}`,
            `${m('状态')} ${localizeUiText(locale, flight.runtime_status)}`,
            `${m('优先级')} ${localizeUiText(locale, flight.service_level || '--')}`
          ]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                {m('单证中心')}
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                {m('任务中心')}
              </Button>
              <Button component={RouterLink} to={buildStationCopilotUrl('Flight', flight.flight_no)} variant="outlined">
                {m('Copilot')}
              </Button>
              <Button component={RouterLink} to="/station/inbound/flights" variant="outlined">
                {m('返回航班列表')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('提单总数')}
          value={`${kpis.total_awb_count}`}
          helper={`${kpis.total_pieces} pcs / ${kpis.total_weight} kg`}
          chip={m('提单')}
          color="primary"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('开放任务')}
          value={`${kpis.open_task_count}`}
          helper={`${m('已完成')} ${kpis.completed_task_count}`}
          chip={m('任务')}
          color="secondary"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('开放异常')}
          value={`${kpis.open_exception_count}`}
          helper={m('航班链路上的阻断项')}
          chip={m('异常')}
          color="warning"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('实际落地')}
          value={formatTime(flight.actual_landed_at)}
          helper={`ETA ${formatTime(flight.eta)}`}
          chip={m('运行态')}
          color="success"
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title={m('航班基础信息')}>
          <Stack sx={{ gap: 1.25 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('航班 ID')}</Typography>
              <Typography fontWeight={600}>{flight.flight_id}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('航班号')}</Typography>
              <Typography fontWeight={600}>{flight.flight_no}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('航班日期')}</Typography>
              <Typography fontWeight={600}>{flight.flight_date}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('当前状态')}</Typography>
              <StatusChip label={localizeUiText(locale, flight.runtime_status)} />
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard
          title={m('任务摘要')}
          emptyText={m('当前航班还没有任务。')}
          items={tasks.map((item) => ({
            id: item.task_id,
            title: localizeUiText(locale, item.task_type),
            description: item.assigned_team_id ? `${m('班组')} ${item.assigned_team_id}` : m('待分派'),
            meta: item.task_id,
            status: item.task_status,
            actions: [{ label: m('打开任务中心'), to: '/station/tasks', variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard
          title={m('异常摘要')}
          emptyText={m('当前航班没有开放异常。')}
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
        <MainCard title={m('提单状态')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('提单')}</TableCell>
                <TableCell>{m('当前节点')}</TableCell>
                <TableCell>NOA</TableCell>
                <TableCell>POD</TableCell>
                <TableCell align="right">{m('操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {waybills.map((item) => (
                <TableRow key={item.awb_id} hover>
                  <TableCell>{item.awb_no}</TableCell>
                  <TableCell>{localizeUiText(locale, item.current_node)}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.noa_status)} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.pod_status)} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      component={RouterLink}
                      to={`/station/inbound/waybills/${encodeURIComponent(item.awb_no)}`}
                      size="small"
                      variant="outlined"
                    >
                      {m('查看提单')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <ObjectAuditTrail events={objectAuditEvents} transitions={objectAuditTransitions} title={m('航班对象审计')} />
      </Grid>
    </Grid>
  );
}
