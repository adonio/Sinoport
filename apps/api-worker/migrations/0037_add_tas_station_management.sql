CREATE TABLE IF NOT EXISTS tas_flight_handling_sessions (
  tas_flight_handling_session_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  airport_code TEXT NOT NULL DEFAULT 'TAS',
  flight_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNING',
  planned_pieces INTEGER NOT NULL DEFAULT 0,
  planned_weight_kg REAL NOT NULL DEFAULT 0,
  received_pieces INTEGER NOT NULL DEFAULT 0,
  received_weight_kg REAL NOT NULL DEFAULT 0,
  buildup_pieces INTEGER NOT NULL DEFAULT 0,
  buildup_weight_kg REAL NOT NULL DEFAULT 0,
  handed_to_airline_pieces INTEGER NOT NULL DEFAULT 0,
  loaded_pieces INTEGER NOT NULL DEFAULT 0,
  manifest_document_id TEXT,
  manifest_version TEXT,
  manifest_hash TEXT,
  airline_party_code TEXT,
  receiving_closed_at TEXT,
  buildup_completed_at TEXT,
  manifest_frozen_at TEXT,
  airline_handover_at TEXT,
  loading_completed_at TEXT,
  departed_at TEXT,
  buildup_evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  manifest_evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  handover_evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  loading_evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  departure_evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  receiving_evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT,
  CHECK (airport_code = 'TAS'),
  CHECK (status IN (
    'PLANNING',
    'BUILDUP',
    'BUILT_UP',
    'MANIFEST_FROZEN',
    'HANDED_TO_AIRLINE',
    'LOADED',
    'DEPARTED',
    'CANCELLED'
  )),
  CHECK (planned_pieces >= 0),
  CHECK (received_pieces >= 0),
  CHECK (buildup_pieces >= 0),
  CHECK (handed_to_airline_pieces >= 0),
  CHECK (loaded_pieces >= 0),
  FOREIGN KEY (flight_id) REFERENCES flights(flight_id),
  UNIQUE (tenant_id, flight_id)
);

