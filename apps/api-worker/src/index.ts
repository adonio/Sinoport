import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1DatabaseLike } from '@sinoport/repositories';
import { actorMiddleware, requireRoles, type ApiVariables } from './lib/auth';
import { registerHealthRoutes } from './routes/health';
import { registerMobileRoutes } from './routes/mobile';
import { registerStationRoutes } from './routes/station';
import { registerStationUserRoutes } from './routes/station-users';
import { registerIntegrationRoutes } from './routes/integrations';
import { registerV14PrewarehouseRoutes } from './routes/v14-prewarehouse';
import { registerV14TransportRoutes } from './routes/v14-transport';
import { registerV14BorderRoutes } from './routes/v14-border';
import { registerV14TasRoutes } from './routes/v14-tas';
import { registerV14TasFlightRoutes } from './routes/v14-tas-flight';
import { registerV14TasDirectRoutes } from './routes/v14-tas-direct';
import { registerV14ControlPlanRoutes } from './routes/v14-control-plans';
import { registerV14DutyControlRoutes } from './routes/v14-duty-control';
import { registerV14AcceptanceControlRoutes } from './routes/v14-acceptance-controls';
import { registerV14AwbIntakeRoutes } from './routes/v14-shipments';
import { getStationServices } from './lib/services';
import { dispatchSkyledgerOutbox } from './lib/integration-sync';

type ApiBindings = {
  APP_NAME?: string;
  APP_DEPLOYED_AT?: string;
  APP_RELEASE_TAG?: string;
  APP_VERSION?: string;
  AUTH_TOKEN_SECRET?: string;
  DB?: D1DatabaseLike;
  ENVIRONMENT?: string;
  FILES?: R2Bucket;
  SKYLEDGER_BASE_URL?: string;
  SKYLEDGER_INTEGRATION_SECRET?: string;
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
    allowHeaders: [
      'Authorization',
      'Content-Type',
      'X-Request-Id',
      'X-Client-Source',
      'Idempotency-Key',
      'X-Integration-Timestamp',
      'X-Integration-Signature'
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);

app.use('/api/v1/*', actorMiddleware);

registerHealthRoutes(app);
registerStationRoutes(app, getStationServices, requireRoles);
registerStationUserRoutes(app, requireRoles);
registerMobileRoutes(app, getStationServices, requireRoles);
registerIntegrationRoutes(app, requireRoles);
registerV14AwbIntakeRoutes(app, requireRoles);
registerV14PrewarehouseRoutes(app, requireRoles);
registerV14TransportRoutes(app, requireRoles);
registerV14BorderRoutes(app, requireRoles);
registerV14TasRoutes(app, requireRoles);
registerV14TasFlightRoutes(app, requireRoles);
registerV14TasDirectRoutes(app, requireRoles);
registerV14ControlPlanRoutes(app, requireRoles);
registerV14DutyControlRoutes(app, requireRoles);
registerV14AcceptanceControlRoutes(app, requireRoles);

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
    await Promise.all([runDocumentRetentionSweep(env), dispatchSkyledgerOutbox(env)]);
  }
};
