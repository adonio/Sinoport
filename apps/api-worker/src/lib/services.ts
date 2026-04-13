import type { Context } from 'hono';
import { createStationServices, type StationServices } from '@sinoport/domain';
import { createRepositoryRegistry, type D1DatabaseLike } from '@sinoport/repositories';
import type { ApiVariables } from './auth';

type BindingsWithDb = { DB?: D1DatabaseLike };

export function getStationServices(c: Context<{ Bindings: BindingsWithDb; Variables: ApiVariables }>): StationServices {
  return createStationServices(
    createRepositoryRegistry({
      actor: c.var.actor,
      db: c.env.DB,
      requestId: c.req.header('X-Request-Id') ?? crypto.randomUUID()
    })
  );
}
