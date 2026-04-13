# Cloudflare Bootstrap Notes

当前目录用于承接后端一期的 Cloudflare 配置说明。

## Worker 入口

- `apps/api-worker/wrangler.jsonc`
- `apps/agent-worker/wrangler.jsonc`

## 当前约定

- `api-worker` 承接正式业务 API
- `agent-worker` 预留给 Agent 会话与工具入口
- D1 与 R2 先使用本地占位配置，待实际创建资源后再替换
- D1 migration 目录位于 `apps/api-worker/migrations`

## 需要替换的占位项

上线前至少替换以下配置：

1. `apps/api-worker/wrangler.jsonc` 中的 `database_id`
2. `apps/api-worker/wrangler.jsonc` 中的 `bucket_name`
3. 两个 worker 的 `name`
4. `vars` 中的环境标识

## 建议的资源命名

- D1: `sinoport-api-dev`
- R2: `sinoport-files-dev`
- Queue: `document-events-dev`
- Queue: `analytics-refresh-dev`

## 当前阶段边界

当前仅完成骨架与目录边界：

- 还未创建真实 D1 schema
- 还未接入真实 R2 上传
- 还未接入 Cloudflare Agents SDK
- 还未接入 Workflows / Queues 实现

更新：

- 已提供 `apps/api-worker/migrations/0001_initial_schema.sql`
- 已提供 `apps/api-worker/migrations/0002_seed_mme_reference.sql`
- 可通过 `npm run db:migrate:local --workspace @sinoport/api-worker` 应用到本地 D1
