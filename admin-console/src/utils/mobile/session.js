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

export { MOBILE_SESSION_KEY };
