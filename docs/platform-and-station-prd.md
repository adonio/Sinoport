# Sinoport 平台管理后台与货站后台 PRD

## 1. 文档信息

- 文档版本：`v0.3`
- 更新时间：`2026-04-08`
- 文档类型：客户评审版
- 线上演示域名：[https://sinoport.co/](https://sinoport.co/)
- 文档目的：
  - 与当前已完成原型保持同步
  - 作为客户评审与提修改意见的依据
  - 为下一阶段开发冻结菜单、页面、流程和字段范围
- 关联材料：
  - [business-model-summary.md](/Users/lijun/Downloads/Sinoport/docs/business-model-summary.md)
  - [product-architecture.md](/Users/lijun/Downloads/Sinoport/docs/product-architecture.md)
  - `SE600 MANIFEST 01APR.pdf`
  - `SE913 01APR UWS.xlsx`
  - `SE913FFM报文2026.04.01.docx`
  - `436-10358585-主单套打模板.xlsx`

## 2. 本版文档说明

本文件不是纯规划稿，而是基于当前已经完成的前端原型整理的评审版 PRD。文档中的菜单、页面、模块拆分、单证对象和流程表达，已与当前实现对齐。

本版新增要求：

1. 每个核心模块都附带线上演示链接，默认基于统一域名 [https://sinoport.co/](https://sinoport.co/)。
2. 链接均对应当前前端 demo，可直接用于客户评审、演示和反馈。
3. 当前链接只覆盖前端 demo，不代表真实后端、真实权限、真实文件和真实接口已上线。

本版的主要用途是：

1. 让客户确认后台信息架构是否合理。
2. 让客户确认进港、出港、提单、航班、Manifest、NOA、POD 等模块是否满足业务理解。
3. 在客户反馈后，进入下一阶段开发和后端对接。

## 3. 产品背景

Sinoport 的定位不是传统货运工具，也不是脱离现场的通用 SaaS，而是 `Promise-Driven Fulfillment` 的履约控制系统。系统目标不是简单记录流程，而是把跨境航空货运网络中的关键节点做成可见、可控、可追责的状态机。

一期产品覆盖两层后台：

- 平台管理后台：负责货站接入、网络治理、规则治理、审计治理。
- 货站后台：负责站内进港、出港、理货、提单、NOA、POD、Manifest 和异常处理。

## 4. 当前交付形态

### 4.1 已完成形态

- 企业官网静态站：[https://sinoport.co/](https://sinoport.co/)
- 平台管理后台桌面端原型：[https://sinoport.co/platform/operations](https://sinoport.co/platform/operations)
- 货站后台桌面端原型：[https://sinoport.co/station/dashboard](https://sinoport.co/station/dashboard)
- 货站移动端作业原型：[https://sinoport.co/mobile/login](https://sinoport.co/mobile/login)

### 4.2 当前技术形态

- 桌面端后台基于 `Mantis` 管理后台模板实现
- 当前交付为前端原型与静态交互页
- 当前使用样例数据、样例单证、样例状态，不是生产真实数据

### 4.3 当前尚未进入本版范围

- 后端持久化
- 真实权限系统
- 真实文件上传与存储
- 航班/车队/邮件/短信/API 对接
- 客户门户与外部查询
- 财务结算、合同、发票、经营分析

## 5. 产品目标

### 5.1 业务目标

- 建立一个可扩展的多货站网络后台，支持不同机场货站接入 Sinoport 网络。
- 统一管理进港与出港航班、货物、状态、单证与异常。
- 让货物从预报、收货、装载、飞走，到落地、拆板、理货、NOA、交付的全过程可追踪。
- 形成以 `Flight / AWB / ULD / Truck / POD / Event` 为主键的统一控制链路。

### 5.2 本轮原型目标

- 先把菜单结构和页面边界做清楚
- 先把进港/出港/提单/航班/Manifest 的对象关系讲清楚
- 先让客户确认各模块是否符合业务操作方式

## 6. 用户角色

| 角色 | 所属后台 | 当前关注点 |
| --- | --- | --- |
| 平台超级管理员 | 平台管理后台 | 新增货站、配置站点、查看网络 |
| 平台运营管理员 | 平台管理后台 | 维护航线、规则、审计记录 |
| 货站管理员 | 货站后台 | 查看本站看板、监督进出港操作 |
| 进港操作员 | 货站后台 | 航班、提单、理货、NOA、二次转运 |
| 出港操作员 | 货站后台 | 航班、提单、预报、收货、装载、Manifest |
| 主管/复核岗 | 货站后台 | 异常、POD、转运、状态放行 |

## 7. 当前信息架构

本节为当前已经实现的菜单结构，客户评审应以此为准。

### 7.1 平台管理后台

当前一级菜单：

- 运行态势中心
- 货站与资源管理
- 航线网络与链路配置
- 规则与指令引擎
- 主数据与接口治理
- 审计与可信留痕
- 平台级报表

当前线上入口：

| 模块 | 线上链接 |
| --- | --- |
| 运行态势中心 | [https://sinoport.co/platform/operations](https://sinoport.co/platform/operations) |
| 货站与资源管理 | [https://sinoport.co/platform/stations](https://sinoport.co/platform/stations) |
| 站点能力矩阵 | [https://sinoport.co/platform/stations/capabilities](https://sinoport.co/platform/stations/capabilities) |
| 班组映射 | [https://sinoport.co/platform/stations/teams](https://sinoport.co/platform/stations/teams) |
| 区位映射 | [https://sinoport.co/platform/stations/zones](https://sinoport.co/platform/stations/zones) |
| 设备映射 | [https://sinoport.co/platform/stations/devices](https://sinoport.co/platform/stations/devices) |
| 航线网络 | [https://sinoport.co/platform/network](https://sinoport.co/platform/network) |
| 链路模板 | [https://sinoport.co/platform/network/lanes](https://sinoport.co/platform/network/lanes) |
| 标准场景 | [https://sinoport.co/platform/network/scenarios](https://sinoport.co/platform/network/scenarios) |
| 规则与指令引擎 | [https://sinoport.co/platform/rules](https://sinoport.co/platform/rules) |
| 主数据与接口治理 | [https://sinoport.co/platform/master-data](https://sinoport.co/platform/master-data) |
| 同步看板 | [https://sinoport.co/platform/master-data/sync](https://sinoport.co/platform/master-data/sync) |
| 导入任务 | [https://sinoport.co/platform/master-data/jobs](https://sinoport.co/platform/master-data/jobs) |
| 对象关系 | [https://sinoport.co/platform/master-data/relationships](https://sinoport.co/platform/master-data/relationships) |
| 审计中心 | [https://sinoport.co/platform/audit](https://sinoport.co/platform/audit) |
| 审计事件明细 | [https://sinoport.co/platform/audit/events](https://sinoport.co/platform/audit/events) |
| 可信留痕占位 | [https://sinoport.co/platform/audit/trust](https://sinoport.co/platform/audit/trust) |
| 平台报表 | [https://sinoport.co/platform/reports](https://sinoport.co/platform/reports) |
| 站点对比报表 | [https://sinoport.co/platform/reports/stations](https://sinoport.co/platform/reports/stations) |

说明：

- 当前平台侧默认入口已切换为“运行态势中心”。
- 平台端已经从早期 `货站管理 / 航线网络 / 规则中心 / 审计中心` 扩展成完整的 v1.0 demo 菜单结构。

### 7.2 货站后台

当前一级菜单：

- 货站看板
- 进港管理
- 出港管理
- 提单与履约链路
- 单证与指令中心
- 作业指令中心
- 资源管理
- 异常中心
- 货站报表

当前二级菜单：

| 一级菜单 | 当前二级菜单 |
| --- | --- |
| 进港管理 | 看板、航班管理、手机理货、提单管理 |
| 出港管理 | 看板、航班管理、提单管理 |
| 资源管理 | 班组、区位、设备、车辆 |
| 单证与指令中心 | 文件中心、NOA、POD |
| 货站报表 | KPI 总览、班次报表 |

当前线上入口：

| 模块 | 线上链接 |
| --- | --- |
| 货站看板 | [https://sinoport.co/station/dashboard](https://sinoport.co/station/dashboard) |
| 进港管理看板 | [https://sinoport.co/station/inbound](https://sinoport.co/station/inbound) |
| 进港航班管理 | [https://sinoport.co/station/inbound/flights](https://sinoport.co/station/inbound/flights) |
| 进港新建航班 | [https://sinoport.co/station/inbound/flights/new](https://sinoport.co/station/inbound/flights/new) |
| 进港航班详情样例 | [https://sinoport.co/station/inbound/flights/SE803](https://sinoport.co/station/inbound/flights/SE803) |
| 进港提单管理 | [https://sinoport.co/station/inbound/waybills](https://sinoport.co/station/inbound/waybills) |
| 手机理货入口 | [https://sinoport.co/station/inbound/mobile](https://sinoport.co/station/inbound/mobile) |
| 出港管理看板 | [https://sinoport.co/station/outbound](https://sinoport.co/station/outbound) |
| 出港航班管理 | [https://sinoport.co/station/outbound/flights](https://sinoport.co/station/outbound/flights) |
| 出港提单管理 | [https://sinoport.co/station/outbound/waybills](https://sinoport.co/station/outbound/waybills) |
| 提单与履约链路 | [https://sinoport.co/station/shipments](https://sinoport.co/station/shipments) |
| 提单详情样例 | [https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585) |
| 单证与指令中心 | [https://sinoport.co/station/documents](https://sinoport.co/station/documents) |
| NOA 动作页 | [https://sinoport.co/station/documents/noa](https://sinoport.co/station/documents/noa) |
| POD 动作页 | [https://sinoport.co/station/documents/pod](https://sinoport.co/station/documents/pod) |
| 作业指令中心 | [https://sinoport.co/station/tasks](https://sinoport.co/station/tasks) |
| 资源管理 | [https://sinoport.co/station/resources](https://sinoport.co/station/resources) |
| 班组资源 | [https://sinoport.co/station/resources/teams](https://sinoport.co/station/resources/teams) |
| 区位资源 | [https://sinoport.co/station/resources/zones](https://sinoport.co/station/resources/zones) |
| 设备资源 | [https://sinoport.co/station/resources/devices](https://sinoport.co/station/resources/devices) |
| 车辆资源 | [https://sinoport.co/station/resources/vehicles](https://sinoport.co/station/resources/vehicles) |
| 异常中心 | [https://sinoport.co/station/exceptions](https://sinoport.co/station/exceptions) |
| 异常详情样例 | [https://sinoport.co/station/exceptions/EXP-0408-001](https://sinoport.co/station/exceptions/EXP-0408-001) |
| 货站报表 | [https://sinoport.co/station/reports](https://sinoport.co/station/reports) |
| 班次报表 | [https://sinoport.co/station/reports/shift](https://sinoport.co/station/reports/shift) |

说明：

- 进港管理和出港管理均保留一级“看板”页。
- 在一级看板基础上，再细分二级菜单以承接具体操作。

## 8. 核心业务对象

| 对象 | 主键 | 当前用途 |
| --- | --- | --- |
| Station | `Station ID / Airport Code` | 货站台账与站点接入 |
| Flight | `Flight ID / Flight No / Flight Date` | 进港/出港航班主实体 |
| AWB / HAWB | `AWB No / HAWB No` | 提单管理与货物识别 |
| ULD / PMC | `ULD / PMC ID` | 装载、拆板、舱单关联 |
| Truck | `Truck ID / Plate No` | 二次转运与交付车辆 |
| FFM | `FFM Message ID` | 出港货物预报 |
| UWS | `UWS ID` | 装载信息 |
| Manifest | `Manifest ID` | 舱单交换与目的港对账 |
| NOA | `NOA ID` | 到货通知 |
| POD | `POD ID` | 签收与交付闭环 |
| Exception | `Exception ID` | 异常归因与处理 |

## 9. 当前流程口径

### 9.1 进港主状态链

- 运达
- 已卸机
- 已入货站
- 拆板理货中
- `NOA` 已发送
- 已交付

说明：

- 当前桌面端原型顶部 KPI 卡片展示前 `5` 个状态。
- `已交付` 保留在业务流程与下方数据中，但不在顶部 KPI 卡片中展示。

### 9.2 出港主状态链

- 已预报
- 已接收
- 主单完成
- 已装载
- 已飞走
- Manifest / 目的港回传

## 10. 平台管理后台 PRD

### 10.1 货站管理

当前已实现内容：

- 货站台账列表
- 货站编码、区域、控制层级、阶段、Owner 展示
- “进入货站系统”按钮
- 站点能力、班组、区位、设备子页面

当前线上入口：

- 总览：[https://sinoport.co/platform/stations](https://sinoport.co/platform/stations)
- 能力矩阵：[https://sinoport.co/platform/stations/capabilities](https://sinoport.co/platform/stations/capabilities)
- 班组映射：[https://sinoport.co/platform/stations/teams](https://sinoport.co/platform/stations/teams)
- 区位映射：[https://sinoport.co/platform/stations/zones](https://sinoport.co/platform/stations/zones)
- 设备映射：[https://sinoport.co/platform/stations/devices](https://sinoport.co/platform/stations/devices)

当前客户需确认：

- 平台侧新增货站的必填字段是否足够
- 平台是否需要维护更多站点属性
- 平台是否需要批量导入货站

### 10.2 航线网络

当前已实现内容：

- 主链路矩阵
- 业务模式
- 参与站点
- 承诺口径
- 关键事件字段
- 站点网络准备度视图
- 链路模板页
- 标准场景页

当前线上入口：

- 总览：[https://sinoport.co/platform/network](https://sinoport.co/platform/network)
- 链路模板：[https://sinoport.co/platform/network/lanes](https://sinoport.co/platform/network/lanes)
- 标准场景：[https://sinoport.co/platform/network/scenarios](https://sinoport.co/platform/network/scenarios)

当前客户需确认：

- 当前链路表达是否满足业务沟通
- 是否需要增加更多中转链路
- 是否需要展示更多 KPI

### 10.3 规则中心

当前已实现内容：

- 服务等级 `P1 / P2 / P3`
- 硬门槛规则 `HG-01` 到 `HG-08`
- 异常字典
- 接口治理状态表
- 任务生成规则
- 证据要求
- 标准场景编排

当前线上入口：

- [https://sinoport.co/platform/rules](https://sinoport.co/platform/rules)

当前客户需确认：

- 硬门槛规则是否符合实际 SOP
- 异常分类是否足够覆盖实际业务
- 接口治理是否需要单独成模块

### 10.4 审计中心

当前已实现内容：

- 操作时间
- 操作人
- 动作
- 对象
- 结果
- 备注
- 审计事件明细
- 变更前后值展示
- Event Hash / Signature / Notarization 可信字段占位

当前线上入口：

- 审计中心：[https://sinoport.co/platform/audit](https://sinoport.co/platform/audit)
- 审计事件明细：[https://sinoport.co/platform/audit/events](https://sinoport.co/platform/audit/events)
- 可信留痕占位：[https://sinoport.co/platform/audit/trust](https://sinoport.co/platform/audit/trust)

当前客户需确认：

- 审计字段是否足够
- 是否需要审批流、变更前后值、导出日志

## 11. 货站后台 PRD

### 11.1 货站看板

当前已实现内容：

- 今日进港航班
- 今日出港航班
- 二次转运待办
- 站内执行原则
- 头部 KPI 卡片
- 当前阻断与待处理任务摘要

当前线上入口：

- [https://sinoport.co/station/dashboard](https://sinoport.co/station/dashboard)

当前客户需确认：

- 货站首页最重要的 `4-6` 个指标是什么
- 看板是否需要增加“异常待处理”或“待签收”区块

## 12. 进港管理 PRD

### 12.1 进港管理 / 看板

当前已实现内容：

- 进港航班看板
- 货物状态流
- `NOA` 待发送列表
- 二次转运记录

当前线上入口：

- [https://sinoport.co/station/inbound](https://sinoport.co/station/inbound)

当前客户需确认：

- 进港看板是否还需要“待上传 POD”区块
- 状态流节点是否要继续细分

### 12.2 进港管理 / 航班管理

当前已实现内容：

- 顶部按状态排布的 KPI 卡片
- 每张 KPI 卡片展示 `当前数 / 总数`
- 卡片内部保留进度条
- 进港航班操作台
- 每个航班的操作按钮：查看、理货、NOA、交付

当前线上入口：

- 总览：[https://sinoport.co/station/inbound/flights](https://sinoport.co/station/inbound/flights)
- 航班详情样例：[https://sinoport.co/station/inbound/flights/SE803](https://sinoport.co/station/inbound/flights/SE803)

当前客户需确认：

- 顶部 KPI 卡片应展示哪些状态
- 每个航班还需要哪些操作按钮
- 航班列表字段是否足够

### 12.3 进港管理 / 新建航班

当前已实现内容：

- 新建航班表单原型
- 字段：航班号、来源、ETA、ETD
- 创建前的实时预览

当前线上入口：

- [https://sinoport.co/station/inbound/flights/new](https://sinoport.co/station/inbound/flights/new)

当前客户需确认：

- 是否需要加入航线、站点、机型、到货类型等字段
- 新建航班是否需要审批

### 12.4 进港管理 / 航班详情

当前已实现内容：

- 航班基础信息
- 提单总数、待发 `NOA`、待补 `POD` 等 KPI
- 该航班下所有提单状态总览

当前线上入口：

- [https://sinoport.co/station/inbound/flights/SE803](https://sinoport.co/station/inbound/flights/SE803)

当前客户需确认：

- 航班详情是否还需要二次转运明细
- 是否需要操作日志与时间轴

### 12.5 进港管理 / 手机理货

当前已实现内容：

- 桌面端已提供进入“手机理货”页面的入口
- 已实现独立移动端作业原型，覆盖：
  - 登录
  - 选择执行节点
  - 进港航班列表
  - 进港航班详情
  - 条码扫描与点货
  - 托盘管理
  - 装车与装车计划
  - 角色切换
  - 离线补传队列

当前线上入口：

- 登录：[https://sinoport.co/mobile/login](https://sinoport.co/mobile/login)
- 节点选择：[https://sinoport.co/mobile/select](https://sinoport.co/mobile/select)
- 进港航班列表：[https://sinoport.co/mobile/inbound](https://sinoport.co/mobile/inbound)
- 进港航班详情样例：[https://sinoport.co/mobile/inbound/SE803](https://sinoport.co/mobile/inbound/SE803)
- 拆板理货样例：[https://sinoport.co/mobile/inbound/SE803/breakdown](https://sinoport.co/mobile/inbound/SE803/breakdown)

当前客户需确认：

- 手机理货是否作为一期正式范围
- 现场是否以扫码为主，还是人工点数为主
- 托盘、装车计划、装车执行是否符合一线流程

### 12.6 进港管理 / 提单管理

当前已实现内容：

- 按 `AWB` 展示提单台账
- 字段：所属航班、收货方、件数、重量、当前节点、`NOA`、`POD`
- 操作按钮：查看提单、更新状态、回连履约链路与单证

当前线上入口：

- [https://sinoport.co/station/inbound/waybills](https://sinoport.co/station/inbound/waybills)

当前客户需确认：

- 提单台账字段是否足够
- 是否需要支持按 `ULD / Truck / Destination` 筛选

## 13. 出港管理 PRD

### 13.1 出港管理 / 看板

当前已实现内容：

- 头部 KPI 卡片
- 出港航班总览
- `FFM` 预报
- 货物接收
- 主单
- 装载 / `UWS`
- Manifest
- 机坪放行阻断与飞走前门槛

当前线上入口：

- [https://sinoport.co/station/outbound](https://sinoport.co/station/outbound)

说明：

- 当前出港看板已经把“预报、接收、主单、装载、Manifest”拆成多个区块展示。

当前客户需确认：

- 这些区块的优先顺序是否符合操作习惯
- 是否需要把“飞走确认”拆成独立区域

### 13.2 出港管理 / 航班管理

当前已实现内容：

- 出港航班操作台
- 航班级指标卡片
- 每个航班的操作按钮：预报、收货、装载、飞走

当前线上入口：

- [https://sinoport.co/station/outbound/flights](https://sinoport.co/station/outbound/flights)

当前客户需确认：

- 航班级页面是否需要增加舱位、机型、航段信息
- 操作按钮是否要改成审批流

### 13.3 出港管理 / 提单管理

当前已实现内容：

- 按提单维度展示预报、收货、主单、装载、Manifest 状态
- 操作按钮：查看提单、打印主单、更新装载

当前线上入口：

- [https://sinoport.co/station/outbound/waybills](https://sinoport.co/station/outbound/waybills)

当前客户需确认：

- 提单页是否需要支持批量打印
- 是否需要增加目的港回传对账状态

## 14. 文件中心 PRD

当前已实现内容：

- 文件中心列表页
- 类型：`FFM / UWS / Manifest / MAWB / POD`
- 展示文件名、关联对象、版本、更新时间、状态
- 预览、生效版本、替换、回退、对象绑定
- `NOA` 动作页
- `POD` 补签与归档动作页

当前线上入口：

- 文件中心：[https://sinoport.co/station/documents](https://sinoport.co/station/documents)
- `NOA`：[https://sinoport.co/station/documents/noa](https://sinoport.co/station/documents/noa)
- `POD`：[https://sinoport.co/station/documents/pod](https://sinoport.co/station/documents/pod)

当前客户需确认：

- 是否需要 `NOA` 文件单独展示
- 是否还需要下载、导出等更深的文件动作

## 15. 异常中心 PRD

当前已实现内容：

- 异常 KPI 卡片
- 异常案例表
- 字段：异常编号、类型、对象、Owner、SLA、状态
- 异常详情页
- 阻断任务、命中门槛、恢复动作、关联文件、关联对象跳转

当前线上入口：

- 异常中心：[https://sinoport.co/station/exceptions](https://sinoport.co/station/exceptions)
- 异常详情样例：[https://sinoport.co/station/exceptions/EXP-0408-001](https://sinoport.co/station/exceptions/EXP-0408-001)

当前客户需确认：

- 是否需要异常关闭动作
- 是否需要责任归因字段更细化

## 16. 单证样本与当前页面对应关系

| 样本 | 当前对应模块 | 当前用途 |
| --- | --- | --- |
| `SE913FFM报文2026.04.01.docx` | 出港看板 / 提单管理 | 货物预报 |
| `SE913 01APR UWS.xlsx` | 出港看板 | 装载信息 |
| `SE600 MANIFEST 01APR.pdf` | 出港看板 / Manifest | 舱单展示 |
| `436-10358585-主单套打模板.xlsx` | 出港看板 / 提单管理 | 主单信息 |

## 17. 当前未实现但仍在规划中的模块

以下内容仍属于后续开发范围，当前前端 demo 只做表达，不做真实系统实现：

- 真实文件上传、真实下载与对象存储
- 真实权限与审批
- 真实 API / 数据库对接
- 真实通知通道
- 真实审计入库与可信写入
- 报表导出与数据沉淀
- 客户门户与外部查询

## 18. 需要客户重点确认的问题

请客户重点围绕以下问题反馈：

1. 平台管理后台的菜单结构是否合理，是否还需要“平台总览”。
2. 货站后台是否接受“一级看板 + 二级操作菜单”的结构。
3. 进港管理中，是否保留“手机理货”为一期范围。
4. 进港航班管理、提单管理的字段和操作按钮是否符合现场使用习惯。
5. 出港页面中，`FFM / 主单 / UWS / Manifest` 的拆分方式是否合理。
6. Manifest 页面是否需要更强的目的港对账表达。
7. 文件中心和异常中心是否需要更多动作能力，而不是只看列表。

## 19. 下一阶段开发建议

如果客户确认本版 PRD，可按以下顺序进入下一阶段：

1. 冻结菜单结构与页面边界
2. 冻结航班、提单、Manifest、NOA、POD 的字段字典
3. 定义状态流转规则和权限矩阵
4. 接入真实接口或先接本地 mock API
5. 再进入后端开发、联调和验收

补充说明：

- 本版客户评审可直接结合上文中的线上链接完成页面核对。
- 若客户反馈基于页面而非文档描述，可直接引用对应链接定位问题。
