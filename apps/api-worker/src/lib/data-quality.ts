type DataQualityRuleRow = {
  rule_id: string;
  station_id: string | null;
  object_type: string;
  rule_code: string;
  rule_name: string;
  description: string;
  rule_stage: string;
  severity: string;
  blocking_default: number;
  active: number;
  metadata_json: string | null;
};

type DataQualityIssueRow = {
  issue_id: string;
  station_id: string;
  issue_date: string;
  object_type: string;
  object_id: string | null;
  rule_id: string | null;
  issue_code: string;
  severity: string;
  status: string;
  blocking_flag: number;
  source_type: string;
  source_key: string | null;
  import_request_id: string | null;
  summary: string;
  details_json: string | null;
  suggested_action: string | null;
  audit_object_type: string | null;
  audit_object_id: string | null;
  detected_at: string;
  resolved_at: string | null;
};

type DataQualityIssueDraft = {
  station_id: string;
  issue_date: string;
  object_type: string;
  object_id?: string | null;
  rule_id: string;
  issue_code: string;
  severity: string;
  blocking_flag: number;
  source_type: string;
  source_key?: string | null;
  import_request_id?: string | null;
  summary: string;
  details?: Record<string, unknown>;
  suggested_action?: string;
  audit_object_type?: string | null;
  audit_object_id?: string | null;
};

function parseJson(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizeToken(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function buildIssueId(draft: DataQualityIssueDraft) {
  const stationToken = sanitizeToken(draft.station_id);
  const dateToken = sanitizeToken(draft.issue_date);
  const ruleToken = sanitizeToken(draft.issue_code);
  const objectToken = sanitizeToken(draft.object_id || draft.source_key || draft.import_request_id || 'station');
  return `DQI-${stationToken}-${dateToken}-${ruleToken}-${objectToken}`.slice(0, 160);
}

function buildQualityScore(totalIssues: number, blockingIssues: number) {
  const score = 100 - blockingIssues * 20 - totalIssues * 5;
  return Math.max(0, score);
}

function summarizeByKey(items: Array<{ key: string }>) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.key] = (acc[item.key] || 0) + 1;
    return acc;
  }, {});
}

function buildGateStatus(openIssues: Array<{ blocking_flag: boolean }>) {
  if (openIssues.some((item) => item.blocking_flag)) {
    return 'blocked';
  }

  if (openIssues.length) {
    return 'warning';
  }

  return 'clear';
}

function buildStationQualityChecklist(
  issues: Array<{
    issue_code: string;
    severity: string;
    status: string;
    blocking_flag: boolean;
    summary: string;
    suggested_action: string | null;
  }>
) {
  const openIssues = issues.filter((item) => item.status !== 'Resolved');
  const blockingIssues = openIssues.filter((item) => item.blocking_flag);
  const gateStatus = buildGateStatus(openIssues);
  const blockingCandidateRules = Array.from(new Set(blockingIssues.map((item) => item.issue_code)));
  const operationalActions = Array.from(
    new Set(openIssues.map((item) => item.suggested_action).filter((item): item is string => Boolean(item && item.trim())))
  ).slice(0, 5);

  return {
    gate_status: gateStatus,
    blocking_candidate_rules: blockingCandidateRules,
    operational_actions: operationalActions,
    checklist_rows: [
      {
        key: 'gate-status',
        title: '导入闸口状态',
        status: gateStatus,
        summary:
          gateStatus === 'blocked'
            ? `存在 ${blockingIssues.length} 条阻断候选问题`
            : gateStatus === 'warning'
              ? `存在 ${openIssues.length} 条待处理质量问题`
              : '当日未发现开放中的质量问题',
        actions:
          operationalActions.length > 0
            ? operationalActions
            : ['继续执行日报巡检，无需额外阻断动作']
      },
      {
        key: 'blocking-rules',
        title: '阻断候选规则',
        status: blockingCandidateRules.length ? 'attention' : 'clear',
        summary: blockingCandidateRules.length ? blockingCandidateRules.join(' / ') : '暂无默认阻断候选规则命中',
        actions:
          blockingCandidateRules.length > 0
            ? ['按规则逐项核对 import_request、对象链和审计链，再决定是否解除阻断']
            : ['维持开放问题跟踪，不触发导入阻断']
      },
      {
        key: 'top-issues',
        title: '问题复盘入口',
        status: openIssues.length ? 'attention' : 'clear',
        summary: openIssues.length
          ? openIssues
              .slice(0, 3)
              .map((item) => `${item.issue_code} (${item.severity})`)
              .join(' / ')
          : '暂无开放问题',
        actions:
          openIssues.length > 0
            ? openIssues
                .slice(0, 3)
                .map((item) => item.summary)
            : ['当日无需进入质量问题复盘']
      }
    ]
  };
}

