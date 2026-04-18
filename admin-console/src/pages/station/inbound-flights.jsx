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
import PageHeader from 'components/sinoport/PageHeader';
import ProgressMetricCard from 'components/sinoport/ProgressMetricCard';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import {
  getInboundLoadingPlans,
  getInboundPallets,
  saveInboundLoadingPlan,
  saveInboundPallet,
  updateInboundLoadingPlan,
  updateInboundPallet,
  useGetInboundFlights,
  useGetStationFlightOptions
} from 'api/station';

const officeInboundPlans = [
  {
    flightNo: 'SE803',
    officePlan: '提前编排理货顺序、托盘规则、装车计划、车牌/司机/提货单号',
    pdaExec: '点数、打托盘、按计划装车'
  },
  {
    flightNo: 'SE681',
    officePlan: '确认二次转运优先级、NOA 节点顺序、历史托盘与库位',
    pdaExec: '理货、托盘执行、货物转入下一节点'
  }
];

export default function StationInboundFlightsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const { inboundFlights, inboundLifecycle, inboundFlightPage } = useGetInboundFlights({
    page: page + 1,
    page_size: PAGE_SIZE
  });
  const { flightOptions } = useGetStationFlightOptions('inbound');
  const [loadingPlans, setLoadingPlans] = useState([]);
  const [pallets, setPallets] = useState([]);
  const defaultFlightNo = useMemo(
    () => flightOptions[0]?.meta?.flight_no || inboundFlights[0]?.flightNo || 'SE803',
    [flightOptions, inboundFlights]
  );
  const [palletForm, setPalletForm] = useState({
    flightNo: 'SE803',
    palletNo: 'SE803-PLT-1501',
    awbs: '436-10358585, 436-10359018',
    totalBoxes: '18',
    totalWeightKg: '438.0',
    storageLocation: 'MME-STAGE-51'
  });
  const [planForm, setPlanForm] = useState({
    id: 'LOAD-OFFICE-701',
    flightNo: 'SE803',
    truckPlate: 'HX-TRK-701',
    driverName: 'Office Planner 01',
    collectionNote: 'CN-SE803-701',
    forkliftDriver: 'Forklift Planner',
    checker: 'Checker Planner',
    arrivalTime: '2026-04-07T20:10',
    palletNos: 'SE803-PLT-1501, SE803-PLT-1201'
  });

  const lifecycleColors = ['primary', 'secondary', 'info', 'warning', 'success', 'error'];
  const totalCount = inboundFlightPage?.total || inboundFlights.length;
  const displayLifecycle = inboundLifecycle.filter((item) => item.label !== '已交付');
  const flightPallets = useMemo(() => pallets.filter((item) => item.flightNo === palletForm.flightNo), [palletForm.flightNo, pallets]);
  const flightLoadingPlans = useMemo(
    () => loadingPlans.filter((item) => item.flightNo === planForm.flightNo),
    [loadingPlans, planForm.flightNo]
  );

  useEffect(() => {
    const fallbackFlightNo = defaultFlightNo || 'SE803';

    setPalletForm((current) => {
      if (current.flightNo) return current;
      return { ...current, flightNo: fallbackFlightNo };
    });
    setPlanForm((current) => {
      if (current.flightNo) return current;
      return { ...current, flightNo: fallbackFlightNo };
    });
  }, [defaultFlightNo]);

  useEffect(() => {
    const targetFlightNo = palletForm.flightNo || planForm.flightNo;
    if (!targetFlightNo) return;

    let active = true;
    Promise.allSettled([getInboundPallets(targetFlightNo), getInboundLoadingPlans(targetFlightNo)])
      .then(([palletResponse, loadingResponse]) => {
        if (!active) return;

        if (palletResponse.status === 'fulfilled') {
          setPallets(
            (palletResponse.value?.data?.pallets || []).map((item) => ({
              ...item,
              entries: item.entries || item.items || []
            }))
          );
        } else {
          setPallets([]);
        }

        if (loadingResponse.status === 'fulfilled') {
          setLoadingPlans(loadingResponse.value?.data?.plans || []);
        } else {
          setLoadingPlans([]);
        }
      })
      .catch(() => {
        if (!active) return;
        setPallets([]);
        setLoadingPlans([]);
      });

    return () => {
      active = false;
    };
  }, [palletForm.flightNo, planForm.flightNo]);

  const createOfficePallet = async () => {
    const awbs = palletForm.awbs
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!palletForm.palletNo.trim() || !awbs.length) return;
    const existing = flightPallets.find((item) => item.palletNo === palletForm.palletNo.trim().toUpperCase());
    const payload = {
      pallet_no: palletForm.palletNo.trim().toUpperCase(),
      status: '待装车',
      total_boxes: Number(palletForm.totalBoxes || 0),
      total_weight: Number(palletForm.totalWeightKg || 0),
      storage_location: palletForm.storageLocation.trim() || 'MME-STAGE-99',
      items: awbs.map((awb) => ({ awb, boxes: 0, weight: 0 }))
    };

    if (existing) {
      await updateInboundPallet(existing.palletNo, payload);
    } else {
      await saveInboundPallet(palletForm.flightNo, payload);
    }
  };

  const createOfficeLoadingPlan = async () => {
    const palletNos = planForm.palletNos
      .split(/[,\n]/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    const linkedPallets = pallets.filter((item) => palletNos.includes(item.palletNo));
    const totalBoxes = linkedPallets.reduce((sum, item) => sum + (item.totalBoxes || 0), 0);
    const totalWeight = linkedPallets.reduce((sum, item) => sum + (item.totalWeightKg || 0), 0);

    if (!planForm.truckPlate.trim() || !planForm.collectionNote.trim()) return;
    const planId = planForm.id || `LOAD-OFFICE-${String(Date.now()).slice(-6)}`;
    const payload = {
      id: planId,
      truckPlate: planForm.truckPlate.trim().toUpperCase(),
      vehicleModel: 'Office Planned Vehicle',
      driverName: planForm.driverName.trim(),
      collectionNote: planForm.collectionNote.trim(),
      forkliftDriver: planForm.forkliftDriver.trim(),
      checker: planForm.checker.trim(),
      arrivalTime: planForm.arrivalTime,
      departTime: '',
      pallets: palletNos,
      totalBoxes,
      totalWeight: Number(totalWeight.toFixed(1)),
      status: '计划'
    };

    if (flightLoadingPlans.find((item) => item.id === planId)) {
      await updateInboundLoadingPlan(planId, payload);
    } else {
      await saveInboundLoadingPlan(planForm.flightNo, payload);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('进港 / 航班')}
          title={m('进港管理 / 航班管理')}
          description={m('按航班管理进港作业，逐航班推进落地、进港处理、理货、NOA、交付和二次转运，并为任务和文件联动提供入口。')}
          chips={[m('航班级作业'), m('单航班动作'), m('进港流程'), m('任务入口'), m('文件门槛')]}
          action={
            <Button component={RouterLink} to="/station/inbound/flights/new" variant="contained">
              {m('新建航班')}
            </Button>
          }
        />
      </Grid>

      {displayLifecycle.map((item, index) => {
        const progress = Math.max(15, 100 - index * 12);

        return (
          <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
            <ProgressMetricCard
              title={localizeUiText(locale, item.label)}
              value={localizeUiText(locale, `${item.count} / ${totalCount} 票`)}
              helper={localizeUiText(locale, item.note)}
              chip={localizeUiText(locale, `阶段 ${index + 1}`)}
              color={lifecycleColors[index] || 'primary'}
              progress={progress}
            />
          </Grid>
        );
      })}

      <Grid size={12}>
        <MainCard title={m('进港航班操作台')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('ETA')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
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
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.status)} />
                  </TableCell>
                  <TableCell>{localizeUiText(locale, item.step)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.priority)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.cargo)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button component={RouterLink} to={`/station/inbound/flights/${item.flightNo}`} size="small" variant="outlined">
                        {m('查看')}
                      </Button>
                      <Button component={RouterLink} to="/station/tasks" size="small" variant="outlined">
                        {m('任务')}
                      </Button>
                      <Button component={RouterLink} to="/station/documents" size="small" variant="outlined">
                        {m('单证')}
                      </Button>
                      <Button component={RouterLink} to="/station/shipments" size="small" variant="contained">
                        {m('链路')}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={inboundFlightPage?.total || inboundFlights.length}
            page={Math.max(0, (inboundFlightPage?.page || 1) - 1)}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
          />
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title={m('办公室预排进港执行')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('后台先完成')}</TableCell>
                <TableCell>{m('PDA 现场执行')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {officeInboundPlans.map((item) => (
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
        <MainCard title={m('后台托盘预排')}>
          <Stack sx={{ gap: 1.5 }}>
            <TextField
              select
              label={m('航班')}
              value={palletForm.flightNo}
              onChange={(event) => setPalletForm((prev) => ({ ...prev, flightNo: event.target.value }))}
            >
              {flightOptions.map((item) => (
                <MenuItem key={item.value} value={item.meta?.flight_no || item.value} disabled={item.disabled}>
                  {localizeUiText(locale, item.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={m('托盘号')}
              value={palletForm.palletNo}
              onChange={(event) => setPalletForm((prev) => ({ ...prev, palletNo: event.target.value }))}
            />
            <TextField
              label={m('计划 AWB')}
              value={palletForm.awbs}
              onChange={(event) => setPalletForm((prev) => ({ ...prev, awbs: event.target.value }))}
            />
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField
                label={m('总箱数')}
                value={palletForm.totalBoxes}
                onChange={(event) => setPalletForm((prev) => ({ ...prev, totalBoxes: event.target.value }))}
              />
              <TextField
                label={m('总重量')}
                value={palletForm.totalWeightKg}
                onChange={(event) => setPalletForm((prev) => ({ ...prev, totalWeightKg: event.target.value }))}
              />
            </Stack>
            <TextField
              label={m('存放位置')}
              value={palletForm.storageLocation}
              onChange={(event) => setPalletForm((prev) => ({ ...prev, storageLocation: event.target.value }))}
            />
            <Button variant="contained" onClick={createOfficePallet}>
              {m('保存托盘预排')}
            </Button>
            <Typography variant="caption" color="text.secondary">
              {m('保存后会同步到移动端“历史托盘 / 预计装载目标”。')}
            </Typography>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title={m('当前后台托盘')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('托盘号')}</TableCell>
                <TableCell>{m('存放位置')}</TableCell>
                <TableCell>{m('计划 AWB')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
                <TableCell align="right">{m('操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {flightPallets.map((item) => (
                <TableRow key={item.palletNo} hover>
                  <TableCell>{item.palletNo}</TableCell>
                  <TableCell>{item.storageLocation || '-'}</TableCell>
                  <TableCell>{(item.entries || []).map((entry) => entry.awb).join(' / ')}</TableCell>
                  <TableCell>{localizeUiText(locale, item.status)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        setPalletForm({
                          flightNo: item.flightNo,
                          palletNo: item.palletNo,
                          awbs: (item.entries || []).map((entry) => entry.awb).join(', '),
                          totalBoxes: String(item.totalBoxes || 0),
                          totalWeightKg: String(item.totalWeightKg || 0),
                          storageLocation: item.storageLocation || ''
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

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title={m('后台装车计划编排')}>
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField
                select
                label={m('航班')}
                value={planForm.flightNo}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, flightNo: event.target.value }))}
              >
                {flightOptions.map((item) => (
                  <MenuItem key={item.value} value={item.meta?.flight_no || item.value} disabled={item.disabled}>
                    {localizeUiText(locale, item.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={m('车牌')}
                value={planForm.truckPlate}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, truckPlate: event.target.value }))}
              />
            </Stack>
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField
                label={m('司机')}
                value={planForm.driverName}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, driverName: event.target.value }))}
              />
              <TextField
                label={m('提货单号')}
                value={planForm.collectionNote}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, collectionNote: event.target.value }))}
              />
            </Stack>
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField
                label={m('叉车司机')}
                value={planForm.forkliftDriver}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, forkliftDriver: event.target.value }))}
              />
              <TextField
                label={m('核对员')}
                value={planForm.checker}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, checker: event.target.value }))}
              />
            </Stack>
            <TextField
              label={m('预定托盘')}
              value={planForm.palletNos}
              onChange={(event) => setPlanForm((prev) => ({ ...prev, palletNos: event.target.value }))}
            />
            <TextField
              label={m('到场时间')}
              type="datetime-local"
              value={planForm.arrivalTime}
              onChange={(event) => setPlanForm((prev) => ({ ...prev, arrivalTime: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="contained" onClick={createOfficeLoadingPlan}>
              {m('保存装车计划')}
            </Button>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('车牌')}</TableCell>
                  <TableCell>{m('提货单号')}</TableCell>
                  <TableCell>{m('预定托盘')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {flightLoadingPlans.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.truckPlate}</TableCell>
                    <TableCell>{item.collectionNote}</TableCell>
                    <TableCell>{(item.pallets || []).join(' / ')}</TableCell>
                    <TableCell>{localizeUiText(locale, item.status)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          setPlanForm({
                            id: item.id,
                            flightNo: item.flightNo,
                            truckPlate: item.truckPlate,
                            driverName: item.driverName || '',
                            collectionNote: item.collectionNote || '',
                            forkliftDriver: item.forkliftDriver || '',
                            checker: item.checker || '',
                            arrivalTime: item.arrivalTime || '',
                            palletNos: (item.pallets || []).join(', ')
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
            <Typography variant="caption" color="text.secondary">
              {m('保存后会同步到移动端“预定装车计划 / 当前装车计划”。')}
            </Typography>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
