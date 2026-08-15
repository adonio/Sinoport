import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { ApiApp } from '../index';
import { canonicalJson, sha256Hex } from '../lib/integration-sync';
import {
  appendOperationEvent,
  assertOccPermission,
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
const REQUIRED_BUSINESS_INPUTS = [
  'CAPACITY_PLAN_RECEIVED', 'BOOKING_INPUT_RECEIVED', 'ACCEPTANCE_DECISION_RECEIVED',
  'BOOKING_CONFIRMED', 'CARGO_VOLUME_UPDATE', 'WAREHOUSE_ARRIVAL_FORECAST'
];

function handleError(c: any, error: unknown) {
  if (error instanceof V14OperationError) return jsonError(c, error.status, error.code, error.message, error.details);
  console.error('[v14-control-plans]', error);
  return jsonError(c, 500, 'CONTROL_PLAN_OPERATION_FAILED', error instanceof Error ? error.message : 'Operation failed');
}

function response(c: any, data: Record<string, unknown>, status: 200 | 201 = 200) {
  return c.json({ request_id: requestId(c.req.raw.headers), ...data }, status);
}

function addMinutes(iso: string, minutes: number) {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) throw new V14OperationError(400, 'VALIDATION_ERROR', 'ETD must be a valid ISO 8601 timestamp');
  return new Date(time + minutes * 60_000).toISOString();
}

type PlanContext = {
  operation_control_plan_id: string;
  tenant_id: string;
  flight_id: string;
  route_template_id: string;
  baseline_etd: string;
  current_operating_etd: string;
  active_plan_version_id: string | null;
  active_control_segment: string;
  row_version: number;
  status: string;
  origin_start_at: string | null;
  pre_carriage_target_minutes: number;
  pre_carriage_hard_limit_minutes: number;
  internal_product_target_minutes: number | null;
  customer_commitment_minutes: number | null;
};

async function loadPlan(db: any, id: string) {
  return loadRequired<PlanContext>(db, `SELECT * FROM operation_control_plans WHERE operation_control_plan_id = ?`, [id], 'CONTROL_PLAN_NOT_FOUND', 'Operation control plan was not found');
}

async function instantiateMilestones(db: any, plan: PlanContext, planVersionId: string, templateVersion: number) {
  const definitions = await db.prepare(
    `SELECT milestone_definition_id, offset_minutes FROM milestone_definitions
     WHERE route_template_id = ? AND template_version = ? AND validation_status <> 'RETIRED'
       AND NOT EXISTS (
         SELECT 1 FROM milestone_instances prior
         WHERE prior.operation_control_plan_id = ?
           AND prior.milestone_definition_id = milestone_definitions.milestone_definition_id
           AND prior.status IN ('COMPLETED','CLOSED','WAIVED')
       )
     ORDER BY sequence`
  ).bind(plan.route_template_id, templateVersion, plan.operation_control_plan_id).all() as {
    results: Array<{ milestone_definition_id: string; offset_minutes: number }>;
  };
  for (const definition of definitions.results) {
    await db.prepare(
      `INSERT INTO milestone_instances (
         milestone_instance_id, operation_control_plan_id, plan_version_id, milestone_definition_id,
         baseline_planned_at, operating_planned_at, status, health_color
       ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 'UNKNOWN')`
    ).bind(
      `MSI-${crypto.randomUUID()}`, plan.operation_control_plan_id, planVersionId, definition.milestone_definition_id,
      addMinutes(plan.baseline_etd, definition.offset_minutes), addMinutes(plan.current_operating_etd, definition.offset_minutes)
    ).run();
  }
  return definitions.results.length;
}

