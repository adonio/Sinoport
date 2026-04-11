# Sinoport OS 产品需求文档 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：开发版
- 更新时间：`2026-04-11`
- 替代文档：[platform-and-station-prd.md](/Users/lijun/Downloads/Sinoport/docs/platform-and-station-prd.md)
- 参考输入：
  - [Sinoport_OS_PRD_v1.0_升级开发版_标注稿.md](/Users/lijun/Downloads/Sinoport_OS_PRD_v1.0_升级开发版_标注稿.md)
  - [business-model-summary.md](/Users/lijun/Downloads/Sinoport/docs/business-model-summary.md)
  - [product-architecture.md](/Users/lijun/Downloads/Sinoport/docs/product-architecture.md)
  - [sinoport-os-front-demo-coverage-matrix.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-front-demo-coverage-matrix.md)
  - [sinoport-os-upgrade-task-plan.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-upgrade-task-plan.md)
  - [Sinoport_OS_字段字典_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_字段字典_v1.0.md)
  - [Sinoport_OS_状态归属矩阵_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_状态归属矩阵_v1.0.md)
  - [Sinoport_OS_API_Contract_Draft_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_API_Contract_Draft_v1.0.md)

## 2. 本版定位

本版接受客户在标注稿中的升级意见，不再把 PRD 定位为“原型评审说明”，而是定位为下一阶段升级开发的主依据。

本版主要目标：

1. 把当前前端已完成能力和客户要求的 v1.0 范围统一到一份文档里。
2. 把对象模型、状态模型、信息架构、单证链、任务链和 PDA 终端边界一次性拉直。
3. 给研发、测试、实施一份可以直接拆分任务和制定验收标准的基础版本。

## 3. 客户意见已吸收的升级点

本版已正式吸收以下客户修改方向：

- 平台侧恢复并升级为“运行态势中心”主入口。
- 平台侧补足“报表中心”归属。
- 货站侧早期站内模块已统一升级为：
  - 提单与履约链路
  - 单证与指令中心
  - 作业指令中心
  - PDA 作业终端
- 对象层补入：
  - `Execution Node`
  - `Role Dictionary / Skill Tag`
- 增加字段字典要求。
- 增加状态归属矩阵要求。
- 文档边界从“站内原型”升级为“端到端履约控制层”。

## 4. 产品定位与范围

### 4.1 产品定位

Sinoport OS 不是传统货运工具，也不是脱离现场的通用 SaaS，而是一套 `Promise-Driven Fulfillment` 承诺兑现型履约控制系统。

系统核心不是单纯记录货物流，而是通过：

- 平台编排
- 文件驱动
- 任务驱动
- PDA 执行
- 审计取证

把履约过程做成可视、可控、可追责的操作系统。

### 4.2 本期覆盖范围

本期覆盖：

- 平台管理后台
- 货站后台
- PDA 作业终端
- 必要的司机/外部轻量协同端表达

本期覆盖的执行节点：

1. 前置仓收货
2. 头程卡车运输
3. 出港机场货站操作
4. 出港机场机坪操作
5. 航班运行
6. 进港机场机坪操作
7. 进港机场货站操作
8. 尾程卡车装车与运输
9. 交付仓

### 4.3 本期不实现但必须预留

- ERP / 供应链系统真实联通
- 财务结算、合同、利润报表
- 客户门户
- 真实链上写入、RWA
- 复杂排班与优化算法
- 真实对象存储、消息队列、工作流引擎

## 5. 当前开发基线

### 5.1 当前已经完成

当前代码与 demo 已经完成三类前端原型：

- 企业官网静态站
- 桌面端后台原型
- 移动端 PDA 原型

当前线上入口：

