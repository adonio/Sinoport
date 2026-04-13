import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1DatabaseLike } from '@sinoport/repositories';
import { actorMiddleware, requireRoles, type ApiVariables } from './lib/auth';
import { registerHealthRoutes } from './routes/health';
import { registerMobileRoutes } from './routes/mobile';
import { registerStationRoutes } from './routes/station';
import { getStationServices } from './lib/services';

type ApiBindings = {
  APP_NAME?: string;
  AUTH_TOKEN_SECRET?: string;
  DB?: D1DatabaseLike;
  ENVIRONMENT?: string;
  FILES?: R2Bucket;
};

export type ApiApp = Hono<{
  Bindings: ApiBindings;
  Variables: ApiVariables;
}>;

const app: ApiApp = new Hono();

app.use(
  '/api/v1/*',
  cors({
    origin: '*',
    allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-Client-Source', 'Idempotency-Key'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS']
  })
);

app.use('/api/v1/*', actorMiddleware);

registerHealthRoutes(app);
registerStationRoutes(app, getStationServices, requireRoles);
registerMobileRoutes(app, getStationServices, requireRoles);

async function runDocumentRetentionSweep(env: ApiBindings) {
  const now = new Date().toISOString();

  const expiredTickets = await env.DB?.prepare(
    `
      SELECT upload_id
      FROM upload_tickets
      WHERE expires_at < ?
        AND consumed_at IS NULL
    `
  )
    .bind(now)
    .all<{ upload_id: string }>();

  for (const row of expiredTickets?.results || []) {
    await env.DB?.prepare(`DELETE FROM upload_tickets WHERE upload_id = ?`).bind(row.upload_id).run();
  }

  const deletedDocuments = await env.DB?.prepare(
    `
      SELECT document_id, storage_key
      FROM documents
      WHERE deleted_at IS NOT NULL
        AND deleted_at < datetime(?, '-7 days')
    `
  )
    .bind(now)
    .all<{ document_id: string; storage_key: string }>();

  for (const row of deletedDocuments?.results || []) {
    await env.FILES?.delete(row.storage_key);
    await env.DB?.prepare(`DELETE FROM documents WHERE document_id = ?`).bind(row.document_id).run();
  }
}

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: ApiBindings) => {
    await runDocumentRetentionSweep(env);
  }
};
