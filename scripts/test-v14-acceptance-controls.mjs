import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const baseUrl = process.env.SINOPORT_API_BASE_URL || 'http://127.0.0.1:8787';
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const skyledgerContainer = process.env.SKYLEDGER_API_CONTAINER || 'skyledger-localtest-api';

function dockerPython(module, args = []) {
  const output = execFileSync('docker', ['exec', skyledgerContainer, 'python', '-m', module, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']
  }).trim();
  return output ? JSON.parse(output.split('\n').at(-1)) : {};
}

const baseSkyFixture = dockerPython('scripts.seed_sinoport_smoke_truck', ['--run-id', `acceptance-base-${runId}`]);
dockerPython('scripts.sinoport_sync_worker', ['--once', '--limit', '200']);

const baseOutput = execFileSync(process.execPath, ['scripts/test-v14-e2e-smoke.mjs'], {
  cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, SINOPORT_API_BASE_URL: baseUrl, SKYLEDGER_FIXTURE_JSON: JSON.stringify(baseSkyFixture) }
}).trim();
const base = JSON.parse(baseOutput);
assert.equal(base.ok, true);

const tenantId = `sinoport-v14-smoke-${base.run_id}`;
const adminHeaders = {
  Authorization: 'Bearer demo-token',
  'Content-Type': 'application/json',
  'X-Debug-User-Id': 'acceptance-admin',
  'X-Debug-Roles': 'platform_admin,station_supervisor,OCC_DM,A1_CARGO_CONTROLLER,A2_DOMESTIC_TRUCK_CONTROLLER,A3_CROSS_BORDER_CONTROLLER,B1_TAS_STATION_CONTROLLER,B2_FLIGHT_MONITOR,OBI_OVERSEAS_INTERFACE,DQC_DATA_QUALITY_CONTROLLER,ALASHANKOU_AGENT,DOSTYK_AGENT,TRUCK_OPERATOR,TAS_OPERATOR,PREWH_OPERATOR',
  'X-Debug-Station-Scope': 'SZX,TAS',
  'X-Debug-Tenant-Id': tenantId
};
const supervisorHeaders = { ...adminHeaders, 'X-Debug-User-Id': 'acceptance-supervisor' };
const a3OnlyHeaders = { ...adminHeaders, 'X-Debug-User-Id': 'acceptance-a3-only', 'X-Debug-Roles': 'A3_CROSS_BORDER_CONTROLLER' };
const obiHeaders = { ...adminHeaders, 'X-Debug-User-Id': 'acceptance-obi', 'X-Debug-Roles': 'OBI_OVERSEAS_INTERFACE' };
const tasOperatorHeaders = {
  ...adminHeaders,
  'X-Debug-User-Id': 'acceptance-tas-operator',
  'X-Debug-Roles': 'TAS_OPERATOR',
  'X-Debug-Station-Scope': 'TAS'
};
const b1Headers = {
  ...adminHeaders,
  'X-Debug-User-Id': 'acceptance-b1-controller',
  'X-Debug-Roles': 'B1_TAS_STATION_CONTROLLER',
  'X-Debug-Station-Scope': 'TAS'
};

async function api(path, { method = 'GET', body, headers = adminHeaders, expected = [200, 201], idem } = {}) {
  const requestHeaders = { ...headers };
  if (idem) requestHeaders['Idempotency-Key'] = `${runId}-${idem}`;
  const result = await fetch(`${baseUrl}${path}`, {
    method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  });
  const text = await result.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!expected.includes(result.status)) throw new Error(`${method} ${path} returned ${result.status}: ${JSON.stringify(json)}`);
  return { status: result.status, json };
}

const otherSkyFixture = dockerPython('scripts.seed_sinoport_smoke_truck', ['--run-id', `acceptance-other-${runId}`, '--awb-offset', '1']);
dockerPython('scripts.sinoport_sync_worker', ['--once', '--limit', '200']);

