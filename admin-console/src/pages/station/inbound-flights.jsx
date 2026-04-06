import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import ProgressMetricCard from 'components/sinoport/ProgressMetricCard';
import StatusChip from 'components/sinoport/StatusChip';
import { inboundCargoLifecycle, inboundFlights } from 'data/sinoport';

export default function StationInboundFlightsPage() {
  const lifecycleColors = ['primary', 'secondary', 'info', 'warning', 'success', 'error'];
  const totalCount = inboundCargoLifecycle[0]?.count || 0;
  const displayLifecycle = inboundCargoLifecycle.filter((item) => item.label !== '已交付');

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Inbound / Flights"
          title="进港管理 / 航班管理"
          description="按航班管理进港作业，逐航班推进落地、卸机、入货站、理货、NOA、交付和二次转运等动作。"
          chips={['Flight Level Ops', 'Per-Flight Actions', 'Inbound Workflow']}
        />
      </Grid>

      {displayLifecycle.map((item, index) => {
        const progress = Math.max(15, 100 - index * 12);

        return (
          <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
            <ProgressMetricCard
              title={item.label}
              value={`${item.count} / ${totalCount} 票`}
              helper={item.note}
              chip={`阶段 ${index + 1}`}
              color={lifecycleColors[index] || 'primary'}
              progress={progress}
            />
          </Grid>
        );
      })}

      <Grid size={12}>
        <MainCard title="进港航班操作台">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ETA</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>当前节点</TableCell>
                <TableCell>优先级</TableCell>
                <TableCell>货量</TableCell>
                <TableCell align="right">操作</TableCell>
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
                  <TableCell>{item.priority}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="outlined">
                        查看
                      </Button>
                      <Button size="small" variant="outlined">
                        理货
                      </Button>
                      <Button size="small" variant="outlined">
                        NOA
                      </Button>
                      <Button size="small" variant="contained">
                        交付
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
