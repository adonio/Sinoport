const DEMO_DATASETS_TABLE = 'demo_datasets';
const STATION_RESOURCE_VEHICLE_DATASET_PREFIX = 'sinoport.stationResourceVehicles';
const STATION_RESOURCE_VEHICLE_SOURCE_MODULE = 'apps/api-worker/src/routes/station.ts';
const STATION_RESOURCE_VEHICLE_EXPORT_NAME = 'stationResourceVehicles';
const STATION_RESOURCE_VEHICLE_PAYLOAD_KIND = 'json-array';
const STABLE_PLATFORM_STATIONS_VIEW = 'demo_platform_stations_payloads';
const STABLE_PLATFORM_NETWORK_VIEW = 'demo_platform_network_payloads';
const STABLE_PLATFORM_RULES_VIEW = 'demo_platform_rules_payloads';
const STABLE_PLATFORM_REPORTS_VIEW = 'demo_platform_reports_payloads';
const STABLE_STATION_RESOURCES_VIEW = 'demo_station_resources_payloads';
const STABLE_STATION_REPORTS_VIEW = 'demo_station_reports_payloads';
const STABLE_STATION_RESOURCE_VEHICLES_VIEW = 'demo_station_resource_vehicle_payloads';
const STABLE_PLATFORM_STATIONS_FALLBACK_KEYS = [
  'sinoport.stationCatalog',
  'sinoport-adapters.platformStationCapabilityRows',
  'sinoport-adapters.stationCapabilityColumns',
  'sinoport-adapters.platformStationTeamRows',
  'sinoport-adapters.platformStationZoneRows',
  'sinoport-adapters.platformStationDeviceRows'
];
const STABLE_PLATFORM_NETWORK_FALLBACK_KEYS = [
  'sinoport.stationCatalog',
  'sinoport.routeMatrix',
  'sinoport-adapters.networkLaneTemplateRows',
  'sinoport-adapters.networkScenarioRows'
];
const STABLE_PLATFORM_RULES_FALLBACK_KEYS = [
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
];
const STABLE_PLATFORM_REPORTS_FALLBACK_KEYS = [
  'sinoport-adapters.platformReportCards',
  'sinoport-adapters.platformStationReportRows',
  'sinoport-adapters.platformDailyReportRows'
];
const STABLE_STATION_RESOURCES_FALLBACK_KEYS = [
  'sinoport-adapters.resourceTeams',
  'sinoport-adapters.resourceZones',
  'sinoport-adapters.resourceDevices',
  'sinoport-adapters.platformStationTeamRows',
  'sinoport-adapters.platformStationZoneRows',
  'sinoport-adapters.platformStationDeviceRows'
];
const STABLE_STATION_REPORTS_FALLBACK_KEYS = [
  'sinoport-adapters.stationTaskBoard',
  'sinoport-adapters.stationDocumentRows',
  'sinoport-adapters.stationTransferRows',
  'sinoport-adapters.stationAuditFeed'
];
const STABLE_STATION_RESOURCE_VEHICLE_FALLBACK_KEYS = [
  'sinoport.stationResourceVehicles'
];

type DemoDatasetRecord = {
  dataset_key: string;
  source_module: string;
  export_name: string;
  payload_kind: string;
  row_count: number;
  payload: unknown;
  updated_at: string;
};

type DemoDatasetPayloadRow = {
  dataset_key: string;
  payload_json: string;
};

export function buildDemoDatasetKey(sourceModule: string, exportName: string) {
  return `${sourceModule}.${exportName}`;
}

export function buildStationResourceVehicleDatasetKey(stationId: string) {
  return `${STATION_RESOURCE_VEHICLE_DATASET_PREFIX}.${stationId}`;
}

function inferDemoDatasetRowCount(payload: unknown) {
  if (Array.isArray(payload)) return payload.length;
  if (payload && typeof payload === 'object') return Object.keys(payload as Record<string, unknown>).length;
  if (payload === null) return 0;
  return 1;
}

