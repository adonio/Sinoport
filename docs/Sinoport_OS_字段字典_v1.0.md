# Sinoport OS 字段字典 v1.0

## 1. 文档目的

本文件用于冻结下一阶段开发中的核心字段口径，作为：

- 后端表结构设计依据
- 前端表单与列表字段依据
- 测试用例设计依据
- 状态流转、硬门槛与审计字段依据

本版先覆盖 `10` 类核心对象：

1. Flight
2. Shipment
3. AWB
4. ULD / PMC
5. Truck
6. Task
7. Worker
8. Zone
9. Document
10. Exception

## 2. 字段定义规则

| 列名 | 含义 |
| --- | --- |
| 字段名 | 系统内部推荐字段名 |
| 中文名 | 业务展示名 |
| 类型 | `string / integer / decimal / datetime / boolean / enum / object / array` |
| 必填 | 是否为当前对象创建时必填 |
| 可编辑 | 是否允许人工在前端修改 |
| 来源 | `manual / system / interface / derived` |
| 审计 | 是否必须进入审计日志 |
| 状态/门槛 | 是否参与状态推进、阻断或放行 |
| 说明 | 补充说明 |

## 3. Flight

| 字段名 | 中文名 | 类型 | 必填 | 可编辑 | 来源 | 审计 | 状态/门槛 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| flight_id | 航班主键 | string | 是 | 否 | system | 是 | 是 | 系统唯一主键 |
| flight_no | 航班号 | string | 是 | 是 | manual/interface | 是 | 是 | 例如 `SE913` |
| flight_date | 航班日期 | date | 是 | 是 | manual/interface | 是 | 是 | 航班业务日期 |
| origin_code | 始发站 | string | 是 | 是 | manual/interface | 是 | 是 | 三字码或站点码 |
| destination_code | 目的站 | string | 是 | 是 | manual/interface | 是 | 是 | 三字码或站点码 |
| std | 计划起飞时间 | datetime | 否 | 是 | manual/interface | 是 | 是 | 出港使用 |
| etd | 预计起飞时间 | datetime | 否 | 是 | manual/interface | 是 | 是 | 出港使用 |
| sta | 计划到达时间 | datetime | 否 | 是 | manual/interface | 是 | 是 | 进港使用 |
| eta | 预计到达时间 | datetime | 否 | 是 | manual/interface | 是 | 是 | 进港使用 |
| actual_takeoff_at | 实际起飞时间 | datetime | 否 | 是 | interface/manual | 是 | 是 | 决定 Airborne |
| actual_landed_at | 实际落地时间 | datetime | 否 | 是 | interface/manual | 是 | 是 | 决定 Landed |
| runtime_status | 航班运行状态 | enum | 是 | 有条件 | system/manual | 是 | 是 | `Scheduled / Airborne / Landed` 等 |
| station_id | 当前站点 | string | 是 | 是 | manual/interface | 是 | 是 | 当前责任站点 |
| service_level | 服务等级 | enum | 否 | 是 | manual | 是 | 是 | `P1 / P2 / P3` |
| aircraft_type | 机型 | string | 否 | 是 | manual/interface | 是 | 否 | 可后续补充 |
| notes | 备注 | string | 否 | 是 | manual | 是 | 否 | 业务补充说明 |

## 4. Shipment

