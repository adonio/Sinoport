import type { MiddlewareHandler } from 'hono';
import { jsonError } from '../lib/http';
import type { RoleCode } from '@sinoport/contracts';
import type { StationServices } from '@sinoport/domain';
import { signAuthToken, verifyPasswordHash } from '@sinoport/auth';
import { handleServiceError } from '../lib/http';
import {
  assertStationAccess,
  authorizeTaskAssignment,
  normalizeDocumentInput,
  normalizeInboundFlightListQuery,
  normalizeStationListQuery
} from '../lib/policy';
import type { ApiApp } from '../index';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

type AuditScope = Map<string, Set<string>>;

async function resolveKnownUserId(c: any, requestedUserId: string | undefined, fallbackUserId: string) {
  if (!c.env.DB) {
    return requestedUserId || fallbackUserId;
  }

  if (requestedUserId) {
    const existing = (await c.env.DB.prepare(`SELECT user_id FROM users WHERE user_id = ? LIMIT 1`)
      .bind(requestedUserId)
      .first()) as { user_id: string } | null;

    if (existing?.user_id) {
      return existing.user_id;
    }
  }

  const fallback = (await c.env.DB.prepare(`SELECT user_id FROM users WHERE user_id = ? LIMIT 1`)
    .bind(fallbackUserId)
    .first()) as { user_id: string } | null;

  return fallback?.user_id || fallbackUserId;
}

function addAuditObject(scope: AuditScope, objectType: string, objectId: string | null | undefined) {
  if (!objectId) return;

  if (!scope.has(objectType)) {
    scope.set(objectType, new Set());
  }

  scope.get(objectType)?.add(objectId);
}

