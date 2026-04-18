ALTER TABLE outbound_receipts ADD COLUMN reviewed_weight REAL NOT NULL DEFAULT 0;
ALTER TABLE outbound_receipts ADD COLUMN review_status TEXT NOT NULL DEFAULT '待复核';
ALTER TABLE outbound_receipts ADD COLUMN reviewed_at TEXT;
ALTER TABLE outbound_receipts ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_outbound_receipts_deleted_at
  ON outbound_receipts(station_id, flight_no, deleted_at);

ALTER TABLE outbound_containers ADD COLUMN offload_boxes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outbound_containers ADD COLUMN offload_status TEXT NOT NULL DEFAULT '无拉货';
ALTER TABLE outbound_containers ADD COLUMN offload_recorded_at TEXT;
ALTER TABLE outbound_containers ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_outbound_containers_deleted_at
  ON outbound_containers(station_id, flight_no, deleted_at);

CREATE TABLE IF NOT EXISTS station_mobile_outbound_receipt_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR REPLACE INTO station_mobile_outbound_receipt_status_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('待收货', '待收货', 10, 0),
  ('已收货', '已收货', 20, 0),
  ('已复核', '已复核', 30, 0);

CREATE TABLE IF NOT EXISTS station_mobile_outbound_review_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR REPLACE INTO station_mobile_outbound_review_status_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('待复核', '待复核', 10, 0),
  ('已复核', '已复核', 20, 0);

CREATE TABLE IF NOT EXISTS station_mobile_outbound_container_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR REPLACE INTO station_mobile_outbound_container_status_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('待装机', '待装机', 10, 0),
  ('已装机', '已装机', 20, 0),
  ('已回退', '已回退', 30, 0);

CREATE TABLE IF NOT EXISTS station_mobile_outbound_offload_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR REPLACE INTO station_mobile_outbound_offload_status_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('无拉货', '无拉货', 10, 0),
  ('已拉货', '已拉货', 20, 0);
