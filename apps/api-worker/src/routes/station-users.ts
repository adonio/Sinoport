import type { MiddlewareHandler } from 'hono';
import { hashPassword, verifyPasswordHash } from '@sinoport/auth';
import type { RoleCode } from '@sinoport/contracts';
import type { ApiApp } from '../index';
import { jsonError } from '../lib/http';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

const stationAssignableRoles: RoleCode[] = [
  'station_admin',
  'station_supervisor',
  'document_desk',
  'check_worker',
  'inbound_operator',
  'delivery_desk',
  'mobile_operator',
  'A1_CARGO_CONTROLLER',
  'A2_DOMESTIC_TRUCK_CONTROLLER',
  'A3_CROSS_BORDER_CONTROLLER',
  'B1_TAS_STATION_CONTROLLER',
  'B2_FLIGHT_MONITOR',
  'DQC_DATA_QUALITY_CONTROLLER',
  'PREWH_OPERATOR',
  'TRUCK_OPERATOR',
  'ALASHANKOU_AGENT',
  'DOSTYK_AGENT',
  'TAS_OPERATOR'
];

const roleLabels: Partial<Record<RoleCode, string>> = {
  station_admin: '货站管理员',
  station_supervisor: '货站主管',
  document_desk: '单证岗',
  check_worker: '清点岗',
  inbound_operator: '进港操作员',
  delivery_desk: '交付岗',
  mobile_operator: '移动端操作员',
  A1_CARGO_CONTROLLER: 'A1 货量控制',
  A2_DOMESTIC_TRUCK_CONTROLLER: 'A2 国内卡车控制',
  A3_CROSS_BORDER_CONTROLLER: 'A3 跨境控制',
  B1_TAS_STATION_CONTROLLER: 'B1 TAS 货站控制',
  B2_FLIGHT_MONITOR: 'B2 航班监控',
  DQC_DATA_QUALITY_CONTROLLER: '数据质量控制',
  PREWH_OPERATOR: '前置仓操作员',
  TRUCK_OPERATOR: '卡车操作员',
  ALASHANKOU_AGENT: '阿拉山口代理',
  DOSTYK_AGENT: '多斯特克代理',
  TAS_OPERATOR: 'TAS 操作员'
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeLoginName(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRoles(value: unknown): RoleCode[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter((item): item is RoleCode => stationAssignableRoles.includes(item as RoleCode)))];
}

function resolveManagedStation(c: any, requested?: unknown) {
  const actor = c.var.actor;
  const stationId = String(requested || actor.stationScope?.[0] || '').trim().toUpperCase();
  if (!stationId) throw new Error('STATION_REQUIRED');
  if (!actor.roleIds.includes('platform_admin') && !actor.stationScope.includes(stationId)) {
    throw new Error('STATION_SCOPE_DENIED');
  }
  return stationId;
}

function canGrantStationAdmin(c: any) {
  return c.var.actor.roleIds.includes('platform_admin') || c.var.actor.roleIds.includes('station_admin');
}

async function writeAudit(c: any, stationId: string, action: string, userId: string, summary: string, payload: unknown = {}) {
  const actor = c.var.actor;
  await c.env.DB.prepare(
    `INSERT INTO audit_events (
       audit_id, request_id, actor_id, actor_role, client_source, action,
       object_type, object_id, station_id, summary, payload_json, created_at
     ) VALUES (?, ?, ?, ?, 'station-web', ?, 'StationUser', ?, ?, ?, ?, ?)`
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header('X-Request-Id') || `station-user-${crypto.randomUUID()}`,
      actor.userId,
      actor.roleIds[0] || 'station_admin',
      action,
      userId,
      stationId,
      summary,
      JSON.stringify(payload),
      nowIso()
    )
    .run();
}

