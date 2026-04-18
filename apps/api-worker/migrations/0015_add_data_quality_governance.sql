CREATE TABLE IF NOT EXISTS data_quality_rules (
  rule_id TEXT PRIMARY KEY,
  station_id TEXT,
  object_type TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  description TEXT NOT NULL,
  rule_stage TEXT NOT NULL,
  severity TEXT NOT NULL,
  blocking_default INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  source_module TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  UNIQUE(station_id, object_type, rule_code)
);

CREATE INDEX IF NOT EXISTS idx_data_quality_rules_station
  ON data_quality_rules(station_id, object_type, active);

CREATE TABLE IF NOT EXISTS data_quality_issues (
  issue_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  rule_id TEXT,
  issue_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  blocking_flag INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL,
  source_key TEXT,
  import_request_id TEXT,
  summary TEXT NOT NULL,
  details_json TEXT,
  suggested_action TEXT,
  audit_object_type TEXT,
  audit_object_id TEXT,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (rule_id) REFERENCES data_quality_rules(rule_id)
);

CREATE INDEX IF NOT EXISTS idx_data_quality_issues_station_date
  ON data_quality_issues(station_id, issue_date, severity, status);

CREATE INDEX IF NOT EXISTS idx_data_quality_issues_import_request
  ON data_quality_issues(import_request_id, issue_code);

INSERT OR IGNORE INTO data_quality_rules (
  rule_id,
  station_id,
  object_type,
  rule_code,
  rule_name,
  description,
  rule_stage,
  severity,
  blocking_default,
  active,
  source_module,
  metadata_json
) VALUES
  (
    'DQR-IMPORT-FAILED',
    NULL,
    'ImportRequest',
    'DQ_IMPORT_REQUEST_FAILED',
    '导入失败请求',
    '导入账本中出现 failed 状态的正式请求，必须进入问题回收。',
    'import',
    'P1',
    1,
    1,
    'apps/api-worker/migrations/0015_add_data_quality_governance.sql',
    '{"category":"import","default_status":"Open"}'
  ),
  (
    'DQR-AWB-MISSING-FLIGHT',
    NULL,
    'AWB',
    'DQ_AWB_MISSING_FLIGHT',
    'AWB 缺少航班关联',
    'AWB 未关联正式航班对象，无法进入稳定对象链。',
    'linkage',
    'P1',
    1,
    1,
    'apps/api-worker/migrations/0015_add_data_quality_governance.sql',
    '{"category":"linkage","default_status":"Open"}'
  ),
  (
    'DQR-AWB-MISSING-SHIPMENT',
    NULL,
    'AWB',
    'DQ_AWB_MISSING_SHIPMENT',
    'AWB 缺少 Shipment 关联',
    'AWB 未关联 Shipment，无法完成 Flight -> Shipment -> AWB 闭环。',
    'linkage',
    'P1',
    1,
    1,
    'apps/api-worker/migrations/0015_add_data_quality_governance.sql',
    '{"category":"linkage","default_status":"Open"}'
  ),
  (
    'DQR-SHIPMENT-WITHOUT-AWB',
    NULL,
    'Shipment',
    'DQ_SHIPMENT_WITHOUT_AWB',
    'Shipment 缺少 AWB',
    'Shipment 没有任何 AWB 关联，说明对象链不完整。',
    'linkage',
    'P2',
    0,
    1,
    'apps/api-worker/migrations/0015_add_data_quality_governance.sql',
    '{"category":"linkage","default_status":"Open"}'
  ),
  (
    'DQR-TASK-MISSING-RELATED-OBJECT',
    NULL,
    'Task',
    'DQ_TASK_MISSING_RELATED_OBJECT',
    'Task 缺少关联对象',
    'Task 的 related_object_id 无法映射到真实对象，任务无法稳定追踪。',
    'execution',
    'P1',
    1,
    1,
    'apps/api-worker/migrations/0015_add_data_quality_governance.sql',
    '{"category":"execution","default_status":"Open"}'
  ),
  (
    'DQR-TRIAL-FLIGHT-MISSING-AUDIT',
    NULL,
    'Flight',
    'DQ_TRIAL_FLIGHT_MISSING_AUDIT',
    '试运行航班缺少正式导入审计',
    '正式导入后的 Flight 未命中 STATION_INBOUND_BUNDLE_IMPORTED，试运行不可追责。',
    'audit',
    'P2',
    0,
    1,
    'apps/api-worker/migrations/0015_add_data_quality_governance.sql',
    '{"category":"audit","default_status":"Open"}'
  );
