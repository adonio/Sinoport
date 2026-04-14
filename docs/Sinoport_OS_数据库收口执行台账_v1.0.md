# Sinoport OS 数据库收口执行台账 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：执行中
- 更新时间：`2026-04-14`
- 适用阶段：数据库收口主计划执行期
- 唯一总纲：
  - [Sinoport_OS_数据库收口与12个月开发规划_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_数据库收口与12个月开发规划_v1.0.md)

## 2. 执行原则

本台账用于把“数据库收口与 12 个月开发规划”转换成可执行的主 agent / 子 agent 任务队列。

固定规则：

1. 同一时间只允许 `1` 个子 agent 处于实施态
2. 主 agent 验收通过前，不得派发下一个任务
3. 任务默认按页面级推进
4. 子 agent 只能改自己任务卡范围内的文件
5. 页面完成后，不得再直接把 `admin-console/src/data/sinoport.js` 或 `admin-console/src/data/sinoport-adapters.js` 作为主数据源

## 3. 主 agent 与子 agent 职责

### 主 agent

- 维护共享执行分支
- 维护任务队列和任务状态
- 派发子任务
- 审查子 agent 回报
- 执行验收测试
- 决定通过、退回或阻塞

### 子 agent

- 只实现当前任务卡范围
- 输出改动摘要、文件清单、接口变化、测试结果、剩余风险
- 不做最终验收
- 不顺手推进下一个任务

## 4. 任务卡模板

每个任务必须至少包含以下字段：

- `任务 ID`
- `Wave`
- `目标页面 / 模块`
- `目标 API`
- `数据库读源`
- `禁止继续依赖的本地模块`
- `允许保留的兼容内容`
- `验收标准`
- `必跑测试`
- `当前状态`

### 状态枚举

- `Pending`
- `In Progress`
- `Review`
- `Accepted`
- `Blocked`

## 5. 验收标准

每个页面级任务统一按以下标准验收：

1. 页面主数据不再直接 import 本地 Demo 数据
2. 页面所需读模型全部来自真实 API / DB
3. 仅允许保留字典、极小 UI fallback、迁移期兼容壳
4. `typecheck` 和前端构建通过
5. 受影响 API 与页面 smoke 通过
6. 如新增接口、表或运行约束，文档同步完成

## 6. 执行队列

### Wave 0：执行底座

| 任务 ID | 目标 | 状态 | 说明 |
| --- | --- | --- | --- |
| W0-01 | 建立执行台账 | Accepted | 本文档即执行台账 |
| W0-02 | 建立任务卡模板 | Accepted | 已固定在本文第 4 节 |
| W0-03 | 固定验收规则 | Accepted | 已固定在本文第 5 节 |

### Wave 1：平台侧读模型收口

| 任务 ID | 目标页面 / 模块 | 目标 API | 数据库读源 | 状态 |
| --- | --- | --- | --- | --- |
| W1-01 | `platform/operations` | `/api/v1/platform/operations/overview` | `demo_datasets` 过渡映射 | Accepted |
| W1-02 | `platform/stations` | `/api/v1/platform/stations` | `demo_datasets` 过渡映射 | Accepted |
| W1-03 | `platform/station-detail` | `/api/v1/platform/stations/:code` | `demo_datasets` 过渡映射 | Accepted |
| W1-04 | `platform/stations-capabilities` | `/api/v1/platform/stations/capabilities` | `demo_datasets` 过渡映射 | Accepted |
| W1-05 | `platform/stations-teams` | `/api/v1/platform/stations/teams` | `demo_datasets` 过渡映射 | Accepted |
| W1-06 | `platform/stations-zones` | `/api/v1/platform/stations/zones` | `demo_datasets` 过渡映射 | Accepted |
| W1-07 | `platform/stations-devices` | `/api/v1/platform/stations/devices` | `demo_datasets` 过渡映射 | Accepted |
| W1-08 | `platform/network` | `/api/v1/platform/network` | `demo_datasets` 过渡映射 | Accepted |
| W1-09 | `platform/network-lanes` | `/api/v1/platform/network/lanes` | `demo_datasets` 过渡映射 | Accepted |
| W1-10 | `platform/network-scenarios` | `/api/v1/platform/network/scenarios` | `demo_datasets` 过渡映射 | Accepted |
| W1-11 | `platform/rules` | `/api/v1/platform/rules` | `demo_datasets` 过渡映射 | Accepted |
| W1-12 | `platform/master-data` | `/api/v1/platform/master-data` | `demo_datasets` 过渡映射 | Accepted |
| W1-13 | `platform/master-data-sync` | `/api/v1/platform/master-data/sync` | `demo_datasets` 过渡映射 | Accepted |
| W1-14 | `platform/master-data-jobs` | `/api/v1/platform/master-data/jobs` | `demo_datasets` 过渡映射 | Accepted |
| W1-15 | `platform/master-data-relationships` | `/api/v1/platform/master-data/relationships` | `demo_datasets` 过渡映射 | Accepted |
| W1-16 | `platform/reports` | `/api/v1/platform/reports` | `demo_datasets` 过渡映射 | Accepted |
| W1-17 | `platform/report-stations` | `/api/v1/platform/reports/stations` | `demo_datasets` 过渡映射 | Accepted |
| W1-18 | `admin-console/src/api/platform.js` | 平台 API 聚合层 | `/api/v1/platform/*` | Accepted |

### Wave 2：货站总览与资源页收口

