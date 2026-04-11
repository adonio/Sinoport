# Sinoport OS 第一批前端 Demo 迭代清单

> 历史文档说明：本文件为第一批迭代清单，当前正式模块命名以开发版 PRD 和 UI 任务文档为准。

## 1. 文档定位

本文件只服务于当前阶段的第一批开发任务，并且只针对前端 demo。

约束只有一条：

- 当前阶段不做任何后台实现代码。

因此本文件中的“任务编排”“文件放行”“接口治理”“审计留痕”“权限控制”，都只落前端页面、交互、状态表达、mock 数据和占位 contract，不落服务端逻辑。

关联文档：

- 总规划：[sinoport-os-upgrade-task-plan.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-upgrade-task-plan.md)
- 主 PRD：[Sinoport_OS_PRD_v1.0_升级开发版.md](/Users/lijun/Downloads/Sinoport/Sinoport_OS_PRD_v1.0_升级开发版.md)

## 2. 第一批目标

第一批的目标不是把系统做“全”，而是把最关键的 demo 主干做“成型”：

1. 完成 v1.0 的核心信息架构替换。
2. 把状态、对象、任务、文件四条主线统一起来。
3. 让平台端、货站端、PDA 端能围绕 `MME` 样板站形成一个可演示的闭环。
4. 让后续第二批开发在统一页面骨架和统一 mock 口径上继续推进。

## 3. 第一批范围

本批次只包含总规划里的以下任务：

- A-01 到 A-06
- P-01、P-04、P-05
- S-01 到 S-08
- M-02、M-03、M-10
- E-01、E-02、E-03
- Q-01、Q-02、Q-03、Q-04、Q-05

## 4. 交付标准

### 4.1 页面标准

1. 桌面端沿用 `PageHeader + MainCard + MetricCard + Table/List/Form` 骨架。
2. 移动端沿用共享壳页 + 底部固定任务导航 + 统一任务卡。
3. 页面必须有空态、演示态、阻断态、完成态，不允许只有正常态。

### 4.2 数据标准

1. mock 数据集中放在统一领域层，不在页面里散写。
2. 所有页面只消费“整理后的前端领域对象”，不直接依赖未来 API 形状。
3. 每个模块都必须能用静态数据完整演示核心流程。

### 4.3 代码标准

1. 不新增后端目录和后端代码。
2. 不写真实接口调用链路。
3. 不写真实鉴权、真实上传、真实持久化。
4. 路由、菜单、搜索、workspace 入口必须同步更新。

## 5. 建议迭代顺序

| 迭代 | 目标 | 对应任务 |
| --- | --- | --- |
| Iteration 1 | 基线重构 | A-01, A-02, A-03, A-04 |
| Iteration 2 | 通用组件和平台主控 | A-05, P-01, P-04, P-05 |
| Iteration 3 | 货站桌面主干 | S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-08 |
| Iteration 4 | PDA 样板站主干 | A-06, M-02, M-03, M-10 |
| Iteration 5 | 文件/任务/门槛联动与验收 | E-01, E-02, E-03, Q-01, Q-02, Q-03, Q-04, Q-05 |

## 6. 详细任务拆分

### 6.1 Iteration 1: 基线重构

#### T1-01 信息架构与命名替换

- 对应任务：A-01
- 目标：
  - 把 v0.2 的旧命名替换成 v1.0 的命名体系
  - 为新增主模块留出路由和菜单位置
- 需要修改的文件区域：
  - `admin-console/src/routes/MainRoutes.jsx`
  - `admin-console/src/menu-items/platform.js`
  - `admin-console/src/menu-items/station.js`
  - `admin-console/src/layout/Dashboard/Header/HeaderContent/data/search-data.jsx`
  - `admin-console/src/layout/Dashboard/Header/HeaderContent/data/workspace-data.js`
  - `admin-console/src/config.js`
- 本轮必须完成：
  - 增加平台 `运行态势中心` 路由占位
  - `文件中心` 改为 `单证与指令中心`
  - 新增 `提单与履约链路`、`作业指令中心`、`班组 / 区位 / 设备管理` 菜单占位
  - `手机理货` 在桌面端文案升级为 `PDA 作业终端`
- 完成定义：
  - 菜单、搜索、workspace、默认入口命名一致
  - 页面即使还是占位页，也能走通路由

#### T1-02 统一状态字典

