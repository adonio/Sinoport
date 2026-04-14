import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import { useGetStationInboundMobileOverview } from 'api/station';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';

export default function StationInboundMobilePage() {
  const { inboundFlights, mobileTasks, inboundMobileSummary } = useGetStationInboundMobileOverview();
  const inboundTasks = mobileTasks.filter((item) => item.flightNo);
  const summary = inboundMobileSummary;

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Inbound / Mobile Terminal"
          title="PDA 作业终端总览"
          description="货站后台只展示真实移动任务、状态和快捷入口；具体执行进入真实 PDA 页面完成。"
          chips={['真实移动任务', 'PDA', 'Inbound', 'Task Status']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/mobile/select" variant="contained">
                打开节点选择
              </Button>
              <Button component={RouterLink} to="/mobile/inbound" variant="outlined">
                打开进港 PDA
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="任务总数" value={`${summary.totalTasks}`} helper="当前进港移动任务" chip="All" color="primary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="待领取/待开始" value={`${summary.queuedTasks}`} helper="Created / Assigned / Accepted" chip="Queue" color="warning" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="执行中" value={`${summary.activeTasks}`} helper="Started / Evidence Uploaded" chip="Active" color="secondary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="已完成" value={`${summary.completedTasks}`} helper="Completed / Verified / Closed" chip="Done" color="success" />
      </Grid>

      {inboundFlights.map((flight) => {
        const flightTasks = inboundTasks.filter((item) => item.flightNo === flight.flightNo);

        return (
          <Grid key={flight.flightNo} size={{ xs: 12, xl: 6 }}>
            <MainCard title={`${flight.flightNo} / PDA 任务`}>
              <Stack sx={{ gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {flight.source} · ETA {flight.eta} · 当前节点 {flight.step}
                </Typography>

                {flightTasks.length ? (
                  flightTasks.map((task) => (
                    <Stack
                      key={task.taskId}
                      direction="row"
                      sx={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 1.25
                      }}
                    >
                      <Stack sx={{ gap: 0.35, minWidth: 0 }}>
                        <Typography variant="subtitle2">{task.taskType}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {task.taskId} · {task.executionNode}
                        </Typography>
                      </Stack>
                      <StatusChip label={task.taskStatus} />
                    </Stack>
                  ))
                ) : (
                  <Typography color="text.secondary">当前航班没有移动任务。</Typography>
                )}

                <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                  <Button component={RouterLink} to={`/mobile/inbound/${flight.flightNo}`} size="small" variant="contained">
                    打开航班总览
                  </Button>
                  <Button component={RouterLink} to={`/mobile/inbound/${flight.flightNo}/breakdown`} size="small" variant="outlined">
                    拆板理货
                  </Button>
                  <Button component={RouterLink} to={`/mobile/inbound/${flight.flightNo}/loading`} size="small" variant="outlined">
                    装车执行
                  </Button>
                </Stack>
              </Stack>
            </MainCard>
          </Grid>
        );
      })}
    </Grid>
  );
}
