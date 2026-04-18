# Sinoport OS W2 站点复制流程与验收链正式冻结文档 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-17`
- 关联阶段：`P2 / W2`
- 适用范围：站点复制流程、接入检查、治理对比、验收记录和模板/配置级回滚链路冻结

## 2. 文档目标

把 `W1` 已冻结的模板边界转换成单一的执行链与验收链，后续只能在本文件定义的状态、字段和引用关系上实施，不再重新定义模板边界。

本文件固定回答 7 件事：

1. 站点复制流程如何承接 `W1`
2. 四条真实接口如何串成一条接入链
3. `warning / blocked / Accepted / Refine / Blocked` 的判定关系
4. `rollbackRequired / rollbackScope / evidenceRef` 的填写约束
5. 接入检查清单如何回链到治理对比和验收模板
6. 哪些对象允许回滚，哪些对象明确不回滚
7. `W2` 的正式验收断言

## 3. 固定前提

### 3.1 本文承接 `W1`

- `W1` 模板边界以 [Sinoport_OS_W1_多站点模板化正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W1_多站点模板化正式冻结文档_v1.0.md) 为唯一上游
- 本文不得重新定义：
  - 模板包边界
  - 强制一致项
  - 站点可覆盖项
  - 最小接入单元
  - 回滚模式

### 3.2 固定样板站与对照站

- 主样板站固定为：`MME`
- 模板对照站固定为：`RZE`
- `RZE` 只用于模板对照，不进入真实业务接入完成态

### 3.3 正式接口

本文只引用当前仓库中已存在的真实接口与字段：

- `GET /api/v1/platform/station-governance/stations/:stationId/copy-package`
- `GET /api/v1/platform/station-governance/stations/:stationId/onboarding-playbook`
- `GET /api/v1/platform/station-governance/stations/:stationId/governance-comparison`
- `GET /api/v1/platform/station-governance/stations/:stationId/acceptance-record-template`

字段来源对应实现：

- `apps/api-worker/src/lib/station-governance.ts`
- `apps/api-worker/src/routes/station.ts`

### 3.4 本文不覆盖

- 第二真实站点上线
- 真实业务数据回滚
- 新增模板种类或新增验收枚举
- 代码实现变更

## 4. 站点复制流程冻结

### 4.1 流程主线

`W2` 固定的接入顺序如下：

1. 读取 `copy-package`
2. 执行 `onboarding-playbook`
3. 读取 `governance-comparison`
4. 生成并冻结 `acceptance-record-template`

这 4 步必须按顺序串联，不允许跳步。

### 4.2 步骤与真实字段映射

| 步骤 | 来源接口 | 必看字段 | 固定作用 |
| --- | --- | --- | --- |
| `bind-copy-package` | `copy-package` | `package_key`、`template_station_id`、`benchmark_station_id`、`minimum_onboarding_unit`、`mandatory_consistency_items`、`station_override_items`、`readiness_checks`、`rollback_policy` | 确认本次接入绑定的是哪一个模板包，以及哪些对象必须统一、哪些对象允许覆盖 |
| `complete-minimum-onboarding-unit` | `copy-package` + `onboarding-playbook` | `minimum_onboarding_unit[*].unit_key`、`onboarding_checklist[*].item_key` | 把模板边界转成可执行检查项，确认主记录、班组、人员、报表锚点和质量门槛已具备 |
| `run-onboarding-checklist` | `onboarding-playbook` | `sop.steps`、`conflict_rules`、`onboarding_checklist`、`completion_policy` | 执行接入检查并归类为 `clear / warning / blocked` |
| `replay-template-scope` | `onboarding-playbook` | `replay_acceptance.reference_sop_document`、`replay_sample_station_id`、`replay_scope`、`accepted_when`、`rollback_scope`、`excluded_objects` | 执行样板回放，验证模板、导入、报表、质量与审计链 |
| `freeze-acceptance-record` | `governance-comparison` + `acceptance-record-template` | `comparison_anchor`、`metric_rows`、`difference_summary_rows`、`issue_backlog_rows`、`difference_path_rows`、`acceptanceDecisionOptions`、`fields[*]` | 输出最终验收记录，并把状态、回滚和证据链落成单一版本 |

### 4.3 固定步骤语义

- `copy-package` 只负责说明模板绑定和模板边界，不能直接产出验收结论
- `onboarding-playbook` 只负责把 `W1` 边界转成执行步骤、冲突规则和检查清单，不能另开第二套模板语义
- `governance-comparison` 只负责证明“实际站点 vs 模板对照站”的差异，不负责替代验收决定
- `acceptance-record-template` 只负责收口正式验收记录，不负责反向修改前面三条链的字段含义

## 5. 接入检查链与验收链串联关系

### 5.1 主链路

