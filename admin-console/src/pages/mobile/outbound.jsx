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
import { acceptMobileTask, completeMobileTask, startMobileTask, uploadMobileTaskEvidence, useGetMobileOutboundOverview } from 'api/station';
import { readMobileSession, writeMobileSession } from 'utils/mobile/session';
import { t } from 'utils/mobile/i18n';

const tabDefinitions = [
  { key: 'receipt', label: (language) => t(language, 'receipt'), pathOf: (flightNo) => `/mobile/outbound/${flightNo}/receipt`, icon: InboxOutlined },
  { key: 'container', label: (language) => t(language, 'container'), pathOf: (flightNo) => `/mobile/outbound/${flightNo}/pmc`, icon: BarcodeOutlined },
  { key: 'loading', label: (language) => (language === 'en' ? 'Aircraft' : '装机'), pathOf: (flightNo) => `/mobile/outbound/${flightNo}/loading`, icon: CarOutlined },
  { key: 'overview', label: (language) => t(language, 'overview'), pathOf: (flightNo) => `/mobile/outbound/${flightNo}`, icon: RightOutlined }
];

export default function MobileOutboundPage() {
  const navigate = useNavigate();
  const session = readMobileSession();
  const language = session?.language || 'zh';
  const {
    mobileOutboundFlights,
    mobileOutboundTasks,
    mobileOutboundRoleView,
    mobileOutboundAvailableTabs,
    mobileOutboundAvailableActions
  } = useGetMobileOutboundOverview();
  const [activeTaskMutation, setActiveTaskMutation] = useState('');

  const visibleTabKeys = mobileOutboundAvailableTabs.length ? mobileOutboundAvailableTabs : mobileOutboundRoleView.outboundTabs;
  const taskEntries = tabDefinitions
    .filter((item) => visibleTabKeys.includes(item.key))
    .map((item) => ({
      ...item,
      label: item.label(language)
    }));

  useEffect(() => {
    const current = readMobileSession();
    if (current && current.businessType !== '出港') {
      writeMobileSession({ ...current, businessType: '出港' });
    }
  }, []);

  const runTaskAction = async (taskId, action) => {
    try {
      setActiveTaskMutation(`${taskId}:${action}`);

      if (action === 'accept') {
        await acceptMobileTask(taskId, { note: 'Accepted from outbound PDA home' });
      }
      if (action === 'start') {
        await startMobileTask(taskId, { note: 'Started from outbound PDA home' });
      }
      if (action === 'evidence') {
        await uploadMobileTaskEvidence(taskId, { note: 'Evidence from outbound PDA home', evidence_summary: 'Quick outbound upload summary' });
      }
      if (action === 'complete') {
        await completeMobileTask(taskId, { note: 'Completed from outbound PDA home' });
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

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard>
        <Stack sx={{ gap: 0.75 }}>
          <Typography variant="overline" color="primary.main">
            {t(language, 'outbound')}
          </Typography>
          <Typography variant="h4">{t(language, 'select_flight')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t(language, 'outbound_flight_tip')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            当前角色：{mobileOutboundRoleView.label || '未识别'}
          </Typography>
          {mobileOutboundAvailableTabs.length ? (
            <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', pt: 0.5 }}>
              {mobileOutboundAvailableTabs.map((tabKey) => {
                const matched = tabDefinitions.find((item) => item.key === tabKey);
                if (!matched) return null;
                return <Chip key={tabKey} label={matched.label(language)} size="small" variant="outlined" />;
              })}
            </Stack>
          ) : null}
          {mobileOutboundAvailableActions.length ? (
            <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', pt: 0.5 }}>
              {mobileOutboundAvailableActions.map((actionKey) => (
                <Chip key={actionKey} label={actionKey} size="small" color="secondary" variant="outlined" />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </MainCard>

      {mobileOutboundFlights.length ? (
        mobileOutboundFlights.map((flight) => {
          const flightTasks = (flight.tasks?.length ? flight.tasks : mobileOutboundTasks.filter((task) => task.flight_no === flight.flightNo)).map((task) => task);

          return (
            <MainCard
              key={flight.flightNo}
              sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
              onClick={() => navigate(`/mobile/outbound/${flight.flightNo}`)}
            >
              <Stack sx={{ gap: 1.5 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
                  <div>
                    <Typography variant="h5">{flight.flightNo}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {t(language, 'etd')} {flight.etd} · {t(language, 'current_step')} {flight.stage}
                    </Typography>
                  </div>
                  <StatusChip label={flight.status} />
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  {t(language, 'manifest')}：{flight.manifest} · {flight.cargo}
                </Typography>

                {flightTasks.length ? (
                  <Stack sx={{ gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      任务 {flightTasks.length}
                    </Typography>
                    {flightTasks.map((task) => (
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
                  {taskEntries.map((entry, index) => (
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
          );
        })
      ) : (
        <MainCard>
          <Typography variant="body2" color="text.secondary">
            当前没有可见的出港航班。
          </Typography>
        </MainCard>
      )}
    </Stack>
  );
}
