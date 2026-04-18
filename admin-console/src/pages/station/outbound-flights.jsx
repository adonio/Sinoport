import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import {
  saveOutboundContainer,
  useGetMobileOutboundDetail,
  useGetOutboundFlights,
  useGetStationFlightOptions,
  useGetStationOutboundOverview
} from 'api/station';

const officeOutboundPlans = [
  {
    flightNo: 'SE913',
    officePlan: '提前确认 FFM / UWS / Manifest，预排 ULD、飞机机位和机坪执行顺序',
    pdaExec: '收货、集装器执行、机坪装机'
  },
  {
    flightNo: 'URO913',
    officePlan: '确认 UWS 修订版、Loaded 节点证据要求和机位绑定',
    pdaExec: '现场继续装机、回填 Loaded 时间戳'
  }
];

export default function StationOutboundFlightsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const { ffmForecastRows, manifestSummary } = useGetStationOutboundOverview();
  const { outboundFlights, outboundFlightPage } = useGetOutboundFlights({
    page: page + 1,
    page_size: PAGE_SIZE
  });
  const { flightOptions } = useGetStationFlightOptions('outbound');
  const defaultFlightNo = useMemo(
    () => flightOptions[0]?.meta?.flight_no || outboundFlights[0]?.flightNo || 'SE913',
    [flightOptions, outboundFlights]
  );
  const [uldForm, setUldForm] = useState({
    flightNo: 'SE913',
    boardCode: 'ULD91009',
    awbs: '436-10357583, 436-10357896',
    aircraftPosition: '15L'
  });
  const { mobileOutboundFlightDetail } = useGetMobileOutboundDetail(uldForm.flightNo);
  const rows = outboundFlights;

  const metrics = [
    {
      title: m('待飞走航班'),
      value: `${outboundFlightPage?.total || rows.length}`,
      helper: m('当前在本站处理的出港航班'),
      chip: m('航班'),
      color: 'primary'
    },
    {
      title: m('Manifest 版本'),
      value: manifestSummary.version,
      helper: manifestSummary.exchange,
      chip: m('Manifest'),
      color: 'secondary'
    },
    { title: m('出港货物数量'), value: manifestSummary.outboundCount, helper: m('来自航班级装载汇总'), chip: m('货量'), color: 'success' }
  ];
  const flightContainers = useMemo(
    () => (mobileOutboundFlightDetail?.containers || []).filter((item) => item.flightNo === uldForm.flightNo),
    [mobileOutboundFlightDetail?.containers, uldForm.flightNo]
  );

  useEffect(() => {
    const fallbackFlightNo = defaultFlightNo || 'SE913';
    setUldForm((current) => {
      if (current.flightNo) return current;
      return { ...current, flightNo: fallbackFlightNo };
    });
  }, [defaultFlightNo]);

  const createOfficeUldPlan = () => {
    const awbs = uldForm.awbs
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const matchedAwbs = ffmForecastRows.filter((item) => awbs.includes(item.awb));
    const entries = matchedAwbs.map((item) => ({
      awb: item.awb,
      pieces: item.pieces,
      boxes: Math.max(1, Math.round(item.pieces / 10)),
      weight: String(item.weight).replace(' kg', '')
    }));
    const totalBoxes = entries.reduce((sum, item) => sum + item.boxes, 0);
    const totalWeightKg = entries.reduce((sum, item) => sum + Number(item.weight || 0), 0);

    if (!uldForm.boardCode.trim()) return;

    void saveOutboundContainer(uldForm.flightNo, {
      boardCode: uldForm.boardCode.trim().toUpperCase(),
      flightNo: uldForm.flightNo,
      entries,
      totalBoxes,
      totalWeightKg: Number(totalWeightKg.toFixed(1)),
      reviewedWeightKg: Number((totalWeightKg * 1.003).toFixed(1)),
      aircraftPosition: uldForm.aircraftPosition.trim(),
      status: '待装机',
      note: `机位 ${uldForm.aircraftPosition.trim()}`
    });
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('出港 / 航班')}
          title={m('出港管理 / 航班管理')}
          description={m('按航班管理预报、收货、装载、飞走与 Manifest 归档，并为文件放行、任务分派和对象回连提供统一入口。')}
          chips={[m('预报'), m('收货'), m('装载'), m('Manifest'), m('任务入口'), m('门槛控制')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant="outlined" component={RouterLink} to="/station/outbound/waybills">
                {m('提单管理')}
              </Button>
              <Button size="small" variant="outlined" component={RouterLink} to="/station/documents">
                {m('单证中心')}
              </Button>
              <Button size="small" variant="outlined" component={RouterLink} to="/station/tasks">
                {m('作业任务')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      {metrics.map((item) => (
        <Grid key={item.title} size={{ xs: 12, md: 4 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={12}>
        <MainCard title={m('出港航班操作台')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('ETD')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
                <TableCell>{m('当前阶段')}</TableCell>
                <TableCell>{m('Manifest')}</TableCell>
                <TableCell>{m('货量')}</TableCell>
                <TableCell align="right">{m('操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.etd}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.status)} />
                  </TableCell>
                  <TableCell>{localizeUiText(locale, item.stage)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.manifest)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.cargo)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="outlined" component={RouterLink} to={`/station/outbound/flights/${item.flightNo}`}>
                        {m('查看')}
                      </Button>
                      <Button size="small" variant="outlined" component={RouterLink} to="/station/documents">
                        {m('单证')}
                      </Button>
                      <Button size="small" variant="outlined" component={RouterLink} to="/station/tasks">
                        {m('任务')}
                      </Button>
                      <Button size="small" variant="outlined" component={RouterLink} to="/station/shipments">
                        {m('链路')}
                      </Button>
                      <Button size="small" variant="contained">
                        {m('飞走')}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={outboundFlightPage?.total || rows.length}
            page={Math.max(0, (outboundFlightPage?.page || 1) - 1)}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
          />
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title={m('办公室预排 ULD / 机位 / 文件')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('后台先完成')}</TableCell>
                <TableCell>{m('PDA 现场执行')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {officeOutboundPlans.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{localizeUiText(locale, item.officePlan)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.pdaExec)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <MainCard title={m('后台 ULD / 机位预排')}>
          <Stack sx={{ gap: 1.5 }}>
            <TextField
              select
              label={m('航班')}
              value={uldForm.flightNo}
              onChange={(event) => setUldForm((prev) => ({ ...prev, flightNo: event.target.value }))}
            >
              {flightOptions.map((item) => (
                <MenuItem key={item.value} value={item.meta?.flight_no || item.value} disabled={item.disabled}>
                  {localizeUiText(intl.locale, item.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={m('ULD / PMC')}
              value={uldForm.boardCode}
              onChange={(event) => setUldForm((prev) => ({ ...prev, boardCode: event.target.value }))}
            />
            <TextField
              label={m('计划 AWB')}
              value={uldForm.awbs}
              onChange={(event) => setUldForm((prev) => ({ ...prev, awbs: event.target.value }))}
            />
            <TextField
              label={m('飞机机位')}
              value={uldForm.aircraftPosition}
              onChange={(event) => setUldForm((prev) => ({ ...prev, aircraftPosition: event.target.value }))}
            />
            <Button variant="contained" onClick={createOfficeUldPlan}>
              {m('保存 ULD 预排')}
            </Button>
            <Typography variant="caption" color="text.secondary">
              {m('保存后会同步到移动端“集装器 / 装机 / 出港机坪” demo 数据。')}
            </Typography>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title={m('办公室预排 ULD 清单')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ULD</TableCell>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('计划 AWB')}</TableCell>
                <TableCell>{m('机位')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
                <TableCell align="right">{m('操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {flightContainers.map((item) => (
                <TableRow key={`${item.flightNo}-${item.boardCode}`} hover>
                  <TableCell>{item.boardCode}</TableCell>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{(item.entries || []).map((entry) => entry.awb).join(' / ')}</TableCell>
                  <TableCell>{localizeUiText(locale, item.aircraftPosition || m('待编排'))}</TableCell>
                  <TableCell>{localizeUiText(locale, item.status)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        setUldForm({
                          flightNo: item.flightNo,
                          boardCode: item.boardCode,
                          awbs: (item.entries || []).map((entry) => entry.awb).join(', '),
                          aircraftPosition: item.aircraftPosition || ''
                        })
                      }
                    >
                      {m('编辑')}
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
