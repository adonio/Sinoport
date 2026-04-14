CREATE TABLE IF NOT EXISTS station_governance_templates (
  template_key TEXT PRIMARY KEY,
  template_kind TEXT NOT NULL,
  template_name TEXT NOT NULL,
  station_id TEXT,
  control_level TEXT,
  phase TEXT,
  resource_template_json TEXT NOT NULL DEFAULT '[]',
  capability_template_json TEXT NOT NULL DEFAULT '[]',
  template_payload_json TEXT NOT NULL,
  source_module TEXT NOT NULL,
  export_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_station_governance_templates_kind
  ON station_governance_templates(template_kind, station_id);

CREATE INDEX IF NOT EXISTS idx_station_governance_templates_station
  ON station_governance_templates(station_id, template_kind);

INSERT OR IGNORE INTO station_governance_templates (
  template_key,
  template_kind,
  template_name,
  station_id,
  control_level,
  phase,
  resource_template_json,
  capability_template_json,
  template_payload_json,
  source_module,
  export_name
) VALUES
  (
    'control-level-strong-control',
    'control_level',
    '强控制模板',
    NULL,
    'strong_control',
    NULL,
    '[]',
    '[]',
    '{"template_kind":"control_level","control_level":"strong_control","label":"强控制","description":"适用于高约束站点，强调审批、锁定和留痕。"}',
    'apps/api-worker/migrations/0013_add_station_governance_templates.sql',
    'seed'
  ),
  (
    'control-level-collaborative-control',
    'control_level',
    '协同控制模板',
    NULL,
    'collaborative_control',
    NULL,
    '[]',
    '[]',
    '{"template_kind":"control_level","control_level":"collaborative_control","label":"协同控制","description":"适用于跨团队协作站点，强调分工和联动。"}',
    'apps/api-worker/migrations/0013_add_station_governance_templates.sql',
    'seed'
  ),
  (
    'control-level-interface-visible',
    'control_level',
    '接口可视模板',
    NULL,
    'interface_visible',
    NULL,
    '[]',
    '[]',
    '{"template_kind":"control_level","control_level":"interface_visible","label":"接口可视","description":"适用于以接口对齐为主的站点，强调状态可视和链路可追踪。"}',
    'apps/api-worker/migrations/0013_add_station_governance_templates.sql',
    'seed'
  ),
  (
    'control-level-weak-control',
    'control_level',
    '弱控制模板',
    NULL,
    'weak_control',
    NULL,
    '[]',
    '[]',
    '{"template_kind":"control_level","control_level":"weak_control","label":"弱控制","description":"适用于轻量站点，强调快速接入和最小约束。"}',
    'apps/api-worker/migrations/0013_add_station_governance_templates.sql',
    'seed'
  ),
  (
    'phase-sample-priority',
    'phase',
    '样板优先阶段模板',
    NULL,
    NULL,
    'sample_priority',
    '[]',
    '[]',
    '{"template_kind":"phase","phase":"sample_priority","label":"样板优先","description":"优先作为样板站验证流程和主数据治理。"}',
    'apps/api-worker/migrations/0013_add_station_governance_templates.sql',
    'seed'
  ),
  (
    'phase-active',
    'phase',
    '已上线阶段模板',
    NULL,
    NULL,
    'active',
    '[]',
    '[]',
    '{"template_kind":"phase","phase":"active","label":"已上线","description":"适用于已进入稳定运行的站点。"}',
    'apps/api-worker/migrations/0013_add_station_governance_templates.sql',
    'seed'
  ),
  (
    'phase-onboarding',
    'phase',
    '接入中阶段模板',
    NULL,
    NULL,
    'onboarding',
    '[]',
    '[]',
    '{"template_kind":"phase","phase":"onboarding","label":"接入中","description":"适用于新站接入和主数据补齐阶段。"}',
    'apps/api-worker/migrations/0013_add_station_governance_templates.sql',
    'seed'
  ),
  (
    'phase-pending',
    'phase',
    '待处理阶段模板',
    NULL,
    NULL,
    'pending',
    '[]',
    '[]',
    '{"template_kind":"phase","phase":"pending","label":"待处理","description":"适用于待审批、待配置或待激活状态。"}',
    'apps/api-worker/migrations/0013_add_station_governance_templates.sql',
    'seed'
  ),
  (
    'resource-template-default',
    'resource_template',
    '默认资源模板',
    NULL,
    NULL,
    NULL,
    '[{"resource_code":"team_inbound","resource_name":"Inbound Team","owner_role":"station_supervisor","notes":"进港与发车编排"} , {"resource_code":"team_check","resource_name":"Check Desk","owner_role":"check_worker","notes":"货检与异常复核"} , {"resource_code":"zone_document","resource_name":"Document Desk","owner_role":"document_desk","notes":"单证与放行控制"} , {"resource_code":"device_pda","resource_name":"PDA Fleet","owner_role":"mobile_operator","notes":"移动端执行资源"}]',
    '[]',
    '{"template_kind":"resource_template","label":"默认资源模板","resources":[{"resource_code":"team_inbound","resource_name":"Inbound Team","owner_role":"station_supervisor","notes":"进港与发车编排"},{"resource_code":"team_check","resource_name":"Check Desk","owner_role":"check_worker","notes":"货检与异常复核"},{"resource_code":"zone_document","resource_name":"Document Desk","owner_role":"document_desk","notes":"单证与放行控制"},{"resource_code":"device_pda","resource_name":"PDA Fleet","owner_role":"mobile_operator","notes":"移动端执行资源"}]}',
    'apps/api-worker/migrations/0013_add_station_governance_templates.sql',
    'seed'
  ),
  (
    'capability-template-default',
    'capability_template',
    '默认能力模板',
    NULL,
    NULL,
    NULL,
    '[]',
    '[{"capability_code":"task_assignment","capability_name":"Task Assignment","owner_role":"station_supervisor","enabled":1,"stage":"dispatch","notes":"任务派发与责任分配"} , {"capability_code":"quality_check","capability_name":"Quality Check","owner_role":"check_worker","enabled":1,"stage":"verification","notes":"到货检查与复核"} , {"capability_code":"document_release","capability_name":"Document Release","owner_role":"document_desk","enabled":1,"stage":"release","notes":"单证放行与归档"} , {"capability_code":"mobile_execution","capability_name":"Mobile Execution","owner_role":"mobile_operator","enabled":1,"stage":"execution","notes":"PDA 现场执行"}]',
    '{"template_kind":"capability_template","label":"默认能力模板","capabilities":[{"capability_code":"task_assignment","capability_name":"Task Assignment","owner_role":"station_supervisor","enabled":true,"stage":"dispatch","notes":"任务派发与责任分配"},{"capability_code":"quality_check","capability_name":"Quality Check","owner_role":"check_worker","enabled":true,"stage":"verification","notes":"到货检查与复核"},{"capability_code":"document_release","capability_name":"Document Release","owner_role":"document_desk","enabled":true,"stage":"release","notes":"单证放行与归档"},{"capability_code":"mobile_execution","capability_name":"Mobile Execution","owner_role":"mobile_operator","enabled":true,"stage":"execution","notes":"PDA 现场执行"}]}',
    'apps/api-worker/migrations/0013_add_station_governance_templates.sql',
    'seed'
  );
