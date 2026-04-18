import { once } from 'node:events';
import { spawn } from 'node:child_process';

const ROOT_DIR = process.cwd();
const WITH_FRONTEND_SMOKE = process.argv.includes('--with-frontend-smoke');
const ENV_ARG_INDEX = process.argv.indexOf('--env');
const TARGET_ENV = ENV_ARG_INDEX >= 0 ? process.argv[ENV_ARG_INDEX + 1] : 'local';
const REMOTE_MODE = TARGET_ENV !== 'local';
const DB_NAME = REMOTE_MODE ? `sinoport-api-${TARGET_ENV}` : 'sinoport-api-local';
const WRANGLER_ARGS = REMOTE_MODE
  ? ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--config', 'apps/api-worker/wrangler.jsonc', '--env', TARGET_ENV]
  : ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--config', 'apps/api-worker/wrangler.jsonc'];

function getSmokeTargets() {
  if (!REMOTE_MODE) return null;

  if (TARGET_ENV === 'production') {
    return {
      apiUrl: 'https://api.sinoport.co',
      agentUrl: 'https://agent.sinoport.co',
      webUrl: 'https://admin.sinoport.co'
    };
  }

  return {
    apiUrl: 'https://staging-api.sinoport.co',
    agentUrl: 'https://staging-agent.sinoport.co',
    webUrl: 'https://staging-admin.sinoport.co'
  };
}

function logStep(message) {
  process.stdout.write(`\n[acceptance-demo] ${message}\n`);
}

async function runCommand(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...extraEnv
    }
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(text);
  });

  const [code] = await once(child, 'exit');
  if (code !== 0) {
    throw new Error(output || `${command} ${args.join(' ')} failed`);
  }

  return output;
}

async function runSql(command) {
  return runCommand('npx', [...WRANGLER_ARGS, '--command', command]);
}