| 链路阶段 | 输入字段 | 输出给下一阶段的字段 | 固定要求 |
| --- | --- | --- | --- |
| 模板绑定 | `package_key`、`template_station_id`、`benchmark_station_id` | `templateKey`、`baselineStationCode` | 必须先确定模板键和对照站，后续字段不得自行改写 |
| 检查执行 | `conflict_rules[*]`、`onboarding_checklist[*]`、`completion_policy` | `blockedItems`、`warningItems`、`qualityChecklistSummary` | `blocked` 和 `warning` 必须来自同一条检查链 |
| 治理对比 | `comparison_anchor`、`metric_rows`、`difference_summary_rows`、`issue_backlog_rows`、`difference_path_rows` | `comparisonAnchor`、`actualMetricsSnapshot`、`templateMetricsSnapshot`、`differenceSummary`、`evidenceRef` | 必须能证明对比锚点、报表日期和差异路径一致 |
| 验收冻结 | `acceptanceDecisionOptions`、`fields[*].field_key` | `acceptanceDecision`、`rollbackRequired`、`rollbackScope`、`evidenceRef` | 最终只允许 `Accepted / Refine / Blocked` 三态 |

### 5.2 检查清单与治理对比的回链关系

| 检查项字段 | 来源 | 回链字段 | 说明 |
| --- | --- | --- | --- |
| `identity-station-record` | `onboarding_checklist` | `comparison_anchor.baselineStationCode`、`fields.stationId` | 没有主记录时，不允许进入治理对比和验收冻结 |
| `runtime-team-worker` | `onboarding_checklist` | `issue_backlog_rows`、`difference_path_rows` | 团队和人员缺失必须先在问题回收中定位，再进入验收 |
| `data-import-contract` | `onboarding_checklist` | `difference_summary_rows`、`evidenceRef` | 正式导入链必须有回放证据，不能只靠页面看起来正常 |
| `reporting-daily-quality` | `onboarding_checklist` | `comparison_anchor.reportAnchor`、`metric_rows`、`qualityChecklistSummary` | 报表锚点和质量摘要必须回读同一日期、同一站点 |
| `risk-warning-ack` | `onboarding_checklist` | `warningItems`、`acceptanceDecision` | `warning` 可以进入验收，但必须转成记录字段并有人工作确认 |

## 6. 状态判定关系冻结

### 6.1 运行态字段

流程运行态只允许使用以下两类状态：

- `clear / warning / blocked`
- `Accepted / Refine / Blocked`

前者来自真实接口检查结果，后者只出现在验收记录结论。

### 6.2 `warning / blocked` 与验收结论的关系

| 条件 | 允许的验收结论 | 固定解释 |
| --- | --- | --- |
| 任一 `conflict_rules[*].gate_status = blocked` | `Blocked` | 强制一致项、导入字段映射或主标识冲突被阻断时，不能进入接入完成态 |
| 任一 `onboarding_checklist[*].gate_status = blocked` | `Blocked` | 最小接入单元未齐备时，必须阻断 |
| `difference_summary_rows` 或 `issue_backlog_rows` 仍指向未清零的阻断差异 | `Blocked` | 治理对比仍存在阻断项时，不允许人工跳过 |
| 只有 `warning`，但未完成人工确认或证据不足 | `Refine` | 可以继续整改，但不能直接判为完成 |
| 只有 `warning`，且已完成人工确认、证据链齐备 | `Accepted` | `warning` 允许带入完成态，但必须被正式确认 |
| 全部为 `clear`，且满足 `completion_policy.completion_criteria` | `Accepted` | 进入接入完成态 |

### 6.3 三态结论的固定含义

| 结论 | 含义 | 触发条件 |
| --- | --- | --- |
| `Accepted` | 接入完成，可进入下一阶段运行 | 无 `blocked`；`warning` 已确认；回放、报表、质量、审计链证据齐备 |
| `Refine` | 可继续整改，但当前不能判定接入完成 | 没有 `blocked`，但仍有未确认 `warning`、证据不足或差异未收口 |
| `Blocked` | 当前必须停止验收 | 任何阻断项存在，或回放/报表/质量/审计链有关键缺口 |

冻结结论：

- `warning` 不是验收结论
- `blocked` 既可以是检查态，也可以直接推导出 `Blocked` 验收结论
- `Accepted / Refine / Blocked` 只能在 `acceptance-record-template` 的验收记录中使用

## 7. 回滚字段冻结

### 7.1 固定字段

`acceptance-record-template.fields[*]` 中与回滚直接相关的字段固定为：

- `rollbackRequired`
- `rollbackScope`
- `evidenceRef`

### 7.2 `rollbackRequired`

- 来源：`acceptance-record-template.fields[field_key=rollbackRequired]`
- 填写规则：
  - `Accepted` 且未触发回滚动作时，填写 `false`
  - `Refine` 或 `Blocked` 且需要撤回模板/配置变更时，填写 `true`
- 不能省略

### 7.3 `rollbackScope`

- 来源：
  - `copy-package.rollback_policy.mode`
  - `copy-package.rollback_policy.steps`
  - `onboarding-playbook.replay_acceptance.rollback_scope`
