import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import BlockingReasonAlert from 'components/sinoport/BlockingReasonAlert';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import LifecycleStepList from 'components/sinoport/LifecycleStepList';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { useGetStationOutboundOverview } from 'api/station';

export default function StationOutboundPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const {
    outboundFlights,
    ffmForecastRows,
    manifestRows,
    manifestSummary,
    masterAwbRows,
    receiptRows,
    uwsRows,
    outboundDocumentGates,
    outboundLifecycleRows,
    stationBlockerQueue
  } = useGetStationOutboundOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('出港作业')}
          title={m('出港管理')}
          description={m('出港后台按 PRD 拆成预报、接收、主单、装载、飞走、UWS 和 Manifest 板块，并补齐文件放行和任务阻断表达。')}
          chips={[m('FFM'), m('收货'), m('主单'), m('装载'), m('已飞走'), m('UWS'), m('Manifest'), m('门槛控制')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/outbound/flights" variant="outlined">
                {m('航班管理')}
              </Button>
              <Button component={RouterLink} to="/station/outbound/waybills" variant="outlined">
                {m('提单管理')}
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                {m('单证与指令中心')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      {[
        {
          title: m('待飞走航班'),
          value: `${outboundFlights.length}`,
          helper: m('出港排班与装载协同中'),
          chip: m('航班'),
          color: 'primary'
        },
        {
          title: m('Manifest 已导入'),
          value: manifestSummary.version,
          helper: manifestSummary.exchange,
          chip: m('单证'),
          color: 'secondary'
        },
        {
          title: m('出港货物数量'),
          value: manifestSummary.outboundCount,
          helper: m('来自 UWS 与 Manifest 汇总'),
          chip: m('出港'),
          color: 'success'
        },
        {
          title: m('目的港到货数量'),
          value: manifestSummary.destinationCount,
          helper: m('等待目的港回传用于对账'),
          chip: m('到货'),
          color: 'warning'
        }
      ].map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title={m('出港航班总览')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('ETD')}</TableCell>
                <TableCell>{m('阶段')}</TableCell>
                <TableCell>{m('Manifest')}</TableCell>
                <TableCell>{m('货量')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.etd}</TableCell>
                  <TableCell>
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                      <StatusChip label={localizeUiText(locale, item.status)} />
                      <Typography variant="caption" color="text.secondary">
                        {localizeUiText(locale, item.stage)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{localizeUiText(locale, item.manifest)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.cargo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title={m('出港状态链')}>
          <LifecycleStepList steps={outboundLifecycleRows} />
        </MainCard>
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title={m('当前出港阻断')} reasons={stationBlockerQueue.map((item) => item.title)} />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={`1. ${m('货物预报 FFM')}`}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('提单')}</TableCell>
                <TableCell>{m('目的站')}</TableCell>
                <TableCell>{m('件数')}</TableCell>
                <TableCell>{m('重量')}</TableCell>
                <TableCell>{m('货描')}</TableCell>
                <TableCell>{m('ULD')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ffmForecastRows.map((item) => (
                <TableRow key={item.awb} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{localizeUiText(locale, item.destination)}</TableCell>
                  <TableCell>{item.pieces}</TableCell>
                  <TableCell>{item.weight}</TableCell>
                  <TableCell>{item.goods}</TableCell>
                  <TableCell>{item.uld}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={`2. ${m('货物接收')}`}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('提单')}</TableCell>
                <TableCell>{m('预报')}</TableCell>
                <TableCell>{m('实收')}</TableCell>
                <TableCell>{m('结果')}</TableCell>
                <TableCell>{m('差异')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receiptRows.map((item) => (
                <TableRow key={item.awb} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.planned}</TableCell>
                  <TableCell>{item.actual}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.result)} />
                  </TableCell>
                  <TableCell>{localizeUiText(locale, item.issue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={`3. ${m('货物主单')}`}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('提单')}</TableCell>
                <TableCell>{m('发货人')}</TableCell>
                <TableCell>{m('收货人')}</TableCell>
                <TableCell>{m('航段')}</TableCell>
                <TableCell>{m('件数')}</TableCell>
                <TableCell>{m('重量')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {masterAwbRows.map((item) => (
                <TableRow key={item.awb} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.shipper}</TableCell>
                  <TableCell>{item.consignee}</TableCell>
                  <TableCell>{item.route}</TableCell>
                  <TableCell>{item.pcs}</TableCell>
                  <TableCell>{item.weight}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={`4-6. ${m('装载 / 飞走 / 装载信息 UWS')}`}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('提单')}</TableCell>
                <TableCell>{m('ULD')}</TableCell>
                <TableCell>{m('件数')}</TableCell>
                <TableCell>{m('毛重')}</TableCell>
                <TableCell>{m('POD')}</TableCell>
                <TableCell>{m('目的站')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uwsRows.map((item) => (
                <TableRow key={`${item.awb}-${item.uld}`} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.uld}</TableCell>
                  <TableCell>{item.pcs}</TableCell>
                  <TableCell>{item.weight}</TableCell>
                  <TableCell>{localizeUiText(locale, item.pod)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.destination)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <DocumentStatusCard title={m('出港文件放行')} items={outboundDocumentGates} />
      </Grid>

      <Grid size={12}>
        <MainCard title={`7. ${m('Manifest')}`}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('ULD / PMC')}</TableCell>
                <TableCell>{m('提单')}</TableCell>
                <TableCell>{m('件数')}</TableCell>
                <TableCell>{m('毛重')}</TableCell>
                <TableCell>{m('路由')}</TableCell>
                <TableCell>{m('货类')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {manifestRows.map((item) => (
                <TableRow key={`${item.flightNo}-${item.awb}`} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.uld}</TableCell>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.pieces}</TableCell>
                  <TableCell>{item.weight}</TableCell>
                  <TableCell>{item.route}</TableCell>
                  <TableCell>{item.type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <TaskQueueCard
          title={m('出港任务提示')}
          items={[
            {
              id: 'OUT-001',
              title: m('SE913 Manifest 最终版待冻结'),
              description: m('Manifest 仍为待生成状态，不能进入飞走归档。'),
              status: m('待处理')
            },
            {
              id: 'OUT-002',
              title: m('装机复核待完成'),
              description: m('缺少 Loaded 照片与独立复核签名。'),
              status: m('警戒')
            }
          ]}
        />
      </Grid>
    </Grid>
  );
}
