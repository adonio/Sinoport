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
import { inboundFlights, outboundFlights } from 'data/sinoport';
import { stationBlockerQueue, stationDashboardCards, stationReviewQueue, stationTransferRows } from 'data/sinoport-adapters';

export default function StationDashboardPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Admin"
          title="货站后台总览"
          description="货站首页优先展示今天的航班、阻塞节点、NOA/POD 队列、待复核任务和二次转运动作，而不是传统 ERP 菜单。"
          chips={['Inbound', 'Outbound', 'Blockers', 'Review', 'NOA', 'POD', 'Transfer']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/inbound" variant="outlined">
                进港管理
              </Button>
              <Button component={RouterLink} to="/station/outbound" variant="outlined">
                出港管理
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                作业指令中心
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证与指令中心
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title="当前执行阻断" reasons={stationBlockerQueue.map((item) => item.title)} />
      </Grid>

      {stationDashboardCards.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="今日进港航班">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ETA</TableCell>
                <TableCell>当前节点</TableCell>
                <TableCell>优先级</TableCell>
                <TableCell>货量</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.eta}</TableCell>
                  <TableCell>{item.step}</TableCell>
                  <TableCell>{item.priority}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to="/station/inbound/flights" size="small" variant="text">
                      进入
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="今日出港航班">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ETD</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>Manifest</TableCell>
                <TableCell>货量</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.etd}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell>{item.manifest}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to="/station/outbound/flights" size="small" variant="text">
                      进入
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard title="待复核任务" items={stationReviewQueue} />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard title="阻塞任务" items={stationBlockerQueue} />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title="二次转运待办">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>转运单号</TableCell>
                <TableCell>AWB</TableCell>
                <TableCell>目的站</TableCell>
                <TableCell>车辆</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationTransferRows.map((item) => (
                <TableRow key={item.transferId} hover>
                  <TableCell>{item.transferId}</TableCell>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.destination}</TableCell>
                  <TableCell>{`${item.plate} / ${item.driver}`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
