# Sinoport OS UI 验收清单 v1.0

## 1. 文档目的

本清单用于客户进行当前前端 demo 的界面验收。

本文件只覆盖：

- 信息架构
- 页面入口
- 页面布局
- 模块表达
- 状态展示
- 演示数据表达

本文件不覆盖：

- 后端实现
- 权限控制
- 真实接口联调
- 数据持久化
- 文件真实上传

## 2. 验收原则

客户在验收时，请重点判断：

1. 模块是否齐全
2. 菜单结构是否合理
3. 页面表达是否符合业务理解
4. 操作路径是否顺畅
5. 关键对象、状态、单证是否展示正确

不需要在本轮验收中判断：

- 按钮是否真的写库
- 数据是否来自真实系统
- 权限是否已接通
- 文件是否真实入库

## 3. 当前验收环境

### 3.1 官网静态站

- [https://sinoport.co/](https://sinoport.co/)

### 3.2 后台桌面端 demo

- [https://adonio-sinoport-admin.pages.dev/](https://adonio-sinoport-admin.pages.dev/)

### 3.3 验收说明

- 当前 demo 使用样例数据
- 当前 demo 重点用于确认 UI 结构与业务表达
- 如页面内容正确但按钮尚未接真实逻辑，视为本轮正常范围

## 4. 平台管理后台验收

### 4.1 运行态势中心

入口：

- [https://sinoport.co/platform/operations](https://sinoport.co/platform/operations)

验收点：

- 是否能体现平台层主入口定位
- 是否能看到全网运行态、风险和阻断摘要
- 是否能体现站点健康度与链路状态
- 是否符合客户对“平台控制层”的理解

### 4.2 货站与资源管理

入口：

- [https://sinoport.co/platform/stations](https://sinoport.co/platform/stations)
- [https://sinoport.co/platform/stations/capabilities](https://sinoport.co/platform/stations/capabilities)
- [https://sinoport.co/platform/stations/teams](https://sinoport.co/platform/stations/teams)
- [https://sinoport.co/platform/stations/zones](https://sinoport.co/platform/stations/zones)
- [https://sinoport.co/platform/stations/devices](https://sinoport.co/platform/stations/devices)

验收点：

- 货站台账结构是否合理
- 货站能力矩阵是否清晰
- 班组、区位、设备是否需要继续细化
- “进入货站系统”的表达是否合理

### 4.3 航线网络与链路配置

入口：

- [https://sinoport.co/platform/network](https://sinoport.co/platform/network)
- [https://sinoport.co/platform/network/lanes](https://sinoport.co/platform/network/lanes)
- [https://sinoport.co/platform/network/scenarios](https://sinoport.co/platform/network/scenarios)

验收点：

- 航线链路表达是否符合业务沟通
- 标准场景是否易理解
- 是否需要补更多中转链路或场景模板

### 4.4 规则与指令引擎

入口：

- [https://sinoport.co/platform/rules](https://sinoport.co/platform/rules)

验收点：

- 服务等级、硬门槛、异常字典是否表达清楚
- 规则是否接近实际 SOP
- 页面是否足以承接后续规则配置

### 4.5 主数据与接口治理

入口：

- [https://sinoport.co/platform/master-data](https://sinoport.co/platform/master-data)
- [https://sinoport.co/platform/master-data/sync](https://sinoport.co/platform/master-data/sync)
- [https://sinoport.co/platform/master-data/jobs](https://sinoport.co/platform/master-data/jobs)
- [https://sinoport.co/platform/master-data/relationships](https://sinoport.co/platform/master-data/relationships)

验收点：

- 主数据页面是否容易理解
- 对象关系是否表达到位
- 接口同步和导入任务页面是否需要继续增强

### 4.6 审计与可信留痕

入口：

- [https://sinoport.co/platform/audit](https://sinoport.co/platform/audit)
- [https://sinoport.co/platform/audit/events](https://sinoport.co/platform/audit/events)
- [https://sinoport.co/platform/audit/trust](https://sinoport.co/platform/audit/trust)

验收点：

- 审计页面是否能说明“可追责”
- 审计字段和可信留痕占位是否需要补强

### 4.7 平台报表

入口：

- [https://sinoport.co/platform/reports](https://sinoport.co/platform/reports)
- [https://sinoport.co/platform/reports/stations](https://sinoport.co/platform/reports/stations)

验收点：

- 报表在平台层是否需要保留一级入口
- 当前展示是否足够支持客户理解

## 5. 货站后台验收

### 5.1 货站看板

入口：

- [https://sinoport.co/station/dashboard](https://sinoport.co/station/dashboard)

验收点：

- 首页是否能体现站内主管视角
- 是否能快速看到进港、出港、转运、阻断、KPI
- 首页指标是否需要调整

### 5.2 进港管理 / 看板

入口：

- [https://sinoport.co/station/inbound](https://sinoport.co/station/inbound)

验收点：

- 进港总览结构是否合理
- 状态流、NOA、二次转运的表达是否清晰
- 是否还需要待签收 / 待补 POD 区块

### 5.3 进港管理 / 航班管理

入口：

- [https://sinoport.co/station/inbound/flights](https://sinoport.co/station/inbound/flights)
- [https://sinoport.co/station/inbound/flights/new](https://sinoport.co/station/inbound/flights/new)
- [https://sinoport.co/station/inbound/flights/SE803](https://sinoport.co/station/inbound/flights/SE803)

验收点：

- 航班管理是否适合作为进港操作台
- 顶部 KPI 卡片是否合理
- 航班详情是否满足查看和后续操作预期
- 新建航班表单字段是否足够

### 5.4 进港管理 / 提单管理

入口：

- [https://sinoport.co/station/inbound/waybills](https://sinoport.co/station/inbound/waybills)

验收点：

- 提单台账字段是否足够
- 当前节点、NOA、POD 的表达是否明确
- 是否需要补筛选条件

### 5.5 进港管理 / PDA 作业终端

入口：

- [https://sinoport.co/station/inbound/mobile](https://sinoport.co/station/inbound/mobile)

验收点：

- 桌面端入口是否合理
- 是否需要保留为一期范围

### 5.6 出港管理 / 总览

入口：

- [https://sinoport.co/station/outbound](https://sinoport.co/station/outbound)

验收点：

- 出港总览是否把预报、收货、主单、装载、Manifest 表达清楚
- 是否需要增加独立的飞走确认区块

### 5.7 出港管理 / 航班管理

入口：

- [https://sinoport.co/station/outbound/flights](https://sinoport.co/station/outbound/flights)

验收点：

- 航班列表字段是否够用
- 预报、收货、装载、飞走这几个操作表达是否清楚

### 5.8 出港管理 / 提单管理

入口：

- [https://sinoport.co/station/outbound/waybills](https://sinoport.co/station/outbound/waybills)

验收点：

- 提单状态链是否合理
- 是否需要批量打印主单、批量更新装载

### 5.9 提单与履约链路

入口：

- [https://sinoport.co/station/shipments](https://sinoport.co/station/shipments)
- [https://sinoport.co/station/shipments/in-436-10358585](https://sinoport.co/station/shipments/in-436-10358585)

验收点：

- 是否能满足“按一票货看全链路”的需求
- 是否需要补更多上下游信息

### 5.10 单证与指令中心

入口：

- [https://sinoport.co/station/documents](https://sinoport.co/station/documents)
- [https://sinoport.co/station/documents/noa](https://sinoport.co/station/documents/noa)
- [https://sinoport.co/station/documents/pod](https://sinoport.co/station/documents/pod)

验收点：

- 单证与指令中心是否已经把文件、通知和动作关系表达清楚
- NOA / POD 是否需要更强的操作表达

### 5.11 作业指令中心

入口：

- [https://sinoport.co/station/tasks](https://sinoport.co/station/tasks)

验收点：

- 任务池表达是否清晰
- 是否符合现场任务分派理解

### 5.12 资源管理

入口：

- [https://sinoport.co/station/resources](https://sinoport.co/station/resources)
- [https://sinoport.co/station/resources/teams](https://sinoport.co/station/resources/teams)
- [https://sinoport.co/station/resources/zones](https://sinoport.co/station/resources/zones)
- [https://sinoport.co/station/resources/devices](https://sinoport.co/station/resources/devices)
- [https://sinoport.co/station/resources/vehicles](https://sinoport.co/station/resources/vehicles)

验收点：

- 班组、区位、设备、车辆是否需要保留为货站后台一级能力

### 5.13 异常中心

入口：

- [https://sinoport.co/station/exceptions](https://sinoport.co/station/exceptions)
- [https://sinoport.co/station/exceptions/EXP-0408-001](https://sinoport.co/station/exceptions/EXP-0408-001)

验收点：

- 异常列表和详情是否足以支撑客户理解
- 是否需要补更多归因和恢复动作

### 5.14 货站报表

入口：

- [https://sinoport.co/station/reports](https://sinoport.co/station/reports)
- [https://sinoport.co/station/reports/shift](https://sinoport.co/station/reports/shift)

验收点：

- 是否需要保留报表中心
- 是否需要更多班组/班次表达

## 6. PDA 终端验收

### 6.1 登录与节点选择

- [https://sinoport.co/mobile/login](https://sinoport.co/mobile/login)
- [https://sinoport.co/mobile/select](https://sinoport.co/mobile/select)

验收点：

- 登录入口是否合理
- 节点选择是否符合现场角色理解

### 6.2 九个执行节点

入口：

- 前置仓：[https://sinoport.co/mobile/pre-warehouse](https://sinoport.co/mobile/pre-warehouse)
- 头程卡车：[https://sinoport.co/mobile/headhaul](https://sinoport.co/mobile/headhaul)
- 出港货站：[https://sinoport.co/mobile/outbound](https://sinoport.co/mobile/outbound)
- 出港机坪：[https://sinoport.co/mobile/export-ramp](https://sinoport.co/mobile/export-ramp)
- 航班运行：[https://sinoport.co/mobile/runtime](https://sinoport.co/mobile/runtime)
- 到港机坪：[https://sinoport.co/mobile/destination-ramp](https://sinoport.co/mobile/destination-ramp)
- 进港货站：[https://sinoport.co/mobile/inbound](https://sinoport.co/mobile/inbound)
- 尾程：[https://sinoport.co/mobile/tailhaul](https://sinoport.co/mobile/tailhaul)
- 交付仓：[https://sinoport.co/mobile/delivery](https://sinoport.co/mobile/delivery)

验收点：

- 节点划分是否合理
- PDA 是否需要覆盖全部节点，还是只覆盖重点节点
- 当前任务卡、扫码、拍照、计数、装车等交互是否符合现场作业方式

## 7. 本轮客户重点反馈项

请客户重点反馈以下内容：

1. 菜单结构是否接受
2. 平台模块是否需要增减
3. 货站模块是否需要增减
4. 进港 / 出港 / 提单 / Manifest 的表达是否正确
5. 是否保留 PDA 为一期范围
6. 哪些页面还需要补字段、补模块、补流程

## 8. 本轮不需要客户判断的内容

客户本轮无需判断：

- 后端是否已接通
- 数据是否已入库
- 权限是否已做好
- 文件是否真实上传
- 接口是否真实联调

## 9. 建议交付方式

建议把以下资料一起交给客户：

1. [Sinoport_OS_PRD_v1.0_开发版.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_PRD_v1.0_开发版.md)
2. 本 UI 验收清单
3. 线上 demo 地址
4. 一份简短演示说明
