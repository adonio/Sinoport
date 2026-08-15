import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { ApiApp } from '../index';
import { sha256Hex } from '../lib/integration-sync';
import {
  appendOperationEvent,
  assertOccPermission,
  findOperationByIdempotency,
  idempotencyKey,
  integerValue,
  loadRequired,
  numberValue,
  optionalText,
  requestId,
  requiredText,
  requireV14Db,
  stringArray,
  V14OperationError
} from '../lib/v14-operations';
import { jsonError } from '../lib/http';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;
const REQUIRED_CONTROL_ROLES = [
  'OCC_DM', 'A1_CARGO_CONTROLLER', 'A2_DOMESTIC_TRUCK_CONTROLLER',
  'A3_CROSS_BORDER_CONTROLLER', 'B1_TAS_STATION_CONTROLLER', 'B2_FLIGHT_MONITOR',
  'OBI_OVERSEAS_INTERFACE', 'DQC_DATA_QUALITY_CONTROLLER'
];

function handleError(c: any, error: unknown) {
  if (error instanceof V14OperationError) return jsonError(c, error.status, error.code, error.message, error.details);
  console.error('[v14-duty-control]', error);
  return jsonError(c, 500, 'DUTY_CONTROL_OPERATION_FAILED', error instanceof Error ? error.message : 'Operation failed');
}

function response(c: any, data: Record<string, unknown>, status: 200 | 201 = 200) {
  return c.json({ request_id: requestId(c.req.raw.headers), ...data }, status);
}

async function loadAssignment(db: any, id: string) {
  return loadRequired<Record<string, any>>(db,
    `SELECT a.*, d.flight_id, d.operation_control_plan_id, d.current_segment_code
     FROM control_role_assignments a JOIN flight_duty_plans d ON d.flight_duty_plan_id = a.flight_duty_plan_id
     WHERE a.assignment_id = ?`, [id], 'ASSIGNMENT_NOT_FOUND', 'Control role assignment was not found');
}

async function calculateCoverage(db: any, flightId: string) {
  const duty = await db.prepare(`SELECT * FROM flight_duty_plans WHERE flight_id = ? AND status = 'ACTIVE' ORDER BY version_no DESC LIMIT 1`).bind(flightId).first() as Record<string, any> | null;
  if (!duty) return { status: 'GAP', duty_plan: null, occ_dm: null, segment_owner: null, backups: [], gaps: ['ACTIVE_DUTY_PLAN'] };
  const assignments = await db.prepare(
    `SELECT * FROM control_role_assignments WHERE flight_duty_plan_id = ?
     AND duty_status IN ('ON_DUTY','TEMP_ACTIVATED','ON_CALL','SCHEDULED') ORDER BY role_code, assignment_type`
  ).bind(duty.flight_duty_plan_id).all() as { results: Array<Record<string, any>> };
  const now = new Date().toISOString();
  const active = assignments.results.filter((item) => ['ON_DUTY', 'TEMP_ACTIVATED'].includes(item.duty_status) && item.acceptance_status === 'ACCEPTED' && item.shift_start_at <= now && item.shift_end_at >= now && (!item.temporary_permission_expires_at || item.temporary_permission_expires_at >= now));
  const occDm = active.find((item) => item.role_code === 'OCC_DM');
  const segmentRole: Record<string, string> = {
    A1: 'A1_CARGO_CONTROLLER', A2: 'A2_DOMESTIC_TRUCK_CONTROLLER', A3: 'A3_CROSS_BORDER_CONTROLLER',
    B1: 'B1_TAS_STATION_CONTROLLER', B2: 'B2_FLIGHT_MONITOR', OBI: 'OBI_OVERSEAS_INTERFACE'
  };
  const owner = active.find((item) => item.role_code === segmentRole[duty.current_segment_code]);
  const gaps = [!occDm ? 'OCC_DM' : null, !owner ? segmentRole[duty.current_segment_code] : null].filter(Boolean);
  return { status: gaps.length === 0 ? 'COVERED' : 'GAP', duty_plan: duty, occ_dm: occDm ?? null, segment_owner: owner ?? null, backups: assignments.results.filter((item) => item.assignment_type !== 'PRIMARY_DUTY'), gaps };
}

