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
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { useGetPlatformStationCapabilities } from 'api/platform';
import { Link as RouterLink } from 'react-router-dom';
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

export default function PlatformStationsCapabilitiesPage() {
  const {
    platformStationCapabilityRows,
    stationCapabilityColumns,
    stationCapabilitiesLoading,
    stationCapabilitiesMeta
  } = useGetPlatformStationCapabilities();
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Capability Matrix"
          title={formatLocalizedMessage(intl, '货站能力矩阵')}
          description={formatLocalizedMessage(intl, '以正式 station governance 模板和站点主记录为读源，展示当前治理能力矩阵、准备度和风险项。')}
          chips={['Governance', 'Capabilities', 'Control Level', 'Readiness']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations" variant="outlined">
                {formatLocalizedMessage(intl, '返回站点总览')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/teams" variant="outlined">
                {formatLocalizedMessage(intl, '班组映射')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '站点能力矩阵')}>
          {!stationCapabilityColumns.length || !platformStationCapabilityRows.length ? (
            <Stack sx={{ gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                {stationCapabilitiesLoading
                  ? formatLocalizedMessage(intl, '正在读取正式能力矩阵...')
                  : formatLocalizedMessage(intl, '当前没有可展示的能力模板或站点主记录。')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatLocalizedMessage(intl, '数据源')}：{stationCapabilitiesMeta?.source || 'station_governance'}
              </Typography>
            </Stack>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{formatLocalizedMessage(intl, '站点')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '区域')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '控制层级')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '阶段')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '治理分')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '准备度')}</TableCell>
                  {stationCapabilityColumns.map((column) => (
                    <TableCell key={column.key} align="center">
                      {l(column.label)}
                    </TableCell>
                  ))}
                  <TableCell>{formatLocalizedMessage(intl, '当前风险')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {platformStationCapabilityRows.map((item) => (
                  <TableRow key={item.code} hover>
                    <TableCell>
                      <Button component={RouterLink} to={`/platform/stations/${item.code}`} size="small" variant="text">
                        {item.code}
                      </Button>
                    </TableCell>
                    <TableCell>{l(item.region)}</TableCell>
                    <TableCell><StatusChip label={localizeUiText(intl.locale, item.control)} /></TableCell>
                    <TableCell><StatusChip label={localizeUiText(intl.locale, item.phase)} /></TableCell>
                    <TableCell>{l(item.governanceScoreLabel || '-')}</TableCell>
                    <TableCell><StatusChip label={localizeUiText(intl.locale, item.readiness || '-')} /></TableCell>
                    {stationCapabilityColumns.map((column) => (
                      <TableCell key={`${item.code}-${column.key}`} align="center">
                        <Stack sx={{ alignItems: 'center', gap: 0.5 }}>
                          {renderCapabilitySymbol(item.capabilityMatrix?.[column.key] || 'no')}
                          <Typography variant="caption" color="text.secondary">
                            {l(column.note)}
                          </Typography>
                        </Stack>
                      </TableCell>
                    ))}
                    <TableCell>{l(item.risk)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '符号说明')}>
          <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              {renderCapabilitySymbol('yes')}
              <Typography variant="body2">{formatLocalizedMessage(intl, '有')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              {renderCapabilitySymbol('no')}
              <Typography variant="body2">{formatLocalizedMessage(intl, '无')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              {renderCapabilitySymbol('building')}
              <Typography variant="body2">{formatLocalizedMessage(intl, '建设中')}</Typography>
            </Stack>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
