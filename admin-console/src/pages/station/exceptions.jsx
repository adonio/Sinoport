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
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { openSnackbar } from 'api/snackbar';
import {
  archiveStationException,
  resolveStationException,
  updateStationException,
  useGetStationExceptionDetail,
  useGetStationExceptionList,
  useGetStationExceptionOptions
} from 'api/station';

const PAGE_SIZE = 20;
const DEFAULT_RELATED_OBJECT_TYPE = 'AWB';
const EMPTY_FORM = {
  exceptionType: '',
  severity: 'P2',
  ownerRole: '',
  ownerTeamId: '',
  relatedObjectType: DEFAULT_RELATED_OBJECT_TYPE,
  relatedObjectId: '',
  exceptionStatus: 'Open',
  blockerFlag: true,
  rootCause: '',
  actionTaken: '',
  archived: false
};

function buildFormState(detail) {
  if (!detail?.exception_id) return EMPTY_FORM;

  return {
    exceptionType: detail.exception_type || '',
    severity: detail.severity || 'P2',
    ownerRole: detail.owner_role || '',
    ownerTeamId: detail.owner_team_id || '',
    relatedObjectType: detail.related_object_type || DEFAULT_RELATED_OBJECT_TYPE,
    relatedObjectId: detail.related_object_id || '',
    exceptionStatus: detail.exception_status || 'Open',
    blockerFlag: Boolean(detail.blocker_flag),
    rootCause: detail.root_cause || '',
    actionTaken: detail.action_taken || '',
    archived: Boolean(detail.archived)
  };
}

