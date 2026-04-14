import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';

import { stationFetcher } from 'utils/stationApi';

const EMPTY_ARRAY = [];

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false
};

const endpoints = {
  operationsOverview: '/api/v1/platform/operations/overview',
  stations: '/api/v1/platform/stations',
  network: '/api/v1/platform/network',
  rules: '/api/v1/platform/rules',
  masterData: '/api/v1/platform/master-data',
  reports: '/api/v1/platform/reports',
  auditEvents: '/api/v1/platform/audit/events',
  auditLogs: '/api/v1/platform/audit/logs'
};

function readArray(payload, key) {
  return Array.isArray(payload?.[key]) ? payload[key] : EMPTY_ARRAY;
}

export function useGetPlatformOperationsOverview() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.operationsOverview, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      platformKpis: readArray(payload, 'platformKpis'),
      platformOperationKpis: readArray(payload, 'platformOperationKpis'),
      platformAlerts: readArray(payload, 'platformAlerts'),
      platformPendingActions: readArray(payload, 'platformPendingActions'),
      stationAuditFeed: readArray(payload, 'stationAuditFeed'),
      stationHealthRows: readArray(payload, 'stationHealthRows'),
      operationsLoading: isLoading,
      operationsError: error,
      operationsValidating: isValidating,
      operationsUsingMock: Boolean(error)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformStations() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stations, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      stationCatalog: readArray(payload, 'stationCatalog'),
      platformStationCapabilityRows: readArray(payload, 'platformStationCapabilityRows'),
      stationCapabilityColumns: readArray(payload, 'stationCapabilityColumns'),
      platformStationTeamRows: readArray(payload, 'platformStationTeamRows'),
      platformStationZoneRows: readArray(payload, 'platformStationZoneRows'),
      platformStationDeviceRows: readArray(payload, 'platformStationDeviceRows'),
      stationsLoading: isLoading,
      stationsError: error,
      stationsValidating: isValidating,
      stationsUsingMock: Boolean(error || !readArray(payload, 'stationCatalog').length)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformStationDetail(stationCode) {
  const stations = useGetPlatformStations();

  return useMemo(() => {
    const station = stations.stationCatalog.find((item) => item.code === stationCode) || stations.stationCatalog[0] || null;
    const capability =
      stations.platformStationCapabilityRows.find((item) => item.code === station?.code) ||
      stations.platformStationCapabilityRows[0] ||
      null;
    const teamRows = stations.platformStationTeamRows.filter((item) => item.station === station?.code);
    const zoneRows = stations.platformStationZoneRows.filter((item) => item.station === station?.code);
    const deviceRows = stations.platformStationDeviceRows.filter((item) => item.station === station?.code);

    return {
      station,
      capability,
      teamRows,
      zoneRows,
      deviceRows,
      stationCapabilityColumns: stations.stationCapabilityColumns,
      stationDetailLoading: stations.stationsLoading,
      stationDetailError: stations.stationsError,
      stationDetailValidating: stations.stationsValidating,
      stationDetailUsingMock: stations.stationsUsingMock
    };
  }, [stationCode, stations]);
}

export function useGetPlatformNetwork() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.network, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      stationCatalog: readArray(payload, 'stationCatalog'),
      routeMatrix: readArray(payload, 'routeMatrix'),
      networkLaneTemplateRows: readArray(payload, 'networkLaneTemplateRows'),
      networkScenarioRows: readArray(payload, 'networkScenarioRows'),
      networkLoading: isLoading,
      networkError: error,
      networkValidating: isValidating,
      networkUsingMock: Boolean(error || !readArray(payload, 'routeMatrix').length)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformRules() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.rules, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      ruleOverviewRows: readArray(payload, 'ruleOverviewRows'),
      hardGatePolicyRows: readArray(payload, 'hardGatePolicyRows'),
      ruleTemplateRows: readArray(payload, 'ruleTemplateRows'),
      evidencePolicyRows: readArray(payload, 'evidencePolicyRows'),
      scenarioTimelineRows: readArray(payload, 'scenarioTimelineRows'),
      gateEvaluationRows: readArray(payload, 'gateEvaluationRows'),
      exceptionTaxonomy: readArray(payload, 'exceptionTaxonomy'),
      interfaceStatus: readArray(payload, 'interfaceStatus'),
      rulesLoading: isLoading,
      rulesError: error,
      rulesValidating: isValidating,
      rulesUsingMock: Boolean(error || !readArray(payload, 'ruleOverviewRows').length)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterData() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.masterData, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      masterDataRows: readArray(payload, 'masterDataRows'),
      interfaceGovernanceRows: readArray(payload, 'interfaceGovernanceRows'),
      importJobRows: readArray(payload, 'importJobRows'),
      demoPermissionMatrixRows: readArray(payload, 'demoPermissionMatrixRows'),
      nonFunctionalDemoRows: readArray(payload, 'nonFunctionalDemoRows'),
      integrationSyncRows: readArray(payload, 'integrationSyncRows'),
      integrationSyncActionRows: readArray(payload, 'integrationSyncActionRows'),
      objectRelationshipRows: readArray(payload, 'objectRelationshipRows'),
      masterDataLoading: isLoading,
      masterDataError: error,
      masterDataValidating: isValidating,
      masterDataUsingMock: Boolean(error || !readArray(payload, 'masterDataRows').length)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformReports() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.reports, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      platformReportCards: readArray(payload, 'platformReportCards'),
      platformStationReportRows: readArray(payload, 'platformStationReportRows'),
      platformDailyReportRows: readArray(payload, 'platformDailyReportRows'),
      reportsLoading: isLoading,
      reportsError: error,
      reportsValidating: isValidating,
      reportsUsingMock: Boolean(error || !readArray(payload, 'platformReportCards').length)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformAuditEvents() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.auditEvents, stationFetcher, swrOptions);

  return useMemo(
    () => ({
      auditEvents: data?.items || EMPTY_ARRAY,
      auditEventsLoading: isLoading,
      auditEventsError: error,
      auditEventsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetPlatformAuditLogs() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.auditLogs, stationFetcher, swrOptions);

  return useMemo(
    () => ({
      auditLogs: data?.items || EMPTY_ARRAY,
      auditLogsLoading: isLoading,
      auditLogsError: error,
      auditLogsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export async function refreshPlatformAuditCache() {
  await Promise.all([mutate(endpoints.auditEvents), mutate(endpoints.auditLogs)]);
}
