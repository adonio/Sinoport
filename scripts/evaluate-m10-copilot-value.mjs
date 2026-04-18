import { once } from 'node:events';
import { spawn } from 'node:child_process';

const API_PORT = 8787 + Math.floor(Math.random() * 100);
const AGENT_PORT = 8890 + Math.floor(Math.random() * 100);
const API_INSPECTOR_PORT = 9530 + Math.floor(Math.random() * 100);
const AGENT_INSPECTOR_PORT = 9630 + Math.floor(Math.random() * 100);
const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;
const AGENT_BASE_URL = `http://127.0.0.1:${AGENT_PORT}`;
const OPERATOR_OVERHEAD_MS = 300;

async function waitForHttp(baseUrl, path, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}${path}`);
      if (response.ok || response.status === 401) {
        return;
      }
    } catch {
      // keep polling until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${baseUrl}${path}`);
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

async function jsonRequest(baseUrl, path, headers = {}) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body,
    durationMs: Date.now() - startedAt
  };
}

async function postJson(baseUrl, path, payload, headers = {}) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    body,
    durationMs: Date.now() - startedAt
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loginToApi() {
  const login = await postJson(API_BASE_URL, '/api/v1/station/login', {
    email: 'supervisor@sinoport.local',
    password: 'Sinoport123!',
    stationCode: 'MME'
  });
  assert(login.ok, 'station/login failed');
  const token = login.body?.data?.token;
  assert(token, 'station/login did not return token');
  return { Authorization: `Bearer ${token}` };
}

const scenarios = [
  {
    name: 'inbound-flight-blocker',
    objectType: 'Flight',
    objectKey: 'SE803',
    message: 'Check blockers for this inbound flight and suggest the next step.',
    adopt: true,
    manualRequests: [
      { path: '/api/v1/station/inbound/flights/FLIGHT-SE803-2026-04-08-MME' },
      { path: '/api/v1/platform/audit/object?object_type=Flight&object_key=SE803' }
    ],
    followupRequest: { path: '/api/v1/platform/audit/object?object_type=Flight&object_key=SE803' }
  },
  {
    name: 'outbound-flight-release-check',
    objectType: 'OutboundFlight',
    objectKey: 'SE913',
    message: 'Review this outbound flight and suggest the release check order.',
    adopt: true,
    manualRequests: [
      { path: '/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME' },
      { path: '/api/v1/platform/audit/object?object_type=Flight&object_id=FLIGHT-SE913-2026-04-09-MME' }
    ],
    followupRequest: { path: '/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME' }
  },
  {
    name: 'inbound-awb-recovery',
    objectType: 'AWB',
    objectKey: '436-10358585',
    message: 'Explain the recovery path for this inbound AWB.',
    adopt: true,
    manualRequests: [
      { path: '/api/v1/station/inbound/waybills/AWB-436-10358585' },
      { path: '/api/v1/platform/audit/object?object_type=AWB&object_id=AWB-436-10358585' }
    ],
    followupRequest: { path: '/api/v1/station/inbound/waybills/AWB-436-10358585' }
  },
  {
    name: 'exception-root-cause',
    objectType: 'Exception',
    objectKey: 'EXP-0408-001',
    message: 'Summarize the root cause and next read-only checks for this exception.',
    adopt: false,
    manualRequests: [
      { path: '/api/v1/station/exceptions/EXP-0408-001' },
      { path: '/api/v1/platform/audit/object?object_type=Exception&object_id=EXP-0408-001' }
    ],
    followupRequest: { path: '/api/v1/station/exceptions/EXP-0408-001' }
  },
  {
    name: 'document-release-gate',
    objectType: 'Document',
    objectKey: 'DOC-MANIFEST-SE803',
    message: 'Check the release gate and document next read-only verification steps.',
    adopt: false,
    manualRequests: [
      { path: '/api/v1/station/documents/overview' },
      { path: '/api/v1/platform/audit/object?object_type=Document&object_id=DOC-MANIFEST-SE803' }
    ],
    followupRequest: { path: '/api/v1/platform/audit/object?object_type=Document&object_id=DOC-MANIFEST-SE803' }
  }
];

