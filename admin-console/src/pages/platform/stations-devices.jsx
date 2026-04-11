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
import { platformStationDeviceRows } from 'data/sinoport-adapters';
import { Link as RouterLink } from 'react-router-dom';

export default function PlatformStationsDevicesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Device Mapping"
          title="站点设备映射"
          description="平台侧查看 PDA 和现场设备在各站点、角色和班组之间的绑定关系。"
          chips={['PDA', 'Device Owner', 'Role Mapping']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations" variant="outlined">
                返回站点总览
              </Button>
              <Button component={RouterLink} to="/platform/master-data/relationships" variant="outlined">
                对象关系
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title="设备映射">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>站点</TableCell>
                <TableCell>设备</TableCell>
                <TableCell>绑定角色</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platformStationDeviceRows.map((item) => (
                <TableRow key={`${item.station}-${item.device}`} hover>
                  <TableCell>{item.station}</TableCell>
                  <TableCell>{item.device}</TableCell>
                  <TableCell>{item.role}</TableCell>
                  <TableCell>{item.owner}</TableCell>
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
