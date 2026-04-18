const STATION_GOVERNANCE_TEMPLATES_TABLE = 'station_governance_templates';

type StationGovernanceTemplateKind = 'control_level' | 'phase' | 'resource_template' | 'capability_template';

type StationGovernanceTemplateSeed = {
  template_key: string;
  template_kind: StationGovernanceTemplateKind;
  template_name: string;
  station_id: string | null;
  control_level: string | null;
  phase: string | null;
  resource_template_json: unknown[];
  capability_template_json: unknown[];
  template_payload_json: Record<string, unknown>;
  source_module: string;
  export_name: string;
  created_at?: string;
  updated_at?: string;
};

type StationGovernanceTemplateRow = {
  template_key: string;
  template_kind: StationGovernanceTemplateKind;
  template_name: string;
  station_id: string | null;
  control_level: string | null;
  phase: string | null;
  resource_template_json: string | null;
  capability_template_json: string | null;
  template_payload_json: string | null;
  source_module: string;
  export_name: string;
  created_at: string;
  updated_at: string;
};

type StationGovernanceTemplate = {
  template_key: string;
  template_kind: StationGovernanceTemplateKind;
  template_kind_label: string;
  template_name: string;
  station_id: string | null;
  control_level: string | null;
  control_level_label: string;
  phase: string | null;
  phase_label: string;
  resource_template: unknown[];
  capability_template: unknown[];
  payload: unknown;
  source_module: string;
  export_name: string;
  created_at: string | null;
  updated_at: string | null;
};

type StationGovernanceSummary = {
  station_id: string;
  station_name: string;
  region: string | null;
  control_level: string | null;
  control_level_label: string;
  phase: string | null;
  phase_label: string;
  matched_templates: {
    control_level: StationGovernanceTemplate | null;
    phase: StationGovernanceTemplate | null;
    resource_template: StationGovernanceTemplate | null;
    capability_template: StationGovernanceTemplate | null;
  };
  master_data: {
    station_exists: boolean;
    team_count: number;
    worker_count: number;
    credential_count: number;
    template_count: number;
    control_level_template_count: number;
    phase_template_count: number;
    resource_template_count: number;
    capability_template_count: number;
  };
  checks: Array<{
    check_key: string;
    label: string;
    passed: boolean;
    note: string;
  }>;
  governance_score: number;
  gaps: string[];
  available_control_levels: Array<{ control_level: string; label: string }>;
  available_phases: Array<{ phase: string; label: string }>;
  updated_at: string | null;
};

type StationCopyPackage = {
  package_key: string;
  station_id: string;
  station_name: string;
  template_station_id: string;
  template_station_name: string;
  benchmark_station_id: string;
  benchmark_station_name: string;
  comparison_station_ids: string[];
  comparison_station_labels: Array<{
    station_id: string;
    label: string;
    comparison_type: 'actual' | 'template';
    note: string;
  }>;
  minimum_onboarding_unit: Array<{
    unit_key: string;
    label: string;
    required: boolean;
    note: string;
  }>;
  mandatory_consistency_items: Array<{
    item_key: string;
    label: string;
    source: string;
    note: string;
  }>;
  station_override_items: Array<{
    item_key: string;
    label: string;
    source: string;
    note: string;
  }>;
  readiness_checks: Array<{
    check_key: string;
    label: string;
    gate_status: 'clear' | 'warning' | 'blocked';
    note: string;
  }>;
  rollback_policy: {
    mode: 'template-and-configuration';
    summary: string;
    steps: string[];
  };
};

type StationOnboardingPlaybook = {
  station_id: string;
  station_name: string;
  template_station_id: string;
  template_station_name: string;
  benchmark_station_id: string;
  benchmark_station_name: string;
  sop: {
    scope: string;
    prerequisites: string[];
    steps: Array<{
      step_key: string;
      label: string;
      action: string;
      success_criteria: string;
    }>;
  };
  conflict_rules: Array<{
    rule_key: string;
    label: string;
    category: 'mandatory_consistency' | 'station_override' | 'data_contract' | 'resource_mapping' | 'import_mapping';
    gate_status: 'warning' | 'blocked';
    note: string;
    resolution: string;
  }>;
  onboarding_checklist: Array<{
    item_key: string;
    label: string;
    category: 'identity' | 'runtime' | 'data' | 'reporting' | 'risk';
    required: boolean;
    gate_status: 'clear' | 'warning' | 'blocked';
    note: string;
  }>;
  replay_acceptance: {
    reference_sop_document: string;
    replay_sample_station_id: string;
    replay_scope: string;
    accepted_when: string[];
    rollback_scope: string[];
    excluded_objects: string[];
  };
  completion_policy: {
    warnings_require_manual_ack: boolean;
    completion_criteria: string[];
  };
};

const CONTROL_LEVEL_LABELS: Record<string, string> = {
  strong_control: '强控制',
  collaborative_control: '协同控制',
  interface_visible: '接口可视',
  weak_control: '弱控制'
};

const PHASE_LABELS: Record<string, string> = {
  sample_priority: '样板优先',
  active: '已上线',
  onboarding: '接入中',
  pending: '待处理'
};

const TEMPLATE_KIND_LABELS: Record<StationGovernanceTemplateKind, string> = {
  control_level: '控制层级模板',
  phase: '阶段模板',
  resource_template: '默认资源模板',
  capability_template: '默认能力模板'
};

const DEFAULT_TEMPLATE_SOURCE = 'apps/api-worker/migrations/0013_add_station_governance_templates.sql';
const DEFAULT_TEMPLATE_EXPORT_NAME = 'seed';
const DEFAULT_TEMPLATE_STATION_ID = 'MME';
const DEFAULT_TEMPLATE_STATION_NAME = 'MME 样板站';
const DEFAULT_BENCHMARK_STATION_ID = 'RZE';
const DEFAULT_BENCHMARK_STATION_NAME = 'RZE 模板对照站';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeLabel(value: string | null | undefined, labels: Record<string, string>) {
  if (!value) return '--';
  return labels[value] || value;
}

