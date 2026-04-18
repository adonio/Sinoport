import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';

import { stationDeleter, stationFetcher, stationPatcher, stationPoster } from 'utils/stationApi';

const EMPTY_ARRAY = [];

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false
};

const endpoints = {
  operationsOverview: '/api/v1/platform/operations/overview',
  stations: '/api/v1/platform/stations',
  stationCapabilities: '/api/v1/platform/stations/capabilities',
  stationOptions: '/api/v1/platform/stations/options',
  stationDetail: (stationId) => `/api/v1/platform/stations/${stationId}`,
  teams: '/api/v1/platform/teams',
  teamOptions: '/api/v1/platform/teams/options',
  teamDetail: (teamId) => `/api/v1/platform/teams/${teamId}`,
  devices: '/api/v1/platform/devices',
  deviceOptions: '/api/v1/platform/devices/options',
  deviceDetail: (deviceId) => `/api/v1/platform/devices/${deviceId}`,
  zones: '/api/v1/platform/zones',
  zoneOptions: '/api/v1/platform/zones/options',
  zoneDetail: (zoneId) => `/api/v1/platform/zones/${zoneId}`,
  network: '/api/v1/platform/network',
  networkLanes: '/api/v1/platform/network/lanes',
  networkLaneOptions: '/api/v1/platform/network/lanes/options',
  networkLaneDetail: (laneId) => `/api/v1/platform/network/lanes/${laneId}`,
  networkScenarios: '/api/v1/platform/network/scenarios',
  networkScenarioOptions: '/api/v1/platform/network/scenarios/options',
  networkScenarioDetail: (scenarioId) => `/api/v1/platform/network/scenarios/${scenarioId}`,
  rules: '/api/v1/platform/rules',
  ruleOptions: '/api/v1/platform/rules/options',
  ruleDetail: (ruleId) => `/api/v1/platform/rules/${ruleId}`,
  masterData: '/api/v1/platform/master-data',
  masterDataOptions: '/api/v1/platform/master-data/options',
  masterDataDetail: (masterDataId) => `/api/v1/platform/master-data/${masterDataId}`,
  masterDataSync: '/api/v1/platform/master-data/sync',
  masterDataSyncOptions: '/api/v1/platform/master-data/sync/options',
  masterDataSyncDetail: (syncId) => `/api/v1/platform/master-data/sync/${syncId}`,
  masterDataJobs: '/api/v1/platform/master-data/jobs',
  masterDataJobOptions: '/api/v1/platform/master-data/jobs/options',
  masterDataJobDetail: (jobId) => `/api/v1/platform/master-data/jobs/${jobId}`,
  masterDataJobRetry: (jobId) => `/api/v1/platform/master-data/jobs/${jobId}/retry`,
  masterDataJobReplay: (jobId) => `/api/v1/platform/master-data/jobs/${jobId}/replay`,
  masterDataJobArchive: (jobId) => `/api/v1/platform/master-data/jobs/${jobId}/archive`,
  masterDataRelationships: '/api/v1/platform/master-data/relationships',
  masterDataRelationshipOptions: '/api/v1/platform/master-data/relationships/options',
  masterDataRelationshipDetail: (relationshipId) =>
    `/api/v1/platform/master-data/relationships/${relationshipId}`,
  reports: '/api/v1/platform/reports/daily',
  stationGovernanceComparison: (stationId = 'MME') => `/api/v1/platform/station-governance/stations/${stationId}/governance-comparison`,
  stationAcceptanceRecordTemplate: (stationId = 'MME') =>
    `/api/v1/platform/station-governance/stations/${stationId}/acceptance-record-template`,
  auditEvents: '/api/v1/platform/audit/events',
  auditLogs: '/api/v1/platform/audit/logs'
};

function readArray(payload, key) {
  return Array.isArray(payload?.[key]) ? payload[key] : EMPTY_ARRAY;
}

