import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { importJobRows } from 'data/sinoport-adapters';

export default function PlatformMasterDataJobsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader eyebrow="Import Jobs" title="导入任务日志" description="展示第二批接口导入、解析失败、重试和人工补录的模拟任务日志。" chips={['Import Jobs', 'Retry', 'Fallback']} />
      </Grid>
      <Grid size={12}>
        <MainCard title="导入日志">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>任务</TableCell>
                <TableCell>来源</TableCell>
                <TableCell>对象</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>摘要</TableCell>
                <TableCell>重试</TableCell>
                <TableCell>动作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {importJobRows.map((item) => (
                <TableRow key={item.jobId} hover>
                  <TableCell>{item.jobId}</TableCell>
                  <TableCell>{item.source}</TableCell>
                  <TableCell>{item.linkedTo}</TableCell>
                  <TableCell><StatusChip label={item.result} /></TableCell>
                  <TableCell>{item.summary}</TableCell>
                  <TableCell>{item.retry}</TableCell>
                  <TableCell>
                    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="outlined">
                        {item.retry === '无需' ? '查看日志' : '重试'}
                      </Button>
                      <Button size="small" variant="text">
                        人工补录
                      </Button>
                    </Stack>
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
