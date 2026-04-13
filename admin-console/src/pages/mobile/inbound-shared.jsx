import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JsBarcode from 'jsbarcode';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import BarcodeOutlined from '@ant-design/icons/BarcodeOutlined';
import CarOutlined from '@ant-design/icons/CarOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import PrinterOutlined from '@ant-design/icons/PrinterOutlined';
import SearchOutlined from '@ant-design/icons/SearchOutlined';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import StatusChip from 'components/sinoport/StatusChip';
import TaskCard from 'components/sinoport/mobile/TaskCard';
import TaskOpsPanel from 'components/sinoport/mobile/TaskOpsPanel';
import {
  acceptMobileTask,
  completeMobileTask,
  getInboundCountRecords,
  getInboundLoadingPlans,
  getInboundPallets,
  saveInboundCountRecord,
  saveInboundLoadingPlan,
  saveInboundPallet,
  startMobileTask,
  uploadMobileTaskEvidence,
  useGetMobileTasks
} from 'api/station';
import { openSnackbar } from 'api/snackbar';
import { inboundFlightWaybillDetails, inboundFlights } from 'data/sinoport';
import { filterMobileActionsByRole, getMobileRoleView, isMobileRoleAllowed } from 'data/sinoport-adapters';
import { getMobileRoleKey, getMobileStationKey, readMobileSession } from 'utils/mobile/session';
import { localizeMobileText, readMobileLanguage } from 'utils/mobile/i18n';
import { buildMobileQueueEntry, recordMobileAction, useMobileOpsStorage } from 'utils/mobile/task-ops';

export const defaultTask = {
  countedBoxes: 0,
  scannedSerials: [],
  status: '未开始',
  updatedAt: null
};