async function curateAcceptanceData() {
  const sql = [
    "DELETE FROM audit_events WHERE station_id LIKE 'Z%';",
    "DELETE FROM stations WHERE station_id LIKE 'Z%';",
    "UPDATE stations SET station_name = 'Maastricht Gateway Hub', region = 'Western Europe', control_level = 'strong_control', phase = 'active', airport_code = 'MST', icao_code = 'EHBK', service_scope = 'Inbound handling, breakdown, document release, tailhaul dispatch', owner_name = 'EU Hub Control', updated_at = CURRENT_TIMESTAMP WHERE station_id = 'MME';",
    "UPDATE stations SET station_name = 'Urumqi Origin Control Station', region = 'Western China', control_level = 'strong_control', phase = 'active', airport_code = 'URC', icao_code = 'ZWWW', service_scope = 'Export intake, FFM/UWS, linehaul release', owner_name = 'China Origin Control', updated_at = CURRENT_TIMESTAMP WHERE station_id = 'URC';",
    "UPDATE stations SET station_name = 'Maastricht Distribution Station', region = 'Western Europe', control_level = 'collaborative_control', phase = 'active', airport_code = 'MST', service_scope = 'Inbound distribution, transfer planning, POD handoff', owner_name = 'EU Distribution Control', updated_at = CURRENT_TIMESTAMP WHERE station_id = 'MST';",
    "UPDATE stations SET station_name = 'Rzeszow Entry Station', region = 'Eastern Europe', control_level = 'collaborative_control', phase = 'onboarding', airport_code = 'RZE', icao_code = 'EPRZ', service_scope = 'Entry handling, exception recovery, east-Europe relay', owner_name = 'Expansion Control', updated_at = CURRENT_TIMESTAMP WHERE station_id = 'RZE';",
    "UPDATE stations SET station_name = 'Central Asia Coordination Station', region = 'Central Asia', control_level = 'collaborative_control', phase = 'active', airport_code = 'KGF', service_scope = 'Coordination, truck relay, runtime feedback', owner_name = 'Regional Partner Desk', updated_at = CURRENT_TIMESTAMP WHERE station_id = 'KGF';",
    "UPDATE stations SET station_name = 'Central Asia Transfer Station', region = 'Central Asia', control_level = 'collaborative_control', phase = 'active', airport_code = 'NVI', service_scope = 'ETA linkage, arrival prep, transfer planning', owner_name = 'Regional Partner Desk', updated_at = CURRENT_TIMESTAMP WHERE station_id = 'NVI';",
    "UPDATE stations SET station_name = 'Bournemouth Interface Station', region = 'United Kingdom', control_level = 'interface_visible', phase = 'active', airport_code = 'BOH', service_scope = 'Manifest exchange, visibility only', owner_name = 'UK Partner Ops', updated_at = CURRENT_TIMESTAMP WHERE station_id = 'BoH';",
    "UPDATE teams SET team_name = 'MME Import Control Team', owner_name = 'MME Import Supervisor', shift_code = 'DAY', updated_at = CURRENT_TIMESTAMP WHERE team_id = 'TEAM-IN-01';",
    "UPDATE teams SET team_name = 'MME Check & Verify Desk', owner_name = 'MME QA Lead', shift_code = 'DAY', updated_at = CURRENT_TIMESTAMP WHERE team_id = 'TEAM-CK-01';",
    "UPDATE teams SET team_name = 'MME Document & Delivery Desk', owner_name = 'MME Document Supervisor', shift_code = 'DAY', updated_at = CURRENT_TIMESTAMP WHERE team_id = 'TEAM-DD-01';",
    "UPDATE workers SET worker_name = 'MME Station Supervisor', updated_at = CURRENT_TIMESTAMP WHERE worker_id = 'WORKER-SUP-001';",
    "UPDATE workers SET worker_name = 'MME Document Controller', updated_at = CURRENT_TIMESTAMP WHERE worker_id = 'WORKER-DOC-001';",
    "UPDATE workers SET worker_name = 'MME Check Operator', updated_at = CURRENT_TIMESTAMP WHERE worker_id = 'WORKER-CK-007';",
    "UPDATE workers SET worker_name = 'MME Ramp PDA Operator', updated_at = CURRENT_TIMESTAMP WHERE worker_id = 'WORKER-PDA-001';",
    "UPDATE flights SET aircraft_type = 'B767-300F', service_level = 'P1', notes = 'Toronto inbound eCommerce consol flight feeding Maastricht gateway hub.', updated_at = CURRENT_TIMESTAMP WHERE flight_id = 'FLIGHT-SE803-2026-04-08-MME';",
    "UPDATE flights SET aircraft_type = 'B737-800BCF', service_level = 'P2', notes = 'Secondary inbound flight used as healthy comparison baseline.', updated_at = CURRENT_TIMESTAMP WHERE flight_id = 'FLIGHT-SE681-2026-04-08-MME';",
    "UPDATE flights SET aircraft_type = 'A321P2F', service_level = 'P1', runtime_status = 'Pre-Departure', actual_takeoff_at = NULL, notes = 'MME outbound linehaul feeding MST and east-Europe relay lane.', updated_at = CURRENT_TIMESTAMP WHERE flight_id = 'FLIGHT-SE913-2026-04-09-MME';",
    "UPDATE shipments SET order_id = 'SO-IN-MME-20260408-001', promise_sla = '48h', service_level = 'P1', updated_at = CURRENT_TIMESTAMP WHERE shipment_id = 'SHIP-IN-436-10358585';",
    "UPDATE shipments SET order_id = 'SO-OUT-MME-20260409-001', current_node = 'Loaded Preparation', fulfillment_status = 'Main AWB Completed', promise_sla = '36h', service_level = 'P1', updated_at = CURRENT_TIMESTAMP WHERE shipment_id = 'SHIP-OUT-436-10357583';",
    "UPDATE awbs SET shipper_name = 'DONGGUAN PENGXUAN SUPPLY CHAIN', notify_name = 'SMDG LOGISTICS MAASTRICHT', goods_description = 'Telecom accessories and battery-free electronics', updated_at = CURRENT_TIMESTAMP WHERE awb_id = 'AWB-436-10358585';",
    "UPDATE awbs SET shipper_name = 'URC CONSOL DESK', notify_name = 'MST HUB OPERATIONS', goods_description = 'Cross-border eCommerce linehaul cargo', current_node = 'Loaded Preparation', manifest_status = 'Draft', updated_at = CURRENT_TIMESTAMP WHERE awb_id = 'AWB-436-10357583';",
    "UPDATE documents SET note = 'Inbound manifest released and linked to breakdown readiness gate.', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-MANIFEST-SE803';",
    "UPDATE documents SET document_status = 'Uploaded', note = 'Outbound manifest final version waiting final release decision.', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-MANIFEST-SE913';",
    "UPDATE documents SET note = 'Final CBA upload pending supervisor verification.', updated_at = CURRENT_TIMESTAMP WHERE document_id = 'DOC-CBA-SE803';",
    "UPDATE awbs SET pod_status = 'Pending', updated_at = CURRENT_TIMESTAMP WHERE awb_id = 'AWB-436-10358585';",
    "UPDATE tasks SET task_status = 'Completed', completed_at = '2026-04-08T19:05:00Z', verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-000';",
    "UPDATE tasks SET task_status = 'Rework', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-001';",
    "UPDATE tasks SET task_status = 'Escalated', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0408-002';",
    "UPDATE tasks SET task_status = 'Completed', completed_at = '2026-04-09T18:30:00Z', verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0409-301';",
    "UPDATE tasks SET task_status = 'Assigned', completed_at = NULL, verified_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = 'TASK-0409-302';",
    "UPDATE exceptions SET exception_status = 'Open', closed_at = NULL, root_cause = 'Pieces mismatch not verified at import recount checkpoint', action_taken = 'NOA release held until recount and supervisor verification finish', updated_at = CURRENT_TIMESTAMP WHERE exception_id = 'EXP-0408-001';",
    "UPDATE exceptions SET exception_status = 'Open', closed_at = NULL, root_cause = 'Final manifest freeze pending from document desk', action_taken = 'Upload final manifest and recheck ramp release gate before loaded confirmation', updated_at = CURRENT_TIMESTAMP WHERE exception_id = 'EXP-0409-301';",
    "UPDATE trucks SET driver_name = 'Jan Vermeer', driver_phone = '+31 6 1200 0018', updated_at = CURRENT_TIMESTAMP WHERE truck_id = 'TRK-0406-018';",
    "UPDATE trucks SET driver_name = 'Joris Bakker', driver_phone = '+31 6 2200 0101', updated_at = CURRENT_TIMESTAMP WHERE truck_id = 'TRIP-MME-HEAD-001';",
    "UPDATE trucks SET driver_name = 'Milan de Groot', driver_phone = '+31 6 2200 0205', updated_at = CURRENT_TIMESTAMP WHERE truck_id = 'TRIP-MME-TAIL-002';",
    "UPDATE trucks SET driver_name = 'Wang Lei', driver_phone = '+86 139 0000 0309', updated_at = CURRENT_TIMESTAMP WHERE truck_id = 'TRIP-URC-HEAD-001';",
    "INSERT OR REPLACE INTO audit_events (audit_id, request_id, actor_id, actor_role, client_source, action, object_type, object_id, station_id, summary, payload_json, created_at) VALUES ('AUD-ACPT-MME-001', 'acceptance-demo-local', 'demo-supervisor', 'platform_admin', 'customer-demo-prep', 'ACCEPTANCE_DEMO_BASELINE_REFRESHED', 'Station', 'MME', 'MME', 'MME acceptance baseline refreshed with inbound, outbound and PDA storyline.', '{\"mode\":\"customer_acceptance\",\"storyline\":\"SE803/SE913\"}', '2026-04-18T08:30:00Z');",
    "INSERT OR REPLACE INTO audit_events (audit_id, request_id, actor_id, actor_role, client_source, action, object_type, object_id, station_id, summary, payload_json, created_at) VALUES ('AUD-ACPT-URC-001', 'acceptance-demo-local', 'demo-supervisor', 'platform_admin', 'customer-demo-prep', 'ACCEPTANCE_DEMO_COMPARE_STATION', 'Station', 'URC', 'URC', 'URC prepared as healthy origin-control comparison station.', '{\"mode\":\"customer_acceptance\",\"posture\":\"healthy\"}', '2026-04-18T08:31:00Z');",
    "INSERT OR REPLACE INTO audit_events (audit_id, request_id, actor_id, actor_role, client_source, action, object_type, object_id, station_id, summary, payload_json, created_at) VALUES ('AUD-ACPT-RZE-001', 'acceptance-demo-local', 'demo-supervisor', 'platform_admin', 'customer-demo-prep', 'ACCEPTANCE_DEMO_COMPARE_STATION', 'Station', 'RZE', 'RZE', 'RZE prepared as onboarding/risk comparison station for platform visibility.', '{\"mode\":\"customer_acceptance\",\"posture\":\"risk\"}', '2026-04-18T08:32:00Z');"
  ].join(' ');

  await runSql(sql);
}

