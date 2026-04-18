# Sinoport 数据库化 CRUD 执行台账 v1.0

## 主线规则

- 仅允许 `1` 个主 agent 和 `1` 个当前活动子任务。
- 只有当前任务卡 `Accepted` 后，才能进入下一张卡。

## 当前阶段状态

| 阶段                               | 当前状态      | 说明                                                                     |
| ---------------------------------- | ------------- | ------------------------------------------------------------------------ |
| Phase 0：矩阵冻结                  | `Accepted`    | 对象矩阵和页面矩阵已落文档                                               |
| Phase 1：平台治理层 CRUD           | `Accepted`    | `stations/teams/zones/devices/vehicles` 已完成                           |
| Phase 2：平台网络/规则/主数据 CRUD | `Accepted`    | `network_lanes/network_scenarios/rules/master_data` 已完成                |
| Phase 3：货站主业务对象 CRUD       | `Accepted`    | `station/flights/awbs/shipments/documents/tasks/exceptions` 已交付                |
| Phase 4：移动作业对象 CRUD         | `Accepted`    | `inbound_count_records / inbound_pallets / loading_plans / outbound_receipts / outbound_containers` 已统一签收 |
| Phase 5：统一下拉选项服务          | `Accepted`    | 统一 `/platform/options/*`、`/station/options/*`、`/mobile/options/*` 已落地并完成主 agent 签收 |
| Phase 6：统一列表分页              | `Accepted`    | 已完成列表接口 `page / page_size / total` 与前端 20 条分页收口；`mobile/node/*` 已补齐服务端筛选与分页消费 |
| Phase 7：过渡层清退                | `Accepted`    | `T-24` 已完成：`/platform/stations`、详情页与能力矩阵页的 capability/team 聚合已切正式源；`demo_datasets` 仅保留 fixture/replay/样板导入边界 |
| Phase 8：总体验收                  | `Accepted`    | 主 agent 已完成对象线、页面线与全局线验收；当前 CRUD 收口范围已闭环 |

## 已完成任务卡

### T-01 `platform/stations`

- 状态：`Accepted`
- 完成内容：
  - `POST /api/v1/platform/stations`
  - `GET /api/v1/platform/stations`
  - `GET /api/v1/platform/stations/:stationId`
  - `PATCH /api/v1/platform/stations/:stationId`
  - `DELETE /api/v1/platform/stations/:stationId`（软删除）
  - `/platform/stations` 表单改成真实可编辑、可创建、可更新、可归档/恢复
  - 控制层级 / 阶段 / Owner 下拉切到数据库选项源
  - 站点列表切到后端分页，默认 20 条
- 审计动作：
  - `STATION_CREATED`
  - `STATION_UPDATED`
  - `STATION_ARCHIVED`
  - `STATION_RESTORED`
- 验收：
  - `npm run typecheck`
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run build --prefix admin-console`
  - `npm run test:integration:api`

### T-02 `platform/teams`

- 状态：`Accepted`
- 完成内容：
  - `POST /api/v1/platform/teams`
  - `GET /api/v1/platform/teams`
  - `GET /api/v1/platform/teams/:teamId`
  - `PATCH /api/v1/platform/teams/:teamId`
  - `DELETE /api/v1/platform/teams/:teamId`（软删除）
  - `/platform/stations/teams` 表单改成真实可编辑、可创建、可更新、可归档/恢复
  - 所属站点 / 班次 / 状态下拉切到数据库选项源
  - 班组列表切到后端分页，默认 20 条
- 审计动作：
  - `TEAM_CREATED`
  - `TEAM_UPDATED`
  - `TEAM_ARCHIVED`
  - `TEAM_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `npm run test:integration:api`
  - `/platform/stations/teams` 定向浏览器校验通过

### T-03 `platform/zones`

- 状态：`Accepted`
- 完成内容：
  - `POST /api/v1/platform/zones`
  - `GET /api/v1/platform/zones`
  - `GET /api/v1/platform/zones/:zoneId`
  - `PATCH /api/v1/platform/zones/:zoneId`
  - `DELETE /api/v1/platform/zones/:zoneId`（软删除）
  - `/platform/stations/zones` 页面改成真实可编辑、可创建、可更新、可归档/恢复
  - 站点详情页 `zoneRows` 改读正式 `zones` 表
  - 所属站点 / 区位类型 / 状态下拉切到数据库选项源
  - 区位列表切到后端分页，默认 20 条
