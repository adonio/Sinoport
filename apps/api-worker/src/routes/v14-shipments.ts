import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { ApiApp } from '../index';
import {
  findOperationByIdempotency,
  idempotencyKey,
  requestId,
  requireV14Db,
  V14OperationError
} from '../lib/v14-operations';
import { jsonError } from '../lib/http';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

const intakeRoles: RoleCode[] = [
  'platform_admin',
  'station_supervisor',
  'document_desk',
  'A1_CARGO_CONTROLLER'
];

function response(c: any, data: Record<string, unknown>, status: 200 | 201 = 200) {
  return c.json({ request_id: requestId(c.req.raw.headers), ...data }, status);
}

function handleError(c: any, error: unknown) {
  if (error instanceof V14OperationError) {
    return jsonError(c, error.status, error.code, error.message, error.details);
  }
  console.error('[v14-awb-intakes]', error);
  return jsonError(c, 500, 'UPSTREAM_INTAKE_FAILED', error instanceof Error ? error.message : 'Operation failed');
}

function recordValue(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new V14OperationError(400, 'VALIDATION_ERROR', `${field} is required and must be an object`, { field });
  }
  return value as Record<string, unknown>;
}

function textValue(value: unknown, field: string, required = false) {
  const normalized = String(value ?? '').trim();
  if (required && !normalized) {
    throw new V14OperationError(400, 'VALIDATION_ERROR', `${field} is required`, { field });
  }
  return normalized || null;
}

function positiveInteger(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new V14OperationError(400, 'VALIDATION_ERROR', `${field} must be a positive integer`, { field });
  }
  return number;
}

function nonNegativeNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new V14OperationError(400, 'VALIDATION_ERROR', `${field} must be zero or greater`, { field });
  }
  return number;
}

function scopedStation(actor: any, requested: unknown) {
  const stationId = String(requested ?? actor.stationScope?.[0] ?? '').trim().toUpperCase();
  if (!stationId) {
    throw new V14OperationError(403, 'STATION_SCOPE_REQUIRED', 'A station-scoped login is required');
  }
  const scope = (actor.stationScope ?? []).map((item: unknown) => String(item).trim().toUpperCase());
  if (!actor.roleIds?.includes('platform_admin') && !scope.includes(stationId)) {
    throw new V14OperationError(403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station', {
      station_id: stationId
    });
  }
  return stationId;
}

async function loadIntake(db: any, tenantId: string, stationId: string, awbId: string) {
  const awb = await db
    .prepare(
      `SELECT a.awb_id, a.awb_no, a.shipment_id, a.flight_id, a.station_id, a.hawb_no, a.shipper_name,
              a.consignee_name, a.notify_name, a.goods_description, a.pieces, a.gross_weight, a.current_node,
              a.awb_type, a.created_at, a.updated_at
       FROM awbs a
       JOIN v14_awb_intakes i ON i.awb_id = a.awb_id
       WHERE i.tenant_id = ? AND i.control_station_id = ? AND a.awb_id = ? AND a.deleted_at IS NULL`
    )
    .bind(tenantId, stationId, awbId)
    .first();
  if (!awb) throw new V14OperationError(404, 'AWB_INTAKE_NOT_FOUND', 'AWB intake was not found');
  const shipment = await db
    .prepare(
      `SELECT s.shipment_id, s.station_id, s.order_id, s.shipment_type, s.current_node, s.fulfillment_status,
              s.service_level, s.total_pieces, s.total_weight, s.created_at, s.updated_at
       FROM shipments s
       JOIN v14_awb_intakes i ON i.shipment_id = s.shipment_id
       WHERE i.tenant_id = ? AND i.control_station_id = ? AND s.shipment_id = ?`
    )
    .bind(tenantId, stationId, awb.shipment_id)
    .first();
  if (!shipment) throw new V14OperationError(404, 'SHIPMENT_PROJECTION_NOT_FOUND', 'Shipment projection was not found');
  return { shipment, awb };
}

