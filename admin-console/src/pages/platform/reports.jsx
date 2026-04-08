import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import { platformDailyReportRows, platformReportCards, platformStationReportRows } from 'data/sinoport-adapters';

export default function PlatformReportsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Platform Reports"
          title="平台级报表"
          description="展示平台层 KPI、链路 SLA、接口稳定性、异常分布和站点准备度。"
          chips={['Platform KPI', 'Lane SLA', 'Integration Stability', 'Station Readiness']}
          action={
            <Button component={RouterLink} to="/platform/reports/stations" variant="outlined">
              站点对比
            </Button>
          }
        />
      </Grid>
      {platformReportCards.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}
      <Grid size={12}>
        <MainCard title="站点准备度摘要">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>站点</TableCell>
                <TableCell>控制层级</TableCell>
                <TableCell>Inbound SLA</TableCell>
                <TableCell>POD 闭环率</TableCell>
                <TableCell>异常时长</TableCell>
                <TableCell>准备度</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platformStationReportRows.map((item) => (
                <TableRow key={item.code} hover>
                  <TableCell>{item.station}</TableCell>
                  <TableCell>{item.control}</TableCell>
                  <TableCell>{item.inboundSla}</TableCell>
                  <TableCell>{item.podClosure}</TableCell>
                  <TableCell>{item.exceptionAging}</TableCell>
                  <TableCell>{item.readiness}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="平台日报样例">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>日报区块</TableCell>
                <TableCell>指标</TableCell>
                <TableCell>当前样例</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platformDailyReportRows.map((item) => (
                <TableRow key={item.section} hover>
                  <TableCell>{item.section}</TableCell>
                  <TableCell>{item.metric}</TableCell>
                  <TableCell>{item.current}</TableCell>
                  <TableCell>{item.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
