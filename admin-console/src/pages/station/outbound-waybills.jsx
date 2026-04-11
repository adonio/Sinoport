import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { outboundWaybillRows } from 'data/sinoport';

export default function StationOutboundWaybillsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Outbound / Waybills"
          title="出港管理 / 提单管理"
          description="按提单维度管理出港货物，查看预报、收货、主单、装载和 Manifest 状态，并逐票执行操作。"
          chips={['AWB', 'MAWB', 'UWS', 'Manifest']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/outbound/flights" variant="outlined">
                航班管理
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证中心
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                作业任务
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title="出港提单台账">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>AWB</TableCell>
                <TableCell>所属航班</TableCell>
                <TableCell>目的站</TableCell>
                <TableCell>预报</TableCell>
                <TableCell>收货</TableCell>
                <TableCell>主单</TableCell>
                <TableCell>装载</TableCell>
                <TableCell>Manifest</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outboundWaybillRows.map((item) => (
                <TableRow key={item.awb} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.destination}</TableCell>
                  <TableCell>
                    <StatusChip label={item.forecast} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.receipt} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.master} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.loading} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.manifest} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button component={RouterLink} to={`/station/outbound/waybills/${encodeURIComponent(item.awb)}`} size="small" variant="outlined">
                        查看
                      </Button>
                      <Button component={RouterLink} to={`/station/shipments/${encodeURIComponent(`out-${item.awb}`)}`} size="small" variant="outlined">
                        履约链路
                      </Button>
                      <Button component={RouterLink} to="/station/documents" size="small" variant="outlined">
                        单证
                      </Button>
                      <Button component={RouterLink} to="/station/tasks" size="small" variant="contained">
                        任务
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
