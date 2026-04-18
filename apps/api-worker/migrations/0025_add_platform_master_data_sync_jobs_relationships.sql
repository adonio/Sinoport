CREATE TABLE IF NOT EXISTS platform_master_data_sync_object_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_sync_target_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_sync_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_sync (
  sync_id TEXT PRIMARY KEY,
  sync_name TEXT NOT NULL,
  object_type TEXT NOT NULL,
  target_system TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'active',
  schedule_label TEXT,
  last_run_at TEXT,
  fallback_strategy TEXT NOT NULL,
  primary_action_label TEXT NOT NULL,
  fallback_action_label TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  note TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (object_type) REFERENCES platform_master_data_sync_object_options(option_key),
  FOREIGN KEY (target_system) REFERENCES platform_master_data_sync_target_options(option_key),
  FOREIGN KEY (sync_status) REFERENCES platform_master_data_sync_status_options(option_key)
);

CREATE INDEX IF NOT EXISTS idx_platform_master_data_sync_object_type
  ON platform_master_data_sync(object_type);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_sync_target_system
  ON platform_master_data_sync(target_system);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_sync_status
  ON platform_master_data_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_sync_deleted_at
  ON platform_master_data_sync(deleted_at);

CREATE TABLE IF NOT EXISTS platform_master_data_job_source_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_job_object_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_job_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_job_action_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_jobs (
  job_id TEXT PRIMARY KEY,
  sync_id TEXT,
  source_key TEXT NOT NULL,
  object_type TEXT NOT NULL,
  job_status TEXT NOT NULL DEFAULT 'queued',
  summary TEXT NOT NULL,
  detail_note TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  replay_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  requested_at TEXT NOT NULL,
  processed_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sync_id) REFERENCES platform_master_data_sync(sync_id),
  FOREIGN KEY (source_key) REFERENCES platform_master_data_job_source_options(option_key),
  FOREIGN KEY (object_type) REFERENCES platform_master_data_job_object_options(option_key),
  FOREIGN KEY (job_status) REFERENCES platform_master_data_job_status_options(option_key)
);

CREATE INDEX IF NOT EXISTS idx_platform_master_data_jobs_sync_id
  ON platform_master_data_jobs(sync_id);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_jobs_source_key
  ON platform_master_data_jobs(source_key);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_jobs_object_type
  ON platform_master_data_jobs(object_type);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_jobs_status
  ON platform_master_data_jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_jobs_archived_at
  ON platform_master_data_jobs(archived_at);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_jobs_requested_at
  ON platform_master_data_jobs(requested_at);

CREATE TABLE IF NOT EXISTS platform_master_data_relationship_node_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_relationship_type_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_relationship_evidence_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_master_data_relationships (
  relationship_id TEXT PRIMARY KEY,
  source_object_type TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  target_object_type TEXT NOT NULL,
  target_object_id TEXT NOT NULL,
  path_depth INTEGER NOT NULL DEFAULT 1,
  path_summary TEXT NOT NULL,
  evidence_source TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_object_type) REFERENCES platform_master_data_relationship_node_options(option_key),
  FOREIGN KEY (relation_type) REFERENCES platform_master_data_relationship_type_options(option_key),
  FOREIGN KEY (target_object_type) REFERENCES platform_master_data_relationship_node_options(option_key),
  FOREIGN KEY (evidence_source) REFERENCES platform_master_data_relationship_evidence_options(option_key)
);

CREATE INDEX IF NOT EXISTS idx_platform_master_data_relationships_source
  ON platform_master_data_relationships(source_object_type, source_object_id);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_relationships_target
  ON platform_master_data_relationships(target_object_type, target_object_id);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_relationships_relation_type
  ON platform_master_data_relationships(relation_type);
CREATE INDEX IF NOT EXISTS idx_platform_master_data_relationships_updated_at
  ON platform_master_data_relationships(updated_at);

INSERT OR IGNORE INTO platform_master_data_sync_object_options (option_key, option_label, sort_order) VALUES
  ('flight', '航班', 10),
  ('shipment_awb', '运单 / 提单', 20),
  ('uld_pmc', 'ULD / PMC', 30),
  ('proof_of_delivery', 'POD', 40),
  ('event', '事件', 50),
  ('last_mile', 'Last-mile', 60);

INSERT OR IGNORE INTO platform_master_data_sync_target_options (option_key, option_label, sort_order) VALUES
  ('network_control', '网络控制台', 10),
  ('station_fulfillment', '货站履约', 20),
  ('document_repository', '单证仓', 30),
  ('linehaul_control', '干线控制', 40),
  ('audit_hub', '审计中台', 50);

INSERT OR IGNORE INTO platform_master_data_sync_status_options (option_key, option_label, sort_order) VALUES
  ('active', '运行中', 10),
  ('warning', '警戒', 20),
  ('paused', '暂停', 30),
  ('archived', '已归档', 40);

