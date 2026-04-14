import type { MiddlewareHandler } from 'hono';
import { jsonError } from '../lib/http';
import type { RoleCode } from '@sinoport/contracts';
import type { StationServices } from '@sinoport/domain';
import { signAuthToken, verifyPasswordHash } from '@sinoport/auth';
import { handleServiceError } from '../lib/http';
import {
  assertStationAccess,
  authorizeTaskAssignment,
  normalizeDocumentInput,
  normalizeInboundFlightListQuery,
  normalizeStationListQuery
} from '../lib/policy';
import {
  loadDemoDatasetCatalog,
  loadDemoDatasetPayloads,
  loadDemoDatasetRecord,
  loadStablePlatformNetworkPayloads,
  loadStablePlatformReportsPayloads,
  loadStablePlatformRulesPayloads,
  loadStablePlatformStationsPayloads,
  loadStableStationReportsPayloads,
  loadStableStationResourcesPayloads,
  loadStationResourceVehicles,
  normalizeStationResourceVehiclePlan,
  saveStationResourceVehicles
} from '../lib/demo-datasets.js';
import {
  loadStationGovernanceSummary,
  loadStationGovernanceTemplate,
  loadStationGovernanceTemplates
} from '../lib/station-governance.js';
import { importInboundBundle, InboundBundleImportError } from '../lib/station-bundle-import.js';
import type { ApiApp } from '../index';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

type AuditScope = Map<string, Set<string>>;

const inboundFlightSourceOptions = ['MING PAO CANADA', 'MING PAO TORONTO'];

async function resolveKnownUserId(c: any, requestedUserId: string | undefined, fallbackUserId: string) {
  if (!c.env.DB) {
    return requestedUserId || fallbackUserId;
  }

  if (requestedUserId) {
    const existing = (await c.env.DB.prepare(`SELECT user_id FROM users WHERE user_id = ? LIMIT 1`)
      .bind(requestedUserId)
      .first()) as { user_id: string } | null;

    if (existing?.user_id) {
      return existing.user_id;
    }
  }

  const fallback = (await c.env.DB.prepare(`SELECT user_id FROM users WHERE user_id = ? LIMIT 1`)
    .bind(fallbackUserId)
    .first()) as { user_id: string } | null;

  return fallback?.user_id || fallbackUserId;
}

function addAuditObject(scope: AuditScope, objectType: string, objectId: string | null | undefined) {
  if (!objectId) return;

  if (!scope.has(objectType)) {
    scope.set(objectType, new Set());
  }

  scope.get(objectType)?.add(objectId);
}