export function registerV14ControlPlanRoutes(app: ApiApp, requireRoles: RequireRoles) {
  const occView: RoleCode[] = [
    'platform_admin', 'OCC_DM', 'A1_CARGO_CONTROLLER', 'A2_DOMESTIC_TRUCK_CONTROLLER',
    'A3_CROSS_BORDER_CONTROLLER', 'B1_TAS_STATION_CONTROLLER', 'B2_FLIGHT_MONITOR',
    'OBI_OVERSEAS_INTERFACE', 'DQC_DATA_QUALITY_CONTROLLER'
  ];

  app.get('/api/v1/flights/:flight_id/business-handover', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const events = await db.prepare(`SELECT * FROM business_handover_events WHERE flight_id = ? ORDER BY occurred_at`).bind(c.req.param('flight_id')).all<{ event_type: string }>();
      const latestPool = await db.prepare(`SELECT * FROM cargo_pool_versions WHERE flight_id = ? ORDER BY version_no DESC LIMIT 1`).bind(c.req.param('flight_id')).first();
      const received = new Set(events.results.map((event) => event.event_type));
      const missing = REQUIRED_BUSINESS_INPUTS.filter((eventType) => !received.has(eventType));
      return response(c, { flight_id: c.req.param('flight_id'), readiness_status: missing.length === 0 && (latestPool as any)?.status === 'PUBLISHED' ? 'READY' : 'INCOMPLETE', missing_event_types: missing, cargo_pool: latestPool, events: events.results });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/flights/:flight_id/business-handover/events', requireRoles(['platform_admin', 'BUSINESS', 'A1_CARGO_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { result: 'DUPLICATE', business_handover_event_id: (JSON.parse(duplicate.payload_json) as any).business_handover_event_id });
      await loadRequired(db, `SELECT flight_id FROM flights WHERE flight_id = ?`, [c.req.param('flight_id')], 'FLIGHT_NOT_FOUND', 'Flight was not found');
      const eventId = `BHE-${crypto.randomUUID()}`; const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      await db.prepare(
        `INSERT INTO business_handover_events (
           business_handover_event_id, tenant_id, flight_id, event_type, occurred_at,
           source_party_id, status, payload_json, evidence_refs_json, submitted_by
         ) VALUES (?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?)`
      ).bind(eventId, actor.tenantId, c.req.param('flight_id'), requiredText(body, 'event_type'), occurredAt,
        optionalText(body, 'source_party_id'), JSON.stringify(body.payload ?? {}), JSON.stringify(stringArray(body, 'evidence_ids')), actor.userId).run();
      await appendOperationEvent(db, actor, { aggregateType: 'Flight', aggregateId: c.req.param('flight_id'), eventType: 'BUSINESS_HANDOVER_INPUT_RECEIVED', eventAction: requiredText(body, 'event_type'), idempotencyKey: idem, flightId: c.req.param('flight_id'), occurredAt, payload: { business_handover_event_id: eventId } });
      return response(c, { result: 'RECEIVED', business_handover_event_id: eventId }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/flights/:flight_id/cargo-pool/versions', requireRoles(['platform_admin', 'BUSINESS', 'A1_CARGO_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>(); const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const version = await db.prepare(`SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version FROM cargo_pool_versions WHERE flight_id = ?`).bind(c.req.param('flight_id')).first<{ next_version: number }>();
      const previous = await db.prepare(`SELECT cargo_pool_version_id FROM cargo_pool_versions WHERE flight_id = ? AND status = 'PUBLISHED' ORDER BY version_no DESC LIMIT 1`).bind(c.req.param('flight_id')).first<{ cargo_pool_version_id: string }>();
      const requestedBy = optionalText(body, 'requested_by') ?? actor.userId;
      const publish = body.publish === true;
      const approvedBy = publish ? optionalText(body, 'approved_by') : null;
      if (publish && (!approvedBy || approvedBy === requestedBy)) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Published cargo pool requires a distinct approver');
      if (publish && previous) await db.prepare(`UPDATE cargo_pool_versions SET status = 'SUPERSEDED' WHERE cargo_pool_version_id = ?`).bind(previous.cargo_pool_version_id).run();
      const poolId = `POOL-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO cargo_pool_versions (
           cargo_pool_version_id, tenant_id, flight_id, version_no, status, total_shipments,
           total_pieces, total_weight_kg, shipment_refs_json, source_event_refs_json,
           change_reason, requested_by, approved_by, published_at, supersedes_version_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(poolId, actor.tenantId, c.req.param('flight_id'), Number(version?.next_version ?? 1), publish ? 'PUBLISHED' : 'DRAFT',
        Math.max(0, integerValue(body, 'total_shipments')), Math.max(0, integerValue(body, 'total_pieces')),
        Math.max(0, numberValue(body, 'total_weight_kg')), JSON.stringify(body.shipment_refs ?? []),
        JSON.stringify(body.source_event_refs ?? []), optionalText(body, 'change_reason'), requestedBy, approvedBy,
        publish ? now : null, previous?.cargo_pool_version_id ?? null).run();
      await appendOperationEvent(db, actor, { aggregateType: 'Flight', aggregateId: c.req.param('flight_id'), eventType: publish ? 'CARGO_POOL_PUBLISHED' : 'CARGO_POOL_VERSION_CREATED', idempotencyKey: idem, flightId: c.req.param('flight_id'), payload: { cargo_pool_version_id: poolId, version_no: Number(version?.next_version ?? 1) } });
      return response(c, { result: publish ? 'PUBLISHED' : 'DRAFT', cargo_pool_version_id: poolId, version_no: Number(version?.next_version ?? 1) }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/flights/:flight_id/cargo-pool/input-gate', requireRoles(['platform_admin', 'A1_CARGO_CONTROLLER', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const events = await db.prepare(`SELECT DISTINCT event_type FROM business_handover_events WHERE flight_id = ? AND status = 'RECEIVED'`).bind(c.req.param('flight_id')).all<{ event_type: string }>();
      const received = new Set(events.results.map((event) => event.event_type));
      const missing = REQUIRED_BUSINESS_INPUTS.filter((eventType) => !received.has(eventType));
      const pool = await db.prepare(`SELECT cargo_pool_version_id FROM cargo_pool_versions WHERE flight_id = ? AND status = 'PUBLISHED' ORDER BY version_no DESC LIMIT 1`).bind(c.req.param('flight_id')).first();
      if (!pool) missing.push('PUBLISHED_CARGO_POOL');
      return response(c, { gate_code: 'OCC_CARGO_POOL_INPUT_GATE', decision: missing.length === 0 ? 'PASS' : 'BLOCKED', missing_inputs: missing, note: 'This gate validates operational input completeness only and does not approve commercial terms.', requested_context: body });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/route-templates', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const status = String(c.req.query('status') ?? '').trim();
      const rows = await db.prepare(`SELECT * FROM route_templates WHERE (? = '' OR status = ?) ORDER BY route_template_code, version_no DESC`).bind(status, status).all();
      return response(c, { items: rows.results, total: rows.results.length });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/route-templates/:id/versions', requireRoles(['platform_admin', 'OCC_DM', 'DQC_DATA_QUALITY_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const source = await loadRequired<Record<string, any>>(db, `SELECT * FROM route_templates WHERE route_template_id = ?`, [c.req.param('id')], 'ROUTE_TEMPLATE_NOT_FOUND', 'Route template was not found');
      const newCn = optionalText(body, 'cn_exit_port_code') ?? source.cn_exit_port_code;
      const newKz = optionalText(body, 'kz_entry_port_code') ?? source.kz_entry_port_code;
      if (newCn !== 'ALASHANKOU' || newKz !== 'DOSTYK') throw new V14OperationError(409, 'ALTERNATE_ROUTE_TEMPLATE_REQUIRED', 'Another port requires a separately approved route template');
      const version = await db.prepare(`SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version FROM route_templates WHERE route_template_code = ?`).bind(source.route_template_code).first<{ next_version: number }>();
      const routeId = `ROUTE-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO route_templates (
           route_template_id, route_template_code, version_no, status, origin_code, destination_code,
           origin_airport_code, cn_exit_port_code, kz_entry_port_code, port_pair_code,
           alternate_port_allowed, domestic_corridor_codes_json, kz_corridor_codes_json,
           schedule_source_status, schedule_approval_status, distance_validation_status,
           geofence_validation_status, operation_mode_validation_status, effective_from, effective_to,
           supersedes_route_template_id, source_document_refs_json, approval_ref, created_by
         ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(routeId, source.route_template_code, Number(version?.next_version ?? source.version_no + 1), source.origin_code,
        source.destination_code, source.origin_airport_code, newCn, newKz, 'ALASHANKOU_DOSTYK',
        source.domestic_corridor_codes_json, source.kz_corridor_codes_json,
        optionalText(body, 'schedule_source_status') ?? 'OCC_MANUAL_BASELINE',
        optionalText(body, 'distance_validation_status') ?? source.distance_validation_status,
        optionalText(body, 'geofence_validation_status') ?? source.geofence_validation_status,
        optionalText(body, 'operation_mode_validation_status') ?? source.operation_mode_validation_status,
        optionalText(body, 'effective_from'), optionalText(body, 'effective_to'), source.route_template_id,
        JSON.stringify(body.source_document_refs ?? []), optionalText(body, 'approval_ref'), actor.userId).run();
      const checkpoints = await db.prepare(`SELECT * FROM checkpoint_templates WHERE route_template_id = ? AND route_template_version = ? ORDER BY sequence`).bind(source.route_template_id, source.version_no).all<Record<string, any>>();
      for (const checkpoint of checkpoints.results) {
        await db.prepare(
          `INSERT INTO checkpoint_templates (
             checkpoint_template_id, route_template_id, route_template_version, checkpoint_code,
             name_zh, name_en, sequence, checkpoint_type, location_json, timezone,
             planned_offset_minutes, warning_before_minutes, late_after_minutes, stale_location_minutes,
             confirmation_policy, required_fields_json, required_evidence_types_json,
             blocking_policy, escalation_rule_json, active_from, active_to
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(`CP-${crypto.randomUUID()}`, routeId, Number(version?.next_version ?? source.version_no + 1), checkpoint.checkpoint_code,
          checkpoint.name_zh, checkpoint.name_en, checkpoint.sequence, checkpoint.checkpoint_type,
          checkpoint.location_json, checkpoint.timezone, checkpoint.planned_offset_minutes,
          checkpoint.warning_before_minutes, checkpoint.late_after_minutes, checkpoint.stale_location_minutes,
          checkpoint.confirmation_policy, checkpoint.required_fields_json, checkpoint.required_evidence_types_json,
          checkpoint.blocking_policy, checkpoint.escalation_rule_json, checkpoint.active_from, checkpoint.active_to).run();
      }
      await appendOperationEvent(db, actor, { aggregateType: 'RouteTemplate', aggregateId: routeId, eventType: 'ROUTE_TEMPLATE_VERSION_CREATED', idempotencyKey: idem, payload: { supersedes_route_template_id: source.route_template_id } });
      return response(c, { result: 'DRAFT', route_template_id: routeId, version_no: Number(version?.next_version ?? source.version_no + 1), checkpoint_count: checkpoints.results.length }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/route-templates/:id/versions/:version_id/publish', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const route = await loadRequired<Record<string, any>>(db, `SELECT * FROM route_templates WHERE route_template_id = ?`, [c.req.param('version_id')], 'ROUTE_TEMPLATE_NOT_FOUND', 'Route template version was not found');
      if (route.cn_exit_port_code !== 'ALASHANKOU' || route.kz_entry_port_code !== 'DOSTYK') throw new V14OperationError(409, 'ALTERNATE_ROUTE_TEMPLATE_REQUIRED', 'Route port pair is invalid for V2');
      const missingTimezone = await db.prepare(`SELECT checkpoint_code FROM checkpoint_templates WHERE route_template_id = ? AND (timezone IS NULL OR timezone = '') LIMIT 1`).bind(route.route_template_id).first();
      if (missingTimezone) throw new V14OperationError(409, 'PORT_TIMEZONE_MISSING', 'All route checkpoints require IANA timezones');
      const approvedBy = optionalText(body, 'approved_by');
      if (!approvedBy || approvedBy === actor.userId) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Route reviewer and publisher must be different');
      const production = body.production_approval === true;
      if (production && [route.distance_validation_status, route.geofence_validation_status, route.operation_mode_validation_status].some((status) => status !== 'CONFIRMED')) {
        throw new V14OperationError(409, 'ROUTE_SCHEDULE_UNVERIFIED', 'Distance, geofence and operation mode must be confirmed for production');
      }
      await db.prepare(`UPDATE route_templates SET status = 'PUBLISHED', schedule_approval_status = ?, approval_ref = ?, reviewed_by = ?, published_by = ?, published_at = ? WHERE route_template_id = ?`)
        .bind(production ? 'APPROVED_FOR_PRODUCTION' : 'APPROVED_FOR_PILOT', requiredText(body, 'approval_ref'), approvedBy, actor.userId, new Date().toISOString(), route.route_template_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'RouteTemplate', aggregateId: route.route_template_id, eventType: 'ROUTE_TEMPLATE_PUBLISHED', idempotencyKey: idem, payload: { production_approval: production } });
      return response(c, { result: 'PUBLISHED', approval_status: production ? 'APPROVED_FOR_PRODUCTION' : 'APPROVED_FOR_PILOT' });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/route-templates/:id/retire', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body);
      if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      await loadRequired(db, `SELECT route_template_id FROM route_templates WHERE route_template_id = ?`, [c.req.param('id')], 'ROUTE_TEMPLATE_NOT_FOUND', 'Route template was not found');
      await db.prepare(`UPDATE route_templates SET status = 'RETIRED', schedule_approval_status = 'RETIRED', retired_at = ? WHERE route_template_id = ?`).bind(new Date().toISOString(), c.req.param('id')).run();
      await appendOperationEvent(db, actor, { aggregateType: 'RouteTemplate', aggregateId: c.req.param('id'), eventType: 'ROUTE_TEMPLATE_RETIRED', idempotencyKey: idem, reasonCode: optionalText(body, 'reason'), payload: body });
      return response(c, { result: 'RETIRED' });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/operation-control-plans', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const status = String(c.req.query('status') ?? '').trim();
      const rows = await db.prepare(
        `SELECT p.*, f.flight_no, f.flight_date, r.route_template_code
         FROM operation_control_plans p JOIN flights f ON f.flight_id = p.flight_id
         JOIN route_templates r ON r.route_template_id = p.route_template_id
         WHERE (? = '' OR p.status = ?) ORDER BY p.updated_at DESC LIMIT 100`
      ).bind(status, status).all();
      return response(c, { items: rows.results, total: rows.results.length });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/operation-control-plans/options', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const [routes, flights] = await Promise.all([
        db.prepare(
          `SELECT route_template_id, route_template_code, version_no, status,
                  origin_code, destination_code, schedule_source_status,
                  schedule_approval_status
           FROM route_templates
           ORDER BY CASE WHEN route_template_code = 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2' THEN 0 ELSE 1 END,
                    version_no DESC`
        ).all(),
        db.prepare(
          `SELECT f.flight_id, f.flight_no, f.flight_date, f.origin_code, f.destination_code,
                  f.std_at, f.etd_at, f.runtime_status, f.aircraft_type,
                  p.operation_control_plan_id, p.status AS control_plan_status
           FROM flights f
           LEFT JOIN operation_control_plans p
             ON p.flight_id = f.flight_id
            AND p.status NOT IN ('CANCELLED', 'CLOSED')
           WHERE f.origin_code = 'TAS' AND f.destination_code = 'LGG'
           ORDER BY COALESCE(f.etd_at, f.std_at, f.flight_date) DESC
           LIMIT 100`
        ).all()
      ]);
      const v2Route = (routes.results as Array<Record<string, unknown>>).find(
        (item) => item.route_template_code === 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2'
      );
      return response(c, {
        routes: routes.results,
        flights: flights.results,
        defaults: {
          route_template_code: 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2',
          flight_timezone: 'Asia/Tashkent',
          project_code: 'SINOport-V14-PILOT',
          source_approval_status: v2Route?.schedule_approval_status ?? 'PENDING_APPROVAL'
        }
      });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/flight-drafts', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) {
        const existing = await db.prepare(
          `SELECT flight_id, flight_no, flight_date, origin_code, destination_code, std_at, etd_at,
                  runtime_status, aircraft_type
           FROM flights WHERE flight_id = ?`
        ).bind(duplicate.aggregate_id).first();
        return response(c, { flight: existing, duplicate: true });
      }

      const flightNo = requiredText(body, 'flight_no').toUpperCase();
      const baselineEtd = requiredText(body, 'baseline_etd');
      const currentEtd = optionalText(body, 'current_operating_etd') ?? baselineEtd;
      addMinutes(baselineEtd, 0); addMinutes(currentEtd, 0);
      const flightDate = optionalText(body, 'flight_date') ?? baselineEtd.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(flightDate)) {
        throw new V14OperationError(400, 'VALIDATION_ERROR', 'flight_date must use YYYY-MM-DD');
      }

      const existing = await db.prepare(
        `SELECT flight_id, flight_no, flight_date
         FROM flights
         WHERE UPPER(flight_no) = ? AND flight_date = ?
           AND origin_code = 'TAS' AND destination_code = 'LGG'
         LIMIT 1`
      ).bind(flightNo, flightDate).first<Record<string, unknown>>();
      if (existing) {
        throw new V14OperationError(409, 'FLIGHT_ALREADY_EXISTS', 'The TAS-LGG flight already exists; select the existing flight instead', existing);
      }

      const now = new Date().toISOString();
      const flightId = `FLIGHT-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO stations (station_id, station_name, region, control_level, phase, created_at, updated_at)
         VALUES ('TAS', 'Tashkent International Airport', 'Central Asia', 'L1', 'v1.4-pilot', ?, ?)
         ON CONFLICT(station_id) DO NOTHING`
      ).bind(now, now).run();
      await db.prepare(
        `INSERT INTO flights (
           flight_id, station_id, flight_no, flight_date, origin_code, destination_code,
           std_at, etd_at, runtime_status, service_level, aircraft_type, notes, created_at, updated_at
         ) VALUES (?, 'TAS', ?, ?, 'TAS', 'LGG', ?, ?, 'Scheduled', 'P1', ?, ?, ?, ?)`
      ).bind(
        flightId, flightNo, flightDate, baselineEtd, currentEtd,
        optionalText(body, 'aircraft_type'), optionalText(body, 'notes') ?? 'Created from OCC control-plan wizard', now, now
      ).run();
      await appendOperationEvent(db, actor, {
        aggregateType: 'Flight', aggregateId: flightId, eventType: 'OCC_FLIGHT_DRAFT_CREATED',
        idempotencyKey: idem, flightId, stationId: 'TAS',
        payload: { flight_no: flightNo, flight_date: flightDate, origin_code: 'TAS', destination_code: 'LGG', baseline_etd: baselineEtd, current_operating_etd: currentEtd }
      });
      return response(c, {
        flight: {
          flight_id: flightId, flight_no: flightNo, flight_date: flightDate,
          origin_code: 'TAS', destination_code: 'LGG', std_at: baselineEtd,
          etd_at: currentEtd, runtime_status: 'Scheduled', aircraft_type: optionalText(body, 'aircraft_type')
        },
        duplicate: false
      }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans', requireRoles(['platform_admin', 'OCC_DM', 'A1_CARGO_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) return response(c, { operation_control_plan_id: duplicate.aggregate_id, duplicate: true });
      const flightId = requiredText(body, 'flight_id');
      await loadRequired(db, `SELECT flight_id FROM flights WHERE flight_id = ?`, [flightId], 'FLIGHT_NOT_FOUND', 'Flight was not found');
      const existingPlan = await db.prepare(
        `SELECT operation_control_plan_id, status
         FROM operation_control_plans
         WHERE flight_id = ? AND status NOT IN ('CANCELLED', 'CLOSED')
         LIMIT 1`
      ).bind(flightId).first<Record<string, unknown>>();
      if (existingPlan) {
        throw new V14OperationError(409, 'CONTROL_PLAN_ALREADY_EXISTS', 'The flight already has an open operation control plan', existingPlan);
      }
      const routeCode = optionalText(body, 'route_template_code') ?? 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2';
      const route = await loadRequired<{ route_template_id: string; version_no: number; status: string; schedule_source_status: string; schedule_approval_status: string }>(db,
        `SELECT route_template_id, version_no, status, schedule_source_status, schedule_approval_status FROM route_templates WHERE route_template_code = ? ORDER BY version_no DESC LIMIT 1`,
        [routeCode], 'ROUTE_TEMPLATE_NOT_FOUND', 'Route template was not found');
      if (route.status === 'RETIRED') throw new V14OperationError(409, 'RETIRED_ROUTE_TEMPLATE', 'Retired route cannot create a control plan');
      if (routeCode !== 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2') throw new V14OperationError(409, 'ALTERNATE_ROUTE_TEMPLATE_REQUIRED', 'P0 control plans require V2 route');
      if (body.production_mode === true && (route.status !== 'PUBLISHED' || route.schedule_approval_status !== 'APPROVED_FOR_PRODUCTION')) {
        throw new V14OperationError(409, 'OCC_MANUAL_APPROVAL_PENDING', 'Production plans require a published production-approved V2 baseline');
      }
      if (optionalText(body, 'product_start_event_type') === 'SZX_TRUCK_DEPARTED' && integerValue(body, 'internal_product_target_minutes') === 14400) {
        throw new V14OperationError(409, 'KPI_ANCHOR_CONFLICT', 'Product 240H cannot reuse the SZX departure anchor of PRE_CARRIAGE_TO_TAS_DEP');
      }
      const baselineEtd = requiredText(body, 'baseline_etd'); const currentEtd = optionalText(body, 'current_operating_etd') ?? baselineEtd;
      addMinutes(baselineEtd, 0); addMinutes(currentEtd, 0);
      const planId = `OCP-${crypto.randomUUID()}`; const versionId = `OPV-${crypto.randomUUID()}`; const now = new Date().toISOString();
      const plan: PlanContext = {
        operation_control_plan_id: planId, tenant_id: actor.tenantId, flight_id: flightId, route_template_id: route.route_template_id,
        baseline_etd: baselineEtd, current_operating_etd: currentEtd, active_plan_version_id: versionId,
        active_control_segment: 'A1', row_version: 1, status: 'DRAFT', origin_start_at: null,
        pre_carriage_target_minutes: 12960, pre_carriage_hard_limit_minutes: 14400,
        internal_product_target_minutes: integerValue(body, 'internal_product_target_minutes') || null,
        customer_commitment_minutes: integerValue(body, 'customer_commitment_minutes') || null
      };
      await db.prepare(
        `INSERT INTO operation_control_plans (
           operation_control_plan_id, tenant_id, project_code, flight_id, route_template_id,
           baseline_etd, current_operating_etd, flight_timezone, internal_product_target_minutes,
           customer_commitment_minutes, product_end_event_type, active_occ_dm_assignment_id,
           active_plan_version_id, status, overall_health_color, calculation_status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'UNKNOWN', 'PENDING', ?, ?)`
      ).bind(planId, actor.tenantId, optionalText(body, 'project_code') ?? 'SINOport-V14-PILOT', flightId, route.route_template_id,
        baselineEtd, currentEtd, optionalText(body, 'flight_timezone') ?? 'Asia/Tashkent',
        plan.internal_product_target_minutes, plan.customer_commitment_minutes, optionalText(body, 'product_end_event_type'),
        optionalText(body, 'occ_duty_manager_assignment_id'), versionId, now, now).run();
      await db.prepare(
        `INSERT INTO operation_control_plan_versions (
           plan_version_id, operation_control_plan_id, version_no, baseline_etd_snapshot,
           operating_etd_snapshot, route_template_version, kpi_rule_set_version,
           responsibility_rule_version, flight_duty_plan_version, source_status,
           source_approval_status, change_reason, source_ref, requested_by, frozen_baseline_flag,
           active_flag, active_from
         ) VALUES (?, ?, 1, ?, ?, ?, 'V14-KPI-1', 'V14-RBAC-1', ?, ?, ?, 'Initial plan', ?, ?, 1, 1, ?)`
      ).bind(versionId, planId, baselineEtd, currentEtd, route.version_no, integerValue(body, 'flight_duty_plan_version') || null,
        route.schedule_source_status, optionalText(body, 'source_approval_status') ?? route.schedule_approval_status,
        optionalText(body, 'source_ref'), actor.userId, now).run();
      const milestoneCount = await instantiateMilestones(db, plan, versionId, route.version_no);
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: planId, eventType: 'CONTROL_PLAN_CREATED', idempotencyKey: idem, flightId, payload: { plan_version_id: versionId, baseline_etd: baselineEtd, current_operating_etd: currentEtd } });
      return response(c, { operation_control_plan_id: planId, plan_version_id: versionId, status: 'DRAFT', milestone_count: milestoneCount, source_approval_status: optionalText(body, 'source_approval_status') ?? route.schedule_approval_status, duplicate: false }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/operation-control-plans/:id', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const plan = await loadRequired<Record<string, unknown>>(db,
        `SELECT p.*, f.flight_no, f.flight_date, r.route_template_code, v.source_approval_status,
                v.version_no AS active_version_no
         FROM operation_control_plans p JOIN flights f ON f.flight_id = p.flight_id
         JOIN route_templates r ON r.route_template_id = p.route_template_id
         LEFT JOIN operation_control_plan_versions v ON v.plan_version_id = p.active_plan_version_id
         WHERE p.operation_control_plan_id = ?`, [c.req.param('id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      const next = await db.prepare(
        `SELECT i.*, d.milestone_code, d.name_zh, d.deadline_type FROM milestone_instances i
         JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id
         WHERE i.operation_control_plan_id = ? AND i.status NOT IN ('CLOSED','COMPLETED','WAIVED')
         ORDER BY i.operating_planned_at LIMIT 1`
      ).bind(c.req.param('id')).first();
      return response(c, { plan, next_milestone: next });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/versions', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadPlan(db, c.req.param('id'));
      if (optionalText(body, 'baseline_etd') && optionalText(body, 'baseline_etd') !== plan.baseline_etd) throw new V14OperationError(409, 'BASELINE_ETD_IMMUTABLE', 'Published baseline ETD cannot be overwritten');
      const version = await db.prepare(`SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version FROM operation_control_plan_versions WHERE operation_control_plan_id = ?`).bind(plan.operation_control_plan_id).first<{ next_version: number }>();
      const active = await loadRequired<Record<string, any>>(db, `SELECT * FROM operation_control_plan_versions WHERE plan_version_id = ?`, [plan.active_plan_version_id], 'PLAN_VERSION_NOT_FOUND', 'Active plan version is missing');
      const currentEtd = optionalText(body, 'current_operating_etd') ?? plan.current_operating_etd; addMinutes(currentEtd, 0);
      const versionId = `OPV-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO operation_control_plan_versions (
           plan_version_id, operation_control_plan_id, version_no, baseline_etd_snapshot,
           operating_etd_snapshot, route_template_version, kpi_rule_set_version,
           responsibility_rule_version, flight_duty_plan_version, source_status,
           source_approval_status, change_reason, source_ref, requested_by, supersedes_version_id,
           frozen_baseline_flag, active_flag
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`
      ).bind(versionId, plan.operation_control_plan_id, Number(version?.next_version ?? 2), plan.baseline_etd, currentEtd,
        active.route_template_version, active.kpi_rule_set_version, active.responsibility_rule_version,
        active.flight_duty_plan_version, active.source_status, optionalText(body, 'source_approval_status') ?? active.source_approval_status,
        requiredText(body, 'change_reason'), optionalText(body, 'source_ref'), actor.userId, active.plan_version_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: plan.operation_control_plan_id, eventType: 'CONTROL_PLAN_VERSION_CREATED', idempotencyKey: idem, flightId: plan.flight_id, payload: { plan_version_id: versionId, current_operating_etd: currentEtd } });
      return response(c, { result: 'DRAFT', plan_version_id: versionId, version_no: Number(version?.next_version ?? 2) }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/versions/:version_id/publish', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadPlan(db, c.req.param('id'));
      const version = await loadRequired<Record<string, any>>(db, `SELECT * FROM operation_control_plan_versions WHERE plan_version_id = ? AND operation_control_plan_id = ?`, [c.req.param('version_id'), plan.operation_control_plan_id], 'PLAN_VERSION_NOT_FOUND', 'Plan version was not found');
      const requestedBy = version.requested_by as string;
      if (requestedBy === actor.userId) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Plan requester and publisher must be different users');
      await db.prepare(`UPDATE operation_control_plan_versions SET active_flag = 0, active_to = ? WHERE operation_control_plan_id = ? AND active_flag = 1`).bind(new Date().toISOString(), plan.operation_control_plan_id).run();
      const now = new Date().toISOString();
      await db.prepare(`UPDATE operation_control_plan_versions SET active_flag = 1, approved_by = ?, published_at = ?, active_from = ? WHERE plan_version_id = ?`).bind(actor.userId, now, now, version.plan_version_id).run();
      await db.prepare(`DELETE FROM milestone_instances WHERE operation_control_plan_id = ? AND status = 'PENDING'`).bind(plan.operation_control_plan_id).run();
      const updatedPlan = { ...plan, current_operating_etd: version.operating_etd_snapshot };
      const milestoneCount = await instantiateMilestones(db, updatedPlan, version.plan_version_id, version.route_template_version);
      await db.prepare(`UPDATE operation_control_plans SET current_operating_etd = ?, active_plan_version_id = ?, status = 'ACTIVE', overall_health_color = 'UNKNOWN', calculation_status = 'PENDING', row_version = row_version + 1, updated_at = ? WHERE operation_control_plan_id = ?`)
        .bind(version.operating_etd_snapshot, version.plan_version_id, now, plan.operation_control_plan_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: plan.operation_control_plan_id, eventType: 'CONTROL_PLAN_VERSION_PUBLISHED', idempotencyKey: idem, flightId: plan.flight_id, payload: { plan_version_id: version.plan_version_id, milestone_count: milestoneCount } });
      return response(c, { result: 'ACTIVE', plan_version_id: version.plan_version_id, milestone_count: milestoneCount });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/reroute', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadPlan(db, c.req.param('id')); const routeId = requiredText(body, 'new_route_template_id');
      const route = await loadRequired<Record<string, any>>(db, `SELECT * FROM route_templates WHERE route_template_id = ?`, [routeId], 'ROUTE_TEMPLATE_NOT_FOUND', 'New route template was not found');
      if (route.status !== 'PUBLISHED' || route.schedule_approval_status === 'PENDING_APPROVAL') throw new V14OperationError(409, 'ROUTE_SCHEDULE_UNVERIFIED', 'Reroute target must be approved and published');
      const completed = await db.prepare(`SELECT COUNT(*) AS count FROM milestone_instances WHERE operation_control_plan_id = ? AND status IN ('COMPLETED','CLOSED')`).bind(plan.operation_control_plan_id).first<{ count: number }>();
      const changeId = `CHG-${crypto.randomUUID()}`;
      const requestedBy = actor.userId; const approvedBy = requiredText(body, 'approved_by');
      if (approvedBy === requestedBy) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Reroute request and approval must be distinct');
      await db.prepare(`INSERT INTO change_requests (change_request_id, tenant_id, operation_control_plan_id, related_object_type, related_object_id, change_type, before_json, after_json, reason, requested_by, approved_by, status, approved_at) VALUES (?, ?, ?, 'OperationControlPlan', ?, 'REROUTE', ?, ?, ?, ?, ?, 'APPROVED', ?)`)
        .bind(changeId, actor.tenantId, plan.operation_control_plan_id, plan.operation_control_plan_id,
          JSON.stringify({ route_template_id: plan.route_template_id, completed_milestones: Number(completed?.count ?? 0) }),
          JSON.stringify({ route_template_id: routeId }), requiredText(body, 'reason'), requestedBy, approvedBy, new Date().toISOString()).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: plan.operation_control_plan_id, eventType: 'REROUTE_CHANGE_REQUEST_APPROVED', idempotencyKey: idem, flightId: plan.flight_id, payload: { change_request_id: changeId, new_route_template_id: routeId, completed_history_preserved: true } });
      return response(c, { result: 'APPROVED_CHANGE_REQUEST', change_request_id: changeId, completed_history_preserved: true, next_action: 'create_and_publish_plan_version' });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/operation-control-plans/:id/milestones', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const rows = await db.prepare(
        `SELECT i.*, d.milestone_code, d.name_zh, d.name_en, d.sequence, d.stage_code,
                d.deadline_type, d.owner_role, d.execution_party_role, d.next_owner_role,
                d.required_fields_json, d.required_evidence_types_json, d.gate_code
         FROM milestone_instances i JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id
         WHERE i.operation_control_plan_id = ? ORDER BY d.sequence`
      ).bind(c.req.param('id')).all();
      return response(c, { items: rows.results, total: rows.results.length });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/milestone-instances/:id/events', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const milestone = await loadRequired<Record<string, any>>(db,
        `SELECT i.*, d.milestone_code, d.stage_code, d.owner_role, d.required_evidence_types_json,
                p.flight_id, p.row_version AS plan_row_version
         FROM milestone_instances i JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id
         JOIN operation_control_plans p ON p.operation_control_plan_id = i.operation_control_plan_id
         WHERE i.milestone_instance_id = ?`, [c.req.param('id')], 'MILESTONE_NOT_FOUND', 'Milestone instance was not found');
      if (body.publish_control_fact === true) await assertOccPermission(db, actor, { flightId: milestone.flight_id, requiredRoles: [milestone.owner_role], segmentCode: milestone.stage_code, objectRef: milestone.operation_control_plan_id });
      const expectedVersion = integerValue(body, 'row_version', milestone.row_version);
      if (expectedVersion !== milestone.row_version) throw new V14OperationError(409, 'PLAN_VERSION_CONFLICT', 'Milestone version is stale');
      const action = requiredText(body, 'action'); const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      if (!['START', 'COMPLETE', 'FORECAST', 'REVIEW'].includes(action)) throw new V14OperationError(400, 'VALIDATION_ERROR', 'Unsupported milestone action');
      await db.prepare(
        `UPDATE milestone_instances SET
           status = CASE WHEN ? = 'START' THEN 'IN_PROGRESS' WHEN ? = 'COMPLETE' THEN 'COMPLETED' ELSE status END,
           actual_started_at = CASE WHEN ? = 'START' THEN ? ELSE actual_started_at END,
           actual_completed_at = CASE WHEN ? = 'COMPLETE' THEN ? ELSE actual_completed_at END,
           forecast_at = CASE WHEN ? IN ('FORECAST','REVIEW') THEN ? ELSE forecast_at END,
           forecast_source = CASE WHEN ? IN ('FORECAST','REVIEW') THEN 'MANUAL' ELSE forecast_source END,
           forecast_confidence = COALESCE(?, forecast_confidence), last_status_reason = ?,
           row_version = row_version + 1 WHERE milestone_instance_id = ? AND row_version = ?`
      ).bind(action, action, action, occurredAt, action, occurredAt, action, optionalText(body, 'forecast_at') ?? occurredAt,
        action, numberValue(body, 'forecast_confidence') || null, optionalText(body, 'reason'), milestone.milestone_instance_id, milestone.row_version).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: milestone.operation_control_plan_id, eventType: `MILESTONE_${action}`, eventAction: milestone.milestone_code, idempotencyKey: idem, flightId: milestone.flight_id, occurredAt, payload: { milestone_instance_id: milestone.milestone_instance_id, action, evidence_ids: stringArray(body, 'evidence_ids') } });
      return response(c, { result: action, milestone_instance_id: milestone.milestone_instance_id, row_version: milestone.row_version + 1 });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/milestone-instances/:id/close', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const milestone = await loadRequired<Record<string, any>>(db,
        `SELECT i.*, d.milestone_code, d.stage_code, d.owner_role, d.required_evidence_types_json, p.flight_id
         FROM milestone_instances i JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id
         JOIN operation_control_plans p ON p.operation_control_plan_id = i.operation_control_plan_id
         WHERE i.milestone_instance_id = ?`, [c.req.param('id')], 'MILESTONE_NOT_FOUND', 'Milestone instance was not found');
      const requiredEvidence = JSON.parse(milestone.required_evidence_types_json || '[]') as string[];
      const evidence = stringArray(body, 'evidence_ids');
      if (requiredEvidence.length > 0 && evidence.length === 0) throw new V14OperationError(409, 'MILESTONE_EVIDENCE_INCOMPLETE', 'Closure evidence is incomplete', { required_evidence_types: requiredEvidence });
      const closureChecks = {
        action_complete: body.action_complete === true,
        data_consistent: body.data_consistent === true,
        evidence_complete: evidence.length > 0 || requiredEvidence.length === 0,
        next_owner_accepted: body.next_owner_accepted === true
      };
      if (!Object.values(closureChecks).every(Boolean)) {
        throw new V14OperationError(409, 'GATE_CLOSURE_INCOMPLETE', 'Milestone closure requires action, consistency, evidence and next-owner acceptance', closureChecks);
      }
      const coverage = await db.prepare(`SELECT current_coverage_status FROM operation_control_plans WHERE operation_control_plan_id = ?`).bind(milestone.operation_control_plan_id).first<{ current_coverage_status: string }>();
      if (coverage?.current_coverage_status !== 'COVERED') {
        throw new V14OperationError(409, 'DUTY_COVERAGE_GAP', 'Critical Gate cannot close without active OCC-DM and segment owner coverage');
      }
      const overdueDecision = await db.prepare(`SELECT control_input_signal_id FROM control_input_signals WHERE operation_control_plan_id = ? AND status IN ('PENDING_RECORD','OVERDUE') AND must_record_by < ? LIMIT 1`).bind(milestone.operation_control_plan_id, new Date().toISOString()).first();
      if (overdueDecision) throw new V14OperationError(409, 'DECISION_RECORD_OVERDUE', 'Overdue decision backfill blocks exception Gate closure');
      await assertOccPermission(db, actor, { flightId: milestone.flight_id, requiredRoles: [milestone.owner_role], segmentCode: milestone.stage_code, objectRef: milestone.operation_control_plan_id, makerUserId: optionalText(body, 'submitted_by') });
      const closedAt = optionalText(body, 'closed_at') ?? new Date().toISOString();
      await db.prepare(`UPDATE milestone_instances SET status = 'CLOSED', actual_completed_at = COALESCE(actual_completed_at, ?), evidence_state = 'COMPLETE', closure_evidence_ids_json = ?, closed_by = ?, closed_at = ?, row_version = row_version + 1 WHERE milestone_instance_id = ?`)
        .bind(closedAt, JSON.stringify(evidence), actor.userId, closedAt, milestone.milestone_instance_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: milestone.operation_control_plan_id, eventType: 'MILESTONE_CLOSED', eventAction: milestone.milestone_code, idempotencyKey: idem, flightId: milestone.flight_id, occurredAt: closedAt, payload: { milestone_instance_id: milestone.milestone_instance_id, evidence_ids: evidence } });
      return response(c, { result: 'CLOSED', milestone_instance_id: milestone.milestone_instance_id, closed_at: closedAt });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/recalculate', requireRoles(['platform_admin', 'OCC_DM', 'DQC_DATA_QUALITY_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body); const prior = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (prior) return response(c, { result: 'DUPLICATE' });
      const plan = await loadPlan(db, c.req.param('id')); if (!plan.active_plan_version_id) throw new V14OperationError(409, 'PLAN_VERSION_CONFLICT', 'Control plan has no active version');
      const asOf = optionalText(body, 'as_of') ?? new Date().toISOString();
      const nowMs = new Date(asOf).getTime();
      if (!Number.isFinite(nowMs)) throw new V14OperationError(400, 'VALIDATION_ERROR', 'as_of must be valid ISO 8601');
      const milestones = await db.prepare(
        `SELECT i.*, d.milestone_code, d.stage_code, d.deadline_type, d.sequence, d.freeze_next_gate_on_red
         FROM milestone_instances i JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id
         WHERE i.operation_control_plan_id = ? ORDER BY d.sequence`
      ).bind(plan.operation_control_plan_id).all<Record<string, any>>();
      let overall: 'UNKNOWN' | 'BLUE' | 'YELLOW' | 'RED' = 'BLUE';
      let next: Record<string, any> | null = null;
      for (const milestone of milestones.results) {
        const plannedMs = new Date(milestone.operating_planned_at).getTime();
        const comparison = milestone.actual_completed_at || milestone.forecast_at;
        const comparisonMs = comparison ? new Date(comparison).getTime() : nowMs;
        const variance = Math.round((comparisonMs - plannedMs) / 60_000);
        const remaining = Math.round((plannedMs - nowMs) / 60_000);
        let color: 'UNKNOWN' | 'BLUE' | 'YELLOW' | 'RED' = 'BLUE';
        if (milestone.deadline_type === 'OBSERVATION') color = 'UNKNOWN';
        else if (variance > 360) color = 'RED';
        else if (variance > 120) color = 'YELLOW';
        else if (milestone.evidence_state !== 'COMPLETE' && !['CLOSED', 'COMPLETED'].includes(milestone.status)) color = 'YELLOW';
        if (color === 'RED') overall = 'RED'; else if (color === 'YELLOW' && overall !== 'RED') overall = 'YELLOW';
        if (!next && !['CLOSED', 'COMPLETED', 'WAIVED'].includes(milestone.status)) next = { ...milestone, variance_minutes: variance, remaining_buffer_minutes: remaining, health_color: color };
        await db.prepare(`UPDATE milestone_instances SET baseline_variance_minutes = CASE WHEN actual_completed_at IS NOT NULL THEN CAST((julianday(actual_completed_at) - julianday(baseline_planned_at)) * 1440 AS INTEGER) ELSE baseline_variance_minutes END, operating_variance_minutes = ?, remaining_buffer_minutes = ?, health_color = ?, last_calculated_at = ?, row_version = row_version + 1 WHERE milestone_instance_id = ?`)
          .bind(variance, remaining, color, asOf, milestone.milestone_instance_id).run();
        if (color === 'RED' && Number(milestone.freeze_next_gate_on_red) === 1) {
          await db.prepare(
            `UPDATE milestone_instances SET status = 'BLOCKED', last_status_reason = 'UPSTREAM_RED_GATE_FREEZE', row_version = row_version + 1
             WHERE milestone_instance_id = (
               SELECT next_i.milestone_instance_id FROM milestone_instances next_i
               JOIN milestone_definitions next_d ON next_d.milestone_definition_id = next_i.milestone_definition_id
               WHERE next_i.operation_control_plan_id = ? AND next_d.sequence > ?
               ORDER BY next_d.sequence LIMIT 1
             ) AND status = 'PENDING'`
          ).bind(plan.operation_control_plan_id, milestone.sequence).run();
        }
      }
      const lastLocation = await db.prepare(`SELECT MAX(last_location_at) AS last_location_at FROM transport_jobs WHERE flight_id = ?`).bind(plan.flight_id).first<{ last_location_at: string | null }>();
      const locationAgeMinutes = lastLocation?.last_location_at
        ? Math.max(0, Math.floor((nowMs - new Date(lastLocation.last_location_at).getTime()) / 60_000))
        : null;
      if (locationAgeMinutes !== null && locationAgeMinutes > 60) overall = 'RED';
      else if (locationAgeMinutes !== null && locationAgeMinutes > 30 && overall !== 'RED') overall = 'YELLOW';
      const coverage = await db.prepare(`SELECT current_coverage_status FROM flight_duty_plans WHERE flight_id = ? AND status = 'ACTIVE' ORDER BY version_no DESC LIMIT 1`).bind(plan.flight_id).first<{ current_coverage_status: string }>();
      if ((!coverage || coverage.current_coverage_status === 'GAP') && overall === 'BLUE') overall = 'UNKNOWN';
      const snapshotAt = asOf;
      const rules = {
        source_approval_note: 'OCC_MANUAL_BASELINE does not count as production SLA until approved',
        pre_carriage_target_minutes: plan.pre_carriage_target_minutes,
        pre_carriage_hard_limit_minutes: plan.pre_carriage_hard_limit_minutes,
        internal_product_target_minutes: plan.internal_product_target_minutes,
        customer_commitment_minutes: plan.customer_commitment_minutes,
        coverage_status: coverage?.current_coverage_status ?? 'GAP',
        location_age_minutes: locationAgeMinutes,
        as_of: asOf,
        variance_thresholds_minutes: { blue_max: 120, yellow_max: 360, red_above: 360 },
        evidence_required_for_blue: true
      };
      const replayRows = await db.prepare(
        `SELECT milestone_instance_id, status, forecast_at, actual_completed_at, evidence_state, operating_planned_at
         FROM milestone_instances WHERE operation_control_plan_id = ? ORDER BY milestone_instance_id`
      ).bind(plan.operation_control_plan_id).all<Record<string, any>>();
      const replayInput = replayRows.results.map((item) => ({
        milestone_instance_id: item.milestone_instance_id,
        status: item.status,
        forecast_at: item.forecast_at,
        actual_completed_at: item.actual_completed_at,
        evidence_state: item.evidence_state,
        operating_planned_at: item.operating_planned_at
      }));
      const hash = await sha256Hex(canonicalJson({ plan_id: plan.operation_control_plan_id, overall, next: next?.milestone_instance_id ?? null, rules, replay_input: replayInput }));
      const snapshotId = `KPI-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO kpi_status_snapshots (
           kpi_snapshot_id, operation_control_plan_id, plan_version_id, scope_type, scope_id,
           snapshot_at, current_stage, overall_health_color, next_milestone_id,
           next_hard_deadline_at, forecast_at, variance_minutes, remaining_buffer_minutes,
           rule_results_json, rule_set_version, deterministic_hash
         ) VALUES (?, ?, ?, 'CONTROL_PLAN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'V14-KPI-1', ?)`
      ).bind(snapshotId, plan.operation_control_plan_id, plan.active_plan_version_id, plan.operation_control_plan_id,
        snapshotAt, plan.active_control_segment, overall, next?.milestone_instance_id ?? null,
        next?.operating_planned_at ?? null, next?.forecast_at ?? null, next?.variance_minutes ?? null,
        next?.remaining_buffer_minutes ?? null, JSON.stringify(rules), hash).run();
      await db.prepare(`UPDATE operation_control_plans SET overall_health_color = ?, next_hard_milestone_id = ?, remaining_buffer_minutes = ?, last_calculated_at = ?, calculation_status = 'CURRENT', current_coverage_status = ?, row_version = row_version + 1, updated_at = ? WHERE operation_control_plan_id = ?`)
        .bind(overall, next?.milestone_instance_id ?? null, next?.remaining_buffer_minutes ?? null, snapshotAt,
          coverage?.current_coverage_status ?? 'GAP', snapshotAt, plan.operation_control_plan_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: plan.operation_control_plan_id, eventType: 'CONTROL_PLAN_RECALCULATED', idempotencyKey: idem, flightId: plan.flight_id, payload: { kpi_snapshot_id: snapshotId, overall_health_color: overall } });
      return response(c, { result: 'CURRENT', kpi_snapshot_id: snapshotId, overall_health_color: overall, next_milestone: next, coverage_status: coverage?.current_coverage_status ?? 'GAP', deterministic_hash: hash, as_of: asOf, location_age_minutes: locationAgeMinutes });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/operation-control-plans/:id/kpi-snapshots/latest', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const snapshot = await db.prepare(`SELECT * FROM kpi_status_snapshots WHERE operation_control_plan_id = ? ORDER BY snapshot_at DESC LIMIT 1`).bind(c.req.param('id')).first();
      return response(c, { snapshot });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/operation-control-plans/:id/timeline', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const rows = await db.prepare(
        `SELECT d.milestone_code, d.name_zh, d.stage_code, d.deadline_type, d.sequence,
                i.baseline_planned_at, i.operating_planned_at, i.forecast_at,
                i.actual_started_at, i.actual_completed_at, i.baseline_variance_minutes,
                i.operating_variance_minutes, i.remaining_buffer_minutes, i.health_color, i.status
         FROM milestone_instances i JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id
         WHERE i.operation_control_plan_id = ? ORDER BY d.sequence`
      ).bind(c.req.param('id')).all();
      return response(c, { items: rows.results });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/operation-control-plans/:id/kpis', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const plan = await loadPlan(db, c.req.param('id'));
      const sxz = await db.prepare(`SELECT occurred_at FROM operation_events WHERE aggregate_type = 'TransportJob' AND event_type = 'CHECKPOINT_SZX_TRUCK_DEPARTED' AND flight_id = ? ORDER BY occurred_at LIMIT 1`).bind(plan.flight_id).first<{ occurred_at: string }>();
      const tas = await db.prepare(
        `SELECT i.actual_completed_at FROM milestone_instances i JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id
         WHERE i.operation_control_plan_id = ? AND d.milestone_code = 'TAS_ACTUAL_DEP' ORDER BY i.closed_at DESC LIMIT 1`
      ).bind(plan.operation_control_plan_id).first<{ actual_completed_at: string | null }>();
      const actualMinutes = sxz?.occurred_at && tas?.actual_completed_at ? Math.round((new Date(tas.actual_completed_at).getTime() - new Date(sxz.occurred_at).getTime()) / 60_000) : null;
      return response(c, { kpis: {
        pre_carriage: { code: 'PRE_CARRIAGE_TO_TAS_DEP', start_event: 'SZX_TRUCK_DEPARTED', end_event: 'TAS_ACTUAL_DEP', target_minutes: 12960, hard_limit_minutes: 14400, actual_minutes: actualMinutes, status: actualMinutes === null ? 'PENDING' : actualMinutes <= 12960 ? 'ON_TARGET' : actualMinutes <= 14400 ? 'AT_RISK' : 'BREACHED' },
        product: { target_minutes: plan.internal_product_target_minutes, customer_commitment_minutes: plan.customer_commitment_minutes, anchor: 'separately_configured_product_anchor', status: plan.internal_product_target_minutes ? 'CONFIGURED' : 'NOT_CONFIGURED' }
      } });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/operation-control-plans/:id/management-summary', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const plan = await loadRequired<Record<string, unknown>>(db, `SELECT * FROM operation_control_plans WHERE operation_control_plan_id = ?`, [c.req.param('id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      const [next, incidents, readiness, coverage] = await Promise.all([
        db.prepare(`SELECT i.*, d.milestone_code, d.name_zh FROM milestone_instances i JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id WHERE i.operation_control_plan_id = ? AND i.status NOT IN ('CLOSED','COMPLETED','WAIVED') ORDER BY i.operating_planned_at LIMIT 1`).bind(c.req.param('id')).first(),
        db.prepare(`SELECT COUNT(*) AS count FROM exceptions WHERE related_object_type = 'OperationControlPlan' AND related_object_id = ? AND exception_status NOT IN ('Resolved','Closed')`).bind(c.req.param('id')).first(),
        db.prepare(`SELECT status, COUNT(*) AS count FROM resource_readiness_checks WHERE operation_control_plan_id = ? GROUP BY status`).bind(c.req.param('id')).all(),
        db.prepare(`SELECT current_coverage_status, missing_role_codes_json FROM flight_duty_plans WHERE operation_control_plan_id = ? AND status = 'ACTIVE' ORDER BY version_no DESC LIMIT 1`).bind(c.req.param('id')).first()
      ]);
      const milestones = await db.prepare(
        `SELECT i.*, d.milestone_code, d.name_zh, d.name_en, d.sequence, d.offset_minutes,
                d.owner_role AS current_owner_role, d.next_owner_role, d.validation_status,
                CASE WHEN d.validation_status IN ('TO_BE_CONFIRMED','LEGACY_SUMMARY')
                     THEN d.validation_status ELSE v.source_approval_status END AS source_approval_status
         FROM milestone_instances i
         JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id
         JOIN operation_control_plan_versions v ON v.plan_version_id = i.plan_version_id
         WHERE i.operation_control_plan_id = ?
           AND d.offset_minutes IN (-12960,-8760,-7320,-6600,-4200,-3720,-3600,-1080,-480,-180,-60,0,420)
         ORDER BY d.sequence`
      ).bind(c.req.param('id')).all();
      return response(c, {
        items: milestones.results,
        summary: {
          plan,
          next_hard_milestone: next,
          open_incidents: (incidents as any)?.count ?? 0,
          resource_readiness: readiness.results,
          duty_coverage: coverage,
          pending_baseline_notice: (plan as any).status !== 'CLOSED' ? '手册基线/待审批口径不得驱动正式 SLA 或自动责任认定' : null
        }
      });
    } catch (error) { return handleError(c, error); }
  });
}
