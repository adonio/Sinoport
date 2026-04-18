# Sinoport OS W9 Station Copilot 运行时正式冻结文档 v1.0

## 1. 文档信息与范围

- 任务编号：W9
- 任务主题：Agent 产品化，上下文与工具增强
- 冻结状态：正式冻结
- 适用范围：`apps/agent-worker` 的 Station Copilot 运行时、`packages/tools` 的工具目录、`packages/workflows` 的工作流目录、现有 Agent smoke / validate / evaluate 脚本
- 冻结目标：基于当前仓库事实，固定 Station Copilot 的最小上下文、系统提示分层、工具目录边界、会话链路语义和 smoke 验收线
- 事实源：
  - [apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:38) 的认证、`buildSystemPrompt`、工具过滤、`/api/v1/agent/sessions`、`/api/v1/agent/sessions/:sessionId/context`、`/api/v1/agent/sessions/:sessionId/plan`、`/api/v1/agent/sessions/:sessionId/messages`、`/api/v1/agent/sessions/:sessionId/events`、`/api/v1/agent/tools/:toolName/execute`
  - [packages/tools/src/index.ts](/Users/lijun/Downloads/Sinoport/packages/tools/src/index.ts:9) 的当前工具目录、`requiredRoles`、可见性过滤
  - [packages/workflows/src/index.ts](/Users/lijun/Downloads/Sinoport/packages/workflows/src/index.ts:7) 的工作流目录边界
  - [scripts/test-agent-smoke.mjs](/Users/lijun/Downloads/Sinoport/scripts/test-agent-smoke.mjs:1)
  - [scripts/validate-m10-copilot.mjs](/Users/lijun/Downloads/Sinoport/scripts/validate-m10-copilot.mjs:1)
  - [scripts/evaluate-m10-copilot-value.mjs](/Users/lijun/Downloads/Sinoport/scripts/evaluate-m10-copilot-value.mjs:1)
  - [主任务卡 W9](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md:179)

说明：

- 本文只冻结当前仓库可见事实和建议验收口径，不虚构独立 prompt 模板文件、队列编排层或额外的 Agent 基础设施。
- 文中的“冻结建议”表示希望以后保持的契约口径；“当前已存在”表示代码里已经能直接读到的运行时行为。

## 2. 当前已存在的 Agent 运行时能力

### 2.1 认证边界

当前 `agent-worker` 只在 `/api/v1/*` 下做认证拦截，`/api/v1/healthz` 例外可直接访问。认证路径有两种：

- 正常路径：读取 `Authorization: Bearer ...`，通过 `resolveAuthTokenSecret` + `verifyAuthToken` 校验，再由 `buildActorFromClaims` 生成 actor。
- 本地调试路径：当本地调试开关开启且存在 debug headers 时，直接由 `buildActorFromHeaders` 生成 actor；`demo-token` 只在本地调试模式下放行。

当前 actor 事实字段来自 `@sinoport/auth`：

- `userId`
- `roleIds`
- `stationScope`
- `tenantId`
- `clientSource`

这些字段的来源在当前仓库里是明确的：claims 路径来自 token claims，debug 路径来自 `X-Debug-*` 和 `X-Client-Source` 头部。[apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:58) 与 [packages/auth/src/index.ts](/Users/lijun/Downloads/Sinoport/packages/auth/src/index.ts:63)

### 2.2 `/api/v1/agent/tools`

当前 `GET /api/v1/agent/tools` 返回的是 `listCopilotValidationTools(c.var.actor.roleIds)`，也就是先按角色做目录过滤，再额外剔除 M10 denylist 中的 `request_task_assignment`。[apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:38)

当前实际暴露的工具目录以 `packages/tools` 为准：

- `get_flight_context`
- `list_blocking_documents`
- `list_open_exceptions`
- `get_object_audit`
- `get_outbound_flight_context`
- `get_outbound_waybill_context`
- `get_station_shipment_context`
- `get_station_exception_context`
- `get_station_document_context`

`request_task_assignment` 仍存在于工具目录定义里，但当前不应出现在 `/api/v1/agent/tools` 的可见列表中。[packages/tools/src/index.ts](/Users/lijun/Downloads/Sinoport/packages/tools/src/index.ts:9)

### 2.3 `/api/v1/agent/workflows`

当前 `GET /api/v1/agent/workflows` 直接返回 `listWorkflowsForStationContext()`，没有再按角色二次过滤。[apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:899)

当前工作流目录只有三项：

- `document-parse`
- `document-validate`
- `station-summary-refresh`

