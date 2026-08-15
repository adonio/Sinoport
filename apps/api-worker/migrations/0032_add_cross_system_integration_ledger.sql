CREATE TABLE IF NOT EXISTS integration_external_object_links (
  link_id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  object_type TEXT NOT NULL,
  local_object_id TEXT NOT NULL,
  external_object_id TEXT NOT NULL,
  natural_key TEXT,
  source_version INTEGER NOT NULL DEFAULT 0,
  last_event_id TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_system, object_type, external_object_id),
  UNIQUE(source_system, object_type, local_object_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_object_links_natural_key
  ON integration_external_object_links(source_system, object_type, natural_key);

CREATE TABLE IF NOT EXISTS integration_inbox_events (
  event_id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_sequence INTEGER NOT NULL,
  correlation_id TEXT,
  causation_id TEXT,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  signature_valid INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED',
  processed_at TEXT,
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  CHECK (processing_status IN ('RECEIVED', 'PROCESSING', 'APPLIED', 'IGNORED', 'FAILED', 'DEAD_LETTER')),
  UNIQUE(source_system, aggregate_type, aggregate_id, aggregate_sequence)
);

CREATE INDEX IF NOT EXISTS idx_integration_inbox_status
  ON integration_inbox_events(processing_status, received_at);
CREATE INDEX IF NOT EXISTS idx_integration_inbox_aggregate
  ON integration_inbox_events(source_system, aggregate_type, aggregate_id, aggregate_sequence);

CREATE TABLE IF NOT EXISTS integration_outbox_events (
  event_id TEXT PRIMARY KEY,
  target_system TEXT NOT NULL,
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_sequence INTEGER NOT NULL,
  correlation_id TEXT,
  causation_id TEXT,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  last_http_status INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (delivery_status IN ('PENDING', 'DELIVERING', 'DELIVERED', 'FAILED', 'DEAD_LETTER')),
  UNIQUE(target_system, aggregate_type, aggregate_id, aggregate_sequence)
);

CREATE INDEX IF NOT EXISTS idx_integration_outbox_dispatch
  ON integration_outbox_events(target_system, delivery_status, next_attempt_at);

CREATE TABLE IF NOT EXISTS integration_delivery_attempts (
  attempt_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES integration_outbox_events(event_id),
  UNIQUE(event_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS integration_checkpoints (
  checkpoint_id TEXT PRIMARY KEY,
  peer_system TEXT NOT NULL,
  direction TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  last_event_id TEXT,
  watermark_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  UNIQUE(peer_system, direction, aggregate_type)
);

CREATE TABLE IF NOT EXISTS integration_reconciliation_runs (
  reconciliation_run_id TEXT PRIMARY KEY,
  peer_system TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT,
  watermark_from TEXT,
  watermark_to TEXT,
  local_count INTEGER NOT NULL DEFAULT 0,
  peer_count INTEGER NOT NULL DEFAULT 0,
  local_hash TEXT,
  peer_hash TEXT,
  mismatch_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  details_json TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  CHECK (status IN ('RUNNING', 'MATCHED', 'MISMATCH', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_integration_reconciliation_scope
  ON integration_reconciliation_runs(peer_system, scope_type, scope_id, started_at DESC);
