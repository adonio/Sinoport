const MOBILE_SESSION_KEY = 'sinoport-mobile-session-v1';

export function readMobileSession() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(MOBILE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeMobileSession(session) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MOBILE_SESSION_KEY, JSON.stringify(session));
}

export function clearMobileSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(MOBILE_SESSION_KEY);
}

export function getMobileStationKey(session) {
  return (session?.stationCode || session?.station || 'default').replace(/\s+/g, '-').toLowerCase();
}

export function getMobileRoleKey(session) {
  return session?.roleKey || 'supervisor';
}

export function getMobileOpsStorageKey(session, scopeKey) {
  return `sinoport-mobile-ops-${getMobileStationKey(session)}-${scopeKey}`;
}

export function getMobileFlowStorageKey(session, scopeKey) {
  return `sinoport-mobile-flow-${getMobileStationKey(session)}-${scopeKey}`;
}

export { MOBILE_SESSION_KEY };
