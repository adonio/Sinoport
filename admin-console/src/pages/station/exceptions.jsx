import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Link as RouterLink } from 'react-router-dom';

import BlockingReasonAlert from 'components/sinoport/BlockingReasonAlert';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { useGetStationExceptions } from 'api/station';
import { exceptionDetailRows, stationBlockerQueue } from 'data/sinoport-adapters';

export default function StationExceptionsPage() {
  const { stationExceptions, stationExceptionOverview } = useGetStationExceptions();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Exception Center"
          title="异常中心"
          description="所有数量、单证、转运和签收问题都必须结构化记录，并明确阻断任务、门槛规则和恢复动作，不允许只保留聊天截图或口头结论。"
          chips={['Structured Classification', 'Ownership', 'Blocked Tasks', 'Recovery Actions']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                查看任务池
              </Button>
              <Button component={RouterLink} to="/station/shipments" variant="outlined">
                履约链路
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证中心
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title="当前异常导致的阻断" reasons={stationBlockerQueue.map((item) => item.title)} />
      </Grid>

      {stationExceptionOverview.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard
          title="恢复动作提醒"
          items={exceptionDetailRows.map((item) => ({
            id: item.id,
            title: `${item.id} · ${item.type}`,
            description: item.recoveryAction,
            meta: `阻断任务：${item.blockedTask}`,
            status: item.status,
            actions: [
              { label: '异常详情', to: `/station/exceptions/${item.id}`, variant: 'outlined' },
              { label: '关联对象', to: item.objectTo, variant: 'outlined' },
              { label: '当前动作', to: item.jumpTo, variant: 'outlined' }
            ]
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 8 }}>
        <MainCard title="异常案例">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>异常编号</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>对象</TableCell>
                <TableCell>责任 Owner</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell>阻断任务</TableCell>
                <TableCell>恢复动作</TableCell>
                <TableCell>状态</TableCell>
                <TableCell align="right">跳转</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationExceptions.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.object}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>{item.sla}</TableCell>
                  <TableCell>{item.blockedTask}</TableCell>
                  <TableCell>{item.recoveryAction}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button component={RouterLink} to={item.detailTo} size="small" variant="outlined">
                        详情
                      </Button>
                      <Button component={RouterLink} to={item.objectTo} size="small" variant="outlined">
                        对象
                      </Button>
                      <Button component={RouterLink} to={item.jumpTo} size="small" variant="outlined">
                        动作
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