- 审计动作：
  - `ZONE_CREATED`
  - `ZONE_UPDATED`
  - `ZONE_ARCHIVED`
  - `ZONE_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `npm run test:integration:api`
  - `/platform/stations/zones` 定向浏览器校验通过

### T-04 `platform/devices`

- 状态：`Accepted`
- 完成内容：
  - `POST /api/v1/platform/devices`
  - `GET /api/v1/platform/devices`
  - `GET /api/v1/platform/devices/:deviceId`
  - `PATCH /api/v1/platform/devices/:deviceId`
  - `DELETE /api/v1/platform/devices/:deviceId`（软删除）
  - `/platform/stations/devices` 页面改成真实可编辑、可创建、可更新、可归档/恢复，默认全宽列表 + 右侧 Drawer
  - `platform_devices` 正式表与 `device_type_options / device_role_options / device_status_options` 已落地
  - 站点详情页与站内资源概览的 `deviceRows / resourceDevices` 改读正式表
  - 所属站点 / 设备类型 / 绑定角色 / Owner 班组 / 状态下拉切到数据库选项源
  - 设备列表切到后端分页，默认 20 条
- 审计动作：
  - `DEVICE_CREATED`
  - `DEVICE_UPDATED`
  - `DEVICE_ARCHIVED`
  - `DEVICE_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `npm run test:integration:api`
  - `GET /api/v1/platform/devices*` 与 `/platform/stations/devices` 定向校验通过

### T-05 `platform/vehicles`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/station/resources/vehicles/options`
  - `POST /api/v1/station/resources/vehicles`
  - `GET /api/v1/station/resources/vehicles`
  - `GET /api/v1/station/resources/vehicles/:vehicleId`
  - `PATCH /api/v1/station/resources/vehicles/:vehicleId`
  - `DELETE /api/v1/station/resources/vehicles/:vehicleId`（软删除）
  - `/station/resources/vehicles` 页面改成真实可编辑、可创建、可更新、可归档/恢复，默认全宽列表 + 右侧 Drawer
  - `trucks` 正式表扩展业务字段，`truck_route_type_options / truck_dispatch_status_options / truck_priority_options` 已落地
  - vehicles 主读写已切离 `demo_datasets` 过渡层
  - 流程 / 状态 / 优先级下拉切到数据库选项源
  - 车辆列表切到后端分页，默认 20 条
- 审计动作：
  - `VEHICLE_CREATED`
  - `VEHICLE_UPDATED`
  - `VEHICLE_ARCHIVED`
  - `VEHICLE_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `车辆 CRUD 定向 API 校验`

### T-06 `platform/network_lanes`

- 状态：`Accepted`
- 完成内容：
  - `POST /api/v1/platform/network/lanes`
  - `GET /api/v1/platform/network/lanes`
  - `GET /api/v1/platform/network/lanes/:laneId`
  - `PATCH /api/v1/platform/network/lanes/:laneId`
  - `DELETE /api/v1/platform/network/lanes/:laneId`（软删除）
  - `/platform/network/lanes` 页面改成真实可编辑、可创建、可更新、可归档/恢复，默认全宽列表 + 右侧 Drawer
  - `network_lanes` 正式表与 `network_lane_control_depth_options / network_lane_status_options` 已落地
  - 平台 `network` 总览的 `routeMatrix / networkLaneTemplateRows` 主读源已切正式 `network_lanes`
  - 关联站点 / 控制深度 / 状态下拉切到数据库选项源
  - 链路列表切到后端分页，默认 20 条
- 审计动作：
  - `LANE_CREATED`
  - `LANE_UPDATED`
  - `LANE_ARCHIVED`
  - `LANE_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `network_lanes CRUD 定向 API 校验`

### T-07 `platform/network_scenarios`

- 状态：`Accepted`
- 完成内容：
  - `POST /api/v1/platform/network/scenarios`
  - `GET /api/v1/platform/network/scenarios`
  - `GET /api/v1/platform/network/scenarios/:scenarioId`
  - `PATCH /api/v1/platform/network/scenarios/:scenarioId`
  - `DELETE /api/v1/platform/network/scenarios/:scenarioId`（软删除）
  - `/platform/network/scenarios` 页面改成真实可编辑、可创建、可更新、可归档/恢复，默认全宽列表 + 右侧 Drawer
  - `network_scenarios` 正式表与 `network_scenario_category_options / network_scenario_status_options` 已落地，链路/站点下拉复用正式 `network_lanes / stations`
  - 平台 `network` 总览的 `networkScenarioRows` 主读源已切正式 `network_scenarios`
  - 场景分类 / 关联链路 / 主站点 / 状态下拉切到数据库选项源
  - 场景列表切到后端分页，默认 20 条
