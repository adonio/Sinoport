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

import MainCard from 'components/MainCard';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { ffmForecastRows, outboundFlights, outboundWaybillRows } from 'data/sinoport';
import { outboundDocumentGates } from 'data/sinoport-adapters';
import { useLocalStorage } from 'hooks/useLocalStorage';
import { getMobileStationKey, readMobileSession } from 'utils/mobile/session';

function buildSummary(waybills, containers) {
  return {
    total: waybills.length,
    loaded: waybills.filter((item) => item.loading === '已装载').length,
    manifestPending: waybills.filter((item) => item.manifest !== '运行中').length,
    uldCount: containers.length
  };
}

export default function StationOutboundFlightDetailPage() {
  const { flightNo } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const stationKey = getMobileStationKey(readMobileSession() || { stationCode: 'MME' });
  const { state: pmcBoards, setState: setPmcBoards } = useLocalStorage(`sinoport-mobile-outbound-containers-${stationKey}`, []);
  const [uldForm, setUldForm] = useState({
    flightNo: flightNo || 'SE913',
    boardCode: 'ULD91011',
    awbs: '436-10357583, 436-10357896',
    aircraftPosition: '17R'
  });

  const flight = outboundFlights.find((item) => item.flightNo === flightNo);
  const waybills = outboundWaybillRows.filter((item) => item.flightNo === flightNo);
  const containers = useMemo(() => pmcBoards.filter((item) => item.flightNo === flightNo), [pmcBoards, flightNo]);

  if (!flight) {
    return (
      <Grid container rowSpacing={3} columnSpacing={3}>
        <Grid size={12}>
          <PageHeader
            eyebrow="Outbound / Flights / Detail"
            title="未找到航班"
            description={`未找到航班 ${flightNo || ''}，请返回出港航班列表重新选择。`}
            action={
              <Button component={RouterLink} to="/station/outbound/flights" variant="contained">
                返回航班列表
              </Button>
            }
          />
        </Grid>
      </Grid>
    );
  }

  const summary = buildSummary(waybills, containers);

  const saveOfficeUldPlan = () => {
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
      ...prev.filter((item) => !(item.boardCode === uldForm.boardCode.trim().toUpperCase() && item.flightNo === uldForm.flightNo))
    ]);
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="出港 / 航班 / 详情"
          title={`航班详情 / ${flight.flightNo}`}
          description={`围绕航班 ${flight.flightNo} 管理预报、收货、ULD、机位、装机与 Manifest 归档。`}
          chips={[`ETD ${flight.etd}`, `当前阶段 ${flight.stage}`, `Manifest ${flight.manifest}`]}
          action={
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button component={RouterLink} to="/station/outbound/waybills" variant="outlined">
                提单管理
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证中心
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                任务中心
              </Button>
              <Button component={RouterLink} to="/station/outbound/flights" variant="outlined">
                返回航班列表
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="航班状态" value={flight.status} helper={flight.stage} chip="航班" color="primary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="提单总数" value={`${summary.total} 票`} helper={flight.cargo} chip="AWB" color="secondary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="已装载提单" value={`${summary.loaded} 票`} helper="来自收货/装机状态" chip="Loaded" color="success" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="ULD 数量" value={`${summary.uldCount}`} helper={`待补 Manifest ${summary.manifestPending} 票`} chip="ULD" color="warning" />
      </Grid>

      <Grid size={12}>
        <MainCard title="详情视图" contentSX={{ p: 0 }}>
          <Tabs value={activeTab} onChange={(_, nextTab) => setActiveTab(nextTab)} variant="scrollable" scrollButtons="auto" sx={{ px: 2.5, pt: 1 }}>
            <Tab label="概览" value="overview" />
            <Tab label={`提单状态 ${summary.total}`} value="waybills" />
            <Tab label={`办公室编排 ${containers.length}`} value="office" />
            <Tab label={`文件门槛 ${outboundDocumentGates.length}`} value="gates" />
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
                        <Typography color="text.secondary">ETD</Typography>
                        <Typography fontWeight={600}>{flight.etd}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">当前阶段</Typography>
                        <Typography fontWeight={600}>{flight.stage}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">Manifest</Typography>
                        <Typography fontWeight={600}>{flight.manifest}</Typography>
                      </Stack>
                    </Stack>
                  </MainCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                  <MainCard title="办公室提示">
                    <Stack sx={{ gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2">后台先完成</Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                          先确认 FFM / UWS / Manifest，再预排 ULD、机位和机坪执行顺序。
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2">PDA 再执行</Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                          现场人员只执行收货、ULD 绑定、装机和 Loaded 回填。
                        </Typography>
                      </Box>
                    </Stack>
                  </MainCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                  <MainCard title="当前 ULD 概览">
                    <Stack sx={{ gap: 1.25 }}>
                      {containers.length ? (
                        containers.slice(0, 4).map((item) => (
                          <Box key={item.boardCode} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.25 }}>
                            <Typography variant="subtitle2">{item.boardCode}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.aircraftPosition || '待编排'} · {(item.entries || []).length} 票
                            </Typography>
                          </Box>
                        ))
                      ) : (
                        <Typography color="text.secondary">当前航班还没有预排 ULD。</Typography>
                      )}
                    </Stack>
                  </MainCard>
                </Grid>
              </Grid>
            ) : null}

            {activeTab === 'waybills' ? (
              <MainCard title="提单状态总览">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>AWB</TableCell>
                      <TableCell>目的站</TableCell>
                      <TableCell>预报</TableCell>
                      <TableCell>收货</TableCell>
                      <TableCell>主单</TableCell>
                      <TableCell>装载</TableCell>
                      <TableCell>Manifest</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {waybills.map((item) => (
                      <TableRow key={item.awb} hover>
                        <TableCell>{item.awb}</TableCell>
                        <TableCell>{item.destination}</TableCell>
                        <TableCell><StatusChip label={item.forecast} /></TableCell>
                        <TableCell><StatusChip label={item.receipt} /></TableCell>
                        <TableCell><StatusChip label={item.master} /></TableCell>
                        <TableCell><StatusChip label={item.loading} /></TableCell>
                        <TableCell><StatusChip label={item.manifest} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </MainCard>
            ) : null}

            {activeTab === 'office' ? (
              <Grid container rowSpacing={3} columnSpacing={3}>
                <Grid size={{ xs: 12, xl: 5 }}>
                  <MainCard title="后台 ULD / 机位预排">
                    <Stack sx={{ gap: 1.5 }}>
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
                      <Button variant="contained" onClick={saveOfficeUldPlan}>
                        保存 ULD 预排
                      </Button>
                    </Stack>
                  </MainCard>
                </Grid>

                <Grid size={{ xs: 12, xl: 7 }}>
                  <MainCard title="办公室预排 ULD 清单">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>ULD</TableCell>
                          <TableCell>计划 AWB</TableCell>
                          <TableCell>机位</TableCell>
                          <TableCell>状态</TableCell>
                          <TableCell align="right">操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {containers.map((item) => (
                          <TableRow key={`${item.flightNo}-${item.boardCode}`} hover>
                            <TableCell>{item.boardCode}</TableCell>
                            <TableCell>{(item.entries || []).map((entry) => entry.awb).join(' / ')}</TableCell>
                            <TableCell>{item.aircraftPosition || '待编排'}</TableCell>
                            <TableCell>{item.status}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    setUldForm({
                                      flightNo,
                                      boardCode: item.boardCode,
                                      awbs: (item.entries || []).map((entry) => entry.awb).join(', '),
                                      aircraftPosition: item.aircraftPosition || ''
                                    })
                                  }
                                >
                                  编辑
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    setPmcBoards((prev) => [
                                      {
                                        ...item,
                                        boardCode: `${item.boardCode}-COPY`,
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
                                    setPmcBoards((prev) =>
                                      prev.map((entry) =>
                                        entry.boardCode === item.boardCode && entry.flightNo === item.flightNo ? { ...entry, status: '已撤回' } : entry
                                      )
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
                                    setPmcBoards((prev) =>
                                      prev.filter((entry) => !(entry.boardCode === item.boardCode && entry.flightNo === item.flightNo))
                                    )
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

            {activeTab === 'gates' ? <DocumentStatusCard title="出港文件放行" items={outboundDocumentGates} /> : null}
          </Box>
        </MainCard>
      </Grid>
    </Grid>
  );
}