async function loadStationUser(db: any, stationId: string, userId: string) {
  const user = await db.prepare(
    `SELECT u.user_id, u.display_name, u.email, u.worker_code AS employee_no, u.default_station_id,
            sc.login_name, sc.account_status, sc.must_change_password,
            sc.failed_login_attempts, sc.locked_until, sc.last_login_at,
            sc.created_at, sc.updated_at
     FROM users u
     JOIN station_credentials sc ON sc.user_id = u.user_id
     WHERE u.user_id = ? AND sc.station_id = ?
     LIMIT 1`
  ).bind(userId, stationId).first();
  if (!user) return null;
  const roles = await db.prepare(
    `SELECT role_code FROM user_roles WHERE user_id = ? AND station_id = ? ORDER BY role_code`
  ).bind(userId, stationId).all();
  const roleCodes: RoleCode[] = (roles.results || []).map((item: any) => item.role_code as RoleCode);
  return {
    ...user,
    roles: roleCodes.filter((role: RoleCode) => stationAssignableRoles.includes(role)),
    protected_roles: roleCodes.filter((role: RoleCode) => !stationAssignableRoles.includes(role))
  };
}

function handleRouteError(c: any, error: unknown) {
  if (error instanceof Error && error.message === 'STATION_REQUIRED') {
    return jsonError(c, 400, 'STATION_REQUIRED', 'Station is required');
  }
  if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
    return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot manage users for this station');
  }
  console.error('[station-users]', error);
  return jsonError(c, 500, 'INTERNAL_ERROR', 'Station user operation failed');
}

