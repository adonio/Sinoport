import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const API_PORT = 8787 + Math.floor(Math.random() * 200);
const AGENT_PORT = 8794 + Math.floor(Math.random() * 200);
const LOCAL_API_URL = `http://127.0.0.1:${API_PORT}`;
const LOCAL_AGENT_URL = `http://127.0.0.1:${AGENT_PORT}`;
const WEB_PORT = 4175 + Math.floor(Math.random() * 200);
const DEFAULT_WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const API_INSPECTOR_PORT = 9235 + Math.floor(Math.random() * 200);
const AGENT_INSPECTOR_PORT = 9236 + Math.floor(Math.random() * 200);

const pageChecks = [
  { path: '/station/inbound/flights/SE803', text: '航班详情 / SE803' },
  { path: '/station/inbound/waybills/436-10358585', text: '提单详情 / 436-10358585' },
  { path: '/station/shipments/in-436-10358585', text: '436-10358585 / SE803 Inbound' },
  { path: '/station/exceptions/EXP-0408-001', text: '异常详情 / EXP-0408-001' },
  { path: '/station/inbound/mobile', text: 'PDA 作业终端总览' },
  { path: '/station/outbound/flights', text: '出港管理 / 航班管理' },
  { path: '/station/outbound/flights/SE913', text: '航班详情 / SE913' },
  { path: '/station/outbound/waybills', text: '出港管理 / 提单管理' },
  { path: '/station/outbound/waybills/436-10357583', text: '提单详情 / 436-10357583' },
  { path: '/station/tasks', text: '作业指令中心' },
  { path: '/station/documents/noa', text: 'NOA 通知动作' },
  { path: '/station/documents/pod', text: 'POD 通知与补签' },
  { path: '/station/copilot?object_type=Flight&object_key=SE803', text: 'Station Copilot' },
  { path: '/platform/audit/trust', text: '可信留痕预览' },
  { path: '/mobile/inbound/SE803/breakdown', text: '拆板与理货任务' },
  { path: '/mobile/outbound/SE913/receipt', text: '收货扫描' }
];

const ignoredConsolePatterns = [
  /Failed to decode downloaded font/i,
  /OTS parsing error/i,
  /Failed to load resource: the server responded with a status of 404/i
];
const ignoredResponsePatterns = [/\.woff2?$/i, /\.map$/i, /favicon/i];

const stationLoginPayload = {
  userId: 'smoke-supervisor',
  roleIds: ['station_supervisor', 'document_desk'],
  stationCode: 'MME'
};

const mobileLoginPayload = {
  operator: 'Smoke PDA',
  employeeId: 'PDA-001',
  stationCode: 'MME',
  roleKey: 'receiver',
  language: 'zh'
};

const fallbackMobileSession = {
  station: 'MME',
  stationCode: 'MME',
  operator: 'Smoke PDA',
  employeeId: 'PDA-001',
  roleKey: 'receiver',
  roleLabel: 'Inbound Operator',
  businessType: '进港',
  language: 'zh'
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
      reject(new Error(`Process exited early with code ${code}`));
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

function resolveSmokeTargets() {
  const apiUrl = process.env.SMOKE_API_URL?.trim() || LOCAL_API_URL;
  const agentUrl = process.env.SMOKE_AGENT_URL?.trim() || LOCAL_AGENT_URL;
  const webUrl = process.env.SMOKE_WEB_URL?.trim() || DEFAULT_WEB_URL;
  const remoteMode = Boolean(process.env.SMOKE_API_URL || process.env.SMOKE_AGENT_URL || process.env.SMOKE_WEB_URL);

  if (remoteMode && (!process.env.SMOKE_API_URL || !process.env.SMOKE_AGENT_URL || !process.env.SMOKE_WEB_URL)) {
    throw new Error('Remote smoke requires SMOKE_API_URL, SMOKE_AGENT_URL, and SMOKE_WEB_URL.');
  }

  return { apiUrl, agentUrl, webUrl, remoteMode };
}

async function jsonRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  let json = null;

  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    json
  };
}

async function loginForSmoke(apiUrl) {
  const stationLogin = await jsonRequest(apiUrl, '/api/v1/station/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stationLoginPayload)
  });

  if (!stationLogin.ok) {
    throw new Error(`station/login failed with status ${stationLogin.status}`);
  }

  const mobileLogin = await jsonRequest(apiUrl, '/api/v1/mobile/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mobileLoginPayload)
  });

  if (!mobileLogin.ok) {
    throw new Error(`mobile/login failed with status ${mobileLogin.status}`);
  }

  const stationToken = stationLogin.json?.data?.token;
  const stationActor = stationLogin.json?.data?.actor;
  const mobileSession = mobileLogin.json?.data?.actor
    ? {
        ...fallbackMobileSession,
        station: mobileLogin.json.data.actor.station_scope?.[0] || fallbackMobileSession.station,
        stationCode: mobileLogin.json.data.actor.station_scope?.[0] || fallbackMobileSession.stationCode
      }
    : fallbackMobileSession;

  if (!stationToken || !stationActor) {
    throw new Error('station/login did not return a usable session');
  }

  return {
    stationToken,
    stationActor,
    mobileSession
  };
}

