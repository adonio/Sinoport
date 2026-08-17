import type { D1DatabaseLike } from '@sinoport/repositories';
import type { IntegrationEventEnvelope } from '@sinoport/contracts';

const encoder = new TextEncoder();
const MAX_CLOCK_SKEW_SECONDS = 300;

export class IntegrationSyncError extends Error {
  constructor(
    public readonly status: 400 | 401 | 404 | 409 | 500,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'IntegrationSyncError';
  }
}

type IntegrationBindings = {
  DB?: D1DatabaseLike;
  SKYLEDGER_BASE_URL?: string;
  SKYLEDGER_INTEGRATION_SECRET?: string;
};

type InboxRow = {
  event_id: string;
  payload_hash: string;
  processing_status: string;
};

type LinkRow = {
  local_object_id: string;
  source_version: number;
};

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForCanonicalJson);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortForCanonicalJson(child)])
    );
  }

  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(sortForCanonicalJson(value));
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(value: string) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

export async function hmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return bytesToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyIntegrationSignature(params: {
  secret?: string;
  timestamp?: string;
  signature?: string;
  rawBody: string;
  now?: Date;
}) {
  if (!params.secret) {
    throw new IntegrationSyncError(500, 'INTEGRATION_SECRET_MISSING', 'Integration secret is not configured');
  }
  if (!params.timestamp || !params.signature) {
    throw new IntegrationSyncError(401, 'SIGNATURE_REQUIRED', 'Integration timestamp and signature are required');
  }

  const timestampSeconds = Number(params.timestamp);
  const nowSeconds = Math.floor((params.now ?? new Date()).getTime() / 1000);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    throw new IntegrationSyncError(401, 'SIGNATURE_EXPIRED', 'Integration signature is outside the replay window');
  }

  const expected = await hmacSha256Hex(params.secret, `${params.timestamp}.${params.rawBody}`);
  if (!constantTimeEqual(expected, params.signature.toLowerCase())) {
    throw new IntegrationSyncError(401, 'SIGNATURE_INVALID', 'Integration signature is invalid');
  }
}

function requireDb(env: IntegrationBindings) {
  if (!env.DB) {
    throw new IntegrationSyncError(500, 'DATABASE_NOT_CONFIGURED', 'D1 database binding is not configured');
  }
  return env.DB;
}

function requiredText(payload: Record<string, unknown>, key: string) {
  const value = String(payload[key] ?? '').trim();
  if (!value) {
    throw new IntegrationSyncError(400, 'INVALID_EVENT_PAYLOAD', `payload.${key} is required`, { field: key });
  }
  return value;
}

function optionalText(payload: Record<string, unknown>, key: string) {
  const value = String(payload[key] ?? '').trim();
  return value || null;
}

function numberValue(payload: Record<string, unknown>, key: string, fallback = 0) {
  const value = Number(payload[key]);
  return Number.isFinite(value) ? value : fallback;
}

function validateEnvelope(value: unknown): IntegrationEventEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new IntegrationSyncError(400, 'INVALID_EVENT', 'Event envelope must be an object');
  }
  const event = value as IntegrationEventEnvelope;
  const required = [
    'event_id',
    'event_type',
    'source_system',
    'aggregate_type',
    'aggregate_id',
    'occurred_at',
    'payload_hash'
  ] as const;
  for (const key of required) {
    if (!String(event[key] ?? '').trim()) {
      throw new IntegrationSyncError(400, 'INVALID_EVENT', `${key} is required`, { field: key });
    }
  }
  if (event.source_system !== 'SKYLEDGER') {
    throw new IntegrationSyncError(400, 'INVALID_SOURCE_SYSTEM', 'Only SKYLEDGER events are accepted on this endpoint');
  }
  if (event.schema_version !== 1 || !Number.isInteger(event.aggregate_sequence) || event.aggregate_sequence < 1) {
    throw new IntegrationSyncError(400, 'INVALID_EVENT', 'schema_version must be 1 and aggregate_sequence must be positive');
  }
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    throw new IntegrationSyncError(400, 'INVALID_EVENT', 'payload must be an object');
  }
  return event;
}

async function loadLink(
  db: D1DatabaseLike,
  objectType: string,
  externalObjectId: string
): Promise<LinkRow | null> {
  return db
    .prepare(
      `SELECT local_object_id, source_version
       FROM integration_external_object_links
       WHERE source_system = 'SKYLEDGER' AND object_type = ? AND external_object_id = ?`
    )
    .bind(objectType, externalObjectId)
    .first<LinkRow>();
}

