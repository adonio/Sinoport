# Sinoport ↔ Skyledger 同步运维手册

## 1. 同步边界

默认事实源分工：

| 数据 | 权威系统 | 同步方向 |
|---|---|---|
| Flight 基线、AWB/Shipment 基线、Truck 主记录和外部位置 | Skyledger | Skyledger → Sinoport |
| 前置仓逐件接收与放行 | Sinoport | Sinoport → Skyledger |
| 卡车装载、21 节点和人工/围栏确认 | Sinoport | Sinoport → Skyledger |
| 阿拉山口/多斯特克双边口岸事实 | Sinoport | Sinoport → Skyledger |
| TAS 逐件接收与 Gate | Sinoport | Sinoport → Skyledger |
| OCC 计划、Duty、Gate、Incident、KPI | Sinoport | 默认留在 Sinoport；只发布双方约定的业务事实 |

禁止用简单双向覆盖同一字段。每一类事实只能有一个 writer；另一侧通过外部对象映射和事件时间线消费。

## 2. 可靠性与安全机制

- 事件信封包含 `event_id`、`event_type`、`schema_version`、`source_system`、`aggregate_type/id/sequence`、`occurred_at`、`payload`、`payload_hash`；
- 请求使用 `HMAC-SHA256(secret, timestamp + "." + rawBody)`，同时校验时间窗和 payload hash；
- 幂等键为事件 ID，数据库另以 `source_system + aggregate_type + aggregate_id + aggregate_sequence` 唯一约束防重；
- 每个 aggregate 严格按 sequence 处理；缺序返回明确错误，不允许后续事件越序；
- 业务事务写 outbox，后台 worker 重试；接收方先写 inbox，再应用业务状态；
- 每次投递记录 HTTP 状态、错误、尝试次数和时间；可按事件重放；
- reconciliation 对象快照也必须签名；支持全局和 `object_ids_by_type` 作用域对账；
- 日常补偿优先按 aggregate 或批次重放，禁止无差别全表重放。

## 3. 配置项

两边必须使用同一随机高强度密钥，但不要写入仓库：

### Sinoport

```text
SKYLEDGER_BASE_URL=https://<skyledger-api>
SKYLEDGER_INTEGRATION_SECRET=<secret-manager-reference>
```

### Skyledger

```text
SINOPORT_BASE_URL=https://<sinoport-api>
SINOPORT_INTEGRATION_SECRET=<same-secret-manager-reference>
SINOPORT_SYNC_ENABLED=true
SINOPORT_SYNC_INTERVAL_SECONDS=30
```

生产环境必须使用 HTTPS、密钥管理服务、定期轮换、最小网络白名单和独立的 staging/production 密钥。

## 4. 部署顺序

1. 备份两个数据库，并记录当前应用版本和迁移版本；
2. 部署两边“能接收但 worker 未启用”的版本；
3. Sinoport 应用 D1 migrations `0032`～`0036`；
4. Skyledger 执行 `alembic upgrade head`，确认版本到 `0165`；
5. 配置 URL、密钥和监控，分别验证 health endpoint；
6. 从 Skyledger 按小批次导出 Flight/AWB/Truck 基线；
7. 每批确认 Sinoport inbox 全部 `APPLIED`、对象映射齐全，并执行 scoped reconciliation；
8. 只有当该批 `MATCHED` 后才导入下一批；
9. 全部历史范围对齐后执行一次全局 reconciliation；
10. 最后启用两边 worker，观察至少一个完整业务周期再扩大流量。

本地验证可使用：

```bash
# Sinoport（先启动 API）
npm run dev:api
npm run test:v14:cross-system

# Skyledger worker
python -m scripts.sinoport_sync_worker --interval 30 --limit 200 --reconcile --quiet
```

## 5. 监控与告警

至少监控：

