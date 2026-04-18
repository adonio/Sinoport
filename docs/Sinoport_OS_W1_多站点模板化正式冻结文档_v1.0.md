# Sinoport OS W1 多站点模板化正式冻结文档 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-17`
- 关联阶段：`P2 / W1`
- 适用范围：多站点模板包边界冻结；不包含 `W2` 接入执行流程细化

## 2. 文档目标

把多站点模板化在 `W1` 的冻结范围一次性写清楚，后续 `W2` 只能在本口径上补执行链，不再重新定义模板边界。

本文件固定回答 8 件事：

1. 模板包边界
2. 字段矩阵
3. 强制一致项
4. 站点可覆盖项
5. 最小接入单元
6. 与接入验收链的接口关系
7. 冲突规则最小集
8. 回滚边界与验收断言

## 3. 固定前提

### 3.1 样板站与对照站

- 主样板站固定为：`MME`
- 模板对照站固定为：`RZE`
- `RZE` 只用于模板对比，不进入真实接入完成结论
- 平台治理与验收文档中的最小对比集固定为：`MME + RZE`

### 3.2 真实接口

本文件只引用当前仓库里已经存在的真实接口和字段：

- `GET /api/v1/platform/station-governance/stations/:stationId/copy-package`
- `GET /api/v1/platform/station-governance/stations/:stationId/onboarding-playbook`
- `GET /api/v1/platform/station-governance/stations/:stationId/governance-comparison`
- `GET /api/v1/platform/station-governance/stations/:stationId/acceptance-record-template`

字段来源对应实现：

- `apps/api-worker/src/lib/station-governance.ts`
- `apps/api-worker/src/routes/station.ts`
- `admin-console/src/api/platform.js`
- `admin-console/src/pages/platform/report-stations.jsx`

### 3.3 本文不覆盖

- 第二真实站点上线
- `W2` 的步骤编排、责任链、执行节奏
- 新模板种类
- 新报表或新治理页面

## 4. 模板包边界冻结

### 4.1 模板包内对象

`W1` 冻结后，模板包只允许承载以下 4 类模板真相：

1. `control_level` 模板
2. `phase` 模板
3. `resource_template` 模板
4. `capability_template` 模板

这些对象都来自 `station_governance_templates`，并通过 `copy-package` 聚合成单一模板包视图。

### 4.2 模板包外对象

以下对象禁止进入模板包业务真相：

1. 已落库的真实业务对象
   - `flights`
   - `awbs`
   - `shipments`
   - `tasks`
   - `exceptions`
   - `documents`
2. 审计与导入历史
   - `audit_events`
   - `state_transitions`
   - `import_requests`
3. 已生成的运营结果
   - 平台日报结果
   - 站点日报结果
   - 已形成的质量结果快照

说明：

- 模板包只定义“结构和最小治理口径”，不携带真实业务运行结果。
- 真实业务数据只能通过导入、作业、审计和报表链路独立产生。

## 5. 接口关系冻结

`W1` 只冻结接口关系，不展开 `W2` 执行步骤。

| 接口 | 在 `W1` 的定位 | 关键字段 |
| --- | --- | --- |
| `copy-package` | 模板包主定义 | `package_key`、`template_station_id`、`benchmark_station_id`、`minimum_onboarding_unit`、`mandatory_consistency_items`、`station_override_items`、`readiness_checks`、`rollback_policy` |
| `onboarding-playbook` | 接入链的边界承接接口 | `conflict_rules`、`onboarding_checklist`、`replay_acceptance`、`completion_policy` |
| `governance-comparison` | 模板对比与差异定位接口 | `comparison_anchor`、`metric_rows`、`difference_summary_rows`、`issue_backlog_rows`、`difference_path_rows` |
| `acceptance-record-template` | 验收记录字段模板 | `acceptanceDecisionOptions`、`fields[*].field_key`、`fields[*].source` |

冻结关系如下：

1. `copy-package` 是模板边界的唯一上游定义。
2. `onboarding-playbook` 只能解释 `copy-package`，不能新增第二套模板边界。
3. `governance-comparison` 只能比较模板口径与实际读模型差异，不能反向改写模板边界。
4. `acceptance-record-template` 只能复用前三者已冻结的字段语义。

## 6. 字段矩阵

### 6.1 模板包主标识字段

| 字段 | 来源接口 | 含义 | 冻结规则 |
| --- | --- | --- | --- |
| `package_key` | `copy-package` | 模板包唯一键，格式为 `station-copy-package-${station_id}` | 必须稳定；后续验收记录中的 `templateKey` 必须来自这里 |
| `station_id` | `copy-package` | 当前被评估站点 | 允许变化，但不改变模板语义 |
| `station_name` | `copy-package` | 当前被评估站点名称 | 允许变化，但不改变模板语义 |
| `template_station_id` | `copy-package` | 样板模板来源站 | `W1` 固定为 `MME` |
| `template_station_name` | `copy-package` | 样板模板来源站名称 | `W1` 固定为 `MME 样板站` 语义 |
| `benchmark_station_id` | `copy-package` | 模板对照站 | `W1` 固定按对比口径使用 `RZE`；仅在查询 `RZE` 自身时实现层允许回退为 `MME` 以避免自比 |
| `benchmark_station_name` | `copy-package` | 模板对照站名称 | `W1` 固定为模板对照语义，不得写成真实试运行站 |

