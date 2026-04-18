import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { loadMmeInboundBundleFixture } from './replay-mme-inbound.mjs';

const PORT = 8796;
const INSPECTOR_PORT = 9236;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function main() {
  const worker = spawn(
    'npx',
    ['wrangler', 'dev', '--config', 'apps/api-worker/wrangler.jsonc', '--port', String(PORT), '--inspector-port', String(INSPECTOR_PORT)],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
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

    const reportDate = '2026-04-08';

    const copyPackage = await jsonRequest('/api/v1/platform/station-governance/stations/MME/copy-package', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(copyPackage.ok, 'copy-package failed');
    assert(copyPackage.json?.data?.template_station_id === 'MME', 'copy-package template station mismatch');
    assert(copyPackage.json?.data?.benchmark_station_id === 'RZE', 'copy-package benchmark station mismatch');
    assert(
      copyPackage.json?.data?.rollback_policy?.mode === 'template-and-configuration',
      'copy-package rollback mode mismatch'
    );

    const onboardingPlaybook = await jsonRequest('/api/v1/platform/station-governance/stations/MME/onboarding-playbook', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(onboardingPlaybook.ok, 'onboarding-playbook failed');
    assert(
      onboardingPlaybook.json?.data?.completion_policy?.warnings_require_manual_ack === true,
      'onboarding-playbook manual ack policy mismatch'
    );

    const governanceComparison = await jsonRequest(`/api/v1/platform/station-governance/stations/MME/governance-comparison?date=${reportDate}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(governanceComparison.ok, 'governance-comparison failed');
    assert(
      governanceComparison.json?.data?.comparison_anchor?.baselineStationCode === 'RZE',
      'governance-comparison baseline mismatch'
    );
    const comparisonTypes = new Set((governanceComparison.json?.data?.comparison_rows || []).map((item) => item.comparisonType));
    assert(comparisonTypes.has('actual'), 'governance-comparison missing actual row');
    assert(comparisonTypes.has('template'), 'governance-comparison missing template row');
    assert([...comparisonTypes].every((value) => value === 'actual' || value === 'template'), 'unexpected comparisonType found');
    assert(
      Array.isArray(governanceComparison.json?.data?.difference_path_rows) &&
        governanceComparison.json.data.difference_path_rows.length > 0,
      'governance-comparison difference path missing'
    );

    const acceptanceRecordTemplate = await jsonRequest(
      `/api/v1/platform/station-governance/stations/MME/acceptance-record-template?date=${reportDate}`,
      {
        headers: { Authorization: `Bearer ${stationToken}` }
      }
    );
    assert(acceptanceRecordTemplate.ok, 'acceptance-record-template failed');
    const decisionOptions = acceptanceRecordTemplate.json?.data?.acceptanceDecisionOptions || [];
    assert(
      JSON.stringify(decisionOptions) === JSON.stringify(['Accepted', 'Refine', 'Blocked']),
      'acceptance decision options mismatch'
    );
    const templateFields = acceptanceRecordTemplate.json?.data?.fields || [];
    assert(templateFields.some((item) => item.field_key === 'rollbackScope'), 'acceptance template missing rollbackScope');
    assert(templateFields.some((item) => item.field_key === 'evidenceRef'), 'acceptance template missing evidenceRef');

    const inboundBundlePayload = loadMmeInboundBundleFixture();
    inboundBundlePayload.request_id = `m9-governance-replay-${Date.now()}`;

    const firstImport = await jsonRequest('/api/v1/station/imports/inbound-bundle', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': inboundBundlePayload.request_id
      },
      body: JSON.stringify(inboundBundlePayload)
    });
    assert(firstImport.ok, 'first M9 replay import failed');
    assert(firstImport.json?.data?.idempotency_status === 'executed', 'first M9 replay import should execute');

    const replayImport = await jsonRequest('/api/v1/station/imports/inbound-bundle', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': inboundBundlePayload.request_id
      },
      body: JSON.stringify(inboundBundlePayload)
    });
    assert(replayImport.ok, 'replayed M9 import failed');
    assert(replayImport.json?.data?.idempotency_status === 'replayed', 'replayed M9 import should be idempotent');

    const importedFlightId = inboundBundlePayload.flight.flight_id;
    const importedAudit = await jsonRequest(
      `/api/v1/platform/audit/object?object_type=Flight&object_id=${encodeURIComponent(importedFlightId)}`,
      {
        headers: { Authorization: `Bearer ${stationToken}` }
      }
    );
    assert(importedAudit.ok, 'platform/audit/object failed for M9 replay flight');
    assert(
      importedAudit.json?.data?.events?.some((item) => item.action === 'STATION_INBOUND_BUNDLE_IMPORTED'),
      'M9 replay audit event missing'
    );

    console.log('\nM9 governance validation summary');
    console.log(`- station/login: ${stationLogin.status}`);
    console.log(`- copy-package / onboarding-playbook: ${copyPackage.status}/${onboardingPlaybook.status}`);
    console.log(`- governance-comparison / acceptance-record-template: ${governanceComparison.status}/${acceptanceRecordTemplate.status}`);
    console.log(`- inbound replay execute/replay: ${firstImport.status}/${replayImport.status}`);
    console.log(`- object audit: ${importedAudit.status}`);
  } finally {
    await stopWorker(worker);
  }
}

main().catch((error) => {
  console.error(`M9 governance validation failed: ${error.message}`);
  process.exitCode = 1;
});
