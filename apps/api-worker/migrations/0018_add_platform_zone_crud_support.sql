CREATE TABLE IF NOT EXISTS zone_type_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS zone_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS zones (
  zone_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  zone_type TEXT NOT NULL,
  linked_lane TEXT,
  zone_status TEXT NOT NULL DEFAULT 'active',
  note TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_zones_station_id ON zones(station_id);
CREATE INDEX IF NOT EXISTS idx_zones_status ON zones(zone_status);
CREATE INDEX IF NOT EXISTS idx_zones_deleted_at ON zones(deleted_at);

INSERT OR IGNORE INTO zone_type_options (option_key, option_label, sort_order) VALUES
  ('Build-up', 'Build-up', 10),
  ('Ramp Buffer', 'Ramp Buffer', 20),
  ('Breakdown', 'Breakdown', 30),
  ('Delivery', 'Delivery', 40),
  ('Dispatch', 'Dispatch', 50),
  ('Staging', 'Staging', 60);

INSERT OR IGNORE INTO zone_status_options (option_key, option_label, sort_order) VALUES
  ('active', '运行中', 10),
  ('warning', '警戒', 20),
  ('inactive', '停用', 30),
  ('pending', '待处理', 40),
  ('archived', '已归档', 50);

INSERT OR IGNORE INTO zones (
  zone_id,
  station_id,
  zone_type,
  linked_lane,
  zone_status,
  note
) VALUES
  ('URC-BUILD-01', 'URC', 'Build-up', 'URC Export', 'active', '出口组板区'),
  ('URC-RAMP-02', 'URC', 'Ramp Buffer', 'URC Ramp', 'warning', '机坪缓存区'),
  ('MME-INB-01', 'MME', 'Breakdown', 'MME Inbound', 'active', '进港拆板区'),
  ('MME-DLV-03', 'MME', 'Delivery', 'Tailhaul / Delivery', 'active', '尾程交付区');
