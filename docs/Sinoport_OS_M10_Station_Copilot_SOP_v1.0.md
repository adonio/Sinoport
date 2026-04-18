# Sinoport OS M10 Station Copilot SOP v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：已冻结
- 更新时间：`2026-04-15`
- 适用范围：`M10 Station Copilot 生产验证`

## 2. 目标

在 `MME` 真实对象链下验证 `Station Copilot` 的最小生产价值，只允许“只读 + 建议型”能力，不允许自动执行任何写动作。

## 3. 固定范围

- 站点：`MME`
- 对照站：`RZE`
  - 仅作模板背景，不进入真实结论
- 固定对象样本：
  - `Flight / SE803`
  - `OutboundFlight / SE913`
  - `AWB / 436-10358585`
  - `AWB / 436-10357583`
  - `Shipment / SHIP-IN-436-10358585`
  - `Shipment / SHIP-OUT-436-10357583`
  - `Exception / EXP-0408-001`
  - `Document / DOC-CBA-SE803`
  - `Document / DOC-MANIFEST-SE803`
  - `Document / DOC-FFM-SE913`
  - `Document / DOC-MAWB-436-10357583`

## 4. 允许工具

- `get_flight_context`
- `get_outbound_flight_context`
- `get_outbound_waybill_context`
- `get_station_shipment_context`
- `get_station_exception_context`
- `get_station_document_context`
- `list_blocking_documents`
- `list_open_exceptions`
- `get_object_audit`

## 5. 禁止项

- 禁止自动执行任何写动作
- 禁止把 `request_task_assignment` 暴露到：
  - 工具列表
  - 会话上下文
  - 推荐步骤
  - Copilot UI
- 禁止把 `RZE` 作为第二真实站点得出生产价值结论

## 6. 固定验证步骤

1. 执行 `npm run test:agent:smoke`
2. 执行 `npm run test:validate:m10`
3. 执行 `npm run test:evaluate:m10`
4. 核对以下结果：
   - 有效会话 `>= 5`
   - 采纳会话 `>= 3`
   - 建议采纳率 `>= 60%`
   - `401 / 403 / 404 / 400` 失败样本稳定
   - 会话链 / 工具链 / 审计链完整
   - 无自动写动作
   - 无越权读取或越权建议

## 7. 通过标准

- 固定对象样本集全部可回放
- 脚本结果稳定且可重复
- 生产价值指标达到阈值
- 审计链无缺口
- `request_task_assignment` 不得泄漏

## 8. 收口结论

`Station Copilot` 在 `M10` 只允许继续以“受控只读 + 建议型能力”存在。

- 可以继续投入
- 不允许自动扩面到写动作
- 不自动进入 `M11 Document Agent`
