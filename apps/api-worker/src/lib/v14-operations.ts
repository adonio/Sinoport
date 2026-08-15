import type { AuthActor } from '@sinoport/auth';
import type { D1DatabaseLike } from '@sinoport/repositories';

export class V14OperationError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 500,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'V14OperationError';
  }
}

export function requireV14Db(env: { DB?: D1DatabaseLike }) {
  if (!env.DB) throw new V14OperationError(500, 'DATABASE_NOT_CONFIGURED', 'D1 database binding is missing');
  return env.DB;
}

export function requestId(headers: Headers) {
  return headers.get('X-Request-Id') || headers.get('Idempotency-Key') || `req-${crypto.randomUUID()}`;
}

export function idempotencyKey(headers: Headers, body: Record<string, unknown>) {
  const key = headers.get('Idempotency-Key') || String(body.idempotency_key ?? body.client_event_id ?? '').trim();
  if (!key) throw new V14OperationError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
  return key;
}

export function requiredText(body: Record<string, unknown>, key: string) {
  const value = String(body[key] ?? '').trim();
  if (!value) throw new V14OperationError(400, 'VALIDATION_ERROR', `${key} is required`, { field: key });
  return value;
}

export function optionalText(body: Record<string, unknown>, key: string) {
  const value = String(body[key] ?? '').trim();
  return value || null;
}

