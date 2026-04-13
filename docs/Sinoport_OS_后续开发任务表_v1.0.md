# Sinoport OS 后续开发任务表 v1.0

## 1. 文档信息

- 文档版本：`v1.0`
- 文档状态：执行任务表
- 更新时间：`2026-04-13`
- 适用阶段：`MME` 进港闭环继续推进阶段
- 关联文档：
  - [Sinoport_OS_后端一期执行计划_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_后端一期执行计划_v1.0.md)
  - [Sinoport_OS_技术架构_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_技术架构_v1.0.md)
  - [Sinoport_OS_API_Contract_Draft_v1.0.md](/Users/lijun/Downloads/Sinoport/docs/Sinoport_OS_API_Contract_Draft_v1.0.md)

## 2. 文档目的

本文件用于把当前已经明确的后续开发工作，整理成一份可执行任务表。

本文件不再讨论“大方向”，只回答四件事：

1. 现在还要做哪些任务
2. 这些任务的优先级是什么
3. 建议谁负责
4. 什么叫做完成

## 3. 当前判断

当前项目已经从“前后端逐步接真”推进到了“本地全链可运行、可回归、可准备发布”的阶段。

当前已具备：

- 后端一期架构和执行顺序已冻结
- Cloudflare Worker + D1 + R2 的后端骨架已搭建
- `MME` 进港与最小出港样板数据已进入本地 D1
- 一期核心接口大部分已具备真实读写能力
- 站内主要页面已开始接真实 API，并保留 mock fallback
- `shipments` 对象链已具备真实查询能力
- 已有可重复执行的 API smoke / integration 脚本

当前剩余问题已经收敛为外部环境问题：

- Cloudflare `staging / production` 真实资源 ID 仍未配置
- GitHub / Cloudflare 发布 secrets 尚未注入
- 远端发布尚未实际执行

## 4. 总体建议

当前建议不再继续扩写本地主链，而是进入“远端部署与验收”阶段。

## 5. 任务分阶段

### Phase 1：本地主链收口

已完成。

### Phase 2：底座与交付能力

代码侧已完成，等待真实云资源接入。

### Phase 3：远端部署与二期主线

下一步只剩远端发布和后续业务扩展。

## 6. 后续开发任务表

| ID | 任务 | 当前状态 | 优先级 | 负责人建议 | 依赖 | 验收标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | 收口 `inbound-flight-detail` 真实化 | 已完成 | P0 | FE + BE | 一期 contract、航班查询接口 | 航班详情页的基础信息、提单摘要、任务摘要、异常摘要、对象审计都来自真实 API |
| T-02 | 收口 `inbound-waybill-detail` 真实化 | 已完成 | P0 | FE + BE | 提单详情接口 | 提单详情页的 AWB、Shipment、文件、任务、异常、对象审计都来自真实 API |
| T-03 | 收口 `documents` 中心真实化 | 已完成 | P0 | FE + BE | 文档列表、文档创建接口 | 文档台账、预签名上传、预览、下载、登记文档动作全部接真实后端 |
| T-04 | 实现 `documents/noa` 与 `documents/pod` 真实动作页 | 已完成 | P0 | FE + BE | 文档中心真实化、R2 上传链路基础 | `NOA`、`POD` 页面校验、重试、人工补发、补签、归档都已接真实接口 |
| T-05 | 完善 `tasks` 页真实动作流 | 已完成 | P0 | FE + BE | 任务列表、分派、异常上报接口 | 任务页支持真实分派、异常上报、`verify / rework / escalate` |
| T-06 | 收口 `exceptions` 详情与联动 | 已完成 | P0 | FE + BE | 异常列表、任务联动 | 异常详情页可读真实数据并执行恢复动作，回跳对象、任务和审计已打通 |
| T-07 | 实现 `mobile/tasks` 可执行链 | 已完成 | P0 | FE + BE | 移动端任务列表接口、PDA 动作接口 | `accept / start / evidence / complete / exception` 已打通；PDA 深层页已改为真实对象读写 |
| T-08 | 接入真实鉴权与站点权限 | 已完成 | P0 | BE | 路由骨架、policy 辅助函数 | 正式 token/session、`me / refresh / logout`、角色范围、站点范围与本地账号体系已生效 |
| T-09 | 接入真实 `R2` 文件上传链路 | 已完成 | P0 | BE | 文档元数据登记接口 | 文件本体、upload ticket、预览、下载、保留策略已接入 |
| T-10 | 补审计与状态流展示 | 已完成 | P1 | FE + BE | `audit_events`、`state_transitions` 已落库 | 平台审计页、`audit-trust` 与核心对象详情页均已接真实审计数据 |
| T-11 | 补自动化测试与 smoke 流 | 已完成 | P1 | BE + QA | 接口与页面主链基本稳定 | API smoke、API integration、agent smoke、前端 browser smoke 均已通过并挂入 CI |
| T-12A | 收口 `shipments` 真实对象链 | 已完成 | P1 | FE + BE | Shipment 查询接口、出港样板数据 | `shipments` 列表与详情已接真实 API，并补了 Shipment 对象审计 |
| T-12 | 启动二期主线：出港闭环或第一个 Agent | 已完成 | P2 | 产品 + FE + BE | Phase 1 全部通过，Phase 2 基本稳定 | 出港动作链、对象审计、Agent 会话/Copilot 已落地；剩余仅真实云发布 |

