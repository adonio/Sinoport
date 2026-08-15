import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { ApiApp } from '../index';
import { enqueueSkyledgerEvent } from '../lib/integration-sync';
import {
  appendOperationEvent,
  createGateDecision,
  ensureOperationalException,
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

type BorderContext = {
  border_operation_id: string;
  transport_job_id: string;
  shipment_id: string;
  station_id: string;
  flight_id: string | null;
  status: string;
  operation_mode: string | null;
  operation_mode_verification_status: string;
  mode_evidence_ref: string | null;
  active_vehicle_mapping_id: string | null;
  seal_before: string | null;
  seal_after: string | null;
  seal_continuity_status: string | null;
  pieces_before: number | null;
  pieces_after: number | null;
  weight_before_kg: number | null;
  weight_after_kg: number | null;
  reconciliation_status: string;
  cn_release_at: string | null;
  cn_exit_at: string | null;
  kz_release_at: string | null;
  port_service_calendar_id: string | null;
};

function handleError(c: any, error: unknown) {
  if (error instanceof V14OperationError) return jsonError(c, error.status, error.code, error.message, error.details);
  console.error('[v14-border]', error);
  return jsonError(c, 500, 'BORDER_OPERATION_FAILED', error instanceof Error ? error.message : 'Operation failed');
}

function response(c: any, data: Record<string, unknown>, status: 200 | 201 = 200) {
  return c.json({ request_id: requestId(c.req.raw.headers), ...data }, status);
}

async function loadBorder(db: any, id: string): Promise<BorderContext> {
  return loadRequired<BorderContext>(
    db,
    `SELECT b.*, j.shipment_id, j.station_id, j.flight_id
     FROM border_operations b JOIN transport_jobs j ON j.transport_job_id = b.transport_job_id
     WHERE b.border_operation_id = ?`,
    [id], 'BORDER_OPERATION_NOT_FOUND', 'Border operation was not found'
  );
}

async function recordBorderEvent(
  db: any,
  actor: any,
  border: BorderContext,
  idem: string,
  eventType: string,
  body: Record<string, unknown>,
  occurredAt?: string | null
) {
  return appendOperationEvent(db, actor, {
    aggregateType: 'BorderOperation', aggregateId: border.border_operation_id,
    eventType, idempotencyKey: idem, occurredAt,
    stationId: border.station_id, shipmentId: border.shipment_id, flightId: border.flight_id,
    payload: body
  });
}

function assertBorderSideRole(actor: any, side: 'CN' | 'KZ') {
  const roles = new Set<string>(actor.roleIds ?? []);
  if (roles.has('platform_admin') || roles.has('station_supervisor')) return;
  const required = side === 'CN' ? 'ALASHANKOU_AGENT' : 'DOSTYK_AGENT';
  if (!roles.has(required)) {
    throw new V14OperationError(403, 'BORDER_SIDE_ROLE_REQUIRED', `${side} side facts must be submitted by ${required}`, { required_role: required, side });
  }
}

export function registerV14BorderRoutes(app: ApiApp, requireRoles: RequireRoles) {
  const viewRoles: RoleCode[] = [
    'platform_admin', 'station_supervisor', 'TRUCK_OPERATOR', 'ALASHANKOU_AGENT', 'DOSTYK_AGENT',
    'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER', 'B1_TAS_STATION_CONTROLLER', 'OCC_DM'
  ];
  const writeRoles: RoleCode[] = ['platform_admin', 'station_supervisor', 'ALASHANKOU_AGENT', 'DOSTYK_AGENT', 'A3_CROSS_BORDER_CONTROLLER'];

  app.get('/api/v1/border-operations', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const status = String(c.req.query('status') ?? '').trim();
      const rows = await db
        .prepare(
          `SELECT b.*, j.shipment_id, j.flight_id,
                  c.status AS calendar_status, c.next_verify_at AS calendar_next_verify_at
           FROM border_operations b
           JOIN transport_jobs j ON j.transport_job_id = b.transport_job_id
           LEFT JOIN port_service_calendars c ON c.calendar_id = b.port_service_calendar_id
           WHERE (? = '' OR b.status = ?) ORDER BY b.updated_at DESC LIMIT 100`
        )
        .bind(status, status).all();
      return response(c, { items: rows.results, total: rows.results.length });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations', requireRoles(['platform_admin', 'station_supervisor', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { border_operation_id: duplicate.aggregate_id, duplicate: true });
      const jobId = requiredText(body, 'transport_job_id');
      const job = await loadRequired<{
        shipment_id: string; station_id: string; flight_id: string | null; route_template_id: string; status: string;
        route_template_code: string;
      }>(
        db,
        `SELECT j.shipment_id, j.station_id, j.flight_id, j.route_template_id, j.status, r.route_template_code
         FROM transport_jobs j JOIN route_templates r ON r.route_template_id = j.route_template_id
         WHERE j.transport_job_id = ?`,
        [jobId], 'TRANSPORT_JOB_NOT_FOUND', 'Transport job was not found'
      );
      if (job.route_template_code !== 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2') {
        throw new V14OperationError(409, 'ALTERNATE_ROUTE_TEMPLATE_REQUIRED', 'Border operations require the approved Alashankou-Dostyk V2 template');
      }
      const existing = await db.prepare(`SELECT border_operation_id FROM border_operations WHERE transport_job_id = ? AND status <> 'CANCELLED'`).bind(jobId).first<{ border_operation_id: string }>();
      if (existing) throw new V14OperationError(409, 'BORDER_OPERATION_ALREADY_EXISTS', 'An active border operation already exists', existing);
      const calendar = await db
        .prepare(`SELECT calendar_id, status FROM port_service_calendars WHERE port_pair_code = 'ALASHANKOU_DOSTYK' ORDER BY version_no DESC LIMIT 1`)
        .first<{ calendar_id: string; status: string }>();
      const borderId = `BDR-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO border_operations (
             border_operation_id, tenant_id, transport_job_id, operation_control_plan_id,
             port_pair_code, cn_port_code, kz_port_code, status, health_color,
             planned_cn_arrival_at, planned_cn_exit_at, planned_kz_transfer_complete_at,
             port_service_calendar_id, created_at, updated_at
           ) VALUES (?, ?, ?, ?, 'ALASHANKOU_DOSTYK', 'ALASHANKOU', 'DOSTYK',
             'PLANNED', ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          borderId, actor.tenantId, jobId, optionalText(body, 'operation_control_plan_id'),
          calendar?.status === 'CONFIRMED' ? 'BLUE' : 'UNKNOWN', optionalText(body, 'planned_cn_arrival_at'),
          optionalText(body, 'planned_cn_exit_at'), optionalText(body, 'planned_kz_transfer_complete_at'),
          calendar?.calendar_id ?? null, now, now
        )
        .run();
      if (calendar?.status !== 'CONFIRMED') {
        const taskId = `CTL-${crypto.randomUUID()}`;
        const nowIso = new Date().toISOString();
        await db.prepare(
          `INSERT OR IGNORE INTO control_tasks (
             control_task_id, tenant_id, operation_control_plan_id, task_type,
             related_object_type, related_object_id, owner_role, severity, status,
             due_at, source_fact_at, reason_code, details_json, created_at, updated_at
           ) VALUES (?, ?, ?, 'PORT_CALENDAR_VERIFY', 'BorderOperation', ?,
             'A3_CROSS_BORDER_CONTROLLER', 'CRITICAL', 'OPEN', ?, ?,
             'PORT_SERVICE_CALENDAR_UNKNOWN', ?, ?, ?)`
        ).bind(taskId, actor.tenantId, optionalText(body, 'operation_control_plan_id'), borderId,
          nowIso, nowIso, JSON.stringify({ port_pair_code: 'ALASHANKOU_DOSTYK', calendar_status: calendar?.status ?? 'UNKNOWN' }), nowIso, nowIso).run();
      }
      await recordBorderEvent(db, actor, {
        border_operation_id: borderId, transport_job_id: jobId, shipment_id: job.shipment_id,
        station_id: job.station_id, flight_id: job.flight_id, status: 'PLANNED', operation_mode: null,
        operation_mode_verification_status: 'UNCONFIRMED', mode_evidence_ref: null,
        active_vehicle_mapping_id: null, seal_before: null, seal_after: null, seal_continuity_status: null,
        pieces_before: null, pieces_after: null, weight_before_kg: null, weight_after_kg: null,
        reconciliation_status: 'PENDING', cn_release_at: null, cn_exit_at: null, kz_release_at: null,
        port_service_calendar_id: calendar?.calendar_id ?? null
      }, idem, 'BORDER_OPERATION_CREATED', body);
      return response(c, { border_operation_id: borderId, status: 'PLANNED', calendar_status: calendar?.status ?? 'UNKNOWN', duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/border-operations/:id', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const border = await loadBorder(db, c.req.param('id'));
      const [mapping, gates, events, snapshots, calendar] = await Promise.all([
        db.prepare(`SELECT * FROM cross_border_vehicle_mappings WHERE border_operation_id = ? ORDER BY mapping_version DESC`).bind(c.req.param('id')).all(),
        db.prepare(`SELECT * FROM gate_decisions WHERE related_object_type = 'BorderOperation' AND related_object_id = ? ORDER BY decided_at`).bind(c.req.param('id')).all(),
        db.prepare(`SELECT * FROM operation_events WHERE aggregate_type = 'BorderOperation' AND aggregate_id = ? ORDER BY aggregate_sequence`).bind(c.req.param('id')).all(),
        db.prepare(`SELECT * FROM vehicle_driver_snapshots WHERE transport_job_id = ? ORDER BY snapshot_scope, snapshot_version DESC`).bind(border.transport_job_id).all(),
        border.port_service_calendar_id ? db.prepare(`SELECT * FROM port_service_calendars WHERE calendar_id = ?`).bind(border.port_service_calendar_id).first() : Promise.resolve(null)
      ]);
      const externalStatusAt = (border as any).last_external_status_at as string | null;
      const externalAgeMinutes = externalStatusAt ? Math.max(0, Math.floor((Date.now() - new Date(externalStatusAt).getTime()) / 60000)) : null;
      const entryGateBlockers = [
        border.operation_mode_verification_status === 'CONFIRMED_WITH_EVIDENCE' ? null : 'OPERATION_MODE_UNCONFIRMED',
        border.active_vehicle_mapping_id ? null : 'VEHICLE_MAPPING_MISSING',
        border.reconciliation_status === 'MATCHED' ? null : 'RECONCILIATION_NOT_MATCHED',
        calendar && (calendar as any).status === 'CONFIRMED' && (calendar as any).next_verify_at >= new Date().toISOString() ? null : 'PORT_CALENDAR_STALE'
      ].filter(Boolean);
      return response(c, {
        border_operation: border,
        vehicle_mappings: mapping.results,
        gate_decisions: gates.results,
        operation_events: events.results,
        vehicle_snapshots: snapshots.results,
        service_calendar: calendar,
        entry_gate: { status: entryGateBlockers.length ? 'BLOCKED' : 'READY', blockers: entryGateBlockers, owner_role: 'A3_CROSS_BORDER_CONTROLLER' },
        external_status_freshness: { last_external_status_at: externalStatusAt, age_minutes: externalAgeMinutes, state: externalAgeMinutes == null ? 'NO_DATA' : externalAgeMinutes > 60 ? 'RED' : externalAgeMinutes > 30 ? 'YELLOW' : 'FRESH', manual_fallback_allowed: externalAgeMinutes == null || externalAgeMinutes > 30 }
      });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/pre-alert', requireRoles(writeRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      const evidence = stringArray(body, 'evidence_ids');
      if (evidence.length === 0) throw new V14OperationError(409, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Pre-alert acknowledgement evidence is required');
      await db.prepare(`UPDATE border_operations SET status = 'PRE_ALERTED', forecast_cn_arrival_at = COALESCE(?, forecast_cn_arrival_at), last_external_status_at = ?, updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(optionalText(body, 'forecast_cn_arrival_at'), new Date().toISOString(), new Date().toISOString(), border.border_operation_id).run();
      await recordBorderEvent(db, actor, border, idem, 'BORDER_PRE_ALERT_CONFIRMED', body);
      return response(c, { result: 'PRE_ALERTED' });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/cn-queue', requireRoles(writeRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      assertBorderSideRole(actor, 'CN');
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      await db.prepare(`UPDATE border_operations SET status = 'QUEUED_CN', cn_queue_no = ?, cn_queue_ahead_count = ?, cn_open_window_count = ?, cn_next_update_at = ?, last_external_status_at = ?, updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(requiredText(body, 'cn_queue_no'), Math.max(0, integerValue(body, 'cn_queue_ahead_count')),
          Math.max(0, integerValue(body, 'cn_open_window_count')), requiredText(body, 'cn_next_update_at'),
          new Date().toISOString(), new Date().toISOString(), border.border_operation_id).run();
      await recordBorderEvent(db, actor, border, idem, 'CN_QUEUE_UPDATED', body);
      return response(c, { result: 'QUEUED_CN' });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/cn-gate-in', requireRoles(writeRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      assertBorderSideRole(actor, 'CN');
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      if (stringArray(body, 'evidence_ids').length === 0) throw new V14OperationError(409, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Gate-in evidence is required');
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(`UPDATE border_operations SET status = 'GATE_IN_CN', actual_cn_arrival_at = COALESCE(actual_cn_arrival_at, ?), cn_gate_in_at = ?, updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(occurredAt, occurredAt, new Date().toISOString(), border.border_operation_id).run();
      await recordBorderEvent(db, actor, border, idem, 'ALASHANKOU_GATE_IN_CONFIRMED', body, occurredAt);
      return response(c, { result: 'GATE_IN_CN', occurred_at: occurredAt });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/operation-mode', requireRoles(['platform_admin', 'station_supervisor', 'A3_CROSS_BORDER_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      const mode = requiredText(body, 'operation_mode');
      if (!['SAME_VEHICLE', 'TRACTOR_SWAP', 'TRAILER_HANDOVER', 'FULL_VEHICLE_SWAP', 'CARGO_TRANSLOAD', 'MIXED'].includes(mode)) {
        throw new V14OperationError(400, 'VALIDATION_ERROR', 'Unsupported cross-border operation_mode');
      }
      const verification = requiredText(body, 'verification_status');
      const evidence = stringArray(body, 'evidence_ids');
      if (verification === 'CONFIRMED_WITH_EVIDENCE' && evidence.length === 0) {
        throw new V14OperationError(409, 'BORDER_OPERATION_MODE_UNCONFIRMED', 'Confirmed operation mode requires written evidence');
      }
      await db.prepare(`UPDATE border_operations SET operation_mode = ?, operation_mode_verification_status = ?, mode_evidence_ref = ?, cn_vehicle_snapshot_id = COALESCE(?, cn_vehicle_snapshot_id), kz_vehicle_snapshot_id = COALESCE(?, kz_vehicle_snapshot_id), pieces_before = COALESCE(?, pieces_before), weight_before_kg = COALESCE(?, weight_before_kg), seal_before = COALESCE(?, seal_before), updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(mode, verification, evidence[0] ?? null, optionalText(body, 'cn_vehicle_snapshot_id'), optionalText(body, 'kz_vehicle_snapshot_id'),
          integerValue(body, 'planned_pieces') || null, numberValue(body, 'planned_weight_kg') || null,
          optionalText(body, 'seal_before'), new Date().toISOString(), border.border_operation_id).run();
      await recordBorderEvent(db, actor, border, idem, 'BORDER_OPERATION_MODE_CONFIRMED', body, optionalText(body, 'effective_at'));
      return response(c, { result: verification, operation_mode: mode });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/vehicle-mappings', requireRoles(['platform_admin', 'station_supervisor', 'A3_CROSS_BORDER_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      const submittedBy = requiredText(body, 'submitted_by');
      if (submittedBy === actor.userId) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Mapping submitter and approver must be different');
      const cnSnapshotId = requiredText(body, 'cn_vehicle_snapshot_id');
      const kzSnapshotId = requiredText(body, 'kz_vehicle_snapshot_id');
      const snapshotCount = await db.prepare(`SELECT COUNT(*) AS count FROM vehicle_driver_snapshots WHERE transport_job_id = ? AND vehicle_driver_snapshot_id IN (?, ?)`)
        .bind(border.transport_job_id, cnSnapshotId, kzSnapshotId).first<{ count: number }>();
      const expectedCount = cnSnapshotId === kzSnapshotId ? 1 : 2;
      if (Number(snapshotCount?.count ?? 0) !== expectedCount) throw new V14OperationError(409, 'CROSS_BORDER_VEHICLE_MAPPING_CONFLICT', 'Vehicle snapshots are missing or belong to another job');
      const version = await db.prepare(`SELECT COALESCE(MAX(mapping_version), 0) + 1 AS next_version FROM cross_border_vehicle_mappings WHERE border_operation_id = ?`)
        .bind(border.border_operation_id).first<{ next_version: number }>();
      await db.prepare(`UPDATE cross_border_vehicle_mappings SET active_flag = 0 WHERE border_operation_id = ? AND active_flag = 1`).bind(border.border_operation_id).run();
      const mappingId = `MAP-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO cross_border_vehicle_mappings (
           mapping_id, tenant_id, border_operation_id, mapping_version, cn_vehicle_snapshot_id,
           kz_vehicle_snapshot_id, mapping_type, effective_at, handover_party_from, handover_party_to,
           pieces_match_result, weight_match_result, seal_match_result, change_reason,
           evidence_refs_json, submitted_by, approved_by, active_flag
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      ).bind(
        mappingId, actor.tenantId, border.border_operation_id, Number(version?.next_version ?? 1), cnSnapshotId, kzSnapshotId,
        requiredText(body, 'mapping_type'), optionalText(body, 'effective_at') ?? new Date().toISOString(),
        requiredText(body, 'handover_party_from'), requiredText(body, 'handover_party_to'),
        optionalText(body, 'pieces_match_result') ?? 'PENDING', optionalText(body, 'weight_match_result') ?? 'PENDING',
        optionalText(body, 'seal_match_result') ?? 'PENDING', optionalText(body, 'change_reason'),
        JSON.stringify(stringArray(body, 'evidence_ids')), submittedBy, actor.userId
      ).run();
      await db.prepare(`UPDATE border_operations SET active_vehicle_mapping_id = ?, cn_vehicle_snapshot_id = ?, kz_vehicle_snapshot_id = ?, updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(mappingId, cnSnapshotId, kzSnapshotId, new Date().toISOString(), border.border_operation_id).run();
      await recordBorderEvent(db, actor, border, idem, 'CROSS_BORDER_VEHICLE_MAPPING_APPROVED', { ...body, mapping_id: mappingId });
      return response(c, { result: 'MAPPED', mapping_id: mappingId, mapping_version: Number(version?.next_version ?? 1) }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/transload-events', requireRoles(writeRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      const piecesBefore = integerValue(body, 'pieces_before'); const piecesAfter = integerValue(body, 'pieces_after');
      const weightBefore = numberValue(body, 'weight_before_kg'); const weightAfter = numberValue(body, 'weight_after_kg');
      const sealBefore = requiredText(body, 'seal_before'); const sealAfter = requiredText(body, 'seal_after');
      const pieceMatch = piecesBefore === piecesAfter;
      const weightMatch = Math.abs(weightBefore - weightAfter) <= numberValue(body, 'weight_tolerance_kg', 1);
      const sealMatch = sealBefore === sealAfter || body.seal_change_approved === true;
      const reconciliation = pieceMatch && weightMatch && sealMatch ? 'MATCHED' : 'MISMATCH';
      await db.prepare(`UPDATE border_operations SET pieces_before = ?, pieces_after = ?, weight_before_kg = ?, weight_after_kg = ?, seal_before = ?, seal_after = ?, seal_continuity_status = ?, reconciliation_status = ?, status = CASE WHEN ? = 'MISMATCH' THEN 'BLOCKED' ELSE status END, health_color = CASE WHEN ? = 'MISMATCH' THEN 'RED' ELSE health_color END, updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(piecesBefore, piecesAfter, weightBefore, weightAfter, sealBefore, sealAfter, sealMatch ? 'CONTINUOUS' : 'DISCONTINUITY', reconciliation, reconciliation, reconciliation, new Date().toISOString(), border.border_operation_id).run();
      const exceptionId = reconciliation === 'MATCHED' ? null : await ensureOperationalException(db, {
        stationId: border.station_id, exceptionType: sealMatch ? 'BORDER_RECONCILIATION_MISMATCH' : 'CROSS_BORDER_SEAL_DISCONTINUITY',
        relatedObjectType: 'BorderOperation', relatedObjectId: border.border_operation_id,
        severity: 'Critical', ownerRole: 'A3_CROSS_BORDER_CONTROLLER', blocker: true,
        rootCause: JSON.stringify({ piece_match: pieceMatch, weight_match: weightMatch, seal_match: sealMatch }),
        actionTaken: 'Border operation blocked and escalated for reconciliation'
      });
      await recordBorderEvent(db, actor, border, idem, 'BORDER_TRANSLOAD_RECONCILED', { ...body, reconciliation_status: reconciliation, exception_id: exceptionId });
      return response(c, { result: reconciliation, pieces_match: pieceMatch, weight_match: weightMatch, seal_continuity: sealMatch, exception_id: exceptionId });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/cn-release', requireRoles(writeRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      assertBorderSideRole(actor, 'CN');
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      const evidence = stringArray(body, 'evidence_ids');
      if (evidence.length === 0 || !optionalText(body, 'cmr_document_id')) throw new V14OperationError(409, 'CN_EXIT_GATE_BLOCKED', 'China release requires release evidence and CMR');
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(`UPDATE border_operations SET status = 'CN_RELEASED', cn_release_at = ?, cmr_document_id = ?, release_evidence_refs_json = ?, updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(occurredAt, optionalText(body, 'cmr_document_id'), JSON.stringify(evidence), new Date().toISOString(), border.border_operation_id).run();
      await recordBorderEvent(db, actor, border, idem, 'CHINA_RELEASE_CONFIRMED', body, occurredAt);
      return response(c, { result: 'CN_RELEASED', occurred_at: occurredAt });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/china-exit', requireRoles(['platform_admin', 'station_supervisor', 'A3_CROSS_BORDER_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      const calendar = border.port_service_calendar_id
        ? await db.prepare(`SELECT status, next_verify_at FROM port_service_calendars WHERE calendar_id = ?`).bind(border.port_service_calendar_id).first<{ status: string; next_verify_at: string }>()
        : null;
      if (!calendar || calendar.status !== 'CONFIRMED' || calendar.next_verify_at < new Date().toISOString()) {
        throw new V14OperationError(409, 'PORT_SERVICE_CALENDAR_STALE', 'A current confirmed port calendar is required');
      }
      if (!border.cn_release_at || border.operation_mode_verification_status !== 'CONFIRMED_WITH_EVIDENCE' || !border.active_vehicle_mapping_id) {
        throw new V14OperationError(409, 'CN_EXIT_GATE_BLOCKED', 'Release, confirmed mode and active vehicle mapping are required');
      }
      if (border.reconciliation_status !== 'MATCHED' || border.seal_continuity_status !== 'CONTINUOUS') {
        throw new V14OperationError(409, border.seal_continuity_status !== 'CONTINUOUS' ? 'CROSS_BORDER_SEAL_DISCONTINUITY' : 'BORDER_RECONCILIATION_MISMATCH', 'Border reconciliation must be fully matched');
      }
      const evidence = stringArray(body, 'evidence_ids');
      if (evidence.length === 0) throw new V14OperationError(409, 'CN_EXIT_GATE_BLOCKED', 'China exit closure evidence is required');
      const gateId = await createGateDecision(db, actor, {
        gateCode: 'CHINA_EXIT_GATE', objectType: 'BorderOperation', objectId: border.border_operation_id,
        decision: 'PASS', actionComplete: true, dataConsistent: true, evidenceComplete: true,
        nextOwnerAccepted: body.next_owner_accepted === true, requestedBy: requiredText(body, 'requested_by'),
        cargoUnitIds: stringArray(body, 'cargo_unit_ids')
      });
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(`UPDATE border_operations SET status = 'EXITED_CN', cn_exit_at = ?, china_exit_gate_decision_id = ?, updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(occurredAt, gateId, new Date().toISOString(), border.border_operation_id).run();
      await recordBorderEvent(db, actor, border, idem, 'CHINA_EXIT_CONFIRMED', { ...body, gate_decision_id: gateId }, occurredAt);
      await enqueueSkyledgerEvent(c.env, { eventType: 'border.china_exit_confirmed.v1', aggregateType: 'BorderOperation', aggregateId: border.border_operation_id,
        payload: { border_operation_id: border.border_operation_id, transport_job_id: border.transport_job_id, shipment_id: border.shipment_id, occurred_at: occurredAt, gate_decision_id: gateId } });
      return response(c, { result: 'EXITED_CN', gate_decision_id: gateId, occurred_at: occurredAt });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/dostyk-arrival', requireRoles(writeRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      assertBorderSideRole(actor, 'KZ');
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      if (!border.cn_exit_at) throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'China exit must be confirmed before Dostyk arrival');
      if (stringArray(body, 'evidence_ids').length === 0) throw new V14OperationError(409, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Dostyk arrival evidence is required');
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(`UPDATE border_operations SET status = 'ARRIVED_DOSTYK', dostyk_arrival_at = ?, updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(occurredAt, new Date().toISOString(), border.border_operation_id).run();
      await recordBorderEvent(db, actor, border, idem, 'DOSTYK_ARRIVAL_CONFIRMED', body, occurredAt);
      return response(c, { result: 'ARRIVED_DOSTYK', occurred_at: occurredAt });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/kz-release', requireRoles(writeRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      assertBorderSideRole(actor, 'KZ');
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      if (!['ARRIVED_DOSTYK', 'KZ_ENTRY_IN_PROGRESS'].includes(border.status)) throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Dostyk arrival must be recorded first');
      if (stringArray(body, 'evidence_ids').length === 0) throw new V14OperationError(409, 'DOSTYK_DEPARTURE_GATE_BLOCKED', 'Kazakhstan release evidence is required');
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(`UPDATE border_operations SET status = 'KZ_RELEASED', kz_release_at = ?, kz_inspection_status = ?, updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(occurredAt, optionalText(body, 'kz_inspection_status') ?? 'RELEASED', new Date().toISOString(), border.border_operation_id).run();
      await recordBorderEvent(db, actor, border, idem, 'KAZAKHSTAN_RELEASE_CONFIRMED', body, occurredAt);
      return response(c, { result: 'KZ_RELEASED', occurred_at: occurredAt });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/border-operations/:id/dostyk-departure', requireRoles(['platform_admin', 'station_supervisor', 'A3_CROSS_BORDER_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const border = await loadBorder(db, c.req.param('id'));
      if (!border.kz_release_at || !border.active_vehicle_mapping_id || border.reconciliation_status !== 'MATCHED') {
        throw new V14OperationError(409, 'DOSTYK_DEPARTURE_GATE_BLOCKED', 'KZ release, vehicle handover and matched reconciliation are required');
      }
      if (stringArray(body, 'evidence_ids').length === 0 || body.next_owner_accepted !== true) {
        throw new V14OperationError(409, 'DOSTYK_DEPARTURE_GATE_BLOCKED', 'Departure evidence and next owner acceptance are required');
      }
      const gateId = await createGateDecision(db, actor, {
        gateCode: 'DOSTYK_DEPARTURE_GATE', objectType: 'BorderOperation', objectId: border.border_operation_id,
        decision: 'PASS', actionComplete: true, dataConsistent: true, evidenceComplete: true, nextOwnerAccepted: true,
        requestedBy: requiredText(body, 'requested_by'), cargoUnitIds: stringArray(body, 'cargo_unit_ids')
      });
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(`UPDATE border_operations SET status = 'DEPARTED_DOSTYK', dostyk_departure_at = ?, dostyk_departure_gate_decision_id = ?, completed_at = ?, updated_at = ?, row_version = row_version + 1 WHERE border_operation_id = ?`)
        .bind(occurredAt, gateId, occurredAt, new Date().toISOString(), border.border_operation_id).run();
      await recordBorderEvent(db, actor, border, idem, 'DOSTYK_DEPARTURE_CONFIRMED', { ...body, gate_decision_id: gateId }, occurredAt);
      await enqueueSkyledgerEvent(c.env, { eventType: 'border.dostyk_departure_confirmed.v1', aggregateType: 'BorderOperation', aggregateId: border.border_operation_id,
        payload: { border_operation_id: border.border_operation_id, transport_job_id: border.transport_job_id, shipment_id: border.shipment_id, occurred_at: occurredAt, gate_decision_id: gateId } });
      return response(c, { result: 'DEPARTED_DOSTYK', gate_decision_id: gateId, occurred_at: occurredAt });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/border-operations/:id/reconciliation', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const border = await loadBorder(db, c.req.param('id'));
      return response(c, {
        reconciliation: {
          status: border.reconciliation_status,
          pieces_before: border.pieces_before, pieces_after: border.pieces_after,
          pieces_match: border.pieces_before !== null && border.pieces_before === border.pieces_after,
          weight_before_kg: border.weight_before_kg, weight_after_kg: border.weight_after_kg,
          weight_delta_kg: Number(border.weight_after_kg ?? 0) - Number(border.weight_before_kg ?? 0),
          seal_before: border.seal_before, seal_after: border.seal_after,
          seal_continuity_status: border.seal_continuity_status,
          active_vehicle_mapping_id: border.active_vehicle_mapping_id
        }
      });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/port-service-calendars', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const rows = await db.prepare(`SELECT * FROM port_service_calendars ORDER BY port_pair_code, version_no DESC`).all();
      return response(c, { items: rows.results, total: rows.results.length });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/port-service-calendars', requireRoles(['platform_admin', 'OCC_DM', 'A3_CROSS_BORDER_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const portPair = optionalText(body, 'port_pair_code') ?? 'ALASHANKOU_DOSTYK';
      if (!optionalText(body, 'timezone_cn') || !optionalText(body, 'timezone_kz')) throw new V14OperationError(409, 'PORT_TIMEZONE_MISSING', 'Both IANA port timezones are required');
      const version = await db.prepare(`SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version FROM port_service_calendars WHERE port_pair_code = ?`).bind(portPair).first<{ next_version: number }>();
      const calendarId = `CAL-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO port_service_calendars (
           calendar_id, port_pair_code, version_no, valid_from, valid_to, timezone_cn, timezone_kz,
           open_days_json, daily_windows_json, closure_periods_json, appointment_required,
           restrictions_json, capacity_note, source_type, source_ref, next_verify_at, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNKNOWN')`
      ).bind(
        calendarId, portPair, Number(version?.next_version ?? 1), requiredText(body, 'valid_from'), requiredText(body, 'valid_to'),
        requiredText(body, 'timezone_cn'), requiredText(body, 'timezone_kz'), JSON.stringify(body.open_days ?? []),
        JSON.stringify(body.daily_windows ?? []), JSON.stringify(body.closure_periods ?? []), Number(body.appointment_required !== false),
        JSON.stringify(body.restrictions ?? {}), optionalText(body, 'capacity_note'), requiredText(body, 'source_type'),
        requiredText(body, 'source_ref'), requiredText(body, 'next_verify_at')
      ).run();
      await appendOperationEvent(db, actor, { aggregateType: 'PortServiceCalendar', aggregateId: calendarId, eventType: 'PORT_CALENDAR_CREATED', idempotencyKey: idem, payload: body });
      return response(c, { result: 'CREATED', calendar_id: calendarId, version_no: Number(version?.next_version ?? 1), status: 'UNKNOWN' }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/port-service-calendars/:id/publish', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const calendar = await loadRequired<{ confirmed_by: string | null; next_verify_at: string }>(db, `SELECT confirmed_by, next_verify_at FROM port_service_calendars WHERE calendar_id = ?`, [c.req.param('id')], 'PORT_CALENDAR_NOT_FOUND', 'Port calendar was not found');
      const confirmedBy = optionalText(body, 'confirmed_by') ?? calendar.confirmed_by;
      if (!confirmedBy || confirmedBy === actor.userId) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Calendar confirmer and publisher must be different');
      if (calendar.next_verify_at <= new Date().toISOString()) throw new V14OperationError(409, 'PORT_SERVICE_CALENDAR_STALE', 'Calendar next verification time must be in the future');
      const now = new Date().toISOString();
      await db.prepare(`UPDATE port_service_calendars SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = COALESCE(confirmed_at, ?), approved_by = ?, published_at = ? WHERE calendar_id = ?`)
        .bind(confirmedBy, now, actor.userId, now, c.req.param('id')).run();
      await appendOperationEvent(db, actor, { aggregateType: 'PortServiceCalendar', aggregateId: c.req.param('id'), eventType: 'PORT_CALENDAR_PUBLISHED', idempotencyKey: idem, payload: { confirmed_by: confirmedBy, approved_by: actor.userId } });
      return response(c, { result: 'CONFIRMED', calendar_id: c.req.param('id') });
    } catch (error) { return handleError(c, error); }
  });
}
