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

export default function StationResourcesDevicesPage() {
  const { resourceDevices } = useGetStationResourcesOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Devices"
          title="PDA 设备绑定"
          description="按站点、角色和设备查看 PDA Device 绑定关系。"
          chips={['PDA', 'Device Owner', 'Role Mapping']}
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
        <MainCard title="设备绑定">
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