async function upsertLink(
  db: D1DatabaseLike,
  params: {
    objectType: string;
    localObjectId: string;
    externalObjectId: string;
    naturalKey?: string | null;
    sequence: number;
    eventId: string;
    now: string;
  }
) {
  const existing = await loadLink(db, params.objectType, params.externalObjectId);
  if (existing && existing.local_object_id !== params.localObjectId) {
    throw new IntegrationSyncError(409, 'OBJECT_LINK_CONFLICT', 'External object is already linked to another local object', {
      object_type: params.objectType,
      external_object_id: params.externalObjectId
    });
  }

  await db
    .prepare(
      `INSERT INTO integration_external_object_links (
         link_id, source_system, object_type, local_object_id, external_object_id, natural_key,
         source_version, last_event_id, last_synced_at, created_at, updated_at
       ) VALUES (?, 'SKYLEDGER', ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_system, object_type, external_object_id) DO UPDATE SET
         natural_key = excluded.natural_key,
         source_version = excluded.source_version,
         last_event_id = excluded.last_event_id,
         last_synced_at = excluded.last_synced_at,
         updated_at = excluded.updated_at`
    )
    .bind(
      `LINK-${crypto.randomUUID()}`,
      params.objectType,
      params.localObjectId,
      params.externalObjectId,
      params.naturalKey ?? null,
      params.sequence,
      params.eventId,
      params.now,
      params.now,
      params.now
    )
    .run();
}

async function ensureStation(db: D1DatabaseLike, stationId: string, now: string) {
  await db
    .prepare(
      `INSERT INTO stations (station_id, station_name, region, control_level, phase, created_at, updated_at)
       VALUES (?, ?, 'Central Asia', 'L1', 'v1.4-pilot', ?, ?)
       ON CONFLICT(station_id) DO NOTHING`
    )
    .bind(stationId, `${stationId} Operations`, now, now)
    .run();
}

async function applyFlightBaseline(db: D1DatabaseLike, event: IntegrationEventEnvelope, now: string) {
  const payload = event.payload as Record<string, unknown>;
  const tenantId = optionalText(payload, 'tenant_id') ?? 'sinoport-demo';
  const externalId = requiredText(payload, 'skyledger_flight_id');
  const existing = await loadLink(db, 'Flight', externalId);
  const localId = existing?.local_object_id ?? `FLT-SKY-${externalId}`;
  const stationId = optionalText(payload, 'station_id') ?? 'TAS';
  const flightNo = requiredText(payload, 'flight_no');
  const flightDate = requiredText(payload, 'flight_date');
  const origin = requiredText(payload, 'origin_code');
  const destination = requiredText(payload, 'destination_code');
  const existingScope = await db.prepare(
    `SELECT tenant_id, station_id FROM v14_flight_tenant_scopes WHERE flight_id = ?`
  ).bind(localId).first<{ tenant_id: string; station_id: string }>();
  if (existingScope && (existingScope.tenant_id !== tenantId || existingScope.station_id !== stationId)) {
    throw new IntegrationSyncError(409, 'FLIGHT_SCOPE_MISMATCH', 'Flight is already owned by another tenant or station');
  }
  await ensureStation(db, stationId, now);
  await db
    .prepare(
      `INSERT INTO flights (
         flight_id, station_id, flight_no, flight_date, origin_code, destination_code,
         std_at, etd_at, sta_at, eta_at, runtime_status, service_level, aircraft_type,
         notes, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(flight_id) DO UPDATE SET
         flight_no = excluded.flight_no,
         flight_date = excluded.flight_date,
         origin_code = excluded.origin_code,
         destination_code = excluded.destination_code,
         std_at = excluded.std_at,
         etd_at = excluded.etd_at,
         sta_at = excluded.sta_at,
         eta_at = excluded.eta_at,
         runtime_status = excluded.runtime_status,
         aircraft_type = excluded.aircraft_type,
         notes = excluded.notes,
         updated_at = excluded.updated_at`
    )
    .bind(
      localId,
      stationId,
      flightNo,
      flightDate,
      origin,
      destination,
      optionalText(payload, 'std_at'),
      optionalText(payload, 'etd_at'),
      optionalText(payload, 'sta_at'),
      optionalText(payload, 'eta_at'),
      optionalText(payload, 'runtime_status') ?? 'Scheduled',
      optionalText(payload, 'service_level') ?? 'P1',
      optionalText(payload, 'aircraft_type'),
      `Synced from Skyledger event ${event.event_id}`,
      now,
      now
    )
    .run();
  await db.prepare(
    `INSERT INTO v14_flight_tenant_scopes (
       flight_id, tenant_id, station_id, source_type, source_ref, created_by, created_at
     ) VALUES (?, ?, ?, 'SKYLEDGER_SYNC', ?, 'skyledger-integration', ?)
     ON CONFLICT(flight_id) DO NOTHING`
  ).bind(localId, tenantId, stationId, event.event_id, now).run();
  await upsertLink(db, {
    objectType: 'Flight',
    localObjectId: localId,
    externalObjectId: externalId,
    naturalKey: `${flightNo}/${flightDate}`,
    sequence: event.aggregate_sequence,
    eventId: event.event_id,
    now
  });
  return { object_type: 'Flight', object_id: localId };
}

