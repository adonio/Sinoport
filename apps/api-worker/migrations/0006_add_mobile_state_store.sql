CREATE TABLE IF NOT EXISTS mobile_state_store (
  station_id TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  state_json TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (station_id, scope_key),
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_state_store_station_updated_at
  ON mobile_state_store(station_id, updated_at DESC);
