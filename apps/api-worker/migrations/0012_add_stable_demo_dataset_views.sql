CREATE VIEW IF NOT EXISTS demo_platform_stations_payloads AS
SELECT
  dataset_key,
  source_module,
  export_name,
  payload_kind,
  row_count,
  payload_json,
  created_at,
  updated_at
FROM demo_datasets
WHERE dataset_key IN (
  'sinoport.stationCatalog',
  'sinoport-adapters.platformStationCapabilityRows',
  'sinoport-adapters.stationCapabilityColumns',
  'sinoport-adapters.platformStationTeamRows',
  'sinoport-adapters.platformStationZoneRows',
  'sinoport-adapters.platformStationDeviceRows'
);

CREATE VIEW IF NOT EXISTS demo_platform_network_payloads AS
SELECT
  dataset_key,
  source_module,
  export_name,
  payload_kind,
  row_count,
  payload_json,
  created_at,
  updated_at
FROM demo_datasets
WHERE dataset_key IN (
  'sinoport.stationCatalog',
  'sinoport.routeMatrix',
  'sinoport-adapters.networkLaneTemplateRows',
  'sinoport-adapters.networkScenarioRows'
);

CREATE VIEW IF NOT EXISTS demo_platform_rules_payloads AS
SELECT
  dataset_key,
  source_module,
  export_name,
  payload_kind,
  row_count,
  payload_json,
  created_at,
  updated_at
FROM demo_datasets
WHERE dataset_key IN (
  'sinoport.serviceLevels',
  'sinoport.hardGateRules',
  'sinoport.exceptionTaxonomy',
  'sinoport.interfaceStatus',
  'sinoport-adapters.ruleOverviewRows',
  'sinoport-adapters.hardGatePolicyRows',
  'sinoport-adapters.ruleTemplateRows',
  'sinoport-adapters.evidencePolicyRows',
  'sinoport-adapters.scenarioTimelineRows',
  'sinoport-adapters.gateEvaluationRows'
);

CREATE VIEW IF NOT EXISTS demo_platform_reports_payloads AS
SELECT
  dataset_key,
  source_module,
  export_name,
  payload_kind,
  row_count,
  payload_json,
  created_at,
  updated_at
FROM demo_datasets
WHERE dataset_key IN (
  'sinoport-adapters.platformReportCards',
  'sinoport-adapters.platformStationReportRows',
  'sinoport-adapters.platformDailyReportRows'
);

CREATE VIEW IF NOT EXISTS demo_station_resources_payloads AS
SELECT
  dataset_key,
  source_module,
  export_name,
  payload_kind,
  row_count,
  payload_json,
  created_at,
  updated_at
FROM demo_datasets
WHERE dataset_key IN (
  'sinoport-adapters.resourceTeams',
  'sinoport-adapters.resourceZones',
  'sinoport-adapters.resourceDevices',
  'sinoport-adapters.platformStationTeamRows',
  'sinoport-adapters.platformStationZoneRows',
  'sinoport-adapters.platformStationDeviceRows'
);

CREATE VIEW IF NOT EXISTS demo_station_reports_payloads AS
SELECT
  dataset_key,
  source_module,
  export_name,
  payload_kind,
  row_count,
  payload_json,
  created_at,
  updated_at
FROM demo_datasets
WHERE dataset_key IN (
  'sinoport-adapters.stationTaskBoard',
  'sinoport-adapters.stationDocumentRows',
  'sinoport-adapters.stationTransferRows',
  'sinoport-adapters.stationAuditFeed'
);

CREATE VIEW IF NOT EXISTS demo_station_resource_vehicle_payloads AS
SELECT
  dataset_key,
  source_module,
  export_name,
  payload_kind,
  row_count,
  payload_json,
  created_at,
  updated_at
FROM demo_datasets
WHERE dataset_key LIKE 'sinoport.stationResourceVehicles.%';
