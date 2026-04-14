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
import StatusChip from 'components/sinoport/StatusChip';
import { useGetStationResourcesOverview } from 'api/station';
import { Link as RouterLink } from 'react-router-dom';

export default function StationResourcesZonesPage() {
  const { resourceZones } = useGetStationResourcesOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Zones"
          title="区位与 Dock"
          description="查看站内 Zone / Dock 类型和状态，作为第二批放行与任务分配基线。"
          chips={['Zone', 'Dock', 'Type']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/resources" variant="outlined">
                返回资源总览
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                作业任务
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title="区位与 Dock">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Zone</TableCell>
                <TableCell>站点</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>说明</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourceZones.map((item) => (
                <TableRow key={item.zone} hover>
                  <TableCell>{item.zone}</TableCell>
                  <TableCell>{item.station}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.note}</TableCell>
                  <TableCell><StatusChip label={item.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
