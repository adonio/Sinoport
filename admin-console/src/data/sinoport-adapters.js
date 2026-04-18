import {
  auditEvents,
  exceptionCases,
  hardGateRules,
  inboundCargoLifecycle,
  inboundWaybillRows,
  interfaceStatus,
  outboundWaybillRows,
  pendingLaunchItems,
  platformKpis,
  routeMatrix,
  serviceLevels,
  stationCatalog,
  stationDashboardKpis,
  transferRecords
} from 'data/sinoport';

// Legacy adapter snapshots remain available for fixture/replay and sample import
// flows. Accepted CRUD pages must prefer DB-backed API payloads instead of these
// local adapter exports as business truth.
export const sinoportAdapterFixtureBoundary = Object.freeze({
  role: 'fixture/replay/sample-import-only',
  primaryTruthForbiddenForAcceptedCrud: true
});

export const platformOperationKpis = [
  ...platformKpis.slice(0, 3),
  {
    title: '阻塞链路',
    value: `${exceptionCases.filter((item) => item.status === '警戒').length}`,
    helper: '异常、文件或接口门槛导致的链路阻塞',
    chip: 'Risk',
    color: 'warning'
  }
];

export const stationHealthRows = stationCatalog.map((station, index) => ({
  code: station.code,
  name: station.name,
  control: station.control,
  phase: station.phase,
  scope: station.scope,
  readiness: 78 + ((index * 4) % 18),
  blockingReason:
    index % 3 === 0 ? '需补齐异常字典和主数据映射' : index % 3 === 1 ? '链路规则待冻结' : '接口日志仍以人工导入为主'
}));

export const platformAlerts = [
  {
    id: 'ALT-OPS-001',
    title: 'MME 进港链路存在 2 个阻塞任务',
    description: 'CBA 与 POD 补齐之前，交付关闭与转运放行都不能继续。',
    status: '警戒'
  },
  {
    id: 'ALT-OPS-002',
    title: 'Manifest 回传稳定性不足',
    description: '目的港到货数量仍使用 PDF 解析与人工比对，差异超过阈值时需要人工复核。',
    status: '阻塞'
  },
  {
    id: 'ALT-OPS-003',
    title: 'RZE 站点接入尚未冻结',
    description: '站点服务范围与 SLA 仍在确认中，只能作为待审批动作保留在平台态势中心。',
    status: '待处理'
  }
];

export const platformPendingActions = pendingLaunchItems.map((item, index) => ({
  id: `ACT-${index + 1}`,
  title: item.title,
  owner: item.owner,
  due: item.due,
  note: item.note,
  status: index === 0 ? '待处理' : '运行中'
}));

export const masterDataRows = [
  { object: 'Flight', keyRule: 'Flight No + Flight Date + Station', owner: 'Platform Data Owner', readiness: '运行中', note: '统一 Runtime / Fulfillment 双状态口径' },
  { object: 'Shipment / AWB', keyRule: 'Shipment ID / AWB / HAWB', owner: 'Station Ops', readiness: '运行中', note: '贯穿航班、文件、任务、异常、POD' },
  { object: 'ULD / PMC', keyRule: 'ULD/PMC ID', owner: 'Ramp Team', readiness: '警戒', note: '部分链路仍缺与 UWS 的统一映射' },
  { object: 'Truck / Driver', keyRule: 'Truck ID / Plate No / Driver', owner: 'Linehaul Control', readiness: '待处理', note: '尾程与二次转运模型需统一' },
  { object: 'Document', keyRule: 'Document ID / Version / Linked Object', owner: 'Document Desk', readiness: '运行中', note: '为状态放行与模板指令提供基础' },
  { object: 'Event', keyRule: 'Event ID / Event Hash', owner: 'Audit Owner', readiness: '待处理', note: '当前仅做前端可信留痕占位' }
];

export const importJobRows = [
  { jobId: 'IMP-0408-001', source: 'FFM 导入', linkedTo: 'SE913', result: '运行中', summary: '27 行全部通过校验', retry: '无需' },
  { jobId: 'IMP-0408-002', source: 'Manifest 解析', linkedTo: 'SE600', result: '警戒', summary: '到港数量对账待人工确认', retry: '允许重跑' },
  { jobId: 'IMP-0408-003', source: 'POD 归档', linkedTo: 'TRK-0406-018', result: '待处理', summary: '双签页缺失，禁止关闭 Delivered', retry: '等待补传' }
];

export const interfaceGovernanceRows = interfaceStatus.map((item, index) => ({
  ...item,
  owner: ['Platform Integration', 'Station Desk', 'Destination Ops', 'Delivery Control'][index] || 'Platform Integration',
  linkedObject: ['Flight', 'ULD/PMC', 'Manifest', 'POD'][index] || 'Event',
  fallback: index === 2 ? '解析失败后转人工对账' : '允许人工补录但需审计留痕'
}));

export const ruleTemplateRows = [
  {
    name: '航班落地后拆板到装车',
    trigger: 'Landed + CBA / Manifest / Handling Plan 齐全',
    output: 'PMC 拆板、理货、分区、装车任务',
    owner: 'Inbound Supervisor'
  },
  {
    name: '前置仓到出港文件链',
    trigger: '收货、CMR、Origin POD、CBA、AWB、FFM、UWS、Manifest',
    output: '收货、组板、机坪放行、Loaded/Airborne',
    owner: 'Export Supervisor'
  },
  {
    name: 'NOA / POD 放行规则',
    trigger: '理货完成或交付签收完成',
    output: 'NOA 发送、POD 草稿、关闭校验',
    owner: 'Delivery Control'
  }
];

export const hardGatePolicyRows = [
  {
    id: 'HG-01',
    rule: '缺少关键文件，不得生成下一步任务',
    triggerNode: '文件链未齐全',
    affectedModule: '单证中心 / 任务编排 / 航班与提单链路',
    blocker: '阻塞状态流转与任务生成',
    recovery: '补齐关键文件并确认生效版本',
    releaseRole: '主管可临时放行并强制审计'
  },
  {
    id: 'HG-02',
    rule: '一托一单，严禁混托',
    triggerNode: '理货 / 组托 / 装车前校验',
    affectedModule: '出港管理 / 交付装车 / PDA 装车作业',
    blocker: '阻塞装车与闭环',
    recovery: '完成一托一单校验并消除混托差异',
    releaseRole: '不可越权跳过'
  },
  {
    id: 'HG-03',
    rule: 'PMC 拆板后必须核对板号与件数',
    triggerNode: '拆板完成',
    affectedModule: '进港管理 / 理货复核 / PDA 拆板理货',
    blocker: '阻塞理货完成',
    recovery: '完成板号、件数与差异复核',
    releaseRole: '班组长与独立复核员共同放行'
  },
  {
    id: 'HG-04',
    rule: '未完成二次复核，不得装车',
    triggerNode: '装车前',
    affectedModule: '出港管理 / 尾程装车 / PDA 装车执行',
    blocker: '阻塞装车任务',
    recovery: '完成独立复核与双人确认',
    releaseRole: '独立复核员或主管放行'
  },
  {
    id: 'HG-05',
    rule: '未登记司机 / 车牌 / 到离场时间，不得放行车辆',
    triggerNode: '发车前',
    affectedModule: '尾程运输 / 头程卡车 / Vehicle Gate Out',
    blocker: '阻塞 Gate Out',
    recovery: '补齐司机、车牌、到离场时间与交接文件',
    releaseRole: '主管放行并留痕'
  },
  {
    id: 'HG-06',
    rule: 'POD 未签收，不得关单',
    triggerNode: '装车后 / 交付后',
    affectedModule: '交付仓 / 提单与履约链路 / POD 归档',
    blocker: '阻塞 Delivered / Closed',
    recovery: '补齐 POD 双签与签收对象',
    releaseRole: '不可越权跳过'
  },
  {
    id: 'HG-07',
    rule: '需要证据的任务未上传证据，不得完成',
    triggerNode: '任务完成前',
    affectedModule: 'PDA 执行任务 / 站内任务池 / 审计留痕',
    blocker: '阻塞 Task Completed',
    recovery: '补齐照片、签字、扫码或差异证据',
    releaseRole: '主管补证据并审计'
  },
  {
    id: 'HG-08',
    rule: '超 SLA 自动升级',
    triggerNode: 'Due Time 到期',
    affectedModule: '平台态势中心 / 作业指令中心 / 升级流',
    blocker: '推送到主管与平台态势中心',
    recovery: '重新分配责任班组或调整时限并留痕',
    releaseRole: '平台管理员可重新分配'
  }
];

const hardGatePolicyMap = new Map(hardGatePolicyRows.map((item) => [item.id, item]));

export function getHardGatePolicy(gateId) {
  return hardGatePolicyMap.get(gateId) || null;
}

