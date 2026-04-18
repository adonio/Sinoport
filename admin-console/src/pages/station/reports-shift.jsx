import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useIntl } from 'react-intl';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { useGetStationReportsOverview } from 'api/station';
import { Link as RouterLink } from 'react-router-dom';
import { formatLocalizedMessage } from 'utils/app-i18n';

export default function StationReportsShiftPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const { shiftReportRows } = useGetStationReportsOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('班次报表')}
          title={m('班次粒度报表')}
          description={m('按班次 / 班组展示第二批主营演示链路中的日报、周报 demo。')}
          chips={[m('班次'), m('班组'), m('日报 / 周报')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/reports" variant="outlined">
                {m('返回报表总览')}
              </Button>
              <Button component={RouterLink} to="/station/dashboard" variant="outlined">
                {m('货站看板')}
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title={m('班次报表')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('班次')}</TableCell>
                <TableCell>{m('班组')}</TableCell>
                <TableCell>{m('完成数')}</TableCell>
                <TableCell>{m('装车准确率')}</TableCell>
                <TableCell>{m('POD 闭环率')}</TableCell>
                <TableCell>{m('异常时长')}</TableCell>
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
