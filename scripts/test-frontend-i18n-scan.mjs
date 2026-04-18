import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const API_PORT = 8787 + Math.floor(Math.random() * 100);
const AGENT_PORT = 8894 + Math.floor(Math.random() * 100);
const WEB_PORT = 4175 + Math.floor(Math.random() * 200);
const API_INSPECTOR_PORT = 9235 + Math.floor(Math.random() * 100);
const AGENT_INSPECTOR_PORT = 9335 + Math.floor(Math.random() * 100);

const LOCAL_API_URL = `http://127.0.0.1:${API_PORT}`;
const LOCAL_AGENT_URL = `http://127.0.0.1:${AGENT_PORT}`;
const LOCAL_WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

const defaultRoutes = [
  '/platform/operations',
  '/platform/stations',
  '/platform/stations/capabilities',
  '/platform/stations/teams',
  '/platform/stations/zones',
  '/platform/stations/devices',
  '/platform/stations/MME',
  '/platform/network',
  '/platform/network/lanes',
  '/platform/network/scenarios',
  '/platform/rules',
  '/platform/master-data',
  '/platform/master-data/sync',
  '/platform/master-data/jobs',
  '/platform/master-data/relationships',
  '/platform/audit',
  '/platform/audit/events',
  '/platform/audit/trust',
  '/platform/reports',
  '/platform/reports/stations',
  '/station/dashboard',
  '/station/inbound',
  '/station/inbound/flights',
  '/station/inbound/flights/SE803',
  '/station/inbound/waybills',
  '/station/inbound/waybills/436-10358585',
  '/station/inbound/mobile',
  '/station/outbound',
  '/station/outbound/flights',
  '/station/outbound/flights/SE913',
  '/station/outbound/waybills',
  '/station/outbound/waybills/436-10357583',
  '/station/shipments',
  '/station/shipments/in-436-10358585',
  '/station/documents',
  '/station/documents/noa',
  '/station/documents/pod',
  '/station/tasks',
  '/station/exceptions',
  '/station/exceptions/EXP-0408-001',
  '/station/resources',
  '/station/resources/teams',
  '/station/resources/zones',
  '/station/resources/devices',
  '/station/resources/vehicles',
  '/station/reports',
  '/station/reports/shift',
  '/station/copilot?object_type=Flight&object_key=SE803',
  '/mobile/login',
  '/mobile/select',
  '/mobile/inbound',
  '/mobile/inbound/SE803',
  '/mobile/inbound/SE803/breakdown',
  '/mobile/inbound/SE803/pallet',
  '/mobile/inbound/SE803/loading',
  '/mobile/outbound',
  '/mobile/outbound/SE913',
  '/mobile/outbound/SE913/receipt',
  '/mobile/outbound/SE913/pmc',
  '/mobile/outbound/SE913/loading',
  '/mobile/runtime/SE803'
];

const stationLoginPayload = {
  userId: 'i18n-scan-supervisor',
  roleIds: ['station_supervisor', 'document_desk'],
  stationCode: 'MME'
};

const mobileLoginPayload = {
  operator: 'I18N Scan PDA',
  employeeId: 'PDA-I18N-01',
  stationCode: 'MME',
  roleKey: 'receiver',
  language: 'en'
};

const fallbackMobileSession = {
  station: 'MME',
  stationCode: 'MME',
  operator: 'I18N Scan PDA',
  employeeId: 'PDA-I18N-01',
  roleKey: 'receiver',
  roleLabel: 'Inbound Operator',
  businessType: '进港',
  language: 'en'
};

function containsChinese(input) {
  return /[\p{Script=Han}]/u.test(input);
}

function collectChineseLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => containsChinese(line));
}

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

async function jsonRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  let json = null;

  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { ok: response.ok, status: response.status, json };
}

async function loginForScan(apiUrl) {
  const stationLogin = await jsonRequest(apiUrl, '/api/v1/station/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stationLoginPayload)
  });
  if (!stationLogin.ok) throw new Error(`station/login failed with status ${stationLogin.status}`);

  const mobileLogin = await jsonRequest(apiUrl, '/api/v1/mobile/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mobileLoginPayload)
  });
  if (!mobileLogin.ok) throw new Error(`mobile/login failed with status ${mobileLogin.status}`);

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

  return { stationToken, stationActor, mobileSession };
}

async function startLocalServices() {
  const api = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/api-worker/wrangler.jsonc', '--port', String(API_PORT), '--inspector-port', String(API_INSPECTOR_PORT)],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const agent = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/agent-worker/wrangler.jsonc', '--port', String(AGENT_PORT), '--inspector-port', String(AGENT_INSPECTOR_PORT)],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
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

async function scanRoutes(webUrl, apiUrl, agentUrl, stationToken, stationActor, mobileSession, routes) {
  let browser;

  try {
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
    } catch {
      browser = await chromium.launch({ headless: true });
    }

    const context = await browser.newContext();
    await context.addInitScript(
      ({ token, actor, session, stationApiUrl, agentApiUrl, language }) => {
        window.localStorage.setItem('serviceToken', token);
        window.localStorage.setItem('sinoport-station-actor-v1', JSON.stringify(actor));
        window.localStorage.setItem('sinoport-mobile-session-v1', JSON.stringify({ ...session, language }));
        window.localStorage.setItem('sinoportStationApiBaseUrl', stationApiUrl);
        window.localStorage.setItem('sinoportAgentApiBaseUrl', agentApiUrl);
        const configRaw = window.localStorage.getItem('mantis-react-js-config');
        const currentConfig = configRaw ? JSON.parse(configRaw) : {};
        window.localStorage.setItem('mantis-react-js-config', JSON.stringify({ ...currentConfig, i18n: language }));
      },
      { token: stationToken, actor: stationActor, session: mobileSession, stationApiUrl: apiUrl, agentApiUrl: agentUrl, language: 'en' }
    );

    const baseUrl = webUrl.replace(/\/$/, '');
    const findings = [];

    for (const path of routes) {
      const page = await context.newPage();
      const url = `${baseUrl}${path}`;
      console.log(`scanning ${path}`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      const chinese = collectChineseLines(bodyText);
      if (chinese.length) {
        findings.push({ path, chinese });
      }
      await page.close();
    }

    await context.close();
    return findings;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  const routes = process.argv.slice(2).length ? process.argv.slice(2) : defaultRoutes;
  const children = Object.values(await startLocalServices());

  try {
    const { stationToken, stationActor, mobileSession } = await loginForScan(LOCAL_API_URL);
    const findings = await scanRoutes(LOCAL_WEB_URL, LOCAL_API_URL, LOCAL_AGENT_URL, stationToken, stationActor, mobileSession, routes);

    console.log(
      JSON.stringify(
        {
          webUrl: LOCAL_WEB_URL,
          apiUrl: LOCAL_API_URL,
          agentUrl: LOCAL_AGENT_URL,
          routes: routes.length,
          findings
        },
        null,
        2
      )
    );

    if (findings.length) {
      process.exitCode = 1;
    }
  } finally {
    for (const child of children.reverse()) {
      await stopChild(child);
    }
  }
}

main().catch((error) => {
  console.error(`Frontend i18n scan failed: ${error.message}`);
  process.exitCode = 1;
});