export const gateEvaluationRows = [
  {
    id: 'GATE-EVAL-001',
    gateId: 'HG-01',
    direction: '进港',
    node: '航班落地 -> 进港处理',
    required: 'CBA / Manifest / Handling Plan',
    impact: '允许生成 PMC 拆板、理货、分区任务',
    status: '警戒',
    objectId: 'SE803',
    objectLabel: 'SE803 / MME Inbound',
    blockingReason: 'SE803 缺 CBA 最终版，拆板任务仅可预排。',
    recoveryAction: '补齐 CBA 最终版并确认生效版本。',
    releaseRole: getHardGatePolicy('HG-01')?.releaseRole,
    linkedDocumentIds: ['DOC-CBA-SE803', 'DOC-MANIFEST-SE803'],
    linkedTaskIds: ['TASK-0408-001'],
    linkedShipmentIds: ['in-436-10358585'],
    linkedExceptionIds: []
  },
  {
    id: 'GATE-EVAL-002',
    gateId: 'HG-03',
    direction: '进港',
    node: 'PMC 拆板 -> 理货完成',
    required: '板号 / 件数核对记录',
    impact: '允许理货完成并放行至 NOA 准备',
    status: '待处理',
    objectId: '436-10357896',
    objectLabel: '436-10357896 / Check Sheet',
    blockingReason: '数量差异未复核，NOA 与转运任务保持待处理。',
    recoveryAction: '完成板号、件数与差异复核并记录结论。',
    releaseRole: getHardGatePolicy('HG-03')?.releaseRole,
    linkedDocumentIds: ['DOC-CHECK-436-10357896'],
    linkedTaskIds: ['TASK-0408-002'],
    linkedShipmentIds: ['in-436-10358585'],
    linkedExceptionIds: ['EXP-0408-001']
  },
  {
    id: 'GATE-EVAL-003',
    gateId: 'HG-01',
    direction: '出港',
    node: '出港货站 -> 机坪放行',
    required: 'Origin POD / AWB / CBA / FFM / UWS / Manifest',
    impact: '允许机坪转运、Loaded 确认与 Airborne',
    status: '警戒',
    objectId: 'SE913',
    objectLabel: 'SE913 / URC Export',
    blockingReason: 'Manifest 最终版未冻结，机坪放行与飞走归档被锁定。',
    recoveryAction: '冻结 Manifest 最终版并完成对账。',
    releaseRole: getHardGatePolicy('HG-01')?.releaseRole,
    linkedDocumentIds: ['DOC-ORIGIN-POD-URC-001', 'DOC-FFM-SE913', 'DOC-UWS-SE913', 'DOC-MANIFEST-SE913', 'DOC-MAWB-436-10357583'],
    linkedTaskIds: ['TASK-0408-003'],
    linkedShipmentIds: ['out-436-10357583'],
    linkedExceptionIds: ['EXP-0408-002']
  },
  {
    id: 'GATE-EVAL-004',
    gateId: 'HG-02',
    direction: '出港',
    node: '组托 / 装车前校验',
    required: '一托一单校验记录',
    impact: '允许组托与后续装车',
    status: '运行中',
    objectId: 'ULD-URC-01',
    objectLabel: 'URC 出港托盘 / Build-up',
    blockingReason: '当前样例未发现混托，但必须持续校验。',
    recoveryAction: '如发现混托，拆分托盘并重新校验。',
    releaseRole: getHardGatePolicy('HG-02')?.releaseRole,
    linkedDocumentIds: ['DOC-MAWB-436-10357583'],
    linkedTaskIds: ['TASK-0408-003'],
    linkedShipmentIds: ['out-436-10357583'],
    linkedExceptionIds: []
  },
  {
    id: 'GATE-EVAL-005',
    gateId: 'HG-04',
    direction: '尾程',
    node: '装车前独立复核',
    required: '独立复核记录 / 双人确认',
    impact: '允许完成装车任务',
    status: '待处理',
    objectId: 'TAIL-001',
    objectLabel: 'TAIL-001 / 尾程装车',
    blockingReason: '独立复核尚未完成，装车任务不能闭环。',
    recoveryAction: '完成独立复核并记录双人确认。',
    releaseRole: getHardGatePolicy('HG-04')?.releaseRole,
    linkedDocumentIds: ['DOC-COLLECTION-MME-018'],
    linkedTaskIds: ['TASK-0408-004'],
    linkedShipmentIds: ['in-436-10358585'],
    linkedExceptionIds: []
  },
  {
    id: 'GATE-EVAL-006',
    gateId: 'HG-05',
    direction: '尾程',
    node: '尾程发车 -> Gate Out',
    required: '司机 / 车牌 / Collection Note / 到离场时间',
    impact: '允许尾程车辆发车与交付签收',
    status: '待处理',
    objectId: 'TRIP-MME-018',
    objectLabel: 'TRIP-MME-018 / Tailhaul',
    blockingReason: '司机签字与离场时间未登记，Gate Out 被阻塞。',
    recoveryAction: '补齐司机、车牌、到离场时间与交接文件。',
    releaseRole: getHardGatePolicy('HG-05')?.releaseRole,
    linkedDocumentIds: ['DOC-COLLECTION-MME-018'],
    linkedTaskIds: ['TASK-0408-004'],
    linkedShipmentIds: ['in-436-10358585'],
    linkedExceptionIds: []
  },
  {
    id: 'GATE-EVAL-007',
    gateId: 'HG-06',
    direction: '交付',
    node: '交付签收 -> Closed',
    required: 'POD 双签 / Delivery Record',
    impact: '允许 Delivered 进入 Closed',
    status: '阻塞',
    objectId: 'TRK-0406-018',
    objectLabel: 'TRK-0406-018 / POD',
    blockingReason: 'POD 缺双签，Closed 与关单动作被阻断。',
    recoveryAction: '补齐 POD 双签与签收对象。',
    releaseRole: getHardGatePolicy('HG-06')?.releaseRole,
    linkedDocumentIds: ['DOC-POD-TRK-0406-018'],
    linkedTaskIds: ['TASK-0408-004'],
    linkedShipmentIds: ['in-436-10358585'],
    linkedExceptionIds: ['EXP-0408-003']
  },
  {
    id: 'GATE-EVAL-008',
    gateId: 'HG-07',
    direction: '进港',
    node: '任务完成前证据校验',
    required: '开工/完工照片 / 签字 / 扫码',
    impact: '允许任务从运行中进入已完成',
    status: '待处理',
    objectId: 'TASK-0408-001',
    objectLabel: 'SE803 / PMC 拆板任务',
    blockingReason: '拆板任务证据包未齐全，任务不能完成。',
    recoveryAction: '补齐开工/完工照片并上传 Zone 记录。',
    releaseRole: getHardGatePolicy('HG-07')?.releaseRole,
    linkedDocumentIds: ['DOC-CBA-SE803'],
    linkedTaskIds: ['TASK-0408-001'],
    linkedShipmentIds: ['in-436-10358585'],
    linkedExceptionIds: []
  },
  {
    id: 'GATE-EVAL-009',
    gateId: 'HG-08',
    direction: '出港',
    node: 'Due Time 到期 -> 自动升级',
    required: 'SLA 到期自动升级',
    impact: '推送主管与平台态势中心',
    status: '待升级',
    objectId: 'TASK-0408-003',
    objectLabel: 'SE913 / 机坪放行任务',
    blockingReason: 'SE913 机坪放行已超时 18 分钟，需升级处理。',
    recoveryAction: '重新分配责任班组或调整时限并留痕。',
    releaseRole: getHardGatePolicy('HG-08')?.releaseRole,
    linkedDocumentIds: ['DOC-MANIFEST-SE913'],
    linkedTaskIds: ['TASK-0408-003'],
    linkedShipmentIds: ['out-436-10357583'],
    linkedExceptionIds: []
  }
];

export function getGateEvaluationsByGateId(gateId) {
  return gateEvaluationRows.filter((item) => item.gateId === gateId);
}

export function getGateEvaluationsForDocument(documentId) {
  return gateEvaluationRows.filter((item) => item.linkedDocumentIds?.includes(documentId));
}

export function getGateEvaluationsForTask(taskId) {
  return gateEvaluationRows.filter((item) => item.linkedTaskIds?.includes(taskId));
}

export function getGateEvaluationsForShipment(shipmentId) {
  return gateEvaluationRows.filter((item) => item.linkedShipmentIds?.includes(shipmentId));
}

export function getGateEvaluationsForException(exceptionId) {
  return gateEvaluationRows.filter((item) => item.linkedExceptionIds?.includes(exceptionId));
}

export const documentVersionRows = [
  {
    documentId: 'DOC-CBA-SE803',
    versionId: 'DOC-CBA-SE803-V1',
    version: 'v1',
    sortOrder: 1,
    status: '历史版本',
    isActive: false,
    previewType: 'pdf',
    diffSummary: '缺最终件数与板号修订说明。',
    replacedBy: 'DOC-CBA-SE803-V2',
    rollbackTarget: null,
    updatedAt: '2026-04-08 17:45',
    previewSummary: '旧版 CBA，仅包含初始卸机记录。'
  },
  {
    documentId: 'DOC-CBA-SE803',
    versionId: 'DOC-CBA-SE803-V2',
    version: 'v2',
    sortOrder: 2,
    status: '生效中',
    isActive: true,
    previewType: 'pdf',
    diffSummary: '新增板号修订与目的站 Handling Plan 引用。',
    replacedBy: 'DOC-CBA-SE803-V3',
    rollbackTarget: 'DOC-CBA-SE803-V1',
    updatedAt: '2026-04-08 18:10',
    previewSummary: '当前用于拆板放行的生效版本。'
  },
  {
    documentId: 'DOC-CBA-SE803',
    versionId: 'DOC-CBA-SE803-V3',
    version: 'v3',
    sortOrder: 3,
    status: '待发布',
    isActive: false,
    previewType: 'pdf',
    diffSummary: '补齐最终件数与差异说明，待主管确认生效。',
    replacedBy: null,
    rollbackTarget: 'DOC-CBA-SE803-V2',
    updatedAt: '2026-04-08 18:32',
    previewSummary: '待发布版本，补充最终件数与修订摘要。'
  },
  {
    documentId: 'DOC-MANIFEST-SE803',
    versionId: 'DOC-MANIFEST-SE803-V1',
    version: 'v1',
    sortOrder: 1,
    status: '生效中',
    isActive: true,
    previewType: 'pdf',
    diffSummary: '当前版本与到港拆板计划一致。',
    replacedBy: null,
    rollbackTarget: null,
    updatedAt: '2026-04-08 18:05',
    previewSummary: 'SE803 到港 Manifest 生效版本。'
  },
  {
    documentId: 'DOC-FFM-SE913',
    versionId: 'DOC-FFM-SE913-V1',
    version: 'v1',
    sortOrder: 1,
    status: '生效中',
    isActive: true,
    previewType: 'office',
    diffSummary: '结构化导入已完成，等待与 Manifest 对账。',
    replacedBy: null,
    rollbackTarget: null,
    updatedAt: '2026-04-08 17:55',
    previewSummary: 'FFM 结构化导入摘要与航班绑定信息。'
  },
  {
    documentId: 'DOC-UWS-SE913',
    versionId: 'DOC-UWS-SE913-V1',
    version: 'v1',
    sortOrder: 1,
    status: '生效中',
    isActive: true,
    previewType: 'office',
    diffSummary: '当前 UWS 与 ULD 绑定记录一致。',
    replacedBy: 'DOC-UWS-SE913-V2',
    rollbackTarget: null,
    updatedAt: '2026-04-08 18:02',
    previewSummary: 'UWS 当前版本，可用于 Loaded 确认。'
  },
  {
    documentId: 'DOC-UWS-SE913',
    versionId: 'DOC-UWS-SE913-V2',
    version: 'v2',
    sortOrder: 2,
    status: '待发布',
    isActive: false,
    previewType: 'office',
    diffSummary: '补充第 3 个 ULD 绑定，待与 Manifest 对账后生效。',
    replacedBy: null,
    rollbackTarget: 'DOC-UWS-SE913-V1',
    updatedAt: '2026-04-08 18:26',
    previewSummary: '待发布 UWS 修订版本。'
  },
  {
    documentId: 'DOC-MANIFEST-SE913',
    versionId: 'DOC-MANIFEST-SE913-V1',
    version: 'v1',
    sortOrder: 1,
    status: '历史版本',
    isActive: false,
    previewType: 'pdf',
    diffSummary: '缺最终件数确认与冻结签注。',
    replacedBy: 'DOC-MANIFEST-SE913-V2',
    rollbackTarget: null,
    updatedAt: '2026-04-08 17:58',
    previewSummary: 'Manifest 初始导入版本。'
  },
  {
    documentId: 'DOC-MANIFEST-SE913',
    versionId: 'DOC-MANIFEST-SE913-V2',
    version: 'v2',
    sortOrder: 2,
    status: '生效中',
    isActive: true,
    previewType: 'pdf',
    diffSummary: '当前用于对账的版本，仍待冻结。',
    replacedBy: 'DOC-MANIFEST-SE913-V3',
    rollbackTarget: 'DOC-MANIFEST-SE913-V1',
    updatedAt: '2026-04-08 18:18',
    previewSummary: 'Manifest 当前生效版本，待最终冻结。'
  },
  {
    documentId: 'DOC-MANIFEST-SE913',
    versionId: 'DOC-MANIFEST-SE913-V3',
    version: 'v3',
    sortOrder: 3,
    status: '待发布',
    isActive: false,
    previewType: 'pdf',
    diffSummary: '补齐最终对账行与冻结签注，可解除机坪阻断。',
    replacedBy: null,
    rollbackTarget: 'DOC-MANIFEST-SE913-V2',
    updatedAt: '2026-04-08 18:40',
    previewSummary: '待主管确认的最终冻结版本。'
  },
  {
    documentId: 'DOC-MAWB-436-10357583',
    versionId: 'DOC-MAWB-436-10357583-V1',
    version: 'v1',
    sortOrder: 1,
    status: '历史版本',
    isActive: false,
    previewType: 'office',
    diffSummary: '旧版主单缺补充件重体备注。',
    replacedBy: 'DOC-MAWB-436-10357583-V2',
    rollbackTarget: null,
    updatedAt: '2026-04-08 17:36',
    previewSummary: '初始主单模板版本。'
  },
  {
    documentId: 'DOC-MAWB-436-10357583',
    versionId: 'DOC-MAWB-436-10357583-V2',
    version: 'v2',
    sortOrder: 2,
    status: '生效中',
    isActive: true,
    previewType: 'office',
    diffSummary: '补齐件重体与出港绑定字段。',
    replacedBy: null,
    rollbackTarget: 'DOC-MAWB-436-10357583-V1',
    updatedAt: '2026-04-08 18:12',
    previewSummary: '当前生效的主单版本。'
  },
  {
    documentId: 'DOC-POD-TRK-0406-018',
    versionId: 'DOC-POD-TRK-0406-018-V1',
    version: 'v1',
    sortOrder: 1,
    status: '生效中',
    isActive: true,
    previewType: 'pdf',
    diffSummary: '当前版本缺司机签字与客户签收页。',
    replacedBy: 'DOC-POD-TRK-0406-018-V2',
    rollbackTarget: null,
    updatedAt: '2026-04-08 18:08',
    previewSummary: 'POD 当前扫描版本，缺双签。'
  },
  {
    documentId: 'DOC-POD-TRK-0406-018',
    versionId: 'DOC-POD-TRK-0406-018-V2',
    version: 'v2',
    sortOrder: 2,
    status: '待发布',
    isActive: false,
    previewType: 'pdf',
    diffSummary: '新增司机签字页与签收对象，待归档确认。',
    replacedBy: null,
    rollbackTarget: 'DOC-POD-TRK-0406-018-V1',
    updatedAt: '2026-04-08 18:42',
    previewSummary: '待归档的双签版本。'
  },
  {
    documentId: 'DOC-ORIGIN-POD-URC-001',
    versionId: 'DOC-ORIGIN-POD-URC-001-V1',
    version: 'v1',
    sortOrder: 1,
    status: '生效中',
    isActive: true,
    previewType: 'pdf',
    diffSummary: 'Origin POD 当前版本已用于出港收货交接。',
    replacedBy: null,
    rollbackTarget: null,
    updatedAt: '2026-04-08 17:51',
    previewSummary: 'Origin POD 当前版本。'
  },
  {
    documentId: 'DOC-COLLECTION-MME-018',
    versionId: 'DOC-COLLECTION-MME-018-V1',
    version: 'v1',
    sortOrder: 1,
    status: '生效中',
    isActive: true,
    previewType: 'image',
    diffSummary: '缺离场时间与司机补签页。',
    replacedBy: 'DOC-COLLECTION-MME-018-V2',
    rollbackTarget: null,
    updatedAt: '2026-04-08 18:01',
    previewSummary: '尾程 Collection Note 当前版本。'
  },
  {
    documentId: 'DOC-COLLECTION-MME-018',
    versionId: 'DOC-COLLECTION-MME-018-V2',
    version: 'v2',
    sortOrder: 2,
    status: '待发布',
    isActive: false,
    previewType: 'image',
    diffSummary: '补齐离场时间与司机签字，可解除发车门槛。',
    replacedBy: null,
    rollbackTarget: 'DOC-COLLECTION-MME-018-V1',
    updatedAt: '2026-04-08 18:28',
    previewSummary: '待发布的尾程发车修订版本。'
  }
];