function parseDemoDatasetPayloadJson(payloadJson: unknown) {
  if (typeof payloadJson !== 'string' || !payloadJson.trim()) {
    return null;
  }

  try {
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

function toTextArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function mapDemoDatasetPayloadRows(rows: DemoDatasetPayloadRow[]) {
  return rows.reduce<Record<string, unknown>>((acc, row) => {
    acc[row.dataset_key] = parseDemoDatasetPayloadJson(row.payload_json);
    return acc;
  }, {});
}

async function loadDemoDatasetPayloadsFromView(db: any, viewName: string) {
  if (!db) {
    return {};
  }

  const rows = await db
    .prepare(
      `
        SELECT dataset_key, payload_json
        FROM ${viewName}
        ORDER BY dataset_key ASC
      `
    )
    .all();

  return mapDemoDatasetPayloadRows((rows?.results || []) as DemoDatasetPayloadRow[]);
}

async function loadDemoDatasetRecordFromView(db: any, viewName: string, datasetKey: string): Promise<DemoDatasetRecord | null> {
  if (!db) {
    return null;
  }

  const row = await db
    .prepare(
      `
        SELECT dataset_key, source_module, export_name, payload_kind, row_count, payload_json, updated_at
        FROM ${viewName}
        WHERE dataset_key = ?
        LIMIT 1
      `
    )
    .bind(datasetKey)
    .first();

  if (!row) {
    return null;
  }

  return {
    dataset_key: row.dataset_key,
    source_module: row.source_module,
    export_name: row.export_name,
    payload_kind: row.payload_kind,
    row_count: Number(row.row_count ?? 0),
    payload: parseDemoDatasetPayloadJson(row.payload_json),
    updated_at: row.updated_at
  };
}

async function loadStableDemoDatasetPayloads(db: any, viewName: string, fallbackKeys: string[]) {
  if (!db) {
    return loadDemoDatasetPayloads(null, fallbackKeys);
  }

  try {
    return await loadDemoDatasetPayloadsFromView(db, viewName);
  } catch {
    return loadDemoDatasetPayloads(db, fallbackKeys);
  }
}

export function normalizeStationResourceVehiclePlan(item: any) {
  const tripId = String(item?.tripId || item?.trip_id || item?.loading_plan_id || item?.id || '').trim();
  const flowKey = String(item?.flowKey || item?.flow_key || (tripId.toUpperCase().includes('TAIL') ? 'tailhaul' : 'headhaul') || 'headhaul').trim();
  const route = String(item?.route || item?.subtitle || item?.note || '').trim() || (flowKey === 'tailhaul' ? 'MME -> Delivery' : 'URC -> 出港货站');
  const plate = String(item?.plate || item?.truckPlate || item?.truck_plate || '').trim();
  const driver = String(item?.driver || item?.driverName || item?.driver_name || '').trim();
  const collectionNote = String(item?.collectionNote || item?.collection_note || '').trim();
  const stage = String(item?.stage || item?.plan_status || item?.status || '').trim() || '待处理';
  const status = String(item?.status || item?.plan_status || item?.stage || '').trim() || stage;
  const priority = String(item?.priority || '').trim() || (status === '待发车' ? 'P1' : 'P2');
  const sla = String(item?.sla || '').trim() || '待补充';
  const officePlan = String(item?.officePlan || item?.office_plan || item?.note || '').trim() || '后台已完成 Trip 编排。';
  const pdaExec = String(item?.pdaExec || item?.pda_exec || '').trim() || '现场执行发车、到站交接';

  return {
    tripId: tripId || `TRIP-${String(Date.now()).slice(-6)}`,
    flowKey,
    route,
    plate,
    driver,
    collectionNote,
    stage,
    status,
    priority,
    sla,
    awbs: toTextArray(item?.awbs),
    pallets: toTextArray(item?.pallets),
    officePlan,
    pdaExec
  };
}

export function buildDefaultStationResourceVehicles(stationId: string) {
  const stationCode = stationId || 'MME';

  return [
    {
      tripId: 'TRIP-URC-001',
      flowKey: 'headhaul',
      route: 'URC -> 出港货站',
      plate: 'URC-TRK-101',
      driver: 'Office Driver A',
      collectionNote: 'CN-URC-001',
      stage: '待发车',
      status: '待处理',
      priority: 'P1',
      sla: '收货完成后 20 分钟',
      awbs: ['436-10358585', '436-10359044', '436-10359218'],
      pallets: [],
      officePlan: '后台已锁定发车窗口，CMR 已生成。',
      pdaExec: '司机到场确认、发车、到站交接'
    },
    {
      tripId: 'TRIP-URC-002',
      flowKey: 'tailhaul',
      route: `${stationCode} -> Delivery`,
      plate: `${stationCode}-TRK-205`,
      driver: 'Office Driver B',
      collectionNote: 'CN-URC-002',
      stage: '在途',
      status: '运行中',
      priority: 'P2',
      sla: '在途回传每 30 分钟',
      awbs: ['436-10359301', '436-10359512'],
      pallets: [],
      officePlan: '后台已下发到站窗口。',
      pdaExec: '在途回传、到站交接'
    }
  ];
}

export async function loadDemoDatasetPayloads(db: any, datasetKeys: string[]): Promise<Record<string, unknown>> {
  const uniqueKeys = Array.from(new Set(datasetKeys.filter(Boolean)));

  if (!uniqueKeys.length) {
    return {};
  }

  if (!db) {
    return uniqueKeys.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = null;
      return acc;
    }, {});
  }

  const placeholders = uniqueKeys.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `
        SELECT dataset_key, payload_json
        FROM ${DEMO_DATASETS_TABLE}
        WHERE dataset_key IN (${placeholders})
      `
    )
    .bind(...uniqueKeys)
    .all();

  const payloads: Record<string, unknown> = {};

  for (const row of (rows?.results || []) as { dataset_key: string; payload_json: string }[]) {
    payloads[row.dataset_key] = parseDemoDatasetPayloadJson(row.payload_json);
  }

  for (const key of uniqueKeys) {
    if (!Object.prototype.hasOwnProperty.call(payloads, key)) {
      payloads[key] = null;
    }
  }

  return payloads;
}

