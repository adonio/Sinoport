import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import CheckOutlined from '@ant-design/icons/CheckOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import { Link as RouterLink, useParams } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import {
  platformStationCapabilityRows,
  platformStationDeviceRows,
  platformStationTeamRows,
  platformStationZoneRows,
  stationCapabilityColumns
} from 'data/sinoport-adapters';
import { stationCatalog } from 'data/sinoport';

function renderCapabilitySymbol(status) {
  if (status === 'yes') {
    return <CheckOutlined style={{ color: '#1677ff', fontSize: 18 }} />;
  }
  if (status === 'building') {
    return <ClockCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />;
  }
  return <CloseOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />;
}

function buildFallbackTeams(stationCode) {
  return [
    { station: stationCode, team: `${stationCode} Ops Team`, workers: 6, shift: '白班', mappedLanes: `${stationCode} 基础运行`, status: '建设中' },
    { station: stationCode, team: `${stationCode} Support Team`, workers: 4, shift: '夜班', mappedLanes: `${stationCode} 支援与异常处理`, status: '待处理' }
  ];
}

function buildFallbackZones(stationCode) {
  return [
    { station: stationCode, zone: `${stationCode}-ZONE-01`, type: 'Inbound Buffer', linkedLane: `${stationCode} Inbound`, status: '建设中' },
    { station: stationCode, zone: `${stationCode}-ZONE-02`, type: 'Dispatch', linkedLane: `${stationCode} Delivery`, status: '待处理' }
  ];
}

function buildFallbackDevices(stationCode) {
  return [
    { station: stationCode, device: `PDA-${stationCode}-01`, role: 'Station Operator', owner: `${stationCode} Ops Team`, status: '建设中' },
    { station: stationCode, device: `PDA-${stationCode}-02`, role: 'Supervisor', owner: `${stationCode} Support Team`, status: '待处理' }
  ];
}

function buildScheduleRows(teamRows) {
  return teamRows.map((item, index) => ({
    team: item.team,
    shift: item.shift,
    workers: item.workers,
    slot: item.shift === '夜班' ? '20:00 - 08:00' : item.shift === '白班' ? '08:00 - 20:00' : '待排班',
    lead: index % 2 === 0 ? 'Supervisor A' : 'Supervisor B',
    status: item.status
  }));
}

export default function PlatformStationDetailPage() {
  const { stationCode } = useParams();
  const station = stationCatalog.find((item) => item.code === stationCode) || stationCatalog[0];
  const capability = platformStationCapabilityRows.find((item) => item.code === station.code) || platformStationCapabilityRows[0];
  const teamRows = platformStationTeamRows.filter((item) => item.station === station.code);
  const zoneRows = platformStationZoneRows.filter((item) => item.station === station.code);
  const deviceRows = platformStationDeviceRows.filter((item) => item.station === station.code);
  const effectiveTeams = teamRows.length ? teamRows : buildFallbackTeams(station.code);
  const effectiveZones = zoneRows.length ? zoneRows : buildFallbackZones(station.code);
  const effectiveDevices = deviceRows.length ? deviceRows : buildFallbackDevices(station.code);
  const scheduleRows = buildScheduleRows(effectiveTeams);

  const metrics = [
    { title: '控制层级', value: station.control, helper: station.name, chip: 'Control', color: 'primary' },
    { title: '当前阶段', value: station.phase, helper: station.region, chip: 'Phase', color: 'secondary' },
    { title: '服务口径', value: capability.promise, helper: station.scope, chip: 'SLA', color: 'success' },
    { title: '班组数量', value: `${effectiveTeams.length}`, helper: '当前站点已配置班组', chip: 'Teams', color: 'warning' }
  ];

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Detail"
          title={`站点详情 / ${station.code}`}
          description="平台侧查看单个站点的能力状态、区位映射、设备映射和班组排班情况，作为站点接入和样板站管理的统一详情页。"
          chips={[station.name, station.region, station.control, station.phase]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations/capabilities" variant="outlined">
                返回能力矩阵
              </Button>
              <Button component={RouterLink} to="/platform/stations/zones" variant="outlined">
                区位映射
              </Button>
              <Button component={RouterLink} to="/platform/stations/devices" variant="outlined">
                设备映射
              </Button>
              <Button component={RouterLink} to="/platform/stations/teams" variant="outlined">
                班组映射
              </Button>
            </Stack>
          }
        />
      </Grid>

      {metrics.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={12}>
        <MainCard title="站点能力情况">
          <Table size="small">
            <TableHead>
              <TableRow>
                {stationCapabilityColumns.map((column) => (
                  <TableCell key={column.key} align="center">
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow hover>
                {stationCapabilityColumns.map((column) => (
                  <TableCell key={`${station.code}-${column.key}`} align="center">
                    <Stack sx={{ alignItems: 'center', gap: 0.75 }}>
                      {renderCapabilitySymbol(capability.capabilityMatrix[column.key])}
                      <Typography variant="caption" color="text.secondary">
                        {capability.capabilityMatrix[column.key] === 'yes'
                          ? '有'
                          : capability.capabilityMatrix[column.key] === 'building'
                            ? '建设中'
                            : '无'}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ maxWidth: 140, lineHeight: 1.5, textAlign: 'center', display: 'block' }}
                      >
                        {column.note}
                      </Typography>
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="区域映射管理">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Zone</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>链路绑定</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {effectiveZones.map((item) => (
                <TableRow key={`${item.station}-${item.zone}`} hover>
                  <TableCell>{item.zone}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.linkedLane}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="设备映射管理">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>设备</TableCell>
                <TableCell>绑定角色</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {effectiveDevices.map((item) => (
                <TableRow key={`${item.station}-${item.device}`} hover>
                  <TableCell>{item.device}</TableCell>
                  <TableCell>{item.role}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="班组排班情况">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>班组</TableCell>
                <TableCell>班次</TableCell>
                <TableCell>排班时段</TableCell>
                <TableCell>人数</TableCell>
                <TableCell>班组长</TableCell>
                <TableCell>链路</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scheduleRows.map((item) => (
                <TableRow key={`${station.code}-${item.team}`} hover>
                  <TableCell>{item.team}</TableCell>
                  <TableCell>{item.shift}</TableCell>
                  <TableCell>{item.slot}</TableCell>
                  <TableCell>{item.workers}</TableCell>
                  <TableCell>{item.lead}</TableCell>
                  <TableCell>{effectiveTeams.find((team) => team.team === item.team)?.mappedLanes || '-'}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
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