export function parseIntSafe(value) {
  const parsed = parseInt(String(value).replace(/[^\d]/g, ''), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function parseWeight(value) {
  const parsed = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function normalizeCode(value) {
  return value.trim().toUpperCase();
}

function compactCode(value) {
  return normalizeCode(value).replace(/[^A-Z0-9]/g, '');
}

function derivePalletStorageLocation(palletNo, index = 0) {
  if (!palletNo) return `MME-STAGE-${String(index + 1).padStart(2, '0')}`;
  const suffix = palletNo.replace(/[^0-9]/g, '').slice(-2) || String(index + 1).padStart(2, '0');
  return `MME-STAGE-${suffix}`;
}

export function stationKeyOf(session) {
  return getMobileStationKey(session);
}

function mobileLanguage() {
  return readMobileSession()?.language || readMobileLanguage();
}

function mt(value) {
  return localizeMobileText(mobileLanguage(), value);
}

const HAOXUE_VEHICLES = [
  { plate: 'HX-TRK-101', model: '9.6m 厢车', driver: 'Hao Xue 01' },
  { plate: 'HX-TRK-205', model: '12.5m 厢车', driver: 'Hao Xue 02' },
  { plate: 'HX-TRK-318', model: '17.5m 挂车', driver: 'Hao Xue 03' },
  { plate: 'HX-TRK-426', model: '9.6m 冷链厢车', driver: 'Hao Xue 04' }
];

function buildInboundTaskCardConfig(type, flightNo) {
  const flight = getInboundFlight(flightNo);
  const priority = flight?.priority || 'P2';

  const configMap = {
    overview: {
      title: '进港任务总览',
      node: '进港机场货站操作',
      role: 'Inbound Supervisor',
      status: '运行中',
      sla: '落地后 12h',
      description: '当前航班的拆板、理货、组托、装车和 NOA/POD 全部按统一任务卡组织。',
      evidence: ['CBA / Manifest / Handling Plan', '任务状态回填', '关键节点时间戳'],
      blockers: ['关键文件不齐时，只允许展示任务，不允许放行。'],
      actions: [{ label: '查看任务池', variant: 'contained' }, { label: '上报异常' }]
    },
    counting: {
      title: '拆板与理货任务',
      node: '进港机场货站操作',
      role: 'Check Worker',
      status: '运行中',
      sla: '理货节点 30 分钟初判',
      description: `围绕航班 ${flightNo} 执行拆板和理货，扫码即加 1，并持续校验差异。`,
      evidence: ['提单 / 箱号扫码记录', '差异备注', '理货完成确认'],
      blockers: ['未完成理货不得发送 NOA。', '扫描到航班外提单时必须先确认是否纳入统计。'],
      actions: [{ label: '扫码 +1', variant: 'contained' }, { label: '挂起' }, { label: '上报异常' }]
    },
    pallet: {
      title: '组托任务',
      node: '进港机场货站操作',
      role: 'Pallet Builder',
      status: '运行中',
      sla: '理货完成后立即执行',
      description: `围绕航班 ${flightNo} 组托，保持同票同托，为后续装车准备标准托盘。`,
      evidence: ['托盘号', '箱数 / 重量', '托盘标签'],
      blockers: ['不同 consignee 不得混托。'],
      actions: [{ label: '新建托盘', variant: 'contained' }, { label: '打印标签' }]
    },
    loadingPlan: {
      title: '装车计划任务',
      node: '尾程卡车装车与运输',
      role: 'Loading Coordinator',
      status: '待处理',
      sla: '车辆到场后 15 分钟内启动',
      description: `为航班 ${flightNo} 录入车牌、司机、Collection Note 和复核信息，形成装车计划。`,
      evidence: ['车牌', '司机', 'Collection Note', '叉车司机 / 核对员'],
      blockers: ['未录入车牌、Collection Note、核对员时不得开始装车。'],
      actions: [{ label: '开始装车', variant: 'contained' }, { label: '挂起' }]
    },
    loadingExecution: {
      title: '装车执行任务',
      node: '尾程卡车装车与运输',
      role: 'Loading Worker',
      status: '装车中',
      sla: '装车完成后立即回填',
      description: `把托盘或提单装入车辆，持续校验车牌、托盘数量和完成条件。`,
      evidence: ['托盘绑定', '装车清单', '完成确认'],
      blockers: ['缺车牌 / Collection Note / 复核信息时不得完成装车。'],
      actions: [{ label: '录入托盘', variant: 'contained' }, { label: '完成装车', color: 'success' }]
    }
  };

  return {
    priority,
    ...(configMap[type] || configMap.overview)
  };
}

function roleAwareInboundTaskCardConfig(type, flightNo, roleKey, roleView, runAction) {
  const config = buildInboundTaskCardConfig(type, flightNo);
  const roleAllowed = isMobileRoleAllowed(roleKey, config.role);
  const actions = filterMobileActionsByRole(
    roleKey,
    (config.actions || []).map((action) => ({
      ...action,
      onClick: () => runAction(action.label, `${config.node} / ${config.role}`)
    }))
  );

  return {
    ...config,
    blockers: roleAllowed ? config.blockers : [...config.blockers, `当前角色 ${roleView.label} 仅可查看，不可执行 ${config.role} 任务。`],
    actions: roleAllowed ? actions : []
  };
}

const DEFAULT_LOADING_PLANS = [
  {
    id: 'LOAD-DEMO-001',
    flightNo: 'SE803',
    truckPlate: 'HX-TRK-101',
    vehicleModel: '9.6m 厢车',
    driverName: 'Hao Xue 01',
    collectionNote: 'CN-SE803-001',
    forkliftDriver: 'Forklift A',
    checker: 'Checker A',
    arrivalTime: '2026-04-07T18:20',
    departTime: '',
    pallets: ['SE803-PLT-1301', 'SE803-PLT-1302'],
    totalBoxes: 36,
    totalWeight: 812.4,
    status: '计划',
    createdAt: '2026-04-07T17:50:00.000Z'
  },
  {
    id: 'LOAD-DEMO-002',
    flightNo: 'SE803',
    truckPlate: 'HX-TRK-205',
    vehicleModel: '12.5m 厢车',
    driverName: 'Hao Xue 02',
    collectionNote: 'CN-SE803-002',
    forkliftDriver: 'Forklift B',
    checker: 'Checker B',
    arrivalTime: '2026-04-07T18:45',
    departTime: '',
    pallets: ['SE803-PLT-1201', 'SE803-PLT-1202'],
    totalBoxes: 28,
    totalWeight: 642.5,
    status: '装车中',
    createdAt: '2026-04-07T18:10:00.000Z'
  },
  {
    id: 'LOAD-DEMO-003',
    flightNo: 'SE803',
    truckPlate: 'HX-TRK-318',
    vehicleModel: '17.5m 挂车',
    driverName: 'Hao Xue 03',
    collectionNote: 'CN-SE803-003',
    forkliftDriver: 'Forklift C',
    checker: 'Checker C',
    arrivalTime: '2026-04-07T17:10',
    departTime: '2026-04-07T18:05',
    pallets: ['SE803-PLT-1101', 'SE803-PLT-1102', 'SE803-PLT-1103'],
    totalBoxes: 46,
    totalWeight: 1038.2,
    status: '已完成',
    createdAt: '2026-04-07T16:40:00.000Z',
    completedAt: '2026-04-07T18:05:00.000Z'
  },
  {
    id: 'LOAD-DEMO-004',
    flightNo: 'SE803',
    truckPlate: 'HX-TRK-426',
    vehicleModel: '9.6m 冷链厢车',
    driverName: 'Hao Xue 04',
    collectionNote: 'CN-SE803-004',
    forkliftDriver: 'Forklift D',
    checker: 'Checker D',
    arrivalTime: '2026-04-07T19:05',
    departTime: '',
    pallets: ['SE803-PLT-1401'],
    totalBoxes: 18,
    totalWeight: 402.6,
    status: '计划',
    createdAt: '2026-04-07T18:35:00.000Z'
  },
  {
    id: 'LOAD-DEMO-005',
    flightNo: 'SE803',
    truckPlate: 'HX-TRK-512',
    vehicleModel: '12.5m 厢车',
    driverName: 'Hao Xue 05',
    collectionNote: 'CN-SE803-005',
    forkliftDriver: 'Forklift E',
    checker: 'Checker E',
    arrivalTime: '2026-04-07T19:20',
    departTime: '',
    pallets: ['SE803-PLT-1203'],
    totalBoxes: 12,
    totalWeight: 288.4,
    status: '装车中',
    createdAt: '2026-04-07T18:48:00.000Z'
  },
  {
    id: 'LOAD-DEMO-006',
    flightNo: 'SE803',
    truckPlate: 'HX-TRK-608',
    vehicleModel: '17.5m 挂车',
    driverName: 'Hao Xue 06',
    collectionNote: 'CN-SE803-006',
    forkliftDriver: 'Forklift F',
    checker: 'Checker F',
    arrivalTime: '2026-04-07T16:10',
    departTime: '2026-04-07T17:20',
    pallets: ['SE803-PLT-1008', 'SE803-PLT-1009'],
    totalBoxes: 31,
    totalWeight: 706.9,
    status: '已完成',
    createdAt: '2026-04-07T15:50:00.000Z',
    completedAt: '2026-04-07T17:20:00.000Z'
  }
];

const DEFAULT_INBOUND_PALLETS = [
  {
    palletNo: 'SE803-PLT-1301',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-11',
    entries: [
      { awb: '436-10358585', consignee: 'SMDG LOGISTICS', boxes: 10, weightKg: 140.0 },
      { awb: '436-10359018', consignee: 'MME Hub', boxes: 8, weightKg: 280.4 }
    ],
    printed: true,
    totalWeightKg: 420.4,
    totalBoxes: 18,
    status: '待装车',
    printQueuedAt: '2026-04-07T17:48:00.000Z'
  },
  {
    palletNo: 'SE803-PLT-1302',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-12',
    entries: [
      { awb: '436-10354363', consignee: 'LGG Transfer', boxes: 18, weightKg: 392.0 }
    ],
    printed: true,
    totalWeightKg: 392.0,
    totalBoxes: 18,
    status: '待装车',
    printQueuedAt: '2026-04-07T17:52:00.000Z'
  },
  {
    palletNo: 'SE803-PLT-1201',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-21',
    entries: [{ awb: '436-10358585', consignee: 'SMDG LOGISTICS', boxes: 14, weightKg: 196.0 }],
    printed: true,
    totalWeightKg: 196.0,
    totalBoxes: 14,
    status: '待装车',
    printQueuedAt: '2026-04-07T18:05:00.000Z'
  },
  {
    palletNo: 'SE803-PLT-1202',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-22',
    entries: [{ awb: '436-10359018', consignee: 'MME Hub', boxes: 14, weightKg: 446.5 }],
    printed: true,
    totalWeightKg: 446.5,
    totalBoxes: 14,
    status: '待装车',
    printQueuedAt: '2026-04-07T18:09:00.000Z'
  },
  {
    palletNo: 'SE803-PLT-1101',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-31',
    entries: [{ awb: '436-10354363', consignee: 'LGG Transfer', boxes: 16, weightKg: 348.0 }],
    printed: true,
    totalWeightKg: 348.0,
    totalBoxes: 16,
    status: '待装车',
    loadedPlate: 'HX-TRK-318',
    loadedAt: '2026-04-07T18:05:00.000Z',
    printQueuedAt: '2026-04-07T16:42:00.000Z'
  },
  {
    palletNo: 'SE803-PLT-1102',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-32',
    entries: [{ awb: '436-10358585', consignee: 'SMDG LOGISTICS', boxes: 15, weightKg: 210.0 }],
    printed: true,
    totalWeightKg: 210.0,
    totalBoxes: 15,
    status: '待装车',
    loadedPlate: 'HX-TRK-318',
    loadedAt: '2026-04-07T18:05:00.000Z',
    printQueuedAt: '2026-04-07T16:44:00.000Z'
  },
  {
    palletNo: 'SE803-PLT-1103',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-33',
    entries: [{ awb: '436-10359018', consignee: 'MME Hub', boxes: 15, weightKg: 480.2 }],
    printed: true,
    totalWeightKg: 480.2,
    totalBoxes: 15,
    status: '待装车',
    loadedPlate: 'HX-TRK-318',
    loadedAt: '2026-04-07T18:05:00.000Z',
    printQueuedAt: '2026-04-07T16:46:00.000Z'
  },
  {
    palletNo: 'SE803-PLT-1401',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-41',
    entries: [{ awb: '436-10354363', consignee: 'LGG Transfer', boxes: 18, weightKg: 402.6 }],
    printed: true,
    totalWeightKg: 402.6,
    totalBoxes: 18,
    status: '待装车',
    printQueuedAt: '2026-04-07T18:33:00.000Z'
  },
  {
    palletNo: 'SE803-PLT-1203',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-23',
    entries: [{ awb: '436-10359018', consignee: 'MME Hub', boxes: 12, weightKg: 288.4 }],
    printed: true,
    totalWeightKg: 288.4,
    totalBoxes: 12,
    status: '待装车',
    printQueuedAt: '2026-04-07T18:47:00.000Z'
  },
  {
    palletNo: 'SE803-PLT-1008',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-08',
    entries: [{ awb: '436-10358585', consignee: 'SMDG LOGISTICS', boxes: 16, weightKg: 352.0 }],
    printed: true,
    totalWeightKg: 352.0,
    totalBoxes: 16,
    status: '待装车',
    loadedPlate: 'HX-TRK-608',
    loadedAt: '2026-04-07T17:20:00.000Z',
    printQueuedAt: '2026-04-07T15:53:00.000Z'
  },
  {
    palletNo: 'SE803-PLT-1009',
    flightNo: 'SE803',
    storageLocation: 'MME-STAGE-09',
    entries: [{ awb: '436-10354363', consignee: 'LGG Transfer', boxes: 15, weightKg: 354.9 }],
    printed: true,
    totalWeightKg: 354.9,
    totalBoxes: 15,
    status: '待装车',
    loadedPlate: 'HX-TRK-608',
    loadedAt: '2026-04-07T17:20:00.000Z',
    printQueuedAt: '2026-04-07T15:56:00.000Z'
  }
];

export function getInboundFlight(flightNo) {
  return inboundFlights.find((item) => item.flightNo === flightNo) || null;
}

export function buildFlightWaybills(flightNo) {
  const entries = inboundFlightWaybillDetails[flightNo] || [];
  return entries.map((item) => ({
    ...item,
    expectedBoxes: parseIntSafe(item.pieces),
    totalWeightKg: parseWeight(item.weight),
    barcode: normalizeCode(item.awb)
  }));
}

export function getInboundSummary(waybills, taskMap) {
  return {
    totalWaybills: waybills.length,
    totalBoxes: waybills.reduce((sum, item) => sum + item.expectedBoxes, 0),
    countedBoxes: waybills.reduce((sum, item) => sum + (taskMap[item.awb]?.countedBoxes || 0), 0),
    completedWaybills: waybills.filter((item) => (taskMap[item.awb] || defaultTask).status === '理货完成').length,
    suspendedWaybills: waybills.filter((item) => (taskMap[item.awb] || defaultTask).status === '暂时挂起').length
  };
}

export function useInboundStorage(flightNo) {
  const [taskMap, setTaskMapState] = useState({});
  const [pallets, setPalletsState] = useState(DEFAULT_INBOUND_PALLETS.filter((item) => !flightNo || item.flightNo === flightNo));

  useEffect(() => {
    if (!flightNo) return;

    void getInboundCountRecords(flightNo)
      .then((response) => setTaskMapState(response?.data?.records || {}))
      .catch(() => setTaskMapState({}));

    void getInboundPallets(flightNo)
      .then((response) => {
        const livePallets = response?.data?.pallets || [];
        setPalletsState(livePallets.length ? livePallets.map((item) => ({ ...item, flightNo })) : DEFAULT_INBOUND_PALLETS.filter((item) => item.flightNo === flightNo));
      })
      .catch(() => setPalletsState(DEFAULT_INBOUND_PALLETS.filter((item) => item.flightNo === flightNo)));
  }, [flightNo]);

  const setTaskMap = (updater) => {
    setTaskMapState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (flightNo) {
        Object.entries(next || {}).forEach(([awbNo, value]) => {
          void saveInboundCountRecord(flightNo, awbNo, {
            counted_boxes: value?.countedBoxes || 0,
            status: value?.status || '未开始',
            scanned_serials: value?.scannedSerials || [],
            note: value?.note || ''
          });
        });
      }
      return next;
    });
  };

  const setPallets = (updater) => {
    setPalletsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (flightNo) {
        (next || []).forEach((item) => {
          void saveInboundPallet(flightNo, {
            pallet_id: item.palletId,
            pallet_no: item.palletNo,
            status: item.status,
            total_boxes: item.totalBoxes,
            total_weight: item.totalWeight,
            storage_location: item.storageLocation,
            note: item.note,
            items: item.items
          });
        });
      }
      return next;
    });
  };

  return {
    taskMap,
    setTaskMap,
    pallets,
    setPallets
  };
}