const otherReceipt = await api('/api/v1/prewarehouse/receipts', { method: 'POST', idem: 'other-receipt', body: {
  shipment_id: `SHP-SKY-awb:${otherSkyFixture.awb_id}`, warehouse_station_id: 'SZX', expected_pieces: 1, expected_weight_kg: 10,
  cargo_units: [{ barcode: `ACC-${runId}`, quantity: 1, expected_weight_kg: 10 }]
} });
const otherReceiptId = otherReceipt.json.receipt_session_id;
const wrongPre = await api(`/api/v1/prewarehouse/receipts/${otherReceiptId}/scans`, { method: 'POST', idem: 'pre-wrong-shipment', expected: [409], body: {
  barcode: `PKG-${base.run_id}-1`, occurred_at: new Date().toISOString()
} });
assert.equal(wrongPre.json.error.code, 'BARCODE_WRONG_SHIPMENT');
assert.ok(wrongPre.json.error.details.exception_id);
const weightVariance = await api(`/api/v1/prewarehouse/receipts/${otherReceiptId}/scans`, { method: 'POST', idem: 'pre-weight-variance', body: {
  barcode: `ACC-${runId}`, occurred_at: new Date().toISOString(), condition_status: 'NORMAL', weight_kg: 20, weight_tolerance_kg: 1
} });
assert.equal(weightVariance.json.condition_status, 'OTHER');
assert.equal(weightVariance.json.weight_variance, true);
assert.ok(weightVariance.json.exception_id);
const duplicatePre = await api(`/api/v1/prewarehouse/receipts/${otherReceiptId}/scans`, { method: 'POST', idem: 'pre-duplicate', expected: [409], body: {
  barcode: `ACC-${runId}`, occurred_at: new Date().toISOString()
} });
assert.equal(duplicatePre.json.error.code, 'BARCODE_ALREADY_COUNTED');
assert.ok(duplicatePre.json.error.details.first_count.occurred_at);

const skyFixture = dockerPython('scripts.seed_sinoport_smoke_truck', ['--run-id', `acceptance-${runId}`, '--awb-offset', '2']);
dockerPython('scripts.sinoport_sync_worker', ['--once', '--limit', '200']);
const jobId = `TRJ-SKY-${skyFixture.truck_id}`;
const jobShipmentId = `SHP-SKY-awb:${skyFixture.awb_id}`;
const jobReceipt = await api('/api/v1/prewarehouse/receipts', { method: 'POST', idem: 'job-receipt', body: {
  shipment_id: jobShipmentId, warehouse_station_id: 'SZX', expected_pieces: 2, expected_weight_kg: 20,
  cargo_units: [
    { barcode: `ACC-TRUCK-${runId}-1`, quantity: 1, expected_weight_kg: 10 },
    { barcode: `ACC-TRUCK-${runId}-2`, quantity: 1, expected_weight_kg: 10 }
  ]
} });
for (const index of [1, 2]) {
  await api(`/api/v1/prewarehouse/receipts/${jobReceipt.json.receipt_session_id}/scans`, { method: 'POST', idem: `job-receipt-scan-${index}`, body: {
    barcode: `ACC-TRUCK-${runId}-${index}`, condition_status: 'NORMAL', weight_kg: 10
  } });
}
await api(`/api/v1/prewarehouse/receipts/${jobReceipt.json.receipt_session_id}/submit`, { method: 'POST', idem: 'job-receipt-submit', body: {} });
await api(`/api/v1/prewarehouse/receipts/${jobReceipt.json.receipt_session_id}/approve`, { method: 'POST', idem: 'job-receipt-approve', headers: supervisorHeaders, body: { next_owner_accepted: true, evidence_ids: ['EV-JOB-RECEIPT'] } });
const geofenceLocation = await api(`/api/v1/transport-jobs/${jobId}/locations`, { method: 'POST', idem: 'geofence-location', body: {
  occurred_at: new Date().toISOString(), latitude: 22.5431, longitude: 114.0579,
  place_name: 'SZX pre-warehouse', geofence_match: true,
  geofence_checkpoint_code: 'PREWH_ARRIVED_FOR_LOADING', geofence_distance_m: 8
} });
assert.equal(geofenceLocation.json.geofence_requires_manual_confirmation, true);
const trackPending = await api(`/api/v1/transport-jobs/${jobId}/track`);
assert.equal(trackPending.json.pending_geofence_confirmation_count, 1);
assert.equal(trackPending.json.next_checkpoint.status, 'ARRIVED_CANDIDATE');
await api(`/api/v1/transport-jobs/${jobId}/checkpoint-events`, { method: 'POST', idem: 'geofence-confirm', body: {
  checkpoint_code: 'PREWH_ARRIVED_FOR_LOADING', event_type: 'ARRIVED', occurred_at: new Date().toISOString(), evidence_ids: ['EV-GEOFENCE-CONFIRM']
} });
const trackConfirmed = await api(`/api/v1/transport-jobs/${jobId}/track`);
assert.equal(trackConfirmed.json.pending_geofence_confirmation_count, 0);
assert.equal(trackConfirmed.json.geofence_candidates[0].status, 'CONFIRMED');
assert.equal(trackConfirmed.json.job.location_freshness, 'FRESH');

