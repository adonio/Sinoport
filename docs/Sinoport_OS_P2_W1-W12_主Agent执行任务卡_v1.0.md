# Sinoport OS P2 W1-W12 主 Agent 执行任务卡 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：主 agent 已装载并冻结
- 更新时间：`2026-04-17`
- 适用范围：`P2 未来 12 周执行计划`

## 2. 主 Agent 运行规则

- 主 agent 一次性装载 `W1-W12` 全部任务卡
- 每个周任务卡由独立子 agent 负责细化
- 子 agent 输出必须包含：
  - 周次
  - 周目标
  - 范围
  - 输入
  - 输出
  - 核心任务
  - 依赖
  - 风险
  - 验收标准
  - 测试/校验
  - 移交物
- 主 agent 负责统一验收、归并、去重和口径冻结

## 3. 周任务总览

| 周次 | 主题 | 当前状态 | 子 Agent |
| --- | --- | --- | --- |
| W1 | 多站点模板化：模板边界与复制包冻结 | `Accepted` | `Banach` |
| W2 | 多站点模板化：站点复制流程与验收链 | `Accepted` | `Hilbert` |
| W3 | 真实数据导入二期：航班/AWB 导入建模 | `Accepted` | `Hypatia` |
| W4 | 真实数据导入二期：幂等/错误报告/重试 | `Accepted` | `Goodall` |
| W5 | 报表稳定化：平台日报/站点日报 | `Accepted` | `Anscombe` |
| W6 | 报表稳定化：异常日报/进出港 SLA | `Accepted` | `Bacon` |
| W7 | 报表性能：聚合优化与查询治理 | `Accepted` | `Dewey` |
| W8 | 报表性能：缓存/回归/口径冻结 | `Accepted` | `Pauli` |
| W9 | Agent 产品化：上下文与工具增强 | `Accepted` | `Locke` |
| W10 | Agent 产品化：场景验证与边界收口 | `Accepted` | `Gauss` |
| W11 | 运维治理：发布/备份/告警/成本 | `Accepted` | `Avicenna` |
| W12 | 季度收口：全链路回归与复盘计划 | `Accepted` | `Maxwell` |

## 4. 任务卡

### W1

- 状态：`Accepted`
- 子 Agent：`Banach`
- 周目标：冻结多站点复制模板包边界，把“必填统一项 / 可覆盖项 / 禁止入模板项”定成单一版本。
- 关键输出：模板包边界说明、字段清单、冲突规则、W1 验收清单、冻结说明。
- 核心任务：
  - 对齐 `copy-package`、`stationGovernanceComparison`、`stationAcceptanceRecordTemplate` 三条链路的字段口径。
  - 以 `MME` 为样板站、`RZE` 为对比站，冻结模板复制最小单元。
  - 明确哪些字段允许覆盖，哪些字段只能站点本地维护。
- 依赖：`Sinoport_OS_多站点复制模板包_v1.0.md`、`Sinoport_OS_站点接入SOP_v1.0.md`、平台 API 与站点治理对比页。
- 风险：字段语义漂移、模板范围过大导致后续复制失控。
- 验收标准：模板包边界和冲突规则可直接被 W2 的复制流程和验收链复用，不再出现第二套口径。
- 测试/校验：人工对照字段清单、治理对比输出和验收模板。
- 移交物：模板边界冻结说明、字段矩阵、冲突规则列表。

### W2

- 状态：`Accepted`
- 子 Agent：`Hilbert`
- 周目标：把 W1 的模板边界转成可执行的站点复制流程和验收链。
- 关键输出：站点复制任务卡、验收链任务卡、校验清单、回滚语义说明。
- 核心任务：
  - 串起 `copy-package`、`onboarding-playbook`、`governance-comparison`、`acceptance-record-template`。
  - 冻结 `Accepted / Refine / Blocked` 三态和 `rollbackRequired / rollbackScope / evidenceRef` 字段。
  - 明确 warning 与 blocked 的处置边界。
- 依赖：W1 模板边界、`station-governance.ts`、`/api/v1/station/*`、平台站点治理页面。
- 风险：治理对比和验收模板 schema 漂移，站点主数据不完整。
- 验收标准：复制、治理对比、验收记录三者使用同一字段集和同一状态语义。
- 测试/校验：端到端走一次样板复制到验收记录的干跑链路。
- 移交物：执行版复制流程、验收链说明、回滚规则。

### W3

