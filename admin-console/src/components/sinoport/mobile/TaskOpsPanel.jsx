import { Fragment, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import { syncMobileQueue, useMobileOpsStorage } from 'utils/mobile/task-ops';

function queueSummary(queue = []) {
  return {
    queued: queue.filter((item) => item.status === 'queued').length,
    syncing: queue.filter((item) => item.status === 'syncing').length,
    synced: queue.filter((item) => item.status === 'synced').length,
    failed: queue.filter((item) => item.status === 'failed').length
  };
}

export default function TaskOpsPanel({ scopeKey, currentLabel, onSuspend, onRecover, contextChips = [], quickLinks = [] }) {
  const { session, state, setState } = useMobileOpsStorage(scopeKey);
  const previousModeRef = useRef(state.deviceMode);
  const summary = queueSummary(state.queue);

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
    <MainCard title="通用动作层">
      <Stack sx={{ gap: 1.5 }}>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`站点 ${session?.stationCode || session?.station || 'N/A'}`} size="small" color="secondary" variant="light" />
          <Chip label={`角色 ${session?.roleLabel || session?.role || 'N/A'}`} size="small" color="info" variant="light" />
          <Chip label={`设备 ${state.deviceMode === 'offline' ? '离线' : '在线'}`} size="small" color={state.deviceMode === 'offline' ? 'warning' : 'success'} variant="light" />
          <Chip label={`同步 ${state.syncState || 'synced'}`} size="small" color={state.syncState === 'failed' ? 'error' : state.syncState === 'queued' ? 'warning' : 'success'} variant="light" />
          <Chip label={`异常 ${state.issueCount}`} size="small" color={state.issueCount ? 'error' : 'default'} variant="light" />
          <Chip label={`挂起 ${state.suspended ? '是' : '否'}`} size="small" color={state.suspended ? 'warning' : 'default'} variant="light" />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          当前对象：{currentLabel}
        </Typography>

        {contextChips.length ? (
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {contextChips.map((item) => (
              <Chip key={item} size="small" label={item} variant="outlined" />
            ))}
          </Stack>
        ) : null}

        {quickLinks.length ? (
          <Fragment>
            <Divider />
            <Stack sx={{ gap: 1 }}>
              <Typography variant="subtitle2">快捷入口</Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {quickLinks.map((item) => (
                  <Button key={item.label} size="small" variant={item.variant || 'outlined'} onClick={item.onClick}>
                    {item.label}
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Fragment>
        ) : null}

        <Typography variant="caption" color="text.secondary">
          最近异常：{state.latestIssue || '暂无异常记录'}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          最近补传结果：{state.lastSyncNote || '当前没有待补传动作。'}
        </Typography>

        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => update({ deviceMode: state.deviceMode === 'offline' ? 'online' : 'offline' })}
          >
            {state.deviceMode === 'offline' ? '恢复在线' : '模拟离线'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={state.deviceMode === 'offline' || !state.queue?.length}
            onClick={() => setState((prev) => syncMobileQueue(prev))}
          >
            立即补传
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              update({
                issueCount: state.issueCount + 1,
                latestIssue: `${currentLabel} 已上报异常`
              })
            }
          >
            上报异常
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              update({ suspended: true });
              onSuspend?.();
            }}
          >
            挂起任务
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
            恢复任务
          </Button>
        </Stack>

        <MainCard border={false} boxShadow={false} contentSX={{ px: 0, py: 0 }}>
          <Stack sx={{ gap: 0.75 }}>
            <Typography variant="subtitle2">待补传队列</Typography>
            <Typography variant="body2" color="text.secondary">
              queued {summary.queued} · syncing {summary.syncing} · synced {summary.synced} · failed {summary.failed}
            </Typography>
            {state.queue?.length ? (
              state.queue.map((item) => (
                <Stack key={item.id} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
                  <Stack sx={{ gap: 0.25, minWidth: 0 }}>
                    <Typography variant="body2">{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.taskLabel} · {item.payloadSummary}
                    </Typography>
                  </Stack>
                  <Chip size="small" label={item.status} color={item.status === 'failed' ? 'error' : item.status === 'queued' ? 'warning' : 'success'} variant="light" />
                </Stack>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                当前没有待补传动作。
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
  onRecover: PropTypes.func,
  onSuspend: PropTypes.func,
  quickLinks: PropTypes.array,
  scopeKey: PropTypes.string.isRequired
};
