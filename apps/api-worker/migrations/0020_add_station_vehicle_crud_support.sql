CREATE TABLE IF NOT EXISTS truck_route_type_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS truck_dispatch_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS truck_priority_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE trucks ADD COLUMN route_label TEXT;
ALTER TABLE trucks ADD COLUMN collection_note TEXT;
ALTER TABLE trucks ADD COLUMN priority_code TEXT NOT NULL DEFAULT 'P2';
ALTER TABLE trucks ADD COLUMN sla_text TEXT;
ALTER TABLE trucks ADD COLUMN office_plan TEXT;
ALTER TABLE trucks ADD COLUMN pda_execution TEXT;
ALTER TABLE trucks ADD COLUMN awb_list_json TEXT;
ALTER TABLE trucks ADD COLUMN pallet_list_json TEXT;
ALTER TABLE trucks ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_trucks_deleted_at ON trucks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_trucks_station_route_type ON trucks(station_id, route_type);
CREATE INDEX IF NOT EXISTS idx_trucks_station_priority ON trucks(station_id, priority_code);

INSERT OR IGNORE INTO truck_route_type_options (option_key, option_label, sort_order) VALUES
  ('headhaul', '头程', 10),
  ('tailhaul', '尾程', 20),
  ('shuttle', '短驳', 30),
  ('linehaul', '干线', 40);

INSERT OR IGNORE INTO truck_dispatch_status_options (option_key, option_label, sort_order) VALUES
  ('pending_dispatch', '待发车', 10),
  ('in_transit', '在途', 20),
  ('arrived', '已到站', 30),
  ('completed', '已完成', 40),
  ('archived', '已归档', 50);

INSERT OR IGNORE INTO truck_priority_options (option_key, option_label, sort_order) VALUES
  ('P1', 'P1', 10),
  ('P2', 'P2', 20),
  ('P3', 'P3', 30);

UPDATE trucks
SET route_type = CASE LOWER(COALESCE(route_type, ''))
  WHEN 'tailhaul' THEN 'tailhaul'
  WHEN 'headhaul' THEN 'headhaul'
  WHEN 'planned' THEN 'headhaul'
  ELSE COALESCE(NULLIF(LOWER(route_type), ''), 'headhaul')
END,
dispatch_status = CASE LOWER(COALESCE(dispatch_status, ''))
  WHEN 'planned' THEN 'pending_dispatch'
  WHEN 'pending' THEN 'pending_dispatch'
  WHEN '待发车' THEN 'pending_dispatch'
  WHEN 'in transit' THEN 'in_transit'
  WHEN 'running' THEN 'in_transit'
  WHEN '运行中' THEN 'in_transit'
  WHEN 'arrived' THEN 'arrived'
  WHEN '到站' THEN 'arrived'
  WHEN 'completed' THEN 'completed'
  WHEN 'done' THEN 'completed'
  WHEN '已完成' THEN 'completed'
  WHEN 'archived' THEN 'archived'
  ELSE COALESCE(NULLIF(LOWER(dispatch_status), ''), 'pending_dispatch')
END,
priority_code = CASE UPPER(COALESCE(priority_code, ''))
  WHEN 'P1' THEN 'P1'
  WHEN 'P3' THEN 'P3'
  ELSE 'P2'
END,
updated_at = CURRENT_TIMESTAMP;

UPDATE trucks
SET route_label = COALESCE(route_label, CASE route_type
  WHEN 'tailhaul' THEN station_id || ' -> Delivery'
  WHEN 'shuttle' THEN station_id || ' 站内短驳'
  WHEN 'linehaul' THEN station_id || ' 干线转运'
  ELSE station_id || ' -> Cargo Terminal'
END),
collection_note = COALESCE(collection_note, 'CN-' || truck_id),
sla_text = COALESCE(sla_text, '待补充'),
office_plan = COALESCE(office_plan, '后台已完成 Trip 编排。'),
pda_execution = COALESCE(pda_execution, '现场执行发车、到站交接'),
awb_list_json = COALESCE(awb_list_json, '[]'),
pallet_list_json = COALESCE(pallet_list_json, '[]'),
updated_at = CURRENT_TIMESTAMP;

INSERT OR IGNORE INTO trucks (
  truck_id,
  station_id,
  plate_no,
  driver_name,
  route_type,
  route_label,
  collection_note,
  dispatch_status,
  priority_code,
  sla_text,
  office_plan,
  pda_execution,
  awb_list_json,
  pallet_list_json
) VALUES
  (
    'TRIP-MME-HEAD-001',
    'MME',
    'MME-TRK-101',
    'Office Driver A',
    'headhaul',
    'MME -> 出港货站',
    'CN-MME-001',
    'pending_dispatch',
    'P1',
    '收货完成后 20 分钟',
    '后台已锁定发车窗口，CMR 已生成。',
    '司机到场确认、发车、到站交接',
    '["436-10358585","436-10359044","436-10359218"]',
    '[]'
  ),
  (
    'TRIP-MME-TAIL-002',
    'MME',
    'MME-TRK-205',
    'Office Driver B',
    'tailhaul',
    'MME -> Delivery',
    'CN-MME-002',
    'in_transit',
    'P2',
    '在途回传每 30 分钟',
    '后台已下发到站窗口。',
    '在途回传、到站交接',
    '["436-10359301","436-10359512"]',
    '[]'
  ),
  (
    'TRIP-URC-HEAD-001',
    'URC',
    'URC-TRK-309',
    'URC Export Driver',
    'headhaul',
    'URC -> 出港货站',
    'CN-URC-001',
    'pending_dispatch',
    'P1',
    '收货完成后 20 分钟',
    '后台已完成 Trip 编排。',
    '现场执行发车、到站交接',
    '["436-10360001","436-10360002"]',
    '[]'
  );

UPDATE trucks
SET route_type = 'tailhaul',
    route_label = 'MME -> Delivery',
    collection_note = COALESCE(collection_note, 'CN-TRK-0406-018'),
    dispatch_status = 'pending_dispatch',
    priority_code = 'P2',
    sla_text = COALESCE(sla_text, '待补充'),
    office_plan = COALESCE(office_plan, '后台已完成 Trip 编排。'),
    pda_execution = COALESCE(pda_execution, '现场执行发车、到站交接'),
    awb_list_json = COALESCE(awb_list_json, '[]'),
    pallet_list_json = COALESCE(pallet_list_json, '[]'),
    updated_at = CURRENT_TIMESTAMP
WHERE truck_id = 'TRK-0406-018';