- 状态：`Accepted`
- 子 Agent：`Hypatia`
- 周目标：冻结 `MME inbound bundle` 的真实导入对象模型，明确 `Flight / AWB / Shipment / Task / Audit / ImportRequest` 的边界。
- 关键输出：对象模型说明、字段映射表、样板边界清单、导入前置清单、W3 验收基线。
- 核心任务：
  - 区分业务主键与导入幂等键。
  - 对齐 `/station/inbound/flights`、`/station/inbound/waybills`、`/station/shipments`、`/platform/audit` 的读模型。
  - 冻结 `mme-inbound-bundle` 的层级与命名。
- 依赖：`station-bundle-import.ts`、`mme-inbound-bundle` fixture、回放和数据质量脚本。
- 风险：把展示字段当主键、shipment/task 层级不清、样本命名漂移。
- 验收标准：对象模型能直接支撑 W4 的幂等、失败重试和错误回放，不需要再回头改主键口径。
- 测试/校验：对照 fixture、导入脚本和现有读接口做字段核对。
- 移交物：对象模型规范、字段映射表、前置依赖清单。

### W4

- 状态：`Accepted`
- 子 Agent：`Goodall`
- 周目标：把 `MME inbound bundle` 导入链补到可运行的幂等、错误报告和重试口径。
- 关键输出：错误分类、重试矩阵、`import_requests` 查询面、回归覆盖清单、导入链文档更新项。
- 核心任务：
  - 冻结 `VALIDATION_ERROR`、`IMPORT_IN_PROGRESS`、可重试错误和人工处理错误的分类。
  - 保证失败上下文完整写入 `import_requests`。
  - 形成成功、重复、并发、校验失败、失败后重试五类回归场景。
- 依赖：W3 对象模型、`0014_add_import_request_ledger.sql`、导入回放与错误校验脚本。
- 风险：幂等键与并发语义不一致，失败后没有可追溯上下文。
- 验收标准：重复成功返回 `replayed`，并发重复返回 `409 IMPORT_IN_PROGRESS`，失败重试至少能完成一条正向链路。
- 测试/校验：导入回放、错误校验、失败后重试验证。
- 移交物：错误码矩阵、重试说明、导入链 SOP 更新点。

### W5

- 状态：`Accepted`
- 子 Agent：`Anscombe`
- 正式冻结文档：[Sinoport_OS_W5_平台日报与站点日报正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W5_平台日报与站点日报正式冻结文档_v1.0.md)
- 周目标：稳定平台日报和站点日报，把报表默认展示、命名和接口契约冻结下来。
- 关键输出：日报接口契约、默认展示规则、回归断言、验收清单。
- 核心任务：
  - 稳定 `/platform/reports`、`/station/reports` 及对应 daily 接口。
  - 去掉 `reportsUsingMock`、`stationReportsUsingMock` 作为默认依赖。
  - 冻结报表卡片、质量摘要、检查清单、刷新策略和 traceability 口径。
- 依赖：平台/站点报表页面、`platform.js`、`station.js`、`station.ts`、现有 smoke 与 integration 脚本。
- 风险：平台报表与站点报表命名或排序漂移，页面继续依赖 mock 回退。
- 验收标准：平台日报和站点日报按同一结构稳定展示，默认读真实接口，不再默认走 mock。
- 测试/校验：日报页面 smoke、对应 API 集成回归。
- 移交物：日报契约冻结稿、断言清单、验收说明。

### W6

- 状态：`Accepted`
- 子 Agent：`Bacon`
- 正式冻结文档：[Sinoport_OS_W6_异常日报与进出港SLA正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W6_异常日报与进出港SLA正式冻结文档_v1.0.md)
- 周目标：冻结异常日报和进出港 SLA 口径，打通报表、详情和列表的 drill-back 关系。
- 关键输出：异常报表 schema、进出港 SLA schema、drill-back 关系、验收清单。
- 核心任务：
  - 统一异常类型、责任人、SLA、状态语义。
  - 定义 inbound/outbound SLA 的开始、结束、告警和阻断阈值。
  - 把报表项稳定映射回 exception、flight、AWB。
- 依赖：异常/报表/进港/出港页面、M8 规划文档、数据质量治理文档。
- 风险：列表、详情、报表三处状态不一致，缺失时间戳导致 SLA 失真。
- 验收标准：同一对象在列表、详情、报表中的状态一致，报表项可以 drill back 到真实对象。
- 测试/校验：正常、告警、超时三类样本场景复现。
- 移交物：异常日报与 SLA 冻结说明、映射规则、验收口径。

