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
  archivePlatformMasterDataSync,
  createPlatformMasterDataSync,
  updatePlatformMasterDataSync,
  useGetPlatformMasterDataSync,
  useGetPlatformMasterDataSyncDetail,
  useGetPlatformMasterDataSyncOptions
} from 'api/platform';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  sync_id: '',
  sync_name: '',
  object_type: '',
  target_system: '',
  sync_status: '',
  schedule_label: '',
  last_run_at: '',
  fallback_strategy: '',
  primary_action_label: '',
  fallback_action_label: '',
  owner_name: '',
  note: ''
};

function buildFormState(record) {
  if (!record) {
    return EMPTY_FORM;
  }

  return {
    sync_id: record.sync_id || record.id || record.code || '',
    sync_name: record.sync_name || record.name || '',
    object_type: record.object_type || record.object_type_key || '',
    target_system: record.target_system || record.target_key || '',
    sync_status: record.sync_status || record.status_key || '',
    schedule_label: record.schedule_label || record.schedule || '',
    last_run_at: record.last_run_at || record.lastRun || '',
    fallback_strategy: record.fallback_strategy || record.fallback || '',
    primary_action_label: record.primary_action_label || record.primaryAction || '',
    fallback_action_label: record.fallback_action_label || record.fallbackAction || '',
    owner_name: record.owner_name || record.owner || '',
    note: record.note || ''
  };
}

function getPreferredOptionValue(options, preferredValue) {
  const matched = options.find((item) => item.value === preferredValue && !item.disabled);
  if (matched) {
    return matched.value;
  }

  return options.find((item) => !item.disabled)?.value || '';
}

function formatDateTime(value) {
  return value ? String(value).replace('T', ' ').slice(0, 16) : '--';
}

export default function PlatformMasterDataSyncPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [objectFilter, setObjectFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [activeSyncId, setActiveSyncId] = useState('');
  const [selectedSync, setSelectedSync] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { objects, targets, statuses, masterDataSyncOptionsLoading } = useGetPlatformMasterDataSyncOptions();
  const { syncRows, syncPage, masterDataSyncLoading, masterDataSyncError } = useGetPlatformMasterDataSync({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    object_type: objectFilter,
    target_system: targetFilter,
    sync_status: statusFilter,
    include_archived: includeArchived
  });
  const { sync, masterDataSyncDetailLoading, masterDataSyncDetailError } = useGetPlatformMasterDataSyncDetail(
    formOpen && activeSyncId ? activeSyncId : null
  );

  useEffect(() => {
    if (!formOpen || activeSyncId || formState.sync_status || !statuses.length) {
      return;
    }

    setFormState((current) => ({
      ...current,
      sync_status: getPreferredOptionValue(statuses, 'active')
    }));
  }, [activeSyncId, formOpen, formState.sync_status, statuses]);

  useEffect(() => {
    if (!sync) {
      return;
    }

    setSelectedSync(sync);
    setFormState(buildFormState(sync));
  }, [sync]);

  useEffect(() => {
    if (!activeSyncId) {
      return;
    }

    const matched = syncRows.find((item) => item.sync_id === activeSyncId);
    if (matched) {
      setSelectedSync((current) => (current?.updated_at === matched.updated_at ? current : { ...current, ...matched }));
    }
  }, [activeSyncId, syncRows]);

  const tableRows = syncPage?.items || syncRows;
  const total = syncPage?.total || tableRows.length;
  const currentPage = Math.max(0, (syncPage?.page || 1) - 1);
  const isEditMode = Boolean(activeSyncId);
  const canSubmit = useMemo(
    () =>
      Boolean(
        formState.sync_id &&
          formState.sync_name &&
          formState.object_type &&
          formState.target_system &&
          formState.sync_status &&
          formState.fallback_strategy &&
          formState.primary_action_label &&
          formState.fallback_action_label &&
          formState.owner_name
      ),
    [formState]
  );

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;

    setFormState((current) => ({
      ...current,
      [field]: field === 'sync_id' ? String(nextValue).toUpperCase() : nextValue
    }));
  };

  const resetForm = () => {
    setActiveSyncId('');
    setSelectedSync(null);
    setFormState({
      ...EMPTY_FORM,
      sync_status: getPreferredOptionValue(statuses, 'active')
    });
    setFormOpen(false);
    setFeedback(null);
  };

  const openCreatePanel = () => {
    setActiveSyncId('');
    setSelectedSync(null);
    setFormState({
      ...EMPTY_FORM,
      sync_status: getPreferredOptionValue(statuses, 'active')
    });
    setFeedback(null);
    setFormOpen(true);
  };

  const openEditPanel = (record) => {
    setActiveSyncId(record.sync_id);
    setSelectedSync(record);
    setFormState(buildFormState(record));
    setFeedback(null);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFeedback({
        severity: 'error',
        message: m('请先补齐配置编码、名称、对象、目标模块、状态、动作文案、兜底策略和 Owner。')
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (isEditMode) {
        const detail = await updatePlatformMasterDataSync(activeSyncId, formState);
        setSelectedSync(detail?.sync || selectedSync);
        setFeedback({ severity: 'success', message: localizeUiText(locale, `同步配置 ${activeSyncId} 已更新。`) });
      } else {
        const detail = await createPlatformMasterDataSync(formState);
        setSelectedSync(detail?.sync || null);
        setFeedback({ severity: 'success', message: `${m('新建同步配置')} ${formState.sync_id}` });
      }

      setFormOpen(false);
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('同步配置保存失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (record, archived) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (archived) {
        await updatePlatformMasterDataSync(record.sync_id, { archived: false });
        setFeedback({ severity: 'success', message: localizeUiText(locale, `同步配置 ${record.sync_id} 已恢复。`) });
      } else {
        await archivePlatformMasterDataSync(record.sync_id);
        if (activeSyncId === record.sync_id) {
          resetForm();
        }
        setFeedback({ severity: 'success', message: localizeUiText(locale, `同步配置 ${record.sync_id} 已归档。`) });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('同步配置归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Master Data Sync"
          title={m('接口同步看板')}
          description={m('同步配置对象已切换到正式数据库；列表默认后端分页 20 条，筛选下拉来自 DB options，新建/编辑统一走右侧 Drawer。')}
          chips={['DB CRUD', 'DB Options', '20/page', 'Drawer Editor']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/master-data/jobs" variant="outlined">
                {m('导入任务')}
              </Button>
              <Button component={RouterLink} to="/platform/audit" variant="outlined">
                {m('审计与可信留痕')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('同步配置台账')} subheader={m('正式表 `platform_master_data_sync`，默认后端分页 20 条。')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2, alignItems: { lg: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('编码 / 名称 / 兜底策略 / Owner / 备注')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <TextField
                select
                label={m('对象')}
                value={objectFilter}
                onChange={(event) => {
                  setObjectFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部对象')}</MenuItem>
                {objects.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('目标模块')}
                value={targetFilter}
                onChange={(event) => {
                  setTargetFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部目标')}</MenuItem>
                {targets.map((option) => (
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
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">{m('全部状态')}</MenuItem>
                {statuses.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <Box sx={{ ml: { lg: 'auto' } }}>
                <Button variant="contained" onClick={openCreatePanel}>
                  {m('新建同步配置')}
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
            {masterDataSyncError ? <Alert severity="error">{m('同步配置加载失败，请检查后端连接。')}</Alert> : null}
            {masterDataSyncOptionsLoading ? <Alert severity="info">{m('正在从数据库加载同步配置选项…')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('编码')}</TableCell>
                  <TableCell>{m('同步项')}</TableCell>
                  <TableCell>{m('对象')}</TableCell>
                  <TableCell>{m('目标模块')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell>{m('最后运行')}</TableCell>
                  <TableCell>{m('兜底策略')}</TableCell>
                  <TableCell>{localizeUiText(locale, 'Owner')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((record) => (
                  <TableRow key={record.sync_id} hover selected={selectedSync?.sync_id === record.sync_id}>
                    <TableCell>
                      <Typography variant="subtitle2">{record.sync_id}</Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Stack sx={{ gap: 0.5 }}>
                        <Typography variant="subtitle2">{localizeUiText(locale, record.sync_name)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, record.primary_action_label)} / {localizeUiText(locale, record.fallback_action_label)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{localizeUiText(locale, record.object)}</TableCell>
                    <TableCell>{localizeUiText(locale, record.target)}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, record.status)} />
                    </TableCell>
                    <TableCell>{formatDateTime(record.last_run_at)}</TableCell>
                    <TableCell sx={{ minWidth: 220 }}>{localizeUiText(locale, record.fallback_strategy)}</TableCell>
                    <TableCell>{localizeUiText(locale, record.owner_name || '--')}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
                        <Button size="small" variant="text" onClick={() => openEditPanel(record)}>
                          {m('编辑')}
                        </Button>
                        <Button
                          size="small"
                          color={record.archived ? 'success' : 'warning'}
                          onClick={() => handleArchiveToggle(record, record.archived)}
                          disabled={submitting}
                        >
                          {record.archived ? m('恢复') : m('归档')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!masterDataSyncLoading && !tableRows.length ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前筛选条件下没有同步配置。')}
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

      <Drawer anchor="right" open={formOpen} onClose={resetForm} PaperProps={{ sx: { width: { xs: '100%', sm: 460 } } }}>
        <Stack sx={{ p: 3, gap: 2 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h5">{isEditMode ? localizeUiText(locale, `编辑 ${activeSyncId}`) : m('新建同步配置')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {m('配置对象写入正式表，归档采用软删除。')}
            </Typography>
          </Stack>

          {masterDataSyncDetailLoading && isEditMode ? <Alert severity="info">{localizeUiText(locale, '正在加载同步配置详情…')}</Alert> : null}
          {masterDataSyncDetailError && isEditMode ? <Alert severity="error">{localizeUiText(locale, '同步配置详情加载失败，请稍后重试。')}</Alert> : null}

          <TextField
            label={m('配置编码')}
            value={formState.sync_id}
            onChange={handleChange('sync_id')}
            disabled={isEditMode}
            helperText={isEditMode ? m('编码创建后不可修改。') : m('建议使用业务前缀，例如 SYNC-FFM。')}
          />
          <TextField label={m('同步名称')} value={formState.sync_name} onChange={handleChange('sync_name')} />
          <TextField select label={m('对象')} value={formState.object_type} onChange={handleChange('object_type')}>
            {objects.map((option) => (
              <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                {localizeUiText(locale, option.label)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label={m('目标模块')} value={formState.target_system} onChange={handleChange('target_system')}>
            {targets.map((option) => (
              <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                {localizeUiText(locale, option.label)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label={m('状态')} value={formState.sync_status} onChange={handleChange('sync_status')}>
            {statuses.map((option) => (
              <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                {localizeUiText(locale, option.label)}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={m('调度说明')} value={formState.schedule_label} onChange={handleChange('schedule_label')} />
          <TextField
            label={m('最后运行时间')}
            value={formState.last_run_at}
            onChange={handleChange('last_run_at')}
            placeholder={localizeUiText(locale, '2026-04-16T09:30:00.000Z')}
          />
          <TextField label={m('主动作文案')} value={formState.primary_action_label} onChange={handleChange('primary_action_label')} />
          <TextField label={m('兜底动作文案')} value={formState.fallback_action_label} onChange={handleChange('fallback_action_label')} />
          <TextField
            label={m('兜底策略')}
            value={formState.fallback_strategy}
            onChange={handleChange('fallback_strategy')}
            multiline
            minRows={2}
          />
          <TextField label={localizeUiText(locale, 'Owner')} value={formState.owner_name} onChange={handleChange('owner_name')} />
          <TextField label={m('备注')} value={formState.note} onChange={handleChange('note')} multiline minRows={3} />

          <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
            <Button variant="text" onClick={resetForm} disabled={submitting}>
              {m('取消')}
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {isEditMode ? m('保存更新') : m('创建配置')}
            </Button>
          </Stack>
        </Stack>
      </Drawer>
    </Grid>
  );
}