const jobDetail = await api(`/api/v1/transport-jobs/${jobId}`);
for (const checkpoint of jobDetail.json.checkpoints.filter((item) => item.checkpoint_code !== 'PREWH_ARRIVED_FOR_LOADING')) {
  const body = { checkpoint_code: checkpoint.checkpoint_code, event_type: 'PASSED', occurred_at: new Date().toISOString(), evidence_ids: ['EV-ACC-CHECKPOINT'] };
  if (checkpoint.checkpoint_code === 'SZX_TRUCK_DEPARTED') {
    body.departure_receipt_ref = 'WH-ACC-RELEASE';
    body.first_valid_gps_event_id = geofenceLocation.json.location_event_id;
  }
  await api(`/api/v1/transport-jobs/${jobId}/checkpoint-events`, { method: 'POST', idem: `cp-${checkpoint.sequence}`, body });
}

const tas = await api('/api/v1/airports/TAS/receipts', { method: 'POST', idem: 'tas-create', body: { transport_job_id: jobId } });
const tasId = tas.json.airport_receipt_session_id;
await api(`/api/v1/airport-receipts/${tasId}/arrival`, { method: 'POST', idem: 'tas-arrival', body: { evidence_ids: ['EV-TAS-ARRIVAL'] } });
const sealMismatch = await api(`/api/v1/airport-receipts/${tasId}/seal-check`, { method: 'POST', idem: 'tas-seal-mismatch', body: { seal_actual: 'WRONG-SEAL', evidence_ids: ['EV-SEAL-MISMATCH'] } });
assert.equal(sealMismatch.json.result, 'MISMATCH');
assert.ok(sealMismatch.json.exception_id);
const operatorApprovalDenied = await api(`/api/v1/airport-receipts/${tasId}/seal-mismatch/approve`, {
  method: 'POST', headers: tasOperatorHeaders, idem: 'tas-operator-approval-denied', expected: [403],
  body: { reason: 'Operator cannot approve own exception', evidence_ids: ['EV-DENIED'] }
});
assert.equal(operatorApprovalDenied.json.error.code, 'FORBIDDEN');
const makerCheckerConflict = await api(`/api/v1/airport-receipts/${tasId}/seal-mismatch/approve`, {
  method: 'POST', headers: adminHeaders, idem: 'tas-maker-checker-conflict', expected: [409],
  body: { reason: 'Same checker must not approve', evidence_ids: ['EV-CONFLICT'] }
});
assert.equal(makerCheckerConflict.json.error.code, 'MAKER_CHECKER_ROLE_CONFLICT');
const selfReportedApprovalDenied = await api(`/api/v1/airport-receipts/${tasId}/unloading/start`, {
  method: 'POST', headers: tasOperatorHeaders, idem: 'tas-unload-self-approved-denied', expected: [409],
  body: { seal_mismatch_approved: true }
});
assert.equal(selfReportedApprovalDenied.json.error.code, 'SEAL_MISMATCH_APPROVAL_REQUIRED');
const sealApproval = await api(`/api/v1/airport-receipts/${tasId}/seal-mismatch/approve`, {
  method: 'POST', headers: b1Headers, idem: 'tas-seal-mismatch-approval',
  body: { reason: 'Seal evidence reviewed and controlled unloading authorized', evidence_ids: ['EV-SEAL-APPROVAL'] }
});
assert.equal(sealApproval.json.result, 'APPROVED');
assert.equal(sealApproval.json.requested_by, 'acceptance-admin');
assert.equal(sealApproval.json.approved_by, 'acceptance-b1-controller');
const tasAfterApproval = await api(`/api/v1/airport-receipts/${tasId}`);
const approvalAudit = tasAfterApproval.json.audit_events.find((event) => event.event_type === 'TAS_SEAL_MISMATCH_APPROVED');
assert.ok(approvalAudit);
assert.equal(approvalAudit.actor_id, 'acceptance-b1-controller');
assert.equal(JSON.parse(approvalAudit.payload_json).requested_by, 'acceptance-admin');
await api(`/api/v1/airport-receipts/${tasId}/unloading/start`, { method: 'POST', headers: tasOperatorHeaders, idem: 'tas-unload-approved', body: {} });
const wrongTas = await api(`/api/v1/airport-receipts/${tasId}/scans`, { method: 'POST', idem: 'tas-wrong-shipment', expected: [409], body: { barcode: `ACC-${runId}` } });
assert.equal(wrongTas.json.error.code, 'BARCODE_WRONG_SHIPMENT');
assert.ok(wrongTas.json.error.details.exception_id);
await api(`/api/v1/airport-receipts/${tasId}/scans`, { method: 'POST', idem: 'tas-count-one', body: { barcode: `ACC-TRUCK-${runId}-1`, condition_status: 'NORMAL' } });
const tasMismatch = await api(`/api/v1/airport-receipts/${tasId}/reconcile`, { method: 'POST', idem: 'tas-reconcile-mismatch', body: {} });
assert.equal(tasMismatch.json.result, 'MISMATCH');
assert.ok(tasMismatch.json.missing_pieces > 0);
assert.ok(tasMismatch.json.exception_ids.length > 0);