其中 `document-parse` 和 `document-validate` 是 Document 场景下的推荐工作流；`station-summary-refresh` 仅作为目录事实存在，不代表 agent-worker 内部有执行编排层。[packages/workflows/src/index.ts](/Users/lijun/Downloads/Sinoport/packages/workflows/src/index.ts:7)

### 2.4 `/api/v1/agent/sessions`

当前 `POST /api/v1/agent/sessions` 会新建 `agent_sessions` 记录，写入：

- `session_id`
- `station_id`
- `actor_id`
- `object_type`
- `object_key`
- `status`
- `summary`
- `created_at`
- `updated_at`

当前 `GET /api/v1/agent/sessions` 只读返回当前 actor、当前 station 下最近 30 条会话，字段只包括 `session_id`、`object_type`、`object_key`、`status`、`summary`、`created_at`、`updated_at`。[apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:905)

### 2.5 `/:id/context`

当前 `GET /api/v1/agent/sessions/:sessionId/context` 只读返回：

- `session_id`
- `actor`
- `focus`
- `focus_context`
- `available_tools`
- `available_workflows`
- `recommended_workflows`
- `recommended_actions`
- `system_prompt`

Document 场景下会额外读出 `focus_context`，其他对象类型当前返回 `null`。[apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:1037)

### 2.6 `/:id/plan`

当前 `GET /api/v1/agent/sessions/:sessionId/plan` 只读返回：

- `session_id`
- `recommended_tools`
- `recommended_workflows`
- `recommended_actions`
- `steps`

其中 `steps` 来自 `buildPlanSteps`，属于当前运行时内联规则，不依赖独立 prompt 模板文件。[apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:1068)

### 2.7 `/:id/messages`

当前 `POST /api/v1/agent/sessions/:sessionId/messages` 会：

- 校验 `message` 非空
- 校验 session 存在
- 先写入一条 user 消息
- 再生成 assistant 回复
- 再写入一条 assistant 消息
- 最后回写 session 的 `object_type`、`object_key` 和 `updated_at`

返回值包含 `session_id`、`assistant_message`、`used_tool`、`tool_result`。[apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:1086)

### 2.8 `/:id/events`

当前 `GET /api/v1/agent/sessions/:sessionId/events` 只读返回两组事件流：

- `messages`
- `runs`

其中 messages 用 `message_id AS id`，runs 用 `run_id AS id` 聚合；这是事件视图，不是新增独立持久化模型。[apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:1144)

### 2.9 `tool execute`

当前 `POST /api/v1/agent/tools/:toolName/execute` 是正式工具执行入口。它会：

- 先做角色校验 `ensureRole`
- 再进入对应工具实现
- 如果 body 里带 `session_id`，就额外写一条 run 记录
- 若 `FORBIDDEN_TOOL`，统一返回 403

其中 `request_task_assignment` 虽然在目录里定义，但在当前 W9 冻结口径下应视为可见性外工具，不进入可见工具列表。[apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:1183)

## 3. 建议冻结的最小上下文契约

### 3.1 冻结目标

冻结的最小上下文只保留能稳定驱动 Station Copilot 的字段，不扩成“全对象快照”。建议固定为：

- `user_id`
- `tenant_id`
- `station_id`
- `role_ids`
- `object_type`
- `object_key`
- `client_source`

### 3.2 字段来源约定

| 字段 | 当前来源 | 冻结口径 |
| --- | --- | --- |
| `user_id` | actor | 来自 token claims 或 debug headers；session 记录中的 `actor_id` 只作为持久化映射，不替代 actor 本身 |
| `tenant_id` | actor | 来自 token claims 或 debug headers；当前 `agent_sessions` 不直接存这个字段 |
| `station_id` | actor | 当前由 `actor.stationScope[0]` 作为会话和工具的默认站点，不从 query/body 直接取值 |
| `role_ids` | actor | 来自 token claims 或 debug headers |
| `client_source` | actor | 来自 token claims 或 `X-Client-Source`；当前系统提示会直接显示这个值 |
| `object_type` | body / query / session | `POST /sessions` 来自 body，`GET /context` 和 `GET /plan` 来自 query，`POST /messages` 来自 body 或 `focus`，并回写到 session |
| `object_key` | body / query / session | 与 `object_type` 同源；`POST /messages` 会回写到 session |

### 3.3 冻结规则

- `station_id` 以 actor 为唯一上游，不允许由前端另传后覆盖当前站点边界。
- `object_type`、`object_key` 可以在会话内更新，但更新仅限于本次消息对应的焦点，不应扩展出更多上下文字段。
- `summary` 不是自动摘要字段；当前仅在创建 session 时从 body.summary 写入，后续不由 agent-worker 自动生成。
- `session_id` 由服务端生成，格式当前是 `SES-XXXXXXXX`，不接受客户端指定。

