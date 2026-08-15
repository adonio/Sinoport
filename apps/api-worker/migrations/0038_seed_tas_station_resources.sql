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
) VALUES (
  'TAS',
  '塔什干航空货站',
  '中亚',
  'strong_control',
  'active',
  'TAS',
  'UTTT',
  '卡车接收、逐件清点、ULD 组板、Manifest 冻结、航司交接、装机与起飞确认',
  'TAS Station Lead'
);

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
  ('TEAM-TAS-RECV', 'TAS', 'TAS Receiving Team', 'TAS Receiving Supervisor', 'DAY', 'active', 8, 'Truck Staging -> Piece Counting'),
  ('TEAM-TAS-BUILD', 'TAS', 'TAS Build-up Team', 'TAS Build-up Supervisor', 'SWING', 'active', 10, 'Piece Counting -> ULD Build-up -> Manifest'),
  ('TEAM-TAS-RAMP', 'TAS', 'TAS Ramp Team', 'TAS Ramp Supervisor', 'NIGHT', 'active', 12, 'Airline Handover -> Aircraft Loading -> Departure');

INSERT OR IGNORE INTO zones (
  zone_id,
  station_id,
  zone_type,
  linked_lane,
  zone_status,
  note
) VALUES
  ('TAS-STAGE-01', 'TAS', 'Staging', 'SZX-Dostyk-TAS Truck Lane', 'active', '卡车待接收与封志核验区'),
  ('TAS-BUILD-01', 'TAS', 'Build-up', 'TAS-LGG Export', 'active', '逐件清点与 ULD 组板区'),
  ('TAS-RAMP-01', 'TAS', 'Ramp Buffer', 'TAS-LGG Ramp', 'active', '航司交接与装机缓冲区');

INSERT OR IGNORE INTO platform_devices (
  device_id,
  station_id,
  device_type,
  binding_role,
  owner_team_id,
  device_status,
  note
) VALUES
  ('PDA-TAS-RECV-01', 'TAS', 'pda', 'export_receiver', 'TEAM-TAS-RECV', 'active', '卡车到场与逐件清点主终端'),
  ('SCN-TAS-BUILD-01', 'TAS', 'scanner', 'check_worker', 'TEAM-TAS-BUILD', 'active', 'ULD 逐件装载扫码枪'),
  ('TAB-TAS-RAMP-01', 'TAS', 'tablet', 'ramp_loader', 'TEAM-TAS-RAMP', 'active', '航司交接、装机和起飞确认终端');

INSERT OR IGNORE INTO user_roles (user_id, role_code, station_id) VALUES
  ('demo-supervisor', 'station_supervisor', 'TAS'),
  ('demo-supervisor', 'B1_TAS_STATION_CONTROLLER', 'TAS'),
  ('demo-mobile', 'mobile_operator', 'TAS'),
  ('demo-mobile', 'inbound_operator', 'TAS');
