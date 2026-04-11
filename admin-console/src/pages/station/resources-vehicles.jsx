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

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { OFFICE_TRIP_STORAGE_KEY, readOfficeTripPlans } from 'data/sinoport-adapters';
import { useLocalStorage } from 'hooks/useLocalStorage';
import { Link as RouterLink } from 'react-router-dom';

export default function StationResourcesVehiclesPage() {
  const { state: officePlans, setState: setOfficePlans } = useLocalStorage(OFFICE_TRIP_STORAGE_KEY, readOfficeTripPlans());
  const [form, setForm] = useState({
    tripId: 'TRIP-URC-003',
    flowKey: 'headhaul',
    route: 'URC -> 出港货站',
    plate: 'URC-TRK-309',
    driver: 'Office Driver',
    collectionNote: 'CN-OFFICE-001',
    stage: '待发车',
    status: '待处理',
    priority: 'P1',
    sla: '收货完成后 20 分钟',
    awbs: '436-10358585, 436-10359044',
    pallets: '',
    officePlan: '后台已完成 Trip 编排。',
    pdaExec: '现场执行发车、到站交接'
  });
  const stationVehicleRows = useMemo(
    () =>
      officePlans.map((item) => ({
        tripId: item.tripId,
        plate: item.plate,
        driver: item.driver,
        collectionNote: item.collectionNote,
        stage: item.stage,
        status: item.status
      })),
    [officePlans]
  );

  const saveOfficeTrip = () => {
    const nextTrip = {
      ...form,
      awbs: form.awbs.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
      pallets: form.pallets.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)
    };

    setOfficePlans((prev) => [nextTrip, ...prev.filter((item) => item.tripId !== nextTrip.tripId)]);
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Vehicles"
          title="车辆与 Collection Note"
          description="按 Trip / Truck / Driver / Collection Note 展示尾程与头程车辆占位视图。"
          chips={['Truck', 'Driver', 'Collection Note']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/resources" variant="outlined">
                返回资源总览
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                作业任务
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title="车辆占位视图">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Trip</TableCell>
                <TableCell>车牌</TableCell>
                <TableCell>司机</TableCell>
                <TableCell>Collection Note</TableCell>
                <TableCell>阶段</TableCell>
                <TableCell>状态</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationVehicleRows.map((item) => (
                <TableRow key={item.tripId} hover>
                  <TableCell>{item.tripId}</TableCell>
                  <TableCell>{item.plate}</TableCell>
                  <TableCell>{item.driver}</TableCell>
                  <TableCell>{item.collectionNote}</TableCell>
                  <TableCell>{item.stage}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const matched = officePlans.find((plan) => plan.tripId === item.tripId);
                        if (!matched) return;
                        setForm({
                          tripId: matched.tripId,
                          flowKey: matched.flowKey,
                          route: matched.route,
                          plate: matched.plate,
                          driver: matched.driver,
                          collectionNote: matched.collectionNote,
                          stage: matched.stage,
                          status: matched.status,
                          priority: matched.priority,
                          sla: matched.sla,
                          awbs: (matched.awbs || []).join(', '),
                          pallets: (matched.pallets || []).join(', '),
                          officePlan: matched.officePlan,
                          pdaExec: matched.pdaExec
                        });
                      }}
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

      <Grid size={12}>
        <MainCard title="办公室排车 / 装车计划">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>计划编号</TableCell>
                <TableCell>阶段</TableCell>
                <TableCell>后台先完成</TableCell>
                <TableCell>PDA 现场执行</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {officePlans.map((item) => (
                <TableRow key={item.tripId} hover>
                  <TableCell>{item.tripId}</TableCell>
                  <TableCell>{item.flowKey === 'headhaul' ? '头程' : '尾程'}</TableCell>
                  <TableCell>{item.officePlan}</TableCell>
                  <TableCell>{item.pdaExec}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="后台 Trip 计划录入">
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField label="Trip ID" value={form.tripId} onChange={(event) => setForm((prev) => ({ ...prev, tripId: event.target.value }))} />
              <TextField
                select
                label="流程"
                value={form.flowKey}
                onChange={(event) => setForm((prev) => ({ ...prev, flowKey: event.target.value }))}
              >
                <MenuItem value="headhaul">头程</MenuItem>
                <MenuItem value="tailhaul">尾程</MenuItem>
              </TextField>
            </Stack>
            <TextField label="路线" value={form.route} onChange={(event) => setForm((prev) => ({ ...prev, route: event.target.value }))} />
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField label="车牌" value={form.plate} onChange={(event) => setForm((prev) => ({ ...prev, plate: event.target.value }))} />
              <TextField label="司机" value={form.driver} onChange={(event) => setForm((prev) => ({ ...prev, driver: event.target.value }))} />
            </Stack>
            <TextField
              label="Collection Note"
              value={form.collectionNote}
              onChange={(event) => setForm((prev) => ({ ...prev, collectionNote: event.target.value }))}
            />
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField label="阶段" value={form.stage} onChange={(event) => setForm((prev) => ({ ...prev, stage: event.target.value }))} />
              <TextField label="状态" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} />
            </Stack>
            <TextField label="计划 AWB" value={form.awbs} onChange={(event) => setForm((prev) => ({ ...prev, awbs: event.target.value }))} />
            <TextField label="计划托盘" value={form.pallets} onChange={(event) => setForm((prev) => ({ ...prev, pallets: event.target.value }))} />
            <TextField label="后台先完成" value={form.officePlan} onChange={(event) => setForm((prev) => ({ ...prev, officePlan: event.target.value }))} />
            <TextField label="PDA 现场执行" value={form.pdaExec} onChange={(event) => setForm((prev) => ({ ...prev, pdaExec: event.target.value }))} />
            <Button variant="contained" onClick={saveOfficeTrip}>
              保存 Trip 计划
            </Button>
            <Typography variant="caption" color="text.secondary">
              保存后会同步到 PDA 的头程 / 尾程任务列表和详情页。
            </Typography>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
