CREATE TABLE IF NOT EXISTS platform_rule_type_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_rule_control_level_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_rule_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_rule_scope_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_rule_service_level_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_rule_timeline_stage_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_rules (
  rule_id TEXT PRIMARY KEY,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  control_level TEXT NOT NULL,
  applicability_scope TEXT NOT NULL,
  related_station_id TEXT,
  related_lane_id TEXT,
  related_scenario_id TEXT,
  service_level TEXT,
  timeline_stage TEXT NOT NULL,
  rule_status TEXT NOT NULL DEFAULT 'active',
  summary TEXT NOT NULL,
  trigger_condition TEXT,
  trigger_node TEXT,
  action_target TEXT,
  blocker_action TEXT,
  recovery_action TEXT,
  evidence_requirements TEXT,
  owner_role TEXT,
  note TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_station_id) REFERENCES stations(station_id),
  FOREIGN KEY (related_lane_id) REFERENCES network_lanes(lane_id),
  FOREIGN KEY (related_scenario_id) REFERENCES network_scenarios(scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_rules_type ON platform_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_platform_rules_control_level ON platform_rules(control_level);
CREATE INDEX IF NOT EXISTS idx_platform_rules_scope ON platform_rules(applicability_scope);
CREATE INDEX IF NOT EXISTS idx_platform_rules_status ON platform_rules(rule_status);
CREATE INDEX IF NOT EXISTS idx_platform_rules_service_level ON platform_rules(service_level);
CREATE INDEX IF NOT EXISTS idx_platform_rules_timeline_stage ON platform_rules(timeline_stage);
CREATE INDEX IF NOT EXISTS idx_platform_rules_station_id ON platform_rules(related_station_id);
CREATE INDEX IF NOT EXISTS idx_platform_rules_lane_id ON platform_rules(related_lane_id);
CREATE INDEX IF NOT EXISTS idx_platform_rules_scenario_id ON platform_rules(related_scenario_id);
CREATE INDEX IF NOT EXISTS idx_platform_rules_deleted_at ON platform_rules(deleted_at);

INSERT OR IGNORE INTO platform_rule_type_options (option_key, option_label, sort_order) VALUES
  ('service_level', '服务等级', 10),
  ('hard_gate', '硬门槛', 20),
  ('task_template', '任务模板', 30),
  ('evidence_policy', '证据要求', 40),
  ('interface_policy', '接口治理', 50),
  ('exception_policy', '异常处置', 60),
  ('scenario_template', '场景编排', 70);

INSERT OR IGNORE INTO platform_rule_control_level_options (option_key, option_label, sort_order) VALUES
  ('strong_control', '强控制', 10),
  ('collaborative_control', '协同控制', 20),
  ('visibility_control', '可视化控制', 30),
  ('exception_control', '异常控制', 40);

INSERT OR IGNORE INTO platform_rule_status_options (option_key, option_label, sort_order) VALUES
  ('draft', '草稿', 10),
  ('active', '运行中', 20),
  ('paused', '暂停', 30),
  ('archived', '已归档', 40);

INSERT OR IGNORE INTO platform_rule_scope_options (option_key, option_label, sort_order) VALUES
  ('global', '平台全局', 10),
  ('station', '站点', 20),
  ('lane', '链路', 30),
  ('scenario', '场景', 40);

INSERT OR IGNORE INTO platform_rule_service_level_options (option_key, option_label, sort_order) VALUES
  ('P1', 'P1', 10),
  ('P2', 'P2', 20),
  ('P3', 'P3', 30);

INSERT OR IGNORE INTO platform_rule_timeline_stage_options (option_key, option_label, sort_order) VALUES
  ('intake_gate', '收货准入', 10),
  ('task_release', '任务放行', 20),
  ('evidence_hold', '证据校验', 30),
  ('interface_sync', '接口同步', 40),
  ('exception_recovery', '异常恢复', 50),
  ('scenario_orchestration', '场景编排', 60);

INSERT OR IGNORE INTO platform_rules (
  rule_id,
  rule_name,
  rule_type,
  control_level,
  applicability_scope,
  related_station_id,
  related_lane_id,
  related_scenario_id,
  service_level,
  timeline_stage,
  rule_status,
  summary,
  trigger_condition,
  trigger_node,
  action_target,
  blocker_action,
  recovery_action,
  evidence_requirements,
  owner_role,
  note
) VALUES
  (
    'RULE-SVC-P1',
    'P1 高时效履约优先级',
    'service_level',
    'strong_control',
    'global',
    NULL,
    NULL,
    NULL,
    'P1',
    'intake_gate',
    'active',
    '高时效与高优先级货物默认前置抢占收货、装载、进港理货和尾程交付资源。',
    '对象优先级 = P1',
    'Platform Priority Engine',
    '优先队列 / 资源抢占',
    '未满足优先资源时阻断下游 SLA 承诺',
    '运营确认优先级并补齐资源后恢复',
    '优先级说明 / 关键节点回传',
    'platform_admin',
    '替代旧的 serviceLevels payload。'
  ),
  (
    'RULE-SVC-P2',
    'P2 标准履约基线',
    'service_level',
    'collaborative_control',
    'global',
    NULL,
    NULL,
    NULL,
    'P2',
    'intake_gate',
    'active',
    '标准履约货物按统一 SLA 推进，异常升级后切换强控制。',
    '对象优先级 = P2',
    'Platform Priority Engine',
    '标准任务链',
    '关键单证未齐时阻断跨节点放行',
    '补齐单证并复核后恢复',
    'Manifest / 节点回传 / POD',
    'station_supervisor',
    '替代旧的 P2 服务等级说明。'
  ),
  (
    'RULE-GATE-DOC-01',
    '关键单证齐套后才能放行下游任务',
    'hard_gate',
    'strong_control',
    'global',
    NULL,
    NULL,
    NULL,
    'P1',
    'task_release',
    'active',
    'Manifest、FFM、UWS、NOA 等关键单证未齐套时，不允许生成或放行下游任务。',
    'Manifest / FFM / UWS / NOA 任一缺失',
    'Release Gate',
    '下游任务放行',
    '阻断任务生成与对象过站放行',
    '文档 Desk 复核齐套后解除阻断',
    'Manifest / FFM / UWS / NOA',
    'document_desk',
    '替代 hardGatePolicyRows 与 gateEvaluationRows 的主真相。'
  ),
  (
    'RULE-TASK-INBOUND-01',
    '进港拆板自动任务模板',
    'task_template',
    'collaborative_control',
    'station',
    'MME',
    NULL,
    NULL,
    'P2',
    'task_release',
    'active',
    '航班落地且 CBA/Manifest 到齐后，自动生成拆板、理货复核和尾程交接任务。',
    'Flight = Landed 且 CBA / Manifest 已回传',
    'Inbound Breakdown',
    'Breakdown / Check / Tailhaul 任务',
    '单证未齐或场地未就绪时延迟任务放行',
    '站点主管确认场地与单证后恢复',
    '开工照片 / 理货记录 / Collection Note',
    'station_supervisor',
    '替代旧 task template payload。'
  ),
  (
    'RULE-EVD-POD-01',
    '交付闭环必须带 POD 证据',
    'evidence_policy',
    'strong_control',
    'station',
    'MME',
    NULL,
    NULL,
    'P1',
    'evidence_hold',
    'active',
    '尾程交付任务只有在上传 POD 图片或签收凭据后才能闭环。',
    'Delivery 任务提交完成',
    'Delivery Closure',
    '交付闭环',
    '缺失 POD 时禁止完成任务与对外回传',
    '补传签收凭据并复核后恢复',
    'POD 图片 / 签收回单 / 异常备注',
    'delivery_desk',
    '替代旧 evidencePolicyRows。'
  ),
  (
    'RULE-INT-FFM-01',
    'FFM/UWS 接口 15 分钟内完成回传',
    'interface_policy',
    'collaborative_control',
    'lane',
    NULL,
    'LANE-URC-MME-01',
    NULL,
    'P2',
    'interface_sync',
    'active',
    'URC -> MME 样板链路要求 FFM/UWS 在关键节点后 15 分钟内完成回传。',
    '关键节点完成后 15 分钟内未收到 FFM/UWS',
    'Interface Sync Monitor',
    '接口同步监控',
    '超时后阻断状态晋级并触发异常升级',
    '接口补传并通过审计后恢复',
    'FFM / UWS / 接口同步时间戳',
    'document_desk',
    '替代旧 interfaceStatus payload。'
  ),
  (
    'RULE-EXC-NOA-01',
    'NOA 超时自动升级异常',
    'exception_policy',
    'exception_control',
    'station',
    'MME',
    NULL,
    NULL,
    'P1',
    'exception_recovery',
    'active',
    'NOA 超过目标时限未完成时，自动升级为平台异常并要求站点主管介入。',
    'NOA 超过 SLA 且状态仍为 Pending',
    'NOA Escalation',
    '异常升级',
    '阻断交付承诺并生成升级任务',
    'NOA 补发且异常关闭后恢复',
    'NOA 发送记录 / 联系纪要 / 升级说明',
    'station_supervisor',
    '替代旧 exceptionTaxonomy 中的目标时限规则。'
  ),
  (
    'RULE-SCN-A-02',
    '标准场景 A 进入规则模板',
    'scenario_template',
    'collaborative_control',
    'scenario',
    'MME',
    'LANE-URC-MME-01',
    'SCN-A-02',
    'P2',
    'scenario_orchestration',
    'active',
    '标准场景 A 在航班落地、拆板资源就绪、证据策略满足后自动进入执行编排。',
    '航班落地 + 站点资源就绪 + 证据要求满足',
    'Scenario Orchestrator',
    '场景编排任务链',
    '任一条件缺失时阻断场景进入',
    '满足进入规则后自动恢复编排',
    'CBA / Manifest / Handling Plan / POD',
    'platform_admin',
    '替代旧 scenarioTimelineRows 的主读源。'
  );
