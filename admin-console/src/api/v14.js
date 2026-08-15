import useSWR from 'swr';

import { stationAxios, stationFetcher } from 'utils/stationApi';

export const v14Endpoints = {
  receipts: '/api/v1/prewarehouse/receipts',
  receipt: (id) => `/api/v1/prewarehouse/receipts/${encodeURIComponent(id)}`,
  jobs: '/api/v1/transport-jobs',
  job: (id) => `/api/v1/transport-jobs/${encodeURIComponent(id)}`,
  track: (id) => `/api/v1/transport-jobs/${encodeURIComponent(id)}/track`,
  borders: '/api/v1/border-operations',
  border: (id) => `/api/v1/border-operations/${encodeURIComponent(id)}`,
  tasReceipts: '/api/v1/airports/TAS/receipts',
  tasReceipt: (id) => `/api/v1/airport-receipts/${encodeURIComponent(id)}`,
  tasOverview: '/api/v1/airports/TAS/overview',
  tasOptions: '/api/v1/airports/TAS/options',
  tasFlights: '/api/v1/airports/TAS/flights',
  tasFlight: (id) => `/api/v1/airports/TAS/flights/${encodeURIComponent(id)}`,
  controlPlans: '/api/v1/operation-control-plans',
  controlPlanOptions: '/api/v1/operation-control-plans/options',
  controlPlanFlightDrafts: '/api/v1/operation-control-plans/flight-drafts',
  controlPlan: (id) => `/api/v1/operation-control-plans/${encodeURIComponent(id)}`,
  publishControlPlanVersion: (id, versionId) =>
    `/api/v1/operation-control-plans/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/publish`,
  milestones: (id) => `/api/v1/operation-control-plans/${encodeURIComponent(id)}/milestones`,
  managementSummary: (id) => `/api/v1/operation-control-plans/${encodeURIComponent(id)}/management-summary`,
  integrationStatus: '/api/v1/platform/integrations/skyledger/status',
  integrationEvents: '/api/v1/platform/integrations/skyledger/events'
};

export function useV14Resource(path, options = {}) {
  const { data, error, isLoading, mutate } = useSWR(path || null, stationFetcher, {
    revalidateOnFocus: false,
    refreshInterval: options.refreshInterval || 0
  });
  return { data: data?.data || data || null, error, isLoading, mutate };
}

export function useV14Collection(path, options = {}) {
  const resource = useV14Resource(path, options);
  return { ...resource, items: resource.data?.items || [], total: resource.data?.total || 0 };
}

export async function v14Post(path, payload = {}, idempotencyKey) {
  const response = await stationAxios.post(path, payload, {
    headers: { 'Idempotency-Key': idempotencyKey || `ui-${Date.now()}-${crypto.randomUUID()}` }
  });
  return response.data;
}

export async function v14Patch(path, payload = {}, idempotencyKey) {
  const response = await stationAxios.patch(path, payload, {
    headers: { 'Idempotency-Key': idempotencyKey || `ui-${Date.now()}-${crypto.randomUUID()}` }
  });
  return response.data;
}

export async function v14Delete(path, payload = {}, idempotencyKey) {
  const response = await stationAxios.delete(path, {
    data: payload,
    headers: { 'Idempotency-Key': idempotencyKey || `ui-${Date.now()}-${crypto.randomUUID()}` }
  });
  return response.data;
}

export async function createV14ControlPlan(payload, idempotencyKey) {
  return v14Post(v14Endpoints.controlPlans, payload, idempotencyKey);
}

export async function createV14ControlPlanFlightDraft(payload, idempotencyKey) {
  return v14Post(v14Endpoints.controlPlanFlightDrafts, payload, idempotencyKey);
}
