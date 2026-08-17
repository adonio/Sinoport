import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { ApiApp } from '../index';
import { enqueueSkyledgerEvent } from '../lib/integration-sync';
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
import { jsonError } from '../lib/http';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

function handleError(c: any, error: unknown) {
  if (error instanceof V14OperationError) return jsonError(c, error.status, error.code, error.message, error.details);
  console.error('[v14-transport]', error);
  return jsonError(c, 500, 'TRANSPORT_OPERATION_FAILED', error instanceof Error ? error.message : 'Operation failed');
}

function response(c: any, data: Record<string, unknown>, status: 200 | 201 = 200) {
  return c.json({ request_id: requestId(c.req.raw.headers), ...data }, status);
}

export function registerV14TransportRoutes(app: ApiApp, requireRoles: RequireRoles) {
  const viewRoles: RoleCode[] = [
    'platform_admin', 'station_supervisor', 'TRUCK_OPERATOR', 'A1_CARGO_CONTROLLER',
    'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER', 'B1_TAS_STATION_CONTROLLER'
  ];

  app.get('/api/v1/transport-jobs', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const actor = c.var.actor;
      const status = String(c.req.query('status') ?? '').trim();
      const shipmentId = String(c.req.query('shipment_id') ?? '').trim();
      const rows = await db
        .prepare(
          `SELECT j.*, r.route_template_code,
                  (SELECT vehicle_plate FROM vehicle_driver_snapshots v
                   WHERE v.transport_job_id = j.transport_job_id AND v.active_flag = 1
                   ORDER BY v.snapshot_version DESC LIMIT 1) AS vehicle_plate
           FROM transport_jobs j JOIN route_templates r ON r.route_template_id = j.route_template_id
           WHERE j.tenant_id = ? AND (? = '' OR j.status = ?) AND (? = '' OR j.shipment_id = ?)
           ORDER BY j.updated_at DESC LIMIT 100`
        )
        .bind(actor.tenantId, status, status, shipmentId, shipmentId)
        .all();
      return response(c, { items: rows.results, total: rows.results.length });
    } catch (error) {
      return handleError(c, error);
    }
  });

  app.post('/api/v1/transport-jobs', requireRoles(['platform_admin', 'station_supervisor', 'A1_CARGO_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { transport_job_id: duplicate.aggregate_id, duplicate: true });
      const shipmentId = requiredText(body, 'shipment_id');
      const shipment = await loadRequired<{ station_id: string; flight_id: string }>(
        db,
        `SELECT s.station_id, i.flight_id
         FROM shipments s
         JOIN v14_awb_intakes i ON i.shipment_id = s.shipment_id
         WHERE s.shipment_id = ? AND i.tenant_id = ? AND i.origin_execution_station_id = 'SZX'`,
        [shipmentId, actor.tenantId],
        'SHIPMENT_NOT_FOUND', 'Shipment was not found'
      );
      const approvedReceipt = await db.prepare(
        `SELECT receipt_session_id FROM warehouse_receipt_sessions
         WHERE tenant_id = ? AND shipment_id = ? AND status = 'APPROVED'
         ORDER BY approved_at DESC LIMIT 1`
      ).bind(actor.tenantId, shipmentId).first<{ receipt_session_id: string }>();
      if (!approvedReceipt) {
        throw new V14OperationError(409, 'PREWAREHOUSE_APPROVAL_REQUIRED', 'Approved SZX pre-warehouse receipt is required');
      }
      const activeJob = await db.prepare(
        `SELECT transport_job_id, status FROM transport_jobs
         WHERE tenant_id = ? AND shipment_id = ? AND status <> 'CANCELLED'
         ORDER BY updated_at DESC LIMIT 1`
      ).bind(actor.tenantId, shipmentId).first<{ transport_job_id: string; status: string }>();
      if (activeJob) {
        throw new V14OperationError(409, 'TRANSPORT_JOB_ALREADY_EXISTS', 'An active transport job already exists', activeJob);
      }
      const routeCode = optionalText(body, 'route_template_code') ?? 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2';
      const route = await loadRequired<{
        route_template_id: string; version_no: number; status: string;
        schedule_source_status: string; schedule_approval_status: string;
      }>(
        db,
        `SELECT route_template_id, version_no, status, schedule_source_status, schedule_approval_status
         FROM route_templates WHERE route_template_code = ? ORDER BY version_no DESC LIMIT 1`,
        [routeCode],
        'ROUTE_TEMPLATE_NOT_FOUND',
        'Route template was not found'
      );
      if (route.status === 'RETIRED') throw new V14OperationError(409, 'RETIRED_ROUTE_TEMPLATE', 'Retired route templates cannot create new jobs');
      if (routeCode !== 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2') {
        throw new V14OperationError(409, 'ALTERNATE_ROUTE_TEMPLATE_REQUIRED', 'P0 production flow must use the V2 Alashankou-Dostyk template');
      }
      if (body.production_mode === true && route.schedule_approval_status !== 'APPROVED_FOR_PRODUCTION') {
        throw new V14OperationError(409, 'OCC_MANUAL_APPROVAL_PENDING', 'Pilot route baseline is not approved for production SLA');
      }
      const jobId = `TRJ-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const stationId = String(optionalText(body, 'station_id') ?? 'SZX').toUpperCase();
      if (stationId !== 'SZX') {
        throw new V14OperationError(409, 'ORIGIN_EXECUTION_STATION_MISMATCH', 'V1.4 transport job must originate at SZX');
      }
      const requestedFlightId = optionalText(body, 'flight_id') ?? shipment.flight_id;
      if (requestedFlightId !== shipment.flight_id) {
        throw new V14OperationError(409, 'FLIGHT_SCOPE_MISMATCH', 'Transport job flight must match the AWB intake flight');
      }
      await db
        .prepare(
          `INSERT INTO transport_jobs (
             transport_job_id, tenant_id, station_id, shipment_id, flight_id, awb_ids_json,
             origin_facility_id, destination_facility_id, route_template_id, route_template_version,
             planned_loading_at, planned_departure_at, planned_arrival_at, status, health_state,
             current_control_segment, carrier_party_id, dispatcher_id,
             planned_capacity_weight_kg, planned_capacity_volume_m3, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', 'UNKNOWN', 'A1', ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          jobId, actor.tenantId, stationId, shipmentId, requestedFlightId,
          JSON.stringify(stringArray(body, 'awb_ids')),
          optionalText(body, 'origin_facility_id') ?? 'SZX_PREWAREHOUSE',
          optionalText(body, 'destination_facility_id') ?? 'TAS_AIRPORT_STAGING',
          route.route_template_id, route.version_no,
          optionalText(body, 'planned_loading_at'), optionalText(body, 'planned_departure_at'),
          optionalText(body, 'planned_arrival_at'), optionalText(body, 'carrier_party_id'),
          optionalText(body, 'dispatcher_id'), numberValue(body, 'planned_capacity_weight_kg') || null,
          numberValue(body, 'planned_capacity_volume_m3') || null, now, now
        )
        .run();
      const templates = await db
        .prepare(
          `SELECT checkpoint_template_id, route_template_version, sequence
           FROM checkpoint_templates WHERE route_template_id = ? AND route_template_version = ? ORDER BY sequence`
        )
        .bind(route.route_template_id, route.version_no)
        .all<{ checkpoint_template_id: string; route_template_version: number; sequence: number }>();
      for (const template of templates.results) {
        await db
          .prepare(
            `INSERT INTO checkpoint_instances (
               checkpoint_instance_id, transport_job_id, checkpoint_template_id, template_version, sequence
             ) VALUES (?, ?, ?, ?, ?)`
          )
          .bind(`CPI-${crypto.randomUUID()}`, jobId, template.checkpoint_template_id, template.route_template_version, template.sequence)
          .run();
      }
      await appendOperationEvent(db, actor, {
        aggregateType: 'TransportJob', aggregateId: jobId, eventType: 'TRANSPORT_JOB_CREATED',
        idempotencyKey: idem, stationId, shipmentId, flightId: requestedFlightId,
        payload: { route_template_code: routeCode, route_template_version: route.version_no }
      });
      return response(c, { transport_job_id: jobId, status: 'PLANNED', checkpoint_count: templates.results.length, duplicate: false }, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  app.get('/api/v1/transport-jobs/:id', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const job = await loadRequired<Record<string, unknown>>(
        db,
        `SELECT j.*, r.route_template_code, r.schedule_approval_status
         FROM transport_jobs j JOIN route_templates r ON r.route_template_id = j.route_template_id
         WHERE j.transport_job_id = ?`,
        [c.req.param('id')], 'TRANSPORT_JOB_NOT_FOUND', 'Transport job was not found'
      );
      const [snapshots, checkpoints, border, airportReceipt] = await Promise.all([
        db.prepare(`SELECT * FROM vehicle_driver_snapshots WHERE transport_job_id = ? ORDER BY snapshot_scope, snapshot_version DESC`).bind(c.req.param('id')).all(),
        db.prepare(
          `SELECT i.*, t.checkpoint_code, t.name_zh, t.name_en, t.checkpoint_type,
                  t.required_fields_json, t.required_evidence_types_json, t.blocking_policy
           FROM checkpoint_instances i JOIN checkpoint_templates t ON t.checkpoint_template_id = i.checkpoint_template_id
           WHERE i.transport_job_id = ? ORDER BY i.sequence`
        ).bind(c.req.param('id')).all(),
        db.prepare(`SELECT * FROM border_operations WHERE transport_job_id = ? ORDER BY created_at DESC LIMIT 1`).bind(c.req.param('id')).first(),
        db.prepare(`SELECT * FROM airport_receipt_sessions WHERE transport_job_id = ? ORDER BY created_at DESC LIMIT 1`).bind(c.req.param('id')).first()
      ]);
      return response(c, { job, vehicle_driver_snapshots: snapshots.results, checkpoints: checkpoints.results, border_operation: border, airport_receipt: airportReceipt });
    } catch (error) {
      return handleError(c, error);
    }
  });

  app.patch('/api/v1/transport-jobs/:id', requireRoles(['platform_admin', 'station_supervisor', 'A1_CARGO_CONTROLLER', 'A2_DOMESTIC_TRUCK_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { result: 'DUPLICATE', transport_job_id: c.req.param('id') });
      const job = await loadRequired<{ status: string; row_version: number; shipment_id: string; station_id: string; flight_id: string | null }>(
        db, `SELECT status, row_version, shipment_id, station_id, flight_id FROM transport_jobs WHERE transport_job_id = ?`,
        [c.req.param('id')], 'TRANSPORT_JOB_NOT_FOUND', 'Transport job was not found'
      );
      if (!['DRAFT', 'PLANNED', 'READY_FOR_LOADING'].includes(job.status)) {
        throw new V14OperationError(409, 'REROUTE_CHANGE_REQUEST_REQUIRED', 'Active route fields require a change request after loading starts');
      }
      const expectedVersion = integerValue(body, 'row_version', job.row_version);
      if (expectedVersion !== job.row_version) throw new V14OperationError(409, 'PLAN_VERSION_CONFLICT', 'Transport job version is stale');
      await db
        .prepare(
          `UPDATE transport_jobs SET
             planned_loading_at = COALESCE(?, planned_loading_at),
             planned_departure_at = COALESCE(?, planned_departure_at),
             planned_arrival_at = COALESCE(?, planned_arrival_at),
             carrier_party_id = COALESCE(?, carrier_party_id), dispatcher_id = COALESCE(?, dispatcher_id),
             row_version = row_version + 1, updated_at = ? WHERE transport_job_id = ? AND row_version = ?`
        )
        .bind(
          optionalText(body, 'planned_loading_at'), optionalText(body, 'planned_departure_at'),
          optionalText(body, 'planned_arrival_at'), optionalText(body, 'carrier_party_id'),
          optionalText(body, 'dispatcher_id'), new Date().toISOString(), c.req.param('id'), job.row_version
        )
        .run();
      await appendOperationEvent(db, actor, {
        aggregateType: 'TransportJob', aggregateId: c.req.param('id'), eventType: 'TRANSPORT_JOB_UPDATED',
        idempotencyKey: idem, stationId: job.station_id, shipmentId: job.shipment_id, flightId: job.flight_id,
        payload: body
      });
      return response(c, { result: 'UPDATED', transport_job_id: c.req.param('id'), row_version: job.row_version + 1 });
    } catch (error) {
      return handleError(c, error);
    }
  });

  app.post('/api/v1/transport-jobs/:id/vehicle-driver-snapshots', requireRoles(['platform_admin', 'station_supervisor', 'TRUCK_OPERATOR', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { result: 'DUPLICATE', vehicle_driver_snapshot_id: (JSON.parse(duplicate.payload_json) as any).vehicle_driver_snapshot_id });
      const job = await loadRequired<{ shipment_id: string; station_id: string; flight_id: string | null; status: string }>(
        db, `SELECT shipment_id, station_id, flight_id, status FROM transport_jobs WHERE transport_job_id = ?`,
        [c.req.param('id')], 'TRANSPORT_JOB_NOT_FOUND', 'Transport job was not found'
      );
      const scope = optionalText(body, 'snapshot_scope') ?? 'PRIMARY';
      const current = await db
        .prepare(`SELECT vehicle_driver_snapshot_id, snapshot_version, vehicle_plate, driver_name, seal_number FROM vehicle_driver_snapshots WHERE transport_job_id = ? AND snapshot_scope = ? AND active_flag = 1`)
        .bind(c.req.param('id'), scope)
        .first<{ vehicle_driver_snapshot_id: string; snapshot_version: number; vehicle_plate: string; driver_name: string; seal_number: string | null }>();
      const version = await db
        .prepare(`SELECT COALESCE(MAX(snapshot_version), 0) + 1 AS next_version FROM vehicle_driver_snapshots WHERE transport_job_id = ?`)
        .bind(c.req.param('id'))
        .first<{ next_version: number }>();
      if (current && !optionalText(body, 'change_reason')) {
        throw new V14OperationError(409, 'VEHICLE_ALREADY_ACTIVE_ON_JOB', 'Changing an active vehicle requires change_reason');
      }
      let changeRequestId: string | null = null;
      if (current && !['DRAFT', 'PLANNED', 'READY_FOR_LOADING'].includes(job.status)) {
        const approvedBy = optionalText(body, 'approved_by');
        if (!approvedBy || approvedBy === actor.userId) {
          throw new V14OperationError(409, 'VEHICLE_CHANGE_REVIEW_REQUIRED', 'Post-departure vehicle, driver or seal changes require a distinct approver');
        }
        changeRequestId = `CHG-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        await db.prepare(
          `INSERT INTO change_requests (
             change_request_id, tenant_id, related_object_type, related_object_id, change_type,
             before_json, after_json, reason, requested_by, approved_by, status, approved_at
           ) VALUES (?, ?, 'TransportJob', ?, 'VEHICLE_DRIVER_SEAL_CHANGE', ?, ?, ?, ?, ?, 'APPROVED', ?)`
        ).bind(
          changeRequestId, actor.tenantId, c.req.param('id'),
          JSON.stringify({ vehicle_plate: current.vehicle_plate, driver_name: current.driver_name, seal_number: current.seal_number }),
          JSON.stringify({ vehicle_plate: requiredText(body, 'vehicle_plate'), driver_name: requiredText(body, 'driver_name'), seal_number: optionalText(body, 'seal_number') }),
          requiredText(body, 'change_reason'), actor.userId, approvedBy, now
        ).run();
      }
      if (current) {
        await db.prepare(`UPDATE vehicle_driver_snapshots SET active_flag = 0 WHERE vehicle_driver_snapshot_id = ?`).bind(current.vehicle_driver_snapshot_id).run();
      }
      const snapshotId = `VDS-${crypto.randomUUID()}`;
      await db
        .prepare(
          `INSERT INTO vehicle_driver_snapshots (
             vehicle_driver_snapshot_id, tenant_id, transport_job_id, snapshot_version, snapshot_scope,
             carrier_party_id, vehicle_plate, vehicle_type, tractor_plate, trailer_plate,
             legal_load_kg, gross_weight_limit_kg, axle_limit_ref, insurance_valid_until,
             driver_name, driver_phone_encrypted, driver_document_ref, backup_driver_name,
             gps_provider_code, external_vehicle_id, gps_device_no, seal_number, pieces, weight_kg,
             active_flag, change_reason, created_by, approved_by, effective_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
        )
        .bind(
          snapshotId, actor.tenantId, c.req.param('id'), Number(version?.next_version ?? 1), scope,
          optionalText(body, 'carrier_party_id'), requiredText(body, 'vehicle_plate'),
          optionalText(body, 'vehicle_type') ?? 'TRUCK', optionalText(body, 'tractor_plate'), optionalText(body, 'trailer_plate'),
          numberValue(body, 'legal_load_kg') || null, numberValue(body, 'gross_weight_limit_kg') || null,
          optionalText(body, 'axle_limit_ref'), optionalText(body, 'insurance_valid_until'), requiredText(body, 'driver_name'),
          optionalText(body, 'driver_phone_encrypted'), optionalText(body, 'driver_document_ref'), optionalText(body, 'backup_driver_name'),
          optionalText(body, 'gps_provider_code'), optionalText(body, 'external_vehicle_id'), optionalText(body, 'gps_device_no'),
          optionalText(body, 'seal_number'), Math.max(0, integerValue(body, 'pieces')), Math.max(0, numberValue(body, 'weight_kg')),
          optionalText(body, 'change_reason'), actor.userId, optionalText(body, 'approved_by'),
          optionalText(body, 'effective_at') ?? new Date().toISOString()
        )
        .run();
      if (scope === 'PRIMARY') {
        await db
          .prepare(`UPDATE transport_jobs SET vehicle_driver_snapshot_id = ?, seal_number = COALESCE(?, seal_number), row_version = row_version + 1, updated_at = ? WHERE transport_job_id = ?`)
          .bind(snapshotId, optionalText(body, 'seal_number'), new Date().toISOString(), c.req.param('id'))
          .run();
      }
      await appendOperationEvent(db, actor, {
        aggregateType: 'TransportJob', aggregateId: c.req.param('id'), eventType: current ? 'VEHICLE_DRIVER_CHANGED' : 'VEHICLE_DRIVER_LOCKED',
        idempotencyKey: idem, stationId: job.station_id, shipmentId: job.shipment_id, flightId: job.flight_id,
        reasonCode: optionalText(body, 'change_reason'), payload: { vehicle_driver_snapshot_id: snapshotId, snapshot_scope: scope, vehicle_plate: requiredText(body, 'vehicle_plate'), change_request_id: changeRequestId }
      });
      return response(c, { result: 'LOCKED', vehicle_driver_snapshot_id: snapshotId, snapshot_version: Number(version?.next_version ?? 1), change_request_id: changeRequestId }, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  app.post('/api/v1/transport-jobs/:id/loading/complete', requireRoles(['platform_admin', 'station_supervisor', 'PREWH_OPERATOR', 'A1_CARGO_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const actor = c.var.actor;
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { result: 'DUPLICATE', transport_job_id: c.req.param('id') });
      const job = await loadRequired<{
        shipment_id: string; station_id: string; flight_id: string | null; status: string;
        vehicle_driver_snapshot_id: string | null;
      }>(
        db, `SELECT shipment_id, station_id, flight_id, status, vehicle_driver_snapshot_id FROM transport_jobs WHERE transport_job_id = ?`,
        [c.req.param('id')], 'TRANSPORT_JOB_NOT_FOUND', 'Transport job was not found'
      );
      if (!job.vehicle_driver_snapshot_id) throw new V14OperationError(409, 'GATE_BLOCKED', 'Vehicle and driver snapshot must be locked first');
      if (!['PLANNED', 'READY_FOR_LOADING', 'LOADING'].includes(job.status)) throw new V14OperationError(409, 'SESSION_NOT_EDITABLE', 'Transport job cannot complete loading in its current status');
      const receipt = await db
        .prepare(`SELECT status FROM warehouse_receipt_sessions WHERE tenant_id = ? AND shipment_id = ? ORDER BY created_at DESC LIMIT 1`)
        .bind(actor.tenantId, job.shipment_id)
        .first<{ status: string }>();
      if (!receipt || receipt.status !== 'APPROVED') throw new V14OperationError(409, 'GATE_BLOCKED', 'Pre-warehouse receipt gate is not approved');
      const units = await db
        .prepare(`SELECT cargo_unit_id, aggregate_quantity, actual_weight_kg, expected_weight_kg FROM cargo_units WHERE tenant_id = ? AND shipment_id = ? AND inventory_state = 'PREWH_RECEIVED' AND archived_at IS NULL`)
        .bind(actor.tenantId, job.shipment_id)
        .all<{ cargo_unit_id: string; aggregate_quantity: number; actual_weight_kg: number | null; expected_weight_kg: number | null }>();
      const loadedAt = optionalText(body, 'loaded_at') ?? new Date().toISOString();
      for (const unit of units.results) {
        await db
          .prepare(
            `INSERT INTO cargo_unit_transport_assignments (
               assignment_id, tenant_id, cargo_unit_id, transport_job_id, assignment_status, loaded_at, assigned_by
             ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`
          )
          .bind(`CUA-${crypto.randomUUID()}`, actor.tenantId, unit.cargo_unit_id, c.req.param('id'), loadedAt, actor.userId)
          .run();
        await db.prepare(`UPDATE cargo_units SET inventory_state = 'LOADED', current_location_type = 'TRUCK', current_location_id = ?, updated_at = ? WHERE cargo_unit_id = ?`)
          .bind(c.req.param('id'), loadedAt, unit.cargo_unit_id).run();
      }
      const pieces = units.results.reduce((sum, unit) => sum + Number(unit.aggregate_quantity || 1), 0);
      const weight = units.results.reduce((sum, unit) => sum + Number(unit.actual_weight_kg ?? unit.expected_weight_kg ?? 0), 0);
      await db
        .prepare(`UPDATE transport_jobs SET status = 'LOADED', loaded_pieces = ?, loaded_weight_kg = ?, row_version = row_version + 1, updated_at = ? WHERE transport_job_id = ?`)
        .bind(pieces, weight, loadedAt, c.req.param('id')).run();
      await appendOperationEvent(db, actor, {
        aggregateType: 'TransportJob', aggregateId: c.req.param('id'), eventType: 'TRANSPORT_LOADING_COMPLETED',
        idempotencyKey: idem, stationId: job.station_id, shipmentId: job.shipment_id, flightId: job.flight_id,
        occurredAt: loadedAt, payload: { loaded_pieces: pieces, loaded_weight_kg: weight, cargo_unit_count: units.results.length }
      });
      await enqueueSkyledgerEvent(c.env, {
        eventType: 'truck.loading_completed.v1', aggregateType: 'TransportJob', aggregateId: c.req.param('id'),
        payload: { transport_job_id: c.req.param('id'), shipment_id: job.shipment_id, loaded_pieces: pieces, loaded_weight_kg: weight, loaded_at: loadedAt }
      });
      return response(c, { result: 'LOADED', loaded_pieces: pieces, loaded_weight_kg: weight });
    } catch (error) {
      return handleError(c, error);
    }
  });

  app.post('/api/v1/transport-jobs/:id/locations', requireRoles(['platform_admin', 'station_supervisor', 'TRUCK_OPERATOR', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { result: 'DUPLICATE', location_event_id: (JSON.parse(duplicate.payload_json) as any).location_event_id });
      const job = await loadRequired<{ shipment_id: string; station_id: string; flight_id: string | null }>(
        db, `SELECT shipment_id, station_id, flight_id FROM transport_jobs WHERE transport_job_id = ?`,
        [c.req.param('id')], 'TRANSPORT_JOB_NOT_FOUND', 'Transport job was not found'
      );
      const latitude = numberValue(body, 'latitude', Number.NaN);
      const longitude = numberValue(body, 'longitude', Number.NaN);
      const placeName = optionalText(body, 'place_name');
      if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && !placeName) {
        throw new V14OperationError(400, 'LOCATION_EVENT_INVALID', 'Coordinates or a text place_name are required');
      }
      if (Number.isFinite(latitude) && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
        throw new V14OperationError(400, 'LOCATION_EVENT_INVALID', 'Coordinates are outside valid bounds');
      }
      const locationId = `LOC-${crypto.randomUUID()}`;
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      const sourceEventId = optionalText(body, 'client_event_id') ?? idem;
      await db
        .prepare(
          `INSERT INTO location_events (
             location_event_id, tenant_id, transport_job_id, vehicle_snapshot_id, source_type,
             provider_code, source_event_id, latitude, longitude, accuracy_m, speed_kph, heading,
             place_name, occurred_at, quality_status, raw_payload_ref, actor_id, device_id,
             idempotency_key, signature_valid, mapping_status
           ) VALUES (?, ?, ?, NULL, 'MANUAL', 'SINOport', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'MAPPED')`
        )
        .bind(
          locationId, actor.tenantId, c.req.param('id'), sourceEventId,
          Number.isFinite(latitude) ? latitude : null, Number.isFinite(longitude) ? longitude : null,
          numberValue(body, 'accuracy_m') || null, numberValue(body, 'speed_kph') || null,
          numberValue(body, 'heading') || null, placeName, occurredAt,
          Number.isFinite(latitude) ? 'VALID' : 'LOW_CONFIDENCE', JSON.stringify(body), actor.userId,
          optionalText(body, 'device_id'), idem
        )
        .run();
      await db
        .prepare(`UPDATE transport_jobs SET last_location_event_id = ?, last_location_at = ?, eta_at = COALESCE(?, eta_at), eta_source = 'MANUAL', row_version = row_version + 1, updated_at = ? WHERE transport_job_id = ?`)
        .bind(locationId, occurredAt, optionalText(body, 'eta_at'), new Date().toISOString(), c.req.param('id')).run();
      let geofenceCandidateId: string | null = null;
      const geofenceCheckpointCode = optionalText(body, 'geofence_checkpoint_code');
      if (body.geofence_match === true && geofenceCheckpointCode) {
        const checkpoint = await loadRequired<{ checkpoint_instance_id: string; confirmation_policy: string }>(
          db,
          `SELECT i.checkpoint_instance_id, t.confirmation_policy
           FROM checkpoint_instances i JOIN checkpoint_templates t ON t.checkpoint_template_id = i.checkpoint_template_id
           WHERE i.transport_job_id = ? AND t.checkpoint_code = ?`,
          [c.req.param('id'), geofenceCheckpointCode], 'CHECKPOINT_NOT_FOUND', 'Geofence checkpoint was not found'
        );
        geofenceCandidateId = `GEO-${crypto.randomUUID()}`;
        await db.prepare(
          `INSERT INTO geofence_candidates (
             geofence_candidate_id, tenant_id, transport_job_id, checkpoint_instance_id,
             location_event_id, status, distance_m, generated_at
           ) VALUES (?, ?, ?, ?, ?, 'PENDING_CONFIRMATION', ?, ?)`
        ).bind(geofenceCandidateId, actor.tenantId, c.req.param('id'), checkpoint.checkpoint_instance_id,
          locationId, numberValue(body, 'geofence_distance_m') || null, new Date().toISOString()).run();
        await db.prepare(`UPDATE checkpoint_instances SET status = 'ARRIVED_CANDIDATE', arrival_location_event_id = ?, confirmation_source = 'GEOFENCE_CANDIDATE', updated_at = ?, row_version = row_version + 1 WHERE checkpoint_instance_id = ? AND status IN ('PENDING','APPROACHING')`)
          .bind(locationId, new Date().toISOString(), checkpoint.checkpoint_instance_id).run();
      }
      await appendOperationEvent(db, actor, {
        aggregateType: 'TransportJob', aggregateId: c.req.param('id'), eventType: 'TRANSPORT_LOCATION_REPORTED',
        idempotencyKey: idem, clientEventId: sourceEventId, occurredAt,
        stationId: job.station_id, shipmentId: job.shipment_id, flightId: job.flight_id,
        payload: { location_event_id: locationId, latitude: Number.isFinite(latitude) ? latitude : null, longitude: Number.isFinite(longitude) ? longitude : null, place_name: placeName, geofence_candidate_id: geofenceCandidateId }
      });
      return response(c, { result: 'RECORDED', location_event_id: locationId, quality_status: Number.isFinite(latitude) ? 'VALID' : 'LOW_CONFIDENCE', geofence_candidate_id: geofenceCandidateId, geofence_requires_manual_confirmation: Boolean(geofenceCandidateId) }, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  app.post('/api/v1/transport-jobs/:id/checkpoint-events', requireRoles(['platform_admin', 'station_supervisor', 'TRUCK_OPERATOR', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER', 'B1_TAS_STATION_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { result: 'DUPLICATE', checkpoint_instance_id: (JSON.parse(duplicate.payload_json) as any).checkpoint_instance_id });
      const job = await loadRequired<{ shipment_id: string; station_id: string; flight_id: string | null; status: string }>(
        db, `SELECT shipment_id, station_id, flight_id, status FROM transport_jobs WHERE transport_job_id = ?`,
        [c.req.param('id')], 'TRANSPORT_JOB_NOT_FOUND', 'Transport job was not found'
      );
      const checkpointCode = requiredText(body, 'checkpoint_code');
      const checkpoint = await loadRequired<{
        checkpoint_instance_id: string; sequence: number; status: string; checkpoint_code: string;
        required_evidence_types_json: string;
      }>(
        db,
        `SELECT i.checkpoint_instance_id, i.sequence, i.status, t.checkpoint_code, t.required_evidence_types_json
         FROM checkpoint_instances i JOIN checkpoint_templates t ON t.checkpoint_template_id = i.checkpoint_template_id
         WHERE i.transport_job_id = ? AND t.checkpoint_code = ?`,
        [c.req.param('id'), checkpointCode], 'CHECKPOINT_NOT_FOUND', 'Checkpoint was not found on this job'
      );
      const incompletePrevious = await db
        .prepare(
          `SELECT i.checkpoint_instance_id, t.checkpoint_code FROM checkpoint_instances i
           JOIN checkpoint_templates t ON t.checkpoint_template_id = i.checkpoint_template_id
           WHERE i.transport_job_id = ? AND i.sequence < ? AND i.status NOT IN ('ARRIVED', 'DEPARTED', 'WAIVED')
           ORDER BY i.sequence LIMIT 1`
        )
        .bind(c.req.param('id'), checkpoint.sequence)
        .first<{ checkpoint_instance_id: string; checkpoint_code: string }>();
      if (incompletePrevious && body.allow_out_of_sequence !== true) {
        throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'A previous checkpoint is incomplete', { previous_checkpoint_code: incompletePrevious.checkpoint_code });
      }
      const eventType = optionalText(body, 'event_type') ?? 'PASSED';
      const evidenceIds = stringArray(body, 'evidence_ids');
      let requiredEvidence: string[] = [];
      try { requiredEvidence = JSON.parse(checkpoint.required_evidence_types_json) as string[]; } catch { requiredEvidence = []; }
      if (requiredEvidence.length > 0 && evidenceIds.length === 0) {
        throw new V14OperationError(409, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Checkpoint requires evidence', { required_evidence_types: requiredEvidence });
      }
      if (checkpointCode === 'SZX_TRUCK_DEPARTED' && (!optionalText(body, 'departure_receipt_ref') || !optionalText(body, 'first_valid_gps_event_id'))) {
        throw new V14OperationError(409, 'ACTUAL_DEPARTURE_EVIDENCE_INCOMPLETE', 'Actual SZX departure requires warehouse receipt and first valid GPS');
      }
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      const nextStatus = eventType === 'ARRIVED' ? 'ARRIVED' : eventType === 'MISSED' ? 'MISSED' : 'DEPARTED';
      await db
        .prepare(
          `UPDATE checkpoint_instances SET status = ?,
             actual_arrival_at = CASE WHEN ? = 'ARRIVED' THEN ? ELSE actual_arrival_at END,
             actual_departure_at = CASE WHEN ? <> 'ARRIVED' THEN ? ELSE actual_departure_at END,
             confirmation_source = 'MANUAL', confirmed_by = ?, evidence_refs_json = ?,
             row_version = row_version + 1, updated_at = ? WHERE checkpoint_instance_id = ?`
        )
        .bind(nextStatus, eventType, occurredAt, eventType, occurredAt, actor.userId, JSON.stringify(evidenceIds), new Date().toISOString(), checkpoint.checkpoint_instance_id)
        .run();
      await db.prepare(
        `UPDATE geofence_candidates
         SET status = 'CONFIRMED', confirmed_at = ?, confirmed_by = ?
         WHERE checkpoint_instance_id = ? AND status = 'PENDING_CONFIRMATION'`
      ).bind(new Date().toISOString(), actor.userId, checkpoint.checkpoint_instance_id).run();
      if (checkpointCode === 'SZX_TRUCK_DEPARTED') {
        await db
          .prepare(`UPDATE transport_jobs SET status = 'IN_TRANSIT', actual_departure_at = ?, actual_departure_receipt_ref = ?, first_valid_gps_event_id = ?, current_control_segment = 'A2', row_version = row_version + 1, updated_at = ? WHERE transport_job_id = ?`)
          .bind(occurredAt, optionalText(body, 'departure_receipt_ref'), optionalText(body, 'first_valid_gps_event_id'), new Date().toISOString(), c.req.param('id')).run();
      } else if (checkpointCode === 'TAS_STAGING_ARRIVED') {
        await db
          .prepare(`UPDATE transport_jobs SET status = 'ARRIVED_TAS_STAGING', tas_staging_arrived_at = ?, current_control_segment = 'B1', row_version = row_version + 1, updated_at = ? WHERE transport_job_id = ?`)
          .bind(occurredAt, new Date().toISOString(), c.req.param('id')).run();
      }
      await appendOperationEvent(db, actor, {
        aggregateType: 'TransportJob', aggregateId: c.req.param('id'), eventType: `CHECKPOINT_${checkpointCode}`,
        eventAction: eventType, idempotencyKey: idem, occurredAt,
        stationId: job.station_id, shipmentId: job.shipment_id, flightId: job.flight_id,
        payload: { checkpoint_instance_id: checkpoint.checkpoint_instance_id, checkpoint_code: checkpointCode, status: nextStatus, evidence_ids: evidenceIds }
      });
      await enqueueSkyledgerEvent(c.env, {
        eventType: 'truck.checkpoint_confirmed.v1', aggregateType: 'TransportJob', aggregateId: c.req.param('id'),
        payload: { transport_job_id: c.req.param('id'), shipment_id: job.shipment_id, checkpoint_code: checkpointCode, event_type: eventType, occurred_at: occurredAt, evidence_ids: evidenceIds }
      });
      return response(c, { result: 'CONFIRMED', checkpoint_instance_id: checkpoint.checkpoint_instance_id, checkpoint_code: checkpointCode, status: nextStatus });
    } catch (error) {
      return handleError(c, error);
    }
  });

  app.get('/api/v1/transport-jobs/:id/timeline', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const checkpoints = await db
        .prepare(
          `SELECT i.checkpoint_instance_id, t.checkpoint_code, t.name_zh, i.sequence, i.status,
                  i.planned_arrival_at, i.actual_arrival_at, i.actual_departure_at, i.evidence_refs_json
           FROM checkpoint_instances i JOIN checkpoint_templates t ON t.checkpoint_template_id = i.checkpoint_template_id
           WHERE i.transport_job_id = ? ORDER BY i.sequence`
        )
        .bind(c.req.param('id')).all();
      const events = await db
        .prepare(`SELECT * FROM operation_events WHERE aggregate_type = 'TransportJob' AND aggregate_id = ? ORDER BY aggregate_sequence`)
        .bind(c.req.param('id')).all();
      return response(c, { checkpoints: checkpoints.results, operation_events: events.results });
    } catch (error) {
      return handleError(c, error);
    }
  });

  app.get('/api/v1/transport-jobs/:id/track', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const job = await loadRequired<{
        transport_job_id: string; status: string; last_location_at: string | null;
        last_location_event_id: string | null; current_checkpoint_instance_id: string | null;
        next_checkpoint_instance_id: string | null;
      }>(db, `SELECT transport_job_id, status, last_location_at, last_location_event_id,
                    current_checkpoint_instance_id, next_checkpoint_instance_id
             FROM transport_jobs WHERE transport_job_id = ?`, [c.req.param('id')],
        'TRANSPORT_JOB_NOT_FOUND', 'Transport job was not found');
      const [rows, checkpoints, geofenceCandidates] = await Promise.all([
        db.prepare(
          `SELECT location_event_id, source_type, provider_code, latitude, longitude, accuracy_m,
                  speed_kph, heading, place_name, occurred_at, received_at, quality_status, mapping_status
           FROM location_events WHERE transport_job_id = ? ORDER BY occurred_at DESC LIMIT 1000`
        ).bind(c.req.param('id')).all(),
        db.prepare(
          `SELECT i.checkpoint_instance_id, i.sequence, i.status, i.actual_arrival_at, i.actual_departure_at,
                  t.checkpoint_code, t.name_zh, t.stale_location_minutes
           FROM checkpoint_instances i JOIN checkpoint_templates t ON t.checkpoint_template_id = i.checkpoint_template_id
           WHERE i.transport_job_id = ? ORDER BY i.sequence`
        ).bind(c.req.param('id')).all<Record<string, any>>(),
        db.prepare(
          `SELECT geofence_candidate_id, checkpoint_instance_id, location_event_id, status,
                  distance_m, generated_at, confirmed_at, confirmed_by
           FROM geofence_candidates WHERE transport_job_id = ? ORDER BY generated_at DESC LIMIT 100`
        ).bind(c.req.param('id')).all()
      ]);
      const lastLocationAt = job.last_location_at ? new Date(job.last_location_at).getTime() : NaN;
      const locationAgeMinutes = Number.isFinite(lastLocationAt)
        ? Math.max(0, Math.floor((Date.now() - lastLocationAt) / 60000))
        : null;
      const ordered = checkpoints.results;
      const lastCheckpoint = [...ordered].reverse().find((item) => ['ARRIVED', 'DEPARTED', 'WAIVED'].includes(String(item.status))) ?? null;
      const nextCheckpoint = ordered.find((item) => !['ARRIVED', 'DEPARTED', 'WAIVED'].includes(String(item.status))) ?? null;
      const staleMinutes = Number(nextCheckpoint?.stale_location_minutes ?? 60);
      const freshness = locationAgeMinutes == null ? 'NO_DATA'
        : locationAgeMinutes > Math.max(60, staleMinutes) ? 'RED'
          : locationAgeMinutes > Math.min(30, staleMinutes) ? 'YELLOW' : 'FRESH';
      return response(c, {
        job: { ...job, location_age_minutes: locationAgeMinutes, location_freshness: freshness },
        current_checkpoint: lastCheckpoint,
        next_checkpoint: nextCheckpoint,
        manual_fallback_allowed: freshness !== 'FRESH',
        manual_fallback_requires_evidence: true,
        pending_geofence_confirmation_count: geofenceCandidates.results.filter((item: any) => item.status === 'PENDING_CONFIRMATION').length,
        geofence_candidates: geofenceCandidates.results,
        items: rows.results,
        total: rows.results.length
      });
    } catch (error) {
      return handleError(c, error);
    }
  });
}