- 对应任务：A-02
- 目标：
  - 整理 Flight Runtime、Ground Fulfillment、Task、Document、Exception 的状态字典
- 建议新增文件：
  - `admin-console/src/data/sinoport-status.js`
  - 或 `admin-console/src/data/sinoport-dictionaries.js`
- 本轮必须完成：
  - 状态枚举
  - 中英文 label
  - 默认颜色映射
  - 状态分组
- 需要同步调整：
  - `admin-console/src/components/sinoport/StatusChip.jsx`
  - 当前各页面散落的状态文案
- 完成定义：
  - 状态颜色和标签不再由页面自己决定
  - 新状态只加字典即可复用

#### T1-03 统一对象模型

- 对应任务：A-03
- 目标：
  - 定义前端 demo 统一对象：`Flight`、`Shipment/AWB`、`Task`、`Document`、`Exception`、`Worker`、`Zone`
- 建议新增文件：
  - `admin-console/src/data/sinoport-models.js`
  - 或并入 `sinoport-dictionaries.js`
- 本轮必须完成：
  - 每类对象的最小字段
  - 页面展示字段
  - 关联对象字段
  - mock id 主键规则
- 完成定义：
  - 后续页面可基于统一对象组装，不再重复定义字段

#### T1-04 前端领域适配层

- 对应任务：A-04
- 目标：
  - 把当前 `data/sinoport.js` 从“页面直用样例数据”升级成“可被页面消费的前端领域数据层”
- 需要修改或新增：
  - `admin-console/src/data/sinoport.js`
  - `admin-console/src/data/sinoport-adapters.js`
  - `admin-console/src/data/sinoport-mock/*.js` 或同类目录
- 本轮必须完成：
  - 按平台、货站、PDA 拆分 mock 数据
  - 通过 adapter 输出给页面
  - 为未来 API 保留 mapper 结构，但不接真实请求
- 完成定义：
  - 页面组件不再直接读取一大坨混合数据

### 6.2 Iteration 2: 通用组件和平台主控

#### T2-01 提炼桌面端业务组件

- 对应任务：A-05
- 目标：
  - 从已有页面中沉淀出可复用的 Sinoport 业务组件
- 建议新增组件：
  - `ObjectSummaryCard`
  - `LifecycleStepList`
  - `TaskQueueCard`
  - `DocumentStatusCard`
  - `ExceptionSummaryCard`
  - `BlockingReasonAlert`
- 建议目录：
  - `admin-console/src/components/sinoport/`
- 完成定义：
  - 后续平台页和货站页能复用，不再大量复制 MUI 结构

#### T2-02 平台运行态势中心

- 对应任务：P-01
- 目标：
  - 新增平台主入口页面
- 建议新增页面：
  - `admin-console/src/pages/platform/operations.jsx`
- 需要同步：
  - `MainRoutes.jsx`
  - `platform.js`
  - `search-data.jsx`
  - `workspace-data.js`
  - `config.js` 默认入口
- 页面结构建议：
  - 顶部 KPI
  - 链路健康卡
  - 样板站风险卡
  - 接口告警卡
  - 待审批动作卡
  - 事件时间线
- mock 数据建议：
  - `networkHealth`
  - `stationRiskList`
  - `pendingApprovals`
  - `integrationAlerts`
  - `globalEvents`
- 完成定义：
  - 平台默认进入该页
  - 页面能完整讲清“全网主控”而不是站点台账

#### T2-03 升级规则与指令引擎

- 对应任务：P-04
- 目标：
  - 把当前规则中心从静态说明页升级为业务引擎前端原型
- 需要修改页面：
  - `admin-console/src/pages/platform/rules.jsx`
- 本轮必须补齐：
  - 服务等级视图
  - 硬门槛列表
  - 任务生成规则表
  - 指令模板列表
  - 升级规则卡片
  - 证据要求卡片
- 完成定义：
  - 页面能清楚回答“规则如何驱动任务和放行”

#### T2-04 新增主数据与接口治理

- 对应任务：P-05
- 目标：
  - 新增平台级治理页面
- 建议新增页面：
  - `admin-console/src/pages/platform/master-data.jsx`
- 本轮必须包含：
  - 主键映射表
  - 数据缺口列表
  - mock 导入日志
  - mock 接口状态
  - mock 同步失败与重试
