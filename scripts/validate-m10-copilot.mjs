import { once } from 'node:events';
import { spawn } from 'node:child_process';

const PORT = 8794 + Math.floor(Math.random() * 200);
const INSPECTOR_PORT = 9436 + Math.floor(Math.random() * 200);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTH_HEADERS = {
  Authorization: 'Bearer demo-token',
  'Content-Type': 'application/json',
  'X-Debug-Roles': 'station_supervisor,document_desk',
  'X-Debug-User-Id': 'demo-supervisor',
  'X-Debug-Station-Scope': 'MME'
};

function waitForOutput(child, pattern, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${pattern}`)), timeoutMs);
    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes(pattern)) {
        clearTimeout(timeout);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolve();
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Agent worker exited early with code ${code}`));
    });
  });
}

async function stopChild(child) {
  if (!child || child.killed) return;
  child.kill('SIGINT');

  try {
    await Promise.race([
      once(child, 'exit'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for child exit.')), 10_000))
    ]);
  } catch {
    child.kill('SIGKILL');
  }
}

async function runCommand(command, args) {
  const child = spawn(command, args, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  const [code] = await once(child, 'exit');
  if (code !== 0) {
    throw new Error(output || `${command} ${args.join(' ')} failed`);
  }
}

async function jsonRequest(path, headers = AUTH_HEADERS) {
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers
  });
  const json = await response.json();
  return { ok: response.ok, status: response.status, json, durationMs: Date.now() - startedAt };
}

async function postJson(path, payload, headers = AUTH_HEADERS) {
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  return { ok: response.ok, status: response.status, json, durationMs: Date.now() - startedAt };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await runCommand('npm', ['run', 'db:migrate:local', '--workspace', '@sinoport/agent-worker']);

  const worker = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/agent-worker/wrangler.jsonc', '--port', String(PORT), '--inspector-port', String(INSPECTOR_PORT)],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
  );

  worker.stdout.pipe(process.stdout);
  worker.stderr.pipe(process.stderr);

  try {
    await waitForOutput(worker, `Ready on http://localhost:${PORT}`);

    const tools = await jsonRequest('/api/v1/agent/tools');
    assert(tools.ok, 'agent/tools failed');
    assert(Array.isArray(tools.json?.items) && tools.json.items.length > 0, 'agent/tools empty');
    assert(!tools.json.items.some((item) => item.name === 'request_task_assignment'), 'request_task_assignment should be hidden in M10');

    const createSession = await postJson('/api/v1/agent/sessions', {
      object_type: 'Flight',
      object_key: 'SE803',
      initial_message: 'Open station copilot for M10 validation'
    });
    const sessionId = createSession.json?.data?.session_id;
    assert(createSession.ok && sessionId, 'agent session create failed');

    const context = await jsonRequest(`/api/v1/agent/sessions/${sessionId}/context?object_type=Flight&object_key=SE803`);
    const plan = await jsonRequest(`/api/v1/agent/sessions/${sessionId}/plan?object_type=Flight&object_key=SE803`);
    assert(context.ok, 'agent context failed');
    assert(plan.ok, 'agent plan failed');
    assert(!context.json?.data?.available_tools?.includes('request_task_assignment'), 'context leaked request_task_assignment');
    assert(!plan.json?.data?.recommended_tools?.includes('request_task_assignment'), 'plan leaked request_task_assignment');

    const message = await postJson(`/api/v1/agent/sessions/${sessionId}/messages`, {
      message: 'Check blockers for this flight and suggest the next step',
      object_type: 'Flight',
      object_key: 'SE803'
    });
    assert(message.ok && message.json?.data?.assistant_message, 'agent message failed');

    const detail = await jsonRequest(`/api/v1/agent/sessions/${sessionId}`);
    const events = await jsonRequest(`/api/v1/agent/sessions/${sessionId}/events`);
    assert(detail.ok && Array.isArray(detail.json?.data?.messages), 'session detail missing messages');
    assert(Array.isArray(detail.json?.data?.runs) && detail.json.data.runs.length > 0, 'session detail missing runs');
    assert(events.ok && Array.isArray(events.json?.data?.messages), 'session events missing messages');
    assert(Array.isArray(events.json?.data?.runs) && events.json.data.runs.length > 0, 'session events missing runs');

    const audit = await postJson('/api/v1/agent/tools/get_object_audit/execute', {
      session_id: sessionId,
      object_type: 'Flight',
      object_key: 'SE803'
    });
    assert(audit.ok && Array.isArray(audit.json?.data?.events), 'get_object_audit failed');

    const invalidPayload = await postJson('/api/v1/agent/tools/get_station_document_context/execute', {
      session_id: sessionId
    });
    assert(!invalidPayload.ok && invalidPayload.status === 400, 'missing object_key should fail with 400');

    const notFound = await postJson('/api/v1/agent/tools/get_station_exception_context/execute', {
      session_id: sessionId,
      object_type: 'Exception',
      object_key: 'EXP-NOT-FOUND'
    });
    assert(!notFound.ok && notFound.status === 404, 'unknown exception should fail with 404');

    const forbidden = await postJson('/api/v1/agent/tools/request_task_assignment/execute', {
      session_id: sessionId,
      task_id: 'TASK-0408-201',
      reason: 'Forbidden in M10'
    });
    assert(!forbidden.ok && forbidden.status === 403, 'request_task_assignment should fail with 403');

    const unauthorized = await jsonRequest('/api/v1/agent/tools', {});
    assert(!unauthorized.ok && unauthorized.status === 401, 'missing auth should fail with 401');

    console.log('\nM10 copilot validation summary');
    console.log(`- tools hidden write actions: ${tools.status}`);
    console.log(`- session create/context/plan/message/detail/events: ${createSession.status}/${context.status}/${plan.status}/${message.status}/${detail.status}/${events.status}`);
    console.log(`- audit tool: ${audit.status}`);
    console.log(`- failures 400/404/403/401: ${invalidPayload.status}/${notFound.status}/${forbidden.status}/${unauthorized.status}`);
    console.log(`- timings ms create/context/plan/message/detail/events: ${createSession.durationMs}/${context.durationMs}/${plan.durationMs}/${message.durationMs}/${detail.durationMs}/${events.durationMs}`);
  } finally {
    await stopChild(worker);
  }
}

main().catch((error) => {
  console.error(`M10 copilot validation failed: ${error.message}`);
  process.exitCode = 1;
});
