# Sinoport OS W8 报表缓存边界与回归口径正式冻结文档 v1.0

## 1. 文档信息与范围

- 任务编号：W8
- 任务主题：报表缓存边界、回归断言、口径冻结
- 冻结状态：正式冻结
- 适用范围：站点日报、平台日报、站点对比报表、异常日报、班次报表
- 冻结目标：基于当前代码与脚本事实，冻结报表缓存边界、指标命名、回归断言口径和性能基线证据要求
- 事实源：
  - [station.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/routes/station.ts:9164) 的 `loadStationReportsDaily`、[station.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/routes/station.ts:9444) 的 `loadPlatformReportsDaily`，以及 [station.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/routes/station.ts:9860) 的站点对比链路
  - [station.js](/Users/lijun/Downloads/Sinoport/admin-console/src/api/station.js:1437) 的站点报表字段消费
  - [platform.js](/Users/lijun/Downloads/Sinoport/admin-console/src/api/platform.js:745) 的平台报表与对比字段消费
  - [test-api-integration.mjs](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs:216) 的日报接口断言
  - [test-frontend-smoke.mjs](/Users/lijun/Downloads/Sinoport/scripts/test-frontend-smoke.mjs:14) 的报表页 smoke 覆盖
  - [W7 冻结文档](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W7_报表查询治理与聚合优化正式冻结文档_v1.0.md:1)
  - [主任务卡 W8](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md:162)

说明：本文中的“缓存边界”是冻结建议和验收口径，不是宣称当前仓库已经存在生产缓存层。

## 2. 当前已稳定的日报输出契约

### 2.1 `reportMeta` 冻结字段

当前后端日报返回和前端消费都稳定依赖以下元信息字段：

- `reportMeta.reportType`
- `reportMeta.stationId`
- `reportMeta.reportDate`
- `reportMeta.reportAnchor`
- `reportMeta.generatedAt`
- `reportMeta.timeZone`

冻结规则：

- `reportType` 必须保持为稳定的类型标识，不允许用页面文案替代。
- `reportDate` 是日报的业务日期主轴。
- `reportAnchor` 是由 `reportDate` 派生的日终锚点，当前代码通过 `buildDailyReportAnchor(reportDate)` 生成，必须保持为稳定展示字段。
- `generatedAt` 只表示本次生成时刻，不参与缓存 key，也不作为回归比对的主键。
- `timeZone` 当前固定为 `UTC`，前端直接展示，不得在同一报表链路中出现多种时区口径。

### 2.2 站点日报稳定输出

`loadStationReportsDaily` 当前返回的稳定字段包括：

- 顶层字段：
  - `reportMeta`
  - `stationId`
  - `reportDate`
  - `generatedAt`
  - `stationReportCards`
  - `shiftReportRows`
  - `pdaKpiRows`
  - `stationFileReportRows`
  - `stationDailyReportRows`
  - `anomalyDistributionRows`
  - `blockerSummaryRows`
  - `taskSummaryRows`
  - `documentSummaryRows`
  - `qualitySummaryRows`
  - `qualityChecklistRows`
  - `refreshPolicyRows`
  - `traceabilityRows`
  - `dailyReport`
- `dailyReport` 内部字段：
  - `overviewCards`
  - `keyMetrics`
  - `anomalyDistribution`
  - `blockerSummary`
  - `documentSummary`
  - `taskSummary`
  - `refreshPolicy`
  - `traceability`
  - `qualitySummary`
  - `qualityChecklist`
  - `timestamp`

当前前端站点报表页明确消费：

- `reportMeta`
- `stationReportCards`
- `shiftReportRows`
- `pdaKpiRows`
- `stationFileReportRows`
- `outboundActionRows`
- `stationDailyReportRows`
- `qualitySummaryRows`
- `qualityChecklistRows`
- `refreshPolicyRows`
- `traceabilityRows`
- `dailyKeyMetrics`