export async function loadDemoDatasetCatalog(db: any) {
  if (!db) {
    return [];
  }

  const rows = await db
    .prepare(
      `
        SELECT dataset_key, source_module, export_name, payload_kind, row_count, updated_at
        FROM ${DEMO_DATASETS_TABLE}
        ORDER BY dataset_key ASC
      `
    )
    .all();

  return (rows?.results || []).map((item: any) => ({
    dataset_key: item.dataset_key,
    source_module: item.source_module,
    export_name: item.export_name,
    payload_kind: item.payload_kind,
    row_count: Number(item.row_count ?? 0),
    updated_at: item.updated_at
  }));
}

export async function loadDemoDatasetRecord(db: any, datasetKey: string): Promise<DemoDatasetRecord | null> {
  if (!db) {
    return null;
  }

  const row = await db
    .prepare(
      `
        SELECT dataset_key, source_module, export_name, payload_kind, row_count, payload_json, updated_at
        FROM ${DEMO_DATASETS_TABLE}
        WHERE dataset_key = ?
        LIMIT 1
      `
    )
    .bind(datasetKey)
    .first();

  if (!row) {
    return null;
  }

  return {
    dataset_key: row.dataset_key,
    source_module: row.source_module,
    export_name: row.export_name,
    payload_kind: row.payload_kind,
    row_count: Number(row.row_count ?? 0),
    payload: parseDemoDatasetPayloadJson(row.payload_json),
    updated_at: row.updated_at
  };
}

export async function loadStablePlatformStationsPayloads(db: any) {
  return loadStableDemoDatasetPayloads(db, STABLE_PLATFORM_STATIONS_VIEW, STABLE_PLATFORM_STATIONS_FALLBACK_KEYS);
}

export async function loadStablePlatformNetworkPayloads(db: any) {
  return loadStableDemoDatasetPayloads(db, STABLE_PLATFORM_NETWORK_VIEW, STABLE_PLATFORM_NETWORK_FALLBACK_KEYS);
}