async function printSummary() {
  const summarySql = [
    "SELECT station_id, station_name, region, control_level, phase FROM stations WHERE station_id IN ('MME','URC','MST','RZE','KGF','NVI','BoH') ORDER BY CASE station_id WHEN 'MME' THEN 1 WHEN 'URC' THEN 2 WHEN 'MST' THEN 3 WHEN 'RZE' THEN 4 WHEN 'KGF' THEN 5 WHEN 'NVI' THEN 6 ELSE 7 END;",
    "SELECT flight_no, runtime_status, service_level, station_id FROM flights WHERE flight_id IN ('FLIGHT-SE803-2026-04-08-MME','FLIGHT-SE913-2026-04-09-MME') ORDER BY flight_no;",
    "SELECT awb_no, current_node, noa_status, pod_status, manifest_status FROM awbs WHERE awb_id IN ('AWB-436-10358585','AWB-436-10357583') ORDER BY awb_no;",
    "SELECT task_id, task_status, related_object_id FROM tasks WHERE task_id IN ('TASK-0408-000','TASK-0408-001','TASK-0408-002','TASK-0409-301','TASK-0409-302') ORDER BY task_id;",
    "SELECT exception_id, exception_status, blocker_flag FROM exceptions WHERE exception_id IN ('EXP-0408-001','EXP-0409-301') ORDER BY exception_id;",
    "SELECT COUNT(*) AS z_station_count FROM stations WHERE station_id LIKE 'Z%';"
  ].join(' ');

  logStep('summary');
  await runSql(summarySql);
}

