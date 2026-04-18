# Sinoport OS 客户验收内部执行手册 v1.0

## 1. 目标

本手册用于内部同事在本地快速准备一套可用于客户验收的完整数据，并按固定顺序完成彩排。

本轮主演示站固定为 `MME`，主对象固定为：

- 进港航班：`SE803`
- 出港航班：`SE913`
- 进港 AWB：`436-10358585`
- Shipment：`in-436-10358585`
- 进港异常：`EXP-0408-001`
- 出港异常：`EXP-0409-301`

## 2. 一键准备命令

### 2.1 数据准备

基础版：

```bash
cd /Users/lijun/Downloads/Sinoport
npm run prepare:acceptance:local
```

完整校验版：

```bash
cd /Users/lijun/Downloads/Sinoport
npm run prepare:acceptance:local:full
```

脚本会完成这些动作：

1. 本地 D1 migration
2. 清理 `Z*` 本地测试站点
3. 把 `MME / URC / MST / RZE / KGF / NVI / BoH` 统一到客户验收口径
4. 跑 API 集成回归，重放并重置主演示对象链
5. 跑 Agent smoke，确认 Copilot 相关对象可读
6. 完整版额外跑前端 smoke

### 2.2 本地服务启动

前端：

```bash
cd /Users/lijun/Downloads/Sinoport
npm --prefix admin-console run start -- --host 127.0.0.1 --port 3002
```

API：

```bash
cd /Users/lijun/Downloads/Sinoport
npm --workspace @sinoport/api-worker run dev -- --local
```

Agent：

```bash
cd /Users/lijun/Downloads/Sinoport
npm --workspace @sinoport/agent-worker run dev -- --local
```

## 3. 登录与入口

### 3.1 Web 后台

- 登录页：`http://127.0.0.1:3002/login`
- 平台首页：`http://127.0.0.1:3002/platform/operations`
- 货站首页：`http://127.0.0.1:3002/station/dashboard`
- Copilot：`http://127.0.0.1:3002/station/copilot`

测试账号：

- 用户名：`supervisor@sinoport.local`
- 密码：`Sinoport123!`

### 3.2 移动端

- 登录页：`http://127.0.0.1:3002/mobile/login`

推荐填写：

- 操作员姓名：`MME Ramp Operator`
- 工号：`PDA-001`
- 所属站点：`MME`
- 角色：`收货员`

## 4. 演示前数据检查清单

### 4.1 平台层

必须看到这些站点：

- `MME`
- `URC`
- `MST`
- `RZE`
- `KGF`
- `NVI`
- `BoH`

必须确认：

- 不再出现大量 `Z*` 本地测试站点
- network lanes 至少有：
  - `URC -> MME`
  - `URC -> MST`
  - `URC -> MST -> RZE`
- network scenarios 至少有 1 条 active 和 1 条 onboarding
- rules、master data、reports 页面能打开且有真实对象

### 4.2 货站层

必须确认这些对象存在：

- `SE803`
- `SE913`
- `436-10358585`
- `in-436-10358585`
- `EXP-0408-001`
- `EXP-0409-301`
- `DOC-MANIFEST-SE803`
- `DOC-MANIFEST-SE913`

建议状态：

- `SE803`：已落地，处于进港处理链
- `SE913`：处于 `Pre-Departure`，保留出港阻断点
- `EXP-0408-001`：Open，用于演示进港阻断
- `EXP-0409-301`：Open，用于演示出港文件阻断

### 4.3 移动端

这些页面必须能打开且不白屏：

- `/mobile/select`
- `/mobile/inbound/SE803`
- `/mobile/inbound/SE803/breakdown`
- `/mobile/inbound/SE803/loading`
- `/mobile/outbound/SE913`
- `/mobile/outbound/SE913/receipt`
- `/mobile/runtime/SE913`

### 4.4 Copilot

至少验证下面 4 组对象上下文：

- `Flight / SE803`
- `AWB / 436-10358585`
- `Shipment / in-436-10358585`
- `Exception / EXP-0408-001`

## 5. 现场彩排顺序

### 第一段：平台

顺序：

1. `/platform/operations`
2. `/platform/stations`
3. `/platform/network`
4. `/platform/rules`
5. `/platform/master-data`
6. `/platform/reports`

彩排检查：

- 能讲清健康站、风险站、接入中站
- 能讲清 active / onboarding 两类链路
- 能讲清规则、主数据和报表不是孤立模块

### 第二段：货站

顺序：

1. `/station/dashboard`
2. `/station/inbound/flights/SE803`
3. `/station/inbound/waybills/436-10358585`
4. `/station/shipments/in-436-10358585`
5. `/station/documents/noa`
6. `/station/documents/pod`
7. `/station/tasks`
8. `/station/exceptions/EXP-0408-001`
9. `/station/outbound/flights/SE913`

彩排检查：

- 对象之间能跳转
- 文档、任务、异常能围绕同一链路讲清
- `SE913` 的阻断点能解释清楚

### 第三段：移动端

顺序：

1. `/mobile/select`
2. `/mobile/inbound/SE803/breakdown`
3. `/mobile/inbound/SE803/loading`
4. `/mobile/outbound/SE913/receipt`
5. `/mobile/runtime/SE913`

彩排检查：

- 不出现空页或白屏
- 与后台同一对象的字段一致
- 节点切换顺畅

### 第四段：Copilot 与审计

顺序：

1. `/station/copilot?object_type=Flight&object_key=SE803`
2. `/station/copilot?object_type=AWB&object_key=436-10358585`
3. `/station/copilot?object_type=Shipment&object_key=in-436-10358585`
4. `/station/copilot?object_type=Exception&object_key=EXP-0408-001`
5. `/platform/audit`

彩排检查：

- Copilot 能切对象
- 能读到对象摘要和关联上下文
- 审计页能回到主演示对象

## 6. 现场故障应对

### 6.1 登录页报 `Network Error`

先看：

- `http://127.0.0.1:8787/api/v1/healthz`

如果 API 没起：

```bash
cd /Users/lijun/Downloads/Sinoport
npm --workspace @sinoport/api-worker run dev -- --local
```

如果前端缓存了错误 API 地址，清这些本地存储：

- `sinoportStationApiBaseUrl`
- `serviceToken`
- `serviceRefreshToken`
- `sinoport-station-actor-v1`

### 6.2 移动端登录选项为空

先刷新页面。  
如果还不行，重新跑：

```bash
npm run prepare:acceptance:local
```

当前页面已带本地兜底站点和角色，一般不会再空。

### 6.3 某个移动端 runtime 白屏

先确认数据脚本跑过。  
再看主演示对象：

- `SE803`
- `SE913`

若仍异常，优先切回：

- `/mobile/select`
- `/mobile/inbound/SE803`
- `/mobile/outbound/SE913`

避免停在 detail 白屏页。

### 6.4 Copilot 查不到对象

先确认：

- Agent worker 已启动
- 对象 key 输入正确

备用对象顺序：

1. `Flight / SE803`
2. `Document / DOC-MANIFEST-SE913`
3. `Shipment / in-436-10358585`
4. `Exception / EXP-0408-001`

## 7. 最终通过标准

这次客户验收彩排通过，至少满足：

1. 平台端能讲清 `MME + 健康站 + 风险站` 对比
2. 货站端能讲清 `SE803` 进港主线和 `SE913` 出港主线
3. 文档、任务、异常和审计能回到同一对象链
4. 移动端可连续演示，不白屏、不空页
5. Copilot 能对 4 类对象给出真实上下文
6. 中英切换正常

如果以上 6 条都满足，就可以进入正式客户演示。
