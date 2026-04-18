CREATE TABLE IF NOT EXISTS import_requests (
  request_id TEXT NOT NULL,
  import_type TEXT NOT NULL,
  station_id TEXT,
  actor_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  target_object_type TEXT,
  target_object_id TEXT,
  payload_json TEXT,
  result_json TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  PRIMARY KEY (request_id, import_type),
  FOREIGN KEY (actor_id) REFERENCES users(user_id),
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_import_requests_status ON import_requests(import_type, status, updated_at);
