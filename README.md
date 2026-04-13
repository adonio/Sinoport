# Sinoport Project Workspace

这个目录现在包含三类内容：

1. 商业模型原始资料与结构化摘要
2. 企业端官网信息架构与页面原型
3. 平台管理方 / 货站管理员后台页面原型

## 已纳入的说明书

- 原始 PDF：`docs/source/Sinoport_商业模型说明书_v1.0.pdf`
- 摘要整理：`docs/business-model-summary.md`
- 页面规划：`docs/product-architecture.md`
- 技术架构：`docs/Sinoport_OS_技术架构_v1.0.md`
- 后端一期执行计划：`docs/Sinoport_OS_后端一期执行计划_v1.0.md`
- 后续开发任务表：`docs/Sinoport_OS_后续开发任务表_v1.0.md`

## 后端骨架

- API Worker：`apps/api-worker`
- Agent Worker：`apps/agent-worker`
- 共享包：`packages/contracts`、`packages/domain`、`packages/repositories`、`packages/auth`、`packages/tools`、`packages/workflows`
- Cloudflare 配置说明：`infra/cloudflare/README.md`

## 远端交付

- CI：`.github/workflows/ci.yml`
- 发布：`.github/workflows/release.yml`
- 发布前需要准备：
  - `station_api_url`：Pages 构建时注入的站内 API 地址
  - `api_url`：部署后的 `api-worker` 公网地址
  - `agent_url`：部署后的 `agent-worker` 公网地址
  - `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`
  - `staging` / `production` 环境里的 D1、R2 占位值需要先替换成真实资源 ID
- 发布后校验会自动跑：`health`、`agent/tools`、`audit/events`、浏览器 smoke

当前代码侧已完成：

- 站内 Web 鉴权、本地账号体系、`me / refresh / logout`
- 文档预签名上传、预览、下载、保留清理
- 进港与最小出港动作链
- PDA 深层对象写链
- Agent 会话服务与 `station/copilot`
- CI / smoke / release workflow

当前剩余只有真实云环境条件：

- 替换 `wrangler` 里的 `staging / production` D1、R2 占位值
- 配置 GitHub `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`
- 实际执行 `staging` 与 `production` 发布

建议命令：

```bash
npm install
npm run dev:api
npm run dev:agent
npm run test:smoke:api
```

## 页面原型

- 企业端网站：`index.html`
- 平台管理方后台：`platform-admin.html`
- 货站管理员后台：`station-admin.html`

## 预览方式

直接在浏览器中打开 `index.html` 即可开始查看，并从顶部导航切换到两个后台页面。

## 当前原型体现的重点

- `Promise-Driven Fulfillment` 的产品定位
- 从中国集货仓到客户签收的五段履约链路
- `ERP / 供应链系统 / Sinoport OS / 可信数据层` 四层架构
- `URC、KGF、NVI、RZE、MST、BoH、MME` 七个货站节点
- 平台管理方与货站管理员两层后台角色拆分
- `Timely / Accurate / Visible / Accountable` KPI 视角