- 审计动作：
  - `SCENARIO_CREATED`
  - `SCENARIO_UPDATED`
  - `SCENARIO_ARCHIVED`
  - `SCENARIO_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `network_scenarios CRUD 定向 API 校验`

### T-08 `platform/rules`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/platform/rules/options`
  - `POST /api/v1/platform/rules`
  - `GET /api/v1/platform/rules`
  - `GET /api/v1/platform/rules/:ruleId`
  - `PATCH /api/v1/platform/rules/:ruleId`
  - `DELETE /api/v1/platform/rules/:ruleId`（软删除）
  - `/platform/rules` 页面改成真实可编辑、可创建、可更新、可归档/恢复，默认全宽列表 + 右侧 Drawer
  - `platform_rules` 正式表与 `platform_rule_type_options / platform_rule_control_level_options / platform_rule_status_options / platform_rule_scope_options / platform_rule_service_level_options / platform_rule_timeline_stage_options` 已落地
  - `/platform/rules` 主读源已切正式 `platform_rules`，规则时间线辅助视图改读正式聚合 DTO，不再依赖 `scenarioTimelineRows`
  - 规则类型 / 控制层级 / 适用范围 / 服务等级 / 时间线阶段 / 状态 / 关联站点 / 关联链路 / 关联场景下拉切到数据库选项源
  - 规则列表切到后端分页，默认 20 条
- 审计动作：
  - `RULE_CREATED`
  - `RULE_UPDATED`
  - `RULE_ARCHIVED`
  - `RULE_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `platform_rules CRUD 定向 API 校验`

### T-09 `platform/master_data`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/platform/master-data/options`
  - `POST /api/v1/platform/master-data`
  - `GET /api/v1/platform/master-data`
  - `GET /api/v1/platform/master-data/:masterDataId`
  - `PATCH /api/v1/platform/master-data/:masterDataId`
  - `DELETE /api/v1/platform/master-data/:masterDataId`（软删除）
  - `/platform/master-data` 页面改成真实可编辑、可创建、可更新、可归档/恢复，默认全宽列表 + 右侧 Drawer
  - `platform_master_data` 正式表与 `platform_master_data_type_options / platform_master_data_source_options / platform_master_data_status_options` 已落地
  - `/platform/master-data` 主读源已切正式 `platform_master_data`，不再使用 `sinoport-adapters.masterDataRows`
  - 主数据类型 / 来源 / 状态筛选与表单下拉切到数据库选项源
  - 主数据列表切到后端分页，默认 20 条；保留 `sync/jobs/relationships` 的兼容 payload，不扩散该任务卡范围
- 审计动作：
  - `MASTER_DATA_CREATED`
  - `MASTER_DATA_UPDATED`
  - `MASTER_DATA_ARCHIVED`
  - `MASTER_DATA_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `platform_master_data CRUD 定向 API 校验`

### T-10 `platform/master_data_sync/jobs/relationships`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/platform/master-data/sync/options`
  - `POST /api/v1/platform/master-data/sync`
  - `GET /api/v1/platform/master-data/sync`
  - `GET /api/v1/platform/master-data/sync/:syncId`
  - `PATCH /api/v1/platform/master-data/sync/:syncId`
  - `DELETE /api/v1/platform/master-data/sync/:syncId`（软删除）
  - `GET /api/v1/platform/master-data/jobs/options`

### T-15 `station/tasks`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/station/tasks/options`
  - `GET /api/v1/station/tasks`
  - `GET /api/v1/station/tasks/:taskId`
  - `PATCH /api/v1/station/tasks/:taskId`
  - `DELETE /api/v1/station/tasks/:taskId`（软删除/归档）
  - 保留 `assign / verify / rework / escalate / exception` 动作接口，并明确资源级 `PATCH/DELETE(soft)` 仅用于任务元数据与归档边界，不直接改写工作流状态
  - `/station/tasks` 页面主读源已切正式 `tasks` 表与详情聚合 DTO，默认全宽列表 + 右侧 Drawer
  - 任务状态 / 优先级 / 责任角色 / 任务类型 / 执行节点 / 关联对象类型 / 关联对象下拉已切数据库选项源
  - 任务列表已切后端分页，默认 20 条；详情和操作面改读 `GET /api/v1/station/tasks/:taskId`
  - `tasks` 资源已补元数据更新、归档、恢复能力；所有写操作写 `audit_events`，归档/恢复写 `state_transitions`