export function registerStationUserRoutes(app: ApiApp, requireRoles: RequireRoles) {
  const manageRoles: RoleCode[] = ['platform_admin', 'station_admin'];

  app.get('/api/v1/station/users/options', requireRoles(manageRoles), async (c) => {
    try {
      const stationId = resolveManagedStation(c, c.req.query('station_id'));
      return c.json({
        data: {
          station_id: stationId,
          role_options: stationAssignableRoles.map((role) => ({ value: role, label: roleLabels[role] || role, disabled: false })),
          status_options: [
            { value: 'active', label: '启用', disabled: false },
            { value: 'disabled', label: '停用', disabled: false },
            { value: 'locked', label: '锁定', disabled: false }
          ]
        }
      });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.get('/api/v1/station/users', requireRoles(manageRoles), async (c) => {
    try {
      const db = c.env.DB!;
      const stationId = resolveManagedStation(c, c.req.query('station_id'));
      const rows = await db.prepare(
        `SELECT u.user_id, u.display_name, u.email, u.worker_code AS employee_no, u.default_station_id,
                sc.login_name, sc.account_status, sc.must_change_password,
                sc.failed_login_attempts, sc.locked_until, sc.last_login_at,
                sc.created_at, sc.updated_at
         FROM users u
         JOIN station_credentials sc ON sc.user_id = u.user_id
         WHERE sc.station_id = ?
         ORDER BY u.display_name, sc.login_name`
      ).bind(stationId).all();
      const items = await Promise.all((rows?.results || []).map(async (row: any) => loadStationUser(db, stationId, row.user_id)));
      return c.json({ items: items.filter(Boolean), total: items.length, station_id: stationId });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.post('/api/v1/station/users', requireRoles(manageRoles), async (c) => {
    try {
      const db = c.env.DB!;
      const body = await c.req.json();
      const stationId = resolveManagedStation(c, body.station_id);
      const loginName = normalizeLoginName(body.login_name || body.email);
      const displayName = String(body.display_name || '').trim();
      const password = String(body.password || '');
      const roles = normalizeRoles(body.roles);
      if (!loginName || !displayName || password.length < 10 || !roles.length) {
        return jsonError(c, 400, 'INVALID_INPUT', 'Login name, display name, password of at least 10 characters, and one role are required');
      }
      if (roles.includes('station_admin') && !canGrantStationAdmin(c)) {
        return jsonError(c, 403, 'ROLE_GRANT_DENIED', 'Current actor cannot grant station administrator');
      }
      const duplicate = await db.prepare(`SELECT user_id FROM station_credentials WHERE LOWER(login_name) = ? LIMIT 1`).bind(loginName).first();
      if (duplicate) return jsonError(c, 409, 'LOGIN_NAME_EXISTS', 'Login name already exists');

      const userId = `STU-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
      const now = nowIso();
      const passwordHash = await hashPassword(password);
      if (!db.batch) throw new Error('ATOMIC_BATCH_UNAVAILABLE');
      const statements = [
        db.prepare(
          `INSERT INTO users (user_id, tenant_id, display_name, email, default_station_id, worker_code)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(userId, c.var.actor.tenantId, displayName, loginName, stationId, String(body.employee_no || '').trim() || null),
        db.prepare(
          `INSERT INTO station_credentials (
             user_id, password_hash, login_name, station_id, account_status,
             must_change_password, failed_login_attempts, created_by,
             password_updated_at, created_at, updated_at
           ) VALUES (?, ?, ?, ?, 'active', ?, 0, ?, ?, ?, ?)`
        ).bind(userId, passwordHash, loginName, stationId, body.must_change_password === false ? 0 : 1, c.var.actor.userId, now, now, now),
        ...roles.map((role) => db.prepare(`INSERT INTO user_roles (user_id, role_code, station_id) VALUES (?, ?, ?)`).bind(userId, role, stationId))
      ];
      await db.batch(statements);
      await writeAudit(c, stationId, 'STATION_USER_CREATED', userId, `Created station user ${displayName}`, { login_name: loginName, roles });
      return c.json({ data: await loadStationUser(db, stationId, userId) }, 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.patch('/api/v1/station/users/:userId', requireRoles(manageRoles), async (c) => {
    try {
      const db = c.env.DB!;
      const body = await c.req.json();
      const stationId = resolveManagedStation(c, body.station_id || c.req.query('station_id'));
      const userId = c.req.param('userId');
      const current = await loadStationUser(db, stationId, userId);
      if (!current) return jsonError(c, 404, 'STATION_USER_NOT_FOUND', 'Station user not found');
      if (userId === c.var.actor.userId && body.account_status && body.account_status !== 'active') {
        return jsonError(c, 409, 'SELF_DISABLE_DENIED', 'You cannot disable your own account');
      }
      const roles = body.roles === undefined ? current.roles : normalizeRoles(body.roles);
      if (!roles.length) return jsonError(c, 400, 'ROLE_REQUIRED', 'At least one station role is required');
      if (roles.includes('station_admin') && !canGrantStationAdmin(c)) {
        return jsonError(c, 403, 'ROLE_GRANT_DENIED', 'Current actor cannot grant station administrator');
      }
      const status = ['active', 'disabled', 'locked'].includes(body.account_status) ? body.account_status : current.account_status;
      const now = nowIso();
      if (!db.batch) throw new Error('ATOMIC_BATCH_UNAVAILABLE');
      const statements = [
        db.prepare(`UPDATE users SET display_name = ?, email = ?, worker_code = ?, updated_at = ? WHERE user_id = ?`).bind(
          String(body.display_name ?? current.display_name).trim(),
          normalizeLoginName(body.email ?? current.email),
          String(body.employee_no ?? current.employee_no ?? '').trim() || null,
          now,
          userId
        ),
        db.prepare(
          `UPDATE station_credentials
           SET account_status = ?, must_change_password = ?, failed_login_attempts = CASE WHEN ? = 'active' THEN 0 ELSE failed_login_attempts END,
               locked_until = CASE WHEN ? = 'active' THEN NULL ELSE locked_until END,
               disabled_at = CASE WHEN ? = 'disabled' THEN ? ELSE NULL END, updated_at = ?
           WHERE user_id = ? AND station_id = ?`
        ).bind(status, body.must_change_password === undefined ? current.must_change_password : body.must_change_password ? 1 : 0, status, status, status, now, now, userId, stationId),
        db.prepare(
          `DELETE FROM user_roles
           WHERE user_id = ? AND station_id = ?
             AND role_code IN (${stationAssignableRoles.map(() => '?').join(', ')})`
        ).bind(userId, stationId, ...stationAssignableRoles),
        ...roles.map((role: RoleCode) => db.prepare(`INSERT INTO user_roles (user_id, role_code, station_id) VALUES (?, ?, ?)`).bind(userId, role, stationId)),
        ...(status !== 'active' ? [db.prepare(`DELETE FROM station_refresh_tokens WHERE user_id = ? AND station_id = ?`).bind(userId, stationId)] : [])
      ];
      await db.batch(statements);
      await writeAudit(c, stationId, 'STATION_USER_UPDATED', userId, `Updated station user ${userId}`, { roles, account_status: status });
      return c.json({ data: await loadStationUser(db, stationId, userId) });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.post('/api/v1/station/users/:userId/reset-password', requireRoles(manageRoles), async (c) => {
    try {
      const db = c.env.DB!;
      const body = await c.req.json();
      const stationId = resolveManagedStation(c, body.station_id);
      const userId = c.req.param('userId');
      const password = String(body.password || '');
      if (password.length < 10) return jsonError(c, 400, 'WEAK_PASSWORD', 'Password must contain at least 10 characters');
      const current = await loadStationUser(db, stationId, userId);
      if (!current) return jsonError(c, 404, 'STATION_USER_NOT_FOUND', 'Station user not found');
      const passwordHash = await hashPassword(password);
      const now = nowIso();
      if (!db.batch) throw new Error('ATOMIC_BATCH_UNAVAILABLE');
      await db.batch([
        db.prepare(
          `UPDATE station_credentials SET password_hash = ?, password_updated_at = ?, must_change_password = 1,
             failed_login_attempts = 0, locked_until = NULL, account_status = 'active', updated_at = ?
           WHERE user_id = ? AND station_id = ?`
        ).bind(passwordHash, now, now, userId, stationId),
        db.prepare(`DELETE FROM station_refresh_tokens WHERE user_id = ? AND station_id = ?`).bind(userId, stationId)
      ]);
      await writeAudit(c, stationId, 'STATION_USER_PASSWORD_RESET', userId, `Reset password for station user ${userId}`);
      return c.json({ data: { user_id: userId, password_reset: true, must_change_password: true } });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.post('/api/v1/station/me/change-password', async (c) => {
    try {
      const db = c.env.DB!;
      const body = await c.req.json();
      const stationId = resolveManagedStation(c, c.var.actor.stationScope?.[0]);
      const currentPassword = String(body.current_password || '');
      const newPassword = String(body.new_password || '');
      if (newPassword.length < 10) return jsonError(c, 400, 'WEAK_PASSWORD', 'Password must contain at least 10 characters');
      const credential = await db.prepare(
        `SELECT password_hash FROM station_credentials WHERE user_id = ? AND station_id = ? LIMIT 1`
      ).bind(c.var.actor.userId, stationId).first() as { password_hash?: string } | null;
      if (!credential?.password_hash || !(await verifyPasswordHash(currentPassword, credential.password_hash))) {
        return jsonError(c, 401, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
      }
      const passwordHash = await hashPassword(newPassword);
      const now = nowIso();
      if (!db.batch) throw new Error('ATOMIC_BATCH_UNAVAILABLE');
      await db.batch([
        db.prepare(
          `UPDATE station_credentials SET password_hash = ?, password_updated_at = ?, must_change_password = 0,
             failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE user_id = ? AND station_id = ?`
        ).bind(passwordHash, now, now, c.var.actor.userId, stationId),
        db.prepare(`DELETE FROM station_refresh_tokens WHERE user_id = ? AND station_id = ?`).bind(c.var.actor.userId, stationId)
      ]);
      await writeAudit(c, stationId, 'STATION_USER_PASSWORD_CHANGED', c.var.actor.userId, 'Station user changed own password');
      return c.json({ data: { password_changed: true } });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });
}
