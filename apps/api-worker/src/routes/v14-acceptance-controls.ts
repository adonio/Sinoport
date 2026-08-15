import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { ApiApp } from '../index';
import { canonicalJson, sha256Hex } from '../lib/integration-sync';
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
  console.error('[v14-acceptance-controls]', error);
  return jsonError(c, 500, 'ACCEPTANCE_CONTROL_FAILED', error instanceof Error ? error.message : 'Operation failed');
}

function response(c: any, data: Record<string, unknown>, status: 200 | 201 = 200) {
  return c.json({ request_id: requestId(c.req.raw.headers), ...data }, status);
}

function iso(value: unknown, fallback = new Date()) {
  const date = value ? new Date(String(value)) : fallback;
  if (!Number.isFinite(date.getTime())) throw new V14OperationError(400, 'VALIDATION_ERROR', 'Timestamp must be valid ISO 8601');
  return date.toISOString();
}

function minutesBetween(later: string, earlier: string | null | undefined) {
  if (!earlier) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((new Date(later).getTime() - new Date(earlier).getTime()) / 60_000));
}

async function createControlTask(
  db: any,
  params: {
    tenantId: string;
    planId?: string | null;
    taskType: string;
    objectType: string;
    objectId: string;
    ownerRole: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    dueAt: string;
    sourceFactAt?: string | null;
    reasonCode: string;
    details?: Record<string, unknown>;
  }
) {
  const existing = await db.prepare(
    `SELECT control_task_id FROM control_tasks
     WHERE tenant_id = ? AND task_type = ? AND related_object_type = ? AND related_object_id = ?
       AND reason_code = ? AND status IN ('OPEN','ACKNOWLEDGED') LIMIT 1`
  ).bind(params.tenantId, params.taskType, params.objectType, params.objectId, params.reasonCode)
    .first() as { control_task_id: string } | null;
  if (existing) return { control_task_id: existing.control_task_id, duplicate: true };
  const taskId = `CTASK-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO control_tasks (
       control_task_id, tenant_id, operation_control_plan_id, task_type,
       related_object_type, related_object_id, owner_role, severity, status,
       due_at, source_fact_at, reason_code, details_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?)`
  ).bind(
    taskId, params.tenantId, params.planId ?? null, params.taskType, params.objectType,
    params.objectId, params.ownerRole, params.severity, params.dueAt,
    params.sourceFactAt ?? null, params.reasonCode, JSON.stringify(params.details ?? {}), now, now
  ).run();
  return { control_task_id: taskId, duplicate: false };
}

