import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
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
import { exceptionOverview } from 'data/sinoport';
import { exceptionDetailRows, stationBlockerQueue } from 'data/sinoport-adapters';

export default function StationExceptionsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Exception Center"
          title="异常中心"
          description="所有数量、单证、转运和签收问题都必须结构化记录，并明确阻断任务、门槛规则和恢复动作，不允许只保留聊天截图或口头结论。"
          chips={['Structured Classification', 'Ownership', 'Blocked Tasks', 'Recovery Actions']}
          action={
            <Button component={RouterLink} to="/station/tasks" variant="outlined">
              查看任务池
            </Button>
          }
        />
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title="当前异常导致的阻断" reasons={stationBlockerQueue.map((item) => item.title)} />
      </Grid>

      {exceptionOverview.map((item) => (
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
            status: item.status
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
              {exceptionDetailRows.map((item) => (
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
                    <Button component={RouterLink} to={item.jumpTo} size="small" variant="outlined">
                      查看
                    </Button>
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
