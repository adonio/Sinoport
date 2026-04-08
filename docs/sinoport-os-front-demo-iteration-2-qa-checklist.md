# Sinoport OS 第二批前端 Demo QA / UAT 清单

## 1. 适用范围

本清单只验证第二批前端 demo，不验证任何真实后端。

第二批验证范围：

- 平台子页面与报表
- 货站资源、通知、异常详情、报表
- `URC -> 出港 -> MME -> 交付` 主链路
- 第二批新增 PDA 节点

## 2. 静态校验

- [ ] `npx eslint "src/**/*.{js,jsx,ts,tsx}" --quiet`
- [ ] `npm run build`

## 3. 平台端页面验收

- [ ] `/platform/stations/capabilities`
- [ ] `/platform/stations/teams`
- [ ] `/platform/stations/zones`
- [ ] `/platform/stations/devices`
- [ ] `/platform/network/lanes`
- [ ] `/platform/network/scenarios`
- [ ] `/platform/audit/events`
- [ ] `/platform/audit/trust`
- [ ] `/platform/reports`
- [ ] `/platform/reports/stations`
- [ ] `/platform/master-data/sync`
- [ ] `/platform/master-data/jobs`

检查点：

- [ ] 所有页面都能打开
- [ ] 平台总览页能跳到对应子页面
- [ ] 报表、审计、同步页都使用第二批 demo contract

## 4. 货站端页面验收

- [ ] `/station/resources`
- [ ] `/station/resources/teams`
- [ ] `/station/resources/zones`
- [ ] `/station/resources/devices`
- [ ] `/station/resources/vehicles`
- [ ] `/station/exceptions/:exceptionId`
- [ ] `/station/documents/noa`
- [ ] `/station/documents/pod`
- [ ] `/station/reports`
- [ ] `/station/reports/shift`

检查点：

- [ ] 资源页能按 Team / Zone / Device / Vehicle 分开展示
- [ ] 异常详情页具备摘要、阻断任务、门槛规则、恢复动作、关联文件、关联跳转
- [ ] NOA / POD 页面能表达待发送、失败重试、补签、归档
- [ ] 报表页能表达货站层 KPI 和班次报表

## 5. PDA 第二批节点验收

### 5.1 节点入口

- [ ] `/mobile/select` 已从“进港/出港”切换为执行节点选择页
- [ ] `/mobile/login` 可选择 `Demo 角色`
- [ ] 节点入口包含：
  - [ ] 前置仓收货
  - [ ] 头程卡车
  - [ ] 出港货站
  - [ ] 出港机坪
  - [ ] 到港机坪
  - [ ] 进港货站
  - [ ] 尾程装车
  - [ ] 交付仓

### 5.2 节点路由

- [ ] `/mobile/pre-warehouse*`
- [ ] `/mobile/headhaul*`
- [ ] `/mobile/outbound*`
- [ ] `/mobile/export-ramp*`
- [ ] `/mobile/destination-ramp*`
- [ ] `/mobile/inbound*`
- [ ] `/mobile/tailhaul*`
- [ ] `/mobile/delivery*`

检查点：

- [ ] 每个节点至少有列表页和详情页
- [ ] 每个详情页都有统一任务卡
- [ ] 任务卡显示节点、角色、SLA、证据要求、阻断说明
- [ ] 动作层只复用统一动作集合
- [ ] 切换角色后，底部 tab 与可执行动作会变化
- [ ] 不同角色只看到自己的任务或只读视图

### 5.3 离线补传与站点隔离

- [ ] `TaskOpsPanel` 可显示 `online / offline / queued / synced / failed`
- [ ] 模拟离线后执行动作，会进入待补传队列
- [ ] 恢复在线后，队列状态会更新为 `synced` 或 `failed`
- [ ] 证据上传类动作至少有一条失败重试样例
- [ ] 不同站点下的本地队列 key 彼此隔离

## 6. 场景验收

### 6.1 主链路

- [ ] 前置仓收货 -> 头程卡车 -> 出港货站 -> 出港机坪 -> Flight -> MME 进港机坪 -> MME 进港货站 -> 尾程装车 -> 交付仓

### 6.2 关键门槛

- [ ] Manifest 未冻结不得飞走归档
- [ ] 缺 Collection Note / 车牌 / 核对员不得完成装车
- [ ] POD 双签前不得 Closed
- [ ] 理货完成前不得发送 NOA

### 6.3 通知与闭环

- [ ] `NOA` 页面可演示待发送、已发送、发送失败和人工补发
- [ ] `POD` 页面可演示待补签、已归档和阻断关闭

### 6.4 角色与补传演示

- [ ] `Receiver` 角色可见收货与扫码动作
- [ ] `Checker` 角色可见复核、组托或证据动作
- [ ] `Document Clerk` 角色只保留单证相关视角
- [ ] `Driver / Dispatch` 角色可见头程或尾程动作
- [ ] 离线执行一次动作后，恢复在线可看到补传结果

## 7. 多站点复制回归

固定验证站点：

- [ ] `URC`
- [ ] `MME`
- [ ] `MST`
- [ ] `RZE`

检查点：

- [ ] 菜单和页面在不同站点口径下仍可讲清楚
- [ ] 资源 / SLA / 门槛展示存在站点差异
- [ ] 报表和能力矩阵能区分强控制站、协同控制站、待接入站

## 8. 通过标准

满足以下条件即可判定第二批完成：

- 第二批所有新增页面可访问
- 第二批主演示链路可从平台 -> 货站 -> PDA 连续讲清楚
- 第二批 QA 清单和演示脚本存在
- 角色视角和离线补传可以被单独演示
