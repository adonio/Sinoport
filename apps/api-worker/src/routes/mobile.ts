import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { StationServices } from '@sinoport/domain';
import { mapMobileRoleKeyToRoleCodes, signAuthToken } from '@sinoport/auth';
import { handleServiceError, jsonError } from '../lib/http';
import { normalizeStationListQuery } from '../lib/policy';
import type { ApiApp } from '../index';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

function isoNow() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function resolveScopedStation(actor: any, requestedStationId?: string) {
  const stationId = requestedStationId || actor.stationScope?.[0] || 'MME';

  if (!actor.stationScope?.includes(stationId)) {
    throw new Error('STATION_SCOPE_DENIED');
  }

  return stationId;
}

async function resolveMobileUserId(c: any, requestedUserId: string | undefined) {
  if (!c.env.DB) {
    return requestedUserId || 'demo-mobile';
  }

  if (requestedUserId) {
    const existing = (await c.env.DB.prepare(`SELECT user_id FROM users WHERE user_id = ? LIMIT 1`)
      .bind(requestedUserId)
      .first()) as { user_id: string } | null;

    if (existing?.user_id) {
      return existing.user_id;
    }
  }

  const fallback = (await c.env.DB.prepare(`SELECT user_id FROM users WHERE user_id = 'demo-mobile' LIMIT 1`).first()) as {
    user_id: string;
  } | null;
  return fallback?.user_id || 'demo-mobile';
}

async function listInboundCountRecords(db: any, stationId: string, flightNo: string) {
  const rows = await db
    ?.prepare(
      `
        SELECT awb_no, counted_boxes, status, scanned_serials_json, note, updated_at
        FROM inbound_count_records
        WHERE station_id = ?
          AND flight_no = ?
        ORDER BY awb_no ASC
      `
    )
    .bind(stationId, flightNo)
    .all();

  return (rows?.results || []).reduce((acc: Record<string, any>, row: any) => {
    acc[row.awb_no] = {
      countedBoxes: Number(row.counted_boxes ?? 0),
      status: row.status,
      scannedSerials: parseJsonField(row.scanned_serials_json, []),
      note: row.note || '',
      updatedAt: row.updated_at || null
    };
    return acc;
  }, {});
}

