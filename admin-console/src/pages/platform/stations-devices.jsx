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
  archivePlatformDevice,
  createPlatformDevice,
  updatePlatformDevice,
  useGetPlatformDeviceOptions,
  useGetPlatformDevices
} from 'api/platform';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  device_id: '',
  station_id: '',
  device_type: 'pda',
  binding_role: '',
  owner_team_id: '',
  device_status: 'active',
  note: ''
};

function buildFormState(device) {
  if (!device) {
    return EMPTY_FORM;
  }

  return {
    device_id: device.device_id || device.code || device.device || '',
    station_id: device.station_id || device.station_code || device.station || '',
    device_type: device.device_type || 'pda',
    binding_role: device.binding_role || '',
    owner_team_id: device.owner_team_id || '',
    device_status: device.device_status || 'active',
    note: device.note || ''
  };
}

export default function PlatformStationsDevicesPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { stations, types, roles, statuses, teams, deviceOptionsLoading } = useGetPlatformDeviceOptions();
  const { deviceRows, devicePage, devicesLoading, devicesError } = useGetPlatformDevices({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    station_id: stationFilter,
    type: typeFilter,
    role: roleFilter,
    status: statusFilter,
    include_archived: includeArchived
  });

  useEffect(() => {
    if (selectedDevice) {
      const matched = deviceRows.find((item) => item.device_id === selectedDevice.device_id);
      if (matched) {
        setSelectedDevice(matched);
        setFormState(buildFormState(matched));
      }
    }
  }, [deviceRows, selectedDevice]);

  const tableRows = devicePage?.items || deviceRows;
  const total = devicePage?.total || tableRows.length;
  const currentPage = Math.max(0, (devicePage?.page || 1) - 1);
  const isEditMode = Boolean(selectedDevice);

  const typeLabelMap = useMemo(() => new Map(types.map((item) => [item.value, item.label])), [types]);
  const roleLabelMap = useMemo(() => new Map(roles.map((item) => [item.value, item.label])), [roles]);
  const statusLabelMap = useMemo(() => new Map(statuses.map((item) => [item.value, item.label])), [statuses]);
  const teamMetaById = useMemo(() => new Map(teams.map((item) => [item.value, item.meta || {}])), [teams]);
  const ownerTeamOptions = useMemo(() => {
    if (!formState.station_id) {
      return teams;
    }

    return teams.filter((item) => item.meta?.station_id === formState.station_id);
  }, [formState.station_id, teams]);
  const canSubmit = useMemo(
    () =>
      Boolean(
        formState.device_id &&
        formState.station_id &&
        formState.device_type &&
        formState.binding_role &&
        formState.owner_team_id &&
        formState.device_status
      ),
    [formState]
  );

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;

    setFormState((current) => {
      const nextState = {
        ...current,
        [field]: field === 'device_id' ? String(nextValue).toUpperCase() : nextValue
      };

      if (field === 'station_id') {
        const selectedTeamStationId = teamMetaById.get(current.owner_team_id)?.station_id;
        if (selectedTeamStationId && selectedTeamStationId !== nextValue) {
          nextState.owner_team_id = '';
        }
      }

      return nextState;
    });
  };

  const openCreatePanel = () => {
    setSelectedDevice(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(true);
  };

  const openEditPanel = (device) => {
    setSelectedDevice(device);
    setFormState(buildFormState(device));
    setFeedback(null);
    setFormOpen(true);
  };

  const resetForm = () => {
    setSelectedDevice(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFeedback({ severity: 'error', message: m('请先补齐设备编码、所属站点、类型、绑定角色、Owner 和状态。') });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (isEditMode) {
        const detail = await updatePlatformDevice(selectedDevice.device_id, formState);
        setSelectedDevice(detail?.device || selectedDevice);
        setFormState(buildFormState(detail?.device || selectedDevice));
        setFeedback({
          severity: 'success',
          message: localizeUiText(locale, `设备 ${selectedDevice.device_id} 已更新。`)
        });
        setFormOpen(false);
      } else {
        const detail = await createPlatformDevice(formState);
        setSelectedDevice(detail?.device || null);
        setFormState(buildFormState(detail?.device || null));
        setFeedback({
          severity: 'success',
          message: localizeUiText(locale, `创建设备 ${formState.device_id}`)
        });
        setFormOpen(false);
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('设备保存失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (device, archived) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (archived) {
        await updatePlatformDevice(device.device_id, { archived: false });
        setFeedback({
          severity: 'success',
          message: localizeUiText(locale, `设备 ${device.device_id} 已恢复。`)
        });
      } else {
        await archivePlatformDevice(device.device_id);
        if (selectedDevice?.device_id === device.device_id) {
          resetForm();
        }
        setFeedback({
          severity: 'success',
          message: localizeUiText(locale, `设备 ${device.device_id} 已归档。`)
        });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('设备归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Device Mapping"
          title={m('站点设备映射')}
          description={m('设备对象已切到正式表，平台可以维护站点归属、设备类型、绑定角色、Owner 班组和状态。')}
          chips={['PDA', 'Device Owner', 'Role Mapping']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations" variant="outlined">
                {m('返回站点总览')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/teams" variant="outlined">
                {m('班组映射')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/zones" variant="outlined">
                {m('区位映射')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('设备台账')} subheader={m('设备列表已切到数据库分页；默认每页 20 条，筛选与表单下拉全部来自后端选项接口。')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('设备编码 / 站点 / 类型 / 角色 / Owner')}
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
                label={m('设备类型')}
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
                label={m('绑定角色')}
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部角色')}</MenuItem>
                {roles.map((option) => (
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
                  {m('新建设备')}
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
            {devicesError ? <Alert severity="error">{m('设备台账加载失败，请检查后端连接。')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('设备编码')}</TableCell>
                  <TableCell>{m('所属站点')}</TableCell>
                  <TableCell>{m('类型')}</TableCell>
                  <TableCell>{m('绑定角色')}</TableCell>
                  <TableCell>{m('Owner')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((item) => (
                  <TableRow key={item.device_id} hover selected={selectedDevice?.device_id === item.device_id}>
                    <TableCell>
                      <Stack>
                        <Typography variant="subtitle2">{item.device_id}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.note || m('未配置备注'))}
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
                    <TableCell>{localizeUiText(locale, typeLabelMap.get(item.device_type) || item.type || item.device_type)}</TableCell>
                    <TableCell>{localizeUiText(locale, roleLabelMap.get(item.binding_role) || item.role || item.binding_role)}</TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{item.owner_team_name || item.owner}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.owner_team_id}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        label={localizeUiText(locale, item.archived ? '已归档' : statusLabelMap.get(item.device_status) || item.status || item.device_status)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
                        <Button
                          size="small"
                          variant={selectedDevice?.device_id === item.device_id ? 'contained' : 'outlined'}
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
                {!tableRows.length && !devicesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前条件下没有设备数据。')}
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
            title={isEditMode ? localizeUiText(locale, `编辑设备 / ${selectedDevice?.device_id}`) : m('新增设备')}
            subheader={m('所属站点、设备类型、绑定角色、Owner 班组、状态全部来自数据库选项接口；创建和更新都会写审计。')}
          >
            <Stack sx={{ gap: 2 }}>
              {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
              <TextField label={m('设备编码')} value={formState.device_id} onChange={handleChange('device_id')} disabled={isEditMode} />
              <TextField
                select
                label={m('所属站点')}
                value={formState.station_id}
                onChange={handleChange('station_id')}
                disabled={deviceOptionsLoading}
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
                label={m('设备类型')}
                value={formState.device_type}
                onChange={handleChange('device_type')}
                disabled={deviceOptionsLoading}
              >
                <MenuItem value="">{m('请选择设备类型')}</MenuItem>
                {types.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('绑定角色')}
                value={formState.binding_role}
                onChange={handleChange('binding_role')}
                disabled={deviceOptionsLoading}
              >
                <MenuItem value="">{m('请选择绑定角色')}</MenuItem>
                {roles.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('Owner 班组')}
                value={formState.owner_team_id}
                onChange={handleChange('owner_team_id')}
                disabled={deviceOptionsLoading || !formState.station_id}
              >
                <MenuItem value="">{m('请选择 Owner 班组')}</MenuItem>
                {ownerTeamOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('状态')}
                value={formState.device_status}
                onChange={handleChange('device_status')}
                disabled={deviceOptionsLoading}
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
                  {isEditMode ? m('保存设备') : m('创建设备')}
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