| 字段名 | 中文名 | 类型 | 必填 | 可编辑 | 来源 | 审计 | 状态/门槛 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shipment_id | 履约主键 | string | 是 | 否 | system | 是 | 是 | 跨链路主键 |
| order_id | 订单号 | string | 否 | 是 | interface/manual | 是 | 否 | 若来源于订单系统 |
| shipment_type | 履约类型 | enum | 否 | 是 | manual | 是 | 否 | 进口/出口/转运 |
| current_node | 当前执行节点 | enum | 是 | 有条件 | system/manual | 是 | 是 | 对应 `Execution Node` |
| fulfillment_status | 地面履约状态 | enum | 是 | 有条件 | system/manual | 是 | 是 | `Ground Fulfillment Status` |
| promise_sla | 承诺时效 | string | 否 | 是 | manual | 是 | 是 | 例如 `48h` |
| service_level | 服务等级 | enum | 否 | 是 | manual | 是 | 是 | `P1 / P2 / P3` |
| station_id | 当前责任站 | string | 否 | 是 | derived/manual | 是 | 是 | 当前责任站点 |
| total_pieces | 总件数 | integer | 否 | 是 | interface/manual | 是 | 是 | 可由 AWB 汇总 |
| total_weight | 总重量 | decimal | 否 | 是 | interface/manual | 是 | 是 | 可由 AWB 汇总 |
| exception_count | 异常数 | integer | 否 | 否 | derived | 否 | 否 | 统计字段 |
| closed_at | 关闭时间 | datetime | 否 | 否 | system | 是 | 是 | 完全闭环时生成 |

## 5. AWB

| 字段名 | 中文名 | 类型 | 必填 | 可编辑 | 来源 | 审计 | 状态/门槛 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| awb_id | 提单主键 | string | 是 | 否 | system | 是 | 是 | 内部主键 |
| awb_no | 主单号 | string | 是 | 是 | manual/interface | 是 | 是 | 例如 `436-10358585` |
| hawb_no | 分单号 | string | 否 | 是 | manual/interface | 是 | 否 | 可选 |
| shipment_id | 履约主键 | string | 是 | 否 | system/interface | 是 | 是 | 所属 Shipment |
| flight_id | 航班主键 | string | 否 | 是 | manual/interface | 是 | 是 | 当前关联航班 |
| shipper_name | 发货人 | string | 否 | 是 | manual/interface | 是 | 否 | |
| consignee_name | 收货人 | string | 否 | 是 | manual/interface | 是 | 否 | |
| notify_name | 通知人 | string | 否 | 是 | manual/interface | 是 | 否 | |
| goods_description | 货描 | string | 否 | 是 | manual/interface | 是 | 否 | |
| pieces | 件数 | integer | 是 | 是 | manual/interface | 是 | 是 | |
| gross_weight | 毛重 | decimal | 是 | 是 | manual/interface | 是 | 是 | |
| current_node | 当前节点 | enum | 是 | 有条件 | system/manual | 是 | 是 | |
| noa_status | NOA 状态 | enum | 否 | 有条件 | system/manual | 是 | 是 | |
| pod_status | POD 状态 | enum | 否 | 有条件 | system/manual | 是 | 是 | |
| transfer_status | 二次转运状态 | enum | 否 | 有条件 | system/manual | 是 | 是 | |
| manifest_status | Manifest 状态 | enum | 否 | 有条件 | system/manual | 是 | 是 | |

## 6. ULD / PMC

| 字段名 | 中文名 | 类型 | 必填 | 可编辑 | 来源 | 审计 | 状态/门槛 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| uld_id | 装载单元主键 | string | 是 | 否 | system | 是 | 是 | |
| uld_code | ULD/PMC 编号 | string | 是 | 是 | manual/interface | 是 | 是 | |
| flight_id | 所属航班 | string | 否 | 是 | manual/interface | 是 | 是 | |
| uld_type | 单元类型 | enum | 否 | 是 | manual/interface | 是 | 否 | ULD/PMC/BULK |
| build_status | 组板状态 | enum | 否 | 有条件 | system/manual | 是 | 是 | |
| breakdown_status | 拆板状态 | enum | 否 | 有条件 | system/manual | 是 | 是 | |
| assigned_zone_id | 当前区位 | string | 否 | 是 | manual/system | 是 | 是 | |
| total_awb_count | 提单数 | integer | 否 | 否 | derived | 否 | 否 | |
| total_pieces | 件数 | integer | 否 | 否 | derived/manual | 是 | 否 | |
| total_weight | 重量 | decimal | 否 | 否 | derived/manual | 是 | 否 | |

## 7. Truck

