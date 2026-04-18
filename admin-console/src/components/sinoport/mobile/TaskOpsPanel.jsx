import { Fragment, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';

import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import { syncMobileQueue, useMobileOpsStorage } from 'utils/mobile/task-ops';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { localizeMobileText } from 'utils/mobile/i18n';

function queueSummary(queue = []) {
  return {
    queued: queue.filter((item) => item.status === 'queued').length,
    syncing: queue.filter((item) => item.status === 'syncing').length,
    synced: queue.filter((item) => item.status === 'synced').length,
    failed: queue.filter((item) => item.status === 'failed').length
  };
}

export default function TaskOpsPanel({
  scopeKey,
  currentLabel,
  onSuspend,
  onRecover,
  contextChips = [],
  quickLinks = [],
  liveTasks = [],
  onTaskAction
}) {
  const intl = useIntl();
  const locale = intl.locale;
  const { session, state, setState } = useMobileOpsStorage(scopeKey);
  const previousModeRef = useRef(state.deviceMode);
  const summary = queueSummary(state.queue);
  const mt = (value) => localizeMobileText(locale, value);

  useEffect(() => {
    if (previousModeRef.current === 'offline' && state.deviceMode === 'online') {
      setState((prev) => syncMobileQueue(prev));
    }

    previousModeRef.current = state.deviceMode;
  }, [setState, state.deviceMode]);

  const update = (patch) =>
    setState((prev) => ({
      ...prev,
      ...patch
    }));

  return (
    <MainCard title={formatLocalizedMessage(intl, '通用动作层')}>
      <Stack sx={{ gap: 1.5 }}>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`${formatLocalizedMessage(intl, '站点')} ${session?.stationCode || session?.station || 'N/A'}`} size="small" color="secondary" variant="light" />
          <Chip label={`${formatLocalizedMessage(intl, '角色')} ${session?.roleLabel || session?.role || 'N/A'}`} size="small" color="info" variant="light" />
          <Chip
            label={`${formatLocalizedMessage(intl, '设备')} ${formatLocalizedMessage(intl, state.deviceMode === 'offline' ? '离线' : '在线')}`}
            size="small"
            color={state.deviceMode === 'offline' ? 'warning' : 'success'}
            variant="light"
          />
          <Chip
            label={`${formatLocalizedMessage(intl, '同步')} ${formatLocalizedMessage(intl, state.syncState || 'synced')}`}
            size="small"
            color={state.syncState === 'failed' ? 'error' : state.syncState === 'queued' ? 'warning' : 'success'}
            variant="light"
          />
          <Chip label={`${formatLocalizedMessage(intl, '异常')} ${state.issueCount}`} size="small" color={state.issueCount ? 'error' : 'default'} variant="light" />
          <Chip
            label={`${formatLocalizedMessage(intl, '挂起')} ${formatLocalizedMessage(intl, state.suspended ? '是' : '否')}`}
            size="small"
            color={state.suspended ? 'warning' : 'default'}
            variant="light"
          />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {formatLocalizedMessage(intl, '当前对象')}：{mt(currentLabel)}
        </Typography>

        {contextChips.length ? (
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {contextChips.map((item) => (
              <Chip key={item} size="small" label={mt(item)} variant="outlined" />
            ))}
          </Stack>
        ) : null}

        {liveTasks.length ? (
          <Fragment>
            <Divider />
            <Stack sx={{ gap: 1 }}>
              <Typography variant="subtitle2">{formatLocalizedMessage(intl, '真实任务')}</Typography>
              {liveTasks.map((task) => (
                <Stack key={task.task_id} sx={{ gap: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1 }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2">{mt(task.task_type)}</Typography>
                    <Chip size="small" label={mt(task.task_status)} color="info" variant="light" />
                  </Stack>
                  <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                    {task.allowed_actions.includes('accept') ? (
                      <Button size="small" variant="outlined" onClick={() => onTaskAction?.(task, 'accept')}>
                        {formatLocalizedMessage(intl, '领取')}
                      </Button>
                    ) : null}
                    {task.allowed_actions.includes('start') ? (
                      <Button size="small" variant="outlined" onClick={() => onTaskAction?.(task, 'start')}>
                        {formatLocalizedMessage(intl, '开始')}
                      </Button>
                    ) : null}
                    {task.allowed_actions.includes('upload_evidence') ? (
                      <Button size="small" variant="outlined" onClick={() => onTaskAction?.(task, 'evidence')}>
                        {formatLocalizedMessage(intl, '证据')}
                      </Button>
                    ) : null}
                    {task.allowed_actions.includes('complete') ? (
                      <Button size="small" variant="contained" onClick={() => onTaskAction?.(task, 'complete')}>
                        {formatLocalizedMessage(intl, '完成')}
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Fragment>
        ) : null}

        {quickLinks.length ? (
          <Fragment>
            <Divider />
            <Stack sx={{ gap: 1 }}>
              <Typography variant="subtitle2">{formatLocalizedMessage(intl, '快捷入口')}</Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {quickLinks.map((item) => (
                  <Button key={item.label} size="small" variant={item.variant || 'outlined'} onClick={item.onClick}>
                    {mt(item.label)}
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Fragment>
        ) : null}

        <Typography variant="caption" color="text.secondary">
          {formatLocalizedMessage(intl, '最近异常')}：{mt(state.latestIssue || formatLocalizedMessage(intl, '暂无异常记录'))}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {formatLocalizedMessage(intl, '最近补传结果')}：{mt(state.lastSyncNote || formatLocalizedMessage(intl, '当前没有待补传动作。'))}
        </Typography>

        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => update({ deviceMode: state.deviceMode === 'offline' ? 'online' : 'offline' })}
          >
            {formatLocalizedMessage(intl, state.deviceMode === 'offline' ? '恢复在线' : '模拟离线')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={state.deviceMode === 'offline' || !state.queue?.length}
            onClick={() => setState((prev) => syncMobileQueue(prev))}
          >
            {formatLocalizedMessage(intl, '立即补传')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              update({
                issueCount: state.issueCount + 1,
                latestIssue: `${currentLabel} ${formatLocalizedMessage(intl, '已上报异常。')}`
              })
            }
          >
            {formatLocalizedMessage(intl, '上报异常')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              update({ suspended: true });
              onSuspend?.();
            }}
          >
            {formatLocalizedMessage(intl, '挂起任务')}
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!state.suspended}
            onClick={() => {
              update({ suspended: false });
              onRecover?.();
            }}
          >
            {formatLocalizedMessage(intl, '恢复任务')}
          </Button>
        </Stack>

        <MainCard border={false} boxShadow={false} contentSX={{ px: 0, py: 0 }}>
          <Stack sx={{ gap: 0.75 }}>
            <Typography variant="subtitle2">{formatLocalizedMessage(intl, '待补传队列')}</Typography>
            <Typography variant="body2" color="text.secondary">
              queued {summary.queued} · syncing {summary.syncing} · synced {summary.synced} · failed {summary.failed}
            </Typography>
            {state.queue?.length ? (
              state.queue.map((item) => (
                <Stack key={item.id} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
                  <Stack sx={{ gap: 0.25, minWidth: 0 }}>
                    <Typography variant="body2">{mt(item.label)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {mt(item.taskLabel)} · {mt(item.payloadSummary)}
                    </Typography>
                  </Stack>
                  <Chip size="small" label={mt(item.status)} color={item.status === 'failed' ? 'error' : item.status === 'queued' ? 'warning' : 'success'} variant="light" />
                </Stack>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                {formatLocalizedMessage(intl, '当前没有待补传动作。')}
              </Typography>
            )}
          </Stack>
        </MainCard>
      </Stack>
    </MainCard>
  );
}

TaskOpsPanel.propTypes = {
  contextChips: PropTypes.array,
  currentLabel: PropTypes.string.isRequired,
  liveTasks: PropTypes.array,
  onTaskAction: PropTypes.func,
  onRecover: PropTypes.func,
  onSuspend: PropTypes.func,
  quickLinks: PropTypes.array,
  scopeKey: PropTypes.string.isRequired
};