export function getDocumentVersions(documentId) {
  return documentVersionRows.filter((item) => item.documentId === documentId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export const evidencePolicyRows = [
  { node: '拆板作业', evidence: '开工照片 / 完工照片 / Zone', blocker: '缺证据不得完成任务', role: 'Breakdown Worker' },
  { node: '理货核对', evidence: '件数 / 重量 / 差异备注', blocker: '未复核不得进入 NOA', role: 'Check Worker' },
  { node: '装车作业', evidence: '车牌 / 司机 / Collection Note / 双人确认', blocker: '缺任一字段不得发车', role: 'Loading Team' },
  { node: '交付签收', evidence: 'POD 双签 / 时间 / 签收对象', blocker: '未双签不得 Closed', role: 'Delivery Desk' }
];

export const stationTaskSummary = [
  { title: '待领取任务', value: '18', helper: '机坪、理货、装车、NOA、POD 全部汇总', chip: 'Queue', color: 'warning' },
  { title: '进行中任务', value: '11', helper: '现场正在执行，必须持续刷新状态', chip: 'Active', color: 'secondary' },
  { title: '阻塞任务', value: '4', helper: '文件缺失或硬门槛未满足', chip: 'Blocked', color: 'error' },
  { title: '待复核任务', value: '6', helper: '需要主管或独立复核员确认', chip: 'Review', color: 'info' }
];

export const stationTaskBoard = [
  {
    id: 'TASK-0408-001',
    title: 'SE803 机坪放行后 PMC 拆板',
    node: '进港机场货站操作',
    role: 'Breakdown Worker',
    owner: 'MME Inbound Team A',
    due: '19:30',
    priority: 'P1',
    status: '运行中',
    blocker: 'CBA 最终版待补齐，证据包未齐全',
    evidence: '开工照片、PMC 编号、Zone',
    gateIds: ['HG-01', 'HG-07'],
    objectTo: '/station/shipments/in-436-10358585'
  },
  {
    id: 'TASK-0408-002',
    title: '436-10357944 理货核对',
    node: '进港机场货站操作',
    role: 'Check Worker',
    owner: 'MME Check Desk',
    due: '19:45',
    priority: 'P1',
    status: '待复核',
    blocker: '数量差异待确认',
    evidence: '件数、重量、差异备注',
    gateIds: ['HG-03'],
    objectTo: '/station/shipments/in-436-10358585'
  },
  {
    id: 'TASK-0408-003',
    title: 'SE913 机坪放行',
    node: '出港机场机坪操作',
    role: 'Ramp Loader',
    owner: 'URC Export Team',
    due: '22:30',
    priority: 'P2',
    status: '待处理',
    blocker: 'Manifest 未确认最终版本',
    evidence: 'Loaded 照片、ULD 绑定、复核签名',
    gateIds: ['HG-01', 'HG-02', 'HG-08'],
    objectTo: '/station/shipments/out-436-10357583'
  },
  {
    id: 'TASK-0408-004',
    title: 'TRK-0406-018 POD 补签',
    node: '交付仓',
    role: 'Delivery Desk',
    owner: 'Destination Ops',
    due: '21:30',
    priority: 'P1',
    status: '阻塞',
    blocker: 'POD 缺双签',
    evidence: 'POD 双签、签收时间',
    gateIds: ['HG-04', 'HG-05', 'HG-06'],
    objectTo: '/station/shipments/in-436-10358585'
  }
];

export const stationBlockerQueue = gateEvaluationRows
  .filter((item) => ['警戒', '阻塞'].includes(item.status))
  .map((item) => ({
    id: item.id,
    gateId: item.gateId,
    title: `${item.gateId} · ${item.objectLabel}`,
    description: item.blockingReason,
    status: item.status
  }));

export const stationReviewQueue = gateEvaluationRows
  .filter((item) => ['待处理', '待升级'].includes(item.status))
  .map((item) => ({
    id: item.id,
    gateId: item.gateId,
    title: `${item.gateId} · ${item.objectLabel}`,
    description: item.recoveryAction,
    status: item.status
  }));

export const exceptionDetailRows = [
  {
    id: 'EXP-0408-001',
    type: '数量异常',
    object: '436-10357896',
    owner: 'MME Inbound Team',
    sla: '30 分钟',
    status: '警戒',
    blockedTask: 'NOA 发送 / 二次转运任务',
    gateId: 'HG-03',
    requiredGate: 'PMC 拆板后必须核对板号与件数',
    recoveryAction: '完成差异复核并更新理货结论',
    relatedFiles: [
      { label: '理货差异记录 / Check Sheet', to: '/station/documents' },
      { label: '436-10357896 履约对象', to: '/station/shipments/in-436-10358585' }
    ],
    jumpTo: '/station/tasks',
    objectTo: '/station/shipments/in-436-10358585'
  },
  {
    id: 'EXP-0408-002',
    type: '单证异常',
    object: 'SE913 Manifest',
    owner: 'Document Desk',
    sla: '飞走前',
    status: '待处理',
    blockedTask: '机坪放行 / 飞走归档',
    gateId: 'HG-01',
    requiredGate: 'Manifest 未冻结不得飞走归档',
    recoveryAction: '冻结 Manifest 最终版并完成差异对账',
    relatedFiles: [
      { label: 'SE913-MANIFEST-08APR.pdf', to: '/station/documents' },
      { label: 'SE913 出港履约对象', to: '/station/shipments/out-436-10357583' }
    ],
    jumpTo: '/station/documents',
    objectTo: '/station/shipments/out-436-10357583'
  },
  {
    id: 'EXP-0408-003',
    type: '签收异常',
    object: 'TRK-0406-018 POD',
    owner: 'Delivery Control',
    sla: 'POD 当日闭环',
    status: '阻塞',
    blockedTask: '交付关闭 / Closed',
    gateId: 'HG-06',
    requiredGate: 'POD 双签前不得 Closed',
    recoveryAction: '补齐 POD 双签与签收对象',
    relatedFiles: [
      { label: 'POD-436-10358585.pdf', to: '/station/documents/pod' },
      { label: '436-10358585 履约对象', to: '/station/shipments/in-436-10358585' }
    ],
    jumpTo: '/station/shipments/in-436-10358585',
    objectTo: '/station/shipments/in-436-10358585'
  }
];

export const inboundDocumentGates = gateEvaluationRows
  .filter((item) => ['GATE-EVAL-001', 'GATE-EVAL-002', 'GATE-EVAL-007'].includes(item.id))
  .map((item) => ({
    gateId: item.gateId,
    node: item.node,
    required: item.required,
    impact: item.impact,
    status: item.status,
    blocker: item.blockingReason,
    recovery: item.recoveryAction,
    releaseRole: item.releaseRole
  }));

export const outboundDocumentGates = gateEvaluationRows
  .filter((item) => ['GATE-EVAL-003', 'GATE-EVAL-004', 'GATE-EVAL-009'].includes(item.id))
  .map((item) => ({
    gateId: item.gateId,
    node: item.node,
    required: item.required,
    impact: item.impact,
    status: item.status,
    blocker: item.blockingReason,
    recovery: item.recoveryAction,
    releaseRole: item.releaseRole
  }));

export const instructionTemplateRows = [
  {
    code: 'INS-BREAKDOWN-01',
    title: '进港拆板作业指令',
    linkedNode: '进港机场货站操作',
    trigger: 'Landed + 关键文件齐全',
    evidence: '开工/完工照片、PMC、Zone'
  },
  {
    code: 'INS-LOADING-02',
    title: '装车复核指令',
    linkedNode: '尾程卡车装车与运输',
    trigger: '车辆到场 + 独立复核员到位',
    evidence: '车牌、司机、Collection Note、双人确认'
  },
  {
    code: 'INS-POD-03',
    title: 'POD 关闭指令',
    linkedNode: '交付仓',
    trigger: '签收完成',
    evidence: 'POD 双签、签收对象、时间'
  }
];

function buildInboundShipmentRows() {
  return inboundWaybillRows.map((item) => ({
    id: `in-${item.awb}`,
    awb: item.awb,
    direction: '进港',
    flightNo: item.flightNo,
    route: `${item.flightNo} / MME Inbound`,
    primaryStatus: item.currentNode,
    taskStatus: item.noaStatus === '待处理' ? '待处理' : '运行中',
    documentStatus: item.podStatus,
    blocker: item.noaStatus === '待处理' ? '理货完成后才能发送 NOA' : '无',
    consignee: item.consignee,
    pieces: item.pieces,
    weight: item.weight,
    priority: ['SE803', 'URO901'].includes(item.flightNo) ? 'P1' : 'P2'
  }));
}

function buildOutboundShipmentRows() {
  return outboundWaybillRows.map((item) => ({
    id: `out-${item.awb}`,
    awb: item.awb,
    direction: '出港',
    flightNo: item.flightNo,
    route: `${item.flightNo} / Export`,
    primaryStatus: item.loading,
    taskStatus: item.loading === '待处理' ? '待处理' : '运行中',
    documentStatus: item.manifest,
    blocker: item.manifest === '待生成' ? 'Manifest 未生成，不能归档' : '无',
    consignee: item.destination,
    pieces: '-',
    weight: '-',
    priority: item.flightNo === 'SE913' ? 'P1' : 'P2'
  }));
}

export const shipmentRows = [...buildInboundShipmentRows(), ...buildOutboundShipmentRows()];

const shipmentDetailSeed = {
  'in-436-10358585': {
    id: 'in-436-10358585',
    title: '436-10358585 / MME Inbound',
    eyebrow: 'Shipment / Fulfillment Chain',
    summary: {
      direction: '进港',
      route: 'SE803 -> MME -> Delivery',
      runtimeStatus: 'Landed',
      fulfillmentStatus: '待发送 NOA',
      priority: 'P1',
      station: 'MME'
    },
    timeline: [
      { label: 'Landed', note: 'SE803 已落地，进入目的站准备', status: '运行中' },
      { label: 'Inbound Handling', note: 'PMC 拆板与理货执行中', status: '运行中' },
      { label: 'Gate Check', note: 'HG-03 板号与件数复核通过后可推进', status: '待处理' },
      { label: 'Delivered', note: 'POD 双签后才能 Closed', status: '待处理' }
    ],
    documents: [
      { documentId: 'DOC-CBA-SE803', type: 'CBA', name: 'SE803-CBA-v2.pdf', status: '警戒', linkedTask: 'PMC 拆板任务', note: 'HG-01 命中，最终版待上传', gateIds: ['HG-01'] },
      { documentId: 'DOC-MANIFEST-SE803', type: 'Manifest', name: 'SE803 MANIFEST 08APR.pdf', status: '运行中', linkedTask: 'PMC 拆板任务', note: '与 Handling Plan 对齐，可继续拆板', gateIds: ['HG-01'] },
      { documentId: 'DOC-POD-TRK-0406-018', type: 'POD', name: 'POD-436-10358585.pdf', status: '待处理', linkedTask: '交付关闭', note: 'HG-06 命中，尚未双签', gateIds: ['HG-06'] }
    ],
    tasks: [
      {
        id: 'TASK-0408-001',
        title: 'PMC 拆板',
        owner: 'MME Inbound Team A',
        status: '运行中',
        due: '19:30',
        evidence: '开工/完工照片',
        jumpTo: '/station/tasks',
        gateIds: ['HG-01', 'HG-07']
      },
      {
        id: 'TASK-0408-002',
        title: '理货核对',
        owner: 'MME Check Desk',
        status: '待处理',
        due: '19:45',
        evidence: '件重体复核',
        jumpTo: '/station/tasks',
        gateIds: ['HG-03']
      },
      {
        id: 'TASK-0408-004',
        title: 'NOA 发送',
        owner: 'Customer Desk',
        status: '待处理',
        due: '20:15',
        evidence: '通知记录',
        jumpTo: '/station/documents',
        gateIds: ['HG-06']
      }
    ],
    exceptions: [
      {
        id: 'EXP-0408-001',
        type: '数量异常',
        status: '警戒',
        note: '待复核差异件',
        jumpTo: '/station/exceptions',
        gateId: 'HG-03'
      }
    ],
    gateIds: ['HG-01', 'HG-03', 'HG-06', 'HG-07']
  },
  'out-436-10357583': {
    id: 'out-436-10357583',
    title: '436-10357583 / URC Export',
    eyebrow: 'Shipment / Fulfillment Chain',
    summary: {
      direction: '出港',
      route: 'URC -> MME / MST',
      runtimeStatus: 'Scheduled',
      fulfillmentStatus: '主单完成',
      priority: 'P1',
      station: 'URC'
    },
    timeline: [
      { label: 'Forecast', note: 'FFM 预报完成', status: '运行中' },
      { label: 'Receipt', note: '货物接收完成', status: '运行中' },
      { label: 'Loaded', note: '等待 HG-01 文件齐全与 HG-02 一托一单校验', status: '待处理' },
      { label: 'Airborne', note: '机坪 Loaded 后可进入 Airborne', status: '待处理' }
    ],
    documents: [
      { documentId: 'DOC-FFM-SE913', type: 'FFM', name: 'SE913-FFM-08APR.docx', status: '运行中', linkedTask: '预报确认', note: '已完成结构化导入', gateIds: ['HG-01'] },
      { documentId: 'DOC-UWS-SE913', type: 'UWS', name: 'SE913-UWS-08APR.xlsx', status: '运行中', linkedTask: 'Loaded 确认', note: '待与 Manifest 对账', gateIds: ['HG-01'] },
      { documentId: 'DOC-MANIFEST-SE913', type: 'Manifest', name: 'SE913-MANIFEST-08APR.pdf', status: '待生成', linkedTask: '飞走归档', note: 'HG-01 命中，当前版本未冻结', gateIds: ['HG-01'] }
    ],
    tasks: [
      {
        id: 'TASK-0408-005',
        title: '出港收货',
        owner: 'URC Export Desk',
        status: '已完成',
        due: '20:30',
        evidence: 'Origin POD',
        jumpTo: '/station/tasks',
        gateIds: ['HG-01']
      },
      {
        id: 'TASK-0408-003',
        title: '装机复核',
        owner: 'Ramp Loader',
        status: '待处理',
        due: '22:30',
        evidence: 'Loaded 照片 + 复核签名',
        jumpTo: '/station/tasks',
        gateIds: ['HG-01', 'HG-02', 'HG-08']
      }
    ],
    exceptions: [
      {
        id: 'EXP-0408-002',
        type: '单证异常',
        status: '待处理',
        note: 'Manifest 最终版待冻结',
        jumpTo: '/station/exceptions',
        gateId: 'HG-01'
      }
    ],
    gateIds: ['HG-01', 'HG-02', 'HG-08']
  }
};

export function getShipmentDetail(shipmentId) {
  return shipmentDetailSeed[shipmentId] || shipmentDetailSeed['in-436-10358585'];
}

export function getShipmentGateEvaluations(shipmentId) {
  return getGateEvaluationsForShipment(shipmentId);
}

export const resourceTeams = [
  { id: 'TEAM-IN-01', name: 'MME Inbound Team A', shift: '白班', owner: 'Inbound Supervisor', status: '运行中' },
  { id: 'TEAM-CK-01', name: 'MME Check Desk', shift: '白班', owner: 'QA Lead', status: '运行中' },
  { id: 'TEAM-OUT-01', name: 'URC Export Team', shift: '夜班', owner: 'Export Supervisor', status: '待处理' }
];

export const resourceZones = [
  { zone: 'INB-01', station: 'MME', type: 'Breakdown', status: '运行中', note: 'PMC 拆板区' },
  { zone: 'INB-02', station: 'MME', type: 'Sorting', status: '运行中', note: '理货与分区' },
  { zone: 'OUT-01', station: 'URC', type: 'Build-up', status: '警戒', note: '待确认组板规则' }
];

export const resourceDevices = [
  { code: 'PDA-01', station: 'MME', owner: 'Breakdown Worker', status: '运行中' },
  { code: 'PDA-02', station: 'MME', owner: 'Check Worker', status: '运行中' },
  { code: 'PDA-03', station: 'URC', owner: 'Ramp Loader', status: '待处理' }
];

export const scenarioTimelineRows = [
  { step: '1', title: 'Landed -> Inbound Handling', note: '航班落地、机坪放行、进入目的站准备。' },
  { step: '2', title: '文件齐全 -> 任务生成', note: 'CBA / Manifest / Handling Plan 齐全后生成拆板和理货任务。' },
  { step: '3', title: '理货完成 -> NOA', note: '理货复核通过后允许发送 NOA 并准备转运。' },
  { step: '4', title: 'POD 双签 -> Closed', note: '交付签收完成且异常关闭后允许闭单。' }
];

export const inboundLifecycleRows = inboundCargoLifecycle.map((item, index) => ({
  ...item,
  progress: Math.max(12, 100 - index * 12)
}));

export const outboundLifecycleRows = [
  { label: '已预报', note: 'FFM 预报已进入站内编排', progress: 100 },
  { label: '已接收', note: '按 AWB 接收件重体并留痕', progress: 84 },
  { label: '主单完成', note: '主单打印与文件复核完成', progress: 70 },
  { label: '装载中', note: 'UWS 与 ULD/PMC 绑定执行中', progress: 56 },
  { label: '已飞走', note: 'Loaded / Airborne 已确认', progress: 38 },
  { label: 'Manifest 回传', note: '等待目的港回传对账', progress: 24 }
];

export const stationDashboardCards = stationDashboardKpis;
export const laneConfigRows = routeMatrix;
export const ruleOverviewRows = serviceLevels;
export const ruleGateRows = hardGateRules;
export const stationTransferRows = transferRecords;
export const stationAuditFeed = auditEvents;
export const stationDocumentRows = [
  {
    documentId: 'DOC-CBA-SE803',
    type: 'CBA',
    name: 'SE803-CBA-v2.pdf',
    linkedTo: 'SE803 / 436-10358585',
    version: 'v2',
    updatedAt: '2026-04-08 18:10',
    status: '警戒',
    activeVersionId: 'DOC-CBA-SE803-V2',
    previewType: 'pdf',
    nextStep: 'PMC 拆板任务',
    gateIds: ['HG-01', 'HG-07'],
    bindingTargets: [
      { label: 'Flight / SE803', to: '/station/inbound/flights/SE803' },
      { label: 'Shipment / 436-10358585', to: '/station/shipments/in-436-10358585' },
      { label: 'Task / PMC 拆板', to: '/station/tasks' }
    ]
  },
  {
    documentId: 'DOC-MANIFEST-SE803',
    type: 'Manifest',
    name: 'SE803 MANIFEST 08APR.pdf',
    linkedTo: 'SE803 / MME Inbound',
    version: 'v1',
    updatedAt: '2026-04-08 18:05',
    status: '运行中',
    activeVersionId: 'DOC-MANIFEST-SE803-V1',
    previewType: 'pdf',
    nextStep: 'PMC 拆板与理货放行',
    gateIds: ['HG-01'],
    bindingTargets: [
      { label: 'Flight / SE803', to: '/station/inbound/flights/SE803' },
      { label: 'Shipment / 436-10358585', to: '/station/shipments/in-436-10358585' }
    ]
  },
  {
    documentId: 'DOC-FFM-SE913',
    type: 'FFM',
    name: 'SE913-FFM-08APR.docx',
    linkedTo: 'SE913 / 436-10357583',
    version: 'v1',
    updatedAt: '2026-04-08 17:55',
    status: '运行中',
    activeVersionId: 'DOC-FFM-SE913-V1',
    previewType: 'office',
    nextStep: '出港收货与机坪放行',
    gateIds: ['HG-01'],
    bindingTargets: [
      { label: 'Flight / SE913', to: '/station/outbound/flights' },
      { label: 'Shipment / 436-10357583', to: '/station/shipments/out-436-10357583' }
    ]
  },
  {
    documentId: 'DOC-UWS-SE913',
    type: 'UWS',
    name: 'SE913-UWS-08APR.xlsx',
    linkedTo: 'SE913 / ULD Binding',
    version: 'v1',
    updatedAt: '2026-04-08 18:02',
    status: '运行中',
    activeVersionId: 'DOC-UWS-SE913-V1',
    previewType: 'office',
    nextStep: 'Loaded 确认',
    gateIds: ['HG-01', 'HG-02'],
    bindingTargets: [
      { label: 'Flight / SE913', to: '/station/outbound/flights' },
      { label: 'Task / 机坪放行', to: '/station/tasks' }
    ]
  },
  {
    documentId: 'DOC-MANIFEST-SE913',
    type: 'Manifest',
    name: 'SE913-MANIFEST-08APR.pdf',
    linkedTo: 'SE913 / Export Closure',
    version: 'v2',
    updatedAt: '2026-04-08 18:18',
    status: '警戒',
    activeVersionId: 'DOC-MANIFEST-SE913-V2',
    previewType: 'pdf',
    nextStep: '机坪放行与 Airborne',
    gateIds: ['HG-01', 'HG-08'],
    bindingTargets: [
      { label: 'Shipment / 436-10357583', to: '/station/shipments/out-436-10357583' },
      { label: 'Exception / EXP-0408-002', to: '/station/exceptions/EXP-0408-002' }
    ]
  },
  {
    documentId: 'DOC-MAWB-436-10357583',
    type: 'MAWB',
    name: '436-10357583-主单套打模板.xlsx',
    linkedTo: '436-10357583 / 主单',
    version: 'v2',
    updatedAt: '2026-04-08 18:12',
    status: '运行中',
    activeVersionId: 'DOC-MAWB-436-10357583-V2',
    previewType: 'office',
    nextStep: '组板与装机复核',
    gateIds: ['HG-01', 'HG-02'],
    bindingTargets: [
      { label: 'Shipment / 436-10357583', to: '/station/shipments/out-436-10357583' },
      { label: 'Task / 装机复核', to: '/station/tasks' }
    ]
  },
  {
    documentId: 'DOC-POD-TRK-0406-018',
    type: 'POD',
    name: 'GOFONEW-020426-1 POD.pdf',
    linkedTo: 'TRK-0406-018 / 436-10358585',
    version: 'v1',
    updatedAt: '2026-04-08 18:08',
    status: '阻塞',
    activeVersionId: 'DOC-POD-TRK-0406-018-V1',
    previewType: 'pdf',
    nextStep: 'Closed / 交付归档',
    gateIds: ['HG-05', 'HG-06'],
    bindingTargets: [
      { label: 'Shipment / 436-10358585', to: '/station/shipments/in-436-10358585' },
      { label: 'Exception / EXP-0408-003', to: '/station/exceptions/EXP-0408-003' },
      { label: 'POD 动作', to: '/station/documents/pod' }
    ]
  }
];

export function getStationDocument(documentId) {
  return stationDocumentRows.find((item) => item.documentId === documentId) || stationDocumentRows[0];
}

export const stationCapabilityColumns = [
  { key: 'preWarehouse', label: '前置仓', note: '支持前置仓收货、建单与出仓交接。' },
  { key: 'outboundTerminal', label: '出港货站', note: '支持收货、理货、组板与站内放行。' },
  { key: 'outboundRamp', label: '出港机坪', note: '支持机坪转运、Loaded 确认与飞走前控制。' },
  { key: 'inboundHandling', label: '进港货站', note: '支持拆板、理货、NOA 与二次转运。' },
  { key: 'tailhaulDelivery', label: '尾程交付', note: '支持装车、发车、签收与交付闭环。' },
  { key: 'documentFlow', label: '单证链', note: '支持文件版本、门槛校验与动作留痕。' }
];

const capabilityStatusPatterns = [
  {
    preWarehouse: 'yes',
    outboundTerminal: 'yes',
    outboundRamp: 'building',
    inboundHandling: 'yes',
    tailhaulDelivery: 'yes',
    documentFlow: 'yes'
  },
  {
    preWarehouse: 'no',
    outboundTerminal: 'building',
    outboundRamp: 'no',
    inboundHandling: 'yes',
    tailhaulDelivery: 'building',
    documentFlow: 'yes'
  },
  {
    preWarehouse: 'yes',
    outboundTerminal: 'yes',
    outboundRamp: 'yes',
    inboundHandling: 'building',
    tailhaulDelivery: 'no',
    documentFlow: 'building'
  }
];

export const platformStationCapabilityRows = stationCatalog.map((station, index) => ({
  code: station.code,
  name: station.name,
  region: station.region,
  control: station.control,
  phase: station.phase,
  promise: index % 2 === 0 ? '48-72h' : '72-96h',
  capabilityMatrix: capabilityStatusPatterns[index % capabilityStatusPatterns.length],
  risk: index % 3 === 0 ? '待确认异常字典' : index % 3 === 1 ? '设备映射不完整' : '站点 SLA 待冻结'
}));

export const platformStationTeamRows = [
  { station: 'URC', team: 'URC Export Team', workers: 18, shift: '夜班', mappedLanes: 'URC -> MME / MST', status: '运行中' },
  { station: 'MME', team: 'MME Inbound Team A', workers: 12, shift: '白班', mappedLanes: 'Flight -> Inbound -> Delivery', status: '运行中' },
  { station: 'MME', team: 'MME Check Desk', workers: 6, shift: '白班', mappedLanes: '理货复核 / NOA 放行', status: '运行中' },
  { station: 'RZE', team: 'RZE Setup Team', workers: 4, shift: '待定', mappedLanes: 'RZE 接入准备', status: '待处理' }
];

export const platformStationZoneRows = [
  { station: 'URC', zone: 'URC-BUILD-01', type: 'Build-up', linkedLane: 'URC Export', status: '运行中' },
  { station: 'URC', zone: 'URC-RAMP-02', type: 'Ramp Buffer', linkedLane: 'URC Ramp', status: '警戒' },
  { station: 'MME', zone: 'MME-INB-01', type: 'Breakdown', linkedLane: 'MME Inbound', status: '运行中' },
  { station: 'MME', zone: 'MME-DLV-03', type: 'Delivery', linkedLane: 'Tailhaul / Delivery', status: '运行中' }
];

export const platformStationDeviceRows = [
  { station: 'URC', device: 'PDA-URC-01', role: 'Export Receiver', owner: 'URC Export Team', status: '运行中' },
  { station: 'URC', device: 'PDA-URC-02', role: 'Ramp Loader', owner: 'URC Ramp Team', status: '待处理' },
  { station: 'MME', device: 'PDA-MME-01', role: 'Breakdown Worker', owner: 'MME Inbound Team A', status: '运行中' },
  { station: 'MME', device: 'PDA-MME-02', role: 'Delivery Desk', owner: 'Destination Ops', status: '运行中' }
];

export const networkLaneTemplateRows = [
  {
    laneCode: 'LANE-URC-MME-01',
    lane: 'URC -> MME -> Delivery',
    nodeOrder: '前置仓 -> 头程卡车 -> 出港货站 -> 出港机坪 -> Flight -> 进港机坪 -> 进港货站 -> 尾程装车 -> 交付仓',
    sla: '48-60h',
    controlDepth: '强控制',
    sampleStation: 'URC / MME'
  },
  {
    laneCode: 'LANE-URC-MST-01',
    lane: 'URC -> MST',
    nodeOrder: '前置仓 -> 出港货站 -> Flight -> 进港货站',
    sla: '72h',
    controlDepth: '协同控制',
    sampleStation: 'URC / MST'
  }
];

export const networkScenarioRows = [
  {
    id: 'SCN-B-01',
    title: '标准场景 B：前置仓到出港文件链',
    lane: 'URC -> 出港 -> MME -> 交付',
    nodes: '前置仓收货、头程卡车、出港货站、出港机坪、Flight、进港机坪、进港货站、尾程装车、交付仓',
    entryRule: '关键文件齐全后才能进入下游任务',
    evidence: 'CMR / Origin POD / FFM / UWS / Manifest / POD'
  },
  {
    id: 'SCN-A-02',
    title: '标准场景 A：航班落地后拆板到装车',
    lane: 'MME 进港样板链路',
    nodes: 'Landed -> Inbound Handling -> Breakdown -> Sorting -> Tailhaul',
    entryRule: 'CBA / Manifest / Handling Plan 触发',
    evidence: '开工照片 / 理货记录 / Collection Note / POD'
  }
];

export const auditEventDetailRows = auditEvents.map((event, index) => ({
  id: `AUD-${index + 1}`,
  ...event,
  before: index % 2 === 0 ? '旧状态口径 / 旧版本' : '未设置',
  after: index % 2 === 0 ? '新状态口径 / 新版本' : '已设置',
  linkedType: ['Station', 'Document', 'Rule', 'Manifest'][index] || 'Event'
}));

export const trustTraceRows = [
  {
    eventId: 'EVT-20260408-001',
    object: 'SE913 Manifest',
    eventHash: 'HASH-MANIFEST-001',
    signatureRef: 'SIG-URC-OPS-001',
    notarizationRef: 'N/A',
    status: '待处理'
  },
  {
    eventId: 'EVT-20260408-002',
    object: 'TRK-0406-018 POD',
    eventHash: 'HASH-POD-018',
    signatureRef: 'SIG-MME-DLV-018',
    notarizationRef: 'N/A',
    status: '运行中'
  }
];

export const platformReportCards = [
  { title: '平台 SLA 达成率', value: '93.6%', helper: '按链路模板统计，基于第二批主演示链路聚合', chip: 'SLA', color: 'primary' },
  { title: '接口稳定性', value: '97.8%', helper: 'FFM / UWS / Manifest / POD 模拟同步稳定率', chip: 'Sync', color: 'secondary' },
  { title: '异常分布', value: '7 条', helper: '数量、单证、签收、转运异常总量', chip: 'Risk', color: 'warning' },
  { title: '扩站准备度', value: '4 / 7', helper: '满足第二批 demo 站点能力矩阵的站点数', chip: 'Stations', color: 'success' }
];

export const platformStationReportRows = stationCatalog.map((station, index) => ({
  code: station.code,
  station: station.name,
  control: station.control,
  inboundSla: `${92 - index}%`,
  podClosure: `${88 - index}%`,
  exceptionAging: `${12 + index}h`,
  readiness: `${80 + index * 2}%`
}));

export const integrationSyncRows = [
  { name: 'FFM Sync', target: 'URC Export', lastRun: '2026-04-08 10:20', status: '运行中', fallback: '人工补录' },
  { name: 'UWS Sync', target: 'URC Ramp', lastRun: '2026-04-08 10:35', status: '运行中', fallback: 'Excel 模板' },
  { name: 'Manifest Sync', target: 'MME Inbound', lastRun: '2026-04-08 10:48', status: '警戒', fallback: 'PDF 对账' },
  { name: 'POD Sync', target: 'Delivery Desk', lastRun: '2026-04-08 11:05', status: '待处理', fallback: '人工补签' },
  { name: 'Flight Runtime Sync', target: 'Platform Ops', lastRun: '2026-04-08 10:50', status: '运行中', fallback: '航班状态手工回填' },
  { name: 'Last-mile Sync', target: 'Destination Ops', lastRun: '2026-04-08 10:58', status: '警戒', fallback: 'Delivery Record 手录' }
];

export const integrationSyncActionRows = [
  { name: 'FFM Sync', primaryAction: '模拟导入', fallbackAction: '人工补录', note: '用于演示 14.1 航班与文件接口入口。' },
  { name: 'UWS Sync', primaryAction: '模拟同步', fallbackAction: 'Excel 模板', note: '用于演示 Loaded 前的 UWS 数据回填。' },
  { name: 'Manifest Sync', primaryAction: '重新解析', fallbackAction: 'PDF 对账', note: '用于演示失败重跑与人工对账。' },
  { name: 'POD Sync', primaryAction: '补签回写', fallbackAction: '人工补签', note: '用于演示 POD / CMR 生成与回写入口。' },
  { name: 'Flight Runtime Sync', primaryAction: '手工回填', fallbackAction: '状态修复', note: '用于演示 Runtime 事件写入口。' },
  { name: 'Last-mile Sync', primaryAction: '末端回传', fallbackAction: 'Delivery Record 手录', note: '用于演示 Out for Delivery / Delivered 回写。' }
];

export const demoPermissionMatrixRows = [
  { scope: 'Platform', role: '平台超级管理员', visible: '全网态势 / 货站接入 / 规则配置 / 审计', controls: '新增站点、修改规则、重分配异常', note: '前端 demo 只做显隐表达，不做真实 RBAC。' },
  { scope: 'Platform', role: '平台运营管理员', visible: '航线网络 / 主数据 / 同步看板 / 报表', controls: '导入重试、接口兜底、SLA 调整建议', note: '不能执行平台级删除动作。' },
  { scope: 'Station', role: '货站管理员', visible: '货站看板 / 任务池 / 资源 / 异常', controls: '人工放行、班组分配、异常恢复', note: '围绕本站范围表达权限边界。' },
  { scope: 'Station', role: '主管 / 复核岗', visible: '待复核 / 阻断任务 / POD / NOA', controls: '临时放行、复核确认、POD 补签', note: '与 HG 放行角色保持一致。' },
  { scope: 'PDA', role: '收货员 / 复核员 / 文员 / 司机 / 交付岗', visible: '只显示各自节点和动作', controls: '扫码、确认、异常、签字、上传证据', note: '当前已由移动端 demo 角色切换驱动。' }
];

export const nonFunctionalDemoRows = [
  { category: '性能', target: '关键页 3 秒内返回', currentDemo: '已通过静态构建与本地渲染校验', note: '当前阶段以本地 demo 渲染速度表达，不测真实服务性能。' },
  { category: '稳定性', target: '关键状态写入具备幂等与重试', currentDemo: '接口看板与导入任务页已表达重试和兜底', note: '只做前端动作与日志表达，不接真实后端重试。' },
  { category: '离线能力', target: 'PDA 断网缓存与恢复同步', currentDemo: 'TaskOpsPanel 已支持 offline / queued / synced / failed', note: '仅使用本地队列模拟补传。' },
  { category: '安全', target: '角色与站点范围隔离', currentDemo: '桌面端权限矩阵 + 移动端 Demo 角色切换', note: '不做真实鉴权或 token。' },
  { category: '文件存储', target: '版本化、不可覆盖原件、可追溯下载', currentDemo: '单证与指令中心已表达版本、生效、回退、预览', note: '不连接真实对象存储。' },
  { category: '兼容性', target: '桌面浏览器 + Android 手持终端', currentDemo: '桌面后台与移动端壳层均已提供 demo 页面', note: '当前以响应式和浏览器调试表达兼容性。' }
];

export const stationWorkerRows = [
  { workerId: 'WKR-URC-01', name: 'URC 收货员 A', team: 'URC Export Team', role: 'Export Receiver', status: '运行中' },
  { workerId: 'WKR-URC-02', name: 'URC Ramp Loader', team: 'URC Ramp Team', role: 'Ramp Loader', status: '运行中' },
  { workerId: 'WKR-MME-01', name: 'MME 理货员 A', team: 'MME Inbound Team A', role: 'Check Worker', status: '运行中' },
  { workerId: 'WKR-MME-02', name: 'MME Delivery Desk', team: 'Destination Ops', role: 'Delivery Desk', status: '待处理' }
];

export const stationVehicleRows = [
  { tripId: 'TRIP-URC-001', plate: 'URC-TRK-101', driver: 'H. Zhao', collectionNote: 'CN-URC-001', stage: '待发车', status: '待处理' },
  { tripId: 'TRIP-URC-002', plate: 'URC-TRK-205', driver: 'L. Wang', collectionNote: 'CN-URC-002', stage: '在途', status: '运行中' },
  { tripId: 'TRIP-MME-018', plate: 'MME-6271', driver: 'J. Kramer', collectionNote: 'CN-MME-018', stage: '待签收', status: '警戒' }
];

export const OFFICE_TRIP_STORAGE_KEY = 'sinoport-office-trip-plans-v1';

export const DEFAULT_OFFICE_TRIP_PLANS = [
  {
    tripId: 'TRIP-URC-001',
    flowKey: 'headhaul',
    route: 'URC -> 出港货站',
    plate: 'URC-TRK-101',
    driver: 'H. Zhao',
    collectionNote: 'CN-URC-001',
    stage: '待发车',
    status: '待处理',
    priority: 'P1',
    sla: '收货完成后 20 分钟',
    awbs: ['436-10358585', '436-10359044', '436-10359218'],
    pallets: [],
    officePlan: '后台已锁定发车窗口 18:20，CMR 已生成。',
    pdaExec: '司机到场确认、发车、到站交接'
  },
  {
    tripId: 'TRIP-URC-002',
    flowKey: 'headhaul',
    route: 'URC -> 出港货站',
    plate: 'URC-TRK-205',
    driver: 'L. Wang',
    collectionNote: 'CN-URC-002',
    stage: '在途',
    status: '运行中',
    priority: 'P2',
    sla: '在途回传每 30 分钟',
    awbs: ['436-10359301', '436-10359512'],
    pallets: [],
    officePlan: '后台已下发到站窗口 19:30。',
    pdaExec: '在途回传、到站交接'
  },
  {
    tripId: 'TAIL-001',
    flowKey: 'tailhaul',
    route: 'MME -> Delivery',
    plate: 'MME-6271',
    driver: 'J. Kramer',
    collectionNote: 'CN-MME-018',
    stage: '待发车',
    status: '待处理',
    priority: 'P1',
    sla: '车辆到场后 15 分钟',
    awbs: ['436-10358585'],
    pallets: ['SE803-PLT-1101', 'SE803-PLT-1102', 'SE803-PLT-1103'],
    officePlan: '后台已预排 Delivery 窗口与签收要求。',
    pdaExec: '装车复核、发车、签收回传'
  },
  {
    tripId: 'TAIL-002',
    flowKey: 'tailhaul',
    route: 'MME -> Delivery',
    plate: 'MME-5198',
    driver: 'L. Chen',
    collectionNote: 'CN-MME-014',
    stage: '在途',
    status: '运行中',
    priority: 'P2',
    sla: '在途回传每 20 分钟',
    awbs: ['436-10357944'],
    pallets: ['SE803-PLT-1008', 'SE803-PLT-1009'],
    officePlan: '后台已确认交付窗口与交接文件要求。',
    pdaExec: '在途回传、补交接文件、交付'
  }
];

export function readOfficeTripPlans() {
  if (typeof window === 'undefined') return DEFAULT_OFFICE_TRIP_PLANS;

  try {
    const raw = window.localStorage.getItem(OFFICE_TRIP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_OFFICE_TRIP_PLANS;
  } catch {
    return DEFAULT_OFFICE_TRIP_PLANS;
  }
}

export const stationReportCards = [
  { title: '12 小时完成率', value: '91%', helper: '按样板链路统计从落地到交付的闭环效率', chip: '12H', color: 'primary' },
  { title: '装车准确率', value: '98.2%', helper: '车牌 / 托盘 / 箱数 / Collection Note 复核一致率', chip: 'Loading', color: 'secondary' },
  { title: 'POD 闭环率', value: '86.4%', helper: '已签收并完成归档的比例', chip: 'POD', color: 'success' },
  { title: '异常闭环时长', value: '6.8h', helper: '异常从提出到恢复的平均耗时', chip: 'Recovery', color: 'warning' }
];

export const shiftReportRows = [
  { shift: 'URC 夜班', team: 'URC Export Team', completed: '14 / 16', loadingAccuracy: '98%', podClosure: 'N/A', exceptionAge: '2.1h' },
  { shift: 'MME 白班', team: 'MME Inbound Team A', completed: '11 / 13', loadingAccuracy: '97%', podClosure: '88%', exceptionAge: '4.3h' },
  { shift: 'MME 交付班', team: 'Destination Ops', completed: '9 / 10', loadingAccuracy: 'N/A', podClosure: '91%', exceptionAge: '1.7h' }
];

export const platformDailyReportRows = [
  { section: '航班态势', metric: 'Airborne / Landed / Pre-Arrival', current: 'SE913 Airborne / SE803 Landed', note: '用于演示平台日报的运行态摘要。' },
  { section: '承诺风险', metric: 'SLA Risk Lanes', current: '2 条链路预警', note: '聚焦第二批主演示链路。' },
  { section: '任务超时', metric: 'Overdue Tasks', current: '3 条待升级', note: '与 HG-08 自动升级保持同源。' },
  { section: '异常分布', metric: 'Exception Mix', current: '数量 3 / 单证 2 / 签收 1', note: '平台日报的异常分布摘要。' }
];

export const stationFileReportRows = [
  { report: '关键文件缺失', object: 'SE803 CBA / 436-10358585 POD', current: '2 条未满足放行条件', note: '对应 HG-01 与 HG-06。' },
  { report: '文件版本替换', object: 'SE913 Manifest', current: 'v2 生效 / v3 待发布', note: '用于演示替换、生效、回退。' },
  { report: '文件生效时间', object: 'SE913 FFM / UWS', current: '2026-04-08 17:55 / 18:02', note: '用于演示文件驱动状态放行。' },
  { report: '下载与预览审计', object: 'GOFONEW-020426-1 POD.pdf', current: '已预览 / 待归档', note: '当前只做前端动作记录。' }
];

export const pdaKpiRows = [
  { metric: '接单时长', current: '2m 18s', target: '<= 5m', note: '任务派发到接单确认的样例时长。' },
  { metric: '到场时长', current: '6m 42s', target: '<= 10m', note: '接单到到达作业点的样例时长。' },
  { metric: '任务完成时长', current: '18m 05s', target: '<= 25m', note: '开始到完成的样例时长。' },
  { metric: '证据上传完整率', current: '92%', target: '>= 95%', note: '需照片/签字/扫码的任务样例口径。' },
  { metric: '异常首次反馈时长', current: '4m 10s', target: '<= 8m', note: '发现异常到首次上报的样例时长。' }
];

export const noaNotificationRows = [
  {
    id: 'NOA-001',
    awb: '436-10358585',
    channel: 'Email',
    target: 'SMDG LOGISTICS',
    status: '待处理',
    retry: '允许补发',
    note: 'HG-03 未解除前不能发送',
    gateId: 'HG-03',
    objectTo: '/station/shipments/in-436-10358585'
  },
  {
    id: 'NOA-002',
    awb: '436-10357944',
    channel: 'WhatsApp',
    target: 'LUCAROM AIR',
    status: '已发送',
    retry: '无需',
    note: '已通过理货复核并进入提货预约',
    gateId: 'HG-03',
    objectTo: '/station/shipments/in-436-10358585'
  },
  {
    id: 'NOA-003',
    awb: '436-10357093',
    channel: 'Email',
    target: 'MST Hub',
    status: '发送失败',
    retry: '可重试',
    note: '门槛已通过，但目标邮箱退信',
    gateId: 'HG-03',
    objectTo: '/station/shipments/in-436-10358585'
  }
];

export const podNotificationRows = [
  {
    id: 'POD-001',
    object: 'TRK-0406-018',
    signer: 'Delivery Desk',
    status: '待补签',
    retry: '等待司机签字',
    note: 'HG-06 命中，缺双签阻断 Closed',
    gateId: 'HG-06',
    objectTo: '/station/shipments/in-436-10358585'
  },
  {
    id: 'POD-002',
    object: '436-10354363',
    signer: 'Warehouse Receiver',
    status: '已归档',
    retry: '无需',
    note: '已完成交付归档',
    gateId: 'HG-06',
    objectTo: '/station/shipments/in-436-10358585'
  },
  {
    id: 'POD-003',
    object: '436-10358585',
    signer: 'Customer Desk',
    status: '警戒',
    retry: '允许人工补传',
    note: '扫描件模糊，需重新上传',
    gateId: 'HG-06',
    objectTo: '/station/shipments/in-436-10358585'
  }
];

export const mobileRoleOptions = [
  { value: 'receiver', label: '收货员' },
  { value: 'checker', label: '复核员' },
  { value: 'supervisor', label: '主管 / 复核岗' },
  { value: 'document_clerk', label: '单证文员' },
  { value: 'driver', label: '司机 / 车队协调' },
  { value: 'delivery_clerk', label: '交付岗' }
];

export const roleTaskViews = {
  receiver: {
    label: '收货员',
    taskRoles: ['Warehouse Receiver', 'Export Receiver'],
    inboundTabs: ['overview', 'counting'],
    outboundTabs: ['overview', 'receipt'],
    flowKeys: ['preWarehouse'],
    actionTypes: ['scan', 'confirm', 'exception', 'suspend', 'complete']
  },
  checker: {
    label: '复核员',
    taskRoles: ['Check Worker', 'Pallet Builder'],
    inboundTabs: ['overview', 'counting', 'pallet'],
    outboundTabs: ['overview', 'receipt', 'container'],
    flowKeys: ['destinationRamp'],
    actionTypes: ['scan', 'confirm', 'exception', 'suspend', 'complete', 'upload-evidence']
  },
  supervisor: {
    label: '主管 / 复核岗',
    taskRoles: ['Inbound Supervisor', 'Export Supervisor', 'Runtime Monitor', 'Ramp Loader', 'Destination Ramp', 'Build-up Worker'],
    inboundTabs: ['overview', 'counting', 'pallet', 'loading'],
    outboundTabs: ['overview', 'receipt', 'container', 'loading'],
    flowKeys: ['exportRamp', 'runtime', 'destinationRamp'],
    actionTypes: ['scan', 'confirm', 'exception', 'suspend', 'complete', 'upload-evidence', 'sign']
  },
  document_clerk: {
    label: '单证文员',
    taskRoles: ['Document Desk', 'Customer Desk'],
    inboundTabs: ['overview'],
    outboundTabs: ['overview'],
    flowKeys: ['runtime'],
    actionTypes: ['confirm', 'exception', 'upload-evidence', 'sign']
  },
  driver: {
    label: '司机 / 车队协调',
    taskRoles: ['Linehaul Coordinator', 'Loading Coordinator'],
    inboundTabs: ['overview', 'loading'],
    outboundTabs: ['overview', 'loading'],
    flowKeys: ['headhaul', 'tailhaul'],
    actionTypes: ['confirm', 'exception', 'suspend', 'complete']
  },
  delivery_clerk: {
    label: '交付岗',
    taskRoles: ['Delivery Desk'],
    inboundTabs: ['overview'],
    outboundTabs: ['overview'],
    flowKeys: ['delivery'],
    actionTypes: ['confirm', 'exception', 'complete', 'sign', 'upload-evidence']
  }
};

export function getMobileRoleView(roleKey) {
  return roleTaskViews[roleKey] || roleTaskViews.supervisor;
}

export function isMobileRoleAllowed(roleKey, taskRole) {
  return true;
}

export function isMobileTabAllowed(roleKey, domain, tabKey) {
  return true;
}

export function isMobileFlowAllowed(roleKey, flowKey) {
  return true;
}

export function filterMobileActionsByRole(roleKey, actions = []) {
  return actions;
}

export const mobileNodeOptions = [
  {
    key: 'pre_warehouse',
    title: '前置仓收货',
    description: '处理前置仓收货、件重体确认、异常标记和冻结放行。',
    path: '/mobile/pre-warehouse'
  },
  {
    key: 'headhaul',
    title: '头程卡车',
    description: '处理 CMR、司机、车牌、发车和到站交接。',
    path: '/mobile/headhaul'
  },
  {
    key: 'outbound_station',
    title: '出港货站',
    description: '沿用现有出港链路，处理收货、理货、组板、单证核对。',
    path: '/mobile/outbound'
  },
  {
    key: 'export_ramp',
    title: '出港机坪',
    description: '处理转运、Loaded 确认和装机证据上传。',
    path: '/mobile/export-ramp'
  },
  {
    key: 'flight_runtime',
    title: '航班运行',
    description: '处理 Airborne / Landed 的只读确认与异常上报入口。',
    path: '/mobile/runtime'
  },
  {
    key: 'destination_ramp',
    title: '到港机坪',
    description: '处理到港接机、机坪放行和转入货站。',
    path: '/mobile/destination-ramp'
  },
  {
    key: 'inbound_station',
    title: '进港货站',
    description: '沿用现有进港链路，处理拆板、理货、组托和装车。',
    path: '/mobile/inbound'
  },
  {
    key: 'tailhaul',
    title: '尾程装车',
    description: '处理司机 / 车牌登记、装车复核、发车和交接文件。',
    path: '/mobile/tailhaul'
  },
  {
    key: 'delivery',
    title: '交付仓',
    description: '处理签收、POD 双签、异常签收和关闭校验。',
    path: '/mobile/delivery'
  }
];

const mobileFlowCatalog = {
  preWarehouse: {
    listTitle: '前置仓收货批次',
    detailTitle: '前置仓收货任务',
    list: [
      {
        id: 'URC-COL-001',
        title: 'URC-COL-001',
        subtitle: 'URC 前置仓 · 3 AWB / 286 箱 / 4,128 kg',
        status: '待处理',
        priority: 'P1'
      },
      {
        id: 'URC-COL-002',
        title: 'URC-COL-002',
        subtitle: 'URC 前置仓 · 2 AWB / 148 箱 / 2,196 kg',
        status: '运行中',
        priority: 'P2'
      }
    ],
    details: {
      'URC-COL-001': {
        title: 'URC-COL-001',
        node: '前置仓收货',
        role: 'Warehouse Receiver',
        status: '待处理',
        priority: 'P1',
        sla: '收货后 15 分钟',
        description: '确认批次收货、件重体、异常件和冻结放行条件。',
        evidence: ['Collection Note', '件重体确认', '异常照片'],
        blockers: ['未确认件重体不得进入头程卡车。'],
        actions: [{ label: '确认收货', variant: 'contained' }, { label: '异常标记' }, { label: '冻结放行' }],
        summaryRows: [
          { label: '站点', value: 'URC 前置仓' },
          { label: 'AWB', value: '436-10357583 / 436-10357896 / 436-10358585' },
          { label: '件数', value: '286 箱' },
          { label: '重量', value: '4,128 kg' }
        ],
        records: ['Collection Note 待补签', '异常件 2 箱待拍照', '完成后生成头程卡车任务']
      },
      'URC-COL-002': {
        title: 'URC-COL-002',
        node: '前置仓收货',
        role: 'Warehouse Receiver',
        status: '运行中',
        priority: 'P2',
        sla: '收货后 30 分钟',
        description: '样例批次已开始收货，用于演示第二批的前置仓节点。',
        evidence: ['件重体确认', '异常备注'],
        blockers: ['存在异常件时只能进入待复核。'],
        actions: [{ label: '继续收货', variant: 'contained' }, { label: '挂起' }, { label: '完成' }],
        summaryRows: [
          { label: '站点', value: 'URC 前置仓' },
          { label: 'AWB', value: '436-10359218 / 436-10359301' },
          { label: '件数', value: '148 箱' },
          { label: '重量', value: '2,196 kg' }
        ],
        records: ['已确认 120 箱', '待补 28 箱', '异常 0 箱']
      }
    }
  },
  headhaul: {
    listTitle: '头程卡车 Trip',
    detailTitle: '头程卡车任务',
    list: [
      { id: 'TRIP-URC-001', title: 'TRIP-URC-001', subtitle: 'URC -> 出港货站 / 车牌 URC-TRK-101', status: '待发车', priority: 'P1' },
      { id: 'TRIP-URC-002', title: 'TRIP-URC-002', subtitle: 'URC -> 出港货站 / 车牌 URC-TRK-205', status: '在途', priority: 'P2' }
    ],
    details: {
      'TRIP-URC-001': {
        title: 'TRIP-URC-001',
        node: '头程卡车运输',
        role: 'Linehaul Coordinator',
        status: '待发车',
        priority: 'P1',
        sla: '收货完成后 20 分钟',
        description: '确认 CMR、司机、车牌和发车状态，完成从前置仓到出港货站交接。',
        evidence: ['CMR', '司机 / 车牌', '发车时间'],
        blockers: ['未确认 CMR 不得发车。'],
        actions: [{ label: '确认 CMR', variant: 'contained' }, { label: '发车' }, { label: '到站交接' }],
        summaryRows: [
          { label: '车牌', value: 'URC-TRK-101' },
          { label: '司机', value: 'H. Zhao' },
          { label: 'CMR', value: 'CMR-URC-001' },
          { label: '预报提单数', value: '3 票' },
          { label: '当前状态', value: '待发车' }
        ],
        forecastWaybills: [
          { awb: '436-10358585', consignee: 'SMDG LOGISTICS', pieces: '50', weight: '700 kg' },
          { awb: '436-10359044', consignee: 'MME FASHION HUB', pieces: '68', weight: '1,028 kg' },
          { awb: '436-10359218', consignee: 'MME ACCESSORY BV', pieces: '42', weight: '756 kg' }
        ],
        records: ['Collection Note 已完成', '司机到场', '出发后进入在途']
      },
      'TRIP-URC-002': {
        title: 'TRIP-URC-002',
        node: '头程卡车运输',
        role: 'Linehaul Coordinator',
        status: '在途',
        priority: 'P2',
        sla: '在途回传每 30 分钟',
        description: '样例 Trip 已发车，用于演示在途与到站交接。',
        evidence: ['位置回传', '到站签收'],
        blockers: ['无到站交接文件时不得进入出港货站收货。'],
        actions: [{ label: '记录在途', variant: 'contained' }, { label: '到站交接' }],
        summaryRows: [
          { label: '车牌', value: 'URC-TRK-205' },
          { label: '司机', value: 'L. Wang' },
          { label: 'CMR', value: 'CMR-URC-002' },
          { label: '预报提单数', value: '2 票' },
          { label: '当前状态', value: '在途' }
        ],
        forecastWaybills: [
          { awb: '436-10359301', consignee: 'MME ECOM DC', pieces: '36', weight: '612 kg' },
          { awb: '436-10359512', consignee: 'MST TEXTILE BV', pieces: '64', weight: '960 kg' }
        ],
        records: ['已发车 35 分钟', '预计 20 分钟后到站']
      }
    }
  },
  exportRamp: {
    listTitle: '出港机坪航班',
    detailTitle: '出港机坪任务',
    list: [
      { id: 'SE913', title: 'SE913', subtitle: 'URC 出港机坪 / Loaded 前检查', status: '待处理', priority: 'P1' },
      { id: 'URO913', title: 'URO913', subtitle: 'URC 出港机坪 / UWS 复核中', status: '运行中', priority: 'P2' }
    ],
    details: {
      SE913: {
        title: 'SE913',
        node: '出港机场机坪操作',
        role: 'Ramp Loader',
        status: '待处理',
        priority: 'P1',
        sla: '飞走前 30 分钟',
        description: '执行机坪转运、Loaded 确认和装机证据上传。',
        evidence: ['Loaded 照片', 'ULD 绑定', '复核签名'],
        blockers: ['Manifest 未冻结不得完成机坪放行。'],
        actions: [{ label: '记录转运', variant: 'contained' }, { label: '确认 Loaded' }, { label: '上传证据' }],
        summaryRows: [
          { label: '航班', value: 'SE913' },
          { label: 'ETD', value: '23:00' },
          { label: 'Manifest', value: '待冻结' },
          { label: 'UWS', value: '已接收' }
        ],
        positionOptions: ['11L', '11R', '13L', '13R', '14P', '15C'],
        uldAssignments: [
          { uld: 'ULD91001', pieces: '31 箱', weight: '2,180.5 kg', destination: 'MST', position: '' },
          { uld: 'ULD91002', pieces: '14 箱', weight: '840.2 kg', destination: 'MST', position: '13L' },
          { uld: 'PMC81793YD', pieces: '12 箱', weight: '904.0 kg', destination: 'MST', position: '' }
        ],
        records: ['待上传 Loaded 照片', '待独立复核签名']
      },
      URO913: {
        title: 'URO913',
        node: '出港机场机坪操作',
        role: 'Ramp Loader',
        status: '运行中',
        priority: 'P2',
        sla: '飞走前 20 分钟',
        description: '样例航班已进入出港机坪处理，用于演示第二批节点。',
        evidence: ['UWS 复核', 'Loaded 时间戳'],
        blockers: ['无 UWS 不得标记已装载。'],
        actions: [{ label: '继续装机', variant: 'contained' }, { label: '完成 Loaded' }],
        summaryRows: [
          { label: '航班', value: 'URO913' },
          { label: 'ETD', value: '01:20' },
          { label: 'Manifest', value: '待回传' },
          { label: 'UWS', value: '运行中' }
        ],
        positionOptions: ['21L', '21R', '22P'],
        uldAssignments: [
          { uld: 'ULD93001', pieces: '18 箱', weight: '1,050.0 kg', destination: 'LGG', position: '21L' },
          { uld: 'ULD93002', pieces: '10 箱', weight: '620.0 kg', destination: 'LGG', position: '' }
        ],
        records: ['已完成 2 个 ULD 绑定', '剩余 1 个 ULD 待复核']
      }
    }
  },
  flightRuntime: {
    listTitle: '航班运行节点',
    detailTitle: '航班运行任务',
    list: [
      { id: 'SE913', title: 'SE913', subtitle: 'URC -> Flight Runtime / Airborne 待确认', status: '待处理', priority: 'P1' },
      { id: 'SE803', title: 'SE803', subtitle: 'Landed 后待目的站准备', status: '运行中', priority: 'P1' }
    ],
    details: {
      SE913: {
        title: 'SE913',
        node: '航班运行',
        role: 'Runtime Monitor',
        status: '待处理',
        priority: 'P1',
        sla: '起飞后即时确认',
        description: '航班运行节点只做只读确认和异常上报，不承接现场执行动作。',
        evidence: ['Flight Runtime', '异常备注'],
        blockers: ['无 Flight Runtime 回填时，只能停留在待处理。'],
        actions: [{ label: '确认 Airborne', variant: 'contained' }, { label: '上报异常' }],
        summaryRows: [
          { label: '航班', value: 'SE913' },
          { label: 'Runtime', value: 'Airborne' },
          { label: '链路', value: 'URC -> MME / MST' },
          { label: '当前口径', value: '只读确认 + 异常上报' }
        ],
        flightInfoRows: [
          { label: '航班号', value: 'SE913' },
          { label: '方向', value: '出港' },
          { label: 'Runtime', value: 'Airborne' },
          { label: '航线', value: 'URC -> MME / MST' },
          { label: 'ETD', value: '23:00' },
          { label: '机型', value: 'B747-400F' },
          { label: '当前阶段', value: '装载中' },
          { label: '货量', value: '26 AWB / 1,396 pcs / 24,452 kg' },
          { label: 'Manifest', value: '待生成' },
          { label: 'UWS', value: '已接收' }
        ],
        flightDocuments: [
          { title: 'FFM', description: 'SE913-FFM-08APR.docx', status: '运行中', meta: '18:22 已完成结构化导入' },
          { title: 'UWS', description: 'SE913-UWS-08APR.xlsx', status: '运行中', meta: '18:34 已接收，可用于 Loaded 对账' },
          { title: 'Manifest', description: 'SE913-MANIFEST-08APR.pdf', status: '待生成', meta: '最终版未冻结，仍阻断机坪放行' }
        ],
        records: ['起飞时间待确认', '异常则升级到 Platform Ops']
      },
      SE803: {
        title: 'SE803',
        node: '航班运行',
        role: 'Runtime Monitor',
        status: '运行中',
        priority: 'P1',
        sla: '落地后 5 分钟内确认',
        description: '航班已进入 Landed，可继续触发到港机坪和目的站准备任务。',
        evidence: ['Landed 确认', '异常备注'],
        blockers: ['无 Landed 确认时，进港机坪节点不应继续。'],
        actions: [{ label: '确认 Landed', variant: 'contained' }, { label: '上报异常' }],
        summaryRows: [
          { label: '航班', value: 'SE803' },
          { label: 'Runtime', value: 'Landed' },
          { label: '链路', value: 'Flight -> MME' },
          { label: '当前口径', value: '只读确认 + 异常上报' }
        ],
        flightInfoRows: [
          { label: '航班号', value: 'SE803' },
          { label: '方向', value: '进港' },
          { label: 'Runtime', value: 'Landed' },
          { label: '来源', value: 'MING PAO CANADA' },
          { label: '目的站', value: 'MME' },
          { label: 'ETA', value: '19:05' },
          { label: 'ETD', value: '17:40' },
          { label: '机型', value: 'B767-300F' },
          { label: '当前阶段', value: '拆板中' },
          { label: '货量', value: '214 pcs / 3,860 kg' }
        ],
        flightDocuments: [
          { title: 'CBA', description: 'SE803-CBA-v2.pdf', status: '警戒', meta: '最终版待上传，拆板任务仅可预排' },
          { title: 'Manifest', description: 'SE803 MANIFEST 08APR.pdf', status: '运行中', meta: '已生效，可继续目的站准备' }
        ],
        records: ['Landed 后允许进入目的站准备', '异常则阻断后续节点']
      }
    }
  },
  destinationRamp: {
    listTitle: '到港机坪航班',
    detailTitle: '到港机坪任务',
    list: [
      { id: 'SE803', title: 'SE803', subtitle: 'MME 到港机坪 / 待放行入货站', status: '待处理', priority: 'P1' },
      { id: 'SE681', title: 'SE681', subtitle: 'MME 到港机坪 / 已接机', status: '已接机', priority: 'P2' }
    ],
    details: {
      SE803: {
        title: 'SE803',
        node: '进港机场机坪操作',
        role: 'Destination Ramp',
        status: '待处理',
        priority: 'P1',
        sla: 'Landed 后 15 分钟',
        description: '处理到港接机、机坪放行和转入货站。',
        evidence: ['接机确认', '放行时间', '转入货站记录'],
        blockers: ['机坪放行前不得进入 Inbound Handling。'],
        actions: [{ label: '确认接机', variant: 'contained' }, { label: '机坪放行' }, { label: '转入货站' }],
        summaryRows: [
          { label: '航班', value: 'SE803' },
          { label: 'ETA', value: '19:05' },
          { label: '机坪状态', value: '待放行' },
          { label: '目标站点', value: 'MME' }
        ],
        unloadTasks: [
          {
            position: '11L',
            uld: 'PMC70018R7',
            cargo: '436-10358585 / 436-10354363',
            requirement: '先拆网并复核板号，再按 MME inbound belt-01 顺序卸载。'
          },
          {
            position: '13R',
            uld: 'PMC54062R7',
            cargo: '436-10359018',
            requirement: '优先转入异常复核区，卸载完成后立即回填到港时间。'
          }
        ],
        records: ['落地已确认', '机坪交接待完成']
      },
      SE681: {
        title: 'SE681',
        node: '进港机场机坪操作',
        role: 'Destination Ramp',
        status: '已接机',
        priority: 'P2',
        sla: 'Landed 后 20 分钟',
        description: '样例到港机坪任务已完成接机，用于演示转入货站前状态。',
        evidence: ['接机时间戳', '交接记录'],
        blockers: ['未完成交接记录不得转入货站。'],
        actions: [{ label: '补交接记录', variant: 'contained' }, { label: '转入货站' }],
        summaryRows: [
          { label: '航班', value: 'SE681' },
          { label: 'ETA', value: '19:20' },
          { label: '机坪状态', value: '已接机' },
          { label: '目标站点', value: 'MME' }
        ],
        unloadTasks: [
          {
            position: '12L',
            uld: 'ULD68101',
            cargo: '436-10360018 / 436-10360027',
            requirement: '按 12L 机位先卸高优货，再回收空板并提交交接记录。'
          }
        ],
        records: ['接机已完成', '待填写放行人']
      }
    }
  },
  tailhaul: {
    listTitle: '尾程装车 Trip',
    detailTitle: '尾程装车与运输任务',
    list: [
      { id: 'TAIL-001', title: 'TAIL-001', subtitle: 'MME -> Delivery / 车牌 MME-6271', status: '待发车', priority: 'P1' },
      { id: 'TAIL-002', title: 'TAIL-002', subtitle: 'MME -> Delivery / 车牌 MME-5198', status: '在途', priority: 'P2' }
    ],
    details: {
      'TAIL-001': {
        title: 'TAIL-001',
        node: '尾程卡车装车与运输',
        role: 'Loading Coordinator',
        status: '待发车',
        priority: 'P1',
        sla: '车辆到场后 15 分钟',
        description: '登记司机、车牌、Collection Note，完成装车复核并发车。',
        evidence: ['司机 / 车牌', 'Collection Note', '装车复核'],
        blockers: ['缺司机、车牌、Collection Note 时不得发车。'],
        actions: [{ label: '登记车辆', variant: 'contained' }, { label: '完成装车复核' }, { label: '发车' }],
        summaryRows: [
          { label: '车牌', value: 'MME-6271' },
          { label: '司机', value: 'J. Kramer' },
          { label: 'Collection Note', value: 'CN-MME-018' },
          { label: 'Pallet', value: '3 托盘' }
        ],
        records: ['待装车复核', '待发车确认']
      },
      'TAIL-002': {
        title: 'TAIL-002',
        node: '尾程卡车装车与运输',
        role: 'Loading Coordinator',
        status: '在途',
        priority: 'P2',
        sla: '在途回传每 20 分钟',
        description: '样例尾程 Trip 已发车，用于演示在途与交接文件。',
        evidence: ['发车时间', '交接文件'],
        blockers: ['无交接文件不得进入交付签收。'],
        actions: [{ label: '记录在途', variant: 'contained' }, { label: '补交接文件' }],
        summaryRows: [
          { label: '车牌', value: 'MME-5198' },
          { label: '司机', value: 'L. Chen' },
          { label: 'Collection Note', value: 'CN-MME-014' },
          { label: 'Pallet', value: '2 托盘' }
        ],
        records: ['已发车 25 分钟', '交接文件待补传']
      }
    }
  },
  delivery: {
    listTitle: '交付仓任务',
    detailTitle: '交付签收任务',
    list: [
      { id: 'DLV-001', title: 'DLV-001', subtitle: 'SMDG LOGISTICS / 待签收', status: '待签收', priority: 'P1' },
      { id: 'DLV-002', title: 'DLV-002', subtitle: 'LUCAROM AIR / 待补签', status: '警戒', priority: 'P2' }
    ],
    details: {
      'DLV-001': {
        title: 'DLV-001',
        node: '交付仓',
        role: 'Delivery Desk',
        status: '待签收',
        priority: 'P1',
        sla: '到仓后 30 分钟',
        description: '处理签收、POD 双签、异常签收与关闭校验。',
        evidence: ['POD 双签', '签收对象', '签收时间'],
        blockers: ['未完成双签不得 Closed。'],
        actions: [{ label: '发起签收', variant: 'contained' }, { label: '记录双签' }, { label: '完成关闭' }],
        summaryRows: [
          { label: '客户', value: 'SMDG LOGISTICS' },
          { label: 'AWB', value: '436-10358585' },
          { label: '车牌', value: 'MME-6271' },
          { label: 'POD', value: '待双签' }
        ],
        records: ['到仓确认已完成', '客户签收待开始']
      },
      'DLV-002': {
        title: 'DLV-002',
        node: '交付仓',
        role: 'Delivery Desk',
        status: '警戒',
        priority: 'P2',
        sla: 'POD 当日闭环',
        description: '样例签收任务已完成交付，但缺 POD 双签。',
        evidence: ['POD 双签', '签收对象'],
        blockers: ['POD 缺双签，阻断 Closed。'],
        actions: [{ label: '补 POD 签字', variant: 'contained' }, { label: '异常签收' }],
        summaryRows: [
          { label: '客户', value: 'LUCAROM AIR' },
          { label: 'AWB', value: '436-10357944' },
          { label: '车牌', value: 'MME-5198' },
          { label: 'POD', value: '待补签' }
        ],
        records: ['交付已完成', '关闭前校验未通过']
      }
    }
  }
};

export function getMobileNodeFlow(flowKey) {
  if (flowKey === 'headhaul' || flowKey === 'tailhaul') {
    const officePlans = readOfficeTripPlans().filter((item) => item.flowKey === flowKey);

    return {
      listTitle: flowKey === 'headhaul' ? '头程卡车 Trip' : '尾程装车 Trip',
      detailTitle: flowKey === 'headhaul' ? '头程卡车任务' : '尾程装车与运输任务',
      list: officePlans.map((item) => ({
        id: item.tripId,
        title: item.tripId,
        subtitle: `${item.route} / 车牌 ${item.plate}`,
        status: item.stage,
        priority: item.priority
      })),
      details: Object.fromEntries(
        officePlans.map((item) => [
          item.tripId,
          {
            title: item.tripId,
            node: flowKey === 'headhaul' ? '头程卡车运输' : '尾程卡车装车与运输',
            role: 'Loading Coordinator',
            status: item.stage,
            priority: item.priority,
            sla: item.sla,
            description: flowKey === 'headhaul' ? '按后台预排 Trip 执行头程发车与到站交接。' : '按后台预排 Trip 执行尾程装车、发车与交付。',
            evidence: ['司机 / 车牌', 'Collection Note', '交接记录'],
            blockers: ['后台未排好 Trip、车牌、司机、Collection Note 时不得开始执行。'],
            actions: flowKey === 'headhaul'
              ? [{ label: '确认 CMR', variant: 'contained' }, { label: '发车' }, { label: '到站交接' }]
              : [{ label: '完成装车复核', variant: 'contained' }, { label: '发车' }, { label: '补交接文件' }],
            summaryRows: [
              { label: '车牌', value: item.plate },
              { label: '司机', value: item.driver },
              { label: 'Collection Note', value: item.collectionNote },
              { label: '预排货物', value: `${item.awbs.length} 票 / ${item.pallets.length} 托盘` }
            ],
            forecastWaybills: item.awbs.map((awb) => ({ awb, consignee: 'Office Planned', pieces: '-', weight: '-' })),
            records: [item.officePlan, item.pdaExec]
          }
        ])
      )
    };
  }

  return mobileFlowCatalog[flowKey];
}

export function getMobileNodeItems(flowKey) {
  return getMobileNodeFlow(flowKey)?.list || [];
}

export function getMobileNodeDetail(flowKey, itemId) {
  const flow = getMobileNodeFlow(flowKey);
  return flow?.details?.[itemId] || null;
}

export const objectRelationshipRows = [
  { source: 'Flight', relation: 'contains', target: 'AWB / Shipment', note: '一个 Flight 可关联多个 AWB / HAWB' },
  { source: 'AWB / Shipment', relation: 'assigned_to', target: 'ULD / PMC', note: '出港时进入集装器，进港时拆板回连' },
  { source: 'ULD / PMC', relation: 'loaded_to', target: 'Truck', note: '尾程装车与 Collection Note 绑定' },
  { source: 'Truck', relation: 'delivers', target: 'POD', note: '签收后生成 POD 双签和关闭校验' },
  { source: 'POD', relation: 'writes', target: 'Event', note: 'POD 归档后形成 Event ID / Hash 预留' }
];

export function getShipmentRelationshipRows(detail) {
  return [
    { source: detail.title, relation: 'belongs_to', target: detail.summary.route, note: '当前对象所属的主演示链路' },
    { source: 'Shipment / AWB', relation: 'binds', target: 'Task', note: '对象可回连作业任务与待复核项' },
    { source: 'Shipment / AWB', relation: 'binds', target: 'Document', note: '对象可回连 CBA / Manifest / POD 等文件' },
    { source: 'Shipment / AWB', relation: 'binds', target: 'Exception', note: '对象可回连异常与恢复动作' }
  ];
}
