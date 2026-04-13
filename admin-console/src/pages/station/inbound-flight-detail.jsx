import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { useGetInboundFlightDetail, useGetObjectAudit } from 'api/station';
import MainCard from 'components/MainCard';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MetricCard from 'components/sinoport/MetricCard';
import ObjectAuditTrail from 'components/sinoport/ObjectAuditTrail';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { buildStationCopilotUrl } from 'utils/copilot';

function formatTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function buildGateItems(detail) {
  return detail.document_summary.map((item) => {
    const blocking = item.required_for_release && !['Released', 'Approved', 'Validated'].includes(item.document_status);
    return {
      gateId: item.required_for_release ? `DOC-${item.document_type}` : undefined,
      node: item.document_type,
      required: item.required_for_release ? '必须为 Released / Approved / Validated' : '仅要求上传并留痕',
      impact: blocking ? '当前仍阻断放行链路' : '当前不会阻断主链',
      status: item.document_status,
      blocker: blocking ? `${item.document_type} 仍未达到放行状态` : '',
      recovery: blocking ? '补传、校验或批准后再推进后续任务' : '',
      releaseRole: item.required_for_release ? 'document_desk / station_supervisor' : ''
    };
  });
}

export default function StationInboundFlightDetailPage() {
  const { flightNo } = useParams();
  const { inboundFlightDetail } = useGetInboundFlightDetail(flightNo);
  const { objectAuditEvents, objectAuditTransitions } = useGetObjectAudit('Flight', flightNo);

  if (!inboundFlightDetail) {
    return (
      <Grid container rowSpacing={3} columnSpacing={3}>
        <Grid size={12}>
          <PageHeader
            eyebrow="Inbound / Flights / Detail"
            title="未找到航班"
            description={`未找到航班 ${flightNo || ''}，请返回进港航班列表重新选择。`}
            action={
              <Button component={RouterLink} to="/station/inbound/flights" variant="contained">
                返回航班列表
              </Button>
            }
          />
        </Grid>
      </Grid>
    );
  }

  const { flight, kpis, waybill_summary: waybills, task_summary: tasks, exception_summary: exceptions } = inboundFlightDetail;
  const gateItems = buildGateItems(inboundFlightDetail);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="进港 / 航班 / 详情"
          title={`航班详情 / ${flight.flight_no}`}
          description="航班详情页直接读取真实 Flight、AWB、Task、Document、Exception 链，不再使用本地编排状态。"
          chips={[
            `${flight.origin_code} → ${flight.destination_code}`,
            `ETA ${formatTime(flight.eta)}`,
            `状态 ${flight.runtime_status}`,
            `优先级 ${flight.service_level || '--'}`
          ]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证中心
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                任务中心
              </Button>
              <Button component={RouterLink} to={buildStationCopilotUrl('Flight', flight.flight_no)} variant="outlined">
                Copilot
              </Button>
              <Button component={RouterLink} to="/station/inbound/flights" variant="outlined">
                返回航班列表
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="提单总数" value={`${kpis.total_awb_count}`} helper={`${kpis.total_pieces} pcs / ${kpis.total_weight} kg`} chip="AWB" color="primary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="开放任务" value={`${kpis.open_task_count}`} helper={`已完成 ${kpis.completed_task_count}`} chip="Tasks" color="secondary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="开放异常" value={`${kpis.open_exception_count}`} helper="Flight 链路上的阻断项" chip="Exceptions" color="warning" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="实际落地" value={formatTime(flight.actual_landed_at)} helper={`ETA ${formatTime(flight.eta)}`} chip="Runtime" color="success" />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title="航班基础信息">
          <Stack sx={{ gap: 1.25 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">Flight ID</Typography>
              <Typography fontWeight={600}>{flight.flight_id}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">航班号</Typography>
              <Typography fontWeight={600}>{flight.flight_no}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">航班日期</Typography>
              <Typography fontWeight={600}>{flight.flight_date}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">当前状态</Typography>
              <StatusChip label={flight.runtime_status} />
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard
          title="任务摘要"
          emptyText="当前航班还没有任务。"
          items={tasks.map((item) => ({
            id: item.task_id,
            title: item.task_type,
            description: item.assigned_team_id ? `班组 ${item.assigned_team_id}` : '待分派',
            meta: item.task_id,
            status: item.task_status,
            actions: [{ label: '打开任务中心', to: '/station/tasks', variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard
          title="异常摘要"
          emptyText="当前航班没有开放异常。"
          items={exceptions.map((item) => ({
            id: item.exception_id,
            title: item.exception_type,
            description: `${item.exception_id} · ${item.severity}`,
            meta: item.blocker_flag ? '当前阻断主链' : '仅需跟进',
            status: item.exception_status,
            actions: [{ label: '打开异常中心', to: `/station/exceptions/${item.exception_id}`, variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={12}>
        <DocumentStatusCard title="文件门槛摘要" items={gateItems} />
      </Grid>

      <Grid size={12}>
        <MainCard title="提单状态">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>提单</TableCell>
                <TableCell>当前节点</TableCell>
                <TableCell>NOA</TableCell>
                <TableCell>POD</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {waybills.map((item) => (
                <TableRow key={item.awb_id} hover>
                  <TableCell>{item.awb_no}</TableCell>
                  <TableCell>{item.current_node}</TableCell>
                  <TableCell>
                    <StatusChip label={item.noa_status} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.pod_status} />
                  </TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to={`/station/inbound/waybills/${encodeURIComponent(item.awb_no)}`} size="small" variant="outlined">
                      查看提单
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <ObjectAuditTrail events={objectAuditEvents} transitions={objectAuditTransitions} title="航班对象审计" />
      </Grid>
    </Grid>
  );
}