function normalizeTemplateRow(row: StationGovernanceTemplateRow): StationGovernanceTemplate {
  return {
    template_key: row.template_key,
    template_kind: row.template_kind,
    template_kind_label: TEMPLATE_KIND_LABELS[row.template_kind] || row.template_kind,
    template_name: row.template_name,
    station_id: row.station_id,
    control_level: row.control_level,
    control_level_label: normalizeLabel(row.control_level, CONTROL_LEVEL_LABELS),
    phase: row.phase,
    phase_label: normalizeLabel(row.phase, PHASE_LABELS),
    resource_template: parseJson<unknown[]>(row.resource_template_json, []),
    capability_template: parseJson<unknown[]>(row.capability_template_json, []),
    payload: parseJson<unknown>(row.template_payload_json, null),
    source_module: row.source_module,
    export_name: row.export_name,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function seedTemplate(template: StationGovernanceTemplateSeed): StationGovernanceTemplate {
  return {
    template_key: template.template_key,
    template_kind: template.template_kind,
    template_kind_label: TEMPLATE_KIND_LABELS[template.template_kind],
    template_name: template.template_name,
    station_id: template.station_id,
    control_level: template.control_level,
    control_level_label: normalizeLabel(template.control_level, CONTROL_LEVEL_LABELS),
    phase: template.phase,
    phase_label: normalizeLabel(template.phase, PHASE_LABELS),
    resource_template: template.resource_template_json,
    capability_template: template.capability_template_json,
    payload: template.template_payload_json,
    source_module: template.source_module,
    export_name: template.export_name,
    created_at: template.created_at ?? null,
    updated_at: template.updated_at ?? null
  };
}

function getDefaultTemplates(): StationGovernanceTemplate[] {
  return DEFAULT_TEMPLATE_SEEDS.map(seedTemplate);
}

function filterTemplates(templates: StationGovernanceTemplate[], filters?: { stationId?: string; kind?: StationGovernanceTemplateKind }) {
  return templates.filter((template) => {
    if (filters?.kind && template.template_kind !== filters.kind) {
      return false;
    }

    if (filters?.stationId && template.station_id && template.station_id !== filters.stationId) {
      return false;
    }

    return true;
  });
}

function pickTemplate(
  templates: StationGovernanceTemplate[],
  predicate: (template: StationGovernanceTemplate) => boolean,
  stationId: string
) {
  return (
    templates.find((template) => template.station_id === stationId && predicate(template)) ||
    templates.find((template) => template.station_id === null && predicate(template)) ||
    null
  );
}

function buildSummaryChecks(
  stationExists: boolean,
  matchedTemplates: StationGovernanceSummary['matched_templates'],
  counts: StationGovernanceSummary['master_data']
) {
  const checks = [
    {
      check_key: 'station_record',
      label: '站点主数据',
      passed: stationExists,
      note: stationExists ? '站点基础记录已存在' : '未找到站点基础记录'
    },
    {
      check_key: 'control_level_template',
      label: '控制层级模板',
      passed: Boolean(matchedTemplates.control_level),
      note: matchedTemplates.control_level ? matchedTemplates.control_level.template_name : '未匹配控制层级模板'
    },
    {
      check_key: 'phase_template',
      label: '阶段模板',
      passed: Boolean(matchedTemplates.phase),
      note: matchedTemplates.phase ? matchedTemplates.phase.template_name : '未匹配阶段模板'
    },
    {
      check_key: 'resource_template',
      label: '默认资源模板',
      passed: Boolean(matchedTemplates.resource_template),
      note: matchedTemplates.resource_template ? matchedTemplates.resource_template.template_name : '未配置默认资源模板'
    },
    {
      check_key: 'capability_template',
      label: '默认能力模板',
      passed: Boolean(matchedTemplates.capability_template),
      note: matchedTemplates.capability_template ? matchedTemplates.capability_template.template_name : '未配置默认能力模板'
    },
    {
      check_key: 'team_master_data',
      label: '组织编制',
      passed: counts.team_count > 0,
      note: counts.team_count > 0 ? `${counts.team_count} 个团队` : '尚未建立团队主数据'
    },
    {
      check_key: 'worker_master_data',
      label: '人员主数据',
      passed: counts.worker_count > 0,
      note: counts.worker_count > 0 ? `${counts.worker_count} 名员工` : '尚未建立人员主数据'
    }
  ];

  return checks;
}

function buildGovernanceScore(checks: StationGovernanceSummary['checks']) {
  const score = 100 - checks.filter((check) => !check.passed).length * 12;
  return Math.max(0, Math.min(100, score));
}

const DEFAULT_TEMPLATE_SEEDS: StationGovernanceTemplateSeed[] = [
  {
    template_key: 'control-level-strong-control',
    template_kind: 'control_level',
    template_name: '强控制模板',
    station_id: null,
    control_level: 'strong_control',
    phase: null,
    resource_template_json: [],
    capability_template_json: [],
    template_payload_json: {
      template_kind: 'control_level',
      control_level: 'strong_control',
      label: '强控制',
      description: '适用于高约束站点，强调审批、锁定和留痕。'
    },
    source_module: DEFAULT_TEMPLATE_SOURCE,
    export_name: DEFAULT_TEMPLATE_EXPORT_NAME
  },
  {
    template_key: 'control-level-collaborative-control',
    template_kind: 'control_level',
    template_name: '协同控制模板',
    station_id: null,
    control_level: 'collaborative_control',
    phase: null,
    resource_template_json: [],
    capability_template_json: [],
    template_payload_json: {
      template_kind: 'control_level',
      control_level: 'collaborative_control',
      label: '协同控制',
      description: '适用于跨团队协作站点，强调分工和联动。'
    },
    source_module: DEFAULT_TEMPLATE_SOURCE,
    export_name: DEFAULT_TEMPLATE_EXPORT_NAME
  },
  {
    template_key: 'control-level-interface-visible',
    template_kind: 'control_level',
    template_name: '接口可视模板',
    station_id: null,
    control_level: 'interface_visible',
    phase: null,
    resource_template_json: [],
    capability_template_json: [],
    template_payload_json: {
      template_kind: 'control_level',
      control_level: 'interface_visible',
      label: '接口可视',
      description: '适用于以接口对齐为主的站点，强调状态可视和链路可追踪。'
    },
    source_module: DEFAULT_TEMPLATE_SOURCE,
    export_name: DEFAULT_TEMPLATE_EXPORT_NAME
  },
  {
    template_key: 'control-level-weak-control',
    template_kind: 'control_level',
    template_name: '弱控制模板',
    station_id: null,
    control_level: 'weak_control',
    phase: null,
    resource_template_json: [],
    capability_template_json: [],
    template_payload_json: {
      template_kind: 'control_level',
      control_level: 'weak_control',
      label: '弱控制',
      description: '适用于轻量站点，强调快速接入和最小约束。'
    },
    source_module: DEFAULT_TEMPLATE_SOURCE,
    export_name: DEFAULT_TEMPLATE_EXPORT_NAME
  },
  {
    template_key: 'phase-sample-priority',
    template_kind: 'phase',
    template_name: '样板优先阶段模板',
    station_id: null,
    control_level: null,
    phase: 'sample_priority',
    resource_template_json: [],
    capability_template_json: [],
    template_payload_json: {
      template_kind: 'phase',
      phase: 'sample_priority',
      label: '样板优先',
      description: '优先作为样板站验证流程和主数据治理。'
    },
    source_module: DEFAULT_TEMPLATE_SOURCE,
    export_name: DEFAULT_TEMPLATE_EXPORT_NAME
  },
  {
    template_key: 'phase-active',
    template_kind: 'phase',
    template_name: '已上线阶段模板',
    station_id: null,
    control_level: null,
    phase: 'active',
    resource_template_json: [],
    capability_template_json: [],
    template_payload_json: {
      template_kind: 'phase',
      phase: 'active',
      label: '已上线',
      description: '适用于已进入稳定运行的站点。'
    },
    source_module: DEFAULT_TEMPLATE_SOURCE,
    export_name: DEFAULT_TEMPLATE_EXPORT_NAME
  },
  {
    template_key: 'phase-onboarding',
    template_kind: 'phase',
    template_name: '接入中阶段模板',
    station_id: null,
    control_level: null,
    phase: 'onboarding',
    resource_template_json: [],
    capability_template_json: [],
    template_payload_json: {
      template_kind: 'phase',
      phase: 'onboarding',
      label: '接入中',
      description: '适用于新站接入和主数据补齐阶段。'
    },
    source_module: DEFAULT_TEMPLATE_SOURCE,
    export_name: DEFAULT_TEMPLATE_EXPORT_NAME
  },
  {
    template_key: 'phase-pending',
    template_kind: 'phase',
    template_name: '待处理阶段模板',
    station_id: null,
    control_level: null,
    phase: 'pending',
    resource_template_json: [],
    capability_template_json: [],
    template_payload_json: {
      template_kind: 'phase',
      phase: 'pending',
      label: '待处理',
      description: '适用于待审批、待配置或待激活状态。'
    },
    source_module: DEFAULT_TEMPLATE_SOURCE,
    export_name: DEFAULT_TEMPLATE_EXPORT_NAME
  },
  {
    template_key: 'resource-template-default',
    template_kind: 'resource_template',
    template_name: '默认资源模板',
    station_id: null,
    control_level: null,
    phase: null,
    resource_template_json: [
      {
        resource_code: 'team_inbound',
        resource_name: 'Inbound Team',
        owner_role: 'station_supervisor',
        notes: '进港与发车编排'
      },
      {
        resource_code: 'team_check',
        resource_name: 'Check Desk',
        owner_role: 'check_worker',
        notes: '货检与异常复核'
      },
      {
        resource_code: 'zone_document',
        resource_name: 'Document Desk',
        owner_role: 'document_desk',
        notes: '单证与放行控制'
      },
      {
        resource_code: 'device_pda',
        resource_name: 'PDA Fleet',
        owner_role: 'mobile_operator',
        notes: '移动端执行资源'
      }
    ],
    capability_template_json: [],
    template_payload_json: {
      template_kind: 'resource_template',
      label: '默认资源模板',
      resources: [
        {
          resource_code: 'team_inbound',
          resource_name: 'Inbound Team',
          owner_role: 'station_supervisor',
          notes: '进港与发车编排'
        },
        {
          resource_code: 'team_check',
          resource_name: 'Check Desk',
          owner_role: 'check_worker',
          notes: '货检与异常复核'
        },
        {
          resource_code: 'zone_document',
          resource_name: 'Document Desk',
          owner_role: 'document_desk',
          notes: '单证与放行控制'
        },
        {
          resource_code: 'device_pda',
          resource_name: 'PDA Fleet',
          owner_role: 'mobile_operator',
          notes: '移动端执行资源'
        }
      ]
    },
    source_module: DEFAULT_TEMPLATE_SOURCE,
    export_name: DEFAULT_TEMPLATE_EXPORT_NAME
  },
  {
    template_key: 'capability-template-default',
    template_kind: 'capability_template',
    template_name: '默认能力模板',
    station_id: null,
    control_level: null,
    phase: null,
    resource_template_json: [],
    capability_template_json: [
      {
        capability_code: 'task_assignment',
        capability_name: 'Task Assignment',
        owner_role: 'station_supervisor',
        enabled: true,
        stage: 'dispatch',
        notes: '任务派发与责任分配'
      },
      {
        capability_code: 'quality_check',
        capability_name: 'Quality Check',
        owner_role: 'check_worker',
        enabled: true,
        stage: 'verification',
        notes: '到货检查与复核'
      },
      {
        capability_code: 'document_release',
        capability_name: 'Document Release',
        owner_role: 'document_desk',
        enabled: true,
        stage: 'release',
        notes: '单证放行与归档'
      },
      {
        capability_code: 'mobile_execution',
        capability_name: 'Mobile Execution',
        owner_role: 'mobile_operator',
        enabled: true,
        stage: 'execution',
        notes: 'PDA 现场执行'
      }
    ],
    template_payload_json: {
      template_kind: 'capability_template',
      label: '默认能力模板',
      capabilities: [
        {
          capability_code: 'task_assignment',
          capability_name: 'Task Assignment',
          owner_role: 'station_supervisor',
          enabled: true,
          stage: 'dispatch',
          notes: '任务派发与责任分配'
        },
        {
          capability_code: 'quality_check',
          capability_name: 'Quality Check',
          owner_role: 'check_worker',
          enabled: true,
          stage: 'verification',
          notes: '到货检查与复核'
        },
        {
          capability_code: 'document_release',
          capability_name: 'Document Release',
          owner_role: 'document_desk',
          enabled: true,
          stage: 'release',
          notes: '单证放行与归档'
        },
        {
          capability_code: 'mobile_execution',
          capability_name: 'Mobile Execution',
          owner_role: 'mobile_operator',
          enabled: true,
          stage: 'execution',
          notes: 'PDA 现场执行'
        }
      ]
    },
    source_module: DEFAULT_TEMPLATE_SOURCE,
    export_name: DEFAULT_TEMPLATE_EXPORT_NAME
  }
];

export function buildDefaultStationGovernanceTemplates() {
  return getDefaultTemplates();
}

export async function loadStationGovernanceTemplates(
  db: any,
  filters?: { stationId?: string; kind?: StationGovernanceTemplateKind }
) {
  const fallback = filterTemplates(getDefaultTemplates(), filters);

  if (!db) {
    return fallback;
  }

  try {
    const where: string[] = [];
    const bindValues: unknown[] = [];

    if (filters?.kind) {
      where.push('template_kind = ?');
      bindValues.push(filters.kind);
    }

    if (filters?.stationId) {
      where.push('(station_id IS NULL OR station_id = ?)');
      bindValues.push(filters.stationId);
    }

    const sql = `
      SELECT
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
        export_name,
        created_at,
        updated_at
      FROM ${STATION_GOVERNANCE_TEMPLATES_TABLE}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY template_kind ASC, template_key ASC
    `;

    const rows = await db.prepare(sql).bind(...bindValues).all();
    const templates: StationGovernanceTemplate[] = ((rows?.results || []) as StationGovernanceTemplateRow[]).map(normalizeTemplateRow);

    return templates.length ? templates : fallback;
  } catch {
    return fallback;
  }
}

export async function loadStationGovernanceTemplate(db: any, templateKey: string) {
  const fallback = getDefaultTemplates().find((template) => template.template_key === templateKey) || null;

  if (!db) {
    return fallback;
  }

  try {
    const row = (await db
      .prepare(
        `
          SELECT
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
            export_name,
            created_at,
            updated_at
          FROM ${STATION_GOVERNANCE_TEMPLATES_TABLE}
          WHERE template_key = ?
          LIMIT 1
        `
      )
      .bind(templateKey)
      .first()) as StationGovernanceTemplateRow | null;

    if (row) {
      return normalizeTemplateRow(row);
    }
  } catch {
    // Fall back to seeded defaults below.
  }

  return fallback;
}

export async function loadStationGovernanceSummary(db: any, stationId: string): Promise<StationGovernanceSummary> {
  const defaultStationName = stationId;

  if (!db) {
    const templates = getDefaultTemplates();
    const counts = {
      station_exists: false,
      team_count: 0,
      worker_count: 0,
      credential_count: 0,
      template_count: templates.length,
      control_level_template_count: templates.filter((template) => template.template_kind === 'control_level').length,
      phase_template_count: templates.filter((template) => template.template_kind === 'phase').length,
      resource_template_count: templates.filter((template) => template.template_kind === 'resource_template').length,
      capability_template_count: templates.filter((template) => template.template_kind === 'capability_template').length
    };
    const stationChecks = buildSummaryChecks(false, {
      control_level: null,
      phase: null,
      resource_template: null,
      capability_template: null
    }, counts);

    return {
      station_id: stationId,
      station_name: defaultStationName,
      region: null,
      control_level: null,
      control_level_label: '--',
      phase: null,
      phase_label: '--',
      matched_templates: {
        control_level: null,
        phase: null,
        resource_template: null,
        capability_template: null
      },
      master_data: counts,
      checks: stationChecks,
      governance_score: buildGovernanceScore(stationChecks),
      gaps: stationChecks.filter((check) => !check.passed).map((check) => check.check_key),
      available_control_levels: templates
        .filter((template) => template.template_kind === 'control_level' && template.control_level)
        .map((template) => ({ control_level: template.control_level as string, label: template.control_level_label })),
      available_phases: templates
        .filter((template) => template.template_kind === 'phase' && template.phase)
        .map((template) => ({ phase: template.phase as string, label: template.phase_label })),
      updated_at: null
    };
  }

  const [stationRow, templates, teamCountRow, workerCountRow, credentialCountRow] = await Promise.all([
    db
      .prepare(
        `
          SELECT station_id, station_name, region, control_level, phase, updated_at
          FROM stations
          WHERE station_id = ?
          LIMIT 1
        `
      )
      .bind(stationId)
      .first(),
    loadStationGovernanceTemplates(db, { stationId }),
    db.prepare(`SELECT COUNT(*) AS count FROM teams WHERE station_id = ?`).bind(stationId).first(),
    db.prepare(`SELECT COUNT(*) AS count FROM workers WHERE station_id = ?`).bind(stationId).first(),
    db.prepare(`SELECT COUNT(*) AS count FROM station_credentials WHERE user_id IN (SELECT user_id FROM user_roles WHERE station_id = ? OR station_id IS NULL)`).bind(stationId).first()
  ]);

  const stationExists = Boolean(stationRow);
  const controlLevel = stationRow?.control_level ? String(stationRow.control_level) : null;
  const phase = stationRow?.phase ? String(stationRow.phase) : null;
  const templatePool: StationGovernanceTemplate[] = templates.filter(
    (template: StationGovernanceTemplate) => template.station_id === null || template.station_id === stationId
  );

  const matchedTemplates = {
    control_level: controlLevel
      ? pickTemplate(templatePool, (template) => template.template_kind === 'control_level' && template.control_level === controlLevel, stationId)
      : null,
    phase: phase ? pickTemplate(templatePool, (template) => template.template_kind === 'phase' && template.phase === phase, stationId) : null,
    resource_template: pickTemplate(templatePool, (template) => template.template_kind === 'resource_template', stationId),
    capability_template: pickTemplate(templatePool, (template) => template.template_kind === 'capability_template', stationId)
  };

  const counts = {
    station_exists: stationExists,
    team_count: Number((teamCountRow as { count?: number } | null)?.count ?? 0),
    worker_count: Number((workerCountRow as { count?: number } | null)?.count ?? 0),
    credential_count: Number((credentialCountRow as { count?: number } | null)?.count ?? 0),
    template_count: templatePool.length,
    control_level_template_count: templatePool.filter((template: StationGovernanceTemplate) => template.template_kind === 'control_level').length,
    phase_template_count: templatePool.filter((template: StationGovernanceTemplate) => template.template_kind === 'phase').length,
    resource_template_count: templatePool.filter((template: StationGovernanceTemplate) => template.template_kind === 'resource_template').length,
    capability_template_count: templatePool.filter((template: StationGovernanceTemplate) => template.template_kind === 'capability_template').length
  };

  const checks = buildSummaryChecks(stationExists, matchedTemplates, counts);

  const availableControlLevels = Array.from(
    new Map(
      templatePool
        .filter((template: StationGovernanceTemplate) => template.template_kind === 'control_level' && template.control_level)
        .map((template: StationGovernanceTemplate) => [String(template.control_level), String(template.control_level_label)] as const)
    ).entries()
  ).map(([controlLevelKey, label]: readonly [string, string]) => ({ control_level: controlLevelKey, label }));

  const availablePhases = Array.from(
    new Map(
      templatePool
        .filter((template: StationGovernanceTemplate) => template.template_kind === 'phase' && template.phase)
        .map((template: StationGovernanceTemplate) => [String(template.phase), String(template.phase_label)] as const)
    ).entries()
  ).map(([phaseKey, label]: readonly [string, string]) => ({ phase: phaseKey, label }));

  return {
    station_id: stationId,
    station_name: stationRow?.station_name ? String(stationRow.station_name) : defaultStationName,
    region: stationRow?.region ? String(stationRow.region) : null,
    control_level: controlLevel,
    control_level_label: normalizeLabel(controlLevel, CONTROL_LEVEL_LABELS),
    phase,
    phase_label: normalizeLabel(phase, PHASE_LABELS),
    matched_templates: matchedTemplates,
    master_data: counts,
    checks,
    governance_score: buildGovernanceScore(checks),
    gaps: checks.filter((check) => !check.passed).map((check) => check.check_key),
    available_control_levels: availableControlLevels,
    available_phases: availablePhases,
    updated_at: stationRow?.updated_at ? String(stationRow.updated_at) : null
  };
}

export async function loadStationCopyPackage(db: any, stationId: string): Promise<StationCopyPackage> {
  const summary = await loadStationGovernanceSummary(db, stationId);
  const templateStationId = DEFAULT_TEMPLATE_STATION_ID;
  const benchmarkStationId = stationId === DEFAULT_BENCHMARK_STATION_ID ? 'MME' : DEFAULT_BENCHMARK_STATION_ID;

  const [templateSummary, benchmarkSummary] = await Promise.all([
    loadStationGovernanceSummary(db, templateStationId),
    loadStationGovernanceSummary(db, benchmarkStationId)
  ]);

  return {
    package_key: `station-copy-package-${summary.station_id.toLowerCase()}`,
    station_id: summary.station_id,
    station_name: summary.station_name,
    template_station_id: templateSummary.station_id || DEFAULT_TEMPLATE_STATION_ID,
    template_station_name: templateSummary.station_name || DEFAULT_TEMPLATE_STATION_NAME,
    benchmark_station_id: benchmarkSummary.station_id || benchmarkStationId,
    benchmark_station_name: benchmarkSummary.station_name || DEFAULT_BENCHMARK_STATION_NAME,
    comparison_station_ids: [summary.station_id, benchmarkSummary.station_id || benchmarkStationId],
    comparison_station_labels: [
      {
        station_id: summary.station_id,
        label: summary.station_name,
        comparison_type: 'actual',
        note: '真实主样板站，作为复制包的当前基线。'
      },
      {
        station_id: benchmarkSummary.station_id || benchmarkStationId,
        label: benchmarkSummary.station_name || DEFAULT_BENCHMARK_STATION_NAME,
        comparison_type: 'template',
        note: '模板对照站，仅用于复制包对比，不代表第二真实试运行站。'
      }
    ],
    minimum_onboarding_unit: [
      {
        unit_key: 'station_record',
        label: '站点主记录',
        required: true,
        note: '必须先建立 stations 主记录，后续模板与资源才能挂接。'
      },
      {
        unit_key: 'control_level_and_phase',
        label: '控制层级与阶段',
        required: true,
        note: '控制层级和 phase 决定模板匹配、质量口径与报表对比。'
      },
      {
        unit_key: 'resource_and_capability_templates',
        label: '资源模板与能力模板',
        required: true,
        note: '至少要绑定默认资源模板和默认能力模板，保证站点接入检查有统一基线。'
      },
      {
        unit_key: 'team_and_worker_master_data',
        label: '团队与人员主数据',
        required: true,
        note: '最小接入单元必须包含团队与人员，否则站点治理检查无法通过。'
      },
      {
        unit_key: 'daily_report_and_quality_gate',
        label: '日报锚点与质量门槛',
        required: true,
        note: '平台/站点日报必须能返回 reportAnchor 和质量门槛，才能进入多站点对比。'
      }
    ],
    mandatory_consistency_items: [
      {
        item_key: 'control_level_template',
        label: '控制层级模板',
        source: 'station_governance_templates',
        note: '复制包必须沿用同一控制层级模板口径，不允许逐站自定义模板语义。'
      },
      {
        item_key: 'phase_template',
        label: '阶段模板',
        source: 'station_governance_templates',
        note: 'phase 模板必须统一，保证接入状态和治理检查口径一致。'
      },
      {
        item_key: 'resource_template',
        label: '默认资源模板',
        source: 'station_governance_templates',
        note: '资源模板结构必须一致，避免接入时逐页补资源。'
      },
      {
        item_key: 'capability_template',
        label: '默认能力模板',
        source: 'station_governance_templates',
        note: '能力模板结构必须一致，保证任务、文档、移动执行能力的最小闭环。'
      },
      {
        item_key: 'report_and_quality_contract',
        label: '日报与质量契约',
        source: 'daily reports + quality checklist',
        note: 'reportAnchor、qualitySummary、qualityChecklist、refreshPolicy、traceability 必须全部存在。'
      },
      {
        item_key: 'audit_and_import_contract',
        label: '导入与审计契约',
        source: 'import_requests + audit_events',
        note: '导入账本、幂等键和审计链必须保持一致，才能支持复制回放与回滚。'
      }
    ],
    station_override_items: [
      {
        item_key: 'station_identity',
        label: '站点名称与区域',
        source: 'stations',
        note: '站点名称、区域、机场代码可按站点覆盖。'
      },
      {
        item_key: 'team_assignment',
        label: '团队编制与班次分配',
        source: 'teams/workers',
        note: '团队人数、班次排布、值班人可按站点覆盖，但角色结构必须满足模板最低要求。'
      },
      {
        item_key: 'device_and_vehicle_inventory',
        label: '设备与车辆清单',
        source: 'resources + vehicles',
        note: '具体设备编号、车辆清单和 PDA 库存可按站点覆盖。'
      },
      {
        item_key: 'local_sla_threshold',
        label: '本地 SLA 阈值',
        source: 'station reports / local ops policy',
        note: 'SLA 数值可覆盖，但指标定义和计算口径必须一致。'
      }
    ],
    readiness_checks: summary.checks.map((check) => ({
      check_key: check.check_key,
      label: check.label,
      gate_status: check.passed ? 'clear' : 'warning',
      note: check.note
    })),
    rollback_policy: {
      mode: 'template-and-configuration',
      summary: 'M9 固定采用“模板 + 配置级回滚”，禁止只回滚模板不回滚已落站点配置。',
      steps: [
        '先冻结目标站点的模板变更窗口，记录 package_key、station_id 和接入批次。',
        '回滚时先撤销目标站点的模板绑定和接入检查结果，再恢复上一个稳定模板快照。',
        '恢复后必须重新执行治理检查、日报质量检查和导入回放，确认站点回到上一稳定状态。'
      ]
    }
  };
}

export async function loadStationOnboardingPlaybook(db: any, stationId: string): Promise<StationOnboardingPlaybook> {
  const copyPackage = await loadStationCopyPackage(db, stationId);
  const summary = await loadStationGovernanceSummary(db, stationId);
  const blockedChecks = new Set(['station_record', 'control_level_template', 'phase_template', 'resource_template', 'capability_template']);

  return {
    station_id: copyPackage.station_id,
    station_name: copyPackage.station_name,
    template_station_id: copyPackage.template_station_id,
    template_station_name: copyPackage.template_station_name,
    benchmark_station_id: copyPackage.benchmark_station_id,
    benchmark_station_name: copyPackage.benchmark_station_name,
    sop: {
      scope: '站点复制模板绑定 -> 接入检查 -> 导入回放 -> 报表/质量/审计验收',
      prerequisites: [
        '站点主记录已建立，并已确定控制层级与 phase。',
        '已绑定复制模板包，并冻结模板变更窗口。',
        '正式导入链和审计链可用，且可以回放 MME 样板站的最小闭环。'
      ],
      steps: [
        {
          step_key: 'bind-copy-package',
          label: '绑定复制模板包',
          action: '读取 station copy package，确认主样板站、模板对照站、强制一致项与可覆盖项。',
          success_criteria: '模板包已绑定，且未出现未解释的强制一致项冲突。'
        },
        {
          step_key: 'complete-minimum-onboarding-unit',
          label: '补齐最小接入单元',
          action: '按最小接入单元补齐主记录、模板、团队、人员、日报锚点与质量门槛。',
          success_criteria: 'minimum_onboarding_unit 对应对象均已具备，治理检查不再缺主项。'
        },
        {
          step_key: 'run-onboarding-checklist',
          label: '执行接入检查清单',
          action: '逐项执行 identity/runtime/data/reporting/risk 检查，并记录 warning 与 blocked 项。',
          success_criteria: '不存在 blocked 项；warning 已记录并完成人工确认。'
        },
        {
          step_key: 'replay-template-scope',
          label: '执行样板回放',
          action: '按 MME 生产试运行 SOP 回放最小导入链，验证对象链、日报、质量检查与审计链。',
          success_criteria: '回放后生成的对象链、日报和审计结果与模板口径一致。'
        },
        {
          step_key: 'freeze-acceptance-record',
          label: '冻结接入验收记录',
          action: '输出接入验收记录，附带 warning、回滚方案和后续待办。',
          success_criteria: '形成可回放、可回滚、可审计的正式接入记录。'
        }
      ]
    },
    conflict_rules: [
      {
        rule_key: 'mandatory-station-identity',
        label: '站点主标识冲突',
        category: 'mandatory_consistency',
        gate_status: 'blocked',
        note: '站点编码、控制层级、关键审计开关和 blocked 质量门槛与模板不一致时，视为阻断。',
        resolution: '优先修正站点主记录与模板绑定，不允许站点覆盖强制一致项。'
      },
      {
        rule_key: 'override-configuration-drift',
        label: '可覆盖项差异',
        category: 'station_override',
        gate_status: 'warning',
        note: '报表展示文案、班组映射、可见角色和非关键提示允许覆盖，但必须记录差异。',
        resolution: '保留站点覆盖，同时在接入验收记录中列出差异与责任人。'
      },
      {
        rule_key: 'report-contract-drift',
        label: '日报口径冲突',
        category: 'data_contract',
        gate_status: 'warning',
        note: '日报与质量检查表字段存在但与模板说明不完全一致时，先按模板标准输出，并标记 warning。',
        resolution: '以模板口径为准重算日报，若仍不一致，再调整站点配置。'
      },
      {
        rule_key: 'resource-mapping-conflict',
        label: '资源绑定冲突',
        category: 'resource_mapping',
        gate_status: 'warning',
        note: '设备、班组、区域发生重复绑定时，可暂存但不能进入接入完成态。',
        resolution: '先清理重复资源映射，再重跑接入检查。'
      },
      {
        rule_key: 'import-field-mapping-conflict',
        label: '导入字段映射冲突',
        category: 'import_mapping',
        gate_status: 'blocked',
        note: '正式导入链字段映射与模板样板冲突时，不允许带着问题进入接入完成态。',
        resolution: '优先修模板字段映射和导入配置，再重新回放。'
      }
    ],
    onboarding_checklist: [
      {
        item_key: 'identity-station-record',
        label: '站点主记录与控制层级',
        category: 'identity',
        required: true,
        gate_status: summary.master_data.station_exists ? 'clear' : 'blocked',
        note: summary.master_data.station_exists ? '站点主记录已建立。' : '未找到站点主记录，不能进入接入流程。'
      },
      {
        item_key: 'runtime-team-worker',
        label: '班组与人员主数据',
        category: 'runtime',
        required: true,
        gate_status: summary.master_data.team_count > 0 && summary.master_data.worker_count > 0 ? 'clear' : 'blocked',
        note:
          summary.master_data.team_count > 0 && summary.master_data.worker_count > 0
            ? `已建立 ${summary.master_data.team_count} 个团队、${summary.master_data.worker_count} 名人员。`
            : '团队或人员主数据缺失，不能完成接入。'
      },
      {
        item_key: 'data-import-contract',
        label: '正式导入链与字段映射',
        category: 'data',
        required: true,
        gate_status: 'clear',
        note: '接入验收必须使用正式导入链回放 MME 样板站最小闭环。'
      },
      {
        item_key: 'reporting-daily-quality',
        label: '日报锚点与质量检查表',
        category: 'reporting',
        required: true,
        gate_status: summary.gaps.includes('resource_template') || summary.gaps.includes('capability_template') ? 'warning' : 'clear',
        note: '平台日报、站点日报和 qualityChecklist 必须都能返回可追溯结果。'
      },
      {
        item_key: 'risk-warning-ack',
        label: 'Warning 项人工确认',
        category: 'risk',
        required: true,
        gate_status: 'warning',
        note: '本月允许 warning 带入接入完成态，但必须在验收记录中明确人工确认。'
      }
    ],
    replay_acceptance: {
      reference_sop_document: 'docs/Sinoport_OS_MME_生产试运行SOP_v1.0.md',
      replay_sample_station_id: 'MME',
      replay_scope: 'inbound bundle -> flight -> shipment -> awb -> task -> audit',
      accepted_when: [
        '模板绑定与最小接入单元已齐备。',
        '正式导入链回放成功，且对象链回读完整。',
        '平台日报、站点日报、质量检查表和审计链回读结果符合模板口径。'
      ],
      rollback_scope: [
        '站点模板绑定',
        '站点配置覆盖项',
        '班组 / 区域 / 设备映射',
        '报表展示与治理开关'
      ],
      excluded_objects: ['已落库的真实业务导入数据', '审计事件', '已形成的日报结果']
    },
    completion_policy: {
      warnings_require_manual_ack: true,
      completion_criteria: [
        '不存在未解释的强制一致项冲突。',
        '接入检查清单无 blocked 项。',
        '回滚方案已准备，且导入回放可重复执行。',
        '已形成正式接入验收记录。'
      ]
    }
  };
}

type PlatformStationCapabilityMatrixStation = {
  code: string;
  name: string;
  region: string;
  control: string;
  phase: string;
  control_level: string | null;
  phase_key: string | null;
  archived: boolean;
  updatedAt: string;
};

type PlatformStationCapabilityTemplateItem = {
  capability_code: string;
  capability_name: string;
  owner_role: string | null;
  enabled: boolean;
  stage: string | null;
  notes: string | null;
};

type PlatformStationCapabilityColumn = {
  key: string;
  label: string;
  note: string;
  ownerRole: string | null;
  stage: string | null;
};

type PlatformStationCapabilityRow = {
  code: string;
  name: string;
  region: string;
  control: string;
  phase: string;
  promise: string;
  readiness: string;
  governanceScore: number;
  governanceScoreLabel: string;
  risk: string;
  capabilityMatrix: Record<string, 'yes' | 'building' | 'no'>;
  templateName: string | null;
  updatedAt: string | null;
};

function normalizeCapabilityTemplateItems(
  template: StationGovernanceTemplate | null,
): PlatformStationCapabilityTemplateItem[] {
  const fallbackPayload =
    template &&
    template.payload &&
    typeof template.payload === 'object' &&
    !Array.isArray(template.payload)
      ? (template.payload as Record<string, unknown>)
      : null;
  const rawItems = Array.isArray(template?.capability_template)
    ? template.capability_template
    : Array.isArray(fallbackPayload?.capabilities)
      ? fallbackPayload.capabilities
      : [];

  return rawItems
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const capabilityCode = String(record.capability_code || '').trim();

      if (!capabilityCode) {
        return null;
      }

      return {
        capability_code: capabilityCode,
        capability_name: String(record.capability_name || capabilityCode).trim(),
        owner_role: String(record.owner_role || '').trim() || null,
        enabled: record.enabled !== false,
        stage: String(record.stage || '').trim() || null,
        notes: String(record.notes || '').trim() || null
      } satisfies PlatformStationCapabilityTemplateItem;
    })
    .filter(Boolean) as PlatformStationCapabilityTemplateItem[];
}