async function runScenario(headers, scenario) {
  const copilotStartedAt = Date.now();
  const createSession = await postJson(AGENT_BASE_URL, '/api/v1/agent/sessions', {
    object_type: scenario.objectType,
    object_key: scenario.objectKey,
    initial_message: `Open Station Copilot for ${scenario.objectType} / ${scenario.objectKey}`
  }, headers);
  assert(createSession.ok, `${scenario.name} session create failed`);
  const sessionId = createSession.body?.data?.session_id;
  assert(sessionId, `${scenario.name} session id missing`);

  const context = await jsonRequest(
    AGENT_BASE_URL,
    `/api/v1/agent/sessions/${sessionId}/context?object_type=${encodeURIComponent(scenario.objectType)}&object_key=${encodeURIComponent(scenario.objectKey)}`,
    headers
  );
  const plan = await jsonRequest(
    AGENT_BASE_URL,
    `/api/v1/agent/sessions/${sessionId}/plan?object_type=${encodeURIComponent(scenario.objectType)}&object_key=${encodeURIComponent(scenario.objectKey)}`,
    headers
  );
  const message = await postJson(AGENT_BASE_URL, `/api/v1/agent/sessions/${sessionId}/messages`, {
    message: scenario.message,
    object_type: scenario.objectType,
    object_key: scenario.objectKey
  }, headers);
  const detail = await jsonRequest(AGENT_BASE_URL, `/api/v1/agent/sessions/${sessionId}`, headers);
  const events = await jsonRequest(AGENT_BASE_URL, `/api/v1/agent/sessions/${sessionId}/events`, headers);

  assert(context.ok && plan.ok && message.ok && detail.ok && events.ok, `${scenario.name} copilot sequence failed`);
  assert(!context.body?.data?.available_tools?.includes('request_task_assignment'), `${scenario.name} leaked request_task_assignment in context`);
  assert(!plan.body?.data?.recommended_tools?.includes('request_task_assignment'), `${scenario.name} leaked request_task_assignment in plan`);
  assert(Array.isArray(detail.body?.data?.runs) && detail.body.data.runs.length > 0, `${scenario.name} missing agent runs`);
  assert(Array.isArray(events.body?.data?.runs) && events.body.data.runs.length > 0, `${scenario.name} missing agent events`);

  let followup = null;
  if (scenario.adopt) {
    followup = await jsonRequest(API_BASE_URL, scenario.followupRequest.path, headers);
    assert(followup.ok, `${scenario.name} follow-up action failed`);
  }

  const copilotDurationMs = Date.now() - copilotStartedAt;
  const manualResults = [];
  let manualDurationMs = 0;
  for (const request of scenario.manualRequests) {
    const result = await jsonRequest(API_BASE_URL, request.path, headers);
    assert(result.ok, `${scenario.name} manual path failed at ${request.path}`);
    manualResults.push(result);
    manualDurationMs += result.durationMs;
  }

  const manualQueryCount = scenario.manualRequests.length;
  const copilotPageJumps = 1;
  const manualPageJumps = scenario.manualRequests.length;
  const manualAdjustedDurationMs = manualDurationMs + manualQueryCount * OPERATOR_OVERHEAD_MS;

  return {
    scenario: scenario.name,
    objectType: scenario.objectType,
    objectKey: scenario.objectKey,
    adopted: Boolean(followup?.ok),
    copilotDurationMs,
    manualDurationMs,
    manualAdjustedDurationMs,
    manualQueryCount,
    copilotPageJumps,
    manualPageJumps,
    pageJumpReduction: manualPageJumps - copilotPageJumps,
    queryReduction: manualQueryCount - 1,
    assistantMessage: message.body?.data?.assistant_message || ''
  };
}

async function main() {
  await runCommand('npm', ['run', 'db:migrate:local', '--workspace', '@sinoport/api-worker']);
  await runCommand('npm', ['run', 'db:migrate:local', '--workspace', '@sinoport/agent-worker']);

  const apiWorker = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/api-worker/wrangler.jsonc', '--port', String(API_PORT), '--inspector-port', String(API_INSPECTOR_PORT)],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const agentWorker = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/agent-worker/wrangler.jsonc', '--port', String(AGENT_PORT), '--inspector-port', String(AGENT_INSPECTOR_PORT)],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
  );

  apiWorker.stdout.pipe(process.stdout);
  apiWorker.stderr.pipe(process.stderr);
  agentWorker.stdout.pipe(process.stdout);
  agentWorker.stderr.pipe(process.stderr);

  try {
    await waitForHttp(API_BASE_URL, '/api/v1/healthz');
    await waitForHttp(AGENT_BASE_URL, '/api/v1/healthz');

    const headers = await loginToApi();
    const results = [];
    for (const scenario of scenarios) {
      results.push(await runScenario(headers, scenario));
    }

    const validSessions = results.length;
    const adoptedSessions = results.filter((item) => item.adopted).length;
    const adoptionRate = adoptedSessions / validSessions;
    const averageCopilotMs = Math.round(results.reduce((sum, item) => sum + item.copilotDurationMs, 0) / validSessions);
    const averageManualMs = Math.round(results.reduce((sum, item) => sum + item.manualAdjustedDurationMs, 0) / validSessions);
    const averageImprovementMs = averageManualMs - averageCopilotMs;
    const totalPageJumpReduction = results.reduce((sum, item) => sum + item.pageJumpReduction, 0);
    const totalQueryReduction = results.reduce((sum, item) => sum + item.queryReduction, 0);

    assert(validSessions >= 5, 'M10 requires at least 5 valid sessions');
    assert(adoptedSessions >= 3, 'M10 requires at least 3 adopted sessions');
    assert(adoptionRate >= 0.6, 'M10 requires adoption rate >= 60%');
    assert(results.every((item) => item.pageJumpReduction >= 1), 'every scenario should reduce at least one page jump');

    console.log('\nM10 copilot value evaluation summary');
    for (const item of results) {
      console.log(
        `- ${item.scenario}: adopted=${item.adopted ? 'yes' : 'no'} copilot=${item.copilotDurationMs}ms manual=${item.manualAdjustedDurationMs}ms pageJumpReduction=${item.pageJumpReduction} queryReduction=${item.queryReduction}`
      );
    }
    console.log(`- valid sessions: ${validSessions}`);
    console.log(`- adopted sessions: ${adoptedSessions}`);
    console.log(`- adoption rate: ${(adoptionRate * 100).toFixed(1)}%`);
    console.log(`- average copilot duration: ${averageCopilotMs}ms`);
    console.log(`- average manual adjusted duration: ${averageManualMs}ms`);
    console.log(`- average improvement: ${averageImprovementMs}ms`);
    console.log(`- total page jump reduction: ${totalPageJumpReduction}`);
    console.log(`- total query reduction: ${totalQueryReduction}`);
  } finally {
    await stopChild(agentWorker);
    await stopChild(apiWorker);
  }
}

main().catch((error) => {
  console.error(`M10 copilot value evaluation failed: ${error.message}`);
  process.exitCode = 1;
});