export function registerV14DutyControlRoutes(app: ApiApp, requireRoles: RequireRoles) {
  const occView: RoleCode[] = [
    'platform_admin', 'OCC_DM', 'A1_CARGO_CONTROLLER', 'A2_DOMESTIC_TRUCK_CONTROLLER',
    'A3_CROSS_BORDER_CONTROLLER', 'B1_TAS_STATION_CONTROLLER', 'B2_FLIGHT_MONITOR',
    'OBI_OVERSEAS_INTERFACE', 'DQC_DATA_QUALITY_CONTROLLER'
  ];

  app.post('/api/v1/users/:user_id/role-qualifications', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const userId = c.req.param('user_id');
      await db.prepare(`INSERT INTO users (user_id, tenant_id, display_name, email) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING`)
        .bind(userId, actor.tenantId, optionalText(body, 'display_name') ?? userId, optionalText(body, 'email')).run();
      const approvedBy = requiredText(body, 'approved_by');
      if (approvedBy === actor.userId && optionalText(body, 'requested_by') === actor.userId) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Qualification requester and approver must differ');
      const qualificationId = `QUAL-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO role_qualifications (
           role_qualification_id, tenant_id, user_id, role_code, authorization_level,
           station_scope_ids_json, region_scope_codes_json, business_scope_codes_json,
           status, valid_from, valid_to, training_record_refs_json, assessment_result_ref,
           approved_by, approved_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)`
      ).bind(qualificationId, actor.tenantId, userId, requiredText(body, 'role_code'), requiredText(body, 'authorization_level'),
        JSON.stringify(body.station_scope_ids ?? []), JSON.stringify(body.region_scope_codes ?? []), JSON.stringify(body.business_scope_codes ?? []),
        requiredText(body, 'valid_from'), optionalText(body, 'valid_to'), JSON.stringify(body.training_record_refs ?? []),
        optionalText(body, 'assessment_result_ref'), approvedBy, now).run();
      await appendOperationEvent(db, actor, { aggregateType: 'RoleQualification', aggregateId: qualificationId, eventType: 'ROLE_QUALIFICATION_ACTIVATED', idempotencyKey: idem, payload: { user_id: userId, role_code: requiredText(body, 'role_code') } });
      return response(c, { result: 'ACTIVE', role_qualification_id: qualificationId }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/users/:user_id/role-qualifications', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const rows = await db.prepare(`SELECT * FROM role_qualifications WHERE user_id = ? ORDER BY role_code, valid_from DESC`).bind(c.req.param('user_id')).all();
      return response(c, { items: rows.results, total: rows.results.length });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/contact-directory', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const contactId = `CONTACT-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO contact_directory_entries (
           contact_entry_id, tenant_id, party_id, location_code, service_scope,
           primary_contact_ref, backup_contact_ref, organization_channel_ref,
           phone_encrypted, instant_message_encrypted, email_encrypted, available_hours_json,
           timezone, supports_24h, next_verify_at, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNVERIFIED')`
      ).bind(contactId, actor.tenantId, requiredText(body, 'party_id'), requiredText(body, 'location_code'),
        requiredText(body, 'service_scope'), requiredText(body, 'primary_contact_ref'), requiredText(body, 'backup_contact_ref'),
        requiredText(body, 'organization_channel_ref'), optionalText(body, 'phone_encrypted'), optionalText(body, 'instant_message_encrypted'),
        optionalText(body, 'email_encrypted'), JSON.stringify(body.available_hours ?? {}), requiredText(body, 'timezone'),
        Number(body.supports_24h === true), requiredText(body, 'next_verify_at')).run();
      await appendOperationEvent(db, actor, { aggregateType: 'ContactDirectoryEntry', aggregateId: contactId, eventType: 'CONTACT_DIRECTORY_CREATED', idempotencyKey: idem, payload: { party_id: requiredText(body, 'party_id') } });
      return response(c, { result: 'UNVERIFIED', contact_entry_id: contactId }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/contact-directory', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const location = String(c.req.query('location_code') ?? '').trim(); const scope = String(c.req.query('service_scope') ?? '').trim();
      const rows = await db.prepare(
        `SELECT contact_entry_id, party_id, location_code, service_scope, primary_contact_ref,
                backup_contact_ref, organization_channel_ref, timezone, supports_24h,
                verified_at, next_verify_at, status
         FROM contact_directory_entries WHERE (? = '' OR location_code = ?) AND (? = '' OR service_scope = ?)
         ORDER BY location_code, service_scope`
      ).bind(location, location, scope, scope).all();
      return response(c, { items: rows.results, total: rows.results.length, sensitive_fields_masked: true });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/contact-directory/:id/verify', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      await loadRequired(db, `SELECT contact_entry_id FROM contact_directory_entries WHERE contact_entry_id = ?`, [c.req.param('id')], 'CONTACT_NOT_FOUND', 'Contact entry was not found');
      const now = new Date().toISOString(); const next = requiredText(body, 'next_verify_at');
      if (next <= now) throw new V14OperationError(409, 'CONTACT_DIRECTORY_STALE', 'next_verify_at must be in the future');
      await db.prepare(`UPDATE contact_directory_entries SET status = 'VERIFIED', verified_at = ?, verified_by = ?, next_verify_at = ?, updated_at = ? WHERE contact_entry_id = ?`)
        .bind(now, actor.userId, next, now, c.req.param('id')).run();
      await appendOperationEvent(db, actor, { aggregateType: 'ContactDirectoryEntry', aggregateId: c.req.param('id'), eventType: 'CONTACT_DIRECTORY_VERIFIED', idempotencyKey: idem, payload: { verification_method: requiredText(body, 'verification_method'), next_verify_at: next } });
      return response(c, { result: 'VERIFIED', next_verify_at: next });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/flights/:flight_id/duty-plan', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const duty = await db.prepare(`SELECT * FROM flight_duty_plans WHERE flight_id = ? ORDER BY version_no DESC LIMIT 1`).bind(c.req.param('flight_id')).first<Record<string, any>>();
      const assignments = duty ? await db.prepare(`SELECT * FROM control_role_assignments WHERE flight_duty_plan_id = ? ORDER BY role_code, assignment_type`).bind(duty.flight_duty_plan_id).all() : { results: [] };
      return response(c, { duty_plan: duty, assignments: assignments.results });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/flights/:flight_id/duty-plan/versions', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadRequired<{ operation_control_plan_id: string }>(db, `SELECT operation_control_plan_id FROM operation_control_plans WHERE flight_id = ?`, [c.req.param('flight_id')], 'CONTROL_PLAN_NOT_FOUND', 'Create an operation control plan first');
      const version = await db.prepare(`SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version FROM flight_duty_plans WHERE flight_id = ?`).bind(c.req.param('flight_id')).first<{ next_version: number }>();
      const requiredRoles = Array.isArray(body.required_role_codes) ? (body.required_role_codes as string[]) : REQUIRED_CONTROL_ROLES;
      const assignments = Array.isArray(body.assignments) ? (body.assignments as Record<string, unknown>[]) : [];
      const rolesByUser = new Map<string, Set<string>>();
      for (const assignment of assignments) {
        const userId = requiredText(assignment, 'primary_user_id');
        const roleCode = requiredText(assignment, 'role_code');
        const roles = rolesByUser.get(userId) ?? new Set<string>();
        roles.add(roleCode);
        rolesByUser.set(userId, roles);
      }
      for (const [userId, roles] of rolesByUser) {
        if (roles.has('DQC_DATA_QUALITY_CONTROLLER') && roles.size > 1) {
          throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'DQC must be independent from operational control roles on the same duty plan', { user_id: userId, role_codes: [...roles] });
        }
      }
      const assignedRoles = new Set(assignments.filter((item) => optionalText(item, 'assignment_type') !== 'BACKUP_ON_CALL').map((item) => requiredText(item, 'role_code')));
      const missing = requiredRoles.filter((role) => !assignedRoles.has(role));
      const dutyId = `DUTY-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO flight_duty_plans (
           flight_duty_plan_id, tenant_id, flight_id, operation_control_plan_id, version_no,
           status, required_role_codes_json, missing_role_codes_json, contact_readiness_status,
           coverage_mode, shift_scheme_code, minimum_active_seats, current_segment_code,
           current_coverage_status, valid_from, valid_to
         ) VALUES (?, ?, ?, ?, ?, 'READINESS_PENDING', ?, ?, 'INCOMPLETE', ?, ?, ?, ?, 'GAP', ?, ?)`
      ).bind(dutyId, actor.tenantId, c.req.param('flight_id'), plan.operation_control_plan_id, Number(version?.next_version ?? 1),
        JSON.stringify(requiredRoles), JSON.stringify(missing), optionalText(body, 'coverage_mode') ?? 'HYBRID_FUNCTION_DUTY',
        requiredText(body, 'shift_scheme_code'), Math.max(2, integerValue(body, 'minimum_active_seats', 2)),
        optionalText(body, 'current_segment_code') ?? 'A1', requiredText(body, 'valid_from'), optionalText(body, 'valid_to')).run();
      for (const assignment of assignments) {
        const userId = requiredText(assignment, 'primary_user_id'); const role = requiredText(assignment, 'role_code');
        const qualification = await loadRequired<Record<string, any>>(db,
          `SELECT * FROM role_qualifications WHERE role_qualification_id = ? AND user_id = ? AND role_code = ? AND status = 'ACTIVE'`,
          [requiredText(assignment, 'role_qualification_id'), userId, role], 'ROLE_QUALIFICATION_REQUIRED', 'Assignment requires an active matching qualification');
        const contact = await loadRequired<Record<string, any>>(db,
          `SELECT * FROM contact_directory_entries WHERE contact_entry_id = ?`, [requiredText(assignment, 'contact_directory_entry_id')],
          'CONTACT_NOT_FOUND', 'Assignment contact entry was not found');
        const approvedBy = requiredText(assignment, 'approved_by');
        if (approvedBy === actor.userId) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Assignment maker and approver must differ');
        await db.prepare(
          `INSERT INTO control_role_assignments (
             assignment_id, tenant_id, flight_duty_plan_id, role_code, role_qualification_id,
             assignment_type, primary_user_id, backup_user_id, contact_directory_entry_id,
             segment_scope_codes_json, object_scope_refs_json, authorization_level_snapshot,
             shift_start_at, shift_end_at, timezone, duty_status, acceptance_status,
             effective_from, effective_to, assigned_by, approved_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', 'PENDING', ?, ?, ?, ?)`
        ).bind(optionalText(assignment, 'assignment_id') ?? `ASSIGN-${crypto.randomUUID()}`, actor.tenantId, dutyId, role,
          qualification.role_qualification_id, optionalText(assignment, 'assignment_type') ?? 'PRIMARY_DUTY', userId,
          optionalText(assignment, 'backup_user_id'), contact.contact_entry_id,
          JSON.stringify(assignment.segment_scope_codes ?? []), JSON.stringify(assignment.object_scope_refs ?? [plan.operation_control_plan_id]),
          qualification.authorization_level, requiredText(assignment, 'shift_start_at'), requiredText(assignment, 'shift_end_at'),
          optionalText(assignment, 'timezone') ?? 'Asia/Tashkent', requiredText(assignment, 'effective_from'),
          optionalText(assignment, 'effective_to'), actor.userId, approvedBy).run();
      }
      await appendOperationEvent(db, actor, { aggregateType: 'FlightDutyPlan', aggregateId: dutyId, eventType: 'DUTY_PLAN_VERSION_CREATED', idempotencyKey: idem, flightId: c.req.param('flight_id'), payload: { version_no: Number(version?.next_version ?? 1), missing_role_codes: missing, assignment_count: assignments.length } });
      return response(c, { result: 'READINESS_PENDING', flight_duty_plan_id: dutyId, version_no: Number(version?.next_version ?? 1), missing_role_codes: missing, assignment_count: assignments.length }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/flights/:flight_id/duty-plan/activate', requireRoles(['platform_admin', 'OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const duty = await loadRequired<Record<string, any>>(db, `SELECT * FROM flight_duty_plans WHERE flight_id = ? ORDER BY version_no DESC LIMIT 1`, [c.req.param('flight_id')], 'DUTY_PLAN_NOT_FOUND', 'Duty plan was not found');
      const assignments = await db.prepare(`SELECT a.*, c.status AS contact_status, c.next_verify_at FROM control_role_assignments a JOIN contact_directory_entries c ON c.contact_entry_id = a.contact_directory_entry_id WHERE a.flight_duty_plan_id = ?`).bind(duty.flight_duty_plan_id).all<Record<string, any>>();
      const roles = new Set(assignments.results.filter((item) => item.assignment_type === 'PRIMARY_DUTY').map((item) => item.role_code));
      const missing = REQUIRED_CONTROL_ROLES.filter((role) => !roles.has(role));
      const staleContacts = assignments.results.filter((item) => item.contact_status !== 'VERIFIED' || item.next_verify_at < new Date().toISOString()).map((item) => item.contact_directory_entry_id);
      const missingBackups = assignments.results.filter((item) => item.assignment_type === 'PRIMARY_DUTY' && !item.backup_user_id).map((item) => item.role_code);
      if (missing.length || staleContacts.length || missingBackups.length) throw new V14OperationError(409, 'FLIGHT_DUTY_PLAN_INCOMPLETE', 'Duty plan roles, backups or contacts are incomplete', { missing_roles: missing, stale_contacts: staleContacts, missing_backups: missingBackups });
      const approvedBy = requiredText(body, 'approved_by');
      if (approvedBy === actor.userId) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Duty plan activator and approver must differ');
      const now = new Date().toISOString();
      await db.prepare(`UPDATE flight_duty_plans SET status = 'ACTIVE', missing_role_codes_json = '[]', contact_readiness_status = 'READY', current_coverage_status = 'GAP', approved_by = ?, activated_at = ?, coverage_last_checked_at = ? WHERE flight_duty_plan_id = ?`)
        .bind(approvedBy, now, now, duty.flight_duty_plan_id).run();
      await db.prepare(`UPDATE operation_control_plans SET flight_duty_plan_id = ?, current_coverage_status = 'GAP', updated_at = ? WHERE operation_control_plan_id = ?`)
        .bind(duty.flight_duty_plan_id, now, duty.operation_control_plan_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'FlightDutyPlan', aggregateId: duty.flight_duty_plan_id, eventType: 'DUTY_PLAN_ACTIVATED', idempotencyKey: idem, flightId: c.req.param('flight_id'), payload: { approved_by: approvedBy } });
      return response(c, { result: 'ACTIVE', flight_duty_plan_id: duty.flight_duty_plan_id, current_coverage_status: 'GAP', next_action: 'assigned users accept and activate seats' });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/flights/:flight_id/duty-coverage', requireRoles(occView), async (c) => {
    try { return response(c, { coverage: await calculateCoverage(requireV14Db(c.env), c.req.param('flight_id')) }); }
    catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/flights/:flight_id/duty-coverage/validate', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const coverage = await calculateCoverage(db, c.req.param('flight_id')); const now = new Date().toISOString();
      if (coverage.duty_plan) {
        await db.prepare(`UPDATE flight_duty_plans SET current_coverage_status = ?, active_occ_dm_assignment_id = ?, active_segment_owner_assignment_id = ?, coverage_last_checked_at = ? WHERE flight_duty_plan_id = ?`)
          .bind(coverage.status, (coverage.occ_dm as any)?.assignment_id ?? null, (coverage.segment_owner as any)?.assignment_id ?? null, now, (coverage.duty_plan as any).flight_duty_plan_id).run();
        await db.prepare(`UPDATE operation_control_plans SET current_coverage_status = ?, active_occ_dm_assignment_id = ?, overall_health_color = CASE WHEN ? = 'GAP' THEN 'UNKNOWN' ELSE overall_health_color END, updated_at = ? WHERE flight_id = ?`)
          .bind(coverage.status, (coverage.occ_dm as any)?.assignment_id ?? null, coverage.status, now, c.req.param('flight_id')).run();
      }
      return response(c, { coverage });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/control-role-assignments/:id/activate', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const assignment = await loadAssignment(db, c.req.param('id'));
      if (assignment.primary_user_id !== actor.userId) throw new V14OperationError(403, 'DUTY_ASSIGNMENT_INACTIVE', 'Only the assigned user can accept and activate this seat');
      const qualification = await db.prepare(`SELECT role_qualification_id FROM role_qualifications WHERE role_qualification_id = ? AND status = 'ACTIVE' AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)`).bind(assignment.role_qualification_id, new Date().toISOString(), new Date().toISOString()).first();
      if (!qualification) throw new V14OperationError(403, 'ROLE_QUALIFICATION_REQUIRED', 'Assignment qualification is not current');
      const now = new Date().toISOString();
      await db.prepare(`UPDATE control_role_assignments SET duty_status = 'ON_DUTY', acceptance_status = 'ACCEPTED', accepted_at = ?, activated_at = ?, activated_by = ?, activation_reason = ? WHERE assignment_id = ?`)
        .bind(now, now, actor.userId, optionalText(body, 'activation_reason') ?? 'SHIFT_START', assignment.assignment_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'FlightDutyPlan', aggregateId: assignment.flight_duty_plan_id, eventType: 'CONTROL_SEAT_ACTIVATED', idempotencyKey: idem, flightId: assignment.flight_id, payload: { assignment_id: assignment.assignment_id, role_code: assignment.role_code } });
      return response(c, { result: 'ON_DUTY', assignment_id: assignment.assignment_id, activated_at: now });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/control-role-assignments/:id/activate-backup', requireRoles(['OCC_DM']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const assignment = await loadAssignment(db, c.req.param('id'));
      await assertOccPermission(db, actor, { flightId: assignment.flight_id, requiredRoles: ['OCC_DM'], segmentCode: assignment.current_segment_code, objectRef: assignment.operation_control_plan_id });
      if (assignment.assignment_type === 'PRIMARY_DUTY') throw new V14OperationError(409, 'VALIDATION_ERROR', 'Only backup or augment assignments can use activate-backup');
      const controlPlan = await loadRequired<{ overall_health_color: string }>(db,
        `SELECT overall_health_color FROM operation_control_plans WHERE operation_control_plan_id = ?`,
        [assignment.operation_control_plan_id], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      if (!['YELLOW', 'RED'].includes(controlPlan.overall_health_color)) {
        throw new V14OperationError(409, 'BACKUP_ACTIVATION_NOT_REQUIRED', 'Backup or temporary augmentation is permitted only for Yellow or Red control states', { current_color: controlPlan.overall_health_color });
      }
      if (controlPlan.overall_health_color === 'YELLOW' && assignment.assignment_type !== 'BACKUP_ON_CALL') {
        throw new V14OperationError(409, 'TEMP_AUGMENT_REQUIRES_RED', 'Temporary augmentation requires a Red control state');
      }
      if (assignment.assignment_type === 'TEMP_AUGMENT' && (!optionalText(body, 'dqc_approved_by') || optionalText(body, 'dqc_approved_by') === actor.userId)) {
        throw new V14OperationError(409, 'DQC_APPROVAL_REQUIRED', 'Red temporary augmentation requires independent DQC approval');
      }
      const duration = Math.max(15, Math.min(240, integerValue(body, 'duration_minutes', 120))); const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + duration * 60_000).toISOString();
      await db.prepare(`UPDATE control_role_assignments SET duty_status = 'TEMP_ACTIVATED', acceptance_status = 'ACCEPTED', activated_at = ?, activated_by = ?, activation_reason = ?, temporary_permission_expires_at = ? WHERE assignment_id = ?`)
        .bind(now, actor.userId, requiredText(body, 'activation_reason'), expiresAt, assignment.assignment_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'FlightDutyPlan', aggregateId: assignment.flight_duty_plan_id, eventType: 'BACKUP_TEMPORARILY_ACTIVATED', idempotencyKey: idem, flightId: assignment.flight_id, payload: { assignment_id: assignment.assignment_id, expires_at: expiresAt } });
      return response(c, { result: 'TEMP_ACTIVATED', assignment_id: assignment.assignment_id, expires_at: expiresAt });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/control-role-assignments/:id/stand-down', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const assignment = await loadAssignment(db, c.req.param('id'));
      if (assignment.primary_user_id !== actor.userId && !actor.roleIds.includes('OCC_DM')) throw new V14OperationError(403, 'DUTY_ASSIGNMENT_INACTIVE', 'Only the assignee or OCC-DM can stand down a seat');
      const pendingHandover = await db.prepare(`SELECT handover_id FROM control_handovers WHERE from_assignment_id = ? AND status = 'PENDING' LIMIT 1`).bind(assignment.assignment_id).first();
      if (pendingHandover) throw new V14OperationError(409, 'CONTROL_HANDOVER_NOT_ACCEPTED', 'Pending handover must be accepted before stand-down');
      const now = new Date().toISOString(); await db.prepare(`UPDATE control_role_assignments SET duty_status = 'ENDED', stood_down_at = ?, stood_down_by = ? WHERE assignment_id = ?`).bind(now, actor.userId, assignment.assignment_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'FlightDutyPlan', aggregateId: assignment.flight_duty_plan_id, eventType: 'CONTROL_SEAT_STOOD_DOWN', idempotencyKey: idem, flightId: assignment.flight_id, payload: { assignment_id: assignment.assignment_id } });
      return response(c, { result: 'ENDED', assignment_id: assignment.assignment_id });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/handovers', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const from = await loadAssignment(db, requiredText(body, 'from_assignment_id')); const to = await loadAssignment(db, requiredText(body, 'to_assignment_id'));
      if (from.operation_control_plan_id !== c.req.param('id') || to.operation_control_plan_id !== c.req.param('id')) throw new V14OperationError(409, 'CONTROL_SEGMENT_PERMISSION_MISMATCH', 'Assignments do not belong to this plan');
      if (from.primary_user_id !== actor.userId) throw new V14OperationError(403, 'DUTY_ASSIGNMENT_INACTIVE', 'Only the current owner can submit handover');
      const handoverId = `HO-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO control_handovers (
           handover_id, tenant_id, operation_control_plan_id, handover_type, gate_code,
           from_segment, from_assignment_id, to_segment, to_assignment_id, status,
           current_location, last_evidence_refs_json, latest_eta_at, next_gate_code,
           remaining_buffer_minutes, open_hold_ids_json, incident_owner_id, next_update_at, submitted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(handoverId, actor.tenantId, c.req.param('id'), optionalText(body, 'handover_type') ?? 'CONTROL_SEGMENT',
        requiredText(body, 'gate_code'), requiredText(body, 'from_segment'), from.assignment_id,
        requiredText(body, 'to_segment'), to.assignment_id, optionalText(body, 'current_location'),
        JSON.stringify(stringArray(body, 'evidence_ids')), optionalText(body, 'latest_eta_at'), optionalText(body, 'next_gate_code'),
        integerValue(body, 'remaining_buffer_minutes') || null, JSON.stringify(body.open_hold_ids ?? []),
        optionalText(body, 'incident_owner_id'), requiredText(body, 'next_update_at'), now).run();
      await db.prepare(`UPDATE control_role_assignments SET duty_status = 'HANDOVER_PENDING' WHERE assignment_id = ?`).bind(from.assignment_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: c.req.param('id'), eventType: 'CONTROL_HANDOVER_SUBMITTED', idempotencyKey: idem, flightId: from.flight_id, payload: { handover_id: handoverId, from_segment: requiredText(body, 'from_segment'), to_segment: requiredText(body, 'to_segment') } });
      return response(c, { result: 'PENDING', handover_id: handoverId }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/control-handovers/:id/accept', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const handover = await loadRequired<Record<string, any>>(db,
        `SELECT h.*, p.flight_id FROM control_handovers h JOIN operation_control_plans p ON p.operation_control_plan_id = h.operation_control_plan_id WHERE h.handover_id = ?`,
        [c.req.param('id')], 'HANDOVER_NOT_FOUND', 'Control handover was not found');
      if (handover.status !== 'PENDING') throw new V14OperationError(409, 'CONTROL_HANDOVER_NOT_ACCEPTED', 'Handover is not pending');
      const target = await loadAssignment(db, handover.to_assignment_id);
      if (target.primary_user_id !== actor.userId) throw new V14OperationError(403, 'DUTY_ASSIGNMENT_INACTIVE', 'Only the next owner can accept handover');
      const now = new Date().toISOString();
      if (!db.batch) throw new V14OperationError(500, 'ATOMIC_BATCH_UNAVAILABLE', 'Atomic D1 batch support is required for handover acceptance');
      await db.batch([
        db.prepare(`UPDATE control_handovers SET status = 'ACCEPTED', accepted_at = ?, previous_owner_released_at = ? WHERE handover_id = ? AND status = 'PENDING'`).bind(now, now, handover.handover_id),
        db.prepare(`UPDATE control_role_assignments SET duty_status = 'ENDED', stood_down_at = ?, stood_down_by = ? WHERE assignment_id = ?`).bind(now, actor.userId, handover.from_assignment_id),
        db.prepare(`UPDATE control_role_assignments SET duty_status = 'ON_DUTY', acceptance_status = 'ACCEPTED', accepted_at = COALESCE(accepted_at, ?), activated_at = COALESCE(activated_at, ?), activated_by = ? WHERE assignment_id = ?`).bind(now, now, actor.userId, handover.to_assignment_id),
        db.prepare(`UPDATE operation_control_plans SET active_control_segment = ?, row_version = row_version + 1, updated_at = ? WHERE operation_control_plan_id = ?`).bind(handover.to_segment, now, handover.operation_control_plan_id),
        db.prepare(`UPDATE flight_duty_plans SET current_segment_code = ?, active_segment_owner_assignment_id = ? WHERE flight_duty_plan_id = ?`).bind(handover.to_segment, handover.to_assignment_id, target.flight_duty_plan_id)
      ]);
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: handover.operation_control_plan_id, eventType: 'CONTROL_HANDOVER_ACCEPTED', idempotencyKey: idem, flightId: handover.flight_id, payload: { handover_id: handover.handover_id, to_segment: handover.to_segment, previous_owner_released_at: now } });
      return response(c, { result: 'ACCEPTED', handover_id: handover.handover_id, active_control_segment: handover.to_segment, previous_owner_released_at: now });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/control-handovers/:id/reject', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const handover = await loadRequired<Record<string, any>>(db, `SELECT h.*, p.flight_id FROM control_handovers h JOIN operation_control_plans p ON p.operation_control_plan_id = h.operation_control_plan_id WHERE h.handover_id = ?`, [c.req.param('id')], 'HANDOVER_NOT_FOUND', 'Handover was not found');
      const target = await loadAssignment(db, handover.to_assignment_id); if (target.primary_user_id !== actor.userId) throw new V14OperationError(403, 'DUTY_ASSIGNMENT_INACTIVE', 'Only the next owner can reject handover');
      await db.prepare(`UPDATE control_handovers SET status = 'REJECTED', rejection_reason = ? WHERE handover_id = ? AND status = 'PENDING'`).bind(requiredText(body, 'rejection_reason'), handover.handover_id).run();
      await db.prepare(`UPDATE control_role_assignments SET duty_status = 'ON_DUTY' WHERE assignment_id = ?`).bind(handover.from_assignment_id).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: handover.operation_control_plan_id, eventType: 'CONTROL_HANDOVER_REJECTED', idempotencyKey: idem, flightId: handover.flight_id, payload: { handover_id: handover.handover_id, rejection_reason: requiredText(body, 'rejection_reason') } });
      return response(c, { result: 'REJECTED', handover_id: handover.handover_id, escalated: true });
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/operation-control-plans/:id/resource-readiness', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const rows = await db.prepare(`SELECT * FROM resource_readiness_checks WHERE operation_control_plan_id = ? ORDER BY resource_scope, check_item_code`).bind(c.req.param('id')).all();
      const blocking = rows.results.filter((item: any) => ['NOT_READY', 'EXPIRED', 'UNKNOWN'].includes(item.status) && item.blocking_level === 'BLOCKER');
      return response(c, { overall_status: blocking.length ? 'BLOCKED' : 'READY_OR_WARNING', blocking_items: blocking, items: rows.results });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/resource-readiness/checks', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadRequired<{ flight_id: string }>(db, `SELECT flight_id FROM operation_control_plans WHERE operation_control_plan_id = ?`, [c.req.param('id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      const checkId = `READY-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO resource_readiness_checks (
           readiness_check_id, tenant_id, operation_control_plan_id, resource_scope, check_item_code,
           required_value, actual_value, blocking_level, status, primary_supplier_id, backup_supplier_id,
           replacement_eta_minutes, evidence_refs_json, checked_by, checked_at, valid_until, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(operation_control_plan_id, resource_scope, check_item_code) DO UPDATE SET
           actual_value = excluded.actual_value, blocking_level = excluded.blocking_level,
           status = excluded.status, primary_supplier_id = excluded.primary_supplier_id,
           backup_supplier_id = excluded.backup_supplier_id, replacement_eta_minutes = excluded.replacement_eta_minutes,
           evidence_refs_json = excluded.evidence_refs_json, checked_by = excluded.checked_by,
           checked_at = excluded.checked_at, valid_until = excluded.valid_until, updated_at = excluded.updated_at`
      ).bind(checkId, actor.tenantId, c.req.param('id'), requiredText(body, 'resource_scope'), requiredText(body, 'check_item_code'),
        optionalText(body, 'required_value'), optionalText(body, 'actual_value'), optionalText(body, 'blocking_level') ?? 'WARNING',
        requiredText(body, 'status'), optionalText(body, 'primary_supplier_id'), optionalText(body, 'backup_supplier_id'),
        integerValue(body, 'replacement_eta_minutes') || null, JSON.stringify(stringArray(body, 'evidence_ids')), actor.userId, now,
        optionalText(body, 'valid_until'), now).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: c.req.param('id'), eventType: 'RESOURCE_READINESS_CHECKED', idempotencyKey: idem, flightId: plan.flight_id, payload: body });
      return response(c, { result: requiredText(body, 'status'), readiness_check_id: checkId });
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/decisions', requireRoles(['OCC_DM', 'platform_admin']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadRequired<{ flight_id: string }>(db, `SELECT flight_id FROM operation_control_plans WHERE operation_control_plan_id = ?`, [c.req.param('id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      const occurredAt = requiredText(body, 'occurred_at'); const mustRecordBy = new Date(new Date(occurredAt).getTime() + 30 * 60_000).toISOString(); const recordedAt = new Date().toISOString();
      const late = recordedAt > mustRecordBy; if (late && !optionalText(body, 'late_record_reason')) throw new V14OperationError(409, 'DECISION_RECORD_OVERDUE', 'Late decision backfill requires late_record_reason', { must_record_by: mustRecordBy });
      const requestedBy = requiredText(body, 'requested_by'); if (requestedBy === actor.userId) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Decision requester and approver must differ');
      const decisionType = requiredText(body, 'decision_type');
      if (!['PORT_CHANGE', 'PRIORITY_CHANGE', 'OFFLOAD', 'PAYLOAD_REDUCTION', 'ETA_OVERRIDE', 'RECOVERY_PLAN', 'OTHER'].includes(decisionType)) {
        throw new V14OperationError(400, 'VALIDATION_ERROR', 'Unsupported decision_type');
      }
      const decisionId = `DEC-${crypto.randomUUID()}`;
      await db.prepare(
        `INSERT INTO decision_records (
           decision_record_id, tenant_id, operation_control_plan_id, source_channel, occurred_at,
           must_record_by, recorded_at, late_record_reason, decision_type, decision_text,
           affected_object_refs_json, affected_gate_codes_json, requested_by, approved_by,
           evidence_refs_json, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED')`
      ).bind(decisionId, actor.tenantId, c.req.param('id'), requiredText(body, 'source_channel'), occurredAt,
        mustRecordBy, recordedAt, optionalText(body, 'late_record_reason'), decisionType, requiredText(body, 'decision_text'),
        JSON.stringify(body.affected_object_refs ?? []), JSON.stringify(body.affected_gate_codes ?? []), requestedBy, actor.userId,
        JSON.stringify(stringArray(body, 'evidence_ids'))).run();
      const signalId = optionalText(body, 'control_input_signal_id');
      if (signalId) {
        const signal = await loadRequired<{ operation_control_plan_id: string }>(db,
          `SELECT operation_control_plan_id FROM control_input_signals WHERE control_input_signal_id = ?`,
          [signalId], 'CONTROL_INPUT_SIGNAL_NOT_FOUND', 'Control input signal was not found');
        if (signal.operation_control_plan_id !== c.req.param('id')) throw new V14OperationError(409, 'CONTROL_INPUT_SIGNAL_PLAN_MISMATCH', 'Control input signal belongs to another plan');
        await db.prepare(`UPDATE control_input_signals SET decision_record_id = ?, status = 'RECORDED' WHERE control_input_signal_id = ?`)
          .bind(decisionId, signalId).run();
      }
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: c.req.param('id'), eventType: 'DECISION_RECORDED', idempotencyKey: idem, flightId: plan.flight_id, occurredAt, payload: { decision_record_id: decisionId, recorded_late: late } });
      return response(c, { result: 'APPROVED', decision_record_id: decisionId, control_input_signal_id: signalId, must_record_by: mustRecordBy, recorded_late: late }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/operation-control-plans/:id/external-execution-statuses', requireRoles(occView), async (c) => {
    try { const db = requireV14Db(c.env); const rows = await db.prepare(`SELECT * FROM external_execution_statuses WHERE operation_control_plan_id = ? ORDER BY recorded_at`).bind(c.req.param('id')).all(); return response(c, { items: rows.results }); }
    catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/operation-control-plans/:id/external-execution-statuses', requireRoles(['OBI_OVERSEAS_INTERFACE']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadRequired<{ flight_id: string }>(db, `SELECT flight_id FROM operation_control_plans WHERE operation_control_plan_id = ?`, [c.req.param('id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      if (body.acting_as_execution_party === true || body.confirmed_legal_execution === true || optionalText(body, 'execution_party_id') === actor.userId) {
        throw new V14OperationError(403, 'OBI_EXECUTION_PERMISSION_DENIED', 'OBI records and escalates overseas source facts but cannot claim legal execution authority');
      }
      const permission = await assertOccPermission(db, actor, { flightId: plan.flight_id, requiredRoles: ['OBI_OVERSEAS_INTERFACE'], segmentCode: 'OBI', objectRef: c.req.param('id') });
      if (stringArray(body, 'evidence_ids').length === 0 || !optionalText(body, 'source_statement_ref')) throw new V14OperationError(409, 'EXTERNAL_STATUS_EVIDENCE_MISSING', 'External status requires SMDG source statement and evidence');
      const statusId = `EXT-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO external_execution_statuses (
           external_status_id, tenant_id, operation_control_plan_id, execution_party_id, stage_code,
           planned_at, forecast_at, actual_at, external_sla_rule_id, status, blocker_code,
           next_update_at, evidence_refs_json, obi_owner_assignment_id, source_contact_entry_id,
           source_statement_ref, recorded_at
         ) VALUES (?, ?, ?, 'SMDG', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(statusId, actor.tenantId, c.req.param('id'), requiredText(body, 'stage_code'), optionalText(body, 'planned_at'),
        optionalText(body, 'forecast_at'), optionalText(body, 'actual_at'), optionalText(body, 'external_sla_rule_id'), requiredText(body, 'status'),
        optionalText(body, 'blocker_code'), optionalText(body, 'next_update_at'), JSON.stringify(stringArray(body, 'evidence_ids')),
        permission.assignment_id, requiredText(body, 'source_contact_entry_id'), requiredText(body, 'source_statement_ref'), now).run();
      await appendOperationEvent(db, actor, { aggregateType: 'OperationControlPlan', aggregateId: c.req.param('id'), eventType: 'EXTERNAL_EXECUTION_STATUS_RECORDED', eventAction: requiredText(body, 'stage_code'), idempotencyKey: idem, flightId: plan.flight_id, payload: { external_status_id: statusId, execution_party: 'SMDG', obi_records_source_only: true } });
      return response(c, { result: 'RECORDED', external_status_id: statusId, execution_party: 'SMDG' }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.get('/api/v1/flights/:flight_id/cargo-master-record', requireRoles(occView), async (c) => {
    try { const db = requireV14Db(c.env); const record = await db.prepare(`SELECT * FROM flight_cargo_master_records WHERE flight_id = ? AND active_flag = 1 ORDER BY record_version DESC LIMIT 1`).bind(c.req.param('flight_id')).first(); return response(c, { cargo_master_record: record }); }
    catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/flights/:flight_id/cargo-master-record/freeze', requireRoles(['B1_TAS_STATION_CONTROLLER', 'DQC_DATA_QUALITY_CONTROLLER']), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const plan = await loadRequired<{ operation_control_plan_id: string }>(db, `SELECT operation_control_plan_id FROM operation_control_plans WHERE flight_id = ?`, [c.req.param('flight_id')], 'CONTROL_PLAN_NOT_FOUND', 'Control plan was not found');
      const maintainedBy = requiredText(body, 'maintained_by'); if (maintainedBy === actor.userId) throw new V14OperationError(409, 'MAKER_CHECKER_ROLE_CONFLICT', 'Cargo master maintainer and freezer must differ');
      const version = await db.prepare(`SELECT COALESCE(MAX(record_version), 0) + 1 AS next_version FROM flight_cargo_master_records WHERE flight_id = ?`).bind(c.req.param('flight_id')).first<{ next_version: number }>();
      const status = requiredText(body, 'record_status'); if (!['INITIAL_FROZEN', 'FINAL_CBA_FROZEN', 'MANIFEST_FROZEN'].includes(status)) throw new V14OperationError(400, 'VALIDATION_ERROR', 'Invalid freeze status');
      await db.prepare(`UPDATE flight_cargo_master_records SET active_flag = 0, record_status = 'SUPERSEDED' WHERE flight_id = ? AND active_flag = 1`).bind(c.req.param('flight_id')).run();
      const data = {
        planned_pieces: integerValue(body, 'planned_pieces'), planned_weight_kg: numberValue(body, 'planned_weight_kg'),
        tas_received_pieces: integerValue(body, 'tas_received_pieces'), tas_received_weight_kg: numberValue(body, 'tas_received_weight_kg'),
        security_entered_pieces: integerValue(body, 'security_entered_pieces'), security_passed_pieces: integerValue(body, 'security_passed_pieces'),
        security_held_pieces: integerValue(body, 'security_held_pieces'), security_returned_pieces: integerValue(body, 'security_returned_pieces'),
        buildup_pieces: integerValue(body, 'buildup_pieces'), handed_to_airline_pieces: integerValue(body, 'handed_to_airline_pieces'), loaded_pieces: integerValue(body, 'loaded_pieces'),
        uld_ids: body.uld_ids ?? [], manifest_document_id: optionalText(body, 'manifest_document_id')
      };
      const hash = await sha256Hex(JSON.stringify(data)); const recordId = `FCMR-${crypto.randomUUID()}`; const now = new Date().toISOString();
      await db.prepare(
        `INSERT INTO flight_cargo_master_records (
           flight_cargo_master_record_id, tenant_id, flight_id, operation_control_plan_id,
           record_version, record_status, planned_pieces, planned_weight_kg, tas_received_pieces,
           tas_received_weight_kg, security_entered_pieces, security_passed_pieces,
           security_held_pieces, security_returned_pieces, buildup_pieces,
           handed_to_airline_pieces, loaded_pieces, uld_ids_json, cba_version_id,
           manifest_document_id, exception_ids_json, change_request_ids_json,
           maintained_by, reviewed_by, frozen_by, frozen_at, source_event_refs_json,
           record_hash, active_flag
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      ).bind(recordId, actor.tenantId, c.req.param('flight_id'), plan.operation_control_plan_id,
        Number(version?.next_version ?? 1), status, data.planned_pieces, data.planned_weight_kg,
        data.tas_received_pieces, data.tas_received_weight_kg, data.security_entered_pieces,
        data.security_passed_pieces, data.security_held_pieces, data.security_returned_pieces,
        data.buildup_pieces, data.handed_to_airline_pieces, data.loaded_pieces, JSON.stringify(data.uld_ids),
        optionalText(body, 'cba_version_id'), data.manifest_document_id, JSON.stringify(body.exception_ids ?? []),
        JSON.stringify(body.change_request_ids ?? []), maintainedBy, optionalText(body, 'reviewed_by'),
        actor.userId, now, JSON.stringify(body.source_event_refs ?? []), hash).run();
      await appendOperationEvent(db, actor, { aggregateType: 'FlightCargoMasterRecord', aggregateId: recordId, eventType: 'FLIGHT_CARGO_MASTER_FROZEN', eventAction: status, idempotencyKey: idem, flightId: c.req.param('flight_id'), payload: { record_version: Number(version?.next_version ?? 1), record_hash: hash } });
      return response(c, { result: status, flight_cargo_master_record_id: recordId, record_version: Number(version?.next_version ?? 1), record_hash: hash }, 201);
    } catch (error) { return handleError(c, error); }
  });

  app.post('/api/v1/incidents/:id/updates', requireRoles(occView), async (c) => {
    try {
      const db = requireV14Db(c.env); const actor = c.var.actor; const body = await c.req.json<Record<string, unknown>>();
      const idem = idempotencyKey(c.req.raw.headers, body); if (await findOperationByIdempotency(db, actor.tenantId, idem)) return response(c, { result: 'DUPLICATE' });
      const exception = await loadRequired<Record<string, any>>(db, `SELECT * FROM exceptions WHERE exception_id = ?`, [c.req.param('id')], 'INCIDENT_NOT_FOUND', 'Incident was not found');
      const color = requiredText(body, 'health_color'); if (color === 'RED' && !optionalText(body, 'incident_owner_id')) throw new V14OperationError(409, 'INCIDENT_OWNER_REQUIRED', 'Red incident requires exactly one owner');
      const updateId = `INCUP-${crypto.randomUUID()}`; const occurredAt = optionalText(body, 'occurred_at') ?? new Date().toISOString();
      const recordedAt = Date.now();
      const nextUpdateAt = optionalText(body, 'next_update_at');
      const maxCadenceMinutes = color === 'RED' ? 60 : color === 'YELLOW' ? 60 : 120;
      if (color !== 'BLUE') {
        if (!nextUpdateAt || new Date(nextUpdateAt).getTime() <= recordedAt || new Date(nextUpdateAt).getTime() > recordedAt + maxCadenceMinutes * 60_000) {
          throw new V14OperationError(409, 'INCIDENT_UPDATE_CADENCE_INVALID', `${color} incident next update must be scheduled within ${maxCadenceMinutes} minutes`, { max_cadence_minutes: maxCadenceMinutes });
        }
      }
      if (color === 'RED' && requiredText(body, 'update_type') === 'FIRST_REPORT'
        && recordedAt - new Date(occurredAt).getTime() > 30 * 60_000 && !optionalText(body, 'late_report_reason')) {
        throw new V14OperationError(409, 'RED_FIRST_REPORT_OVERDUE', 'Red first report is due within 30 minutes; late reports require a reason');
      }
      await db.prepare(
        `INSERT INTO incident_updates (
           incident_update_id, tenant_id, exception_id, update_type, health_color,
           occurred_at, location_text, confirmed_facts, cargo_vehicle_position, current_hold,
           affected_next_milestone_id, latest_eta, remaining_buffer_minutes, incident_owner_id,
           actions_taken, coordination_needed, next_update_at, customer_message_status,
           evidence_ids_json, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(updateId, actor.tenantId, exception.exception_id, requiredText(body, 'update_type'), color, occurredAt,
        optionalText(body, 'location_text'), requiredText(body, 'confirmed_facts'), optionalText(body, 'cargo_vehicle_position'),
        optionalText(body, 'current_hold'), optionalText(body, 'affected_next_milestone_id'), optionalText(body, 'latest_eta'),
        integerValue(body, 'remaining_buffer_minutes') || null, optionalText(body, 'incident_owner_id'), optionalText(body, 'actions_taken'),
        optionalText(body, 'coordination_needed'), optionalText(body, 'next_update_at'), optionalText(body, 'customer_message_status'),
        JSON.stringify(stringArray(body, 'evidence_ids')), actor.userId).run();
      await appendOperationEvent(db, actor, { aggregateType: 'Incident', aggregateId: exception.exception_id, eventType: 'INCIDENT_STATUS_UPDATED', eventAction: requiredText(body, 'update_type'), idempotencyKey: idem, stationId: exception.station_id, payload: { incident_update_id: updateId, health_color: color } });
      return response(c, { result: requiredText(body, 'update_type'), incident_update_id: updateId }, 201);
    } catch (error) { return handleError(c, error); }
  });
}
