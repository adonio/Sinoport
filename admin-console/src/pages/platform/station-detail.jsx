import Alert from '@mui/material/Alert';
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
import { useGetPlatformStationDetail } from 'api/platform';
import { useIntl } from 'react-intl';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

function renderCapabilitySymbol(status) {
  if (status === 'yes') {
    return <CheckOutlined style={{ color: '#1677ff', fontSize: 18 }} />;
  }
  if (status === 'building') {
    return <ClockCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />;
  }
  return <CloseOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />;
}

function buildScheduleRows(teamRows) {
  return teamRows.map((item, index) => ({
    team: item.team || item.team_name || item.name || item.code,
    shift: item.shift || '--',
    workers: item.workers ?? item.headcount ?? 0,
    slot: item.shift === '夜班' ? '20:00 - 08:00' : item.shift === '白班' ? '08:00 - 20:00' : '--',
    lead: index % 2 === 0 ? 'Supervisor A' : 'Supervisor B',
    status: item.status,
    mappedLanes: item.mappedLanes || item.mapped_lanes || '-'
  }));
}

export default function PlatformStationDetailPage() {
  const { stationCode } = useParams();
  const { station, capability, teamRows, zoneRows, deviceRows, stationCapabilityColumns } = useGetPlatformStationDetail(stationCode);
  const effectiveStation = station || { code: stationCode || '--', name: 'Station Not Found', region: '-', control: '-', phase: '-', scope: '-' };
  const effectiveCapability = capability || { promise: '-', risk: '-', capabilityMatrix: {} };
  const effectiveTeams = teamRows || [];
  const effectiveZones = zoneRows || [];
  const effectiveDevices = deviceRows || [];
  const scheduleRows = buildScheduleRows(effectiveTeams);
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);

  const metrics = [
    { title: formatLocalizedMessage(intl, '控制层级'), value: l(effectiveStation.control), helper: l(effectiveStation.name), chip: 'Control', color: 'primary' },
    { title: formatLocalizedMessage(intl, '当前阶段'), value: l(effectiveStation.phase), helper: l(effectiveStation.region), chip: 'Phase', color: 'secondary' },
    { title: formatLocalizedMessage(intl, '服务口径'), value: l(effectiveCapability.promise), helper: l(effectiveStation.scope), chip: 'SLA', color: 'success' },
    { title: formatLocalizedMessage(intl, '班组数量'), value: `${effectiveTeams.length}`, helper: formatLocalizedMessage(intl, '当前站点已配置班组'), chip: 'Teams', color: 'warning' }
  ];

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Detail"
          title={`${formatLocalizedMessage(intl, '站点详情')} / ${effectiveStation.code}`}
          description={formatLocalizedMessage(
            intl,
            '平台侧查看单个站点的能力状态、区位映射、设备映射和班组排班情况，作为站点接入和样板站管理的统一详情页。'
          )}
          chips={[l(effectiveStation.name), l(effectiveStation.region), l(effectiveStation.control), l(effectiveStation.phase)]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations/capabilities" variant="outlined">
                {formatLocalizedMessage(intl, '返回能力矩阵')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/zones" variant="outlined">
                {formatLocalizedMessage(intl, '区位映射')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/devices" variant="outlined">
                {formatLocalizedMessage(intl, '设备映射')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/teams" variant="outlined">
                {formatLocalizedMessage(intl, '班组映射')}
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
        <MainCard title={formatLocalizedMessage(intl, '站点能力情况')}>
          {!stationCapabilityColumns.length ? (
            <Alert severity="info">{formatLocalizedMessage(intl, '当前站点还没有正式治理能力模板。')}</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  {stationCapabilityColumns.map((column) => (
                    <TableCell key={column.key} align="center">
                      {l(column.label)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow hover>
                  {stationCapabilityColumns.map((column) => {
                    const status = effectiveCapability.capabilityMatrix?.[column.key] || 'no';

                    return (
                      <TableCell key={`${effectiveStation.code}-${column.key}`} align="center">
                        <Stack sx={{ alignItems: 'center', gap: 0.75 }}>
                          {renderCapabilitySymbol(status)}
                          <Typography variant="caption" color="text.secondary">
                            {status === 'yes' ? formatLocalizedMessage(intl, '有') : status === 'building' ? formatLocalizedMessage(intl, '建设中') : formatLocalizedMessage(intl, '无')}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ maxWidth: 140, lineHeight: 1.5, textAlign: 'center', display: 'block' }}
                          >
                            {l(column.note)}
                          </Typography>
                        </Stack>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={formatLocalizedMessage(intl, '区域映射管理')}>
          {!effectiveZones.length ? (
            <Alert severity="info">{formatLocalizedMessage(intl, '当前站点还没有正式区位记录。')}</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{localizeUiText(intl.locale, 'Zone')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '类型')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '链路绑定')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '状态')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {effectiveZones.map((item) => (
                  <TableRow key={`${item.station}-${item.zone}`} hover>
                    <TableCell>{l(item.zone)}</TableCell>
                    <TableCell>{l(item.type)}</TableCell>
                    <TableCell>{l(item.linkedLane)}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(intl.locale, item.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={formatLocalizedMessage(intl, '设备映射管理')}>
          {!effectiveDevices.length ? (
            <Alert severity="info">{formatLocalizedMessage(intl, '当前站点还没有正式设备记录。')}</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{formatLocalizedMessage(intl, '设备')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '绑定角色')}</TableCell>
                  <TableCell>{localizeUiText(intl.locale, 'Owner')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '状态')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {effectiveDevices.map((item) => (
                  <TableRow key={`${item.station}-${item.device}`} hover>
                    <TableCell>{l(item.device)}</TableCell>
                    <TableCell>{l(item.role)}</TableCell>
                    <TableCell>{l(item.owner)}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(intl.locale, item.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '班组排班情况')}>
          {!scheduleRows.length ? (
            <Alert severity="info">{formatLocalizedMessage(intl, '当前站点还没有正式班组与排班记录。')}</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{formatLocalizedMessage(intl, '班组')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '班次')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '排班时段')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '人数')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '班组长')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '链路')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '状态')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scheduleRows.map((item) => (
                  <TableRow key={`${effectiveStation.code}-${item.team}`} hover>
                    <TableCell>{l(item.team)}</TableCell>
                    <TableCell>{l(item.shift)}</TableCell>
                    <TableCell>{l(item.slot)}</TableCell>
                    <TableCell>{item.workers}</TableCell>
                    <TableCell>{item.lead}</TableCell>
                    <TableCell>{l(item.mappedLanes)}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(intl.locale, item.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </MainCard>
      </Grid>
    </Grid>
  );
}