export function useInboundLoadingStorage(flightNo) {
  const [loadingPlans, setLoadingPlansState] = useState(DEFAULT_LOADING_PLANS.filter((item) => !flightNo || item.flightNo === flightNo));

  useEffect(() => {
    if (!flightNo) return;

    void getInboundLoadingPlans(flightNo)
      .then((response) => {
        const plans = response?.data?.plans || [];
        setLoadingPlansState(plans.length ? plans.map((item) => ({ ...item, flightNo })) : DEFAULT_LOADING_PLANS.filter((item) => item.flightNo === flightNo));
      })
      .catch(() => setLoadingPlansState(DEFAULT_LOADING_PLANS.filter((item) => item.flightNo === flightNo)));
  }, [flightNo]);

  const setLoadingPlans = (updater) => {
    setLoadingPlansState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (flightNo) {
        (next || []).forEach((item) => {
          void saveInboundLoadingPlan(flightNo, {
            id: item.id,
            truckPlate: item.truckPlate,
            vehicleModel: item.vehicleModel,
            driverName: item.driverName,
            collectionNote: item.collectionNote,
            forkliftDriver: item.forkliftDriver,
            checker: item.checker,
            arrivalTime: item.arrivalTime,
            departTime: item.departTime,
            totalBoxes: item.totalBoxes,
            totalWeight: item.totalWeight,
            status: item.status,
            note: item.note,
            pallets: item.pallets
          });
        });
      }
      return next;
    });
  };

  return {
    loadingPlans,
    setLoadingPlans
  };
}

function useInboundTaskContext(flightNo) {
  const session = readMobileSession();
  const roleKey = getMobileRoleKey(session);
  const roleView = getMobileRoleView(roleKey);
  const opsStorage = useMobileOpsStorage(`inbound-flight-${flightNo}`);

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

  return { session, roleKey, roleView, opsState: opsStorage.state, runScopedAction, setOpsState: opsStorage.setState };
}