async function main() {
  logStep(`apply ${TARGET_ENV} migrations`);
  if (REMOTE_MODE) {
    await runCommand('npx', ['wrangler', 'd1', 'migrations', 'apply', DB_NAME, '--remote', '--config', 'apps/api-worker/wrangler.jsonc', '--env', TARGET_ENV]);
  } else {
    await runCommand('npm', ['run', 'db:migrate:local', '--workspace', '@sinoport/api-worker']);
  }

  logStep(`curate ${TARGET_ENV} customer acceptance dataset`);
  await curateAcceptanceData();

  if (!REMOTE_MODE) {
    logStep('validate API baseline');
    await runCommand('npm', ['run', 'test:integration:api']);

    logStep('re-apply curated station and narrative metadata');
    await curateAcceptanceData();

    logStep('validate agent object context');
    await runCommand('npm', ['run', 'test:agent:smoke']);
  }

  if (WITH_FRONTEND_SMOKE) {
    logStep(`validate ${TARGET_ENV} frontend routes`);
    if (REMOTE_MODE) {
      const targets = getSmokeTargets();
      await runCommand('npm', ['run', 'test:frontend:smoke'], {
        SMOKE_API_URL: targets.apiUrl,
        SMOKE_AGENT_URL: targets.agentUrl,
        SMOKE_WEB_URL: targets.webUrl
      });
    } else {
      await runCommand('npm', ['run', 'test:frontend:smoke']);
    }
  }

  await printSummary();

  logStep(`done${WITH_FRONTEND_SMOKE ? ' (full validation)' : ''}`);
  process.stdout.write(`[acceptance-demo] ${REMOTE_MODE ? TARGET_ENV : 'local'} acceptance dataset is ready.\n`);
}

main().catch((error) => {
  process.stderr.write(`\n[acceptance-demo] failed: ${error.message}\n`);
  process.exitCode = 1;
});
