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

function uniqueSuffix(length = 6) {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
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
    "DELETE FROM state_transitions WHERE object_type = 'Flight' AND object_id IN (SELECT flight_id FROM flights WHERE flight_no LIKE 'IT%' OR flight_no LIKE 'OT%' OR flight_no LIKE 'DBG%');",
    "DELETE FROM audit_events WHERE object_type = 'Flight' AND object_id IN (SELECT flight_id FROM flights WHERE flight_no LIKE 'IT%' OR flight_no LIKE 'OT%' OR flight_no LIKE 'DBG%');",
    "DELETE FROM flights WHERE flight_no LIKE 'IT%' OR flight_no LIKE 'OT%' OR flight_no LIKE 'DBG%';",
    "UPDATE tasks SET task_status = 'Created', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-201';",
    "UPDATE tasks SET task_status = 'Completed', completed_at = '2026-04-08T19:05:00Z', verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-000';",
    "UPDATE tasks SET task_status = 'Started', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-001';",
    "UPDATE tasks SET task_status = 'Assigned', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-002';",
    "UPDATE awbs SET noa_status = 'Pending', updated_at = CURRENT_TIMESTAMP WHERE awb_id = 'AWB-436-10357944';",
    "UPDATE awbs SET pod_status = 'Pending', updated_at = CURRENT_TIMESTAMP WHERE awb_id = 'AWB-436-10358585';",
    "UPDATE exceptions SET related_object_type = 'Flight', related_object_id = 'FLIGHT-SE803-2026-04-08-MME', linked_task_id = 'TASK-0408-002', severity = 'P1', owner_role = 'check_worker', owner_team_id = 'TEAM-CK-01', blocker_flag = 1, root_cause = 'Pieces mismatch not verified', action_taken = 'Hold NOA until recount completed', exception_status = 'Open', closed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE exception_id = 'EXP-0408-001';",
    "UPDATE flights SET runtime_status = 'Pre-Departure', actual_takeoff_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE flight_id = 'FLIGHT-SE913-2026-04-09-MME';",
    "UPDATE shipments SET current_node = 'Loaded Preparation', fulfillment_status = 'Main AWB Completed', updated_at = CURRENT_TIMESTAMP WHERE shipment_id = 'SHIP-OUT-436-10357583';",
    "UPDATE awbs SET current_node = 'Loaded Preparation', manifest_status = 'Draft', updated_at = CURRENT_TIMESTAMP WHERE awb_id = 'AWB-436-10357583';",
    "UPDATE documents SET document_status = 'Approved', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-FFM-SE913';",
    "UPDATE documents SET document_status = 'Uploaded', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-UWS-SE913';",
    "UPDATE documents SET document_status = 'Uploaded', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-MANIFEST-SE913';",
    "UPDATE documents SET document_status = 'Approved', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-MAWB-436-10357583';",
    "UPDATE tasks SET task_status = 'Assigned', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0409-302';",
    "UPDATE tasks SET task_status = 'Completed', completed_at = '2026-04-09T18:30:00Z', verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0409-301';",
    "UPDATE exceptions SET exception_status = 'Open', action_taken = 'Document desk to upload final manifest and supervisor to recheck release gate', closed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE exception_id = 'EXP-0409-301';"
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
        roleIds: ['platform_admin', 'station_supervisor'],
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
    assert(documents.json?.page_size === 20, 'station/documents default page_size should be 20');

    const documentOptions = await jsonRequest('/api/v1/station/documents/options?related_object_type=AWB', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(documentOptions.ok, 'station/documents/options failed');
    assert(Array.isArray(documentOptions.json?.data?.document_type_options), 'station/documents/options type options invalid payload');
    assert(Array.isArray(documentOptions.json?.data?.related_object_options), 'station/documents/options related object options invalid payload');

    const reportDate = '2026-04-08';
    const stationDailyReport = await jsonRequest(`/api/v1/station/reports/daily?date=${reportDate}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(stationDailyReport.ok, 'station/reports/daily failed');
    assert(stationDailyReport.json?.data?.reportMeta?.reportDate === reportDate, 'station/reports/daily report date mismatch');
    assert(Boolean(stationDailyReport.json?.data?.reportMeta?.reportAnchor), 'station/reports/daily report anchor missing');
    assert(Array.isArray(stationDailyReport.json?.data?.stationReportCards), 'station/reports/daily stationReportCards invalid payload');
    assert(Array.isArray(stationDailyReport.json?.data?.stationDailyReportRows), 'station/reports/daily stationDailyReportRows invalid payload');
    assert(Array.isArray(stationDailyReport.json?.data?.refreshPolicyRows), 'station/reports/daily refreshPolicyRows invalid payload');
    assert(Array.isArray(stationDailyReport.json?.data?.traceabilityRows), 'station/reports/daily traceabilityRows invalid payload');

    const stationReportsOverview = await jsonRequest('/api/v1/station/reports/overview', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(stationReportsOverview.ok, 'station/reports/overview failed');
    assert(Array.isArray(stationReportsOverview.json?.data?.outboundActionRows), 'station/reports/overview outboundActionRows invalid payload');
    assert(
      stationReportsOverview.json?.data?.outboundActionRows?.some((item) => item.flightNo === 'SE913'),
      'station/reports/overview did not include outbound action row for SE913'
    );

    const platformDailyReport = await jsonRequest(`/api/v1/platform/reports/daily?date=${reportDate}&station_id=MME`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(platformDailyReport.ok, 'platform/reports/daily failed');
    assert(platformDailyReport.json?.data?.reportMeta?.reportDate === reportDate, 'platform/reports/daily report date mismatch');
    assert(Boolean(platformDailyReport.json?.data?.reportMeta?.reportAnchor), 'platform/reports/daily report anchor missing');
    assert(Array.isArray(platformDailyReport.json?.data?.platformReportCards), 'platform/reports/daily platformReportCards invalid payload');
    assert(Array.isArray(platformDailyReport.json?.data?.platformDailyReportRows), 'platform/reports/daily platformDailyReportRows invalid payload');
    assert(Array.isArray(platformDailyReport.json?.data?.platformStationComparisonRows), 'platform/reports/daily platformStationComparisonRows invalid payload');
    assert(
      platformDailyReport.json?.data?.platformStationComparisonRows?.some((item) => item.code === 'MME' && item.comparisonType === 'actual'),
      'platform/reports/daily did not include actual comparison row for MME'
    );
    assert(Array.isArray(platformDailyReport.json?.data?.refreshPolicyRows), 'platform/reports/daily refreshPolicyRows invalid payload');
    assert(Array.isArray(platformDailyReport.json?.data?.traceabilityRows), 'platform/reports/daily traceabilityRows invalid payload');

    const stationOptions = await jsonRequest('/api/v1/platform/stations/options', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(stationOptions.ok, 'platform/stations/options failed');
    assert(Array.isArray(stationOptions.json?.data?.controlLevels), 'platform/stations/options controlLevels invalid payload');
    assert(Array.isArray(stationOptions.json?.data?.phases), 'platform/stations/options phases invalid payload');
    assert(Array.isArray(stationOptions.json?.data?.owners), 'platform/stations/options owners invalid payload');

    const platformStations = await jsonRequest('/api/v1/platform/stations?page=1&page_size=20', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(platformStations.ok, 'platform/stations failed');
    assert(Array.isArray(platformStations.json?.data?.stationCatalog), 'platform/stations stationCatalog invalid payload');
    assert(platformStations.json?.data?.stationCatalogPage?.page_size === 20, 'platform/stations page size mismatch');

    const testStationId = `Z${uniqueSuffix(3)}`;
    const createStation = await jsonRequest('/api/v1/platform/stations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: testStationId,
        station_name: `${testStationId} Integration Station`,
        region: 'Integration',
        control_level: 'collaborative_control',
        phase: 'onboarding',
        airport_code: testStationId,
        service_scope: 'Integration validation',
        owner_name: 'Expansion Team'
      })
    });
    assert(createStation.ok, 'platform/stations create failed');
    assert(createStation.json?.data?.station?.code === testStationId, 'platform/stations create returned unexpected station');

    const stationDetail = await jsonRequest(`/api/v1/platform/stations/${testStationId}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(stationDetail.ok, 'platform/stations/:stationId failed');
    assert(stationDetail.json?.data?.station?.code === testStationId, 'platform/stations detail mismatch');

    const updateStation = await jsonRequest(`/api/v1/platform/stations/${testStationId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        region: 'Integration Updated',
        owner_name: 'MME Station Lead'
      })
    });
    assert(updateStation.ok, 'platform/stations update failed');
    assert(updateStation.json?.data?.station?.region === 'Integration Updated', 'platform/stations update did not persist region');

    const archiveStation = await jsonRequest(`/api/v1/platform/stations/${testStationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archiveStation.ok, 'platform/stations archive failed');

    const archivedStations = await jsonRequest('/api/v1/platform/stations?page=1&page_size=20&include_archived=true&keyword=Integration', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archivedStations.ok, 'platform/stations archived query failed');
    assert(
      archivedStations.json?.data?.stationCatalog?.some((item) => item.code === testStationId && item.archived),
      'platform/stations archived list missing archived station'
    );

    const restoreStation = await jsonRequest(`/api/v1/platform/stations/${testStationId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        archived: false
      })
    });
    assert(restoreStation.ok, 'platform/stations restore failed');
    assert(restoreStation.json?.data?.station?.archived === false, 'platform/stations restore did not clear archived flag');

    const stationAudit = await jsonRequest(`/api/v1/platform/audit/object?object_type=Station&object_key=${encodeURIComponent(testStationId)}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(stationAudit.ok, 'platform station audit lookup failed');
    assert(Array.isArray(stationAudit.json?.data?.events) && stationAudit.json.data.events.length > 0, 'platform station audit lookup returned no events');

    const teamOptions = await jsonRequest('/api/v1/platform/teams/options', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(teamOptions.ok, 'platform/teams/options failed');
    assert(Array.isArray(teamOptions.json?.data?.stations), 'platform/teams/options stations invalid payload');
    assert(Array.isArray(teamOptions.json?.data?.shifts), 'platform/teams/options shifts invalid payload');
    assert(Array.isArray(teamOptions.json?.data?.statuses), 'platform/teams/options statuses invalid payload');

    const platformTeams = await jsonRequest('/api/v1/platform/teams?page=1&page_size=20', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(platformTeams.ok, 'platform/teams failed');
    assert(Array.isArray(platformTeams.json?.data?.teamRows), 'platform/teams teamRows invalid payload');
    assert(platformTeams.json?.data?.teamPage?.page_size === 20, 'platform/teams page size mismatch');

    const testTeamId = `TEAM-${uniqueSuffix(6)}`;
    const createTeam = await jsonRequest('/api/v1/platform/teams', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        team_id: testTeamId,
        station_id: 'MME',
        team_name: 'Integration Team',
        owner_name: 'Integration Owner',
        shift_code: 'DAY',
        team_status: 'active',
        headcount: 7,
        mapped_lanes: 'MME -> Integration'
      })
    });
    assert(createTeam.ok, 'platform/teams create failed');
    assert(createTeam.json?.data?.team?.team_id === testTeamId, 'platform/teams create returned unexpected team');

    const teamDetail = await jsonRequest(`/api/v1/platform/teams/${testTeamId}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(teamDetail.ok, 'platform/teams/:teamId failed');
    assert(teamDetail.json?.data?.team?.team_id === testTeamId, 'platform/teams detail mismatch');

    const updateTeam = await jsonRequest(`/api/v1/platform/teams/${testTeamId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        headcount: 9,
        team_status: 'paused'
      })
    });
    assert(updateTeam.ok, 'platform/teams update failed');
    assert(updateTeam.json?.data?.team?.headcount === 9, 'platform/teams update did not persist headcount');

    const archiveTeam = await jsonRequest(`/api/v1/platform/teams/${testTeamId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archiveTeam.ok, 'platform/teams archive failed');

    const archivedTeams = await jsonRequest(`/api/v1/platform/teams?page=1&page_size=20&include_archived=true&keyword=${encodeURIComponent(testTeamId)}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archivedTeams.ok, 'platform/teams archived query failed');
    assert(
      archivedTeams.json?.data?.teamRows?.some((item) => item.team_id === testTeamId && item.archived),
      'platform/teams archived list missing archived team'
    );

    const restoreTeam = await jsonRequest(`/api/v1/platform/teams/${testTeamId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        archived: false,
        team_status: 'active'
      })
    });
    assert(restoreTeam.ok, 'platform/teams restore failed');
    assert(restoreTeam.json?.data?.team?.archived === false, 'platform/teams restore did not clear archived flag');

    const teamAudit = await jsonRequest(`/api/v1/platform/audit/object?object_type=Team&object_key=${encodeURIComponent(testTeamId)}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(teamAudit.ok, 'platform team audit lookup failed');
    assert(Array.isArray(teamAudit.json?.data?.events) && teamAudit.json.data.events.length > 0, 'platform team audit lookup returned no events');

    const inboundFlightOptions = await jsonRequest('/api/v1/station/flights/options?direction=inbound&station_id=MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(inboundFlightOptions.ok, 'station/flights/options inbound failed');
    assert(Array.isArray(inboundFlightOptions.json?.data?.sourceOptions), 'station/flights/options inbound sourceOptions invalid payload');
    assert(Array.isArray(inboundFlightOptions.json?.data?.serviceLevels), 'station/flights/options inbound serviceLevels invalid payload');
    assert(Array.isArray(inboundFlightOptions.json?.data?.runtimeStatuses), 'station/flights/options inbound runtimeStatuses invalid payload');

    const inboundFlightCreateOptions = await jsonRequest('/api/v1/station/inbound/flight-create/options?station_id=MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(inboundFlightCreateOptions.ok, 'station/inbound/flight-create/options failed');
    assert(Array.isArray(inboundFlightCreateOptions.json?.data?.sourceOptions), 'station/inbound/flight-create/options sourceOptions invalid payload');

    const inboundFlightsPage = await jsonRequest('/api/v1/station/inbound/flights?page=1&page_size=20&station_id=MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(inboundFlightsPage.ok, 'station/inbound/flights failed');
    assert(Array.isArray(inboundFlightsPage.json?.items), 'station/inbound/flights invalid payload');
    assert(inboundFlightsPage.json?.page_size === 20, 'station/inbound/flights page size mismatch');
    assert(typeof inboundFlightsPage.json?.total === 'number', 'station/inbound/flights total missing');

    const inboundSourceOption = inboundFlightOptions.json?.data?.sourceOptions?.find((item) => !item.disabled);
    const inboundServiceLevel = inboundFlightOptions.json?.data?.serviceLevels?.[0]?.value || 'P2';
    const inboundRuntimeStatus = inboundFlightOptions.json?.data?.runtimeStatuses?.[0]?.value || 'Pre-Arrival';
    const inboundFlightNo = `IT${String(Date.now()).slice(-6)}`;

    const createInboundFlight = await jsonRequest('/api/v1/station/inbound/flights', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        flight_no: inboundFlightNo,
        origin_code: inboundSourceOption?.value,
        eta: '2026-04-18T09:30',
        etd: '2026-04-18T10:15',
        service_level: inboundServiceLevel,
        runtime_status: inboundRuntimeStatus,
        notes: 'integration inbound create'
      })
    });
    assert(createInboundFlight.ok, 'station/inbound/flights create failed');
    assert(Boolean(createInboundFlight.json?.data?.flight_id), 'station/inbound/flights create flight_id missing');

    const createdInboundFlightId = createInboundFlight.json?.data?.flight_id;
    const inboundFlightDetail = await jsonRequest(`/api/v1/station/inbound/flights/${encodeURIComponent(createdInboundFlightId)}?station_id=MME`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(inboundFlightDetail.ok, 'station/inbound/flights/:flightId failed for created flight');

    const updateInboundFlight = await jsonRequest(`/api/v1/station/inbound/flights/${encodeURIComponent(createdInboundFlightId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        runtime_status: 'Landed',
        service_level: 'P1',
        notes: 'integration inbound update'
      })
    });
    assert(updateInboundFlight.ok, 'station/inbound/flights update failed');
    assert(updateInboundFlight.json?.data?.runtime_status === 'Landed', 'station/inbound/flights update did not persist runtime_status');

    const archiveInboundFlight = await jsonRequest(`/api/v1/station/inbound/flights/${encodeURIComponent(createdInboundFlightId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archiveInboundFlight.ok, 'station/inbound/flights archive failed');

    const archivedInboundFlights = await jsonRequest(
      `/api/v1/station/inbound/flights?page=1&page_size=20&station_id=MME&include_archived=true&flight_no=${encodeURIComponent(inboundFlightNo)}`,
      {
        headers: { Authorization: `Bearer ${stationToken}` }
      }
    );
    assert(archivedInboundFlights.ok, 'station/inbound/flights archived query failed');
    assert(
      archivedInboundFlights.json?.items?.some((item) => item.flight_no === inboundFlightNo),
      'station/inbound/flights archived list missing created flight'
    );

    const restoreInboundFlight = await jsonRequest(`/api/v1/station/inbound/flights/${encodeURIComponent(createdInboundFlightId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        archived: false,
        runtime_status: 'Pre-Arrival'
      })
    });
    assert(restoreInboundFlight.ok, 'station/inbound/flights restore failed');
    assert(restoreInboundFlight.json?.data?.archived === false, 'station/inbound/flights restore did not clear archived flag');

    const outboundFlightOptions = await jsonRequest('/api/v1/station/flights/options?direction=outbound&station_id=MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundFlightOptions.ok, 'station/flights/options outbound failed');
    assert(Array.isArray(outboundFlightOptions.json?.data?.destinationOptions), 'station/flights/options outbound destinationOptions invalid payload');
    assert(Array.isArray(outboundFlightOptions.json?.data?.serviceLevels), 'station/flights/options outbound serviceLevels invalid payload');
    assert(Array.isArray(outboundFlightOptions.json?.data?.runtimeStatuses), 'station/flights/options outbound runtimeStatuses invalid payload');

    const outboundFlightsPage = await jsonRequest('/api/v1/station/outbound/flights?page=1&page_size=20&station_id=MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundFlightsPage.ok, 'station/outbound/flights failed');
    assert(Array.isArray(outboundFlightsPage.json?.items), 'station/outbound/flights invalid payload');
    assert(outboundFlightsPage.json?.page_size === 20, 'station/outbound/flights page size mismatch');
    assert(typeof outboundFlightsPage.json?.total === 'number', 'station/outbound/flights total missing');

    const outboundDestinationOption = outboundFlightOptions.json?.data?.destinationOptions?.find((item) => !item.disabled);
    const outboundServiceLevel = outboundFlightOptions.json?.data?.serviceLevels?.[0]?.value || 'P2';
    const outboundRuntimeStatus = outboundFlightOptions.json?.data?.runtimeStatuses?.[0]?.value || 'Scheduled';
    const outboundFlightNo = `OT${String(Date.now()).slice(-6)}`;

    const createOutboundFlight = await jsonRequest('/api/v1/station/outbound/flights', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        flight_no: outboundFlightNo,
        destination_code: outboundDestinationOption?.value,
        std_at: '2026-04-18T13:00',
        etd_at: '2026-04-18T13:30',
        service_level: outboundServiceLevel,
        runtime_status: outboundRuntimeStatus,
        notes: 'integration outbound create'
      })
    });
    assert(createOutboundFlight.ok, 'station/outbound/flights create failed');
    assert(Boolean(createOutboundFlight.json?.data?.flight_id), 'station/outbound/flights create flight_id missing');

    const createdOutboundFlightId = createOutboundFlight.json?.data?.flight_id;
    const createdOutboundFlightDetail = await jsonRequest(`/api/v1/station/outbound/flights/${encodeURIComponent(createdOutboundFlightId)}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(createdOutboundFlightDetail.ok, 'station/outbound/flights/:flightId failed for created flight');

    const updateOutboundFlight = await jsonRequest(`/api/v1/station/outbound/flights/${encodeURIComponent(createdOutboundFlightId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        runtime_status: 'Pre-Departure',
        service_level: 'P1',
        notes: 'integration outbound update'
      })
    });
    assert(updateOutboundFlight.ok, 'station/outbound/flights update failed');
    assert(
      updateOutboundFlight.json?.data?.runtime_status === 'Pre-Departure',
      'station/outbound/flights update did not persist runtime_status'
    );

    const archiveOutboundFlight = await jsonRequest(`/api/v1/station/outbound/flights/${encodeURIComponent(createdOutboundFlightId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archiveOutboundFlight.ok, 'station/outbound/flights archive failed');

    const archivedOutboundFlights = await jsonRequest(
      `/api/v1/station/outbound/flights?page=1&page_size=20&station_id=MME&include_archived=true&flight_no=${encodeURIComponent(outboundFlightNo)}`,
      {
        headers: { Authorization: `Bearer ${stationToken}` }
      }
    );
    assert(archivedOutboundFlights.ok, 'station/outbound/flights archived query failed');
    assert(
      archivedOutboundFlights.json?.items?.some((item) => item.flight_no === outboundFlightNo),
      'station/outbound/flights archived list missing created flight'
    );

    const restoreOutboundFlight = await jsonRequest(`/api/v1/station/outbound/flights/${encodeURIComponent(createdOutboundFlightId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        archived: false,
        runtime_status: 'Scheduled'
      })
    });
    assert(restoreOutboundFlight.ok, 'station/outbound/flights restore failed');
    assert(restoreOutboundFlight.json?.data?.archived === false, 'station/outbound/flights restore did not clear archived flag');

    const flightAudit = await jsonRequest(
      `/api/v1/platform/audit/object?object_type=Flight&object_id=${encodeURIComponent(createdInboundFlightId)}`,
      {
        headers: { Authorization: `Bearer ${stationToken}` }
      }
    );
    assert(flightAudit.ok, 'platform audit lookup failed for created inbound flight');
    assert(Array.isArray(flightAudit.json?.data?.events) && flightAudit.json.data.events.length > 0, 'created inbound flight audit events missing');

    const stationCopyPackage = await jsonRequest('/api/v1/platform/station-governance/stations/MME/copy-package', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(stationCopyPackage.ok, 'platform/station-governance/stations/:stationId/copy-package failed');
    assert(
      stationCopyPackage.json?.data?.template_station_id === 'MME',
      'station copy package template station mismatch'
    );
    assert(
      stationCopyPackage.json?.data?.benchmark_station_id === 'RZE',
      'station copy package benchmark station mismatch'
    );
    assert(
      Array.isArray(stationCopyPackage.json?.data?.mandatory_consistency_items) &&
        stationCopyPackage.json.data.mandatory_consistency_items.length > 0,
      'station copy package mandatory consistency items invalid payload'
    );
    assert(
      Array.isArray(stationCopyPackage.json?.data?.station_override_items) &&
        stationCopyPackage.json.data.station_override_items.length > 0,
      'station copy package station override items invalid payload'
    );
    assert(
      stationCopyPackage.json?.data?.rollback_policy?.mode === 'template-and-configuration',
      'station copy package rollback policy mismatch'
    );

    const stationOnboardingPlaybook = await jsonRequest('/api/v1/platform/station-governance/stations/MME/onboarding-playbook', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(stationOnboardingPlaybook.ok, 'platform/station-governance/stations/:stationId/onboarding-playbook failed');
    assert(
      stationOnboardingPlaybook.json?.data?.template_station_id === 'MME',
      'station onboarding playbook template station mismatch'
    );
    assert(
      stationOnboardingPlaybook.json?.data?.benchmark_station_id === 'RZE',
      'station onboarding playbook benchmark station mismatch'
    );
    assert(
      Array.isArray(stationOnboardingPlaybook.json?.data?.conflict_rules) &&
        stationOnboardingPlaybook.json.data.conflict_rules.length >= 5,
      'station onboarding playbook conflict rules invalid payload'
    );
    assert(
      Array.isArray(stationOnboardingPlaybook.json?.data?.onboarding_checklist) &&
        stationOnboardingPlaybook.json.data.onboarding_checklist.length > 0,
      'station onboarding playbook checklist invalid payload'
    );
    assert(
      stationOnboardingPlaybook.json?.data?.completion_policy?.warnings_require_manual_ack === true,
      'station onboarding playbook completion policy mismatch'
    );

    const stationGovernanceComparison = await jsonRequest('/api/v1/platform/station-governance/stations/MME/governance-comparison?date=2026-04-08', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(stationGovernanceComparison.ok, 'platform/station-governance/stations/:stationId/governance-comparison failed');
    assert(
      stationGovernanceComparison.json?.data?.comparison_anchor?.baselineStationCode === 'RZE',
      'station governance comparison baseline station mismatch'
    );
    assert(
      Array.isArray(stationGovernanceComparison.json?.data?.metric_rows) &&
        stationGovernanceComparison.json.data.metric_rows.length >= 6,
      'station governance comparison metric rows invalid payload'
    );
    assert(
      Array.isArray(stationGovernanceComparison.json?.data?.difference_path_rows) &&
        stationGovernanceComparison.json.data.difference_path_rows.length > 0,
      'station governance comparison difference path invalid payload'
    );

    const stationAcceptanceRecordTemplate = await jsonRequest(
      '/api/v1/platform/station-governance/stations/MME/acceptance-record-template?date=2026-04-08',
      {
        headers: { Authorization: `Bearer ${stationToken}` }
      }
    );
    assert(
      stationAcceptanceRecordTemplate.ok,
      'platform/station-governance/stations/:stationId/acceptance-record-template failed'
    );
    assert(
      Array.isArray(stationAcceptanceRecordTemplate.json?.data?.acceptanceDecisionOptions) &&
        stationAcceptanceRecordTemplate.json.data.acceptanceDecisionOptions.includes('Accepted'),
      'station acceptance record template decision options invalid payload'
    );
    assert(
      Array.isArray(stationAcceptanceRecordTemplate.json?.data?.fields) &&
        stationAcceptanceRecordTemplate.json.data.fields.length > 0,
      'station acceptance record template fields invalid payload'
    );

    const exceptionDailyReport = await jsonRequest(`/api/v1/station/exceptions/daily?date=${reportDate}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(exceptionDailyReport.ok, 'station/exceptions/daily failed');
    assert(exceptionDailyReport.json?.data?.reportMeta?.reportDate === reportDate, 'station/exceptions/daily report date mismatch');
    assert(Boolean(exceptionDailyReport.json?.data?.reportMeta?.reportAnchor), 'station/exceptions/daily report anchor missing');
    assert(Array.isArray(exceptionDailyReport.json?.data?.exceptionOverviewCards), 'station/exceptions/daily exceptionOverviewCards invalid payload');
    assert(Array.isArray(exceptionDailyReport.json?.data?.exceptionDailyReportRows), 'station/exceptions/daily exceptionDailyReportRows invalid payload');
    assert(Array.isArray(exceptionDailyReport.json?.data?.refreshPolicyRows), 'station/exceptions/daily refreshPolicyRows invalid payload');
    assert(Array.isArray(exceptionDailyReport.json?.data?.traceabilityRows), 'station/exceptions/daily traceabilityRows invalid payload');

    const shipments = await jsonRequest('/api/v1/station/shipments', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(shipments.ok, 'station/shipments failed');
    assert(Array.isArray(shipments.json?.items), 'station/shipments invalid payload');
    assert(shipments.json?.page_size === 20, 'station/shipments page_size should default to 20');
    assert(typeof shipments.json?.total === 'number', 'station/shipments total missing');

    const shipmentOptions = await jsonRequest('/api/v1/station/shipments/options', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(shipmentOptions.ok, 'station/shipments/options failed');
    assert(Array.isArray(shipmentOptions.json?.data?.directionOptions), 'shipment directionOptions invalid payload');
    assert(Array.isArray(shipmentOptions.json?.data?.flightOptions), 'shipment flightOptions invalid payload');
    assert(Array.isArray(shipmentOptions.json?.data?.currentNodeOptions), 'shipment currentNodeOptions invalid payload');
    assert(Array.isArray(shipmentOptions.json?.data?.fulfillmentStatusOptions), 'shipment fulfillmentStatusOptions invalid payload');
    assert(Array.isArray(shipmentOptions.json?.data?.blockerStateOptions), 'shipment blockerStateOptions invalid payload');

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
    assert(outboundWaybills.json?.page_size === 20, 'station/outbound/waybills page_size should default to 20');
    assert(typeof outboundWaybills.json?.total === 'number', 'station/outbound/waybills total missing');

    const inboundWaybills = await jsonRequest('/api/v1/station/inbound/waybills', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(inboundWaybills.ok, 'station/inbound/waybills failed');
    assert(Array.isArray(inboundWaybills.json?.items), 'station/inbound/waybills invalid payload');
    assert(inboundWaybills.json?.page_size === 20, 'station/inbound/waybills page_size should default to 20');
    assert(typeof inboundWaybills.json?.total === 'number', 'station/inbound/waybills total missing');

    const inboundWaybillOptions = await jsonRequest('/api/v1/station/waybills/options?direction=inbound', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(inboundWaybillOptions.ok, 'station/waybills/options inbound failed');
    assert(Array.isArray(inboundWaybillOptions.json?.data?.flightOptions), 'inbound waybill flight options invalid payload');
    assert(Array.isArray(inboundWaybillOptions.json?.data?.awbTypeOptions), 'inbound waybill awbTypeOptions invalid payload');
    assert(Array.isArray(inboundWaybillOptions.json?.data?.currentNodeOptions), 'inbound waybill currentNodeOptions invalid payload');
    assert(Array.isArray(inboundWaybillOptions.json?.data?.noaStatusOptions), 'inbound waybill noaStatusOptions invalid payload');
    assert(Array.isArray(inboundWaybillOptions.json?.data?.podStatusOptions), 'inbound waybill podStatusOptions invalid payload');
    assert(Array.isArray(inboundWaybillOptions.json?.data?.transferStatusOptions), 'inbound waybill transferStatusOptions invalid payload');

    const outboundWaybillOptions = await jsonRequest('/api/v1/station/waybills/options?direction=outbound', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundWaybillOptions.ok, 'station/waybills/options outbound failed');
    assert(Array.isArray(outboundWaybillOptions.json?.data?.flightOptions), 'outbound waybill flight options invalid payload');
    assert(Array.isArray(outboundWaybillOptions.json?.data?.awbTypeOptions), 'outbound waybill awbTypeOptions invalid payload');
    assert(Array.isArray(outboundWaybillOptions.json?.data?.currentNodeOptions), 'outbound waybill currentNodeOptions invalid payload');
    assert(Array.isArray(outboundWaybillOptions.json?.data?.manifestStatusOptions), 'outbound waybill manifestStatusOptions invalid payload');

    const shipmentDetail = await jsonRequest('/api/v1/station/shipments/in-436-10358585', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(shipmentDetail.ok, 'station/shipments/:shipmentId failed');
    assert(Array.isArray(shipmentDetail.json?.data?.gate_policy_summary), 'station/shipments/:shipmentId gate_policy_summary invalid payload');
    assert(typeof shipmentDetail.json?.data?.gate_policy_overview?.total === 'number', 'station/shipments/:shipmentId gate_policy_overview missing');

    const outboundFlightDetail = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundFlightDetail.ok, 'station/outbound/flights/:flightId failed');

    const outboundWaybillDetail = await jsonRequest('/api/v1/station/outbound/waybills/AWB-436-10357583', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundWaybillDetail.ok, 'station/outbound/waybills/:awbId failed');

    const updateInboundWaybill = await jsonRequest('/api/v1/station/inbound/waybills/AWB-436-10354363', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        awb_no: '436-10354363',
        awb_type: 'IMPORT',
        consignee_name: 'Integration Consignee',
        pieces: 3,
        gross_weight: 25.5,
        current_node: 'Inbound Handling',
        noa_status: 'Pending',
        pod_status: 'Pending',
        transfer_status: 'Pending'
      })
    });
    assert(updateInboundWaybill.ok, 'station/inbound/waybills/:awbId patch failed');
    assert(updateInboundWaybill.json?.data?.direction === 'inbound', 'inbound waybill patch direction mismatch');

    const archiveInboundWaybill = await jsonRequest('/api/v1/station/inbound/waybills/AWB-436-10354363', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archiveInboundWaybill.ok, 'station/inbound/waybills/:awbId delete failed');
    assert(archiveInboundWaybill.json?.data?.archived === true, 'inbound waybill delete did not archive');

    const restoreInboundWaybill = await jsonRequest('/api/v1/station/inbound/waybills/AWB-436-10354363', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        archived: false
      })
    });
    assert(restoreInboundWaybill.ok, 'station/inbound/waybills/:awbId restore failed');
    assert(restoreInboundWaybill.json?.data?.archived === false, 'inbound waybill restore did not clear archive');

    const updateOutboundWaybill = await jsonRequest('/api/v1/station/outbound/waybills/AWB-436-10359044-OUT', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        awb_no: '436-10359044-OUT',
        awb_type: 'EXPORT',
        notify_name: 'Integration Notify',
        pieces: 20,
        gross_weight: 200.5,
        current_node: 'Receipt Planned',
        manifest_status: 'Draft'
      })
    });
    assert(updateOutboundWaybill.ok, 'station/outbound/waybills/:awbId patch failed');
    assert(updateOutboundWaybill.json?.data?.direction === 'outbound', 'outbound waybill patch direction mismatch');

    const archiveOutboundWaybill = await jsonRequest('/api/v1/station/outbound/waybills/AWB-436-10359044-OUT', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archiveOutboundWaybill.ok, 'station/outbound/waybills/:awbId delete failed');
    assert(archiveOutboundWaybill.json?.data?.archived === true, 'outbound waybill delete did not archive');

    const restoreOutboundWaybill = await jsonRequest('/api/v1/station/outbound/waybills/AWB-436-10359044-OUT', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        station_id: 'MME',
        archived: false
      })
    });
    assert(restoreOutboundWaybill.ok, 'station/outbound/waybills/:awbId restore failed');
    assert(restoreOutboundWaybill.json?.data?.archived === false, 'outbound waybill restore did not clear archive');

    const inboundBundlePayload = loadMmeInboundBundleFixture();
    const inboundBundle = await jsonRequest('/api/v1/station/imports/inbound-bundle', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': inboundBundlePayload.request_id
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
    assert(importedTasks.json?.page_size === 20, 'station/tasks default page_size should be 20');
    assert(
      importedTasks.json?.items?.some((item) => item.task_id === importedTaskOneId),
      'imported task #1 not found in station/tasks'
    );
    assert(
      importedTasks.json?.items?.some((item) => item.task_id === importedTaskTwoId),
      'imported task #2 not found in station/tasks'
    );

    const taskOptions = await jsonRequest('/api/v1/station/tasks/options?station_id=MME&related_object_type=Flight', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(taskOptions.ok, 'station/tasks/options failed');
    assert(Array.isArray(taskOptions.json?.data?.task_status_options), 'station/tasks/options task_status_options invalid payload');
    assert(Array.isArray(taskOptions.json?.data?.task_priority_options), 'station/tasks/options task_priority_options invalid payload');
    assert(Array.isArray(taskOptions.json?.data?.assigned_role_options), 'station/tasks/options assigned_role_options invalid payload');
    assert(Array.isArray(taskOptions.json?.data?.related_object_options), 'station/tasks/options related_object_options invalid payload');

    const taskDetail = await jsonRequest('/api/v1/station/tasks/TASK-0408-000', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(taskDetail.ok, 'station/tasks/:taskId failed');
    assert(taskDetail.json?.data?.task?.task_id === 'TASK-0408-000', 'station/tasks/:taskId detail mismatch');

    const updateTask = await jsonRequest('/api/v1/station/tasks/TASK-0408-000', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        blocker_code: 'HG-TASK-INTEGRATION',
        task_sla: '45m',
        evidence_required: true
      })
    });
    assert(updateTask.ok, 'station/tasks/:taskId update failed');

    const archiveTask = await jsonRequest('/api/v1/station/tasks/TASK-0408-000', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archiveTask.ok, 'station/tasks/:taskId archive failed');

    const archivedTasks = await jsonRequest('/api/v1/station/tasks?station_id=MME&include_archived=true&keyword=TASK-0408-000', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archivedTasks.ok, 'station/tasks archived query failed');
    assert(
      archivedTasks.json?.items?.some((item) => item.task_id === 'TASK-0408-000' && item.archived),
      'station/tasks archived list missing archived task'
    );

    const restoreTask = await jsonRequest('/api/v1/station/tasks/TASK-0408-000', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        archived: false,
        blocker_code: null
      })
    });
    assert(restoreTask.ok, 'station/tasks/:taskId restore failed');

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
        action: 'validate',
        channel: 'Email',
        note: 'integration NOA'
      })
    });
    assert(noa.ok, 'NOA integration failed');
    assert(noa.json?.data?.validation_passed === false, 'NOA validation should remain blocked while inbound exception is open');

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

    const documentDetail = await jsonRequest(`/api/v1/station/documents/${documentCreate.json?.data?.document_id}`, {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(documentDetail.ok, 'station/documents/:id detail failed');
    assert(documentDetail.json?.data?.document?.document_id === documentCreate.json?.data?.document_id, 'station/documents/:id detail mismatch');

    const documentUpdate = await jsonRequest(`/api/v1/station/documents/${documentCreate.json?.data?.document_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document_status: 'Validated',
        retention_class: 'compliance',
        note: 'integration document update'
      })
    });
    assert(documentUpdate.ok, 'station/documents/:id update failed');
    assert(documentUpdate.json?.data?.document_status === 'Validated', 'station/documents/:id update status mismatch');

    const documentArchive = await jsonRequest(`/api/v1/station/documents/${documentCreate.json?.data?.document_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(documentArchive.ok, 'station/documents/:id archive failed');
    assert(documentArchive.json?.data?.archived === true, 'station/documents/:id archive mismatch');

    const documentRestore = await jsonRequest(`/api/v1/station/documents/${documentCreate.json?.data?.document_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ archived: false })
    });
    assert(documentRestore.ok, 'station/documents/:id restore failed');
    assert(documentRestore.json?.data?.archived === false, 'station/documents/:id restore mismatch');

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

    const exceptionList = await jsonRequest('/api/v1/station/exceptions?station_id=MME', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(exceptionList.ok, 'station/exceptions failed');
    assert(Array.isArray(exceptionList.json?.items), 'station/exceptions invalid payload');
    assert(exceptionList.json?.page_size === 20, 'station/exceptions default page_size should be 20');

    const exceptionOptions = await jsonRequest('/api/v1/station/exceptions/options?station_id=MME&related_object_type=AWB', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(exceptionOptions.ok, 'station/exceptions/options failed');
    assert(Array.isArray(exceptionOptions.json?.data?.exception_type_options), 'station/exceptions/options exception_type_options invalid payload');
    assert(Array.isArray(exceptionOptions.json?.data?.severity_options), 'station/exceptions/options severity_options invalid payload');
    assert(Array.isArray(exceptionOptions.json?.data?.exception_status_options), 'station/exceptions/options exception_status_options invalid payload');
    assert(Array.isArray(exceptionOptions.json?.data?.owner_role_options), 'station/exceptions/options owner_role_options invalid payload');
    assert(Array.isArray(exceptionOptions.json?.data?.related_object_options), 'station/exceptions/options related_object_options invalid payload');

    const exceptionDetail = await jsonRequest('/api/v1/station/exceptions/EXP-0408-001', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(exceptionDetail.ok, 'station/exceptions/:exceptionId failed');
    assert(exceptionDetail.json?.data?.exception_id === 'EXP-0408-001', 'station/exceptions/:exceptionId detail mismatch');

    const updateException = await jsonRequest('/api/v1/station/exceptions/EXP-0408-001', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        exception_type: 'PiecesMismatch',
        severity: 'P2',
        owner_role: 'check_worker',
        owner_team_id: 'TEAM-CK-01',
        related_object_type: 'AWB',
        related_object_id: 'AWB-436-10354363',
        exception_status: 'In Progress',
        blocker_flag: true,
        root_cause: 'integration root cause',
        action_taken: 'integration action taken'
      })
    });
    assert(updateException.ok, 'station/exceptions/:exceptionId patch failed');
    assert(updateException.json?.data?.exception_status === 'In Progress', 'station/exceptions/:exceptionId patch status mismatch');

    const archiveException = await jsonRequest('/api/v1/station/exceptions/EXP-0408-001', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(archiveException.ok, 'station/exceptions/:exceptionId delete failed');
    assert(archiveException.json?.data?.archived === true, 'station/exceptions/:exceptionId delete did not archive');

    const restoreException = await jsonRequest('/api/v1/station/exceptions/EXP-0408-001', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        archived: false,
        exception_status: 'In Progress'
      })
    });
    assert(restoreException.ok, 'station/exceptions/:exceptionId restore failed');
    assert(restoreException.json?.data?.archived === false, 'station/exceptions/:exceptionId restore did not clear archive');

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
    assert(!outboundLoaded.ok, 'loaded should be blocked while outbound exception remains open');
    assert(
      outboundLoaded.status === 409 && outboundLoaded.json?.error?.code === 'OUTBOUND_BLOCKING_EXCEPTION_OPEN',
      'loaded precondition failure was not returned as OUTBOUND_BLOCKING_EXCEPTION_OPEN'
    );

    const outboundWaybillBlockedDetail = await jsonRequest('/api/v1/station/outbound/waybills/AWB-436-10357583', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundWaybillBlockedDetail.ok, 'station/outbound/waybills/:awbId not readable while blocked');
    assert(
      outboundWaybillBlockedDetail.json?.data?.recovery_summary?.gate_status === 'blocked',
      'outbound waybill recovery summary did not reflect blocked state'
    );

    const resolveOutboundException = await jsonRequest('/api/v1/station/exceptions/EXP-0409-301/resolve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration outbound resolve', resolution: 'integration outbound resolve' })
    });
    assert(resolveOutboundException.ok, 'station/exceptions/:exceptionId/resolve failed for outbound blocker');

    const outboundLoadedAfterResolve = await jsonRequest('/api/v1/station/outbound/flights/FLIGHT-SE913-2026-04-09-MME/loaded', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stationToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: 'integration loaded after resolve' })
    });
    assert(outboundLoadedAfterResolve.ok, 'station/outbound/flights/:flightId/loaded failed after resolving outbound blocker');

    const outboundWaybillReadyDetail = await jsonRequest('/api/v1/station/outbound/waybills/AWB-436-10357583', {
      headers: { Authorization: `Bearer ${stationToken}` }
    });
    assert(outboundWaybillReadyDetail.ok, 'station/outbound/waybills/:awbId not readable after resolve');
    assert(
      ['ready', 'completed'].includes(outboundWaybillReadyDetail.json?.data?.recovery_summary?.gate_status),
      'outbound waybill recovery summary did not clear after resolve'
    );

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
    console.log(
      `- platform stations options/list/create/update/archive/restore: ${stationOptions.status}/${platformStations.status}/${createStation.status}/${updateStation.status}/${archiveStation.status}/${restoreStation.status}`
    );
    console.log(
      `- platform teams options/list/create/update/archive/restore: ${teamOptions.status}/${platformTeams.status}/${createTeam.status}/${updateTeam.status}/${archiveTeam.status}/${restoreTeam.status}`
    );
    console.log(
      `- station flights options/inbound-create/list/create/update/archive/restore/detail: ${inboundFlightOptions.status}/${inboundFlightCreateOptions.status}/${inboundFlightsPage.status}/${createInboundFlight.status}/${updateInboundFlight.status}/${archiveInboundFlight.status}/${restoreInboundFlight.status}/${inboundFlightDetail.status}`
    );
    console.log(
      `- station outbound flight options/list/create/update/archive/restore/detail: ${outboundFlightOptions.status}/${outboundFlightsPage.status}/${createOutboundFlight.status}/${updateOutboundFlight.status}/${archiveOutboundFlight.status}/${restoreOutboundFlight.status}/${createdOutboundFlightDetail.status}`
    );
    console.log(`- station/documents count: ${documents.json.items.length}`);
    console.log(`- station/shipments count: ${shipments.json.items.length}`);
    console.log(
      `- inbound/outbound waybill list/options/update/archive/restore: ${inboundWaybills.status}/${outboundWaybills.status}/${inboundWaybillOptions.status}/${outboundWaybillOptions.status}/${updateInboundWaybill.status}/${archiveInboundWaybill.status}/${restoreInboundWaybill.status}/${updateOutboundWaybill.status}/${archiveOutboundWaybill.status}/${restoreOutboundWaybill.status}`
    );
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
