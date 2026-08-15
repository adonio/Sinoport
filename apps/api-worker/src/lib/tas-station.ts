import type { AuthActor } from '@sinoport/auth';
import type { D1DatabaseLike } from '@sinoport/repositories';
import { appendOperationEvent, V14OperationError } from './v14-operations';

export function assertTasAccess(actor: AuthActor) {
  if (actor.roleIds.includes('platform_admin')) return;
  if (actor.stationScope.includes('TAS') || actor.stationScope.includes('*')) return;
  throw new V14OperationError(403, 'STATION_SCOPE_DENIED', 'Current actor cannot access TAS station data');
}

export async function sha256Json(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function projectTasMilestone(
  db: D1DatabaseLike,
  actor: AuthActor,
  params: {
    flightId: string | null;
    milestoneCode: string;
    action: 'START' | 'COMPLETE';
    occurredAt: string;
    evidenceIds?: string[];
    idempotencyKey: string;
    segmentCode?: 'B1' | 'B2';
    sourceObjectType: string;
    sourceObjectId: string;
  }
) {
  if (!params.flightId) return null;
  const milestone = await db
    .prepare(
      `SELECT i.milestone_instance_id, i.operation_control_plan_id, i.status, i.row_version,
              p.active_plan_version_id
       FROM operation_control_plans p
       JOIN milestone_instances i
         ON i.operation_control_plan_id = p.operation_control_plan_id
        AND i.plan_version_id = p.active_plan_version_id
       JOIN milestone_definitions d ON d.milestone_definition_id = i.milestone_definition_id
       WHERE p.tenant_id = ? AND p.flight_id = ? AND d.milestone_code = ?
       LIMIT 1`
    )
    .bind(actor.tenantId, params.flightId, params.milestoneCode)
    .first<{
      milestone_instance_id: string;
      operation_control_plan_id: string;
      status: string;
      row_version: number;
      active_plan_version_id: string;
    }>();

  if (!milestone) return null;

  const evidenceIds = params.evidenceIds ?? [];
  if (params.action === 'START') {
    await db
      .prepare(
        `UPDATE milestone_instances
         SET status = CASE WHEN status IN ('COMPLETED', 'CLOSED') THEN status ELSE 'IN_PROGRESS' END,
             actual_started_at = COALESCE(actual_started_at, ?),
             evidence_state = CASE WHEN ? > 0 THEN 'PARTIAL' ELSE evidence_state END,
             last_status_reason = ?, last_calculated_at = ?, row_version = row_version + 1
         WHERE milestone_instance_id = ?`
      )
      .bind(
        params.occurredAt,
        evidenceIds.length,
        `Auto-projected from ${params.sourceObjectType}:${params.sourceObjectId}`,
        params.occurredAt,
        milestone.milestone_instance_id
      )
      .run();
  } else {
    await db
      .prepare(
        `UPDATE milestone_instances
         SET status = CASE WHEN status = 'CLOSED' THEN status ELSE 'COMPLETED' END,
             actual_started_at = COALESCE(actual_started_at, ?),
             actual_completed_at = COALESCE(actual_completed_at, ?),
             evidence_state = CASE WHEN ? > 0 THEN 'COMPLETE' ELSE evidence_state END,
             closure_evidence_ids_json = CASE WHEN ? > 0 THEN ? ELSE closure_evidence_ids_json END,
             last_status_reason = ?, last_calculated_at = ?, row_version = row_version + 1
         WHERE milestone_instance_id = ?`
      )
      .bind(
        params.occurredAt,
        params.occurredAt,
        evidenceIds.length,
        evidenceIds.length,
        JSON.stringify(evidenceIds),
        `Auto-projected from ${params.sourceObjectType}:${params.sourceObjectId}`,
        params.occurredAt,
        milestone.milestone_instance_id
      )
      .run();
  }

  if (params.segmentCode) {
    await db
      .prepare(
        `UPDATE operation_control_plans
         SET active_control_segment = ?, updated_at = ?, row_version = row_version + 1
         WHERE operation_control_plan_id = ?`
      )
      .bind(params.segmentCode, params.occurredAt, milestone.operation_control_plan_id)
      .run();
  }

  await appendOperationEvent(db, actor, {
    aggregateType: 'OperationControlPlan',
    aggregateId: milestone.operation_control_plan_id,
    eventType: `MILESTONE_${params.action}_AUTO_PROJECTED`,
    eventAction: params.milestoneCode,
    idempotencyKey: `${params.idempotencyKey}:milestone:${params.milestoneCode}`,
    flightId: params.flightId,
    stationId: 'TAS',
    occurredAt: params.occurredAt,
    payload: {
      milestone_instance_id: milestone.milestone_instance_id,
      source_object_type: params.sourceObjectType,
      source_object_id: params.sourceObjectId,
      evidence_ids: evidenceIds
    }
  });

  return {
    operation_control_plan_id: milestone.operation_control_plan_id,
    milestone_instance_id: milestone.milestone_instance_id,
    milestone_code: params.milestoneCode,
    action: params.action
  };
}
