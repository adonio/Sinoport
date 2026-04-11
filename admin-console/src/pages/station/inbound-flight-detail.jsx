import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useParams } from 'react-router-dom';

import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { inboundFlights, inboundFlightWaybillDetails } from 'data/sinoport';
import { inboundDocumentGates } from 'data/sinoport-adapters';
import { useLocalStorage } from 'hooks/useLocalStorage';
import { getMobileStationKey, readMobileSession } from 'utils/mobile/session';

function buildSummary(waybills) {
  return {
    total: waybills.length,
    noaPending: waybills.filter((item) => item.noaStatus === '待处理').length,
    podPending: waybills.filter((item) => item.podStatus === '待处理').length,
    inProgress: waybills.filter((item) => !['已交付', '已签收', 'POD 已签收'].includes(item.currentNode)).length
  };
}

export default function StationInboundFlightDetailPage() {
  const { flightNo } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const stationKey = getMobileStationKey(readMobileSession() || { stationCode: 'MME' });
  const { state: loadingPlans, setState: setLoadingPlans } = useLocalStorage(`sinoport-mobile-loading-plans-${stationKey}`, []);
  const { state: pallets, setState: setPallets } = useLocalStorage(`sinoport-mobile-inbound-pallets-${stationKey}`, []);
  const [palletForm, setPalletForm] = useState({
    flightNo: flightNo || 'SE803',
    palletNo: `${flightNo || 'SE803'}-PLT-1901`,
    awbs: '436-10358585, 436-10359018',
    totalBoxes: '18',
    totalWeightKg: '438.0',
    storageLocation: 'MME-STAGE-91'
  });
  const [planForm, setPlanForm] = useState({
    id: `LOAD-${flightNo || 'SE803'}-901`,
    flightNo: flightNo || 'SE803',
    truckPlate: 'HX-TRK-901',
    driverName: 'Office Planner',
    collectionNote: `CN-${flightNo || 'SE803'}-901`,
    forkliftDriver: 'Forklift Planner',
    checker: 'Checker Planner',
    arrivalTime: '2026-04-07T21:10',
    palletNos: `${flightNo || 'SE803'}-PLT-1901`
  });
  const flight = inboundFlights.find((item) => item.flightNo === flightNo);
  const waybills = (flightNo && inboundFlightWaybillDetails[flightNo]) || [];
  const flightPallets = useMemo(() => pallets.filter((item) => item.flightNo === flightNo), [pallets, flightNo]);
  const flightLoadingPlans = useMemo(() => loadingPlans.filter((item) => item.flightNo === flightNo), [loadingPlans, flightNo]);

  if (!flight) {
    return (
      <Grid container rowSpacing={3} columnSpacing={3}>
        <Grid size={12}>
          <PageHeader
            eyebrow="Inbound / Flights / Detail"
            title="未找到航班"
            description={`未找到航班 ${flightNo || ''}，请返回进港航班列表重新选择。`}
            action={
              <Button component={RouterLink} to="/station/inbound/flights" variant="contained">
                返回航班列表
              </Button>
            }
          />
        </Grid>
      </Grid>
    );
  }

  const summary = buildSummary(waybills);

  const saveOfficePallet = () => {
    const awbs = palletForm.awbs
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!palletForm.palletNo.trim() || !awbs.length) return;

    setPallets((prev) => [
      {
        palletNo: palletForm.palletNo.trim().toUpperCase(),
        flightNo: flightNo,
        storageLocation: palletForm.storageLocation.trim() || 'MME-STAGE-99',
        entries: awbs.map((awb) => ({ awb, consignee: 'Office Planned', boxes: 0, weightKg: 0 })),
        printed: true,
        totalWeightKg: Number(palletForm.totalWeightKg || 0),
        totalBoxes: Number(palletForm.totalBoxes || 0),
        status: '待装车',
        printQueuedAt: new Date().toISOString()
      },
      ...prev.filter((item) => !(item.palletNo === palletForm.palletNo.trim().toUpperCase() && item.flightNo === flightNo))
    ]);
  };

  const saveOfficeLoadingPlan = () => {
    const palletNos = planForm.palletNos
      .split(/[,\n]/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    const linkedPallets = pallets.filter((item) => item.flightNo === flightNo && palletNos.includes(item.palletNo));
    const totalBoxes = linkedPallets.reduce((sum, item) => sum + (item.totalBoxes || 0), 0);
    const totalWeight = linkedPallets.reduce((sum, item) => sum + (item.totalWeightKg || 0), 0);
    if (!planForm.truckPlate.trim() || !planForm.collectionNote.trim()) return;

    setLoadingPlans((prev) => [
      {
        id: planForm.id || `LOAD-${String(Date.now()).slice(-6)}`,
        flightNo,
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
        status: '计划',
        createdAt: new Date().toISOString()
      },
      ...prev.filter((item) => !(item.id === (planForm.id || '') && item.flightNo === flightNo))
    ]);
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="进港 / 航班 / 详情"
          title={`航班详情 / ${flight.flightNo}`}
          description={`查看航班 ${flight.flightNo} 的基础信息，以及该航班下所有提单、任务、文件门槛、NOA、POD 和转运状态。`}
          chips={[`来源：${flight.source}`, `ETA ${flight.eta}`, `ETD ${flight.etd}`, `优先级 ${flight.priority}`]}
          action={
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button component={RouterLink} to="/station/inbound/flights/new" variant="contained">
                新建航班
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证中心
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                任务中心
              </Button>
              <Button component={RouterLink} to="/station/inbound/flights" variant="outlined">
                返回航班列表
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="航班状态" value={flight.status} helper={`当前节点：${flight.step}`} chip="航班" color="primary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="提单总数" value={`${summary.total} 票`} helper={flight.cargo} chip="提单" color="secondary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="待发送 NOA" value={`${summary.noaPending} 票`} helper="尚未完成到货通知发送" chip="NOA" color="warning" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="待补 POD" value={`${summary.podPending} 票`} helper="签收文件仍待回传或归档" chip="POD" color="error" />
      </Grid>

      <Grid size={12}>
        <MainCard title="详情视图" contentSX={{ p: 0 }}>
          <Tabs
            value={activeTab}
            onChange={(_, nextTab) => setActiveTab(nextTab)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2.5, pt: 1 }}
          >
            <Tab label="概览" value="overview" />
            <Tab label={`办公室编排 ${flightLoadingPlans.length + flightPallets.length}`} value="office" />
            <Tab label={`文件门槛 ${inboundDocumentGates.length}`} value="gates" />
            <Tab label={`提单状态 ${summary.total}`} value="waybills" />
          </Tabs>
          <Divider />

          <Box sx={{ p: 2.5 }}>
            {activeTab === 'overview' ? (
              <Grid container rowSpacing={3} columnSpacing={3}>
                <Grid size={{ xs: 12, lg: 4 }}>
                  <MainCard title="航班基础信息">
                    <Stack sx={{ gap: 2 }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">航班号</Typography>
                        <Typography fontWeight={600}>{flight.flightNo}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">来源</Typography>
                        <Typography fontWeight={600}>{flight.source}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">ETA</Typography>
                        <Typography fontWeight={600}>{flight.eta}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">ETD</Typography>
                        <Typography fontWeight={600}>{flight.etd}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">优先级</Typography>
                        <Typography fontWeight={600}>{flight.priority}</Typography>
                      </Stack>
                    </Stack>
                  </MainCard>
                </Grid>

                <Grid size={{ xs: 12, lg: 4 }}>
                  <MainCard title="处理提示">
                    <Stack sx={{ gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2">当前节点</Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                          {flight.step}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2">待推进动作</Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                          当前仍有 {summary.inProgress} 票提单处于处理中，其中 {summary.noaPending} 票待 NOA、
                          {summary.podPending} 票待 POD。
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2">建议入口</Typography>
                        <Stack direction="row" sx={{ mt: 1.5, gap: 1, flexWrap: 'wrap' }}>
                          <Button component={RouterLink} to="/station/tasks" size="small" variant="outlined">
                            查看任务
                          </Button>
                          <Button component={RouterLink} to="/station/documents" size="small" variant="outlined">
                            查看单证
                          </Button>
                        </Stack>
                      </Box>
                    </Stack>
                  </MainCard>
                </Grid>

                <Grid size={{ xs: 12, lg: 4 }}>
                  <MainCard title="文件门槛摘要">
                    <Stack sx={{ gap: 1.5 }}>
                      {inboundDocumentGates.slice(0, 3).map((item) => (
                        <Box key={item.gateId || item.node} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                            <Typography variant="subtitle2">{item.gateId || item.node}</Typography>
                            <StatusChip label={item.status} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {item.node}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </MainCard>
                </Grid>
              </Grid>
            ) : null}

            {activeTab === 'office' ? (
              <Grid container rowSpacing={3} columnSpacing={3}>
                <Grid size={{ xs: 12, xl: 5 }}>
                  <MainCard title="后台托盘预排">
                    <Stack sx={{ gap: 1.5 }}>
                      <TextField label="托盘号" value={palletForm.palletNo} onChange={(event) => setPalletForm((prev) => ({ ...prev, palletNo: event.target.value }))} />
                      <TextField label="计划 AWB" value={palletForm.awbs} onChange={(event) => setPalletForm((prev) => ({ ...prev, awbs: event.target.value }))} />
                      <Stack direction="row" sx={{ gap: 1.5 }}>
                        <TextField label="总箱数" value={palletForm.totalBoxes} onChange={(event) => setPalletForm((prev) => ({ ...prev, totalBoxes: event.target.value }))} />
                        <TextField label="总重量" value={palletForm.totalWeightKg} onChange={(event) => setPalletForm((prev) => ({ ...prev, totalWeightKg: event.target.value }))} />
                      </Stack>
                      <TextField label="存放位置" value={palletForm.storageLocation} onChange={(event) => setPalletForm((prev) => ({ ...prev, storageLocation: event.target.value }))} />
                      <Button variant="contained" onClick={saveOfficePallet}>
                        保存托盘预排
                      </Button>
                    </Stack>
                  </MainCard>
                </Grid>

                <Grid size={{ xs: 12, xl: 7 }}>
                  <MainCard title="托盘计划清单">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>托盘号</TableCell>
                          <TableCell>存放位置</TableCell>
                          <TableCell>计划 AWB</TableCell>
                          <TableCell>状态</TableCell>
                          <TableCell align="right">操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {flightPallets.map((item) => (
                          <TableRow key={item.palletNo} hover>
                            <TableCell>{item.palletNo}</TableCell>
                            <TableCell>{item.storageLocation || '-'}</TableCell>
                            <TableCell>{(item.entries || []).map((entry) => entry.awb).join(' / ')}</TableCell>
                            <TableCell>{item.status}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    setPalletForm({
                                      flightNo,
                                      palletNo: item.palletNo,
                                      awbs: (item.entries || []).map((entry) => entry.awb).join(', '),
                                      totalBoxes: String(item.totalBoxes || 0),
                                      totalWeightKg: String(item.totalWeightKg || 0),
                                      storageLocation: item.storageLocation || ''
                                    })
                                  }
                                >
                                  编辑
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    setPallets((prev) => [
                                      {
                                        ...item,
                                        palletNo: `${item.palletNo}-COPY`,
                                        printQueuedAt: new Date().toISOString()
                                      },
                                      ...prev
                                    ])
                                  }
                                >
                                  复制
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  onClick={() =>
                                    setPallets((prev) =>
                                      prev.map((entry) => (entry.palletNo === item.palletNo && entry.flightNo === flightNo ? { ...entry, status: '已撤回' } : entry))
                                    )
                                  }
                                >
                                  撤回
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() =>
                                    setPallets((prev) => prev.filter((entry) => !(entry.palletNo === item.palletNo && entry.flightNo === flightNo)))
                                  }
                                >
                                  删除
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </MainCard>
                </Grid>

                <Grid size={{ xs: 12, xl: 5 }}>
                  <MainCard title="后台装车计划编排">
                    <Stack sx={{ gap: 1.5 }}>
                      <TextField label="计划编号" value={planForm.id} onChange={(event) => setPlanForm((prev) => ({ ...prev, id: event.target.value }))} />
                      <Stack direction="row" sx={{ gap: 1.5 }}>
                        <TextField label="车牌" value={planForm.truckPlate} onChange={(event) => setPlanForm((prev) => ({ ...prev, truckPlate: event.target.value }))} />
                        <TextField label="司机" value={planForm.driverName} onChange={(event) => setPlanForm((prev) => ({ ...prev, driverName: event.target.value }))} />
                      </Stack>
                      <TextField label="Collection Note" value={planForm.collectionNote} onChange={(event) => setPlanForm((prev) => ({ ...prev, collectionNote: event.target.value }))} />
                      <Stack direction="row" sx={{ gap: 1.5 }}>
                        <TextField label="叉车司机" value={planForm.forkliftDriver} onChange={(event) => setPlanForm((prev) => ({ ...prev, forkliftDriver: event.target.value }))} />
                        <TextField label="核对员" value={planForm.checker} onChange={(event) => setPlanForm((prev) => ({ ...prev, checker: event.target.value }))} />
                      </Stack>
                      <TextField label="预定托盘" value={planForm.palletNos} onChange={(event) => setPlanForm((prev) => ({ ...prev, palletNos: event.target.value }))} />
                      <TextField label="到场时间" type="datetime-local" value={planForm.arrivalTime} onChange={(event) => setPlanForm((prev) => ({ ...prev, arrivalTime: event.target.value }))} InputLabelProps={{ shrink: true }} />
                      <Button variant="contained" onClick={saveOfficeLoadingPlan}>
                        保存装车计划
                      </Button>
                    </Stack>
                  </MainCard>
                </Grid>

                <Grid size={{ xs: 12, xl: 7 }}>
                  <MainCard title="装车计划清单">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>计划编号</TableCell>
                          <TableCell>车牌</TableCell>
                          <TableCell>Collection Note</TableCell>
                          <TableCell>预定托盘</TableCell>
                          <TableCell>状态</TableCell>
                          <TableCell align="right">操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {flightLoadingPlans.map((item) => (
                          <TableRow key={item.id} hover>
                            <TableCell>{item.id}</TableCell>
                            <TableCell>{item.truckPlate}</TableCell>
                            <TableCell>{item.collectionNote}</TableCell>
                            <TableCell>{(item.pallets || []).join(' / ')}</TableCell>
                            <TableCell>{item.status}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    setPlanForm({
                                      id: item.id,
                                      flightNo,
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
                                  编辑
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    setLoadingPlans((prev) => [
                                      {
                                        ...item,
                                        id: `${item.id}-COPY`,
                                        createdAt: new Date().toISOString()
                                      },
                                      ...prev
                                    ])
                                  }
                                >
                                  复制
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  onClick={() =>
                                    setLoadingPlans((prev) => prev.map((entry) => (entry.id === item.id && entry.flightNo === flightNo ? { ...entry, status: '已撤回' } : entry)))
                                  }
                                >
                                  撤回
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() =>
                                    setLoadingPlans((prev) => prev.filter((entry) => !(entry.id === item.id && entry.flightNo === flightNo)))
                                  }
                                >
                                  删除
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </MainCard>
                </Grid>
              </Grid>
            ) : null}

            {activeTab === 'gates' ? <DocumentStatusCard title="当前文件门槛" items={inboundDocumentGates} /> : null}

            {activeTab === 'waybills' ? (
              <MainCard title="提单状态总览">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>AWB</TableCell>
                      <TableCell>收货方</TableCell>
                      <TableCell>件数</TableCell>
                      <TableCell>重量</TableCell>
                      <TableCell>当前节点</TableCell>
                      <TableCell>NOA</TableCell>
                      <TableCell>POD</TableCell>
                      <TableCell>转运状态</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {waybills.map((item) => (
                      <TableRow key={item.awb} hover>
                        <TableCell>{item.awb}</TableCell>
                        <TableCell>{item.consignee}</TableCell>
                        <TableCell>{item.pieces}</TableCell>
                        <TableCell>{item.weight}</TableCell>
                        <TableCell>{item.currentNode}</TableCell>
                        <TableCell>
                          <StatusChip label={item.noaStatus} />
                        </TableCell>
                        <TableCell>
                          <StatusChip label={item.podStatus} />
                        </TableCell>
                        <TableCell>{item.transferStatus}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                              component={RouterLink}
                              to={`/station/shipments/${encodeURIComponent(`in-${item.awb}`)}`}
                              size="small"
                              variant="outlined"
                            >
                              履约链路
                            </Button>
                            <Button component={RouterLink} to="/station/documents/noa" size="small" variant="outlined">
                              NOA
                            </Button>
                            <Button component={RouterLink} to="/station/tasks" size="small" variant="outlined">
                              任务
                            </Button>
                            <Button component={RouterLink} to="/station/exceptions" size="small" variant="outlined">
                              异常
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </MainCard>
            ) : null}
          </Box>
        </MainCard>
      </Grid>
    </Grid>
  );
}
