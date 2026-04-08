import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import { pdaKpiRows, shiftReportRows, stationFileReportRows, stationReportCards } from 'data/sinoport-adapters';

export default function StationReportsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Reports"
          title="货站层 KPI / 报表"
          description="展示货站层 KPI 和班次报表，为第二批主演示链路提供日报 / 周报前端 demo。"
          chips={['12H Completion', 'Loading Accuracy', 'POD Closure', 'Exception Aging']}
          action={
            <Button component={RouterLink} to="/station/reports/shift" variant="outlined">
              班次报表
            </Button>
          }
        />
      </Grid>
      {stationReportCards.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}
      <Grid size={12}>
        <MainCard title="班次报表摘要">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>班次</TableCell>
                <TableCell>班组</TableCell>
                <TableCell>完成数</TableCell>
                <TableCell>装车准确率</TableCell>
                <TableCell>POD 闭环率</TableCell>
                <TableCell>异常时长</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shiftReportRows.map((item) => (
                <TableRow key={item.shift} hover>
                  <TableCell>{item.shift}</TableCell>
                  <TableCell>{item.team}</TableCell>
                  <TableCell>{item.completed}</TableCell>
                  <TableCell>{item.loadingAccuracy}</TableCell>
                  <TableCell>{item.podClosure}</TableCell>
                  <TableCell>{item.exceptionAge}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="PDA KPI 样例">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>指标</TableCell>
                <TableCell>当前值</TableCell>
                <TableCell>目标</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pdaKpiRows.map((item) => (
                <TableRow key={item.metric} hover>
                  <TableCell>{item.metric}</TableCell>
                  <TableCell>{item.current}</TableCell>
                  <TableCell>{item.target}</TableCell>
                  <TableCell>{item.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="文件报表样例">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>报表项</TableCell>
                <TableCell>对象</TableCell>
                <TableCell>当前样例</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationFileReportRows.map((item) => (
                <TableRow key={item.report} hover>
                  <TableCell>{item.report}</TableCell>
                  <TableCell>{item.object}</TableCell>
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
