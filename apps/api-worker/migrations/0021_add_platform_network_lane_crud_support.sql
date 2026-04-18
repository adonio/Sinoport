CREATE TABLE IF NOT EXISTS network_lane_control_depth_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS network_lane_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS network_lanes (
  lane_id TEXT PRIMARY KEY,
  lane_name TEXT NOT NULL,
  business_mode TEXT,
  origin_station_id TEXT NOT NULL,
  via_station_id TEXT,
  destination_station_id TEXT NOT NULL,
  node_order TEXT NOT NULL,
  key_events TEXT,
  sla_text TEXT NOT NULL,
  control_depth TEXT NOT NULL,
  lane_status TEXT NOT NULL DEFAULT 'active',
  note TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (origin_station_id) REFERENCES stations(station_id),
  FOREIGN KEY (via_station_id) REFERENCES stations(station_id),
  FOREIGN KEY (destination_station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_network_lanes_origin_station_id ON network_lanes(origin_station_id);
CREATE INDEX IF NOT EXISTS idx_network_lanes_destination_station_id ON network_lanes(destination_station_id);
CREATE INDEX IF NOT EXISTS idx_network_lanes_via_station_id ON network_lanes(via_station_id);
CREATE INDEX IF NOT EXISTS idx_network_lanes_control_depth ON network_lanes(control_depth);
CREATE INDEX IF NOT EXISTS idx_network_lanes_lane_status ON network_lanes(lane_status);
CREATE INDEX IF NOT EXISTS idx_network_lanes_deleted_at ON network_lanes(deleted_at);

INSERT OR IGNORE INTO network_lane_control_depth_options (option_key, option_label, sort_order) VALUES
  ('strong_control', '强控制', 10),
  ('collaborative_control', '协同控制', 20),
  ('external_coordination', '外部协同', 30);

INSERT OR IGNORE INTO network_lane_status_options (option_key, option_label, sort_order) VALUES
  ('active', '运行中', 10),
  ('onboarding', '接入中', 20),
  ('paused', '暂停', 30),
  ('archived', '已归档', 40);

INSERT OR IGNORE INTO network_lanes (
  lane_id,
  lane_name,
  business_mode,
  origin_station_id,
  via_station_id,
  destination_station_id,
  node_order,
  key_events,
  sla_text,
  control_depth,
  lane_status,
  note
) VALUES
  (
    'LANE-URC-MME-01',
    'URC -> MME -> Delivery',
    '样板站优先链路',
    'URC',
    NULL,
    'MME',
    '前置仓 -> 头程卡车 -> 出港货站 -> 出港机坪 -> Flight -> 进港机坪 -> 进港货站 -> 尾程装车 -> 交付仓',
    'FFM, UWS, NOA, POD',
    '48-60h',
    'strong_control',
    'active',
    '一期样板链路，覆盖 URC 到 MME 的强控制履约。'
  ),
  (
    'LANE-URC-MST-01',
    'URC -> MST',
    '电商普货主线',
    'URC',
    NULL,
    'MST',
    '前置仓 -> 出港货站 -> Flight -> 进港货站',
    'FFM, UWS, Manifest, POD',
    '72h',
    'collaborative_control',
    'active',
    '标准普货协同链路。'
  ),
  (
    'LANE-URC-MST-RZE-01',
    'URC -> MST -> RZE',
    '东欧入口协同链路',
    'URC',
    'MST',
    'RZE',
    '前置仓 -> 出港货站 -> Flight -> 欧陆分拨 -> 东欧入口站',
    'FFM, UWS, Manifest, Exception',
    '72-96h',
    'collaborative_control',
    'onboarding',
    'RZE 接入阶段链路，用于平台网络扩展准备。'
  );
