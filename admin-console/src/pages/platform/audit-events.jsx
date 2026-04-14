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
import { Link as RouterLink } from 'react-router-dom';

export default function PlatformAuditEventsPage() {
  const { auditLogs } = useGetPlatformAuditLogs();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Audit Events"
          title="审计事件明细"
          description="查看对象回溯、变更前后值、文件导入和状态回退等细粒度事件。"
          chips={['Before/After', 'File Import', 'Rollback']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/audit" variant="outlined">
                返回审计总览
              </Button>
              <Button component={RouterLink} to="/platform/master-data/jobs" variant="outlined">
                导入任务
              </Button>
            </Stack>
          }
        />
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
              {auditLogs.map((item) => (
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