- 固定范围只允许是模板与配置级对象：
  - 站点模板绑定
  - 站点配置覆盖项
  - 班组 / 区域 / 设备映射
  - 报表展示与治理开关

明确排除：

- 已落库的真实业务导入数据
- 审计事件
- 已形成的日报结果
- 任何 `flights / awbs / shipments / tasks / exceptions / documents` 的真实业务回滚

冻结结论：

- `rollbackScope` 只能记录“模板 + 配置级回滚”
- 不允许扩写成真实业务数据回滚

### 7.4 `evidenceRef`

- 来源：`acceptance-record-template.fields[field_key=evidenceRef]`
- 固定用途：引用本次接入结论的证据链
- 建议最小证据集：
  - `comparison_anchor.reportAnchor`
  - `comparison_anchor.reportDate`
  - `difference_summary_rows`
  - `issue_backlog_rows`
  - 样板回放结果
  - 对象审计或验收附件引用

冻结结论：

- 没有 `evidenceRef`，不能直接给出 `Accepted`
- `Refine` 和 `Blocked` 也必须填写 `evidenceRef`，用于后续复核

## 8. 接入检查清单与验收模板的字段对齐

### 8.1 固定对齐关系

| 验收模板字段 | 真实来源 | 固定要求 |
| --- | --- | --- |
| `stationId` / `stationCode` / `stationName` | `station summary` | 必须与当前接入站点一致 |
| `templateKey` | `copy-package.package_key` | 必须直接复用模板包键 |
| `comparisonAnchor` | `governance-comparison.comparison_anchor.reportAnchor` | 必须与治理对比和日报锚点一致 |
| `reportDate` | `governance-comparison.comparison_anchor.reportDate` | 必须与对比日期一致 |
| `baselineStationCode` | `governance-comparison.comparison_anchor.baselineStationCode` | 当前固定为 `RZE` |
| `actualMetricsSnapshot` | `governance-comparison.metric_rows` | 记录当前站点实际指标 |
| `templateMetricsSnapshot` | `governance-comparison.metric_rows` | 记录模板对照站指标 |
| `qualityChecklistSummary` | `onboarding_checklist` | 必须汇总 `clear / warning / blocked` |
| `differenceSummary` | `difference_summary_rows` | 必须只记录最小差异集 |
| `blockedItems` | `conflict_rules` + `onboarding_checklist` | 必须是阻断项清单，不允许留空替代 |
| `warningItems` | `conflict_rules` + `onboarding_checklist` | 必须与人工确认记录关联 |
| `acceptanceDecision` | `acceptanceDecisionOptions` | 只允许 `Accepted / Refine / Blocked` |
| `rollbackRequired` / `rollbackScope` | `rollback_policy` + `replay_acceptance.rollback_scope` | 只允许模板与配置级回滚 |
| `evidenceRef` | 手工归档字段，回链 `comparison` 和回放结果 | 必填 |

### 8.2 固定收口顺序

1. 先收口 `blockedItems`
2. 再确认 `warningItems`
3. 再看 `differenceSummary`
4. 再填写 `rollbackRequired / rollbackScope`
5. 最后填写 `acceptanceDecision` 和 `evidenceRef`

不允许反过来先写结论、再补证据。

## 9. W2 正式验收断言

以下条件同时成立，才算 `W2` 完成：

1. `copy-package`、`onboarding-playbook`、`governance-comparison`、`acceptance-record-template` 四条链使用同一套字段语义
2. `warning / blocked` 的来源和去向是单一版本，不存在第二套判定口径
3. `Accepted / Refine / Blocked` 只作为验收结论使用
4. `rollbackRequired / rollbackScope / evidenceRef` 的填写约束已冻结
5. 回滚口径明确限制在模板与配置级，不触碰真实业务数据
6. 接入检查清单、治理对比、验收模板三者能互相回链

## 10. 交叉引用

- [Sinoport_OS_W1_多站点模板化正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W1_多站点模板化正式冻结文档_v1.0.md)
- [Sinoport_OS_站点接入SOP_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_站点接入SOP_v1.0.md)
- [Sinoport_OS_多站点治理对比与验收记录_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_多站点治理对比与验收记录_v1.0.md)
- [Sinoport_OS_M9_月度验收记录_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_M9_月度验收记录_v1.0.md)

## 11. 遗留风险

- `copy-package.readiness_checks` 当前主要由 `summary.checks` 映射而来，现实现里多为 `clear / warning`；真正的阻断仍主要落在 `conflict_rules` 与 `onboarding_checklist`。
- `acceptance-record-template` 目前提供的是字段模板，不是已写入数据库的正式验收实例，因此 `evidenceRef` 的归档位置仍依赖执行侧规范。
- `governance-comparison` 和 `acceptance-record-template` 以 `reportDate` 为锚点，若后续执行时日期口径漂移，会直接影响 `W2` 验收链的一致性。