async function resolveAuditScope(db: any, objectType: string, objectKey?: string, objectId?: string) {
  const scope: AuditScope = new Map();
  const lookup = objectId || objectKey;

  if (!lookup) {
    return scope;
  }

  if (objectType === 'Flight') {
    const flight = (await db
      .prepare(`SELECT flight_id FROM flights WHERE flight_id = ? OR flight_no = ? LIMIT 1`)
      .bind(lookup, lookup)
      .first()) as { flight_id: string } | null;

    addAuditObject(scope, 'Flight', flight?.flight_id);
  }

  if (objectType === 'AWB') {
    const awb = (await db
      .prepare(`SELECT awb_id, shipment_id, flight_id FROM awbs WHERE awb_id = ? OR awb_no = ? LIMIT 1`)
      .bind(lookup, lookup)
      .first()) as { awb_id: string; shipment_id: string | null; flight_id: string | null } | null;

    addAuditObject(scope, 'AWB', awb?.awb_id);
    addAuditObject(scope, 'Shipment', awb?.shipment_id);
    addAuditObject(scope, 'Flight', awb?.flight_id);
  }

  if (objectType === 'Shipment') {
    const shipmentLookup = lookup.startsWith('in-') || lookup.startsWith('out-') ? lookup.split('-').slice(1).join('-') : lookup;
    const shipment =
      ((await db
        .prepare(
          `
            SELECT s.shipment_id
            FROM shipments s
            LEFT JOIN awbs a ON a.shipment_id = s.shipment_id
            WHERE s.shipment_id = ?
               OR a.awb_no = ?
            LIMIT 1
          `
        )
        .bind(shipmentLookup, shipmentLookup)
        .first()) as { shipment_id: string } | null) || null;

    addAuditObject(scope, 'Shipment', shipment?.shipment_id);
  }

  if (objectType === 'Task') {
    const task = (await db
      .prepare(
        `
          SELECT task_id, related_object_type, related_object_id
          FROM tasks
          WHERE task_id = ?
          LIMIT 1
        `
      )
      .bind(lookup)
      .first()) as { task_id: string; related_object_type: string; related_object_id: string } | null;

    addAuditObject(scope, 'Task', task?.task_id);
    if (task?.related_object_type) {
      addAuditObject(scope, task.related_object_type, task.related_object_id);
    }
  }

  if (objectType === 'Exception') {
    const exception = (await db
      .prepare(
        `
          SELECT exception_id, related_object_type, related_object_id, linked_task_id
          FROM exceptions
          WHERE exception_id = ?
          LIMIT 1
        `
      )
      .bind(lookup)
      .first()) as { exception_id: string; related_object_type: string; related_object_id: string; linked_task_id: string | null } | null;

    addAuditObject(scope, 'Exception', exception?.exception_id);
    if (exception?.related_object_type) {
      addAuditObject(scope, exception.related_object_type, exception.related_object_id);
    }
    addAuditObject(scope, 'Task', exception?.linked_task_id);
  }

  if (objectType === 'Document') {
    const document = (await db
      .prepare(
        `
          SELECT document_id, related_object_type, related_object_id
          FROM documents
          WHERE document_id = ?
          LIMIT 1
        `
      )
      .bind(lookup)
      .first()) as { document_id: string; related_object_type: string; related_object_id: string } | null;

    addAuditObject(scope, 'Document', document?.document_id);
    if (document?.related_object_type) {
      addAuditObject(scope, document.related_object_type, document.related_object_id);
    }
  }

  const flightIds = Array.from(scope.get('Flight') || []);
  const awbIds = Array.from(scope.get('AWB') || []);
  const shipmentIds = Array.from(scope.get('Shipment') || []);
  const taskIds = Array.from(scope.get('Task') || []);

  if (flightIds.length || awbIds.length || shipmentIds.length) {
    const relatedClauses: string[] = [];
    const relatedParams: unknown[] = [];

    if (flightIds.length) {
      relatedClauses.push(`(related_object_type = 'Flight' AND related_object_id IN (${flightIds.map(() => '?').join(', ')}))`);
      relatedParams.push(...flightIds);
    }

    if (awbIds.length) {
      relatedClauses.push(`(related_object_type = 'AWB' AND related_object_id IN (${awbIds.map(() => '?').join(', ')}))`);
      relatedParams.push(...awbIds);
    }

    if (shipmentIds.length) {
      relatedClauses.push(`(related_object_type = 'Shipment' AND related_object_id IN (${shipmentIds.map(() => '?').join(', ')}))`);
      relatedParams.push(...shipmentIds);
    }

    if (relatedClauses.length) {
      const [documents, tasks, exceptions] = await Promise.all([
        db
          .prepare(`SELECT document_id FROM documents WHERE ${relatedClauses.join(' OR ')}`)
          .bind(...relatedParams)
          .all(),
        db
          .prepare(`SELECT task_id FROM tasks WHERE ${relatedClauses.join(' OR ')}`)
          .bind(...relatedParams)
          .all(),
        db
          .prepare(`SELECT exception_id FROM exceptions WHERE ${relatedClauses.join(' OR ')}`)
          .bind(...relatedParams)
          .all()
      ]);

      for (const row of documents?.results || []) addAuditObject(scope, 'Document', row.document_id);
      for (const row of tasks?.results || []) addAuditObject(scope, 'Task', row.task_id);
      for (const row of exceptions?.results || []) addAuditObject(scope, 'Exception', row.exception_id);
    }
  }

  const expandedTaskIds = Array.from(scope.get('Task') || []);
  if (expandedTaskIds.length) {
    const placeholders = expandedTaskIds.map(() => '?').join(', ');
    const [taskDocuments, taskExceptions] = await Promise.all([
      db
        .prepare(`SELECT document_id FROM documents WHERE related_object_type = 'Task' AND related_object_id IN (${placeholders})`)
        .bind(...expandedTaskIds)
        .all(),
      db
        .prepare(`SELECT exception_id FROM exceptions WHERE linked_task_id IN (${placeholders})`)
        .bind(...expandedTaskIds)
        .all()
    ]);

    for (const row of taskDocuments?.results || []) addAuditObject(scope, 'Document', row.document_id);
    for (const row of taskExceptions?.results || []) addAuditObject(scope, 'Exception', row.exception_id);
  }

  return scope;
}

function buildAuditScopeSql(scope: AuditScope) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const [objectType, ids] of scope.entries()) {
    const objectIds = Array.from(ids);
    if (!objectIds.length) continue;
    clauses.push(`(object_type = ? AND object_id IN (${objectIds.map(() => '?').join(', ')}))`);
    params.push(objectType, ...objectIds);
  }

  return {
    whereClause: clauses.join(' OR '),
    params
  };
}

