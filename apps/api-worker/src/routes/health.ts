import type { ApiApp } from '../index';

export function registerHealthRoutes(app: ApiApp) {
  app.get('/api/v1/healthz', (c) =>
    c.json({
      data: {
        service: c.env.APP_NAME ?? 'sinoport-api-worker',
        environment: c.env.ENVIRONMENT ?? 'local',
        status: 'ok',
        version: {
          sha: c.env.APP_VERSION ?? null,
          tag: c.env.APP_RELEASE_TAG ?? null,
          deployed_at: c.env.APP_DEPLOYED_AT ?? null
        }
      }
    })
  );
}