### 6.2 最小接入单元字段

`copy-package.minimum_onboarding_unit[*]` 只允许出现以下 `unit_key`：

| `unit_key` | `label` | `required` | 冻结解释 |
| --- | --- | --- | --- |
| `station_record` | `站点主记录` | `true` | 必须存在 `stations` 主记录 |
| `control_level_and_phase` | `控制层级与阶段` | `true` | 必须能匹配治理模板与阶段模板 |
| `resource_and_capability_templates` | `资源模板与能力模板` | `true` | 必须已挂接默认资源模板与能力模板 |
| `team_and_worker_master_data` | `团队与人员主数据` | `true` | 必须具备团队和人员最小主数据 |
| `daily_report_and_quality_gate` | `日报锚点与质量门槛` | `true` | 必须能回读 `reportAnchor` 和质量门槛结果 |

冻结结论：

- `W1` 不允许再新增第 6 个最小接入单元。
- `W1` 不允许把真实业务对象塞进 `minimum_onboarding_unit`。

### 6.3 强制一致项字段

`copy-package.mandatory_consistency_items[*]` 是模板包强制一致项的唯一来源。

| `item_key` | `label` | `source` | 冻结规则 |
| --- | --- | --- | --- |
| `control_level_template` | `控制层级模板` | `station_governance_templates` | 强制一致，不允许站点覆盖模板语义 |
| `phase_template` | `阶段模板` | `station_governance_templates` | 强制一致，不允许站点自行扩写阶段语义 |
| `resource_template` | `默认资源模板` | `station_governance_templates` | 强制一致，结构不能因站点不同而拆散 |
| `capability_template` | `默认能力模板` | `station_governance_templates` | 强制一致，能力结构必须统一 |
| `report_and_quality_contract` | `日报与质量契约` | `daily reports + quality checklist` | 强制一致，至少包含 `reportAnchor`、质量摘要、检查清单、刷新与追溯语义 |
| `audit_and_import_contract` | `导入与审计契约` | `import_requests + audit_events` | 强制一致，导入账本、幂等键、审计链不能按站点各搞一套 |

### 6.4 站点可覆盖项字段

`copy-package.station_override_items[*]` 是站点覆盖边界的唯一来源。

| `item_key` | `label` | `source` | 可覆盖边界 |
| --- | --- | --- | --- |
| `station_identity` | `站点名称与区域` | `stations` | 仅允许覆盖站点识别属性，不允许改模板语义 |
| `team_assignment` | `团队编制与班次分配` | `teams/workers` | 允许覆盖人数、排班和值班人；不允许覆盖角色结构最低要求 |
| `device_and_vehicle_inventory` | `设备与车辆清单` | `resources + vehicles` | 允许覆盖库存、编号和清单；不允许删掉模板要求的最小执行能力 |
| `local_sla_threshold` | `本地 SLA 阈值` | `station reports / local ops policy` | 允许覆盖阈值数值；不允许改指标定义和计算口径 |

### 6.5 接入验收链关联字段

以下字段虽然不属于模板包本体，但在 `W1` 必须冻结它们与模板包的引用关系：

| 字段 | 来源接口 | 与模板包的关系 |
| --- | --- | --- |
| `comparison_anchor.reportAnchor` | `governance-comparison` | 必须能证明模板对比使用同一报表锚点 |
| `comparison_anchor.reportDate` | `governance-comparison` | 必须与验收记录日期对齐 |
| `difference_summary_rows[*].gate_status` | `governance-comparison` | 只能消费 `warning / blocked` 的治理差异语义 |
| `issue_backlog_rows[*].severity` | `governance-comparison` | 必须与接入检查门槛兼容 |
| `fields[*].field_key` | `acceptance-record-template` | 必须引用已冻结字段，不允许新增脱离模板包来源的业务字段 |
| `acceptanceDecisionOptions` | `acceptance-record-template` | 固定为 `Accepted / Refine / Blocked` |

## 7. 强制一致项与站点可覆盖项的判定规则

### 7.1 强制一致项

以下情况一律按强制一致项处理：

1. 会改变模板匹配逻辑
2. 会改变日报、质量、审计、导入口径
3. 会让治理对比失去统一锚点
4. 会让不同站点出现不同的能力结构定义

满足以上任一条件，就不能进入站点可覆盖项。

### 7.2 站点可覆盖项

只有同时满足以下条件，才允许进入站点可覆盖项：

1. 变化只影响站点本地库存、命名、配置数值
2. 不改变指标定义
3. 不改变模板结构
4. 不改变审计与导入契约
5. 仍满足模板要求的最小执行能力

## 8. Warning 与 Blocked 边界

`W1` 只冻结语义边界，不展开 `W2` 处理流程。

### 8.1 `warning`

