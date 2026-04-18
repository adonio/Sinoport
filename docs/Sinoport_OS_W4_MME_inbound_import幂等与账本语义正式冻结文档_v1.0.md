# Sinoport OS W4 MME inbound import 幂等与账本语义正式冻结文档 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-17`
- 适用范围：
  - 站点：`MME`
  - 导入类型：`station_inbound_bundle`
  - 接口：`POST /api/v1/station/imports/inbound-bundle`

## 2. 文档目标

本文件用于冻结 `W4` 的最小正式口径，只覆盖当前仓库已经存在的 inbound import 幂等、账本状态、错误分类、失败回写和回归边界。

本版只回答以下问题：

1. `request_id` 如何作为正式幂等键生效
2. `import_requests` 的 `pending / completed / failed` 三态各自代表什么
3. `VALIDATION_ERROR`、`IMPORT_IN_PROGRESS`、其他错误目前如何最小分层
4. 失败信息如何回写到账本
5. 当前 `request_id` 的查询语义是什么
6. 成功、重复、并发、失败、失败后重试五类场景的正式回归边界是什么

不在本版范围内：

1. 更细的自动重试矩阵
2. 自动恢复系统
3. 批量导入调度器
4. 新增 `import_requests` 详情页或查询 API

## 3. 固定前提

当前正式事实来源固定为：

1. [0014_add_import_request_ledger.sql](/Users/lijun/Downloads/Sinoport/apps/api-worker/migrations/0014_add_import_request_ledger.sql)
2. [station-bundle-import.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/lib/station-bundle-import.ts)
3. [station.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/routes/station.ts)
4. [replay-mme-inbound.mjs](/Users/lijun/Downloads/Sinoport/scripts/replay-mme-inbound.mjs)
5. [validate-mme-inbound-errors.mjs](/Users/lijun/Downloads/Sinoport/scripts/validate-mme-inbound-errors.mjs)
6. [Sinoport_OS_正式导入链_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_正式导入链_v1.0.md)
7. [Sinoport_OS_MME_生产试运行SOP_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_MME_生产试运行SOP_v1.0.md)
8. [Sinoport_OS_MME_生产试运行验收记录_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_MME_生产试运行验收记录_v1.0.md)

本文件不新增任何实现假设，只复述以上文件已经存在的字段和行为。

## 4. 幂等键语义冻结

### 4.1 正式幂等键来源

当前实现按如下顺序确定 `request_id`：

1. 优先读取请求头 `Idempotency-Key`
2. 若缺失，则读取请求头 `X-Request-Id`
3. 若两者都缺失，则回退到请求体 `request_id` 或 `requestId`
4. 若仍缺失，则由后端生成随机 `request_id`

### 4.2 账本唯一键

当前 `import_requests` 的正式唯一键是：

1. `request_id`
2. `import_type`

对 `MME inbound bundle` 来说，当前固定 `import_type = station_inbound_bundle`。

因此，当前幂等判断语义不是“按 payload 内容去重”，而是“按 `(request_id, import_type)` 命中同一账本记录”。

### 4.3 重复请求语义

当前仓库中已经冻结的重复请求行为如下：

1. 若同一 `(request_id, import_type)` 已存在且状态为 `completed`
   - 返回已有 `result_json`
   - 返回 `idempotency_status = replayed`
   - 不重复写业务对象
   - 不重复写正式审计
2. 若同一 `(request_id, import_type)` 已存在且状态为 `pending`
   - 返回 `409`
   - 错误码固定为 `IMPORT_IN_PROGRESS`
   - 错误详情中带回同一 `request_id`

本条口径与现有实现、回放脚本和月度决策记录保持一致。

## 5. import_requests 账本状态冻结

`import_requests` 当前正式字段包含：

1. `request_id`
2. `import_type`
3. `station_id`
4. `actor_id`
5. `status`
6. `target_object_type`
7. `target_object_id`
8. `payload_json`
9. `result_json`
10. `error_code`
11. `error_message`
12. `created_at`
13. `updated_at`
14. `completed_at`

当前只冻结三种正式状态：

### 5.1 `pending`

代表：