async function resolveAuditScope(db: any, objectType: string, objectKey?: string, objectId?: string) {
  const scope: AuditScope = new Map();
  const lookup = objectId || objectKey;

  if (!lookup) {
    return scope;
  }

  if (objectType === 'Flight') {
    const flight = (await db
      .prepare(`SELECT flight_id FROM flights WHERE flight_id = ? OR flight_no = ? LIMIT 1`)
      .bind(lookup, lookup)
      .first()) as { flight_id: string } | null;

    addAuditObject(scope, 'Flight', flight?.flight_id);
  }

  if (objectType === 'AWB') {
    const awb = (await db
      .prepare(`SELECT awb_id, shipment_id, flight_id FROM awbs WHERE awb_id = ? OR awb_no = ? LIMIT 1`)
      .bind(lookup, lookup)
      .first()) as { awb_id: string; shipment_id: string | null; flight_id: string | null } | null;

    addAuditObject(scope, 'AWB', awb?.awb_id);
    addAuditObject(scope, 'Shipment', awb?.shipment_id);
    addAuditObject(scope, 'Flight', awb?.flight_id);
  }

  if (objectType === 'Shipment') {
    const shipmentLookup = lookup.startsWith('in-') || lookup.startsWith('out-') ? lookup.split('-').slice(1).join('-') : lookup;
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
          `
        )
        .bind(shipmentLookup, shipmentLookup)
        .first()) as { shipment_id: string } | null) || null;

    addAuditObject(scope, 'Shipment', shipment?.shipment_id);
  }

  if (objectType === 'Task') {
    const task = (await db
      .prepare(
        `
          SELECT task_id, related_object_type, related_object_id
          FROM tasks
          WHERE task_id = ?
          LIMIT 1
        `
      )
      .bind(lookup)
      .first()) as { task_id: string; related_object_type: string; related_object_id: string } | null;

    addAuditObject(scope, 'Task', task?.task_id);
    if (task?.related_object_type) {
      addAuditObject(scope, task.related_object_type, task.related_object_id);
    }
  }

  if (objectType === 'Exception') {
    const exception = (await db
      .prepare(
        `
          SELECT exception_id, related_object_type, related_object_id, linked_task_id
          FROM exceptions
          WHERE exception_id = ?
          LIMIT 1
        `
      )
      .bind(lookup)
      .first()) as { exception_id: string; related_object_type: string; related_object_id: string; linked_task_id: string | null } | null;

    addAuditObject(scope, 'Exception', exception?.exception_id);
    if (exception?.related_object_type) {
      addAuditObject(scope, exception.related_object_type, exception.related_object_id);
    }
    addAuditObject(scope, 'Task', exception?.linked_task_id);
  }

  if (objectType === 'Document') {
    const document = (await db
      .prepare(
        `
          SELECT document_id, related_object_type, related_object_id
          FROM documents
          WHERE document_id = ?
          LIMIT 1
        `
      )
      .bind(lookup)
      .first()) as { document_id: string; related_object_type: string; related_object_id: string } | null;

    addAuditObject(scope, 'Document', document?.document_id);
    if (document?.related_object_type) {
      addAuditObject(scope, document.related_object_type, document.related_object_id);
    }
  }

  const flightIds = Array.from(scope.get('Flight') || []);
  const awbIds = Array.from(scope.get('AWB') || []);
  const shipmentIds = Array.from(scope.get('Shipment') || []);
  const taskIds = Array.from(scope.get('Task') || []);

  if (flightIds.length || awbIds.length || shipmentIds.length) {
    const relatedClauses: string[] = [];
    const relatedParams: unknown[] = [];

    if (flightIds.length) {
      relatedClauses.push(`(related_object_type = 'Flight' AND related_object_id IN (${flightIds.map(() => '?').join(', ')}))`);
      relatedParams.push(...flightIds);
    }

    if (awbIds.length) {
      relatedClauses.push(`(related_object_type = 'AWB' AND related_object_id IN (${awbIds.map(() => '?').join(', ')}))`);
      relatedParams.push(...awbIds);
    }

    if (shipmentIds.length) {
      relatedClauses.push(`(related_object_type = 'Shipment' AND related_object_id IN (${shipmentIds.map(() => '?').join(', ')}))`);
      relatedParams.push(...shipmentIds);
    }

    if (relatedClauses.length) {
      const [documents, tasks, exceptions] = await Promise.all([
        db
          .prepare(`SELECT document_id FROM documents WHERE ${relatedClauses.join(' OR ')}`)
          .bind(...relatedParams)
          .all(),
        db
          .prepare(`SELECT task_id FROM tasks WHERE ${relatedClauses.join(' OR ')}`)
          .bind(...relatedParams)
          .all(),
        db
          .prepare(`SELECT exception_id FROM exceptions WHERE ${relatedClauses.join(' OR ')}`)
          .bind(...relatedParams)
          .all()
      ]);

      for (const row of documents?.results || []) addAuditObject(scope, 'Document', row.document_id);
      for (const row of tasks?.results || []) addAuditObject(scope, 'Task', row.task_id);
      for (const row of exceptions?.results || []) addAuditObject(scope, 'Exception', row.exception_id);
    }
  }

  const expandedTaskIds = Array.from(scope.get('Task') || []);
  if (expandedTaskIds.length) {
    const placeholders = expandedTaskIds.map(() => '?').join(', ');
    const [taskDocuments, taskExceptions] = await Promise.all([
      db
        .prepare(`SELECT document_id FROM documents WHERE related_object_type = 'Task' AND related_object_id IN (${placeholders})`)
        .bind(...expandedTaskIds)
        .all(),
      db
        .prepare(`SELECT exception_id FROM exceptions WHERE linked_task_id IN (${placeholders})`)
        .bind(...expandedTaskIds)
        .all()
    ]);

    for (const row of taskDocuments?.results || []) addAuditObject(scope, 'Document', row.document_id);
    for (const row of taskExceptions?.results || []) addAuditObject(scope, 'Exception', row.exception_id);
  }

  return scope;
}

function buildAuditScopeSql(scope: AuditScope) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const [objectType, ids] of scope.entries()) {
    const objectIds = Array.from(ids);
    if (!objectIds.length) continue;
    clauses.push(`(object_type = ? AND object_id IN (${objectIds.map(() => '?').join(', ')}))`);
    params.push(objectType, ...objectIds);
  }

  return {
    whereClause: clauses.join(' OR '),
    params
  };
}

async function loadStationResourcesOverview(db: any, stationId: string) {
  const [teamRows, payloads] = await Promise.all([
    db
      ? db
          .prepare(
            `
              SELECT team_id, station_id, team_name, owner_name, shift_code, team_status
              FROM teams
              WHERE station_id = ?
              ORDER BY created_at ASC, team_name ASC
            `
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as { team_id: string; station_id: string; team_name: string; owner_name: string | null; shift_code: string | null; team_status: string | null }[])
      : Promise.resolve([]),
    loadStableStationResourcesPayloads(db)
  ]);

  const demoTeams = toArray<ResourceTeamRow>(payloads['sinoport-adapters.resourceTeams']).filter((row) => belongsToStation(row, stationId));
  const fallbackTeams = toArray<ResourceTeamRow>(payloads['sinoport-adapters.platformStationTeamRows']).filter((row) => belongsToStation(row, stationId));
  const demoZones = toArray<ResourceZoneRow>(payloads['sinoport-adapters.resourceZones']).filter((row) => belongsToStation(row, stationId));
  const fallbackZones = toArray<ResourceZoneRow>(payloads['sinoport-adapters.platformStationZoneRows']).filter((row) => belongsToStation(row, stationId));
  const demoDevices = toArray<ResourceDeviceRow>(payloads['sinoport-adapters.resourceDevices']).filter((row) => belongsToStation(row, stationId));
  const fallbackDevices = toArray<ResourceDeviceRow>(payloads['sinoport-adapters.platformStationDeviceRows']).filter((row) => belongsToStation(row, stationId));

  const resourceTeams = teamRows.length
    ? teamRows.map(mapDbTeamRowToResourceTeam)
    : demoTeams.length
      ? demoTeams.map(mapResourceTeamRow)
      : fallbackTeams.map((row) => ({
          id: String(row.id || row.team || row.team_name || 'TEAM-UNKNOWN'),
          name: String(row.name || row.team || row.team_name || '未命名班组'),
          shift: String(row.shift || normalizeShiftLabel(row.shift_code)),
          owner: String(row.owner || row.mappedLanes || row.team || '未指定'),
          status: normalizeResourceStatus(row.status)
        }));

  const resourceZones = demoZones.length
    ? demoZones.map((row) => mapResourceZoneRow(row, stationId))
    : fallbackZones.map((row) => ({
        zone: String(row.zone || 'ZONE-UNKNOWN'),
        station: String(row.station || row.station_id || stationId),
        type: String(row.type || row.linkedLane || '未指定'),
        status: normalizeResourceStatus(row.status)
      }));

  const resourceDevices = demoDevices.length
    ? demoDevices.map((row) => mapResourceDeviceRow(row, stationId))
    : fallbackDevices.map((row) => ({
        code: String(row.code || row.device || 'DEVICE-UNKNOWN'),
        station: String(row.station || row.station_id || stationId),
        owner: String(row.owner || row.role || '未指定'),
        status: normalizeResourceStatus(row.status)
      }));

  return {
    resourceTeams,
    resourceZones,
    resourceDevices
  };
}

const COMPLETED_TASK_STATUSES = new Set(['Completed', 'Verified', 'Closed']);
const CLOSED_EXCEPTION_STATUSES = new Set(['Closed', 'Resolved', 'Done']);
const CONTROL_LEVEL_LABELS: Record<string, string> = {
  strong_control: '强控制',
  collaborative_control: '协同控制',
  interface_visible: '接口可视',
  weak_control: '弱控制'
};
const PHASE_LABELS: Record<string, string> = {
  sample_priority: '样板优先',
  active: '已上线',
  onboarding: '接入中',
  pending: '待处理'
};

const STATION_REPORT_APPROVED_DOCUMENT_STATUSES = new Set(['Approved', 'Accepted', 'Verified', 'Closed', 'Released', 'Uploaded', '运行中']);
const STATION_REPORT_ACTIVE_EXCEPTION_STATUSES = new Set(['Open', '待处理', '警戒', '阻塞']);
const STATION_REPORT_DONE_TASK_STATUSES = new Set(['Completed', 'Verified', 'Closed', 'Done', '已完成']);
const STATION_REPORT_LOADING_TASK_PATTERN = /(装车|装机|Loaded|Loading|Ramp|组板|发车|出港收货|尾程)/i;
const STATION_REPORT_POD_TASK_PATTERN = /(POD|交付|签收|Delivery|Closed)/i;

const STATION_REPORT_DEFAULT_CARDS = [
  { title: '12 小时完成率', value: '91%', helper: '按站内任务完成时长统计', chip: '12H', color: 'primary' },
  { title: '装车准确率', value: '98.2%', helper: '装车 / 机坪 / 转运任务复核一致率', chip: 'Loading', color: 'secondary' },
  { title: 'POD 闭环率', value: '86.4%', helper: '已签收并完成归档的比例', chip: 'POD', color: 'success' },
  { title: '异常闭环时长', value: '6.8h', helper: '异常从提出到恢复的平均耗时', chip: 'Recovery', color: 'warning' }
];

const STATION_REPORT_DEFAULT_SHIFT_ROWS = [
  { shift: 'URC 夜班', team: 'URC Export Team', completed: '14 / 16', loadingAccuracy: '98%', podClosure: 'N/A', exceptionAge: '2.1h' },
  { shift: 'MME 白班', team: 'MME Inbound Team A', completed: '11 / 13', loadingAccuracy: '97%', podClosure: '88%', exceptionAge: '4.3h' },
  { shift: 'MME 交付班', team: 'Destination Ops', completed: '9 / 10', loadingAccuracy: 'N/A', podClosure: '91%', exceptionAge: '1.7h' }
];

const STATION_REPORT_DEFAULT_PDA_ROWS = [
  { metric: '接单时长', current: '2m 18s', target: '<= 5m', note: '任务派发到接单确认的样例时长。' },
  { metric: '到场时长', current: '6m 42s', target: '<= 10m', note: '接单到到达作业点的样例时长。' },
  { metric: '任务完成时长', current: '18m 05s', target: '<= 25m', note: '开始到完成的样例时长。' },
  { metric: '证据上传完整率', current: '92%', target: '>= 95%', note: '需照片/签字/扫码的任务样例口径。' },
  { metric: '异常首次反馈时长', current: '4m 10s', target: '<= 8m', note: '发现异常到首次上报的样例时长。' }
];

const STATION_REPORT_DEFAULT_FILE_ROWS = [
  { report: '关键文件缺失', object: 'SE803 CBA / 436-10358585 POD', current: '2 条未满足放行条件', note: '对应 HG-01 与 HG-06。' },
  { report: '文件版本替换', object: 'SE913 Manifest', current: 'v2 生效 / v3 待发布', note: '用于演示替换、生效、回退。' },
  { report: '文件生效时间', object: 'SE913 FFM / UWS', current: '2026-04-08 17:55 / 18:02', note: '用于演示文件驱动状态放行。' },
  { report: '下载与预览审计', object: 'GOFONEW-020426-1 POD.pdf', current: '已预览 / 待归档', note: '当前只做前端动作记录。' }
];

function parseStationReportDate(value: unknown) {
  if (!value) return null;

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d{2}:\d{2}$/.test(text)) {
    const now = new Date();
    const [hours, minutes] = text.split(':').map(Number);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
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
  const taskType = String(item?.task_type || item?.title || item?.taskType || '任务').trim();
  const executionNode = String(item?.execution_node || item?.node || item?.executionNode || '').trim();
  const teamName = String(item?.team_name || item?.owner || item?.assigned_team_id || item?.assignedTeamId || item?.team || '未分配').trim();
  const shiftLabel = String(item?.shift_code || item?.shift || item?.team_shift || '').trim() || (teamName.includes('URC') ? '夜班' : '白班');
  const taskStatus = String(item?.task_status || item?.status || item?.taskStatus || '待处理').trim();

  return {
    taskId: String(item?.task_id || item?.id || '').trim(),
    taskType,
    executionNode,
    relatedObjectType: String(item?.related_object_type || item?.relatedObjectType || '').trim(),
    relatedObjectId: String(item?.related_object_id || item?.relatedObjectId || '').trim(),
    teamId: String(item?.assigned_team_id || item?.team_id || item?.owner || '').trim(),
    teamName,
    shiftLabel,
    taskStatus,
    blockerCode: String(item?.blocker_code || item?.blocker || '').trim(),
    evidenceRequired: Boolean(item?.evidence_required || item?.evidenceRequired),
    createdAt: item?.created_at || item?.createdAt || null,
    completedAt: item?.completed_at || item?.completedAt || item?.verified_at || item?.verifiedAt || null,
    updatedAt: item?.updated_at || item?.updatedAt || item?.completedAt || item?.verifiedAt || item?.createdAt || null,
    dueAt: item?.due_at || item?.dueAt || item?.due || null
  };
}

function normalizeStationReportExceptionRow(item: any) {
  return {
    exceptionId: String(item?.exception_id || item?.id || '').trim(),
    relatedObjectType: String(item?.related_object_type || item?.relatedObjectType || '').trim(),
    relatedObjectId: String(item?.related_object_id || item?.relatedObjectId || '').trim(),
    linkedTaskId: String(item?.linked_task_id || item?.linkedTaskId || '').trim(),
    severity: String(item?.severity || item?.sla || '').trim(),
    ownerTeamId: String(item?.owner_team_id || item?.ownerTeamId || '').trim(),
    exceptionStatus: String(item?.exception_status || item?.status || item?.exceptionStatus || 'Open').trim(),
    blockerFlag: Boolean(Number(item?.blocker_flag ?? item?.blockerFlag ?? 0)),
    rootCause: String(item?.root_cause || item?.rootCause || '').trim(),
    actionTaken: String(item?.action_taken || item?.actionTaken || '').trim(),
    exceptionType: String(item?.exception_type || item?.exceptionType || '').trim(),
    openedAt: item?.opened_at || item?.openedAt || null,
    closedAt: item?.closed_at || item?.closedAt || null
  };
}

function normalizeStationReportDocumentRow(item: any) {
  return {
    documentId: String(item?.document_id || item?.documentId || '').trim(),
    documentType: String(item?.document_type || item?.type || item?.documentType || '').trim(),
    documentName: String(item?.document_name || item?.name || item?.documentName || '').trim(),
    relatedObjectType: String(item?.related_object_type || item?.relatedObjectType || '').trim(),
    relatedObjectId: String(item?.related_object_id || item?.relatedObjectId || '').trim(),
    relatedObjectLabel: String(item?.related_object_label || item?.relatedObjectLabel || item?.linkedTo || item?.related_object_id || '').trim(),
    parentDocumentId: String(item?.parent_document_id || item?.parentDocumentId || '').trim(),
    versionNo: String(item?.version_no || item?.version || item?.versionNo || 'v1').trim(),
    documentStatus: String(item?.document_status || item?.status || item?.documentStatus || 'Pending').trim(),
    requiredForRelease: Boolean(item?.required_for_release || item?.requiredForRelease),
    uploadedAt: item?.uploaded_at || item?.uploadedAt || item?.updatedAt || null,
    updatedAt: item?.updated_at || item?.updatedAt || item?.uploadedAt || null,
    note: String(item?.note || '').trim()
  };
}

function inferStationDocumentPreviewType(documentName: string, contentType = '') {
  const lowerName = String(documentName || '').toLowerCase();
  const lowerContentType = String(contentType || '').toLowerCase();

  if (lowerName.endsWith('.pdf') || lowerContentType.includes('pdf')) return 'pdf';
  if (
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc') ||
    lowerContentType.includes('spreadsheet') ||
    lowerContentType.includes('wordprocessingml')
  ) {
    return 'office';
  }

  if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerContentType.startsWith('image/')) {
    return 'image';
  }

  return 'file';
}

function inferStationDocumentRoute(document: { relatedObjectType: string; relatedObjectLabel: string; relatedObjectId: string }) {
  if (document.relatedObjectType === 'Flight') {
    const flightNo = document.relatedObjectLabel?.split(' / ')[0] || document.relatedObjectId;
    return flightNo ? `/station/inbound/flights/${encodeURIComponent(flightNo)}` : '/station/inbound/flights';
  }

  if (document.relatedObjectType === 'AWB') {
    const awbNo = document.relatedObjectLabel?.split(' / ')[0] || document.relatedObjectId;
    return awbNo ? `/station/inbound/waybills/${encodeURIComponent(awbNo)}` : '/station/inbound/waybills';
  }

  if (document.relatedObjectType === 'Task') {
    return '/station/tasks';
  }

  if (document.relatedObjectType === 'Truck') {
    return '/station/resources/vehicles';
  }

  return '/station/shipments';
}

function formatStationDocumentTimestamp(value: string | null | undefined) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function parseStationDocumentVersion(versionNo: string) {
  const match = String(versionNo || '').match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function buildStationDocumentOverview(documentRows: any[], versionRows: any[], gateRows: any[], templateRows: any[]) {
  const rows = documentRows.map(normalizeStationReportDocumentRow).filter((item) => item.documentId);
  const historyRows = (versionRows.length ? versionRows : documentRows).map(normalizeStationReportDocumentRow).filter((item) => item.documentId);
  const rowById = new Map(rows.map((item) => [item.documentId, item] as const));
  const rootByDocumentId = new Map<string, string>();

  const resolveRootDocumentId = (item: ReturnType<typeof normalizeStationReportDocumentRow>) => {
    if (rootByDocumentId.has(item.documentId)) {
      return rootByDocumentId.get(item.documentId) as string;
    }

    const seen = new Set<string>();
    let current = item;

    while (current.parentDocumentId && rowById.has(current.parentDocumentId) && !seen.has(current.parentDocumentId)) {
      seen.add(current.documentId);
      current = rowById.get(current.parentDocumentId) as ReturnType<typeof normalizeStationReportDocumentRow>;
    }

    rootByDocumentId.set(item.documentId, current.documentId);
    return current.documentId;
  };

  const groupedRows = new Map<string, ReturnType<typeof normalizeStationReportDocumentRow>[]>();
  for (const item of rows) {
    const rootDocumentId = resolveRootDocumentId(item);
    if (!groupedRows.has(rootDocumentId)) {
      groupedRows.set(rootDocumentId, []);
    }
    groupedRows.get(rootDocumentId)?.push(item);
  }

  const versionGroups = new Map<string, ReturnType<typeof normalizeStationReportDocumentRow>[]>();
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
    id: String(item?.id || item?.gateEvaluationId || item?.gateId || '').trim(),
    gateId: String(item?.gateId || item?.gate_id || '').trim(),
    direction: String(item?.direction || '').trim(),
    node: String(item?.node || '').trim(),
    required: String(item?.required || '').trim(),
    impact: String(item?.impact || '').trim(),
    status: String(item?.status || '').trim(),
    blocker: String(item?.blockingReason || item?.blocker || '').trim(),
    recovery: String(item?.recoveryAction || item?.recovery || '').trim(),
    releaseRole: String(item?.releaseRole || '').trim(),
    linkedDocumentIds: Array.isArray(item?.linkedDocumentIds) ? item.linkedDocumentIds.map((value: unknown) => String(value).trim()).filter(Boolean) : []
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
        releaseRole: gateRow.releaseRole
      });
    }
  }

  for (const [rootDocumentId, groupRows] of groupedRows.entries()) {
    const groupDocumentIds = new Set(groupRows.map((item) => item.documentId));
    const gateItems = normalizedGateRows
      .filter((gateRow) => gateRow.linkedDocumentIds.some((documentId: string) => groupDocumentIds.has(documentId)))
      .map((gateRow) => ({
        gateId: gateRow.gateId,
        node: gateRow.node,
        required: gateRow.required,
        impact: gateRow.impact,
        status: gateRow.status,
        blocker: gateRow.blocker,
        recovery: gateRow.recovery,
        releaseRole: gateRow.releaseRole
      }));

    if (gateItems.length) {
      documentGateEvaluationsByDocumentId.set(rootDocumentId, gateItems);
      for (const documentId of groupDocumentIds) {
        documentGateEvaluationsByDocumentId.set(documentId, gateItems);
      }
    }
  }

  const buildVersionSummaries = (groupRows: ReturnType<typeof normalizeStationReportDocumentRow>[]) => {
    const sortedRows = [...groupRows].sort((left, right) => {
      const versionDelta = parseStationDocumentVersion(left.versionNo) - parseStationDocumentVersion(right.versionNo);
      if (versionDelta !== 0) return versionDelta;

      const leftTime = String(left.updatedAt || left.uploadedAt || '');
      const rightTime = String(right.updatedAt || right.uploadedAt || '');
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
        updatedAt: formatStationDocumentTimestamp(item.updatedAt || item.uploadedAt),
        diffSummary: previous
          ? `较 ${previous.versionNo} 版本继续更新 ${item.documentType || '文件'}`
          : '首版登记',
        previewSummary: item.note || `${item.documentType || 'Document'} ${item.versionNo} 版本摘要`,
        previewType: inferStationDocumentPreviewType(item.documentName),
        sortOrder: index + 1,
        rollbackTarget: previous?.documentId || null,
        replacedBy: next?.documentId || null
      };
    });
  };

  const stationDocuments = Array.from(groupedRows.entries())
    .map(([rootDocumentId, groupRows]) => {
      const versions = buildVersionSummaries(versionGroups.get(rootDocumentId) || groupRows);
      const activeVersion = [...versions]
        .reverse()
        .find((item) => item.status !== 'Replaced' && item.status !== '历史版本') || versions.at(-1);
      const activeSource = groupRows.find((item) => item.documentId === activeVersion?.versionId) || groupRows.at(-1) || groupRows[0];
      const gateIds = Array.from(
        new Set(
          (documentGateEvaluationsByDocumentId.get(rootDocumentId) || [])
            .map((item) => item.gateId)
            .filter(Boolean)
        )
      );

      return {
        documentId: rootDocumentId,
        type: activeSource?.documentType || '--',
        name: activeSource?.documentName || '--',
        linkedTo: activeSource?.relatedObjectLabel || activeSource?.relatedObjectId || '--',
        version: activeSource?.versionNo || '--',
        updatedAt: formatStationDocumentTimestamp(activeSource?.updatedAt || activeSource?.uploadedAt),
        status: activeSource?.documentStatus || 'Pending',
        activeVersionId: activeVersion?.versionId || activeSource?.documentId || rootDocumentId,
        previewType: inferStationDocumentPreviewType(activeSource?.documentName),
        nextStep: activeSource?.requiredForRelease ? '放行前校验' : '普通归档',
        gateIds,
        bindingTargets: [
          {
            label: `${activeSource?.relatedObjectType || 'Object'} / ${activeSource?.relatedObjectLabel || activeSource?.relatedObjectId || '--'}`,
            to: inferStationDocumentRoute(activeSource || { relatedObjectType: '', relatedObjectLabel: '', relatedObjectId: '' })
          }
        ]
      };
    })
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));

  const inboundDocumentGates = normalizedGateRows
    .filter((item) => item.direction === '进港')
    .slice(0, 3)
    .map((item) => ({
      gateId: item.gateId,
      node: item.node,
      required: item.required,
      impact: item.impact,
      status: item.status,
      blocker: item.blocker,
      recovery: item.recovery,
      releaseRole: item.releaseRole
    }));

  const outboundDocumentGates = normalizedGateRows
    .filter((item) => item.direction === '出港')
    .slice(0, 3)
    .map((item) => ({
      gateId: item.gateId,
      node: item.node,
      required: item.required,
      impact: item.impact,
      status: item.status,
      blocker: item.blocker,
      recovery: item.recovery,
      releaseRole: item.releaseRole
    }));

  const instructionTemplateRows = templateRows.map((item: any) => ({
    code: String(item?.code || item?.id || '').trim(),
    title: String(item?.title || item?.name || '').trim(),
    linkedNode: String(item?.linkedNode || item?.node || '').trim(),
    trigger: String(item?.trigger || '').trim(),
    evidence: String(item?.evidence || '').trim()
  }));

  const documentVersionsByDocumentId = Object.fromEntries(
    Array.from(groupedRows.entries()).map(([rootDocumentId, groupRows]) => [rootDocumentId, buildVersionSummaries(versionGroups.get(rootDocumentId) || groupRows)])
  );

  return {
    stationDocuments,
    documentVersionsByDocumentId,
    documentGateEvaluationsByDocumentId: Object.fromEntries(Array.from(documentGateEvaluationsByDocumentId.entries())),
    inboundDocumentGates,
    outboundDocumentGates,
    instructionTemplateRows
  };
}

function mapNoaStatusLabel(status: unknown) {
  const text = String(status || '').trim();
  if (text === 'Failed' || text === '发送失败') return '发送失败';
  if (text === 'Sent' || text === '已发送') return '已发送';
  return '待处理';
}

function mapNoaRetryLabel(status: unknown) {
  const text = String(status || '').trim();
  if (text === 'Failed' || text === '发送失败') return '可重试';
  if (text === 'Sent' || text === '已发送') return '无需';
  return '允许补发';
}

function mapPodStatusLabel(status: unknown) {
  const text = String(status || '').trim();
  if (text === 'Released' || text === '已归档' || text === 'Closed') return '已归档';
  if (text === 'Uploaded' || text === '已上传') return '已上传';
  if (isPendingInboundStatus(text)) return '待补签';
  if (text === '警戒' || text === '阻塞') return text;
  return text || '待补签';
}

function mapPodRetryLabel(status: unknown) {
  const text = String(status || '').trim();
  if (text === 'Released' || text === '已归档' || text === 'Closed') return '无需';
  if (text === 'Uploaded' || text === '已上传') return '允许人工补传';
  if (isPendingInboundStatus(text)) return '等待双签';
  return '允许人工补传';
}

function buildStationNoaOverview(noaRows: any[], gateRows: any[], policyRows: any[]) {
  const noaNotifications = noaRows.map((item, index) => {
    const awb = String(item?.awb || item?.awb_no || item?.awbNo || '').trim();
    const rawStatus = pickRowValue(item, ['noa_status', 'noaStatus', 'status']);
    const gateId = String(item?.gateId || item?.gate_id || 'HG-03').trim() || 'HG-03';

    return {
      id: String(item?.id || `NOA-${index + 1}`).trim() || `NOA-${index + 1}`,
      awbId: String(item?.awbId || item?.awb_id || '').trim(),
      awb,
      channel: String(item?.channel || 'Email').trim() || 'Email',
      target: String(item?.target || item?.consignee_name || '').trim() || '--',
      status: String(item?.status || mapNoaStatusLabel(rawStatus)).trim() || mapNoaStatusLabel(rawStatus),
      retry: String(item?.retry || mapNoaRetryLabel(rawStatus)).trim() || mapNoaRetryLabel(rawStatus),
      note: String(item?.note || item?.blocker_reason || '').trim() || '根据当前提单状态决定是否允许发送',
      gateId,
      objectTo: String(item?.objectTo || (awb ? `/station/inbound/waybills/${encodeURIComponent(awb)}` : '/station/inbound/waybills')).trim()
    };
  });

  const relevantGateIds = new Set(noaNotifications.map((item) => item.gateId).filter(Boolean));

  const normalizedGateRows = gateRows.map((item: any) => ({
    id: String(item?.id || item?.gateEvaluationId || item?.gateId || '').trim(),
    gateId: String(item?.gateId || item?.gate_id || '').trim(),
    node: String(item?.node || '').trim(),
    required: String(item?.required || '').trim(),
    impact: String(item?.impact || '').trim(),
    status: String(item?.status || '').trim(),
    blockingReason: String(item?.blockingReason || item?.blocker || '').trim(),
    recoveryAction: String(item?.recoveryAction || item?.recovery || '').trim(),
    releaseRole: String(item?.releaseRole || '').trim()
  }));

  const normalizedPolicyRows = policyRows.map((item: any) => ({
    id: String(item?.id || item?.gateId || '').trim(),
    rule: String(item?.rule || '').trim(),
    triggerNode: String(item?.triggerNode || '').trim(),
    affectedModule: String(item?.affectedModule || '').trim(),
    blocker: String(item?.blocker || '').trim(),
    recovery: String(item?.recovery || '').trim(),
    releaseRole: String(item?.releaseRole || '').trim()
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
    hardGatePolicyRows
  };
}

function buildStationPodOverview(podRows: any[], gateRows: any[], policyRows: any[]) {
  const podNotifications = podRows.map((item, index) => {
    const awb = String(item?.awb || item?.awb_no || item?.awbNo || '').trim();
    const rawStatus = pickRowValue(item, ['pod_status', 'podStatus', 'status']);
    const gateId = String(item?.gateId || item?.gate_id || 'HG-06').trim() || 'HG-06';

    return {
      id: String(item?.id || `POD-${index + 1}`).trim() || `POD-${index + 1}`,
      awbId: String(item?.awbId || item?.awb_id || '').trim(),
      object: awb || String(item?.object || item?.objectLabel || item?.awb_no || '').trim() || '--',
      signer: String(item?.signer || item?.consignee_name || item?.target || '').trim() || '--',
      status: String(item?.status || mapPodStatusLabel(rawStatus)).trim() || mapPodStatusLabel(rawStatus),
      retry: String(item?.retry || mapPodRetryLabel(rawStatus)).trim() || mapPodRetryLabel(rawStatus),
      note: String(item?.note || item?.blocker_reason || '').trim() || '根据签收和 POD 状态决定是否允许关闭',
      gateId,
      objectTo: String(item?.objectTo || (awb ? `/station/inbound/waybills/${encodeURIComponent(awb)}` : '/station/inbound/waybills')).trim()
    };
  });

  const relevantGateIds = new Set(podNotifications.map((item) => item.gateId).filter(Boolean));

  const normalizedGateRows = gateRows.map((item: any) => ({
    id: String(item?.id || item?.gateEvaluationId || item?.gateId || '').trim(),
    gateId: String(item?.gateId || item?.gate_id || '').trim(),
    node: String(item?.node || '').trim(),
    required: String(item?.required || '').trim(),
    impact: String(item?.impact || '').trim(),
    status: String(item?.status || '').trim(),
    blockingReason: String(item?.blockingReason || item?.blocker || '').trim(),
    recoveryAction: String(item?.recoveryAction || item?.recovery || '').trim(),
    releaseRole: String(item?.releaseRole || '').trim()
  }));

  const normalizedPolicyRows = policyRows.map((item: any) => ({
    id: String(item?.id || item?.gateId || '').trim(),
    rule: String(item?.rule || '').trim(),
    triggerNode: String(item?.triggerNode || '').trim(),
    affectedModule: String(item?.affectedModule || '').trim(),
    blocker: String(item?.blocker || '').trim(),
    recovery: String(item?.recovery || '').trim(),
    releaseRole: String(item?.releaseRole || '').trim()
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
    hardGatePolicyRows
  };
}

function normalizeStationReportLoadingPlanRow(item: any) {
  return {
    transferId: String(item?.loading_plan_id || item?.transferId || item?.id || '').trim(),
    flightNo: String(item?.flight_no || item?.flightNo || '').trim(),
    truckPlate: String(item?.truck_plate || item?.plate || '').trim(),
    driverName: String(item?.driver_name || item?.driver || '').trim(),
    collectionNote: String(item?.collection_note || item?.collectionNote || item?.awb || '').trim(),
    status: String(item?.plan_status || item?.status || '').trim(),
    createdAt: item?.created_at || item?.createdAt || null,
    updatedAt: item?.updated_at || item?.updatedAt || null,
    arrivalTime: item?.arrival_time || item?.arrivalTime || item?.departAt || null,
    departTime: item?.depart_time || item?.departTime || item?.departAt || null
  };
}

function normalizeStationReportAuditRow(item: any) {
  return {
    action: String(item?.action || '').trim(),
    objectType: String(item?.object_type || item?.objectType || '').trim(),
    objectId: String(item?.object_id || item?.objectId || '').trim(),
    summary: String(item?.summary || '').trim(),
    createdAt: item?.created_at || item?.createdAt || null
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

function isStationReportLoadingTask(task: { taskType: string; executionNode: string }) {
  return STATION_REPORT_LOADING_TASK_PATTERN.test(`${task.taskType} ${task.executionNode}`);
}

function isStationReportPodTask(task: { taskType: string; executionNode: string }) {
  return STATION_REPORT_POD_TASK_PATTERN.test(`${task.taskType} ${task.executionNode}`);
}

function isStationReportClosedDocument(document: { documentStatus: string }) {
  return STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(document.documentStatus);
}

function buildStationReportCards(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[],
  loadingPlans: ReturnType<typeof normalizeStationReportLoadingPlanRow>[]
) {
  if (!tasks.length && !exceptions.length && !documents.length && !loadingPlans.length) {
    return STATION_REPORT_DEFAULT_CARDS;
  }

  const completedTasks = tasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || COMPLETED_TASK_STATUSES.has(item.taskStatus));
  const completedWithin12Hours = completedTasks.filter((item) => {
    const hours = diffStationReportHours(item.createdAt, item.completedAt);
    return hours !== null && hours <= 12;
  }).length;
  const completionRate = completedTasks.length ? completedWithin12Hours / completedTasks.length : 0;

  const loadingTasks = tasks.filter(isStationReportLoadingTask);
  const loadingSucceeded = loadingTasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || (!item.blockerCode && !exceptions.some((exception) => exception.linkedTaskId === item.taskId && STATION_REPORT_ACTIVE_EXCEPTION_STATUSES.has(exception.exceptionStatus)))).length;
  const loadingAccuracy = loadingTasks.length ? loadingSucceeded / loadingTasks.length : completionRate;

  const podDocuments = documents.filter((item) => item.documentType === 'POD');
  const closedPodDocuments = podDocuments.filter(isStationReportClosedDocument).length;
  const podClosure = podDocuments.length ? closedPodDocuments / podDocuments.length : tasks.filter(isStationReportPodTask).filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || COMPLETED_TASK_STATUSES.has(item.taskStatus)).length / Math.max(1, tasks.filter(isStationReportPodTask).length);

  const exceptionDurations = exceptions
    .filter((item) => STATION_REPORT_ACTIVE_EXCEPTION_STATUSES.has(item.exceptionStatus) || CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus))
    .map((item) => diffStationReportHours(item.openedAt, item.closedAt))
    .filter((value): value is number => value !== null);
  const avgExceptionAge = exceptionDurations.length ? exceptionDurations.reduce((sum, value) => sum + value, 0) / exceptionDurations.length : 0;

  return [
    { title: '12 小时完成率', value: formatStationReportPercent(completionRate * 100), helper: '按站内任务完成时长统计', chip: '12H', color: 'primary' },
    { title: '装车准确率', value: formatStationReportPercent(loadingAccuracy * 100), helper: '装车 / 机坪 / 转运任务复核一致率', chip: 'Loading', color: 'secondary' },
    { title: 'POD 闭环率', value: formatStationReportPercent(podClosure * 100), helper: '已签收并完成归档的比例', chip: 'POD', color: 'success' },
    { title: '异常闭环时长', value: formatStationReportHours(avgExceptionAge || 0), helper: '异常从提出到恢复的平均耗时', chip: 'Recovery', color: 'warning' }
  ];
}

function buildStationReportShiftRows(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[]
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
        tasks: []
      });
    }
    taskGroups.get(key)?.tasks.push(task);
  }

  const rows = Array.from(taskGroups.values())
    .map((group) => {
      const teamTasks = group.tasks;
      const completedTasks = teamTasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || COMPLETED_TASK_STATUSES.has(item.taskStatus));
      const loadingTasks = teamTasks.filter(isStationReportLoadingTask);
      const loadingCompleted = loadingTasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || COMPLETED_TASK_STATUSES.has(item.taskStatus)).length;
      const podTasks = teamTasks.filter(isStationReportPodTask);
      const podCompleted = podTasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || COMPLETED_TASK_STATUSES.has(item.taskStatus)).length;
      const relatedExceptionDurations = exceptions
        .filter((exception) => exception.ownerTeamId === group.team || teamTasks.some((task) => task.taskId === exception.linkedTaskId || task.relatedObjectId === exception.relatedObjectId))
        .map((exception) => diffStationReportHours(exception.openedAt, exception.closedAt))
        .filter((value): value is number => value !== null);
      const avgExceptionAge = relatedExceptionDurations.length ? relatedExceptionDurations.reduce((sum, value) => sum + value, 0) / relatedExceptionDurations.length : 0;

      return {
        shift: group.shift || '白班',
        team: group.team || '未分配',
        completed: `${completedTasks.length} / ${teamTasks.length}`,
        loadingAccuracy: loadingTasks.length ? formatStationReportPercent((loadingCompleted / loadingTasks.length) * 100) : 'N/A',
        podClosure: podTasks.length ? formatStationReportPercent((podCompleted / podTasks.length) * 100) : 'N/A',
        exceptionAge: avgExceptionAge ? formatStationReportHours(avgExceptionAge) : 'N/A'
      };
    })
    .sort((left, right) => left.shift.localeCompare(right.shift));

  return rows.length ? rows.slice(0, 3) : STATION_REPORT_DEFAULT_SHIFT_ROWS;
}

function buildStationReportPdaRows(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  loadingPlans: ReturnType<typeof normalizeStationReportLoadingPlanRow>[]
) {
  if (!tasks.length && !exceptions.length && !loadingPlans.length) {
    return STATION_REPORT_DEFAULT_PDA_ROWS;
  }

  const taskLeadTimes = tasks
    .map((item) => diffStationReportHours(item.createdAt, item.completedAt))
    .filter((value): value is number => value !== null);
  const arrivalLeadTimes = loadingPlans
    .map((item) => diffStationReportHours(item.createdAt, item.arrivalTime || item.departTime))
    .filter((value): value is number => value !== null);
  const completedTasks = tasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || COMPLETED_TASK_STATUSES.has(item.taskStatus));
  const evidenceRequiredTasks = tasks.filter((item) => item.evidenceRequired);
  const evidenceFulfilled = evidenceRequiredTasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || COMPLETED_TASK_STATUSES.has(item.taskStatus)).length;
  const linkedExceptionResponseTimes = exceptions
    .map((item) => diffStationReportHours(item.openedAt, item.closedAt))
    .filter((value): value is number => value !== null);

  const avgReceiptMinutes = taskLeadTimes.length ? taskLeadTimes.reduce((sum, value) => sum + value, 0) * 60 / taskLeadTimes.length : 0;
  const avgArrivalMinutes = arrivalLeadTimes.length ? arrivalLeadTimes.reduce((sum, value) => sum + value, 0) * 60 / arrivalLeadTimes.length : 0;
  const avgCompletionMinutes = completedTasks.length
    ? completedTasks
        .map((item) => diffStationReportHours(item.createdAt, item.completedAt))
        .filter((value): value is number => value !== null)
        .reduce((sum, value, _, array) => sum + value, 0) * 60 / Math.max(1, completedTasks.filter((item) => diffStationReportHours(item.createdAt, item.completedAt) !== null).length)
    : 0;
  const evidenceRate = evidenceRequiredTasks.length ? (evidenceFulfilled / evidenceRequiredTasks.length) * 100 : 0;
  const avgExceptionMinutes = linkedExceptionResponseTimes.length ? (linkedExceptionResponseTimes.reduce((sum, value) => sum + value, 0) * 60) / linkedExceptionResponseTimes.length : 0;

  return [
    { metric: '接单时长', current: formatStationReportMinutes(avgReceiptMinutes || 0), target: '<= 5m', note: '任务派发到接单确认的平均时长。' },
    { metric: '到场时长', current: formatStationReportMinutes(avgArrivalMinutes || 0), target: '<= 10m', note: '任务创建到到场/到站回传的平均时长。' },
    { metric: '任务完成时长', current: formatStationReportMinutes(avgCompletionMinutes || 0), target: '<= 25m', note: '开始到完成的平均时长。' },
    { metric: '证据上传完整率', current: formatStationReportPercent(evidenceRate || 0), target: '>= 95%', note: '需照片 / 签字 / 扫码的任务样例口径。' },
    { metric: '异常首次反馈时长', current: formatStationReportMinutes(avgExceptionMinutes || 0), target: '<= 8m', note: '发现异常到首次反馈的平均时长。' }
  ];
}

function buildStationReportFileRows(
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[],
  audits: ReturnType<typeof normalizeStationReportAuditRow>[]
) {
  if (!documents.length && !audits.length) {
    return STATION_REPORT_DEFAULT_FILE_ROWS;
  }

  const requiredDocuments = documents.filter((item) => item.requiredForRelease);
  const missingRequiredDocuments = requiredDocuments.filter((item) => !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus));
  const documentGroups = new Map<string, ReturnType<typeof normalizeStationReportDocumentRow>[]>();

  for (const document of documents) {
    const key = `${document.documentType}::${document.relatedObjectId || document.relatedObjectType}`;
    if (!documentGroups.has(key)) {
      documentGroups.set(key, []);
    }
    documentGroups.get(key)?.push(document);
  }

  const replacementCandidates = Array.from(documentGroups.values())
    .map((group) => group.slice().sort((left, right) => (right.updatedAt || right.uploadedAt || '').localeCompare(left.updatedAt || left.uploadedAt || '')))
    .find((group) => group.length > 1);
  const latestReplacement = replacementCandidates?.[0];
  const previousReplacement = replacementCandidates?.[1];

  const criticalDocuments = documents.filter((item) => ['FFM', 'UWS', 'Manifest', 'POD', 'CBA', 'MAWB'].includes(item.documentType));
  const latestCriticalDocuments = criticalDocuments
    .slice()
    .sort((left, right) => (right.updatedAt || right.uploadedAt || '').localeCompare(left.updatedAt || left.uploadedAt || ''))
    .slice(0, 2);

  const previewActions = audits.filter((item) => item.objectType === 'Document' && /(preview|download|open|view|预览|下载)/i.test(`${item.action} ${item.summary}`));
  const latestPreviewAction = previewActions[0];

  return [
    {
      report: '关键文件缺失',
      object: requiredDocuments[0] ? `${requiredDocuments[0].documentType} / ${requiredDocuments[0].relatedObjectId || requiredDocuments[0].relatedObjectType}` : '关键放行文件',
      current: `${missingRequiredDocuments.length} 条未满足放行条件`,
      note: `覆盖 ${requiredDocuments.length} 份关键文档。`
    },
    {
      report: '文件版本替换',
      object: latestReplacement ? `${latestReplacement.documentType} / ${latestReplacement.relatedObjectId || latestReplacement.relatedObjectType}` : '文件版本链',
      current: latestReplacement && previousReplacement ? `${previousReplacement.versionNo} 生效 / ${latestReplacement.versionNo} 待发布` : latestReplacement ? `${latestReplacement.versionNo} 最新` : '暂无版本替换',
      note: latestReplacement ? `最新文件 ${latestReplacement.documentName || latestReplacement.documentId}` : '暂无可用文件版本。'
    },
    {
      report: '文件生效时间',
      object: latestCriticalDocuments.map((item) => item.documentType).join(' / ') || '关键文件',
      current: latestCriticalDocuments.map((item) => formatOverviewTime(item.updatedAt || item.uploadedAt)).join(' / '),
      note: '按最近更新的关键文件排序。'
    },
    {
      report: '下载与预览审计',
      object: latestPreviewAction ? `${latestPreviewAction.objectType} / ${latestPreviewAction.objectId}` : 'Document / 审计',
      current: `${previewActions.length} 次预览 / ${audits.filter((item) => item.objectType === 'Document' && /download/i.test(item.action)).length} 次下载`,
      note: latestPreviewAction ? `最近动作：${latestPreviewAction.summary || latestPreviewAction.action}` : '当前只做前端动作记录。'
    }
  ];
}

async function loadStationReportsOverview(db: any, stationId: string) {
  const [tasksResult, exceptionsResult, documentsResult, loadingPlansResult, auditsResult, fallbackPayloads] = await Promise.all([
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
                tm.team_name,
                tm.shift_code
              FROM tasks t
              LEFT JOIN teams tm ON tm.team_id = t.assigned_team_id
              WHERE t.station_id = ?
              ORDER BY COALESCE(t.due_at, t.updated_at, t.created_at) ASC, t.created_at DESC
            `
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
                closed_at
              FROM exceptions
              WHERE station_id = ?
              ORDER BY opened_at DESC, created_at DESC
            `
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
            `
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
            `
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
            `
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    loadStableStationReportsPayloads(db)
  ]);

  const liveTasks = tasksResult.map(normalizeStationReportTaskRow);
  const liveExceptions = exceptionsResult.map(normalizeStationReportExceptionRow);
  const liveDocuments = documentsResult.map(normalizeStationReportDocumentRow);
  const liveLoadingPlans = loadingPlansResult.map(normalizeStationReportLoadingPlanRow);
  const liveAudits = auditsResult.map(normalizeStationReportAuditRow);

  const demoTasks = toArray<any>(fallbackPayloads['sinoport-adapters.stationTaskBoard']).map(normalizeStationReportTaskRow);
  const demoDocuments = toArray<any>(fallbackPayloads['sinoport-adapters.stationDocumentRows']).map(normalizeStationReportDocumentRow);
  const demoLoadingPlans = toArray<any>(fallbackPayloads['sinoport-adapters.stationTransferRows']).map(normalizeStationReportLoadingPlanRow);
  const demoAudits = toArray<any>(fallbackPayloads['sinoport-adapters.stationAuditFeed']).map(normalizeStationReportAuditRow);

  const tasks = liveTasks.length ? liveTasks : demoTasks;
  const exceptions = liveExceptions.length ? liveExceptions : [];
  const documents = liveDocuments.length ? liveDocuments : demoDocuments;
  const loadingPlans = liveLoadingPlans.length ? liveLoadingPlans : demoLoadingPlans;
  const audits = liveAudits.length ? liveAudits : demoAudits;

  return {
    stationId,
    stationReportCards: buildStationReportCards(tasks, exceptions, documents, loadingPlans),
    shiftReportRows: buildStationReportShiftRows(tasks, exceptions, documents),
    pdaKpiRows: buildStationReportPdaRows(tasks, exceptions, loadingPlans),
    stationFileReportRows: buildStationReportFileRows(documents, audits)
  };
}

