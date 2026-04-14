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
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { useGetStationOutboundOverview } from 'api/station';
import { useMobileState } from 'hooks/useMobileState';
import { getMobileStationKey, readMobileSession } from 'utils/mobile/session';

const officeOutboundPlans = [
  {
    flightNo: 'SE913',
    officePlan: '提前确认 FFM / UWS / Manifest，预排 ULD、飞机机位和机坪执行顺序',
    pdaExec: '收货、集装器执行、机坪装机'
  },
  {
    flightNo: 'URO913',
    officePlan: '确认 UWS 修订版、Loaded 节点证据要求和机位绑定',
    pdaExec: '现场继续装机、回填 Loaded 时间戳'
  }
];

export default function StationOutboundFlightsPage() {
  const { outboundFlights, ffmForecastRows, manifestSummary } = useGetStationOutboundOverview();
  const stationKey = getMobileStationKey(readMobileSession() || { stationCode: 'MME' });
  const { state: pmcBoards, setState: setPmcBoards } = useMobileState(`sinoport-mobile-outbound-containers-${stationKey}`, []);
  const [uldForm, setUldForm] = useState({
    flightNo: 'SE913',
    boardCode: 'ULD91009',
    awbs: '436-10357583, 436-10357896',
    aircraftPosition: '15L'
  });
  const rows = outboundFlights;

  const metrics = [
    { title: '待飞走航班', value: `${rows.length}`, helper: '当前在本站处理的出港航班', chip: 'Flights', color: 'primary' },
    { title: 'Manifest 版本', value: manifestSummary.version, helper: manifestSummary.exchange, chip: 'Manifest', color: 'secondary' },
    { title: '出港货物数量', value: manifestSummary.outboundCount, helper: '来自航班级装载汇总', chip: 'Cargo', color: 'success' }
  ];
  const flightContainers = useMemo(() => pmcBoards.filter((item) => item.flightNo === 'SE913'), [pmcBoards]);

  const createOfficeUldPlan = () => {
    const awbs = uldForm.awbs
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const matchedAwbs = ffmForecastRows.filter((item) => awbs.includes(item.awb));
    const entries = matchedAwbs.map((item) => ({
      awb: item.awb,
      pieces: item.pieces,
      boxes: Math.max(1, Math.round(item.pieces / 10)),
      weight: String(item.weight).replace(' kg', '')
    }));
    const totalBoxes = entries.reduce((sum, item) => sum + item.boxes, 0);
    const totalWeightKg = entries.reduce((sum, item) => sum + Number(item.weight || 0), 0);

    if (!uldForm.boardCode.trim()) return;

    setPmcBoards((prev) => [
      {
        boardCode: uldForm.boardCode.trim().toUpperCase(),
        flightNo: uldForm.flightNo,
        entries,
        totalBoxes,
        totalWeightKg: Number(totalWeightKg.toFixed(1)),
        reviewedWeightKg: Number((totalWeightKg * 1.003).toFixed(1)),
        aircraftPosition: uldForm.aircraftPosition.trim(),
        status: '待装机',
        createdAt: new Date().toISOString()
      },
      ...prev.filter((item) => item.boardCode !== uldForm.boardCode.trim().toUpperCase())
    ]);
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Outbound / Flights"
          title="出港管理 / 航班管理"
          description="按航班管理预报、收货、装载、飞走与 Manifest 归档，并为文件放行、任务分派和对象回连提供统一入口。"
          chips={['Forecast', 'Receipt', 'Loading', 'Manifest', 'Task Entry', 'Gate Control']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant="outlined" component={RouterLink} to="/station/outbound/waybills">
                提单管理
              </Button>
              <Button size="small" variant="outlined" component={RouterLink} to="/station/documents">
                单证中心
              </Button>
              <Button size="small" variant="outlined" component={RouterLink} to="/station/tasks">
                作业任务
              </Button>
            </Stack>
          }
        />
      </Grid>

      {metrics.map((item) => (
        <Grid key={item.title} size={{ xs: 12, md: 4 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={12}>
        <MainCard title="出港航班操作台">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ETD</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>当前阶段</TableCell>
                <TableCell>Manifest</TableCell>
                <TableCell>货量</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.etd}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell>{item.stage}</TableCell>
                  <TableCell>{item.manifest}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="outlined" component={RouterLink} to={`/station/outbound/flights/${item.flightNo}`}>
                        查看
                      </Button>
                      <Button size="small" variant="outlined" component={RouterLink} to="/station/documents">
                        单证
                      </Button>
                      <Button size="small" variant="outlined" component={RouterLink} to="/station/tasks">
                        任务
                      </Button>
                      <Button size="small" variant="outlined" component={RouterLink} to="/station/shipments">
                        链路
                      </Button>
                      <Button size="small" variant="contained">
                        飞走
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
        <MainCard title="办公室预排 ULD / 机位 / 文件">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>后台先完成</TableCell>
                <TableCell>PDA 现场执行</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {officeOutboundPlans.map((item) => (
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
        <MainCard title="后台 ULD / 机位预排">
          <Stack sx={{ gap: 1.5 }}>
            <TextField
              select
              label="航班"
              value={uldForm.flightNo}
              onChange={(event) => setUldForm((prev) => ({ ...prev, flightNo: event.target.value }))}
            >
              {outboundFlights.map((item) => (
                <MenuItem key={item.flightNo} value={item.flightNo}>
                  {item.flightNo}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="ULD / PMC"
              value={uldForm.boardCode}
              onChange={(event) => setUldForm((prev) => ({ ...prev, boardCode: event.target.value }))}
            />
            <TextField
              label="计划 AWB"
              value={uldForm.awbs}
              onChange={(event) => setUldForm((prev) => ({ ...prev, awbs: event.target.value }))}
            />
            <TextField
              label="飞机机位"
              value={uldForm.aircraftPosition}
              onChange={(event) => setUldForm((prev) => ({ ...prev, aircraftPosition: event.target.value }))}
            />
            <Button variant="contained" onClick={createOfficeUldPlan}>
              保存 ULD 预排
            </Button>
            <Typography variant="caption" color="text.secondary">
              保存后会同步到移动端“集装器 / 装机 / 出港机坪” demo 数据。
            </Typography>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title="办公室预排 ULD 清单">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ULD</TableCell>
                <TableCell>航班</TableCell>
                <TableCell>计划 AWB</TableCell>
                <TableCell>机位</TableCell>
                <TableCell>状态</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {flightContainers.map((item) => (
                <TableRow key={`${item.flightNo}-${item.boardCode}`} hover>
                  <TableCell>{item.boardCode}</TableCell>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{(item.entries || []).map((entry) => entry.awb).join(' / ')}</TableCell>
                  <TableCell>{item.aircraftPosition || '待编排'}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        setUldForm({
                          flightNo: item.flightNo,
                          boardCode: item.boardCode,
                          awbs: (item.entries || []).map((entry) => entry.awb).join(', '),
                          aircraftPosition: item.aircraftPosition || ''
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
    </Grid>
  );
}
