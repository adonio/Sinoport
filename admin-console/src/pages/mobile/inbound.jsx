import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import RightOutlined from '@ant-design/icons/RightOutlined';
import BarcodeOutlined from '@ant-design/icons/BarcodeOutlined';
import CarOutlined from '@ant-design/icons/CarOutlined';
import InboxOutlined from '@ant-design/icons/InboxOutlined';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';
import { openSnackbar } from 'api/snackbar';
import {
  acceptMobileTask,
  completeMobileTask,
  startMobileTask,
  uploadMobileTaskEvidence,
  useGetMobileInboundOverview
} from 'api/station';
import { readMobileSession, writeMobileSession } from 'utils/mobile/session';
import { t } from 'utils/mobile/i18n';

const ACTION_LABELS = {
  scan: '扫码',
  confirm: '确认',
  exception: '异常',
  suspend: '挂起',
  complete: '完成',
  'upload-evidence': '上传证据',
  sign: '签字'
};

export default function MobileInboundPage() {
  const navigate = useNavigate();
  const session = readMobileSession();
  const language = session?.language || 'zh';
  const { mobileInboundRoleView, mobileInboundFlights, mobileInboundTasks, mobileInboundSummary, mobileInboundLoading } =
    useGetMobileInboundOverview();
  const [activeTaskMutation, setActiveTaskMutation] = useState('');
  const inboundTabKeys = mobileInboundRoleView.inboundTabs?.length ? mobileInboundRoleView.inboundTabs : ['overview', 'counting', 'pallet', 'loading'];

  const taskEntries = [
    { key: 'counting', label: t(language, 'counting'), pathOf: (flightNo) => `/mobile/inbound/${flightNo}/breakdown`, icon: BarcodeOutlined },
    { key: 'pallet', label: t(language, 'pallet'), pathOf: (flightNo) => `/mobile/inbound/${flightNo}/pallet`, icon: InboxOutlined },
    { key: 'loading', label: t(language, 'loading'), pathOf: (flightNo) => `/mobile/inbound/${flightNo}/loading`, icon: CarOutlined },
    { key: 'overview', label: t(language, 'overview'), pathOf: (flightNo) => `/mobile/inbound/${flightNo}`, icon: RightOutlined }
  ].filter((item) => inboundTabKeys.includes(item.key));

  useEffect(() => {
    const current = readMobileSession();
    if (current && current.businessType !== '进港') {
      writeMobileSession({ ...current, businessType: '进港' });
    }
  }, []);

  const runTaskAction = async (taskId, action) => {
    try {
      setActiveTaskMutation(`${taskId}:${action}`);

      if (action === 'accept') {
        await acceptMobileTask(taskId, { note: 'Accepted from inbound PDA home' });
      }
      if (action === 'start') {
        await startMobileTask(taskId, { note: 'Started from inbound PDA home' });
      }
      if (action === 'evidence') {
        await uploadMobileTaskEvidence(taskId, { note: 'Evidence from inbound PDA home', evidence_summary: 'Quick upload summary' });
      }
      if (action === 'complete') {
        await completeMobileTask(taskId, { note: 'Completed from inbound PDA home' });
      }

      openSnackbar({
        open: true,
        message: `任务 ${taskId} 已执行 ${action}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || `任务动作 ${action} 失败`,
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveTaskMutation('');
    }
  };

  const visibleTaskEntries = taskEntries.length
    ? taskEntries
    : [
        { key: 'overview', label: t(language, 'overview'), pathOf: (flightNo) => `/mobile/inbound/${flightNo}`, icon: RightOutlined }
      ];

  const taskActionLabels = mobileInboundRoleView.actionTypes?.length ? mobileInboundRoleView.actionTypes : [];

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard>
        <Stack sx={{ gap: 1 }}>
          <Typography variant="overline" color="primary.main">
            {t(language, 'inbound')}
          </Typography>
          <Typography variant="h4">{t(language, 'select_flight')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t(language, 'inbound_flight_tip')}
          </Typography>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`角色：${mobileInboundRoleView.label || '未知'}`} variant="outlined" />
            <Chip size="small" label={`航班：${mobileInboundSummary.totalFlights || 0}`} variant="outlined" />
            <Chip size="small" label={`任务：${mobileInboundSummary.totalTasks || 0}`} variant="outlined" />
            <Chip size="small" label={`处理中：${mobileInboundSummary.activeTasks || 0}`} variant="outlined" />
          </Stack>
          {taskActionLabels.length ? (
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {taskActionLabels.map((action) => (
                <Chip key={action} size="small" label={`可用动作：${ACTION_LABELS[action] || action}`} color="primary" variant="outlined" />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </MainCard>

      {mobileInboundLoading && !mobileInboundFlights.length ? (
        <MainCard>
          <Typography variant="body2" color="text.secondary">
            正在加载进港航班...
          </Typography>
        </MainCard>
      ) : null}

      {!mobileInboundLoading && !mobileInboundFlights.length ? (
        <MainCard>
          <Typography variant="body2" color="text.secondary">
            暂无进港航班
          </Typography>
        </MainCard>
      ) : null}

      {mobileInboundFlights.map((flight) => (
        <MainCard
          key={flight.flightNo}
          sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
          onClick={() => navigate(`/mobile/inbound/${flight.flightNo}`)}
        >
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
              <div>
                <Typography variant="h5">{flight.flightNo}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t(language, 'source')} {flight.source} · {t(language, 'eta')} {flight.eta}
                </Typography>
              </div>
              <StatusChip label={flight.status} />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {t(language, 'current_step')}：{flight.step} · {t(language, 'priority')} {flight.priority} · {flight.cargo}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              当前角色：{mobileInboundRoleView.label}
            </Typography>

            {mobileInboundTasks.filter((task) => task.flight_no === flight.flightNo).length ? (
              <Stack sx={{ gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  真实任务
                </Typography>
                {mobileInboundTasks
                  .filter((task) => task.flight_no === flight.flightNo)
                  .map((task) => (
                    <Stack
                      key={task.task_id}
                      sx={{ gap: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1 }}
                    >
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                        <Typography variant="body2">{task.task_type}</Typography>
                        <StatusChip label={task.task_status} />
                      </Stack>
                      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                        {task.allowed_actions.includes('accept') ? (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={activeTaskMutation === `${task.task_id}:accept`}
                            onClick={(event) => {
                              event.stopPropagation();
                              runTaskAction(task.task_id, 'accept');
                            }}
                          >
                            领取
                          </Button>
                        ) : null}
                        {task.allowed_actions.includes('start') ? (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={activeTaskMutation === `${task.task_id}:start`}
                            onClick={(event) => {
                              event.stopPropagation();
                              runTaskAction(task.task_id, 'start');
                            }}
                          >
                            开始
                          </Button>
                        ) : null}
                        {task.allowed_actions.includes('upload_evidence') ? (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={activeTaskMutation === `${task.task_id}:evidence`}
                            onClick={(event) => {
                              event.stopPropagation();
                              runTaskAction(task.task_id, 'evidence');
                            }}
                          >
                            证据
                          </Button>
                        ) : null}
                        {task.allowed_actions.includes('complete') ? (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={activeTaskMutation === `${task.task_id}:complete`}
                            onClick={(event) => {
                              event.stopPropagation();
                              runTaskAction(task.task_id, 'complete');
                            }}
                          >
                            完成
                          </Button>
                        ) : null}
                        {task.blockers?.map((item) => (
                          <Chip key={`${task.task_id}-${item}`} label={item} size="small" color="warning" variant="outlined" />
                        ))}
                      </Stack>
                    </Stack>
                  ))}
              </Stack>
            ) : null}

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {visibleTaskEntries.map((entry, index) => (
                <Button
                  key={`${flight.flightNo}-${entry.key}`}
                  size="small"
                  variant={index === 0 ? 'contained' : 'outlined'}
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(entry.pathOf(flight.flightNo));
                  }}
                >
                  {index === 0 ? `进入${entry.label}` : entry.label}
                </Button>
              ))}
            </Stack>
          </Stack>
        </MainCard>
      ))}
    </Stack>
  );
}
