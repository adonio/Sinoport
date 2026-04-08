import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { resourceDevices, resourceTeams, resourceZones } from 'data/sinoport-adapters';

export default function StationResourcesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Teams / Zones / Devices"
          title="班组 / 区位 / 设备管理"
          description="第二批把资源页扩成资源总览入口，继续保持纯前端 demo，但按班组、区位、设备、车辆分页面展示。"
          chips={['Teams', 'Zones', 'PDA Devices', 'Vehicles']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/resources/teams" variant="outlined">
                班组
              </Button>
              <Button component={RouterLink} to="/station/resources/zones" variant="outlined">
                区位
              </Button>
              <Button component={RouterLink} to="/station/resources/devices" variant="outlined">
                设备
              </Button>
              <Button component={RouterLink} to="/station/resources/vehicles" variant="outlined">
                车辆
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title="班组">
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

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title="区位">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Zone</TableCell>
                <TableCell>站点</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourceZones.map((item) => (
                <TableRow key={item.zone} hover>
                  <TableCell>{item.zone}</TableCell>
                  <TableCell>{item.station}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title="设备">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>设备</TableCell>
                <TableCell>站点</TableCell>
                <TableCell>绑定角色</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourceDevices.map((item) => (
                <TableRow key={item.code} hover>
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.station}</TableCell>
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
