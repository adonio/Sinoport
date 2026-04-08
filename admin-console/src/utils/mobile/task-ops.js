import { useLocalStorage } from 'hooks/useLocalStorage';
import { getMobileOpsStorageKey, getMobileRoleKey, readMobileSession } from 'utils/mobile/session';

export const MOBILE_TASK_OPS_DEFAULT_STATE = {
  deviceMode: 'online',
  issueCount: 0,
  suspended: false,
  latestIssue: '',
  queue: [],
  syncState: 'synced',
  lastSyncAt: '',
  lastSyncNote: '当前没有待补传动作。'
};

export function inferMobileActionType(label = '') {
  if (label.includes('扫码') || label.includes('录入') || label.includes('追加')) return 'scan';
  if (label.includes('上传')) return 'upload-evidence';
  if (label.includes('签')) return 'sign';
  if (label.includes('挂起')) return 'suspend';
  if (label.includes('异常')) return 'exception';
  if (label.includes('完成') || label.includes('关闭') || label.includes('归档')) return 'complete';
  return 'confirm';
}

export function buildMobileQueueEntry(session, payload) {
  const now = new Date().toISOString();

  return {
    id: `Q-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    stationCode: session?.stationCode || session?.station || 'N/A',
    roleKey: getMobileRoleKey(session),
    roleLabel: payload.roleLabel || session?.roleLabel || session?.role || 'N/A',
    taskLabel: payload.taskLabel,
    label: payload.label,
    actionType: payload.actionType || inferMobileActionType(payload.label),
    payloadSummary: payload.payloadSummary || payload.label,
    status: 'queued',
    retryCount: 0
  };
}

export function hasPendingMobileSync(state) {
  return state.queue?.some((item) => ['queued', 'syncing', 'failed'].includes(item.status));
}

export function recordMobileAction(prevState, entry) {
  const deviceMode = prevState.deviceMode || 'online';
  const now = new Date().toISOString();
  const initialStatus = deviceMode === 'offline' ? 'queued' : 'synced';
  const nextEntry = {
    ...entry,
    status: initialStatus,
    updatedAt: now
  };

  return {
    ...prevState,
    queue: [nextEntry, ...(prevState.queue || [])].slice(0, 12),
    syncState: initialStatus,
    lastSyncAt: deviceMode === 'online' ? now : prevState.lastSyncAt,
    lastSyncNote:
      deviceMode === 'online' ? `${entry.label} 已实时同步。` : `${entry.label} 已加入待补传队列，等待恢复在线。`
  };
}

export function syncMobileQueue(prevState) {
  const pendingEntries = prevState.queue || [];
  if (prevState.deviceMode === 'offline' || !pendingEntries.length) return prevState;

  const now = new Date().toISOString();
  let hasFailure = false;

  const queue = pendingEntries.map((item) => {
    if (!['queued', 'failed', 'syncing'].includes(item.status)) {
      return item;
    }

    if (item.actionType === 'upload-evidence' && item.retryCount === 0) {
      hasFailure = true;
      return {
        ...item,
        status: 'failed',
        retryCount: item.retryCount + 1,
        updatedAt: now
      };
    }

    return {
      ...item,
      status: 'synced',
      updatedAt: now
    };
  });

  return {
    ...prevState,
    queue,
    syncState: hasFailure ? 'failed' : 'synced',
    lastSyncAt: now,
    lastSyncNote: hasFailure ? '有 1 条证据上传仍需重试。' : '待补传动作已全部同步。'
  };
}

export function useMobileOpsStorage(scopeKey) {
  const session = readMobileSession();
  const storage = useLocalStorage(getMobileOpsStorageKey(session, scopeKey), MOBILE_TASK_OPS_DEFAULT_STATE);

  return {
    session,
    state: storage.state,
    setState: storage.setState,
    setField: storage.setField,
    resetState: storage.resetState
  };
}