其中 `shiftReportRows` 当前仍由班次报表页单独消费，页面路径为 `/station/reports/shift`；站点报表总览页也继续读取同一组行数据。

### 2.3 平台日报稳定输出

`loadPlatformReportsDaily` 当前返回的稳定字段包括：

- 顶层字段：
  - `reportMeta`
  - `stationId`
  - `reportDate`
  - `generatedAt`
  - `platformReportCards`
  - `platformStationReportRows`
  - `platformDailyReportRows`
  - `platformStationHealthRows`
  - `platformStationComparisonRows`
  - `anomalyDistributionRows`
  - `blockerSummaryRows`
  - `taskSummaryRows`
  - `documentSummaryRows`
  - `qualitySummaryRows`
  - `qualityChecklistRows`
  - `refreshPolicyRows`
  - `traceabilityRows`
  - `dailyReport`
- `dailyReport` 内部字段：
  - `overviewCards`
  - `keyMetrics`
  - `anomalyDistribution`
  - `blockerSummary`
  - `documentSummary`
  - `taskSummary`
  - `refreshPolicy`
  - `traceability`
  - `qualitySummary`
  - `qualityChecklist`
  - `timestamp`

当前前端平台报表页明确消费：

- `reportMeta`
- `platformReportCards`
- `platformStationReportRows`
- `platformStationComparisonRows`
- `platformDailyReportRows`
- `qualitySummaryRows`
- `qualityChecklistRows`
- `refreshPolicyRows`
- `traceabilityRows`
- `dailyKeyMetrics`

### 2.4 站点对比链路稳定输出

`loadStationGovernanceComparison` 当前返回的稳定字段包括：

- `comparison_anchor`
- `comparison_rows`
- `metric_rows`
- `difference_summary_rows`
- `issue_backlog_rows`
- `difference_path_rows`

前端站点对比页当前消费：

- `comparisonAnchor`
- `comparisonRows`
- `metricRows`
- `differenceSummaryRows`
- `issueBacklogRows`
- `differencePathRows`
- `acceptanceTemplateFields`

`comparison_rows` 当前由平台日报派生，前端同时展示真实日报行与模板对照行，且固定使用 `MME` 与 `RZE` 的最小对比集作为页面默认样例。

### 2.5 当前关键行集的稳定形状

- `qualitySummaryRows` 与 `qualityChecklistRows` 统一采用 `section / metric / current / note` 形状。
- `refreshPolicyRows` 统一采用 `section / metric / current / note` 形状，且当前至少包含日终锚点、默认刷新模式、补算范围三行。
- `traceabilityRows` 统一采用 `section / metric / current / note` 形状，且当前至少包含质量回链、对象回链、审计回链三行。
- `platformStationComparisonRows` 的行对象稳定包含 `code`、`station`、`control`、`inboundSla`、`podClosure`、`exceptionAging`、`readiness`、`blockingReason`、`comparisonType`、`reportAnchor`、`qualityGate`、`comparisonNote`。
- `shiftReportRows` 的行对象稳定包含 `shift`、`team`、`completed`、`loadingAccuracy`、`podClosure`、`exceptionAge`。

## 3. 建议冻结的缓存边界

### 3.1 主键维度

建议把报表缓存主键冻结为：

- `reportDate`
- `stationId`
- `reportType`

冻结原则：

- `reportDate` 作为时间主轴。
- `stationId` 作为站点或站点视角维度。
- `reportType` 作为语义隔离维度，防止站点日报、平台日报、对比报表、异常日报互相串键。
- `generatedAt` 不参与缓存 key。
- `reportAnchor` 不参与缓存 key，它只是 `reportDate` 的展示锚点。

### 3.2 站点级、平台级、对比级区分

- 站点级：用于 `station_daily`、`station_exceptions_daily` 一类报表。`stationId` 必须是明确站点编码，不能省略。
- 平台级：用于 `platform_daily`。若接口带 `station_id` 过滤，`stationId` 也必须纳入 key；若为平台全局视角，则 `stationId` 维度仍要保留，但取空值也不能直接删除该维度。
- 对比级：用于站点对比报表等 comparison 结果。它不应直接复用站点日报 key；若未来落缓存层，必须使用与日报不同的 `reportType`，避免把 comparison 结果与 daily 结果串读。

