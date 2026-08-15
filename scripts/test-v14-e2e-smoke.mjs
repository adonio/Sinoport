import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const baseUrl = process.env.SINOPORT_API_BASE_URL || 'http://127.0.0.1:8787';
const secret = process.env.SINO_SKY_INTEGRATION_SECRET || 'sinoport-skyledger-local-integration-secret';
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const skyledgerFixture = process.env.SKYLEDGER_FIXTURE_JSON ? JSON.parse(process.env.SKYLEDGER_FIXTURE_JSON) : null;
const manualStop = process.env.TAS_MANUAL_STOP || '';
const tenantId = ['upstream', 'planning'].includes(manualStop) ? 'sinoport-demo' : `sinoport-v14-smoke-${runId}`;
const adminHeaders = {
  Authorization: 'Bearer demo-token',
  'Content-Type': 'application/json',
  'X-Debug-User-Id': 'smoke-admin',
  'X-Debug-Roles': 'platform_admin,station_supervisor,OCC_DM,A1_CARGO_CONTROLLER,A2_DOMESTIC_TRUCK_CONTROLLER,A3_CROSS_BORDER_CONTROLLER,B1_TAS_STATION_CONTROLLER,DQC_DATA_QUALITY_CONTROLLER',
  'X-Debug-Station-Scope': 'SZX,TAS',
  'X-Debug-Tenant-Id': tenantId
};
const supervisorHeaders = {
  ...adminHeaders,
  'X-Debug-User-Id': 'smoke-supervisor'
};
const tasMobileHeaders = {
  ...adminHeaders,
  'X-Debug-User-Id': 'smoke-tas-mobile',
  'X-Debug-Roles': 'mobile_operator',
  'X-Debug-Station-Scope': 'TAS',
  'X-Client-Source': 'mobile-pda'
};
const outOfScopeMobileHeaders = {
  ...tasMobileHeaders,
  'X-Debug-User-Id': 'smoke-out-of-scope-mobile',
  'X-Debug-Station-Scope': 'MME'
};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

async function api(path, { method = 'GET', body, headers = adminHeaders, expected = [200, 201], idem } = {}) {
  const requestHeaders = { ...headers };
  if (idem) requestHeaders['Idempotency-Key'] = `${runId}-${idem}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(json)}`);
  }
  return { status: response.status, json };
}

async function signedSkyledgerEvent(eventType, aggregateType, aggregateId, sequence, payload, eventId = `EVT-SKY-${crypto.randomUUID()}`, expected = [200, 201]) {
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
  const event = {
    event_id: eventId,
    event_type: eventType,
    schema_version: 1,
    source_system: 'SKYLEDGER',
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    aggregate_sequence: sequence,
    occurred_at: new Date().toISOString(),
    payload,
    payload_hash: payloadHash
  };
  const rawBody = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return api('/api/v1/integrations/skyledger/events', {
    method: 'POST',
    body: event,
    expected,
    headers: {
      'Content-Type': 'application/json',
      'X-Integration-Timestamp': timestamp,
      'X-Integration-Signature': signature,
      'Idempotency-Key': eventId
    }
  });
}

const externalFlightId = skyledgerFixture?.flight_id || `flight-${runId}`;
const externalAwbId = skyledgerFixture?.awb_id || `awb-${runId}`;
const externalShipmentId = skyledgerFixture ? `awb:${externalAwbId}` : `shipment-${runId}`;
const externalJobId = skyledgerFixture?.truck_id || `job-${runId}`;
const flightId = `FLT-SKY-${externalFlightId}`;
const transportFlightId = process.env.TAS_TARGET_FLIGHT_ID || flightId;
const shipmentId = `SHP-SKY-${externalShipmentId}`;

