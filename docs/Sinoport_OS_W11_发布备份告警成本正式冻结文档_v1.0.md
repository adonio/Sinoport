# Sinoport OS W11 发布备份告警成本正式冻结文档 v1.0

## 1. 文档信息与范围

- 任务编号：W11
- 任务主题：运维治理，发布 / 备份 / 告警 / 成本
- 冻结状态：正式冻结
- 适用范围：`Release` workflow、`api-worker` / `agent-worker` 发布与健康检查、现有 smoke 校验、D1/R2 手工备份恢复口径、站点告警展示口径、成本台账模板
- 冻结目标：基于当前仓库事实，固定发布门禁、最小回滚步骤、health/version 校验、D1/R2 备份恢复边界、告警分类口径和成本台账字段
- 事实源：
  - [.github/workflows/release.yml](/Users/lijun/Downloads/Sinoport/.github/workflows/release.yml:1)
  - [apps/api-worker/src/routes/health.ts](/Users/lijun/Downloads/Sinoport/apps/api-worker/src/routes/health.ts:1)
  - [scripts/smoke-api.mjs](/Users/lijun/Downloads/Sinoport/scripts/smoke-api.mjs:1)
  - [scripts/publish-admin-static.mjs](/Users/lijun/Downloads/Sinoport/scripts/publish-admin-static.mjs:1)
  - [apps/api-worker/wrangler.jsonc](/Users/lijun/Downloads/Sinoport/apps/api-worker/wrangler.jsonc:1)
  - [apps/agent-worker/wrangler.jsonc](/Users/lijun/Downloads/Sinoport/apps/agent-worker/wrangler.jsonc:1)
  - [Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_P2_W1-W12_主Agent执行任务卡_v1.0.md:215)
  - [Sinoport_OS_W10_Station_Copilot最小生产验证正式冻结文档_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_W10_Station_Copilot最小生产验证正式冻结文档_v1.0.md:1)
  - [Sinoport_OS_发布与运维基线_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_发布与运维基线_v1.0.md:1)

说明：

- 本文只冻结当前仓库可直接读到的发布与运维事实，不引入 Cloudflare Dashboard、外部监控系统或额外值班流程假设。
- 本文区分“当前已存在”与“冻结建议 / 待补项”；后者是 W11 的正式收口边界，不等同于新增代码实现。

## 2. 当前已存在的发布与部署事实

### 2.1 `workflow_dispatch` 输入

`release.yml` 目前暴露以下手工触发输入：

- `target`
- `release_ref`
- `release_tag`
- `staging_validation_ack`
- `station_api_url`
- `api_url`
- `agent_url`

其中：

- `target` 只接受 `staging` / `production`
- `release_ref` 为空时使用触发 workflow 的 `GITHUB_SHA`
- `release_tag` 会注入到版本元数据
- `staging_validation_ack` 在生产发布时必须为 `validated`

### 2.2 Pages 与 workers 分离部署

当前 workflow 的发布链路是分开的：

- `build-static` 先构建 `admin-console`
- `deploy-pages` 分别部署主站 Pages 和 admin Pages
- `deploy-workers` 先执行 D1 migrations，再部署 `api-worker` 和 `agent-worker`
- `smoke` 最后执行前端 smoke 校验

这意味着：

- Pages 和 workers 不是同一个发布步骤
- workers 发布前会先发生 D1 schema 变更
- smoke 是发布后的收口校验，不是前置门禁

### 2.3 `health/version` 暴露字段

`apps/api-worker/src/routes/health.ts` 与 `apps/agent-worker/src/index.ts` 的 health 响应形态一致，返回：

- `service`
- `environment`
- `status`
- `version.sha`
- `version.tag`
- `version.deployed_at`

其中：

- `service` 读 `APP_NAME`
- `environment` 读 `ENVIRONMENT`
- `version.sha` 读 `APP_VERSION`
- `version.tag` 读 `APP_RELEASE_TAG`
- `version.deployed_at` 读 `APP_DEPLOYED_AT`

### 2.4 现有发布注入方式

`release.yml` 对两个 worker 都注入相同的版本元数据：

- `APP_VERSION=<release_ref>`
- `APP_DEPLOYED_AT=<UTC timestamp>`
- `APP_RELEASE_TAG=<release_tag>`，仅在传入时注入

