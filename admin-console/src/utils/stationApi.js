import axios from 'axios';

const SERVICE_TOKEN_KEY = 'serviceToken';
const REFRESH_TOKEN_KEY = 'serviceRefreshToken';
const STATION_ACTOR_KEY = 'sinoport-station-actor-v1';
const STATION_API_BASE_URL_KEY = 'sinoportStationApiBaseUrl';
export const TEST_DEFAULT_STATION_CREDENTIALS = {
  email: 'supervisor@sinoport.local',
  password: 'Sinoport123!'
};

function isLocalOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return false;

  try {
    const url = new URL(value);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

export function resolveStationApiBaseUrl() {
  if (import.meta.env.VITE_APP_STATION_API_URL) {
    return import.meta.env.VITE_APP_STATION_API_URL;
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    const runtimeBaseUrl = window.localStorage.getItem(STATION_API_BASE_URL_KEY);

    if (runtimeBaseUrl) {
      return runtimeBaseUrl;
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8787';
    }
  }

  return '';
}

export function canBootstrapLocalSession(baseURL) {
  if (typeof window === 'undefined') return false;

  const { hostname } = window.location;
  const localHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const localApi = isLocalOrigin(baseURL);

  return localHost && localApi;
}

export function isTestStationEnvironment() {
  if (typeof window === 'undefined') return false;

  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('staging-');
}

function readStorage(key) {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') return;
  if (value) {
    window.localStorage.setItem(key, value);
  } else {
    window.localStorage.removeItem(key);
  }
}

export const stationApiBaseUrl = resolveStationApiBaseUrl();
export const stationAxios = axios.create({ baseURL: stationApiBaseUrl });

let stationBootstrapPromise = null;
let refreshPromise = null;

export function buildUserFromActor(actor) {
  const primaryRole = actor?.role_ids?.[0] || 'station_supervisor';

  return {
    id: actor?.user_id || 'station-user',
    name: actor?.display_name || actor?.user_id || 'Station User',
    email: actor?.email || `${actor?.user_id || 'station-user'}@sinoport.local`,
    role: primaryRole,
    stationScope: actor?.station_scope || ['MME']
  };
}

export function readStoredActor() {
  const raw = readStorage(STATION_ACTOR_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function persistStationSession(payload = {}) {
  if (Object.prototype.hasOwnProperty.call(payload, 'token')) {
    writeStorage(SERVICE_TOKEN_KEY, payload.token || null);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'refresh_token')) {
    writeStorage(REFRESH_TOKEN_KEY, payload.refresh_token || null);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'actor')) {
    writeStorage(STATION_ACTOR_KEY, payload.actor ? JSON.stringify(payload.actor) : null);
  }
}

export function clearStationSession() {
  writeStorage(SERVICE_TOKEN_KEY, null);
  writeStorage(REFRESH_TOKEN_KEY, null);
  writeStorage(STATION_ACTOR_KEY, null);
}

export async function requestStationLogin(payload) {
  const response = await axios.post(`${stationApiBaseUrl}/api/v1/station/login`, payload);
  return response?.data?.data || null;
}

export async function refreshStationSession() {
  const refreshToken = readStorage(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    throw new Error('Missing refresh token');
  }

  const response = await axios.post(`${stationApiBaseUrl}/api/v1/station/refresh`, {
    refresh_token: refreshToken
  });

  const data = response?.data?.data || null;
  if (data?.token) {
    persistStationSession(data);
  }
  return data;
}

export async function fetchStationMe() {
  const token = readStorage(SERVICE_TOKEN_KEY);

  if (!token) {
    throw new Error('Missing access token');
  }

  const response = await axios.get(`${stationApiBaseUrl}/api/v1/station/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return response?.data?.data || null;
}

export async function logoutStationSession() {
  const token = readStorage(SERVICE_TOKEN_KEY);
  const refreshToken = readStorage(REFRESH_TOKEN_KEY);

  if (token) {
    await axios.post(
      `${stationApiBaseUrl}/api/v1/station/logout`,
      { refresh_token: refreshToken },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).catch(() => {});
  }

  clearStationSession();
}

async function bootstrapStationToken() {
  const data = await requestStationLogin({
    email: 'supervisor@sinoport.local',
    password: 'Sinoport123!',
    stationCode: readStorage('sinoportDebugStationScope') || 'MME'
  });

  if (data?.token) {
    persistStationSession(data);
  }

  return data?.token || null;
}

stationAxios.interceptors.request.use(
  async (config) => {
    let accessToken = readStorage(SERVICE_TOKEN_KEY);

    if (!accessToken && canBootstrapLocalSession(config.baseURL || stationApiBaseUrl)) {
      if (!stationBootstrapPromise) {
        stationBootstrapPromise = bootstrapStationToken().finally(() => {
          stationBootstrapPromise = null;
        });
      }

      accessToken = await stationBootstrapPromise;
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

stationAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const shouldRetry =
      error?.response?.status === 401 &&
      !originalRequest?._retry &&
      !String(originalRequest?.url || '').includes('/api/v1/station/refresh') &&
      !String(originalRequest?.url || '').includes('/api/v1/station/login');

    if (!shouldRetry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshStationSession().finally(() => {
          refreshPromise = null;
        });
      }

      const data = await refreshPromise;
      if (data?.token) {
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
      }
      return stationAxios(originalRequest);
    } catch (refreshError) {
      clearStationSession();
      return Promise.reject(refreshError);
    }
  }
);

export default stationAxios;

export const stationFetcher = async (args) => {
  const [url, config] = Array.isArray(args) ? args : [args];
  const res = await stationAxios.get(url, { ...config });
  return res.data;
};

export const stationPoster = async (url, payload) => {
  const res = await stationAxios.post(url, payload);
  return res.data;
};

export const stationPatcher = async (url, payload) => {
  const res = await stationAxios.patch(url, payload);
  return res.data;
};

export const stationDeleter = async (url, config = {}) => {
  const res = await stationAxios.delete(url, config);
  return res.data;
};

export const stationPut = async (url, payload, config = {}) => {
  const res = await stationAxios.put(url, payload, config);
  return res.data;
};

export const stationPublicPoster = async (url, payload) => {
  const res = await axios.post(`${stationApiBaseUrl}${url}`, payload);
  return res.data;
};

export const stationUpload = async (url, formData) => {
  const res = await stationAxios.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return res.data;
};