async function applyFlightSchedule(db: D1DatabaseLike, event: IntegrationEventEnvelope, now: string) {
  const payload = event.payload as Record<string, unknown>;
  const externalId = requiredText(payload, 'skyledger_flight_id');
  const link = await loadLink(db, 'Flight', externalId);
  if (!link) throw new IntegrationSyncError(404, 'FLIGHT_BASELINE_REQUIRED', 'Flight baseline must be synced first');
  await db
    .prepare(
      `UPDATE flights SET
         etd_at = COALESCE(?, etd_at), eta_at = COALESCE(?, eta_at),
         runtime_status = COALESCE(?, runtime_status), updated_at = ?
       WHERE flight_id = ?`
    )
    .bind(
      optionalText(payload, 'etd_at'),
      optionalText(payload, 'eta_at'),
      optionalText(payload, 'runtime_status'),
      now,
      link.local_object_id
    )
    .run();
  await upsertLink(db, {
    objectType: 'Flight',
    localObjectId: link.local_object_id,
    externalObjectId: externalId,
    naturalKey: optionalText(payload, 'flight_no'),
    sequence: event.aggregate_sequence,
    eventId: event.event_id,
    now
  });
  return { object_type: 'Flight', object_id: link.local_object_id };
}

async function applyAwbBaseline(db: D1DatabaseLike, event: IntegrationEventEnvelope, now: string) {
  const payload = event.payload as Record<string, unknown>;
  const tenantId = optionalText(payload, 'tenant_id') ?? 'sinoport-demo';
  const externalAwbId = requiredText(payload, 'skyledger_awb_id');
  const awbNo = requiredText(payload, 'awb_no');
  const existing = await loadLink(db, 'Awb', externalAwbId);
  const localAwbId = existing?.local_object_id ?? `AWB-SKY-${externalAwbId}`;
  const shipmentExternalId = optionalText(payload, 'skyledger_shipment_id') ?? `AWB-${externalAwbId}`;
  const shipmentLink = await loadLink(db, 'Shipment', shipmentExternalId);
  const shipmentId = shipmentLink?.local_object_id ?? `SHP-SKY-${shipmentExternalId}`;
  const stationId = optionalText(payload, 'station_id') ?? 'TAS';
  const flightExternalId = optionalText(payload, 'skyledger_flight_id');
  const flightLink = flightExternalId ? await loadLink(db, 'Flight', flightExternalId) : null;
  const existingIntake = await db.prepare(
    `SELECT tenant_id, control_station_id FROM v14_awb_intakes WHERE awb_id = ?`
  ).bind(localAwbId).first<{ tenant_id: string; control_station_id: string }>();
  if (existingIntake && (existingIntake.tenant_id !== tenantId || existingIntake.control_station_id !== stationId)) {
    throw new IntegrationSyncError(409, 'AWB_SCOPE_MISMATCH', 'AWB is already owned by another tenant or station');
  }
  if (flightLink) {
    const flightScope = await db.prepare(
      `SELECT tenant_id, station_id FROM v14_flight_tenant_scopes WHERE flight_id = ?`
    ).bind(flightLink.local_object_id).first<{ tenant_id: string; station_id: string }>();
    if (!flightScope || flightScope.tenant_id !== tenantId || flightScope.station_id !== stationId) {
      throw new IntegrationSyncError(409, 'FLIGHT_SCOPE_MISMATCH', 'AWB flight must belong to the same tenant and station');
    }
  }
  await ensureStation(db, stationId, now);
  await db
    .prepare(
      `INSERT INTO shipments (
         shipment_id, station_id, order_id, shipment_type, current_node, fulfillment_status,
         service_level, total_pieces, total_weight, created_at, updated_at
       ) VALUES (?, ?, ?, 'CROSS_BORDER_AIR', 'Front Warehouse Receiving', 'Front Warehouse Receiving', ?, ?, ?, ?, ?)
       ON CONFLICT(shipment_id) DO UPDATE SET
         total_pieces = excluded.total_pieces, total_weight = excluded.total_weight,
         service_level = excluded.service_level, updated_at = excluded.updated_at`
    )
    .bind(
      shipmentId,
      stationId,
      optionalText(payload, 'order_id'),
      optionalText(payload, 'service_level') ?? 'P1',
      Math.max(0, Math.trunc(numberValue(payload, 'pieces'))),
      Math.max(0, numberValue(payload, 'gross_weight')),
      now,
      now
    )
    .run();
  await db
    .prepare(
      `INSERT INTO awbs (
         awb_id, awb_no, shipment_id, flight_id, station_id, hawb_no, shipper_name,
         consignee_name, goods_description, pieces, gross_weight, current_node, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Front Warehouse Receiving', ?, ?)
       ON CONFLICT(awb_id) DO UPDATE SET
         awb_no = excluded.awb_no, shipment_id = excluded.shipment_id, flight_id = excluded.flight_id,
         station_id = excluded.station_id, hawb_no = excluded.hawb_no, shipper_name = excluded.shipper_name,
         consignee_name = excluded.consignee_name, goods_description = excluded.goods_description,
         pieces = excluded.pieces, gross_weight = excluded.gross_weight, updated_at = excluded.updated_at`
    )
    .bind(
      localAwbId,
      awbNo,
      shipmentId,
      flightLink?.local_object_id ?? null,
      stationId,
      optionalText(payload, 'hawb_no'),
      optionalText(payload, 'shipper_name'),
      optionalText(payload, 'consignee_name'),
      optionalText(payload, 'goods_description'),
      Math.max(0, Math.trunc(numberValue(payload, 'pieces'))),
      Math.max(0, numberValue(payload, 'gross_weight')),
      now,
      now
    )
    .run();
  if (flightLink) {
    await db.prepare(
      `INSERT INTO v14_awb_intakes (
         awb_intake_id, tenant_id, control_station_id, origin_execution_station_id,
         shipment_id, awb_id, flight_id, source_type, source_ref, created_by, created_at
       ) VALUES (?, ?, ?, 'SZX', ?, ?, ?, 'SKYLEDGER_SYNC', ?, 'skyledger-integration', ?)
       ON CONFLICT(tenant_id, awb_id) DO UPDATE SET
         shipment_id = excluded.shipment_id, flight_id = excluded.flight_id, source_ref = excluded.source_ref`
    ).bind(
      `INTAKE-SKY-${externalAwbId}`, tenantId, stationId, shipmentId, localAwbId,
      flightLink.local_object_id, event.event_id, now
    ).run();
  }
  await upsertLink(db, {
    objectType: 'Shipment', localObjectId: shipmentId, externalObjectId: shipmentExternalId,
    naturalKey: optionalText(payload, 'order_id'), sequence: event.aggregate_sequence, eventId: event.event_id, now
  });
  await upsertLink(db, {
    objectType: 'Awb', localObjectId: localAwbId, externalObjectId: externalAwbId,
    naturalKey: awbNo, sequence: event.aggregate_sequence, eventId: event.event_id, now
  });
  return { object_type: 'Awb', object_id: localAwbId, shipment_id: shipmentId };
}