export function registerMobileRoutes(app: ApiApp, getStationServices: (c: any) => StationServices, requireRoles: RequireRoles) {
  app.post('/api/v1/mobile/login', async (c) => {
    try {
      const body = await c.req.json();
      const stationCode = body.stationCode || body.station_code || 'MME';
      const roleKey = body.roleKey || body.role_key || 'receiver';
      const roleIds = mapMobileRoleKeyToRoleCodes(roleKey);
      const secret = c.env.AUTH_TOKEN_SECRET || 'sinoport-local-dev-secret';
      const requestedUserId = body.employeeId ? `mobile-${body.employeeId}` : body.userId || body.user_id;
      const userId = await resolveMobileUserId(c, requestedUserId);

      const token = await signAuthToken(
        {
          user_id: userId,
          role_ids: roleIds,
          station_scope: [stationCode],
          tenant_id: 'sinoport-demo',
          client_source: 'mobile-pda'
        },
        secret
      );

      return c.json({
        data: {
          token,
          actor: {
            user_id: userId,
            role_ids: roleIds,
            station_scope: [stationCode],
            tenant_id: 'sinoport-demo',
            client_source: 'mobile-pda'
          }
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/login');
    }
  });

  app.get('/api/v1/mobile/tasks', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const result = await services.listMobileTasks(normalizeStationListQuery(c.var.actor, c.req.query()));
      return c.json(result);
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/tasks');
    }
  });

  app.get(
    '/api/v1/mobile/state/:scopeKey',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
        const scopeKey = c.req.param('scopeKey');
        const row = (await c.env.DB?.prepare(
          `
            SELECT station_id, scope_key, state_json, updated_at
            FROM mobile_state_store
            WHERE station_id = ?
              AND scope_key = ?
            LIMIT 1
          `
        )
          .bind(stationId, scopeKey)
          .first()) as { station_id: string; scope_key: string; state_json: string; updated_at: string } | null;

        return c.json({
          data: {
            station_id: stationId,
            scope_key: scopeKey,
            state: row ? JSON.parse(row.state_json) : null,
            updated_at: row?.updated_at || null
          }
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
          return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
        }
        return handleServiceError(c, error, 'GET /mobile/state/:scopeKey');
      }
    }
  );

  app.post(
    '/api/v1/mobile/state/:scopeKey',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
        const scopeKey = c.req.param('scopeKey');
        const body = await c.req.json();

        if (typeof body?.state === 'undefined') {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'state is required');
        }

        await c.env.DB?.prepare(
          `
            INSERT INTO mobile_state_store (
              station_id,
              scope_key,
              state_json,
              updated_by,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(station_id, scope_key) DO UPDATE SET
              state_json = excluded.state_json,
              updated_by = excluded.updated_by,
              updated_at = excluded.updated_at
          `
        )
          .bind(
            stationId,
            scopeKey,
            JSON.stringify(body.state),
            c.var.actor.userId,
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();

        return c.json({
          data: {
            station_id: stationId,
            scope_key: scopeKey,
            state: body.state
          }
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
          return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
        }
        return handleServiceError(c, error, 'POST /mobile/state/:scopeKey');
      }
    }
  );

  app.get('/api/v1/mobile/inbound/:flightNo/counts', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const data = await listInboundCountRecords(c.env.DB, stationId, c.req.param('flightNo'));
      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), records: data } });
    } catch (error) {
      if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
        return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
      }
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/counts');
    }
  });

  app.post('/api/v1/mobile/inbound/:flightNo/counts/:awbNo', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const countRecordId = `CNT-${c.req.param('flightNo')}-${c.req.param('awbNo')}`.replace(/[^A-Za-z0-9-]/g, '');
      const now = isoNow();

      await c.env.DB?.prepare(
        `
          INSERT INTO inbound_count_records (
            count_record_id,
            station_id,
            flight_no,
            awb_no,
            counted_boxes,
            status,
            scanned_serials_json,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, awb_no) DO UPDATE SET
            counted_boxes = excluded.counted_boxes,
            status = excluded.status,
            scanned_serials_json = excluded.scanned_serials_json,
            note = excluded.note,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
        .bind(
          countRecordId,
          stationId,
          c.req.param('flightNo'),
          c.req.param('awbNo'),
          body.counted_boxes ?? body.countedBoxes ?? 0,
          body.status || '未开始',
          JSON.stringify(body.scanned_serials ?? body.scannedSerials ?? []),
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      return c.json({
        data: {
          flight_no: c.req.param('flightNo'),
          awb_no: c.req.param('awbNo'),
          counted_boxes: body.counted_boxes ?? body.countedBoxes ?? 0,
          status: body.status || '未开始'
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/inbound/:flightNo/counts/:awbNo');
    }
  });

  app.get('/api/v1/mobile/inbound/:flightNo/pallets', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const rows = await c.env.DB?.prepare(
        `
          SELECT pallet_id, pallet_no, pallet_status, total_boxes, total_weight, storage_location, note
          FROM inbound_pallets
          WHERE station_id = ?
            AND flight_no = ?
          ORDER BY pallet_no ASC
        `
      )
        .bind(stationId, c.req.param('flightNo'))
        .all();

      const pallets = await Promise.all(
        (rows?.results || []).map(async (row: any) => {
          const items = await c.env.DB?.prepare(
            `
              SELECT awb_no, boxes, weight
              FROM inbound_pallet_items
              WHERE pallet_id = ?
              ORDER BY awb_no ASC
            `
          )
            .bind(row.pallet_id)
            .all();

          return {
            palletId: row.pallet_id,
            palletNo: row.pallet_no,
            status: row.pallet_status,
            totalBoxes: Number(row.total_boxes ?? 0),
            totalWeight: Number(row.total_weight ?? 0),
            storageLocation: row.storage_location,
            note: row.note || '',
            items: (items?.results || []).map((item: any) => ({
              awb: item.awb_no,
              boxes: Number(item.boxes ?? 0),
              weight: Number(item.weight ?? 0)
            }))
          };
        })
      );

      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), pallets } });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/pallets');
    }
  });

  app.post('/api/v1/mobile/inbound/:flightNo/pallets', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const existing = await c.env.DB?.prepare(
        `
          SELECT pallet_id
          FROM inbound_pallets
          WHERE station_id = ?
            AND flight_no = ?
            AND pallet_no = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('flightNo'), body.pallet_no || body.palletNo)
        .first<{ pallet_id: string }>();
      const palletId = existing?.pallet_id || body.pallet_id || createId('PLT');
      const items = Array.isArray(body.items) ? body.items : [];
      const now = isoNow();

      await c.env.DB?.prepare(
        `
          INSERT INTO inbound_pallets (
            pallet_id,
            station_id,
            flight_no,
            pallet_no,
            pallet_status,
            total_boxes,
            total_weight,
            storage_location,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, pallet_no) DO UPDATE SET
            pallet_status = excluded.pallet_status,
            total_boxes = excluded.total_boxes,
            total_weight = excluded.total_weight,
            storage_location = excluded.storage_location,
            note = excluded.note,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
        .bind(
          palletId,
          stationId,
          c.req.param('flightNo'),
          body.pallet_no || body.palletNo,
          body.status || body.pallet_status || '计划',
          body.total_boxes ?? body.totalBoxes ?? 0,
          body.total_weight ?? body.totalWeight ?? 0,
          body.storage_location || body.storageLocation || null,
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      await c.env.DB?.prepare(`DELETE FROM inbound_pallet_items WHERE pallet_id = ?`).bind(palletId).run();
      for (const item of items) {
        await c.env.DB?.prepare(
          `
            INSERT INTO inbound_pallet_items (
              pallet_item_id,
              pallet_id,
              awb_no,
              boxes,
              weight,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        )
          .bind(createId('PLI'), palletId, item.awb || item.awb_no, item.boxes ?? 0, item.weight ?? 0, now, now)
          .run();
      }

      return c.json({ data: { pallet_id: palletId } }, 201);
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/inbound/:flightNo/pallets');
    }
  });

  app.patch('/api/v1/mobile/inbound/pallets/:palletNo', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const row = await c.env.DB?.prepare(
        `
          SELECT pallet_id
          FROM inbound_pallets
          WHERE station_id = ?
            AND pallet_no = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('palletNo'))
        .first<{ pallet_id: string }>();

      if (!row) {
        return jsonError(c, 404, 'PALLET_NOT_FOUND', 'Pallet does not exist');
      }

      await c.env.DB?.prepare(
        `
          UPDATE inbound_pallets
          SET pallet_status = COALESCE(?, pallet_status),
              total_boxes = COALESCE(?, total_boxes),
              total_weight = COALESCE(?, total_weight),
              storage_location = COALESCE(?, storage_location),
              note = COALESCE(?, note),
              updated_by = ?,
              updated_at = ?
          WHERE pallet_id = ?
        `
      )
        .bind(
          body.status ?? null,
          body.total_boxes ?? body.totalBoxes ?? null,
          body.total_weight ?? body.totalWeight ?? null,
          body.storage_location ?? body.storageLocation ?? null,
          body.note ?? null,
          c.var.actor.userId,
          isoNow(),
          row.pallet_id
        )
        .run();

      return c.json({ data: { pallet_no: c.req.param('palletNo'), ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/inbound/pallets/:palletNo');
    }
  });

  app.get('/api/v1/mobile/inbound/:flightNo/loading-plans', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const rows = await c.env.DB?.prepare(
        `
          SELECT loading_plan_id, truck_plate, vehicle_model, driver_name, collection_note, forklift_driver, checker, arrival_time, depart_time, total_boxes, total_weight, plan_status, note
          FROM loading_plans
          WHERE station_id = ?
            AND flight_no = ?
          ORDER BY created_at ASC
        `
      )
        .bind(stationId, c.req.param('flightNo'))
        .all();

      const plans = await Promise.all(
        (rows?.results || []).map(async (row: any) => {
          const items = await c.env.DB?.prepare(
            `
              SELECT pallet_no
              FROM loading_plan_items
              WHERE loading_plan_id = ?
              ORDER BY pallet_no ASC
            `
          )
            .bind(row.loading_plan_id)
            .all();
          return {
            id: row.loading_plan_id,
            truckPlate: row.truck_plate,
            vehicleModel: row.vehicle_model,
            driverName: row.driver_name,
            collectionNote: row.collection_note,
            forkliftDriver: row.forklift_driver,
            checker: row.checker,
            arrivalTime: row.arrival_time,
            departTime: row.depart_time,
            totalBoxes: Number(row.total_boxes ?? 0),
            totalWeight: Number(row.total_weight ?? 0),
            status: row.plan_status,
            note: row.note || '',
            pallets: (items?.results || []).map((item: any) => item.pallet_no)
          };
        })
      );

      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), plans } });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/loading-plans');
    }
  });

  app.post('/api/v1/mobile/inbound/:flightNo/loading-plans', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const planId = body.loading_plan_id || body.id || createId('LOD');
      const now = isoNow();
      const pallets = Array.isArray(body.pallets) ? body.pallets : [];

      await c.env.DB?.prepare(
        `
          INSERT INTO loading_plans (
            loading_plan_id,
            station_id,
            flight_no,
            truck_plate,
            vehicle_model,
            driver_name,
            collection_note,
            forklift_driver,
            checker,
            arrival_time,
            depart_time,
            total_boxes,
            total_weight,
            plan_status,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
        .bind(
          planId,
          stationId,
          c.req.param('flightNo'),
          body.truck_plate || body.truckPlate,
          body.vehicle_model || body.vehicleModel || null,
          body.driver_name || body.driverName || null,
          body.collection_note || body.collectionNote || null,
          body.forklift_driver || body.forkliftDriver || null,
          body.checker || null,
          body.arrival_time || body.arrivalTime || null,
          body.depart_time || body.departTime || null,
          body.total_boxes ?? body.totalBoxes ?? 0,
          body.total_weight ?? body.totalWeight ?? 0,
          body.status || body.plan_status || '计划',
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      await c.env.DB?.prepare(`DELETE FROM loading_plan_items WHERE loading_plan_id = ?`).bind(planId).run();
      for (const palletNo of pallets) {
        await c.env.DB?.prepare(
          `
            INSERT INTO loading_plan_items (
              loading_plan_item_id,
              loading_plan_id,
              pallet_no,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?)
          `
        )
          .bind(createId('LPI'), planId, palletNo, now, now)
          .run();
      }

      return c.json({ data: { loading_plan_id: planId } }, 201);
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/inbound/:flightNo/loading-plans');
    }
  });

  app.patch('/api/v1/mobile/inbound/loading-plans/:planId', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const body = await c.req.json();
      await c.env.DB?.prepare(
        `
          UPDATE loading_plans
          SET truck_plate = COALESCE(?, truck_plate),
              vehicle_model = COALESCE(?, vehicle_model),
              driver_name = COALESCE(?, driver_name),
              collection_note = COALESCE(?, collection_note),
              forklift_driver = COALESCE(?, forklift_driver),
              checker = COALESCE(?, checker),
              arrival_time = COALESCE(?, arrival_time),
              depart_time = COALESCE(?, depart_time),
              total_boxes = COALESCE(?, total_boxes),
              total_weight = COALESCE(?, total_weight),
              plan_status = COALESCE(?, plan_status),
              note = COALESCE(?, note),
              updated_by = ?,
              updated_at = ?
          WHERE loading_plan_id = ?
        `
      )
        .bind(
          body.truck_plate ?? body.truckPlate ?? null,
          body.vehicle_model ?? body.vehicleModel ?? null,
          body.driver_name ?? body.driverName ?? null,
          body.collection_note ?? body.collectionNote ?? null,
          body.forklift_driver ?? body.forkliftDriver ?? null,
          body.checker ?? null,
          body.arrival_time ?? body.arrivalTime ?? null,
          body.depart_time ?? body.departTime ?? null,
          body.total_boxes ?? body.totalBoxes ?? null,
          body.total_weight ?? body.totalWeight ?? null,
          body.status ?? body.plan_status ?? null,
          body.note ?? null,
          c.var.actor.userId,
          isoNow(),
          c.req.param('planId')
        )
        .run();

      return c.json({ data: { loading_plan_id: c.req.param('planId'), ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/inbound/loading-plans/:planId');
    }
  });

  app.get('/api/v1/mobile/outbound/:flightNo/receipts', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const rows = await c.env.DB?.prepare(
        `
          SELECT awb_no, received_pieces, received_weight, receipt_status, note
          FROM outbound_receipts
          WHERE station_id = ?
            AND flight_no = ?
          ORDER BY awb_no ASC
        `
      )
        .bind(stationId, c.req.param('flightNo'))
        .all();

      const receipts = (rows?.results || []).reduce((acc: Record<string, any>, row: any) => {
        acc[row.awb_no] = {
          receivedPieces: Number(row.received_pieces ?? 0),
          receivedWeight: Number(row.received_weight ?? 0),
          status: row.receipt_status,
          note: row.note || ''
        };
        return acc;
      }, {});

      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), receipts } });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/outbound/:flightNo/receipts');
    }
  });

  app.post('/api/v1/mobile/outbound/:flightNo/receipts/:awbNo', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const now = isoNow();

      await c.env.DB?.prepare(
        `
          INSERT INTO outbound_receipts (
            receipt_record_id,
            station_id,
            flight_no,
            awb_no,
            received_pieces,
            received_weight,
            receipt_status,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, awb_no) DO UPDATE SET
            received_pieces = excluded.received_pieces,
            received_weight = excluded.received_weight,
            receipt_status = excluded.receipt_status,
            note = excluded.note,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
        .bind(
          `REC-${c.req.param('flightNo')}-${c.req.param('awbNo')}`.replace(/[^A-Za-z0-9-]/g, ''),
          stationId,
          c.req.param('flightNo'),
          c.req.param('awbNo'),
          body.received_pieces ?? body.receivedPieces ?? 0,
          body.received_weight ?? body.receivedWeight ?? 0,
          body.status || body.receipt_status || '已收货',
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      return c.json({ data: { awb_no: c.req.param('awbNo'), ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/outbound/:flightNo/receipts/:awbNo');
    }
  });

  app.get('/api/v1/mobile/outbound/:flightNo/containers', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const rows = await c.env.DB?.prepare(
        `
          SELECT container_id, container_code, total_boxes, total_weight, reviewed_weight, container_status, loaded_at, note
          FROM outbound_containers
          WHERE station_id = ?
            AND flight_no = ?
          ORDER BY container_code ASC
        `
      )
        .bind(stationId, c.req.param('flightNo'))
        .all();

      const containers = await Promise.all(
        (rows?.results || []).map(async (row: any) => {
          const items = await c.env.DB?.prepare(
            `
              SELECT awb_no, pieces, boxes, weight
              FROM outbound_container_items
              WHERE container_id = ?
              ORDER BY awb_no ASC
            `
          )
            .bind(row.container_id)
            .all();

          return {
            containerId: row.container_id,
            boardCode: row.container_code,
            totalBoxes: Number(row.total_boxes ?? 0),
            totalWeightKg: Number(row.total_weight ?? 0),
            reviewedWeightKg: Number(row.reviewed_weight ?? 0),
            status: row.container_status,
            loadedAt: row.loaded_at || null,
            note: row.note || '',
            entries: (items?.results || []).map((item: any) => ({
              awb: item.awb_no,
              pieces: Number(item.pieces ?? 0),
              boxes: Number(item.boxes ?? 0),
              weight: Number(item.weight ?? 0)
            }))
          };
        })
      );

      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), containers } });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/outbound/:flightNo/containers');
    }
  });

  app.post('/api/v1/mobile/outbound/:flightNo/containers', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const existing = await c.env.DB?.prepare(
        `
          SELECT container_id
          FROM outbound_containers
          WHERE station_id = ?
            AND flight_no = ?
            AND container_code = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('flightNo'), body.container_code || body.boardCode)
        .first<{ container_id: string }>();
      const containerId = existing?.container_id || body.container_id || createId('ULD');
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const now = isoNow();

      await c.env.DB?.prepare(
        `
          INSERT INTO outbound_containers (
            container_id,
            station_id,
            flight_no,
            container_code,
            total_boxes,
            total_weight,
            reviewed_weight,
            container_status,
            loaded_at,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, container_code) DO UPDATE SET
            total_boxes = excluded.total_boxes,
            total_weight = excluded.total_weight,
            reviewed_weight = excluded.reviewed_weight,
            container_status = excluded.container_status,
            loaded_at = excluded.loaded_at,
            note = excluded.note,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
        .bind(
          containerId,
          stationId,
          c.req.param('flightNo'),
          body.container_code || body.boardCode,
          body.total_boxes ?? body.totalBoxes ?? 0,
          body.total_weight ?? body.totalWeightKg ?? 0,
          body.reviewed_weight ?? body.reviewedWeightKg ?? 0,
          body.status || body.container_status || '待装机',
          body.loaded_at || body.loadedAt || null,
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      await c.env.DB?.prepare(`DELETE FROM outbound_container_items WHERE container_id = ?`).bind(containerId).run();
      for (const entry of entries) {
        await c.env.DB?.prepare(
          `
            INSERT INTO outbound_container_items (
              container_item_id,
              container_id,
              awb_no,
              pieces,
              boxes,
              weight,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
          .bind(createId('ULI'), containerId, entry.awb || entry.awb_no, entry.pieces ?? 0, entry.boxes ?? 0, entry.weight ?? 0, now, now)
          .run();
      }

      return c.json({ data: { container_id: containerId } }, 201);
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/outbound/:flightNo/containers');
    }
  });

  app.patch('/api/v1/mobile/outbound/containers/:containerCode', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      await c.env.DB?.prepare(
        `
          UPDATE outbound_containers
          SET total_boxes = COALESCE(?, total_boxes),
              total_weight = COALESCE(?, total_weight),
              reviewed_weight = COALESCE(?, reviewed_weight),
              container_status = COALESCE(?, container_status),
              loaded_at = COALESCE(?, loaded_at),
              note = COALESCE(?, note),
              updated_by = ?,
              updated_at = ?
          WHERE station_id = ?
            AND container_code = ?
        `
      )
        .bind(
          body.total_boxes ?? body.totalBoxes ?? null,
          body.total_weight ?? body.totalWeightKg ?? null,
          body.reviewed_weight ?? body.reviewedWeightKg ?? null,
          body.status ?? body.container_status ?? null,
          body.loaded_at ?? body.loadedAt ?? null,
          body.note ?? null,
          c.var.actor.userId,
          isoNow(),
          stationId,
          c.req.param('containerCode')
        )
        .run();

      return c.json({ data: { container_code: c.req.param('containerCode'), ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/outbound/containers/:containerCode');
    }
  });

  app.post('/api/v1/mobile/tasks/:taskId/accept', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json();
      const result = await services.acceptMobileTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/tasks/:taskId/accept');
    }
  });

  app.post('/api/v1/mobile/tasks/:taskId/start', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json();
      const result = await services.startMobileTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/tasks/:taskId/start');
    }
  });

  app.post('/api/v1/mobile/tasks/:taskId/evidence', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json();
      const result = await services.uploadMobileTaskEvidence(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/tasks/:taskId/evidence');
    }
  });

  app.post('/api/v1/mobile/tasks/:taskId/complete', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json();
      const result = await services.completeMobileTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/tasks/:taskId/complete');
    }
  });

  app.post('/api/v1/mobile/tasks/:taskId/exception', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json();
      const result = await services.raiseTaskException(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/tasks/:taskId/exception');
    }
  });
}
