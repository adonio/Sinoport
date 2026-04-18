import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { useGetStationResourcesOverview } from 'api/station';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function StationResourcesPage() {
  const intl = useIntl();
  const locale = intl.locale;
  const m = (value) => formatLocalizedMessage(intl, value);
  const { resourceDevices, resourceTeams, resourceZones } = useGetStationResourcesOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('班组 / 区位 / 设备')}
          title={m('班组 / 区位 / 设备管理')}
          description={m('资源页改为统一的后端总览接口驱动，按班组、区位、设备、车辆分页面展示。')}
          chips={[m('班组'), m('区位'), m('PDA 设备'), m('车辆')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/resources/teams" variant="outlined">
                {m('班组')}
              </Button>
              <Button component={RouterLink} to="/station/resources/zones" variant="outlined">
                {m('区位')}
              </Button>
              <Button component={RouterLink} to="/station/resources/devices" variant="outlined">
                {m('设备')}
              </Button>
              <Button component={RouterLink} to="/station/resources/vehicles" variant="outlined">
                {m('车辆')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title={m('班组')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('班组')}</TableCell>
                <TableCell>{m('班次')}</TableCell>
                <TableCell>{m('负责人')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourceTeams.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{localizeUiText(locale, item.shift)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.owner)}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.status)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title={m('区位')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('区位')}</TableCell>
                <TableCell>{m('站点')}</TableCell>
                <TableCell>{m('类型')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourceZones.map((item) => (
                <TableRow key={item.zone} hover>
                  <TableCell>{item.zone}</TableCell>
                  <TableCell>{localizeUiText(locale, item.station)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.type)}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.status)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title={m('设备')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('设备')}</TableCell>
                <TableCell>{m('站点')}</TableCell>
                <TableCell>{m('绑定角色')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourceDevices.map((item) => (
                <TableRow key={item.code} hover>
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{localizeUiText(locale, item.station)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.owner)}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.status)} />
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