- 官网：[https://sinoport.co/](https://sinoport.co/)
- 后台 demo：[https://adonio-sinoport-admin.pages.dev/](https://adonio-sinoport-admin.pages.dev/)

### 5.2 当前技术基线

- React 19
- Vite 7
- MUI 7
- React Router 7
- Mantis 管理后台模板

### 5.3 当前前端已覆盖模块

平台侧已覆盖：

- 运行态势中心
- 货站与资源管理
- 航线网络与链路配置
- 规则与指令引擎
- 主数据与接口治理
- 审计与可信留痕
- 平台报表

货站侧已覆盖：

- 货站看板
- 进港管理
- 出港管理
- 提单与履约链路
- 单证与指令中心
- 作业指令中心
- 资源管理
- 异常中心
- 报表中心

PDA 侧已覆盖：

- 登录与节点选择
- 前置仓
- 头程卡车
- 出港货站
- 出港机坪
- 航班运行
- 到港机坪
- 进港货站
- 尾程
- 交付仓

### 5.4 当前仍是 demo 的内容

虽然页面结构已经覆盖较完整，但以下能力仍然只是 demo 表达：

- 状态推进
- 文件上传
- 权限控制
- 任务编排
- 接口同步
- 审计入库
- 主数据落库

## 6. 系统总体架构

### 6.1 四层数字架构

| 层级 | 职责 |
| --- | --- |
| ERP 层 | 合同、客户、结算、经营事实 |
| 供应链系统层 | 订单、仓、车、配送、交付链路 |
| Sinoport OS 控制层 | 任务编排、状态机、单证驱动、PDA 执行 |
| 可信数据预留层 | Event Hash、Signature、Notarization 预留 |

### 6.2 运行模式

- Flight Runtime Status：航班运行状态
- Ground Fulfillment Status：地面履约状态
- Task Status：任务状态
- Document Status：文件完整性与放行状态

## 7. 信息架构

### 7.1 平台管理后台

一级模块：

- 运行态势中心
- 货站与资源管理
- 航线网络与链路配置
- 规则与指令引擎
- 主数据与接口治理
- 审计与可信留痕
- 平台级报表

当前 demo 入口：

- `/platform/operations`
- `/platform/stations`
- `/platform/network`
- `/platform/rules`
- `/platform/master-data`
- `/platform/audit`
- `/platform/reports`

### 7.2 货站后台

一级模块：

- 货站看板
- 进港管理
- 出港管理
- 提单与履约链路
- 单证与指令中心
- 作业指令中心
- 资源管理
- 异常中心
- 货站报表

二级结构：

| 一级模块 | 二级模块 |
| --- | --- |
| 进港管理 | 总览、航班管理、PDA 作业终端、提单管理 |
| 出港管理 | 总览、航班管理、提单管理 |
| 单证与指令中心 | 单证总览、NOA、POD |
| 资源管理 | 班组、区位、设备、车辆 |
| 货站报表 | KPI 总览、班次报表 |

### 7.3 PDA 作业终端

节点入口：

- 登录
- 节点选择
- 前置仓
- 头程卡车
- 出港货站
- 出港机坪
- 航班运行
- 到港机坪
- 进港货站
- 尾程
- 交付仓

## 8. 核心对象模型

### 8.1 业务对象

| 对象 | 说明 |
| --- | --- |
| Station | 货站或机场节点 |
| Warehouse | 前置仓 / 交付仓 |
| Flight | 航班实体 |
| Order | 客户订单 |
| Shipment | 履约主实体 |
| AWB / HAWB | 空运主单 / 分单 |
| ULD / PMC | 装载单元 |
| Truck | 头程 / 尾程车辆 |
| Delivery Order | 交付指令 |
| Customer | 发货方 / 收货方 |

### 8.2 文件对象

| 对象 | 说明 |
| --- | --- |
| CMR | 陆运交接文件 |
| Origin POD | 前置仓到出港站交接证明 |
| CBA | 组板与板货关系文件 |
| FFM | 货物预报 |
| UWS | 装载信息 |
| Manifest | 舱单交换与目的港对账 |
| Handling Plan | 到港站执行计划 |
| Breakdown Plan | PMC 拆板任务计划 |
| Sorting Sheet | 分区指令 |
| Truck Loading Order | 装车指令 |
| Destination POD | 交付签收证明 |
| Warehouse Receipt | 交付仓签收回执 |

### 8.3 控制对象

| 对象 | 说明 |
| --- | --- |
| Execution Node | 九段执行节点的正式对象 |
| Task | 系统派发的最小执行单元 |
| Work Instruction | 操作标准、提取点、目标点、证据要求 |
| Team / Crew | 班组 |
| Worker | 人员 |
| Device | PDA / 终端 |
| Zone / Location | 物理位置 |
| Evidence | 扫码、照片、签字、备注等证据 |
| Exception | 异常对象 |
| Event | 关键业务事件 |
| Audit Log | 审计日志 |
| Role Dictionary | 角色字典 |
| Skill Tag | 岗位技能标签 |

### 8.4 字段字典要求

本版冻结字段字典的对象范围：

- Flight
- Shipment
- AWB
- ULD / PMC
- Truck
- Task
- Worker
- Zone
- Document
- Exception

每个字段在下一版字段字典中必须补齐：

- 字段名
- 字段类型
- 是否必填
- 是否可编辑
- 默认值
- 校验规则
- 来源系统
- 是否进入审计
- 是否参与硬门槛

配套文档：

- [Sinoport_OS_字段字典_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_字段字典_v1.0.md)

## 9. 状态模型与归属矩阵

### 9.1 航班运行状态

| 状态 | 挂载对象 |
| --- | --- |
| Scheduled / Pre-Departure / Airborne / Pre-Arrival / Landed / Delayed / Diverted / Cancelled | Flight |

### 9.2 地面履约状态

| 状态 | 挂载对象 |
| --- | --- |
| Front Warehouse Receiving / First-Mile In Transit / Origin Terminal Handling / Origin Ramp Handling / In Flight / Destination Ramp Handling / Inbound Handling / Tail-Linehaul In Transit / Delivered / Closed | Shipment |

### 9.3 任务状态

| 状态 | 挂载对象 |
| --- | --- |
| Created / Assigned / Accepted / Arrived at Location / Started / Evidence Uploaded / Completed / Verified / Handed Over / Closed / Rejected / Rework / Exception Raised | Task |

### 9.4 文档状态

| 状态 | 挂载对象 |
| --- | --- |
| Draft / Uploaded / Parsed / Validated / Missing / Replaced / Approved / Released | Document |

配套文档：

- [Sinoport_OS_状态归属矩阵_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_状态归属矩阵_v1.0.md)

## 10. 平台管理后台详细需求

### 10.1 运行态势中心

目标：

- 成为平台层主入口
- 展示航班运行态、地面履约态、承诺风险和执行任务

当前进度：

- 已有页面原型
- 已覆盖平台级态势、站点健康度、链路风险和待处理动作

验收入口：

- [https://sinoport.co/platform/operations](https://sinoport.co/platform/operations)

开发要求：

- 后续需接入真实任务、真实状态和真实异常聚合

### 10.2 货站与资源管理

目标：

- 管理货站、仓、机坪、区位、设备、班组、车辆

当前进度：

- 货站台账、能力、班组、区位、设备页面已覆盖

验收入口：

- 总览：[https://sinoport.co/platform/stations](https://sinoport.co/platform/stations)
- 站点能力矩阵：[https://sinoport.co/platform/stations/capabilities](https://sinoport.co/platform/stations/capabilities)
- 班组映射：[https://sinoport.co/platform/stations/teams](https://sinoport.co/platform/stations/teams)
- 区位映射：[https://sinoport.co/platform/stations/zones](https://sinoport.co/platform/stations/zones)
- 设备映射：[https://sinoport.co/platform/stations/devices](https://sinoport.co/platform/stations/devices)

开发要求：

- 后续需接入真实资源模型和站点配置

### 10.3 航线网络与链路配置

目标：

- 管理主链路、中转链路、SLA 和场景模板

当前进度：

- 总览、链路模板、标准场景页面已覆盖

验收入口：

- 总览：[https://sinoport.co/platform/network](https://sinoport.co/platform/network)
- 链路模板：[https://sinoport.co/platform/network/lanes](https://sinoport.co/platform/network/lanes)
- 标准场景：[https://sinoport.co/platform/network/scenarios](https://sinoport.co/platform/network/scenarios)

### 10.4 规则与指令引擎

目标：

- 维护硬门槛、状态进入规则、任务生成规则、证据要求

当前进度：

- 规则与指令引擎页面已覆盖
- `HG-01` 至 `HG-08` 已在前端表达

验收入口：

- [https://sinoport.co/platform/rules](https://sinoport.co/platform/rules)

### 10.5 主数据与接口治理

目标：

- 统一对象主键
- 展示接口接入状态和同步治理

当前进度：

- 页面已覆盖，但仍是 demo 数据

验收入口：

- 主数据总览：[https://sinoport.co/platform/master-data](https://sinoport.co/platform/master-data)
- 同步看板：[https://sinoport.co/platform/master-data/sync](https://sinoport.co/platform/master-data/sync)
- 导入任务：[https://sinoport.co/platform/master-data/jobs](https://sinoport.co/platform/master-data/jobs)
- 对象关系：[https://sinoport.co/platform/master-data/relationships](https://sinoport.co/platform/master-data/relationships)

### 10.6 审计与可信留痕

目标：

- 支持变更链、审计链和可信字段预留

当前进度：

- 审计与可信留痕、事件明细、可信留痕页已覆盖

验收入口：

- 审计与可信留痕：[https://sinoport.co/platform/audit](https://sinoport.co/platform/audit)
- 审计事件明细：[https://sinoport.co/platform/audit/events](https://sinoport.co/platform/audit/events)
- 可信留痕占位：[https://sinoport.co/platform/audit/trust](https://sinoport.co/platform/audit/trust)

## 11. 货站后台详细需求

### 11.1 货站看板

目标：

- 成为站内主管主入口
- 展示进港、出港、待办、阻断、异常和 KPI

当前进度：

- 页面已覆盖

验收入口：

- [https://sinoport.co/station/dashboard](https://sinoport.co/station/dashboard)

### 11.2 进港管理

子模块：

- 看板
- 航班管理
- 航班详情
- 提单管理
- PDA 作业终端

当前进度：

- 以上页面均已覆盖原型

验收入口：

- 进港总览：[https://sinoport.co/station/inbound](https://sinoport.co/station/inbound)
- 进港航班管理：[https://sinoport.co/station/inbound/flights](https://sinoport.co/station/inbound/flights)
- 航班详情样例：[https://sinoport.co/station/inbound/flights/SE803](https://sinoport.co/station/inbound/flights/SE803)
- 进港提单管理：[https://sinoport.co/station/inbound/waybills](https://sinoport.co/station/inbound/waybills)
- PDA 作业终端入口：[https://sinoport.co/station/inbound/mobile](https://sinoport.co/station/inbound/mobile)

开发重点：

- 统一进港状态链与任务链
- 把 NOA / POD / Transfer 回连到航班与提单对象

### 11.3 出港管理

子模块：

- 看板
- 航班管理
- 提单管理

当前进度：

- 页面已覆盖原型

验收入口：

- 出港总览：[https://sinoport.co/station/outbound](https://sinoport.co/station/outbound)
- 出港航班管理：[https://sinoport.co/station/outbound/flights](https://sinoport.co/station/outbound/flights)
- 出港提单管理：[https://sinoport.co/station/outbound/waybills](https://sinoport.co/station/outbound/waybills)

开发重点：

- 出港预报
- 收货
- 主单
- 装载
- UWS
- Manifest
- 飞走确认

### 11.4 提单与履约链路

目标：

- 按 Shipment / AWB 统一展示一票货从前置仓到交付仓的全链路

当前进度：

- 页面已覆盖
- 详情页已覆盖

验收入口：

- 列表：[https://sinoport.co/station/shipments](https://sinoport.co/station/shipments)
- 进港详情样例：[https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585)
- 出港详情样例：[https://sinoport.co/station/shipments/out-436-10357583](https://sinoport.co/station/shipments/out-436-10357583)

### 11.5 单证与指令中心

目标：

- 让文件不再只是附件，而是进入状态放行和任务触发链路

当前进度：

- 单证与指令中心、NOA、POD 页面已覆盖

验收入口：

- 单证与指令中心：[https://sinoport.co/station/documents](https://sinoport.co/station/documents)
- `NOA` 动作页：[https://sinoport.co/station/documents/noa](https://sinoport.co/station/documents/noa)
- `POD` 动作页：[https://sinoport.co/station/documents/pod](https://sinoport.co/station/documents/pod)

### 11.6 作业指令中心

目标：

- 展示站内任务池、分派、升级、交接和完成状态

当前进度：

- 页面已覆盖原型

验收入口：

- [https://sinoport.co/station/tasks](https://sinoport.co/station/tasks)

### 11.7 资源管理

目标：

- 管理 Team、Worker、Zone、Device、Vehicle

当前进度：

- 页面已覆盖原型

验收入口：

- 总览：[https://sinoport.co/station/resources](https://sinoport.co/station/resources)
- 班组：[https://sinoport.co/station/resources/teams](https://sinoport.co/station/resources/teams)
- 区位：[https://sinoport.co/station/resources/zones](https://sinoport.co/station/resources/zones)
- 设备：[https://sinoport.co/station/resources/devices](https://sinoport.co/station/resources/devices)
- 车辆：[https://sinoport.co/station/resources/vehicles](https://sinoport.co/station/resources/vehicles)

### 11.8 异常中心

目标：

- 支持异常登记、归因、阻断、恢复和闭环

当前进度：

- 列表与详情页已覆盖原型

验收入口：

- 列表：[https://sinoport.co/station/exceptions](https://sinoport.co/station/exceptions)
- 详情样例：[https://sinoport.co/station/exceptions/EXP-0408-001](https://sinoport.co/station/exceptions/EXP-0408-001)

### 11.9 货站报表

目标：

- 输出站点 KPI 与班次报表

当前进度：

- 页面已覆盖原型

验收入口：

- 货站报表：[https://sinoport.co/station/reports](https://sinoport.co/station/reports)
- 班次报表：[https://sinoport.co/station/reports/shift](https://sinoport.co/station/reports/shift)

## 12. PDA 作业终端详细需求

### 12.1 终端角色

- 仓收货岗
- 头程司机
- 出港货站岗
- 出港机坪岗
- 航班运行查看岗
- 到港机坪岗
- 进港货站岗
- 尾程司机
- 交付仓岗

### 12.2 统一动作

- 扫码
- 拍照
- 上传证据
- 签字
- 确认
- 挂起
- 转派
- 异常上报

### 12.3 当前进度

- 登录与站点选择已覆盖
- 九个节点页面已覆盖原型
- 进港拆板、理货、托盘、装车
- 出港收货、计数、PMC、装机
- 头尾程与交付仓页均已覆盖原型

验收入口：

- 登录：[https://sinoport.co/mobile/login](https://sinoport.co/mobile/login)
- 节点选择：[https://sinoport.co/mobile/select](https://sinoport.co/mobile/select)
- 前置仓：[https://sinoport.co/mobile/pre-warehouse](https://sinoport.co/mobile/pre-warehouse)
- 头程卡车：[https://sinoport.co/mobile/headhaul](https://sinoport.co/mobile/headhaul)
- 出港货站：[https://sinoport.co/mobile/outbound](https://sinoport.co/mobile/outbound)
- 出港机坪：[https://sinoport.co/mobile/export-ramp](https://sinoport.co/mobile/export-ramp)
- 航班运行：[https://sinoport.co/mobile/runtime](https://sinoport.co/mobile/runtime)
- 到港机坪：[https://sinoport.co/mobile/destination-ramp](https://sinoport.co/mobile/destination-ramp)
- 进港货站：[https://sinoport.co/mobile/inbound](https://sinoport.co/mobile/inbound)
- 尾程：[https://sinoport.co/mobile/tailhaul](https://sinoport.co/mobile/tailhaul)
- 交付仓：[https://sinoport.co/mobile/delivery](https://sinoport.co/mobile/delivery)

## 13. 任务编排与标准场景

任务编排必须围绕以下链条表达：

- 文件齐备
- 状态进入
- 自动生成任务
- PDA 执行任务
- 上传证据
- 复核放行
- 进入下一节点

标准场景需至少覆盖：

1. `MME` 进港样板站流程
2. URC 出港标准链路
3. 头程卡车交接链路
4. 尾程交付签收链路

验收入口：

- 场景入口：[https://sinoport.co/platform/network/scenarios](https://sinoport.co/platform/network/scenarios)
- 货站任务视图：[https://sinoport.co/station/tasks](https://sinoport.co/station/tasks)
- MME 进港样例：[https://sinoport.co/mobile/inbound/SE803/breakdown](https://sinoport.co/mobile/inbound/SE803/breakdown)
- URC 出港样例：[https://sinoport.co/mobile/outbound/SE913/receipt](https://sinoport.co/mobile/outbound/SE913/receipt)

## 14. 单证链与文件驱动规则

文件链必须覆盖：

- CMR
- Origin POD
- CBA
- FFM
- UWS
- Manifest
- Handling Plan
- Breakdown Plan
- Sorting Sheet
- Truck Loading Order
- Destination POD
- Warehouse Receipt

核心规则：

- 文件缺失时必须阻断相关状态或任务
- 文件版本变化必须可追溯
- 文件必须绑定业务对象

验收入口：

- 文件链总览：[https://sinoport.co/station/documents](https://sinoport.co/station/documents)
- 履约对象回连样例：[https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585)
- `NOA` / `POD` 动作页：[https://sinoport.co/station/documents/noa](https://sinoport.co/station/documents/noa) / [https://sinoport.co/station/documents/pod](https://sinoport.co/station/documents/pod)

## 15. 硬门槛规则

基础硬门槛：

- 进港未理货完成不得发送 `NOA`
- 进港无二次转运记录不得放行
- 进港无 `POD` 不得关闭交付
- 出港未完成主单不得装载
- 出港无 `UWS` 不得标记已装载
- 出港无 Manifest 不得标记已归档
- 缺证据不得完成任务验证
- 缺文件不得推进到下一执行节点

验收入口：

- 平台规则页：[https://sinoport.co/platform/rules](https://sinoport.co/platform/rules)
- 货站任务池：[https://sinoport.co/station/tasks](https://sinoport.co/station/tasks)
- 履约对象样例：[https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585)
- 异常样例：[https://sinoport.co/station/exceptions/EXP-0408-001](https://sinoport.co/station/exceptions/EXP-0408-001)

## 16. 开发现状与后续开发边界

### 16.1 当前已完成

- 信息架构已基本成型
- 平台端主要页面已覆盖
- 货站端主要页面已覆盖
- PDA 九节点原型已覆盖

章节验收入口：

- 平台主入口：[https://sinoport.co/platform/operations](https://sinoport.co/platform/operations)
- 货站主入口：[https://sinoport.co/station/dashboard](https://sinoport.co/station/dashboard)
- PDA 主入口：[https://sinoport.co/mobile/login](https://sinoport.co/mobile/login)

### 16.2 当前未完成

- 后端与数据库
- 真实文件
- 真实权限
- 真实任务编排
- 真实接口
- 真实审计入库

## 17. 开发与验收建议

建议下一步按以下顺序推进：

1. 冻结信息架构与对象字典
2. 冻结字段字典与状态归属矩阵
3. 冻结 API Contract 草稿
4. 优先完成 `MME` 进港样板站闭环
5. 再完成 URC 出港标准链路闭环
6. 最后进入真实接口、后端、权限和文件流开发