export function InboundFlightHeroCard({ flight, waybills, taskMap }) {
  const summary = getInboundSummary(waybills, taskMap);
  const awbList = waybills.map((item) => item.awb).join(' / ');

  return (
    <MainCard>
      <Stack sx={{ gap: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <div>
            <Typography variant="overline" color="primary.main">
              {mt('当前航班')}
            </Typography>
            <Typography variant="h3" sx={{ mt: 0.5 }}>
              {flight.flightNo}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {mt('来源：')}{flight.source} · ETA {flight.eta} · ETD {flight.etd}
            </Typography>
          </div>
          <StatusChip label={mt(flight.status)} />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {mt('该航班提单：')}{awbList || (mobileLanguage() === 'en' ? 'No AWBs' : '暂无提单')}
        </Typography>

        <Grid container spacing={1.5}>
          <Grid size={4}>
            <MetricCard title={mt('提单总数')} value={`${summary.totalWaybills}`} helper={mt('当前航班提单数')} chip="AWB" />
          </Grid>
          <Grid size={4}>
            <MetricCard title={mt('总箱数')} value={`${summary.totalBoxes}`} helper={`${mt('已点 ')}${summary.countedBoxes} ${mobileLanguage() === 'en' ? 'boxes' : '箱'}`} color="secondary" />
          </Grid>
          <Grid size={4}>
            <MetricCard
              title={mt('理货状态')}
              value={`${summary.completedWaybills}/${summary.suspendedWaybills}`}
              helper={mt('已完成 / 暂挂')}
              color="warning"
            />
          </Grid>
        </Grid>
      </Stack>
    </MainCard>
  );
}

export function InboundOverviewPanel({ flight, waybills, taskMap }) {
  const summary = getInboundSummary(waybills, taskMap);
  const { roleKey, roleView, runScopedAction } = useInboundTaskContext(flight.flightNo);

  return (
    <Stack sx={{ gap: 2 }}>
      <TaskCard {...roleAwareInboundTaskCardConfig('overview', flight.flightNo, roleKey, roleView, runScopedAction)} />

      <MainCard title={mt('航班概览')}>
        <Grid container spacing={1.5}>
          <Grid size={6}>
            <MetricCard title={mt('当前节点')} value={mt(flight.step)} helper={`${mt('优先级')} ${flight.priority}`} />
          </Grid>
          <Grid size={6}>
            <MetricCard title={mt('货量')} value={flight.cargo} helper={`${mt('已完成 ')}${summary.completedWaybills} ${mobileLanguage() === 'en' ? 'AWBs' : '票'}`} color="secondary" />
          </Grid>
        </Grid>
      </MainCard>

      <MainCard title={mt('提单基础详情')}>
        <Stack sx={{ gap: 1.25 }}>
          {waybills.map((item) => {
            const task = taskMap[item.awb] || defaultTask;

            return (
              <Box key={item.awb} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
                  <div>
                    <Typography variant="subtitle1">{item.awb}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.consignee}
                    </Typography>
                  </div>
                  <StatusChip label={mt(task.status === '未开始' ? item.currentNode : task.status)} />
                </Stack>

                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Grid size={6}>
                    <Typography variant="caption" color="text.secondary">
                      {mt('箱数：')}{item.expectedBoxes} {mobileLanguage() === 'en' ? 'boxes' : '箱'}
                    </Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="caption" color="text.secondary">
                      {mt('重量：')}{item.weight}
                    </Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="caption" color="text.secondary">
                      NOA: {mt(item.noaStatus)}
                    </Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="caption" color="text.secondary">
                      POD: {mt(item.podStatus)}
                    </Typography>
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="caption" color="text.secondary">
                      {mt('转运状态：')}{mt(item.transferStatus)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            );
          })}
        </Stack>
      </MainCard>
    </Stack>
  );
}

export function InboundFlightAppShell({ flight, waybills, taskMap, children, showHero = true, showOps = showHero }) {
  const navigate = useNavigate();
  const session = readMobileSession();
  const roleKey = getMobileRoleKey(session);
  const roleView = getMobileRoleView(roleKey);
  const opsStorage = useMobileOpsStorage(`inbound-flight-${flight.flightNo}`);
  const { mobileTasks } = useGetMobileTasks();
  const liveTasks = mobileTasks.filter((task) => task.flight_no === flight.flightNo);

  const runScopedAction = (label, taskLabel) => {
    opsStorage.setState((prev) =>
      recordMobileAction(
        prev,
        buildMobileQueueEntry(session, {
          label,
          taskLabel,
          payloadSummary: `${flight.flightNo} / ${taskLabel}`,
          roleLabel: roleView.label
        })
      )
    );
  };

  const handleLiveTaskAction = async (task, action) => {
    try {
      if (action === 'accept') await acceptMobileTask(task.task_id, { note: 'Accepted from inbound TaskOpsPanel' });
      if (action === 'start') await startMobileTask(task.task_id, { note: 'Started from inbound TaskOpsPanel' });
      if (action === 'evidence') {
        await uploadMobileTaskEvidence(task.task_id, {
          note: 'Evidence from inbound TaskOpsPanel',
          evidence_summary: 'TaskOpsPanel inbound evidence'
        });
      }
      if (action === 'complete') await completeMobileTask(task.task_id, { note: 'Completed from inbound TaskOpsPanel' });

      openSnackbar({
        open: true,
        message: `任务 ${task.task_id} 已执行 ${action}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || `任务 ${action} 失败`,
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  return (
    <Box>
      <Stack sx={{ gap: 1.5 }}>
        {showHero ? <InboundFlightHeroCard flight={flight} waybills={waybills} taskMap={taskMap} /> : null}
        {showOps ? (
          <TaskOpsPanel
            scopeKey={`inbound-flight-${flight.flightNo}`}
            currentLabel={flight.flightNo}
            contextChips={[`角色 ${mt(roleView.label)}`, `优先级 ${flight.priority}`, `当前节点 ${mt(flight.step)}`]}
            quickLinks={[
              { label: '节点选择', onClick: () => navigate('/mobile/select') },
              { label: '航班列表', onClick: () => navigate('/mobile/inbound') }
            ]}
            liveTasks={liveTasks}
            onTaskAction={handleLiveTaskAction}
          />
        ) : null}
        {typeof children === 'function' ? children({ roleKey, roleView, runScopedAction, opsState: opsStorage.state }) : children}
      </Stack>
    </Box>
  );
}

export function CountingPanel({ flightNo, waybills, taskMap, setTaskMap }) {
  const { roleKey, roleView, runScopedAction } = useInboundTaskContext(flightNo);
  const scanInputRef = useRef(null);
  const flashTimerRef = useRef(null);
  const [scanValue, setScanValue] = useState('');
  const [activeAwb, setActiveAwb] = useState('');
  const [includedAwbs, setIncludedAwbs] = useState([]);
  const [externalWaybills, setExternalWaybills] = useState([]);
  const [pendingWaybill, setPendingWaybill] = useState(null);
  const [expandedAwb, setExpandedAwb] = useState('');
  const [flashAwb, setFlashAwb] = useState('');
  const [recentScanInfo, setRecentScanInfo] = useState({});
  const [message, setMessage] = useState('使用 PDA 条码枪扫描提单后，会直接进入该票的计数器。');

  useEffect(() => {
    scanInputRef.current?.focus();
  }, [flightNo]);

  useEffect(
    () => () => {
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
      }
    },
    []
  );

  const updateTask = (awb, updater) => {
    setTaskMap((prev) => {
      const current = prev[awb] || defaultTask;
      return {
        ...prev,
        [awb]: {
          ...updater(current),
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  const matchScannedWaybill = (code) => {
    const normalized = normalizeCode(code);
    const compact = compactCode(code);
    let matched = null;

    waybills.forEach((item) => {
      const awbCompact = compactCode(item.awb);
      if (compact === awbCompact || compact.startsWith(awbCompact)) {
        if (!matched || awbCompact.length > matched.awbCompact.length) {
          const serial = compact.slice(awbCompact.length);
          matched = {
            waybill: item,
            rawCode: normalized,
            serial: serial || '',
            awbCompact
          };
        }
      }
    });

    return matched;
  };

  const buildExternalWaybill = (code) => {
    const compact = compactCode(code);
    const awbBody = compact.slice(0, 11);
    const serial = compact.length > 11 ? compact.slice(11) : '';

    const formattedAwb = /^\d{11}$/.test(awbBody) ? `${awbBody.slice(0, 3)}-${awbBody.slice(3)}` : normalizeCode(code);

    return {
      waybill: {
        awb: formattedAwb,
        consignee: '不在当前航班，临时纳入统计',
        expectedBoxes: 0,
        expectedBoxesKnown: false,
        totalWeightKg: 0,
        weight: '待确认',
        currentNode: '航班外提单',
        noaStatus: '待确认',
        podStatus: '待确认',
        transferStatus: '待确认',
        barcode: formattedAwb
      },
      rawCode: normalizeCode(code),
      serial,
      awbCompact: compactCode(formattedAwb),
      isExternal: true
    };
  };

  const triggerScanFeedback = (awb, nextCount, serial) => {
    setFlashAwb(awb);
    setRecentScanInfo((prev) => ({
      ...prev,
      [awb]: {
        nextCount,
        serial,
        updatedAt: Date.now()
      }
    }));

    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }

    flashTimerRef.current = window.setTimeout(() => {
      setFlashAwb('');
    }, 900);
  };

  const registerSuccessfulScan = (scan) => {
    const { waybill, serial, rawCode } = scan;
    const now = Date.now();
    let outcome = null;

    setTaskMap((prev) => {
      const current = prev[waybill.awb] || defaultTask;
      const scannedSerials = current.scannedSerials || [];

      if (serial && scannedSerials.includes(serial)) {
        outcome = { type: 'duplicate-serial', serial };
        return prev;
      }

      if (!serial && current.lastScanRaw === rawCode && current.lastScanAt && now - current.lastScanAt < 400) {
        outcome = { type: 'rapid-duplicate' };
        return prev;
      }

      if (waybill.expectedBoxesKnown !== false && current.countedBoxes >= waybill.expectedBoxes) {
        outcome = { type: 'overflow' };
        return prev;
      }

      const nextCount = current.countedBoxes + 1;
      outcome = { type: 'success', nextCount };

      return {
        ...prev,
        [waybill.awb]: {
          ...current,
          countedBoxes: nextCount,
          scannedSerials: serial ? [...scannedSerials, serial] : scannedSerials,
          lastScanRaw: rawCode,
          lastScanAt: now,
          status: current.status === '理货完成' ? '理货完成' : '点货中',
          updatedAt: new Date(now).toISOString()
        }
      };
    });

    if (outcome?.type === 'duplicate-serial') {
      setPendingWaybill(null);
      setMessage(`箱号 ${outcome.serial} 已经扫描过，本次已自动忽略。`);
      return;
    }

    if (outcome?.type === 'rapid-duplicate') {
      setPendingWaybill(null);
      setMessage(`短时间内重复扫描同一个提单号，系统已自动忽略。`);
      return;
    }

    if (outcome?.type === 'overflow') {
      setPendingWaybill(null);
      setMessage(`提单 ${waybill.awb} 已达到应点箱数，不能再继续增加。`);
      return;
    }

    setIncludedAwbs((prev) => (prev.includes(waybill.awb) ? prev : [...prev, waybill.awb]));
    setActiveAwb(waybill.awb);
    setScanValue(waybill.awb);
    setPendingWaybill(null);
    setExpandedAwb(waybill.awb);
    triggerScanFeedback(waybill.awb, outcome.nextCount, serial);
    runScopedAction('扫码 +1', `拆板与理货 / ${waybill.awb}`);
    setMessage(
      serial
        ? `已纳入提单 ${waybill.awb}，自动加 1。当前为第 ${outcome.nextCount} 项，箱号 ${serial}。`
        : `已纳入提单 ${waybill.awb}，自动加 1。当前为第 ${outcome.nextCount} 项。`
    );
  };

  const activateWaybill = (code) => {
    if (pendingWaybill) return;

    const matched = matchScannedWaybill(code);

    if (!matched) {
      const externalCandidate = buildExternalWaybill(code);
      setPendingWaybill(externalCandidate);
      setScanValue(externalCandidate.waybill.awb);
      setMessage(`扫描到一个不在航班 ${flightNo} 下面的提单，是否纳入统计？`);
      return;
    }

    if (!activeAwb && includedAwbs.length === 0) {
      registerSuccessfulScan(matched);
      return;
    }

    if (matched.waybill.awb === activeAwb || includedAwbs.includes(matched.waybill.awb)) {
      registerSuccessfulScan(matched);
      return;
    }

    setPendingWaybill(matched);
    setScanValue(matched.waybill.awb);
    setMessage(`检测到新的提单 ${matched.waybill.awb}，请先确认是否纳入当前航班点数。`);
  };

  const openWaybillCounter = (item) => {
    setActiveAwb(item.awb);
    setScanValue(item.awb);
    setPendingWaybill(null);
    setExpandedAwb(item.awb);
    setMessage(`已切换到提单 ${item.awb}，可以继续点数。`);
  };

  const allWaybills = [...waybills, ...externalWaybills];
  const includedWaybillItems = includedAwbs
    .map((awb) => allWaybills.find((entry) => entry.awb === awb))
    .filter(Boolean);

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title="扫描提单">
        <Stack sx={{ gap: 2 }}>
          <Stack direction="row" sx={{ gap: 1.5 }}>
            <TextField
              inputRef={scanInputRef}
              fullWidth
              autoFocus
              disabled={!!pendingWaybill}
              label="扫描提单号 / 箱号"
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  activateWaybill(scanValue);
                }
              }}
              placeholder="扫码后自动回车，即确认并加 1"
            />
            <Button variant="contained" startIcon={<BarcodeOutlined />} disabled={!!pendingWaybill} onClick={() => activateWaybill(scanValue)}>
              确认 +1
            </Button>
          </Stack>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <BarcodeOutlined />
            <Typography variant="body2" color="text.secondary">
              条码枪扫码后的回车会直接被识别成一次确认，并自动完成点数加 1。
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Stack>
      </MainCard>

      <TaskCard {...roleAwareInboundTaskCardConfig('counting', flightNo, roleKey, roleView, runScopedAction)} />

      <Dialog open={!!pendingWaybill} fullWidth maxWidth="xs" disableEscapeKeyDown onClose={() => {}}>
        {pendingWaybill ? (
          <>
            <DialogTitle>纳入统计确认</DialogTitle>
            <DialogContent>
              <Stack sx={{ gap: 2, pt: 0.5 }}>
                <Typography variant="body1">
                  {pendingWaybill.isExternal ? `扫描到一个不在航班 ${flightNo} 下面的提单，是否纳入统计？` : '这是一个新的提单号，是否纳入这一个提单号的点数？'}
                </Typography>
                <Box sx={{ borderRadius: 2, bgcolor: 'grey.100', p: 1.5 }}>
                  <Typography variant="subtitle2">{pendingWaybill.waybill.awb}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {pendingWaybill.waybill.consignee} ·{' '}
                    {pendingWaybill.waybill.expectedBoxesKnown === false ? '总箱数待确认' : `总箱数 ${pendingWaybill.waybill.expectedBoxes}`}
                    {pendingWaybill.serial ? ` · 箱号 ${pendingWaybill.serial}` : ''}
                  </Typography>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setPendingWaybill(null);
                  setScanValue(activeAwb || '');
                  setMessage('已取消纳入新提单。');
                  scanInputRef.current?.focus();
                }}
              >
                取消
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  if (pendingWaybill.isExternal) {
                    setExternalWaybills((prev) =>
                      prev.some((item) => item.awb === pendingWaybill.waybill.awb) ? prev : [...prev, pendingWaybill.waybill]
                    );
                  }
                  registerSuccessfulScan(pendingWaybill);
                  window.setTimeout(() => {
                    scanInputRef.current?.focus();
                  }, 0);
                }}
              >
                确定纳入
              </Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>

      {includedWaybillItems.length ? (
        <MainCard title="已纳入点数的提单">
          <Stack sx={{ gap: 1 }}>
            {includedWaybillItems.map((item) => {
              const task = taskMap[item.awb] || defaultTask;
              const recent = recentScanInfo[item.awb];
              const isExpanded = expandedAwb === item.awb;
              const remaining = item.expectedBoxesKnown === false ? null : Math.max(item.expectedBoxes - task.countedBoxes, 0);
              const progress = item.expectedBoxesKnown === false || !item.expectedBoxes ? 0 : Math.min(100, Math.round((task.countedBoxes / item.expectedBoxes) * 100));
              const canComplete =
                item.expectedBoxesKnown === false ? task.countedBoxes > 0 : task.countedBoxes === item.expectedBoxes && task.countedBoxes > 0;

              return (
                <Box
                  key={item.awb}
                  sx={{
                    border: '1px solid',
                    borderColor: activeAwb === item.awb ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    p: 1.15,
                    ...(flashAwb === item.awb && {
                      animation: 'scanFlash 0.9s ease',
                      '@keyframes scanFlash': {
                        '0%': { backgroundColor: 'rgba(22, 119, 255, 0.18)' },
                        '100%': { backgroundColor: 'transparent' }
                      }
                    })
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                    <div>
                      <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
                        {item.awb}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.consignee}
                      </Typography>
                    </div>
                    <StatusChip label={task.status} />
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.9, alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                      已点 {task.countedBoxes} / {remaining === null ? '总箱数待确认' : `剩余 ${remaining}`}
                    </Typography>
                    {recent ? (
                      <Typography variant="caption" color="success.main" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        已加第 {recent.nextCount} 项{recent.serial ? ` · 箱号 ${recent.serial}` : ''}
                      </Typography>
                    ) : null}
                  </Stack>

                  <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.75, alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {item.expectedBoxesKnown === false ? '当前提单不在本航班内' : `总箱数 ${item.expectedBoxes}`}
                    </Typography>
                    <Stack direction="row" sx={{ gap: 0.5 }}>
                      {task.scannedSerials?.length ? (
                        <Button size="small" variant="text" onClick={() => setExpandedAwb(isExpanded ? '' : item.awb)}>
                          {isExpanded ? '收起箱号' : `查看箱号(${task.scannedSerials.length})`}
                        </Button>
                      ) : null}
                      <Button size="small" variant="text" onClick={() => openWaybillCounter(item)}>
                        {activeAwb === item.awb ? '当前提单' : task.status === '暂时挂起' ? '继续点货' : '设为当前'}
                      </Button>
                    </Stack>
                  </Stack>

                  <Box sx={{ mt: 0.75 }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        理货进度
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {progress}%
                      </Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={progress} />
                  </Box>

                  <Stack direction="row" sx={{ gap: 0.75, mt: 0.85 }}>
                    <Button
                      fullWidth
                      size="small"
                      variant="contained"
                      color="success"
                      disabled={!canComplete}
                      onClick={() =>
                        updateTask(item.awb, (current) => ({
                          ...current,
                          status: '理货完成'
                        }))
                      }
                    >
                      点货完成
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={() =>
                        updateTask(item.awb, (current) => ({
                          ...current,
                          status: '暂时挂起'
                        }))
                      }
                    >
                      暂时挂起
                    </Button>
                  </Stack>

                  <Collapse in={isExpanded}>
                    <Box
                      sx={{
                        mt: 0.85,
                        pt: 0.85,
                        borderTop: '1px dashed',
                        borderColor: 'divider',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.75
                      }}
                    >
                      {(task.scannedSerials || []).map((serial) => (
                        <Box key={serial} sx={{ borderRadius: 1, bgcolor: 'grey.100', px: 0.85, py: 0.35 }}>
                          <Typography variant="caption">{serial}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        </MainCard>
      ) : null}
    </Stack>
  );
}

export function PalletPanel({ flightNo, pallets }) {
  const { roleKey, roleView, runScopedAction } = useInboundTaskContext(flightNo);
  const navigate = useNavigate();
  const flightPallets = pallets.filter((item) => item.flightNo === flightNo);

  const printPalletLabel = (pallet) => {
    runScopedAction('上传证据', `组托标签 / ${pallet.palletNo}`);
    const popup = window.open('', '_blank', 'width=420,height=620');
    if (!popup) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, pallet.palletNo, {
      format: 'CODE128',
      displayValue: true,
      margin: 0,
      width: 1.6,
      height: 56,
      fontSize: 16
    });

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>打印托盘标签</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 24px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: #fff;
              color: #111827;
            }
            .label {
              border: 1px solid #dbe2ea;
              border-radius: 16px;
              padding: 20px;
              width: 100%;
            }
            .title {
              font-size: 14px;
              font-weight: 700;
              color: #6b7280;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              margin-bottom: 12px;
            }
            .barcode {
              display: flex;
              justify-content: center;
              margin: 8px 0 20px;
            }
            .metric {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-top: 1px solid #eef2f6;
              font-size: 16px;
            }
            .metric strong {
              font-size: 22px;
            }
            @media print {
              body { padding: 0; }
              .label { border: none; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="title">Pallet Label</div>
            <div class="barcode">${svg.outerHTML}</div>
            <div class="metric"><span>托盘号</span><strong>${pallet.palletNo}</strong></div>
            <div class="metric"><span>箱数</span><strong>${pallet.totalBoxes}</strong></div>
            <div class="metric"><span>重量</span><strong>${pallet.totalWeightKg} kg</strong></div>
          </div>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title="托盘操作">
        <Stack sx={{ gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            先浏览该航班已有托盘，再进入新页面新建托盘。每完成一个托盘后，会回到这里继续下一轮操作。
          </Typography>
          <Button fullWidth size="large" variant="contained" startIcon={<PlusOutlined />} onClick={() => navigate(`/mobile/inbound/${flightNo}/pallet/new`)}>
            新建托盘
          </Button>
        </Stack>
      </MainCard>

      <MainCard title="历史托盘记录">
        <Stack sx={{ gap: 1.25 }}>
          {flightPallets.length ? (
            flightPallets.map((item) => (
              <Box key={item.palletNo} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
                  <div>
                    <Typography variant="subtitle2">{item.palletNo}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.totalBoxes} 箱 / {item.totalWeightKg} kg / {item.entries.length} 票
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                      存放位置：{item.storageLocation || derivePalletStorageLocation(item.palletNo)}
                    </Typography>
                  </div>
                  <StatusChip label={item.loadedPlate ? '已装车' : '待装车'} />
                </Stack>
                <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 1 }}>
                  <Button size="small" variant="outlined" startIcon={<PrinterOutlined />} onClick={() => printPalletLabel(item)}>
                    打印标签
                  </Button>
                </Stack>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">当前航班还没有历史托盘记录。</Typography>
          )}
        </Stack>
      </MainCard>

      <TaskCard {...roleAwareInboundTaskCardConfig('pallet', flightNo, roleKey, roleView, runScopedAction)} />
    </Stack>
  );
}

export function PalletCreatePanel({ flightNo, waybills, pallets, setPallets, onCompleted }) {
  const { roleKey, roleView, runScopedAction } = useInboundTaskContext(flightNo);
  const scanInputRef = useRef(null);
  const [scanValue, setScanValue] = useState('');
  const [message, setMessage] = useState('当前托盘已自动编号，扫码枪每扫一次就会为对应提单加 1 箱。');
  const [pendingPalletScan, setPendingPalletScan] = useState(null);
  const [currentPallet, setCurrentPallet] = useState(() => ({
    palletNo: `${flightNo}-PLT-${String(Date.now()).slice(-4)}`,
    flightNo,
    entries: [],
    createdAt: new Date().toISOString()
  }));

  useEffect(() => {
    scanInputRef.current?.focus();
  }, [flightNo]);

  const appendWaybillToPallet = (matched) => {
    runScopedAction('扫码', `组托追加 / ${matched.awb}`);
    setCurrentPallet((prev) => {
      const existing = prev.entries.find((entry) => entry.awb === matched.awb);
      const weightPerBox = matched.expectedBoxes ? matched.totalWeightKg / matched.expectedBoxes : 0;

      if (existing) {
        return {
          ...prev,
          entries: prev.entries.map((entry) =>
            entry.awb === matched.awb
              ? {
                  ...entry,
                  boxes: entry.boxes + 1,
                  weightKg: Number((entry.weightKg + weightPerBox).toFixed(1))
                }
              : entry
          )
        };
      }

      return {
        ...prev,
        entries: [
          ...prev.entries,
          {
            awb: matched.awb,
            consignee: matched.consignee,
            boxes: 1,
            weightKg: Number(weightPerBox.toFixed(1))
          }
        ]
      };
    });
    setScanValue(matched.awb);
    setPendingPalletScan(null);
    setMessage(`已扫描 ${matched.awb}，当前托盘继续累计。`);
    window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 0);
  };

  const activateWaybill = (code) => {
    if (pendingPalletScan) return;

    const normalized = normalizeCode(code);
    const matched = waybills.find((item) => item.barcode === normalized);

    if (!matched) {
      setMessage(`未在航班 ${flightNo} 下找到提单 ${code}。`);
      return;
    }

    const existing = currentPallet.entries.find((entry) => entry.awb === matched.awb);
    if (existing) {
      appendWaybillToPallet(matched);
      return;
    }

    if (!currentPallet.entries.length) {
      appendWaybillToPallet(matched);
      return;
    }

    const palletConsignee = currentPallet.entries[0]?.consignee;
    if (palletConsignee && matched.consignee !== palletConsignee) {
      setPendingPalletScan({
        type: 'blocked-consignee',
        matched,
        palletConsignee
      });
      return;
    }

    setPendingPalletScan({
      type: 'confirm-same-consignee',
      matched,
      palletConsignee
    });
  };

  const completePallet = () => {
    if (!currentPallet.entries.length) return;
    const totalWeightKg = currentPallet.entries.reduce((sum, item) => sum + item.weightKg, 0);
    const totalBoxes = currentPallet.entries.reduce((sum, item) => sum + item.boxes, 0);
    const finalized = {
      ...currentPallet,
      printed: true,
      storageLocation: derivePalletStorageLocation(currentPallet.palletNo, pallets.length),
      totalWeightKg: Number(totalWeightKg.toFixed(1)),
      totalBoxes,
      status: '待装车',
      printQueuedAt: new Date().toISOString()
    };

    setPallets((prev) => [finalized, ...prev]);
    runScopedAction('完成', `组托完成 / ${finalized.palletNo}`);
    setMessage(`托盘 ${finalized.palletNo} 已完成，共 ${totalBoxes} 箱。`);
    if (onCompleted) onCompleted(finalized);
  };

  return (
    <Stack sx={{ gap: 2 }}>
      <TaskCard {...roleAwareInboundTaskCardConfig('pallet', flightNo, roleKey, roleView, runScopedAction)} />

      <MainCard title="当前托盘">
        <Stack sx={{ gap: 2 }}>
          <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5 }}>
            <Typography variant="subtitle2">{currentPallet.palletNo}</Typography>
            <Typography variant="caption" color="text.secondary">
              航班 {currentPallet.flightNo} · 已纳入 {currentPallet.entries.length} 个提单
            </Typography>
          </Box>
        </Stack>
      </MainCard>

      <MainCard title="扫描计数">
        <Stack sx={{ gap: 2 }}>
          <Stack direction="row" sx={{ gap: 1.5 }}>
            <TextField
              inputRef={scanInputRef}
              fullWidth
              autoFocus
              disabled={!!pendingPalletScan}
              label="扫描提单号"
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  activateWaybill(scanValue);
                }
              }}
              placeholder="扫码后自动回车，即加 1 箱"
            />
            <Button variant="contained" startIcon={<SearchOutlined />} disabled={!!pendingPalletScan} onClick={() => activateWaybill(scanValue)}>
              确认 +1
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Stack>
      </MainCard>

      <Dialog open={!!pendingPalletScan} fullWidth maxWidth="xs" disableEscapeKeyDown onClose={() => {}}>
        {pendingPalletScan ? (
          <>
            <DialogTitle>{pendingPalletScan.type === 'blocked-consignee' ? '不能并入当前托盘' : '确认并入当前托盘'}</DialogTitle>
            <DialogContent>
              <Stack sx={{ gap: 2, pt: 0.5 }}>
                <Typography variant="body1">
                  {pendingPalletScan.type === 'blocked-consignee'
                    ? '不同收货人的提单不允许打在同一个托盘上。'
                    : '当前扫描到的是同一收货人的另一票提单，是否要记录在这个托盘里？'}
                </Typography>
                <Box sx={{ borderRadius: 2, bgcolor: 'grey.100', p: 1.5 }}>
                  <Typography variant="subtitle2">{pendingPalletScan.matched.awb}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    当前提单收货人：{pendingPalletScan.matched.consignee}
                  </Typography>
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    当前托盘收货人：{pendingPalletScan.palletConsignee}
                  </Typography>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
              {pendingPalletScan.type === 'blocked-consignee' ? (
                <Button
                  variant="contained"
                  onClick={() => {
                    setPendingPalletScan(null);
                    setMessage('收货人不同，不能纳入当前托盘。');
                    scanInputRef.current?.focus();
                  }}
                >
                  知道了
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setPendingPalletScan(null);
                      setMessage('已取消把该提单并入当前托盘。');
                      scanInputRef.current?.focus();
                    }}
                  >
                    取消
                  </Button>
                  <Button variant="contained" onClick={() => appendWaybillToPallet(pendingPalletScan.matched)}>
                    记录在此托盘
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        ) : null}
      </Dialog>

      <MainCard title="当前托盘明细">
        <Stack sx={{ gap: 1 }}>
          {currentPallet.entries.length ? (
            currentPallet.entries.map((entry, index) => (
              <Box key={`${entry.awb}-${index}`} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2">{entry.awb}</Typography>
                  <Typography variant="subtitle2">{entry.boxes} 箱</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  估算重量 {entry.weightKg} kg
                </Typography>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">当前托盘还没有录入任何提单。</Typography>
          )}
        </Stack>
      </MainCard>

      <MainCard title="完成提交">
        <Stack sx={{ gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            点击完成后，当前托盘会加入历史托盘记录，你可以继续新建下一个托盘。
          </Typography>
          <Button fullWidth size="large" variant="contained" startIcon={<PrinterOutlined />} disabled={!currentPallet.entries.length} onClick={completePallet}>
            完成
          </Button>
        </Stack>
      </MainCard>
    </Stack>
  );
}

export function LoadingPanel({ flightNo, loadingPlans, setLoadingPlans }) {
  const { roleKey, roleView, runScopedAction } = useInboundTaskContext(flightNo);
  const navigate = useNavigate();
  const flightPlans = loadingPlans.filter((item) => item.flightNo === flightNo);

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title="装车计划">
        <Stack sx={{ gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            装车计划应由后台办公室先完成编排，包括车牌、司机、Collection Note 与预定托盘；PDA 仅执行已排好的计划。
          </Typography>
          <Button fullWidth size="large" variant="outlined" onClick={() => navigate('/station/resources/vehicles')}>
            去后台排计划
          </Button>
        </Stack>
      </MainCard>

      <MainCard title="预定装车计划">
        <Stack sx={{ gap: 1.25 }}>
          {flightPlans.length ? (
            flightPlans.map((item) => (
              <Box key={item.id} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
                  <div>
                    <Typography variant="subtitle2">{item.truckPlate}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.driverName || '待补司机'} · {item.collectionNote || '无 Collection Note'} · {item.pallets?.length || 0} 托盘
                    </Typography>
                  </div>
                  <StatusChip label={item.status || '待装车'} />
                </Stack>
                <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={item.status === '已完成'}
                    onClick={() => {
                      runScopedAction('确认', `装车计划启动 / ${item.id}`);
                      setLoadingPlans((prev) =>
                        prev.map((plan) => (plan.id === item.id ? { ...plan, status: '装车中' } : plan))
                      );
                      navigate(`/mobile/inbound/${flightNo}/loading/plan/${item.id}`);
                    }}
                  >
                    装车
                  </Button>
                </Stack>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">当前航班还没有预定装车计划。</Typography>
          )}
        </Stack>
      </MainCard>

      <TaskCard {...roleAwareInboundTaskCardConfig('loadingPlan', flightNo, roleKey, roleView, runScopedAction)} />
    </Stack>
  );
}

export function LoadingPlanCreatePanel({ flightNo, onStart }) {
  const { roleKey, roleView, runScopedAction } = useInboundTaskContext(flightNo);
  const [form, setForm] = useState({
    truckPlate: '',
    driverName: '',
    collectionNote: '',
    forkliftDriver: '',
    checker: '',
    arrivalTime: '',
    departTime: ''
  });

  const canStart = form.truckPlate && form.collectionNote && form.forkliftDriver && form.checker && form.arrivalTime;

  return (
    <Stack sx={{ gap: 2 }}>
      <TaskCard {...roleAwareInboundTaskCardConfig('loadingPlan', flightNo, roleKey, roleView, runScopedAction)} />

      <MainCard title="装车前准备">
        <Grid container spacing={1.5}>
          <Grid size={12}>
            <TextField label="车牌号" value={form.truckPlate} onChange={(event) => setForm((prev) => ({ ...prev, truckPlate: event.target.value.toUpperCase() }))} />
          </Grid>
          <Grid size={12}>
            <TextField label="司机姓名" value={form.driverName} onChange={(event) => setForm((prev) => ({ ...prev, driverName: event.target.value }))} />
          </Grid>
          <Grid size={12}>
            <TextField label="Collection Note" value={form.collectionNote} onChange={(event) => setForm((prev) => ({ ...prev, collectionNote: event.target.value }))} />
          </Grid>
          <Grid size={6}>
            <TextField label="叉车司机" value={form.forkliftDriver} onChange={(event) => setForm((prev) => ({ ...prev, forkliftDriver: event.target.value }))} />
          </Grid>
          <Grid size={6}>
            <TextField label="核对员" value={form.checker} onChange={(event) => setForm((prev) => ({ ...prev, checker: event.target.value }))} />
          </Grid>
          <Grid size={6}>
            <TextField label="到达时间" type="datetime-local" value={form.arrivalTime} onChange={(event) => setForm((prev) => ({ ...prev, arrivalTime: event.target.value }))} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={6}>
            <TextField label="离开时间" type="datetime-local" value={form.departTime} onChange={(event) => setForm((prev) => ({ ...prev, departTime: event.target.value }))} InputLabelProps={{ shrink: true }} />
          </Grid>
        </Grid>
      </MainCard>

      <MainCard title="创建计划">
        <Stack sx={{ gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            提交后会返回预定装车计划列表，再从列表里选择一条计划开始执行装车。
          </Typography>
          <Button
            fullWidth
            size="large"
            variant="contained"
            disabled={!canStart}
            onClick={() => {
              runScopedAction('确认', `创建装车计划 / ${flightNo}`);
              onStart({
                id: `LOAD-${String(Date.now()).slice(-8)}`,
                flightNo,
                truckPlate: form.truckPlate,
                vehicleModel: HAOXUE_VEHICLES.find((item) => item.plate === form.truckPlate)?.model || '浩雪车辆',
                driverName: form.driverName,
                ...form,
                pallets: [],
                totalBoxes: 0,
                totalWeight: 0,
                status: '计划',
                createdAt: new Date().toISOString()
              });
            }}
          >
            保存装车计划
          </Button>
        </Stack>
      </MainCard>
    </Stack>
  );
}

export function LoadingExecutionPanel({ flightNo, plan, pallets, setPallets, setLoadingPlans, onCompleted }) {
  const { roleKey, roleView, runScopedAction } = useInboundTaskContext(flightNo);
  const availablePallets = pallets.filter((item) => item.flightNo === flightNo && !item.loadedPlate);
  const [scanValue, setScanValue] = useState('');
  const [message, setMessage] = useState('开始扫描托盘号或提单号，系统会把对应托盘加入当前车辆。');
  const [scanError, setScanError] = useState('');

  const linkedPallets = availablePallets.filter((item) => (plan.pallets || []).includes(item.palletNo));
  const totalBoxes = linkedPallets.reduce((sum, item) => sum + (item.totalBoxes || 0), 0);
  const totalWeight = linkedPallets.reduce((sum, item) => sum + (item.totalWeightKg || 0), 0).toFixed(1);

  const attachTarget = (rawCode) => {
    if (scanError) return;

    const code = normalizeCode(rawCode);
    const palletMatch = availablePallets.find((item) => normalizeCode(item.palletNo) === code);
    const awbMatch = availablePallets.find((item) => item.entries?.some((entry) => normalizeCode(entry.awb) === code));
    const matched = palletMatch || awbMatch;

    if (!matched) {
      setScanError(`未找到托盘号或提单号 ${rawCode}。`);
      return;
    }

    if ((plan.pallets || []).includes(matched.palletNo)) {
      setScanError(`托盘 ${matched.palletNo} 已在当前装车计划中。`);
      return;
    }

    setLoadingPlans((prev) =>
      prev.map((item) =>
        item.id === plan.id
          ? {
              ...item,
              pallets: [...(item.pallets || []), matched.palletNo],
              totalBoxes: (item.totalBoxes || 0) + (matched.totalBoxes || 0),
              totalWeight: Number(((item.totalWeight || 0) + (matched.totalWeightKg || 0)).toFixed(1))
            }
          : item
      )
    );
    runScopedAction('录入', `装车录入 / ${matched.palletNo}`);
    setScanValue(matched.palletNo);
    setMessage(`已将 ${matched.palletNo} 加入车辆 ${plan.truckPlate}。`);
  };

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title="当前装车计划">
        <Stack sx={{ gap: 1.25 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
            <div>
              <Typography variant="h5">{plan.truckPlate}</Typography>
              <Typography variant="caption" color="text.secondary">
                {plan.vehicleModel} · {plan.driverName || '待补司机'}
              </Typography>
            </div>
            <StatusChip label={plan.status || '装车中'} />
          </Stack>
          <Grid container spacing={1}>
            <Grid size={6}>
              <Typography variant="caption" color="text.secondary">
                Collection Note：{plan.collectionNote || '未填写'}
              </Typography>
            </Grid>
            <Grid size={6}>
              <Typography variant="caption" color="text.secondary">
                到达时间：{plan.arrivalTime || '未填写'}
              </Typography>
            </Grid>
            <Grid size={4}>
              <Typography variant="caption" color="text.secondary">
                托盘 {linkedPallets.length} 个
              </Typography>
            </Grid>
            <Grid size={4}>
              <Typography variant="caption" color="text.secondary">
                箱数 {totalBoxes}
              </Typography>
            </Grid>
            <Grid size={4}>
              <Typography variant="caption" color="text.secondary">
                重量 {totalWeight} kg
              </Typography>
            </Grid>
          </Grid>
        </Stack>
      </MainCard>

      <MainCard title="预计装载目标">
        <Stack sx={{ gap: 1.25 }}>
          {(plan.pallets || []).length ? (
            (plan.pallets || []).map((palletNo) => {
              const plannedPallet = pallets.find((item) => item.palletNo === palletNo);

              if (!plannedPallet) {
                return (
                  <Box key={palletNo} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                    <Typography variant="subtitle2">{palletNo}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      计划托盘，待从历史托盘记录中恢复详情。
                    </Typography>
                  </Box>
                );
              }

              return (
                <Box key={plannedPallet.palletNo} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                  <Typography variant="subtitle2">{plannedPallet.palletNo}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                    {plannedPallet.totalBoxes} 箱 / {plannedPallet.totalWeightKg} kg
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    存放位置：{plannedPallet.storageLocation || derivePalletStorageLocation(plannedPallet.palletNo)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    计划货物：{(plannedPallet.entries || []).map((entry) => entry.awb).join(' / ') || '待补提单'}
                  </Typography>
                </Box>
              );
            })
          ) : (
            <Typography color="text.secondary">当前装车计划还没有预定托盘或箱号。</Typography>
          )}
        </Stack>
      </MainCard>

      <MainCard title="扫描装车">
        <Stack sx={{ gap: 2 }}>
          <Stack direction="row" sx={{ gap: 1.5 }}>
            <TextField
              fullWidth
              autoFocus
              disabled={!!scanError}
              label="扫描托盘号或提单号"
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  attachTarget(scanValue);
                }
              }}
              placeholder="扫码后自动回车"
            />
            <Button variant="contained" startIcon={<CarOutlined />} disabled={!!scanError} onClick={() => attachTarget(scanValue)} sx={{ minWidth: 108 }}>
              录入
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Stack>
      </MainCard>

      <Dialog open={!!scanError} fullWidth maxWidth="xs" disableEscapeKeyDown onClose={() => {}}>
        <DialogTitle>扫描异常</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ pt: 0.5 }}>
            {scanError}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
          <Button
            variant="contained"
            onClick={() => {
              setScanError('');
            }}
          >
            知道了
          </Button>
        </DialogActions>
      </Dialog>

      <MainCard title="当前车辆装车清单">
        <Stack sx={{ gap: 1.25 }}>
          {linkedPallets.length ? (
            linkedPallets.map((item) => (
              <Box key={item.palletNo} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5 }}>
                <Typography variant="subtitle2">{item.palletNo}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.totalBoxes} 箱 / {item.totalWeightKg} kg / {item.entries?.length || 0} 票
                </Typography>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">还没有扫描任何托盘或提单。</Typography>
          )}
        </Stack>
      </MainCard>

      <MainCard title="完成装车">
        <Stack sx={{ gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            扫描完成后点击完成，即代表这辆车装车结束。
          </Typography>
          <Button
            fullWidth
            size="large"
            variant="contained"
            disabled={!linkedPallets.length}
            onClick={() => {
              runScopedAction('完成装车', `装车完成 / ${plan.id}`);
              setPallets((prev) =>
                prev.map((item) =>
                  linkedPallets.some((linked) => linked.palletNo === item.palletNo)
                    ? { ...item, loadedPlate: plan.truckPlate, loadedAt: new Date().toISOString() }
                    : item
                )
              );
              setLoadingPlans((prev) =>
                prev.map((item) =>
                  item.id === plan.id
                    ? {
                        ...item,
                        status: '已完成',
                        totalBoxes,
                        totalWeight: Number(totalWeight),
                        completedAt: new Date().toISOString()
                      }
                    : item
                )
              );
              if (onCompleted) onCompleted();
            }}
          >
            完成
          </Button>
        </Stack>
      </MainCard>

      <TaskCard {...roleAwareInboundTaskCardConfig('loadingExecution', flightNo, roleKey, roleView, runScopedAction)} />
    </Stack>
  );
}