const flightPayload = {
  skyledger_flight_id: externalFlightId,
  station_id: 'TAS',
  flight_no: `SP${String(Date.now()).slice(-4)}`,
  flight_date: '2026-08-13',
  origin_code: 'TAS',
  destination_code: 'LGG',
  etd_at: '2026-08-13T03:00:00+05:00',
  runtime_status: 'Scheduled',
  aircraft_type: 'B744F'
};
if (!skyledgerFixture) {
  const flightEventId = `EVT-SKY-FLT-${runId}`;
  const flightResult = await signedSkyledgerEvent('flight.baseline_published.v1', 'Flight', externalFlightId, 1, flightPayload, flightEventId);
  assert.equal(flightResult.json.data.status, 'APPLIED');
  const duplicateFlight = await signedSkyledgerEvent('flight.baseline_published.v1', 'Flight', externalFlightId, 1, flightPayload, flightEventId);
  assert.equal(duplicateFlight.json.data.duplicate, true);
  const outOfOrder = await signedSkyledgerEvent('flight.schedule_changed.v1', 'Flight', externalFlightId, 3, {
    skyledger_flight_id: externalFlightId,
    etd_at: '2026-08-13T04:00:00+05:00'
  }, undefined, [409]);
  assert.equal(outOfOrder.status, 409);

  await signedSkyledgerEvent('flight.schedule_changed.v1', 'Flight', externalFlightId, 2, {
    skyledger_flight_id: externalFlightId,
    etd_at: '2026-08-13T03:30:00+05:00',
    runtime_status: 'Pre-Departure'
  });

  await signedSkyledgerEvent('awb.baseline_upserted.v1', 'Awb', externalAwbId, 1, {
    skyledger_awb_id: externalAwbId,
    skyledger_shipment_id: externalShipmentId,
    skyledger_flight_id: externalFlightId,
    station_id: 'TAS',
    awb_no: `999-${String(Date.now()).slice(-8)}`,
    pieces: 2,
    gross_weight: 20,
    goods_description: 'V1.4 smoke cargo'
  });
}

const receiptCreate = await api('/api/v1/prewarehouse/receipts', {
  method: 'POST', idem: 'receipt-create', body: {
    shipment_id: shipmentId,
    warehouse_station_id: 'SZX',
    expected_pieces: 2,
    expected_weight_kg: 20,
    cargo_units: [
      { barcode: `PKG-${runId}-1`, quantity: 1, expected_weight_kg: 10 },
      { barcode: `PKG-${runId}-2`, quantity: 1, expected_weight_kg: 10 }
    ]
  }
});
const receiptId = receiptCreate.json.receipt_session_id;
assert.ok(receiptId);
for (const index of [1, 2]) {
  const scan = await api(`/api/v1/prewarehouse/receipts/${receiptId}/scans`, {
    method: 'POST', idem: `pre-scan-${index}`, body: {
      client_event_id: `${runId}-pre-scan-${index}`,
      barcode: `PKG-${runId}-${index}`,
      occurred_at: new Date().toISOString(),
      condition_status: 'NORMAL',
      weight_kg: 10,
      device_id: 'PDA-SZX-SMOKE'
    }
  });
  assert.equal(scan.json.result, 'COUNTED');
}
const duplicateBarcode = await api(`/api/v1/prewarehouse/receipts/${receiptId}/scans`, {
  method: 'POST', idem: 'pre-scan-duplicate-barcode', expected: [409], body: {
    client_event_id: `${runId}-pre-scan-duplicate-barcode`,
    barcode: `PKG-${runId}-1`,
    occurred_at: new Date().toISOString()
  }
});
assert.equal(duplicateBarcode.json.error.code, 'BARCODE_ALREADY_COUNTED');
await api(`/api/v1/prewarehouse/receipts/${receiptId}/submit`, { method: 'POST', idem: 'receipt-submit', body: {} });
const receiptDecision = await api(`/api/v1/prewarehouse/receipts/${receiptId}/approve`, {
  method: 'POST', idem: 'receipt-approve', headers: supervisorHeaders,
  body: { next_owner_accepted: true, evidence_ids: ['EV-PRE-SMOKE'] }
});
assert.equal(receiptDecision.json.result, 'APPROVED');

