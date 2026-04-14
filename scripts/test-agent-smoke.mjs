import { once } from 'node:events';
import { spawn } from 'node:child_process';

const PORT = 8794 + Math.floor(Math.random() * 200);
const INSPECTOR_PORT = 9236 + Math.floor(Math.random() * 200);
const BASE_URL = `http://127.0.0.1:${PORT}`;

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

async function jsonRequest(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: 'Bearer demo-token',
      'X-Debug-Roles': 'station_supervisor,document_desk',
      'X-Debug-User-Id': 'demo-supervisor',
      'X-Debug-Station-Scope': 'MME'
    }
  });
  const json = await response.json();
  return { ok: response.ok, status: response.status, json };
}

async function postJson(path, payload) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer demo-token',
      'Content-Type': 'application/json',
      'X-Debug-Roles': 'station_supervisor,document_desk',
      'X-Debug-User-Id': 'demo-supervisor',
      'X-Debug-Station-Scope': 'MME'
    },
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  return { ok: response.ok, status: response.status, json };
}

async function runCommand(command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });

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

  return output;
}

async function main() {
  await runCommand('npm', ['run', 'db:migrate:local', '--workspace', '@sinoport/agent-worker']);

  const worker = spawn('npx', ['wrangler', 'dev', '--config', 'apps/agent-worker/wrangler.jsonc', '--port', String(PORT), '--inspector-port', String(INSPECTOR_PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  worker.stdout.pipe(process.stdout);
  worker.stderr.pipe(process.stderr);

  try {
    await waitForOutput(worker, `Ready on http://localhost:${PORT}`);

    const tools = await jsonRequest('/api/v1/agent/tools');
    const workflows = await jsonRequest('/api/v1/agent/workflows');
    const createSession = await postJson('/api/v1/agent/sessions', {
      object_type: 'Flight',
      object_key: 'SE803',
      initial_message: 'Open station copilot'
    });
    const sessionId = createSession.json?.data?.session_id;
    if (!createSession.ok || !sessionId) {
      throw new Error('agent create session failed');
    }
    const context = await jsonRequest('/api/v1/agent/sessions/test-session/context?object_type=Flight&object_key=SE803');
    const plan = await jsonRequest('/api/v1/agent/sessions/test-session/plan?object_type=Flight&object_key=SE803');
    const sessionDetail = await jsonRequest(`/api/v1/agent/sessions/${sessionId}`);
    const sessionMessage = await postJson(`/api/v1/agent/sessions/${sessionId}/messages`, {
      message: 'Check blockers for this flight',
      object_type: 'Flight',
      object_key: 'SE803'
    });
    const sessionEvents = await jsonRequest(`/api/v1/agent/sessions/${sessionId}/events`);
    const flightContext = await postJson('/api/v1/agent/tools/get_flight_context/execute', { flight_no: 'SE803' });
    const blockingDocuments = await postJson('/api/v1/agent/tools/list_blocking_documents/execute', {
      object_type: 'AWB',
      object_key: '436-10358585'
    });
    const openExceptions = await postJson('/api/v1/agent/tools/list_open_exceptions/execute', {
      object_type: 'Flight',
      object_key: 'SE803'
    });
    const taskAssignment = await postJson('/api/v1/agent/tools/request_task_assignment/execute', {
      task_id: 'TASK-0408-201',
      assigned_role: 'document_desk',
      assigned_team_id: 'TEAM-DD-01',
      assigned_worker_id: 'WORKER-DOC-001',
      reason: 'Requested from agent smoke'
    });

    if (!tools.ok || !Array.isArray(tools.json?.items) || !tools.json.items.length) {
      throw new Error('agent/tools failed');
    }
    if (!workflows.ok || !Array.isArray(workflows.json?.items) || !workflows.json.items.length) {
      throw new Error('agent/workflows failed');
    }
    if (!context.ok || !context.json?.data?.system_prompt) {
      throw new Error('agent context failed');
    }
    if (!plan.ok || !Array.isArray(plan.json?.data?.steps) || !plan.json.data.steps.length) {
      throw new Error('agent plan failed');
    }
    if (!sessionDetail.ok || !Array.isArray(sessionDetail.json?.data?.messages)) {
      throw new Error('agent session detail failed');
    }
    if (!sessionMessage.ok || !sessionMessage.json?.data?.assistant_message) {
      throw new Error('agent session message failed');
    }
    if (!sessionEvents.ok || !Array.isArray(sessionEvents.json?.data?.messages)) {
      throw new Error('agent session events failed');
    }
    if (!flightContext.ok || !flightContext.json?.data?.flight?.flight_no) {
      throw new Error('agent get_flight_context failed');
    }
    if (!blockingDocuments.ok || !Array.isArray(blockingDocuments.json?.data?.items)) {
      throw new Error('agent list_blocking_documents failed');
    }
    if (!openExceptions.ok || !Array.isArray(openExceptions.json?.data?.items)) {
      throw new Error('agent list_open_exceptions failed');
    }
    if (!taskAssignment.ok || !taskAssignment.json?.data?.task_id) {
      throw new Error('agent request_task_assignment failed');
    }

    console.log('\nAgent smoke summary');
    console.log(`- tools: ${tools.status}`);
    console.log(`- workflows: ${workflows.status}`);
    console.log(`- session context: ${context.status}`);
    console.log(`- plan: ${plan.status}`);
    console.log(`- session create/detail/message/events: ${createSession.status}/${sessionDetail.status}/${sessionMessage.status}/${sessionEvents.status}`);
    console.log(`- get_flight_context: ${flightContext.status}`);
    console.log(`- list_blocking_documents: ${blockingDocuments.status}`);
    console.log(`- list_open_exceptions: ${openExceptions.status}`);
    console.log(`- request_task_assignment: ${taskAssignment.status}`);
  } finally {
    await stopChild(worker);
  }
}

main().catch((error) => {
  console.error(`Agent smoke failed: ${error.message}`);
  process.exitCode = 1;
});
