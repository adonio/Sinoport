import { once } from 'node:events';
import { spawn } from 'node:child_process';

const PORT = 8793;
const INSPECTOR_PORT = 9233;
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

async function jsonRequestWithRetry(path, options = {}, attempts = 3, waitMs = 200) {
  let lastResult;

  for (let index = 0; index < attempts; index += 1) {
    lastResult = await jsonRequest(path, options);
    if (lastResult.ok) {
      return lastResult;
    }

    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return lastResult;
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

async function resetIntegrationFixtures() {
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
  await resetIntegrationFixtures();

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
    const stationRefreshToken = stationLogin.json?.data?.refresh_token;
    assert(Boolean(stationToken), 'station/login token missing');
    assert(Boolean(stationRefreshToken), 'station/login refresh token missing');

    const mobileLogin = await jsonRequest('/api/v1/mobile/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator: 'Integration Mobile',
        employeeId: 'PDA-001',
        stationCode: 'MME',
        roleKey: 'receiver',
        language: 'zh'
      })
    });
    assert(mobileLogin.ok, 'mobile/login failed');
    const mobileToken = mobileLogin.json?.data?.token;
    assert(Boolean(mobileToken), 'mobile/login token missing');

    const stationMe = await jsonRequest('/api/v1/station/me', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(stationMe.ok, 'station/me failed');

    const stationRefresh = await jsonRequest('/api/v1/station/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: stationRefreshToken
      })
    });
    assert(stationRefresh.ok, 'station/refresh failed');
    assert(Boolean(stationRefresh.json?.data?.token), 'station/refresh token missing');

    const documents = await jsonRequest('/api/v1/station/documents', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(documents.ok, 'station/documents failed');
    assert(Array.isArray(documents.json?.items), 'station/documents invalid payload');

    const shipments = await jsonRequest('/api/v1/station/shipments', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(shipments.ok, 'station/shipments failed');
    assert(Array.isArray(shipments.json?.items), 'station/shipments invalid payload');

    const outboundFlights = await jsonRequest('/api/v1/station/outbound/flights', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundFlights.ok, 'station/outbound/flights failed');
    assert(Array.isArray(outboundFlights.json?.items), 'station/outbound/flights invalid payload');

    const outboundWaybills = await jsonRequest('/api/v1/station/outbound/waybills', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundWaybills.ok, 'station/outbound/waybills failed');
    assert(Array.isArray(outboundWaybills.json?.items), 'station/outbound/waybills invalid payload');

    const shipmentDetail = await jsonRequest('/api/v1/station/shipments/in-436-10358585', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(shipmentDetail.ok, 'station/shipments/:shipmentId failed');

    const outboundFlightDetail = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundFlightDetail.ok, 'station/outbound/flights/:flightId failed');

    const outboundWaybillDetail = await jsonRequest('/api/v1/station/outbound/waybills/AWB-436-10357583', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundWaybillDetail.ok, 'station/outbound/waybills/:awbId failed');

    const noa = await jsonRequest('/api/v1/station/inbound/waybills/AWB-436-10357944/noa', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'manual_send',
        channel: 'Email',
        note: 'integration NOA'
      })
    });
    assert(noa.ok, 'NOA integration failed');

    const pod = await jsonRequest('/api/v1/station/inbound/waybills/AWB-436-10358585/pod', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'archive',
        document_name: 'integration-pod.pdf',
        note: 'integration POD'
      })
    });
    assert(pod.ok, 'POD integration failed');

    const uploadTicket = await jsonRequest('/api/v1/station/uploads/presign', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        related_object_type: 'AWB',
        document_name: 'integration-manifest.pdf',
        content_type: 'application/pdf',
        size_bytes: 22,
        retention_class: 'operational'
      })
    });
    assert(uploadTicket.ok, 'station/uploads/presign failed');

    const uploadUrl = uploadTicket.json?.data?.upload_url;
    const uploadResponse = await fetch(`${BASE_URL}${uploadUrl}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/pdf'
      },
      body: 'integration-pdf-payload'
    });
    assert(uploadResponse.ok, 'station/uploads/:uploadId failed');

    const documentCreate = await jsonRequest('/api/v1/station/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document_type: 'Manifest',
        document_name: 'integration-manifest.pdf',
        related_object_type: 'AWB',
        related_object_id: 'AWB-436-10358585',
        station_id: 'MME',
        storage_key: uploadTicket.json?.data?.storage_key,
        upload_id: uploadTicket.json?.data?.upload_id,
        required_for_release: true,
        trigger_parse: true
      })
    });
    assert(documentCreate.ok, 'station/documents create with upload_id failed');

    const preview = await fetch(`${BASE_URL}/api/v1/station/documents/${documentCreate.json?.data?.document_id}/preview`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(preview.ok, 'station/documents/:id/preview failed');

    const accept = await jsonRequest('/api/v1/mobile/tasks/TASK-0408-201/accept', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mobileToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration accept' })
    });
    assert(accept.ok, 'mobile accept failed');

    const start = await jsonRequest('/api/v1/mobile/tasks/TASK-0408-201/start', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mobileToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration start' })
    });
    assert(start.ok, 'mobile start failed');

    const evidence = await jsonRequest('/api/v1/mobile/tasks/TASK-0408-201/evidence', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mobileToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        note: 'integration evidence',
        evidence_summary: 'integration evidence payload'
      })
    });
    assert(evidence.ok, 'mobile evidence failed');

    const complete = await jsonRequest('/api/v1/mobile/tasks/TASK-0408-201/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mobileToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration complete' })
    });
    assert(complete.ok, 'mobile complete failed');

    const verifyTask = await jsonRequest('/api/v1/station/tasks/TASK-0408-201/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration verify' })
    });
    assert(verifyTask.ok, 'station/tasks/:taskId/verify failed');

    const escalateTask = await jsonRequest('/api/v1/station/tasks/TASK-0408-002/escalate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration escalate', reason: 'integration escalate' })
    });
    assert(escalateTask.ok, 'station/tasks/:taskId/escalate failed');

    const reworkTask = await jsonRequest('/api/v1/station/tasks/TASK-0408-001/rework', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration rework', reason: 'integration rework' })
    });
    assert(reworkTask.ok, 'station/tasks/:taskId/rework failed');

    const resolveException = await jsonRequest('/api/v1/station/exceptions/EXP-0408-001/resolve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration resolve', resolution: 'integration resolve' })
    });
    assert(resolveException.ok, 'station/exceptions/:exceptionId/resolve failed');

    const outboundLoaded = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME/loaded', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration loaded' })
    });
    assert(outboundLoaded.ok, 'station/outbound/flights/:flightId/loaded failed');

    const outboundManifest = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME/manifest/finalize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration manifest finalize' })
    });
    assert(outboundManifest.ok, 'station/outbound/flights/:flightId/manifest/finalize failed');

    const outboundAirborne = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME/airborne', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration airborne' })
    });
    assert(outboundAirborne.ok, 'station/outbound/flights/:flightId/airborne failed');

    const inboundCounts = await jsonRequest('/api/v1/mobile/inbound/SE803/counts/436-10358585', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mobileToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ counted_boxes: 12, status: '理货完成', scanned_serials: ['BOX-001', 'BOX-002'] })
    });
    assert(inboundCounts.ok, 'mobile inbound counts failed');

    const inboundPallet = await jsonRequest('/api/v1/mobile/inbound/SE803/pallets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mobileToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pallet_no: 'SE803-PLT-9901',
        total_boxes: 12,
        total_weight: 120.5,
        status: '计划',
        items: [{ awb: '436-10358585', boxes: 12, weight: 120.5 }]
      })
    });
    assert(inboundPallet.ok, 'mobile inbound pallets failed');

    const loadingPlan = await jsonRequest('/api/v1/mobile/inbound/SE803/loading-plans', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mobileToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        truckPlate: 'HX-INT-001',
        collectionNote: 'CN-INT-001',
        totalBoxes: 12,
        totalWeight: 120.5,
        pallets: ['SE803-PLT-9901']
      })
    });
    assert(loadingPlan.ok, 'mobile loading plans failed');

    const outboundReceipt = await jsonRequest('/api/v1/mobile/outbound/SE913/receipts/436-10357583', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mobileToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ received_pieces: 20, received_weight: 200.5, status: '已收货' })
    });
    assert(outboundReceipt.ok, 'mobile outbound receipt failed');

    const outboundContainer = await jsonRequest('/api/v1/mobile/outbound/SE913/containers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mobileToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        boardCode: 'ULD-INT-001',
        totalBoxes: 20,
        totalWeightKg: 200.5,
        reviewedWeightKg: 202.1,
        status: '待装机',
        entries: [{ awb: '436-10357583', pieces: 20, boxes: 10, weight: 200.5 }]
      })
    });
    assert(outboundContainer.ok, 'mobile outbound containers failed');

    const auditEvents = await jsonRequest('/api/v1/platform/audit/events', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(auditEvents.ok, 'platform/audit/events failed');

    const auditLogs = await jsonRequest('/api/v1/platform/audit/logs', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(auditLogs.ok, 'platform/audit/logs failed');

    const mobileStateWrite = await jsonRequest('/api/v1/mobile/state/integration-scope', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: {
          mode: 'integration',
          checkpoints: ['counting', 'loading'],
          updated_by_test: true
        }
      })
    });
    assert(mobileStateWrite.ok, 'mobile/state write failed');

    const mobileStateRead = await jsonRequestWithRetry('/api/v1/mobile/state/integration-scope', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(mobileStateRead.ok, 'mobile/state read failed');
    assert(mobileStateRead.json?.data?.state?.mode === 'integration', 'mobile/state payload mismatch');

    const objectAudit = await jsonRequest('/api/v1/platform/audit/object?object_type=AWB&object_key=436-10358585', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(objectAudit.ok, 'platform/audit/object failed');
    assert(Array.isArray(objectAudit.json?.data?.events), 'platform/audit/object invalid event payload');
    assert(Array.isArray(objectAudit.json?.data?.transitions), 'platform/audit/object invalid transition payload');

    console.log('\nIntegration summary');
    console.log(`- station/login: ${stationLogin.status}`);
    console.log(`- station/me & refresh: ${stationMe.status}/${stationRefresh.status}`);
    console.log(`- mobile/login: ${mobileLogin.status}`);
    console.log(`- station/documents count: ${documents.json.items.length}`);
    console.log(`- station/shipments count: ${shipments.json.items.length}`);
    console.log(`- outbound flights/waybills: ${outboundFlights.status}/${outboundWaybills.status}`);
    console.log(`- NOA/POD: ${noa.status}/${pod.status}`);
    console.log(`- upload ticket & preview: ${uploadTicket.status}/${preview.status}`);
    console.log(`- mobile task flow: ${accept.status}/${start.status}/${evidence.status}/${complete.status}`);
    console.log(`- task workflow: ${verifyTask.status}/${reworkTask.status}/${escalateTask.status}`);
    console.log(`- exception resolve: ${resolveException.status}`);
    console.log(`- outbound actions: ${outboundLoaded.status}/${outboundManifest.status}/${outboundAirborne.status}`);
    console.log(`- mobile business writes: ${inboundCounts.status}/${inboundPallet.status}/${loadingPlan.status}/${outboundReceipt.status}/${outboundContainer.status}`);
    console.log(`- audit events/logs: ${auditEvents.status}/${auditLogs.status}`);
    console.log(`- mobile state: ${mobileStateWrite.status}/${mobileStateRead.status}`);
    console.log(`- object audit: ${objectAudit.status}`);
  } finally {
    await stopWorker(worker);
  }
}

main().catch((error) => {
  console.error(`Integration API failed: ${error.message}`);
  process.exitCode = 1;
});
