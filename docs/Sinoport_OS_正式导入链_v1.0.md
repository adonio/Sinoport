# Sinoport OS 正式导入链 v1.0

## 1. 文档目的

本文件用于冻结 `M4` 的最小正式导入链边界。当前只覆盖：

1. `MME`
2. 单条 `inbound bundle`
3. `station / flight / shipment / awb / task / audit`

不在本版范围内的内容包括：

1. 多站点批量导入
2. 出港 bundle
3. 自动回滚脚本
4. 外部系统实时同步

## 2. 正式入口

导入入口：

- `POST /api/v1/station/imports/inbound-bundle`

幂等键：

- 优先读取 `Idempotency-Key`
- 若缺失，则回退到 `X-Request-Id`
- 若都缺失，则后端生成 `request_id`

当前正式决定：

1. `request_id` / `Idempotency-Key` 是正式幂等键
2. 首批范围严格限定为 `MME` 单条 inbound bundle
3. 同一幂等键重复提交时，不重复写业务对象
4. 重复提交返回 `idempotency_status = replayed`

## 3. 对象范围

当前正式导入链写入的对象为：

1. `stations`
2. `flights`
3. `shipments`
4. `awbs`
5. `tasks`
6. `audit_events`
7. `import_requests`

其中：

- `import_requests` 负责记录一次导入请求的状态、结果和错误
- `audit_events` 负责保留正式执行痕迹

## 4. 样本口径

### 成功样本

- [mme-inbound-bundle.json](/Users/lijun/Downloads/Sinoport/scripts/fixtures/inbound-bundles/mme-inbound-bundle.json)

用途：

1. 首次导入
2. 重放导入
3. 回读 flight / awb / shipment / tasks / audit

### 失败样本

- [mme-inbound-bundle-missing-awb.json](/Users/lijun/Downloads/Sinoport/scripts/fixtures/inbound-bundles/mme-inbound-bundle-missing-awb.json)

用途：

1. 校验 `VALIDATION_ERROR`
2. 验证缺字段语义
3. 固定错误消息边界

## 5. 导入结果语义

成功导入返回：

- `idempotency_status = executed`

重复导入返回：

- `idempotency_status = replayed`

失败导入返回：

- `error.code`
- `error.message`
- `error.details`

当前最小失败分层：

1. `VALIDATION_ERROR`
2. `IMPORT_IN_PROGRESS`
3. 其他服务错误

本版尚未继续细分为：

1. 可重试
2. 不可重试
3. 必须人工介入

这部分在 `M4` 后半程继续补。

## 6. 审计与账本

### 6.1 审计

正式首次执行会写：

- `STATION_INBOUND_BUNDLE_IMPORTED`

对象：

- `Flight`

说明：

1. 审计记录保留正式执行痕迹
2. 相同 `request_id` 的重复提交不会重复新增审计事件

### 6.2 导入账本

导入账本表：

- `import_requests`

记录内容：

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

状态语义：

1. `pending`
2. `completed`
3. `failed`

## 7. 验收脚本

正式回放脚本：

```bash
npm run test:replay:inbound
```

失败样本校验脚本：

```bash
npm run test:validate:inbound
```

两者都通过时，说明：

1. 成功样本可导入
2. 重复导入具备正式幂等语义
3. 缺字段样本会得到稳定的校验错误

## 8. 当前结论

`M4` 当前已经把 inbound bundle 从“可运行样本链”推进到“具备正式幂等、账本、重放和失败样本的最小正式导入链”。

## 9. 交叉引用

`W3` 的对象模型、业务主键与幂等键边界、字段映射、样本边界和读模型回链关系，统一以 [Sinoport_OS_W3_MME_inbound_bundle对象模型正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W3_MME_inbound_bundle对象模型正式冻结文档_v1.0.md) 为准。

`W4` 的幂等语义、`import_requests` 三态账本、失败信息回写、`request_id` 查询语义和五类回归边界，统一以 [Sinoport_OS_W4_MME_inbound_import幂等与账本语义正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W4_MME_inbound_import幂等与账本语义正式冻结文档_v1.0.md) 为准。