function buildQueryString(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `?${query}` : '';
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

export function useGetPlatformStations(params = {}) {
  const endpoint = `${endpoints.stations}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      stationCatalog: readArray(payload, 'stationCatalog'),
      stationCatalogPage: payload.stationCatalogPage || {
        items: readArray(payload, 'stationCatalog'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'stationCatalog').length
      },
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

export function useGetPlatformStationCapabilities(params = {}) {
  const endpoint = `${endpoints.stationCapabilities}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      platformStationCapabilityRows: readArray(payload, 'platformStationCapabilityRows'),
      stationCapabilityColumns: readArray(payload, 'stationCapabilityColumns'),
      stationCapabilitiesMeta: payload.stationCapabilitiesMeta || null,
      stationCapabilitiesLoading: isLoading,
      stationCapabilitiesError: error,
      stationCapabilitiesValidating: isValidating,
      stationCapabilitiesUsingMock: Boolean(error)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformStationDetail(stationCode) {
  const endpoint = stationCode ? endpoints.stationDetail(stationCode) : null;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(() => {
    return {
      station: payload.station || null,
      capability: payload.capability || null,
      teamRows: readArray(payload, 'teamRows'),
      zoneRows: readArray(payload, 'zoneRows'),
      deviceRows: readArray(payload, 'deviceRows'),
      stationCapabilityColumns: readArray(payload, 'stationCapabilityColumns'),
      stationDetailLoading: isLoading,
      stationDetailError: error,
      stationDetailValidating: isValidating,
      stationDetailUsingMock: Boolean(error || !payload.station)
    };
  }, [payload, error, isLoading, isValidating]);
}

export function useGetPlatformStationOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationOptions, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      controlLevels: readArray(payload, 'controlLevels'),
      phases: readArray(payload, 'phases'),
      owners: readArray(payload, 'owners'),
      stationOptionsLoading: isLoading,
      stationOptionsError: error,
      stationOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformTeams(params = {}) {
  const endpoint = `${endpoints.teams}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      teamRows: readArray(payload, 'teamRows'),
      teamPage: payload.teamPage || {
        items: readArray(payload, 'teamRows'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'teamRows').length
      },
      teamsLoading: isLoading,
      teamsError: error,
      teamsValidating: isValidating,
      teamsUsingMock: Boolean(error)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformTeamOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.teamOptions, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      stations: readArray(payload, 'stations'),
      shifts: readArray(payload, 'shifts'),
      statuses: readArray(payload, 'statuses'),
      teamOptionsLoading: isLoading,
      teamOptionsError: error,
      teamOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformZones(params = {}) {
  const endpoint = `${endpoints.zones}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      zoneRows: readArray(payload, 'zoneRows'),
      zonePage: payload.zonePage || {
        items: readArray(payload, 'zoneRows'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'zoneRows').length
      },
      zonesLoading: isLoading,
      zonesError: error,
      zonesValidating: isValidating,
      zonesUsingMock: Boolean(error)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformDevices(params = {}) {
  const endpoint = `${endpoints.devices}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      deviceRows: readArray(payload, 'deviceRows'),
      devicePage: payload.devicePage || {
        items: readArray(payload, 'deviceRows'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'deviceRows').length
      },
      devicesLoading: isLoading,
      devicesError: error,
      devicesValidating: isValidating,
      devicesUsingMock: Boolean(error)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformDeviceOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.deviceOptions, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      stations: readArray(payload, 'stations'),
      types: readArray(payload, 'types'),
      roles: readArray(payload, 'roles'),
      statuses: readArray(payload, 'statuses'),
      teams: readArray(payload, 'teams'),
      deviceOptionsLoading: isLoading,
      deviceOptionsError: error,
      deviceOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformZoneOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.zoneOptions, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      stations: readArray(payload, 'stations'),
      types: readArray(payload, 'types'),
      statuses: readArray(payload, 'statuses'),
      zoneOptionsLoading: isLoading,
      zoneOptionsError: error,
      zoneOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
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

export function useGetPlatformNetworkLanes(params = {}) {
  const endpoint = `${endpoints.networkLanes}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      laneRows: readArray(payload, 'laneRows'),
      lanePage: payload.lanePage || {
        items: readArray(payload, 'laneRows'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'laneRows').length
      },
      networkLanesLoading: isLoading,
      networkLanesError: error,
      networkLanesValidating: isValidating,
      networkLanesUsingMock: Boolean(error)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformNetworkLaneOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.networkLaneOptions, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      stations: readArray(payload, 'stations'),
      controlDepths: readArray(payload, 'controlDepths'),
      statuses: readArray(payload, 'statuses'),
      networkLaneOptionsLoading: isLoading,
      networkLaneOptionsError: error,
      networkLaneOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformNetworkLaneDetail(laneId) {
  const endpoint = laneId ? endpoints.networkLaneDetail(laneId) : null;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      lane: payload.lane || null,
      networkLaneDetailLoading: isLoading,
      networkLaneDetailError: error,
      networkLaneDetailValidating: isValidating,
      networkLaneDetailUsingMock: Boolean(error || !payload.lane)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformNetworkScenarios(params = {}) {
  const endpoint = `${endpoints.networkScenarios}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      scenarioRows: readArray(payload, 'scenarioRows'),
      scenarioPage: payload.scenarioPage || {
        items: readArray(payload, 'scenarioRows'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'scenarioRows').length
      },
      networkScenariosLoading: isLoading,
      networkScenariosError: error,
      networkScenariosValidating: isValidating,
      networkScenariosUsingMock: Boolean(error)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformNetworkScenarioOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.networkScenarioOptions, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      stations: readArray(payload, 'stations'),
      lanes: readArray(payload, 'lanes'),
      categories: readArray(payload, 'categories'),
      statuses: readArray(payload, 'statuses'),
      networkScenarioOptionsLoading: isLoading,
      networkScenarioOptionsError: error,
      networkScenarioOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformNetworkScenarioDetail(scenarioId) {
  const endpoint = scenarioId ? endpoints.networkScenarioDetail(scenarioId) : null;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      scenario: payload.scenario || null,
      networkScenarioDetailLoading: isLoading,
      networkScenarioDetailError: error,
      networkScenarioDetailValidating: isValidating,
      networkScenarioDetailUsingMock: Boolean(error || !payload.scenario)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformRules(params = {}) {
  const endpoint = `${endpoints.rules}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      ruleRows: readArray(payload, 'ruleRows'),
      rulePage: payload.rulePage || {
        items: readArray(payload, 'ruleRows'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'ruleRows').length
      },
      ruleTypeSummaryRows: readArray(payload, 'ruleTypeSummaryRows'),
      ruleTimelineRows: readArray(payload, 'ruleTimelineRows'),
      rulesLoading: isLoading,
      rulesError: error,
      rulesValidating: isValidating,
      rulesUsingMock: Boolean(error)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformRuleOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.ruleOptions, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      stations: readArray(payload, 'stations'),
      lanes: readArray(payload, 'lanes'),
      scenarios: readArray(payload, 'scenarios'),
      types: readArray(payload, 'types'),
      controlLevels: readArray(payload, 'controlLevels'),
      statuses: readArray(payload, 'statuses'),
      scopes: readArray(payload, 'scopes'),
      serviceLevels: readArray(payload, 'serviceLevels'),
      timelineStages: readArray(payload, 'timelineStages'),
      ruleOptionsLoading: isLoading,
      ruleOptionsError: error,
      ruleOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformRuleDetail(ruleId) {
  const endpoint = ruleId ? endpoints.ruleDetail(ruleId) : null;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      rule: payload.rule || null,
      ruleDetailLoading: isLoading,
      ruleDetailError: error,
      ruleDetailValidating: isValidating,
      ruleDetailUsingMock: Boolean(error || !payload.rule)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterData(params = {}) {
  const endpoint = `${endpoints.masterData}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      masterDataRows: readArray(payload, 'masterDataRows'),
      masterDataPage: payload.masterDataPage || {
        items: readArray(payload, 'masterDataRows'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'masterDataRows').length
      },
      masterDataTypeSummaryRows: readArray(payload, 'masterDataTypeSummaryRows'),
      masterDataSourceSummaryRows: readArray(payload, 'masterDataSourceSummaryRows'),
      masterDataStatusSummaryRows: readArray(payload, 'masterDataStatusSummaryRows'),
      masterDataLoading: isLoading,
      masterDataError: error,
      masterDataValidating: isValidating,
      masterDataUsingMock: Boolean(error || !readArray(payload, 'masterDataRows').length)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.masterDataOptions, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      types: readArray(payload, 'types'),
      sources: readArray(payload, 'sources'),
      statuses: readArray(payload, 'statuses'),
      masterDataOptionsLoading: isLoading,
      masterDataOptionsError: error,
      masterDataOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataDetail(masterDataId) {
  const endpoint = masterDataId ? endpoints.masterDataDetail(masterDataId) : null;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      masterData: payload.masterData || null,
      masterDataDetailLoading: isLoading,
      masterDataDetailError: error,
      masterDataDetailValidating: isValidating,
      masterDataDetailUsingMock: Boolean(error || !payload.masterData)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataSync(params = {}) {
  const endpoint = `${endpoints.masterDataSync}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      syncRows: readArray(payload, 'syncRows'),
      syncPage: payload.syncPage || {
        items: readArray(payload, 'syncRows'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'syncRows').length
      },
      masterDataSyncLoading: isLoading,
      masterDataSyncError: error,
      masterDataSyncValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataSyncOptions() {
  const { data, isLoading, error, isValidating } = useSWR(
    endpoints.masterDataSyncOptions,
    stationFetcher,
    swrOptions
  );
  const payload = data?.data || {};

  return useMemo(
    () => ({
      objects: readArray(payload, 'objects'),
      targets: readArray(payload, 'targets'),
      statuses: readArray(payload, 'statuses'),
      masterDataSyncOptionsLoading: isLoading,
      masterDataSyncOptionsError: error,
      masterDataSyncOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataSyncDetail(syncId) {
  const endpoint = syncId ? endpoints.masterDataSyncDetail(syncId) : null;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      sync: payload.sync || null,
      masterDataSyncDetailLoading: isLoading,
      masterDataSyncDetailError: error,
      masterDataSyncDetailValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataJobs(params = {}) {
  const endpoint = `${endpoints.masterDataJobs}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      jobRows: readArray(payload, 'jobRows'),
      jobPage: payload.jobPage || {
        items: readArray(payload, 'jobRows'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'jobRows').length
      },
      masterDataJobsLoading: isLoading,
      masterDataJobsError: error,
      masterDataJobsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataJobOptions() {
  const { data, isLoading, error, isValidating } = useSWR(
    endpoints.masterDataJobOptions,
    stationFetcher,
    swrOptions
  );
  const payload = data?.data || {};

  return useMemo(
    () => ({
      sources: readArray(payload, 'sources'),
      objects: readArray(payload, 'objects'),
      statuses: readArray(payload, 'statuses'),
      actions: readArray(payload, 'actions'),
      masterDataJobOptionsLoading: isLoading,
      masterDataJobOptionsError: error,
      masterDataJobOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataJobDetail(jobId) {
  const endpoint = jobId ? endpoints.masterDataJobDetail(jobId) : null;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      job: payload.job || null,
      masterDataJobDetailLoading: isLoading,
      masterDataJobDetailError: error,
      masterDataJobDetailValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataRelationships(params = {}) {
  const endpoint = `${endpoints.masterDataRelationships}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      relationshipRows: readArray(payload, 'relationshipRows'),
      relationshipPage: payload.relationshipPage || {
        items: readArray(payload, 'relationshipRows'),
        page: 1,
        page_size: 20,
        total: readArray(payload, 'relationshipRows').length
      },
      masterDataRelationshipsLoading: isLoading,
      masterDataRelationshipsError: error,
      masterDataRelationshipsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataRelationshipOptions() {
  const { data, isLoading, error, isValidating } = useSWR(
    endpoints.masterDataRelationshipOptions,
    stationFetcher,
    swrOptions
  );
  const payload = data?.data || {};

  return useMemo(
    () => ({
      nodeTypes: readArray(payload, 'nodeTypes'),
      relationTypes: readArray(payload, 'relationTypes'),
      evidenceSources: readArray(payload, 'evidenceSources'),
      masterDataRelationshipOptionsLoading: isLoading,
      masterDataRelationshipOptionsError: error,
      masterDataRelationshipOptionsValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformMasterDataRelationshipDetail(relationshipId) {
  const endpoint = relationshipId ? endpoints.masterDataRelationshipDetail(relationshipId) : null;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      relationship: payload.relationship || null,
      chainRows: readArray(payload, 'chainRows'),
      masterDataRelationshipDetailLoading: isLoading,
      masterDataRelationshipDetailError: error,
      masterDataRelationshipDetailValidating: isValidating
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformReports() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.reports, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      reportMeta: payload.reportMeta || null,
      platformReportCards: readArray(payload, 'platformReportCards'),
      platformStationReportRows: readArray(payload, 'platformStationReportRows'),
      platformStationComparisonRows: readArray(payload, 'platformStationComparisonRows'),
      platformDailyReportRows: readArray(payload, 'platformDailyReportRows'),
      qualitySummaryRows: readArray(payload, 'qualitySummaryRows'),
      qualityChecklistRows: readArray(payload, 'qualityChecklistRows'),
      refreshPolicyRows: readArray(payload, 'refreshPolicyRows'),
      traceabilityRows: readArray(payload, 'traceabilityRows'),
      dailyKeyMetrics: readArray(payload?.dailyReport, 'keyMetrics'),
      reportsLoading: isLoading,
      reportsError: error,
      reportsValidating: isValidating,
      reportsUsingMock: Boolean(error || !payload.reportMeta || !readArray(payload, 'platformReportCards').length)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetPlatformGovernanceComparison(stationId = 'MME') {
  const endpoint = endpoints.stationGovernanceComparison(stationId);
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      comparisonAnchor: payload.comparison_anchor || null,
      comparisonRows: readArray(payload, 'comparison_rows'),
      metricRows: readArray(payload, 'metric_rows'),
      differenceSummaryRows: readArray(payload, 'difference_summary_rows'),
      issueBacklogRows: readArray(payload, 'issue_backlog_rows'),
      differencePathRows: readArray(payload, 'difference_path_rows'),
      governanceComparisonLoading: isLoading,
      governanceComparisonError: error,
      governanceComparisonValidating: isValidating,
      governanceComparisonUsingMock: Boolean(error || !payload.comparison_anchor)
    }),
    [payload, error, isLoading, isValidating]
  );
}

export function useGetStationAcceptanceRecordTemplate(stationId = 'MME') {
  const endpoint = endpoints.stationAcceptanceRecordTemplate(stationId);
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, swrOptions);
  const payload = data?.data || {};

  return useMemo(
    () => ({
      stationAcceptanceRecordTemplate: payload || null,
      acceptanceTemplateFields: readArray(payload, 'fields'),
      acceptanceTemplateLoading: isLoading,
      acceptanceTemplateError: error,
      acceptanceTemplateValidating: isValidating,
      acceptanceTemplateUsingMock: Boolean(error || !payload.stationId)
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

export async function refreshPlatformStationsCache() {
  await Promise.all([mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stations)), mutate(endpoints.stationOptions)]);
}

export async function createPlatformStation(payload) {
  const result = await stationPoster(endpoints.stations, payload);
  await refreshPlatformStationsCache();
  return result?.data || null;
}

export async function updatePlatformStation(stationId, payload) {
  const result = await stationPatcher(endpoints.stationDetail(stationId), payload);
  await Promise.all([refreshPlatformStationsCache(), mutate(endpoints.stationDetail(stationId))]);
  return result?.data || null;
}

export async function archivePlatformStation(stationId) {
  const result = await stationDeleter(endpoints.stationDetail(stationId));
  await Promise.all([refreshPlatformStationsCache(), mutate(endpoints.stationDetail(stationId))]);
  return result?.data || null;
}

export async function refreshPlatformTeamsCache() {
  await Promise.all([mutate((key) => typeof key === 'string' && key.startsWith(endpoints.teams)), mutate(endpoints.teamOptions)]);
}

export async function createPlatformTeam(payload) {
  const result = await stationPoster(endpoints.teams, payload);
  await refreshPlatformTeamsCache();
  return result?.data || null;
}

export async function updatePlatformTeam(teamId, payload) {
  const result = await stationPatcher(endpoints.teamDetail(teamId), payload);
  await Promise.all([refreshPlatformTeamsCache(), mutate(endpoints.teamDetail(teamId))]);
  return result?.data || null;
}

export async function archivePlatformTeam(teamId) {
  const result = await stationDeleter(endpoints.teamDetail(teamId));
  await Promise.all([refreshPlatformTeamsCache(), mutate(endpoints.teamDetail(teamId))]);
  return result?.data || null;
}

export async function refreshPlatformDevicesCache() {
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.devices)),
    mutate(endpoints.deviceOptions),
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stations))
  ]);
}

export async function createPlatformDevice(payload) {
  const result = await stationPoster(endpoints.devices, payload);
  await refreshPlatformDevicesCache();
  return result?.data || null;
}

export async function updatePlatformDevice(deviceId, payload) {
  const result = await stationPatcher(endpoints.deviceDetail(deviceId), payload);
  await Promise.all([refreshPlatformDevicesCache(), mutate(endpoints.deviceDetail(deviceId))]);
  return result?.data || null;
}

export async function archivePlatformDevice(deviceId) {
  const result = await stationDeleter(endpoints.deviceDetail(deviceId));
  await Promise.all([refreshPlatformDevicesCache(), mutate(endpoints.deviceDetail(deviceId))]);
  return result?.data || null;
}

export async function refreshPlatformZonesCache() {
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.zones)),
    mutate(endpoints.zoneOptions),
    mutate((key) => typeof key === 'string' && key.startsWith(`${endpoints.stations}/`))
  ]);
}

export async function createPlatformZone(payload) {
  const result = await stationPoster(endpoints.zones, payload);
  await refreshPlatformZonesCache();
  return result?.data || null;
}

export async function updatePlatformZone(zoneId, payload) {
  const result = await stationPatcher(endpoints.zoneDetail(zoneId), payload);
  await Promise.all([refreshPlatformZonesCache(), mutate(endpoints.zoneDetail(zoneId))]);
  return result?.data || null;
}

export async function archivePlatformZone(zoneId) {
  const result = await stationDeleter(endpoints.zoneDetail(zoneId));
  await Promise.all([refreshPlatformZonesCache(), mutate(endpoints.zoneDetail(zoneId))]);
  return result?.data || null;
}

export async function refreshPlatformNetworkCache() {
  await Promise.all([
    mutate(endpoints.network),
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.networkLanes)),
    mutate(endpoints.networkLaneOptions),
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.networkScenarios)),
    mutate(endpoints.networkScenarioOptions)
  ]);
}

export async function createPlatformNetworkLane(payload) {
  const result = await stationPoster(endpoints.networkLanes, payload);
  await refreshPlatformNetworkCache();
  return result?.data || null;
}

export async function updatePlatformNetworkLane(laneId, payload) {
  const result = await stationPatcher(endpoints.networkLaneDetail(laneId), payload);
  await Promise.all([refreshPlatformNetworkCache(), mutate(endpoints.networkLaneDetail(laneId))]);
  return result?.data || null;
}

export async function archivePlatformNetworkLane(laneId) {
  const result = await stationDeleter(endpoints.networkLaneDetail(laneId));
  await Promise.all([refreshPlatformNetworkCache(), mutate(endpoints.networkLaneDetail(laneId))]);
  return result?.data || null;
}

export async function createPlatformNetworkScenario(payload) {
  const result = await stationPoster(endpoints.networkScenarios, payload);
  await refreshPlatformNetworkCache();
  return result?.data || null;
}

export async function updatePlatformNetworkScenario(scenarioId, payload) {
  const result = await stationPatcher(endpoints.networkScenarioDetail(scenarioId), payload);
  await Promise.all([refreshPlatformNetworkCache(), mutate(endpoints.networkScenarioDetail(scenarioId))]);
  return result?.data || null;
}

export async function archivePlatformNetworkScenario(scenarioId) {
  const result = await stationDeleter(endpoints.networkScenarioDetail(scenarioId));
  await Promise.all([refreshPlatformNetworkCache(), mutate(endpoints.networkScenarioDetail(scenarioId))]);
  return result?.data || null;
}

export async function refreshPlatformRulesCache() {
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.rules)),
    mutate(endpoints.ruleOptions)
  ]);
}