let jobId;
if (skyledgerFixture) {
  jobId = `TRJ-SKY-${externalJobId}`;
  const importedJob = await api(`/api/v1/transport-jobs/${jobId}`);
  assert.equal(importedJob.json.checkpoints.length, 21);
} else {
  const jobCreate = await api('/api/v1/transport-jobs', {
    method: 'POST', idem: 'job-create', body: {
      shipment_id: shipmentId,
      station_id: 'SZX',
      flight_id: transportFlightId,
      route_template_code: 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2',
      origin_facility_id: 'SZX_PREWAREHOUSE',
      destination_facility_id: 'TAS_AIRPORT_STAGING',
      planned_departure_at: new Date().toISOString(),
      planned_arrival_at: new Date(Date.now() + 9 * 24 * 3600_000).toISOString()
    }
  });
  jobId = jobCreate.json.transport_job_id;
  assert.equal(jobCreate.json.checkpoint_count, 21);
}

const primarySnapshot = await api(`/api/v1/transport-jobs/${jobId}/vehicle-driver-snapshots`, {
  method: 'POST', idem: 'snapshot-primary', body: {
    snapshot_scope: 'PRIMARY', vehicle_plate: '粤B-SMOKE', vehicle_type: 'TRUCK',
    driver_name: 'Smoke Driver', seal_number: 'SEAL-SMOKE', pieces: 2, weight_kg: 20
  }
});
const cnSnapshot = await api(`/api/v1/transport-jobs/${jobId}/vehicle-driver-snapshots`, {
  method: 'POST', idem: 'snapshot-cn', body: {
    snapshot_scope: 'CN_BORDER', vehicle_plate: '新A-CN-SMOKE', vehicle_type: 'TRUCK',
    driver_name: 'CN Driver', seal_number: 'SEAL-SMOKE', pieces: 2, weight_kg: 20
  }
});
const kzSnapshot = await api(`/api/v1/transport-jobs/${jobId}/vehicle-driver-snapshots`, {
  method: 'POST', idem: 'snapshot-kz', body: {
    snapshot_scope: 'KZ_BORDER', vehicle_plate: 'KZ-SMOKE', vehicle_type: 'TRUCK',
    driver_name: 'KZ Driver', seal_number: 'SEAL-SMOKE', pieces: 2, weight_kg: 20
  }
});
assert.ok(primarySnapshot.json.vehicle_driver_snapshot_id);
await api(`/api/v1/transport-jobs/${jobId}/loading/complete`, { method: 'POST', idem: 'loading-complete', body: {} });
const location = await api(`/api/v1/transport-jobs/${jobId}/locations`, {
  method: 'POST', idem: 'location-first', body: {
    client_event_id: `${runId}-location-first`, occurred_at: new Date().toISOString(),
    latitude: 22.5431, longitude: 114.0579, accuracy_m: 10, place_name: 'SZX pre-warehouse'
  }
});
const locationId = location.json.location_event_id;

const calendar = await api('/api/v1/port-service-calendars', {
  method: 'POST', idem: 'calendar-create', body: {
    port_pair_code: 'ALASHANKOU_DOSTYK', valid_from: '2026-01-01T00:00:00+08:00',
    valid_to: '2027-12-31T23:59:59+05:00', timezone_cn: 'Asia/Urumqi', timezone_kz: 'Asia/Almaty',
    open_days: [1, 2, 3, 4, 5, 6, 7], daily_windows: [{ start: '00:00', end: '23:59' }],
    source_type: 'SMOKE_CONFIRMED_SOURCE', source_ref: 'SMOKE-PORT-CONFIRMATION',
    next_verify_at: '2027-01-01T00:00:00Z'
  }
});
await api(`/api/v1/port-service-calendars/${calendar.json.calendar_id}/publish`, {
  method: 'POST', idem: 'calendar-publish', body: { confirmed_by: 'smoke-port-agent' }
});

