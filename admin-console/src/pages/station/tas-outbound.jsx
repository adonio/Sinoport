import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useV14Collection, useV14Resource, v14Endpoints, v14Post } from 'api/v14';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage } from 'utils/app-i18n';

const EMPTY_FLIGHT = { flight_no: '', std_at: '', aircraft_type: '', notes: '' };
const EMPTY_AWB = { awb_no: '', pieces: '', gross_weight: '', goods_description: '', provisional: false };
const EMPTY_TRUCK = { vehicle_plate: '', driver_name: '', eta_at: '', seal_expected: '', awb_id: '', planned_pieces: '', planned_weight_kg: '' };
const EMPTY_RECEIPT = { tas_truck_prealert_id: '', vehicle_plate: '', driver_name: '', seal_actual: '' };
const EMPTY_SCAN = { awb_id: '', barcode: '', weight_kg: '', condition_status: 'NORMAL' };
const EMPTY_ULD = { uld_code: '', uld_type: 'PMC', tare_weight_kg: '', max_gross_weight_kg: '', position_code: '' };
const EMPTY_GATE = { evidence: '', manifest_document_id: '', manifest_version: '1', airline_party_code: '', requested_by: '', position_code: '' };

function splitValues(value) {
  return String(value || '').split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

function localDateTimeValue() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function errorMessage(error) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Operation failed';
}