const border = await api('/api/v1/border-operations', { method: 'POST', idem: 'border-create', body: { transport_job_id: jobId } });
const borderId = border.json.border_operation_id;
const sideRoleDenied = await api(`/api/v1/border-operations/${borderId}/cn-queue`, { method: 'POST', idem: 'cn-side-denied', headers: a3OnlyHeaders, expected: [403], body: {
  cn_queue_no: 'Q-DENIED', cn_queue_ahead_count: 2, cn_open_window_count: 1, cn_next_update_at: new Date(Date.now() + 3600_000).toISOString()
} });
assert.equal(sideRoleDenied.json.error.code, 'BORDER_SIDE_ROLE_REQUIRED');
const borderMismatch = await api(`/api/v1/border-operations/${borderId}/transload-events`, { method: 'POST', idem: 'border-mismatch', body: {
  pieces_before: 2, pieces_after: 1, weight_before_kg: 20, weight_after_kg: 10,
  seal_before: 'SEAL-A', seal_after: 'SEAL-B', weight_tolerance_kg: 1
} });
assert.equal(borderMismatch.json.result, 'MISMATCH');
assert.ok(borderMismatch.json.exception_id);
const borderDetail = await api(`/api/v1/border-operations/${borderId}`);
assert.equal(borderDetail.json.border_operation.health_color, 'RED');
assert.equal(borderDetail.json.entry_gate.status, 'BLOCKED');
assert.equal(borderDetail.json.entry_gate.owner_role, 'A3_CROSS_BORDER_CONTROLLER');

