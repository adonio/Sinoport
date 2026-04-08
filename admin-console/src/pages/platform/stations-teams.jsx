import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { platformStationTeamRows } from 'data/sinoport-adapters';

export default function PlatformStationsTeamsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader eyebrow="Team Mapping" title="站点班组映射" description="平台侧查看各站点班组、班次、工人数和链路映射关系。" chips={['Team Mapping', 'Workers', 'Shift']} />
      </Grid>
      <Grid size={12}>
        <MainCard title="站点班组映射">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>站点</TableCell>
                <TableCell>班组</TableCell>
                <TableCell>班次</TableCell>
                <TableCell>人数</TableCell>
                <TableCell>链路</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platformStationTeamRows.map((item) => (
                <TableRow key={`${item.station}-${item.team}`} hover>
                  <TableCell>{item.station}</TableCell>
                  <TableCell>{item.team}</TableCell>
                  <TableCell>{item.shift}</TableCell>
                  <TableCell>{item.workers}</TableCell>
                  <TableCell>{item.mappedLanes}</TableCell>
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
