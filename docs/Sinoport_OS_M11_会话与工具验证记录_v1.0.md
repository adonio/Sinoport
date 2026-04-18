# Sinoport OS M11 会话与工具验证记录 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-15`

## 2. 会话链要求

- 至少 3 条 `Document` 会话完整跑通：
  - `DOC-MANIFEST-SE803`
  - `DOC-CBA-SE803`
  - `DOC-POD-TRK-0406-018`
- 必须完整验证：
  - `sessions`
  - `messages`
  - `events`
  - `runs`

## 3. 白名单工具

- `get_station_document_context`
- `list_blocking_documents`
- `list_open_exceptions`
- `get_station_exception_context`
- `get_object_audit`

## 4. 失败样本

- `400`：缺失 `object_key`
- `401`：无鉴权访问 `/api/v1/agent/tools`
- `403`：`request_task_assignment`
- `404`：`DOC-NOT-FOUND`

## 5. 审计链要求

- `Document + AWB` 审计必须非空
- `Exception` 必须至少能回读链路
- 不接受“接口 200 但空结果”

## 6. 结论

`W11-02` 的通过标准已冻结为：

- 工具面严格只剩 5 个白名单工具
- 非白名单工具后端不可见、不可用
- 会话链、工具链、审计链可重放
