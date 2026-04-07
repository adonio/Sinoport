import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import BarcodeOutlined from '@ant-design/icons/BarcodeOutlined';
import CameraOutlined from '@ant-design/icons/CameraOutlined';
import CarOutlined from '@ant-design/icons/CarOutlined';
import InboxOutlined from '@ant-design/icons/InboxOutlined';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import StatusChip from 'components/sinoport/StatusChip';
import { ffmForecastRows, masterAwbRows, outboundFlights } from 'data/sinoport';
import { useLocalStorage } from 'hooks/useLocalStorage';
import { readMobileSession } from 'utils/mobile/session';
import { localizeMobileText, readMobileLanguage, t } from 'utils/mobile/i18n';

export function parseNumber(value) {
  const parsed = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function normalizeCode(value) {
  return value.trim().toUpperCase();
}

function stationKeyOf(session) {
  return (session?.station || 'default').replace(/\s+/g, '-');
}

function mobileLanguage() {
  return readMobileSession()?.language || readMobileLanguage();
}

function mt(value) {
  return localizeMobileText(mobileLanguage(), value);
}

function recognizeContainerCode(file) {
  const upperName = file.name.toUpperCase();
  const match = upperName.match(/(ULD|PMC|AKE|PAG)[-_ ]?([A-Z0-9]{3,})/);
  if (match) return `${match[1]}${match[2]}`;
  return `ULD${String(Date.now()).slice(-5)}`;
}

const awbCatalog = (() => {
  const map = new Map();
  [...ffmForecastRows, ...masterAwbRows].forEach((item) => {
    if (!map.has(item.awb)) {
      const pieces = parseNumber(item.pieces || item.pcs);
      const weight = parseNumber(item.weight);
      map.set(item.awb, {
        awb: item.awb,
        destination: item.destination || item.route || '-',
        consignee: item.consignee || item.shipper || item.destination || '-',
        totalPieces: pieces,
        totalWeight: weight,
        unitWeight: pieces ? weight / pieces : 0
      });
    }
  });
  return Array.from(map.values());
})();

const DEFAULT_OUTBOUND_CONTAINERS = [
  {
    boardCode: 'ULD88001',
    flightNo: 'URO913',
    entries: [
      { awb: '436-10358585', pieces: 24, boxes: 12, weight: '336.0' },
      { awb: '436-10361352', pieces: 30, boxes: 15, weight: '564.0' }
    ],
    totalBoxes: 27,
    totalWeightKg: 900.0,
    reviewedWeightKg: 912.4,
    status: '待装机',
    createdAt: '2026-04-07T18:10:00.000Z'
  },
  {
    boardCode: 'ULD88002',
    flightNo: 'URO913',
    entries: [
      { awb: '436-10358585', pieces: 10, boxes: 5, weight: '140.0' }
    ],
    totalBoxes: 5,
    totalWeightKg: 140.0,
    reviewedWeightKg: 142.1,
    status: '待装机',
    createdAt: '2026-04-07T18:18:00.000Z'
  },
  {
    boardCode: 'ULD88003',
    flightNo: 'URO913',
    entries: [
      { awb: '436-10358585', pieces: 16, boxes: 8, weight: '224.0' }
    ],
    totalBoxes: 8,
    totalWeightKg: 224.0,
    reviewedWeightKg: 226.8,
    status: '已装机',
    offloadBoxes: 2,
    offloadStatus: '已拉货',
    loadedAt: '2026-04-07T19:02:00.000Z',
    createdAt: '2026-04-07T17:56:00.000Z'
  },
  {
    boardCode: 'ULD88004',
    flightNo: 'URO913',
    entries: [
      { awb: '436-10359044', pieces: 40, boxes: 10, weight: '604.7' },
      { awb: '436-10359218', pieces: 18, boxes: 6, weight: '324.0' }
    ],
    totalBoxes: 16,
    totalWeightKg: 928.7,
    reviewedWeightKg: 934.1,
    status: '待装机',
    createdAt: '2026-04-07T18:32:00.000Z'
  },
  {
    boardCode: 'ULD88005',
    flightNo: 'URO913',
    entries: [
      { awb: '436-10359301', pieces: 20, boxes: 5, weight: '340.0' }
    ],
    totalBoxes: 5,
    totalWeightKg: 340.0,
    reviewedWeightKg: 342.5,
    status: '待装机',
    createdAt: '2026-04-07T18:41:00.000Z'
  },
  {
    boardCode: 'ULD91001',
    flightNo: 'SE913',
    entries: [
      { awb: '436-10357583', pieces: 80, boxes: 18, weight: '1267.0' },
      { awb: '436-10357896', pieces: 55, boxes: 13, weight: '904.0' }
    ],
    totalBoxes: 31,
    totalWeightKg: 2171.0,
    reviewedWeightKg: 2180.5,
    status: '待装机',
    createdAt: '2026-04-07T19:10:00.000Z'
  },
  {
    boardCode: 'ULD91002',
    flightNo: 'SE913',
    entries: [
      { awb: '436-10359477', pieces: 30, boxes: 8, weight: '474.0' },
      { awb: '436-10359512', pieces: 24, boxes: 6, weight: '360.0' }
    ],
    totalBoxes: 14,
    totalWeightKg: 834.0,
    reviewedWeightKg: 840.2,
    status: '已装机',
    loadedAt: '2026-04-07T19:18:00.000Z',
    createdAt: '2026-04-07T18:58:00.000Z'
  }
];

export function getOutboundFlight(flightNo) {
  return outboundFlights.find((item) => item.flightNo === flightNo) || null;
}

export function getFlightAwbCatalog(flightNo) {
  if (!flightNo) return awbCatalog;
  if (flightNo.startsWith('SE')) return awbCatalog.filter((item) => item.destination === 'MST');
  if (flightNo.startsWith('URO')) return awbCatalog.filter((item) => item.destination === 'MME');
  return awbCatalog;
}

export function buildOutboundWaybills(flightNo) {
  return getFlightAwbCatalog(flightNo).map((item) => ({
    awb: item.awb,
    consignee: item.consignee,
    pieces: String(item.totalPieces),
    weight: `${item.totalWeight} kg`,
    expectedBoxes: item.totalPieces,
    totalWeightKg: item.totalWeight,
    barcode: normalizeCode(item.awb),
    currentNode: '出港收货',
    noaStatus: '待处理',
    podStatus: '待处理',
    transferStatus: '待装机'
  }));
}

export function getOutboundSummary(flight) {
  const plannedAwbs = getFlightAwbCatalog(flight?.flightNo);
  return {
    plannedAwbCount: plannedAwbs.length,
    plannedPieces: plannedAwbs.reduce((sum, item) => sum + item.totalPieces, 0),
    plannedWeight: plannedAwbs.reduce((sum, item) => sum + item.totalWeight, 0)
  };
}

export function useOutboundStorage() {
  const session = readMobileSession();
  const stationKey = stationKeyOf(session);
  const containers = useLocalStorage(`sinoport-mobile-outbound-containers-${stationKey}`, DEFAULT_OUTBOUND_CONTAINERS);
  const receipts = useLocalStorage(`sinoport-mobile-outbound-receipts-${stationKey}`, {});

  useEffect(() => {
    const current = Array.isArray(containers.state) ? containers.state : [];
    const missingDefaults = DEFAULT_OUTBOUND_CONTAINERS.filter(
      (seed) => !current.some((item) => item.boardCode === seed.boardCode && item.flightNo === seed.flightNo)
    );

    if (missingDefaults.length) {
      containers.setState([...current, ...missingDefaults]);
    }
  }, [containers.state, containers.setState]);

  return {
    pmcBoards: containers.state,
    setPmcBoards: containers.setState,
    receiptMap: receipts.state,
    setReceiptMap: receipts.setState
  };
}

export function OutboundFlightHeroCard({ flight }) {
  const summary = getOutboundSummary(flight);

  return (
    <MainCard>
      <Stack sx={{ gap: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <div>
            <Typography variant="overline" color="primary.main">
              当前航班
            </Typography>
            <Typography variant="h3" sx={{ mt: 0.5 }}>
              {flight.flightNo}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              ETD {flight.etd} · 当前阶段 {flight.stage} · Manifest {flight.manifest}
            </Typography>
          </div>
          <StatusChip label={flight.status} />
        </Stack>

        <Grid container spacing={1.5}>
          <Grid size={4}>
            <MetricCard title="提单总数" value={`${summary.plannedAwbCount}`} helper="当前航班计划提单数" chip="AWB" />
          </Grid>
          <Grid size={4}>
            <MetricCard title="计划件数" value={`${summary.plannedPieces}`} helper="来自航班计划数据" color="secondary" />
          </Grid>
          <Grid size={4}>
            <MetricCard title="计划重量" value={`${summary.plannedWeight.toFixed(1)} kg`} helper="用于装机校验" color="success" />
          </Grid>
        </Grid>
      </Stack>
    </MainCard>
  );
}

export function OutboundOverviewPanel({ flight, pmcBoards = [], receiptMap = {} }) {
  const summary = getOutboundSummary(flight);
  const flightContainers = pmcBoards.filter((item) => item.flightNo === flight.flightNo);
  const flightReceipts = Object.values(receiptMap).filter((item) => item.flightNo === flight.flightNo);
  const flightAwbs = getFlightAwbCatalog(flight.flightNo);

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title="航班概览">
        <Grid container spacing={1.5}>
          <Grid size={4}>
            <MetricCard title="已收货提单" value={`${flightReceipts.length}`} helper="已开始收货的提单" />
          </Grid>
          <Grid size={4}>
            <MetricCard title="集装器数量" value={`${flightContainers.length}`} helper="当前航班已建集装器" color="secondary" />
          </Grid>
          <Grid size={4}>
            <MetricCard title="计划重量" value={`${summary.plannedWeight.toFixed(1)} kg`} helper="用于装机校验" color="success" />
          </Grid>
        </Grid>
      </MainCard>

      <MainCard title="计划提单明细">
        <Stack sx={{ gap: 1.25 }}>
          {flightAwbs.map((item) => (
            <Box key={item.awb} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
              <Typography variant="subtitle2">{item.awb}</Typography>
              <Typography variant="caption" color="text.secondary">
                目的地 {item.destination} · 计划件数 {item.totalPieces} · 计划重量 {item.totalWeight} kg
              </Typography>
            </Box>
          ))}
        </Stack>
      </MainCard>
    </Stack>
  );
}

function outboundTabItems() {
  const language = mobileLanguage();
  return [
    { key: 'overview', label: t(language, 'overview'), icon: AppstoreOutlined, pathOf: (flightNo) => `/mobile/outbound/${flightNo}` },
    { key: 'receipt', label: t(language, 'receipt'), icon: InboxOutlined, pathOf: (flightNo) => `/mobile/outbound/${flightNo}/receipt` },
    { key: 'container', label: t(language, 'container'), icon: BarcodeOutlined, pathOf: (flightNo) => `/mobile/outbound/${flightNo}/pmc` },
    { key: 'loading', label: language === 'en' ? 'Aircraft' : '装机', icon: CarOutlined, pathOf: (flightNo) => `/mobile/outbound/${flightNo}/loading` }
  ];
}

export function OutboundFlightAppShell({ flight, children, showHero = true }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Box sx={{ pb: 11 }}>
      <Stack sx={{ gap: 2 }}>
        {showHero ? <OutboundFlightHeroCard flight={flight} /> : null}
        {children}
      </Stack>

      <Paper
        elevation={4}
        sx={{
          position: 'fixed',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 24px)',
          maxWidth: 456,
          borderRadius: 3,
          px: 1,
          py: 1,
          zIndex: 12
        }}
      >
        <Stack direction="row" sx={{ gap: 0.75 }}>
          {outboundTabItems().map((item) => {
            const active = location.pathname === item.pathOf(flight.flightNo);
            const Icon = item.icon;

            return (
              <Button
                key={item.key}
                fullWidth
                size="small"
                variant={active ? 'contained' : 'text'}
                color={active ? 'primary' : 'inherit'}
                onClick={() => navigate(item.pathOf(flight.flightNo))}
                sx={{ minWidth: 0, px: 0.25, py: 0.9 }}
              >
                <Stack sx={{ alignItems: 'center', gap: 0.35, width: '100%' }}>
                  <Icon />
                  <Typography variant="caption" sx={{ lineHeight: 1.1 }}>
                    {item.label}
                  </Typography>
                </Stack>
              </Button>
            );
          })}
        </Stack>
      </Paper>
    </Box>
  );
}

