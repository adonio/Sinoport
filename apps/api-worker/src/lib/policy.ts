import {
  ensureActorCanAccessStation,
  ensureAssignableRole,
  resolveStationId,
  type AuthActor
} from '@sinoport/auth';
import type {
  AssignTaskInput,
  CreateDocumentInput,
  InboundFlightListQuery,
  RoleCode
} from '@sinoport/contracts';

export function normalizeStationListQuery(actor: AuthActor, query: Record<string, string | undefined>) {
  const stationId = resolveStationId(actor, query.station_id);

  return {
    ...query,
    station_id: stationId ?? undefined
  };
}

export function normalizeInboundFlightListQuery(actor: AuthActor, query: InboundFlightListQuery): InboundFlightListQuery {
  const stationId = resolveStationId(actor, query.station_id);

  return {
    ...query,
    station_id: stationId ?? undefined
  };
}

export function normalizeDocumentInput(actor: AuthActor, input: CreateDocumentInput): CreateDocumentInput {
  const stationId = resolveStationId(actor, input.station_id);

  return {
    ...input,
    station_id: stationId ?? undefined
  };
}

export function authorizeTaskAssignment(actor: AuthActor, input: AssignTaskInput) {
  ensureAssignableRole(actor, input.assigned_role as RoleCode);
}

export function assertStationAccess(actor: AuthActor, stationId?: string | null) {
  ensureActorCanAccessStation(actor, stationId);
}