const borderCreate = await api('/api/v1/border-operations', { method: 'POST', idem: 'border-create', body: { transport_job_id: jobId } });
const borderId = borderCreate.json.border_operation_id;
await api(`/api/v1/border-operations/${borderId}/pre-alert`, { method: 'POST', idem: 'border-prealert', body: { forecast_cn_arrival_at: new Date().toISOString(), evidence_ids: ['EV-PREALERT'] } });
await api(`/api/v1/border-operations/${borderId}/cn-queue`, { method: 'POST', idem: 'border-queue', body: { cn_queue_no: 'Q-SMOKE', cn_queue_ahead_count: 1, cn_open_window_count: 1, cn_next_update_at: new Date(Date.now() + 3600_000).toISOString() } });
await api(`/api/v1/border-operations/${borderId}/cn-gate-in`, { method: 'POST', idem: 'border-gatein', body: { occurred_at: new Date().toISOString(), evidence_ids: ['EV-GATEIN'] } });
await api(`/api/v1/border-operations/${borderId}/operation-mode`, { method: 'POST', idem: 'border-mode', body: {
  operation_mode: 'CARGO_TRANSLOAD', verification_status: 'CONFIRMED_WITH_EVIDENCE',
  cn_vehicle_snapshot_id: cnSnapshot.json.vehicle_driver_snapshot_id,
  kz_vehicle_snapshot_id: kzSnapshot.json.vehicle_driver_snapshot_id,
  planned_pieces: 2, planned_weight_kg: 20, seal_before: 'SEAL-SMOKE', evidence_ids: ['EV-MODE']
} });
await api(`/api/v1/border-operations/${borderId}/vehicle-mappings`, { method: 'POST', idem: 'border-mapping', body: {
  cn_vehicle_snapshot_id: cnSnapshot.json.vehicle_driver_snapshot_id,
  kz_vehicle_snapshot_id: kzSnapshot.json.vehicle_driver_snapshot_id,
  mapping_type: 'CARGO_TRANSLOAD', handover_party_from: 'CN-CARRIER', handover_party_to: 'KZ-CARRIER',
  submitted_by: 'smoke-border-maker', evidence_ids: ['EV-MAPPING']
} });
await api(`/api/v1/border-operations/${borderId}/transload-events`, { method: 'POST', idem: 'border-transload', body: {
  pieces_before: 2, pieces_after: 2, weight_before_kg: 20, weight_after_kg: 20,
  seal_before: 'SEAL-SMOKE', seal_after: 'SEAL-SMOKE', evidence_ids: ['EV-TRANSLOAD']
} });
await api(`/api/v1/border-operations/${borderId}/cn-release`, { method: 'POST', idem: 'border-cn-release', body: {
  occurred_at: new Date().toISOString(), cmr_document_id: 'CMR-SMOKE', evidence_ids: ['EV-CN-RELEASE']
} });
await api(`/api/v1/border-operations/${borderId}/china-exit`, { method: 'POST', idem: 'border-cn-exit', body: {
  occurred_at: new Date().toISOString(), requested_by: 'smoke-cn-exit-maker', next_owner_accepted: true, evidence_ids: ['EV-CN-EXIT']
} });
await api(`/api/v1/border-operations/${borderId}/dostyk-arrival`, { method: 'POST', idem: 'border-kz-arrival', body: { occurred_at: new Date().toISOString(), evidence_ids: ['EV-KZ-ARRIVAL'] } });
await api(`/api/v1/border-operations/${borderId}/kz-release`, { method: 'POST', idem: 'border-kz-release', body: { occurred_at: new Date().toISOString(), kz_inspection_status: 'RELEASED', evidence_ids: ['EV-KZ-RELEASE'] } });
const kzDeparture = await api(`/api/v1/border-operations/${borderId}/dostyk-departure`, { method: 'POST', idem: 'border-kz-departure', body: {
  occurred_at: new Date().toISOString(), requested_by: 'smoke-kz-departure-maker', next_owner_accepted: true, evidence_ids: ['EV-KZ-DEPARTURE']
} });
assert.equal(kzDeparture.json.result, 'DEPARTED_DOSTYK');

