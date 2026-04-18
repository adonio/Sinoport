ALTER TABLE tasks ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_station_deleted_at
  ON tasks(station_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_tasks_station_role_status
  ON tasks(station_id, assigned_role, task_status);

CREATE TABLE IF NOT EXISTS station_task_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_task_priority_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_task_role_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_task_related_object_type_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR REPLACE INTO station_task_status_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('Created', '已创建', 10, 0),
  ('Assigned', '已分派', 20, 0),
  ('Accepted', '已领取', 30, 0),
  ('Arrived at Location', '已到场', 40, 0),
  ('Started', '执行中', 50, 0),
  ('Evidence Uploaded', '已上传证据', 60, 0),
  ('Completed', '已完成', 70, 0),
  ('Verified', '已复核', 80, 0),
  ('Escalated', '已升级', 90, 0),
  ('Handed Over', '已交接', 100, 0),
  ('Closed', '已关闭', 110, 0),
  ('Rejected', '已拒绝', 120, 0),
  ('Rework', '返工中', 130, 0),
  ('Exception Raised', '已上报异常', 140, 0);

INSERT OR REPLACE INTO station_task_priority_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('P1', 'P1 / 高优先级', 10, 0),
  ('P2', 'P2 / 中优先级', 20, 0),
  ('P3', 'P3 / 常规', 30, 0);

INSERT OR REPLACE INTO station_task_role_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('station_supervisor', '站点主管', 10, 0),
  ('document_desk', '单证台', 20, 0),
  ('check_worker', '复核员', 30, 0),
  ('inbound_operator', '进港操作员', 40, 0),
  ('delivery_desk', '交付台', 50, 0),
  ('mobile_operator', 'PDA 作业员', 60, 0);

INSERT OR REPLACE INTO station_task_related_object_type_options (option_key, option_label, sort_order, is_disabled) VALUES
  ('Flight', 'Flight', 10, 0),
  ('AWB', 'AWB', 20, 0),
  ('Shipment', 'Shipment', 30, 0),
  ('Document', 'Document', 40, 0),
  ('Task', 'Task', 50, 0);
