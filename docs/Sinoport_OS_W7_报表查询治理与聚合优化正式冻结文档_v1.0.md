# Sinoport OS W7 报表查询治理与聚合优化正式冻结文档 v1.0

## 1. 文档信息与范围

- 任务编号：W7
- 任务主题：报表查询治理与聚合优化
- 冻结状态：正式冻结
- 适用范围：站点日报、平台日报、数据质量日报/闸口检查表
- 冻结目标：基于当前代码事实，固定日报与质量聚合的查询热点、聚合边界、字段契约、性能目标与验收证据口径
- 事实源：
  - `apps/api-worker/src/routes/station.ts` 中的 `loadStationDailyReportSource`、`loadPlatformDailyReportSource` 及其下游日报聚合 helper，见 [station.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/routes/station.ts:8778) [station.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/routes/station.ts:8943)
  - `apps/api-worker/src/lib/data-quality.ts` 中的数据质量规则、问题写入、站点/平台质量概览，见 [data-quality.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/lib/data-quality.ts:110) [data-quality.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/lib/data-quality.ts:297)
  - 主任务卡 W7 小节，见 [主任务卡](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md:152)

## 2. 当前热点清单

W7 当前最热的查询路径不是单表明细，而是“按日期取数后在内存做多次聚合”的日报源。站点日报与平台日报都以 `tasks`、`exceptions`、`documents`、`loading_plans`、`audit_events` 为主，质量链路再叠加 `data_quality_issues` 的读写。

- `tasks`
  - 站点日报与平台日报都在日报源中按 `station_id` 和日期过滤任务，再由多个 helper 重复计算完成率、阻断数、超时数、PDA 指标、班组维度指标。
  - 风险点：`DATE(COALESCE(t.completed_at, t.verified_at, t.updated_at, t.created_at)) = ?` 会把“派生日期”放进热路径，通常会削弱常规索引命中，容易退化为扫描后再过滤。
- `exceptions`
  - 站点日报与平台日报都按 `DATE(COALESCE(closed_at, updated_at, opened_at, created_at)) = ?` 取异常，再在多个 helper 中重复计算开放/阻断/已关闭、平均闭环时长、严重度分布。
  - 风险点同上：COALESCE + DATE 组合使过滤条件不可直接对单列时间戳建模，热路径容易放大。
- `documents`
  - 站点日报与平台日报都按 `DATE(COALESCE(updated_at, uploaded_at, created_at)) = ?` 取文档，再重复计算关键文件缺失、POD 闭环、版本替换、最近更新时间。
  - 风险点：同一份文档在日报中被多个聚合函数反复消费，若不统一边界，会重复排序和重复分组。
- `loading_plans`
  - 仅站点日报源直接读取，但它参与 `PDA` 指标和日报总览中的到场/装车时长计算。
  - 风险点：`DATE(COALESCE(updated_at, depart_time, arrival_time, created_at)) = ?` 同样是派生日期过滤。
- `audit_events`
  - 站点日报与平台日报都按 `DATE(created_at) = ?` 读取审计事件，并在文件回看、traceability、质量追责中被重复消费。
  - 风险点：审计事件是高频横切表，若缺少时间维度索引或时间边界约束，容易成为平台日报的共性放大器。
- `data_quality_issues`
  - `loadStationDataQualityIssues` 与 `loadPlatformDataQualityOverview` 都直接读 `data_quality_issues`，站点侧还会按 `severity/status` 追加二次过滤。
  - 风险点：质量概览与质量检查表依赖同一批开放问题，多处重复扫描会放大读取成本。

## 3. 当前平台日报与站点日报的聚合重复点

当前实现里，平台日报与站点日报存在明显的“同构聚合”：

