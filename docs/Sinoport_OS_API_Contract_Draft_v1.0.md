# Sinoport OS API Contract Draft v1.0

## 1. 文档目的

本文件用于前后端对齐下一阶段真实接口的最小 contract 草稿。

本版统一：

- 资源边界
- URL 结构
- 返回体骨架
- 前端依赖的关键字段
- 分页、筛选、状态写入方式

## 2. 通用约定

### 2.1 Base Path

```txt
/api/v1
```

### 2.2 返回格式

列表接口：

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 120
}
```

详情接口：

```json
{
  "data": {}
}
```

错误格式：

```json
{
  "error": {
    "code": "DOCUMENT_MISSING",
    "message": "Manifest not released",
    "details": {}
  }
}
```

### 2.3 通用筛选字段

- `station_id`
- `flight_id`
- `awb_no`
- `shipment_id`
- `task_status`
- `fulfillment_status`
- `service_level`
- `date_from`
- `date_to`
- `keyword`

## 3. 平台管理后台接口草案

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/platform/operations/summary` | 运行态势汇总 |
| GET | `/platform/operations/risks` | 风险与阻断项 |
| GET | `/platform/operations/events` | 最近关键事件 |
| GET | `/platform/stations` | 货站列表 |
| POST | `/platform/stations` | 新增货站 |
| GET | `/platform/stations/{station_id}` | 货站详情 |
| PATCH | `/platform/stations/{station_id}` | 修改货站 |
| GET | `/platform/network/lanes` | 链路列表 |
| GET | `/platform/network/scenarios` | 标准场景 |
| GET | `/platform/rules/service-levels` | 服务等级 |
| GET | `/platform/rules/hard-gates` | 硬门槛规则 |
| GET | `/platform/rules/task-generation` | 任务生成规则 |
| GET | `/platform/master-data/objects` | 主对象列表 |
| GET | `/platform/master-data/sync` | 同步状态 |
| GET | `/platform/master-data/jobs` | 导入任务 |
| GET | `/platform/audit/logs` | 审计日志 |
| GET | `/platform/audit/events` | 审计事件 |
| GET | `/platform/reports/stations` | 平台站点报表 |

## 4. 货站后台接口草案

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/station/dashboard/summary` | 首页 KPI 与摘要 |
| GET | `/station/inbound/summary` | 进港总览 |
| GET | `/station/inbound/flights` | 进港航班列表 |
| POST | `/station/inbound/flights` | 新建进港航班 |
| GET | `/station/inbound/flights/{flight_id}` | 航班详情 |
| PATCH | `/station/inbound/flights/{flight_id}` | 修改航班 |
| GET | `/station/inbound/waybills` | 进港提单列表 |
| GET | `/station/inbound/waybills/{awb_id}` | 进港提单详情 |
| POST | `/station/inbound/waybills/{awb_id}/noa` | 发送 NOA |
| POST | `/station/inbound/waybills/{awb_id}/pod` | 上传 POD |
| POST | `/station/inbound/waybills/{awb_id}/transfer` | 创建二次转运 |
| GET | `/station/outbound/summary` | 出港总览 |
| GET | `/station/outbound/flights` | 出港航班列表 |
| GET | `/station/outbound/flights/{flight_id}` | 出港航班详情 |
| GET | `/station/outbound/waybills` | 出港提单列表 |
| GET | `/station/outbound/waybills/{awb_id}` | 出港提单详情 |
| POST | `/station/outbound/waybills/{awb_id}/forecast` | 建立预报 |
| POST | `/station/outbound/waybills/{awb_id}/receipt` | 收货确认 |
| POST | `/station/outbound/waybills/{awb_id}/loading` | 装载确认 |
| POST | `/station/outbound/flights/{flight_id}/manifest` | 上传/生成 Manifest |
| POST | `/station/outbound/flights/{flight_id}/departed` | 飞走确认 |
| GET | `/station/shipments` | Shipment/AWB 列表 |
| GET | `/station/shipments/{shipment_id}` | Shipment 详情 |
| GET | `/station/documents` | 文件列表 |
| POST | `/station/documents` | 上传文件 |
| GET | `/station/tasks` | 任务列表 |
| GET | `/station/tasks/{task_id}` | 任务详情 |
| POST | `/station/tasks/{task_id}/assign` | 分派 |
| POST | `/station/tasks/{task_id}/verify` | 复核 |
| POST | `/station/tasks/{task_id}/exception` | 上报异常 |
| GET | `/station/resources/teams` | 班组列表 |
| GET | `/station/resources/zones` | 区位列表 |
| GET | `/station/resources/devices` | 设备列表 |
| GET | `/station/resources/vehicles` | 车辆列表 |
| GET | `/station/exceptions` | 异常列表 |
| GET | `/station/exceptions/{exception_id}` | 异常详情 |

## 5. PDA 接口草案

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/mobile/login` | 登录 |
| GET | `/mobile/context` | 当前角色 / 站点 / 班组 / 设备 |
| GET | `/mobile/tasks` | 我的任务 |
| GET | `/mobile/tasks/{task_id}` | 任务详情 |
| POST | `/mobile/tasks/{task_id}/accept` | 接单 |
| POST | `/mobile/tasks/{task_id}/start` | 开始 |
| POST | `/mobile/tasks/{task_id}/evidence` | 上传证据 |
| POST | `/mobile/tasks/{task_id}/complete` | 完成 |
| POST | `/mobile/tasks/{task_id}/handover` | 交接 |
| POST | `/mobile/tasks/{task_id}/exception` | 异常上报 |
| POST | `/mobile/scan/resolve` | 根据条码解析对象 |

## 6. 第一批必须冻结的 contract

建议先冻结：

1. `/station/inbound/flights`
2. `/station/inbound/flights/{flight_id}`
3. `/station/inbound/waybills`
4. `/station/outbound/flights`
5. `/station/documents`
6. `/station/tasks`

## 7. 下一步建议

建议继续补：

1. 请求体 JSON 示例
2. 响应体 JSON 示例
3. 枚举字典
4. 错误码表
