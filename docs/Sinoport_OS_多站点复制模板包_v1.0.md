# Sinoport OS 多站点复制模板包 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-15`
- 关联阶段：`M9 / W9-01`
- `W1` 正式冻结文档：
  [Sinoport_OS_W1_多站点模板化正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W1_多站点模板化正式冻结文档_v1.0.md)

## 2. 目标

把“多站点复制”先固化成一个正式模板包，而不是直接上线第二个真实站点。

本阶段只冻结：
- 模板包定义
- 强制一致项
- 站点可覆盖项
- 最小接入单元
- 最小多站点对比集
- 回滚口径

本阶段不做：
- 第二真实站点上线
- 新站点逐页手工配置
- M10 Agent 扩展

## 3. 正式接口

- `GET /api/v1/platform/station-governance/stations/:stationId/copy-package`

该接口返回：
- `package_key`
- `template_station_id / template_station_name`
- `benchmark_station_id / benchmark_station_name`
- `comparison_station_ids`
- `comparison_station_labels`
- `minimum_onboarding_unit`
- `mandatory_consistency_items`
- `station_override_items`
- `readiness_checks`
- `rollback_policy`

## 4. 当前冻结口径

### 4.1 主样板站

- 主样板站固定为：`MME`

### 4.2 模板对照站

- 模板对照站固定为：`RZE`
- `RZE` 只用于模板对比，不代表第二真实试运行站

### 4.3 最小对比集

- `MME`：真实主样板站
- `RZE`：模板对照站

## 5. 强制一致项

以下内容必须统一，不允许逐站改变语义：

1. 控制层级模板
2. 阶段模板
3. 默认资源模板结构
4. 默认能力模板结构
5. 日报与质量契约
6. 导入与审计契约

说明：
- 这保证了站点复制后，不需要靠逐页人工解释来维持业务一致性。

## 6. 站点可覆盖项

以下内容允许站点覆盖，但只能在统一契约内变化：

1. 站点名称与区域
2. 团队编制与班次分配
3. 设备与车辆清单
4. 本地 SLA 阈值

说明：
- 可覆盖的是“数值和库存”，不是“指标定义和模板结构”。

## 7. 最小接入单元

一个新站点想进入复制与治理闭环，至少要具备：

1. `stations` 主记录
2. 控制层级与阶段
3. 默认资源模板与默认能力模板
4. 团队与人员主数据
5. 日报锚点与质量门槛

## 8. 回滚口径

当前固定采用：

- `template-and-configuration`

回滚步骤：
1. 冻结目标站点模板变更窗口
2. 记录 `package_key / station_id / 接入批次`
3. 撤销目标站点当前模板绑定和接入检查结果
4. 恢复上一个稳定模板快照
5. 重新执行治理检查、日报质量检查和导入回放

## 9. 验收标准

以下条件同时成立，才算 `W9-01` 完成：

1. 模板包接口已可读
2. 强制一致项已冻结
3. 可覆盖项已冻结
4. 最小接入单元已冻结
5. 最小对比集已冻结
6. 回滚口径已冻结

## 10. 下一步

`W9-02` 继续推进：
- 接入 SOP 草案
- 接入检查清单
- 模板包与站点配置冲突规则
- 回滚与回放验收口径
