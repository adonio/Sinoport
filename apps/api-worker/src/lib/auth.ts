import { createMiddleware } from 'hono/factory';
import {
  allowLocalOnlyAuth,
  buildActorFromClaims,
  buildActorFromHeaders,
  hasAnyRole,
  resolveAuthTokenSecret,
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
  ENABLE_LOCAL_DEBUG_AUTH?: string;
};

export const actorMiddleware = createMiddleware<{ Variables: ApiVariables; Bindings: AuthBindings }>(async (c, next) => {
  if (
    [
      '/api/v1/healthz',
      '/api/v1/mobile/login',
      '/api/v1/mobile/options/login',
      '/api/v1/station/login',
      '/api/v1/station/refresh'
    ].includes(c.req.path)
  ) {
    await next();
    return;
  }

  const authorization = c.req.header('Authorization');
  const localDebugAuthEnabled = allowLocalOnlyAuth(c.env.ENVIRONMENT, c.env.ENABLE_LOCAL_DEBUG_AUTH);

  if (!authorization) {
    return jsonError(c, 401, 'UNAUTHORIZED', 'Missing Authorization header');
  }

  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  let secret: string;

  try {
    secret = resolveAuthTokenSecret(c.env.AUTH_TOKEN_SECRET, c.env.ENVIRONMENT);
  } catch (error) {
    return jsonError(c, 500, 'AUTH_CONFIG_ERROR', error instanceof Error ? error.message : 'Missing auth secret');
  }

  if (token && token !== 'demo-token') {
    const claims = await verifyAuthToken(token, secret);

    if (!claims) {
      return jsonError(c, 401, 'UNAUTHORIZED', 'Invalid or expired token');
    }

    c.set('actor', buildActorFromClaims(claims));
    await next();
    return;
  }

  if (localDebugAuthEnabled && token === 'demo-token') {
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
