CREATE TABLE IF NOT EXISTS station_credentials (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  login_name TEXT NOT NULL UNIQUE,
  password_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS station_refresh_tokens (
  refresh_token_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  client_source TEXT NOT NULL,
  token_value TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_station_refresh_tokens_user_active
  ON station_refresh_tokens(user_id, station_id, revoked_at, expires_at DESC);

CREATE TABLE IF NOT EXISTS upload_tickets (
  upload_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  related_object_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER,
  checksum_sha256 TEXT,
  retention_class TEXT NOT NULL DEFAULT 'operational',
  storage_key TEXT NOT NULL UNIQUE,
  upload_token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  uploaded_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_upload_tickets_station_expiry
  ON upload_tickets(station_id, expires_at DESC);

ALTER TABLE documents ADD COLUMN content_type TEXT;
ALTER TABLE documents ADD COLUMN size_bytes INTEGER;
ALTER TABLE documents ADD COLUMN checksum_sha256 TEXT;
ALTER TABLE documents ADD COLUMN retention_class TEXT NOT NULL DEFAULT 'operational';
ALTER TABLE documents ADD COLUMN deleted_at TEXT;
ALTER TABLE documents ADD COLUMN upload_id TEXT;

CREATE TABLE IF NOT EXISTS agent_sessions (
  session_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  object_type TEXT,
  object_key TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (actor_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS agent_messages (
  message_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session_created_at
  ON agent_messages(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_runs (
  run_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  tool_name TEXT,
  input_json TEXT,
  output_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_session_created_at
  ON agent_runs(session_id, created_at DESC);
