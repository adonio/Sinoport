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
  archivePlatformNetworkLane,
  createPlatformNetworkLane,
  updatePlatformNetworkLane,
  useGetPlatformNetworkLaneOptions,
  useGetPlatformNetworkLanes
} from 'api/platform';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  lane_id: '',
  lane_name: '',
  business_mode: '',
  origin_station_id: '',
  via_station_id: '',
  destination_station_id: '',
  node_order: '',
  key_events: '',
  sla_text: '',
  control_depth: '',
  lane_status: 'active',
  note: ''
};

function buildFormState(lane) {
  if (!lane) {
    return EMPTY_FORM;
  }

  return {
    lane_id: lane.lane_id || lane.code || lane.laneCode || '',
    lane_name: lane.lane_name || lane.lane || '',
    business_mode: lane.business_mode || lane.pattern || '',
    origin_station_id: lane.origin_station_id || lane.originStationId || '',
    via_station_id: lane.via_station_id || lane.viaStationId || '',
    destination_station_id: lane.destination_station_id || lane.destinationStationId || '',
    node_order: lane.node_order || lane.nodeOrder || '',
    key_events: lane.key_events || lane.keyEvents || lane.events || '',
    sla_text: lane.sla_text || lane.sla || lane.promise || '',
    control_depth: lane.control_depth || '',
    lane_status: lane.lane_status || lane.laneStatus || 'active',
    note: lane.note || ''
  };
}

