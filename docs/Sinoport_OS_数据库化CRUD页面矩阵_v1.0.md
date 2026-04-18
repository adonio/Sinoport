# Sinoport 数据库化 CRUD 页面矩阵 v1.0

## 目标

- 识别哪些页面仍读过渡层
- 识别哪些页面下拉仍非数据库选项源
- 识别哪些列表页尚未落实后端分页

## 平台页

| 页面                              | 当前主读源                          | 下拉状态                                          | 分页状态                 | 当前结论                                     |
| --------------------------------- | ----------------------------------- | ------------------------------------------------- | ------------------------ | -------------------------------------------- |
| `/platform/operations`            | `stations + tasks + exceptions + audit_events` 正式聚合 DTO | 无关键下拉 | 摘要页，不适用 | 当前已完成，平台告警 / 待办 / 审计回放已切正式聚合 |
| `/platform/stations`              | `stations + station_governance + teams/zones/devices` 正式聚合 DTO | 控制层级/阶段/Owner 已切 DB                       | 已切后端分页，默认 20 条 | 当前已完成，capability/team 聚合已切正式源 |
| `/platform/stations/capabilities` | `stations + station_governance` 正式聚合 DTO | 无关键下拉                                        | 无分页                   | 已迁出 `demo_datasets`，矩阵主读源改为正式治理模板和站点主记录 |
| `/platform/stations/teams`        | `teams`                             | 所属站点/班次/状态已切 DB                         | 已切后端分页，默认 20 条 | 当前已完成                                   |
| `/platform/stations/zones`        | `zones`                             | 所属站点/区位类型/状态已切 DB                     | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer       |
| `/platform/stations/devices`      | `platform_devices`                  | 所属站点/设备类型/绑定角色/Owner 班组/状态已切 DB | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer       |
| `/platform/network`               | `stations + network_lanes + network_scenarios` 正式聚合 DTO | 无关键下拉                                        | 摘要页，不适用           | 当前已完成，站点目录和 lane/scenario 摘要均切正式源 |
| `/platform/network/lanes`         | `network_lanes`                     | 关联站点/控制深度/状态已切 DB                     | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer       |
| `/platform/network/scenarios`     | `network_scenarios`                 | 场景分类/关联链路/主站点/状态已切 DB              | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer       |
| `/platform/rules`                 | `platform_rules` + 正式聚合 DTO     | 规则类型/控制层级/适用范围/服务等级/阶段/状态已切 DB | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer       |
| `/platform/master-data`           | `platform_master_data`              | 主数据类型 / 来源 / 状态已切 DB                    | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer       |
| `/platform/master-data/sync`      | `platform_master_data_sync`         | 对象 / 目标模块 / 状态已切 DB                     | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer       |
| `/platform/master-data/jobs`      | `platform_master_data_jobs`         | 来源 / 对象 / 状态 / 动作已切 DB                  | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + retry/replay/archive |
| `/platform/master-data/relationships` | `platform_master_data_relationships` | Source / Relation / Target / 证据源已切 DB        | 已切后端分页，默认 20 条 | 当前已完成，只读聚合列表 + 关系链详情        |
| `/platform/reports`               | `platform daily report` 正式聚合 DTO | 无关键下拉 | 摘要页，不适用 | 当前已完成，平台报表不再读 stable report payload |

## 货站页

| 页面                          | 当前主读源 | 下拉状态                    | 分页状态                  | 当前结论                               |
| ----------------------------- | ---------- | --------------------------- | ------------------------- | -------------------------------------- |
| `/station/dashboard`          | `flights + tasks + exceptions + loading_plans + documents` 正式聚合 DTO | 无关键下拉 | 摘要页，不适用 | 当前已完成，首页 blocker/review/transfer 卡片已切正式聚合 |
| `/station/inbound/flights`    | `flights`  | 航班选择项已切 DB           | 已切后端分页，默认 20 条 | 当前已完成，列表页统一分页；创建页已改真实写入 |
| `/station/inbound/waybills`   | `awbs`     | 航班 / 节点 / NOA / POD / 中转已切 DB | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer |
| `/station/outbound/flights`   | `flights`  | 航班选择项已切 DB           | 已切后端分页，默认 20 条 | 当前已完成，列表页统一分页             |
| `/station/outbound/waybills`  | `awbs`     | 航班 / 节点 / Manifest 已切 DB | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer |
| `/station/documents`          | `documents` 正式表 + 详情聚合 DTO | 文档类型 / 状态 / 保留策略 / 对象绑定已切 DB | 已切后端分页，默认 20 条 | `T-14` 已交付，默认全宽列表 + 详情/编辑弹层 |
| `/station/tasks`              | `tasks` + 详情聚合 DTO | 任务状态 / 优先级 / 责任角色 / 任务类型 / 执行节点 / 关联对象已切 DB | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer |
| `/station/exceptions`         | `exceptions` 正式表 + 详情聚合 DTO | 异常级别 / 状态 / 责任归属 / 关联对象 / 阻断状态已切 DB | 已切后端分页，默认 20 条 | 当前已完成，默认全宽列表 + 右侧 Drawer |
| `/station/shipments`          | `shipments + awbs + flights` 聚合 DTO | 方向 / 航班 / 节点 / Fulfillment / 阻断已切 DB | 已切后端分页，默认 20 条 | 当前已完成，读为主的聚合对象目录 |
| `/station/resources`          | `teams + zones + devices` 正式聚合 DTO | 无关键下拉 | 摘要页，不适用 | 当前已完成，资源总览页不再读 station resource fixture |
| `/station/resources/vehicles` | `trucks`   | 流程/状态/优先级已切 DB     | 已切后端分页，默认 20 条  | 当前已完成，默认全宽列表 + 右侧 Drawer |

