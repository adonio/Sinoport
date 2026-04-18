PRAGMA defer_foreign_keys = true;

CREATE TABLE IF NOT EXISTS stations (
  station_id TEXT PRIMARY KEY,
  station_name TEXT NOT NULL,
  region TEXT,
  control_level TEXT,
  phase TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  default_station_id TEXT,
  worker_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (default_station_id) REFERENCES stations(station_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_code TEXT NOT NULL,
  station_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_code, station_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE TABLE IF NOT EXISTS teams (
  team_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  owner_name TEXT,
  shift_code TEXT,
  team_status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE TABLE IF NOT EXISTS workers (
  worker_id TEXT PRIMARY KEY,
  user_id TEXT,
  station_id TEXT NOT NULL,
  team_id TEXT,
  worker_name TEXT NOT NULL,
  role_code TEXT NOT NULL,
  worker_status TEXT NOT NULL DEFAULT 'active',
  can_verify INTEGER NOT NULL DEFAULT 0,
  can_release INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS flights (
  flight_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  flight_no TEXT NOT NULL,
  flight_date TEXT NOT NULL,
  origin_code TEXT NOT NULL,
  destination_code TEXT NOT NULL,
  std_at TEXT,
  etd_at TEXT,
  sta_at TEXT,
  eta_at TEXT,
  actual_takeoff_at TEXT,
  actual_landed_at TEXT,
  runtime_status TEXT NOT NULL,
  service_level TEXT,
  aircraft_type TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_flights_station_date ON flights(station_id, flight_date);
CREATE INDEX IF NOT EXISTS idx_flights_station_status ON flights(station_id, runtime_status);

CREATE TABLE IF NOT EXISTS shipments (
  shipment_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  order_id TEXT,
  shipment_type TEXT,
  current_node TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL,
  promise_sla TEXT,
  service_level TEXT,
  total_pieces INTEGER,
  total_weight REAL,
  exception_count INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_shipments_station_status ON shipments(station_id, fulfillment_status);

CREATE TABLE IF NOT EXISTS awbs (
  awb_id TEXT PRIMARY KEY,
  awb_no TEXT NOT NULL UNIQUE,
  shipment_id TEXT NOT NULL,
  flight_id TEXT,
  station_id TEXT NOT NULL,
  hawb_no TEXT,
  shipper_name TEXT,
  consignee_name TEXT,
  notify_name TEXT,
  goods_description TEXT,
  pieces INTEGER NOT NULL,
  gross_weight REAL NOT NULL,
  current_node TEXT NOT NULL,
  noa_status TEXT NOT NULL DEFAULT 'Pending',
  pod_status TEXT NOT NULL DEFAULT 'Pending',
  transfer_status TEXT NOT NULL DEFAULT 'Pending',
  manifest_status TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id),
  FOREIGN KEY (flight_id) REFERENCES flights(flight_id),
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_awbs_station_flight ON awbs(station_id, flight_id);
CREATE INDEX IF NOT EXISTS idx_awbs_station_statuses ON awbs(station_id, noa_status, pod_status);

CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  related_object_type TEXT NOT NULL,
  related_object_id TEXT NOT NULL,
  parent_document_id TEXT,
  version_no TEXT NOT NULL DEFAULT 'v1',
  document_status TEXT NOT NULL,
  required_for_release INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  parsed_result_json TEXT,
  validation_result_json TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (parent_document_id) REFERENCES documents(document_id),
  FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_documents_related_object ON documents(related_object_type, related_object_id);
CREATE INDEX IF NOT EXISTS idx_documents_station_status ON documents(station_id, document_status);

CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  execution_node TEXT NOT NULL,
  related_object_type TEXT NOT NULL,
  related_object_id TEXT NOT NULL,
  assigned_role TEXT,
  assigned_team_id TEXT,
  assigned_worker_id TEXT,
  pick_location_id TEXT,
  drop_location_id TEXT,
  task_status TEXT NOT NULL,
  task_sla TEXT,
  due_at TEXT,
  blocker_code TEXT,
  evidence_required INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (assigned_team_id) REFERENCES teams(team_id),
  FOREIGN KEY (assigned_worker_id) REFERENCES workers(worker_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_station_status ON tasks(station_id, task_status);
CREATE INDEX IF NOT EXISTS idx_tasks_related_object ON tasks(related_object_type, related_object_id);

CREATE TABLE IF NOT EXISTS exceptions (
  exception_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  exception_type TEXT NOT NULL,
  related_object_type TEXT NOT NULL,
  related_object_id TEXT NOT NULL,
  linked_task_id TEXT,
  severity TEXT NOT NULL,
  owner_role TEXT,
  owner_team_id TEXT,
  exception_status TEXT NOT NULL,
  blocker_flag INTEGER NOT NULL DEFAULT 0,
  root_cause TEXT,
  action_taken TEXT,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (linked_task_id) REFERENCES tasks(task_id),
  FOREIGN KEY (owner_team_id) REFERENCES teams(team_id)
);

CREATE INDEX IF NOT EXISTS idx_exceptions_station_status ON exceptions(station_id, exception_status);
CREATE INDEX IF NOT EXISTS idx_exceptions_related_object ON exceptions(related_object_type, related_object_id);

CREATE TABLE IF NOT EXISTS audit_events (
  audit_id TEXT PRIMARY KEY,
  request_id TEXT,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  client_source TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(user_id),
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_station_created_at ON audit_events(station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_object ON audit_events(object_type, object_id);

CREATE TABLE IF NOT EXISTS state_transitions (
  transition_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  state_field TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  triggered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  audit_id TEXT,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (audit_id) REFERENCES audit_events(audit_id)
);

CREATE INDEX IF NOT EXISTS idx_state_transitions_object ON state_transitions(object_type, object_id, triggered_at DESC);
