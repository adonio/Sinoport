import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import { useGetPlatformAuditLogs } from 'api/platform';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { Link as RouterLink } from 'react-router-dom';
import { useIntl } from 'react-intl';

export default function PlatformAuditEventsPage() {
  const { auditLogs } = useGetPlatformAuditLogs();
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Audit Events"
          title={formatLocalizedMessage(intl, '审计事件明细')}
          description={formatLocalizedMessage(intl, '查看对象回溯、变更前后值、文件导入和状态回退等细粒度事件。')}
          chips={['Before/After', 'File Import', 'Rollback']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/audit" variant="outlined">
                {formatLocalizedMessage(intl, '返回审计总览')}
              </Button>
              <Button component={RouterLink} to="/platform/master-data/jobs" variant="outlined">
                {formatLocalizedMessage(intl, '导入任务')}
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '审计事件')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '时间')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '动作')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '对象')}</TableCell>
                <TableCell>{localizeUiText(intl.locale, 'Before')}</TableCell>
                <TableCell>{localizeUiText(intl.locale, 'After')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '状态')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditLogs.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.time}</TableCell>
                  <TableCell>{l(item.action)}</TableCell>
                  <TableCell>{l(item.object)}</TableCell>
                  <TableCell>{l(item.before)}</TableCell>
                  <TableCell>{l(item.after)}</TableCell>
                  <TableCell><StatusChip label={localizeUiText(intl.locale, item.result)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
