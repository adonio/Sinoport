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
import { inboundWaybillRows } from 'data/sinoport';

export default function StationInboundWaybillsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Inbound / Waybills"
          title="进港管理 / 提单管理"
          description="按提单维度管理进港货物，查看每票货当前节点、NOA 与 POD 状态，并执行逐票操作。"
          chips={['AWB Level Ops', 'NOA', 'POD', 'Transfer']}
        />
      </Grid>

      <Grid size={12}>
        <MainCard title="进港提单台账">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>AWB</TableCell>
                <TableCell>所属航班</TableCell>
                <TableCell>收货方</TableCell>
                <TableCell>件数</TableCell>
                <TableCell>重量</TableCell>
                <TableCell>当前节点</TableCell>
                <TableCell>NOA</TableCell>
                <TableCell>POD</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inboundWaybillRows.map((item) => (
                <TableRow key={item.awb} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.flightNo}</TableCell>
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
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button component={RouterLink} to={`/station/shipments/${encodeURIComponent(`in-${item.awb}`)}`} size="small" variant="outlined">
                        履约链路
                      </Button>
                      <Button component={RouterLink} to="/station/tasks" size="small" variant="outlined">
                        任务
                      </Button>
                      <Button component={RouterLink} to="/station/documents/pod" size="small" variant="contained">
                        POD
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
