import { useMemo, useState } from 'react';
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
  archivePlatformMasterDataJob,
  replayPlatformMasterDataJob,
  retryPlatformMasterDataJob,
  useGetPlatformMasterDataJobDetail,
  useGetPlatformMasterDataJobOptions,
  useGetPlatformMasterDataJobs
} from 'api/platform';

const PAGE_SIZE = 20;

function formatDateTime(value) {
  return value ? String(value).replace('T', ' ').slice(0, 16) : '--';
}

export default function PlatformMasterDataJobsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [objectFilter, setObjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [activeJobId, setActiveJobId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { sources, objects, statuses, actions, masterDataJobOptionsLoading } = useGetPlatformMasterDataJobOptions();
  const { jobRows, jobPage, masterDataJobsLoading, masterDataJobsError } = useGetPlatformMasterDataJobs({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    source_key: sourceFilter,
    object_type: objectFilter,
    job_status: statusFilter,
    action: actionFilter,
    include_archived: includeArchived
  });
  const { job, masterDataJobDetailLoading, masterDataJobDetailError } = useGetPlatformMasterDataJobDetail(
    detailOpen && activeJobId ? activeJobId : null
  );

  const actionLabelMap = useMemo(
    () => new Map(actions.map((item) => [item.value, item.label])),
    [actions]
  );
  const tableRows = jobPage?.items || jobRows;
  const total = jobPage?.total || tableRows.length;
  const currentPage = Math.max(0, (jobPage?.page || 1) - 1);
  const selectedJob = job || tableRows.find((item) => item.job_id === activeJobId) || null;

  const openDetail = (record) => {
    setActiveJobId(record.job_id);
    setDetailOpen(true);
    setFeedback(null);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setActiveJobId('');
  };

  const handleAction = async (actionName, jobId) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (actionName === 'retry') {
        await retryPlatformMasterDataJob(jobId);
        setFeedback({ severity: 'success', message: `${localizeUiText(locale, actionLabelMap.get(actionName) || actionName)} ${m('任务')} ${jobId}` });
      } else if (actionName === 'replay') {
        await replayPlatformMasterDataJob(jobId);
        setFeedback({ severity: 'success', message: `${localizeUiText(locale, actionLabelMap.get(actionName) || actionName)} ${m('任务')} ${jobId}` });
      } else if (actionName === 'archive') {
        await archivePlatformMasterDataJob(jobId);
        setFeedback({ severity: 'success', message: localizeUiText(locale, `任务 ${jobId} 已归档。`) });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || localizeUiText(locale, `${m('任务')} ${m('失败，请稍后重试。')}`)
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderActionButtons = (record, compact = false) =>
    record.available_actions?.map((actionName) => (
      <Button
        key={`${record.job_id}-${actionName}`}
        size="small"
        variant={compact ? 'text' : actionName === 'archive' ? 'text' : 'outlined'}
        color={actionName === 'archive' ? 'warning' : 'primary'}
        disabled={submitting}
        onClick={() => handleAction(actionName, record.job_id)}
      >
        {localizeUiText(locale, actionLabelMap.get(actionName) || actionName)}
      </Button>
    ));

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Master Data Jobs"
          title={m('导入任务日志')}
          description={m('运行日志对象已切到正式数据库；默认后端分页 20 条，不开放手工创建，仅保留 retry / replay / archive 动作。')}
          chips={['DB Read', 'DB Options', '20/page', 'Retry/Replay/Archive']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/master-data/sync" variant="outlined">
                {m('同步看板')}
              </Button>
              <Button component={RouterLink} to="/platform/audit/events" variant="outlined">
                {m('审计事件')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('导入日志')} subheader={m('正式表 `platform_master_data_jobs`，默认后端分页 20 条。')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2, alignItems: { lg: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('任务编码 / 同步配置 / 摘要 / 错误')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <TextField
                select
                label={m('来源')}
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 170 }}
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
                label={m('对象')}
                value={objectFilter}
                onChange={(event) => {
                  setObjectFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 170 }}
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
              <TextField
                select
                label={m('动作')}
                value={actionFilter}
                onChange={(event) => {
                  setActionFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">{m('全部动作')}</MenuItem>
                {actions.map((option) => (
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
            {masterDataJobsError ? <Alert severity="error">{m('任务日志加载失败，请检查后端连接。')}</Alert> : null}
            {masterDataJobOptionsLoading ? <Alert severity="info">{m('正在从数据库加载任务筛选项…')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('任务')}</TableCell>
                  <TableCell>{m('同步配置')}</TableCell>
                  <TableCell>{m('来源')}</TableCell>
                  <TableCell>{m('对象')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell>{m('摘要')}</TableCell>
                  <TableCell>{m('请求时间')}</TableCell>
                  <TableCell align="right">{m('动作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((record) => (
                  <TableRow key={record.job_id} hover selected={selectedJob?.job_id === record.job_id}>
                    <TableCell>
                      <Button size="small" variant="text" onClick={() => openDetail(record)}>
                        {record.job_id}
                      </Button>
                    </TableCell>
                    <TableCell>{localizeUiText(locale, record.sync_name)}</TableCell>
                    <TableCell>{localizeUiText(locale, record.source)}</TableCell>
                    <TableCell>{localizeUiText(locale, record.object)}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, record.status)} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 280 }}>
                      <Stack sx={{ gap: 0.5 }}>
                        <Typography variant="subtitle2">{localizeUiText(locale, record.summary)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {`${localizeUiText(locale, 'Retry')} ${record.retry_count} / ${localizeUiText(locale, 'Replay')} ${record.replay_count}`}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{formatDateTime(record.requested_at)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1, flexWrap: 'wrap' }}>
                        <Button size="small" variant="text" onClick={() => openDetail(record)}>
                          {m('详情')}
                        </Button>
                        {renderActionButtons(record)}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!masterDataJobsLoading && !tableRows.length ? (
                  <TableRow>
                    <TableCell colSpan={8}>
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
              count={total}
              page={currentPage}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          </Stack>
        </MainCard>
      </Grid>

      <Drawer anchor="right" open={detailOpen} onClose={closeDetail} PaperProps={{ sx: { width: { xs: '100%', sm: 440 } } }}>
        <Stack sx={{ p: 3, gap: 2 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h5">{activeJobId || m('任务详情')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {m('运行日志对象只读，支持 retry / replay / archive 动作。')}
            </Typography>
          </Stack>

          {masterDataJobDetailLoading ? <Alert severity="info">{m('正在加载任务详情…')}</Alert> : null}
          {masterDataJobDetailError ? <Alert severity="error">{m('任务详情加载失败，请稍后重试。')}</Alert> : null}

          {selectedJob ? (
            <Stack sx={{ gap: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {m('状态')}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <StatusChip label={selectedJob.status} />
                </Box>
              </Box>
              <TextField label={m('同步配置')} value={localizeUiText(locale, selectedJob.sync_name || '--')} InputProps={{ readOnly: true }} />
              <TextField label={m('来源')} value={localizeUiText(locale, selectedJob.source || '--')} InputProps={{ readOnly: true }} />
              <TextField label={m('对象')} value={localizeUiText(locale, selectedJob.object || '--')} InputProps={{ readOnly: true }} />
              <TextField label={m('摘要')} value={localizeUiText(locale, selectedJob.summary || '')} InputProps={{ readOnly: true }} multiline minRows={2} />
              <TextField
                label={m('详情 / 错误')}
                value={localizeUiText(locale, selectedJob.detail_note || selectedJob.last_error || m('暂无详情'))}
                InputProps={{ readOnly: true }}
                multiline
                minRows={3}
              />
              <TextField
                label={m('请求 / 处理时间')}
                value={`${formatDateTime(selectedJob.requested_at)} / ${formatDateTime(selectedJob.processed_at)}`}
                InputProps={{ readOnly: true }}
              />
              <TextField
                label={m('Retry / Replay 次数')}
                value={`${selectedJob.retry_count || 0} / ${selectedJob.replay_count || 0}`}
                InputProps={{ readOnly: true }}
              />
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {renderActionButtons(selectedJob, true)}
              </Stack>
            </Stack>
          ) : null}

          <Stack direction="row" justifyContent="flex-end">
            <Button variant="text" onClick={closeDetail}>
              {m('关闭')}
            </Button>
          </Stack>
        </Stack>
      </Drawer>
    </Grid>
  );
}