function asIso(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export default function TasOutboundPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const flights = useV14Collection(`${v14Endpoints.tasFlights}?page=1&page_size=100`, { refreshInterval: 15000 });
  const options = useV14Resource(v14Endpoints.tasOptions, { refreshInterval: 30000 });
  const [selectedId, setSelectedId] = useState('');
  const detail = useV14Resource(selectedId ? v14Endpoints.tasFlight(selectedId) : null, { refreshInterval: 10000 });
  const workspace = useV14Resource(selectedId ? v14Endpoints.tasFlightWorkspace(selectedId) : null, { refreshInterval: 10000 });
  const [flightForm, setFlightForm] = useState({ ...EMPTY_FLIGHT, std_at: localDateTimeValue() });
  const [awbForm, setAwbForm] = useState(EMPTY_AWB);
  const [truckForm, setTruckForm] = useState(EMPTY_TRUCK);
  const [truckAllocations, setTruckAllocations] = useState([]);
  const [receiptForm, setReceiptForm] = useState(EMPTY_RECEIPT);
  const [scanForm, setScanForm] = useState(EMPTY_SCAN);
  const [uldForm, setUldForm] = useState(EMPTY_ULD);
  const [gateForm, setGateForm] = useState(EMPTY_GATE);
  const [activeReceiptId, setActiveReceiptId] = useState('');
  const [selectedUldId, setSelectedUldId] = useState('');
  const [selectedCargoBarcode, setSelectedCargoBarcode] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const root = detail.data?.handling || workspace.data?.handling || null;
  const awbs = workspace.data?.awbs || [];
  const trucks = workspace.data?.trucks || [];
  const receipts = workspace.data?.direct_receipts || [];
  const cargoUnits = workspace.data?.cargo_units || [];
  const bulkItems = workspace.data?.bulk_items || [];
  const ulds = detail.data?.ulds || [];
  const availableCargo = detail.data?.available_cargo_units || [];
  const uldTypes = options.data?.uld_type || [];
  const activeReceipt = receipts.find((item) => item.tas_direct_receipt_session_id === activeReceiptId) || null;
  const activeUld = ulds.find((item) => item.tas_uld_id === selectedUldId && !item.archived_at) || null;
  const acceptedPieces = useMemo(
    () => receipts.filter((item) => ['ACCEPTED', 'CONDITIONAL_ACCEPTED'].includes(item.status))
      .flatMap((item) => item.lines || []).reduce((sum, line) => sum + Number(line.received_pieces || 0), 0),
    [receipts]
  );

  useEffect(() => {
    if (!selectedId && flights.items.length) setSelectedId(flights.items[0].tas_flight_handling_session_id);
  }, [flights.items, selectedId]);

  useEffect(() => {
    setTruckForm(EMPTY_TRUCK);
    setTruckAllocations([]);
  }, [selectedId]);

  useEffect(() => {
    if (activeReceiptId && !receipts.some((item) => item.tas_direct_receipt_session_id === activeReceiptId)) setActiveReceiptId('');
  }, [activeReceiptId, receipts]);

  useEffect(() => {
    const active = ulds.filter((item) => !item.archived_at);
    if (selectedUldId && active.some((item) => item.tas_uld_id === selectedUldId)) return;
    setSelectedUldId(active[0]?.tas_uld_id || '');
  }, [selectedUldId, ulds]);

  const refresh = async () => Promise.all([flights.mutate(), detail.mutate?.(), workspace.mutate?.(), options.mutate()]);

  const run = async (label, path, payload = {}) => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await v14Post(path, payload);
      setFeedback({ severity: 'success', text: `${m(label)}：${result.result || result.status || '已完成'}` });
      await refresh();
      return result;
    } catch (error) {
      setFeedback({ severity: 'error', text: errorMessage(error) });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createFlight = async () => {
    const result = await run('TAS–LGG 出港任务已建立', v14Endpoints.tasOutboundTasks, {
      flight_no: flightForm.flight_no,
      std_at: asIso(flightForm.std_at),
      aircraft_type: flightForm.aircraft_type || undefined,
      notes: flightForm.notes || undefined
    });
    if (!result) return;
    setSelectedId(result.tas_flight_handling_session_id);
    setFlightForm({ ...EMPTY_FLIGHT, std_at: localDateTimeValue() });
  };

  const createAwb = async () => {
    const result = await run(awbForm.provisional ? '现场临时提单已建立' : '货物预报已录入', v14Endpoints.tasFlightAwbs(selectedId), {
      awb_no: awbForm.awb_no,
      pieces: Number(awbForm.pieces || 0),
      gross_weight: Number(awbForm.gross_weight || 0),
      goods_description: awbForm.goods_description || undefined,
      provisional: awbForm.provisional
    });
    if (result) setAwbForm(EMPTY_AWB);
  };

  const createTruck = async () => {
    const pendingAllocation = truckForm.awb_id ? [{
      awb_id: truckForm.awb_id,
      planned_pieces: Number(truckForm.planned_pieces || 0),
      planned_weight_kg: Number(truckForm.planned_weight_kg || 0)
    }] : [];
    const allocationByAwb = new Map([...truckAllocations, ...pendingAllocation].map((item) => [item.awb_id, item]));
    const result = await run('卡车预报已录入', v14Endpoints.tasFlightTrucks(selectedId), {
      vehicle_plate: truckForm.vehicle_plate,
      driver_name: truckForm.driver_name || undefined,
      eta_at: asIso(truckForm.eta_at),
      seal_expected: truckForm.seal_expected || undefined,
      awb_allocations: [...allocationByAwb.values()]
    });
    if (result) {
      setTruckForm(EMPTY_TRUCK);
      setTruckAllocations([]);
    }
  };

  const addTruckAllocation = () => {
    if (!truckForm.awb_id) return;
    const allocation = {
      awb_id: truckForm.awb_id,
      planned_pieces: Number(truckForm.planned_pieces || 0),
      planned_weight_kg: Number(truckForm.planned_weight_kg || 0)
    };
    setTruckAllocations((current) => [...current.filter((item) => item.awb_id !== allocation.awb_id), allocation]);
    setTruckForm((current) => ({ ...current, awb_id: '', planned_pieces: '', planned_weight_kg: '' }));
  };

  const createReceipt = async () => {
    const selectedTruck = trucks.find((item) => item.tas_truck_prealert_id === receiptForm.tas_truck_prealert_id);
    const result = await run('现场收货清点已开始', v14Endpoints.tasFlightDirectReceipts(selectedId), {
      tas_truck_prealert_id: receiptForm.tas_truck_prealert_id || undefined,
      vehicle_plate: receiptForm.vehicle_plate || selectedTruck?.vehicle_plate,
      driver_name: receiptForm.driver_name || undefined,
      seal_actual: receiptForm.seal_actual || undefined
    });
    if (!result) return;
    setActiveReceiptId(result.tas_direct_receipt_session_id);
    setReceiptForm(EMPTY_RECEIPT);
  };

  const attachAwb = async (awbId) => {
    const result = await run('提单已加入当前收货批次', v14Endpoints.tasDirectReceiptAwbs(activeReceiptId), { awb_id: awbId });
    if (result) setScanForm((current) => ({ ...current, awb_id: awbId }));
  };

  const scanPiece = async () => {
    const result = await run('已清点 1 箱', v14Endpoints.tasDirectReceiptScans(activeReceiptId), {
      awb_id: scanForm.awb_id,
      barcode: scanForm.barcode || undefined,
      weight_kg: Number(scanForm.weight_kg || 0),
      condition_status: scanForm.condition_status,
      occurred_at: new Date().toISOString(),
      client_event_id: `tas-ui-${crypto.randomUUID()}`,
      device_id: 'TAS-WEB-PDA'
    });
    if (result) setScanForm((current) => ({ ...current, barcode: '', weight_kg: '' }));
  };

  const createUld = async () => {
    const result = await run('ULD 板号已建立', `${v14Endpoints.tasFlight(selectedId)}/ulds`, {
      uld_code: uldForm.uld_code,
      uld_type: uldForm.uld_type,
      tare_weight_kg: Number(uldForm.tare_weight_kg || 0),
      max_gross_weight_kg: uldForm.max_gross_weight_kg === '' ? undefined : Number(uldForm.max_gross_weight_kg),
      position_code: uldForm.position_code || undefined
    });
    if (!result) return;
    setSelectedUldId(result.tas_uld_id);
    setUldForm(EMPTY_ULD);
  };

  const assignCargo = async (mode) => {
    const path = mode === 'ULD'
      ? `${v14Endpoints.tasFlight(selectedId)}/ulds/${encodeURIComponent(selectedUldId)}/items`
      : v14Endpoints.tasFlightBulkItems(selectedId);
    const result = await run(mode === 'ULD' ? '货物已装入 ULD' : '货物已列为散货', path, {
      barcode: selectedCargoBarcode,
      position_code: gateForm.position_code || undefined
    });
    if (result) setSelectedCargoBarcode('');
  };

  const evidence = splitValues(gateForm.evidence);
  const handlingPath = v14Endpoints.tasFlight(selectedId);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="TAS Local Outbound"
          title="TAS–LGG 独立出港作业"
          description="以航班为主对象，在 TAS 站内完成货物与卡车预报、无预报现场建单、逐箱收货、ULD 组板/散货分配、逐个装机和起飞。无需先建 SZX、卡车运输任务或 OCC 计划。"
          chips={['航班先建', '预报可选', '逐箱清点', 'ULD + 散货', '逐项装机']}
          action={<Button component={RouterLink} to="/mobile/tas/flights" variant="outlined">{m('打开移动作业端')}</Button>}
        />
      </Grid>
      {feedback ? <Grid size={12}><Alert severity={feedback.severity}>{feedback.text}</Alert></Grid> : null}
      {(flights.isLoading || detail.isLoading || workspace.isLoading || busy) ? <Grid size={12}><LinearProgress /></Grid> : null}

      <Grid size={{ xs: 12, lg: 4 }}>
        <Stack sx={{ gap: 3 }}>
          <MainCard title="1. 建立 TAS–LGG 航班任务">
            <Stack sx={{ gap: 1.5 }}>
              <TextField label="航班号" value={flightForm.flight_no} onChange={(event) => setFlightForm({ ...flightForm, flight_no: event.target.value.toUpperCase() })} required />
              <TextField type="datetime-local" label="计划起飞时间" value={flightForm.std_at} onChange={(event) => setFlightForm({ ...flightForm, std_at: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} required />
              <TextField label="机型（可选）" value={flightForm.aircraft_type} onChange={(event) => setFlightForm({ ...flightForm, aircraft_type: event.target.value.toUpperCase() })} />
              <TextField label="备注" value={flightForm.notes} onChange={(event) => setFlightForm({ ...flightForm, notes: event.target.value })} multiline minRows={2} />
              <Button variant="contained" disabled={busy || !flightForm.flight_no || !flightForm.std_at} onClick={createFlight}>建立出港任务</Button>
            </Stack>
          </MainCard>
          <MainCard title={`航班任务 (${flights.total})`}>
            <Stack sx={{ gap: 1 }}>
              {flights.items.map((item) => (
                <Button key={item.tas_flight_handling_session_id} variant={selectedId === item.tas_flight_handling_session_id ? 'contained' : 'outlined'} onClick={() => setSelectedId(item.tas_flight_handling_session_id)} sx={{ justifyContent: 'space-between' }}>
                  <span>{item.flight_no} · {item.flight_date}</span><span>{item.status}</span>
                </Button>
              ))}
              {!flights.items.length && !flights.isLoading ? <Alert severity="info">当前没有 TAS–LGG 航班任务，请先建立航班。</Alert> : null}
            </Stack>
          </MainCard>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        {!root ? <Alert severity="info">选择或新建航班后即可开始操作。</Alert> : (
          <Stack sx={{ gap: 3 }}>
            <MainCard>
              <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Box><Typography variant="h3">{root.flight_no} · TAS → LGG</Typography><Typography color="text.secondary">{root.flight_date} · {root.tas_flight_handling_session_id}</Typography></Box>
                <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}><StatusChip label={root.status} /><Typography>{acceptedPieces} 件已接收</Typography></Stack>
              </Stack>
            </MainCard>

            <MainCard title="2. 货物预报 / 现场临时建单">
              <Alert severity="info" sx={{ mb: 2 }}>货物预报是可选的；无预报到货时勾选“现场临时建单”，先生成该航班下的提单，再逐箱扫描。</Alert>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="主提单号" value={awbForm.awb_no} onChange={(event) => setAwbForm({ ...awbForm, awb_no: event.target.value.toUpperCase() })} /></Grid>
                <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth type="number" label="预报件数" value={awbForm.pieces} onChange={(event) => setAwbForm({ ...awbForm, pieces: event.target.value })} /></Grid>
                <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth type="number" label="预报重量 kg" value={awbForm.gross_weight} onChange={(event) => setAwbForm({ ...awbForm, gross_weight: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="品名" value={awbForm.goods_description} onChange={(event) => setAwbForm({ ...awbForm, goods_description: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, md: 2 }}><Button fullWidth variant="contained" disabled={busy || !awbForm.awb_no} onClick={createAwb}>录入提单</Button></Grid>
                <Grid size={12}><FormControlLabel control={<Checkbox checked={awbForm.provisional} onChange={(event) => setAwbForm({ ...awbForm, provisional: event.target.checked, pieces: event.target.checked ? '' : awbForm.pieces, gross_weight: event.target.checked ? '' : awbForm.gross_weight })} />} label="现场临时建单（件数与重量由实际收货确认）" /></Grid>
              </Grid>
              <Table size="small" sx={{ mt: 2 }}><TableHead><TableRow><TableCell>AWB</TableCell><TableCell>状态</TableCell><TableCell>预报</TableCell><TableCell>实际主数据</TableCell></TableRow></TableHead><TableBody>
                {awbs.map((item) => <TableRow key={item.awb_id}><TableCell>{item.awb_no}</TableCell><TableCell><StatusChip label={item.forecast_status} /></TableCell><TableCell>{item.expected_pieces} pcs / {item.expected_weight_kg} kg</TableCell><TableCell>{item.pieces} pcs / {item.gross_weight} kg</TableCell></TableRow>)}
                {!awbs.length ? <TableRow><TableCell colSpan={4} align="center">尚未录入提单；也可以等车辆到场后再临时建单。</TableCell></TableRow> : null}
              </TableBody></Table>
            </MainCard>

            <MainCard title="3. 卡车预报（可选）">
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="车牌号" value={truckForm.vehicle_plate} onChange={(event) => setTruckForm({ ...truckForm, vehicle_plate: event.target.value.toUpperCase() })} /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="司机" value={truckForm.driver_name} onChange={(event) => setTruckForm({ ...truckForm, driver_name: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="datetime-local" label="预计到达" value={truckForm.eta_at} onChange={(event) => setTruckForm({ ...truckForm, eta_at: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="预报封志" value={truckForm.seal_expected} onChange={(event) => setTruckForm({ ...truckForm, seal_expected: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, md: 5 }}><TextField fullWidth select label="车内提单" value={truckForm.awb_id} onChange={(event) => {
                  const awb = awbs.find((item) => item.awb_id === event.target.value);
                  setTruckForm({ ...truckForm, awb_id: event.target.value, planned_pieces: awb?.expected_pieces || '', planned_weight_kg: awb?.expected_weight_kg || '' });
                }}><MenuItem value="">不预报车内货物</MenuItem>{awbs.map((item) => <MenuItem key={item.awb_id} value={item.awb_id}>{item.awb_no}</MenuItem>)}</TextField></Grid>
                <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth type="number" label="件数" value={truckForm.planned_pieces} onChange={(event) => setTruckForm({ ...truckForm, planned_pieces: event.target.value })} /></Grid>
                <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth type="number" label="重量 kg" value={truckForm.planned_weight_kg} onChange={(event) => setTruckForm({ ...truckForm, planned_weight_kg: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><Button fullWidth variant="outlined" disabled={busy || !truckForm.awb_id} onClick={addTruckAllocation}>加入车内货物清单</Button></Grid>
                {truckAllocations.length ? <Grid size={12}><Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, flexWrap: 'wrap' }}>{truckAllocations.map((allocation) => {
                  const awb = awbs.find((item) => item.awb_id === allocation.awb_id);
                  return <Alert key={allocation.awb_id} severity="info" action={<Button size="small" onClick={() => setTruckAllocations((current) => current.filter((item) => item.awb_id !== allocation.awb_id))}>移除</Button>}>{awb?.awb_no || allocation.awb_id} · {allocation.planned_pieces} pcs / {allocation.planned_weight_kg} kg</Alert>;
                })}</Stack></Grid> : null}
                <Grid size={12}><Button variant="contained" disabled={busy || !truckForm.vehicle_plate} onClick={createTruck}>保存卡车预报（{truckAllocations.length + (truckForm.awb_id ? 1 : 0)} 票货物）</Button></Grid>
              </Grid>
              <Stack sx={{ gap: 1, mt: 2 }}>{trucks.map((item) => <Alert key={item.tas_truck_prealert_id} severity="info">{item.vehicle_plate} · {item.driver_name || '未填司机'} · {item.status} · {(item.awbs || []).map((line) => `${line.awb_no} ${line.planned_pieces} pcs / ${line.planned_weight_kg} kg`).join('；') || '未预报车内提单'}</Alert>)}</Stack>
            </MainCard>

            <MainCard title="4. 现场收货与逐箱清点">
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="选择预报车辆（可空）" value={receiptForm.tas_truck_prealert_id} onChange={(event) => setReceiptForm({ ...receiptForm, tas_truck_prealert_id: event.target.value })}><MenuItem value="">无预报车辆直接收货</MenuItem>{trucks.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status)).map((item) => <MenuItem key={item.tas_truck_prealert_id} value={item.tas_truck_prealert_id}>{item.vehicle_plate} · {item.status}</MenuItem>)}</TextField></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="现场车牌" value={receiptForm.vehicle_plate} onChange={(event) => setReceiptForm({ ...receiptForm, vehicle_plate: event.target.value.toUpperCase() })} helperText="无预报时必填" /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="实际封志" value={receiptForm.seal_actual} onChange={(event) => setReceiptForm({ ...receiptForm, seal_actual: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, md: 2 }}><Button fullWidth variant="contained" disabled={busy || (!receiptForm.tas_truck_prealert_id && !receiptForm.vehicle_plate)} onClick={createReceipt}>开始收货</Button></Grid>
              </Grid>
              <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mt: 2, flexWrap: 'wrap' }}>{receipts.map((item) => <Button key={item.tas_direct_receipt_session_id} variant={activeReceiptId === item.tas_direct_receipt_session_id ? 'contained' : 'outlined'} onClick={() => setActiveReceiptId(item.tas_direct_receipt_session_id)}>{item.vehicle_plate} · {item.status}</Button>)}</Stack>
              {activeReceipt ? <Stack sx={{ gap: 1.5, mt: 2 }}>
                <Divider />
                <Typography variant="h5">当前收货批次：{activeReceipt.vehicle_plate} · {activeReceipt.status}</Typography>
                {activeReceipt.status === 'COUNTING' ? <>
                  <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1 }}><TextField fullWidth select label="加入提单" value="" onChange={(event) => attachAwb(event.target.value)}><MenuItem value="">请选择</MenuItem>{awbs.filter((item) => !(activeReceipt.lines || []).some((line) => line.awb_id === item.awb_id)).map((item) => <MenuItem key={item.awb_id} value={item.awb_id}>{item.awb_no}</MenuItem>)}</TextField></Stack>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="正在清点的提单" value={scanForm.awb_id} onChange={(event) => setScanForm({ ...scanForm, awb_id: event.target.value })}><MenuItem value="">请选择</MenuItem>{(activeReceipt.lines || []).map((line) => <MenuItem key={line.awb_id} value={line.awb_id}>{line.awb_no} · 已点 {line.received_pieces}/{line.expected_pieces || '未预报'}</MenuItem>)}</TextField></Grid>
                    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="箱码（可空，系统自动生成）" value={scanForm.barcode} onChange={(event) => setScanForm({ ...scanForm, barcode: event.target.value.toUpperCase() })} /></Grid>
                    <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth type="number" label="本箱重量 kg" value={scanForm.weight_kg} onChange={(event) => setScanForm({ ...scanForm, weight_kg: event.target.value })} /></Grid>
                    <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth select label="外观" value={scanForm.condition_status} onChange={(event) => setScanForm({ ...scanForm, condition_status: event.target.value })}>{['NORMAL', 'DAMAGED', 'WET', 'OPENED', 'DEFORMED', 'LABEL_ISSUE', 'OTHER'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid>
                    <Grid size={{ xs: 12, md: 1 }}><Button fullWidth variant="contained" disabled={busy || !scanForm.awb_id} onClick={scanPiece}>+1 箱</Button></Grid>
                  </Grid>
                  <Button variant="outlined" disabled={busy || !(activeReceipt.lines || []).some((line) => Number(line.received_pieces) > 0)} onClick={() => run('收货清点已提交复核', v14Endpoints.tasDirectReceiptSubmit(activeReceiptId), {})}>提交主管复核</Button>
                </> : null}
                {activeReceipt.status === 'SUBMITTED' ? <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1 }}><TextField fullWidth label="收货证据 ID（可逗号分隔）" value={gateForm.evidence} onChange={(event) => setGateForm({ ...gateForm, evidence: event.target.value })} /><Button variant="contained" disabled={busy || !gateForm.evidence} onClick={() => run('收货已验收并释放货物', v14Endpoints.tasDirectReceiptDecision(activeReceiptId), { decision: 'PASS', evidence_ids: evidence })}>主管通过</Button><Button color="warning" variant="outlined" disabled={busy || !gateForm.evidence} onClick={() => run('收货已条件验收', v14Endpoints.tasDirectReceiptDecision(activeReceiptId), { decision: 'CONDITIONAL_PASS', reason: '现场差异接受', evidence_ids: evidence })}>条件通过</Button></Stack> : null}
                <Table size="small"><TableHead><TableRow><TableCell>AWB</TableCell><TableCell>预报件数</TableCell><TableCell>实收件数</TableCell><TableCell>实收重量</TableCell><TableCell>异常件数</TableCell></TableRow></TableHead><TableBody>{(activeReceipt.lines || []).map((line) => <TableRow key={line.tas_direct_receipt_line_id}><TableCell>{line.awb_no}</TableCell><TableCell>{line.expected_pieces}</TableCell><TableCell>{line.received_pieces}</TableCell><TableCell>{line.received_weight_kg} kg</TableCell><TableCell>{line.exception_pieces}</TableCell></TableRow>)}</TableBody></Table>
              </Stack> : null}
            </MainCard>

            <MainCard title="5. ULD 组板与散货分配">
              <Alert severity="info" sx={{ mb: 2 }}>收货与组板可以并行；只有已通过收货复核并释放的箱件才能装入 ULD 或列为散货。</Alert>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="ULD 板号" value={uldForm.uld_code} onChange={(event) => setUldForm({ ...uldForm, uld_code: event.target.value.toUpperCase() })} /></Grid>
                <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth select label="ULD 类型" value={uldForm.uld_type} onChange={(event) => setUldForm({ ...uldForm, uld_type: event.target.value })}>{uldTypes.length ? uldTypes.map((item) => <MenuItem key={item.value} value={item.value}>{item.label_zh || item.label}</MenuItem>) : ['PMC', 'PAG', 'AKE'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid>
                <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth type="number" label="皮重 kg" value={uldForm.tare_weight_kg} onChange={(event) => setUldForm({ ...uldForm, tare_weight_kg: event.target.value })} /></Grid>
                <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth type="number" label="最大总重 kg" value={uldForm.max_gross_weight_kg} onChange={(event) => setUldForm({ ...uldForm, max_gross_weight_kg: event.target.value })} /></Grid>
                <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth label="机位" value={uldForm.position_code} onChange={(event) => setUldForm({ ...uldForm, position_code: event.target.value.toUpperCase() })} /></Grid>
                <Grid size={{ xs: 12, md: 1 }}><Button fullWidth variant="outlined" disabled={busy || !uldForm.uld_code || !uldForm.uld_type} onClick={createUld}>建板</Button></Grid>
              </Grid>
              <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mt: 2, flexWrap: 'wrap' }}>{ulds.filter((item) => !item.archived_at).map((uld) => <Button key={uld.tas_uld_id} variant={selectedUldId === uld.tas_uld_id ? 'contained' : 'outlined'} onClick={() => setSelectedUldId(uld.tas_uld_id)}>{uld.uld_code} · {uld.piece_count} pcs · {uld.actual_gross_weight_kg} kg · {uld.status}</Button>)}</Stack>
              <Grid container spacing={1.5} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="待分配箱件" value={selectedCargoBarcode} onChange={(event) => setSelectedCargoBarcode(event.target.value)}><MenuItem value="">请选择已释放箱件</MenuItem>{availableCargo.map((item) => <MenuItem key={item.cargo_unit_id} value={item.barcode}>{item.barcode} · {item.awb_no} · {item.actual_weight_kg || 0} kg</MenuItem>)}</TextField></Grid>
                <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="散货/装机位置" value={gateForm.position_code} onChange={(event) => setGateForm({ ...gateForm, position_code: event.target.value.toUpperCase() })} /></Grid>
                <Grid size={{ xs: 6, md: 2 }}><Button fullWidth variant="contained" disabled={busy || !selectedCargoBarcode || !activeUld} onClick={() => assignCargo('ULD')}>装入 {activeUld?.uld_code || 'ULD'}</Button></Grid>
                <Grid size={{ xs: 6, md: 2 }}><Button fullWidth variant="outlined" disabled={busy || !selectedCargoBarcode} onClick={() => assignCargo('BULK')}>列为散货</Button></Grid>
              </Grid>
              <Table size="small" sx={{ mt: 2 }}><TableHead><TableRow><TableCell>方式</TableCell><TableCell>箱码</TableCell><TableCell>AWB</TableCell><TableCell>件数</TableCell><TableCell>重量</TableCell><TableCell>状态</TableCell></TableRow></TableHead><TableBody>
                {ulds.filter((item) => !item.archived_at).flatMap((uld) => (uld.items || []).filter((item) => item.status !== 'REMOVED').map((item) => <TableRow key={item.tas_uld_item_id}><TableCell>{uld.uld_code}</TableCell><TableCell>{item.barcode}</TableCell><TableCell>{item.awb_no}</TableCell><TableCell>{item.piece_count}</TableCell><TableCell>{item.weight_kg} kg</TableCell><TableCell>{item.status}</TableCell></TableRow>))}
                {bulkItems.filter((item) => !item.removed_at).map((item) => <TableRow key={item.tas_bulk_load_item_id}><TableCell>散货 {item.position_code || ''}</TableCell><TableCell>{item.barcode}</TableCell><TableCell>{item.awb_no}</TableCell><TableCell>{item.piece_count}</TableCell><TableCell>{item.weight_kg} kg</TableCell><TableCell>{item.status}</TableCell></TableRow>)}
              </TableBody></Table>
            </MainCard>

            <MainCard title="6. 收货关闭、Manifest、交航、逐项装机与起飞">
              <Stack sx={{ gap: 1.5 }}>
                <TextField label="操作证据 ID（多个用逗号分隔）" value={gateForm.evidence} onChange={(event) => setGateForm({ ...gateForm, evidence: event.target.value })} />
                {root.status === 'PLANNING' ? <Button variant="contained" disabled={busy || !gateForm.evidence} onClick={() => run('收货已关闭，进入组板结算', `${handlingPath}/receiving/close`, { evidence_ids: evidence, occurred_at: new Date().toISOString() })}>确认最后一车 / 关闭收货</Button> : null}
                {root.status === 'BUILDUP' ? <Button variant="contained" disabled={busy || !gateForm.evidence} onClick={() => run('ULD 与散货组装已完成', `${handlingPath}/buildup/complete`, { evidence_ids: evidence, occurred_at: new Date().toISOString() })}>完成组板与散货分配</Button> : null}
                {root.status === 'BUILT_UP' ? <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1 }}><TextField fullWidth label="Manifest 文档 ID" value={gateForm.manifest_document_id} onChange={(event) => setGateForm({ ...gateForm, manifest_document_id: event.target.value })} /><TextField label="版本" value={gateForm.manifest_version} onChange={(event) => setGateForm({ ...gateForm, manifest_version: event.target.value })} /><Button variant="contained" disabled={busy || !gateForm.evidence || !gateForm.manifest_document_id} onClick={() => run('Manifest 已冻结', `${handlingPath}/manifest/finalize`, { manifest_document_id: gateForm.manifest_document_id, manifest_version: gateForm.manifest_version, evidence_ids: evidence })}>冻结 Manifest</Button></Stack> : null}
                {root.status === 'MANIFEST_FROZEN' ? <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1 }}><TextField fullWidth label="航空公司代码" value={gateForm.airline_party_code} onChange={(event) => setGateForm({ ...gateForm, airline_party_code: event.target.value.toUpperCase() })} /><Button variant="contained" disabled={busy || !gateForm.evidence || !gateForm.airline_party_code} onClick={() => run('ULD 与散货已交航司', `${handlingPath}/handover`, { airline_party_code: gateForm.airline_party_code, next_owner_accepted: true, evidence_ids: evidence })}>确认交航</Button></Stack> : null}
                {root.status === 'HANDED_TO_AIRLINE' ? <>
                  <Typography variant="h5">逐项装机确认</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, flexWrap: 'wrap' }}>{ulds.filter((item) => !item.archived_at).map((uld) => <Button key={uld.tas_uld_id} color={uld.status === 'LOADED' ? 'success' : 'primary'} variant={uld.status === 'LOADED' ? 'outlined' : 'contained'} disabled={busy || uld.status === 'LOADED' || !gateForm.evidence} onClick={() => run(`${uld.uld_code} 已装机`, v14Endpoints.tasFlightLoadUld(selectedId, uld.tas_uld_id), { position_code: uld.position_code || gateForm.position_code, evidence_ids: evidence })}>{uld.uld_code} · {uld.status === 'LOADED' ? '已装机' : '确认装机'}</Button>)}</Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, flexWrap: 'wrap' }}>{bulkItems.filter((item) => !item.removed_at).map((item) => <Button key={item.tas_bulk_load_item_id} color={item.status === 'LOADED' ? 'success' : 'primary'} variant={item.status === 'LOADED' ? 'outlined' : 'contained'} disabled={busy || item.status === 'LOADED' || !gateForm.evidence} onClick={() => run(`${item.barcode} 散货已装机`, v14Endpoints.tasFlightLoadBulk(selectedId, item.tas_bulk_load_item_id), { position_code: item.position_code || gateForm.position_code, evidence_ids: evidence })}>{item.barcode} · {item.status === 'LOADED' ? '已装机' : '确认散货装机'}</Button>)}</Stack>
                  <Button variant="contained" color="success" disabled={busy || !gateForm.evidence} onClick={() => run('飞机装载已关闭', `${handlingPath}/loading/complete`, { evidence_ids: evidence, occurred_at: new Date().toISOString() })}>所有 ULD/散货装完，关闭装机</Button>
                </> : null}
                {root.status === 'LOADED' ? <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1 }}><TextField fullWidth label="起飞确认提交人 ID" value={gateForm.requested_by} onChange={(event) => setGateForm({ ...gateForm, requested_by: event.target.value })} /><Button variant="contained" color="success" disabled={busy || !gateForm.evidence || !gateForm.requested_by} onClick={() => run('航班已确认起飞', `${handlingPath}/departure`, { requested_by: gateForm.requested_by, next_owner_accepted: true, evidence_ids: evidence, occurred_at: new Date().toISOString() })}>确认实际起飞</Button></Stack> : null}
                {root.status === 'DEPARTED' ? <Alert severity="success">本次 TAS–LGG 出港任务已完成：收货、组板/散货、Manifest、装机及起飞记录均已持久化。</Alert> : null}
              </Stack>
            </MainCard>

            <MainCard title="箱件台账">
              <Table size="small"><TableHead><TableRow><TableCell>箱码</TableCell><TableCell>AWB</TableCell><TableCell>重量</TableCell><TableCell>外观</TableCell><TableCell>库存状态</TableCell><TableCell>当前位置</TableCell></TableRow></TableHead><TableBody>{cargoUnits.map((item) => <TableRow key={item.cargo_unit_id}><TableCell>{item.business_barcode}</TableCell><TableCell>{item.awb_no}</TableCell><TableCell>{item.actual_weight_kg || 0} kg</TableCell><TableCell>{item.condition_status}</TableCell><TableCell>{item.inventory_state}</TableCell><TableCell>{item.current_location_type} / {item.current_location_id}</TableCell></TableRow>)}</TableBody></Table>
            </MainCard>
          </Stack>
        )}
      </Grid>
    </Grid>
  );
}
