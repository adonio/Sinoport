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

export default function StationResourcesTeamsPage() {
  const { resourceTeams } = useGetStationResourcesOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Team Mapping"
          title="班组与人员"
          description="改为由站点资源总览 API 驱动，直接展示班组、班次、Owner 和状态。"
          chips={['Team Mapping', 'Workers', 'Shift']}
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
        <MainCard title="班组与人员">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>班组</TableCell>
                <TableCell>班次</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourceTeams.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.shift}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
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