- 两个日报源都分别读取 `tasks / exceptions / documents / audit_events`，只是平台侧额外读取 `stations`，站点侧额外读取 `loading_plans`。
- 两个日报都围绕相同的状态语义做统计：完成、阻断、开放、已关闭、关键文档缺失、严重度分布、质量闸口。
- 两个日报都把原始源数据再交给多个下游 helper 反复聚合，导致同一批 rows 在不同卡片、不同表格、不同 summary 中被多次遍历。
- 两个日报都在 traceability 中固定使用相同的来源描述：`qualitySummary / qualityChecklist`、`Flight / AWB / Shipment / Exception`、`audit/object / audit/events`。

可见的重复 helper 主要集中在：

- `buildStationReportCards`
- `buildStationReportShiftRows`
- `buildStationReportPdaRows`
- `buildStationReportFileRows`
- `buildStationDailyTaskRows`
- `buildStationDailyBlockerRows`
- `buildStationDailyRows`
- `buildPlatformDailyRows`
- `buildPlatformDocumentSummaryRows`
- `buildPlatformDailyStationRows`
- `buildPlatformStationComparisonRows`
- `loadStationDataQualityOverview`
- `loadPlatformDataQualityOverview`
- `buildStationQualityChecklist`
- `buildPlatformQualityChecklist`

## 4. 建议冻结的查询与聚合边界

以下边界建议在 W7 冻结，不再继续漂移。

- 查询源边界
  - `loadStationDailyReportSource` 应作为站点日报唯一源读取入口。
  - `loadPlatformDailyReportSource` 应作为平台日报唯一源读取入口。
  - `loadStationDataQualityIssues`、`loadStationDataQualityOverview`、`loadPlatformDataQualityOverview` 应作为质量链路唯一读入口。
- 聚合边界
  - `buildStationReportCards`、`buildStationReportShiftRows`、`buildStationReportPdaRows`、`buildStationReportFileRows`、`buildStationDailyTaskRows`、`buildStationDailyBlockerRows`、`buildStationDailyRows` 只负责“消费已归一化 rows 后的报表聚合”，不再回表。
  - `buildPlatformDailyRows`、`buildPlatformDocumentSummaryRows`、`buildPlatformDailyStationRows`、`buildPlatformStationComparisonRows` 只负责平台层展示聚合，不再改变上游源字段。
  - `buildStationQualityChecklist`、`buildPlatformQualityChecklist` 只负责质量检查表的语义汇总，不应内嵌额外的表扫描。
- 必须冻结的 DTO / 字段契约
  - `task`：`taskId`、`taskType`、`executionNode`、`relatedObjectType`、`relatedObjectId`、`teamId`、`teamName`、`shiftLabel`、`taskStatus`、`blockerCode`、`evidenceRequired`、`createdAt`、`completedAt`、`updatedAt`、`dueAt`
  - `exception`：`exceptionId`、`relatedObjectType`、`relatedObjectId`、`linkedTaskId`、`severity`、`ownerTeamId`、`exceptionStatus`、`blockerFlag`、`rootCause`、`actionTaken`、`openedAt`、`closedAt`
  - `document`：`documentId`、`documentType`、`documentName`、`relatedObjectType`、`relatedObjectId`、`parentDocumentId`、`versionNo`、`documentStatus`、`requiredForRelease`、`uploadedAt`、`updatedAt`、`note`
  - `loadingPlan`：`transferId`、`flightNo`、`truckPlate`、`driverName`、`collectionNote`、`status`、`createdAt`、`updatedAt`、`arrivalTime`、`departTime`
  - `audit`：`action`、`objectType`、`objectId`、`summary`、`createdAt`
  - `data_quality_issue`：`issue_id`、`station_id`、`issue_date`、`object_type`、`object_id`、`rule_id`、`issue_code`、`severity`、`status`、`blocking_flag`、`source_type`、`source_key`、`import_request_id`、`summary`、`details_json`、`suggested_action`、`audit_object_type`、`audit_object_id`、`detected_at`、`resolved_at`
  - `quality overview / checklist`：`total_issues`、`open_issues`、`blocking_issues`、`quality_score`、`by_severity`、`by_source` / `by_station`、`gate_status`、`blocking_candidate_rules` / `blocking_candidate_stations`、`operational_actions`、`quality_checklist.checklist_rows`

