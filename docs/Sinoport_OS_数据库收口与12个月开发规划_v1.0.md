# Sinoport OS 数据库收口与 12 个月开发规划 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：执行规划
- 更新时间：`2026-04-14`
- 适用阶段：发布后收口 / 未来 12 个月持续开发
- 关联文档：
  - [Sinoport_OS_技术架构_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_技术架构_v1.0.md)
  - [Sinoport_OS_后续开发任务表_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_后续开发任务表_v1.0.md)
  - [Sinoport_OS_API_Contract_Draft_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_API_Contract_Draft_v1.0.md)
  - [Sinoport_OS_数据库收口执行台账_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_数据库收口执行台账_v1.0.md)

## 2. 文档目的

本文件用于回答三个问题：

1. 当前哪些页面和模块仍在直接读取本地 Demo 数据
2. 这些数据应该如何统一收口到真实数据库环境
3. 下一阶段后端和前端应如何协同改造
4. 未来 12 个月整体应该如何持续开发

## 3. 当前扫描结果

截至当前代码基线，前端仍直接依赖 `admin-console/src/data/sinoport.js` 与 `admin-console/src/data/sinoport-adapters.js` 的模块共有：

- 平台侧：`0` 处
- 货站侧：`0` 处
- 移动端：`0` 处

说明：

- 平台侧读模型收口已完成，平台页面与 `admin-console/src/api/platform.js` 已统一切到真实 API / DB 驱动
- 当前剩余工作集中在货站侧和移动端

### 2.1 平台侧仍直接读本地数据

无。平台侧已经完成 API 化收口。

### 2.2 货站侧仍直接读本地数据

- `admin-console/src/api/station.js`
- `admin-console/src/pages/station/dashboard.jsx`
- `admin-console/src/pages/station/inbound.jsx`
- `admin-console/src/pages/station/inbound-flight-create.jsx`
- `admin-console/src/pages/station/inbound-mobile.jsx`
- `admin-console/src/pages/station/outbound.jsx`
- `admin-console/src/pages/station/outbound-flights.jsx`
- `admin-console/src/pages/station/outbound-waybills.jsx`
- `admin-console/src/pages/station/documents.jsx`
- `admin-console/src/pages/station/documents-noa.jsx`
- `admin-console/src/pages/station/documents-pod.jsx`
- `admin-console/src/pages/station/tasks.jsx`
- `admin-console/src/pages/station/shipments.jsx`
- `admin-console/src/pages/station/shipment-detail.jsx`
- `admin-console/src/pages/station/exceptions.jsx`
- `admin-console/src/pages/station/exception-detail.jsx`
- `admin-console/src/pages/station/resources.jsx`
- `admin-console/src/pages/station/resources-teams.jsx`
- `admin-console/src/pages/station/resources-zones.jsx`
- `admin-console/src/pages/station/resources-devices.jsx`
- `admin-console/src/pages/station/resources-vehicles.jsx`
- `admin-console/src/pages/station/reports.jsx`
- `admin-console/src/pages/station/reports-shift.jsx`

### 2.3 移动端仍直接读本地数据

- `admin-console/src/pages/mobile/login.jsx`
- `admin-console/src/pages/mobile/select.jsx`
- `admin-console/src/pages/mobile/inbound.jsx`
- `admin-console/src/pages/mobile/inbound-shared.jsx`
- `admin-console/src/pages/mobile/outbound.jsx`
- `admin-console/src/pages/mobile/outbound-shared.jsx`
- `admin-console/src/pages/mobile/node-shared.jsx`
- `admin-console/src/pages/mobile/pre-warehouse-detail.jsx`
- `admin-console/src/pages/mobile/headhaul-detail.jsx`
- `admin-console/src/pages/mobile/export-ramp-detail.jsx`
- `admin-console/src/pages/mobile/runtime-detail.jsx`
- `admin-console/src/pages/mobile/destination-ramp-detail.jsx`
- `admin-console/src/pages/mobile/tailhaul-detail.jsx`
- `admin-console/src/pages/mobile/delivery-detail.jsx`

## 4. 当前已完成的数据库收口基础

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

## 5. 长期收口目标

最终目标不是“把本地 mock 删掉”，而是：

1. 所有页面都以数据库/API 为第一数据源
2. `admin-console/src/data/sinoport*.js` 只保留极少量兜底、字典或迁移期兼容内容
3. 后端成为唯一的真实读写口
4. 前端只做展示和轻量映射，不再自己维护业务真相

## 6. 推荐改造顺序

### Phase A：平台侧先收口

优先原因：

- 平台页绝大部分仍然是纯静态展示
- 数据结构稳定，写入动作少
- 改成 DB 读最容易，不会先卡在复杂 workflow 上

建议先做这 6 组接口：