| 任务 ID | 目标页面 / 模块 | 状态 |
| --- | --- | --- |
| W2-01 | `station/dashboard` | Accepted |
| W2-02 | `station/inbound` | Accepted |
| W2-03 | `station/inbound-flight-create` | Accepted |
| W2-04 | `station/inbound-mobile` | Accepted |
| W2-05 | `station/outbound` | Accepted |
| W2-06 | `station/outbound-flights` | Accepted |
| W2-07 | `station/outbound-waybills` | Accepted |
| W2-08 | `station/resources` | Accepted |
| W2-09 | `station/resources-teams` | Accepted |
| W2-10 | `station/resources-zones` | Accepted |
| W2-11 | `station/resources-devices` | Accepted |
| W2-12 | `station/resources-vehicles` | Accepted |
| W2-13 | `station/reports` | Accepted |
| W2-14 | `station/reports-shift` | Accepted |

### Wave 3：货站动作页读模型收口

| 任务 ID | 目标页面 / 模块 | 状态 |
| --- | --- | --- |
| W3-01 | `station/documents` | Accepted |
| W3-02 | `station/documents-noa` | Accepted |
| W3-03 | `station/documents-pod` | Accepted |
| W3-04 | `station/tasks` | Accepted |
| W3-05 | `station/shipments` | Accepted |
| W3-06 | `station/shipment-detail` | Accepted |
| W3-07 | `station/exceptions` | Accepted |
| W3-08 | `station/exception-detail` | Accepted |
| W3-09 | `admin-console/src/api/station.js` | Accepted |

### Wave 4：移动端读模型收口

| 任务 ID | 目标页面 / 模块 | 状态 |
| --- | --- | --- |
| W4-01 | `mobile/login` | Accepted |
| W4-02 | `mobile/select` | Accepted |
| W4-03 | `mobile/inbound` | Accepted |
| W4-04 | `mobile/inbound-shared` | Accepted |
| W4-05 | `mobile/outbound` | Accepted |
| W4-06 | `mobile/outbound-shared` | Accepted |
| W4-07 | `mobile/node-shared` | Accepted |
| W4-08 | `mobile/pre-warehouse-detail` | Accepted |
| W4-09 | `mobile/headhaul-detail` | Accepted |
| W4-10 | `mobile/export-ramp-detail` | Accepted |
| W4-11 | `mobile/runtime-detail` | Accepted |
| W4-12 | `mobile/destination-ramp-detail` | Accepted |
| W4-13 | `mobile/tailhaul-detail` | Accepted |
| W4-14 | `mobile/delivery-detail` | Accepted |

### Wave 5：Demo 过渡层收缩

| 任务 ID | 目标 | 状态 |
| --- | --- | --- |
| W5-01 | 把 `demo_datasets` 收缩为纯后端过渡层 | Accepted |
| W5-02 | 建立稳定结构的正式读表 / 只读视图 | Accepted |
| W5-03 | 清理无效 adapter 与遗留 import | Accepted |

### Wave 6：真实业务数据接入与试运行

| 任务 ID | 目标 | 状态 |
| --- | --- | --- |
| W6-01 | 建立正式数据导入链 | Accepted |
| W6-02 | 真实数据审计落库 | Accepted |
| W6-03 | 选 1 个真实站点试运行 | Accepted |

### Wave 7：出港深化、报表、多站点

| 任务 ID | 目标 | 状态 |
| --- | --- | --- |
| W7-01 | 出港动作链深化 | Accepted |
| W7-02 | 平台日报 / 站点日报 / 异常日报 | Accepted |
| W7-03 | 多站点模板与主数据治理 | Accepted |

### Wave 8：Agent 产品化与年度收口

| 任务 ID | 目标 | 状态 |
| --- | --- | --- |
| W8-01 | `Station Copilot` 产品化 | Pending |
| W8-02 | `Document Agent` 产品化 | Pending |
| W8-03 | 年度复盘与下一年度规划 | Pending |

## 7. 当前子任务指派

### 当前进行中的子任务

- 子任务：`Wave 7 已完成`
- 目标页面：`outbound + reporting + governance`
- 目标 API：`Wave 7 能力族已完成`
- 必须移除的本地主数据依赖：
  - `Wave 7 已完成，不再保留该阶段阻塞`
- 必跑测试：
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
- 通过标准：
  - 页面主数据改为 API / DB 驱动
  - 不再从本地数据模块直接读取业务真相

## 8. 回归节奏

### 页面级任务完成后

- 跑当前任务的定向接口测试
- 跑当前页面的 smoke
- 跑 `typecheck`
- 跑前端构建

### 每完成一个 Wave

- `npm run test:integration:api`
- `npm run test:frontend:smoke`
- 如涉及 Agent：`npm run test:agent:smoke`

## 9. 当前结论

当前正式进入执行态的是：

1. Wave 0 已完成
2. Wave 1 已完成并通过验收
3. `W2-01 station/dashboard` 已完成并通过验收
4. `W2-02 station/inbound` 已完成并通过验收
5. `W2-03 station/inbound-flight-create` 已完成并通过验收
6. `W2-04 station/inbound-mobile` 已完成并通过验收
7. `W2-05 station/outbound` 已完成并通过验收
8. `W2-06 station/outbound-flights` 已完成并通过验收
9. `W2-07 station/outbound-waybills` 已完成并通过验收
10. `W2-08 station/resources` 已完成并通过验收
11. `W2-09 station/resources-teams` 已完成并通过验收
12. `W2-10 station/resources-zones` 已完成并通过验收
13. `W2-11 station/resources-devices` 已完成并通过验收
14. `W2-12 station/resources-vehicles` 已完成并通过验收
15. `W2-13 station/reports` 已完成并通过验收
16. `W2-14 station/reports-shift` 已完成并通过验收
17. Wave 2 已整体完成，下一步进入 Wave 3

后续必须严格按本台账顺序推进，不得跳过当前任务直接开始后续页面。
