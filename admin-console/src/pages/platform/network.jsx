import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { divIcon } from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { useGetPlatformNetwork } from 'api/platform';
import { useIntl } from 'react-intl';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

const stationGeoMap = {
  URC: { lat: 43.8256, lng: 87.6168 },
  KGF: { lat: 49.806, lng: 73.085 },
  NVI: { lat: 40.1175, lng: 65.1708 },
  MME: { lat: 50.8514, lng: 5.69097 },
  MST: { lat: 50.9117, lng: 5.7701 },
  RZE: { lat: 50.0412, lng: 21.9991 },
  BoH: { lat: 50.7192, lng: -1.8808 },
  LGG: { lat: 50.6374, lng: 5.4432 },
  CTU: { lat: 30.5728, lng: 104.0668 }
};

const virtualStations = [
  { code: 'LGG', name: '欧洲转运补段', control: '外部协同', phase: '外部节点', scope: '卡转补段 / 协同回传' },
  { code: 'CTU', name: '回程目的节点', control: '外部协同', phase: '外部节点', scope: 'Manifest 回传 / 目的港对账' }
];

const networkEdges = [
  { from: 'URC', to: 'MST', label: 'URC → MST / 72h', tone: 'secondary.main' },
  { from: 'URC', to: 'MME', label: 'URC → MME / 48-60h', tone: 'primary.main' },
  { from: 'BoH', to: 'CTU', label: 'BoH → CTU / Manifest', tone: 'warning.main', dashed: true },
  { from: 'URC', to: 'MME', label: 'URC → MME / 卡转', tone: 'success.main', dashed: true },
  { from: 'MME', to: 'LGG', label: 'MME → LGG / 补段', tone: 'success.main' }
];

function toneColor(tone) {
  if (tone === 'primary.main') return '#1677ff';
  if (tone === 'success.main') return '#52c41a';
  if (tone === 'warning.main') return '#faad14';
  return '#8c8c8c';
}

function stationColor(station) {
  if (station.phase === '外部节点') return '#8c8c8c';
  if (station.control === '强控制') return '#1677ff';
  if (station.control === '协同控制') return '#52c41a';
  return '#faad14';
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function buildGreatCircleArc(from, to, steps = 28) {
  const lat1 = toRadians(from.lat);
  const lng1 = toRadians(from.lng);
  const lat2 = toRadians(to.lat);
  const lng2 = toRadians(to.lng);

  const p1 = [Math.cos(lat1) * Math.cos(lng1), Math.cos(lat1) * Math.sin(lng1), Math.sin(lat1)];
  const p2 = [Math.cos(lat2) * Math.cos(lng2), Math.cos(lat2) * Math.sin(lng2), Math.sin(lat2)];

  const dot = Math.min(1, Math.max(-1, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]));
  const omega = Math.acos(dot);

  if (omega === 0) {
    return [
      [from.lat, from.lng],
      [to.lat, to.lng]
    ];
  }

  const sinOmega = Math.sin(omega);
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const scale1 = Math.sin((1 - t) * omega) / sinOmega;
    const scale2 = Math.sin(t * omega) / sinOmega;

    const x = scale1 * p1[0] + scale2 * p2[0];
    const y = scale1 * p1[1] + scale2 * p2[1];
    const z = scale1 * p1[2] + scale2 * p2[2];

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lng = Math.atan2(y, x);
    points.push([toDegrees(lat), toDegrees(lng)]);
  }

  return points;
}

function pointAt(points, ratio) {
  const index = Math.min(points.length - 1, Math.max(0, Math.round((points.length - 1) * ratio)));
  return points[index];
}

function angleAt(points, ratio) {
  const index = Math.min(points.length - 2, Math.max(0, Math.round((points.length - 2) * ratio)));
  const [lat1, lng1] = points[index];
  const [lat2, lng2] = points[index + 1];
  return (Math.atan2(lat2 - lat1, lng2 - lng1) * 180) / Math.PI;
}