export async function loadStablePlatformRulesPayloads(db: any) {
  return loadStableDemoDatasetPayloads(db, STABLE_PLATFORM_RULES_VIEW, STABLE_PLATFORM_RULES_FALLBACK_KEYS);
}

export async function loadStablePlatformReportsPayloads(db: any) {
  return loadStableDemoDatasetPayloads(db, STABLE_PLATFORM_REPORTS_VIEW, STABLE_PLATFORM_REPORTS_FALLBACK_KEYS);
}

export async function loadStableStationResourcesPayloads(db: any) {
  return loadStableDemoDatasetPayloads(db, STABLE_STATION_RESOURCES_VIEW, STABLE_STATION_RESOURCES_FALLBACK_KEYS);
}

export async function loadStableStationReportsPayloads(db: any) {
  return loadStableDemoDatasetPayloads(db, STABLE_STATION_REPORTS_VIEW, STABLE_STATION_REPORTS_FALLBACK_KEYS);
}

export async function upsertDemoDataset(
  db: any,
  {
    datasetKey,
    sourceModule,
    exportName,
    payloadKind,
    payload,
    rowCount = inferDemoDatasetRowCount(payload),
    createdAt = new Date().toISOString(),
    updatedAt = createdAt
  }: {
    datasetKey: string;
    sourceModule: string;
    exportName: string;
    payloadKind: string;
    payload: unknown;
    rowCount?: number;
    createdAt?: string;
    updatedAt?: string;
  }
) {
  if (!db) {
    return {
      dataset_key: datasetKey,
      source_module: sourceModule,
      export_name: exportName,
      payload_kind: payloadKind,
      row_count: rowCount,
      payload,
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  await db
    .prepare(
      `
        INSERT INTO ${DEMO_DATASETS_TABLE} (
          dataset_key,
          source_module,
          export_name,
          payload_kind,
          row_count,
          payload_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(dataset_key) DO UPDATE SET
          source_module = excluded.source_module,
          export_name = excluded.export_name,
          payload_kind = excluded.payload_kind,
          row_count = excluded.row_count,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `
    )
    .bind(
      datasetKey,
      sourceModule,
      exportName,
      payloadKind,
      rowCount,
      JSON.stringify(payload),
      createdAt,
      updatedAt
    )
    .run();

  return {
    dataset_key: datasetKey,
    source_module: sourceModule,
    export_name: exportName,
    payload_kind: payloadKind,
    row_count: rowCount,
    payload,
    created_at: createdAt,
    updated_at: updatedAt
  };
}

export async function loadStationResourceVehicles(db: any, stationId: string) {
  const defaultVehicles = buildDefaultStationResourceVehicles(stationId);

  if (!db) {
    return defaultVehicles;
  }

  const row =
    (await loadDemoDatasetRecordFromView(db, STABLE_STATION_RESOURCE_VEHICLES_VIEW, buildStationResourceVehicleDatasetKey(stationId))) ||
    (await loadDemoDatasetRecord(db, buildStationResourceVehicleDatasetKey(stationId)));

  if (!row?.payload) {
    return defaultVehicles;
  }

  try {
    const payload = row.payload;
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as any)?.items)
        ? (payload as any).items
        : Array.isArray((payload as any)?.plans)
          ? (payload as any).plans
          : [];

    return items.map(normalizeStationResourceVehiclePlan).filter((item: any) => item.tripId);
  } catch {
    return defaultVehicles;
  }
}

export async function saveStationResourceVehicles(db: any, stationId: string, items: any[]) {
  if (!db) {
    return items;
  }

  await upsertDemoDataset(db, {
    datasetKey: buildStationResourceVehicleDatasetKey(stationId),
    sourceModule: STATION_RESOURCE_VEHICLE_SOURCE_MODULE,
    exportName: STATION_RESOURCE_VEHICLE_EXPORT_NAME,
    payloadKind: STATION_RESOURCE_VEHICLE_PAYLOAD_KIND,
    payload: items,
    rowCount: items.length
  });

  return items;
}
