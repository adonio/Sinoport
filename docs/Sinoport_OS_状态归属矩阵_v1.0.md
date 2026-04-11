# Sinoport OS 状态归属矩阵 v1.0

## 1. 文档目的

本文件用于回答三个问题：

1. 每条状态到底挂在哪个对象上
2. 状态由谁更新
3. 状态变化会触发什么后续动作

## 2. 状态链总览

| 状态链 | 挂载对象 | 主要来源 | 主要消费方 |
| --- | --- | --- | --- |
| Flight Runtime Status | Flight | 航班接口 / 人工确认 | 平台态势、链路态势、PDA 运行页 |
| Ground Fulfillment Status | Shipment | 系统规则 / 人工操作 / 文件驱动 | 货站看板、提单链路、报表 |
| Task Status | Task | 系统派发 / PDA 执行 / 主管复核 | 作业指令中心、PDA、审计 |
| Document Status | Document | 上传 / 解析 / 校验 / 放行 | 单证与指令中心、硬门槛、任务生成 |
| Truck Dispatch Status | Truck | 司机 / 站内调度 / 签收 | 头尾程、二次转运、交付页 |

## 3. Flight Runtime Status

### 3.1 挂载对象

- 挂在 `Flight`

### 3.2 状态集合

| 状态 | 说明 | 典型来源 | 是否允许人工覆盖 |
| --- | --- | --- | --- |
| Scheduled | 已建航班，未进入起飞准备 | 手工创建 / 导入 | 是 |
| Pre-Departure | 起飞前准备 | 手工 / 接口 | 是 |
| Airborne | 已实际起飞 | 航班接口 / 手工确认 | 有条件 |
| Pre-Arrival | 预计落地前预备态 | 系统自动 | 否 |
| Landed | 已实际落地 | 航班接口 / 手工确认 | 有条件 |
| Delayed | 延误 | 航班接口 / 手工确认 | 是 |
| Diverted | 备降 | 航班接口 / 手工确认 | 是 |
| Cancelled | 取消 | 航班接口 / 手工确认 | 是 |

### 3.3 典型触发

| 触发条件 | 状态变化 | 后续动作 |
| --- | --- | --- |
| 创建航班 | `null -> Scheduled` | 生成前置准备任务 |
| 实际起飞 | `Pre-Departure -> Airborne` | 打开飞行段监控 |
| 预计落地前 60 分钟 | `Airborne -> Pre-Arrival` | 生成目的站准备任务 |
| 实际落地 | `Pre-Arrival / Airborne -> Landed` | 打开到港机坪 / 进港链路 |

## 4. Ground Fulfillment Status

### 4.1 挂载对象

- 主挂在 `Shipment`
- `AWB` 页面可镜像显示，但不作为主归属对象

### 4.2 状态集合

| 状态 | 说明 | 典型来源 | 是否允许人工覆盖 |
| --- | --- | --- | --- |
| Front Warehouse Receiving | 前置仓收货 | 仓库任务完成 | 有条件 |
| First-Mile In Transit | 头程在途 | Truck / CMR | 有条件 |
| Origin Terminal Handling | 出港货站操作 | 收货/理货/组板 | 有条件 |
| Origin Ramp Handling | 出港机坪操作 | 装机 / 机坪放行 | 有条件 |
| In Flight | 飞行中 | Flight Runtime 联动 | 否 |
| Destination Ramp Handling | 到港机坪操作 | 到港机坪任务 | 有条件 |
| Inbound Handling | 进港货站操作 | 拆板 / 理货 / NOA / 装车 | 有条件 |
| Tail-Linehaul In Transit | 尾程在途 | Truck / POD | 有条件 |
| Delivered | 交付完成 | 签收 / POD | 有条件 |
| Closed | 全链路闭环 | 全部异常关闭 | 否 |

### 4.3 关键规则

| 当前状态 | 进入条件 | 禁止推进条件 |
| --- | --- | --- |
| Inbound Handling | Flight `Landed` 且进港任务开启 | 机坪未放行 |
| Delivered | 已签收且 `POD` 完整 | `POD` 缺失 |
| Closed | 所有异常关闭 | 有未关闭异常 / 缺文件 |

## 5. Task Status

### 5.1 挂载对象

- 挂在 `Task`

### 5.2 状态集合

| 状态 | 说明 | 典型来源 |
| --- | --- | --- |
| Created | 系统生成未派发 | 规则引擎 |
| Assigned | 已派发 | 平台 / 主管 |
| Accepted | 已接单 | PDA 执行人 |
| Arrived at Location | 已到达位置 | PDA |
| Started | 已开始执行 | PDA |
| Evidence Uploaded | 已上传证据 | PDA |
| Completed | 执行完成 | PDA |
| Verified | 主管复核通过 | 后台 / PDA |
| Handed Over | 已交接下一角色 | 系统 / 人工 |
| Closed | 全部闭环 | 系统 |
| Rejected | 被驳回 | 主管 |
| Rework | 返工中 | 主管 |
| Exception Raised | 异常中断 | PDA / 后台 |

## 6. Document Status

### 6.1 挂载对象

- 挂在 `Document`

### 6.2 状态集合

| 状态 | 说明 | 典型来源 |
| --- | --- | --- |
| Draft | 草稿 / 未上传 | 系统 / 人工 |
| Uploaded | 已上传 | 人工 / 接口 |
| Parsed | 已解析 | 系统 |
| Validated | 已通过校验 | 系统 / 主管 |
| Missing | 缺失 | 系统 |
| Replaced | 已替换新版本 | 系统 / 人工 |
| Approved | 已审批通过 | 主管 |
| Released | 已作为放行依据生效 | 系统 |

### 6.3 关键规则

| 文件类型 | 关键状态 | 影响 |
| --- | --- | --- |
| FFM | Validated | 可建立出港预报 |
| UWS | Validated | 可确认已装载 |
| Manifest | Released | 可归档出港航班 |
| POD | Released | 可关闭交付 |
| CMR | Approved | 可推进头尾程任务 |

## 7. Truck Dispatch Status

### 7.1 挂载对象

- 挂在 `Truck`

### 7.2 状态集合

| 状态 | 说明 |
| --- | --- |
| Planned | 已计划 |
| Assigned | 已分配司机与车辆 |
| Arrived | 已到场 |
| Loading | 装车中 |
| Departed | 已发车 |
| Arrived at Destination | 已到目的地 |
| Signed | 已签收 |
| Closed | 闭环完成 |

## 8. 状态写入来源矩阵

| 对象 | 状态字段 | 主要写入方 |
| --- | --- | --- |
| Flight | runtime_status | 航班接口、平台、站点主管 |
| Shipment | fulfillment_status | 系统规则、货站后台 |
| Task | task_status | 平台后台、货站后台、PDA |
| Document | document_status | 单证与指令中心、解析器、校验器、主管 |
| Truck | dispatch_status | 调度、PDA、签收端 |

## 9. 测试断言建议

1. 同一个状态只能挂在一个主对象上
2. 文件缺失时状态不能错误推进
3. 任务未验证不能交接
4. 交付未有 `POD` 不能关闭
5. Manifest 未释放不能归档航班