const REPORT_TIME_ZONE = 'UTC';

function normalizeDailyReportDate(value: unknown, fallbackDate = new Date()) {
  const text = String(value || '').trim();
  if (text && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return fallbackDate.toISOString().slice(0, 10);
}

function buildDailyReportAnchor(reportDate: string) {
  return `${reportDate}T23:59:59.999Z`;
}

function buildCountRows(items: any[], selector: (item: any) => string) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = String(selector(item) || '').trim() || '未分类';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({
      label,
      count
    }));
}

function buildStationDailyTaskRows(tasks: ReturnType<typeof normalizeStationReportTaskRow>[]) {
  return tasks
    .filter((item) => !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) && !COMPLETED_TASK_STATUSES.has(item.taskStatus))
    .sort((left, right) => String(left.dueAt || '9999-12-31').localeCompare(String(right.dueAt || '9999-12-31')))
    .slice(0, 4)
    .map((item) => ({
      id: item.taskId,
      title: item.taskType,
      node: item.executionNode || '--',
      owner: item.teamName || item.teamId || item.shiftLabel || '未分配',
      status: item.taskStatus,
      due: formatOverviewTime(item.dueAt),
      blocker: item.blockerCode || '无'
    }));
}

function buildStationDailyBlockerRows(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[]
) {
  const blockedTasks = tasks
    .filter((item) => !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) && !COMPLETED_TASK_STATUSES.has(item.taskStatus) && item.blockerCode)
    .slice(0, 2)
    .map((item) => ({
      id: item.taskId,
      title: `${item.taskType} · ${item.blockerCode}`,
      description: item.executionNode || item.relatedObjectId || '待处理任务',
      status: '阻塞',
      meta: `${item.teamName || item.teamId || item.shiftLabel || '未分配'} · 截止 ${formatOverviewTime(item.dueAt)}`
    }));

  const openExceptions = exceptions
    .filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus) && item.blockerFlag)
    .slice(0, 2)
    .map((item) => ({
      id: item.exceptionId,
      title: `${item.relatedObjectType || '异常'} · ${item.exceptionId}`,
      description: item.rootCause || item.actionTaken || item.exceptionType || '待补充异常说明',
      status: '警戒',
      meta: `${item.severity || 'P2'} · ${formatOverviewTime(item.openedAt)}`
    }));

  const missingDocuments = documents
    .filter((item) => item.requiredForRelease && !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus))
    .slice(0, 2)
    .map((item) => ({
      id: item.documentId,
      title: `${item.documentType} · ${item.documentName}`,
      description: item.note || item.relatedObjectLabel || item.relatedObjectId || '关键文件待补齐',
      status: '待补齐',
      meta: `${item.documentStatus} · ${formatOverviewTime(item.updatedAt || item.uploadedAt)}`
    }));

  return [...blockedTasks, ...openExceptions, ...missingDocuments].slice(0, 4);
}

function buildStationDailyRows(
  tasks: ReturnType<typeof normalizeStationReportTaskRow>[],
  exceptions: ReturnType<typeof normalizeStationReportExceptionRow>[],
  documents: ReturnType<typeof normalizeStationReportDocumentRow>[],
  loadingPlans: ReturnType<typeof normalizeStationReportLoadingPlanRow>[],
  audits: ReturnType<typeof normalizeStationReportAuditRow>[],
  reportAnchor: string
) {
  const reportAnchorTime = new Date(reportAnchor).getTime();
  const completedTasks = tasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || COMPLETED_TASK_STATUSES.has(item.taskStatus));
  const blockedTasks = tasks.filter((item) => !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) && !COMPLETED_TASK_STATUSES.has(item.taskStatus) && item.blockerCode);
  const overdueTasks = tasks.filter((item) => !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) && !COMPLETED_TASK_STATUSES.has(item.taskStatus) && item.dueAt && new Date(String(item.dueAt)).getTime() < reportAnchorTime).length;
  const openExceptions = exceptions.filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus));
  const blockingExceptions = exceptions.filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus) && item.blockerFlag);
  const requiredDocuments = documents.filter((item) => item.requiredForRelease);
  const missingDocuments = requiredDocuments.filter((item) => !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus));
  const approvedDocuments = requiredDocuments.length - missingDocuments.length;
  const evidenceRequiredTasks = tasks.filter((item) => item.evidenceRequired);
  const evidenceFulfilled = evidenceRequiredTasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || COMPLETED_TASK_STATUSES.has(item.taskStatus)).length;

  const avgReceiptMinutes = tasks.length
    ? (tasks
        .map((item) => diffStationReportHours(item.createdAt, item.completedAt || item.updatedAt))
        .filter((value): value is number => value !== null)
        .reduce((sum, value) => sum + value, 0) * 60) /
      Math.max(tasks.filter((item) => diffStationReportHours(item.createdAt, item.completedAt || item.updatedAt) !== null).length, 1)
    : 0;
  const avgArrivalMinutes = loadingPlans.length
    ? (loadingPlans
        .map((item) => diffStationReportHours(item.createdAt, item.arrivalTime || item.departTime || item.updatedAt))
        .filter((value): value is number => value !== null)
        .reduce((sum, value) => sum + value, 0) * 60) /
      Math.max(loadingPlans.filter((item) => diffStationReportHours(item.createdAt, item.arrivalTime || item.departTime || item.updatedAt) !== null).length, 1)
    : 0;
  const avgCompletionMinutes = completedTasks.length
    ? (completedTasks
        .map((item) => diffStationReportHours(item.createdAt, item.completedAt || item.updatedAt))
        .filter((value): value is number => value !== null)
        .reduce((sum, value) => sum + value, 0) * 60) /
      Math.max(completedTasks.filter((item) => diffStationReportHours(item.createdAt, item.completedAt || item.updatedAt) !== null).length, 1)
    : 0;
  const avgExceptionMinutes = exceptions.length
    ? (exceptions
        .map((item) => diffStationReportHours(item.openedAt, item.closedAt))
        .filter((value): value is number => value !== null)
        .reduce((sum, value) => sum + value, 0) * 60) /
      Math.max(exceptions.filter((item) => diffStationReportHours(item.openedAt, item.closedAt) !== null).length, 1)
    : 0;

  return [
    {
      section: '任务流转',
      metric: '完成 / 阻断 / 超时',
      current: `${completedTasks.length} / ${blockedTasks.length} / ${overdueTasks}`,
      note: `${tasks.length} 个日报任务已纳入当日范围`
    },
    {
      section: '异常分布',
      metric: '开放 / 阻断 / 已关闭',
      current: `${openExceptions.length} / ${blockingExceptions.length} / ${Math.max(exceptions.length - openExceptions.length, 0)}`,
      note: buildCountRows(exceptions, (item) => item.severity || '未分级')
        .map((row) => `${row.label} ${row.count}`)
        .join(' / ') || '暂无异常'
    },
    {
      section: '文档闭环',
      metric: '关键 / 已批 / 缺失',
      current: `${requiredDocuments.length} / ${approvedDocuments} / ${missingDocuments.length}`,
      note: requiredDocuments.length ? `${audits.length} 条审计事件参与文件回看` : '暂无关键文件'
    },
    {
      section: 'PDA 关键指标',
      metric: '接单 / 到场 / 完成',
      current: `${formatStationReportMinutes(avgReceiptMinutes || 0)} / ${formatStationReportMinutes(avgArrivalMinutes || 0)} / ${formatStationReportMinutes(avgCompletionMinutes || 0)}`,
      note: `证据上传完整率 ${formatStationReportPercent((evidenceRequiredTasks.length ? evidenceFulfilled / evidenceRequiredTasks.length : 0) * 100)} · 异常首次反馈 ${formatStationReportMinutes(avgExceptionMinutes || 0)}`
    }
  ];
}

function buildPlatformDailyStationRows(
  stations: Array<{ station_id: string; station_name: string; control_level: string | null; phase: string | null }>,
  stationHealthRows: Array<{ code: string; name: string; control: string; phase: string; readiness: number; blockingReason: string }>,
  tasks: Array<{ station_id: string; task_status: string; blocker_code: string | null; due_at: string | null; task_type: string; execution_node: string; related_object_type: string; related_object_id: string; assigned_role: string | null; assigned_team_id: string | null; assigned_worker_id: string | null }>,
  exceptions: Array<{ station_id: string; exception_status: string; blocker_flag: number | string; severity: string; root_cause: string | null; action_taken: string | null; opened_at: string | null; closed_at: string | null }>,
  documents: Array<{ station_id: string; document_type: string; document_status: string; required_for_release: number | boolean | null; updated_at: string | null; uploaded_at: string | null; created_at?: string | null }>,
  reportAnchor: string
) {
  const stationCatalog = new Map(stations.map((item) => [item.station_id, item] as const));
  const healthByCode = new Map(stationHealthRows.map((item) => [item.code, item] as const));
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
    const completedTasks = stationTasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.task_status) || COMPLETED_TASK_STATUSES.has(item.task_status)).length;
    const blockedTasks = stationTasks.filter((item) => !STATION_REPORT_DONE_TASK_STATUSES.has(item.task_status) && !COMPLETED_TASK_STATUSES.has(item.task_status) && item.blocker_code).length;
    const podDocuments = stationDocuments.filter((item) => item.document_type === 'POD');
    const approvedPods = podDocuments.filter((item) => STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.document_status)).length;
    const podClosure = podDocuments.length
      ? `${Math.round((approvedPods / podDocuments.length) * 1000) / 10}%`
      : stationTasks.length
        ? `${Math.round((completedTasks / Math.max(stationTasks.length, 1)) * 1000) / 10}%`
        : '0%';
    const avgExceptionAge = stationExceptions.length
      ? stationExceptions
          .map((item) => diffStationReportHours(item.opened_at, item.closed_at || reportAnchor))
          .filter((value): value is number => value !== null)
          .reduce((sum, value) => sum + value, 0) /
        Math.max(stationExceptions.filter((item) => diffStationReportHours(item.opened_at, item.closed_at || reportAnchor) !== null).length, 1)
      : 0;

    return {
      code: row.code,
      station: station?.station_name || row.name,
      control: normalizeControlLevel(station?.control_level ?? row.control),
      inboundSla: stationTasks.length ? `${Math.round((completedTasks / stationTasks.length) * 1000) / 10}%` : '0%',
      podClosure,
      exceptionAging: avgExceptionAge ? formatStationReportHours(avgExceptionAge) : '0h',
      readiness: `${row.readiness}%`,
      blockingReason: healthByCode.get(row.code)?.blockingReason || row.blockingReason
    };
  });
}

