# Sinoport OS 第二批前端 Demo 演示脚本

## 1. 演示目标

第二批要说明三件事：

1. 第一批样板系统已经扩成一条完整的跨站 demo 链路
2. 平台、货站、PDA 三端开始围绕同一条 `URC -> 出港 -> MME -> 交付` 主链路协同表达
3. 仍然没有做后端，但第二批的页面结构和 contract 已足够承接下一阶段联调

## 2. 演示顺序

### Step 1: 平台端

入口：

- `/platform/stations/capabilities`
- `/platform/network/scenarios`
- `/platform/master-data/sync`
- `/platform/audit/events`
- `/platform/reports`

要点：

- 先说明站点能力矩阵
- 再说明第二批主演示链路
- 再说明同步 contract 和导入日志
- 最后说明平台 KPI 和站点对比

### Step 2: 货站端

入口：

- `/station/resources`
- `/station/documents/noa`
- `/station/documents/pod`
- `/station/exceptions`
- `/station/reports`

要点：

- 说明 Team / Zone / Device / Vehicle 的资源映射
- 说明 NOA / POD 通知动作视图
- 说明异常详情如何连接阻断任务和恢复动作
- 说明货站层 KPI 和班次报表

### Step 3: PDA 主链路

入口：

- `/mobile/select`

推荐演示链路：

1. 前置仓收货
2. 头程卡车
3. 出港货站
4. 出港机坪
5. 到港机坪
6. 进港货站
7. 尾程装车
8. 交付仓

要点：

- 所有第二批节点都使用统一任务卡
- 所有节点都能看见证据要求和阻断说明
- 动作层统一，不会每个节点发明不同的按钮模型

## 3. 收尾话术

第二批结束时，只讲这三句：

1. 第二批已经把第一批样板系统扩成了一条可完整演示的跨站履约链路。
2. 当前依旧只做前端 demo，但平台、货站、PDA 三端的结构和 contract 已经对齐。
3. 下一阶段如果开始接真实后端，将直接以第二批这套页面与 contract 为基线。