const jobDetail = await api(`/api/v1/transport-jobs/${jobId}`);
for (const checkpoint of jobDetail.json.checkpoints) {
  const body = {
    checkpoint_code: checkpoint.checkpoint_code,
    event_type: 'PASSED',
    occurred_at: new Date().toISOString(),
    evidence_ids: ['EV-CHECKPOINT-SMOKE']
  };
  if (checkpoint.checkpoint_code === 'SZX_TRUCK_DEPARTED') {
    body.departure_receipt_ref = 'WH-RELEASE-SMOKE';
    body.first_valid_gps_event_id = locationId;
  }
  await api(`/api/v1/transport-jobs/${jobId}/checkpoint-events`, {
    method: 'POST', idem: `checkpoint-${checkpoint.sequence}`, body
  });
}

if (manualStop === 'upstream') {
  console.log(JSON.stringify({
    ok: true,
    mode: 'tas_upstream_ready',
    run_id: runId,
    source_flight_id: flightId,
    target_flight_id: transportFlightId,
    shipment_id: shipmentId,
    transport_job_id: jobId,
    cargo_barcodes: [`PKG-${runId}-1`, `PKG-${runId}-2`],
    transport_status: 'ARRIVED_TAS_STAGING'
  }, null, 2));
  process.exit(0);
}

const tasCreate = await api('/api/v1/airports/TAS/receipts', { method: 'POST', idem: 'tas-create', body: { transport_job_id: jobId } });
const tasId = tasCreate.json.airport_receipt_session_id;
const outOfScopeTas = await api('/api/v1/airports/TAS/overview', { headers: outOfScopeMobileHeaders, expected: [403] });
assert.equal(outOfScopeTas.json.error.code, 'STATION_SCOPE_DENIED');
const tasMobileOptions = await api('/api/v1/airports/TAS/options', { headers: tasMobileHeaders });
assert.ok(tasMobileOptions.json.uld_type.some((item) => item.value === 'PMC'));
await api(`/api/v1/airport-receipts/${tasId}/arrival`, { method: 'POST', idem: 'tas-arrival', headers: tasMobileHeaders, body: { occurred_at: new Date().toISOString(), evidence_ids: ['EV-TAS-ARRIVAL'] } });
await api(`/api/v1/airport-receipts/${tasId}/seal-check`, { method: 'POST', idem: 'tas-seal', headers: tasMobileHeaders, body: { seal_actual: 'SEAL-SMOKE', evidence_ids: ['EV-TAS-SEAL'] } });
await api(`/api/v1/airport-receipts/${tasId}/unloading/start`, { method: 'POST', idem: 'tas-unload', headers: tasMobileHeaders, body: {} });
for (const index of [1, 2]) {
  await api(`/api/v1/airport-receipts/${tasId}/scans`, { method: 'POST', idem: `tas-scan-${index}`, headers: tasMobileHeaders, body: {
    client_event_id: `${runId}-tas-scan-${index}`, barcode: `PKG-${runId}-${index}`,
    occurred_at: new Date().toISOString(), condition_status: 'NORMAL', weight_kg: 10,
    device_id: 'PDA-TAS-SMOKE'
  } });
}
const reconcile = await api(`/api/v1/airport-receipts/${tasId}/reconcile`, { method: 'POST', idem: 'tas-reconcile', headers: tasMobileHeaders, body: {} });
assert.equal(reconcile.json.result, 'MATCHED');
await api(`/api/v1/airport-receipts/${tasId}/submit`, { method: 'POST', idem: 'tas-submit', headers: tasMobileHeaders, body: {} });
const tasDecision = await api(`/api/v1/airport-receipts/${tasId}/decision`, { method: 'POST', idem: 'tas-decision', body: {
  decision: 'PASS', next_owner_accepted: true, evidence_ids: ['EV-TAS-HANDOVER']
}, headers: supervisorHeaders });
assert.equal(tasDecision.json.result, 'ACCEPTED');