## 4. 建议冻结的系统提示分层

### 4.1 当前实现事实

当前仓库没有独立的 prompt 模板文件。系统提示是 `buildSystemPrompt(actor, objectType, objectKey)` 在 `agent-worker` 内联拼接出来的。[apps/agent-worker/src/index.ts](/Users/lijun/Downloads/Sinoport/apps/agent-worker/src/index.ts:113)

当前系统提示包含的固定信息是：

- `You are the Sinoport station copilot.`
- `Current client source`
- `Current tenant`
- `Current stations`
- `Current roles`
- `Current object focus` 或 `station-wide view`
- Document 场景下追加 `document-parse, document-validate`
- `Use only the available tools and stay within the actor station scope and role scope.`
- `Escalate when a release gate is blocking the main workflow or when evidence is missing.`

### 4.2 冻结分层

建议把系统提示固定为两层：

- Base prompt：站点 Copilot 的身份、角色边界、站点边界、升级规则。
- Object-specific prompt：由 `object_type` 选择的场景语义，当前只在 Document 场景下显式加上文档工作流提示。

### 4.3 分层边界

- Base prompt 不承载具体对象的业务步骤，不写对象专属检查清单。
- Object-specific prompt 只承载当前对象类型需要的最小动作提示。
- 不允许在文档里虚构一个仓库中不存在的外部 prompt 文件名、模板目录或编排服务。

## 5. 建议冻结的工具目录口径

### 5.1 当前实际暴露的工具

当前对外可见工具必须以 `packages/tools` 的目录为准，再叠加 `agent-worker` 的 M10 denylist。可见工具如下：

- `get_flight_context`
- `list_blocking_documents`
- `list_open_exceptions`
- `get_object_audit`
- `get_outbound_flight_context`
- `get_outbound_waybill_context`
- `get_station_shipment_context`
- `get_station_exception_context`
- `get_station_document_context`

### 5.2 denylist / write action 边界

- `request_task_assignment` 继续保留在工具目录定义中，作为目录事实存在。
- `request_task_assignment` 在 `agent-worker` 的可见工具列表中必须不可见。
- `request_task_assignment` 在执行时仍然经过 `ensureRole`，但 W9 冻结口径下它属于 write action，默认不纳入 Station Copilot 产品化可见范围。
- 本周不放开任何写工具可见性，不把任务分配、状态回写、业务提交动作纳入 Copilot 工具面板。

### 5.3 `requiredRoles` / station scope 验收规则

- 工具可见性必须由 `roleIds` 决定，且执行时再次做 `requiredRoles` 校验。
- 工具执行必须受 actor station scope 约束，不能越站读取。
- 当前 station 作用域默认取 `actor.stationScope[0] || 'MME'`，这也是 session 表写入和文档上下文读取的事实来源。
- Document 场景的上下文和工具输出必须保持 `document-parse`、`document-validate` 的推荐关系，不得把它们解释成可执行队列编排已存在。

## 6. 建议冻结的会话链路语义

### 6.1 最小读写语义

- `sessions`：会话主记录，负责保存站点、actor、对象焦点、状态、摘要和时间戳。
- `messages`：会话消息流，记录用户输入、assistant 回复，以及 assistant 回复对应的 `tool_name`。
- `runs`：工具运行流，记录工具名、输入、输出、状态、错误信息和时间戳。
- `events`：`messages` + `runs` 的只读事件视图，用于回放和前端展示。

### 6.2 字段边界

当前运行记录字段边界应冻结为：

- `summary`：只存在于 session 级记录，当前仅在创建 session 时由请求体提供。
- `tool_name`：消息记录里表示 assistant 回复是由哪个工具驱动；run 记录里表示本次执行的工具名。
- `status`：run 当前只看到 `completed` / `failed`，session 当前创建后状态是 `active`。
- `error_message`：只在 run 级记录里承载错误摘要，不向 session 主记录回填错误语义。
- `input_json` / `output_json`：run 级原始输入输出，事件视图返回时会做 `parseAgentJson` 反序列化。

### 6.3 路由语义

- `POST /api/v1/agent/sessions`：创建 session。
- `GET /api/v1/agent/sessions/:sessionId`：回读 session、messages、runs。
- `GET /api/v1/agent/sessions/:sessionId/context`：回读上下文快照和系统提示。
- `GET /api/v1/agent/sessions/:sessionId/plan`：回读建议工具与步骤。
- `POST /api/v1/agent/sessions/:sessionId/messages`：写入一轮对话并触发一个最小 tool-assisted 回复。
- `GET /api/v1/agent/sessions/:sessionId/events`：回读事件流。