async function applyTruckAssignment(db: D1DatabaseLike, event: IntegrationEventEnvelope, now: string) {
  const payload = event.payload as Record<string, unknown>;
  const externalJobId = requiredText(payload, 'skyledger_truck_job_id');
  const shipmentExternalId = requiredText(payload, 'skyledger_shipment_id');
  const shipmentLink = await loadLink(db, 'Shipment', shipmentExternalId);
  if (!shipmentLink) throw new IntegrationSyncError(404, 'SHIPMENT_BASELINE_REQUIRED', 'Shipment baseline must be synced first');
  const flightExternalId = optionalText(payload, 'skyledger_flight_id');
  const flightLink = flightExternalId ? await loadLink(db, 'Flight', flightExternalId) : null;
  const existing = await loadLink(db, 'TransportJob', externalJobId);
  const localJobId = existing?.local_object_id ?? `TRJ-SKY-${externalJobId}`;
  const stationId = optionalText(payload, 'station_id') ?? 'SZX';
  await ensureStation(db, stationId, now);
  await db
    .prepare(
      `INSERT INTO transport_jobs (
         transport_job_id, tenant_id, station_id, shipment_id, flight_id, awb_ids_json,
         origin_facility_id, destination_facility_id, route_template_id, route_template_version,
         planned_loading_at, planned_departure_at, planned_arrival_at, status, health_state,
         carrier_party_id, dispatcher_id, planned_capacity_weight_kg, planned_capacity_volume_m3,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, ?, ?, ?, 'PLANNED', 'UNKNOWN', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(transport_job_id) DO UPDATE SET
         flight_id = excluded.flight_id, awb_ids_json = excluded.awb_ids_json,
         planned_loading_at = excluded.planned_loading_at, planned_departure_at = excluded.planned_departure_at,
         planned_arrival_at = excluded.planned_arrival_at, carrier_party_id = excluded.carrier_party_id,
         dispatcher_id = excluded.dispatcher_id, planned_capacity_weight_kg = excluded.planned_capacity_weight_kg,
         planned_capacity_volume_m3 = excluded.planned_capacity_volume_m3,
         row_version = transport_jobs.row_version + 1, updated_at = excluded.updated_at`
    )
    .bind(
      localJobId,
      optionalText(payload, 'tenant_id') ?? 'sinoport-demo',
      stationId,
      shipmentLink.local_object_id,
      flightLink?.local_object_id ?? null,
      JSON.stringify(Array.isArray(payload.awb_ids) ? payload.awb_ids : []),
      optionalText(payload, 'origin_facility_id') ?? 'SZX_PREWAREHOUSE',
      optionalText(payload, 'destination_facility_id') ?? 'TAS_AIRPORT_STAGING',
      optionalText(payload, 'planned_loading_at'),
      optionalText(payload, 'planned_departure_at'),
      optionalText(payload, 'planned_arrival_at'),
      optionalText(payload, 'carrier_party_id'),
      optionalText(payload, 'dispatcher_id'),
      numberValue(payload, 'planned_capacity_weight_kg') || null,
      numberValue(payload, 'planned_capacity_volume_m3') || null,
      now,
      now
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO checkpoint_instances (
         checkpoint_instance_id, transport_job_id, checkpoint_template_id, template_version, sequence
       )
       SELECT 'CPI-' || lower(hex(randomblob(16))), ?, checkpoint_template_id,
              route_template_version, sequence
       FROM checkpoint_templates
       WHERE route_template_id = 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2'
         AND route_template_version = 2`
    )
    .bind(localJobId)
    .run();
  await upsertLink(db, {
    objectType: 'TransportJob', localObjectId: localJobId, externalObjectId: externalJobId,
    naturalKey: optionalText(payload, 'job_no'), sequence: event.aggregate_sequence, eventId: event.event_id, now
  });
  return { object_type: 'TransportJob', object_id: localJobId };
}

async function applyTruckLocation(db: D1DatabaseLike, event: IntegrationEventEnvelope, now: string) {
  const payload = event.payload as Record<string, unknown>;
  const externalJobId = requiredText(payload, 'skyledger_truck_job_id');
  const jobLink = await loadLink(db, 'TransportJob', externalJobId);
  if (!jobLink) throw new IntegrationSyncError(404, 'TRANSPORT_JOB_REQUIRED', 'Transport job must be synced first');
  const sourceEventId = optionalText(payload, 'source_event_id') ?? event.event_id;
  const eventId = `LOC-${event.event_id}`;
  await db
    .prepare(
      `INSERT INTO location_events (
         location_event_id, tenant_id, transport_job_id, provider_code, source_event_id, source_type,
         occurred_at, received_at, latitude, longitude, accuracy_m, speed_kph, heading,
         place_name, quality_status, raw_payload_ref, idempotency_key, signature_valid, mapping_status
       ) VALUES (?, ?, ?, ?, ?, 'SKYLEDGER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'MAPPED')
       ON CONFLICT(provider_code, source_event_id) DO NOTHING`
    )
    .bind(
      eventId,
      optionalText(payload, 'tenant_id') ?? 'sinoport-demo',
      jobLink.local_object_id,
      optionalText(payload, 'provider_code') ?? 'SKYLEDGER',
      sourceEventId,
      requiredText(payload, 'occurred_at'),
      now,
      numberValue(payload, 'latitude'),
      numberValue(payload, 'longitude'),
      numberValue(payload, 'accuracy_m') || null,
      numberValue(payload, 'speed_kph') || null,
      numberValue(payload, 'heading_deg') || null,
      optionalText(payload, 'place_name'),
      Boolean(payload.stale_flag) ? 'STALE' : 'VALID',
      JSON.stringify(payload),
      sourceEventId
    )
    .run();
  await db
    .prepare(
      `UPDATE transport_jobs SET last_location_event_id = ?, last_location_at = ?,
         health_state = CASE WHEN ? = 1 THEN 'STALE' ELSE health_state END,
         updated_at = ?, row_version = row_version + 1 WHERE transport_job_id = ?`
    )
    .bind(eventId, requiredText(payload, 'occurred_at'), Number(Boolean(payload.stale_flag)), now, jobLink.local_object_id)
    .run();
  await upsertLink(db, {
    objectType: 'TransportJob', localObjectId: jobLink.local_object_id, externalObjectId: externalJobId,
    sequence: event.aggregate_sequence, eventId: event.event_id, now
  });
  return { object_type: 'LocationEvent', object_id: eventId, transport_job_id: jobLink.local_object_id };
}

async function dispatchInbound(db: D1DatabaseLike, event: IntegrationEventEnvelope, now: string) {
  switch (event.event_type) {
    case 'flight.baseline_published.v1':
      return applyFlightBaseline(db, event, now);
    case 'flight.schedule_changed.v1':
      return applyFlightSchedule(db, event, now);
    case 'awb.baseline_upserted.v1':
      return applyAwbBaseline(db, event, now);
    case 'truck.assignment_published.v1':
      return applyTruckAssignment(db, event, now);
    case 'truck.location_observed.v1':
      return applyTruckLocation(db, event, now);
    default:
      throw new IntegrationSyncError(400, 'UNSUPPORTED_EVENT_TYPE', `Unsupported event type ${event.event_type}`);
  }
}

export async function ingestSkyledgerEvent(env: IntegrationBindings, rawEvent: unknown) {
  const db = requireDb(env);
  const event = validateEnvelope(rawEvent);
  const now = new Date().toISOString();
  const computedHash = await sha256Hex(canonicalJson(event.payload));
  if (computedHash !== event.payload_hash.toLowerCase()) {
    throw new IntegrationSyncError(400, 'PAYLOAD_HASH_MISMATCH', 'payload_hash does not match canonical payload');
  }

  const duplicate = await db
    .prepare(`SELECT event_id, payload_hash, processing_status FROM integration_inbox_events WHERE event_id = ?`)
    .bind(event.event_id)
    .first<InboxRow>();
  if (duplicate) {
    if (duplicate.payload_hash !== event.payload_hash) {
      throw new IntegrationSyncError(409, 'IDEMPOTENCY_CONFLICT', 'event_id was already used with another payload');
    }
    if (duplicate.processing_status !== 'FAILED') {
      return { event_id: event.event_id, status: duplicate.processing_status, duplicate: true };
    }
  }

  const aggregateLink = await loadLink(db, event.aggregate_type, event.aggregate_id);
  const expectedSequence = (aggregateLink?.source_version ?? 0) + 1;
  if (event.aggregate_sequence !== expectedSequence) {
    throw new IntegrationSyncError(409, 'EVENT_SEQUENCE_GAP', 'Aggregate sequence is out of order', {
      expected_sequence: expectedSequence,
      received_sequence: event.aggregate_sequence
    });
  }

  if (duplicate) {
    await db
      .prepare(
        `UPDATE integration_inbox_events SET processing_status = 'PROCESSING', processed_at = NULL,
           error_code = NULL, error_message = NULL WHERE event_id = ?`
      )
      .bind(event.event_id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO integration_inbox_events (
           event_id, source_system, event_type, schema_version, aggregate_type, aggregate_id,
           aggregate_sequence, correlation_id, causation_id, occurred_at, received_at,
           payload_json, payload_hash, signature_valid, processing_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'PROCESSING')`
      )
      .bind(
        event.event_id,
        event.source_system,
        event.event_type,
        event.schema_version,
        event.aggregate_type,
        event.aggregate_id,
        event.aggregate_sequence,
        event.correlation_id ?? null,
        event.causation_id ?? null,
        event.occurred_at,
        now,
        JSON.stringify(event.payload),
        event.payload_hash
      )
      .run();
  }

  try {
    const applied = await dispatchInbound(db, event, now);
    await db
      .prepare(`UPDATE integration_inbox_events SET processing_status = 'APPLIED', processed_at = ? WHERE event_id = ?`)
      .bind(now, event.event_id)
      .run();
    return { event_id: event.event_id, status: 'APPLIED', duplicate: false, retried: Boolean(duplicate), applied };
  } catch (error) {
    await db
      .prepare(
        `UPDATE integration_inbox_events SET processing_status = 'FAILED', processed_at = ?,
           error_code = ?, error_message = ? WHERE event_id = ?`
      )
      .bind(
        now,
        error instanceof IntegrationSyncError ? error.code : 'INBOUND_APPLY_FAILED',
        error instanceof Error ? error.message : 'Inbound apply failed',
        event.event_id
      )
      .run();
    throw error;
  }
}

