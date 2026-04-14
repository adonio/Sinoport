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
