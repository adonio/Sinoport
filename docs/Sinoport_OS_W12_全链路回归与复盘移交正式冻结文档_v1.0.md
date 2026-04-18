# Sinoport OS W12 全链路回归与复盘移交正式冻结文档 v1.0

## 1. 文档信息与范围

- 文档版本：`v1.0`
- 文档状态：正式冻结
- 更新时间：`2026-04-17`
- 适用范围：`W12` 季度收口、全链路回归、复盘纪要、问题回收、月度验收记录和下一年度移交输入
- 事实来源：仅基于当前仓库已存在的 `package.json`、回归/验证脚本和既有月度/年度文档
- 约束：本文件只固定口径，不新增脚本，不重写验收范围，不扩写下一年度路线

## 2. 当前仓库已存在的回归脚本矩阵

### 2.1 根脚本事实

当前 `package.json` 已公开的、与季度收口直接相关的脚本只有这些：

- `test:integration:api`
- `test:frontend:smoke`
- `test:agent:smoke`
- `test:validate:m9`
- `test:validate:m10`
- `test:evaluate:m10`
- `test:evaluate:data-quality`
- `test:replay:inbound`
- `test:validate:inbound`
- `test:smoke:api`
- `typecheck`

补充事实：

- 仓库里没有单独的 `W12` 脚本入口。
- `dev:api`、`dev:agent`、`seed:demo:*` 属于开发/种子准备，不作为本次季度收口的冻结回归入口。

### 2.2 现有脚本覆盖矩阵

| 领域 | 当前已有脚本/文档事实 | 已覆盖的真实链路 |
| --- | --- | --- |
| `platform` | [`scripts/test-api-integration.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs)、[`scripts/validate-m9-station-governance.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-m9-station-governance.mjs)、[`scripts/evaluate-mme-data-quality.mjs`](/Users/lijun/Downloads/Sinoport/scripts/evaluate-mme-data-quality.mjs) | 站点/班组管理、平台日报、审计查询、数据质量规则与检查单 |
| `station` | [`scripts/test-api-integration.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs)、[`scripts/test-frontend-smoke.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-frontend-smoke.mjs)、[`scripts/validate-m9-station-governance.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-m9-station-governance.mjs)、[`scripts/validate-m10-copilot.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-m10-copilot.mjs) | 站点登录、站点资料、进出港航班、提单、单证、异常、报表、站点治理、Station Copilot |
| `mobile` | [`scripts/test-api-integration.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs)、[`scripts/test-frontend-smoke.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-frontend-smoke.mjs) | PDA 登录、进港/出港作业、扫描/收货/装载类页面与接口 |
| `import` | [`scripts/test-api-integration.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs)、[`scripts/replay-mme-inbound.mjs`](/Users/lijun/Downloads/Sinoport/scripts/replay-mme-inbound.mjs)、[`scripts/validate-mme-inbound-errors.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-mme-inbound-errors.mjs) | inbound bundle 导入、重放幂等、错误样本校验、导入后对象回读 |
| `reports` | [`scripts/test-api-integration.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs)、[`scripts/test-frontend-smoke.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-frontend-smoke.mjs) | 站点日报、平台日报、报表页展示与真实数据回读 |
| `audit` | [`scripts/test-api-integration.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs)、[`scripts/test-frontend-smoke.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-frontend-smoke.mjs)、[`scripts/validate-m9-station-governance.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-m9-station-governance.mjs) | 审计事件、审计日志、对象审计、治理回放审计 |
| `agent` | [`scripts/test-agent-smoke.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-agent-smoke.mjs)、[`scripts/validate-m10-copilot.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-m10-copilot.mjs)、[`scripts/evaluate-m10-copilot-value.mjs`](/Users/lijun/Downloads/Sinoport/scripts/evaluate-m10-copilot-value.mjs)、[`scripts/test-frontend-smoke.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-frontend-smoke.mjs) | Agent 工具白名单、会话上下文、计划、消息、事件、对象审计、采纳价值评估 |
| `governance` | [`scripts/validate-m9-station-governance.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-m9-station-governance.mjs) | 站点复制包、onboarding playbook、governance comparison、acceptance record template |
| `data quality` | [`scripts/evaluate-mme-data-quality.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-mme-inbound-errors.mjs) | 导入成功/失败样本、数据质量规则、评估、issues/checklist |

### 2.3 现有脚本事实摘要

- [`test-api-integration.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-api-integration.mjs)：覆盖 `station`、`platform`、`mobile`、`import`、`reports`、`audit` 的真实接口回归，包含登录、站点/班组 CRUD、进出港对象链、任务/异常、导入回放、移动端作业与审计回读。
- [`test-frontend-smoke.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-frontend-smoke.mjs)：覆盖前端页面的站点、平台、移动端、报表、任务、单证、Copilot、审计页面烟测。
- [`test-agent-smoke.mjs`](/Users/lijun/Downloads/Sinoport/scripts/test-agent-smoke.mjs)：覆盖 Agent 工具、工作流、会话、文档/货运对象上下文与隐藏写动作校验。
- [`validate-m9-station-governance.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-m9-station-governance.mjs)：覆盖站点治理模板、比较、验收模板和 inbound 重放幂等。
- [`validate-m10-copilot.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-m10-copilot.mjs)：覆盖 Station Copilot 只读边界、403/404/400/401 失败语义和工具隐藏。
- [`evaluate-m10-copilot-value.mjs`](/Users/lijun/Downloads/Sinoport/scripts/evaluate-m10-copilot-value.mjs)：覆盖采纳型价值评估，不是新功能验证。
- [`evaluate-mme-data-quality.mjs`](/Users/lijun/Downloads/Sinoport/scripts/evaluate-mme-data-quality.mjs)：覆盖 MME 数据质量规则、检查单和异常样本。
- [`replay-mme-inbound.mjs`](/Users/lijun/Downloads/Sinoport/scripts/replay-mme-inbound.mjs)：覆盖 inbound bundle 导入、重放和对象回读。
- [`validate-mme-inbound-errors.mjs`](/Users/lijun/Downloads/Sinoport/scripts/validate-mme-inbound-errors.mjs)：覆盖 inbound bundle 错误输入的 400/`VALIDATION_ERROR`。

