ALTER TABLE stations ADD COLUMN airport_code TEXT;
ALTER TABLE stations ADD COLUMN icao_code TEXT;
ALTER TABLE stations ADD COLUMN service_scope TEXT;
ALTER TABLE stations ADD COLUMN owner_name TEXT;
ALTER TABLE stations ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_stations_region ON stations(region);
CREATE INDEX IF NOT EXISTS idx_stations_deleted_at ON stations(deleted_at);

UPDATE stations
SET
  airport_code = COALESCE(airport_code, station_id),
  service_scope = COALESCE(service_scope, '进港履约、二次转运、NOA、POD'),
  owner_name = COALESCE(owner_name, 'MME Station Lead'),
  updated_at = CURRENT_TIMESTAMP
WHERE station_id = 'MME';

INSERT OR IGNORE INTO stations (
  station_id,
  station_name,
  region,
  control_level,
  phase,
  airport_code,
  icao_code,
  service_scope,
  owner_name
) VALUES
  ('URC', '乌鲁木齐前置站', '中国西部', 'strong_control', 'active', 'URC', NULL, '出港前置、预报、收货、主单、发运', 'Platform Ops CN'),
  ('KGF', '中亚协同站', '中亚', 'collaborative_control', 'active', 'KGF', NULL, '飞行在途衔接、卡车分拨、状态回传', 'Regional Partner'),
  ('NVI', '中转衔接站', '中亚', 'collaborative_control', 'active', 'NVI', NULL, 'ETA 联动、落地准备、中转计划', 'Regional Partner'),
  ('RZE', '东欧入口站', '欧洲', 'collaborative_control', 'pending', 'RZE', 'EPRZ', '进港 handling、异常回传、区域交付', 'Expansion Team'),
  ('MST', '欧陆分拨站', '欧洲', 'collaborative_control', 'active', 'MST', NULL, '进港分拨、二次卡车转运、NOA', 'EU Ops'),
  ('BoH', '伯恩茅斯航站', '英国', 'interface_visible', 'active', 'BOH', NULL, 'Manifest、出港数据交换、到港回传', 'UK Partner');

INSERT OR IGNORE INTO user_roles (user_id, role_code, station_id)
VALUES ('demo-supervisor', 'platform_admin', 'MME');