export default function StationExceptionsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [exceptionTypeFilter, setExceptionTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [exceptionStatusFilter, setExceptionStatusFilter] = useState('');
  const [ownerRoleFilter, setOwnerRoleFilter] = useState('');
  const [relatedObjectTypeFilter, setRelatedObjectTypeFilter] = useState('');
  const [relatedObjectIdFilter, setRelatedObjectIdFilter] = useState('');
  const [blockerStateFilter, setBlockerStateFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedExceptionId, setSelectedExceptionId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const query = {
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    exception_type: exceptionTypeFilter,
    severity: severityFilter,
    exception_status: exceptionStatusFilter,
    owner_role: ownerRoleFilter,
    related_object_type: relatedObjectTypeFilter,
    related_object_id: relatedObjectIdFilter,
    blocker_state: blockerStateFilter,
    include_archived: includeArchived
  };

  const {
    stationExceptionRows,
    stationExceptionPage,
    stationExceptionSummaryCards,
    stationExceptionListLoading,
    stationExceptionListError
  } = useGetStationExceptionList(query);
  const {
    exceptionTypeOptions,
    severityOptions,
    exceptionStatusOptions,
    ownerRoleOptions,
    relatedObjectTypeOptions,
    relatedObjectOptions,
    teamOptions,
    blockerStateOptions
  } = useGetStationExceptionOptions({
    related_object_type: drawerOpen ? formState.relatedObjectType : relatedObjectTypeFilter || DEFAULT_RELATED_OBJECT_TYPE
  });
  const { stationExceptionDetail, stationExceptionDetailLoading, stationExceptionDetailError } = useGetStationExceptionDetail(
    selectedExceptionId || null
  );

  useEffect(() => {
    if (!stationExceptionRows.length) {
      setSelectedExceptionId('');
      return;
    }

    if (!selectedExceptionId || !stationExceptionRows.some((item) => item.id === selectedExceptionId)) {
      setSelectedExceptionId(stationExceptionRows[0].id);
    }
  }, [selectedExceptionId, stationExceptionRows]);

  useEffect(() => {
    if (!drawerOpen) return;
    setFormState(buildFormState(stationExceptionDetail));
  }, [drawerOpen, stationExceptionDetail]);

  const relatedObjectLabelMap = useMemo(
    () => new Map(relatedObjectOptions.map((option) => [option.value, option.label])),
    [relatedObjectOptions]
  );
  const teamLabelMap = useMemo(() => new Map(teamOptions.map((option) => [option.value, option.label])), [teamOptions]);

  const openEditPanel = (row) => {
    setSelectedExceptionId(row.id);
    setFeedback(null);
    setDrawerOpen(true);
  };

  const resetDrawer = () => {
    setDrawerOpen(false);
    setFormState(EMPTY_FORM);
    setFeedback(null);
  };

  const handleChange = (field) => (event) => {
    const nextValue = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormState((current) => ({
      ...current,
      [field]: nextValue,
      ...(field === 'relatedObjectType' ? { relatedObjectId: '' } : {})
    }));
  };

  const handleSave = async () => {
    if (!selectedExceptionId) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      await updateStationException(selectedExceptionId, {
        exception_type: formState.exceptionType,
        severity: formState.severity,
        owner_role: formState.ownerRole || null,
        owner_team_id: formState.ownerTeamId || null,
        related_object_type: formState.relatedObjectType,
        related_object_id: formState.relatedObjectId,
        exception_status: formState.exceptionStatus,
        blocker_flag: Boolean(formState.blockerFlag),
        root_cause: formState.rootCause || null,
        action_taken: formState.actionTaken || null,
        archived: Boolean(formState.archived)
      });
      resetDrawer();
      openSnackbar({
        open: true,
        message: `${selectedExceptionId} ${m('已更新。')}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('异常保存失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (row) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      if (row.archived) {
        await updateStationException(row.id, { archived: false });
        openSnackbar({
          open: true,
          message: `${row.id} ${m('已恢复。')}`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        await archiveStationException(row.id);
        if (selectedExceptionId === row.id) resetDrawer();
        openSnackbar({
          open: true,
          message: `${row.id} ${m('已归档。')}`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('异常归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (row) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await resolveStationException(row.id, {
        note: 'Resolved from exception center',
        resolution: row.rootCause || row.actionTaken || 'Resolved from exception center'
      });
      openSnackbar({
        open: true,
        message: `${row.id} ${m('已恢复。')}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('异常恢复失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('异常中心')}
          title={m('异常中心')}
          description={m('异常列表、筛选、详情和编辑全部已切真实数据库读源；资源更新与归档边界和 resolve 工作流分开管理。')}
          chips={[m('数据库读源'), m('软删除'), m('恢复流程'), m('每页 20 条')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                {m('查看任务池')}
              </Button>
              <Button component={RouterLink} to="/station/shipments" variant="outlined">
                {m('履约链路')}
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                {m('单证中心')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      {stationExceptionSummaryCards.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            {...item}
            title={localizeUiText(locale, item.title)}
            helper={localizeUiText(locale, item.helper)}
            chip={localizeUiText(locale, item.chip)}
          />
        </Grid>
      ))}

      <Grid size={12}>
        <MainCard title={m('异常列表')}>
          <Stack sx={{ gap: 2 }}>
            {stationExceptionListError ? <Alert severity="error">{m('异常列表加载失败。')}</Alert> : null}
            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  label={m('关键字')}
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(0);
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  label={m('异常类型')}
                  value={exceptionTypeFilter}
                  onChange={(event) => {
                    setExceptionTypeFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">{m('全部')}</MenuItem>
                  {exceptionTypeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                      {localizeUiText(locale, option.label)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  select
                  fullWidth
                  label={m('优先级')}
                  value={severityFilter}
                  onChange={(event) => {
                    setSeverityFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">{m('全部')}</MenuItem>
                  {severityOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                      {localizeUiText(locale, option.label)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  select
                  fullWidth
                  label={m('状态')}
                  value={exceptionStatusFilter}
                  onChange={(event) => {
                    setExceptionStatusFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">{m('全部')}</MenuItem>
                  {exceptionStatusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                      {localizeUiText(locale, option.label)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  select
                  fullWidth
                  label={m('阻断状态')}
                  value={blockerStateFilter}
                  onChange={(event) => {
                    setBlockerStateFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">{m('全部')}</MenuItem>
                  {blockerStateOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                      {localizeUiText(locale, option.label)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  label={m('责任角色')}
                  value={ownerRoleFilter}
                  onChange={(event) => {
                    setOwnerRoleFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">{m('全部')}</MenuItem>
                  {ownerRoleOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                      {localizeUiText(locale, option.label)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  label={m('关联对象类型')}
                  value={relatedObjectTypeFilter}
                  onChange={(event) => {
                    setRelatedObjectTypeFilter(event.target.value);
                    setRelatedObjectIdFilter('');
                    setPage(0);
                  }}
                >
                  <MenuItem value="">{m('全部')}</MenuItem>
                  {relatedObjectTypeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                      {localizeUiText(locale, option.label)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  label={m('关联对象')}
                  value={relatedObjectIdFilter}
                  onChange={(event) => {
                    setRelatedObjectIdFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">{m('全部')}</MenuItem>
                  {relatedObjectOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                      {localizeUiText(locale, option.label)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Stack sx={{ height: '100%', justifyContent: 'center' }}>
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
                    label={m('含归档')}
                  />
                </Stack>
              </Grid>
            </Grid>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('异常编号')}</TableCell>
                  <TableCell>{m('类型')}</TableCell>
                  <TableCell>{m('关联对象')}</TableCell>
                  <TableCell>{m('负责人')}</TableCell>
                  <TableCell>{m('SLA')}</TableCell>
                  <TableCell>{m('阻断')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell>{m('归档')}</TableCell>
                  <TableCell align="right">{m('动作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stationExceptionRows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>{localizeUiText(locale, row.type)}</TableCell>
                    <TableCell>{localizeUiText(locale, row.object)}</TableCell>
                    <TableCell>{localizeUiText(locale, row.owner)}</TableCell>
                    <TableCell>{localizeUiText(locale, row.severity)}</TableCell>
                    <TableCell>{row.blockerFlag ? m('阻断中') : m('未阻断')}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, row.status)} />
                    </TableCell>
                    <TableCell>{row.archived ? m('已归档') : m('有效')}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                        <Button size="small" variant="outlined" onClick={() => openEditPanel(row)}>
                          {m('编辑')}
                        </Button>
                        <Button component={RouterLink} to={row.detailTo} size="small" variant="outlined">
                          {m('详情')}
                        </Button>
                        <Button component={RouterLink} to={row.objectTo} size="small" variant="outlined">
                          {m('对象')}
                        </Button>
                        {!row.archived && !['Resolved', 'Closed'].includes(row.status) ? (
                          <Button size="small" variant="contained" onClick={() => handleResolve(row)}>
                            {m('恢复')}
                          </Button>
                        ) : null}
                        <Button size="small" variant="outlined" onClick={() => handleArchiveToggle(row)}>
                          {row.archived ? m('恢复') : m('归档')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!stationExceptionRows.length && !stationExceptionListLoading ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography color="text.secondary" variant="body2">
                        {m('当前筛选下没有异常。')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={stationExceptionPage.total}
              page={Math.max(0, Number(stationExceptionPage.page || 1) - 1)}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
              onRowsPerPageChange={() => {}}
            />
          </Stack>
        </MainCard>
      </Grid>

      <Drawer anchor="right" open={drawerOpen} onClose={resetDrawer}>
        <Box sx={{ width: { xs: '100vw', sm: 520 }, p: 3 }}>
          <Stack sx={{ gap: 2.5 }}>
            <Box>
              <Typography variant="h3">
                {m('编辑异常')} / {selectedExceptionId || '--'}
              </Typography>
              <Typography color="text.secondary" variant="body1">
                {m('表单字段已切到真实数据库写入，异常状态的最终恢复仍需走 resolve 工作流。')}
              </Typography>
            </Box>

            {stationExceptionDetailLoading ? <Alert severity="info">{m('正在加载异常详情…')}</Alert> : null}
            {stationExceptionDetailError ? <Alert severity="error">{m('异常详情加载失败。')}</Alert> : null}
            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

            <TextField select fullWidth label={m('异常类型')} value={formState.exceptionType} onChange={handleChange('exceptionType')}>
              {exceptionTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>

            <TextField select fullWidth label={m('优先级')} value={formState.severity} onChange={handleChange('severity')}>
              {severityOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>

            <TextField select fullWidth label={m('责任角色')} value={formState.ownerRole} onChange={handleChange('ownerRole')}>
              {ownerRoleOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>

            <TextField select fullWidth label={m('责任班组')} value={formState.ownerTeamId} onChange={handleChange('ownerTeamId')}>
              <MenuItem value="">{m('未指定')}</MenuItem>
              {teamOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label={m('关联对象类型')}
              value={formState.relatedObjectType}
              onChange={handleChange('relatedObjectType')}
            >
              {relatedObjectTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>

            <TextField select fullWidth label={m('关联对象')} value={formState.relatedObjectId} onChange={handleChange('relatedObjectId')}>
              {relatedObjectOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>

            <TextField select fullWidth label={m('资源状态')} value={formState.exceptionStatus} onChange={handleChange('exceptionStatus')}>
              {exceptionStatusOptions
                .filter((option) => !['Resolved', 'Closed'].includes(option.value))
                .map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
            </TextField>

            <TextField fullWidth multiline minRows={3} label={m('根因')} value={formState.rootCause} onChange={handleChange('rootCause')} />

            <TextField
              fullWidth
              multiline
              minRows={3}
              label={m('当前处置')}
              value={formState.actionTaken}
              onChange={handleChange('actionTaken')}
            />

            <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<Switch checked={formState.blockerFlag} onChange={handleChange('blockerFlag')} />}
                label={m('阻断主链')}
              />
              <FormControlLabel
                control={<Switch checked={formState.archived} onChange={handleChange('archived')} />}
                label={m('归档异常')}
              />
            </Stack>

            <MainCard content={false} sx={{ border: '1px dashed', borderColor: 'divider' }}>
              <Box sx={{ p: 2 }}>
                <Typography variant="subtitle1">{m('当前关联对象')}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {localizeUiText(
                    locale,
                    relatedObjectLabelMap.get(formState.relatedObjectId) || stationExceptionDetail?.related_object_label || '--'
                  )}
                </Typography>
                <Typography sx={{ mt: 1 }} variant="subtitle1">
                  {m('当前责任班组')}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {localizeUiText(locale, teamLabelMap.get(formState.ownerTeamId) || stationExceptionDetail?.owner_team_id || '--')}
                </Typography>
              </Box>
            </MainCard>

            <Stack direction="row" sx={{ gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={resetDrawer}>
                {m('取消')}
              </Button>
              {selectedExceptionId && !['Resolved', 'Closed'].includes(stationExceptionDetail?.exception_status || '') ? (
                <Button
                  variant="outlined"
                  onClick={() =>
                    handleResolve({ id: selectedExceptionId, rootCause: formState.rootCause, actionTaken: formState.actionTaken })
                  }
                >
                  {m('恢复异常')}
                </Button>
              ) : null}
              <Button variant="contained" onClick={handleSave} disabled={submitting || !selectedExceptionId}>
                {m('保存异常')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </Grid>
  );
}
