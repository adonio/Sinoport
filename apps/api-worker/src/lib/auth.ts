import { createMiddleware } from 'hono/factory';
import {
  buildActorFromClaims,
  buildActorFromHeaders,
  hasAnyRole,
  verifyAuthToken,
  type AuthActor
} from '@sinoport/auth';
import type { RoleCode } from '@sinoport/contracts';
import { jsonError } from './http';

export type ApiVariables = {
  actor: AuthActor;
};

type AuthBindings = {
  AUTH_TOKEN_SECRET?: string;
  ENVIRONMENT?: string;
};

export const actorMiddleware = createMiddleware<{ Variables: ApiVariables; Bindings: AuthBindings }>(async (c, next) => {
  if (['/api/v1/healthz', '/api/v1/mobile/login', '/api/v1/station/login', '/api/v1/station/refresh'].includes(c.req.path)) {
    await next();
    return;
  }

  const authorization = c.req.header('Authorization');

  if (!authorization) {
    return jsonError(c, 401, 'UNAUTHORIZED', 'Missing Authorization header');
  }

  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  const secret = c.env.AUTH_TOKEN_SECRET || 'sinoport-local-dev-secret';
  const isLocal = (c.env.ENVIRONMENT || 'local') === 'local';

  if (token && token !== 'demo-token') {
    const claims = await verifyAuthToken(token, secret);

    if (!claims) {
      return jsonError(c, 401, 'UNAUTHORIZED', 'Invalid or expired token');
    }

    c.set('actor', buildActorFromClaims(claims));
    await next();
    return;
  }

  if (isLocal && token === 'demo-token') {
    c.set('actor', buildActorFromHeaders(c.req.raw.headers));
    await next();
    return;
  }

  return jsonError(c, 401, 'UNAUTHORIZED', 'Invalid or expired token');
});

export const requireRoles = (allowedRoles: RoleCode[]) =>
  createMiddleware<{ Variables: ApiVariables; Bindings: AuthBindings }>(async (c, next) => {
    const actor = c.var.actor;

    if (!hasAnyRole(actor, allowedRoles)) {
      return jsonError(c, 403, 'FORBIDDEN', 'Current actor does not have the required role', {
        allowed_roles: allowedRoles
      });
    }

    await next();
  });