Pages 发布则通过 `--commit-hash` 绑定同一 `release_ref`。

## 3. 当前已存在的最小 smoke / health 校验

### 3.1 仓库里的 smoke 事实

当前至少存在两条最小校验链路：

- `scripts/test-frontend-smoke.mjs`：检查 `api-worker` 与 `agent-worker` 的 `GET /api/v1/healthz`，并校验 `environment` 与 `version.sha`
- `scripts/smoke-api.mjs`：对 `api-worker` 做更窄的 API 冒烟，覆盖 `mobile/login`、`mobile/tasks`、`station/documents`

### 3.2 发布 workflow 中实际使用的校验

`release.yml` 的最终 smoke 步骤调用 `npm run test:frontend:smoke`，并传入：

- `SMOKE_API_URL`
- `SMOKE_AGENT_URL`
- `SMOKE_WEB_URL`
- `SMOKE_EXPECTED_VERSION`
- `SMOKE_EXPECTED_ENVIRONMENT`

这表示当前发布门禁里，health/version 校验已经是 smoke 的一部分，但不是单独的 release 前置检查。

## 4. 建议冻结的发布门禁

以下为 W11 建议冻结口径，只基于现有 workflow 收口，不新增云侧系统：

1. 生产发布前必须满足 `staging_validation_ack=validated`
2. 同一 `release_ref` 先完成 staging，再进入 production
3. Pages、`api-worker`、`agent-worker` 都必须使用同一个 `release_ref`
4. 发布后必须完成：
   - `api-worker` health/version 校验
   - `agent-worker` health/version 校验
   - `test:frontend:smoke`
5. 发布说明中必须记录：
   - `target`
   - `release_ref`
   - `release_tag`
   - `deployed_at`
   - `station_api_url`
   - `api_url`
   - `agent_url`

冻结解释：

- 这套门禁完全可以由现有 workflow 和 smoke 组合支撑
- 不要求新增审批系统、聊天机器人审批或外部发布平台

## 5. 建议冻结的回滚最小步骤

### 5.1 Pages

最小回滚口径是“重新发布上一个稳定 `release_ref`”：

1. 找到上一个已知稳定的 `release_ref`
2. 重新触发 `Release` workflow
3. 传入相同 `target` 和该 `release_ref`
4. 复跑 `test:frontend:smoke`

当前事实是 Pages 部署与源码 `release_ref` 绑定，所以这是仓库里最小可行回滚方式。

### 5.2 `api-worker`

最小回滚口径同样是“重新发布旧 SHA”：

1. 找到上一个已知稳定的 `release_ref`
2. 重新触发 `Release` workflow
3. 让 workflow 重新部署 `api-worker`
4. 再校验 `GET /api/v1/healthz` 的 `version.sha`

### 5.3 `agent-worker`

最小回滚口径同样是“重新发布旧 SHA”：

1. 找到上一个已知稳定的 `release_ref`
2. 重新触发 `Release` workflow
3. 让 workflow 重新部署 `agent-worker`
4. 再校验 `GET /api/v1/healthz` 的 `version.sha`

### 5.4 D1 migrations 的风险边界

当前 workflow 的顺序是先 `Apply D1 migrations`，再部署 workers。由此冻结以下边界：

- worker 回滚不等于 schema 回滚
- release workflow 没有自动回滚 migrations 的步骤
- 一旦 schema 已前进，worker 退回旧版本可能出现兼容风险

因此 W11 冻结的最小原则是：

1. 只把 D1 migrations 当作前向变更
2. 若 migration 有问题，优先考虑修正性前向发布或数据恢复
3. 不把“自动下滚 schema”当作已存在能力

## 6. 备份与恢复边界

### 6.1 当前已有的事实

仓库中的运维基线文档已经给出 D1 / R2 的手工命令模板：

- D1 导出：`wrangler d1 export ... --remote --output ...`
- D1 回灌：`wrangler d1 execute ... --remote --file ...`
- R2 下载：`wrangler r2 object get ... --file ...`
- R2 上传：`wrangler r2 object put ... --file ...`

这些模板只能说明“手工可做”，不能自动推导出成熟 runbook。

### 6.2 W11 冻结的 D1 边界

- 可以冻结为：按环境做 SQL 导出，作为发布前或事故前的最低备份动作
- 可以冻结为：恢复时采用“新建恢复库或清库回灌”的人工选择
- 不冻结为：自动化备份调度、自动故障切换、自动回滚到历史快照