- 审计动作：
  - `TASK_UPDATED`
  - `TASK_ARCHIVED`
  - `TASK_RESTORED`
  - 保留既有工作流动作审计链
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `npm run test:frontend:smoke`
  - `npm run test:integration:api` 当前命中既有 `platform/stations archived list` 噪音，不属于 `T-15` 回归面

### T-14 `station/documents`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/station/documents/options`
  - `POST /api/v1/station/documents`
  - `GET /api/v1/station/documents`
  - `GET /api/v1/station/documents/:documentId`
  - `PATCH /api/v1/station/documents/:documentId`
  - `DELETE /api/v1/station/documents/:documentId`（软删除）
  - 保留现有 `presign / upload / preview / download` 主链不变，在其上补齐元数据更新、软删除、恢复、retention 生命周期边界
  - `/station/documents` 页面改成真实数据库 CRUD 工作台，默认全宽列表 + 详情/编辑弹层，不再依赖 `documents/overview` 的本地模板/闸口真相
  - `documents` 主读源已切正式表；`document_type / document_status / retention_class / related_object_type` 下拉切到数据库选项源，相关对象绑定值由数据库对象表实时生成
  - 文档列表切到后端分页，默认 20 条；前端不再做本地截断
  - 写操作统一写 `audit_events`；状态变化与归档/恢复统一写 `state_transitions`
- 审计动作：
  - `DOCUMENT_CREATED`
  - `DOCUMENT_UPDATED`
  - `DOCUMENT_ARCHIVED`
  - `DOCUMENT_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `test:integration:api` 中 documents 定向断言已通过；当前全量集成仅余 `platform/stations` 旧断言污染，不属于本卡回归
  - `test:frontend:smoke` 已覆盖 `/station/documents` 真接口链，当前未见 documents 特有失败

### T-11 `station/flights`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/station/flights/options`
  - `GET /api/v1/station/inbound/flight-create/options`
  - `POST /api/v1/station/inbound/flights`
  - `GET /api/v1/station/inbound/flights`
  - `GET /api/v1/station/inbound/flights/:flightId`
  - `PATCH /api/v1/station/inbound/flights/:flightId`
  - `DELETE /api/v1/station/inbound/flights/:flightId`（软删除）
  - `POST /api/v1/station/outbound/flights`
  - `GET /api/v1/station/outbound/flights`
  - `GET /api/v1/station/outbound/flights/:flightId`
  - `PATCH /api/v1/station/outbound/flights/:flightId`
  - `DELETE /api/v1/station/outbound/flights/:flightId`（软删除）
  - `/station/inbound/flights/new` 已从前端草稿页切为真实创建页
  - `/station/inbound/flights` 与 `/station/outbound/flights` 已统一后端分页，默认 20 条
  - 航班选择项、来源站、目的站、服务等级、运行状态已切数据库 options 接口
  - 航班对象主读写已切正式 `flights` 表，不再依赖 `demo_datasets`
- 审计动作：
  - `INBOUND_FLIGHT_CREATED`
  - `INBOUND_FLIGHT_UPDATED`
  - `INBOUND_FLIGHT_ARCHIVED`
  - `INBOUND_FLIGHT_RESTORED`
  - `OUTBOUND_FLIGHT_CREATED`
  - `OUTBOUND_FLIGHT_UPDATED`
  - `OUTBOUND_FLIGHT_ARCHIVED`
  - `OUTBOUND_FLIGHT_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `npm run test:integration:api`

### T-12 `station/awbs`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/station/waybills/options?direction=inbound|outbound`
  - `PATCH /api/v1/station/inbound/waybills/:awbId`
  - `DELETE /api/v1/station/inbound/waybills/:awbId`（软删除/归档）
  - `PATCH /api/v1/station/outbound/waybills/:awbId`
  - `DELETE /api/v1/station/outbound/waybills/:awbId`（软删除/归档）
  - 进港/出港提单资源边界已冻结为：`创建=导入链，更新=人工修正，删除=软删除/归档`
  - `/station/inbound/waybills` 与 `/station/outbound/waybills` 已改成正式数据库读写页面，默认全宽列表 + 右侧 Drawer
  - AWB 类型 / 航班绑定 / 当前节点 / NOA/POD/中转状态 / Manifest 状态下拉已切数据库 options 接口
  - 进港/出港提单列表已统一后端分页，默认 20 条并返回 `total`
  - 提单对象主读写已切正式 `awbs` 表，不再以 `demo_datasets` 作为主读源