### 3.3 生成时刻与缓存失效

- `generatedAt` 只用于展示与审计，不参与缓存 key。
- 若未来引入缓存层，失效逻辑应以 `reportDate + stationId + reportType` 为基准，而不是以生成时刻驱动。
- 当前仓库没有生产缓存实现的证据，因此这里冻结的是验收建议，不是现状声明。

## 4. 建议冻结的指标命名与空态口径

### 4.1 指标命名

建议固定下列命名，不再引入同义词：

- `reportMeta.reportType`
- `reportMeta.reportDate`
- `reportMeta.reportAnchor`
- `reportMeta.generatedAt`
- `reportMeta.timeZone`
- `stationReportCards`
- `shiftReportRows`
- `pdaKpiRows`
- `stationFileReportRows`
- `stationDailyReportRows`
- `platformReportCards`
- `platformStationReportRows`
- `platformDailyReportRows`
- `platformStationComparisonRows`
- `qualitySummaryRows`
- `qualityChecklistRows`
- `refreshPolicyRows`
- `traceabilityRows`
- `comparison_rows`
- `metric_rows`
- `difference_summary_rows`
- `issue_backlog_rows`
- `difference_path_rows`

### 4.2 空态口径

- `reportMeta` 里的字符串空态统一展示为 `--`。
- 前端表格中的未命中字段继续使用 `--`，不要改成空串、`N/A` 或 `null`。
- 行数组若无数据，默认展示空数组；不要把数组空态改成单行空占位。
- 例外：
  - `shiftReportRows` 当前存在固定默认样例行，空数据时不会退化成空数组。
  - `pdaKpiRows` 当前存在固定默认样例行，空数据时不会退化成空数组。
  - `stationFileReportRows` 当前存在固定默认样例行，空数据时不会退化成空数组。
  - `shiftReportRows` 的缺失指标值当前使用 `N/A`。
  - `platformStationComparisonRows` / `comparison_rows` 的对比页空值当前使用 `--`。

### 4.3 空态一致性要求

- 任何新指标都必须先定义空态，再允许进入 UI。
- 不得在日报、对比报表和 smoke 用例中同时出现多种空态表达。
- 若某行集天然会生成默认样例行，回归时应断言“默认样例内容稳定”，而不是断言“必须为空数组”。

## 5. 建议冻结的回归断言

### 5.1 API integration 应断字段

当前 `scripts/test-api-integration.mjs` 已覆盖的最低断言集合应保持稳定：

- `GET /api/v1/station/reports/daily?date=...`
  - `reportMeta.reportDate`
  - `reportMeta.reportAnchor`
  - `stationReportCards`
  - `stationDailyReportRows`
  - `refreshPolicyRows`
  - `traceabilityRows`
- `GET /api/v1/station/reports/overview`
  - `outboundActionRows`
  - 至少包含 `flightNo === 'SE913'` 的行
- `GET /api/v1/platform/reports/daily?date=...&station_id=...`
  - `reportMeta.reportDate`
  - `reportMeta.reportAnchor`
  - `platformReportCards`
  - `platformDailyReportRows`
  - `platformStationComparisonRows`
  - `platformStationComparisonRows` 中至少包含 `code === 'MME' && comparisonType === 'actual'`
  - `refreshPolicyRows`
  - `traceabilityRows`
- `GET /api/v1/station/exceptions/daily?date=...`
  - `reportMeta.reportDate`
  - `reportMeta.reportAnchor`
  - `exceptionOverviewCards`
  - `exceptionDailyReportRows`
  - `refreshPolicyRows`
  - `traceabilityRows`

建议补充但仍保持同一口径的断言：

