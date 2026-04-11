import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { inboundFlights, inboundWaybillRows } from 'data/sinoport';

const STORAGE_KEY = 'sinoport-mobile-inbound-counting-v1';
const SCAN_FORMATS = ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e'];

function normalizeCode(value) {
  return value.trim().toUpperCase();
}

function parsePieces(value) {
  const parsed = parseInt(String(value).replace(/[^\d]/g, ''), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildWaybillCatalog() {
  return inboundWaybillRows.map((item) => {
    const flight = inboundFlights.find((entry) => entry.flightNo === item.flightNo);
    return {
      ...item,
      barcode: normalizeCode(item.barcode || item.awb),
      expectedCount: parsePieces(item.pieces),
      source: flight?.source || '未指定来源',
      eta: flight?.eta || '-',
      etd: flight?.etd || '-'
    };
  });
}

export default function StationInboundMobilePage() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);

  const [waybillCatalog] = useState(buildWaybillCatalog);
  const [taskMap, setTaskMap] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  });
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedAwb, setSelectedAwb] = useState('');
  const [activeAwb, setActiveAwb] = useState('');
  const [scanMessage, setScanMessage] = useState('使用摄像头扫描条码，或手动输入提单号开始理货。');
  const [scanError, setScanError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(taskMap));
  }, [taskMap]);

  const stopScanning = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => () => stopScanning(), [stopScanning]);

  const resolveWaybill = useCallback(
    (rawCode) => {
      const code = normalizeCode(rawCode);
      const matched = waybillCatalog.find((item) => item.barcode === code || normalizeCode(item.awb) === code);

      if (!matched) {
        setScanError(`未找到条码 ${rawCode} 对应的提单，请手动选择。`);
        return;
      }

      setBarcodeInput(matched.barcode);
      setSelectedAwb(matched.awb);
      setActiveAwb(matched.awb);
      setScanError('');
      setScanMessage(`已识别提单 ${matched.awb}，可以开始逐箱点数。`);

      setTaskMap((prev) => {
        if (prev[matched.awb]) {
          return {
            ...prev,
            [matched.awb]: {
              ...prev[matched.awb],
              status: prev[matched.awb].status === '理货完成' ? '理货完成' : '点货中'
            }
          };
        }

        return {
          ...prev,
          [matched.awb]: {
            awb: matched.awb,
            counted: 0,
            status: '点货中',
            updatedAt: new Date().toISOString()
          }
        };
      });
    },
    [waybillCatalog]
  );

  const startScanning = useCallback(async () => {
    setScanError('');
    setScanMessage('正在请求摄像头权限并等待扫描条码…');

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('当前浏览器不支持摄像头访问，请改用手动输入。');
      return;
    }

    if (!('BarcodeDetector' in window)) {
      setScanError('当前浏览器不支持原生条码识别，请改用手动输入。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({ formats: SCAN_FORMATS });
      setIsScanning(true);
      setScanMessage('摄像头已开启，请将条码对准取景框。');

      scanTimerRef.current = window.setInterval(async () => {
        try {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          const codes = await detector.detect(videoRef.current);
          const firstCode = codes?.[0]?.rawValue;
          if (firstCode) {
            stopScanning();
            resolveWaybill(firstCode);
          }
        } catch {
          // Ignore intermittent detector failures while scanning.
        }
      }, 600);
    } catch (error) {
      stopScanning();
      setScanError(`摄像头启动失败：${error?.message || '未知错误'}`);
    }
  }, [resolveWaybill, stopScanning]);

  const waybillOptions = useMemo(
    () => waybillCatalog.map((item) => ({ ...item, label: `${item.awb} / ${item.flightNo} / ${item.consignee}` })),
    [waybillCatalog]
  );

  const activeWaybill = useMemo(
    () => waybillCatalog.find((item) => item.awb === activeAwb) || waybillCatalog.find((item) => item.awb === selectedAwb),
    [activeAwb, selectedAwb, waybillCatalog]
  );

  const activeTask = activeWaybill
    ? taskMap[activeWaybill.awb] || { awb: activeWaybill.awb, counted: 0, status: '点货中', updatedAt: null }
    : null;

  const discrepancy = activeWaybill ? activeTask.counted - activeWaybill.expectedCount : 0;
  const canComplete = !!activeWaybill && discrepancy === 0 && activeTask.counted > 0;

  const pendingTasks = useMemo(
    () =>
      Object.values(taskMap)
        .filter((item) => item.status === '暂时缺货')
        .map((task) => {
          const waybill = waybillCatalog.find((entry) => entry.awb === task.awb);
          return { ...task, waybill };
        }),
    [taskMap, waybillCatalog]
  );

  const completedTasks = useMemo(
    () =>
      Object.values(taskMap)
        .filter((item) => item.status === '理货完成')
        .map((task) => {
          const waybill = waybillCatalog.find((entry) => entry.awb === task.awb);
          return { ...task, waybill };
        }),
    [taskMap, waybillCatalog]
  );

  const updateActiveTask = (updater) => {
    if (!activeWaybill) return;

    setTaskMap((prev) => {
      const current = prev[activeWaybill.awb] || {
        awb: activeWaybill.awb,
        counted: 0,
        status: '点货中',
        updatedAt: null
      };

      const next = updater(current);
      return {
        ...prev,
        [activeWaybill.awb]: {
          ...next,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  const handleCountDelta = (delta) => {
    updateActiveTask((current) => ({
      ...current,
      counted: Math.max(0, current.counted + delta),
      status: current.status === '理货完成' ? '理货完成' : '点货中'
    }));
  };

  const handleCountInput = (event) => {
    const nextValue = parsePieces(event.target.value);
    updateActiveTask((current) => ({
      ...current,
      counted: nextValue,
      status: current.status === '理货完成' ? '理货完成' : '点货中'
    }));
  };

  const handleComplete = () => {
    updateActiveTask((current) => ({
      ...current,
      status: '理货完成'
    }));
    setScanMessage(`提单 ${activeWaybill.awb} 已完成理货。`);
  };

  const handleShortage = () => {
    updateActiveTask((current) => ({
      ...current,
      status: '暂时缺货'
    }));
    setScanMessage(`提单 ${activeWaybill.awb} 已标记为暂时缺货，可稍后继续点货。`);
  };

  const handleResume = (awb) => {
    setActiveAwb(awb);
    setSelectedAwb(awb);
    setScanError('');
    setScanMessage(`已恢复提单 ${awb} 的点货任务。`);
    setTaskMap((prev) => ({
      ...prev,
      [awb]: {
        ...prev[awb],
        status: '点货中',
        updatedAt: new Date().toISOString()
      }
    }));
  };

  return (
    <Grid container rowSpacing={2.5} columnSpacing={2.5}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Inbound / Mobile Counting"
          title="PDA 作业终端 / 进港理货"
          description="当前阶段以纯前端 demo 方式演示 PDA 现场理货，通过扫码、手输、差异校验和挂起恢复表达统一任务流。"
          chips={['扫码', '理货', 'PDA Task', '暂时缺货', '继续点货']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/inbound/flights" variant="outlined">
                航班管理
              </Button>
              <Button component={RouterLink} to="/station/inbound/waybills" variant="outlined">
                提单管理
              </Button>
              <Button component={RouterLink} to="/mobile/select" variant="outlined">
                节点选择
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title="扫码与输入">
          <Stack sx={{ gap: 2 }}>
            <Box
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: 'grey.900',
                minHeight: 260,
                position: 'relative'
              }}
            >
              <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {!isScanning && (
                <Stack
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'common.white',
                    px: 2,
                    textAlign: 'center',
                    bgcolor: 'rgba(0,0,0,0.45)'
                  }}
                >
                  <Typography variant="subtitle1">摄像头待启动</Typography>
                  <Typography variant="caption" color="grey.300">
                    点击下方“开始扫码”后，将条码对准取景框。
                  </Typography>
                </Stack>
              )}
            </Box>

            <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={startScanning} disabled={isScanning}>
                开始扫码
              </Button>
              <Button variant="outlined" onClick={stopScanning} disabled={!isScanning}>
                停止扫码
              </Button>
            </Stack>

            <TextField
              label="手动输入条码 / 提单号"
              value={barcodeInput}
              onChange={(event) => setBarcodeInput(event.target.value)}
              placeholder="例如：436-10358585"
            />
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  if (barcodeInput.trim()) resolveWaybill(barcodeInput);
                }}
              >
                查找提单
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  setBarcodeInput('');
                  setSelectedAwb('');
                  setActiveAwb('');
                  setScanError('');
                  setScanMessage('已清空当前输入。');
                }}
              >
                清空
              </Button>
            </Stack>

            <TextField
              select
              label="备用选择提单"
              value={selectedAwb}
              onChange={(event) => {
                const nextAwb = event.target.value;
                setSelectedAwb(nextAwb);
                setActiveAwb(nextAwb);
                setScanError('');
                setScanMessage(`已切换到提单 ${nextAwb}。`);
              }}
            >
              {waybillOptions.map((item) => (
                <MenuItem key={item.awb} value={item.awb}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>

            <MainCard contentSX={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                当前提示
              </Typography>
              <Typography variant="body2" color={scanError ? 'error.main' : 'text.secondary'}>
                {scanError || scanMessage}
              </Typography>
            </MainCard>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title="当前理货任务">
          {activeWaybill ? (
            <Stack sx={{ gap: 2.5 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Stack sx={{ gap: 0.5 }}>
                  <Typography variant="h5">{activeWaybill.awb}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    航班 {activeWaybill.flightNo} / 来源 {activeWaybill.source}
                  </Typography>
                </Stack>
                <StatusChip label={activeTask.status} />
              </Stack>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <MetricCard title="提单总箱数" value={`${activeWaybill.expectedCount}`} helper={activeWaybill.weight} chip="应点箱数" />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <MetricCard title="已点箱数" value={`${activeTask.counted}`} helper={`当前节点：${activeWaybill.currentNode}`} chip="现场计数" color="secondary" />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <MetricCard
                    title="差异"
                    value={discrepancy === 0 ? '0' : `${discrepancy > 0 ? '+' : ''}${discrepancy}`}
                    helper={discrepancy === 0 ? '点数与提单一致' : discrepancy > 0 ? '现场点数超过提单箱数' : '现场点数少于提单箱数'}
                    chip="校验结果"
                    color={discrepancy === 0 ? 'success' : 'warning'}
                  />
                </Grid>
              </Grid>

              <Divider />

              <Stack sx={{ gap: 1.5 }}>
                <Typography variant="subtitle2">逐箱点数</Typography>
                <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
                  <Button variant="outlined" onClick={() => handleCountDelta(-1)}>
                    -1
                  </Button>
                  <Button variant="contained" onClick={() => handleCountDelta(1)}>
                    +1 箱
                  </Button>
                  <TextField
                    label="手工修正箱数"
                    type="number"
                    value={activeTask.counted}
                    onChange={handleCountInput}
                    sx={{ maxWidth: 180 }}
                    inputProps={{ min: 0 }}
                  />
                </Stack>
              </Stack>

              <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
                <Button variant="contained" color="success" disabled={!canComplete} onClick={handleComplete}>
                  理货完成
                </Button>
                <Button variant="outlined" color="warning" onClick={handleShortage}>
                  暂时缺货
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Typography color="text.secondary">请先扫码、手动输入条码，或从备用列表中选择一个提单。</Typography>
          )}
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="待处理 / 暂时缺货">
          <Stack sx={{ gap: 1.5 }}>
            {pendingTasks.length ? (
              pendingTasks.map((task) => (
                <Stack
                  key={task.awb}
                  direction="row"
                  sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
                >
                  <Box>
                    <Typography variant="subtitle2">{task.awb}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      已点 {task.counted} / 应点 {task.waybill?.expectedCount || '-'} 箱
                    </Typography>
                  </Box>
                  <Button variant="outlined" onClick={() => handleResume(task.awb)}>
                    继续点货
                  </Button>
                </Stack>
              ))
            ) : (
              <Typography color="text.secondary">当前没有暂时缺货任务。</Typography>
            )}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="已完成理货">
          <Stack sx={{ gap: 1.5 }}>
            {completedTasks.length ? (
              completedTasks.map((task) => (
                <Stack key={task.awb} direction="row" sx={{ justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle2">{task.awb}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {task.waybill?.flightNo || '-'} / 已点 {task.counted} 箱
                    </Typography>
                  </Box>
                  <StatusChip label="理货完成" color="success" />
                </Stack>
              ))
            ) : (
              <Typography color="text.secondary">当前没有已完成的理货记录。</Typography>
            )}
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
