import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  allowLocalOnlyAuth,
  buildActorFromClaims,
  buildActorFromHeaders,
  hasDebugActorHeaders,
  hasAnyRole,
  resolveAuthTokenSecret,
  verifyAuthToken,
  type AuthActor
} from '@sinoport/auth';
import { createStationServices } from '@sinoport/domain';
import type { RoleCode } from '@sinoport/contracts';
import {
  createRepositoryRegistry,
  RepositoryOperationError,
  type D1DatabaseLike
} from '@sinoport/repositories';
import { listAgentToolsForRoles } from '@sinoport/tools';
import { listWorkflowsForStationContext } from '@sinoport/workflows';

type AgentBindings = {
  APP_NAME?: string;
  APP_DEPLOYED_AT?: string;
  APP_RELEASE_TAG?: string;
  APP_VERSION?: string;
  AUTH_TOKEN_SECRET?: string;
  DB?: D1DatabaseLike;
  ENVIRONMENT?: string;
  ENABLE_LOCAL_DEBUG_AUTH?: string;
};

type AgentVariables = {
  actor: AuthActor;
};

const M10_TOOL_DENYLIST = new Set(['request_task_assignment']);

function listCopilotValidationTools(roleIds: RoleCode[] = []) {
  return listAgentToolsForRoles(roleIds).filter((tool) => !M10_TOOL_DENYLIST.has(tool.name));
}

const app = new Hono<{
  Bindings: AgentBindings;
  Variables: AgentVariables;
}>();

app.use(
  '/api/v1/*',
  cors({
    origin: '*',
    allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-Client-Source', 'Idempotency-Key'],
    allowMethods: ['GET', 'POST', 'OPTIONS']
  })
);

app.use('/api/v1/*', async (c, next) => {
  if (c.req.path === '/api/v1/healthz') {
    await next();
    return;
  }

  const authorization = c.req.header('Authorization');
  const localDebugAuthEnabled = allowLocalOnlyAuth(c.env.ENVIRONMENT, c.env.ENABLE_LOCAL_DEBUG_AUTH);
  if (!authorization) {
    if (localDebugAuthEnabled && hasDebugActorHeaders(c.req.raw.headers)) {
      const actor = buildActorFromHeaders(c.req.raw.headers);
      c.set('actor', actor);
      await next();
      return;
    }
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header', details: {} } }, 401);
  }

  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  let secret: string;

  try {
    secret = resolveAuthTokenSecret(c.env.AUTH_TOKEN_SECRET, c.env.ENVIRONMENT);
  } catch (error) {
    return c.json({ error: { code: 'AUTH_CONFIG_ERROR', message: error instanceof Error ? error.message : 'Missing auth secret', details: {} } }, 500);
  }

  if (token && token !== 'demo-token') {
    const claims = await verifyAuthToken(token, secret);
    if (claims) {
      c.set('actor', buildActorFromClaims(claims));
      await next();
      return;
    }
  }

  if (localDebugAuthEnabled && token === 'demo-token') {
    c.set('actor', buildActorFromHeaders(c.req.raw.headers));
    await next();
    return;
  }

  return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token', details: {} } }, 401);
});

function getStationServices(c: any) {
  return createStationServices(
    createRepositoryRegistry({
      actor: c.var.actor,
      db: c.env.DB,
      requestId: c.req.header('X-Request-Id') ?? crypto.randomUUID()
    })
  );
}

function buildSystemPrompt(actor: AuthActor, objectType?: string, objectKey?: string) {
  const stationScope = actor.stationScope?.join(', ') || 'N/A';
  const roleScope = actor.roleIds?.join(', ') || 'N/A';

  return [
    'You are the Sinoport station copilot.',
    `Current client source: ${actor.clientSource}`,
    `Current tenant: ${actor.tenantId}`,
    `Current stations: ${stationScope}`,
    `Current roles: ${roleScope}`,
    objectType && objectKey ? `Current object focus: ${objectType} / ${objectKey}` : 'Current object focus: station-wide view',
    objectType === 'Document' ? 'Document workflows to surface: document-parse, document-validate' : null,
    'Use only the available tools and stay within the actor station scope and role scope.',
    'Escalate when a release gate is blocking the main workflow or when evidence is missing.'
  ]
    .filter(Boolean)
    .join('\n');
}

