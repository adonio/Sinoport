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
import { platformStationZoneRows } from 'data/sinoport-adapters';
import { Link as RouterLink } from 'react-router-dom';

export default function PlatformStationsZonesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Zone Mapping"
          title="站点区位映射"
          description="平台侧查看各站点区位、类型和链路绑定关系，用于后续任务分配和放行。"
          chips={['Zone', 'Dock', 'Lane Mapping']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations" variant="outlined">
                返回站点总览
              </Button>
              <Button component={RouterLink} to="/platform/stations/devices" variant="outlined">
                设备映射
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title="区位与 Dock 映射">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>站点</TableCell>
                <TableCell>Zone</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>链路绑定</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platformStationZoneRows.map((item) => (
                <TableRow key={`${item.station}-${item.zone}`} hover>
                  <TableCell>{item.station}</TableCell>
                  <TableCell>{item.zone}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.linkedLane}</TableCell>
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
