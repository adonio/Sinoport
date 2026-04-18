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

export default function StationResourcesTeamsPage() {
  const intl = useIntl();
  const locale = intl.locale;
  const m = (value) => formatLocalizedMessage(intl, value);
  const { resourceTeams } = useGetStationResourcesOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('班组映射')}
          title={m('班组与人员')}
          description={m('改为由站点资源总览 API 驱动，直接展示班组、班次、负责人和状态。')}
          chips={[m('班组映射'), m('人员'), m('班次')]}
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
        <MainCard title={m('班组与人员')}>
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
    </Grid>
  );
}
