# Sinoport OS W3 MME inbound bundle 对象模型正式冻结文档 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-17`
- 关联阶段：`P2 / W3`
- 适用范围：`MME` 单条 inbound bundle 的对象模型、业务主键与幂等键边界、字段映射、样本边界、导入对象范围、读模型回链关系

## 2. 文档目标

把 `MME inbound bundle` 在 `W3` 需要冻结的建模边界一次性写清楚，后续 `W4` 只能在本文件定义的对象范围与主键口径上补错误分层、并发和重试，不再回头改对象边界。

本文件固定回答 7 件事：

1. inbound bundle 写入哪些正式对象
2. `station / flight / shipment / awb / task / audit / import_request` 各自的边界
3. 业务主键和请求级幂等键如何区分
4. fixture 与真实字段如何映射到导入模型
5. 哪些对象属于导入范围，哪些对象明确不属于
6. 导入完成后如何回链到现有读模型
7. `W3` 的正式验收断言是什么

## 3. 固定前提

### 3.1 真实来源

本文件只引用当前仓库里已经存在的真实字段、脚本和实现：

- [Sinoport_OS_正式导入链_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_正式导入链_v1.0.md)
- [station-bundle-import.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/lib/station-bundle-import.ts)
- [mme-inbound-bundle.json](/Users/lijun/Downloads/Sinoport/scripts/fixtures/inbound-bundles/mme-inbound-bundle.json)
- [mme-inbound-bundle-missing-awb.json](/Users/lijun/Downloads/Sinoport/scripts/fixtures/inbound-bundles/mme-inbound-bundle-missing-awb.json)
- [replay-mme-inbound.mjs](/Users/lijun/Downloads/Sinoport/scripts/replay-mme-inbound.mjs)
- [validate-mme-inbound-errors.mjs](/Users/lijun/Downloads/Sinoport/scripts/validate-mme-inbound-errors.mjs)
- [evaluate-mme-data-quality.mjs](/Users/lijun/Downloads/Sinoport/scripts/evaluate-mme-data-quality.mjs)

### 3.2 正式入口与读回链

`W3` 固定使用以下真实入口与读回链：

- `POST /api/v1/station/imports/inbound-bundle`
- `GET /api/v1/station/inbound/flights/:flightId`
- `GET /api/v1/station/inbound/waybills/:awbId`
- `GET /api/v1/station/shipments/:shipmentId`
- `GET /api/v1/station/tasks`
- `GET /api/v1/platform/audit/object`

### 3.3 本文不覆盖

- `W4` 的错误分层细化
- 重试矩阵
- 并发冲突处置细节
- 出港 bundle
- 外部系统同步

## 4. inbound bundle 对象范围冻结

### 4.1 正式写入对象

`W3` 冻结后，`POST /api/v1/station/imports/inbound-bundle` 只允许写入以下 7 类对象：

1. `stations`
2. `flights`
3. `shipments`
4. `awbs`
5. `tasks`
6. `audit_events`
7. `import_requests`

### 4.2 对象边界

| 对象 | 在 `W3` 的定位 | 固定边界 |
| --- | --- | --- |
| `station` | 导入命中的站点主记录 | 只承接 `station_id`、名称、区域、控制层级、阶段；不是业务请求幂等账本 |
| `flight` | inbound bundle 的主作业对象 | 代表本次进港航班；承接航班主识别和运行状态 |
| `shipment` | 由 `AWB` 派生的履约聚合对象 | 是站内履约/作业聚合；不是请求账本，也不是页面 slug 本身 |
| `awb` | 货运主单对象 | 承接提单号、件重、节点状态，并挂接 `shipment` 与 `flight` |
| `task` | 由 `task_template` 或 `tasks[]` 派生的执行对象 | 只表示作业指令，不承担导入账本语义 |
| `audit_event` | 正式执行痕迹 | 只记录“导入发生过”；不是业务主数据 |
| `import_request` | 请求级账本 | 只记录一次导入请求的状态、载荷摘要、结果摘要和错误信息；不是业务对象 |

### 4.3 明确不在导入范围内的对象

以下对象不属于 `W3` 的 inbound bundle 正式写入范围：

1. `documents`
2. `exceptions`
3. `state_transitions`
4. `teams`
5. `workers`
6. `zones`
7. `devices`
8. `vehicles`
9. 任何 outbound 对象

冻结结论：

- `W3` 只冻结最小 inbound 导入对象链。
- 文档、异常、状态迁移和组织资源对象不能在 `W3` 里顺手扩进来。

## 5. 业务主键与幂等键边界冻结

### 5.1 固定原则