- 完成定义：
  - 页面可演示“接口治理”和“主数据治理”，但不接任何真实接口

### 6.3 Iteration 3: 货站桌面主干

#### T3-01 重构货站看板

- 对应任务：S-01
- 需要修改页面：
  - `admin-console/src/pages/station/dashboard.jsx`
- 本轮必须补齐：
  - 阻塞任务
  - 待发 NOA
  - 待补 POD
  - 待转运
  - 待复核
  - 异常热点
- 完成定义：
  - 首页是“执行控制台”，不是静态摘要页

#### T3-02 升级进港总览与航班管理

- 对应任务：S-02, S-03
- 需要修改页面：
  - `admin-console/src/pages/station/inbound.jsx`
  - `admin-console/src/pages/station/inbound-flights.jsx`
  - `admin-console/src/pages/station/inbound-flight-detail.jsx`
- 本轮必须补齐：
  - 进港状态链
  - 节点任务队列
  - 阻断原因
  - 任务入口
  - 航班详情与任务/文件/异常联动
- 完成定义：
  - 进港页面从“看数据”升级成“看状态 + 看任务 + 看阻断”

#### T3-03 升级出港总览与航班管理

- 对应任务：S-04, S-05
- 需要修改页面：
  - `admin-console/src/pages/station/outbound.jsx`
  - `admin-console/src/pages/station/outbound-flights.jsx`
- 本轮必须补齐：
  - 出港状态链
  - FFM/UWS/Manifest 文件依赖
  - Loaded/Airborne 放行占位
  - 航班视角的作业入口
- 完成定义：
  - 出港链路能讲清楚“预报 -> 收货 -> 主单 -> 组板 -> 装机 -> 飞走”

#### T3-04 新增提单与履约链路

- 对应任务：S-06
- 建议新增页面：
  - `admin-console/src/pages/station/shipments.jsx`
  - `admin-console/src/pages/station/shipment-detail.jsx`
- 需要同步：
  - `MainRoutes.jsx`
  - `station.js`
  - `search-data.jsx`
- 本轮必须补齐：
  - Shipment/AWB 列表
  - 链路时间线
  - 关联航班
  - 关联文件
  - 关联任务
  - 关联异常
- 完成定义：
  - 不再把提单仅当作进港/出港二级页附属表格

#### T3-05 升级单证与指令中心

- 对应任务：S-07
- 需要修改页面：
  - `admin-console/src/pages/station/files.jsx`
- 本轮必须补齐：
  - 文件台账
  - 版本覆盖
  - 差异提示
  - 放行状态
  - 指令模板
  - 文件与对象回连
- 完成定义：
  - 文件中心完成更名和能力升级，能表达“文件驱动状态”

#### T3-06 新增作业指令中心

- 对应任务：S-08
- 建议新增页面：
  - `admin-console/src/pages/station/tasks.jsx`
- 本轮必须补齐：
  - 我的任务
  - 站内任务池
  - 待升级任务
  - 待复核任务
  - 已完成任务
  - 任务详情抽屉或详情页
- 完成定义：
  - 货站端有真正的任务主视图

### 6.4 Iteration 4: PDA 样板站主干

#### T4-01 统一任务卡组件

- 对应任务：A-06, M-02
- 建议新增：
  - `admin-console/src/components/sinoport/mobile/TaskCard.jsx`
  - `TaskEvidenceSection.jsx`
  - `TaskActionBar.jsx`
  - `TaskBlockerNotice.jsx`
- 本轮必须补齐：
  - 任务头
  - 关联对象
  - SLA
  - 优先级
  - 必填项
  - 证据区
  - 阻断提醒
  - 操作区
- 完成定义：
  - PDA 样板链路都开始基于统一任务卡组织

#### T4-02 PDA 通用动作层

- 对应任务：M-03
- 优先落在：
  - `admin-console/src/pages/mobile/inbound-shared.jsx`
  - `admin-console/src/pages/mobile/outbound-shared.jsx`
- 本轮必须抽象：
  - 扫码动作
  - 拍照动作占位
  - 上传文件占位
  - 确认完成
  - 挂起
  - 转派
  - 备注
- 完成定义：
  - 通用动作不再散落在某个具体面板内部

#### T4-03 重构进港机场货站操作链路