- inbox：`RECEIVED/PROCESSING/FAILED/DEAD_LETTER` 的数量和最老事件年龄；
- outbox：`PENDING/FAILED/DEAD_LETTER` 的数量和最老事件年龄；
- 失败码：签名失败、时间窗失败、payload hash 失败、sequence gap、父对象映射缺失；
- worker 最近心跳、最后成功批次、每分钟吞吐和连续失败次数；
- reconciliation 最近状态、双方 count、mismatch_count、fingerprint；
- 业务指标：Flight/AWB/Truck 映射缺失，前置仓/TAS 件数不平，卡车节点停滞；
- 任何 `PENDING_APPROVAL/UNKNOWN/BLOCKED` 被尝试作为正式 SLA 或生产 Gate 的行为。

建议告警阈值：

| 情况 | 级别 | 动作 |
|---|---|---|
| 单事件瞬时失败且下次重试成功 | Info | 保留投递记录 |
| 同 aggregate 连续 3 次失败或 pending 超 10 分钟 | Warning | 暂停该 aggregate，检查父映射和 sequence |
| 签名失败、hash 不一致、时钟漂移 | Critical | 停止该来源接收，检查密钥、代理和系统时钟 |
| scoped reconciliation mismatch | Critical | 停止扩大批次，按对象比对，不做全局覆盖 |
| global mismatch 但所有新批次 scoped matched | Warning | 治理历史基线；新批次可保持隔离运行 |

## 6. 故障处理

### `EVENT_SEQUENCE_GAP`

1. 查同一 aggregate 的已应用最大 sequence；
2. 找到缺失的最小 sequence；
3. 先补发缺失事件，再按序重放后续事件；
4. 禁止把后续事件直接标成成功或手工改大 checkpoint。

### `SHIPMENT_LINK_NOT_FOUND` / `TRANSPORT_JOB_LINK_NOT_FOUND`

1. 确认 Flight/AWB/Truck 基线事件已发送并 `APPLIED`；
2. 确认 external object link 的 natural key/ID 与事件 payload 一致；
3. 补导父对象基线；
4. 只重放该 Shipment 或 TransportJob 的子事件；
5. 做 scoped reconciliation。

### 签名或时间窗失败

1. 比对两边密钥版本，不在日志中输出密钥；
2. 检查 NTP/系统时间；
3. 确认代理没有改写 raw body；
4. 密钥疑似泄漏时先停 worker、轮换密钥，再恢复。

### reconciliation mismatch

1. 先比较对象数量，再比较每类 fingerprint；
2. 缩小到 object IDs；
3. 以权威系统重发基线或缺失事件，不做整表覆盖；
4. 确认 scoped `MATCHED` 后恢复该批次；
5. 全局 mismatch 在历史数据未完成纳管时允许保持告警，但不得伪装为绿色。

## 7. 回滚

- 先停同步 worker，不删除 inbox/outbox；
- 两边 API 保持只读查询和审计可用；
- 若业务版本回滚，不回滚已经应用的数据库迁移；使用向前兼容修复迁移；
- 已发送事件不可删除或改写，补偿应生成新事件并引用原 `causation_id`；
- 恢复前按 aggregate 做重放和 scoped reconciliation。

## 8. 本地测试数据注意事项

当前共享本地数据库包含多轮故障注入夹具。它们会故意产生父对象缺失和 sequence gap，因此全局 count/fingerprint 不一致；这不能作为生产初始数据库。当前验证批次已通过 scoped reconciliation，历史失败保留为审计证据。

不要直接删除这些记录。若需要干净演示环境，应新建数据库、完整应用迁移、重新导入一组正常和一组异常数据，然后验证：

1. 两边 inbox/outbox 没有非预期 pending/failed；
2. 当前批次 scoped reconciliation 为 `MATCHED`；
3. 全量纳管完成后 global reconciliation 为 `MATCHED`；
4. 前置仓、21 卡车节点、双边口岸、TAS 和 OCC 页面均能回溯到底层事件。