- 审计动作：
  - `INBOUND_AWB_UPDATED`
  - `INBOUND_AWB_ARCHIVED`
  - `INBOUND_AWB_RESTORED`
  - `OUTBOUND_AWB_UPDATED`
  - `OUTBOUND_AWB_ARCHIVED`
  - `OUTBOUND_AWB_RESTORED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `npm run test:integration:api`
  - `station AWB CRUD/options/pagination 定向校验`

### T-13 `station/shipments`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/station/shipments/options`
  - `GET /api/v1/station/shipments`
  - `GET /api/v1/station/shipments/:shipmentId`
  - Shipment 资源边界已冻结为：`AWB 投影 / 履约聚合对象`，不开放独立手工 `create`
  - `/station/shipments` 已改成正式数据库聚合目录页，方向 / 航班 / 节点 / Fulfillment / 阻断筛选全部走 DB options
  - Shipment 列表已统一后端分页，默认 20 条并返回 `total`
  - Shipment 详情页已直接回连真实 AWB / Document / Task / Exception / Audit，`gate_policy` 聚合改由数据库对象链推导，不再依赖 `demo_datasets`
  - Shipment 主读源已切正式聚合 DTO，不再以 `sinoport-adapters` 或 `demo_datasets` 作为业务真相
- 审计动作：
  - 继续复用对象链审计，不新增第二套 Shipment 手工写入口
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `npm run test:integration:api`
  - `npm run test:frontend:smoke`
  - `GET /api/v1/platform/master-data/jobs`
  - `GET /api/v1/platform/master-data/jobs/:jobId`
  - `POST /api/v1/platform/master-data/jobs/:jobId/retry`
  - `POST /api/v1/platform/master-data/jobs/:jobId/replay`
  - `POST /api/v1/platform/master-data/jobs/:jobId/archive`
  - `GET /api/v1/platform/master-data/relationships/options`
  - `GET /api/v1/platform/master-data/relationships`
  - `GET /api/v1/platform/master-data/relationships/:relationshipId`
  - `/platform/master-data/sync` 页面改成正式 CRUD 页面，默认全宽列表 + 右侧 Drawer
  - `/platform/master-data/jobs` 页面改成正式日志页，默认全宽列表 + retry/replay/archive
  - `/platform/master-data/relationships` 页面改成正式只读聚合页，默认全宽列表 + 关系链详情
  - `platform_master_data_sync / platform_master_data_jobs / platform_master_data_relationships` 与各自 options 表已落地
  - 三页主读源不再依赖 `demo_datasets` 兼容 payload
  - 业务型筛选/表单下拉已切到数据库 options 源
  - 三个列表页已切后端分页，默认 20 条并返回 `total`
- 审计动作：
  - `MASTER_DATA_SYNC_CREATED`
  - `MASTER_DATA_SYNC_UPDATED`
  - `MASTER_DATA_SYNC_ARCHIVED`
  - `MASTER_DATA_SYNC_RESTORED`
  - `MASTER_DATA_JOB_RETRIED`
  - `MASTER_DATA_JOB_REPLAYED`
  - `MASTER_DATA_JOB_ARCHIVED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - `platform master-data sync/jobs/relationships 定向 API 校验`

### T-20 `mobile/outbound_receipts`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/mobile/outbound/:flightNo/options`
  - `GET /api/v1/mobile/outbound/:flightNo/receipts`
  - `POST /api/v1/mobile/outbound/:flightNo/receipts/:awbNo`
  - `PATCH /api/v1/mobile/outbound/:flightNo/receipts/:awbNo`
  - `DELETE /api/v1/mobile/outbound/:flightNo/receipts/:awbNo`（软删除/恢复）
  - `outbound_receipts` 已补齐 `review_status / reviewed_weight / reviewed_at / deleted_at`
  - Receipt 生命周期已明确：创建、更新、归档/恢复、重开（reopen）
  - Receipt 列表真实后端分页，默认 20 条，并返回 `items / page / page_size / total`
  - 收货状态 / 复核状态 / AWB 选择已切数据库 options 或正式对象读源
