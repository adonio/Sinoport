import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sinoportBaseUrl = process.env.SINOPORT_API_BASE_URL || 'http://127.0.0.1:8787';
const skyledgerBaseUrl = process.env.SKYLEDGER_API_BASE_URL || 'http://127.0.0.1:8100';
const container = process.env.SKYLEDGER_API_CONTAINER || 'skyledger-localtest-api';
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

async function requireHealthy(url, label) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `${label} health check returned ${response.status}`);
}

function dockerPython(module, args = []) {
  const output = execFileSync('docker', ['exec', container, 'python', '-m', module, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  }).trim();
  return output ? JSON.parse(output.split('\n').at(-1)) : {};
}

await requireHealthy(`${sinoportBaseUrl}/api/v1/healthz`, 'SINOport');
await requireHealthy(`${skyledgerBaseUrl}/health`, 'Skyledger');

const fixture = dockerPython('scripts.seed_sinoport_smoke_truck', ['--run-id', runId]);
const forward = dockerPython('scripts.sinoport_sync_worker', ['--once', '--limit', '200', '--reconcile']);
assert.ok(forward.delivery.delivered >= 0);

const sinoportOutput = execFileSync(process.execPath, ['scripts/test-v14-e2e-smoke.mjs'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
  env: {
    ...process.env,
    SINOPORT_API_BASE_URL: sinoportBaseUrl,
    SKYLEDGER_FIXTURE_JSON: JSON.stringify(fixture)
  }
}).trim();
const sinoport = JSON.parse(sinoportOutput);
assert.equal(sinoport.ok, true);

const reverse = dockerPython('scripts.verify_sinoport_smoke', [
  '--truck-id', fixture.truck_id,
  '--awb-id', fixture.awb_id
]);
assert.equal(reverse.ok, true);

const scopedReconciliationResponse = await fetch(`${sinoportBaseUrl}/api/v1/platform/integrations/skyledger/reconcile`, {
  method: 'POST',
  headers: {
    Authorization: 'Bearer demo-token',
    'Content-Type': 'application/json',
    'Idempotency-Key': `scoped-reconcile-${runId}`,
    'X-Debug-User-Id': 'cross-system-reconciler',
    'X-Debug-Roles': 'platform_admin,OCC_DM,DQC_DATA_QUALITY_CONTROLLER',
    'X-Debug-Station-Scope': 'SZX,TAS',
    'X-Debug-Tenant-Id': 'sinoport-v14-cross-system'
  },
  body: JSON.stringify({
    object_ids_by_type: {
      Flight: [fixture.flight_id],
      Awb: [fixture.awb_id],
      Shipment: [`awb:${fixture.awb_id}`],
      TransportJob: [fixture.truck_id]
    }
  })
});
const scopedReconciliation = await scopedReconciliationResponse.json();
assert.equal(scopedReconciliationResponse.status, 200, JSON.stringify(scopedReconciliation));
assert.equal(scopedReconciliation.data.peer_snapshot_verified, true);
assert.equal(scopedReconciliation.data.status, 'MATCHED');
assert.equal(scopedReconciliation.data.mismatch_count, 0);
assert.equal(scopedReconciliation.data.local_count, 4);
assert.equal(scopedReconciliation.data.peer_count, 4);

console.log(JSON.stringify({
  ok: true,
  run_id: runId,
  fixture,
  forward,
  sinoport,
  reverse,
  scoped_reconciliation: scopedReconciliation.data
}, null, 2));