- 对应任务：M-10
- 涉及页面：
  - `admin-console/src/pages/mobile/inbound-flight.jsx`
  - `admin-console/src/pages/mobile/inbound-breakdown.jsx`
  - `admin-console/src/pages/mobile/inbound-pallet.jsx`
  - `admin-console/src/pages/mobile/inbound-pallet-new.jsx`
  - `admin-console/src/pages/mobile/inbound-loading.jsx`
  - `admin-console/src/pages/mobile/inbound-loading-new.jsx`
  - `admin-console/src/pages/mobile/inbound-loading-plan.jsx`
  - `admin-console/src/pages/mobile/inbound-shared.jsx`
- 本轮目标：
  - 不推翻现有流程
  - 用统一任务卡和统一动作层重构现有链路表达
- 本轮必须补齐：
  - 节点任务清单
  - 每个任务的阻断提示
  - 证据要求
  - 异常入口
  - 完成前校验
- 完成定义：
  - 现有 `拆板 -> 点货 -> 打托 -> 装车` 演示能以任务流方式讲清楚

### 6.5 Iteration 5: 文件/任务/门槛联动与验收

#### T5-01 任务编排可视化

- 对应任务：E-01
- 建议新增页面或区块：
  - 平台规则页中的“标准场景”区块
  - 货站任务中心中的“编排链路”区块
- 本轮必须表达：
  - 标准场景 A
  - 文件触发
  - 状态触发
  - 角色分配
  - SLA 升级
- 完成定义：
  - 前端 demo 能讲清楚任务如何被生成和推进

#### T5-02 文件驱动放行视图

- 对应任务：E-02
- 重点落位：
  - `station/files.jsx`
  - `station/tasks.jsx`
  - `station/inbound-flight-detail.jsx`
  - `station/outbound-flights.jsx`
- 本轮必须表达：
  - 缺文件
  - 文件已齐
  - 版本不一致
  - 放行成功
  - 阻断任务
- 完成定义：
  - 用户能直观看到“缺什么文件，所以不能继续”

#### T5-03 硬门槛阻断交互

- 对应任务：E-03
- 重点落位：
  - 货站端任务视图
  - 文件视图
  - PDA 任务卡
- 本轮必须补齐：
  - 阻断说明
  - 责任对象
  - 建议动作
  - 恢复条件
- 完成定义：
  - demo 中每个关键门槛都有明确的前端表达

#### T5-04 第一批验收清单

- 对应任务：Q-01, Q-02, Q-03, Q-04, Q-05
- 建议新增文档：
  - `docs/sinoport-os-front-demo-iteration-1-qa-checklist.md`
- 本轮至少包含：
  - 冒烟清单
  - 状态机清单
  - 文件门槛清单
  - PDA 链路清单
  - `MME` 样板站 UAT 清单
- 完成定义：
  - 第一批交付时可以按清单逐条演示与验收

## 7. 建议分工方式

### 7.1 前端基础组

- T1-01
- T1-02
- T1-03
- T1-04
- T2-01

### 7.2 平台桌面组

- T2-02
- T2-03
- T2-04

### 7.3 货站桌面组

- T3-01
- T3-02
- T3-03
- T3-04
- T3-05
- T3-06

### 7.4 PDA 组

- T4-01
- T4-02
- T4-03

### 7.5 验收与整合组

- T5-01
- T5-02
- T5-03
- T5-04

## 8. 第一批不做的事情

以下内容即使想做，也必须推迟到下一阶段：

- 真实后端接口
- 真实数据库设计
- 真实文件上传到对象存储
- 真实任务编排引擎
- 真实消息通知
- 真实登录鉴权
- 真实审计入库
- 真实多角色 RBAC
- 真实接口联调

## 9. 第一批完成标准

第一批完成后，应该能稳定演示以下场景：

1. 平台从运行态势中心进入，查看规则、治理和链路状态。
2. 货站从看板进入进港/出港/提单/单证/任务页面，看到统一对象和统一状态。
3. 文件缺失时，页面明确表达阻断。
4. PDA 端围绕 `MME` 样板站进港链路，用统一任务卡完成拆板、点货、打托、装车演示。
5. 整个系统虽然没有后端，但已经能完整说明产品结构、任务流、状态机和现场交互。

## 10. 结论

这一批的关键不是“做多少页面”，而是把最小可演示主干做对。

只要第一批完成，后面的第二批和第三批就不再是从零搭原型，而是在统一的前端 demo 基线之上持续扩展。
