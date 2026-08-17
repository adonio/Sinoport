import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
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

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';
import { useV14Collection, useV14Resource, v14Delete, v14Endpoints, v14Post } from 'api/v14';
import { localizeMobileText, readMobileLanguage } from 'utils/mobile/i18n';
import { readMobileSession } from 'utils/mobile/session';

const configs = {
  prewarehouse: { title: '前置仓逐件清点', list: v14Endpoints.receipts, detail: v14Endpoints.receipt, id: 'receipt_session_id', base: '/mobile/pre-warehouse' },
  transport: { title: '卡车节点持续跟踪', list: v14Endpoints.jobs, detail: v14Endpoints.job, id: 'transport_job_id', base: '/mobile/headhaul' },
  border: { title: '阿拉山口 / 多斯特克作业', list: v14Endpoints.borders, detail: v14Endpoints.border, id: 'border_operation_id', base: '/mobile/border' },
  tas: { title: 'TAS 机场逐件清点', list: `${v14Endpoints.tasReceipts}?page=1&page_size=20`, detail: v14Endpoints.tasReceipt, id: 'airport_receipt_session_id', base: '/mobile/tas' },
  tasFlight: { title: 'TAS 航班处理', list: `${v14Endpoints.tasFlights}?page=1&page_size=20`, detail: v14Endpoints.tasFlight, id: 'tas_flight_handling_session_id', base: '/mobile/tas/flights' }
};

const OFFLINE_KEY = 'sinoport-v14-offline-events';

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); } catch { return []; }
}

function saveQueue(items) {
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(items));
}

function identity(kind, item, config) {
  return item[config.id] || item.transport_job_id || item.shipment_id || `${kind}-${item.updated_at}`;
}

function dateTime(value) {
  if (!value) return '--';
  const valueDate = new Date(value);
  return Number.isNaN(valueDate.getTime()) ? String(value) : valueDate.toLocaleString([], { hour12: false });
}