export async function enqueueSkyledgerEvent(
  env: IntegrationBindings,
  params: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    correlationId?: string | null;
    causationId?: string | null;
  }
) {
  const db = requireDb(env);
  const now = new Date().toISOString();
  const sequenceRow = await db
    .prepare(
      `SELECT COALESCE(MAX(aggregate_sequence), 0) AS current_sequence
       FROM integration_outbox_events
       WHERE target_system = 'SKYLEDGER' AND aggregate_type = ? AND aggregate_id = ?`
    )
    .bind(params.aggregateType, params.aggregateId)
    .first<{ current_sequence: number }>();
  const sequence = Number(sequenceRow?.current_sequence ?? 0) + 1;
  const eventId = `EVT-SIN-${crypto.randomUUID()}`;
  const payloadHash = await sha256Hex(canonicalJson(params.payload));
  await db
    .prepare(
      `INSERT INTO integration_outbox_events (
         event_id, target_system, event_type, schema_version, aggregate_type, aggregate_id,
         aggregate_sequence, correlation_id, causation_id, occurred_at, payload_json, payload_hash,
         delivery_status, next_attempt_at, created_at, updated_at
       ) VALUES (?, 'SKYLEDGER', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
    )
    .bind(
      eventId,
      params.eventType,
      params.aggregateType,
      params.aggregateId,
      sequence,
      params.correlationId ?? null,
      params.causationId ?? null,
      now,
      JSON.stringify(params.payload),
      payloadHash,
      now,
      now,
      now
    )
    .run();
  return { event_id: eventId, aggregate_sequence: sequence, delivery_status: 'PENDING' };
}

type OutboxRow = {
  event_id: string;
  event_type: string;
  schema_version: 1;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_sequence: number;
  correlation_id: string | null;
  causation_id: string | null;
  occurred_at: string;
  payload_json: string;
  payload_hash: string;
  attempt_count: number;
};

export async function dispatchSkyledgerOutbox(env: IntegrationBindings, limit = 50, aggregateIds: string[] = []) {
  const db = requireDb(env);
  if (!env.SKYLEDGER_BASE_URL || !env.SKYLEDGER_INTEGRATION_SECRET) {
    return { dispatched: 0, delivered: 0, failed: 0, skipped: 'integration_not_configured' };
  }
  const now = new Date().toISOString();
  const scopedAggregateIds = [...new Set(aggregateIds.map(String).map((value) => value.trim()).filter(Boolean))].slice(0, 100);
  const aggregateFilter = scopedAggregateIds.length
    ? ` AND current.aggregate_id IN (${scopedAggregateIds.map(() => '?').join(', ')})`
    : '';
  const rows = await db
    .prepare(
      `SELECT current.event_id, current.event_type, current.schema_version,
              current.aggregate_type, current.aggregate_id, current.aggregate_sequence,
              current.correlation_id, current.causation_id, current.occurred_at,
              current.payload_json, current.payload_hash, current.attempt_count
       FROM integration_outbox_events current
       WHERE current.target_system = 'SKYLEDGER'
         AND current.delivery_status IN ('PENDING', 'FAILED')
         AND current.next_attempt_at <= ?
         ${aggregateFilter}
         AND NOT EXISTS (
           SELECT 1
           FROM integration_outbox_events earlier
           WHERE earlier.target_system = current.target_system
             AND earlier.aggregate_type = current.aggregate_type
             AND earlier.aggregate_id = current.aggregate_id
             AND earlier.aggregate_sequence < current.aggregate_sequence
             AND earlier.delivery_status <> 'DELIVERED'
         )
       ORDER BY current.created_at ASC LIMIT ?`
    )
    .bind(now, ...scopedAggregateIds, Math.max(1, Math.min(100, limit)))
    .all<OutboxRow>();

  let delivered = 0;
  let failed = 0;
  for (const row of rows.results) {
    const retryAttempt = row.attempt_count + 1;
    const previousAttempt = await db
      .prepare(`SELECT MAX(attempt_no) AS attempt_no FROM integration_delivery_attempts WHERE event_id = ?`)
      .bind(row.event_id)
      .first<{ attempt_no: number | null }>();
    const attemptNo = Number(previousAttempt?.attempt_no ?? 0) + 1;
    const attemptId = `ATT-${crypto.randomUUID()}`;
    await db
      .prepare(`UPDATE integration_outbox_events SET delivery_status = 'DELIVERING', attempt_count = ?, updated_at = ? WHERE event_id = ?`)
      .bind(retryAttempt, now, row.event_id)
      .run();
    await db
      .prepare(`INSERT INTO integration_delivery_attempts (attempt_id, event_id, attempt_no, started_at) VALUES (?, ?, ?, ?)`)
      .bind(attemptId, row.event_id, attemptNo, now)
      .run();

    const envelope: IntegrationEventEnvelope = {
      event_id: row.event_id,
      event_type: row.event_type,
      schema_version: row.schema_version,
      source_system: 'SINOport',
      aggregate_type: row.aggregate_type,
      aggregate_id: row.aggregate_id,
      aggregate_sequence: row.aggregate_sequence,
      correlation_id: row.correlation_id ?? undefined,
      causation_id: row.causation_id ?? undefined,
      occurred_at: row.occurred_at,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      payload_hash: row.payload_hash
    };
    const rawBody = JSON.stringify(envelope);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await hmacSha256Hex(env.SKYLEDGER_INTEGRATION_SECRET, `${timestamp}.${rawBody}`);
    try {
      const response = await fetch(`${env.SKYLEDGER_BASE_URL.replace(/\/$/, '')}/v1/integrations/sinoport/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-Timestamp': timestamp,
          'X-Integration-Signature': signature,
          'Idempotency-Key': row.event_id
        },
        body: rawBody
      });
      const responseBody = (await response.text()).slice(0, 4000);
      const completedAt = new Date().toISOString();
      if (!response.ok) throw new Error(`Skyledger returned ${response.status}: ${responseBody}`);
      await db
        .prepare(`UPDATE integration_outbox_events SET delivery_status = 'DELIVERED', delivered_at = ?, last_http_status = ?, last_error = NULL, updated_at = ? WHERE event_id = ?`)
        .bind(completedAt, response.status, completedAt, row.event_id)
        .run();
      await db
        .prepare(`UPDATE integration_delivery_attempts SET completed_at = ?, http_status = ?, response_body = ? WHERE attempt_id = ?`)
        .bind(completedAt, response.status, responseBody, attemptId)
        .run();
      delivered += 1;
    } catch (error) {
      const completedAt = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.message : 'Delivery failed';
      const terminal = retryAttempt >= 8;
      const backoffSeconds = Math.min(3600, 2 ** retryAttempt * 15);
      const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
      await db
        .prepare(`UPDATE integration_outbox_events SET delivery_status = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE event_id = ?`)
        .bind(terminal ? 'DEAD_LETTER' : 'FAILED', nextAttemptAt, errorMessage.slice(0, 4000), completedAt, row.event_id)
        .run();
      await db
        .prepare(`UPDATE integration_delivery_attempts SET completed_at = ?, error_message = ? WHERE attempt_id = ?`)
        .bind(completedAt, errorMessage.slice(0, 4000), attemptId)
        .run();
      failed += 1;
    }
  }
  return { dispatched: rows.results.length, delivered, failed, scope: scopedAggregateIds.length ? 'aggregate_ids' : 'all_due', aggregate_ids: scopedAggregateIds };
}

