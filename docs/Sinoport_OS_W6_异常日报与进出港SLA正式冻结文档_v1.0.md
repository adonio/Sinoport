# Sinoport OS W6 异常日报与进出港 SLA 正式冻结文档 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-17`
- 关联阶段：`P2 / W6`
- 适用范围：`station/exceptions/daily` 的正式 schema、异常语义、进港/出港 SLA 在当前报表中的定义边界、对象回链、`refresh / traceability` 延续关系与 `W6` 回归断言

## 2. 文档目标

把 `W6` 需要冻结的异常日报和进出港 `SLA` 口径一次性写清楚，后续只允许在本文件已经确认的真实字段和真实语义上继续实施，不再临时扩写新的日报页、新的报表对象或新的指标定义。

本文件固定回答 7 件事：

1. `GET /api/v1/station/exceptions/daily` 当前正式返回哪些字段
2. 异常状态、严重度、责任归属、阻断语义在当前仓库里如何定义
3. 进港 / 出港 `SLA` 在当前报表里的真实边界是什么
4. 异常日报如何回链到 `Exception / Flight / AWB`
5. `refresh / traceability` 在 `W6` 中如何沿用 `W5`
6. `W6` 明确不做什么
7. `W6` 的正式回归断言是什么

## 3. 固定前提

### 3.1 真实来源

本文件只引用当前仓库中已经存在的真实页面、真实接口和真实测试断言：

- [station/exceptions.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/exceptions.jsx)
- [station/reports-shift.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/reports-shift.jsx)
- [station.js](/Users/lijun/Downloads/Sinoport/admin-console/src/api/station.js)
- [station.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/routes/station.ts)
- [test-api-integration.mjs](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs)

### 3.2 正式接口与现有展示面

`W6` 只冻结以下真实能力：

1. `GET /api/v1/station/exceptions/daily`
2. `GET /api/v1/station/reports/daily` 中已经存在的 `stationDailyReportRows`、`shiftReportRows`、`refreshPolicyRows`、`traceabilityRows`
3. `GET /api/v1/station/exceptions`
4. `GET /api/v1/station/exceptions/:exceptionId`

说明：

- `/station/exceptions` 是当前异常列表与详情编辑入口。
- `/station/reports-shift` 当前只展示 `GET /api/v1/station/reports/daily` 返回的 `shiftReportRows`，不是新的异常日报页。
- `W6` 不新增新的报表页面，也不把 `station/exceptions/daily` 扩写成独立前端页面。

### 3.3 本文不覆盖

以下内容不在 `W6` 范围内：

1. `W7` 的查询优化、索引、执行计划和报表性能治理
2. `W8` 的缓存边界、回归脚本扩展和指标冻结
3. 新增异常报表页或新的 `SLA` 指标
4. 修改现有前端布局和代码实现

## 4. 异常日报 Schema 冻结

### 4.1 正式返回字段

`GET /api/v1/station/exceptions/daily` 当前在 [station.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/routes/station.ts) 中正式返回以下核心字段：

| 字段 | 当前来源 | 当前用途 | 是否必须稳定 |
| --- | --- | --- | --- |
| `reportMeta` | `loadStationReportsDaily` 基类 | 日报元信息与锚点 | `是` |
| `exceptionOverviewCards` | `buildStationExceptionOverviewCards` | 异常概要卡片 | `是` |
| `exceptionDailyReportRows` | `loadStationExceptionsDaily` | 异常日报核心指标表 | `是` |
| `exceptionRows` | `loadStationExceptionsDaily` | 异常摘要列表 | `是` |
| `exceptionSummaryRows` | `exceptionRows` 镜像 | 兼容摘要消费 | `是` |
| `refreshPolicyRows` | `buildDailyRefreshPolicyRows` | 刷新规则 | `是` |
| `traceabilityRows` | `buildDailyTraceabilityRows` | 追溯关系 | `是` |
| `dailyReport.overviewCards` | `exceptionOverviewCards` 镜像 | 兼容聚合结构 | `否`，但保持兼容 |
| `dailyReport.keyMetrics` | `exceptionDailyReportRows + refreshPolicyRows + traceabilityRows` | 兼容聚合结构 | `否`，但保持兼容 |
| `dailyReport.taskSummary.rows` | `report.taskSummaryRows` | 异常日报内联任务摘要 | `否`，但保持兼容 |
| `dailyReport.timestamp` | `report.generatedAt` | 聚合生成时间 | `否`，但保持兼容 |

### 4.2 `reportMeta` 固定字段

`reportMeta` 在 `W6` 中继续沿用 `W5` 的日报契约，必须稳定存在：

