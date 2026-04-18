import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
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
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import {
  archivePlatformZone,
  createPlatformZone,
  updatePlatformZone,
  useGetPlatformZoneOptions,
  useGetPlatformZones
} from 'api/platform';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  zone_id: '',
  station_id: '',
  zone_type: '',
  linked_lane: '',
  zone_status: 'active',
  note: ''
};

function buildFormState(zone) {
  if (!zone) {
    return EMPTY_FORM;
  }

  return {
    zone_id: zone.zone_id || zone.code || zone.zone || '',
    station_id: zone.station_id || zone.station_code || zone.station || '',
    zone_type: zone.zone_type || '',
    linked_lane: zone.linked_lane || zone.linkedLane || '',
    zone_status: zone.zone_status || 'active',
    note: zone.note || ''
  };
}

export default function PlatformStationsZonesPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { stations, types, statuses, zoneOptionsLoading } = useGetPlatformZoneOptions();
  const { zoneRows, zonePage, zonesLoading, zonesError } = useGetPlatformZones({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    station_id: stationFilter,
    type: typeFilter,
    status: statusFilter,
    include_archived: includeArchived
  });

  useEffect(() => {
    if (selectedZone) {
      const matched = zoneRows.find((item) => item.zone_id === selectedZone.zone_id);
      if (matched) {
        setSelectedZone(matched);
        setFormState(buildFormState(matched));
      }
    }
  }, [selectedZone, zoneRows]);

  const tableRows = zonePage?.items || zoneRows;
  const total = zonePage?.total || tableRows.length;
  const currentPage = Math.max(0, (zonePage?.page || 1) - 1);
  const typeLabelMap = useMemo(() => new Map(types.map((item) => [item.value, item.label])), [types]);
  const statusLabelMap = useMemo(() => new Map(statuses.map((item) => [item.value, item.label])), [statuses]);
  const isEditMode = Boolean(selectedZone);
  const canSubmit = useMemo(
    () => Boolean(formState.zone_id && formState.station_id && formState.zone_type && formState.zone_status),
    [formState]
  );

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;
    setFormState((current) => ({
      ...current,
      [field]: field === 'zone_id' ? String(nextValue).toUpperCase() : nextValue
    }));
  };

  const openCreatePanel = () => {
    setSelectedZone(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(true);
  };

  const openEditPanel = (zone) => {
    setSelectedZone(zone);
    setFormState(buildFormState(zone));
    setFeedback(null);
    setFormOpen(true);
  };

  const resetForm = () => {
    setSelectedZone(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFeedback({ severity: 'error', message: m('请先补齐区位编码、所属站点、区位类型和状态。') });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (isEditMode) {
        const detail = await updatePlatformZone(selectedZone.zone_id, formState);
        setSelectedZone(detail?.zone || selectedZone);
        setFormState(buildFormState(detail?.zone || selectedZone));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `区位 ${selectedZone.zone_id} 已更新。`) });
        setFormOpen(false);
      } else {
        const detail = await createPlatformZone(formState);
        setSelectedZone(detail?.zone || null);
        setFormState(buildFormState(detail?.zone || null));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `创建 区位 ${formState.zone_id}`) });
        setFormOpen(false);
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('区位保存失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (zone, archived) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (archived) {
        await updatePlatformZone(zone.zone_id, { archived: false });
        setFeedback({ severity: 'success', message: localizeUiText(locale, `区位 ${zone.zone_id} 已恢复。`) });
      } else {
        await archivePlatformZone(zone.zone_id);
        if (selectedZone?.zone_id === zone.zone_id) {
          resetForm();
        }
        setFeedback({ severity: 'success', message: localizeUiText(locale, `区位 ${zone.zone_id} 已归档。`) });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('区位归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Zone Mapping"
          title={m('站点区位映射')}
          description={m('区位对象已切到正式表，平台可以维护所属站点、区位类型、链路绑定和区位状态。')}
          chips={['Zone', 'Dock', 'Lane Mapping']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations" variant="outlined">
                {m('返回站点总览')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/teams" variant="outlined">
                {m('班组映射')}
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
          title={m('区位台账')}
          subheader={m('区位列表已切到数据库分页；默认每页 20 条，筛选项全部来自后端选项接口。')}
        >
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('区位编码 / 站点 / 类型 / 链路')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <TextField
                select
                label={m('所属站点')}
                value={stationFilter}
                onChange={(event) => {
                  setStationFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">{m('全部站点')}</MenuItem>
                {stations.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('区位类型')}
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部类型')}</MenuItem>
                {types.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('状态')}
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部状态')}</MenuItem>
                {statuses.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <Box sx={{ ml: { md: 'auto' } }}>
                <Button variant="contained" onClick={openCreatePanel}>
                  {m('新建区位')}
                </Button>
              </Box>
            </Stack>

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

            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
            {zonesError ? <Alert severity="error">{m('区位台账加载失败，请检查后端连接。')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('区位编码')}</TableCell>
                  <TableCell>{m('所属站点')}</TableCell>
                  <TableCell>{m('类型')}</TableCell>
                  <TableCell>{m('链路绑定')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((item) => (
                  <TableRow key={item.zone_id} hover selected={selectedZone?.zone_id === item.zone_id}>
                    <TableCell>
                      <Stack>
                        <Typography variant="subtitle2">{item.zone_id}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.note || '未配置备注')}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{item.station_code}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.station_name)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{localizeUiText(locale, typeLabelMap.get(item.zone_type) || item.type || item.zone_type)}</TableCell>
                    <TableCell>{localizeUiText(locale, item.linked_lane || item.linkedLane || '--')}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.archived ? '已归档' : statusLabelMap.get(item.zone_status) || item.status || item.zone_status)} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
                        <Button
                          size="small"
                          variant={selectedZone?.zone_id === item.zone_id ? 'contained' : 'outlined'}
                          onClick={() => openEditPanel(item)}
                        >
                          {m('编辑')}
                        </Button>
                        <Button
                          size="small"
                          color={item.archived ? 'success' : 'error'}
                          variant="outlined"
                          onClick={() => handleArchiveToggle(item, item.archived)}
                          disabled={submitting}
                        >
                          {item.archived ? m('恢复') : m('归档')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!tableRows.length && !zonesLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前条件下没有区位数据。')}
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
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          </Stack>
        </MainCard>
      </Grid>

      <Drawer anchor="right" open={formOpen} onClose={resetForm}>
        <Box sx={{ width: { xs: '100vw', sm: 440 }, p: 3 }}>
          <MainCard
            title={isEditMode ? localizeUiText(locale, `编辑区位 ${selectedZone?.zone_id}`) : m('新增区位')}
            subheader={m('所属站点、区位类型、状态全部来自数据库选项接口；创建和更新都会写审计。')}
          >
            <Stack sx={{ gap: 2 }}>
              {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
              <TextField label={m('区位编码')} value={formState.zone_id} onChange={handleChange('zone_id')} disabled={isEditMode} />
              <TextField
                select
                label={m('所属站点')}
                value={formState.station_id}
                onChange={handleChange('station_id')}
                disabled={zoneOptionsLoading}
              >
                <MenuItem value="">{m('请选择站点')}</MenuItem>
                {stations.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('区位类型')}
                value={formState.zone_type}
                onChange={handleChange('zone_type')}
                disabled={zoneOptionsLoading}
              >
                <MenuItem value="">{m('请选择区位类型')}</MenuItem>
                {types.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label={m('链路绑定')} value={formState.linked_lane} onChange={handleChange('linked_lane')} />
              <TextField
                select
                label={m('状态')}
                value={formState.zone_status}
                onChange={handleChange('zone_status')}
                disabled={zoneOptionsLoading}
              >
                <MenuItem value="">{m('请选择状态')}</MenuItem>
                {statuses.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label={m('备注')} value={formState.note} onChange={handleChange('note')} multiline minRows={3} />

              <Stack direction="row" sx={{ gap: 1 }}>
                <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || submitting}>
                  {isEditMode ? m('保存区位') : m('创建区位')}
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
