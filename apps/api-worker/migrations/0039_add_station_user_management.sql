ALTER TABLE station_credentials ADD COLUMN station_id TEXT;
ALTER TABLE station_credentials ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE station_credentials ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE station_credentials ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE station_credentials ADD COLUMN locked_until TEXT;
ALTER TABLE station_credentials ADD COLUMN last_login_at TEXT;
ALTER TABLE station_credentials ADD COLUMN created_by TEXT;
ALTER TABLE station_credentials ADD COLUMN disabled_at TEXT;

UPDATE station_credentials
SET station_id = COALESCE(
  (SELECT default_station_id FROM users WHERE users.user_id = station_credentials.user_id),
  (SELECT station_id FROM user_roles WHERE user_roles.user_id = station_credentials.user_id AND station_id IS NOT NULL LIMIT 1),
  'MME'
)
WHERE station_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_station_credentials_station_status
  ON station_credentials(station_id, account_status, login_name);

INSERT OR IGNORE INTO user_roles (user_id, role_code, station_id) VALUES
  ('demo-supervisor', 'station_admin', 'MME');
