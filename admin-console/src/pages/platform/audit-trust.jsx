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

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Trust Trace"
          title="可信留痕预览"
          description="当前页不做链上公证，但已基于真实审计事件和状态迁移生成可信字段预览，便于后续接签名、公证和哈希存证。"
          chips={['Event ID', 'Hash Preview', 'Signature Ref', 'State Trace']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/audit" variant="outlined">
                返回审计总览
              </Button>
              <Button component={RouterLink} to="/platform/audit/events" variant="outlined">
                审计事件
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title="可信写入说明">
          <Stack sx={{ gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              当前字段来自真实 `audit_events` 与 `state_transitions`，哈希与签名引用仍为预览值。
            </Typography>
            <Typography variant="body2" color="text.secondary">
              后续若接签名、公证或对象存证，只需要把当前 `Event ID / Hash / Signature Ref / Notarization Ref` 结构落到正式后端即可。
            </Typography>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="可信字段预览">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Event ID</TableCell>
                <TableCell>对象</TableCell>
                <TableCell>Event Hash</TableCell>
                <TableCell>Signature Ref</TableCell>
                <TableCell>Notarization Ref</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trustRows.map((item) => (
                <TableRow key={`${item.eventId}-${item.object}`} hover>
                  <TableCell>{item.eventId}</TableCell>
                  <TableCell>{item.object}</TableCell>
                  <TableCell>{item.eventHash}</TableCell>
                  <TableCell>{item.signatureRef}</TableCell>
                  <TableCell>{item.notarizationRef}</TableCell>
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
