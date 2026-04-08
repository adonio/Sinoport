import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { shiftReportRows } from 'data/sinoport-adapters';

export default function StationReportsShiftPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader eyebrow="Shift Reports" title="班次粒度报表" description="按班次 / 班组展示第二批主营演示链路中的日报、周报 demo。" chips={['Shift', 'Team', 'Daily/Weekly']} />
      </Grid>
      <Grid size={12}>
        <MainCard title="班次报表">
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
    </Grid>
  );
}
