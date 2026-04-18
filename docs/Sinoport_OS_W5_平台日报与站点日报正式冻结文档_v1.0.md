# Sinoport OS W5 平台日报与站点日报正式冻结文档 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-17`
- 关联阶段：`P2 / W5`
- 适用范围：平台日报与站点日报的真实接口契约、默认展示区块、字段顺序、`quality / refresh / traceability` 口径、降级边界与回归断言冻结

## 2. 文档目标

把 `W5` 需要冻结的平台日报和站点日报口径一次性写清楚，后续只能在本文件已确认的接口字段、展示顺序和回归断言上实施，不再重新定义日报展示契约。

本文件固定回答 6 件事：

1. 平台日报和站点日报各自依赖哪条真实接口
2. 哪些字段必须稳定存在
3. 页面默认展示区块和字段顺序是什么
4. `quality / refresh / traceability` 在日报里的正式口径是什么
5. `reportsUsingMock / stationReportsUsingMock` 的降级边界是什么
6. `W5` 的正式回归断言和验收断言是什么

## 3. 固定前提

### 3.1 真实来源

本文件只引用当前仓库中已经存在的真实页面、hook、接口和脚本：

- [platform/reports.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/reports.jsx)
- [station/reports.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/reports.jsx)
- [platform.js](/Users/lijun/Downloads/Sinoport/admin-console/src/api/platform.js)
- [station.js](/Users/lijun/Downloads/Sinoport/admin-console/src/api/station.js)
- [station.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/routes/station.ts)
- [test-api-integration.mjs](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs)
- [test-frontend-smoke.mjs](/Users/lijun/Downloads/Sinoport/scripts/test-frontend-smoke.mjs)

### 3.2 正式接口

`W5` 只冻结以下两条日报接口：

1. `GET /api/v1/platform/reports/daily`
2. `GET /api/v1/station/reports/daily`

说明：

- `GET /api/v1/station/reports/overview` 当前仍存在，但不属于本文件冻结的日报展示主契约。
- `W5` 只覆盖平台日报和站点日报，不扩写到 `W6` 的异常日报和进出港 `SLA` 语义。

### 3.3 本文不覆盖

以下内容不在 `W5` 范围内：

1. 异常日报
2. 进港 / 出港 `SLA` 定义
3. 报表缓存、性能和查询优化
4. 新增报表页或新指标
5. 修改现有页面结构

## 4. 日报接口契约冻结

### 4.1 平台日报接口契约

`GET /api/v1/platform/reports/daily` 当前正式返回并由 hook 消费的核心字段如下：

| 字段 | 来源位置 | 当前用途 | 是否必须稳定 |
| --- | --- | --- | --- |
| `reportMeta` | route + hook | 日报锚点和页面头部元信息 | `是` |
| `platformReportCards` | route + hook + page | 顶部指标卡片 | `是` |
| `platformStationReportRows` | route + hook + page | 站点准备度摘要表 | `是` |
| `platformStationComparisonRows` | route + hook + integration | 站点对比与回归断言 | `是` |
| `platformDailyReportRows` | route + hook + page | 平台日报核心指标表 | `是` |
| `qualitySummaryRows` | route + hook + page | 数据质量摘要 | `是` |
| `qualityChecklistRows` | route + hook + page | 质量检查表 | `是` |
| `refreshPolicyRows` | route + hook + page + integration | 刷新规则 | `是` |
| `traceabilityRows` | route + hook + page + integration | 追溯关系 | `是` |
| `dailyReport.keyMetrics` | route + hook | key metrics 聚合口径 | `否`，但保持兼容 |

### 4.2 站点日报接口契约

`GET /api/v1/station/reports/daily` 当前正式返回并由 hook/page 消费的核心字段如下：