export function ReceiptPanel({ flightNo, receiptMap, setReceiptMap }) {
  const navigate = useNavigate();
  const scanInputRef = useRef(null);
  const [scanValue, setScanValue] = useState('');
  const [activeAwb, setActiveAwb] = useState('');
  const [receiptCount, setReceiptCount] = useState('');
  const [reviewAwb, setReviewAwb] = useState('');
  const [reviewWeight, setReviewWeight] = useState('');
  const [message, setMessage] = useState('先扫描一个提单号，再录入该提单的收货件数。');

  useEffect(() => {
    scanInputRef.current?.focus();
  }, [flightNo]);

  const flightAwbs = getFlightAwbCatalog(flightNo);
  const receivedItems = flightAwbs.filter((item) => receiptMap[item.awb]?.flightNo === flightNo);

  const attachReceipt = (rawCode) => {
    const code = normalizeCode(rawCode);
    const matched = flightAwbs.find((item) => normalizeCode(item.awb) === code);

    if (!matched) {
      setMessage(`未找到提单 ${rawCode}。`);
      return;
    }

    setActiveAwb(matched.awb);
    setScanValue(matched.awb);
    setReceiptCount(receiptMap[matched.awb]?.receivedPieces ? String(receiptMap[matched.awb].receivedPieces) : '');
    setMessage(`提单 ${matched.awb} 已识别，请录入该提单的收货件数。`);
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
        receivedAt: new Date().toISOString(),
        status: '已收货'
      }
    }));
    setMessage(`提单 ${matched.awb} 收货件数已记录为 ${receiptCount}。`);
    setReceiptCount('');
  };

  const saveReviewWeight = () => {
    if (!reviewAwb || !reviewWeight) return;
    setReceiptMap((prev) => ({
      ...prev,
      [reviewAwb]: {
        ...prev[reviewAwb],
        reviewedWeight: parseNumber(reviewWeight),
        reviewedAt: new Date().toISOString(),
        reviewStatus: '已复核'
      }
    }));
    setReviewAwb('');
    setReviewWeight('');
  };

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title="收货扫描">
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
              placeholder="扫码后自动回车"
            />
            <Button variant="contained" startIcon={<InboxOutlined />} onClick={() => attachReceipt(scanValue)}>
              {mt('收货')}
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Stack>
      </MainCard>

      {activeAwb ? (
        <MainCard title="录入收货件数">
          <Stack sx={{ gap: 2 }}>
            <Typography variant="subtitle2">{activeAwb}</Typography>
            <TextField label="收货件数" value={receiptCount} onChange={(event) => setReceiptCount(event.target.value)} />
            <Button variant="contained" disabled={!receiptCount} onClick={saveReceiptCount}>
              保存件数
            </Button>
          </Stack>
        </MainCard>
      ) : null}

      <MainCard title="已收货提单">
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
                        收货件数 {receipt?.receivedPieces || 0} / 计划件数 {item.totalPieces} · 计划重量 {item.totalWeight} kg
                      </Typography>
                    </div>
                    <StatusChip label={receipt?.reviewStatus || '已收货'} color={receipt?.reviewStatus === '已复核' ? 'success' : 'secondary'} />
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 1, gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => navigate(`/mobile/outbound/${flightNo}/receipt/counting/${encodeURIComponent(item.awb)}`)}>
                      点数
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setReviewAwb(item.awb);
                        setReviewWeight(receipt?.reviewedWeight ? String(receipt.reviewedWeight) : '');
                      }}
                    >
                      复核
                    </Button>
                  </Stack>
                </Box>
              );
            })
          ) : (
            <Typography color="text.secondary">当前航班还没有已收货提单。</Typography>
          )}
        </Stack>
      </MainCard>

      <Dialog open={!!reviewAwb} fullWidth maxWidth="xs" onClose={() => setReviewAwb('')}>
        <DialogTitle>重量复核</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 0.5 }}>
            <Typography variant="subtitle2">{reviewAwb}</Typography>
            <TextField label="复核重量(kg)" value={reviewWeight} onChange={(event) => setReviewWeight(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewAwb('')}>取消</Button>
          <Button variant="contained" onClick={saveReviewWeight} disabled={!reviewWeight}>
            保存复核
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export function ContainerListPanel({ flightNo, pmcBoards }) {
  const navigate = useNavigate();
  const flightContainers = pmcBoards.filter((item) => item.flightNo === flightNo);

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title={mt('集装器')}>
        <Stack sx={{ gap: 2 }}>
          <Button variant="contained" startIcon={<BarcodeOutlined />} onClick={() => navigate(`/mobile/outbound/${flightNo}/pmc/new`)}>
            {mt('新建集装器')}
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
                      {container.entries.length} 票 / {container.totalBoxes} 箱 / {container.reviewedWeightKg || container.totalWeightKg} kg
                    </Typography>
                  </div>
                  <StatusChip label={container.status} />
                </Stack>
                <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 1 }}>
                  <Button size="small" variant="contained" onClick={() => navigate(`/mobile/outbound/${flightNo}/pmc/${encodeURIComponent(container.boardCode)}`)}>
                    {mt('装货')}
                  </Button>
                </Stack>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">当前航班还没有集装器。</Typography>
          )}
        </Stack>
      </MainCard>
    </Stack>
  );
}