### W7

- 状态：`Accepted`
- 子 Agent：`Dewey`
- 周目标：收敛报表和数据质量查询热点，形成可复用的聚合与查询治理规则。
- 关键输出：热点基线、聚合 helper 方案、查询治理规则、索引或视图建议、性能对比。
- 核心任务：
  - 识别 `tasks`、`exceptions`、`documents`、`loading_plans`、`audit_events`、`data_quality_issues` 的热点扫描。
  - 统一平台和站点日聚合逻辑。
  - 避免在热路径上使用 `DATE(COALESCE(...))` 一类低效过滤。
- 依赖：站点与平台报表接口、`data-quality.ts`。
- 风险：优化时破坏字段契约，或者只提升样本性能但未真正减扫表。
- 验收标准：核心报表接口在当前样本规模下稳定低于 3 秒，字段契约不漂移。
- 测试/校验：报表接口 explain/基线对比、daily/overview 回归。
- 移交物：查询治理规则、性能对比记录、索引或视图建议。
- 正式冻结文档：[Sinoport_OS_W7_报表查询治理与聚合优化正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W7_报表查询治理与聚合优化正式冻结文档_v1.0.md)

### W8

- 状态：`Accepted`
- 子 Agent：`Pauli`
- 正式冻结文档：[Sinoport_OS_W8_报表缓存边界与回归口径正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W8_报表缓存边界与回归口径正式冻结文档_v1.0.md)
- 周目标：冻结报表缓存边界、回归断言和指标命名，避免后续报表层继续漂移。
- 关键输出：缓存边界规范、指标冻结清单、回归脚本补丁项、性能基线、W8 验收说明。
- 核心任务：
  - 以 `reportDate + stationId + reportType` 冻结缓存 key 边界。
  - 固定字段顺序、空态、anchor、refreshPolicy、traceability。
  - 扩展 daily、overview、comparison、shift 的回归断言。
- 依赖：平台/站点报表页面和 daily/overview 接口、现有 smoke/integration 脚本。
- 风险：缓存失效规则不清，重复读取结果不稳定，指标命名继续漂移。
- 验收标准：相同 key 的重复读取结果稳定，报表名称、顺序和空态不再变化。
- 测试/校验：integration + smoke + 请求次数基线对比。
- 移交物：缓存规范、指标冻结清单、回归补丁清单。

### W9

- 状态：`Accepted`
- 子 Agent：`Locke`
- 周目标：把 `agent-worker` 从“可验证”收口成“可产品化”的 Station Copilot 运行时。
- 关键输出：最小上下文契约、系统提示模板分层、工具目录契约、产品化 smoke 清单。
- 正式冻结文档：[Sinoport_OS_W9_Station_Copilot运行时正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W9_Station_Copilot运行时正式冻结文档_v1.0.md)
- 核心任务：
  - 冻结最小上下文注入：`user_id`、`tenant_id`、`station_id`、`role_ids`、`resource_type`、`resource_id`。
  - 把系统提示拆成基础 prompt + 场景 prompt。
  - 补齐工具目录的类别、读写属性、角色范围和可见性说明。
  - 统一 `sessions / context / messages / runs / events` 的链路语义和错误码。
- 依赖：`apps/agent-worker`、`packages/tools`、`packages/workflows`、现有 Agent smoke。
- 风险：上下文注入过多、工具目录与执行器不同步、错误语义不稳定。
- 验收标准：上下文最小化、未授权工具不可见、会话与工具执行可全链路回读。
- 测试/校验：`test:agent:smoke`、`test:smoke:api`、`test:integration:api`、四类对象会话回放。
- 移交物：产品化任务卡、上下文契约、工具目录说明、系统提示模板说明。

### W10

- 状态：`Accepted`
- 子 Agent：`Gauss`
- 周目标：在 `MME` 范围内做 Station Copilot 的最小生产验证，只允许只读和 advisory 边界。
- 关键输出：生产场景验证清单、价值指标、边界冻结结论、问题列表、SOP 更新点。
- 核心任务：
  - 只覆盖 `Station / Flight / OutboundFlight / AWB / Shipment / Exception / Document` 的固定样本对象。
  - 只允许 `get_flight_context`、`get_outbound_flight_context`、`get_outbound_waybill_context`、`get_station_shipment_context`、`get_station_exception_context`、`get_station_document_context`、`list_blocking_documents`、`list_open_exceptions`、`get_object_audit`。
  - 明确排除 `request_task_assignment` 和任何写操作。
  - 统计有效会话、采用率、节省的查询与跳转成本。
