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

export default function StationResourcesZonesPage() {
  const intl = useIntl();
  const locale = intl.locale;
  const m = (value) => formatLocalizedMessage(intl, value);
  const { resourceZones } = useGetStationResourcesOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('区位')}
          title={m('区位与月台')}
          description={m('查看站内区位 / 月台类型和状态，作为第二批放行与任务分配基线。')}
          chips={[m('区位'), m('月台'), m('类型')]}
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
        <MainCard title={m('区位与月台')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('区位')}</TableCell>
                <TableCell>{m('站点')}</TableCell>
                <TableCell>{m('类型')}</TableCell>
                <TableCell>{m('说明')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourceZones.map((item) => (
                <TableRow key={item.zone} hover>
                  <TableCell>{item.zone}</TableCell>
                  <TableCell>{localizeUiText(locale, item.station)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.type)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.note)}</TableCell>
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