## 5. 建议冻结的索引、视图或预聚合边界

以下仅为建议边界，不是实现：

- `tasks`
  - 建议优先围绕“站点 + 真实业务时间边界”建立可命中的访问路径，避免让 `DATE(COALESCE(...))` 成为主过滤条件。
  - 可考虑把日报用的日期边界前移到可索引的时间列或生成列，再由日报源按边界读取。
- `exceptions`
  - 建议围绕 `station_id + 状态时间` 固化访问路径，平台/站点日报共享同一读法。
- `documents`
  - 建议把“关键放行文件 + 更新时间”作为稳定视图边界，供日报中的缺失/版本替换/最新更新时间复用。
- `loading_plans`
  - 建议围绕 `station_id + 到场/离场/更新时刻` 固化访问路径，避免日报中重复做日期派生。
- `audit_events`
  - 建议围绕 `station_id + created_at` 固化时间范围访问路径，支持日报和追责链路共用。
- `data_quality_issues`
  - 建议围绕 `station_id + issue_date (+ severity/status)` 冻结查询边界，便于日报概览、站点详情和平台概览共用。
- 视图 / 预聚合
  - 可考虑冻结日报专用只读视图或预聚合层，让 `tasks / exceptions / documents / loading_plans / audit_events / data_quality_issues` 的“日期归集”只发生一次。
  - 预聚合边界应固定为“按 station + reportDate 归集”，不要把业务口径继续拆到 W8 之后。

## 6. 性能验收目标

- 主目标：维持 W7 主任务卡中的目标，即核心报表接口在当前样本规模下稳定低于 3 秒。
- 验收证据要求：
  - 至少提供变更前与变更后的 explain / baseline 对比。
  - 对站点日报、平台日报、质量概览三类接口分别记录 SQL、`EXPLAIN QUERY PLAN`、返回行数、耗时、样本日期、样本站点。
  - 证据必须能证明“减少扫描/减少重复聚合”，而不是只证明单次结果偶然更快。
  - 若样本较小，应明确说明样本规模与测试条件，防止误判。

## 7. 非目标

- 本周不改业务口径。
- 本周不引入缓存。
- 本周不改页面展示结构。
- 本周不扩展到 W8 的缓存边界、UI 回归或其他后续任务。
- 本周不在文档之外实施代码改造。

## 8. 风险与回滚

- 风险 1：若后续实施时调整查询边界但未同步字段契约，日报卡片和详情页可能出现字段漂移或空值回退。
- 风险 2：如果只优化单个样本日期，可能掩盖 `DATE(COALESCE(...))` 带来的真实扫表退化。
- 风险 3：如果平台与站点日报继续各自扩写 helper，重复聚合会重新出现。
- 回滚原则：
  - 任何后续实施都应保留现有日报源与 DTO 的兼容读法。
  - 若性能优化引入异常，优先回退到当前已冻结的聚合边界，而不是继续扩写口径。

## 9. 对 W8 的明确移交输入

W8 只接收以下输入，不重新定义 W7 的查询口径：

- 已冻结的日报源边界：`loadStationDailyReportSource`、`loadPlatformDailyReportSource`
- 已冻结的质量源边界：`loadStationDataQualityIssues`、`loadStationDataQualityOverview`、`loadPlatformDataQualityOverview`
- 已冻结的字段契约：`task / exception / document / loadingPlan / audit / data_quality_issue / quality overview`
- 已冻结的性能证据：explain / baseline 对比、耗时、行数、样本条件
- 已冻结的索引/视图建议清单
- 禁止事项：W8 不得反向修改 W7 的业务口径或聚合边界