INSERT OR IGNORE INTO platform_master_data_sync (
  sync_id,
  sync_name,
  object_type,
  target_system,
  sync_status,
  schedule_label,
  last_run_at,
  fallback_strategy,
  primary_action_label,
  fallback_action_label,
  owner_name,
  note
) VALUES
  (
    'SYNC-FFM',
    'FFM',
    'flight',
    'network_control',
    'active',
    '每 15 分钟',
    '2026-04-16T09:30:00.000Z',
    '失败时保留上一版舱单映射',
    '重跑增量同步',
    '切换人工核对',
    'Platform Data Owner',
    '用于航班与运单映射的前置消息同步'
  ),
  (
    'SYNC-UWS',
    'UWS',
    'uld_pmc',
    'station_fulfillment',
    'warning',
    '每 30 分钟',
    '2026-04-16T08:55:00.000Z',
    '降级到上次成功装板结果',
    '重放队列',
    '触发值班复核',
    'Ramp Team',
    '装板映射存在延迟抖动'
  ),
  (
    'SYNC-MANIFEST',
    'Manifest',
    'shipment_awb',
    'document_repository',
    'active',
    '每小时',
    '2026-04-16T07:40:00.000Z',
    '缺字段时保留上一版本 manifest',
    '补拉主文件',
    '生成人工补录清单',
    'Document Desk',
    '保障清关与提单一致性'
  ),
  (
    'SYNC-POD',
    'POD',
    'proof_of_delivery',
    'audit_hub',
    'paused',
    '每天 4 次',
    '2026-04-15T23:15:00.000Z',
    '暂停写入，仅保留事件对账',
    '恢复回放',
    '导出差异报告',
    'Audit Owner',
    '待补尾程签收端新鉴权'
  ),
  (
    'SYNC-FLIGHT',
    'Flight',
    'flight',
    'station_fulfillment',
    'active',
    '每 10 分钟',
    '2026-04-16T09:42:00.000Z',
    '失败时沿用上一航班快照',
    '重跑航班抽取',
    '切人工锁定',
    'Station Ops',
    '同步航班到货站履约视图'
  ),
  (
    'SYNC-LAST-MILE',
    'Last-mile',
    'last_mile',
    'linehaul_control',
    'warning',
    '每 20 分钟',
    '2026-04-16T09:05:00.000Z',
    '回落至司机上次确认回执',
    '重放司机状态',
    '切短信兜底',
    'Linehaul Control',
    '尾程状态链存在第三方回调延迟'
  );

INSERT OR IGNORE INTO platform_master_data_job_source_options (option_key, option_label, sort_order) VALUES
  ('ffm_feed', 'FFM Feed', 10),
  ('uws_feed', 'UWS Feed', 20),
  ('manifest_feed', 'Manifest Feed', 30),
  ('pod_feed', 'POD Feed', 40),
  ('flight_api', 'Flight API', 50),
  ('last_mile_api', 'Last-mile API', 60);

INSERT OR IGNORE INTO platform_master_data_job_object_options (option_key, option_label, sort_order) VALUES
  ('flight', '航班', 10),
  ('shipment_awb', '运单 / 提单', 20),
  ('uld_pmc', 'ULD / PMC', 30),
  ('proof_of_delivery', 'POD', 40),
  ('event', '事件', 50),
  ('last_mile', 'Last-mile', 60);

INSERT OR IGNORE INTO platform_master_data_job_status_options (option_key, option_label, sort_order) VALUES
  ('queued', '排队中', 10),
  ('running', '运行中', 20),
  ('succeeded', '成功', 30),
  ('failed', '失败', 40),
  ('partial', '部分成功', 50),
  ('archived', '已归档', 60);

INSERT OR IGNORE INTO platform_master_data_job_action_options (option_key, option_label, sort_order) VALUES
  ('retry', '重试', 10),
  ('replay', '重放', 20),
  ('archive', '归档', 30);

