import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const PORT = 8793;
const INSPECTOR_PORT = 9233;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE_URL = new URL('./fixtures/inbound-bundles/mme-inbound-bundle.json', import.meta.url);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadMmeInboundBundleFixture() {
  return JSON.parse(readFileSync(FIXTURE_URL, 'utf8'));
}

async function waitForReady(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for wrangler dev.')), 30_000);
    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes('Ready on')) {
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
      reject(new Error(`wrangler dev exited early with code ${code}`));
    });
  });
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const json = await response.json();

  return { ok: response.ok, status: response.status, json };
}

function assertPositiveCount(result, label) {
  const total = (result?.created ?? 0) + (result?.updated ?? 0);
  assert(total > 0, `${label} was not written`);
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

  return output;
}

async function resetReplayFixtures() {
  const sql = [
    "UPDATE tasks SET task_status = 'Created', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-201';",
    "UPDATE tasks SET task_status = 'Completed', completed_at = '2026-04-08T19:05:00Z', verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-000';",
    "UPDATE tasks SET task_status = 'Started', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-001';",
    "UPDATE tasks SET task_status = 'Assigned', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-002';",
    "UPDATE awbs SET noa_status = 'Pending', updated_at = CURRENT_TIMESTAMP WHERE awb_id = 'AWB-436-10357944';",
    "UPDATE awbs SET pod_status = 'Pending', updated_at = CURRENT_TIMESTAMP WHERE awb_id = 'AWB-436-10358585';",
    "UPDATE exceptions SET exception_status = 'Open', closed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE exception_id = 'EXP-0408-001';"
  ].join(' ');

  await runCommand('npx', [
    'wrangler',
    'd1',
    'execute',
    'sinoport-api-local',
    '--local',
    '--config',
    'apps/api-worker/wrangler.jsonc',
    '--command',
    sql
  ]);
}

async function main() {
  await runCommand('npm', ['run', 'db:migrate:local', '--workspace', '@sinoport/api-worker']);
  await resetReplayFixtures();

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
    const stationToken = stationLogin.json?.data?.token;
    assert(Boolean(stationToken), 'station/login token missing');

    const inboundBundlePayload = loadMmeInboundBundleFixture();
    const inboundBundle = await jsonRequest('/api/v1/station/imports/inbound-bundle', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json',
        'X-Request-Id': inboundBundlePayload.request_id
      },
      body: JSON.stringify(inboundBundlePayload)
    });
    assert(inboundBundle.ok, 'station/imports/inbound-bundle failed');
    assertPositiveCount(inboundBundle.json?.data?.flight, 'flight');
    assertPositiveCount(inboundBundle.json?.data?.shipments, 'shipments');
    assertPositiveCount(inboundBundle.json?.data?.awbs, 'awbs');
    assertPositiveCount(inboundBundle.json?.data?.tasks, 'tasks');
    assertPositiveCount(inboundBundle.json?.data?.audit_events, 'audit_events');

    const importedFlightId = inboundBundlePayload.flight.flight_id;
    const importedAwbOneId = inboundBundlePayload.awbs[0].awb_id;
    const importedAwbTwoId = inboundBundlePayload.awbs[1].awb_id;
    const importedShipmentOneSlug = `in-${inboundBundlePayload.awbs[0].awb_no}`;
    const importedShipmentTwoSlug = `in-${inboundBundlePayload.awbs[1].awb_no}`;
    const importedTaskOneId = inboundBundlePayload.awbs[0].task_template.task_id;
    const importedTaskTwoId = inboundBundlePayload.awbs[1].tasks[0].task_id;

    const importedFlight = await jsonRequest(`/api/v1/station/inbound/flights/${encodeURIComponent(importedFlightId)}?station_id=MME`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(importedFlight.ok, 'imported inbound flight not readable');

    const importedAwbOne = await jsonRequest(`/api/v1/station/inbound/waybills/${encodeURIComponent(importedAwbOneId)}?station_id=MME`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(importedAwbOne.ok, 'imported inbound waybill #1 not readable');

    const importedAwbTwo = await jsonRequest(`/api/v1/station/inbound/waybills/${encodeURIComponent(importedAwbTwoId)}?station_id=MME`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(importedAwbTwo.ok, 'imported inbound waybill #2 not readable');

    const importedShipmentOne = await jsonRequest(`/api/v1/station/shipments/${encodeURIComponent(importedShipmentOneSlug)}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(importedShipmentOne.ok, 'imported shipment #1 not readable');

    const importedShipmentTwo = await jsonRequest(`/api/v1/station/shipments/${encodeURIComponent(importedShipmentTwoSlug)}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(importedShipmentTwo.ok, 'imported shipment #2 not readable');

    const importedTasks = await jsonRequest('/api/v1/station/tasks?station_id=MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(importedTasks.ok, 'station/tasks failed after inbound import');
    assert(
      importedTasks.json?.items?.some((item) => item.task_id === importedTaskOneId),
      'imported task #1 not found in station/tasks'
    );
    assert(
      importedTasks.json?.items?.some((item) => item.task_id === importedTaskTwoId),
      'imported task #2 not found in station/tasks'
    );

    const importedAudit = await jsonRequest(
      `/api/v1/platform/audit/object?object_type=Flight&object_id=${encodeURIComponent(importedFlightId)}`,
      {
        headers: { Authorization: `Bearer ${stationToken}` }
      }
    );
    assert(importedAudit.ok, 'platform/audit/object failed for imported flight');
    assert(Array.isArray(importedAudit.json?.data?.events), 'platform/audit/object returned invalid events payload');
    assert(
      importedAudit.json?.data?.events?.some((item) => item.action === 'STATION_INBOUND_BUNDLE_IMPORTED'),
      'inbound bundle audit event not found'
    );

    console.log('\nMME inbound replay summary');
    console.log(`- station/login: ${stationLogin.status}`);
    console.log(`- inbound bundle import: ${inboundBundle.status}`);
    console.log(`- flight/awb/shipment/task/audit reads: ${importedFlight.status}/${importedAwbOne.status}/${importedShipmentOne.status}/${importedTasks.status}/${importedAudit.status}`);
  } finally {
    await stopWorker(worker);
  }
}

export { loadMmeInboundBundleFixture };

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`MME inbound replay failed: ${error.message}`);
    process.exitCode = 1;
  });
}
