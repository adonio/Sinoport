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
          description="按航班管理进港作业，逐航班推进落地、进港处理、理货、NOA、交付和二次转运，并为任务和文件联动提供入口。"
          chips={['Flight Level Ops', 'Per-Flight Actions', 'Inbound Workflow', 'Task Entry', 'Document Gate']}
          action={
            <Button component={RouterLink} to="/station/inbound/flights/new" variant="contained">
              新建航班
            </Button>
          }
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
                      <Button component={RouterLink} to={`/station/inbound/flights/${item.flightNo}`} size="small" variant="outlined">
                        查看
                      </Button>
                      <Button component={RouterLink} to="/station/tasks" size="small" variant="outlined">
                        任务
                      </Button>
                      <Button component={RouterLink} to="/station/documents" size="small" variant="outlined">
                        单证
                      </Button>
                      <Button component={RouterLink} to="/station/shipments" size="small" variant="contained">
                        链路
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