export function ContainerCreatePanel({ flightNo, pmcBoards, setPmcBoards }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState('输入集装器号码或拍照识别后，点击完成即可创建。');
  const [form, setForm] = useState({ boardCode: '', photoName: '' });

  const canSubmit = form.boardCode.trim();

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard title={mt('新建集装器')}>
        <Stack sx={{ gap: 2 }}>
          <Button component="label" fullWidth variant="contained" startIcon={<CameraOutlined />}>
            拍摄 / 上传集装器照片
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
                setMessage(`已识别集装器号：${boardCode}`);
              }}
            />
          </Button>

          <TextField
            label="集装器号码"
            value={form.boardCode}
            onChange={(event) => setForm((prev) => ({ ...prev, boardCode: event.target.value.toUpperCase() }))}
          />

          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Stack>
      </MainCard>

      <MainCard title="完成创建">
        <Stack sx={{ gap: 2 }}>
          <Button
            fullWidth
            size="large"
            variant="contained"
            disabled={!canSubmit}
            onClick={() => {
              const normalizedCode = form.boardCode.trim().toUpperCase();
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
            完成
          </Button>
        </Stack>
      </MainCard>
    </Stack>
  );
}

export function ContainerDetailPanel({ flightNo, containerCode, pmcBoards, setPmcBoards }) {
  const navigate = useNavigate();
  const scanInputRef = useRef(null);
  const [scanValue, setScanValue] = useState('');
  const [activeAwb, setActiveAwb] = useState('');
  const [message, setMessage] = useState('使用条码枪扫描提单号后，会按件数逐件累加到当前集装器。');
  const [entry, setEntry] = useState({ awb: '', boxes: '', pieces: '' });

  const flightAwbs = getFlightAwbCatalog(flightNo);
  const container = pmcBoards.find((item) => item.flightNo === flightNo && item.boardCode === containerCode);
  const selectedMeta = flightAwbs.find((item) => item.awb === entry.awb) || flightAwbs.find((item) => item.awb === activeAwb);

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
            当前已录入 {container.entries.length} 票 / {container.totalBoxes} 箱 / {container.reviewedWeightKg || container.totalWeightKg} kg
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
                    setMessage(`未找到提单 ${scanValue}。`);
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
                  setMessage(`提单 ${matched.awb} 已扫描，当前准备追加 ${Number(entry.pieces || 0) + 1} 件。`);
                }
              }}
              placeholder="扫码后自动回车逐件累加"
            />
            <Button
              variant="contained"
              startIcon={<InboxOutlined />}
              onClick={() => {
                const matched = flightAwbs.find((item) => normalizeCode(item.awb) === normalizeCode(scanValue));
                if (!matched) {
                  setMessage(`未找到提单 ${scanValue}。`);
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
                setMessage(`提单 ${matched.awb} 已扫描，当前准备追加 ${Number(entry.pieces || 0) + 1} 件。`);
              }}
            >
              {mt('扫描')}
            </Button>
          </Stack>

          <Grid container spacing={1.5}>
            <Grid size={6}>
              <TextField
                select
                label="提单号"
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
              <TextField label="件数" value={entry.pieces} onChange={(event) => setEntry((prev) => ({ ...prev, pieces: event.target.value }))} />
            </Grid>
            <Grid size={3}>
              <TextField label="箱数" value={entry.boxes} onChange={(event) => setEntry((prev) => ({ ...prev, boxes: event.target.value }))} />
            </Grid>
          </Grid>

          <Button
            variant="contained"
            disabled={!entry.awb || !entry.boxes || !entry.pieces}
            onClick={() => {
              const awbMeta = flightAwbs.find((item) => item.awb === entry.awb);
              const weight = awbMeta?.unitWeight ? (awbMeta.unitWeight * parseNumber(entry.pieces)).toFixed(1) : '0.0';
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
            追加提单
          </Button>

          <Typography variant="body2" color="text.secondary">
            {message}
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
                  <Typography variant="subtitle2">{item.pieces} 件</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  箱数 {item.boxes} / 重量 {item.weight} kg
                </Typography>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">当前集装器还没有提单。</Typography>
          )}
        </Stack>
      </MainCard>
    </Stack>
  );
}

