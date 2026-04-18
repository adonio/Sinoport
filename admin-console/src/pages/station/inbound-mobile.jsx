import { useState } from 'react';

import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TablePagination from '@mui/material/TablePagination';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import { useGetInboundFlights, useGetStationInboundMobileOverview } from 'api/station';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

const PAGE_SIZE = 20;

export default function StationInboundMobilePage() {
  const intl = useIntl();
  const locale = intl.locale;
  const m = (value) => formatLocalizedMessage(intl, value);
  const l = (value) => localizeUiText(locale, value);
  const [page, setPage] = useState(0);
  const { mobileTasks, inboundMobileSummary } = useGetStationInboundMobileOverview();
  const { inboundFlights, inboundFlightPage, inboundFlightsLoading } = useGetInboundFlights({
    page: page + 1,
    page_size: PAGE_SIZE
  });
  const inboundTasks = mobileTasks.filter((item) => item.flightNo);
  const summary = inboundMobileSummary;

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={l('进港 / 移动作业终端')}
          title={l('PDA 作业终端总览')}
          description={l('货站后台只展示真实移动任务、状态和快捷入口；具体执行进入真实 PDA 页面完成。')}
          chips={[l('真实移动任务'), l('PDA'), l('进港'), l('任务状态')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/mobile/select" variant="contained">
                {m('打开节点选择')}
              </Button>
              <Button component={RouterLink} to="/mobile/inbound" variant="outlined">
                {m('打开进港 PDA')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title={m('任务总数')} value={`${summary.totalTasks}`} helper={m('当前进港移动任务')} chip={m('全部')} color="primary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('待领取/待开始')}
          value={`${summary.queuedTasks}`}
          helper={m('已创建 / 已分派 / 已领取')}
          chip={m('队列')}
          color="warning"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('执行中')}
          value={`${summary.activeTasks}`}
          helper={m('已开始 / 已上传证据')}
          chip={m('进行中')}
          color="secondary"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard
          title={m('已完成')}
          value={`${summary.completedTasks}`}
          helper={m('已完成 / 已复核 / 已关闭')}
          chip={m('完成')}
          color="success"
        />
      </Grid>

      {inboundFlightsLoading && !inboundFlights.length ? (
        <Grid size={12}>
          <MainCard>
            <Typography variant="body2" color="text.secondary">
              {m('正在加载进港航班...')}
            </Typography>
          </MainCard>
        </Grid>
      ) : null}

      {inboundFlights.map((flight) => {
        const flightTasks = inboundTasks.filter((item) => item.flightNo === flight.flightNo);

        return (
          <Grid key={flight.flightNo} size={{ xs: 12, xl: 6 }}>
            <MainCard title={`${flight.flightNo} / ${m('PDA 任务')}`}>
              <Stack sx={{ gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {l(flight.source)} · ETA {flight.eta} · {m('当前节点')} {l(flight.step)}
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
                        <Typography variant="subtitle2">{l(task.taskType)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {task.taskId} · {l(task.executionNode)}
                        </Typography>
                      </Stack>
                      <StatusChip label={l(task.taskStatus)} />
                    </Stack>
                  ))
                ) : (
                  <Typography color="text.secondary">{m('当前航班没有移动任务。')}</Typography>
                )}

                <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                  <Button component={RouterLink} to={`/mobile/inbound/${flight.flightNo}`} size="small" variant="contained">
                    {m('打开航班总览')}
                  </Button>
                  <Button component={RouterLink} to={`/mobile/inbound/${flight.flightNo}/breakdown`} size="small" variant="outlined">
                    {m('拆板理货')}
                  </Button>
                  <Button component={RouterLink} to={`/mobile/inbound/${flight.flightNo}/loading`} size="small" variant="outlined">
                    {m('装车执行')}
                  </Button>
                </Stack>
              </Stack>
            </MainCard>
          </Grid>
        );
      })}

      <Grid size={12}>
        <MainCard>
          <TablePagination
            component="div"
            rowsPerPageOptions={[PAGE_SIZE]}
            rowsPerPage={PAGE_SIZE}
            count={inboundFlightPage.total || inboundFlights.length}
            page={Math.max(0, Number(inboundFlightPage.page || 1) - 1)}
            onPageChange={(_event, nextPage) => setPage(nextPage)}
          />
        </MainCard>
      </Grid>
    </Grid>
  );
}
