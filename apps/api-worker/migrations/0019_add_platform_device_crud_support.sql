CREATE TABLE IF NOT EXISTS device_type_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_role_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_devices (
  device_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'pda',
  binding_role TEXT NOT NULL,
  owner_team_id TEXT NOT NULL,
  device_status TEXT NOT NULL DEFAULT 'active',
  note TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (owner_team_id) REFERENCES teams(team_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_devices_station_id ON platform_devices(station_id);
CREATE INDEX IF NOT EXISTS idx_platform_devices_owner_team_id ON platform_devices(owner_team_id);
CREATE INDEX IF NOT EXISTS idx_platform_devices_status ON platform_devices(device_status);
CREATE INDEX IF NOT EXISTS idx_platform_devices_deleted_at ON platform_devices(deleted_at);

INSERT OR IGNORE INTO device_type_options (option_key, option_label, sort_order) VALUES
  ('pda', 'PDA', 10),
  ('scanner', '扫码枪', 20),
  ('printer', '打印终端', 30),
  ('tablet', '平板终端', 40),
  ('workstation', '固定工位终端', 50);

INSERT OR IGNORE INTO device_role_options (option_key, option_label, sort_order) VALUES
  ('export_receiver', '出港收货', 10),
  ('ramp_loader', '机坪装卸', 20),
  ('breakdown_worker', '进港拆板', 30),
  ('check_worker', '理货复核', 40),
  ('delivery_desk', '交付文员', 50),
  ('station_supervisor', '站点主管', 60);

INSERT OR IGNORE INTO device_status_options (option_key, option_label, sort_order) VALUES
  ('active', '运行中', 10),
  ('standby', '待命', 20),
  ('maintenance', '维护中', 30),
  ('offline', '停用', 40),
  ('archived', '已归档', 50);

INSERT OR IGNORE INTO platform_devices (
  device_id,
  station_id,
  device_type,
  binding_role,
  owner_team_id,
  device_status,
  note
) VALUES
  ('PDA-MME-01', 'MME', 'pda', 'breakdown_worker', 'TEAM-IN-01', 'active', '进港拆板主终端'),
  ('PDA-MME-02', 'MME', 'pda', 'delivery_desk', 'TEAM-DD-01', 'active', '交付签收终端'),
  ('PDA-MME-03', 'MME', 'scanner', 'check_worker', 'TEAM-CK-01', 'standby', '理货复核备用设备'),
  ('PDA-MME-RAMP-01', 'MME', 'tablet', 'ramp_loader', 'TEAM-MME-RAMP', 'maintenance', '机坪平板终端'),
  ('PDA-URC-01', 'URC', 'pda', 'export_receiver', 'TEAM-URC-EXP', 'active', 'URC 出港收货 PDA'),
  ('PDA-URC-02', 'URC', 'scanner', 'ramp_loader', 'TEAM-URC-EXP', 'standby', 'URC 机坪扫码枪'),
  ('PDA-RZE-SETUP-01', 'RZE', 'workstation', 'station_supervisor', 'TEAM-RZE-SETUP', 'offline', 'RZE 建设期配置工位');