| 字段 | 来源位置 | 当前用途 | 是否必须稳定 |
| --- | --- | --- | --- |
| `reportMeta` | route + hook + page | 日报锚点和页面头部元信息 | `是` |
| `stationReportCards` | route + hook + page | 顶部指标卡片 | `是` |
| `shiftReportRows` | route + hook + page | 班次报表摘要 | `是` |
| `pdaKpiRows` | route + hook + page | `PDA KPI` 样例表 | `是` |
| `stationFileReportRows` | route + hook + page | 文件报表样例表 | `是` |
| `stationDailyReportRows` | route + hook + page + integration | 货站日报核心指标表 | `是` |
| `qualitySummaryRows` | route + hook + page | 数据质量摘要 | `是` |
| `qualityChecklistRows` | route + hook + page | 质量检查表 | `是` |
| `refreshPolicyRows` | route + hook + page + integration | 刷新规则 | `是` |
| `traceabilityRows` | route + hook + page + integration | 追溯关系 | `是` |
| `dailyReport.keyMetrics` | route + hook | key metrics 聚合口径 | `否`，但保持兼容 |

### 4.3 必须稳定存在的字段

`W5` 冻结后，以下字段必须稳定存在，不能因为页面空态、数据不足或未来扩展而整体消失：

1. `reportMeta`
2. `reportMeta.reportType`
3. `reportMeta.reportDate`
4. `reportMeta.reportAnchor`
5. `reportMeta.generatedAt`
6. `reportMeta.timeZone`
7. `platformReportCards` 或 `stationReportCards`
8. `qualitySummaryRows`
9. `qualityChecklistRows`
10. `refreshPolicyRows`
11. `traceabilityRows`

补充说明：

- `reportAnchor` 当前由 API 稳定返回，并由集成测试断言；虽然页面未直接显示该字段，但它属于正式日报契约，不能移除。
- 平台日报还要求 `platformStationComparisonRows` 稳定存在，因为它已被集成测试作为真实对比断言使用。

## 5. 默认展示区块与字段顺序冻结

### 5.1 平台日报默认展示顺序

`/platform/reports` 当前默认展示顺序冻结为：

1. 顶部指标卡片：`platformReportCards`
2. `日报生成锚点`
3. `站点准备度摘要`
4. `平台日报核心指标`
5. `数据质量摘要`
6. `质量检查表`
7. `刷新规则`
8. `追溯关系`

### 5.2 平台日报表格字段顺序

平台日报页面当前表格列顺序固定如下：

| 区块 | 固定列顺序 |
| --- | --- |
| `日报生成锚点` | `报表类型` → `报表日期` → `时区` → `生成时间` |
| `站点准备度摘要` | `站点` → `控制层级` → `Inbound SLA` → `POD 闭环率` → `异常时长` → `准备度` |
| `平台日报核心指标` | `日报区块` → `指标` → `当前样例` → `说明` |
| `数据质量摘要` | `区块` → `指标` → `当前值` → `说明` |
| `质量检查表` | `区块` → `检查项` → `当前值` → `动作` |
| `刷新规则` | `区块` → `指标` → `当前值` → `说明` |
| `追溯关系` | `区块` → `指标` → `当前值` → `说明` |

### 5.3 站点日报默认展示顺序

`/station/reports` 当前默认展示顺序冻结为：

1. 顶部指标卡片：`stationReportCards`
2. `日报生成锚点`
3. `货站日报核心指标`
4. `班次报表摘要`
5. `PDA KPI 样例`
6. `文件报表样例`
7. `数据质量摘要`
8. `质量检查表`
9. `刷新规则`
10. `追溯关系`

### 5.4 站点日报表格字段顺序

站点日报页面当前表格列顺序固定如下：

