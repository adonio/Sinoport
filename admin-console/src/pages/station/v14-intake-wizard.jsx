import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  completeV14TransportLoading,
  createV14BorderOperation,
  createV14PortCalendar,
  createV14PrewarehouseReceipt,
  createV14TransportJob,
  createV14AwbIntake,
  lockV14VehicleDriver,
  publishV14PortCalendar,
  useV14Collection,
  useV14Resource,
  v14Endpoints,
  v14Post
} from 'api/v14';
import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';

const STEPS = ['录入 AWB', '前置仓收货', '卡车装运', '口岸准备'];

function futureInput(days) {
  const date = new Date(Date.now() + days * 86400000);
  return date.toISOString().slice(0, 16);
}

const INITIAL_FORM = {
  stationId: 'SZX', orderId: '', serviceLevel: 'P1', awbNo: '', hawbNo: '', flightId: '', shipperName: '', consigneeName: '',
  goodsDescription: '', pieces: '', weight: '', batchNo: '', deliveryRef: '', sourceVehiclePlate: '', cargoBarcodes: '', receiptEvidence: '',
  receiptReason: '', nextOwnerAccepted: true, plannedLoadingAt: '', plannedDepartureAt: '', plannedArrivalAt: '', vehiclePlate: '', driverName: '',
  driverPhone: '', sealNumber: '', borderEvidence: '', operationMode: 'SAME_VEHICLE', cnVehiclePlate: '', cnDriverName: '', kzVehiclePlate: '',
  kzDriverName: '', mappingSubmitter: '', handoverFrom: 'CN_CARRIER', handoverTo: 'KZ_CARRIER', calendarValidFrom: futureInput(0),
  calendarValidTo: futureInput(365), calendarNextVerifyAt: futureInput(30), calendarSourceRef: '', calendarConfirmer: ''
};

const INITIAL_CREATED = {
  shipmentId: '', awbId: '', receiptId: '', jobId: '', snapshotId: '', loaded: false, calendarId: '', calendarConfirmed: false,
  borderId: '', cnSnapshotId: '', kzSnapshotId: '', operationModeConfirmed: false, mappingId: '', reconciled: false
};

function rolesFor(user) {
  return new Set([...(user?.roleIds || []), user?.role].filter(Boolean));
}

function hasRole(roles, allowed) {
  return allowed.some((role) => roles.has(role));
}

function lines(value) {
  return String(value || '').split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
}

function dateValue(value) {
  return value ? new Date(value).toISOString() : undefined;
}

function operationError(error) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || '操作失败';
}

function flightLabel(item) {
  return `${item.flight_no || item.label || item.flight_id} · ${item.origin_code || 'SZX'} → ${item.destination_code || 'TAS'}`;
}

function shipmentLabel(item) {
  const awb = item.awb_no || item.awbs?.[0]?.awb_no || item.awb_ids?.[0] || '未关联 AWB';
  return `${awb} · ${item.shipment_id} · ${item.total_pieces || 0} pcs`;
}

