import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CameraOutlined from '@ant-design/icons/CameraOutlined';
import InboxOutlined from '@ant-design/icons/InboxOutlined';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import StatusChip from 'components/sinoport/StatusChip';
import TaskCard from 'components/sinoport/mobile/TaskCard';
import TaskOpsPanel from 'components/sinoport/mobile/TaskOpsPanel';
import {
  acceptMobileTask,
  archiveOutboundContainer,
  archiveOutboundReceipt,
  completeMobileTask,
  saveOutboundContainer,
  saveOutboundReceipt,
  startMobileTask,
  updateOutboundContainer,
  updateOutboundReceipt,
  useGetMobileOutboundOptions,
  uploadMobileTaskEvidence,
  useGetMobileOutboundDetail,
  useGetMobileTasks
} from 'api/station';
import { openSnackbar } from 'api/snackbar';
import { readMobileSession } from 'utils/mobile/session';
import { localizeMobileText, readMobileLanguage } from 'utils/mobile/i18n';
import { buildMobileQueueEntry, recordMobileAction, useMobileOpsStorage } from 'utils/mobile/task-ops';

const EMPTY_MOBILE_OUTBOUND_ROLE_VIEW = Object.freeze({
  label: '',
  taskRoles: [],
  inboundTabs: [],
  outboundTabs: [],
  flowKeys: [],
  actionTypes: []
});

const EMPTY_MOBILE_OUTBOUND_PAGE_CONFIG = Object.freeze({
  taskCards: {}
});

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function cloneOutboundContainer(container) {
  return {
    ...container,
    entries: toArray(container.entries).map((entry) => ({ ...entry }))
  };
}

function cloneOutboundReceiptMap(receipts) {
  return Object.fromEntries(Object.entries(receipts || {}).map(([awbNo, value]) => [awbNo, { ...value }]));
}

function createOutboundFlight(flightNo) {
  return {
    flightId: '',
    flight_id: '',
    flightNo,
    flight_no: flightNo,
    source: '--',
    etd: '--',
    step: '--',
    stage: '--',
    priority: 'P2',
    cargo: '--',
    status: '待处理',
    manifest: '--',
    taskCount: 0,
    tasks: []
  };
}

const outboundFlightStores = new Map();

function getOutboundStore(flightNo) {
  const key = String(flightNo || '').trim();
  if (!key) return null;

  if (!outboundFlightStores.has(key)) {
    outboundFlightStores.set(key, {
      flight: createOutboundFlight(key),
      waybills: []
    });
  }

  return outboundFlightStores.get(key);
}

function syncOutboundStore(flightNo, detail) {
  const store = getOutboundStore(flightNo);
  if (!store) return null;

  if (detail?.flight) {
    Object.assign(store.flight, createOutboundFlight(flightNo), detail.flight, {
      flightNo: detail.flight.flightNo || detail.flight.flight_no || flightNo,
      flight_no: detail.flight.flight_no || detail.flight.flightNo || flightNo,
      flightId: detail.flight.flightId || detail.flight.flight_id || '',
      flight_id: detail.flight.flight_id || detail.flight.flightId || ''
    });
  }

  const waybills = toArray(detail?.waybills).map((item) => ({ ...item }));
  store.waybills.splice(0, store.waybills.length, ...waybills);

  return store;
}

function useOutboundDetailData(flightNo) {
  const detailState = useGetMobileOutboundDetail(flightNo);
  if (flightNo) {
    syncOutboundStore(flightNo, detailState.mobileOutboundFlightDetail);
  }

  return detailState;
}

function bindTaskCardActions(card, runAction) {
  if (!card) return null;

  return {
    ...card,
    title: localizeOutboundTaskCardText(card.title),
    node: localizeOutboundTaskCardText(card.node),
    role: localizeOutboundTaskCardText(card.role),
    status: localizeOutboundTaskCardText(card.status),
    sla: localizeOutboundTaskCardText(card.sla),
    description: localizeOutboundTaskCardText(card.description),
    evidence: toArray(card.evidence).map(localizeOutboundTaskCardText),
    blockers: toArray(card.blockers).map(localizeOutboundTaskCardText),
    actions: toArray(card.actions).map((action) => ({
      ...action,
      label: localizeOutboundTaskCardText(action.label),
      onClick: () => runAction(action.label, `${card.node} / ${card.role}`)
    }))
  };
}

