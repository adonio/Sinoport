CREATE TABLE IF NOT EXISTS station_exception_archive_state (
  exception_id TEXT PRIMARY KEY,
  deleted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exception_id) REFERENCES exceptions(exception_id)
);

CREATE INDEX IF NOT EXISTS idx_exception_archive_deleted_at
  ON station_exception_archive_state(deleted_at);

CREATE INDEX IF NOT EXISTS idx_exceptions_station_owner_status
  ON exceptions(station_id, owner_role, exception_status);

CREATE TABLE IF NOT EXISTS station_exception_type_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_exception_severity_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_exception_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_exception_owner_role_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_exception_related_object_type_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_exception_blocker_state_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR REPLACE INTO station_exception_type_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('PiecesMismatch', '件数差异', 10, 0),
  ('MissingDocument', '缺失单证', 20, 0),
  ('TruckDelay', '车辆延误', 30, 0),
  ('ReceiptMismatch', '收货差异', 40, 0),
  ('ManifestGap', '舱单差异', 50, 0),
  ('TaskIssue', '任务异常', 60, 0),
  ('Other', '其他异常', 70, 0);

INSERT OR REPLACE INTO station_exception_severity_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('P1', 'P1 / 高优先级', 10, 0),
  ('P2', 'P2 / 中优先级', 20, 0),
  ('P3', 'P3 / 常规', 30, 0);

INSERT OR REPLACE INTO station_exception_status_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('Open', 'Open / 待处理', 10, 0),
  ('In Progress', 'In Progress / 跟进中', 20, 0),
  ('Resolved', 'Resolved / 已恢复', 30, 0),
  ('Closed', 'Closed / 已关闭', 40, 0);

INSERT OR REPLACE INTO station_exception_owner_role_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('station_supervisor', '站点主管', 10, 0),
  ('document_desk', '单证台', 20, 0),
  ('check_worker', '复核员', 30, 0),
  ('inbound_operator', '进港操作员', 40, 0),
  ('delivery_desk', '交付台', 50, 0),
  ('mobile_operator', 'PDA 作业员', 60, 0);

INSERT OR REPLACE INTO station_exception_related_object_type_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('Flight', 'Flight', 10, 0),
  ('AWB', 'AWB', 20, 0),
  ('Shipment', 'Shipment', 30, 0),
  ('Task', 'Task', 40, 0),
  ('Document', 'Document', 50, 0);

INSERT OR REPLACE INTO station_exception_blocker_state_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('blocked', '阻断中', 10, 0),
  ('clear', '未阻断', 20, 0);
