# Sinoport OS 前端 Demo 覆盖矩阵

## 1. 说明

本矩阵用于回答三个问题：

1. PRD 的主要章节已经被哪些前端 demo 页面覆盖
2. 第一批、第二批、第三批任务分别落到了哪里
3. 当前还剩下的工作是否属于“下一阶段真实后端实现”，而不是前端 demo 缺失

约束：

- 当前阶段只统计前端 demo 覆盖情况
- 不把后端、持久化、真实接口、真实权限算作“缺失页面”

## 2. 平台管理后台覆盖

| PRD 模块 | 页面 / 文档载体 | 当前状态 |
| --- | --- | --- |
| 8.1 运行态势中心 | [operations.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/operations.jsx) | 已覆盖 |
| 8.2 货站与资源管理 | [stations.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/stations.jsx)、[stations-capabilities.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/stations-capabilities.jsx)、[stations-teams.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/stations-teams.jsx)、[stations-zones.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/stations-zones.jsx)、[stations-devices.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/stations-devices.jsx) | 已覆盖 |
| 8.3 航线网络与链路配置 | [network.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/network.jsx)、[network-lanes.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/network-lanes.jsx)、[network-scenarios.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/network-scenarios.jsx) | 已覆盖 |
| 8.4 规则与指令引擎 | [rules.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/rules.jsx) | 已覆盖 |
| 8.5 主数据与接口治理 | [master-data.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/master-data.jsx)、[master-data-sync.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/master-data-sync.jsx)、[master-data-jobs.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/master-data-jobs.jsx)、[master-data-relationships.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/master-data-relationships.jsx) | 已覆盖 |
| 8.6 审计与可信留痕 | [audit.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/audit.jsx)、[audit-events.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/audit-events.jsx)、[audit-trust.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/audit-trust.jsx) | 已覆盖 |
| 15.1 平台层 KPI | [reports.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/reports.jsx)、[report-stations.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/report-stations.jsx) | 已覆盖 |
| 14.1 / 14.3 接口入口与主数据统一原则 | [master-data.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/master-data.jsx)、[master-data-sync.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/master-data-sync.jsx)、[master-data-jobs.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/master-data-jobs.jsx) | 已覆盖 |
| 15.4 平台日报 | [reports.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/reports.jsx) | 已覆盖 |
| 15.5 非功能与 demo 权限矩阵 | [master-data.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/master-data.jsx) | 已覆盖 |

## 3. 货站后台覆盖

| PRD 模块 | 页面 / 文档载体 | 当前状态 |
| --- | --- | --- |
| 9.1 货站看板 | [dashboard.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/dashboard.jsx) | 已覆盖 |
| 9.2 进港管理 | [inbound.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/inbound.jsx)、[inbound-flights.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/inbound-flights.jsx)、[inbound-flight-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/inbound-flight-detail.jsx)、[inbound-waybills.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/inbound-waybills.jsx) | 已覆盖 |
| 9.3 出港管理 | [outbound.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/outbound.jsx)、[outbound-flights.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/outbound-flights.jsx)、[outbound-waybills.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/outbound-waybills.jsx) | 已覆盖 |
| 9.4 提单与履约链路 | [shipments.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/shipments.jsx)、[shipment-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/shipment-detail.jsx) | 已覆盖 |
| 9.5 单证与指令中心 | [documents.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/documents.jsx)、[documents-noa.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/documents-noa.jsx)、[documents-pod.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/documents-pod.jsx) | 已覆盖 |
| 9.6 作业指令中心 | [tasks.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/tasks.jsx) | 已覆盖 |
| 9.7 班组 / 区位 / 设备管理 | [resources.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/resources.jsx)、[resources-teams.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/resources-teams.jsx)、[resources-zones.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/resources-zones.jsx)、[resources-devices.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/resources-devices.jsx)、[resources-vehicles.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/resources-vehicles.jsx) | 已覆盖 |
| 9.8 异常中心 | [exceptions.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/exceptions.jsx)、[exception-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/exception-detail.jsx) | 已覆盖 |
| 15.2 货站层 KPI | [reports.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/reports.jsx)、[reports-shift.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/reports-shift.jsx) | 已覆盖 |
| 15.3 PDA KPI / 15.4 文件报表 | [reports.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/reports.jsx) | 已覆盖 |

## 4. PDA 终端覆盖

