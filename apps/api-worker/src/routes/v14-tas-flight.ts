import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { ApiApp } from '../index';
import { enqueueSkyledgerEvent } from '../lib/integration-sync';
import { jsonError } from '../lib/http';
import { assertTasAccess, projectTasMilestone, sha256Json } from '../lib/tas-station';
import {
  appendOperationEvent,
  createGateDecision,
  findOperationByIdempotency,
  idempotencyKey,
  integerValue,
  loadRequired,
  numberValue,
  optionalText,
  requestId,
  requiredText,
  requireV14Db,
  stringArray,
  V14OperationError
} from '../lib/v14-operations';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

type HandlingContext = {
  tas_flight_handling_session_id: string;
  tenant_id: string;
  flight_id: string;
  status: string;
  planned_pieces: number;
  planned_weight_kg: number;
  received_pieces: number;
  received_weight_kg: number;
  buildup_pieces: number;
  buildup_weight_kg: number;
  handed_to_airline_pieces: number;
  loaded_pieces: number;
  manifest_document_id: string | null;
  manifest_version: string | null;
  manifest_hash: string | null;
  airline_party_code: string | null;
  receiving_closed_at: string | null;
  row_version: number;
  archived_at: string | null;
  flight_no: string;
  flight_date: string;
  origin_code: string;
  destination_code: string;
  etd_at: string | null;
  actual_takeoff_at: string | null;
  runtime_status: string;
  operation_control_plan_id: string | null;
};

type UldContext = {
  tas_uld_id: string;
  tenant_id: string;
  tas_flight_handling_session_id: string;
  uld_code: string;
  uld_type: string;
  position_code: string | null;
  contour_code: string | null;
  tare_weight_kg: number;
  max_gross_weight_kg: number | null;
  actual_gross_weight_kg: number;
  piece_count: number;
  seal_number: string | null;
  status: string;
  row_version: number;
  archived_at: string | null;
};

const viewRoles: RoleCode[] = [
  'platform_admin',
  'station_supervisor',
  'mobile_operator',
  'TAS_OPERATOR',
  'B1_TAS_STATION_CONTROLLER',
  'B2_FLIGHT_MONITOR',
  'DQC_DATA_QUALITY_CONTROLLER',
  'OCC_DM',
  'AIRLINE'
];

const plannerRoles: RoleCode[] = ['platform_admin', 'station_supervisor', 'TAS_OPERATOR', 'B1_TAS_STATION_CONTROLLER'];
const operatorRoles: RoleCode[] = [...plannerRoles, 'mobile_operator'];
const supervisorRoles: RoleCode[] = ['platform_admin', 'station_supervisor', 'B1_TAS_STATION_CONTROLLER', 'DQC_DATA_QUALITY_CONTROLLER'];

function handleError(c: any, error: unknown) {
  if (error instanceof V14OperationError) return jsonError(c, error.status, error.code, error.message, error.details);
  console.error('[v14-tas-flight]', error);
  return jsonError(c, 500, 'TAS_FLIGHT_OPERATION_FAILED', error instanceof Error ? error.message : 'Operation failed');
}

function response(c: any, data: Record<string, unknown>, status: 200 | 201 = 200) {
  return c.json({ request_id: requestId(c.req.raw.headers), ...data }, status);
}

function pageParams(c: any) {
  const page = Math.max(1, Math.trunc(Number(c.req.query('page') ?? 1)) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(c.req.query('page_size') ?? 20)) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function requireEvidence(body: Record<string, unknown>, code: string, message: string) {
  const evidenceIds = stringArray(body, 'evidence_ids');
  if (evidenceIds.length === 0) throw new V14OperationError(409, code, message);
  return evidenceIds;
}

async function loadHandling(db: any, tenantId: string, id: string) {
  return loadRequired<HandlingContext>(
    db,
    `SELECT h.*, f.flight_no, f.flight_date, f.origin_code, f.destination_code,
            f.etd_at, f.actual_takeoff_at, f.runtime_status,
            p.operation_control_plan_id
     FROM tas_flight_handling_sessions h
     JOIN flights f ON f.flight_id = h.flight_id
     LEFT JOIN operation_control_plans p ON p.tenant_id = h.tenant_id AND p.flight_id = h.flight_id
     WHERE h.tenant_id = ? AND h.tas_flight_handling_session_id = ?`,
    [tenantId, id],
    'TAS_FLIGHT_HANDLING_NOT_FOUND',
    'TAS flight handling session was not found'
  );
}

async function loadUld(db: any, tenantId: string, handlingId: string, uldId: string) {
  return loadRequired<UldContext>(
    db,
    `SELECT * FROM tas_ulds
     WHERE tenant_id = ? AND tas_flight_handling_session_id = ? AND tas_uld_id = ?`,
    [tenantId, handlingId, uldId],
    'TAS_ULD_NOT_FOUND',
    'TAS ULD was not found'
  );
}

async function recordHandlingEvent(
  db: any,
  actor: any,
  handling: HandlingContext,
  idem: string,
  eventType: string,
  payload: Record<string, unknown>,
  occurredAt?: string
) {
  return appendOperationEvent(db, actor, {
    aggregateType: 'TasFlightHandlingSession',
    aggregateId: handling.tas_flight_handling_session_id,
    eventType,
    idempotencyKey: idem,
    stationId: 'TAS',
    flightId: handling.flight_id,
    occurredAt,
    payload
  });
}

async function releasedCargoSummary(db: any, tenantId: string, flightId: string) {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(u.aggregate_quantity), 0) AS pieces,
              COALESCE(SUM(COALESCE(u.actual_weight_kg, u.expected_weight_kg, 0)), 0) AS weight_kg
       FROM cargo_units u
       WHERE u.tenant_id = ? AND u.inventory_state = 'RELEASED' AND u.archived_at IS NULL
         AND EXISTS (
           SELECT 1 FROM airport_receipt_sessions r
           WHERE r.tenant_id = ? AND r.flight_id = ? AND r.shipment_id = u.shipment_id
             AND r.status IN ('ACCEPTED', 'CONDITIONAL_ACCEPTED', 'COMPLETED')
         )`
    )
    .bind(tenantId, tenantId, flightId)
    .first() as { pieces: number; weight_kg: number } | null;
  return { pieces: Number(row?.pieces ?? 0), weight_kg: Number(row?.weight_kg ?? 0) };
}

async function assignedCargoSummary(db: any, handlingId: string) {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(piece_count), 0) AS pieces,
              COALESCE(SUM(COALESCE(weight_kg, 0)), 0) AS weight_kg,
              COUNT(*) AS unit_count
       FROM tas_uld_items
       WHERE tas_flight_handling_session_id = ? AND removed_at IS NULL AND status IN ('ASSIGNED', 'LOADED')`
    )
    .bind(handlingId)
    .first() as { pieces: number; weight_kg: number; unit_count: number } | null;
  return {
    pieces: Number(row?.pieces ?? 0),
    weight_kg: Number(row?.weight_kg ?? 0),
    unit_count: Number(row?.unit_count ?? 0)
  };
}

