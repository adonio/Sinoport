CREATE TABLE IF NOT EXISTS network_scenario_category_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS network_scenario_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS network_scenarios (
  scenario_id TEXT PRIMARY KEY,
  scenario_title TEXT NOT NULL,
  scenario_category TEXT NOT NULL,
  lane_id TEXT NOT NULL,
  primary_station_id TEXT NOT NULL,
  node_sequence TEXT NOT NULL,
  entry_rule_summary TEXT NOT NULL,
  evidence_requirements TEXT NOT NULL,
  scenario_status TEXT NOT NULL DEFAULT 'active',
  note TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lane_id) REFERENCES network_lanes(lane_id),
  FOREIGN KEY (primary_station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_network_scenarios_lane_id ON network_scenarios(lane_id);
CREATE INDEX IF NOT EXISTS idx_network_scenarios_primary_station_id ON network_scenarios(primary_station_id);
CREATE INDEX IF NOT EXISTS idx_network_scenarios_scenario_category ON network_scenarios(scenario_category);
CREATE INDEX IF NOT EXISTS idx_network_scenarios_scenario_status ON network_scenarios(scenario_status);
CREATE INDEX IF NOT EXISTS idx_network_scenarios_deleted_at ON network_scenarios(deleted_at);

INSERT OR IGNORE INTO network_scenario_category_options (option_key, option_label, sort_order) VALUES
  ('document_chain', '文件链路', 10),
  ('inbound_breakdown', '进港拆板', 20),
  ('tailhaul_delivery', '尾程交付', 30),
  ('exception_recovery', '异常恢复', 40);

INSERT OR IGNORE INTO network_scenario_status_options (option_key, option_label, sort_order) VALUES
  ('active', '运行中', 10),
  ('onboarding', '接入中', 20),
  ('paused', '暂停', 30),
  ('archived', '已归档', 40);

INSERT OR IGNORE INTO network_scenarios (
  scenario_id,
  scenario_title,
  scenario_category,
  lane_id,
  primary_station_id,
  node_sequence,
  entry_rule_summary,
  evidence_requirements,
  scenario_status,
  note
) VALUES
  (
    'SCN-B-01',
    '标准场景 B：前置仓到出港文件链',
    'document_chain',
    'LANE-URC-MME-01',
    'URC',
    '前置仓收货 -> 头程卡车 -> 出港货站 -> 出港机坪 -> Flight -> 进港机坪 -> 进港货站 -> 尾程装车 -> 交付仓',
    '关键文件齐全后才能进入下游任务',
    'CMR / Origin POD / FFM / UWS / Manifest / POD',
    'active',
    '用于平台、货站与 PDA 三端对齐文件链与证据链。'
  ),
  (
    'SCN-A-02',
    '标准场景 A：航班落地后拆板到装车',
    'inbound_breakdown',
    'LANE-URC-MME-01',
    'MME',
    'Landed -> Inbound Handling -> Breakdown -> Sorting -> Tailhaul',
    'CBA / Manifest / Handling Plan 触发',
    '开工照片 / 理货记录 / Collection Note / POD',
    'active',
    '覆盖 MME 进港到尾程装车的标准节点编排。'
  ),
  (
    'SCN-C-03',
    '标准场景 C：东欧协同补段异常恢复',
    'exception_recovery',
    'LANE-URC-MST-RZE-01',
    'RZE',
    'Flight Delay -> 欧陆分拨重编排 -> 东欧入口站接力 -> 异常反馈 -> Recovery Dispatch',
    'Manifest 回传、入口站确认与异常升级同时满足后放行恢复任务',
    'Manifest / 异常备注 / 重新编排计划 / Recovery POD',
    'onboarding',
    '用于东欧入口站接入期的异常恢复样板。'
  );