export default function V14IntakeWizard({ open, onClose, user, onChanged }) {
  const roles = rolesFor(user);
  const roleSignature = [...roles].sort().join('|');
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [created, setCreated] = useState(INITIAL_CREATED);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const canIntake = hasRole(roles, ['platform_admin', 'station_supervisor', 'document_desk', 'A1_CARGO_CONTROLLER']);
  const canCreateReceipt = hasRole(roles, ['platform_admin', 'station_supervisor', 'PREWH_OPERATOR', 'A1_CARGO_CONTROLLER']);
  const canSubmitReceipt = hasRole(roles, ['platform_admin', 'station_supervisor', 'PREWH_OPERATOR']);
  const canApproveReceipt = hasRole(roles, ['platform_admin', 'station_supervisor', 'A1_CARGO_CONTROLLER']);
  const canCreateJob = hasRole(roles, ['platform_admin', 'station_supervisor', 'A1_CARGO_CONTROLLER']);
  const canLockVehicle = hasRole(roles, ['platform_admin', 'station_supervisor', 'TRUCK_OPERATOR', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER']);
  const canCompleteLoading = hasRole(roles, ['platform_admin', 'station_supervisor', 'PREWH_OPERATOR', 'A1_CARGO_CONTROLLER']);
  const canCreateBorder = hasRole(roles, ['platform_admin', 'station_supervisor', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER']);
  const canPrepareBorder = hasRole(roles, ['platform_admin', 'station_supervisor', 'A3_CROSS_BORDER_CONTROLLER']);
  const canCreateCalendar = hasRole(roles, ['platform_admin', 'OCC_DM', 'A3_CROSS_BORDER_CONTROLLER']);
  const canPublishCalendar = hasRole(roles, ['platform_admin', 'OCC_DM']);
  const canViewBorder = hasRole(roles, ['platform_admin', 'station_supervisor', 'TRUCK_OPERATOR', 'ALASHANKOU_AGENT', 'DOSTYK_AGENT', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER', 'OCC_DM']);

  const optionsPath = open && canIntake
    ? `${v14Endpoints.awbIntakeOptions}?station_id=${encodeURIComponent(form.stationId)}&limit=100`
    : null;
  const options = useV14Resource(optionsPath);
  const calendars = useV14Collection(open && canViewBorder ? v14Endpoints.portCalendars : null);
  const receiptDetail = useV14Resource(open && created.receiptId ? v14Endpoints.receipt(created.receiptId) : null);
  const jobDetail = useV14Resource(open && created.jobId ? v14Endpoints.job(created.jobId) : null);
  const borderDetail = useV14Resource(open && created.borderId ? v14Endpoints.border(created.borderId) : null);

  const flights = options.data?.flights || [];
  const existingShipments = options.data?.shipments || [];
  const barcodes = lines(form.cargoBarcodes);
  const pieces = Math.max(0, Number(form.pieces || 0));
  const weight = Math.max(0, Number(form.weight || 0));
  const receipt = receiptDetail.data?.receipt || null;
  const job = jobDetail.data?.job || null;
  const border = borderDetail.data?.border_operation || null;
  const primarySnapshot = jobDetail.data?.vehicle_driver_snapshots?.find((item) => item.snapshot_scope === 'PRIMARY' && item.active_flag);
  const effectiveSnapshotId = created.snapshotId || primarySnapshot?.vehicle_driver_snapshot_id || '';
  const currentCalendar = useMemo(
    () => calendars.items.find((item) => item.port_pair_code === 'ALASHANKOU_DOSTYK' && item.status === 'CONFIRMED' && new Date(item.next_verify_at).getTime() > Date.now()),
    [calendars.items]
  );
  const hasCurrentCalendar = Boolean(currentCalendar || created.calendarConfirmed);
  const entryBlockers = borderDetail.data?.entry_gate?.blockers || [];
  const completeSteps = [Boolean(created.shipmentId), Boolean(created.receiptId), Boolean(created.jobId && effectiveSnapshotId), Boolean(created.borderId)];

  // Keep the exhaustive-role signature available to React dev tools when accounts are switched in place.
  void roleSignature;

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const run = async (label, action, after) => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await action();
      if (after) await after(result);
      setFeedback({ severity: 'success', text: `${label}：${result.result || result.status || '已完成'}` });
      await onChanged?.();
      return result;
    } catch (error) {
      setFeedback({ severity: 'error', text: operationError(error) });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setActiveStep(0);
    setForm(INITIAL_FORM);
    setCreated(INITIAL_CREATED);
    setFeedback(null);
  };

  const resumeShipment = (shipmentId) => {
    const item = existingShipments.find((candidate) => candidate.shipment_id === shipmentId);
    if (!item) return;
    const firstAwb = item.awbs?.[0] || {};
    setForm((current) => ({
      ...current,
      flightId: firstAwb.flight_id || item.flight_id || current.flightId,
      awbNo: firstAwb.awb_no || item.awb_no || current.awbNo,
      pieces: item.total_pieces ?? current.pieces,
      weight: item.total_weight ?? current.weight
    }));
    setCreated((current) => ({
      ...current,
      shipmentId: item.shipment_id,
      awbId: firstAwb.awb_id || item.awb_ids?.[0] || '',
      receiptId: item.prewarehouse_receipt_id || '',
      jobId: item.transport_job_id || '',
      borderId: item.border_operation_id || ''
    }));
    setActiveStep(item.border_operation_id ? 3 : item.transport_job_id ? 2 : item.prewarehouse_receipt_id ? 1 : 0);
  };

  const generateBarcodes = () => {
    const prefix = form.awbNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!prefix || pieces < 1) return;
    const width = Math.max(3, String(pieces).length);
    setForm((current) => ({
      ...current,
      cargoBarcodes: Array.from({ length: pieces }, (_item, index) => `${prefix}-${String(index + 1).padStart(width, '0')}`).join('\n')
    }));
  };

  const copyBarcodes = async () => {
    await navigator.clipboard.writeText(barcodes.join('\n'));
    setFeedback({ severity: 'success', text: `已复制 ${barcodes.length} 个正式 CargoUnit 条码。` });
  };

  const createIntake = () => run('AWB 已录入并建立货物对象', () => createV14AwbIntake({
    station_id: form.stationId,
    order_id: form.orderId || undefined,
    shipment_type: 'CROSS_BORDER_AIR',
    service_level: form.serviceLevel,
    total_pieces: pieces,
    total_weight: weight,
    current_node: 'Front Warehouse Receiving',
    fulfillment_status: 'Front Warehouse Receiving',
    awb: {
      awb_no: form.awbNo.trim(),
      hawb_no: form.hawbNo || undefined,
      flight_id: form.flightId,
      shipper_name: form.shipperName || undefined,
      consignee_name: form.consigneeName || undefined,
      goods_description: form.goodsDescription || undefined,
      pieces,
      gross_weight: weight,
      awb_type: 'EXPORT'
    }
  }), async (result) => {
    setCreated((current) => ({ ...current, shipmentId: result.shipment_id, awbId: result.awb_id || '' }));
    await options.mutate();
    setActiveStep(1);
  });

  const createReceipt = () => run('前置仓收货批次已创建', () => createV14PrewarehouseReceipt({
    shipment_id: created.shipmentId,
    warehouse_station_id: form.stationId,
    batch_no: form.batchNo || undefined,
    source_delivery_ref: form.deliveryRef || undefined,
    source_vehicle_plate: form.sourceVehiclePlate || undefined,
    expected_pieces: pieces,
    expected_weight_kg: weight,
    baseline_source_type: 'MANUAL_AWB_INTAKE',
    baseline_source_ref: form.awbNo,
    cargo_units: barcodes.map((barcode, index) => ({
      barcode,
      awb_id: created.awbId || undefined,
      unit_sequence: index + 1,
      quantity: 1,
      expected_weight_kg: pieces ? Number((weight / pieces).toFixed(3)) : undefined
    }))
  }), async (result) => {
    setCreated((current) => ({ ...current, receiptId: result.receipt_session_id }));
    setActiveStep(1);
  });

  const submitReceipt = () => run('前置仓清点已提交主管复核', () => v14Post(`${v14Endpoints.receipt(created.receiptId)}/submit`), receiptDetail.mutate);
  const approveReceipt = () => run('前置仓 Gate 已完成', () => v14Post(`${v14Endpoints.receipt(created.receiptId)}/approve`, {
    evidence_ids: lines(form.receiptEvidence),
    next_owner_accepted: form.nextOwnerAccepted,
    reason: form.receiptReason || undefined
  }), async () => {
    await receiptDetail.mutate();
    setActiveStep(2);
  });

  const createJob = () => run('TransportJob 已创建', () => createV14TransportJob({
    shipment_id: created.shipmentId,
    flight_id: form.flightId,
    awb_ids: created.awbId ? [created.awbId] : [],
    station_id: form.stationId,
    route_template_code: 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2',
    planned_loading_at: dateValue(form.plannedLoadingAt),
    planned_departure_at: dateValue(form.plannedDepartureAt),
    planned_arrival_at: dateValue(form.plannedArrivalAt),
    production_mode: true
  }), async (result) => {
    setCreated((current) => ({ ...current, jobId: result.transport_job_id }));
    setActiveStep(2);
  });

  const lockPrimaryVehicle = () => run('主车辆与司机已锁定', () => lockV14VehicleDriver(created.jobId, {
    snapshot_scope: 'PRIMARY', vehicle_plate: form.vehiclePlate, driver_name: form.driverName,
    driver_phone_encrypted: form.driverPhone || undefined, seal_number: form.sealNumber || undefined,
    pieces, weight_kg: weight, effective_at: new Date().toISOString()
  }), async (result) => {
    setCreated((current) => ({ ...current, snapshotId: result.vehicle_driver_snapshot_id }));
    await jobDetail.mutate();
  });

  const completeLoading = () => run('装车已完成', () => completeV14TransportLoading(created.jobId, { loaded_at: new Date().toISOString() }), async () => {
    setCreated((current) => ({ ...current, loaded: true }));
    await jobDetail.mutate();
    setActiveStep(3);
  });

  const createCalendar = () => run('口岸服务日历已创建', () => createV14PortCalendar({
    port_pair_code: 'ALASHANKOU_DOSTYK', valid_from: dateValue(form.calendarValidFrom), valid_to: dateValue(form.calendarValidTo),
    timezone_cn: 'Asia/Urumqi', timezone_kz: 'Asia/Almaty', open_days: [1, 2, 3, 4, 5, 6, 7],
    daily_windows: [{ start: '00:00', end: '23:59' }], closure_periods: [], appointment_required: true,
    restrictions: {}, source_type: 'MANUAL_VERIFIED', source_ref: form.calendarSourceRef,
    next_verify_at: dateValue(form.calendarNextVerifyAt)
  }), async (result) => {
    setCreated((current) => ({ ...current, calendarId: result.calendar_id, calendarConfirmed: false }));
    await calendars.mutate();
  });

  const publishCalendar = () => run('口岸服务日历已发布', () => publishV14PortCalendar(created.calendarId, {
    confirmed_by: form.calendarConfirmer
  }), async () => {
    setCreated((current) => ({ ...current, calendarConfirmed: true }));
    await calendars.mutate();
  });

  const createBorder = () => run('双边口岸作业已创建', () => createV14BorderOperation({
    transport_job_id: created.jobId,
    planned_cn_arrival_at: dateValue(form.plannedArrivalAt)
  }), async (result) => {
    setCreated((current) => ({ ...current, borderId: result.border_operation_id }));
  });

  const createSideSnapshot = (side) => {
    const isCn = side === 'CN';
    return run(`${side} 车辆快照已锁定`, () => lockV14VehicleDriver(created.jobId, {
      snapshot_scope: `${side}_BORDER`,
      vehicle_plate: isCn ? form.cnVehiclePlate : form.kzVehiclePlate,
      driver_name: isCn ? form.cnDriverName : form.kzDriverName,
      seal_number: form.sealNumber,
      pieces,
      weight_kg: weight,
      effective_at: new Date().toISOString()
    }), async (result) => {
      setCreated((current) => ({ ...current, [isCn ? 'cnSnapshotId' : 'kzSnapshotId']: result.vehicle_driver_snapshot_id }));
      await jobDetail.mutate();
    });
  };

  const confirmOperationMode = () => run('口岸作业模式已确认', () => v14Post(`${v14Endpoints.border(created.borderId)}/operation-mode`, {
    operation_mode: form.operationMode,
    verification_status: 'CONFIRMED_WITH_EVIDENCE',
    evidence_ids: lines(form.borderEvidence),
    cn_vehicle_snapshot_id: created.cnSnapshotId,
    kz_vehicle_snapshot_id: created.kzSnapshotId,
    planned_pieces: pieces,
    planned_weight_kg: weight,
    seal_before: form.sealNumber,
    effective_at: new Date().toISOString()
  }), async () => {
    setCreated((current) => ({ ...current, operationModeConfirmed: true }));
    await borderDetail.mutate();
  });

  const createMapping = () => run('跨境车辆映射已复核', () => v14Post(`${v14Endpoints.border(created.borderId)}/vehicle-mappings`, {
    submitted_by: form.mappingSubmitter,
    cn_vehicle_snapshot_id: created.cnSnapshotId,
    kz_vehicle_snapshot_id: created.kzSnapshotId,
    mapping_type: form.operationMode,
    handover_party_from: form.handoverFrom,
    handover_party_to: form.handoverTo,
    pieces_match_result: 'MATCHED',
    weight_match_result: 'MATCHED',
    seal_match_result: 'MATCHED',
    evidence_ids: lines(form.borderEvidence),
    effective_at: new Date().toISOString()
  }), async (result) => {
    setCreated((current) => ({ ...current, mappingId: result.mapping_id }));
    await borderDetail.mutate();
  });

  const reconcileBorder = () => run('双边交接件重封志已核对', () => v14Post(`${v14Endpoints.border(created.borderId)}/transload-events`, {
    pieces_before: pieces, pieces_after: pieces, weight_before_kg: weight, weight_after_kg: weight,
    weight_tolerance_kg: 1, seal_before: form.sealNumber, seal_after: form.sealNumber,
    evidence_ids: lines(form.borderEvidence), occurred_at: new Date().toISOString()
  }), async () => {
    setCreated((current) => ({ ...current, reconciled: true }));
    await borderDetail.mutate();
  });

  const renderAwbStep = () => (
    <Stack sx={{ gap: 2 }}>
      <Alert severity="info">AWB 是业务录入对象；系统会同时建立其 Shipment 投影。航班必须先由 OCC/有权限人员创建并发布，B1 不编辑航班主数据。</Alert>
      {existingShipments.length ? (
        <TextField select label="接续已有货物对象（可选）" value="" onChange={(event) => resumeShipment(event.target.value)}>
          <MenuItem value="">请选择</MenuItem>
          {existingShipments.map((item) => <MenuItem key={item.shipment_id} value={item.shipment_id}>{shipmentLabel(item)}</MenuItem>)}
        </TextField>
      ) : null}
      <TextField required select label="已发布航班" value={form.flightId} onChange={change('flightId')} disabled={Boolean(created.shipmentId)}>
        <MenuItem value="">请选择航班</MenuItem>
        {flights.map((item) => <MenuItem key={item.flight_id} value={item.flight_id} disabled={item.disabled}>{flightLabel(item)}</MenuItem>)}
      </TextField>
      {!options.isLoading && !flights.length ? <Alert severity="warning">没有可用航班。请由 OCC_DM 或平台管理员先到“运行控制”创建并发布航班计划。</Alert> : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
        <TextField fullWidth required label="主运单号 AWB" value={form.awbNo} onChange={change('awbNo')} disabled={Boolean(created.shipmentId)} />
        <TextField fullWidth label="分运单号 HAWB" value={form.hawbNo} onChange={change('hawbNo')} disabled={Boolean(created.shipmentId)} />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
        <TextField fullWidth required type="number" label="件数" value={form.pieces} onChange={change('pieces')} disabled={Boolean(created.shipmentId)} />
        <TextField fullWidth required type="number" label="总重量 kg" value={form.weight} onChange={change('weight')} disabled={Boolean(created.shipmentId)} />
      </Stack>
      <TextField label="货物描述" value={form.goodsDescription} onChange={change('goodsDescription')} disabled={Boolean(created.shipmentId)} />
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
        <TextField fullWidth label="发货人" value={form.shipperName} onChange={change('shipperName')} disabled={Boolean(created.shipmentId)} />
        <TextField fullWidth label="收货人" value={form.consigneeName} onChange={change('consigneeName')} disabled={Boolean(created.shipmentId)} />
      </Stack>
      {created.shipmentId ? <Alert severity="success">已建立：{created.shipmentId} / {created.awbId || form.awbNo}</Alert> : null}
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" disabled={busy || !canIntake || !form.flightId || !form.awbNo.trim() || pieces < 1 || weight <= 0 || Boolean(created.shipmentId)} onClick={createIntake}>录入 AWB</Button>
      </Stack>
    </Stack>
  );

  const renderReceiptStep = () => (
    <Stack sx={{ gap: 2 }}>
      {!created.shipmentId ? <Alert severity="warning">请先完成 AWB 录入。</Alert> : null}
      <Alert severity="info">必须为每件货物建立正式 CargoUnit 条码。条码会提交到服务端，现场 PDA 只能扫描这份清单对应的任务。</Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
        <TextField fullWidth label="收货批次号（可选）" value={form.batchNo} onChange={change('batchNo')} disabled={Boolean(created.receiptId)} />
        <TextField fullWidth label="送货车辆" value={form.sourceVehiclePlate} onChange={change('sourceVehiclePlate')} disabled={Boolean(created.receiptId)} />
      </Stack>
      <TextField multiline minRows={8} label={`CargoUnit 条码（每行一个，必须 ${pieces || 0} 个）`} value={form.cargoBarcodes} onChange={change('cargoBarcodes')} disabled={Boolean(created.receiptId)} helperText={`当前 ${barcodes.length} / ${pieces || 0} 个`} />
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
        {!created.receiptId ? <Button onClick={generateBarcodes} disabled={!form.awbNo || pieces < 1}>按件数生成条码</Button> : null}
        {barcodes.length ? <Button onClick={copyBarcodes}>复制条码清单</Button> : null}
        {created.receiptId ? <Button component={RouterLink} to={`/mobile/pre-warehouse/${encodeURIComponent(created.receiptId)}`} variant="outlined">打开 PDA 扫描</Button> : null}
      </Stack>
      {!created.receiptId ? (
        <Stack direction="row" justifyContent="flex-end"><Button variant="contained" disabled={busy || !canCreateReceipt || !created.shipmentId || barcodes.length !== pieces} onClick={createReceipt}>创建前置仓收货批次</Button></Stack>
      ) : null}
      {receiptDetail.isLoading ? <LinearProgress /> : null}
      {receipt ? (
        <MainCard title={`收货批次 ${created.receiptId}`}>
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" justifyContent="space-between"><StatusChip label={receipt.status} /><Typography>{receipt.unique_received_pieces || 0} / {receipt.expected_pieces || pieces} pcs</Typography></Stack>
            {receipt.status === 'IN_PROGRESS' ? <Button disabled={busy || !canSubmitReceipt || Number(receipt.unique_received_pieces) !== Number(receipt.expected_pieces)} onClick={submitReceipt}>提交主管复核</Button> : null}
            {receipt.status === 'SUBMITTED' ? (
              <>
                <TextField required label="复核证据 ID（多个用逗号分隔）" value={form.receiptEvidence} onChange={change('receiptEvidence')} />
                <TextField label="复核说明" value={form.receiptReason} onChange={change('receiptReason')} />
                <FormControlLabel control={<Checkbox checked={form.nextOwnerAccepted} onChange={(event) => setForm((current) => ({ ...current, nextOwnerAccepted: event.target.checked }))} />} label="下一责任人已接受" />
                <Button variant="contained" disabled={busy || !canApproveReceipt || !lines(form.receiptEvidence).length || !form.nextOwnerAccepted} onClick={approveReceipt}>主管复核通过</Button>
              </>
            ) : null}
            {receipt.status === 'APPROVED' ? <Alert severity="success">前置仓 Gate 已通过，可以建立卡车运输任务。</Alert> : null}
          </Stack>
        </MainCard>
      ) : null}
    </Stack>
  );

  const renderTransportStep = () => (
    <Stack sx={{ gap: 2 }}>
      {receipt?.status !== 'APPROVED' ? <Alert severity="warning">前置仓收货必须先完成逐件扫描、提交并由主管复核通过。</Alert> : null}
      {!created.jobId ? (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
            <TextField fullWidth type="datetime-local" label="计划装车" value={form.plannedLoadingAt} onChange={change('plannedLoadingAt')} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth type="datetime-local" label="计划发车" value={form.plannedDepartureAt} onChange={change('plannedDepartureAt')} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <Button variant="contained" disabled={busy || !canCreateJob || receipt?.status !== 'APPROVED'} onClick={createJob}>创建 TransportJob（自动生成 21 节点）</Button>
        </>
      ) : null}
      {created.jobId ? (
        <MainCard title={`运输任务 ${created.jobId}`}>
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" justifyContent="space-between"><StatusChip label={job?.status || 'PLANNED'} /><Typography>{jobDetail.data?.checkpoints?.length || 0} 个节点</Typography></Stack>
            {!effectiveSnapshotId ? (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
                  <TextField fullWidth required label="主车辆车牌" value={form.vehiclePlate} onChange={change('vehiclePlate')} />
                  <TextField fullWidth required label="司机姓名" value={form.driverName} onChange={change('driverName')} />
                </Stack>
                <TextField required label="装车封志号" value={form.sealNumber} onChange={change('sealNumber')} />
                <Button variant="contained" disabled={busy || !canLockVehicle || !form.vehiclePlate || !form.driverName || !form.sealNumber} onClick={lockPrimaryVehicle}>锁定车辆、司机和封志</Button>
              </>
            ) : <Alert severity="success">车辆司机快照已锁定：{effectiveSnapshotId}</Alert>}
            {effectiveSnapshotId && !['LOADED', 'IN_TRANSIT', 'ARRIVED_TAS_STAGING'].includes(job?.status) ? <Button variant="contained" disabled={busy || !canCompleteLoading || receipt?.status !== 'APPROVED'} onClick={completeLoading}>确认完成装车</Button> : null}
            {['LOADED', 'IN_TRANSIT', 'ARRIVED_TAS_STAGING'].includes(job?.status) || created.loaded ? (
              <Alert severity="success" action={<Button component={RouterLink} to={`/mobile/headhaul/${encodeURIComponent(created.jobId)}`}>进入 21 节点</Button>}>装车已完成。现场人员可开始逐节点记录位置、证据和放行事实。</Alert>
            ) : null}
          </Stack>
        </MainCard>
      ) : null}
    </Stack>
  );

  const renderBorderStep = () => (
    <Stack sx={{ gap: 2 }}>
      {!created.jobId || !(['LOADED', 'IN_TRANSIT', 'ARRIVED_TAS_STAGING'].includes(job?.status) || created.loaded) ? <Alert severity="warning">必须先创建运输任务、锁定车辆司机并完成装车。</Alert> : null}
      <MainCard title="口岸服务日历">
        <Stack sx={{ gap: 1.5 }}>
          {currentCalendar ? <Alert severity="success">当前有效日历：{currentCalendar.calendar_id}，复核有效期至 {currentCalendar.next_verify_at}</Alert> : <Alert severity="warning">没有 current CONFIRMED 的阿拉山口—多斯特克服务日历，禁止创建生产口岸任务。</Alert>}
          {!hasCurrentCalendar && canCreateCalendar ? (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
                <TextField fullWidth required type="datetime-local" label="有效开始" value={form.calendarValidFrom} onChange={change('calendarValidFrom')} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField fullWidth required type="datetime-local" label="有效结束" value={form.calendarValidTo} onChange={change('calendarValidTo')} slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
              <TextField required type="datetime-local" label="下次复核时间" value={form.calendarNextVerifyAt} onChange={change('calendarNextVerifyAt')} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField required label="日历来源凭证" value={form.calendarSourceRef} onChange={change('calendarSourceRef')} />
              {!created.calendarId ? <Button disabled={busy || !form.calendarSourceRef} onClick={createCalendar}>创建待确认日历</Button> : null}
              {created.calendarId && !created.calendarConfirmed ? (
                <><TextField required label="独立确认人 ID（不能是当前发布人）" value={form.calendarConfirmer} onChange={change('calendarConfirmer')} /><Button variant="contained" disabled={busy || !canPublishCalendar || !form.calendarConfirmer || form.calendarConfirmer === user?.id} onClick={publishCalendar}>发布日历</Button></>
              ) : null}
            </>
          ) : null}
          {!hasCurrentCalendar && !canCreateCalendar ? <Alert severity="info">请交由 platform_admin、OCC_DM 或 A3 创建；发布必须由 platform_admin/OCC_DM 完成。</Alert> : null}
        </Stack>
      </MainCard>

      {!created.borderId ? <Button variant="contained" disabled={busy || !canCreateBorder || !hasCurrentCalendar || !created.jobId || !(['LOADED', 'IN_TRANSIT'].includes(job?.status) || created.loaded)} onClick={createBorder}>创建双边口岸作业</Button> : null}

      {created.borderId ? (
        <MainCard title={`口岸作业 ${created.borderId}`}>
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" justifyContent="space-between"><StatusChip label={border?.status || 'PLANNED'} /><Chip label={borderDetail.data?.entry_gate?.status || 'PREPARING'} color={entryBlockers.length ? 'warning' : 'success'} /></Stack>
            <TextField required label="口岸准备证据 ID（多个用逗号分隔）" value={form.borderEvidence} onChange={change('borderEvidence')} />
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
              <TextField fullWidth required label="中国侧车辆" value={form.cnVehiclePlate} onChange={change('cnVehiclePlate')} />
              <TextField fullWidth required label="中国侧司机" value={form.cnDriverName} onChange={change('cnDriverName')} />
              <Button disabled={busy || !canLockVehicle || !form.cnVehiclePlate || !form.cnDriverName || !form.sealNumber} onClick={() => createSideSnapshot('CN')}>{created.cnSnapshotId ? '已锁定' : '锁定 CN 快照'}</Button>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
              <TextField fullWidth required label="哈方车辆" value={form.kzVehiclePlate} onChange={change('kzVehiclePlate')} />
              <TextField fullWidth required label="哈方司机" value={form.kzDriverName} onChange={change('kzDriverName')} />
              <Button disabled={busy || !canLockVehicle || !form.kzVehiclePlate || !form.kzDriverName || !form.sealNumber} onClick={() => createSideSnapshot('KZ')}>{created.kzSnapshotId ? '已锁定' : '锁定 KZ 快照'}</Button>
            </Stack>
            <TextField select label="跨境操作模式" value={form.operationMode} onChange={change('operationMode')}>
              {['SAME_VEHICLE', 'TRACTOR_SWAP', 'TRAILER_HANDOVER', 'FULL_VEHICLE_SWAP', 'CARGO_TRANSLOAD', 'MIXED'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
            {!created.operationModeConfirmed ? <Button disabled={busy || !canPrepareBorder || !created.cnSnapshotId || !created.kzSnapshotId || !lines(form.borderEvidence).length} onClick={confirmOperationMode}>确认作业模式</Button> : null}
            {created.operationModeConfirmed && !created.mappingId ? (
              <><TextField required label="车辆映射原提交人 ID（必须与当前审批人不同）" value={form.mappingSubmitter} onChange={change('mappingSubmitter')} /><Button disabled={busy || !canPrepareBorder || !form.mappingSubmitter || form.mappingSubmitter === user?.id} onClick={createMapping}>复核车辆映射</Button></>
            ) : null}
            {created.mappingId && !created.reconciled ? <Button variant="contained" disabled={busy || !lines(form.borderEvidence).length} onClick={reconcileBorder}>核对交接件数、重量与封志</Button> : null}
            {entryBlockers.length ? <Alert severity="warning">中国出境 Gate 仍阻断：{entryBlockers.join('、')}</Alert> : null}
            {created.reconciled && !entryBlockers.length ? <Alert severity="success" action={<Button component={RouterLink} to={`/mobile/border/${encodeURIComponent(created.borderId)}`}>进入口岸现场</Button>}>口岸前置条件已齐全，可以按中国进场、放行、出境、多斯特克到场及哈方放行顺序执行。</Alert> : null}
          </Stack>
        </MainCard>
      ) : null}
    </Stack>
  );

  const content = [renderAwbStep, renderReceiptStep, renderTransportStep, renderBorderStep][activeStep];

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', md: 760 }, p: { xs: 2, md: 3 } }}>
        <Stack sx={{ gap: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ gap: 2 }}>
            <div><Typography variant="h3">跨境上游正式录入</Typography><Typography color="text.secondary">AWB → 前置仓 → 卡车 → 口岸；所有动作写入正式 API 和审计。</Typography></div>
            <Button onClick={onClose}>关闭</Button>
          </Stack>
          <Stepper activeStep={activeStep} alternativeLabel>
            {STEPS.map((label, index) => <Step key={label} completed={completeSteps[index]} onClick={() => setActiveStep(index)} sx={{ cursor: 'pointer' }}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>
          {options.isLoading || calendars.isLoading ? <LinearProgress /> : null}
          {feedback ? <Alert severity={feedback.severity}>{feedback.text}</Alert> : null}
          {content()}
          <Divider />
          <Stack direction="row" justifyContent="space-between">
            <Button color="error" onClick={reset} disabled={busy}>清空本次向导</Button>
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button disabled={activeStep === 0} onClick={() => setActiveStep((step) => step - 1)}>上一步</Button>
              <Button disabled={activeStep === STEPS.length - 1} onClick={() => setActiveStep((step) => step + 1)}>下一步</Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
}
