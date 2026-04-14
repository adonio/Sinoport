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
import { useGetPlatformReports } from 'api/platform';
import { Link as RouterLink } from 'react-router-dom';

export default function PlatformReportStationsPage() {
  const { platformStationReportRows } = useGetPlatformReports();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Comparison"
          title="站点对比报表"
          description="用于比较强控制站、协同控制站和待接入站之间的 SLA、闭环率和准备度差异。"
          chips={['URC', 'MME', 'MST', 'RZE']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/reports" variant="outlined">
                返回平台报表
              </Button>
              <Button component={RouterLink} to="/platform/stations" variant="outlined">
                站点总览
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title="站点对比">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>站点</TableCell>
                <TableCell>控制</TableCell>
                <TableCell>Inbound SLA</TableCell>
                <TableCell>POD 闭环率</TableCell>
                <TableCell>异常闭环时长</TableCell>
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
    </Grid>
  );
}
