# Sinoport OS 后端一期执行计划 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：执行基线
- 更新时间：`2026-04-13`
- 适用阶段：后端一期启动
- 关联文档：
  - [Sinoport_OS_技术架构_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_技术架构_v1.0.md)
  - [Sinoport_OS_后续开发任务表_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_后续开发任务表_v1.0.md)
  - [Sinoport_OS_PRD_v1.0_开发版.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_PRD_v1.0_开发版.md)
  - [Sinoport_OS_API_Contract_Draft_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_API_Contract_Draft_v1.0.md)
  - [Sinoport_OS_字段字典_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_字段字典_v1.0.md)
  - [Sinoport_OS_状态归属矩阵_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_状态归属矩阵_v1.0.md)

## 2. 文档目的

本文件用于把后端一期从“讨论阶段”转成“执行阶段”。

作用只有三个：

1. 固定一期范围，避免边开发边扩边界。
2. 固定开发顺序，保证每一步的前置条件完整。
3. 给后续排期、拆任务、联调、回溯提供统一依据。

本文件不是新的 PRD，也不是新的技术选型讨论稿。

## 3. 一期范围冻结

### 3.1 一期唯一目标

后端一期只做一件事：

让 `MME` 样板站形成“进港真实闭环”。

### 3.2 一期固定模块

一期只覆盖以下 6 组能力：

1. `station/inbound/flights`
2. `station/inbound/waybills`
3. `station/documents`
4. `station/tasks`
5. `station/exceptions`
6. `mobile/tasks`

### 3.3 一期必须贯通的主链

必须贯通以下主链：

`Flight -> AWB / Shipment -> Document -> Task -> Exception -> Audit`

验收目标不是接口数量，而是上述对象链可以在同一条业务事实链中贯通。

### 3.4 一期明确不做

以下内容不进入一期实施范围：

- 出港闭环
- 平台报表
- 外部系统真实联通
- 大规模 Agent 编排
- 复杂优化算法
- 多站点复制
- 财务、合同、利润分析
- 全量 PostgreSQL 迁移

## 4. 一期执行总原则

1. 先冻结范围，再进入开发。
2. 先补 contract，再写业务实现。
3. 先搭底座，再做纵向闭环。
4. 先跑通一条真实链，再扩展 Agent。
5. 所有新增需求默认进入二期待办，不打断一期主线。

## 5. 六步执行路径

## Step 1：冻结一期范围

### 目标

把后端一期边界一次性定死，禁止在执行中持续扩容。

### 必须输出

- 一期模块清单
- 一期不做清单
- 一期验收目标
- 样板站范围

### 完成标准

- 所有人对一期只做 `MME` 进港闭环达成一致
- 不再把出港、平台治理、全站点复制混入一期开发

### 当前结论

本文件第 3 章即为一期范围冻结结果。

## Step 2：补齐 contract 到可开发状态

### 目标

把现有 API 草案补成前后端和测试都可直接使用的开发 contract。

### 必须补齐的内容

- 请求体 JSON 示例
- 响应体 JSON 示例
- 错误码清单
- 字段必填规则
- 状态写入点
- 权限要求
- 审计字段

### 优先接口

优先冻结以下接口：

1. `GET /station/inbound/flights`
2. `GET /station/inbound/flights/{flight_id}`
3. `GET /station/inbound/waybills`
4. `GET /station/inbound/waybills/{awb_id}`
5. `POST /station/documents`
6. `GET /station/tasks`
7. `POST /station/tasks/{task_id}/assign`
8. `POST /station/tasks/{task_id}/exception`
9. `GET /station/exceptions`
10. `GET /mobile/tasks`

### 完成标准

- 前端不再直接依赖 mock 结构猜字段
- 测试可以基于 contract 写断言
- 后端可以按 contract 开始实现而不反复返工

## Step 3：搭建后端工程骨架

### 目标