1. `reportType`
2. `stationId`
3. `reportDate`
4. `reportAnchor`
5. `generatedAt`
6. `timeZone`

`test-api-integration.mjs` 当前已对以下两点做真实断言：

1. `reportMeta.reportDate === date`
2. `reportMeta.reportAnchor` 必须存在

### 4.3 `exceptionOverviewCards` 固定语义

`exceptionOverviewCards` 当前固定返回 4 张卡：

1. `开放异常`
2. `阻断异常`
3. `P1 异常`
4. `已恢复/关闭`

其真实计算口径固定如下：

- `开放异常`：`exception_status === "Open"` 的数量
- `阻断异常`：`blocker_flag === true` 的数量
- `P1 异常`：`severity === "P1"` 的数量
- `已恢复/关闭`：`exception_status` 属于 `Resolved / Closed` 的数量

### 4.4 `exceptionDailyReportRows` 固定行

`exceptionDailyReportRows` 当前固定为 4 行，不扩写新 section：

1. `异常总量`
2. `严重度分布`
3. `关联任务`
4. `文档影响`

每行的正式字段固定为：

| 字段 | 说明 |
| --- | --- |
| `section` | 报表区块名称 |
| `metric` | 区块内指标标题 |
| `current` | 当前日报值 |
| `note` | 说明文本 |

当前 4 行的真实语义：

| `section` | `metric` | `current` 真实来源 |
| --- | --- | --- |
| `异常总量` | `开放 / 阻断 / 已关闭` | `dailyReport.anomalyDistribution.open / blocking / (source.exceptions.length - open)` |
| `严重度分布` | `P1 / P2 / P3` | `dailyReport.anomalyDistribution.bySeverity` 聚合 |
| `关联任务` | `开放 / 阻断 / 已完成` | `dailyReport.taskSummary.open / blocked / completed` |
| `文档影响` | `关键 / 已批 / 缺失` | `dailyReport.documentSummary.required / approved / missing` |

### 4.5 `exceptionRows` 固定字段

`exceptionRows` 当前只冻结以下真实字段：

1. `id`
2. `title`
3. `object`
4. `severity`
5. `status`
6. `blocker`
7. `summary`
8. `openedAt`
9. `relatedTask`

说明：

- `relatedTask` 当前只返回任务标识文本，不返回跳转链接。
- `exceptionRows` 当前是异常日报摘要载体，不替代 `/station/exceptions` 列表页对象模型。

## 5. 异常语义冻结

### 5.1 状态语义

`W6` 只冻结当前仓库里已经实际出现的异常状态语义：

1. `Open`
2. `In Progress`
3. `Resolved`
4. `Closed`

正式口径：

- `Open`：当前仍开放，且在概要卡与日报里计入开放范围
- `In Progress`：当前处理中，但仍属于未关闭异常
- `Resolved`：已恢复，不再属于开放异常
- `Closed`：已关闭，不再属于开放异常

补充说明：

- `loadStationExceptionsDaily` 的开放/阻断聚合以“非关闭状态”为主集合，再叠加 `blockerFlag`。
- `buildStationExceptionOverviewCards` 中“开放异常”只直接统计 `Open`，而 `Resolved / Closed` 进入“已恢复/关闭”。

### 5.2 严重度语义

`severity` 当前只冻结已经在日报和异常列表里真实使用的 3 档：

1. `P1`
2. `P2`
3. `P3`

正式口径：

- `P1`：在异常概要卡中单独计数
- `P2`：默认中等级别
- `P3`：低优先级

说明：

- `loadStationExceptionsDaily` 的排序优先级固定为：`blockerFlag` 优先，其次 `P1 -> P2 -> P3`，最后按 `openedAt` 倒序。
- `/station/exceptions` 列表页的 `SLA` 列当前实际显示的是 `row.severity`，因此 `W6` 不额外引入新的异常时限字段。

### 5.3 责任归属语义

责任归属在当前仓库中真实由以下字段承载：

1. `owner_role`
2. `owner_team_id`

冻结结论：

- `/station/exceptions` 列表页显示值为 `[owner_role, owner_team_id].join(" / ")`
- 异常日报 `exceptionRows` 当前不单独展示 `owner_role` 或 `owner_team_id`
- `W6` 只冻结“责任归属存在于异常主对象与详情对象中”的语义，不新增日报表格列

### 5.4 阻断语义

阻断语义只认当前真实字段：

1. `blocker_flag`
2. `exception_status`

正式口径：

- `blocker_flag === true`：当前异常阻断主链推进
- `blocker_flag === false`：当前异常不阻断主链推进，但仍可能待处理
- 若异常已经进入 `Resolved / Closed`，则不再进入日报中的开放阻断集合

