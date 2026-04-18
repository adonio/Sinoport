# Sinoport OS 发布与运维基线 v1.0

## 1. 文档目的

本文件用于冻结 `M3` 的最小运维基线，让每一次发布都能回答四个问题：

1. 发布了哪个版本
2. 发布到了哪个环境
3. 发布后做了哪些校验
4. 出现问题时如何回滚或恢复

## 2. 环境矩阵

| 环境 | 主站 | 后台 | API | Agent | D1 | R2 |
| --- | --- | --- | --- | --- | --- | --- |
| `staging` | `https://staging.sinoport.co` | `https://staging-admin.sinoport.co` | `https://staging-api.sinoport.co` | `https://staging-agent.sinoport.co` | `sinoport-api-staging` | `sinoport-files-staging` |
| `production` | `https://sinoport.co` | `https://admin.sinoport.co` | `https://api.sinoport.co` | `https://agent.sinoport.co` | `sinoport-api-production` | `sinoport-files-production` |

## 3. 发布顺序

固定顺序为：

1. `staging`
2. `production`

`production` 发布前必须满足：

1. 同一 `release_ref` 已在 `staging` 完成部署
2. 发布人已确认 staging 校验通过
3. `workflow_dispatch` 中显式传入 `staging_validation_ack=validated`

## 4. 版本口径

本项目的发布版本统一采用：

1. 必填：`git SHA`
2. 选填：`release tag`

发布时：

1. Pages 部署记录使用 `--commit-hash` 绑定本次 `release_ref`
2. `api-worker` 与 `agent-worker` 在部署时注入：
   - `APP_VERSION`
   - `APP_RELEASE_TAG`
   - `APP_DEPLOYED_AT`
3. `/api/v1/healthz` 会返回：
   - `service`
   - `environment`
   - `status`
   - `version.sha`
   - `version.tag`
   - `version.deployed_at`

## 5. 发布后校验

每次发布后，至少要完成以下校验：

1. `GET /api/v1/healthz`
2. `GET /api/v1/agent/tools`
3. `GET /api/v1/platform/audit/events`
4. 浏览器 smoke
5. 版本校验：
   - API `healthz.version.sha` 等于本次 `release_ref`
   - Agent `healthz.version.sha` 等于本次 `release_ref`
   - `environment` 与目标环境一致

## 6. 回滚策略

### 6.1 Pages 回滚

Pages 回滚采用“重新发布旧 SHA”的方式，不直接修改当前源码树。

操作口径：

1. 找到上一个已知稳定的 `release_ref`
2. 重新触发 `Release` workflow
3. 传入：
   - `target`
   - `release_ref=<stable sha>`
   - 目标环境对应 URL
4. 再执行一次完整 smoke

### 6.2 Worker 回滚

Worker 回滚同样采用“重新发布旧 SHA”的方式。

操作口径：

1. 找到上一个已知稳定的 `release_ref`
2. 重新触发 `Release` workflow
3. 让 workflow 重新部署 `api-worker`、`agent-worker`
4. 再校验两端 `healthz.version.sha`

## 7. D1 备份与恢复

### 7.1 备份

按环境导出 SQL：

```bash
npx wrangler d1 export sinoport-api-staging --remote --output backups/staging-$(date +%F).sql
npx wrangler d1 export sinoport-api-production --remote --output backups/production-$(date +%F).sql
```

建议：

1. 每次生产发布前至少导出一次
2. 导出的 SQL 文件不要放回业务仓库
3. 备份文件保存到受控存储

### 7.2 恢复

恢复口径采用“新建恢复库或清库回灌”，具体由事故级别决定。

基础命令模板：

```bash
npx wrangler d1 execute sinoport-api-production --remote --file backups/production-YYYY-MM-DD.sql
```

注意：

1. 恢复前先冻结写流量
2. 恢复后先跑 `healthz`、审计页、对象详情抽检
3. 若是高风险事故，优先在新数据库实例中验证，再切换配置

## 8. R2 备份与恢复

R2 当前按“对象级恢复”处理，来源以 D1 中的 `storage_key` 为索引。

### 8.1 备份建议

1. 发布前导出 D1 中的文档索引
2. 对关键对象按 `storage_key` 做抽样下载

对象下载模板：

```bash
npx wrangler r2 object get sinoport-files-production/<storage_key> --file ./restore/<filename>
```

### 8.2 恢复建议

对象上传模板：

```bash
npx wrangler r2 object put sinoport-files-production/<storage_key> --file ./restore/<filename>
```

恢复时：

1. 先用 D1 查询确认 `storage_key`
2. 只恢复受影响对象，不做全桶盲覆盖
3. 恢复后立即验证：
   - 文档下载
   - 文档预览
   - 对象详情页联动

## 9. 密钥与配置边界

生产与 staging 的正式 secret 必须放在 Cloudflare / GitHub secrets。

本地允许存在：

1. `sinoport-local-dev-secret`
2. `demo-token`
3. `X-Debug-*`

但这些只允许在 `local` 环境生效，不得进入 staging / production。

## 10. 当前结论

`M3` 的最小交付标准是：

1. 发布记录可证明版本
2. 发布后校验固定化
3. Pages / Workers 可按旧 SHA 回滚
4. D1 / R2 备份恢复有可执行 Runbook
