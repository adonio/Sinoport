# Sinoport OS 多站点治理对比与验收记录 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-15`
- 关联阶段：`M9 / W9-03`
- `W2` 正式冻结文档：
  [Sinoport_OS_W2_站点复制流程与验收链正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W2_站点复制流程与验收链正式冻结文档_v1.0.md)

## 2. 目标

把“多站点治理对比 + 接入验收记录模板”固化成正式后端读模型和页面默认读源。

本版只覆盖：
- 最小治理对比指标集
- 差异定位路径
- 问题回收列表
- 接入验收记录模板

本版不覆盖：
- 第二真实站点上线
- M10 Agent 范围

## 3. 正式接口

- `GET /api/v1/platform/station-governance/stations/:stationId/governance-comparison`
- `GET /api/v1/platform/station-governance/stations/:stationId/acceptance-record-template`

## 4. 固定前提

- 主样板站：`MME`
- 模板对照站：`RZE`
- `comparisonType` 只允许：
  - `actual`
  - `template`
- `acceptanceDecision` 只允许：
  - `Accepted`
  - `Refine`
  - `Blocked`

## 5. 最小治理对比指标集

1. `reportAnchor`
2. `stationCode`
3. `stationName`
4. `controlLevel`
5. `templateKey`
6. `reportDate`
7. `inboundSla`
8. `podCloseRate`
9. `exceptionClosureDuration`
10. `readinessScore`
11. `qualityGateStatus`
12. `qualityChecklistSummary`
13. `refreshPolicyStatus`
14. `traceabilityStatus`
15. `comparisonType`
16. `comparisonNote`

## 6. 差异定位路径

1. 先看 `reportAnchor`
2. 再看 `templateKey / controlLevel`
3. 再看 `qualityChecklist` 是否存在 `blocked`
4. 再看核心指标差异：
   - `inboundSla`
   - `podCloseRate`
   - `exceptionClosureDuration`
   - `readinessScore`
5. 再看 `traceability`
6. 最后回链到：
   - 站点复制模板包
   - 接入 SOP
   - `MME` 生产试运行 SOP

## 7. 接入验收记录模板最小字段集

1. `stationId`
2. `stationCode`
3. `stationName`
4. `templateKey`
5. `comparisonAnchor`
6. `reportDate`
7. `baselineStationCode`
8. `actualMetricsSnapshot`
9. `templateMetricsSnapshot`
10. `qualityChecklistSummary`
11. `differenceSummary`
12. `blockedItems`
13. `warningItems`
14. `acceptanceDecision`
15. `reviewer`
16. `reviewedAt`
17. `rollbackRequired`
18. `rollbackScope`
19. `evidenceRef`

## 8. 页面默认读源

平台页：

- `/platform/reports/stations`

默认直接读取：

- `governance-comparison`
- `acceptance-record-template`

不再依赖平台日报大包自行拼装治理对比和验收模板。

## 9. 验收标准

以下条件同时成立，才算 `W9-03` 完成：

1. 两个新接口都可读
2. 平台站点对比页已切到新接口
3. 最小治理对比指标集已冻结
4. 差异定位路径已冻结
5. 验收记录模板字段已冻结
6. `comparisonType` 与 `acceptanceDecision` 枚举已冻结

## 10. 下一步

`W9-04` 继续推进：
- 验收记录实例化
- 回放与回滚固化
- 问题回收清单收口
- `M9` 月度总验收