async function startLocalServices() {
  const api = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/api-worker/wrangler.jsonc', '--port', String(API_PORT), '--inspector-port', String(API_INSPECTOR_PORT)],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  const agent = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/agent-worker/wrangler.jsonc', '--port', String(AGENT_PORT), '--inspector-port', String(AGENT_INSPECTOR_PORT)],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  const web = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(WEB_PORT), '--strictPort'], {
    cwd: `${process.cwd()}/admin-console`,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  api.stdout.pipe(process.stdout);
  api.stderr.pipe(process.stderr);
  agent.stdout.pipe(process.stdout);
  agent.stderr.pipe(process.stderr);
  web.stdout.pipe(process.stdout);
  web.stderr.pipe(process.stderr);

  await Promise.all([
    waitForOutput(api, `Ready on http://localhost:${API_PORT}`),
    waitForOutput(agent, `Ready on http://localhost:${AGENT_PORT}`),
    waitForOutput(web, `http://127.0.0.1:${WEB_PORT}`)
  ]);

  return { api, agent, web };
}

async function verifyApiSmoke(apiUrl, agentUrl, stationToken) {
  const apiHealth = await jsonRequest(apiUrl, '/api/v1/healthz');
  if (!apiHealth.ok) {
    throw new Error(`API health check failed: ${apiHealth.status}`);
  }

  const agentHealth = await jsonRequest(agentUrl, '/api/v1/healthz');
  if (!agentHealth.ok) {
    throw new Error(`Agent health check failed: ${agentHealth.status}`);
  }

  const agentTools = await jsonRequest(agentUrl, '/api/v1/agent/tools', {
    headers: { Authorization: `Bearer ${stationToken}` }
  });
  if (!agentTools.ok || !Array.isArray(agentTools.json?.items) || !agentTools.json.items.length) {
    throw new Error('Agent tools check failed');
  }

  const auditEvents = await jsonRequest(apiUrl, '/api/v1/platform/audit/events', {
    headers: { Authorization: `Bearer ${stationToken}` }
  });
  if (!auditEvents.ok || !Array.isArray(auditEvents.json?.items)) {
    throw new Error('Audit events check failed');
  }

  const auditLogs = await jsonRequest(apiUrl, '/api/v1/platform/audit/logs', {
    headers: { Authorization: `Bearer ${stationToken}` }
  });
  if (!auditLogs.ok || !Array.isArray(auditLogs.json?.items)) {
    throw new Error('Audit logs check failed');
  }

  return { apiHealth, agentHealth, agentTools, auditEvents, auditLogs };
}

async function runBrowserSmoke(webUrl, stationToken, stationActor, mobileSession) {
  let browser;

  try {
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
    } catch {
      browser = await chromium.launch({ headless: true });
    }

    const context = await browser.newContext();
    await context.addInitScript(
      ({ token, actor, session }) => {
        window.localStorage.setItem('serviceToken', token);
        window.localStorage.setItem('sinoport-station-actor-v1', JSON.stringify(actor));
        window.localStorage.setItem('sinoport-mobile-session-v1', JSON.stringify(session));
      },
      { token: stationToken, actor: stationActor, session: mobileSession }
    );

    const baseUrl = webUrl.replace(/\/$/, '');

    for (const pageConfig of pageChecks) {
      const page = await context.newPage();
      const consoleIssues = [];
      const pageErrors = [];
      const failedResponses = [];

      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          const text = message.text();
          if (!ignoredConsolePatterns.some((pattern) => pattern.test(text))) {
            consoleIssues.push(text);
          }
        }
      });
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });
      page.on('response', (response) => {
        if (response.status() >= 400 && !ignoredResponsePatterns.some((pattern) => pattern.test(response.url()))) {
          failedResponses.push(`${response.status()} ${response.url()}`);
        }
      });

      const url = `${baseUrl}${pageConfig.path}`;
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      await page.getByText(pageConfig.text, { exact: false }).first().waitFor({ timeout: 30_000 });

      if (consoleIssues.length || pageErrors.length || failedResponses.length) {
        throw new Error(
          `Frontend smoke failed on ${url}\nconsole: ${consoleIssues.join(' | ')}\npageerror: ${pageErrors.join(' | ')}\nresponses: ${failedResponses.join(' | ')}`
        );
      }

      await page.close();
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  const { apiUrl, agentUrl, webUrl, remoteMode } = resolveSmokeTargets();
  const children = remoteMode ? [] : Object.values(await startLocalServices());

  try {
    const { stationToken, stationActor, mobileSession } = await loginForSmoke(apiUrl);
    await verifyApiSmoke(apiUrl, agentUrl, stationToken);
    await runBrowserSmoke(webUrl, stationToken, stationActor, mobileSession);

    console.log('\nDelivery smoke summary');
    console.log(`- api health: ${apiUrl}/api/v1/healthz`);
    console.log(`- agent health: ${agentUrl}/api/v1/healthz`);
    console.log(`- agent tools: ${agentUrl}/api/v1/agent/tools`);
    console.log(`- audit events: ${apiUrl}/api/v1/platform/audit/events`);
    console.log(`- browser base: ${webUrl}`);
  } finally {
    for (const child of children.reverse()) {
      await stopChild(child);
    }
  }
}

main().catch((error) => {
  console.error(`Frontend smoke failed: ${error.message}`);
  process.exitCode = 1;
});