INSERT OR IGNORE INTO platform_master_data_jobs (
  job_id,
  sync_id,
  source_key,
  object_type,
  job_status,
  summary,
  detail_note,
  retry_count,
  replay_count,
  last_error,
  requested_at,
  processed_at
) VALUES
  (
    'JOB-FFM-20260416-001',
    'SYNC-FFM',
    'ffm_feed',
    'flight',
    'succeeded',
    'FFM 航班增量入库完成',
    '写入 24 个航班映射节点',
    0,
    0,
    NULL,
    '2026-04-16T09:10:00.000Z',
    '2026-04-16T09:12:00.000Z'
  ),
  (
    'JOB-UWS-20260416-003',
    'SYNC-UWS',
    'uws_feed',
    'uld_pmc',
    'failed',
    'UWS 装板回放失败',
    '第三方返回空舱位映射',
    2,
    0,
    'ULD 匹配缺少舱位代码',
    '2026-04-16T08:35:00.000Z',
    '2026-04-16T08:39:00.000Z'
  ),
  (
    'JOB-MANIFEST-20260416-002',
    'SYNC-MANIFEST',
    'manifest_feed',
    'shipment_awb',
    'partial',
    'Manifest 批次部分成功',
    '3 票缺少清关状态，已生成补录待办',
    1,
    0,
    '3 票缺字段',
    '2026-04-16T07:15:00.000Z',
    '2026-04-16T07:22:00.000Z'
  ),
  (
    'JOB-POD-20260415-004',
    'SYNC-POD',
    'pod_feed',
    'proof_of_delivery',
    'archived',
    'POD 历史重放已归档',
    '仅保留审计回放记录',
    0,
    1,
    NULL,
    '2026-04-15T22:30:00.000Z',
    '2026-04-15T22:33:00.000Z'
  ),
  (
    'JOB-FLIGHT-20260416-005',
    'SYNC-FLIGHT',
    'flight_api',
    'flight',
    'running',
    '航班视图重建进行中',
    '等待 station_fulfillment 侧确认',
    0,
    0,
    NULL,
    '2026-04-16T09:40:00.000Z',
    NULL
  ),
  (
    'JOB-LASTMILE-20260416-006',
    'SYNC-LAST-MILE',
    'last_mile_api',
    'last_mile',
    'queued',
    '尾程签收回调重跑排队中',
    '等待第三方窗口放开频率限制',
    1,
    0,
    NULL,
    '2026-04-16T09:00:00.000Z',
    NULL
  );

UPDATE platform_master_data_jobs
SET archived_at = '2026-04-15T22:40:00.000Z'
WHERE job_id = 'JOB-POD-20260415-004'
  AND archived_at IS NULL;

INSERT OR IGNORE INTO platform_master_data_relationship_node_options (option_key, option_label, sort_order) VALUES
  ('flight', '航班', 10),
  ('shipment_awb', '运单 / 提单', 20),
  ('uld_pmc', 'ULD / PMC', 30),
  ('truck_driver', '车辆 / 司机', 40),
  ('document', '单证', 50),
  ('pod', 'POD', 60),
  ('event', '事件', 70);

INSERT OR IGNORE INTO platform_master_data_relationship_type_options (option_key, option_label, sort_order) VALUES
  ('carries', '承运', 10),
  ('consolidates', '集拼', 20),
  ('dispatched_by', '派车', 30),
  ('evidenced_by', '单证佐证', 40),
  ('triggers', '触发', 50),
  ('settles', '签收闭环', 60);

INSERT OR IGNORE INTO platform_master_data_relationship_evidence_options (option_key, option_label, sort_order) VALUES
  ('operational_table', '正式业务表', 10),
  ('integration_log', '接口日志', 20),
  ('document_repository', '单证仓', 30),
  ('audit_event', '审计事件', 40);

INSERT OR IGNORE INTO platform_master_data_relationships (
  relationship_id,
  source_object_type,
  source_object_id,
  relation_type,
  target_object_type,
  target_object_id,
  path_depth,
  path_summary,
  evidence_source,
  note
) VALUES
  (
    'REL-FLIGHT-AWB-001',
    'flight',
    'CX138/2026-04-16/MME',
    'carries',
    'shipment_awb',
    '176-12345675',
    1,
    'Flight CX138/2026-04-16/MME 直接承运 AWB 176-12345675。',
    'operational_table',
    '以航班主表与运单主表联接为准'
  ),
  (
    'REL-AWB-ULD-001',
    'shipment_awb',
    '176-12345675',
    'consolidates',
    'uld_pmc',
    'PMC-778812',
    2,
    'AWB 176-12345675 被集拼到 PMC-778812。',
    'integration_log',
    '来自 UWS 装板落地结果'
  ),
  (
    'REL-FLIGHT-TRUCK-001',
    'flight',
    'CX138/2026-04-16/MME',
    'dispatched_by',
    'truck_driver',
    'TRUCK-MME-09',
    2,
    '航班到货后由 TRUCK-MME-09 承接尾程派送。',
    'operational_table',
    '尾程派车计划与到货航班绑定'
  ),
  (
    'REL-AWB-DOC-001',
    'shipment_awb',
    '176-12345675',
    'evidenced_by',
    'document',
    'DOC-HANDOVER-20260416-01',
    1,
    'AWB 176-12345675 由交接单 DOC-HANDOVER-20260416-01 佐证。',
    'document_repository',
    '用于站内交接与异常复盘'
  ),
  (
    'REL-EVENT-AWB-001',
    'event',
    'EVT-HANDOVER-20260416-08',
    'triggers',
    'shipment_awb',
    '176-12345675',
    3,
    '异常事件 EVT-HANDOVER-20260416-08 触发对 AWB 176-12345675 的补录任务。',
    'audit_event',
    '用于追踪补录来源'
  ),
  (
    'REL-POD-AWB-001',
    'pod',
    'POD-20260416-0008',
    'settles',
    'shipment_awb',
    '176-12345675',
    3,
    'POD-20260416-0008 完成 AWB 176-12345675 的签收闭环。',
    'document_repository',
    '尾程签收与运单闭环对账'
  );