对应仓库中的真实说明：

- `buildStationExceptionOverviewCards`：`阻断异常` 的 helper 为“会阻断主链推进”
- `buildStationExceptionGatePolicySummary`：`impact` 明确返回“当前阻断主链推进”或“当前不阻断主链”
- `/station/exceptions` 列表页将 `blockerFlag` 渲染为 `阻断中 / 未阻断`

## 6. 进港 / 出港 SLA 在当前报表中的定义边界

### 6.1 W6 对 SLA 的冻结边界

`W6` 只冻结当前报表里已经真实存在的 `SLA` 展示边界，不新增新的 `inbound_sla`、`outbound_sla` 明细接口，也不引入新的图表页。

### 6.2 当前真实承载位置

当前报表里与 `SLA` 相关的真实展示位置只有以下几类：

1. `/station/exceptions` 列表页中的 `SLA` 列
2. `/station/reports-shift` 与 `/station/reports` 中的 `shiftReportRows`
3. `/station/reports` 中的 `stationDailyReportRows`

### 6.3 异常页中的 SLA 边界

`/station/exceptions` 的 `SLA` 列当前真实显示的是：

- `row.severity`

冻结结论：

- 在当前实现里，异常页的 `SLA` 展示等价于异常严重度展示
- `W6` 只冻结这层现状，不把它扩写成单独的时限承诺对象

### 6.4 班次报表中的 SLA 边界

`shiftReportRows` 当前只冻结以下 4 个运营指标：

1. `completed`
2. `loadingAccuracy`
3. `podClosure`
4. `exceptionAge`

正式口径：

- `loadingAccuracy`：装车 / 机坪 / 转运任务完成比率
- `podClosure`：`POD` 任务完成比率
- `exceptionAge`：按班组相关异常 `openedAt -> closedAt` 的平均时长

冻结结论：

- `W6` 只把 `exceptionAge` 视为当前异常闭环时长语义
- `W6` 不把 `shiftReportRows` 扩写成独立的 inbound / outbound SLA 看板

### 6.5 站点日报中的 SLA 边界

`stationDailyReportRows` 当前与 `SLA` 直接相关的真实区块是：

1. `任务流转`
2. `异常分布`
3. `PDA 关键指标`

正式语义：

- `任务流转` 的 `完成 / 阻断 / 超时`：反映任务是否在日报锚点前完成、阻断或超时
- `PDA 关键指标` 的 `接单 / 到场 / 完成`：分别来自任务、装载计划的平均分钟数
- `异常首次反馈`：来自异常 `openedAt -> closedAt` 的平均分钟数

冻结结论：

- `W6` 将“进港 / 出港 SLA”冻结为当前日报内已经存在的任务时效、装车准确率、`POD` 闭环率、异常闭环时长和 `PDA` 分钟级指标
- `W6` 不新增名为 `Inbound SLA` 或 `Outbound SLA` 的站点日报字段

## 7. Drill-back 关系冻结

### 7.1 异常对象主回链

异常对象当前在前端列表页的真实跳转关系固定如下：

| 条件 | `objectTo` |
| --- | --- |
| `related_object_type === "Flight"` | `/station/inbound/flights/:flightNo` |
| `related_object_type === "AWB"` | `/station/inbound/waybills/:awbNo` |
| `related_object_type === "Shipment"` | `/station/shipments/:related_object_id` |
| `related_object_type === "Document"` | `/station/documents` |
| 其他 | `/station/tasks` |

### 7.2 异常详情回链

异常列表页当前固定提供：

1. `detailTo = /station/exceptions/:exceptionId`
2. `objectTo`
3. 当 `linked_task_id` 存在时，`jumpTo = /station/tasks`

冻结结论：

- `W6` 只冻结现有 `detailTo / objectTo / jumpTo` 这三条跳转语义
- `W6` 不新增从异常日报直接跳到新报表页的链路

### 7.3 异常日报摘要回链

`station/exceptions/daily` 的 `exceptionRows` 当前只冻结以下回链信息：

1. `id`
2. `object`
3. `relatedTask`

冻结结论：

- `exceptionRows.object` 只作为对象摘要文本
- `exceptionRows.relatedTask` 只作为任务摘要标识
- 真正的页面跳转仍以 `/station/exceptions` 列表页和异常详情页为主

### 7.4 Traceability 中的对象回链

`buildDailyTraceabilityRows` 当前对 `W6` 已固定：

- `对象回链 = Flight / AWB / Shipment / Exception`
- `审计回链 = audit/object / audit/events`

