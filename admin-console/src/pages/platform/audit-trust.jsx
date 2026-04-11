import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { trustTraceRows } from 'data/sinoport-adapters';
import { Link as RouterLink } from 'react-router-dom';

export default function PlatformAuditTrustPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Trust Placeholders"
          title="可信留痕占位"
          description="第二批只做前端占位，展示 Event ID / Hash / Signature / Notarization 等未来可信字段。"
          chips={['Event ID', 'Hash', 'Signature Ref']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/audit" variant="outlined">
                返回审计总览
              </Button>
              <Button component={RouterLink} to="/platform/master-data/relationships" variant="outlined">
                对象关系
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title="可信写入说明">
          <Stack sx={{ gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              当前阶段只展示可信字段预留，不做真实链上写入或公证。
            </Typography>
            <Typography variant="body2" color="text.secondary">
              后续真实实现将复用 Event ID / Event Hash / Signature Ref / Notarization Ref 的展示结构。
            </Typography>
          </Stack>
        </MainCard>
      </Grid>
      <Grid size={12}>
        <MainCard title="可信字段占位">
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
              {trustTraceRows.map((item) => (
                <TableRow key={item.eventId} hover>
                  <TableCell>{item.eventId}</TableCell>
                  <TableCell>{item.object}</TableCell>
                  <TableCell>{item.eventHash}</TableCell>
                  <TableCell>{item.signatureRef}</TableCell>
                  <TableCell>{item.notarizationRef}</TableCell>
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