1. 当前 `request_id` 已进入正式导入链
2. 业务对象写入和审计写入正在进行
3. 该请求尚未得到最终成功结果
4. 同一 `request_id` 的重复提交必须被视为并发重复，而不是重放成功

### 5.2 `completed`

代表：

1. 当前请求已完成业务对象写入
2. 当前请求已完成正式审计写入
3. `result_json` 已保存正式结果摘要
4. `completed_at` 已被写入
5. 后续相同 `request_id` 的重复提交只允许返回 `replayed`

### 5.3 `failed`

代表：

1. 当前请求已经结束，但没有形成成功导入结果
2. 失败原因已经写入 `error_code` 和 `error_message`
3. 失败上下文至少要能回收 `station_id`、目标对象锚点和请求 payload 摘要
4. 后续若再次使用同一 `request_id` 提交，不会命中 `completed replay`，而是重新进入导入判断

本版不把 `failed` 再细分为自动可重试、人工重试、永久失败三类。

## 6. 错误分类最小集冻结

当前最小错误分类只冻结三层：

### 6.1 `VALIDATION_ERROR`

代表：

1. 请求体不是合法对象
2. 必填字段缺失
3. 字段值不符合当前导入规范

当前失败样本 [mme-inbound-bundle-missing-awb.json](/Users/lijun/Downloads/Sinoport/scripts/fixtures/inbound-bundles/mme-inbound-bundle-missing-awb.json) 用于固定这类边界。

当前路由返回：

1. `HTTP 400`
2. `error.code = VALIDATION_ERROR`
3. `error.message` 保留真实字段错误信息

### 6.2 `IMPORT_IN_PROGRESS`

代表：

1. 相同 `(request_id, import_type)` 已经存在
2. 且当前账本状态仍是 `pending`

当前路由返回：

1. `HTTP 409`
2. `error.code = IMPORT_IN_PROGRESS`
3. `error.details.request_id = 当前 request_id`

### 6.3 其他错误

当前实现里，除上述两类外，其余错误统一先落到最小兜底层：

1. 若是导入服务内部显式抛出的 `InboundBundleImportError`
   - 保留原始 `error.code`
2. 若不是显式导入错误
   - 账本侧回写 `error_code = IMPORT_FAILED`
   - 路由层交给统一服务错误处理

本版只冻结“它们不属于 `VALIDATION_ERROR` 和 `IMPORT_IN_PROGRESS`”，不继续拆解未来更细的重试语义。

## 7. 失败信息回写冻结

### 7.1 规范化前失败

若请求在 `normalizeBundleInput` 阶段失败，当前实现会写一条 `failed` 账本，至少包含：

1. `station_id`
   - 读取暂定站点值，若取不到则允许为空
2. `target_object_type = Flight`
3. `target_object_id`
   - 读取暂定 `flight_id`，若取不到则允许为空
4. `payload_json`
   - 保存原始请求体
5. `error_code`
6. `error_message`

### 7.2 事务执行阶段失败

若请求已经完成规范化、已经写入 `pending`，但在事务执行或审计写入阶段失败，当前实现会把同一条账本更新为 `failed`，并至少保留：

1. `station_id`
2. `target_object_type = Flight`
3. `target_object_id = normalized.flight.flightId`
4. `payload_json`
   - 保存 `source`、`station`、`flight`、`awb_total`、`task_total`
5. `error_code`
6. `error_message`

### 7.3 完成态清空错误字段

当前实现中，导入成功后写 `completed` 时会显式把：

1. `error_code = null`
2. `error_message = null`

与失败态严格区分。

## 8. request_id 查询语义冻结

当前仓库里尚未提供单独的 `GET /imports/:request_id` 或等价查询接口。

因此，`request_id` 的正式查询语义当前只冻结到以下层级：

1. 导入服务内部通过 `(request_id, import_type)` 查询 `import_requests`
2. 问题回收、试运行记录和回放脚本都必须记录同一个 `request_id`
3. 成功重放、并发重复、失败定位都围绕同一个 `request_id` 展开
4. 生产试运行 SOP 中，导入失败和对象链回读失败都要求先回查同一 `request_id` 的账本与审计链

因此，本版把 `request_id` 定义为：

1. 正式幂等键
2. 正式问题定位锚点
3. 正式回放锚点