`W3` 固定区分两类键：

1. 业务主键或业务识别键
2. 请求级幂等键

冻结结论：

- 业务主键用于识别真实业务对象。
- `request_id / Idempotency-Key / X-Request-Id` 只属于请求级幂等，不属于任何业务对象主键。

### 5.2 对象主键矩阵

| 对象 | 业务主键或稳定识别键 | 在导入实现里的匹配方式 | 与请求幂等的关系 |
| --- | --- | --- | --- |
| `station` | `station_id` | `stations WHERE station_id = ?` | 无直接关系 |
| `flight` | `flight_id` | 先按 `flight_id`，同时兼容 `(station_id, flight_no, flight_date)` 去重 | 与请求幂等解耦 |
| `shipment` | `shipment_id` | `shipments WHERE shipment_id = ?` | 与请求幂等解耦 |
| `awb` | `awb_no` 是稳定业务识别键；`awb_id` 是对象 ID | 先按 `awb_no` 查重，若已存在则保留现有 `awb_id` | 与请求幂等解耦 |
| `task` | `task_id` | `tasks WHERE task_id = ?` | 与请求幂等解耦 |
| `audit_event` | 无业务主键 | 每次首次执行生成新的 `audit_id` 并绑定 `request_id` | 通过 `request_id` 防止重复执行重复写入 |
| `import_request` | `(request_id, import_type)` | `import_requests WHERE request_id = ? AND import_type = 'station_inbound_bundle'` | 这是正式请求级幂等账本 |

### 5.3 自动生成键边界

当 payload 未显式给出对象 ID 时，当前实现允许按以下规则生成：

| 对象 | 生成规则 |
| --- | --- |
| `flight_id` | `FLIGHT-${flight_no}-${flight_date}-${station_id}` 归一化后生成 |
| `shipment_id` | `SHIP-${station_id}-${awb_no}` 归一化后生成 |
| `awb_id` | `AWB-${awb_no}` 归一化后生成 |
| `task_id` | `TASK-${station_id}-${awb_no}-${task_type}-${index}` 归一化后生成 |

冻结结论：

- 自动生成 ID 是对象 ID 兜底，不是请求幂等键。
- 请求幂等只认 `request_id` 链。

## 6. 字段映射冻结

### 6.1 请求包顶层字段

| 顶层字段 | 来源样本 | 归一化去向 | 说明 |
| --- | --- | --- | --- |
| `request_id` | success / invalid fixture | `NormalizedBundle.requestId`、`import_requests.request_id` | 请求级幂等键 |
| `source` | success / invalid fixture | `NormalizedBundle.source`、`import_requests.payload_json`、`audit_events.payload_json` | 请求来源标签 |
| `station_id` | success / invalid fixture | `NormalizedStation.stationId` | 站点主识别 |
| `station` | success / invalid fixture | `NormalizedStation` | 站点补充属性容器 |
| `flight` | success / invalid fixture | `NormalizedFlight` | 航班对象 |
| `awbs` | success / invalid fixture | `NormalizedAwb[]`、`NormalizedShipment[]`、`NormalizedTask[]` | AWB 列表是 shipment/task 的上游 |

### 6.2 `station` 字段

| payload 字段 | 正式对象字段 |
| --- | --- |
| `station.station_name` | `stations.station_name` |
| `station.region` | `stations.region` |
| `station.control_level` | `stations.control_level` |
| `station.phase` | `stations.phase` |

固定边界：

- `station` 只负责主记录识别和治理标签。
- 不承载任务、异常、文档或验收信息。

### 6.3 `flight` 字段

| payload 字段 | 正式对象字段 |
| --- | --- |
| `flight.flight_id` | `flights.flight_id` |
| `flight.flight_no` | `flights.flight_no` |
| `flight.flight_date` | `flights.flight_date` |
| `flight.origin_code` | `flights.origin_code` |
| `flight.destination_code` | `flights.destination_code` |
| `flight.std_at` | `flights.std_at` |
| `flight.etd_at` | `flights.etd_at` |
| `flight.sta_at` | `flights.sta_at` |
| `flight.eta_at` | `flights.eta_at` |
| `flight.actual_takeoff_at` | `flights.actual_takeoff_at` |
| `flight.actual_landed_at` | `flights.actual_landed_at` |
| `flight.runtime_status` | `flights.runtime_status` |
| `flight.service_level` | `flights.service_level` |
| `flight.aircraft_type` | `flights.aircraft_type` |
| `flight.notes` | `flights.notes` |

### 6.4 `shipment` 字段

