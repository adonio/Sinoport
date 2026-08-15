CREATE TABLE IF NOT EXISTS control_tasks (
  control_task_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operation_control_plan_id TEXT,
  task_type TEXT NOT NULL,
  related_object_type TEXT NOT NULL,
  related_object_id TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'WARNING',
  status TEXT NOT NULL DEFAULT 'OPEN',
  due_at TEXT NOT NULL,
  source_fact_at TEXT,
  reason_code TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  resolved_at TEXT,
  resolved_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED')),
  UNIQUE(tenant_id, task_type, related_object_type, related_object_id, reason_code, due_at),
  FOREIGN KEY (operation_control_plan_id) REFERENCES operation_control_plans(operation_control_plan_id)
);

CREATE INDEX IF NOT EXISTS idx_control_tasks_plan_status
  ON control_tasks(operation_control_plan_id, status, due_at);

CREATE TABLE IF NOT EXISTS gate_reconciliation_checks (
  gate_reconciliation_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operation_control_plan_id TEXT NOT NULL,
  gate_code TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  rule_version TEXT NOT NULL DEFAULT 'V14-GATES-1',
  deterministic_hash TEXT NOT NULL,
  checked_by TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  CHECK (gate_code IN ('GATE_A', 'GATE_B', 'GATE_C', 'GATE_D', 'GATE_E', 'LABEL_ACCOUNTING')),
  CHECK (status IN ('PASS', 'BLOCKED')),
  FOREIGN KEY (operation_control_plan_id) REFERENCES operation_control_plans(operation_control_plan_id)
);

CREATE INDEX IF NOT EXISTS idx_gate_reconciliation_plan_gate
  ON gate_reconciliation_checks(operation_control_plan_id, gate_code, checked_at DESC);

CREATE TABLE IF NOT EXISTS flight_label_ledgers (
  label_ledger_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  flight_id TEXT NOT NULL,
  operation_control_plan_id TEXT NOT NULL,
  printed_count INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  void_count INTEGER NOT NULL DEFAULT 0,
  remaining_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'BLOCKED',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  maintained_by TEXT NOT NULL,
  approved_by TEXT,
  version_no INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('PASS', 'BLOCKED')),
  CHECK (printed_count >= 0 AND used_count >= 0 AND void_count >= 0 AND remaining_count >= 0),
  UNIQUE(flight_id, version_no),
  FOREIGN KEY (flight_id) REFERENCES flights(flight_id),
  FOREIGN KEY (operation_control_plan_id) REFERENCES operation_control_plans(operation_control_plan_id)
);

CREATE TABLE IF NOT EXISTS control_input_signals (
  control_input_signal_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operation_control_plan_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  source_channel TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  must_record_by TEXT NOT NULL,
  decision_record_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_RECORD',
  payload_json TEXT NOT NULL DEFAULT '{}',
  submitted_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('PENDING_RECORD', 'RECORDED', 'OVERDUE', 'CANCELLED')),
  FOREIGN KEY (operation_control_plan_id) REFERENCES operation_control_plans(operation_control_plan_id),
  FOREIGN KEY (decision_record_id) REFERENCES decision_records(decision_record_id)
);

CREATE INDEX IF NOT EXISTS idx_control_input_signals_due
  ON control_input_signals(operation_control_plan_id, status, must_record_by);

CREATE TABLE IF NOT EXISTS geofence_candidates (
  geofence_candidate_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  transport_job_id TEXT NOT NULL,
  checkpoint_instance_id TEXT NOT NULL,
  location_event_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  distance_m REAL,
  generated_at TEXT NOT NULL,
  confirmed_at TEXT,
  confirmed_by TEXT,
  CHECK (status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'EXPIRED')),
  UNIQUE(checkpoint_instance_id, location_event_id),
  FOREIGN KEY (transport_job_id) REFERENCES transport_jobs(transport_job_id),
  FOREIGN KEY (checkpoint_instance_id) REFERENCES checkpoint_instances(checkpoint_instance_id),
  FOREIGN KEY (location_event_id) REFERENCES location_events(location_event_id)
);