但不是独立前端详情对象，也不是独立查询资源。

## 9. 回归边界冻结

当前 `W4` 必须覆盖五类场景：

### 9.1 首次成功

断言：

1. `POST /api/v1/station/imports/inbound-bundle` 返回 `200`
2. `idempotency_status = executed`
3. `import_requests.status = completed`
4. 业务对象与审计链可回读

### 9.2 成功后重复提交

断言：

1. 对同一 `request_id` 再次提交返回 `200`
2. `idempotency_status = replayed`
3. 不重复写业务对象
4. 不重复新增 `STATION_INBOUND_BUNDLE_IMPORTED`

本条即当前正式结论：

1. `completed duplicate = replayed`

### 9.3 并发重复提交

断言：

1. 若同一 `request_id` 仍处于 `pending`
2. 再次提交必须返回 `409`
3. 错误码固定为 `IMPORT_IN_PROGRESS`

本条即当前正式结论：

1. `pending duplicate = 409 IMPORT_IN_PROGRESS`

### 9.4 校验失败

断言：

1. 失败样本返回 `400`
2. 错误码固定为 `VALIDATION_ERROR`
3. 账本中必须保留失败记录
4. 错误消息能回指到真实字段问题

### 9.5 失败后重试

当前正式边界只冻结到最小可回归语义：

1. 一次失败请求必须形成可追溯账本
2. 后续允许再次提交导入请求
3. `W4` 只要求至少能定义“失败样本 -> 修正后重新导入 -> 命中正向链路”的回归边界

本版不继续冻结：

1. 是否必须复用原 `request_id`
2. 是否自动从 `failed` 直接恢复
3. 是否有后台补偿任务

这些都超出当前仓库已经冻结的事实范围。

## 10. 与试运行和验收链的关系

`W4` 当前与 `MME` 试运行链的关系固定为：

1. `W4` 负责把导入幂等、账本状态和错误回写冻结清楚
2. `M5` 生产试运行基于这套口径执行最小闭环
3. 试运行问题记录必须至少带 `request_id`
4. 若导入失败或对象链回读失败，必须先回查同一 `request_id` 的账本与审计

这与现有 SOP 和验收记录一致，不新增新的试运行步骤。

## 11. W4 正式验收断言

以下断言同时满足，才视为 `W4` 通过：

1. `request_id / Idempotency-Key` 已冻结为正式幂等键
2. `import_requests` 三态只使用 `pending / completed / failed`
3. `completed duplicate = replayed`
4. `pending duplicate = 409 IMPORT_IN_PROGRESS`
5. `VALIDATION_ERROR` 失败样本能稳定返回 `400`
6. 失败信息已能稳定回写到 `import_requests`
7. `request_id` 已被固定为问题定位和回放锚点
8. 文档没有提前扩写到自动恢复或未来更细重试系统

## 12. 交叉引用

- 对象模型、业务主键与幂等键边界，统一以 [Sinoport_OS_W3_MME_inbound_bundle对象模型正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W3_MME_inbound_bundle对象模型正式冻结文档_v1.0.md) 为准。
- 最小正式导入链总纲，统一以 [Sinoport_OS_正式导入链_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_正式导入链_v1.0.md) 为准。
- 生产试运行执行口径，统一以 [Sinoport_OS_MME_生产试运行SOP_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_MME_生产试运行SOP_v1.0.md) 为准。
- 生产试运行结果口径，统一以 [Sinoport_OS_MME_生产试运行验收记录_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_MME_生产试运行验收记录_v1.0.md) 为准。

## 13. 遗留风险

1. 当前没有独立的 `import_requests` 查询 API，外部排障仍要依赖数据库账本、问题记录和审计链联合定位。
2. `failed` 之后再次提交的“是否复用原 request_id”在当前实现里没有被单独冻结，执行侧如果混用新旧 `request_id`，问题追踪会分散。
3. 路由层对 `IMPORT_IN_PROGRESS` 明确返回 `409`，但其他非校验类失败仍走统一服务错误处理，接口层可见状态码仍可能比账本分类更粗。
4. 试运行 SOP 已要求记录 `request_id`，但如果现场记录不完整，后续账本与对象链的回查成本会明显上升。