- `reportMeta.reportType`
- `reportMeta.timeZone`
- `reportMeta.generatedAt` 存在但不参与等值比较
- `qualitySummaryRows`
- `qualityChecklistRows`
- `pdaKpiRows`
- `stationFileReportRows`
- `dailyReport.keyMetrics`

### 5.2 前端 smoke 应覆盖的页面与文本锚点

当前 `scripts/test-frontend-smoke.mjs` 已覆盖的报表相关页面与锚点应固定如下：

- `/station/reports` -> `货站层 KPI / 报表`
- `/station/reports/shift` -> `班次粒度报表`
- `/platform/reports/stations` -> `站点对比报表`
- `/platform/reports` -> `平台级报表`

建议保持这些锚点不漂移，因为它们是报表页面最直接的可见回归信号。

### 5.3 请求次数与重复读取稳定性证据

W8 不宣称已有缓存命中，但回归证据应证明重复读取稳定：

- 同一个 `reportDate + stationId + reportType` 连续请求至少两次，返回内容应保持语义稳定。
- 比对时应忽略 `generatedAt`、`timestamp` 这类时刻字段，只比对业务字段和行集。
- 页面 smoke 应记录每个报表页的实际请求次数，避免同一页因为重渲染或重复读取多次拉取同一个日报接口。
- 若后续引入缓存层，必须额外记录命中率、失效路径和回源次数。

## 6. 性能基线与验收证据

本项承接 W7，不重定义查询边界，也不重新讨论 SQL 过滤范围。

### 6.1 基线继续沿用 W7

W7 已冻结的性能证据仍然有效：

- explain / baseline 对比
- 返回行数
- 样本日期
- 样本站点
- 返回耗时

### 6.2 W8 额外证据要求

W8 需要在 W7 基线上再补三类证据：

- 重复读取稳定性：同一 key 的连续请求结果一致，除 `generatedAt` / `timestamp` 外无语义漂移。
- 页面稳定性：报表页首次加载与重复进入时不出现额外请求抖动。
- 口径稳定性：`reportMeta`、row 集命名、空态表达、对比页默认样例保持一致。

### 6.3 验收门槛

- 不要求 W8 重新证明 SQL 优化本身，因为那是 W7 的范围。
- 需要证明“缓存边界定义明确、回归断言明确、重复读取稳定、性能证据完整”。

## 7. 非目标

- 本周不改 SQL。
- 本周不引入新业务指标。
- 本周不改页面结构。
- 本周不声称实现了生产缓存层。
- 本周不扩展到 W9 的 Agent 产品化范围。

## 8. 风险与回滚

- 风险 1：把 `generatedAt` 或 `timestamp` 误纳入等值断言，会导致所有日报回归不稳定。
- 风险 2：如果 `stationId` 在平台级和对比级语义上被省略，缓存或回归结果可能跨视角串读。
- 风险 3：如果 `shiftReportRows`、`pdaKpiRows`、`stationFileReportRows` 的默认样例被改成空数组，会直接破坏现有前端展示与 smoke 口径。
- 风险 4：如果对比页继续复用日报行集但不区分 `reportType`，平台日报与治理对比会相互污染。

回滚原则：

- 优先回滚缓存层或重复读取优化，不回滚已经冻结的字段名和页面锚点。
- 若回归失败，先恢复到 W7 冻结的直接读模型，再逐项修复缓存边界与断言。
- 保留 `reportMeta`、row 集、`dailyReport` 的兼容读法，不在回滚时扩写新口径。

## 9. 对 W9 的明确移交输入

W9 只接收以下输入，不重新定义报表冻结口径：

- `reportDate + stationId + reportType` 的缓存边界定义
- `reportMeta` 的稳定字段集
- 站点日报、平台日报、对比报表的 row 集命名
- `generatedAt` 排除在 key 之外的规则
- API integration 断言集合
- frontend smoke 页面与文本锚点
- 重复读取稳定性和性能基线证据要求
- 已冻结的空态口径
- 禁止事项：不改 SQL、不改业务指标、不改页面结构
