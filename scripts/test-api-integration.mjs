import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { loadMmeInboundBundleFixture } from './replay-mme-inbound.mjs';

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
    "UPDATE exceptions SET exception_status = 'Open', closed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE exception_id = 'EXP-0408-001';",
    "UPDATE flights SET runtime_status = 'Pre-Departure', actual_takeoff_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE flight_id = 'FLIGHT-SE913-2026-04-09-MME';",
    "UPDATE shipments SET current_node = 'Loaded Preparation', fulfillment_status = 'Main AWB Completed', updated_at = CURRENT_TIMESTAMP WHERE shipment_id = 'SHIP-OUT-436-10357583';",
    "UPDATE awbs SET current_node = 'Loaded Preparation', manifest_status = 'Draft', updated_at = CURRENT_TIMESTAMP WHERE awb_id = 'AWB-436-10357583';",
    "UPDATE documents SET document_status = 'Approved', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-FFM-SE913';",
    "UPDATE documents SET document_status = 'Uploaded', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-UWS-SE913';",
    "UPDATE documents SET document_status = 'Uploaded', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-MANIFEST-SE913';",
    "UPDATE documents SET document_status = 'Approved', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-MAWB-436-10357583';",
    "UPDATE tasks SET task_status = 'Assigned', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0409-302';",
    "UPDATE tasks SET task_status = 'Completed', completed_at = '2026-04-09T18:30:00Z', verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0409-301';"
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

    const reportDate = '2026-04-08';
    const stationDailyReport = await jsonRequest(`/api/v1/station/reports/daily?date=${reportDate}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(stationDailyReport.ok, 'station/reports/daily failed');
    assert(stationDailyReport.json?.data?.reportMeta?.reportDate === reportDate, 'station/reports/daily report date mismatch');
    assert(Array.isArray(stationDailyReport.json?.data?.stationReportCards), 'station/reports/daily stationReportCards invalid payload');
    assert(Array.isArray(stationDailyReport.json?.data?.stationDailyReportRows), 'station/reports/daily stationDailyReportRows invalid payload');

    const platformDailyReport = await jsonRequest(`/api/v1/platform/reports/daily?date=${reportDate}&station_id=MME`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(platformDailyReport.ok, 'platform/reports/daily failed');
    assert(platformDailyReport.json?.data?.reportMeta?.reportDate === reportDate, 'platform/reports/daily report date mismatch');
    assert(Array.isArray(platformDailyReport.json?.data?.platformReportCards), 'platform/reports/daily platformReportCards invalid payload');
    assert(Array.isArray(platformDailyReport.json?.data?.platformDailyReportRows), 'platform/reports/daily platformDailyReportRows invalid payload');

    const exceptionDailyReport = await jsonRequest(`/api/v1/station/exceptions/daily?date=${reportDate}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(exceptionDailyReport.ok, 'station/exceptions/daily failed');
    assert(exceptionDailyReport.json?.data?.reportMeta?.reportDate === reportDate, 'station/exceptions/daily report date mismatch');
    assert(Array.isArray(exceptionDailyReport.json?.data?.exceptionOverviewCards), 'station/exceptions/daily exceptionOverviewCards invalid payload');
    assert(Array.isArray(exceptionDailyReport.json?.data?.exceptionDailyReportRows), 'station/exceptions/daily exceptionDailyReportRows invalid payload');

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

    const outboundLoadedDetail = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundLoadedDetail.ok, 'station/outbound/flights/:flightId not readable after loaded');
    assert(
      outboundLoadedDetail.json?.data?.task_summary?.some(
        (item) => item.task_type === '装机复核' && item.task_status === 'Completed'
      ),
      'loaded task status not reflected in outbound flight detail'
    );

    const outboundLoadedShipment = await jsonRequest('/api/v1/station/shipments/out-436-10357583', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundLoadedShipment.ok, 'station/shipments/out-436-10357583 not readable after loaded');
    assert(
      outboundLoadedShipment.json?.data?.timeline?.some((item) => item.label === 'Loaded' && item.status === '已装载'),
      'loaded shipment timeline not reflected'
    );

    const outboundAirborneBlocked = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME/airborne', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration airborne blocked' })
    });
    assert(!outboundAirborneBlocked.ok, 'airborne should be blocked before manifest finalize');
    assert(
      outboundAirborneBlocked.status === 409 && outboundAirborneBlocked.json?.error?.code === 'MANIFEST_NOT_FINALIZED',
      'airborne precondition failure was not returned as MANIFEST_NOT_FINALIZED'
    );

    const outboundManifest = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME/manifest/finalize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration manifest finalize' })
    });
    assert(outboundManifest.ok, 'station/outbound/flights/:flightId/manifest/finalize failed');

    const outboundManifestDetail = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundManifestDetail.ok, 'station/outbound/flights/:flightId not readable after manifest finalize');
    assert(
      outboundManifestDetail.json?.data?.document_summary?.some(
        (item) => item.document_type === 'Manifest' && item.document_status === 'Released'
      ),
      'manifest release not reflected in outbound flight detail'
    );

    const outboundAirborne = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME/airborne', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration airborne' })
    });
    assert(outboundAirborne.ok, 'station/outbound/flights/:flightId/airborne failed');

    const outboundAirborneDetail = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundAirborneDetail.ok, 'station/outbound/flights/:flightId not readable after airborne');
    assert(
      outboundAirborneDetail.json?.data?.flight?.runtime_status === 'Airborne',
      'airborne runtime status not reflected in outbound flight detail'
    );

    const outboundAirborneShipment = await jsonRequest('/api/v1/station/shipments/out-436-10357583', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundAirborneShipment.ok, 'station/shipments/out-436-10357583 not readable after airborne');
    assert(
      outboundAirborneShipment.json?.data?.timeline?.some((item) => item.label === 'Airborne' && item.status === 'Airborne'),
      'airborne shipment timeline not reflected'
    );

    const outboundAudit = await jsonRequest(
      '/api/v1/platform/audit/object?object_type=Flight&object_id=FLIGHT-SE913-2026-04-09-MME',
      {
        headers: { Authorization: `Bearer ${stationToken}` }
      }
    );
    assert(outboundAudit.ok, 'platform/audit/object failed for outbound flight');
    assert(
      outboundAudit.json?.data?.transitions?.some((item) => item.action === 'Flight.runtime_status' && item.after === 'Airborne'),
      'airborne transition not found in audit object'
    );
    assert(
      outboundAudit.json?.data?.events?.some((item) => item.action === 'OUTBOUND_FLIGHT_AIRBORNE' && item.payload?.awb_count >= 1),
      'audit payload for outbound airborne not exposed'
    );

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
    console.log(`- inbound bundle import: ${inboundBundle.status}`);
    console.log(`- imported flight/awb/shipment/task/audit reads: ${importedFlight.status}/${importedAwbOne.status}/${importedShipmentOne.status}/${importedTasks.status}/${importedAudit.status}`);
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
