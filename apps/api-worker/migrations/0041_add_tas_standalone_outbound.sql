-- TAS-LGG station-local outbound operations. Upstream TransportJob and OCC
-- control-plan links remain optional integrations and are never required to
-- start a station flight, forecast cargo, receive a truck, or count pieces.

INSERT OR IGNORE INTO stations (
  station_id, station_name, region, control_level, phase,
  airport_code, icao_code, service_scope, owner_name
) VALUES (
  'LGG', '列日机场接口站', '欧洲', 'interface_visible', 'active',
  'LGG', 'EBLG', '航班目的站、到港状态与外部接口', 'LGG Interface'
);

CREATE TABLE IF NOT EXISTS tas_outbound_awb_forecasts (
  tas_awb_forecast_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  flight_id TEXT NOT NULL,
  awb_id TEXT NOT NULL,
  forecast_status TEXT NOT NULL DEFAULT 'FORECASTED',
  expected_pieces INTEGER NOT NULL DEFAULT 0,
  expected_weight_kg REAL NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'MANUAL',
  source_ref TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (forecast_status IN ('PROVISIONAL', 'FORECASTED', 'CONFIRMED', 'CANCELLED')),
  CHECK (expected_pieces >= 0),
  CHECK (expected_weight_kg >= 0),
  FOREIGN KEY (flight_id) REFERENCES flights(flight_id),
  FOREIGN KEY (awb_id) REFERENCES awbs(awb_id),
  UNIQUE (tenant_id, flight_id, awb_id)
);

CREATE INDEX IF NOT EXISTS idx_tas_awb_forecasts_flight
  ON tas_outbound_awb_forecasts(tenant_id, flight_id, forecast_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS tas_truck_prealerts (
  tas_truck_prealert_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  flight_id TEXT NOT NULL,
  appointment_ref TEXT,
  vehicle_plate TEXT NOT NULL,
  driver_name TEXT,
  driver_phone TEXT,
  eta_at TEXT,
  actual_arrival_at TEXT,
  seal_expected TEXT,
  seal_actual TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  notes TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('PLANNED', 'ARRIVED', 'RECEIVING', 'COMPLETED', 'CANCELLED')),
  FOREIGN KEY (flight_id) REFERENCES flights(flight_id)
);

CREATE INDEX IF NOT EXISTS idx_tas_truck_prealerts_flight
  ON tas_truck_prealerts(tenant_id, flight_id, status, COALESCE(eta_at, created_at));

CREATE TABLE IF NOT EXISTS tas_truck_prealert_awbs (
  tas_truck_prealert_awb_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tas_truck_prealert_id TEXT NOT NULL,
  awb_id TEXT NOT NULL,
  planned_pieces INTEGER NOT NULL DEFAULT 0,
  planned_weight_kg REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (planned_pieces >= 0),
  CHECK (planned_weight_kg >= 0),
  FOREIGN KEY (tas_truck_prealert_id) REFERENCES tas_truck_prealerts(tas_truck_prealert_id),
  FOREIGN KEY (awb_id) REFERENCES awbs(awb_id),
  UNIQUE (tenant_id, tas_truck_prealert_id, awb_id)
);

CREATE TABLE IF NOT EXISTS tas_direct_receipt_sessions (
  tas_direct_receipt_session_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  flight_id TEXT NOT NULL,
  tas_truck_prealert_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'DIRECT_TAS',
  vehicle_plate TEXT,
  driver_name TEXT,
  seal_actual TEXT,
  status TEXT NOT NULL DEFAULT 'COUNTING',
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  accepted_at TEXT,
  accepted_by TEXT,
  decision TEXT,
  decision_reason TEXT,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (source_type IN ('DIRECT_TAS', 'UPSTREAM_TRANSPORT')),
  CHECK (status IN ('COUNTING', 'SUBMITTED', 'ACCEPTED', 'CONDITIONAL_ACCEPTED', 'BLOCKED', 'CANCELLED', 'COMPLETED')),
  CHECK (decision IS NULL OR decision IN ('PASS', 'CONDITIONAL_PASS', 'BLOCKED')),
  FOREIGN KEY (flight_id) REFERENCES flights(flight_id),
  FOREIGN KEY (tas_truck_prealert_id) REFERENCES tas_truck_prealerts(tas_truck_prealert_id)
);

CREATE INDEX IF NOT EXISTS idx_tas_direct_receipts_flight
  ON tas_direct_receipt_sessions(tenant_id, flight_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS tas_direct_receipt_lines (
  tas_direct_receipt_line_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tas_direct_receipt_session_id TEXT NOT NULL,
  shipment_id TEXT NOT NULL,
  awb_id TEXT NOT NULL,
  forecast_status TEXT NOT NULL,
  expected_pieces INTEGER NOT NULL DEFAULT 0,
  expected_weight_kg REAL NOT NULL DEFAULT 0,
  received_pieces INTEGER NOT NULL DEFAULT 0,
  received_weight_kg REAL NOT NULL DEFAULT 0,
  exception_pieces INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COUNTING',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (forecast_status IN ('PROVISIONAL', 'FORECASTED', 'CONFIRMED')),
  CHECK (status IN ('COUNTING', 'SUBMITTED', 'ACCEPTED', 'CONDITIONAL_ACCEPTED', 'BLOCKED', 'CANCELLED')),
  CHECK (expected_pieces >= 0 AND received_pieces >= 0 AND exception_pieces >= 0),
  CHECK (expected_weight_kg >= 0 AND received_weight_kg >= 0),
  FOREIGN KEY (tas_direct_receipt_session_id) REFERENCES tas_direct_receipt_sessions(tas_direct_receipt_session_id),
  FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id),
  FOREIGN KEY (awb_id) REFERENCES awbs(awb_id),
  UNIQUE (tenant_id, tas_direct_receipt_session_id, awb_id)
);

CREATE INDEX IF NOT EXISTS idx_tas_direct_receipt_lines_session
  ON tas_direct_receipt_lines(tas_direct_receipt_session_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS tas_bulk_load_items (
  tas_bulk_load_item_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tas_flight_handling_session_id TEXT NOT NULL,
  cargo_unit_id TEXT NOT NULL,
  shipment_id TEXT NOT NULL,
  awb_id TEXT,
  position_code TEXT,
  piece_count INTEGER NOT NULL DEFAULT 1,
  weight_kg REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ASSIGNED',
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  loaded_at TEXT,
  removed_by TEXT,
  removed_at TEXT,
  removal_reason TEXT,
  CHECK (piece_count > 0),
  CHECK (weight_kg >= 0),
  CHECK (status IN ('ASSIGNED', 'HANDED_TO_AIRLINE', 'LOADED', 'REMOVED')),
  FOREIGN KEY (tas_flight_handling_session_id) REFERENCES tas_flight_handling_sessions(tas_flight_handling_session_id),
  FOREIGN KEY (cargo_unit_id) REFERENCES cargo_units(cargo_unit_id),
  FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id),
  FOREIGN KEY (awb_id) REFERENCES awbs(awb_id)
);

CREATE INDEX IF NOT EXISTS idx_tas_bulk_items_handling
  ON tas_bulk_load_items(tas_flight_handling_session_id, status, assigned_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tas_bulk_cargo_unit_active_assignment
  ON tas_bulk_load_items(tenant_id, cargo_unit_id)
  WHERE removed_at IS NULL AND status IN ('ASSIGNED', 'HANDED_TO_AIRLINE', 'LOADED');