## 7. 当前 smoke / validate / evaluate 已覆盖的验收线

### 7.1 `scripts/test-agent-smoke.mjs`

当前 smoke 已覆盖的最低验收线：

- `GET /api/v1/agent/tools`
- `GET /api/v1/agent/workflows`
- `POST /api/v1/agent/tools/get_station_document_context/execute`
- `POST /api/v1/agent/sessions`
- `GET /api/v1/agent/sessions/:id/context`
- `GET /api/v1/agent/sessions/:id/plan`
- `POST /api/v1/agent/sessions/:id/messages`
- `GET /api/v1/agent/sessions/:id`
- `GET /api/v1/agent/sessions/:id/events`
- `POST /api/v1/agent/tools/get_flight_context/execute`
- `POST /api/v1/agent/tools/list_blocking_documents/execute`
- `POST /api/v1/agent/tools/list_open_exceptions/execute`
- `POST /api/v1/agent/tools/request_task_assignment/execute` 必须 403
- `GET /api/v1/agent/tools` 在缺少授权时必须 401

### 7.2 `scripts/validate-m10-copilot.mjs`

当前 validate 已覆盖的最低验收线：

- 工具目录里不能出现 `request_task_assignment`
- 会话 `context` / `plan` 里不能泄漏 `request_task_assignment`
- `POST /api/v1/agent/sessions/:id/messages` 必须返回 assistant 消息
- `GET /api/v1/agent/sessions/:id` 和 `/events` 必须回读 messages / runs
- `get_object_audit` 必须可用
- `get_station_document_context` 缺少 `object_key` 必须 400
- `get_station_exception_context` 未命中必须 404
- `request_task_assignment` 执行必须 403
- 未授权访问 `/api/v1/agent/tools` 必须 401

### 7.3 `scripts/evaluate-m10-copilot-value.mjs`

当前 evaluate 已覆盖的最低验收线：

- 至少 5 个有效会话
- 至少 3 个 adopted 会话
- 采用率至少 60%
- 每个场景至少减少 1 次 page jump
- 输出 copilot 与 manual 的时间、页跳转和 query 减量

说明：这里仅冻结脚本已经覆盖的验收线，不扩展新的 W10 场景矩阵，也不把价值评估口径进一步外推到未定义对象集。

## 8. 非目标

- 本周不做价值评估扩展，不增加新的 adoption 场景，也不扩大 `evaluate-m10-copilot-value.mjs` 的对象矩阵。
- 本周不放开写工具，不把 `request_task_assignment` 重新暴露到 Station Copilot 工具面板。
- 本周不改前端 Copilot 页结构，不以本冻结文档为理由改页面布局或导航结构。
- 本文不引入不存在的 OpenAI 编排层、队列层、prompt 模板文件或额外 agent runtime。

## 9. 风险与回滚

### 9.1 风险

- 当前上下文仍是内联构造，一旦后续把字段继续加宽，最小契约会被稀释。
- 当前 station scope 使用 `actor.stationScope[0]` 作为默认站点，如果上游 auth 语义变化，Copilot 的站点边界会跟着漂移。
- 当前工具可见性依赖 `requiredRoles` + denylist 双层过滤，若未来只改其一，可能出现“目录存在但面板可见性不一致”。
- 当前会话语义里 `summary` 不自动生成，若前端或上游误以为它是机器摘要，会造成回读歧义。

### 9.2 回滚

- 若后续 runtime 或工具目录发生变化，应以新版本冻结文档覆盖本文，不要继续沿用旧口径。
- 若需要回滚运行时行为，回滚范围应同时覆盖 `apps/agent-worker`、`packages/tools`、`packages/workflows` 和 `packages/auth` 的同一变更组，不要只回滚文档。
- 若只需要撤回产品化冻结结论，优先更新本文件和主任务卡中的交叉引用即可。

## 10. 对 W10 的明确移交输入

- W10 应直接继承本文冻结的最小上下文，不要再新增 `user_id` / `tenant_id` / `station_id` / `role_ids` 之外的上下文字段。
- W10 的验证只应在本文列出的工具可见性和会话语义上做场景确认，不应新增写工具或扩展为新编排层验证。
- W10 应把 `test-agent-smoke.mjs`、`validate-m10-copilot.mjs`、`evaluate-m10-copilot-value.mjs` 视为现有验收线，而不是重新发明一套口径。
- W10 若要引入新场景，必须先更新本文和主任务卡，不能绕开冻结文档直接改验收定义。
