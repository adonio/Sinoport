import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Link as RouterLink } from 'react-router-dom';

import { useGetPlatformAuditEvents, useGetPlatformAuditLogs } from 'api/platform';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { useIntl } from 'react-intl';

function buildPreviewRows(events, logs) {
  const eventRows = events.slice(0, 6).map((item) => ({
    eventId: item.id || item.time,
    object: item.object,
    eventHash: `HASH-${String(item.id || item.time).slice(-8)}`.toUpperCase(),
    signatureRef: `SIG-${String(item.actor || 'SYSTEM').split(' / ')[0]}`.toUpperCase(),
    notarizationRef: 'PENDING',
    status: '已留痕'
  }));

  const logRows = logs.slice(0, 6).map((item) => ({
    eventId: item.id || item.time,
    object: item.object,
    eventHash: `HASH-${String(item.id || item.time).slice(-8)}`.toUpperCase(),
    signatureRef: `STATE-${String(item.actor || 'SYSTEM').slice(0, 12)}`.toUpperCase(),
    notarizationRef: 'STATE-TRACE',
    status: '状态迁移'
  }));

  return [...eventRows, ...logRows];
}

export default function PlatformAuditTrustPage() {
  const { auditEvents } = useGetPlatformAuditEvents();
  const { auditLogs } = useGetPlatformAuditLogs();
  const trustRows = buildPreviewRows(auditEvents, auditLogs);
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Trust Trace"
          title={formatLocalizedMessage(intl, '可信留痕预览')}
          description={formatLocalizedMessage(
            intl,
            '当前页不做链上公证，但已基于真实审计事件和状态迁移生成可信字段预览，便于后续接签名、公证和哈希存证。'
          )}
          chips={['Event ID', 'Hash Preview', 'Signature Ref', 'State Trace']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/audit" variant="outlined">
                {formatLocalizedMessage(intl, '返回审计总览')}
              </Button>
              <Button component={RouterLink} to="/platform/audit/events" variant="outlined">
                {formatLocalizedMessage(intl, '审计事件')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '可信写入说明')}>
          <Stack sx={{ gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {formatLocalizedMessage(intl, '当前字段来自真实 `audit_events` 与 `state_transitions`，哈希与签名引用仍为预览值。')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatLocalizedMessage(
                intl,
                '后续若接签名、公证或对象存证，只需要把当前 `Event ID / Hash / Signature Ref / Notarization Ref` 结构落到正式后端即可。'
              )}
            </Typography>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '可信字段预览')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{localizeUiText(intl.locale, 'Event ID')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '对象')}</TableCell>
                <TableCell>{localizeUiText(intl.locale, 'Event Hash')}</TableCell>
                <TableCell>{localizeUiText(intl.locale, 'Signature Ref')}</TableCell>
                <TableCell>{localizeUiText(intl.locale, 'Notarization Ref')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '状态')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trustRows.map((item) => (
                <TableRow key={`${item.eventId}-${item.object}`} hover>
                  <TableCell>{item.eventId}</TableCell>
                  <TableCell>{l(item.object)}</TableCell>
                  <TableCell>{item.eventHash}</TableCell>
                  <TableCell>{item.signatureRef}</TableCell>
                  <TableCell>{item.notarizationRef}</TableCell>
                  <TableCell>
                    <StatusChip label={l(item.status)} />
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
