import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useIntl } from 'react-intl';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { useGetStationResourcesOverview } from 'api/station';
import { Link as RouterLink } from 'react-router-dom';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function StationResourcesDevicesPage() {
  const intl = useIntl();
  const locale = intl.locale;
  const m = (value) => formatLocalizedMessage(intl, value);
  const { resourceDevices } = useGetStationResourcesOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('设备')}
          title={m('PDA 设备绑定')}
          description={m('按站点、角色和设备查看 PDA Device 绑定关系。')}
          chips={[m('PDA'), m('设备负责人'), m('角色映射')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/resources" variant="outlined">
                {m('返回资源总览')}
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                {m('作业任务')}
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title={m('设备绑定')}>
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
