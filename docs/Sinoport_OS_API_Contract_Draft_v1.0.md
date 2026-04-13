# Sinoport OS API Contract Draft v1.0

## 1. 文档目的

本文件用于把 Sinoport 后端一期接口从“资源清单”补到“可开发 contract”。

本版重点服务于 `MME` 样板站进港真实闭环，只覆盖：

- 请求体 JSON 示例
- 响应体 JSON 示例
- 必需字段
- 权限要求
- 状态写入点
- 审计字段
- 错误码口径

本版不追求覆盖全部模块，而是先冻结后端一期优先接口。

## 2. 范围说明

### 2.1 Base Path

```txt
/api/v1
```

### 2.2 当前冻结范围

本版当前已冻结以下 `20` 个优先接口：

1. `GET /station/inbound/flights`
2. `GET /station/inbound/flights/{flight_id}`
3. `GET /station/inbound/waybills`
4. `GET /station/inbound/waybills/{awb_id}`
5. `GET /station/shipments`
6. `GET /station/shipments/{shipment_id}`
7. `POST /station/documents`
8. `GET /station/tasks`
9. `POST /station/tasks/{task_id}/assign`
10. `POST /station/tasks/{task_id}/exception`
11. `GET /station/exceptions`
12. `GET /mobile/tasks`
13. `GET /platform/audit/object`
14. `GET /mobile/state/{scope_key}`
15. `POST /mobile/state/{scope_key}`
16. `POST /agent/tools/{tool_name}/execute`
17. `GET /station/outbound/flights`
18. `GET /station/outbound/flights/{flight_id}`
19. `GET /station/outbound/waybills`
20. `GET /station/outbound/waybills/{awb_id}`

### 2.3 一期主链

本版 contract 服务于以下主链：

`Flight -> AWB / Shipment -> Document -> Task -> Exception -> Audit`

## 3. 通用约定

### 3.1 鉴权

所有接口默认要求：

- `Authorization: Bearer <token>`

服务端从登录态中解析：

- `user_id`
- `role_ids`
- `station_scope`
- `tenant_id`
- `client_source`

站点接口默认以当前登录态中的 `station_scope` 为主，不允许无授权跨站访问。

### 3.2 通用请求头

建议统一支持以下请求头：

| Header | 必填 | 说明 |
| --- | --- | --- |
| `Authorization` | 是 | Bearer Token |
| `X-Request-Id` | 否 | 请求链路追踪 ID |
| `X-Client-Source` | 否 | `station-web / mobile-pda / agent-tool` |
| `Idempotency-Key` | 变更接口建议 | 幂等键，防止重复写入 |