| 区块 | 固定列顺序 |
| --- | --- |
| `日报生成锚点` | `报表类型` → `站点` → `报表日期` → `时区` → `生成时间` |
| `货站日报核心指标` | `区块` → `指标` → `当前值` → `说明` |
| `班次报表摘要` | `班次` → `班组` → `完成数` → `装车准确率` → `POD 闭环率` → `异常时长` |
| `PDA KPI 样例` | `指标` → `当前值` → `目标` → `说明` |
| `文件报表样例` | `报表项` → `对象` → `当前样例` → `说明` |
| `数据质量摘要` | `区块` → `指标` → `当前值` → `说明` |
| `质量检查表` | `区块` → `检查项` → `当前值` → `动作` |
| `刷新规则` | `区块` → `指标` → `当前值` → `说明` |
| `追溯关系` | `区块` → `指标` → `当前值` → `说明` |

## 6. quality / refresh / traceability 口径冻结

### 6.1 quality

`quality` 在日报中的正式载体固定为：

1. `qualitySummaryRows`
2. `qualityChecklistRows`

当前 API 事实来源：

- `qualitySummaryRows` 来自数据质量总量、阻断量、质量分数与严重度聚合
- `qualityChecklistRows` 来自 `quality_checklist.checklist_rows`

冻结结论：

- 日报页面不直接消费原始 `quality_checklist` 对象
- 页面层只认 `qualitySummaryRows` 与 `qualityChecklistRows` 这两组行级 DTO
- `quality` 在 `W5` 只表示日报回灌口径，不展开 `W6` 的异常语义

### 6.2 refresh

`refresh` 在日报中的正式载体固定为：

1. `reportMeta.reportAnchor`
2. `refreshPolicyRows`
3. `dailyReport.refreshPolicy`

冻结结论：

- 页面展示以 `refreshPolicyRows` 为准
- 接口必须继续稳定返回 `reportAnchor`
- `dailyReport.refreshPolicy` 作为兼容聚合结构保留，但页面默认展示不直接依赖它

### 6.3 traceability

`traceability` 在日报中的正式载体固定为：

1. `traceabilityRows`
2. `dailyReport.traceability`

冻结结论：

- 页面展示以 `traceabilityRows` 为准
- `dailyReport.traceability` 作为机器可读摘要继续保留
- `traceability` 只描述“指标如何回链到对象、质量和审计来源”，不在 `W5` 内扩写为异常 drill-back 或 `SLA` drill-back

## 7. reportsUsingMock / stationReportsUsingMock 降级边界冻结

### 7.1 `reportsUsingMock`

当前 [platform.js](/Users/lijun/Downloads/Sinoport/admin-console/src/api/platform.js) 的降级条件固定为：

1. `error`
2. `!payload.reportMeta`
3. `!payload.platformReportCards.length`

冻结结论：

- 平台日报的降级边界只允许以“请求失败或核心日报头/卡片缺失”为触发条件
- 一旦 `reportMeta` 和 `platformReportCards` 存在，页面就应按真实日报 payload 展示，不允许再默认切回 mock

### 7.2 `stationReportsUsingMock`

当前 [station.js](/Users/lijun/Downloads/Sinoport/admin-console/src/api/station.js) 的降级条件固定为：

1. `error`
2. `!liveData.reportMeta`
3. `!liveData.stationReportCards.length`
4. `!liveData.shiftReportRows.length`
5. `!liveData.pdaKpiRows.length`
6. `!liveData.stationFileReportRows.length`
7. `!liveData.outboundActionRows.length`

冻结结论：

- 站点日报当前 hook 降级边界比页面实际展示契约更宽
- `outboundActionRows` 来自 `GET /api/v1/station/reports/overview` 的现有聚合口径，而不是当前 `GET /api/v1/station/reports/daily` 页面展示主契约
- 因此，`outboundActionRows` 在 `W5` 被明确标记为“现有 hook 兼容性降级条件”，不是日报页面正式展示区块

### 7.3 `W5` 冻结后的正式要求

`W5` 冻结后，以下规则同时成立：

