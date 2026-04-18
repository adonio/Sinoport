import { useEffect, useMemo, useState } from 'react';

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

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import {
  archiveStationResourceVehicle,
  createStationResourceVehicle,
  updateStationResourceVehicle,
  useGetStationResourceVehicleOptions,
  useGetStationResourceVehicles
} from 'api/station';
import { Link as RouterLink } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

const PAGE_SIZE = 20;
const EMPTY_FORM = {
  tripId: '',
  flowKey: '',
  route: '',
  plate: '',
  driver: '',
  driverPhone: '',
  collectionNote: '',
  status: '',
  priority: '',
  sla: '',
  awbs: '',
  pallets: '',
  officePlan: '',
  pdaExec: ''
};

function buildFormState(vehicle) {
  if (!vehicle) {
    return EMPTY_FORM;
  }

  return {
    tripId: vehicle.tripId || '',
    flowKey: vehicle.flowKey || '',
    route: vehicle.route || '',
    plate: vehicle.plate || '',
    driver: vehicle.driver || '',
    driverPhone: vehicle.driverPhone || '',
    collectionNote: vehicle.collectionNote || '',
    status: vehicle.status || '',
    priority: vehicle.priority || '',
    sla: vehicle.sla || '',
    awbs: Array.isArray(vehicle.awbs) ? vehicle.awbs.join(', ') : '',
    pallets: Array.isArray(vehicle.pallets) ? vehicle.pallets.join(', ') : '',
    officePlan: vehicle.officePlan || '',
    pdaExec: vehicle.pdaExec || ''
  };
}

