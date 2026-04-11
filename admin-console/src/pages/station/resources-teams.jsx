import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { stationWorkerRows } from 'data/sinoport-adapters';
import { Link as RouterLink } from 'react-router-dom';

export default function StationResourcesTeamsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Workers"
          title="班组与人员"
          description="按 Team / Worker 维度查看站内资源映射，用于任务分配和班次展示。"
          chips={['Worker', 'Team', 'Role']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/resources" variant="outlined">
                返回资源总览
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                作业任务
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title="班组与人员">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>工号</TableCell>
                <TableCell>姓名</TableCell>
                <TableCell>班组</TableCell>
                <TableCell>角色</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationWorkerRows.map((item) => (
                <TableRow key={item.workerId} hover>
                  <TableCell>{item.workerId}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.team}</TableCell>
                  <TableCell>{item.role}</TableCell>
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
