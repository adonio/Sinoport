import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import ObjectSummaryCard from 'components/sinoport/ObjectSummaryCard';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import TaskCard from 'components/sinoport/mobile/TaskCard';
import TaskOpsPanel from 'components/sinoport/mobile/TaskOpsPanel';
import {
  filterMobileActionsByRole,
  getMobileNodeDetail,
  getMobileNodeItems,
  getMobileRoleView,
  isMobileFlowAllowed,
  isMobileRoleAllowed
} from 'data/sinoport-adapters';
import { useLocalStorage } from 'hooks/useLocalStorage';
import { localizeMobileText, readMobileLanguage } from 'utils/mobile/i18n';
import { getMobileFlowStorageKey, getMobileRoleKey, readMobileSession } from 'utils/mobile/session';
import { buildMobileQueueEntry, recordMobileAction, useMobileOpsStorage } from 'utils/mobile/task-ops';

function defaultActionState(detail) {
  return {
    status: detail.status,
    evidenceUploaded: false,
    signed: false,
    note: '尚未执行现场动作。'
  };
}

function buildActionPatch(label, title) {
  if (label.includes('发车')) {
    return { status: '已发车', note: `${title} 已发车。` };
  }
  if (label.includes('放行')) {
    return { status: '已放行', note: `${title} 已放行。` };
  }
  if (label.includes('接机')) {
    return { status: '已接机', note: `${title} 已接机。` };
  }
  if (label.includes('完成') || label.includes('关闭') || label.includes('归档')) {
    return { status: '已完成', note: `${title} 已完成。` };
  }
  if (label.includes('签')) {
    return { signed: true, note: `${label} 已记录。` };
  }
  if (label.includes('上传')) {
    return { evidenceUploaded: true, note: `${label} 已记录。` };
  }
  if (label.includes('挂起')) {
    return { status: '暂时挂起', note: `${title} 已挂起。` };
  }
  if (label.includes('异常')) {
    return { status: '警戒', note: `${title} 已标记异常。` };
  }

  return { status: '运行中', note: `${label} 已记录。` };
}

function useNodeRoleContext(flowKey) {
  const session = readMobileSession();
  const roleKey = getMobileRoleKey(session);
  const roleView = getMobileRoleView(roleKey);
  const language = session?.language || readMobileLanguage();

  return { session, roleKey, roleView, language, flowAllowed: isMobileFlowAllowed(roleKey, flowKey) };
}

