import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { ApiApp } from '../index';
import { jsonError } from '../lib/http';
import { assertTasAccess } from '../lib/tas-station';
import {
  appendOperationEvent,
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

type Handling = {
  tas_flight_handling_session_id: string;
  tenant_id: string;
  flight_id: string;
  status: string;
  flight_no: string;
  flight_date: string;
  origin_code: string;
  destination_code: string;
  row_version: number;
};

const viewRoles: RoleCode[] = [
  'platform_admin',
  'station_supervisor',
  'mobile_operator',
  'TAS_OPERATOR',
  'B1_TAS_STATION_CONTROLLER',
  'B2_FLIGHT_MONITOR',
  'DQC_DATA_QUALITY_CONTROLLER',
  'document_desk',
  'AIRLINE'
];

const plannerRoles: RoleCode[] = [
  'platform_admin',
  'station_supervisor',
  'B1_TAS_STATION_CONTROLLER',
  'DQC_DATA_QUALITY_CONTROLLER',
  'document_desk',
  'TAS_OPERATOR'
];

const operatorRoles: RoleCode[] = [
  'platform_admin',
  'station_supervisor',
  'B1_TAS_STATION_CONTROLLER',
  'TAS_OPERATOR',
  'mobile_operator'
];

const supervisorRoles: RoleCode[] = [
  'platform_admin',
  'station_supervisor',
  'B1_TAS_STATION_CONTROLLER',
  'DQC_DATA_QUALITY_CONTROLLER'
];

function response(c: any, data: Record<string, unknown>, status: 200 | 201 = 200) {
  return c.json({ request_id: requestId(c.req.raw.headers), ...data }, status);
}

function handleError(c: any, error: unknown) {
  if (error instanceof V14OperationError) {
    return jsonError(c, error.status, error.code, error.message, error.details);
  }
  console.error('[v14-tas-direct]', error);
  return jsonError(c, 500, 'TAS_DIRECT_OPERATION_FAILED', error instanceof Error ? error.message : 'Operation failed');
}

function hasAnyRole(actor: any, roles: RoleCode[]) {
  return roles.some((role) => actor.roleIds.includes(role));
}

function requireEvidence(body: Record<string, unknown>, message: string) {
  const evidence = stringArray(body, 'evidence_ids');
  if (!evidence.length) throw new V14OperationError(409, 'MILESTONE_EVIDENCE_INCOMPLETE', message);
  return evidence;
}

function normalizeFlightNo(value: unknown) {
  const result = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!result) throw new V14OperationError(400, 'VALIDATION_ERROR', 'flight_no is required', { field: 'flight_no' });
  return result;
}

function normalizeAwbNo(value: unknown) {
  const result = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!result) throw new V14OperationError(400, 'VALIDATION_ERROR', 'awb_no is required', { field: 'awb_no' });
  return result;
}

async function loadHandling(db: any, tenantId: string, handlingId: string) {
  return loadRequired<Handling>(
    db,
    `SELECT h.*, f.flight_no, f.flight_date, f.origin_code, f.destination_code
     FROM tas_flight_handling_sessions h
     JOIN flights f ON f.flight_id = h.flight_id
     WHERE h.tenant_id = ? AND h.tas_flight_handling_session_id = ? AND h.archived_at IS NULL`,
    [tenantId, handlingId],
    'TAS_FLIGHT_HANDLING_NOT_FOUND',
    'TAS flight handling session was not found'
  );
}

async function loadDirectReceipt(db: any, tenantId: string, receiptId: string) {
  return loadRequired<Record<string, any>>(
    db,
    `SELECT r.*, f.flight_no, f.flight_date, f.destination_code
     FROM tas_direct_receipt_sessions r
     JOIN flights f ON f.flight_id = r.flight_id
     WHERE r.tenant_id = ? AND r.tas_direct_receipt_session_id = ?`,
    [tenantId, receiptId],
    'TAS_DIRECT_RECEIPT_NOT_FOUND',
    'Direct TAS receipt session was not found'
  );
}

async function loadFlightAwb(db: any, tenantId: string, flightId: string, awbId: string) {
  return loadRequired<Record<string, any>>(
    db,
    `SELECT a.*, f.forecast_status, f.expected_pieces, f.expected_weight_kg,
            b.baseline_version_id
     FROM awbs a
     JOIN tas_outbound_awb_forecasts f
       ON f.tenant_id = ? AND f.flight_id = ? AND f.awb_id = a.awb_id
     LEFT JOIN cargo_baseline_versions b
       ON b.tenant_id = f.tenant_id AND b.shipment_id = a.shipment_id
      AND b.baseline_type = 'EXPECTED' AND b.status = 'PUBLISHED'
     WHERE a.awb_id = ? AND a.deleted_at IS NULL
     ORDER BY b.version_no DESC LIMIT 1`,
    [tenantId, flightId, awbId],
    'TAS_FLIGHT_AWB_NOT_FOUND',
    'AWB is not forecast for this TAS-LGG flight'
  );
}

async function nextPackageSequence(db: any, tenantId: string, shipmentId: string) {
  const row = await db.prepare(
    `SELECT COALESCE(MAX(unit_sequence), 0) AS current_sequence
     FROM cargo_units WHERE tenant_id = ? AND shipment_id = ?`
  ).bind(tenantId, shipmentId).first() as { current_sequence: number } | null;
  return Number(row?.current_sequence ?? 0) + 1;
}

async function refreshHandlingReceivedTotals(db: any, tenantId: string, flightId: string) {
  const totals = await db.prepare(
    `SELECT COALESCE(SUM(u.aggregate_quantity), 0) AS pieces,
            COALESCE(SUM(COALESCE(u.actual_weight_kg, u.expected_weight_kg, 0)), 0) AS weight_kg
     FROM cargo_units u
     JOIN awbs a ON a.awb_id = u.awb_id
     WHERE u.tenant_id = ? AND a.flight_id = ? AND u.inventory_state = 'RELEASED'
       AND u.archived_at IS NULL AND a.deleted_at IS NULL`
  ).bind(tenantId, flightId).first() as { pieces: number; weight_kg: number } | null;
  await db.prepare(
    `UPDATE tas_flight_handling_sessions
     SET received_pieces = ?, received_weight_kg = ?, updated_at = ?, row_version = row_version + 1
     WHERE tenant_id = ? AND flight_id = ? AND archived_at IS NULL`
  ).bind(
    Number(totals?.pieces ?? 0),
    Number(totals?.weight_kg ?? 0),
    new Date().toISOString(),
    tenantId,
    flightId
  ).run();
  return { pieces: Number(totals?.pieces ?? 0), weight_kg: Number(totals?.weight_kg ?? 0) };
}

