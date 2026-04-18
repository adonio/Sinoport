# Sinoport OS M11 Document Agent SOP v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-15`

## 2. 目标

在 `MME` 真实单证对象链下验证 `Document Agent` 的最小生产价值，只允许“只读 + 建议型”能力，不允许自动执行任何写动作。

## 3. 固定范围

- 站点：`MME`
- 对照站：`RZE`
  - 仅作模板背景，不进入真实结论
- 固定对象样本：
  - `DOC-CBA-SE803`
  - `DOC-MANIFEST-SE803`
  - `DOC-POD-TRK-0406-018`
  - `AWB-436-10358585`
  - `TASK-0408-201`
  - `TASK-0408-002`
  - `EXP-0408-001`

## 4. 白名单工具

- `get_station_document_context`
- `list_blocking_documents`
- `list_open_exceptions`
- `get_station_exception_context`
- `get_object_audit`

## 5. 禁止项

- 禁止开放任何单证写动作工具
- 禁止暴露 `request_task_assignment`
- 禁止把 `Shipment / Flight / 出港对象链` 拉回本月主验证面
- 禁止把 `RZE` 作为第二真实站点得出结论
- 禁止把“查询提效”等同于“单证建议有效”

## 6. 固定结论

`Document Agent` 在 `M11` 允许继续投入，但仅限：

- `NOA / POD` 相关单证链
- 只读 + 建议型
- 无自动写动作

如果后续建议价值不稳定，应收缩为只读查询工具。
