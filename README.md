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
- 数据库收口与 12 个月开发规划：`docs/Sinoport_OS_数据库收口与12个月开发规划_v1.0.md`
- 数据库收口执行台账：`docs/Sinoport_OS_数据库收口执行台账_v1.0.md`
- 年度复盘与下一年度规划：`docs/Sinoport_OS_年度复盘与下一年度规划_v1.0.md`

## 后端骨架

- API Worker：`apps/api-worker`
- Agent Worker：`apps/agent-worker`
- 共享包：`packages/contracts`、`packages/domain`、`packages/repositories`、`packages/auth`、`packages/tools`、`packages/workflows`
- Cloudflare 配置说明：`infra/cloudflare/README.md`

## 远端交付

- CI：`.github/workflows/ci.yml`
- 发布：`.github/workflows/release.yml`
- 远端环境已完成：
  - 主站生产：`https://sinoport.co`
  - 主站 staging：`https://staging.sinoport.co`
  - 后台生产：`https://admin.sinoport.co`
  - 后台 staging：`https://staging-admin.sinoport.co`
  - API 生产：`https://api.sinoport.co`
  - API staging：`https://staging-api.sinoport.co`
  - Agent 生产：`https://agent.sinoport.co`
  - Agent staging：`https://staging-agent.sinoport.co`
- 发布后校验已覆盖：`health`、`agent/tools`、`audit/events`、浏览器 smoke

当前代码侧已完成：

- 站内 Web 鉴权、本地账号体系、`me / refresh / logout`
- 文档预签名上传、预览、下载、保留清理
- 进港与最小出港动作链
- PDA 深层对象写链
- Agent 会话服务与 `station/copilot`
- CI / smoke / release workflow
- Cloudflare Pages / Workers / D1 / R2 的 `staging / production` 发布

当前剩余主要是治理事项：

- 将 `AUTH_TOKEN_SECRET` 切换为真正的 Cloudflare secret
- 收紧 demo 账号与本地 bootstrap 逻辑
- 处理 `admin-assets / 静态路由产物` 的版本管理策略

建议命令：

```bash
npm install
npm run dev:api
npm run dev:agent
npm run test:smoke:api
```

## 产物治理

- 当前发布脚本会在仓库根目录生成：
  - `admin-assets/`
  - 根级静态路由目录下的 `index.html`
- 这些文件用于静态站发布，但会污染日常开发工作区。
- 建议下一步二选一：
  - 保留入库：把它们视为正式发布产物，并规范 commit 方式
  - 改为临时产物：只在 CI / 临时目录中生成，不再在主工作区保留

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