export async function createPlatformRule(payload) {
  const result = await stationPoster(endpoints.rules, payload);
  await refreshPlatformRulesCache();
  return result?.data || null;
}

export async function updatePlatformRule(ruleId, payload) {
  const result = await stationPatcher(endpoints.ruleDetail(ruleId), payload);
  await Promise.all([refreshPlatformRulesCache(), mutate(endpoints.ruleDetail(ruleId))]);
  return result?.data || null;
}

export async function archivePlatformRule(ruleId) {
  const result = await stationDeleter(endpoints.ruleDetail(ruleId));
  await Promise.all([refreshPlatformRulesCache(), mutate(endpoints.ruleDetail(ruleId))]);
  return result?.data || null;
}

export async function refreshPlatformMasterDataCache() {
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.masterData)),
    mutate(endpoints.masterDataOptions)
  ]);
}

export async function createPlatformMasterData(payload) {
  const result = await stationPoster(endpoints.masterData, payload);
  await refreshPlatformMasterDataCache();
  return result?.data || null;
}

export async function updatePlatformMasterData(masterDataId, payload) {
  const result = await stationPatcher(endpoints.masterDataDetail(masterDataId), payload);
  await Promise.all([refreshPlatformMasterDataCache(), mutate(endpoints.masterDataDetail(masterDataId))]);
  return result?.data || null;
}