1. `GET /api/v1/platform/operations/overview`
2. `GET /api/v1/platform/stations`
3. `GET /api/v1/platform/network`
4. `GET /api/v1/platform/rules`
5. `GET /api/v1/platform/master-data`
6. `GET /api/v1/platform/reports`

这些接口底层可以先从 `demo_datasets` 读，再逐步替换成正式业务表。

### Phase B：货站展示层收口

这里要优先处理仍在直接读 adapter 的页面：

- `dashboard`
- `inbound / outbound` 总览页
- `resources*`
- `reports*`
- `documents/noa`
- `documents/pod`
- `tasks`
- `exceptions`

建议方式：

1. 先把页面数据源改成 API hooks
2. 保留 adapter 只做视图映射
3. 最后再把 adapter 里的静态结构逐步拆空

### Phase C：移动端读模型收口

移动端的写链已经大部分进后端，但读模型仍有很多本地衍生逻辑。

优先处理：

1. `inbound-shared`
2. `outbound-shared`
3. `node-shared`
4. 各种 `*-detail` 页

目标是：

- 读模型来自后端对象
- 本地状态只保留临时输入、离线队列、UI scratch
- 不再让前端自己推导业务真相

## 7. 后端长期开发任务

基于当前状态，下一阶段后端应继续做这些任务：

### 6.1 数据服务层

- 为平台页补齐正式 `platform/*` 读接口
- 为货站页补齐 `resources / reports / dashboards` 读接口
- 为移动端 detail flow 补齐正式读接口

### 6.2 数据模型层

- 把现在 `demo_datasets` 中稳定的数据，逐步迁成正式业务表
- 平台治理类数据可以先从 catalog 表过渡
- 货站和移动作业数据应继续归并到一类业务表

### 6.3 配置治理

- 把 `AUTH_TOKEN_SECRET` 切到真正的 Cloudflare secret
- 收紧 demo 用户与本地 bootstrap
- 明确 staging / production 的环境变量和密钥轮换策略

### 6.4 仓库治理

- 解决 `admin-assets/` 和根级静态路由产物污染工作区的问题
- 建议改成临时目录或 CI-only 产物

## 8. 建议下一步

如果只选一条主线，我建议下一步定成：

`先把 platform 与 station 的读模型 API 化，再逐步把 mobile detail flow 从本地衍生逻辑迁到后端对象。`

最现实的第一批任务是：

1. 平台侧 `operations / stations / network / rules / master-data / reports` 改成 DB/API 驱动
2. 货站侧 `dashboard / inbound / outbound / resources / reports` 改成 DB/API 驱动
3. 移动端 `inbound-shared / outbound-shared / node-shared` 改成后端读模型驱动

## 9. 12 个月总体路线图

未来 12 个月建议按 `4 个季度 + 12 个自然月主题` 来推进，不建议一开始多线散打。

### 9.1 Q1：数据库收口与真实读模型替换

目标：

- 清掉主要页面对 `data/sinoport*.js` 的直接依赖
- 建立平台侧和货站侧统一读接口
- 保持 Demo 数据和真实数据库一致

核心结果：

- 平台页主要读模型 API 化
- 货站页主要读模型 API 化
- `demo_datasets` 从临时过渡层变成系统化过渡层

### 9.2 Q2：真实业务数据接入与对象模型稳态化

目标：

- 从 Demo 数据过渡到真实业务数据
- 形成真实 `Flight / AWB / Shipment / Task / Document / Exception / Audit` 闭环
- 把移动端深层作业模型进一步后端化

核心结果：

- 真实数据导入链稳定
- 业务对象统一归口到数据库
- 站内与 PDA 视图一致

### 9.3 Q3：运营治理、报表与多站点能力

目标：

- 报表、审计、权限、主数据治理进入稳定运营阶段
- 从样板站扩展到更多站点
- 优化导入、回写、审计、告警链

核心结果：

- 平台治理页真正有运营价值
- 多站点模板和配置能力成熟
- 例行日报、异常日报、作业日报可用

### 9.4 Q4：Agent 产品化与二期业务扩展

目标：

- 让 Agent 从“可用”变成“有实际生产价值”
- 结合真实数据做站点 Copilot、单证 Agent、异常 Agent
- 评估是否进入更深的出港全链、外部系统集成和 AI 自动化

核心结果：

- 至少 1-2 个 Agent 可稳定服务真实业务场景
- Agent 工具与审计真正进入生产闭环

## 10. 月度开发计划

### M1：平台读模型收口

- 把平台页现有静态数据读取统一迁到 `platform/*` API
- 优先处理：
  - `operations`
  - `stations`
  - `network`
  - `rules`
  - `master-data`
  - `reports`
- 验收：
  - 平台页不再直接 import `data/sinoport*.js`

### M2：货站总览与资源页收口

- 处理：
  - `station/dashboard`
  - `station/inbound`
  - `station/outbound`
  - `station/resources*`
  - `station/reports*`