async function loadUserProfile(db: any, userId: string) {
  const user = (await db
    .prepare(
      `
        SELECT user_id, display_name, email, default_station_id
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `
    )
    .bind(userId)
    .first()) as { user_id: string; display_name: string; email: string | null; default_station_id: string | null } | null;

  if (!user) return null;

  const roles = await db
    .prepare(
      `
        SELECT role_code, station_id
        FROM user_roles
        WHERE user_id = ?
        ORDER BY role_code ASC
      `
    )
    .bind(userId)
    .all();

  return {
    ...user,
    roles: roles?.results || []
  };
}

async function issueStationSession(c: any, params: { userId: string; stationCode: string; roleIds: RoleCode[] }) {
  const secret = c.env.AUTH_TOKEN_SECRET || 'sinoport-local-dev-secret';
  const actor = {
    user_id: params.userId,
    role_ids: params.roleIds,
    station_scope: [params.stationCode],
    tenant_id: 'sinoport-demo',
    client_source: 'station-web' as const
  };
  const token = await signAuthToken(actor, secret, 60 * 60);
  const refreshToken = `rfr_${crypto.randomUUID()}_${crypto.randomUUID()}`;
  const refreshTokenId = `REF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString();

  await c.env.DB?.prepare(
    `
      INSERT INTO station_refresh_tokens (
        refresh_token_id,
        user_id,
        station_id,
        client_source,
        token_value,
        expires_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(refreshTokenId, params.userId, params.stationCode, 'station-web', refreshToken, expiresAt, now.toISOString(), now.toISOString())
    .run();

  const profile = (await loadUserProfile(c.env.DB, params.userId)) || {
    user_id: params.userId,
    display_name: params.userId,
    email: `${params.userId}@sinoport.local`,
    default_station_id: params.stationCode,
    roles: params.roleIds.map((roleCode: RoleCode) => ({ role_code: roleCode, station_id: params.stationCode }))
  };

  return {
    token,
    refresh_token: refreshToken,
    expires_at: new Date(now.getTime() + 1000 * 60 * 60).toISOString(),
    actor,
    user: {
      user_id: profile.user_id,
      display_name: profile.display_name,
      email: profile.email,
      default_station_id: profile.default_station_id
    }
  };
}

async function authenticateStationUser(c: any, body: any) {
  const email = String(body.email || body.login_name || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return null;
  }

  const credential = (await c.env.DB?.prepare(
    `
      SELECT sc.user_id, sc.password_hash, sc.login_name, u.default_station_id
      FROM station_credentials sc
      JOIN users u ON u.user_id = sc.user_id
      WHERE LOWER(sc.login_name) = ?
      LIMIT 1
    `
  )
    .bind(email)
    .first()) as { user_id: string; password_hash: string; login_name: string; default_station_id: string | null } | null;

  if (!credential) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const matched = await verifyPasswordHash(password, credential.password_hash);
  if (!matched) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const profile = await loadUserProfile(c.env.DB, credential.user_id);
  if (!profile) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const requestedStation = body.stationCode || body.station_code || profile.default_station_id || profile.roles[0]?.station_id || 'MME';
  const stationScopedRoles = profile.roles
    .filter((item: any) => !item.station_id || item.station_id === requestedStation)
    .map((item: any) => item.role_code);

  return {
    userId: profile.user_id,
    stationCode: requestedStation,
    roleIds: stationScopedRoles.length ? stationScopedRoles : ['station_supervisor']
  };
}

export function registerStationRoutes(app: ApiApp, getStationServices: (c: any) => StationServices, requireRoles: RequireRoles) {
  app.post('/api/v1/station/login', async (c) => {
    try {
      const body = await c.req.json();
      const formalLogin = await authenticateStationUser(c, body).catch((error) => {
        if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
          throw jsonError(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        }

        throw error;
      });

      if (formalLogin) {
        return c.json({
          data: await issueStationSession(c, formalLogin)
        });
      }

      const stationCode = body.stationCode || body.station_code || 'MME';
      const roleIds = Array.isArray(body.roleIds) && body.roleIds.length ? body.roleIds : [body.roleCode || 'station_supervisor'];
      const preferredFallback =
        roleIds.includes('document_desk')
          ? 'demo-docdesk'
          : roleIds.includes('check_worker')
            ? 'demo-checker'
            : roleIds.includes('mobile_operator')
              ? 'demo-mobile'
              : 'demo-supervisor';
      const userId = await resolveKnownUserId(c, body.userId || body.user_id, preferredFallback);

      return c.json({
        data: await issueStationSession(c, { userId, stationCode, roleIds })
      });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      return handleServiceError(c, error, 'POST /station/login');
    }
  });

  app.get('/api/v1/station/me', async (c) => {
    try {
      const actor = c.var.actor;
      const profile = await loadUserProfile(c.env.DB, actor.userId);

      return c.json({
        data: {
          actor: {
            user_id: actor.userId,
            role_ids: actor.roleIds,
            station_scope: actor.stationScope,
            tenant_id: actor.tenantId,
            client_source: actor.clientSource
          },
          user: profile
            ? {
                user_id: profile.user_id,
                display_name: profile.display_name,
                email: profile.email,
                default_station_id: profile.default_station_id
              }
            : {
                user_id: actor.userId,
                display_name: actor.userId,
                email: `${actor.userId}@sinoport.local`,
                default_station_id: actor.stationScope[0] || 'MME'
              }
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /station/me');
    }
  });

  app.post('/api/v1/station/refresh', async (c) => {
    try {
      const body = await c.req.json();
      const refreshToken = String(body.refresh_token || '').trim();

      if (!refreshToken) {
        return jsonError(c, 400, 'VALIDATION_ERROR', 'refresh_token is required');
      }

      const row = (await c.env.DB?.prepare(
        `
          SELECT refresh_token_id, user_id, station_id, expires_at, revoked_at
          FROM station_refresh_tokens
          WHERE token_value = ?
          LIMIT 1
        `
      )
        .bind(refreshToken)
        .first()) as { refresh_token_id: string; user_id: string; station_id: string; expires_at: string; revoked_at: string | null } | null;

      if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
        return jsonError(c, 401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
      }

      const profile = await loadUserProfile(c.env.DB, row.user_id);
      const roleIds = (profile?.roles || [])
        .filter((item: any) => !item.station_id || item.station_id === row.station_id)
        .map((item: any) => item.role_code);

      await c.env.DB?.prepare(`UPDATE station_refresh_tokens SET revoked_at = ?, updated_at = ? WHERE refresh_token_id = ?`)
        .bind(new Date().toISOString(), new Date().toISOString(), row.refresh_token_id)
        .run();

      return c.json({
        data: await issueStationSession(c, {
          userId: row.user_id,
          stationCode: row.station_id,
          roleIds: roleIds.length ? roleIds : ['station_supervisor']
        })
      });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/refresh');
    }
  });

  app.post('/api/v1/station/logout', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const refreshToken = body.refresh_token ? String(body.refresh_token) : null;

      if (refreshToken) {
        await c.env.DB?.prepare(`UPDATE station_refresh_tokens SET revoked_at = ?, updated_at = ? WHERE token_value = ?`)
          .bind(new Date().toISOString(), new Date().toISOString(), refreshToken)
          .run();
      } else {
        await c.env.DB?.prepare(`UPDATE station_refresh_tokens SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
          .bind(new Date().toISOString(), new Date().toISOString(), c.var.actor.userId)
          .run();
      }

      return c.json({ data: { ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/logout');
    }
  });

  app.get(
    '/api/v1/station/shipments',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationShipments(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/shipments');
      }
    }
  );

  app.get(
    '/api/v1/station/shipments/:shipmentId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getStationShipment(c.req.param('shipmentId'));

        if (!result) {
          return jsonError(c, 404, 'SHIPMENT_NOT_FOUND', 'Shipment does not exist', {
            shipment_id: c.req.param('shipmentId')
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/shipments/:shipmentId');
      }
    }
  );

  app.get(
    '/api/v1/station/outbound/flights',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listOutboundFlights(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/outbound/flights');
      }
    }
  );

  app.get(
    '/api/v1/station/outbound/flights/:flightId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getOutboundFlight(c.req.param('flightId'));

        if (!result) {
          return jsonError(c, 404, 'FLIGHT_NOT_FOUND', 'Outbound flight does not exist', {
            flight_id: c.req.param('flightId')
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/outbound/flights/:flightId');
      }
    }
  );

  app.post('/api/v1/station/outbound/flights/:flightId/loaded', requireRoles(['station_supervisor', 'document_desk']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json().catch(() => ({}));
      const result = await services.markOutboundLoaded(c.req.param('flightId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/outbound/flights/:flightId/loaded');
    }
  });

  app.post(
    '/api/v1/station/outbound/flights/:flightId/manifest/finalize',
    requireRoles(['station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const input = await c.req.json().catch(() => ({}));
        const result = await services.finalizeOutboundManifest(c.req.param('flightId'), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/outbound/flights/:flightId/manifest/finalize');
      }
    }
  );

  app.post('/api/v1/station/outbound/flights/:flightId/airborne', requireRoles(['station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json().catch(() => ({}));
      const result = await services.markOutboundAirborne(c.req.param('flightId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/outbound/flights/:flightId/airborne');
    }
  });

  app.get(
    '/api/v1/station/outbound/waybills',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listOutboundWaybills(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/outbound/waybills');
      }
    }
  );

  app.get(
    '/api/v1/station/outbound/waybills/:awbId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getOutboundWaybill(c.req.param('awbId'));

        if (!result) {
          return jsonError(c, 404, 'AWB_NOT_FOUND', 'Outbound waybill does not exist', {
            awb_id: c.req.param('awbId')
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/outbound/waybills/:awbId');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/flights',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listInboundFlights(normalizeInboundFlightListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/flights');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/flights/:flightId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk']),
    async (c) => {
      try {
        assertStationAccess(c.var.actor, c.req.query('station_id'));
        const services = getStationServices(c);
        const result = await services.getInboundFlight(c.req.param('flightId'));

        if (!result) {
          return jsonError(c, 404, 'FLIGHT_NOT_FOUND', 'Inbound flight does not exist', {
            flight_id: c.req.param('flightId')
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/flights/:flightId');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/waybills',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listInboundWaybills(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/waybills');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/waybills/:awbId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        assertStationAccess(c.var.actor, c.req.query('station_id'));
        const services = getStationServices(c);
        const result = await services.getInboundWaybill(c.req.param('awbId'));

        if (!result) {
          return jsonError(c, 404, 'AWB_NOT_FOUND', 'Inbound waybill does not exist', {
            awb_id: c.req.param('awbId')
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/waybills/:awbId');
      }
    }
  );

  app.post(
    '/api/v1/station/inbound/waybills/:awbId/noa',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.processInboundNoa(c.req.param('awbId'), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/inbound/waybills/:awbId/noa');
      }
    }
  );

  app.post(
    '/api/v1/station/inbound/waybills/:awbId/pod',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.processInboundPod(c.req.param('awbId'), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/inbound/waybills/:awbId/pod');
      }
    }
  );

  app.post(
    '/api/v1/station/uploads/presign',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const input = await c.req.json();
        const result = await services.createUploadTicket({
          station_id: input.station_id,
          related_object_type: input.related_object_type,
          document_name: input.document_name,
          content_type: input.content_type,
          size_bytes: input.size_bytes,
          checksum_sha256: input.checksum_sha256,
          retention_class: input.retention_class
        });
        return c.json({ data: result }, 201);
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/uploads/presign');
      }
    }
  );

  app.put(
    '/api/v1/station/uploads/:uploadId',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const uploadId = c.req.param('uploadId');
        const token = c.req.query('token');

        if (!token) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'token is required');
        }

        const row = (await c.env.DB?.prepare(
          `
            SELECT upload_id, station_id, document_name, content_type, size_bytes, checksum_sha256, storage_key, upload_token, expires_at, consumed_at
            FROM upload_tickets
            WHERE upload_id = ?
            LIMIT 1
          `
        )
          .bind(uploadId)
          .first()) as {
          upload_id: string;
          station_id: string;
          document_name: string;
          content_type: string;
          size_bytes: number | null;
          checksum_sha256: string | null;
          storage_key: string;
          upload_token: string;
          expires_at: string;
          consumed_at: string | null;
        } | null;

        if (!row) {
          return jsonError(c, 404, 'UPLOAD_NOT_FOUND', 'Upload ticket does not exist', { upload_id: uploadId });
        }

        if (row.upload_token !== token) {
          return jsonError(c, 401, 'UPLOAD_TOKEN_INVALID', 'Upload token is invalid');
        }

        if (row.consumed_at) {
          return jsonError(c, 409, 'UPLOAD_ALREADY_CONSUMED', 'Upload ticket was already consumed', { upload_id: uploadId });
        }

        if (new Date(row.expires_at).getTime() < Date.now()) {
          return jsonError(c, 409, 'UPLOAD_EXPIRED', 'Upload ticket expired', { upload_id: uploadId });
        }

        const body = await c.req.arrayBuffer();
        await c.env.FILES?.put(row.storage_key, body, {
          httpMetadata: {
            contentType: c.req.header('Content-Type') || row.content_type || 'application/octet-stream'
          }
        });

        await c.env.DB?.prepare(`UPDATE upload_tickets SET uploaded_at = ?, updated_at = ? WHERE upload_id = ?`)
          .bind(new Date().toISOString(), new Date().toISOString(), uploadId)
          .run();

        return c.json({
          data: {
            upload_id: uploadId,
            storage_key: row.storage_key,
            document_name: row.document_name,
            content_type: row.content_type
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'PUT /station/uploads/:uploadId');
      }
    }
  );

  app.post(
    '/api/v1/station/uploads',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const formData = await c.req.formData();
        const file = formData.get('file');
        const stationId = String(formData.get('station_id') || c.var.actor.stationScope[0] || 'MME');
        const objectType = String(formData.get('related_object_type') || 'Document').toUpperCase();

        if (!(file instanceof File)) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'file is required');
        }

        const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
        const objectKey = `station/${stationId}/uploads/${objectType}/${Date.now()}-${crypto.randomUUID()}${extension}`;

        await c.env.FILES?.put(objectKey, await file.arrayBuffer(), {
          httpMetadata: {
            contentType: file.type || 'application/octet-stream'
          }
        });

        return c.json(
          {
            data: {
              document_name: file.name,
              content_type: file.type || 'application/octet-stream',
              size: file.size,
              storage_key: objectKey,
              uploaded_at: new Date().toISOString()
            }
          },
          201
        );
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/uploads');
      }
    }
  );

  app.post(
    '/api/v1/station/documents',
    requireRoles(['station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.createDocument(normalizeDocumentInput(c.var.actor, input));
        return c.json({ data: result }, 201);
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/documents');
      }
    }
  );

  app.get(
    '/api/v1/station/documents',
    requireRoles(['station_supervisor', 'document_desk', 'check_worker', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationDocuments(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/documents');
      }
    }
  );

  app.get(
    '/api/v1/station/documents/:documentId/preview',
    requireRoles(['station_supervisor', 'document_desk', 'check_worker', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const preview = await services.getStationDocumentPreview(c.req.param('documentId'));

        if (!preview) {
          return jsonError(c, 404, 'RESOURCE_NOT_FOUND', 'Document does not exist', {
            document_id: c.req.param('documentId')
          });
        }

        if (!preview.inline_supported) {
          return c.json({ data: preview });
        }

        const row = await c.env.DB?.prepare(
          `
            SELECT storage_key, document_name, content_type
            FROM documents
            WHERE document_id = ?
              AND deleted_at IS NULL
            LIMIT 1
          `
        )
          .bind(c.req.param('documentId'))
          .first<{ storage_key: string; document_name: string; content_type: string | null }>();

        if (!row) {
          return jsonError(c, 404, 'RESOURCE_NOT_FOUND', 'Document does not exist', {
            document_id: c.req.param('documentId')
          });
        }

        const object = await c.env.FILES?.get(row.storage_key);
        if (!object) {
          return jsonError(c, 404, 'RESOURCE_NOT_FOUND', 'Document content does not exist in object storage', {
            document_id: c.req.param('documentId'),
            storage_key: row.storage_key
          });
        }

        return new Response(object.body, {
          headers: {
            'Content-Disposition': `inline; filename="${row.document_name}"`,
            'Content-Type': row.content_type || object.httpMetadata?.contentType || 'application/octet-stream'
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/documents/:documentId/preview');
      }
    }
  );

  app.get(
    '/api/v1/platform/audit/object',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const objectType = String(c.req.query('object_type') || '');
        const objectKey = c.req.query('object_key') || undefined;
        const objectId = c.req.query('object_id') || undefined;

        if (!objectType || (!objectKey && !objectId)) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'object_type and object_key/object_id are required');
        }

        const scope = await resolveAuditScope(c.env.DB, objectType, objectKey, objectId);
        const { whereClause, params } = buildAuditScopeSql(scope);

        if (!whereClause) {
          return c.json({
            data: {
              events: [],
              transitions: []
            }
          });
        }

        const [events, transitions] = await Promise.all([
          c.env.DB
            ?.prepare(
              `
                SELECT
                  audit_id,
                  actor_id,
                  actor_role,
                  client_source,
                  action,
                  object_type,
                  object_id,
                  station_id,
                  summary,
                  created_at
                FROM audit_events
                WHERE ${whereClause}
                ORDER BY created_at DESC, audit_id DESC
                LIMIT 30
              `
            )
            .bind(...params)
            .all(),
          c.env.DB
            ?.prepare(
              `
                SELECT
                  transition_id,
                  object_type,
                  object_id,
                  state_field,
                  from_value,
                  to_value,
                  triggered_by,
                  triggered_at,
                  reason
                FROM state_transitions
                WHERE ${whereClause}
                ORDER BY triggered_at DESC, transition_id DESC
                LIMIT 30
              `
            )
            .bind(...params)
            .all()
        ]);

        return c.json({
          data: {
            events: (events?.results || []).map((item: any) => ({
              id: item.audit_id,
              time: item.created_at,
              actor: `${item.actor_id} / ${item.actor_role}`,
              action: item.action,
              object: `${item.object_type} / ${item.object_id}`,
              note: `${item.station_id} · ${item.summary} · ${item.client_source}`
            })),
            transitions: (transitions?.results || []).map((item: any) => ({
              id: item.transition_id,
              time: item.triggered_at,
              action: `${item.object_type}.${item.state_field}`,
              object: `${item.object_type} / ${item.object_id}`,
              before: item.from_value || '未设置',
              after: item.to_value,
              actor: item.triggered_by,
              note: item.reason || ''
            }))
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/audit/object');
      }
    }
  );

  app.get(
    '/api/v1/platform/audit/events',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const rows = await c.env.DB?.prepare(
          `
            SELECT
              audit_id,
              actor_id,
              actor_role,
              client_source,
              action,
              object_type,
              object_id,
              station_id,
              summary,
              created_at
            FROM audit_events
            ORDER BY created_at DESC, audit_id DESC
            LIMIT 100
          `
        ).all<{
          audit_id: string;
          actor_id: string;
          actor_role: string;
          client_source: string;
          action: string;
          object_type: string;
          object_id: string;
          station_id: string;
          summary: string;
          created_at: string;
        }>();

        return c.json({
          items: (rows?.results || []).map((item) => ({
            id: item.audit_id,
            time: item.created_at,
            actor: `${item.actor_id} / ${item.actor_role}`,
            action: item.action,
            object: `${item.object_type} / ${item.object_id}`,
            result: '运行中',
            note: `${item.station_id} · ${item.summary} · ${item.client_source}`
          })),
          page: 1,
          page_size: 100,
          total: rows?.results?.length || 0
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/audit/events');
      }
    }
  );

  app.get(
    '/api/v1/platform/audit/logs',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const rows = await c.env.DB?.prepare(
          `
            SELECT
              transition_id,
              object_type,
              object_id,
              state_field,
              from_value,
              to_value,
              triggered_by,
              triggered_at,
              reason
            FROM state_transitions
            ORDER BY triggered_at DESC, transition_id DESC
            LIMIT 100
          `
        ).all<{
          transition_id: string;
          object_type: string;
          object_id: string;
          state_field: string;
          from_value: string | null;
          to_value: string;
          triggered_by: string;
          triggered_at: string;
          reason: string | null;
        }>();

        return c.json({
          items: (rows?.results || []).map((item) => ({
            id: item.transition_id,
            time: item.triggered_at,
            action: `${item.object_type}.${item.state_field}`,
            object: `${item.object_type} / ${item.object_id}`,
            before: item.from_value || '未设置',
            after: item.to_value,
            result: '运行中',
            actor: item.triggered_by,
            note: item.reason || ''
          })),
          page: 1,
          page_size: 100,
          total: rows?.results?.length || 0
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/audit/logs');
      }
    }
  );

  app.get(
    '/api/v1/station/documents/:documentId/download',
    requireRoles(['station_supervisor', 'document_desk', 'check_worker', 'delivery_desk']),
    async (c) => {
      try {
        const row = await c.env.DB?.prepare(
          `
            SELECT document_name, storage_key
            FROM documents
            WHERE document_id = ?
              AND deleted_at IS NULL
            LIMIT 1
          `
        )
          .bind(c.req.param('documentId'))
          .first<{ document_name: string; storage_key: string }>();

        if (!row) {
          return jsonError(c, 404, 'RESOURCE_NOT_FOUND', 'Document does not exist', {
            document_id: c.req.param('documentId')
          });
        }

        const object = await c.env.FILES?.get(row.storage_key);

        if (!object) {
          return jsonError(c, 404, 'RESOURCE_NOT_FOUND', 'Document content does not exist in object storage', {
            document_id: c.req.param('documentId'),
            storage_key: row.storage_key
          });
        }

        return new Response(object.body, {
          headers: {
            'Content-Disposition': `attachment; filename="${row.document_name}"`,
            'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream'
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/documents/:documentId/download');
      }
    }
  );

  app.get(
    '/api/v1/station/tasks',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationTasks(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/tasks');
      }
    }
  );

  app.post('/api/v1/station/tasks/:taskId/assign', requireRoles(['station_supervisor']), async (c) => {
    try {
      const input = await c.req.json();
      authorizeTaskAssignment(c.var.actor, input);
      const services = getStationServices(c);
      const result = await services.assignTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/tasks/:taskId/assign');
    }
  });

  app.post('/api/v1/station/tasks/:taskId/verify', requireRoles(['station_supervisor', 'check_worker']), async (c) => {
    try {
      const input = await c.req.json().catch(() => ({}));
      const services = getStationServices(c);
      const result = await services.verifyTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/tasks/:taskId/verify');
    }
  });

  app.post('/api/v1/station/tasks/:taskId/rework', requireRoles(['station_supervisor', 'check_worker']), async (c) => {
    try {
      const input = await c.req.json().catch(() => ({}));
      const services = getStationServices(c);
      const result = await services.reworkTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/tasks/:taskId/rework');
    }
  });

  app.post('/api/v1/station/tasks/:taskId/escalate', requireRoles(['station_supervisor', 'check_worker']), async (c) => {
    try {
      const input = await c.req.json().catch(() => ({}));
      const services = getStationServices(c);
      const result = await services.escalateTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/tasks/:taskId/escalate');
    }
  });

  app.post(
    '/api/v1/station/tasks/:taskId/exception',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'mobile_operator']),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.raiseTaskException(c.req.param('taskId'), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/tasks/:taskId/exception');
      }
    }
  );

  app.get(
    '/api/v1/station/exceptions',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationExceptions(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/exceptions');
      }
    }
  );

  app.get(
    '/api/v1/station/exceptions/:exceptionId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getStationException(c.req.param('exceptionId'));

        if (!result) {
          return jsonError(c, 404, 'EXCEPTION_NOT_FOUND', 'Exception does not exist', {
            exception_id: c.req.param('exceptionId')
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/exceptions/:exceptionId');
      }
    }
  );

  app.post(
    '/api/v1/station/exceptions/:exceptionId/resolve',
    requireRoles(['station_supervisor', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const input = await c.req.json().catch(() => ({}));
        const services = getStationServices(c);
        const result = await services.resolveStationException(c.req.param('exceptionId'), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/exceptions/:exceptionId/resolve');
      }
    }
  );
}