function formatGovernanceGapLabel(summary: StationGovernanceSummary, gapKey: string) {
  const matchedCheck = summary.checks.find((item) => item.check_key === gapKey);
  return matchedCheck?.label || gapKey;
}

function buildCapabilityStatus(
  station: PlatformStationCapabilityMatrixStation,
  summary: StationGovernanceSummary,
  item: PlatformStationCapabilityTemplateItem,
): 'yes' | 'building' | 'no' {
  if (!item.enabled || station.archived) {
    return 'no';
  }

  if (
    !summary.master_data.station_exists ||
    summary.gaps.includes('station_record') ||
    summary.gaps.includes('capability_template')
  ) {
    return 'no';
  }

  if (
    station.phase_key === 'pending' ||
    station.phase_key === 'onboarding' ||
    summary.gaps.length > 0 ||
    summary.governance_score < 80
  ) {
    return 'building';
  }

  return 'yes';
}

function buildCapabilityReadiness(
  station: PlatformStationCapabilityMatrixStation,
  summary: StationGovernanceSummary,
) {
  if (station.archived) {
    return 'Archived';
  }

  if (
    !summary.master_data.station_exists ||
    station.phase_key === 'pending' ||
    summary.gaps.includes('station_record')
  ) {
    return 'Blocked';
  }

  if (station.phase_key === 'onboarding' || summary.gaps.length > 0 || summary.governance_score < 80) {
    return 'Building';
  }

  return 'Ready';
}

