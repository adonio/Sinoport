import axios from 'axios';
import { canBootstrapLocalSession, resolveStationApiBaseUrl } from 'utils/stationApi';

function resolveAgentApiBaseUrl() {
  if (import.meta.env.VITE_APP_AGENT_API_URL) {
    return import.meta.env.VITE_APP_AGENT_API_URL;
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8794';
    }
  }

  return '';
}

function isLocalAgentApi(baseURL) {
  return typeof baseURL === 'string' && (baseURL.includes('127.0.0.1:8794') || baseURL.includes('localhost:8794'));
}

async function bootstrapStationToken() {
  const baseUrl = resolveStationApiBaseUrl();
  if (!baseUrl) return null;

  const response = await axios.post(`${baseUrl}/api/v1/station/login`, {
    email: 'supervisor@sinoport.local',
    password: 'Sinoport123!',
    stationCode: 'MME'
  });

  return response?.data?.data?.token || null;
}

export const agentApiBaseUrl = resolveAgentApiBaseUrl();
let agentBootstrapPromise = null;

const agentAxios = axios.create({
  baseURL: agentApiBaseUrl
});

agentAxios.interceptors.request.use(
  async (config) => {
    const accessToken = localStorage.getItem('serviceToken');
    const isLocal = isLocalAgentApi(config.baseURL || agentApiBaseUrl);

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    } else if (isLocal && canBootstrapLocalSession(resolveStationApiBaseUrl())) {
      if (!agentBootstrapPromise) {
        agentBootstrapPromise = bootstrapStationToken();
      }

      try {
        const token = await agentBootstrapPromise;
        if (token) {
          localStorage.setItem('serviceToken', token);
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Let the request fail with 401 when local bootstrap is unavailable.
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export const agentFetcher = async (args) => {
  const [url, config] = Array.isArray(args) ? args : [args];
  const res = await agentAxios.get(url, { ...config });
  return res.data;
};

export const agentPoster = async (url, payload) => {
  const res = await agentAxios.post(url, payload);
  return res.data;
};
