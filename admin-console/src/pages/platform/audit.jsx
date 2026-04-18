import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Stack from '@mui/material/Stack';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import { useGetPlatformAuditEvents } from 'api/platform';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function PlatformAuditPage() {
  const { auditEvents } = useGetPlatformAuditEvents();
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Audit & Trust Trace"
          title={formatLocalizedMessage(intl, '审计与可信留痕')}
          description={formatLocalizedMessage(
            intl,
            '平台与货站的关键动作都应在这里可追溯，包括货站创建、规则修改、文件导入、POD 上传、状态回退和可信字段预留。'
          )}
          chips={['Event Trail', 'File Imports', 'State Changes', 'Event Hash Placeholder']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/audit/events" variant="outlined">
                {formatLocalizedMessage(intl, '审计事件')}
              </Button>
              <Button component={RouterLink} to="/platform/audit/trust" variant="outlined">
                {formatLocalizedMessage(intl, '可信占位')}
              </Button>
              <Button component={RouterLink} to="/platform/master-data" variant="outlined">
                {formatLocalizedMessage(intl, '主数据与接口治理')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '关键审计事件')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '时间')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '操作人')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '动作')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '对象')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '结果')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '备注')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditEvents.map((item) => (
                <TableRow key={`${item.time}-${item.object}`} hover>
                  <TableCell>{item.time}</TableCell>
                  <TableCell>{l(item.actor)}</TableCell>
                  <TableCell>{l(item.action)}</TableCell>
                  <TableCell>{l(item.object)}</TableCell>
                  <TableCell>
                    <StatusChip label={l(item.result)} />
                  </TableCell>
                  <TableCell>{l(item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
