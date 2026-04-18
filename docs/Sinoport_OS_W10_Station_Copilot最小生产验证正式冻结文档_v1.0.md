# Sinoport OS W10 Station Copilot 最小生产验证正式冻结文档 v1.0

## 1. 文档信息与范围

- 任务编号：W10
- 任务主题：Agent 产品化，场景验证与边界收口
- 冻结状态：正式冻结
- 适用范围：`apps/agent-worker` 的 Station Copilot 运行时、`packages/tools` 的工具目录、`scripts/test-agent-smoke.mjs`、`scripts/validate-m10-copilot.mjs`、`scripts/evaluate-m10-copilot-value.mjs`
- 冻结目标：基于当前仓库事实，固定 MME 范围内 Station Copilot 的最小生产验证边界、样本对象、只读工具白名单、失败语义与价值评估口径
- 事实源：
  - [scripts/test-agent-smoke.mjs](/Users/lijun/Downloads/Sinoport/scripts/test-agent-smoke.mjs:1)
  - [scripts/validate-m10-copilot.mjs](/Users/lijun/Downloads/Sinoport/scripts/validate-m10-copilot.mjs:1)
  - [scripts/evaluate-m10-copilot-value.mjs](/Users/lijun/Downloads/Sinoport/scripts/evaluate-m10-copilot-value.mjs:1)
  - [apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:38)
  - [packages/tools/src/index.ts](/Users/lijun/Downloads/Sinoport/packages/tools/src/index.ts:9)
  - [Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md:197)
  - [Sinoport_OS_W9_Station_Copilot运行时正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W9_Station_Copilot运行时正式冻结文档_v1.0.md:1)

说明：

- 本文只冻结当前仓库可直接读到的运行时事实和验收口径，不引入线上埋点、人工访谈、A/B 系统或额外生产监控假设。
- 本文区分“当前脚本已验证”的事实与“冻结建议/验收规则”的口径；后者是 W10 的正式收口边界，不等同于新增代码实现。

## 2. 当前已存在的验证脚本与职责

### 2.1 `scripts/test-agent-smoke.mjs`

当前 smoke 的职责是做最小链路冒烟验证，确认 Agent 运行时可起、会话可回读、工具可读、文档与 shipment 场景可跑通。脚本事实包含：

- 启动 `agent-worker` 本地服务
- 读取 `/api/v1/agent/tools`
- 创建 `Flight / SE803` 会话
- 读取 `context`、`plan`、`messages`、`events`
- 调用 `get_object_audit`
- 验证 400 / 404 / 403 / 401 的失败语义
- 验证 `request_task_assignment` 在 M10 中不可见且不可执行
- 验证 `Document / DOC-MANIFEST-SE913` 与 `Shipment / in-436-10358585` 的会话链路

### 2.2 `scripts/validate-m10-copilot.mjs`

当前 validate 的职责是验证 M10 最小生产边界是否被正确收口。脚本事实包含：

- `/api/v1/agent/tools` 中不得出现 `request_task_assignment`
- `context` 和 `plan` 中不得泄漏 `request_task_assignment`
- `Flight / SE803` 会话创建、消息、详情、事件可回读
- `get_object_audit` 可执行
- `get_station_document_context` 缺少 `object_key` 必须返回 400
- `get_station_exception_context` 未命中必须返回 404
- `request_task_assignment` 执行必须返回 403
- 缺少授权访问 `/api/v1/agent/tools` 必须返回 401

### 2.3 `scripts/evaluate-m10-copilot-value.mjs`

当前 evaluate 的职责是用固定场景集计算最小生产价值口径。脚本事实包含：

- 5 个固定场景
- 3 个场景标记为 `adopt: true`
- 统计 valid sessions、adopted sessions、adoption rate
- 统计 `pageJumpReduction` 与 `queryReduction`
- 统计 copilot 与 manual 的时间对比
- 断言至少 5 个有效会话、至少 3 个 adopted sessions、采用率至少 60%

## 3. 冻结的样本对象范围

### 3.1 冻结原则

- 冻结样本对象只写脚本已经明确使用的对象键，不扩样本、不补新键、不新增对象矩阵。
- `Station` 只作为站点边界存在，脚本事实是 `MME`，当前没有独立的 Station 对象键。

### 3.2 冻结样本清单

- `Station`：站点边界 `MME`，无单独对象键
- `Flight`：`SE803`
- `OutboundFlight`：`SE913`
- `AWB`：`436-10358585`
- `Shipment`：`in-436-10358585`
- `Exception`：`EXP-0408-001`
- `Document`：`DOC-MANIFEST-SE913`、`DOC-MANIFEST-SE803`

### 3.3 样本来源对应

- `Flight / SE803` 来自 smoke、validate、evaluate
- `OutboundFlight / SE913` 来自 evaluate
- `AWB / 436-10358585` 来自 smoke、evaluate
- `Shipment / in-436-10358585` 来自 smoke、validate
- `Exception / EXP-0408-001` 来自 evaluate
- `Document / DOC-MANIFEST-SE913` 来自 smoke、validate
- `Document / DOC-MANIFEST-SE803` 来自 evaluate

