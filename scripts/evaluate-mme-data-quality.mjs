import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const PORT = 8796;
const INSPECTOR_PORT = 9237;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const SUCCESS_FIXTURE_URL = new URL('./fixtures/inbound-bundles/mme-inbound-bundle.json', import.meta.url);
const INVALID_FIXTURE_URL = new URL('./fixtures/inbound-bundles/mme-inbound-bundle-missing-awb.json', import.meta.url);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadFixture(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

async function waitForReady(child) {
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for wrangler dev.')), 30_000);
    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes('Ready on')) {
        clearTimeout(timeout);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolvePromise();
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`wrangler dev exited early with code ${code}`));
    });
  });
}

async function stopWorker(worker) {
  worker.kill('SIGINT');

  try {
    await Promise.race([
      once(worker, 'exit'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for wrangler dev to exit.')), 10_000))
    ]);
  } catch {
    worker.kill('SIGKILL');
  }
}

async function runCommand(command, args) {
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
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
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const json = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    json
  };
}

async function main() {
  await runCommand('npm', ['run', 'db:migrate:local', '--workspace', '@sinoport/api-worker']);

  const worker = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/api-worker/wrangler.jsonc', '--port', String(PORT), '--inspector-port', String(INSPECTOR_PORT)],
    { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  worker.stdout.pipe(process.stdout);
  worker.stderr.pipe(process.stderr);

  try {
    await waitForReady(worker);

    const stationLogin = await jsonRequest('/api/v1/station/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'integration-web',
        roleIds: ['station_supervisor'],
        stationCode: 'MME'
      })
    });
    assert(stationLogin.ok, 'station/login failed');

    const token = stationLogin.json?.data?.token;
    assert(Boolean(token), 'station/login token missing');

    const successPayload = loadFixture(SUCCESS_FIXTURE_URL);
    successPayload.request_id = `mme-quality-success-${Date.now()}`;

    const successImport = await jsonRequest('/api/v1/station/imports/inbound-bundle', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': successPayload.request_id
      },
      body: JSON.stringify(successPayload)
    });
    assert(successImport.ok, 'successful inbound bundle import failed');

    const invalidPayload = loadFixture(INVALID_FIXTURE_URL);
    invalidPayload.request_id = `mme-quality-invalid-${Date.now()}`;

    const invalidImport = await jsonRequest('/api/v1/station/imports/inbound-bundle', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': invalidPayload.request_id
      },
      body: JSON.stringify(invalidPayload)
    });
    assert(invalidImport.status === 400, `expected invalid import 400, received ${invalidImport.status}`);

    const today = new Date().toISOString().slice(0, 10);
    const rules = await jsonRequest('/api/v1/platform/data-quality/rules?station_id=MME', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(rules.ok, 'data quality rules endpoint failed');
    assert(Array.isArray(rules.json?.data?.items) && rules.json.data.items.length >= 5, 'expected seeded data quality rules');

    const evaluation = await jsonRequest('/api/v1/platform/data-quality/stations/MME/evaluate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ date: today })
    });
    assert(evaluation.ok, 'data quality evaluation failed');

    const platformIssues = await jsonRequest(`/api/v1/platform/data-quality/stations/MME/issues?date=${today}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(platformIssues.ok, 'platform data quality issues failed');
    const platformChecklist = await jsonRequest(`/api/v1/platform/data-quality/stations/MME/checklist?date=${today}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(platformChecklist.ok, 'platform data quality checklist failed');

    const stationOverview = await jsonRequest(`/api/v1/station/data-quality/overview?date=${today}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(stationOverview.ok, 'station data quality overview failed');

    const stationIssues = await jsonRequest(`/api/v1/station/data-quality/issues?date=${today}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(stationIssues.ok, 'station data quality issues failed');
    const stationChecklist = await jsonRequest(`/api/v1/station/data-quality/checklist?date=${today}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(stationChecklist.ok, 'station data quality checklist failed');

    const items = platformIssues.json?.data?.items || [];
    assert(items.some((item) => item.issue_code === 'DQ_IMPORT_REQUEST_FAILED'), 'expected DQ_IMPORT_REQUEST_FAILED issue');
    assert((stationOverview.json?.data?.total_issues || 0) >= 1, 'expected at least one data quality issue');
    assert(
      Array.isArray(platformChecklist.json?.data?.quality_checklist?.blocking_candidate_rules) &&
        platformChecklist.json.data.quality_checklist.blocking_candidate_rules.includes('DQ_IMPORT_REQUEST_FAILED'),
      'expected DQ_IMPORT_REQUEST_FAILED to appear in blocking candidate rules'
    );
    assert(
      ['blocked', 'warning'].includes(String(stationChecklist.json?.data?.quality_checklist?.gate_status || '')),
      'expected station quality checklist gate status'
    );

    console.log('\nMME data quality evaluation summary');
    console.log(`- station/login: ${stationLogin.status}`);
    console.log(`- success import / invalid import: ${successImport.status}/${invalidImport.status}`);
    console.log(`- rules / evaluate / platform issues / platform checklist / station overview / station issues / station checklist: ${rules.status}/${evaluation.status}/${platformIssues.status}/${platformChecklist.status}/${stationOverview.status}/${stationIssues.status}/${stationChecklist.status}`);
    console.log(`- total issues: ${stationOverview.json?.data?.total_issues || 0}`);
  } finally {
    await stopWorker(worker);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`MME data quality evaluation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