async function loadStationDailyReportSource(db: any, stationId: string, reportDate: string) {
  const [tasksResult, exceptionsResult, documentsResult, loadingPlansResult, auditsResult] = await Promise.all([
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
            `
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
            `
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
            `
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
            `
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
            `
          )
          .bind(stationId, reportDate)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([])
  ]);

  return {
    tasks: tasksResult.map(normalizeStationReportTaskRow),
    exceptions: exceptionsResult.map(normalizeStationReportExceptionRow),
    documents: documentsResult.map(normalizeStationReportDocumentRow),
    loadingPlans: loadingPlansResult.map(normalizeStationReportLoadingPlanRow),
    audits: auditsResult.map(normalizeStationReportAuditRow)
  };
}

async function loadPlatformDailyReportSource(db: any, reportDate: string, stationId?: string) {
  const stationClause = stationId ? ' WHERE station_id = ?' : '';
  const stationParams = stationId ? [stationId] : [];
  const [stationsResult, tasksResult, exceptionsResult, documentsResult, auditsResult] = await Promise.all([
    db
      ? db
          .prepare(
            `
              SELECT station_id, station_name, control_level, phase
              FROM stations
              ${stationClause}
              ORDER BY station_id ASC
            `
          )
          .bind(...stationParams)
          .all()
          .then((rows: any) => (rows?.results || []) as Array<{ station_id: string; station_name: string; control_level: string | null; phase: string | null }>)
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
              ${stationId ? 'AND t.station_id = ?' : ''}
              ORDER BY COALESCE(t.due_at, t.updated_at, t.created_at) ASC, t.created_at DESC
            `
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
              ${stationId ? 'AND station_id = ?' : ''}
              ORDER BY opened_at DESC, created_at DESC
            `
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
              ${stationId ? 'AND station_id = ?' : ''}
              ORDER BY COALESCE(updated_at, uploaded_at, created_at) DESC, document_id DESC
            `
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
              ${stationId ? 'AND station_id = ?' : ''}
              ORDER BY created_at DESC, audit_id DESC
            `
          )
          .bind(reportDate, ...stationParams)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([])
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
      updated_at: item.updated_at ?? null
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
      closed_at: item.closed_at ?? null
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
      note: item.note ?? null
    })),
    audits: auditsResult.map((item: any) => ({
      audit_id: String(item?.audit_id || '').trim(),
      actor_id: String(item?.actor_id || '').trim(),
      actor_role: String(item?.actor_role || '').trim(),
      action: String(item?.action || '').trim(),
      object_type: String(item?.object_type || '').trim(),
      object_id: String(item?.object_id || '').trim(),
      station_id: String(item?.station_id || stationId || '').trim(),
      summary: String(item?.summary || '').trim(),
      created_at: item?.created_at || null
    }))
  };
}

async function loadStationReportsDaily(db: any, stationId: string, reportDate: string) {
  const source = await loadStationDailyReportSource(db, stationId, reportDate);
  const generatedAt = new Date().toISOString();
  const reportAnchor = buildDailyReportAnchor(reportDate);
  const stationReportCards = buildStationReportCards(source.tasks, source.exceptions, source.documents, source.loadingPlans);
  const shiftReportRows = buildStationReportShiftRows(source.tasks, source.exceptions, source.documents);
  const pdaKpiRows = buildStationReportPdaRows(source.tasks, source.exceptions, source.loadingPlans);
  const stationFileReportRows = buildStationReportFileRows(source.documents, source.audits);
  const taskSummaryRows = buildStationDailyTaskRows(source.tasks);
  const blockerSummaryRows = buildStationDailyBlockerRows(source.tasks, source.exceptions, source.documents);
  const dailyReportRows = buildStationDailyRows(source.tasks, source.exceptions, source.documents, source.loadingPlans, source.audits, reportAnchor);
  const anomalyDistribution = {
    total: source.exceptions.length,
    open: source.exceptions.filter((item: any) => !CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus)).length,
    blocking: source.exceptions.filter((item: any) => !CLOSED_EXCEPTION_STATUSES.has(item.exceptionStatus) && item.blockerFlag).length,
    bySeverity: buildCountRows(source.exceptions, (item) => item.severity || '未分级'),
    byStatus: buildCountRows(source.exceptions, (item) => item.exceptionStatus || '未分类')
  };
  const documentSummary = {
    total: source.documents.length,
    required: source.documents.filter((item: any) => item.requiredForRelease).length,
    approved: source.documents.filter((item: any) => item.requiredForRelease && STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus)).length,
    missing: source.documents.filter((item: any) => item.requiredForRelease && !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.documentStatus)).length
  };
  const taskSummary = {
    total: source.tasks.length,
    open: source.tasks.filter((item: any) => !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) && !COMPLETED_TASK_STATUSES.has(item.taskStatus)).length,
    completed: source.tasks.filter((item: any) => STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) || COMPLETED_TASK_STATUSES.has(item.taskStatus)).length,
    blocked: source.tasks.filter((item: any) => !STATION_REPORT_DONE_TASK_STATUSES.has(item.taskStatus) && !COMPLETED_TASK_STATUSES.has(item.taskStatus) && item.blockerCode).length
  };

  return {
    reportMeta: {
      reportType: 'station_daily',
      stationId,
      reportDate,
      generatedAt,
      timeZone: REPORT_TIME_ZONE
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
    dailyReport: {
      overviewCards: stationReportCards,
      keyMetrics: pdaKpiRows,
      anomalyDistribution,
      blockerSummary: blockerSummaryRows,
      documentSummary: {
        ...documentSummary,
        rows: stationFileReportRows
      },
      taskSummary: {
        ...taskSummary,
        rows: taskSummaryRows
      },
      timestamp: generatedAt
    }
  };
}

async function loadStationExceptionsDaily(db: any, stationId: string, reportDate: string) {
  const report = await loadStationReportsDaily(db, stationId, reportDate);
  const source = await loadStationDailyReportSource(db, stationId, reportDate);
  const exceptionRows = source.exceptions
    .slice()
    .sort((left: any, right: any) => {
      if (left.blockerFlag !== right.blockerFlag) return left.blockerFlag ? -1 : 1;
      const leftSeverity = left.severity === 'P1' ? 0 : left.severity === 'P2' ? 1 : 2;
      const rightSeverity = right.severity === 'P1' ? 0 : right.severity === 'P2' ? 1 : 2;
      if (leftSeverity !== rightSeverity) return leftSeverity - rightSeverity;
      return String(right.openedAt || '').localeCompare(String(left.openedAt || ''));
    })
    .slice(0, 4)
    .map((item: any) => ({
      id: item.exceptionId,
      title: item.exceptionType,
      object: `${item.relatedObjectType || 'Object'} / ${item.relatedObjectId || '--'}`,
      severity: item.severity,
      status: item.exceptionStatus,
      blocker: item.blockerFlag ? '阻断中' : '-',
      summary: item.rootCause || item.actionTaken || '待补充恢复动作',
      openedAt: formatOverviewTime(item.openedAt),
      relatedTask: item.linkedTaskId || '--'
    }));

  const exceptionOverviewCards = buildStationExceptionOverviewCards(
    source.exceptions.map((item: any) => ({
      exception_status: item.exceptionStatus,
      blocker_flag: item.blockerFlag,
      severity: item.severity
    }))
  );
  const exceptionDailyReportRows = [
    {
      section: '异常总量',
      metric: '开放 / 阻断 / 已关闭',
      current: `${report.dailyReport.anomalyDistribution.open} / ${report.dailyReport.anomalyDistribution.blocking} / ${Math.max(source.exceptions.length - report.dailyReport.anomalyDistribution.open, 0)}`,
      note: `${source.exceptions.length} 条异常进入日报范围`
    },
    {
      section: '严重度分布',
      metric: 'P1 / P2 / P3',
      current: [
        `P1 ${report.dailyReport.anomalyDistribution.bySeverity.find((row: any) => row.label === 'P1')?.count || 0}`,
        `P2 ${report.dailyReport.anomalyDistribution.bySeverity.find((row: any) => row.label === 'P2')?.count || 0}`,
        `P3 ${report.dailyReport.anomalyDistribution.bySeverity.find((row: any) => row.label === 'P3')?.count || 0}`
      ].join(' / '),
      note: '按异常严重度汇总'
    },
    {
      section: '关联任务',
      metric: '开放 / 阻断 / 已完成',
      current: `${report.dailyReport.taskSummary.open} / ${report.dailyReport.taskSummary.blocked} / ${report.dailyReport.taskSummary.completed}`,
      note: '异常关联任务按日报口径归集'
    },
    {
      section: '文档影响',
      metric: '关键 / 已批 / 缺失',
      current: `${report.dailyReport.documentSummary.required} / ${report.dailyReport.documentSummary.approved} / ${report.dailyReport.documentSummary.missing}`,
      note: '异常相关文件在日报中同步展示'
    }
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
      keyMetrics: exceptionDailyReportRows,
      taskSummary: {
        ...report.dailyReport.taskSummary,
        rows: report.taskSummaryRows
      },
      timestamp: report.generatedAt
    }
  };
}

async function loadPlatformReportsDaily(db: any, reportDate: string, stationId?: string) {
  const source = await loadPlatformDailyReportSource(db, reportDate, stationId);
  const generatedAt = new Date().toISOString();
  const reportAnchor = buildDailyReportAnchor(reportDate);
  const overview = buildOverviewState(source.stations, source.tasks as any[], source.exceptions as any[], source.audits as any[]);
  const stationHealthRows = overview.stationHealthRows;
  const platformReportCards = overview.platformKpis.length ? overview.platformKpis : [];
  const platformStationReportRows = buildPlatformDailyStationRows(source.stations, stationHealthRows as any[], source.tasks as any[], source.exceptions as any[], source.documents as any[], reportAnchor);
  const platformDailyReportRows = buildPlatformDailyRows(stationHealthRows as any[], source.tasks as any[], source.exceptions as any[], source.documents as any[], reportAnchor);
  const blockerSummaryRows = overview.platformAlerts.length ? overview.platformAlerts : overview.platformPendingActions;
  const taskSummaryRows = overview.platformPendingActions;
  const documentSummaryRows = buildPlatformDocumentSummaryRows(source.documents as any[], source.exceptions as any[]);
  const anomalyDistribution = {
    total: source.exceptions.length,
    open: source.exceptions.filter((item: any) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status)).length,
    blocking: source.exceptions.filter((item: any) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) && Boolean(Number(item.blocker_flag))).length,
    bySeverity: buildCountRows(source.exceptions, (item) => item.severity || '未分级'),
    byStatus: buildCountRows(source.exceptions, (item) => item.exception_status || '未分类')
  };

  return {
    reportMeta: {
      reportType: 'platform_daily',
      stationId: stationId || null,
      reportDate,
      generatedAt,
      timeZone: REPORT_TIME_ZONE
    },
    stationId: stationId || null,
    reportDate,
    generatedAt,
    platformReportCards,
    platformStationReportRows,
    platformDailyReportRows,
    platformStationHealthRows: stationHealthRows,
    anomalyDistributionRows: anomalyDistribution.bySeverity,
    blockerSummaryRows,
    taskSummaryRows,
    documentSummaryRows,
    dailyReport: {
      overviewCards: platformReportCards,
      keyMetrics: platformDailyReportRows,
      anomalyDistribution,
      blockerSummary: blockerSummaryRows,
      documentSummary: {
        total: source.documents.length,
        rows: documentSummaryRows
      },
      taskSummary: {
        total: source.tasks.length,
        rows: taskSummaryRows
      },
      timestamp: generatedAt
    }
  };
}

function buildPlatformDailyRows(
  stationHealthRows: Array<{ code: string; name: string; control: string; phase: string; readiness: number; blockingReason: string }>,
  tasks: Array<{ station_id: string; task_status: string; blocker_code: string | null; due_at: string | null; task_type: string; execution_node: string }>,
  exceptions: Array<{ station_id: string; exception_status: string; blocker_flag: number | string; severity: string; root_cause: string | null; action_taken: string | null; opened_at: string | null }>,
  documents: Array<{ station_id: string; document_type: string; document_status: string; required_for_release: number | boolean | null; updated_at: string | null; uploaded_at: string | null; created_at?: string | null }>,
  reportAnchor: string
) {
  const reportAnchorTime = new Date(reportAnchor).getTime();
  const completedTasks = tasks.filter((item) => STATION_REPORT_DONE_TASK_STATUSES.has(item.task_status) || COMPLETED_TASK_STATUSES.has(item.task_status)).length;
  const blockedTasks = tasks.filter((item) => !STATION_REPORT_DONE_TASK_STATUSES.has(item.task_status) && !COMPLETED_TASK_STATUSES.has(item.task_status) && item.blocker_code).length;
  const overdueTasks = tasks.filter((item) => !STATION_REPORT_DONE_TASK_STATUSES.has(item.task_status) && !COMPLETED_TASK_STATUSES.has(item.task_status) && item.due_at && new Date(String(item.due_at)).getTime() < reportAnchorTime).length;
  const openExceptions = exceptions.filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status));
  const blockingExceptions = exceptions.filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) && Boolean(Number(item.blocker_flag)));
  const requiredDocuments = documents.filter((item) => Boolean(item.required_for_release));
  const missingDocuments = requiredDocuments.filter((item) => !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.document_status));
  const healthyStations = stationHealthRows.filter((item) => item.readiness >= 80).length;

  return [
    {
      section: '任务流转',
      metric: '完成 / 阻断 / 超时',
      current: `${completedTasks} / ${blockedTasks} / ${overdueTasks}`,
      note: `${tasks.length} 条当日报告任务`
    },
    {
      section: '异常分布',
      metric: '开放 / 阻断 / 已恢复',
      current: `${openExceptions.length} / ${blockingExceptions.length} / ${Math.max(exceptions.length - openExceptions.length, 0)}`,
      note: buildCountRows(exceptions, (item) => item.severity || '未分级')
        .map((row) => `${row.label} ${row.count}`)
        .join(' / ') || '暂无异常'
    },
    {
      section: '文档闭环',
      metric: '关键 / 已批 / 缺失',
      current: `${requiredDocuments.length} / ${requiredDocuments.length - missingDocuments.length} / ${missingDocuments.length}`,
      note: `${documents.length} 份文档进入日报范围`
    },
    {
      section: '站点准备度',
      metric: '健康 / 关注',
      current: `${healthyStations} / ${Math.max(stationHealthRows.length - healthyStations, 0)}`,
      note: `${stationHealthRows.length} 个站点参与平台日报`
    }
  ];
}

function buildPlatformDocumentSummaryRows(
  documents: Array<{ station_id: string; document_type: string; document_name: string; document_status: string; required_for_release: number | boolean | null; updated_at: string | null; uploaded_at: string | null; created_at?: string | null; note?: string | null }>,
  exceptions: Array<{ station_id: string; exception_status: string; blocker_flag: number | string; severity: string; root_cause: string | null; action_taken: string | null; opened_at: string | null }>
) {
  const requiredDocuments = documents.filter((item) => Boolean(item.required_for_release));
  const missingDocuments = requiredDocuments.filter((item) => !STATION_REPORT_APPROVED_DOCUMENT_STATUSES.has(item.document_status));
  const criticalDocuments = documents.filter((item) => ['FFM', 'UWS', 'Manifest', 'POD', 'CBA', 'MAWB'].includes(item.document_type));
  const latestCriticalDocuments = criticalDocuments
    .slice()
    .sort((left, right) => String(right.updated_at || right.uploaded_at || right.created_at || '').localeCompare(String(left.updated_at || left.uploaded_at || left.created_at || '')))
    .slice(0, 4);
  const blockingExceptions = exceptions.filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) && Boolean(Number(item.blocker_flag))).length;

  return [
    {
      report: '关键文件缺失',
      object: requiredDocuments[0] ? `${requiredDocuments[0].document_type} / ${requiredDocuments[0].station_id}` : '关键放行文件',
      current: `${missingDocuments.length} 条未满足放行条件`,
      note: `覆盖 ${requiredDocuments.length} 份关键文档`
    },
    {
      report: '文件版本替换',
      object: latestCriticalDocuments[0] ? `${latestCriticalDocuments[0].document_type} / ${latestCriticalDocuments[0].station_id}` : '文件版本链',
      current: latestCriticalDocuments.length > 1 ? `${latestCriticalDocuments[1].document_status} / ${latestCriticalDocuments[0].document_status}` : latestCriticalDocuments.length === 1 ? `${latestCriticalDocuments[0].document_status} 最新` : '暂无版本替换',
      note: latestCriticalDocuments[0] ? `最新文件 ${latestCriticalDocuments[0].document_name}` : '暂无可用文件版本'
    },
    {
      report: '阻断异常',
      object: '异常总览',
      current: `${blockingExceptions} 条阻断中`,
      note: '按日报日期过滤后的异常分布'
    },
    {
      report: '文件更新时间',
      object: latestCriticalDocuments.map((item) => item.document_type).join(' / ') || '关键文件',
      current: latestCriticalDocuments.map((item) => formatOverviewTime(item.updated_at || item.uploaded_at || item.created_at)).join(' / ') || '--',
      note: '按最近更新的关键文件排序'
    }
  ];
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

type ResourceTeamRow = {
  team_id?: string;
  station_id?: string;
  team_name?: string;
  team?: string;
  owner_name?: string | null;
  shift_code?: string | null;
  team_status?: string | null;
  id?: string;
  name?: string;
  shift?: string;
  owner?: string;
  status?: string;
  mappedLanes?: string;
};

type ResourceZoneRow = {
  zone?: string;
  station?: string;
  station_id?: string;
  type?: string;
  status?: string;
  note?: string | null;
  linkedLane?: string;
};

type ResourceDeviceRow = {
  code?: string;
  device?: string;
  station?: string;
  station_id?: string;
  owner?: string;
  role?: string;
  status?: string;
};

async function loadStationTasksOverview(db: any, stationId: string) {
  const [tasksResult, exceptionsResult, documentsResult, flightsResult, awbsResult, fallbackPayloads] = await Promise.all([
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
            `
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
            `
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
            `
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
            `
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
            `
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      : Promise.resolve([]),
    loadDemoDatasetPayloads(db, [
      'sinoport-adapters.stationTaskBoard',
      'sinoport-adapters.stationReviewQueue',
      'sinoport-adapters.stationBlockerQueue',
      'sinoport-adapters.inboundDocumentGates',
      'sinoport-adapters.outboundDocumentGates',
      'sinoport-adapters.scenarioTimelineRows',
      'sinoport-adapters.exceptionDetailRows'
    ])
  ]);

  const tasks = tasksResult.map((item: any) => ({
    task_id: String(item?.task_id || '').trim(),
    station_id: String(item?.station_id || stationId).trim(),
    task_type: String(item?.task_type || '任务').trim(),
    execution_node: String(item?.execution_node || '').trim(),
    related_object_type: String(item?.related_object_type || '').trim(),
    related_object_id: String(item?.related_object_id || '').trim(),
    assigned_role: String(item?.assigned_role || '').trim() || null,
    assigned_team_id: String(item?.assigned_team_id || '').trim() || null,
    assigned_worker_id: String(item?.assigned_worker_id || '').trim() || null,
    task_status: String(item?.task_status || '待处理').trim(),
    due_at: item?.due_at || null,
    blocker_code: String(item?.blocker_code || '').trim() || null,
    created_at: item?.created_at || null,
    updated_at: item?.updated_at || null,
    team_name: String(item?.team_name || '').trim() || null,
    shift_code: String(item?.shift_code || '').trim() || null
  }));

  const exceptions = exceptionsResult.map((item: any) => ({
    exception_id: String(item?.exception_id || '').trim(),
    station_id: String(item?.station_id || stationId).trim(),
    exception_type: String(item?.exception_type || '异常').trim(),
    related_object_type: String(item?.related_object_type || '').trim(),
    related_object_id: String(item?.related_object_id || '').trim(),
    linked_task_id: String(item?.linked_task_id || '').trim() || null,
    severity: String(item?.severity || '').trim(),
    owner_role: String(item?.owner_role || '').trim() || null,
    owner_team_id: String(item?.owner_team_id || '').trim() || null,
    exception_status: String(item?.exception_status || 'Open').trim(),
    blocker_flag: Boolean(Number(item?.blocker_flag ?? 0)),
    root_cause: String(item?.root_cause || '').trim() || null,
    action_taken: String(item?.action_taken || '').trim() || null,
    opened_at: item?.opened_at || null,
    closed_at: item?.closed_at || null
  }));

  const documents = documentsResult.map((item: any) => ({
    document_id: String(item?.document_id || '').trim(),
    document_type: String(item?.document_type || '').trim(),
    document_name: String(item?.document_name || '').trim(),
    related_object_type: String(item?.related_object_type || '').trim(),
    related_object_id: String(item?.related_object_id || '').trim(),
    document_status: String(item?.document_status || '').trim(),
    required_for_release: Boolean(item?.required_for_release),
    note: String(item?.note || '').trim(),
    created_at: item?.created_at || null,
    updated_at: item?.updated_at || null
  }));

  const flights = flightsResult.map((item: any) => ({
    flight_id: String(item?.flight_id || '').trim(),
    flight_no: String(item?.flight_no || '').trim(),
    origin_code: String(item?.origin_code || '').trim(),
    destination_code: String(item?.destination_code || '').trim(),
    eta_at: item?.eta_at || null,
    etd_at: item?.etd_at || null,
    actual_landed_at: item?.actual_landed_at || null,
    runtime_status: String(item?.runtime_status || '').trim(),
    service_level: String(item?.service_level || '').trim() || null
  }));

  const awbs = awbsResult.map((item: any) => ({
    awb_id: String(item?.awb_id || '').trim(),
    awb_no: String(item?.awb_no || '').trim(),
    flight_id: String(item?.flight_id || '').trim(),
    station_id: String(item?.station_id || stationId).trim()
  }));

  const flightById = new Map<string, any>(flights.map((item: any) => [item.flight_id, item] as const));
  const flightByNo = new Map<string, any>(flights.map((item: any) => [item.flight_no, item] as const));
  const awbById = new Map<string, any>(awbs.map((item: any) => [item.awb_id, item] as const));
  const awbByNo = new Map<string, any>(awbs.map((item: any) => [item.awb_no, item] as const));
  const exceptionByTaskId = new Map<string, any>();
  const exceptionByRelatedKey = new Map<string, any[]>();
  const documentByFlightId = new Map<string, any[]>();

  for (const exception of exceptions) {
    if (exception.linked_task_id && !exceptionByTaskId.has(exception.linked_task_id)) {
      exceptionByTaskId.set(exception.linked_task_id, exception);
    }

    const relatedKey = `${exception.related_object_type}:${exception.related_object_id}`;
    if (!exceptionByRelatedKey.has(relatedKey)) {
      exceptionByRelatedKey.set(relatedKey, []);
    }
    exceptionByRelatedKey.get(relatedKey)?.push(exception);
  }

  for (const document of documents) {
    if (document.related_object_type !== 'Flight') continue;
    if (!documentByFlightId.has(document.related_object_id)) {
      documentByFlightId.set(document.related_object_id, []);
    }
    documentByFlightId.get(document.related_object_id)?.push(document);
  }

  const relatedObjectLabel = (item: { related_object_type: string; related_object_id: string }) => {
    if (item.related_object_type === 'Flight') {
      return flightById.get(item.related_object_id)?.flight_no || flightByNo.get(item.related_object_id)?.flight_no || item.related_object_id;
    }

    if (item.related_object_type === 'AWB') {
      return awbById.get(item.related_object_id)?.awb_no || awbByNo.get(item.related_object_id)?.awb_no || item.related_object_id;
    }

    return item.related_object_id;
  };

  const openTasks = tasks.filter((item: any) => !COMPLETED_TASK_STATUSES.has(item.task_status));
  const openExceptions = exceptions.filter((item: any) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) && item.blocker_flag);
  const blockerTasks = openTasks.filter((item: any) => Boolean(item.blocker_code));

  const summaryCards = [
    {
      title: '待领取任务',
      value: String(tasks.filter((item: any) => ['Created', 'Assigned', 'Accepted'].includes(item.task_status)).length),
      helper: 'Created / Assigned / Accepted',
      chip: 'Queue',
      color: 'warning'
    },
    {
      title: '处理中任务',
      value: String(tasks.filter((item: any) => ['Started', 'Evidence Uploaded', 'Exception Raised'].includes(item.task_status)).length),
      helper: 'Started / Evidence / Exception',
      chip: 'Active',
      color: 'secondary'
    },
    {
      title: '已完成任务',
      value: String(tasks.filter((item: any) => ['Completed', 'Verified', 'Closed'].includes(item.task_status)).length),
      helper: `总任务 ${tasks.length}`,
      chip: 'Done',
      color: 'success'
    },
    {
      title: '阻断任务',
      value: String(tasks.filter((item: any) => Boolean(item.blocker_code) || exceptionByTaskId.has(item.task_id)).length),
      helper: '带 Gate 或异常的任务',
      chip: 'Block',
      color: 'error'
    }
  ];

  const stationTasks = tasks.map((item: any) => {
    const relatedException = exceptionByTaskId.get(item.task_id) || exceptionByRelatedKey.get(`${item.related_object_type}:${item.related_object_id}`)?.[0] || null;
    const assignee = item.team_name || item.assigned_team_id || item.assigned_worker_id || item.assigned_role || item.station_id;

    return {
      id: item.task_id,
      title: item.task_type,
      node: item.execution_node,
      role: item.assigned_role || '--',
      owner: assignee || '--',
      due: formatDashboardClock(item.due_at),
      priority: item.blocker_code || relatedException ? (relatedException?.severity === 'P1' ? 'P1' : 'P2') : 'P3',
      status: item.task_status,
      gateIds: item.blocker_code ? [item.blocker_code] : relatedException?.exception_id ? [relatedException.exception_id] : [],
      blocker: item.blocker_code || relatedException?.root_cause || relatedException?.action_taken || '无',
      objectTo:
        item.related_object_type === 'Flight'
          ? `/station/inbound/flights/${encodeURIComponent(relatedObjectLabel(item))}`
          : item.related_object_type === 'AWB'
            ? `/station/inbound/waybills/${encodeURIComponent(relatedObjectLabel(item))}`
            : item.related_object_type === 'Shipment'
              ? `/station/shipments/${encodeURIComponent(item.related_object_id)}`
              : '/station/shipments',
      exceptionId: relatedException?.exception_id || '',
      openExceptionCount: relatedException ? 1 : 0
    };
  });

  const stationTaskBlockerQueue = [
    ...blockerTasks.slice(0, 4).map((item: any) => ({
      id: item.task_id,
      title: `${relatedObjectLabel(item)} · ${item.blocker_code || item.task_type}`,
      description: item.execution_node || item.task_type,
      status: '阻塞',
      meta: `${item.assigned_role || item.team_name || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`
    })),
    ...openExceptions.slice(0, 4).map((item: any) => ({
      id: item.exception_id,
      title: `${relatedObjectLabel(item)} · ${item.exception_type}`,
      description: item.root_cause || item.action_taken || item.exception_type,
      status: '警戒',
      meta: `${item.severity || 'P2'} · ${formatOverviewTime(item.opened_at)}`
    }))
  ].slice(0, 4);

  const stationTaskReviewQueue = openTasks
    .sort((left: any, right: any) => String(left.due_at || '9999-12-31').localeCompare(String(right.due_at || '9999-12-31')))
    .slice(0, 4)
    .map((item: any) => ({
      id: item.task_id,
      title: item.task_type,
      description: `${item.execution_node} · ${relatedObjectLabel(item)}`,
      status: normalizeDashboardTaskStatus(item.task_status),
      releaseRole: item.assigned_role || item.team_name || '需独立复核或主管确认',
      meta: `${item.assigned_role || item.team_name || '需独立复核或主管确认'} · ${item.execution_node || relatedObjectLabel(item)}`,
      gateId: item.blocker_code || exceptionByTaskId.get(item.task_id)?.exception_id || ''
    }));

  const inboundFlights = flights.filter((item: any) => item.destination_code === stationId);
  const outboundFlights = flights.filter((item: any) => item.origin_code === stationId);
  const primaryInboundFlight = inboundFlights[0];
  const primaryOutboundFlight = outboundFlights[0];
  const acceptedDocStatuses = new Set(['Uploaded', 'Released', 'Approved', 'Accepted', 'Verified', 'Closed']);

  const buildDocumentGate = (
    gateId: string,
    node: string,
    required: string,
    impact: string,
    releaseRole: string,
    flight: any,
    missingDocTypes: string[],
    fallbackBlocker: string,
    recoveryText: string
  ) => ({
    gateId,
    node,
    required,
    impact,
    status: missingDocTypes.length || fallbackBlocker ? '警戒' : '运行中',
    blocker: fallbackBlocker || (missingDocTypes.length ? `${flight?.flight_no || '航班'} 缺 ${missingDocTypes.join(' / ')}` : '文件链已就绪'),
    recovery: recoveryText,
    releaseRole
  });

  const inboundFlightDocuments = primaryInboundFlight ? documentByFlightId.get(primaryInboundFlight.flight_id) || documentByFlightId.get(primaryInboundFlight.flight_no) || [] : [];
  const outboundFlightDocuments = primaryOutboundFlight ? documentByFlightId.get(primaryOutboundFlight.flight_id) || documentByFlightId.get(primaryOutboundFlight.flight_no) || [] : [];
  const inboundPresentDocTypes = new Set(inboundFlightDocuments.filter((item: any) => acceptedDocStatuses.has(String(item.document_status))).map((item: any) => item.document_type));
  const outboundPresentDocTypes = new Set(outboundFlightDocuments.filter((item: any) => acceptedDocStatuses.has(String(item.document_status))).map((item: any) => item.document_type));
  const inboundMissingDocTypes = ['CBA', 'Manifest'].filter((type) => !inboundPresentDocTypes.has(type));
  const outboundMissingDocTypes = ['FFM', 'Manifest'].filter((type) => !outboundPresentDocTypes.has(type));
  const inboundTaskBlocker = blockerTasks.find((item: any) => item.related_object_type === 'Flight' && item.related_object_id === String(primaryInboundFlight?.flight_id || '') && item.blocker_code);
  const outboundTaskBlocker = blockerTasks.find((item: any) => item.related_object_type === 'Flight' && item.related_object_id === String(primaryOutboundFlight?.flight_id || '') && item.blocker_code);
  const inboundException = openExceptions.find((item: any) => item.related_object_type === 'Flight' && item.related_object_id === String(primaryInboundFlight?.flight_id || ''));
  const outboundException = openExceptions.find((item: any) => item.related_object_type === 'Flight' && item.related_object_id === String(primaryOutboundFlight?.flight_id || ''));

  const stationTaskInboundDocumentGates = [
    buildDocumentGate(
      'HG-01',
      '进港落地 -> 进港处理',
      'CBA / Manifest',
      '允许生成 PMC 拆板、理货、分区任务',
      'Document Desk / Inbound Supervisor',
      primaryInboundFlight,
      inboundMissingDocTypes,
      inboundTaskBlocker?.blocker_code || inboundException?.root_cause || '',
      inboundTaskBlocker?.blocker_code || inboundException?.action_taken || (inboundMissingDocTypes.length ? `补齐 ${inboundMissingDocTypes.join(' / ')}` : '保持文档版本冻结')
    ),
    buildDocumentGate(
      'HG-03',
      'PMC 拆板 -> 理货完成',
      '件数 / 差异复核记录',
      '允许 NOA 与二次转运推进',
      'Check Worker / Station Supervisor',
      primaryInboundFlight,
      openTasks.filter((item: any) => item.related_object_type === 'Flight' && item.related_object_id === String(primaryInboundFlight?.flight_id || '') && !COMPLETED_TASK_STATUSES.has(item.task_status)).length ? ['差异复核'] : [],
      inboundTaskBlocker?.blocker_code || inboundException?.root_cause || '',
      inboundException?.action_taken || '补齐差异复核并更新计数结果'
    ),
    buildDocumentGate(
      'HG-06',
      '装车 / POD -> 交付关闭',
      'POD / 车牌 / 司机',
      '允许二次转运与交付关闭',
      'Delivery Desk / Station Supervisor',
      primaryOutboundFlight || primaryInboundFlight,
      outboundMissingDocTypes.length ? outboundMissingDocTypes : [],
      outboundTaskBlocker?.blocker_code || outboundException?.root_cause || '',
      outboundTaskBlocker?.blocker_code || outboundException?.action_taken || (outboundMissingDocTypes.length ? '补齐 POD 双签并回写签收状态' : '交付闭环待确认')
    )
  ];

  const stationTaskOutboundDocumentGates = [
    buildDocumentGate(
      'HG-02',
      '出港计划 -> 文件冻结',
      'FFM / Manifest',
      '允许出港计划和装机编排',
      'Document Desk / Export Supervisor',
      primaryOutboundFlight,
      outboundMissingDocTypes,
      outboundTaskBlocker?.blocker_code || outboundException?.root_cause || '',
      outboundTaskBlocker?.blocker_code || outboundException?.action_taken || (outboundMissingDocTypes.length ? `补齐 ${outboundMissingDocTypes.join(' / ')}` : '保持文件冻结')
    ),
    buildDocumentGate(
      'HG-05',
      '装机确认 -> 放行',
      'ULD / 机位 / 司机',
      '允许 Loaded / Airborne 确认',
      'Export Supervisor / Station Supervisor',
      primaryOutboundFlight,
      openTasks.filter((item: any) => item.related_object_type === 'Flight' && item.related_object_id === String(primaryOutboundFlight?.flight_id || '') && !COMPLETED_TASK_STATUSES.has(item.task_status)).length ? ['装机确认'] : [],
      outboundTaskBlocker?.blocker_code || outboundException?.root_cause || '',
      outboundTaskBlocker?.blocker_code || outboundException?.action_taken || '补齐装机确认并回写机坪状态'
    ),
    buildDocumentGate(
      'HG-08',
      'Loaded -> 航班放行',
      'Loaded / Supervisor 确认',
      '允许机坪放行和后续关单',
      'Export Supervisor',
      primaryOutboundFlight,
      outboundMissingDocTypes.length ? outboundMissingDocTypes : [],
      outboundTaskBlocker?.blocker_code || outboundException?.root_cause || '',
      outboundTaskBlocker?.blocker_code || outboundException?.action_taken || '完成门槛复核并放行'
    )
  ];

  const stationTaskTimelineRows = [
    {
      label: '任务接入',
      metric: `${tasks.length} 个任务`,
      note: tasks.length ? `${openTasks.length} 个任务仍在流转中` : '暂无站内任务',
      progress: tasks.length ? 100 : 0
    },
    {
      label: '门槛评估',
      metric: `${stationTaskInboundDocumentGates.filter((item) => item.status !== '运行中').length + stationTaskOutboundDocumentGates.filter((item) => item.status !== '运行中').length} 个待处理门槛`,
      note: '站点级文档、计数和放行门槛已统一评估',
      progress: 78
    },
    {
      label: '异常联动',
      metric: `${openExceptions.length} 个开放异常`,
      note: openExceptions.length ? '异常摘要已挂接到任务卡片' : '当前没有开放异常',
      progress: openExceptions.length ? 56 : 100
    },
    {
      label: '执行闭环',
      metric: `${tasks.filter((item: any) => COMPLETED_TASK_STATUSES.has(item.task_status)).length} 个已完成`,
      note: '完成、复核和关闭状态均从后端汇总',
      progress: tasks.length ? clampNumber(Math.round((tasks.filter((item: any) => COMPLETED_TASK_STATUSES.has(item.task_status)).length / Math.max(tasks.length, 1)) * 100), 0, 100) : 0
    }
  ];

  const taskGateEvaluationRows = stationTasks.flatMap((task: any, index: number) => {
    const relatedException = exceptionByTaskId.get(task.id) || (task.exceptionId ? exceptions.find((item: any) => item.exception_id === task.exceptionId) : null);
    const gateId = task.gateIds[0] || relatedException?.exception_id || `HG-TASK-${index + 1}`;
    const blockerReason = task.blocker !== '无' ? task.blocker : relatedException?.root_cause || relatedException?.action_taken || task.title;
    return [
      {
        id: `${task.id}-${gateId}`,
        gateId,
        node: task.node,
        required: task.role || '任务角色',
        impact: task.status === 'Completed' || task.status === 'Verified' || task.status === 'Closed' ? '已满足' : '待确认',
        status: task.status === 'Completed' || task.status === 'Verified' || task.status === 'Closed' ? '运行中' : '待处理',
        blocker: blockerReason,
        recovery: relatedException?.action_taken || task.blocker || '完成任务并回写状态',
        releaseRole: task.role === '--' ? 'Station Supervisor' : task.role,
        title: `${task.title} · ${gateId}`,
        description: blockerReason,
        meta: `恢复动作：${relatedException?.action_taken || task.blocker || '完成任务并回写状态'} · 放行角色：${task.role === '--' ? 'Station Supervisor' : task.role}`,
        actions: [
          { label: '对象详情', to: task.objectTo, variant: 'outlined' },
          { label: '单证中心', to: '/station/documents', variant: 'outlined' },
          { label: '异常中心', to: '/station/exceptions', variant: 'outlined' }
        ]
      }
    ];
  });

  const stationTaskExceptionRows = exceptions.map((item: any) => ({
    id: item.exception_id,
    title: item.exception_type,
    status: item.exception_status,
    blocker: item.blocker_flag ? '阻断中' : '-',
    summary: item.root_cause || item.action_taken || item.exception_type,
    objectTo:
      item.related_object_type === 'Flight'
        ? `/station/inbound/flights/${encodeURIComponent(relatedObjectLabel(item))}`
        : item.related_object_type === 'AWB'
          ? `/station/inbound/waybills/${encodeURIComponent(relatedObjectLabel(item))}`
          : '/station/exceptions'
  }));

  const demoTasks = toArray<any>(fallbackPayloads['sinoport-adapters.stationTaskBoard']).map((item: any) => ({
    id: String(item?.id || item?.taskId || '').trim(),
    title: String(item?.title || item?.taskType || '任务').trim(),
    node: String(item?.node || item?.executionNode || '').trim(),
    role: String(item?.role || '').trim() || '--',
    owner: String(item?.owner || '').trim() || '--',
    due: String(item?.due || '').trim() || '--',
    priority: String(item?.priority || 'P3').trim() || 'P3',
    status: String(item?.status || '待处理').trim(),
    gateIds: Array.isArray(item?.gateIds) ? item.gateIds : [],
    blocker: String(item?.blocker || '无').trim() || '无',
    objectTo: String(item?.objectTo || '/station/shipments').trim(),
    exceptionId: String(item?.exceptionId || '').trim(),
    openExceptionCount: Number(item?.openExceptionCount || 0)
  }));

  const demoReviewQueue = toArray<any>(fallbackPayloads['sinoport-adapters.stationReviewQueue']);
  const demoBlockerQueue = toArray<any>(fallbackPayloads['sinoport-adapters.stationBlockerQueue']);
  const demoInboundDocumentGates = toArray<any>(fallbackPayloads['sinoport-adapters.inboundDocumentGates']);
  const demoOutboundDocumentGates = toArray<any>(fallbackPayloads['sinoport-adapters.outboundDocumentGates']);
  const demoTimelineRows = toArray<any>(fallbackPayloads['sinoport-adapters.scenarioTimelineRows']);
  const demoExceptions = toArray<any>(fallbackPayloads['sinoport-adapters.exceptionDetailRows']);

  return {
    stationTasks: stationTasks.length ? stationTasks : demoTasks,
    stationTaskSummaryCards: summaryCards,
    stationTaskBlockerQueue: stationTaskBlockerQueue.length ? stationTaskBlockerQueue : demoBlockerQueue,
    stationTaskReviewQueue: stationTaskReviewQueue.length ? stationTaskReviewQueue : demoReviewQueue,
    stationTaskInboundDocumentGates: stationTaskInboundDocumentGates.length ? stationTaskInboundDocumentGates : demoInboundDocumentGates,
    stationTaskOutboundDocumentGates: stationTaskOutboundDocumentGates.length ? stationTaskOutboundDocumentGates : demoOutboundDocumentGates,
    stationTaskTimelineRows: stationTaskTimelineRows.length ? stationTaskTimelineRows : demoTimelineRows,
    stationTaskGateEvaluationRows: taskGateEvaluationRows.length ? taskGateEvaluationRows : demoReviewQueue,
    stationTaskExceptionRows: stationTaskExceptionRows.length ? stationTaskExceptionRows : demoExceptions
  };
}

