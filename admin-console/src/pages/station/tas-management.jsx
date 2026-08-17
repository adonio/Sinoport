import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useV14Collection, useV14Resource, v14Delete, v14Endpoints, v14Patch, v14Post } from 'api/v14';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

const PAGE_SIZE = 20;
const EDITABLE_HANDLING_STATES = ['PLANNING', 'BUILDUP'];

const EMPTY_ACTION_FORM = {
  evidence: '',
  seal: '',
  barcode: '',
  weight: '',
  decision: 'PASS',
  requestedBy: '',
  reason: '',
  expiresAt: '',
  cargoUnitIds: '',
  approveSealMismatch: false,
  airlineParty: '',
  manifestDocumentId: '',
  manifestVersion: '1'
};

const EMPTY_ULD_FORM = {
  tas_uld_id: '',
  row_version: '',
  uld_code: '',
  uld_type: '',
  position_code: '',
  contour_code: '',
  tare_weight_kg: '',
  max_gross_weight_kg: '',
  seal_number: ''
};

function queryPath(path, values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined && value !== false) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function splitValues(value) {
  return String(value || '')
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function optionLabel(option, locale) {
  return locale.startsWith('en') ? option.label_en || option.label : option.label_zh || option.label;
}

function errorMessage(error) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Operation failed';
}