function equalSets(left: unknown, right: unknown) {
  const a = [...new Set(Array.isArray(left) ? left.map(String) : [])].sort();
  const b = [...new Set(Array.isArray(right) ? right.map(String) : [])].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function evaluateGate(gateCode: string, body: Record<string, unknown>) {
  const assertNonNegative = (values: number[]) => {
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new V14OperationError(400, 'VALIDATION_ERROR', 'Gate quantities and weights must be non-negative finite numbers');
    }
  };
  switch (gateCode) {
    case 'GATE_A': {
      const values = [integerValue(body, 'planned_pieces'), integerValue(body, 'scanned_pieces'), integerValue(body, 'manual_pieces')];
      assertNonNegative(values);
      return { pass: values[0] === values[1] && values[1] === values[2], values };
    }
    case 'GATE_B': {
      const entered = integerValue(body, 'entered_pieces');
      const components = [integerValue(body, 'passed_pieces'), integerValue(body, 'held_pieces'), integerValue(body, 'returned_pieces')];
      assertNonNegative([entered, ...components]);
      const accounted = components.reduce((sum, value) => sum + value, 0);
      return { pass: entered === accounted, entered_pieces: entered, accounted_pieces: accounted };
    }
    case 'GATE_C': {
      const layerTotals = Array.isArray(body.layer_totals) ? (body.layer_totals as unknown[]).map(Number) : [];
      assertNonNegative(layerTotals);
      const accumulated = layerTotals.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
      const uldTotal = integerValue(body, 'uld_total_pieces');
      assertNonNegative([uldTotal]);
      return { pass: layerTotals.length > 0 && accumulated === uldTotal, layer_totals: layerTotals, accumulated_pieces: accumulated, uld_total_pieces: uldTotal };
    }
    case 'GATE_D': {
      const weight = numberValue(body, 'actual_weight_kg');
      const min = numberValue(body, 'minimum_weight_kg');
      const max = numberValue(body, 'maximum_weight_kg');
      assertNonNegative([weight, min, max, integerValue(body, 'expected_pieces'), integerValue(body, 'actual_pieces')]);
      const boardMatch = requiredText(body, 'expected_board_id') === requiredText(body, 'actual_board_id');
      const piecesMatch = integerValue(body, 'expected_pieces') === integerValue(body, 'actual_pieces');
      return { pass: boardMatch && piecesMatch && weight >= min && weight <= max, board_match: boardMatch, pieces_match: piecesMatch, weight_in_range: weight >= min && weight <= max };
    }
    case 'GATE_E': {
      const setMatch = equalSets(body.manifest_uld_ids, body.actual_loaded_uld_ids);
      return { pass: setMatch, manifest_uld_ids: body.manifest_uld_ids ?? [], actual_loaded_uld_ids: body.actual_loaded_uld_ids ?? [] };
    }
    case 'LABEL_ACCOUNTING': {
      const printed = integerValue(body, 'printed_count');
      const components = [integerValue(body, 'used_count'), integerValue(body, 'void_count'), integerValue(body, 'remaining_count')];
      assertNonNegative([printed, ...components]);
      const accounted = components.reduce((sum, value) => sum + value, 0);
      return { pass: printed === accounted, printed_count: printed, accounted_count: accounted };
    }
    default:
      throw new V14OperationError(400, 'VALIDATION_ERROR', 'Unsupported gate_code');
  }
}