async function recalculateUld(db: any, uldId: string) {
  const totals = await db
    .prepare(
      `SELECT COALESCE(SUM(piece_count), 0) AS pieces,
              COALESCE(SUM(COALESCE(weight_kg, 0)), 0) AS cargo_weight_kg
       FROM tas_uld_items
       WHERE tas_uld_id = ? AND removed_at IS NULL AND status IN ('ASSIGNED', 'LOADED')`
    )
    .bind(uldId)
    .first() as { pieces: number; cargo_weight_kg: number } | null;
  await db
    .prepare(
      `UPDATE tas_ulds
       SET piece_count = ?, actual_gross_weight_kg = tare_weight_kg + ?, updated_at = ?, row_version = row_version + 1
       WHERE tas_uld_id = ?`
    )
    .bind(Number(totals?.pieces ?? 0), Number(totals?.cargo_weight_kg ?? 0), new Date().toISOString(), uldId)
    .run();
  return {
    pieces: Number(totals?.pieces ?? 0),
    cargo_weight_kg: Number(totals?.cargo_weight_kg ?? 0)
  };
}

async function activeUlds(db: any, handlingId: string) {
  const rows = await db
    .prepare(
      `SELECT * FROM tas_ulds
       WHERE tas_flight_handling_session_id = ? AND archived_at IS NULL AND status <> 'VOIDED'
       ORDER BY uld_code`
    )
    .bind(handlingId)
    .all() as { results: Array<Record<string, any>> };
  return rows.results;
}