const planOptionsBefore = await api('/api/v1/operation-control-plans/options');
assert.ok(planOptionsBefore.json.routes.some((item) => item.route_template_code === 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2'));
assert.ok(planOptionsBefore.json.flights.some((item) => item.flight_id === flightId));

const planCreate = await api('/api/v1/operation-control-plans', { method: 'POST', idem: 'plan-create', body: {
  flight_id: flightId, route_template_code: 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2',
  baseline_etd: '2026-08-13T03:00:00+05:00', current_operating_etd: '2026-08-13T03:30:00+05:00',
  flight_timezone: 'Asia/Tashkent', source_approval_status: 'PENDING_APPROVAL'
} });
assert.equal(planCreate.json.milestone_count, 23);
const planId = planCreate.json.operation_control_plan_id;
const planOptionsAfter = await api('/api/v1/operation-control-plans/options');
assert.equal(planOptionsAfter.json.flights.find((item) => item.flight_id === flightId)?.operation_control_plan_id, planId);
const recalc = await api(`/api/v1/operation-control-plans/${planId}/recalculate`, { method: 'POST', idem: 'plan-recalc', body: {} });
assert.equal(recalc.json.overall_health_color, 'RED');
assert.ok(Number(recalc.json.next_milestone?.variance_minutes) > 360, 'overdue hard milestone should be more than six hours late');

const tasHandlingCreate = await api('/api/v1/airports/TAS/flights', {
  method: 'POST', idem: 'tas-handling-create', body: {
    flight_id: flightId,
    planned_pieces: 2,
    planned_weight_kg: 20,
    notes: 'TAS station end-to-end smoke handling'
  }
});
const tasHandlingId = tasHandlingCreate.json.tas_flight_handling_session_id;
assert.ok(tasHandlingId);

if (manualStop === 'planning') {
  console.log(JSON.stringify({
    ok: true,
    mode: 'tas_manual_acceptance',
    run_id: runId,
    flight_id: flightId,
    flight_no: flightPayload.flight_no,
    shipment_id: shipmentId,
    transport_job_id: jobId,
    airport_receipt_session_id: tasId,
    operation_control_plan_id: planId,
    tas_flight_handling_session_id: tasHandlingId,
    tas_status: tasHandlingCreate.json.status
  }, null, 2));
  process.exit(0);
}

const mobileCloseDenied = await api(`/api/v1/airports/TAS/flights/${tasHandlingId}/receiving/close`, {
  method: 'POST', idem: 'tas-receiving-close-mobile-denied', headers: tasMobileHeaders, expected: [403],
  body: { occurred_at: new Date().toISOString(), evidence_ids: ['EV-TAS-LAST-TRUCK'] }
});
assert.equal(mobileCloseDenied.json.error.code, 'FORBIDDEN');
await api(`/api/v1/airports/TAS/flights/${tasHandlingId}/receiving/close`, {
  method: 'POST', idem: 'tas-receiving-close', headers: supervisorHeaders,
  body: { occurred_at: new Date().toISOString(), evidence_ids: ['EV-TAS-LAST-TRUCK'] }
});

const tasUldCreate = await api(`/api/v1/airports/TAS/flights/${tasHandlingId}/ulds`, {
  method: 'POST', idem: 'tas-uld-create', headers: tasMobileHeaders, body: {
    uld_code: `PMC${String(Date.now()).slice(-5)}SP`,
    uld_type: 'PMC',
    position_code: '11P',
    contour_code: 'MAIN_DECK',
    tare_weight_kg: 120,
    max_gross_weight_kg: 6804,
    seal_number: 'ULD-SEAL-SMOKE'
  }
});
const tasUldId = tasUldCreate.json.tas_uld_id;
assert.ok(tasUldId);

for (const index of [1, 2]) {
  const assignment = await api(`/api/v1/airports/TAS/flights/${tasHandlingId}/ulds/${tasUldId}/items`, {
    method: 'POST', idem: `tas-uld-assign-${index}`, headers: tasMobileHeaders, body: { barcode: `PKG-${runId}-${index}` }
  });
  assert.equal(assignment.json.result, 'ASSIGNED');
}

const tasBuildUp = await api(`/api/v1/airports/TAS/flights/${tasHandlingId}/buildup/complete`, {
  method: 'POST', idem: 'tas-buildup-complete', headers: supervisorHeaders,
  body: { occurred_at: new Date().toISOString(), evidence_ids: ['EV-TAS-BUILDUP'] }
});
assert.equal(tasBuildUp.json.result, 'BUILT_UP');
assert.equal(tasBuildUp.json.buildup_pieces, 2);

const tasManifest = await api(`/api/v1/airports/TAS/flights/${tasHandlingId}/manifest/finalize`, {
  method: 'POST', idem: 'tas-manifest-finalize', headers: supervisorHeaders,
  body: {
    manifest_document_id: `MANIFEST-${runId}`,
    manifest_version: '1',
    occurred_at: new Date().toISOString(),
    evidence_ids: ['EV-TAS-MANIFEST']
  }
});
assert.equal(tasManifest.json.result, 'MANIFEST_FROZEN');
assert.ok(tasManifest.json.manifest_hash);

const tasHandover = await api(`/api/v1/airports/TAS/flights/${tasHandlingId}/handover`, {
  method: 'POST', idem: 'tas-airline-handover', headers: supervisorHeaders,
  body: {
    airline_party_code: 'AIRLINE-SMOKE',
    next_owner_accepted: true,
    occurred_at: new Date().toISOString(),
    evidence_ids: ['EV-TAS-AIRLINE-HANDOVER']
  }
});
assert.equal(tasHandover.json.result, 'HANDED_TO_AIRLINE');

const tasLoaded = await api(`/api/v1/airports/TAS/flights/${tasHandlingId}/loading/complete`, {
  method: 'POST', idem: 'tas-aircraft-loaded', headers: supervisorHeaders,
  body: { occurred_at: new Date().toISOString(), evidence_ids: ['EV-TAS-LOAD-CONFIRMATION'] }
});
assert.equal(tasLoaded.json.result, 'LOADED');
assert.equal(tasLoaded.json.loaded_pieces, 2);

const tasDeparted = await api(`/api/v1/airports/TAS/flights/${tasHandlingId}/departure`, {
  method: 'POST', idem: 'tas-flight-departed', headers: supervisorHeaders,
  body: {
    requested_by: 'smoke-airline-departure-maker',
    next_owner_accepted: true,
    occurred_at: new Date().toISOString(),
    evidence_ids: ['EV-TAS-DEPARTURE-CONFIRMATION']
  }
});
assert.equal(tasDeparted.json.result, 'DEPARTED');

const tasHandlingDetail = await api(`/api/v1/airports/TAS/flights/${tasHandlingId}`);
assert.equal(tasHandlingDetail.json.handling.status, 'DEPARTED');
assert.equal(tasHandlingDetail.json.handling.runtime_status, 'Airborne');
assert.equal(tasHandlingDetail.json.ulds[0].status, 'LOADED');
assert.equal(tasHandlingDetail.json.ulds[0].items.filter((item) => item.status === 'LOADED').length, 2);
const tasMilestones = new Map(tasHandlingDetail.json.milestones.map((item) => [item.milestone_code, item.status]));
for (const milestoneCode of [
  'TAS_LAST_TRUCK_ARRIVED',
  'TAS_BUILDUP_COMPLETED',
  'MANIFEST_FROZEN',
  'ULD_HANDED_TO_AIRLINE',
  'AIRCRAFT_LOADING_COMPLETED',
  'TAS_ACTUAL_DEP'
]) {
  assert.equal(tasMilestones.get(milestoneCode), 'COMPLETED', `${milestoneCode} should be auto-projected`);
}

const wizardFlightNo = `WZ${String(Date.now()).slice(-6)}`;
const wizardFlightCreate = await api('/api/v1/operation-control-plans/flight-drafts', {
  method: 'POST', idem: 'wizard-flight-create', body: {
    flight_no: wizardFlightNo,
    flight_date: '2026-08-20',
    baseline_etd: '2026-08-20T03:00:00+05:00',
    current_operating_etd: '2026-08-20T03:30:00+05:00',
    aircraft_type: 'B744F'
  }
});
assert.ok(wizardFlightCreate.json.flight?.flight_id);
assert.equal(wizardFlightCreate.json.flight?.origin_code, 'TAS');
assert.equal(wizardFlightCreate.json.flight?.destination_code, 'LGG');
const wizardPlanCreate = await api('/api/v1/operation-control-plans', {
  method: 'POST', idem: 'wizard-plan-create', body: {
    flight_id: wizardFlightCreate.json.flight.flight_id,
    route_template_code: 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2',
    baseline_etd: '2026-08-20T03:00:00+05:00',
    current_operating_etd: '2026-08-20T03:30:00+05:00',
    flight_timezone: 'Asia/Tashkent'
  }
});
assert.equal(wizardPlanCreate.json.status, 'DRAFT');
assert.equal(wizardPlanCreate.json.milestone_count, 23);

let reverseDelivery = null;
if (skyledgerFixture) {
  const attempts = [];
  // The outbox intentionally dispatches only the head event of each aggregate.
  // A transport run emits more than 20 ordered checkpoint events, so drain it
  // over bounded rounds instead of bypassing per-aggregate ordering.
  for (let index = 0; index < 40; index += 1) {
    const dispatch = await api('/api/v1/platform/integrations/skyledger/dispatch', {
      method: 'POST',
      body: { limit: 100, aggregate_ids: [receiptId, jobId, borderId, tasId] }
    });
    attempts.push(dispatch.json.data);
    if (dispatch.json.data.dispatched === 0) break;
  }
  reverseDelivery = {
    attempts,
    dispatched: attempts.reduce((sum, item) => sum + Number(item.dispatched || 0), 0),
    delivered: attempts.reduce((sum, item) => sum + Number(item.delivered || 0), 0),
    failed: attempts.reduce((sum, item) => sum + Number(item.failed || 0), 0)
  };
  assert.ok(reverseDelivery.delivered >= 26, `Expected at least 26 reverse events, received ${reverseDelivery.delivered}`);
  assert.equal(reverseDelivery.failed, 0, 'Current smoke aggregates must not have failed deliveries');
}

const integrationStatus = await api('/api/v1/platform/integrations/skyledger/status');
assert.ok(integrationStatus.json.data.object_links.length >= 3);

console.log(JSON.stringify({
  ok: true,
  run_id: runId,
  flight_id: flightId,
  shipment_id: shipmentId,
  receipt_session_id: receiptId,
  transport_job_id: jobId,
  border_operation_id: borderId,
  airport_receipt_session_id: tasId,
  tas_flight_handling_session_id: tasHandlingId,
  operation_control_plan_id: planId,
  skyledger_fixture: skyledgerFixture,
  reverse_delivery: reverseDelivery,
  outbox_status: integrationStatus.json.data.outbox
}, null, 2));
