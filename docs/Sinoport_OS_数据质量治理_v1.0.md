# Sinoport OS 数据质量治理 v1.0

## 1. 目的

本文件冻结 `M6` 第一批数据质量治理底座。

当前范围只覆盖：

1. `MME`
2. inbound 正式导入链
3. 对象链：`Flight / Shipment / AWB / Task / Audit / ImportRequest`

## 2. 正式对象

### 2.1 规则表

- 表：`data_quality_rules`

当前已内置规则：

1. `DQ_IMPORT_REQUEST_FAILED`
2. `DQ_AWB_MISSING_FLIGHT`
3. `DQ_AWB_MISSING_SHIPMENT`
4. `DQ_SHIPMENT_WITHOUT_AWB`
5. `DQ_TASK_MISSING_RELATED_OBJECT`
6. `DQ_TRIAL_FLIGHT_MISSING_AUDIT`

### 2.2 问题表

- 表：`data_quality_issues`

当前问题对象至少包含：

1. 站点
2. 日期
3. 对象类型 / 对象 ID
4. 规则 ID / 问题编码
5. 严重级别
6. 是否默认阻断
7. 来源类型
8. 关联 `import_request_id`
9. 关联审计对象
10. 建议动作

## 3. 正式接口

平台侧：

1. `GET /api/v1/platform/data-quality/rules`
2. `POST /api/v1/platform/data-quality/stations/:stationId/evaluate`
3. `GET /api/v1/platform/data-quality/stations/:stationId/overview`
4. `GET /api/v1/platform/data-quality/stations/:stationId/issues`
5. `GET /api/v1/platform/data-quality/stations/:stationId/checklist`

站点侧：

1. `GET /api/v1/station/data-quality/overview`
2. `GET /api/v1/station/data-quality/issues`
3. `GET /api/v1/station/data-quality/checklist`

## 4. 当前评估范围

当前评估器会生成以下问题：

1. 正式导入失败请求
2. `AWB` 缺少 `Flight`
3. `AWB` 缺少 `Shipment`
4. `Shipment` 下没有任何 `AWB`
5. `Task` 缺少关联对象
6. 试运行导入后 `Flight` 缺少正式导入审计

## 5. 反向追踪口径

每条质量问题都要求至少能追到其中一类：

1. `import_request_id`
2. 审计对象：`audit_object_type + audit_object_id`
3. 对象链：`Flight / Shipment / AWB / Task`

## 6. 当前回归脚本

```bash
npm run test:evaluate:data-quality
```

脚本会验证：

1. 正式登录
2. 成功导入一条 inbound bundle
3. 失败导入一条缺字段样本
4. 执行质量评估
5. 回读平台/站点质量接口
6. 断言至少生成一条 `DQ_IMPORT_REQUEST_FAILED`
7. 断言平台/站点质量检查表能给出 `gate_status` 和阻断候选规则

## 7. 阻断与运营口径

当前冻结的默认阻断候选集：

1. `DQ_IMPORT_REQUEST_FAILED`
2. `DQ_AWB_MISSING_FLIGHT`
3. `DQ_AWB_MISSING_SHIPMENT`
4. `DQ_TASK_MISSING_RELATED_OBJECT`

当前冻结的提醒型规则：

1. `DQ_SHIPMENT_WITHOUT_AWB`
2. `DQ_TRIAL_FLIGHT_MISSING_AUDIT`

运营回灌口径：

1. 站点/平台日报必须同时暴露 `qualitySummary` 和 `qualityChecklist`
2. `qualityChecklist.gate_status` 只允许：
  - `clear`
  - `warning`
  - `blocked`
3. 质量问题必须至少回灌到：
  - 质量治理页
  - 日报 key metrics
  - 月度复盘输入

## 8. 当前结论

`M6` 第一批数据质量治理底座已经形成：

1. 正式规则表
2. 正式问题表
3. 平台/站点读取接口
4. 评估入口
5. 质量检查表接口
6. 本地自动回归脚本
7. 日报回灌口径

主 agent 验收口径已经满足：

1. 核心对象的质量规则已定义
2. 问题能按正式数据库对象沉淀
3. 日报、对象链、审计链可以反向追踪问题来源
4. 默认阻断候选集与运营检查表口径已冻结