function splitTextList(value) {
  return String(value || '')
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function StationResourcesVehiclesPage() {
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [flowFilter, setFlowFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);

  const { flowOptions, statusOptions, priorityOptions, stationVehicleOptionsLoading } = useGetStationResourceVehicleOptions();
  const { vehicleRows, vehiclePage, stationResourceVehiclesLoading, stationResourceVehiclesError } = useGetStationResourceVehicles({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    flow_key: flowFilter,
    status: statusFilter,
    priority: priorityFilter,
    include_archived: includeArchived
  });

  useEffect(() => {
    if (!selectedVehicle) return;

    const matched = vehicleRows.find((item) => item.tripId === selectedVehicle.tripId);
    if (matched) {
      setSelectedVehicle(matched);
      setFormState(buildFormState(matched));
    }
  }, [selectedVehicle, vehicleRows]);

  const total = vehiclePage?.total || vehicleRows.length;
  const currentPage = Math.max(0, (vehiclePage?.page || 1) - 1);
  const isEditMode = Boolean(selectedVehicle);
  const flowLabelMap = useMemo(() => new Map(flowOptions.map((item) => [item.value, item.label])), [flowOptions]);
  const statusLabelMap = useMemo(() => new Map(statusOptions.map((item) => [item.value, item.label])), [statusOptions]);
  const priorityLabelMap = useMemo(() => new Map(priorityOptions.map((item) => [item.value, item.label])), [priorityOptions]);
  const canSubmit = useMemo(
    () => Boolean(formState.tripId && formState.flowKey && formState.plate && formState.status && formState.priority),
    [formState]
  );

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;
    setFormState((current) => ({
      ...current,
      [field]: field === 'tripId' ? String(nextValue).toUpperCase() : nextValue
    }));
  };

  const resetForm = () => {
    setSelectedVehicle(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(false);
  };

  const openCreatePanel = () => {
    setSelectedVehicle(null);
    setFormState({
      ...EMPTY_FORM,
      flowKey: flowOptions[0]?.value || 'headhaul',
      status: statusOptions[0]?.value || 'pending_dispatch',
      priority: priorityOptions[0]?.value || 'P2'
    });
    setFeedback(null);
    setFormOpen(true);
  };

  const openEditPanel = (vehicle) => {
    setSelectedVehicle(vehicle);
    setFormState(buildFormState(vehicle));
    setFeedback(null);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFeedback({ severity: 'error', message: formatLocalizedMessage(intl, '请先补齐行程号、流程、车牌、状态和优先级。') });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const payload = {
      trip_id: formState.tripId,
      flow_key: formState.flowKey,
      route: formState.route,
      plate: formState.plate,
      driver: formState.driver,
      driver_phone: formState.driverPhone,
      collectionNote: formState.collectionNote,
      status: formState.status,
      priority: formState.priority,
      sla: formState.sla,
      awbs: splitTextList(formState.awbs),
      pallets: splitTextList(formState.pallets),
      officePlan: formState.officePlan,
      pdaExec: formState.pdaExec
    };

    try {
      if (isEditMode) {
        const detail = await updateStationResourceVehicle(selectedVehicle.tripId, payload);
        const nextVehicle = detail?.vehicle || selectedVehicle;
        setSelectedVehicle(nextVehicle);
        setFormState(buildFormState(nextVehicle));
        setFeedback({ severity: 'success', message: formatLocalizedMessage(intl, `车辆 ${selectedVehicle.tripId} 已更新。`) });
      } else {
        const detail = await createStationResourceVehicle(payload);
        const nextVehicle = detail?.vehicle || null;
        setSelectedVehicle(nextVehicle);
        setFormState(buildFormState(nextVehicle));
        setFeedback({ severity: 'success', message: formatLocalizedMessage(intl, `车辆 ${formState.tripId} 已创建。`) });
      }

      setFormOpen(false);
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || formatLocalizedMessage(intl, '车辆保存失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (vehicle, archived) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (archived) {
        await updateStationResourceVehicle(vehicle.tripId, { archived: false });
        setFeedback({ severity: 'success', message: formatLocalizedMessage(intl, `车辆 ${vehicle.tripId} 已恢复。`) });
      } else {
        await archiveStationResourceVehicle(vehicle.tripId);
        if (selectedVehicle?.tripId === vehicle.tripId) {
          resetForm();
        }
        setFeedback({ severity: 'success', message: formatLocalizedMessage(intl, `车辆 ${vehicle.tripId} 已归档。`) });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || formatLocalizedMessage(intl, '车辆归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={formatLocalizedMessage(intl, '车辆')}
          title={formatLocalizedMessage(intl, '车辆与提货单号')}
          description={formatLocalizedMessage(
            intl,
            '车辆对象已切到正式 trucks 表，列表默认走后端分页 20 条，创建和编辑统一在右侧 Drawer 内完成。'
          )}
          chips={[formatLocalizedMessage(intl, '车辆'), formatLocalizedMessage(intl, '司机'), formatLocalizedMessage(intl, '提货单号')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/resources" variant="outlined">
                {formatLocalizedMessage(intl, '返回资源总览')}
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                {formatLocalizedMessage(intl, '作业任务')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard
          title={formatLocalizedMessage(intl, '车辆台账')}
          subheader={formatLocalizedMessage(intl, '筛选与表单下拉全部来自数据库选项接口；写操作会落审计。')}
        >
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
              <TextField
                label={formatLocalizedMessage(intl, '关键字')}
                placeholder={formatLocalizedMessage(intl, '行程号 / 路线 / 车牌 / 司机 / 提货单号')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <TextField
                select
                label={formatLocalizedMessage(intl, '流程')}
                value={flowFilter}
                onChange={(event) => {
                  setFlowFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{formatLocalizedMessage(intl, '全部流程')}</MenuItem>
                {flowOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {l(option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={formatLocalizedMessage(intl, '状态')}
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{formatLocalizedMessage(intl, '全部状态')}</MenuItem>
                {statusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {l(option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={formatLocalizedMessage(intl, '优先级')}
                value={priorityFilter}
                onChange={(event) => {
                  setPriorityFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">{formatLocalizedMessage(intl, '全部优先级')}</MenuItem>
                {priorityOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {l(option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <Box sx={{ ml: { md: 'auto' } }}>
                <Button variant="contained" onClick={openCreatePanel}>
                  {formatLocalizedMessage(intl, '新建车辆')}
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
              label={formatLocalizedMessage(intl, '显示已归档')}
            />

            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
            {stationResourceVehiclesError ? (
              <Alert severity="error">{formatLocalizedMessage(intl, '车辆台账加载失败，请检查后端连接。')}</Alert>
            ) : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{formatLocalizedMessage(intl, '行程号')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '流程 / 路线')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '车牌 / 司机')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '提货单号')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '状态')}</TableCell>
                  <TableCell>{formatLocalizedMessage(intl, '优先级')}</TableCell>
                  <TableCell align="right">{formatLocalizedMessage(intl, '操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vehicleRows.map((item) => (
                  <TableRow key={item.tripId} hover selected={selectedVehicle?.tripId === item.tripId}>
                    <TableCell>
                      <Stack>
                        <Typography variant="subtitle2">{item.tripId}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.awbs.length ? `${item.awbs.length} AWB` : formatLocalizedMessage(intl, '未关联 AWB')}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{l(flowLabelMap.get(item.flowKey) || item.flowLabel || item.flowKey)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {l(item.route || '--')}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{item.plate}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {l(item.driver || '未配置司机')}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{item.collectionNote || '--'}</TableCell>
                    <TableCell>
                      <StatusChip
                        label={item.archived ? '已归档' : l(statusLabelMap.get(item.status) || item.statusLabel || item.status)}
                      />
                    </TableCell>
                    <TableCell>{l(priorityLabelMap.get(item.priority) || item.priorityLabel || item.priority)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
                        <Button
                          size="small"
                          variant={selectedVehicle?.tripId === item.tripId ? 'contained' : 'outlined'}
                          onClick={() => openEditPanel(item)}
                        >
                          {formatLocalizedMessage(intl, '编辑')}
                        </Button>
                        <Button
                          size="small"
                          color={item.archived ? 'success' : 'error'}
                          variant="outlined"
                          disabled={submitting}
                          onClick={() => handleArchiveToggle(item, item.archived)}
                        >
                          {item.archived ? formatLocalizedMessage(intl, '恢复') : formatLocalizedMessage(intl, '归档')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!vehicleRows.length && !stationResourceVehiclesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        {formatLocalizedMessage(intl, '当前条件下没有车辆数据。')}
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
        <Box sx={{ width: { xs: '100vw', sm: 460 }, p: 3 }}>
          <MainCard
            title={
              isEditMode ? formatLocalizedMessage(intl, `编辑车辆 ${selectedVehicle?.tripId}`) : formatLocalizedMessage(intl, '新增车辆')
            }
            subheader={formatLocalizedMessage(intl, '流程、状态、优先级全部来自数据库选项表；保存成功后 Drawer 会自动收起。')}
          >
            <Stack sx={{ gap: 2 }}>
              {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
              <TextField
                label={formatLocalizedMessage(intl, '行程号')}
                value={formState.tripId}
                onChange={handleChange('tripId')}
                disabled={isEditMode}
              />
              <TextField
                select
                label={formatLocalizedMessage(intl, '流程')}
                value={formState.flowKey}
                onChange={handleChange('flowKey')}
                disabled={stationVehicleOptionsLoading}
              >
                <MenuItem value="">{formatLocalizedMessage(intl, '请选择流程')}</MenuItem>
                {flowOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {l(option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label={formatLocalizedMessage(intl, '路线')} value={formState.route} onChange={handleChange('route')} />
              <TextField label={formatLocalizedMessage(intl, '车牌')} value={formState.plate} onChange={handleChange('plate')} />
              <TextField label={formatLocalizedMessage(intl, '司机')} value={formState.driver} onChange={handleChange('driver')} />
              <TextField
                label={formatLocalizedMessage(intl, '司机电话')}
                value={formState.driverPhone}
                onChange={handleChange('driverPhone')}
              />
              <TextField
                label={formatLocalizedMessage(intl, '提货单号')}
                value={formState.collectionNote}
                onChange={handleChange('collectionNote')}
              />
              <TextField
                select
                label={formatLocalizedMessage(intl, '状态')}
                value={formState.status}
                onChange={handleChange('status')}
                disabled={stationVehicleOptionsLoading}
              >
                <MenuItem value="">{formatLocalizedMessage(intl, '请选择状态')}</MenuItem>
                {statusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {l(option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={formatLocalizedMessage(intl, '优先级')}
                value={formState.priority}
                onChange={handleChange('priority')}
                disabled={stationVehicleOptionsLoading}
              >
                <MenuItem value="">{formatLocalizedMessage(intl, '请选择优先级')}</MenuItem>
                {priorityOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {l(option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label={formatLocalizedMessage(intl, 'SLA')} value={formState.sla} onChange={handleChange('sla')} />
              <TextField
                label={formatLocalizedMessage(intl, '计划 AWB')}
                value={formState.awbs}
                onChange={handleChange('awbs')}
                multiline
                minRows={2}
              />
              <TextField
                label={formatLocalizedMessage(intl, '计划托盘')}
                value={formState.pallets}
                onChange={handleChange('pallets')}
                multiline
                minRows={2}
              />
              <TextField
                label={formatLocalizedMessage(intl, '后台先完成')}
                value={formState.officePlan}
                onChange={handleChange('officePlan')}
                multiline
                minRows={3}
              />
              <TextField
                label={formatLocalizedMessage(intl, 'PDA 现场执行')}
                value={formState.pdaExec}
                onChange={handleChange('pdaExec')}
                multiline
                minRows={3}
              />
              <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
                <Button variant="outlined" onClick={resetForm}>
                  {formatLocalizedMessage(intl, '取消')}
                </Button>
                <Button variant="contained" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? formatLocalizedMessage(intl, '保存中...') : formatLocalizedMessage(intl, '保存车辆')}
                </Button>
              </Stack>
            </Stack>
          </MainCard>
        </Box>
      </Drawer>
    </Grid>
  );
}