async function ensureNotAssigned(db: any, tenantId: string, cargoUnitId: string) {
  const assigned = await db.prepare(
    `SELECT 'ULD' AS assignment_type, tas_uld_id AS assignment_id
     FROM tas_uld_items
     WHERE tenant_id = ? AND cargo_unit_id = ? AND removed_at IS NULL AND status IN ('ASSIGNED','LOADED')
     UNION ALL
     SELECT 'BULK' AS assignment_type, tas_bulk_load_item_id AS assignment_id
     FROM tas_bulk_load_items
     WHERE tenant_id = ? AND cargo_unit_id = ? AND removed_at IS NULL
       AND status IN ('ASSIGNED','HANDED_TO_AIRLINE','LOADED')
     LIMIT 1`
  ).bind(tenantId, cargoUnitId, tenantId, cargoUnitId).first() as Record<string, unknown> | null;
  if (assigned) {
    throw new V14OperationError(409, 'TAS_CARGO_ALREADY_ASSIGNED', 'CargoUnit is already assigned to a ULD or bulk load', assigned);
  }
}

export function registerV14TasDirectRoutes(app: ApiApp, requireRoles: RequireRoles) {
  app.post('/api/v1/airports/TAS/outbound-tasks', requireRoles(plannerRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { tas_flight_handling_session_id: duplicate.aggregate_id, duplicate: true });
      const flightNo = normalizeFlightNo(body.flight_no);
      const stdAt = requiredText(body, 'std_at');
      const flightDate = optionalText(body, 'flight_date') ?? stdAt.slice(0, 10);
      const existing = await db.prepare(
        `SELECT f.flight_id, h.tas_flight_handling_session_id
         FROM flights f
         JOIN v14_flight_tenant_scopes fs ON fs.flight_id = f.flight_id
         LEFT JOIN tas_flight_handling_sessions h ON h.tenant_id = fs.tenant_id AND h.flight_id = f.flight_id
         WHERE fs.tenant_id = ? AND f.station_id = 'TAS' AND f.flight_no = ? AND f.flight_date = ?
           AND f.deleted_at IS NULL LIMIT 1`
      ).bind(actor.tenantId, flightNo, flightDate).first<Record<string, any>>();
      if (existing) {
        throw new V14OperationError(409, 'TAS_OUTBOUND_TASK_ALREADY_EXISTS', 'The TAS-LGG flight task already exists', existing);
      }
      const flightId = `FLIGHT-${crypto.randomUUID()}`;
      const handlingId = `TASF-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      if (!db.batch) throw new V14OperationError(500, 'DATABASE_BATCH_REQUIRED', 'Atomic D1 batch support is required');
      await db.batch([
        db.prepare(
          `INSERT INTO flights (
             flight_id, station_id, flight_no, flight_date, origin_code, destination_code,
             std_at, etd_at, runtime_status, service_level, aircraft_type, notes, created_at, updated_at
           ) VALUES (?, 'TAS', ?, ?, 'TAS', 'LGG', ?, ?, 'Scheduled', ?, ?, ?, ?, ?)`
        ).bind(
          flightId, flightNo, flightDate, stdAt, optionalText(body, 'etd_at'),
          optionalText(body, 'service_level') ?? 'P1', optionalText(body, 'aircraft_type'),
          optionalText(body, 'notes'), now, now
        ),
        db.prepare(
          `INSERT INTO v14_flight_tenant_scopes (
             flight_id, tenant_id, station_id, source_type, source_ref, created_by, created_at
           ) VALUES (?, ?, 'TAS', 'TAS_STANDALONE_OUTBOUND', ?, ?, ?)`
        ).bind(flightId, actor.tenantId, flightNo, actor.userId, now),
        db.prepare(
          `INSERT INTO tas_flight_handling_sessions (
             tas_flight_handling_session_id, tenant_id, flight_id, status,
             planned_pieces, planned_weight_kg, received_pieces, received_weight_kg,
             notes, created_by, updated_by, created_at, updated_at
           ) VALUES (?, ?, ?, 'PLANNING', 0, 0, 0, 0, ?, ?, ?, ?, ?)`
        ).bind(handlingId, actor.tenantId, flightId, optionalText(body, 'notes'), actor.userId, actor.userId, now, now)
      ]);
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasFlightHandlingSession', aggregateId: handlingId,
        eventType: 'TAS_STANDALONE_OUTBOUND_CREATED', eventAction: 'CREATE',
        idempotencyKey: idem, stationId: 'TAS', flightId, occurredAt: now,
        payload: { flight_id: flightId, flight_no: flightNo, flight_date: flightDate, std_at: stdAt }
      });
      return response(c, { tas_flight_handling_session_id: handlingId, flight_id: flightId, status: 'PLANNING', duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/airports/TAS/flights/:id/workspace', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      const [awbs, trucks, truckAwbs, receipts, receiptLines, cargoUnits, bulkItems] = await Promise.all([
        db.prepare(
          `SELECT f.*, a.awb_no, a.hawb_no, a.shipment_id, a.shipper_name, a.consignee_name,
                  a.goods_description, a.pieces, a.gross_weight, a.current_node
           FROM tas_outbound_awb_forecasts f JOIN awbs a ON a.awb_id = f.awb_id
           WHERE f.tenant_id = ? AND f.flight_id = ? AND a.deleted_at IS NULL
           ORDER BY f.updated_at DESC`
        ).bind(actor.tenantId, handling.flight_id).all(),
        db.prepare(
          `SELECT * FROM tas_truck_prealerts WHERE tenant_id = ? AND flight_id = ? ORDER BY COALESCE(eta_at, created_at), created_at`
        ).bind(actor.tenantId, handling.flight_id).all(),
        db.prepare(
          `SELECT l.*, a.awb_no FROM tas_truck_prealert_awbs l JOIN awbs a ON a.awb_id = l.awb_id
           WHERE l.tenant_id = ? AND l.tas_truck_prealert_id IN (
             SELECT tas_truck_prealert_id FROM tas_truck_prealerts WHERE tenant_id = ? AND flight_id = ?
           ) ORDER BY a.awb_no`
        ).bind(actor.tenantId, actor.tenantId, handling.flight_id).all(),
        db.prepare(
          `SELECT * FROM tas_direct_receipt_sessions WHERE tenant_id = ? AND flight_id = ? ORDER BY updated_at DESC`
        ).bind(actor.tenantId, handling.flight_id).all(),
        db.prepare(
          `SELECT l.*, a.awb_no FROM tas_direct_receipt_lines l JOIN awbs a ON a.awb_id = l.awb_id
           WHERE l.tenant_id = ? AND l.tas_direct_receipt_session_id IN (
             SELECT tas_direct_receipt_session_id FROM tas_direct_receipt_sessions WHERE tenant_id = ? AND flight_id = ?
           ) ORDER BY a.awb_no`
        ).bind(actor.tenantId, actor.tenantId, handling.flight_id).all(),
        db.prepare(
          `SELECT u.*, a.awb_no FROM cargo_units u JOIN awbs a ON a.awb_id = u.awb_id
           WHERE u.tenant_id = ? AND a.flight_id = ? AND u.archived_at IS NULL
           ORDER BY a.awb_no, u.unit_sequence, u.business_barcode`
        ).bind(actor.tenantId, handling.flight_id).all(),
        db.prepare(
          `SELECT b.*, u.business_barcode AS barcode, a.awb_no
           FROM tas_bulk_load_items b JOIN cargo_units u ON u.cargo_unit_id = b.cargo_unit_id
           LEFT JOIN awbs a ON a.awb_id = b.awb_id
           WHERE b.tenant_id = ? AND b.tas_flight_handling_session_id = ?
           ORDER BY b.removed_at, b.assigned_at`
        ).bind(actor.tenantId, handling.tas_flight_handling_session_id).all()
      ]);
      const truckLines = new Map<string, unknown[]>();
      for (const line of truckAwbs.results as Array<Record<string, any>>) {
        const list = truckLines.get(line.tas_truck_prealert_id) ?? []; list.push(line); truckLines.set(line.tas_truck_prealert_id, list);
      }
      const receiptLineMap = new Map<string, unknown[]>();
      for (const line of receiptLines.results as Array<Record<string, any>>) {
        const list = receiptLineMap.get(line.tas_direct_receipt_session_id) ?? []; list.push(line); receiptLineMap.set(line.tas_direct_receipt_session_id, list);
      }
      return response(c, {
        handling,
        awbs: awbs.results,
        trucks: (trucks.results as Array<Record<string, any>>).map((item) => ({ ...item, awbs: truckLines.get(item.tas_truck_prealert_id) ?? [] })),
        direct_receipts: (receipts.results as Array<Record<string, any>>).map((item) => ({ ...item, lines: receiptLineMap.get(item.tas_direct_receipt_session_id) ?? [] })),
        cargo_units: cargoUnits.results,
        bulk_items: bulkItems.results
      });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/awbs', requireRoles([...plannerRoles, 'mobile_operator']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { awb_id: duplicate.aggregate_id, duplicate: true });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status)) throw new V14OperationError(409, 'TAS_CARGO_FORECAST_LOCKED', 'Cargo forecast is locked after build-up completion');
      const awbNo = normalizeAwbNo(body.awb_no);
      const pieces = Math.max(0, integerValue(body, 'pieces'));
      const weight = Math.max(0, numberValue(body, 'gross_weight'));
      const provisional = body.provisional === true || pieces === 0;
      if (provisional && !hasAnyRole(actor, operatorRoles)) throw new V14OperationError(403, 'PROVISIONAL_AWB_FORBIDDEN', 'Current actor cannot create a provisional receiving AWB');
      if (!provisional && !hasAnyRole(actor, plannerRoles)) throw new V14OperationError(403, 'TAS_AWB_FORECAST_FORBIDDEN', 'Current actor can only create a provisional AWB while receiving');
      const existing = await db.prepare(`SELECT awb_id, flight_id FROM awbs WHERE awb_no = ? AND deleted_at IS NULL`).bind(awbNo).first<Record<string, unknown>>();
      if (existing) throw new V14OperationError(409, 'AWB_ALREADY_EXISTS', 'AWB number already exists', existing);
      const shipmentId = `SHP-${crypto.randomUUID()}`; const awbId = `AWB-${crypto.randomUUID()}`;
      const baselineId = `CBL-${crypto.randomUUID()}`; const forecastId = `TASAWBF-${crypto.randomUUID()}`;
      const now = new Date().toISOString(); const forecastStatus = provisional ? 'PROVISIONAL' : 'FORECASTED';
      if (!db.batch) throw new V14OperationError(500, 'DATABASE_BATCH_REQUIRED', 'Atomic D1 batch support is required');
      await db.batch([
        db.prepare(
          `INSERT INTO shipments (shipment_id, station_id, order_id, shipment_type, current_node, fulfillment_status,
             service_level, total_pieces, total_weight, created_at, updated_at)
           VALUES (?, 'TAS', ?, 'TAS_OUTBOUND', 'TAS Receiving', 'TAS Receiving', ?, ?, ?, ?, ?)`
        ).bind(shipmentId, optionalText(body, 'order_id'), optionalText(body, 'service_level') ?? 'P1', pieces, weight, now, now),
        db.prepare(
          `INSERT INTO awbs (awb_id, awb_no, shipment_id, flight_id, station_id, hawb_no, shipper_name,
             consignee_name, notify_name, goods_description, pieces, gross_weight, current_node,
             awb_type, manifest_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'TAS', ?, ?, ?, ?, ?, ?, ?, 'TAS Receiving', 'EXPORT', 'Pending', ?, ?)`
        ).bind(
          awbId, awbNo, shipmentId, handling.flight_id, optionalText(body, 'hawb_no'), optionalText(body, 'shipper_name'),
          optionalText(body, 'consignee_name'), optionalText(body, 'notify_name'), optionalText(body, 'goods_description'),
          pieces, weight, now, now
        ),
        db.prepare(
          `INSERT INTO v14_awb_intakes (awb_intake_id, tenant_id, control_station_id, origin_execution_station_id,
             shipment_id, awb_id, flight_id, source_type, source_ref, created_by, created_at)
           VALUES (?, ?, 'TAS', 'TAS', ?, ?, ?, ?, ?, ?, ?)`
        ).bind(`INTAKE-${crypto.randomUUID()}`, actor.tenantId, shipmentId, awbId, handling.flight_id,
          provisional ? 'TAS_GATE_PROVISIONAL' : 'TAS_CARGO_FORECAST', awbNo, actor.userId, now),
        db.prepare(
          `INSERT INTO cargo_baseline_versions (baseline_version_id, tenant_id, shipment_id, version_no,
             baseline_type, status, expected_pieces, expected_weight_kg, source_type, source_ref,
             requested_by, approved_by, published_at, created_at)
           VALUES (?, ?, ?, 1, 'EXPECTED', 'PUBLISHED', ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(baselineId, actor.tenantId, shipmentId, pieces, weight,
          provisional ? 'TAS_GATE_PROVISIONAL' : 'TAS_CARGO_FORECAST', awbNo, actor.userId, actor.userId, now, now),
        db.prepare(
          `INSERT INTO tas_outbound_awb_forecasts (tas_awb_forecast_id, tenant_id, flight_id, awb_id,
             forecast_status, expected_pieces, expected_weight_kg, source_type, source_ref,
             created_by, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(forecastId, actor.tenantId, handling.flight_id, awbId, forecastStatus, pieces, weight,
          provisional ? 'TAS_GATE_PROVISIONAL' : 'MANUAL', optionalText(body, 'source_ref'), actor.userId, actor.userId, now, now)
      ]);
      await db.prepare(
        `UPDATE tas_flight_handling_sessions
         SET planned_pieces = planned_pieces + ?, planned_weight_kg = planned_weight_kg + ?, updated_at = ?, row_version = row_version + 1
         WHERE tenant_id = ? AND tas_flight_handling_session_id = ?`
      ).bind(pieces, weight, now, actor.tenantId, handling.tas_flight_handling_session_id).run();
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasAwbForecast', aggregateId: awbId, eventType: provisional ? 'TAS_PROVISIONAL_AWB_CREATED' : 'TAS_AWB_FORECAST_RECORDED',
        eventAction: 'CREATE', idempotencyKey: idem, stationId: 'TAS', shipmentId, flightId: handling.flight_id, awbId,
        payload: { awb_no: awbNo, pieces, gross_weight: weight, forecast_status: forecastStatus }
      });
      return response(c, { awb_id: awbId, shipment_id: shipmentId, forecast_status: forecastStatus, duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/trucks', requireRoles(plannerRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { tas_truck_prealert_id: duplicate.aggregate_id, duplicate: true });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status)) throw new V14OperationError(409, 'TAS_TRUCK_PREALERT_LOCKED', 'Truck pre-alerts are locked for this flight');
      const vehiclePlate = requiredText(body, 'vehicle_plate').toUpperCase();
      const allocations = Array.isArray(body.awb_allocations) ? body.awb_allocations as Array<Record<string, unknown>> : [];
      const truckId = `TASTRUCK-${crypto.randomUUID()}`; const now = new Date().toISOString();
      if (!db.batch) throw new V14OperationError(500, 'DATABASE_BATCH_REQUIRED', 'Atomic D1 batch support is required');
      const statements = [db.prepare(
        `INSERT INTO tas_truck_prealerts (tas_truck_prealert_id, tenant_id, flight_id, appointment_ref,
           vehicle_plate, driver_name, driver_phone, eta_at, seal_expected, status, notes,
           created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', ?, ?, ?, ?, ?)`
      ).bind(truckId, actor.tenantId, handling.flight_id, optionalText(body, 'appointment_ref'), vehiclePlate,
        optionalText(body, 'driver_name'), optionalText(body, 'driver_phone'), optionalText(body, 'eta_at'),
        optionalText(body, 'seal_expected'), optionalText(body, 'notes'), actor.userId, actor.userId, now, now)];
      for (const allocation of allocations) {
        const awbId = String(allocation.awb_id ?? '').trim();
        if (!awbId) continue;
        await loadFlightAwb(db, actor.tenantId, handling.flight_id, awbId);
        statements.push(db.prepare(
          `INSERT INTO tas_truck_prealert_awbs (tas_truck_prealert_awb_id, tenant_id, tas_truck_prealert_id,
             awb_id, planned_pieces, planned_weight_kg, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(`TASTRUCKAWB-${crypto.randomUUID()}`, actor.tenantId, truckId, awbId,
          Math.max(0, Number(allocation.planned_pieces ?? 0)), Math.max(0, Number(allocation.planned_weight_kg ?? 0)), now));
      }
      await db.batch(statements);
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasTruckPrealert', aggregateId: truckId, eventType: 'TAS_TRUCK_PREALERT_RECORDED',
        eventAction: 'CREATE', idempotencyKey: idem, stationId: 'TAS', flightId: handling.flight_id,
        payload: { vehicle_plate: vehiclePlate, eta_at: optionalText(body, 'eta_at'), awb_count: allocations.length }
      });
      return response(c, { tas_truck_prealert_id: truckId, status: 'PLANNED', duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/direct-receipts', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { tas_direct_receipt_session_id: duplicate.aggregate_id, duplicate: true });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status)) throw new V14OperationError(409, 'TAS_RECEIVING_CLOSED', 'TAS receiving is closed for this flight');
      const truckId = optionalText(body, 'tas_truck_prealert_id');
      let truck: Record<string, any> | null = null;
      if (truckId) {
        truck = await loadRequired<Record<string, any>>(
          db,
          `SELECT * FROM tas_truck_prealerts WHERE tenant_id = ? AND flight_id = ? AND tas_truck_prealert_id = ? AND status <> 'CANCELLED'`,
          [actor.tenantId, handling.flight_id, truckId],
          'TAS_TRUCK_PREALERT_NOT_FOUND',
          'Truck pre-alert was not found for this flight'
        );
      }
      const vehiclePlate = String(body.vehicle_plate ?? truck?.vehicle_plate ?? '').trim().toUpperCase();
      if (!vehiclePlate) throw new V14OperationError(400, 'VALIDATION_ERROR', 'vehicle_plate is required when no truck pre-alert is selected');
      const receiptId = `TASDR-${crypto.randomUUID()}`; const now = new Date().toISOString();
      const allocations = truckId
        ? await db.prepare(
            `SELECT l.awb_id, l.planned_pieces, l.planned_weight_kg, a.shipment_id, f.forecast_status,
                    f.expected_pieces, f.expected_weight_kg
             FROM tas_truck_prealert_awbs l JOIN awbs a ON a.awb_id = l.awb_id
             JOIN tas_outbound_awb_forecasts f ON f.tenant_id = l.tenant_id AND f.flight_id = ? AND f.awb_id = l.awb_id
             WHERE l.tenant_id = ? AND l.tas_truck_prealert_id = ?`
          ).bind(handling.flight_id, actor.tenantId, truckId).all<Record<string, any>>()
        : { results: [] as Array<Record<string, any>> };
      if (!db.batch) throw new V14OperationError(500, 'DATABASE_BATCH_REQUIRED', 'Atomic D1 batch support is required');
      const statements = [db.prepare(
        `INSERT INTO tas_direct_receipt_sessions (tas_direct_receipt_session_id, tenant_id, flight_id,
           tas_truck_prealert_id, source_type, vehicle_plate, driver_name, seal_actual, status, started_at,
           created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'DIRECT_TAS', ?, ?, ?, 'COUNTING', ?, ?, ?, ?, ?)`
      ).bind(receiptId, actor.tenantId, handling.flight_id, truckId, vehiclePlate,
        optionalText(body, 'driver_name') ?? truck?.driver_name ?? null, optionalText(body, 'seal_actual'),
        now, actor.userId, actor.userId, now, now)];
      for (const allocation of allocations.results) {
        statements.push(db.prepare(
          `INSERT INTO tas_direct_receipt_lines (tas_direct_receipt_line_id, tenant_id,
             tas_direct_receipt_session_id, shipment_id, awb_id, forecast_status,
             expected_pieces, expected_weight_kg, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COUNTING', ?, ?)`
        ).bind(`TASDRL-${crypto.randomUUID()}`, actor.tenantId, receiptId, allocation.shipment_id,
          allocation.awb_id, allocation.forecast_status,
          Number(allocation.planned_pieces || allocation.expected_pieces || 0),
          Number(allocation.planned_weight_kg || allocation.expected_weight_kg || 0), now, now));
      }
      if (truckId) {
        statements.push(db.prepare(
          `UPDATE tas_truck_prealerts SET status = 'RECEIVING', actual_arrival_at = COALESCE(actual_arrival_at, ?),
             seal_actual = COALESCE(?, seal_actual), updated_by = ?, updated_at = ?
           WHERE tenant_id = ? AND tas_truck_prealert_id = ?`
        ).bind(now, optionalText(body, 'seal_actual'), actor.userId, now, actor.tenantId, truckId));
      }
      await db.batch(statements);
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasDirectReceiptSession', aggregateId: receiptId, eventType: 'TAS_DIRECT_RECEIVING_STARTED',
        eventAction: 'START', idempotencyKey: idem, stationId: 'TAS', flightId: handling.flight_id,
        payload: { vehicle_plate: vehiclePlate, tas_truck_prealert_id: truckId, preloaded_awb_count: allocations.results.length }
      });
      return response(c, { tas_direct_receipt_session_id: receiptId, status: 'COUNTING', duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/direct-receipts/:id/awbs', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { tas_direct_receipt_line_id: duplicate.aggregate_id, duplicate: true });
      const receipt = await loadDirectReceipt(db, actor.tenantId, c.req.param('id'));
      if (receipt.status !== 'COUNTING') throw new V14OperationError(409, 'TAS_DIRECT_RECEIPT_LOCKED', 'Receipt is not open for AWB changes');
      const awbId = requiredText(body, 'awb_id');
      const awb = await loadFlightAwb(db, actor.tenantId, receipt.flight_id, awbId);
      const existing = await db.prepare(
        `SELECT tas_direct_receipt_line_id FROM tas_direct_receipt_lines
         WHERE tenant_id = ? AND tas_direct_receipt_session_id = ? AND awb_id = ?`
      ).bind(actor.tenantId, receipt.tas_direct_receipt_session_id, awbId).first<Record<string, unknown>>();
      if (existing) throw new V14OperationError(409, 'TAS_RECEIPT_AWB_ALREADY_EXISTS', 'AWB is already attached to this receipt', existing);
      const lineId = `TASDRL-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO tas_direct_receipt_lines (tas_direct_receipt_line_id, tenant_id,
           tas_direct_receipt_session_id, shipment_id, awb_id, forecast_status,
           expected_pieces, expected_weight_kg, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COUNTING', ?, ?)`
      ).bind(lineId, actor.tenantId, receipt.tas_direct_receipt_session_id, awb.shipment_id, awb.awb_id,
        awb.forecast_status, Number(awb.expected_pieces ?? awb.pieces ?? 0),
        Number(awb.expected_weight_kg ?? awb.gross_weight ?? 0), now, now).run();
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasDirectReceiptSession', aggregateId: receipt.tas_direct_receipt_session_id,
        eventType: 'TAS_DIRECT_RECEIPT_AWB_ATTACHED', eventAction: 'ATTACH_AWB', idempotencyKey: idem,
        stationId: 'TAS', shipmentId: awb.shipment_id, flightId: receipt.flight_id, awbId,
        payload: { tas_direct_receipt_line_id: lineId, awb_no: awb.awb_no }
      });
      return response(c, { tas_direct_receipt_line_id: lineId, awb_id: awbId, duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/direct-receipts/:id/scans', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { cargo_unit_id: duplicate.aggregate_id, duplicate: true });
      const counted = await db.prepare(
        `SELECT cargo_unit_id FROM count_events WHERE tenant_id = ? AND idempotency_key = ? LIMIT 1`
      ).bind(actor.tenantId, idem).first<{ cargo_unit_id: string }>();
      if (counted) return response(c, { cargo_unit_id: counted.cargo_unit_id, duplicate: true });
      const receipt = await loadDirectReceipt(db, actor.tenantId, c.req.param('id'));
      if (receipt.status !== 'COUNTING') throw new V14OperationError(409, 'TAS_DIRECT_RECEIPT_LOCKED', 'Receipt is not open for scanning');
      const awbId = requiredText(body, 'awb_id');
      const line = await loadRequired<Record<string, any>>(
        db,
        `SELECT l.*, a.awb_no, b.baseline_version_id
         FROM tas_direct_receipt_lines l JOIN awbs a ON a.awb_id = l.awb_id
         JOIN cargo_baseline_versions b ON b.tenant_id = l.tenant_id AND b.shipment_id = l.shipment_id
          AND b.baseline_type = 'EXPECTED' AND b.status = 'PUBLISHED'
         WHERE l.tenant_id = ? AND l.tas_direct_receipt_session_id = ? AND l.awb_id = ?
         ORDER BY b.version_no DESC LIMIT 1`,
        [actor.tenantId, receipt.tas_direct_receipt_session_id, awbId],
        'TAS_DIRECT_RECEIPT_AWB_NOT_FOUND',
        'Attach the AWB to this receipt before scanning pieces'
      );
      const allowOverage = body.allow_overage === true && hasAnyRole(actor, supervisorRoles);
      if (line.expected_pieces > 0 && line.received_pieces >= line.expected_pieces && !allowOverage) {
        throw new V14OperationError(409, 'RECEIPT_EXPECTED_PIECES_EXCEEDED', 'Scanned pieces already reached the forecast quantity; supervisor override is required');
      }
      const sequence = await nextPackageSequence(db, actor.tenantId, line.shipment_id);
      const barcode = String(body.barcode ?? '').trim().toUpperCase() || `${String(line.awb_no).replace(/[^A-Z0-9]/g, '')}-${String(sequence).padStart(4, '0')}`;
      const existingUnit = await db.prepare(
        `SELECT cargo_unit_id, shipment_id, inventory_state FROM cargo_units WHERE tenant_id = ? AND business_barcode = ? AND archived_at IS NULL`
      ).bind(actor.tenantId, barcode).first<Record<string, unknown>>();
      if (existingUnit) throw new V14OperationError(409, 'BARCODE_ALREADY_COUNTED', 'CargoUnit barcode already exists', existingUnit);
      const cargoUnitId = `CU-${crypto.randomUUID()}`; const countEventId = `CE-${crypto.randomUUID()}`;
      const now = new Date().toISOString(); const weight = Math.max(0, numberValue(body, 'weight_kg'));
      const condition = String(body.condition_status ?? 'NORMAL').trim().toUpperCase();
      const allowedConditions = ['NORMAL', 'DAMAGED', 'WET', 'OPENED', 'DEFORMED', 'LABEL_ISSUE', 'OTHER'];
      if (!allowedConditions.includes(condition)) throw new V14OperationError(400, 'VALIDATION_ERROR', 'condition_status is invalid');
      if (!db.batch) throw new V14OperationError(500, 'DATABASE_BATCH_REQUIRED', 'Atomic D1 batch support is required');
      await db.batch([
        db.prepare(
          `INSERT INTO cargo_units (cargo_unit_id, tenant_id, shipment_id, awb_id, hawb_no,
             business_barcode, barcode_type, unit_sequence, actual_weight_kg, condition_status,
             inventory_state, current_location_type, current_location_id, expected_baseline_version_id,
             aggregate_quantity, is_aggregate, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'PACKAGE', ?, ?, ?, 'TAS_RECEIVED', 'AIRPORT', 'TAS', ?, 1, 0, ?, ?)`
        ).bind(cargoUnitId, actor.tenantId, line.shipment_id, line.awb_id, null, barcode, sequence,
          weight || null, condition, line.baseline_version_id, now, now),
        db.prepare(
          `INSERT INTO count_events (count_event_id, tenant_id, session_type, session_id, shipment_id,
             cargo_unit_id, event_action, quantity_delta, location_type, location_id, condition_status,
             weight_kg, occurred_at, actor_id, device_id, client_event_id, idempotency_key,
             offline_created, sync_status, evidence_refs_json)
           VALUES (?, ?, 'AIRPORT_TAS', ?, ?, ?, 'SCAN_IN', 1, 'AIRPORT', 'TAS', ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?)`
        ).bind(countEventId, actor.tenantId, receipt.tas_direct_receipt_session_id, line.shipment_id,
          cargoUnitId, condition, weight || null, optionalText(body, 'occurred_at') ?? now, actor.userId,
          optionalText(body, 'device_id'), optionalText(body, 'client_event_id') ?? idem, idem,
          Number(body.offline_created === true), JSON.stringify(stringArray(body, 'evidence_ids'))),
        db.prepare(
          `UPDATE tas_direct_receipt_lines
           SET received_pieces = received_pieces + 1, received_weight_kg = received_weight_kg + ?,
               exception_pieces = exception_pieces + ?, updated_at = ?
           WHERE tenant_id = ? AND tas_direct_receipt_line_id = ?`
        ).bind(weight, Number(condition !== 'NORMAL'), now, actor.tenantId, line.tas_direct_receipt_line_id),
        db.prepare(
          `UPDATE tas_direct_receipt_sessions SET updated_by = ?, updated_at = ?, row_version = row_version + 1
           WHERE tenant_id = ? AND tas_direct_receipt_session_id = ?`
        ).bind(actor.userId, now, actor.tenantId, receipt.tas_direct_receipt_session_id)
      ]);
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasDirectReceiptSession', aggregateId: receipt.tas_direct_receipt_session_id,
        eventType: 'TAS_DIRECT_CARGO_SCANNED', eventAction: 'SCAN_IN', idempotencyKey: `${idem}:operation`,
        stationId: 'TAS', shipmentId: line.shipment_id, flightId: receipt.flight_id, awbId: line.awb_id,
        clientEventId: optionalText(body, 'client_event_id'),
        payload: { cargo_unit_id: cargoUnitId, barcode, condition_status: condition, weight_kg: weight }
      });
      return response(c, { cargo_unit_id: cargoUnitId, barcode, received_pieces: Number(line.received_pieces) + 1, duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/direct-receipts/:id/submit', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const receipt = await loadDirectReceipt(db, actor.tenantId, c.req.param('id'));
      if (receipt.status !== 'COUNTING') throw new V14OperationError(409, 'TAS_DIRECT_RECEIPT_LOCKED', 'Receipt is not open for submission');
      const summary = await db.prepare(
        `SELECT COUNT(*) AS line_count, COALESCE(SUM(received_pieces), 0) AS received_pieces
         FROM tas_direct_receipt_lines WHERE tenant_id = ? AND tas_direct_receipt_session_id = ? AND status = 'COUNTING'`
      ).bind(actor.tenantId, receipt.tas_direct_receipt_session_id).first<{ line_count: number; received_pieces: number }>();
      if (!summary?.line_count || Number(summary.received_pieces) <= 0) throw new V14OperationError(409, 'TAS_RECEIPT_EMPTY', 'At least one AWB and one scanned CargoUnit are required');
      const now = new Date().toISOString();
      if (!db.batch) throw new V14OperationError(500, 'DATABASE_BATCH_REQUIRED', 'Atomic D1 batch support is required');
      await db.batch([
        db.prepare(`UPDATE tas_direct_receipt_lines SET status = 'SUBMITTED', updated_at = ? WHERE tenant_id = ? AND tas_direct_receipt_session_id = ? AND status = 'COUNTING'`)
          .bind(now, actor.tenantId, receipt.tas_direct_receipt_session_id),
        db.prepare(`UPDATE tas_direct_receipt_sessions SET status = 'SUBMITTED', submitted_at = ?, updated_by = ?, updated_at = ?, row_version = row_version + 1 WHERE tenant_id = ? AND tas_direct_receipt_session_id = ?`)
          .bind(now, actor.userId, now, actor.tenantId, receipt.tas_direct_receipt_session_id)
      ]);
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasDirectReceiptSession', aggregateId: receipt.tas_direct_receipt_session_id,
        eventType: 'TAS_DIRECT_RECEIPT_SUBMITTED', eventAction: 'SUBMIT', idempotencyKey: idem,
        stationId: 'TAS', flightId: receipt.flight_id, payload: summary as unknown as Record<string, unknown>
      });
      return response(c, { result: 'SUBMITTED', received_pieces: Number(summary.received_pieces) });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/direct-receipts/:id/decision', requireRoles(supervisorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const receipt = await loadDirectReceipt(db, actor.tenantId, c.req.param('id'));
      if (receipt.status !== 'SUBMITTED') throw new V14OperationError(409, 'TAS_DIRECT_RECEIPT_NOT_SUBMITTED', 'Receipt must be submitted before supervisor decision');
      const decision = String(body.decision ?? 'PASS').trim().toUpperCase();
      if (!['PASS', 'CONDITIONAL_PASS', 'BLOCKED'].includes(decision)) throw new V14OperationError(400, 'VALIDATION_ERROR', 'decision is invalid');
      const evidence = requireEvidence(body, 'Receipt decision evidence is required');
      const lines = await db.prepare(
        `SELECT l.*, a.awb_no FROM tas_direct_receipt_lines l JOIN awbs a ON a.awb_id = l.awb_id
         WHERE l.tenant_id = ? AND l.tas_direct_receipt_session_id = ? ORDER BY a.awb_no`
      ).bind(actor.tenantId, receipt.tas_direct_receipt_session_id).all<Record<string, any>>();
      const mismatches = lines.results.filter((line) => line.expected_pieces > 0 && line.expected_pieces !== line.received_pieces);
      if (decision === 'PASS' && mismatches.length) {
        throw new V14OperationError(409, 'TAS_RECEIPT_QUANTITY_MISMATCH', 'PASS requires forecast and received quantities to match', {
          awbs: mismatches.map((line) => ({ awb_no: line.awb_no, expected_pieces: line.expected_pieces, received_pieces: line.received_pieces }))
        });
      }
      if (decision !== 'PASS' && !optionalText(body, 'reason')) throw new V14OperationError(400, 'VALIDATION_ERROR', 'reason is required for conditional or blocked decisions');
      const now = new Date().toISOString();
      const accepted = decision !== 'BLOCKED'; const nextStatus = decision === 'PASS' ? 'ACCEPTED' : decision === 'CONDITIONAL_PASS' ? 'CONDITIONAL_ACCEPTED' : 'BLOCKED';
      if (!db.batch) throw new V14OperationError(500, 'DATABASE_BATCH_REQUIRED', 'Atomic D1 batch support is required');
      const statements = [
        db.prepare(`UPDATE tas_direct_receipt_lines SET status = ?, updated_at = ? WHERE tenant_id = ? AND tas_direct_receipt_session_id = ?`)
          .bind(nextStatus, now, actor.tenantId, receipt.tas_direct_receipt_session_id),
        db.prepare(
          `UPDATE tas_direct_receipt_sessions SET status = ?, accepted_at = ?, accepted_by = ?, decision = ?,
             decision_reason = ?, evidence_refs_json = ?, updated_by = ?, updated_at = ?, row_version = row_version + 1
           WHERE tenant_id = ? AND tas_direct_receipt_session_id = ?`
        ).bind(nextStatus, accepted ? now : null, actor.userId, decision, optionalText(body, 'reason'), JSON.stringify(evidence), actor.userId, now,
          actor.tenantId, receipt.tas_direct_receipt_session_id)
      ];
      for (const line of lines.results) {
        if (accepted) {
          statements.push(db.prepare(
            `UPDATE cargo_units SET inventory_state = 'RELEASED', current_location_type = 'AIRPORT', current_location_id = 'TAS', updated_at = ?
             WHERE tenant_id = ? AND shipment_id = ? AND cargo_unit_id IN (
               SELECT cargo_unit_id FROM count_events WHERE tenant_id = ? AND session_type = 'AIRPORT_TAS' AND session_id = ? AND shipment_id = ?
             )`
          ).bind(now, actor.tenantId, line.shipment_id, actor.tenantId, receipt.tas_direct_receipt_session_id, line.shipment_id));
          if (line.forecast_status === 'PROVISIONAL' || Number(line.expected_pieces) === 0) {
            statements.push(
              db.prepare(`UPDATE awbs SET pieces = ?, gross_weight = ?, current_node = 'TAS Received', updated_at = ? WHERE awb_id = ?`)
                .bind(line.received_pieces, line.received_weight_kg, now, line.awb_id),
              db.prepare(`UPDATE shipments SET total_pieces = ?, total_weight = ?, current_node = 'TAS Received', fulfillment_status = 'TAS Received', updated_at = ? WHERE shipment_id = ?`)
                .bind(line.received_pieces, line.received_weight_kg, now, line.shipment_id),
              db.prepare(`UPDATE cargo_baseline_versions SET expected_pieces = ?, expected_weight_kg = ?, change_reason = 'Confirmed from direct TAS receipt', approved_by = ?, published_at = ?, source_type = 'TAS_DIRECT_RECEIPT_CONFIRMED' WHERE tenant_id = ? AND shipment_id = ? AND status = 'PUBLISHED'`)
                .bind(line.received_pieces, line.received_weight_kg, actor.userId, now, actor.tenantId, line.shipment_id),
              db.prepare(`UPDATE tas_outbound_awb_forecasts SET forecast_status = 'CONFIRMED', expected_pieces = ?, expected_weight_kg = ?, updated_by = ?, updated_at = ? WHERE tenant_id = ? AND flight_id = ? AND awb_id = ?`)
                .bind(line.received_pieces, line.received_weight_kg, actor.userId, now, actor.tenantId, receipt.flight_id, line.awb_id)
            );
          }
        }
      }
      if (receipt.tas_truck_prealert_id) {
        statements.push(db.prepare(`UPDATE tas_truck_prealerts SET status = ?, updated_by = ?, updated_at = ? WHERE tenant_id = ? AND tas_truck_prealert_id = ?`)
          .bind(accepted ? 'COMPLETED' : 'RECEIVING', actor.userId, now, actor.tenantId, receipt.tas_truck_prealert_id));
      }
      await db.batch(statements);
      const totals = accepted ? await refreshHandlingReceivedTotals(db, actor.tenantId, receipt.flight_id) : { pieces: 0, weight_kg: 0 };
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasDirectReceiptSession', aggregateId: receipt.tas_direct_receipt_session_id,
        eventType: accepted ? 'TAS_DIRECT_RECEIPT_ACCEPTED' : 'TAS_DIRECT_RECEIPT_BLOCKED',
        eventAction: decision, idempotencyKey: idem, stationId: 'TAS', flightId: receipt.flight_id,
        payload: { decision, reason: optionalText(body, 'reason'), evidence_ids: evidence, released_pieces: totals.pieces }
      });
      return response(c, { result: nextStatus, released_pieces: totals.pieces, released_weight_kg: totals.weight_kg });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/bulk-items', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { tas_bulk_load_item_id: duplicate.aggregate_id, duplicate: true });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (!['PLANNING', 'BUILDUP'].includes(handling.status)) throw new V14OperationError(409, 'TAS_BUILDUP_LOCKED', 'Bulk cargo planning is locked');
      const barcode = requiredText(body, 'barcode').toUpperCase();
      const unit = await loadRequired<Record<string, any>>(
        db,
        `SELECT u.*, a.awb_no, a.flight_id FROM cargo_units u LEFT JOIN awbs a ON a.awb_id = u.awb_id
         WHERE u.tenant_id = ? AND u.business_barcode = ? AND u.inventory_state = 'RELEASED'
           AND u.archived_at IS NULL AND (a.awb_id IS NULL OR a.deleted_at IS NULL)
           AND (a.flight_id = ? OR EXISTS (
             SELECT 1 FROM airport_receipt_sessions r
             WHERE r.tenant_id = ? AND r.flight_id = ? AND r.shipment_id = u.shipment_id
               AND r.status IN ('ACCEPTED','CONDITIONAL_ACCEPTED','COMPLETED')
           ))`,
        [actor.tenantId, barcode, handling.flight_id, actor.tenantId, handling.flight_id],
        'TAS_CARGO_NOT_ELIGIBLE',
        'CargoUnit is not released for this TAS-LGG flight'
      );
      await ensureNotAssigned(db, actor.tenantId, unit.cargo_unit_id);
      const itemId = `TASBULK-${crypto.randomUUID()}`; const now = new Date().toISOString();
      const weight = Number(unit.actual_weight_kg ?? unit.expected_weight_kg ?? 0);
      await db.prepare(
        `INSERT INTO tas_bulk_load_items (tas_bulk_load_item_id, tenant_id, tas_flight_handling_session_id,
           cargo_unit_id, shipment_id, awb_id, position_code, piece_count, weight_kg,
           status, assigned_by, assigned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', ?, ?)`
      ).bind(itemId, actor.tenantId, handling.tas_flight_handling_session_id, unit.cargo_unit_id,
        unit.shipment_id, unit.awb_id, optionalText(body, 'position_code'), Number(unit.aggregate_quantity || 1), weight, actor.userId, now).run();
      await db.prepare(`UPDATE cargo_units SET current_location_type = 'BULK', current_location_id = ?, updated_at = ? WHERE tenant_id = ? AND cargo_unit_id = ?`)
        .bind(optionalText(body, 'position_code') ?? 'TAS-BULK', now, actor.tenantId, unit.cargo_unit_id).run();
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasFlightHandlingSession', aggregateId: handling.tas_flight_handling_session_id,
        eventType: 'TAS_CARGO_ASSIGNED_TO_BULK', eventAction: 'ASSIGN_BULK', idempotencyKey: idem,
        stationId: 'TAS', shipmentId: unit.shipment_id, flightId: handling.flight_id, awbId: unit.awb_id,
        payload: { tas_bulk_load_item_id: itemId, cargo_unit_id: unit.cargo_unit_id, barcode, position_code: optionalText(body, 'position_code') }
      });
      return response(c, { tas_bulk_load_item_id: itemId, status: 'ASSIGNED', duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/loading/ulds/:uldId/confirm', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (handling.status !== 'HANDED_TO_AIRLINE') throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Airline handover must be completed before individual loading confirmation');
      const uld = await loadRequired<Record<string, any>>(
        db,
        `SELECT * FROM tas_ulds WHERE tenant_id = ? AND tas_flight_handling_session_id = ? AND tas_uld_id = ? AND archived_at IS NULL`,
        [actor.tenantId, handling.tas_flight_handling_session_id, c.req.param('uldId')],
        'TAS_ULD_NOT_FOUND',
        'TAS ULD was not found'
      );
      if (uld.status !== 'HANDED_TO_AIRLINE') throw new V14OperationError(409, 'TAS_ULD_NOT_READY_FOR_LOADING', 'ULD must be handed to the airline before loading');
      const evidence = requireEvidence(body, 'ULD loading evidence is required'); const now = new Date().toISOString();
      if (!db.batch) throw new V14OperationError(500, 'DATABASE_BATCH_REQUIRED', 'Atomic D1 batch support is required');
      await db.batch([
        db.prepare(`UPDATE tas_ulds SET status = 'LOADED', position_code = COALESCE(?, position_code), evidence_ids_json = ?, updated_at = ?, row_version = row_version + 1 WHERE tenant_id = ? AND tas_uld_id = ?`)
          .bind(optionalText(body, 'position_code'), JSON.stringify(evidence), now, actor.tenantId, uld.tas_uld_id),
        db.prepare(`UPDATE tas_uld_items SET status = 'LOADED', loaded_at = ? WHERE tenant_id = ? AND tas_uld_id = ? AND removed_at IS NULL AND status = 'ASSIGNED'`)
          .bind(now, actor.tenantId, uld.tas_uld_id),
        db.prepare(`UPDATE cargo_units SET inventory_state = 'LOADED', current_location_type = 'AIRCRAFT', current_location_id = ?, updated_at = ? WHERE tenant_id = ? AND cargo_unit_id IN (SELECT cargo_unit_id FROM tas_uld_items WHERE tenant_id = ? AND tas_uld_id = ? AND removed_at IS NULL)`)
          .bind(handling.flight_id, now, actor.tenantId, actor.tenantId, uld.tas_uld_id)
      ]);
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasFlightHandlingSession', aggregateId: handling.tas_flight_handling_session_id,
        eventType: 'TAS_ULD_LOADED_TO_AIRCRAFT', eventAction: 'LOAD_ULD', idempotencyKey: idem,
        stationId: 'TAS', flightId: handling.flight_id,
        payload: { tas_uld_id: uld.tas_uld_id, uld_code: uld.uld_code, position_code: optionalText(body, 'position_code'), evidence_ids: evidence }
      });
      return response(c, { result: 'LOADED', tas_uld_id: uld.tas_uld_id });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/flights/:id/loading/bulk/:itemId/confirm', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const handling = await loadHandling(db, actor.tenantId, c.req.param('id'));
      if (handling.status !== 'HANDED_TO_AIRLINE') throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Airline handover must be completed before individual loading confirmation');
      const item = await loadRequired<Record<string, any>>(
        db,
        `SELECT * FROM tas_bulk_load_items WHERE tenant_id = ? AND tas_flight_handling_session_id = ?
           AND tas_bulk_load_item_id = ? AND removed_at IS NULL`,
        [actor.tenantId, handling.tas_flight_handling_session_id, c.req.param('itemId')],
        'TAS_BULK_ITEM_NOT_FOUND',
        'TAS bulk load item was not found'
      );
      if (item.status !== 'HANDED_TO_AIRLINE') throw new V14OperationError(409, 'TAS_BULK_NOT_READY_FOR_LOADING', 'Bulk cargo must be handed to the airline before loading');
      const evidence = requireEvidence(body, 'Bulk loading evidence is required'); const now = new Date().toISOString();
      if (!db.batch) throw new V14OperationError(500, 'DATABASE_BATCH_REQUIRED', 'Atomic D1 batch support is required');
      await db.batch([
        db.prepare(`UPDATE tas_bulk_load_items SET status = 'LOADED', position_code = COALESCE(?, position_code), loaded_at = ? WHERE tenant_id = ? AND tas_bulk_load_item_id = ?`)
          .bind(optionalText(body, 'position_code'), now, actor.tenantId, item.tas_bulk_load_item_id),
        db.prepare(`UPDATE cargo_units SET inventory_state = 'LOADED', current_location_type = 'AIRCRAFT', current_location_id = ?, updated_at = ? WHERE tenant_id = ? AND cargo_unit_id = ?`)
          .bind(handling.flight_id, now, actor.tenantId, item.cargo_unit_id)
      ]);
      await appendOperationEvent(db, actor, {
        aggregateType: 'TasFlightHandlingSession', aggregateId: handling.tas_flight_handling_session_id,
        eventType: 'TAS_BULK_LOADED_TO_AIRCRAFT', eventAction: 'LOAD_BULK', idempotencyKey: idem,
        stationId: 'TAS', shipmentId: item.shipment_id, flightId: handling.flight_id, awbId: item.awb_id,
        payload: { tas_bulk_load_item_id: item.tas_bulk_load_item_id, cargo_unit_id: item.cargo_unit_id, position_code: optionalText(body, 'position_code'), evidence_ids: evidence }
      });
      return response(c, { result: 'LOADED', tas_bulk_load_item_id: item.tas_bulk_load_item_id });
    } catch (error) { return handleError(c, error); }
  });
}