## 3. 建议冻结的季度回归矩阵结构

冻结建议只保留一张季度矩阵，不再拆分成多套口径。推荐字段如下：

| 字段 | 说明 |
| --- | --- |
| `quarter` | 季度标识，例如 `W12` 收口季度 |
| `domain` | `platform / station / mobile / import / reports / audit / agent / governance / data quality` |
| `script_ref` | 绑定的现有脚本或既有文档 |
| `object_scope` | 当前回归对象链，例如 flight、awb、shipment、task、exception、document、station、team |
| `run_mode` | 本地 `wrangler dev`、浏览器 smoke、回放、评估或只读验证 |
| `fixture_or_seed` | 当前固定样本、fixture、D1 迁移或登录上下文 |
| `assertion_set` | 必须通过的关键断言 |
| `evidence_ref` | 输出摘要、日志或冻结文档引用 |
| `result` | `Accepted / Refine / Blocked` |
| `rollback_note` | 若失败，回到哪个脚本或哪个对象链重跑 |

矩阵行建议按以下顺序冻结：`platform`、`station`、`mobile`、`import`、`reports`、`audit`、`agent`、`governance`、`data quality`。这样可以保持和当前仓库事实一致，也方便和 M10/M11/M12 的月度文档互相引用。

## 4. 建议冻结的复盘纪要结构

复盘纪要只记录事实、结论和回收动作，不承载下一年度路线扩写。建议结构如下：

1. 文档信息
2. 回归范围与样本集
3. 脚本执行结果摘要
4. 关键问题与退化
5. 口径偏差与边界确认
6. 冻结结论
7. 问题回收列表引用
8. 风险与回滚

每一节建议固定包含：

- `事实来源`：只引用当前仓库已有脚本、已有月度文档和年度文档
- `结论`：只写 `Accepted / Refine / Blocked`
- `依据`：对应脚本名、对象链或文档链接
- `处理动作`：回收、延后、保留或回滚

## 5. 建议冻结的问题回收列表字段

问题回收列表建议统一为单表，不分平台/站点多套格式。建议字段如下：

- `issue_id`
- `month_or_quarter`
- `category`，仅保留 `blocking / follow-up`
- `domain`
- `object_scope`
- `symptom`
- `source_script`
- `repro_step`
- `expected`
- `actual`
- `root_cause`
- `severity_or_impact`
- `decision`
- `owner`
- `evidence_ref`
- `rollback_gate`
- `status`

字段口径固定如下：

- `blocking` 只放会直接阻断结论冻结的问题。
- `follow-up` 只放不阻断冻结、但需要保留观察的问题。
- 不引入项目管理平台状态字段，不引入额外审批流字段。

## 6. 建议冻结的月度验收记录字段

月度验收记录只做边界冻结，不做路线规划。建议字段如下：

- `document_info`
- `month`
- `theme`
- `scope`
- `explicit_exclusions`
- `necessary_artifacts`
- `script_results`
- `frozen_metrics`
- `acceptance_assertions`
- `final_conclusion`
- `linked_issue_list`

边界要求如下：

- 只能记录当前月的验收事实，不向外扩写季度后的新开发路线。
- 只能引用已存在脚本和已存在文档，不补造新的验收体系。
- 若某项能力需要重新验收，必须回到新的月度记录，不在冻结文档里“顺手补写”。

## 7. 下一年度移交输入

下一年度移交只接收输入，不接收新路线。建议移交输入固定为：

- 当前冻结的季度回归矩阵和脚本清单
- M10 / M11 / M12 月度验收记录
- M10 / M11 问题回收列表
- M12 经营与技术复盘结论
- 年度复盘与下一年度规划中的三条主线
- 已知边界：`MME` 单站事实、只读 + 建议型边界、`request_task_assignment` 隐藏边界、固定样本集边界
- 已知风险：demo fallback、fixture 漂移、指标漂移、局部本地状态污染、单站外推风险

移交输入的用途只限于：

- 作为下一年度的历史基线
- 作为新月度验收的对照起点
- 作为回滚与审计的参考依据

## 8. 非目标

- 本周不新增脚本。
- 本周不重写验收范围。
- 本周不扩写下一年度路线。
- 本次不新建多份文档，只冻结这一份正式文档，并按需补主任务卡交叉引用。
- 本次不引入新的季度报表系统或新的项目管理平台口径。

## 9. 风险与回滚

### 9.1 主要风险

- `demo fallback` 仍可能掩盖真实问题。
- fixture、样本对象和本地 D1 数据一旦漂移，冻结结论就不再可比。
- `Station Copilot` 的工具隐藏和只读边界如果回退，会污染季度回收口径。
- 前端 smoke 依赖真实页面文本，页面文案变化会造成假失败或漏检。
- 单站 `MME` 事实不能被写成多站推广结论。

### 9.2 回滚方式

- 脚本层回滚：直接回到现有脚本重跑，不引入新脚本作为补救。
- 数据层回滚：重置本地 D1 / fixture，再用现有导入与回放脚本重放。
- 文档层回滚：保留历史冻结版本，若事实变化则发新版本，不在旧版本内静默改写结论。
- 结论层回滚：一旦发现新事实与冻结结论冲突，优先把问题回收到问题列表，再决定是否重新验收。