export function LoadingPanel({ flightNo, pmcBoards, setPmcBoards }) {
  const [activeContainerCode, setActiveContainerCode] = useState('');
  const [offloadBoxes, setOffloadBoxes] = useState('');
  const containers = pmcBoards.filter((item) => item.flightNo === flightNo);
  const pendingContainers = containers.filter((item) => item.status !== '已装机');
  const loadedContainers = containers.filter((item) => item.status === '已装机');

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
                      {item.entries.length} 票 / {item.totalBoxes} 箱 / 复核 {item.reviewedWeightKg || item.totalWeightKg} kg
                    </Typography>
                  </div>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() =>
                      setPmcBoards((prev) =>
                        prev.map((container) =>
                          container.boardCode === item.boardCode ? { ...container, status: '已装机', loadedAt: new Date().toISOString() } : container
                        )
                      )
                    }
                  >
                    {mobileLanguage() === 'en' ? 'Load' : '装机'}
                  </Button>
                </Stack>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">当前航班没有待装机集装器。</Typography>
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
                      已装机 · {item.totalBoxes} 箱 / {item.reviewedWeightKg || item.totalWeightKg} kg
                    </Typography>
                  </div>
                  <StatusChip label={item.offloadBoxes ? '警戒' : '已完成'} color={item.offloadBoxes ? 'warning' : 'success'} />
                </Stack>

                <Stack direction="row" sx={{ gap: 1, mt: 1 }}>
                  <TextField
                    size="small"
                    label="拉货箱数"
                    value={activeContainerCode === item.boardCode ? offloadBoxes : item.offloadBoxes || ''}
                    onChange={(event) => {
                      setActiveContainerCode(item.boardCode);
                      setOffloadBoxes(event.target.value);
                    }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
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
                      )
                    }
                  >
                    记录拉货
                  </Button>
                </Stack>

                {item.offloadBoxes ? (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.75, display: 'block' }}>
                    已记录拉货 {item.offloadBoxes} 箱
                  </Typography>
                ) : null}
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">当前航班还没有已装机集装器。</Typography>
          )}
        </Stack>
      </MainCard>
    </Stack>
  );
}