function buildFlowIcon(symbol, className, angle, color, delay = 0) {
  return divIcon({
    className: '',
    html: `<div class="${className}" style="transform: translate(-50%, -50%) rotate(${angle}deg); color: ${color}; animation-delay: ${delay}s;">${symbol}</div>`
  });
}

function FitNetworkBounds({ stations }) {
  const map = useMap();

  useEffect(() => {
    if (!stations.length) return;
    const bounds = stations.map((station) => [station.coordinates.lat, station.coordinates.lng]);
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, stations]);

  return null;
}

function RouteArcLayer({ edge }) {
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);
  const from = stationGeoMap[edge.from];
  const to = stationGeoMap[edge.to];

  if (!from || !to) return null;

  const arc = buildGreatCircleArc(from, to);
  const planePoint = pointAt(arc, 0.5);
  const planeAngle = angleAt(arc, 0.5);
  const color = toneColor(edge.tone);
  const arrowPoints = [0.22, 0.4, 0.58, 0.76].map((ratio, index) => ({
    id: `${edge.label}-arrow-${index}`,
    point: pointAt(arc, ratio),
    angle: angleAt(arc, ratio),
    delay: index * 0.18
  }));

  return (
    <>
      <Polyline
        positions={arc}
        pathOptions={{
          color,
          weight: 4,
          opacity: 0.7,
          className: `network-flow-line${edge.dashed ? ' network-flow-line--dashed' : ''}`
        }}
      >
        <Tooltip sticky>{l(edge.label)}</Tooltip>
      </Polyline>

      {arrowPoints.map((arrow) => (
        <Marker
          key={arrow.id}
          position={arrow.point}
          icon={buildFlowIcon('➤', 'network-arrow-marker', arrow.angle, color, arrow.delay)}
          interactive={false}
        />
      ))}

      <Marker position={planePoint} icon={buildFlowIcon('✈', 'network-plane-marker', planeAngle, color)} interactive={false}>
        <Tooltip direction="top" offset={[0, -6]}>
          {l(edge.label)}
        </Tooltip>
      </Marker>
    </>
  );
}