- 验收：
  - 货站总览页全部通过 API 读取

### M3：货站动作页读模型收口

- 处理：
  - `documents`
  - `documents/noa`
  - `documents/pod`
  - `tasks`
  - `exceptions`
  - `shipments`
- 验收：
  - 页面不再依赖 adapter 静态结构作为主数据源

### M4：移动端读模型收口

- 处理：
  - `inbound-shared`
  - `outbound-shared`
  - `node-shared`
  - `*-detail`
- 验收：
  - 移动端 detail flow 主要读模型来自后端

### M5：Demo 数据过渡层清理

- 开始缩减 `demo_datasets` 的直接前端消费
- 把稳定结构逐步迁成正式业务表或正式只读视图
- 验收：
  - `demo_datasets` 只作为过渡/回放用途

### M6：真实业务数据导入链

- 建立至少一条正式数据导入链：
  - 文件导入
  - API 接入
  - 回写审计
- 验收：
  - 真实业务数据可进入 `staging`

### M7：站点真实试运行

- 选 1 个真实站点做试运行
- 对真实 inbound 主链做问题回收与修复
- 验收：
  - 至少一个站点跑通真实业务链

### M8：出港深化

- 深化出港动作链
- 明确 `Manifest / Loaded / Airborne / Exception` 细规则
- 验收：
  - 出港链不再只是演示深度

### M9：平台运营报表

- 实现：
  - 平台日报
  - 站点日报
  - 异常日报
- 验收：
  - 至少 3 份报表可以稳定产出

### M10：多站点模板化

- 站点参数、角色、区位、设备、规则模板化
- 验收：
  - 新站点接入主要靠配置，不靠重写页面

### M11：Agent 产品化

- 把 `station/copilot` 从会话壳升级为真实业务助理
- 优先：
  - `Station Copilot`
  - `Document Agent`
- 验收：
  - 至少 1 个 Agent 在真实数据上可用

### M12：年度收口与下一阶段决策

- 复盘：
  - 数据模型
  - 报表
  - Agent 使用效果
  - 基础设施成本
- 决定下一阶段是否做：
  - 多系统深集成
  - 更强 Agent 自动化
  - PostgreSQL / 更重数据架构迁移

## 11. 优先级分层

### P0：必须持续推进

- 清理前端直接读 Demo 数据
- 平台/货站/移动端读模型 API 化
- 真实业务数据导入
- 安全与 secret 治理

### P1：主线稳定后推进

- 报表
- 多站点配置化
- 更完整出港深化
- 主数据治理完善

### P2：有了真实数据后再重点做

- Agent 产品化
- 更重自动化
- 更复杂跨系统集成

## 12. 团队分工建议

### 后端

- 负责 API、Repository、数据模型、导入链、审计、权限、任务流

### 前端

- 负责页面从静态读取切到 API hook
- 保留 adapter 仅做视图层转换
- 清理对 `data/sinoport*.js` 的主依赖

### QA

- 负责按季度维护回归清单
- 增加真实数据 smoke
- 增加发布后验收流程

### 产品/业务

- 负责确定真实业务数据接入范围
- 冻结站点模板和规则优先级
- 评估 Agent 是否真的进入生产

## 13. 风险与对策

### 风险 1：前端静态数据太多，切换成本高

对策：

- 不一次性删完
- 先让 API 成为第一数据源
- 再逐步把 adapter 清空

### 风险 2：真实业务数据接入晚于页面改造

对策：

- `demo_datasets` 先做数据库过渡层
- 保持接口形状稳定

### 风险 3：移动端规则继续散落在前端

对策：

- 把 detail flow 优先后端化
- 不让前端长期维护业务真相

### 风险 4：构建产物持续污染仓库

对策：

- 下一轮优先处理产物治理
- 尽量改成 CI-only 或临时目录产物

## 14. 我对后续安排的建议

如果只能选一条最重要主线，我建议未来 8-12 周都围绕这件事推进：

`把 platform / station / mobile 三层的读模型全部迁到数据库/API 驱动。`

原因很简单：

1. 这是清理当前技术债的主轴
2. 这是让真实业务数据接入变得可行的前提
3. 这是后续 Agent 真正有价值的前提

也就是说：

- 先别再铺更多页面
- 先别把精力放在新视觉表达
- 先把“所有读路径都来自真实数据库”这件事做实

## 15. 当前结论

Demo 数据入库已经完成。  
真正的后续开发主线已经很清楚：

1. 清理前端直接读本地数据
2. 统一改成数据库/API 读模型
3. 再接真实业务数据
4. 最后再把 Agent 做成真正的生产能力

Demo 数据入库这件事已经完成。  
真正还没做完的，不是“有没有数据”，而是“还有哪些页面仍然直接从源码模块取数据，而不是从数据库/API 读取”。
