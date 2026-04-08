import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import BlockingReasonAlert from 'components/sinoport/BlockingReasonAlert';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { platformAlerts, platformOperationKpis, platformPendingActions, stationAuditFeed, stationHealthRows } from 'data/sinoport-adapters';

export default function PlatformOperationsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Operations Center"
          title="运行态势中心"
          description="平台侧以链路健康、站点风险、接口告警、待审批动作和关键事件为主视角，统一观察全网履约运行态势。"
          chips={['Network Health', 'Blocked Lanes', 'Pending Actions', 'Integration Alerts', 'Audit Feed']}
        />
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title="平台级当前风险" reasons={platformAlerts.filter((item) => item.status === '阻塞').map((item) => item.title)} />
      </Grid>

      {platformOperationKpis.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={{ xs: 12, lg: 4 }}>
        <TaskQueueCard
          title="链路与接口告警"
          items={platformAlerts.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            status: item.status
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <TaskQueueCard
          title="待处理动作"
          items={platformPendingActions.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.note,
            meta: `${item.owner} · 截止 ${item.due}`,
            status: item.status
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title="关键事件回放">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>时间</TableCell>
                <TableCell>动作</TableCell>
                <TableCell>对象</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationAuditFeed.slice(0, 4).map((item) => (
                <TableRow key={`${item.time}-${item.object}`} hover>
                  <TableCell>{item.time}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.object}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.actor}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="站点健康度矩阵">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>站点</TableCell>
                <TableCell>控制层级</TableCell>
                <TableCell>阶段</TableCell>
                <TableCell>准备度</TableCell>
                <TableCell>当前风险</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationHealthRows.map((item) => (
                <TableRow key={item.code} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{item.code}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.control} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.phase} />
                  </TableCell>
                  <TableCell>{item.readiness}%</TableCell>
                  <TableCell>{item.blockingReason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