function parseAgentJson(value: string | null | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function ensureRole(actor: AuthActor, toolName: string) {
  const tool = listCopilotValidationTools(actor.roleIds).find((item) => item.name === toolName);

  if (!tool) {
    throw new Error('FORBIDDEN_TOOL');
  }

  if (!hasAnyRole(actor, tool.requiredRoles)) {
    throw new Error('FORBIDDEN_TOOL');
  }

  return tool;
}

async function resolveFlightByKey(db: D1DatabaseLike | undefined, flightKey?: string) {
  if (!db || !flightKey) return null;

  return (await db
    .prepare(
      `
        SELECT flight_id
        FROM flights
        WHERE flight_id = ?
           OR flight_no = ?
        LIMIT 1
      `
    )
    .bind(flightKey, flightKey)
    .first()) as { flight_id: string } | null;
}

async function resolveAwbScope(db: D1DatabaseLike | undefined, objectKey?: string) {
  if (!db || !objectKey) return null;

  return (await db
    .prepare(
      `
        SELECT awb_id, shipment_id, flight_id
        FROM awbs
        WHERE awb_id = ?
           OR awb_no = ?
        LIMIT 1
      `
    )
    .bind(objectKey, objectKey)
    .first()) as { awb_id: string; shipment_id: string | null; flight_id: string | null } | null;
}

function summarizeAgentJson(value: unknown) {
  if (value == null) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length ? `${value.length} items` : null;
  if (typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  if (typeof record.summary === 'string' && record.summary.trim()) return record.summary.trim();
  if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
  if (typeof record.detail === 'string' && record.detail.trim()) return record.detail.trim();
  if (typeof record.reason === 'string' && record.reason.trim()) return record.reason.trim();
  if (typeof record.status === 'string' && record.status.trim()) return record.status.trim();
  if (typeof record.passed === 'boolean') return record.passed ? 'passed' : 'blocked';

  const keys = ['issues', 'errors', 'warnings', 'checks', 'steps'].filter((key) => Array.isArray(record[key]) && (record[key] as unknown[]).length > 0);
  if (keys.length) {
    return keys.map((key) => `${key}:${(record[key] as unknown[]).length}`).join(', ');
  }

  return Object.keys(record).length ? Object.keys(record).slice(0, 4).join(', ') : null;
}

function buildDocumentThresholds(documentRow: any, parsedSummary: string | null, validationSummary: string | null) {
  const requiredForRelease = Boolean(documentRow.required_for_release);

  return [
    {
      name: 'release_gate',
      label: 'Release gate',
      status: requiredForRelease ? 'required' : 'optional',
      note: requiredForRelease ? 'Document must pass validation before release.' : 'Document is informational only.'
    },
    {
      name: 'parse_workflow',
      label: 'document-parse',
      status: parsedSummary ? 'available' : 'recommended',
      note: parsedSummary || 'No parsed body summary stored yet.'
    },
    {
      name: 'validate_workflow',
      label: 'document-validate',
      status: validationSummary ? 'available' : 'recommended',
      note: validationSummary || 'No validation result stored yet.'
    }
  ];
}

function buildDocumentRecommendedWorkflows() {
  return ['document-parse', 'document-validate'];
}

async function resolveStationDocumentContext(db: D1DatabaseLike | undefined, stationId: string | undefined, objectKey?: string) {
  if (!db || !objectKey) return null;

  const stationScope = stationId || 'MME';
  const document = (await db
    .prepare(
      `
        SELECT
          d.document_id,
          d.station_id,
          d.document_type,
          d.document_name,
          d.related_object_type,
          d.related_object_id,
          d.parent_document_id,
          d.version_no,
          d.document_status,
          d.required_for_release,
          d.storage_key,
          d.uploaded_by,
          d.uploaded_at,
          d.updated_at,
          d.parsed_result_json,
          d.validation_result_json,
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
          AND (
            d.document_id = ?
            OR d.document_name = ?
            OR d.document_id LIKE ?
            OR d.document_name LIKE ?
          )
        ORDER BY
          CASE
            WHEN d.document_id = ? THEN 0
            WHEN d.document_name = ? THEN 1
            ELSE 2
          END,
          d.uploaded_at DESC,
          d.document_id DESC
        LIMIT 1
      `
    )
    .bind(stationScope, objectKey, objectKey, `%${objectKey}%`, `%${objectKey}%`, objectKey, objectKey)
    .first()) as
    | {
        document_id: string;
        station_id: string;
        document_type: string;
        document_name: string;
        related_object_type: string;
        related_object_id: string;
        parent_document_id: string | null;
        version_no: string;
        document_status: string;
        required_for_release: number | string | boolean;
        storage_key: string;
        uploaded_by: string | null;
        uploaded_at: string | null;
        updated_at: string | null;
        parsed_result_json: string | null;
        validation_result_json: string | null;
        note: string | null;
        related_object_label: string | null;
      }
    | null;

  if (!document) return null;

  const parsedResult = parseAgentJson(document.parsed_result_json);
  const validationResult = parseAgentJson(document.validation_result_json);
  const parsedSummary = summarizeAgentJson(parsedResult);
  const validationSummary = summarizeAgentJson(validationResult);

  const [versionRows, taskRows, exceptionRows] = await Promise.all([
    db
      .prepare(
        `
          SELECT
            document_id,
            document_name,
            version_no,
            document_status,
            required_for_release,
            parent_document_id,
            uploaded_at,
            updated_at,
            note
          FROM documents
          WHERE station_id = ?
            AND deleted_at IS NULL
            AND related_object_type = ?
            AND related_object_id = ?
            AND document_type = ?
          ORDER BY uploaded_at DESC, document_id DESC
          LIMIT 6
        `
      )
      .bind(stationScope, document.related_object_type, document.related_object_id, document.document_type)
      .all(),
    db
      .prepare(
        `
          SELECT
            task_id,
            task_type,
            execution_node,
            task_status,
            blocker_code,
            due_at,
            assigned_role,
            assigned_team_id,
            assigned_worker_id,
            evidence_required
          FROM tasks
          WHERE station_id = ?
            AND related_object_type = ?
            AND related_object_id = ?
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 6
        `
      )
      .bind(stationScope, document.related_object_type, document.related_object_id)
      .all(),
    db
      .prepare(
        `
          SELECT
            exception_id,
            exception_type,
            exception_status,
            severity,
            blocker_flag,
            root_cause,
            linked_task_id,
            related_object_type,
            related_object_id
          FROM exceptions
          WHERE station_id = ?
            AND (
              (related_object_type = ? AND related_object_id = ?)
              OR linked_task_id IN (
                SELECT task_id
                FROM tasks
                WHERE station_id = ?
                  AND related_object_type = ?
                  AND related_object_id = ?
              )
            )
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 6
        `
      )
      .bind(stationScope, document.related_object_type, document.related_object_id, stationScope, document.related_object_type, document.related_object_id)
      .all()
  ]);

  const versionChain = (versionRows?.results || []).map((row: any) => ({
    document_id: row.document_id,
    document_name: row.document_name,
    version_no: row.version_no,
    document_status: row.document_status,
    required_for_release: Boolean(row.required_for_release),
    parent_document_id: row.parent_document_id || null,
    uploaded_at: row.uploaded_at || null,
    updated_at: row.updated_at || null,
    note: row.note || null
  }));

  const relatedTasks = (taskRows?.results || []).map((row: any) => ({
    task_id: row.task_id,
    task_type: row.task_type,
    execution_node: row.execution_node,
    task_status: row.task_status,
    blocker_code: row.blocker_code || null,
    due_at: row.due_at || null,
    assigned_role: row.assigned_role || null,
    assigned_team_id: row.assigned_team_id || null,
    assigned_worker_id: row.assigned_worker_id || null,
    evidence_required: Boolean(row.evidence_required)
  }));

  const relatedExceptions = (exceptionRows?.results || []).map((row: any) => ({
    exception_id: row.exception_id,
    exception_type: row.exception_type,
    exception_status: row.exception_status,
    severity: row.severity,
    blocker_flag: Boolean(row.blocker_flag),
    root_cause: row.root_cause || null,
    linked_task_id: row.linked_task_id || null,
    related_object_type: row.related_object_type,
    related_object_id: row.related_object_id
  }));

  const bodySummary =
    parsedSummary ||
    document.note ||
    `${document.document_type} ${document.version_no} · ${document.document_status}` ||
    document.document_name;

  const recommendedWorkflows = buildDocumentRecommendedWorkflows();
  const thresholds = buildDocumentThresholds(document, parsedSummary, validationSummary);

  return {
    document_id: document.document_id,
    document_type: document.document_type,
    document_name: document.document_name,
    body_summary: bodySummary,
    version_no: document.version_no,
    document_status: document.document_status,
    required_for_release: Boolean(document.required_for_release),
    related_object_type: document.related_object_type,
    related_object_id: document.related_object_id,
    related_object_label: document.related_object_label || document.related_object_id,
    parent_document_id: document.parent_document_id || null,
    storage_key: document.storage_key,
    uploaded_by: document.uploaded_by || null,
    uploaded_at: document.uploaded_at || null,
    updated_at: document.updated_at || null,
    parsed_summary: parsedSummary,
    validation_summary: validationSummary,
    thresholds,
    version_chain: versionChain,
    related_tasks: relatedTasks,
    related_exceptions: relatedExceptions,
    recommended_workflows: recommendedWorkflows,
    recommended_actions: [
      'Review the body summary and version chain.',
      'Run document-parse to refresh extracted metadata.',
      'Run document-validate to confirm release gate readiness.',
      'Check related tasks and exceptions before escalating or releasing.'
    ]
  };
}

function buildPlanSteps(actor: AuthActor, objectType?: string, objectKey?: string) {
  if (objectType === 'Shipment') {
    return [
      `Load shipment chain context for ${objectKey}`,
      'Check linked AWB, flight, documents, tasks, and exceptions',
      actor.roleIds.includes('station_supervisor') ? 'Choose resolve, re-route, or escalate action' : 'Prepare read-only recovery recommendation'
    ];
  }

  if (objectType === 'Exception') {
    return [
      `Load exception detail for ${objectKey}`,
      'Inspect root cause, linked task, and recovery action',
      actor.roleIds.includes('station_supervisor') ? 'Execute resolve or escalation path through the formal API' : 'Prepare read-only recovery recommendation'
    ];
  }

  if (objectType === 'Document') {
    return [
      `Load document context for ${objectKey}`,
      'Review the body summary, version chain, and release gate thresholds',
      'Run document-parse, then document-validate before release or escalation'
    ];
  }

  return [
    objectType && objectKey ? `Load focused context for ${objectType} / ${objectKey}` : 'Load station-level context',
    'Check release-blocking documents and open exceptions',
    actor.roleIds.includes('station_supervisor') ? 'Prepare read-only escalation recommendation' : 'Prepare read-only operational recommendation'
  ];
}

async function recordAgentMessage(db: D1DatabaseLike | undefined, sessionId: string, role: string, content: string, toolName?: string | null) {
  if (!db) return;

  await db
    .prepare(
      `
        INSERT INTO agent_messages (
          message_id,
          session_id,
          role,
          content,
          tool_name,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .bind(`MSG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, sessionId, role, content, toolName ?? null, new Date().toISOString())
    .run();
}

async function recordAgentRun(
  db: D1DatabaseLike | undefined,
  sessionId: string,
  status: string,
  toolName: string | null,
  inputJson: unknown,
  outputJson: unknown,
  errorMessage?: string | null
) {
  if (!db) return;

  await db
    .prepare(
      `
        INSERT INTO agent_runs (
          run_id,
          session_id,
          status,
          tool_name,
          input_json,
          output_json,
          error_message,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      `RUN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      sessionId,
      status,
      toolName,
      inputJson ? JSON.stringify(inputJson) : null,
      outputJson ? JSON.stringify(outputJson) : null,
      errorMessage ?? null,
      new Date().toISOString(),
      new Date().toISOString()
    )
    .run();

  await db
    .prepare(`UPDATE agent_sessions SET updated_at = ? WHERE session_id = ?`)
    .bind(new Date().toISOString(), sessionId)
    .run();
}

async function executeToolByName(c: any, toolName: string, body: any) {
  const actor = c.var.actor;
  ensureRole(actor, toolName);
  const services = getStationServices(c);

  if (toolName === 'get_flight_context') {
    const flightKey = body.flight_id || body.flight_no || body.object_key;
    const flight = await resolveFlightByKey(c.env.DB, flightKey);
    if (!flight?.flight_id) {
      return { status: 404, error: { code: 'FLIGHT_NOT_FOUND', message: 'Flight does not exist', details: { flight_key: flightKey } } };
    }

    return { status: 200, data: await services.getInboundFlight(flight.flight_id) };
  }

  if (toolName === 'get_outbound_flight_context') {
    const flightKey = body.flight_id || body.flight_no || body.object_key;
    const flight = await resolveFlightByKey(c.env.DB, flightKey);
    if (!flight?.flight_id) {
      return { status: 404, error: { code: 'FLIGHT_NOT_FOUND', message: 'Flight does not exist', details: { flight_key: flightKey } } };
    }

    return { status: 200, data: await services.getOutboundFlight(flight.flight_id) };
  }

  if (toolName === 'get_outbound_waybill_context') {
    const awbScope = await resolveAwbScope(c.env.DB, body.object_key || body.awb_id || body.awb_no);
    if (!awbScope?.awb_id) {
      return { status: 404, error: { code: 'AWB_NOT_FOUND', message: 'AWB does not exist', details: { object_key: body.object_key } } };
    }
    return { status: 200, data: await services.getOutboundWaybill(awbScope.awb_id) };
  }

  if (toolName === 'get_station_shipment_context') {
    const shipmentKey = body.object_key || body.shipment_id || body.awb_no || body.awb_id;
    if (!shipmentKey) {
      return { status: 400, error: { code: 'VALIDATION_ERROR', message: 'object_key is required', details: {} } };
    }
    const shipment = await services.getStationShipment(shipmentKey);
    if (!shipment) {
      return { status: 404, error: { code: 'SHIPMENT_NOT_FOUND', message: 'Shipment does not exist', details: { object_key: shipmentKey } } };
    }
    return { status: 200, data: shipment };
  }

  if (toolName === 'get_station_exception_context') {
    const exceptionId = body.object_key || body.exception_id;
    if (!exceptionId) {
      return { status: 400, error: { code: 'VALIDATION_ERROR', message: 'object_key is required', details: {} } };
    }
    const exception = await services.getStationException(exceptionId);
    if (!exception) {
      return { status: 404, error: { code: 'EXCEPTION_NOT_FOUND', message: 'Exception does not exist', details: { object_key: exceptionId } } };
    }
    return { status: 200, data: exception };
  }

  if (toolName === 'get_station_document_context') {
    const documentKey = body.object_key || body.document_id || body.document_key;
    if (!documentKey) {
      return { status: 400, error: { code: 'VALIDATION_ERROR', message: 'object_key is required', details: {} } };
    }

    const context = await resolveStationDocumentContext(c.env.DB, actor.stationScope[0] || 'MME', documentKey);
    if (!context) {
      return { status: 404, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document does not exist', details: { object_key: documentKey } } };
    }

    return { status: 200, data: context };
  }

  if (toolName === 'list_blocking_documents') {
    const objectType = body.object_type || 'AWB';
    const objectKey = body.object_key || body.awb_no || body.awb_id || body.flight_no || body.flight_id;

    if (objectType === 'Flight') {
      const flight = await resolveFlightByKey(c.env.DB, objectKey);
      const detail = flight?.flight_id ? await services.getInboundFlight(flight.flight_id) : null;
      const items = (detail?.document_summary || []).filter(
        (item) => item.required_for_release && !['Released', 'Approved', 'Validated'].includes(item.document_status)
      );
      return { status: 200, data: { items } };
    }

    if (objectType === 'OutboundFlight') {
      const flight = await resolveFlightByKey(c.env.DB, objectKey);
      const detail = flight?.flight_id ? await services.getOutboundFlight(flight.flight_id) : null;
      const items = (detail?.document_summary || []).filter(
        (item) => item.required_for_release && !['Released', 'Approved', 'Validated'].includes(item.document_status)
      );
      return { status: 200, data: { items } };
    }

    const awbScope = await resolveAwbScope(c.env.DB, objectKey);
    const detail = awbScope?.awb_id ? await services.getInboundWaybill(awbScope.awb_id) : null;
    const items = (detail?.documents || []).filter(
      (item) => item.required_for_release && !['Released', 'Approved', 'Validated'].includes(item.document_status)
    );
    return { status: 200, data: { items } };
  }

  if (toolName === 'list_open_exceptions') {
    const objectType = body.object_type;
    const objectKey = body.object_key || body.flight_no || body.flight_id || body.awb_no || body.awb_id;
    const result = await services.listStationExceptions({
      station_id: actor.stationScope[0] || 'MME',
      ...(objectType ? { related_object_type: objectType } : {}),
      ...(objectKey ? { keyword: objectKey } : {})
    });
    return { status: 200, data: result };
  }

  if (toolName === 'get_object_audit') {
    const objectType = body.object_type;
    const objectKey = body.object_key;

    const [events, transitions] = await Promise.all([
      c.env.DB
        ?.prepare(
          `
            SELECT audit_id, actor_id, actor_role, action, object_type, object_id, summary, created_at
            FROM audit_events
            WHERE object_type = ?
              AND object_id IN (?, (SELECT flight_id FROM flights WHERE flight_no = ? LIMIT 1), (SELECT awb_id FROM awbs WHERE awb_no = ? LIMIT 1))
            ORDER BY created_at DESC
            LIMIT 20
          `
        )
        .bind(objectType, objectKey, objectKey, objectKey)
        .all(),
      c.env.DB
        ?.prepare(
          `
            SELECT transition_id, object_type, object_id, state_field, from_value, to_value, triggered_by, triggered_at, reason
            FROM state_transitions
            WHERE object_type = ?
              AND object_id IN (?, (SELECT flight_id FROM flights WHERE flight_no = ? LIMIT 1), (SELECT awb_id FROM awbs WHERE awb_no = ? LIMIT 1))
            ORDER BY triggered_at DESC
            LIMIT 20
          `
        )
        .bind(objectType, objectKey, objectKey, objectKey)
        .all()
    ]);

    return { status: 200, data: { events: events?.results || [], transitions: transitions?.results || [] } };
  }

  if (toolName === 'request_task_assignment') {
    const taskId = body.task_id;
    if (!taskId) {
      return { status: 400, error: { code: 'VALIDATION_ERROR', message: 'task_id is required', details: {} } };
    }

    return {
      status: 200,
      data: await services.assignTask(taskId, {
        assigned_role: body.assigned_role || 'inbound_operator',
        assigned_team_id: body.assigned_team_id || 'TEAM-IN-01',
        assigned_worker_id: body.assigned_worker_id || 'WORKER-PDA-001',
        due_at: body.due_at || undefined,
        task_sla: body.task_sla || undefined,
        reason: body.reason || 'Requested from agent worker'
      })
    };
  }

  return { status: 501, error: { code: 'NOT_IMPLEMENTED', message: `${toolName} is not implemented`, details: {} } };
}

async function buildAssistantReply(c: any, sessionId: string, message: string, focus: { object_type?: string; object_key?: string }) {
  const actor = c.var.actor;
  const lower = message.toLowerCase();
  const steps = buildPlanSteps(actor, focus.object_type, focus.object_key);
  let usedTool = null as string | null;
  let toolResult: any = null;

  if (focus.object_type && focus.object_key) {
    if (focus.object_type === 'Flight') {
      usedTool = 'get_flight_context';
      toolResult = await executeToolByName(c, usedTool, { object_key: focus.object_key });
    } else if (focus.object_type === 'OutboundFlight') {
      usedTool = 'get_outbound_flight_context';
      toolResult = await executeToolByName(c, usedTool, { object_key: focus.object_key });
    } else if (focus.object_type === 'AWB') {
      usedTool = 'list_blocking_documents';
      toolResult = await executeToolByName(c, usedTool, { object_type: 'AWB', object_key: focus.object_key });
    } else if (focus.object_type === 'Shipment') {
      usedTool = 'get_station_shipment_context';
      toolResult = await executeToolByName(c, usedTool, { object_type: 'Shipment', object_key: focus.object_key });
    } else if (focus.object_type === 'Exception') {
      usedTool = 'get_station_exception_context';
      toolResult = await executeToolByName(c, usedTool, { object_type: 'Exception', object_key: focus.object_key });
    } else if (focus.object_type === 'Document') {
      usedTool = 'get_station_document_context';
      toolResult = await executeToolByName(c, usedTool, { object_type: 'Document', object_key: focus.object_key });
    }
  } else if (lower.includes('异常')) {
    usedTool = 'list_open_exceptions';
    toolResult = await executeToolByName(c, usedTool, { object_type: 'Flight', object_key: 'SE803' });
  }

  const lines = [
    focus.object_type && focus.object_key ? `当前聚焦对象：${focus.object_type} / ${focus.object_key}` : '当前聚焦对象：站点视图',
    `建议步骤：${steps.join(' -> ')}`
  ];

  if (toolResult?.data?.flight?.flight_no) {
    lines.push(`已加载航班 ${toolResult.data.flight.flight_no}，当前运行态 ${toolResult.data.flight.runtime_status}。`);
  }

  if (Array.isArray(toolResult?.data?.items)) {
    lines.push(`已检查到 ${toolResult.data.items.length} 条相关结果。`);
  }

  if (toolResult?.data?.total) {
    lines.push(`当前共有 ${toolResult.data.total} 条对象记录命中。`);
  }

  if (toolResult?.data?.summary?.route) {
    lines.push(
      `已加载 Shipment ${toolResult.data.title || focus.object_key}，${toolResult.data.summary.direction} · ${toolResult.data.summary.route}。`
    );
  }

  if (toolResult?.data?.recovery_action) {
    lines.push(`建议恢复动作：${toolResult.data.recovery_action}。`);
  }

  if (toolResult?.data?.related_object_label && toolResult?.data?.exception_id) {
    lines.push(`已加载异常 ${toolResult.data.exception_id}，关联对象 ${toolResult.data.related_object_label}。`);
  }

  if (toolResult?.data?.document_id) {
    lines.push(
      `已加载文档 ${toolResult.data.document_id}，版本 ${toolResult.data.version_no || '--'}，状态 ${toolResult.data.document_status || '--'}。`
    );
  }

  if (toolResult?.data?.body_summary) {
    lines.push(`文档摘要：${toolResult.data.body_summary}`);
  }

  if (toolResult?.data?.thresholds?.length) {
    lines.push(
      `门槛：${toolResult.data.thresholds
        .map((item: any) => `${item.label}:${item.status}`)
        .join(' / ')}`
    );
  }

  if (toolResult?.data?.recommended_workflows?.length) {
    lines.push(`推荐工作流：${toolResult.data.recommended_workflows.join(' -> ')}`);
  }

  if (Array.isArray(toolResult?.data?.related_tasks) || Array.isArray(toolResult?.data?.related_exceptions)) {
    lines.push(
      `关联明细：${toolResult.data.related_tasks?.length || 0} 个任务 / ${toolResult.data.related_exceptions?.length || 0} 个异常。`
    );
  }

  if (Array.isArray(toolResult?.data?.documents) || Array.isArray(toolResult?.data?.tasks) || Array.isArray(toolResult?.data?.exceptions)) {
    lines.push(
      `关联明细：${toolResult.data.documents?.length || 0} 个文档 / ${toolResult.data.tasks?.length || 0} 个任务 / ${toolResult.data.exceptions?.length || 0} 个异常。`
    );
  }

  if (Array.isArray(toolResult?.data?.related_files)) {
    lines.push(`已关联 ${toolResult.data.related_files.length} 个相关文件。`);
  }

  if (toolResult?.error) {
    lines.push(`工具调用失败：${toolResult.error.message || toolResult.error.code || 'unknown'}`);
  }

  lines.push('如需继续执行，请在右侧工具面板选择正式工具；所有写动作仍会走业务 API 并受权限控制。');

  if (usedTool) {
    await recordAgentRun(c.env.DB, sessionId, toolResult?.error ? 'failed' : 'completed', usedTool, { message, focus }, toolResult?.data, toolResult?.error?.message);
  }

  return {
    text: lines.join('\n'),
    usedTool,
    toolResult
  };
}

app.get('/api/v1/healthz', (c) =>
  c.json({
    data: {
      service: c.env.APP_NAME ?? 'sinoport-agent-worker',
      environment: c.env.ENVIRONMENT ?? 'local',
      status: 'ok',
      version: {
        sha: c.env.APP_VERSION ?? null,
        tag: c.env.APP_RELEASE_TAG ?? null,
        deployed_at: c.env.APP_DEPLOYED_AT ?? null
      }
    }
  })
);

app.get('/api/v1/agent/tools', (c) =>
  c.json({
    items: listCopilotValidationTools(c.var.actor.roleIds)
  })
);

app.get('/api/v1/agent/workflows', (c) =>
  c.json({
    items: listWorkflowsForStationContext()
  })
);

app.get('/api/v1/agent/sessions', async (c) => {
  const rows = await c.env.DB
    ?.prepare(
      `
        SELECT session_id, object_type, object_key, status, summary, created_at, updated_at
        FROM agent_sessions
        WHERE actor_id = ?
          AND station_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 30
      `
    )
    .bind(c.var.actor.userId, c.var.actor.stationScope[0] || 'MME')
    .all();

  return c.json({
    items: (rows?.results || []).map((row: any) => ({
      session_id: row.session_id,
      object_type: row.object_type,
      object_key: row.object_key,
      status: row.status,
      summary: row.summary,
      created_at: row.created_at,
      updated_at: row.updated_at
    }))
  });
});

app.post('/api/v1/agent/sessions', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = `SES-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  await c.env.DB?.prepare(
    `
      INSERT INTO agent_sessions (
        session_id,
        station_id,
        actor_id,
        object_type,
        object_key,
        status,
        summary,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      sessionId,
      c.var.actor.stationScope[0] || 'MME',
      c.var.actor.userId,
      body.object_type || null,
      body.object_key || null,
      'active',
      body.summary || null,
      now,
      now
    )
    .run();

  if (body.initial_message) {
    await recordAgentMessage(c.env.DB, sessionId, 'user', String(body.initial_message));
  }

  return c.json(
    {
      data: {
        session_id: sessionId,
        object_type: body.object_type || null,
        object_key: body.object_key || null,
        status: 'active'
      }
    },
    201
  );
});

app.get('/api/v1/agent/sessions/:sessionId', async (c) => {
  const session = await c.env.DB
    ?.prepare(
      `
        SELECT session_id, station_id, actor_id, object_type, object_key, status, summary, created_at, updated_at
        FROM agent_sessions
        WHERE session_id = ?
        LIMIT 1
      `
    )
    .bind(c.req.param('sessionId'))
    .first();

  if (!session) {
    return c.json({ error: { code: 'SESSION_NOT_FOUND', message: 'Session does not exist', details: {} } }, 404);
  }

  const messages = await c.env.DB
    ?.prepare(
      `
        SELECT message_id, role, content, tool_name, created_at
        FROM agent_messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `
    )
    .bind(c.req.param('sessionId'))
    .all();

  const runs = await c.env.DB
    ?.prepare(
      `
        SELECT run_id, status, tool_name, input_json, output_json, error_message, created_at, updated_at
        FROM agent_runs
        WHERE session_id = ?
        ORDER BY created_at ASC
      `
    )
    .bind(c.req.param('sessionId'))
    .all();

  return c.json({
    data: {
      ...session,
      messages: messages?.results || [],
      runs: (runs?.results || []).map((row: any) => ({
        ...row,
        input_json: parseAgentJson(row.input_json),
        output_json: parseAgentJson(row.output_json)
      }))
    }
  });
});

app.get('/api/v1/agent/sessions/:sessionId/context', async (c) => {
  const actor = c.var.actor;
  const objectType = c.req.query('object_type') || undefined;
  const objectKey = c.req.query('object_key') || undefined;
  const tools = listCopilotValidationTools(actor.roleIds);
  const workflows = listWorkflowsForStationContext();
  const focusContext = objectType === 'Document' ? await resolveStationDocumentContext(c.env.DB, actor.stationScope[0] || 'MME', objectKey) : null;

  return c.json({
    data: {
      session_id: c.req.param('sessionId'),
      actor,
      focus: objectType && objectKey ? { object_type: objectType, object_key: objectKey } : null,
      focus_context: focusContext,
      available_tools: tools.map((tool) => tool.name),
      available_workflows: workflows.map((workflow) => workflow.name),
      recommended_workflows: objectType === 'Document' ? buildDocumentRecommendedWorkflows() : [],
      recommended_actions:
        objectType === 'Document'
          ? [
              'Review the body summary and version chain.',
              'Run document-parse to refresh extracted metadata.',
              'Run document-validate to confirm release gate readiness.',
              'Check related tasks and exceptions before escalating or releasing.'
            ]
          : buildPlanSteps(actor, objectType, objectKey),
      system_prompt: buildSystemPrompt(actor, objectType, objectKey)
    }
  });
});

app.get('/api/v1/agent/sessions/:sessionId/plan', (c) => {
  const actor = c.var.actor;
  const objectType = c.req.query('object_type') || undefined;
  const objectKey = c.req.query('object_key') || undefined;
  const tools = listCopilotValidationTools(actor.roleIds);
  const steps = buildPlanSteps(actor, objectType, objectKey);

  return c.json({
    data: {
      session_id: c.req.param('sessionId'),
      recommended_tools: tools.map((tool) => tool.name),
      recommended_workflows: objectType === 'Document' ? buildDocumentRecommendedWorkflows() : [],
      recommended_actions: steps,
      steps
    }
  });
});

app.post('/api/v1/agent/sessions/:sessionId/messages', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json().catch(() => ({}));
    const message = String(body.message || '').trim();
    const focus = {
      object_type: body.object_type || body.focus?.object_type,
      object_key: body.object_key || body.focus?.object_key
    };

    if (!message) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'message is required', details: {} } }, 400);
    }

    const session = await c.env.DB
      ?.prepare(`SELECT session_id FROM agent_sessions WHERE session_id = ? LIMIT 1`)
      .bind(sessionId)
      .first();

    if (!session) {
      return c.json({ error: { code: 'SESSION_NOT_FOUND', message: 'Session does not exist', details: {} } }, 404);
    }

    await recordAgentMessage(c.env.DB, sessionId, 'user', message);
    const reply = await buildAssistantReply(c, sessionId, message, focus);
    await recordAgentMessage(c.env.DB, sessionId, 'assistant', reply.text, reply.usedTool);
    await c.env.DB?.prepare(`UPDATE agent_sessions SET object_type = COALESCE(?, object_type), object_key = COALESCE(?, object_key), updated_at = ? WHERE session_id = ?`)
      .bind(focus.object_type ?? null, focus.object_key ?? null, new Date().toISOString(), sessionId)
      .run();

    return c.json({
      data: {
        session_id: sessionId,
        assistant_message: reply.text,
        used_tool: reply.usedTool,
        tool_result: reply.toolResult?.data || null
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN_TOOL') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Current actor cannot execute the requested tool', details: {} } }, 403);
    }

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected agent message execution error',
          details: {
            reason: error instanceof Error ? error.message : 'unknown'
          }
        }
      },
      500
    );
  }
});

