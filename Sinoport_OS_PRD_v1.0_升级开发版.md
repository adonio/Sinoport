## Sinoport OS

# 产品需求文档（升级开发版）

面向平台控制层、货站后台与 PDA 作业终端的一体化升级开发说明

**文档定位：** 本文件不是评审提纲，而是用于指导系统升级开发、联调、测试与验收的正式 PRD。

|文档版本|v1.0|
|---|---|
|**文档状态**|开发冻结版|
|**适用对象**|合伙人 / 产品 / 研发 / 测试 / 实施 / 运维|
|**编制日期**|2026-04-07|
|**替代文档**|Sinoport 平台管理后台与货站后台 PRD v0.2|
|**核心目标**|作为下一阶段系统升级开发的唯一功能依据|

**输入依据：** 本版已吸收现有初版 PRD、MME 货站 SOP、前期商业模型讨论，以及围绕平台层、对象层、PDA 终端、单证驱动和接口预留形成的全部修改结论。

**线上验收域名：** [https://sinoport.co/](https://sinoport.co/)

**本次回填原则：** 以下各功能章节均补充了当前前端 demo 的线上验收入口，客户可直接按章节打开对应链接核对实现情况。

## 目录

- 1. 文档目的与使用方式
- 2. 对初版 v0.2 的升级结论
- 3. 产品定位、目标与范围
- 4. 系统总体架构
- 5. 信息架构
- 6. 核心对象模型
- 7. 状态模型与链路口径
- 8. 平台管理后台详细需求
- 9. 货站后台详细需求
- 10. PDA 作业终端详细需求
- 11. 任务编排引擎与标准场景
- 12. 单证链与文件驱动规则
- 13. 硬门槛规则
- 14. 接口、主数据与可信留痕预留
- 15. KPI、报表与非功能要求
- 16. 验收标准与开发实施顺序
- 17. 附录：术语、状态字典与替换映射
**阅读建议：** 研发团队优先阅读第 5-14 章；测试团队重点关注第 7、11、12、13、16 章；实施与运维团队重点关注第 8-10、14-16 章。

## 1. 文档目的与使用方式

本文件用于指导 Sinoport OS 的下一阶段系统升级开发、联调、测试与验收。与初版 v0.2 不同，本版不再以“客户评审原型”作为主要目标，而是将系统边界、对象模型、状态模型、模块职责、PDA 作业角色、单证驱动规则和接口预留原则一次性拉直，作为后续研发迭代的共同基线。

**文档适用对象包括：** 合伙人、产品经理、项目经理、前后端开发、测试、实施、运维，以及后续参与ERP、供应链系统、外部接口对接的团队。

**使用原则：** 凡与本文件冲突的旧版原型说明、零散口头结论、页面截图、评审备注，均以本文件为准；本文件未覆盖但必须开发的内容，须先补充 PRD 再进入开发。

## 1. 1 文档目的

- 给开发团队提供可直接升级开发的功能边界、对象定义、状态流转和页面职责。
- 给测试团队提供可设计测试用例的状态口径、硬门槛规则和验收标准。
- 给实施与运维团队提供站点接入、班组管理、设备管理、接口治理和周报输出的统一口径。
- 给合伙人与管理层提供一份可复用的系统蓝图，用于后续扩站、扩链路和连接 ERP / 供应链系统。
## 1. 2 本版适用范围

**本版覆盖的平台包括：** 平台管理后台、货站后台、PDA 作业终端，以及必要的司机 / 外部协同轻量端。

本版覆盖的履约链路，从前置仓收货开始，到交付仓签收结束，具体包括 9 个执行节点：前置仓收货、头程卡车运输、出港机场货站操作、出港机场机坪操作、航班运行、进港机场机坪操作、进港机场货站操作、尾程卡车装车与运输、交付仓。

## 1. 3 本版不覆盖但必须预留

- 财务结算、发票、经营分析与利润报表。
- 客户自助门户、对外查询门户与多企业外部协同门户。
- 真实的链上写入、通证化或 RWA 业务能力。
- 自动排班算法、复杂资源优化算法和动态计价。
## 2. 对初版 v0.2 的升级结论

初版 v0.2 的价值，在于明确了平台管理后台与货站后台的基础菜单、核心对象、进港 / 出港主状态链，以及航班、提单、NOA、POD、Manifest 等模块的大体边界。本版在完全继承其对象意识与货站操作主线的基础上，完成了 6 个层面的升级。

|升级维度|初版 v0.2|本版 v1.0|
|---|---|---|
|产品边界|站内进港 / 出港为主|端到端履约控制层，覆盖仓-港-<br>飞-港-末端|
|平台层|货站管理 / 航线网络 / 规则中心<br>/ 审计中心|运行态势中心 + 规则与指令引<br>擎 + 主数据与接口治理 + 审计<br>与可信留痕|
|货站层|看板、航班、提单、文件、异<br>常|看板 + 履约链路 + 单证与指令<br>中心 + 作业指令中心 + 班组 / 区<br>位 / 设备|
|移动端|手机理货原型|PDA 岗位任务终端|
|文件逻辑|文件留存和列表查看|文件驱动状态流转与任务生成|
|对象层|后台角色 + 业务对象|业务对象 + 控制对象 + 任务对<br>象 + 证据对象 + 现场角色|

**最关键的升级结论是：** Sinoport OS 不再被定义为“更完整的货站后台”，而是被定义为“平台编排任务、文件驱动执行、PDA 完成作业、证据支撑审计、状态自动流转”的承诺兑现型履约操作系统。

## 2. 1 必须替换的旧概念

|旧说法 / 旧模块|本版统一口径|
|---|---|
|平台总览（移除）|恢复并升级为“运行态势中心”|
|文件中心|升级为“单证与指令中心”|
|提单管理|升级为“提单与履约链路”|
|手机理货|升级为“PDA 作业终端”|
|Turnaround|在货物履约语境中统一替换为 “Inbound<br>Handling / 进港操作态”|
|只看航班状态|改为“航班运行状态 + 地面履约状态”双状态机|

## 3. 产品定位、目标与范围

## 3. 1 产品定位

Sinoport OS 的定位不是传统货运工具，也不是脱离现场的通用 SaaS，而是一套 Promise-Driven Fulfillment（承诺兑现型履约）控制系统。系统目标不是简单记录流程，而是把跨境航空货运网络中的关键节点做成可见、可控、可追责、可指令化执行的状态机。

**核心定义：** Sinoport OS 不是在记录“货是怎么走的”，而是在控制“客户承诺如何被兑现”。

## 3. 2 设计原则

## 1. 产品定义价值，系统保障交付，解决方案适配场景。

## 2. 全链路可见，关键节点可控，外部节点可接。

## 3. 平台层编排任务，PDA 端执行任务；后台负责控制，终端负责完成。

## 4. 文件不是附件，而是状态放行与任务生成的触发条件。

## 5. 事件先于报表，审计先于美化，主数据先于接口。

## 3. 3 本期业务目标

- 建立覆盖多货站、多链路、多班组的统一履约控制后台。
- 统一管理从前置仓到交付仓的航班、货物、文件、状态、任务与异常。
- 形成以 Flight / Shipment / AWB / ULD / Truck / Task / POD / Event 为主键的控制链路。
- 让每个现场岗位只需要在 PDA 上完成自己的任务，即可自动触发下一环节。
## 3. 4 本期范围与非范围

|类别|说明|
|---|---|
|必须实现|平台管理后台升级、货站后台升级、PDA 正式<br>化、任务编排、文件上传与版本、审计日志、基<br>础接口治理、报表输出|
|必须预留|ERP 接口、供应链系统接口、航班状态接口、末<br>端状态接口、Event Hash / Signature 字段|
|暂不实现|财务结算、客户门户、真实链上写入、<br>Tokenization/RWA、复杂智能调度算法|

## 4. 系统总体架构

## 4. 1 四层数字架构

|层级|职责|
|---|---|
|ERP 层|承接包机业务经营事实、合同、成本收入、结算<br>关系。|
|供应链系统层|承接订单、仓、车、配送、交付等完整业务链<br>路。|
|Sinoport OS 控制层|负责运行控制、任务编排、单证驱动、状态机与<br>执行闭环。|
|可信数据预留层|保留 Event Hash、审计链与未来权利映射接<br>口，但本期不实现链上能力。|

## 4. 2 执行节点边界

**链路定义：** 前置仓收货 -> 头程卡车运输 -> 出港机场货站操作 -> 出港机场机坪操作 -> 航班运行-> 进港机场机坪操作 -> 进港机场货站操作 -> 尾程卡车装车与运输 -> 交付仓

## 4. 3 运行模式

- 状态机驱动：Flight Runtime Status、Ground Fulfillment Status、Task Status 三条状态链并行运
行。

- 文件驱动：关键单证齐全后，系统才允许生成下一步执行任务。
- 任务驱动：平台层派发任务，PDA 端执行、取证、交接。
- 审计驱动：每个关键动作都可追溯到人、设备、时间、对象和证据。
## 5. 信息架构

## 5. 1 平台管理后台

|模块|职责|
|---|---|
|运行态势中心|统一展示航班运行态、履约运行态、承诺风险与<br>执行任务。|
|货站与资源管理|管理货站、仓、机坪、区位、班组、设备。|
|航线网络与链路配置|管理主链路、中转链路、节点 SLA、服务等级。|
|规则与指令引擎|配置状态进入规则、硬门槛规则、任务生成规<br>则、异常字典。|
|主数据与接口治理|统一主键、映射对象、管理接口接入与预留。|
|审计与可信留痕|记录操作链、变更链、放行链，预留 Event<br>Hash / Signature 字段。|

**当前前端 Demo 导航入口：**

- [https://sinoport.co/platform/operations](https://sinoport.co/platform/operations)
- [https://sinoport.co/platform/stations](https://sinoport.co/platform/stations)
- [https://sinoport.co/platform/network](https://sinoport.co/platform/network)
- [https://sinoport.co/platform/rules](https://sinoport.co/platform/rules)
- [https://sinoport.co/platform/master-data](https://sinoport.co/platform/master-data)
- [https://sinoport.co/platform/audit](https://sinoport.co/platform/audit)
- [https://sinoport.co/platform/reports](https://sinoport.co/platform/reports)

## 5. 2 货站后台

|模块|职责|
|---|---|
|货站看板|展示今日进港/出港、待办任务、待复核、待签<br>收、异常与核心 KPI。|
|进港管理|管理落地到站后的航班、站内状态、拆板、理<br>货、NOA、交付。|
|出港管理|管理预报、收货、组板、文件链、机坪放行与飞<br>走确认。|
|提单与履约链路|按 AWB 视角查看一票货从前置仓到交付仓的全<br>链路。|
|单证与指令中心|管理单证上传、版本、对象绑定、文件完整性校<br>验与任务触发。|
|作业指令中心|查看航班级、PMC/AWB 级、Truck 级任务与执<br>行进度。|
|班组 / 区位 / 设备管理|管理 Team、Worker、Zone、Device 及容量占<br>用。|

|模块|职责|
|---|---|
|异常中心|集中处理短少、破损、混托、错装、缺文件、超<br>SLA 等异常。|
|报表中心|输出周报、任务报表、POD 报表、SLA 报表与站<br>点 KPI。|

**当前前端 Demo 导航入口：**

- [https://sinoport.co/station/dashboard](https://sinoport.co/station/dashboard)
- [https://sinoport.co/station/inbound](https://sinoport.co/station/inbound)
- [https://sinoport.co/station/outbound](https://sinoport.co/station/outbound)
- [https://sinoport.co/station/shipments](https://sinoport.co/station/shipments)
- [https://sinoport.co/station/documents](https://sinoport.co/station/documents)
- [https://sinoport.co/station/tasks](https://sinoport.co/station/tasks)
- [https://sinoport.co/station/resources](https://sinoport.co/station/resources)
- [https://sinoport.co/station/exceptions](https://sinoport.co/station/exceptions)
- [https://sinoport.co/station/reports](https://sinoport.co/station/reports)

## 5. 3 PDA 作业终端

|页面|职责|
|---|---|
|我的任务|仅展示当前角色的待执行任务。|
|任务详情|展示取货地点、操作标准、目标位置、证据要<br>求、时限与下一步触发。|
|扫码识别|扫描 AWB、箱号、ULD/PMC、托盘、车牌等对<br>象。|
|拍照取证|上传开工 / 完工照片、封签照片、异常照片。|
|异常上报|上报少件、破损、标签不符、位置不符、车牌不<br>符、文件缺失。|
|任务交接|完成确认、复核放行、交给下一角色。|
|我的班组 / 设备|展示个人班次、绑定设备、在线状态。|
|签收页|按角色完成司机签字、POD 签收、交付仓签收。|

**当前前端 Demo 导航入口：**

- 登录：[https://sinoport.co/mobile/login](https://sinoport.co/mobile/login)
- 节点选择：[https://sinoport.co/mobile/select](https://sinoport.co/mobile/select)
- 前置仓：[https://sinoport.co/mobile/pre-warehouse](https://sinoport.co/mobile/pre-warehouse)
- 头程卡车：[https://sinoport.co/mobile/headhaul](https://sinoport.co/mobile/headhaul)
- 出港货站：[https://sinoport.co/mobile/outbound](https://sinoport.co/mobile/outbound)
- 出港机坪：[https://sinoport.co/mobile/export-ramp](https://sinoport.co/mobile/export-ramp)
- 航班运行：[https://sinoport.co/mobile/runtime](https://sinoport.co/mobile/runtime)
- 到港机坪：[https://sinoport.co/mobile/destination-ramp](https://sinoport.co/mobile/destination-ramp)
- 进港货站：[https://sinoport.co/mobile/inbound](https://sinoport.co/mobile/inbound)
- 尾程装车：[https://sinoport.co/mobile/tailhaul](https://sinoport.co/mobile/tailhaul)
- 交付仓：[https://sinoport.co/mobile/delivery](https://sinoport.co/mobile/delivery)

## 6. 核心对象模型

对象层必须同时覆盖业务对象、文件对象、控制对象和证据对象。只有这样，系统才能从“记录货物流”升级为“控制任务流”。

## 6. 1 业务主对象

|对象|定义|
|---|---|
|Station|货站或机场节点。|
|Warehouse|前置仓 / 交付仓。|
|Flight|航班实体，承载运行状态。|
|Order|客户订单。|

|对象|定义|
|---|---|
|Shipment|履约主实体，可关联一票或多票 AWB。|
|AWB / HAWB|空运主单 / 分单。|
|ULD / PMC|装载单元。|
|Truck|头程 / 尾程卡车实体。|
|Delivery Order|末端交付指令。|
|Customer|发货方 / 收货方 / 平台客户。|

## 6. 2 文件主对象

|对象|定义|
|---|---|
|CMR|头程或尾程陆运交接文件。|
|Origin POD|前置仓到出港货站的交接证明。|
|CBA|组板与板货关系文件。|
|FFM|出港货物预报。|
|UWS|装载信息。|
|Manifest|舱单交换与目的港对账文件。|
|Handling Plan|到港站点执行计划。|
|Breakdown Plan|PMC 拆板任务计划。|
|Sorting / Zoning Sheet|分区与区位指令。|
|Truck Loading Order|尾程装车指令。|
|Destination POD|交付签收证明。|
|Warehouse Receipt|交付仓签收回执。|

## 6. 3 控制主对象

|对象|定义|
|---|---|
|Task|平台下发到岗位 / 班组的最小执行单元。|
|Work Instruction|任务标准、提取点、目标点、证据要求与安全提<br>示。|

|对象|定义|
|---|---|
|Team / Crew|班组实体。|
|Worker|现场工作人员实体。|
|Device|PDA 或轻量终端实体。|
|Zone / Location|物理位置对象。|
|Evidence|照片、扫码、签字、计数、备注等证据。|
|Exception|异常对象。|
|Event|关键业务 / 状态事件。|
|Audit Log|审计日志与变更记录。|

## 6. 4 关键字段（最小必备）

|对象|最小必备字段|
|---|---|
|Flight|Flight ID、Flight No、Flight Date、Origin、<br>Destination、STD/ETD、STA/ETA、Runtime<br>Status|
|Shipment|Shipment ID、Order ID、Service Level、<br>Promise SLA、Current Node、Current Status|
|AWB|AWB No、HAWB No、Shipment ID、Pieces、<br>Weight、Volume、Current Zone、Current<br>Truck|
|ULD / PMC|ULD/PMC ID、Flight ID、Build-up Status、<br>Breakdown Status、Assigned Zone|
|Truck|Truck ID、Plate No、Driver、Route、<br>Dispatch Status、CMR ID、POD ID|
|Task|Task ID、Task Type、Execution Node、<br>Assigned Role、Assigned Team、Pick/Drop<br>Location、SLA、Status|
|Worker|Worker ID、Role Type、Team ID、Shift、<br>Status、Bound Device|

|对象|最小必备字段|
|---|---|
|Evidence|Evidence ID、Task ID、Evidence Type、<br>Uploaded By、Timestamp、Verifcation<br>Status|

## 6. 5 对象关系原则

## 1. 一个 Flight 可关联多个 ULD / PMC 和多个 AWB。

## 2. 一个 Shipment 可关联多个 AWB / HAWB，并贯穿整条履约链路。

## 3. 一个 Task 必须关联一个执行节点，并至少关联一个业务对象。

## 4. 一个 Worker 必须隶属于一个 Team，可绑定一个 Device。

## 5. 一个 Zone 必须隶属于一个 Station，可作为 Task 的提取点或投放点。

## 6. 一个 CMR 或 POD 必须绑定 Truck、Driver、Shipment / AWB 与签收对象。

**当前前端 Demo 对应：**

- 对象关系总览：[https://sinoport.co/platform/master-data/relationships](https://sinoport.co/platform/master-data/relationships)
- 履约对象详情样例：[https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585)

## 7. 状态模型与链路口径

## 7. 1 航班运行状态（Flight Runtime Status）

|状态|定义|
|---|---|
|Scheduled|航班已创建但未进入起飞准备。|
|Pre-Departure|已进入起飞准备阶段。|
|Airborne|航班已实际起飞。|
|Pre-Arrival|预计落地前 60 分钟自动进入的到港预备态。|
|Landed|航班已实际落地。|
|Delayed / Diverted / Cancelled|异常运行态。|

## 7. 2 地面履约状态（Ground Fulfillment Status）

|状态|定义|
|---|---|
|Front Warehouse Receiving|前置仓收货阶段。|
|First-Mile In Transit|头程卡车在途。|
|Origin Terminal Handling|出港机场货站操作中。|
|Origin Ramp Handling|出港机场机坪操作中。|
|In Flight|飞行过程。|

|状态|定义|
|---|---|
|Destination Ramp Handling|进港机场机坪操作中。|
|Inbound Handling|进港货站操作中；替代旧的 Turnaround 说法。|
|Tail-Linehaul In Transit|尾程卡车在途。|
|Delivered|交付完成但尚未闭单。|
|Closed|全链路已闭环。|

## 7. 3 任务状态（Task Status）

|状态|定义|
|---|---|
|Created|任务已生成但未派发。|
|Assigned|任务已派发到班组/人员。|
|Accepted|执行人已接单。|
|Arrived at Location|已到达执行位置。|
|Started|任务已开始。|
|Evidence Uploaded|任务过程中已上传证据。|
|Completed|执行人已完成。|
|Verifed|复核或主管已确认。|
|Handed Over|已交给下一角色。|
|Closed|任务闭环完成。|
|Rejected / Rework / Exception Raised|驳回、返工或异常分支。|

## 7. 4 状态进入规则（基础版）

## 1. 航班实际起飞后，Flight Runtime Status 自动进入 Airborne。

## 2. 航班预计落地前 60 分钟，Flight Runtime Status 自动进入 Pre-Arrival，同时触发目的站准备任

务。

## 3. 航班实际落地后，Flight Runtime Status 进入 Landed，Ground Fulfillment Status 进入

Destination Ramp Handling。

## 4. 目的站机坪放行后，Ground Fulfillment Status 进入 Inbound Handling。

## 5. POD 与交付仓签收完成后，Ground Fulfillment Status 进入 Delivered；所有异常关闭后方可进入

Closed。

**当前前端 Demo 对应：**

- 状态与规则总入口：[https://sinoport.co/platform/rules](https://sinoport.co/platform/rules)
- 履约对象状态样例：[https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585)
- 货站任务状态样例：[https://sinoport.co/station/tasks](https://sinoport.co/station/tasks)
- 航班运行样例：[https://sinoport.co/mobile/runtime/SE913](https://sinoport.co/mobile/runtime/SE913)

## 8. 平台管理后台详细需求

## 8. 1 运行态势中心

**页面目标：** 统一展示全网航班运行态、站点履约态、承诺风险和执行任务，是平台层的主入口。

- 航班态势：显示今日航班数、Airborne、Pre-Arrival、Landed、Delayed / Diverted。
- 站点地面态势：显示各站当前 Inbound Handling 数量、待拆板、待复核、待装车、待签收数量。
- 承诺风险：显示即将超 SLA、缺文件、缺证据、待放行、异常未关闭任务。
- 执行指令：显示已生成但未接单任务、进行中任务、超时任务、需主管放行任务。
**关键交互：** 支持按 Route / Station / Flight / Service Level 筛选；支持从平台总览钻取到货站、航班、AWB、PMC、Task 维度；支持风险任务导出。

**当前前端 Demo 对应：**

- 线上入口：[https://sinoport.co/platform/operations](https://sinoport.co/platform/operations)
- 已实现表达：链路与接口告警、待处理动作、关键事件回放、站点健康度矩阵、平台级阻断摘要

## 8. 2 货站与资源管理

- 维护货站、前置仓、交付仓、机坪、区位、班组、设备台账。
- 支持站点准备度、控制层级、所有者、启用阶段、时区与作业窗口配置。
- 支持新增 / 编辑 / 冻结站点，以及批量导入站点基础资料。

**当前前端 Demo 对应：**

- 总览：[https://sinoport.co/platform/stations](https://sinoport.co/platform/stations)
- 站点能力矩阵：[https://sinoport.co/platform/stations/capabilities](https://sinoport.co/platform/stations/capabilities)
- 班组映射：[https://sinoport.co/platform/stations/teams](https://sinoport.co/platform/stations/teams)
- 区位映射：[https://sinoport.co/platform/stations/zones](https://sinoport.co/platform/stations/zones)
- 设备映射：[https://sinoport.co/platform/stations/devices](https://sinoport.co/platform/stations/devices)
## 8. 3 航线网络与链路配置

- 维护主链路、中转链路、头程和尾程的业务模式。
- 为每条链路定义 Promise SLA、服务等级、关键事件字段、是否需要 CMR / POD。
- 支持按站点展示网络准备度、资源就绪度与接口就绪度。

**当前前端 Demo 对应：**

- 总览：[https://sinoport.co/platform/network](https://sinoport.co/platform/network)
- 链路模板：[https://sinoport.co/platform/network/lanes](https://sinoport.co/platform/network/lanes)
- 标准场景：[https://sinoport.co/platform/network/scenarios](https://sinoport.co/platform/network/scenarios)
## 8. 4 规则与指令引擎

- 维护状态进入规则、硬门槛规则、任务生成规则、异常字典和服务等级。
- 支持模板化 Work Instruction，按站点 / 节点 / 角色复用。
- 支持配置“Pre-Arrival 触发到港准备任务”、“文件齐全触发 PMC 拆板任务”等逻辑。

**当前前端 Demo 对应：**

- 线上入口：[https://sinoport.co/platform/rules](https://sinoport.co/platform/rules)
- 已实现表达：服务等级、`HG-01` 到 `HG-08`、任务生成规则、证据要求、异常字典、标准场景编排
## 8. 5 主数据与接口治理

- 统一 Flight / Order / Shipment / AWB / ULD / Truck / Task / POD / Event 等主键体系。
- 管理 ERP、供应链系统、航班状态、末端签收等接口接入情况。
- 支持接口状态、版本、最后同步时间、错误次数、重试策略等配置与查询。

**当前前端 Demo 对应：**

- 主数据总览：[https://sinoport.co/platform/master-data](https://sinoport.co/platform/master-data)
- 同步看板：[https://sinoport.co/platform/master-data/sync](https://sinoport.co/platform/master-data/sync)
- 导入任务：[https://sinoport.co/platform/master-data/jobs](https://sinoport.co/platform/master-data/jobs)
- 对象关系：[https://sinoport.co/platform/master-data/relationships](https://sinoport.co/platform/master-data/relationships)
- 已实现表达：主键规则、接口状态、同步动作、失败重试、人工补录、权限矩阵、非功能占位
## 8. 6 审计与可信留痕

- 记录谁创建、谁修改、改前值、改后值、审批动作、时间戳和来源系统。
- 关键事件保留 Event ID、Event Type、Related Object IDs、Hash 预留字段和 Signature 预留字段。
- 支持按 Flight / AWB / Task / Worker / Device / Truck 查询审计日志。

**当前前端 Demo 对应：**

- 审计中心：[https://sinoport.co/platform/audit](https://sinoport.co/platform/audit)
- 审计事件明细：[https://sinoport.co/platform/audit/events](https://sinoport.co/platform/audit/events)
- 可信留痕占位：[https://sinoport.co/platform/audit/trust](https://sinoport.co/platform/audit/trust)
## 9. 货站后台详细需求

## 9. 1 货站看板

**页面目标：** 成为站内主管的主入口，用于掌握当日进港、出港、任务、异常和 KPI。

- 必须展示：今日进港航班、今日出港航班、待拆板、待复核、待装车、待签收、异常待处理。
- 头部 KPI 至少包括：进港 12 小时达成率、装车准确率、POD 完整率、任务超时率、异常关闭时长。
- 支持按航班、班组、区位和服务等级筛选。

**当前前端 Demo 对应：**

- 线上入口：[https://sinoport.co/station/dashboard](https://sinoport.co/station/dashboard)
- 已实现表达：今日进港 / 出港、任务摘要、阻断摘要、站内执行原则、头部 KPI
## 9. 2 进港管理

进港管理覆盖从 Landed 到 Gate Out 的站内全过程，页面至少包括：进港看板、进港航班管理、航班详情、Inbound Handling 时间轴、手机 / PDA 理货入口、进港任务总览。

- 航班详情必须展示：航班基础信息、关联 PMC / ULD、AWB 汇总、任务汇总、文件完成度、异常汇
总。

- 进港时间轴必须展示：落地、卸机开始、卸机完成、入货站、拆板开始、理货完成、NOA 发送、装车
完成、Gate Out。

- 进港任务总览必须按 PMC / AWB / Truck 三级查看。

**当前前端 Demo 对应：**

- 进港看板：[https://sinoport.co/station/inbound](https://sinoport.co/station/inbound)
- 进港航班管理：[https://sinoport.co/station/inbound/flights](https://sinoport.co/station/inbound/flights)
- 航班详情样例：[https://sinoport.co/station/inbound/flights/SE803](https://sinoport.co/station/inbound/flights/SE803)
- 进港提单管理：[https://sinoport.co/station/inbound/waybills](https://sinoport.co/station/inbound/waybills)
- 手机 / PDA 理货入口：[https://sinoport.co/station/inbound/mobile](https://sinoport.co/station/inbound/mobile)
## 9. 3 出港管理

出港管理覆盖从 Forecasted 到 Airborne 的全过程，页面至少包括：出港看板、出港航班管理、航班详情、Build-up 任务视图、文件链完成度。

- 出港航班详情必须展示：AWB 收货完成度、组板完成度、文件完成度、机坪放行状态。
- Build-up 任务视图必须按 ULD / PMC 查看，支持查看目标板位、相关 AWB、责任班组与完成照片。
- 支持在出港看板中单独查看 FFM / UWS / Manifest / CBA 的完成状态。

**当前前端 Demo 对应：**

- 出港看板：[https://sinoport.co/station/outbound](https://sinoport.co/station/outbound)
- 出港航班管理：[https://sinoport.co/station/outbound/flights](https://sinoport.co/station/outbound/flights)
- 出港提单管理：[https://sinoport.co/station/outbound/waybills](https://sinoport.co/station/outbound/waybills)
- 已实现表达：预报、收货、主单、装载、Manifest、机坪放行阻断与飞走前门槛
## 9. 4 提单与履约链路

该模块替代旧版“提单管理”，AWB 页面不再只是台账，而是一票货的全链路主索引。

|页签|展示内容|
|---|---|
|基础信息|AWB / HAWB、Order、Shipment、Flight、件<br>重体、发收货方、服务等级、Promise SLA。|
|前置运输链|前置仓收货时间、头程卡车、CMR 编号与状态、<br>Origin POD。|
|出港文件链|CBA、AWB / HAWB、FFM、UWS、Manifest、<br>Build-up Sheet、版本信息。|
|在途与到港链|Of-block、Take-of、ETA、Pre-Arrival、<br>Landed、Inbound Handling、NOA 状态。|

|页签|展示内容|
|---|---|
|执行指令链|当前任务、PMC 拆板任务、分区任务、组托任<br>务、卡车装车任务。|
|闭环与责任链|POD、交付仓签收、末端状态、异常、审计时间<br>轴。|

**当前前端 Demo 对应：**

- 列表：[https://sinoport.co/station/shipments](https://sinoport.co/station/shipments)
- 进港详情样例：[https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585)
- 出港详情样例：[https://sinoport.co/station/shipments/out-436-10357583](https://sinoport.co/station/shipments/out-436-10357583)

## 9. 5 单证与指令中心

该模块替代旧版“文件中心”。文件不再只是列表查看，而是状态放行和任务生成的前置条件。

|分组|文件|
|---|---|
|前置运输文件|Booking、Collection Note、CMR、Origin POD|
|出港文件|CBA、AWB / HAWB、FFM、UWS、Manifest、<br>ULD Build-up Sheet|
|到港执行文件|Handling Plan、Breakdown Plan、Sorting /<br>Zoning Sheet、Truck Loading Order、NOA、<br>Delivery Instruction|
|闭环文件|Destination POD、Warehouse Receipt、Final<br>Delivery Proof、Exception Report|

- 必须支持：上传、预览、替换、版本回退、对象绑定、完整性校验。
- 文件完成后必须可触发下一步状态流转或任务生成。
- 关键文件缺失时，系统必须给出阻塞提示。

**当前前端 Demo 对应：**

- 文件中心：[https://sinoport.co/station/documents](https://sinoport.co/station/documents)
- `NOA` 动作页：[https://sinoport.co/station/documents/noa](https://sinoport.co/station/documents/noa)
- `POD` 动作页：[https://sinoport.co/station/documents/pod](https://sinoport.co/station/documents/pod)
- 已实现表达：版本侧栏、预览、替换、回退、对象绑定、完整性校验、门槛阻断、动作记录
## 9. 6 作业指令中心

作业指令中心用于把平台层生成的任务，按航班、PMC / AWB、Truck 三个粒度展示给站内主管与执行人员。

|视图粒度|内容|
|---|---|
|航班级|本航班总任务数、已完成数、超时数、风险任<br>务、主管放行任务。|
|PMC / AWB 级|拆板任务、理货任务、分区任务、组托任务、装<br>车任务。|
|Truck 级|车辆、司机、装载货物、装车窗口、POD 状态、<br>Gate Out 目标时间。|

**当前前端 Demo 对应：**

- 线上入口：[https://sinoport.co/station/tasks](https://sinoport.co/station/tasks)
- 已实现表达：航班级、任务池、待复核、待升级、阻断任务、标准场景编排、任务与 `HG` 映射

## 9. 7 班组 / 区位 / 设备管理

- Team：班组类型、负责人、班次、能力标签、当前负载。
- Worker：角色、班组、绑定设备、当前状态。
- Zone：区位类型（Breakdown / Sorting / Palletizing / Loading / Hold）、容量、占用、可用性。
- Device：设备编号、绑定人员、在线状态、最后同步时间。

**当前前端 Demo 对应：**

- 总览：[https://sinoport.co/station/resources](https://sinoport.co/station/resources)
- 班组：[https://sinoport.co/station/resources/teams](https://sinoport.co/station/resources/teams)
- 区位：[https://sinoport.co/station/resources/zones](https://sinoport.co/station/resources/zones)
- 设备：[https://sinoport.co/station/resources/devices](https://sinoport.co/station/resources/devices)
- 车辆：[https://sinoport.co/station/resources/vehicles](https://sinoport.co/station/resources/vehicles)
## 9. 8 异常中心

- 必须支持异常创建、归因、升级、关闭、返工与复盘。
- 异常类型至少包括：Shortage、Overcount、Damage、Mislabel、Mis-sort、Wrong Truck、
Missing Document、Scan Failure、Time SLA Risk。

- 异常必须可关联 Flight、AWB、PMC、Truck、Task、Worker、Zone、Evidence。

**当前前端 Demo 对应：**

- 列表：[https://sinoport.co/station/exceptions](https://sinoport.co/station/exceptions)
- 详情样例：[https://sinoport.co/station/exceptions/EXP-0408-001](https://sinoport.co/station/exceptions/EXP-0408-001)
- 已实现表达：异常摘要、阻断任务、命中门槛、恢复动作、关联文件、关联对象跳转
## 10. PDA 作业终端详细需求

## 10. 1 PDA 端定位

PDA 不是后台页面的移动缩小版，而是岗位任务终端。每个现场角色只看到自己的任务、标准、证据要求与交接条件，不应浏览无关页面。

**当前前端 Demo 对应：**

- 登录：[https://sinoport.co/mobile/login](https://sinoport.co/mobile/login)
- 节点选择：[https://sinoport.co/mobile/select](https://sinoport.co/mobile/select)
- 已实现表达：Demo 角色选择、站点切换、节点入口、角色视角过滤

## 10. 2 统一任务卡结构

|字段|说明|
|---|---|
|去哪里|提取点 / 作业点 / 车位 / Zone|
|取什么 / 操作什么|AWB、箱货、PMC、ULD、托盘、车辆等|
|按什么标准做|拆板标准、组托标准、装车标准、标签核对标准|
|做完后放哪里 / 交给谁|目标 Zone、目标车辆、下一角色|
|需要上传什么证据|照片、扫码、计数、签字、备注|
|完成时限|Due Time / SLA|
|异常怎么上报|异常类型与上报入口|
|完成后会触发谁的下一任务|下游角色或自动生成文件|

**当前前端 Demo 对应：**

- 前置仓样例：[https://sinoport.co/mobile/pre-warehouse/URC-COL-001](https://sinoport.co/mobile/pre-warehouse/URC-COL-001)
- 头程卡车样例：[https://sinoport.co/mobile/headhaul/TRIP-URC-001](https://sinoport.co/mobile/headhaul/TRIP-URC-001)
- 出港机坪样例：[https://sinoport.co/mobile/export-ramp/SE913](https://sinoport.co/mobile/export-ramp/SE913)
- 交付仓样例：[https://sinoport.co/mobile/delivery/DLV-001](https://sinoport.co/mobile/delivery/DLV-001)
- 已实现表达：统一 Task Card、角色、SLA、证据、阻断、动作条

## 10. 3 PDA 通用动作

- 接单、到场确认、扫码、拍照、计数输入、异常上报、完成确认、任务交接、签收 / 签字（按角色开
放）。

- 必须支持断网缓存、补传、时间戳自动记录、设备与人员绑定。

**当前前端 Demo 对应：**

- 通用动作样例：[https://sinoport.co/mobile/pre-warehouse/URC-COL-001](https://sinoport.co/mobile/pre-warehouse/URC-COL-001)
- 离线补传样例：[https://sinoport.co/mobile/delivery/DLV-001](https://sinoport.co/mobile/delivery/DLV-001)
- 已实现表达：扫码、确认、异常、挂起、完成、签字、上传证据、`offline / queued / synced / failed`
## 10. 4 节点-角色-任务定义

以下各节点角色均由平台层下发任务；PDA 侧只负责接单、执行、取证、交接。

## 10. 4.1 前置仓收货

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|收货员|到指定 Dock 收货，扫<br>描箱号 / 标签，确认件<br>重体|接单、扫码、计数、异<br>常上报|收货记录、异常照片|
|标签与资料核对员|核对标签、箱唛、单<br>证，决定放行或冻结|查看标准、确认放<br>行/冻结|核对结果|
|前置仓分拨员|按指令将货移至暂存区<br>或预装区|查看目标 Zone、完成<br>确认|区位确认|
|前置仓主管|放行批次、处理异常件|审批、驳回、备注|放行日志|

**当前前端 Demo 对应：**

- 列表：[https://sinoport.co/mobile/pre-warehouse](https://sinoport.co/mobile/pre-warehouse)
- 详情样例：[https://sinoport.co/mobile/pre-warehouse/URC-COL-001](https://sinoport.co/mobile/pre-warehouse/URC-COL-001)

## 10. 4.2 头程卡车运输

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|装车员|按任务装上指定头程车<br>辆|扫描车牌、装车确认|装车记录|
|发车核对员|核对司机、车牌、封<br>签，生成 / 确认 CMR|签核、确认发车|CMR、封签记录|
|司机|接货并完成到达出港货<br>站交接|接单、到达确认|交接确认|
|运输调度员|跟踪在途、处理延误|状态更新、异常上报|在途事件|

**当前前端 Demo 对应：**

- 列表：[https://sinoport.co/mobile/headhaul](https://sinoport.co/mobile/headhaul)
- 详情样例：[https://sinoport.co/mobile/headhaul/TRIP-URC-001](https://sinoport.co/mobile/headhaul/TRIP-URC-001)

## 10. 4.3 出港机场货站操作

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|货站收货员|接收头程车辆，核对件<br>数与 CMR，生成<br>Origin POD|扫描、计数、签收|Origin POD|
|理货核对员|按 AWB / 箱号核对收<br>货|扫码、计数、异常上报|理货结果|

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|组板准备员|将货归集到组板区|查看目标 ULD/PMC、<br>完成确认|区位变更|
|组板员|按标准组板并绑定<br>ULD / PMC|扫描、拍照、完成确认|组板照片、CBA|
|单证文员|上传并绑定 FFM /<br>UWS / Manifest / AWB<br>/ CBA|上传、版本管理|文件链完成|
|出港货站主管|放行已完成组板批次至<br>机坪|审批、驳回|放行日志|

**当前前端 Demo 对应：**

- 航班列表：[https://sinoport.co/mobile/outbound](https://sinoport.co/mobile/outbound)
- 航班详情样例：[https://sinoport.co/mobile/outbound/SE913](https://sinoport.co/mobile/outbound/SE913)
- 收货样例：[https://sinoport.co/mobile/outbound/SE913/receipt](https://sinoport.co/mobile/outbound/SE913/receipt)
- 集装器样例：[https://sinoport.co/mobile/outbound/SE913/pmc](https://sinoport.co/mobile/outbound/SE913/pmc)

## 10. 4.4 出港机场机坪操作

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|ULD / 板车转运员|将 ULD / PMC 从货站<br>转至机坪|扫描、到场确认|转运记录|
|机坪核对员|核对板位、航班、ULD<br>是否匹配|核对、异常上报|核对结果|
|装机协同员|确认装机顺序与装机完<br>成|状态更新|Loaded 事件|
|机坪主管|放行 Flight Closed|审批、备注|Flight Closed 事件|

**当前前端 Demo 对应：**

- 列表：[https://sinoport.co/mobile/export-ramp](https://sinoport.co/mobile/export-ramp)
- 详情样例：[https://sinoport.co/mobile/export-ramp/SE913](https://sinoport.co/mobile/export-ramp/SE913)

## 10. 4.5 航班运行

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|运行值班员|跟踪 Airborne / Pre-<br>Arrival / Landed|状态确认、异常上报|运行事件|
|到港准备协调员|在 Pre-Arrival 阶段确<br>认目的站资源就位|查看准备任务、完成确<br>认|准备完成事件|

**当前前端 Demo 对应：**

- 列表：[https://sinoport.co/mobile/runtime](https://sinoport.co/mobile/runtime)
- 详情样例：[https://sinoport.co/mobile/runtime/SE913](https://sinoport.co/mobile/runtime/SE913)

## 10. 4.6 进港机场机坪操作

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|卸机员|开始卸机 / 卸机完成，<br>扫描 PMC / ULD|到场、扫码、完成确认|卸机时间点|
|机坪转运员|将 PMC / ULD 转至货<br>站 Breakdown 区|扫描、到场确认|转运记录|
|机坪核对员|核对 PMC 与航班对应<br>关系|核对、异常上报|核对结果|
|到港机坪主管|放行进入 Inbound<br>Handling|审批、驳回|放行事件|

**当前前端 Demo 对应：**

- 列表：[https://sinoport.co/mobile/destination-ramp](https://sinoport.co/mobile/destination-ramp)
- 详情样例：[https://sinoport.co/mobile/destination-ramp/SE803](https://sinoport.co/mobile/destination-ramp/SE803)

## 10. 4.7 进港机场货站操作

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|拆板工|到指定区域提取<br>PMC，上传开工照片并<br>按标准拆板|接单、拍照、完成确认|开工 / 完工照片|
|理货核对员|逐箱核对 AWB / 件<br>数，标记短少、多件、<br>破损、混托|扫码、计数、异常上报|理货结果|
|分区摆放员|按指令把货移至目标<br>Zone|查看目标 Zone、完成<br>确认|区位确认|
|木托盘组托员|按规则重新组托 / 打木<br>托|扫描托盘、拍照、完成<br>确认|组托照片|
|独立复核员|装车前复核 AWB / 件<br>数 / 车牌|复核、驳回、放行|复核记录|
|叉车装车员|把托盘或箱货装到指定<br>车辆|装车确认|装车记录|
|装车核对员|与叉车司机双人作业，<br>核对每托是否上对车|核对、完成确认|装车核对结果|
|POD 文员|根据实际装载生成<br>POD 并完成双方签字|签收、上传|Destination POD|

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|班组长 / Supervisor|接收任务包、分配任<br>务、处理异常、控制<br>SLA|派工、升级、审批|班组日志|

**当前前端 Demo 对应：**

- 航班列表：[https://sinoport.co/mobile/inbound](https://sinoport.co/mobile/inbound)
- 航班详情样例：[https://sinoport.co/mobile/inbound/SE803](https://sinoport.co/mobile/inbound/SE803)
- 拆板理货样例：[https://sinoport.co/mobile/inbound/SE803/breakdown](https://sinoport.co/mobile/inbound/SE803/breakdown)
- 组托样例：[https://sinoport.co/mobile/inbound/SE803/pallet](https://sinoport.co/mobile/inbound/SE803/pallet)
- 装车样例：[https://sinoport.co/mobile/inbound/SE803/loading](https://sinoport.co/mobile/inbound/SE803/loading)

## 10. 4.8 尾程卡车装车与运输

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|尾程装车员|将货装入指定尾程车辆|扫描、装车确认|装车记录|
|发车复核员|核对车牌、司机、装货<br>清单并生成 CMR /<br>POD|核对、签核|CMR / POD|
|司机|接货，在途更新状态，<br>到仓交接|接单、到达确认|交接确认|
|尾程调度员|监控车辆状态，处理延<br>误|状态更新、异常上报|在途事件|

**当前前端 Demo 对应：**

- 列表：[https://sinoport.co/mobile/tailhaul](https://sinoport.co/mobile/tailhaul)
- 详情样例：[https://sinoport.co/mobile/tailhaul/TAIL-001](https://sinoport.co/mobile/tailhaul/TAIL-001)

## 10. 4.9 交付仓

|角色|核心任务|PDA 功能|关键证据 / 输出|
|---|---|---|---|
|交付仓收货员|接收尾程车辆，核对件<br>数与状态|扫码、计数、完成确认|入仓记录|
|签收员|完成签收并提交<br>Warehouse Receipt|签字、上传|Warehouse Receipt|
|差异处理员|处理少件、破损、拒<br>收、超时|异常上报、备注|异常报告|
|交付仓主管|最终放行 Delivered /<br>Closed|审批、关闭|关闭事件|

**当前前端 Demo 对应：**

- 列表：[https://sinoport.co/mobile/delivery](https://sinoport.co/mobile/delivery)
- 详情样例：[https://sinoport.co/mobile/delivery/DLV-001](https://sinoport.co/mobile/delivery/DLV-001)

## 11. 任务编排引擎与标准场景

## 11. 1 任务生成原则

## 1. 文件驱动：关键文件齐全后才能生成下游任务。

## 2. 状态驱动：上游状态进入指定节点时触发下游任务。

## 3. 规则驱动：任务的责任角色、班组、区位、车辆由规则引擎决定。

## 4. SLA 驱动：每个任务都必须带 Due Time；超时自动升级。

## 5. 证据驱动：需证据的任务必须上传证据后才允许完成。

**当前前端 Demo 对应：**

- 规则与任务编排入口：[https://sinoport.co/platform/rules](https://sinoport.co/platform/rules)
- 货站任务视图：[https://sinoport.co/station/tasks](https://sinoport.co/station/tasks)
- 单证与门槛入口：[https://sinoport.co/station/documents](https://sinoport.co/station/documents)

## 11. 2 分配逻辑

- 按站点：任务只派发到当前站点可用班组。
- 按角色：任务类型必须与角色能力匹配。
- 按班组：优先派发给在线、未满载、具备技能标签的班组。
- 按优先级：P1 任务优先抢占资源。
- 按依赖：上游任务未完成或文件未齐全时，下游任务不可生成。

**当前前端 Demo 对应：**

- 班组映射：[https://sinoport.co/platform/stations/teams](https://sinoport.co/platform/stations/teams)
- 货站班组资源：[https://sinoport.co/station/resources/teams](https://sinoport.co/station/resources/teams)
- PDA 角色入口：[https://sinoport.co/mobile/login](https://sinoport.co/mobile/login)
## 11. 3 标准场景 A：航班落地后拆板到装车

## 1. 航班 Landed -> 机坪放行 -> 进入 Inbound Handling。

## 2. 系统根据 CBA / Manifest / Handling Plan 自动生成 PMC 拆板任务。

## 3. 拆板工在 PDA 接单，抵达指定 Zone，上传开工照片并开始拆板。

## 4. 拆板完成后，系统触发理货核对任务；理货完成后触发分区任务。

## 5. 若规则要求组木托，则触发木托盘组托任务；否则可直接进入装车准备。

## 6. 车辆到场且独立复核通过后，触发装车任务。

## 7. 装车员与装车核对员双人作业完成后，系统自动生成 POD 草稿，POD 文员补齐签字并放行。

**当前前端 Demo 对应：**

- 场景入口：[https://sinoport.co/platform/network/scenarios](https://sinoport.co/platform/network/scenarios)
- 货站航班详情：[https://sinoport.co/station/inbound/flights/SE803](https://sinoport.co/station/inbound/flights/SE803)
- PDA 拆板理货：[https://sinoport.co/mobile/inbound/SE803/breakdown](https://sinoport.co/mobile/inbound/SE803/breakdown)
- PDA 组托：[https://sinoport.co/mobile/inbound/SE803/pallet](https://sinoport.co/mobile/inbound/SE803/pallet)
- PDA 装车：[https://sinoport.co/mobile/inbound/SE803/loading](https://sinoport.co/mobile/inbound/SE803/loading)

## 11. 4 标准场景 B：前置仓到出港文件链

## 1. 前置仓收货员完成收货与异常标记。

## 2. 发车核对员生成或确认 CMR，头程车辆发往出港货站。

## 3. 出港货站收货员完成交接并生成 Origin POD。

## 4. 组板员完成组板并上传照片；单证文员上传 CBA / AWB / FFM / UWS / Manifest。

## 5. 当关键文件齐全时，系统放行至机坪任务；机坪完成 Loaded 后，状态进入 Airborne。

**当前前端 Demo 对应：**

- 场景入口：[https://sinoport.co/platform/network/scenarios](https://sinoport.co/platform/network/scenarios)
- 前置仓：[https://sinoport.co/mobile/pre-warehouse/URC-COL-001](https://sinoport.co/mobile/pre-warehouse/URC-COL-001)
- 头程卡车：[https://sinoport.co/mobile/headhaul/TRIP-URC-001](https://sinoport.co/mobile/headhaul/TRIP-URC-001)
- 出港收货：[https://sinoport.co/mobile/outbound/SE913/receipt](https://sinoport.co/mobile/outbound/SE913/receipt)
- 出港机坪：[https://sinoport.co/mobile/export-ramp/SE913](https://sinoport.co/mobile/export-ramp/SE913)
- 单证中心：[https://sinoport.co/station/documents](https://sinoport.co/station/documents)

## 11. 5 异常分支处理

- 任何节点发现少件、多件、破损、标签异常、车牌不符、文件缺失时，必须创建 Exception。
- Exception 一旦创建，可阻塞当前任务或转入返工流程。
- 异常关闭前，不允许把相关 Shipment / AWB 置为 Closed。

**当前前端 Demo 对应：**

- 异常中心：[https://sinoport.co/station/exceptions](https://sinoport.co/station/exceptions)
- 异常详情样例：[https://sinoport.co/station/exceptions/EXP-0408-001](https://sinoport.co/station/exceptions/EXP-0408-001)
- PDA 异常与补传入口样例：[https://sinoport.co/mobile/delivery/DLV-001](https://sinoport.co/mobile/delivery/DLV-001)
## 12. 单证链与文件驱动规则

单证链是任务链的输入条件。本系统不接受“先做再补文件”的宽松模式；凡需要文件放行的节点，必须先校验文件完成度。

|链路节点|必须文件|触发结果|
|---|---|---|
|前置仓收货 -> 头程发车|Order / Booking、Collection<br>Note（如有）|生成头程装车任务与 CMR|
|头程到达出港货站|CMR、Origin POD|允许进入出港货站收货与理货|
|出港货站 -> 机坪|CBA、AWB / HAWB、FFM、<br>UWS、Manifest|允许生成机坪转运与装机任务|
|航班落地 -> 到港拆板|Manifest、CBA、Handling<br>Plan、Breakdown Plan|允许生成 PMC 拆板任务|
|拆板 / 理货 -> 分区 / 装车|Sorting / Zoning Sheet、<br>Truck Loading Order|允许生成分区与装车任务|
|尾程发车 -> 交付仓签收|CMR / POD|允许进入交付仓接收与签收|

**当前前端 Demo 对应：**

- 文件链总览：[https://sinoport.co/station/documents](https://sinoport.co/station/documents)
- 履约对象回连样例：[https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585)

## 12. 1 文件动作能力

- 上传：支持同一对象多版本上传。
- 预览：支持 PDF、图片、Office 文件预览。
- 替换：替换时必须保留旧版本审计记录。
- 回退：具备权限的角色可回退到上一个有效版本。
- 对象绑定：每个文件必须绑定到至少一个业务对象。
- 触发：关键文件生效后自动触发状态放行或任务生成。

**当前前端 Demo 对应：**

- 文件中心：[https://sinoport.co/station/documents](https://sinoport.co/station/documents)
- 已实现表达：上传占位、预览、替换、回退、对象绑定、版本侧栏、动作记录、门槛触发
## 13. 硬门槛规则

以下规则属于本期必须系统化的硬门槛，不能仅靠口头 SOP 执行。

|规则 ID|规则|触发节点|系统动作|可放行角色|
|---|---|---|---|---|
|HG-01|缺少关键文件，<br>不得生成下一步<br>任务|文件链未齐全|阻塞状态流转与<br>任务生成|主管可临时放行<br>并强制审计|
|HG-02|一托一单，严禁<br>混托|理货 / 组托 / 装车<br>前校验|阻塞装车与闭环|不可越权跳过|
|HG-03|PMC 拆板后必须<br>核对板号与件数|拆板完成|阻塞理货完成|班组长与独立复<br>核员共同放行|
|HG-04|未完成二次复<br>核，不得装车|装车前|阻塞装车任务|独立复核员或主<br>管放行|

|规则 ID|规则|触发节点|系统动作|可放行角色|
|---|---|---|---|---|
|HG-05|未登记司机 / 车牌<br>/ 到离场时间，不<br>得放行车辆|发车前|阻塞 Gate Out|主管放行并留痕|
|HG-06|POD 未签收，不<br>得关单|装车后 / 交付后|阻塞 Delivered /<br>Closed|不可越权跳过|
|HG-07|需要证据的任务<br>未上传证据，不<br>得完成|任务完成前|阻塞 Task<br>Completed|主管补证据并审<br>计|
|HG-08|超 SLA 自动升级|Due Time 到期|推送到主管与平<br>台态势中心|平台管理员可重<br>新分配|

**当前前端 Demo 对应：**

- 平台规则页：[https://sinoport.co/platform/rules](https://sinoport.co/platform/rules)
- 货站任务池：[https://sinoport.co/station/tasks](https://sinoport.co/station/tasks)
- 履约对象样例：[https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585)
- 异常样例：[https://sinoport.co/station/exceptions/EXP-0408-001](https://sinoport.co/station/exceptions/EXP-0408-001)
- `NOA` / `POD` 动作页：[https://sinoport.co/station/documents/noa](https://sinoport.co/station/documents/noa) / [https://sinoport.co/station/documents/pod](https://sinoport.co/station/documents/pod)

## 14. 接口、主数据与可信留痕预留

## 14. 1 本期必须实现的接口

|接口|说明|
|---|---|
|航班状态接口|写入 Airborne / Pre-Arrival / Landed 等运行事<br>件。|
|文件上传与对象绑定接口|把文件写入单证中心并与对象关联。|
|PDA 任务同步接口|下发任务、回传状态、回传证据。|
|POD / CMR 生成与回写接口|生成交接文件并回写到 Shipment / Truck。|
|Team / Worker / Device 同步接口|同步班组、人员、设备。|

**当前前端 Demo 对应：**

- 同步看板：[https://sinoport.co/platform/master-data/sync](https://sinoport.co/platform/master-data/sync)
- 导入任务：[https://sinoport.co/platform/master-data/jobs](https://sinoport.co/platform/master-data/jobs)
- 已实现表达：同步状态、动作入口、失败重试、人工补录、接口说明

## 14. 2 本期必须预留的接口

|接口 / 预留项|说明|
|---|---|
|ERP ↔ OS|合同、客户、航班成本收入、结算关系映射。|
|供应链系统 ↔ OS|Order、Shipment、Warehouse、Delivery 等<br>对象互通。|
|末端状态接口|Out for Delivery、Delivered、Failure Code 回<br>写。|
|交付仓签收接口|Warehouse Receipt 与 POD 数据接入。|

|接口 / 预留项|说明|
|---|---|
|Event Hash / Signature 字段|为未来可信固化预留。|

**当前前端 Demo 对应：**

- 主数据与接口治理：[https://sinoport.co/platform/master-data](https://sinoport.co/platform/master-data)
- 可信留痕占位：[https://sinoport.co/platform/audit/trust](https://sinoport.co/platform/audit/trust)

## 14. 3 主数据统一原则

- 统一主键：Order ID、Shipment ID、Flight ID、AWB / HAWB、ULD / PMC ID、Truck ID、CMR ID、
POD ID、Task ID、Event ID 等必须全局唯一。

- 事件先于报表：先保存 Event 和 Evidence，再生成报表与统计。
- 业务对象与权利对象分层：本期仅实现业务对象层，但字段命名与对象关系需为未来权利映射保留空
间。

**当前前端 Demo 对应：**

- 主数据口径：[https://sinoport.co/platform/master-data](https://sinoport.co/platform/master-data)
- 对象关系：[https://sinoport.co/platform/master-data/relationships](https://sinoport.co/platform/master-data/relationships)
- 提单履约对象样例：[https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585)

## 14. 4 审计与可信留痕

|类别|要求|
|---|---|
|操作审计|记录谁创建、谁修改、改前值、改后值、时间<br>戳、来源系统。|
|放行审计|记录主管、复核员、平台管理员的所有越权放行<br>与驳回。|
|证据留痕|每个关键任务的照片、签字、扫码、计数必须可<br>追溯。|
|事件摘要预留|为 Event 保留 Hash / Signature 字段，但本期不<br>真正上链。|

**当前前端 Demo 对应：**

- 审计中心：[https://sinoport.co/platform/audit](https://sinoport.co/platform/audit)
- 审计事件明细：[https://sinoport.co/platform/audit/events](https://sinoport.co/platform/audit/events)
- 可信留痕占位：[https://sinoport.co/platform/audit/trust](https://sinoport.co/platform/audit/trust)
- 单证与动作留痕样例：[https://sinoport.co/station/documents](https://sinoport.co/station/documents)

## 15. KPI、报表与非功能要求

## 15. 1 平台层 KPI

|指标|说明|
|---|---|
|航班准点率|按 Flight Runtime 统计。|
|Pre-Arrival 准备完成率|到港前资源就位率。|
|站点 Inbound Handling 超时率|站点地面操作超 SLA 比例。|
|任务超时率|按节点 / 站点 / 角色统计。|
|异常关闭时长|按异常类型统计。|

**当前前端 Demo 对应：**

- 平台报表：[https://sinoport.co/platform/reports](https://sinoport.co/platform/reports)
- 站点对比报表：[https://sinoport.co/platform/reports/stations](https://sinoport.co/platform/reports/stations)
- 已实现表达：平台 KPI、站点准备度、平台日报样例

## 15. 2 货站层 KPI

|指标|说明|
|---|---|
|进港 12 小时达成率|航班落地后 12 小时内完成全货操作的比例。|
|装车准确率|要求 100%。|
|POD 完整率|按航班、按车次统计。|
|卡车空车率|月度统计，不得超过 SOP 口径。|
|拆板完成时长|按 PMC 统计。|

**当前前端 Demo 对应：**

- 货站报表：[https://sinoport.co/station/reports](https://sinoport.co/station/reports)
- 班次报表：[https://sinoport.co/station/reports/shift](https://sinoport.co/station/reports/shift)

## 15. 3 PDA 层 KPI

|指标|说明|
|---|---|
|接单时长|任务派发到接单确认的时长。|
|到场时长|接单到到达作业点的时长。|
|任务完成时长|开始到完成的时长。|
|证据上传完整率|需要照片/签字/扫码的任务完成率。|
|异常首次反馈时长|异常从发现到上报的时长。|

**当前前端 Demo 对应：**

- 货站报表中的 PDA KPI 样例：[https://sinoport.co/station/reports](https://sinoport.co/station/reports)
- PDA 离线与补传样例：[https://sinoport.co/mobile/delivery/DLV-001](https://sinoport.co/mobile/delivery/DLV-001)

## 15. 4 报表要求

- 平台日报：航班态势、承诺风险、任务超时、异常分布。
- 货站周报：落地时间、卸机完成、理货完成、卡车到离场、全部提取完成、剩余货物、POD 归档。
- 班组报表：任务量、完成率、超时率、异常率、证据完整率。
- 文件报表：关键文件缺失、文件版本替换、文件生效时间。

**当前前端 Demo 对应：**

- 平台日报样例：[https://sinoport.co/platform/reports](https://sinoport.co/platform/reports)
- 货站 KPI / 周报样例：[https://sinoport.co/station/reports](https://sinoport.co/station/reports)
- 班组报表样例：[https://sinoport.co/station/reports/shift](https://sinoport.co/station/reports/shift)
- 文件报表样例：[https://sinoport.co/station/reports](https://sinoport.co/station/reports)
## 15. 5 非功能要求

|类别|要求|
|---|---|
|性能|平台列表和关键看板在正常数据量下 3 秒内返<br>回。|
|稳定性|关键状态写入、任务状态写入需具备幂等与重<br>试。|
|离线能力|PDA 必须支持断网缓存与补传。|

|类别|要求|
|---|---|
|安全|基于角色和站点范围做权限隔离；关键动作必须<br>审计。|
|文件存储|支持版本化、不可覆盖原件、可追溯下载。|
|兼容性|后台适配桌面浏览器；PDA 支持 Android 手持终<br>端。|

**当前前端 Demo 对应：**

- 非功能占位与权限矩阵：[https://sinoport.co/platform/master-data](https://sinoport.co/platform/master-data)
- 角色登录与切换：[https://sinoport.co/mobile/login](https://sinoport.co/mobile/login)
- 离线补传表达：[https://sinoport.co/mobile/pre-warehouse/URC-COL-001](https://sinoport.co/mobile/pre-warehouse/URC-COL-001)
- 文件版本与回退：[https://sinoport.co/station/documents](https://sinoport.co/station/documents)

## 16. 验收标准与开发实施顺序

## 16. 1 验收标准

|验收层级|标准|
|---|---|
|平台层|能看见全网运行态、风险态、任务态；能配置规<br>则并生成任务；能查询审计日志。|
|货站层|能跑通出港与进港全链路；能用 AWB 页查看全<br>链路；能用单证中心触发任务。|
|PDA|不同角色只看到自己的任务；能扫码、拍照、上<br>报异常、完成交接；断网后可恢复同步。|
|SOP 对齐|支持逐箱核对、严禁混托、二次复核、双人装<br>车、POD 双签和关键时间点记录。|

**当前前端 Demo 验收材料：**

- 线上总入口：[https://sinoport.co/](https://sinoport.co/)
- 平台主入口：[https://sinoport.co/platform/operations](https://sinoport.co/platform/operations)
- 货站主入口：[https://sinoport.co/station/dashboard](https://sinoport.co/station/dashboard)
- PDA 主入口：[https://sinoport.co/mobile/login](https://sinoport.co/mobile/login)
- 内部验收清单：[sinoport-os-front-demo-release-checklist.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-front-demo-release-checklist.md)

## 16. 2 开发实施顺序

|阶段|工作内容|
|---|---|
|阶段 1：基础模型|主数据模型、权限模型、文件对象模型、Task /<br>Evidence / Event 模型、基础后端持久化。|
|阶段 2：平台层升级|运行态势中心、规则与指令引擎、主数据与接口<br>治理、审计中心升级。|
|阶段 3：货站后台升级|提单与履约链路、单证与指令中心、作业指令中<br>心、班组 / 区位 / 设备管理。|
|阶段 4：PDA 正式化|角色登录、我的任务、扫码与取证、异常与交<br>接、POD / CMR 轻量功能。|

|阶段|工作内容|
|---|---|
|阶段 5：联调与试运行|航班状态接口联调、文件链联调、PDA 试跑、报<br>表验收、站点灰度上线。|

**交付要求：** 研发团队在进入详细开发前，必须基于本 PRD 再输出 3 份配套产物：数据模型（ERD）、状态流转图、接口清单（含入参/出参）。

## 17. 附录：术语、状态字典与替换映射

## 17. 1 术语表

|术语|定义|
|---|---|
|Promise-Driven Fulfllment|承诺兑现型履约|
|Pre-Arrival|到港预备态|
|Inbound Handling|进港操作态|
|Build-up|组板|
|Breakdown|拆板|
|POD|签收 / 交付证明|
|CMR|陆运交接文件|
|Work Instruction|作业指引|

## 17. 2 初版 v0.2 模块替换映射

|初版模块|本版模块|
|---|---|
|平台管理后台 / 货站管理|平台管理后台 / 货站与资源管理|
|平台管理后台 / 航线网络|平台管理后台 / 运行态势中心 + 航线网络与链路<br>配置|
|平台管理后台 / 规则中心|平台管理后台 / 规则与指令引擎|
|平台管理后台 / 审计中心|平台管理后台 / 审计与可信留痕|
|货站后台 / 文件中心|货站后台 / 单证与指令中心|
|货站后台 / 提单管理|货站后台 / 提单与履约链路|

|初版模块|本版模块|
|---|---|
|货站后台 / 手机理货|PDA 作业终端|

## 17. 3 开发冻结结论

**自本文件确认后，以下内容视为冻结并进入开发：** 系统边界、模块菜单、核心对象、状态口径、PDA角色、硬门槛规则、关键接口预留。任何新增功能如影响上述冻结项，必须先走 PRD 变更。
