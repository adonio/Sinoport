import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Stack from '@mui/material/Stack';
import { Link as RouterLink } from 'react-router-dom';

import BlockingReasonAlert from 'components/sinoport/BlockingReasonAlert';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import LifecycleStepList from 'components/sinoport/LifecycleStepList';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { useGetStationInboundOverview } from 'api/station';

export default function StationInboundPage() {
  const {
    inboundDocumentGates,
    inboundFlights,
    inboundLifecycleRows,
    stationBlockerQueue,
    stationReviewQueue,
    stationTransferRows
  } = useGetStationInboundOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Inbound Ops"
          title="进港管理"
          description="覆盖进港航班、地面履约状态、节点任务、文件放行、NOA 与交付闭环，重点围绕对象与状态机执行。"
          chips={['Flight Board', 'Ground Fulfillment', 'Task Queue', 'NOA Gate', 'Transfer', 'POD Closure']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/inbound/flights" variant="outlined">
                航班管理
              </Button>
              <Button component={RouterLink} to="/station/inbound/waybills" variant="outlined">
                提单管理
              </Button>
              <Button component={RouterLink} to="/station/inbound/mobile" variant="outlined">
                PDA 作业终端
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title="进港航班看板">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ETA</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>当前节点</TableCell>
                <TableCell>货量</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.eta}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell>{item.step}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title="地面履约状态">
          <LifecycleStepList steps={inboundLifecycleRows.map((item) => ({ ...item, metric: `${item.count} 票` }))} />
        </MainCard>
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title="当前进港阻断" reasons={stationBlockerQueue.map((item) => item.title)} />
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <TaskQueueCard title="待复核 / 待发送 NOA" items={stationReviewQueue} />
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <DocumentStatusCard title="进港文件放行" items={inboundDocumentGates} />
      </Grid>

      <Grid size={12}>
        <MainCard title="二次转运记录">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>转运单号</TableCell>
                <TableCell>AWB</TableCell>
                <TableCell>目的站</TableCell>
                <TableCell>车辆</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationTransferRows.map((item) => (
                <TableRow key={item.transferId} hover>
                  <TableCell>{item.transferId}</TableCell>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.destination}</TableCell>
                  <TableCell>{`${item.plate} / ${item.driver}`}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
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