export function parseNumber(value) {
  const parsed = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function normalizeCode(value) {
  return value.trim().toUpperCase();
}

function mobileLanguage() {
  return readMobileLanguage() || readMobileSession()?.language;
}

function mt(value) {
  return localizeMobileText(mobileLanguage(), value);
}

function isMobileEnglish() {
  return String(mobileLanguage() || '').toLowerCase().startsWith('en');
}

function localizeOutboundTaskCardText(value) {
  if (typeof value !== 'string' || !value) return value;
  if (!isMobileEnglish()) return value;

  return value
    .replace(/待复核/gu, 'Pending Review')
    .replace(/待Review/gu, 'Pending Review')
    .replace(/出港机场货站操作/gu, 'Outbound Station Actions')
    .replace(/OUTBOUND机场STATIONACTIONS/gu, 'Outbound Station Actions')
    .replace(/出港机场机坪操作/gu, 'Outbound Airport Ramp Operations')
    .replace(/OUTBOUND机场机坪ACTIONS/gu, 'Outbound Airport Ramp Operations')
    .replace(/按 AWB 录入收货件数并完成重量复核。/gu, 'Enter received pieces by AWB and complete the weight review.')
    .replace(/按 AWB Enter ReCeived PieCes并CompleteWeight Review。/gu, 'Enter received pieces by AWB and complete the weight review.')
    .replace(/收货后 30 分钟/gu, '30 minutes after receiving')
    .replace(/SLA ReCeiving后 30 分钟/gu, 'SLA 30 minutes after receiving')
    .replace(/SLA Load to AirCraft前 45 分钟/gu, 'SLA 45 minutes before load to aircraft')
    .replace(/SLA ETD 前 30 分钟/gu, 'SLA 30 minutes before ETD')
    .replace(/SLA Airborne前闭环/gu, 'SLA close before airborne')
    .replace(/未完成收货不得打开组板和机坪放行。/gu, 'Do not open pallet build-up or ramp release until receiving is complete.')
    .replace(/未CompleteReCeiving不得Open组板和机坪Release。/gu, 'Do not open pallet build-up or ramp release until receiving is complete.')
    .replace(/NoneContainer Code或ReviewWeight时不得OpenLoad to AirCraft。/gu, 'Load to Aircraft cannot be opened without a container code or reviewed weight.')
    .replace(/NoneContainer号或ReviewWeight时不得OpenLoad to AirCraft。/gu, 'Load to Aircraft cannot be opened without a container code or reviewed weight.');
}

function localizeReviewStatus(value) {
  if (!isMobileEnglish()) return mt(value);
  if (value === '待复核' || value === '待Review') return 'Pending Review';
  if (value === '已复核') return 'Reviewed';
  if (value === '已收货') return 'Received';
  return mt(value);
}

function recognizeContainerCode(file) {
  const upperName = file.name.toUpperCase();
  const match = upperName.match(/(ULD|PMC|AKE|PAG)[-_ ]?([A-Z0-9]{3,})/);
  if (match) return `${match[1]}${match[2]}`;
  return `ULD${String(Date.now()).slice(-5)}`;
}

export function getOutboundFlight(flightNo) {
  const store = getOutboundStore(flightNo);
  return store?.flight || null;
}

export function buildOutboundWaybills(flightNo) {
  const store = getOutboundStore(flightNo);
  return store?.waybills || [];
}

export function getOutboundSummary(flight) {
  const plannedAwbs = buildOutboundWaybills(flight?.flightNo);
  return {
    plannedAwbCount: plannedAwbs.length,
    plannedPieces: plannedAwbs.reduce((sum, item) => sum + Number(item.expectedBoxes ?? item.pieces ?? 0), 0),
    plannedWeight: plannedAwbs.reduce((sum, item) => sum + Number(item.totalWeightKg ?? item.totalWeight ?? 0), 0)
  };
}

export function useOutboundStorage(flightNo) {
  const { mobileOutboundFlightDetail } = useOutboundDetailData(flightNo);
  const { mobileOutboundOptions } = useGetMobileOutboundOptions(flightNo);
  const pmcBoards = toArray(mobileOutboundFlightDetail?.containers).map(cloneOutboundContainer);
  const receiptMap = cloneOutboundReceiptMap(mobileOutboundFlightDetail?.receipts);

  return {
    pmcBoards,
    setPmcBoards: (updater) => {
      const next = typeof updater === 'function' ? updater(pmcBoards) : updater;
      const nextByCode = new Map((next || []).map((item) => [item.boardCode, item]));
      const currentByCode = new Map((pmcBoards || []).map((item) => [item.boardCode, item]));

      (next || []).forEach((item) => {
        const previous = currentByCode.get(item.boardCode);
        const payload = {
          container_id: item.containerId,
          boardCode: item.boardCode,
          totalBoxes: item.totalBoxes,
          totalWeightKg: item.totalWeightKg,
          reviewedWeightKg: item.reviewedWeightKg,
          status: item.status,
          loadedAt: item.loadedAt,
          note: item.note,
          offloadBoxes: item.offloadBoxes,
          offloadStatus: item.offloadStatus,
          offloadRecordedAt: item.offloadRecordedAt,
          archived: item.archived,
          entries: item.entries
        };

        if (!previous) {
          void saveOutboundContainer(flightNo, payload);
          return;
        }

        if (JSON.stringify(previous) !== JSON.stringify(item)) {
          void updateOutboundContainer(item.boardCode, payload);
        }
      });

      (pmcBoards || []).forEach((item) => {
        if (!nextByCode.has(item.boardCode)) {
          void archiveOutboundContainer(item.boardCode, true);
        }
      });
    },
    receiptMap,
    setReceiptMap: (updater) => {
      const next = typeof updater === 'function' ? updater(receiptMap) : updater;
      const nextEntries = Object.entries(next || {});
      const currentEntries = Object.entries(receiptMap || {});
      const nextMap = new Map(nextEntries);
      const currentMap = new Map(currentEntries);

      nextEntries.forEach(([awbNo, value]) => {
        const previous = currentMap.get(awbNo);
        const payload = {
          received_pieces: value?.receivedPieces || 0,
          received_weight: value?.receivedWeight || 0,
          status: value?.status || '待收货',
          review_status: value?.reviewStatus || '待复核',
          reviewed_weight: value?.reviewedWeight || 0,
          reviewed_at: value?.reviewedAt || null,
          note: value?.note || '',
          archived: value?.archived || false
        };

        if (!previous) {
          void saveOutboundReceipt(flightNo, awbNo, payload);
          return;
        }

        if (JSON.stringify(previous) !== JSON.stringify(value)) {
          void updateOutboundReceipt(flightNo, awbNo, payload);
        }
      });

      currentEntries.forEach(([awbNo]) => {
        if (!nextMap.has(awbNo)) {
          void archiveOutboundReceipt(flightNo, awbNo, true);
        }
      });
    },
    receiptStatusOptions: mobileOutboundOptions.receiptStatusOptions || [],
    reviewStatusOptions: mobileOutboundOptions.reviewStatusOptions || [],
    containerStatusOptions: mobileOutboundOptions.containerStatusOptions || [],
    offloadStatusOptions: mobileOutboundOptions.offloadStatusOptions || [],
    awbOptions: mobileOutboundOptions.awbOptions || [],
    containerOptions: mobileOutboundOptions.containerOptions || [],
    createOutboundContainer: async (payload) => saveOutboundContainer(flightNo, payload),
    updateOutboundContainer: async (containerCode, payload) => updateOutboundContainer(containerCode, payload),
    archiveOutboundContainer: async (containerCode, archived = true) => archiveOutboundContainer(containerCode, archived),
    createOutboundReceipt: async (awbNo, payload) => saveOutboundReceipt(flightNo, awbNo, payload),
    updateOutboundReceipt: async (awbNo, payload) => updateOutboundReceipt(flightNo, awbNo, payload),
    archiveOutboundReceipt: async (awbNo, archived = true) => archiveOutboundReceipt(flightNo, awbNo, archived)
  };
}

function useOutboundTaskContext(flightNo) {
  const session = readMobileSession();
  const { mobileOutboundFlightDetail } = useOutboundDetailData(flightNo);
  const detail = mobileOutboundFlightDetail || {};
  const roleView = detail.roleView || EMPTY_MOBILE_OUTBOUND_ROLE_VIEW;
  const taskCards = detail.pageConfig?.taskCards || EMPTY_MOBILE_OUTBOUND_PAGE_CONFIG.taskCards;
  const availableTabs = toArray(detail.availableTabs);
  const availableActions = toArray(detail.availableActions);
  const liveFlight = detail.flight || getOutboundFlight(flightNo) || createOutboundFlight(flightNo);
  const opsStorage = useMobileOpsStorage(`outbound-flight-${flightNo}`);

  const runScopedAction = (label, taskLabel) => {
    opsStorage.setState((prev) =>
      recordMobileAction(
        prev,
        buildMobileQueueEntry(session, {
          label,
          taskLabel,
          payloadSummary: `${flightNo} / ${taskLabel}`,
          roleLabel: roleView.label
        })
      )
    );
  };

  return {
    roleView,
    taskCards,
    availableTabs,
    availableActions,
    liveFlight,
    runScopedAction,
    opsState: opsStorage.state,
    setOpsState: opsStorage.setState
  };
}

export function OutboundFlightHeroCard({ flight }) {
  const liveFlight = getOutboundFlight(flight?.flightNo) || flight;
  const summary = getOutboundSummary(liveFlight);

  return (
    <MainCard>
      <Stack sx={{ gap: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <div>
            <Typography variant="overline" color="primary.main">
              {mt('当前航班')}
            </Typography>
            <Typography variant="h3" sx={{ mt: 0.5 }}>
              {liveFlight.flightNo}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              ETD {liveFlight.etd} · {mt('当前阶段')} {mt(liveFlight.stage)} · Manifest {mt(liveFlight.manifest)}
            </Typography>
          </div>
          <StatusChip label={mt(liveFlight.status)} />
        </Stack>

        <Grid container spacing={1.5}>
          <Grid size={4}>
            <MetricCard title={mt('提单总数')} value={`${summary.plannedAwbCount}`} helper={mt('当前航班计划提单数')} chip={mt('提单')} />
          </Grid>
          <Grid size={4}>
            <MetricCard title={mt('计划件数')} value={`${summary.plannedPieces}`} helper={mt('来自航班计划数据')} color="secondary" />
          </Grid>
          <Grid size={4}>
            <MetricCard title={mt('计划重量')} value={`${summary.plannedWeight.toFixed(1)} kg`} helper={mt('用于装机校验')} color="success" />
          </Grid>
        </Grid>
      </Stack>
    </MainCard>
  );
}

export function OutboundOverviewPanel({ flight, pmcBoards = [], receiptMap = {} }) {
  const { taskCards, runScopedAction } = useOutboundTaskContext(flight.flightNo);
  const summary = getOutboundSummary(flight);
  const flightContainers = pmcBoards.filter((item) => item.flightNo === flight.flightNo);
  const flightReceipts = Object.values(receiptMap).filter((item) => item.flightNo === flight.flightNo);
  const flightAwbs = buildOutboundWaybills(flight.flightNo);
  const overviewTaskCard = bindTaskCardActions(taskCards.overview, runScopedAction);

  return (
    <Stack sx={{ gap: 2 }}>
      {overviewTaskCard ? <TaskCard {...overviewTaskCard} /> : null}

      <MainCard title={mt('航班概览')}>
        <Grid container spacing={1.5}>
          <Grid size={4}>
            <MetricCard title={mt('已收货提单')} value={`${flightReceipts.length}`} helper={mt('已开始收货的提单')} />
          </Grid>
          <Grid size={4}>
            <MetricCard title={mt('集装器数量')} value={`${flightContainers.length}`} helper={mt('当前航班已建集装器')} color="secondary" />
          </Grid>
          <Grid size={4}>
            <MetricCard title={mt('计划重量')} value={`${summary.plannedWeight.toFixed(1)} kg`} helper={mt('用于装机校验')} color="success" />
          </Grid>
        </Grid>
      </MainCard>

      <MainCard title={mt('计划提单明细')}>
        <Stack sx={{ gap: 1.25 }}>
          {flightAwbs.map((item) => (
            <Box key={item.awb} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
              <Typography variant="subtitle2">{item.awb}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {`${mt('目的地')} ${mt(item.destination)} · ${mt('计划件数')} ${item.totalPieces} · ${mt('计划重量')} ${item.totalWeight} kg`}
                      </Typography>
            </Box>
          ))}
        </Stack>
      </MainCard>
    </Stack>
  );
}

export function OutboundFlightAppShell({ flight, children, showHero = true, showOps = showHero }) {
  const navigate = useNavigate();
  const { roleView, liveFlight } = useOutboundTaskContext(flight.flightNo);
  const { mobileTasks } = useGetMobileTasks();
  const liveTasks = mobileTasks.filter((task) => task.flight_no === flight.flightNo);

  const handleLiveTaskAction = async (task, action) => {
    try {
      if (action === 'accept') await acceptMobileTask(task.task_id, { note: 'Accepted from outbound TaskOpsPanel' });
      if (action === 'start') await startMobileTask(task.task_id, { note: 'Started from outbound TaskOpsPanel' });
      if (action === 'evidence') {
        await uploadMobileTaskEvidence(task.task_id, {
          note: 'Evidence from outbound TaskOpsPanel',
          evidence_summary: 'TaskOpsPanel outbound evidence'
        });
      }
      if (action === 'complete') await completeMobileTask(task.task_id, { note: 'Completed from outbound TaskOpsPanel' });

      openSnackbar({
        open: true,
        message: mt(`任务 ${task.task_id} 已执行 ${mt(action)}`),
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || mt(`任务 ${mt(action)} 失败`),
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  return (
    <Box>
      <Stack sx={{ gap: 1.5 }}>
        {showHero ? <OutboundFlightHeroCard flight={flight} /> : null}
        {showOps ? (
          <TaskOpsPanel
            scopeKey={`outbound-flight-${flight.flightNo}`}
            currentLabel={flight.flightNo}
            contextChips={[
              `${mt('角色')} ${mt(roleView.label)}`,
              `${mt('当前阶段')} ${mt(liveFlight.stage)}`,
              `Manifest ${mt(liveFlight.manifest)}`
            ]}
            quickLinks={[
              { label: mt('节点选择'), onClick: () => navigate('/mobile/select') },
              { label: mt('航班列表'), onClick: () => navigate('/mobile/outbound') }
            ]}
            liveTasks={liveTasks}
            onTaskAction={handleLiveTaskAction}
          />
        ) : null}
        {children}
      </Stack>
    </Box>
  );
}

export function ReceiptPanel({ flightNo, receiptMap, setReceiptMap }) {
  const { taskCards, runScopedAction } = useOutboundTaskContext(flightNo);
  const navigate = useNavigate();
  const scanInputRef = useRef(null);
  const [scanValue, setScanValue] = useState('');
  const [activeAwb, setActiveAwb] = useState('');
  const [receiptCount, setReceiptCount] = useState('');
  const [reviewAwb, setReviewAwb] = useState('');
  const [reviewWeight, setReviewWeight] = useState('');
  const [message, setMessage] = useState(mt('先扫描一个提单号，再录入该提单的收货件数。'));

  useEffect(() => {
    scanInputRef.current?.focus();
  }, [flightNo]);

  const flightAwbs = buildOutboundWaybills(flightNo);
  const receivedItems = flightAwbs.filter((item) => receiptMap[item.awb]?.flightNo === flightNo);
  const receiptTaskCard = bindTaskCardActions(taskCards.receipt, runScopedAction);

  const attachReceipt = (rawCode) => {
    const code = normalizeCode(rawCode);
    const matched = flightAwbs.find((item) => normalizeCode(item.awb) === code);

    if (!matched) {
      setMessage(mt(`未找到提单 ${rawCode}。`));
      return;
    }

    setActiveAwb(matched.awb);
    setScanValue(matched.awb);
    setReceiptCount(receiptMap[matched.awb]?.receivedPieces ? String(receiptMap[matched.awb].receivedPieces) : '');
    runScopedAction('扫码', `出港收货 / ${matched.awb}`);
    setMessage(mt(`提单 ${matched.awb} 已识别，请录入该提单的收货件数。`));
  };

  const saveReceiptCount = () => {
    if (!activeAwb || !receiptCount) return;
    const matched = flightAwbs.find((item) => item.awb === activeAwb);
    if (!matched) return;

    setReceiptMap((prev) => ({
      ...prev,
      [matched.awb]: {
        ...prev[matched.awb],
        ...matched,
        flightNo,
        receivedPieces: parseNumber(receiptCount),
        status: '已收货',
        reviewStatus: prev[matched.awb]?.reviewStatus || '待复核',
        receivedAt: new Date().toISOString(),
        archived: false
      }
    }));
    runScopedAction('确认', `收货件数 / ${matched.awb}`);
    setMessage(mt(`提单 ${matched.awb} 收货件数已记录为 ${receiptCount}。`));
    setReceiptCount('');
  };

  const saveReviewWeight = () => {
    if (!reviewAwb || !reviewWeight) return;
    setReceiptMap((prev) => ({
      ...prev,
      [reviewAwb]: {
        ...prev[reviewAwb],
        status: '已复核',
        reviewedWeight: parseNumber(reviewWeight),
        reviewedAt: new Date().toISOString(),
        reviewStatus: '已复核'
      }
    }));
    runScopedAction('确认', `重量复核 / ${reviewAwb}`);
    setReviewAwb('');
    setReviewWeight('');
  };

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title={mt('收货扫描')}>
        <Stack sx={{ gap: 2 }}>
          <Stack direction="row" sx={{ gap: 1.5 }}>
            <TextField
              inputRef={scanInputRef}
              fullWidth
              autoFocus
              label={mt('扫描提单号')}
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  attachReceipt(scanValue);
                }
              }}
              placeholder={mt('扫码后自动回车')}
            />
            <Button variant="contained" startIcon={<InboxOutlined />} onClick={() => attachReceipt(scanValue)}>
              {mt('收货')}
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {mt(message)}
          </Typography>
        </Stack>
      </MainCard>

      {activeAwb ? (
        <MainCard title={mt('录入收货件数')}>
          <Stack sx={{ gap: 2 }}>
            <Typography variant="subtitle2">{activeAwb}</Typography>
            <TextField label={mt('收货件数')} value={receiptCount} onChange={(event) => setReceiptCount(event.target.value)} />
            <Button variant="contained" disabled={!receiptCount} onClick={saveReceiptCount}>
              {mt('保存件数')}
            </Button>
          </Stack>
        </MainCard>
      ) : null}

      <MainCard title={mt('已收货提单')}>
        <Stack sx={{ gap: 1.25 }}>
          {receivedItems.length ? (
            receivedItems.map((item) => {
              const receipt = receiptMap[item.awb];
              return (
                <Box key={item.awb} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <div>
                      <Typography variant="subtitle2">{item.awb}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {`${mt('收货件数')} ${receipt?.receivedPieces || 0} / ${mt('计划件数')} ${item.totalPieces} · ${mt('计划重量')} ${item.totalWeight} kg`}
                      </Typography>
                    </div>
                    <StatusChip label={localizeReviewStatus(receipt?.reviewStatus || '已收货')} color={receipt?.reviewStatus === '已复核' ? 'success' : 'secondary'} />
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 1, gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => navigate(`/mobile/outbound/${flightNo}/receipt/counting/${encodeURIComponent(item.awb)}`)}>
                      {mt('点数')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setReviewAwb(item.awb);
                        setReviewWeight(receipt?.reviewedWeight ? String(receipt.reviewedWeight) : '');
                      }}
                    >
                      {mt('复核')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        setReceiptMap((prev) => ({
                          ...prev,
                          [item.awb]: {
                            ...prev[item.awb],
                            status: '待收货',
                            reviewStatus: '待复核',
                            reviewedWeight: 0,
                            reviewedAt: null,
                            archived: false
                          }
                        }))
                      }
                    >
                      {mt('重开')}
                    </Button>
                  </Stack>
                </Box>
              );
            })
          ) : (
            <Typography color="text.secondary">{mt('当前航班还没有已收货提单。')}</Typography>
          )}
        </Stack>
      </MainCard>

      {receiptTaskCard ? <TaskCard {...receiptTaskCard} /> : null}

      <Dialog open={!!reviewAwb} fullWidth maxWidth="xs" onClose={() => setReviewAwb('')}>
        <DialogTitle>{mt('重量复核')}</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 0.5 }}>
            <Typography variant="subtitle2">{reviewAwb}</Typography>
            <TextField label={mt('复核重量(kg)')} value={reviewWeight} onChange={(event) => setReviewWeight(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewAwb('')}>{mt('取消')}</Button>
          <Button variant="contained" onClick={saveReviewWeight} disabled={!reviewWeight}>
            {mt('保存复核')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export function ContainerListPanel({ flightNo, pmcBoards }) {
  const { taskCards, runScopedAction } = useOutboundTaskContext(flightNo);
  const navigate = useNavigate();
  const flightContainers = pmcBoards.filter((item) => item.flightNo === flightNo);
  const containerTaskCard = bindTaskCardActions(taskCards.container, runScopedAction);

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title={mt('集装器')}>
        <Stack sx={{ gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {mt('ULD / 集装器应由后台办公室先完成预排并分配机位；PDA 仅执行已排好的集装与装机。')}
          </Typography>
          <Button variant="outlined" onClick={() => navigate('/station/outbound/flights')}>
            {mt('去后台排 ULD')}
          </Button>
        </Stack>
      </MainCard>

      <MainCard title={mt('当前航班已有集装器')}>
        <Stack sx={{ gap: 1.25 }}>
          {flightContainers.length ? (
            flightContainers.map((container) => (
              <Box key={container.boardCode} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <div>
                    <Typography variant="subtitle2">{container.boardCode}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {`${container.entries.length} ${mt('票')} / ${container.totalBoxes} ${mt('箱')} / ${container.reviewedWeightKg || container.totalWeightKg} kg`}
                      </Typography>
                  </div>
                  <StatusChip label={mt(container.status)} />
                </Stack>
                <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 1 }}>
                  <Button size="small" variant="contained" onClick={() => navigate(`/mobile/outbound/${flightNo}/pmc/${encodeURIComponent(container.boardCode)}`)}>
                    {mt('装货')}
                  </Button>
                </Stack>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">{mt('当前航班还没有集装器。')}</Typography>
          )}
        </Stack>
      </MainCard>

      {containerTaskCard ? <TaskCard {...containerTaskCard} /> : null}
    </Stack>
  );
}

export function ContainerCreatePanel({ flightNo, pmcBoards, setPmcBoards }) {
  const { taskCards, runScopedAction } = useOutboundTaskContext(flightNo);
  const navigate = useNavigate();
  const [message, setMessage] = useState(mt('输入集装器号码或拍照识别后，点击完成即可创建。'));
  const [form, setForm] = useState({ boardCode: '', photoName: '' });

  const canSubmit = form.boardCode.trim();
  const containerTaskCard = bindTaskCardActions(taskCards.container, runScopedAction);

  return (
    <Stack sx={{ gap: 2 }}>
      {containerTaskCard ? <TaskCard {...containerTaskCard} /> : null}

      <MainCard title={mt('新建集装器')}>
        <Stack sx={{ gap: 2 }}>
          <Button component="label" fullWidth variant="contained" startIcon={<CameraOutlined />}>
            {mt('拍摄 / 上传集装器照片')}
            <input
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const boardCode = recognizeContainerCode(file);
                setForm({ boardCode, photoName: file.name });
                setMessage(`${mt('已识别集装器号：')}${boardCode}`);
              }}
            />
          </Button>

          <TextField
            label={mt('集装器号码')}
            value={form.boardCode}
            onChange={(event) => setForm((prev) => ({ ...prev, boardCode: event.target.value.toUpperCase() }))}
          />

          <Typography variant="body2" color="text.secondary">
            {mt(message)}
          </Typography>
        </Stack>
      </MainCard>

      <MainCard title={mt('完成创建')}>
        <Stack sx={{ gap: 2 }}>
          <Button
            fullWidth
            size="large"
            variant="contained"
            disabled={!canSubmit}
            onClick={() => {
              const normalizedCode = form.boardCode.trim().toUpperCase();
              runScopedAction('确认', `集装器创建 / ${normalizedCode}`);
              setPmcBoards((prev) => [
                {
                  boardCode: normalizedCode,
                  photoName: form.photoName,
                  flightNo,
                  entries: [],
                  totalBoxes: 0,
                  totalWeightKg: 0,
                  reviewedWeightKg: 0,
                  status: '待装机',
                  createdAt: new Date().toISOString()
                },
                ...prev
              ]);
              navigate(`/mobile/outbound/${flightNo}/pmc`, { replace: true });
            }}
          >
            {mt('完成')}
          </Button>
        </Stack>
      </MainCard>
    </Stack>
  );
}

export function ContainerDetailPanel({ flightNo, containerCode, pmcBoards, setPmcBoards }) {
  const { runScopedAction } = useOutboundTaskContext(flightNo);
  const navigate = useNavigate();
  const scanInputRef = useRef(null);
  const [scanValue, setScanValue] = useState('');
  const [activeAwb, setActiveAwb] = useState('');
  const [message, setMessage] = useState(mt('使用条码枪扫描提单号后，会按件数逐件累加到当前集装器。'));
  const [entry, setEntry] = useState({ awb: '', boxes: '', pieces: '' });

  const flightAwbs = buildOutboundWaybills(flightNo);
  const container = pmcBoards.find((item) => item.flightNo === flightNo && item.boardCode === containerCode);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, [containerCode]);

  if (!container) {
    return null;
  }

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title={mt('当前集装器')}>
        <Stack sx={{ gap: 2 }}>
          <Typography variant="h5">{container.boardCode}</Typography>
          <Typography variant="body2" color="text.secondary">
            {`${mt('当前已录入')} ${container.entries.length} ${mt('票')} / ${container.totalBoxes} ${mt('箱')} / ${container.reviewedWeightKg || container.totalWeightKg} kg`}
          </Typography>

          <Stack direction="row" sx={{ gap: 1.5 }}>
            <Button variant="contained" onClick={() => scanInputRef.current?.focus()}>
              {mt('追加提单')}
            </Button>
            <Button variant="outlined" disabled={!entry.awb && !activeAwb} onClick={() => navigate(`/mobile/outbound/${flightNo}/receipt/counting/${encodeURIComponent(entry.awb || activeAwb)}`)}>
              {mt('点数')}
            </Button>
          </Stack>
        </Stack>
      </MainCard>

      <MainCard title={mt('扫描追加提单')}>
        <Stack sx={{ gap: 2 }}>
          <Stack direction="row" sx={{ gap: 1.5 }}>
            <TextField
              inputRef={scanInputRef}
              fullWidth
              autoFocus
              label={mt('扫描提单号')}
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const matched = flightAwbs.find((item) => normalizeCode(item.awb) === normalizeCode(scanValue));
                  if (!matched) {
                    setMessage(mt(`未找到提单 ${scanValue}。`));
                    return;
                  }
                  setActiveAwb(matched.awb);
                  setEntry((prev) => ({
                    ...prev,
                    awb: matched.awb,
                    pieces: String((Number(prev.pieces) || 0) + 1),
                    boxes: prev.boxes || '1'
                  }));
                  setScanValue(matched.awb);
                  setMessage(mt(`提单 ${matched.awb} 已扫描，当前准备追加 ${Number(entry.pieces || 0) + 1} 件。`));
                }
              }}
              placeholder={mt('扫码后自动回车逐件累加')}
            />
            <Button
              variant="contained"
              startIcon={<InboxOutlined />}
              onClick={() => {
                const matched = flightAwbs.find((item) => normalizeCode(item.awb) === normalizeCode(scanValue));
                if (!matched) {
                  setMessage(mt(`未找到提单 ${scanValue}。`));
                  return;
                }
                runScopedAction('扫码', `集装器扫描 / ${matched.awb}`);
                setActiveAwb(matched.awb);
                setEntry((prev) => ({
                  ...prev,
                  awb: matched.awb,
                  pieces: String((Number(prev.pieces) || 0) + 1),
                  boxes: prev.boxes || '1'
                }));
                setScanValue(matched.awb);
                setMessage(mt(`提单 ${matched.awb} 已扫描，当前准备追加 ${Number(entry.pieces || 0) + 1} 件。`));
              }}
            >
              {mt('扫描')}
            </Button>
          </Stack>

          <Grid container spacing={1.5}>
            <Grid size={6}>
              <TextField
                select
                label={mt('提单号')}
                value={entry.awb}
                onChange={(event) => setEntry((prev) => ({ ...prev, awb: event.target.value }))}
              >
                {flightAwbs.map((item) => (
                  <MenuItem key={item.awb} value={item.awb}>
                    {item.awb}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={3}>
              <TextField label={mt('件数')} value={entry.pieces} onChange={(event) => setEntry((prev) => ({ ...prev, pieces: event.target.value }))} />
            </Grid>
            <Grid size={3}>
              <TextField label={mt('箱数')} value={entry.boxes} onChange={(event) => setEntry((prev) => ({ ...prev, boxes: event.target.value }))} />
            </Grid>
          </Grid>

          <Button
            variant="contained"
            disabled={!entry.awb || !entry.boxes || !entry.pieces}
            onClick={() => {
              const awbMeta = flightAwbs.find((item) => item.awb === entry.awb);
              const weight = awbMeta?.unitWeight ? (awbMeta.unitWeight * parseNumber(entry.pieces)).toFixed(1) : '0.0';
              runScopedAction('追加提单', `集装器追加 / ${entry.awb}`);
              setPmcBoards((prev) =>
                prev.map((container) =>
                  container.boardCode === containerCode
                    ? {
                        ...container,
                        entries: [
                          ...container.entries,
                          {
                            awb: entry.awb,
                            pieces: parseNumber(entry.pieces),
                            boxes: parseNumber(entry.boxes),
                            weight
                          }
                        ],
                        totalBoxes: container.entries.reduce((sum, item) => sum + parseNumber(item.boxes), 0) + parseNumber(entry.boxes),
                        totalWeightKg: Number(
                          (
                            container.entries.reduce((sum, item) => sum + parseNumber(item.weight), 0) +
                            parseNumber(weight)
                          ).toFixed(1)
                        )
                      }
                    : container
                )
              );
              setEntry({ awb: '', pieces: '', boxes: '' });
              setActiveAwb('');
            }}
          >
            {mt('追加提单')}
          </Button>

          <Typography variant="body2" color="text.secondary">
            {mt(message)}
          </Typography>
        </Stack>
      </MainCard>

      <MainCard title={mt('集装器内提单')}>
        <Stack sx={{ gap: 1.25 }}>
          {container.entries.length ? (
            container.entries.map((item, index) => (
              <Box key={`${item.awb}-${index}`} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2">{item.awb}</Typography>
                  <Typography variant="subtitle2">{`${item.pieces} ${mt('件')}`}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {`${mt('箱数')} ${item.boxes} / ${mt('重量')} ${item.weight} kg`}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">{mt('当前集装器还没有提单。')}</Typography>
          )}
        </Stack>
      </MainCard>
    </Stack>
  );
}

export function LoadingPanel({ flightNo, pmcBoards, setPmcBoards }) {
  const { taskCards, runScopedAction } = useOutboundTaskContext(flightNo);
  const [activeContainerCode, setActiveContainerCode] = useState('');
  const [offloadBoxes, setOffloadBoxes] = useState('');
  const containers = pmcBoards.filter((item) => item.flightNo === flightNo);
  const pendingContainers = containers.filter((item) => item.status !== '已装机');
  const loadedContainers = containers.filter((item) => item.status === '已装机');
  const loadingTaskCard = bindTaskCardActions(taskCards.loading, runScopedAction);

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title={mt('待装机集装器')}>
        <Stack sx={{ gap: 1.25 }}>
          {pendingContainers.length ? (
            pendingContainers.map((item) => (
              <Box key={item.boardCode} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <div>
                    <Typography variant="subtitle2">{item.boardCode}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {`${item.entries.length} ${mt('票')} / ${item.totalBoxes} ${mt('箱')} / ${mt('复核')} ${item.reviewedWeightKg || item.totalWeightKg} kg`}
                    </Typography>
                  </div>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      runScopedAction('完成', `出港装机 / ${item.boardCode}`);
                      setPmcBoards((prev) =>
                        prev.map((container) =>
                          container.boardCode === item.boardCode ? { ...container, status: '已装机', loadedAt: new Date().toISOString() } : container
                        )
                      );
                    }}
                  >
                    {mt('装机')}
                  </Button>
                </Stack>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">{mt('当前航班没有待装机集装器。')}</Typography>
          )}
        </Stack>
      </MainCard>

      <MainCard title={mt('已装机集装器')}>
        <Stack sx={{ gap: 1.25 }}>
          {loadedContainers.length ? (
            loadedContainers.map((item) => (
              <Box key={item.boardCode} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <div>
                    <Typography variant="subtitle2">{item.boardCode}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {`${mt('已装机')} · ${item.totalBoxes} ${mt('箱')} / ${item.reviewedWeightKg || item.totalWeightKg} kg`}
                    </Typography>
                  </div>
                  <StatusChip label={item.offloadBoxes ? mt('警戒') : mt('已完成')} color={item.offloadBoxes ? 'warning' : 'success'} />
                </Stack>

                <Stack direction="row" sx={{ gap: 1, mt: 1 }}>
                  <TextField
                    size="small"
                    label={mt('拉货箱数')}
                    value={activeContainerCode === item.boardCode ? offloadBoxes : item.offloadBoxes || ''}
                    onChange={(event) => {
                      setActiveContainerCode(item.boardCode);
                      setOffloadBoxes(event.target.value);
                    }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      runScopedAction('确认', `拉货记录 / ${item.boardCode}`);
                      setPmcBoards((prev) =>
                        prev.map((container) =>
                          container.boardCode === item.boardCode
                            ? {
                                ...container,
                                offloadBoxes: parseNumber(activeContainerCode === item.boardCode ? offloadBoxes : item.offloadBoxes || 0),
                                offloadStatus:
                                  parseNumber(activeContainerCode === item.boardCode ? offloadBoxes : item.offloadBoxes || 0) > 0 ? '已拉货' : '无拉货'
                              }
                            : container
                        )
                      );
                    }}
                  >
                    {mt('记录拉货')}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      runScopedAction('确认', `重开装机 / ${item.boardCode}`);
                      setPmcBoards((prev) =>
                        prev.map((container) =>
                          container.boardCode === item.boardCode
                            ? {
                                ...container,
                                status: '待装机',
                                loadedAt: null,
                                offloadBoxes: 0,
                                offloadStatus: '无拉货',
                                offloadRecordedAt: null
                              }
                            : container
                        )
                      );
                    }}
                  >
                    {mt('重开')}
                  </Button>
                </Stack>

                {item.offloadBoxes ? (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.75, display: 'block' }}>
                    {`${mt('已记录拉货')} ${item.offloadBoxes} ${mt('箱')}`}
                  </Typography>
                ) : null}
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">{mt('当前航班还没有已装机集装器。')}</Typography>
          )}
        </Stack>
      </MainCard>

      {loadingTaskCard ? <TaskCard {...loadingTaskCard} /> : null}
    </Stack>
  );
}
