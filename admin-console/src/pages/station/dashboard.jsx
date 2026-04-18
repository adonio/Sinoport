import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import BlockingReasonAlert from 'components/sinoport/BlockingReasonAlert';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { useGetStationDashboardOverview } from 'api/station';

export default function StationDashboardPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const { inboundFlights, outboundFlights, stationBlockerQueue, stationDashboardCards, stationReviewQueue, stationTransferRows } =
    useGetStationDashboardOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('货站后台')}
          title={m('货站后台总览')}
          description={m('货站首页优先展示今天的航班、阻塞节点、NOA/POD 队列、待复核任务和二次转运动作，而不是传统 ERP 菜单。')}
          chips={[m('进港'), m('出港'), m('阻断'), m('复核'), m('NOA'), m('POD'), m('转运')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/inbound" variant="outlined">
                {m('进港管理')}
              </Button>
              <Button component={RouterLink} to="/station/outbound" variant="outlined">
                {m('出港管理')}
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                {m('作业指令中心')}
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                {m('单证与指令中心')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title={m('当前执行阻断')} reasons={stationBlockerQueue.map((item) => item.title)} />
      </Grid>

      {stationDashboardCards.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title={m('今日进港航班')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('ETA')}</TableCell>
                <TableCell>{m('当前节点')}</TableCell>
                <TableCell>{m('优先级')}</TableCell>
                <TableCell>{m('货量')}</TableCell>
                <TableCell align="right">{m('操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.eta}</TableCell>
                  <TableCell>{localizeUiText(locale, item.step)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.priority)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.cargo)}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to="/station/inbound/flights" size="small" variant="text">
                      {m('进入')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title={m('今日出港航班')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('ETD')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
                <TableCell>{m('Manifest')}</TableCell>
                <TableCell>{m('货量')}</TableCell>
                <TableCell align="right">{m('操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.etd}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.status)} />
                  </TableCell>
                  <TableCell>{localizeUiText(locale, item.manifest)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.cargo)}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to="/station/outbound/flights" size="small" variant="text">
                      {m('进入')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard title={m('待复核任务')} items={stationReviewQueue} />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard title={m('阻塞任务')} items={stationBlockerQueue} />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title={m('二次转运待办')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('转运单号')}</TableCell>
                <TableCell>{m('提单')}</TableCell>
                <TableCell>{m('目的站')}</TableCell>
                <TableCell>{m('车辆')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationTransferRows.map((item) => (
                <TableRow key={item.transferId} hover>
                  <TableCell>{item.transferId}</TableCell>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{localizeUiText(locale, item.destination)}</TableCell>
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
