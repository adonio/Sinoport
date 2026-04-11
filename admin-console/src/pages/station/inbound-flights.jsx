import { useMemo, useState } from 'react';

import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import ProgressMetricCard from 'components/sinoport/ProgressMetricCard';
import StatusChip from 'components/sinoport/StatusChip';
import { inboundCargoLifecycle, inboundFlights } from 'data/sinoport';
import { useLocalStorage } from 'hooks/useLocalStorage';
import { getMobileStationKey, readMobileSession } from 'utils/mobile/session';

const officeInboundPlans = [
  {
    flightNo: 'SE803',
    officePlan: '提前编排理货顺序、托盘规则、装车计划、车牌/司机/Collection Note',
    pdaExec: '点数、打托盘、按计划装车'
  },
  {
    flightNo: 'SE681',
    officePlan: '确认二次转运优先级、NOA 节点顺序、历史托盘与库位',
    pdaExec: '理货、托盘执行、货物转入下一节点'
  }
];

export default function StationInboundFlightsPage() {
  const stationKey = getMobileStationKey(readMobileSession() || { stationCode: 'MME' });
  const { state: loadingPlans, setState: setLoadingPlans } = useLocalStorage(`sinoport-mobile-loading-plans-${stationKey}`, []);
  const { state: pallets, setState: setPallets } = useLocalStorage(`sinoport-mobile-inbound-pallets-${stationKey}`, []);
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
  const totalCount = inboundCargoLifecycle[0]?.count || 0;
  const displayLifecycle = inboundCargoLifecycle.filter((item) => item.label !== '已交付');
  const flightPallets = useMemo(() => pallets.filter((item) => item.flightNo === 'SE803'), [pallets]);
  const flightLoadingPlans = useMemo(() => loadingPlans.filter((item) => item.flightNo === 'SE803'), [loadingPlans]);

  const createOfficePallet = () => {
    const awbs = palletForm.awbs
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!palletForm.palletNo.trim() || !awbs.length) return;

    setPallets((prev) => [
      {
        palletNo: palletForm.palletNo.trim().toUpperCase(),
        flightNo: palletForm.flightNo,
        storageLocation: palletForm.storageLocation.trim() || 'MME-STAGE-99',
        entries: awbs.map((awb) => ({ awb, consignee: 'Office Planned', boxes: 0, weightKg: 0 })),
        printed: true,
        totalWeightKg: Number(palletForm.totalWeightKg || 0),
        totalBoxes: Number(palletForm.totalBoxes || 0),
        status: '待装车',
        printQueuedAt: new Date().toISOString()
      },
      ...prev.filter((item) => item.palletNo !== palletForm.palletNo.trim().toUpperCase())
    ]);
  };

  const createOfficeLoadingPlan = () => {
    const palletNos = planForm.palletNos
      .split(/[,\n]/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    const linkedPallets = pallets.filter((item) => palletNos.includes(item.palletNo));
    const totalBoxes = linkedPallets.reduce((sum, item) => sum + (item.totalBoxes || 0), 0);
    const totalWeight = linkedPallets.reduce((sum, item) => sum + (item.totalWeightKg || 0), 0);

    if (!planForm.truckPlate.trim() || !planForm.collectionNote.trim()) return;

    setLoadingPlans((prev) => [
      {
        id: planForm.id || `LOAD-OFFICE-${String(Date.now()).slice(-6)}`,
        flightNo: planForm.flightNo,
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
      ...prev.filter((item) => item.id !== (planForm.id || ''))
    ]);
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Inbound / Flights"
          title="进港管理 / 航班管理"
          description="按航班管理进港作业，逐航班推进落地、进港处理、理货、NOA、交付和二次转运，并为任务和文件联动提供入口。"
          chips={['Flight Level Ops', 'Per-Flight Actions', 'Inbound Workflow', 'Task Entry', 'Document Gate']}
          action={
            <Button component={RouterLink} to="/station/inbound/flights/new" variant="contained">
              新建航班
            </Button>
          }
        />
      </Grid>

      {displayLifecycle.map((item, index) => {
        const progress = Math.max(15, 100 - index * 12);

        return (
          <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
            <ProgressMetricCard
              title={item.label}
              value={`${item.count} / ${totalCount} 票`}
              helper={item.note}
              chip={`阶段 ${index + 1}`}
              color={lifecycleColors[index] || 'primary'}
              progress={progress}
            />
          </Grid>
        );
      })}

      <Grid size={12}>
        <MainCard title="进港航班操作台">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ETA</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>当前节点</TableCell>
                <TableCell>优先级</TableCell>
                <TableCell>货量</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.eta}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell>{item.step}</TableCell>
                  <TableCell>{item.priority}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button component={RouterLink} to={`/station/inbound/flights/${item.flightNo}`} size="small" variant="outlined">
                        查看
                      </Button>
                      <Button component={RouterLink} to="/station/tasks" size="small" variant="outlined">
                        任务
                      </Button>
                      <Button component={RouterLink} to="/station/documents" size="small" variant="outlined">
                        单证
                      </Button>
                      <Button component={RouterLink} to="/station/shipments" size="small" variant="contained">
                        链路
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="办公室预排进港执行">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>后台先完成</TableCell>
                <TableCell>PDA 现场执行</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {officeInboundPlans.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.officePlan}</TableCell>
                  <TableCell>{item.pdaExec}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <MainCard title="后台托盘预排">
          <Stack sx={{ gap: 1.5 }}>
            <TextField
              select
              label="航班"
              value={palletForm.flightNo}
              onChange={(event) => setPalletForm((prev) => ({ ...prev, flightNo: event.target.value }))}
            >
              {inboundFlights.map((item) => (
                <MenuItem key={item.flightNo} value={item.flightNo}>
                  {item.flightNo}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="托盘号"
              value={palletForm.palletNo}
              onChange={(event) => setPalletForm((prev) => ({ ...prev, palletNo: event.target.value }))}
            />
            <TextField
              label="计划 AWB"
              value={palletForm.awbs}
              onChange={(event) => setPalletForm((prev) => ({ ...prev, awbs: event.target.value }))}
            />
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField
                label="总箱数"
                value={palletForm.totalBoxes}
                onChange={(event) => setPalletForm((prev) => ({ ...prev, totalBoxes: event.target.value }))}
              />
              <TextField
                label="总重量"
                value={palletForm.totalWeightKg}
                onChange={(event) => setPalletForm((prev) => ({ ...prev, totalWeightKg: event.target.value }))}
              />
            </Stack>
            <TextField
              label="存放位置"
              value={palletForm.storageLocation}
              onChange={(event) => setPalletForm((prev) => ({ ...prev, storageLocation: event.target.value }))}
            />
            <Button variant="contained" onClick={createOfficePallet}>
              保存托盘预排
            </Button>
            <Typography variant="caption" color="text.secondary">
              保存后会同步到移动端“历史托盘 / 预计装载目标”。
            </Typography>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title="当前后台托盘">
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
                      编辑
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title="后台装车计划编排">
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField
                select
                label="航班"
                value={planForm.flightNo}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, flightNo: event.target.value }))}
              >
                {inboundFlights.map((item) => (
                  <MenuItem key={item.flightNo} value={item.flightNo}>
                    {item.flightNo}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="车牌"
                value={planForm.truckPlate}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, truckPlate: event.target.value }))}
              />
            </Stack>
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField
                label="司机"
                value={planForm.driverName}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, driverName: event.target.value }))}
              />
              <TextField
                label="Collection Note"
                value={planForm.collectionNote}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, collectionNote: event.target.value }))}
              />
            </Stack>
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField
                label="叉车司机"
                value={planForm.forkliftDriver}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, forkliftDriver: event.target.value }))}
              />
              <TextField
                label="核对员"
                value={planForm.checker}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, checker: event.target.value }))}
              />
            </Stack>
            <TextField
              label="预定托盘"
              value={planForm.palletNos}
              onChange={(event) => setPlanForm((prev) => ({ ...prev, palletNos: event.target.value }))}
            />
            <TextField
              label="到场时间"
              type="datetime-local"
              value={planForm.arrivalTime}
              onChange={(event) => setPlanForm((prev) => ({ ...prev, arrivalTime: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="contained" onClick={createOfficeLoadingPlan}>
              保存装车计划
            </Button>
            <Table size="small">
              <TableHead>
                <TableRow>
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
                      <TableCell>{item.truckPlate}</TableCell>
                      <TableCell>{item.collectionNote}</TableCell>
                      <TableCell>{(item.pallets || []).join(' / ')}</TableCell>
                      <TableCell>{item.status}</TableCell>
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
                          编辑
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
            <Typography variant="caption" color="text.secondary">
              保存后会同步到移动端“预定装车计划 / 当前装车计划”。
            </Typography>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
