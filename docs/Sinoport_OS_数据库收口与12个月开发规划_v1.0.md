# Sinoport OS 数据库收口与 12 个月开发规划 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：执行规划
- 更新时间：`2026-04-14`
- 适用阶段：发布后收口 / 未来 12 个月持续开发
- 关联文档：
  - [Sinoport_OS_技术架构_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_技术架构_v1.0.md)
  - [Sinoport_OS_后续开发任务表_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_后续开发任务表_v1.0.md)
  - [Sinoport_OS_年度复盘与下一年度规划_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_年度复盘与下一年度规划_v1.0.md)
  - [Sinoport_OS_API_Contract_Draft_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_API_Contract_Draft_v1.0.md)
  - [Sinoport_OS_数据库收口执行台账_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_数据库收口执行台账_v1.0.md)

## 2. 文档目的

本文件用于回答三个问题：

1. 当前哪些页面和模块仍在直接读取本地 Demo 数据
2. 这些数据应该如何统一收口到真实数据库环境
3. 下一阶段后端和前端应如何协同改造
4. 未来 12 个月整体应该如何持续开发

## 3. 当前扫描结果

截至当前代码基线，平台 / 货站 / 移动端页面层的本地读源已经全部清零。

扫描结果如下：

- 平台侧：`0` 处
- 货站侧：`0` 处
- 移动端：`0` 处

说明：

- 平台侧、货站侧、移动端页面主数据均已切到真实 API / DB 驱动
- `admin-console/src/data/sinoport.js` 与 `admin-console/src/data/sinoport-adapters.js` 不再承担主数据源职责
- 现存本地数据仅允许保留极小量字典、UI fallback 或迁移期兼容壳

### 2.1 平台侧本地读源：无

无。平台侧已经完成 API 化收口。

### 2.2 货站侧本地读源：无

无。货站侧页面层本地读源已清零。

### 2.3 移动端本地读源：无

无。移动端页面层本地读源已清零。

## 4. 当前已完成的阶段能力

Wave 0-8 的真实结果已经落到代码与文档里，当前已完成的阶段能力如下：

1. 页面数据库收口
   - 平台、货站、移动端页面主数据都已改为 API / DB 驱动
   - 页面层本地读源已清零
2. `demo_datasets` 后端过渡层
   - Demo 数据已入库，前端不再把源码常量当主真相
   - 过渡层职责已经从“页面直读”变成“数据库过渡 / 回放”
3. 导入链
   - Demo 数据、真实数据与审计链路已经具备统一入口
   - 后续导入可以在同一套对象模型上扩展
4. 日报
   - 平台日报、站点日报、异常日报的治理路径已经明确
   - 报表能力不再依赖本地 mock 作为主数据源
5. 多站点治理
   - 站点模板、主数据、权限与配置治理已经进入可运营状态
6. `Station Copilot`
   - 站点助理从会话壳推进到可用产品能力
7. `Document Agent`
   - 单证助理已形成可复用的产品入口

## 5. 当前已完成的数据库收口基础

本轮已经新增 `demo_datasets` 表，并把现有 Demo 数据导入了数据库：

- 本地 D1：`92` 个 dataset
- staging D1：`92` 个 dataset
- production D1：`92` 个 dataset

相关实现：

- 表结构：`apps/api-worker/migrations/0011_add_demo_dataset_catalog.sql`
- 导入脚本：`admin-console/scripts/import-demo-datasets.mjs`
- API：
  - `GET /api/v1/platform/demo-datasets`
  - `GET /api/v1/platform/demo-datasets/:datasetKey`

这意味着：

1. 当前 Demo 数据已经不再只有前端源码副本
2. 所有静态 Demo 数据现在都有了数据库中的真实归宿
3. 后续可以逐页把前端读取改成走 DB/API，而不是再反复堆本地常量

## 6. 长期收口目标

当前目标已经不是“继续清页面本地 mock”，而是：

1. 所有页面都以数据库/API 为第一数据源
2. `admin-console/src/data/sinoport*.js` 只保留极少量兜底、字典或迁移期兼容内容
3. 后端成为唯一的真实读写口
4. 前端只做展示和轻量映射，不再自己维护业务真相

## 7. 下一阶段重点

下一阶段真正剩余的重点是：

1. 真实业务数据接入与稳定导入
   - 把 demo 过渡能力与真实业务导入链统一起来
   - 让真实数据、审计与回放保持同一对象链
2. 运维与安全收口
   - `AUTH_TOKEN_SECRET` 切换到真正的 Cloudflare secret
   - demo 账号、本地 bootstrap 与生产策略收紧
3. 多站点持续治理
   - 站点模板、主数据与配置继续标准化
   - 报表与运营看板从“可用”推进到“稳定运营”
4. Agent 产品化
   - `Station Copilot` 和 `Document Agent` 从可用推进到生产价值可验证
   - 补齐工具、审计和使用边界
5. 产物治理
   - 解决 `admin-assets/` 与静态路由产物污染主工作区的问题

## 8. 未来 12 个月规划

### Q1：运维安全与真实数据接入

目标：

- 完成生产 secret 收口
- 收紧 demo 账号与 bootstrap
- 稳定真实数据导入链和审计链

核心结果：

- 生产环境安全边界清晰
- 真实数据不再只是样板导入
- 业务对象和审计链可稳定回放

### Q2：报表、站点模板与治理深化

目标：

- 完成日报、异常日报、站点日报的稳定产出
- 继续统一站点模板、主数据和权限治理
- 让多站点配置不依赖人工拼装

核心结果：

- 治理型页面真正进入运营节奏
- 新站点接入成本下降
- 报表成为可复用能力

### Q3：Agent 产品化

目标：

- 把 `Station Copilot` 与 `Document Agent` 做成稳定产品入口
- 补齐工具层、审计层和使用边界
- 让 Agent 面向真实场景而不是演示场景

核心结果：

- Agent 能在真实业务中持续产生价值
- 相关动作都有审计与回溯
- 使用边界明确

### Q4：跨系统整合与稳态运营

目标：

- 评估更多系统集成和更深对象链
- 固化发布、回归与验收流程
- 继续收敛构建产物与仓库治理

核心结果：

- 进入稳态运营，不再依赖临时手工动作
- 发布后验收有明确边界
- 仓库治理不再反向污染日常开发

## 9. 风险与对策

### 风险 1：生产 secret 仍未完全收口

对策：

- 优先完成 Cloudflare secret 切换
- 把占位值从生产配置中移除

### 风险 2：真实业务数据质量波动

对策：

- 导入链必须带审计和回放
- 真实数据与 demo 过渡层分离管理

### 风险 3：Agent 价值不够稳定

对策：

- 继续把工具、审计、对象链做实
- 只保留真实能提升作业效率的入口

### 风险 4：构建产物持续污染仓库

对策：

- 优先把构建产物改成 CI-only 或临时目录产物

## 10. 当前结论

Wave 0-8 的数据库收口与 Agent 产品化已经完成，平台 / 货站 / 移动端页面层本地读源已清零。

当前这份规划文档真正对应的后续工作，只有三类：

1. 真实业务数据接入与运营治理
2. 安全、secret 与构建产物治理
3. Agent 产品化后的生产化验证

下一年度不再把已经完成的页面收口、demo 后端过渡层、导入链、日报、多站点治理、`Station Copilot`、`Document Agent` 继续写成计划项。
