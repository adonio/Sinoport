CREATE TABLE IF NOT EXISTS team_shift_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE teams ADD COLUMN headcount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE teams ADD COLUMN mapped_lanes TEXT;
ALTER TABLE teams ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_teams_station_id ON teams(station_id);
CREATE INDEX IF NOT EXISTS idx_teams_deleted_at ON teams(deleted_at);

INSERT OR IGNORE INTO team_shift_options (option_key, option_label, sort_order) VALUES
  ('DAY', '白班', 10),
  ('SWING', '中班', 20),
  ('NIGHT', '夜班', 30),
  ('FLEX', '待定', 40);

INSERT OR IGNORE INTO team_status_options (option_key, option_label, sort_order) VALUES
  ('active', '运行中', 10),
  ('onboarding', '接入中', 20),
  ('paused', '暂停', 30),
  ('archived', '已归档', 40);

UPDATE teams
SET headcount = CASE team_id
  WHEN 'TEAM-IN-01' THEN 12
  WHEN 'TEAM-CK-01' THEN 6
  WHEN 'TEAM-DD-01' THEN 5
  ELSE headcount
END,
mapped_lanes = CASE team_id
  WHEN 'TEAM-IN-01' THEN 'Flight -> Inbound -> Delivery'
  WHEN 'TEAM-CK-01' THEN '理货复核 / NOA 放行'
  WHEN 'TEAM-DD-01' THEN 'Delivery / POD'
  ELSE mapped_lanes
END,
updated_at = CURRENT_TIMESTAMP
WHERE team_id IN ('TEAM-IN-01', 'TEAM-CK-01', 'TEAM-DD-01');

INSERT OR IGNORE INTO teams (
  team_id,
  station_id,
  team_name,
  owner_name,
  shift_code,
  team_status,
  headcount,
  mapped_lanes
) VALUES
  ('TEAM-URC-EXP', 'URC', 'URC Export Team', 'URC Export Supervisor', 'NIGHT', 'active', 18, 'URC -> MME / MST'),
  ('TEAM-RZE-SETUP', 'RZE', 'RZE Setup Team', 'RZE Station Lead', 'FLEX', 'onboarding', 4, 'RZE 接入准备'),
  ('TEAM-MME-RAMP', 'MME', 'MME Ramp Team', 'Ramp Supervisor', 'SWING', 'active', 8, 'Inbound Ramp / Tailhaul');