const planId = base.operation_control_plan_id;
const flightId = base.flight_id;
const gates = [
  ['GATE_A', { planned_pieces: 2, scanned_pieces: 2, manual_pieces: 2 }],
  ['GATE_B', { entered_pieces: 2, passed_pieces: 1, held_pieces: 0, returned_pieces: 0 }],
  ['GATE_C', { layer_totals: [1, 1], uld_total_pieces: 2 }],
  ['GATE_D', { expected_board_id: 'BOARD-1', actual_board_id: 'BOARD-1', expected_pieces: 2, actual_pieces: 2, actual_weight_kg: 20, minimum_weight_kg: 19, maximum_weight_kg: 21 }],
  ['GATE_E', { manifest_uld_ids: ['ULD-1', 'ULD-2'], actual_loaded_uld_ids: ['ULD-2', 'ULD-1'] }]
];
const gateResults = [];
for (const [gateCode, input] of gates) {
  const result = await api(`/api/v1/operation-control-plans/${planId}/gate-reconciliations`, { method: 'POST', idem: `gate-${gateCode}`, body: { gate_code: gateCode, ...input } });
  gateResults.push([gateCode, result.json.result]);
}
assert.deepEqual(gateResults, [['GATE_A', 'PASS'], ['GATE_B', 'BLOCKED'], ['GATE_C', 'PASS'], ['GATE_D', 'PASS'], ['GATE_E', 'PASS']]);

const label = await api(`/api/v1/flights/${flightId}/label-ledgers`, { method: 'POST', idem: 'label-accounting', body: {
  printed_count: 10, used_count: 7, void_count: 1, remaining_count: 2,
  maintained_by: 'label-maker', approved_by: 'label-checker', evidence_ids: ['EV-LABEL-LEDGER']
} });
assert.equal(label.json.result, 'PASS');

await api(`/api/v1/operation-control-plans/${planId}/resource-capacity-plans`, { method: 'POST', idem: 'capacity-risk', body: {
  hourly_plan: { hour: 'H-8' }, resources: { docks: 2 }, capacity_per_hour: 100,
  forecast_workload_per_hour: 95, shortage_resource_type: 'DOCK', backup_plan_ref: 'BACKUP-DOCK-1'
} });
const signalOccurredAt = new Date(Date.now() - 40 * 60_000).toISOString();
const signal = await api(`/api/v1/operation-control-plans/${planId}/control-inputs`, { method: 'POST', idem: 'control-input', body: {
  signal_type: 'PHONE_DECISION', source_channel: 'PHONE', occurred_at: signalOccurredAt, payload: { decision: 'hold' }
} });
const automationAsOf = new Date(Date.now() + 61 * 60_000).toISOString();
const recoveryAnchor = new Date().toISOString();
const automation = await api(`/api/v1/operation-control-plans/${planId}/automation/evaluate`, { method: 'POST', idem: 'automation', body: {
  as_of: automationAsOf, recovered_at: recoveryAnchor, flight_completed_at: recoveryAnchor
} });
assert.equal(automation.json.overall_health_color, 'RED');
const controlTasks = await api(`/api/v1/control-tasks?operation_control_plan_id=${encodeURIComponent(planId)}`);
const taskTypes = new Set(controlTasks.json.items.map((item) => item.task_type));
for (const required of ['DECISION_BACKFILL', 'STATUS_UPDATE', 'INCIDENT_ACK', 'INCIDENT_FIRST_REPORT', 'PROFESSIONAL_SUPPORT_ACTIVATION', 'CAPACITY_AUGMENT', 'INCIDENT_CLOSE', 'CAPA']) {
  assert.ok(taskTypes.has(required), `missing automated control task ${required}`);
}
const decision = await api(`/api/v1/operation-control-plans/${planId}/decisions`, { method: 'POST', idem: 'decision-backfill', body: {
  source_channel: 'PHONE', occurred_at: signalOccurredAt, late_record_reason: 'Acceptance test backfill',
  decision_type: 'OTHER', decision_text: 'Hold until evidence is verified', requested_by: 'decision-maker',
  evidence_ids: ['EV-DECISION'], control_input_signal_id: signal.json.control_input_signal_id
} });
assert.equal(decision.json.control_input_signal_id, signal.json.control_input_signal_id);