app.get('/api/v1/agent/sessions/:sessionId/events', async (c) => {
  const sessionId = c.req.param('sessionId');
  const [messages, runs] = await Promise.all([
    c.env.DB
      ?.prepare(
        `
          SELECT message_id AS id, role, content, tool_name, created_at
          FROM agent_messages
          WHERE session_id = ?
          ORDER BY created_at ASC
        `
      )
      .bind(sessionId)
      .all(),
    c.env.DB
      ?.prepare(
        `
          SELECT run_id AS id, status, tool_name, output_json, error_message, created_at
          FROM agent_runs
          WHERE session_id = ?
          ORDER BY created_at ASC
        `
      )
      .bind(sessionId)
      .all()
  ]);

  return c.json({
    data: {
      messages: messages?.results || [],
      runs: (runs?.results || []).map((row: any) => ({
        ...row,
        input_json: parseAgentJson(row.input_json),
        output_json: parseAgentJson(row.output_json)
      }))
    }
  });
});

app.post('/api/v1/agent/tools/:toolName/execute', async (c) => {
  try {
    const toolName = c.req.param('toolName');
    const body = await c.req.json().catch(() => ({}));
    const result = await executeToolByName(c, toolName, body);
    if (body.session_id) {
      await recordAgentRun(c.env.DB, body.session_id, result.error ? 'failed' : 'completed', toolName, body, result.data, result.error?.message);
    }
    if (result.error) {
      return c.json({ error: result.error }, { status: result.status as 400 | 401 | 403 | 404 | 409 | 500 | 501 });
    }
    return c.json({ data: result.data }, { status: result.status as 200 | 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN_TOOL') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Current actor cannot execute the requested tool', details: {} } }, 403);
    }

    if (error instanceof RepositoryOperationError) {
      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        },
        error.httpStatus
      );
    }

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected agent tool execution error',
          details: {
            reason: error instanceof Error ? error.message : 'unknown'
          }
        }
      },
      500
    );
  }
});

export default app;