`shipment` 来源于 `awbs[*].shipment`，不是顶层独立数组。

| payload 字段 | 正式对象字段 |
| --- | --- |
| `awbs[*].shipment.shipment_id` | `shipments.shipment_id` |
| `awbs[*].shipment.order_id` | `shipments.order_id` |
| `awbs[*].shipment.shipment_type` | `shipments.shipment_type` |
| `awbs[*].shipment.current_node` | `shipments.current_node` |
| `awbs[*].shipment.fulfillment_status` | `shipments.fulfillment_status` |
| `awbs[*].shipment.promise_sla` | `shipments.promise_sla` |
| `awbs[*].shipment.service_level` | `shipments.service_level` |
| `awbs[*].shipment.total_pieces` | `shipments.total_pieces` |
| `awbs[*].shipment.total_weight` | `shipments.total_weight` |
| `awbs[*].shipment.exception_count` | `shipments.exception_count` |
| `awbs[*].shipment.closed_at` | `shipments.closed_at` |

固定边界：

- `shipment` 是正式表对象，主键是 `shipment_id`。
- 当前页面读回链可使用基于 `awb_no` 的 slug，但那是详情入口别名，不是 `shipment` 的主键。

### 6.5 `awb` 字段

| payload 字段 | 正式对象字段 |
| --- | --- |
| `awbs[*].awb_id` | `awbs.awb_id` |
| `awbs[*].awb_no` | `awbs.awb_no` |
| `awbs[*].hawb_no` | `awbs.hawb_no` |
| `awbs[*].shipper_name` | `awbs.shipper_name` |
| `awbs[*].consignee_name` | `awbs.consignee_name` |
| `awbs[*].notify_name` | `awbs.notify_name` |
| `awbs[*].goods_description` | `awbs.goods_description` |
| `awbs[*].pieces` | `awbs.pieces` |
| `awbs[*].gross_weight` | `awbs.gross_weight` |
| `awbs[*].current_node` | `awbs.current_node` |
| `awbs[*].noa_status` | `awbs.noa_status` |
| `awbs[*].pod_status` | `awbs.pod_status` |
| `awbs[*].transfer_status` | `awbs.transfer_status` |
| `awbs[*].manifest_status` | `awbs.manifest_status` |

固定边界：

- `awb` 必须同时回链到 `shipment_id`、`flight_id`、`station_id`。
- `pieces` 和 `gross_weight` 缺失或非正数时，当前实现直接按 `VALIDATION_ERROR` 拒绝。

### 6.6 `task` 字段

`task` 来源有两种：

1. `awbs[*].tasks[*]`
2. `awbs[*].task_template` 或顶层 `task_template`

| payload 字段 | 正式对象字段 |
| --- | --- |
| `task_id` | `tasks.task_id` |
| `task_type` | `tasks.task_type` |
| `execution_node` | `tasks.execution_node` |
| `related_object_type` | `tasks.related_object_type` |
| `related_object_id` | `tasks.related_object_id` |
| `assigned_role` | `tasks.assigned_role` |
| `assigned_team_id` | `tasks.assigned_team_id` |
| `assigned_worker_id` | `tasks.assigned_worker_id` |
| `pick_location_id` | `tasks.pick_location_id` |
| `drop_location_id` | `tasks.drop_location_id` |
| `task_status` | `tasks.task_status` |
| `task_sla` | `tasks.task_sla` |
| `due_at` | `tasks.due_at` |
| `blocker_code` | `tasks.blocker_code` |
| `evidence_required` | `tasks.evidence_required` |
| `completed_at` | `tasks.completed_at` |
| `verified_at` | `tasks.verified_at` |

固定边界：

- `task` 是作业执行对象，不是导入状态对象。
- 若 `awbs[*].tasks` 为空，当前实现才允许从 `task_template` 派生 1 条默认任务。

### 6.7 `audit_event` 与 `import_request` 字段

| 对象 | 固定字段 | 用途 |
| --- | --- | --- |
| `audit_events` | `audit_id`、`request_id`、`actor_id`、`actor_role`、`client_source`、`action`、`object_type`、`object_id`、`station_id`、`summary`、`payload_json`、`created_at` | 记录一次正式导入执行痕迹 |
| `import_requests` | `request_id`、`import_type`、`station_id`、`actor_id`、`status`、`target_object_type`、`target_object_id`、`payload_json`、`result_json`、`error_code`、`error_message`、`created_at`、`updated_at`、`completed_at` | 记录请求级账本、结果摘要和失败信息 |

固定边界：

- `audit_events` 面向审计追溯。
- `import_requests` 面向请求幂等和账本追溯。
- 两者不能互相替代。

