import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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
  archiveStationTask,
  assignStationTask,
  escalateStationTask,
  raiseStationTaskException,
  reworkStationTask,
  updateStationTask,
  useGetStationTaskDetail,
  useGetStationTaskList,
  useGetStationTaskOptions,
  verifyStationTask
} from 'api/station';

const PAGE_SIZE = 20;
const DEFAULT_RELATED_OBJECT_TYPE = 'Flight';
const EMPTY_FORM = {
  taskType: '',
  executionNode: '',
  relatedObjectType: DEFAULT_RELATED_OBJECT_TYPE,
  relatedObjectId: '',
  assignedRole: '',
  assignedTeamId: '',
  assignedWorkerId: '',
  taskSla: '',
  dueAt: '',
  blockerCode: '',
  evidenceRequired: false,
  archived: false
};
const EMPTY_EXCEPTION_FORM = {
  exceptionType: 'TaskIssue',
  severity: 'P2',
  ownerRole: '',
  ownerTeamId: '',
  blockerFlag: true,
  rootCause: '',
  actionTaken: '',
  note: ''
};

function buildFormState(detail) {
  if (!detail?.taskId) return EMPTY_FORM;

  return {
    taskType: detail.taskType || '',
    executionNode: detail.executionNode || '',
    relatedObjectType: detail.relatedObjectType || DEFAULT_RELATED_OBJECT_TYPE,
    relatedObjectId: detail.relatedObjectId || '',
    assignedRole: detail.assignedRole || '',
    assignedTeamId: detail.assignedTeamId || '',
    assignedWorkerId: detail.assignedWorkerId || '',
    taskSla: detail.taskSla || '',
    dueAt: detail.dueAt || '',
    blockerCode: detail.blockerCode || '',
    evidenceRequired: Boolean(detail.evidenceRequired),
    archived: Boolean(detail.archived)
  };
}

function buildExceptionForm(detail) {
  return {
    ...EMPTY_EXCEPTION_FORM,
    severity: detail?.taskPriority || 'P2',
    ownerRole: detail?.assignedRole || '',
    ownerTeamId: detail?.assignedTeamId || ''
  };
}