1. 平台日报页面正式展示契约以 `/api/v1/platform/reports/daily` 为唯一上游
2. 站点日报页面正式展示契约以 `/api/v1/station/reports/daily` 为唯一上游
3. `reportsUsingMock / stationReportsUsingMock` 只能作为兼容护栏，不得再作为默认数据来源
4. 不允许因为页面空值而静默切到第二套日报真相

## 8. 回归断言冻结

### 8.1 API 集成断言

当前 [test-api-integration.mjs](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs) 已冻结的 `W5` 相关断言如下：

#### 站点日报

1. `GET /api/v1/station/reports/daily?date=YYYY-MM-DD` 返回 `200`
2. `reportMeta.reportDate === date`
3. `reportMeta.reportAnchor` 存在
4. `stationReportCards` 是数组
5. `stationDailyReportRows` 是数组
6. `refreshPolicyRows` 是数组
7. `traceabilityRows` 是数组

#### 平台日报

1. `GET /api/v1/platform/reports/daily?date=YYYY-MM-DD&station_id=MME` 返回 `200`
2. `reportMeta.reportDate === date`
3. `reportMeta.reportAnchor` 存在
4. `platformReportCards` 是数组
5. `platformDailyReportRows` 是数组
6. `platformStationComparisonRows` 是数组
7. `platformStationComparisonRows` 中必须存在 `code = MME && comparisonType = actual`
8. `refreshPolicyRows` 是数组
9. `traceabilityRows` 是数组

### 8.2 前端 smoke 断言

当前 [test-frontend-smoke.mjs](/Users/lijun/Downloads/Sinoport/scripts/test-frontend-smoke.mjs) 已冻结的 `W5` 相关断言如下：

1. `/station/reports` 页面包含文本 `货站层 KPI / 报表`
2. `/platform/reports/stations` 页面包含文本 `站点对比报表`

补充结论：

- 当前 smoke 没有直接覆盖 `/platform/reports` 的日报表格内容
- 这属于 `W5` 已识别的回归空白，但不在本文件内扩写成新测试实现

## 9. W5 正式验收断言

`W5` 验收通过必须同时满足以下条件：

1. `/api/v1/platform/reports/daily` 和 `/api/v1/station/reports/daily` 的 `reportMeta` 稳定存在
2. `reportMeta.reportAnchor` 继续作为正式日报锚点返回
3. 平台日报的 `platformReportCards / platformDailyReportRows / qualitySummaryRows / qualityChecklistRows / refreshPolicyRows / traceabilityRows` 稳定存在
4. 站点日报的 `stationReportCards / shiftReportRows / pdaKpiRows / stationFileReportRows / stationDailyReportRows / qualitySummaryRows / qualityChecklistRows / refreshPolicyRows / traceabilityRows` 稳定存在
5. 页面默认展示区块和字段顺序不漂移
6. `reportsUsingMock / stationReportsUsingMock` 不再被当成默认真相来源
7. `W5` 文档不扩写到异常日报和 `SLA` 语义

## 10. 交叉引用

- [Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md)
- [Sinoport_OS_数据质量治理_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_数据质量治理_v1.0.md)

## 11. 遗留风险

1. `stationReportsUsingMock` 当前仍把 `outboundActionRows` 作为降级条件，但该字段并不是 `/api/v1/station/reports/daily` 页面展示主契约的一部分，存在 hook 兼容口径与日报页面契约不完全一致的风险。
2. 前端 smoke 当前只直接断言了 `/station/reports` 的页面标题，没有对 `/platform/reports` 的日报内容做同级覆盖。
3. 平台 hook 读取了 `platformStationComparisonRows`，但 `/platform/reports` 页面当前没有直接展示该数组；这条链目前主要靠 API 集成测试维持稳定。
4. `dailyReport.keyMetrics` 仍作为兼容聚合结构存在，但页面当前并不直接消费它；后续如要继续保留，必须保持其为兼容层，而不是新一套页面主契约。
