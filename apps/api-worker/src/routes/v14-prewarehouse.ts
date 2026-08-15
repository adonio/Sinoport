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
  receiptSummary,
  requestId,
  requiredText,
  requireV14Db,
  stringArray,
  V14OperationError
} from '../lib/v14-operations';
import { jsonError } from '../lib/http';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

function handleError(c: any, error: unknown) {
  if (error instanceof V14OperationError) {
    return jsonError(c, error.status, error.code, error.message, error.details);
  }
  console.error('[v14-prewarehouse]', error);
  return jsonError(c, 500, 'PREWAREHOUSE_OPERATION_FAILED', error instanceof Error ? error.message : 'Operation failed');
}

function response(c: any, data: Record<string, unknown>, status: 200 | 201 = 200) {
  return c.json({ request_id: requestId(c.req.raw.headers), ...data }, status);
}

export function registerV14PrewarehouseRoutes(app: ApiApp, requireRoles: RequireRoles) {
  app.get(
    '/api/v1/prewarehouse/receipts',
    requireRoles(['platform_admin', 'station_supervisor', 'PREWH_OPERATOR', 'A1_CARGO_CONTROLLER']),
    async (c) => {
      try {
        const db = requireV14Db(c.env);
        const status = String(c.req.query('status') ?? '').trim();
        const shipmentId = String(c.req.query('shipment_id') ?? '').trim();
        const limit = Math.max(1, Math.min(100, Number(c.req.query('page_size')) || 50));
        const rows = await db
          .prepare(
            `SELECT r.*, s.order_id,
                    r.expected_pieces - r.unique_received_pieces AS remaining_pieces
             FROM warehouse_receipt_sessions r
             JOIN shipments s ON s.shipment_id = r.shipment_id
             WHERE (? = '' OR r.status = ?) AND (? = '' OR r.shipment_id = ?)
             ORDER BY r.updated_at DESC LIMIT ?`
          )
          .bind(status, status, shipmentId, shipmentId, limit)
          .all();
        return response(c, { items: rows.results, total: rows.results.length });
      } catch (error) {
        return handleError(c, error);
      }
    }
  );

  app.post(
    '/api/v1/prewarehouse/receipts',
    requireRoles(['platform_admin', 'station_supervisor', 'PREWH_OPERATOR', 'A1_CARGO_CONTROLLER']),
    async (c) => {
      try {
        const db = requireV14Db(c.env);
        const actor = c.var.actor;
        const body = await c.req.json<Record<string, unknown>>();
        const idem = idempotencyKey(c.req.raw.headers, body);
        const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
        if (duplicate) {
          const summary = await receiptSummary(db, duplicate.aggregate_id);
          return response(c, { receipt_session_id: duplicate.aggregate_id, duplicate: true, summary });
        }
        const shipmentId = requiredText(body, 'shipment_id');
        const stationId = optionalText(body, 'warehouse_station_id') ?? 'SZX';
        const shipment = await loadRequired<{ total_pieces: number | null }>(
          db,
          `SELECT total_pieces FROM shipments WHERE shipment_id = ?`,
          [shipmentId],
          'SHIPMENT_NOT_FOUND',
          'Shipment was not found'
        );
        await db
          .prepare(
            `INSERT INTO stations (station_id, station_name, region, control_level, phase)
             VALUES (?, ?, 'China', 'L1', 'v1.4-pilot') ON CONFLICT(station_id) DO NOTHING`
          )
          .bind(stationId, `${stationId} Pre-warehouse`)
          .run();

        let baselineId = optionalText(body, 'expected_baseline_version_id');
        let expectedPieces = Math.max(0, integerValue(body, 'expected_pieces', Number(shipment.total_pieces ?? 0)));
        if (baselineId) {
          const baseline = await loadRequired<{ expected_pieces: number; status: string }>(
            db,
            `SELECT expected_pieces, status FROM cargo_baseline_versions WHERE baseline_version_id = ? AND shipment_id = ?`,
            [baselineId, shipmentId],
            'EXPECTED_BASELINE_CHANGED',
            'Expected baseline is missing or belongs to another shipment'
          );
          if (baseline.status !== 'PUBLISHED') {
            throw new V14OperationError(409, 'EXPECTED_BASELINE_CHANGED', 'Expected baseline is not published');
          }
          expectedPieces = baseline.expected_pieces;
        } else {
          const current = await db
            .prepare(
              `SELECT baseline_version_id, expected_pieces FROM cargo_baseline_versions
               WHERE tenant_id = ? AND shipment_id = ? AND baseline_type = 'EXPECTED' AND status = 'PUBLISHED'
               ORDER BY version_no DESC LIMIT 1`
            )
            .bind(actor.tenantId, shipmentId)
            .first<{ baseline_version_id: string; expected_pieces: number }>();
          if (current) {
            baselineId = current.baseline_version_id;
            expectedPieces = current.expected_pieces;
          } else {
            if (expectedPieces < 1) {
              throw new V14OperationError(400, 'VALIDATION_ERROR', 'expected_pieces must be positive when no baseline exists');
            }
            const version = await db
              .prepare(
                `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version FROM cargo_baseline_versions
                 WHERE tenant_id = ? AND shipment_id = ? AND baseline_type = 'EXPECTED'`
              )
              .bind(actor.tenantId, shipmentId)
              .first<{ next_version: number }>();
            baselineId = `BASE-${crypto.randomUUID()}`;
            await db
              .prepare(
                `INSERT INTO cargo_baseline_versions (
                   baseline_version_id, tenant_id, shipment_id, version_no, baseline_type, status,
                   expected_pieces, expected_weight_kg, source_type, source_ref, requested_by,
                   approved_by, published_at
                 ) VALUES (?, ?, ?, ?, 'EXPECTED', 'PUBLISHED', ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                baselineId,
                actor.tenantId,
                shipmentId,
                Number(version?.next_version ?? 1),
                expectedPieces,
                numberValue(body, 'expected_weight_kg') || null,
                optionalText(body, 'baseline_source_type') ?? 'SKYLEDGER_SYNC',
                optionalText(body, 'baseline_source_ref'),
                optionalText(body, 'baseline_requested_by') ?? 'SKYLEDGER_SYNC',
                actor.userId,
                new Date().toISOString()
              )
              .run();
          }
        }

        const units = Array.isArray(body.cargo_units) ? (body.cargo_units as Record<string, unknown>[]) : [];
        for (let index = 0; index < units.length; index += 1) {
          const unit = units[index];
          const barcode = requiredText(unit, 'barcode');
          await db
            .prepare(
              `INSERT INTO cargo_units (
                 cargo_unit_id, tenant_id, shipment_id, awb_id, hawb_no, business_barcode,
                 barcode_type, unit_sequence, package_type, expected_weight_kg,
                 expected_baseline_version_id, aggregate_quantity, is_aggregate
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(tenant_id, business_barcode) DO NOTHING`
            )
            .bind(
              optionalText(unit, 'cargo_unit_id') ?? `CU-${crypto.randomUUID()}`,
              actor.tenantId,
              shipmentId,
              optionalText(unit, 'awb_id'),
              optionalText(unit, 'hawb_no'),
              barcode,
              optionalText(unit, 'barcode_type') ?? 'PACKAGE',
              integerValue(unit, 'unit_sequence', index + 1),
              optionalText(unit, 'package_type'),
              numberValue(unit, 'expected_weight_kg') || null,
              baselineId,
              Math.max(1, integerValue(unit, 'quantity', 1)),
              Number(integerValue(unit, 'quantity', 1) > 1)
            )
            .run();
        }

        const receiptId = `PWR-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO warehouse_receipt_sessions (
               receipt_session_id, tenant_id, shipment_id, warehouse_station_id, batch_no,
               source_delivery_ref, source_vehicle_plate, expected_baseline_version_id,
               status, started_at, expected_pieces, operator_id, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?, ?)`
          )
          .bind(
            receiptId,
            actor.tenantId,
            shipmentId,
            stationId,
            optionalText(body, 'batch_no') ?? `BATCH-${now.slice(0, 10)}`,
            optionalText(body, 'source_delivery_ref'),
            optionalText(body, 'source_vehicle_plate'),
            baselineId,
            now,
            expectedPieces,
            actor.userId,
            now,
            now
          )
          .run();
        await appendOperationEvent(db, actor, {
          aggregateType: 'WarehouseReceiptSession', aggregateId: receiptId,
          eventType: 'PREWAREHOUSE_RECEIPT_CREATED', idempotencyKey: idem,
          stationId, shipmentId, payload: { baseline_version_id: baselineId, expected_pieces: expectedPieces }
        });
        return response(c, { receipt_session_id: receiptId, duplicate: false, summary: await receiptSummary(db, receiptId) }, 201);
      } catch (error) {
        return handleError(c, error);
      }
    }
  );

  app.get(
    '/api/v1/prewarehouse/receipts/:id',
    requireRoles(['platform_admin', 'station_supervisor', 'PREWH_OPERATOR', 'A1_CARGO_CONTROLLER']),
    async (c) => {
      try {
        const db = requireV14Db(c.env);
        const receipt = await loadRequired<Record<string, unknown>>(
          db,
          `SELECT r.*, r.expected_pieces - r.unique_received_pieces AS remaining_pieces,
                  g.decision AS gate_decision
           FROM warehouse_receipt_sessions r
           LEFT JOIN gate_decisions g ON g.gate_decision_id = r.gate_decision_id
           WHERE r.receipt_session_id = ?`,
          [c.req.param('id')],
          'RECEIPT_NOT_FOUND',
          'Pre-warehouse receipt session was not found'
        );
        const events = await db
          .prepare(`SELECT * FROM count_events WHERE session_type = 'PREWAREHOUSE' AND session_id = ? ORDER BY recorded_at`)
          .bind(c.req.param('id'))
          .all();
        return response(c, { receipt, count_events: events.results });
      } catch (error) {
        return handleError(c, error);
      }
    }
  );

  app.post(
    '/api/v1/prewarehouse/receipts/:id/scans',
    requireRoles(['platform_admin', 'station_supervisor', 'PREWH_OPERATOR']),
    async (c) => {
      try {
        const db = requireV14Db(c.env);
        const actor = c.var.actor;
        const body = await c.req.json<Record<string, unknown>>();
        const idem = idempotencyKey(c.req.raw.headers, body);
        const existingEvent = await findOperationByIdempotency(db, actor.tenantId, idem);
        if (existingEvent) {
          return response(c, {
            result: 'DUPLICATE',
            cargo_unit_id: (JSON.parse(existingEvent.payload_json) as Record<string, unknown>).cargo_unit_id ?? null,
            summary: await receiptSummary(db, c.req.param('id'))
          });
        }
        const session = await loadRequired<{
          receipt_session_id: string; shipment_id: string; warehouse_station_id: string;
          expected_baseline_version_id: string; status: string;
        }>(
          db,
          `SELECT receipt_session_id, shipment_id, warehouse_station_id, expected_baseline_version_id, status
           FROM warehouse_receipt_sessions WHERE receipt_session_id = ?`,
          [c.req.param('id')],
          'RECEIPT_NOT_FOUND',
          'Pre-warehouse receipt session was not found'
        );
        if (!['IN_PROGRESS', 'EXPECTED'].includes(session.status)) {
          throw new V14OperationError(409, 'SESSION_NOT_EDITABLE', 'Receipt session no longer accepts scans');
        }
        const clientBaseline = optionalText(body, 'expected_baseline_version_id');
        if (clientBaseline && clientBaseline !== session.expected_baseline_version_id) {
          throw new V14OperationError(409, 'EXPECTED_BASELINE_CHANGED', 'Client baseline is stale');
        }
        const barcode = requiredText(body, 'barcode');
        let cargoUnit = await db
          .prepare(`SELECT cargo_unit_id, shipment_id, inventory_state, aggregate_quantity, expected_weight_kg FROM cargo_units WHERE tenant_id = ? AND business_barcode = ?`)
          .bind(actor.tenantId, barcode)
          .first<{ cargo_unit_id: string; shipment_id: string; inventory_state: string; aggregate_quantity: number; expected_weight_kg: number | null }>();
        if (cargoUnit && cargoUnit.shipment_id !== session.shipment_id) {
          const exceptionId = await ensureOperationalException(db, {
            stationId: session.warehouse_station_id, exceptionType: 'BARCODE_WRONG_SHIPMENT',
            relatedObjectType: 'CargoUnit', relatedObjectId: cargoUnit.cargo_unit_id,
            severity: 'Critical', ownerRole: 'A1_CARGO_CONTROLLER', blocker: true,
            rootCause: `Scanned into receipt ${session.receipt_session_id} for shipment ${session.shipment_id}`,
            actionTaken: 'Scan rejected; cargo unit retained outside current receipt baseline'
          });
          throw new V14OperationError(409, 'BARCODE_WRONG_SHIPMENT', 'Barcode belongs to another shipment', { exception_id: exceptionId, cargo_unit_id: cargoUnit.cargo_unit_id });
        }
        const quantity = Math.max(1, integerValue(body, 'quantity', cargoUnit?.aggregate_quantity ?? 1));
        if (!cargoUnit) {
          const cargoUnitId = `CU-${crypto.randomUUID()}`;
          await db
            .prepare(
              `INSERT INTO cargo_units (
                 cargo_unit_id, tenant_id, shipment_id, business_barcode, barcode_type,
                 expected_baseline_version_id, aggregate_quantity, is_aggregate
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              cargoUnitId,
              actor.tenantId,
              session.shipment_id,
              barcode,
              quantity > 1 ? 'AGGREGATE' : 'PACKAGE',
              session.expected_baseline_version_id,
              quantity,
              Number(quantity > 1)
            )
            .run();
          cargoUnit = { cargo_unit_id: cargoUnitId, shipment_id: session.shipment_id, inventory_state: 'EXPECTED', aggregate_quantity: quantity, expected_weight_kg: null };
        }
        const alreadyCounted = await db
          .prepare(
            `SELECT count_event_id, occurred_at, actor_id, device_id, quantity_delta FROM count_events
             WHERE tenant_id = ? AND session_type = 'PREWAREHOUSE' AND session_id = ?
               AND cargo_unit_id = ? AND event_action IN ('SCAN_IN', 'BULK_COUNT', 'CORRECT')
             LIMIT 1`
          )
          .bind(actor.tenantId, session.receipt_session_id, cargoUnit.cargo_unit_id)
          .first();
        if (alreadyCounted) {
          throw new V14OperationError(409, 'BARCODE_ALREADY_COUNTED', 'Barcode was already counted in this session', {
            first_count: alreadyCounted
          });
        }
        const declaredCondition = optionalText(body, 'condition_status') ?? 'NORMAL';
        const measuredWeight = Object.prototype.hasOwnProperty.call(body, 'weight_kg') ? numberValue(body, 'weight_kg') : null;
        const toleranceKg = Math.max(0, numberValue(body, 'weight_tolerance_kg', 1));
        const weightVariance = measuredWeight != null && cargoUnit.expected_weight_kg != null
          && Math.abs(measuredWeight - Number(cargoUnit.expected_weight_kg)) > toleranceKg;
        const condition = weightVariance && declaredCondition === 'NORMAL' ? 'OTHER' : declaredCondition;
        const countEventId = `CNT-${crypto.randomUUID()}`;
        const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO count_events (
               count_event_id, tenant_id, session_type, session_id, shipment_id, cargo_unit_id,
               event_action, quantity_delta, location_type, location_id, condition_status,
               weight_kg, occurred_at, actor_id, device_id, client_event_id, idempotency_key,
               offline_created, sync_status, evidence_refs_json
             ) VALUES (?, ?, 'PREWAREHOUSE', ?, ?, ?, ?, ?, 'PREWAREHOUSE', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?)`
          )
          .bind(
            countEventId,
            actor.tenantId,
            session.receipt_session_id,
            session.shipment_id,
            cargoUnit.cargo_unit_id,
            quantity > 1 ? 'BULK_COUNT' : 'SCAN_IN',
            quantity,
            session.warehouse_station_id,
            condition,
            measuredWeight,
            occurredAt,
            actor.userId,
            optionalText(body, 'device_id'),
            optionalText(body, 'client_event_id') ?? idem,
            idem,
            Number(Boolean(body.offline_created)),
            JSON.stringify(stringArray(body, 'evidence_ids'))
          )
          .run();
        await db
          .prepare(
            `UPDATE cargo_units SET inventory_state = CASE WHEN ? = 'NORMAL' THEN 'PREWH_RECEIVED' ELSE 'QUARANTINED' END, condition_status = ?,
               actual_weight_kg = COALESCE(?, actual_weight_kg), current_location_type = 'PREWAREHOUSE',
               current_location_id = ?, updated_at = ? WHERE cargo_unit_id = ?`
          )
          .bind(condition, condition, measuredWeight, session.warehouse_station_id, new Date().toISOString(), cargoUnit.cargo_unit_id)
          .run();
        await db
          .prepare(
            `UPDATE warehouse_receipt_sessions SET
               unique_received_pieces = unique_received_pieces + ?,
               normal_pieces = normal_pieces + ?, exception_pieces = exception_pieces + ?,
               status = 'IN_PROGRESS', version_no = version_no + 1, updated_at = ?
             WHERE receipt_session_id = ?`
          )
          .bind(quantity, condition === 'NORMAL' ? quantity : 0, condition === 'NORMAL' ? 0 : quantity, new Date().toISOString(), session.receipt_session_id)
          .run();
        const exceptionId = condition === 'NORMAL' ? null : await ensureOperationalException(db, {
          stationId: session.warehouse_station_id,
          exceptionType: weightVariance ? 'PREWAREHOUSE_WEIGHT_VARIANCE' : 'PREWAREHOUSE_CARGO_CONDITION',
          relatedObjectType: 'CargoUnit', relatedObjectId: cargoUnit.cargo_unit_id,
          severity: weightVariance ? 'High' : 'Critical', ownerRole: 'A1_CARGO_CONTROLLER', blocker: true,
          rootCause: weightVariance
            ? `Expected ${cargoUnit.expected_weight_kg}kg, measured ${measuredWeight}kg, tolerance ${toleranceKg}kg`
            : `Condition reported as ${declaredCondition}`,
          actionTaken: 'Cargo unit quarantined for supervisor review'
        });
        await appendOperationEvent(db, actor, {
          aggregateType: 'WarehouseReceiptSession', aggregateId: session.receipt_session_id,
          eventType: 'PREWAREHOUSE_CARGO_COUNTED', eventAction: quantity > 1 ? 'BULK_COUNT' : 'SCAN_IN',
          idempotencyKey: idem, clientEventId: optionalText(body, 'client_event_id'), occurredAt,
          stationId: session.warehouse_station_id, shipmentId: session.shipment_id,
          payload: { cargo_unit_id: cargoUnit.cargo_unit_id, barcode, quantity, condition_status: condition, weight_variance: weightVariance, count_event_id: countEventId, exception_id: exceptionId }
        });
        return response(c, { result: 'COUNTED', cargo_unit_id: cargoUnit.cargo_unit_id, condition_status: condition, weight_variance: weightVariance, exception_id: exceptionId, summary: await receiptSummary(db, session.receipt_session_id) });
      } catch (error) {
        return handleError(c, error);
      }
    }
  );

  app.post(
    '/api/v1/prewarehouse/receipts/:id/submit',
    requireRoles(['platform_admin', 'station_supervisor', 'PREWH_OPERATOR']),
    async (c) => {
      try {
        const db = requireV14Db(c.env);
        const actor = c.var.actor;
        const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
        const idem = idempotencyKey(c.req.raw.headers, body);
        const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
        if (duplicate) return response(c, { result: 'DUPLICATE', summary: await receiptSummary(db, c.req.param('id')) });
        const session = await receiptSummary(db, c.req.param('id'));
        if (session.status !== 'IN_PROGRESS') throw new V14OperationError(409, 'SESSION_NOT_EDITABLE', 'Only in-progress sessions can be submitted');
        await db
          .prepare(`UPDATE warehouse_receipt_sessions SET status = 'SUBMITTED', submitted_at = ?, updated_at = ? WHERE receipt_session_id = ?`)
          .bind(new Date().toISOString(), new Date().toISOString(), c.req.param('id'))
          .run();
        await appendOperationEvent(db, actor, {
          aggregateType: 'WarehouseReceiptSession', aggregateId: c.req.param('id'),
          eventType: 'PREWAREHOUSE_RECEIPT_SUBMITTED', idempotencyKey: idem,
          payload: { summary: session }
        });
        return response(c, { result: 'SUBMITTED', summary: await receiptSummary(db, c.req.param('id')) });
      } catch (error) {
        return handleError(c, error);
      }
    }
  );

  app.post(
    '/api/v1/prewarehouse/receipts/:id/approve',
    requireRoles(['platform_admin', 'station_supervisor', 'A1_CARGO_CONTROLLER']),
    async (c) => {
      try {
        const db = requireV14Db(c.env);
        const actor = c.var.actor;
        const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
        const idem = idempotencyKey(c.req.raw.headers, body);
        const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
        if (duplicate) return response(c, { result: 'DUPLICATE', summary: await receiptSummary(db, c.req.param('id')) });
        const session = await loadRequired<{
          status: string; operator_id: string; shipment_id: string; warehouse_station_id: string;
          expected_pieces: number; unique_received_pieces: number; exception_pieces: number;
        }>(
          db,
          `SELECT status, operator_id, shipment_id, warehouse_station_id, expected_pieces,
                  unique_received_pieces, exception_pieces
           FROM warehouse_receipt_sessions WHERE receipt_session_id = ?`,
          [c.req.param('id')],
          'RECEIPT_NOT_FOUND',
          'Receipt session was not found'
        );
        if (session.status !== 'SUBMITTED') throw new V14OperationError(409, 'SESSION_NOT_EDITABLE', 'Only submitted sessions can be approved');
        const dataConsistent = session.expected_pieces === session.unique_received_pieces && session.exception_pieces === 0;
        const decision = dataConsistent
          ? 'PASS'
          : body.allow_conditional === true
            ? 'CONDITIONAL_PASS'
            : 'BLOCKED';
        const gateId = await createGateDecision(db, actor, {
          gateCode: 'PREWAREHOUSE_RECEIPT_GATE', objectType: 'WarehouseReceiptSession', objectId: c.req.param('id'),
          decision, actionComplete: true, dataConsistent, evidenceComplete: stringArray(body, 'evidence_ids').length > 0,
          nextOwnerAccepted: body.next_owner_accepted === true, requestedBy: session.operator_id,
          reason: optionalText(body, 'reason'), conditions: { expected: session.expected_pieces, received: session.unique_received_pieces },
          cargoUnitIds: stringArray(body, 'cargo_unit_ids'), expiresAt: optionalText(body, 'expires_at')
        });
        const nextStatus = decision === 'BLOCKED' ? 'BLOCKED' : 'APPROVED';
        await db
          .prepare(
            `UPDATE warehouse_receipt_sessions SET status = ?, supervisor_id = ?, approved_at = ?,
               gate_decision_id = ?, updated_at = ? WHERE receipt_session_id = ?`
          )
          .bind(nextStatus, actor.userId, new Date().toISOString(), gateId, new Date().toISOString(), c.req.param('id'))
          .run();
        await appendOperationEvent(db, actor, {
          aggregateType: 'WarehouseReceiptSession', aggregateId: c.req.param('id'),
          eventType: 'PREWAREHOUSE_RECEIPT_DECIDED', eventAction: decision,
          idempotencyKey: idem, stationId: session.warehouse_station_id, shipmentId: session.shipment_id,
          payload: { gate_decision_id: gateId, decision }
        });
        await enqueueSkyledgerEvent(c.env, {
          eventType: 'prewarehouse.receipt_decided.v1', aggregateType: 'WarehouseReceiptSession', aggregateId: c.req.param('id'),
          payload: { receipt_session_id: c.req.param('id'), shipment_id: session.shipment_id, decision,
            expected_pieces: session.expected_pieces, received_pieces: session.unique_received_pieces,
            exception_pieces: session.exception_pieces, decided_at: new Date().toISOString() }
        });
        return response(c, { result: nextStatus, gate_decision_id: gateId, summary: await receiptSummary(db, c.req.param('id')) });
      } catch (error) {
        return handleError(c, error);
      }
    }
  );

  app.post(
    '/api/v1/prewarehouse/receipts/:id/corrections',
    requireRoles(['platform_admin', 'station_supervisor']),
    async (c) => {
      try {
        const db = requireV14Db(c.env);
        const actor = c.var.actor;
        const body = await c.req.json<Record<string, unknown>>();
        const idem = idempotencyKey(c.req.raw.headers, body);
        const duplicate = await findOperationByIdempotency(db, actor.tenantId, idem);
        if (duplicate) return response(c, { result: 'DUPLICATE', summary: await receiptSummary(db, c.req.param('id')) });
        const originalId = requiredText(body, 'reverses_count_event_id');
        const original = await loadRequired<{
          shipment_id: string; cargo_unit_id: string; quantity_delta: number; condition_status: string;
          location_id: string;
        }>(
          db,
          `SELECT shipment_id, cargo_unit_id, quantity_delta, condition_status, location_id
           FROM count_events WHERE count_event_id = ? AND session_id = ?`,
          [originalId, c.req.param('id')],
          'COUNT_EVENT_NOT_FOUND',
          'Original count event was not found'
        );
        const alreadyReversed = await db.prepare(`SELECT count_event_id FROM count_events WHERE reverses_count_event_id = ?`).bind(originalId).first();
        if (alreadyReversed) throw new V14OperationError(409, 'OFFLINE_EVENT_CONFLICT', 'Count event was already reversed');
        const correctionId = `CNT-${crypto.randomUUID()}`;
        await db
          .prepare(
            `INSERT INTO count_events (
               count_event_id, tenant_id, session_type, session_id, shipment_id, cargo_unit_id,
               event_action, quantity_delta, location_type, location_id, occurred_at, actor_id,
               client_event_id, idempotency_key, sync_status, reason_code, reverses_count_event_id
             ) VALUES (?, ?, 'PREWAREHOUSE', ?, ?, ?, 'REVERSE', ?, 'PREWAREHOUSE', ?, ?, ?, ?, ?, 'SYNCED', ?, ?)`
          )
          .bind(
            correctionId, actor.tenantId, c.req.param('id'), original.shipment_id, original.cargo_unit_id,
            -Math.abs(original.quantity_delta), original.location_id, optionalText(body, 'occurred_at') ?? new Date().toISOString(),
            actor.userId, optionalText(body, 'client_event_id') ?? idem, idem, requiredText(body, 'reason_code'), originalId
          )
          .run();
        const wasNormal = original.condition_status === 'NORMAL';
        await db
          .prepare(
            `UPDATE warehouse_receipt_sessions SET
               unique_received_pieces = MAX(0, unique_received_pieces - ?),
               normal_pieces = MAX(0, normal_pieces - ?),
               exception_pieces = MAX(0, exception_pieces - ?),
               status = 'IN_PROGRESS', gate_decision_id = NULL, version_no = version_no + 1, updated_at = ?
             WHERE receipt_session_id = ?`
          )
          .bind(Math.abs(original.quantity_delta), wasNormal ? Math.abs(original.quantity_delta) : 0,
            wasNormal ? 0 : Math.abs(original.quantity_delta), new Date().toISOString(), c.req.param('id'))
          .run();
        await db.prepare(`UPDATE cargo_units SET inventory_state = 'EXPECTED', updated_at = ? WHERE cargo_unit_id = ?`)
          .bind(new Date().toISOString(), original.cargo_unit_id).run();
        await appendOperationEvent(db, actor, {
          aggregateType: 'WarehouseReceiptSession', aggregateId: c.req.param('id'),
          eventType: 'PREWAREHOUSE_COUNT_CORRECTED', eventAction: 'REVERSE', idempotencyKey: idem,
          shipmentId: original.shipment_id, reasonCode: requiredText(body, 'reason_code'),
          payload: { count_event_id: correctionId, reverses_count_event_id: originalId, cargo_unit_id: original.cargo_unit_id }
        });
        return response(c, { result: 'CORRECTED', count_event_id: correctionId, summary: await receiptSummary(db, c.req.param('id')) });
      } catch (error) {
        return handleError(c, error);
      }
    }
  );

  app.get(
    '/api/v1/shipments/:id/cargo-units',
    requireRoles(['platform_admin', 'station_supervisor', 'PREWH_OPERATOR', 'TRUCK_OPERATOR', 'TAS_OPERATOR', 'A1_CARGO_CONTROLLER', 'B1_TAS_STATION_CONTROLLER']),
    async (c) => {
      try {
        const db = requireV14Db(c.env);
        const state = String(c.req.query('inventory_state') ?? '').trim();
        const rows = await db
          .prepare(
            `SELECT * FROM cargo_units WHERE shipment_id = ? AND archived_at IS NULL
             AND (? = '' OR inventory_state = ?) ORDER BY unit_sequence, business_barcode LIMIT 10000`
          )
          .bind(c.req.param('id'), state, state)
          .all();
        return response(c, { items: rows.results, total: rows.results.length });
      } catch (error) {
        return handleError(c, error);
      }
    }
  );
}
