import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Stack from '@mui/material/Stack';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import BlockingReasonAlert from 'components/sinoport/BlockingReasonAlert';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import LifecycleStepList from 'components/sinoport/LifecycleStepList';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { useGetStationInboundOverview } from 'api/station';

export default function StationInboundPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const { inboundDocumentGates, inboundFlights, inboundLifecycleRows, stationBlockerQueue, stationReviewQueue, stationTransferRows } =
    useGetStationInboundOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('进港作业')}
          title={m('进港管理')}
          description={m('覆盖进港航班、地面履约状态、节点任务、文件放行、NOA 与交付闭环，重点围绕对象与状态机执行。')}
          chips={[m('航班看板'), m('地面履约'), m('任务队列'), m('NOA 门槛'), m('转运'), m('POD 闭环')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/inbound/flights" variant="outlined">
                {m('航班管理')}
              </Button>
              <Button component={RouterLink} to="/station/inbound/waybills" variant="outlined">
                {m('提单管理')}
              </Button>
              <Button component={RouterLink} to="/station/inbound/mobile" variant="outlined">
                {m('PDA 作业终端')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title={m('进港航班看板')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('ETA')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
                <TableCell>{m('当前节点')}</TableCell>
                <TableCell>{m('货量')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.eta}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.status)} />
                  </TableCell>
                  <TableCell>{localizeUiText(locale, item.step)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.cargo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title={m('地面履约状态')}>
          <LifecycleStepList steps={inboundLifecycleRows.map((item) => ({ ...item, metric: `${item.count} 票` }))} />
        </MainCard>
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title={m('当前进港阻断')} reasons={stationBlockerQueue.map((item) => item.title)} />
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <TaskQueueCard title={m('待复核 / 待发送 NOA')} items={stationReviewQueue} />
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <DocumentStatusCard title={m('进港文件放行')} items={inboundDocumentGates} />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('二次转运记录')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('转运单号')}</TableCell>
                <TableCell>{m('提单')}</TableCell>
                <TableCell>{m('目的站')}</TableCell>
                <TableCell>{m('车辆')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationTransferRows.map((item) => (
                <TableRow key={item.transferId} hover>
                  <TableCell>{item.transferId}</TableCell>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{localizeUiText(locale, item.destination)}</TableCell>
                  <TableCell>{`${item.plate} / ${item.driver}`}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.status)} />
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