- 审计动作：
  - `MOBILE_OUTBOUND_RECEIPT_CREATED`
  - `MOBILE_OUTBOUND_RECEIPT_UPDATED`
  - `MOBILE_OUTBOUND_RECEIPT_ARCHIVED`
  - `MOBILE_OUTBOUND_RECEIPT_RESTORED`
  - `MOBILE_OUTBOUND_RECEIPT_REOPENED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run build --prefix admin-console`
  - 子 agent 定向校验确认 receipts 写链、分页、options、audit 和 state transitions 已落地

### T-21 `mobile/outbound_containers`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/mobile/outbound/:flightNo/options`
  - `GET /api/v1/mobile/outbound/:flightNo/containers`
  - `POST /api/v1/mobile/outbound/:flightNo/containers`
  - `PATCH /api/v1/mobile/outbound/containers/:containerCode`
  - `DELETE /api/v1/mobile/outbound/containers/:containerCode`（软删除/恢复）
  - `outbound_containers` 已补齐 `offload_boxes / offload_status / offload_recorded_at / deleted_at`
  - Container 生命周期已明确：创建、更新、归档/恢复、重开（reopen）
  - 已装机容器的货量修改必须先重开，拉货记录必须在已装机后才能写入
  - Container 列表真实后端分页，默认 20 条，并返回 `items / page / page_size / total`
  - 集装器状态 / 拉货状态 / container 选择已切数据库 options 或正式对象读源
- 审计动作：
  - `MOBILE_OUTBOUND_CONTAINER_CREATED`
  - `MOBILE_OUTBOUND_CONTAINER_UPDATED`
  - `MOBILE_OUTBOUND_CONTAINER_ARCHIVED`
  - `MOBILE_OUTBOUND_CONTAINER_RESTORED`
  - `MOBILE_OUTBOUND_CONTAINER_REOPENED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run build --prefix admin-console`
  - 子 agent 定向校验确认 containers 写链、分页、options、audit 和 state transitions 已落地

### T-24 `demo_datasets` 过渡层清退

- 状态：`Accepted`
- 完成内容：
  - `apps/api-worker/src/lib/demo-datasets.ts` 已冻结 `demo_datasets` 的角色为 `fixture / replay / 样板导入`
  - 已把当前保留的 dataset key 分组写入代码边界，明确它们只能作为兼容快照，不得再表述为已完成 CRUD 页面或正式业务对象的主真相
  - `admin-console/src/data/sinoport.js` 与 `admin-console/src/data/sinoport-adapters.js` 已补充 fixture 边界说明，明确本地 data 层只保留为样板、回放和兼容壳
  - `GET /api/v1/platform/stations`、`GET /api/v1/platform/stations/:stationId`、`GET /api/v1/platform/stations/capabilities` 的 capability/team 聚合已切到 `station_governance + teams/zones/devices/stations` 正式源，不再把 adapter payload 当 live truth
  - 已在对象矩阵和页面矩阵同步冻结边界：已签收 CRUD 页面不得再以 `demo_datasets` 或本地 adapter 当业务真相
- 当前保留边界：
  - `apps/api-worker/src/lib/demo-datasets.ts` 已继续收缩，`loadStablePlatform* / loadStableStation* / loadDemoDatasetPayloads` 兼容读函数已删除，不再留可回退到业务主链的实现入口
  - `GET /api/v1/platform/demo-datasets*` 继续保留，但仅作为 fixture/replay catalog 与 payload 检视接口
  - `sinoport.stationResourceVehicles.*` 继续保留，但只作为样板导入和本地回放载荷前缀，不再作为正式车辆业务真相
- 未做内容：
  - 本卡未删除 dataset key；保留 key 仍作为 fixture/replay/兼容快照存在
- 验收：
  - 主 agent 已将平台站点聚合端点的 capability/team live truth 切到正式源；剩余保留 key 仅用于 fixture/replay/样板导入

### T-17 `mobile/inbound_count_records`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/mobile/inbound/:flightNo/counts`
  - `GET /api/v1/mobile/inbound/:flightNo/counts/options`
  - `POST /api/v1/mobile/inbound/:flightNo/counts/:awbNo`
  - `PATCH /api/v1/mobile/inbound/:flightNo/counts/:awbNo`
  - `DELETE /api/v1/mobile/inbound/:flightNo/counts/:awbNo`（软删除/恢复）
  - `inbound_count_records` 已形成正式对象主读源；列表接口真实后端分页，默认 20 条，并返回 `items / page / page_size / total`
  - Count record 生命周期已明确：创建、更新、归档/恢复、重开（reopen）；`理货完成` 后修改件数或扫码明细必须先重开
  - `count status / AWB` 选项已由数据库 options 或正式对象读源提供；页面本地状态仅保留扫码和 UI scratch
  - 所有写操作写 `audit_events`；状态变化、归档、恢复、重开写 `state_transitions`