function parseOperationPayload(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function eligibility(eligible: boolean, reasons: string[]) {
  return { eligible, reasons };
}

export function registerV14AwbIntakeRoutes(app: ApiApp, requireRoles: RequireRoles) {
  app.get('/api/v1/v14/awb-intakes/options', requireRoles(intakeRoles), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const actor = c.var.actor;
      const stationId = scopedStation(actor, c.req.query('station_id'));
      const limit = Math.max(1, Math.min(200, Number(c.req.query('limit')) || 100));
      const actorScope = [...new Set(actor.stationScope.map((item) => String(item).trim().toUpperCase()).filter(Boolean))];
      const scope = actor.roleIds.includes('platform_admin') ? [stationId] : actorScope;
      const placeholders = scope.map(() => '?').join(',');

      const station = await db
        .prepare(`SELECT station_id, station_name, region, control_level, phase FROM stations WHERE station_id = ?`)
        .bind(stationId)
        .first<any>();
      if (!station) throw new V14OperationError(404, 'STATION_NOT_FOUND', 'Station was not found', { station_id: stationId });

      const [stationsResult, flightsResult, shipmentsResult, awbsResult, receiptsResult, jobsResult, bordersResult, routesResult] = await Promise.all([
        db.prepare(
          `SELECT station_id, station_name, region, control_level, phase
           FROM stations WHERE station_id IN (${placeholders}) ORDER BY station_id`
        ).bind(...scope).all<any>(),
        db.prepare(
          `SELECT f.flight_id, f.flight_no, f.flight_date, f.origin_code, f.destination_code, f.std_at, f.etd_at,
                  f.sta_at, f.eta_at, f.runtime_status, f.service_level, f.aircraft_type
           FROM flights f
           JOIN v14_flight_tenant_scopes fs ON fs.flight_id = f.flight_id
           WHERE fs.tenant_id = ? AND fs.station_id = ? AND f.deleted_at IS NULL
           ORDER BY f.flight_date DESC, COALESCE(f.std_at, f.etd_at, f.created_at) DESC LIMIT ?`
        ).bind(actor.tenantId, stationId, limit).all<any>(),
        db.prepare(
          `SELECT DISTINCT s.shipment_id, s.station_id, s.order_id, s.shipment_type, s.current_node, s.fulfillment_status,
                  s.service_level, s.total_pieces, s.total_weight, s.created_at, s.updated_at
           FROM shipments s
           JOIN v14_awb_intakes i ON i.shipment_id = s.shipment_id
           WHERE i.tenant_id = ? AND i.control_station_id = ? AND s.closed_at IS NULL
           ORDER BY s.updated_at DESC LIMIT ?`
        ).bind(actor.tenantId, stationId, limit).all<any>(),
        db.prepare(
          `SELECT a.awb_id, a.awb_no, a.shipment_id, a.flight_id, a.pieces, a.gross_weight, a.current_node, a.awb_type
           FROM awbs a
           JOIN v14_awb_intakes i ON i.awb_id = a.awb_id
           WHERE i.tenant_id = ? AND i.control_station_id = ? AND a.deleted_at IS NULL
           ORDER BY a.updated_at DESC LIMIT ?`
        ).bind(actor.tenantId, stationId, limit * 4).all<any>(),
        db.prepare(
          `SELECT DISTINCT r.receipt_session_id, r.shipment_id, r.status, r.updated_at
           FROM warehouse_receipt_sessions r
           JOIN v14_awb_intakes i ON i.shipment_id = r.shipment_id
           WHERE r.tenant_id = ? AND i.tenant_id = ? AND i.control_station_id = ?
           ORDER BY r.updated_at DESC`
        ).bind(actor.tenantId, actor.tenantId, stationId).all<any>(),
        db.prepare(
          `SELECT DISTINCT j.transport_job_id, j.shipment_id, j.flight_id, j.station_id, j.status,
                  j.route_template_id, j.route_template_version, j.updated_at, r.route_template_code
           FROM transport_jobs j
           JOIN route_templates r ON r.route_template_id = j.route_template_id
           JOIN v14_awb_intakes i ON i.shipment_id = j.shipment_id
           WHERE j.tenant_id = ? AND i.tenant_id = ? AND i.control_station_id = ?
           ORDER BY j.updated_at DESC`
        ).bind(actor.tenantId, actor.tenantId, stationId).all<any>(),
        db.prepare(
          `SELECT DISTINCT b.border_operation_id, b.transport_job_id, b.status, b.updated_at
           FROM border_operations b
           JOIN transport_jobs j ON j.transport_job_id = b.transport_job_id
           JOIN v14_awb_intakes i ON i.shipment_id = j.shipment_id
           WHERE b.tenant_id = ? AND j.tenant_id = ? AND i.tenant_id = ? AND i.control_station_id = ?
           ORDER BY b.updated_at DESC`
        ).bind(actor.tenantId, actor.tenantId, actor.tenantId, stationId).all<any>(),
        db.prepare(
          `SELECT route_template_id, route_template_code, version_no, status,
                  schedule_approval_status, origin_code, destination_code
           FROM route_templates
           WHERE status <> 'RETIRED'
           ORDER BY route_template_code, version_no DESC`
        ).all<any>()
      ]);

      const awbsByShipment = new Map<string, any[]>();
      for (const awb of awbsResult.results) {
        const values = awbsByShipment.get(awb.shipment_id) ?? [];
        values.push(awb);
        awbsByShipment.set(awb.shipment_id, values);
      }
      const receiptByShipment = new Map<string, any>();
      for (const receipt of receiptsResult.results) {
        if (!receiptByShipment.has(receipt.shipment_id)) receiptByShipment.set(receipt.shipment_id, receipt);
      }
      const jobByShipment = new Map<string, any>();
      for (const job of jobsResult.results) {
        if (!jobByShipment.has(job.shipment_id)) jobByShipment.set(job.shipment_id, job);
      }
      const borderByJob = new Map<string, any>();
      for (const border of bordersResult.results) {
        if (!borderByJob.has(border.transport_job_id)) borderByJob.set(border.transport_job_id, border);
      }

      const shipments = shipmentsResult.results.map((shipment) => {
        const shipmentAwbs = awbsByShipment.get(shipment.shipment_id) ?? [];
        const receipt = receiptByShipment.get(shipment.shipment_id) ?? null;
        const job = jobByShipment.get(shipment.shipment_id) ?? null;
        const border = job ? borderByJob.get(job.transport_job_id) ?? null : null;
        const prewarehouseReasons: string[] = [];
        if (Number(shipment.total_pieces) <= 0) prewarehouseReasons.push('PIECES_REQUIRED');
        if (!shipmentAwbs.length) prewarehouseReasons.push('AWB_REQUIRED');
        if (receipt && receipt.status !== 'CANCELLED') prewarehouseReasons.push('ACTIVE_RECEIPT_EXISTS');
        const transportReasons: string[] = [];
        if (!receipt || receipt.status !== 'APPROVED') transportReasons.push('PREWAREHOUSE_APPROVAL_REQUIRED');
        if (job && job.status !== 'CANCELLED') transportReasons.push('ACTIVE_TRANSPORT_JOB_EXISTS');
        const borderReasons: string[] = [];
        if (!job || job.status === 'CANCELLED') borderReasons.push('ACTIVE_TRANSPORT_JOB_REQUIRED');
        if (job && job.route_template_code !== 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2') borderReasons.push('V2_ROUTE_REQUIRED');
        if (border && border.status !== 'CANCELLED') borderReasons.push('ACTIVE_BORDER_OPERATION_EXISTS');
        return {
          ...shipment,
          awbs: shipmentAwbs,
          awb_ids: shipmentAwbs.map((awb) => awb.awb_id),
          prewarehouse_receipt_id: receipt?.receipt_session_id ?? null,
          prewarehouse_receipt_status: receipt?.status ?? null,
          transport_job_id: job?.transport_job_id ?? null,
          transport_job_status: job?.status ?? null,
          border_operation_id: border?.border_operation_id ?? null,
          border_operation_status: border?.status ?? null,
          eligibility: {
            create_prewarehouse: eligibility(prewarehouseReasons.length === 0, prewarehouseReasons),
            create_transport: eligibility(transportReasons.length === 0, transportReasons),
            create_border: eligibility(borderReasons.length === 0, borderReasons)
          }
        };
      });

      const flights = flightsResult.results.map((flight) => {
        const reasons = ['Cancelled', 'Airborne'].includes(flight.runtime_status) ? ['FLIGHT_NOT_OPEN_FOR_INTAKE'] : [];
        return { ...flight, eligibility: eligibility(reasons.length === 0, reasons) };
      });
      const transportJobs = jobsResult.results.map((job) => {
        const border = borderByJob.get(job.transport_job_id) ?? null;
        const reasons: string[] = [];
        if (job.status === 'CANCELLED') reasons.push('ACTIVE_TRANSPORT_JOB_REQUIRED');
        if (job.route_template_code !== 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2') reasons.push('V2_ROUTE_REQUIRED');
        if (border && border.status !== 'CANCELLED') reasons.push('ACTIVE_BORDER_OPERATION_EXISTS');
        return {
          ...job,
          border_operation_id: border?.border_operation_id ?? null,
          border_operation_status: border?.status ?? null,
          eligibility: { create_border: eligibility(reasons.length === 0, reasons) }
        };
      });

      return response(c, {
        station_id: stationId,
        control_station_id: stationId,
        origin_execution_station_id: 'SZX',
        stations: stationsResult.results,
        flights,
        shipments,
        transport_jobs: transportJobs,
        route_templates: routesResult.results
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  app.post('/api/v1/v14/awb-intakes', requireRoles(intakeRoles), async (c) => {
    try {
      const db = requireV14Db(c.env);
      const actor = c.var.actor;
      const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body);
      const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
      if (duplicate) {
        if (duplicate.aggregate_type !== 'AwbIntake') {
          throw new V14OperationError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key belongs to another operation');
        }
        const payload = parseOperationPayload(duplicate.payload_json);
        const stationId = scopedStation(actor, payload.station_id);
        const intake = await loadIntake(db, actor.tenantId, stationId, duplicate.aggregate_id);
        return response(c, {
          shipment_id: intake.shipment.shipment_id,
          awb_id: intake.awb.awb_id,
          duplicate: true,
          ...intake
        });
      }

      const stationId = scopedStation(actor, body.station_id);
      const station = await db.prepare(`SELECT station_id FROM stations WHERE station_id = ?`).bind(stationId).first();
      if (!station) throw new V14OperationError(404, 'STATION_NOT_FOUND', 'Station was not found', { station_id: stationId });

      const awbInput = recordValue(body.awb, 'awb');
      const awbNo = String(textValue(awbInput.awb_no, 'awb.awb_no', true)).toUpperCase();
      const flightId = String(textValue(awbInput.flight_id, 'awb.flight_id', true));
      const pieces = positiveInteger(awbInput.pieces ?? body.total_pieces, 'awb.pieces');
      const grossWeight = nonNegativeNumber(awbInput.gross_weight ?? body.total_weight, 'awb.gross_weight');
      const flight = await db
        .prepare(
          `SELECT f.flight_id, f.flight_no, f.flight_date, f.station_id, f.runtime_status
           FROM flights f
           JOIN v14_flight_tenant_scopes fs ON fs.flight_id = f.flight_id
           WHERE f.flight_id = ? AND fs.tenant_id = ? AND fs.station_id = ? AND f.deleted_at IS NULL`
        )
        .bind(flightId, actor.tenantId, stationId)
        .first<any>();
      if (!flight) {
        throw new V14OperationError(409, 'FLIGHT_SCOPE_MISMATCH', 'AWB flight must belong to the same tenant and station', {
          station_id: stationId
        });
      }
      if (['Cancelled', 'Airborne'].includes(flight.runtime_status)) {
        throw new V14OperationError(409, 'FLIGHT_NOT_ELIGIBLE', 'Flight is not open for AWB intake', {
          runtime_status: flight.runtime_status
        });
      }

      const existingAwb = await db
        .prepare(
          `SELECT a.awb_id, a.shipment_id, a.station_id, i.tenant_id, i.control_station_id
           FROM awbs a
           LEFT JOIN v14_awb_intakes i ON i.awb_id = a.awb_id
           WHERE a.awb_no = ? AND a.deleted_at IS NULL`
        )
        .bind(awbNo)
        .first<any>();
      if (existingAwb) {
        const details = existingAwb.tenant_id === actor.tenantId && existingAwb.control_station_id === stationId
          ? { awb_id: existingAwb.awb_id, shipment_id: existingAwb.shipment_id }
          : {};
        throw new V14OperationError(409, 'AWB_ALREADY_EXISTS', 'AWB number already exists; replay with the original Idempotency-Key or use a new AWB number', details);
      }

      const now = new Date().toISOString();
      const shipmentId = `SHP-${crypto.randomUUID()}`;
      const awbId = `AWB-${crypto.randomUUID()}`;
      const operationEventId = `OP-${crypto.randomUUID()}`;
      const currentNode = 'Front Warehouse Receiving';
      const serviceLevel = String(textValue(body.service_level, 'service_level') ?? 'P1');
      const eventPayload = {
        station_id: stationId,
        shipment_id: shipmentId,
        awb_id: awbId,
        awb_no: awbNo,
        flight_id: flightId,
        pieces,
        gross_weight: grossWeight,
        source: 'MANUAL_AWB_INTAKE'
      };
      if (!db.batch) throw new V14OperationError(500, 'DATABASE_BATCH_REQUIRED', 'Atomic D1 batch support is required');
      try {
        await db.batch([
        db.prepare(
          `INSERT INTO shipments (
             shipment_id, station_id, order_id, shipment_type, current_node,
             fulfillment_status, service_level, total_pieces, total_weight, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          shipmentId,
          stationId,
          textValue(body.order_id, 'order_id'),
          textValue(body.shipment_type, 'shipment_type') ?? 'CROSS_BORDER_AIR',
          currentNode,
          currentNode,
          serviceLevel,
          pieces,
          grossWeight,
          now,
          now
        ),
        db.prepare(
          `INSERT INTO awbs (
             awb_id, awb_no, shipment_id, flight_id, station_id, hawb_no,
             shipper_name, consignee_name, notify_name, goods_description, pieces, gross_weight,
             current_node, awb_type, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          awbId,
          awbNo,
          shipmentId,
          flightId,
          stationId,
          textValue(awbInput.hawb_no, 'awb.hawb_no'),
          textValue(awbInput.shipper_name, 'awb.shipper_name'),
          textValue(awbInput.consignee_name, 'awb.consignee_name'),
          textValue(awbInput.notify_name, 'awb.notify_name'),
          textValue(awbInput.goods_description, 'awb.goods_description'),
          pieces,
          grossWeight,
          currentNode,
          textValue(awbInput.awb_type, 'awb.awb_type') ?? 'EXPORT',
          now,
          now
        ),
        db.prepare(
          `INSERT INTO v14_awb_intakes (
             awb_intake_id, tenant_id, control_station_id, origin_execution_station_id,
             shipment_id, awb_id, flight_id, source_type, source_ref, created_by, created_at
           ) VALUES (?, ?, ?, 'SZX', ?, ?, ?, 'MANUAL_AWB_INTAKE', ?, ?, ?)`
        ).bind(
          `INTAKE-${crypto.randomUUID()}`,
          actor.tenantId,
          stationId,
          shipmentId,
          awbId,
          flightId,
          awbNo,
          actor.userId,
          now
        ),
        db.prepare(
          `INSERT INTO operation_events (
             operation_event_id, tenant_id, station_id, shipment_id, flight_id, awb_id,
             aggregate_type, aggregate_id, aggregate_sequence, event_type, event_action,
             occurred_at, actor_id, actor_role, client_source, client_event_id, idempotency_key,
             payload_json
           ) VALUES (?, ?, ?, ?, ?, ?, 'AwbIntake', ?, 1, 'AWB_INTAKE_RECORDED', 'CREATE',
             ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          operationEventId,
          actor.tenantId,
          stationId,
          shipmentId,
          flightId,
          awbId,
          awbId,
          now,
          actor.userId,
          actor.roleIds[0] ?? 'document_desk',
          actor.clientSource,
          textValue(body.client_event_id, 'client_event_id'),
          idem,
          JSON.stringify(eventPayload)
        )
        ]);
      } catch (error) {
        const racedDuplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
        if (racedDuplicate?.aggregate_type === 'AwbIntake') {
          const intake = await loadIntake(db, actor.tenantId, stationId, racedDuplicate.aggregate_id);
          return response(c, {
            shipment_id: intake.shipment.shipment_id,
            awb_id: intake.awb.awb_id,
            duplicate: true,
            ...intake
          });
        }
        if (String(error).includes('awbs.awb_no')) {
          throw new V14OperationError(409, 'AWB_ALREADY_EXISTS', 'AWB number already exists; replay with the original Idempotency-Key or use a new AWB number');
        }
        throw error;
      }

      const intake = await loadIntake(db, actor.tenantId, stationId, awbId);
      return response(c, {
        shipment_id: shipmentId,
        awb_id: awbId,
        duplicate: false,
        ...intake
      }, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });
}