function normalizeStationExceptionObjectTo(item: { related_object_type: string; related_object_id: string; related_object_label?: string | null }) {
  if (item.related_object_type === 'Flight') {
    const flightNo = String(item.related_object_label || '').split(' / ')[0] || item.related_object_id;
    return flightNo ? `/station/inbound/flights/${encodeURIComponent(flightNo)}` : '/station/inbound/flights';
  }

  if (item.related_object_type === 'AWB') {
    const awbNo = String(item.related_object_label || '').split(' / ')[0] || item.related_object_id;
    return awbNo ? `/station/inbound/waybills/${encodeURIComponent(awbNo)}` : '/station/inbound/waybills';
  }

  if (item.related_object_type === 'Task') {
    return '/station/tasks';
  }

  return '/station/shipments';
}

function normalizeStationExceptionJumpTo(item: {
  gate_id?: string | null;
  related_object_type: string;
  related_object_id: string;
  related_object_label?: string | null;
}) {
  if (item.gate_id === 'HG-01') {
    return '/station/documents';
  }

  if (item.gate_id === 'HG-03' || item.related_object_type === 'Task') {
    return '/station/tasks';
  }

  if (item.gate_id === 'HG-06') {
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

  if (item.gate_id === 'HG-01') return '机坪放行 / 飞走归档';
  if (item.gate_id === 'HG-03') return 'NOA 发送 / 二次转运任务';
  if (item.gate_id === 'HG-06') return '交付关闭 / Closed';
  if (item.related_object_type === 'Task') return '任务恢复 / 重新校验';

  return item.exception_type;
}

function buildStationExceptionOverviewCards(items: Array<{ exception_status: string; blocker_flag: boolean; severity: string }>) {
  const openCount = items.filter((item) => item.exception_status === 'Open').length;
  const blockingCount = items.filter((item) => item.blocker_flag).length;
  const p1Count = items.filter((item) => item.severity === 'P1').length;
  const resolvedCount = items.filter((item) => ['Resolved', 'Closed'].includes(item.exception_status)).length;

  return [
    { title: '开放异常', value: String(openCount), helper: '当前待处理异常', chip: 'Open', color: 'warning' },
    { title: '阻断异常', value: String(blockingCount), helper: '会阻断主链推进', chip: 'Block', color: 'error' },
    { title: 'P1 异常', value: String(p1Count), helper: '高优先级异常', chip: 'Priority', color: 'secondary' },
    { title: '已恢复/关闭', value: String(resolvedCount), helper: `总异常 ${items.length}`, chip: 'Closed', color: 'success' }
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
  const gateId = String(detail.gate_id || '').trim() || 'EXC';
  const summary = [
    {
      gate_id: gateId,
      node: String(detail.exception_type || '异常').trim(),
      required: String(detail.required_gate || '需完成异常恢复与复核').trim(),
      impact: detail.blocker_flag ? '当前阻断主链推进' : '当前不阻断主链',
      status: String(detail.exception_status || 'Open').trim(),
      blocker: String(detail.root_cause || '').trim(),
      recovery: String(detail.recovery_action || detail.action_taken || '').trim(),
      release_role: String(detail.owner_role || '').trim()
    }
  ];

  const blocked = detail.blocker_flag ? 1 : 0;

  return {
    gate_policy_summary: summary,
    gate_policy_overview: {
      total: summary.length,
      blocked,
      tracked: Math.max(summary.length - blocked, 0),
      gate_ids: summary.map((item) => item.gate_id)
    }
  };
}

function buildStationExceptionBlockerQueue(items: Array<{ exception_id: string; exception_status: string; blocker_flag: boolean; severity: string; exception_type: string; related_object_label: string; root_cause?: string; action_taken?: string | null; related_object_type: string; opened_at?: string; gate_id?: string | null; linked_task_label?: string | null }>) {
  return items
    .filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) && item.blocker_flag)
    .slice(0, 4)
    .map((item) => ({
      id: item.exception_id,
      gateId: item.gate_id || 'HG-03',
      title: `${item.gate_id || 'HG-03'} · ${item.related_object_label || item.exception_type}`,
      description: item.root_cause || item.action_taken || item.exception_type,
      status: '阻塞'
    }));
}

function buildStationExceptionRecoveryRows(items: Array<{
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
}>) {
  return items
    .filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status))
    .sort((left, right) => {
      if (left.blocker_flag !== right.blocker_flag) return left.blocker_flag ? -1 : 1;
      const leftSeverity = left.severity === 'P1' ? 0 : left.severity === 'P2' ? 1 : 2;
      const rightSeverity = right.severity === 'P1' ? 0 : right.severity === 'P2' ? 1 : 2;
      if (leftSeverity !== rightSeverity) return leftSeverity - rightSeverity;
      return String(right.opened_at || '').localeCompare(String(left.opened_at || ''));
    })
    .slice(0, 4)
    .map((item) => {
      const objectTo = normalizeStationExceptionObjectTo(item);

      return {
        id: item.exception_id,
        type: item.exception_type,
        object: item.related_object_label || item.related_object_id,
        owner: [item.owner_role, item.owner_team_id].filter(Boolean).join(' / ') || '--',
        sla: item.severity,
        status: item.exception_status,
        blockedTask: normalizeStationExceptionBlockedTask(item),
        gateId: item.gate_id || 'HG-03',
        requiredGate: item.required_gate || '需补齐阻断项后才可放行',
        recoveryAction: item.recovery_action || item.root_cause || '待补充恢复动作',
        detailTo: `/station/exceptions/${item.exception_id}`,
        objectTo,
        jumpTo: normalizeStationExceptionJumpTo(item)
      };
    });
}

async function loadStationExceptionsOverview(services: StationServices, query: Record<string, string | undefined>) {
  const list = await services.listStationExceptions(query);
  const items = list.items || [];
  const detailEntries = await Promise.all(
    items.map(async (item) => {
      const detail = await services.getStationException(item.exception_id);
      return [item.exception_id, detail] as const;
    })
  );
  const detailById = new Map<string, any>(detailEntries.filter(([, detail]) => Boolean(detail)) as Array<readonly [string, any]>);

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
      recovery_action: detail?.recovery_action || detail?.action_taken || item.root_cause || null,
      linked_task_label: detail?.linked_task_label || null
    };
  });

  return {
    stationExceptions: normalizedItems.map((item) => ({
      id: item.exception_id,
      type: item.exception_type,
      object: item.related_object_label || item.related_object_id,
      owner: [item.owner_role, item.owner_team_id].filter(Boolean).join(' / ') || '--',
      sla: item.severity,
      blockedTask: normalizeStationExceptionBlockedTask(item),
      recoveryAction: item.recovery_action || item.root_cause || '待补充恢复动作',
      status: item.exception_status,
      objectTo: normalizeStationExceptionObjectTo(item),
      jumpTo: normalizeStationExceptionJumpTo(item),
      detailTo: `/station/exceptions/${item.exception_id}`
    })),
    stationExceptionOverview: buildStationExceptionOverviewCards(normalizedItems),
    stationBlockerQueue: buildStationExceptionBlockerQueue(normalizedItems),
    stationRecoveryRows: buildStationExceptionRecoveryRows(normalizedItems),
    page: list.page,
    page_size: list.page_size,
    total: list.total
  };
}

function toObject<T extends Record<string, unknown>>(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : null;
}

function toArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeControlLevel(value: string | null | undefined) {
  if (!value) return '--';
  return CONTROL_LEVEL_LABELS[value] || value;
}

function normalizePhase(value: string | null | undefined) {
  if (!value) return '--';
  return PHASE_LABELS[value] || value;
}

function formatOverviewTime(value: unknown) {
  if (!value) return '--';

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) {
    return text.slice(0, 16);
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function formatDashboardClock(value: unknown) {
  if (!value) return '--';

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
  return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
}

function buildShipmentGatePolicySummary(detail: any, gateEvaluationRows: any[], hardGatePolicyRows: any[]) {
  const gateIds = new Set<string>();
  const exceptions = Array.isArray(detail?.exceptions) ? detail.exceptions : [];

  const pushGateId = (value: unknown) => {
    const gateId = String(value || '').trim();
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

  for (const item of gateEvaluationRows) {
    if (Array.isArray(item?.linkedShipmentIds) && item.linkedShipmentIds.includes(detail?.id)) {
      pushGateId(item?.gateId || item?.gate_id);
    }
  }

  const policyByGateId = new Map(
    hardGatePolicyRows.map((item: any) => {
      const gateId = String(item?.id || item?.gateId || '').trim();
      return [gateId, item] as const;
    })
  );

  const relevantGateRows = gateEvaluationRows.filter((item) => Array.isArray(item?.linkedShipmentIds) && item.linkedShipmentIds.includes(detail?.id));
  const evaluationSourceRows = relevantGateRows.length ? relevantGateRows : gateEvaluationRows;
  const evaluationByGateId = new Map<string, any>();
  for (const item of evaluationSourceRows) {
    const gateId = String(item?.gateId || item?.gate_id || '').trim();
    if (!gateId || evaluationByGateId.has(gateId)) continue;
    evaluationByGateId.set(gateId, item);
  }

  const openExceptionByGateId = new Map<string, any>();
  for (const item of exceptions) {
    const gateId = String(item?.gate_id || item?.gateId || '').trim();
    if (!gateId) continue;
    const status = String(item?.status || item?.exception_status || '').trim();
    if (['Resolved', 'Closed', '已关闭', '已恢复'].includes(status)) continue;
    if (!openExceptionByGateId.has(gateId)) {
      openExceptionByGateId.set(gateId, item);
    }
  }

  const summary = Array.from(gateIds).map((gateId) => {
    const evaluation = evaluationByGateId.get(gateId);
    const policy = policyByGateId.get(gateId);
    const blocker = String(evaluation?.blockingReason || evaluation?.blocker || openExceptionByGateId.get(gateId)?.note || policy?.blocker || '').trim();
    const recovery = String(evaluation?.recoveryAction || evaluation?.recovery || policy?.recovery || openExceptionByGateId.get(gateId)?.note || '').trim();
    const node = String(evaluation?.node || policy?.triggerNode || 'Shipment Gate').trim();
    const required = String(evaluation?.required || policy?.rule || '需补齐文件、任务或异常恢复动作').trim();
    const impact = String(evaluation?.impact || policy?.blocker || '会影响履约链路推进').trim();
    const releaseRole = String(evaluation?.releaseRole || policy?.releaseRole || '').trim();
    const status = String(evaluation?.status || (openExceptionByGateId.has(gateId) ? 'Open' : 'Tracked')).trim();

    return {
      gate_id: gateId,
      node,
      required,
      impact,
      status,
      blocker,
      recovery,
      release_role: releaseRole
    };
  });

  const blocked = summary.filter((item) => ['Open', 'Blocked', '阻塞', '待处理', '待升级', '警戒'].includes(String(item.status)) || Boolean(item.blocker)).length;

  return {
    gate_policy_summary: summary,
    gate_policy_overview: {
      total: summary.length,
      blocked,
      tracked: Math.max(summary.length - blocked, 0),
      gate_ids: summary.map((item) => item.gate_id)
    }
  };
}

function normalizeDashboardTaskStatus(status: string) {
  if (status === 'Completed' || status === 'Verified' || status === 'Closed') return '已完成';
  if (status === 'Started') return '处理中';
  if (status === 'Accepted' || status === 'Assigned' || status === 'Created') return '待复核';
  return status || '待处理';
}

function normalizeResourceStatus(value: unknown) {
  const text = String(value || '').trim();

  if (!text) return '待处理';

  const lower = text.toLowerCase();
  if (text === '运行中' || lower === 'active' || lower === 'running' || lower === 'online' || lower === 'enabled') return '运行中';
  if (text === '警戒' || lower === 'warning' || lower === 'warn' || lower === 'attention') return '警戒';
  if (text === '停用' || lower === 'inactive' || lower === 'disabled' || lower === 'offline') return '停用';
  if (text === '待处理' || lower === 'pending' || lower === 'draft' || lower === 'queued') return '待处理';

  return text;
}

function normalizeShiftLabel(value: unknown) {
  const text = String(value || '').trim();

  if (!text) return '待定';

  const lower = text.toLowerCase();
  if (text === '白班' || lower === 'day' || lower === 'day_shift') return '白班';
  if (text === '夜班' || lower === 'night' || lower === 'night_shift') return '夜班';
  if (text === '中班' || lower === 'swing' || lower === 'mid') return '中班';

  return text;
}

function belongsToStation(row: { station?: string; station_id?: string }, stationId: string) {
  const rowStation = String(row.station_id || row.station || '').trim();
  return !rowStation || rowStation === stationId;
}

function mapResourceTeamRow(row: ResourceTeamRow) {
  return {
    id: String(row.id || row.team_id || row.team_name || row.name || 'TEAM-UNKNOWN'),
    name: String(row.name || row.team_name || row.id || row.team_id || '未命名班组'),
    shift: String(row.shift || normalizeShiftLabel(row.shift_code)),
    owner: String(row.owner || row.owner_name || row.team_name || row.name || '未指定'),
    status: normalizeResourceStatus(row.status || row.team_status)
  };
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
    status: normalizeResourceStatus(row.team_status)
  };
}

function mapResourceZoneRow(row: ResourceZoneRow, stationId: string) {
  return {
    zone: String(row.zone || 'ZONE-UNKNOWN'),
    station: String(row.station || row.station_id || stationId),
    type: String(row.type || '未指定'),
    status: normalizeResourceStatus(row.status),
    ...(row.note ? { note: String(row.note) } : {})
  };
}

function mapResourceDeviceRow(row: ResourceDeviceRow, stationId: string) {
  return {
    code: String(row.code || row.device || 'DEVICE-UNKNOWN'),
    station: String(row.station || row.station_id || stationId),
    owner: String(row.owner || row.role || '未指定'),
    status: normalizeResourceStatus(row.status)
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
    DashboardDocumentRow[]
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
            `
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
            `
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
            `
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
            `
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as DashboardExceptionRow[]),
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
            `
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as DashboardLoadingPlanRow[]),
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
            `
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as DashboardDocumentRow[])
      ])
    : [[], [], [], [], [], []];

  const flightById = new Map<string, DashboardFlightRow>(flights.map((item) => [item.flight_id, item] as const));
  const flightByNo = new Map<string, DashboardFlightRow>(flights.map((item) => [item.flight_no, item] as const));
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
    if (task.related_object_type !== 'Flight') continue;
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
      const totalPieces = flightAwbs.reduce((sum, awb) => sum + Number(awb.pieces || 0), 0);
      const totalWeight = flightAwbs.reduce((sum, awb) => sum + Number(awb.gross_weight || 0), 0);
      const manifestStatus = manifest?.document_status || flightAwbs.find((awb) => awb.manifest_status && awb.manifest_status !== 'Pending')?.manifest_status || '待生成';
      const stage = openTasks[0]?.execution_node || (manifest?.document_status === 'Approved' ? '主单完成' : manifest ? '待 Manifest' : item.runtime_status);

      return {
        flightNo: item.flight_no,
        etd: formatDashboardClock(item.etd_at),
        status: item.runtime_status,
        stage,
        manifest: manifestStatus,
        cargo: `${flightAwbs.length} AWB / ${totalPieces} pcs / ${formatDashboardWeight(totalWeight)} kg`
      };
    });

  const inboundFlights = flights
    .filter((item) => item.destination_code === stationId)
    .map((item) => {
      const flightAwbs = awbsByFlightId.get(item.flight_id) || [];
      const openTasks = tasksByFlightId.get(item.flight_id) || [];
      const totalPieces = flightAwbs.reduce((sum, awb) => sum + Number(awb.pieces || 0), 0);
      const totalWeight = flightAwbs.reduce((sum, awb) => sum + Number(awb.gross_weight || 0), 0);
      const blockerTask = openTasks.find((task) => task.blocker_code);

      return {
        flightNo: item.flight_no,
        eta: formatDashboardClock(item.eta_at),
        step: blockerTask?.execution_node || openTasks[0]?.execution_node || item.runtime_status,
        priority: item.service_level || (blockerTask ? 'P1' : 'P2'),
        cargo: `${totalPieces} pcs / ${formatDashboardWeight(totalWeight)} kg`
      };
    });

  const stationDashboardCards = [
    {
      title: '今日进港航班',
      value: String(inboundFlights.length),
      helper: '当前站点入港处理批次',
      chip: 'Inbound',
      color: 'primary'
    },
    {
      title: '今日出港航班',
      value: String(outboundFlights.length),
      helper: '当前站点出港协同批次',
      chip: 'Outbound',
      color: 'secondary'
    },
    {
      title: '待发 NOA',
      value: String(awbs.filter((item) => item.noa_status === 'Pending').length),
      helper: '已到站但未触发 NOA 的 AWB',
      chip: 'Queue',
      color: 'warning'
    },
    {
      title: '待补 POD',
      value: String(awbs.filter((item) => item.pod_status === 'Pending' || item.pod_status === 'Missing').length),
      helper: '已交付但签收未归档的 AWB',
      chip: 'Action',
      color: 'error'
    }
  ];

  const relatedObjectLabel = (item: { related_object_type: string; related_object_id: string }) => {
    if (item.related_object_type === 'Flight') {
      return flightById.get(item.related_object_id)?.flight_no || flightByNo.get(item.related_object_id)?.flight_no || item.related_object_id;
    }

    if (item.related_object_type === 'AWB') {
      return awbs.find((awb) => awb.awb_id === item.related_object_id || awb.awb_no === item.related_object_id)?.awb_no || item.related_object_id;
    }

    return item.related_object_id;
  };

  const stationBlockerQueue = [
    ...tasks
      .filter((item) => !COMPLETED_TASK_STATUSES.has(item.task_status) && Boolean(item.blocker_code))
      .slice(0, 4)
      .map((item) => ({
        id: item.task_id,
        title: `${relatedObjectLabel(item)} · ${item.blocker_code || item.task_type}`,
        description: item.execution_node || item.task_type,
        status: '阻塞',
        meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`
      })),
    ...exceptions
      .filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) && Boolean(Number(item.blocker_flag)))
      .slice(0, 4)
      .map((item) => ({
        id: item.exception_id,
        title: `${relatedObjectLabel(item)} · ${item.exception_type}`,
        description: item.root_cause || item.action_taken || item.exception_type,
        status: '警戒',
        meta: `${item.severity} · ${formatOverviewTime(item.opened_at)}`
      }))
  ].slice(0, 4);

  const stationReviewQueue = tasks
    .filter((item) => !COMPLETED_TASK_STATUSES.has(item.task_status))
    .sort((left, right) => (left.due_at || '9999-12-31').localeCompare(right.due_at || '9999-12-31'))
    .slice(0, 4)
    .map((item) => ({
      id: item.task_id,
      title: item.task_type,
      description: `${item.execution_node} · ${relatedObjectLabel(item)}`,
      status: normalizeDashboardTaskStatus(item.task_status),
      meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`
    }));

  const stationTransferRows = loadingPlans
    .map((item) => {
      const flight = flights.find((flightRow) => flightRow.flight_no === item.flight_no);
      const flightAwbs = flight ? awbsByFlightId.get(flight.flight_id) || [] : [];
      const awbNo = flightAwbs[0]?.awb_no || '--';

      return {
        transferId: item.loading_plan_id,
        awb: awbNo,
        destination: flight?.destination_code || '--',
        plate: item.truck_plate,
        driver: item.driver_name || '--',
        departAt: formatDashboardClock(item.depart_time || item.arrival_time || item.created_at),
        status: item.plan_status
      };
    })
    .slice(0, 3);

  const fallbackPayloads = await loadDemoDatasetPayloads(db, [
    'sinoport.inboundFlights',
    'sinoport.outboundFlights',
    'sinoport-adapters.stationBlockerQueue',
    'sinoport-adapters.stationDashboardCards',
    'sinoport-adapters.stationReviewQueue',
    'sinoport-adapters.stationTransferRows'
  ]);

  return {
    stationDashboardCards: stationDashboardCards.length ? stationDashboardCards : toArray(fallbackPayloads['sinoport-adapters.stationDashboardCards']),
    inboundFlights: inboundFlights.length ? inboundFlights : toArray(fallbackPayloads['sinoport.inboundFlights']),
    outboundFlights: outboundFlights.length ? outboundFlights : toArray(fallbackPayloads['sinoport.outboundFlights']),
    stationBlockerQueue: stationBlockerQueue.length ? stationBlockerQueue : toArray(fallbackPayloads['sinoport-adapters.stationBlockerQueue']),
    stationReviewQueue: stationReviewQueue.length ? stationReviewQueue : toArray(fallbackPayloads['sinoport-adapters.stationReviewQueue']),
    stationTransferRows: stationTransferRows.length ? stationTransferRows : toArray(fallbackPayloads['sinoport-adapters.stationTransferRows'])
  };
}