export async function replaySkyledgerOutbox(
  env: IntegrationBindings,
  params: { eventIds?: string[]; statuses?: string[]; limit?: number } = {}
) {
  const db = requireDb(env);
  const allowedStatuses = new Set(['FAILED', 'DEAD_LETTER']);
  const statuses = (params.statuses?.length ? params.statuses : [...allowedStatuses]).map((status) => status.toUpperCase());
  if (statuses.some((status) => !allowedStatuses.has(status))) {
    throw new IntegrationSyncError(400, 'INVALID_REPLAY_STATUS', 'Only FAILED and DEAD_LETTER events may be replayed');
  }
  const limit = Math.max(1, Math.min(1000, Number(params.limit) || 100));
  const statusPlaceholders = statuses.map(() => '?').join(', ');
  const eventIds = (params.eventIds ?? []).filter(Boolean);
  const eventFilter = eventIds.length ? ` AND event_id IN (${eventIds.map(() => '?').join(', ')})` : '';
  const rows = await db
    .prepare(
      `SELECT event_id, payload_json FROM integration_outbox_events
       WHERE target_system = 'SKYLEDGER' AND delivery_status IN (${statusPlaceholders})${eventFilter}
       ORDER BY created_at ASC LIMIT ?`
    )
    .bind(...statuses, ...eventIds, limit)
    .all<{ event_id: string; payload_json: string }>();
  const now = new Date().toISOString();
  for (const row of rows.results) {
    const hash = await sha256Hex(canonicalJson(JSON.parse(row.payload_json)));
    await db
      .prepare(
        `UPDATE integration_outbox_events
         SET payload_hash = ?, delivery_status = 'PENDING', attempt_count = 0,
             next_attempt_at = ?, delivered_at = NULL, last_http_status = NULL,
             last_error = NULL, updated_at = ? WHERE event_id = ?`
      )
      .bind(hash, now, now, row.event_id)
      .run();
  }
  return { replayed: rows.results.length, event_ids: rows.results.map((row) => row.event_id) };
}

export async function integrationStatus(env: IntegrationBindings) {
  const db = requireDb(env);
  const [inbox, outbox, links] = await Promise.all([
    db.prepare(`SELECT processing_status AS status, COUNT(*) AS count FROM integration_inbox_events GROUP BY processing_status`).all(),
    db.prepare(`SELECT delivery_status AS status, COUNT(*) AS count FROM integration_outbox_events GROUP BY delivery_status`).all(),
    db.prepare(`SELECT object_type, COUNT(*) AS count, MAX(last_synced_at) AS last_synced_at FROM integration_external_object_links GROUP BY object_type`).all()
  ]);
  return {
    peer_system: 'SKYLEDGER',
    configured: Boolean(env.SKYLEDGER_BASE_URL && env.SKYLEDGER_INTEGRATION_SECRET),
    inbox: inbox.results,
    outbox: outbox.results,
    object_links: links.results
  };
}