CREATE INDEX IF NOT EXISTS idx_tas_handling_status
  ON tas_flight_handling_sessions(tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tas_handling_flight
  ON tas_flight_handling_sessions(flight_id, archived_at);

CREATE TABLE IF NOT EXISTS tas_ulds (
  tas_uld_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tas_flight_handling_session_id TEXT NOT NULL,
  uld_code TEXT NOT NULL,
  uld_type TEXT NOT NULL,
  position_code TEXT,
  contour_code TEXT,
  tare_weight_kg REAL NOT NULL DEFAULT 0,
  max_gross_weight_kg REAL,
  actual_gross_weight_kg REAL NOT NULL DEFAULT 0,
  piece_count INTEGER NOT NULL DEFAULT 0,
  seal_number TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  built_by TEXT,
  verified_by TEXT,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT,
  CHECK (status IN ('PLANNED', 'BUILDING', 'BUILT_UP', 'HANDED_TO_AIRLINE', 'LOADED', 'OFFLOADED', 'VOIDED')),
  CHECK (piece_count >= 0),
  CHECK (tare_weight_kg >= 0),
  CHECK (actual_gross_weight_kg >= 0),
  FOREIGN KEY (tas_flight_handling_session_id) REFERENCES tas_flight_handling_sessions(tas_flight_handling_session_id),
  UNIQUE (tenant_id, tas_flight_handling_session_id, uld_code)
);

CREATE INDEX IF NOT EXISTS idx_tas_ulds_handling_status
  ON tas_ulds(tas_flight_handling_session_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS tas_uld_items (
  tas_uld_item_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tas_flight_handling_session_id TEXT NOT NULL,
  tas_uld_id TEXT NOT NULL,
  cargo_unit_id TEXT NOT NULL,
  shipment_id TEXT NOT NULL,
  piece_count INTEGER NOT NULL,
  weight_kg REAL,
  status TEXT NOT NULL DEFAULT 'ASSIGNED',
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  loaded_at TEXT,
  removed_by TEXT,
  removed_at TEXT,
  removal_reason TEXT,
  CHECK (status IN ('ASSIGNED', 'LOADED', 'REMOVED')),
  CHECK (piece_count > 0),
  FOREIGN KEY (tas_flight_handling_session_id) REFERENCES tas_flight_handling_sessions(tas_flight_handling_session_id),
  FOREIGN KEY (tas_uld_id) REFERENCES tas_ulds(tas_uld_id),
  FOREIGN KEY (cargo_unit_id) REFERENCES cargo_units(cargo_unit_id),
  FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id)
);

CREATE INDEX IF NOT EXISTS idx_tas_uld_items_uld
  ON tas_uld_items(tas_uld_id, status, assigned_at);

CREATE INDEX IF NOT EXISTS idx_tas_uld_items_handling
  ON tas_uld_items(tas_flight_handling_session_id, status, assigned_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tas_cargo_unit_active_assignment
  ON tas_uld_items(tenant_id, cargo_unit_id)
  WHERE removed_at IS NULL AND status IN ('ASSIGNED', 'LOADED');

CREATE TABLE IF NOT EXISTS tas_station_options (
  option_group TEXT NOT NULL,
  option_value TEXT NOT NULL,
  label_zh TEXT NOT NULL,
  label_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (option_group, option_value)
);

INSERT OR IGNORE INTO tas_station_options
  (option_group, option_value, label_zh, label_en, sort_order)
VALUES
  ('receipt_status', 'ARRIVED_STAGING', '已到待接收区', 'Arrived at Staging', 10),
  ('receipt_status', 'TRUCK_ARRIVED', '车辆正式到场', 'Truck Arrived', 20),
  ('receipt_status', 'UNLOADING', '卸货中', 'Unloading', 30),
  ('receipt_status', 'COUNTING', '清点中', 'Counting', 40),
  ('receipt_status', 'MATCHED', '三方核对一致', 'Reconciled', 50),
  ('receipt_status', 'DISCREPANCY_REVIEW', '差异复核', 'Discrepancy Review', 60),
  ('receipt_status', 'RECONCILIATION_PENDING', '待主管决策', 'Supervisor Decision Pending', 70),
  ('receipt_status', 'ACCEPTED', '已接收', 'Accepted', 80),
  ('receipt_status', 'CONDITIONAL_ACCEPTED', '有条件接收', 'Conditionally Accepted', 90),
  ('receipt_status', 'REJECTED_OR_QUARANTINED', '拒收或隔离', 'Rejected or Quarantined', 100),
  ('receipt_status', 'COMPLETED', '已完成', 'Completed', 110),
  ('handling_status', 'PLANNING', '计划中', 'Planning', 10),
  ('handling_status', 'BUILDUP', '组板中', 'Build-up', 20),
  ('handling_status', 'BUILT_UP', '组板完成', 'Built Up', 30),
  ('handling_status', 'MANIFEST_FROZEN', 'Manifest 已冻结', 'Manifest Frozen', 40),
  ('handling_status', 'HANDED_TO_AIRLINE', '已交航司', 'Handed to Airline', 50),
  ('handling_status', 'LOADED', '已装机', 'Loaded', 60),
  ('handling_status', 'DEPARTED', '已起飞', 'Departed', 70),
  ('handling_status', 'CANCELLED', '已取消', 'Cancelled', 80),
  ('uld_type', 'PMC', 'PMC 主货板', 'PMC Pallet', 10),
  ('uld_type', 'PAG', 'PAG 主货板', 'PAG Pallet', 20),
  ('uld_type', 'PLA', 'PLA 货板', 'PLA Pallet', 30),
  ('uld_type', 'AKE', 'AKE 集装箱', 'AKE Container', 40),
  ('uld_type', 'AMJ', 'AMJ 集装箱', 'AMJ Container', 50),
  ('cargo_condition', 'NORMAL', '正常', 'Normal', 10),
  ('cargo_condition', 'DAMAGED', '破损', 'Damaged', 20),
  ('cargo_condition', 'WET', '湿损', 'Wet', 30),
  ('cargo_condition', 'OPENED', '包装开启', 'Opened', 40),
  ('cargo_condition', 'DEFORMED', '变形', 'Deformed', 50),
  ('cargo_condition', 'LABEL_ISSUE', '标签问题', 'Label Issue', 60),
  ('cargo_condition', 'OTHER', '其他', 'Other', 70),
  ('gate_decision', 'PASS', '通过', 'Pass', 10),
  ('gate_decision', 'CONDITIONAL_PASS', '有条件通过', 'Conditional Pass', 20),
  ('gate_decision', 'BLOCKED', '阻断', 'Blocked', 30);
