import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { resourceZones } from 'data/sinoport-adapters';

export default function StationResourcesZonesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader eyebrow="Zones" title="区位与 Dock" description="查看站内 Zone / Dock 类型和状态，作为第二批放行与任务分配基线。" chips={['Zone', 'Dock', 'Type']} />
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