async function loadStationOutboundOverview(db: any, stationId: string) {
  const [flights, awbs, tasks, exceptions, documents, loadingPlans, receipts, containers, containerItems]: [any[], any[], any[], any[], any[], any[], any[], any[], any[]] = db
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
            `
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
            `
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
            `
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
            `
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
            `
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
            `
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
            `
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
            `
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
            `
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      ])
    : [[], [], [], [], [], [], [], [], []];

  const flightById = new Map<string, any>(flights.map((item) => [String(item.flight_id), item] as const));
  const flightByNo = new Map<string, any>(flights.map((item) => [String(item.flight_no), item] as const));
  const awbByNo = new Map<string, any>(awbs.map((item) => [String(item.awb_no), item] as const));
  const awbsByFlightId = new Map<string, any[]>();
  const tasksByFlightId = new Map<string, any[]>();
  const documentsByFlightId = new Map<string, any[]>();
  const loadingPlansByFlightNo = new Map<string, any[]>();
  const receiptsByAwbNo = new Map<string, any>();
  const containersByFlightNo = new Map<string, any[]>();
  const containerById = new Map<string, any>();
  const containerItemsByContainerId = new Map<string, any[]>();

  for (const awb of awbs) {
    const flightId = String(awb.flight_id || '');
    if (!awbsByFlightId.has(flightId)) {
      awbsByFlightId.set(flightId, []);
    }
    awbsByFlightId.get(flightId)?.push(awb);
  }

  for (const task of tasks) {
    if (task.related_object_type === 'Flight') {
      const flightId = String(task.related_object_id || '');
      if (!tasksByFlightId.has(flightId)) {
        tasksByFlightId.set(flightId, []);
      }
      tasksByFlightId.get(flightId)?.push(task);
    }

    if (task.related_object_type === 'AWB') {
      continue;
    }
  }

  for (const document of documents) {
    if (document.related_object_type === 'Flight') {
      const flightId = String(document.related_object_id || '');
      if (!documentsByFlightId.has(flightId)) {
        documentsByFlightId.set(flightId, []);
      }
      documentsByFlightId.get(flightId)?.push(document);
    }

    if (document.related_object_type === 'AWB') {
      continue;
    }
  }

  for (const plan of loadingPlans) {
    const flightNo = String(plan.flight_no || '');
    if (!loadingPlansByFlightNo.has(flightNo)) {
      loadingPlansByFlightNo.set(flightNo, []);
    }
    loadingPlansByFlightNo.get(flightNo)?.push(plan);
  }

  for (const receipt of receipts) {
    receiptsByAwbNo.set(String(receipt.awb_no || ''), receipt);
  }

  for (const container of containers) {
    containerById.set(String(container.container_id || ''), container);
    const flightNo = String(container.flight_no || '');
    if (!containersByFlightNo.has(flightNo)) {
      containersByFlightNo.set(flightNo, []);
    }
    containersByFlightNo.get(flightNo)?.push(container);
  }

  for (const item of containerItems) {
    const containerId = String(item.container_id || '');
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
      const flightDocuments = documentsByFlightId.get(String(item.flight_id)) || [];
      const flightPlans = loadingPlansByFlightNo.get(String(item.flight_no)) || [];
      const totalPieces = flightAwbs.reduce((sum, awb) => sum + Number(awb.pieces || 0), 0);
      const totalWeight = flightAwbs.reduce((sum, awb) => sum + Number(awb.gross_weight || 0), 0);
      const manifestDocument = flightDocuments.find((doc) => doc.document_type === 'Manifest' && ['Uploaded', 'Released', 'Approved', 'Accepted', 'Verified', 'Closed'].includes(String(doc.document_status)));
      const manifestStatus =
        manifestDocument?.document_status ||
        flightAwbs.find((awb) => awb.manifest_status && awb.manifest_status !== 'Pending')?.manifest_status ||
        (flightDocuments.some((doc) => doc.document_type === 'Manifest') ? '已导入' : '待生成');
      const stage =
        flightTasks.find((task) => !COMPLETED_TASK_STATUSES.has(String(task.task_status)))?.execution_node ||
        (flightPlans.some((plan) => ['计划', '待处理', '待确认'].includes(String(plan.plan_status))) ? '装载待处理' : flightPlans.length ? '装载中' : manifestDocument ? '主单完成' : item.runtime_status);

      return {
        flightNo: item.flight_no,
        etd: formatDashboardClock(item.etd_at),
        status: item.runtime_status,
        stage,
        manifest: manifestStatus,
        cargo: `${flightAwbs.length} AWB / ${totalPieces} pcs / ${formatDashboardWeight(totalWeight)} kg`
      };
    });

  const outboundAwbs = awbs.filter((item) => flightById.get(String(item.flight_id))?.origin_code === stationId);

  const manifestRows = outboundAwbs.slice(0, 8).map((awb) => {
    const flight = flightById.get(String(awb.flight_id));
    const flightNo = flight?.flight_no || '--';
    const flightContainers = containersByFlightNo.get(String(flightNo)) || [];
    const container = flightContainers[0];
    const uld = container?.container_code || 'BULK';
    const type = String(uld).startsWith('PMC') ? 'CONSOL' : 'BULK';

    return {
      flightNo,
      uld,
      awb: awb.awb_no,
      pieces: Number(awb.pieces || 0),
      weight: Number(awb.gross_weight || 0).toFixed(1),
      route: flight ? `${flight.origin_code} → ${flight.destination_code}` : '--',
      type
    };
  });

  const ffmForecastRows = outboundAwbs.slice(0, 8).map((awb) => {
    const flight = flightById.get(String(awb.flight_id));
    const flightContainers = flight ? containersByFlightNo.get(String(flight.flight_no)) || [] : [];
    const container = flightContainers[0];

    return {
      awb: awb.awb_no,
      destination: flight?.destination_code || '--',
      pieces: Number(awb.pieces || 0),
      weight: `${formatDashboardWeight(Number(awb.gross_weight || 0))} kg`,
      goods: awb.goods_description || awb.current_node || '待补充',
      uld: container?.container_code || 'BULK'
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
      result: receipt ? receipt.receipt_status || (diffPieces === 0 && diffWeight === 0 ? '运行中' : '警戒') : '待处理',
      issue:
        receipt?.note ||
        (diffPieces === 0 && diffWeight === 0
          ? '无差异'
          : `件数差 ${diffPieces > 0 ? '+' : ''}${diffPieces} / 重量差 ${diffWeight > 0 ? '+' : ''}${diffWeight} kg`)
    };
  });

  const masterAwbRows = outboundAwbs.slice(0, 7).map((awb) => {
    const flight = flightById.get(String(awb.flight_id));

    return {
      awb: awb.awb_no,
      shipper: awb.shipper_name || awb.current_node || '--',
      consignee: awb.consignee_name || '--',
      route: flight ? `${flight.origin_code} → ${flight.destination_code}` : '--',
      pcs: Number(awb.pieces || 0),
      weight: `${formatDashboardWeight(Number(awb.gross_weight || 0))} kg`
    };
  });

  const uwsRows = (containerItems.length ? containerItems : outboundAwbs.slice(0, 4)).slice(0, 4).map((item) => {
    const container = item.container_id ? containerById.get(String(item.container_id)) : null;
    const flight = container ? flightByNo.get(String(container.flight_no)) : flightById.get(String(item.flight_id || ''));
    const awbNo = String(item.awb_no || item.awb || '--');
    const matchedAwb = awbByNo.get(awbNo);

    return {
      awb: awbNo,
      uld: container?.container_code || 'BULK',
      pcs: Number(item.pieces || matchedAwb?.pieces || 0),
      weight: String(formatDashboardWeight(Number(item.weight || matchedAwb?.gross_weight || 0))),
      pod: container?.container_status || matchedAwb?.pod_status || 'BULK',
      destination: flight?.destination_code || '--'
    };
  });

  const flightCount = outboundFlights.length;
  const awbCount = outboundAwbs.length;
  const outboundPieceTotal = outboundAwbs.reduce((sum, awb) => sum + Number(awb.pieces || 0), 0);
  const outboundWeightTotal = outboundAwbs.reduce((sum, awb) => sum + Number(awb.gross_weight || 0), 0);
  const receivedCount = receiptRows.filter((item) => item.result !== '待处理' && item.result !== 'Pending').length;
  const manifestApprovedCount = outboundFlights.filter((item) => item.manifest !== '待生成' && item.manifest !== 'Pending').length;
  const airborneCount = flights.filter((item) => item.origin_code === stationId && ['Airborne', 'Completed', 'Closed'].includes(String(item.runtime_status))).length;
  const loadingCount = loadingPlans.filter((item) => !['计划', '待处理', '待确认'].includes(String(item.plan_status))).length;
  const destinationCount = new Set(outboundFlights.map((item) => flightByNo.get(item.flightNo)?.destination_code).filter(Boolean)).size;

  const manifestSummary = {
    version:
      documents.find((item) => item.document_type === 'Manifest' && item.related_object_type === 'Flight' && item.document_status !== 'Pending')?.version_no ||
      documents.find((item) => item.document_type === 'Manifest' && item.related_object_type === 'Flight')?.updated_at?.slice(5, 10)?.replace('-', '') ||
      'Manifest 待生成',
    exchange: loadingPlans.length ? '装载计划 + 文档回写' : 'DB 聚合 + 文档回写',
    outboundCount: `${awbCount} AWB / ${outboundPieceTotal} pcs / ${formatDashboardWeight(outboundWeightTotal)} kg`,
    destinationCount: destinationCount > 0 ? `${destinationCount} 个目的港` : '待目的港回传'
  };

  const outboundDocumentGates = [
    {
      gateId: 'HG-01',
      node: '货物预报 -> 主单冻结',
      required: 'FFM / Manifest / 主单对账',
      impact: '允许装载编排与飞走归档',
      status: awbCount && manifestApprovedCount >= flightCount ? '运行中' : '待处理',
      blocker: awbCount && manifestApprovedCount >= flightCount ? '预报与主单已进入收口' : '等待 FFM 与主单数据进入',
      recovery: awbCount && manifestApprovedCount >= flightCount ? '保持文档版本冻结' : '补齐预报并生成主单'
    },
    {
      gateId: 'HG-04',
      node: '主单 -> 装载放行',
      required: 'Loaded / 车牌 / 司机',
      impact: '允许装载与航空器放行',
      status: loadingPlans.length ? '警戒' : '运行中',
      blocker: loadingPlans.length ? loadingPlans[0].note || loadingPlans[0].collection_note || '装载计划已创建，待最终确认' : '装载闭环已就绪',
      recovery: loadingPlans.length ? '补齐车牌、司机与复核记录' : '保持装载计划与复核记录同步',
      releaseRole: 'Document Desk / Station Supervisor'
    },
    {
      gateId: 'HG-06',
      node: '装载 -> 飞走 / 回传',
      required: 'Airborne / 回执 / 对账',
      impact: '允许关闭与目的港对账',
      status: receivedCount < awbCount || airborneCount < flightCount ? '待处理' : '运行中',
      blocker: receivedCount < awbCount ? `${awbCount - receivedCount} 票回执待补` : airborneCount < flightCount ? `${flightCount - airborneCount} 班待飞走确认` : '对账链路已就绪',
      recovery: receivedCount < awbCount ? '补齐回执并回写重量' : airborneCount < flightCount ? '完成 Loaded / Airborne 状态回写' : '保持目的港回传同步',
      releaseRole: 'Ramp Control / Delivery Desk'
    }
  ];

  const stationBlockerQueue = [
    ...tasks
      .filter((item) => !COMPLETED_TASK_STATUSES.has(String(item.task_status)) && Boolean(item.blocker_code))
      .slice(0, 2)
      .map((item) => {
        const relatedFlight = item.related_object_type === 'Flight' ? flightById.get(String(item.related_object_id)) || flightByNo.get(String(item.related_object_id)) : null;
        const relatedAwb = item.related_object_type === 'AWB' ? awbByNo.get(String(item.related_object_id)) : null;

        return {
          id: item.task_id,
          title: `${relatedFlight?.flight_no || relatedAwb?.awb_no || item.related_object_id} · ${item.blocker_code || item.task_type}`,
          description: item.execution_node || item.task_type,
          status: '阻塞',
          meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`
        };
      }),
    ...exceptions
      .filter((item) => !CLOSED_EXCEPTION_STATUSES.has(String(item.exception_status)) && Boolean(Number(item.blocker_flag)))
      .slice(0, 1)
      .map((item) => {
        const relatedFlight = item.related_object_type === 'Flight' ? flightById.get(String(item.related_object_id)) || flightByNo.get(String(item.related_object_id)) : null;
        const relatedAwb = item.related_object_type === 'AWB' ? awbByNo.get(String(item.related_object_id)) : null;

        return {
          id: item.exception_id,
          title: `${relatedFlight?.flight_no || relatedAwb?.awb_no || item.related_object_id} · ${item.exception_type}`,
          description: item.root_cause || item.action_taken || item.exception_type,
          status: '警戒',
          meta: `${item.severity} · ${formatOverviewTime(item.opened_at)}`
        };
      }),
    ...(outboundDocumentGates.filter((item) => item.status !== '运行中').slice(0, 1).map((item) => ({
      id: item.gateId,
      title: `${item.gateId} · ${item.node}`,
      description: item.blocker,
      status: item.status,
      meta: item.recovery
    })) as any[])
  ].slice(0, 4);

  const outboundLifecycleRows = [
    {
      label: '已预报',
      note: awbCount ? `${awbCount} 票 AWB 已进入预报池` : '暂无预报数据',
      progress: awbCount ? 100 : 0
    },
    {
      label: '已接收',
      note: awbCount ? `${receivedCount}/${awbCount} 票已完成接收` : '等待接收数据',
      progress: awbCount ? clampNumber(Math.round((receivedCount / Math.max(awbCount, 1)) * 100), 0, 100) : 0
    },
    {
      label: '主单完成',
      note: `${manifestApprovedCount}/${Math.max(flightCount, 1)} 班已冻结 Manifest`,
      progress: flightCount ? clampNumber(Math.round((manifestApprovedCount / flightCount) * 100), 0, 100) : 0
    },
    {
      label: '装载中',
      note: loadingCount ? `${loadingCount} 车次已进入装载流程` : '等待装载编排',
      progress: loadingPlans.length ? clampNumber(Math.round((loadingCount / Math.max(loadingPlans.length, 1)) * 100), 0, 100) : 0
    },
    {
      label: '已飞走',
      note: flightCount ? `${airborneCount}/${flightCount} 班已飞走` : '等待飞走确认',
      progress: flightCount ? clampNumber(Math.round((airborneCount / flightCount) * 100), 0, 100) : 0
    },
    {
      label: 'Manifest 回传',
      note: flightCount ? `${manifestApprovedCount}/${flightCount} 班已回传` : '等待回传',
      progress: flightCount ? clampNumber(Math.round((manifestApprovedCount / flightCount) * 100), 0, 100) : 0
    }
  ];

  const fallbackPayloads = await loadDemoDatasetPayloads(db, [
    'sinoport.outboundFlights',
    'sinoport.ffmForecastRows',
    'sinoport.manifestRows',
    'sinoport.manifestSummary',
    'sinoport.masterAwbRows',
    'sinoport.receiptRows',
    'sinoport.uwsRows',
    'sinoport-adapters.outboundDocumentGates',
    'sinoport-adapters.outboundLifecycleRows',
    'sinoport-adapters.stationBlockerQueue'
  ]);

  return {
    outboundFlights: outboundFlights.length ? outboundFlights : toArray(fallbackPayloads['sinoport.outboundFlights']),
    ffmForecastRows: ffmForecastRows.length ? ffmForecastRows : toArray(fallbackPayloads['sinoport.ffmForecastRows']),
    manifestRows: manifestRows.length ? manifestRows : toArray(fallbackPayloads['sinoport.manifestRows']),
    manifestSummary: toObject(fallbackPayloads['sinoport.manifestSummary']) || manifestSummary,
    masterAwbRows: masterAwbRows.length ? masterAwbRows : toArray(fallbackPayloads['sinoport.masterAwbRows']),
    receiptRows: receiptRows.length ? receiptRows : toArray(fallbackPayloads['sinoport.receiptRows']),
    uwsRows: uwsRows.length ? uwsRows : toArray(fallbackPayloads['sinoport.uwsRows']),
    outboundDocumentGates: outboundDocumentGates.length ? outboundDocumentGates : toArray(fallbackPayloads['sinoport-adapters.outboundDocumentGates']),
    outboundLifecycleRows: outboundLifecycleRows.length ? outboundLifecycleRows : toArray(fallbackPayloads['sinoport-adapters.outboundLifecycleRows']),
    stationBlockerQueue: stationBlockerQueue.length ? stationBlockerQueue : toArray(fallbackPayloads['sinoport-adapters.stationBlockerQueue'])
  };
}

function pickRowValue(row: any, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return null;
}

function isPendingInboundStatus(value: unknown) {
  const text = String(value || '').trim();
  return !text || ['Pending', '待处理', '待确认', '未开始', '计划'].includes(text);
}

function isDeliveredInboundStatus(value: unknown) {
  const text = String(value || '').trim();
  return ['Delivered', 'Completed', 'Closed', 'Received', 'Signed', 'Done', '已交付', '已完成'].includes(text);
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
      label: '运达',
      count: metrics.flightCount,
      note: metrics.flightCount ? `${metrics.flightCount} 班进港航班` : '暂无进港航班',
      progress: metrics.flightCount ? 100 : 0
    },
    {
      label: '已卸机',
      count: metrics.landedFlightCount,
      note: metrics.flightCount ? `${metrics.landedFlightCount}/${metrics.flightCount} 班已落地` : '等待落地数据',
      progress: clampNumber(Math.round((metrics.landedFlightCount / flightBase) * 100), 0, 100)
    },
    {
      label: '已入货站',
      count: metrics.awbCount,
      note: metrics.awbCount ? `${metrics.awbCount} 票已进入进港处理池` : '暂无入货站记录',
      progress: metrics.awbCount ? 100 : 0
    },
    {
      label: '拆板理货中',
      count: metrics.openTaskCount,
      note: metrics.openTaskCount ? `${metrics.openTaskCount} 个待完成任务` : '拆板理货已闭环',
      progress: metrics.openTaskCount ? 68 : 100
    },
    {
      label: 'NOA 已发送',
      count: metrics.noaSentCount,
      note: metrics.awbCount ? `${metrics.noaSentCount}/${metrics.awbCount} 票已触发 NOA` : '等待 AWB 数据',
      progress: metrics.awbCount ? clampNumber(Math.round((metrics.noaSentCount / awbBase) * 100), 0, 100) : 0
    },
    {
      label: '已交付',
      count: metrics.deliveredCount,
      note: metrics.awbCount ? `${metrics.deliveredCount}/${metrics.awbCount} 票已完成 POD/交付` : '等待 POD 数据',
      progress: metrics.awbCount ? clampNumber(Math.round((metrics.deliveredCount / awbBase) * 100), 0, 100) : 0
    }
  ];
}

function buildDemoInboundLifecycleRows(flights: any[], awbs: any[]) {
  const metrics = {
    flightCount: flights.length,
    landedFlightCount: flights.filter((item) => Boolean(item.actual_landed_at || item.actualLandedAt) || ['Landed', 'Arrived', 'Completed', 'Closed'].includes(String(item.runtime_status || item.runtimeStatus))).length,
    awbCount: awbs.length,
    openTaskCount: 0,
    noaSentCount: awbs.filter((item) => !isPendingInboundStatus(pickRowValue(item, ['noa_status', 'noaStatus']))).length,
    deliveredCount: awbs.filter((item) => isDeliveredInboundStatus(pickRowValue(item, ['pod_status', 'podStatus']))).length
  };

  return buildInboundLifecycleRows(metrics);
}

function buildDemoInboundDocumentGates(rows: any[]) {
  return rows
    .filter((item) => item.direction === '进港')
    .slice(0, 3)
    .map((item) => ({
      gateId: item.gateId,
      node: item.node,
      required: item.required,
      impact: item.impact,
      status: item.status,
      blocker: item.blockingReason,
      recovery: item.recoveryAction,
      releaseRole: item.releaseRole
    }));
}

