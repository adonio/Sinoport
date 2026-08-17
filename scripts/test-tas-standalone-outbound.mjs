import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const baseUrl = process.env.SINOPORT_API_BASE_URL || 'http://127.0.0.1:8787';
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const tenantId = `tas-standalone-${runId}`;
const adminHeaders = {
  Authorization: 'Bearer demo-token',
  'Content-Type': 'application/json',
  'X-Debug-User-Id': 'tas-planner',
  'X-Debug-Roles': 'platform_admin,station_supervisor,B1_TAS_STATION_CONTROLLER,TAS_OPERATOR',
  'X-Debug-Station-Scope': 'TAS',
  'X-Debug-Tenant-Id': tenantId
};
const operatorHeaders = {
  ...adminHeaders,
  'X-Debug-User-Id': 'tas-receiver',
  'X-Debug-Roles': 'mobile_operator,TAS_OPERATOR',
  'X-Client-Source': 'mobile-pda'
};
const supervisorHeaders = {
  ...adminHeaders,
  'X-Debug-User-Id': 'tas-supervisor',
  'X-Debug-Roles': 'station_supervisor,B1_TAS_STATION_CONTROLLER'
};

async function api(path, { method = 'GET', body, headers = adminHeaders, expected = [200, 201], idem } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...headers, ...(idem ? { 'Idempotency-Key': `${runId}-${idem}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!expected.includes(response.status)) throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(json)}`);
  return { status: response.status, data: json.data || json };
}

const suffix = String(Date.now()).slice(-7);
const flight = await api('/api/v1/airports/TAS/outbound-tasks', {
  method: 'POST', idem: 'flight', body: {
    flight_no: `SP${suffix.slice(-4)}`,
    std_at: '2026-08-18T03:00:00.000Z',
    aircraft_type: 'B744F'
  }
});
assert.equal(flight.status, 201);
const handlingId = flight.data.tas_flight_handling_session_id;
const flightId = flight.data.flight_id;
assert.ok(handlingId && flightId);

const duplicateFlight = await api('/api/v1/airports/TAS/outbound-tasks', {
  method: 'POST', idem: 'flight', body: { flight_no: 'IGNORED', std_at: '2026-08-18T04:00:00.000Z' }
});
assert.equal(duplicateFlight.data.duplicate, true);

const forecast = await api(`/api/v1/airports/TAS/flights/${handlingId}/awbs`, {
  method: 'POST', idem: 'forecast-awb', body: {
    awb_no: `160-${suffix}1`, pieces: 2, gross_weight: 20, goods_description: 'Forecast cargo'
  }
});
const provisional = await api(`/api/v1/airports/TAS/flights/${handlingId}/awbs`, {
  method: 'POST', headers: operatorHeaders, idem: 'provisional-awb', body: {
    awb_no: `160-${suffix}2`, pieces: 0, gross_weight: 0, provisional: true
  }
});
assert.equal(provisional.data.forecast_status, 'PROVISIONAL');

const mobileFormalForecast = await api(`/api/v1/airports/TAS/flights/${handlingId}/awbs`, {
  method: 'POST', headers: { ...operatorHeaders, 'X-Debug-Roles': 'mobile_operator' }, idem: 'mobile-formal-forbidden',
  body: { awb_no: `160-${suffix}9`, pieces: 1, gross_weight: 1 }, expected: [403]
});
assert.equal(mobileFormalForecast.data.error?.code || mobileFormalForecast.data.code, 'TAS_AWB_FORECAST_FORBIDDEN');

const truck = await api(`/api/v1/airports/TAS/flights/${handlingId}/trucks`, {
  method: 'POST', idem: 'truck', body: {
    vehicle_plate: `KZ${suffix}`,
    driver_name: 'TAS Test Driver',
    eta_at: '2026-08-18T00:30:00.000Z',
    awb_allocations: [
      { awb_id: forecast.data.awb_id, planned_pieces: 2, planned_weight_kg: 20 },
      { awb_id: provisional.data.awb_id, planned_pieces: 0, planned_weight_kg: 0 }
    ]
  }
});

const forecastReceipt = await api(`/api/v1/airports/TAS/flights/${handlingId}/direct-receipts`, {
  method: 'POST', headers: operatorHeaders, idem: 'forecast-receipt', body: {
    tas_truck_prealert_id: truck.data.tas_truck_prealert_id,
    seal_actual: 'SEAL-FORECAST'
  }
});
const forecastReceiptId = forecastReceipt.data.tas_direct_receipt_session_id;
const pendingOverview = await api('/api/v1/airports/TAS/overview');
assert.equal(pendingOverview.data.receipts.total, 1);
assert.equal(pendingOverview.data.receipts.pending, 1);
for (let index = 1; index <= 2; index += 1) {
  const scan = await api(`/api/v1/airports/TAS/direct-receipts/${forecastReceiptId}/scans`, {
    method: 'POST', headers: operatorHeaders, idem: `forecast-scan-${index}`, body: {
      awb_id: forecast.data.awb_id,
      barcode: `PKG-${suffix}-F${index}`,
      weight_kg: 10,
      condition_status: 'NORMAL',
      client_event_id: `${runId}-forecast-${index}`,
      device_id: 'TAS-PDA-TEST'
    }
  });
  assert.equal(scan.data.received_pieces, index);
}
const duplicateScan = await api(`/api/v1/airports/TAS/direct-receipts/${forecastReceiptId}/scans`, {
  method: 'POST', headers: operatorHeaders, idem: 'forecast-scan-2', body: {
    awb_id: forecast.data.awb_id, barcode: 'IGNORED', client_event_id: 'IGNORED'
  }
});
assert.equal(duplicateScan.data.duplicate, true);
await api(`/api/v1/airports/TAS/direct-receipts/${forecastReceiptId}/submit`, { method: 'POST', headers: operatorHeaders, idem: 'forecast-submit', body: {} });
await api(`/api/v1/airports/TAS/direct-receipts/${forecastReceiptId}/decision`, {
  method: 'POST', headers: supervisorHeaders, idem: 'forecast-decision', body: { decision: 'PASS', evidence_ids: ['EVD-FORECAST-RECEIPT'] }
});

const walkInReceipt = await api(`/api/v1/airports/TAS/flights/${handlingId}/direct-receipts`, {
  method: 'POST', headers: operatorHeaders, idem: 'walkin-receipt', body: { vehicle_plate: `WALKIN-${suffix}` }
});
const walkInReceiptId = walkInReceipt.data.tas_direct_receipt_session_id;
await api(`/api/v1/airports/TAS/direct-receipts/${walkInReceiptId}/awbs`, {
  method: 'POST', headers: operatorHeaders, idem: 'walkin-attach-awb', body: { awb_id: provisional.data.awb_id }
});
await api(`/api/v1/airports/TAS/direct-receipts/${walkInReceiptId}/scans`, {
  method: 'POST', headers: operatorHeaders, idem: 'walkin-scan', body: {
    awb_id: provisional.data.awb_id,
    barcode: `PKG-${suffix}-P1`,
    weight_kg: 5,
    condition_status: 'NORMAL',
    client_event_id: `${runId}-walkin-1`,
    device_id: 'TAS-PDA-TEST'
  }
});
await api(`/api/v1/airports/TAS/direct-receipts/${walkInReceiptId}/submit`, { method: 'POST', headers: operatorHeaders, idem: 'walkin-submit', body: {} });
await api(`/api/v1/airports/TAS/direct-receipts/${walkInReceiptId}/decision`, {
  method: 'POST', headers: supervisorHeaders, idem: 'walkin-decision', body: { decision: 'PASS', evidence_ids: ['EVD-WALKIN-RECEIPT'] }
});

let workspace = await api(`/api/v1/airports/TAS/flights/${handlingId}/workspace`);
assert.equal(workspace.data.handling.received_pieces, 3);
assert.equal(workspace.data.trucks[0].awbs.length, 2);
const provisionalAwb = workspace.data.awbs.find((item) => item.awb_id === provisional.data.awb_id);
assert.equal(provisionalAwb.forecast_status, 'CONFIRMED');
assert.equal(provisionalAwb.pieces, 1);
assert.equal(provisionalAwb.gross_weight, 5);
const units = workspace.data.cargo_units;
assert.equal(units.length, 3);

const uld = await api(`/api/v1/airports/TAS/flights/${handlingId}/ulds`, {
  method: 'POST', headers: operatorHeaders, idem: 'uld', body: {
    uld_code: `PMC${suffix}SP`, uld_type: 'PMC', tare_weight_kg: 120, max_gross_weight_kg: 6800
  }
});
await api(`/api/v1/airports/TAS/flights/${handlingId}/ulds/${uld.data.tas_uld_id}/items`, {
  method: 'POST', headers: operatorHeaders, idem: 'uld-item', body: { barcode: units[0].business_barcode }
});
const bulk1 = await api(`/api/v1/airports/TAS/flights/${handlingId}/bulk-items`, {
  method: 'POST', headers: operatorHeaders, idem: 'bulk-1', body: { barcode: units[1].business_barcode, position_code: 'BULK-A' }
});
const bulk2 = await api(`/api/v1/airports/TAS/flights/${handlingId}/bulk-items`, {
  method: 'POST', headers: operatorHeaders, idem: 'bulk-2', body: { barcode: units[2].business_barcode, position_code: 'BULK-B' }
});

await api(`/api/v1/airports/TAS/flights/${handlingId}/receiving/close`, {
  method: 'POST', headers: supervisorHeaders, idem: 'receiving-close', body: { evidence_ids: ['EVD-LAST-TRUCK'] }
});
await api(`/api/v1/airports/TAS/flights/${handlingId}/buildup/complete`, {
  method: 'POST', headers: supervisorHeaders, idem: 'buildup', body: { evidence_ids: ['EVD-BUILDUP'] }
});
await api(`/api/v1/airports/TAS/flights/${handlingId}/manifest/finalize`, {
  method: 'POST', headers: supervisorHeaders, idem: 'manifest', body: {
    manifest_document_id: `MANIFEST-${runId}`, manifest_version: '1', evidence_ids: ['EVD-MANIFEST']
  }
});
await api(`/api/v1/airports/TAS/flights/${handlingId}/handover`, {
  method: 'POST', headers: supervisorHeaders, idem: 'handover', body: {
    airline_party_code: 'SP', next_owner_accepted: true, evidence_ids: ['EVD-HANDOVER']
  }
});
const earlyClose = await api(`/api/v1/airports/TAS/flights/${handlingId}/loading/complete`, {
  method: 'POST', headers: supervisorHeaders, idem: 'early-loading-close', body: { evidence_ids: ['EVD-LOAD'] }, expected: [409]
});
assert.equal(earlyClose.data.error?.code || earlyClose.data.code, 'TAS_ULD_LOADING_INCOMPLETE');

await api(`/api/v1/airports/TAS/flights/${handlingId}/loading/ulds/${uld.data.tas_uld_id}/confirm`, {
  method: 'POST', headers: operatorHeaders, idem: 'load-uld', body: { position_code: '1L', evidence_ids: ['EVD-ULD-LOAD'] }
});
await api(`/api/v1/airports/TAS/flights/${handlingId}/loading/bulk/${bulk1.data.tas_bulk_load_item_id}/confirm`, {
  method: 'POST', headers: operatorHeaders, idem: 'load-bulk-1', body: { position_code: 'BULK-A', evidence_ids: ['EVD-BULK-1'] }
});
await api(`/api/v1/airports/TAS/flights/${handlingId}/loading/bulk/${bulk2.data.tas_bulk_load_item_id}/confirm`, {
  method: 'POST', headers: operatorHeaders, idem: 'load-bulk-2', body: { position_code: 'BULK-B', evidence_ids: ['EVD-BULK-2'] }
});
await api(`/api/v1/airports/TAS/flights/${handlingId}/loading/complete`, {
  method: 'POST', headers: supervisorHeaders, idem: 'loading-close', body: { evidence_ids: ['EVD-LOAD-CLOSE'] }
});
await api(`/api/v1/airports/TAS/flights/${handlingId}/departure`, {
  method: 'POST', headers: supervisorHeaders, idem: 'departure', body: {
    requested_by: 'tas-departure-maker', next_owner_accepted: true, evidence_ids: ['EVD-DEPARTURE']
  }
});

const finalDetail = await api(`/api/v1/airports/TAS/flights/${handlingId}`);
assert.equal(finalDetail.data.handling.status, 'DEPARTED');
assert.equal(finalDetail.data.handling.loaded_pieces, 3);
assert.equal(finalDetail.data.handling.runtime_status, 'Airborne');
workspace = await api(`/api/v1/airports/TAS/flights/${handlingId}/workspace`);
assert.ok(workspace.data.cargo_units.every((item) => item.inventory_state === 'LOADED'));
assert.ok(workspace.data.bulk_items.every((item) => item.status === 'LOADED'));
assert.ok(workspace.data.direct_receipts.every((item) => item.status === 'COMPLETED'));
const finalOverview = await api('/api/v1/airports/TAS/overview');
assert.equal(finalOverview.data.receipts.total, 2);
assert.equal(finalOverview.data.receipts.pending, 0);
assert.equal(finalOverview.data.receipts.accepted, 2);

console.log(JSON.stringify({
  result: 'PASS', tenant_id: tenantId, flight_id: flightId,
  tas_flight_handling_session_id: handlingId, received_pieces: 3,
  uld_count: 1, bulk_count: 2, status: finalDetail.data.handling.status
}, null, 2));
