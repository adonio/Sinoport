import type { MiddlewareHandler } from "hono";
import { jsonError } from "../lib/http";
import type { RoleCode } from "@sinoport/contracts";
import type { StationServices } from "@sinoport/domain";
import {
  allowLocalOnlyAuth,
  resolveAuthTokenSecret,
  signAuthToken,
  verifyPasswordHash,
} from "@sinoport/auth";
import { handleServiceError } from "../lib/http";
import {
  assertStationAccess,
  authorizeTaskAssignment,
  normalizeDocumentInput,
  normalizeInboundFlightListQuery,
  normalizeStationListQuery,
} from "../lib/policy";
import {
  loadDemoDatasetCatalog,
  loadDemoDatasetRecord,
} from "../lib/demo-datasets.js";
import {
  loadStationCopyPackage,
  loadPlatformStationCapabilityMatrix,
  loadStationOnboardingPlaybook,
  loadStationGovernanceSummary,
  loadStationGovernanceTemplate,
  loadStationGovernanceTemplates,
} from "../lib/station-governance.js";
import {
  importInboundBundle,
  InboundBundleImportError,
} from "../lib/station-bundle-import.js";
import {
  evaluateStationDataQuality,
  loadStationDataQualityIssues,
  loadPlatformDataQualityOverview,
  loadStationDataQualityOverview,
  loadStationDataQualityRules,
} from "../lib/data-quality.js";
import type { ApiApp } from "../index";

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

type AuditScope = Map<string, Set<string>>;

type PlatformStationRow = {
  station_id: string;
  station_name: string;
  region: string | null;
  control_level: string | null;
  phase: string | null;
  airport_code: string | null;
  icao_code: string | null;
  service_scope: string | null;
  owner_name: string | null;
  deleted_at: string | null;
  updated_at: string;
};

type PlatformStationCatalogItem = {
  code: string;
  name: string;
  region: string;
  control: string;
  phase: string;
  scope: string;
  owner: string;
  control_level: string | null;
  phase_key: string | null;
  owner_name: string | null;
  service_scope: string | null;
  airportCode?: string;
  icaoCode?: string;
  airport_code?: string;
  icao_code?: string;
  archived: boolean;
  deleted_at?: string | null;
  updatedAt: string;
};

type PlatformSelectOption = {
  value: string;
  label: string;
  disabled: boolean;
  meta?: Record<string, unknown>;
};

type UnifiedOptionGroupMap = Record<
  string,
  Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>
>;

function normalizeUnifiedOptionItems(items: unknown): PlatformSelectOption[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const value = String(record.value ?? "").trim();

      if (!value) {
        return null;
      }

      const meta =
        record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
          ? (record.meta as Record<string, unknown>)
          : undefined;

      return {
        value,
        label: String(record.label ?? value),
        disabled: Boolean(record.disabled),
        meta,
      } satisfies PlatformSelectOption;
    })
    .filter(Boolean) as PlatformSelectOption[];
}

function buildUnifiedOptionsPayload(
  scope: "platform" | "station",
  resource: string,
  groups: UnifiedOptionGroupMap,
  context: Record<string, unknown> = {},
) {
  return {
    scope,
    resource,
    ...context,
    groups: Object.fromEntries(
      Object.entries(groups).map(([key, value]) => [
        key,
        normalizeUnifiedOptionItems(value),
      ]),
    ),
  };
}

const DEFAULT_PLATFORM_PAGE_SIZE = 20;
const MAX_PLATFORM_PAGE_SIZE = 100;

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeStationCode(value: string | undefined | null) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeNullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeRequiredText(value: unknown) {
  return String(value ?? "").trim();
}

function parsePlatformPagination(query: Record<string, string | undefined>) {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PLATFORM_PAGE_SIZE,
    Math.max(
      1,
      Number.parseInt(
        query.page_size ?? String(DEFAULT_PLATFORM_PAGE_SIZE),
        10,
      ) || DEFAULT_PLATFORM_PAGE_SIZE,
    ),
  );

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function parseIncludeArchived(query: Record<string, string | undefined>) {
  return query.include_archived === "true" || query.include_archived === "1";
}

async function loadPlatformControlLevelOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT template_key, template_name, template_payload_json, control_level
        FROM station_governance_templates
        WHERE template_kind = 'control_level'
          AND control_level IS NOT NULL
        ORDER BY template_name ASC
      `,
    )
    .all()) as {
    results?: Array<{
      template_key: string;
      template_name: string;
      template_payload_json: string | null;
      control_level: string | null;
    }>;
  };

  return (rows.results || [])
    .map(
      (row: {
        template_key: string;
        template_name: string;
        template_payload_json: string | null;
        control_level: string | null;
      }) => {
        const payload = safeParseJson<Record<string, unknown>>(
          row.template_payload_json,
          {},
        );
        const value = String(row.control_level || "").trim();

        if (!value) {
          return null;
        }

        return {
          value,
          label: String(payload.label || row.template_name || value),
          disabled: false,
          meta: {
            template_key: row.template_key,
          },
        } satisfies PlatformSelectOption;
      },
    )
    .filter(Boolean) as PlatformSelectOption[];
}

async function loadPlatformPhaseOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT template_key, template_name, template_payload_json, phase
        FROM station_governance_templates
        WHERE template_kind = 'phase'
          AND phase IS NOT NULL
        ORDER BY template_name ASC
      `,
    )
    .all()) as {
    results?: Array<{
      template_key: string;
      template_name: string;
      template_payload_json: string | null;
      phase: string | null;
    }>;
  };

  return (rows.results || [])
    .map(
      (row: {
        template_key: string;
        template_name: string;
        template_payload_json: string | null;
        phase: string | null;
      }) => {
        const payload = safeParseJson<Record<string, unknown>>(
          row.template_payload_json,
          {},
        );
        const value = String(row.phase || "").trim();

        if (!value) {
          return null;
        }

        return {
          value,
          label: String(payload.label || row.template_name || value),
          disabled: false,
          meta: {
            template_key: row.template_key,
          },
        } satisfies PlatformSelectOption;
      },
    )
    .filter(Boolean) as PlatformSelectOption[];
}

async function loadPlatformOwnerOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT DISTINCT owner_name
        FROM stations
        WHERE owner_name IS NOT NULL
          AND TRIM(owner_name) != ''
        ORDER BY owner_name ASC
      `,
    )
    .all()) as { results?: Array<{ owner_name: string }> };

  return (rows.results || []).map((row: { owner_name: string }) => ({
    value: row.owner_name,
    label: row.owner_name,
    disabled: false,
  }));
}

async function loadPlatformStationCatalogOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT station_id, station_name, deleted_at
        FROM stations
        ORDER BY station_name ASC, station_id ASC
      `,
    )
    .all()) as {
    results?: Array<{
      station_id: string;
      station_name: string;
      deleted_at: string | null;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.station_id,
    label: `${row.station_id} · ${row.station_name}`,
    disabled: Boolean(row.deleted_at),
    meta: {
      archived: Boolean(row.deleted_at),
    },
  }));
}

async function loadPlatformStationOptions(db: any) {
  const [controlLevels, phases, owners, stations] = await Promise.all([
    loadPlatformControlLevelOptions(db),
    loadPlatformPhaseOptions(db),
    loadPlatformOwnerOptions(db),
    loadPlatformStationCatalogOptions(db),
  ]);

  return {
    controlLevels,
    phases,
    owners,
    stations,
  };
}

function mapPlatformStationRow(
  row: PlatformStationRow,
  controlLabelMap: Map<string, string>,
  phaseLabelMap: Map<string, string>,
): PlatformStationCatalogItem {
  return {
    code: normalizeStationCode(row.station_id),
    name: row.station_name,
    region: row.region || "-",
    control:
      controlLabelMap.get(String(row.control_level || "")) ||
      row.control_level ||
      "-",
    phase: phaseLabelMap.get(String(row.phase || "")) || row.phase || "-",
    scope: row.service_scope || "-",
    owner: row.owner_name || "-",
    control_level: row.control_level,
    phase_key: row.phase,
    owner_name: row.owner_name,
    service_scope: row.service_scope,
    airportCode: row.airport_code || undefined,
    icaoCode: row.icao_code || undefined,
    airport_code: row.airport_code || undefined,
    icao_code: row.icao_code || undefined,
    archived: Boolean(row.deleted_at),
    deleted_at: row.deleted_at,
    updatedAt: row.updated_at,
  };
}

function mapPlatformCapabilityDetailRow(row: Record<string, any> | null) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    promise: row.promise || row.templateName || row.readiness || "-",
    risk: row.risk || "-",
  };
}

async function findPlatformStationRowByCode(db: any, stationId: string) {
  const normalizedStationId = normalizeStationCode(stationId);
  return (await db
    .prepare(
      `
        SELECT
          station_id,
          station_name,
          region,
          control_level,
          phase,
          airport_code,
          icao_code,
          service_scope,
          owner_name,
          deleted_at,
          updated_at
        FROM stations
        WHERE UPPER(station_id) = ?
        LIMIT 1
      `,
    )
    .bind(normalizedStationId)
    .first()) as PlatformStationRow | null;
}

async function listPlatformStationsFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const includeArchived = parseIncludeArchived(query);
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const keyword = String(query.keyword || "").trim();
  const whereClauses = ["1 = 1"];
  const params: unknown[] = [];

  if (!includeArchived) {
    whereClauses.push("s.deleted_at IS NULL");
  }

  if (keyword) {
    const fuzzy = `%${keyword}%`;
    whereClauses.push(
      `(s.station_id LIKE ? OR s.station_name LIKE ? OR COALESCE(s.region, '') LIKE ? OR COALESCE(s.airport_code, '') LIKE ? OR COALESCE(s.owner_name, '') LIKE ? OR COALESCE(s.service_scope, '') LIKE ?)`,
    );
    params.push(fuzzy, fuzzy, fuzzy, fuzzy, fuzzy, fuzzy);
  }

  const whereSql = whereClauses.join(" AND ");
  const [{ controlLevels, phases }, countResult, rows] = await Promise.all([
    loadPlatformStationOptions(db),
    db
      .prepare(
        `
          SELECT COUNT(*) AS total
          FROM stations s
          WHERE ${whereSql}
        `,
      )
      .bind(...params)
      .first(),
    db
      .prepare(
        `
          SELECT
            s.station_id,
            s.station_name,
            s.region,
            s.control_level,
            s.phase,
            s.airport_code,
            s.icao_code,
            s.service_scope,
            s.owner_name,
            s.deleted_at,
            s.updated_at
          FROM stations s
          WHERE ${whereSql}
          ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.station_id ASC
          LIMIT ?
          OFFSET ?
        `,
      )
      .bind(...params, pageSize, offset)
      .all(),
  ]);

  const controlLabelMap = new Map(
    controlLevels.map((item) => [item.value, item.label] as const),
  );
  const phaseLabelMap = new Map(
    phases.map((item) => [item.value, item.label] as const),
  );
  const items = (
    (rows as { results?: PlatformStationRow[] }).results || []
  ).map((row: PlatformStationRow) =>
    mapPlatformStationRow(row, controlLabelMap, phaseLabelMap),
  );

  return {
    items,
    page,
    page_size: pageSize,
    total: Number((countResult as { total?: number } | null)?.total || 0),
  };
}

async function loadPlatformStationDetailFromDb(db: any, stationId: string) {
  const normalizedStationId = normalizeStationCode(stationId);
  const station = await findPlatformStationRowByCode(db, normalizedStationId);

  if (!station) {
    return null;
  }

  const [{ controlLevels, phases }, zoneRows, deviceRows, teamRows] =
    await Promise.all([
      loadPlatformStationOptions(db),
      loadPlatformZoneRowsByStation(db, normalizedStationId),
      loadPlatformDeviceRowsByStation(db, normalizedStationId),
      loadPlatformTeamRowsByStation(db, normalizedStationId, true),
    ]);
  const controlLabelMap = new Map(
    controlLevels.map((item) => [item.value, item.label] as const),
  );
  const phaseLabelMap = new Map(
    phases.map((item) => [item.value, item.label] as const),
  );
  const catalogItem = mapPlatformStationRow(
    station,
    controlLabelMap,
    phaseLabelMap,
  );
  const capabilityMatrix = await loadPlatformStationCapabilityMatrix(db, [
    catalogItem,
  ]);

  return {
    station: catalogItem,
    capability: mapPlatformCapabilityDetailRow(
      capabilityMatrix.platformStationCapabilityRows[0] || null,
    ),
    teamRows,
    zoneRows,
    deviceRows,
    stationCapabilityColumns: capabilityMatrix.stationCapabilityColumns,
  };
}

async function writePlatformStationAudit(
  c: any,
  params: {
    action:
      | "STATION_CREATED"
      | "STATION_UPDATED"
      | "STATION_ARCHIVED"
      | "STATION_RESTORED";
    stationId: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actor.userId,
      actor.roleIds[0] || "platform_admin",
      actor.clientSource,
      params.action,
      "Station",
      params.stationId,
      params.stationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

type PlatformTeamRow = {
  team_id: string;
  station_id: string;
  team_name: string;
  owner_name: string | null;
  shift_code: string | null;
  team_status: string;
  headcount: number | null;
  mapped_lanes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  station_name: string | null;
};

function mapPlatformTeamRow(row: PlatformTeamRow) {
  return {
    team_id: row.team_id,
    code: row.team_id,
    station_id: row.station_id,
    station_code: row.station_id,
    station_name: row.station_name || row.station_id,
    team_name: row.team_name,
    name: row.team_name,
    owner_name: row.owner_name,
    owner: row.owner_name || "--",
    shift_code: row.shift_code,
    shift: row.shift_code || "--",
    team_status: row.team_status,
    status: row.team_status,
    headcount: row.headcount ?? 0,
    workers: row.headcount ?? 0,
    mapped_lanes: row.mapped_lanes || "",
    mappedLanes: row.mapped_lanes || "",
    team: row.team_name,
    archived: Boolean(row.deleted_at),
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPlatformTeamRowsByStation(
  db: any,
  stationId: string,
  includeArchived = false,
) {
  const normalizedStationId = normalizeStationCode(stationId);
  const rows = (await db
    .prepare(
      `
        SELECT
          t.team_id,
          t.station_id,
          t.team_name,
          t.owner_name,
          t.shift_code,
          t.team_status,
          t.headcount,
          t.mapped_lanes,
          t.deleted_at,
          t.created_at,
          t.updated_at,
          s.station_name
        FROM teams t
        LEFT JOIN stations s ON s.station_id = t.station_id
        WHERE t.station_id = ?
          AND (? = 1 OR t.deleted_at IS NULL)
        ORDER BY t.created_at ASC, t.team_name ASC
      `,
    )
    .bind(normalizedStationId, includeArchived ? 1 : 0)
    .all()) as { results?: PlatformTeamRow[] };

  return (rows.results || []).map(mapPlatformTeamRow);
}

async function loadPlatformStationTeamRows(
  db: any,
  includeArchived = false,
) {
  const rows = (await db
    .prepare(
      `
        SELECT
          t.team_id,
          t.station_id,
          t.team_name,
          t.owner_name,
          t.shift_code,
          t.team_status,
          t.headcount,
          t.mapped_lanes,
          t.deleted_at,
          t.created_at,
          t.updated_at,
          s.station_name
        FROM teams t
        LEFT JOIN stations s ON s.station_id = t.station_id
        WHERE (? = 1 OR t.deleted_at IS NULL)
        ORDER BY t.station_id ASC, t.created_at ASC, t.team_name ASC
      `,
    )
    .bind(includeArchived ? 1 : 0)
    .all()) as { results?: PlatformTeamRow[] };

  return (rows.results || []).map(mapPlatformTeamRow);
}

async function loadPlatformTeamShiftOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM team_shift_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformTeamStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM team_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformTeamOptions(db: any) {
  const [stationOptions, shifts, statuses] = await Promise.all([
    loadPlatformStationOptions(db),
    loadPlatformTeamShiftOptions(db),
    loadPlatformTeamStatusOptions(db),
  ]);

  return {
    stations: stationOptions.stations,
    shifts,
    statuses,
  };
}

async function listPlatformTeamsFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const includeArchived = parseIncludeArchived(query);
  const keyword = normalizeNullableText(query.keyword);
  const stationId = normalizeStationCode(query.station_id);
  const status = normalizeNullableText(query.status);
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (!includeArchived) {
    clauses.push("t.deleted_at IS NULL");
  }

  if (keyword) {
    clauses.push(
      `(t.team_id LIKE ? OR t.team_name LIKE ? OR COALESCE(t.owner_name, '') LIKE ? OR COALESCE(t.mapped_lanes, '') LIKE ? OR t.station_id LIKE ? OR COALESCE(s.station_name, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (stationId) {
    clauses.push("t.station_id = ?");
    params.push(stationId);
  }

  if (status) {
    clauses.push("t.team_status = ?");
    params.push(status);
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM teams t
    LEFT JOIN stations s ON s.station_id = t.station_id
    WHERE ${whereClause}
  `;

  const totalRow = (await db
    .prepare(`SELECT COUNT(*) AS total ${baseSql}`)
    .bind(...params)
    .first()) as { total?: number } | null;
  const rows = (await db
    .prepare(
      `
        SELECT
          t.team_id,
          t.station_id,
          t.team_name,
          t.owner_name,
          t.shift_code,
          t.team_status,
          t.headcount,
          t.mapped_lanes,
          t.deleted_at,
          t.created_at,
          t.updated_at,
          s.station_name
        ${baseSql}
        ORDER BY t.created_at ASC, t.team_name ASC
        LIMIT ? OFFSET ?
      `,
    )
    .bind(...params, pageSize, offset)
    .all()) as { results?: PlatformTeamRow[] };

  return {
    items: (rows.results || []).map(mapPlatformTeamRow),
    page,
    page_size: pageSize,
    total: Number(totalRow?.total || 0),
  };
}

async function loadPlatformTeamDetailFromDb(db: any, teamId: string) {
  const row = (await db
    .prepare(
      `
        SELECT
          t.team_id,
          t.station_id,
          t.team_name,
          t.owner_name,
          t.shift_code,
          t.team_status,
          t.headcount,
          t.mapped_lanes,
          t.deleted_at,
          t.created_at,
          t.updated_at,
          s.station_name
        FROM teams t
        LEFT JOIN stations s ON s.station_id = t.station_id
        WHERE t.team_id = ?
        LIMIT 1
      `,
    )
    .bind(teamId)
    .first()) as PlatformTeamRow | null;

  if (!row) {
    return null;
  }

  return {
    team: mapPlatformTeamRow(row),
  };
}

async function writePlatformTeamAudit(
  c: any,
  params: {
    action: "TEAM_CREATED" | "TEAM_UPDATED" | "TEAM_ARCHIVED" | "TEAM_RESTORED";
    teamId: string;
    stationId: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actor.userId,
      actor.roleIds[0] || "platform_admin",
      actor.clientSource,
      params.action,
      "Team",
      params.teamId,
      params.stationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

type PlatformZoneRow = {
  zone_id: string;
  station_id: string;
  zone_type: string;
  linked_lane: string | null;
  zone_status: string;
  note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  station_name: string | null;
};

function mapPlatformZoneRow(
  row: PlatformZoneRow,
  typeLabelMap: Map<string, string>,
  statusLabelMap: Map<string, string>,
) {
  return {
    zone_id: row.zone_id,
    code: row.zone_id,
    zone: row.zone_id,
    station_id: row.station_id,
    station_code: row.station_id,
    station: row.station_id,
    station_name: row.station_name || row.station_id,
    zone_type: row.zone_type,
    type: typeLabelMap.get(row.zone_type) || row.zone_type,
    linked_lane: row.linked_lane || "",
    linkedLane: row.linked_lane || "",
    zone_status: row.zone_status,
    status: row.deleted_at
      ? "已归档"
      : statusLabelMap.get(row.zone_status) || row.zone_status,
    note: row.note || "",
    archived: Boolean(row.deleted_at),
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPlatformZoneTypeOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM zone_type_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformZoneStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM zone_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformZoneOptions(db: any) {
  const [stationOptions, types, statuses] = await Promise.all([
    loadPlatformStationOptions(db),
    loadPlatformZoneTypeOptions(db),
    loadPlatformZoneStatusOptions(db),
  ]);

  return {
    stations: stationOptions.stations,
    types,
    statuses,
  };
}

async function loadPlatformZoneLabelMaps(db: any) {
  const { types, statuses } = await loadPlatformZoneOptions(db);

  return {
    typeLabelMap: new Map(
      types.map((item) => [item.value, item.label] as const),
    ),
    statusLabelMap: new Map(
      statuses.map((item) => [item.value, item.label] as const),
    ),
  };
}

async function listPlatformZonesFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const includeArchived = parseIncludeArchived(query);
  const keyword = normalizeNullableText(query.keyword);
  const stationId = normalizeStationCode(query.station_id);
  const status = normalizeNullableText(query.status);
  const type = normalizeNullableText(query.type);
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (!includeArchived) {
    clauses.push("z.deleted_at IS NULL");
  }

  if (keyword) {
    clauses.push(
      `(z.zone_id LIKE ? OR z.station_id LIKE ? OR COALESCE(s.station_name, '') LIKE ? OR COALESCE(z.zone_type, '') LIKE ? OR COALESCE(z.linked_lane, '') LIKE ? OR COALESCE(z.note, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (stationId) {
    clauses.push("z.station_id = ?");
    params.push(stationId);
  }

  if (status) {
    clauses.push("z.zone_status = ?");
    params.push(status);
  }

  if (type) {
    clauses.push("z.zone_type = ?");
    params.push(type);
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM zones z
    LEFT JOIN stations s ON s.station_id = z.station_id
    WHERE ${whereClause}
  `;

  const [{ typeLabelMap, statusLabelMap }, totalRow, rows] = await Promise.all([
    loadPlatformZoneLabelMaps(db),
    db
      .prepare(`SELECT COUNT(*) AS total ${baseSql}`)
      .bind(...params)
      .first(),
    db
      .prepare(
        `
          SELECT
            z.zone_id,
            z.station_id,
            z.zone_type,
            z.linked_lane,
            z.zone_status,
            z.note,
            z.deleted_at,
            z.created_at,
            z.updated_at,
            s.station_name
          ${baseSql}
          ORDER BY z.created_at ASC, z.zone_id ASC
          LIMIT ? OFFSET ?
        `,
      )
      .bind(...params, pageSize, offset)
      .all(),
  ]);

  return {
    items: (
      ((rows as { results?: PlatformZoneRow[] }).results ||
        []) as PlatformZoneRow[]
    ).map((row) => mapPlatformZoneRow(row, typeLabelMap, statusLabelMap)),
    page,
    page_size: pageSize,
    total: Number((totalRow as { total?: number } | null)?.total || 0),
  };
}

async function loadPlatformZoneDetailFromDb(db: any, zoneId: string) {
  const normalizedZoneId = normalizeRequiredText(zoneId).toUpperCase();
  const [labelMaps, row] = await Promise.all([
    loadPlatformZoneLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            z.zone_id,
            z.station_id,
            z.zone_type,
            z.linked_lane,
            z.zone_status,
            z.note,
            z.deleted_at,
            z.created_at,
            z.updated_at,
            s.station_name
          FROM zones z
          LEFT JOIN stations s ON s.station_id = z.station_id
          WHERE z.zone_id = ?
          LIMIT 1
        `,
      )
      .bind(normalizedZoneId)
      .first(),
  ]);

  if (!row) {
    return null;
  }

  return {
    zone: mapPlatformZoneRow(
      row as PlatformZoneRow,
      labelMaps.typeLabelMap,
      labelMaps.statusLabelMap,
    ),
  };
}

async function loadPlatformZoneRowsByStation(
  db: any,
  stationId: string,
  includeArchived = false,
) {
  const normalizedStationId = normalizeStationCode(stationId);
  const [labelMaps, rows] = await Promise.all([
    loadPlatformZoneLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            z.zone_id,
            z.station_id,
            z.zone_type,
            z.linked_lane,
            z.zone_status,
            z.note,
            z.deleted_at,
            z.created_at,
            z.updated_at,
            s.station_name
          FROM zones z
          LEFT JOIN stations s ON s.station_id = z.station_id
          WHERE z.station_id = ?
            AND (? = 1 OR z.deleted_at IS NULL)
          ORDER BY z.created_at ASC, z.zone_id ASC
        `,
      )
      .bind(normalizedStationId, includeArchived ? 1 : 0)
      .all(),
  ]);

  return (
    ((rows as { results?: PlatformZoneRow[] }).results ||
      []) as PlatformZoneRow[]
  ).map((row) =>
    mapPlatformZoneRow(row, labelMaps.typeLabelMap, labelMaps.statusLabelMap),
  );
}

async function writePlatformZoneAudit(
  c: any,
  params: {
    action: "ZONE_CREATED" | "ZONE_UPDATED" | "ZONE_ARCHIVED" | "ZONE_RESTORED";
    zoneId: string;
    stationId: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actor.userId,
      actor.roleIds[0] || "platform_admin",
      actor.clientSource,
      params.action,
      "Zone",
      params.zoneId,
      params.stationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

type PlatformDeviceRow = {
  device_id: string;
  station_id: string;
  device_type: string;
  binding_role: string;
  owner_team_id: string;
  device_status: string;
  note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  station_name: string | null;
  owner_team_name: string | null;
};

function mapPlatformDeviceRow(
  row: PlatformDeviceRow,
  typeLabelMap: Map<string, string>,
  roleLabelMap: Map<string, string>,
  statusLabelMap: Map<string, string>,
) {
  const typeLabel = typeLabelMap.get(row.device_type) || row.device_type;
  const roleLabel = roleLabelMap.get(row.binding_role) || row.binding_role;
  const statusLabel = row.deleted_at
    ? "已归档"
    : statusLabelMap.get(row.device_status) || row.device_status;
  const ownerLabel = row.owner_team_name || row.owner_team_id || "--";

  return {
    device_id: row.device_id,
    code: row.device_id,
    device: row.device_id,
    station_id: row.station_id,
    station_code: row.station_id,
    station: row.station_id,
    station_name: row.station_name || row.station_id,
    device_type: row.device_type,
    type: typeLabel,
    binding_role: row.binding_role,
    role: roleLabel,
    owner_team_id: row.owner_team_id,
    owner_team_name: row.owner_team_name || row.owner_team_id,
    owner: ownerLabel,
    device_status: row.device_status,
    status: statusLabel,
    note: row.note || "",
    archived: Boolean(row.deleted_at),
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPlatformDeviceTypeOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM device_type_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformDeviceRoleOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM device_role_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformDeviceStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM device_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformDeviceOwnerOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT t.team_id, t.team_name, t.station_id, t.deleted_at, s.station_name
        FROM teams t
        LEFT JOIN stations s ON s.station_id = t.station_id
        ORDER BY t.station_id ASC, t.team_name ASC, t.team_id ASC
      `,
    )
    .all()) as {
    results?: Array<{
      team_id: string;
      team_name: string;
      station_id: string;
      deleted_at: string | null;
      station_name: string | null;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.team_id,
    label: `${row.team_id} · ${row.team_name}`,
    disabled: Boolean(row.deleted_at),
    meta: {
      station_id: row.station_id,
      station_name: row.station_name || row.station_id,
      archived: Boolean(row.deleted_at),
    },
  }));
}

async function loadPlatformDeviceOptions(db: any) {
  const [stationOptions, types, roles, statuses, teams] = await Promise.all([
    loadPlatformStationOptions(db),
    loadPlatformDeviceTypeOptions(db),
    loadPlatformDeviceRoleOptions(db),
    loadPlatformDeviceStatusOptions(db),
    loadPlatformDeviceOwnerOptions(db),
  ]);

  return {
    stations: stationOptions.stations,
    types,
    roles,
    statuses,
    teams,
  };
}

async function loadPlatformDeviceLabelMaps(db: any) {
  const { types, roles, statuses } = await loadPlatformDeviceOptions(db);

  return {
    typeLabelMap: new Map(
      types.map((item) => [item.value, item.label] as const),
    ),
    roleLabelMap: new Map(
      roles.map((item) => [item.value, item.label] as const),
    ),
    statusLabelMap: new Map(
      statuses.map((item) => [item.value, item.label] as const),
    ),
  };
}

async function listPlatformDevicesFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const includeArchived = parseIncludeArchived(query);
  const keyword = normalizeNullableText(query.keyword);
  const stationId = normalizeStationCode(query.station_id);
  const type = normalizeNullableText(query.type);
  const role = normalizeNullableText(query.role);
  const status = normalizeNullableText(query.status);
  const ownerTeamId = normalizeNullableText(query.owner_team_id);
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (!includeArchived) {
    clauses.push("d.deleted_at IS NULL");
  }

  if (keyword) {
    clauses.push(
      `(d.device_id LIKE ? OR d.station_id LIKE ? OR COALESCE(s.station_name, '') LIKE ? OR COALESCE(d.device_type, '') LIKE ? OR COALESCE(d.binding_role, '') LIKE ? OR COALESCE(t.team_name, '') LIKE ? OR COALESCE(d.note, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (stationId) {
    clauses.push("d.station_id = ?");
    params.push(stationId);
  }

  if (type) {
    clauses.push("d.device_type = ?");
    params.push(type);
  }

  if (role) {
    clauses.push("d.binding_role = ?");
    params.push(role);
  }

  if (status) {
    clauses.push("d.device_status = ?");
    params.push(status);
  }

  if (ownerTeamId) {
    clauses.push("d.owner_team_id = ?");
    params.push(ownerTeamId);
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM platform_devices d
    LEFT JOIN stations s ON s.station_id = d.station_id
    LEFT JOIN teams t ON t.team_id = d.owner_team_id
    WHERE ${whereClause}
  `;

  const [{ typeLabelMap, roleLabelMap, statusLabelMap }, totalRow, rows] =
    await Promise.all([
      loadPlatformDeviceLabelMaps(db),
      db
        .prepare(`SELECT COUNT(*) AS total ${baseSql}`)
        .bind(...params)
        .first(),
      db
        .prepare(
          `
          SELECT
            d.device_id,
            d.station_id,
            d.device_type,
            d.binding_role,
            d.owner_team_id,
            d.device_status,
            d.note,
            d.deleted_at,
            d.created_at,
            d.updated_at,
            s.station_name,
            t.team_name AS owner_team_name
          ${baseSql}
          ORDER BY d.created_at ASC, d.device_id ASC
          LIMIT ? OFFSET ?
        `,
        )
        .bind(...params, pageSize, offset)
        .all(),
    ]);

  return {
    items: (
      ((rows as { results?: PlatformDeviceRow[] }).results ||
        []) as PlatformDeviceRow[]
    ).map((row) =>
      mapPlatformDeviceRow(row, typeLabelMap, roleLabelMap, statusLabelMap),
    ),
    page,
    page_size: pageSize,
    total: Number((totalRow as { total?: number } | null)?.total || 0),
  };
}

async function loadPlatformDeviceDetailFromDb(db: any, deviceId: string) {
  const normalizedDeviceId = normalizeRequiredText(deviceId).toUpperCase();
  const [labelMaps, row] = await Promise.all([
    loadPlatformDeviceLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            d.device_id,
            d.station_id,
            d.device_type,
            d.binding_role,
            d.owner_team_id,
            d.device_status,
            d.note,
            d.deleted_at,
            d.created_at,
            d.updated_at,
            s.station_name,
            t.team_name AS owner_team_name
          FROM platform_devices d
          LEFT JOIN stations s ON s.station_id = d.station_id
          LEFT JOIN teams t ON t.team_id = d.owner_team_id
          WHERE UPPER(d.device_id) = ?
          LIMIT 1
        `,
      )
      .bind(normalizedDeviceId)
      .first(),
  ]);

  if (!row) {
    return null;
  }

  return {
    device: mapPlatformDeviceRow(
      row as PlatformDeviceRow,
      labelMaps.typeLabelMap,
      labelMaps.roleLabelMap,
      labelMaps.statusLabelMap,
    ),
  };
}

async function loadPlatformDeviceRowsByStation(
  db: any,
  stationId: string,
  includeArchived = false,
) {
  const normalizedStationId = normalizeStationCode(stationId);
  const [labelMaps, rows] = await Promise.all([
    loadPlatformDeviceLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            d.device_id,
            d.station_id,
            d.device_type,
            d.binding_role,
            d.owner_team_id,
            d.device_status,
            d.note,
            d.deleted_at,
            d.created_at,
            d.updated_at,
            s.station_name,
            t.team_name AS owner_team_name
          FROM platform_devices d
          LEFT JOIN stations s ON s.station_id = d.station_id
          LEFT JOIN teams t ON t.team_id = d.owner_team_id
          WHERE d.station_id = ?
            AND (? = 1 OR d.deleted_at IS NULL)
          ORDER BY d.created_at ASC, d.device_id ASC
        `,
      )
      .bind(normalizedStationId, includeArchived ? 1 : 0)
      .all(),
  ]);

  return (
    ((rows as { results?: PlatformDeviceRow[] }).results ||
      []) as PlatformDeviceRow[]
  ).map((row) =>
    mapPlatformDeviceRow(
      row,
      labelMaps.typeLabelMap,
      labelMaps.roleLabelMap,
      labelMaps.statusLabelMap,
    ),
  );
}

async function writePlatformDeviceAudit(
  c: any,
  params: {
    action:
      | "DEVICE_CREATED"
      | "DEVICE_UPDATED"
      | "DEVICE_ARCHIVED"
      | "DEVICE_RESTORED";
    deviceId: string;
    stationId: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actor.userId,
      actor.roleIds[0] || "platform_admin",
      actor.clientSource,
      params.action,
      "Device",
      params.deviceId,
      params.stationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

type PlatformNetworkLaneRow = {
  lane_id: string;
  lane_name: string;
  business_mode: string | null;
  origin_station_id: string;
  via_station_id: string | null;
  destination_station_id: string;
  node_order: string;
  key_events: string | null;
  sla_text: string;
  control_depth: string;
  lane_status: string;
  note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  origin_station_name: string | null;
  via_station_name: string | null;
  destination_station_name: string | null;
};

function buildNetworkLaneStationPath(
  row: Pick<
    PlatformNetworkLaneRow,
    "origin_station_id" | "via_station_id" | "destination_station_id"
  >,
) {
  return [row.origin_station_id, row.via_station_id, row.destination_station_id]
    .filter(Boolean)
    .join(" / ");
}

function mapPlatformNetworkLaneRow(
  row: PlatformNetworkLaneRow,
  controlDepthLabelMap: Map<string, string>,
  statusLabelMap: Map<string, string>,
) {
  const stationPath = buildNetworkLaneStationPath(row);
  const controlDepthLabel =
    controlDepthLabelMap.get(row.control_depth) || row.control_depth;
  const statusLabel = row.deleted_at
    ? "已归档"
    : statusLabelMap.get(row.lane_status) || row.lane_status;

  return {
    lane_id: row.lane_id,
    code: row.lane_id,
    laneCode: row.lane_id,
    lane_name: row.lane_name,
    lane: row.lane_name,
    business_mode: row.business_mode || "",
    pattern: row.business_mode || controlDepthLabel,
    origin_station_id: row.origin_station_id,
    origin_station_name: row.origin_station_name || row.origin_station_id,
    via_station_id: row.via_station_id || "",
    via_station_name: row.via_station_name || row.via_station_id || "",
    destination_station_id: row.destination_station_id,
    destination_station_name:
      row.destination_station_name || row.destination_station_id,
    station_path: stationPath,
    stations: stationPath,
    node_order: row.node_order,
    nodeOrder: row.node_order,
    key_events: row.key_events || "",
    events: row.key_events || "--",
    sla_text: row.sla_text,
    sla: row.sla_text,
    promise: row.sla_text,
    control_depth: row.control_depth,
    controlDepth: controlDepthLabel,
    lane_status: row.lane_status,
    laneStatus: row.lane_status,
    status: statusLabel,
    sample_station: stationPath,
    sampleStation: stationPath,
    note: row.note || "",
    archived: Boolean(row.deleted_at),
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPlatformNetworkLaneControlDepthOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM network_lane_control_depth_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformNetworkLaneStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM network_lane_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformNetworkLaneOptions(db: any) {
  const [stationOptions, controlDepths, statuses] = await Promise.all([
    loadPlatformStationOptions(db),
    loadPlatformNetworkLaneControlDepthOptions(db),
    loadPlatformNetworkLaneStatusOptions(db),
  ]);

  return {
    stations: stationOptions.stations,
    controlDepths,
    statuses,
  };
}

async function loadPlatformNetworkLaneLabelMaps(db: any) {
  const { controlDepths, statuses } = await loadPlatformNetworkLaneOptions(db);

  return {
    controlDepthLabelMap: new Map(
      controlDepths.map((item) => [item.value, item.label] as const),
    ),
    statusLabelMap: new Map(
      statuses.map((item) => [item.value, item.label] as const),
    ),
  };
}

async function listPlatformNetworkLanesFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const includeArchived = parseIncludeArchived(query);
  const keyword = normalizeNullableText(query.keyword);
  const stationId = normalizeStationCode(query.station_id || query.station);
  const controlDepth = normalizeNullableText(
    query.control_depth || query.controlDepth,
  );
  const laneStatus = normalizeNullableText(
    query.status || query.lane_status || query.laneStatus,
  );
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (!includeArchived) {
    clauses.push("nl.deleted_at IS NULL");
  }

  if (keyword) {
    clauses.push(
      `(nl.lane_id LIKE ? OR nl.lane_name LIKE ? OR COALESCE(nl.business_mode, '') LIKE ? OR COALESCE(nl.node_order, '') LIKE ? OR COALESCE(nl.key_events, '') LIKE ? OR COALESCE(nl.sla_text, '') LIKE ? OR COALESCE(nl.note, '') LIKE ? OR nl.origin_station_id LIKE ? OR COALESCE(nl.via_station_id, '') LIKE ? OR nl.destination_station_id LIKE ? OR COALESCE(origin.station_name, '') LIKE ? OR COALESCE(via.station_name, '') LIKE ? OR COALESCE(destination.station_name, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (stationId) {
    clauses.push(
      "(nl.origin_station_id = ? OR nl.destination_station_id = ? OR COALESCE(nl.via_station_id, '') = ?)",
    );
    params.push(stationId, stationId, stationId);
  }

  if (controlDepth) {
    clauses.push("nl.control_depth = ?");
    params.push(controlDepth);
  }

  if (laneStatus) {
    clauses.push("nl.lane_status = ?");
    params.push(laneStatus);
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM network_lanes nl
    LEFT JOIN stations origin ON origin.station_id = nl.origin_station_id
    LEFT JOIN stations via ON via.station_id = nl.via_station_id
    LEFT JOIN stations destination ON destination.station_id = nl.destination_station_id
    WHERE ${whereClause}
  `;

  const [{ controlDepthLabelMap, statusLabelMap }, totalRow, rows] =
    await Promise.all([
      loadPlatformNetworkLaneLabelMaps(db),
      db
        .prepare(`SELECT COUNT(*) AS total ${baseSql}`)
        .bind(...params)
        .first(),
      db
        .prepare(
          `
          SELECT
            nl.lane_id,
            nl.lane_name,
            nl.business_mode,
            nl.origin_station_id,
            nl.via_station_id,
            nl.destination_station_id,
            nl.node_order,
            nl.key_events,
            nl.sla_text,
            nl.control_depth,
            nl.lane_status,
            nl.note,
            nl.deleted_at,
            nl.created_at,
            nl.updated_at,
            origin.station_name AS origin_station_name,
            via.station_name AS via_station_name,
            destination.station_name AS destination_station_name
          ${baseSql}
          ORDER BY nl.created_at ASC, nl.lane_id ASC
          LIMIT ? OFFSET ?
        `,
        )
        .bind(...params, pageSize, offset)
        .all(),
    ]);

  return {
    items: (
      ((rows as { results?: PlatformNetworkLaneRow[] }).results ||
        []) as PlatformNetworkLaneRow[]
    ).map((row) =>
      mapPlatformNetworkLaneRow(row, controlDepthLabelMap, statusLabelMap),
    ),
    page,
    page_size: pageSize,
    total: Number((totalRow as { total?: number } | null)?.total || 0),
  };
}

async function loadPlatformNetworkLaneDetailFromDb(db: any, laneId: string) {
  const normalizedLaneId = normalizeRequiredText(laneId).toUpperCase();
  const [labelMaps, row] = await Promise.all([
    loadPlatformNetworkLaneLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            nl.lane_id,
            nl.lane_name,
            nl.business_mode,
            nl.origin_station_id,
            nl.via_station_id,
            nl.destination_station_id,
            nl.node_order,
            nl.key_events,
            nl.sla_text,
            nl.control_depth,
            nl.lane_status,
            nl.note,
            nl.deleted_at,
            nl.created_at,
            nl.updated_at,
            origin.station_name AS origin_station_name,
            via.station_name AS via_station_name,
            destination.station_name AS destination_station_name
          FROM network_lanes nl
          LEFT JOIN stations origin ON origin.station_id = nl.origin_station_id
          LEFT JOIN stations via ON via.station_id = nl.via_station_id
          LEFT JOIN stations destination ON destination.station_id = nl.destination_station_id
          WHERE nl.lane_id = ?
          LIMIT 1
        `,
      )
      .bind(normalizedLaneId)
      .first(),
  ]);

  if (!row) {
    return null;
  }

  return {
    lane: mapPlatformNetworkLaneRow(
      row as PlatformNetworkLaneRow,
      labelMaps.controlDepthLabelMap,
      labelMaps.statusLabelMap,
    ),
  };
}

async function listPlatformNetworkLaneRowsForSummary(db: any) {
  const [labelMaps, rows] = await Promise.all([
    loadPlatformNetworkLaneLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            nl.lane_id,
            nl.lane_name,
            nl.business_mode,
            nl.origin_station_id,
            nl.via_station_id,
            nl.destination_station_id,
            nl.node_order,
            nl.key_events,
            nl.sla_text,
            nl.control_depth,
            nl.lane_status,
            nl.note,
            nl.deleted_at,
            nl.created_at,
            nl.updated_at,
            origin.station_name AS origin_station_name,
            via.station_name AS via_station_name,
            destination.station_name AS destination_station_name
          FROM network_lanes nl
          LEFT JOIN stations origin ON origin.station_id = nl.origin_station_id
          LEFT JOIN stations via ON via.station_id = nl.via_station_id
          LEFT JOIN stations destination ON destination.station_id = nl.destination_station_id
          WHERE nl.deleted_at IS NULL
          ORDER BY nl.created_at ASC, nl.lane_id ASC
        `,
      )
      .all(),
  ]);

  return (
    ((rows as { results?: PlatformNetworkLaneRow[] }).results ||
      []) as PlatformNetworkLaneRow[]
  ).map((row) =>
    mapPlatformNetworkLaneRow(
      row,
      labelMaps.controlDepthLabelMap,
      labelMaps.statusLabelMap,
    ),
  );
}

async function writePlatformNetworkLaneAudit(
  c: any,
  params: {
    action: "LANE_CREATED" | "LANE_UPDATED" | "LANE_ARCHIVED" | "LANE_RESTORED";
    laneId: string;
    stationId: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actor.userId,
      actor.roleIds[0] || "platform_admin",
      actor.clientSource,
      params.action,
      "NetworkLane",
      params.laneId,
      params.stationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

type PlatformNetworkScenarioRow = {
  scenario_id: string;
  scenario_title: string;
  scenario_category: string;
  lane_id: string;
  primary_station_id: string;
  node_sequence: string;
  entry_rule_summary: string;
  evidence_requirements: string;
  scenario_status: string;
  note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  lane_name: string | null;
  origin_station_id: string | null;
  via_station_id: string | null;
  destination_station_id: string | null;
  primary_station_name: string | null;
};

function buildNetworkScenarioLanePath(
  row: Pick<
    PlatformNetworkScenarioRow,
    "origin_station_id" | "via_station_id" | "destination_station_id"
  >,
) {
  return [row.origin_station_id, row.via_station_id, row.destination_station_id]
    .filter(Boolean)
    .join(" / ");
}

function mapPlatformNetworkScenarioRow(
  row: PlatformNetworkScenarioRow,
  categoryLabelMap: Map<string, string>,
  statusLabelMap: Map<string, string>,
) {
  const categoryLabel =
    categoryLabelMap.get(row.scenario_category) || row.scenario_category;
  const statusLabel = row.deleted_at
    ? "已归档"
    : statusLabelMap.get(row.scenario_status) || row.scenario_status;
  const lanePath = buildNetworkScenarioLanePath(row);
  const laneLabel = row.lane_name || lanePath || row.lane_id;

  return {
    scenario_id: row.scenario_id,
    id: row.scenario_id,
    scenario_title: row.scenario_title,
    title: row.scenario_title,
    scenario_category: row.scenario_category,
    category_key: row.scenario_category,
    category: categoryLabel,
    lane_id: row.lane_id,
    lane_code: row.lane_id,
    lane: laneLabel,
    lane_name: row.lane_name || row.lane_id,
    lane_path: lanePath,
    primary_station_id: row.primary_station_id,
    primary_station_name: row.primary_station_name || row.primary_station_id,
    node_sequence: row.node_sequence,
    nodes: row.node_sequence,
    entry_rule_summary: row.entry_rule_summary,
    entryRule: row.entry_rule_summary,
    evidence_requirements: row.evidence_requirements,
    evidence: row.evidence_requirements,
    scenario_status: row.scenario_status,
    scenarioStatus: row.scenario_status,
    status: statusLabel,
    note: row.note || "",
    archived: Boolean(row.deleted_at),
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPlatformNetworkScenarioCategoryOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM network_scenario_category_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformNetworkScenarioStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM network_scenario_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformNetworkScenarioLaneOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT
          lane_id,
          lane_name,
          origin_station_id,
          via_station_id,
          destination_station_id,
          deleted_at
        FROM network_lanes
        ORDER BY lane_id ASC
      `,
    )
    .all()) as {
    results?: Array<{
      lane_id: string;
      lane_name: string | null;
      origin_station_id: string;
      via_station_id: string | null;
      destination_station_id: string;
      deleted_at: string | null;
    }>;
  };

  return (rows.results || []).map((row) => {
    const stationPath = [
      row.origin_station_id,
      row.via_station_id,
      row.destination_station_id,
    ]
      .filter(Boolean)
      .join(" / ");

    return {
      value: row.lane_id,
      label: `${row.lane_id} · ${row.lane_name || stationPath || row.lane_id}`,
      disabled: Boolean(row.deleted_at),
      meta: {
        archived: Boolean(row.deleted_at),
        lane_name: row.lane_name || row.lane_id,
        station_path: stationPath,
      },
    } satisfies PlatformSelectOption;
  });
}

async function loadPlatformNetworkScenarioOptions(db: any) {
  const [stationOptions, lanes, categories, statuses] = await Promise.all([
    loadPlatformStationOptions(db),
    loadPlatformNetworkScenarioLaneOptions(db),
    loadPlatformNetworkScenarioCategoryOptions(db),
    loadPlatformNetworkScenarioStatusOptions(db),
  ]);

  return {
    stations: stationOptions.stations,
    lanes,
    categories,
    statuses,
  };
}

async function loadPlatformNetworkScenarioLabelMaps(db: any) {
  const { categories, statuses } = await loadPlatformNetworkScenarioOptions(db);

  return {
    categoryLabelMap: new Map(
      categories.map((item) => [item.value, item.label] as const),
    ),
    statusLabelMap: new Map(
      statuses.map((item) => [item.value, item.label] as const),
    ),
  };
}

async function findPlatformNetworkLaneScope(db: any, laneId: string) {
  const normalizedLaneId = normalizeRequiredText(laneId).toUpperCase();

  return (await db
    .prepare(
      `
        SELECT
          lane_id,
          origin_station_id,
          via_station_id,
          destination_station_id,
          deleted_at
        FROM network_lanes
        WHERE UPPER(lane_id) = ?
        LIMIT 1
      `,
    )
    .bind(normalizedLaneId)
    .first()) as {
    lane_id: string;
    origin_station_id: string;
    via_station_id: string | null;
    destination_station_id: string;
    deleted_at: string | null;
  } | null;
}

function laneIncludesStation(
  lane:
    | {
        origin_station_id: string;
        via_station_id: string | null;
        destination_station_id: string;
      }
    | null,
  stationId: string,
) {
  if (!lane) {
    return false;
  }

  return [
    lane.origin_station_id,
    lane.via_station_id,
    lane.destination_station_id,
  ]
    .filter(Boolean)
    .includes(stationId);
}

async function listPlatformNetworkScenariosFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const includeArchived = parseIncludeArchived(query);
  const keyword = normalizeNullableText(query.keyword);
  const stationId = normalizeStationCode(query.station_id || query.station);
  const laneId = normalizeRequiredText(query.lane_id || query.lane).toUpperCase();
  const category = normalizeNullableText(
    query.category || query.scenario_category || query.scenarioCategory,
  );
  const scenarioStatus = normalizeNullableText(
    query.status || query.scenario_status || query.scenarioStatus,
  );
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (!includeArchived) {
    clauses.push("ns.deleted_at IS NULL");
  }

  if (keyword) {
    clauses.push(
      `(ns.scenario_id LIKE ? OR ns.scenario_title LIKE ? OR COALESCE(ns.node_sequence, '') LIKE ? OR COALESCE(ns.entry_rule_summary, '') LIKE ? OR COALESCE(ns.evidence_requirements, '') LIKE ? OR COALESCE(ns.note, '') LIKE ? OR ns.primary_station_id LIKE ? OR ns.lane_id LIKE ? OR COALESCE(nl.lane_name, '') LIKE ? OR COALESCE(primary_station.station_name, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (stationId) {
    clauses.push("ns.primary_station_id = ?");
    params.push(stationId);
  }

  if (laneId) {
    clauses.push("ns.lane_id = ?");
    params.push(laneId);
  }

  if (category) {
    clauses.push("ns.scenario_category = ?");
    params.push(category);
  }

  if (scenarioStatus) {
    clauses.push("ns.scenario_status = ?");
    params.push(scenarioStatus);
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM network_scenarios ns
    LEFT JOIN network_lanes nl ON nl.lane_id = ns.lane_id
    LEFT JOIN stations primary_station ON primary_station.station_id = ns.primary_station_id
    WHERE ${whereClause}
  `;

  const [{ categoryLabelMap, statusLabelMap }, totalRow, rows] =
    await Promise.all([
      loadPlatformNetworkScenarioLabelMaps(db),
      db
        .prepare(`SELECT COUNT(*) AS total ${baseSql}`)
        .bind(...params)
        .first(),
      db
        .prepare(
          `
            SELECT
              ns.scenario_id,
              ns.scenario_title,
              ns.scenario_category,
              ns.lane_id,
              ns.primary_station_id,
              ns.node_sequence,
              ns.entry_rule_summary,
              ns.evidence_requirements,
              ns.scenario_status,
              ns.note,
              ns.deleted_at,
              ns.created_at,
              ns.updated_at,
              nl.lane_name,
              nl.origin_station_id,
              nl.via_station_id,
              nl.destination_station_id,
              primary_station.station_name AS primary_station_name
            ${baseSql}
            ORDER BY ns.created_at ASC, ns.scenario_id ASC
            LIMIT ? OFFSET ?
          `,
        )
        .bind(...params, pageSize, offset)
        .all(),
    ]);

  return {
    items: (
      ((rows as { results?: PlatformNetworkScenarioRow[] }).results ||
        []) as PlatformNetworkScenarioRow[]
    ).map((row) =>
      mapPlatformNetworkScenarioRow(
        row,
        categoryLabelMap,
        statusLabelMap,
      ),
    ),
    page,
    page_size: pageSize,
    total: Number((totalRow as { total?: number } | null)?.total || 0),
  };
}

async function loadPlatformNetworkScenarioDetailFromDb(
  db: any,
  scenarioId: string,
) {
  const normalizedScenarioId = normalizeRequiredText(scenarioId).toUpperCase();
  const [labelMaps, row] = await Promise.all([
    loadPlatformNetworkScenarioLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            ns.scenario_id,
            ns.scenario_title,
            ns.scenario_category,
            ns.lane_id,
            ns.primary_station_id,
            ns.node_sequence,
            ns.entry_rule_summary,
            ns.evidence_requirements,
            ns.scenario_status,
            ns.note,
            ns.deleted_at,
            ns.created_at,
            ns.updated_at,
            nl.lane_name,
            nl.origin_station_id,
            nl.via_station_id,
            nl.destination_station_id,
            primary_station.station_name AS primary_station_name
          FROM network_scenarios ns
          LEFT JOIN network_lanes nl ON nl.lane_id = ns.lane_id
          LEFT JOIN stations primary_station ON primary_station.station_id = ns.primary_station_id
          WHERE ns.scenario_id = ?
          LIMIT 1
        `,
      )
      .bind(normalizedScenarioId)
      .first(),
  ]);

  if (!row) {
    return null;
  }

  return {
    scenario: mapPlatformNetworkScenarioRow(
      row as PlatformNetworkScenarioRow,
      labelMaps.categoryLabelMap,
      labelMaps.statusLabelMap,
    ),
  };
}

async function listPlatformNetworkScenarioRowsForSummary(db: any) {
  const [labelMaps, rows] = await Promise.all([
    loadPlatformNetworkScenarioLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            ns.scenario_id,
            ns.scenario_title,
            ns.scenario_category,
            ns.lane_id,
            ns.primary_station_id,
            ns.node_sequence,
            ns.entry_rule_summary,
            ns.evidence_requirements,
            ns.scenario_status,
            ns.note,
            ns.deleted_at,
            ns.created_at,
            ns.updated_at,
            nl.lane_name,
            nl.origin_station_id,
            nl.via_station_id,
            nl.destination_station_id,
            primary_station.station_name AS primary_station_name
          FROM network_scenarios ns
          LEFT JOIN network_lanes nl ON nl.lane_id = ns.lane_id
          LEFT JOIN stations primary_station ON primary_station.station_id = ns.primary_station_id
          WHERE ns.deleted_at IS NULL
          ORDER BY ns.created_at ASC, ns.scenario_id ASC
        `,
      )
      .all(),
  ]);

  return (
    ((rows as { results?: PlatformNetworkScenarioRow[] }).results ||
      []) as PlatformNetworkScenarioRow[]
  ).map((row) =>
    mapPlatformNetworkScenarioRow(
      row,
      labelMaps.categoryLabelMap,
      labelMaps.statusLabelMap,
    ),
  );
}

async function writePlatformNetworkScenarioAudit(
  c: any,
  params: {
    action:
      | "SCENARIO_CREATED"
      | "SCENARIO_UPDATED"
      | "SCENARIO_ARCHIVED"
      | "SCENARIO_RESTORED";
    scenarioId: string;
    stationId: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actor.userId,
      actor.roleIds[0] || "platform_admin",
      actor.clientSource,
      params.action,
      "NetworkScenario",
      params.scenarioId,
      params.stationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

type PlatformRuleRow = {
  rule_id: string;
  rule_name: string;
  rule_type: string;
  control_level: string;
  applicability_scope: string;
  related_station_id: string | null;
  related_lane_id: string | null;
  related_scenario_id: string | null;
  service_level: string | null;
  timeline_stage: string;
  rule_status: string;
  summary: string;
  trigger_condition: string | null;
  trigger_node: string | null;
  action_target: string | null;
  blocker_action: string | null;
  recovery_action: string | null;
  evidence_requirements: string | null;
  owner_role: string | null;
  note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  related_station_name: string | null;
  related_lane_name: string | null;
  related_lane_origin: string | null;
  related_lane_via: string | null;
  related_lane_destination: string | null;
  related_scenario_title: string | null;
};

type PlatformRuleOptions = Awaited<ReturnType<typeof loadPlatformRuleOptions>>;

function buildPlatformRuleLanePath(
  row: Pick<
    PlatformRuleRow,
    "related_lane_origin" | "related_lane_via" | "related_lane_destination"
  >,
) {
  return [
    row.related_lane_origin,
    row.related_lane_via,
    row.related_lane_destination,
  ]
    .filter(Boolean)
    .join(" / ");
}

function buildPlatformRuleTargetLabel(row: PlatformRuleRow) {
  if (row.applicability_scope === "scenario" && row.related_scenario_id) {
    return row.related_scenario_title
      ? `${row.related_scenario_id} · ${row.related_scenario_title}`
      : row.related_scenario_id;
  }

  if (row.applicability_scope === "lane" && row.related_lane_id) {
    const lanePath = buildPlatformRuleLanePath(row);
    return row.related_lane_name
      ? `${row.related_lane_id} · ${row.related_lane_name}`
      : lanePath || row.related_lane_id;
  }

  if (row.applicability_scope === "station" && row.related_station_id) {
    return row.related_station_name
      ? `${row.related_station_id} · ${row.related_station_name}`
      : row.related_station_id;
  }

  return "平台全局";
}

function mapPlatformRuleRow(
  row: PlatformRuleRow,
  labelMaps: {
    typeLabelMap: Map<string, string>;
    controlLevelLabelMap: Map<string, string>;
    statusLabelMap: Map<string, string>;
    scopeLabelMap: Map<string, string>;
    serviceLevelLabelMap: Map<string, string>;
    timelineStageLabelMap: Map<string, string>;
  },
) {
  const lanePath = buildPlatformRuleLanePath(row);
  const statusLabel = row.deleted_at
    ? "已归档"
    : labelMaps.statusLabelMap.get(row.rule_status) || row.rule_status;

  return {
    rule_id: row.rule_id,
    id: row.rule_id,
    code: row.rule_id,
    rule_name: row.rule_name,
    name: row.rule_name,
    rule_type: row.rule_type,
    type_key: row.rule_type,
    type: labelMaps.typeLabelMap.get(row.rule_type) || row.rule_type,
    control_level: row.control_level,
    control: labelMaps.controlLevelLabelMap.get(row.control_level) ||
      row.control_level,
    applicability_scope: row.applicability_scope,
    scope_key: row.applicability_scope,
    scope: labelMaps.scopeLabelMap.get(row.applicability_scope) ||
      row.applicability_scope,
    related_station_id: row.related_station_id,
    related_station_name: row.related_station_name || row.related_station_id,
    related_lane_id: row.related_lane_id,
    related_lane_name: row.related_lane_name || row.related_lane_id,
    related_lane_path: lanePath,
    related_scenario_id: row.related_scenario_id,
    related_scenario_title:
      row.related_scenario_title || row.related_scenario_id,
    target: buildPlatformRuleTargetLabel(row),
    service_level: row.service_level,
    serviceLevel:
      row.service_level
        ? labelMaps.serviceLevelLabelMap.get(row.service_level) ||
          row.service_level
        : "--",
    timeline_stage: row.timeline_stage,
    timeline: labelMaps.timelineStageLabelMap.get(row.timeline_stage) ||
      row.timeline_stage,
    rule_status: row.rule_status,
    ruleStatus: row.rule_status,
    status: statusLabel,
    summary: row.summary,
    trigger_condition: row.trigger_condition || "",
    triggerCondition: row.trigger_condition || "",
    trigger_node: row.trigger_node || "",
    triggerNode: row.trigger_node || "",
    action_target: row.action_target || "",
    actionTarget: row.action_target || "",
    blocker_action: row.blocker_action || "",
    blockerAction: row.blocker_action || "",
    recovery_action: row.recovery_action || "",
    recoveryAction: row.recovery_action || "",
    evidence_requirements: row.evidence_requirements || "",
    evidenceRequirements: row.evidence_requirements || "",
    owner_role: row.owner_role || "",
    ownerRole: row.owner_role || "",
    note: row.note || "",
    archived: Boolean(row.deleted_at),
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPlatformRuleTypeOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_rule_type_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformRuleControlLevelOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_rule_control_level_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformRuleStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_rule_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformRuleScopeOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_rule_scope_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformRuleServiceLevelOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_rule_service_level_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformRuleTimelineStageOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_rule_timeline_stage_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformRuleScenarioOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT
          ns.scenario_id,
          ns.scenario_title,
          ns.lane_id,
          ns.primary_station_id,
          ns.deleted_at
        FROM network_scenarios ns
        ORDER BY ns.scenario_id ASC
      `,
    )
    .all()) as {
    results?: Array<{
      scenario_id: string;
      scenario_title: string;
      lane_id: string;
      primary_station_id: string;
      deleted_at: string | null;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.scenario_id,
    label: `${row.scenario_id} · ${row.scenario_title}`,
    disabled: Boolean(row.deleted_at),
    meta: {
      lane_id: row.lane_id,
      primary_station_id: row.primary_station_id,
      archived: Boolean(row.deleted_at),
    },
  }));
}

async function loadPlatformRuleOptions(db: any) {
  const [stationOptions, lanes, scenarios, types, controlLevels, statuses, scopes, serviceLevels, timelineStages] =
    await Promise.all([
      loadPlatformStationOptions(db),
      loadPlatformNetworkScenarioLaneOptions(db),
      loadPlatformRuleScenarioOptions(db),
      loadPlatformRuleTypeOptions(db),
      loadPlatformRuleControlLevelOptions(db),
      loadPlatformRuleStatusOptions(db),
      loadPlatformRuleScopeOptions(db),
      loadPlatformRuleServiceLevelOptions(db),
      loadPlatformRuleTimelineStageOptions(db),
    ]);

  return {
    stations: stationOptions.stations,
    lanes,
    scenarios,
    types,
    controlLevels,
    statuses,
    scopes,
    serviceLevels,
    timelineStages,
  };
}

async function loadPlatformRuleLabelMaps(db: any) {
  const options = await loadPlatformRuleOptions(db);

  return {
    typeLabelMap: new Map(
      options.types.map((item) => [item.value, item.label] as const),
    ),
    controlLevelLabelMap: new Map(
      options.controlLevels.map((item) => [item.value, item.label] as const),
    ),
    statusLabelMap: new Map(
      options.statuses.map((item) => [item.value, item.label] as const),
    ),
    scopeLabelMap: new Map(
      options.scopes.map((item) => [item.value, item.label] as const),
    ),
    serviceLevelLabelMap: new Map(
      options.serviceLevels.map((item) => [item.value, item.label] as const),
    ),
    timelineStageLabelMap: new Map(
      options.timelineStages.map((item) => [item.value, item.label] as const),
    ),
  };
}

async function listPlatformRulesFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const includeArchived = parseIncludeArchived(query);
  const keyword = normalizeNullableText(query.keyword);
  const type = normalizeNullableText(query.type || query.rule_type);
  const controlLevel = normalizeNullableText(
    query.control_level || query.controlLevel,
  );
  const scope = normalizeNullableText(
    query.scope || query.applicability_scope || query.applicabilityScope,
  );
  const status = normalizeNullableText(query.status || query.rule_status);
  const stationId = normalizeStationCode(query.station_id || query.station);
  const laneId = normalizeRequiredText(query.lane_id || query.lane).toUpperCase();
  const scenarioId = normalizeRequiredText(
    query.scenario_id || query.scenario,
  ).toUpperCase();
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (!includeArchived) {
    clauses.push("pr.deleted_at IS NULL");
  }

  if (keyword) {
    clauses.push(
      `(pr.rule_id LIKE ? OR pr.rule_name LIKE ? OR pr.summary LIKE ? OR COALESCE(pr.trigger_condition, '') LIKE ? OR COALESCE(pr.trigger_node, '') LIKE ? OR COALESCE(pr.action_target, '') LIKE ? OR COALESCE(pr.blocker_action, '') LIKE ? OR COALESCE(pr.evidence_requirements, '') LIKE ? OR COALESCE(st.station_name, '') LIKE ? OR COALESCE(nl.lane_name, '') LIKE ? OR COALESCE(ns.scenario_title, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (type) {
    clauses.push("pr.rule_type = ?");
    params.push(type);
  }

  if (controlLevel) {
    clauses.push("pr.control_level = ?");
    params.push(controlLevel);
  }

  if (scope) {
    clauses.push("pr.applicability_scope = ?");
    params.push(scope);
  }

  if (status) {
    clauses.push("pr.rule_status = ?");
    params.push(status);
  }

  if (stationId) {
    clauses.push("pr.related_station_id = ?");
    params.push(stationId);
  }

  if (laneId) {
    clauses.push("pr.related_lane_id = ?");
    params.push(laneId);
  }

  if (scenarioId) {
    clauses.push("pr.related_scenario_id = ?");
    params.push(scenarioId);
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM platform_rules pr
    LEFT JOIN stations st ON st.station_id = pr.related_station_id
    LEFT JOIN network_lanes nl ON nl.lane_id = pr.related_lane_id
    LEFT JOIN network_scenarios ns ON ns.scenario_id = pr.related_scenario_id
    WHERE ${whereClause}
  `;

  const [labelMaps, totalRow, rows] = await Promise.all([
    loadPlatformRuleLabelMaps(db),
    db.prepare(`SELECT COUNT(*) AS total ${baseSql}`).bind(...params).first(),
    db
      .prepare(
        `
          SELECT
            pr.rule_id,
            pr.rule_name,
            pr.rule_type,
            pr.control_level,
            pr.applicability_scope,
            pr.related_station_id,
            pr.related_lane_id,
            pr.related_scenario_id,
            pr.service_level,
            pr.timeline_stage,
            pr.rule_status,
            pr.summary,
            pr.trigger_condition,
            pr.trigger_node,
            pr.action_target,
            pr.blocker_action,
            pr.recovery_action,
            pr.evidence_requirements,
            pr.owner_role,
            pr.note,
            pr.deleted_at,
            pr.created_at,
            pr.updated_at,
            st.station_name AS related_station_name,
            nl.lane_name AS related_lane_name,
            nl.origin_station_id AS related_lane_origin,
            nl.via_station_id AS related_lane_via,
            nl.destination_station_id AS related_lane_destination,
            ns.scenario_title AS related_scenario_title
          ${baseSql}
          ORDER BY COALESCE(pr.updated_at, pr.created_at) DESC, pr.rule_id ASC
          LIMIT ? OFFSET ?
        `,
      )
      .bind(...params, pageSize, offset)
      .all(),
  ]);

  return {
    items: (
      ((rows as { results?: PlatformRuleRow[] }).results ||
        []) as PlatformRuleRow[]
    ).map((row) => mapPlatformRuleRow(row, labelMaps)),
    page,
    page_size: pageSize,
    total: Number((totalRow as { total?: number } | null)?.total || 0),
  };
}

async function loadPlatformRuleDetailFromDb(db: any, ruleId: string) {
  const normalizedRuleId = normalizeRequiredText(ruleId).toUpperCase();
  const [labelMaps, row] = await Promise.all([
    loadPlatformRuleLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            pr.rule_id,
            pr.rule_name,
            pr.rule_type,
            pr.control_level,
            pr.applicability_scope,
            pr.related_station_id,
            pr.related_lane_id,
            pr.related_scenario_id,
            pr.service_level,
            pr.timeline_stage,
            pr.rule_status,
            pr.summary,
            pr.trigger_condition,
            pr.trigger_node,
            pr.action_target,
            pr.blocker_action,
            pr.recovery_action,
            pr.evidence_requirements,
            pr.owner_role,
            pr.note,
            pr.deleted_at,
            pr.created_at,
            pr.updated_at,
            st.station_name AS related_station_name,
            nl.lane_name AS related_lane_name,
            nl.origin_station_id AS related_lane_origin,
            nl.via_station_id AS related_lane_via,
            nl.destination_station_id AS related_lane_destination,
            ns.scenario_title AS related_scenario_title
          FROM platform_rules pr
          LEFT JOIN stations st ON st.station_id = pr.related_station_id
          LEFT JOIN network_lanes nl ON nl.lane_id = pr.related_lane_id
          LEFT JOIN network_scenarios ns ON ns.scenario_id = pr.related_scenario_id
          WHERE UPPER(pr.rule_id) = ?
          LIMIT 1
        `,
      )
      .bind(normalizedRuleId)
      .first(),
  ]);

  if (!row) {
    return null;
  }

  return {
    rule: mapPlatformRuleRow(row as PlatformRuleRow, labelMaps),
  };
}

async function listPlatformRuleRowsForSummary(db: any) {
  const [labelMaps, rows] = await Promise.all([
    loadPlatformRuleLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            pr.rule_id,
            pr.rule_name,
            pr.rule_type,
            pr.control_level,
            pr.applicability_scope,
            pr.related_station_id,
            pr.related_lane_id,
            pr.related_scenario_id,
            pr.service_level,
            pr.timeline_stage,
            pr.rule_status,
            pr.summary,
            pr.trigger_condition,
            pr.trigger_node,
            pr.action_target,
            pr.blocker_action,
            pr.recovery_action,
            pr.evidence_requirements,
            pr.owner_role,
            pr.note,
            pr.deleted_at,
            pr.created_at,
            pr.updated_at,
            st.station_name AS related_station_name,
            nl.lane_name AS related_lane_name,
            nl.origin_station_id AS related_lane_origin,
            nl.via_station_id AS related_lane_via,
            nl.destination_station_id AS related_lane_destination,
            ns.scenario_title AS related_scenario_title
          FROM platform_rules pr
          LEFT JOIN stations st ON st.station_id = pr.related_station_id
          LEFT JOIN network_lanes nl ON nl.lane_id = pr.related_lane_id
          LEFT JOIN network_scenarios ns ON ns.scenario_id = pr.related_scenario_id
          WHERE pr.deleted_at IS NULL
          ORDER BY pr.timeline_stage ASC, pr.rule_id ASC
        `,
      )
      .all(),
  ]);

  return (
    ((rows as { results?: PlatformRuleRow[] }).results || []) as PlatformRuleRow[]
  ).map((row) => mapPlatformRuleRow(row, labelMaps));
}

async function loadPlatformRuleSummaryDto(db: any) {
  const [rows, options] = await Promise.all([
    listPlatformRuleRowsForSummary(db),
    loadPlatformRuleOptions(db),
  ]);

  const ruleTypeSummaryRows = options.types
    .map((option) => {
      const matched = rows.filter((item) => item.rule_type === option.value);

      if (!matched.length) {
        return null;
      }

      return {
        type_key: option.value,
        type: option.label,
        count: matched.length,
        controls: Array.from(new Set(matched.map((item) => item.control)))
          .filter(Boolean)
          .join(" / "),
      };
    })
    .filter(Boolean);

  const ruleTimelineRows = options.timelineStages
    .map((option) => {
      const matched = rows.filter((item) => item.timeline_stage === option.value);

      if (!matched.length) {
        return null;
      }

      return {
        stage_key: option.value,
        stage: option.label,
        count: matched.length,
        rules: matched
          .slice(0, 3)
          .map((item) => item.rule_name)
          .join(" / "),
      };
    })
    .filter(Boolean);

  return {
    ruleTypeSummaryRows,
    ruleTimelineRows,
  };
}

async function loadPlatformRuleAuditFallbackStationId(db: any) {
  const row = (await db
    .prepare(
      `
        SELECT station_id
        FROM stations
        WHERE deleted_at IS NULL
        ORDER BY station_id ASC
        LIMIT 1
      `,
    )
    .first()) as { station_id: string } | null;

  return normalizeStationCode(row?.station_id) || "MME";
}

async function resolvePlatformRuleScopeTargets(
  db: any,
  options: PlatformRuleOptions,
  params: {
    scope: string;
    relatedStationId?: string | null;
    relatedLaneId?: string | null;
    relatedScenarioId?: string | null;
  },
) {
  const relatedStationId = normalizeStationCode(params.relatedStationId);
  const relatedLaneId = normalizeRequiredText(params.relatedLaneId).toUpperCase();
  const relatedScenarioId = normalizeRequiredText(
    params.relatedScenarioId,
  ).toUpperCase();

  if (params.scope === "global") {
    return {
      related_station_id: null,
      related_lane_id: null,
      related_scenario_id: null,
      audit_station_id: await loadPlatformRuleAuditFallbackStationId(db),
    };
  }

  if (params.scope === "station") {
    if (!relatedStationId) {
      return {
        error: {
          message: "related_station_id is required for station scope",
          details: {
            applicability_scope: params.scope,
          },
        },
      };
    }

    if (
      !options.stations.some(
        (item) => item.value === relatedStationId && !item.disabled,
      )
    ) {
      return {
        error: {
          message: "related_station_id is invalid",
          details: {
            related_station_id: relatedStationId,
          },
        },
      };
    }

    return {
      related_station_id: relatedStationId,
      related_lane_id: null,
      related_scenario_id: null,
      audit_station_id: relatedStationId,
    };
  }

  if (params.scope === "lane") {
    if (!relatedLaneId) {
      return {
        error: {
          message: "related_lane_id is required for lane scope",
          details: {
            applicability_scope: params.scope,
          },
        },
      };
    }

    if (!options.lanes.some((item) => item.value === relatedLaneId && !item.disabled)) {
      return {
        error: {
          message: "related_lane_id is invalid",
          details: {
            related_lane_id: relatedLaneId,
          },
        },
      };
    }

    const laneScope = await findPlatformNetworkLaneScope(db, relatedLaneId);
    if (!laneScope?.lane_id || Boolean(laneScope.deleted_at)) {
      return {
        error: {
          message: "related_lane_id is invalid",
          details: {
            related_lane_id: relatedLaneId,
          },
        },
      };
    }

    return {
      related_station_id: null,
      related_lane_id: relatedLaneId,
      related_scenario_id: null,
      audit_station_id: laneScope.origin_station_id,
    };
  }

  if (params.scope === "scenario") {
    if (!relatedScenarioId) {
      return {
        error: {
          message: "related_scenario_id is required for scenario scope",
          details: {
            applicability_scope: params.scope,
          },
        },
      };
    }

    if (
      !options.scenarios.some(
        (item) => item.value === relatedScenarioId && !item.disabled,
      )
    ) {
      return {
        error: {
          message: "related_scenario_id is invalid",
          details: {
            related_scenario_id: relatedScenarioId,
          },
        },
      };
    }

    const scenarioScope = (await db
      .prepare(
        `
          SELECT scenario_id, lane_id, primary_station_id, deleted_at
          FROM network_scenarios
          WHERE UPPER(scenario_id) = ?
          LIMIT 1
        `,
      )
      .bind(relatedScenarioId)
      .first()) as {
      scenario_id: string;
      lane_id: string;
      primary_station_id: string;
      deleted_at: string | null;
    } | null;

    if (!scenarioScope?.scenario_id || Boolean(scenarioScope.deleted_at)) {
      return {
        error: {
          message: "related_scenario_id is invalid",
          details: {
            related_scenario_id: relatedScenarioId,
          },
        },
      };
    }

    return {
      related_station_id: scenarioScope.primary_station_id,
      related_lane_id: scenarioScope.lane_id,
      related_scenario_id: scenarioScope.scenario_id,
      audit_station_id: scenarioScope.primary_station_id,
    };
  }

  return {
    error: {
      message: "applicability_scope is invalid",
      details: {
        applicability_scope: params.scope,
      },
    },
  };
}

async function writePlatformRuleAudit(
  c: any,
  params: {
    action: "RULE_CREATED" | "RULE_UPDATED" | "RULE_ARCHIVED" | "RULE_RESTORED";
    ruleId: string;
    stationId?: string | null;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;
  const auditStationId =
    normalizeStationCode(params.stationId) ||
    (await loadPlatformRuleAuditFallbackStationId(c.env.DB));

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actor.userId,
      actor.roleIds[0] || "platform_admin",
      actor.clientSource,
      params.action,
      "PlatformRule",
      params.ruleId,
      auditStationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

type PlatformMasterDataRow = {
  master_data_id: string;
  object_name: string;
  object_type: string;
  source_type: string;
  governance_status: string;
  primary_key_rule: string;
  owner_name: string;
  note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type PlatformMasterDataOptions = Awaited<
  ReturnType<typeof loadPlatformMasterDataOptions>
>;

function mapPlatformMasterDataRow(
  row: PlatformMasterDataRow,
  labelMaps: {
    typeLabelMap: Map<string, string>;
    sourceLabelMap: Map<string, string>;
    statusLabelMap: Map<string, string>;
  },
) {
  const statusLabel = row.deleted_at
    ? "已归档"
    : labelMaps.statusLabelMap.get(row.governance_status) ||
      row.governance_status;

  return {
    master_data_id: row.master_data_id,
    id: row.master_data_id,
    code: row.master_data_id,
    object_name: row.object_name,
    name: row.object_name,
    object: row.object_name,
    object_type: row.object_type,
    type_key: row.object_type,
    type: labelMaps.typeLabelMap.get(row.object_type) || row.object_type,
    source_type: row.source_type,
    source_key: row.source_type,
    source: labelMaps.sourceLabelMap.get(row.source_type) || row.source_type,
    governance_status: row.governance_status,
    status_key: row.governance_status,
    status: statusLabel,
    readiness: statusLabel,
    primary_key_rule: row.primary_key_rule,
    key_rule: row.primary_key_rule,
    keyRule: row.primary_key_rule,
    owner_name: row.owner_name,
    owner: row.owner_name,
    note: row.note || "",
    archived: Boolean(row.deleted_at),
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPlatformMasterDataTypeOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_type_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataSourceOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_source_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataOptions(db: any) {
  const [types, sources, statuses] = await Promise.all([
    loadPlatformMasterDataTypeOptions(db),
    loadPlatformMasterDataSourceOptions(db),
    loadPlatformMasterDataStatusOptions(db),
  ]);

  return {
    types,
    sources,
    statuses,
  };
}

async function loadPlatformMasterDataLabelMaps(db: any) {
  const options = await loadPlatformMasterDataOptions(db);

  return {
    typeLabelMap: new Map(
      options.types.map((item) => [item.value, item.label] as const),
    ),
    sourceLabelMap: new Map(
      options.sources.map((item) => [item.value, item.label] as const),
    ),
    statusLabelMap: new Map(
      options.statuses.map((item) => [item.value, item.label] as const),
    ),
  };
}

async function listPlatformMasterDataFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const includeArchived = parseIncludeArchived(query);
  const keyword = normalizeNullableText(query.keyword);
  const type = normalizeNullableText(query.type || query.object_type);
  const source = normalizeNullableText(query.source || query.source_type);
  const status = normalizeNullableText(query.status || query.governance_status);
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (!includeArchived) {
    clauses.push("md.deleted_at IS NULL");
  }

  if (keyword) {
    clauses.push(
      `(md.master_data_id LIKE ? OR md.object_name LIKE ? OR md.primary_key_rule LIKE ? OR md.owner_name LIKE ? OR COALESCE(md.note, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (type) {
    clauses.push("md.object_type = ?");
    params.push(type);
  }

  if (source) {
    clauses.push("md.source_type = ?");
    params.push(source);
  }

  if (status) {
    clauses.push("md.governance_status = ?");
    params.push(status);
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM platform_master_data md
    WHERE ${whereClause}
  `;

  const [labelMaps, totalRow, rows] = await Promise.all([
    loadPlatformMasterDataLabelMaps(db),
    db.prepare(`SELECT COUNT(*) AS total ${baseSql}`).bind(...params).first(),
    db
      .prepare(
        `
          SELECT
            md.master_data_id,
            md.object_name,
            md.object_type,
            md.source_type,
            md.governance_status,
            md.primary_key_rule,
            md.owner_name,
            md.note,
            md.deleted_at,
            md.created_at,
            md.updated_at
          ${baseSql}
          ORDER BY COALESCE(md.updated_at, md.created_at) DESC, md.master_data_id ASC
          LIMIT ? OFFSET ?
        `,
      )
      .bind(...params, pageSize, offset)
      .all(),
  ]);

  return {
    items: (
      ((rows as { results?: PlatformMasterDataRow[] }).results ||
        []) as PlatformMasterDataRow[]
    ).map((row) => mapPlatformMasterDataRow(row, labelMaps)),
    page,
    page_size: pageSize,
    total: Number((totalRow as { total?: number } | null)?.total || 0),
  };
}

async function loadPlatformMasterDataDetailFromDb(
  db: any,
  masterDataId: string,
) {
  const normalizedMasterDataId = normalizeRequiredText(
    masterDataId,
  ).toUpperCase();
  const [labelMaps, row] = await Promise.all([
    loadPlatformMasterDataLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            master_data_id,
            object_name,
            object_type,
            source_type,
            governance_status,
            primary_key_rule,
            owner_name,
            note,
            deleted_at,
            created_at,
            updated_at
          FROM platform_master_data
          WHERE UPPER(master_data_id) = ?
          LIMIT 1
        `,
      )
      .bind(normalizedMasterDataId)
      .first(),
  ]);

  if (!row) {
    return null;
  }

  return {
    masterData: mapPlatformMasterDataRow(row as PlatformMasterDataRow, labelMaps),
  };
}

async function loadPlatformMasterDataSummaryDto(db: any) {
  const [rows, options] = await Promise.all([
    db
      .prepare(
        `
          SELECT object_type, source_type, governance_status, deleted_at
          FROM platform_master_data
          WHERE deleted_at IS NULL
        `,
      )
      .all(),
    loadPlatformMasterDataOptions(db),
  ]);

  const items =
    (((rows as {
      results?: Array<{
        object_type: string;
        source_type: string;
        governance_status: string;
        deleted_at: string | null;
      }>;
    }).results || []) as Array<{
      object_type: string;
      source_type: string;
      governance_status: string;
      deleted_at: string | null;
    }>) || [];

  return {
    masterDataTypeSummaryRows: options.types
      .map((option) => {
        const count = items.filter(
          (item) => item.object_type === option.value,
        ).length;

        if (!count) return null;

        return {
          type_key: option.value,
          type: option.label,
          count,
        };
      })
      .filter(Boolean),
    masterDataSourceSummaryRows: options.sources
      .map((option) => {
        const count = items.filter(
          (item) => item.source_type === option.value,
        ).length;

        if (!count) return null;

        return {
          source_key: option.value,
          source: option.label,
          count,
        };
      })
      .filter(Boolean),
    masterDataStatusSummaryRows: options.statuses
      .map((option) => {
        const count = items.filter(
          (item) => item.governance_status === option.value,
        ).length;

        if (!count) return null;

        return {
          status_key: option.value,
          status: option.label,
          count,
        };
      })
      .filter(Boolean),
  };
}

type PlatformMasterDataSyncRow = {
  sync_id: string;
  sync_name: string;
  object_type: string;
  target_system: string;
  sync_status: string;
  schedule_label: string | null;
  last_run_at: string | null;
  fallback_strategy: string;
  primary_action_label: string;
  fallback_action_label: string;
  owner_name: string;
  note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type PlatformMasterDataJobRow = {
  job_id: string;
  sync_id: string | null;
  source_key: string;
  object_type: string;
  job_status: string;
  summary: string;
  detail_note: string | null;
  retry_count: number;
  replay_count: number;
  last_error: string | null;
  requested_at: string;
  processed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  sync_name: string | null;
};

type PlatformMasterDataRelationshipRow = {
  relationship_id: string;
  source_object_type: string;
  source_object_id: string;
  relation_type: string;
  target_object_type: string;
  target_object_id: string;
  path_depth: number;
  path_summary: string;
  evidence_source: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type PlatformMasterDataSyncOptions = Awaited<
  ReturnType<typeof loadPlatformMasterDataSyncOptions>
>;
type PlatformMasterDataJobOptions = Awaited<
  ReturnType<typeof loadPlatformMasterDataJobOptions>
>;
type PlatformMasterDataRelationshipOptions = Awaited<
  ReturnType<typeof loadPlatformMasterDataRelationshipOptions>
>;

function mapPlatformMasterDataSyncRow(
  row: PlatformMasterDataSyncRow,
  labelMaps: {
    objectLabelMap: Map<string, string>;
    targetLabelMap: Map<string, string>;
    statusLabelMap: Map<string, string>;
  },
) {
  const statusLabel = row.deleted_at
    ? "已归档"
    : labelMaps.statusLabelMap.get(row.sync_status) || row.sync_status;

  return {
    sync_id: row.sync_id,
    id: row.sync_id,
    code: row.sync_id,
    sync_name: row.sync_name,
    name: row.sync_name,
    object_type: row.object_type,
    object_type_key: row.object_type,
    object: labelMaps.objectLabelMap.get(row.object_type) || row.object_type,
    target_system: row.target_system,
    target_key: row.target_system,
    target: labelMaps.targetLabelMap.get(row.target_system) || row.target_system,
    sync_status: row.sync_status,
    status_key: row.sync_status,
    status: statusLabel,
    schedule_label: row.schedule_label || "",
    schedule: row.schedule_label || "",
    last_run_at: row.last_run_at,
    lastRun: row.last_run_at,
    fallback_strategy: row.fallback_strategy,
    fallback: row.fallback_strategy,
    primary_action_label: row.primary_action_label,
    primaryAction: row.primary_action_label,
    fallback_action_label: row.fallback_action_label,
    fallbackAction: row.fallback_action_label,
    owner_name: row.owner_name,
    owner: row.owner_name,
    note: row.note || "",
    archived: Boolean(row.deleted_at),
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPlatformMasterDataSyncObjectOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_sync_object_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataSyncTargetOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_sync_target_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataSyncStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_sync_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataSyncOptions(db: any) {
  const [objects, targets, statuses] = await Promise.all([
    loadPlatformMasterDataSyncObjectOptions(db),
    loadPlatformMasterDataSyncTargetOptions(db),
    loadPlatformMasterDataSyncStatusOptions(db),
  ]);

  return {
    objects,
    targets,
    statuses,
  };
}

async function loadPlatformMasterDataSyncLabelMaps(db: any) {
  const options = await loadPlatformMasterDataSyncOptions(db);

  return {
    objectLabelMap: new Map(
      options.objects.map((item) => [item.value, item.label] as const),
    ),
    targetLabelMap: new Map(
      options.targets.map((item) => [item.value, item.label] as const),
    ),
    statusLabelMap: new Map(
      options.statuses.map((item) => [item.value, item.label] as const),
    ),
  };
}

async function listPlatformMasterDataSyncFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const includeArchived = parseIncludeArchived(query);
  const keyword = normalizeNullableText(query.keyword);
  const objectType = normalizeNullableText(query.object_type || query.object);
  const targetSystem = normalizeNullableText(query.target_system || query.target);
  const syncStatus = normalizeNullableText(query.sync_status || query.status);
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (!includeArchived && syncStatus !== "archived") {
    clauses.push("s.deleted_at IS NULL");
  }

  if (keyword) {
    clauses.push(
      `(s.sync_id LIKE ? OR s.sync_name LIKE ? OR s.fallback_strategy LIKE ? OR s.owner_name LIKE ? OR COALESCE(s.note, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (objectType) {
    clauses.push("s.object_type = ?");
    params.push(objectType);
  }

  if (targetSystem) {
    clauses.push("s.target_system = ?");
    params.push(targetSystem);
  }

  if (syncStatus) {
    if (syncStatus === "archived") {
      clauses.push("(s.sync_status = 'archived' OR s.deleted_at IS NOT NULL)");
    } else {
      clauses.push("s.sync_status = ?");
      params.push(syncStatus);
    }
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM platform_master_data_sync s
    WHERE ${whereClause}
  `;

  const [labelMaps, totalRow, rows] = await Promise.all([
    loadPlatformMasterDataSyncLabelMaps(db),
    db.prepare(`SELECT COUNT(*) AS total ${baseSql}`).bind(...params).first(),
    db
      .prepare(
        `
          SELECT
            s.sync_id,
            s.sync_name,
            s.object_type,
            s.target_system,
            s.sync_status,
            s.schedule_label,
            s.last_run_at,
            s.fallback_strategy,
            s.primary_action_label,
            s.fallback_action_label,
            s.owner_name,
            s.note,
            s.deleted_at,
            s.created_at,
            s.updated_at
          ${baseSql}
          ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.sync_id ASC
          LIMIT ? OFFSET ?
        `,
      )
      .bind(...params, pageSize, offset)
      .all(),
  ]);

  return {
    items: (
      ((rows as { results?: PlatformMasterDataSyncRow[] }).results ||
        []) as PlatformMasterDataSyncRow[]
    ).map((row) => mapPlatformMasterDataSyncRow(row, labelMaps)),
    page,
    page_size: pageSize,
    total: Number((totalRow as { total?: number } | null)?.total || 0),
  };
}

async function loadPlatformMasterDataSyncDetailFromDb(db: any, syncId: string) {
  const normalizedSyncId = normalizeRequiredText(syncId).toUpperCase();
  const [labelMaps, row] = await Promise.all([
    loadPlatformMasterDataSyncLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            sync_id,
            sync_name,
            object_type,
            target_system,
            sync_status,
            schedule_label,
            last_run_at,
            fallback_strategy,
            primary_action_label,
            fallback_action_label,
            owner_name,
            note,
            deleted_at,
            created_at,
            updated_at
          FROM platform_master_data_sync
          WHERE UPPER(sync_id) = ?
          LIMIT 1
        `,
      )
      .bind(normalizedSyncId)
      .first(),
  ]);

  if (!row) {
    return null;
  }

  return {
    sync: mapPlatformMasterDataSyncRow(row as PlatformMasterDataSyncRow, labelMaps),
  };
}

async function writePlatformMasterDataSyncAudit(
  c: any,
  params: {
    action:
      | "MASTER_DATA_SYNC_CREATED"
      | "MASTER_DATA_SYNC_UPDATED"
      | "MASTER_DATA_SYNC_ARCHIVED"
      | "MASTER_DATA_SYNC_RESTORED";
    syncId: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;
  const actorUserId = await resolveKnownUserId(c, actor.userId, "demo-docdesk");
  const auditStationId = await loadPlatformMasterDataAuditFallbackStationId(
    c.env.DB,
  );

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actorUserId,
      actor.roleIds[0] || "platform_admin",
      actor.clientSource,
      params.action,
      "MasterDataSync",
      params.syncId,
      auditStationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

function getPlatformMasterDataJobAvailableActions(row: {
  job_status: string;
  archived_at: string | null;
}) {
  if (row.archived_at || row.job_status === "archived") {
    return ["replay"];
  }

  if (row.job_status === "failed" || row.job_status === "partial") {
    return ["retry", "replay", "archive"];
  }

  if (row.job_status === "succeeded") {
    return ["replay", "archive"];
  }

  return ["archive"];
}

function mapPlatformMasterDataJobRow(
  row: PlatformMasterDataJobRow,
  labelMaps: {
    sourceLabelMap: Map<string, string>;
    objectLabelMap: Map<string, string>;
    statusLabelMap: Map<string, string>;
    actionLabelMap: Map<string, string>;
  },
) {
  const availableActionKeys = getPlatformMasterDataJobAvailableActions(row);
  const statusLabel =
    row.archived_at || row.job_status === "archived"
      ? "已归档"
      : labelMaps.statusLabelMap.get(row.job_status) || row.job_status;

  return {
    job_id: row.job_id,
    id: row.job_id,
    sync_id: row.sync_id,
    sync_name: row.sync_name || row.sync_id || "--",
    source_key: row.source_key,
    source: labelMaps.sourceLabelMap.get(row.source_key) || row.source_key,
    object_type: row.object_type,
    object_type_key: row.object_type,
    object: labelMaps.objectLabelMap.get(row.object_type) || row.object_type,
    job_status: row.job_status,
    status_key: row.job_status,
    status: statusLabel,
    summary: row.summary,
    detail_note: row.detail_note || "",
    note: row.detail_note || row.last_error || "",
    retry_count: Number(row.retry_count || 0),
    replay_count: Number(row.replay_count || 0),
    last_error: row.last_error || "",
    requested_at: row.requested_at,
    processed_at: row.processed_at,
    archived: Boolean(row.archived_at || row.job_status === "archived"),
    archived_at: row.archived_at,
    available_actions: availableActionKeys,
    available_actions_display: availableActionKeys.map(
      (key) => labelMaps.actionLabelMap.get(key) || key,
    ),
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

async function loadPlatformMasterDataJobSourceOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_job_source_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataJobObjectOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_job_object_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataJobStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_job_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataJobActionOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_job_action_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataJobOptions(db: any) {
  const [sources, objects, statuses, actions] = await Promise.all([
    loadPlatformMasterDataJobSourceOptions(db),
    loadPlatformMasterDataJobObjectOptions(db),
    loadPlatformMasterDataJobStatusOptions(db),
    loadPlatformMasterDataJobActionOptions(db),
  ]);

  return {
    sources,
    objects,
    statuses,
    actions,
  };
}

async function loadPlatformMasterDataJobLabelMaps(db: any) {
  const options = await loadPlatformMasterDataJobOptions(db);

  return {
    sourceLabelMap: new Map(
      options.sources.map((item) => [item.value, item.label] as const),
    ),
    objectLabelMap: new Map(
      options.objects.map((item) => [item.value, item.label] as const),
    ),
    statusLabelMap: new Map(
      options.statuses.map((item) => [item.value, item.label] as const),
    ),
    actionLabelMap: new Map(
      options.actions.map((item) => [item.value, item.label] as const),
    ),
  };
}

async function listPlatformMasterDataJobsFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const includeArchived = parseIncludeArchived(query);
  const keyword = normalizeNullableText(query.keyword);
  const sourceKey = normalizeNullableText(query.source_key || query.source);
  const objectType = normalizeNullableText(query.object_type || query.object);
  const jobStatus = normalizeNullableText(query.job_status || query.status);
  const action = normalizeNullableText(query.action);
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (!includeArchived && jobStatus !== "archived") {
    clauses.push("j.archived_at IS NULL");
  }

  if (keyword) {
    clauses.push(
      `(j.job_id LIKE ? OR COALESCE(j.sync_id, '') LIKE ? OR j.summary LIKE ? OR COALESCE(j.detail_note, '') LIKE ? OR COALESCE(j.last_error, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (sourceKey) {
    clauses.push("j.source_key = ?");
    params.push(sourceKey);
  }

  if (objectType) {
    clauses.push("j.object_type = ?");
    params.push(objectType);
  }

  if (jobStatus) {
    if (jobStatus === "archived") {
      clauses.push("(j.job_status = 'archived' OR j.archived_at IS NOT NULL)");
    } else {
      clauses.push("j.job_status = ?");
      params.push(jobStatus);
    }
  }

  if (action) {
    if (action === "retry") {
      clauses.push("j.archived_at IS NULL AND j.job_status IN ('failed', 'partial')");
    } else if (action === "replay") {
      clauses.push(
        "(j.archived_at IS NOT NULL OR j.job_status IN ('succeeded', 'failed', 'partial', 'archived'))",
      );
    } else if (action === "archive") {
      clauses.push("j.archived_at IS NULL");
    }
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM platform_master_data_jobs j
    LEFT JOIN platform_master_data_sync s
      ON s.sync_id = j.sync_id
    WHERE ${whereClause}
  `;

  const [labelMaps, totalRow, rows] = await Promise.all([
    loadPlatformMasterDataJobLabelMaps(db),
    db.prepare(`SELECT COUNT(*) AS total ${baseSql}`).bind(...params).first(),
    db
      .prepare(
        `
          SELECT
            j.job_id,
            j.sync_id,
            j.source_key,
            j.object_type,
            j.job_status,
            j.summary,
            j.detail_note,
            j.retry_count,
            j.replay_count,
            j.last_error,
            j.requested_at,
            j.processed_at,
            j.archived_at,
            j.created_at,
            j.updated_at,
            s.sync_name
          ${baseSql}
          ORDER BY COALESCE(j.updated_at, j.created_at) DESC, j.job_id ASC
          LIMIT ? OFFSET ?
        `,
      )
      .bind(...params, pageSize, offset)
      .all(),
  ]);

  return {
    items: (
      ((rows as { results?: PlatformMasterDataJobRow[] }).results ||
        []) as PlatformMasterDataJobRow[]
    ).map((row) => mapPlatformMasterDataJobRow(row, labelMaps)),
    page,
    page_size: pageSize,
    total: Number((totalRow as { total?: number } | null)?.total || 0),
  };
}

async function loadPlatformMasterDataJobDetailFromDb(db: any, jobId: string) {
  const normalizedJobId = normalizeRequiredText(jobId).toUpperCase();
  const [labelMaps, row] = await Promise.all([
    loadPlatformMasterDataJobLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            j.job_id,
            j.sync_id,
            j.source_key,
            j.object_type,
            j.job_status,
            j.summary,
            j.detail_note,
            j.retry_count,
            j.replay_count,
            j.last_error,
            j.requested_at,
            j.processed_at,
            j.archived_at,
            j.created_at,
            j.updated_at,
            s.sync_name
          FROM platform_master_data_jobs j
          LEFT JOIN platform_master_data_sync s
            ON s.sync_id = j.sync_id
          WHERE UPPER(j.job_id) = ?
          LIMIT 1
        `,
      )
      .bind(normalizedJobId)
      .first(),
  ]);

  if (!row) {
    return null;
  }

  return {
    job: mapPlatformMasterDataJobRow(row as PlatformMasterDataJobRow, labelMaps),
  };
}

async function writePlatformMasterDataJobAudit(
  c: any,
  params: {
    action:
      | "MASTER_DATA_JOB_RETRIED"
      | "MASTER_DATA_JOB_REPLAYED"
      | "MASTER_DATA_JOB_ARCHIVED";
    jobId: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;
  const actorUserId = await resolveKnownUserId(c, actor.userId, "demo-docdesk");
  const auditStationId = await loadPlatformMasterDataAuditFallbackStationId(
    c.env.DB,
  );

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actorUserId,
      actor.roleIds[0] || "platform_admin",
      actor.clientSource,
      params.action,
      "MasterDataJob",
      params.jobId,
      auditStationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

function mapPlatformMasterDataRelationshipRow(
  row: PlatformMasterDataRelationshipRow,
  labelMaps: {
    nodeLabelMap: Map<string, string>;
    relationLabelMap: Map<string, string>;
    evidenceLabelMap: Map<string, string>;
  },
) {
  return {
    relationship_id: row.relationship_id,
    id: row.relationship_id,
    source_object_type: row.source_object_type,
    source_type_key: row.source_object_type,
    source_type:
      labelMaps.nodeLabelMap.get(row.source_object_type) || row.source_object_type,
    source_object_id: row.source_object_id,
    source: row.source_object_id,
    relation_type: row.relation_type,
    relation_key: row.relation_type,
    relation:
      labelMaps.relationLabelMap.get(row.relation_type) || row.relation_type,
    target_object_type: row.target_object_type,
    target_type_key: row.target_object_type,
    target_type:
      labelMaps.nodeLabelMap.get(row.target_object_type) || row.target_object_type,
    target_object_id: row.target_object_id,
    target: row.target_object_id,
    path_depth: Number(row.path_depth || 0),
    path_summary: row.path_summary,
    summary: row.path_summary,
    evidence_source: row.evidence_source,
    evidence_key: row.evidence_source,
    evidence:
      labelMaps.evidenceLabelMap.get(row.evidence_source) || row.evidence_source,
    note: row.note || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPlatformMasterDataRelationshipNodeOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_relationship_node_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataRelationshipTypeOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_relationship_type_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataRelationshipEvidenceOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM platform_master_data_relationship_evidence_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadPlatformMasterDataRelationshipOptions(db: any) {
  const [nodeTypes, relationTypes, evidenceSources] = await Promise.all([
    loadPlatformMasterDataRelationshipNodeOptions(db),
    loadPlatformMasterDataRelationshipTypeOptions(db),
    loadPlatformMasterDataRelationshipEvidenceOptions(db),
  ]);

  return {
    nodeTypes,
    relationTypes,
    evidenceSources,
  };
}

async function loadPlatformMasterDataRelationshipLabelMaps(db: any) {
  const options = await loadPlatformMasterDataRelationshipOptions(db);

  return {
    nodeLabelMap: new Map(
      options.nodeTypes.map((item) => [item.value, item.label] as const),
    ),
    relationLabelMap: new Map(
      options.relationTypes.map((item) => [item.value, item.label] as const),
    ),
    evidenceLabelMap: new Map(
      options.evidenceSources.map((item) => [item.value, item.label] as const),
    ),
  };
}

async function listPlatformMasterDataRelationshipsFromDb(
  db: any,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const keyword = normalizeNullableText(query.keyword);
  const sourceType = normalizeNullableText(
    query.source_object_type || query.source_type,
  );
  const relationType = normalizeNullableText(
    query.relation_type || query.relation,
  );
  const targetType = normalizeNullableText(
    query.target_object_type || query.target_type,
  );
  const evidenceSource = normalizeNullableText(
    query.evidence_source || query.evidence,
  );
  const clauses = ["1 = 1"];
  const params: unknown[] = [];

  if (keyword) {
    clauses.push(
      `(r.relationship_id LIKE ? OR r.source_object_id LIKE ? OR r.target_object_id LIKE ? OR r.path_summary LIKE ? OR COALESCE(r.note, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (sourceType) {
    clauses.push("r.source_object_type = ?");
    params.push(sourceType);
  }

  if (relationType) {
    clauses.push("r.relation_type = ?");
    params.push(relationType);
  }

  if (targetType) {
    clauses.push("r.target_object_type = ?");
    params.push(targetType);
  }

  if (evidenceSource) {
    clauses.push("r.evidence_source = ?");
    params.push(evidenceSource);
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM platform_master_data_relationships r
    WHERE ${whereClause}
  `;

  const [labelMaps, totalRow, rows] = await Promise.all([
    loadPlatformMasterDataRelationshipLabelMaps(db),
    db.prepare(`SELECT COUNT(*) AS total ${baseSql}`).bind(...params).first(),
    db
      .prepare(
        `
          SELECT
            r.relationship_id,
            r.source_object_type,
            r.source_object_id,
            r.relation_type,
            r.target_object_type,
            r.target_object_id,
            r.path_depth,
            r.path_summary,
            r.evidence_source,
            r.note,
            r.created_at,
            r.updated_at
          ${baseSql}
          ORDER BY COALESCE(r.updated_at, r.created_at) DESC, r.relationship_id ASC
          LIMIT ? OFFSET ?
        `,
      )
      .bind(...params, pageSize, offset)
      .all(),
  ]);

  return {
    items: (
      ((rows as { results?: PlatformMasterDataRelationshipRow[] }).results ||
        []) as PlatformMasterDataRelationshipRow[]
    ).map((row) => mapPlatformMasterDataRelationshipRow(row, labelMaps)),
    page,
    page_size: pageSize,
    total: Number((totalRow as { total?: number } | null)?.total || 0),
  };
}

async function loadPlatformMasterDataRelationshipDetailFromDb(
  db: any,
  relationshipId: string,
) {
  const normalizedRelationshipId = normalizeRequiredText(
    relationshipId,
  ).toUpperCase();
  const [labelMaps, row] = await Promise.all([
    loadPlatformMasterDataRelationshipLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            relationship_id,
            source_object_type,
            source_object_id,
            relation_type,
            target_object_type,
            target_object_id,
            path_depth,
            path_summary,
            evidence_source,
            note,
            created_at,
            updated_at
          FROM platform_master_data_relationships
          WHERE UPPER(relationship_id) = ?
          LIMIT 1
        `,
      )
      .bind(normalizedRelationshipId)
      .first(),
  ]);

  if (!row) {
    return null;
  }

  const current = row as PlatformMasterDataRelationshipRow;
  const relatedRows = (await db
    .prepare(
      `
        SELECT
          relationship_id,
          source_object_type,
          source_object_id,
          relation_type,
          target_object_type,
          target_object_id,
          path_depth,
          path_summary,
          evidence_source,
          note,
          created_at,
          updated_at
        FROM platform_master_data_relationships
        WHERE UPPER(relationship_id) != ?
          AND (
            source_object_id = ?
            OR target_object_id = ?
            OR source_object_id = ?
            OR target_object_id = ?
          )
        ORDER BY path_depth ASC, updated_at DESC, relationship_id ASC
        LIMIT 10
      `,
    )
    .bind(
      normalizedRelationshipId,
      current.source_object_id,
      current.source_object_id,
      current.target_object_id,
      current.target_object_id,
    )
    .all()) as { results?: PlatformMasterDataRelationshipRow[] };

  const relationship = mapPlatformMasterDataRelationshipRow(current, labelMaps);
  const chainRows = [
    relationship,
    ...((relatedRows.results || []) as PlatformMasterDataRelationshipRow[]).map(
      (item) => mapPlatformMasterDataRelationshipRow(item, labelMaps),
    ),
  ];

  return {
    relationship,
    chainRows,
  };
}

async function loadPlatformMasterDataAuditFallbackStationId(db: any) {
  const row = (await db
    .prepare(
      `
        SELECT station_id
        FROM stations
        WHERE deleted_at IS NULL
        ORDER BY station_id ASC
        LIMIT 1
      `,
    )
    .first()) as { station_id: string } | null;

  return normalizeRequiredText(row?.station_id) || null;
}

async function writePlatformMasterDataAudit(
  c: any,
  params: {
    action:
      | "MASTER_DATA_CREATED"
      | "MASTER_DATA_UPDATED"
      | "MASTER_DATA_ARCHIVED"
      | "MASTER_DATA_RESTORED";
    masterDataId: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;
  const actorUserId = await resolveKnownUserId(c, actor.userId, "demo-docdesk");
  const auditStationId = await loadPlatformMasterDataAuditFallbackStationId(
    c.env.DB,
  );

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actorUserId,
      actor.roleIds[0] || "platform_admin",
      actor.clientSource,
      params.action,
      "MasterData",
      params.masterDataId,
      auditStationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

type StationVehicleRow = {
  truck_id: string;
  station_id: string;
  plate_no: string;
  driver_name: string | null;
  driver_phone: string | null;
  route_type: string | null;
  route_label: string | null;
  collection_note: string | null;
  dispatch_status: string;
  priority_code: string | null;
  sla_text: string | null;
  office_plan: string | null;
  pda_execution: string | null;
  awb_list_json: string | null;
  pallet_list_json: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeVehicleTextArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[")) {
      const parsed = safeParseJson<unknown[]>(trimmed, []);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
      }
    }

    return trimmed
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function mapStationVehicleRow(
  row: StationVehicleRow,
  flowLabelMap: Map<string, string>,
  statusLabelMap: Map<string, string>,
  priorityLabelMap: Map<string, string>,
) {
  const flowKey = String(row.route_type || "headhaul").trim() || "headhaul";
  const dispatchStatus =
    String(row.dispatch_status || "pending_dispatch").trim() ||
    "pending_dispatch";
  const priorityCode = String(row.priority_code || "P2").trim() || "P2";
  const flowLabel = flowLabelMap.get(flowKey) || flowKey;
  const statusLabel = row.deleted_at
    ? "已归档"
    : statusLabelMap.get(dispatchStatus) || dispatchStatus;
  const priorityLabel = priorityLabelMap.get(priorityCode) || priorityCode;
  const awbs = normalizeVehicleTextArray(row.awb_list_json);
  const pallets = normalizeVehicleTextArray(row.pallet_list_json);

  return {
    truck_id: row.truck_id,
    trip_id: row.truck_id,
    tripId: row.truck_id,
    station_id: row.station_id,
    station_code: row.station_id,
    flow_key: flowKey,
    flowKey,
    flow_label: flowLabel,
    flowLabel,
    route_type: flowKey,
    route: row.route_label || "",
    route_label: row.route_label || "",
    plate_no: row.plate_no,
    plate: row.plate_no,
    driver_name: row.driver_name || "",
    driver: row.driver_name || "",
    driver_phone: row.driver_phone || "",
    collection_note: row.collection_note || "",
    collectionNote: row.collection_note || "",
    dispatch_status: dispatchStatus,
    status: dispatchStatus,
    status_label: statusLabel,
    statusLabel,
    stage: statusLabel,
    priority_code: priorityCode,
    priority: priorityCode,
    priority_label: priorityLabel,
    priorityLabel,
    sla_text: row.sla_text || "",
    sla: row.sla_text || "",
    office_plan: row.office_plan || "",
    officePlan: row.office_plan || "",
    pda_execution: row.pda_execution || "",
    pdaExec: row.pda_execution || "",
    awbs,
    pallets,
    departure_at: row.departure_at,
    arrival_at: row.arrival_at,
    archived: Boolean(row.deleted_at),
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadStationVehicleFlowOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM truck_route_type_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationVehicleStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM truck_dispatch_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationVehiclePriorityOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM truck_priority_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationVehicleOptions(db: any) {
  const [flows, statuses, priorities] = await Promise.all([
    loadStationVehicleFlowOptions(db),
    loadStationVehicleStatusOptions(db),
    loadStationVehiclePriorityOptions(db),
  ]);

  return {
    flows,
    statuses,
    priorities,
  };
}

async function loadStationFlightServiceLevelOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM station_flight_service_level_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationInboundFlightStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM station_inbound_flight_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationOutboundFlightStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM station_outbound_flight_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationFlightStationOptions(
  db: any,
  currentStationId: string,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT station_id, station_name, airport_code, deleted_at
        FROM stations
        ORDER BY station_name ASC, station_id ASC
      `,
    )
    .all()) as {
    results?: Array<{
      station_id: string;
      station_name: string;
      airport_code: string | null;
      deleted_at: string | null;
    }>;
  };

  return (rows.results || []).map((row) => {
    const airportCode = normalizeStationCode(row.airport_code || row.station_id);
    return {
      value: airportCode,
      label:
        normalizeStationCode(row.station_id) === normalizeStationCode(currentStationId)
          ? `${row.station_name} / ${airportCode}（本站）`
          : `${row.station_name} / ${airportCode}`,
      disabled: Boolean(row.deleted_at),
      meta: {
        station_id: row.station_id,
        airport_code: airportCode,
      },
    };
  });
}

async function loadStationFlightSelectOptions(
  db: any,
  stationId: string,
  direction: "inbound" | "outbound",
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT
          flight_id,
          flight_no,
          flight_date,
          origin_code,
          destination_code,
          runtime_status
        FROM flights
        WHERE station_id = ?
          AND deleted_at IS NULL
          AND ${
            direction === "inbound"
              ? "(eta_at IS NOT NULL OR actual_landed_at IS NOT NULL OR runtime_status IN ('Pre-Arrival', 'Landed', 'Diverted', 'Delayed'))"
              : "(etd_at IS NOT NULL OR std_at IS NOT NULL OR actual_takeoff_at IS NOT NULL OR runtime_status IN ('Scheduled', 'Pre-Departure', 'Airborne', 'Delayed'))"
          }
        ORDER BY flight_date DESC, flight_no ASC
        LIMIT 100
      `,
    )
    .bind(normalizeStationCode(stationId))
    .all()) as {
    results?: Array<{
      flight_id: string;
      flight_no: string;
      flight_date: string;
      origin_code: string;
      destination_code: string;
      runtime_status: string;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.flight_id,
    label: `${row.flight_no} / ${row.flight_date}`,
    disabled: false,
    meta: {
      flight_no: row.flight_no,
      flight_date: row.flight_date,
      origin_code: row.origin_code,
      destination_code: row.destination_code,
      runtime_status: row.runtime_status,
    },
  }));
}

async function loadStationFlightOptions(
  db: any,
  stationId: string,
  direction: "inbound" | "outbound",
) {
  const [stationOptions, serviceLevels, inboundStatuses, outboundStatuses, flightOptions] =
    await Promise.all([
      loadStationFlightStationOptions(db, stationId),
      loadStationFlightServiceLevelOptions(db),
      loadStationInboundFlightStatusOptions(db),
      loadStationOutboundFlightStatusOptions(db),
      loadStationFlightSelectOptions(db, stationId, direction),
    ]);

  return {
    flightOptions,
    sourceOptions:
      direction === "inbound"
        ? stationOptions.filter(
            (item) =>
              normalizeStationCode(String(item.meta?.station_id || "")) !==
              normalizeStationCode(stationId),
          )
        : stationOptions,
    destinationOptions:
      direction === "outbound"
        ? stationOptions.filter(
            (item) =>
              normalizeStationCode(String(item.meta?.station_id || "")) !==
              normalizeStationCode(stationId),
          )
        : stationOptions,
    serviceLevels,
    runtimeStatuses:
      direction === "inbound" ? inboundStatuses : outboundStatuses,
  };
}

async function loadStationWaybillAwbTypeOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM station_waybill_awb_type_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationInboundWaybillNodeOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM station_inbound_waybill_node_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationInboundWaybillNoaStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM station_inbound_waybill_noa_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationInboundWaybillPodStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM station_inbound_waybill_pod_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationInboundWaybillTransferStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM station_inbound_waybill_transfer_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationOutboundWaybillNodeOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM station_outbound_waybill_node_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationOutboundWaybillManifestStatusOptions(
  db: any,
): Promise<PlatformSelectOption[]> {
  const rows = (await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM station_outbound_waybill_manifest_status_options
        ORDER BY sort_order ASC, option_label ASC
      `,
    )
    .all()) as {
    results?: Array<{
      option_key: string;
      option_label: string;
      is_disabled: number;
    }>;
  };

  return (rows.results || []).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
  }));
}

async function loadStationWaybillOptions(
  db: any,
  stationId: string,
  direction: "inbound" | "outbound",
) {
  const [flightOptions, awbTypeOptions, inboundNodes, noaStatuses, podStatuses, transferStatuses, outboundNodes, manifestStatuses] = await Promise.all([
    loadStationFlightSelectOptions(db, stationId, direction),
    loadStationWaybillAwbTypeOptions(db),
    loadStationInboundWaybillNodeOptions(db),
    loadStationInboundWaybillNoaStatusOptions(db),
    loadStationInboundWaybillPodStatusOptions(db),
    loadStationInboundWaybillTransferStatusOptions(db),
    loadStationOutboundWaybillNodeOptions(db),
    loadStationOutboundWaybillManifestStatusOptions(db),
  ]);

  return {
    flightOptions,
    awbTypeOptions,
    currentNodeOptions: direction === "inbound" ? inboundNodes : outboundNodes,
    noaStatusOptions: direction === "inbound" ? noaStatuses : [],
    podStatusOptions: direction === "inbound" ? podStatuses : [],
    transferStatusOptions: direction === "inbound" ? transferStatuses : [],
    manifestStatusOptions: direction === "outbound" ? manifestStatuses : [],
  };
}

async function loadStationVehicleLabelMaps(db: any) {
  const { flows, statuses, priorities } = await loadStationVehicleOptions(db);

  return {
    flowLabelMap: new Map(
      flows.map((item) => [item.value, item.label] as const),
    ),
    statusLabelMap: new Map(
      statuses.map((item) => [item.value, item.label] as const),
    ),
    priorityLabelMap: new Map(
      priorities.map((item) => [item.value, item.label] as const),
    ),
  };
}

async function listStationVehiclesFromDb(
  db: any,
  stationId: string,
  query: Record<string, string | undefined>,
) {
  const { page, pageSize, offset } = parsePlatformPagination(query);
  const includeArchived = parseIncludeArchived(query);
  const keyword = normalizeNullableText(query.keyword);
  const flowKey = normalizeNullableText(query.flow_key || query.route_type);
  const status = normalizeNullableText(query.status || query.dispatch_status);
  const priority = normalizeNullableText(query.priority || query.priority_code);
  const clauses = ["t.station_id = ?"];
  const params: unknown[] = [normalizeStationCode(stationId)];

  if (!includeArchived) {
    clauses.push("t.deleted_at IS NULL");
  }

  if (keyword) {
    clauses.push(
      `(t.truck_id LIKE ? OR t.plate_no LIKE ? OR COALESCE(t.driver_name, '') LIKE ? OR COALESCE(t.collection_note, '') LIKE ? OR COALESCE(t.route_label, '') LIKE ? OR COALESCE(t.office_plan, '') LIKE ?)`,
    );
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
  }

  if (flowKey) {
    clauses.push("t.route_type = ?");
    params.push(flowKey);
  }

  if (status) {
    clauses.push("t.dispatch_status = ?");
    params.push(status);
  }

  if (priority) {
    clauses.push("t.priority_code = ?");
    params.push(priority);
  }

  const whereClause = clauses.join(" AND ");
  const baseSql = `
    FROM trucks t
    WHERE ${whereClause}
  `;

  const [{ flowLabelMap, statusLabelMap, priorityLabelMap }, totalRow, rows] =
    await Promise.all([
      loadStationVehicleLabelMaps(db),
      db
        .prepare(`SELECT COUNT(*) AS total ${baseSql}`)
        .bind(...params)
        .first(),
      db
        .prepare(
          `
          SELECT
            t.truck_id,
            t.station_id,
            t.plate_no,
            t.driver_name,
            t.driver_phone,
            t.route_type,
            t.route_label,
            t.collection_note,
            t.dispatch_status,
            t.priority_code,
            t.sla_text,
            t.office_plan,
            t.pda_execution,
            t.awb_list_json,
            t.pallet_list_json,
            t.departure_at,
            t.arrival_at,
            t.deleted_at,
            t.created_at,
            t.updated_at
          ${baseSql}
          ORDER BY t.created_at DESC, t.truck_id ASC
          LIMIT ? OFFSET ?
        `,
        )
        .bind(...params, pageSize, offset)
        .all(),
    ]);

  return {
    items: (
      ((rows as { results?: StationVehicleRow[] }).results ||
        []) as StationVehicleRow[]
    ).map((row) =>
      mapStationVehicleRow(row, flowLabelMap, statusLabelMap, priorityLabelMap),
    ),
    page,
    page_size: pageSize,
    total: Number((totalRow as { total?: number } | null)?.total || 0),
  };
}

async function loadStationVehicleDetailFromDb(
  db: any,
  stationId: string,
  vehicleId: string,
) {
  const normalizedVehicleId = normalizeRequiredText(vehicleId).toUpperCase();
  const normalizedStationId = normalizeStationCode(stationId);
  const [labelMaps, row] = await Promise.all([
    loadStationVehicleLabelMaps(db),
    db
      .prepare(
        `
          SELECT
            t.truck_id,
            t.station_id,
            t.plate_no,
            t.driver_name,
            t.driver_phone,
            t.route_type,
            t.route_label,
            t.collection_note,
            t.dispatch_status,
            t.priority_code,
            t.sla_text,
            t.office_plan,
            t.pda_execution,
            t.awb_list_json,
            t.pallet_list_json,
            t.departure_at,
            t.arrival_at,
            t.deleted_at,
            t.created_at,
            t.updated_at
          FROM trucks t
          WHERE UPPER(t.truck_id) = ?
            AND t.station_id = ?
          LIMIT 1
        `,
      )
      .bind(normalizedVehicleId, normalizedStationId)
      .first(),
  ]);

  if (!row) {
    return null;
  }

  return {
    vehicle: mapStationVehicleRow(
      row as StationVehicleRow,
      labelMaps.flowLabelMap,
      labelMaps.statusLabelMap,
      labelMaps.priorityLabelMap,
    ),
  };
}

async function writeStationVehicleAudit(
  c: any,
  params: {
    action:
      | "VEHICLE_CREATED"
      | "VEHICLE_UPDATED"
      | "VEHICLE_ARCHIVED"
      | "VEHICLE_RESTORED";
    vehicleId: string;
    stationId: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = c.var.actor;

  await c.env.DB.prepare(
    `
      INSERT INTO audit_events (
        audit_id,
        request_id,
        actor_id,
        actor_role,
        client_source,
        action,
        object_type,
        object_id,
        station_id,
        summary,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      c.req.header("X-Request-Id") ||
        c.req.header("Idempotency-Key") ||
        `req-${crypto.randomUUID()}`,
      actor.userId,
      actor.roleIds[0] || "station_supervisor",
      actor.clientSource,
      params.action,
      "Truck",
      params.vehicleId,
      params.stationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      new Date().toISOString(),
    )
    .run();
}

async function resolveKnownUserId(
  c: any,
  requestedUserId: string | undefined,
  fallbackUserId: string,
) {
  if (!c.env.DB) {
    return requestedUserId || fallbackUserId;
  }

  if (requestedUserId) {
    const existing = (await c.env.DB.prepare(
      `SELECT user_id FROM users WHERE user_id = ? LIMIT 1`,
    )
      .bind(requestedUserId)
      .first()) as { user_id: string } | null;

    if (existing?.user_id) {
      return existing.user_id;
    }
  }

  const fallback = (await c.env.DB.prepare(
    `SELECT user_id FROM users WHERE user_id = ? LIMIT 1`,
  )
    .bind(fallbackUserId)
    .first()) as { user_id: string } | null;

  return fallback?.user_id || fallbackUserId;
}

function addAuditObject(
  scope: AuditScope,
  objectType: string,
  objectId: string | null | undefined,
) {
  if (!objectId) return;

  if (!scope.has(objectType)) {
    scope.set(objectType, new Set());
  }

  scope.get(objectType)?.add(objectId);
}

async function resolveAuditScope(
  db: any,
  objectType: string,
  objectKey?: string,
  objectId?: string,
) {
  const scope: AuditScope = new Map();
  const lookup = objectId || objectKey;

  if (!lookup) {
    return scope;
  }

  if (objectType === "Flight") {
    const flight = (await db
      .prepare(
        `SELECT flight_id FROM flights WHERE flight_id = ? OR flight_no = ? LIMIT 1`,
      )
      .bind(lookup, lookup)
      .first()) as { flight_id: string } | null;

    addAuditObject(scope, "Flight", flight?.flight_id);
  }

  if (objectType === "Station") {
    const station = (await db
      .prepare(`SELECT station_id FROM stations WHERE station_id = ? LIMIT 1`)
      .bind(lookup)
      .first()) as { station_id: string } | null;

    addAuditObject(scope, "Station", station?.station_id);
  }

  if (objectType === "Team") {
    const team = (await db
      .prepare(
        `SELECT team_id, station_id FROM teams WHERE team_id = ? LIMIT 1`,
      )
      .bind(lookup)
      .first()) as { team_id: string; station_id: string | null } | null;

    addAuditObject(scope, "Team", team?.team_id);
    addAuditObject(scope, "Station", team?.station_id);
  }

  if (objectType === "Zone") {
    const zone = (await db
      .prepare(
        `SELECT zone_id, station_id FROM zones WHERE zone_id = ? LIMIT 1`,
      )
      .bind(String(lookup).toUpperCase())
      .first()) as { zone_id: string; station_id: string | null } | null;

    addAuditObject(scope, "Zone", zone?.zone_id);
    addAuditObject(scope, "Station", zone?.station_id);
  }

  if (objectType === "Device") {
    const device = (await db
      .prepare(
        `SELECT device_id, station_id FROM platform_devices WHERE UPPER(device_id) = ? LIMIT 1`,
      )
      .bind(String(lookup).toUpperCase())
      .first()) as { device_id: string; station_id: string | null } | null;

    addAuditObject(scope, "Device", device?.device_id);
    addAuditObject(scope, "Station", device?.station_id);
  }

  if (objectType === "AWB") {
    const awb = (await db
      .prepare(
        `SELECT awb_id, shipment_id, flight_id FROM awbs WHERE awb_id = ? OR awb_no = ? LIMIT 1`,
      )
      .bind(lookup, lookup)
      .first()) as {
      awb_id: string;
      shipment_id: string | null;
      flight_id: string | null;
    } | null;

    addAuditObject(scope, "AWB", awb?.awb_id);
    addAuditObject(scope, "Shipment", awb?.shipment_id);
    addAuditObject(scope, "Flight", awb?.flight_id);
  }

  if (objectType === "Shipment") {
    const shipmentLookup =
      lookup.startsWith("in-") || lookup.startsWith("out-")
        ? lookup.split("-").slice(1).join("-")
        : lookup;
    const shipment =
      ((await db
        .prepare(
          `
            SELECT s.shipment_id
            FROM shipments s
            LEFT JOIN awbs a ON a.shipment_id = s.shipment_id
            WHERE s.shipment_id = ?
               OR a.awb_no = ?
            LIMIT 1
          `,
        )
        .bind(shipmentLookup, shipmentLookup)
        .first()) as { shipment_id: string } | null) || null;

    addAuditObject(scope, "Shipment", shipment?.shipment_id);
  }

  if (objectType === "Task") {
    const task = (await db
      .prepare(
        `
          SELECT task_id, related_object_type, related_object_id
          FROM tasks
          WHERE task_id = ?
          LIMIT 1
        `,
      )
      .bind(lookup)
      .first()) as {
      task_id: string;
      related_object_type: string;
      related_object_id: string;
    } | null;

    addAuditObject(scope, "Task", task?.task_id);
    if (task?.related_object_type) {
      addAuditObject(scope, task.related_object_type, task.related_object_id);
    }
  }

  if (objectType === "Exception") {
    const exception = (await db
      .prepare(
        `
          SELECT exception_id, related_object_type, related_object_id, linked_task_id
          FROM exceptions
          WHERE exception_id = ?
          LIMIT 1
        `,
      )
      .bind(lookup)
      .first()) as {
      exception_id: string;
      related_object_type: string;
      related_object_id: string;
      linked_task_id: string | null;
    } | null;

    addAuditObject(scope, "Exception", exception?.exception_id);
    if (exception?.related_object_type) {
      addAuditObject(
        scope,
        exception.related_object_type,
        exception.related_object_id,
      );
    }
    addAuditObject(scope, "Task", exception?.linked_task_id);
  }

  if (objectType === "Document") {
    const document = (await db
      .prepare(
        `
          SELECT document_id, related_object_type, related_object_id
          FROM documents
          WHERE document_id = ?
          LIMIT 1
        `,
      )
      .bind(lookup)
      .first()) as {
      document_id: string;
      related_object_type: string;
      related_object_id: string;
    } | null;

    addAuditObject(scope, "Document", document?.document_id);
    if (document?.related_object_type) {
      addAuditObject(
        scope,
        document.related_object_type,
        document.related_object_id,
      );
    }
  }

  const flightIds = Array.from(scope.get("Flight") || []);
  const awbIds = Array.from(scope.get("AWB") || []);
  const shipmentIds = Array.from(scope.get("Shipment") || []);
  const taskIds = Array.from(scope.get("Task") || []);

  if (flightIds.length || awbIds.length || shipmentIds.length) {
    const relatedClauses: string[] = [];
    const relatedParams: unknown[] = [];

    if (flightIds.length) {
      relatedClauses.push(
        `(related_object_type = 'Flight' AND related_object_id IN (${flightIds.map(() => "?").join(", ")}))`,
      );
      relatedParams.push(...flightIds);
    }

    if (awbIds.length) {
      relatedClauses.push(
        `(related_object_type = 'AWB' AND related_object_id IN (${awbIds.map(() => "?").join(", ")}))`,
      );
      relatedParams.push(...awbIds);
    }

    if (shipmentIds.length) {
      relatedClauses.push(
        `(related_object_type = 'Shipment' AND related_object_id IN (${shipmentIds.map(() => "?").join(", ")}))`,
      );
      relatedParams.push(...shipmentIds);
    }

    if (relatedClauses.length) {
      const documents = await db
        .prepare(
          `SELECT document_id FROM documents WHERE ${relatedClauses.join(" OR ")}`,
        )
        .bind(...relatedParams)
        .all();
      const tasks = await db
        .prepare(
          `SELECT task_id FROM tasks WHERE ${relatedClauses.join(" OR ")}`,
        )
        .bind(...relatedParams)
        .all();
      const exceptions = await db
        .prepare(
          `SELECT exception_id FROM exceptions WHERE ${relatedClauses.join(" OR ")}`,
        )
        .bind(...relatedParams)
        .all();

      for (const row of documents?.results || [])
        addAuditObject(scope, "Document", row.document_id);
      for (const row of tasks?.results || [])
        addAuditObject(scope, "Task", row.task_id);
      for (const row of exceptions?.results || [])
        addAuditObject(scope, "Exception", row.exception_id);
    }
  }

  const expandedTaskIds = Array.from(scope.get("Task") || []);
  if (expandedTaskIds.length) {
    const placeholders = expandedTaskIds.map(() => "?").join(", ");
    const taskDocuments = await db
      .prepare(
        `SELECT document_id FROM documents WHERE related_object_type = 'Task' AND related_object_id IN (${placeholders})`,
      )
      .bind(...expandedTaskIds)
      .all();
    const taskExceptions = await db
      .prepare(
        `SELECT exception_id FROM exceptions WHERE linked_task_id IN (${placeholders})`,
      )
      .bind(...expandedTaskIds)
      .all();

    for (const row of taskDocuments?.results || [])
      addAuditObject(scope, "Document", row.document_id);
    for (const row of taskExceptions?.results || [])
      addAuditObject(scope, "Exception", row.exception_id);
  }

  return scope;
}

function buildAuditScopeSql(scope: AuditScope) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const [objectType, ids] of scope.entries()) {
    const objectIds = Array.from(ids);
    if (!objectIds.length) continue;
    clauses.push(
      `(object_type = ? AND object_id IN (${objectIds.map(() => "?").join(", ")}))`,
    );
    params.push(objectType, ...objectIds);
  }

  return {
    whereClause: clauses.join(" OR "),
    params,
  };
}

async function loadStationResourcesOverview(db: any, stationId: string) {
  const [teamRows, zoneRows, deviceRows] = await Promise.all([
    db
      ? db
          .prepare(
            `
              SELECT team_id, station_id, team_name, owner_name, shift_code, team_status
              FROM teams
              WHERE station_id = ?
              ORDER BY created_at ASC, team_name ASC
            `,
          )
          .bind(stationId)
          .all()
          .then(
            (rows: any) =>
              (rows?.results || []) as {
                team_id: string;
                station_id: string;
                team_name: string;
                owner_name: string | null;
                shift_code: string | null;
                team_status: string | null;
              }[],
          )
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT zone_id, station_id, zone_type, zone_status, note
              FROM zones
              WHERE station_id = ?
                AND deleted_at IS NULL
              ORDER BY created_at ASC, zone_id ASC
            `,
          )
          .bind(stationId)
          .all()
          .then(
            (rows: any) =>
              (rows?.results || []) as {
                zone_id: string;
                station_id: string;
                zone_type: string;
                zone_status: string | null;
                note: string | null;
              }[],
          )
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                d.device_id,
                d.station_id,
                d.device_type,
                d.binding_role,
                d.owner_team_id,
                d.device_status,
                d.note,
                t.team_name AS owner_team_name
              FROM platform_devices d
              LEFT JOIN teams t ON t.team_id = d.owner_team_id
              WHERE d.station_id = ?
                AND d.deleted_at IS NULL
              ORDER BY d.created_at ASC, d.device_id ASC
            `,
          )
          .bind(stationId)
          .all()
          .then(
            (rows: any) =>
              (rows?.results || []) as Array<{
                device_id: string;
                station_id: string;
                device_type: string;
                binding_role: string;
                owner_team_id: string;
                device_status: string;
                note: string | null;
                owner_team_name: string | null;
              }>,
          )
      : Promise.resolve([]),
  ]);
  const resourceTeams = teamRows.map(mapDbTeamRowToResourceTeam);

  const resourceZones = zoneRows.map((row: ReturnType<typeof mapPlatformZoneRow>) => ({
    zone: row.zone_id,
    station: row.station_id,
    type: row.zone_type,
    status: normalizeResourceStatus(row.zone_status),
    ...(row.note ? { note: row.note } : {}),
  }));

  const resourceDevices = deviceRows.map(
    (row: {
      device_id: string;
      station_id: string;
      owner_team_id: string;
      owner_team_name: string | null;
      device_status: string;
    }) => ({
      code: row.device_id,
      station: row.station_id,
      owner: row.owner_team_name || row.owner_team_id || "未指定",
      status: normalizeResourceStatus(row.device_status),
    }),
  );

  return {
    resourceTeams,
    resourceZones,
    resourceDevices,
  };
}

const COMPLETED_TASK_STATUSES = new Set(["Completed", "Verified", "Closed"]);
const CLOSED_EXCEPTION_STATUSES = new Set(["Closed", "Resolved", "Done"]);
const CONTROL_LEVEL_LABELS: Record<string, string> = {
  strong_control: "强控制",
  collaborative_control: "协同控制",
  interface_visible: "接口可视",
  weak_control: "弱控制",
};
const PHASE_LABELS: Record<string, string> = {
  sample_priority: "样板优先",
  active: "已上线",
  onboarding: "接入中",
  pending: "待处理",
};

const STATION_REPORT_APPROVED_DOCUMENT_STATUSES = new Set([
  "Approved",
  "Accepted",
  "Verified",
  "Closed",
  "Released",
  "Uploaded",
  "运行中",
]);
const STATION_REPORT_ACTIVE_EXCEPTION_STATUSES = new Set([
  "Open",
  "待处理",
  "警戒",
  "阻塞",
]);
const STATION_REPORT_DONE_TASK_STATUSES = new Set([
  "Completed",
  "Verified",
  "Closed",
  "Done",
  "已完成",
]);
const STATION_REPORT_LOADING_TASK_PATTERN =
  /(装车|装机|Loaded|Loading|Ramp|组板|发车|出港收货|尾程)/i;
const STATION_REPORT_POD_TASK_PATTERN = /(POD|交付|签收|Delivery|Closed)/i;

const STATION_REPORT_DEFAULT_CARDS = [
  {
    title: "12 小时完成率",
    value: "91%",
    helper: "按站内任务完成时长统计",
    chip: "12H",
    color: "primary",
  },
  {
    title: "装车准确率",
    value: "98.2%",
    helper: "装车 / 机坪 / 转运任务复核一致率",
    chip: "Loading",
    color: "secondary",
  },
  {
    title: "POD 闭环率",
    value: "86.4%",
    helper: "已签收并完成归档的比例",
    chip: "POD",
    color: "success",
  },
  {
    title: "异常闭环时长",
    value: "6.8h",
    helper: "异常从提出到恢复的平均耗时",
    chip: "Recovery",
    color: "warning",
  },
];

const STATION_REPORT_DEFAULT_SHIFT_ROWS = [
  {
    shift: "URC 夜班",
    team: "URC Export Team",
    completed: "14 / 16",
    loadingAccuracy: "98%",
    podClosure: "N/A",
    exceptionAge: "2.1h",
  },
  {
    shift: "MME 白班",
    team: "MME Inbound Team A",
    completed: "11 / 13",
    loadingAccuracy: "97%",
    podClosure: "88%",
    exceptionAge: "4.3h",
  },
  {
    shift: "MME 交付班",
    team: "Destination Ops",
    completed: "9 / 10",
    loadingAccuracy: "N/A",
    podClosure: "91%",
    exceptionAge: "1.7h",
  },
];

const STATION_REPORT_DEFAULT_PDA_ROWS = [
  {
    metric: "接单时长",
    current: "2m 18s",
    target: "<= 5m",
    note: "任务派发到接单确认的样例时长。",
  },
  {
    metric: "到场时长",
    current: "6m 42s",
    target: "<= 10m",
    note: "接单到到达作业点的样例时长。",
  },
  {
    metric: "任务完成时长",
    current: "18m 05s",
    target: "<= 25m",
    note: "开始到完成的样例时长。",
  },
  {
    metric: "证据上传完整率",
    current: "92%",
    target: ">= 95%",
    note: "需照片/签字/扫码的任务样例口径。",
  },
  {
    metric: "异常首次反馈时长",
    current: "4m 10s",
    target: "<= 8m",
    note: "发现异常到首次上报的样例时长。",
  },
];

const STATION_REPORT_DEFAULT_FILE_ROWS = [
  {
    report: "关键文件缺失",
    object: "SE803 CBA / 436-10358585 POD",
    current: "2 条未满足放行条件",
    note: "对应 HG-01 与 HG-06。",
  },
  {
    report: "文件版本替换",
    object: "SE913 Manifest",
    current: "v2 生效 / v3 待发布",
    note: "用于演示替换、生效、回退。",
  },
  {
    report: "文件生效时间",
    object: "SE913 FFM / UWS",
    current: "2026-04-08 17:55 / 18:02",
    note: "用于演示文件驱动状态放行。",
  },
  {
    report: "下载与预览审计",
    object: "GOFONEW-020426-1 POD.pdf",
    current: "已预览 / 待归档",
    note: "当前只做前端动作记录。",
  },
];

type StationReportOutboundFlightRow = {
  flight_id: string;
  flight_no: string;
  origin_code: string;
  destination_code: string;
  runtime_status: string;
  etd_at: string | null;
};

type StationReportOutboundAwbRow = {
  awb_id: string;
  awb_no: string;
  shipment_id: string | null;
  flight_id: string;
};

function parseStationReportDate(value: unknown) {
  if (!value) return null;

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d{2}:\d{2}$/.test(text)) {
    const now = new Date();
    const [hours, minutes] = text.split(":").map(Number);
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
    );
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffStationReportHours(start: unknown, end: unknown = new Date()) {
  const startDate = parseStationReportDate(start);
  const endDate = parseStationReportDate(end);

  if (!startDate || !endDate) return null;

  return Math.max(0, (endDate.getTime() - startDate.getTime()) / 36e5);
}

function formatStationReportPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function formatStationReportHours(value: number) {
  return `${Math.round(value * 10) / 10}h`;
}

function formatStationReportMinutes(value: number) {
  return `${Math.max(0, Math.round(value))}m`;
}

function normalizeStationReportTaskRow(item: any) {
  const taskType = String(
    item?.task_type || item?.title || item?.taskType || "任务",
  ).trim();
  const executionNode = String(
    item?.execution_node || item?.node || item?.executionNode || "",
  ).trim();
  const teamName = String(
    item?.team_name ||
      item?.owner ||
      item?.assigned_team_id ||
      item?.assignedTeamId ||
      item?.team ||
      "未分配",
  ).trim();
  const shiftLabel =
    String(item?.shift_code || item?.shift || item?.team_shift || "").trim() ||
    (teamName.includes("URC") ? "夜班" : "白班");
  const taskStatus = String(
    item?.task_status || item?.status || item?.taskStatus || "待处理",
  ).trim();

  return {
    taskId: String(item?.task_id || item?.id || "").trim(),
    taskType,
    executionNode,
    relatedObjectType: String(
      item?.related_object_type || item?.relatedObjectType || "",
    ).trim(),
    relatedObjectId: String(
      item?.related_object_id || item?.relatedObjectId || "",
    ).trim(),
    teamId: String(
      item?.assigned_team_id || item?.team_id || item?.owner || "",
    ).trim(),
    teamName,
    shiftLabel,
    taskStatus,
    blockerCode: String(item?.blocker_code || item?.blocker || "").trim(),
    evidenceRequired: Boolean(
      item?.evidence_required || item?.evidenceRequired,
    ),
    createdAt: item?.created_at || item?.createdAt || null,
    completedAt:
      item?.completed_at ||
      item?.completedAt ||
      item?.verified_at ||
      item?.verifiedAt ||
      null,
    updatedAt:
      item?.updated_at ||
      item?.updatedAt ||
      item?.completedAt ||
      item?.verifiedAt ||
      item?.createdAt ||
      null,
    dueAt: item?.due_at || item?.dueAt || item?.due || null,
  };
}

function normalizeStationReportExceptionRow(item: any) {
  return {
    exceptionId: String(item?.exception_id || item?.id || "").trim(),
    relatedObjectType: String(
      item?.related_object_type || item?.relatedObjectType || "",
    ).trim(),
    relatedObjectId: String(
      item?.related_object_id || item?.relatedObjectId || "",
    ).trim(),
    linkedTaskId: String(
      item?.linked_task_id || item?.linkedTaskId || "",
    ).trim(),
    severity: String(item?.severity || item?.sla || "").trim(),
    ownerTeamId: String(item?.owner_team_id || item?.ownerTeamId || "").trim(),
    exceptionStatus: String(
      item?.exception_status || item?.status || item?.exceptionStatus || "Open",
    ).trim(),
    blockerFlag: Boolean(Number(item?.blocker_flag ?? item?.blockerFlag ?? 0)),
    rootCause: String(item?.root_cause || item?.rootCause || "").trim(),
    actionTaken: String(item?.action_taken || item?.actionTaken || "").trim(),
    exceptionType: String(
      item?.exception_type || item?.exceptionType || "",
    ).trim(),
    openedAt: item?.opened_at || item?.openedAt || null,
    closedAt: item?.closed_at || item?.closedAt || null,
  };
}

function normalizeStationReportDocumentRow(item: any) {
  return {
    documentId: String(item?.document_id || item?.documentId || "").trim(),
    documentType: String(
      item?.document_type || item?.type || item?.documentType || "",
    ).trim(),
    documentName: String(
      item?.document_name || item?.name || item?.documentName || "",
    ).trim(),
    relatedObjectType: String(
      item?.related_object_type || item?.relatedObjectType || "",
    ).trim(),
    relatedObjectId: String(
      item?.related_object_id || item?.relatedObjectId || "",
    ).trim(),
    relatedObjectLabel: String(
      item?.related_object_label ||
        item?.relatedObjectLabel ||
        item?.linkedTo ||
        item?.related_object_id ||
        "",
    ).trim(),
    parentDocumentId: String(
      item?.parent_document_id || item?.parentDocumentId || "",
    ).trim(),
    versionNo: String(
      item?.version_no || item?.version || item?.versionNo || "v1",
    ).trim(),
    documentStatus: String(
      item?.document_status ||
        item?.status ||
        item?.documentStatus ||
        "Pending",
    ).trim(),
    requiredForRelease: Boolean(
      item?.required_for_release || item?.requiredForRelease,
    ),
    uploadedAt:
      item?.uploaded_at || item?.uploadedAt || item?.updatedAt || null,
    updatedAt: item?.updated_at || item?.updatedAt || item?.uploadedAt || null,
    note: String(item?.note || "").trim(),
  };
}

function inferStationDocumentPreviewType(
  documentName: string,
  contentType = "",
) {
  const lowerName = String(documentName || "").toLowerCase();
  const lowerContentType = String(contentType || "").toLowerCase();

  if (lowerName.endsWith(".pdf") || lowerContentType.includes("pdf"))
    return "pdf";
  if (
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc") ||
    lowerContentType.includes("spreadsheet") ||
    lowerContentType.includes("wordprocessingml")
  ) {
    return "office";
  }

  if (
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerContentType.startsWith("image/")
  ) {
    return "image";
  }

  return "file";
}

function inferStationDocumentRoute(document: {
  relatedObjectType: string;
  relatedObjectLabel: string;
  relatedObjectId: string;
}) {
  if (document.relatedObjectType === "Flight") {
    const flightNo =
      document.relatedObjectLabel?.split(" / ")[0] || document.relatedObjectId;
    return flightNo
      ? `/station/inbound/flights/${encodeURIComponent(flightNo)}`
      : "/station/inbound/flights";
  }

  if (document.relatedObjectType === "AWB") {
    const awbNo =
      document.relatedObjectLabel?.split(" / ")[0] || document.relatedObjectId;
    return awbNo
      ? `/station/inbound/waybills/${encodeURIComponent(awbNo)}`
      : "/station/inbound/waybills";
  }

  if (document.relatedObjectType === "Task") {
    return "/station/tasks";
  }

  if (document.relatedObjectType === "Truck") {
    return "/station/resources/vehicles";
  }

  return "/station/shipments";
}

function formatStationDocumentTimestamp(value: string | null | undefined) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toISOString().slice(0, 16).replace("T", " ");
}

function parseStationDocumentVersion(versionNo: string) {
  const match = String(versionNo || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function buildStationDocumentOverview(
  documentRows: any[],
  versionRows: any[],
  gateRows: any[],
  templateRows: any[],
) {
  const rows = documentRows
    .map(normalizeStationReportDocumentRow)
    .filter((item) => item.documentId);
  const historyRows = (versionRows.length ? versionRows : documentRows)
    .map(normalizeStationReportDocumentRow)
    .filter((item) => item.documentId);
  const rowById = new Map(rows.map((item) => [item.documentId, item] as const));
  const rootByDocumentId = new Map<string, string>();

  const resolveRootDocumentId = (
    item: ReturnType<typeof normalizeStationReportDocumentRow>,
  ) => {
    if (rootByDocumentId.has(item.documentId)) {
      return rootByDocumentId.get(item.documentId) as string;
    }

    const seen = new Set<string>();
    let current = item;

    while (
      current.parentDocumentId &&
      rowById.has(current.parentDocumentId) &&
      !seen.has(current.parentDocumentId)
    ) {
      seen.add(current.documentId);
      current = rowById.get(current.parentDocumentId) as ReturnType<
        typeof normalizeStationReportDocumentRow
      >;
    }

    rootByDocumentId.set(item.documentId, current.documentId);
    return current.documentId;
  };

  const groupedRows = new Map<
    string,
    ReturnType<typeof normalizeStationReportDocumentRow>[]
  >();
  for (const item of rows) {
    const rootDocumentId = resolveRootDocumentId(item);
    if (!groupedRows.has(rootDocumentId)) {
      groupedRows.set(rootDocumentId, []);
    }
    groupedRows.get(rootDocumentId)?.push(item);
  }

  const versionGroups = new Map<
    string,
    ReturnType<typeof normalizeStationReportDocumentRow>[]
  >();
  if (versionRows.length) {
    for (const item of historyRows) {
      const versionGroupId = resolveRootDocumentId(item);
      if (!versionGroups.has(versionGroupId)) {
        versionGroups.set(versionGroupId, []);
      }
      versionGroups.get(versionGroupId)?.push(item);
    }
  }

  const normalizedGateRows = gateRows.map((item: any) => ({
    id: String(item?.id || item?.gateEvaluationId || item?.gateId || "").trim(),
    gateId: String(item?.gateId || item?.gate_id || "").trim(),
    direction: String(item?.direction || "").trim(),
    node: String(item?.node || "").trim(),
    required: String(item?.required || "").trim(),
    impact: String(item?.impact || "").trim(),
    status: String(item?.status || "").trim(),
    blocker: String(item?.blockingReason || item?.blocker || "").trim(),
    recovery: String(item?.recoveryAction || item?.recovery || "").trim(),
    releaseRole: String(item?.releaseRole || "").trim(),
    linkedDocumentIds: Array.isArray(item?.linkedDocumentIds)
      ? item.linkedDocumentIds
          .map((value: unknown) => String(value).trim())
          .filter(Boolean)
      : [],
  }));

  const documentGateEvaluationsByDocumentId = new Map<string, any[]>();
  for (const gateRow of normalizedGateRows) {
    for (const documentId of gateRow.linkedDocumentIds) {
      if (!documentGateEvaluationsByDocumentId.has(documentId)) {
        documentGateEvaluationsByDocumentId.set(documentId, []);
      }
      documentGateEvaluationsByDocumentId.get(documentId)?.push({
        gateId: gateRow.gateId,
        node: gateRow.node,
        required: gateRow.required,
        impact: gateRow.impact,
        status: gateRow.status,
        blocker: gateRow.blocker,
        recovery: gateRow.recovery,
        releaseRole: gateRow.releaseRole,
      });
    }
  }

  for (const [rootDocumentId, groupRows] of groupedRows.entries()) {
    const groupDocumentIds = new Set(groupRows.map((item) => item.documentId));
    const gateItems = normalizedGateRows
      .filter((gateRow) =>
        gateRow.linkedDocumentIds.some((documentId: string) =>
          groupDocumentIds.has(documentId),
        ),
      )
      .map((gateRow) => ({
        gateId: gateRow.gateId,
        node: gateRow.node,
        required: gateRow.required,
        impact: gateRow.impact,
        status: gateRow.status,
        blocker: gateRow.blocker,
        recovery: gateRow.recovery,
        releaseRole: gateRow.releaseRole,
      }));

    if (gateItems.length) {
      documentGateEvaluationsByDocumentId.set(rootDocumentId, gateItems);
      for (const documentId of groupDocumentIds) {
        documentGateEvaluationsByDocumentId.set(documentId, gateItems);
      }
    }
  }

  const buildVersionSummaries = (
    groupRows: ReturnType<typeof normalizeStationReportDocumentRow>[],
  ) => {
    const sortedRows = [...groupRows].sort((left, right) => {
      const versionDelta =
        parseStationDocumentVersion(left.versionNo) -
        parseStationDocumentVersion(right.versionNo);
      if (versionDelta !== 0) return versionDelta;

      const leftTime = String(left.updatedAt || left.uploadedAt || "");
      const rightTime = String(right.updatedAt || right.uploadedAt || "");
      if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);

      return left.documentId.localeCompare(right.documentId);
    });

    return sortedRows.map((item, index) => {
      const previous = sortedRows[index - 1] || null;
      const next = sortedRows[index + 1] || null;

      return {
        versionId: item.documentId,
        version: item.versionNo,
        status: item.documentStatus,
        updatedAt: formatStationDocumentTimestamp(
          item.updatedAt || item.uploadedAt,
        ),
        diffSummary: previous
          ? `较 ${previous.versionNo} 版本继续更新 ${item.documentType || "文件"}`
          : "首版登记",
        previewSummary:
          item.note ||
          `${item.documentType || "Document"} ${item.versionNo} 版本摘要`,
        previewType: inferStationDocumentPreviewType(item.documentName),
        sortOrder: index + 1,
        rollbackTarget: previous?.documentId || null,
        replacedBy: next?.documentId || null,
      };
    });
  };

  const stationDocuments = Array.from(groupedRows.entries())
    .map(([rootDocumentId, groupRows]) => {
      const versions = buildVersionSummaries(
        versionGroups.get(rootDocumentId) || groupRows,
      );
      const activeVersion =
        [...versions]
          .reverse()
          .find(
            (item) => item.status !== "Replaced" && item.status !== "历史版本",
          ) || versions.at(-1);
      const activeSource =
        groupRows.find(
          (item) => item.documentId === activeVersion?.versionId,
        ) ||
        groupRows.at(-1) ||
        groupRows[0];
      const gateIds = Array.from(
        new Set(
          (documentGateEvaluationsByDocumentId.get(rootDocumentId) || [])
            .map((item) => item.gateId)
            .filter(Boolean),
        ),
      );

      return {
        documentId: rootDocumentId,
        type: activeSource?.documentType || "--",
        name: activeSource?.documentName || "--",
        linkedTo:
          activeSource?.relatedObjectLabel ||
          activeSource?.relatedObjectId ||
          "--",
        version: activeSource?.versionNo || "--",
        updatedAt: formatStationDocumentTimestamp(
          activeSource?.updatedAt || activeSource?.uploadedAt,
        ),
        status: activeSource?.documentStatus || "Pending",
        activeVersionId:
          activeVersion?.versionId ||
          activeSource?.documentId ||
          rootDocumentId,
        previewType: inferStationDocumentPreviewType(
          activeSource?.documentName,
        ),
        nextStep: activeSource?.requiredForRelease ? "放行前校验" : "普通归档",
        gateIds,
        bindingTargets: [
          {
            label: `${activeSource?.relatedObjectType || "Object"} / ${activeSource?.relatedObjectLabel || activeSource?.relatedObjectId || "--"}`,
            to: inferStationDocumentRoute(
              activeSource || {
                relatedObjectType: "",
                relatedObjectLabel: "",
                relatedObjectId: "",
              },
            ),
          },
        ],
      };
    })
    .sort((left, right) =>
      String(right.updatedAt).localeCompare(String(left.updatedAt)),
    );

  const inboundDocumentGates = normalizedGateRows
    .filter((item) => item.direction === "进港")
    .slice(0, 3)
    .map((item) => ({
      gateId: item.gateId,
      node: item.node,
      required: item.required,
      impact: item.impact,
      status: item.status,
      blocker: item.blocker,
      recovery: item.recovery,
      releaseRole: item.releaseRole,
    }));

  const outboundDocumentGates = normalizedGateRows
    .filter((item) => item.direction === "出港")
    .slice(0, 3)
    .map((item) => ({
      gateId: item.gateId,
      node: item.node,
      required: item.required,
      impact: item.impact,
      status: item.status,
      blocker: item.blocker,
      recovery: item.recovery,
      releaseRole: item.releaseRole,
    }));

  const instructionTemplateRows = templateRows.map((item: any) => ({
    code: String(item?.code || item?.id || "").trim(),
    title: String(item?.title || item?.name || "").trim(),
    linkedNode: String(item?.linkedNode || item?.node || "").trim(),
    trigger: String(item?.trigger || "").trim(),
    evidence: String(item?.evidence || "").trim(),
  }));

  const documentVersionsByDocumentId = Object.fromEntries(
    Array.from(groupedRows.entries()).map(([rootDocumentId, groupRows]) => [
      rootDocumentId,
      buildVersionSummaries(versionGroups.get(rootDocumentId) || groupRows),
    ]),
  );

  return {
    stationDocuments,
    documentVersionsByDocumentId,
    documentGateEvaluationsByDocumentId: Object.fromEntries(
      Array.from(documentGateEvaluationsByDocumentId.entries()),
    ),
    inboundDocumentGates,
    outboundDocumentGates,
    instructionTemplateRows,
  };
}

function mapNoaStatusLabel(status: unknown) {
  const text = String(status || "").trim();
  if (text === "Failed" || text === "发送失败") return "发送失败";
  if (text === "Sent" || text === "已发送") return "已发送";
  return "待处理";
}

function mapNoaRetryLabel(status: unknown) {
  const text = String(status || "").trim();
  if (text === "Failed" || text === "发送失败") return "可重试";
  if (text === "Sent" || text === "已发送") return "无需";
  return "允许补发";
}

function mapPodStatusLabel(status: unknown) {
  const text = String(status || "").trim();
  if (text === "Released" || text === "已归档" || text === "Closed")
    return "已归档";
  if (text === "Uploaded" || text === "已上传") return "已上传";
  if (isPendingInboundStatus(text)) return "待补签";
  if (text === "警戒" || text === "阻塞") return text;
  return text || "待补签";
}

function mapPodRetryLabel(status: unknown) {
  const text = String(status || "").trim();
  if (text === "Released" || text === "已归档" || text === "Closed")
    return "无需";
  if (text === "Uploaded" || text === "已上传") return "允许人工补传";
  if (isPendingInboundStatus(text)) return "等待双签";
  return "允许人工补传";
}

function buildStationNoaOverview(
  noaRows: any[],
  gateRows: any[],
  policyRows: any[],
) {
  const noaNotifications = noaRows.map((item, index) => {
    const awb = String(item?.awb || item?.awb_no || item?.awbNo || "").trim();
    const rawStatus = pickRowValue(item, ["noa_status", "noaStatus", "status"]);
    const gateId =
      String(item?.gateId || item?.gate_id || "HG-03").trim() || "HG-03";

    return {
      id: String(item?.id || `NOA-${index + 1}`).trim() || `NOA-${index + 1}`,
      awbId: String(item?.awbId || item?.awb_id || "").trim(),
      awb,
      channel: String(item?.channel || "Email").trim() || "Email",
      target: String(item?.target || item?.consignee_name || "").trim() || "--",
      status:
        String(item?.status || mapNoaStatusLabel(rawStatus)).trim() ||
        mapNoaStatusLabel(rawStatus),
      retry:
        String(item?.retry || mapNoaRetryLabel(rawStatus)).trim() ||
        mapNoaRetryLabel(rawStatus),
      note:
        String(item?.note || item?.blocker_reason || "").trim() ||
        "根据当前提单状态决定是否允许发送",
      gateId,
      objectTo: String(
        item?.objectTo ||
          (awb
            ? `/station/inbound/waybills/${encodeURIComponent(awb)}`
            : "/station/inbound/waybills"),
      ).trim(),
    };
  });

  const relevantGateIds = new Set(
    noaNotifications.map((item) => item.gateId).filter(Boolean),
  );

  const normalizedGateRows = gateRows.map((item: any) => ({
    id: String(item?.id || item?.gateEvaluationId || item?.gateId || "").trim(),
    gateId: String(item?.gateId || item?.gate_id || "").trim(),
    node: String(item?.node || "").trim(),
    required: String(item?.required || "").trim(),
    impact: String(item?.impact || "").trim(),
    status: String(item?.status || "").trim(),
    blockingReason: String(item?.blockingReason || item?.blocker || "").trim(),
    recoveryAction: String(item?.recoveryAction || item?.recovery || "").trim(),
    releaseRole: String(item?.releaseRole || "").trim(),
  }));

  const normalizedPolicyRows = policyRows.map((item: any) => ({
    id: String(item?.id || item?.gateId || "").trim(),
    rule: String(item?.rule || "").trim(),
    triggerNode: String(item?.triggerNode || "").trim(),
    affectedModule: String(item?.affectedModule || "").trim(),
    blocker: String(item?.blocker || "").trim(),
    recovery: String(item?.recovery || "").trim(),
    releaseRole: String(item?.releaseRole || "").trim(),
  }));

  const gateEvaluationRows = relevantGateIds.size
    ? normalizedGateRows.filter((item) => relevantGateIds.has(item.gateId))
    : normalizedGateRows;
  const hardGatePolicyRows = relevantGateIds.size
    ? normalizedPolicyRows.filter((item) => relevantGateIds.has(item.id))
    : normalizedPolicyRows;

  return {
    noaNotifications,
    gateEvaluationRows,
    hardGatePolicyRows,
  };
}

function buildStationPodOverview(
  podRows: any[],
  gateRows: any[],
  policyRows: any[],
) {
  const podNotifications = podRows.map((item, index) => {
    const awb = String(item?.awb || item?.awb_no || item?.awbNo || "").trim();
    const rawStatus = pickRowValue(item, ["pod_status", "podStatus", "status"]);
    const gateId =
      String(item?.gateId || item?.gate_id || "HG-06").trim() || "HG-06";

    return {
      id: String(item?.id || `POD-${index + 1}`).trim() || `POD-${index + 1}`,
      awbId: String(item?.awbId || item?.awb_id || "").trim(),
      object:
        awb ||
        String(
          item?.object || item?.objectLabel || item?.awb_no || "",
        ).trim() ||
        "--",
      signer:
        String(
          item?.signer || item?.consignee_name || item?.target || "",
        ).trim() || "--",
      status:
        String(item?.status || mapPodStatusLabel(rawStatus)).trim() ||
        mapPodStatusLabel(rawStatus),
      retry:
        String(item?.retry || mapPodRetryLabel(rawStatus)).trim() ||
        mapPodRetryLabel(rawStatus),
      note:
        String(item?.note || item?.blocker_reason || "").trim() ||
        "根据签收和 POD 状态决定是否允许关闭",
      gateId,
      objectTo: String(
        item?.objectTo ||
          (awb
            ? `/station/inbound/waybills/${encodeURIComponent(awb)}`
            : "/station/inbound/waybills"),
      ).trim(),
    };
  });

  const relevantGateIds = new Set(
    podNotifications.map((item) => item.gateId).filter(Boolean),
  );

  const normalizedGateRows = gateRows.map((item: any) => ({
    id: String(item?.id || item?.gateEvaluationId || item?.gateId || "").trim(),
    gateId: String(item?.gateId || item?.gate_id || "").trim(),
    node: String(item?.node || "").trim(),
    required: String(item?.required || "").trim(),
    impact: String(item?.impact || "").trim(),
    status: String(item?.status || "").trim(),
    blockingReason: String(item?.blockingReason || item?.blocker || "").trim(),
    recoveryAction: String(item?.recoveryAction || item?.recovery || "").trim(),
    releaseRole: String(item?.releaseRole || "").trim(),
  }));

  const normalizedPolicyRows = policyRows.map((item: any) => ({
    id: String(item?.id || item?.gateId || "").trim(),
    rule: String(item?.rule || "").trim(),
    triggerNode: String(item?.triggerNode || "").trim(),
    affectedModule: String(item?.affectedModule || "").trim(),
    blocker: String(item?.blocker || "").trim(),
    recovery: String(item?.recovery || "").trim(),
    releaseRole: String(item?.releaseRole || "").trim(),
  }));

  const gateEvaluationRows = relevantGateIds.size
    ? normalizedGateRows.filter((item) => relevantGateIds.has(item.gateId))
    : normalizedGateRows;
  const hardGatePolicyRows = relevantGateIds.size
    ? normalizedPolicyRows.filter((item) => relevantGateIds.has(item.id))
    : normalizedPolicyRows;

  return {
    podNotifications,
    gateEvaluationRows,
    hardGatePolicyRows,
  };
}

function normalizeStationReportLoadingPlanRow(item: any) {
  return {
    transferId: String(
      item?.loading_plan_id || item?.transferId || item?.id || "",
    ).trim(),
    flightNo: String(item?.flight_no || item?.flightNo || "").trim(),
    truckPlate: String(item?.truck_plate || item?.plate || "").trim(),
    driverName: String(item?.driver_name || item?.driver || "").trim(),
    collectionNote: String(
      item?.collection_note || item?.collectionNote || item?.awb || "",
    ).trim(),
    status: String(item?.plan_status || item?.status || "").trim(),
    createdAt: item?.created_at || item?.createdAt || null,
    updatedAt: item?.updated_at || item?.updatedAt || null,
    arrivalTime:
      item?.arrival_time || item?.arrivalTime || item?.departAt || null,
    departTime: item?.depart_time || item?.departTime || item?.departAt || null,
  };
}

function normalizeStationReportAuditRow(item: any) {
  return {
    action: String(item?.action || "").trim(),
    objectType: String(item?.object_type || item?.objectType || "").trim(),
    objectId: String(item?.object_id || item?.objectId || "").trim(),
    summary: String(item?.summary || "").trim(),
    createdAt: item?.created_at || item?.createdAt || null,
  };
}

function parseAuditPayload(payloadJson: string | null) {
  if (!payloadJson) {
    return null;
  }

  try {
    return JSON.parse(payloadJson);
  } catch {
    return payloadJson;
  }
}

function isStationReportLoadingTask(task: {
  taskType: string;
  executionNode: string;
}) {
  return STATION_REPORT_LOADING_TASK_PATTERN.test(
    `${task.taskType} ${task.executionNode}`,
  );
}

function isStationReportPodTask(task: {
  taskType: string;
  executionNode: string;
}) {
  return STATION_REPORT_POD_TASK_PATTERN.test(
    `${task.taskType} ${task.executionNode}`,
  );
}

function isStationReportClosedDocument(document: { documentStatus: string }) {
  return STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(document.documentStatus);
}

function buildStationReportCards(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[],
  loadingPlans: ReturnType<typeof normalizeStationReportLoadingPlanRow>[],
) {
  if (
    !tasks.length &&
    !exceptions.length &&
    !documents.length &&
    !loadingPlans.length
  ) {
    return STATION_REPORT_DEFAULT_CARDS;
  }

  const completedTasks = tasks.filter(
    (item) =>
      STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
      COMPLETED_TASK_STATUSES.has(item.taskStatus),
  );
  const completedWithin12Hours = completedTasks.filter((item) => {
    const hours = diffStationReportHours(item.createdAt, item.completedAt);
    return hours !== null && hours <= 12;
  }).length;
  const completionRate = completedTasks.length
    ? completedWithin12Hours / completedTasks.length
    : 0;

  const loadingTasks = tasks.filter(isStationReportLoadingTask);
  const loadingSucceeded = loadingTasks.filter(
    (item) =>
      STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
      (!item.blockerCode &&
        !exceptions.some(
          (exception) =>
            exception.linkedTaskId === item.taskId &&
            STATION_REPORT_ACTIVE_EXCEPTION_STATUSES.has(
              exception.exceptionStatus,
            ),
        )),
  ).length;
  const loadingAccuracy = loadingTasks.length
    ? loadingSucceeded / loadingTasks.length
    : completionRate;

  const podDocuments = documents.filter((item) => item.documentType === "POD");
  const closedPodDocuments = podDocuments.filter(
    isStationReportClosedDocument,
  ).length;
  const podClosure = podDocuments.length
    ? closedPodDocuments / podDocuments.length
    : tasks
        .filter(isStationReportPodTask)
        .filter(
          (item) =>
            STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
            COMPLETED_TASK_STATUSES.has(item.taskStatus),
        ).length / Math.max(1, tasks.filter(isStationReportPodTask).length);

  const exceptionDurations = exceptions
    .filter(
      (item) =>
        STATION_REPORT_ACTIVE_EXCEPTION_STATUSES.has(item.exceptionStatus) ||
        CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus),
    )
    .map((item) => diffStationReportHours(item.openedAt, item.closedAt))
    .filter((value): value is number => value !== null);
  const avgExceptionAge = exceptionDurations.length
    ? exceptionDurations.reduce((sum, value) => sum + value, 0) /
      exceptionDurations.length
    : 0;

  return [
    {
      title: "12 小时完成率",
      value: formatStationReportPercent(completionRate * 100),
      helper: "按站内任务完成时长统计",
      chip: "12H",
      color: "primary",
    },
    {
      title: "装车准确率",
      value: formatStationReportPercent(loadingAccuracy * 100),
      helper: "装车 / 机坪 / 转运任务复核一致率",
      chip: "Loading",
      color: "secondary",
    },
    {
      title: "POD 闭环率",
      value: formatStationReportPercent(podClosure * 100),
      helper: "已签收并完成归档的比例",
      chip: "POD",
      color: "success",
    },
    {
      title: "异常闭环时长",
      value: formatStationReportHours(avgExceptionAge || 0),
      helper: "异常从提出到恢复的平均耗时",
      chip: "Recovery",
      color: "warning",
    },
  ];
}

function buildStationReportShiftRows(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[],
) {
  if (!tasks.length && !exceptions.length && !documents.length) {
    return STATION_REPORT_DEFAULT_SHIFT_ROWS;
  }

  const taskGroups = new Map<
    string,
    {
      shift: string;
      team: string;
      tasks: ReturnType<typeof normalizeStationReportTaskRow>[];
    }
  >();

  for (const task of tasks) {
    const key = task.teamId || task.teamName;
    if (!taskGroups.has(key)) {
      taskGroups.set(key, {
        shift: task.shiftLabel,
        team: task.teamName,
        tasks: [],
      });
    }
    taskGroups.get(key)?.tasks.push(task);
  }

  const rows = Array.from(taskGroups.values())
    .map((group) => {
      const teamTasks = group.tasks;
      const completedTasks = teamTasks.filter(
        (item) =>
          STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
          COMPLETED_TASK_STATUSES.has(item.taskStatus),
      );
      const loadingTasks = teamTasks.filter(isStationReportLoadingTask);
      const loadingCompleted = loadingTasks.filter(
        (item) =>
          STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
          COMPLETED_TASK_STATUSES.has(item.taskStatus),
      ).length;
      const podTasks = teamTasks.filter(isStationReportPodTask);
      const podCompleted = podTasks.filter(
        (item) =>
          STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
          COMPLETED_TASK_STATUSES.has(item.taskStatus),
      ).length;
      const relatedExceptionDurations = exceptions
        .filter(
          (exception) =>
            exception.ownerTeamId === group.team ||
            teamTasks.some(
              (task) =>
                task.taskId === exception.linkedTaskId ||
                task.relatedObjectId === exception.relatedObjectId,
            ),
        )
        .map((exception) =>
          diffStationReportHours(exception.openedAt, exception.closedAt),
        )
        .filter((value): value is number => value !== null);
      const avgExceptionAge = relatedExceptionDurations.length
        ? relatedExceptionDurations.reduce((sum, value) => sum + value, 0) /
          relatedExceptionDurations.length
        : 0;

      return {
        shift: group.shift || "白班",
        team: group.team || "未分配",
        completed: `${completedTasks.length} / ${teamTasks.length}`,
        loadingAccuracy: loadingTasks.length
          ? formatStationReportPercent(
              (loadingCompleted / loadingTasks.length) * 100,
            )
          : "N/A",
        podClosure: podTasks.length
          ? formatStationReportPercent((podCompleted / podTasks.length) * 100)
          : "N/A",
        exceptionAge: avgExceptionAge
          ? formatStationReportHours(avgExceptionAge)
          : "N/A",
      };
    })
    .sort((left, right) => left.shift.localeCompare(right.shift));

  return rows.length ? rows.slice(0, 3) : STATION_REPORT_DEFAULT_SHIFT_ROWS;
}

function buildStationReportPdaRows(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  loadingPlans: ReturnType<typeof normalizeStationReportLoadingPlanRow>[],
) {
  if (!tasks.length && !exceptions.length && !loadingPlans.length) {
    return STATION_REPORT_DEFAULT_PDA_ROWS;
  }

  const taskLeadTimes = tasks
    .map((item) => diffStationReportHours(item.createdAt, item.completedAt))
    .filter((value): value is number => value !== null);
  const arrivalLeadTimes = loadingPlans
    .map((item) =>
      diffStationReportHours(
        item.createdAt,
        item.arrivalTime || item.departTime,
      ),
    )
    .filter((value): value is number => value !== null);
  const completedTasks = tasks.filter(
    (item) =>
      STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
      COMPLETED_TASK_STATUSES.has(item.taskStatus),
  );
  const evidenceRequiredTasks = tasks.filter((item) => item.evidenceRequired);
  const evidenceFulfilled = evidenceRequiredTasks.filter(
    (item) =>
      STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
      COMPLETED_TASK_STATUSES.has(item.taskStatus),
  ).length;
  const linkedExceptionResponseTimes = exceptions
    .map((item) => diffStationReportHours(item.openedAt, item.closedAt))
    .filter((value): value is number => value !== null);

  const avgReceiptMinutes = taskLeadTimes.length
    ? (taskLeadTimes.reduce((sum, value) => sum + value, 0) * 60) /
      taskLeadTimes.length
    : 0;
  const avgArrivalMinutes = arrivalLeadTimes.length
    ? (arrivalLeadTimes.reduce((sum, value) => sum + value, 0) * 60) /
      arrivalLeadTimes.length
    : 0;
  const avgCompletionMinutes = completedTasks.length
    ? (completedTasks
        .map((item) => diffStationReportHours(item.createdAt, item.completedAt))
        .filter((value): value is number => value !== null)
        .reduce((sum, value, _, array) => sum + value, 0) *
        60) /
      Math.max(
        1,
        completedTasks.filter(
          (item) =>
            diffStationReportHours(item.createdAt, item.completedAt) !== null,
        ).length,
      )
    : 0;
  const evidenceRate = evidenceRequiredTasks.length
    ? (evidenceFulfilled / evidenceRequiredTasks.length) * 100
    : 0;
  const avgExceptionMinutes = linkedExceptionResponseTimes.length
    ? (linkedExceptionResponseTimes.reduce((sum, value) => sum + value, 0) *
        60) /
      linkedExceptionResponseTimes.length
    : 0;

  return [
    {
      metric: "接单时长",
      current: formatStationReportMinutes(avgReceiptMinutes || 0),
      target: "<= 5m",
      note: "任务派发到接单确认的平均时长。",
    },
    {
      metric: "到场时长",
      current: formatStationReportMinutes(avgArrivalMinutes || 0),
      target: "<= 10m",
      note: "任务创建到到场/到站回传的平均时长。",
    },
    {
      metric: "任务完成时长",
      current: formatStationReportMinutes(avgCompletionMinutes || 0),
      target: "<= 25m",
      note: "开始到完成的平均时长。",
    },
    {
      metric: "证据上传完整率",
      current: formatStationReportPercent(evidenceRate || 0),
      target: ">= 95%",
      note: "需照片 / 签字 / 扫码的任务样例口径。",
    },
    {
      metric: "异常首次反馈时长",
      current: formatStationReportMinutes(avgExceptionMinutes || 0),
      target: "<= 8m",
      note: "发现异常到首次反馈的平均时长。",
    },
  ];
}

function buildStationReportFileRows(
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[],
  audits: ReturnType<typeof normalizeStationReportAuditRow>[],
) {
  if (!documents.length && !audits.length) {
    return STATION_REPORT_DEFAULT_FILE_ROWS;
  }

  const requiredDocuments = documents.filter((item) => item.requiredForRelease);
  const missingRequiredDocuments = requiredDocuments.filter(
    (item) =>
      !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus),
  );
  const documentGroups = new Map<
    string,
    ReturnType<typeof normalizeStationReportDocumentRow>[]
  >();

  for (const document of documents) {
    const key = `${document.documentType}::${document.relatedObjectId || document.relatedObjectType}`;
    if (!documentGroups.has(key)) {
      documentGroups.set(key, []);
    }
    documentGroups.get(key)?.push(document);
  }

  const replacementCandidates = Array.from(documentGroups.values())
    .map((group) =>
      group
        .slice()
        .sort((left, right) =>
          (right.updatedAt || right.uploadedAt || "").localeCompare(
            left.updatedAt || left.uploadedAt || "",
          ),
        ),
    )
    .find((group) => group.length > 1);
  const latestReplacement = replacementCandidates?.[0];
  const previousReplacement = replacementCandidates?.[1];

  const criticalDocuments = documents.filter((item) =>
    ["FFM", "UWS", "Manifest", "POD", "CBA", "MAWB"].includes(
      item.documentType,
    ),
  );
  const latestCriticalDocuments = criticalDocuments
    .slice()
    .sort((left, right) =>
      (right.updatedAt || right.uploadedAt || "").localeCompare(
        left.updatedAt || left.uploadedAt || "",
      ),
    )
    .slice(0, 2);

  const previewActions = audits.filter(
    (item) =>
      item.objectType === "Document" &&
      /(preview|download|open|view|预览|下载)/i.test(
        `${item.action} ${item.summary}`,
      ),
  );
  const latestPreviewAction = previewActions[0];

  return [
    {
      report: "关键文件缺失",
      object: requiredDocuments[0]
        ? `${requiredDocuments[0].documentType} / ${requiredDocuments[0].relatedObjectId || requiredDocuments[0].relatedObjectType}`
        : "关键放行文件",
      current: `${missingRequiredDocuments.length} 条未满足放行条件`,
      note: `覆盖 ${requiredDocuments.length} 份关键文档。`,
    },
    {
      report: "文件版本替换",
      object: latestReplacement
        ? `${latestReplacement.documentType} / ${latestReplacement.relatedObjectId || latestReplacement.relatedObjectType}`
        : "文件版本链",
      current:
        latestReplacement && previousReplacement
          ? `${previousReplacement.versionNo} 生效 / ${latestReplacement.versionNo} 待发布`
          : latestReplacement
            ? `${latestReplacement.versionNo} 最新`
            : "暂无版本替换",
      note: latestReplacement
        ? `最新文件 ${latestReplacement.documentName || latestReplacement.documentId}`
        : "暂无可用文件版本。",
    },
    {
      report: "文件生效时间",
      object:
        latestCriticalDocuments.map((item) => item.documentType).join(" / ") ||
        "关键文件",
      current: latestCriticalDocuments
        .map((item) => formatOverviewTime(item.updatedAt || item.uploadedAt))
        .join(" / "),
      note: "按最近更新的关键文件排序。",
    },
    {
      report: "下载与预览审计",
      object: latestPreviewAction
        ? `${latestPreviewAction.objectType} / ${latestPreviewAction.objectId}`
        : "Document / 审计",
      current: `${previewActions.length} 次预览 / ${audits.filter((item) => item.objectType === "Document" && /download/i.test(item.action)).length} 次下载`,
      note: latestPreviewAction
        ? `最近动作：${latestPreviewAction.summary || latestPreviewAction.action}`
        : "当前只做前端动作记录。",
    },
  ];
}

function buildStationOutboundActionRows(
  flights: StationReportOutboundFlightRow[],
  awbs: StationReportOutboundAwbRow[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[],
  audits: ReturnType<typeof normalizeStationReportAuditRow>[],
) {
  return flights.slice(0, 4).map((flight) => {
    const flightAwbs = awbs.filter(
      (item) => item.flight_id === flight.flight_id,
    );
    const awbIds = new Set(flightAwbs.map((item) => item.awb_id));
    const shipmentIds = new Set(
      flightAwbs.map((item) => item.shipment_id).filter(Boolean),
    );
    const openBlockingExceptions = exceptions.filter((item) => {
      if (
        CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus) ||
        !item.blockerFlag
      )
        return false;
      if (item.relatedObjectType === "Flight")
        return item.relatedObjectId === flight.flight_id;
      if (item.relatedObjectType === "AWB")
        return awbIds.has(item.relatedObjectId);
      if (item.relatedObjectType === "Shipment")
        return shipmentIds.has(item.relatedObjectId);
      return false;
    });
    const relatedDocuments = documents.filter((item) => {
      if (item.relatedObjectType === "Flight")
        return item.relatedObjectId === flight.flight_id;
      if (item.relatedObjectType === "AWB")
        return awbIds.has(item.relatedObjectId);
      if (item.relatedObjectType === "Shipment")
        return shipmentIds.has(item.relatedObjectId);
      return false;
    });
    const missingRequiredDocuments = relatedDocuments.filter(
      (item) =>
        item.requiredForRelease &&
        !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus),
    );
    const flightAudits = audits.filter(
      (item) =>
        item.objectType === "Flight" && item.objectId === flight.flight_id,
    );
    const loadedDone = flightAudits.some(
      (item) => item.action === "OUTBOUND_FLIGHT_LOADED",
    );
    const manifestDone = flightAudits.some(
      (item) => item.action === "OUTBOUND_MANIFEST_FINALIZED",
    );
    const airborneDone = flightAudits.some(
      (item) => item.action === "OUTBOUND_FLIGHT_AIRBORNE",
    );
    const blockerReasons = [
      ...openBlockingExceptions.map(
        (item) => `${item.exceptionType} / ${item.exceptionId}`,
      ),
      ...missingRequiredDocuments.map((item) => `${item.documentType} 待放行`),
    ];
    const latestAudit = flightAudits[0];

    return {
      flightNo: flight.flight_no,
      destination: flight.destination_code,
      etd: formatOverviewTime(flight.etd_at),
      status: airborneDone
        ? "Airborne"
        : manifestDone
          ? "Manifest Finalized"
          : loadedDone
            ? "Loaded"
            : flight.runtime_status,
      actionProgress: [
        loadedDone ? "Loaded" : "Loaded Pending",
        manifestDone ? "Manifest OK" : "Manifest Pending",
        airborneDone ? "Airborne" : "Airborne Pending",
      ].join(" / "),
      blockers: blockerReasons.join(" / ") || "无阻断",
      blockerExceptionId: openBlockingExceptions[0]?.exceptionId || "",
      lastAudit: latestAudit
        ? `${latestAudit.action} · ${formatOverviewTime(latestAudit.createdAt)}`
        : "暂无动作审计",
      flightRoute: `/station/outbound/flights/${encodeURIComponent(flight.flight_no)}`,
      exceptionRoute: openBlockingExceptions[0]
        ? `/station/exceptions/${encodeURIComponent(openBlockingExceptions[0].exceptionId)}`
        : "",
    };
  });
}

async function loadStationReportsOverview(db: any, stationId: string) {
  const tasksResult = db
    ? await db
        .prepare(
          `
            SELECT
              t.task_id,
              t.station_id,
              t.task_type,
              t.execution_node,
              t.related_object_type,
              t.related_object_id,
              t.assigned_role,
              t.assigned_team_id,
              t.assigned_worker_id,
              t.task_status,
              t.task_sla,
              t.due_at,
              t.blocker_code,
              t.evidence_required,
              t.created_at,
              t.completed_at,
              t.verified_at,
              tm.team_name,
              tm.shift_code
            FROM tasks t
            LEFT JOIN teams tm ON tm.team_id = t.assigned_team_id
            WHERE t.station_id = ?
            ORDER BY COALESCE(t.due_at, t.updated_at, t.created_at) ASC, t.created_at DESC
          `,
        )
        .bind(stationId)
        .all()
        .then((rows: any) => (rows?.results || []) as any[])
    : [];
  const exceptionsResult = db
    ? await db
        .prepare(
          `
            SELECT
              exception_id,
              station_id,
              exception_type,
              related_object_type,
              related_object_id,
              linked_task_id,
              severity,
              owner_role,
              owner_team_id,
              exception_status,
              blocker_flag,
              root_cause,
              action_taken,
              opened_at,
              closed_at
            FROM exceptions
            WHERE station_id = ?
            ORDER BY opened_at DESC, created_at DESC
          `,
        )
        .bind(stationId)
        .all()
        .then((rows: any) => (rows?.results || []) as any[])
    : [];
  const documentsResult = db
    ? await db
        .prepare(
          `
            SELECT
              document_id,
              station_id,
              document_type,
              document_name,
              related_object_type,
              related_object_id,
              parent_document_id,
              version_no,
              document_status,
              required_for_release,
              uploaded_at,
              updated_at,
              note
            FROM documents
            WHERE station_id = ?
            ORDER BY updated_at DESC, uploaded_at DESC
          `,
        )
        .bind(stationId)
        .all()
        .then((rows: any) => (rows?.results || []) as any[])
    : [];
  const loadingPlansResult = db
    ? await db
        .prepare(
          `
            SELECT
              loading_plan_id,
              station_id,
              flight_no,
              truck_plate,
              driver_name,
              collection_note,
              arrival_time,
              depart_time,
              plan_status,
              created_at,
              updated_at
            FROM loading_plans
            WHERE station_id = ?
            ORDER BY COALESCE(depart_time, arrival_time, updated_at, created_at) DESC
          `,
        )
        .bind(stationId)
        .all()
        .then((rows: any) => (rows?.results || []) as any[])
    : [];
  const auditsResult = db
    ? await db
        .prepare(
          `
            SELECT
              audit_id,
              actor_id,
              actor_role,
              station_id,
              action,
              object_type,
              object_id,
              summary,
              created_at
            FROM audit_events
            WHERE station_id = ?
            ORDER BY created_at DESC, audit_id DESC
            LIMIT 60
          `,
        )
        .bind(stationId)
        .all()
        .then((rows: any) => (rows?.results || []) as any[])
    : [];
  const outboundFlightsResult = db
    ? await db
        .prepare(
          `
            SELECT
              flight_id,
              flight_no,
              origin_code,
              destination_code,
              runtime_status,
              etd_at
            FROM flights
            WHERE station_id = ?
              AND origin_code = ?
            ORDER BY COALESCE(etd_at, updated_at, created_at) DESC, flight_no DESC
          `,
        )
        .bind(stationId, stationId)
        .all()
        .then(
          (rows: any) =>
            (rows?.results || []) as StationReportOutboundFlightRow[],
        )
    : [];
  const outboundAwbsResult = db
    ? await db
        .prepare(
          `
            SELECT
              awb_id,
              awb_no,
              shipment_id,
              flight_id
            FROM awbs
            WHERE station_id = ?
              AND flight_id IN (
                SELECT flight_id
                FROM flights
                WHERE station_id = ?
                  AND origin_code = ?
              )
          `,
        )
        .bind(stationId, stationId, stationId)
        .all()
        .then(
          (rows: any) => (rows?.results || []) as StationReportOutboundAwbRow[],
        )
    : [];
  const liveTasks = tasksResult.map(normalizeStationReportTaskRow);
  const liveExceptions = exceptionsResult.map(
    normalizeStationReportExceptionRow,
  );
  const liveDocuments = documentsResult.map(normalizeStationReportDocumentRow);
  const liveLoadingPlans = loadingPlansResult.map(
    normalizeStationReportLoadingPlanRow,
  );
  const liveAudits = auditsResult.map(normalizeStationReportAuditRow);

  const tasks = liveTasks;
  const exceptions = liveExceptions;
  const documents = liveDocuments;
  const loadingPlans = liveLoadingPlans;
  const audits = liveAudits;
  const outboundActionRows = buildStationOutboundActionRows(
    outboundFlightsResult,
    outboundAwbsResult,
    exceptions,
    documents,
    audits,
  );

  return {
    stationId,
    stationReportCards: buildStationReportCards(
      tasks,
      exceptions,
      documents,
      loadingPlans,
    ),
    shiftReportRows: buildStationReportShiftRows(tasks, exceptions, documents),
    pdaKpiRows: buildStationReportPdaRows(tasks, exceptions, loadingPlans),
    stationFileReportRows: buildStationReportFileRows(documents, audits),
    outboundActionRows,
  };
}

const REPORT_TIME_ZONE = "UTC";

function normalizeDailyReportDate(value: unknown, fallbackDate = new Date()) {
  const text = String(value || "").trim();
  if (text && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return fallbackDate.toISOString().slice(0, 10);
}

function buildDailyReportAnchor(reportDate: string) {
  return `${reportDate}T23:59:59.999Z`;
}

function buildDailyRefreshPolicyRows(
  scopeLabel: string,
  reportDate: string,
  reportAnchor: string,
) {
  return [
    {
      section: "刷新规则",
      metric: "日终锚点",
      current: reportAnchor,
      note: `${scopeLabel}日报按 ${reportDate} 日终锚点冻结统计窗口`,
    },
    {
      section: "刷新规则",
      metric: "默认刷新模式",
      current: "全量重算",
      note: "daily 接口按 reportDate 重新聚合同日对象、审计与质量结果",
    },
    {
      section: "刷新规则",
      metric: "补算范围",
      current: `${scopeLabel} + 日期`,
      note: "仅允许在同一 reportDate 内补算，不跨日扩散",
    },
  ];
}

function buildDailyTraceabilityRows(scopeLabel: string) {
  return [
    {
      section: "追溯关系",
      metric: "质量回链",
      current: "qualitySummary / qualityChecklist",
      note: `${scopeLabel}日报必须显式暴露质量摘要与检查表`,
    },
    {
      section: "追溯关系",
      metric: "对象回链",
      current: "Flight / AWB / Shipment / Exception",
      note: "关键指标应可回查到对象详情页",
    },
    {
      section: "追溯关系",
      metric: "审计回链",
      current: "audit/object / audit/events",
      note: "关键状态变化与导入链必须能回查到审计事件",
    },
  ];
}

function buildCountRows(items: any[], selector: (item: any) => string) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = String(selector(item) || "").trim() || "未分类";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .map(([label, count]) => ({
      label,
      count,
    }));
}

function buildStationDailyTaskRows(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
) {
  return tasks
    .filter(
      (item) =>
        !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) &&
        !COMPLETED_TASK_STATUSES.has(item.taskStatus),
    )
    .sort((left, right) =>
      String(left.dueAt || "9999-12-31").localeCompare(
        String(right.dueAt || "9999-12-31"),
      ),
    )
    .slice(0, 4)
    .map((item) => ({
      id: item.taskId,
      title: item.taskType,
      node: item.executionNode || "--",
      owner: item.teamName || item.teamId || item.shiftLabel || "未分配",
      status: item.taskStatus,
      due: formatOverviewTime(item.dueAt),
      blocker: item.blockerCode || "无",
    }));
}

function buildStationDailyBlockerRows(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[],
) {
  const blockedTasks = tasks
    .filter(
      (item) =>
        !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) &&
        !COMPLETED_TASK_STATUSES.has(item.taskStatus) &&
        item.blockerCode,
    )
    .slice(0, 2)
    .map((item) => ({
      id: item.taskId,
      title: `${item.taskType} · ${item.blockerCode}`,
      description: item.executionNode || item.relatedObjectId || "待处理任务",
      status: "阻塞",
      meta: `${item.teamName || item.teamId || item.shiftLabel || "未分配"} · 截止 ${formatOverviewTime(item.dueAt)}`,
    }));

  const openExceptions = exceptions
    .filter(
      (item) =>
        !CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus) &&
        item.blockerFlag,
    )
    .slice(0, 2)
    .map((item) => ({
      id: item.exceptionId,
      title: `${item.relatedObjectType || "异常"} · ${item.exceptionId}`,
      description:
        item.rootCause ||
        item.actionTaken ||
        item.exceptionType ||
        "待补充异常说明",
      status: "警戒",
      meta: `${item.severity || "P2"} · ${formatOverviewTime(item.openedAt)}`,
    }));

  const missingDocuments = documents
    .filter(
      (item) =>
        item.requiredForRelease &&
        !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus),
    )
    .slice(0, 2)
    .map((item) => ({
      id: item.documentId,
      title: `${item.documentType} · ${item.documentName}`,
      description:
        item.note ||
        item.relatedObjectLabel ||
        item.relatedObjectId ||
        "关键文件待补齐",
      status: "待补齐",
      meta: `${item.documentStatus} · ${formatOverviewTime(item.updatedAt || item.uploadedAt)}`,
    }));

  return [...blockedTasks, ...openExceptions, ...missingDocuments].slice(0, 4);
}

function buildStationDailyRows(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[],
  loadingPlans: ReturnType<typeof normalizeStationReportLoadingPlanRow>[],
  audits: ReturnType<typeof normalizeStationReportAuditRow>[],
  reportAnchor: string,
) {
  const reportAnchorTime = new Date(reportAnchor).getTime();
  const completedTasks = tasks.filter(
    (item) =>
      STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
      COMPLETED_TASK_STATUSES.has(item.taskStatus),
  );
  const blockedTasks = tasks.filter(
    (item) =>
      !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) &&
      !COMPLETED_TASK_STATUSES.has(item.taskStatus) &&
      item.blockerCode,
  );
  const overdueTasks = tasks.filter(
    (item) =>
      !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) &&
      !COMPLETED_TASK_STATUSES.has(item.taskStatus) &&
      item.dueAt &&
      new Date(String(item.dueAt)).getTime() < reportAnchorTime,
  ).length;
  const openExceptions = exceptions.filter(
    (item) => !CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus),
  );
  const blockingExceptions = exceptions.filter(
    (item) =>
      !CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus) && item.blockerFlag,
  );
  const requiredDocuments = documents.filter((item) => item.requiredForRelease);
  const missingDocuments = requiredDocuments.filter(
    (item) =>
      !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus),
  );
  const approvedDocuments = requiredDocuments.length - missingDocuments.length;
  const evidenceRequiredTasks = tasks.filter((item) => item.evidenceRequired);
  const evidenceFulfilled = evidenceRequiredTasks.filter(
    (item) =>
      STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
      COMPLETED_TASK_STATUSES.has(item.taskStatus),
  ).length;

  const avgReceiptMinutes = tasks.length
    ? (tasks
        .map((item) =>
          diffStationReportHours(
            item.createdAt,
            item.completedAt || item.updatedAt,
          ),
        )
        .filter((value): value is number => value !== null)
        .reduce((sum, value) => sum + value, 0) *
        60) /
      Math.max(
        tasks.filter(
          (item) =>
            diffStationReportHours(
              item.createdAt,
              item.completedAt || item.updatedAt,
            ) !== null,
        ).length,
        1,
      )
    : 0;
  const avgArrivalMinutes = loadingPlans.length
    ? (loadingPlans
        .map((item) =>
          diffStationReportHours(
            item.createdAt,
            item.arrivalTime || item.departTime || item.updatedAt,
          ),
        )
        .filter((value): value is number => value !== null)
        .reduce((sum, value) => sum + value, 0) *
        60) /
      Math.max(
        loadingPlans.filter(
          (item) =>
            diffStationReportHours(
              item.createdAt,
              item.arrivalTime || item.departTime || item.updatedAt,
            ) !== null,
        ).length,
        1,
      )
    : 0;
  const avgCompletionMinutes = completedTasks.length
    ? (completedTasks
        .map((item) =>
          diffStationReportHours(
            item.createdAt,
            item.completedAt || item.updatedAt,
          ),
        )
        .filter((value): value is number => value !== null)
        .reduce((sum, value) => sum + value, 0) *
        60) /
      Math.max(
        completedTasks.filter(
          (item) =>
            diffStationReportHours(
              item.createdAt,
              item.completedAt || item.updatedAt,
            ) !== null,
        ).length,
        1,
      )
    : 0;
  const avgExceptionMinutes = exceptions.length
    ? (exceptions
        .map((item) => diffStationReportHours(item.openedAt, item.closedAt))
        .filter((value): value is number => value !== null)
        .reduce((sum, value) => sum + value, 0) *
        60) /
      Math.max(
        exceptions.filter(
          (item) =>
            diffStationReportHours(item.openedAt, item.closedAt) !== null,
        ).length,
        1,
      )
    : 0;

  return [
    {
      section: "任务流转",
      metric: "完成 / 阻断 / 超时",
      current: `${completedTasks.length} / ${blockedTasks.length} / ${overdueTasks}`,
      note: `${tasks.length} 个日报任务已纳入当日范围`,
    },
    {
      section: "异常分布",
      metric: "开放 / 阻断 / 已关闭",
      current: `${openExceptions.length} / ${blockingExceptions.length} / ${Math.max(exceptions.length - openExceptions.length, 0)}`,
      note:
        buildCountRows(exceptions, (item) => item.severity || "未分级")
          .map((row) => `${row.label} ${row.count}`)
          .join(" / ") || "暂无异常",
    },
    {
      section: "文档闭环",
      metric: "关键 / 已批 / 缺失",
      current: `${requiredDocuments.length} / ${approvedDocuments} / ${missingDocuments.length}`,
      note: requiredDocuments.length
        ? `${audits.length} 条审计事件参与文件回看`
        : "暂无关键文件",
    },
    {
      section: "PDA 关键指标",
      metric: "接单 / 到场 / 完成",
      current: `${formatStationReportMinutes(avgReceiptMinutes || 0)} / ${formatStationReportMinutes(avgArrivalMinutes || 0)} / ${formatStationReportMinutes(avgCompletionMinutes || 0)}`,
      note: `证据上传完整率 ${formatStationReportPercent((evidenceRequiredTasks.length ? evidenceFulfilled / evidenceRequiredTasks.length : 0) * 100)} · 异常首次反馈 ${formatStationReportMinutes(avgExceptionMinutes || 0)}`,
    },
  ];
}

function buildPlatformDailyStationRows(
  stations: Array<{
    station_id: string;
    station_name: string;
    control_level: string | null;
    phase: string | null;
  }>,
  stationHealthRows: Array<{
    code: string;
    name: string;
    control: string;
    phase: string;
    readiness: number;
    blockingReason: string;
  }>,
  tasks: Array<{
    station_id: string;
    task_status: string;
    blocker_code: string | null;
    due_at: string | null;
    task_type: string;
    execution_node: string;
    related_object_type: string;
    related_object_id: string;
    assigned_role: string | null;
    assigned_team_id: string | null;
    assigned_worker_id: string | null;
  }>,
  exceptions: Array<{
    station_id: string;
    exception_status: string;
    blocker_flag: number | string;
    severity: string;
    root_cause: string | null;
    action_taken: string | null;
    opened_at: string | null;
    closed_at: string | null;
  }>,
  documents: Array<{
    station_id: string;
    document_type: string;
    document_status: string;
    required_for_release: number | boolean | null;
    updated_at: string | null;
    uploaded_at: string | null;
    created_at?: string | null;
  }>,
  reportAnchor: string,
) {
  const stationCatalog = new Map(
    stations.map((item) => [item.station_id, item] as const),
  );
  const healthByCode = new Map(
    stationHealthRows.map((item) => [item.code, item] as const),
  );
  const taskGroups = new Map<string, typeof tasks>();
  const exceptionGroups = new Map<string, typeof exceptions>();
  const documentGroups = new Map<string, typeof documents>();

  for (const task of tasks) {
    if (!taskGroups.has(task.station_id)) {
      taskGroups.set(task.station_id, []);
    }
    taskGroups.get(task.station_id)?.push(task);
  }

  for (const exception of exceptions) {
    if (!exceptionGroups.has(exception.station_id)) {
      exceptionGroups.set(exception.station_id, []);
    }
    exceptionGroups.get(exception.station_id)?.push(exception);
  }

  for (const document of documents) {
    if (!documentGroups.has(document.station_id)) {
      documentGroups.set(document.station_id, []);
    }
    documentGroups.get(document.station_id)?.push(document);
  }

  return stationHealthRows.map((row) => {
    const station = stationCatalog.get(row.code);
    const stationTasks = taskGroups.get(row.code) || [];
    const stationExceptions = exceptionGroups.get(row.code) || [];
    const stationDocuments = documentGroups.get(row.code) || [];
    const completedTasks = stationTasks.filter(
      (item) =>
        STATION_REPORT_DONE_TASK_STATUSES.has(item.task_status) ||
        COMPLETED_TASK_STATUSES.has(item.task_status),
    ).length;
    const blockedTasks = stationTasks.filter(
      (item) =>
        !STATION_REPORT_DONE_TASK_STATUSES.has(item.task_status) &&
        !COMPLETED_TASK_STATUSES.has(item.task_status) &&
        item.blocker_code,
    ).length;
    const podDocuments = stationDocuments.filter(
      (item) => item.document_type === "POD",
    );
    const approvedPods = podDocuments.filter((item) =>
      STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.document_status),
    ).length;
    const podClosure = podDocuments.length
      ? `${Math.round((approvedPods / podDocuments.length) * 1000) / 10}%`
      : stationTasks.length
        ? `${Math.round((completedTasks / Math.max(stationTasks.length, 1)) * 1000) / 10}%`
        : "0%";
    const avgExceptionAge = stationExceptions.length
      ? stationExceptions
          .map((item) =>
            diffStationReportHours(
              item.opened_at,
              item.closed_at || reportAnchor,
            ),
          )
          .filter((value): value is number => value !== null)
          .reduce((sum, value) => sum + value, 0) /
        Math.max(
          stationExceptions.filter(
            (item) =>
              diffStationReportHours(
                item.opened_at,
                item.closed_at || reportAnchor,
              ) !== null,
          ).length,
          1,
        )
      : 0;

    return {
      code: row.code,
      station: station?.station_name || row.name,
      control: normalizeControlLevel(station?.control_level ?? row.control),
      inboundSla: stationTasks.length
        ? `${Math.round((completedTasks / stationTasks.length) * 1000) / 10}%`
        : "0%",
      podClosure,
      exceptionAging: avgExceptionAge
        ? formatStationReportHours(avgExceptionAge)
        : "0h",
      readiness: `${row.readiness}%`,
      blockingReason:
        healthByCode.get(row.code)?.blockingReason || row.blockingReason,
    };
  });
}

async function loadStationDailyReportSource(
  db: any,
  stationId: string,
  reportDate: string,
) {
  const [
    tasksResult,
    exceptionsResult,
    documentsResult,
    loadingPlansResult,
    auditsResult,
  ] = await Promise.all([
    db
      ? db
          .prepare(
            `
              SELECT
                t.task_id,
                t.station_id,
                t.task_type,
                t.execution_node,
                t.related_object_type,
                t.related_object_id,
                t.assigned_role,
                t.assigned_team_id,
                t.assigned_worker_id,
                t.task_status,
                t.task_sla,
                t.due_at,
                t.blocker_code,
                t.evidence_required,
                t.created_at,
                t.completed_at,
                t.verified_at,
                t.updated_at,
                tm.team_name,
                tm.shift_code
              FROM tasks t
              LEFT JOIN teams tm ON tm.team_id = t.assigned_team_id
              WHERE t.station_id = ?
                AND DATE(COALESCE(t.completed_at, t.verified_at, t.updated_at, t.created_at)) = ?
              ORDER BY COALESCE(t.due_at, t.updated_at, t.created_at) ASC, t.created_at DESC
            `,
          )
          .bind(stationId, reportDate)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                exception_id,
                station_id,
                exception_type,
                related_object_type,
                related_object_id,
                linked_task_id,
                severity,
                owner_role,
                owner_team_id,
                exception_status,
                blocker_flag,
                root_cause,
                action_taken,
                opened_at,
                closed_at
              FROM exceptions
              WHERE station_id = ?
                AND DATE(COALESCE(closed_at, updated_at, opened_at, created_at)) = ?
              ORDER BY opened_at DESC, created_at DESC
            `,
          )
          .bind(stationId, reportDate)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                document_id,
                station_id,
                document_type,
                document_name,
                related_object_type,
                related_object_id,
                parent_document_id,
                version_no,
                document_status,
                required_for_release,
                uploaded_at,
                updated_at,
                created_at,
                note
              FROM documents
              WHERE station_id = ?
                AND DATE(COALESCE(updated_at, uploaded_at, created_at)) = ?
              ORDER BY COALESCE(updated_at, uploaded_at, created_at) DESC, document_id DESC
            `,
          )
          .bind(stationId, reportDate)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                loading_plan_id,
                station_id,
                flight_no,
                truck_plate,
                driver_name,
                collection_note,
                arrival_time,
                depart_time,
                plan_status,
                created_at,
                updated_at
              FROM loading_plans
              WHERE station_id = ?
                AND DATE(COALESCE(updated_at, depart_time, arrival_time, created_at)) = ?
              ORDER BY COALESCE(depart_time, arrival_time, updated_at, created_at) DESC
            `,
          )
          .bind(stationId, reportDate)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                audit_id,
                action,
                object_type,
                object_id,
                summary,
                created_at
              FROM audit_events
              WHERE station_id = ?
                AND DATE(created_at) = ?
              ORDER BY created_at DESC, audit_id DESC
            `,
          )
          .bind(stationId, reportDate)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
  ]);

  return {
    tasks: tasksResult.map(normalizeStationReportTaskRow),
    exceptions: exceptionsResult.map(normalizeStationReportExceptionRow),
    documents: documentsResult.map(normalizeStationReportDocumentRow),
    loadingPlans: loadingPlansResult.map(normalizeStationReportLoadingPlanRow),
    audits: auditsResult.map(normalizeStationReportAuditRow),
  };
}

async function loadPlatformDailyReportSource(
  db: any,
  reportDate: string,
  stationId?: string,
) {
  const stationClause = stationId ? " WHERE station_id = ?" : "";
  const stationParams = stationId ? [stationId] : [];
  const [
    stationsResult,
    tasksResult,
    exceptionsResult,
    documentsResult,
    auditsResult,
  ] = await Promise.all([
    db
      ? db
          .prepare(
            `
              SELECT station_id, station_name, control_level, phase
              FROM stations
              ${stationClause}
              ORDER BY station_id ASC
            `,
          )
          .bind(...stationParams)
          .all()
          .then(
            (rows: any) =>
              (rows?.results || []) as Array<{
                station_id: string;
                station_name: string;
                control_level: string | null;
                phase: string | null;
              }>,
          )
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                t.task_id,
                t.station_id,
                t.task_type,
                t.execution_node,
                t.related_object_type,
                t.related_object_id,
                t.assigned_role,
                t.assigned_team_id,
                t.assigned_worker_id,
                t.task_status,
                t.task_sla,
                t.due_at,
                t.blocker_code,
                t.evidence_required,
                t.created_at,
                t.completed_at,
                t.verified_at,
                t.updated_at
              FROM tasks t
              WHERE DATE(COALESCE(t.completed_at, t.verified_at, t.updated_at, t.created_at)) = ?
              ${stationId ? "AND t.station_id = ?" : ""}
              ORDER BY COALESCE(t.due_at, t.updated_at, t.created_at) ASC, t.created_at DESC
            `,
          )
          .bind(reportDate, ...stationParams)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                exception_id,
                station_id,
                exception_type,
                related_object_type,
                related_object_id,
                linked_task_id,
                severity,
                owner_role,
                owner_team_id,
                exception_status,
                blocker_flag,
                root_cause,
                action_taken,
                opened_at,
                closed_at
              FROM exceptions
              WHERE DATE(COALESCE(closed_at, updated_at, opened_at, created_at)) = ?
              ${stationId ? "AND station_id = ?" : ""}
              ORDER BY opened_at DESC, created_at DESC
            `,
          )
          .bind(reportDate, ...stationParams)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                document_id,
                station_id,
                document_type,
                document_name,
                related_object_type,
                related_object_id,
                parent_document_id,
                version_no,
                document_status,
                required_for_release,
                uploaded_at,
                updated_at,
                created_at,
                note
              FROM documents
              WHERE DATE(COALESCE(updated_at, uploaded_at, created_at)) = ?
              ${stationId ? "AND station_id = ?" : ""}
              ORDER BY COALESCE(updated_at, uploaded_at, created_at) DESC, document_id DESC
            `,
          )
          .bind(reportDate, ...stationParams)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                audit_id,
                station_id,
                action,
                object_type,
                object_id,
                summary,
                created_at
              FROM audit_events
              WHERE DATE(created_at) = ?
              ${stationId ? "AND station_id = ?" : ""}
              ORDER BY created_at DESC, audit_id DESC
            `,
          )
          .bind(reportDate, ...stationParams)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
  ]);

  return {
    stations: stationsResult,
    tasks: tasksResult.map((item: any) => ({
      task_id: item.task_id,
      station_id: item.station_id,
      task_type: item.task_type,
      execution_node: item.execution_node,
      related_object_type: item.related_object_type,
      related_object_id: item.related_object_id,
      assigned_role: item.assigned_role ?? undefined,
      assigned_team_id: item.assigned_team_id ?? undefined,
      assigned_worker_id: item.assigned_worker_id ?? undefined,
      task_status: item.task_status,
      task_sla: item.task_sla ?? undefined,
      due_at: item.due_at ?? undefined,
      blocker_code: item.blocker_code ?? undefined,
      evidence_required: Boolean(item.evidence_required),
      created_at: item.created_at ?? null,
      completed_at: item.completed_at ?? null,
      verified_at: item.verified_at ?? null,
      updated_at: item.updated_at ?? null,
    })),
    exceptions: exceptionsResult.map((item: any) => ({
      exception_id: item.exception_id,
      station_id: item.station_id,
      exception_type: item.exception_type,
      related_object_type: item.related_object_type,
      related_object_id: item.related_object_id,
      linked_task_id: item.linked_task_id ?? null,
      severity: item.severity,
      owner_role: item.owner_role ?? undefined,
      owner_team_id: item.owner_team_id ?? undefined,
      exception_status: item.exception_status,
      blocker_flag: Boolean(Number(item.blocker_flag ?? 0)),
      root_cause: item.root_cause ?? null,
      action_taken: item.action_taken ?? null,
      opened_at: item.opened_at ?? null,
      closed_at: item.closed_at ?? null,
    })),
    documents: documentsResult.map((item: any) => ({
      document_id: item.document_id,
      station_id: item.station_id,
      document_type: item.document_type,
      document_name: item.document_name,
      related_object_type: item.related_object_type,
      related_object_id: item.related_object_id,
      parent_document_id: item.parent_document_id ?? null,
      version_no: item.version_no,
      document_status: item.document_status,
      required_for_release: Boolean(item.required_for_release),
      uploaded_at: item.uploaded_at ?? null,
      updated_at: item.updated_at ?? null,
      created_at: item.created_at ?? null,
      note: item.note ?? null,
    })),
    audits: auditsResult.map((item: any) => ({
      audit_id: String(item?.audit_id || "").trim(),
      actor_id: String(item?.actor_id || "").trim(),
      actor_role: String(item?.actor_role || "").trim(),
      action: String(item?.action || "").trim(),
      object_type: String(item?.object_type || "").trim(),
      object_id: String(item?.object_id || "").trim(),
      station_id: String(item?.station_id || stationId || "").trim(),
      summary: String(item?.summary || "").trim(),
      created_at: item?.created_at || null,
    })),
  };
}

async function loadStationReportsDaily(
  db: any,
  stationId: string,
  reportDate: string,
) {
  const source = await loadStationDailyReportSource(db, stationId, reportDate);
  const qualityOverview = await loadStationDataQualityOverview(
    db,
    stationId,
    reportDate,
  );
  const generatedAt = new Date().toISOString();
  const reportAnchor = buildDailyReportAnchor(reportDate);
  const refreshPolicyRows = buildDailyRefreshPolicyRows(
    `站点 ${stationId}`,
    reportDate,
    reportAnchor,
  );
  const traceabilityRows = buildDailyTraceabilityRows(`站点 ${stationId}`);
  const stationReportCards = buildStationReportCards(
    source.tasks,
    source.exceptions,
    source.documents,
    source.loadingPlans,
  );
  const shiftReportRows = buildStationReportShiftRows(
    source.tasks,
    source.exceptions,
    source.documents,
  );
  const pdaKpiRows = buildStationReportPdaRows(
    source.tasks,
    source.exceptions,
    source.loadingPlans,
  );
  const stationFileReportRows = buildStationReportFileRows(
    source.documents,
    source.audits,
  );
  const taskSummaryRows = buildStationDailyTaskRows(source.tasks);
  const blockerSummaryRows = buildStationDailyBlockerRows(
    source.tasks,
    source.exceptions,
    source.documents,
  );
  const dailyReportRows = buildStationDailyRows(
    source.tasks,
    source.exceptions,
    source.documents,
    source.loadingPlans,
    source.audits,
    reportAnchor,
  );
  const anomalyDistribution = {
    total: source.exceptions.length,
    open: source.exceptions.filter(
      (item: any) => !CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus),
    ).length,
    blocking: source.exceptions.filter(
      (item: any) =>
        !CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus) &&
        item.blockerFlag,
    ).length,
    bySeverity: buildCountRows(
      source.exceptions,
      (item) => item.severity || "未分级",
    ),
    byStatus: buildCountRows(
      source.exceptions,
      (item) => item.exceptionStatus || "未分类",
    ),
  };
  const documentSummary = {
    total: source.documents.length,
    required: source.documents.filter((item: any) => item.requiredForRelease)
      .length,
    approved: source.documents.filter(
      (item: any) =>
        item.requiredForRelease &&
        STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus),
    ).length,
    missing: source.documents.filter(
      (item: any) =>
        item.requiredForRelease &&
        !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus),
    ).length,
  };
  const taskSummary = {
    total: source.tasks.length,
    open: source.tasks.filter(
      (item: any) =>
        !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) &&
        !COMPLETED_TASK_STATUSES.has(item.taskStatus),
    ).length,
    completed: source.tasks.filter(
      (item: any) =>
        STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) ||
        COMPLETED_TASK_STATUSES.has(item.taskStatus),
    ).length,
    blocked: source.tasks.filter(
      (item: any) =>
        !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) &&
        !COMPLETED_TASK_STATUSES.has(item.taskStatus) &&
        item.blockerCode,
    ).length,
  };
  const qualitySummaryRows = [
    {
      section: "数据质量",
      metric: "总量 / 阻断 / 分数",
      current: `${qualityOverview.total_issues} / ${qualityOverview.blocking_issues} / ${qualityOverview.quality_score}`,
      note:
        Object.entries(qualityOverview.by_severity)
          .map(([label, count]) => `${label} ${count}`)
          .join(" / ") || "暂无质量问题",
    },
  ];
  const qualityChecklistRows = (
    qualityOverview.quality_checklist?.checklist_rows || []
  ).map((item: any) => ({
    section: "质量检查表",
    metric: item.title,
    current: item.summary,
    note: Array.isArray(item.actions) ? item.actions.join(" / ") : "",
  }));

  return {
    reportMeta: {
      reportType: "station_daily",
      stationId,
      reportDate,
      reportAnchor,
      generatedAt,
      timeZone: REPORT_TIME_ZONE,
    },
    stationId,
    reportDate,
    generatedAt,
    stationReportCards,
    shiftReportRows,
    pdaKpiRows,
    stationFileReportRows,
    stationDailyReportRows: dailyReportRows,
    anomalyDistributionRows: anomalyDistribution.bySeverity,
    blockerSummaryRows,
    taskSummaryRows,
    documentSummaryRows: stationFileReportRows,
    qualitySummaryRows,
    qualityChecklistRows,
    refreshPolicyRows,
    traceabilityRows,
    dailyReport: {
      overviewCards: stationReportCards,
      keyMetrics: [
        ...pdaKpiRows,
        ...qualitySummaryRows,
        ...qualityChecklistRows,
      ],
      anomalyDistribution,
      blockerSummary: blockerSummaryRows,
      documentSummary: {
        ...documentSummary,
        rows: stationFileReportRows,
      },
      taskSummary: {
        ...taskSummary,
        rows: taskSummaryRows,
      },
      refreshPolicy: {
        mode: "full_rebuild",
        recalculateScope: "station_and_date",
        reportAnchor,
      },
      traceability: {
        qualitySource: "qualitySummary / qualityChecklist",
        objectSource: "Flight / AWB / Shipment / Exception",
        auditSource: "audit/object / audit/events",
      },
      qualitySummary: qualityOverview,
      qualityChecklist: qualityOverview.quality_checklist,
      timestamp: generatedAt,
    },
  };
}

async function loadStationExceptionsDaily(
  db: any,
  stationId: string,
  reportDate: string,
) {
  const report = await loadStationReportsDaily(db, stationId, reportDate);
  const source = await loadStationDailyReportSource(db, stationId, reportDate);
  const exceptionRows = source.exceptions
    .slice()
    .sort((left: any, right: any) => {
      if (left.blockerFlag !== right.blockerFlag)
        return left.blockerFlag ? -1 : 1;
      const leftSeverity =
        left.severity === "P1" ? 0 : left.severity === "P2" ? 1 : 2;
      const rightSeverity =
        right.severity === "P1" ? 0 : right.severity === "P2" ? 1 : 2;
      if (leftSeverity !== rightSeverity) return leftSeverity - rightSeverity;
      return String(right.openedAt || "").localeCompare(
        String(left.openedAt || ""),
      );
    })
    .slice(0, 4)
    .map((item: any) => ({
      id: item.exceptionId,
      title: item.exceptionType,
      object: `${item.relatedObjectType || "Object"} / ${item.relatedObjectId || "--"}`,
      severity: item.severity,
      status: item.exceptionStatus,
      blocker: item.blockerFlag ? "阻断中" : "-",
      summary: item.rootCause || item.actionTaken || "待补充恢复动作",
      openedAt: formatOverviewTime(item.openedAt),
      relatedTask: item.linkedTaskId || "--",
    }));

  const exceptionOverviewCards = buildStationExceptionOverviewCards(
    source.exceptions.map((item: any) => ({
      exception_status: item.exceptionStatus,
      blocker_flag: item.blockerFlag,
      severity: item.severity,
    })),
  );
  const exceptionDailyReportRows = [
    {
      section: "异常总量",
      metric: "开放 / 阻断 / 已关闭",
      current: `${report.dailyReport.anomalyDistribution.open} / ${report.dailyReport.anomalyDistribution.blocking} / ${Math.max(source.exceptions.length - report.dailyReport.anomalyDistribution.open, 0)}`,
      note: `${source.exceptions.length} 条异常进入日报范围`,
    },
    {
      section: "严重度分布",
      metric: "P1 / P2 / P3",
      current: [
        `P1 ${report.dailyReport.anomalyDistribution.bySeverity.find((row: any) => row.label === "P1")?.count || 0}`,
        `P2 ${report.dailyReport.anomalyDistribution.bySeverity.find((row: any) => row.label === "P2")?.count || 0}`,
        `P3 ${report.dailyReport.anomalyDistribution.bySeverity.find((row: any) => row.label === "P3")?.count || 0}`,
      ].join(" / "),
      note: "按异常严重度汇总",
    },
    {
      section: "关联任务",
      metric: "开放 / 阻断 / 已完成",
      current: `${report.dailyReport.taskSummary.open} / ${report.dailyReport.taskSummary.blocked} / ${report.dailyReport.taskSummary.completed}`,
      note: "异常关联任务按日报口径归集",
    },
    {
      section: "文档影响",
      metric: "关键 / 已批 / 缺失",
      current: `${report.dailyReport.documentSummary.required} / ${report.dailyReport.documentSummary.approved} / ${report.dailyReport.documentSummary.missing}`,
      note: "异常相关文件在日报中同步展示",
    },
  ];

  return {
    ...report,
    exceptionOverviewCards,
    exceptionDailyReportRows,
    exceptionRows,
    exceptionSummaryRows: exceptionRows,
    dailyReport: {
      ...report.dailyReport,
      overviewCards: exceptionOverviewCards,
      keyMetrics: [
        ...exceptionDailyReportRows,
        ...report.refreshPolicyRows,
        ...report.traceabilityRows,
      ],
      taskSummary: {
        ...report.dailyReport.taskSummary,
        rows: report.taskSummaryRows,
      },
      timestamp: report.generatedAt,
    },
  };
}

async function loadPlatformReportsDaily(
  db: any,
  reportDate: string,
  stationId?: string,
) {
  const source = await loadPlatformDailyReportSource(db, reportDate, stationId);
  const qualityOverview = await loadPlatformDataQualityOverview(
    db,
    reportDate,
    stationId,
  );
  const generatedAt = new Date().toISOString();
  const reportAnchor = buildDailyReportAnchor(reportDate);
  const refreshPolicyRows = buildDailyRefreshPolicyRows(
    stationId ? `平台(${stationId})` : "平台",
    reportDate,
    reportAnchor,
  );
  const traceabilityRows = buildDailyTraceabilityRows(
    stationId ? `平台(${stationId})` : "平台",
  );
  const overview = buildOverviewState(
    source.stations,
    source.tasks as any[],
    source.exceptions as any[],
    source.audits as any[],
  );
  const stationHealthRows = overview.stationHealthRows;
  const platformReportCards = overview.platformKpis.length
    ? overview.platformKpis
    : [];
  const platformStationReportRows = buildPlatformDailyStationRows(
    source.stations,
    stationHealthRows as any[],
    source.tasks as any[],
    source.exceptions as any[],
    source.documents as any[],
    reportAnchor,
  );
  const platformDailyReportRows = buildPlatformDailyRows(
    stationHealthRows as any[],
    source.tasks as any[],
    source.exceptions as any[],
    source.documents as any[],
    reportAnchor,
  );
  const blockerSummaryRows = overview.platformAlerts.length
    ? overview.platformAlerts
    : overview.platformPendingActions;
  const taskSummaryRows = overview.platformPendingActions;
  const documentSummaryRows = buildPlatformDocumentSummaryRows(
    source.documents as any[],
    source.exceptions as any[],
  );
  const platformStationComparisonRows = buildPlatformStationComparisonRows(
    platformStationReportRows,
    [],
    reportAnchor,
    qualityOverview,
  );
  const anomalyDistribution = {
    total: source.exceptions.length,
    open: source.exceptions.filter(
      (item: any) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status),
    ).length,
    blocking: source.exceptions.filter(
      (item: any) =>
        !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) &&
        Boolean(Number(item.blocker_flag)),
    ).length,
    bySeverity: buildCountRows(
      source.exceptions,
      (item) => item.severity || "未分级",
    ),
    byStatus: buildCountRows(
      source.exceptions,
      (item) => item.exception_status || "未分类",
    ),
  };
  const qualitySummaryRows = [
    {
      section: "数据质量",
      metric: "总量 / 阻断 / 分数",
      current: `${qualityOverview.total_issues} / ${qualityOverview.blocking_issues} / ${qualityOverview.quality_score}`,
      note:
        Object.entries(qualityOverview.by_severity)
          .map(([label, count]) => `${label} ${count}`)
          .join(" / ") || "暂无质量问题",
    },
  ];
  const qualityChecklistRows = (
    qualityOverview.quality_checklist?.checklist_rows || []
  ).map((item: any) => ({
    section: "质量检查表",
    metric: item.title,
    current: item.summary,
    note: Array.isArray(item.actions) ? item.actions.join(" / ") : "",
  }));

  return {
    reportMeta: {
      reportType: "platform_daily",
      stationId: stationId || null,
      reportDate,
      reportAnchor,
      generatedAt,
      timeZone: REPORT_TIME_ZONE,
    },
    stationId: stationId || null,
    reportDate,
    generatedAt,
    platformReportCards,
    platformStationReportRows,
    platformDailyReportRows,
    platformStationHealthRows: stationHealthRows,
    platformStationComparisonRows,
    anomalyDistributionRows: anomalyDistribution.bySeverity,
    blockerSummaryRows,
    taskSummaryRows,
    documentSummaryRows,
    qualitySummaryRows,
    qualityChecklistRows,
    refreshPolicyRows,
    traceabilityRows,
    dailyReport: {
      overviewCards: platformReportCards,
      keyMetrics: [
        ...platformDailyReportRows,
        ...qualitySummaryRows,
        ...qualityChecklistRows,
      ],
      anomalyDistribution,
      blockerSummary: blockerSummaryRows,
      documentSummary: {
        total: source.documents.length,
        rows: documentSummaryRows,
      },
      taskSummary: {
        total: source.tasks.length,
        rows: taskSummaryRows,
      },
      refreshPolicy: {
        mode: "full_rebuild",
        recalculateScope: stationId
          ? "platform_station_and_date"
          : "platform_and_date",
        reportAnchor,
      },
      traceability: {
        qualitySource: "qualitySummary / qualityChecklist",
        objectSource: "Flight / AWB / Shipment / Exception",
        auditSource: "audit/object / audit/events",
      },
      qualitySummary: qualityOverview,
      qualityChecklist: qualityOverview.quality_checklist,
      timestamp: generatedAt,
    },
  };
}

function buildPlatformDailyRows(
  stationHealthRows: Array<{
    code: string;
    name: string;
    control: string;
    phase: string;
    readiness: number;
    blockingReason: string;
  }>,
  tasks: Array<{
    station_id: string;
    task_status: string;
    blocker_code: string | null;
    due_at: string | null;
    task_type: string;
    execution_node: string;
  }>,
  exceptions: Array<{
    station_id: string;
    exception_status: string;
    blocker_flag: number | string;
    severity: string;
    root_cause: string | null;
    action_taken: string | null;
    opened_at: string | null;
  }>,
  documents: Array<{
    station_id: string;
    document_type: string;
    document_status: string;
    required_for_release: number | boolean | null;
    updated_at: string | null;
    uploaded_at: string | null;
    created_at?: string | null;
  }>,
  reportAnchor: string,
) {
  const reportAnchorTime = new Date(reportAnchor).getTime();
  const completedTasks = tasks.filter(
    (item) =>
      STATION_REPORT_DONE_TASK_STATUSES.has(item.task_status) ||
      COMPLETED_TASK_STATUSES.has(item.task_status),
  ).length;
  const blockedTasks = tasks.filter(
    (item) =>
      !STATION_REPORT_DONE_TASK_STATUSES.has(item.task_status) &&
      !COMPLETED_TASK_STATUSES.has(item.task_status) &&
      item.blocker_code,
  ).length;
  const overdueTasks = tasks.filter(
    (item) =>
      !STATION_REPORT_DONE_TASK_STATUSES.has(item.task_status) &&
      !COMPLETED_TASK_STATUSES.has(item.task_status) &&
      item.due_at &&
      new Date(String(item.due_at)).getTime() < reportAnchorTime,
  ).length;
  const openExceptions = exceptions.filter(
    (item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status),
  );
  const blockingExceptions = exceptions.filter(
    (item) =>
      !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) &&
      Boolean(Number(item.blocker_flag)),
  );
  const requiredDocuments = documents.filter((item) =>
    Boolean(item.required_for_release),
  );
  const missingDocuments = requiredDocuments.filter(
    (item) =>
      !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.document_status),
  );
  const healthyStations = stationHealthRows.filter(
    (item) => item.readiness >= 80,
  ).length;

  return [
    {
      section: "任务流转",
      metric: "完成 / 阻断 / 超时",
      current: `${completedTasks} / ${blockedTasks} / ${overdueTasks}`,
      note: `${tasks.length} 条当日报告任务`,
    },
    {
      section: "异常分布",
      metric: "开放 / 阻断 / 已恢复",
      current: `${openExceptions.length} / ${blockingExceptions.length} / ${Math.max(exceptions.length - openExceptions.length, 0)}`,
      note:
        buildCountRows(exceptions, (item) => item.severity || "未分级")
          .map((row) => `${row.label} ${row.count}`)
          .join(" / ") || "暂无异常",
    },
    {
      section: "文档闭环",
      metric: "关键 / 已批 / 缺失",
      current: `${requiredDocuments.length} / ${requiredDocuments.length - missingDocuments.length} / ${missingDocuments.length}`,
      note: `${documents.length} 份文档进入日报范围`,
    },
    {
      section: "站点准备度",
      metric: "健康 / 关注",
      current: `${healthyStations} / ${Math.max(stationHealthRows.length - healthyStations, 0)}`,
      note: `${stationHealthRows.length} 个站点参与平台日报`,
    },
  ];
}

function buildPlatformDocumentSummaryRows(
  documents: Array<{
    station_id: string;
    document_type: string;
    document_name: string;
    document_status: string;
    required_for_release: number | boolean | null;
    updated_at: string | null;
    uploaded_at: string | null;
    created_at?: string | null;
    note?: string | null;
  }>,
  exceptions: Array<{
    station_id: string;
    exception_status: string;
    blocker_flag: number | string;
    severity: string;
    root_cause: string | null;
    action_taken: string | null;
    opened_at: string | null;
  }>,
) {
  const requiredDocuments = documents.filter((item) =>
    Boolean(item.required_for_release),
  );
  const missingDocuments = requiredDocuments.filter(
    (item) =>
      !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.document_status),
  );
  const criticalDocuments = documents.filter((item) =>
    ["FFM", "UWS", "Manifest", "POD", "CBA", "MAWB"].includes(
      item.document_type,
    ),
  );
  const latestCriticalDocuments = criticalDocuments
    .slice()
    .sort((left, right) =>
      String(
        right.updated_at || right.uploaded_at || right.created_at || "",
      ).localeCompare(
        String(left.updated_at || left.uploaded_at || left.created_at || ""),
      ),
    )
    .slice(0, 4);
  const blockingExceptions = exceptions.filter(
    (item) =>
      !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) &&
      Boolean(Number(item.blocker_flag)),
  ).length;

  return [
    {
      report: "关键文件缺失",
      object: requiredDocuments[0]
        ? `${requiredDocuments[0].document_type} / ${requiredDocuments[0].station_id}`
        : "关键放行文件",
      current: `${missingDocuments.length} 条未满足放行条件`,
      note: `覆盖 ${requiredDocuments.length} 份关键文档`,
    },
    {
      report: "文件版本替换",
      object: latestCriticalDocuments[0]
        ? `${latestCriticalDocuments[0].document_type} / ${latestCriticalDocuments[0].station_id}`
        : "文件版本链",
      current:
        latestCriticalDocuments.length > 1
          ? `${latestCriticalDocuments[1].document_status} / ${latestCriticalDocuments[0].document_status}`
          : latestCriticalDocuments.length === 1
            ? `${latestCriticalDocuments[0].document_status} 最新`
            : "暂无版本替换",
      note: latestCriticalDocuments[0]
        ? `最新文件 ${latestCriticalDocuments[0].document_name}`
        : "暂无可用文件版本",
    },
    {
      report: "阻断异常",
      object: "异常总览",
      current: `${blockingExceptions} 条阻断中`,
      note: "按日报日期过滤后的异常分布",
    },
    {
      report: "文件更新时间",
      object:
        latestCriticalDocuments.map((item) => item.document_type).join(" / ") ||
        "关键文件",
      current:
        latestCriticalDocuments
          .map((item) =>
            formatOverviewTime(
              item.updated_at || item.uploaded_at || item.created_at,
            ),
          )
          .join(" / ") || "--",
      note: "按最近更新的关键文件排序",
    },
  ];
}

function buildPlatformStationComparisonRows(
  actualRows: Array<{
    code: string;
    station: string;
    control: string;
    inboundSla: string;
    podClosure: string;
    exceptionAging: string;
    readiness: string;
    blockingReason: string;
  }>,
  baselineRows: Array<{
    code: string;
    station: string;
    control: string;
    inboundSla: string;
    podClosure: string;
    exceptionAging: string;
    readiness: string;
    blockingReason: string;
  }>,
  reportAnchor: string,
  qualityOverview: any,
) {
  const comparisonRows = actualRows.map((item) => ({
    ...item,
    comparisonType: "actual",
    reportAnchor,
    qualityGate: qualityOverview?.quality_checklist?.gate_status || "clear",
    comparisonNote: "真实日报站点",
  }));

  const actualCodes = new Set(actualRows.map((item) => item.code));
  const preferredBenchmarkCodes = ["RZE", "URC", "MST", "KGF", "NVI", "BoH"];
  const benchmarkRow =
    preferredBenchmarkCodes
      .map((code) =>
        baselineRows.find(
          (item) => item.code === code && !actualCodes.has(code),
        ),
      )
      .find(Boolean) ||
    baselineRows.find((item) => !actualCodes.has(item.code));

  if (benchmarkRow) {
    comparisonRows.push({
      ...benchmarkRow,
      comparisonType: "template",
      reportAnchor: "模板基线",
      qualityGate: "baseline",
      comparisonNote: "模板对照站，不代表真实试运行日报",
    });
  }

  return comparisonRows;
}

function normalizeComparisonValue(value: string | null | undefined) {
  return String(value || "--");
}

function buildGovernanceMetricStatus(actual: string, template: string) {
  if (actual === template) {
    return "aligned";
  }

  if (actual === "--" || template === "--") {
    return "warning";
  }

  return "diff";
}

async function loadStationGovernanceComparison(
  db: any,
  stationId: string,
  reportDate: string,
) {
  const [report, copyPackage, playbook, summary] = await Promise.all([
    loadPlatformReportsDaily(db, reportDate, stationId),
    loadStationCopyPackage(db, stationId),
    loadStationOnboardingPlaybook(db, stationId),
    loadStationGovernanceSummary(db, stationId),
  ]);

  const actualRow =
    report.platformStationComparisonRows.find(
      (item: any) =>
        item.code === stationId && item.comparisonType === "actual",
    ) ||
    report.platformStationComparisonRows.find(
      (item: any) => item.comparisonType === "actual",
    ) ||
    null;
  const templateRow =
    report.platformStationComparisonRows.find(
      (item: any) =>
        item.code === copyPackage.benchmark_station_id &&
        item.comparisonType === "template",
    ) ||
    report.platformStationComparisonRows.find(
      (item: any) => item.comparisonType === "template",
    ) ||
    null;

  const metricRows = [
    {
      metric_key: "inbound_sla",
      label: "Inbound SLA",
      actual: normalizeComparisonValue(actualRow?.inboundSla),
      template: normalizeComparisonValue(templateRow?.inboundSla),
      status: buildGovernanceMetricStatus(
        normalizeComparisonValue(actualRow?.inboundSla),
        normalizeComparisonValue(templateRow?.inboundSla),
      ),
      note: "比较主样板站与模板对照站的 inbound SLA 展示口径。",
    },
    {
      metric_key: "pod_close_rate",
      label: "POD 闭环率",
      actual: normalizeComparisonValue(actualRow?.podClosure),
      template: normalizeComparisonValue(templateRow?.podClosure),
      status: buildGovernanceMetricStatus(
        normalizeComparisonValue(actualRow?.podClosure),
        normalizeComparisonValue(templateRow?.podClosure),
      ),
      note: "比较 POD 闭环率口径是否一致。",
    },
    {
      metric_key: "exception_closure_duration",
      label: "异常闭环时长",
      actual: normalizeComparisonValue(actualRow?.exceptionAging),
      template: normalizeComparisonValue(templateRow?.exceptionAging),
      status: buildGovernanceMetricStatus(
        normalizeComparisonValue(actualRow?.exceptionAging),
        normalizeComparisonValue(templateRow?.exceptionAging),
      ),
      note: "比较异常恢复与闭环时长的治理口径。",
    },
    {
      metric_key: "readiness_score",
      label: "准备度",
      actual: normalizeComparisonValue(actualRow?.readiness),
      template: normalizeComparisonValue(templateRow?.readiness),
      status: buildGovernanceMetricStatus(
        normalizeComparisonValue(actualRow?.readiness),
        normalizeComparisonValue(templateRow?.readiness),
      ),
      note: "比较站点准备度和接入就绪度。",
    },
    {
      metric_key: "quality_gate_status",
      label: "质量门槛",
      actual: normalizeComparisonValue(actualRow?.qualityGate),
      template: normalizeComparisonValue(templateRow?.qualityGate),
      status: buildGovernanceMetricStatus(
        normalizeComparisonValue(actualRow?.qualityGate),
        normalizeComparisonValue(templateRow?.qualityGate),
      ),
      note: "比较日报中的质量门槛展示与站点接入口径。",
    },
    {
      metric_key: "traceability_status",
      label: "追溯关系",
      actual: "enabled",
      template: "enabled",
      status: "aligned",
      note: "平台日报、接入模板和审计链都必须可追溯。",
    },
  ];

  const differenceSummaryRows = metricRows
    .filter((item) => item.status !== "aligned")
    .map((item) => ({
      metric_key: item.metric_key,
      label: item.label,
      difference: `${item.actual} <> ${item.template}`,
      gate_status: item.status === "diff" ? "warning" : item.status,
      note: item.note,
    }));

  const issueBacklogRows = [
    ...playbook.onboarding_checklist
      .filter((item) => item.gate_status !== "clear")
      .map((item) => ({
        issue_key: item.item_key,
        severity: item.gate_status,
        source: "onboarding_checklist",
        note: item.note,
        next_action:
          item.gate_status === "blocked"
            ? "先解除阻断项再继续接入。"
            : "记录 warning，并在验收记录中人工确认。",
      })),
    ...differenceSummaryRows.map((item) => ({
      issue_key: item.metric_key,
      severity: item.gate_status,
      source: "governance_comparison",
      note: item.note,
      next_action: "对照模板包、站点覆盖项和日报锚点定位差异。",
    })),
  ];

  const differencePathRows = [
    {
      step: 1,
      label: "先看日报锚点",
      source: "reportMeta.reportAnchor",
      note: "确认主样板站和模板对照站使用同一天同一锚点。",
    },
    {
      step: 2,
      label: "再看治理模板",
      source: "copy-package / governance summary",
      note: "确认 controlLevel、templateKey 与最小接入单元一致。",
    },
    {
      step: 3,
      label: "再看质量门槛",
      source: "qualityChecklist / onboarding playbook",
      note: "若存在 blocked，先停止接入验收。",
    },
    {
      step: 4,
      label: "再看核心指标差异",
      source: "governance comparison metrics",
      note: "比较 inbound SLA、POD 闭环率、异常闭环时长、准备度。",
    },
    {
      step: 5,
      label: "最后回链样板 SOP",
      source: "MME production trial SOP",
      note: "回到样板站试运行 SOP 和站点覆盖项定位差异。",
    },
  ];

  return {
    station_id: stationId,
    station_name: summary.station_name,
    template_station_id: copyPackage.template_station_id,
    template_station_name: copyPackage.template_station_name,
    benchmark_station_id: copyPackage.benchmark_station_id,
    benchmark_station_name: copyPackage.benchmark_station_name,
    comparison_anchor: {
      reportDate: report.reportMeta.reportDate,
      reportAnchor: report.reportMeta.reportAnchor,
      baselineStationCode: copyPackage.benchmark_station_id,
      baselineStationName: copyPackage.benchmark_station_name,
    },
    comparison_rows: report.platformStationComparisonRows,
    metric_rows: metricRows,
    difference_summary_rows: differenceSummaryRows,
    issue_backlog_rows: issueBacklogRows,
    difference_path_rows: differencePathRows,
  };
}

async function loadStationAcceptanceRecordTemplate(
  db: any,
  stationId: string,
  reportDate: string,
) {
  const comparison = await loadStationGovernanceComparison(
    db,
    stationId,
    reportDate,
  );

  return {
    stationId: comparison.station_id,
    stationCode: comparison.station_id,
    stationName: comparison.station_name,
    templateKey: `station-copy-package-${comparison.station_id.toLowerCase()}`,
    comparisonAnchor: comparison.comparison_anchor.reportAnchor,
    reportDate: comparison.comparison_anchor.reportDate,
    baselineStationCode: comparison.comparison_anchor.baselineStationCode,
    acceptanceDecisionOptions: ["Accepted", "Refine", "Blocked"],
    fields: [
      {
        field_key: "stationId",
        label: "站点 ID",
        required: true,
        source: "station summary",
        note: "接入验收对象标识。",
      },
      {
        field_key: "stationCode",
        label: "站点编码",
        required: true,
        source: "station summary",
        note: "与模板包中的站点编码一致。",
      },
      {
        field_key: "stationName",
        label: "站点名称",
        required: true,
        source: "station summary",
        note: "用于接入验收记录归档。",
      },
      {
        field_key: "templateKey",
        label: "模板包键",
        required: true,
        source: "copy package",
        note: "标识本次接入绑定的模板包。",
      },
      {
        field_key: "comparisonAnchor",
        label: "对比锚点",
        required: true,
        source: "governance comparison",
        note: "用于确认日报锚点一致。",
      },
      {
        field_key: "reportDate",
        label: "报表日期",
        required: true,
        source: "governance comparison",
        note: "与日报日期保持一致。",
      },
      {
        field_key: "baselineStationCode",
        label: "模板对照站",
        required: true,
        source: "copy package",
        note: "当前固定为 RZE。",
      },
      {
        field_key: "actualMetricsSnapshot",
        label: "实际指标快照",
        required: true,
        source: "governance comparison",
        note: "记录主样板站当前指标。",
      },
      {
        field_key: "templateMetricsSnapshot",
        label: "模板指标快照",
        required: true,
        source: "governance comparison",
        note: "记录模板对照站指标。",
      },
      {
        field_key: "qualityChecklistSummary",
        label: "质量检查摘要",
        required: true,
        source: "onboarding playbook",
        note: "记录 clear / warning / blocked 摘要。",
      },
      {
        field_key: "differenceSummary",
        label: "差异摘要",
        required: true,
        source: "governance comparison",
        note: "记录与模板对照站的最小差异集。",
      },
      {
        field_key: "blockedItems",
        label: "阻断项",
        required: true,
        source: "onboarding playbook",
        note: "若存在 blocked，必须在接入前清零。",
      },
      {
        field_key: "warningItems",
        label: "Warning 项",
        required: true,
        source: "onboarding playbook",
        note: "允许存在，但必须人工确认。",
      },
      {
        field_key: "acceptanceDecision",
        label: "验收结论",
        required: true,
        source: "manual",
        note: "固定三态：Accepted / Refine / Blocked。",
      },
      {
        field_key: "reviewer",
        label: "验收人",
        required: true,
        source: "manual",
        note: "负责冻结接入结论的人。",
      },
      {
        field_key: "reviewedAt",
        label: "验收时间",
        required: true,
        source: "manual",
        note: "记录最终验收时间。",
      },
      {
        field_key: "rollbackRequired",
        label: "是否需要回滚",
        required: true,
        source: "manual",
        note: "若验收失败，必须显式标记。",
      },
      {
        field_key: "rollbackScope",
        label: "回滚范围",
        required: true,
        source: "onboarding playbook",
        note: "固定记录模板 + 配置级回滚范围。",
      },
      {
        field_key: "evidenceRef",
        label: "证据引用",
        required: true,
        source: "manual",
        note: "指向日报、审计、回放结果或验收附件。",
      },
    ],
  };
}

type OverviewStationRow = {
  station_id: string;
  station_name: string;
  control_level: string | null;
  phase: string | null;
};

type OverviewTaskRow = {
  station_id: string;
  task_id: string;
  task_type: string;
  execution_node: string;
  related_object_type: string;
  related_object_id: string;
  assigned_role: string | null;
  assigned_team_id: string | null;
  assigned_worker_id: string | null;
  task_status: string;
  task_sla: string | null;
  due_at: string | null;
  blocker_code: string | null;
};

type OverviewExceptionRow = {
  station_id: string;
  exception_id: string;
  exception_type: string;
  related_object_type: string;
  related_object_id: string;
  linked_task_id: string | null;
  severity: string;
  owner_role: string | null;
  owner_team_id: string | null;
  exception_status: string;
  blocker_flag: number | string;
  root_cause: string | null;
  action_taken: string | null;
  opened_at: string | null;
};

type OverviewAuditRow = {
  audit_id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  object_type: string;
  object_id: string;
  station_id: string;
  summary: string;
  created_at: string;
};

type DashboardFlightRow = {
  flight_id: string;
  flight_no: string;
  eta_at: string | null;
  etd_at: string | null;
  origin_code: string;
  destination_code: string;
  runtime_status: string;
  service_level: string | null;
};

type DashboardAwbRow = {
  awb_id: string;
  awb_no: string;
  flight_id: string;
  pieces: number;
  gross_weight: number;
  noa_status: string;
  pod_status: string;
  transfer_status: string;
  manifest_status: string | null;
};

type DashboardTaskRow = {
  task_id: string;
  station_id: string;
  task_type: string;
  execution_node: string;
  related_object_type: string;
  related_object_id: string;
  assigned_role: string | null;
  assigned_team_id: string | null;
  assigned_worker_id: string | null;
  task_status: string;
  due_at: string | null;
  blocker_code: string | null;
};

type DashboardExceptionRow = {
  exception_id: string;
  station_id: string;
  exception_type: string;
  related_object_type: string;
  related_object_id: string;
  severity: string;
  exception_status: string;
  blocker_flag: number | string;
  root_cause: string | null;
  action_taken: string | null;
  opened_at: string | null;
};

type DashboardLoadingPlanRow = {
  loading_plan_id: string;
  station_id: string;
  flight_no: string;
  truck_plate: string;
  driver_name: string | null;
  depart_time: string | null;
  arrival_time: string | null;
  plan_status: string;
  created_at: string;
};

type DashboardDocumentRow = {
  document_id: string;
  related_object_id: string;
  document_status: string;
  document_type: string;
};

async function loadStationTasksOverview(db: any, stationId: string) {
  const [
    tasksResult,
    exceptionsResult,
    documentsResult,
    flightsResult,
    awbsResult,
  ] = await Promise.all([
    db
      ? db
          .prepare(
            `
              SELECT
                t.task_id,
                t.station_id,
                t.task_type,
                t.execution_node,
                t.related_object_type,
                t.related_object_id,
                t.assigned_role,
                t.assigned_team_id,
                t.assigned_worker_id,
                t.task_status,
                t.due_at,
                t.blocker_code,
                t.created_at,
                t.updated_at,
                tm.team_name,
                tm.shift_code
              FROM tasks t
              LEFT JOIN teams tm ON tm.team_id = t.assigned_team_id
              WHERE t.station_id = ?
              ORDER BY COALESCE(t.due_at, t.updated_at, t.created_at) ASC, t.created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                exception_id,
                station_id,
                exception_type,
                related_object_type,
                related_object_id,
                linked_task_id,
                severity,
                owner_role,
                owner_team_id,
                exception_status,
                blocker_flag,
                root_cause,
                action_taken,
                opened_at,
                closed_at,
                created_at
              FROM exceptions
              WHERE station_id = ?
              ORDER BY opened_at DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                document_id,
                document_type,
                document_name,
                related_object_type,
                related_object_id,
                document_status,
                required_for_release,
                note,
                created_at,
                updated_at
              FROM documents
              WHERE station_id = ?
              ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                flight_id,
                flight_no,
                origin_code,
                destination_code,
                eta_at,
                etd_at,
                actual_landed_at,
                runtime_status,
                service_level
              FROM flights
              WHERE station_id = ?
              ORDER BY COALESCE(eta_at, etd_at, flight_no) ASC, flight_no ASC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    db
      ? db
          .prepare(
            `
              SELECT
                awb_id,
                awb_no,
                flight_id,
                station_id
              FROM awbs
              WHERE station_id = ?
              ORDER BY awb_no ASC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
  ]);

  const tasks = tasksResult.map((item: any) => ({
    task_id: String(item?.task_id || "").trim(),
    station_id: String(item?.station_id || stationId).trim(),
    task_type: String(item?.task_type || "任务").trim(),
    execution_node: String(item?.execution_node || "").trim(),
    related_object_type: String(item?.related_object_type || "").trim(),
    related_object_id: String(item?.related_object_id || "").trim(),
    assigned_role: String(item?.assigned_role || "").trim() || null,
    assigned_team_id: String(item?.assigned_team_id || "").trim() || null,
    assigned_worker_id: String(item?.assigned_worker_id || "").trim() || null,
    task_status: String(item?.task_status || "待处理").trim(),
    due_at: item?.due_at || null,
    blocker_code: String(item?.blocker_code || "").trim() || null,
    created_at: item?.created_at || null,
    updated_at: item?.updated_at || null,
    team_name: String(item?.team_name || "").trim() || null,
    shift_code: String(item?.shift_code || "").trim() || null,
  }));

  const exceptions = exceptionsResult.map((item: any) => ({
    exception_id: String(item?.exception_id || "").trim(),
    station_id: String(item?.station_id || stationId).trim(),
    exception_type: String(item?.exception_type || "异常").trim(),
    related_object_type: String(item?.related_object_type || "").trim(),
    related_object_id: String(item?.related_object_id || "").trim(),
    linked_task_id: String(item?.linked_task_id || "").trim() || null,
    severity: String(item?.severity || "").trim(),
    owner_role: String(item?.owner_role || "").trim() || null,
    owner_team_id: String(item?.owner_team_id || "").trim() || null,
    exception_status: String(item?.exception_status || "Open").trim(),
    blocker_flag: Boolean(Number(item?.blocker_flag ?? 0)),
    root_cause: String(item?.root_cause || "").trim() || null,
    action_taken: String(item?.action_taken || "").trim() || null,
    opened_at: item?.opened_at || null,
    closed_at: item?.closed_at || null,
  }));

  const documents = documentsResult.map((item: any) => ({
    document_id: String(item?.document_id || "").trim(),
    document_type: String(item?.document_type || "").trim(),
    document_name: String(item?.document_name || "").trim(),
    related_object_type: String(item?.related_object_type || "").trim(),
    related_object_id: String(item?.related_object_id || "").trim(),
    document_status: String(item?.document_status || "").trim(),
    required_for_release: Boolean(item?.required_for_release),
    note: String(item?.note || "").trim(),
    created_at: item?.created_at || null,
    updated_at: item?.updated_at || null,
  }));

  const flights = flightsResult.map((item: any) => ({
    flight_id: String(item?.flight_id || "").trim(),
    flight_no: String(item?.flight_no || "").trim(),
    origin_code: String(item?.origin_code || "").trim(),
    destination_code: String(item?.destination_code || "").trim(),
    eta_at: item?.eta_at || null,
    etd_at: item?.etd_at || null,
    actual_landed_at: item?.actual_landed_at || null,
    runtime_status: String(item?.runtime_status || "").trim(),
    service_level: String(item?.service_level || "").trim() || null,
  }));

  const awbs = awbsResult.map((item: any) => ({
    awb_id: String(item?.awb_id || "").trim(),
    awb_no: String(item?.awb_no || "").trim(),
    flight_id: String(item?.flight_id || "").trim(),
    station_id: String(item?.station_id || stationId).trim(),
  }));

  const flightById = new Map<string, any>(
    flights.map((item: any) => [item.flight_id, item] as const),
  );
  const flightByNo = new Map<string, any>(
    flights.map((item: any) => [item.flight_no, item] as const),
  );
  const awbById = new Map<string, any>(
    awbs.map((item: any) => [item.awb_id, item] as const),
  );
  const awbByNo = new Map<string, any>(
    awbs.map((item: any) => [item.awb_no, item] as const),
  );
  const exceptionByTaskId = new Map<string, any>();
  const exceptionByRelatedKey = new Map<string, any[]>();
  const documentByFlightId = new Map<string, any[]>();

  for (const exception of exceptions) {
    if (
      exception.linked_task_id &&
      !exceptionByTaskId.has(exception.linked_task_id)
    ) {
      exceptionByTaskId.set(exception.linked_task_id, exception);
    }

    const relatedKey = `${exception.related_object_type}:${exception.related_object_id}`;
    if (!exceptionByRelatedKey.has(relatedKey)) {
      exceptionByRelatedKey.set(relatedKey, []);
    }
    exceptionByRelatedKey.get(relatedKey)?.push(exception);
  }

  for (const document of documents) {
    if (document.related_object_type !== "Flight") continue;
    if (!documentByFlightId.has(document.related_object_id)) {
      documentByFlightId.set(document.related_object_id, []);
    }
    documentByFlightId.get(document.related_object_id)?.push(document);
  }

  const relatedObjectLabel = (item: {
    related_object_type: string;
    related_object_id: string;
  }) => {
    if (item.related_object_type === "Flight") {
      return (
        flightById.get(item.related_object_id)?.flight_no ||
        flightByNo.get(item.related_object_id)?.flight_no ||
        item.related_object_id
      );
    }

    if (item.related_object_type === "AWB") {
      return (
        awbById.get(item.related_object_id)?.awb_no ||
        awbByNo.get(item.related_object_id)?.awb_no ||
        item.related_object_id
      );
    }

    return item.related_object_id;
  };

  const openTasks = tasks.filter(
    (item: any) => !COMPLETED_TASK_STATUSES.has(item.task_status),
  );
  const openExceptions = exceptions.filter(
    (item: any) =>
      !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) &&
      item.blocker_flag,
  );
  const blockerTasks = openTasks.filter((item: any) =>
    Boolean(item.blocker_code),
  );

  const summaryCards = [
    {
      title: "待领取任务",
      value: String(
        tasks.filter((item: any) =>
          ["Created", "Assigned", "Accepted"].includes(item.task_status),
        ).length,
      ),
      helper: "Created / Assigned / Accepted",
      chip: "Queue",
      color: "warning",
    },
    {
      title: "处理中任务",
      value: String(
        tasks.filter((item: any) =>
          ["Started", "Evidence Uploaded", "Exception Raised"].includes(
            item.task_status,
          ),
        ).length,
      ),
      helper: "Started / Evidence / Exception",
      chip: "Active",
      color: "secondary",
    },
    {
      title: "已完成任务",
      value: String(
        tasks.filter((item: any) =>
          ["Completed", "Verified", "Closed"].includes(item.task_status),
        ).length,
      ),
      helper: `总任务 ${tasks.length}`,
      chip: "Done",
      color: "success",
    },
    {
      title: "阻断任务",
      value: String(
        tasks.filter(
          (item: any) =>
            Boolean(item.blocker_code) || exceptionByTaskId.has(item.task_id),
        ).length,
      ),
      helper: "带 Gate 或异常的任务",
      chip: "Block",
      color: "error",
    },
  ];

  const stationTasks = tasks.map((item: any) => {
    const relatedException =
      exceptionByTaskId.get(item.task_id) ||
      exceptionByRelatedKey.get(
        `${item.related_object_type}:${item.related_object_id}`,
      )?.[0] ||
      null;
    const assignee =
      item.team_name ||
      item.assigned_team_id ||
      item.assigned_worker_id ||
      item.assigned_role ||
      item.station_id;

    return {
      id: item.task_id,
      title: item.task_type,
      node: item.execution_node,
      role: item.assigned_role || "--",
      owner: assignee || "--",
      due: formatDashboardClock(item.due_at),
      priority:
        item.blocker_code || relatedException
          ? relatedException?.severity === "P1"
            ? "P1"
            : "P2"
          : "P3",
      status: item.task_status,
      gateIds: item.blocker_code
        ? [item.blocker_code]
        : relatedException?.exception_id
          ? [relatedException.exception_id]
          : [],
      blocker:
        item.blocker_code ||
        relatedException?.root_cause ||
        relatedException?.action_taken ||
        "无",
      objectTo:
        item.related_object_type === "Flight"
          ? `/station/inbound/flights/${encodeURIComponent(relatedObjectLabel(item))}`
          : item.related_object_type === "AWB"
            ? `/station/inbound/waybills/${encodeURIComponent(relatedObjectLabel(item))}`
            : item.related_object_type === "Shipment"
              ? `/station/shipments/${encodeURIComponent(item.related_object_id)}`
              : "/station/shipments",
      exceptionId: relatedException?.exception_id || "",
      openExceptionCount: relatedException ? 1 : 0,
    };
  });

  const stationTaskBlockerQueue = [
    ...blockerTasks.slice(0, 4).map((item: any) => ({
      id: item.task_id,
      title: `${relatedObjectLabel(item)} · ${item.blocker_code || item.task_type}`,
      description: item.execution_node || item.task_type,
      status: "阻塞",
      meta: `${item.assigned_role || item.team_name || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`,
    })),
    ...openExceptions.slice(0, 4).map((item: any) => ({
      id: item.exception_id,
      title: `${relatedObjectLabel(item)} · ${item.exception_type}`,
      description: item.root_cause || item.action_taken || item.exception_type,
      status: "警戒",
      meta: `${item.severity || "P2"} · ${formatOverviewTime(item.opened_at)}`,
    })),
  ].slice(0, 4);

  const stationTaskReviewQueue = openTasks
    .sort((left: any, right: any) =>
      String(left.due_at || "9999-12-31").localeCompare(
        String(right.due_at || "9999-12-31"),
      ),
    )
    .slice(0, 4)
    .map((item: any) => ({
      id: item.task_id,
      title: item.task_type,
      description: `${item.execution_node} · ${relatedObjectLabel(item)}`,
      status: normalizeDashboardTaskStatus(item.task_status),
      releaseRole:
        item.assigned_role || item.team_name || "需独立复核或主管确认",
      meta: `${item.assigned_role || item.team_name || "需独立复核或主管确认"} · ${item.execution_node || relatedObjectLabel(item)}`,
      gateId:
        item.blocker_code ||
        exceptionByTaskId.get(item.task_id)?.exception_id ||
        "",
    }));

  const inboundFlights = flights.filter(
    (item: any) => item.destination_code === stationId,
  );
  const outboundFlights = flights.filter(
    (item: any) => item.origin_code === stationId,
  );
  const primaryInboundFlight = inboundFlights[0];
  const primaryOutboundFlight = outboundFlights[0];
  const acceptedDocStatuses = new Set([
    "Uploaded",
    "Released",
    "Approved",
    "Accepted",
    "Verified",
    "Closed",
  ]);

  const buildDocumentGate = (
    gateId: string,
    node: string,
    required: string,
    impact: string,
    releaseRole: string,
    flight: any,
    missingDocTypes: string[],
    fallbackBlocker: string,
    recoveryText: string,
  ) => ({
    gateId,
    node,
    required,
    impact,
    status: missingDocTypes.length || fallbackBlocker ? "警戒" : "运行中",
    blocker:
      fallbackBlocker ||
      (missingDocTypes.length
        ? `${flight?.flight_no || "航班"} 缺 ${missingDocTypes.join(" / ")}`
        : "文件链已就绪"),
    recovery: recoveryText,
    releaseRole,
  });

  const inboundFlightDocuments = primaryInboundFlight
    ? documentByFlightId.get(primaryInboundFlight.flight_id) ||
      documentByFlightId.get(primaryInboundFlight.flight_no) ||
      []
    : [];
  const outboundFlightDocuments = primaryOutboundFlight
    ? documentByFlightId.get(primaryOutboundFlight.flight_id) ||
      documentByFlightId.get(primaryOutboundFlight.flight_no) ||
      []
    : [];
  const inboundPresentDocTypes = new Set(
    inboundFlightDocuments
      .filter((item: any) =>
        acceptedDocStatuses.has(String(item.document_status)),
      )
      .map((item: any) => item.document_type),
  );
  const outboundPresentDocTypes = new Set(
    outboundFlightDocuments
      .filter((item: any) =>
        acceptedDocStatuses.has(String(item.document_status)),
      )
      .map((item: any) => item.document_type),
  );
  const inboundMissingDocTypes = ["CBA", "Manifest"].filter(
    (type) => !inboundPresentDocTypes.has(type),
  );
  const outboundMissingDocTypes = ["FFM", "Manifest"].filter(
    (type) => !outboundPresentDocTypes.has(type),
  );
  const inboundTaskBlocker = blockerTasks.find(
    (item: any) =>
      item.related_object_type === "Flight" &&
      item.related_object_id ===
        String(primaryInboundFlight?.flight_id || "") &&
      item.blocker_code,
  );
  const outboundTaskBlocker = blockerTasks.find(
    (item: any) =>
      item.related_object_type === "Flight" &&
      item.related_object_id ===
        String(primaryOutboundFlight?.flight_id || "") &&
      item.blocker_code,
  );
  const inboundException = openExceptions.find(
    (item: any) =>
      item.related_object_type === "Flight" &&
      item.related_object_id === String(primaryInboundFlight?.flight_id || ""),
  );
  const outboundException = openExceptions.find(
    (item: any) =>
      item.related_object_type === "Flight" &&
      item.related_object_id === String(primaryOutboundFlight?.flight_id || ""),
  );

  const stationTaskInboundDocumentGates = [
    buildDocumentGate(
      "HG-01",
      "进港落地 -> 进港处理",
      "CBA / Manifest",
      "允许生成 PMC 拆板、理货、分区任务",
      "Document Desk / Inbound Supervisor",
      primaryInboundFlight,
      inboundMissingDocTypes,
      inboundTaskBlocker?.blocker_code || inboundException?.root_cause || "",
      inboundTaskBlocker?.blocker_code ||
        inboundException?.action_taken ||
        (inboundMissingDocTypes.length
          ? `补齐 ${inboundMissingDocTypes.join(" / ")}`
          : "保持文档版本冻结"),
    ),
    buildDocumentGate(
      "HG-03",
      "PMC 拆板 -> 理货完成",
      "件数 / 差异复核记录",
      "允许 NOA 与二次转运推进",
      "Check Worker / Station Supervisor",
      primaryInboundFlight,
      openTasks.filter(
        (item: any) =>
          item.related_object_type === "Flight" &&
          item.related_object_id ===
            String(primaryInboundFlight?.flight_id || "") &&
          !COMPLETED_TASK_STATUSES.has(item.task_status),
      ).length
        ? ["差异复核"]
        : [],
      inboundTaskBlocker?.blocker_code || inboundException?.root_cause || "",
      inboundException?.action_taken || "补齐差异复核并更新计数结果",
    ),
    buildDocumentGate(
      "HG-06",
      "装车 / POD -> 交付关闭",
      "POD / 车牌 / 司机",
      "允许二次转运与交付关闭",
      "Delivery Desk / Station Supervisor",
      primaryOutboundFlight || primaryInboundFlight,
      outboundMissingDocTypes.length ? outboundMissingDocTypes : [],
      outboundTaskBlocker?.blocker_code || outboundException?.root_cause || "",
      outboundTaskBlocker?.blocker_code ||
        outboundException?.action_taken ||
        (outboundMissingDocTypes.length
          ? "补齐 POD 双签并回写签收状态"
          : "交付闭环待确认"),
    ),
  ];

  const stationTaskOutboundDocumentGates = [
    buildDocumentGate(
      "HG-02",
      "出港计划 -> 文件冻结",
      "FFM / Manifest",
      "允许出港计划和装机编排",
      "Document Desk / Export Supervisor",
      primaryOutboundFlight,
      outboundMissingDocTypes,
      outboundTaskBlocker?.blocker_code || outboundException?.root_cause || "",
      outboundTaskBlocker?.blocker_code ||
        outboundException?.action_taken ||
        (outboundMissingDocTypes.length
          ? `补齐 ${outboundMissingDocTypes.join(" / ")}`
          : "保持文件冻结"),
    ),
    buildDocumentGate(
      "HG-05",
      "装机确认 -> 放行",
      "ULD / 机位 / 司机",
      "允许 Loaded / Airborne 确认",
      "Export Supervisor / Station Supervisor",
      primaryOutboundFlight,
      openTasks.filter(
        (item: any) =>
          item.related_object_type === "Flight" &&
          item.related_object_id ===
            String(primaryOutboundFlight?.flight_id || "") &&
          !COMPLETED_TASK_STATUSES.has(item.task_status),
      ).length
        ? ["装机确认"]
        : [],
      outboundTaskBlocker?.blocker_code || outboundException?.root_cause || "",
      outboundTaskBlocker?.blocker_code ||
        outboundException?.action_taken ||
        "补齐装机确认并回写机坪状态",
    ),
    buildDocumentGate(
      "HG-08",
      "Loaded -> 航班放行",
      "Loaded / Supervisor 确认",
      "允许机坪放行和后续关单",
      "Export Supervisor",
      primaryOutboundFlight,
      outboundMissingDocTypes.length ? outboundMissingDocTypes : [],
      outboundTaskBlocker?.blocker_code || outboundException?.root_cause || "",
      outboundTaskBlocker?.blocker_code ||
        outboundException?.action_taken ||
        "完成门槛复核并放行",
    ),
  ];

  const stationTaskTimelineRows = [
    {
      label: "任务接入",
      metric: `${tasks.length} 个任务`,
      note: tasks.length
        ? `${openTasks.length} 个任务仍在流转中`
        : "暂无站内任务",
      progress: tasks.length ? 100 : 0,
    },
    {
      label: "门槛评估",
      metric: `${stationTaskInboundDocumentGates.filter((item) => item.status !== "运行中").length + stationTaskOutboundDocumentGates.filter((item) => item.status !== "运行中").length} 个待处理门槛`,
      note: "站点级文档、计数和放行门槛已统一评估",
      progress: 78,
    },
    {
      label: "异常联动",
      metric: `${openExceptions.length} 个开放异常`,
      note: openExceptions.length
        ? "异常摘要已挂接到任务卡片"
        : "当前没有开放异常",
      progress: openExceptions.length ? 56 : 100,
    },
    {
      label: "执行闭环",
      metric: `${tasks.filter((item: any) => COMPLETED_TASK_STATUSES.has(item.task_status)).length} 个已完成`,
      note: "完成、复核和关闭状态均从后端汇总",
      progress: tasks.length
        ? clampNumber(
            Math.round(
              (tasks.filter((item: any) =>
                COMPLETED_TASK_STATUSES.has(item.task_status),
              ).length /
                Math.max(tasks.length, 1)) *
                100,
            ),
            0,
            100,
          )
        : 0,
    },
  ];

  const taskGateEvaluationRows = stationTasks.flatMap(
    (task: any, index: number) => {
      const relatedException =
        exceptionByTaskId.get(task.id) ||
        (task.exceptionId
          ? exceptions.find(
              (item: any) => item.exception_id === task.exceptionId,
            )
          : null);
      const gateId =
        task.gateIds[0] ||
        relatedException?.exception_id ||
        `HG-TASK-${index + 1}`;
      const blockerReason =
        task.blocker !== "无"
          ? task.blocker
          : relatedException?.root_cause ||
            relatedException?.action_taken ||
            task.title;
      return [
        {
          id: `${task.id}-${gateId}`,
          gateId,
          node: task.node,
          required: task.role || "任务角色",
          impact:
            task.status === "Completed" ||
            task.status === "Verified" ||
            task.status === "Closed"
              ? "已满足"
              : "待确认",
          status:
            task.status === "Completed" ||
            task.status === "Verified" ||
            task.status === "Closed"
              ? "运行中"
              : "待处理",
          blocker: blockerReason,
          recovery:
            relatedException?.action_taken ||
            task.blocker ||
            "完成任务并回写状态",
          releaseRole: task.role === "--" ? "Station Supervisor" : task.role,
          title: `${task.title} · ${gateId}`,
          description: blockerReason,
          meta: `恢复动作：${relatedException?.action_taken || task.blocker || "完成任务并回写状态"} · 放行角色：${task.role === "--" ? "Station Supervisor" : task.role}`,
          actions: [
            { label: "对象详情", to: task.objectTo, variant: "outlined" },
            {
              label: "单证中心",
              to: "/station/documents",
              variant: "outlined",
            },
            {
              label: "异常中心",
              to: "/station/exceptions",
              variant: "outlined",
            },
          ],
        },
      ];
    },
  );

  const stationTaskExceptionRows = exceptions.map((item: any) => ({
    id: item.exception_id,
    title: item.exception_type,
    status: item.exception_status,
    blocker: item.blocker_flag ? "阻断中" : "-",
    summary: item.root_cause || item.action_taken || item.exception_type,
    objectTo:
      item.related_object_type === "Flight"
        ? `/station/inbound/flights/${encodeURIComponent(relatedObjectLabel(item))}`
        : item.related_object_type === "AWB"
          ? `/station/inbound/waybills/${encodeURIComponent(relatedObjectLabel(item))}`
          : "/station/exceptions",
  }));

  return {
    stationTasks,
    stationTaskSummaryCards: summaryCards,
    stationTaskBlockerQueue,
    stationTaskReviewQueue,
    stationTaskInboundDocumentGates,
    stationTaskOutboundDocumentGates,
    stationTaskTimelineRows,
    stationTaskGateEvaluationRows: taskGateEvaluationRows,
    stationTaskExceptionRows,
  };
}

function normalizeStationExceptionObjectTo(item: {
  related_object_type: string;
  related_object_id: string;
  related_object_label?: string | null;
}) {
  if (item.related_object_type === "Flight") {
    const flightNo =
      String(item.related_object_label || "").split(" / ")[0] ||
      item.related_object_id;
    return flightNo
      ? `/station/inbound/flights/${encodeURIComponent(flightNo)}`
      : "/station/inbound/flights";
  }

  if (item.related_object_type === "AWB") {
    const awbNo =
      String(item.related_object_label || "").split(" / ")[0] ||
      item.related_object_id;
    return awbNo
      ? `/station/inbound/waybills/${encodeURIComponent(awbNo)}`
      : "/station/inbound/waybills";
  }

  if (item.related_object_type === "Task") {
    return "/station/tasks";
  }

  return "/station/shipments";
}

function normalizeStationExceptionJumpTo(item: {
  gate_id?: string | null;
  related_object_type: string;
  related_object_id: string;
  related_object_label?: string | null;
}) {
  if (item.gate_id === "HG-01") {
    return "/station/documents";
  }

  if (item.gate_id === "HG-03" || item.related_object_type === "Task") {
    return "/station/tasks";
  }

  if (item.gate_id === "HG-06") {
    return normalizeStationExceptionObjectTo(item);
  }

  return normalizeStationExceptionObjectTo(item);
}

function normalizeStationExceptionBlockedTask(item: {
  gate_id?: string | null;
  linked_task_label?: string | null;
  related_object_type: string;
  exception_type: string;
}) {
  if (item.linked_task_label) {
    return item.linked_task_label;
  }

  if (item.gate_id === "HG-01") return "机坪放行 / 飞走归档";
  if (item.gate_id === "HG-03") return "NOA 发送 / 二次转运任务";
  if (item.gate_id === "HG-06") return "交付关闭 / Closed";
  if (item.related_object_type === "Task") return "任务恢复 / 重新校验";

  return item.exception_type;
}

function buildStationExceptionOverviewCards(
  items: Array<{
    exception_status: string;
    blocker_flag: boolean;
    severity: string;
  }>,
) {
  const openCount = items.filter(
    (item) => item.exception_status === "Open",
  ).length;
  const blockingCount = items.filter((item) => item.blocker_flag).length;
  const p1Count = items.filter((item) => item.severity === "P1").length;
  const resolvedCount = items.filter((item) =>
    ["Resolved", "Closed"].includes(item.exception_status),
  ).length;

  return [
    {
      title: "开放异常",
      value: String(openCount),
      helper: "当前待处理异常",
      chip: "Open",
      color: "warning",
    },
    {
      title: "阻断异常",
      value: String(blockingCount),
      helper: "会阻断主链推进",
      chip: "Block",
      color: "error",
    },
    {
      title: "P1 异常",
      value: String(p1Count),
      helper: "高优先级异常",
      chip: "Priority",
      color: "secondary",
    },
    {
      title: "已恢复/关闭",
      value: String(resolvedCount),
      helper: `总异常 ${items.length}`,
      chip: "Closed",
      color: "success",
    },
  ];
}

function buildStationExceptionGatePolicySummary(detail: {
  gate_id?: string | null;
  exception_type: string;
  required_gate?: string | null;
  blocker_flag: boolean;
  exception_status: string;
  root_cause?: string | null;
  recovery_action?: string | null;
  action_taken?: string | null;
  owner_role?: string | null;
}) {
  const gateId = String(detail.gate_id || "").trim() || "EXC";
  const summary = [
    {
      gate_id: gateId,
      node: String(detail.exception_type || "异常").trim(),
      required: String(detail.required_gate || "需完成异常恢复与复核").trim(),
      impact: detail.blocker_flag ? "当前阻断主链推进" : "当前不阻断主链",
      status: String(detail.exception_status || "Open").trim(),
      blocker: String(detail.root_cause || "").trim(),
      recovery: String(
        detail.recovery_action || detail.action_taken || "",
      ).trim(),
      release_role: String(detail.owner_role || "").trim(),
    },
  ];

  const blocked = detail.blocker_flag ? 1 : 0;

  return {
    gate_policy_summary: summary,
    gate_policy_overview: {
      total: summary.length,
      blocked,
      tracked: Math.max(summary.length - blocked, 0),
      gate_ids: summary.map((item) => item.gate_id),
    },
  };
}

function buildStationExceptionBlockerQueue(
  items: Array<{
    exception_id: string;
    exception_status: string;
    blocker_flag: boolean;
    severity: string;
    exception_type: string;
    related_object_label: string;
    root_cause?: string;
    action_taken?: string | null;
    related_object_type: string;
    opened_at?: string;
    gate_id?: string | null;
    linked_task_label?: string | null;
  }>,
) {
  return items
    .filter(
      (item) =>
        !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) &&
        item.blocker_flag,
    )
    .slice(0, 4)
    .map((item) => ({
      id: item.exception_id,
      gateId: item.gate_id || "HG-03",
      title: `${item.gate_id || "HG-03"} · ${item.related_object_label || item.exception_type}`,
      description: item.root_cause || item.action_taken || item.exception_type,
      status: "阻塞",
    }));
}

function buildStationExceptionRecoveryRows(
  items: Array<{
    exception_id: string;
    exception_type: string;
    related_object_type: string;
    related_object_id: string;
    related_object_label: string;
    severity: string;
    owner_role: string;
    owner_team_id?: string | null;
    exception_status: string;
    blocker_flag: boolean;
    root_cause?: string;
    opened_at?: string;
    gate_id?: string | null;
    required_gate?: string | null;
    recovery_action?: string | null;
    linked_task_label?: string | null;
  }>,
) {
  return items
    .filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status))
    .sort((left, right) => {
      if (left.blocker_flag !== right.blocker_flag)
        return left.blocker_flag ? -1 : 1;
      const leftSeverity =
        left.severity === "P1" ? 0 : left.severity === "P2" ? 1 : 2;
      const rightSeverity =
        right.severity === "P1" ? 0 : right.severity === "P2" ? 1 : 2;
      if (leftSeverity !== rightSeverity) return leftSeverity - rightSeverity;
      return String(right.opened_at || "").localeCompare(
        String(left.opened_at || ""),
      );
    })
    .slice(0, 4)
    .map((item) => {
      const objectTo = normalizeStationExceptionObjectTo(item);

      return {
        id: item.exception_id,
        type: item.exception_type,
        object: item.related_object_label || item.related_object_id,
        owner:
          [item.owner_role, item.owner_team_id].filter(Boolean).join(" / ") ||
          "--",
        sla: item.severity,
        status: item.exception_status,
        blockedTask: normalizeStationExceptionBlockedTask(item),
        gateId: item.gate_id || "HG-03",
        requiredGate: item.required_gate || "需补齐阻断项后才可放行",
        recoveryAction:
          item.recovery_action || item.root_cause || "待补充恢复动作",
        detailTo: `/station/exceptions/${item.exception_id}`,
        objectTo,
        jumpTo: normalizeStationExceptionJumpTo(item),
      };
    });
}

async function loadStationExceptionsOverview(
  services: StationServices,
  query: Record<string, string | undefined>,
) {
  const list = await services.listStationExceptions(query);
  const items = list.items || [];
  const detailEntries = await Promise.all(
    items.map(async (item) => {
      const detail = await services.getStationException(item.exception_id);
      return [item.exception_id, detail] as const;
    }),
  );
  const detailById = new Map<string, any>(
    detailEntries.filter(([, detail]) => Boolean(detail)) as Array<
      readonly [string, any]
    >,
  );

  const normalizedItems = items.map((item) => {
    const detail = detailById.get(item.exception_id);

    return {
      exception_id: item.exception_id,
      exception_type: item.exception_type,
      related_object_type: item.related_object_type,
      related_object_id: item.related_object_id,
      related_object_label: item.related_object_label,
      severity: item.severity,
      owner_role: item.owner_role,
      owner_team_id: item.owner_team_id || undefined,
      exception_status: item.exception_status,
      blocker_flag: item.blocker_flag,
      root_cause: item.root_cause,
      opened_at: item.opened_at,
      gate_id: detail?.gate_id || null,
      required_gate: detail?.required_gate || null,
      recovery_action:
        detail?.recovery_action ||
        detail?.action_taken ||
        item.root_cause ||
        null,
      linked_task_label: detail?.linked_task_label || null,
    };
  });

  return {
    stationExceptions: normalizedItems.map((item) => ({
      id: item.exception_id,
      type: item.exception_type,
      object: item.related_object_label || item.related_object_id,
      owner:
        [item.owner_role, item.owner_team_id].filter(Boolean).join(" / ") ||
        "--",
      sla: item.severity,
      blockedTask: normalizeStationExceptionBlockedTask(item),
      recoveryAction:
        item.recovery_action || item.root_cause || "待补充恢复动作",
      status: item.exception_status,
      objectTo: normalizeStationExceptionObjectTo(item),
      jumpTo: normalizeStationExceptionJumpTo(item),
      detailTo: `/station/exceptions/${item.exception_id}`,
    })),
    stationExceptionOverview:
      buildStationExceptionOverviewCards(normalizedItems),
    stationBlockerQueue: buildStationExceptionBlockerQueue(normalizedItems),
    stationRecoveryRows: buildStationExceptionRecoveryRows(normalizedItems),
    page: list.page,
    page_size: list.page_size,
    total: list.total,
  };
}

function toObject<T extends Record<string, unknown>>(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : null;
}

function toArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeControlLevel(value: string | null | undefined) {
  if (!value) return "--";
  return CONTROL_LEVEL_LABELS[value] || value;
}

function normalizePhase(value: string | null | undefined) {
  if (!value) return "--";
  return PHASE_LABELS[value] || value;
}

function formatOverviewTime(value: unknown) {
  if (!value) return "--";

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) {
    return text.slice(0, 16);
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return date.toISOString().slice(0, 16).replace("T", " ");
}

function formatDashboardClock(value: unknown) {
  if (!value) return "--";

  const text = String(value);
  const match = text.match(/(?:T|\s)(\d{2}):(\d{2})/);

  if (match) {
    return `${match[1]}:${match[2]}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return date.toISOString().slice(11, 16);
}

function formatDashboardWeight(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value || 0));
}

function buildShipmentGatePolicySummary(detail: any) {
  const gateIds = new Set<string>();
  const exceptions = Array.isArray(detail?.exceptions) ? detail.exceptions : [];

  const pushGateId = (value: unknown) => {
    const gateId = String(value || "").trim();
    if (gateId) {
      gateIds.add(gateId);
    }
  };

  for (const item of Array.isArray(detail?.documents) ? detail.documents : []) {
    for (const gateId of item?.gate_ids || item?.gateIds || []) {
      pushGateId(gateId);
    }
  }

  for (const item of Array.isArray(detail?.tasks) ? detail.tasks : []) {
    for (const gateId of item?.gate_ids || item?.gateIds || []) {
      pushGateId(gateId);
    }
  }

  for (const item of exceptions) {
    pushGateId(item?.gate_id || item?.gateId);
  }

  const openExceptionByGateId = new Map<string, any>();
  for (const item of exceptions) {
    const gateId = String(item?.gate_id || item?.gateId || "").trim();
    if (!gateId) continue;
    const status = String(item?.status || item?.exception_status || "").trim();
    if (["Resolved", "Closed", "已关闭", "已恢复"].includes(status)) continue;
    if (!openExceptionByGateId.has(gateId)) {
      openExceptionByGateId.set(gateId, item);
    }
  }

  const summary = Array.from(gateIds).map((gateId) => {
    const document = (detail?.documents || []).find((item: any) =>
      Array.isArray(item?.gate_ids || item?.gateIds)
        ? (item?.gate_ids || item?.gateIds).includes(gateId)
        : false,
    );
    const task = (detail?.tasks || []).find((item: any) =>
      Array.isArray(item?.gate_ids || item?.gateIds)
        ? (item?.gate_ids || item?.gateIds).includes(gateId)
        : false,
    );
    const exception = openExceptionByGateId.get(gateId);
    const blocker = String(
      exception?.note ||
        document?.note ||
        task?.evidence ||
        "",
    ).trim();
    const recovery = String(
      exception?.note ||
        document?.note ||
        task?.evidence ||
        "补齐关联对象状态并重试",
    ).trim();
    const node = String(
      document?.type || task?.title || exception?.type || "Shipment Gate",
    ).trim();
    const required = String(
      document?.linked_task ||
        task?.title ||
        "需补齐文件、任务或异常恢复动作",
    ).trim();
    const impact = String(
      document?.note || exception?.note || "会影响履约链路推进",
    ).trim();
    const releaseRole = String(
      task?.owner || "Station Supervisor",
    ).trim();
    const status = String(
      openExceptionByGateId.has(gateId)
        ? "Blocked"
        : document?.status === "Released" || document?.status === "Approved"
          ? "Clear"
          : task?.status === "Completed" || task?.status === "Verified" || task?.status === "Closed"
            ? "Clear"
            : "Tracked",
    ).trim();

    return {
      gate_id: gateId,
      node,
      required,
      impact,
      status,
      blocker,
      recovery,
      release_role: releaseRole,
    };
  });

  const blocked = summary.filter(
    (item) =>
      ["Open", "Blocked", "阻塞", "待处理", "待升级", "警戒"].includes(
        String(item.status),
      ) || Boolean(item.blocker),
  ).length;

  return {
    gate_policy_summary: summary,
    gate_policy_overview: {
      total: summary.length,
      blocked,
      tracked: Math.max(summary.length - blocked, 0),
      gate_ids: summary.map((item) => item.gate_id),
    },
  };
}

async function loadStationShipmentOptions(
  db: any,
  stationId: string,
): Promise<{
  directionOptions: PlatformSelectOption[];
  flightOptions: PlatformSelectOption[];
  currentNodeOptions: PlatformSelectOption[];
  fulfillmentStatusOptions: PlatformSelectOption[];
  blockerStateOptions: PlatformSelectOption[];
}> {
  const [directionRows, flightRows, currentNodeRows, fulfillmentRows, blockerCountRows] = await Promise.all([
    db
      .prepare(
        `
          SELECT DISTINCT COALESCE(shipment_type, 'import') AS shipment_type
          FROM shipments
          WHERE station_id = ?
          ORDER BY shipment_type ASC
        `,
      )
      .bind(stationId)
      .all(),
    db
      .prepare(
        `
          SELECT DISTINCT f.flight_id, f.flight_no, f.deleted_at
          FROM shipments s
          JOIN awbs a ON a.shipment_id = s.shipment_id
          LEFT JOIN flights f ON f.flight_id = a.flight_id
          WHERE s.station_id = ? AND a.deleted_at IS NULL AND f.flight_id IS NOT NULL
          ORDER BY COALESCE(f.flight_date, '9999-12-31') DESC, f.flight_no ASC
        `,
      )
      .bind(stationId)
      .all(),
    db
      .prepare(
        `
          SELECT DISTINCT current_node
          FROM shipments
          WHERE station_id = ? AND COALESCE(current_node, '') != ''
          ORDER BY current_node ASC
        `,
      )
      .bind(stationId)
      .all(),
    db
      .prepare(
        `
          SELECT DISTINCT fulfillment_status
          FROM shipments
          WHERE station_id = ? AND COALESCE(fulfillment_status, '') != ''
          ORDER BY fulfillment_status ASC
        `,
      )
      .bind(stationId)
      .all(),
    db
      .prepare(
        `
          SELECT
            SUM(
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM exceptions ex
                  JOIN awbs a ON a.shipment_id = s.shipment_id
                  WHERE ex.exception_status NOT IN ('Resolved', 'Closed')
                    AND (
                      (ex.related_object_type = 'Shipment' AND ex.related_object_id = s.shipment_id)
                      OR (ex.related_object_type = 'AWB' AND ex.related_object_id = a.awb_id)
                      OR (ex.related_object_type = 'Flight' AND ex.related_object_id = a.flight_id)
                    )
                ) THEN 1
                ELSE 0
              END
            ) AS blocked_count,
            COUNT(*) AS total_count
          FROM shipments s
          WHERE s.station_id = ?
        `,
      )
      .bind(stationId)
      .first(),
  ]);

  const blockedCount = Number((blockerCountRows as any)?.blocked_count ?? 0);
  const totalCount = Number((blockerCountRows as any)?.total_count ?? 0);

  return {
    directionOptions: ((directionRows as any)?.results || []).map((row: any) => {
      const outbound = row.shipment_type === "export";
      return {
        value: outbound ? "outbound" : "inbound",
        label: outbound ? "出港" : "进港",
        disabled: false,
        meta: { shipment_type: row.shipment_type },
      };
    }),
    flightOptions: ((flightRows as any)?.results || []).map((row: any) => ({
      value: row.flight_id,
      label: row.flight_no,
      disabled: Boolean(row.deleted_at),
      meta: { flight_id: row.flight_id },
    })),
    currentNodeOptions: ((currentNodeRows as any)?.results || []).map((row: any) => ({
      value: row.current_node,
      label: row.current_node,
      disabled: false,
      meta: {},
    })),
    fulfillmentStatusOptions: ((fulfillmentRows as any)?.results || []).map((row: any) => ({
      value: row.fulfillment_status,
      label: row.fulfillment_status,
      disabled: false,
      meta: {},
    })),
    blockerStateOptions: [
      ...(blockedCount > 0
        ? [{ value: "blocked", label: "存在阻断", disabled: false, meta: { count: blockedCount } }]
        : []),
      ...(totalCount - blockedCount > 0
        ? [{ value: "clear", label: "无阻断", disabled: false, meta: { count: totalCount - blockedCount } }]
        : []),
    ],
  };
}

function normalizeDashboardTaskStatus(status: string) {
  if (status === "Completed" || status === "Verified" || status === "Closed")
    return "已完成";
  if (status === "Started") return "处理中";
  if (status === "Accepted" || status === "Assigned" || status === "Created")
    return "待复核";
  return status || "待处理";
}

function normalizeResourceStatus(value: unknown) {
  const text = String(value || "").trim();

  if (!text) return "待处理";

  const lower = text.toLowerCase();
  if (
    text === "运行中" ||
    lower === "active" ||
    lower === "running" ||
    lower === "online" ||
    lower === "enabled"
  )
    return "运行中";
  if (
    text === "警戒" ||
    lower === "warning" ||
    lower === "warn" ||
    lower === "attention"
  )
    return "警戒";
  if (
    text === "停用" ||
    lower === "inactive" ||
    lower === "disabled" ||
    lower === "offline"
  )
    return "停用";
  if (
    text === "待处理" ||
    lower === "pending" ||
    lower === "draft" ||
    lower === "queued"
  )
    return "待处理";

  return text;
}

function normalizeShiftLabel(value: unknown) {
  const text = String(value || "").trim();

  if (!text) return "待定";

  const lower = text.toLowerCase();
  if (text === "白班" || lower === "day" || lower === "day_shift")
    return "白班";
  if (text === "夜班" || lower === "night" || lower === "night_shift")
    return "夜班";
  if (text === "中班" || lower === "swing" || lower === "mid") return "中班";

  return text;
}

function mapDbTeamRowToResourceTeam(row: {
  team_id: string;
  team_name: string;
  owner_name: string | null;
  shift_code: string | null;
  team_status: string | null;
}) {
  return {
    id: row.team_id,
    name: row.team_name,
    shift: normalizeShiftLabel(row.shift_code),
    owner: row.owner_name || row.team_name,
    status: normalizeResourceStatus(row.team_status),
  };
}

async function fetchOverviewRows<T>(db: any, sql: string) {
  if (!db) return [];

  const rows = await db.prepare(sql).all();
  return (rows?.results || []) as T[];
}

async function loadStationDashboardOverview(db: any, stationId: string) {
  const [flights, awbs, tasks, exceptions, loadingPlans, documents]: [
    DashboardFlightRow[],
    DashboardAwbRow[],
    DashboardTaskRow[],
    DashboardExceptionRow[],
    DashboardLoadingPlanRow[],
    DashboardDocumentRow[],
  ] = db
    ? await Promise.all([
        db
          .prepare(
            `
              SELECT
                flight_id,
                flight_no,
                eta_at,
                etd_at,
                origin_code,
                destination_code,
                runtime_status,
                service_level
              FROM flights
              WHERE station_id = ?
              ORDER BY COALESCE(eta_at, etd_at, std_at, flight_no) ASC, flight_no ASC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as DashboardFlightRow[]),
        db
          .prepare(
            `
              SELECT
                awb_id,
                awb_no,
                flight_id,
                pieces,
                gross_weight,
                noa_status,
                pod_status,
                transfer_status,
                manifest_status
              FROM awbs
              WHERE station_id = ?
              ORDER BY awb_no ASC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as DashboardAwbRow[]),
        db
          .prepare(
            `
              SELECT
                task_id,
                station_id,
                task_type,
                execution_node,
                related_object_type,
                related_object_id,
                assigned_role,
                assigned_team_id,
                assigned_worker_id,
                task_status,
                due_at,
                blocker_code
              FROM tasks
              WHERE station_id = ?
              ORDER BY COALESCE(due_at, created_at) ASC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as DashboardTaskRow[]),
        db
          .prepare(
            `
              SELECT
                exception_id,
                station_id,
                exception_type,
                related_object_type,
                related_object_id,
                severity,
                exception_status,
                blocker_flag,
                root_cause,
                action_taken,
                opened_at
              FROM exceptions
              WHERE station_id = ?
              ORDER BY opened_at DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then(
            (rows: any) => (rows?.results || []) as DashboardExceptionRow[],
          ),
        db
          .prepare(
            `
              SELECT
                loading_plan_id,
                station_id,
                flight_no,
                truck_plate,
                driver_name,
                depart_time,
                arrival_time,
                plan_status,
                created_at
              FROM loading_plans
              WHERE station_id = ?
              ORDER BY COALESCE(depart_time, arrival_time, created_at) DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then(
            (rows: any) => (rows?.results || []) as DashboardLoadingPlanRow[],
          ),
        db
          .prepare(
            `
              SELECT
                document_id,
                related_object_id,
                document_status,
                document_type
              FROM documents
              WHERE station_id = ?
                AND related_object_type = 'Flight'
                AND document_type = 'Manifest'
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as DashboardDocumentRow[]),
      ])
    : [[], [], [], [], [], []];

  const flightById = new Map<string, DashboardFlightRow>(
    flights.map((item) => [item.flight_id, item] as const),
  );
  const flightByNo = new Map<string, DashboardFlightRow>(
    flights.map((item) => [item.flight_no, item] as const),
  );
  const awbsByFlightId = new Map<string, DashboardAwbRow[]>();
  const manifestByFlightId = new Map<string, DashboardDocumentRow>();
  const tasksByFlightId = new Map<string, DashboardTaskRow[]>();

  for (const awb of awbs) {
    if (!awbsByFlightId.has(awb.flight_id)) {
      awbsByFlightId.set(awb.flight_id, []);
    }
    awbsByFlightId.get(awb.flight_id)?.push(awb);
  }

  for (const document of documents) {
    manifestByFlightId.set(document.related_object_id, document);
  }

  for (const task of tasks) {
    if (task.related_object_type !== "Flight") continue;
    if (!tasksByFlightId.has(task.related_object_id)) {
      tasksByFlightId.set(task.related_object_id, []);
    }
    tasksByFlightId.get(task.related_object_id)?.push(task);
  }

  const outboundFlights = flights
    .filter((item) => item.origin_code === stationId)
    .map((item) => {
      const flightAwbs = awbsByFlightId.get(item.flight_id) || [];
      const openTasks = tasksByFlightId.get(item.flight_id) || [];
      const manifest = manifestByFlightId.get(item.flight_id);
      const totalPieces = flightAwbs.reduce(
        (sum, awb) => sum + Number(awb.pieces || 0),
        0,
      );
      const totalWeight = flightAwbs.reduce(
        (sum, awb) => sum + Number(awb.gross_weight || 0),
        0,
      );
      const manifestStatus =
        manifest?.document_status ||
        flightAwbs.find(
          (awb) => awb.manifest_status && awb.manifest_status !== "Pending",
        )?.manifest_status ||
        "待生成";
      const stage =
        openTasks[0]?.execution_node ||
        (manifest?.document_status === "Approved"
          ? "主单完成"
          : manifest
            ? "待 Manifest"
            : item.runtime_status);

      return {
        flightNo: item.flight_no,
        etd: formatDashboardClock(item.etd_at),
        status: item.runtime_status,
        stage,
        manifest: manifestStatus,
        cargo: `${flightAwbs.length} AWB / ${totalPieces} pcs / ${formatDashboardWeight(totalWeight)} kg`,
      };
    });

  const inboundFlights = flights
    .filter((item) => item.destination_code === stationId)
    .map((item) => {
      const flightAwbs = awbsByFlightId.get(item.flight_id) || [];
      const openTasks = tasksByFlightId.get(item.flight_id) || [];
      const totalPieces = flightAwbs.reduce(
        (sum, awb) => sum + Number(awb.pieces || 0),
        0,
      );
      const totalWeight = flightAwbs.reduce(
        (sum, awb) => sum + Number(awb.gross_weight || 0),
        0,
      );
      const blockerTask = openTasks.find((task) => task.blocker_code);

      return {
        flightNo: item.flight_no,
        eta: formatDashboardClock(item.eta_at),
        step:
          blockerTask?.execution_node ||
          openTasks[0]?.execution_node ||
          item.runtime_status,
        priority: item.service_level || (blockerTask ? "P1" : "P2"),
        cargo: `${totalPieces} pcs / ${formatDashboardWeight(totalWeight)} kg`,
      };
    });

  const stationDashboardCards = [
    {
      title: "今日进港航班",
      value: String(inboundFlights.length),
      helper: "当前站点入港处理批次",
      chip: "Inbound",
      color: "primary",
    },
    {
      title: "今日出港航班",
      value: String(outboundFlights.length),
      helper: "当前站点出港协同批次",
      chip: "Outbound",
      color: "secondary",
    },
    {
      title: "待发 NOA",
      value: String(
        awbs.filter((item) => item.noa_status === "Pending").length,
      ),
      helper: "已到站但未触发 NOA 的 AWB",
      chip: "Queue",
      color: "warning",
    },
    {
      title: "待补 POD",
      value: String(
        awbs.filter(
          (item) =>
            item.pod_status === "Pending" || item.pod_status === "Missing",
        ).length,
      ),
      helper: "已交付但签收未归档的 AWB",
      chip: "Action",
      color: "error",
    },
  ];

  const relatedObjectLabel = (item: {
    related_object_type: string;
    related_object_id: string;
  }) => {
    if (item.related_object_type === "Flight") {
      return (
        flightById.get(item.related_object_id)?.flight_no ||
        flightByNo.get(item.related_object_id)?.flight_no ||
        item.related_object_id
      );
    }

    if (item.related_object_type === "AWB") {
      return (
        awbs.find(
          (awb) =>
            awb.awb_id === item.related_object_id ||
            awb.awb_no === item.related_object_id,
        )?.awb_no || item.related_object_id
      );
    }

    return item.related_object_id;
  };

  const stationBlockerQueue = [
    ...tasks
      .filter(
        (item) =>
          !COMPLETED_TASK_STATUSES.has(item.task_status) &&
          Boolean(item.blocker_code),
      )
      .slice(0, 4)
      .map((item) => ({
        id: item.task_id,
        title: `${relatedObjectLabel(item)} · ${item.blocker_code || item.task_type}`,
        description: item.execution_node || item.task_type,
        status: "阻塞",
        meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`,
      })),
    ...exceptions
      .filter(
        (item) =>
          !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) &&
          Boolean(Number(item.blocker_flag)),
      )
      .slice(0, 4)
      .map((item) => ({
        id: item.exception_id,
        title: `${relatedObjectLabel(item)} · ${item.exception_type}`,
        description:
          item.root_cause || item.action_taken || item.exception_type,
        status: "警戒",
        meta: `${item.severity} · ${formatOverviewTime(item.opened_at)}`,
      })),
  ].slice(0, 4);

  const stationReviewQueue = tasks
    .filter((item) => !COMPLETED_TASK_STATUSES.has(item.task_status))
    .sort((left, right) =>
      (left.due_at || "9999-12-31").localeCompare(right.due_at || "9999-12-31"),
    )
    .slice(0, 4)
    .map((item) => ({
      id: item.task_id,
      title: item.task_type,
      description: `${item.execution_node} · ${relatedObjectLabel(item)}`,
      status: normalizeDashboardTaskStatus(item.task_status),
      meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`,
    }));

  const stationTransferRows = loadingPlans
    .map((item) => {
      const flight = flights.find(
        (flightRow) => flightRow.flight_no === item.flight_no,
      );
      const flightAwbs = flight
        ? awbsByFlightId.get(flight.flight_id) || []
        : [];
      const awbNo = flightAwbs[0]?.awb_no || "--";

      return {
        transferId: item.loading_plan_id,
        awb: awbNo,
        destination: flight?.destination_code || "--",
        plate: item.truck_plate,
        driver: item.driver_name || "--",
        departAt: formatDashboardClock(
          item.depart_time || item.arrival_time || item.created_at,
        ),
        status: item.plan_status,
      };
    })
    .slice(0, 3);

  return {
    stationDashboardCards,
    inboundFlights,
    outboundFlights,
    stationBlockerQueue,
    stationReviewQueue,
    stationTransferRows,
  };
}

async function loadStationOutboundOverview(db: any, stationId: string) {
  const [
    flights,
    awbs,
    tasks,
    exceptions,
    documents,
    loadingPlans,
    receipts,
    containers,
    containerItems,
  ]: [any[], any[], any[], any[], any[], any[], any[], any[], any[]] = db
    ? await Promise.all([
        db
          .prepare(
            `
              SELECT
                flight_id,
                flight_no,
                flight_date,
                origin_code,
                destination_code,
                std_at,
                etd_at,
                runtime_status,
                service_level
              FROM flights
              WHERE station_id = ?
              ORDER BY COALESCE(etd_at, std_at, flight_date, flight_no) ASC, flight_no ASC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                awb_id,
                awb_no,
                shipment_id,
                flight_id,
                shipper_name,
                consignee_name,
                goods_description,
                pieces,
                gross_weight,
                current_node,
                noa_status,
                pod_status,
                transfer_status,
                manifest_status
              FROM awbs
              WHERE station_id = ?
              ORDER BY awb_no ASC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                task_id,
                station_id,
                task_type,
                execution_node,
                related_object_type,
                related_object_id,
                assigned_role,
                assigned_team_id,
                assigned_worker_id,
                task_status,
                due_at,
                blocker_code,
                created_at
              FROM tasks
              WHERE station_id = ?
              ORDER BY COALESCE(due_at, created_at) ASC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                exception_id,
                station_id,
                exception_type,
                related_object_type,
                related_object_id,
                linked_task_id,
                severity,
                owner_role,
                owner_team_id,
                exception_status,
                blocker_flag,
                root_cause,
                action_taken,
                opened_at,
                created_at
              FROM exceptions
              WHERE station_id = ?
              ORDER BY opened_at DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                document_id,
                document_type,
                document_name,
                related_object_type,
                related_object_id,
                version_no,
                document_status,
                required_for_release,
                note,
                uploaded_at,
                updated_at
              FROM documents
              WHERE station_id = ?
              ORDER BY updated_at DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                loading_plan_id,
                station_id,
                flight_no,
                truck_plate,
                vehicle_model,
                driver_name,
                collection_note,
                plan_status,
                note,
                arrival_time,
                depart_time,
                created_at,
                updated_at
              FROM loading_plans
              WHERE station_id = ?
              ORDER BY COALESCE(depart_time, arrival_time, created_at) DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                receipt_record_id,
                station_id,
                flight_no,
                awb_no,
                received_pieces,
                received_weight,
                receipt_status,
                note,
                created_at,
                updated_at
              FROM outbound_receipts
              WHERE station_id = ?
              ORDER BY updated_at DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                container_id,
                station_id,
                flight_no,
                container_code,
                total_boxes,
                total_weight,
                reviewed_weight,
                container_status,
                note,
                created_at,
                updated_at
              FROM outbound_containers
              WHERE station_id = ?
              ORDER BY updated_at DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                item.container_item_id,
                item.container_id,
                item.awb_no,
                item.pieces,
                item.boxes,
                item.weight,
                item.created_at,
                item.updated_at
              FROM outbound_container_items item
              INNER JOIN outbound_containers container ON container.container_id = item.container_id
              WHERE container.station_id = ?
              ORDER BY item.updated_at DESC, item.created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
      ])
    : [[], [], [], [], [], [], [], [], []];

  const flightById = new Map<string, any>(
    flights.map((item) => [String(item.flight_id), item] as const),
  );
  const flightByNo = new Map<string, any>(
    flights.map((item) => [String(item.flight_no), item] as const),
  );
  const awbByNo = new Map<string, any>(
    awbs.map((item) => [String(item.awb_no), item] as const),
  );
  const awbsByFlightId = new Map<string, any[]>();
  const tasksByFlightId = new Map<string, any[]>();
  const documentsByFlightId = new Map<string, any[]>();
  const loadingPlansByFlightNo = new Map<string, any[]>();
  const receiptsByAwbNo = new Map<string, any>();
  const containersByFlightNo = new Map<string, any[]>();
  const containerById = new Map<string, any>();
  const containerItemsByContainerId = new Map<string, any[]>();

  for (const awb of awbs) {
    const flightId = String(awb.flight_id || "");
    if (!awbsByFlightId.has(flightId)) {
      awbsByFlightId.set(flightId, []);
    }
    awbsByFlightId.get(flightId)?.push(awb);
  }

  for (const task of tasks) {
    if (task.related_object_type === "Flight") {
      const flightId = String(task.related_object_id || "");
      if (!tasksByFlightId.has(flightId)) {
        tasksByFlightId.set(flightId, []);
      }
      tasksByFlightId.get(flightId)?.push(task);
    }

    if (task.related_object_type === "AWB") {
      continue;
    }
  }

  for (const document of documents) {
    if (document.related_object_type === "Flight") {
      const flightId = String(document.related_object_id || "");
      if (!documentsByFlightId.has(flightId)) {
        documentsByFlightId.set(flightId, []);
      }
      documentsByFlightId.get(flightId)?.push(document);
    }

    if (document.related_object_type === "AWB") {
      continue;
    }
  }

  for (const plan of loadingPlans) {
    const flightNo = String(plan.flight_no || "");
    if (!loadingPlansByFlightNo.has(flightNo)) {
      loadingPlansByFlightNo.set(flightNo, []);
    }
    loadingPlansByFlightNo.get(flightNo)?.push(plan);
  }

  for (const receipt of receipts) {
    receiptsByAwbNo.set(String(receipt.awb_no || ""), receipt);
  }

  for (const container of containers) {
    containerById.set(String(container.container_id || ""), container);
    const flightNo = String(container.flight_no || "");
    if (!containersByFlightNo.has(flightNo)) {
      containersByFlightNo.set(flightNo, []);
    }
    containersByFlightNo.get(flightNo)?.push(container);
  }

  for (const item of containerItems) {
    const containerId = String(item.container_id || "");
    if (!containerItemsByContainerId.has(containerId)) {
      containerItemsByContainerId.set(containerId, []);
    }
    containerItemsByContainerId.get(containerId)?.push(item);
  }

  const outboundFlights = flights
    .filter((item) => item.origin_code === stationId)
    .map((item) => {
      const flightAwbs = awbsByFlightId.get(String(item.flight_id)) || [];
      const flightTasks = tasksByFlightId.get(String(item.flight_id)) || [];
      const flightDocuments =
        documentsByFlightId.get(String(item.flight_id)) || [];
      const flightPlans =
        loadingPlansByFlightNo.get(String(item.flight_no)) || [];
      const totalPieces = flightAwbs.reduce(
        (sum, awb) => sum + Number(awb.pieces || 0),
        0,
      );
      const totalWeight = flightAwbs.reduce(
        (sum, awb) => sum + Number(awb.gross_weight || 0),
        0,
      );
      const manifestDocument = flightDocuments.find(
        (doc) =>
          doc.document_type === "Manifest" &&
          [
            "Uploaded",
            "Released",
            "Approved",
            "Accepted",
            "Verified",
            "Closed",
          ].includes(String(doc.document_status)),
      );
      const manifestStatus =
        manifestDocument?.document_status ||
        flightAwbs.find(
          (awb) => awb.manifest_status && awb.manifest_status !== "Pending",
        )?.manifest_status ||
        (flightDocuments.some((doc) => doc.document_type === "Manifest")
          ? "已导入"
          : "待生成");
      const stage =
        flightTasks.find(
          (task) => !COMPLETED_TASK_STATUSES.has(String(task.task_status)),
        )?.execution_node ||
        (flightPlans.some((plan) =>
          ["计划", "待处理", "待确认"].includes(String(plan.plan_status)),
        )
          ? "装载待处理"
          : flightPlans.length
            ? "装载中"
            : manifestDocument
              ? "主单完成"
              : item.runtime_status);

      return {
        flightNo: item.flight_no,
        etd: formatDashboardClock(item.etd_at),
        status: item.runtime_status,
        stage,
        manifest: manifestStatus,
        cargo: `${flightAwbs.length} AWB / ${totalPieces} pcs / ${formatDashboardWeight(totalWeight)} kg`,
      };
    });

  const outboundAwbs = awbs.filter(
    (item) => flightById.get(String(item.flight_id))?.origin_code === stationId,
  );

  const manifestRows = outboundAwbs.slice(0, 8).map((awb) => {
    const flight = flightById.get(String(awb.flight_id));
    const flightNo = flight?.flight_no || "--";
    const flightContainers = containersByFlightNo.get(String(flightNo)) || [];
    const container = flightContainers[0];
    const uld = container?.container_code || "BULK";
    const type = String(uld).startsWith("PMC") ? "CONSOL" : "BULK";

    return {
      flightNo,
      uld,
      awb: awb.awb_no,
      pieces: Number(awb.pieces || 0),
      weight: Number(awb.gross_weight || 0).toFixed(1),
      route: flight
        ? `${flight.origin_code} → ${flight.destination_code}`
        : "--",
      type,
    };
  });

  const ffmForecastRows = outboundAwbs.slice(0, 8).map((awb) => {
    const flight = flightById.get(String(awb.flight_id));
    const flightContainers = flight
      ? containersByFlightNo.get(String(flight.flight_no)) || []
      : [];
    const container = flightContainers[0];

    return {
      awb: awb.awb_no,
      destination: flight?.destination_code || "--",
      pieces: Number(awb.pieces || 0),
      weight: `${formatDashboardWeight(Number(awb.gross_weight || 0))} kg`,
      goods: awb.goods_description || awb.current_node || "待补充",
      uld: container?.container_code || "BULK",
    };
  });

  const receiptRows = outboundAwbs.slice(0, 3).map((awb) => {
    const receipt = receiptsByAwbNo.get(String(awb.awb_no));
    const plannedPieces = Number(awb.pieces || 0);
    const plannedWeight = Number(awb.gross_weight || 0);
    const actualPieces = Number(receipt?.received_pieces ?? plannedPieces);
    const actualWeight = Number(receipt?.received_weight ?? plannedWeight);
    const diffPieces = actualPieces - plannedPieces;
    const diffWeight = Math.round((actualWeight - plannedWeight) * 10) / 10;

    return {
      awb: awb.awb_no,
      planned: `${plannedPieces} / ${formatDashboardWeight(plannedWeight)}`,
      actual: `${actualPieces} / ${formatDashboardWeight(actualWeight)}`,
      result: receipt
        ? receipt.receipt_status ||
          (diffPieces === 0 && diffWeight === 0 ? "运行中" : "警戒")
        : "待处理",
      issue:
        receipt?.note ||
        (diffPieces === 0 && diffWeight === 0
          ? "无差异"
          : `件数差 ${diffPieces > 0 ? "+" : ""}${diffPieces} / 重量差 ${diffWeight > 0 ? "+" : ""}${diffWeight} kg`),
    };
  });

  const masterAwbRows = outboundAwbs.slice(0, 7).map((awb) => {
    const flight = flightById.get(String(awb.flight_id));

    return {
      awb: awb.awb_no,
      shipper: awb.shipper_name || awb.current_node || "--",
      consignee: awb.consignee_name || "--",
      route: flight
        ? `${flight.origin_code} → ${flight.destination_code}`
        : "--",
      pcs: Number(awb.pieces || 0),
      weight: `${formatDashboardWeight(Number(awb.gross_weight || 0))} kg`,
    };
  });

  const uwsRows = (
    containerItems.length ? containerItems : outboundAwbs.slice(0, 4)
  )
    .slice(0, 4)
    .map((item) => {
      const container = item.container_id
        ? containerById.get(String(item.container_id))
        : null;
      const flight = container
        ? flightByNo.get(String(container.flight_no))
        : flightById.get(String(item.flight_id || ""));
      const awbNo = String(item.awb_no || item.awb || "--");
      const matchedAwb = awbByNo.get(awbNo);

      return {
        awb: awbNo,
        uld: container?.container_code || "BULK",
        pcs: Number(item.pieces || matchedAwb?.pieces || 0),
        weight: String(
          formatDashboardWeight(
            Number(item.weight || matchedAwb?.gross_weight || 0),
          ),
        ),
        pod: container?.container_status || matchedAwb?.pod_status || "BULK",
        destination: flight?.destination_code || "--",
      };
    });

  const flightCount = outboundFlights.length;
  const awbCount = outboundAwbs.length;
  const outboundPieceTotal = outboundAwbs.reduce(
    (sum, awb) => sum + Number(awb.pieces || 0),
    0,
  );
  const outboundWeightTotal = outboundAwbs.reduce(
    (sum, awb) => sum + Number(awb.gross_weight || 0),
    0,
  );
  const receivedCount = receiptRows.filter(
    (item) => item.result !== "待处理" && item.result !== "Pending",
  ).length;
  const manifestApprovedCount = outboundFlights.filter(
    (item) => item.manifest !== "待生成" && item.manifest !== "Pending",
  ).length;
  const airborneCount = flights.filter(
    (item) =>
      item.origin_code === stationId &&
      ["Airborne", "Completed", "Closed"].includes(String(item.runtime_status)),
  ).length;
  const loadingCount = loadingPlans.filter(
    (item) => !["计划", "待处理", "待确认"].includes(String(item.plan_status)),
  ).length;
  const destinationCount = new Set(
    outboundFlights
      .map((item) => flightByNo.get(item.flightNo)?.destination_code)
      .filter(Boolean),
  ).size;

  const manifestSummary = {
    version:
      documents.find(
        (item) =>
          item.document_type === "Manifest" &&
          item.related_object_type === "Flight" &&
          item.document_status !== "Pending",
      )?.version_no ||
      documents
        .find(
          (item) =>
            item.document_type === "Manifest" &&
            item.related_object_type === "Flight",
        )
        ?.updated_at?.slice(5, 10)
        ?.replace("-", "") ||
      "Manifest 待生成",
    exchange: loadingPlans.length
      ? "装载计划 + 文档回写"
      : "DB 聚合 + 文档回写",
    outboundCount: `${awbCount} AWB / ${outboundPieceTotal} pcs / ${formatDashboardWeight(outboundWeightTotal)} kg`,
    destinationCount:
      destinationCount > 0 ? `${destinationCount} 个目的港` : "待目的港回传",
  };

  const outboundDocumentGates = [
    {
      gateId: "HG-01",
      node: "货物预报 -> 主单冻结",
      required: "FFM / Manifest / 主单对账",
      impact: "允许装载编排与飞走归档",
      status:
        awbCount && manifestApprovedCount >= flightCount ? "运行中" : "待处理",
      blocker:
        awbCount && manifestApprovedCount >= flightCount
          ? "预报与主单已进入收口"
          : "等待 FFM 与主单数据进入",
      recovery:
        awbCount && manifestApprovedCount >= flightCount
          ? "保持文档版本冻结"
          : "补齐预报并生成主单",
    },
    {
      gateId: "HG-04",
      node: "主单 -> 装载放行",
      required: "Loaded / 车牌 / 司机",
      impact: "允许装载与航空器放行",
      status: loadingPlans.length ? "警戒" : "运行中",
      blocker: loadingPlans.length
        ? loadingPlans[0].note ||
          loadingPlans[0].collection_note ||
          "装载计划已创建，待最终确认"
        : "装载闭环已就绪",
      recovery: loadingPlans.length
        ? "补齐车牌、司机与复核记录"
        : "保持装载计划与复核记录同步",
      releaseRole: "Document Desk / Station Supervisor",
    },
    {
      gateId: "HG-06",
      node: "装载 -> 飞走 / 回传",
      required: "Airborne / 回执 / 对账",
      impact: "允许关闭与目的港对账",
      status:
        receivedCount < awbCount || airborneCount < flightCount
          ? "待处理"
          : "运行中",
      blocker:
        receivedCount < awbCount
          ? `${awbCount - receivedCount} 票回执待补`
          : airborneCount < flightCount
            ? `${flightCount - airborneCount} 班待飞走确认`
            : "对账链路已就绪",
      recovery:
        receivedCount < awbCount
          ? "补齐回执并回写重量"
          : airborneCount < flightCount
            ? "完成 Loaded / Airborne 状态回写"
            : "保持目的港回传同步",
      releaseRole: "Ramp Control / Delivery Desk",
    },
  ];

  const stationBlockerQueue = [
    ...tasks
      .filter(
        (item) =>
          !COMPLETED_TASK_STATUSES.has(String(item.task_status)) &&
          Boolean(item.blocker_code),
      )
      .slice(0, 2)
      .map((item) => {
        const relatedFlight =
          item.related_object_type === "Flight"
            ? flightById.get(String(item.related_object_id)) ||
              flightByNo.get(String(item.related_object_id))
            : null;
        const relatedAwb =
          item.related_object_type === "AWB"
            ? awbByNo.get(String(item.related_object_id))
            : null;

        return {
          id: item.task_id,
          title: `${relatedFlight?.flight_no || relatedAwb?.awb_no || item.related_object_id} · ${item.blocker_code || item.task_type}`,
          description: item.execution_node || item.task_type,
          status: "阻塞",
          meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`,
        };
      }),
    ...exceptions
      .filter(
        (item) =>
          !CLOSED_EXCEPTION_STATUSES.has(String(item.exception_status)) &&
          Boolean(Number(item.blocker_flag)),
      )
      .slice(0, 1)
      .map((item) => {
        const relatedFlight =
          item.related_object_type === "Flight"
            ? flightById.get(String(item.related_object_id)) ||
              flightByNo.get(String(item.related_object_id))
            : null;
        const relatedAwb =
          item.related_object_type === "AWB"
            ? awbByNo.get(String(item.related_object_id))
            : null;

        return {
          id: item.exception_id,
          title: `${relatedFlight?.flight_no || relatedAwb?.awb_no || item.related_object_id} · ${item.exception_type}`,
          description:
            item.root_cause || item.action_taken || item.exception_type,
          status: "警戒",
          meta: `${item.severity} · ${formatOverviewTime(item.opened_at)}`,
        };
      }),
    ...(outboundDocumentGates
      .filter((item) => item.status !== "运行中")
      .slice(0, 1)
      .map((item) => ({
        id: item.gateId,
        title: `${item.gateId} · ${item.node}`,
        description: item.blocker,
        status: item.status,
        meta: item.recovery,
      })) as any[]),
  ].slice(0, 4);

  const outboundLifecycleRows = [
    {
      label: "已预报",
      note: awbCount ? `${awbCount} 票 AWB 已进入预报池` : "暂无预报数据",
      progress: awbCount ? 100 : 0,
    },
    {
      label: "已接收",
      note: awbCount
        ? `${receivedCount}/${awbCount} 票已完成接收`
        : "等待接收数据",
      progress: awbCount
        ? clampNumber(
            Math.round((receivedCount / Math.max(awbCount, 1)) * 100),
            0,
            100,
          )
        : 0,
    },
    {
      label: "主单完成",
      note: `${manifestApprovedCount}/${Math.max(flightCount, 1)} 班已冻结 Manifest`,
      progress: flightCount
        ? clampNumber(
            Math.round((manifestApprovedCount / flightCount) * 100),
            0,
            100,
          )
        : 0,
    },
    {
      label: "装载中",
      note: loadingCount
        ? `${loadingCount} 车次已进入装载流程`
        : "等待装载编排",
      progress: loadingPlans.length
        ? clampNumber(
            Math.round((loadingCount / Math.max(loadingPlans.length, 1)) * 100),
            0,
            100,
          )
        : 0,
    },
    {
      label: "已飞走",
      note: flightCount
        ? `${airborneCount}/${flightCount} 班已飞走`
        : "等待飞走确认",
      progress: flightCount
        ? clampNumber(Math.round((airborneCount / flightCount) * 100), 0, 100)
        : 0,
    },
    {
      label: "Manifest 回传",
      note: flightCount
        ? `${manifestApprovedCount}/${flightCount} 班已回传`
        : "等待回传",
      progress: flightCount
        ? clampNumber(
            Math.round((manifestApprovedCount / flightCount) * 100),
            0,
            100,
          )
        : 0,
    },
  ];

  return {
    outboundFlights,
    ffmForecastRows,
    manifestRows,
    manifestSummary,
    masterAwbRows,
    receiptRows,
    uwsRows,
    outboundDocumentGates,
    outboundLifecycleRows,
    stationBlockerQueue,
  };
}

function pickRowValue(row: any, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function isPendingInboundStatus(value: unknown) {
  const text = String(value || "").trim();
  return (
    !text || ["Pending", "待处理", "待确认", "未开始", "计划"].includes(text)
  );
}

function isDeliveredInboundStatus(value: unknown) {
  const text = String(value || "").trim();
  return [
    "Delivered",
    "Completed",
    "Closed",
    "Received",
    "Signed",
    "Done",
    "已交付",
    "已完成",
  ].includes(text);
}

function buildInboundLifecycleRows(metrics: {
  flightCount: number;
  landedFlightCount: number;
  awbCount: number;
  openTaskCount: number;
  noaSentCount: number;
  deliveredCount: number;
}) {
  const flightBase = Math.max(metrics.flightCount, 1);
  const awbBase = Math.max(metrics.awbCount, 1);

  return [
    {
      label: "运达",
      count: metrics.flightCount,
      note: metrics.flightCount
        ? `${metrics.flightCount} 班进港航班`
        : "暂无进港航班",
      progress: metrics.flightCount ? 100 : 0,
    },
    {
      label: "已卸机",
      count: metrics.landedFlightCount,
      note: metrics.flightCount
        ? `${metrics.landedFlightCount}/${metrics.flightCount} 班已落地`
        : "等待落地数据",
      progress: clampNumber(
        Math.round((metrics.landedFlightCount / flightBase) * 100),
        0,
        100,
      ),
    },
    {
      label: "已入货站",
      count: metrics.awbCount,
      note: metrics.awbCount
        ? `${metrics.awbCount} 票已进入进港处理池`
        : "暂无入货站记录",
      progress: metrics.awbCount ? 100 : 0,
    },
    {
      label: "拆板理货中",
      count: metrics.openTaskCount,
      note: metrics.openTaskCount
        ? `${metrics.openTaskCount} 个待完成任务`
        : "拆板理货已闭环",
      progress: metrics.openTaskCount ? 68 : 100,
    },
    {
      label: "NOA 已发送",
      count: metrics.noaSentCount,
      note: metrics.awbCount
        ? `${metrics.noaSentCount}/${metrics.awbCount} 票已触发 NOA`
        : "等待 AWB 数据",
      progress: metrics.awbCount
        ? clampNumber(
            Math.round((metrics.noaSentCount / awbBase) * 100),
            0,
            100,
          )
        : 0,
    },
    {
      label: "已交付",
      count: metrics.deliveredCount,
      note: metrics.awbCount
        ? `${metrics.deliveredCount}/${metrics.awbCount} 票已完成 POD/交付`
        : "等待 POD 数据",
      progress: metrics.awbCount
        ? clampNumber(
            Math.round((metrics.deliveredCount / awbBase) * 100),
            0,
            100,
          )
        : 0,
    },
  ];
}

function buildDemoInboundLifecycleRows(flights: any[], awbs: any[]) {
  const metrics = {
    flightCount: flights.length,
    landedFlightCount: flights.filter(
      (item) =>
        Boolean(item.actual_landed_at || item.actualLandedAt) ||
        ["Landed", "Arrived", "Completed", "Closed"].includes(
          String(item.runtime_status || item.runtimeStatus),
        ),
    ).length,
    awbCount: awbs.length,
    openTaskCount: 0,
    noaSentCount: awbs.filter(
      (item) =>
        !isPendingInboundStatus(
          pickRowValue(item, ["noa_status", "noaStatus"]),
        ),
    ).length,
    deliveredCount: awbs.filter((item) =>
      isDeliveredInboundStatus(pickRowValue(item, ["pod_status", "podStatus"])),
    ).length,
  };

  return buildInboundLifecycleRows(metrics);
}

function buildDemoInboundDocumentGates(rows: any[]) {
  return rows
    .filter((item) => item.direction === "进港")
    .slice(0, 3)
    .map((item) => ({
      gateId: item.gateId,
      node: item.node,
      required: item.required,
      impact: item.impact,
      status: item.status,
      blocker: item.blockingReason,
      recovery: item.recoveryAction,
      releaseRole: item.releaseRole,
    }));
}

async function loadStationInboundOverview(db: any, stationId: string) {
  const [
    flights,
    awbs,
    tasks,
    exceptions,
    loadingPlans,
    documents,
    countRecords,
  ]: [any[], any[], any[], any[], any[], any[], any[]] = db
    ? await Promise.all([
        db
          .prepare(
            `
              SELECT
                flight_id,
                flight_no,
                flight_date,
                origin_code,
                destination_code,
                std_at,
                etd_at,
                sta_at,
                eta_at,
                actual_landed_at,
                runtime_status,
                service_level
              FROM flights
              WHERE station_id = ?
              ORDER BY COALESCE(eta_at, actual_landed_at, sta_at, std_at, flight_no) ASC, flight_no ASC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                awb_id,
                awb_no,
                flight_id,
                station_id,
                consignee_name,
                pieces,
                gross_weight,
                current_node,
                noa_status,
                pod_status,
                transfer_status,
                manifest_status
              FROM awbs
              WHERE station_id = ?
              ORDER BY awb_no ASC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                task_id,
                station_id,
                task_type,
                execution_node,
                related_object_type,
                related_object_id,
                assigned_role,
                assigned_team_id,
                assigned_worker_id,
                task_status,
                due_at,
                blocker_code
              FROM tasks
              WHERE station_id = ?
              ORDER BY COALESCE(due_at, created_at) ASC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                exception_id,
                station_id,
                exception_type,
                related_object_type,
                related_object_id,
                severity,
                exception_status,
                blocker_flag,
                root_cause,
                action_taken,
                opened_at,
                linked_task_id
              FROM exceptions
              WHERE station_id = ?
              ORDER BY opened_at DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                loading_plan_id,
                station_id,
                flight_no,
                truck_plate,
                driver_name,
                arrival_time,
                depart_time,
                plan_status,
                note,
                created_at
              FROM loading_plans
              WHERE station_id = ?
              ORDER BY COALESCE(depart_time, arrival_time, created_at) DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                document_id,
                document_type,
                document_name,
                related_object_type,
                related_object_id,
                document_status,
                required_for_release,
                note,
                created_at,
                updated_at
              FROM documents
              WHERE station_id = ?
              ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT
                count_record_id,
                station_id,
                flight_no,
                awb_no,
                counted_boxes,
                status,
                note,
                updated_at
              FROM inbound_count_records
              WHERE station_id = ?
              ORDER BY updated_at DESC, created_at DESC
            `,
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
      ])
    : [[], [], [], [], [], [], []];

  const flightById = new Map<string, any>(
    flights.map((item) => [item.flight_id, item] as const),
  );
  const flightByNo = new Map<string, any>(
    flights.map((item) => [item.flight_no, item] as const),
  );
  const awbsByFlightId = new Map<string, any[]>();
  const inboundFlights = flights.filter(
    (item) => item.destination_code === stationId,
  );

  for (const awb of awbs) {
    if (!awbsByFlightId.has(awb.flight_id)) {
      awbsByFlightId.set(awb.flight_id, []);
    }
    awbsByFlightId.get(awb.flight_id)?.push(awb);
  }

  const inboundFlightIds = new Set(
    inboundFlights.map((item) => item.flight_id),
  );
  const inboundAwbs = awbs.filter((item) =>
    inboundFlightIds.has(item.flight_id),
  );

  const inboundFlightMetrics = buildInboundLifecycleRows({
    flightCount: inboundFlights.length,
    landedFlightCount: inboundFlights.filter(
      (item) =>
        Boolean(item.actual_landed_at || item.actualLandedAt) ||
        ["Landed", "Arrived", "Completed", "Closed"].includes(
          String(item.runtime_status || item.runtimeStatus),
        ),
    ).length,
    awbCount: inboundAwbs.length,
    openTaskCount: tasks.filter(
      (item) =>
        !COMPLETED_TASK_STATUSES.has(
          String(item.task_status || item.taskStatus),
        ) &&
        (item.station_id === stationId ||
          inboundFlightIds.has(item.related_object_id)),
    ).length,
    noaSentCount: inboundAwbs.filter(
      (item) =>
        !isPendingInboundStatus(
          pickRowValue(item, ["noa_status", "noaStatus"]),
        ),
    ).length,
    deliveredCount: inboundAwbs.filter((item) =>
      isDeliveredInboundStatus(pickRowValue(item, ["pod_status", "podStatus"])),
    ).length,
  });

  const relatedObjectLabel = (item: any) => {
    const relatedObjectId = String(item.related_object_id || "");

    if (item.related_object_type === "Flight") {
      return (
        flightById.get(relatedObjectId)?.flight_no ||
        flightByNo.get(relatedObjectId)?.flight_no ||
        relatedObjectId
      );
    }

    if (item.related_object_type === "AWB") {
      return (
        awbs.find(
          (awb) =>
            awb.awb_id === relatedObjectId || awb.awb_no === relatedObjectId,
        )?.awb_no || relatedObjectId
      );
    }

    return relatedObjectId;
  };

  const stationBlockerQueue = [
    ...tasks
      .filter(
        (item) =>
          !COMPLETED_TASK_STATUSES.has(String(item.task_status)) &&
          Boolean(item.blocker_code),
      )
      .slice(0, 4)
      .map((item) => ({
        id: item.task_id,
        title: `${relatedObjectLabel(item)} · ${item.blocker_code || item.task_type}`,
        description: item.execution_node || item.task_type,
        status: "阻塞",
        meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`,
      })),
    ...exceptions
      .filter(
        (item) =>
          !CLOSED_EXCEPTION_STATUSES.has(String(item.exception_status)) &&
          Boolean(Number(item.blocker_flag)),
      )
      .slice(0, 4)
      .map((item) => ({
        id: item.exception_id,
        title: `${relatedObjectLabel(item)} · ${item.exception_type}`,
        description:
          item.root_cause || item.action_taken || item.exception_type,
        status: "警戒",
        meta: `${item.severity} · ${formatOverviewTime(item.opened_at)}`,
      })),
  ].slice(0, 4);

  const stationReviewQueue = tasks
    .filter((item) => !COMPLETED_TASK_STATUSES.has(String(item.task_status)))
    .sort((left, right) =>
      String(left.due_at || "9999-12-31").localeCompare(
        String(right.due_at || "9999-12-31"),
      ),
    )
    .slice(0, 4)
    .map((item) => ({
      id: item.task_id,
      title: item.task_type,
      description: `${item.execution_node} · ${relatedObjectLabel(item)}`,
      status: normalizeDashboardTaskStatus(item.task_status),
      meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`,
    }));

  const documentByFlightId = new Map<string, any[]>();
  for (const document of documents) {
    if (document.related_object_type !== "Flight") continue;

    if (!documentByFlightId.has(document.related_object_id)) {
      documentByFlightId.set(document.related_object_id, []);
    }
    documentByFlightId.get(document.related_object_id)?.push(document);
  }

  const gateWarnings: any[] = [];
  const primaryFlight = inboundFlights[0];
  if (primaryFlight) {
    const flightDocuments =
      documentByFlightId.get(primaryFlight.flight_id) ||
      documentByFlightId.get(primaryFlight.flight_no) ||
      [];
    const acceptedStatuses = new Set([
      "Uploaded",
      "Released",
      "Approved",
      "Accepted",
      "Verified",
      "Closed",
    ]);
    const requiredDocTypes = ["CBA", "Manifest"];
    const presentDocTypes = new Set(
      flightDocuments
        .filter((item) => acceptedStatuses.has(String(item.document_status)))
        .map((item) => item.document_type),
    );
    const missingDocTypes = requiredDocTypes.filter(
      (type) => !presentDocTypes.has(type),
    );
    const blockerTask = tasks.find(
      (item) =>
        item.related_object_type === "Flight" &&
        String(item.related_object_id) === primaryFlight.flight_id &&
        item.blocker_code &&
        !COMPLETED_TASK_STATUSES.has(String(item.task_status)),
    );
    const blockerException = exceptions.find(
      (item) =>
        item.related_object_type === "Flight" &&
        String(item.related_object_id) === primaryFlight.flight_id &&
        Boolean(Number(item.blocker_flag)) &&
        !CLOSED_EXCEPTION_STATUSES.has(String(item.exception_status)),
    );

    gateWarnings.push({
      gateId: "HG-01",
      node: "航班落地 -> 进港处理",
      required: requiredDocTypes.join(" / "),
      impact: "允许生成 PMC 拆板、理货、分区任务",
      status:
        missingDocTypes.length || blockerTask || blockerException
          ? "警戒"
          : "运行中",
      blocker:
        missingDocTypes.length > 0
          ? `${primaryFlight.flight_no} 缺 ${missingDocTypes.join(" / ")}`
          : blockerTask?.blocker_code ||
            blockerException?.root_cause ||
            "文件链已就绪",
      recovery:
        blockerTask?.blocker_code ||
        blockerException?.action_taken ||
        (missingDocTypes.length
          ? `补齐 ${missingDocTypes.join(" / ")}`
          : "保持文档版本冻结"),
      releaseRole: "Document Desk / Inbound Supervisor",
    });
  }

  const openCountRecords = countRecords.filter(
    (item) =>
      !["完成", "已完成", "Closed", "Done", "Resolved"].includes(
        String(item.status),
      ),
  );
  const blockedCountTask = tasks.find(
    (item) =>
      !COMPLETED_TASK_STATUSES.has(String(item.task_status)) &&
      Boolean(item.blocker_code),
  );
  const blockedCountException = exceptions.find(
    (item) =>
      !CLOSED_EXCEPTION_STATUSES.has(String(item.exception_status)) &&
      Boolean(Number(item.blocker_flag)),
  );

  gateWarnings.push({
    gateId: "HG-03",
    node: "PMC 拆板 -> 理货完成",
    required: "板号 / 件数核对记录",
    impact: "允许 NOA 与二次转运推进",
    status:
      openCountRecords.length || blockedCountTask || blockedCountException
        ? "待处理"
        : "运行中",
    blocker:
      openCountRecords[0]?.note ||
      blockedCountTask?.blocker_code ||
      blockedCountException?.root_cause ||
      "等待差异复核记录",
    recovery: openCountRecords.length
      ? "补齐差异复核并更新计数结果"
      : blockedCountException?.action_taken || "完成件数与差异复核",
    releaseRole: "Check Worker / Station Supervisor",
  });

  const pendingPodAwbs = inboundAwbs.filter((item) =>
    isPendingInboundStatus(pickRowValue(item, ["pod_status", "podStatus"])),
  );
  const latestLoadingPlan = loadingPlans[0];
  const hasLoadingPlan = loadingPlans.length > 0;

  gateWarnings.push({
    gateId: "HG-06",
    node: "装车 / POD -> 交付关闭",
    required: "POD / 车牌 / 司机",
    impact: "允许二次转运与交付关闭",
    status: !hasLoadingPlan || pendingPodAwbs.length ? "待处理" : "运行中",
    blocker: !hasLoadingPlan
      ? "暂无二次转运计划"
      : pendingPodAwbs.length
        ? `${pendingPodAwbs.length} 票 POD 仍待归档`
        : latestLoadingPlan?.note || "交付闭环待确认",
    recovery: !hasLoadingPlan
      ? "创建二次转运计划并补齐车辆信息"
      : "补齐 POD 双签并回写签收状态",
    releaseRole: "Delivery Desk / Station Supervisor",
  });

  return {
    inboundFlights,
    inboundLifecycleRows: inboundFlightMetrics,
    stationBlockerQueue,
    stationReviewQueue,
    inboundDocumentGates: gateWarnings,
    stationTransferRows: loadingPlans
      .map((item) => {
        const flight = flights.find(
          (flightRow) => flightRow.flight_no === item.flight_no,
        );
        const flightAwbs = flight ? awbsByFlightId.get(flight.flight_id) || [] : [];
        const awbNo = flightAwbs[0]?.awb_no || "--";

        return {
          transferId: item.loading_plan_id,
          awb: awbNo,
          destination: flight?.destination_code || "--",
          plate: item.truck_plate,
          driver: item.driver_name || "--",
          departAt: formatDashboardClock(
            item.depart_time || item.arrival_time || item.created_at,
          ),
          status: item.plan_status,
        };
      })
      .slice(0, 3),
  };
}

async function loadStationInboundMobileOverview(
  services: StationServices,
  stationId: string,
) {
  const [inboundFlightsResult, mobileTasksResult] = await Promise.all([
    services.listInboundFlights({ station_id: stationId, page_size: "100" }),
    services.listMobileTasks({ station_id: stationId, page_size: "100" }),
  ]);

  const inboundFlights = inboundFlightsResult.items.map((item) => ({
    flightNo: item.flight_no,
    source: item.origin_code,
    eta: formatDashboardClock(item.eta || item.actual_landed_at),
    step: item.summary.current_step || item.runtime_status,
    priority: item.service_level || "P2",
    taskCount: item.summary.open_task_count,
    blocked: Boolean(item.summary.blocked),
    blockerReason: item.summary.blocker_reason || "",
  }));

  const mobileTasks = mobileTasksResult.items.map((item) => ({
    taskId: item.task_id,
    taskType: item.task_type,
    executionNode: item.execution_node,
    taskStatus: item.task_status,
    relatedObjectType: item.related_object_type,
    relatedObjectId: item.related_object_id,
    relatedObjectLabel: item.related_object_label,
    awbNo: item.awb_no || undefined,
    flightNo: item.flight_no || undefined,
    stationId: item.station_id,
    dueAt: item.due_at || undefined,
    evidenceRequired: item.evidence_required,
    blockers: item.blockers,
    allowedActions: item.allowed_actions,
  }));

  const flightTasks = mobileTasks.filter((item) => item.flightNo);
  const queuedTasks = flightTasks.filter((item) =>
    ["Created", "Assigned", "Accepted"].includes(item.taskStatus),
  ).length;
  const activeTasks = flightTasks.filter((item) =>
    ["Started", "Evidence Uploaded"].includes(item.taskStatus),
  ).length;
  const completedTasks = flightTasks.filter((item) =>
    ["Completed", "Verified", "Closed"].includes(item.taskStatus),
  ).length;

  return {
    stationId,
    summary: {
      totalFlights: inboundFlights.length,
      totalTasks: flightTasks.length,
      queuedTasks,
      activeTasks,
      completedTasks,
    },
    inboundFlights,
    mobileTasks,
  };
}

function buildOverviewState(
  stations: OverviewStationRow[],
  tasks: OverviewTaskRow[],
  exceptions: OverviewExceptionRow[],
  audits: OverviewAuditRow[],
) {
  const stationMap = new Map<
    string,
    {
      totalTasks: number;
      completedTasks: number;
      openTasks: number;
      blockedTasks: number;
      totalExceptions: number;
      openExceptions: number;
      blockingExceptions: number;
      blockingReason: string | null;
      nextDueAt: string | null;
      latestUpdateAt: string | null;
    }
  >();

  const ensureStationStats = (stationId: string) => {
    if (!stationMap.has(stationId)) {
      stationMap.set(stationId, {
        totalTasks: 0,
        completedTasks: 0,
        openTasks: 0,
        blockedTasks: 0,
        totalExceptions: 0,
        openExceptions: 0,
        blockingExceptions: 0,
        blockingReason: null,
        nextDueAt: null,
        latestUpdateAt: null,
      });
    }

    return stationMap.get(stationId)!;
  };

  const stationIds = new Set<string>(stations.map((item) => item.station_id));

  for (const task of tasks) {
    stationIds.add(task.station_id);
    const stats = ensureStationStats(task.station_id);
    const isCompleted = COMPLETED_TASK_STATUSES.has(task.task_status);
    const hasBlocker = Boolean(task.blocker_code);

    stats.totalTasks += 1;
    if (isCompleted) {
      stats.completedTasks += 1;
    } else {
      stats.openTasks += 1;
    }
    if (hasBlocker && !isCompleted) {
      stats.blockedTasks += 1;
      if (!stats.blockingReason) {
        stats.blockingReason = task.blocker_code
          ? `${task.task_type} · ${task.blocker_code}`
          : task.task_type;
      }
    }

    if (task.due_at && (!stats.nextDueAt || task.due_at < stats.nextDueAt)) {
      stats.nextDueAt = task.due_at;
    }
    if (
      task.due_at &&
      (!stats.latestUpdateAt || task.due_at > stats.latestUpdateAt)
    ) {
      stats.latestUpdateAt = task.due_at;
    }
  }

  for (const exception of exceptions) {
    stationIds.add(exception.station_id);
    const stats = ensureStationStats(exception.station_id);
    const isOpen = !CLOSED_EXCEPTION_STATUSES.has(exception.exception_status);
    const isBlocking = Boolean(Number(exception.blocker_flag)) && isOpen;

    stats.totalExceptions += 1;
    if (isOpen) {
      stats.openExceptions += 1;
    }
    if (isBlocking) {
      stats.blockingExceptions += 1;
      if (!stats.blockingReason) {
        stats.blockingReason =
          exception.root_cause ||
          exception.action_taken ||
          exception.exception_type;
      }
    }

    if (
      exception.opened_at &&
      (!stats.latestUpdateAt || exception.opened_at > stats.latestUpdateAt)
    ) {
      stats.latestUpdateAt = exception.opened_at;
    }
  }

  const orderedStations = (
    stations.length
      ? stations
      : Array.from(stationIds).map((stationId) => ({
          station_id: stationId,
          station_name: stationId,
          control_level: null,
          phase: null,
        }))
  ).sort((a, b) => a.station_id.localeCompare(b.station_id));

  const stationHealthRows = orderedStations.map((station) => {
    const stats = ensureStationStats(station.station_id);
    const completionRatio = stats.totalTasks
      ? stats.completedTasks / stats.totalTasks
      : 0.78;
    const exceptionPenalty =
      stats.blockingExceptions * 12 +
      stats.openExceptions * 4 +
      stats.blockedTasks * 6;
    const readiness = clampNumber(
      Math.round(100 * completionRatio - exceptionPenalty),
      45,
      99,
    );

    return {
      code: station.station_id,
      name: station.station_name,
      control: normalizeControlLevel(station.control_level),
      phase: normalizePhase(station.phase),
      readiness,
      blockingReason:
        stats.blockingReason ||
        (stats.openTasks ? `还有 ${stats.openTasks} 个待处理动作` : "运行稳定"),
    };
  });

  const totalStations = orderedStations.length;
  const healthyStations = stationHealthRows.filter(
    (item) => item.readiness >= 80,
  ).length;
  const openTasks = tasks.filter(
    (item) => !COMPLETED_TASK_STATUSES.has(item.task_status),
  ).length;
  const openExceptions = exceptions.filter(
    (item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status),
  ).length;
  const blockingTasks = tasks.filter(
    (item) =>
      !COMPLETED_TASK_STATUSES.has(item.task_status) &&
      Boolean(item.blocker_code),
  ).length;
  const blockingExceptions = exceptions.filter(
    (item) =>
      !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) &&
      Boolean(Number(item.blocker_flag)),
  ).length;

  const platformOperationKpis = [
    {
      title: "已接入货站",
      value: String(totalStations),
      helper: "来自 stations 表的当前接入范围",
      chip: "Network",
      color: "primary",
    },
    {
      title: "健康站点",
      value: String(healthyStations),
      helper: "准备度 >= 80 的站点数",
      chip: "Stable",
      color: "success",
    },
    {
      title: "待处理动作",
      value: String(openTasks + openExceptions),
      helper: "开放任务与未关闭异常总数",
      chip: "Queue",
      color: "warning",
    },
    {
      title: "阻塞点",
      value: String(blockingTasks + blockingExceptions),
      helper: "带 blocker 的任务与异常",
      chip: "Risk",
      color: "error",
    },
  ];

  const platformKpis = [
    {
      title: "平台接入站点",
      value: String(totalStations),
      helper: "当前参与平台态势视图的站点",
      chip: "Stations",
      color: "primary",
    },
    {
      title: "高可用站点",
      value: String(healthyStations),
      helper: "按任务完成率与阻断异常计算",
      chip: "Health",
      color: "success",
    },
    {
      title: "平台告警",
      value: String(blockingTasks + blockingExceptions),
      helper: "任务与异常中的阻断项",
      chip: "Alerts",
      color: "warning",
    },
    {
      title: "最近审计",
      value: String(audits.length),
      helper: "审计事件回放条数",
      chip: "Audit",
      color: "secondary",
    },
  ];

  const alertRows = stations
    .map((station) => {
      const stats = ensureStationStats(station.station_id);
      const blockers = stats.blockingExceptions + stats.blockedTasks;
      if (!blockers) return null;

      return {
        id: `ALERT-${station.station_id}`,
        title: `${station.station_id} ${station.station_name} 存在 ${blockers} 个阻断点`,
        description:
          stats.blockingReason ||
          (stats.blockingExceptions
            ? `未关闭异常 ${stats.blockingExceptions} 项`
            : `待处理动作 ${stats.openTasks} 项`),
        status: stats.blockingExceptions ? "阻塞" : "警戒",
      };
    })
    .filter(Boolean)
    .slice(0, 3) as {
    id: string;
    title: string;
    description: string;
    status: string;
  }[];

  const fallbackAlertRows =
    alertRows.length > 0
      ? alertRows
      : tasks
          .filter((item) => !COMPLETED_TASK_STATUSES.has(item.task_status))
          .slice(0, 3)
          .map((item) => ({
            id: item.task_id,
            title: `${item.station_id} · ${item.task_type}`,
            description:
              item.blocker_code ||
              item.execution_node ||
              item.related_object_id,
            status: item.blocker_code ? "阻塞" : "待处理",
          }));

  const platformPendingActions = tasks
    .filter((item) => !COMPLETED_TASK_STATUSES.has(item.task_status))
    .sort((a, b) =>
      (a.due_at || "9999-12-31").localeCompare(b.due_at || "9999-12-31"),
    )
    .slice(0, 4)
    .map((item) => ({
      id: item.task_id,
      title: item.task_type,
      description: `${item.execution_node} · ${item.related_object_type} ${item.related_object_id}`,
      meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatOverviewTime(item.due_at)}`,
      status: item.blocker_code
        ? "阻塞"
        : item.task_status === "Created" || item.task_status === "Assigned"
          ? "待处理"
          : "运行中",
    }));

  const pendingActionRows =
    platformPendingActions.length > 0
      ? platformPendingActions
      : exceptions
          .filter(
            (item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status),
          )
          .slice(0, 4)
          .map((item) => ({
            id: item.exception_id,
            title: item.exception_type,
            description:
              item.root_cause ||
              item.action_taken ||
              `${item.related_object_type} ${item.related_object_id}`,
            meta: `${item.owner_role || item.owner_team_id || item.station_id} · ${formatOverviewTime(item.opened_at)}`,
            status: Boolean(Number(item.blocker_flag)) ? "阻塞" : "待处理",
          }));

  const stationAuditFeed = audits.slice(0, 4).map((item) => ({
    time: formatOverviewTime(item.created_at),
    action: item.action,
    object: `${item.object_type} / ${item.object_id}`,
    actor: `${item.actor_id} / ${item.actor_role}`,
  }));

  return {
    platformKpis,
    platformOperationKpis,
    platformAlerts: fallbackAlertRows,
    platformPendingActions: pendingActionRows,
    stationAuditFeed,
    stationHealthRows,
  };
}

async function loadPlatformOperationsOverview(db: any) {
  const [stations, tasks, exceptions, audits] = await Promise.all([
    fetchOverviewRows<OverviewStationRow>(
      db,
      "SELECT station_id, station_name, control_level, phase FROM stations ORDER BY station_id ASC",
    ),
    fetchOverviewRows<OverviewTaskRow>(
      db,
      `
        SELECT
          station_id,
          task_id,
          task_type,
          execution_node,
          related_object_type,
          related_object_id,
          assigned_role,
          assigned_team_id,
          assigned_worker_id,
          task_status,
          task_sla,
          due_at,
          blocker_code
        FROM tasks
        ORDER BY due_at ASC, created_at DESC
      `,
    ),
    fetchOverviewRows<OverviewExceptionRow>(
      db,
      `
        SELECT
          station_id,
          exception_id,
          exception_type,
          related_object_type,
          related_object_id,
          linked_task_id,
          severity,
          owner_role,
          owner_team_id,
          exception_status,
          blocker_flag,
          root_cause,
          action_taken,
          opened_at
        FROM exceptions
        ORDER BY opened_at DESC, created_at DESC
      `,
    ),
    fetchOverviewRows<OverviewAuditRow>(
      db,
      `
        SELECT
          audit_id,
          actor_id,
          actor_role,
          action,
          object_type,
          object_id,
          station_id,
          summary,
          created_at
        FROM audit_events
        ORDER BY created_at DESC, audit_id DESC
        LIMIT 12
      `,
    ),
  ]);

  return buildOverviewState(stations, tasks, exceptions, audits);
}

async function loadUserProfile(db: any, userId: string) {
  const user = (await db
    .prepare(
      `
        SELECT user_id, display_name, email, default_station_id
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `,
    )
    .bind(userId)
    .first()) as {
    user_id: string;
    display_name: string;
    email: string | null;
    default_station_id: string | null;
  } | null;

  if (!user) return null;

  const roles = await db
    .prepare(
      `
        SELECT role_code, station_id
        FROM user_roles
        WHERE user_id = ?
        ORDER BY role_code ASC
      `,
    )
    .bind(userId)
    .all();

  return {
    ...user,
    roles: roles?.results || [],
  };
}

async function issueStationSession(
  c: any,
  params: { userId: string; stationCode: string; roleIds: RoleCode[] },
) {
  const secret = resolveAuthTokenSecret(
    c.env.AUTH_TOKEN_SECRET,
    c.env.ENVIRONMENT,
  );
  const actor = {
    user_id: params.userId,
    role_ids: params.roleIds,
    station_scope: [params.stationCode],
    tenant_id: "sinoport-demo",
    client_source: "station-web" as const,
  };
  const token = await signAuthToken(actor, secret, 60 * 60);
  const refreshToken = `rfr_${crypto.randomUUID()}_${crypto.randomUUID()}`;
  const refreshTokenId = `REF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 1000 * 60 * 60 * 24 * 14,
  ).toISOString();

  await c.env.DB?.prepare(
    `
      INSERT INTO station_refresh_tokens (
        refresh_token_id,
        user_id,
        station_id,
        client_source,
        token_value,
        expires_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      refreshTokenId,
      params.userId,
      params.stationCode,
      "station-web",
      refreshToken,
      expiresAt,
      now.toISOString(),
      now.toISOString(),
    )
    .run();

  const profile = (await loadUserProfile(c.env.DB, params.userId)) || {
    user_id: params.userId,
    display_name: params.userId,
    email: `${params.userId}@sinoport.local`,
    default_station_id: params.stationCode,
    roles: params.roleIds.map((roleCode: RoleCode) => ({
      role_code: roleCode,
      station_id: params.stationCode,
    })),
  };

  return {
    token,
    refresh_token: refreshToken,
    expires_at: new Date(now.getTime() + 1000 * 60 * 60).toISOString(),
    actor,
    user: {
      user_id: profile.user_id,
      display_name: profile.display_name,
      email: profile.email,
      default_station_id: profile.default_station_id,
    },
  };
}

function allowLocalDemoLogin(c: any) {
  return allowLocalOnlyAuth(c.env.ENVIRONMENT, c.env.ENABLE_LOCAL_DEMO_AUTH);
}

function getDefaultStationFromActor(actor: { stationScope?: unknown } | null | undefined) {
  const stationScope = Array.isArray(actor?.stationScope) ? actor.stationScope : [];
  return stationScope[0];
}

async function authenticateStationUser(c: any, body: any) {
  const email = String(body.email || body.login_name || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return null;
  }

  const credential = (await c.env.DB?.prepare(
    `
      SELECT sc.user_id, sc.password_hash, sc.login_name, u.default_station_id
      FROM station_credentials sc
      JOIN users u ON u.user_id = sc.user_id
      WHERE LOWER(sc.login_name) = ?
      LIMIT 1
    `,
  )
    .bind(email)
    .first()) as {
    user_id: string;
    password_hash: string;
    login_name: string;
    default_station_id: string | null;
  } | null;

  if (!credential) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const matched = await verifyPasswordHash(password, credential.password_hash);
  if (!matched) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const profile = await loadUserProfile(c.env.DB, credential.user_id);
  if (!profile) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const requestedStation =
    body.stationCode ||
    body.station_code ||
    profile.default_station_id ||
    profile.roles[0]?.station_id ||
    "MME";
  const stationScopedRoles = profile.roles
    .filter(
      (item: any) => !item.station_id || item.station_id === requestedStation,
    )
    .map((item: any) => item.role_code);

  return {
    userId: profile.user_id,
    stationCode: requestedStation,
    roleIds: stationScopedRoles.length
      ? stationScopedRoles
      : ["station_supervisor"],
  };
}

export function registerStationRoutes(
  app: ApiApp,
  getStationServices: (c: any) => StationServices,
  requireRoles: RequireRoles,
) {
  app.post("/api/v1/station/login", async (c) => {
    try {
      const body = await c.req.json();
      const formalLogin = await authenticateStationUser(c, body).catch(
        (error) => {
          if (
            error instanceof Error &&
            error.message === "INVALID_CREDENTIALS"
          ) {
            throw jsonError(
              c,
              401,
              "INVALID_CREDENTIALS",
              "Invalid email or password",
            );
          }

          throw error;
        },
      );

      if (formalLogin) {
        return c.json({
          data: await issueStationSession(c, formalLogin),
        });
      }

      if (!allowLocalDemoLogin(c)) {
        return jsonError(
          c,
          401,
          "FORMAL_AUTH_REQUIRED",
          "Station login requires a valid email and password",
        );
      }

      const stationCode = body.stationCode || body.station_code || "MME";
      const roleIds =
        Array.isArray(body.roleIds) && body.roleIds.length
          ? body.roleIds
          : [body.roleCode || "station_supervisor"];
      const preferredFallback = roleIds.includes("document_desk")
        ? "demo-docdesk"
        : roleIds.includes("check_worker")
          ? "demo-checker"
          : roleIds.includes("mobile_operator")
            ? "demo-mobile"
            : "demo-supervisor";
      const userId = await resolveKnownUserId(
        c,
        body.userId || body.user_id,
        preferredFallback,
      );

      return c.json({
        data: await issueStationSession(c, { userId, stationCode, roleIds }),
      });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      return handleServiceError(c, error, "POST /station/login");
    }
  });

  app.get("/api/v1/station/me", async (c) => {
    try {
      const actor = c.var.actor;
      const profile = await loadUserProfile(c.env.DB, actor.userId);

      return c.json({
        data: {
          actor: {
            user_id: actor.userId,
            role_ids: actor.roleIds,
            station_scope: actor.stationScope,
            tenant_id: actor.tenantId,
            client_source: actor.clientSource,
          },
          user: profile
            ? {
                user_id: profile.user_id,
                display_name: profile.display_name,
                email: profile.email,
                default_station_id: profile.default_station_id,
              }
            : {
                user_id: actor.userId,
                display_name: actor.userId,
                email: `${actor.userId}@sinoport.local`,
                default_station_id: getDefaultStationFromActor(actor) || "MME",
              },
        },
      });
    } catch (error) {
      return handleServiceError(c, error, "GET /station/me");
    }
  });

  app.get(
    "/api/v1/station/dashboard/overview",
    requireRoles([
      "station_supervisor",
      "document_desk",
      "check_worker",
      "delivery_desk",
      "inbound_operator",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const overview = await loadStationDashboardOverview(
          c.env.DB,
          stationId,
        );

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/dashboard/overview");
      }
    },
  );

  app.get(
    "/api/v1/station/outbound/overview",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const overview = await loadStationOutboundOverview(c.env.DB, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/outbound/overview");
      }
    },
  );

  app.get(
    "/api/v1/station/inbound/overview",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const overview = await loadStationInboundOverview(c.env.DB, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/inbound/overview");
      }
    },
  );

  app.get(
    "/api/v1/station/inbound/mobile-overview",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const overview = await loadStationInboundMobileOverview(
          services,
          stationId,
        );

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/inbound/mobile-overview",
        );
      }
    },
  );

  app.get(
    "/api/v1/station/resources/overview",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const overview = await loadStationResourcesOverview(
          c.env.DB,
          stationId,
        );

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/resources/overview");
      }
    },
  );

  app.get(
    "/api/v1/station/reports/overview",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const overview = await loadStationReportsOverview(c.env.DB, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/reports/overview");
      }
    },
  );

  app.get(
    "/api/v1/station/reports/daily",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const date = c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const reportDate = normalizeDailyReportDate(date);
        const overview = await loadStationReportsDaily(
          c.env.DB,
          stationId,
          reportDate,
        );

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/reports/daily");
      }
    },
  );

  app.get(
    "/api/v1/station/resources/vehicles/options",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        assertStationAccess(c.var.actor, stationId);

        return c.json({
          data: await loadStationVehicleOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/resources/vehicles/options",
        );
      }
    },
  );

  app.get(
    "/api/v1/station/resources/vehicles",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        assertStationAccess(c.var.actor, stationId);
        const vehiclePage = await listStationVehiclesFromDb(
          c.env.DB,
          stationId,
          c.req.query(),
        );

        return c.json({
          data: {
            stationId,
            vehicleRows: vehiclePage.items,
            vehiclePage,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/resources/vehicles");
      }
    },
  );

  app.get(
    "/api/v1/station/resources/vehicles/:vehicleId",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        assertStationAccess(c.var.actor, stationId);
        const detail = await loadStationVehicleDetailFromDb(
          c.env.DB,
          stationId,
          c.req.param("vehicleId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Vehicle does not exist",
            {
              vehicle_id: c.req.param("vehicleId"),
              station_id: stationId,
            },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/resources/vehicles/:vehicleId",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/resources/vehicles",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        assertStationAccess(c.var.actor, stationId);

        const body = await c.req.json();
        const vehicleId = normalizeRequiredText(
          body.trip_id ||
            body.tripId ||
            body.truck_id ||
            body.vehicle_id ||
            body.id,
        ).toUpperCase();
        const flowKey = normalizeRequiredText(
          body.flow_key || body.flowKey || body.route_type || "headhaul",
        );
        const routeLabel = normalizeNullableText(
          body.route || body.route_label,
        );
        const plateNo = normalizeRequiredText(
          body.plate_no || body.plate || body.truck_plate || body.truckPlate,
        );
        const driverName = normalizeNullableText(
          body.driver_name || body.driver || body.driverName,
        );
        const driverPhone = normalizeNullableText(
          body.driver_phone || body.driverPhone,
        );
        const collectionNote = normalizeNullableText(
          body.collection_note || body.collectionNote,
        );
        const dispatchStatus = normalizeRequiredText(
          body.dispatch_status || body.status || "pending_dispatch",
        );
        const priorityCode = normalizeRequiredText(
          body.priority_code || body.priority || "P2",
        ).toUpperCase();
        const slaText = normalizeNullableText(body.sla_text || body.sla);
        const officePlan = normalizeNullableText(
          body.office_plan || body.officePlan,
        );
        const pdaExecution = normalizeNullableText(
          body.pda_execution || body.pdaExec || body.pda_exec,
        );
        const awbs = normalizeVehicleTextArray(body.awbs);
        const pallets = normalizeVehicleTextArray(body.pallets);

        if (
          !vehicleId ||
          !plateNo ||
          !flowKey ||
          !dispatchStatus ||
          !priorityCode
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "trip_id, plate_no, flow_key, dispatch_status and priority_code are required",
          );
        }

        const options = await loadStationVehicleOptions(c.env.DB);
        if (
          !options.flows.some(
            (item) => item.value === flowKey && !item.disabled,
          )
        ) {
          return jsonError(c, 400, "VALIDATION_ERROR", "flow_key is invalid", {
            flow_key: flowKey,
          });
        }
        if (
          !options.statuses.some(
            (item) => item.value === dispatchStatus && !item.disabled,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "dispatch_status is invalid",
            { dispatch_status: dispatchStatus },
          );
        }
        if (
          !options.priorities.some(
            (item) => item.value === priorityCode && !item.disabled,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "priority_code is invalid",
            { priority_code: priorityCode },
          );
        }

        const existing = (await c.env.DB.prepare(
          `SELECT truck_id FROM trucks WHERE UPPER(truck_id) = ? LIMIT 1`,
        )
          .bind(vehicleId)
          .first()) as { truck_id: string } | null;

        if (existing?.truck_id) {
          return jsonError(
            c,
            409,
            "RESOURCE_EXISTS",
            "Vehicle already exists",
            { vehicle_id: vehicleId },
          );
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
              INSERT INTO trucks (
                truck_id,
                station_id,
                plate_no,
                driver_name,
                driver_phone,
                route_type,
                route_label,
                collection_note,
                dispatch_status,
                priority_code,
                sla_text,
                office_plan,
                pda_execution,
                awb_list_json,
                pallet_list_json,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        )
          .bind(
            vehicleId,
            stationId,
            plateNo,
            driverName,
            driverPhone,
            flowKey,
            routeLabel,
            collectionNote,
            dispatchStatus,
            priorityCode,
            slaText,
            officePlan,
            pdaExecution,
            JSON.stringify(awbs),
            JSON.stringify(pallets),
            now,
            now,
          )
          .run();

        await writeStationVehicleAudit(c, {
          action: "VEHICLE_CREATED",
          vehicleId,
          stationId,
          summary: `Created vehicle ${vehicleId}`,
          payload: {
            flow_key: flowKey,
            plate_no: plateNo,
            dispatch_status: dispatchStatus,
            priority_code: priorityCode,
          },
        });

        const detail = await loadStationVehicleDetailFromDb(
          c.env.DB,
          stationId,
          vehicleId,
        );
        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "POST /station/resources/vehicles");
      }
    },
  );

  app.patch(
    "/api/v1/station/resources/vehicles/:vehicleId",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const vehicleId = normalizeRequiredText(
          c.req.param("vehicleId"),
        ).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
              SELECT truck_id, station_id, dispatch_status, deleted_at
              FROM trucks
              WHERE UPPER(truck_id) = ?
              LIMIT 1
            `,
        )
          .bind(vehicleId)
          .first()) as {
          truck_id: string;
          station_id: string;
          dispatch_status: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Vehicle does not exist",
            { vehicle_id: vehicleId },
          );
        }

        assertStationAccess(c.var.actor, existing.station_id);

        const options = await loadStationVehicleOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};
        const hasAny = (...keys: string[]) =>
          keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));

        const assign = (column: string, value: unknown, key = column) => {
          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (hasAny("flow_key", "flowKey", "route_type")) {
          const value = normalizeRequiredText(
            body.flow_key || body.flowKey || body.route_type,
          );
          if (
            !options.flows.some(
              (item) => item.value === value && !item.disabled,
            )
          ) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "flow_key is invalid",
              { flow_key: value },
            );
          }
          assign(
            "route_type",
            value,
            body.flow_key
              ? "flow_key"
              : body.flowKey
                ? "flowKey"
                : "route_type",
          );
        }

        if (hasAny("route", "route_label")) {
          assign(
            "route_label",
            normalizeNullableText(body.route || body.route_label),
            body.route ? "route" : "route_label",
          );
        }

        if (hasAny("plate_no", "plate", "truck_plate", "truckPlate")) {
          const value = normalizeRequiredText(
            body.plate_no || body.plate || body.truck_plate || body.truckPlate,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "plate_no cannot be empty",
            );
          }
          assign(
            "plate_no",
            value,
            body.plate_no
              ? "plate_no"
              : body.plate
                ? "plate"
                : body.truck_plate
                  ? "truck_plate"
                  : "truckPlate",
          );
        }

        if (hasAny("driver_name", "driver", "driverName")) {
          assign(
            "driver_name",
            normalizeNullableText(
              body.driver_name || body.driver || body.driverName,
            ),
            body.driver_name
              ? "driver_name"
              : body.driver
                ? "driver"
                : "driverName",
          );
        }

        if (hasAny("driver_phone", "driverPhone")) {
          assign(
            "driver_phone",
            normalizeNullableText(body.driver_phone || body.driverPhone),
            body.driver_phone ? "driver_phone" : "driverPhone",
          );
        }

        if (hasAny("collection_note", "collectionNote")) {
          assign(
            "collection_note",
            normalizeNullableText(body.collection_note || body.collectionNote),
            body.collection_note ? "collection_note" : "collectionNote",
          );
        }

        if (hasAny("dispatch_status", "status")) {
          const value = normalizeRequiredText(
            body.dispatch_status || body.status,
          );
          if (
            !options.statuses.some(
              (item) => item.value === value && !item.disabled,
            )
          ) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "dispatch_status is invalid",
              { dispatch_status: value },
            );
          }
          assign(
            "dispatch_status",
            value,
            body.dispatch_status ? "dispatch_status" : "status",
          );
        }

        if (hasAny("priority_code", "priority")) {
          const value = normalizeRequiredText(
            body.priority_code || body.priority,
          ).toUpperCase();
          if (
            !options.priorities.some(
              (item) => item.value === value && !item.disabled,
            )
          ) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "priority_code is invalid",
              { priority_code: value },
            );
          }
          assign(
            "priority_code",
            value,
            body.priority_code ? "priority_code" : "priority",
          );
        }

        if (hasAny("sla_text", "sla")) {
          assign(
            "sla_text",
            normalizeNullableText(body.sla_text || body.sla),
            body.sla_text ? "sla_text" : "sla",
          );
        }

        if (hasAny("office_plan", "officePlan")) {
          assign(
            "office_plan",
            normalizeNullableText(body.office_plan || body.officePlan),
            body.office_plan ? "office_plan" : "officePlan",
          );
        }

        if (hasAny("pda_execution", "pdaExec", "pda_exec")) {
          assign(
            "pda_execution",
            normalizeNullableText(
              body.pda_execution || body.pdaExec || body.pda_exec,
            ),
            body.pda_execution
              ? "pda_execution"
              : body.pdaExec
                ? "pdaExec"
                : "pda_exec",
          );
        }

        if (hasAny("awbs")) {
          assign(
            "awb_list_json",
            JSON.stringify(normalizeVehicleTextArray(body.awbs)),
            "awbs",
          );
        }

        if (hasAny("pallets")) {
          assign(
            "pallet_list_json",
            JSON.stringify(normalizeVehicleTextArray(body.pallets)),
            "pallets",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          assign(
            "deleted_at",
            archived ? new Date().toISOString() : null,
            "archived",
          );
          if (archived) {
            assign("dispatch_status", "archived");
          } else if (!hasAny("dispatch_status", "status")) {
            assign(
              "dispatch_status",
              existing.dispatch_status === "archived"
                ? "pending_dispatch"
                : existing.dispatch_status,
            );
          }
        }

        if (!updates.length) {
          const detail = await loadStationVehicleDetailFromDb(
            c.env.DB,
            existing.station_id,
            vehicleId,
          );
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), existing.truck_id);
        await c.env.DB.prepare(
          `UPDATE trucks SET ${updates.join(", ")} WHERE truck_id = ?`,
        )
          .bind(...params)
          .run();

        const detail = await loadStationVehicleDetailFromDb(
          c.env.DB,
          existing.station_id,
          existing.truck_id,
        );
        await writeStationVehicleAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "VEHICLE_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "VEHICLE_ARCHIVED"
                : "VEHICLE_UPDATED",
          vehicleId: existing.truck_id,
          stationId: existing.station_id,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored vehicle ${existing.truck_id}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived vehicle ${existing.truck_id}`
                : `Updated vehicle ${existing.truck_id}`,
          payload: auditPayload,
        });

        return c.json({ data: detail });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(
          c,
          error,
          "PATCH /station/resources/vehicles/:vehicleId",
        );
      }
    },
  );

  app.delete(
    "/api/v1/station/resources/vehicles/:vehicleId",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const vehicleId = normalizeRequiredText(
          c.req.param("vehicleId"),
        ).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
              SELECT truck_id, station_id, deleted_at
              FROM trucks
              WHERE UPPER(truck_id) = ?
              LIMIT 1
            `,
        )
          .bind(vehicleId)
          .first()) as {
          truck_id: string;
          station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Vehicle does not exist",
            { vehicle_id: vehicleId },
          );
        }

        assertStationAccess(c.var.actor, existing.station_id);

        if (!existing.deleted_at) {
          const now = new Date().toISOString();
          await c.env.DB.prepare(
            `UPDATE trucks SET deleted_at = ?, dispatch_status = 'archived', updated_at = ? WHERE truck_id = ?`,
          )
            .bind(now, now, existing.truck_id)
            .run();
        }

        await writeStationVehicleAudit(c, {
          action: "VEHICLE_ARCHIVED",
          vehicleId: existing.truck_id,
          stationId: existing.station_id,
          summary: `Archived vehicle ${existing.truck_id}`,
        });

        return c.json({
          data: {
            vehicle_id: existing.truck_id,
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "DELETE /station/resources/vehicles/:vehicleId",
        );
      }
    },
  );

  app.get(
    "/api/v1/station/flights/options",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const normalized = normalizeStationListQuery(c.var.actor, c.req.query());
        const stationId = normalizeStationCode(
          normalized.station_id || getDefaultStationFromActor(c.var.actor) || "",
        );
        const direction =
          c.req.query("direction") === "outbound" ? "outbound" : "inbound";

        assertStationAccess(c.var.actor, stationId);

        return c.json({
          data: await loadStationFlightOptions(c.env.DB, stationId, direction),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/flights/options");
      }
    },
  );

  app.get(
    "/api/v1/station/inbound/flight-create/options",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const normalized = normalizeStationListQuery(c.var.actor, c.req.query());
        const stationId = normalizeStationCode(
          normalized.station_id || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);
        const options = await loadStationFlightOptions(
          c.env.DB,
          stationId,
          "inbound",
        );

        return c.json({
          data: {
            sourceOptions: options.sourceOptions,
            serviceLevelOptions: options.serviceLevels,
            runtimeStatusOptions: options.runtimeStatuses,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/inbound/flight-create/options",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/imports/inbound-bundle",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const body = await c.req.json().catch(() => null);

        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be a JSON object",
          );
        }

        const stationId = String(
          (body as any).station_id ||
            (body as any).stationId ||
            (body as any).station?.station_id ||
            (body as any).station?.stationId ||
            getDefaultStationFromActor(c.var.actor) ||
            "",
        ).trim();

        assertStationAccess(c.var.actor, stationId);

        const db = c.env.DB;

        if (!db) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required for import",
          );
        }

        const result = await importInboundBundle(
          db,
          c.var.actor,
          body,
          c.req.header("Idempotency-Key") ??
            c.req.header("X-Request-Id") ??
            undefined,
        );

        return c.json({ data: result });
      } catch (error) {
        if (error instanceof InboundBundleImportError) {
          const status = error.code === "IMPORT_IN_PROGRESS" ? 409 : 400;
          return jsonError(c, status, error.code, error.message, error.details);
        }

        return handleServiceError(
          c,
          error,
          "POST /station/imports/inbound-bundle",
        );
      }
    },
  );

  app.post("/api/v1/station/refresh", async (c) => {
    try {
      const body = await c.req.json();
      const refreshToken = String(body.refresh_token || "").trim();

      if (!refreshToken) {
        return jsonError(
          c,
          400,
          "VALIDATION_ERROR",
          "refresh_token is required",
        );
      }

      const row = (await c.env.DB?.prepare(
        `
          SELECT refresh_token_id, user_id, station_id, expires_at, revoked_at
          FROM station_refresh_tokens
          WHERE token_value = ?
          LIMIT 1
        `,
      )
        .bind(refreshToken)
        .first()) as {
        refresh_token_id: string;
        user_id: string;
        station_id: string;
        expires_at: string;
        revoked_at: string | null;
      } | null;

      if (
        !row ||
        row.revoked_at ||
        new Date(row.expires_at).getTime() < Date.now()
      ) {
        return jsonError(
          c,
          401,
          "INVALID_REFRESH_TOKEN",
          "Refresh token is invalid or expired",
        );
      }

      const profile = await loadUserProfile(c.env.DB, row.user_id);
      const roleIds = (profile?.roles || [])
        .filter(
          (item: any) => !item.station_id || item.station_id === row.station_id,
        )
        .map((item: any) => item.role_code);

      await c.env.DB?.prepare(
        `UPDATE station_refresh_tokens SET revoked_at = ?, updated_at = ? WHERE refresh_token_id = ?`,
      )
        .bind(
          new Date().toISOString(),
          new Date().toISOString(),
          row.refresh_token_id,
        )
        .run();

      return c.json({
        data: await issueStationSession(c, {
          userId: row.user_id,
          stationCode: row.station_id,
          roleIds: roleIds.length ? roleIds : ["station_supervisor"],
        }),
      });
    } catch (error) {
      return handleServiceError(c, error, "POST /station/refresh");
    }
  });

  app.post("/api/v1/station/logout", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const refreshToken = body.refresh_token
        ? String(body.refresh_token)
        : null;

      if (refreshToken) {
        await c.env.DB?.prepare(
          `UPDATE station_refresh_tokens SET revoked_at = ?, updated_at = ? WHERE token_value = ?`,
        )
          .bind(
            new Date().toISOString(),
            new Date().toISOString(),
            refreshToken,
          )
          .run();
      } else {
        await c.env.DB?.prepare(
          `UPDATE station_refresh_tokens SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
        )
          .bind(
            new Date().toISOString(),
            new Date().toISOString(),
            c.var.actor.userId,
          )
          .run();
      }

      return c.json({ data: { ok: true } });
    } catch (error) {
      return handleServiceError(c, error, "POST /station/logout");
    }
  });

  app.get(
    "/api/v1/station/shipments/options",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const normalized = normalizeStationListQuery(c.var.actor, c.req.query());
        const stationId = normalizeStationCode(
          normalized.station_id || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);

        return c.json({
          data: await loadStationShipmentOptions(c.env.DB, stationId),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/shipments/options");
      }
    },
  );

  app.get(
    "/api/v1/station/shipments",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationShipments(
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, "GET /station/shipments");
      }
    },
  );

  app.get(
    "/api/v1/station/shipments/:shipmentId",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getStationShipment(
          c.req.param("shipmentId"),
        );

        if (!result) {
          return jsonError(
            c,
            404,
            "SHIPMENT_NOT_FOUND",
            "Shipment does not exist",
            {
              shipment_id: c.req.param("shipmentId"),
            },
          );
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/shipments/:shipmentId",
        );
      }
    },
  );

  app.get(
    "/api/v1/station/outbound/flights",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listOutboundFlights(
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, "GET /station/outbound/flights");
      }
    },
  );

  app.post(
    "/api/v1/station/outbound/flights",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const normalized = normalizeStationListQuery(c.var.actor, {
          station_id: body.station_id || body.stationId,
        });
        const stationId = normalizeStationCode(
          normalized.station_id || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);
        const options = await loadStationFlightOptions(
          c.env.DB,
          stationId,
          "outbound",
        );

        if (
          body.destination_code &&
          !options.destinationOptions.some(
            (item) =>
              item.value === normalizeStationCode(body.destination_code) &&
              !item.disabled,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "destination_code is invalid",
            { destination_code: body.destination_code },
          );
        }

        if (
          body.service_level &&
          !options.serviceLevels.some(
            (item) => item.value === normalizeRequiredText(body.service_level),
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "service_level is invalid",
            { service_level: body.service_level },
          );
        }

        if (
          body.runtime_status &&
          !options.runtimeStatuses.some(
            (item) => item.value === normalizeRequiredText(body.runtime_status),
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "runtime_status is invalid",
            { runtime_status: body.runtime_status },
          );
        }

        const services = getStationServices(c);
        const result = await services.createOutboundFlight({
          station_id: stationId,
          flight_no: normalizeRequiredText(body.flight_no || body.flightNo),
          flight_date: normalizeNullableText(body.flight_date || body.flightDate) || undefined,
          origin_code: stationId,
          destination_code: normalizeStationCode(body.destination_code || body.destinationCode),
          std_at: normalizeNullableText(body.std_at || body.stdAt) || undefined,
          etd_at: normalizeNullableText(body.etd_at || body.etdAt) || undefined,
          runtime_status:
            (normalizeNullableText(
              body.runtime_status || body.runtimeStatus,
            ) as import("@sinoport/contracts").FlightRuntimeStatus | null) ||
            undefined,
          service_level:
            (normalizeNullableText(
              body.service_level || body.serviceLevel,
            ) as import("@sinoport/contracts").ServiceLevel | null) ||
            undefined,
          aircraft_type: normalizeNullableText(body.aircraft_type || body.aircraftType) || undefined,
          notes: normalizeNullableText(body.notes) || undefined,
        });
        return c.json({ data: result }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "POST /station/outbound/flights");
      }
    },
  );

  app.get(
    "/api/v1/station/outbound/flights/:flightId",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getOutboundFlight(
          c.req.param("flightId"),
        );

        if (!result) {
          return jsonError(
            c,
            404,
            "FLIGHT_NOT_FOUND",
            "Outbound flight does not exist",
            {
              flight_id: c.req.param("flightId"),
            },
          );
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/outbound/flights/:flightId",
        );
      }
    },
  );

  app.patch(
    "/api/v1/station/outbound/flights/:flightId",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const normalized = normalizeStationListQuery(c.var.actor, {
          station_id: body.station_id || body.stationId,
        });
        const stationId = normalizeStationCode(
          normalized.station_id || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);
        const options = await loadStationFlightOptions(
          c.env.DB,
          stationId,
          "outbound",
        );

        const destinationCode = normalizeNullableText(
          body.destination_code || body.destinationCode,
        );
        const serviceLevel = normalizeNullableText(
          body.service_level || body.serviceLevel,
        );
        const runtimeStatus = normalizeNullableText(
          body.runtime_status || body.runtimeStatus,
        );

        if (
          destinationCode &&
          !options.destinationOptions.some(
            (item) => item.value === normalizeStationCode(destinationCode),
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "destination_code is invalid",
            { destination_code: destinationCode },
          );
        }

        if (
          serviceLevel &&
          !options.serviceLevels.some((item) => item.value === serviceLevel)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "service_level is invalid",
            { service_level: serviceLevel },
          );
        }

        if (
          runtimeStatus &&
          !options.runtimeStatuses.some((item) => item.value === runtimeStatus)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "runtime_status is invalid",
            { runtime_status: runtimeStatus },
          );
        }

        const updateInput: import("@sinoport/contracts").StationFlightUpdateInput =
          {};
        const hasAny = (...keys: string[]) =>
          keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));

        if (hasAny("flight_date", "flightDate")) {
          updateInput.flight_date =
            normalizeNullableText(body.flight_date || body.flightDate) ||
            undefined;
        }
        if (hasAny("destination_code", "destinationCode")) {
          updateInput.destination_code = destinationCode
            ? normalizeStationCode(destinationCode)
            : undefined;
        }
        if (hasAny("std_at", "stdAt")) {
          updateInput.std_at =
            normalizeNullableText(body.std_at || body.stdAt) || undefined;
        }
        if (hasAny("etd_at", "etdAt")) {
          updateInput.etd_at =
            normalizeNullableText(body.etd_at || body.etdAt) || undefined;
        }
        if (hasAny("runtime_status", "runtimeStatus")) {
          updateInput.runtime_status =
            (runtimeStatus as import("@sinoport/contracts").FlightRuntimeStatus | null) ||
            undefined;
        }
        if (hasAny("service_level", "serviceLevel")) {
          updateInput.service_level =
            (serviceLevel as import("@sinoport/contracts").ServiceLevel | null) ||
            undefined;
        }
        if (hasAny("aircraft_type", "aircraftType")) {
          updateInput.aircraft_type =
            normalizeNullableText(body.aircraft_type || body.aircraftType) ||
            undefined;
        }
        if (Object.prototype.hasOwnProperty.call(body, "notes")) {
          updateInput.notes = normalizeNullableText(body.notes) || undefined;
        }
        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          updateInput.archived = Boolean(body.archived);
        }

        const services = getStationServices(c);
        const result = await services.updateOutboundFlight(
          c.req.param("flightId"),
          updateInput,
        );
        return c.json({ data: result });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(
          c,
          error,
          "PATCH /station/outbound/flights/:flightId",
        );
      }
    },
  );

  app.delete(
    "/api/v1/station/outbound/flights/:flightId",
    requireRoles(["station_supervisor"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.archiveOutboundFlight(
          c.req.param("flightId"),
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "DELETE /station/outbound/flights/:flightId",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/outbound/flights/:flightId/loaded",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const input = await c.req.json().catch(() => ({}));
        const result = await services.markOutboundLoaded(
          c.req.param("flightId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/outbound/flights/:flightId/loaded",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/outbound/flights/:flightId/manifest/finalize",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const input = await c.req.json().catch(() => ({}));
        const result = await services.finalizeOutboundManifest(
          c.req.param("flightId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/outbound/flights/:flightId/manifest/finalize",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/outbound/flights/:flightId/airborne",
    requireRoles(["station_supervisor"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const input = await c.req.json().catch(() => ({}));
        const result = await services.markOutboundAirborne(
          c.req.param("flightId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/outbound/flights/:flightId/airborne",
        );
      }
    },
  );

  app.get(
    "/api/v1/station/waybills/options",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const direction =
          c.req.query("direction") === "outbound" ? "outbound" : "inbound";
        const stationId = normalizeStationCode(
          c.req.query("station_id") || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);
        return c.json({
          data: await loadStationWaybillOptions(c.env.DB, stationId, direction),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/waybills/options");
      }
    },
  );

  app.get(
    "/api/v1/station/outbound/waybills",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listOutboundWaybills(
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, "GET /station/outbound/waybills");
      }
    },
  );

  app.get(
    "/api/v1/station/outbound/waybills/:awbId",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getOutboundWaybill(c.req.param("awbId"));

        if (!result) {
          return jsonError(
            c,
            404,
            "AWB_NOT_FOUND",
            "Outbound waybill does not exist",
            {
              awb_id: c.req.param("awbId"),
            },
          );
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/outbound/waybills/:awbId",
        );
      }
    },
  );

  app.patch(
    "/api/v1/station/outbound/waybills/:awbId",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const stationId = normalizeStationCode(
          body.station_id || body.stationId || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);
        const options = await loadStationWaybillOptions(c.env.DB, stationId, "outbound");
        const awbType = normalizeNullableText(body.awb_type || body.awbType);
        const flightId = normalizeNullableText(body.flight_id || body.flightId);
        const currentNode = normalizeNullableText(body.current_node || body.currentNode);
        const manifestStatus = normalizeNullableText(body.manifest_status || body.manifestStatus);

        if (awbType && !options.awbTypeOptions.some((item) => item.value === awbType)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "awb_type is invalid", { awb_type: awbType });
        }
        if (flightId && !options.flightOptions.some((item) => item.value === flightId && !item.disabled)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "flight_id is invalid", { flight_id: flightId });
        }
        if (currentNode && !options.currentNodeOptions.some((item) => item.value === currentNode)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "current_node is invalid", { current_node: currentNode });
        }
        if (manifestStatus && !options.manifestStatusOptions.some((item) => item.value === manifestStatus)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "manifest_status is invalid", { manifest_status: manifestStatus });
        }

        const updateInput: import("@sinoport/contracts").StationWaybillUpdateInput = {};
        const hasAny = (...keys: string[]) => keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));

        if (hasAny("awb_no", "awbNo")) {
          updateInput.awb_no = normalizeNullableText(body.awb_no || body.awbNo) || undefined;
        }
        if (hasAny("awb_type", "awbType")) {
          updateInput.awb_type = awbType || undefined;
        }
        if (hasAny("flight_id", "flightId")) {
          updateInput.flight_id = flightId;
        }
        if (hasAny("notify_name", "notifyName")) {
          updateInput.notify_name = normalizeNullableText(body.notify_name || body.notifyName) || "";
        }
        if (Object.prototype.hasOwnProperty.call(body, "pieces")) {
          updateInput.pieces = Number(body.pieces);
        }
        if (hasAny("gross_weight", "grossWeight")) {
          updateInput.gross_weight = Number(body.gross_weight || body.grossWeight);
        }
        if (hasAny("current_node", "currentNode")) {
          updateInput.current_node = currentNode || undefined;
        }
        if (hasAny("manifest_status", "manifestStatus")) {
          updateInput.manifest_status = manifestStatus || undefined;
        }
        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          updateInput.archived = Boolean(body.archived);
        }

        const services = getStationServices(c);
        const result = await services.updateOutboundWaybill(c.req.param("awbId"), updateInput);
        return c.json({ data: result });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(c, 400, "VALIDATION_ERROR", "request body must be valid JSON");
        }
        return handleServiceError(c, error, "PATCH /station/outbound/waybills/:awbId");
      }
    },
  );

  app.delete(
    "/api/v1/station/outbound/waybills/:awbId",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.archiveOutboundWaybill(c.req.param("awbId"));
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "DELETE /station/outbound/waybills/:awbId");
      }
    },
  );

  app.get(
    "/api/v1/station/inbound/flights",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listInboundFlights(
          normalizeInboundFlightListQuery(c.var.actor, c.req.query()),
        );
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, "GET /station/inbound/flights");
      }
    },
  );

  app.post(
    "/api/v1/station/inbound/flights",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const normalized = normalizeStationListQuery(c.var.actor, {
          station_id: body.station_id || body.stationId,
        });
        const stationId = normalizeStationCode(
          normalized.station_id || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);
        const options = await loadStationFlightOptions(
          c.env.DB,
          stationId,
          "inbound",
        );

        const originCode = normalizeStationCode(
          body.origin_code || body.originCode || body.source,
        );

        if (
          !originCode ||
          !options.sourceOptions.some(
            (item) => item.value === originCode && !item.disabled,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "origin_code is invalid",
            { origin_code: body.origin_code || body.originCode || body.source },
          );
        }

        if (
          body.service_level &&
          !options.serviceLevels.some(
            (item) => item.value === normalizeRequiredText(body.service_level),
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "service_level is invalid",
            { service_level: body.service_level },
          );
        }

        if (
          body.runtime_status &&
          !options.runtimeStatuses.some(
            (item) => item.value === normalizeRequiredText(body.runtime_status),
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "runtime_status is invalid",
            { runtime_status: body.runtime_status },
          );
        }

        const services = getStationServices(c);
        const result = await services.createInboundFlight({
          station_id: stationId,
          flight_no: normalizeRequiredText(body.flight_no || body.flightNo),
          flight_date: normalizeNullableText(body.flight_date || body.flightDate) || undefined,
          origin_code: originCode,
          destination_code: stationId,
          eta_at: normalizeNullableText(body.eta_at || body.eta) || undefined,
          etd_at: normalizeNullableText(body.etd_at || body.etd) || undefined,
          runtime_status:
            (normalizeNullableText(
              body.runtime_status || body.runtimeStatus,
            ) as import("@sinoport/contracts").FlightRuntimeStatus | null) ||
            undefined,
          service_level:
            (normalizeNullableText(
              body.service_level || body.serviceLevel,
            ) as import("@sinoport/contracts").ServiceLevel | null) ||
            undefined,
          aircraft_type: normalizeNullableText(body.aircraft_type || body.aircraftType) || undefined,
          notes: normalizeNullableText(body.notes) || undefined,
        });
        return c.json({ data: result }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "POST /station/inbound/flights");
      }
    },
  );

  app.get(
    "/api/v1/station/inbound/flights/:flightId",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
    ]),
    async (c) => {
      try {
        assertStationAccess(c.var.actor, c.req.query("station_id"));
        const services = getStationServices(c);
        const result = await services.getInboundFlight(c.req.param("flightId"));

        if (!result) {
          return jsonError(
            c,
            404,
            "FLIGHT_NOT_FOUND",
            "Inbound flight does not exist",
            {
              flight_id: c.req.param("flightId"),
            },
          );
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/inbound/flights/:flightId",
        );
      }
    },
  );

  app.patch(
    "/api/v1/station/inbound/flights/:flightId",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const normalized = normalizeStationListQuery(c.var.actor, {
          station_id: body.station_id || body.stationId,
        });
        const stationId = normalizeStationCode(
          normalized.station_id || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);
        const options = await loadStationFlightOptions(
          c.env.DB,
          stationId,
          "inbound",
        );

        const originCode = normalizeNullableText(
          body.origin_code || body.originCode || body.source,
        );
        const serviceLevel = normalizeNullableText(
          body.service_level || body.serviceLevel,
        );
        const runtimeStatus = normalizeNullableText(
          body.runtime_status || body.runtimeStatus,
        );

        if (
          originCode &&
          !options.sourceOptions.some((item) => item.value === normalizeStationCode(originCode))
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "origin_code is invalid",
            { origin_code: originCode },
          );
        }

        if (
          serviceLevel &&
          !options.serviceLevels.some((item) => item.value === serviceLevel)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "service_level is invalid",
            { service_level: serviceLevel },
          );
        }

        if (
          runtimeStatus &&
          !options.runtimeStatuses.some((item) => item.value === runtimeStatus)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "runtime_status is invalid",
            { runtime_status: runtimeStatus },
          );
        }

        const updateInput: import("@sinoport/contracts").StationFlightUpdateInput =
          {};
        const hasAny = (...keys: string[]) =>
          keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));

        if (hasAny("flight_date", "flightDate")) {
          updateInput.flight_date =
            normalizeNullableText(body.flight_date || body.flightDate) ||
            undefined;
        }
        if (hasAny("origin_code", "originCode", "source")) {
          updateInput.origin_code = originCode
            ? normalizeStationCode(originCode)
            : undefined;
        }
        if (hasAny("eta_at", "eta")) {
          updateInput.eta_at =
            normalizeNullableText(body.eta_at || body.eta) || undefined;
        }
        if (hasAny("etd_at", "etd")) {
          updateInput.etd_at =
            normalizeNullableText(body.etd_at || body.etd) || undefined;
        }
        if (hasAny("runtime_status", "runtimeStatus")) {
          updateInput.runtime_status =
            (runtimeStatus as import("@sinoport/contracts").FlightRuntimeStatus | null) ||
            undefined;
        }
        if (hasAny("service_level", "serviceLevel")) {
          updateInput.service_level =
            (serviceLevel as import("@sinoport/contracts").ServiceLevel | null) ||
            undefined;
        }
        if (hasAny("aircraft_type", "aircraftType")) {
          updateInput.aircraft_type =
            normalizeNullableText(body.aircraft_type || body.aircraftType) ||
            undefined;
        }
        if (Object.prototype.hasOwnProperty.call(body, "notes")) {
          updateInput.notes = normalizeNullableText(body.notes) || undefined;
        }
        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          updateInput.archived = Boolean(body.archived);
        }

        const services = getStationServices(c);
        const result = await services.updateInboundFlight(
          c.req.param("flightId"),
          updateInput,
        );
        return c.json({ data: result });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(
          c,
          error,
          "PATCH /station/inbound/flights/:flightId",
        );
      }
    },
  );

  app.delete(
    "/api/v1/station/inbound/flights/:flightId",
    requireRoles(["station_supervisor"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.archiveInboundFlight(
          c.req.param("flightId"),
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "DELETE /station/inbound/flights/:flightId",
        );
      }
    },
  );

  app.get(
    "/api/v1/station/inbound/waybills",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listInboundWaybills(
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, "GET /station/inbound/waybills");
      }
    },
  );

  app.get(
    "/api/v1/station/inbound/waybills/:awbId",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        assertStationAccess(c.var.actor, c.req.query("station_id"));
        const services = getStationServices(c);
        const result = await services.getInboundWaybill(c.req.param("awbId"));

        if (!result) {
          return jsonError(
            c,
            404,
            "AWB_NOT_FOUND",
            "Inbound waybill does not exist",
            {
              awb_id: c.req.param("awbId"),
            },
          );
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/inbound/waybills/:awbId",
        );
      }
    },
  );

  app.patch(
    "/api/v1/station/inbound/waybills/:awbId",
    requireRoles(["station_supervisor", "document_desk", "delivery_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const stationId = normalizeStationCode(
          body.station_id || body.stationId || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);
        const options = await loadStationWaybillOptions(c.env.DB, stationId, "inbound");
        const awbType = normalizeNullableText(body.awb_type || body.awbType);
        const flightId = normalizeNullableText(body.flight_id || body.flightId);
        const currentNode = normalizeNullableText(body.current_node || body.currentNode);
        const noaStatus = normalizeNullableText(body.noa_status || body.noaStatus);
        const podStatus = normalizeNullableText(body.pod_status || body.podStatus);
        const transferStatus = normalizeNullableText(body.transfer_status || body.transferStatus);

        if (awbType && !options.awbTypeOptions.some((item) => item.value === awbType)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "awb_type is invalid", { awb_type: awbType });
        }
        if (flightId && !options.flightOptions.some((item) => item.value === flightId && !item.disabled)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "flight_id is invalid", { flight_id: flightId });
        }
        if (currentNode && !options.currentNodeOptions.some((item) => item.value === currentNode)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "current_node is invalid", { current_node: currentNode });
        }
        if (noaStatus && !options.noaStatusOptions.some((item) => item.value === noaStatus)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "noa_status is invalid", { noa_status: noaStatus });
        }
        if (podStatus && !options.podStatusOptions.some((item) => item.value === podStatus)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "pod_status is invalid", { pod_status: podStatus });
        }
        if (transferStatus && !options.transferStatusOptions.some((item) => item.value === transferStatus)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "transfer_status is invalid", { transfer_status: transferStatus });
        }

        const updateInput: import("@sinoport/contracts").StationWaybillUpdateInput = {};
        const hasAny = (...keys: string[]) => keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));

        if (hasAny("awb_no", "awbNo")) {
          updateInput.awb_no = normalizeNullableText(body.awb_no || body.awbNo) || undefined;
        }
        if (hasAny("awb_type", "awbType")) {
          updateInput.awb_type = awbType || undefined;
        }
        if (hasAny("flight_id", "flightId")) {
          updateInput.flight_id = flightId;
        }
        if (hasAny("consignee_name", "consigneeName")) {
          updateInput.consignee_name = normalizeNullableText(body.consignee_name || body.consigneeName) || "";
        }
        if (Object.prototype.hasOwnProperty.call(body, "pieces")) {
          updateInput.pieces = Number(body.pieces);
        }
        if (hasAny("gross_weight", "grossWeight")) {
          updateInput.gross_weight = Number(body.gross_weight || body.grossWeight);
        }
        if (hasAny("current_node", "currentNode")) {
          updateInput.current_node = currentNode || undefined;
        }
        if (hasAny("noa_status", "noaStatus")) {
          updateInput.noa_status = (noaStatus as import("@sinoport/contracts").NoaStatus | null) || undefined;
        }
        if (hasAny("pod_status", "podStatus")) {
          updateInput.pod_status = (podStatus as import("@sinoport/contracts").PodStatus | null) || undefined;
        }
        if (hasAny("transfer_status", "transferStatus")) {
          updateInput.transfer_status =
            (transferStatus as import("@sinoport/contracts").TransferStatus | null) || undefined;
        }
        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          updateInput.archived = Boolean(body.archived);
        }

        const services = getStationServices(c);
        const result = await services.updateInboundWaybill(c.req.param("awbId"), updateInput);
        return c.json({ data: result });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(c, 400, "VALIDATION_ERROR", "request body must be valid JSON");
        }
        return handleServiceError(c, error, "PATCH /station/inbound/waybills/:awbId");
      }
    },
  );

  app.delete(
    "/api/v1/station/inbound/waybills/:awbId",
    requireRoles(["station_supervisor", "document_desk", "delivery_desk"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.archiveInboundWaybill(c.req.param("awbId"));
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "DELETE /station/inbound/waybills/:awbId");
      }
    },
  );

  app.post(
    "/api/v1/station/inbound/waybills/:awbId/noa",
    requireRoles(["station_supervisor", "document_desk", "delivery_desk"]),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.processInboundNoa(
          c.req.param("awbId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/inbound/waybills/:awbId/noa",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/inbound/waybills/:awbId/pod",
    requireRoles(["station_supervisor", "document_desk", "delivery_desk"]),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.processInboundPod(
          c.req.param("awbId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/inbound/waybills/:awbId/pod",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/uploads/presign",
    requireRoles(["station_supervisor", "document_desk", "delivery_desk"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const input = await c.req.json();
        const result = await services.createUploadTicket({
          station_id: input.station_id,
          related_object_type: input.related_object_type,
          document_name: input.document_name,
          content_type: input.content_type,
          size_bytes: input.size_bytes,
          checksum_sha256: input.checksum_sha256,
          retention_class: input.retention_class,
        });
        return c.json({ data: result }, 201);
      } catch (error) {
        return handleServiceError(c, error, "POST /station/uploads/presign");
      }
    },
  );

  app.put(
    "/api/v1/station/uploads/:uploadId",
    requireRoles(["station_supervisor", "document_desk", "delivery_desk"]),
    async (c) => {
      try {
        const uploadId = c.req.param("uploadId");
        const token = c.req.query("token");

        if (!token) {
          return jsonError(c, 400, "VALIDATION_ERROR", "token is required");
        }

        const row = (await c.env.DB?.prepare(
          `
            SELECT upload_id, station_id, document_name, content_type, size_bytes, checksum_sha256, storage_key, upload_token, expires_at, consumed_at
            FROM upload_tickets
            WHERE upload_id = ?
            LIMIT 1
          `,
        )
          .bind(uploadId)
          .first()) as {
          upload_id: string;
          station_id: string;
          document_name: string;
          content_type: string;
          size_bytes: number | null;
          checksum_sha256: string | null;
          storage_key: string;
          upload_token: string;
          expires_at: string;
          consumed_at: string | null;
        } | null;

        if (!row) {
          return jsonError(
            c,
            404,
            "UPLOAD_NOT_FOUND",
            "Upload ticket does not exist",
            { upload_id: uploadId },
          );
        }

        if (row.upload_token !== token) {
          return jsonError(
            c,
            401,
            "UPLOAD_TOKEN_INVALID",
            "Upload token is invalid",
          );
        }

        if (row.consumed_at) {
          return jsonError(
            c,
            409,
            "UPLOAD_ALREADY_CONSUMED",
            "Upload ticket was already consumed",
            { upload_id: uploadId },
          );
        }

        if (new Date(row.expires_at).getTime() < Date.now()) {
          return jsonError(c, 409, "UPLOAD_EXPIRED", "Upload ticket expired", {
            upload_id: uploadId,
          });
        }

        const body = await c.req.arrayBuffer();
        await c.env.FILES?.put(row.storage_key, body, {
          httpMetadata: {
            contentType:
              c.req.header("Content-Type") ||
              row.content_type ||
              "application/octet-stream",
          },
        });

        await c.env.DB?.prepare(
          `UPDATE upload_tickets SET uploaded_at = ?, updated_at = ? WHERE upload_id = ?`,
        )
          .bind(new Date().toISOString(), new Date().toISOString(), uploadId)
          .run();

        return c.json({
          data: {
            upload_id: uploadId,
            storage_key: row.storage_key,
            document_name: row.document_name,
            content_type: row.content_type,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "PUT /station/uploads/:uploadId");
      }
    },
  );

  app.post(
    "/api/v1/station/uploads",
    requireRoles(["station_supervisor", "document_desk", "delivery_desk"]),
    async (c) => {
      try {
        const formData = await c.req.formData();
        const file = formData.get("file");
        const stationId = String(
          formData.get("station_id") || getDefaultStationFromActor(c.var.actor) || "MME",
        );
        const objectType = String(
          formData.get("related_object_type") || "Document",
        ).toUpperCase();

        if (!(file instanceof File)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "file is required");
        }

        const extension = file.name.includes(".")
          ? file.name.slice(file.name.lastIndexOf("."))
          : "";
        const objectKey = `station/${stationId}/uploads/${objectType}/${Date.now()}-${crypto.randomUUID()}${extension}`;

        await c.env.FILES?.put(objectKey, await file.arrayBuffer(), {
          httpMetadata: {
            contentType: file.type || "application/octet-stream",
          },
        });

        return c.json(
          {
            data: {
              document_name: file.name,
              content_type: file.type || "application/octet-stream",
              size: file.size,
              storage_key: objectKey,
              uploaded_at: new Date().toISOString(),
            },
          },
          201,
        );
      } catch (error) {
        return handleServiceError(c, error, "POST /station/uploads");
      }
    },
  );

  app.post(
    "/api/v1/station/documents",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.createDocument(
          normalizeDocumentInput(c.var.actor, input),
        );
        return c.json({ data: result }, 201);
      } catch (error) {
        return handleServiceError(c, error, "POST /station/documents");
      }
    },
  );

  app.get(
    "/api/v1/station/documents/options",
    requireRoles([
      "station_supervisor",
      "document_desk",
      "check_worker",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationDocumentOptions(
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/documents/options");
      }
    },
  );

  app.get(
    "/api/v1/station/documents",
    requireRoles([
      "station_supervisor",
      "document_desk",
      "check_worker",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationDocuments(
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, "GET /station/documents");
      }
    },
  );

  app.get(
    "/api/v1/station/documents/:documentId",
    requireRoles([
      "station_supervisor",
      "document_desk",
      "check_worker",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getStationDocument(c.req.param("documentId"));

        if (!result) {
          return jsonError(c, 404, "RESOURCE_NOT_FOUND", "Document does not exist", {
            document_id: c.req.param("documentId"),
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/documents/:documentId");
      }
    },
  );

  app.patch(
    "/api/v1/station/documents/:documentId",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.updateStationDocument(
          c.req.param("documentId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "PATCH /station/documents/:documentId");
      }
    },
  );

  app.delete(
    "/api/v1/station/documents/:documentId",
    requireRoles(["station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.updateStationDocument(
          c.req.param("documentId"),
          { archived: true },
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "DELETE /station/documents/:documentId");
      }
    },
  );

  app.get(
    "/api/v1/station/documents/overview",
    requireRoles([
      "station_supervisor",
      "document_desk",
      "check_worker",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const liveDocumentRows = await (
          c.env.DB
            ? c.env.DB.prepare(
                `
                    SELECT
                      d.document_id,
                      d.document_type,
                      d.document_name,
                      d.related_object_type,
                      d.related_object_id,
                      d.parent_document_id,
                      d.version_no,
                      d.document_status,
                      d.required_for_release,
                      d.content_type,
                      d.uploaded_at,
                      d.updated_at,
                      d.note,
                      CASE
                        WHEN d.related_object_type = 'Flight' THEN COALESCE(f.flight_no || ' / ' || d.station_id, d.related_object_id)
                        WHEN d.related_object_type = 'AWB' THEN COALESCE(a.awb_no || ' / ' || d.station_id, d.related_object_id)
                        WHEN d.related_object_type = 'Shipment' THEN COALESCE(s.shipment_id, d.related_object_id)
                        WHEN d.related_object_type = 'Task' THEN COALESCE(t.task_type || ' / ' || d.related_object_id, d.related_object_id)
                        WHEN d.related_object_type = 'Truck' THEN COALESCE(tr.plate_no || ' / ' || d.related_object_id, d.related_object_id)
                        ELSE d.related_object_id
                      END AS related_object_label
                    FROM documents d
                    LEFT JOIN flights f ON d.related_object_type = 'Flight' AND d.related_object_id = f.flight_id
                    LEFT JOIN awbs a ON d.related_object_type = 'AWB' AND d.related_object_id = a.awb_id
                    LEFT JOIN shipments s ON d.related_object_type = 'Shipment' AND d.related_object_id = s.shipment_id
                    LEFT JOIN tasks t ON d.related_object_type = 'Task' AND d.related_object_id = t.task_id
                    LEFT JOIN trucks tr ON d.related_object_type = 'Truck' AND d.related_object_id = tr.truck_id
                    WHERE d.station_id = ?
                      AND d.deleted_at IS NULL
                    ORDER BY COALESCE(d.updated_at, d.uploaded_at, d.created_at) DESC, d.document_id DESC
                  `,
              )
                .bind(stationId)
                .all()
                .then((rows: any) => (rows?.results || []) as any[])
            : Promise.resolve([]));

        const liveDocuments = liveDocumentRows.map(
          normalizeStationReportDocumentRow,
        );

        const overview = buildStationDocumentOverview(
          liveDocuments,
          liveDocuments,
          [],
          [],
        );

        return c.json({
          data: {
            stationId,
            ...overview,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/documents/overview");
      }
    },
  );

  app.get(
    "/api/v1/station/pod/overview",
    requireRoles(["station_supervisor", "document_desk", "delivery_desk"]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const livePodRows = await (
          c.env.DB
            ? c.env.DB.prepare(
                `
                    SELECT
                      awb_id,
                      awb_no,
                      consignee_name,
                      pod_status,
                      updated_at,
                      created_at
                    FROM awbs
                    WHERE station_id = ?
                    ORDER BY COALESCE(updated_at, created_at) DESC, awb_no DESC
                  `,
              )
                .bind(stationId)
                .all()
                .then((rows: any) => (rows?.results || []) as any[])
            : Promise.resolve([]));
        const overview = buildStationPodOverview(livePodRows, [], []);

        return c.json({
          data: {
            stationId,
            ...overview,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/pod/overview");
      }
    },
  );

  app.get(
    "/api/v1/station/noa/overview",
    requireRoles([
      "station_supervisor",
      "document_desk",
      "check_worker",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const liveNoaRows = await (
          c.env.DB
            ? c.env.DB.prepare(
                `
                    SELECT
                      awb_id,
                      awb_no,
                      consignee_name,
                      noa_status
                    FROM awbs
                    WHERE station_id = ?
                    ORDER BY awb_no ASC
                  `,
              )
                .bind(stationId)
                .all()
                .then((rows: any) => (rows?.results || []) as any[])
            : Promise.resolve([]));
        const overview = buildStationNoaOverview(liveNoaRows, [], []);

        return c.json({
          data: {
            stationId,
            ...overview,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/noa/overview");
      }
    },
  );

  app.get(
    "/api/v1/station/documents/:documentId/preview",
    requireRoles([
      "station_supervisor",
      "document_desk",
      "check_worker",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const preview = await services.getStationDocumentPreview(
          c.req.param("documentId"),
        );

        if (!preview) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Document does not exist",
            {
              document_id: c.req.param("documentId"),
            },
          );
        }

        if (!preview.inline_supported) {
          return c.json({ data: preview });
        }

        const row = await c.env.DB?.prepare(
          `
            SELECT storage_key, document_name, content_type
            FROM documents
            WHERE document_id = ?
              AND deleted_at IS NULL
            LIMIT 1
          `,
        )
          .bind(c.req.param("documentId"))
          .first<{
            storage_key: string;
            document_name: string;
            content_type: string | null;
          }>();

        if (!row) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Document does not exist",
            {
              document_id: c.req.param("documentId"),
            },
          );
        }

        const object = await c.env.FILES?.get(row.storage_key);
        if (!object) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Document content does not exist in object storage",
            {
              document_id: c.req.param("documentId"),
              storage_key: row.storage_key,
            },
          );
        }

        return new Response(object.body, {
          headers: {
            "Content-Disposition": `inline; filename="${row.document_name}"`,
            "Content-Type":
              row.content_type ||
              object.httpMetadata?.contentType ||
              "application/octet-stream",
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/documents/:documentId/preview",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/demo-datasets",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const rows = await loadDemoDatasetCatalog(c.env.DB);

        return c.json({
          items: rows,
          page: 1,
          page_size: rows.length,
          total: rows.length,
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/demo-datasets");
      }
    },
  );

  app.get(
    "/api/v1/platform/demo-datasets/:datasetKey",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const row = await loadDemoDatasetRecord(
          c.env.DB,
          c.req.param("datasetKey"),
        );

        if (!row) {
          return jsonError(
            c,
            404,
            "DATASET_NOT_FOUND",
            "Demo dataset does not exist",
            {
              dataset_key: c.req.param("datasetKey"),
            },
          );
        }

        return c.json({
          data: {
            dataset_key: row.dataset_key,
            source_module: row.source_module,
            export_name: row.export_name,
            payload_kind: row.payload_kind,
            row_count: row.row_count,
            updated_at: row.updated_at,
            payload: row.payload,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/demo-datasets/:datasetKey",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/station-governance/templates",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const stationId = c.req.query("station_id") || undefined;
        const kind = c.req.query("kind");
        const templateKind =
          kind === "control_level" ||
          kind === "phase" ||
          kind === "resource_template" ||
          kind === "capability_template"
            ? kind
            : undefined;
        const items = await loadStationGovernanceTemplates(c.env.DB, {
          stationId,
          kind: templateKind,
        });

        return c.json({
          data: {
            items,
            page: 1,
            page_size: items.length,
            total: items.length,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/station-governance/templates",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/station-governance/templates/:templateKey",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const template = await loadStationGovernanceTemplate(
          c.env.DB,
          c.req.param("templateKey"),
        );

        if (!template) {
          return jsonError(
            c,
            404,
            "TEMPLATE_NOT_FOUND",
            "Station governance template does not exist",
            {
              template_key: c.req.param("templateKey"),
            },
          );
        }

        return c.json({ data: template });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/station-governance/templates/:templateKey",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/station-governance/stations/:stationId/acceptance-record-template",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const reportDate =
          c.req.query("date") || new Date().toISOString().slice(0, 10);
        const template = await loadStationAcceptanceRecordTemplate(
          c.env.DB,
          c.req.param("stationId"),
          reportDate,
        );

        return c.json({ data: template });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/station-governance/stations/:stationId/acceptance-record-template",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/station-governance/stations/:stationId/governance-comparison",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const reportDate =
          c.req.query("date") || new Date().toISOString().slice(0, 10);
        const comparison = await loadStationGovernanceComparison(
          c.env.DB,
          c.req.param("stationId"),
          reportDate,
        );

        return c.json({ data: comparison });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/station-governance/stations/:stationId/governance-comparison",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/station-governance/stations/:stationId/onboarding-playbook",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const playbook = await loadStationOnboardingPlaybook(
          c.env.DB,
          c.req.param("stationId"),
        );

        return c.json({ data: playbook });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/station-governance/stations/:stationId/onboarding-playbook",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/station-governance/stations/:stationId/copy-package",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const copyPackage = await loadStationCopyPackage(
          c.env.DB,
          c.req.param("stationId"),
        );

        return c.json({ data: copyPackage });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/station-governance/stations/:stationId/copy-package",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/station-governance/stations/:stationId/summary",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const summary = await loadStationGovernanceSummary(
          c.env.DB,
          c.req.param("stationId"),
        );

        return c.json({ data: summary });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/station-governance/stations/:stationId/summary",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/operations/overview",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const overview = await loadPlatformOperationsOverview(c.env.DB);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/operations/overview",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/options/stations",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformStationOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "stations", {
            control_level_options: options.controlLevels,
            phase_options: options.phases,
            owner_options: options.owners,
            station_options: options.stations,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/stations");
      }
    },
  );

  app.get(
    "/api/v1/platform/options/teams",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformTeamOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "teams", {
            station_options: options.stations,
            shift_options: options.shifts,
            status_options: options.statuses,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/teams");
      }
    },
  );

  app.get(
    "/api/v1/platform/options/zones",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformZoneOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "zones", {
            station_options: options.stations,
            zone_type_options: options.types,
            zone_status_options: options.statuses,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/zones");
      }
    },
  );

  app.get(
    "/api/v1/platform/options/devices",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformDeviceOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "devices", {
            station_options: options.stations,
            device_type_options: options.types,
            device_role_options: options.roles,
            device_status_options: options.statuses,
            owner_team_options: options.teams,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/devices");
      }
    },
  );

  app.get(
    "/api/v1/platform/options/network/lanes",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformNetworkLaneOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "network_lanes", {
            station_options: options.stations,
            control_depth_options: options.controlDepths,
            lane_status_options: options.statuses,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/network/lanes");
      }
    },
  );

  app.get(
    "/api/v1/platform/options/network/scenarios",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformNetworkScenarioOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "network_scenarios", {
            station_options: options.stations,
            lane_options: options.lanes,
            scenario_category_options: options.categories,
            scenario_status_options: options.statuses,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/network/scenarios");
      }
    },
  );

  app.get(
    "/api/v1/platform/options/rules",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformRuleOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "rules", {
            station_options: options.stations,
            lane_options: options.lanes,
            scenario_options: options.scenarios,
            rule_type_options: options.types,
            control_level_options: options.controlLevels,
            status_options: options.statuses,
            scope_options: options.scopes,
            service_level_options: options.serviceLevels,
            timeline_stage_options: options.timelineStages,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/rules");
      }
    },
  );

  app.get(
    "/api/v1/platform/options/master-data",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformMasterDataOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "master_data", {
            type_options: options.types,
            source_options: options.sources,
            status_options: options.statuses,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/master-data");
      }
    },
  );

  app.get(
    "/api/v1/platform/options/master-data/sync",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformMasterDataSyncOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "master_data_sync", {
            object_options: options.objects,
            target_options: options.targets,
            status_options: options.statuses,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/master-data/sync");
      }
    },
  );

  app.get(
    "/api/v1/platform/options/master-data/jobs",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformMasterDataJobOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "master_data_jobs", {
            source_options: options.sources,
            object_options: options.objects,
            status_options: options.statuses,
            action_options: options.actions,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/master-data/jobs");
      }
    },
  );

  app.get(
    "/api/v1/platform/options/master-data/relationships",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadPlatformMasterDataRelationshipOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("platform", "master_data_relationships", {
            node_type_options: options.nodeTypes,
            relation_type_options: options.relationTypes,
            evidence_source_options: options.evidenceSources,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/options/master-data/relationships");
      }
    },
  );

  app.get(
    "/api/v1/station/options/resources/vehicles",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const options = await loadStationVehicleOptions(c.env.DB);
        return c.json({
          data: buildUnifiedOptionsPayload("station", "vehicles", {
            flow_options: options.flows,
            status_options: options.statuses,
            priority_options: options.priorities,
          }),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/options/resources/vehicles");
      }
    },
  );

  app.get(
    "/api/v1/station/options/flights",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const normalized = normalizeStationListQuery(c.var.actor, c.req.query());
        const stationId = normalizeStationCode(
          normalized.station_id || getDefaultStationFromActor(c.var.actor) || "",
        );
        const direction =
          c.req.query("direction") === "outbound" ? "outbound" : "inbound";
        assertStationAccess(c.var.actor, stationId);
        const options = await loadStationFlightOptions(c.env.DB, stationId, direction);
        return c.json({
          data: buildUnifiedOptionsPayload(
            "station",
            "flights",
            {
              flight_options: options.flightOptions,
              source_options: options.sourceOptions,
              destination_options: options.destinationOptions,
              service_level_options: options.serviceLevels,
              runtime_status_options: options.runtimeStatuses,
            },
            { station_id: stationId, direction },
          ),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/options/flights");
      }
    },
  );

  app.get(
    "/api/v1/station/options/waybills",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const direction =
          c.req.query("direction") === "outbound" ? "outbound" : "inbound";
        const stationId = normalizeStationCode(
          c.req.query("station_id") || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);
        const options = await loadStationWaybillOptions(c.env.DB, stationId, direction);
        return c.json({
          data: buildUnifiedOptionsPayload(
            "station",
            "waybills",
            {
              awb_type_options: options.awbTypeOptions,
              flight_options: options.flightOptions,
              current_node_options: options.currentNodeOptions,
              noa_status_options: options.noaStatusOptions,
              pod_status_options: options.podStatusOptions,
              transfer_status_options: options.transferStatusOptions,
              manifest_status_options: options.manifestStatusOptions,
            },
            { station_id: stationId, direction },
          ),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/options/waybills");
      }
    },
  );

  app.get(
    "/api/v1/station/options/shipments",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(c, 500, "DB_NOT_AVAILABLE", "Database binding is required");
        }

        const normalized = normalizeStationListQuery(c.var.actor, c.req.query());
        const stationId = normalizeStationCode(
          normalized.station_id || getDefaultStationFromActor(c.var.actor) || "",
        );
        assertStationAccess(c.var.actor, stationId);
        const options = await loadStationShipmentOptions(c.env.DB, stationId);
        return c.json({
          data: buildUnifiedOptionsPayload(
            "station",
            "shipments",
            {
              direction_options: options.directionOptions,
              flight_options: options.flightOptions,
              current_node_options: options.currentNodeOptions,
              fulfillment_status_options: options.fulfillmentStatusOptions,
              blocker_state_options: options.blockerStateOptions,
            },
            { station_id: stationId },
          ),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/options/shipments");
      }
    },
  );

  app.get(
    "/api/v1/station/options/documents",
    requireRoles([
      "station_supervisor",
      "document_desk",
      "check_worker",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const stationQuery = normalizeStationListQuery(c.var.actor, c.req.query());
        const result = await services.listStationDocumentOptions(stationQuery);
        return c.json({
          data: buildUnifiedOptionsPayload(
            "station",
            "documents",
            {
              document_type_options: result.document_type_options,
              document_status_options: result.document_status_options,
              retention_class_options: result.retention_class_options,
              related_object_type_options: result.related_object_type_options,
              related_object_options: result.related_object_options,
            },
            { station_id: stationQuery.station_id || undefined },
          ),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/options/documents");
      }
    },
  );

  app.get(
    "/api/v1/station/options/tasks",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const stationQuery = normalizeStationListQuery(c.var.actor, c.req.query());
        const result = await services.listStationTaskOptions(stationQuery);
        return c.json({
          data: buildUnifiedOptionsPayload(
            "station",
            "tasks",
            {
              task_status_options: result.task_status_options,
              task_priority_options: result.task_priority_options,
              assigned_role_options: result.assigned_role_options,
              task_type_options: result.task_type_options,
              execution_node_options: result.execution_node_options,
              related_object_type_options: result.related_object_type_options,
              related_object_options: result.related_object_options,
              team_options: result.team_options,
              worker_options: result.worker_options,
            },
            { station_id: stationQuery.station_id || undefined },
          ),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/options/tasks");
      }
    },
  );

  app.get(
    "/api/v1/station/options/exceptions",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const stationQuery = normalizeStationListQuery(c.var.actor, c.req.query());
        const result = await services.listStationExceptionOptions(stationQuery);
        return c.json({
          data: buildUnifiedOptionsPayload(
            "station",
            "exceptions",
            {
              exception_type_options: result.exception_type_options,
              severity_options: result.severity_options,
              exception_status_options: result.exception_status_options,
              owner_role_options: result.owner_role_options,
              related_object_type_options: result.related_object_type_options,
              related_object_options: result.related_object_options,
              team_options: result.team_options,
              blocker_state_options: result.blocker_state_options,
            },
            { station_id: stationQuery.station_id || undefined },
          ),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/options/exceptions");
      }
    },
  );

  app.get(
    "/api/v1/platform/stations/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformStationOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/stations/options");
      }
    },
  );

  app.get(
    "/api/v1/platform/stations/:stationId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformStationDetailFromDb(
          c.env.DB,
          c.req.param("stationId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Station does not exist",
            {
              station_id: c.req.param("stationId"),
            },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/stations/:stationId",
        );
      }
    },
  );

  app.post(
    "/api/v1/platform/stations",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const stationId = normalizeStationCode(body.station_id || body.code);
        const stationName = normalizeRequiredText(
          body.station_name || body.name,
        );
        const region = normalizeRequiredText(body.region);
        const controlLevel = normalizeRequiredText(body.control_level);
        const phase = normalizeRequiredText(body.phase);
        const airportCode = normalizeRequiredText(
          body.airport_code || stationId,
        );
        const icaoCode = normalizeNullableText(body.icao_code);
        const serviceScope = normalizeNullableText(
          body.service_scope || body.scope,
        );
        const ownerName = normalizeNullableText(body.owner_name || body.owner);

        if (!stationId || !stationName || !region || !controlLevel || !phase) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "station_id, station_name, region, control_level and phase are required",
          );
        }

        const options = await loadPlatformStationOptions(c.env.DB);

        if (
          !options.controlLevels.some((item) => item.value === controlLevel)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "control_level is invalid",
            { control_level: controlLevel },
          );
        }

        if (!options.phases.some((item) => item.value === phase)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "phase is invalid", {
            phase,
          });
        }

        const existing = await findPlatformStationRowByCode(
          c.env.DB,
          stationId,
        );

        if (existing?.station_id) {
          return jsonError(
            c,
            409,
            "RESOURCE_EXISTS",
            "Station already exists",
            { station_id: stationId },
          );
        }

        await c.env.DB.prepare(
          `
            INSERT INTO stations (
              station_id,
              station_name,
              region,
              control_level,
              phase,
              airport_code,
              icao_code,
              service_scope,
              owner_name,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            stationId,
            stationName,
            region,
            controlLevel,
            phase,
            airportCode,
            icaoCode,
            serviceScope,
            ownerName,
            new Date().toISOString(),
            new Date().toISOString(),
          )
          .run();

        await writePlatformStationAudit(c, {
          action: "STATION_CREATED",
          stationId,
          summary: `Created station ${stationId}`,
          payload: {
            station_name: stationName,
            region,
            control_level: controlLevel,
            phase,
            airport_code: airportCode,
          },
        });

        const detail = await loadPlatformStationDetailFromDb(
          c.env.DB,
          stationId,
        );

        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }

        return handleServiceError(c, error, "POST /platform/stations");
      }
    },
  );

  app.patch(
    "/api/v1/platform/stations/:stationId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const stationId = normalizeStationCode(c.req.param("stationId"));
        const body = await c.req.json();
        const existing = (await c.env.DB.prepare(
          `
              SELECT station_id, deleted_at
              FROM stations
              WHERE UPPER(station_id) = ?
              LIMIT 1
            `,
        )
          .bind(stationId)
          .first()) as { station_id: string; deleted_at: string | null } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Station does not exist",
            { station_id: stationId },
          );
        }

        const options = await loadPlatformStationOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};

        const assignText = (column: string, value: unknown, key = column) => {
          if (!Object.prototype.hasOwnProperty.call(body, key)) {
            return;
          }

          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (
          Object.prototype.hasOwnProperty.call(body, "station_name") ||
          Object.prototype.hasOwnProperty.call(body, "name")
        ) {
          const value = normalizeRequiredText(body.station_name || body.name);
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "station_name cannot be empty",
            );
          }
          assignText(
            "station_name",
            value,
            body.station_name ? "station_name" : "name",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "region")) {
          const value = normalizeRequiredText(body.region);
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "region cannot be empty",
            );
          }
          assignText("region", value);
        }

        if (Object.prototype.hasOwnProperty.call(body, "control_level")) {
          const value = normalizeRequiredText(body.control_level);
          if (!options.controlLevels.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "control_level is invalid",
              { control_level: value },
            );
          }
          assignText("control_level", value);
        }

        if (Object.prototype.hasOwnProperty.call(body, "phase")) {
          const value = normalizeRequiredText(body.phase);
          if (!options.phases.some((item) => item.value === value)) {
            return jsonError(c, 400, "VALIDATION_ERROR", "phase is invalid", {
              phase: value,
            });
          }
          assignText("phase", value);
        }

        if (Object.prototype.hasOwnProperty.call(body, "airport_code")) {
          const value = normalizeNullableText(body.airport_code);
          assignText("airport_code", value);
        }

        if (Object.prototype.hasOwnProperty.call(body, "icao_code")) {
          assignText("icao_code", normalizeNullableText(body.icao_code));
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "service_scope") ||
          Object.prototype.hasOwnProperty.call(body, "scope")
        ) {
          assignText(
            "service_scope",
            normalizeNullableText(body.service_scope || body.scope),
            body.service_scope ? "service_scope" : "scope",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "owner_name") ||
          Object.prototype.hasOwnProperty.call(body, "owner")
        ) {
          assignText(
            "owner_name",
            normalizeNullableText(body.owner_name || body.owner),
            body.owner_name ? "owner_name" : "owner",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          updates.push(`deleted_at = ?`);
          params.push(archived ? new Date().toISOString() : null);
          auditPayload.archived = archived;
        }

        if (!updates.length) {
          const detail = await loadPlatformStationDetailFromDb(
            c.env.DB,
            stationId,
          );
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), existing.station_id);

        await c.env.DB.prepare(
          `UPDATE stations SET ${updates.join(", ")} WHERE station_id = ?`,
        )
          .bind(...params)
          .run();

        await writePlatformStationAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "STATION_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "STATION_ARCHIVED"
                : "STATION_UPDATED",
          stationId: existing.station_id,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored station ${existing.station_id}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived station ${existing.station_id}`
                : `Updated station ${existing.station_id}`,
          payload: auditPayload,
        });

        const detail = await loadPlatformStationDetailFromDb(
          c.env.DB,
          existing.station_id,
        );

        return c.json({ data: detail });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }

        return handleServiceError(
          c,
          error,
          "PATCH /platform/stations/:stationId",
        );
      }
    },
  );

  app.delete(
    "/api/v1/platform/stations/:stationId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const stationId = normalizeStationCode(c.req.param("stationId"));
        const existing = (await c.env.DB.prepare(
          `
              SELECT station_id, deleted_at
              FROM stations
              WHERE UPPER(station_id) = ?
              LIMIT 1
            `,
        )
          .bind(stationId)
          .first()) as { station_id: string; deleted_at: string | null } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Station does not exist",
            { station_id: stationId },
          );
        }

        if (!existing.deleted_at) {
          await c.env.DB.prepare(
            `
                UPDATE stations
                SET deleted_at = ?, updated_at = ?
                WHERE station_id = ?
              `,
          )
            .bind(
              new Date().toISOString(),
              new Date().toISOString(),
              existing.station_id,
            )
            .run();
        }

        await writePlatformStationAudit(c, {
          action: "STATION_ARCHIVED",
          stationId: existing.station_id,
          summary: `Archived station ${existing.station_id}`,
        });

        return c.json({
          data: {
            station_id: normalizeStationCode(existing.station_id),
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "DELETE /platform/stations/:stationId",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/stations",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const [stationCatalogPage, teamRows, zonePage, devicePage] =
          await Promise.all([
            listPlatformStationsFromDb(c.env.DB, c.req.query()),
            loadPlatformStationTeamRows(
              c.env.DB,
              c.req.query("include_archived") === "true" ||
                c.req.query("include_archived") === "1",
            ),
            listPlatformZonesFromDb(c.env.DB, {
              page: "1",
              page_size: "100",
              include_archived: c.req.query("include_archived"),
            }),
            listPlatformDevicesFromDb(c.env.DB, {
              page: "1",
              page_size: "100",
              include_archived: c.req.query("include_archived"),
            }),
          ]);
        const capabilityMatrix = await loadPlatformStationCapabilityMatrix(
          c.env.DB,
          stationCatalogPage.items,
        );

        return c.json({
          data: {
            stationCatalog: stationCatalogPage.items,
            stationCatalogPage,
            platformStationCapabilityRows:
              capabilityMatrix.platformStationCapabilityRows,
            stationCapabilityColumns:
              capabilityMatrix.stationCapabilityColumns,
            platformStationTeamRows: teamRows,
            platformStationZoneRows: zonePage.items,
            platformStationDeviceRows: devicePage.items,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/stations");
      }
    },
  );

  app.get(
    "/api/v1/platform/stations/capabilities",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const stationCatalogPage = await listPlatformStationsFromDb(c.env.DB, {
          page: "1",
          page_size: "100",
          include_archived: c.req.query("include_archived"),
        });
        const capabilityMatrix = await loadPlatformStationCapabilityMatrix(
          c.env.DB,
          stationCatalogPage.items,
        );

        return c.json({
          data: capabilityMatrix,
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/stations/capabilities",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/zones/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformZoneOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/zones/options");
      }
    },
  );

  app.get(
    "/api/v1/platform/zones/:zoneId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformZoneDetailFromDb(
          c.env.DB,
          normalizeRequiredText(c.req.param("zoneId")),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Zone does not exist",
            {
              zone_id: c.req.param("zoneId"),
            },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/zones/:zoneId");
      }
    },
  );

  app.post(
    "/api/v1/platform/zones",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const zoneId = normalizeRequiredText(
          body.zone_id || body.code,
        ).toUpperCase();
        const stationId = normalizeStationCode(
          body.station_id || body.station_code || body.station,
        );
        const zoneType = normalizeRequiredText(body.zone_type || body.type);
        const linkedLane = normalizeNullableText(
          body.linked_lane || body.linkedLane,
        );
        const zoneStatus = normalizeRequiredText(
          body.zone_status || body.status || "active",
        );
        const note = normalizeNullableText(body.note);

        if (!zoneId || !stationId || !zoneType || !zoneStatus) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "zone_id, station_id, zone_type and zone_status are required",
          );
        }

        const options = await loadPlatformZoneOptions(c.env.DB);
        if (
          !options.stations.some(
            (item) => item.value === stationId && !item.disabled,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "station_id is invalid",
            { station_id: stationId },
          );
        }
        if (!options.types.some((item) => item.value === zoneType)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "zone_type is invalid", {
            zone_type: zoneType,
          });
        }
        if (!options.statuses.some((item) => item.value === zoneStatus)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "zone_status is invalid",
            { zone_status: zoneStatus },
          );
        }

        const existing = (await c.env.DB.prepare(
          `SELECT zone_id FROM zones WHERE UPPER(zone_id) = ? LIMIT 1`,
        )
          .bind(zoneId)
          .first()) as { zone_id: string } | null;

        if (existing?.zone_id) {
          return jsonError(c, 409, "RESOURCE_EXISTS", "Zone already exists", {
            zone_id: zoneId,
          });
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
            INSERT INTO zones (
              zone_id,
              station_id,
              zone_type,
              linked_lane,
              zone_status,
              note,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            zoneId,
            stationId,
            zoneType,
            linkedLane,
            zoneStatus,
            note,
            now,
            now,
          )
          .run();

        await writePlatformZoneAudit(c, {
          action: "ZONE_CREATED",
          zoneId,
          stationId,
          summary: `Created zone ${zoneId}`,
          payload: {
            station_id: stationId,
            zone_type: zoneType,
            zone_status: zoneStatus,
            linked_lane: linkedLane,
          },
        });

        const detail = await loadPlatformZoneDetailFromDb(c.env.DB, zoneId);
        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "POST /platform/zones");
      }
    },
  );

  app.patch(
    "/api/v1/platform/zones/:zoneId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const zoneId = normalizeRequiredText(
          c.req.param("zoneId"),
        ).toUpperCase();
        const body = await c.req.json();
        const existing = (await c.env.DB.prepare(
          `SELECT zone_id, station_id, deleted_at FROM zones WHERE UPPER(zone_id) = ? LIMIT 1`,
        )
          .bind(zoneId)
          .first()) as {
          zone_id: string;
          station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Zone does not exist",
            { zone_id: zoneId },
          );
        }

        const options = await loadPlatformZoneOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};
        let effectiveStationId = existing.station_id;

        const assign = (column: string, value: unknown, key = column) => {
          if (!Object.prototype.hasOwnProperty.call(body, key)) {
            return;
          }

          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (
          Object.prototype.hasOwnProperty.call(body, "station_id") ||
          Object.prototype.hasOwnProperty.call(body, "station_code") ||
          Object.prototype.hasOwnProperty.call(body, "station")
        ) {
          const value = normalizeStationCode(
            body.station_id || body.station_code || body.station,
          );
          if (
            !options.stations.some(
              (item) => item.value === value && !item.disabled,
            )
          ) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "station_id is invalid",
              { station_id: value },
            );
          }
          effectiveStationId = value;
          assign(
            "station_id",
            value,
            body.station_id
              ? "station_id"
              : body.station_code
                ? "station_code"
                : "station",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "zone_type") ||
          Object.prototype.hasOwnProperty.call(body, "type")
        ) {
          const value = normalizeRequiredText(body.zone_type || body.type);
          if (!options.types.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "zone_type is invalid",
              { zone_type: value },
            );
          }
          assign("zone_type", value, body.zone_type ? "zone_type" : "type");
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "linked_lane") ||
          Object.prototype.hasOwnProperty.call(body, "linkedLane")
        ) {
          assign(
            "linked_lane",
            normalizeNullableText(body.linked_lane || body.linkedLane),
            body.linked_lane ? "linked_lane" : "linkedLane",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "zone_status") ||
          Object.prototype.hasOwnProperty.call(body, "status")
        ) {
          const value = normalizeRequiredText(body.zone_status || body.status);
          if (!options.statuses.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "zone_status is invalid",
              { zone_status: value },
            );
          }
          assign(
            "zone_status",
            value,
            body.zone_status ? "zone_status" : "status",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "note")) {
          assign("note", normalizeNullableText(body.note));
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          updates.push("deleted_at = ?");
          params.push(archived ? new Date().toISOString() : null);
          auditPayload.archived = archived;
        }

        if (!updates.length) {
          const detail = await loadPlatformZoneDetailFromDb(
            c.env.DB,
            existing.zone_id,
          );
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), existing.zone_id);

        await c.env.DB.prepare(
          `UPDATE zones SET ${updates.join(", ")} WHERE zone_id = ?`,
        )
          .bind(...params)
          .run();

        await writePlatformZoneAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "ZONE_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "ZONE_ARCHIVED"
                : "ZONE_UPDATED",
          zoneId: existing.zone_id,
          stationId: effectiveStationId,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored zone ${existing.zone_id}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived zone ${existing.zone_id}`
                : `Updated zone ${existing.zone_id}`,
          payload: auditPayload,
        });

        const detail = await loadPlatformZoneDetailFromDb(
          c.env.DB,
          existing.zone_id,
        );
        return c.json({ data: detail });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "PATCH /platform/zones/:zoneId");
      }
    },
  );

  app.delete(
    "/api/v1/platform/zones/:zoneId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const zoneId = normalizeRequiredText(
          c.req.param("zoneId"),
        ).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `SELECT zone_id, station_id, deleted_at FROM zones WHERE UPPER(zone_id) = ? LIMIT 1`,
        )
          .bind(zoneId)
          .first()) as {
          zone_id: string;
          station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Zone does not exist",
            { zone_id: zoneId },
          );
        }

        if (!existing.deleted_at) {
          await c.env.DB.prepare(
            `UPDATE zones SET deleted_at = ?, updated_at = ? WHERE zone_id = ?`,
          )
            .bind(
              new Date().toISOString(),
              new Date().toISOString(),
              existing.zone_id,
            )
            .run();
        }

        await writePlatformZoneAudit(c, {
          action: "ZONE_ARCHIVED",
          zoneId: existing.zone_id,
          stationId: existing.station_id,
          summary: `Archived zone ${existing.zone_id}`,
        });

        return c.json({
          data: {
            zone_id: existing.zone_id,
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "DELETE /platform/zones/:zoneId");
      }
    },
  );

  app.get(
    "/api/v1/platform/zones",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const zonePage = await listPlatformZonesFromDb(c.env.DB, c.req.query());
        return c.json({
          data: {
            zoneRows: zonePage.items,
            zonePage,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/zones");
      }
    },
  );

  app.get(
    "/api/v1/platform/teams/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformTeamOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/teams/options");
      }
    },
  );

  app.get(
    "/api/v1/platform/teams/:teamId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformTeamDetailFromDb(
          c.env.DB,
          normalizeRequiredText(c.req.param("teamId")),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Team does not exist",
            {
              team_id: c.req.param("teamId"),
            },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/teams/:teamId");
      }
    },
  );

  app.post(
    "/api/v1/platform/teams",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const teamId = normalizeRequiredText(
          body.team_id || body.code,
        ).toUpperCase();
        const stationId = normalizeStationCode(
          body.station_id || body.station_code,
        );
        const teamName = normalizeRequiredText(body.team_name || body.name);
        const ownerName = normalizeNullableText(body.owner_name || body.owner);
        const shiftCode = normalizeNullableText(body.shift_code);
        const teamStatus = normalizeRequiredText(
          body.team_status || body.status || "active",
        );
        const headcount = Math.max(
          0,
          Number.parseInt(String(body.headcount ?? "0"), 10) || 0,
        );
        const mappedLanes = normalizeNullableText(body.mapped_lanes);

        if (!teamId || !stationId || !teamName) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "team_id, station_id and team_name are required",
          );
        }

        const options = await loadPlatformTeamOptions(c.env.DB);
        if (!options.stations.some((item) => item.value === stationId)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "station_id is invalid",
            { station_id: stationId },
          );
        }
        if (
          shiftCode &&
          !options.shifts.some((item) => item.value === shiftCode)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "shift_code is invalid",
            { shift_code: shiftCode },
          );
        }
        if (!options.statuses.some((item) => item.value === teamStatus)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "team_status is invalid",
            { team_status: teamStatus },
          );
        }

        const existing = (await c.env.DB.prepare(
          `SELECT team_id FROM teams WHERE team_id = ? LIMIT 1`,
        )
          .bind(teamId)
          .first()) as { team_id: string } | null;
        if (existing?.team_id) {
          return jsonError(c, 409, "RESOURCE_EXISTS", "Team already exists", {
            team_id: teamId,
          });
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
            INSERT INTO teams (
              team_id,
              station_id,
              team_name,
              owner_name,
              shift_code,
              team_status,
              headcount,
              mapped_lanes,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            teamId,
            stationId,
            teamName,
            ownerName,
            shiftCode,
            teamStatus,
            headcount,
            mappedLanes,
            now,
            now,
          )
          .run();

        await writePlatformTeamAudit(c, {
          action: "TEAM_CREATED",
          teamId,
          stationId,
          summary: `Created team ${teamId}`,
          payload: {
            team_name: teamName,
            shift_code: shiftCode,
            team_status: teamStatus,
            headcount,
          },
        });

        const detail = await loadPlatformTeamDetailFromDb(c.env.DB, teamId);
        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "POST /platform/teams");
      }
    },
  );

  app.patch(
    "/api/v1/platform/teams/:teamId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const teamId = normalizeRequiredText(
          c.req.param("teamId"),
        ).toUpperCase();
        const body = await c.req.json();
        const existing = (await c.env.DB.prepare(
          `SELECT team_id, station_id, deleted_at FROM teams WHERE team_id = ? LIMIT 1`,
        )
          .bind(teamId)
          .first()) as {
          team_id: string;
          station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Team does not exist",
            { team_id: teamId },
          );
        }

        const options = await loadPlatformTeamOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};

        const assign = (column: string, value: unknown, key = column) => {
          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (
          Object.prototype.hasOwnProperty.call(body, "station_id") ||
          Object.prototype.hasOwnProperty.call(body, "station_code")
        ) {
          const value = normalizeStationCode(
            body.station_id || body.station_code,
          );
          if (!options.stations.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "station_id is invalid",
              { station_id: value },
            );
          }
          assign(
            "station_id",
            value,
            body.station_id ? "station_id" : "station_code",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "team_name") ||
          Object.prototype.hasOwnProperty.call(body, "name")
        ) {
          const value = normalizeRequiredText(body.team_name || body.name);
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "team_name cannot be empty",
            );
          }
          assign("team_name", value, body.team_name ? "team_name" : "name");
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "owner_name") ||
          Object.prototype.hasOwnProperty.call(body, "owner")
        ) {
          assign(
            "owner_name",
            normalizeNullableText(body.owner_name || body.owner),
            body.owner_name ? "owner_name" : "owner",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "shift_code")) {
          const value = normalizeNullableText(body.shift_code);
          if (value && !options.shifts.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "shift_code is invalid",
              { shift_code: value },
            );
          }
          assign("shift_code", value);
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "team_status") ||
          Object.prototype.hasOwnProperty.call(body, "status")
        ) {
          const value = normalizeRequiredText(body.team_status || body.status);
          if (!options.statuses.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "team_status is invalid",
              { team_status: value },
            );
          }
          assign(
            "team_status",
            value,
            body.team_status ? "team_status" : "status",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "headcount")) {
          assign(
            "headcount",
            Math.max(
              0,
              Number.parseInt(String(body.headcount ?? "0"), 10) || 0,
            ),
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "mapped_lanes")) {
          assign("mapped_lanes", normalizeNullableText(body.mapped_lanes));
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          assign(
            "deleted_at",
            archived ? new Date().toISOString() : null,
            "archived",
          );
          if (archived) {
            assign("team_status", "archived");
          } else if (
            !Object.prototype.hasOwnProperty.call(body, "team_status") &&
            !Object.prototype.hasOwnProperty.call(body, "status")
          ) {
            assign("team_status", "active");
          }
        }

        if (!updates.length) {
          const detail = await loadPlatformTeamDetailFromDb(c.env.DB, teamId);
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), teamId);
        await c.env.DB.prepare(
          `UPDATE teams SET ${updates.join(", ")} WHERE team_id = ?`,
        )
          .bind(...params)
          .run();

        const refreshed = await loadPlatformTeamDetailFromDb(c.env.DB, teamId);
        await writePlatformTeamAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "TEAM_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "TEAM_ARCHIVED"
                : "TEAM_UPDATED",
          teamId,
          stationId: refreshed?.team?.station_id || existing.station_id,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored team ${teamId}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived team ${teamId}`
                : `Updated team ${teamId}`,
          payload: auditPayload,
        });

        return c.json({ data: refreshed });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "PATCH /platform/teams/:teamId");
      }
    },
  );

  app.delete(
    "/api/v1/platform/teams/:teamId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const teamId = normalizeRequiredText(
          c.req.param("teamId"),
        ).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `SELECT team_id, station_id, deleted_at FROM teams WHERE team_id = ? LIMIT 1`,
        )
          .bind(teamId)
          .first()) as {
          team_id: string;
          station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Team does not exist",
            { team_id: teamId },
          );
        }

        if (!existing.deleted_at) {
          await c.env.DB.prepare(
            `UPDATE teams SET deleted_at = ?, team_status = 'archived', updated_at = ? WHERE team_id = ?`,
          )
            .bind(new Date().toISOString(), new Date().toISOString(), teamId)
            .run();
        }

        await writePlatformTeamAudit(c, {
          action: "TEAM_ARCHIVED",
          teamId,
          stationId: existing.station_id,
          summary: `Archived team ${teamId}`,
        });

        return c.json({
          data: {
            team_id: teamId,
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "DELETE /platform/teams/:teamId");
      }
    },
  );

  app.get(
    "/api/v1/platform/teams",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const teamPage = await listPlatformTeamsFromDb(c.env.DB, c.req.query());
        return c.json({
          data: {
            teamRows: teamPage.items,
            teamPage,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/teams");
      }
    },
  );

  app.get(
    "/api/v1/platform/devices/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformDeviceOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/devices/options");
      }
    },
  );

  app.get(
    "/api/v1/platform/devices/:deviceId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformDeviceDetailFromDb(
          c.env.DB,
          c.req.param("deviceId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Device does not exist",
            {
              device_id: c.req.param("deviceId"),
            },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/devices/:deviceId");
      }
    },
  );

  app.post(
    "/api/v1/platform/devices",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const deviceId = normalizeRequiredText(
          body.device_id || body.code || body.device,
        ).toUpperCase();
        const stationId = normalizeStationCode(
          body.station_id || body.station_code || body.station,
        );
        const deviceType = normalizeRequiredText(
          body.device_type || body.type || "pda",
        );
        const bindingRole = normalizeRequiredText(
          body.binding_role || body.role,
        );
        const ownerTeamId = normalizeRequiredText(
          body.owner_team_id || body.owner,
        );
        const deviceStatus = normalizeRequiredText(
          body.device_status || body.status || "active",
        );
        const note = normalizeNullableText(body.note);

        if (
          !deviceId ||
          !stationId ||
          !deviceType ||
          !bindingRole ||
          !ownerTeamId ||
          !deviceStatus
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "device_id, station_id, device_type, binding_role, owner_team_id and device_status are required",
          );
        }

        const options = await loadPlatformDeviceOptions(c.env.DB);
        if (
          !options.stations.some(
            (item) => item.value === stationId && !item.disabled,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "station_id is invalid",
            { station_id: stationId },
          );
        }
        if (!options.types.some((item) => item.value === deviceType)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "device_type is invalid",
            { device_type: deviceType },
          );
        }
        if (!options.roles.some((item) => item.value === bindingRole)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "binding_role is invalid",
            { binding_role: bindingRole },
          );
        }
        if (!options.statuses.some((item) => item.value === deviceStatus)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "device_status is invalid",
            { device_status: deviceStatus },
          );
        }

        const ownerTeam = (await c.env.DB.prepare(
          `SELECT team_id, station_id FROM teams WHERE team_id = ? LIMIT 1`,
        )
          .bind(ownerTeamId)
          .first()) as { team_id: string; station_id: string } | null;

        if (!ownerTeam?.team_id) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "owner_team_id is invalid",
            { owner_team_id: ownerTeamId },
          );
        }
        if (ownerTeam.station_id !== stationId) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "owner_team_id must belong to station_id",
            {
              owner_team_id: ownerTeamId,
              station_id: stationId,
            },
          );
        }

        const existing = (await c.env.DB.prepare(
          `SELECT device_id FROM platform_devices WHERE UPPER(device_id) = ? LIMIT 1`,
        )
          .bind(deviceId)
          .first()) as { device_id: string } | null;

        if (existing?.device_id) {
          return jsonError(c, 409, "RESOURCE_EXISTS", "Device already exists", {
            device_id: deviceId,
          });
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
              INSERT INTO platform_devices (
                device_id,
                station_id,
                device_type,
                binding_role,
                owner_team_id,
                device_status,
                note,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        )
          .bind(
            deviceId,
            stationId,
            deviceType,
            bindingRole,
            ownerTeamId,
            deviceStatus,
            note,
            now,
            now,
          )
          .run();

        await writePlatformDeviceAudit(c, {
          action: "DEVICE_CREATED",
          deviceId,
          stationId,
          summary: `Created device ${deviceId}`,
          payload: {
            station_id: stationId,
            device_type: deviceType,
            binding_role: bindingRole,
            owner_team_id: ownerTeamId,
            device_status: deviceStatus,
          },
        });

        const detail = await loadPlatformDeviceDetailFromDb(c.env.DB, deviceId);
        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "POST /platform/devices");
      }
    },
  );

  app.patch(
    "/api/v1/platform/devices/:deviceId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const deviceId = normalizeRequiredText(
          c.req.param("deviceId"),
        ).toUpperCase();
        const body = await c.req.json();
        const existing = (await c.env.DB.prepare(
          `
              SELECT device_id, station_id, owner_team_id, deleted_at
              FROM platform_devices
              WHERE UPPER(device_id) = ?
              LIMIT 1
            `,
        )
          .bind(deviceId)
          .first()) as {
          device_id: string;
          station_id: string;
          owner_team_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Device does not exist",
            { device_id: deviceId },
          );
        }

        const options = await loadPlatformDeviceOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};
        let effectiveStationId = existing.station_id;
        let effectiveOwnerTeamId = existing.owner_team_id;

        const assign = (column: string, value: unknown, key = column) => {
          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (
          Object.prototype.hasOwnProperty.call(body, "station_id") ||
          Object.prototype.hasOwnProperty.call(body, "station_code") ||
          Object.prototype.hasOwnProperty.call(body, "station")
        ) {
          const value = normalizeStationCode(
            body.station_id || body.station_code || body.station,
          );
          if (
            !options.stations.some(
              (item) => item.value === value && !item.disabled,
            )
          ) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "station_id is invalid",
              { station_id: value },
            );
          }
          effectiveStationId = value;
          assign(
            "station_id",
            value,
            body.station_id
              ? "station_id"
              : body.station_code
                ? "station_code"
                : "station",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "device_type") ||
          Object.prototype.hasOwnProperty.call(body, "type")
        ) {
          const value = normalizeRequiredText(body.device_type || body.type);
          if (!options.types.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "device_type is invalid",
              { device_type: value },
            );
          }
          assign(
            "device_type",
            value,
            body.device_type ? "device_type" : "type",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "binding_role") ||
          Object.prototype.hasOwnProperty.call(body, "role")
        ) {
          const value = normalizeRequiredText(body.binding_role || body.role);
          if (!options.roles.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "binding_role is invalid",
              { binding_role: value },
            );
          }
          assign(
            "binding_role",
            value,
            body.binding_role ? "binding_role" : "role",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "owner_team_id") ||
          Object.prototype.hasOwnProperty.call(body, "owner")
        ) {
          const value = normalizeRequiredText(body.owner_team_id || body.owner);
          effectiveOwnerTeamId = value;
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "device_status") ||
          Object.prototype.hasOwnProperty.call(body, "status")
        ) {
          const value = normalizeRequiredText(
            body.device_status || body.status,
          );
          if (!options.statuses.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "device_status is invalid",
              { device_status: value },
            );
          }
          assign(
            "device_status",
            value,
            body.device_status ? "device_status" : "status",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "note")) {
          assign("note", normalizeNullableText(body.note));
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "owner_team_id") ||
          Object.prototype.hasOwnProperty.call(body, "owner") ||
          Object.prototype.hasOwnProperty.call(body, "station_id") ||
          Object.prototype.hasOwnProperty.call(body, "station_code") ||
          Object.prototype.hasOwnProperty.call(body, "station")
        ) {
          const ownerTeam = (await c.env.DB.prepare(
            `SELECT team_id, station_id FROM teams WHERE team_id = ? LIMIT 1`,
          )
            .bind(effectiveOwnerTeamId)
            .first()) as { team_id: string; station_id: string } | null;

          if (!ownerTeam?.team_id) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "owner_team_id is invalid",
              { owner_team_id: effectiveOwnerTeamId },
            );
          }
          if (ownerTeam.station_id !== effectiveStationId) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "owner_team_id must belong to station_id",
              {
                owner_team_id: effectiveOwnerTeamId,
                station_id: effectiveStationId,
              },
            );
          }

          assign(
            "owner_team_id",
            effectiveOwnerTeamId,
            body.owner_team_id
              ? "owner_team_id"
              : body.owner
                ? "owner"
                : "owner_team_id",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          assign(
            "deleted_at",
            archived ? new Date().toISOString() : null,
            "archived",
          );
          if (archived) {
            assign("device_status", "archived");
          } else if (
            !Object.prototype.hasOwnProperty.call(body, "device_status") &&
            !Object.prototype.hasOwnProperty.call(body, "status")
          ) {
            assign("device_status", "active");
          }
        }

        if (!updates.length) {
          const detail = await loadPlatformDeviceDetailFromDb(
            c.env.DB,
            deviceId,
          );
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), deviceId);
        await c.env.DB.prepare(
          `UPDATE platform_devices SET ${updates.join(", ")} WHERE device_id = ?`,
        )
          .bind(...params)
          .run();

        const refreshed = await loadPlatformDeviceDetailFromDb(
          c.env.DB,
          deviceId,
        );
        await writePlatformDeviceAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "DEVICE_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "DEVICE_ARCHIVED"
                : "DEVICE_UPDATED",
          deviceId,
          stationId: refreshed?.device?.station_id || effectiveStationId,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored device ${deviceId}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived device ${deviceId}`
                : `Updated device ${deviceId}`,
          payload: auditPayload,
        });

        return c.json({ data: refreshed });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(
          c,
          error,
          "PATCH /platform/devices/:deviceId",
        );
      }
    },
  );

  app.delete(
    "/api/v1/platform/devices/:deviceId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const deviceId = normalizeRequiredText(
          c.req.param("deviceId"),
        ).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
              SELECT device_id, station_id, deleted_at
              FROM platform_devices
              WHERE UPPER(device_id) = ?
              LIMIT 1
            `,
        )
          .bind(deviceId)
          .first()) as {
          device_id: string;
          station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Device does not exist",
            { device_id: deviceId },
          );
        }

        if (!existing.deleted_at) {
          await c.env.DB.prepare(
            `UPDATE platform_devices SET deleted_at = ?, device_status = 'archived', updated_at = ? WHERE device_id = ?`,
          )
            .bind(new Date().toISOString(), new Date().toISOString(), deviceId)
            .run();
        }

        await writePlatformDeviceAudit(c, {
          action: "DEVICE_ARCHIVED",
          deviceId,
          stationId: existing.station_id,
          summary: `Archived device ${deviceId}`,
        });

        return c.json({
          data: {
            device_id: deviceId,
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "DELETE /platform/devices/:deviceId",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/devices",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const devicePage = await listPlatformDevicesFromDb(
          c.env.DB,
          c.req.query(),
        );
        return c.json({
          data: {
            deviceRows: devicePage.items,
            devicePage,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/devices");
      }
    },
  );

  app.get(
    "/api/v1/platform/network/lanes/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformNetworkLaneOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/network/lanes/options",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/network/lanes/:laneId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformNetworkLaneDetailFromDb(
          c.env.DB,
          c.req.param("laneId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Lane does not exist",
            {
              lane_id: c.req.param("laneId"),
            },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/network/lanes/:laneId",
        );
      }
    },
  );

  app.post(
    "/api/v1/platform/network/lanes",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const laneId = normalizeRequiredText(
          body.lane_id || body.code || body.laneCode,
        ).toUpperCase();
        const laneName = normalizeRequiredText(body.lane_name || body.lane);
        const businessMode = normalizeNullableText(
          body.business_mode || body.pattern,
        );
        const originStationId = normalizeStationCode(
          body.origin_station_id ||
            body.originStationId ||
            body.origin_station ||
            body.origin,
        );
        const viaStationId =
          normalizeStationCode(
            body.via_station_id ||
              body.viaStationId ||
              body.via_station ||
              body.via,
          ) || null;
        const destinationStationId = normalizeStationCode(
          body.destination_station_id ||
            body.destinationStationId ||
            body.destination_station ||
            body.destination,
        );
        const nodeOrder = normalizeRequiredText(
          body.node_order || body.nodeOrder,
        );
        const keyEvents = normalizeNullableText(
          body.key_events || body.keyEvents || body.events,
        );
        const slaText = normalizeRequiredText(
          body.sla_text || body.sla || body.promise,
        );
        const controlDepth = normalizeRequiredText(
          body.control_depth || body.controlDepth,
        );
        const laneStatus = normalizeRequiredText(
          body.lane_status || body.laneStatus || body.status || "active",
        );
        const note = normalizeNullableText(body.note);

        if (
          !laneId ||
          !laneName ||
          !originStationId ||
          !destinationStationId ||
          !nodeOrder ||
          !slaText ||
          !controlDepth ||
          !laneStatus
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "lane_id, lane_name, origin_station_id, destination_station_id, node_order, sla_text, control_depth and lane_status are required",
          );
        }

        if (originStationId === destinationStationId) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "origin_station_id and destination_station_id must be different",
          );
        }

        if (
          viaStationId &&
          [originStationId, destinationStationId].includes(viaStationId)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "via_station_id must be different from origin and destination",
            {
              via_station_id: viaStationId,
            },
          );
        }

        const options = await loadPlatformNetworkLaneOptions(c.env.DB);
        if (
          !options.stations.some(
            (item) => item.value === originStationId && !item.disabled,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "origin_station_id is invalid",
            { origin_station_id: originStationId },
          );
        }
        if (
          !options.stations.some(
            (item) => item.value === destinationStationId && !item.disabled,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "destination_station_id is invalid",
            {
              destination_station_id: destinationStationId,
            },
          );
        }
        if (
          viaStationId &&
          !options.stations.some(
            (item) => item.value === viaStationId && !item.disabled,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "via_station_id is invalid",
            { via_station_id: viaStationId },
          );
        }
        if (
          !options.controlDepths.some((item) => item.value === controlDepth)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "control_depth is invalid",
            { control_depth: controlDepth },
          );
        }
        if (!options.statuses.some((item) => item.value === laneStatus)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "lane_status is invalid",
            { lane_status: laneStatus },
          );
        }

        const existing = (await c.env.DB.prepare(
          `SELECT lane_id FROM network_lanes WHERE UPPER(lane_id) = ? LIMIT 1`,
        )
          .bind(laneId)
          .first()) as { lane_id: string } | null;

        if (existing?.lane_id) {
          return jsonError(c, 409, "RESOURCE_EXISTS", "Lane already exists", {
            lane_id: laneId,
          });
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
              INSERT INTO network_lanes (
                lane_id,
                lane_name,
                business_mode,
                origin_station_id,
                via_station_id,
                destination_station_id,
                node_order,
                key_events,
                sla_text,
                control_depth,
                lane_status,
                note,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        )
          .bind(
            laneId,
            laneName,
            businessMode,
            originStationId,
            viaStationId,
            destinationStationId,
            nodeOrder,
            keyEvents,
            slaText,
            controlDepth,
            laneStatus,
            note,
            now,
            now,
          )
          .run();

        await writePlatformNetworkLaneAudit(c, {
          action: "LANE_CREATED",
          laneId,
          stationId: originStationId,
          summary: `Created lane ${laneId}`,
          payload: {
            lane_name: laneName,
            origin_station_id: originStationId,
            via_station_id: viaStationId,
            destination_station_id: destinationStationId,
            control_depth: controlDepth,
            lane_status: laneStatus,
          },
        });

        const detail = await loadPlatformNetworkLaneDetailFromDb(
          c.env.DB,
          laneId,
        );
        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "POST /platform/network/lanes");
      }
    },
  );

  app.patch(
    "/api/v1/platform/network/lanes/:laneId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const laneId = normalizeRequiredText(
          c.req.param("laneId"),
        ).toUpperCase();
        const body = await c.req.json();
        const existing = (await c.env.DB.prepare(
          `
              SELECT lane_id, origin_station_id, via_station_id, destination_station_id, deleted_at
              FROM network_lanes
              WHERE UPPER(lane_id) = ?
              LIMIT 1
            `,
        )
          .bind(laneId)
          .first()) as {
          lane_id: string;
          origin_station_id: string;
          via_station_id: string | null;
          destination_station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Lane does not exist",
            { lane_id: laneId },
          );
        }

        const options = await loadPlatformNetworkLaneOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};
        let effectiveOriginStationId = existing.origin_station_id;
        let effectiveViaStationId = existing.via_station_id;
        let effectiveDestinationStationId = existing.destination_station_id;

        const assign = (column: string, value: unknown, key = column) => {
          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (
          Object.prototype.hasOwnProperty.call(body, "lane_name") ||
          Object.prototype.hasOwnProperty.call(body, "lane")
        ) {
          const value = normalizeRequiredText(body.lane_name || body.lane);
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "lane_name cannot be empty",
            );
          }
          assign("lane_name", value, body.lane_name ? "lane_name" : "lane");
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "business_mode") ||
          Object.prototype.hasOwnProperty.call(body, "pattern")
        ) {
          assign(
            "business_mode",
            normalizeNullableText(body.business_mode || body.pattern),
            body.business_mode ? "business_mode" : "pattern",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "origin_station_id") ||
          Object.prototype.hasOwnProperty.call(body, "originStationId") ||
          Object.prototype.hasOwnProperty.call(body, "origin_station") ||
          Object.prototype.hasOwnProperty.call(body, "origin")
        ) {
          const value = normalizeStationCode(
            body.origin_station_id ||
              body.originStationId ||
              body.origin_station ||
              body.origin,
          );
          if (
            !options.stations.some(
              (item) => item.value === value && !item.disabled,
            )
          ) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "origin_station_id is invalid",
              { origin_station_id: value },
            );
          }
          effectiveOriginStationId = value;
          assign(
            "origin_station_id",
            value,
            body.origin_station_id
              ? "origin_station_id"
              : body.originStationId
                ? "originStationId"
                : body.origin_station
                  ? "origin_station"
                  : "origin",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "via_station_id") ||
          Object.prototype.hasOwnProperty.call(body, "viaStationId") ||
          Object.prototype.hasOwnProperty.call(body, "via_station") ||
          Object.prototype.hasOwnProperty.call(body, "via")
        ) {
          const value =
            normalizeStationCode(
              body.via_station_id ||
                body.viaStationId ||
                body.via_station ||
                body.via,
            ) || null;
          if (
            value &&
            !options.stations.some(
              (item) => item.value === value && !item.disabled,
            )
          ) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "via_station_id is invalid",
              { via_station_id: value },
            );
          }
          effectiveViaStationId = value;
          assign(
            "via_station_id",
            value,
            body.via_station_id
              ? "via_station_id"
              : body.viaStationId
                ? "viaStationId"
                : body.via_station
                  ? "via_station"
                  : "via",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(
            body,
            "destination_station_id",
          ) ||
          Object.prototype.hasOwnProperty.call(body, "destinationStationId") ||
          Object.prototype.hasOwnProperty.call(body, "destination_station") ||
          Object.prototype.hasOwnProperty.call(body, "destination")
        ) {
          const value = normalizeStationCode(
            body.destination_station_id ||
              body.destinationStationId ||
              body.destination_station ||
              body.destination,
          );
          if (
            !options.stations.some(
              (item) => item.value === value && !item.disabled,
            )
          ) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "destination_station_id is invalid",
              {
                destination_station_id: value,
              },
            );
          }
          effectiveDestinationStationId = value;
          assign(
            "destination_station_id",
            value,
            body.destination_station_id
              ? "destination_station_id"
              : body.destinationStationId
                ? "destinationStationId"
                : body.destination_station
                  ? "destination_station"
                  : "destination",
          );
        }

        if (effectiveOriginStationId === effectiveDestinationStationId) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "origin_station_id and destination_station_id must be different",
          );
        }

        if (
          effectiveViaStationId &&
          [effectiveOriginStationId, effectiveDestinationStationId].includes(
            effectiveViaStationId,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "via_station_id must be different from origin and destination",
            {
              via_station_id: effectiveViaStationId,
            },
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "node_order") ||
          Object.prototype.hasOwnProperty.call(body, "nodeOrder")
        ) {
          const value = normalizeRequiredText(
            body.node_order || body.nodeOrder,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "node_order cannot be empty",
            );
          }
          assign(
            "node_order",
            value,
            body.node_order ? "node_order" : "nodeOrder",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "key_events") ||
          Object.prototype.hasOwnProperty.call(body, "keyEvents") ||
          Object.prototype.hasOwnProperty.call(body, "events")
        ) {
          assign(
            "key_events",
            normalizeNullableText(
              body.key_events || body.keyEvents || body.events,
            ),
            body.key_events
              ? "key_events"
              : body.keyEvents
                ? "keyEvents"
                : "events",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "sla_text") ||
          Object.prototype.hasOwnProperty.call(body, "sla") ||
          Object.prototype.hasOwnProperty.call(body, "promise")
        ) {
          const value = normalizeRequiredText(
            body.sla_text || body.sla || body.promise,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "sla_text cannot be empty",
            );
          }
          assign(
            "sla_text",
            value,
            body.sla_text ? "sla_text" : body.sla ? "sla" : "promise",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "control_depth") ||
          Object.prototype.hasOwnProperty.call(body, "controlDepth")
        ) {
          const value = normalizeRequiredText(
            body.control_depth || body.controlDepth,
          );
          if (!options.controlDepths.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "control_depth is invalid",
              { control_depth: value },
            );
          }
          assign(
            "control_depth",
            value,
            body.control_depth ? "control_depth" : "controlDepth",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "lane_status") ||
          Object.prototype.hasOwnProperty.call(body, "laneStatus") ||
          Object.prototype.hasOwnProperty.call(body, "status")
        ) {
          const value = normalizeRequiredText(
            body.lane_status || body.laneStatus || body.status,
          );
          if (!options.statuses.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "lane_status is invalid",
              { lane_status: value },
            );
          }
          assign(
            "lane_status",
            value,
            body.lane_status
              ? "lane_status"
              : body.laneStatus
                ? "laneStatus"
                : "status",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "note")) {
          assign("note", normalizeNullableText(body.note));
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          assign(
            "deleted_at",
            archived ? new Date().toISOString() : null,
            "archived",
          );
          if (archived) {
            assign("lane_status", "archived");
          } else if (
            !Object.prototype.hasOwnProperty.call(body, "lane_status") &&
            !Object.prototype.hasOwnProperty.call(body, "laneStatus") &&
            !Object.prototype.hasOwnProperty.call(body, "status")
          ) {
            assign("lane_status", "active");
          }
        }

        if (!updates.length) {
          const detail = await loadPlatformNetworkLaneDetailFromDb(
            c.env.DB,
            laneId,
          );
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), laneId);
        await c.env.DB.prepare(
          `UPDATE network_lanes SET ${updates.join(", ")} WHERE lane_id = ?`,
        )
          .bind(...params)
          .run();

        const refreshed = await loadPlatformNetworkLaneDetailFromDb(
          c.env.DB,
          laneId,
        );
        await writePlatformNetworkLaneAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "LANE_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "LANE_ARCHIVED"
                : "LANE_UPDATED",
          laneId,
          stationId:
            refreshed?.lane?.origin_station_id || effectiveOriginStationId,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored lane ${laneId}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived lane ${laneId}`
                : `Updated lane ${laneId}`,
          payload: auditPayload,
        });

        return c.json({ data: refreshed });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(
          c,
          error,
          "PATCH /platform/network/lanes/:laneId",
        );
      }
    },
  );

  app.delete(
    "/api/v1/platform/network/lanes/:laneId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const laneId = normalizeRequiredText(
          c.req.param("laneId"),
        ).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
              SELECT lane_id, origin_station_id, deleted_at
              FROM network_lanes
              WHERE UPPER(lane_id) = ?
              LIMIT 1
            `,
        )
          .bind(laneId)
          .first()) as {
          lane_id: string;
          origin_station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Lane does not exist",
            { lane_id: laneId },
          );
        }

        if (!existing.deleted_at) {
          await c.env.DB.prepare(
            `UPDATE network_lanes SET deleted_at = ?, lane_status = 'archived', updated_at = ? WHERE lane_id = ?`,
          )
            .bind(new Date().toISOString(), new Date().toISOString(), laneId)
            .run();
        }

        await writePlatformNetworkLaneAudit(c, {
          action: "LANE_ARCHIVED",
          laneId,
          stationId: existing.origin_station_id,
          summary: `Archived lane ${laneId}`,
        });

        return c.json({
          data: {
            lane_id: laneId,
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "DELETE /platform/network/lanes/:laneId",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/network/lanes",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const lanePage = await listPlatformNetworkLanesFromDb(
          c.env.DB,
          c.req.query(),
        );
        return c.json({
          data: {
            laneRows: lanePage.items,
            lanePage,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/network/lanes");
      }
    },
  );

  app.get(
    "/api/v1/platform/network/scenarios/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformNetworkScenarioOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/network/scenarios/options",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/network/scenarios/:scenarioId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformNetworkScenarioDetailFromDb(
          c.env.DB,
          c.req.param("scenarioId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Scenario does not exist",
            {
              scenario_id: c.req.param("scenarioId"),
            },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/network/scenarios/:scenarioId",
        );
      }
    },
  );

  app.post(
    "/api/v1/platform/network/scenarios",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const scenarioId = normalizeRequiredText(
          body.scenario_id || body.id || body.scenarioId,
        ).toUpperCase();
        const scenarioTitle = normalizeRequiredText(
          body.scenario_title || body.title || body.scenarioTitle,
        );
        const scenarioCategory = normalizeRequiredText(
          body.scenario_category || body.category || body.scenarioCategory,
        );
        const laneId = normalizeRequiredText(
          body.lane_id || body.laneId || body.lane_code || body.laneCode,
        ).toUpperCase();
        const primaryStationId = normalizeStationCode(
          body.primary_station_id ||
            body.primaryStationId ||
            body.station_id ||
            body.station,
        );
        const nodeSequence = normalizeRequiredText(
          body.node_sequence || body.nodeSequence || body.nodes,
        );
        const entryRuleSummary = normalizeRequiredText(
          body.entry_rule_summary || body.entryRule || body.entry_rule,
        );
        const evidenceRequirements = normalizeRequiredText(
          body.evidence_requirements ||
            body.evidenceRequirements ||
            body.evidence,
        );
        const scenarioStatus = normalizeRequiredText(
          body.scenario_status ||
            body.scenarioStatus ||
            body.status ||
            "active",
        );
        const note = normalizeNullableText(body.note);

        if (
          !scenarioId ||
          !scenarioTitle ||
          !scenarioCategory ||
          !laneId ||
          !primaryStationId ||
          !nodeSequence ||
          !entryRuleSummary ||
          !evidenceRequirements ||
          !scenarioStatus
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "scenario_id, scenario_title, scenario_category, lane_id, primary_station_id, node_sequence, entry_rule_summary, evidence_requirements and scenario_status are required",
          );
        }

        const options = await loadPlatformNetworkScenarioOptions(c.env.DB);
        if (
          !options.categories.some((item) => item.value === scenarioCategory)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "scenario_category is invalid",
            { scenario_category: scenarioCategory },
          );
        }
        if (!options.statuses.some((item) => item.value === scenarioStatus)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "scenario_status is invalid",
            { scenario_status: scenarioStatus },
          );
        }
        if (
          !options.stations.some(
            (item) => item.value === primaryStationId && !item.disabled,
          )
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "primary_station_id is invalid",
            { primary_station_id: primaryStationId },
          );
        }
        if (
          !options.lanes.some((item) => item.value === laneId && !item.disabled)
        ) {
          return jsonError(c, 400, "VALIDATION_ERROR", "lane_id is invalid", {
            lane_id: laneId,
          });
        }

        const laneScope = await findPlatformNetworkLaneScope(c.env.DB, laneId);
        if (!laneScope?.lane_id || Boolean(laneScope.deleted_at)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "lane_id is invalid", {
            lane_id: laneId,
          });
        }
        if (!laneIncludesStation(laneScope, primaryStationId)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "primary_station_id must belong to lane_id",
            {
              primary_station_id: primaryStationId,
              lane_id: laneId,
            },
          );
        }

        const existing = (await c.env.DB.prepare(
          `
            SELECT scenario_id
            FROM network_scenarios
            WHERE UPPER(scenario_id) = ?
            LIMIT 1
          `,
        )
          .bind(scenarioId)
          .first()) as { scenario_id: string } | null;

        if (existing?.scenario_id) {
          return jsonError(
            c,
            409,
            "RESOURCE_EXISTS",
            "Scenario already exists",
            {
              scenario_id: scenarioId,
            },
          );
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
            INSERT INTO network_scenarios (
              scenario_id,
              scenario_title,
              scenario_category,
              lane_id,
              primary_station_id,
              node_sequence,
              entry_rule_summary,
              evidence_requirements,
              scenario_status,
              note,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            scenarioId,
            scenarioTitle,
            scenarioCategory,
            laneId,
            primaryStationId,
            nodeSequence,
            entryRuleSummary,
            evidenceRequirements,
            scenarioStatus,
            note,
            now,
            now,
          )
          .run();

        await writePlatformNetworkScenarioAudit(c, {
          action: "SCENARIO_CREATED",
          scenarioId,
          stationId: primaryStationId,
          summary: `Created scenario ${scenarioId}`,
          payload: {
            scenario_title: scenarioTitle,
            scenario_category: scenarioCategory,
            lane_id: laneId,
            primary_station_id: primaryStationId,
            scenario_status: scenarioStatus,
          },
        });

        const detail = await loadPlatformNetworkScenarioDetailFromDb(
          c.env.DB,
          scenarioId,
        );
        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(
          c,
          error,
          "POST /platform/network/scenarios",
        );
      }
    },
  );

  app.patch(
    "/api/v1/platform/network/scenarios/:scenarioId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const scenarioId = normalizeRequiredText(
          c.req.param("scenarioId"),
        ).toUpperCase();
        const body = await c.req.json();
        const existing = (await c.env.DB.prepare(
          `
            SELECT scenario_id, lane_id, primary_station_id, deleted_at
            FROM network_scenarios
            WHERE UPPER(scenario_id) = ?
            LIMIT 1
          `,
        )
          .bind(scenarioId)
          .first()) as {
          scenario_id: string;
          lane_id: string;
          primary_station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Scenario does not exist",
            { scenario_id: scenarioId },
          );
        }

        const options = await loadPlatformNetworkScenarioOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};
        let effectiveLaneId = existing.lane_id;
        let effectivePrimaryStationId = existing.primary_station_id;

        const assign = (column: string, value: unknown, key = column) => {
          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (
          Object.prototype.hasOwnProperty.call(body, "scenario_title") ||
          Object.prototype.hasOwnProperty.call(body, "title") ||
          Object.prototype.hasOwnProperty.call(body, "scenarioTitle")
        ) {
          const value = normalizeRequiredText(
            body.scenario_title || body.title || body.scenarioTitle,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "scenario_title cannot be empty",
            );
          }
          assign(
            "scenario_title",
            value,
            body.scenario_title
              ? "scenario_title"
              : body.scenarioTitle
                ? "scenarioTitle"
                : "title",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "scenario_category") ||
          Object.prototype.hasOwnProperty.call(body, "category") ||
          Object.prototype.hasOwnProperty.call(body, "scenarioCategory")
        ) {
          const value = normalizeRequiredText(
            body.scenario_category || body.category || body.scenarioCategory,
          );
          if (!options.categories.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "scenario_category is invalid",
              { scenario_category: value },
            );
          }
          assign(
            "scenario_category",
            value,
            body.scenario_category
              ? "scenario_category"
              : body.scenarioCategory
                ? "scenarioCategory"
                : "category",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "lane_id") ||
          Object.prototype.hasOwnProperty.call(body, "laneId") ||
          Object.prototype.hasOwnProperty.call(body, "lane_code") ||
          Object.prototype.hasOwnProperty.call(body, "laneCode")
        ) {
          const value = normalizeRequiredText(
            body.lane_id || body.laneId || body.lane_code || body.laneCode,
          ).toUpperCase();
          if (
            !options.lanes.some((item) => item.value === value && !item.disabled)
          ) {
            return jsonError(c, 400, "VALIDATION_ERROR", "lane_id is invalid", {
              lane_id: value,
            });
          }
          effectiveLaneId = value;
          assign(
            "lane_id",
            value,
            body.lane_id
              ? "lane_id"
              : body.laneId
                ? "laneId"
                : body.lane_code
                  ? "lane_code"
                  : "laneCode",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "primary_station_id") ||
          Object.prototype.hasOwnProperty.call(body, "primaryStationId") ||
          Object.prototype.hasOwnProperty.call(body, "station_id") ||
          Object.prototype.hasOwnProperty.call(body, "station")
        ) {
          const value = normalizeStationCode(
            body.primary_station_id ||
              body.primaryStationId ||
              body.station_id ||
              body.station,
          );
          if (
            !options.stations.some((item) => item.value === value && !item.disabled)
          ) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "primary_station_id is invalid",
              { primary_station_id: value },
            );
          }
          effectivePrimaryStationId = value;
          assign(
            "primary_station_id",
            value,
            body.primary_station_id
              ? "primary_station_id"
              : body.primaryStationId
                ? "primaryStationId"
                : body.station_id
                  ? "station_id"
                  : "station",
          );
        }

        const effectiveLaneScope = await findPlatformNetworkLaneScope(
          c.env.DB,
          effectiveLaneId,
        );
        if (!effectiveLaneScope?.lane_id || Boolean(effectiveLaneScope.deleted_at)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "lane_id is invalid", {
            lane_id: effectiveLaneId,
          });
        }
        if (!laneIncludesStation(effectiveLaneScope, effectivePrimaryStationId)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "primary_station_id must belong to lane_id",
            {
              primary_station_id: effectivePrimaryStationId,
              lane_id: effectiveLaneId,
            },
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "node_sequence") ||
          Object.prototype.hasOwnProperty.call(body, "nodeSequence") ||
          Object.prototype.hasOwnProperty.call(body, "nodes")
        ) {
          const value = normalizeRequiredText(
            body.node_sequence || body.nodeSequence || body.nodes,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "node_sequence cannot be empty",
            );
          }
          assign(
            "node_sequence",
            value,
            body.node_sequence
              ? "node_sequence"
              : body.nodeSequence
                ? "nodeSequence"
                : "nodes",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "entry_rule_summary") ||
          Object.prototype.hasOwnProperty.call(body, "entryRule") ||
          Object.prototype.hasOwnProperty.call(body, "entry_rule")
        ) {
          const value = normalizeRequiredText(
            body.entry_rule_summary || body.entryRule || body.entry_rule,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "entry_rule_summary cannot be empty",
            );
          }
          assign(
            "entry_rule_summary",
            value,
            body.entry_rule_summary
              ? "entry_rule_summary"
              : body.entryRule
                ? "entryRule"
                : "entry_rule",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "evidence_requirements") ||
          Object.prototype.hasOwnProperty.call(body, "evidenceRequirements") ||
          Object.prototype.hasOwnProperty.call(body, "evidence")
        ) {
          const value = normalizeRequiredText(
            body.evidence_requirements ||
              body.evidenceRequirements ||
              body.evidence,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "evidence_requirements cannot be empty",
            );
          }
          assign(
            "evidence_requirements",
            value,
            body.evidence_requirements
              ? "evidence_requirements"
              : body.evidenceRequirements
                ? "evidenceRequirements"
                : "evidence",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "scenario_status") ||
          Object.prototype.hasOwnProperty.call(body, "scenarioStatus") ||
          Object.prototype.hasOwnProperty.call(body, "status")
        ) {
          const value = normalizeRequiredText(
            body.scenario_status || body.scenarioStatus || body.status,
          );
          if (!options.statuses.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "scenario_status is invalid",
              { scenario_status: value },
            );
          }
          assign(
            "scenario_status",
            value,
            body.scenario_status
              ? "scenario_status"
              : body.scenarioStatus
                ? "scenarioStatus"
                : "status",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "note")) {
          assign("note", normalizeNullableText(body.note));
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          assign(
            "deleted_at",
            archived ? new Date().toISOString() : null,
            "archived",
          );
          if (archived) {
            assign("scenario_status", "archived");
          } else if (
            !Object.prototype.hasOwnProperty.call(body, "scenario_status") &&
            !Object.prototype.hasOwnProperty.call(body, "scenarioStatus") &&
            !Object.prototype.hasOwnProperty.call(body, "status")
          ) {
            assign("scenario_status", "active");
          }
        }

        if (!updates.length) {
          const detail = await loadPlatformNetworkScenarioDetailFromDb(
            c.env.DB,
            scenarioId,
          );
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), scenarioId);
        await c.env.DB.prepare(
          `UPDATE network_scenarios SET ${updates.join(", ")} WHERE scenario_id = ?`,
        )
          .bind(...params)
          .run();

        const refreshed = await loadPlatformNetworkScenarioDetailFromDb(
          c.env.DB,
          scenarioId,
        );
        await writePlatformNetworkScenarioAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "SCENARIO_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "SCENARIO_ARCHIVED"
                : "SCENARIO_UPDATED",
          scenarioId,
          stationId:
            refreshed?.scenario?.primary_station_id || effectivePrimaryStationId,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored scenario ${scenarioId}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived scenario ${scenarioId}`
                : `Updated scenario ${scenarioId}`,
          payload: auditPayload,
        });

        return c.json({ data: refreshed });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(
          c,
          error,
          "PATCH /platform/network/scenarios/:scenarioId",
        );
      }
    },
  );

  app.delete(
    "/api/v1/platform/network/scenarios/:scenarioId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const scenarioId = normalizeRequiredText(
          c.req.param("scenarioId"),
        ).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
            SELECT scenario_id, primary_station_id, deleted_at
            FROM network_scenarios
            WHERE UPPER(scenario_id) = ?
            LIMIT 1
          `,
        )
          .bind(scenarioId)
          .first()) as {
          scenario_id: string;
          primary_station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Scenario does not exist",
            { scenario_id: scenarioId },
          );
        }

        if (!existing.deleted_at) {
          await c.env.DB.prepare(
            `UPDATE network_scenarios SET deleted_at = ?, scenario_status = 'archived', updated_at = ? WHERE scenario_id = ?`,
          )
            .bind(
              new Date().toISOString(),
              new Date().toISOString(),
              scenarioId,
            )
            .run();
        }

        await writePlatformNetworkScenarioAudit(c, {
          action: "SCENARIO_ARCHIVED",
          scenarioId,
          stationId: existing.primary_station_id,
          summary: `Archived scenario ${scenarioId}`,
        });

        return c.json({
          data: {
            scenario_id: scenarioId,
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "DELETE /platform/network/scenarios/:scenarioId",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/network/scenarios",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const scenarioPage = await listPlatformNetworkScenariosFromDb(
          c.env.DB,
          c.req.query(),
        );
        return c.json({
          data: {
            scenarioRows: scenarioPage.items,
            scenarioPage,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/network/scenarios",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/network",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const [stationCatalogPage, laneRows, scenarioRows] = await Promise.all([
          listPlatformStationsFromDb(c.env.DB, {
            page: "1",
            page_size: "100",
          }),
          listPlatformNetworkLaneRowsForSummary(c.env.DB),
          listPlatformNetworkScenarioRowsForSummary(c.env.DB),
        ]);

        return c.json({
          data: {
            stationCatalog: stationCatalogPage.items,
            routeMatrix: laneRows.map((item) => ({
              lane: item.lane,
              pattern: item.pattern,
              stations: item.stations,
              promise: item.promise,
              events: item.events,
            })),
            networkLaneTemplateRows: laneRows.map((item) => ({
              laneCode: item.laneCode,
              lane: item.lane,
              nodeOrder: item.nodeOrder,
              sla: item.sla,
              controlDepth: item.controlDepth,
              sampleStation: item.sampleStation,
            })),
            networkScenarioRows: scenarioRows,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/network");
      }
    },
  );

  app.get(
    "/api/v1/platform/rules/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformRuleOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/rules/options");
      }
    },
  );

  app.get(
    "/api/v1/platform/rules/:ruleId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformRuleDetailFromDb(
          c.env.DB,
          c.req.param("ruleId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Rule does not exist",
            {
              rule_id: c.req.param("ruleId"),
            },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/rules/:ruleId");
      }
    },
  );

  app.post(
    "/api/v1/platform/rules",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const ruleId = normalizeRequiredText(
          body.rule_id || body.id || body.code,
        ).toUpperCase();
        const ruleName = normalizeRequiredText(body.rule_name || body.name);
        const ruleType = normalizeRequiredText(
          body.rule_type || body.type,
        );
        const controlLevel = normalizeRequiredText(
          body.control_level || body.controlLevel,
        );
        const applicabilityScope = normalizeRequiredText(
          body.applicability_scope || body.scope || body.applicabilityScope,
        );
        const relatedStationId = normalizeStationCode(
          body.related_station_id || body.station_id || body.station,
        );
        const relatedLaneId = normalizeRequiredText(
          body.related_lane_id || body.lane_id || body.lane,
        ).toUpperCase();
        const relatedScenarioId = normalizeRequiredText(
          body.related_scenario_id || body.scenario_id || body.scenario,
        ).toUpperCase();
        const serviceLevel = normalizeNullableText(
          body.service_level || body.serviceLevel,
        );
        const timelineStage = normalizeRequiredText(
          body.timeline_stage || body.timelineStage,
        );
        const ruleStatus = normalizeRequiredText(
          body.rule_status || body.status || "active",
        );
        const summary = normalizeRequiredText(body.summary);
        const triggerCondition = normalizeNullableText(
          body.trigger_condition || body.triggerCondition,
        );
        const triggerNode = normalizeNullableText(
          body.trigger_node || body.triggerNode,
        );
        const actionTarget = normalizeNullableText(
          body.action_target || body.actionTarget,
        );
        const blockerAction = normalizeNullableText(
          body.blocker_action || body.blockerAction,
        );
        const recoveryAction = normalizeNullableText(
          body.recovery_action || body.recoveryAction,
        );
        const evidenceRequirements = normalizeNullableText(
          body.evidence_requirements || body.evidenceRequirements,
        );
        const ownerRole = normalizeNullableText(
          body.owner_role || body.ownerRole,
        );
        const note = normalizeNullableText(body.note);

        if (
          !ruleId ||
          !ruleName ||
          !ruleType ||
          !controlLevel ||
          !applicabilityScope ||
          !timelineStage ||
          !ruleStatus ||
          !summary
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "rule_id, rule_name, rule_type, control_level, applicability_scope, timeline_stage, rule_status and summary are required",
          );
        }

        const options = await loadPlatformRuleOptions(c.env.DB);
        if (!options.types.some((item) => item.value === ruleType)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "rule_type is invalid", {
            rule_type: ruleType,
          });
        }
        if (
          !options.controlLevels.some((item) => item.value === controlLevel)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "control_level is invalid",
            {
              control_level: controlLevel,
            },
          );
        }
        if (
          !options.scopes.some((item) => item.value === applicabilityScope)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "applicability_scope is invalid",
            {
              applicability_scope: applicabilityScope,
            },
          );
        }
        if (!options.statuses.some((item) => item.value === ruleStatus)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "rule_status is invalid",
            {
              rule_status: ruleStatus,
            },
          );
        }
        if (
          !options.timelineStages.some((item) => item.value === timelineStage)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "timeline_stage is invalid",
            {
              timeline_stage: timelineStage,
            },
          );
        }
        if (
          serviceLevel &&
          !options.serviceLevels.some((item) => item.value === serviceLevel)
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "service_level is invalid",
            {
              service_level: serviceLevel,
            },
          );
        }
        if (ruleType === "service_level" && !serviceLevel) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "service_level is required when rule_type = service_level",
          );
        }

        const resolvedTargets = await resolvePlatformRuleScopeTargets(
          c.env.DB,
          options,
          {
            scope: applicabilityScope,
            relatedStationId,
            relatedLaneId,
            relatedScenarioId,
          },
        );

        if ("error" in resolvedTargets && resolvedTargets.error) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            resolvedTargets.error.message,
            resolvedTargets.error.details,
          );
        }

        const existing = (await c.env.DB.prepare(
          `
            SELECT rule_id
            FROM platform_rules
            WHERE UPPER(rule_id) = ?
            LIMIT 1
          `,
        )
          .bind(ruleId)
          .first()) as { rule_id: string } | null;

        if (existing?.rule_id) {
          return jsonError(c, 409, "RESOURCE_EXISTS", "Rule already exists", {
            rule_id: ruleId,
          });
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
            INSERT INTO platform_rules (
              rule_id,
              rule_name,
              rule_type,
              control_level,
              applicability_scope,
              related_station_id,
              related_lane_id,
              related_scenario_id,
              service_level,
              timeline_stage,
              rule_status,
              summary,
              trigger_condition,
              trigger_node,
              action_target,
              blocker_action,
              recovery_action,
              evidence_requirements,
              owner_role,
              note,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            ruleId,
            ruleName,
            ruleType,
            controlLevel,
            applicabilityScope,
            resolvedTargets.related_station_id,
            resolvedTargets.related_lane_id,
            resolvedTargets.related_scenario_id,
            serviceLevel,
            timelineStage,
            ruleStatus,
            summary,
            triggerCondition,
            triggerNode,
            actionTarget,
            blockerAction,
            recoveryAction,
            evidenceRequirements,
            ownerRole,
            note,
            now,
            now,
          )
          .run();

        await writePlatformRuleAudit(c, {
          action: "RULE_CREATED",
          ruleId,
          stationId: resolvedTargets.audit_station_id,
          summary: `Created rule ${ruleId}`,
          payload: {
            rule_type: ruleType,
            control_level: controlLevel,
            applicability_scope: applicabilityScope,
            related_station_id: resolvedTargets.related_station_id,
            related_lane_id: resolvedTargets.related_lane_id,
            related_scenario_id: resolvedTargets.related_scenario_id,
            timeline_stage: timelineStage,
            rule_status: ruleStatus,
          },
        });

        const detail = await loadPlatformRuleDetailFromDb(c.env.DB, ruleId);
        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "POST /platform/rules");
      }
    },
  );

  app.patch(
    "/api/v1/platform/rules/:ruleId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const ruleId = normalizeRequiredText(c.req.param("ruleId")).toUpperCase();
        const body = await c.req.json();
        const existing = (await c.env.DB.prepare(
          `
            SELECT
              rule_id,
              rule_type,
              service_level,
              applicability_scope,
              related_station_id,
              related_lane_id,
              related_scenario_id,
              rule_status,
              deleted_at
            FROM platform_rules
            WHERE UPPER(rule_id) = ?
            LIMIT 1
          `,
        )
          .bind(ruleId)
          .first()) as {
          rule_id: string;
          rule_type: string;
          service_level: string | null;
          applicability_scope: string;
          related_station_id: string | null;
          related_lane_id: string | null;
          related_scenario_id: string | null;
          rule_status: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Rule does not exist",
            {
              rule_id: ruleId,
            },
          );
        }

        const options = await loadPlatformRuleOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};
        let effectiveScope = existing.applicability_scope;
        let effectiveStationId = existing.related_station_id;
        let effectiveLaneId = existing.related_lane_id;
        let effectiveScenarioId = existing.related_scenario_id;
        let auditStationId =
          existing.related_station_id || (await loadPlatformRuleAuditFallbackStationId(c.env.DB));
        const hasAny = (...keys: string[]) =>
          keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));

        const assign = (column: string, value: unknown, key = column) => {
          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (hasAny("rule_name", "name")) {
          const value = normalizeRequiredText(body.rule_name || body.name);
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "rule_name cannot be empty",
            );
          }
          assign("rule_name", value, body.rule_name ? "rule_name" : "name");
        }

        if (hasAny("rule_type", "type")) {
          const value = normalizeRequiredText(body.rule_type || body.type);
          if (!options.types.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "rule_type is invalid",
              {
                rule_type: value,
              },
            );
          }
          assign("rule_type", value, body.rule_type ? "rule_type" : "type");
        }

        if (hasAny("control_level", "controlLevel")) {
          const value = normalizeRequiredText(
            body.control_level || body.controlLevel,
          );
          if (!options.controlLevels.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "control_level is invalid",
              {
                control_level: value,
              },
            );
          }
          assign(
            "control_level",
            value,
            body.control_level ? "control_level" : "controlLevel",
          );
        }

        if (hasAny("applicability_scope", "scope", "applicabilityScope")) {
          const value = normalizeRequiredText(
            body.applicability_scope || body.scope || body.applicabilityScope,
          );
          if (!options.scopes.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "applicability_scope is invalid",
              {
                applicability_scope: value,
              },
            );
          }
          effectiveScope = value;
          assign(
            "applicability_scope",
            value,
            body.applicability_scope
              ? "applicability_scope"
              : body.scope
                ? "scope"
                : "applicabilityScope",
          );
        }

        if (hasAny("service_level", "serviceLevel")) {
          const value = normalizeNullableText(
            body.service_level || body.serviceLevel,
          );
          if (
            value &&
            !options.serviceLevels.some((item) => item.value === value)
          ) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "service_level is invalid",
              {
                service_level: value,
              },
            );
          }
          assign(
            "service_level",
            value,
            body.service_level ? "service_level" : "serviceLevel",
          );
        }

        if (hasAny("timeline_stage", "timelineStage")) {
          const value = normalizeRequiredText(
            body.timeline_stage || body.timelineStage,
          );
          if (!options.timelineStages.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "timeline_stage is invalid",
              {
                timeline_stage: value,
              },
            );
          }
          assign(
            "timeline_stage",
            value,
            body.timeline_stage ? "timeline_stage" : "timelineStage",
          );
        }

        if (hasAny("rule_status", "status")) {
          const value = normalizeRequiredText(body.rule_status || body.status);
          if (!options.statuses.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "rule_status is invalid",
              {
                rule_status: value,
              },
            );
          }
          assign(
            "rule_status",
            value,
            body.rule_status ? "rule_status" : "status",
          );
        }

        if (hasAny("summary")) {
          const value = normalizeRequiredText(body.summary);
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "summary cannot be empty",
            );
          }
          assign("summary", value);
        }

        if (hasAny("trigger_condition", "triggerCondition")) {
          assign(
            "trigger_condition",
            normalizeNullableText(
              body.trigger_condition || body.triggerCondition,
            ),
            body.trigger_condition ? "trigger_condition" : "triggerCondition",
          );
        }

        if (hasAny("trigger_node", "triggerNode")) {
          assign(
            "trigger_node",
            normalizeNullableText(body.trigger_node || body.triggerNode),
            body.trigger_node ? "trigger_node" : "triggerNode",
          );
        }

        if (hasAny("action_target", "actionTarget")) {
          assign(
            "action_target",
            normalizeNullableText(body.action_target || body.actionTarget),
            body.action_target ? "action_target" : "actionTarget",
          );
        }

        if (hasAny("blocker_action", "blockerAction")) {
          assign(
            "blocker_action",
            normalizeNullableText(body.blocker_action || body.blockerAction),
            body.blocker_action ? "blocker_action" : "blockerAction",
          );
        }

        if (hasAny("recovery_action", "recoveryAction")) {
          assign(
            "recovery_action",
            normalizeNullableText(body.recovery_action || body.recoveryAction),
            body.recovery_action ? "recovery_action" : "recoveryAction",
          );
        }

        if (hasAny("evidence_requirements", "evidenceRequirements")) {
          assign(
            "evidence_requirements",
            normalizeNullableText(
              body.evidence_requirements || body.evidenceRequirements,
            ),
            body.evidence_requirements
              ? "evidence_requirements"
              : "evidenceRequirements",
          );
        }

        if (hasAny("owner_role", "ownerRole")) {
          assign(
            "owner_role",
            normalizeNullableText(body.owner_role || body.ownerRole),
            body.owner_role ? "owner_role" : "ownerRole",
          );
        }

        if (hasAny("note")) {
          assign("note", normalizeNullableText(body.note));
        }

        if (hasAny("related_station_id", "station_id", "station")) {
          effectiveStationId = normalizeStationCode(
            body.related_station_id || body.station_id || body.station,
          );
        }

        if (hasAny("related_lane_id", "lane_id", "lane")) {
          effectiveLaneId = normalizeRequiredText(
            body.related_lane_id || body.lane_id || body.lane,
          ).toUpperCase();
        }

        if (hasAny("related_scenario_id", "scenario_id", "scenario")) {
          effectiveScenarioId = normalizeRequiredText(
            body.related_scenario_id || body.scenario_id || body.scenario,
          ).toUpperCase();
        }

        if (
          hasAny("applicability_scope", "scope", "applicabilityScope") ||
          hasAny("related_station_id", "station_id", "station") ||
          hasAny("related_lane_id", "lane_id", "lane") ||
          hasAny("related_scenario_id", "scenario_id", "scenario")
        ) {
          const resolvedTargets = await resolvePlatformRuleScopeTargets(
            c.env.DB,
            options,
            {
              scope: effectiveScope,
              relatedStationId: effectiveStationId,
              relatedLaneId: effectiveLaneId,
              relatedScenarioId: effectiveScenarioId,
            },
          );

          if ("error" in resolvedTargets && resolvedTargets.error) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              resolvedTargets.error.message,
              resolvedTargets.error.details,
            );
          }

          effectiveStationId = resolvedTargets.related_station_id;
          effectiveLaneId = resolvedTargets.related_lane_id;
          effectiveScenarioId = resolvedTargets.related_scenario_id;
          auditStationId = resolvedTargets.audit_station_id;

          assign("related_station_id", effectiveStationId, "related_station_id");
          assign("related_lane_id", effectiveLaneId, "related_lane_id");
          assign("related_scenario_id", effectiveScenarioId, "related_scenario_id");
        }

        const ruleTypeToValidate = hasAny("rule_type", "type")
          ? normalizeRequiredText(body.rule_type || body.type)
          : existing.rule_type;
        const serviceLevelToValidate = hasAny("service_level", "serviceLevel")
          ? normalizeNullableText(body.service_level || body.serviceLevel)
          : existing.service_level;

        if (
          ruleTypeToValidate === "service_level" &&
          !serviceLevelToValidate
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "service_level is required when rule_type = service_level",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          assign(
            "deleted_at",
            archived ? new Date().toISOString() : null,
            "archived",
          );

          if (archived) {
            assign("rule_status", "archived");
          } else if (!hasAny("rule_status", "status")) {
            assign(
              "rule_status",
              existing.rule_status === "archived"
                ? "active"
                : existing.rule_status,
            );
          }
        }

        if (!updates.length) {
          const detail = await loadPlatformRuleDetailFromDb(c.env.DB, ruleId);
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), ruleId);
        await c.env.DB.prepare(
          `UPDATE platform_rules SET ${updates.join(", ")} WHERE rule_id = ?`,
        )
          .bind(...params)
          .run();

        const refreshed = await loadPlatformRuleDetailFromDb(c.env.DB, ruleId);
        await writePlatformRuleAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "RULE_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "RULE_ARCHIVED"
                : "RULE_UPDATED",
          ruleId,
          stationId: auditStationId,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored rule ${ruleId}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived rule ${ruleId}`
                : `Updated rule ${ruleId}`,
          payload: auditPayload,
        });

        return c.json({ data: refreshed });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "PATCH /platform/rules/:ruleId");
      }
    },
  );

  app.delete(
    "/api/v1/platform/rules/:ruleId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const ruleId = normalizeRequiredText(c.req.param("ruleId")).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
            SELECT rule_id, related_station_id, deleted_at
            FROM platform_rules
            WHERE UPPER(rule_id) = ?
            LIMIT 1
          `,
        )
          .bind(ruleId)
          .first()) as {
          rule_id: string;
          related_station_id: string | null;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Rule does not exist",
            {
              rule_id: ruleId,
            },
          );
        }

        if (!existing.deleted_at) {
          const now = new Date().toISOString();
          await c.env.DB.prepare(
            `
              UPDATE platform_rules
              SET deleted_at = ?, rule_status = 'archived', updated_at = ?
              WHERE rule_id = ?
            `,
          )
            .bind(now, now, ruleId)
            .run();
        }

        await writePlatformRuleAudit(c, {
          action: "RULE_ARCHIVED",
          ruleId,
          stationId: existing.related_station_id,
          summary: `Archived rule ${ruleId}`,
        });

        return c.json({
          data: {
            rule_id: ruleId,
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "DELETE /platform/rules/:ruleId");
      }
    },
  );

  app.get(
    "/api/v1/platform/rules",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const [rulePage, summaryDto] = await Promise.all([
          listPlatformRulesFromDb(c.env.DB, c.req.query()),
          loadPlatformRuleSummaryDto(c.env.DB),
        ]);

        return c.json({
          data: {
            ruleRows: rulePage.items,
            rulePage,
            ruleTypeSummaryRows: summaryDto.ruleTypeSummaryRows,
            ruleTimelineRows: summaryDto.ruleTimelineRows,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/rules");
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformMasterDataOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/master-data/options",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/sync",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const syncPage = await listPlatformMasterDataSyncFromDb(
          c.env.DB,
          c.req.query(),
        );

        return c.json({
          data: {
            syncRows: syncPage.items,
            syncPage,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/master-data/sync");
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/jobs",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const jobPage = await listPlatformMasterDataJobsFromDb(
          c.env.DB,
          c.req.query(),
        );

        return c.json({
          data: {
            jobRows: jobPage.items,
            jobPage,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/master-data/jobs");
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/relationships",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const relationshipPage = await listPlatformMasterDataRelationshipsFromDb(
          c.env.DB,
          c.req.query(),
        );

        return c.json({
          data: {
            relationshipRows: relationshipPage.items,
            relationshipPage,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/master-data/relationships",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/:masterDataId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformMasterDataDetailFromDb(
          c.env.DB,
          c.req.param("masterDataId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Master data record does not exist",
            {
              master_data_id: c.req.param("masterDataId"),
            },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/master-data/:masterDataId",
        );
      }
    },
  );

  app.post(
    "/api/v1/platform/master-data",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const masterDataId = normalizeRequiredText(
          body.master_data_id || body.id || body.code,
        ).toUpperCase();
        const objectName = normalizeRequiredText(
          body.object_name || body.object || body.name,
        );
        const objectType = normalizeRequiredText(
          body.object_type || body.type,
        );
        const sourceType = normalizeRequiredText(
          body.source_type || body.source,
        );
        const governanceStatus = normalizeRequiredText(
          body.governance_status || body.status || "active",
        );
        const primaryKeyRule = normalizeRequiredText(
          body.primary_key_rule || body.key_rule || body.keyRule,
        );
        const ownerName = normalizeRequiredText(
          body.owner_name || body.owner,
        );
        const note = normalizeNullableText(body.note);

        if (
          !masterDataId ||
          !objectName ||
          !objectType ||
          !sourceType ||
          !governanceStatus ||
          !primaryKeyRule ||
          !ownerName
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "master_data_id, object_name, object_type, source_type, governance_status, primary_key_rule and owner_name are required",
          );
        }

        const options = await loadPlatformMasterDataOptions(c.env.DB);
        if (!options.types.some((item) => item.value === objectType)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "object_type is invalid",
            { object_type: objectType },
          );
        }
        if (!options.sources.some((item) => item.value === sourceType)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "source_type is invalid",
            { source_type: sourceType },
          );
        }
        if (!options.statuses.some((item) => item.value === governanceStatus)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "governance_status is invalid",
            { governance_status: governanceStatus },
          );
        }

        const existing = (await c.env.DB.prepare(
          `
            SELECT master_data_id
            FROM platform_master_data
            WHERE UPPER(master_data_id) = ?
            LIMIT 1
          `,
        )
          .bind(masterDataId)
          .first()) as { master_data_id: string } | null;

        if (existing?.master_data_id) {
          return jsonError(
            c,
            409,
            "RESOURCE_EXISTS",
            "Master data record already exists",
            {
              master_data_id: masterDataId,
            },
          );
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
            INSERT INTO platform_master_data (
              master_data_id,
              object_name,
              object_type,
              source_type,
              governance_status,
              primary_key_rule,
              owner_name,
              note,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            masterDataId,
            objectName,
            objectType,
            sourceType,
            governanceStatus,
            primaryKeyRule,
            ownerName,
            note,
            now,
            now,
          )
          .run();

        await writePlatformMasterDataAudit(c, {
          action: "MASTER_DATA_CREATED",
          masterDataId,
          summary: `Created master data ${masterDataId}`,
          payload: {
            object_name: objectName,
            object_type: objectType,
            source_type: sourceType,
            governance_status: governanceStatus,
          },
        });

        const detail = await loadPlatformMasterDataDetailFromDb(
          c.env.DB,
          masterDataId,
        );
        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }

        return handleServiceError(c, error, "POST /platform/master-data");
      }
    },
  );

  app.patch(
    "/api/v1/platform/master-data/:masterDataId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const masterDataId = normalizeRequiredText(
          c.req.param("masterDataId"),
        ).toUpperCase();
        const body = await c.req.json();
        const existing = (await c.env.DB.prepare(
          `
            SELECT
              master_data_id,
              governance_status,
              deleted_at
            FROM platform_master_data
            WHERE UPPER(master_data_id) = ?
            LIMIT 1
          `,
        )
          .bind(masterDataId)
          .first()) as {
          master_data_id: string;
          governance_status: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Master data record does not exist",
            { master_data_id: masterDataId },
          );
        }

        const options = await loadPlatformMasterDataOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};
        const hasAny = (...keys: string[]) =>
          keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));

        const assign = (column: string, value: unknown, key = column) => {
          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (hasAny("object_name", "object", "name")) {
          const value = normalizeRequiredText(
            body.object_name || body.object || body.name,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "object_name cannot be empty",
            );
          }
          assign(
            "object_name",
            value,
            body.object_name ? "object_name" : body.object ? "object" : "name",
          );
        }

        if (hasAny("object_type", "type")) {
          const value = normalizeRequiredText(body.object_type || body.type);
          if (!options.types.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "object_type is invalid",
              { object_type: value },
            );
          }
          assign(
            "object_type",
            value,
            body.object_type ? "object_type" : "type",
          );
        }

        if (hasAny("source_type", "source")) {
          const value = normalizeRequiredText(body.source_type || body.source);
          if (!options.sources.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "source_type is invalid",
              { source_type: value },
            );
          }
          assign(
            "source_type",
            value,
            body.source_type ? "source_type" : "source",
          );
        }

        if (hasAny("governance_status", "status")) {
          const value = normalizeRequiredText(
            body.governance_status || body.status,
          );
          if (!options.statuses.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "governance_status is invalid",
              { governance_status: value },
            );
          }
          assign(
            "governance_status",
            value,
            body.governance_status ? "governance_status" : "status",
          );
        }

        if (hasAny("primary_key_rule", "key_rule", "keyRule")) {
          const value = normalizeRequiredText(
            body.primary_key_rule || body.key_rule || body.keyRule,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "primary_key_rule cannot be empty",
            );
          }
          assign(
            "primary_key_rule",
            value,
            body.primary_key_rule
              ? "primary_key_rule"
              : body.key_rule
                ? "key_rule"
                : "keyRule",
          );
        }

        if (hasAny("owner_name", "owner")) {
          const value = normalizeRequiredText(body.owner_name || body.owner);
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "owner_name cannot be empty",
            );
          }
          assign(
            "owner_name",
            value,
            body.owner_name ? "owner_name" : "owner",
          );
        }

        if (hasAny("note")) {
          assign("note", normalizeNullableText(body.note));
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          assign(
            "deleted_at",
            archived ? new Date().toISOString() : null,
            "archived",
          );

          if (archived) {
            assign("governance_status", "archived");
          } else if (!hasAny("governance_status", "status")) {
            assign(
              "governance_status",
              existing.governance_status === "archived"
                ? "active"
                : existing.governance_status,
            );
          }
        }

        if (!updates.length) {
          const detail = await loadPlatformMasterDataDetailFromDb(
            c.env.DB,
            masterDataId,
          );
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), masterDataId);
        await c.env.DB.prepare(
          `UPDATE platform_master_data SET ${updates.join(", ")} WHERE master_data_id = ?`,
        )
          .bind(...params)
          .run();

        const detail = await loadPlatformMasterDataDetailFromDb(
          c.env.DB,
          masterDataId,
        );
        await writePlatformMasterDataAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "MASTER_DATA_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "MASTER_DATA_ARCHIVED"
                : "MASTER_DATA_UPDATED",
          masterDataId,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored master data ${masterDataId}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived master data ${masterDataId}`
                : `Updated master data ${masterDataId}`,
          payload: auditPayload,
        });

        return c.json({ data: detail });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }

        return handleServiceError(
          c,
          error,
          "PATCH /platform/master-data/:masterDataId",
        );
      }
    },
  );

  app.delete(
    "/api/v1/platform/master-data/:masterDataId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const masterDataId = normalizeRequiredText(
          c.req.param("masterDataId"),
        ).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
            SELECT master_data_id, deleted_at
            FROM platform_master_data
            WHERE UPPER(master_data_id) = ?
            LIMIT 1
          `,
        )
          .bind(masterDataId)
          .first()) as {
          master_data_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Master data record does not exist",
            { master_data_id: masterDataId },
          );
        }

        if (!existing.deleted_at) {
          await c.env.DB.prepare(
            `
              UPDATE platform_master_data
              SET deleted_at = ?, governance_status = 'archived', updated_at = ?
              WHERE master_data_id = ?
            `,
          )
            .bind(
              new Date().toISOString(),
              new Date().toISOString(),
              masterDataId,
            )
            .run();
        }

        await writePlatformMasterDataAudit(c, {
          action: "MASTER_DATA_ARCHIVED",
          masterDataId,
          summary: `Archived master data ${masterDataId}`,
        });

        return c.json({
          data: {
            master_data_id: masterDataId,
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "DELETE /platform/master-data/:masterDataId",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const [masterDataPage, summaryDto] = await Promise.all([
          listPlatformMasterDataFromDb(c.env.DB, c.req.query()),
          loadPlatformMasterDataSummaryDto(c.env.DB),
        ]);

        return c.json({
          data: {
            masterDataRows: masterDataPage.items,
            masterDataPage,
            masterDataTypeSummaryRows: summaryDto.masterDataTypeSummaryRows,
            masterDataSourceSummaryRows: summaryDto.masterDataSourceSummaryRows,
            masterDataStatusSummaryRows: summaryDto.masterDataStatusSummaryRows,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/master-data");
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/sync/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformMasterDataSyncOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/master-data/sync/options",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/sync/:syncId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformMasterDataSyncDetailFromDb(
          c.env.DB,
          c.req.param("syncId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Sync config does not exist",
            { sync_id: c.req.param("syncId") },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/master-data/sync/:syncId",
        );
      }
    },
  );

  app.post(
    "/api/v1/platform/master-data/sync",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const syncId = normalizeRequiredText(
          body.sync_id || body.id || body.code,
        ).toUpperCase();
        const syncName = normalizeRequiredText(body.sync_name || body.name);
        const objectType = normalizeRequiredText(
          body.object_type || body.object,
        );
        const targetSystem = normalizeRequiredText(
          body.target_system || body.target,
        );
        const syncStatus = normalizeRequiredText(
          body.sync_status || body.status || "active",
        );
        const scheduleLabel = normalizeNullableText(
          body.schedule_label || body.schedule,
        );
        const lastRunAt = normalizeNullableText(
          body.last_run_at || body.lastRun,
        );
        const fallbackStrategy = normalizeRequiredText(
          body.fallback_strategy || body.fallback,
        );
        const primaryActionLabel = normalizeRequiredText(
          body.primary_action_label || body.primaryAction,
        );
        const fallbackActionLabel = normalizeRequiredText(
          body.fallback_action_label || body.fallbackAction,
        );
        const ownerName = normalizeRequiredText(
          body.owner_name || body.owner,
        );
        const note = normalizeNullableText(body.note);

        if (
          !syncId ||
          !syncName ||
          !objectType ||
          !targetSystem ||
          !syncStatus ||
          !fallbackStrategy ||
          !primaryActionLabel ||
          !fallbackActionLabel ||
          !ownerName
        ) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "sync_id, sync_name, object_type, target_system, sync_status, fallback_strategy, primary_action_label, fallback_action_label and owner_name are required",
          );
        }

        const options = await loadPlatformMasterDataSyncOptions(c.env.DB);
        if (!options.objects.some((item) => item.value === objectType)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "object_type is invalid",
            { object_type: objectType },
          );
        }
        if (!options.targets.some((item) => item.value === targetSystem)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "target_system is invalid",
            { target_system: targetSystem },
          );
        }
        if (!options.statuses.some((item) => item.value === syncStatus)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "sync_status is invalid",
            { sync_status: syncStatus },
          );
        }

        const existing = (await c.env.DB.prepare(
          `
            SELECT sync_id
            FROM platform_master_data_sync
            WHERE UPPER(sync_id) = ?
            LIMIT 1
          `,
        )
          .bind(syncId)
          .first()) as { sync_id: string } | null;

        if (existing?.sync_id) {
          return jsonError(
            c,
            409,
            "RESOURCE_EXISTS",
            "Sync config already exists",
            { sync_id: syncId },
          );
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
            INSERT INTO platform_master_data_sync (
              sync_id,
              sync_name,
              object_type,
              target_system,
              sync_status,
              schedule_label,
              last_run_at,
              fallback_strategy,
              primary_action_label,
              fallback_action_label,
              owner_name,
              note,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            syncId,
            syncName,
            objectType,
            targetSystem,
            syncStatus,
            scheduleLabel,
            lastRunAt,
            fallbackStrategy,
            primaryActionLabel,
            fallbackActionLabel,
            ownerName,
            note,
            now,
            now,
          )
          .run();

        await writePlatformMasterDataSyncAudit(c, {
          action: "MASTER_DATA_SYNC_CREATED",
          syncId,
          summary: `Created sync config ${syncId}`,
          payload: {
            object_type: objectType,
            target_system: targetSystem,
            sync_status: syncStatus,
          },
        });

        const detail = await loadPlatformMasterDataSyncDetailFromDb(
          c.env.DB,
          syncId,
        );
        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }

        return handleServiceError(c, error, "POST /platform/master-data/sync");
      }
    },
  );

  app.patch(
    "/api/v1/platform/master-data/sync/:syncId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const syncId = normalizeRequiredText(c.req.param("syncId")).toUpperCase();
        const body = await c.req.json();
        const existing = (await c.env.DB.prepare(
          `
            SELECT sync_id, sync_status, deleted_at
            FROM platform_master_data_sync
            WHERE UPPER(sync_id) = ?
            LIMIT 1
          `,
        )
          .bind(syncId)
          .first()) as {
          sync_id: string;
          sync_status: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Sync config does not exist",
            { sync_id: syncId },
          );
        }

        const options = await loadPlatformMasterDataSyncOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};
        const hasAny = (...keys: string[]) =>
          keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));

        const assign = (column: string, value: unknown, key = column) => {
          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (hasAny("sync_name", "name")) {
          const value = normalizeRequiredText(body.sync_name || body.name);
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "sync_name cannot be empty",
            );
          }
          assign("sync_name", value, body.sync_name ? "sync_name" : "name");
        }

        if (hasAny("object_type", "object")) {
          const value = normalizeRequiredText(
            body.object_type || body.object,
          );
          if (!options.objects.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "object_type is invalid",
              { object_type: value },
            );
          }
          assign(
            "object_type",
            value,
            body.object_type ? "object_type" : "object",
          );
        }

        if (hasAny("target_system", "target")) {
          const value = normalizeRequiredText(
            body.target_system || body.target,
          );
          if (!options.targets.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "target_system is invalid",
              { target_system: value },
            );
          }
          assign(
            "target_system",
            value,
            body.target_system ? "target_system" : "target",
          );
        }

        if (hasAny("sync_status", "status")) {
          const value = normalizeRequiredText(body.sync_status || body.status);
          if (!options.statuses.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "sync_status is invalid",
              { sync_status: value },
            );
          }
          assign(
            "sync_status",
            value,
            body.sync_status ? "sync_status" : "status",
          );
        }

        if (hasAny("schedule_label", "schedule")) {
          assign(
            "schedule_label",
            normalizeNullableText(body.schedule_label || body.schedule),
            body.schedule_label ? "schedule_label" : "schedule",
          );
        }

        if (hasAny("last_run_at", "lastRun")) {
          assign(
            "last_run_at",
            normalizeNullableText(body.last_run_at || body.lastRun),
            body.last_run_at ? "last_run_at" : "lastRun",
          );
        }

        if (hasAny("fallback_strategy", "fallback")) {
          const value = normalizeRequiredText(
            body.fallback_strategy || body.fallback,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "fallback_strategy cannot be empty",
            );
          }
          assign(
            "fallback_strategy",
            value,
            body.fallback_strategy ? "fallback_strategy" : "fallback",
          );
        }

        if (hasAny("primary_action_label", "primaryAction")) {
          const value = normalizeRequiredText(
            body.primary_action_label || body.primaryAction,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "primary_action_label cannot be empty",
            );
          }
          assign(
            "primary_action_label",
            value,
            body.primary_action_label
              ? "primary_action_label"
              : "primaryAction",
          );
        }

        if (hasAny("fallback_action_label", "fallbackAction")) {
          const value = normalizeRequiredText(
            body.fallback_action_label || body.fallbackAction,
          );
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "fallback_action_label cannot be empty",
            );
          }
          assign(
            "fallback_action_label",
            value,
            body.fallback_action_label
              ? "fallback_action_label"
              : "fallbackAction",
          );
        }

        if (hasAny("owner_name", "owner")) {
          const value = normalizeRequiredText(body.owner_name || body.owner);
          if (!value) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "owner_name cannot be empty",
            );
          }
          assign(
            "owner_name",
            value,
            body.owner_name ? "owner_name" : "owner",
          );
        }

        if (hasAny("note")) {
          assign("note", normalizeNullableText(body.note));
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          assign("deleted_at", archived ? new Date().toISOString() : null, "archived");

          if (archived) {
            assign("sync_status", "archived");
          } else if (!hasAny("sync_status", "status")) {
            assign(
              "sync_status",
              existing.sync_status === "archived"
                ? "active"
                : existing.sync_status,
            );
          }
        }

        if (!updates.length) {
          const detail = await loadPlatformMasterDataSyncDetailFromDb(
            c.env.DB,
            syncId,
          );
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), syncId);
        await c.env.DB.prepare(
          `UPDATE platform_master_data_sync SET ${updates.join(", ")} WHERE sync_id = ?`,
        )
          .bind(...params)
          .run();

        const detail = await loadPlatformMasterDataSyncDetailFromDb(
          c.env.DB,
          syncId,
        );
        await writePlatformMasterDataSyncAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "MASTER_DATA_SYNC_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "MASTER_DATA_SYNC_ARCHIVED"
                : "MASTER_DATA_SYNC_UPDATED",
          syncId,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored sync config ${syncId}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived sync config ${syncId}`
                : `Updated sync config ${syncId}`,
          payload: auditPayload,
        });

        return c.json({ data: detail });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }

        return handleServiceError(
          c,
          error,
          "PATCH /platform/master-data/sync/:syncId",
        );
      }
    },
  );

  app.delete(
    "/api/v1/platform/master-data/sync/:syncId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const syncId = normalizeRequiredText(c.req.param("syncId")).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
            SELECT sync_id, deleted_at
            FROM platform_master_data_sync
            WHERE UPPER(sync_id) = ?
            LIMIT 1
          `,
        )
          .bind(syncId)
          .first()) as {
          sync_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Sync config does not exist",
            { sync_id: syncId },
          );
        }

        if (!existing.deleted_at) {
          await c.env.DB.prepare(
            `
              UPDATE platform_master_data_sync
              SET deleted_at = ?, sync_status = 'archived', updated_at = ?
              WHERE sync_id = ?
            `,
          )
            .bind(new Date().toISOString(), new Date().toISOString(), syncId)
            .run();
        }

        await writePlatformMasterDataSyncAudit(c, {
          action: "MASTER_DATA_SYNC_ARCHIVED",
          syncId,
          summary: `Archived sync config ${syncId}`,
        });

        return c.json({
          data: {
            sync_id: syncId,
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "DELETE /platform/master-data/sync/:syncId",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/jobs/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformMasterDataJobOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/master-data/jobs/options",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/jobs/:jobId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformMasterDataJobDetailFromDb(
          c.env.DB,
          c.req.param("jobId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Job does not exist",
            { job_id: c.req.param("jobId") },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/master-data/jobs/:jobId",
        );
      }
    },
  );

  app.post(
    "/api/v1/platform/master-data/jobs/:jobId/retry",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const jobId = normalizeRequiredText(c.req.param("jobId")).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
            SELECT job_id, job_status, archived_at, retry_count
            FROM platform_master_data_jobs
            WHERE UPPER(job_id) = ?
            LIMIT 1
          `,
        )
          .bind(jobId)
          .first()) as {
          job_id: string;
          job_status: string;
          archived_at: string | null;
          retry_count: number;
        } | null;

        if (!existing) {
          return jsonError(c, 404, "RESOURCE_NOT_FOUND", "Job does not exist", {
            job_id: jobId,
          });
        }

        if (existing.archived_at || existing.job_status === "archived") {
          return jsonError(
            c,
            409,
            "INVALID_STATE",
            "Archived job should use replay instead of retry",
            { job_id: jobId },
          );
        }

        if (
          existing.job_status !== "failed" &&
          existing.job_status !== "partial"
        ) {
          return jsonError(
            c,
            409,
            "INVALID_STATE",
            "Only failed or partial jobs can be retried",
            { job_id: jobId, job_status: existing.job_status },
          );
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
            UPDATE platform_master_data_jobs
            SET retry_count = retry_count + 1,
                job_status = 'queued',
                processed_at = NULL,
                archived_at = NULL,
                updated_at = ?
            WHERE job_id = ?
          `,
        )
          .bind(now, jobId)
          .run();

        await writePlatformMasterDataJobAudit(c, {
          action: "MASTER_DATA_JOB_RETRIED",
          jobId,
          summary: `Retried job ${jobId}`,
          payload: {
            previous_status: existing.job_status,
            retry_count: Number(existing.retry_count || 0) + 1,
          },
        });

        const detail = await loadPlatformMasterDataJobDetailFromDb(
          c.env.DB,
          jobId,
        );
        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /platform/master-data/jobs/:jobId/retry",
        );
      }
    },
  );

  app.post(
    "/api/v1/platform/master-data/jobs/:jobId/replay",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const jobId = normalizeRequiredText(c.req.param("jobId")).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
            SELECT job_id, job_status, archived_at, replay_count
            FROM platform_master_data_jobs
            WHERE UPPER(job_id) = ?
            LIMIT 1
          `,
        )
          .bind(jobId)
          .first()) as {
          job_id: string;
          job_status: string;
          archived_at: string | null;
          replay_count: number;
        } | null;

        if (!existing) {
          return jsonError(c, 404, "RESOURCE_NOT_FOUND", "Job does not exist", {
            job_id: jobId,
          });
        }

        if (existing.job_status === "running") {
          return jsonError(
            c,
            409,
            "INVALID_STATE",
            "Running job cannot be replayed",
            { job_id: jobId },
          );
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
            UPDATE platform_master_data_jobs
            SET replay_count = replay_count + 1,
                job_status = 'queued',
                processed_at = NULL,
                archived_at = NULL,
                updated_at = ?
            WHERE job_id = ?
          `,
        )
          .bind(now, jobId)
          .run();

        await writePlatformMasterDataJobAudit(c, {
          action: "MASTER_DATA_JOB_REPLAYED",
          jobId,
          summary: `Replayed job ${jobId}`,
          payload: {
            previous_status: existing.job_status,
            replay_count: Number(existing.replay_count || 0) + 1,
          },
        });

        const detail = await loadPlatformMasterDataJobDetailFromDb(
          c.env.DB,
          jobId,
        );
        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /platform/master-data/jobs/:jobId/replay",
        );
      }
    },
  );

  app.post(
    "/api/v1/platform/master-data/jobs/:jobId/archive",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const jobId = normalizeRequiredText(c.req.param("jobId")).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `
            SELECT job_id, job_status, archived_at
            FROM platform_master_data_jobs
            WHERE UPPER(job_id) = ?
            LIMIT 1
          `,
        )
          .bind(jobId)
          .first()) as {
          job_id: string;
          job_status: string;
          archived_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(c, 404, "RESOURCE_NOT_FOUND", "Job does not exist", {
            job_id: jobId,
          });
        }

        if (!existing.archived_at) {
          await c.env.DB.prepare(
            `
              UPDATE platform_master_data_jobs
              SET archived_at = ?, job_status = 'archived', updated_at = ?
              WHERE job_id = ?
            `,
          )
            .bind(new Date().toISOString(), new Date().toISOString(), jobId)
            .run();
        }

        await writePlatformMasterDataJobAudit(c, {
          action: "MASTER_DATA_JOB_ARCHIVED",
          jobId,
          summary: `Archived job ${jobId}`,
        });

        const detail = await loadPlatformMasterDataJobDetailFromDb(
          c.env.DB,
          jobId,
        );
        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /platform/master-data/jobs/:jobId/archive",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/relationships/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformMasterDataRelationshipOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/master-data/relationships/options",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/master-data/relationships/:relationshipId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformMasterDataRelationshipDetailFromDb(
          c.env.DB,
          c.req.param("relationshipId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Relationship does not exist",
            { relationship_id: c.req.param("relationshipId") },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/master-data/relationships/:relationshipId",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/reports",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const stationId = c.req.query("station_id") || undefined;
        const date = c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const reportDate = normalizeDailyReportDate(date);
        const payload = await loadPlatformReportsDaily(
          c.env.DB,
          reportDate,
          stationId,
        );

        return c.json({ data: payload });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/reports");
      }
    },
  );

  app.get(
    "/api/v1/platform/reports/daily",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const stationId = c.req.query("station_id") || undefined;
        const date = c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const reportDate = normalizeDailyReportDate(date);
        const overview = await loadPlatformReportsDaily(
          c.env.DB,
          reportDate,
          stationId,
        );

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/reports/daily");
      }
    },
  );

  app.get(
    "/api/v1/platform/data-quality/rules",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const stationId =
          c.req.query("station_id") || c.var.actor.stationScope?.[0] || "MME";
        const rules = await loadStationDataQualityRules(c.env.DB, stationId);
        return c.json({
          data: {
            station_id: stationId,
            items: rules,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/data-quality/rules");
      }
    },
  );

  app.post(
    "/api/v1/platform/data-quality/stations/:stationId/evaluate",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const stationId = c.req.param("stationId");
        const input = await c.req.json().catch(() => ({}));
        const date = input.date || c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const issueDate = normalizeDailyReportDate(date);
        const overview = await evaluateStationDataQuality(
          c.env.DB,
          stationId,
          issueDate,
        );

        return c.json({
          data: {
            ...overview,
            evaluated_at: new Date().toISOString(),
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /platform/data-quality/stations/:stationId/evaluate",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/data-quality/stations/:stationId/overview",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const date = c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const issueDate = normalizeDailyReportDate(date);
        const overview = await loadStationDataQualityOverview(
          c.env.DB,
          c.req.param("stationId"),
          issueDate,
        );
        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/data-quality/stations/:stationId/overview",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/data-quality/stations/:stationId/issues",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const date = c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const issueDate = normalizeDailyReportDate(date);
        const items = await loadStationDataQualityIssues(
          c.env.DB,
          c.req.param("stationId"),
          issueDate,
          {
            severity: c.req.query("severity") || undefined,
            status: c.req.query("status") || undefined,
          },
        );

        return c.json({
          data: {
            station_id: c.req.param("stationId"),
            issue_date: issueDate,
            items,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/data-quality/stations/:stationId/issues",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/data-quality/stations/:stationId/checklist",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const date = c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const issueDate = normalizeDailyReportDate(date);
        const overview = await loadStationDataQualityOverview(
          c.env.DB,
          c.req.param("stationId"),
          issueDate,
        );
        return c.json({
          data: {
            station_id: c.req.param("stationId"),
            issue_date: issueDate,
            quality_checklist: overview.quality_checklist,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /platform/data-quality/stations/:stationId/checklist",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/zones/options",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        return c.json({
          data: await loadPlatformZoneOptions(c.env.DB),
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/zones/options");
      }
    },
  );

  app.get(
    "/api/v1/platform/zones/:zoneId",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const detail = await loadPlatformZoneDetailFromDb(
          c.env.DB,
          c.req.param("zoneId"),
        );

        if (!detail) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Zone does not exist",
            {
              zone_id: c.req.param("zoneId"),
            },
          );
        }

        return c.json({ data: detail });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/zones/:zoneId");
      }
    },
  );

  app.post(
    "/api/v1/platform/zones",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const body = await c.req.json();
        const zoneId = normalizeRequiredText(
          body.zone_id || body.code || body.zone,
        ).toUpperCase();
        const stationId = normalizeStationCode(
          body.station_id || body.station_code || body.station,
        );
        const zoneType = normalizeRequiredText(body.zone_type || body.type);
        const linkedLane = normalizeNullableText(
          body.linked_lane || body.linkedLane,
        );
        const zoneStatus = normalizeRequiredText(
          body.zone_status || body.status || "active",
        );
        const note = normalizeNullableText(body.note);

        if (!zoneId || !stationId || !zoneType || !zoneStatus) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "zone_id, station_id, zone_type and zone_status are required",
          );
        }

        const options = await loadPlatformZoneOptions(c.env.DB);
        if (!options.stations.some((item) => item.value === stationId)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "station_id is invalid",
            { station_id: stationId },
          );
        }
        if (!options.types.some((item) => item.value === zoneType)) {
          return jsonError(c, 400, "VALIDATION_ERROR", "zone_type is invalid", {
            zone_type: zoneType,
          });
        }
        if (!options.statuses.some((item) => item.value === zoneStatus)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "zone_status is invalid",
            { zone_status: zoneStatus },
          );
        }

        const existing = (await c.env.DB.prepare(
          `SELECT zone_id FROM zones WHERE zone_id = ? LIMIT 1`,
        )
          .bind(zoneId)
          .first()) as { zone_id: string } | null;
        if (existing?.zone_id) {
          return jsonError(c, 409, "RESOURCE_EXISTS", "Zone already exists", {
            zone_id: zoneId,
          });
        }

        const now = new Date().toISOString();
        await c.env.DB.prepare(
          `
            INSERT INTO zones (
              zone_id,
              station_id,
              zone_type,
              linked_lane,
              zone_status,
              note,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            zoneId,
            stationId,
            zoneType,
            linkedLane,
            zoneStatus,
            note,
            now,
            now,
          )
          .run();

        await writePlatformZoneAudit(c, {
          action: "ZONE_CREATED",
          zoneId,
          stationId,
          summary: `Created zone ${zoneId}`,
          payload: {
            station_id: stationId,
            zone_type: zoneType,
            zone_status: zoneStatus,
            linked_lane: linkedLane,
          },
        });

        const detail = await loadPlatformZoneDetailFromDb(c.env.DB, zoneId);
        return c.json({ data: detail }, 201);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "POST /platform/zones");
      }
    },
  );

  app.patch(
    "/api/v1/platform/zones/:zoneId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const zoneId = normalizeRequiredText(
          c.req.param("zoneId"),
        ).toUpperCase();
        const body = await c.req.json();
        const existing = (await c.env.DB.prepare(
          `SELECT zone_id, station_id, deleted_at FROM zones WHERE zone_id = ? LIMIT 1`,
        )
          .bind(zoneId)
          .first()) as {
          zone_id: string;
          station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Zone does not exist",
            { zone_id: zoneId },
          );
        }

        const options = await loadPlatformZoneOptions(c.env.DB);
        const updates: string[] = [];
        const params: unknown[] = [];
        const auditPayload: Record<string, unknown> = {};

        const assign = (column: string, value: unknown, key = column) => {
          updates.push(`${column} = ?`);
          params.push(value);
          auditPayload[key] = value;
        };

        if (
          Object.prototype.hasOwnProperty.call(body, "station_id") ||
          Object.prototype.hasOwnProperty.call(body, "station_code") ||
          Object.prototype.hasOwnProperty.call(body, "station")
        ) {
          const value = normalizeStationCode(
            body.station_id || body.station_code || body.station,
          );
          if (!options.stations.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "station_id is invalid",
              { station_id: value },
            );
          }
          assign(
            "station_id",
            value,
            body.station_id
              ? "station_id"
              : body.station_code
                ? "station_code"
                : "station",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "zone_type") ||
          Object.prototype.hasOwnProperty.call(body, "type")
        ) {
          const value = normalizeRequiredText(body.zone_type || body.type);
          if (!options.types.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "zone_type is invalid",
              { zone_type: value },
            );
          }
          assign("zone_type", value, body.zone_type ? "zone_type" : "type");
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "linked_lane") ||
          Object.prototype.hasOwnProperty.call(body, "linkedLane")
        ) {
          assign(
            "linked_lane",
            normalizeNullableText(body.linked_lane || body.linkedLane),
            body.linked_lane ? "linked_lane" : "linkedLane",
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "zone_status") ||
          Object.prototype.hasOwnProperty.call(body, "status")
        ) {
          const value = normalizeRequiredText(body.zone_status || body.status);
          if (!options.statuses.some((item) => item.value === value)) {
            return jsonError(
              c,
              400,
              "VALIDATION_ERROR",
              "zone_status is invalid",
              { zone_status: value },
            );
          }
          assign(
            "zone_status",
            value,
            body.zone_status ? "zone_status" : "status",
          );
        }

        if (Object.prototype.hasOwnProperty.call(body, "note")) {
          assign("note", normalizeNullableText(body.note));
        }

        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          const archived = Boolean(body.archived);
          assign(
            "deleted_at",
            archived ? new Date().toISOString() : null,
            "archived",
          );
          if (archived) {
            assign("zone_status", "archived");
          } else if (
            !Object.prototype.hasOwnProperty.call(body, "zone_status") &&
            !Object.prototype.hasOwnProperty.call(body, "status")
          ) {
            assign("zone_status", "active");
          }
        }

        if (!updates.length) {
          const detail = await loadPlatformZoneDetailFromDb(c.env.DB, zoneId);
          return c.json({ data: detail });
        }

        updates.push("updated_at = ?");
        params.push(new Date().toISOString(), zoneId);
        await c.env.DB.prepare(
          `UPDATE zones SET ${updates.join(", ")} WHERE zone_id = ?`,
        )
          .bind(...params)
          .run();

        const refreshed = await loadPlatformZoneDetailFromDb(c.env.DB, zoneId);
        await writePlatformZoneAudit(c, {
          action:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? "ZONE_RESTORED"
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? "ZONE_ARCHIVED"
                : "ZONE_UPDATED",
          zoneId,
          stationId: refreshed?.zone?.station_id || existing.station_id,
          summary:
            Object.prototype.hasOwnProperty.call(body, "archived") &&
            !Boolean(body.archived)
              ? `Restored zone ${zoneId}`
              : Object.prototype.hasOwnProperty.call(body, "archived") &&
                  Boolean(body.archived)
                ? `Archived zone ${zoneId}`
                : `Updated zone ${zoneId}`,
          payload: auditPayload,
        });

        return c.json({ data: refreshed });
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "request body must be valid JSON",
          );
        }
        return handleServiceError(c, error, "PATCH /platform/zones/:zoneId");
      }
    },
  );

  app.delete(
    "/api/v1/platform/zones/:zoneId",
    requireRoles(["platform_admin"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const zoneId = normalizeRequiredText(
          c.req.param("zoneId"),
        ).toUpperCase();
        const existing = (await c.env.DB.prepare(
          `SELECT zone_id, station_id, deleted_at FROM zones WHERE zone_id = ? LIMIT 1`,
        )
          .bind(zoneId)
          .first()) as {
          zone_id: string;
          station_id: string;
          deleted_at: string | null;
        } | null;

        if (!existing) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Zone does not exist",
            { zone_id: zoneId },
          );
        }

        if (!existing.deleted_at) {
          await c.env.DB.prepare(
            `UPDATE zones SET deleted_at = ?, zone_status = 'archived', updated_at = ? WHERE zone_id = ?`,
          )
            .bind(new Date().toISOString(), new Date().toISOString(), zoneId)
            .run();
        }

        await writePlatformZoneAudit(c, {
          action: "ZONE_ARCHIVED",
          zoneId,
          stationId: existing.station_id,
          summary: `Archived zone ${zoneId}`,
        });

        return c.json({
          data: {
            zone_id: zoneId,
            archived: true,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "DELETE /platform/zones/:zoneId");
      }
    },
  );

  app.get(
    "/api/v1/platform/zones",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        if (!c.env.DB) {
          return jsonError(
            c,
            500,
            "DB_NOT_AVAILABLE",
            "Database binding is required",
          );
        }

        const zonePage = await listPlatformZonesFromDb(c.env.DB, c.req.query());
        return c.json({
          data: {
            zoneRows: zonePage.items,
            zonePage,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/zones");
      }
    },
  );

  app.get(
    "/api/v1/platform/audit/object",
    requireRoles([
      "platform_admin",
      "station_supervisor",
      "document_desk",
      "check_worker",
      "delivery_desk",
      "inbound_operator",
    ]),
    async (c) => {
      try {
        const objectType = String(c.req.query("object_type") || "");
        const objectKey = c.req.query("object_key") || undefined;
        const objectId = c.req.query("object_id") || undefined;

        if (!objectType || (!objectKey && !objectId)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "object_type and object_key/object_id are required",
          );
        }

        const scope = await resolveAuditScope(
          c.env.DB,
          objectType,
          objectKey,
          objectId,
        );
        const { whereClause, params } = buildAuditScopeSql(scope);

        if (!whereClause) {
          return c.json({
            data: {
              events: [],
              transitions: [],
            },
          });
        }

        const events = await c.env.DB?.prepare(
          `
              SELECT
                audit_id,
                actor_id,
                actor_role,
                client_source,
                action,
                object_type,
                object_id,
                station_id,
                summary,
                payload_json,
                created_at
              FROM audit_events
              WHERE ${whereClause}
              ORDER BY created_at DESC, audit_id DESC
              LIMIT 30
            `,
        )
          .bind(...params)
          .all();
        const transitions = await c.env.DB?.prepare(
          `
              SELECT
                transition_id,
                object_type,
                object_id,
                state_field,
                from_value,
                to_value,
                triggered_by,
                triggered_at,
                reason
              FROM state_transitions
              WHERE ${whereClause}
              ORDER BY triggered_at DESC, transition_id DESC
              LIMIT 30
            `,
        )
          .bind(...params)
          .all();

        return c.json({
          data: {
            events: (events?.results || []).map((item: any) => ({
              id: item.audit_id,
              time: item.created_at,
              actor: `${item.actor_id} / ${item.actor_role}`,
              action: item.action,
              object: `${item.object_type} / ${item.object_id}`,
              note: `${item.station_id} · ${item.summary} · ${item.client_source}`,
              payload: parseAuditPayload(item.payload_json),
            })),
            transitions: (transitions?.results || []).map((item: any) => ({
              id: item.transition_id,
              time: item.triggered_at,
              action: `${item.object_type}.${item.state_field}`,
              object: `${item.object_type} / ${item.object_id}`,
              before: item.from_value || "未设置",
              after: item.to_value,
              actor: item.triggered_by,
              note: item.reason || "",
            })),
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/audit/object");
      }
    },
  );

  app.get(
    "/api/v1/station/data-quality/overview",
    requireRoles(["station_supervisor", "document_desk", "check_worker"]),
    async (c) => {
      try {
        const date = c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const issueDate = normalizeDailyReportDate(date);
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const overview = await loadStationDataQualityOverview(
          c.env.DB,
          stationId,
          issueDate,
        );
        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/data-quality/overview",
        );
      }
    },
  );

  app.get(
    "/api/v1/station/data-quality/issues",
    requireRoles(["station_supervisor", "document_desk", "check_worker"]),
    async (c) => {
      try {
        const date = c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const issueDate = normalizeDailyReportDate(date);
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const items = await loadStationDataQualityIssues(
          c.env.DB,
          stationId,
          issueDate,
          {
            severity: c.req.query("severity") || undefined,
            status: c.req.query("status") || undefined,
          },
        );
        return c.json({
          data: {
            station_id: stationId,
            issue_date: issueDate,
            items,
          },
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/data-quality/issues");
      }
    },
  );

  app.get(
    "/api/v1/station/data-quality/checklist",
    requireRoles(["station_supervisor", "document_desk", "check_worker"]),
    async (c) => {
      try {
        const date = c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const issueDate = normalizeDailyReportDate(date);
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const overview = await loadStationDataQualityOverview(
          c.env.DB,
          stationId,
          issueDate,
        );
        return c.json({
          data: {
            station_id: stationId,
            issue_date: issueDate,
            quality_checklist: overview.quality_checklist,
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/data-quality/checklist",
        );
      }
    },
  );

  app.get(
    "/api/v1/platform/audit/events",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const rows = await c.env.DB?.prepare(
          `
            SELECT
              audit_id,
              CAST(COALESCE(actor_id, '') AS TEXT) AS actor_id,
              CAST(COALESCE(actor_role, '') AS TEXT) AS actor_role,
              CAST(COALESCE(client_source, '') AS TEXT) AS client_source,
              CAST(COALESCE(action, '') AS TEXT) AS action,
              CAST(COALESCE(object_type, '') AS TEXT) AS object_type,
              CAST(COALESCE(object_id, '') AS TEXT) AS object_id,
              CAST(COALESCE(station_id, '') AS TEXT) AS station_id,
              CAST(COALESCE(summary, '') AS TEXT) AS summary,
              CAST(COALESCE(payload_json, '') AS TEXT) AS payload_json,
              created_at
            FROM audit_events
            ORDER BY created_at DESC, audit_id DESC
            LIMIT 100
          `,
        ).all<{
          audit_id: string;
          actor_id: string;
          actor_role: string;
          client_source: string;
          action: string;
          object_type: string;
          object_id: string;
          station_id: string;
          summary: string;
          payload_json: string | null;
          created_at: string;
        }>();

        return c.json({
          items: (rows?.results || []).map((item) => ({
            id: item.audit_id,
            time: item.created_at,
            actor: `${item.actor_id} / ${item.actor_role}`,
            action: item.action,
            object: `${item.object_type} / ${item.object_id}`,
            result: "运行中",
            note: `${item.station_id} · ${item.summary} · ${item.client_source}`,
            payload: parseAuditPayload(item.payload_json),
          })),
          page: 1,
          page_size: 100,
          total: rows?.results?.length || 0,
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/audit/events");
      }
    },
  );

  app.get(
    "/api/v1/platform/audit/logs",
    requireRoles(["platform_admin", "station_supervisor", "document_desk"]),
    async (c) => {
      try {
        const rows = await c.env.DB?.prepare(
          `
            SELECT
              transition_id,
              object_type,
              object_id,
              state_field,
              from_value,
              to_value,
              triggered_by,
              triggered_at,
              reason
            FROM state_transitions
            ORDER BY triggered_at DESC, transition_id DESC
            LIMIT 100
          `,
        ).all<{
          transition_id: string;
          object_type: string;
          object_id: string;
          state_field: string;
          from_value: string | null;
          to_value: string;
          triggered_by: string;
          triggered_at: string;
          reason: string | null;
        }>();

        return c.json({
          items: (rows?.results || []).map((item) => ({
            id: item.transition_id,
            time: item.triggered_at,
            action: `${item.object_type}.${item.state_field}`,
            object: `${item.object_type} / ${item.object_id}`,
            before: item.from_value || "未设置",
            after: item.to_value,
            result: "运行中",
            actor: item.triggered_by,
            note: item.reason || "",
          })),
          page: 1,
          page_size: 100,
          total: rows?.results?.length || 0,
        });
      } catch (error) {
        return handleServiceError(c, error, "GET /platform/audit/logs");
      }
    },
  );

  app.get(
    "/api/v1/station/documents/:documentId/download",
    requireRoles([
      "station_supervisor",
      "document_desk",
      "check_worker",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const row = await c.env.DB?.prepare(
          `
            SELECT document_name, storage_key
            FROM documents
            WHERE document_id = ?
              AND deleted_at IS NULL
            LIMIT 1
          `,
        )
          .bind(c.req.param("documentId"))
          .first<{ document_name: string; storage_key: string }>();

        if (!row) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Document does not exist",
            {
              document_id: c.req.param("documentId"),
            },
          );
        }

        const object = await c.env.FILES?.get(row.storage_key);

        if (!object) {
          return jsonError(
            c,
            404,
            "RESOURCE_NOT_FOUND",
            "Document content does not exist in object storage",
            {
              document_id: c.req.param("documentId"),
              storage_key: row.storage_key,
            },
          );
        }

        return new Response(object.body, {
          headers: {
            "Content-Disposition": `attachment; filename="${row.document_name}"`,
            "Content-Type":
              object.httpMetadata?.contentType || "application/octet-stream",
          },
        });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/documents/:documentId/download",
        );
      }
    },
  );

  app.get(
    "/api/v1/station/tasks/options",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationTaskOptions(
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/tasks/options");
      }
    },
  );

  app.get(
    "/api/v1/station/tasks",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationTasks(
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, "GET /station/tasks");
      }
    },
  );

  app.get(
    "/api/v1/station/tasks/overview",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const overview = await loadStationTasksOverview(c.env.DB, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/tasks/overview");
      }
    },
  );

  app.post(
    "/api/v1/station/tasks/:taskId/assign",
    requireRoles(["station_supervisor"]),
    async (c) => {
      try {
        const input = await c.req.json();
        authorizeTaskAssignment(c.var.actor, input);
        const services = getStationServices(c);
        const result = await services.assignTask(c.req.param("taskId"), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/tasks/:taskId/assign",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/tasks/:taskId/verify",
    requireRoles(["station_supervisor", "check_worker"]),
    async (c) => {
      try {
        const input = await c.req.json().catch(() => ({}));
        const services = getStationServices(c);
        const result = await services.verifyTask(c.req.param("taskId"), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/tasks/:taskId/verify",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/tasks/:taskId/rework",
    requireRoles(["station_supervisor", "check_worker"]),
    async (c) => {
      try {
        const input = await c.req.json().catch(() => ({}));
        const services = getStationServices(c);
        const result = await services.reworkTask(c.req.param("taskId"), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/tasks/:taskId/rework",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/tasks/:taskId/escalate",
    requireRoles(["station_supervisor", "check_worker"]),
    async (c) => {
      try {
        const input = await c.req.json().catch(() => ({}));
        const services = getStationServices(c);
        const result = await services.escalateTask(
          c.req.param("taskId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/tasks/:taskId/escalate",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/tasks/:taskId/exception",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "mobile_operator",
    ]),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.raiseTaskException(
          c.req.param("taskId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/tasks/:taskId/exception",
        );
      }
    },
  );

  app.get(
    "/api/v1/station/tasks/:taskId",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getStationTask(c.req.param("taskId"));

        if (!result) {
          return jsonError(c, 404, "RESOURCE_NOT_FOUND", "Task does not exist", {
            task_id: c.req.param("taskId"),
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/tasks/:taskId");
      }
    },
  );

  app.patch(
    "/api/v1/station/tasks/:taskId",
    requireRoles(["station_supervisor", "check_worker"]),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.updateStationTask(
          c.req.param("taskId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "PATCH /station/tasks/:taskId");
      }
    },
  );

  app.delete(
    "/api/v1/station/tasks/:taskId",
    requireRoles(["station_supervisor", "check_worker"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.updateStationTask(
          c.req.param("taskId"),
          { archived: true },
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "DELETE /station/tasks/:taskId");
      }
    },
  );

  app.get(
    "/api/v1/station/exceptions",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationExceptions(
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, "GET /station/exceptions");
      }
    },
  );

  app.get(
    "/api/v1/station/exceptions/options",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationExceptionOptions(
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/exceptions/options");
      }
    },
  );

  app.get(
    "/api/v1/station/exceptions/overview",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await loadStationExceptionsOverview(
          services,
          normalizeStationListQuery(c.var.actor, c.req.query()),
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/exceptions/overview");
      }
    },
  );

  app.get(
    "/api/v1/station/exceptions/daily",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const stationId =
          c.var.actor.stationScope?.[0] || c.req.query("station_id") || "MME";
        const date = c.req.query("date");

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(
            c,
            400,
            "VALIDATION_ERROR",
            "date must be in YYYY-MM-DD format",
          );
        }

        const reportDate = normalizeDailyReportDate(date);
        const overview = await loadStationExceptionsDaily(
          c.env.DB,
          stationId,
          reportDate,
        );

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, "GET /station/exceptions/daily");
      }
    },
  );

  app.get(
    "/api/v1/station/exceptions/:exceptionId",
    requireRoles([
      "station_supervisor",
      "inbound_operator",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getStationException(
          c.req.param("exceptionId"),
        );

        if (!result) {
          return jsonError(
            c,
            404,
            "EXCEPTION_NOT_FOUND",
            "Exception does not exist",
            {
              exception_id: c.req.param("exceptionId"),
            },
          );
        }

        const hasGatePolicySummary =
          Boolean(
            (result as any).gate_policy_summary ||
            (result as any).gatePolicySummary,
          ) &&
          Boolean(
            (result as any).gate_policy_overview ||
            (result as any).gatePolicyOverview,
          );
        const payload = hasGatePolicySummary
          ? result
          : { ...result, ...buildStationExceptionGatePolicySummary(result) };

        return c.json({ data: payload });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "GET /station/exceptions/:exceptionId",
        );
      }
    },
  );

  app.patch(
    "/api/v1/station/exceptions/:exceptionId",
    requireRoles(["station_supervisor", "check_worker"]),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.updateStationException(
          c.req.param("exceptionId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "PATCH /station/exceptions/:exceptionId",
        );
      }
    },
  );

  app.delete(
    "/api/v1/station/exceptions/:exceptionId",
    requireRoles(["station_supervisor", "check_worker"]),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.updateStationException(
          c.req.param("exceptionId"),
          { archived: true },
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "DELETE /station/exceptions/:exceptionId",
        );
      }
    },
  );

  app.post(
    "/api/v1/station/exceptions/:exceptionId/resolve",
    requireRoles([
      "station_supervisor",
      "check_worker",
      "document_desk",
      "delivery_desk",
    ]),
    async (c) => {
      try {
        const input = await c.req.json().catch(() => ({}));
        const services = getStationServices(c);
        const result = await services.resolveStationException(
          c.req.param("exceptionId"),
          input,
        );
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(
          c,
          error,
          "POST /station/exceptions/:exceptionId/resolve",
        );
      }
    },
  );
}
