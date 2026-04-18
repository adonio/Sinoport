import type { ClientSource, RoleCode } from '@sinoport/contracts';
import { compare, hash } from 'bcryptjs';

export const LOCAL_AUTH_TOKEN_SECRET = 'sinoport-local-dev-secret';

export interface AuthActor {
  userId: string;
  roleIds: RoleCode[];
  stationScope: string[];
  tenantId: string;
  clientSource: ClientSource;
}

export interface AuthTokenClaims {
  user_id: string;
  role_ids: RoleCode[];
  station_scope: string[];
  tenant_id: string;
  client_source: ClientSource;
  exp: number;
  iat: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function isLocalEnvironment(environment?: string | null) {
  return (environment || 'local') === 'local';
}

export function allowLocalOnlyAuth(environment?: string | null, enabled?: string | null) {
  return isLocalEnvironment(environment) && enabled === 'true';
}

export function hasDebugActorHeaders(headers: Headers) {
  return Boolean(
    headers.get('X-Debug-User-Id') ||
      headers.get('X-Debug-Roles') ||
      headers.get('X-Debug-Station-Scope') ||
      headers.get('X-Debug-Tenant-Id')
  );
}

export class MissingAuthSecretError extends Error {
  constructor() {
    super('AUTH_TOKEN_SECRET is required outside local development');
    this.name = 'MissingAuthSecretError';
  }
}

export function resolveAuthTokenSecret(secret: string | undefined | null, environment?: string | null) {
  if (secret) {
    return secret;
  }

  if (isLocalEnvironment(environment)) {
    return LOCAL_AUTH_TOKEN_SECRET;
  }

  throw new MissingAuthSecretError();
}

export function buildActorFromHeaders(headers: Headers): AuthActor {
  const roleHeader = headers.get('X-Debug-Roles') ?? 'station_supervisor';
  const stationHeader = headers.get('X-Debug-Station-Scope') ?? 'MME';

  return {
    userId: headers.get('X-Debug-User-Id') ?? 'demo-supervisor',
    roleIds: roleHeader.split(',').map((item) => item.trim()) as RoleCode[],
    stationScope: stationHeader.split(',').map((item) => item.trim()),
    tenantId: headers.get('X-Debug-Tenant-Id') ?? 'sinoport-demo',
    clientSource: (headers.get('X-Client-Source') ?? 'station-web') as ClientSource
  };
}

export function hasAnyRole(actor: AuthActor, allowedRoles: RoleCode[]) {
  return actor.roleIds.some((role) => allowedRoles.includes(role));
}

export function buildActorFromClaims(claims: AuthTokenClaims): AuthActor {
  return {
    userId: claims.user_id,
    roleIds: claims.role_ids,
    stationScope: claims.station_scope,
    tenantId: claims.tenant_id,
    clientSource: claims.client_source
  };
}

export async function signAuthToken(
  claims: Omit<AuthTokenClaims, 'exp' | 'iat'>,
  secret: string,
  expiresInSeconds = 60 * 60 * 12
) {
  const payload: AuthTokenClaims = {
    ...claims,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = await signString(encodedPayload, secret);

  return `sp1.${encodedPayload}.${signature}`;
}

export async function verifyAuthToken(token: string, secret: string): Promise<AuthTokenClaims | null> {
  const [prefix, payload, signature] = token.split('.');

  if (prefix !== 'sp1' || !payload || !signature) {
    return null;
  }

  const expected = await signString(payload, secret);

  if (expected !== signature) {
    return null;
  }

  const claims = JSON.parse(fromBase64Url(payload)) as AuthTokenClaims;

  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return claims;
}

export function mapMobileRoleKeyToRoleCodes(roleKey: string): RoleCode[] {
  switch (roleKey) {
    case 'checker':
      return ['mobile_operator', 'check_worker'];
    case 'supervisor':
      return ['station_supervisor'];
    case 'document_clerk':
      return ['document_desk'];
    case 'delivery_clerk':
      return ['delivery_desk'];
    case 'driver':
      return ['mobile_operator'];
    case 'receiver':
    default:
      return ['mobile_operator', 'inbound_operator'];
  }
}

export function resolveStationId(actor: AuthActor, requestedStationId?: string | null) {
  if (!requestedStationId) {
    return actor.stationScope[0] ?? null;
  }

  if (!actor.stationScope.includes(requestedStationId)) {
    throw new StationScopeDeniedError(requestedStationId);
  }

  return requestedStationId;
}

export function ensureActorCanAccessStation(actor: AuthActor, stationId?: string | null) {
  if (!stationId) {
    return;
  }

  if (!actor.stationScope.includes(stationId)) {
    throw new StationScopeDeniedError(stationId);
  }
}

export function ensureAssignableRole(actor: AuthActor, role: RoleCode) {
  if (!hasAnyRole(actor, ['station_supervisor']) && role !== 'mobile_operator') {
    throw new PolicyDeniedError(`actor cannot assign role ${role}`);
  }
}

export class PolicyDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyDeniedError';
  }
}

export class StationScopeDeniedError extends Error {
  constructor(public readonly stationId: string) {
    super(`actor cannot access station ${stationId}`);
    this.name = 'StationScopeDeniedError';
  }
}

export async function hashPassword(value: string) {
  return hash(value, 10);
}

export async function verifyPasswordHash(value: string, passwordHash: string) {
  return compare(value, passwordHash);
}

async function signString(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value));

  return toBase64Url(signature);
}

function toBase64Url(input: string | ArrayBuffer) {
  const bytes =
    typeof input === 'string'
      ? textEncoder.encode(input)
      : new Uint8Array(input);

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return textDecoder.decode(bytes);
}