export async function archivePlatformMasterData(masterDataId) {
  const result = await stationDeleter(endpoints.masterDataDetail(masterDataId));
  await Promise.all([refreshPlatformMasterDataCache(), mutate(endpoints.masterDataDetail(masterDataId))]);
  return result?.data || null;
}

export async function refreshPlatformMasterDataSyncCache() {
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.masterDataSync)),
    mutate(endpoints.masterDataSyncOptions)
  ]);
}

export async function createPlatformMasterDataSync(payload) {
  const result = await stationPoster(endpoints.masterDataSync, payload);
  await refreshPlatformMasterDataSyncCache();
  return result?.data || null;
}

export async function updatePlatformMasterDataSync(syncId, payload) {
  const result = await stationPatcher(endpoints.masterDataSyncDetail(syncId), payload);
  await Promise.all([refreshPlatformMasterDataSyncCache(), mutate(endpoints.masterDataSyncDetail(syncId))]);
  return result?.data || null;
}

export async function archivePlatformMasterDataSync(syncId) {
  const result = await stationDeleter(endpoints.masterDataSyncDetail(syncId));
  await Promise.all([refreshPlatformMasterDataSyncCache(), mutate(endpoints.masterDataSyncDetail(syncId))]);
  return result?.data || null;
}

export async function refreshPlatformMasterDataJobsCache() {
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.masterDataJobs)),
    mutate(endpoints.masterDataJobOptions)
  ]);
}

export async function retryPlatformMasterDataJob(jobId) {
  const result = await stationPoster(endpoints.masterDataJobRetry(jobId), {});
  await Promise.all([refreshPlatformMasterDataJobsCache(), mutate(endpoints.masterDataJobDetail(jobId))]);
  return result?.data || null;
}

export async function replayPlatformMasterDataJob(jobId) {
  const result = await stationPoster(endpoints.masterDataJobReplay(jobId), {});
  await Promise.all([refreshPlatformMasterDataJobsCache(), mutate(endpoints.masterDataJobDetail(jobId))]);
  return result?.data || null;
}

export async function archivePlatformMasterDataJob(jobId) {
  const result = await stationPoster(endpoints.masterDataJobArchive(jobId), {});
  await Promise.all([refreshPlatformMasterDataJobsCache(), mutate(endpoints.masterDataJobDetail(jobId))]);
  return result?.data || null;
}

export async function refreshPlatformMasterDataRelationshipsCache() {
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.masterDataRelationships)),
    mutate(endpoints.masterDataRelationshipOptions)
  ]);
}
