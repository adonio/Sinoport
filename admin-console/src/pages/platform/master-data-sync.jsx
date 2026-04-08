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
import { integrationSyncActionRows, integrationSyncRows } from 'data/sinoport-adapters';

export default function PlatformMasterDataSyncPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader eyebrow="Sync Status" title="接口同步看板" description="第二批展示 FFM / UWS / Manifest / POD / Flight / Last-mile 的模拟同步状态。" chips={['FFM', 'UWS', 'Manifest', 'POD', 'Flight', 'Last-mile']} />
      </Grid>
      <Grid size={12}>
        <MainCard title="同步状态">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>同步项</TableCell>
                <TableCell>目标模块</TableCell>
                <TableCell>最后运行</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>兜底策略</TableCell>
                <TableCell>动作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {integrationSyncRows.map((item) => (
                <TableRow key={item.name} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.target}</TableCell>
                  <TableCell>{item.lastRun}</TableCell>
                  <TableCell><StatusChip label={item.status} /></TableCell>
                  <TableCell>{item.fallback}</TableCell>
                  <TableCell>
                    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="outlined">
                        {integrationSyncActionRows.find((entry) => entry.name === item.name)?.primaryAction || '模拟同步'}
                      </Button>
                      <Button size="small" variant="text">
                        {integrationSyncActionRows.find((entry) => entry.name === item.name)?.fallbackAction || item.fallback}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="接口动作说明">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>同步项</TableCell>
                <TableCell>主动作</TableCell>
                <TableCell>兜底动作</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {integrationSyncActionRows.map((item) => (
                <TableRow key={item.name} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.primaryAction}</TableCell>
                  <TableCell>{item.fallbackAction}</TableCell>
                  <TableCell>{item.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