## 4. 冻结的只读工具白名单

### 4.1 冻结白名单

W10 只允许下列只读或 advisory 工具作为 Station Copilot 可见边界：

- `get_flight_context`
- `get_outbound_flight_context`
- `get_outbound_waybill_context`
- `get_station_shipment_context`
- `get_station_exception_context`
- `get_station_document_context`
- `list_blocking_documents`
- `list_open_exceptions`
- `get_object_audit`

### 4.2 当前事实与冻结口径

- 当前运行时在 `apps/agent-worker/src/index.ts` 中通过 `listCopilotValidationTools()` 过滤工具目录，并额外剔除 `request_task_assignment`
- 当前工具目录仍包含 `request_task_assignment`，但 W10 冻结口径要求它不进入可见白名单
- `get_object_audit` 已被 validate 与 smoke 作为只读回读工具使用
- `get_station_document_context`、`get_station_exception_context`、`get_station_shipment_context` 已被用于场景验证

## 5. 明确排除的工具和动作

- `request_task_assignment`
- 任何写操作
- 任何会修改业务对象状态、任务分配、回写流程、提交动作的工具或动作

冻结口径要求：

- 只读验证可以读对象、读审计、读异常、读文档、读运输链路
- 不允许把 `request_task_assignment` 重新暴露到 Copilot 工具面板
- 不允许通过 Copilot 运行时新增写动作白名单

## 6. 冻结的失败语义

### 6.1 401

- 表示缺少授权或授权不可用
- 当前脚本验证点：未授权访问 `/api/v1/agent/tools` 必须返回 401

### 6.2 403

- 表示当前 actor 无权执行该工具或该动作被 M10 明确禁止
- 当前脚本验证点：`request_task_assignment` 执行必须返回 403

### 6.3 404

- 表示对象不存在或未命中
- 当前脚本验证点：`get_station_exception_context` 的未知异常必须返回 404

### 6.4 400

- 表示请求参数缺失或校验失败
- 当前脚本验证点：`get_station_document_context` 缺少 `object_key` 必须返回 400

### 6.5 冻结规则

- 上述失败语义是 W10 的正式收口口径
- 其它错误码不作为 W10 的主验收语义
- 脚本已经覆盖的 401 / 403 / 404 / 400 应保持稳定，不应因 UI 或样本变更漂移

## 7. 冻结的价值评估口径

### 7.1 固定阈值

- 至少 5 个有效会话
- 至少 3 个 adopted sessions
- adoption rate >= 60%

### 7.2 指标定义

- `valid sessions`：脚本成功跑完的场景数
- `adopted sessions`：标记为采用 Copilot 方案并完成后续 follow-up 的场景数
- `adoption rate`：`adopted sessions / valid sessions`

### 7.3 `pageJumpReduction`

- 含义：手工路径需要的页面跳转次数减去 Copilot 路径的页面跳转次数
- 当前脚本定义：`manualPageJumps - copilotPageJumps`
- 用途：衡量 Copilot 是否减少从一个页面/视图切到另一个页面/视图的操作成本

### 7.4 `queryReduction`

- 含义：手工路径需要的查询次数减去 Copilot 侧一次集中查询的基线
- 当前脚本定义：`manualQueryCount - 1`
- 用途：衡量 Copilot 是否把分散的手工查询收束为一次聚焦式查询

### 7.5 当前脚本事实

- evaluate 当前一共 5 个场景
- 其中 3 个场景为 adopted
- 脚本要求每个场景至少减少 1 次 page jump
- 当前价值口径只基于脚本可直接算出的会话、页跳转和查询差值，不外推到不存在的线上监控或额外实验平台

## 8. 非目标

- 不扩展样本范围
- 不新增业务写动作
- 不改 Copilot UI 结构
- 不引入新的编排层、队列层或额外生产监控口径
- 不把 W10 验证升级为 W11 运维治理

## 9. 风险与回滚

### 9.1 风险

- 样本范围如果后续被扩展，会破坏 W10 的最小生产验证边界
- `request_task_assignment` 如果重新进入可见工具列表，会破坏只读边界
- 失败语义如果被改成其它状态码或吞错，会破坏脚本可复现性
- 价值评估如果脱离固定 5 场景，会失去可比性

### 9.2 回滚

- 若只需撤回 W10 冻结结论，优先回滚本文件与主任务卡里的交叉引用
- 若运行时行为需要回滚，必须连同 `apps/agent-worker` 与 `packages/tools` 的同一变更组一起处理
- 回滚时不要扩散到 W11 运维治理，避免把产品化边界和运维边界混在一起

## 10. 对 W11 的明确移交输入

- W11 只接收本文件已经冻结的样本对象、工具白名单、失败语义和价值评估口径作为前置事实
- W11 可以在此基础上定义运维治理、发布检查、回滚检查、备份恢复、告警分类和成本台账
- W11 不应再扩展样本对象集，也不应把 `request_task_assignment` 重新纳入 Copilot 可见面板
- W11 如需新的操作性检查，应建立在本文已冻结的只读边界之上，而不是重新定义 W10 的验收