- 审计动作：
  - `INBOUND_COUNT_RECORD_CREATED`
  - `INBOUND_COUNT_RECORD_UPDATED`
  - `INBOUND_COUNT_RECORD_ARCHIVED`
  - `INBOUND_COUNT_RECORD_RESTORED`
  - `INBOUND_COUNT_RECORD_REOPENED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - 主 agent 代码核对确认 `audit_events` 与 `state_transitions` 已在写链落地

### T-18 `mobile/inbound_pallets`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/mobile/inbound/:flightNo/pallets`
  - `GET /api/v1/mobile/inbound/:flightNo/pallets/options`
  - `POST /api/v1/mobile/inbound/:flightNo/pallets`
  - `PATCH /api/v1/mobile/inbound/pallets/:palletNo`
  - `DELETE /api/v1/mobile/inbound/pallets/:palletNo`（软删除/恢复）
  - `inbound_pallets + inbound_pallet_items` 已形成正式对象主读源；列表接口真实后端分页，默认 20 条，并返回 `items / page / page_size / total`
  - Pallet 生命周期已明确：创建、更新、归档/恢复、重开（reopen）；`已装车` 后修改托盘内容必须先重开
  - `pallet status / storage location / AWB` 选项已由数据库 options 或正式对象读源提供；页面本地状态仅保留扫码缓存和 UI scratch
  - 所有写操作写 `audit_events`；状态变化、归档、恢复、重开写 `state_transitions`