export default function PlatformNetworkLanesPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [controlDepthFilter, setControlDepthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedLane, setSelectedLane] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { stations, controlDepths, statuses, networkLaneOptionsLoading } = useGetPlatformNetworkLaneOptions();
  const { laneRows, lanePage, networkLanesLoading, networkLanesError } = useGetPlatformNetworkLanes({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    station_id: stationFilter,
    control_depth: controlDepthFilter,
    status: statusFilter,
    include_archived: includeArchived
  });

  useEffect(() => {
    if (selectedLane) {
      const matched = laneRows.find((item) => item.lane_id === selectedLane.lane_id);
      if (matched) {
        setSelectedLane(matched);
        setFormState(buildFormState(matched));
      }
    }
  }, [selectedLane, laneRows]);

  const tableRows = lanePage?.items || laneRows;
  const total = lanePage?.total || tableRows.length;
  const currentPage = Math.max(0, (lanePage?.page || 1) - 1);
  const controlDepthLabelMap = useMemo(() => new Map(controlDepths.map((item) => [item.value, item.label])), [controlDepths]);
  const statusLabelMap = useMemo(() => new Map(statuses.map((item) => [item.value, item.label])), [statuses]);
  const isEditMode = Boolean(selectedLane);
  const canSubmit = useMemo(
    () =>
      Boolean(
        formState.lane_id &&
        formState.lane_name &&
        formState.origin_station_id &&
        formState.destination_station_id &&
        formState.node_order &&
        formState.sla_text &&
        formState.control_depth &&
        formState.lane_status
      ),
    [formState]
  );

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;
    setFormState((current) => ({
      ...current,
      [field]: field === 'lane_id' ? String(nextValue).toUpperCase() : nextValue
    }));
  };

  const openCreatePanel = () => {
    setSelectedLane(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(true);
  };

  const openEditPanel = (lane) => {
    setSelectedLane(lane);
    setFormState(buildFormState(lane));
    setFeedback(null);
    setFormOpen(true);
  };

  const resetForm = () => {
    setSelectedLane(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFeedback({ severity: 'error', message: m('请先补齐链路编码、名称、起止站点、节点顺序、SLA、控制深度和状态。') });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (isEditMode) {
        const detail = await updatePlatformNetworkLane(selectedLane.lane_id, formState);
        setSelectedLane(detail?.lane || selectedLane);
        setFormState(buildFormState(detail?.lane || selectedLane));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `链路 ${selectedLane.lane_id} 已更新。`) });
        setFormOpen(false);
      } else {
        const detail = await createPlatformNetworkLane(formState);
        setSelectedLane(detail?.lane || null);
        setFormState(buildFormState(detail?.lane || null));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `创建链路 ${formState.lane_id}`) });
        setFormOpen(false);
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('链路保存失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (lane, archived) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (archived) {
        await updatePlatformNetworkLane(lane.lane_id, { archived: false });
        setFeedback({ severity: 'success', message: localizeUiText(locale, `链路 ${lane.lane_id} 已恢复。`) });
      } else {
        await archivePlatformNetworkLane(lane.lane_id);
        if (selectedLane?.lane_id === lane.lane_id) {
          resetForm();
        }
        setFeedback({ severity: 'success', message: localizeUiText(locale, `链路 ${lane.lane_id} 已归档。`) });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('链路归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Network Lanes"
          title={m('链路模板')}
          description={m('链路对象已切到正式表，平台可以直接维护起止站点、节点顺序、SLA、控制深度和链路状态。')}
          chips={['DB CRUD', 'Lane Template', 'Drawer Editor']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/network" variant="outlined">
                {m('返回网络总览')}
              </Button>
              <Button component={RouterLink} to="/platform/network/scenarios" variant="outlined">
                {m('标准场景')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('链路台账')} subheader={m('链路列表已切到数据库分页；默认每页 20 条，筛选和表单下拉均来自后端 options 接口。')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('链路编码 / 名称 / 节点顺序 / SLA / 站点')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <TextField
                select
                label={m('关联站点')}
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
                label={m('控制深度')}
                value={controlDepthFilter}
                onChange={(event) => {
                  setControlDepthFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部控制深度')}</MenuItem>
                {controlDepths.map((option) => (
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
                  {m('新建链路')}
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
            {networkLanesError ? <Alert severity="error">{m('链路台账加载失败，请检查后端连接。')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('链路编码')}</TableCell>
                  <TableCell>{m('链路')}</TableCell>
                  <TableCell>{m('站点路径')}</TableCell>
                  <TableCell>{localizeUiText(locale, 'SLA')}</TableCell>
                  <TableCell>{m('控制深度')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((item) => (
                  <TableRow key={item.lane_id} hover selected={selectedLane?.lane_id === item.lane_id}>
                    <TableCell>
                      <Stack>
                        <Typography variant="subtitle2">{item.lane_id}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.business_mode || m('未配置业务模式'))}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{localizeUiText(locale, item.lane_name)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.note || m('未配置备注'))}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{localizeUiText(locale, item.station_path || item.stations)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.node_order || item.nodeOrder)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{localizeUiText(locale, item.sla_text || item.sla)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.key_events || item.events || '--')}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{localizeUiText(locale, controlDepthLabelMap.get(item.control_depth) || item.controlDepth || item.control_depth)}</TableCell>
                    <TableCell>
                      <StatusChip
                        label={localizeUiText(locale, item.archived ? '已归档' : statusLabelMap.get(item.lane_status) || item.status || item.lane_status)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
                        <Button
                          size="small"
                          variant={selectedLane?.lane_id === item.lane_id ? 'contained' : 'outlined'}
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
                {!tableRows.length && !networkLanesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前条件下没有链路数据。')}
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
        <Box sx={{ width: { xs: '100vw', sm: 480 }, p: 3 }}>
          <MainCard
            title={isEditMode ? localizeUiText(locale, `编辑链路 ${selectedLane?.lane_id}`) : m('新增链路')}
            subheader={m('起站、中转站、终站、控制深度和状态全部来自数据库选项源；创建和更新都会写审计。')}
          >
            <Stack sx={{ gap: 2 }}>
              {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
              <TextField label={m('链路编码')} value={formState.lane_id} onChange={handleChange('lane_id')} disabled={isEditMode} />
              <TextField label={m('链路名称')} value={formState.lane_name} onChange={handleChange('lane_name')} />
              <TextField label={m('业务模式')} value={formState.business_mode} onChange={handleChange('business_mode')} />
              <TextField
                select
                label={m('起站')}
                value={formState.origin_station_id}
                onChange={handleChange('origin_station_id')}
                disabled={networkLaneOptionsLoading}
              >
                <MenuItem value="">{m('请选择起站')}</MenuItem>
                {stations.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('中转站')}
                value={formState.via_station_id}
                onChange={handleChange('via_station_id')}
                disabled={networkLaneOptionsLoading}
              >
                <MenuItem value="">{m('无中转站')}</MenuItem>
                {stations.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('终站')}
                value={formState.destination_station_id}
                onChange={handleChange('destination_station_id')}
                disabled={networkLaneOptionsLoading}
              >
                <MenuItem value="">{m('请选择终站')}</MenuItem>
                {stations.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label={localizeUiText(locale, 'SLA')} value={formState.sla_text} onChange={handleChange('sla_text')} />
              <TextField label={m('节点顺序')} value={formState.node_order} onChange={handleChange('node_order')} multiline minRows={3} />
              <TextField label={m('关键事件')} value={formState.key_events} onChange={handleChange('key_events')} multiline minRows={2} />
              <TextField
                select
                label={m('控制深度')}
                value={formState.control_depth}
                onChange={handleChange('control_depth')}
                disabled={networkLaneOptionsLoading}
              >
                <MenuItem value="">{m('请选择控制深度')}</MenuItem>
                {controlDepths.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('状态')}
                value={formState.lane_status}
                onChange={handleChange('lane_status')}
                disabled={networkLaneOptionsLoading}
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
                  {isEditMode ? m('保存链路') : m('创建链路')}
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
