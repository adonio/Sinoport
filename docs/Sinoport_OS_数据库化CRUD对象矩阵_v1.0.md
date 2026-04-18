# Sinoport 数据库化 CRUD 对象矩阵 v1.0

## 目标

- 明确哪些对象已经是正式业务表
- 明确哪些对象要求完整 CRUD
- 明确删除是否采用软删除

## 平台治理对象

| 对象                | 当前主读源             | CRUD 状态              | 删除策略 | 当前结论                                      |
| ------------------- | ---------------------- | ---------------------- | -------- | --------------------------------------------- |
| `stations`          | `stations`             | `C/R/U/D(soft)` 已落地 | 软删除   | 当前已完成第一张正式任务卡                    |
| `teams`             | `teams`                | `C/R/U/D(soft)` 已落地 | 软删除   | 已完成第二张正式任务卡                        |
| `zones`             | `zones`                | `C/R/U/D(soft)` 已落地 | 软删除   | 已完成第三张正式任务卡，含 DB options + audit |
| `devices`           | `platform_devices`     | `C/R/U/D(soft)` 已落地 | 软删除   | 已完成第四张正式任务卡，含 DB options + audit |
| `vehicles`          | `trucks`               | `C/R/U/D(soft)` 已落地 | 软删除   | 已完成第五张正式任务卡，含 DB options + audit |
| `network_lanes`     | `network_lanes`        | `C/R/U/D(soft)` 已落地 | 软删除   | 已完成第六张正式任务卡，含 DB options + audit |
| `network_scenarios` | `network_scenarios`    | `C/R/U/D(soft)` 已落地 | 软删除   | 已完成第七张正式任务卡，含 DB options + audit |
| `rules`             | `platform_rules`       | `C/R/U/D(soft)` 已落地 | 软删除   | 已完成第八张正式任务卡，含 DB options + audit |
| `master_data`       | `platform_master_data` | `C/R/U/D(soft)` 已落地 | 软删除   | 已完成第九张正式任务卡，含 DB options + audit |
| `master_data_sync`  | `platform_master_data_sync` | `C/R/U/D(soft)` 已落地 | 软删除   | 已完成第十张任务卡，按配置对象收口，含 DB options + audit |

## 货站业务对象

| 对象         | 当前主读源   | CRUD 状态                                   | 删除策略    | 当前结论             |
| ------------ | ------------ | ------------------------------------------- | ----------- | -------------------- |
| `flights`    | `flights`    | `C/R/U/D(soft)` 已落地                      | 软删除/归档 | 已完成 Phase 3 第一张任务卡，含 DB options + audit |
| `awbs`       | `awbs`       | `R + import create + U + D(soft)` 已落地    | 软删除/归档 | 已完成第十二张任务卡，创建继续冻结为导入链 |
| `shipments`  | `shipments + awbs + flights`  | `R(aggregate)` 已落地，边界已冻结为 `AWB 投影 / 履约聚合对象` | 跟随 `awbs` 归档 | 已完成第十三张任务卡，不开放独立 create 真相 |
| `documents`  | `documents`  | `C(manual register) / R / U / D(soft) / restore` 已落地；保留 presign/upload/preview/download 主链 | 软删除/恢复 | `T-14` 已交付，保留文件主链 |
| `tasks`      | `tasks`      | `R + workflow actions + U + D(soft)` 已落地 | 软删除/归档 | 已完成第十五张任务卡，资源级更新与归档边界已收口 |
| `exceptions` | `exceptions + station_exception_archive_state` | `R + workflow actions + U + D(soft)` 已落地 | 软删除/归档 | 已完成第十六张任务卡，列表/详情主读源、DB options、分页和审计已收口 |

## 移动作业对象

| 对象                    | 当前主读源 | CRUD 状态              | 删除策略    | 当前结论 |
| ----------------------- | ---------- | ---------------------- | ----------- | -------- |
| `inbound_count_records` | `inbound_count_records` | `C / R / U / D(soft) / restore / reopen` 已落地 | 软删除/作废 | 当前已完成 `T-17`，含 DB options + audit + state transitions |
| `inbound_pallets`       | `inbound_pallets + inbound_pallet_items` | `C / R / U / D(soft) / restore / reopen` 已落地 | 软删除/作废 | 当前已完成 `T-18`，含 DB options + audit + state transitions |
| `loading_plans`         | `loading_plans + loading_plan_items` | `C / R / U / D(soft) / restore / reopen` 已落地 | 软删除/作废 | 当前已完成 `T-19`，含 DB options + audit + state transitions |
| `outbound_receipts`     | `outbound_receipts` | `C(create by receipt workflow) / R / U / D(soft) / reopen` 已落地 | 软删除/作废 | 当前已完成 `T-20`，含 DB options + audit + state transitions |
| `outbound_containers`   | `outbound_containers + outbound_container_items` | `C / R / U / D(soft) / reopen` 已落地 | 软删除/作废 | 当前已完成 `T-21`，含 DB options + audit + state transitions |

## 只读运营对象

| 对象                      | 当前主读源 | 是否做完整 CRUD | 说明         |
| ------------------------- | ---------- | --------------- | ------------ |
| `audit_events`            | 正式表     | 否              | 只读审计链   |
| `state_transitions`       | 正式表     | 否              | 只读状态链   |
| `daily_reports`           | 聚合读模型 | 否              | 只读报表对象 |
| `data_quality_checklists` | 聚合读模型 | 否              | 只读治理对象 |
| `master_data_jobs`        | `platform_master_data_jobs` | 否 | 运行日志对象，仅开放 `R + retry/replay + archive` |
| `master_data_relationships` | `platform_master_data_relationships` | 否 | 只读关系聚合对象，不开放完整 CRUD |

## 已冻结规则

- 主业务对象默认采用软删除或归档，不做物理删除。
- `demo_datasets` 已冻结为 `fixture / replay / 样板导入` 目录，不得再作为已签收 CRUD 对象或页面的正式业务主读源。
- 当前保留的 dataset key 边界固定为：
  - `platformStations` 兼容快照：`sinoport.stationCatalog`、`sinoport-adapters.platformStationCapabilityRows`、`sinoport-adapters.stationCapabilityColumns`、`sinoport-adapters.platformStationTeamRows`、`sinoport-adapters.platformStationZoneRows`、`sinoport-adapters.platformStationDeviceRows`
  - `platformNetwork` 兼容快照：`sinoport.stationCatalog`、`sinoport.routeMatrix`、`sinoport-adapters.networkLaneTemplateRows`、`sinoport-adapters.networkScenarioRows`
  - `platformRules` 兼容快照：`sinoport.serviceLevels`、`sinoport.hardGateRules`、`sinoport.exceptionTaxonomy`、`sinoport.interfaceStatus`、`sinoport-adapters.ruleOverviewRows`、`sinoport-adapters.hardGatePolicyRows`、`sinoport-adapters.ruleTemplateRows`、`sinoport-adapters.evidencePolicyRows`、`sinoport-adapters.scenarioTimelineRows`、`sinoport-adapters.gateEvaluationRows`
  - `platformReports / stationReports / stationResources` 兼容快照与 `sinoport.stationResourceVehicles.*` 样板导入前缀
- `/platform/stations`、`/platform/stations/:stationId`、`/platform/stations/capabilities` 已迁出上述 `platformStations` 兼容快照中的 capability/team live truth，页面和详情主读源改为 `stations + station_governance + teams/zones/devices` 正式聚合 DTO；保留 key 仅用于 fixture/replay/兼容快照。
- 任一对象若不暴露完整 CRUD，必须先冻结决策，再允许实施。