export default function TasStationManagementPage() {
  const intl = useIntl();
  const locale = intl.locale;
  const m = (value) => formatLocalizedMessage(intl, value);
  const l = (value) => localizeUiText(locale, value);
  const [tab, setTab] = useState('receipts');
  const [receiptPage, setReceiptPage] = useState(0);
  const [flightPage, setFlightPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [selectedKind, setSelectedKind] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [createKind, setCreateKind] = useState(null);
  const [createValue, setCreateValue] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [actionForm, setActionForm] = useState(EMPTY_ACTION_FORM);
  const [uldForm, setUldForm] = useState(EMPTY_ULD_FORM);
  const [selectedUldId, setSelectedUldId] = useState('');
  const [selectedCargoBarcode, setSelectedCargoBarcode] = useState('');
  const [handlingEdit, setHandlingEdit] = useState({ planned_pieces: '', planned_weight_kg: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const overview = useV14Resource(v14Endpoints.tasOverview, { refreshInterval: 20000 });
  const options = useV14Resource(v14Endpoints.tasOptions, { refreshInterval: 30000 });
  const receipts = useV14Collection(
    queryPath(v14Endpoints.tasReceipts, {
      page: receiptPage + 1,
      page_size: PAGE_SIZE,
      keyword,
      status: tab === 'receipts' ? status : ''
    }),
    { refreshInterval: 15000 }
  );
  const flights = useV14Collection(
    queryPath(v14Endpoints.tasFlights, {
      page: flightPage + 1,
      page_size: PAGE_SIZE,
      keyword,
      status: tab === 'flights' ? status : ''
    }),
    { refreshInterval: 15000 }
  );
  const detailPath = selectedKind === 'receipt'
    ? v14Endpoints.tasReceipt(selectedId)
    : selectedKind === 'flight'
      ? v14Endpoints.tasFlight(selectedId)
      : null;
  const detail = useV14Resource(detailPath, { refreshInterval: 10000 });

  const receiptStatuses = options.data?.receipt_status || [];
  const handlingStatuses = options.data?.handling_status || [];
  const gateDecisions = options.data?.gate_decision || [];
  const uldTypes = options.data?.uld_type || [];
  const eligibleJobs = options.data?.eligible_transport_jobs || [];
  const eligibleFlights = options.data?.flights || [];
  const receipt = detail.data?.receipt || null;
  const handling = detail.data?.handling || null;
  const ulds = detail.data?.ulds || [];
  const availableCargo = detail.data?.available_cargo_units || [];
  const activeStatuses = tab === 'receipts' ? receiptStatuses : handlingStatuses;

  const statusLabels = useMemo(() => {
    const all = [...receiptStatuses, ...handlingStatuses];
    return new Map(all.map((item) => [item.value, optionLabel(item, locale)]));
  }, [handlingStatuses, locale, receiptStatuses]);

  useEffect(() => {
    setStatus('');
    setKeyword('');
  }, [tab]);

  useEffect(() => {
    if (!handling) return;
    setHandlingEdit({
      planned_pieces: handling.planned_pieces ?? '',
      planned_weight_kg: handling.planned_weight_kg ?? '',
      notes: handling.notes || ''
    });
  }, [handling]);

  useEffect(() => {
    if (!ulds.length) {
      setSelectedUldId('');
      return;
    }
    if (!ulds.some((item) => item.tas_uld_id === selectedUldId && !item.archived_at)) {
      const first = ulds.find((item) => !item.archived_at);
      setSelectedUldId(first?.tas_uld_id || '');
    }
  }, [selectedUldId, ulds]);

  const refreshAll = async () => {
    await Promise.all([overview.mutate(), options.mutate(), receipts.mutate(), flights.mutate(), detail.mutate?.()]);
  };

  const run = async (label, path, payload = {}, method = 'post') => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = method === 'patch'
        ? await v14Patch(path, payload)
        : method === 'delete'
          ? await v14Delete(path, payload)
          : await v14Post(path, payload);
      setFeedback({ severity: 'success', text: `${m(label)}：${l(result.result || result.status || '已完成')}` });
      await refreshAll();
      return result;
    } catch (error) {
      setFeedback({ severity: 'error', text: errorMessage(error) });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const openDetail = (kind, id) => {
    setSelectedKind(kind);
    setSelectedId(id);
    setFeedback(null);
    setActionForm(EMPTY_ACTION_FORM);
    setUldForm(EMPTY_ULD_FORM);
  };

  const closeDetail = () => {
    setSelectedKind(null);
    setSelectedId(null);
    setFeedback(null);
    setUldForm(EMPTY_ULD_FORM);
  };

  const openCreate = (kind) => {
    setCreateKind(kind);
    setCreateValue('');
    setCreateNotes('');
    setFeedback(null);
  };

  const submitCreate = async () => {
    if (!createValue) return;
    const result = createKind === 'receipt'
      ? await run('TAS 收货任务已创建', v14Endpoints.tasReceipts, { transport_job_id: createValue, handover_from: 'TRUCK_CARRIER' })
      : await run('TAS 航班处理已创建', v14Endpoints.tasFlights, { flight_id: createValue, notes: createNotes });
    if (!result) return;
    setCreateKind(null);
    if (createKind === 'receipt') openDetail('receipt', result.airport_receipt_session_id);
    else openDetail('flight', result.tas_flight_handling_session_id);
  };

  const submitReceiptDecision = () => run('收货 Gate 决策已提交', `${v14Endpoints.tasReceipt(selectedId)}/decision`, {
    decision: actionForm.decision,
    requested_by: actionForm.requestedBy,
    next_owner_accepted: actionForm.decision !== 'BLOCKED',
    evidence_ids: splitValues(actionForm.evidence),
    reason: actionForm.reason || undefined,
    cargo_unit_ids: splitValues(actionForm.cargoUnitIds),
    expires_at: actionForm.expiresAt || undefined
  });

  const saveUld = async () => {
    const payload = {
      ...uldForm,
      tare_weight_kg: Number(uldForm.tare_weight_kg || 0),
      max_gross_weight_kg: uldForm.max_gross_weight_kg === '' ? undefined : Number(uldForm.max_gross_weight_kg)
    };
    const path = uldForm.tas_uld_id
      ? `${v14Endpoints.tasFlight(selectedId)}/ulds/${encodeURIComponent(uldForm.tas_uld_id)}`
      : `${v14Endpoints.tasFlight(selectedId)}/ulds`;
    const result = await run(uldForm.tas_uld_id ? 'ULD 已更新' : 'ULD 已创建', path, payload, uldForm.tas_uld_id ? 'patch' : 'post');
    if (result) setUldForm(EMPTY_ULD_FORM);
  };

  const editUld = (uld) => setUldForm({
    tas_uld_id: uld.tas_uld_id,
    row_version: uld.row_version,
    uld_code: uld.uld_code,
    uld_type: uld.uld_type,
    position_code: uld.position_code || '',
    contour_code: uld.contour_code || '',
    tare_weight_kg: uld.tare_weight_kg ?? '',
    max_gross_weight_kg: uld.max_gross_weight_kg ?? '',
    seal_number: uld.seal_number || ''
  });

  const currentUld = ulds.find((item) => item.tas_uld_id === selectedUldId);
  const overviewData = overview.data || {};

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="TAS Station Control"
          title="TAS 站点管理"
          description="统一管理卡车到场、封志、卸货、逐件清点、三方核对、ULD 组板、Manifest、交航司、装机和 TAS–LGG 起飞。所有动作使用数据库真相并自动回写 OCC 里程碑。"
          chips={['TAS 收货 Gate', 'ULD 逐件装载', 'Manifest 数据冻结', 'OCC 自动投影']}
          action={
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button component={RouterLink} to="/station/tas/outbound" variant="contained">{m('TAS–LGG 出港作业')}</Button>
              <Button component={RouterLink} to="/mobile/tas" variant="outlined">{m('打开 TAS PDA')}</Button>
              <Button component={RouterLink} to="/platform/occ-control" variant="outlined">{m('查看 OCC')}</Button>
            </Stack>
          }
        />
      </Grid>

      {overview.error ? <Grid size={12}><Alert severity="error">{errorMessage(overview.error)}</Alert></Grid> : null}
      <Grid size={{ xs: 12, md: 3 }}><MetricCard title="待处理收货" value={String(overviewData.receipts?.pending || 0)} helper="等待到场、清点或主管决策" chip="Receiving" /></Grid>
      <Grid size={{ xs: 12, md: 3 }}><MetricCard title="收货差异" value={String(overviewData.receipts?.discrepancies || 0)} helper="需由 B1 控制员处理" chip="Gate" color="warning" /></Grid>
      <Grid size={{ xs: 12, md: 3 }}><MetricCard title="活动航班处理" value={String(overviewData.handling?.active || 0)} helper="TAS–LGG 未起飞处理批次" chip="Flight" /></Grid>
      <Grid size={{ xs: 12, md: 3 }}><MetricCard title="已装机 ULD" value={String(overviewData.ulds?.loaded || 0)} helper="来自 TAS ULD 正式台账" chip="ULD" color="success" /></Grid>

      <Grid size={12}>
        <MainCard>
          <Stack sx={{ gap: 2 }}>
            <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
              <Tab value="receipts" label={`${m('卡车到场与收货')} (${receipts.total})`} />
              <Tab value="flights" label={`${m('TAS–LGG 航班处理')} (${flights.total})`} />
            </Tabs>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5 }}>
              <TextField
                label={m('搜索业务对象')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  if (tab === 'receipts') setReceiptPage(0); else setFlightPage(0);
                }}
                sx={{ minWidth: 280 }}
              />
              <TextField
                select
                label={m('状态')}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  if (tab === 'receipts') setReceiptPage(0); else setFlightPage(0);
                }}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">{m('全部状态')}</MenuItem>
                {activeStatuses.map((item) => <MenuItem key={item.value} value={item.value}>{optionLabel(item, locale)}</MenuItem>)}
              </TextField>
              <Box sx={{ flexGrow: 1 }} />
              <Button variant="contained" onClick={() => openCreate(tab === 'receipts' ? 'receipt' : 'flight')}>
                {tab === 'receipts' ? m('新建收货任务') : m('新建航班处理')}
              </Button>
            </Stack>
            {(tab === 'receipts' ? receipts.isLoading : flights.isLoading) ? <LinearProgress /> : null}
            {(tab === 'receipts' ? receipts.error : flights.error) ? <Alert severity="error">{errorMessage(tab === 'receipts' ? receipts.error : flights.error)}</Alert> : null}

            {tab === 'receipts' ? (
              <>
                <Table size="small">
                  <TableHead><TableRow><TableCell>{m('收货任务')}</TableCell><TableCell>{m('航班')}</TableCell><TableCell>Shipment</TableCell><TableCell>{m('三方件数')}</TableCell><TableCell>{m('封志')}</TableCell><TableCell>{m('状态')}</TableCell><TableCell>{m('更新时间')}</TableCell><TableCell align="right">{m('操作')}</TableCell></TableRow></TableHead>
                  <TableBody>
                    {receipts.items.map((item) => (
                      <TableRow hover key={item.airport_receipt_session_id}>
                        <TableCell><Typography variant="subtitle2">{item.airport_receipt_session_id}</Typography><Typography variant="caption">{item.transport_job_id}</Typography></TableCell>
                        <TableCell>{item.flight_no || item.flight_id || '--'}<Typography variant="caption" display="block">TAS → {item.destination_code || 'LGG'}</Typography></TableCell>
                        <TableCell>{item.shipment_id}</TableCell>
                        <TableCell>{item.warehouse_out_pieces} / {item.truck_loaded_pieces} / {item.airport_received_pieces}</TableCell>
                        <TableCell>{item.seal_expected || '--'} / {item.seal_actual || '--'}</TableCell>
                        <TableCell><StatusChip label={statusLabels.get(item.status) || item.status} /></TableCell>
                        <TableCell>{dateTime(item.updated_at)}</TableCell>
                        <TableCell align="right"><Button size="small" onClick={() => openDetail('receipt', item.airport_receipt_session_id)}>{m('处理')}</Button></TableCell>
                      </TableRow>
                    ))}
                    {!receipts.items.length && !receipts.isLoading ? <TableRow><TableCell colSpan={8} align="center">{m('当前没有 TAS 收货任务。')}</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
                <TablePagination component="div" count={receipts.total} page={receiptPage} onPageChange={(_event, page) => setReceiptPage(page)} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} />
              </>
            ) : (
              <>
                <Table size="small">
                  <TableHead><TableRow><TableCell>{m('航班')}</TableCell><TableCell>{m('计划起飞')}</TableCell><TableCell>{m('收货 / 组板 / 装机')}</TableCell><TableCell>ULD</TableCell><TableCell>Manifest</TableCell><TableCell>{m('状态')}</TableCell><TableCell align="right">{m('操作')}</TableCell></TableRow></TableHead>
                  <TableBody>
                    {flights.items.map((item) => (
                      <TableRow hover key={item.tas_flight_handling_session_id}>
                        <TableCell><Typography variant="subtitle2">{item.flight_no}</Typography><Typography variant="caption">{item.flight_id} · TAS → LGG</Typography></TableCell>
                        <TableCell>{dateTime(item.etd_at)}</TableCell>
                        <TableCell>{item.received_pieces} / {item.buildup_pieces} / {item.loaded_pieces}</TableCell>
                        <TableCell>{item.uld_count}</TableCell>
                        <TableCell>{item.manifest_document_id || m('未冻结')}</TableCell>
                        <TableCell><StatusChip label={statusLabels.get(item.status) || item.status} /></TableCell>
                        <TableCell align="right"><Button size="small" onClick={() => openDetail('flight', item.tas_flight_handling_session_id)}>{m('处理')}</Button></TableCell>
                      </TableRow>
                    ))}
                    {!flights.items.length && !flights.isLoading ? <TableRow><TableCell colSpan={7} align="center">{m('当前没有 TAS 航班处理批次。')}</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
                <TablePagination component="div" count={flights.total} page={flightPage} onPageChange={(_event, page) => setFlightPage(page)} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} />
              </>
            )}
          </Stack>
        </MainCard>
      </Grid>

      <Drawer anchor="right" open={Boolean(createKind)} onClose={() => setCreateKind(null)}>
        <Box sx={{ width: { xs: '100vw', sm: 500 }, p: 3 }}>
          <MainCard title={createKind === 'receipt' ? m('新建 TAS 收货任务') : m('新建 TAS 航班处理')}>
            <Stack sx={{ gap: 2 }}>
              {feedback ? <Alert severity={feedback.severity}>{feedback.text}</Alert> : null}
              <TextField select label={createKind === 'receipt' ? m('已到 TAS 待接收车辆') : m('TAS–LGG 航班与控制计划')} value={createValue} onChange={(event) => setCreateValue(event.target.value)}>
                {(createKind === 'receipt' ? eligibleJobs : eligibleFlights.filter((item) => !item.tas_flight_handling_session_id)).map((item) => (
                  <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                ))}
              </TextField>
              {createKind === 'flight' ? <TextField multiline minRows={3} label={m('处理备注')} value={createNotes} onChange={(event) => setCreateNotes(event.target.value)} /> : null}
              <Alert severity="info">{createKind === 'receipt' ? m('仅显示已到达 TAS staging 且尚未创建有效收货任务的车辆。') : m('仅显示已建立 OCC 控制计划的 TAS–LGG 航班。')}</Alert>
              <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}><Button onClick={() => setCreateKind(null)}>{m('取消')}</Button><Button variant="contained" disabled={busy || !createValue} onClick={submitCreate}>{m('创建')}</Button></Stack>
            </Stack>
          </MainCard>
        </Box>
      </Drawer>

      <Drawer anchor="right" open={Boolean(selectedKind)} onClose={closeDetail}>
        <Box sx={{ width: { xs: '100vw', md: 760 }, p: 3 }}>
          {detail.isLoading && !detail.data ? <LinearProgress /> : null}
          {detail.error ? <Alert severity="error">{errorMessage(detail.error)}</Alert> : null}
          {feedback ? <Alert severity={feedback.severity} sx={{ mb: 2 }}>{feedback.text}</Alert> : null}

          {selectedKind === 'receipt' && receipt ? (
            <Stack sx={{ gap: 2 }}>
              <MainCard title={`${m('TAS 收货任务')} ${receipt.airport_receipt_session_id}`} subheader={`${receipt.flight_no || receipt.flight_id || '--'} · ${receipt.shipment_id}`}>
                <Stack sx={{ gap: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between"><StatusChip label={statusLabels.get(receipt.status) || receipt.status} /><Typography variant="body2">{m('三方件数')} {receipt.warehouse_out_pieces} / {receipt.truck_loaded_pieces} / {receipt.airport_received_pieces}</Typography></Stack>
                  <TextField label={m('证据 ID（多个用逗号分隔）')} value={actionForm.evidence} onChange={(event) => setActionForm({ ...actionForm, evidence: event.target.value })} />
                  {receipt.status === 'ARRIVED_STAGING' ? <Button variant="contained" disabled={busy || !actionForm.evidence} onClick={() => run('车辆正式到场已确认', `${v14Endpoints.tasReceipt(selectedId)}/arrival`, { occurred_at: new Date().toISOString(), evidence_ids: splitValues(actionForm.evidence) })}>{m('确认车辆正式到场')}</Button> : null}
                  {['TRUCK_ARRIVED', 'SEAL_CHECK_PENDING'].includes(receipt.status) ? <><TextField label={m('实际封志号')} value={actionForm.seal} onChange={(event) => setActionForm({ ...actionForm, seal: event.target.value })} /><Button variant="contained" disabled={busy || !actionForm.seal} onClick={() => run('封志核验已完成', `${v14Endpoints.tasReceipt(selectedId)}/seal-check`, { seal_actual: actionForm.seal, evidence_ids: splitValues(actionForm.evidence) })}>{m('核验封志')}</Button></> : null}
                  {['UNLOADING', 'DISCREPANCY_REVIEW'].includes(receipt.status) ? <><FormControlLabel control={<Checkbox checked={actionForm.approveSealMismatch} onChange={(event) => setActionForm({ ...actionForm, approveSealMismatch: event.target.checked })} />} label={m('主管已批准封志差异卸货')} /><Button variant="contained" disabled={busy || (receipt.seal_condition !== 'MATCHED' && !actionForm.approveSealMismatch)} onClick={() => run('卸货与清点已开始', `${v14Endpoints.tasReceipt(selectedId)}/unloading/start`, { seal_mismatch_approved: actionForm.approveSealMismatch })}>{m('开始卸货与清点')}</Button></> : null}
                  {receipt.status === 'COUNTING' ? <><Divider /><Typography variant="h5">{m('逐件清点')}</Typography><TextField label="CargoUnit / Barcode" value={actionForm.barcode} onChange={(event) => setActionForm({ ...actionForm, barcode: event.target.value })} /><TextField type="number" label={m('实重 kg')} value={actionForm.weight} onChange={(event) => setActionForm({ ...actionForm, weight: event.target.value })} /><Stack direction="row" sx={{ gap: 1 }}><Button disabled={busy || !actionForm.barcode} onClick={() => run('CargoUnit 已清点', `${v14Endpoints.tasReceipt(selectedId)}/scans`, { client_event_id: crypto.randomUUID(), barcode: actionForm.barcode, occurred_at: new Date().toISOString(), condition_status: 'NORMAL', weight_kg: Number(actionForm.weight || 0), evidence_ids: splitValues(actionForm.evidence), device_id: 'STATION-WEB' })}>{m('记录扫描')}</Button><Button variant="contained" disabled={busy} onClick={() => run('三方核对已执行', `${v14Endpoints.tasReceipt(selectedId)}/reconcile`)}>{m('执行三方核对')}</Button></Stack></> : null}
                  {['MATCHED', 'DISCREPANCY_REVIEW'].includes(receipt.status) ? <Button variant="contained" disabled={busy} onClick={() => run('已提交 B1 复核', `${v14Endpoints.tasReceipt(selectedId)}/submit`)}>{m('提交 B1 主管复核')}</Button> : null}
                  {receipt.status === 'RECONCILIATION_PENDING' ? <><Divider /><Typography variant="h5">{m('收货 Gate 决策')}</Typography><TextField select label={m('决策')} value={actionForm.decision} onChange={(event) => setActionForm({ ...actionForm, decision: event.target.value })}>{gateDecisions.map((item) => <MenuItem key={item.value} value={item.value}>{optionLabel(item, locale)}</MenuItem>)}</TextField><TextField label={m('原提交人 ID（必须与审批人不同）')} value={actionForm.requestedBy} onChange={(event) => setActionForm({ ...actionForm, requestedBy: event.target.value })} /><TextField label={m('决策原因')} value={actionForm.reason} onChange={(event) => setActionForm({ ...actionForm, reason: event.target.value })} />{actionForm.decision === 'CONDITIONAL_PASS' ? <><TextField label={m('适用 CargoUnit ID')} value={actionForm.cargoUnitIds} onChange={(event) => setActionForm({ ...actionForm, cargoUnitIds: event.target.value })} /><TextField type="datetime-local" label={m('条件有效期')} value={actionForm.expiresAt} onChange={(event) => setActionForm({ ...actionForm, expiresAt: event.target.value })} InputLabelProps={{ shrink: true }} /></> : null}<Button variant="contained" disabled={busy || !actionForm.requestedBy} onClick={submitReceiptDecision}>{m('提交 Gate 决策')}</Button></> : null}
                </Stack>
              </MainCard>
              <MainCard title={m('CargoUnit 清点状态')}><Table size="small"><TableHead><TableRow><TableCell>{m('条码')}</TableCell><TableCell>{m('件数')}</TableCell><TableCell>{m('状态')}</TableCell><TableCell>{m('位置')}</TableCell></TableRow></TableHead><TableBody>{(detail.data?.cargo_units || []).map((item) => <TableRow key={item.cargo_unit_id}><TableCell>{item.barcode}</TableCell><TableCell>{item.aggregate_quantity}</TableCell><TableCell><StatusChip label={item.condition_status || item.inventory_state} /></TableCell><TableCell>{item.current_location_id || '--'}</TableCell></TableRow>)}</TableBody></Table></MainCard>
              <MainCard title={m('收货审计')}><AuditTable items={detail.data?.audit_events || []} m={m} l={l} /></MainCard>
            </Stack>
          ) : null}

          {selectedKind === 'flight' && handling ? (
            <Stack sx={{ gap: 2 }}>
              <MainCard title={`${handling.flight_no} · TAS → LGG`} subheader={`${handling.tas_flight_handling_session_id} · ${dateTime(handling.etd_at)}`}>
                <Stack sx={{ gap: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between"><StatusChip label={statusLabels.get(handling.status) || handling.status} /><Typography>{m('收货 / 组板 / 装机')} {handling.received_pieces} / {handling.buildup_pieces} / {handling.loaded_pieces}</Typography></Stack>
                  {EDITABLE_HANDLING_STATES.includes(handling.status) ? <><TextField type="number" label={m('计划件数')} value={handlingEdit.planned_pieces} onChange={(event) => setHandlingEdit({ ...handlingEdit, planned_pieces: event.target.value })} /><TextField type="number" label={m('计划重量 kg')} value={handlingEdit.planned_weight_kg} onChange={(event) => setHandlingEdit({ ...handlingEdit, planned_weight_kg: event.target.value })} /><TextField multiline minRows={2} label={m('处理备注')} value={handlingEdit.notes} onChange={(event) => setHandlingEdit({ ...handlingEdit, notes: event.target.value })} /><Stack direction="row" sx={{ gap: 1 }}><Button disabled={busy} onClick={() => run('航班处理已更新', v14Endpoints.tasFlight(selectedId), { row_version: handling.row_version, planned_pieces: Number(handlingEdit.planned_pieces || 0), planned_weight_kg: Number(handlingEdit.planned_weight_kg || 0), notes: handlingEdit.notes }, 'patch')}>{m('保存处理计划')}</Button><Button color="error" disabled={busy || ulds.some((item) => item.items?.some((cargo) => cargo.status === 'ASSIGNED'))} onClick={() => run('航班处理已取消', v14Endpoints.tasFlight(selectedId), { reason: handlingEdit.notes || 'Cancelled by supervisor' }, 'delete')}>{m('取消处理批次')}</Button></Stack></> : null}
                </Stack>
              </MainCard>

              <MainCard title={m('TAS 处理里程碑')}><Table size="small"><TableHead><TableRow><TableCell>{m('顺序')}</TableCell><TableCell>{m('里程碑')}</TableCell><TableCell>{m('状态')}</TableCell><TableCell>{m('实际时间')}</TableCell></TableRow></TableHead><TableBody>{(detail.data?.milestones || []).map((item) => <TableRow key={item.milestone_instance_id}><TableCell>{item.sequence}</TableCell><TableCell>{locale.startsWith('en') ? item.name_en : item.name_zh}</TableCell><TableCell><StatusChip label={item.status} /></TableCell><TableCell>{dateTime(item.actual_completed_at || item.actual_started_at)}</TableCell></TableRow>)}</TableBody></Table></MainCard>

              {EDITABLE_HANDLING_STATES.includes(handling.status) ? (
                <MainCard title={uldForm.tas_uld_id ? m('编辑 ULD') : m('新建 ULD')}>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={m('ULD 号')} disabled={Boolean(uldForm.tas_uld_id)} value={uldForm.uld_code} onChange={(event) => setUldForm({ ...uldForm, uld_code: event.target.value.toUpperCase() })} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth select label={m('ULD 类型')} disabled={Boolean(uldForm.tas_uld_id)} value={uldForm.uld_type} onChange={(event) => setUldForm({ ...uldForm, uld_type: event.target.value })}>{uldTypes.map((item) => <MenuItem key={item.value} value={item.value}>{optionLabel(item, locale)}</MenuItem>)}</TextField></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={m('机位')} value={uldForm.position_code} onChange={(event) => setUldForm({ ...uldForm, position_code: event.target.value })} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={m('轮廓代码')} value={uldForm.contour_code} onChange={(event) => setUldForm({ ...uldForm, contour_code: event.target.value })} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label={m('皮重 kg')} value={uldForm.tare_weight_kg} onChange={(event) => setUldForm({ ...uldForm, tare_weight_kg: event.target.value })} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label={m('最大毛重 kg')} value={uldForm.max_gross_weight_kg} onChange={(event) => setUldForm({ ...uldForm, max_gross_weight_kg: event.target.value })} /></Grid>
                    <Grid size={12}><TextField fullWidth label={m('ULD 封志号')} value={uldForm.seal_number} onChange={(event) => setUldForm({ ...uldForm, seal_number: event.target.value })} /></Grid>
                    <Grid size={12}><Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>{uldForm.tas_uld_id ? <Button onClick={() => setUldForm(EMPTY_ULD_FORM)}>{m('取消编辑')}</Button> : null}<Button variant="contained" disabled={busy || !uldForm.uld_code || !uldForm.uld_type} onClick={saveUld}>{uldForm.tas_uld_id ? m('保存 ULD') : m('创建 ULD')}</Button></Stack></Grid>
                  </Grid>
                </MainCard>
              ) : null}

              <MainCard title={m('ULD 与逐件货物')}>
                <Stack sx={{ gap: 2 }}>
                  {ulds.filter((item) => !item.archived_at).map((uld) => (
                    <Box key={uld.tas_uld_id} sx={{ border: '1px solid', borderColor: selectedUldId === uld.tas_uld_id ? 'primary.main' : 'divider', borderRadius: 1.5, p: 1.5 }} onClick={() => setSelectedUldId(uld.tas_uld_id)}>
                      <Stack direction="row" justifyContent="space-between" sx={{ gap: 1 }}><Stack><Typography variant="subtitle2">{uld.uld_code} · {uld.uld_type} · {uld.position_code || '--'}</Typography><Typography variant="caption">{uld.piece_count} {m('件')} · {uld.actual_gross_weight_kg} / {uld.max_gross_weight_kg || '--'} kg</Typography></Stack><Stack direction="row" sx={{ gap: 1 }}><StatusChip label={uld.status} />{EDITABLE_HANDLING_STATES.includes(handling.status) ? <Button size="small" onClick={(event) => { event.stopPropagation(); editUld(uld); }}>{m('编辑')}</Button> : null}{EDITABLE_HANDLING_STATES.includes(handling.status) && !(uld.items || []).some((item) => item.status === 'ASSIGNED') ? <Button size="small" color="error" onClick={(event) => { event.stopPropagation(); run('ULD 已归档', `${v14Endpoints.tasFlight(selectedId)}/ulds/${encodeURIComponent(uld.tas_uld_id)}`, { reason: 'Archived from station management' }, 'delete'); }}>{m('归档')}</Button> : null}</Stack></Stack>
                      {(uld.items || []).length ? <Table size="small" sx={{ mt: 1 }}><TableHead><TableRow><TableCell>{m('条码')}</TableCell><TableCell>AWB</TableCell><TableCell>{m('件数 / 重量')}</TableCell><TableCell>{m('状态')}</TableCell><TableCell align="right">{m('操作')}</TableCell></TableRow></TableHead><TableBody>{uld.items.filter((item) => item.status !== 'REMOVED').map((item) => <TableRow key={item.tas_uld_item_id}><TableCell>{item.barcode}</TableCell><TableCell>{item.awb_no || '--'}</TableCell><TableCell>{item.piece_count} / {item.weight_kg || 0} kg</TableCell><TableCell><StatusChip label={item.status} /></TableCell><TableCell align="right">{EDITABLE_HANDLING_STATES.includes(handling.status) && item.status === 'ASSIGNED' ? <Button size="small" color="error" onClick={() => run('CargoUnit 已移出 ULD', `${v14Endpoints.tasFlight(selectedId)}/ulds/${encodeURIComponent(uld.tas_uld_id)}/items/${encodeURIComponent(item.tas_uld_item_id)}`, { reason: 'Removed from TAS station management' }, 'delete')}>{m('移除')}</Button> : null}</TableCell></TableRow>)}</TableBody></Table> : null}
                    </Box>
                  ))}
                  {EDITABLE_HANDLING_STATES.includes(handling.status) && currentUld ? <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1 }}><TextField select fullWidth label={m('待装入 CargoUnit')} value={selectedCargoBarcode} onChange={(event) => setSelectedCargoBarcode(event.target.value)}><MenuItem value="">{m('请选择')}</MenuItem>{availableCargo.map((item) => <MenuItem key={item.cargo_unit_id} value={item.barcode}>{item.barcode} · {item.awb_no || item.shipment_id} · {item.aggregate_quantity} {m('件')}</MenuItem>)}</TextField><Button variant="contained" disabled={busy || !selectedCargoBarcode} onClick={async () => { const result = await run('CargoUnit 已装入 ULD', `${v14Endpoints.tasFlight(selectedId)}/ulds/${encodeURIComponent(currentUld.tas_uld_id)}/items`, { barcode: selectedCargoBarcode }); if (result) setSelectedCargoBarcode(''); }}>{m('装入 ULD')}</Button></Stack> : null}
                </Stack>
              </MainCard>

              <MainCard title={m('当前 Gate 动作')}>
                <Stack sx={{ gap: 1.5 }}>
                  <TextField label={m('证据 ID（多个用逗号分隔）')} value={actionForm.evidence} onChange={(event) => setActionForm({ ...actionForm, evidence: event.target.value })} />
                  {handling.status === 'PLANNING' ? <Button variant="contained" disabled={busy || !actionForm.evidence} onClick={() => run('最后一车到达并关闭收货', `${v14Endpoints.tasFlight(selectedId)}/receiving/close`, { occurred_at: new Date().toISOString(), evidence_ids: splitValues(actionForm.evidence) })}>{m('确认最后一车并进入组板')}</Button> : null}
                  {handling.status === 'BUILDUP' ? <Button variant="contained" disabled={busy || !actionForm.evidence} onClick={() => run('ULD 组板已完成', `${v14Endpoints.tasFlight(selectedId)}/buildup/complete`, { occurred_at: new Date().toISOString(), evidence_ids: splitValues(actionForm.evidence) })}>{m('完成 ULD 组板')}</Button> : null}
                  {handling.status === 'BUILT_UP' ? <><TextField label={m('Manifest 文档 ID')} value={actionForm.manifestDocumentId} onChange={(event) => setActionForm({ ...actionForm, manifestDocumentId: event.target.value })} /><TextField label={m('Manifest 版本')} value={actionForm.manifestVersion} onChange={(event) => setActionForm({ ...actionForm, manifestVersion: event.target.value })} /><Button variant="contained" disabled={busy || !actionForm.evidence || !actionForm.manifestDocumentId} onClick={() => run('Manifest 已冻结', `${v14Endpoints.tasFlight(selectedId)}/manifest/finalize`, { manifest_document_id: actionForm.manifestDocumentId, manifest_version: actionForm.manifestVersion, occurred_at: new Date().toISOString(), evidence_ids: splitValues(actionForm.evidence) })}>{m('冻结 Manifest')}</Button></> : null}
                  {handling.status === 'MANIFEST_FROZEN' ? <><TextField label={m('航空公司代码')} value={actionForm.airlineParty} onChange={(event) => setActionForm({ ...actionForm, airlineParty: event.target.value })} /><Button variant="contained" disabled={busy || !actionForm.evidence || !actionForm.airlineParty} onClick={() => run('ULD 已交航司', `${v14Endpoints.tasFlight(selectedId)}/handover`, { airline_party_code: actionForm.airlineParty, next_owner_accepted: true, occurred_at: new Date().toISOString(), evidence_ids: splitValues(actionForm.evidence) })}>{m('确认全部 ULD 交航司')}</Button></> : null}
                  {handling.status === 'HANDED_TO_AIRLINE' ? <Button variant="contained" disabled={busy || !actionForm.evidence} onClick={() => run('飞机装载已完成', `${v14Endpoints.tasFlight(selectedId)}/loading/complete`, { occurred_at: new Date().toISOString(), evidence_ids: splitValues(actionForm.evidence) })}>{m('确认装机完成')}</Button> : null}
                  {handling.status === 'LOADED' ? <><TextField label={m('起飞 Gate 原提交人 ID')} value={actionForm.requestedBy} onChange={(event) => setActionForm({ ...actionForm, requestedBy: event.target.value })} /><Button variant="contained" color="success" disabled={busy || !actionForm.evidence || !actionForm.requestedBy} onClick={() => run('TAS 航班已起飞', `${v14Endpoints.tasFlight(selectedId)}/departure`, { requested_by: actionForm.requestedBy, next_owner_accepted: true, occurred_at: new Date().toISOString(), evidence_ids: splitValues(actionForm.evidence) })}>{m('确认 TAS 实际起飞')}</Button></> : null}
                  {handling.status === 'DEPARTED' ? <Alert severity="success">{m('TAS–LGG 出港链路已闭环，航班已进入 B2 飞行监控。')}</Alert> : null}
                </Stack>
              </MainCard>
              <MainCard title={m('航班处理审计')}><AuditTable items={detail.data?.audit_events || []} m={m} l={l} /></MainCard>
            </Stack>
          ) : null}
        </Box>
      </Drawer>
    </Grid>
  );
}

function AuditTable({ items, m, l }) {
  return (
    <Table size="small">
      <TableHead><TableRow><TableCell>#</TableCell><TableCell>{m('时间')}</TableCell><TableCell>{m('事件')}</TableCell><TableCell>{m('操作人')}</TableCell></TableRow></TableHead>
      <TableBody>
        {items.map((item) => <TableRow key={item.operation_event_id}><TableCell>{item.aggregate_sequence}</TableCell><TableCell>{dateTime(item.occurred_at)}</TableCell><TableCell>{l(item.event_type)}</TableCell><TableCell>{item.actor_id}<Typography variant="caption" display="block">{item.actor_role}</Typography></TableCell></TableRow>)}
        {!items.length ? <TableRow><TableCell colSpan={4} align="center">{m('暂无审计事件。')}</TableCell></TableRow> : null}
      </TableBody>
    </Table>
  );
}