先建立可持续开发的目录、模块边界和 Cloudflare 运行基线。

### 推荐结构

```txt
apps/
  api-worker/
  agent-worker/
packages/
  contracts/
  domain/
  repositories/
  tools/
  auth/
  workflows/
infra/
  cloudflare/
```

### 首批基础能力

- `Workers + Hono` 服务入口
- 基础路由组织
- 统一错误返回
- 环境配置管理
- D1 连接与 migration 入口
- R2 上传接口骨架
- Repository 抽象

### 完成标准

- 工程能在 Cloudflare 本地和预发环境启动
- 目录边界明确
- 后续开发不再从零散文件开始堆逻辑

## Step 4：实现基础底座

### 目标

先做通用底座，不在业务接口里重复补基础能力。

### 必做项

- 鉴权
- RBAC / Policy 校验
- D1 schema 初版
- R2 上传链路
- 审计中间件
- 通用分页 / 筛选 / 错误结构
- Repository 接口与 D1 实现

### 完成标准

- 后续每个业务接口都能复用统一底座
- 正式写操作都能进入审计链
- 文件上传链路可贯通

## Step 5：实现第一条纵向真实闭环

### 目标

只实现一条可真实跑通的最小业务链。

### 推荐顺序

1. 航班列表 / 详情
2. 提单列表 / 详情
3. 单证上传
4. 任务生成 / 分派 / 完成
5. 异常上报 / 查看
6. PDA 我的任务

### 验收标准

- 一票货能够从航班和提单进入任务与单证链
- 异常可挂接到同一对象链
- 所有关键动作有审计记录
- PDA 可消费真实任务数据

### 注意事项

- 这一阶段追求“闭环真实”，不是“接口数量最多”
- 没有串起来的功能不算完成

## Step 6：最后接入第一个 Agent

### 目标

在真实业务闭环上接入第一个高价值 Agent，而不是提前把 Agent 变成主线。

### 一期建议 Agent

优先二选一：

1. `Document Agent`
2. `Station Copilot`

### Agent 约束

- Agent 不直接写数据库
- Agent 只通过 Tool 调业务 API
- 高风险动作必须人工确认
- Agent 相关动作必须写审计

### 完成标准

- Agent 基于真实数据给出建议
- Agent 不破坏权限和责任链
- Agent 能成为后续扩展的模板

## 6. 建议阶段产物

### Phase A：执行冻结阶段

产物：

- 本执行计划
- 一期 contract 冻结稿
- 一期验收口径

### Phase B：骨架完成阶段

产物：

- `api-worker` 工程骨架
- D1 schema 初版
- R2 上传链路初版
- 鉴权与审计底座

### Phase C：闭环完成阶段

产物：

- 6 组核心 API
- 样板站数据链贯通
- PDA 真实任务链

### Phase D：Agent 接入阶段

产物：

- 第一个业务 Agent
- Tool 权限清单
- Agent 审计链

## 7. 可持续开发约束

为了保证后续开发不失控，后端一期必须遵守以下约束：

1. 新需求默认进入 backlog，不直接插队。
2. 任何超出一期范围的能力，必须先更新文档再进入排期。
3. Agent 开发不能早于主业务闭环。
4. 正式业务逻辑不得直接耦合到 Cloudflare 私有运行时细节。
5. Repository 抽象必须先于复杂业务逻辑落地。

## 8. 当前立即动作

基于本计划，当前建议的立即动作顺序为：

1. 先补一期 contract
2. 再搭 `api-worker` 骨架
3. 再落 D1 schema
4. 再实现第一批 API

这四个动作完成前，不建议直接开始大规模业务编码。

## 9. 结论

后端一期的主线应固定为：

`范围冻结 -> contract 完整 -> 工程骨架 -> 基础底座 -> 真实闭环 -> 第一个 Agent`

一句话定义：

先把 `MME` 进港链路做成真实系统，再让 Agent 接在真实系统之上。