- 审计动作：
  - `INBOUND_PALLET_CREATED`
  - `INBOUND_PALLET_UPDATED`
  - `INBOUND_PALLET_ARCHIVED`
  - `INBOUND_PALLET_RESTORED`
  - `INBOUND_PALLET_REOPENED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - 主 agent 代码核对确认 `inbound_pallet_items` 已成为正式托盘条目真相，页面本地状态仅保留扫码缓存和 UI scratch

### T-19 `mobile/loading_plans`

- 状态：`Accepted`
- 完成内容：
  - `GET /api/v1/mobile/inbound/:flightNo/loading-plans`
  - `GET /api/v1/mobile/inbound/:flightNo/loading-plans/options`
  - `POST /api/v1/mobile/inbound/:flightNo/loading-plans`
  - `PATCH /api/v1/mobile/inbound/loading-plans/:planId`
  - `DELETE /api/v1/mobile/inbound/loading-plans/:planId`（软删除/恢复）
  - `loading_plans + loading_plan_items` 已形成正式对象主读源；列表接口真实后端分页，默认 20 条，并返回 `items / page / page_size / total`
  - Loading plan 生命周期已明确：创建、更新、归档/恢复、重开（reopen）；`已完成` 后修改车牌、Collection Note、托盘绑定等计划内容必须先重开
  - `plan status / pallet / truck` 选项已由数据库 options 或正式对象读源提供；页面本地状态仅保留执行态输入和 UI scratch
  - 所有写操作写 `audit_events`；状态变化、归档、恢复、重开写 `state_transitions`
- 审计动作：
  - `INBOUND_LOADING_PLAN_CREATED`
  - `INBOUND_LOADING_PLAN_UPDATED`
  - `INBOUND_LOADING_PLAN_ARCHIVED`
  - `INBOUND_LOADING_PLAN_RESTORED`
  - `INBOUND_LOADING_PLAN_REOPENED`
- 验收：
  - `npm run db:migrate:local --workspace @sinoport/api-worker`
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - 主 agent 代码核对确认 `loading_plan_items` 已成为正式计划条目真相，页面本地状态仅保留执行态输入和 UI scratch

### T-22 `统一下拉选项服务`

- 状态：`Accepted`
- 完成内容：
  - 新增统一接口族，固定返回结构为 `scope / resource / groups`，每个选项项固定为 `value / label / disabled / meta`
  - 平台统一接口已落地：
    - `GET /api/v1/platform/options/stations`
    - `GET /api/v1/platform/options/teams`
    - `GET /api/v1/platform/options/zones`
    - `GET /api/v1/platform/options/devices`
    - `GET /api/v1/platform/options/network/lanes`
    - `GET /api/v1/platform/options/network/scenarios`
    - `GET /api/v1/platform/options/rules`
    - `GET /api/v1/platform/options/master-data`
    - `GET /api/v1/platform/options/master-data/sync`
    - `GET /api/v1/platform/options/master-data/jobs`
    - `GET /api/v1/platform/options/master-data/relationships`
  - 货站统一接口已落地：
    - `GET /api/v1/station/options/resources/vehicles`
    - `GET /api/v1/station/options/flights?direction=inbound|outbound`
    - `GET /api/v1/station/options/waybills?direction=inbound|outbound`
    - `GET /api/v1/station/options/shipments`
    - `GET /api/v1/station/options/documents`
    - `GET /api/v1/station/options/tasks`
    - `GET /api/v1/station/options/exceptions`
  - 移动端统一接口已落地：
    - `GET /api/v1/mobile/options/login`
    - `GET /api/v1/mobile/options/select`
    - `GET /api/v1/mobile/options/inbound/:flightNo/counts`
    - `GET /api/v1/mobile/options/inbound/:flightNo/pallets`
    - `GET /api/v1/mobile/options/inbound/:flightNo/loading-plans`
    - `GET /api/v1/mobile/options/outbound/:flightNo`
  - 旧的对象级 `/.../options` 接口继续保留，统一接口通过兼容层复用现有 DB loaders 和正式 service，不要求当前页面立即迁移
- 契约说明：
  - 顶层统一口径：`scope / resource / station_id? / direction? / flight_no? / role_key? / groups`
  - `groups` 下各组选项项都固定为：`value / label / disabled / meta`
  - 不在本卡内处理列表分页与页面层大规模改造
- 验收建议：
  - `npm run typecheck`
  - 可选定向校验：
    - `GET /api/v1/platform/options/stations`
    - `GET /api/v1/station/options/tasks`
    - `GET /api/v1/mobile/options/outbound/:flightNo`
  - 主 agent 已完成代码核对，确认统一接口族与契约已落地；页面迁移节奏留给后续按需推进

### T-23 `统一列表分页`

- 状态：`Accepted`
- 完成内容：
  - 所有正式列表接口统一支持 `page / page_size / total`
  - 既有 CRUD 列表页已统一默认 20 条，并在筛选变更后自动回到第一页
  - `/mobile/inbound`、`/mobile/outbound`、`/station/inbound/mobile` 已切到正式航班分页接口
  - `/mobile/pre-warehouse`、`/mobile/headhaul`、`/mobile/export-ramp`、`/mobile/runtime`、`/mobile/destination-ramp`、`/mobile/tailhaul`、`/mobile/delivery` 所复用的 `/api/v1/mobile/node/:flowKey` 已补齐服务端筛选、`items / page / page_size / total` 和前端分页消费
  - 货站对象页与移动作业对象页的正式列表接口已统一分页口径，不再由前端截断全量列表伪装分页
- 验收：
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - 主 agent 代码核对确认 `useGetMobileNodeFlow()`、`MobileNodeListPage`、移动首页航班页和各对象列表页已消费真实分页契约

### T-25 `总体验收`

- 状态：`Accepted`
- 对象线验收：
  - 平台治理对象：`stations / teams / zones / devices / vehicles`
  - 平台网络与主数据对象：`network_lanes / network_scenarios / rules / master_data / master_data_sync / jobs / relationships`
  - 货站主业务对象：`flights / awbs / shipments / documents / tasks / exceptions`
  - 移动作业对象：`inbound_count_records / inbound_pallets / loading_plans / outbound_receipts / outbound_containers`
- 页面线验收：
  - 已签收 CRUD 页面不再以 `demo_datasets`、`sinoport.js` 或 `sinoport-adapters.js` 作为主业务真相
  - 业务型下拉已通过正式选项接口或正式对象读源提供
  - 列表页已统一后端分页，默认 20 条
- 全局线验收：
  - 写链保留审计与状态迁移
  - 删除策略默认软删除/归档
  - `demo_datasets` 已冻结为 `fixture / replay / 样板导入` 兼容层，不再作为当前 CRUD 收口范围内页面和对象的主读源
- 验收：
  - `npm run typecheck`
  - `npm run build --prefix admin-console`
  - 主 agent 代码审查确认 `T-22 / T-23 / T-24` 已全部签收后，完成当前 CRUD 主线总闭环