export function registerV14AcceptanceControlRoutes(app: ApiApp, requireRoles: RequireRoles) {
  const controlRoles: RoleCode[] = [
    'platform_admin', 'OCC_DM', 'A1_CARGO_CONTROLLER', 'A2_DOMESTIC_TRUCK_CONTROLLER',
    'A3_CROSS_BORDER_CONTROLLER', 'B1_TAS_STATION_CONTROLLER', 'B2_FLIGHT_MONITOR',
    'OBI_OVERSEAS_INTERFACE', 'DQC_DATA_QUALITY_CONTROLLER'
  ];

  app.get('/api/v1/control-tasks', requireRoles(controlRoles), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const planId = String(c.req.query('operation_control_plan_id') ?? '').trim();
      const status = String(c.req.query('status') ?? '').trim();
      const rows = await db.prepare(
        `SELECT * FROM control_tasks WHERE (? = '' OR operation_control_plan_id = ?)
         AND (? = '' OR status = ?) ORDER BY due_at, created_at LIMIT 500`
      ).bind(planId, planId, status, status).all();
      return response(c, { items: rows.results, total: rows.results.length });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/control-tasks/:id/complete', requireRoles(controlRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const task = await loadRequired<Record<string, any>>(db, `SELECT * FROM control_tasks WHERE control_task_id = ?`, [c.req.param('id')], 'CONTROL_TASK_NOT_FOUND', 'Control task was not found');
      const now = new Date().toISOString();
      await db.prepare(`UPDATE control_tasks SET status = 'COMPLETED', resolved_at = ?, resolved_by = ?, updated_at = ? WHERE control_task_id = ?`)
        .bind(now, actor.userId, now, task.control_task_id).run();
      await appendOperationEvent(db, actor, { aggregateType: task.related_object_type, aggregateId: task.related_object_id, eventType: 'CONTROL_TASK_COMPLETED', idempotencyKey: idem, payload: { control_task_id: task.control_task_id, reason_code: task.reason_code } });
      return response(c, { result: 'COMPLETED', control_task_id: task.control_task_id });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/control-inputs', requireRoles(controlRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { result: 'DUPLICATE', control_input_signal_id: (JSON.parse(duplicate.payload_json) as any).control_input_signal_id });
      const plan = await loadRequired<{ flight_id: string }>(db, `SELECT flight_id FROM operation_control_plans WHERE operation_control_plan_id = ?`, [c.req.param('id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      const occurredAt = iso(requiredText(body, 'occurred_at'));
      const mustRecordBy = new Date(new Date(occurredAt).getTime() + 30 * 60_000).toISOString();
      const signalId = `SIG-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO control_input_signals (
           control_input_signal_id, tenant_id, operation_control_plan_id, signal_type,
           source_channel, occurred_at, must_record_by, status, payload_json, submitted_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_RECORD', ?, ?)`
      ).bind(signalId, actor.tenantId, c.req.param('id'), requiredText(body, 'signal_type'), requiredText(body, 'source_channel'), occurredAt, mustRecordBy, JSON.stringify(body.payload ?? {}), actor.userId).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: c.req.param('id'), eventType: 'CONTROL_INPUT_SIGNAL_RECEIVED', idempotencyKey: idem, flightId: plan.flight_id, occurredAt, payload: { control_input_signal_id: signalId, must_record_by: mustRecordBy } });
      return response(c, { result: 'PENDING_RECORD', control_input_signal_id: signalId, must_record_by: mustRecordBy }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/automation/evaluate', requireRoles(['platform_admin', 'OCC_DM', 'DQC_DATA_QUALITY_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadRequired<Record<string, any>>(db, `SELECT * FROM operation_control_plans WHERE operation_control_plan_id = ?`, [c.req.param('id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      const asOf = iso(body.as_of);
      const created: Array<Record<string, unknown>> = [];
      let inferredColor: 'BLUE' | 'YELLOW' | 'RED' = plan.overall_health_color === 'RED' ? 'RED' : plan.overall_health_color === 'BLUE' ? 'BLUE' : 'YELLOW';

      const jobs = await db.prepare(`SELECT transport_job_id, last_location_at, health_state FROM transport_jobs WHERE flight_id = ? AND status NOT IN ('COMPLETED','CANCELLED')`).bind(plan.flight_id).all<Record<string, any>>();
      for (const job of jobs.results) {
        const age = minutesBetween(asOf, job.last_location_at);
        if (age > 30) {
          const red = age > 60;
          inferredColor = red ? 'RED' : inferredColor === 'RED' ? 'RED' : 'YELLOW';
          await db.prepare(`UPDATE transport_jobs SET health_state = ?, updated_at = ? WHERE transport_job_id = ?`)
            .bind(red ? 'RED' : 'YELLOW', asOf, job.transport_job_id).run();
          created.push(await createControlTask(db, {
            tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'LOCATION_CONTACT',
            objectType: 'TransportJob', objectId: job.transport_job_id, ownerRole: 'A2_DOMESTIC_TRUCK_CONTROLLER',
            severity: red ? 'CRITICAL' : 'WARNING', dueAt: asOf, sourceFactAt: job.last_location_at,
            reasonCode: red ? 'GPS_STALE_OVER_60_MINUTES' : 'GPS_STALE_30_TO_60_MINUTES', details: { location_age_minutes: age, manual_fallback_allowed: true }
          }));
        }
      }

      const borders = await db.prepare(`SELECT border_operation_id, last_external_status_at, status FROM border_operations WHERE operation_control_plan_id = ? AND status NOT IN ('DEPARTED_DOSTYK','CANCELLED')`).bind(plan.operation_control_plan_id).all<Record<string, any>>();
      for (const border of borders.results) {
        const age = minutesBetween(asOf, border.last_external_status_at);
        if (age > 60) {
          inferredColor = 'RED';
          await db.prepare(`UPDATE border_operations SET health_color = 'RED', updated_at = ? WHERE border_operation_id = ?`).bind(asOf, border.border_operation_id).run();
          created.push(await createControlTask(db, {
            tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'PORT_STATUS_CONFIRMATION',
            objectType: 'BorderOperation', objectId: border.border_operation_id, ownerRole: 'A3_CROSS_BORDER_CONTROLLER', severity: 'CRITICAL',
            dueAt: asOf, sourceFactAt: border.last_external_status_at, reasonCode: 'BORDER_STATUS_STALE', details: { status_age_minutes: age, manual_fallback_allowed: true }
          }));
        }
      }

      const signals = await db.prepare(`SELECT * FROM control_input_signals WHERE operation_control_plan_id = ? AND status = 'PENDING_RECORD' AND must_record_by < ?`).bind(plan.operation_control_plan_id, asOf).all<Record<string, any>>();
      for (const signal of signals.results) {
        inferredColor = inferredColor === 'RED' ? 'RED' : 'YELLOW';
        await db.prepare(`UPDATE control_input_signals SET status = 'OVERDUE' WHERE control_input_signal_id = ?`).bind(signal.control_input_signal_id).run();
        created.push(await createControlTask(db, {
          tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'DECISION_BACKFILL',
          objectType: 'ControlInputSignal', objectId: signal.control_input_signal_id, ownerRole: 'OCC_DM', severity: 'WARNING',
          dueAt: signal.must_record_by, sourceFactAt: signal.occurred_at, reasonCode: 'DECISION_RECORD_OVERDUE', details: { blocks_exception_gate_closure: true }
        }));
      }

      const cadenceMinutes = inferredColor === 'BLUE' ? 120 : 60;
      const lastUpdate = await db.prepare(`SELECT MAX(created_at) AS last_update_at FROM control_tasks WHERE operation_control_plan_id = ? AND task_type = 'STATUS_UPDATE'`).bind(plan.operation_control_plan_id).first<{ last_update_at: string | null }>();
      const cadenceAnchor = lastUpdate?.last_update_at ?? plan.last_calculated_at ?? plan.created_at;
      if (minutesBetween(asOf, cadenceAnchor) >= cadenceMinutes) {
        created.push(await createControlTask(db, {
          tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'STATUS_UPDATE', objectType: 'OperationControlPlan',
          objectId: plan.operation_control_plan_id, ownerRole: ({
            A1: 'A1_CARGO_CONTROLLER', A2: 'A2_DOMESTIC_TRUCK_CONTROLLER', A3: 'A3_CROSS_BORDER_CONTROLLER',
            B1: 'B1_TAS_STATION_CONTROLLER', B2: 'B2_FLIGHT_MONITOR', OBI: 'OBI_OVERSEAS_INTERFACE'
          } as Record<string, string>)[plan.active_control_segment] ?? 'OCC_DM',
          severity: inferredColor === 'RED' ? 'CRITICAL' : inferredColor === 'YELLOW' ? 'WARNING' : 'INFO', dueAt: asOf,
          reasonCode: `${inferredColor}_STATUS_CADENCE`, details: { cadence_minutes: cadenceMinutes }
        }));
      }

      if (inferredColor === 'RED') {
        created.push(await createControlTask(db, { tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'INCIDENT_ACK', objectType: 'OperationControlPlan', objectId: plan.operation_control_plan_id, ownerRole: 'OCC_DM', severity: 'CRITICAL', dueAt: new Date(new Date(asOf).getTime() + 15 * 60_000).toISOString(), reasonCode: 'RED_ACK_WITHIN_15_MINUTES' }));
        created.push(await createControlTask(db, { tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'INCIDENT_FIRST_REPORT', objectType: 'OperationControlPlan', objectId: plan.operation_control_plan_id, ownerRole: 'OCC_DM', severity: 'CRITICAL', dueAt: new Date(new Date(asOf).getTime() + 30 * 60_000).toISOString(), reasonCode: 'RED_FIRST_REPORT_WITHIN_30_MINUTES' }));
        created.push(await createControlTask(db, { tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'PROFESSIONAL_SUPPORT_ACTIVATION', objectType: 'OperationControlPlan', objectId: plan.operation_control_plan_id, ownerRole: 'OCC_DM', severity: 'CRITICAL', dueAt: asOf, reasonCode: 'RED_SUPPORT_AND_DQC_REQUIRED', details: { required_roles: ['DQC_DATA_QUALITY_CONTROLLER', 'PROFESSIONAL_SUPPORT'], temporary_permission_required: true } }));
      } else if (inferredColor === 'YELLOW') {
        created.push(await createControlTask(db, { tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'BACKUP_ACTIVATION', objectType: 'OperationControlPlan', objectId: plan.operation_control_plan_id, ownerRole: 'OCC_DM', severity: 'WARNING', dueAt: asOf, reasonCode: 'YELLOW_SEGMENT_BACKUP_REQUIRED', details: { segment: plan.active_control_segment, temporary_permission_required: true } }));
      }

      if (body.recovered_at) {
        const recoveredAt = iso(body.recovered_at);
        created.push(await createControlTask(db, { tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'INCIDENT_CLOSE', objectType: 'OperationControlPlan', objectId: plan.operation_control_plan_id, ownerRole: 'OCC_DM', severity: 'WARNING', dueAt: new Date(new Date(recoveredAt).getTime() + 2 * 60 * 60_000).toISOString(), sourceFactAt: recoveredAt, reasonCode: 'RECOVERY_CLOSE_WITHIN_2_HOURS' }));
      }

      const capacities = await db.prepare(`SELECT * FROM resource_capacity_plans WHERE operation_control_plan_id = ? ORDER BY created_at DESC LIMIT 20`).bind(plan.operation_control_plan_id).all<Record<string, any>>();
      for (const capacity of capacities.results) {
        if (Number(capacity.utilization_percent) > 90 || capacity.shortage_start_at) {
          created.push(await createControlTask(db, { tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'CAPACITY_AUGMENT', objectType: 'ResourceCapacityPlan', objectId: capacity.resource_capacity_plan_id, ownerRole: 'OCC_DM', severity: Number(capacity.utilization_percent) >= 100 ? 'CRITICAL' : 'WARNING', dueAt: capacity.shortage_start_at ?? asOf, reasonCode: 'PARALLEL_RESOURCE_CAPACITY_RISK', details: { utilization_percent: capacity.utilization_percent, shortage_resource_type: capacity.shortage_resource_type } }));
        }
      }

      if (body.flight_completed_at) {
        const completedAt = iso(body.flight_completed_at);
        const capaDueAt = new Date(new Date(completedAt).getTime() + 24 * 60 * 60_000).toISOString();
        created.push(await createControlTask(db, { tenantId: actor.tenantId, planId: plan.operation_control_plan_id, taskType: 'CAPA', objectType: 'OperationControlPlan', objectId: plan.operation_control_plan_id, ownerRole: 'DQC_DATA_QUALITY_CONTROLLER', severity: 'WARNING', dueAt: capaDueAt, sourceFactAt: completedAt, reasonCode: 'POST_FLIGHT_CAPA_DUE' }));
      }

      await db.prepare(`UPDATE operation_control_plans SET overall_health_color = ?, last_calculated_at = ?, updated_at = ? WHERE operation_control_plan_id = ?`)
        .bind(inferredColor, asOf, asOf, plan.operation_control_plan_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: plan.operation_control_plan_id, eventType: 'CONTROL_AUTOMATION_EVALUATED', idempotencyKey: idem, flightId: plan.flight_id, occurredAt: asOf, payload: { created_task_count: created.filter((item: any) => !item.duplicate).length, overall_health_color: inferredColor } });
      return response(c, { result: 'EVALUATED', as_of: asOf, overall_health_color: inferredColor, tasks: created });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/gate-reconciliations', requireRoles(controlRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { result: 'DUPLICATE', gate_reconciliation_id: (JSON.parse(duplicate.payload_json) as any).gate_reconciliation_id });
      const plan = await loadRequired<{ flight_id: string }>(db, `SELECT flight_id FROM operation_control_plans WHERE operation_control_plan_id = ?`, [c.req.param('id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      const gateCode = requiredText(body, 'gate_code');
      const result = evaluateGate(gateCode, body);
      const status = result.pass ? 'PASS' : 'BLOCKED';
      const hash = await sha256Hex(canonicalJson({ gate_code: gateCode, input: body, result, rule_version: 'V14-GATES-1' }));
      const checkId = `GREC-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO gate_reconciliation_checks (
           gate_reconciliation_id, tenant_id, operation_control_plan_id, gate_code,
           status, input_json, result_json, deterministic_hash, checked_by, checked_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(checkId, actor.tenantId, c.req.param('id'), gateCode, status, JSON.stringify(body), JSON.stringify(result), hash, actor.userId, now).run();
      if (status === 'BLOCKED') await db.prepare(`UPDATE operation_control_plans SET overall_health_color = 'RED', updated_at = ? WHERE operation_control_plan_id = ?`).bind(now, c.req.param('id')).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: c.req.param('id'), eventType: 'CONTROL_GATE_RECONCILED', eventAction: gateCode, idempotencyKey: idem, flightId: plan.flight_id, payload: { gate_reconciliation_id: checkId, status, deterministic_hash: hash } });
      return response(c, { result: status, gate_reconciliation_id: checkId, checks: result, deterministic_hash: hash }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/flights/:flight_id/label-ledgers', requireRoles(['B1_TAS_STATION_CONTROLLER', 'DQC_DATA_QUALITY_CONTROLLER', 'platform_admin']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadRequired<{ operation_control_plan_id: string }>(db, `SELECT operation_control_plan_id FROM operation_control_plans WHERE flight_id = ?`, [c.req.param('flight_id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      const maintainedBy = optionalText(body, 'maintained_by') ?? actor.userId; const approvedBy = optionalText(body, 'approved_by');
      if (approvedBy && approvedBy === maintainedBy) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Label maintainer and approver must differ');
      const result = evaluateGate('LABEL_ACCOUNTING', body); const status = result.pass ? 'PASS' : 'BLOCKED';
      if (status === 'PASS' && (!approvedBy || stringArray(body, 'evidence_ids').length === 0)) {
        throw new V14OperationError(409, 'LABEL_ACCOUNTING_EVIDENCE_INCOMPLETE', 'Passing label accounting requires independent approval and evidence');
      }
      const version = await db.prepare(`SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version FROM flight_label_ledgers WHERE flight_id = ?`).bind(c.req.param('flight_id')).first<{ next_version: number }>();
      const ledgerId = `LABEL-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO flight_label_ledgers (
           label_ledger_id, tenant_id, flight_id, operation_control_plan_id, printed_count,
           used_count, void_count, remaining_count, status, evidence_refs_json,
           maintained_by, approved_by, version_no
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(ledgerId, actor.tenantId, c.req.param('flight_id'), plan.operation_control_plan_id,
        integerValue(body, 'printed_count'), integerValue(body, 'used_count'), integerValue(body, 'void_count'),
        integerValue(body, 'remaining_count'), status, JSON.stringify(stringArray(body, 'evidence_ids')),
        maintainedBy, approvedBy, Number(version?.next_version ?? 1)).run();
      await appendOperationEvent(db, actor, { aggregateType: 'Flight', aggregateId: c.req.param('flight_id'), eventType: 'LABEL_ACCOUNTING_RECONCILED', idempotencyKey: idem, flightId: c.req.param('flight_id'), payload: { label_ledger_id: ledgerId, status, ...result } });
      return response(c, { result: status, label_ledger_id: ledgerId, checks: result }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/change-requests', requireRoles(controlRoles), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { result: 'DUPLICATE', change_request_id: (JSON.parse(duplicate.payload_json) as any).change_request_id });
      const changeId = `CHG-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO change_requests (
           change_request_id, tenant_id, operation_control_plan_id, related_object_type,
           related_object_id, change_type, before_json, after_json, reason, requested_by, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`
      ).bind(changeId, actor.tenantId, optionalText(body, 'operation_control_plan_id'), requiredText(body, 'related_object_type'), requiredText(body, 'related_object_id'), requiredText(body, 'change_type'), JSON.stringify(body.before ?? {}), JSON.stringify(body.after ?? {}), requiredText(body, 'reason'), actor.userId).run();
      await appendOperationEvent(db, actor, { aggregateType: 'ChangeRequest', aggregateId: changeId, eventType: 'CHANGE_REQUEST_CREATED', idempotencyKey: idem, payload: { change_request_id: changeId, related_object_type: requiredText(body, 'related_object_type'), related_object_id: requiredText(body, 'related_object_id') } });
      return response(c, { result: 'PENDING', change_request_id: changeId }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/change-requests/:id/approve', requireRoles(['platform_admin', 'OCC_DM', 'DQC_DATA_QUALITY_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const change = await loadRequired<Record<string, any>>(db, `SELECT * FROM change_requests WHERE change_request_id = ?`, [c.req.param('id')], 'CHANGE_REQUEST_NOT_FOUND', 'Change request was not found');
      if (change.status !== 'PENDING') throw new V14OperationError(409, 'CHANGE_REQUEST_NOT_PENDING', 'Change request is not pending');
      if (change.requested_by === actor.userId) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Change requester and approver must differ');
      const now = new Date().toISOString();
      await db.prepare(`UPDATE change_requests SET status = 'APPROVED', approved_by = ?, approved_at = ? WHERE change_request_id = ?`).bind(actor.userId, now, change.change_request_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'ChangeRequest', aggregateId: change.change_request_id, eventType: 'CHANGE_REQUEST_APPROVED', idempotencyKey: idem, payload: { approved_by: actor.userId } });
      return response(c, { result: 'APPROVED', change_request_id: change.change_request_id });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/flights/:flight_id/cargo-master-record/changes', requireRoles(['B1_TAS_STATION_CONTROLLER', 'DQC_DATA_QUALITY_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const current = await loadRequired<Record<string, any>>(db, `SELECT * FROM flight_cargo_master_records WHERE flight_id = ? AND active_flag = 1 ORDER BY record_version DESC LIMIT 1`, [c.req.param('flight_id')], 'CARGO_MASTER_NOT_FOUND', 'Active cargo master record was not found');
      const change = await loadRequired<Record<string, any>>(db, `SELECT * FROM change_requests WHERE change_request_id = ?`, [requiredText(body, 'change_request_id')], 'CHANGE_REQUEST_NOT_FOUND', 'Approved change request is required');
      if (change.status !== 'APPROVED' || change.related_object_type !== 'FlightCargoMasterRecord' || change.related_object_id !== current.flight_cargo_master_record_id) {
        throw new V14OperationError(409, 'FROZEN_RECORD_CHANGE_REQUEST_REQUIRED', 'Frozen cargo master changes require an approved matching ChangeRequest');
      }
      const nextVersion = Number(current.record_version) + 1; const recordId = `FCMR-${crypto.randomUUID()}`; const now = new Date().toISOString();
      const data = {
        planned_pieces: integerValue(body, 'planned_pieces', current.planned_pieces),
        planned_weight_kg: numberValue(body, 'planned_weight_kg', current.planned_weight_kg),
        tas_received_pieces: integerValue(body, 'tas_received_pieces', current.tas_received_pieces),
        loaded_pieces: integerValue(body, 'loaded_pieces', current.loaded_pieces),
        uld_ids: Array.isArray(body.uld_ids) ? body.uld_ids : JSON.parse(current.uld_ids_json || '[]'),
        manifest_document_id: optionalText(body, 'manifest_document_id') ?? current.manifest_document_id
      };
      const hash = await sha256Hex(canonicalJson(data));
      if (!db.batch) throw new V14OperationError(500, 'ATOMIC_BATCH_UNAVAILABLE', 'Atomic D1 batch support is required');
      await db.batch([
        db.prepare(`UPDATE flight_cargo_master_records SET active_flag = 0, record_status = 'SUPERSEDED' WHERE flight_cargo_master_record_id = ?`).bind(current.flight_cargo_master_record_id),
        db.prepare(
          `INSERT INTO flight_cargo_master_records (
             flight_cargo_master_record_id, tenant_id, flight_id, operation_control_plan_id,
             record_version, record_status, planned_pieces, planned_weight_kg, tas_received_pieces,
             tas_received_weight_kg, security_entered_pieces, security_passed_pieces,
             security_held_pieces, security_returned_pieces, buildup_pieces,
             handed_to_airline_pieces, loaded_pieces, uld_ids_json, cba_version_id,
             manifest_document_id, exception_ids_json, change_request_ids_json,
             maintained_by, reviewed_by, source_event_refs_json, record_hash, active_flag
           ) VALUES (?, ?, ?, ?, ?, 'WORKING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
        ).bind(recordId, current.tenant_id, current.flight_id, current.operation_control_plan_id, nextVersion,
          data.planned_pieces, data.planned_weight_kg, data.tas_received_pieces, current.tas_received_weight_kg,
          current.security_entered_pieces, current.security_passed_pieces, current.security_held_pieces,
          current.security_returned_pieces, current.buildup_pieces, current.handed_to_airline_pieces,
          data.loaded_pieces, JSON.stringify(data.uld_ids), current.cba_version_id, data.manifest_document_id,
          current.exception_ids_json, JSON.stringify([change.change_request_id]), actor.userId,
          optionalText(body, 'reviewed_by'), current.source_event_refs_json, hash),
        db.prepare(`UPDATE change_requests SET status = 'APPLIED' WHERE change_request_id = ?`).bind(change.change_request_id)
      ]);
      await appendOperationEvent(db, actor, { aggregateType: 'FlightCargoMasterRecord', aggregateId: recordId, eventType: 'FROZEN_CARGO_MASTER_CHANGED', idempotencyKey: idem, flightId: current.flight_id, payload: { supersedes_record_id: current.flight_cargo_master_record_id, change_request_id: change.change_request_id, record_version: nextVersion, record_hash: hash } });
      return response(c, { result: 'WORKING', flight_cargo_master_record_id: recordId, record_version: nextVersion, change_request_status: 'APPLIED', record_hash: hash }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/resource-capacity-plans', requireRoles(['platform_admin', 'OCC_DM', 'DQC_DATA_QUALITY_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadRequired<Record<string, any>>(db, `SELECT active_plan_version_id, flight_id FROM operation_control_plans WHERE operation_control_plan_id = ?`, [c.req.param('id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      if (!plan.active_plan_version_id) throw new V14OperationError(409, 'PLAN_VERSION_CONFLICT', 'Active plan version is required');
      const capacity = numberValue(body, 'capacity_per_hour'); const workload = numberValue(body, 'forecast_workload_per_hour');
      if (capacity <= 0) throw new V14OperationError(400, 'VALIDATION_ERROR', 'capacity_per_hour must be positive');
      const utilization = Math.round((workload / capacity) * 10_000) / 100;
      const color = utilization >= 100 ? 'RED' : utilization > 90 ? 'YELLOW' : 'BLUE';
      const capacityId = `CAP-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO resource_capacity_plans (
           resource_capacity_plan_id, operation_control_plan_id, plan_version_id,
           hourly_plan_json, resources_json, capacity_per_hour, forecast_workload_per_hour,
           utilization_percent, shortage_start_at, shortage_resource_type, backup_plan_ref,
           resource_health_color, approved_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(capacityId, c.req.param('id'), plan.active_plan_version_id, JSON.stringify(body.hourly_plan ?? {}), JSON.stringify(body.resources ?? {}), capacity, workload, utilization, optionalText(body, 'shortage_start_at'), optionalText(body, 'shortage_resource_type'), optionalText(body, 'backup_plan_ref'), color, optionalText(body, 'approved_by')).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: c.req.param('id'), eventType: 'RESOURCE_CAPACITY_PLANNED', idempotencyKey: idem, flightId: plan.flight_id, payload: { resource_capacity_plan_id: capacityId, utilization_percent: utilization, resource_health_color: color } });
      return response(c, { result: color, resource_capacity_plan_id: capacityId, utilization_percent: utilization, augment_required: utilization > 90 }, 201);
    } catch (error) { return handleError(c, error); }
  });
}
