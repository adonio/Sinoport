import type { Context } from 'hono';
import { RepositoryNotReadyError, RepositoryOperationError } from '@sinoport/repositories';
import { PolicyDeniedError, StationScopeDeniedError } from '@sinoport/auth';

type JsonStatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500 | 501;

export function jsonError(
  c: Context,
  status: JsonStatusCode,
  code: string,
  message: string,
  details: Record<string, unknown> = {}
) {
  return c.json(
    {
      error: {
        code,
        message,
        details
      }
    },
    status
  );
}

export function handleServiceError(c: Context, error: unknown, capability: string) {
  if (error instanceof StationScopeDeniedError) {
    return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station', {
      capability,
      station_id: error.stationId
    });
  }

  if (error instanceof PolicyDeniedError) {
    return jsonError(c, 403, 'FORBIDDEN', error.message, {
      capability
    });
  }

  if (error instanceof RepositoryNotReadyError) {
    return jsonError(c, 501, 'NOT_IMPLEMENTED', `${capability} is not implemented yet`, {
      repository_method: error.repositoryMethod
    });
  }

  if (error instanceof RepositoryOperationError) {
    return jsonError(c, error.httpStatus, error.code, error.message, {
      capability,
      ...error.details
    });
  }

  return jsonError(c, 500, 'INTERNAL_ERROR', 'Unexpected server error', {
    capability
  });
}