## 移动端页

| 页面             | 当前主读源        | 下拉状态                  | 分页状态       | 当前结论          |
| ---------------- | ----------------- | ------------------------- | -------------- | ----------------- |
| `/mobile/login`  | 正式接口          | 站点/角色统一接口已补到 `/api/v1/mobile/options/login` | 不适用         | 当前已完成统一 options 兼容层，页面迁移可按需推进 |
| `/mobile/select` | 正式接口          | 业务选择统一接口已补到 `/api/v1/mobile/options/select`  | 不适用         | 当前已完成统一 options 兼容层，页面迁移可按需推进 |
| `/mobile/inbound` | `flights` 正式表 + mobile overview 元数据 | 无新增业务下拉 | 已切后端分页，默认 20 条 | 当前已完成，首页航班列表改读正式航班分页接口 |
| `/mobile/outbound` | `flights` 正式表 + mobile overview 元数据 | 无新增业务下拉 | 已切后端分页，默认 20 条 | 当前已完成，首页航班列表改读正式航班分页接口 |
| `/station/inbound/mobile` | `flights` 正式表 + mobile overview 摘要 | 无新增业务下拉 | 已切后端分页，默认 20 条 | 当前已完成，后台 PDA 总览改读正式航班分页接口 |
| `/mobile/inbound/:flightNo/breakdown` | `inbound_count_records + flights + awbs` 聚合详情 | Count status / AWB 已切 DB options 或正式对象读源 | 列表型对象默认 20 条 | 当前已完成，扫码页本地状态仅保留 UI scratch |
| `/mobile/inbound/:flightNo/pallet` | `inbound_pallets + inbound_pallet_items + awbs` 聚合详情 | 托盘状态 / 存放区位 / AWB 已切 DB options 或正式对象读源 | 列表型对象默认 20 条 | 当前已完成，托盘页主真相已切正式表 |
| `/mobile/inbound/:flightNo/loading` | `loading_plans + loading_plan_items + trucks` 聚合详情 | 装车状态 / 托盘 / 车辆已切 DB options 或正式对象读源 | 列表型对象默认 20 条 | 当前已完成，装车页主真相已切正式表 |
| `/mobile/outbound/:flightNo/receipt` | `outbound_receipts` + 航班聚合详情 | 收货/复核状态已切 DB options，AWB 选择走正式对象读源 | 列表型对象默认 20 条 | 当前已完成，资源动作已切服务端 |
| `/mobile/outbound/:flightNo/pmc` | `outbound_containers + outbound_container_items` | 集装器状态/拉货状态已切 DB options，AWB 选择走正式对象读源 | 列表型对象默认 20 条 | 当前已完成，生命周期动作已切服务端 |
| `/station/outbound/flights` | `flights` + `outbound_containers` 聚合 | 航班下拉已切 DB，ULD 预排改走正式 container 写链 | 已切后端分页，默认 20 条 | 当前已完成 office 端与 PDA container 对齐 |
| `/mobile/pre-warehouse` 等 `mobile/node/*` 列表页 | `mobileNodeCatalog` 聚合接口 | 无关键下拉 | 已切后端分页，默认 20 条 | 当前已完成，`/api/v1/mobile/node/:flowKey` 已补 `items/page/page_size/total`、服务端筛选与前端分页消费 |
| 列表类 PDA 页面  | 正式表 + 聚合接口 | 既有 CRUD 页已切正式对象；统一 `/mobile/options/*` 已落地 | 既有 CRUD 页已落实，默认 20 条 | Phase 6 |

## 已冻结规则

- 所有业务型下拉必须从数据库选项源读取。
- 所有列表页统一后端分页，默认每页 20 条。
- 已签收 CRUD 页面不得再把 `demo_datasets`、`sinoport.js` 或 `sinoport-adapters.js` 当业务主真相。
- 页面层允许保留本地静态数据或 dataset payload 的范围，仅限 fixture/replay/样板导入，不再包含已迁移的 `/platform/stations/capabilities`。