冻结结论：

- 异常日报中的 drill-back 只要求能回到真实对象和审计链
- `W6` 不再扩写新的 drill-back 类型

## 8. Refresh / Traceability 延续关系冻结

### 8.1 Refresh 延续关系

`W6` 继续沿用 `W5` 的日报刷新规则，不新增新的刷新模式：

1. `reportMeta.reportAnchor`
2. `refreshPolicyRows`
3. `dailyReport.keyMetrics` 中拼接的 `refreshPolicyRows`

固定语义：

- `日终锚点`：按 `reportDate` 的日报锚点冻结统计窗口
- `默认刷新模式`：`全量重算`
- `补算范围`：`站点 + 日期`

### 8.2 Traceability 延续关系

`W6` 继续沿用 `W5` 的 3 类追溯关系：

1. `质量回链`
2. `对象回链`
3. `审计回链`

固定语义：

- `质量回链`：`qualitySummary / qualityChecklist`
- `对象回链`：`Flight / AWB / Shipment / Exception`
- `审计回链`：`audit/object / audit/events`

冻结结论：

- `W6` 只在异常日报场景下复用 `refresh / traceability`
- `W6` 不新增缓存键、预聚合策略或性能语义

## 9. W6 明确不做的事项

`W6` 明确不做以下事情：

1. 不新增异常日报前端页面
2. 不新增 `Inbound SLA` / `Outbound SLA` 新字段
3. 不把 `severity` 改造成新的独立时限对象
4. 不扩写 `W7` 的查询性能治理
5. 不扩写 `W8` 的缓存和回归扩展

## 10. 回归断言冻结

### 10.1 已存在的 API 集成断言

[test-api-integration.mjs](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs) 当前已对 `GET /api/v1/station/exceptions/daily` 固定断言：

1. 请求成功
2. `reportMeta.reportDate === reportDate`
3. `reportMeta.reportAnchor` 存在
4. `exceptionOverviewCards` 为数组
5. `exceptionDailyReportRows` 为数组
6. `refreshPolicyRows` 为数组
7. `traceabilityRows` 为数组

### 10.2 W6 追加的正式校验口径

`W6` 冻结后，人工或后续自动化回归至少应追加确认以下语义：

1. `exceptionOverviewCards` 必须继续维持 4 张卡：`开放异常 / 阻断异常 / P1 异常 / 已恢复/关闭`
2. `exceptionDailyReportRows` 必须继续维持 4 行：`异常总量 / 严重度分布 / 关联任务 / 文档影响`
3. `/station/exceptions` 列表页的 `SLA` 列继续展示 `severity`
4. `/station/reports-shift` 继续只消费 `shiftReportRows`，且列顺序保持 `班次 / 班组 / 完成数 / 装车准确率 / POD 闭环率 / 异常时长`
5. `traceabilityRows` 继续显式暴露 `对象回链 = Flight / AWB / Shipment / Exception`

### 10.3 W6 正式验收断言

`W6` 验收通过必须同时满足：

1. `station/exceptions/daily` 的主契约仍是 `reportMeta + exceptionOverviewCards + exceptionDailyReportRows + refreshPolicyRows + traceabilityRows`
2. 异常状态、严重度、责任归属、阻断语义继续只使用当前真实字段
3. 进港 / 出港 `SLA` 在报表中的定义边界仍停留在当前已存在字段，不扩写新指标
4. drill-back 仍只回到真实对象页、异常详情页和审计链
5. 没有新增异常日报页，也没有扩写到 `W7 / W8`

## 11. 交叉引用

- [Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md)
- [Sinoport_OS_W5_平台日报与站点日报正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W5_平台日报与站点日报正式冻结文档_v1.0.md)

## 12. 遗留风险

1. `buildStationExceptionOverviewCards` 中“开放异常”只直接统计 `Open`，而 `loadStationReportsDaily` 的 `anomalyDistribution.open` 是按“非关闭状态”计算，两者语义接近但并不完全相同，后续若要统一必须单独开卡，不属于 `W6` 本次冻结范围。
2. `/station/exceptions` 列表页的 `SLA` 列当前实际显示的是 `severity`，字段名称与真实含义存在轻微错位；`W6` 只冻结现状，不改实现。
3. `station/exceptions/daily` 的 `exceptionRows` 只返回文本摘要，不直接返回可跳转链接；实际 drill-back 仍依赖异常中心列表页和详情页。
4. `/station/reports-shift` 当前没有直接消费 `station/exceptions/daily`，它只通过 `shiftReportRows` 间接反映异常闭环时长；因此 `W6` 冻结的是语义边界，不是页面新增能力。
