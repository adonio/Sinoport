CREATE TABLE IF NOT EXISTS platform_master_data_type_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_source_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data (
  master_data_id TEXT PRIMARY KEY,
  object_name TEXT NOT NULL,
  object_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  governance_status TEXT NOT NULL DEFAULT 'active',
  primary_key_rule TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  note TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (object_type) REFERENCES platform_master_data_type_options(option_key),
  FOREIGN KEY (source_type) REFERENCES platform_master_data_source_options(option_key),
  FOREIGN KEY (governance_status) REFERENCES platform_master_data_status_options(option_key)
);

CREATE INDEX IF NOT EXISTS idx_platform_master_data_object_type
  ON platform_master_data(object_type);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_source_type
  ON platform_master_data(source_type);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_governance_status
  ON platform_master_data(governance_status);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_deleted_at
  ON platform_master_data(deleted_at);

INSERT OR IGNORE INTO platform_master_data_type_options (option_key, option_label, sort_order) VALUES
  ('flight', '航班', 10),
  ('shipment_awb', '运单 / 提单', 20),
  ('uld_pmc', 'ULD / PMC', 30),
  ('truck_driver', '车辆 / 司机', 40),
  ('document', '单证', 50),
  ('event', '事件', 60);

INSERT OR IGNORE INTO platform_master_data_source_options (option_key, option_label, sort_order) VALUES
  ('operational_table', '正式业务表', 10),
  ('integration_feed', '接口导入链', 20),
  ('document_repository', '单证仓', 30),
  ('audit_stream', '审计事件流', 40);

INSERT OR IGNORE INTO platform_master_data_status_options (option_key, option_label, sort_order) VALUES
  ('active', '运行中', 10),
  ('warning', '警戒', 20),
  ('pending', '待处理', 30),
  ('archived', '已归档', 40);

INSERT OR IGNORE INTO platform_master_data (
  master_data_id,
  object_name,
  object_type,
  source_type,
  governance_status,
  primary_key_rule,
  owner_name,
  note
) VALUES
  (
    'MD-FLIGHT',
    'Flight',
    'flight',
    'operational_table',
    'active',
    'Flight No + Flight Date + Station',
    'Platform Data Owner',
    '统一 Runtime / Fulfillment 双状态口径'
  ),
  (
    'MD-SHIPMENT-AWB',
    'Shipment / AWB',
    'shipment_awb',
    'operational_table',
    'active',
    'Shipment ID / AWB / HAWB',
    'Station Ops',
    '贯穿航班、文件、任务、异常、POD'
  ),
  (
    'MD-ULD-PMC',
    'ULD / PMC',
    'uld_pmc',
    'integration_feed',
    'warning',
    'ULD/PMC ID',
    'Ramp Team',
    '部分链路仍缺与 UWS 的统一映射'
  ),
  (
    'MD-TRUCK-DRIVER',
    'Truck / Driver',
    'truck_driver',
    'integration_feed',
    'pending',
    'Truck ID / Plate No / Driver',
    'Linehaul Control',
    '尾程与二次转运模型需统一'
  ),
  (
    'MD-DOCUMENT',
    'Document',
    'document',
    'document_repository',
    'active',
    'Document ID / Version / Linked Object',
    'Document Desk',
    '为状态放行与模板指令提供基础'
  ),
  (
    'MD-EVENT',
    'Event',
    'event',
    'audit_stream',
    'pending',
    'Event ID / Event Hash',
    'Audit Owner',
    '当前仅做前端可信留痕占位'
  );
