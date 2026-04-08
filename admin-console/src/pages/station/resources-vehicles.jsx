import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { stationVehicleRows } from 'data/sinoport-adapters';

export default function StationResourcesVehiclesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader eyebrow="Vehicles" title="车辆与 Collection Note" description="按 Trip / Truck / Driver / Collection Note 展示尾程与头程车辆占位视图。" chips={['Truck', 'Driver', 'Collection Note']} />
      </Grid>
      <Grid size={12}>
        <MainCard title="车辆占位视图">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Trip</TableCell>
                <TableCell>车牌</TableCell>
                <TableCell>司机</TableCell>
                <TableCell>Collection Note</TableCell>
                <TableCell>阶段</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationVehicleRows.map((item) => (
                <TableRow key={item.tripId} hover>
                  <TableCell>{item.tripId}</TableCell>
                  <TableCell>{item.plate}</TableCell>
                  <TableCell>{item.driver}</TableCell>
                  <TableCell>{item.collectionNote}</TableCell>
                  <TableCell>{item.stage}</TableCell>
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
