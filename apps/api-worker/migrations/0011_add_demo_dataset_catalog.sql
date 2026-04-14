CREATE TABLE IF NOT EXISTS demo_datasets (
  dataset_key TEXT PRIMARY KEY,
  source_module TEXT NOT NULL,
  export_name TEXT NOT NULL,
  payload_kind TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demo_datasets_source_module
  ON demo_datasets(source_module, export_name);
