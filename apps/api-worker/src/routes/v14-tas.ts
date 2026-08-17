import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { ApiApp } from '../index';
import { enqueueSkyledgerEvent } from '../lib/integration-sync';
import {
  airportReceiptSummary,
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
import { assertTasAccess, projectTasMilestone } from '../lib/tas-station';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;
type V14Db = ReturnType<typeof requireV14Db>;

type AirportContext = {
  airport_receipt_session_id: string;
  transport_job_id: string;
  shipment_id: string;
  flight_id: string | null;
  status: string;
  warehouse_out_pieces: number;
  truck_loaded_pieces: number;
  airport_received_pieces: number;
  seal_expected: string | null;
  seal_actual: string | null;
  seal_condition: string | null;
  received_by: string | null;
};

type SealCheckAudit = {
  operation_event_id: string;
  aggregate_sequence: number;
  actor_id: string;
  occurred_at: string;
};

type SealMismatchApprovalAudit = SealCheckAudit & {
  actor_role: string;
  payload_json: string;
};

function handleError(c: any, error: unknown) {
  if (error instanceof V14OperationError) return jsonError(c, error.status, error.code, error.message, error.details);
  console.error('[v14-tas]', error);
  return jsonError(c, 500, 'TAS_OPERATION_FAILED', error instanceof Error ? error.message : 'Operation failed');
}

function response(c: any, data: Record<string, unknown>, status: 200 | 201 = 200) {
  return c.json({ request_id: requestId(c.req.raw.headers), ...data }, status);
}

async function loadAirport(db: any, tenantId: string, id: string) {
  return loadRequired<AirportContext>(
    db,
    `SELECT airport_receipt_session_id, transport_job_id, shipment_id, flight_id, status,
            warehouse_out_pieces, truck_loaded_pieces, airport_received_pieces,
            seal_expected, seal_actual, seal_condition, received_by
     FROM airport_receipt_sessions WHERE tenant_id = ? AND airport_receipt_session_id = ?`,
    [tenantId, id], 'AIRPORT_RECEIPT_NOT_FOUND', 'TAS airport receipt session was not found'
  );
}

async function recordEvent(db: any, actor: any, receipt: AirportContext, idem: string, eventType: string, body: Record<string, unknown>, occurredAt?: string | null) {
  return appendOperationEvent(db, actor, {
    aggregateType: 'AirportReceiptSession', aggregateId: receipt.airport_receipt_session_id,
    eventType, idempotencyKey: idem, occurredAt, shipmentId: receipt.shipment_id,
    flightId: receipt.flight_id, stationId: 'TAS', payload: body
  });
}

async function loadLatestSealCheck(db: V14Db, tenantId: string, receiptId: string) {
  return db.prepare(
    `SELECT operation_event_id, aggregate_sequence, actor_id, occurred_at
     FROM operation_events
     WHERE tenant_id = ? AND aggregate_type = 'AirportReceiptSession'
       AND aggregate_id = ? AND event_type = 'TAS_SEAL_CHECKED'
     ORDER BY aggregate_sequence DESC LIMIT 1`
  ).bind(tenantId, receiptId).first<SealCheckAudit>();
}

async function loadSealMismatchApproval(
  db: V14Db,
  tenantId: string,
  receiptId: string,
  sealCheckSequence: number
) {
  return db.prepare(
    `SELECT operation_event_id, aggregate_sequence, actor_id, actor_role, occurred_at, payload_json
     FROM operation_events
     WHERE tenant_id = ? AND aggregate_type = 'AirportReceiptSession'
       AND aggregate_id = ? AND event_type = 'TAS_SEAL_MISMATCH_APPROVED'
       AND aggregate_sequence > ?
     ORDER BY aggregate_sequence DESC LIMIT 1`
  ).bind(tenantId, receiptId, sealCheckSequence).first<SealMismatchApprovalAudit>();
}

export function registerV14TasRoutes(app: ApiApp, requireRoles: RequireRoles) {
  const viewRoles: RoleCode[] = ['platform_admin', 'station_supervisor', 'mobile_operator', 'TAS_OPERATOR', 'B1_TAS_STATION_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER', 'OCC_DM'];
  const operatorRoles: RoleCode[] = ['platform_admin', 'station_supervisor', 'mobile_operator', 'TAS_OPERATOR', 'B1_TAS_STATION_CONTROLLER'];
  const sealMismatchApprovalRoles: RoleCode[] = ['platform_admin', 'station_supervisor', 'B1_TAS_STATION_CONTROLLER'];

  app.get('/api/v1/airports/TAS/receipts', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const status = String(c.req.query('status') ?? '').trim();
      const flightId = String(c.req.query('flight_id') ?? '').trim();
      const keyword = String(c.req.query('keyword') ?? '').trim();
      const page = Math.max(1, Math.trunc(Number(c.req.query('page') ?? 1)) || 1);
      const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(c.req.query('page_size') ?? 20)) || 20));
      const offset = (page - 1) * pageSize;
      const filters = `r.tenant_id = ?
         AND (? = '' OR r.status = ?)
         AND (? = '' OR r.flight_id = ?)
         AND (? = '' OR r.airport_receipt_session_id LIKE '%' || ? || '%'
           OR r.transport_job_id LIKE '%' || ? || '%' OR r.shipment_id LIKE '%' || ? || '%')`;
      const bindings = [actor.tenantId, status, status, flightId, flightId, keyword, keyword, keyword, keyword];
      const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM airport_receipt_sessions r WHERE ${filters}`)
        .bind(...bindings).first<{ total: number }>();
      const rows = await db.prepare(
        `SELECT r.*, j.last_location_at, j.seal_number AS truck_seal_number,
                f.flight_no, f.flight_date, f.etd_at, f.destination_code,
                s.order_id, s.total_weight
         FROM airport_receipt_sessions r JOIN transport_jobs j ON j.transport_job_id = r.transport_job_id
         LEFT JOIN flights f ON f.flight_id = r.flight_id
         LEFT JOIN shipments s ON s.shipment_id = r.shipment_id
         WHERE ${filters} ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`
      ).bind(...bindings, pageSize, offset).all();
      return response(c, { items: rows.results, page, page_size: pageSize, total: Number(totalRow?.total ?? 0) });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airports/TAS/receipts', requireRoles(['platform_admin', 'station_supervisor', 'TAS_OPERATOR', 'B1_TAS_STATION_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { airport_receipt_session_id: duplicate.aggregate_id, duplicate: true });
      const jobId = requiredText(body, 'transport_job_id');
      const job = await loadRequired<{
        shipment_id: string; flight_id: string | null; awb_ids_json: string; status: string;
        loaded_pieces: number; seal_number: string | null; tas_staging_arrived_at: string | null;
      }>(db,
        `SELECT shipment_id, flight_id, awb_ids_json, status, loaded_pieces, seal_number, tas_staging_arrived_at
         FROM transport_jobs WHERE transport_job_id = ?`, [jobId],
        'TRANSPORT_JOB_NOT_FOUND', 'Transport job was not found'
      );
      if (job.status !== 'ARRIVED_TAS_STAGING' || !job.tas_staging_arrived_at) {
        throw new V14OperationError(409, 'TAS_STAGING_NOT_RECEIVED', 'Truck must first be confirmed at TAS staging');
      }
      const existing = await db.prepare(`SELECT airport_receipt_session_id FROM airport_receipt_sessions WHERE transport_job_id = ? AND status NOT IN ('REJECTED_OR_QUARANTINED', 'COMPLETED')`).bind(jobId).first<{ airport_receipt_session_id: string }>();
      if (existing) throw new V14OperationError(409, 'AIRPORT_RECEIPT_ALREADY_EXISTS', 'An active TAS receipt already exists', existing);
      const warehouse = await db.prepare(`SELECT unique_received_pieces FROM warehouse_receipt_sessions WHERE tenant_id = ? AND shipment_id = ? AND status = 'APPROVED' ORDER BY approved_at DESC LIMIT 1`)
        .bind(actor.tenantId, job.shipment_id).first<{ unique_received_pieces: number }>();
      const receiptId = `TASR-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO airport_receipt_sessions (
           airport_receipt_session_id, tenant_id, transport_job_id, shipment_id, airport_code,
           flight_id, awb_ids_json, status, truck_arrived_at, warehouse_out_pieces,
           truck_loaded_pieces, seal_expected, handover_from, received_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'TAS', ?, ?, 'ARRIVED_STAGING', ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        receiptId, actor.tenantId, jobId, job.shipment_id, job.flight_id, job.awb_ids_json,
        job.tas_staging_arrived_at, Number(warehouse?.unique_received_pieces ?? 0), job.loaded_pieces,
        job.seal_number, optionalText(body, 'handover_from') ?? 'TRUCK_CARRIER', actor.userId, now, now
      ).run();
      const context: AirportContext = {
        airport_receipt_session_id: receiptId, transport_job_id: jobId, shipment_id: job.shipment_id,
        flight_id: job.flight_id, status: 'ARRIVED_STAGING', warehouse_out_pieces: Number(warehouse?.unique_received_pieces ?? 0),
        truck_loaded_pieces: job.loaded_pieces, airport_received_pieces: 0, seal_expected: job.seal_number,
        seal_actual: null, seal_condition: null, received_by: actor.userId
      };
      await recordEvent(db, actor, context, idem, 'TAS_RECEIPT_CREATED', body);
      return response(c, { airport_receipt_session_id: receiptId, status: 'ARRIVED_STAGING', duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/airport-receipts/:id', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const receipt = await loadRequired<Record<string, unknown>>(db,
        `SELECT r.*, j.last_location_at, j.seal_number AS truck_seal_number,
                f.flight_no, f.flight_date, f.etd_at, f.destination_code
         FROM airport_receipt_sessions r
         JOIN transport_jobs j ON j.transport_job_id = r.transport_job_id
         LEFT JOIN flights f ON f.flight_id = r.flight_id
         WHERE r.tenant_id = ? AND r.airport_receipt_session_id = ?`,
        [actor.tenantId, c.req.param('id')], 'AIRPORT_RECEIPT_NOT_FOUND', 'TAS receipt was not found');
      const [events, reconciliation, gates, cargoUnits, auditEvents] = await Promise.all([
        db.prepare(`SELECT * FROM count_events WHERE session_type = 'AIRPORT_TAS' AND session_id = ? ORDER BY recorded_at`).bind(c.req.param('id')).all(),
        db.prepare(`SELECT * FROM reconciliation_results WHERE airport_receipt_session_id = ? ORDER BY calculated_at DESC LIMIT 1`).bind(c.req.param('id')).first(),
        db.prepare(`SELECT * FROM gate_decisions WHERE tenant_id = ? AND related_object_type = 'AirportReceiptSession' AND related_object_id = ? ORDER BY decided_at`).bind(actor.tenantId, c.req.param('id')).all(),
        db.prepare(
          `SELECT u.cargo_unit_id, u.business_barcode AS barcode, u.aggregate_quantity,
                  u.actual_weight_kg, u.expected_weight_kg, u.condition_status, u.inventory_state,
                  u.current_location_type, u.current_location_id,
                  MAX(e.occurred_at) AS last_scan_at
           FROM cargo_units u
           LEFT JOIN count_events e ON e.cargo_unit_id = u.cargo_unit_id AND e.session_type = 'AIRPORT_TAS'
           WHERE u.tenant_id = ? AND u.shipment_id = ?
           GROUP BY u.cargo_unit_id ORDER BY u.unit_sequence, u.business_barcode`
        ).bind(actor.tenantId, String(receipt.shipment_id)).all(),
        db.prepare(
          `SELECT operation_event_id, aggregate_sequence, event_type, event_action, occurred_at,
                  actor_id, actor_role, client_source, reason_code, payload_json
           FROM operation_events WHERE tenant_id = ? AND aggregate_type = 'AirportReceiptSession'
             AND aggregate_id = ? ORDER BY aggregate_sequence DESC`
        ).bind(actor.tenantId, c.req.param('id')).all()
      ]);
      return response(c, {
        receipt,
        count_events: events.results,
        reconciliation,
        gate_decisions: gates.results,
        cargo_units: cargoUnits.results,
        audit_events: auditEvents.results
      });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airport-receipts/:id/arrival', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const receipt = await loadAirport(db, actor.tenantId, c.req.param('id'));
      if (receipt.status !== 'ARRIVED_STAGING') throw new V14OperationError(409, 'SESSION_NOT_EDITABLE', 'Receipt is not waiting for formal arrival');
      if (stringArray(body, 'evidence_ids').length === 0) throw new V14OperationError(409, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Arrival evidence is required');
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(`UPDATE airport_receipt_sessions SET status = 'TRUCK_ARRIVED', truck_arrived_at = ?, evidence_refs_json = ?, updated_at = ?, row_version = row_version + 1 WHERE airport_receipt_session_id = ?`)
        .bind(occurredAt, JSON.stringify(stringArray(body, 'evidence_ids')), new Date().toISOString(), receipt.airport_receipt_session_id).run();
      await db.prepare(`UPDATE transport_jobs SET status = 'TAS_RECEIVING_STARTED', tas_receiving_started_at = ?, airport_receipt_session_id = ?, row_version = row_version + 1, updated_at = ? WHERE transport_job_id = ?`)
        .bind(occurredAt, receipt.airport_receipt_session_id, new Date().toISOString(), receipt.transport_job_id).run();
      await recordEvent(db, actor, receipt, idem, 'TAS_FORMAL_RECEIVING_STARTED', body, occurredAt);
      await projectTasMilestone(db, actor, {
        flightId: receipt.flight_id,
        milestoneCode: 'TAS_RECEIVING_STARTED',
        action: 'START',
        occurredAt,
        evidenceIds: stringArray(body, 'evidence_ids'),
        idempotencyKey: idem,
        segmentCode: 'B1',
        sourceObjectType: 'AirportReceiptSession',
        sourceObjectId: receipt.airport_receipt_session_id
      });
      return response(c, { result: 'TRUCK_ARRIVED', occurred_at: occurredAt });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airport-receipts/:id/seal-check', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const receipt = await loadAirport(db, actor.tenantId, c.req.param('id'));
      if (!['TRUCK_ARRIVED', 'SEAL_CHECK_PENDING'].includes(receipt.status)) throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Truck arrival must be confirmed first');
      const actualSeal = requiredText(body, 'seal_actual');
      const matches = Boolean(receipt.seal_expected) && receipt.seal_expected === actualSeal;
      const condition = matches ? 'MATCHED' : 'MISMATCH';
      if (!matches && stringArray(body, 'evidence_ids').length === 0) throw new V14OperationError(409, 'SEAL_MISMATCH_REQUIRES_APPROVAL', 'Seal mismatch requires evidence and supervisor review');
      await db.prepare(`UPDATE airport_receipt_sessions SET seal_actual = ?, seal_condition = ?, seal_checked_at = ?, status = ?, evidence_refs_json = ?, updated_at = ?, row_version = row_version + 1 WHERE airport_receipt_session_id = ?`)
        .bind(actualSeal, condition, new Date().toISOString(), matches ? 'UNLOADING' : 'DISCREPANCY_REVIEW',
          JSON.stringify(stringArray(body, 'evidence_ids')), new Date().toISOString(), receipt.airport_receipt_session_id).run();
      const exceptionId = matches ? null : await ensureOperationalException(db, {
        stationId: 'TAS', exceptionType: 'TAS_SEAL_MISMATCH', relatedObjectType: 'AirportReceiptSession',
        relatedObjectId: receipt.airport_receipt_session_id, severity: 'Critical', ownerRole: 'B1_TAS_STATION_CONTROLLER', blocker: true,
        rootCause: `Expected seal ${receipt.seal_expected ?? 'missing'}, actual ${actualSeal}`,
        actionTaken: 'Receipt placed in discrepancy review; unloading requires explicit approval'
      });
      await recordEvent(db, actor, receipt, idem, 'TAS_SEAL_CHECKED', { ...body, seal_condition: condition, exception_id: exceptionId });
      return response(c, { result: condition, requires_approval: !matches, exception_id: exceptionId });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airport-receipts/:id/seal-mismatch/approve', requireRoles(sealMismatchApprovalRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) {
        if (
          duplicate.aggregate_type !== 'AirportReceiptSession' ||
          duplicate.aggregate_id !== c.req.param('id') ||
          duplicate.event_type !== 'TAS_SEAL_MISMATCH_APPROVED'
        ) {
          throw new V14OperationError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used for another operation');
        }
        let payload: Record<string, unknown>;
        try {
          const parsed = JSON.parse(duplicate.payload_json || '{}') as unknown;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid approval payload');
          payload = parsed as Record<string, unknown>;
        } catch {
          throw new V14OperationError(500, 'APPROVAL_AUDIT_INVALID', 'Recorded seal mismatch approval audit is invalid');
        }
        return response(c, {
          result: 'APPROVED',
          approval_event_id: duplicate.operation_event_id,
          requested_by: payload.requested_by ?? null,
          approved_by: payload.approved_by ?? null,
          duplicate: true
        });
      }
      const receipt = await loadAirport(db, actor.tenantId, c.req.param('id'));
      if (receipt.seal_condition !== 'MISMATCH' || receipt.status !== 'DISCREPANCY_REVIEW') {
        throw new V14OperationError(409, 'SEAL_MISMATCH_NOT_AWAITING_APPROVAL', 'Receipt is not awaiting seal mismatch approval');
      }
      const latestSealCheck = await loadLatestSealCheck(db, actor.tenantId, receipt.airport_receipt_session_id);
      if (!latestSealCheck) {
        throw new V14OperationError(409, 'SEAL_CHECK_AUDIT_MISSING', 'Seal mismatch approval requires a recorded seal check');
      }
      if (latestSealCheck.actor_id === actor.userId) {
        throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'The seal checker cannot approve the same seal mismatch');
      }
      const reason = requiredText(body, 'reason');
      const evidenceIds = stringArray(body, 'evidence_ids');
      if (evidenceIds.length === 0) {
        throw new V14OperationError(409, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Seal mismatch approval evidence is required');
      }
      const approvedAt = new Date().toISOString();
      const approval = await recordEvent(db, actor, receipt, idem, 'TAS_SEAL_MISMATCH_APPROVED', {
        requested_by: latestSealCheck.actor_id,
        request_event_id: latestSealCheck.operation_event_id,
        approved_by: actor.userId,
        approved_role_ids: actor.roleIds,
        reason,
        evidence_ids: evidenceIds
      }, approvedAt);
      return response(c, {
        result: 'APPROVED',
        approval_event_id: approval.operation_event_id,
        requested_by: latestSealCheck.actor_id,
        approved_by: actor.userId,
        approved_at: approvedAt,
        duplicate: false
      });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airport-receipts/:id/unloading/start', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const receipt = await loadAirport(db, actor.tenantId, c.req.param('id'));
      if (!['UNLOADING', 'DISCREPANCY_REVIEW'].includes(receipt.status)) {
        throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Seal check must be completed before unloading');
      }
      let approval: SealMismatchApprovalAudit | null = null;
      if (receipt.seal_condition === 'MISMATCH') {
        const latestSealCheck = await loadLatestSealCheck(db, actor.tenantId, receipt.airport_receipt_session_id);
        approval = latestSealCheck
          ? await loadSealMismatchApproval(db, actor.tenantId, receipt.airport_receipt_session_id, latestSealCheck.aggregate_sequence)
          : null;
        if (!approval) {
          throw new V14OperationError(409, 'SEAL_MISMATCH_APPROVAL_REQUIRED', 'A recorded supervisor or B1 approval is required before unloading');
        }
      } else if (receipt.seal_condition !== 'MATCHED') {
        throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Seal check must be completed before unloading');
      }
      const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(`UPDATE airport_receipt_sessions SET status = 'COUNTING', unloading_started_at = ?, updated_at = ?, row_version = row_version + 1 WHERE airport_receipt_session_id = ?`)
        .bind(occurredAt, new Date().toISOString(), receipt.airport_receipt_session_id).run();
      const eventPayload = { ...body };
      delete eventPayload.seal_mismatch_approved;
      await recordEvent(db, actor, receipt, idem, 'TAS_UNLOADING_STARTED', {
        ...eventPayload,
        seal_mismatch_approval_event_id: approval?.operation_event_id ?? null,
        seal_mismatch_approved_by: approval?.actor_id ?? null
      }, occurredAt);
      return response(c, { result: 'COUNTING', occurred_at: occurredAt });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airport-receipts/:id/scans', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const prior = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (prior) return response(c, { result: 'DUPLICATE', cargo_unit_id: (JSON.parse(prior.payload_json) as any).cargo_unit_id, summary: await airportReceiptSummary(db, c.req.param('id')) });
      const receipt = await loadAirport(db, actor.tenantId, c.req.param('id'));
      if (receipt.status !== 'COUNTING') throw new V14OperationError(409, 'SESSION_NOT_EDITABLE', 'TAS receipt is not in counting status');
      const barcode = requiredText(body, 'barcode');
      const unit = await db.prepare(`SELECT cargo_unit_id, shipment_id, aggregate_quantity, condition_status FROM cargo_units WHERE tenant_id = ? AND business_barcode = ?`)
        .bind(actor.tenantId, barcode).first<{ cargo_unit_id: string; shipment_id: string; aggregate_quantity: number; condition_status: string }>();
      if (!unit || unit.shipment_id !== receipt.shipment_id) {
        if (unit) {
          await db.prepare(`UPDATE cargo_units SET inventory_state = 'QUARANTINED', current_location_type = 'AIRPORT', current_location_id = 'TAS-QUARANTINE', updated_at = ? WHERE cargo_unit_id = ?`)
            .bind(new Date().toISOString(), unit.cargo_unit_id).run();
        }
        const exceptionId = await ensureOperationalException(db, {
          stationId: 'TAS', exceptionType: unit ? 'TAS_WRONG_SHIPMENT' : 'TAS_UNEXPECTED_BARCODE',
          relatedObjectType: unit ? 'CargoUnit' : 'AirportReceiptSession',
          relatedObjectId: unit?.cargo_unit_id ?? receipt.airport_receipt_session_id,
          severity: 'Critical', ownerRole: 'B1_TAS_STATION_CONTROLLER', blocker: true,
          rootCause: `Barcode ${barcode} is outside shipment ${receipt.shipment_id}`,
          actionTaken: unit ? 'Cargo unit quarantined at TAS' : 'Unknown barcode rejected and receipt blocked for review'
        });
        throw new V14OperationError(409, 'BARCODE_WRONG_SHIPMENT', 'Barcode does not belong to the TAS receipt shipment', { exception_id: exceptionId, cargo_unit_id: unit?.cargo_unit_id ?? null });
      }
      const counted = await db.prepare(`SELECT count_event_id, occurred_at, actor_id, device_id, quantity_delta FROM count_events WHERE tenant_id = ? AND session_type = 'AIRPORT_TAS' AND session_id = ? AND cargo_unit_id = ? AND event_action IN ('SCAN_IN','BULK_COUNT','CORRECT') LIMIT 1`)
        .bind(actor.tenantId, receipt.airport_receipt_session_id, unit.cargo_unit_id).first();
      if (counted) throw new V14OperationError(409, 'BARCODE_ALREADY_COUNTED', 'Barcode was already counted at TAS', { first_count: counted });
      const quantity = Math.max(1, integerValue(body, 'quantity', unit.aggregate_quantity || 1));
      const condition = optionalText(body, 'condition_status') ?? unit.condition_status ?? 'NORMAL';
      const countId = `CNT-${crypto.randomUUID()}`; const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(
        `INSERT INTO count_events (
           count_event_id, tenant_id, session_type, session_id, shipment_id, cargo_unit_id,
           event_action, quantity_delta, location_type, location_id, condition_status, weight_kg,
           occurred_at, actor_id, device_id, client_event_id, idempotency_key, offline_created,
           sync_status, evidence_refs_json
         ) VALUES (?, ?, 'AIRPORT_TAS', ?, ?, ?, ?, ?, 'AIRPORT', 'TAS', ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?)`
      ).bind(
        countId, actor.tenantId, receipt.airport_receipt_session_id, receipt.shipment_id, unit.cargo_unit_id,
        quantity > 1 ? 'BULK_COUNT' : 'SCAN_IN', quantity, condition, numberValue(body, 'weight_kg') || null,
        occurredAt, actor.userId, optionalText(body, 'device_id'), optionalText(body, 'client_event_id') ?? idem,
        idem, Number(Boolean(body.offline_created)), JSON.stringify(stringArray(body, 'evidence_ids'))
      ).run();
      await db.prepare(`UPDATE cargo_units SET inventory_state = ?, condition_status = ?, actual_weight_kg = COALESCE(?, actual_weight_kg), current_location_type = 'AIRPORT', current_location_id = 'TAS', updated_at = ? WHERE cargo_unit_id = ?`)
        .bind(condition === 'NORMAL' ? 'TAS_RECEIVED' : 'QUARANTINED', condition, numberValue(body, 'weight_kg') || null, new Date().toISOString(), unit.cargo_unit_id).run();
      await db.prepare(`UPDATE airport_receipt_sessions SET airport_received_pieces = airport_received_pieces + ?, damaged_pieces = damaged_pieces + ?, updated_at = ?, row_version = row_version + 1 WHERE airport_receipt_session_id = ?`)
        .bind(quantity, condition === 'NORMAL' ? 0 : quantity, new Date().toISOString(), receipt.airport_receipt_session_id).run();
      const exceptionId = condition === 'NORMAL' ? null : await ensureOperationalException(db, {
        stationId: 'TAS', exceptionType: 'TAS_CARGO_CONDITION', relatedObjectType: 'CargoUnit', relatedObjectId: unit.cargo_unit_id,
        severity: 'High', ownerRole: 'B1_TAS_STATION_CONTROLLER', blocker: true,
        rootCause: `Condition reported as ${condition}`, actionTaken: 'Cargo unit quarantined at TAS'
      });
      await recordEvent(db, actor, receipt, idem, 'TAS_CARGO_COUNTED', { cargo_unit_id: unit.cargo_unit_id, barcode, quantity, condition_status: condition, count_event_id: countId, exception_id: exceptionId }, occurredAt);
      return response(c, { result: 'COUNTED', cargo_unit_id: unit.cargo_unit_id, exception_id: exceptionId, summary: await airportReceiptSummary(db, receipt.airport_receipt_session_id) });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airport-receipts/:id/reconcile', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({})); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const receipt = await loadAirport(db, actor.tenantId, c.req.param('id'));
      if (!['COUNTING', 'RECONCILIATION_PENDING', 'DISCREPANCY_REVIEW'].includes(receipt.status)) throw new V14OperationError(409, 'CHECKPOINT_OUT_OF_SEQUENCE', 'Unloading and counting must start before reconciliation');
      const counts = await db.prepare(
        `SELECT COALESCE(SUM(CASE WHEN quantity_delta > 0 THEN quantity_delta ELSE 0 END), 0) AS received,
                COALESCE(SUM(CASE WHEN condition_status <> 'NORMAL' AND quantity_delta > 0 THEN quantity_delta ELSE 0 END), 0) AS damaged
         FROM count_events WHERE session_type = 'AIRPORT_TAS' AND session_id = ?`
      ).bind(receipt.airport_receipt_session_id).first<{ received: number; damaged: number }>();
      const received = Number(counts?.received ?? 0);
      const matched = Math.min(receipt.warehouse_out_pieces, receipt.truck_loaded_pieces, received);
      const missing = Math.max(0, Math.max(receipt.warehouse_out_pieces, receipt.truck_loaded_pieces) - received);
      const unexpected = Math.max(0, received - Math.max(receipt.warehouse_out_pieces, receipt.truck_loaded_pieces));
      const status = missing === 0 && unexpected === 0 && Number(counts?.damaged ?? 0) === 0 && receipt.seal_condition === 'MATCHED' ? 'MATCHED' : 'MISMATCH';
      const reconciliationId = `REC-TAS-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO reconciliation_results (
           reconciliation_result_id, tenant_id, airport_receipt_session_id, shipment_id,
           warehouse_out_pieces, truck_loaded_pieces, airport_received_pieces, matched_pieces,
           missing_pieces, unexpected_pieces, status, differences_json, calculated_at, rule_version
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TAS-3WAY-v1')`
      ).bind(
        reconciliationId, actor.tenantId, receipt.airport_receipt_session_id, receipt.shipment_id,
        receipt.warehouse_out_pieces, receipt.truck_loaded_pieces, received, matched, missing, unexpected,
        status, JSON.stringify({ damaged_pieces: Number(counts?.damaged ?? 0), seal_condition: receipt.seal_condition }), now
      ).run();
      await db.prepare(`UPDATE airport_receipt_sessions SET status = ?, airport_received_pieces = ?, matched_pieces = ?, missing_pieces = ?, unexpected_pieces = ?, damaged_pieces = ?, reconciliation_result_id = ?, count_completed_at = ?, unloading_completed_at = COALESCE(unloading_completed_at, ?), updated_at = ?, row_version = row_version + 1 WHERE airport_receipt_session_id = ?`)
        .bind(status === 'MATCHED' ? 'MATCHED' : 'DISCREPANCY_REVIEW', received, matched, missing, unexpected,
          Number(counts?.damaged ?? 0), reconciliationId, now, now, now, receipt.airport_receipt_session_id).run();
      const exceptionIds: string[] = [];
      if (missing > 0) exceptionIds.push(await ensureOperationalException(db, {
        stationId: 'TAS', exceptionType: 'TAS_SHORTAGE', relatedObjectType: 'AirportReceiptSession', relatedObjectId: receipt.airport_receipt_session_id,
        severity: 'Critical', ownerRole: 'B1_TAS_STATION_CONTROLLER', blocker: true,
        rootCause: `${missing} piece(s) missing in three-way reconciliation`, actionTaken: 'Receipt blocked for discrepancy review'
      }));
      if (unexpected > 0) exceptionIds.push(await ensureOperationalException(db, {
        stationId: 'TAS', exceptionType: 'TAS_UNEXPECTED_CARGO', relatedObjectType: 'AirportReceiptSession', relatedObjectId: receipt.airport_receipt_session_id,
        severity: 'Critical', ownerRole: 'B1_TAS_STATION_CONTROLLER', blocker: true,
        rootCause: `${unexpected} unexpected piece(s) in three-way reconciliation`, actionTaken: 'Unexpected cargo quarantined for review'
      }));
      if (Number(counts?.damaged ?? 0) > 0) exceptionIds.push(await ensureOperationalException(db, {
        stationId: 'TAS', exceptionType: 'TAS_DAMAGED_CARGO', relatedObjectType: 'AirportReceiptSession', relatedObjectId: receipt.airport_receipt_session_id,
        severity: 'High', ownerRole: 'B1_TAS_STATION_CONTROLLER', blocker: true,
        rootCause: `${Number(counts?.damaged ?? 0)} damaged piece(s) counted`, actionTaken: 'Damaged cargo retained in quarantine'
      }));
      await recordEvent(db, actor, receipt, idem, 'TAS_THREE_WAY_RECONCILED', { reconciliation_result_id: reconciliationId, status, matched, missing, unexpected, exception_ids: exceptionIds }, now);
      return response(c, { result: status, reconciliation_result_id: reconciliationId, matched_pieces: matched, missing_pieces: missing, unexpected_pieces: unexpected, damaged_pieces: Number(counts?.damaged ?? 0), exception_ids: exceptionIds });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airport-receipts/:id/submit', requireRoles(operatorRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({})); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const receipt = await loadAirport(db, actor.tenantId, c.req.param('id'));
      if (!['MATCHED', 'DISCREPANCY_REVIEW'].includes(receipt.status)) throw new V14OperationError(409, 'RECONCILIATION_HAS_BLOCKERS', 'Three-way reconciliation must run before supervisor review');
      await db.prepare(`UPDATE airport_receipt_sessions SET status = 'RECONCILIATION_PENDING', received_by = ?, updated_at = ?, row_version = row_version + 1 WHERE airport_receipt_session_id = ?`)
        .bind(actor.userId, new Date().toISOString(), receipt.airport_receipt_session_id).run();
      await recordEvent(db, actor, receipt, idem, 'TAS_RECEIPT_SUBMITTED', body);
      return response(c, { result: 'RECONCILIATION_PENDING' });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/airport-receipts/:id/decision', requireRoles(['platform_admin', 'station_supervisor', 'B1_TAS_STATION_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const receipt = await loadAirport(db, actor.tenantId, c.req.param('id'));
      if (receipt.status !== 'RECONCILIATION_PENDING') throw new V14OperationError(409, 'SESSION_NOT_EDITABLE', 'Receipt must be submitted before a decision');
      const reconciliation = await loadRequired<{ status: string; missing_pieces: number; unexpected_pieces: number; duplicate_pieces: number; wrong_shipment_pieces: number }>(
        db, `SELECT status, missing_pieces, unexpected_pieces, duplicate_pieces, wrong_shipment_pieces FROM reconciliation_results WHERE airport_receipt_session_id = ? ORDER BY calculated_at DESC LIMIT 1`,
        [receipt.airport_receipt_session_id], 'RECONCILIATION_NOT_FOUND', 'Three-way reconciliation result is missing'
      );
      const requestedDecision = requiredText(body, 'decision');
      if (!['PASS', 'CONDITIONAL_PASS', 'BLOCKED'].includes(requestedDecision)) throw new V14OperationError(400, 'VALIDATION_ERROR', 'decision must be PASS, CONDITIONAL_PASS or BLOCKED');
      if (requestedDecision === 'PASS' && reconciliation.status !== 'MATCHED') throw new V14OperationError(409, 'RECONCILIATION_HAS_BLOCKERS', 'A mismatch cannot receive an unconditional PASS');
      if (requestedDecision !== 'BLOCKED' && stringArray(body, 'evidence_ids').length === 0) throw new V14OperationError(409, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Receipt decision requires handover evidence');
      const gateId = await createGateDecision(db, actor, {
        gateCode: 'TAS_AIRPORT_RECEIPT_GATE', objectType: 'AirportReceiptSession', objectId: receipt.airport_receipt_session_id,
        decision: requestedDecision as 'PASS' | 'CONDITIONAL_PASS' | 'BLOCKED', actionComplete: true,
        dataConsistent: reconciliation.status === 'MATCHED', evidenceComplete: stringArray(body, 'evidence_ids').length > 0,
        nextOwnerAccepted: body.next_owner_accepted === true,
        requestedBy: optionalText(body, 'requested_by') ?? receipt.received_by ?? requiredText(body, 'requested_by'),
        reason: optionalText(body, 'reason'), conditions: reconciliation,
        cargoUnitIds: stringArray(body, 'cargo_unit_ids'), expiresAt: optionalText(body, 'expires_at')
      });
      const nextStatus = requestedDecision === 'PASS' ? 'ACCEPTED' : requestedDecision === 'CONDITIONAL_PASS' ? 'CONDITIONAL_ACCEPTED' : 'REJECTED_OR_QUARANTINED';
      const now = new Date().toISOString();
      await db.prepare(`UPDATE airport_receipt_sessions SET status = ?, gate_decision_id = ?, handover_at = ?, evidence_refs_json = ?, updated_at = ?, row_version = row_version + 1 WHERE airport_receipt_session_id = ?`)
        .bind(nextStatus, gateId, now, JSON.stringify(stringArray(body, 'evidence_ids')), now, receipt.airport_receipt_session_id).run();
      if (requestedDecision !== 'BLOCKED') {
        await db.prepare(`UPDATE cargo_units SET inventory_state = CASE WHEN condition_status = 'NORMAL' THEN 'RELEASED' ELSE 'QUARANTINED' END, updated_at = ? WHERE shipment_id = ? AND inventory_state IN ('TAS_RECEIVED','QUARANTINED')`)
          .bind(now, receipt.shipment_id).run();
        await db.prepare(`UPDATE cargo_unit_transport_assignments SET assignment_status = 'UNLOADED', unloaded_at = ? WHERE transport_job_id = ? AND assignment_status = 'ACTIVE'`)
          .bind(now, receipt.transport_job_id).run();
        await db.prepare(`UPDATE transport_jobs SET status = 'DELIVERED_TO_AIRPORT', actual_arrival_at = ?, row_version = row_version + 1, updated_at = ? WHERE transport_job_id = ?`)
          .bind(now, now, receipt.transport_job_id).run();
      }
      await recordEvent(db, actor, receipt, idem, 'TAS_RECEIPT_DECIDED', { ...body, gate_decision_id: gateId, result_status: nextStatus }, now);
      if (requestedDecision !== 'BLOCKED') {
        await projectTasMilestone(db, actor, {
          flightId: receipt.flight_id,
          milestoneCode: 'TAS_RECEIVING_STARTED',
          action: 'COMPLETE',
          occurredAt: now,
          evidenceIds: stringArray(body, 'evidence_ids'),
          idempotencyKey: idem,
          segmentCode: 'B1',
          sourceObjectType: 'AirportReceiptSession',
          sourceObjectId: receipt.airport_receipt_session_id
        });
      }
      await enqueueSkyledgerEvent(c.env, {
        eventType: 'tas.receipt_decided.v1', aggregateType: 'AirportReceiptSession', aggregateId: receipt.airport_receipt_session_id,
        payload: { airport_receipt_session_id: receipt.airport_receipt_session_id, transport_job_id: receipt.transport_job_id,
          shipment_id: receipt.shipment_id, decision: requestedDecision, result_status: nextStatus,
          warehouse_out_pieces: receipt.warehouse_out_pieces, truck_loaded_pieces: receipt.truck_loaded_pieces,
          airport_received_pieces: receipt.airport_received_pieces, decided_at: now, gate_decision_id: gateId }
      });
      return response(c, { result: nextStatus, gate_decision_id: gateId });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/airport-receipts/:id/handover-summary', requireRoles(viewRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; assertTasAccess(actor);
      const receipt = await loadRequired<Record<string, unknown>>(db,
        `SELECT r.*, g.decision AS gate_decision, g.reason AS gate_reason,
                x.status AS reconciliation_status, x.differences_json
         FROM airport_receipt_sessions r
         LEFT JOIN gate_decisions g ON g.gate_decision_id = r.gate_decision_id
         LEFT JOIN reconciliation_results x ON x.reconciliation_result_id = r.reconciliation_result_id
         WHERE r.tenant_id = ? AND r.airport_receipt_session_id = ?`, [actor.tenantId, c.req.param('id')],
        'AIRPORT_RECEIPT_NOT_FOUND', 'TAS receipt was not found'
      );
      return response(c, { handover_summary: receipt });
    } catch (error) { return handleError(c, error); }
  });
}
