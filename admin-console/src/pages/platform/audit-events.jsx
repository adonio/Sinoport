import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { auditEventDetailRows } from 'data/sinoport-adapters';

export default function PlatformAuditEventsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader eyebrow="Audit Events" title="审计事件明细" description="查看对象回溯、变更前后值、文件导入和状态回退等细粒度事件。" chips={['Before/After', 'File Import', 'Rollback']} />
      </Grid>
      <Grid size={12}>
        <MainCard title="审计事件">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>时间</TableCell>
                <TableCell>动作</TableCell>
                <TableCell>对象</TableCell>
                <TableCell>Before</TableCell>
                <TableCell>After</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditEventDetailRows.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.time}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>{item.object}</TableCell>
                  <TableCell>{item.before}</TableCell>
                  <TableCell>{item.after}</TableCell>
                  <TableCell><StatusChip label={item.result} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