function buildCapabilityRisk(summary: StationGovernanceSummary) {
  if (summary.gaps.length) {
    return summary.gaps
      .slice(0, 2)
      .map((gapKey) => formatGovernanceGapLabel(summary, gapKey))
      .join(' / ');
  }

  const failedCheck = summary.checks.find((item) => !item.passed);
  if (failedCheck) {
    return failedCheck.label;
  }

  return '治理检查通过';
}

function buildCapabilityPromise(
  station: PlatformStationCapabilityMatrixStation,
  summary: StationGovernanceSummary,
) {
  if (station.archived) {
    return 'Archived';
  }

  if (station.phase_key === 'pending' || !summary.master_data.station_exists) {
    return '待接入';
  }

  if (station.phase_key === 'onboarding' || summary.gaps.length > 0) {
    return 'Onboarding';
  }

  return summary.governance_score >= 90 ? 'Stable' : 'Managed';
}

export async function loadPlatformStationCapabilityMatrix(
  db: any,
  stations: PlatformStationCapabilityMatrixStation[],
) {
  const summaries = await Promise.all(
    stations.map(async (station) => ({
      station,
      summary: await loadStationGovernanceSummary(db, station.code)
    })),
  );

  const columnMap = new Map<string, PlatformStationCapabilityColumn>();

  summaries.forEach(({ summary }) => {
    normalizeCapabilityTemplateItems(summary.matched_templates.capability_template).forEach((item) => {
      if (!columnMap.has(item.capability_code)) {
        columnMap.set(item.capability_code, {
          key: item.capability_code,
          label: item.capability_name,
          note: item.notes || '治理模板能力项',
          ownerRole: item.owner_role,
          stage: item.stage
        });
      }
    });
  });

  const stationCapabilityColumns = Array.from(columnMap.values()).sort((left, right) =>
    left.label.localeCompare(right.label, 'zh-CN'),
  );

  const platformStationCapabilityRows = summaries.map(({ station, summary }) => {
    const capabilityItems = normalizeCapabilityTemplateItems(summary.matched_templates.capability_template);
    const statusMap = stationCapabilityColumns.reduce<Record<string, 'yes' | 'building' | 'no'>>(
      (accumulator, column) => {
        const matchedItem = capabilityItems.find((item) => item.capability_code === column.key);
        accumulator[column.key] = matchedItem
          ? buildCapabilityStatus(station, summary, matchedItem)
          : 'no';
        return accumulator;
      },
      {},
    );

    return {
      code: station.code,
      name: station.name,
      region: station.region,
      control: station.control,
      phase: station.phase,
      promise: buildCapabilityPromise(station, summary),
      readiness: buildCapabilityReadiness(station, summary),
      governanceScore: summary.governance_score,
      governanceScoreLabel: `${summary.governance_score}/100`,
      risk: buildCapabilityRisk(summary),
      capabilityMatrix: statusMap,
      templateName: summary.matched_templates.capability_template?.template_name || null,
      updatedAt: summary.updated_at || station.updatedAt || null
    } satisfies PlatformStationCapabilityRow;
  });

  return {
    stationCapabilityColumns,
    platformStationCapabilityRows,
    stationCapabilitiesMeta: {
      source: 'station_governance',
      total: platformStationCapabilityRows.length
    }
  };
}
