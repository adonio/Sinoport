CREATE INDEX IF NOT EXISTS idx_documents_station_deleted_at
  ON documents(station_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_documents_station_type_status
  ON documents(station_id, document_type, document_status);

CREATE TABLE IF NOT EXISTS station_document_type_options (
  option_value TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_document_status_options (
  option_value TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_document_retention_class_options (
  option_value TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_document_related_object_type_options (
  option_value TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT OR REPLACE INTO station_document_type_options (option_value, option_label, sort_order) VALUES
  ('POD', 'POD', 10),
  ('NOA', 'NOA', 20),
  ('Manifest', 'Manifest', 30),
  ('FFM', 'FFM', 40),
  ('UWS', 'UWS', 50),
  ('CBA', 'CBA', 60),
  ('MAWB', 'MAWB', 70),
  ('Invoice', 'Invoice', 80),
  ('Evidence', 'Evidence', 90);

INSERT OR REPLACE INTO station_document_status_options (option_value, option_label, sort_order) VALUES
  ('Draft', '草稿', 10),
  ('Uploaded', '已上传', 20),
  ('Parsed', '已解析', 30),
  ('Validated', '已校验', 40),
  ('Missing', '缺失', 50),
  ('Approved', '已审批', 60),
  ('Released', '已放行', 70),
  ('Replaced', '已替换', 80);

INSERT OR REPLACE INTO station_document_retention_class_options (option_value, option_label, sort_order) VALUES
  ('temporary', '临时', 10),
  ('operational', '运营', 20),
  ('compliance', '合规', 30);

INSERT OR REPLACE INTO station_document_related_object_type_options (option_value, option_label, sort_order) VALUES
  ('AWB', 'AWB', 10),
  ('Flight', 'Flight', 20),
  ('Shipment', 'Shipment', 30),
  ('Task', 'Task', 40),
  ('Truck', 'Truck', 50);