| PRD 模块 | 页面 / 文档载体 | 当前状态 |
| --- | --- | --- |
| 10.1 / 10.2 / 10.3 PDA 定位、统一任务卡、通用动作 | [TaskCard.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/components/sinoport/mobile/TaskCard.jsx)、[TaskActionBar.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/components/sinoport/mobile/TaskActionBar.jsx)、[TaskEvidenceSection.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/components/sinoport/mobile/TaskEvidenceSection.jsx)、[TaskBlockerNotice.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/components/sinoport/mobile/TaskBlockerNotice.jsx)、[TaskOpsPanel.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/components/sinoport/mobile/TaskOpsPanel.jsx) | 已覆盖 |
| 10.4.1 前置仓收货 | [pre-warehouse.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/pre-warehouse.jsx)、[pre-warehouse-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/pre-warehouse-detail.jsx) | 已覆盖 |
| 10.4.2 头程卡车运输 | [headhaul.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/headhaul.jsx)、[headhaul-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/headhaul-detail.jsx) | 已覆盖 |
| 10.4.3 出港机场货站操作 | [outbound.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/outbound.jsx)、[outbound-flight.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/outbound-flight.jsx)、[outbound-shared.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/outbound-shared.jsx) | 已覆盖 |
| 10.4.4 出港机场机坪操作 | [export-ramp.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/export-ramp.jsx)、[export-ramp-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/export-ramp-detail.jsx) | 已覆盖 |
| 10.4.5 航班运行 | [runtime.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/runtime.jsx)、[runtime-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/runtime-detail.jsx) | 已覆盖 |
| 10.4.6 进港机场机坪操作 | [destination-ramp.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/destination-ramp.jsx)、[destination-ramp-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/destination-ramp-detail.jsx) | 已覆盖 |
| 10.4.7 进港机场货站操作 | [inbound.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/inbound.jsx)、[inbound-flight.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/inbound-flight.jsx)、[inbound-breakdown.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/inbound-breakdown.jsx)、[inbound-pallet*.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/inbound-pallet.jsx)、[inbound-loading*.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/inbound-loading.jsx)、[inbound-shared.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/inbound-shared.jsx) | 已覆盖 |
| 10.4.8 尾程卡车装车与运输 | [tailhaul.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/tailhaul.jsx)、[tailhaul-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/tailhaul-detail.jsx) | 已覆盖 |
| 10.4.9 交付仓 | [delivery.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/delivery.jsx)、[delivery-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/mobile/delivery-detail.jsx) | 已覆盖 |
| M-13 PDA 异常与挂起机制 | [TaskOpsPanel.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/components/sinoport/mobile/TaskOpsPanel.jsx) | 已覆盖 |
| M-14 PDA 多语言与站点隔离 | [i18n.js](/Users/lijun/Downloads/Sinoport/admin-console/src/utils/mobile/i18n.js)、[session.js](/Users/lijun/Downloads/Sinoport/admin-console/src/utils/mobile/session.js) | 已覆盖 |
| 15.5 PDA 断网缓存与恢复同步 | [TaskOpsPanel.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/components/sinoport/mobile/TaskOpsPanel.jsx)、[task-ops.js](/Users/lijun/Downloads/Sinoport/admin-console/src/utils/mobile/task-ops.js) | 已覆盖 |

## 5. 审计 / 对象关系 / 可信预留

| 任务 | 页面 / 文档载体 | 当前状态 |
| --- | --- | --- |
| E-04 对象关系总览 | [master-data-relationships.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/master-data-relationships.jsx)、[shipment-detail.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/station/shipment-detail.jsx) | 已覆盖 |
| E-06 可信留痕预留区 | [audit-trust.jsx](/Users/lijun/Downloads/Sinoport/admin-console/src/pages/platform/audit-trust.jsx) | 已覆盖 |

## 6. 验收与交付文档覆盖

| 产物 | 文件 | 当前状态 |
| --- | --- | --- |
| 第一批执行清单 | [sinoport-os-front-demo-iteration-1.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-front-demo-iteration-1.md) | 已覆盖 |
| 第一批执行排期 | [sinoport-os-front-demo-iteration-1-execution-plan.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-front-demo-iteration-1-execution-plan.md) | 已覆盖 |
| 第一批 QA 清单 | [sinoport-os-front-demo-iteration-1-qa-checklist.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-front-demo-iteration-1-qa-checklist.md) | 已覆盖 |
| 第一批演示脚本 | [sinoport-os-front-demo-iteration-1-demo-script.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-front-demo-iteration-1-demo-script.md) | 已覆盖 |
| 第二批 QA 清单 | [sinoport-os-front-demo-iteration-2-qa-checklist.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-front-demo-iteration-2-qa-checklist.md) | 已覆盖 |
| 第二批演示脚本 | [sinoport-os-front-demo-iteration-2-demo-script.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-front-demo-iteration-2-demo-script.md) | 已覆盖 |
| 发布前检查清单 | [sinoport-os-front-demo-release-checklist.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-front-demo-release-checklist.md) | 已覆盖 |
| 冒烟验证报告 | [sinoport-os-front-demo-smoke-report.md](/Users/lijun/Downloads/Sinoport/docs/sinoport-os-front-demo-smoke-report.md) | 已覆盖 |

## 7. 当前仍不属于缺口的内容

以下内容当前仍然不算“前端 demo 缺失”，而是下一阶段真实系统建设范畴：

- 后端 API
- 数据库与持久化
- 真正的文件上传与对象存储
- 真实 RBAC
- 真实通知通道
- 真实任务编排引擎
- 真实审计入库或可信写入