满足以下特征时归入 `warning`：

1. 不破坏强制一致项
2. 不阻断最小接入单元成立
3. 可以先记录差异，再进入验收人工确认

当前仓库内已存在的 `warning` 类边界包括：

- `override-configuration-drift`
- `report-contract-drift`
- `resource-mapping-conflict`
- `reporting-daily-quality` 中的提示级差异
- `risk-warning-ack`

冻结结论：

- `warning` 可以存在于接入完成态之前
- 但必须进入验收记录的 `warningItems`
- 且必须有人工作确认

### 8.2 `blocked`

满足以下任一特征时归入 `blocked`：

1. 破坏强制一致项
2. 破坏最小接入单元
3. 导致模板回放、治理对比或正式导入链无法成立
4. 导致质量门槛无法进入可验收状态

当前仓库内已存在的 `blocked` 类边界包括：

- `mandatory-station-identity`
- `import-field-mapping-conflict`
- `identity-station-record`
- `runtime-team-worker`
- 任何落入 `blocked` 的质量门槛或差异项

冻结结论：

- 只要存在未清零的 `blocked`，就不能进入接入完成态
- `blocked` 不能被人工确认替代
- `blocked` 只能通过修正模板绑定、主数据、导入映射或治理配置来解除

## 9. 冲突规则最小集

`W1` 只冻结最小冲突规则集，后续不得另开第二套枚举。

| `rule_key` | `category` | `gate_status` | 冻结解释 |
| --- | --- | --- | --- |
| `mandatory-station-identity` | `mandatory_consistency` | `blocked` | 站点主标识、控制层级、关键审计开关、阻断门槛与模板冲突时，直接阻断 |
| `override-configuration-drift` | `station_override` | `warning` | 班组映射、可见角色、提示级配置等站点覆盖差异，允许保留但必须记账 |
| `report-contract-drift` | `data_contract` | `warning` | 日报与质量表字段存在但局部呈现不一致，先按模板口径纠偏 |
| `resource-mapping-conflict` | `resource_mapping` | `warning` | 资源重复绑定可暂存，但不能在未确认情况下宣告完成 |
| `import-field-mapping-conflict` | `import_mapping` | `blocked` | 正式导入字段映射与样板模板冲突时，不得继续 |

## 10. 回滚边界冻结

### 10.1 允许回滚的对象

允许进入模板化回滚边界的对象，只能是“模板 + 配置级”对象：

1. 站点模板绑定
2. 站点配置覆盖项
3. 班组 / 区域 / 设备映射
4. 报表展示与治理开关

### 10.2 禁止回滚的对象

以下对象明确不在 `W1` 回滚边界内：

1. 已落库的真实业务导入数据
2. 审计事件
3. 已形成的日报结果

### 10.3 回滚模式

`copy-package.rollback_policy.mode` 固定为：

- `template-and-configuration`

`copy-package.rollback_policy.steps` 固定语义为：

1. 先冻结模板变更窗口
2. 记录 `package_key`、`station_id` 和接入批次
3. 先撤销模板绑定和接入检查结果
4. 再恢复上一稳定模板快照
5. 恢复后重做治理检查、日报质量检查和导入回放

## 11. 验收断言

`W1` 完成必须同时满足以下断言：

1. `copy-package` 返回的 `template_station_id` 固定指向 `MME`
2. 文档和页面都明确 `RZE` 只是模板对照站，不是第二真实站点
3. `minimum_onboarding_unit[*].unit_key` 只包含当前冻结的 5 项
4. `mandatory_consistency_items[*].item_key` 与本文强制一致项完全一致
5. `station_override_items[*].item_key` 与本文可覆盖项完全一致
6. `acceptance-record-template.fields[*].source` 只能引用 `station summary`、`copy package`、`governance comparison`、`onboarding playbook`、`manual`
7. `warning` 与 `blocked` 的边界不能再由页面或执行文案自由解释
8. 回滚边界必须保持 `template-and-configuration`，不得扩大到真实业务数据

## 12. 交叉引用

- 模板包摘要文档：
  [Sinoport_OS_多站点复制模板包_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_多站点复制模板包_v1.0.md)
- 接入 SOP：
  [Sinoport_OS_站点接入SOP_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_站点接入SOP_v1.0.md)
- 治理对比与验收记录：
  [Sinoport_OS_多站点治理对比与验收记录_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_多站点治理对比与验收记录_v1.0.md)
- 主任务卡总表：
  [Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md)

## 13. 遗留风险

1. `benchmark_station_id` 在查询 `RZE` 自身时，代码层为了避免自比会回退为 `MME`；文档口径仍应坚持“`MME` 是样板站，`RZE` 是模板对照站”。
2. `readiness_checks` 当前由 `summary.checks` 生成，未区分独立 `blocked`；真正的 `blocked` 语义仍主要来自 `onboarding-playbook` 和验收链。
3. 当前页面 `platform/report-stations` 仍写死 `stationId = 'MME'`，这不影响 `W1` 冻结口径，但说明多站点页面切换仍是后续事项。