### 3.3 列表返回格式

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 120
}
```

### 3.4 详情返回格式

```json
{
  "data": {}
}
```

### 3.5 错误返回格式

```json
{
  "error": {
    "code": "DOCUMENT_MISSING",
    "message": "Manifest not released",
    "details": {}
  }
}
```

### 3.6 时间与主键

- 所有时间字段统一使用 ISO 8601 UTC 字符串
- 所有主键统一使用字符串
- 所有业务枚举统一返回英文值，前端负责本地化展示

### 3.7 通用筛选字段

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

## 4. 权限与审计口径

### 4.1 角色口径

后端一期建议先按以下角色分级：

- `platform_admin`
- `station_supervisor`
- `document_desk`
- `check_worker`
- `inbound_operator`
- `delivery_desk`
- `mobile_operator`

### 4.2 审计规则

所有变更接口必须写审计事件。

审计最小字段建议统一为：

| 字段 | 说明 |
| --- | --- |
| `audit_id` | 审计事件主键 |
| `request_id` | 请求链路 ID |
| `actor_id` | 当前操作人 |
| `actor_role` | 当前角色 |
| `client_source` | `station-web / mobile-pda / agent-tool` |
| `action` | 例如 `TASK_ASSIGNED` |
| `object_type` | `Flight / AWB / Task / Document / Exception` |
| `object_id` | 关联对象主键 |
| `station_id` | 所属站点 |
| `summary` | 动作摘要 |
| `created_at` | 发生时间 |

### 4.3 一期写入动作

本版冻结的写入动作有：

- `DOCUMENT_CREATED`
- `TASK_ASSIGNED`
- `TASK_EXCEPTION_RAISED`
- `AWB_NOA_SENT`
- `AWB_POD_RELEASED`
- `MOBILE_TASK_ACCEPTED`
- `MOBILE_TASK_STARTED`
- `MOBILE_TASK_EVIDENCE_UPLOADED`
- `MOBILE_TASK_COMPLETED`
- `MOBILE_STATE_UPDATED`
- `AGENT_TOOL_EXECUTED`

## 5. 一期关键枚举

### 5.1 Flight Runtime Status

- `Scheduled`
- `Pre-Departure`
- `Airborne`
- `Pre-Arrival`
- `Landed`
- `Delayed`
- `Diverted`
- `Cancelled`

### 5.2 Ground Fulfillment Status

- `Front Warehouse Receiving`
- `First-Mile In Transit`
- `Origin Terminal Handling`
- `Origin Ramp Handling`
- `In Flight`
- `Destination Ramp Handling`
- `Inbound Handling`
- `Tail-Linehaul In Transit`
- `Delivered`
- `Closed`

### 5.3 Task Status

- `Created`
- `Assigned`
- `Accepted`
- `Arrived at Location`
- `Started`
- `Evidence Uploaded`
- `Completed`
- `Verified`
- `Handed Over`
- `Closed`
- `Rejected`
- `Rework`
- `Exception Raised`

### 5.4 Document Status

- `Draft`
- `Uploaded`
- `Parsed`
- `Validated`
- `Missing`
- `Replaced`
- `Approved`
- `Released`

### 5.5 Exception Status

- `Open`
- `In Progress`
- `Resolved`
- `Closed`

### 5.6 AWB 衍生枚举

`noa_status`

- `Pending`
- `Sent`
- `Failed`

`pod_status`

- `Pending`
- `Uploaded`
- `Released`

`transfer_status`

- `Pending`
- `Planned`
- `In Transit`
- `Completed`

## 6. 一期通用错误码

| Code | 含义 | 典型场景 |
| --- | --- | --- |
| `UNAUTHORIZED` | 未登录或 token 无效 | 通用 |
| `FORBIDDEN` | 当前角色无权限 | 通用 |
| `STATION_SCOPE_DENIED` | 跨站访问被拒绝 | 通用 |
| `VALIDATION_ERROR` | 参数校验失败 | 通用 |
| `RESOURCE_NOT_FOUND` | 资源不存在 | 通用 |
| `IDEMPOTENCY_CONFLICT` | 幂等键重复且请求体不一致 | 写入接口 |
| `FLIGHT_NOT_FOUND` | 航班不存在 | Flight |
| `AWB_NOT_FOUND` | 提单不存在 | Waybill |
| `TASK_NOT_FOUND` | 任务不存在 | Task |
| `EXCEPTION_NOT_FOUND` | 异常不存在 | Exception |
| `DOCUMENT_TYPE_UNSUPPORTED` | 文件类型不支持 | Document |
| `DOCUMENT_VERSION_CONFLICT` | 文件版本冲突 | Document |
| `RELATED_OBJECT_NOT_FOUND` | 关联对象不存在 | Document |
| `TASK_ALREADY_CLOSED` | 任务已关闭不可再分派 | Task |
| `ASSIGNEE_NOT_ELIGIBLE` | 指派对象不满足角色或站点要求 | Task |
| `TASK_STATUS_INVALID` | 当前状态不允许该动作 | Task |
| `EXCEPTION_ALREADY_OPEN` | 相同阻断异常已存在 | Exception |

## 7. 接口明细

## 7.1 `GET /station/inbound/flights`

### 用途

获取当前站点进港航班列表。

### 权限

- `station_supervisor`
- `inbound_operator`
- `check_worker`
- `document_desk`

### Query

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | integer | 否 | 默认 `1` |
| `page_size` | integer | 否 | 默认 `20` |
| `station_id` | string | 否 | 默认取登录态站点 |
| `runtime_status` | string | 否 | 航班状态筛选 |
| `service_level` | string | 否 | `P1 / P2 / P3` |
| `date_from` | string | 否 | 航班日期起 |
| `date_to` | string | 否 | 航班日期止 |
| `keyword` | string | 否 | 航班号、起降站、备注搜索 |

### Response 示例

```json
{
  "items": [
    {
      "flight_id": "FLIGHT-SE803-2026-04-08-MME",
      "flight_no": "SE803",
      "flight_date": "2026-04-08",
      "station_id": "MME",
      "origin_code": "YYZ",
      "destination_code": "MME",
      "eta": "2026-04-08T19:05:00Z",
      "actual_landed_at": "2026-04-08T19:02:00Z",
      "runtime_status": "Landed",
      "service_level": "P1",
      "summary": {
        "current_step": "Inbound Handling",
        "total_awb_count": 3,
        "total_pieces": 214,
        "total_weight": 3860,
        "open_task_count": 2,
        "open_exception_count": 1,
        "blocked": true,
        "blocker_reason": "Pieces mismatch not verified"
      }
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

### 说明

- `summary.current_step` 为展示型派生字段，不作为主表基础字段。
- `blocked` 为站点执行视角汇总结果，用于桌面端列表提示。

## 7.2 `GET /station/inbound/flights/{flight_id}`

### 用途

获取进港航班详情页所需数据。

### 权限

- `station_supervisor`
- `inbound_operator`
- `check_worker`
- `document_desk`

### Path

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `flight_id` | string | 是 | 航班主键 |

### Response 示例

```json
{
  "data": {
    "flight": {
      "flight_id": "FLIGHT-SE803-2026-04-08-MME",
      "flight_no": "SE803",
      "flight_date": "2026-04-08",
      "station_id": "MME",
      "origin_code": "YYZ",
      "destination_code": "MME",
      "eta": "2026-04-08T19:05:00Z",
      "actual_landed_at": "2026-04-08T19:02:00Z",
      "runtime_status": "Landed",
      "service_level": "P1"
    },
    "kpis": {
      "total_awb_count": 3,
      "total_pieces": 214,
      "total_weight": 3860,
      "completed_task_count": 1,
      "open_task_count": 2,
      "open_exception_count": 1
    },
    "waybill_summary": [
      {
        "awb_id": "AWB-436-10358585",
        "awb_no": "436-10358585",
        "current_node": "Inbound Handling",
        "noa_status": "Pending",
        "pod_status": "Pending"
      }
    ],
    "document_summary": [
      {
        "document_id": "DOC-CBA-SE803",
        "document_type": "CBA",
        "document_status": "Uploaded",
        "required_for_release": true
      }
    ],
    "task_summary": [
      {
        "task_id": "TASK-0408-001",
        "task_type": "Breakdown",
        "task_status": "Started",
        "assigned_team_id": "TEAM-IN-01"
      }
    ],
    "exception_summary": [
      {
        "exception_id": "EXP-0408-001",
        "exception_type": "PiecesMismatch",
        "exception_status": "Open",
        "severity": "P1",
        "blocker_flag": true
      }
    ]
  }
}
```

### 典型错误码

- `FLIGHT_NOT_FOUND`
- `FORBIDDEN`

## 7.3 `GET /station/inbound/waybills`

### 用途

获取进港提单列表。

### 权限

- `station_supervisor`
- `inbound_operator`
- `check_worker`
- `document_desk`
- `delivery_desk`

### Query

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | integer | 否 | 默认 `1` |
| `page_size` | integer | 否 | 默认 `20` |
| `station_id` | string | 否 | 默认取登录态站点 |
| `flight_id` | string | 否 | 关联航班 |
| `noa_status` | string | 否 | `Pending / Sent / Failed` |
| `pod_status` | string | 否 | `Pending / Uploaded / Released` |
| `transfer_status` | string | 否 | 二次转运状态 |
| `keyword` | string | 否 | `awb_no / consignee_name` |

### Response 示例

```json
{
  "items": [
    {
      "awb_id": "AWB-436-10358585",
      "awb_no": "436-10358585",
      "shipment_id": "SHIP-IN-436-10358585",
      "flight_id": "FLIGHT-SE803-2026-04-08-MME",
      "flight_no": "SE803",
      "consignee_name": "SMDG LOGISTICS",
      "pieces": 50,
      "gross_weight": 700,
      "current_node": "Inbound Handling",
      "noa_status": "Pending",
      "pod_status": "Pending",
      "transfer_status": "Pending",
      "blocked": true,
      "blocker_reason": "Inventory check not verified"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

## 7.4 `GET /station/inbound/waybills/{awb_id}`

### 用途

获取单票进港提单详情页所需数据。

### 权限

- `station_supervisor`
- `inbound_operator`
- `check_worker`
- `document_desk`
- `delivery_desk`

### Path

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `awb_id` | string | 是 | 提单主键 |

### Response 示例

```json
{
  "data": {
    "awb": {
      "awb_id": "AWB-436-10358585",
      "awb_no": "436-10358585",
      "shipment_id": "SHIP-IN-436-10358585",
      "flight_id": "FLIGHT-SE803-2026-04-08-MME",
      "flight_no": "SE803",
      "station_id": "MME",
      "consignee_name": "SMDG LOGISTICS",
      "pieces": 50,
      "gross_weight": 700,
      "current_node": "Inbound Handling",
      "noa_status": "Pending",
      "pod_status": "Pending",
      "transfer_status": "Pending"
    },
    "shipment": {
      "shipment_id": "SHIP-IN-436-10358585",
      "fulfillment_status": "Inbound Handling",
      "service_level": "P1",
      "current_node": "Inbound Handling"
    },
    "documents": [
      {
        "document_id": "DOC-CBA-SE803",
        "document_type": "CBA",
        "document_status": "Uploaded",
        "required_for_release": true
      },
      {
        "document_id": "DOC-POD-TRK-0406-018",
        "document_type": "POD",
        "document_status": "Missing",
        "required_for_release": true
      }
    ],
    "tasks": [
      {
        "task_id": "TASK-0408-002",
        "task_type": "InventoryCheck",
        "task_status": "Assigned",
        "blocker_code": "HG-03"
      },
      {
        "task_id": "TASK-0408-004",
        "task_type": "NOA",
        "task_status": "Created",
        "blocker_code": "HG-06"
      }
    ],
    "exceptions": [
      {
        "exception_id": "EXP-0408-001",
        "exception_type": "PiecesMismatch",
        "exception_status": "Open",
        "severity": "P1",
        "blocker_flag": true
      }
    ]
  }
}
```

### 典型错误码

- `AWB_NOT_FOUND`
- `FORBIDDEN`

## 7.5 `POST /station/documents`

### 用途

注册并创建单证记录。

说明：

- 文件本体先通过基础设施上传链路进入对象存储
- 本接口负责登记业务关联、版本、状态和后续解析动作

### 权限

- `document_desk`
- `station_supervisor`

### Request Body

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `document_type` | string | 是 | 例如 `CBA / Manifest / POD / CMR` |
| `document_name` | string | 是 | 原文件名 |
| `related_object_type` | string | 是 | `Flight / AWB / Shipment / Task / Truck` |
| `related_object_id` | string | 是 | 关联对象主键 |
| `station_id` | string | 否 | 默认取登录态站点 |
| `storage_key` | string | 是 | 对象存储 key |
| `required_for_release` | boolean | 否 | 默认按模板规则 |
| `version_mode` | string | 否 | `new / replace` |
| `replace_document_id` | string | 否 | 替换旧版本时填写 |
| `trigger_parse` | boolean | 否 | 是否进入解析流程 |
| `note` | string | 否 | 上传备注 |

### Request 示例

```json
{
  "document_type": "POD",
  "document_name": "GOFONEW-020426-1 POD.pdf",
  "related_object_type": "AWB",
  "related_object_id": "AWB-436-10358585",
  "station_id": "MME",
  "storage_key": "station/MME/pod/2026/04/08/GOFONEW-020426-1-POD.pdf",
  "required_for_release": true,
  "version_mode": "replace",
  "replace_document_id": "DOC-POD-TRK-0406-018",
  "trigger_parse": true,
  "note": "补传双签版本"
}
```

### Response 示例

```json
{
  "data": {
    "document_id": "DOC-POD-TRK-0406-018-V2",
    "document_type": "POD",
    "document_name": "GOFONEW-020426-1 POD.pdf",
    "related_object_type": "AWB",
    "related_object_id": "AWB-436-10358585",
    "version_no": "v2",
    "document_status": "Uploaded",
    "required_for_release": true,
    "storage_key": "station/MME/pod/2026/04/08/GOFONEW-020426-1-POD.pdf",
    "uploaded_at": "2026-04-08T20:43:00Z",
    "next_actions": [
      "parse",
      "validate"
    ],
    "audit_action": "DOCUMENT_CREATED"
  }
}
```

### 状态写入

- `Document.document_status`: `Draft -> Uploaded`
- 若 `version_mode = replace`，被替换版本进入 `Replaced`

### 审计要求

- `action = DOCUMENT_CREATED`
- 若为替换，额外记录 `replaced_document_id`

### 典型错误码

- `DOCUMENT_TYPE_UNSUPPORTED`
- `RELATED_OBJECT_NOT_FOUND`
- `DOCUMENT_VERSION_CONFLICT`
- `FORBIDDEN`

## 7.6 `GET /station/tasks`

### 用途

获取站点作业任务列表。

### 权限

- `station_supervisor`
- `inbound_operator`
- `check_worker`
- `document_desk`
- `delivery_desk`

### Query

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | integer | 否 | 默认 `1` |
| `page_size` | integer | 否 | 默认 `20` |
| `station_id` | string | 否 | 默认取登录态站点 |
| `task_status` | string | 否 | 任务状态 |
| `task_type` | string | 否 | 任务类型 |
| `execution_node` | string | 否 | 执行节点 |
| `assigned_team_id` | string | 否 | 班组筛选 |
| `assigned_worker_id` | string | 否 | 人员筛选 |
| `related_object_type` | string | 否 | 关联对象类型 |
| `related_object_id` | string | 否 | 关联对象主键 |
| `keyword` | string | 否 | 标题、对象、阻断码搜索 |

### Response 示例

```json
{
  "items": [
    {
      "task_id": "TASK-0408-002",
      "task_type": "InventoryCheck",
      "execution_node": "Inbound Handling",
      "related_object_type": "AWB",
      "related_object_id": "AWB-436-10358585",
      "related_object_label": "436-10358585 / MME Inbound",
      "assigned_role": "check_worker",
      "assigned_team_id": "TEAM-CK-01",
      "assigned_worker_id": null,
      "task_status": "Assigned",
      "task_sla": "30m",
      "due_at": "2026-04-08T19:45:00Z",
      "blocker_code": "HG-03",
      "evidence_required": true,
      "open_exception_count": 1
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

## 7.7 `POST /station/tasks/{task_id}/assign`

### 用途

任务分派或改派。

### 权限

- `station_supervisor`

### Path

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `task_id` | string | 是 | 任务主键 |

### Request Body

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `assigned_role` | string | 是 | 目标角色 |
| `assigned_team_id` | string | 否 | 目标班组 |
| `assigned_worker_id` | string | 否 | 目标人员 |
| `due_at` | string | 否 | 新截止时间 |
| `task_sla` | string | 否 | 任务 SLA |
| `reason` | string | 否 | 分派原因 |

### Request 示例

```json
{
  "assigned_role": "check_worker",
  "assigned_team_id": "TEAM-CK-01",
  "assigned_worker_id": "WORKER-CK-007",
  "due_at": "2026-04-08T19:45:00Z",
  "task_sla": "30m",
  "reason": "Pieces mismatch requires dedicated verification"
}
```

### Response 示例

```json
{
  "data": {
    "task_id": "TASK-0408-002",
    "task_status": "Assigned",
    "assigned_role": "check_worker",
    "assigned_team_id": "TEAM-CK-01",
    "assigned_worker_id": "WORKER-CK-007",
    "due_at": "2026-04-08T19:45:00Z",
    "audit_action": "TASK_ASSIGNED"
  }
}
```

### 状态写入

- `Task.task_status`: `Created -> Assigned`
- 已是 `Assigned` 时允许改派，但需写审计

### 审计要求

- `action = TASK_ASSIGNED`
- 审计记录中必须体现新旧指派对象

### 典型错误码

- `TASK_NOT_FOUND`
- `TASK_ALREADY_CLOSED`
- `ASSIGNEE_NOT_ELIGIBLE`
- `FORBIDDEN`

## 7.8 `POST /station/tasks/{task_id}/exception`

### 用途

对任务上报异常，并生成异常记录。

### 权限

- `station_supervisor`
- `inbound_operator`
- `check_worker`
- `mobile_operator`

### Path

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `task_id` | string | 是 | 任务主键 |

### Request Body

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `exception_type` | string | 是 | 例如 `PiecesMismatch / MissingDocument / SignatureMissing` |
| `severity` | string | 是 | `P1 / P2 / P3` |
| `blocker_flag` | boolean | 是 | 是否阻断主链推进 |
| `owner_role` | string | 是 | 责任角色 |
| `owner_team_id` | string | 否 | 责任班组 |
| `root_cause` | string | 否 | 根因初判 |
| `action_taken` | string | 否 | 已采取动作 |
| `note` | string | 否 | 补充说明 |

### Request 示例

```json
{
  "exception_type": "PiecesMismatch",
  "severity": "P1",
  "blocker_flag": true,
  "owner_role": "check_worker",
  "owner_team_id": "TEAM-CK-01",
  "root_cause": "counted pieces less than manifest",
  "action_taken": "hold NOA and transfer tasks",
  "note": "waiting for recount confirmation"
}
```

### Response 示例

```json
{
  "data": {
    "exception_id": "EXP-0408-001",
    "exception_status": "Open",
    "related_object_type": "Task",
    "related_object_id": "TASK-0408-002",
    "blocker_flag": true,
    "linked_task_id": "TASK-0408-002",
    "task_status": "Exception Raised",
    "audit_action": "TASK_EXCEPTION_RAISED"
  }
}
```

### 状态写入

- `Exception.exception_status`: `Open`
- `Task.task_status`: `Assigned / Started -> Exception Raised`

### 审计要求

- `action = TASK_EXCEPTION_RAISED`
- 审计中必须包含 `exception_type` 与 `blocker_flag`

### 典型错误码

- `TASK_NOT_FOUND`
- `TASK_STATUS_INVALID`
- `EXCEPTION_ALREADY_OPEN`

## 7.9 `GET /station/exceptions`

### 用途

获取站点异常列表。

### 权限

- `station_supervisor`
- `inbound_operator`
- `check_worker`
- `document_desk`
- `delivery_desk`

### Query

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | integer | 否 | 默认 `1` |
| `page_size` | integer | 否 | 默认 `20` |
| `station_id` | string | 否 | 默认取登录态站点 |
| `exception_status` | string | 否 | `Open / In Progress / Resolved / Closed` |
| `exception_type` | string | 否 | 异常类型 |
| `severity` | string | 否 | 严重级别 |
| `related_object_type` | string | 否 | 关联对象类型 |
| `related_object_id` | string | 否 | 关联对象主键 |
| `keyword` | string | 否 | 异常编号、对象、根因搜索 |

### Response 示例

```json
{
  "items": [
    {
      "exception_id": "EXP-0408-001",
      "exception_type": "PiecesMismatch",
      "related_object_type": "AWB",
      "related_object_id": "AWB-436-10358585",
      "related_object_label": "436-10358585 / SE803",
      "severity": "P1",
      "owner_role": "check_worker",
      "owner_team_id": "TEAM-CK-01",
      "exception_status": "Open",
      "blocker_flag": true,
      "root_cause": "counted pieces less than manifest",
      "opened_at": "2026-04-08T19:18:00Z"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

## 7.10 `GET /mobile/tasks`

### 用途

获取当前移动端执行人可见的任务列表。

### 权限

- `mobile_operator`
- `station_supervisor`

### Query

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | integer | 否 | 默认 `1` |
| `page_size` | integer | 否 | 默认 `20` |
| `task_status` | string | 否 | PDA 任务状态筛选 |
| `execution_node` | string | 否 | 节点筛选 |
| `flight_id` | string | 否 | 航班筛选 |
| `flight_no` | string | 否 | 航班号筛选 |
| `awb_no` | string | 否 | 提单号筛选 |

### Response 示例

```json
{
  "items": [
    {
      "task_id": "TASK-0408-001",
      "task_type": "Breakdown",
      "execution_node": "Inbound Handling",
      "task_status": "Assigned",
      "related_object_type": "Flight",
      "related_object_id": "FLIGHT-SE803-2026-04-08-MME",
      "related_object_label": "SE803 / MME Inbound",
      "awb_no": "436-10358585",
      "flight_no": "SE803",
      "station_id": "MME",
      "due_at": "2026-04-08T19:30:00Z",
      "evidence_required": true,
      "blockers": [
        "Manifest not validated"
      ],
      "allowed_actions": [
        "accept",
        "start",
        "upload_evidence",
        "exception"
      ]
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

### 说明

- `allowed_actions` 用于前端决定当前按钮可见性。
- 当前移动端任务默认只返回当前登录人员可执行或已领取任务。

## 8. 一期实现备注

### 8.1 站点约束

后端一期默认先实现单站点样板逻辑：

- `station_id = MME`

但 contract 中继续保留 `station_id` 字段，避免后续多站点扩展时返工。

### 8.2 Agent 调用口径

一期 Agent 只能通过正式 API / Tool 间接调用上述接口。

规则：

- Agent 不直接读写数据库
- Agent 不绕过角色权限
- Agent 触发的调用必须通过 `X-Client-Source = agent-tool` 标记来源

### 8.3 数据层约束

虽然一期运行基线建议为 `D1`，但本 contract 的字段与关系口径按后续可切 `PostgreSQL` 的方式设计。

## 9. 下一步建议

本文件冻结后，建议立即进入以下动作：

1. 基于本 contract 建立 `packages/contracts`
2. 生成 D1 schema 初版
3. 建立 Repository 接口
4. 先实现 `GET /station/inbound/flights`
5. 再实现第一条真实纵向闭环
