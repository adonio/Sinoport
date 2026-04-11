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

import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { inboundFlights, inboundFlightWaybillDetails } from 'data/sinoport';
import { inboundDocumentGates } from 'data/sinoport-adapters';

function buildSummary(waybills) {
  return {
    total: waybills.length,
    noaPending: waybills.filter((item) => item.noaStatus === '待处理').length,
    podPending: waybills.filter((item) => item.podStatus === '待处理').length,
    inProgress: waybills.filter((item) => !['已交付', '已签收', 'POD 已签收'].includes(item.currentNode)).length
  };
}

export default function StationInboundFlightDetailPage() {
  const { flightNo } = useParams();
  const flight = inboundFlights.find((item) => item.flightNo === flightNo);
  const waybills = (flightNo && inboundFlightWaybillDetails[flightNo]) || [];

  if (!flight) {
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

  const summary = buildSummary(waybills);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="进港 / 航班 / 详情"
          title={`航班详情 / ${flight.flightNo}`}
          description={`查看航班 ${flight.flightNo} 的基础信息，以及该航班下所有提单、任务、文件门槛、NOA、POD 和转运状态。`}
          chips={[`来源：${flight.source}`, `ETA ${flight.eta}`, `ETD ${flight.etd}`, `优先级 ${flight.priority}`]}
          action={
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button component={RouterLink} to="/station/inbound/flights/new" variant="contained">
                新建航班
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证中心
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                任务中心
              </Button>
              <Button component={RouterLink} to="/station/inbound/flights" variant="outlined">
                返回航班列表
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="航班状态" value={flight.status} helper={`当前节点：${flight.step}`} chip="航班" color="primary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="提单总数" value={`${summary.total} 票`} helper={flight.cargo} chip="提单" color="secondary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="待发送 NOA" value={`${summary.noaPending} 票`} helper="尚未完成到货通知发送" chip="NOA" color="warning" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="待补 POD" value={`${summary.podPending} 票`} helper="签收文件仍待回传或归档" chip="POD" color="error" />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title="航班基础信息">
          <Stack sx={{ gap: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">航班号</Typography>
              <Typography fontWeight={600}>{flight.flightNo}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">来源</Typography>
              <Typography fontWeight={600}>{flight.source}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">ETA</Typography>
              <Typography fontWeight={600}>{flight.eta}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">ETD</Typography>
              <Typography fontWeight={600}>{flight.etd}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">优先级</Typography>
              <Typography fontWeight={600}>{flight.priority}</Typography>
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <DocumentStatusCard title="当前文件门槛" items={inboundDocumentGates} />
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <MainCard title="提单状态总览">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>AWB</TableCell>
                <TableCell>收货方</TableCell>
                <TableCell>件数</TableCell>
                <TableCell>重量</TableCell>
                <TableCell>当前节点</TableCell>
                <TableCell>NOA</TableCell>
                <TableCell>POD</TableCell>
                <TableCell>转运状态</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {waybills.map((item) => (
                <TableRow key={item.awb} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.consignee}</TableCell>
                  <TableCell>{item.pieces}</TableCell>
                  <TableCell>{item.weight}</TableCell>
                  <TableCell>{item.currentNode}</TableCell>
                  <TableCell>
                    <StatusChip label={item.noaStatus} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.podStatus} />
                  </TableCell>
                  <TableCell>{item.transferStatus}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button component={RouterLink} to={`/station/shipments/${encodeURIComponent(`in-${item.awb}`)}`} size="small" variant="outlined">
                        履约链路
                      </Button>
                      <Button component={RouterLink} to="/station/documents/noa" size="small" variant="outlined">
                        NOA
                      </Button>
                      <Button component={RouterLink} to="/station/tasks" size="small" variant="outlined">
                        任务
                      </Button>
                      <Button component={RouterLink} to="/station/exceptions" size="small" variant="outlined">
                        异常
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