| 字段名 | 中文名 | 类型 | 必填 | 可编辑 | 来源 | 审计 | 状态/门槛 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| truck_id | 车辆主键 | string | 是 | 否 | system | 是 | 是 | |
| plate_no | 车牌号 | string | 是 | 是 | manual/interface | 是 | 是 | |
| driver_name | 司机姓名 | string | 否 | 是 | manual/interface | 是 | 是 | |
| driver_phone | 司机电话 | string | 否 | 是 | manual/interface | 是 | 否 | |
| route_type | 路由类型 | enum | 否 | 是 | manual | 是 | 否 | 头程/尾程/二次转运 |
| dispatch_status | 派车状态 | enum | 否 | 有条件 | system/manual | 是 | 是 | |
| departure_at | 发车时间 | datetime | 否 | 是 | manual/system | 是 | 是 | |
| arrival_at | 到达时间 | datetime | 否 | 是 | manual/system | 是 | 是 | |
| cmr_id | CMR 文件 | string | 否 | 否 | system | 是 | 是 | |
| pod_id | POD 文件 | string | 否 | 否 | system | 是 | 是 | |

## 8. Task

| 字段名 | 中文名 | 类型 | 必填 | 可编辑 | 来源 | 审计 | 状态/门槛 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| task_id | 任务主键 | string | 是 | 否 | system | 是 | 是 | |
| task_type | 任务类型 | enum | 是 | 是 | system/manual | 是 | 是 | 拆板/理货/装车/签收等 |
| execution_node | 执行节点 | enum | 是 | 否 | system/manual | 是 | 是 | |
| related_object_type | 关联对象类型 | enum | 是 | 否 | system | 是 | 是 | Flight/AWB/Truck 等 |
| related_object_id | 关联对象主键 | string | 是 | 否 | system | 是 | 是 | |
| assigned_role | 指派角色 | enum | 否 | 是 | system/manual | 是 | 是 | |
| assigned_team_id | 指派班组 | string | 否 | 是 | system/manual | 是 | 是 | |
| assigned_worker_id | 指派人员 | string | 否 | 是 | system/manual | 是 | 是 | |
| pick_location_id | 提取位置 | string | 否 | 是 | manual/system | 是 | 否 | |
| drop_location_id | 投放位置 | string | 否 | 是 | manual/system | 是 | 否 | |
| task_status | 任务状态 | enum | 是 | 有条件 | system/manual | 是 | 是 | |
| task_sla | 任务 SLA | string | 否 | 是 | manual/system | 是 | 是 | |
| due_at | 截止时间 | datetime | 否 | 是 | manual/system | 是 | 是 | |
| blocker_code | 阻断码 | string | 否 | 是 | system/manual | 是 | 是 | |
| evidence_required | 是否需要证据 | boolean | 否 | 是 | manual/system | 是 | 是 | |
| completed_at | 完成时间 | datetime | 否 | 否 | system | 是 | 是 | |
| verified_at | 复核时间 | datetime | 否 | 否 | system | 是 | 是 | |

## 9. Worker

| 字段名 | 中文名 | 类型 | 必填 | 可编辑 | 来源 | 审计 | 状态/门槛 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| worker_id | 人员主键 | string | 是 | 否 | system | 是 | 是 | |
| worker_name | 姓名 | string | 是 | 是 | manual | 是 | 否 | |
| role_id | 角色主键 | string | 是 | 是 | manual | 是 | 是 | |
| team_id | 班组主键 | string | 否 | 是 | manual | 是 | 否 | |
| station_id | 所属站点 | string | 否 | 是 | manual | 是 | 否 | |
| shift_code | 班次 | string | 否 | 是 | manual | 是 | 否 | |
| device_id | 绑定设备 | string | 否 | 是 | manual/system | 是 | 否 | |
| worker_status | 在线状态 | enum | 否 | 有条件 | system/manual | 是 | 否 | |
| skill_tags | 技能标签 | array | 否 | 是 | manual | 是 | 是 | |
| can_verify | 是否可复核 | boolean | 否 | 是 | manual | 是 | 是 | |
| can_release | 是否可放行 | boolean | 否 | 是 | manual | 是 | 是 | |

## 10. Zone