## 6.1 剩余阻塞项

以下不再属于“代码未完成”，而是“外部环境未就绪”：

| ID | 事项 | 当前状态 | 阻塞点 | 说明 |
| --- | --- | --- | --- | --- |
| R-01 | Cloudflare `staging` 资源绑定 | 未完成 | 缺真实 D1 / R2 资源 ID | `wrangler` 已有环境段，但仍是占位值 |
| R-02 | Cloudflare `production` 资源绑定 | 未完成 | 缺真实 D1 / R2 资源 ID | 同上 |
| R-03 | GitHub Actions 发布 secrets | 未完成 | 缺 `CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID` | `release` workflow 已写好 |
| R-04 | 远端 staging 发布验证 | 未完成 | 依赖 R-01 / R-03 | 本地 smoke 已通过，远端尚未执行 |
| R-05 | 远端 production 发布验证 | 未完成 | 依赖 R-02 / R-03 | 本地 smoke 已通过，远端尚未执行 |

## 7. 推荐执行顺序

建议按以下顺序推进真实发布：

1. `R-01`
2. `R-03`
3. `R-04`
4. `R-02`
5. `R-05`

## 8. 负责人建议

### FE

前端建议主要负责：

- 详情页真实化
- 页面主区域从 mock 切到真实 API
- 动作页表单接线
- 审计与状态展示
- PDA 页面接真

### BE

后端建议主要负责：

- Repository 与真实查询实现
- 写接口与审计落库
- 真实鉴权与 RBAC
- R2 上传
- 集成测试

### QA

测试建议主要负责：

- 核心链路 smoke
- 契约断言
- 页面主链回归
- 异常与阻断场景验证

### 产品/验收

建议主要负责：

- 一期范围守门
- 是否允许动作收口
- 哪些页面可以继续保留 demo 表达
- UAT 验收标准冻结

## 9. 完成判断标准

当前代码侧已完成，判断标准已经满足：

1. `MME` 进港与最小出港主链都能真实读写
2. 文件、任务、异常、审计能够挂到同一条对象链上
3. 前端主区域不再依赖散落 mock
4. 测试可稳定回归核心链路
5. Agent 会话与 Copilot 页面已可用

## 10. 当前最推荐的下一个动作

基于当前进度，建议下一步只盯真实云发布：

1. 填 Cloudflare 真实资源 ID
2. 注入 GitHub 发布 secrets
3. 跑一次 `staging` 发布
4. 再跑一次 `production` 发布

一句话总结：

当前本地开发任务已收口，剩余事项只在远端发布环境。
