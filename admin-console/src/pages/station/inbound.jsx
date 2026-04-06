import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { inboundCargoLifecycle, inboundFlights, noaQueue, transferRecords } from 'data/sinoport';

export default function StationInboundPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Inbound Ops"
          title="进港管理"
          description="覆盖进港航班维护、货物理货、NOA 发送、二次转运和交付闭环，重点围绕货物状态机执行。"
          chips={['Flight Board', 'Cargo Status', 'NOA Queue', 'Transfer Records', 'POD Closure']}
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
        <MainCard title="货物状态流">
          <Stack sx={{ gap: 2 }}>
            {inboundCargoLifecycle.map((item, index) => {
              const progress = Math.max(15, 100 - index * 12);
              return (
                <Stack key={item.label} sx={{ gap: 0.75 }}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2">{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.count} 票
                    </Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={progress} />
                  <Typography variant="caption" color="text.secondary">
                    {item.note}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="NOA 待发送列表">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>AWB</TableCell>
                <TableCell>收货方</TableCell>
                <TableCell>渠道</TableCell>
                <TableCell>目标时间</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {noaQueue.map((item) => (
                <TableRow key={item.awb} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.consignee}</TableCell>
                  <TableCell>{item.channel}</TableCell>
                  <TableCell>{item.eta}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
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
              {transferRecords.map((item) => (
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
