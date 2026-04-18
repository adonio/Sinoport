# Cloudflare Runtime Notes

当前 Cloudflare 运行入口：

- `apps/api-worker/wrangler.jsonc`
- `apps/agent-worker/wrangler.jsonc`

## 环境资源

### staging

- API Worker：`sinoport-api-worker-staging`
- Agent Worker：`sinoport-agent-worker-staging`
- D1：`sinoport-api-staging`
- R2：`sinoport-files-staging`
- 域名：
  - `staging-api.sinoport.co`
  - `staging-agent.sinoport.co`

### production

- API Worker：`sinoport-api-worker-production`
- Agent Worker：`sinoport-agent-worker-production`
- D1：`sinoport-api-production`
- R2：`sinoport-files-production`
- 域名：
  - `api.sinoport.co`
  - `agent.sinoport.co`

## 运行约定

1. `api-worker` 承接正式业务 API
2. `agent-worker` 承接 Agent 会话与工具入口
3. D1 migration 目录位于 `apps/api-worker/migrations`
4. 本地环境允许 `local-only` 的 demo/debug auth
5. staging / production 禁止使用本地 demo/debug auth

## 发布与运维

发布、回滚、D1/R2 备份恢复口径已经单独冻结在：

- [Sinoport_OS_发布与运维基线_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_发布与运维基线_v1.0.md)

若只是本地开发：

```bash
npm run db:migrate:local --workspace @sinoport/api-worker
npm run dev:api
npm run dev:agent
```