## 7. 样本边界冻结

### 7.1 成功样本

[mme-inbound-bundle.json](/Users/lijun/Downloads/Sinoport/scripts/fixtures/inbound-bundles/mme-inbound-bundle.json) 固定用于：

1. 首次导入
2. 幂等重放
3. flight / awb / shipment / task / audit 回读
4. 数据质量评估的正向样本

当前成功样本固定特征：

- `station_id = MME`
- `flight.flight_id = FLIGHT-SE999-2026-04-14-MME`
- `flight.flight_no = SE999`
- 2 条 `AWB`
- 2 条 `Shipment`
- 2 条 `Task`

### 7.2 失败样本

[mme-inbound-bundle-missing-awb.json](/Users/lijun/Downloads/Sinoport/scripts/fixtures/inbound-bundles/mme-inbound-bundle-missing-awb.json) 固定用于：

1. 缺少 `awbs[*].awb_no` 的校验失败样本
2. 验证导入对象在缺关键业务字段时不会落库
3. 数据质量链中的失败请求样本

冻结结论：

- `W3` 只冻结成功样本和“缺 AWB 主识别”的失败样本。
- 更细的失败分类与重试路径留给 `W4`。

## 8. 读模型回链关系冻结

### 8.1 固定回链

| 导入对象 | 读回接口 | 当前回链键 |
| --- | --- | --- |
| `flight` | `GET /api/v1/station/inbound/flights/:flightId` | `flight_id` |
| `awb` | `GET /api/v1/station/inbound/waybills/:awbId` | `awb_id` |
| `shipment` | `GET /api/v1/station/shipments/:shipmentId` | 当前详情入口允许使用 inbound slug，如 `in-${awb_no}`；仓库实现最终按 `awb_no + shipment_type` 解析回 `shipment` |
| `task` | `GET /api/v1/station/tasks` | `task_id` 出现在列表项中 |
| `audit_event` | `GET /api/v1/platform/audit/object` | `object_type=Flight` + `object_id=flight_id` |
| `import_request` | 当前无前台对象页 | 通过导入账本表和脚本校验追溯 |

### 8.2 固定结论

1. `flight`、`awb`、`task` 的读回键可以直接对应正式对象 ID。
2. `shipment` 的业务主键仍是 `shipment_id`，但当前详情入口的页面路由别名按 `awb_no` 解析；两者不能混成同一概念。
3. `audit` 当前以导入后的 `Flight` 作为对象审计主入口。
4. `import_request` 在 `W3` 是账本对象，不要求前端详情页。

## 9. `W3` 正式验收断言

### 9.1 对象边界断言

1. inbound bundle 只写 `station / flight / shipment / awb / task / audit / import_request`
2. `request_id` 只属于请求级幂等，不属于业务对象主键
3. `shipment` 主键是 `shipment_id`，不是页面 slug
4. `awb_no` 是 AWB 的稳定业务识别键，不能被展示字段替代

### 9.2 字段断言

1. 成功样本中的 `station`、`flight`、`awbs[*].shipment`、`awbs[*]`、`tasks` 字段都能对齐到正式对象字段
2. 缺少 `awbs[*].awb_no` 时，导入必须失败
3. `pieces` 和 `gross_weight` 必须是正数
4. `task_template` 只在没有显式 `tasks[]` 时作为默认任务来源

### 9.3 回链断言

1. 成功导入后能回读 flight
2. 成功导入后能回读 2 条 AWB
3. 成功导入后能回读 shipment 详情
4. 成功导入后能在任务列表中找到导入生成的任务
5. 成功导入后能在对象审计中找到 `STATION_INBOUND_BUNDLE_IMPORTED`

## 10. 交叉引用

- [Sinoport_OS_正式导入链_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_正式导入链_v1.0.md)
- [Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md)

## 11. 遗留风险

1. `shipment` 当前详情入口用 slug 解析到 `awb_no`，而不是直接用 `shipment_id`；文档里已把“对象主键”和“页面入口别名”明确拆开。
2. `flight` 的去重同时兼容 `flight_id` 与 `(station_id, flight_no, flight_date)`，后续如果样本或外部导入源在这两套识别上漂移，会放大口径风险。
3. `awb` 的 upsert 当前先按 `awb_no` 查重并保留已有 `awb_id`，因此外部数据源如果试图变更已存在 AWB 的对象 ID，最终不会改写原主对象 ID。
4. `import_request` 当前是账本表，不是对象页；后续如果需要运行台账页面，应继续沿用本文件冻结的账本字段，而不是另起一套运行记录模型。