async function loadStationInboundOverview(db: any, stationId: string) {
  const [flights, awbs, tasks, exceptions, loadingPlans, documents, countRecords]: [any[], any[], any[], any[], any[], any[], any[]] = db
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
            `
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
            `
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
            `
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
            `
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
            `
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
            `
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
            `
          )
          .bind(stationId)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      ])
    : [[], [], [], [], [], [], []];

  const flightById = new Map<string, any>(flights.map((item) => [item.flight_id, item] as const));
  const flightByNo = new Map<string, any>(flights.map((item) => [item.flight_no, item] as const));
  const awbsByFlightId = new Map<string, any[]>();
  const inboundFlights = flights.filter((item) => item.destination_code === stationId);

  for (const awb of awbs) {
    if (!awbsByFlightId.has(awb.flight_id)) {
      awbsByFlightId.set(awb.flight_id, []);
    }
    awbsByFlightId.get(awb.flight_id)?.push(awb);
  }

  const inboundFlightIds = new Set(inboundFlights.map((item) => item.flight_id));
  const inboundAwbs = awbs.filter((item) => inboundFlightIds.has(item.flight_id));

  const inboundFlightMetrics = buildInboundLifecycleRows({
    flightCount: inboundFlights.length,
    landedFlightCount: inboundFlights.filter((item) => Boolean(item.actual_landed_at || item.actualLandedAt) || ['Landed', 'Arrived', 'Completed', 'Closed'].includes(String(item.runtime_status || item.runtimeStatus))).length,
    awbCount: inboundAwbs.length,
    openTaskCount: tasks.filter((item) => !COMPLETED_TASK_STATUSES.has(String(item.task_status || item.taskStatus)) && (item.station_id === stationId || inboundFlightIds.has(item.related_object_id))).length,
    noaSentCount: inboundAwbs.filter((item) => !isPendingInboundStatus(pickRowValue(item, ['noa_status', 'noaStatus']))).length,
    deliveredCount: inboundAwbs.filter((item) => isDeliveredInboundStatus(pickRowValue(item, ['pod_status', 'podStatus']))).length
  });

  const relatedObjectLabel = (item: any) => {
    const relatedObjectId = String(item.related_object_id || '');

    if (item.related_object_type === 'Flight') {
      return flightById.get(relatedObjectId)?.flight_no || flightByNo.get(relatedObjectId)?.flight_no || relatedObjectId;
    }

    if (item.related_object_type === 'AWB') {
      return awbs.find((awb) => awb.awb_id === relatedObjectId || awb.awb_no === relatedObjectId)?.awb_no || relatedObjectId;
    }

    return relatedObjectId;
  };

  const stationBlockerQueue = [
    ...tasks
      .filter((item) => !COMPLETED_TASK_STATUSES.has(String(item.task_status)) && Boolean(item.blocker_code))
      .slice(0, 4)
      .map((item) => ({
        id: item.task_id,
        title: `${relatedObjectLabel(item)} · ${item.blocker_code || item.task_type}`,
        description: item.execution_node || item.task_type,
        status: '阻塞',
        meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`
      })),
    ...exceptions
      .filter((item) => !CLOSED_EXCEPTION_STATUSES.has(String(item.exception_status)) && Boolean(Number(item.blocker_flag)))
      .slice(0, 4)
      .map((item) => ({
        id: item.exception_id,
        title: `${relatedObjectLabel(item)} · ${item.exception_type}`,
        description: item.root_cause || item.action_taken || item.exception_type,
        status: '警戒',
        meta: `${item.severity} · ${formatOverviewTime(item.opened_at)}`
      }))
  ].slice(0, 4);

  const stationReviewQueue = tasks
    .filter((item) => !COMPLETED_TASK_STATUSES.has(String(item.task_status)))
    .sort((left, right) => String(left.due_at || '9999-12-31').localeCompare(String(right.due_at || '9999-12-31')))
    .slice(0, 4)
    .map((item) => ({
      id: item.task_id,
      title: item.task_type,
      description: `${item.execution_node} · ${relatedObjectLabel(item)}`,
      status: normalizeDashboardTaskStatus(item.task_status),
      meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatDashboardClock(item.due_at)}`
    }));

  const documentByFlightId = new Map<string, any[]>();
  for (const document of documents) {
    if (document.related_object_type !== 'Flight') continue;

    if (!documentByFlightId.has(document.related_object_id)) {
      documentByFlightId.set(document.related_object_id, []);
    }
    documentByFlightId.get(document.related_object_id)?.push(document);
  }

  const gateWarnings: any[] = [];
  const primaryFlight = inboundFlights[0];
  if (primaryFlight) {
    const flightDocuments = documentByFlightId.get(primaryFlight.flight_id) || documentByFlightId.get(primaryFlight.flight_no) || [];
    const acceptedStatuses = new Set(['Uploaded', 'Released', 'Approved', 'Accepted', 'Verified', 'Closed']);
    const requiredDocTypes = ['CBA', 'Manifest'];
    const presentDocTypes = new Set(
      flightDocuments.filter((item) => acceptedStatuses.has(String(item.document_status))).map((item) => item.document_type)
    );
    const missingDocTypes = requiredDocTypes.filter((type) => !presentDocTypes.has(type));
    const blockerTask = tasks.find(
      (item) =>
        item.related_object_type === 'Flight' &&
        String(item.related_object_id) === primaryFlight.flight_id &&
        item.blocker_code &&
        !COMPLETED_TASK_STATUSES.has(String(item.task_status))
    );
    const blockerException = exceptions.find(
      (item) =>
        item.related_object_type === 'Flight' &&
        String(item.related_object_id) === primaryFlight.flight_id &&
        Boolean(Number(item.blocker_flag)) &&
        !CLOSED_EXCEPTION_STATUSES.has(String(item.exception_status))
    );

    gateWarnings.push({
      gateId: 'HG-01',
      node: '航班落地 -> 进港处理',
      required: requiredDocTypes.join(' / '),
      impact: '允许生成 PMC 拆板、理货、分区任务',
      status: missingDocTypes.length || blockerTask || blockerException ? '警戒' : '运行中',
      blocker:
        missingDocTypes.length > 0
          ? `${primaryFlight.flight_no} 缺 ${missingDocTypes.join(' / ')}`
          : blockerTask?.blocker_code || blockerException?.root_cause || '文件链已就绪',
      recovery:
        blockerTask?.blocker_code || blockerException?.action_taken || (missingDocTypes.length ? `补齐 ${missingDocTypes.join(' / ')}` : '保持文档版本冻结'),
      releaseRole: 'Document Desk / Inbound Supervisor'
    });
  }

  const openCountRecords = countRecords.filter((item) => !['完成', '已完成', 'Closed', 'Done', 'Resolved'].includes(String(item.status)));
  const blockedCountTask = tasks.find((item) => !COMPLETED_TASK_STATUSES.has(String(item.task_status)) && Boolean(item.blocker_code));
  const blockedCountException = exceptions.find((item) => !CLOSED_EXCEPTION_STATUSES.has(String(item.exception_status)) && Boolean(Number(item.blocker_flag)));

  gateWarnings.push({
    gateId: 'HG-03',
    node: 'PMC 拆板 -> 理货完成',
    required: '板号 / 件数核对记录',
    impact: '允许 NOA 与二次转运推进',
    status: openCountRecords.length || blockedCountTask || blockedCountException ? '待处理' : '运行中',
    blocker:
      openCountRecords[0]?.note ||
      blockedCountTask?.blocker_code ||
      blockedCountException?.root_cause ||
      '等待差异复核记录',
    recovery: openCountRecords.length ? '补齐差异复核并更新计数结果' : blockedCountException?.action_taken || '完成件数与差异复核',
    releaseRole: 'Check Worker / Station Supervisor'
  });

  const pendingPodAwbs = inboundAwbs.filter((item) => isPendingInboundStatus(pickRowValue(item, ['pod_status', 'podStatus'])));
  const latestLoadingPlan = loadingPlans[0];
  const hasLoadingPlan = loadingPlans.length > 0;

  gateWarnings.push({
    gateId: 'HG-06',
    node: '装车 / POD -> 交付关闭',
    required: 'POD / 车牌 / 司机',
    impact: '允许二次转运与交付关闭',
    status: !hasLoadingPlan || pendingPodAwbs.length ? '待处理' : '运行中',
    blocker: !hasLoadingPlan ? '暂无二次转运计划' : pendingPodAwbs.length ? `${pendingPodAwbs.length} 票 POD 仍待归档` : latestLoadingPlan?.note || '交付闭环待确认',
    recovery: !hasLoadingPlan ? '创建二次转运计划并补齐车辆信息' : '补齐 POD 双签并回写签收状态',
    releaseRole: 'Delivery Desk / Station Supervisor'
  });

  const fallbackPayloads = await loadDemoDatasetPayloads(db, [
    'sinoport.inboundFlights',
    'sinoport.inboundWaybillRows',
    'sinoport-adapters.gateEvaluationRows',
    'sinoport-adapters.stationBlockerQueue',
    'sinoport-adapters.stationReviewQueue',
    'sinoport-adapters.stationTransferRows'
  ]);

  const demoInboundFlights = toArray<any>(fallbackPayloads['sinoport.inboundFlights']);
  const demoInboundWaybills = toArray<any>(fallbackPayloads['sinoport.inboundWaybillRows']);

  return {
    inboundFlights: inboundFlights.length ? inboundFlights : demoInboundFlights,
    inboundLifecycleRows: inboundFlightMetrics.length ? inboundFlightMetrics : buildDemoInboundLifecycleRows(demoInboundFlights, demoInboundWaybills),
    stationBlockerQueue: stationBlockerQueue.length ? stationBlockerQueue : toArray(fallbackPayloads['sinoport-adapters.stationBlockerQueue']),
    stationReviewQueue: stationReviewQueue.length ? stationReviewQueue : toArray(fallbackPayloads['sinoport-adapters.stationReviewQueue']),
    inboundDocumentGates: gateWarnings.length >= 3 ? gateWarnings : buildDemoInboundDocumentGates(toArray(fallbackPayloads['sinoport-adapters.gateEvaluationRows'])),
    stationTransferRows: loadingPlans.length
      ? loadingPlans
          .map((item) => {
            const flight = flights.find((flightRow) => flightRow.flight_no === item.flight_no);
            const flightAwbs = flight ? awbsByFlightId.get(flight.flight_id) || [] : [];
            const awbNo = flightAwbs[0]?.awb_no || '--';

            return {
              transferId: item.loading_plan_id,
              awb: awbNo,
              destination: flight?.destination_code || '--',
              plate: item.truck_plate,
              driver: item.driver_name || '--',
              departAt: formatDashboardClock(item.depart_time || item.arrival_time || item.created_at),
              status: item.plan_status
            };
          })
          .slice(0, 3)
      : toArray(fallbackPayloads['sinoport-adapters.stationTransferRows'])
  };
}

async function loadStationInboundMobileOverview(services: StationServices, stationId: string) {
  const [inboundFlightsResult, mobileTasksResult] = await Promise.all([
    services.listInboundFlights({ station_id: stationId, page_size: '100' }),
    services.listMobileTasks({ station_id: stationId, page_size: '100' })
  ]);

  const inboundFlights = inboundFlightsResult.items.map((item) => ({
    flightNo: item.flight_no,
    source: item.origin_code,
    eta: formatDashboardClock(item.eta || item.actual_landed_at),
    step: item.summary.current_step || item.runtime_status,
    priority: item.service_level || 'P2',
    taskCount: item.summary.open_task_count,
    blocked: Boolean(item.summary.blocked),
    blockerReason: item.summary.blocker_reason || ''
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
    allowedActions: item.allowed_actions
  }));

  const flightTasks = mobileTasks.filter((item) => item.flightNo);
  const queuedTasks = flightTasks.filter((item) => ['Created', 'Assigned', 'Accepted'].includes(item.taskStatus)).length;
  const activeTasks = flightTasks.filter((item) => ['Started', 'Evidence Uploaded'].includes(item.taskStatus)).length;
  const completedTasks = flightTasks.filter((item) => ['Completed', 'Verified', 'Closed'].includes(item.taskStatus)).length;

  return {
    stationId,
    summary: {
      totalFlights: inboundFlights.length,
      totalTasks: flightTasks.length,
      queuedTasks,
      activeTasks,
      completedTasks
    },
    inboundFlights,
    mobileTasks
  };
}

function buildOverviewState(stations: OverviewStationRow[], tasks: OverviewTaskRow[], exceptions: OverviewExceptionRow[], audits: OverviewAuditRow[]) {
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
        latestUpdateAt: null
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
        stats.blockingReason = task.blocker_code ? `${task.task_type} · ${task.blocker_code}` : task.task_type;
      }
    }

    if (task.due_at && (!stats.nextDueAt || task.due_at < stats.nextDueAt)) {
      stats.nextDueAt = task.due_at;
    }
    if (task.due_at && (!stats.latestUpdateAt || task.due_at > stats.latestUpdateAt)) {
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
        stats.blockingReason = exception.root_cause || exception.action_taken || exception.exception_type;
      }
    }

    if (exception.opened_at && (!stats.latestUpdateAt || exception.opened_at > stats.latestUpdateAt)) {
      stats.latestUpdateAt = exception.opened_at;
    }
  }

  const orderedStations = (stations.length
    ? stations
    : Array.from(stationIds).map((stationId) => ({
        station_id: stationId,
        station_name: stationId,
        control_level: null,
        phase: null
      }))
  ).sort((a, b) => a.station_id.localeCompare(b.station_id));

  const stationHealthRows = orderedStations.map((station) => {
    const stats = ensureStationStats(station.station_id);
    const completionRatio = stats.totalTasks ? stats.completedTasks / stats.totalTasks : 0.78;
    const exceptionPenalty = stats.blockingExceptions * 12 + stats.openExceptions * 4 + stats.blockedTasks * 6;
    const readiness = clampNumber(Math.round(100 * completionRatio - exceptionPenalty), 45, 99);

    return {
      code: station.station_id,
      name: station.station_name,
      control: normalizeControlLevel(station.control_level),
      phase: normalizePhase(station.phase),
      readiness,
      blockingReason: stats.blockingReason || (stats.openTasks ? `还有 ${stats.openTasks} 个待处理动作` : '运行稳定')
    };
  });

  const totalStations = orderedStations.length;
  const healthyStations = stationHealthRows.filter((item) => item.readiness >= 80).length;
  const openTasks = tasks.filter((item) => !COMPLETED_TASK_STATUSES.has(item.task_status)).length;
  const openExceptions = exceptions.filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status)).length;
  const blockingTasks = tasks.filter((item) => !COMPLETED_TASK_STATUSES.has(item.task_status) && Boolean(item.blocker_code)).length;
  const blockingExceptions = exceptions.filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status) && Boolean(Number(item.blocker_flag))).length;

  const platformOperationKpis = [
    {
      title: '已接入货站',
      value: String(totalStations),
      helper: '来自 stations 表的当前接入范围',
      chip: 'Network',
      color: 'primary'
    },
    {
      title: '健康站点',
      value: String(healthyStations),
      helper: '准备度 >= 80 的站点数',
      chip: 'Stable',
      color: 'success'
    },
    {
      title: '待处理动作',
      value: String(openTasks + openExceptions),
      helper: '开放任务与未关闭异常总数',
      chip: 'Queue',
      color: 'warning'
    },
    {
      title: '阻塞点',
      value: String(blockingTasks + blockingExceptions),
      helper: '带 blocker 的任务与异常',
      chip: 'Risk',
      color: 'error'
    }
  ];

  const platformKpis = [
    {
      title: '平台接入站点',
      value: String(totalStations),
      helper: '当前参与平台态势视图的站点',
      chip: 'Stations',
      color: 'primary'
    },
    {
      title: '高可用站点',
      value: String(healthyStations),
      helper: '按任务完成率与阻断异常计算',
      chip: 'Health',
      color: 'success'
    },
    {
      title: '平台告警',
      value: String(blockingTasks + blockingExceptions),
      helper: '任务与异常中的阻断项',
      chip: 'Alerts',
      color: 'warning'
    },
    {
      title: '最近审计',
      value: String(audits.length),
      helper: '审计事件回放条数',
      chip: 'Audit',
      color: 'secondary'
    }
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
          (stats.blockingExceptions ? `未关闭异常 ${stats.blockingExceptions} 项` : `待处理动作 ${stats.openTasks} 项`),
        status: stats.blockingExceptions ? '阻塞' : '警戒'
      };
    })
    .filter(Boolean)
    .slice(0, 3) as { id: string; title: string; description: string; status: string }[];

  const fallbackAlertRows =
    alertRows.length > 0
      ? alertRows
      : tasks
          .filter((item) => !COMPLETED_TASK_STATUSES.has(item.task_status))
          .slice(0, 3)
          .map((item) => ({
            id: item.task_id,
            title: `${item.station_id} · ${item.task_type}`,
            description: item.blocker_code || item.execution_node || item.related_object_id,
            status: item.blocker_code ? '阻塞' : '待处理'
          }));

  const platformPendingActions = tasks
    .filter((item) => !COMPLETED_TASK_STATUSES.has(item.task_status))
    .sort((a, b) => (a.due_at || '9999-12-31').localeCompare(b.due_at || '9999-12-31'))
    .slice(0, 4)
    .map((item) => ({
      id: item.task_id,
      title: item.task_type,
      description: `${item.execution_node} · ${item.related_object_type} ${item.related_object_id}`,
      meta: `${item.assigned_role || item.assigned_team_id || item.assigned_worker_id || item.station_id} · 截止 ${formatOverviewTime(item.due_at)}`,
      status: item.blocker_code ? '阻塞' : item.task_status === 'Created' || item.task_status === 'Assigned' ? '待处理' : '运行中'
    }));

  const pendingActionRows =
    platformPendingActions.length > 0
      ? platformPendingActions
      : exceptions
          .filter((item) => !CLOSED_EXCEPTION_STATUSES.has(item.exception_status))
          .slice(0, 4)
          .map((item) => ({
            id: item.exception_id,
            title: item.exception_type,
            description: item.root_cause || item.action_taken || `${item.related_object_type} ${item.related_object_id}`,
            meta: `${item.owner_role || item.owner_team_id || item.station_id} · ${formatOverviewTime(item.opened_at)}`,
            status: Boolean(Number(item.blocker_flag)) ? '阻塞' : '待处理'
          }));

  const stationAuditFeed = audits.slice(0, 4).map((item) => ({
    time: formatOverviewTime(item.created_at),
    action: item.action,
    object: `${item.object_type} / ${item.object_id}`,
    actor: `${item.actor_id} / ${item.actor_role}`
  }));

  return {
    platformKpis,
    platformOperationKpis,
    platformAlerts: fallbackAlertRows,
    platformPendingActions: pendingActionRows,
    stationAuditFeed,
    stationHealthRows
  };
}

async function loadPlatformOperationsOverview(db: any) {
  const [stations, tasks, exceptions, audits] = await Promise.all([
    fetchOverviewRows<OverviewStationRow>(db, 'SELECT station_id, station_name, control_level, phase FROM stations ORDER BY station_id ASC'),
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
      `
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
      `
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
      `
    )
  ]);

  if (stations.length || tasks.length || exceptions.length || audits.length) {
    const overview = buildOverviewState(stations, tasks, exceptions, audits);
    const fallbackPayloads = await loadDemoDatasetPayloads(db, [
      'sinoport.platformKpis',
      'sinoport-adapters.platformOperationKpis',
      'sinoport-adapters.platformAlerts',
      'sinoport-adapters.platformPendingActions',
      'sinoport-adapters.stationAuditFeed',
      'sinoport-adapters.stationHealthRows'
    ]);

    return {
      platformKpis: overview.platformKpis.length ? overview.platformKpis : toArray(fallbackPayloads['sinoport.platformKpis']),
      platformOperationKpis: overview.platformOperationKpis.length
        ? overview.platformOperationKpis
        : toArray(fallbackPayloads['sinoport-adapters.platformOperationKpis']),
      platformAlerts: overview.platformAlerts.length ? overview.platformAlerts : toArray(fallbackPayloads['sinoport-adapters.platformAlerts']),
      platformPendingActions: overview.platformPendingActions.length
        ? overview.platformPendingActions
        : toArray(fallbackPayloads['sinoport-adapters.platformPendingActions']),
      stationAuditFeed: overview.stationAuditFeed.length ? overview.stationAuditFeed : toArray(fallbackPayloads['sinoport-adapters.stationAuditFeed']),
      stationHealthRows: overview.stationHealthRows.length ? overview.stationHealthRows : toArray(fallbackPayloads['sinoport-adapters.stationHealthRows'])
    };
  }

  const payloads = await loadDemoDatasetPayloads(db, [
    'sinoport.platformKpis',
    'sinoport-adapters.platformOperationKpis',
    'sinoport-adapters.platformAlerts',
    'sinoport-adapters.platformPendingActions',
    'sinoport-adapters.stationAuditFeed',
    'sinoport-adapters.stationHealthRows'
  ]);

  return {
    platformKpis: toArray(payloads['sinoport.platformKpis']),
    platformOperationKpis: toArray(payloads['sinoport-adapters.platformOperationKpis']),
    platformAlerts: toArray(payloads['sinoport-adapters.platformAlerts']),
    platformPendingActions: toArray(payloads['sinoport-adapters.platformPendingActions']),
    stationAuditFeed: toArray(payloads['sinoport-adapters.stationAuditFeed']),
    stationHealthRows: toArray(payloads['sinoport-adapters.stationHealthRows'])
  };
}

async function loadUserProfile(db: any, userId: string) {
  const user = (await db
    .prepare(
      `
        SELECT user_id, display_name, email, default_station_id
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `
    )
    .bind(userId)
    .first()) as { user_id: string; display_name: string; email: string | null; default_station_id: string | null } | null;

  if (!user) return null;

  const roles = await db
    .prepare(
      `
        SELECT role_code, station_id
        FROM user_roles
        WHERE user_id = ?
        ORDER BY role_code ASC
      `
    )
    .bind(userId)
    .all();

  return {
    ...user,
    roles: roles?.results || []
  };
}

async function issueStationSession(c: any, params: { userId: string; stationCode: string; roleIds: RoleCode[] }) {
  const secret = c.env.AUTH_TOKEN_SECRET || 'sinoport-local-dev-secret';
  const actor = {
    user_id: params.userId,
    role_ids: params.roleIds,
    station_scope: [params.stationCode],
    tenant_id: 'sinoport-demo',
    client_source: 'station-web' as const
  };
  const token = await signAuthToken(actor, secret, 60 * 60);
  const refreshToken = `rfr_${crypto.randomUUID()}_${crypto.randomUUID()}`;
  const refreshTokenId = `REF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString();

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
    `
  )
    .bind(refreshTokenId, params.userId, params.stationCode, 'station-web', refreshToken, expiresAt, now.toISOString(), now.toISOString())
    .run();

  const profile = (await loadUserProfile(c.env.DB, params.userId)) || {
    user_id: params.userId,
    display_name: params.userId,
    email: `${params.userId}@sinoport.local`,
    default_station_id: params.stationCode,
    roles: params.roleIds.map((roleCode: RoleCode) => ({ role_code: roleCode, station_id: params.stationCode }))
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
      default_station_id: profile.default_station_id
    }
  };
}