function splitValues(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function optionLabel(option, language) {
  return language === 'en' ? option.label_en || option.label : option.label_zh || option.label;
}

export function V14MobileListPage({ kind }) {
  const config = configs[kind];
  const navigate = useNavigate();
  const resource = useV14Collection(config.list, { refreshInterval: 15000 });
  const language = readMobileLanguage();
  const m = (value) => localizeMobileText(language, value);
  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard>
        <Stack sx={{ gap: 1 }}>
          <Typography variant="h4">{m(config.title)}</Typography>
          <Typography variant="body2" color="text.secondary">{m('实时业务对象与服务端权限绑定；页面不使用演示任务或本地假状态。')}</Typography>
          {kind === 'tas' ? <Button variant="contained" onClick={() => navigate('/mobile/tas/flights')}>{m('进入 TAS 航班处理')}</Button> : null}
          {kind === 'tasFlight' ? <Button variant="outlined" onClick={() => navigate('/mobile/tas')}>{m('返回 TAS 收货任务')}</Button> : null}
        </Stack>
      </MainCard>
      {resource.isLoading ? <LinearProgress /> : null}
      {resource.error ? <Alert severity="error">{resource.error?.response?.data?.error?.message || resource.error.message}</Alert> : null}
      {resource.items.map((item) => {
        const id = identity(kind, item, config);
        return (
          <MainCard key={id} onClick={() => navigate(`${config.base}/${encodeURIComponent(id)}`)} sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
            <Stack sx={{ gap: 1 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}><Typography variant="h5">{id}</Typography><StatusChip label={item.status || item.health_state || 'UNKNOWN'} /></Stack>
              <Typography variant="body2">
                {kind === 'tasFlight'
                  ? `${m('航班')} ${item.flight_no || item.flight_id || '--'} · TAS-${item.destination_code || 'LGG'} · ${m('收货任务')} ${item.receipt_count || 0}`
                  : `Shipment: ${item.shipment_id || '--'}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">{m('更新：')}{dateTime(item.updated_at || item.last_location_at)}</Typography>
              <Button variant="outlined">{m('进入现场作业')}</Button>
            </Stack>
          </MainCard>
        );
      })}
      {!resource.isLoading && !resource.items.length ? <Alert severity="info">{m('当前没有待处理业务对象。')}</Alert> : null}
    </Stack>
  );
}

export function V14MobileDetailPage({ kind, itemId }) {
  const config = configs[kind];
  const navigate = useNavigate();
  const mobileSession = readMobileSession();
  const tasSupervisorRoles = ['platform_admin', 'station_supervisor', 'B1_TAS_STATION_CONTROLLER', 'DQC_DATA_QUALITY_CONTROLLER'];
  const canSuperviseTas = mobileSession?.roleKey === 'supervisor' || (mobileSession?.roleIds || []).some((role) => tasSupervisorRoles.includes(role));
  const resource = useV14Resource(config.detail(itemId), { refreshInterval: 10000 });
  const workspaceResource = useV14Resource(kind === 'tasFlight' ? v14Endpoints.tasFlightWorkspace(itemId) : null, { refreshInterval: 10000 });
  const optionsResource = useV14Resource(kind === 'tas' || kind === 'tasFlight' ? v14Endpoints.tasOptions : null);
  const [form, setForm] = useState({
    barcode: '', weight: '', latitude: '', longitude: '', place: '', seal: '', checkpoint: '', maker: '', evidence: '',
    decision: 'PASS', reason: '', cargoUnitIds: '', expiresAt: '', uldCode: '', uldType: '', positionCode: '',
    tareWeight: '120', maxGrossWeight: '6800', selectedUldId: '', selectedCargoBarcode: '', manifestDocumentId: '',
    manifestVersion: '1', airlineParty: '', provisionalAwbNo: '', directVehiclePlate: '', directReceiptId: '',
    directAwbId: '', directBarcode: '', directWeight: '', directCondition: 'NORMAL', bulkPositionCode: ''
  });
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [queueCount, setQueueCount] = useState(() => loadQueue().length);
  const root = resource.data?.handling || resource.data?.receipt || resource.data?.job || resource.data?.border || resource.data || {};
  const cargoUnits = resource.data?.cargo_units || [];
  const availableCargoUnits = resource.data?.available_cargo_units || [];
  const ulds = resource.data?.ulds || [];
  const milestones = resource.data?.milestones || [];
  const directAwbs = workspaceResource.data?.awbs || [];
  const directReceipts = workspaceResource.data?.direct_receipts || [];
  const bulkItems = workspaceResource.data?.bulk_items || [];
  const directReceipt = directReceipts.find((item) => item.tas_direct_receipt_session_id === form.directReceiptId) || directReceipts[0] || null;
  const tasOptions = optionsResource.data || {};
  const activeUlds = useMemo(() => ulds.filter((item) => !item.archived_at && item.status !== 'VOIDED'), [ulds]);
  const selectedUld = activeUlds.find((item) => item.tas_uld_id === form.selectedUldId) || activeUlds[0] || null;
  const checkpoints = resource.data?.checkpoints || [];
  const pendingCheckpoints = checkpoints.filter((item) => !['ARRIVED', 'DEPARTED', 'WAIVED'].includes(item.status));

  useEffect(() => {
    if (!form.checkpoint && pendingCheckpoints.length) setForm((current) => ({ ...current, checkpoint: pendingCheckpoints[0].checkpoint_code }));
  }, [form.checkpoint, pendingCheckpoints]);

  useEffect(() => {
    if (!form.selectedUldId && activeUlds.length) setForm((current) => ({ ...current, selectedUldId: activeUlds[0].tas_uld_id }));
  }, [activeUlds, form.selectedUldId]);

  useEffect(() => {
    if (kind !== 'tasFlight' || form.directReceiptId || !directReceipts.length) return;
    setForm((current) => ({ ...current, directReceiptId: directReceipts[0].tas_direct_receipt_session_id }));
  }, [directReceipts, form.directReceiptId, kind]);

  useEffect(() => {
    const firstUldType = tasOptions.uld_type?.find((item) => !item.disabled)?.value;
    if (!form.uldType && firstUldType) setForm((current) => ({ ...current, uldType: firstUldType }));
  }, [form.uldType, tasOptions.uld_type]);

  useEffect(() => {
    async function flush() {
      if (!navigator.onLine) return;
      const queued = loadQueue();
      const remaining = [];
      for (const item of queued) {
        try { await v14Post(item.path, item.payload, item.idempotencyKey); } catch { remaining.push(item); }
      }
      saveQueue(remaining);
      setQueueCount(remaining.length);
      if (queued.length !== remaining.length) await Promise.all([resource.mutate(), workspaceResource.mutate?.()]);
    }
    window.addEventListener('online', flush);
    flush();
    return () => window.removeEventListener('online', flush);
  }, [resource.mutate, workspaceResource.mutate]);

  async function run(label, path, payload, offlineCapable = false) {
    const idempotencyKey = `mobile-${kind}-${itemId}-${Date.now()}-${crypto.randomUUID()}`;
    if (offlineCapable && !navigator.onLine) {
      const queue = [...loadQueue(), { label, path, payload, idempotencyKey }];
      saveQueue(queue); setQueueCount(queue.length); setFeedback({ severity: 'warning', text: `${label} 已离线保存，联网后自动同步一次。` }); return;
    }
    setBusy(true); setFeedback(null);
    try {
      const result = await v14Post(path, payload, idempotencyKey);
      setFeedback({ severity: 'success', text: `${label}成功：${result.result || result.status || '已记录'}` });
      await Promise.all([resource.mutate(), workspaceResource.mutate?.()]);
      return result;
    } catch (error) {
      setFeedback({ severity: 'error', text: error?.response?.data?.error?.message || error?.response?.data?.detail?.code || error.message });
    } finally { setBusy(false); }
  }

  async function remove(label, path, payload) {
    setBusy(true); setFeedback(null);
    try {
      const result = await v14Delete(path, payload);
      setFeedback({ severity: 'success', text: `${label}${result.result ? `：${result.result}` : ''}` });
      await resource.mutate();
    } catch (error) {
      setFeedback({ severity: 'error', text: error?.response?.data?.error?.message || error?.response?.data?.detail?.code || error.message });
    } finally { setBusy(false); }
  }

  const scan = () => run('扫描', kind === 'tas' ? `/api/v1/airport-receipts/${itemId}/scans` : `/api/v1/prewarehouse/receipts/${itemId}/scans`, {
    client_event_id: crypto.randomUUID(), barcode: form.barcode, occurred_at: new Date().toISOString(), condition_status: 'NORMAL',
    weight_kg: Number(form.weight || 0), device_id: 'MOBILE-WEB'
  }, true);
  const location = () => run('人工位置', `/api/v1/transport-jobs/${itemId}/locations`, {
    client_event_id: crypto.randomUUID(), occurred_at: new Date().toISOString(), latitude: Number(form.latitude), longitude: Number(form.longitude),
    place_name: form.place, source_type: 'MANUAL', accuracy_m: 20
  }, true);
  const checkpoint = pendingCheckpoints.find((item) => item.checkpoint_code === form.checkpoint);
  const confirmCheckpoint = () => run('节点确认', `/api/v1/transport-jobs/${itemId}/checkpoint-events`, {
    checkpoint_code: form.checkpoint, event_type: 'PASSED', occurred_at: new Date().toISOString(), evidence_ids: form.evidence ? [form.evidence] : [],
    ...(form.checkpoint === 'SZX_TRUCK_DEPARTED' ? { departure_receipt_ref: form.evidence, first_valid_gps_event_id: root.last_location_event_id } : {})
  }, true);

  if (resource.isLoading && !resource.data) return <LinearProgress />;
  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard>
        <Stack sx={{ gap: 1 }}>
          <Button onClick={() => navigate(config.base)} sx={{ alignSelf: 'flex-start' }}>返回列表</Button>
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}><Typography variant="h4">{itemId}</Typography><StatusChip label={root.status || root.health_state || 'UNKNOWN'} /></Stack>
          <Typography variant="body2">Shipment: {root.shipment_id || '--'} · Flight: {root.flight_id || '--'}</Typography>
          <Typography variant="caption" color="text.secondary">最后事实：{dateTime(root.last_location_at || root.updated_at)} · 离线队列 {queueCount} 条</Typography>
        </Stack>
      </MainCard>
      {resource.error ? <Alert severity="error">{resource.error?.response?.data?.error?.message || resource.error.message}</Alert> : null}
      {workspaceResource.error ? <Alert severity="error">{workspaceResource.error?.response?.data?.error?.message || workspaceResource.error.message}</Alert> : null}
      {feedback ? <Alert severity={feedback.severity}>{feedback.text}</Alert> : null}

      {(kind === 'prewarehouse' || kind === 'tas') ? (
        <MainCard title="逐件扫码">
          <Stack sx={{ gap: 1.5 }}>
            <TextField label="CargoUnit / 条码" value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} />
            <TextField label="实重 kg" type="number" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} />
            <Button disabled={busy || !form.barcode} variant="contained" onClick={scan}>记录扫描</Button>
            <Typography variant="body2">唯一实收 {root.unique_received_pieces ?? root.airport_received_pieces ?? 0} / 应到 {root.expected_pieces ?? root.truck_loaded_pieces ?? 0}</Typography>
          </Stack>
        </MainCard>
      ) : null}

      {kind === 'prewarehouse' ? <MainCard title="前置仓 Gate"><Button disabled={busy} variant="outlined" onClick={() => run('提交复核', `/api/v1/prewarehouse/receipts/${itemId}/submit`, {})}>提交主管复核</Button></MainCard> : null}

      {kind === 'transport' ? (
        <>
          <MainCard title="人工位置回退">
            <Stack sx={{ gap: 1.5 }}><TextField label="纬度" type="number" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /><TextField label="经度" type="number" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /><TextField label="地点" value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })} /><Button disabled={busy || !form.latitude || !form.longitude} onClick={location} variant="contained">上传人工位置</Button></Stack>
          </MainCard>
          <MainCard title="节点确认（地图不可用时仍可作业）">
            <Stack sx={{ gap: 1.5 }}><TextField select label="待确认节点" value={form.checkpoint} onChange={(event) => setForm({ ...form, checkpoint: event.target.value })}>{pendingCheckpoints.map((item) => <MenuItem key={item.checkpoint_code} value={item.checkpoint_code}>{item.sequence}. {item.name_zh || item.checkpoint_code}</MenuItem>)}</TextField><TextField label="证据/仓库放行凭证" value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} /><Button disabled={busy || !checkpoint} onClick={confirmCheckpoint} variant="contained">确认当前节点</Button></Stack>
          </MainCard>
        </>
      ) : null}

      {kind === 'border' ? (
        <MainCard title="双边事实（不可跨国一步完成）">
          <Stack sx={{ gap: 1.25 }}><TextField label="证据 ID" value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} /><TextField label="原提交人 ID（审批人与提交人必须不同）" value={form.maker} onChange={(event) => setForm({ ...form, maker: event.target.value })} />
            <Button disabled={busy} onClick={() => run('中国进场', `/api/v1/border-operations/${itemId}/cn-gate-in`, { occurred_at: new Date().toISOString(), evidence_ids: [form.evidence] })}>中国进场</Button>
            <Button disabled={busy} onClick={() => run('中国放行', `/api/v1/border-operations/${itemId}/cn-release`, { occurred_at: new Date().toISOString(), cmr_document_id: form.evidence, evidence_ids: [form.evidence] })}>中国放行</Button>
            <Button disabled={busy || !form.maker || !form.evidence} variant="contained" onClick={() => run('中国出境 Gate', `/api/v1/border-operations/${itemId}/china-exit`, { occurred_at: new Date().toISOString(), requested_by: form.maker, next_owner_accepted: true, evidence_ids: [form.evidence] })}>通过中国出境 Gate</Button>
            <Button disabled={busy} onClick={() => run('多斯特克到场', `/api/v1/border-operations/${itemId}/dostyk-arrival`, { occurred_at: new Date().toISOString(), evidence_ids: [form.evidence] })}>多斯特克到场</Button>
            <Button disabled={busy} onClick={() => run('哈方放行', `/api/v1/border-operations/${itemId}/kz-release`, { occurred_at: new Date().toISOString(), kz_inspection_status: 'RELEASED', evidence_ids: [form.evidence] })}>哈方放行</Button>
            <Button disabled={busy || !form.maker || !form.evidence} variant="contained" onClick={() => run('多斯特克发车 Gate', `/api/v1/border-operations/${itemId}/dostyk-departure`, { occurred_at: new Date().toISOString(), requested_by: form.maker, next_owner_accepted: true, evidence_ids: [form.evidence] })}>通过多斯特克发车 Gate</Button>
          </Stack>
        </MainCard>
      ) : null}

      {kind === 'tas' ? (
        <MainCard title="TAS 接收 Gate">
          <Stack sx={{ gap: 1.25 }}><TextField label="实际封志" value={form.seal} onChange={(event) => setForm({ ...form, seal: event.target.value })} /><TextField label="证据 ID" value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} />
            <Button disabled={busy} onClick={() => run('车辆到场', `/api/v1/airport-receipts/${itemId}/arrival`, { occurred_at: new Date().toISOString(), evidence_ids: [form.evidence] })}>确认车辆到场</Button>
            <Button disabled={busy || !form.seal} onClick={() => run('封志核验', `/api/v1/airport-receipts/${itemId}/seal-check`, { seal_actual: form.seal, evidence_ids: [form.evidence] })}>核验封志</Button>
            <Button disabled={busy} onClick={() => run('开始卸货', `/api/v1/airport-receipts/${itemId}/unloading/start`, {})}>开始卸货</Button>
            <Button disabled={busy} onClick={() => run('三方核对', `/api/v1/airport-receipts/${itemId}/reconcile`, {})}>执行三方核对</Button>
            <Button disabled={busy} variant="contained" onClick={() => run('提交 B1 复核', `/api/v1/airport-receipts/${itemId}/submit`, {})}>提交 B1 复核</Button>
            {root.status === 'RECONCILIATION_PENDING' && canSuperviseTas ? (
              <>
                <Divider />
                <Typography variant="h5">{localizeMobileText(readMobileLanguage(), '主管 Gate 决策')}</Typography>
                <TextField select label={localizeMobileText(readMobileLanguage(), '决策')} value={form.decision} onChange={(event) => setForm({ ...form, decision: event.target.value })}>
                  {(tasOptions.gate_decision || []).map((item) => <MenuItem key={item.value} value={item.value}>{optionLabel(item, readMobileLanguage())}</MenuItem>)}
                </TextField>
                <TextField label={localizeMobileText(readMobileLanguage(), '原提交人 ID（必须与审批人不同）')} value={form.maker} onChange={(event) => setForm({ ...form, maker: event.target.value })} />
                <TextField label={localizeMobileText(readMobileLanguage(), '决策原因')} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
                {form.decision === 'CONDITIONAL_PASS' ? <TextField label={localizeMobileText(readMobileLanguage(), '适用 CargoUnit ID')} value={form.cargoUnitIds} onChange={(event) => setForm({ ...form, cargoUnitIds: event.target.value })} /> : null}
                <Button
                  disabled={busy || !form.maker || (form.decision !== 'BLOCKED' && !form.evidence)}
                  variant="contained"
                  color="success"
                  onClick={() => run('收货 Gate 决策已提交', `/api/v1/airport-receipts/${itemId}/decision`, {
                    decision: form.decision,
                    requested_by: form.maker,
                    reason: form.reason,
                    next_owner_accepted: form.decision !== 'BLOCKED',
                    evidence_ids: splitValues(form.evidence),
                    cargo_unit_ids: splitValues(form.cargoUnitIds),
                    expires_at: form.expiresAt || undefined
                  })}
                >
                  {localizeMobileText(readMobileLanguage(), '提交 Gate 决策')}
                </Button>
              </>
            ) : null}
          </Stack>
        </MainCard>
      ) : null}

      {kind === 'tasFlight' ? (
        <>
          <MainCard title={localizeMobileText(readMobileLanguage(), 'TAS–LGG 航班处理')}>
            <Stack sx={{ gap: 1.25 }}>
              <Typography variant="h5">{root.flight_no || root.flight_id} · TAS-{root.destination_code || 'LGG'}</Typography>
              <Typography variant="body2">{localizeMobileText(readMobileLanguage(), '计划起飞')}：{dateTime(root.etd_at)}</Typography>
              <Typography variant="body2">{localizeMobileText(readMobileLanguage(), '收货 / 组板 / 装机')}：{root.received_pieces || 0} / {root.buildup_pieces || 0} / {root.loaded_pieces || 0}</Typography>
              <Button variant="outlined" onClick={() => navigate('/mobile/tas')}>{localizeMobileText(readMobileLanguage(), '查看 TAS 收货任务')}</Button>
            </Stack>
          </MainCard>

          {['PLANNING', 'BUILDUP'].includes(root.status) ? (
            <MainCard title={localizeMobileText(readMobileLanguage(), '现场收货（逐箱 +1）')}>
              <Stack sx={{ gap: 1.25 }}>
                <Alert severity="info">{localizeMobileText(readMobileLanguage(), '没有预报提单时，先现场建单；每点击一次“确认 1 箱”只增加一件。')}</Alert>
                <TextField label={localizeMobileText(readMobileLanguage(), '无预报主提单号')} value={form.provisionalAwbNo} onChange={(event) => setForm({ ...form, provisionalAwbNo: event.target.value.toUpperCase() })} />
                <Button
                  variant="outlined"
                  disabled={busy || !form.provisionalAwbNo}
                  onClick={async () => {
                    const result = await run('现场临时提单已建立', v14Endpoints.tasFlightAwbs(itemId), {
                      awb_no: form.provisionalAwbNo, pieces: 0, gross_weight: 0, provisional: true
                    });
                    if (result) setForm((current) => ({ ...current, provisionalAwbNo: '', directAwbId: result.awb_id }));
                  }}
                >
                  {localizeMobileText(readMobileLanguage(), '现场建立临时提单')}
                </Button>
                <Divider />
                <TextField label={localizeMobileText(readMobileLanguage(), '现场车牌')} value={form.directVehiclePlate} onChange={(event) => setForm({ ...form, directVehiclePlate: event.target.value.toUpperCase() })} />
                <Button
                  variant="contained"
                  disabled={busy || !form.directVehiclePlate}
                  onClick={async () => {
                    const result = await run('现场收货批次已开始', v14Endpoints.tasFlightDirectReceipts(itemId), { vehicle_plate: form.directVehiclePlate });
                    if (result) setForm((current) => ({ ...current, directVehiclePlate: '', directReceiptId: result.tas_direct_receipt_session_id }));
                  }}
                >
                  {localizeMobileText(readMobileLanguage(), '开始一车收货')}
                </Button>
                {directReceipts.length ? <TextField select label={localizeMobileText(readMobileLanguage(), '当前收货批次')} value={directReceipt?.tas_direct_receipt_session_id || ''} onChange={(event) => setForm({ ...form, directReceiptId: event.target.value })}>
                  {directReceipts.map((item) => <MenuItem key={item.tas_direct_receipt_session_id} value={item.tas_direct_receipt_session_id}>{item.vehicle_plate} · {item.status}</MenuItem>)}
                </TextField> : null}
                {directReceipt?.status === 'COUNTING' ? <>
                  <TextField select label={localizeMobileText(readMobileLanguage(), '选择航班提单')} value={form.directAwbId} onChange={(event) => setForm({ ...form, directAwbId: event.target.value })}>
                    <MenuItem value="">{localizeMobileText(readMobileLanguage(), '请选择')}</MenuItem>
                    {directAwbs.map((item) => <MenuItem key={item.awb_id} value={item.awb_id}>{item.awb_no} · {item.forecast_status}</MenuItem>)}
                  </TextField>
                  {!directReceipt.lines?.some((line) => line.awb_id === form.directAwbId) ? <Button variant="outlined" disabled={busy || !form.directAwbId} onClick={() => run('提单已加入本次收货', v14Endpoints.tasDirectReceiptAwbs(directReceipt.tas_direct_receipt_session_id), { awb_id: form.directAwbId })}>{localizeMobileText(readMobileLanguage(), '加入收货批次')}</Button> : null}
                  <TextField label={localizeMobileText(readMobileLanguage(), '箱码（可空，系统自动生成）')} value={form.directBarcode} onChange={(event) => setForm({ ...form, directBarcode: event.target.value.toUpperCase() })} />
                  <TextField type="number" label={localizeMobileText(readMobileLanguage(), '本箱重量 kg')} value={form.directWeight} onChange={(event) => setForm({ ...form, directWeight: event.target.value })} />
                  <TextField select label={localizeMobileText(readMobileLanguage(), '货物外观')} value={form.directCondition} onChange={(event) => setForm({ ...form, directCondition: event.target.value })}>
                    {['NORMAL', 'DAMAGED', 'WET', 'OPENED', 'DEFORMED', 'LABEL_ISSUE', 'OTHER'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                  </TextField>
                  <Button
                    variant="contained"
                    disabled={busy || !form.directAwbId || !directReceipt.lines?.some((line) => line.awb_id === form.directAwbId)}
                    onClick={async () => {
                      const result = await run('已确认 1 箱', v14Endpoints.tasDirectReceiptScans(directReceipt.tas_direct_receipt_session_id), {
                        awb_id: form.directAwbId, barcode: form.directBarcode || undefined,
                        weight_kg: Number(form.directWeight || 0), condition_status: form.directCondition,
                        occurred_at: new Date().toISOString(), client_event_id: crypto.randomUUID(), device_id: 'TAS-MOBILE-WEB'
                      }, true);
                      if (result) setForm((current) => ({ ...current, directBarcode: '', directWeight: '' }));
                    }}
                  >
                    {localizeMobileText(readMobileLanguage(), '确认 1 箱')}
                  </Button>
                  {(directReceipt.lines || []).map((line) => <Typography key={line.tas_direct_receipt_line_id} variant="body2">{line.awb_no}：{line.received_pieces} / {line.expected_pieces || localizeMobileText(readMobileLanguage(), '未预报')} {localizeMobileText(readMobileLanguage(), '件')}</Typography>)}
                  <Button variant="outlined" disabled={busy || !(directReceipt.lines || []).some((line) => Number(line.received_pieces) > 0)} onClick={() => run('收货清点已提交主管复核', v14Endpoints.tasDirectReceiptSubmit(directReceipt.tas_direct_receipt_session_id), {})}>{localizeMobileText(readMobileLanguage(), '提交主管复核')}</Button>
                </> : null}
                {directReceipt?.status === 'SUBMITTED' && canSuperviseTas ? <>
                  <TextField label={localizeMobileText(readMobileLanguage(), '验收证据 ID')} value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} />
                  <Button color="success" variant="contained" disabled={busy || !form.evidence} onClick={() => run('收货已验收', v14Endpoints.tasDirectReceiptDecision(directReceipt.tas_direct_receipt_session_id), { decision: 'PASS', evidence_ids: splitValues(form.evidence) })}>{localizeMobileText(readMobileLanguage(), '主管验收通过')}</Button>
                  <Button color="warning" variant="outlined" disabled={busy || !form.evidence} onClick={() => run('收货已条件验收', v14Endpoints.tasDirectReceiptDecision(directReceipt.tas_direct_receipt_session_id), { decision: 'CONDITIONAL_PASS', reason: '现场差异接受', evidence_ids: splitValues(form.evidence) })}>{localizeMobileText(readMobileLanguage(), '主管条件验收')}</Button>
                </> : null}
              </Stack>
            </MainCard>
          ) : null}

          {['PLANNING', 'BUILDUP'].includes(root.status) ? (
            <MainCard title={localizeMobileText(readMobileLanguage(), '新建 ULD')}>
              <Stack sx={{ gap: 1.25 }}>
                <TextField label={localizeMobileText(readMobileLanguage(), 'ULD 号')} value={form.uldCode} onChange={(event) => setForm({ ...form, uldCode: event.target.value.toUpperCase() })} />
                <TextField select label={localizeMobileText(readMobileLanguage(), 'ULD 类型')} value={form.uldType} onChange={(event) => setForm({ ...form, uldType: event.target.value })}>
                  {(tasOptions.uld_type || []).map((item) => <MenuItem key={item.value} value={item.value}>{optionLabel(item, readMobileLanguage())}</MenuItem>)}
                </TextField>
                <TextField label={localizeMobileText(readMobileLanguage(), '机位')} value={form.positionCode} onChange={(event) => setForm({ ...form, positionCode: event.target.value.toUpperCase() })} />
                <TextField type="number" label={localizeMobileText(readMobileLanguage(), '皮重 kg')} value={form.tareWeight} onChange={(event) => setForm({ ...form, tareWeight: event.target.value })} />
                <TextField type="number" label={localizeMobileText(readMobileLanguage(), '最大毛重 kg')} value={form.maxGrossWeight} onChange={(event) => setForm({ ...form, maxGrossWeight: event.target.value })} />
                <Button
                  disabled={busy || !form.uldCode || !form.uldType}
                  variant="contained"
                  onClick={async () => {
                    const result = await run('ULD 已创建', `${v14Endpoints.tasFlight(itemId)}/ulds`, {
                      uld_code: form.uldCode,
                      uld_type: form.uldType,
                      position_code: form.positionCode,
                      tare_weight_kg: Number(form.tareWeight || 0),
                      max_gross_weight_kg: Number(form.maxGrossWeight || 0)
                    });
                    if (result) setForm((current) => ({ ...current, uldCode: '' }));
                  }}
                >
                  {localizeMobileText(readMobileLanguage(), '创建 ULD')}
                </Button>
              </Stack>
            </MainCard>
          ) : null}

          <MainCard title={localizeMobileText(readMobileLanguage(), 'ULD 与逐件货物')}>
            <Stack sx={{ gap: 1.5 }}>
              {activeUlds.map((uld) => (
                <MainCard key={uld.tas_uld_id} onClick={() => setForm({ ...form, selectedUldId: uld.tas_uld_id })} sx={{ cursor: 'pointer', borderColor: selectedUld?.tas_uld_id === uld.tas_uld_id ? 'primary.main' : undefined }}>
                  <Stack sx={{ gap: 1 }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}><Typography variant="h5">{uld.uld_code}</Typography><StatusChip label={uld.status} /></Stack>
                    <Typography variant="body2">{uld.uld_type} · {uld.position_code || '--'} · {uld.piece_count || 0} {localizeMobileText(readMobileLanguage(), '件')} · {uld.actual_gross_weight_kg || 0} kg</Typography>
                    {root.status === 'HANDED_TO_AIRLINE' && uld.status === 'HANDED_TO_AIRLINE' ? <Button variant="contained" disabled={busy || !form.evidence} onClick={(event) => { event.stopPropagation(); run('ULD 已装机', v14Endpoints.tasFlightLoadUld(itemId, uld.tas_uld_id), { position_code: uld.position_code || form.positionCode, evidence_ids: splitValues(form.evidence) }); }}>{localizeMobileText(readMobileLanguage(), '确认该 ULD 装机')}</Button> : null}
                    {(uld.items || []).filter((item) => item.status !== 'REMOVED').map((item) => (
                      <Stack key={item.tas_uld_item_id} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption">{item.barcode} · {item.piece_count} {localizeMobileText(readMobileLanguage(), '件')}</Typography>
                        {['PLANNING', 'BUILDUP'].includes(root.status) && item.status === 'ASSIGNED' ? <Button size="small" color="error" disabled={busy} onClick={(event) => { event.stopPropagation(); remove('CargoUnit 已移出 ULD', `${v14Endpoints.tasFlight(itemId)}/ulds/${encodeURIComponent(uld.tas_uld_id)}/items/${encodeURIComponent(item.tas_uld_item_id)}`, { reason: 'Removed from TAS mobile execution' }); }}>{localizeMobileText(readMobileLanguage(), '移除')}</Button> : null}
                      </Stack>
                    ))}
                    {['PLANNING', 'BUILDUP'].includes(root.status) && !(uld.items || []).some((item) => item.status === 'ASSIGNED') ? <Button size="small" color="error" disabled={busy} onClick={(event) => { event.stopPropagation(); remove('ULD 已归档', `${v14Endpoints.tasFlight(itemId)}/ulds/${encodeURIComponent(uld.tas_uld_id)}`, { reason: 'Archived from TAS mobile execution' }); }}>{localizeMobileText(readMobileLanguage(), '归档空 ULD')}</Button> : null}
                  </Stack>
                </MainCard>
              ))}
              {!activeUlds.length ? <Alert severity="info">{localizeMobileText(readMobileLanguage(), '当前没有 ULD。')}</Alert> : null}
              {bulkItems.filter((item) => !item.removed_at).map((item) => (
                <MainCard key={item.tas_bulk_load_item_id}>
                  <Stack sx={{ gap: 1 }}><Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}><Typography variant="h5">{localizeMobileText(readMobileLanguage(), '散货')} · {item.barcode}</Typography><StatusChip label={item.status} /></Stack><Typography variant="body2">{item.awb_no} · {item.piece_count} {localizeMobileText(readMobileLanguage(), '件')} · {item.weight_kg} kg · {item.position_code || '--'}</Typography>{root.status === 'HANDED_TO_AIRLINE' && item.status === 'HANDED_TO_AIRLINE' ? <Button variant="contained" disabled={busy || !form.evidence} onClick={() => run('散货已装机', v14Endpoints.tasFlightLoadBulk(itemId, item.tas_bulk_load_item_id), { position_code: item.position_code || form.bulkPositionCode, evidence_ids: splitValues(form.evidence) })}>{localizeMobileText(readMobileLanguage(), '确认该散货装机')}</Button> : null}</Stack>
                </MainCard>
              ))}
              {['PLANNING', 'BUILDUP'].includes(root.status) ? (
                <>
                  <TextField select label={localizeMobileText(readMobileLanguage(), '待装入 CargoUnit')} value={form.selectedCargoBarcode} onChange={(event) => setForm({ ...form, selectedCargoBarcode: event.target.value })}>
                    <MenuItem value="">{localizeMobileText(readMobileLanguage(), '请选择')}</MenuItem>
                    {availableCargoUnits.map((item) => <MenuItem key={item.cargo_unit_id} value={item.barcode}>{item.barcode} · {item.awb_no || item.shipment_id} · {item.aggregate_quantity} {localizeMobileText(readMobileLanguage(), '件')}</MenuItem>)}
                  </TextField>
                  <Button
                    disabled={busy || !form.selectedCargoBarcode || !selectedUld}
                    variant="contained"
                    onClick={async () => {
                      const result = await run('CargoUnit 已装入 ULD', `${v14Endpoints.tasFlight(itemId)}/ulds/${encodeURIComponent(selectedUld.tas_uld_id)}/items`, { barcode: form.selectedCargoBarcode });
                      if (result) setForm((current) => ({ ...current, selectedCargoBarcode: '' }));
                    }}
                  >
                    {localizeMobileText(readMobileLanguage(), '装入 ULD')}
                  </Button>
                  <TextField label={localizeMobileText(readMobileLanguage(), '散货装机位置（可选）')} value={form.bulkPositionCode} onChange={(event) => setForm({ ...form, bulkPositionCode: event.target.value.toUpperCase() })} />
                  <Button
                    disabled={busy || !form.selectedCargoBarcode}
                    variant="outlined"
                    onClick={async () => {
                      const result = await run('CargoUnit 已列为散货', v14Endpoints.tasFlightBulkItems(itemId), { barcode: form.selectedCargoBarcode, position_code: form.bulkPositionCode || undefined });
                      if (result) setForm((current) => ({ ...current, selectedCargoBarcode: '' }));
                    }}
                  >
                    {localizeMobileText(readMobileLanguage(), '列为散货')}
                  </Button>
                </>
              ) : null}
            </Stack>
          </MainCard>

          <MainCard title={localizeMobileText(readMobileLanguage(), '当前 Gate 动作')}>
            <Stack sx={{ gap: 1.25 }}>
              <TextField label={localizeMobileText(readMobileLanguage(), '证据 ID（多个用逗号分隔）')} value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} />
              {canSuperviseTas && root.status === 'PLANNING' ? <Button variant="contained" disabled={busy || !form.evidence} onClick={() => run('最后一车到达并关闭收货', `${v14Endpoints.tasFlight(itemId)}/receiving/close`, { occurred_at: new Date().toISOString(), evidence_ids: splitValues(form.evidence) })}>{localizeMobileText(readMobileLanguage(), '确认最后一车并进入组板')}</Button> : null}
              {canSuperviseTas && root.status === 'BUILDUP' ? <Button variant="contained" disabled={busy || !form.evidence} onClick={() => run('ULD 组板已完成', `${v14Endpoints.tasFlight(itemId)}/buildup/complete`, { occurred_at: new Date().toISOString(), evidence_ids: splitValues(form.evidence) })}>{localizeMobileText(readMobileLanguage(), '完成 ULD 组板')}</Button> : null}
              {canSuperviseTas && root.status === 'BUILT_UP' ? <><TextField label={localizeMobileText(readMobileLanguage(), 'Manifest 文档 ID')} value={form.manifestDocumentId} onChange={(event) => setForm({ ...form, manifestDocumentId: event.target.value })} /><TextField label={localizeMobileText(readMobileLanguage(), 'Manifest 版本')} value={form.manifestVersion} onChange={(event) => setForm({ ...form, manifestVersion: event.target.value })} /><Button variant="contained" disabled={busy || !form.evidence || !form.manifestDocumentId} onClick={() => run('Manifest 已冻结', `${v14Endpoints.tasFlight(itemId)}/manifest/finalize`, { manifest_document_id: form.manifestDocumentId, manifest_version: form.manifestVersion, occurred_at: new Date().toISOString(), evidence_ids: splitValues(form.evidence) })}>{localizeMobileText(readMobileLanguage(), '冻结 Manifest')}</Button></> : null}
              {canSuperviseTas && root.status === 'MANIFEST_FROZEN' ? <><TextField label={localizeMobileText(readMobileLanguage(), '航空公司代码')} value={form.airlineParty} onChange={(event) => setForm({ ...form, airlineParty: event.target.value.toUpperCase() })} /><Button variant="contained" disabled={busy || !form.evidence || !form.airlineParty} onClick={() => run('ULD 与散货已交航司', `${v14Endpoints.tasFlight(itemId)}/handover`, { airline_party_code: form.airlineParty, next_owner_accepted: true, occurred_at: new Date().toISOString(), evidence_ids: splitValues(form.evidence) })}>{localizeMobileText(readMobileLanguage(), '确认全部货物交航司')}</Button></> : null}
              {canSuperviseTas && root.status === 'HANDED_TO_AIRLINE' ? <Button variant="contained" disabled={busy || !form.evidence} onClick={() => run('飞机装载已完成', `${v14Endpoints.tasFlight(itemId)}/loading/complete`, { occurred_at: new Date().toISOString(), evidence_ids: splitValues(form.evidence) })}>{localizeMobileText(readMobileLanguage(), '全部逐项装机后关闭装载')}</Button> : null}
              {canSuperviseTas && root.status === 'LOADED' ? <><TextField label={localizeMobileText(readMobileLanguage(), '起飞 Gate 原提交人 ID')} value={form.maker} onChange={(event) => setForm({ ...form, maker: event.target.value })} /><Button variant="contained" color="success" disabled={busy || !form.evidence || !form.maker} onClick={() => run('TAS 航班已起飞', `${v14Endpoints.tasFlight(itemId)}/departure`, { requested_by: form.maker, next_owner_accepted: true, occurred_at: new Date().toISOString(), evidence_ids: splitValues(form.evidence) })}>{localizeMobileText(readMobileLanguage(), '确认 TAS 实际起飞')}</Button></> : null}
              {root.status === 'DEPARTED' ? <Alert severity="success">{localizeMobileText(readMobileLanguage(), 'TAS–LGG 出港链路已闭环，航班已进入 B2 飞行监控。')}</Alert> : null}
            </Stack>
          </MainCard>

          <MainCard title={localizeMobileText(readMobileLanguage(), 'TAS 处理里程碑')}>
            <Table size="small"><TableHead><TableRow><TableCell>{localizeMobileText(readMobileLanguage(), '里程碑')}</TableCell><TableCell>{localizeMobileText(readMobileLanguage(), '状态')}</TableCell></TableRow></TableHead><TableBody>{milestones.map((item) => <TableRow key={item.milestone_instance_id}><TableCell>{readMobileLanguage() === 'en' ? item.name_en || item.milestone_code : item.name_zh || item.milestone_code}</TableCell><TableCell><StatusChip label={item.status} /></TableCell></TableRow>)}</TableBody></Table>
          </MainCard>
        </>
      ) : null}

      {cargoUnits.length ? <MainCard title="CargoUnit 逐件状态"><Table size="small"><TableHead><TableRow><TableCell>条码</TableCell><TableCell>状态</TableCell><TableCell>前仓 / TAS</TableCell></TableRow></TableHead><TableBody>{cargoUnits.map((item) => <TableRow key={item.cargo_unit_id}><TableCell>{item.barcode}</TableCell><TableCell><StatusChip label={item.condition_status || item.inventory_state || 'UNKNOWN'} /></TableCell><TableCell>{dateTime(item.last_scan_at || item.updated_at)}</TableCell></TableRow>)}</TableBody></Table></MainCard> : null}
    </Stack>
  );
}
