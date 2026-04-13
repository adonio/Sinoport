import useSWR from 'swr';
import { useMemo } from 'react';

import { auditEvents } from 'data/sinoport';
import { auditEventDetailRows } from 'data/sinoport-adapters';
import { stationFetcher } from 'utils/stationApi';

const endpoints = {
  auditEvents: '/api/v1/platform/audit/events',
  auditLogs: '/api/v1/platform/audit/logs'
};

export function useGetPlatformAuditEvents() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.auditEvents, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      auditEvents: error || !data?.items?.length ? auditEvents : data.items,
      auditEventsLoading: isLoading,
      auditEventsError: error,
      auditEventsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetPlatformAuditLogs() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.auditLogs, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      auditLogs: error || !data?.items?.length ? auditEventDetailRows : data.items,
      auditLogsLoading: isLoading,
      auditLogsError: error,
      auditLogsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}