async function authenticateStationUser(c: any, body: any) {
  const email = String(body.email || body.login_name || '').trim().toLowerCase();
  const password = String(body.password || '');

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
    `
  )
    .bind(email)
    .first()) as { user_id: string; password_hash: string; login_name: string; default_station_id: string | null } | null;

  if (!credential) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const matched = await verifyPasswordHash(password, credential.password_hash);
  if (!matched) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const profile = await loadUserProfile(c.env.DB, credential.user_id);
  if (!profile) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const requestedStation = body.stationCode || body.station_code || profile.default_station_id || profile.roles[0]?.station_id || 'MME';
  const stationScopedRoles = profile.roles
    .filter((item: any) => !item.station_id || item.station_id === requestedStation)
    .map((item: any) => item.role_code);

  return {
    userId: profile.user_id,
    stationCode: requestedStation,
    roleIds: stationScopedRoles.length ? stationScopedRoles : ['station_supervisor']
  };
}

export function registerStationRoutes(app: ApiApp, getStationServices: (c: any) => StationServices, requireRoles: RequireRoles) {
  app.post('/api/v1/station/login', async (c) => {
    try {
      const body = await c.req.json();
      const formalLogin = await authenticateStationUser(c, body).catch((error) => {
        if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
          throw jsonError(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        }

        throw error;
      });

      if (formalLogin) {
        return c.json({
          data: await issueStationSession(c, formalLogin)
        });
      }

      const stationCode = body.stationCode || body.station_code || 'MME';
      const roleIds = Array.isArray(body.roleIds) && body.roleIds.length ? body.roleIds : [body.roleCode || 'station_supervisor'];
      const preferredFallback =
        roleIds.includes('document_desk')
          ? 'demo-docdesk'
          : roleIds.includes('check_worker')
            ? 'demo-checker'
            : roleIds.includes('mobile_operator')
              ? 'demo-mobile'
              : 'demo-supervisor';
      const userId = await resolveKnownUserId(c, body.userId || body.user_id, preferredFallback);

      return c.json({
        data: await issueStationSession(c, { userId, stationCode, roleIds })
      });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      return handleServiceError(c, error, 'POST /station/login');
    }
  });

  app.get('/api/v1/station/me', async (c) => {
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
            client_source: actor.clientSource
          },
          user: profile
            ? {
                user_id: profile.user_id,
                display_name: profile.display_name,
                email: profile.email,
                default_station_id: profile.default_station_id
              }
            : {
                user_id: actor.userId,
                display_name: actor.userId,
                email: `${actor.userId}@sinoport.local`,
                default_station_id: actor.stationScope[0] || 'MME'
              }
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /station/me');
    }
  });

  app.get(
    '/api/v1/station/dashboard/overview',
    requireRoles(['station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator', 'mobile_operator']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const overview = await loadStationDashboardOverview(c.env.DB, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/dashboard/overview');
      }
    }
  );

  app.get(
    '/api/v1/station/outbound/overview',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const overview = await loadStationOutboundOverview(c.env.DB, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/outbound/overview');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/overview',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const overview = await loadStationInboundOverview(c.env.DB, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/overview');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/mobile-overview',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk', 'mobile_operator']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const overview = await loadStationInboundMobileOverview(services, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/mobile-overview');
      }
    }
  );

  app.get(
    '/api/v1/station/resources/overview',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk', 'mobile_operator']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const overview = await loadStationResourcesOverview(c.env.DB, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/resources/overview');
      }
    }
  );

  app.get(
    '/api/v1/station/reports/overview',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk', 'mobile_operator']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const overview = await loadStationReportsOverview(c.env.DB, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/reports/overview');
      }
    }
  );

  app.get(
    '/api/v1/station/reports/daily',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk', 'mobile_operator']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const date = c.req.query('date');

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'date must be in YYYY-MM-DD format');
        }

        const reportDate = normalizeDailyReportDate(date);
        const overview = await loadStationReportsDaily(c.env.DB, stationId, reportDate);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/reports/daily');
      }
    }
  );

  app.get(
    '/api/v1/station/resources/vehicles',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk', 'mobile_operator']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const items = await loadStationResourceVehicles(c.env.DB, stationId);

        return c.json({
          data: {
            stationId,
            items,
            total: items.length
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/resources/vehicles');
      }
    }
  );

  app.post(
    '/api/v1/station/resources/vehicles',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk', 'mobile_operator']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const body = await c.req.json();
        const tripId = String(body.tripId || body.trip_id || body.loading_plan_id || body.id || '').trim();

        if (!tripId) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'tripId is required');
        }

        const currentItems = await loadStationResourceVehicles(c.env.DB, stationId);
        const nextItem = normalizeStationResourceVehiclePlan({ ...body, tripId });
        const nextItems = [nextItem, ...currentItems.filter((item: any) => item.tripId !== nextItem.tripId)];

        await saveStationResourceVehicles(c.env.DB, stationId, nextItems);

        return c.json({
          data: {
            stationId,
            item: nextItem,
            items: nextItems,
            total: nextItems.length
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/resources/vehicles');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/flight-create/options',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk']),
    async (c) => {
      try {
        return c.json({
          data: {
            sourceOptions: [...inboundFlightSourceOptions]
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/flight-create/options');
      }
    }
  );

  app.post(
    '/api/v1/station/imports/inbound-bundle',
    requireRoles(['station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const body = await c.req.json().catch(() => null);

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'request body must be a JSON object');
        }

        const stationId = String(
          (body as any).station_id ||
            (body as any).stationId ||
            (body as any).station?.station_id ||
            (body as any).station?.stationId ||
            c.var.actor.stationScope[0] ||
            ''
        ).trim();

        assertStationAccess(c.var.actor, stationId);

        const db = c.env.DB;

        if (!db) {
          return jsonError(c, 500, 'DB_NOT_AVAILABLE', 'Database binding is required for import');
        }

        const result = await importInboundBundle(db, c.var.actor, body, c.req.header('X-Request-Id') ?? undefined);

        return c.json({ data: result });
      } catch (error) {
        if (error instanceof InboundBundleImportError) {
          return jsonError(c, 400, error.code, error.message, error.details);
        }

        return handleServiceError(c, error, 'POST /station/imports/inbound-bundle');
      }
    }
  );

  app.post('/api/v1/station/refresh', async (c) => {
    try {
      const body = await c.req.json();
      const refreshToken = String(body.refresh_token || '').trim();

      if (!refreshToken) {
        return jsonError(c, 400, 'VALIDATION_ERROR', 'refresh_token is required');
      }

      const row = (await c.env.DB?.prepare(
        `
          SELECT refresh_token_id, user_id, station_id, expires_at, revoked_at
          FROM station_refresh_tokens
          WHERE token_value = ?
          LIMIT 1
        `
      )
        .bind(refreshToken)
        .first()) as { refresh_token_id: string; user_id: string; station_id: string; expires_at: string; revoked_at: string | null } | null;

      if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
        return jsonError(c, 401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
      }

      const profile = await loadUserProfile(c.env.DB, row.user_id);
      const roleIds = (profile?.roles || [])
        .filter((item: any) => !item.station_id || item.station_id === row.station_id)
        .map((item: any) => item.role_code);

      await c.env.DB?.prepare(`UPDATE station_refresh_tokens SET revoked_at = ?, updated_at = ? WHERE refresh_token_id = ?`)
        .bind(new Date().toISOString(), new Date().toISOString(), row.refresh_token_id)
        .run();

      return c.json({
        data: await issueStationSession(c, {
          userId: row.user_id,
          stationCode: row.station_id,
          roleIds: roleIds.length ? roleIds : ['station_supervisor']
        })
      });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/refresh');
    }
  });

  app.post('/api/v1/station/logout', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const refreshToken = body.refresh_token ? String(body.refresh_token) : null;

      if (refreshToken) {
        await c.env.DB?.prepare(`UPDATE station_refresh_tokens SET revoked_at = ?, updated_at = ? WHERE token_value = ?`)
          .bind(new Date().toISOString(), new Date().toISOString(), refreshToken)
          .run();
      } else {
        await c.env.DB?.prepare(`UPDATE station_refresh_tokens SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
          .bind(new Date().toISOString(), new Date().toISOString(), c.var.actor.userId)
          .run();
      }

      return c.json({ data: { ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/logout');
    }
  });

  app.get(
    '/api/v1/station/shipments',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationShipments(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/shipments');
      }
    }
  );

  app.get(
    '/api/v1/station/shipments/:shipmentId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getStationShipment(c.req.param('shipmentId'));

        if (!result) {
          return jsonError(c, 404, 'SHIPMENT_NOT_FOUND', 'Shipment does not exist', {
            shipment_id: c.req.param('shipmentId')
          });
        }

        const demoPayloads = await loadDemoDatasetPayloads(c.env.DB, [
          'sinoport-adapters.gateEvaluationRows',
          'sinoport-adapters.hardGatePolicyRows'
        ]);
        const gateEvaluationRows = toArray<any>(demoPayloads['sinoport-adapters.gateEvaluationRows']);
        const hardGatePolicyRows = toArray<any>(demoPayloads['sinoport-adapters.hardGatePolicyRows']);
        const gatePolicy = buildShipmentGatePolicySummary(result, gateEvaluationRows, hardGatePolicyRows);

        return c.json({
          data: {
            ...result,
            ...gatePolicy
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/shipments/:shipmentId');
      }
    }
  );

  app.get(
    '/api/v1/station/outbound/flights',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listOutboundFlights(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/outbound/flights');
      }
    }
  );

  app.get(
    '/api/v1/station/outbound/flights/:flightId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getOutboundFlight(c.req.param('flightId'));

        if (!result) {
          return jsonError(c, 404, 'FLIGHT_NOT_FOUND', 'Outbound flight does not exist', {
            flight_id: c.req.param('flightId')
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/outbound/flights/:flightId');
      }
    }
  );

  app.post('/api/v1/station/outbound/flights/:flightId/loaded', requireRoles(['station_supervisor', 'document_desk']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json().catch(() => ({}));
      const result = await services.markOutboundLoaded(c.req.param('flightId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/outbound/flights/:flightId/loaded');
    }
  });

  app.post(
    '/api/v1/station/outbound/flights/:flightId/manifest/finalize',
    requireRoles(['station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const input = await c.req.json().catch(() => ({}));
        const result = await services.finalizeOutboundManifest(c.req.param('flightId'), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/outbound/flights/:flightId/manifest/finalize');
      }
    }
  );

  app.post('/api/v1/station/outbound/flights/:flightId/airborne', requireRoles(['station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json().catch(() => ({}));
      const result = await services.markOutboundAirborne(c.req.param('flightId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/outbound/flights/:flightId/airborne');
    }
  });

  app.get(
    '/api/v1/station/outbound/waybills',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listOutboundWaybills(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/outbound/waybills');
      }
    }
  );

  app.get(
    '/api/v1/station/outbound/waybills/:awbId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getOutboundWaybill(c.req.param('awbId'));

        if (!result) {
          return jsonError(c, 404, 'AWB_NOT_FOUND', 'Outbound waybill does not exist', {
            awb_id: c.req.param('awbId')
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/outbound/waybills/:awbId');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/flights',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listInboundFlights(normalizeInboundFlightListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/flights');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/flights/:flightId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk']),
    async (c) => {
      try {
        assertStationAccess(c.var.actor, c.req.query('station_id'));
        const services = getStationServices(c);
        const result = await services.getInboundFlight(c.req.param('flightId'));

        if (!result) {
          return jsonError(c, 404, 'FLIGHT_NOT_FOUND', 'Inbound flight does not exist', {
            flight_id: c.req.param('flightId')
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/flights/:flightId');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/waybills',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listInboundWaybills(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/waybills');
      }
    }
  );

  app.get(
    '/api/v1/station/inbound/waybills/:awbId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        assertStationAccess(c.var.actor, c.req.query('station_id'));
        const services = getStationServices(c);
        const result = await services.getInboundWaybill(c.req.param('awbId'));

        if (!result) {
          return jsonError(c, 404, 'AWB_NOT_FOUND', 'Inbound waybill does not exist', {
            awb_id: c.req.param('awbId')
          });
        }

        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/inbound/waybills/:awbId');
      }
    }
  );

  app.post(
    '/api/v1/station/inbound/waybills/:awbId/noa',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.processInboundNoa(c.req.param('awbId'), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/inbound/waybills/:awbId/noa');
      }
    }
  );

  app.post(
    '/api/v1/station/inbound/waybills/:awbId/pod',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.processInboundPod(c.req.param('awbId'), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/inbound/waybills/:awbId/pod');
      }
    }
  );

  app.post(
    '/api/v1/station/uploads/presign',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
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
          retention_class: input.retention_class
        });
        return c.json({ data: result }, 201);
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/uploads/presign');
      }
    }
  );

  app.put(
    '/api/v1/station/uploads/:uploadId',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const uploadId = c.req.param('uploadId');
        const token = c.req.query('token');

        if (!token) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'token is required');
        }

        const row = (await c.env.DB?.prepare(
          `
            SELECT upload_id, station_id, document_name, content_type, size_bytes, checksum_sha256, storage_key, upload_token, expires_at, consumed_at
            FROM upload_tickets
            WHERE upload_id = ?
            LIMIT 1
          `
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
          return jsonError(c, 404, 'UPLOAD_NOT_FOUND', 'Upload ticket does not exist', { upload_id: uploadId });
        }

        if (row.upload_token !== token) {
          return jsonError(c, 401, 'UPLOAD_TOKEN_INVALID', 'Upload token is invalid');
        }

        if (row.consumed_at) {
          return jsonError(c, 409, 'UPLOAD_ALREADY_CONSUMED', 'Upload ticket was already consumed', { upload_id: uploadId });
        }

        if (new Date(row.expires_at).getTime() < Date.now()) {
          return jsonError(c, 409, 'UPLOAD_EXPIRED', 'Upload ticket expired', { upload_id: uploadId });
        }

        const body = await c.req.arrayBuffer();
        await c.env.FILES?.put(row.storage_key, body, {
          httpMetadata: {
            contentType: c.req.header('Content-Type') || row.content_type || 'application/octet-stream'
          }
        });

        await c.env.DB?.prepare(`UPDATE upload_tickets SET uploaded_at = ?, updated_at = ? WHERE upload_id = ?`)
          .bind(new Date().toISOString(), new Date().toISOString(), uploadId)
          .run();

        return c.json({
          data: {
            upload_id: uploadId,
            storage_key: row.storage_key,
            document_name: row.document_name,
            content_type: row.content_type
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'PUT /station/uploads/:uploadId');
      }
    }
  );

  app.post(
    '/api/v1/station/uploads',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const formData = await c.req.formData();
        const file = formData.get('file');
        const stationId = String(formData.get('station_id') || c.var.actor.stationScope[0] || 'MME');
        const objectType = String(formData.get('related_object_type') || 'Document').toUpperCase();

        if (!(file instanceof File)) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'file is required');
        }

        const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
        const objectKey = `station/${stationId}/uploads/${objectType}/${Date.now()}-${crypto.randomUUID()}${extension}`;

        await c.env.FILES?.put(objectKey, await file.arrayBuffer(), {
          httpMetadata: {
            contentType: file.type || 'application/octet-stream'
          }
        });

        return c.json(
          {
            data: {
              document_name: file.name,
              content_type: file.type || 'application/octet-stream',
              size: file.size,
              storage_key: objectKey,
              uploaded_at: new Date().toISOString()
            }
          },
          201
        );
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/uploads');
      }
    }
  );

  app.post(
    '/api/v1/station/documents',
    requireRoles(['station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.createDocument(normalizeDocumentInput(c.var.actor, input));
        return c.json({ data: result }, 201);
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/documents');
      }
    }
  );

  app.get(
    '/api/v1/station/documents',
    requireRoles(['station_supervisor', 'document_desk', 'check_worker', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationDocuments(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/documents');
      }
    }
  );

  app.get(
    '/api/v1/station/documents/overview',
    requireRoles(['station_supervisor', 'document_desk', 'check_worker', 'delivery_desk']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const [liveDocumentRows, demoPayloads] = await Promise.all([
          c.env.DB
            ? c.env.DB
                .prepare(
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
                  `
                )
                .bind(stationId)
                .all()
                .then((rows: any) => (rows?.results || []) as any[])
            : Promise.resolve([]),
          loadDemoDatasetPayloads(c.env.DB, [
            'sinoport-adapters.stationDocumentRows',
            'sinoport-adapters.documentVersionRows',
            'sinoport-adapters.gateEvaluationRows',
            'sinoport-adapters.instructionTemplateRows'
          ])
        ]);

        const liveDocuments = liveDocumentRows.map(normalizeStationReportDocumentRow);
        const demoDocuments = toArray<any>(demoPayloads['sinoport-adapters.stationDocumentRows']).map(normalizeStationReportDocumentRow);
        const demoDocumentVersions = toArray<any>(demoPayloads['sinoport-adapters.documentVersionRows']);
        const gateRows = toArray<any>(demoPayloads['sinoport-adapters.gateEvaluationRows']);
        const templateRows = toArray<any>(demoPayloads['sinoport-adapters.instructionTemplateRows']);

        const overview = buildStationDocumentOverview(
          liveDocuments.length ? liveDocuments : demoDocuments,
          liveDocuments.length ? liveDocuments : demoDocumentVersions.length ? demoDocumentVersions : demoDocuments,
          gateRows,
          templateRows
        );

        return c.json({
          data: {
            stationId,
            ...overview
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/documents/overview');
      }
    }
  );

  app.get(
    '/api/v1/station/pod/overview',
    requireRoles(['station_supervisor', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const [livePodRows, demoPayloads] = await Promise.all([
          c.env.DB
            ? c.env.DB
                .prepare(
                  `
                    SELECT
                      awb_id,
                      awb_no,
                      consignee_name,
                      pod_status,
                      blocker_reason,
                      updated_at,
                      created_at
                    FROM awbs
                    WHERE station_id = ?
                    ORDER BY COALESCE(updated_at, created_at) DESC, awb_no DESC
                  `
                )
                .bind(stationId)
                .all()
                .then((rows: any) => (rows?.results || []) as any[])
            : Promise.resolve([]),
          loadDemoDatasetPayloads(c.env.DB, [
            'sinoport-adapters.podNotificationRows',
            'sinoport-adapters.gateEvaluationRows',
            'sinoport-adapters.hardGatePolicyRows'
          ])
        ]);

        const podRows = livePodRows.length ? livePodRows : toArray<any>(demoPayloads['sinoport-adapters.podNotificationRows']);
        const gateRows = toArray<any>(demoPayloads['sinoport-adapters.gateEvaluationRows']);
        const policyRows = toArray<any>(demoPayloads['sinoport-adapters.hardGatePolicyRows']);
        const overview = buildStationPodOverview(podRows, gateRows, policyRows);

        return c.json({
          data: {
            stationId,
            ...overview
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/pod/overview');
      }
    }
  );

  app.get(
    '/api/v1/station/noa/overview',
    requireRoles(['station_supervisor', 'document_desk', 'check_worker', 'delivery_desk']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const [liveNoaRows, demoPayloads] = await Promise.all([
          c.env.DB
            ? c.env.DB
                .prepare(
                  `
                    SELECT
                      awb_id,
                      awb_no,
                      consignee_name,
                      noa_status,
                      blocker_reason
                    FROM awbs
                    WHERE station_id = ?
                    ORDER BY awb_no ASC
                  `
                )
                .bind(stationId)
                .all()
                .then((rows: any) => (rows?.results || []) as any[])
            : Promise.resolve([]),
          loadDemoDatasetPayloads(c.env.DB, [
            'sinoport.inboundWaybillRows',
            'sinoport-adapters.gateEvaluationRows',
            'sinoport-adapters.hardGatePolicyRows'
          ])
        ]);

        const noaSourceRows = liveNoaRows.length ? liveNoaRows : toArray<any>(demoPayloads['sinoport.inboundWaybillRows']);
        const gateRows = toArray<any>(demoPayloads['sinoport-adapters.gateEvaluationRows']);
        const policyRows = toArray<any>(demoPayloads['sinoport-adapters.hardGatePolicyRows']);
        const overview = buildStationNoaOverview(noaSourceRows, gateRows, policyRows);

        return c.json({
          data: {
            stationId,
            ...overview
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/noa/overview');
      }
    }
  );

  app.get(
    '/api/v1/station/documents/:documentId/preview',
    requireRoles(['station_supervisor', 'document_desk', 'check_worker', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const preview = await services.getStationDocumentPreview(c.req.param('documentId'));

        if (!preview) {
          return jsonError(c, 404, 'RESOURCE_NOT_FOUND', 'Document does not exist', {
            document_id: c.req.param('documentId')
          });
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
          `
        )
          .bind(c.req.param('documentId'))
          .first<{ storage_key: string; document_name: string; content_type: string | null }>();

        if (!row) {
          return jsonError(c, 404, 'RESOURCE_NOT_FOUND', 'Document does not exist', {
            document_id: c.req.param('documentId')
          });
        }

        const object = await c.env.FILES?.get(row.storage_key);
        if (!object) {
          return jsonError(c, 404, 'RESOURCE_NOT_FOUND', 'Document content does not exist in object storage', {
            document_id: c.req.param('documentId'),
            storage_key: row.storage_key
          });
        }

        return new Response(object.body, {
          headers: {
            'Content-Disposition': `inline; filename="${row.document_name}"`,
            'Content-Type': row.content_type || object.httpMetadata?.contentType || 'application/octet-stream'
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/documents/:documentId/preview');
      }
    }
  );

  app.get(
    '/api/v1/platform/demo-datasets',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const rows = await loadDemoDatasetCatalog(c.env.DB);

        return c.json({
          items: rows,
          page: 1,
          page_size: rows.length,
          total: rows.length
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/demo-datasets');
      }
    }
  );

  app.get(
    '/api/v1/platform/demo-datasets/:datasetKey',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const row = await loadDemoDatasetRecord(c.env.DB, c.req.param('datasetKey'));

        if (!row) {
          return jsonError(c, 404, 'DATASET_NOT_FOUND', 'Demo dataset does not exist', {
            dataset_key: c.req.param('datasetKey')
          });
        }

        return c.json({
          data: {
            dataset_key: row.dataset_key,
            source_module: row.source_module,
            export_name: row.export_name,
            payload_kind: row.payload_kind,
            row_count: row.row_count,
            updated_at: row.updated_at,
            payload: row.payload
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/demo-datasets/:datasetKey');
      }
    }
  );

  app.get(
    '/api/v1/platform/station-governance/templates',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const stationId = c.req.query('station_id') || undefined;
        const kind = c.req.query('kind');
        const templateKind =
          kind === 'control_level' || kind === 'phase' || kind === 'resource_template' || kind === 'capability_template'
            ? kind
            : undefined;
        const items = await loadStationGovernanceTemplates(c.env.DB, {
          stationId,
          kind: templateKind
        });

        return c.json({
          data: {
            items,
            page: 1,
            page_size: items.length,
            total: items.length
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/station-governance/templates');
      }
    }
  );

  app.get(
    '/api/v1/platform/station-governance/templates/:templateKey',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const template = await loadStationGovernanceTemplate(c.env.DB, c.req.param('templateKey'));

        if (!template) {
          return jsonError(c, 404, 'TEMPLATE_NOT_FOUND', 'Station governance template does not exist', {
            template_key: c.req.param('templateKey')
          });
        }

        return c.json({ data: template });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/station-governance/templates/:templateKey');
      }
    }
  );

  app.get(
    '/api/v1/platform/station-governance/stations/:stationId/summary',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const summary = await loadStationGovernanceSummary(c.env.DB, c.req.param('stationId'));

        return c.json({ data: summary });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/station-governance/stations/:stationId/summary');
      }
    }
  );

  app.get(
    '/api/v1/platform/operations/overview',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const overview = await loadPlatformOperationsOverview(c.env.DB);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/operations/overview');
      }
    }
  );

  app.get(
    '/api/v1/platform/stations',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const payloads = await loadStablePlatformStationsPayloads(c.env.DB);

        return c.json({
          data: {
            stationCatalog: (payloads['sinoport.stationCatalog'] as any[]) || [],
            platformStationCapabilityRows: (payloads['sinoport-adapters.platformStationCapabilityRows'] as any[]) || [],
            stationCapabilityColumns: (payloads['sinoport-adapters.stationCapabilityColumns'] as any[]) || [],
            platformStationTeamRows: (payloads['sinoport-adapters.platformStationTeamRows'] as any[]) || [],
            platformStationZoneRows: (payloads['sinoport-adapters.platformStationZoneRows'] as any[]) || [],
            platformStationDeviceRows: (payloads['sinoport-adapters.platformStationDeviceRows'] as any[]) || []
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/stations');
      }
    }
  );

  app.get(
    '/api/v1/platform/network',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const payloads = await loadStablePlatformNetworkPayloads(c.env.DB);

        return c.json({
          data: {
            stationCatalog: (payloads['sinoport.stationCatalog'] as any[]) || [],
            routeMatrix: (payloads['sinoport.routeMatrix'] as any[]) || [],
            networkLaneTemplateRows: (payloads['sinoport-adapters.networkLaneTemplateRows'] as any[]) || [],
            networkScenarioRows: (payloads['sinoport-adapters.networkScenarioRows'] as any[]) || []
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/network');
      }
    }
  );

  app.get(
    '/api/v1/platform/rules',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const payloads = await loadStablePlatformRulesPayloads(c.env.DB);

        return c.json({
          data: {
            ruleOverviewRows: (payloads['sinoport-adapters.ruleOverviewRows'] as any[]) || [],
            hardGatePolicyRows: (payloads['sinoport-adapters.hardGatePolicyRows'] as any[]) || [],
            ruleTemplateRows: (payloads['sinoport-adapters.ruleTemplateRows'] as any[]) || [],
            evidencePolicyRows: (payloads['sinoport-adapters.evidencePolicyRows'] as any[]) || [],
            scenarioTimelineRows: (payloads['sinoport-adapters.scenarioTimelineRows'] as any[]) || [],
            gateEvaluationRows: (payloads['sinoport-adapters.gateEvaluationRows'] as any[]) || [],
            serviceLevels: (payloads['sinoport.serviceLevels'] as any[]) || [],
            hardGateRules: (payloads['sinoport.hardGateRules'] as any[]) || [],
            exceptionTaxonomy: (payloads['sinoport.exceptionTaxonomy'] as any[]) || [],
            interfaceStatus: (payloads['sinoport.interfaceStatus'] as any[]) || []
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/rules');
      }
    }
  );

  app.get(
    '/api/v1/platform/master-data',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const payloads = await loadDemoDatasetPayloads(c.env.DB, [
          'sinoport-adapters.masterDataRows',
          'sinoport-adapters.interfaceGovernanceRows',
          'sinoport-adapters.importJobRows',
          'sinoport-adapters.demoPermissionMatrixRows',
          'sinoport-adapters.nonFunctionalDemoRows',
          'sinoport-adapters.integrationSyncRows',
          'sinoport-adapters.integrationSyncActionRows',
          'sinoport-adapters.objectRelationshipRows'
        ]);

        return c.json({
          data: {
            masterDataRows: (payloads['sinoport-adapters.masterDataRows'] as any[]) || [],
            interfaceGovernanceRows: (payloads['sinoport-adapters.interfaceGovernanceRows'] as any[]) || [],
            importJobRows: (payloads['sinoport-adapters.importJobRows'] as any[]) || [],
            demoPermissionMatrixRows: (payloads['sinoport-adapters.demoPermissionMatrixRows'] as any[]) || [],
            nonFunctionalDemoRows: (payloads['sinoport-adapters.nonFunctionalDemoRows'] as any[]) || [],
            integrationSyncRows: (payloads['sinoport-adapters.integrationSyncRows'] as any[]) || [],
            integrationSyncActionRows: (payloads['sinoport-adapters.integrationSyncActionRows'] as any[]) || [],
            objectRelationshipRows: (payloads['sinoport-adapters.objectRelationshipRows'] as any[]) || []
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/master-data');
      }
    }
  );

  app.get(
    '/api/v1/platform/reports',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const payloads = await loadStablePlatformReportsPayloads(c.env.DB);

        return c.json({
          data: {
            platformReportCards: (payloads['sinoport-adapters.platformReportCards'] as any[]) || [],
            platformStationReportRows: (payloads['sinoport-adapters.platformStationReportRows'] as any[]) || [],
            platformDailyReportRows: (payloads['sinoport-adapters.platformDailyReportRows'] as any[]) || []
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/reports');
      }
    }
  );

  app.get(
    '/api/v1/platform/reports/daily',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const stationId = c.req.query('station_id') || undefined;
        const date = c.req.query('date');

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'date must be in YYYY-MM-DD format');
        }

        const reportDate = normalizeDailyReportDate(date);
        const overview = await loadPlatformReportsDaily(c.env.DB, reportDate, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/reports/daily');
      }
    }
  );

  app.get(
    '/api/v1/platform/audit/object',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const objectType = String(c.req.query('object_type') || '');
        const objectKey = c.req.query('object_key') || undefined;
        const objectId = c.req.query('object_id') || undefined;

        if (!objectType || (!objectKey && !objectId)) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'object_type and object_key/object_id are required');
        }

        const scope = await resolveAuditScope(c.env.DB, objectType, objectKey, objectId);
        const { whereClause, params } = buildAuditScopeSql(scope);

        if (!whereClause) {
          return c.json({
            data: {
              events: [],
              transitions: []
            }
          });
        }

        const [events, transitions] = await Promise.all([
          c.env.DB
            ?.prepare(
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
              `
            )
            .bind(...params)
            .all(),
          c.env.DB
            ?.prepare(
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
              `
            )
            .bind(...params)
            .all()
        ]);

        return c.json({
          data: {
            events: (events?.results || []).map((item: any) => ({
              id: item.audit_id,
              time: item.created_at,
              actor: `${item.actor_id} / ${item.actor_role}`,
              action: item.action,
              object: `${item.object_type} / ${item.object_id}`,
              note: `${item.station_id} · ${item.summary} · ${item.client_source}`,
              payload: parseAuditPayload(item.payload_json)
            })),
            transitions: (transitions?.results || []).map((item: any) => ({
              id: item.transition_id,
              time: item.triggered_at,
              action: `${item.object_type}.${item.state_field}`,
              object: `${item.object_type} / ${item.object_id}`,
              before: item.from_value || '未设置',
              after: item.to_value,
              actor: item.triggered_by,
              note: item.reason || ''
            }))
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/audit/object');
      }
    }
  );

  app.get(
    '/api/v1/platform/audit/events',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
    async (c) => {
      try {
        const rows = await c.env.DB?.prepare(
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
            ORDER BY created_at DESC, audit_id DESC
            LIMIT 100
          `
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
            result: '运行中',
            note: `${item.station_id} · ${item.summary} · ${item.client_source}`,
            payload: parseAuditPayload(item.payload_json)
          })),
          page: 1,
          page_size: 100,
          total: rows?.results?.length || 0
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/audit/events');
      }
    }
  );

  app.get(
    '/api/v1/platform/audit/logs',
    requireRoles(['platform_admin', 'station_supervisor', 'document_desk']),
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
          `
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
            before: item.from_value || '未设置',
            after: item.to_value,
            result: '运行中',
            actor: item.triggered_by,
            note: item.reason || ''
          })),
          page: 1,
          page_size: 100,
          total: rows?.results?.length || 0
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /platform/audit/logs');
      }
    }
  );

  app.get(
    '/api/v1/station/documents/:documentId/download',
    requireRoles(['station_supervisor', 'document_desk', 'check_worker', 'delivery_desk']),
    async (c) => {
      try {
        const row = await c.env.DB?.prepare(
          `
            SELECT document_name, storage_key
            FROM documents
            WHERE document_id = ?
              AND deleted_at IS NULL
            LIMIT 1
          `
        )
          .bind(c.req.param('documentId'))
          .first<{ document_name: string; storage_key: string }>();

        if (!row) {
          return jsonError(c, 404, 'RESOURCE_NOT_FOUND', 'Document does not exist', {
            document_id: c.req.param('documentId')
          });
        }

        const object = await c.env.FILES?.get(row.storage_key);

        if (!object) {
          return jsonError(c, 404, 'RESOURCE_NOT_FOUND', 'Document content does not exist in object storage', {
            document_id: c.req.param('documentId'),
            storage_key: row.storage_key
          });
        }

        return new Response(object.body, {
          headers: {
            'Content-Disposition': `attachment; filename="${row.document_name}"`,
            'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream'
          }
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/documents/:documentId/download');
      }
    }
  );

  app.get(
    '/api/v1/station/tasks',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationTasks(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/tasks');
      }
    }
  );

  app.get(
    '/api/v1/station/tasks/overview',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const overview = await loadStationTasksOverview(c.env.DB, stationId);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/tasks/overview');
      }
    }
  );

  app.post('/api/v1/station/tasks/:taskId/assign', requireRoles(['station_supervisor']), async (c) => {
    try {
      const input = await c.req.json();
      authorizeTaskAssignment(c.var.actor, input);
      const services = getStationServices(c);
      const result = await services.assignTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/tasks/:taskId/assign');
    }
  });

  app.post('/api/v1/station/tasks/:taskId/verify', requireRoles(['station_supervisor', 'check_worker']), async (c) => {
    try {
      const input = await c.req.json().catch(() => ({}));
      const services = getStationServices(c);
      const result = await services.verifyTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/tasks/:taskId/verify');
    }
  });

  app.post('/api/v1/station/tasks/:taskId/rework', requireRoles(['station_supervisor', 'check_worker']), async (c) => {
    try {
      const input = await c.req.json().catch(() => ({}));
      const services = getStationServices(c);
      const result = await services.reworkTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/tasks/:taskId/rework');
    }
  });

  app.post('/api/v1/station/tasks/:taskId/escalate', requireRoles(['station_supervisor', 'check_worker']), async (c) => {
    try {
      const input = await c.req.json().catch(() => ({}));
      const services = getStationServices(c);
      const result = await services.escalateTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /station/tasks/:taskId/escalate');
    }
  });

  app.post(
    '/api/v1/station/tasks/:taskId/exception',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'mobile_operator']),
    async (c) => {
      try {
        const input = await c.req.json();
        const services = getStationServices(c);
        const result = await services.raiseTaskException(c.req.param('taskId'), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/tasks/:taskId/exception');
      }
    }
  );

  app.get(
    '/api/v1/station/exceptions',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.listStationExceptions(normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json(result);
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/exceptions');
      }
    }
  );

  app.get(
    '/api/v1/station/exceptions/overview',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await loadStationExceptionsOverview(services, normalizeStationListQuery(c.var.actor, c.req.query()));
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/exceptions/overview');
      }
    }
  );

  app.get(
    '/api/v1/station/exceptions/daily',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const stationId = c.var.actor.stationScope?.[0] || c.req.query('station_id') || 'MME';
        const date = c.req.query('date');

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'date must be in YYYY-MM-DD format');
        }

        const reportDate = normalizeDailyReportDate(date);
        const overview = await loadStationExceptionsDaily(c.env.DB, stationId, reportDate);

        return c.json({ data: overview });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/exceptions/daily');
      }
    }
  );

  app.get(
    '/api/v1/station/exceptions/:exceptionId',
    requireRoles(['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const result = await services.getStationException(c.req.param('exceptionId'));

        if (!result) {
          return jsonError(c, 404, 'EXCEPTION_NOT_FOUND', 'Exception does not exist', {
            exception_id: c.req.param('exceptionId')
          });
        }

        const hasGatePolicySummary =
          Boolean((result as any).gate_policy_summary || (result as any).gatePolicySummary) &&
          Boolean((result as any).gate_policy_overview || (result as any).gatePolicyOverview);
        const payload = hasGatePolicySummary ? result : { ...result, ...buildStationExceptionGatePolicySummary(result) };

        return c.json({ data: payload });
      } catch (error) {
        return handleServiceError(c, error, 'GET /station/exceptions/:exceptionId');
      }
    }
  );

  app.post(
    '/api/v1/station/exceptions/:exceptionId/resolve',
    requireRoles(['station_supervisor', 'check_worker', 'document_desk', 'delivery_desk']),
    async (c) => {
      try {
        const input = await c.req.json().catch(() => ({}));
        const services = getStationServices(c);
        const result = await services.resolveStationException(c.req.param('exceptionId'), input);
        return c.json({ data: result });
      } catch (error) {
        return handleServiceError(c, error, 'POST /station/exceptions/:exceptionId/resolve');
      }
    }
  );
}
