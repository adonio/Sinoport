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
  archivePlatformMasterData,
  createPlatformMasterData,
  updatePlatformMasterData,
  useGetPlatformMasterData,
  useGetPlatformMasterDataDetail,
  useGetPlatformMasterDataOptions
} from 'api/platform';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  master_data_id: '',
  object_name: '',
  object_type: '',
  source_type: '',
  governance_status: '',
  primary_key_rule: '',
  owner_name: '',
  note: ''
};

function buildFormState(record) {
  if (!record) {
    return EMPTY_FORM;
  }

  return {
    master_data_id: record.master_data_id || record.id || record.code || '',
    object_name: record.object_name || record.object || record.name || '',
    object_type: record.object_type || record.type_key || '',
    source_type: record.source_type || record.source_key || '',
    governance_status: record.governance_status || record.status_key || '',
    primary_key_rule: record.primary_key_rule || record.key_rule || record.keyRule || '',
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

export default function PlatformMasterDataPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [activeMasterDataId, setActiveMasterDataId] = useState('');
  const [selectedMasterData, setSelectedMasterData] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { types, sources, statuses, masterDataOptionsLoading } = useGetPlatformMasterDataOptions();
  const {
    masterDataRows,
    masterDataPage,
    masterDataTypeSummaryRows,
    masterDataSourceSummaryRows,
    masterDataStatusSummaryRows,
    masterDataLoading,
    masterDataError
  } = useGetPlatformMasterData({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    type: typeFilter,
    source: sourceFilter,
    status: statusFilter,
    include_archived: includeArchived
  });
  const { masterData, masterDataDetailLoading, masterDataDetailError } = useGetPlatformMasterDataDetail(
    formOpen && activeMasterDataId ? activeMasterDataId : null
  );

  useEffect(() => {
    if (!formOpen || activeMasterDataId || formState.governance_status || !statuses.length) {
      return;
    }

    setFormState((current) => ({
      ...current,
      governance_status: getPreferredOptionValue(statuses, 'active')
    }));
  }, [activeMasterDataId, formOpen, formState.governance_status, statuses]);

  useEffect(() => {
    if (!masterData) {
      return;
    }

    setSelectedMasterData(masterData);
    setFormState(buildFormState(masterData));
  }, [masterData]);

  useEffect(() => {
    if (!activeMasterDataId) {
      return;
    }

    const matched = masterDataRows.find((item) => item.master_data_id === activeMasterDataId);
    if (matched) {
      setSelectedMasterData((current) => (current?.updated_at === matched.updated_at ? current : { ...current, ...matched }));
    }
  }, [activeMasterDataId, masterDataRows]);

  const tableRows = masterDataPage?.items || masterDataRows;
  const total = masterDataPage?.total || tableRows.length;
  const currentPage = Math.max(0, (masterDataPage?.page || 1) - 1);
  const isEditMode = Boolean(activeMasterDataId);
  const canSubmit = useMemo(
    () =>
      Boolean(
        formState.master_data_id &&
          formState.object_name &&
          formState.object_type &&
          formState.source_type &&
          formState.governance_status &&
          formState.primary_key_rule &&
          formState.owner_name
      ),
    [formState]
  );

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;

    setFormState((current) => ({
      ...current,
      [field]: field === 'master_data_id' ? String(nextValue).toUpperCase() : nextValue
    }));
  };

  const resetForm = () => {
    setActiveMasterDataId('');
    setSelectedMasterData(null);
    setFormState({
      ...EMPTY_FORM,
      governance_status: getPreferredOptionValue(statuses, 'active')
    });
    setFormOpen(false);
    setFeedback(null);
  };

  const openCreatePanel = () => {
    setActiveMasterDataId('');
    setSelectedMasterData(null);
    setFormState({
      ...EMPTY_FORM,
      governance_status: getPreferredOptionValue(statuses, 'active')
    });
    setFeedback(null);
    setFormOpen(true);
  };

  const openEditPanel = (record) => {
    setActiveMasterDataId(record.master_data_id);
    setSelectedMasterData(record);
    setFormState(buildFormState(record));
    setFeedback(null);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFeedback({
        severity: 'error',
        message: m('请先补齐主数据编码、对象名称、类型、来源、状态、主键规则和 Owner。')
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (isEditMode) {
        const detail = await updatePlatformMasterData(activeMasterDataId, formState);
        setSelectedMasterData(detail?.masterData || selectedMasterData);
        setFeedback({ severity: 'success', message: localizeUiText(locale, `主数据 ${activeMasterDataId} 已更新。`) });
      } else {
        const detail = await createPlatformMasterData(formState);
        setSelectedMasterData(detail?.masterData || null);
        setFeedback({ severity: 'success', message: `${m('新建主数据')} ${formState.master_data_id}` });
      }

      setFormOpen(false);
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('主数据保存失败，请稍后重试。')
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
        await updatePlatformMasterData(record.master_data_id, { archived: false });
        setFeedback({ severity: 'success', message: localizeUiText(locale, `主数据 ${record.master_data_id} 已恢复。`) });
      } else {
        await archivePlatformMasterData(record.master_data_id);
        if (activeMasterDataId === record.master_data_id) {
          resetForm();
        }
        setFeedback({ severity: 'success', message: localizeUiText(locale, `主数据 ${record.master_data_id} 已归档。`) });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('主数据归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Master Data Registry"
          title={m('主数据与接口治理')}
          description={m('主数据台账已切到正式数据库 CRUD；列表默认后端分页 20 条，筛选与表单下拉全部来自 DB options，新建/编辑统一走右侧 Drawer。')}
          chips={['DB CRUD', 'DB Options', '20/page', 'Drawer Editor']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/master-data/sync" variant="outlined">
                {m('同步看板')}
              </Button>
              <Button component={RouterLink} to="/platform/master-data/jobs" variant="outlined">
                {m('导入任务')}
              </Button>
              <Button component={RouterLink} to="/platform/master-data/relationships" variant="outlined">
                {m('对象关系')}
              </Button>
              <Button component={RouterLink} to="/platform/audit" variant="outlined">
                {m('审计与可信留痕')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('主数据台账')} subheader={m('主读源已切正式 `platform_master_data`；legacy sync/jobs/relationships 兼容 payload 保留在各自页面。')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2, alignItems: { lg: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('编码 / 对象名称 / 主键规则 / Owner / 备注')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <TextField
                select
                label={m('类型')}
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
                label={m('来源')}
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部来源')}</MenuItem>
                {sources.map((option) => (
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
                  {m('新建主数据')}
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
            {masterDataError ? <Alert severity="error">{m('主数据台账加载失败，请检查后端连接。')}</Alert> : null}
            {masterDataOptionsLoading ? <Alert severity="info">{m('正在从数据库加载主数据选项…')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('编码')}</TableCell>
                  <TableCell>{m('对象')}</TableCell>
                  <TableCell>{m('类型')}</TableCell>
                  <TableCell>{m('来源')}</TableCell>
                  <TableCell>{m('主键规则')}</TableCell>
                  <TableCell>{localizeUiText(locale, 'Owner')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell>{m('更新时间')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((record) => (
                  <TableRow
                    key={record.master_data_id}
                    hover
                    selected={selectedMasterData?.master_data_id === record.master_data_id}
                  >
                    <TableCell>
                      <Typography variant="subtitle2">{record.master_data_id}</Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Stack sx={{ gap: 0.5 }}>
                        <Typography variant="subtitle2">{localizeUiText(locale, record.object_name)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, record.note || m('暂无补充说明'))}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{localizeUiText(locale, record.type)}</TableCell>
                    <TableCell>{localizeUiText(locale, record.source)}</TableCell>
                    <TableCell sx={{ minWidth: 220 }}>{localizeUiText(locale, record.primary_key_rule)}</TableCell>
                    <TableCell>{record.owner_name}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, record.status)} />
                    </TableCell>
                    <TableCell>{record.updated_at ? String(record.updated_at).replace('T', ' ').slice(0, 16) : '--'}</TableCell>
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
                {!masterDataLoading && !tableRows.length ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前筛选条件下没有主数据记录。')}
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

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title={m('类型分布')} subheader={m('来自正式表聚合。')}>
          <Stack sx={{ gap: 1.5 }}>
            {masterDataTypeSummaryRows.map((item) => (
              <Stack key={item.type_key} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">{localizeUiText(locale, item.type)}</Typography>
                <Typography variant="subtitle2">{item.count}</Typography>
              </Stack>
            ))}
            {!masterDataTypeSummaryRows.length ? (
              <Typography variant="body2" color="text.secondary">
                {m('暂无类型聚合数据。')}
              </Typography>
            ) : null}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title={m('来源分布')} subheader={m('用于核对主读来源切换。')}>
          <Stack sx={{ gap: 1.5 }}>
            {masterDataSourceSummaryRows.map((item) => (
              <Stack key={item.source_key} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">{localizeUiText(locale, item.source)}</Typography>
                <Typography variant="subtitle2">{item.count}</Typography>
              </Stack>
            ))}
            {!masterDataSourceSummaryRows.length ? (
              <Typography variant="body2" color="text.secondary">
                {m('暂无来源聚合数据。')}
              </Typography>
            ) : null}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title={m('状态分布')} subheader={m('运行中 / 警戒 / 待处理由 DB options 统一维护。')}>
          <Stack sx={{ gap: 1.5 }}>
            {masterDataStatusSummaryRows.map((item) => (
              <Stack key={item.status_key} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">{localizeUiText(locale, item.status)}</Typography>
                <Typography variant="subtitle2">{item.count}</Typography>
              </Stack>
            ))}
            {!masterDataStatusSummaryRows.length ? (
              <Typography variant="body2" color="text.secondary">
                {m('暂无状态聚合数据。')}
              </Typography>
            ) : null}
          </Stack>
        </MainCard>
      </Grid>

      <Drawer anchor="right" open={formOpen} onClose={resetForm}>
        <Box sx={{ width: { xs: '100vw', sm: 520 }, p: 3 }}>
          <Stack sx={{ gap: 2.5 }}>
            <Stack sx={{ gap: 0.5 }}>
              <Typography variant="h4">{isEditMode ? m('编辑主数据') : m('新建主数据')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {isEditMode
                  ? localizeUiText(locale, `当前记录：${activeMasterDataId}${masterDataDetailLoading ? '，正在刷新详情…' : ''}`)
                  : m('新增记录会直接写入正式表并生成审计事件。')}
              </Typography>
            </Stack>

            {masterDataDetailError ? <Alert severity="error">{m('主数据详情加载失败，将继续使用列表中的已知字段。')}</Alert> : null}

            <TextField
              label={m('主数据编码')}
              value={formState.master_data_id}
              onChange={handleChange('master_data_id')}
              disabled={isEditMode}
              placeholder={m('例如 MD-FLIGHT')}
              fullWidth
            />
            <TextField label={m('对象名称')} value={formState.object_name} onChange={handleChange('object_name')} fullWidth />
            <TextField
              select
              label={m('类型')}
              value={formState.object_type}
              onChange={handleChange('object_type')}
              fullWidth
            >
              <MenuItem value="">{m('请选择类型')}</MenuItem>
              {types.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('来源')}
              value={formState.source_type}
              onChange={handleChange('source_type')}
              fullWidth
            >
              <MenuItem value="">{m('请选择来源')}</MenuItem>
              {sources.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('状态')}
              value={formState.governance_status}
              onChange={handleChange('governance_status')}
              fullWidth
            >
              <MenuItem value="">{m('请选择状态')}</MenuItem>
              {statuses.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={m('主键规则')}
              value={formState.primary_key_rule}
              onChange={handleChange('primary_key_rule')}
              placeholder={localizeUiText(locale, '例如 Flight No + Flight Date + Station')}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label={localizeUiText(locale, 'Owner')}
              value={formState.owner_name}
              onChange={handleChange('owner_name')}
              placeholder={localizeUiText(locale, '例如 Platform Data Owner')}
              fullWidth
            />
            <TextField
              label={m('备注')}
              value={formState.note}
              onChange={handleChange('note')}
              fullWidth
              multiline
              minRows={3}
            />

            {selectedMasterData?.updated_at ? (
              <Typography variant="caption" color="text.secondary">
                {m('最近更新时间：')}{String(selectedMasterData.updated_at).replace('T', ' ').slice(0, 16)}
              </Typography>
            ) : null}

            <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1.5 }}>
              <Button variant="text" onClick={resetForm}>
                {m('取消')}
              </Button>
              <Button variant="contained" onClick={handleSubmit} disabled={submitting || !canSubmit}>
                {submitting ? m('提交中…') : isEditMode ? m('保存更新') : m('创建记录')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </Grid>
  );
}