export function integerValue(body: Record<string, unknown>, key: string, fallback = 0) {
  const value = Number(body[key]);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export function numberValue(body: Record<string, unknown>, key: string, fallback = 0) {
  const value = Number(body[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function stringArray(body: Record<string, unknown>, key: string) {
  return Array.isArray(body[key]) ? (body[key] as unknown[]).map((item) => String(item)).filter(Boolean) : [];
}

export async function loadRequired<T>(
  db: D1DatabaseLike,
  query: string,
  values: unknown[],
  code: string,
  message: string
) {
  const row = await db.prepare(query).bind(...values).first<T>();
  if (!row) throw new V14OperationError(404, code, message);
  return row;
}

export async function findOperationByIdempotency(
  db: D1DatabaseLike,
  tenantId: string,
  key: string
) {
  return db
    .prepare(
      `SELECT operation_event_id, aggregate_type, aggregate_id, aggregate_sequence, event_type, payload_json
       FROM operation_events WHERE tenant_id = ? AND idempotency_key = ?`
    )
    .bind(tenantId, key)
    .first<{
      operation_event_id: string;
      aggregate_type: string;
      aggregate_id: string;
      aggregate_sequence: number;
      event_type: string;
      payload_json: string;
    }>();
}

export async function appendOperationEvent(
  db: D1DatabaseLike,
  actor: AuthActor,
  params: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    eventAction?: string | null;
    idempotencyKey: string;
    stationId?: string | null;
    shipmentId?: string | null;
    flightId?: string | null;
    awbId?: string | null;
    occurredAt?: string | null;
    clientEventId?: string | null;
    reasonCode?: string | null;
    payload?: Record<string, unknown>;
    correlationId?: string | null;
    causationId?: string | null;
  }
) {
  const duplicate = await findOperationByIdempotency(db, actor.tenantId, params.idempotencyKey);
  if (duplicate) return { ...duplicate, duplicate: true };
  const sequenceRow = await db
    .prepare(
      `SELECT COALESCE(MAX(aggregate_sequence), 0) AS current_sequence
       FROM operation_events WHERE tenant_id = ? AND aggregate_type = ? AND aggregate_id = ?`
    )
    .bind(actor.tenantId, params.aggregateType, params.aggregateId)
    .first<{ current_sequence: number }>();
  const sequence = Number(sequenceRow?.current_sequence ?? 0) + 1;
  const eventId = `OP-${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO operation_events (
         operation_event_id, tenant_id, station_id, shipment_id, flight_id, awb_id,
         aggregate_type, aggregate_id, aggregate_sequence, event_type, event_action,
         occurred_at, actor_id, actor_role, client_source, client_event_id, idempotency_key,
         correlation_id, causation_id, reason_code, payload_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      eventId,
      actor.tenantId,
      params.stationId ?? null,
      params.shipmentId ?? null,
      params.flightId ?? null,
      params.awbId ?? null,
      params.aggregateType,
      params.aggregateId,
      sequence,
      params.eventType,
      params.eventAction ?? null,
      params.occurredAt ?? new Date().toISOString(),
      actor.userId,
      actor.roleIds[0] ?? 'mobile_operator',
      actor.clientSource,
      params.clientEventId ?? null,
      params.idempotencyKey,
      params.correlationId ?? null,
      params.causationId ?? null,
      params.reasonCode ?? null,
      JSON.stringify(params.payload ?? {})
    )
    .run();
  return {
    operation_event_id: eventId,
    aggregate_type: params.aggregateType,
    aggregate_id: params.aggregateId,
    aggregate_sequence: sequence,
    event_type: params.eventType,
    payload_json: JSON.stringify(params.payload ?? {}),
    duplicate: false
  };
}

export async function receiptSummary(db: D1DatabaseLike, receiptSessionId: string) {
  return loadRequired<{
    receipt_session_id: string;
    expected_pieces: number;
    unique_received_pieces: number;
    normal_pieces: number;
    exception_pieces: number;
    status: string;
  }>(
    db,
    `SELECT receipt_session_id, expected_pieces, unique_received_pieces, normal_pieces,
            exception_pieces, status FROM warehouse_receipt_sessions WHERE receipt_session_id = ?`,
    [receiptSessionId],
    'RECEIPT_NOT_FOUND',
    'Pre-warehouse receipt session was not found'
  );
}

export async function airportReceiptSummary(db: D1DatabaseLike, receiptSessionId: string) {
  return loadRequired<Record<string, unknown>>(
    db,
    `SELECT * FROM airport_receipt_sessions WHERE airport_receipt_session_id = ?`,
    [receiptSessionId],
    'AIRPORT_RECEIPT_NOT_FOUND',
    'Airport receipt session was not found'
  );
}

export async function createOperationalException(
  db: D1DatabaseLike,
  params: {
    stationId: string;
    exceptionType: string;
    relatedObjectType: string;
    relatedObjectId: string;
    severity?: 'Low' | 'Medium' | 'High' | 'Critical';
    ownerRole?: string | null;
    blocker?: boolean;
    rootCause?: string | null;
    actionTaken?: string | null;
  }
) {
  const exceptionId = `EXC-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO exceptions (
       exception_id, station_id, exception_type, related_object_type, related_object_id,
       severity, owner_role, exception_status, blocker_flag, root_cause, action_taken,
       opened_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?)`
  ).bind(
    exceptionId,
    params.stationId,
    params.exceptionType,
    params.relatedObjectType,
    params.relatedObjectId,
    params.severity ?? 'High',
    params.ownerRole ?? null,
    Number(Boolean(params.blocker)),
    params.rootCause ?? null,
    params.actionTaken ?? null,
    now,
    now,
    now
  ).run();
  return exceptionId;
}

export async function ensureOperationalException(
  db: D1DatabaseLike,
  params: Parameters<typeof createOperationalException>[1]
) {
  const existing = await db.prepare(
    `SELECT exception_id FROM exceptions
     WHERE station_id = ? AND exception_type = ? AND related_object_type = ?
       AND related_object_id = ? AND exception_status IN ('Open', 'In Progress')
     ORDER BY opened_at DESC LIMIT 1`
  ).bind(params.stationId, params.exceptionType, params.relatedObjectType, params.relatedObjectId)
    .first<{ exception_id: string }>();
  return existing?.exception_id ?? createOperationalException(db, params);
}

export async function createGateDecision(
  db: D1DatabaseLike,
  actor: AuthActor,
  params: {
    gateCode: string;
    objectType: string;
    objectId: string;
    decision: 'PASS' | 'CONDITIONAL_PASS' | 'BLOCKED' | 'REVOKED';
    actionComplete: boolean;
    dataConsistent: boolean;
    evidenceComplete: boolean;
    nextOwnerAccepted: boolean;
    requestedBy: string;
    reason?: string | null;
    conditions?: Record<string, unknown>;
    cargoUnitIds?: string[];
    expiresAt?: string | null;
  }
) {
  if (params.requestedBy === actor.userId) {
    throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Gate requester and approver must be different users');
  }
  if (params.decision === 'PASS' && (!params.actionComplete || !params.dataConsistent || !params.evidenceComplete || !params.nextOwnerAccepted)) {
    throw new V14OperationError(409, 'GATE_CLOSURE_INCOMPLETE', 'PASS requires completed action, consistent data, complete evidence and next-owner acceptance', {
      action_complete: params.actionComplete,
      data_consistent: params.dataConsistent,
      evidence_complete: params.evidenceComplete,
      next_owner_accepted: params.nextOwnerAccepted
    });
  }
  if (params.decision === 'CONDITIONAL_PASS') {
    if (!params.reason || !(params.cargoUnitIds?.length) || !params.expiresAt) {
      throw new V14OperationError(409, 'CONDITIONAL_GATE_SCOPE_REQUIRED', 'Conditional pass requires reason, applicable cargo units and expiry');
    }
    if (new Date(params.expiresAt).getTime() <= Date.now()) {
      throw new V14OperationError(409, 'CONDITIONAL_GATE_EXPIRED', 'Conditional pass expiry must be in the future');
    }
  }
  const version = await db
    .prepare(
      `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version FROM gate_decisions
       WHERE gate_code = ? AND related_object_type = ? AND related_object_id = ?`
    )
    .bind(params.gateCode, params.objectType, params.objectId)
    .first<{ next_version: number }>();
  const gateId = `GATE-${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO gate_decisions (
         gate_decision_id, tenant_id, gate_code, related_object_type, related_object_id,
         decision, action_complete, data_consistent, evidence_complete, next_owner_accepted,
         conditions_json, applicable_cargo_unit_ids_json, reason, requested_by, decided_by,
         decided_at, expires_at, version_no
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      gateId,
      actor.tenantId,
      params.gateCode,
      params.objectType,
      params.objectId,
      params.decision,
      Number(params.actionComplete),
      Number(params.dataConsistent),
      Number(params.evidenceComplete),
      Number(params.nextOwnerAccepted),
      JSON.stringify(params.conditions ?? {}),
      JSON.stringify(params.cargoUnitIds ?? []),
      params.reason ?? null,
      params.requestedBy,
      actor.userId,
      new Date().toISOString(),
      params.expiresAt ?? null,
      Number(version?.next_version ?? 1)
    )
    .run();
  return gateId;
}

function arrayContainsJson(json: string | null | undefined, value: string) {
  if (!json) return false;
  try {
    const values = JSON.parse(json) as unknown;
    return Array.isArray(values) && (values.length === 0 || values.includes(value));
  } catch {
    return false;
  }
}

export async function assertOccPermission(
  db: D1DatabaseLike,
  actor: AuthActor,
  params: {
    flightId: string;
    requiredRoles: string[];
    segmentCode: string;
    objectRef: string;
    makerUserId?: string | null;
  }
) {
  if (params.makerUserId && params.makerUserId === actor.userId) {
    throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Maker and checker must be different users');
  }
  const actorRole = actor.roleIds.find((role) => params.requiredRoles.includes(role));
  if (!actorRole) {
    throw new V14OperationError(403, 'OCC_PUBLISH_PERMISSION_REQUIRED', 'Actor does not hold the required control role', {
      required_roles: params.requiredRoles
    });
  }
  const now = new Date().toISOString();
  const qualification = await db
    .prepare(
      `SELECT role_qualification_id FROM role_qualifications
       WHERE tenant_id = ? AND user_id = ? AND role_code = ? AND status = 'ACTIVE'
         AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)
       ORDER BY valid_from DESC LIMIT 1`
    )
    .bind(actor.tenantId, actor.userId, actorRole, now, now)
    .first<{ role_qualification_id: string }>();
  if (!qualification) {
    throw new V14OperationError(403, 'ROLE_QUALIFICATION_REQUIRED', 'A current role qualification is required');
  }
  const assignment = await db
    .prepare(
      `SELECT a.assignment_id, a.segment_scope_codes_json, a.object_scope_refs_json,
              a.temporary_permission_expires_at
       FROM control_role_assignments a
       JOIN flight_duty_plans d ON d.flight_duty_plan_id = a.flight_duty_plan_id
       WHERE d.flight_id = ? AND a.primary_user_id = ? AND a.role_code = ?
         AND a.duty_status IN ('ON_DUTY', 'TEMP_ACTIVATED')
         AND a.acceptance_status = 'ACCEPTED'
         AND a.shift_start_at <= ? AND a.shift_end_at >= ?
       ORDER BY a.effective_from DESC LIMIT 1`
    )
    .bind(params.flightId, actor.userId, actorRole, now, now)
    .first<{
      assignment_id: string;
      segment_scope_codes_json: string;
      object_scope_refs_json: string;
      temporary_permission_expires_at: string | null;
    }>();
  if (!assignment) {
    throw new V14OperationError(403, 'DUTY_ASSIGNMENT_INACTIVE', 'Actor is not active on duty for this flight');
  }
  if (assignment.temporary_permission_expires_at && assignment.temporary_permission_expires_at < now) {
    throw new V14OperationError(403, 'TEMPORARY_PERMISSION_EXPIRED', 'Temporary permission has expired');
  }
  if (!arrayContainsJson(assignment.segment_scope_codes_json, params.segmentCode)) {
    throw new V14OperationError(403, 'CONTROL_SEGMENT_PERMISSION_MISMATCH', 'Assignment does not cover this control segment');
  }
  if (!arrayContainsJson(assignment.object_scope_refs_json, params.objectRef)) {
    throw new V14OperationError(403, 'CONTROL_SEGMENT_PERMISSION_MISMATCH', 'Assignment does not cover this object');
  }
  return { role_code: actorRole, assignment_id: assignment.assignment_id };
}