| 字段名 | 中文名 | 类型 | 必填 | 可编辑 | 来源 | 审计 | 状态/门槛 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| zone_id | 区位主键 | string | 是 | 否 | system | 是 | 是 | |
| zone_code | 区位编码 | string | 是 | 是 | manual | 是 | 是 | |
| zone_name | 区位名称 | string | 是 | 是 | manual | 是 | 否 | |
| zone_type | 区位类型 | enum | 否 | 是 | manual | 是 | 否 | 收货/拆板/装车/暂存等 |
| station_id | 所属站点 | string | 是 | 是 | manual | 是 | 否 | |
| capacity_pieces | 容量件数 | integer | 否 | 是 | manual | 是 | 否 | |
| capacity_weight | 容量重量 | decimal | 否 | 是 | manual | 是 | 否 | |
| zone_status | 区位状态 | enum | 否 | 有条件 | manual/system | 是 | 是 | 可用/占用/封锁 |

## 11. Document

| 字段名 | 中文名 | 类型 | 必填 | 可编辑 | 来源 | 审计 | 状态/门槛 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| document_id | 文件主键 | string | 是 | 否 | system | 是 | 是 | |
| document_type | 文件类型 | enum | 是 | 是 | manual/interface | 是 | 是 | `FFM / UWS / Manifest / POD / CMR` 等 |
| document_name | 文件名 | string | 是 | 是 | manual/interface | 是 | 否 | |
| related_object_type | 关联对象类型 | enum | 是 | 否 | system/manual | 是 | 是 | |
| related_object_id | 关联对象主键 | string | 是 | 否 | system/manual | 是 | 是 | |
| version_no | 版本号 | string | 否 | 否 | system | 是 | 是 | |
| document_status | 文件状态 | enum | 是 | 有条件 | system/manual | 是 | 是 | |
| uploaded_by | 上传人 | string | 否 | 否 | system | 是 | 否 | |
| uploaded_at | 上传时间 | datetime | 否 | 否 | system | 是 | 否 | |
| parsed_result | 解析结果 | object | 否 | 否 | system | 是 | 是 | |
| validation_result | 校验结果 | object | 否 | 否 | system | 是 | 是 | |
| required_for_release | 是否放行必需 | boolean | 否 | 是 | manual/system | 是 | 是 | |
| storage_url | 文件地址 | string | 否 | 否 | system | 是 | 否 | |

## 12. Exception

| 字段名 | 中文名 | 类型 | 必填 | 可编辑 | 来源 | 审计 | 状态/门槛 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| exception_id | 异常主键 | string | 是 | 否 | system | 是 | 是 | |
| exception_type | 异常类型 | enum | 是 | 是 | manual/system | 是 | 是 | 数量/重量/文件/签收等 |
| related_object_type | 关联对象类型 | enum | 是 | 否 | system/manual | 是 | 是 | |
| related_object_id | 关联对象主键 | string | 是 | 否 | system/manual | 是 | 是 | |
| severity | 严重等级 | enum | 否 | 是 | manual/system | 是 | 是 | P1/P2/P3 或 High/Medium/Low |
| owner_role | 责任角色 | string | 否 | 是 | manual/system | 是 | 是 | |
| owner_team_id | 责任班组 | string | 否 | 是 | manual/system | 是 | 否 | |
| exception_status | 异常状态 | enum | 是 | 有条件 | system/manual | 是 | 是 | Open/In Progress/Resolved/Closed |
| blocker_flag | 是否阻断 | boolean | 否 | 是 | manual/system | 是 | 是 | |
| root_cause | 根因 | string | 否 | 是 | manual | 是 | 否 | |
| action_taken | 处理动作 | string | 否 | 是 | manual | 是 | 否 | |
| opened_at | 创建时间 | datetime | 否 | 否 | system | 是 | 否 | |
| closed_at | 关闭时间 | datetime | 否 | 否 | system | 是 | 否 | |

## 13. 下一步建议

建议下一步基于本字段字典继续补两项：

1. 字段枚举字典
2. 数据库表结构草案