function buildPlatformQualityChecklist(
  rows: Array<{ station_id: string; severity: string; status: string; blocking_flag: number }>
) {
  const openRows = rows.filter((item) => item.status !== 'Resolved');
  const blockingRows = openRows.filter((item) => Boolean(item.blocking_flag));
  const gateStatus = buildGateStatus(blockingRows.map((item) => ({ blocking_flag: Boolean(item.blocking_flag) })));
  const blockingCandidateStations = Array.from(new Set(blockingRows.map((item) => item.station_id)));
  const severitySummary = summarizeByKey(openRows.map((item) => ({ key: item.severity })));

  return {
    gate_status: gateStatus,
    blocking_candidate_stations: blockingCandidateStations,
    checklist_rows: [
      {
        key: 'platform-gate-status',
        title: '平台闸口状态',
        status: gateStatus,
        summary:
          gateStatus === 'blocked'
            ? `${blockingCandidateStations.length} 个站点存在阻断候选问题`
            : openRows.length
              ? `${openRows.length} 条开放质量问题待跟踪`
              : '当日平台层无开放质量问题',
        actions:
          gateStatus === 'blocked'
            ? ['优先检查阻断站点的导入账本与对象审计，再决定是否暂停导入']
            : ['继续跟踪开放问题，并在日报中暴露趋势']
      },
      {
        key: 'platform-top-stations',
        title: '阻断候选站点',
        status: blockingCandidateStations.length ? 'attention' : 'clear',
        summary: blockingCandidateStations.length ? blockingCandidateStations.join(' / ') : '暂无阻断候选站点',
        actions:
          blockingCandidateStations.length
            ? blockingCandidateStations.map((item) => `检查 ${item} 的质量问题清单与试运行对象链`)
            : ['无需追加站点级阻断处理']
      },
      {
        key: 'platform-severity',
        title: '严重度分布',
        status: openRows.length ? 'attention' : 'clear',
        summary:
          Object.entries(severitySummary)
            .map(([severity, count]) => `${severity} ${count}`)
            .join(' / ') || '暂无开放质量问题',
        actions: ['按严重度排序进入日报、治理页和月度复盘']
      }
    ]
  };
}

async function loadRuleMap(db: any, stationId: string) {
  const rows = (await db
    .prepare(
      `
        SELECT rule_id, station_id, object_type, rule_code, rule_name, description, rule_stage, severity, blocking_default, active, metadata_json
        FROM data_quality_rules
        WHERE active = 1
          AND (station_id IS NULL OR station_id = ?)
        ORDER BY station_id DESC, blocking_default DESC, severity ASC, rule_code ASC
      `
    )
    .bind(stationId)
    .all()).results as DataQualityRuleRow[];

  return rows.reduce<Record<string, DataQualityRuleRow>>((acc, row) => {
    acc[row.rule_code] = row;
    return acc;
  }, {});
}

