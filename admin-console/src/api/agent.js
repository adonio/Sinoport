import { useMemo } from 'react';
import useSWR from 'swr';

import { agentFetcher, agentPoster } from 'utils/agentApi';

const endpoints = {
  tools: '/api/v1/agent/tools',
  workflows: '/api/v1/agent/workflows',
  sessions: '/api/v1/agent/sessions',
  sessionDetail: (sessionId) => `/api/v1/agent/sessions/${sessionId}`,
  sessionContext: (sessionId) => `/api/v1/agent/sessions/${sessionId}/context`,
  sessionPlan: (sessionId) => `/api/v1/agent/sessions/${sessionId}/plan`,
  sessionEvents: (sessionId) => `/api/v1/agent/sessions/${sessionId}/events`,
  sessionMessages: (sessionId) => `/api/v1/agent/sessions/${sessionId}/messages`,
  toolExecute: (toolName) => `/api/v1/agent/tools/${toolName}/execute`
};

function buildQueryConfig(objectType, objectKey) {
  const params = {};

  if (objectType) params.object_type = objectType;
  if (objectKey) params.object_key = objectKey;

  return Object.keys(params).length ? { params } : undefined;
}

export function useGetAgentTools() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.tools, agentFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      agentTools: data?.items || [],
      agentToolsLoading: isLoading,
      agentToolsError: error,
      agentToolsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetAgentWorkflows() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.workflows, agentFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      agentWorkflows: data?.items || [],
      agentWorkflowsLoading: isLoading,
      agentWorkflowsError: error,
      agentWorkflowsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetAgentSessions(refreshNonce = 0) {
  const { data, isLoading, error, isValidating } = useSWR([endpoints.sessions, refreshNonce], agentFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      agentSessions: data?.items || [],
      agentSessionsLoading: isLoading,
      agentSessionsError: error,
      agentSessionsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetAgentSessionContext(sessionId, objectType, objectKey, refreshNonce = 0) {
  const requestKey = sessionId ? [endpoints.sessionContext(sessionId), buildQueryConfig(objectType, objectKey), refreshNonce] : null;
  const { data, isLoading, error, isValidating } = useSWR(requestKey, agentFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      agentSessionContext: data?.data || null,
      agentSessionContextLoading: isLoading,
      agentSessionContextError: error,
      agentSessionContextValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetAgentSessionDetail(sessionId, refreshNonce = 0) {
  const requestKey = sessionId ? [endpoints.sessionDetail(sessionId), refreshNonce] : null;
  const { data, isLoading, error, isValidating } = useSWR(requestKey, agentFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      agentSessionDetail: data?.data || null,
      agentSessionDetailLoading: isLoading,
      agentSessionDetailError: error,
      agentSessionDetailValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetAgentSessionPlan(sessionId, objectType, objectKey, refreshNonce = 0) {
  const requestKey = sessionId ? [endpoints.sessionPlan(sessionId), buildQueryConfig(objectType, objectKey), refreshNonce] : null;
  const { data, isLoading, error, isValidating } = useSWR(requestKey, agentFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      agentSessionPlan: data?.data || null,
      agentSessionPlanLoading: isLoading,
      agentSessionPlanError: error,
      agentSessionPlanValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export async function executeAgentTool(toolName, payload) {
  return agentPoster(endpoints.toolExecute(toolName), payload);
}

export async function createAgentSession(payload) {
  return agentPoster(endpoints.sessions, payload);
}

export async function getAgentSession(sessionId) {
  return agentFetcher(endpoints.sessionDetail(sessionId));
}

export async function getAgentSessionEvents(sessionId) {
  return agentFetcher(endpoints.sessionEvents(sessionId));
}

export async function postAgentMessage(sessionId, payload) {
  return agentPoster(endpoints.sessionMessages(sessionId), payload);
}
