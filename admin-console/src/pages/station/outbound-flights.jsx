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
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { manifestSummary, outboundFlights } from 'data/sinoport';

export default function StationOutboundFlightsPage() {
  const metrics = [
    { title: '待飞走航班', value: `${outboundFlights.length}`, helper: '当前在本站处理的出港航班', chip: 'Flights', color: 'primary' },
    { title: 'Manifest 版本', value: manifestSummary.version, helper: manifestSummary.exchange, chip: 'Manifest', color: 'secondary' },
    { title: '出港货物数量', value: manifestSummary.outboundCount, helper: '来自航班级装载汇总', chip: 'Cargo', color: 'success' }
  ];

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Outbound / Flights"
          title="出港管理 / 航班管理"
          description="按航班管理预报、收货、装载、飞走与 Manifest 归档，并为文件放行、任务分派和对象回连提供统一入口。"
          chips={['Forecast', 'Receipt', 'Loading', 'Manifest', 'Task Entry', 'Gate Control']}
        />
      </Grid>

      {metrics.map((item) => (
        <Grid key={item.title} size={{ xs: 12, md: 4 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={12}>
        <MainCard title="出港航班操作台">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ETD</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>当前阶段</TableCell>
                <TableCell>Manifest</TableCell>
                <TableCell>货量</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.etd}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell>{item.stage}</TableCell>
                  <TableCell>{item.manifest}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="outlined" component={RouterLink} to="/station/documents">
                        单证
                      </Button>
                      <Button size="small" variant="outlined" component={RouterLink} to="/station/tasks">
                        任务
                      </Button>
                      <Button size="small" variant="outlined" component={RouterLink} to="/station/shipments">
                        链路
                      </Button>
                      <Button size="small" variant="contained">
                        飞走
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