async function replaceStationIssues(db: any, stationId: string, issueDate: string, issues: DataQualityIssueDraft[]) {
  await db.prepare(`DELETE FROM data_quality_issues WHERE station_id = ? AND issue_date = ?`).bind(stationId, issueDate).run();

  const dedupedIssues = new Map<string, DataQualityIssueDraft>();

  for (const draft of issues) {
    const issueId = buildIssueId(draft);
    if (!dedupedIssues.has(issueId)) {
      dedupedIssues.set(issueId, draft);
    }
  }

  for (const [issueId, draft] of dedupedIssues.entries()) {
    await db
      .prepare(
        `
          INSERT INTO data_quality_issues (
            issue_id, station_id, issue_date, object_type, object_id, rule_id, issue_code, severity, status,
            blocking_flag, source_type, source_key, import_request_id, summary, details_json, suggested_action,
            audit_object_type, audit_object_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        issueId,
        draft.station_id,
        draft.issue_date,
        draft.object_type,
        draft.object_id || null,
        draft.rule_id,
        draft.issue_code,
        draft.severity,
        draft.blocking_flag,
        draft.source_type,
        draft.source_key || null,
        draft.import_request_id || null,
        draft.summary,
        draft.details ? JSON.stringify(draft.details) : null,
        draft.suggested_action || null,
        draft.audit_object_type || null,
        draft.audit_object_id || null
      )
      .run();
  }
}

export async function evaluateStationDataQuality(db: any, stationId: string, issueDate: string) {
  const rules = await loadRuleMap(db, stationId);
  const issues: DataQualityIssueDraft[] = [];

  const failedImports = (await db
    .prepare(
      `
        SELECT request_id, error_code, error_message, target_object_type, target_object_id
        FROM import_requests
        WHERE station_id = ?
          AND status = 'failed'
          AND substr(updated_at, 1, 10) = ?
      `
    )
    .bind(stationId, issueDate)
    .all()).results as Array<{
    request_id: string;
    error_code: string | null;
    error_message: string | null;
    target_object_type: string | null;
    target_object_id: string | null;
  }>;

  const awbsMissingFlight = (await db
    .prepare(
      `
        SELECT awb_id, awb_no
        FROM awbs
        WHERE station_id = ?
          AND (flight_id IS NULL OR trim(flight_id) = '')
      `
    )
    .bind(stationId)
    .all()).results as Array<{ awb_id: string; awb_no: string }>;

  const awbsMissingShipment = (await db
    .prepare(
      `
        SELECT a.awb_id, a.awb_no
        FROM awbs a
        LEFT JOIN shipments s ON s.shipment_id = a.shipment_id
        WHERE a.station_id = ?
          AND s.shipment_id IS NULL
      `
    )
    .bind(stationId)
    .all()).results as Array<{ awb_id: string; awb_no: string }>;

  const shipmentsWithoutAwb = (await db
    .prepare(
      `
        SELECT s.shipment_id
        FROM shipments s
        LEFT JOIN awbs a ON a.shipment_id = s.shipment_id
        WHERE s.station_id = ?
        GROUP BY s.shipment_id
        HAVING COUNT(a.awb_id) = 0
      `
    )
    .bind(stationId)
    .all()).results as Array<{ shipment_id: string }>;

  const tasksMissingObject = (await db
    .prepare(
      `
        SELECT t.task_id, t.related_object_type, t.related_object_id
        FROM tasks t
        LEFT JOIN awbs a ON t.related_object_type = 'AWB' AND a.awb_id = t.related_object_id
        LEFT JOIN shipments s ON t.related_object_type = 'Shipment' AND s.shipment_id = t.related_object_id
        LEFT JOIN flights f ON t.related_object_type = 'Flight' AND f.flight_id = t.related_object_id
        LEFT JOIN documents d ON t.related_object_type = 'Document' AND d.document_id = t.related_object_id
        WHERE t.station_id = ?
          AND (
            (t.related_object_type = 'AWB' AND a.awb_id IS NULL)
            OR (t.related_object_type = 'Shipment' AND s.shipment_id IS NULL)
            OR (t.related_object_type = 'Flight' AND f.flight_id IS NULL)
            OR (t.related_object_type = 'Document' AND d.document_id IS NULL)
          )
      `
    )
    .bind(stationId)
    .all()).results as Array<{ task_id: string; related_object_type: string; related_object_id: string }>;

  const importedFlightsMissingAudit = (await db
    .prepare(
      `
        SELECT ir.request_id, ir.target_object_id AS flight_id
        FROM import_requests ir
        LEFT JOIN audit_events ae
          ON ae.request_id = ir.request_id
         AND ae.action = 'STATION_INBOUND_BUNDLE_IMPORTED'
         AND ae.object_type = 'Flight'
         AND ae.object_id = ir.target_object_id
        WHERE ir.station_id = ?
          AND ir.import_type = 'station_inbound_bundle'
          AND ir.status = 'completed'
          AND substr(COALESCE(ir.completed_at, ir.updated_at), 1, 10) = ?
          AND ae.audit_id IS NULL
      `
    )
    .bind(stationId, issueDate)
    .all()).results as Array<{ request_id: string; flight_id: string }>;

  for (const row of failedImports) {
    const rule = rules.DQ_IMPORT_REQUEST_FAILED;
    issues.push({
      station_id: stationId,
      issue_date: issueDate,
      object_type: row.target_object_type || 'ImportRequest',
      object_id: row.target_object_id,
      rule_id: rule.rule_id,
      issue_code: rule.rule_code,
      severity: rule.severity,
      blocking_flag: Number(rule.blocking_default),
      source_type: 'import_request',
      source_key: row.request_id,
      import_request_id: row.request_id,
      summary: `导入请求 ${row.request_id} 执行失败`,
      details: {
        error_code: row.error_code,
        error_message: row.error_message
      },
      suggested_action: '先修复导入数据或映射，再按同一对象链重新导入。'
    });
  }

  for (const row of awbsMissingFlight) {
    const rule = rules.DQ_AWB_MISSING_FLIGHT;
    issues.push({
      station_id: stationId,
      issue_date: issueDate,
      object_type: 'AWB',
      object_id: row.awb_id,
      rule_id: rule.rule_id,
      issue_code: rule.rule_code,
      severity: rule.severity,
      blocking_flag: Number(rule.blocking_default),
      source_type: 'object_consistency',
      source_key: row.awb_no,
      summary: `AWB ${row.awb_no} 缺少航班关联`,
      details: {
        awb_no: row.awb_no
      },
      suggested_action: '补齐 AWB.flight_id，确保进入正式航班对象链。',
      audit_object_type: 'AWB',
      audit_object_id: row.awb_id
    });
  }

  for (const row of awbsMissingShipment) {
    const rule = rules.DQ_AWB_MISSING_SHIPMENT;
    issues.push({
      station_id: stationId,
      issue_date: issueDate,
      object_type: 'AWB',
      object_id: row.awb_id,
      rule_id: rule.rule_id,
      issue_code: rule.rule_code,
      severity: rule.severity,
      blocking_flag: Number(rule.blocking_default),
      source_type: 'object_consistency',
      source_key: row.awb_no,
      summary: `AWB ${row.awb_no} 缺少 Shipment 关联`,
      details: {
        awb_no: row.awb_no
      },
      suggested_action: '补齐 AWB.shipment_id，恢复 Flight -> Shipment -> AWB 对象闭环。',
      audit_object_type: 'AWB',
      audit_object_id: row.awb_id
    });
  }

  for (const row of shipmentsWithoutAwb) {
    const rule = rules.DQ_SHIPMENT_WITHOUT_AWB;
    issues.push({
      station_id: stationId,
      issue_date: issueDate,
      object_type: 'Shipment',
      object_id: row.shipment_id,
      rule_id: rule.rule_id,
      issue_code: rule.rule_code,
      severity: rule.severity,
      blocking_flag: Number(rule.blocking_default),
      source_type: 'object_consistency',
      source_key: row.shipment_id,
      summary: `Shipment ${row.shipment_id} 没有任何 AWB 关联`,
      details: {
        shipment_id: row.shipment_id
      },
      suggested_action: '检查导入映射，确认 Shipment 下的 AWB 是否完整写入。',
      audit_object_type: 'Shipment',
      audit_object_id: row.shipment_id
    });
  }

  for (const row of tasksMissingObject) {
    const rule = rules.DQ_TASK_MISSING_RELATED_OBJECT;
    issues.push({
      station_id: stationId,
      issue_date: issueDate,
      object_type: 'Task',
      object_id: row.task_id,
      rule_id: rule.rule_id,
      issue_code: rule.rule_code,
      severity: rule.severity,
      blocking_flag: Number(rule.blocking_default),
      source_type: 'object_consistency',
      source_key: row.related_object_id,
      summary: `Task ${row.task_id} 缺少 ${row.related_object_type} 关联对象`,
      details: {
        related_object_type: row.related_object_type,
        related_object_id: row.related_object_id
      },
      suggested_action: '补齐任务关联对象，避免任务链与对象链分离。',
      audit_object_type: 'Task',
      audit_object_id: row.task_id
    });
  }

  for (const row of importedFlightsMissingAudit) {
    const rule = rules.DQ_TRIAL_FLIGHT_MISSING_AUDIT;
    issues.push({
      station_id: stationId,
      issue_date: issueDate,
      object_type: 'Flight',
      object_id: row.flight_id,
      rule_id: rule.rule_id,
      issue_code: rule.rule_code,
      severity: rule.severity,
      blocking_flag: Number(rule.blocking_default),
      source_type: 'audit_consistency',
      source_key: row.request_id,
      import_request_id: row.request_id,
      summary: `试运行航班 ${row.flight_id} 缺少正式导入审计`,
      details: {
        request_id: row.request_id
      },
      suggested_action: '回查同一 request_id 的审计写入逻辑，保证试运行可追责。',
      audit_object_type: 'Flight',
      audit_object_id: row.flight_id
    });
  }

  await replaceStationIssues(db, stationId, issueDate, issues);
  return loadStationDataQualityOverview(db, stationId, issueDate);
}

export async function loadStationDataQualityRules(db: any, stationId: string) {
  const rows = (await db
    .prepare(
      `
        SELECT rule_id, station_id, object_type, rule_code, rule_name, description, rule_stage, severity, blocking_default, active, metadata_json
        FROM data_quality_rules
        WHERE active = 1
          AND (station_id IS NULL OR station_id = ?)
        ORDER BY station_id DESC, blocking_default DESC, severity ASC, rule_code ASC
      `
    )
    .bind(stationId)
    .all()).results as DataQualityRuleRow[];

  return rows.map((row) => ({
    rule_id: row.rule_id,
    station_id: row.station_id,
    object_type: row.object_type,
    rule_code: row.rule_code,
    rule_name: row.rule_name,
    description: row.description,
    rule_stage: row.rule_stage,
    severity: row.severity,
    blocking_default: Boolean(row.blocking_default),
    metadata: parseJson(row.metadata_json)
  }));
}

export async function loadStationDataQualityIssues(
  db: any,
  stationId: string,
  issueDate: string,
  filters: { severity?: string; status?: string } = {}
) {
  const clauses = ['station_id = ?', 'issue_date = ?'];
  const params: unknown[] = [stationId, issueDate];

  if (filters.severity) {
    clauses.push('severity = ?');
    params.push(filters.severity);
  }

  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }

  const rows = (await db
    .prepare(
      `
        SELECT issue_id, station_id, issue_date, object_type, object_id, rule_id, issue_code, severity, status,
               blocking_flag, source_type, source_key, import_request_id, summary, details_json, suggested_action,
               audit_object_type, audit_object_id, detected_at, resolved_at
        FROM data_quality_issues
        WHERE ${clauses.join(' AND ')}
        ORDER BY blocking_flag DESC, severity ASC, detected_at DESC, issue_code ASC
      `
    )
    .bind(...params)
    .all()).results as DataQualityIssueRow[];

  return rows.map((row) => ({
    issue_id: row.issue_id,
    station_id: row.station_id,
    issue_date: row.issue_date,
    object_type: row.object_type,
    object_id: row.object_id,
    rule_id: row.rule_id,
    issue_code: row.issue_code,
    severity: row.severity,
    status: row.status,
    blocking_flag: Boolean(row.blocking_flag),
    source_type: row.source_type,
    source_key: row.source_key,
    import_request_id: row.import_request_id,
    summary: row.summary,
    details: parseJson(row.details_json),
    suggested_action: row.suggested_action,
    trace: {
      audit_object_type: row.audit_object_type,
      audit_object_id: row.audit_object_id,
      import_request_id: row.import_request_id
    },
    detected_at: row.detected_at,
    resolved_at: row.resolved_at
  }));
}

export async function loadStationDataQualityOverview(db: any, stationId: string, issueDate: string) {
  const issues = await loadStationDataQualityIssues(db, stationId, issueDate);
  const totalIssues = issues.length;
  const openIssues = issues.filter((item) => item.status !== 'Resolved').length;
  const blockingIssues = issues.filter((item) => item.blocking_flag && item.status !== 'Resolved').length;
  const bySeverity = summarizeByKey(issues.map((item) => ({ key: item.severity })));
  const bySource = summarizeByKey(issues.map((item) => ({ key: item.source_type })));
  const checklist = buildStationQualityChecklist(issues);

  return {
    station_id: stationId,
    issue_date: issueDate,
    total_issues: totalIssues,
    open_issues: openIssues,
    blocking_issues: blockingIssues,
    quality_score: buildQualityScore(totalIssues, blockingIssues),
    by_severity: bySeverity,
    by_source: bySource,
    gate_status: checklist.gate_status,
    blocking_candidate_rules: checklist.blocking_candidate_rules,
    operational_actions: checklist.operational_actions,
    quality_checklist: checklist
  };
}

export async function loadPlatformDataQualityOverview(db: any, issueDate: string, stationId?: string) {
  const clauses = ['issue_date = ?'];
  const params: unknown[] = [issueDate];

  if (stationId) {
    clauses.push('station_id = ?');
    params.push(stationId);
  }

  const rows = (await db
    .prepare(
      `
        SELECT station_id, severity, status, blocking_flag
        FROM data_quality_issues
        WHERE ${clauses.join(' AND ')}
      `
    )
    .bind(...params)
    .all()).results as Array<{ station_id: string; severity: string; status: string; blocking_flag: number }>;

  const totalIssues = rows.length;
  const openIssues = rows.filter((item) => item.status !== 'Resolved').length;
  const blockingIssues = rows.filter((item) => item.blocking_flag && item.status !== 'Resolved').length;
  const bySeverity = summarizeByKey(rows.map((item) => ({ key: item.severity })));
  const byStation = summarizeByKey(rows.map((item) => ({ key: item.station_id })));
  const checklist = buildPlatformQualityChecklist(rows);

  return {
    station_id: stationId || null,
    issue_date: issueDate,
    total_issues: totalIssues,
    open_issues: openIssues,
    blocking_issues: blockingIssues,
    quality_score: buildQualityScore(totalIssues, blockingIssues),
    by_severity: bySeverity,
    by_station: byStation,
    gate_status: checklist.gate_status,
    blocking_candidate_stations: checklist.blocking_candidate_stations,
    quality_checklist: checklist
  };
}