### 6.3 W11 冻结的 R2 边界

- 可以冻结为：关键对象按 `storage_key` 做抽样下载和人工回灌模板
- 不应冻结为：已经存在完整的 R2 全量恢复链
- 当前仓库没有看到把 R2 恢复串成自动化链路的实现，因此 W11 将 R2 恢复链明确记为 `待补`

### 6.4 恢复后最小校验

恢复动作后，最少应复核：

- `GET /api/v1/healthz`
- `GET /api/v1/agent/tools`
- `GET /api/v1/platform/audit/events`
- 受影响对象的抽样读取

## 7. 建议冻结的告警分类口径

### 7.1 口径来源

`apps/api-worker/src/routes/station.ts` 当前在平台态势页里生成 `alertRows`，并对阻断项做分层展示。仓库事实可支持三类语义：

- `阻断`
- `警戒`
- `待处理`

说明：

- 页面代码里实际使用的是 `阻塞` 字样
- 本文统一把治理术语写成 `阻断`，并将其视为页面 `阻塞` 语义的同义冻结口径

### 7.2 冻结定义

- `阻断`：存在 `blockingExceptions`，或 fallback 场景里命中 `blocker_code`
- `警戒`：有阻断点，但主要由被阻塞任务驱动，页面层以 `警戒` 呈现
- `待处理`：无明确阻断异常，但任务仍未完成，需要跟进

### 7.3 冻结模板字段

每条告警记录建议固定这些字段：

- `id`
- `title`
- `description`
- `status`
- `resource_type`
- `resource_id`
- `station_id`
- `blocking_reason`
- `first_seen_at`
- `last_seen_at`
- `evidence_ref`
- `recommended_action`

### 7.4 非目标

- 不冻结外部告警平台配置
- 不冻结 PagerDuty / Opsgenie / Slack 等集成
- 不补云侧监控系统，只冻结仓库里能支撑的展示与台账口径

## 8. 建议冻结的成本台账模板字段

W11 只冻结台账模板，不冻结实际计费平台对账逻辑。建议字段如下：

- `date`
- `environment`
- `resource_type`
- `resource_name`
- `resource_id`
- `release_ref`
- `release_tag`
- `change_type`
- `operator`
- `related_task`
- `evidence_ref`
- `usage_qty`
- `unit`
- `unit_cost`
- `estimated_cost`
- `actual_cost`
- `cost_category`
- `notes`

建议约定：

- `resource_type` 优先写 `Pages`、`api-worker`、`agent-worker`、`D1`、`R2`
- `change_type` 优先写 `release`、`rollback`、`backup`、`restore`、`smoke`
- `evidence_ref` 记录 workflow run、导出文件名或对象恢复凭据

## 9. 非目标

- 本周不做实际发布演练
- 本周不新增监控系统
- 本周不补云侧外部配置
- 本周不扩散到 W12 的季度回归

## 10. 风险与回滚

### 10.1 风险

- 只写文档不做演练，口径可能仍与真实操作存在差距
- `healthz` 已提供版本字段，但如果发布时未正确注入 `APP_VERSION`，校验会失真
- D1 migrations 先于 workers 发布，schema 风险无法靠 worker 回滚自动消除
- R2 恢复链在仓库里仍是手工模板，当前没有自动化恢复闭环
- 告警分类如果继续混用 `阻断` / `阻塞`，容易造成口径漂移

### 10.2 回滚

- 若只需撤回 W11 冻结结论，优先回滚本文件与主任务卡中的交叉引用
- 若需要回滚发布，按本文件第 5 节执行旧 `release_ref` 重新发布
- 若需要回滚备份恢复口径，只能回退本文件中的模板和边界，不应假设仓库已有自动恢复链

## 11. 对 W12 的明确移交输入

W12 只接收以下已冻结输入：

- `Release` workflow 的门禁与注入字段
- `healthz` 的版本校验字段
- `test:frontend:smoke` 与 `test:smoke:api` 的现有校验分工
- D1 导出 / 回灌与 R2 对象级恢复的手工模板边界
- `阻断 / 警戒 / 待处理` 的告警分类模板
- 成本台账模板字段

W12 不应重新定义 W11 的运维边界，也不应把本次冻结扩展成新的季度运维项目。