const milestones = await api(`/api/v1/operation-control-plans/${planId}/milestones`);
const incompleteClose = await api(`/api/v1/milestone-instances/${milestones.json.items[0].milestone_instance_id}/close`, { method: 'POST', idem: 'incomplete-close', expected: [409], body: {
  evidence_ids: ['EV-CLOSE'], action_complete: false, data_consistent: true, next_owner_accepted: true
} });
assert.equal(incompleteClose.json.error.code, 'GATE_CLOSURE_INCOMPLETE');

const deterministicAsOf = new Date(Date.now() + 60_000).toISOString();
const replayOne = await api(`/api/v1/operation-control-plans/${planId}/recalculate`, { method: 'POST', idem: 'replay-one', body: { as_of: deterministicAsOf } });
const replayTwo = await api(`/api/v1/operation-control-plans/${planId}/recalculate`, { method: 'POST', idem: 'replay-two', body: { as_of: deterministicAsOf } });
assert.equal(replayOne.json.deterministic_hash, replayTwo.json.deterministic_hash);

const frozen = await api(`/api/v1/flights/${flightId}/cargo-master-record/freeze`, { method: 'POST', idem: 'cargo-freeze', body: {
  maintained_by: 'cargo-master-maker', record_status: 'INITIAL_FROZEN', planned_pieces: 2,
  planned_weight_kg: 20, tas_received_pieces: 2, tas_received_weight_kg: 20,
  security_entered_pieces: 2, security_passed_pieces: 2, buildup_pieces: 2,
  handed_to_airline_pieces: 0, loaded_pieces: 0, uld_ids: ['ULD-1']
} });
const change = await api('/api/v1/change-requests', { method: 'POST', idem: 'cargo-change', body: {
  operation_control_plan_id: planId, related_object_type: 'FlightCargoMasterRecord',
  related_object_id: frozen.json.flight_cargo_master_record_id, change_type: 'CORRECTION',
  before: { planned_pieces: 2 }, after: { planned_pieces: 3 }, reason: 'Acceptance correction'
} });
const unapprovedChange = await api(`/api/v1/flights/${flightId}/cargo-master-record/changes`, { method: 'POST', idem: 'cargo-change-before-approval', expected: [409], body: {
  change_request_id: change.json.change_request_id, planned_pieces: 3
} });
assert.equal(unapprovedChange.json.error.code, 'FROZEN_RECORD_CHANGE_REQUEST_REQUIRED');
await api(`/api/v1/change-requests/${change.json.change_request_id}/approve`, { method: 'POST', idem: 'approve-cargo-change', headers: supervisorHeaders, body: {} });
const appliedChange = await api(`/api/v1/flights/${flightId}/cargo-master-record/changes`, { method: 'POST', idem: 'cargo-change-after-approval', body: {
  change_request_id: change.json.change_request_id, planned_pieces: 3, reviewed_by: 'cargo-reviewer'
} });
assert.equal(appliedChange.json.change_request_status, 'APPLIED');
assert.equal(appliedChange.json.record_version, 2);

const obiDenied = await api(`/api/v1/operation-control-plans/${planId}/external-execution-statuses`, { method: 'POST', idem: 'obi-claim-execution', headers: obiHeaders, expected: [403], body: {
  acting_as_execution_party: true, stage_code: 'OVERSEAS', status: 'DONE'
} });
assert.equal(obiDenied.json.error.code, 'OBI_EXECUTION_PERMISSION_DENIED');

console.log(JSON.stringify({
  ok: true, run_id: runId, base_run_id: base.run_id,
  skyledger_fixture: skyFixture,
  coverage: {
    prewarehouse_exceptions: true, geofence_manual_confirmation: true,
    tas_discrepancy_exceptions: true, border_side_roles_and_blocking: true,
    gates_a_to_e: Object.fromEntries(gateResults), label_accounting: label.json.result,
    automated_task_types: [...taskTypes].sort(), deterministic_replay: true,
    frozen_record_change_control: true, obi_execution_denied: true
  }
}, null, 2));
