ALTER TABLE inbound_count_records ADD COLUMN deleted_at TEXT;

ALTER TABLE inbound_pallets ADD COLUMN loaded_plate TEXT;
ALTER TABLE inbound_pallets ADD COLUMN loaded_at TEXT;
ALTER TABLE inbound_pallets ADD COLUMN deleted_at TEXT;

ALTER TABLE loading_plans ADD COLUMN completed_at TEXT;
ALTER TABLE loading_plans ADD COLUMN deleted_at TEXT;

CREATE TABLE IF NOT EXISTS station_inbound_count_status_options (
  option_value TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS station_inbound_pallet_status_options (
  option_value TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS station_inbound_loading_plan_status_options (
  option_value TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS station_inbound_storage_location_options (
  option_value TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO station_inbound_count_status_options (option_value, option_label, sort_order, disabled, meta_json, updated_at) VALUES
  ('未开始', '未开始', 10, 0, '{"terminal":false,"reopenable":true}', CURRENT_TIMESTAMP),
  ('点货中', '点货中', 20, 0, '{"terminal":false,"reopenable":true}', CURRENT_TIMESTAMP),
  ('暂时挂起', '暂时挂起', 30, 0, '{"terminal":false,"reopenable":true}', CURRENT_TIMESTAMP),
  ('理货完成', '理货完成', 40, 0, '{"terminal":true,"reopenable":true}', CURRENT_TIMESTAMP),
  ('已作废', '已作废', 50, 0, '{"terminal":true,"reopenable":true}', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO station_inbound_pallet_status_options (option_value, option_label, sort_order, disabled, meta_json, updated_at) VALUES
  ('计划', '计划', 10, 0, '{"terminal":false,"reopenable":true}', CURRENT_TIMESTAMP),
  ('组托中', '组托中', 20, 0, '{"terminal":false,"reopenable":true}', CURRENT_TIMESTAMP),
  ('待装车', '待装车', 30, 0, '{"terminal":false,"reopenable":true}', CURRENT_TIMESTAMP),
  ('已装车', '已装车', 40, 0, '{"terminal":true,"reopenable":true}', CURRENT_TIMESTAMP),
  ('已作废', '已作废', 50, 0, '{"terminal":true,"reopenable":true}', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO station_inbound_loading_plan_status_options (option_value, option_label, sort_order, disabled, meta_json, updated_at) VALUES
  ('计划', '计划', 10, 0, '{"terminal":false,"reopenable":true}', CURRENT_TIMESTAMP),
  ('装车中', '装车中', 20, 0, '{"terminal":false,"reopenable":true}', CURRENT_TIMESTAMP),
  ('已完成', '已完成', 30, 0, '{"terminal":true,"reopenable":true}', CURRENT_TIMESTAMP),
  ('已作废', '已作废', 40, 0, '{"terminal":true,"reopenable":true}', CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO station_inbound_storage_location_options (option_value, option_label, sort_order, disabled, meta_json, updated_at) VALUES
  ('MME-STAGE-01', 'MME-STAGE-01', 10, 0, '{"zone":"MME Stage","station_id":"MME"}', CURRENT_TIMESTAMP),
  ('MME-STAGE-02', 'MME-STAGE-02', 20, 0, '{"zone":"MME Stage","station_id":"MME"}', CURRENT_TIMESTAMP),
  ('MME-STAGE-03', 'MME-STAGE-03', 30, 0, '{"zone":"MME Stage","station_id":"MME"}', CURRENT_TIMESTAMP),
  ('MME-STAGE-11', 'MME-STAGE-11', 40, 0, '{"zone":"MME Stage","station_id":"MME"}', CURRENT_TIMESTAMP),
  ('MME-STAGE-12', 'MME-STAGE-12', 50, 0, '{"zone":"MME Stage","station_id":"MME"}', CURRENT_TIMESTAMP),
  ('MME-STAGE-21', 'MME-STAGE-21', 60, 0, '{"zone":"MME Stage","station_id":"MME"}', CURRENT_TIMESTAMP),
  ('MME-STAGE-22', 'MME-STAGE-22', 70, 0, '{"zone":"MME Stage","station_id":"MME"}', CURRENT_TIMESTAMP),
  ('MME-STAGE-31', 'MME-STAGE-31', 80, 0, '{"zone":"MME Stage","station_id":"MME"}', CURRENT_TIMESTAMP),
  ('MME-STAGE-32', 'MME-STAGE-32', 90, 0, '{"zone":"MME Stage","station_id":"MME"}', CURRENT_TIMESTAMP);

UPDATE inbound_count_records
SET deleted_at = COALESCE(deleted_at, NULL),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);

UPDATE inbound_pallets
SET loaded_plate = COALESCE(loaded_plate, NULL),
    loaded_at = COALESCE(loaded_at, NULL),
    deleted_at = COALESCE(deleted_at, NULL),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);

UPDATE loading_plans
SET completed_at = CASE WHEN plan_status = '已完成' AND completed_at IS NULL THEN updated_at ELSE completed_at END,
    deleted_at = COALESCE(deleted_at, NULL),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
