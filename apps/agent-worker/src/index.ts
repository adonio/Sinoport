import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  buildActorFromClaims,
  buildActorFromHeaders,
  hasAnyRole,
  verifyAuthToken,
  type AuthActor
} from '@sinoport/auth';
import { createStationServices } from '@sinoport/domain';
import {
  createRepositoryRegistry,
  RepositoryOperationError,
  type D1DatabaseLike
} from '@sinoport/repositories';
import { listAgentToolsForRoles } from '@sinoport/tools';
import { listWorkflowsForStationContext } from '@sinoport/workflows';

type AgentBindings = {
  APP_NAME?: string;
  AUTH_TOKEN_SECRET?: string;
  DB?: D1DatabaseLike;
  ENVIRONMENT?: string;
};

type AgentVariables = {
  actor: AuthActor;
};

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
  const isLocal = (c.env.ENVIRONMENT || 'local') === 'local';
  if (!authorization) {
    if (isLocal) {
      const actor = buildActorFromHeaders(c.req.raw.headers);
      c.set('actor', actor);
      await next();
      return;
    }
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header', details: {} } }, 401);
  }

  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  const secret = c.env.AUTH_TOKEN_SECRET || 'sinoport-local-dev-secret';

  if (token && token !== 'demo-token') {
    const claims = await verifyAuthToken(token, secret);
    if (claims) {
      c.set('actor', buildActorFromClaims(claims));
      await next();
      return;
    }
  }

  if (isLocal && token === 'demo-token') {
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
    'Use only the available tools and stay within the actor station scope and role scope.',
    'Escalate when a release gate is blocking the main workflow or when evidence is missing.'
  ]
    .filter(Boolean)
    .join('\n');
}

function ensureRole(actor: AuthActor, toolName: string) {
  const tool = listAgentToolsForRoles(actor.roleIds).find((item) => item.name === toolName);

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

function buildPlanSteps(actor: AuthActor, objectType?: string, objectKey?: string) {
  return [
    objectType && objectKey ? `Load focused context for ${objectType} / ${objectKey}` : 'Load station-level context',
    'Check release-blocking documents and open exceptions',
    actor.roleIds.includes('station_supervisor') ? 'Prepare task assignment or escalation recommendation' : 'Prepare read-only operational recommendation'
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
      status: 'ok'
    }
  })
);

app.get('/api/v1/agent/tools', (c) =>
  c.json({
    items: listAgentToolsForRoles(c.var.actor.roleIds)
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

  return c.json({
    data: {
      ...session,
      messages: messages?.results || []
    }
  });
});

app.get('/api/v1/agent/sessions/:sessionId/context', (c) => {
  const actor = c.var.actor;
  const objectType = c.req.query('object_type') || undefined;
  const objectKey = c.req.query('object_key') || undefined;
  const tools = listAgentToolsForRoles(actor.roleIds);
  const workflows = listWorkflowsForStationContext();

  return c.json({
    data: {
      session_id: c.req.param('sessionId'),
      actor,
      focus: objectType && objectKey ? { object_type: objectType, object_key: objectKey } : null,
      available_tools: tools.map((tool) => tool.name),
      available_workflows: workflows.map((workflow) => workflow.name),
      system_prompt: buildSystemPrompt(actor, objectType, objectKey)
    }
  });
});

app.get('/api/v1/agent/sessions/:sessionId/plan', (c) => {
  const actor = c.var.actor;
  const objectType = c.req.query('object_type') || undefined;
  const objectKey = c.req.query('object_key') || undefined;
  const tools = listAgentToolsForRoles(actor.roleIds);
  const steps = buildPlanSteps(actor, objectType, objectKey);

  return c.json({
    data: {
      session_id: c.req.param('sessionId'),
      recommended_tools: tools.map((tool) => tool.name),
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
        output_json: row.output_json ? JSON.parse(row.output_json) : null
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