- 依赖：M10 SOP、Copilot 页面、Agent API、`test-agent-smoke.mjs`、`validate-m10-copilot.mjs`、`evaluate-m10-copilot-value.mjs`。
- 风险：工具白名单外泄、验证口径偏离固定样本、价值指标不可复现。
- 验收标准：只读边界稳定、禁止项不可见、三类 Agent 校验脚本通过，且至少形成 5 个有效会话和明确采用率结论。
- 测试/校验：`test:agent:smoke`、`test:validate:m10`、`test:evaluate:m10`。
- 移交物：验证记录、价值评估、边界冻结说明、问题清单。
- 正式冻结文档：[Sinoport_OS_W10_Station_Copilot最小生产验证正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W10_Station_Copilot最小生产验证正式冻结文档_v1.0.md)

### W11

- 状态：`Accepted`
- 子 Agent：`Avicenna`
- 正式冻结文档：[Sinoport_OS_W11_发布备份告警成本正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W11_发布备份告警成本正式冻结文档_v1.0.md)
- 周目标：把发布、备份、告警和成本收口成一套可执行的运维治理包。
- 关键输出：发布检查表、回滚检查表、D1/R2 备份恢复 Runbook、告警分类口径、成本台账模板。
- 核心任务：
  - 把 `release_ref`、`staging_validation_ack`、`healthz` 版本校验和 smoke 校验串成统一发布门禁。
  - 明确 Pages、Workers、D1 的最小回滚步骤。
  - 固定 D1 导出、关键对象抽样下载、恢复后校验的 Runbook。
  - 基于现有 `alertRows` 明确阻断、警戒、待处理三类语义。
- 依赖：`release.yml`、`health.ts`、`apps/api-worker` scheduled 入口、平台与站点告警输出、Cloudflare 资源权限。
- 风险：只写文档不做演练、告警语义不分层、恢复链缺 R2。
- 验收标准：能按同一套口径完成一次发布说明、一次恢复验证，并把告警和成本归因落到具体资源与动作。
- 测试/校验：`GET /api/v1/healthz`、`GET /api/v1/agent/tools`、`GET /api/v1/platform/audit/events`、一次 smoke、一次 D1 导出恢复验证。
- 移交物：发布/回滚检查表、备份恢复 Runbook、告警处置说明、成本台账模板、演练记录。

### W12

- 状态：`Accepted`
- 子 Agent：`Maxwell`
- 周目标：完成季度收口，对平台、站点、移动端、导入、报表、审计、Agent 做一次全链路回归，并冻结复盘与下一年度移交包。
- 关键输出：回归矩阵、复盘纪要、问题回收列表、月度验收记录、下一年度移交说明。
- 核心任务：
  - 建立平台、站点、移动端、导入、报表、审计、Agent 七类回归矩阵。
  - 用真实对象链跑通 inbound、outbound、documents、tasks、exceptions、reports、audit、copilot、station governance。
  - 汇总问题、退化和口径偏差，沉淀为单一问题回收列表。
  - 根据年度事实盘点和下一年度待办，冻结保留、收缩、暂停项。
- 依赖：现有回归脚本、M12 冻结文档、本地 D1 迁移和样本数据。
- 风险：demo fallback 掩盖真实问题，脚本断言和样本对象漂移，复盘过程中扩写新范围。
- 验收标准：全链路回归有明确结论，关键测试全部通过或有可复现原因，复盘与移交件全部冻结。
- 测试/校验：`typecheck`、前端 build、API integration、frontend smoke、agent smoke、M9/M10/data-quality/inbound 回放与校验脚本。
- 移交物：`Sinoport_OS_P2_W12_回归矩阵_v1.0.md`、`Sinoport_OS_P2_W12_复盘纪要_v1.0.md`、`Sinoport_OS_P2_W12_问题回收列表_v1.0.md`、`Sinoport_OS_P2_W12_月度验收记录_v1.0.md`、下一年度执行说明。
- 正式冻结文档：[Sinoport_OS_W12_全链路回归与复盘移交正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W12_全链路回归与复盘移交正式冻结文档_v1.0.md)