async function syncCargoMaster(db: any, actor: any, handling: HandlingContext, status: string) {
  if (!handling.operation_control_plan_id) return null;
  const ulds = await activeUlds(db, handling.tas_flight_handling_session_id);
  const summary = await assignedCargoSummary(db, handling.tas_flight_handling_session_id);
  const snapshot = {
    flight_id: handling.flight_id,
    handling_session_id: handling.tas_flight_handling_session_id,
    status,
    received_pieces: handling.received_pieces,
    buildup_pieces: summary.pieces,
    buildup_weight_kg: summary.weight_kg,
    manifest_document_id: handling.manifest_document_id,
    ulds: ulds.map((item) => ({
      tas_uld_id: item.tas_uld_id,
      uld_code: item.uld_code,
      pieces: item.piece_count,
      weight_kg: item.actual_gross_weight_kg,
      status: item.status
    }))
  };
  const hash = await sha256Json(snapshot);
  const existing = await db
    .prepare(`SELECT flight_cargo_master_record_id FROM flight_cargo_master_records WHERE flight_id = ? AND active_flag = 1`)
    .bind(handling.flight_id)
    .first() as { flight_cargo_master_record_id: string } | null;
  if (existing) {
    await db
      .prepare(
        `UPDATE flight_cargo_master_records
         SET record_status = ?, planned_pieces = ?, planned_weight_kg = ?,
             tas_received_pieces = ?, tas_received_weight_kg = ?, buildup_pieces = ?,
             handed_to_airline_pieces = ?, loaded_pieces = ?, uld_ids_json = ?,
             manifest_document_id = ?, maintained_by = ?,
             frozen_by = CASE WHEN ? = 'MANIFEST_FROZEN' THEN ? ELSE frozen_by END,
             frozen_at = CASE WHEN ? = 'MANIFEST_FROZEN' THEN ? ELSE frozen_at END,
             source_event_refs_json = ?, record_hash = ?
         WHERE flight_cargo_master_record_id = ?`
      )
      .bind(
        status,
        handling.planned_pieces,
        handling.planned_weight_kg,
        handling.received_pieces,
        handling.received_weight_kg,
        summary.pieces,
        handling.handed_to_airline_pieces,
        handling.loaded_pieces,
        JSON.stringify(ulds.map((item) => item.tas_uld_id)),
        handling.manifest_document_id,
        actor.userId,
        status,
        actor.userId,
        status,
        new Date().toISOString(),
        JSON.stringify([handling.tas_flight_handling_session_id]),
        hash,
        existing.flight_cargo_master_record_id
      )
      .run();
    return existing.flight_cargo_master_record_id;
  }
  const recordId = `FCMR-${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO flight_cargo_master_records (
         flight_cargo_master_record_id, tenant_id, flight_id, operation_control_plan_id,
         record_version, record_status, planned_pieces, planned_weight_kg,
         tas_received_pieces, tas_received_weight_kg, buildup_pieces,
         handed_to_airline_pieces, loaded_pieces, uld_ids_json, manifest_document_id,
         maintained_by, frozen_by, frozen_at, source_event_refs_json, record_hash, active_flag
       ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .bind(
      recordId,
      actor.tenantId,
      handling.flight_id,
      handling.operation_control_plan_id,
      status,
      handling.planned_pieces,
      handling.planned_weight_kg,
      handling.received_pieces,
      handling.received_weight_kg,
      summary.pieces,
      handling.handed_to_airline_pieces,
      handling.loaded_pieces,
      JSON.stringify(ulds.map((item) => item.tas_uld_id)),
      handling.manifest_document_id,
      actor.userId,
      status === 'MANIFEST_FROZEN' ? actor.userId : null,
      status === 'MANIFEST_FROZEN' ? new Date().toISOString() : null,
      JSON.stringify([handling.tas_flight_handling_session_id]),
      hash
    )
    .run();
  return recordId;
}

export function registerV14TasFlightRoutes(app: ApiApp, requireRoles: RequireRoles) {
  app.get('/api/v1/airports/TAS/overview', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const [receipts, handling, ulds, nextFlight] = await Promise.all([
        db.prepare(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN status IN ('ARRIVED_STAGING','TRUCK_ARRIVED','UNLOADING','COUNTING','MATCHED','RECONCILIATION_PENDING') THEN 1 ELSE 0 END) AS pending,
                  SUM(CASE WHEN status = 'DISCREPANCY_REVIEW' THEN 1 ELSE 0 END) AS discrepancies,
                  SUM(CASE WHEN status IN ('ACCEPTED','CONDITIONAL_ACCEPTED','COMPLETED') THEN 1 ELSE 0 END) AS accepted
           FROM airport_receipt_sessions WHERE tenant_id = ?`
        ).bind(actor.tenantId).first(),
        db.prepare(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN status NOT IN ('DEPARTED','CANCELLED') AND archived_at IS NULL THEN 1 ELSE 0 END) AS active,
                  SUM(CASE WHEN status = 'DEPARTED' THEN 1 ELSE 0 END) AS departed
           FROM tas_flight_handling_sessions WHERE tenant_id = ?`
        ).bind(actor.tenantId).first(),
        db.prepare(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN status = 'LOADED' THEN 1 ELSE 0 END) AS loaded
           FROM tas_ulds WHERE tenant_id = ? AND archived_at IS NULL`
        ).bind(actor.tenantId).first(),
        db.prepare(
          `SELECT h.tas_flight_handling_session_id, h.status, f.flight_id, f.flight_no,
                  f.flight_date, f.etd_at, f.destination_code
           FROM tas_flight_handling_sessions h JOIN flights f ON f.flight_id = h.flight_id
           WHERE h.tenant_id = ? AND h.archived_at IS NULL AND h.status NOT IN ('DEPARTED','CANCELLED')
           ORDER BY COALESCE(f.etd_at, f.flight_date) LIMIT 1`
        ).bind(actor.tenantId).first()
      ]);
      return response(c, { receipts, handling, ulds, next_flight: nextFlight ?? null });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/airports/TAS/options', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const [options, jobs, flights] = await Promise.all([
        db.prepare(`SELECT option_group, option_value AS value, label_zh, label_en, disabled, meta_json FROM tas_station_options ORDER BY option_group, sort_order`).all<Record<string, any>>(),
        db.prepare(
          `SELECT j.transport_job_id AS value,
                  j.transport_job_id || ' / ' || j.shipment_id AS label,
                  j.shipment_id, j.flight_id, j.loaded_pieces, j.loaded_weight_kg,
                  j.seal_number, j.tas_staging_arrived_at
           FROM transport_jobs j
           WHERE j.tenant_id = ? AND j.status = 'ARRIVED_TAS_STAGING'
             AND NOT EXISTS (
               SELECT 1 FROM airport_receipt_sessions r
               WHERE r.tenant_id = j.tenant_id AND r.transport_job_id = j.transport_job_id
                 AND r.status NOT IN ('REJECTED_OR_QUARANTINED','COMPLETED')
             )
           ORDER BY j.tas_staging_arrived_at DESC LIMIT 100`
        ).bind(actor.tenantId).all(),
        db.prepare(
          `SELECT f.flight_id AS value,
                  f.flight_no || ' / ' || f.flight_date || ' / TAS-LGG' AS label,
                  f.flight_no, f.flight_date, f.etd_at, f.aircraft_type, f.runtime_status,
                  p.operation_control_plan_id,
                  h.tas_flight_handling_session_id, h.status AS handling_status,
                  COALESCE(SUM(CASE WHEN r.status IN ('ACCEPTED','CONDITIONAL_ACCEPTED','COMPLETED') THEN r.airport_received_pieces ELSE 0 END), 0) AS accepted_pieces
           FROM operation_control_plans p
           JOIN flights f ON f.flight_id = p.flight_id
           LEFT JOIN tas_flight_handling_sessions h ON h.tenant_id = p.tenant_id AND h.flight_id = p.flight_id
           LEFT JOIN airport_receipt_sessions r ON r.tenant_id = p.tenant_id AND r.flight_id = p.flight_id
           WHERE p.tenant_id = ? AND f.origin_code = 'TAS' AND f.destination_code = 'LGG'
             AND p.status NOT IN ('CANCELLED','CLOSED')
           GROUP BY f.flight_id, p.operation_control_plan_id, h.tas_flight_handling_session_id
           ORDER BY COALESCE(f.etd_at, f.flight_date) DESC LIMIT 100`
        ).bind(actor.tenantId).all()
      ]);
      const grouped: Record<string, unknown[]> = {};
      for (const item of options.results) {
        const option = {
          value: item.value,
          label: item.label_zh,
          label_zh: item.label_zh,
          label_en: item.label_en,
          disabled: Boolean(item.disabled),
          meta: JSON.parse(item.meta_json || '{}')
        };
        (grouped[item.option_group] ??= []).push(option);
      }
      return response(c, { ...grouped, eligible_transport_jobs: jobs.results, flights: flights.results });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/airports/TAS/flights', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const { page, pageSize, offset } = pageParams(c);
      const status = String(c.req.query('status') ?? '').trim();
      const keyword = String(c.req.query('keyword') ?? '').trim();
      const includeArchived = String(c.req.query('include_archived') ?? '') === 'true';
      const filters = `h.tenant_id = ? AND (? = '' OR h.status = ?)
        AND (? = 1 OR h.archived_at IS NULL)
        AND (? = '' OR f.flight_no LIKE '%' || ? || '%' OR f.flight_id LIKE '%' || ? || '%')`;
      const bindings = [actor.tenantId, status, status, Number(includeArchived), keyword, keyword, keyword];
      const totalRow = await db.prepare(
        `SELECT COUNT(*) AS total FROM tas_flight_handling_sessions h
         JOIN flights f ON f.flight_id = h.flight_id WHERE ${filters}`
      ).bind(...bindings).first<{ total: number }>();
      const rows = await db.prepare(
        `SELECT h.*, f.flight_no, f.flight_date, f.origin_code, f.destination_code,
                f.etd_at, f.actual_takeoff_at, f.runtime_status, f.aircraft_type,
                p.operation_control_plan_id,
                (SELECT COUNT(*) FROM tas_ulds u WHERE u.tas_flight_handling_session_id = h.tas_flight_handling_session_id AND u.archived_at IS NULL) AS uld_count,
                (SELECT COUNT(*) FROM airport_receipt_sessions r WHERE r.tenant_id = h.tenant_id AND r.flight_id = h.flight_id) AS receipt_count
         FROM tas_flight_handling_sessions h
         JOIN flights f ON f.flight_id = h.flight_id
         LEFT JOIN operation_control_plans p ON p.tenant_id = h.tenant_id AND p.flight_id = h.flight_id
         WHERE ${filters}
         ORDER BY COALESCE(f.etd_at, f.flight_date) DESC LIMIT ? OFFSET ?`
      ).bind(...bindings, pageSize, offset).all();
      return response(c, { items: rows.results, page, page_size: pageSize, total: Number(totalRow?.total ?? 0) });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights', requireRoles(plannerRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { tas_flight_handling_session_id: duplicate.aggregate_id, duplicate: true });
      const flightId = requiredText(body, 'flight_id');
      const flight = await loadRequired<Record<string, any>>(
        db,
        `SELECT f.*, p.operation_control_plan_id
         FROM flights f JOIN operation_control_plans p ON p.flight_id = f.flight_id AND p.tenant_id = ?
         WHERE f.flight_id = ?`,
        [actor.tenantId, flightId],
        'TAS_FLIGHT_NOT_FOUND',
        'TAS-LGG flight with an operation control plan was not found'
      );
      if (flight.origin_code !== 'TAS' || flight.destination_code !== 'LGG') {
        throw new V14OperationError(409, 'TAS_FLIGHT_ROUTE_INVALID', 'TAS station handling only supports TAS-LGG flights');
      }
      const existing = await db.prepare(
        `SELECT tas_flight_handling_session_id, status, archived_at
         FROM tas_flight_handling_sessions WHERE tenant_id = ? AND flight_id = ?`
      ).bind(actor.tenantId, flightId).first<Record<string, unknown>>();
      if (existing) throw new V14OperationError(409, 'TAS_FLIGHT_HANDLING_ALREADY_EXISTS', 'A TAS handling session already exists for this flight', existing);
      const released = await releasedCargoSummary(db, actor.tenantId, flightId);
      const planned = await db.prepare(
        `SELECT COALESCE(SUM(pieces), 0) AS pieces, COALESCE(SUM(gross_weight), 0) AS weight_kg
         FROM awbs WHERE flight_id = ?`
      ).bind(flightId).first<{ pieces: number; weight_kg: number }>();
      const handlingId = `TASF-${crypto.randomUUID()}`; const now = new Date().toISOString();
      const plannedPieces = body.planned_pieces === undefined ? Number(planned?.pieces ?? released.pieces) : Math.max(0, integerValue(body, 'planned_pieces'));
      const plannedWeight = body.planned_weight_kg === undefined ? Number(planned?.weight_kg ?? released.weight_kg) : Math.max(0, numberValue(body, 'planned_weight_kg'));
      await db.prepare(
        `INSERT INTO tas_flight_handling_sessions (
           tas_flight_handling_session_id, tenant_id, flight_id, status,
           planned_pieces, planned_weight_kg, received_pieces, received_weight_kg,
           notes, created_by, updated_by, created_at, updated_at
         ) VALUES (?, ?, ?, 'PLANNING', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        handlingId, actor.tenantId, flightId, plannedPieces, plannedWeight, released.pieces,
        released.weight_kg, optionalText(body, 'notes'), actor.userId, actor.userId, now, now
      ).run();
      const handling = await loadHandling(db, actor.tenantId, handlingId);
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_FLIGHT_HANDLING_CREATED', body, now);
      return response(c, { tas_flight_handling_session_id: handlingId, status: 'PLANNING', duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/airports/TAS/flights/:id', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      const [receipts, uldRows, itemRows, cargo, milestones, auditEvents, gates] = await Promise.all([
        db.prepare(
          `SELECT r.*, j.last_location_at, j.seal_number AS truck_seal_number
           FROM airport_receipt_sessions r JOIN transport_jobs j ON j.transport_job_id = r.transport_job_id
           WHERE r.tenant_id = ? AND r.flight_id = ? ORDER BY r.updated_at DESC`
        ).bind(actor.tenantId, handling.flight_id).all(),
        db.prepare(
          `SELECT * FROM tas_ulds WHERE tenant_id = ? AND tas_flight_handling_session_id = ?
           ORDER BY archived_at, uld_code`
        ).bind(actor.tenantId, handling.tas_flight_handling_session_id).all<Record<string, any>>(),
        db.prepare(
          `SELECT i.*, u.business_barcode AS barcode, u.condition_status, u.inventory_state,
                  a.awb_no
           FROM tas_uld_items i
           JOIN cargo_units u ON u.cargo_unit_id = i.cargo_unit_id
           LEFT JOIN awbs a ON a.awb_id = u.awb_id
           WHERE i.tenant_id = ? AND i.tas_flight_handling_session_id = ?
           ORDER BY i.assigned_at`
        ).bind(actor.tenantId, handling.tas_flight_handling_session_id).all<Record<string, any>>(),
        db.prepare(
          `SELECT u.cargo_unit_id, u.business_barcode AS barcode, u.shipment_id, u.awb_id,
                  a.awb_no, u.aggregate_quantity, u.actual_weight_kg, u.expected_weight_kg,
                  u.condition_status, u.inventory_state
           FROM cargo_units u LEFT JOIN awbs a ON a.awb_id = u.awb_id
           WHERE u.tenant_id = ? AND u.inventory_state = 'RELEASED' AND u.archived_at IS NULL
             AND EXISTS (
               SELECT 1 FROM airport_receipt_sessions r
               WHERE r.tenant_id = ? AND r.flight_id = ? AND r.shipment_id = u.shipment_id
                 AND r.status IN ('ACCEPTED','CONDITIONAL_ACCEPTED','COMPLETED')
             )
             AND NOT EXISTS (
               SELECT 1 FROM tas_uld_items i
               WHERE i.tenant_id = u.tenant_id AND i.cargo_unit_id = u.cargo_unit_id
                 AND i.removed_at IS NULL AND i.status IN ('ASSIGNED','LOADED')
             )
           ORDER BY a.awb_no, u.unit_sequence, u.business_barcode`
        ).bind(actor.tenantId, actor.tenantId, handling.flight_id).all(),
        handling.operation_control_plan_id
          ? db.prepare(
              `SELECT i.*, d.milestone_code, d.name_zh, d.name_en, d.sequence, d.stage_code
               FROM milestone_instances i JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id
               WHERE i.operation_control_plan_id = ? AND d.milestone_code IN (
                 'TAS_RECEIVING_STARTED','TAS_LAST_TRUCK_ARRIVED','TAS_BUILDUP_COMPLETED',
                 'MANIFEST_FROZEN','ULD_HANDED_TO_AIRLINE','AIRCRAFT_LOADING_COMPLETED','TAS_ACTUAL_DEP'
               ) ORDER BY d.sequence`
            ).bind(handling.operation_control_plan_id).all()
          : Promise.resolve({ results: [] }),
        db.prepare(
          `SELECT operation_event_id, aggregate_sequence, event_type, event_action, occurred_at,
                  actor_id, actor_role, client_source, reason_code, payload_json
           FROM operation_events WHERE tenant_id = ? AND aggregate_type = 'TasFlightHandlingSession'
             AND aggregate_id = ? ORDER BY aggregate_sequence DESC`
        ).bind(actor.tenantId, handling.tas_flight_handling_session_id).all(),
        db.prepare(
          `SELECT * FROM gate_decisions WHERE tenant_id = ? AND related_object_type = 'TasFlightHandlingSession'
             AND related_object_id = ? ORDER BY decided_at DESC`
        ).bind(actor.tenantId, handling.tas_flight_handling_session_id).all()
      ]);
      const itemsByUld = new Map<string, unknown[]>();
      for (const item of itemRows.results) {
        const list = itemsByUld.get(item.tas_uld_id) ?? [];
        list.push(item); itemsByUld.set(item.tas_uld_id, list);
      }
      const ulds = uldRows.results.map((uld) => ({ ...uld, items: itemsByUld.get(uld.tas_uld_id) ?? [] }));
      return response(c, {
        handling,
        receipts: receipts.results,
        ulds,
        available_cargo_units: cargo.results,
        milestones: milestones.results,
        audit_events: auditEvents.results,
        gate_decisions: gates.results
      });
    } catch (error) { return handleError(c, error); }
  });

  app.patch('/api/v1/airports/TAS/flights/:id', requireRoles(plannerRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status) || handling.archived_at) {
        throw new V14OperationError(409, 'TAS_FLIGHT_HANDLING_LOCKED', 'Frozen or archived TAS handling cannot be edited');
      }
      const expectedVersion = integerValue(body, 'row_version', handling.row_version);
      if (expectedVersion !== handling.row_version) throw new V14OperationError(409, 'ROW_VERSION_CONFLICT', 'TAS handling version is stale');
      const plannedPieces = body.planned_pieces === undefined ? handling.planned_pieces : Math.max(0, integerValue(body, 'planned_pieces'));
      const plannedWeight = body.planned_weight_kg === undefined ? handling.planned_weight_kg : Math.max(0, numberValue(body, 'planned_weight_kg'));
      const now = new Date().toISOString();
      await db.prepare(
        `UPDATE tas_flight_handling_sessions SET planned_pieces = ?, planned_weight_kg = ?,
           notes = COALESCE(?, notes), updated_by = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ? AND row_version = ?`
      ).bind(plannedPieces, plannedWeight, optionalText(body, 'notes'), actor.userId, now, actor.tenantId, handling.tas_flight_handling_session_id, handling.row_version).run();
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_FLIGHT_HANDLING_UPDATED', body, now);
      return response(c, { result: 'UPDATED', row_version: handling.row_version + 1 });
    } catch (error) { return handleError(c, error); }
  });

  app.delete('/api/v1/airports/TAS/flights/:id', requireRoles(supervisorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status)) {
        throw new V14OperationError(409, 'TAS_FLIGHT_HANDLING_LOCKED', 'Only planning or build-up sessions can be cancelled');
      }
      const assigned = await assignedCargoSummary(db, handling.tas_flight_handling_session_id);
      if (assigned.unit_count > 0) throw new V14OperationError(409, 'TAS_ULD_ITEMS_EXIST', 'Remove all ULD cargo assignments before cancelling the session');
      const now = new Date().toISOString();
      await db.prepare(
        `UPDATE tas_flight_handling_sessions SET status = 'CANCELLED', archived_at = ?, notes = COALESCE(?, notes),
           updated_by = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ?`
      ).bind(now, optionalText(body, 'reason'), actor.userId, now, actor.tenantId, handling.tas_flight_handling_session_id).run();
      await db.prepare(
        `UPDATE tas_ulds SET status = 'VOIDED', archived_at = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ? AND archived_at IS NULL`
      ).bind(now, now, actor.tenantId, handling.tas_flight_handling_session_id).run();
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_FLIGHT_HANDLING_CANCELLED', body, now);
      return response(c, { result: 'CANCELLED', archived_at: now });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/receiving/close', requireRoles(supervisorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status)) throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Receiving is already closed');
      const evidenceIds = requireEvidence(body, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Last-truck arrival evidence is required');
      const receiptState = await db.prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status IN ('ACCEPTED','CONDITIONAL_ACCEPTED','COMPLETED') THEN 1 ELSE 0 END) AS accepted,
                SUM(CASE WHEN status NOT IN ('ACCEPTED','CONDITIONAL_ACCEPTED','REJECTED_OR_QUARANTINED','COMPLETED') THEN 1 ELSE 0 END) AS pending
         FROM airport_receipt_sessions WHERE tenant_id = ? AND flight_id = ?`
      ).bind(actor.tenantId, handling.flight_id).first<{ total: number; accepted: number; pending: number }>();
      if (Number(receiptState?.total ?? 0) === 0 || Number(receiptState?.accepted ?? 0) === 0) {
        throw new V14OperationError(409, 'TAS_RECEIPT_REQUIRED', 'At least one accepted TAS receipt is required before closing receiving');
      }
      if (Number(receiptState?.pending ?? 0) > 0) {
        throw new V14OperationError(409, 'TAS_RECEIPTS_PENDING', 'All TAS receipts must reach a final decision before last-truck closure', receiptState ?? undefined);
      }
      const released = await releasedCargoSummary(db, actor.tenantId, handling.flight_id);
      if (released.pieces <= 0) throw new V14OperationError(409, 'TAS_RELEASED_CARGO_REQUIRED', 'No released cargo is available for build-up');
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(
        `UPDATE tas_flight_handling_sessions SET status = 'BUILDUP', receiving_closed_at = ?,
           received_pieces = ?, received_weight_kg = ?, receiving_evidence_ids_json = ?,
           updated_by = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ?`
      ).bind(
        occurredAt, released.pieces, released.weight_kg, JSON.stringify(evidenceIds), actor.userId,
        occurredAt, actor.tenantId, handling.tas_flight_handling_session_id
      ).run();
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_LAST_TRUCK_RECEIVING_CLOSED', { ...body, ...released }, occurredAt);
      await projectTasMilestone(db, actor, {
        flightId: handling.flight_id, milestoneCode: 'TAS_LAST_TRUCK_ARRIVED', action: 'COMPLETE', occurredAt,
        evidenceIds, idempotencyKey: idem, segmentCode: 'B1', sourceObjectType: 'TasFlightHandlingSession',
        sourceObjectId: handling.tas_flight_handling_session_id
      });
      return response(c, { result: 'BUILDUP', received_pieces: released.pieces, received_weight_kg: released.weight_kg });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/ulds', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { tas_uld_id: JSON.parse(duplicate.payload_json).tas_uld_id, duplicate: true });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status) || handling.archived_at) throw new V14OperationError(409, 'TAS_BUILDUP_LOCKED', 'ULD planning is locked');
      const uldCode = requiredText(body, 'uld_code').toUpperCase();
      const uldType = requiredText(body, 'uld_type').toUpperCase();
      const option = await db.prepare(`SELECT option_value FROM tas_station_options WHERE option_group = 'uld_type' AND option_value = ? AND disabled = 0`).bind(uldType).first();
      if (!option) throw new V14OperationError(400, 'TAS_ULD_TYPE_INVALID', 'ULD type must come from TAS station options');
      const uldId = `TASULD-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO tas_ulds (
           tas_uld_id, tenant_id, tas_flight_handling_session_id, uld_code, uld_type,
           position_code, contour_code, tare_weight_kg, max_gross_weight_kg,
           actual_gross_weight_kg, seal_number, status, built_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', ?, ?, ?)`
      ).bind(
        uldId, actor.tenantId, handling.tas_flight_handling_session_id, uldCode, uldType,
        optionalText(body, 'position_code'), optionalText(body, 'contour_code'),
        Math.max(0, numberValue(body, 'tare_weight_kg')),
        body.max_gross_weight_kg === undefined ? null : Math.max(0, numberValue(body, 'max_gross_weight_kg')),
        Math.max(0, numberValue(body, 'tare_weight_kg')), optionalText(body, 'seal_number'), actor.userId, now, now
      ).run();
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_ULD_CREATED', { ...body, tas_uld_id: uldId, uld_code: uldCode }, now);
      return response(c, { tas_uld_id: uldId, status: 'PLANNED', duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.patch('/api/v1/airports/TAS/flights/:id/ulds/:uldId', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      const uld = await loadUld(db, actor.tenantId, handling.tas_flight_handling_session_id, c.req.param('uldId'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status) || !['PLANNED', 'BUILDING'].includes(uld.status) || uld.archived_at) {
        throw new V14OperationError(409, 'TAS_ULD_LOCKED', 'Built-up or archived ULD cannot be edited');
      }
      const expectedVersion = integerValue(body, 'row_version', uld.row_version);
      if (expectedVersion !== uld.row_version) throw new V14OperationError(409, 'ROW_VERSION_CONFLICT', 'ULD version is stale');
      const tare = body.tare_weight_kg === undefined ? uld.tare_weight_kg : Math.max(0, numberValue(body, 'tare_weight_kg'));
      const maxGross = body.max_gross_weight_kg === undefined ? uld.max_gross_weight_kg : Math.max(0, numberValue(body, 'max_gross_weight_kg'));
      const cargoWeight = Math.max(0, uld.actual_gross_weight_kg - uld.tare_weight_kg);
      if (maxGross && tare + cargoWeight > maxGross) throw new V14OperationError(409, 'TAS_ULD_OVERWEIGHT', 'Updated ULD limits would make the ULD overweight');
      const now = new Date().toISOString();
      await db.prepare(
        `UPDATE tas_ulds SET position_code = COALESCE(?, position_code), contour_code = COALESCE(?, contour_code),
           tare_weight_kg = ?, max_gross_weight_kg = ?, actual_gross_weight_kg = ? + ?,
           seal_number = COALESCE(?, seal_number), updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_uld_id = ? AND row_version = ?`
      ).bind(
        optionalText(body, 'position_code'), optionalText(body, 'contour_code'), tare, maxGross,
        tare, cargoWeight, optionalText(body, 'seal_number'), now, actor.tenantId, uld.tas_uld_id, uld.row_version
      ).run();
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_ULD_UPDATED', { ...body, tas_uld_id: uld.tas_uld_id }, now);
      return response(c, { result: 'UPDATED', row_version: uld.row_version + 1 });
    } catch (error) { return handleError(c, error); }
  });

  app.delete('/api/v1/airports/TAS/flights/:id/ulds/:uldId', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      const uld = await loadUld(db, actor.tenantId, handling.tas_flight_handling_session_id, c.req.param('uldId'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status) || !['PLANNED', 'BUILDING'].includes(uld.status)) {
        throw new V14OperationError(409, 'TAS_ULD_LOCKED', 'Only a planned or building ULD can be archived');
      }
      const item = await db.prepare(`SELECT tas_uld_item_id FROM tas_uld_items WHERE tas_uld_id = ? AND removed_at IS NULL AND status IN ('ASSIGNED','LOADED') LIMIT 1`).bind(uld.tas_uld_id).first();
      if (item) throw new V14OperationError(409, 'TAS_ULD_ITEMS_EXIST', 'Remove all cargo units before archiving the ULD');
      const now = new Date().toISOString();
      await db.prepare(`UPDATE tas_ulds SET status = 'VOIDED', archived_at = ?, updated_at = ?, row_version = row_version + 1 WHERE tenant_id = ? AND tas_uld_id = ?`)
        .bind(now, now, actor.tenantId, uld.tas_uld_id).run();
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_ULD_ARCHIVED', { tas_uld_id: uld.tas_uld_id, reason: optionalText(body, 'reason') }, now);
      return response(c, { result: 'VOIDED', archived_at: now });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/ulds/:uldId/items', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { tas_uld_item_id: JSON.parse(duplicate.payload_json).tas_uld_item_id, duplicate: true });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      const uld = await loadUld(db, actor.tenantId, handling.tas_flight_handling_session_id, c.req.param('uldId'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status) || !['PLANNED', 'BUILDING'].includes(uld.status) || uld.archived_at) {
        throw new V14OperationError(409, 'TAS_ULD_LOCKED', 'Cargo cannot be assigned after build-up is frozen');
      }
      const barcode = requiredText(body, 'barcode');
      const unit = await loadRequired<Record<string, any>>(
        db,
        `SELECT u.* FROM cargo_units u
         WHERE u.tenant_id = ? AND u.business_barcode = ? AND u.inventory_state = 'RELEASED' AND u.archived_at IS NULL
           AND EXISTS (
             SELECT 1 FROM airport_receipt_sessions r
             WHERE r.tenant_id = ? AND r.flight_id = ? AND r.shipment_id = u.shipment_id
               AND r.status IN ('ACCEPTED','CONDITIONAL_ACCEPTED','COMPLETED')
           )`,
        [actor.tenantId, barcode, actor.tenantId, handling.flight_id],
        'TAS_CARGO_NOT_ELIGIBLE',
        'Cargo unit is not released for this TAS-LGG flight'
      );
      const alreadyAssigned = await db.prepare(
        `SELECT tas_uld_item_id, tas_uld_id FROM tas_uld_items
         WHERE tenant_id = ? AND cargo_unit_id = ? AND removed_at IS NULL AND status IN ('ASSIGNED','LOADED')`
      ).bind(actor.tenantId, unit.cargo_unit_id).first() as Record<string, unknown> | null;
      if (alreadyAssigned) throw new V14OperationError(409, 'TAS_CARGO_ALREADY_ASSIGNED', 'Cargo unit is already assigned to an active ULD', alreadyAssigned);
      const pieces = Number(unit.aggregate_quantity || 1);
      const weight = Number(unit.actual_weight_kg ?? unit.expected_weight_kg ?? 0);
      const projectedGross = uld.actual_gross_weight_kg + weight;
      if (uld.max_gross_weight_kg && projectedGross > uld.max_gross_weight_kg) {
        throw new V14OperationError(409, 'TAS_ULD_OVERWEIGHT', 'Cargo assignment would exceed ULD maximum gross weight', {
          projected_gross_weight_kg: projectedGross,
          max_gross_weight_kg: uld.max_gross_weight_kg
        });
      }
      const itemId = `TASULDI-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO tas_uld_items (
           tas_uld_item_id, tenant_id, tas_flight_handling_session_id, tas_uld_id,
           cargo_unit_id, shipment_id, piece_count, weight_kg, status, assigned_by, assigned_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', ?, ?)`
      ).bind(
        itemId, actor.tenantId, handling.tas_flight_handling_session_id, uld.tas_uld_id,
        unit.cargo_unit_id, unit.shipment_id, pieces, weight, actor.userId, now
      ).run();
      await db.prepare(
        `UPDATE cargo_units SET current_location_type = 'ULD', current_location_id = ?, updated_at = ?
         WHERE tenant_id = ? AND cargo_unit_id = ?`
      ).bind(uld.uld_code, now, actor.tenantId, unit.cargo_unit_id).run();
      await db.prepare(`UPDATE tas_ulds SET status = 'BUILDING', updated_at = ?, row_version = row_version + 1 WHERE tas_uld_id = ?`)
        .bind(now, uld.tas_uld_id).run();
      await recalculateUld(db, uld.tas_uld_id);
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_CARGO_ASSIGNED_TO_ULD', {
        tas_uld_item_id: itemId, tas_uld_id: uld.tas_uld_id, uld_code: uld.uld_code,
        cargo_unit_id: unit.cargo_unit_id, barcode, pieces, weight_kg: weight
      }, now);
      return response(c, { tas_uld_item_id: itemId, result: 'ASSIGNED', duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.delete('/api/v1/airports/TAS/flights/:id/ulds/:uldId/items/:itemId', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      const uld = await loadUld(db, actor.tenantId, handling.tas_flight_handling_session_id, c.req.param('uldId'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status) || !['PLANNED', 'BUILDING'].includes(uld.status)) {
        throw new V14OperationError(409, 'TAS_ULD_LOCKED', 'Cargo cannot be removed after build-up is frozen');
      }
      const item = await loadRequired<Record<string, any>>(
        db,
        `SELECT * FROM tas_uld_items WHERE tenant_id = ? AND tas_uld_id = ? AND tas_uld_item_id = ?
           AND removed_at IS NULL AND status = 'ASSIGNED'`,
        [actor.tenantId, uld.tas_uld_id, c.req.param('itemId')],
        'TAS_ULD_ITEM_NOT_FOUND',
        'Active ULD cargo assignment was not found'
      );
      const reason = requiredText(body, 'reason'); const now = new Date().toISOString();
      await db.prepare(
        `UPDATE tas_uld_items SET status = 'REMOVED', removed_by = ?, removed_at = ?, removal_reason = ?
         WHERE tenant_id = ? AND tas_uld_item_id = ?`
      ).bind(actor.userId, now, reason, actor.tenantId, item.tas_uld_item_id).run();
      await db.prepare(
        `UPDATE cargo_units SET current_location_type = 'AIRPORT', current_location_id = 'TAS', updated_at = ?
         WHERE tenant_id = ? AND cargo_unit_id = ?`
      ).bind(now, actor.tenantId, item.cargo_unit_id).run();
      const totals = await recalculateUld(db, uld.tas_uld_id);
      if (totals.pieces === 0) await db.prepare(`UPDATE tas_ulds SET status = 'PLANNED' WHERE tas_uld_id = ?`).bind(uld.tas_uld_id).run();
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_CARGO_REMOVED_FROM_ULD', {
        tas_uld_item_id: item.tas_uld_item_id, tas_uld_id: uld.tas_uld_id,
        cargo_unit_id: item.cargo_unit_id, reason
      }, now);
      return response(c, { result: 'REMOVED', removed_at: now });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/buildup/complete', requireRoles(supervisorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      let handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (handling.status !== 'BUILDUP' || !handling.receiving_closed_at) throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Close TAS receiving before completing build-up');
      const evidenceIds = requireEvidence(body, 'MILESTONE_EVIDENCE_INCOMPLETE', 'ULD build-up evidence is required');
      const summary = await assignedCargoSummary(db, handling.tas_flight_handling_session_id);
      const ulds = await activeUlds(db, handling.tas_flight_handling_session_id);
      if (ulds.length === 0 || summary.unit_count === 0) throw new V14OperationError(409, 'TAS_ULD_REQUIRED', 'At least one populated ULD is required');
      if (summary.pieces !== handling.received_pieces) {
        throw new V14OperationError(409, 'TAS_BUILDUP_PIECES_MISMATCH', 'All released TAS cargo must be assigned before build-up completion', {
          received_pieces: handling.received_pieces,
          assigned_pieces: summary.pieces
        });
      }
      const empty = ulds.find((uld) => Number(uld.piece_count) <= 0);
      if (empty) throw new V14OperationError(409, 'TAS_ULD_EMPTY', `ULD ${empty.uld_code} has no cargo`);
      const overweight = ulds.find((uld) => uld.max_gross_weight_kg && Number(uld.actual_gross_weight_kg) > Number(uld.max_gross_weight_kg));
      if (overweight) throw new V14OperationError(409, 'TAS_ULD_OVERWEIGHT', `ULD ${overweight.uld_code} exceeds maximum gross weight`);
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(
        `UPDATE tas_ulds SET status = 'BUILT_UP', verified_by = ?, evidence_ids_json = ?,
           updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ? AND archived_at IS NULL`
      ).bind(actor.userId, JSON.stringify(evidenceIds), occurredAt, actor.tenantId, handling.tas_flight_handling_session_id).run();
      await db.prepare(
        `UPDATE tas_flight_handling_sessions SET status = 'BUILT_UP', buildup_pieces = ?, buildup_weight_kg = ?,
           buildup_completed_at = ?, buildup_evidence_ids_json = ?, updated_by = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ?`
      ).bind(
        summary.pieces, summary.weight_kg, occurredAt, JSON.stringify(evidenceIds), actor.userId,
        occurredAt, actor.tenantId, handling.tas_flight_handling_session_id
      ).run();
      handling = await loadHandling(db, actor.tenantId, handling.tas_flight_handling_session_id);
      const cargoMasterId = await syncCargoMaster(db, actor, handling, 'WORKING');
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_BUILDUP_COMPLETED', { ...body, ...summary, flight_cargo_master_record_id: cargoMasterId }, occurredAt);
      await projectTasMilestone(db, actor, {
        flightId: handling.flight_id, milestoneCode: 'TAS_BUILDUP_COMPLETED', action: 'COMPLETE', occurredAt,
        evidenceIds, idempotencyKey: idem, segmentCode: 'B1', sourceObjectType: 'TasFlightHandlingSession',
        sourceObjectId: handling.tas_flight_handling_session_id
      });
      return response(c, { result: 'BUILT_UP', buildup_pieces: summary.pieces, buildup_weight_kg: summary.weight_kg, flight_cargo_master_record_id: cargoMasterId });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/manifest/finalize', requireRoles(supervisorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      let handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (handling.status !== 'BUILT_UP') throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Build-up must be completed before manifest freeze');
      const evidenceIds = requireEvidence(body, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Manifest evidence is required');
      const manifestDocumentId = requiredText(body, 'manifest_document_id');
      const ulds = await activeUlds(db, handling.tas_flight_handling_session_id);
      const manifestHash = optionalText(body, 'manifest_hash') ?? await sha256Json({
        flight_id: handling.flight_id,
        manifest_document_id: manifestDocumentId,
        manifest_version: optionalText(body, 'manifest_version') ?? '1',
        ulds: ulds.map((uld) => ({ code: uld.uld_code, pieces: uld.piece_count, weight: uld.actual_gross_weight_kg }))
      });
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(
        `UPDATE tas_flight_handling_sessions SET status = 'MANIFEST_FROZEN', manifest_document_id = ?,
           manifest_version = ?, manifest_hash = ?, manifest_frozen_at = ?, manifest_evidence_ids_json = ?,
           updated_by = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ?`
      ).bind(
        manifestDocumentId, optionalText(body, 'manifest_version') ?? '1', manifestHash, occurredAt,
        JSON.stringify(evidenceIds), actor.userId, occurredAt, actor.tenantId, handling.tas_flight_handling_session_id
      ).run();
      handling = await loadHandling(db, actor.tenantId, handling.tas_flight_handling_session_id);
      const cargoMasterId = await syncCargoMaster(db, actor, handling, 'MANIFEST_FROZEN');
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_MANIFEST_FROZEN', { ...body, manifest_hash: manifestHash, flight_cargo_master_record_id: cargoMasterId }, occurredAt);
      await projectTasMilestone(db, actor, {
        flightId: handling.flight_id, milestoneCode: 'MANIFEST_FROZEN', action: 'COMPLETE', occurredAt,
        evidenceIds, idempotencyKey: idem, segmentCode: 'B1', sourceObjectType: 'TasFlightHandlingSession',
        sourceObjectId: handling.tas_flight_handling_session_id
      });
      return response(c, { result: 'MANIFEST_FROZEN', manifest_hash: manifestHash, flight_cargo_master_record_id: cargoMasterId });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/handover', requireRoles(supervisorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      let handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (handling.status !== 'MANIFEST_FROZEN') throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Manifest must be frozen before airline handover');
      const evidenceIds = requireEvidence(body, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Airline handover evidence is required');
      if (body.next_owner_accepted !== true) throw new V14OperationError(409, 'NEXT_OWNER_NOT_ACCEPTED', 'Airline acceptance is required');
      const airlineParty = requiredText(body, 'airline_party_code');
      const summary = await assignedCargoSummary(db, handling.tas_flight_handling_session_id);
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(
        `UPDATE tas_ulds SET status = 'HANDED_TO_AIRLINE', evidence_ids_json = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ? AND archived_at IS NULL`
      ).bind(JSON.stringify(evidenceIds), occurredAt, actor.tenantId, handling.tas_flight_handling_session_id).run();
      await db.prepare(
        `UPDATE tas_flight_handling_sessions SET status = 'HANDED_TO_AIRLINE', airline_party_code = ?,
           handed_to_airline_pieces = ?, airline_handover_at = ?, handover_evidence_ids_json = ?,
           updated_by = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ?`
      ).bind(
        airlineParty, summary.pieces, occurredAt, JSON.stringify(evidenceIds), actor.userId,
        occurredAt, actor.tenantId, handling.tas_flight_handling_session_id
      ).run();
      handling = await loadHandling(db, actor.tenantId, handling.tas_flight_handling_session_id);
      await syncCargoMaster(db, actor, handling, 'MANIFEST_FROZEN');
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_ULDS_HANDED_TO_AIRLINE', { ...body, pieces: summary.pieces }, occurredAt);
      await projectTasMilestone(db, actor, {
        flightId: handling.flight_id, milestoneCode: 'ULD_HANDED_TO_AIRLINE', action: 'COMPLETE', occurredAt,
        evidenceIds, idempotencyKey: idem, segmentCode: 'B1', sourceObjectType: 'TasFlightHandlingSession',
        sourceObjectId: handling.tas_flight_handling_session_id
      });
      return response(c, { result: 'HANDED_TO_AIRLINE', handed_to_airline_pieces: summary.pieces });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/loading/complete', requireRoles(['platform_admin', 'station_supervisor', 'B1_TAS_STATION_CONTROLLER', 'AIRLINE']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      let handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (handling.status !== 'HANDED_TO_AIRLINE') throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Airline handover must be completed before aircraft loading');
      const evidenceIds = requireEvidence(body, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Aircraft loading evidence is required');
      const ulds = await activeUlds(db, handling.tas_flight_handling_session_id);
      if (!ulds.length || ulds.some((uld) => uld.status !== 'HANDED_TO_AIRLINE')) throw new V14OperationError(409, 'TAS_ULD_HANDOVER_INCOMPLETE', 'All active ULDs must be handed to the airline');
      const summary = await assignedCargoSummary(db, handling.tas_flight_handling_session_id);
      if (summary.pieces !== handling.buildup_pieces || summary.pieces !== handling.handed_to_airline_pieces) {
        throw new V14OperationError(409, 'TAS_LOADING_MANIFEST_MISMATCH', 'Loaded pieces must match build-up and airline handover totals');
      }
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(
        `UPDATE tas_ulds SET status = 'LOADED', evidence_ids_json = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ? AND archived_at IS NULL`
      ).bind(JSON.stringify(evidenceIds), occurredAt, actor.tenantId, handling.tas_flight_handling_session_id).run();
      await db.prepare(
        `UPDATE tas_uld_items SET status = 'LOADED', loaded_at = ?
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ? AND removed_at IS NULL AND status = 'ASSIGNED'`
      ).bind(occurredAt, actor.tenantId, handling.tas_flight_handling_session_id).run();
      await db.prepare(
        `UPDATE cargo_units SET inventory_state = 'LOADED', current_location_type = 'AIRCRAFT',
           current_location_id = ?, updated_at = ?
         WHERE tenant_id = ? AND cargo_unit_id IN (
           SELECT cargo_unit_id FROM tas_uld_items
           WHERE tenant_id = ? AND tas_flight_handling_session_id = ? AND removed_at IS NULL
         )`
      ).bind(handling.flight_id, occurredAt, actor.tenantId, actor.tenantId, handling.tas_flight_handling_session_id).run();
      await db.prepare(
        `UPDATE tas_flight_handling_sessions SET status = 'LOADED', loaded_pieces = ?,
           loading_completed_at = ?, loading_evidence_ids_json = ?, updated_by = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ?`
      ).bind(
        summary.pieces, occurredAt, JSON.stringify(evidenceIds), actor.userId, occurredAt,
        actor.tenantId, handling.tas_flight_handling_session_id
      ).run();
      handling = await loadHandling(db, actor.tenantId, handling.tas_flight_handling_session_id);
      await syncCargoMaster(db, actor, handling, 'MANIFEST_FROZEN');
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_AIRCRAFT_LOADING_COMPLETED', { ...body, loaded_pieces: summary.pieces }, occurredAt);
      await projectTasMilestone(db, actor, {
        flightId: handling.flight_id, milestoneCode: 'AIRCRAFT_LOADING_COMPLETED', action: 'COMPLETE', occurredAt,
        evidenceIds, idempotencyKey: idem, segmentCode: 'B1', sourceObjectType: 'TasFlightHandlingSession',
        sourceObjectId: handling.tas_flight_handling_session_id
      });
      return response(c, { result: 'LOADED', loaded_pieces: summary.pieces });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/departure', requireRoles(['platform_admin', 'station_supervisor', 'B1_TAS_STATION_CONTROLLER', 'B2_FLIGHT_MONITOR']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      let handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (handling.status !== 'LOADED') throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Aircraft loading must be completed before departure');
      const evidenceIds = requireEvidence(body, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Departure confirmation evidence is required');
      if (body.next_owner_accepted !== true) throw new V14OperationError(409, 'NEXT_OWNER_NOT_ACCEPTED', 'B2 flight monitor acceptance is required');
      if (!handling.manifest_document_id || !handling.manifest_hash) throw new V14OperationError(409, 'TAS_MANIFEST_NOT_FROZEN', 'A frozen manifest is required for departure');
      const requestedBy = requiredText(body, 'requested_by');
      const cargoUnitRows = await db.prepare(
        `SELECT cargo_unit_id FROM tas_uld_items
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ? AND removed_at IS NULL AND status = 'LOADED'`
      ).bind(actor.tenantId, handling.tas_flight_handling_session_id).all<{ cargo_unit_id: string }>();
      const gateId = await createGateDecision(db, actor, {
        gateCode: 'TAS_FLIGHT_DEPARTURE_GATE', objectType: 'TasFlightHandlingSession',
        objectId: handling.tas_flight_handling_session_id, decision: 'PASS',
        actionComplete: true, dataConsistent: handling.loaded_pieces === handling.buildup_pieces,
        evidenceComplete: evidenceIds.length > 0, nextOwnerAccepted: true, requestedBy,
        reason: optionalText(body, 'reason'), cargoUnitIds: cargoUnitRows.results.map((item) => item.cargo_unit_id),
        conditions: {
          manifest_document_id: handling.manifest_document_id,
          manifest_hash: handling.manifest_hash,
          buildup_pieces: handling.buildup_pieces,
          loaded_pieces: handling.loaded_pieces
        }
      });
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(
        `UPDATE tas_flight_handling_sessions SET status = 'DEPARTED', departed_at = ?,
           departure_evidence_ids_json = ?, updated_by = ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ?`
      ).bind(occurredAt, JSON.stringify(evidenceIds), actor.userId, occurredAt, actor.tenantId, handling.tas_flight_handling_session_id).run();
      await db.prepare(
        `UPDATE flights SET runtime_status = 'Airborne', actual_takeoff_at = ?, updated_at = ? WHERE flight_id = ?`
      ).bind(occurredAt, occurredAt, handling.flight_id).run();
      await db.prepare(
        `UPDATE airport_receipt_sessions SET status = 'COMPLETED', updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND flight_id = ? AND status IN ('ACCEPTED','CONDITIONAL_ACCEPTED')`
      ).bind(occurredAt, actor.tenantId, handling.flight_id).run();
      await db.prepare(
        `UPDATE transport_jobs SET status = 'COMPLETED', updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND flight_id = ? AND status = 'DELIVERED_TO_AIRPORT'`
      ).bind(occurredAt, actor.tenantId, handling.flight_id).run();
      handling = await loadHandling(db, actor.tenantId, handling.tas_flight_handling_session_id);
      await recordHandlingEvent(db, actor, handling, idem, 'TAS_FLIGHT_DEPARTED', { ...body, gate_decision_id: gateId }, occurredAt);
      await projectTasMilestone(db, actor, {
        flightId: handling.flight_id, milestoneCode: 'TAS_ACTUAL_DEP', action: 'COMPLETE', occurredAt,
        evidenceIds, idempotencyKey: idem, segmentCode: 'B2', sourceObjectType: 'TasFlightHandlingSession',
        sourceObjectId: handling.tas_flight_handling_session_id
      });
      await enqueueSkyledgerEvent(c.env, {
        eventType: 'tas.flight_departed.v1', aggregateType: 'Flight', aggregateId: handling.flight_id,
        payload: {
          flight_id: handling.flight_id,
          tas_flight_handling_session_id: handling.tas_flight_handling_session_id,
          actual_takeoff_at: occurredAt,
          loaded_pieces: handling.loaded_pieces,
          manifest_document_id: handling.manifest_document_id,
          manifest_hash: handling.manifest_hash,
          gate_decision_id: gateId
        }
      });
      return response(c, { result: 'DEPARTED', actual_takeoff_at: occurredAt, gate_decision_id: gateId });
    } catch (error) { return handleError(c, error); }
  });
}