export function MobileNodeListPage({ flowKey, pathOf }) {
  const navigate = useNavigate();
  const { roleKey, roleView, language, flowAllowed } = useNodeRoleContext(flowKey);

  const items = getMobileNodeItems(flowKey)
    .map((item) => {
      const detail = getMobileNodeDetail(flowKey, item.id);
      const allowed = detail ? isMobileRoleAllowed(roleKey, detail.role) || flowAllowed : flowAllowed;

      return {
        ...item,
        title: localizeMobileText(language, item.title),
        subtitle: localizeMobileText(language, item.subtitle),
        allowed
      };
    })
    .filter((item) => item.allowed);

  if (!items.length) {
    return (
      <MainCard>
        <Stack sx={{ gap: 1 }}>
          <Typography variant="h5">{localizeMobileText(language, roleView.label)}</Typography>
          <Typography variant="body2" color="text.secondary">
            当前角色在此节点没有可执行任务，只保留只读或跨节点视图。
          </Typography>
        </Stack>
      </MainCard>
    );
  }

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard>
        <Typography variant="body2" color="text.secondary">
          当前角色：{localizeMobileText(language, roleView.label)}。只展示该角色允许执行的任务。
        </Typography>
      </MainCard>
      {items.map((item) => (
        <MainCard
          key={item.id}
          sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
          onClick={() => navigate(pathOf(item.id))}
        >
          <Stack sx={{ gap: 1.25 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
              <Typography variant="h5">{item.title}</Typography>
              <Typography variant="subtitle2" color="primary.main">
                {item.priority}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {item.subtitle}
            </Typography>
            <Button variant="outlined">查看任务</Button>
          </Stack>
        </MainCard>
      ))}
    </Stack>
  );
}

export function MobileNodeDetailPage({ flowKey, itemId, backPath }) {
  const navigate = useNavigate();
  const { session, roleKey, roleView, language, flowAllowed } = useNodeRoleContext(flowKey);
  const detail = getMobileNodeDetail(flowKey, itemId);
  const storage = useLocalStorage(getMobileFlowStorageKey(session, `${flowKey}-${itemId}`), {});
  const opsStorage = useMobileOpsStorage(`node-${flowKey}-${itemId}`);

  const state = useMemo(() => {
    if (!detail) return null;
    return storage.state[itemId] || defaultActionState(detail);
  }, [detail, itemId, storage.state]);

  if (!detail || !state) {
    return null;
  }

  const roleAllowed = isMobileRoleAllowed(roleKey, detail.role) || flowAllowed;

  const setCurrentState = (updater) => {
    storage.setState((prev) => {
      const current = prev[itemId] || defaultActionState(detail);
      const next = typeof updater === 'function' ? updater(current) : updater;

      return {
        ...prev,
        [itemId]: next
      };
    });
  };

  const runTaskAction = (label) => {
    const patch = buildActionPatch(label, detail.title);
    const offline = opsStorage.state.deviceMode === 'offline';

    setCurrentState((prev) => ({
      ...prev,
      ...patch,
      note: offline ? `${label} 已离线记录，待补传。` : patch.note
    }));

    opsStorage.setState((prev) =>
      recordMobileAction(
        prev,
        buildMobileQueueEntry(session, {
          label,
          taskLabel: detail.title,
          payloadSummary: `${detail.node} / ${detail.role}`,
          roleLabel: roleView.label
        })
      )
    );
  };

  const taskActions = filterMobileActionsByRole(
    roleKey,
    detail.actions.map((action) => ({
      ...action,
      onClick: () => runTaskAction(action.label)
    }))
  );

  const blockers = roleAllowed ? detail.blockers : [...detail.blockers, `当前角色 ${roleView.label} 仅可查看，不可执行 ${detail.role} 任务。`];

  return (
    <Stack sx={{ gap: 2 }}>
      <TaskOpsPanel
        scopeKey={`node-${flowKey}-${itemId}`}
        currentLabel={detail.title}
        onSuspend={() => setCurrentState((prev) => ({ ...prev, status: '暂时挂起', note: `${detail.title} 已挂起。` }))}
        onRecover={() => setCurrentState((prev) => ({ ...prev, status: detail.status, note: `${detail.title} 已恢复。` }))}
      />

      <TaskCard
        title={localizeMobileText(language, detail.title)}
        node={localizeMobileText(language, detail.node)}
        role={localizeMobileText(language, detail.role)}
        status={state.status}
        priority={detail.priority}
        sla={detail.sla}
        description={localizeMobileText(language, detail.description)}
        evidence={detail.evidence.map((item) => localizeMobileText(language, item))}
        blockers={blockers.map((item) => localizeMobileText(language, item))}
        actions={roleAllowed ? taskActions : []}
      />

      <ObjectSummaryCard
        title="对象摘要"
        subtitle={localizeMobileText(language, detail.description)}
        status={state.status}
        rows={[
          { label: '当前角色', value: localizeMobileText(language, roleView.label) },
          ...detail.summaryRows.map((item) => ({ label: localizeMobileText(language, item.label), value: localizeMobileText(language, item.value) }))
        ]}
      />

      <MainCard title="现场记录">
        <Stack sx={{ gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {state.note}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            证据上传：{state.evidenceUploaded ? '已完成' : '待上传'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            签字状态：{state.signed ? '已签字' : '待签字'}
          </Typography>
        </Stack>
      </MainCard>

      <TaskQueueCard
        title="关键检查项"
        items={detail.records.map((item, index) => ({
          id: `${itemId}-${index}`,
          title: localizeMobileText(language, item),
          status: index === 0 ? state.status : '待处理'
        }))}
      />

      <Box>
        <Button fullWidth variant="outlined" onClick={() => navigate(backPath)}>
          返回列表
        </Button>
      </Box>
    </Stack>
  );
}
