ALTER TABLE awbs ADD COLUMN awb_type TEXT NOT NULL DEFAULT 'IMPORT';
ALTER TABLE awbs ADD COLUMN deleted_at TEXT;

UPDATE awbs
SET awb_type = CASE
  WHEN shipment_id IN (
    SELECT shipment_id FROM shipments WHERE COALESCE(shipment_type, 'import') = 'export'
  ) THEN 'EXPORT'
  ELSE 'IMPORT'
END
WHERE awb_type IS NULL OR awb_type = '';

CREATE INDEX IF NOT EXISTS idx_awbs_station_deleted_at
  ON awbs(station_id, deleted_at);

CREATE TABLE IF NOT EXISTS station_waybill_awb_type_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO station_waybill_awb_type_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('IMPORT', '进港提单', 10, 0),
  ('EXPORT', '出港提单', 20, 0),
  ('TRANSFER', '转运提单', 30, 0),
  ('SPECIAL', '特种提单', 40, 0);

CREATE TABLE IF NOT EXISTS station_inbound_waybill_node_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO station_inbound_waybill_node_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('Pre-Arrival', '待到达', 10, 0),
  ('Landed', '已落地', 20, 0),
  ('Inbound Handling', '进港处理中', 30, 0),
  ('Tail-Linehaul In Transit', '尾程转运中', 40, 0),
  ('Delivered', '已交付', 50, 0),
  ('Closed', '已关闭', 60, 0);

CREATE TABLE IF NOT EXISTS station_inbound_waybill_noa_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO station_inbound_waybill_noa_status_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('Pending', '待处理', 10, 0),
  ('Sent', '已发送', 20, 0),
  ('Failed', '发送失败', 30, 0);

CREATE TABLE IF NOT EXISTS station_inbound_waybill_pod_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO station_inbound_waybill_pod_status_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('Pending', '待补签', 10, 0),
  ('Uploaded', '已上传', 20, 0),
  ('Released', '已归档', 30, 0);

CREATE TABLE IF NOT EXISTS station_inbound_waybill_transfer_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO station_inbound_waybill_transfer_status_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('Pending', '待处理', 10, 0),
  ('Planned', '已计划', 20, 0),
  ('In Transit', '转运中', 30, 0),
  ('Completed', '已完成', 40, 0);

CREATE TABLE IF NOT EXISTS station_outbound_waybill_node_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO station_outbound_waybill_node_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('Forecast Planned', '预报待处理', 10, 0),
  ('Receipt Planned', '收货待处理', 20, 0),
  ('Loaded Preparation', '待装载', 30, 0),
  ('Loaded', '已装载', 40, 0),
  ('Airborne', '已飞走', 50, 0),
  ('Closed', '已关闭', 60, 0);

CREATE TABLE IF NOT EXISTS station_outbound_waybill_manifest_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO station_outbound_waybill_manifest_status_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('Draft', '待生成', 10, 0),
  ('Uploaded', '已上传', 20, 0),
  ('Released', '已发布', 30, 0),
  ('Archived', '已归档', 40, 0);