export default function PlatformNetworkPage() {
  const { stationCatalog, routeMatrix, networkScenarioRows } = useGetPlatformNetwork();
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);
  const allStations = [...stationCatalog, ...virtualStations]
    .map((station) => ({ ...station, coordinates: stationGeoMap[station.code] }))
    .filter((station) => station.coordinates);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Route Governance"
          title={formatLocalizedMessage(intl, '航线网络与链路配置')}
          description={formatLocalizedMessage(
            intl,
            '平台侧按链路维护货站协作关系、承诺时效、关键事件覆盖和节点边界。当前页已接入真实免费地图底图，用站点坐标和虚拟航线直接展示当前网络连接。'
          )}
          chips={['OpenStreetMap', 'Lane Matrix', 'Station Collaboration', 'Virtual Routes']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/network/lanes" variant="outlined">
                {formatLocalizedMessage(intl, '链路模板')}
              </Button>
              <Button component={RouterLink} to="/platform/network/scenarios" variant="outlined">
                {formatLocalizedMessage(intl, '场景模板')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '站点连接地图')}>
          <Box
            component="style"
            sx={{ display: 'none' }}
          >{`
            .network-flow-line {
              stroke-dasharray: 12 12;
              animation: network-flow-dash 1.4s linear infinite;
            }
            .network-flow-line--dashed {
              stroke-dasharray: 8 16;
            }
            .network-plane-marker {
              font-size: 18px;
              line-height: 1;
              text-shadow: 0 1px 6px rgba(255,255,255,0.95);
              animation: network-plane-float 1.8s ease-in-out infinite;
              transform-origin: center;
            }
            .network-arrow-marker {
              font-size: 8px;
              line-height: 1;
              text-shadow: 0 0 2px rgba(255,255,255,0.95);
              transform-origin: center;
              animation: network-arrow-pulse 1.1s ease-in-out infinite;
            }
            @keyframes network-flow-dash {
              from { stroke-dashoffset: 24; }
              to { stroke-dashoffset: 0; }
            }
            @keyframes network-plane-float {
              0%, 100% { margin-top: 0px; }
              50% { margin-top: -6px; }
            }
            @keyframes network-arrow-pulse {
              0% { opacity: 0.15; transform: translate(-50%, -50%) scale(0.82); }
              35% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
              100% { opacity: 0.15; transform: translate(-50%, -50%) scale(0.82); }
            }
          `}</Box>
          <Box sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            <MapContainer scrollWheelZoom={false} style={{ height: 460, width: '100%' }}>
              <FitNetworkBounds stations={allStations} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {networkEdges.map((edge) => (
                <RouteArcLayer key={`${edge.from}-${edge.to}-${edge.label}`} edge={edge} />
              ))}

              {allStations.map((station) => (
                <CircleMarker
                  key={station.code}
                  center={[station.coordinates.lat, station.coordinates.lng]}
                  radius={10}
                  pathOptions={{
                    color: stationColor(station),
                    fillColor: stationColor(station),
                    fillOpacity: 0.85,
                    weight: 2
                  }}
                >
                  <Tooltip direction="top" offset={[0, -4]}>
                    <Stack sx={{ gap: 0.35 }}>
                      <Typography variant="subtitle2">{station.code}</Typography>
                      <Typography variant="caption">{l(station.name)}</Typography>
                      <Typography variant="caption">{l(station.scope)}</Typography>
                    </Stack>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </Box>

          <Stack direction="row" sx={{ gap: 2.5, flexWrap: 'wrap', mt: 2.5 }}>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#1677ff' }} />
              <Typography variant="caption">{formatLocalizedMessage(intl, '强控制站点')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#52c41a' }} />
              <Typography variant="caption">{formatLocalizedMessage(intl, '协同控制站点')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#8c8c8c' }} />
              <Typography variant="caption">{formatLocalizedMessage(intl, '外部协同节点')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <Box sx={{ width: 18, height: 0, borderTop: '4px dashed #52c41a' }} />
              <Typography variant="caption">{formatLocalizedMessage(intl, '虚拟补段 / 卡转连接')}</Typography>
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <MainCard title={formatLocalizedMessage(intl, '主链路矩阵')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '链路')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '业务模式')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '站点协作')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '承诺口径')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '关键事件')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {routeMatrix.map((item) => (
                <TableRow key={item.lane} hover>
                  <TableCell>{item.lane}</TableCell>
                  <TableCell>{l(item.pattern)}</TableCell>
                  <TableCell>{l(item.stations)}</TableCell>
                  <TableCell>{l(item.promise)}</TableCell>
                  <TableCell>{l(item.events)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <Stack sx={{ gap: 3 }}>
          <MainCard title={formatLocalizedMessage(intl, '网络准备度')}>
            <Stack sx={{ gap: 2.5 }}>
              {stationCatalog.map((station, index) => (
                <Stack key={station.code} sx={{ gap: 0.75 }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2">{station.code}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {80 + ((index * 3) % 18)}%
                    </Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={80 + ((index * 3) % 18)} />
                  <Typography variant="caption" color="text.secondary">
                    {l(station.scope)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </MainCard>

          <MainCard title={formatLocalizedMessage(intl, '场景覆盖摘要')} subheader={formatLocalizedMessage(intl, '场景摘要主读源已切到正式 network_scenarios。')}>
            <Stack sx={{ gap: 1.5 }}>
              {networkScenarioRows.slice(0, 3).map((scenario) => (
                <Stack key={scenario.id || scenario.scenario_id} sx={{ gap: 0.35 }}>
                  <Typography variant="subtitle2">{l(scenario.title)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {l(scenario.lane)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {l(scenario.entryRule)}
                  </Typography>
                </Stack>
              ))}
              {!networkScenarioRows.length ? (
                <Typography variant="body2" color="text.secondary">
                  {formatLocalizedMessage(intl, '当前暂无场景模板。')}
                </Typography>
              ) : null}
            </Stack>
          </MainCard>
        </Stack>
      </Grid>
    </Grid>
  );
}
