import type { ApiApp } from '../index';
import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import {
  dispatchSkyledgerOutbox,
  hmacSha256Hex,
  ingestSkyledgerEvent,
  integrationStatus,
  IntegrationSyncError,
  replaySkyledgerOutbox,
  sha256Hex,
  verifyIntegrationSignature
} from '../lib/integration-sync';
import { jsonError } from '../lib/http';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

function handleIntegrationError(c: any, error: unknown) {
  if (error instanceof IntegrationSyncError) {
    return jsonError(c, error.status, error.code, error.message, error.details);
  }
  console.error('[integration-sync]', error);
  return jsonError(c, 500, 'INTEGRATION_ERROR', error instanceof Error ? error.message : 'Integration operation failed');
}

export function registerIntegrationRoutes(app: ApiApp, requireRoles: RequireRoles) {
  app.post('/api/v1/integrations/skyledger/events', async (c) => {
    const rawBody = await c.req.text();
    try {
      await verifyIntegrationSignature({
        secret: c.env.SKYLEDGER_INTEGRATION_SECRET,
        timestamp: c.req.header('X-Integration-Timestamp'),
        signature: c.req.header('X-Integration-Signature'),
        rawBody
      });
      const event = JSON.parse(rawBody) as unknown;
      const result = await ingestSkyledgerEvent(c.env, event);
      return c.json({ data: result }, 200);
    } catch (error) {
      if (error instanceof SyntaxError) return jsonError(c, 400, 'INVALID_JSON', 'Request body must be valid JSON');
      return handleIntegrationError(c, error);
    }
  });

  app.post('/api/v1/integrations/skyledger/reconciliation/snapshot', async (c) => {
    const rawBody = await c.req.text();
    try {
      await verifyIntegrationSignature({
        secret: c.env.SKYLEDGER_INTEGRATION_SECRET,
        timestamp: c.req.header('X-Integration-Timestamp'),
        signature: c.req.header('X-Integration-Signature'),
        rawBody
      });
      if (!c.env.DB) throw new IntegrationSyncError(500, 'DATABASE_NOT_CONFIGURED', 'D1 binding is missing');
      const body = JSON.parse(rawBody) as { object_types?: string[]; object_ids_by_type?: Record<string, string[]> };
      const scopedIds = Object.fromEntries(Object.entries(body.object_ids_by_type ?? {}).map(([key, values]) => [key, new Set((values ?? []).map(String).filter(Boolean))]));
      const requested = [...new Set([...(body.object_types ?? []).map(String).filter(Boolean), ...Object.keys(scopedIds)])].sort();
      const placeholders = requested.map(() => '?').join(',');
      const sql = `SELECT object_type, local_object_id, external_object_id
                   FROM integration_external_object_links
                   WHERE source_system = 'SKYLEDGER' AND external_object_id IS NOT NULL${requested.length ? ` AND object_type IN (${placeholders})` : ''}
                   ORDER BY object_type, external_object_id, local_object_id`;
      const rows = requested.length
        ? await c.env.DB.prepare(sql).bind(...requested).all<{ object_type: string; local_object_id: string; external_object_id: string }>()
        : await c.env.DB.prepare(sql).all<{ object_type: string; local_object_id: string; external_object_id: string }>();
      const grouped = new Map<string, string[]>();
      for (const row of rows.results) {
        const allowedIds = scopedIds[row.object_type];
        if (allowedIds && !allowedIds.has(row.external_object_id)) continue;
        const pairs = grouped.get(row.object_type) ?? [];
        pairs.push(`${row.object_type}|${row.external_object_id}|${row.local_object_id}`);
        grouped.set(row.object_type, pairs);
      }
      const objectTypes = [...new Set([...requested, ...grouped.keys()])].sort();
      const snapshots = await Promise.all(objectTypes.map(async (objectType) => {
        const pairs = (grouped.get(objectType) ?? []).sort();
        return { object_type: objectType, count: pairs.length, fingerprint: await sha256Hex(pairs.join('\n')) };
      }));
      return c.json({ data: { peer_system: 'SKYLEDGER', snapshot_at: new Date().toISOString(), object_types: snapshots } });
    } catch (error) {
      if (error instanceof SyntaxError) return jsonError(c, 400, 'INVALID_JSON', 'Request body must be valid JSON');
      return handleIntegrationError(c, error);
    }
  });

  app.get(
    '/api/v1/platform/integrations/skyledger/status',
    requireRoles(['platform_admin', 'OCC_DM', 'DQC_DATA_QUALITY_CONTROLLER']),
    async (c) => {
      try {
        return c.json({ data: await integrationStatus(c.env) });
      } catch (error) {
        return handleIntegrationError(c, error);
      }
    }
  );

  app.get(
    '/api/v1/platform/integrations/skyledger/events',
    requireRoles(['platform_admin', 'OCC_DM', 'DQC_DATA_QUALITY_CONTROLLER']),
    async (c) => {
      try {
        if (!c.env.DB) throw new IntegrationSyncError(500, 'DATABASE_NOT_CONFIGURED', 'D1 binding is missing');
        const direction = c.req.query('direction') === 'inbound' ? 'inbound' : 'outbound';
        const status = String(c.req.query('status') ?? '').trim();
        const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 50));
        const table = direction === 'inbound' ? 'integration_inbox_events' : 'integration_outbox_events';
        const statusColumn = direction === 'inbound' ? 'processing_status' : 'delivery_status';
        const timeColumn = direction === 'inbound' ? 'received_at' : 'created_at';
        const query = status
          ? `SELECT * FROM ${table} WHERE ${statusColumn} = ? ORDER BY ${timeColumn} DESC LIMIT ?`
          : `SELECT * FROM ${table} ORDER BY ${timeColumn} DESC LIMIT ?`;
        const statement = c.env.DB.prepare(query);
        const rows = status ? await statement.bind(status, limit).all() : await statement.bind(limit).all();
        return c.json({ data: { direction, items: rows.results } });
      } catch (error) {
        return handleIntegrationError(c, error);
      }
    }
  );

  app.post(
    '/api/v1/platform/integrations/skyledger/dispatch',
    requireRoles(['platform_admin', 'OCC_DM']),
    async (c) => {
      try {
        const body: { limit?: number; aggregate_ids?: string[] } = await c.req.json<{ limit?: number; aggregate_ids?: string[] }>().catch(() => ({}));
        return c.json({ data: await dispatchSkyledgerOutbox(c.env, Number(body.limit) || 50, body.aggregate_ids ?? []) });
      } catch (error) {
        return handleIntegrationError(c, error);
      }
    }
  );

  app.post(
    '/api/v1/platform/integrations/skyledger/events/replay',
    requireRoles(['platform_admin', 'OCC_DM']),
    async (c) => {
      try {
        const body: { event_ids?: string[]; statuses?: string[]; limit?: number; dispatch_now?: boolean } = await c.req
          .json<{ event_ids?: string[]; statuses?: string[]; limit?: number; dispatch_now?: boolean }>()
          .catch(() => ({}));
        const replay = await replaySkyledgerOutbox(c.env, {
          eventIds: body.event_ids,
          statuses: body.statuses,
          limit: body.limit
        });
        const delivery = body.dispatch_now ? await dispatchSkyledgerOutbox(c.env, Math.min(Number(body.limit) || 100, 100)) : null;
        return c.json({ data: { replay, delivery } });
      } catch (error) {
        return handleIntegrationError(c, error);
      }
    }
  );

  app.post(
    '/api/v1/platform/integrations/skyledger/reconcile',
    requireRoles(['platform_admin', 'OCC_DM', 'DQC_DATA_QUALITY_CONTROLLER']),
    async (c) => {
      try {
        if (!c.env.DB) throw new IntegrationSyncError(500, 'DATABASE_NOT_CONFIGURED', 'D1 binding is missing');
        if (!c.env.SKYLEDGER_BASE_URL || !c.env.SKYLEDGER_INTEGRATION_SECRET) {
          throw new IntegrationSyncError(500, 'INTEGRATION_SECRET_MISSING', 'Skyledger integration endpoint is not configured');
        }
        const body = await c.req.json<{ object_ids_by_type?: Record<string, string[]> }>().catch(() => ({})) as { object_ids_by_type?: Record<string, string[]> };
        const scopedIds = Object.fromEntries(Object.entries(body.object_ids_by_type ?? {}).map(([key, values]) => [key, new Set((values ?? []).map(String).filter(Boolean))]));
        const now = new Date().toISOString();
        const runId = `REC-${crypto.randomUUID()}`;
        const links = await c.env.DB
          .prepare(
            `SELECT object_type, local_object_id, external_object_id, last_synced_at
             FROM integration_external_object_links
             WHERE source_system = 'SKYLEDGER' AND external_object_id IS NOT NULL
             ORDER BY object_type, external_object_id, local_object_id`
          )
          .all<{ object_type: string; local_object_id: string; external_object_id: string; last_synced_at: string | null }>();
        const grouped = new Map<string, string[]>();
        for (const link of links.results) {
          const allowedIds = scopedIds[link.object_type];
          if (Object.keys(scopedIds).length > 0 && (!allowedIds || !allowedIds.has(link.external_object_id))) continue;
          const pairs = grouped.get(link.object_type) ?? [];
          pairs.push(`${link.object_type}|${link.external_object_id}|${link.local_object_id}`);
          grouped.set(link.object_type, pairs);
        }
        const objectTypes = [...new Set([...Object.keys(scopedIds), ...grouped.keys()])].sort();
        const localSnapshots = await Promise.all(objectTypes.map(async (objectType) => {
          const pairs = (grouped.get(objectType) ?? []).sort();
          return { object_type: objectType, count: pairs.length, fingerprint: await sha256Hex(pairs.join('\n')) };
        }));
        const objectIdsByType = Object.fromEntries(Object.entries(scopedIds).map(([key, values]) => [key, [...values].sort()]));
        const requestBody = JSON.stringify({ object_types: objectTypes, object_ids_by_type: objectIdsByType });
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = await hmacSha256Hex(c.env.SKYLEDGER_INTEGRATION_SECRET, `${timestamp}.${requestBody}`);
        const peerResponse = await fetch(`${c.env.SKYLEDGER_BASE_URL.replace(/\/$/, '')}/v1/integrations/sinoport/reconciliation/snapshot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Integration-Timestamp': timestamp,
            'X-Integration-Signature': signature
          },
          body: requestBody
        });
        const peerPayload = await peerResponse.json().catch(() => null) as {
          data?: { snapshot_at?: string; object_types?: Array<{ object_type: string; count: number; fingerprint: string }> };
        } | null;
        if (!peerResponse.ok || !peerPayload?.data?.object_types) {
          throw new IntegrationSyncError(409, 'PEER_SNAPSHOT_UNAVAILABLE', 'Skyledger reconciliation snapshot could not be verified', {
            http_status: peerResponse.status
          });
        }
        const peerSnapshots = peerPayload.data.object_types;
        const peerByType = new Map(peerSnapshots.map((item) => [item.object_type, item]));
        const comparisons = localSnapshots.map((local) => {
          const peer = peerByType.get(local.object_type) ?? { object_type: local.object_type, count: 0, fingerprint: '' };
          return {
            object_type: local.object_type,
            local_count: local.count,
            peer_count: Number(peer.count),
            count_match: local.count === Number(peer.count),
            fingerprint_match: local.fingerprint === peer.fingerprint,
            local_fingerprint: local.fingerprint,
            peer_fingerprint: peer.fingerprint
          };
        });
        const mismatches = comparisons.filter((item) => !item.count_match || !item.fingerprint_match);
        const localCount = localSnapshots.reduce((sum, row) => sum + row.count, 0);
        const peerCount = peerSnapshots.reduce((sum, row) => sum + Number(row.count), 0);
        const status = mismatches.length === 0 ? 'MATCHED' : 'MISMATCH';
        await c.env.DB
          .prepare(
            `INSERT INTO integration_reconciliation_runs (
               reconciliation_run_id, peer_system, scope_type, local_count, peer_count,
               mismatch_count, status, details_json, started_at, completed_at
             ) VALUES (?, 'SKYLEDGER', 'PEER_LINK_SNAPSHOT', ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            runId,
            localCount,
            peerCount,
            mismatches.length,
            status,
            JSON.stringify({ mode: Object.keys(scopedIds).length ? 'signed_peer_link_snapshot_scoped' : 'signed_peer_link_snapshot', peer_snapshot_at: peerPayload.data.snapshot_at, object_ids_by_type: objectIdsByType, comparisons }),
            now,
            now
          )
          .run();
        return c.json({
          data: {
            reconciliation_run_id: runId,
            status,
            scope: Object.keys(scopedIds).length ? 'signed_peer_link_snapshot_scoped' : 'signed_peer_link_snapshot',
            peer_snapshot_verified: true,
            local_count: localCount,
            peer_count: peerCount,
            mismatch_count: mismatches.length,
            object_types: comparisons
          }
        });
      } catch (error) {
        return handleIntegrationError(c, error);
      }
    }
  );
}