export default function StationTasksPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assignedRoleFilter, setAssignedRoleFilter] = useState('');
  const [taskTypeFilter, setTaskTypeFilter] = useState('');
  const [executionNodeFilter, setExecutionNodeFilter] = useState('');
  const [relatedObjectTypeFilter, setRelatedObjectTypeFilter] = useState('');
  const [relatedObjectIdFilter, setRelatedObjectIdFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionForm, setExceptionForm] = useState(EMPTY_EXCEPTION_FORM);

  const query = {
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    task_status: taskStatusFilter,
    task_priority: priorityFilter,
    assigned_role: assignedRoleFilter,
    task_type: taskTypeFilter,
    execution_node: executionNodeFilter,
    related_object_type: relatedObjectTypeFilter,
    related_object_id: relatedObjectIdFilter,
    include_archived: includeArchived
  };

  const { stationTaskRows, stationTaskPage, stationTaskSummaryCards, stationTaskListLoading, stationTaskListError } =
    useGetStationTaskList(query);
  const {
    taskStatusOptions,
    taskPriorityOptions,
    assignedRoleOptions,
    taskTypeOptions,
    executionNodeOptions,
    relatedObjectTypeOptions,
    relatedObjectOptions,
    teamOptions,
    workerOptions,
    stationTaskOptionsLoading
  } = useGetStationTaskOptions({
    related_object_type: drawerOpen ? formState.relatedObjectType : relatedObjectTypeFilter || DEFAULT_RELATED_OBJECT_TYPE
  });
  const { stationTaskDetail, stationTaskDetailLoading, stationTaskDetailError } = useGetStationTaskDetail(selectedTaskId || null);

  useEffect(() => {
    if (!stationTaskRows.length) {
      setSelectedTaskId('');
      return;
    }

    if (!selectedTaskId || !stationTaskRows.some((item) => item.id === selectedTaskId)) {
      setSelectedTaskId(stationTaskRows[0].id);
    }
  }, [selectedTaskId, stationTaskRows]);

  useEffect(() => {
    if (!drawerOpen) return;
    setFormState(buildFormState(stationTaskDetail));
  }, [drawerOpen, stationTaskDetail]);

  const relatedObjectLabelMap = useMemo(
    () => new Map(relatedObjectOptions.map((option) => [option.value, option.label])),
    [relatedObjectOptions]
  );
  const teamLabelMap = useMemo(() => new Map(teamOptions.map((option) => [option.value, option.label])), [teamOptions]);
  const workerLabelMap = useMemo(() => new Map(workerOptions.map((option) => [option.value, option.label])), [workerOptions]);

  const resetDrawer = () => {
    setDrawerOpen(false);
    setFormState(EMPTY_FORM);
  };

  const openEditPanel = (row) => {
    setSelectedTaskId(row.id);
    setFormState({
      taskType: row.taskType || '',
      executionNode: row.executionNode || '',
      relatedObjectType: row.relatedObjectType || DEFAULT_RELATED_OBJECT_TYPE,
      relatedObjectId: row.relatedObjectId || '',
      assignedRole: row.assignedRole || '',
      assignedTeamId: row.assignedTeamId || '',
      assignedWorkerId: row.assignedWorkerId || '',
      taskSla: row.taskSla || '',
      dueAt: row.dueAt || '',
      blockerCode: row.blocker !== '无' ? row.blocker : '',
      evidenceRequired: Boolean(row.evidenceRequired),
      archived: Boolean(row.archived)
    });
    setFeedback(null);
    setDrawerOpen(true);
  };

  const handleChange = (field) => (event) => {
    const nextValue = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormState((current) => ({ ...current, [field]: nextValue }));
  };

  const handleSave = async () => {
    if (!selectedTaskId) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      await updateStationTask(selectedTaskId, {
        task_type: formState.taskType,
        execution_node: formState.executionNode,
        related_object_type: formState.relatedObjectType,
        related_object_id: formState.relatedObjectId,
        assigned_role: formState.assignedRole || null,
        assigned_team_id: formState.assignedTeamId || null,
        assigned_worker_id: formState.assignedWorkerId || null,
        task_sla: formState.taskSla || null,
        due_at: formState.dueAt || null,
        blocker_code: formState.blockerCode || null,
        evidence_required: Boolean(formState.evidenceRequired),
        archived: Boolean(formState.archived)
      });
      setDrawerOpen(false);
      openSnackbar({
        open: true,
        message: `${selectedTaskId} ${m('已更新。')}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('任务保存失败，请稍后重试。')
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
        await updateStationTask(row.id, { archived: false });
        openSnackbar({
          open: true,
          message: `${row.id} ${m('已恢复。')}`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        await archiveStationTask(row.id);
        if (selectedTaskId === row.id) resetDrawer();
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
        message: error?.response?.data?.error?.message || m('任务归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTaskId || !formState.assignedRole) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      await assignStationTask(selectedTaskId, {
        assigned_role: formState.assignedRole,
        assigned_team_id: formState.assignedTeamId || undefined,
        assigned_worker_id: formState.assignedWorkerId || undefined,
        due_at: formState.dueAt || undefined,
        task_sla: formState.taskSla || undefined,
        reason: 'Assigned from task drawer'
      });
      openSnackbar({
        open: true,
        message: `${selectedTaskId} ${m('已分派。')}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('任务分派失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWorkflowAction = async (action) => {
    if (!selectedTaskId) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      if (action === 'verify') {
        await verifyStationTask(selectedTaskId, { note: 'Verified from task drawer' });
      } else if (action === 'rework') {
        await reworkStationTask(selectedTaskId, {
          note: 'Rework requested from task drawer',
          reason: 'Manual task rework'
        });
      } else if (action === 'escalate') {
        await escalateStationTask(selectedTaskId, {
          note: 'Escalated from task drawer',
          reason: 'Supervisor escalation'
        });
      }

      openSnackbar({
        open: true,
        message: `${selectedTaskId} ${m('已执行')} ${localizeUiText(locale, action)}。`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || `${localizeUiText(locale, action)} ${m('失败，请稍后重试。')}`
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openExceptionDialog = () => {
    setExceptionForm(buildExceptionForm(stationTaskDetail));
    setExceptionDialogOpen(true);
  };

  const submitException = async () => {
    if (!selectedTaskId || !exceptionForm.ownerRole) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      await raiseStationTaskException(selectedTaskId, {
        exception_type: exceptionForm.exceptionType,
        severity: exceptionForm.severity,
        blocker_flag: Boolean(exceptionForm.blockerFlag),
        owner_role: exceptionForm.ownerRole,
        owner_team_id: exceptionForm.ownerTeamId || undefined,
        root_cause: exceptionForm.rootCause || undefined,
        action_taken: exceptionForm.actionTaken || undefined,
        note: exceptionForm.note || undefined
      });
      setExceptionDialogOpen(false);
      openSnackbar({
        open: true,
        message: `${selectedTaskId} ${m('已上报异常。')}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('异常上报失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('任务台账')}
          title={m('作业指令中心')}
          description={m(
            'Tasks 已收口成正式数据库资源：列表、详情、元数据更新、归档/恢复和工作流动作都走真实对象链，页面不再以 overview 聚合壳当主真相。'
          )}
          chips={[m('数据库 CRUD'), m('每页 20 条'), m('数据库选项'), m('工作流动作'), m('软删除')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/shipments" variant="outlined">
                {m('履约链路')}
              </Button>
              <Button component={RouterLink} to="/station/exceptions" variant="outlined">
                {m('异常中心')}
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                {m('单证中心')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      {stationTaskSummaryCards.map((item) => (
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
        <MainCard title={m('任务台账')} subheader={m('任务列表已切到数据库分页；默认每页 20 条。')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                label={m('关键词')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 220 }}
                placeholder={m('任务类型 / 门槛 / 对象')}
              />
              <TextField
                select
                label={m('状态')}
                value={taskStatusFilter}
                onChange={(event) => {
                  setTaskStatusFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 160 }}
                disabled={stationTaskOptionsLoading}
              >
                <MenuItem value="">{m('全部状态')}</MenuItem>
                {taskStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('优先级')}
                value={priorityFilter}
                onChange={(event) => {
                  setPriorityFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 140 }}
                disabled={stationTaskOptionsLoading}
              >
                <MenuItem value="">{m('全部优先级')}</MenuItem>
                {taskPriorityOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('责任角色')}
                value={assignedRoleFilter}
                onChange={(event) => {
                  setAssignedRoleFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
                disabled={stationTaskOptionsLoading}
              >
                <MenuItem value="">{m('全部角色')}</MenuItem>
                {assignedRoleOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('任务类型')}
                value={taskTypeFilter}
                onChange={(event) => {
                  setTaskTypeFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
                disabled={stationTaskOptionsLoading}
              >
                <MenuItem value="">{m('全部任务类型')}</MenuItem>
                {taskTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('执行节点')}
                value={executionNodeFilter}
                onChange={(event) => {
                  setExecutionNodeFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
                disabled={stationTaskOptionsLoading}
              >
                <MenuItem value="">{m('全部节点')}</MenuItem>
                {executionNodeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                select
                label={m('关联对象类型')}
                value={relatedObjectTypeFilter}
                onChange={(event) => {
                  setRelatedObjectTypeFilter(event.target.value);
                  setRelatedObjectIdFilter('');
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
                disabled={stationTaskOptionsLoading}
              >
                <MenuItem value="">{m('全部对象类型')}</MenuItem>
                {relatedObjectTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('关联对象')}
                value={relatedObjectIdFilter}
                onChange={(event) => {
                  setRelatedObjectIdFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 280 }}
                disabled={stationTaskOptionsLoading}
              >
                <MenuItem value="">{m('全部对象')}</MenuItem>
                {relatedObjectOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
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
            {stationTaskListError ? <Alert severity="error">{m('任务台账加载失败，请检查后端连接。')}</Alert> : null}
            {stationTaskDetailError ? <Alert severity="error">{m('任务详情加载失败，请检查后端连接。')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('任务')}</TableCell>
                  <TableCell>{m('关联对象')}</TableCell>
                  <TableCell>{m('责任')}</TableCell>
                  <TableCell>{m('SLA / 截止')}</TableCell>
                  <TableCell>{m('优先级')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell>{m('异常')}</TableCell>
                  <TableCell>{m('归档')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stationTaskRows.map((item) => (
                  <TableRow key={item.id} hover selected={selectedTaskId === item.id}>
                    <TableCell>
                      <Stack>
                        <Typography variant="subtitle2">{localizeUiText(locale, item.title)}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {localizeUiText(locale, item.executionNode)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{localizeUiText(locale, item.relatedObjectLabel)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.relatedObjectType)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{item.owner}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.assignedRole || '--')}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{item.taskSla || '--'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.due || '--'}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.priority || 'P3')} />
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.status)} />
                    </TableCell>
                    <TableCell>{item.openExceptionCount}</TableCell>
                    <TableCell>{item.archived ? m('已归档') : m('运行中')}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Button size="small" variant="outlined" onClick={() => openEditPanel(item)}>
                          {m('编辑')}
                        </Button>
                        <Button size="small" variant="outlined" component={RouterLink} to={item.objectTo}>
                          {m('对象')}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color={item.archived ? 'success' : 'warning'}
                          onClick={() => handleArchiveToggle(item)}
                          disabled={submitting}
                        >
                          {item.archived ? m('恢复') : m('归档')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!stationTaskRows.length && !stationTaskListLoading ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前筛选条件下没有任务记录。')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={stationTaskPage.total}
              page={Math.max(0, Number(stationTaskPage.page || 1) - 1)}
              onPageChange={(_event, nextPage) => setPage(nextPage)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          </Stack>
        </MainCard>
      </Grid>

      <Drawer anchor="right" open={drawerOpen} onClose={resetDrawer}>
        <Box sx={{ width: { xs: '100vw', sm: 560 }, p: 3 }}>
          <Stack sx={{ gap: 2 }}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Task Resource
              </Typography>
              <Typography variant="h4">
                {localizeUiText(locale, stationTaskDetail?.taskType || formState.taskType || selectedTaskId || m('任务详情'))}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m('任务对象已切到数据库资源：元数据更新与归档走资源接口，分派/复核/返工/升级继续走工作流动作。')}
              </Typography>
            </Box>

            {stationTaskDetailLoading ? <Alert severity="info">{m('任务详情加载中…')}</Alert> : null}
            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

            <TextField
              select
              label={m('任务类型')}
              value={formState.taskType}
              onChange={handleChange('taskType')}
              disabled={stationTaskOptionsLoading}
            >
              {taskTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('执行节点')}
              value={formState.executionNode}
              onChange={handleChange('executionNode')}
              disabled={stationTaskOptionsLoading}
            >
              {executionNodeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('关联对象类型')}
              value={formState.relatedObjectType}
              onChange={(event) => {
                setFormState((current) => ({
                  ...current,
                  relatedObjectType: event.target.value,
                  relatedObjectId: ''
                }));
              }}
              disabled={stationTaskOptionsLoading}
            >
              {relatedObjectTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('关联对象')}
              value={formState.relatedObjectId}
              onChange={handleChange('relatedObjectId')}
              disabled={stationTaskOptionsLoading}
              helperText={localizeUiText(locale, relatedObjectLabelMap.get(formState.relatedObjectId)) || m('请选择真实数据库对象')}
            >
              {relatedObjectOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('责任角色')}
              value={formState.assignedRole}
              onChange={handleChange('assignedRole')}
              disabled={stationTaskOptionsLoading}
            >
              {assignedRoleOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('责任班组')}
              value={formState.assignedTeamId}
              onChange={handleChange('assignedTeamId')}
              disabled={stationTaskOptionsLoading}
              helperText={localizeUiText(locale, teamLabelMap.get(formState.assignedTeamId)) || ''}
            >
              <MenuItem value="">{m('未分配')}</MenuItem>
              {teamOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('责任人员')}
              value={formState.assignedWorkerId}
              onChange={handleChange('assignedWorkerId')}
              disabled={stationTaskOptionsLoading}
              helperText={localizeUiText(locale, workerLabelMap.get(formState.assignedWorkerId)) || ''}
            >
              <MenuItem value="">{m('未分配')}</MenuItem>
              {workerOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={m('SLA')} value={formState.taskSla} onChange={handleChange('taskSla')} />
            <TextField label={m('截止时间')} value={formState.dueAt} onChange={handleChange('dueAt')} />
            <TextField label={m('阻断码')} value={formState.blockerCode} onChange={handleChange('blockerCode')} />

            <FormControlLabel
              control={<Switch checked={Boolean(formState.evidenceRequired)} onChange={handleChange('evidenceRequired')} />}
              label={m('要求上传证据')}
            />
            <FormControlLabel
              control={<Switch checked={Boolean(formState.archived)} onChange={handleChange('archived')} />}
              label={m('标记为已归档')}
            />

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <StatusChip label={localizeUiText(locale, stationTaskDetail?.taskStatus || '—')} />
              <StatusChip label={localizeUiText(locale, stationTaskDetail?.taskPriority || 'P3')} />
              <StatusChip label={stationTaskDetail?.archived ? m('已归档') : m('运行中')} />
            </Stack>

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={handleSave} disabled={submitting}>
                {m('保存任务')}
              </Button>
              <Button
                variant="outlined"
                onClick={handleAssign}
                disabled={submitting || !stationTaskDetail?.lifecycle?.can_assign || !formState.assignedRole}
              >
                {m('分派')}
              </Button>
              <Button
                variant="outlined"
                color="success"
                onClick={() => handleWorkflowAction('verify')}
                disabled={submitting || !stationTaskDetail?.lifecycle?.can_verify}
              >
                {m('复核')}
              </Button>
              <Button
                variant="outlined"
                color="warning"
                onClick={() => handleWorkflowAction('rework')}
                disabled={submitting || !stationTaskDetail?.lifecycle?.can_rework}
              >
                {m('返工')}
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => handleWorkflowAction('escalate')}
                disabled={submitting || !stationTaskDetail?.lifecycle?.can_escalate}
              >
                {m('升级')}
              </Button>
              <Button
                variant="outlined"
                onClick={openExceptionDialog}
                disabled={submitting || !stationTaskDetail?.lifecycle?.can_raise_exception}
              >
                {m('上报异常')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>

      <Dialog open={exceptionDialogOpen} onClose={() => setExceptionDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{m('上报异常')}</DialogTitle>
        <DialogContent dividers>
          <Stack sx={{ gap: 1.5, pt: 0.5 }}>
            <TextField
              label={m('异常类型')}
              value={exceptionForm.exceptionType}
              onChange={(event) => setExceptionForm((current) => ({ ...current, exceptionType: event.target.value }))}
            />
            <TextField
              select
              label={m('严重等级')}
              value={exceptionForm.severity}
              onChange={(event) => setExceptionForm((current) => ({ ...current, severity: event.target.value }))}
            >
              {taskPriorityOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('负责人角色')}
              value={exceptionForm.ownerRole}
              onChange={(event) => setExceptionForm((current) => ({ ...current, ownerRole: event.target.value }))}
            >
              {assignedRoleOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('负责人班组')}
              value={exceptionForm.ownerTeamId}
              onChange={(event) => setExceptionForm((current) => ({ ...current, ownerTeamId: event.target.value }))}
            >
              <MenuItem value="">{m('未指定')}</MenuItem>
              {teamOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(exceptionForm.blockerFlag)}
                  onChange={(event) => setExceptionForm((current) => ({ ...current, blockerFlag: event.target.checked }))}
                />
              }
              label={m('作为阻断异常')}
            />
            <TextField
              label={m('根因')}
              multiline
              minRows={2}
              value={exceptionForm.rootCause}
              onChange={(event) => setExceptionForm((current) => ({ ...current, rootCause: event.target.value }))}
            />
            <TextField
              label={m('已采取动作')}
              multiline
              minRows={2}
              value={exceptionForm.actionTaken}
              onChange={(event) => setExceptionForm((current) => ({ ...current, actionTaken: event.target.value }))}
            />
            <TextField
              label={m('备注')}
              multiline
              minRows={2}
              value={exceptionForm.note}
              onChange={(event) => setExceptionForm((current) => ({ ...current, note: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExceptionDialogOpen(false)}>{m('取消')}</Button>
          <Button onClick={submitException} variant="contained" disabled={submitting || !exceptionForm.ownerRole}>
            {m('提交')}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
