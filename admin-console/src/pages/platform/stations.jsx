import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import {
  archivePlatformStation,
  createPlatformStation,
  updatePlatformStation,
  useGetPlatformStations,
  useGetPlatformStationOptions
} from 'api/platform';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  station_id: '',
  station_name: '',
  airport_code: '',
  icao_code: '',
  region: '',
  control_level: '',
  phase: '',
  service_scope: '',
  owner_name: ''
};

function buildFormState(station) {
  if (!station) {
    return EMPTY_FORM;
  }

  return {
    station_id: station.code || '',
    station_name: station.name || '',
    airport_code: station.airport_code || station.airportCode || '',
    icao_code: station.icao_code || station.icaoCode || '',
    region: station.region === '-' ? '' : station.region || '',
    control_level: station.control_level || '',
    phase: station.phase_key || '',
    service_scope: station.service_scope || '',
    owner_name: station.owner_name || ''
  };
}

export default function PlatformStationsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { controlLevels, phases, owners, stationOptionsLoading } = useGetPlatformStationOptions();
  const {
    stationCatalog,
    stationCatalogPage,
    stationsLoading,
    stationsError
  } = useGetPlatformStations({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    include_archived: includeArchived
  });

  useEffect(() => {
    if (selectedStation) {
      const matched = stationCatalog.find((item) => item.code === selectedStation.code);
      if (matched) {
        setSelectedStation(matched);
        setFormState(buildFormState(matched));
      }
    }
  }, [stationCatalog, selectedStation]);

  const tableRows = stationCatalogPage?.items || stationCatalog;
  const total = stationCatalogPage?.total || tableRows.length;
  const currentPage = Math.max(0, (stationCatalogPage?.page || 1) - 1);

  const isEditMode = Boolean(selectedStation);
  const submitLabel = isEditMode ? m('保存站点') : m('创建站点租户');

  const canSubmit = useMemo(() => {
    return Boolean(
      formState.station_id &&
        formState.station_name &&
        formState.region &&
        formState.control_level &&
        formState.phase
    );
  }, [formState]);

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;
    setFormState((current) => ({
      ...current,
      [field]: field === 'station_id' ? String(nextValue).toUpperCase() : nextValue
    }));
  };

  const openCreatePanel = () => {
    setSelectedStation(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(true);
  };

  const openEditPanel = (station) => {
    setSelectedStation(station);
    setFormState(buildFormState(station));
    setFeedback(null);
    setFormOpen(true);
  };

  const closeFormPanel = () => {
    setFormOpen(false);
  };

  const resetForm = () => {
    setSelectedStation(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFeedback({ severity: 'error', message: m('请先补齐站点编码、名称、区域、控制层级和阶段。') });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (isEditMode) {
        const detail = await updatePlatformStation(selectedStation.code, formState);
        setSelectedStation(detail?.station || selectedStation);
        setFormState(buildFormState(detail?.station || selectedStation));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `站点 ${selectedStation.code} 已更新。`) });
        setFormOpen(false);
      } else {
        const detail = await createPlatformStation(formState);
        setSelectedStation(detail?.station || null);
        setFormState(buildFormState(detail?.station || null));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `创建 站点 ${formState.station_id}`) });
        setFormOpen(false);
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('站点保存失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (station, archived) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (archived) {
        await updatePlatformStation(station.code, { archived: false });
        setFeedback({ severity: 'success', message: localizeUiText(locale, `站点 ${station.code} 已恢复。`) });
      } else {
        await archivePlatformStation(station.code);
        if (selectedStation?.code === station.code) {
          resetForm();
        }
        setFeedback({ severity: 'success', message: localizeUiText(locale, `站点 ${station.code} 已归档。`) });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('站点归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station & Resource Registry"
          title={m('货站与资源管理')}
          description={m('平台方在这里维护站点目录、控制层级、服务范围和基础资源入口，为后续班组、区位、设备与站点能力矩阵预留统一基线。')}
          chips={['Station Directory', 'Control Level', 'Service Scope', 'Resource Entry']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations/capabilities" variant="outlined">
                {m('能力矩阵')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/teams" variant="outlined">
                {m('班组映射')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/zones" variant="outlined">
                {m('区位映射')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/devices" variant="outlined">
                {m('设备映射')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard
          title={m('货站台账')}
          subheader={m('台账列表已切到数据库分页；默认每页 20 条，筛选条件变化会自动回到第一页。')}
        >
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('货站编码 / 名称 / 区域 / Owner')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={includeArchived}
                    onChange={(event) => {
                      setIncludeArchived(event.target.checked);
                      setPage(0);
                    }}
                  />
              }
                label={m('显示已归档')}
              />
              <Box sx={{ ml: { md: 'auto' } }}>
                <Button variant="contained" onClick={openCreatePanel}>
                  {m('新建货站')}
                </Button>
              </Box>
            </Stack>

            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
            {stationsError ? <Alert severity="error">{m('货站台账加载失败，请检查后端连接。')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('货站编码')}</TableCell>
                  <TableCell>{m('区域')}</TableCell>
                  <TableCell>{m('控制层级')}</TableCell>
                  <TableCell>{m('阶段')}</TableCell>
                  <TableCell>{m('Owner')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((station) => (
                  <TableRow key={station.code} hover selected={selectedStation?.code === station.code}>
                    <TableCell>
                      <Stack>
                        <Typography variant="subtitle2">{station.code}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, station.name)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{localizeUiText(locale, station.region)}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, station.control)} />
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, station.phase)} />
                    </TableCell>
                    <TableCell>{localizeUiText(locale, station.owner)}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, station.archived ? '已归档' : '运行中')} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openEditPanel(station)}
                        >
                          {m('编辑')}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleArchiveToggle(station, station.archived)}
                          disabled={submitting}
                        >
                          {station.archived ? m('恢复') : m('归档')}
                        </Button>
                        <Button component={RouterLink} to="/station/dashboard" size="small" variant="outlined">
                          {m('进入货站系统')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!tableRows.length && !stationsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前条件下没有站点数据。')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={total}
              page={currentPage}
              onPageChange={(_event, nextPage) => setPage(nextPage)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          </Stack>
        </MainCard>
      </Grid>
      <Drawer anchor="right" open={formOpen} onClose={closeFormPanel}>
        <Box sx={{ width: { xs: '100vw', sm: 440 }, p: 3 }}>
          <MainCard
            title={isEditMode ? localizeUiText(locale, `编辑货站 / ${selectedStation?.code}`) : m('新增货站')}
            subheader={m('表单字段已切到真实数据库写入。')}
          >
            <Stack sx={{ gap: 2 }}>
              {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
              <TextField label={m('货站名称')} value={formState.station_name} onChange={handleChange('station_name')} />
              <TextField
                label={m('货站编码')}
                value={formState.station_id}
                onChange={handleChange('station_id')}
                disabled={isEditMode}
                helperText={isEditMode ? m('站点编码创建后不可修改。') : m('建议使用 IATA 站点编码。')}
              />
              <TextField label={m('机场代码')} value={formState.airport_code} onChange={handleChange('airport_code')} />
              <TextField label={m('ICAO 代码')} value={formState.icao_code} onChange={handleChange('icao_code')} />
              <TextField label={m('区域')} value={formState.region} onChange={handleChange('region')} />
              <TextField
                select
                label={m('控制层级')}
                value={formState.control_level}
                onChange={handleChange('control_level')}
                disabled={stationOptionsLoading}
              >
                <MenuItem value="">{m('请选择控制层级')}</MenuItem>
                {controlLevels.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {localizeUiText(locale, item.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label={m('阶段')} value={formState.phase} onChange={handleChange('phase')} disabled={stationOptionsLoading}>
                <MenuItem value="">{m('请选择阶段')}</MenuItem>
                {phases.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {localizeUiText(locale, item.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('默认 Owner')}
                value={formState.owner_name}
                onChange={handleChange('owner_name')}
                disabled={stationOptionsLoading}
              >
                <MenuItem value="">{m('请选择 Owner')}</MenuItem>
                {owners.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {localizeUiText(locale, item.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={m('服务范围')}
                value={formState.service_scope}
                onChange={handleChange('service_scope')}
                multiline
                minRows={3}
              />
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                <Button variant="contained" onClick={handleSubmit} disabled={submitting || !canSubmit}>
                  {submitLabel}
                </Button>
                <Button variant="outlined" onClick={resetForm} disabled={submitting}>
                  {m('取消')}
                </Button>
              </Stack>
            </Stack>
          </MainCard>
        </Box>
      </Drawer>
    </Grid>
  );
}
