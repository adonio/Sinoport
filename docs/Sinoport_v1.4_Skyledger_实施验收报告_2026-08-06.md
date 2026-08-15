# Sinoport v1.4 与 Skyledger 实施验收报告

日期：2026-08-06
需求基线：`Sinoport_OS_前置仓_卡车节点_TAS机场清点_系统开发指南_v1_4.md`
验证范围：Sinoport 本地 D1/Workers/Admin Console；Skyledger 隔离 worktree、本地 PostgreSQL/API/Web/同步 Worker

## 1. 结论

本次已完成指南要求的 v1.4 业务底座、前置仓、卡车持续节点、阿拉山口/多斯特克双边口岸、TAS 机场清点、OCC/KPI 控制、权限与审计，以及 Sinoport ↔ Skyledger 双向数据同步。

代码与本地集成环境结论为：**可行，且本次新建业务批次的双向同步与签名对账通过**。最终跨系统运行 `1785995654738-a4981068` 的结果：

- Skyledger → Sinoport：Flight、AWB/Shipment、Truck/TransportJob 建立映射；
- Sinoport → Skyledger：前置仓、卡车、双边口岸、TAS 共 26 个业务事件全部交付，0 个失败；
- Skyledger 卡车最终状态为 `closed`，21 个卡车 checkpoint 全部回写；
- 当前批次的 Awb、Flight、Shipment、TransportJob 签名快照为 `4 = 4`，`mismatch_count = 0`，状态 `MATCHED`；
- 重复、乱序、权限越界、Gate 阻断、冻结后变更、弱网补传和确定性重放均有服务端控制或自动化测试。

这不等同于已经获准生产上线。指南第 16 节列出的真实仓库、车辆/GPS、口岸日历、法定代码、TAS 场地、OCC 值班通讯录、KPI 阈值和业务审批仍必须由业务负责人配置、审批并完成现场 UAT；系统对未确认配置采取 `UNKNOWN/BLOCKED` 保守策略。

## 2. 已交付能力

| 范围 | 状态 | 主要交付 |
|---|---|---|
| 共享业务底座 | 已完成 | CargoUnit、WarehouseReceiptSession、TransportJob、BorderOperation、AirportReceiptSession、RouteTemplate、OperationControlPlan、Milestone、KPI、Incident、Duty、Resource、Decision、ChangeRequest |
| 前置仓 | 已完成 | 应到基线、逐件扫描、重复/错票/件重差异、异常、条件放行、主管复核、离线幂等补传 |
| 卡车 | 已完成 | 21 节点模板、车辆/司机/封志快照、GPS/人工位置、围栏候选人工确认、STALE、时间线、地图失效回退 |
| 阿拉山口/多斯特克 | 已完成 | 中国侧与哈方独立事实、车辆映射、换装事件、三道 Gate、双边权限、CMR/封志/件重一致性、路线切换拦截 |
| TAS | 已完成 | 到场、封志、卸货、逐件扫描、三方核对、短少/多货/错票隔离、B1 Gate、交接摘要 |
| OCC/KPI | 已完成 | 双 ETD、计划版本、红黄蓝、缓冲、A-E Gate、标签平衡、冻结主记录、Incident 时钟、自动任务、Duty/交班/临时权限、OBI 边界 |
| 前端 | 已完成 | OCC 控制塔、站点 v1.4 执行中心、四类移动端页面、菜单/路由、真实 API 数据、中文/英文 |
| 双系统同步 | 已完成 | HMAC-SHA256、时间窗、payload hash、幂等、aggregate sequence、inbox/outbox、重试、head-of-line、重放、对象映射、全局/按对象对账 |

## 3. 指南验收矩阵

状态口径：

- `自动化通过`：已由本地 API/浏览器/跨系统脚本执行并通过；
- `实现完成，需现场 UAT`：代码和接口已完成，但精确设备、网络、供应商或法定现场证据只能在真实环境验收；
- `生产配置/审批前阻断`：不是缺代码；指南明确要求上线前提供权威参数或审批。未配置时系统保持 `UNKNOWN/BLOCKED`。

| 指南编号 | 代码状态 | 自动化/证据 | 生产剩余条件 |
|---|---|---|---|
| AC-PW-001～008 | 已完成 | 正常扫描、重复条码、错票、重量差异、异常、Gate、条件审批、离线幂等已覆盖 | 实际条码枪、拍照、断网/补网现场 UAT；真实重量阈值 |
| AC-TR-001～009 | 已完成 | 21 节点、人工 GPS、围栏候选、人工确认、幂等、快照审计、无地图回退已覆盖 | GPS/车队供应商联调；真实围栏、路线、失联阈值 |
| AC-BD-001～013 | 已完成 | V2 模板、旧 V1 禁用、双边分步事实、三 Gate、角色隔离、件重/封志/车辆映射异常、乱序/重试、巴克图改道拦截已覆盖 | 法定口岸代码、服务日历、各种换车模式的业务批准和现场样本 |
| AC-TAS-001～008 | 已完成 | 到场与正式接收隔离、封志异常、卸货、错票/短少、三方核对、Gate/交接事件已覆盖 | TAS 网络、闸口、接收人、扫描/称重设备现场 UAT |
| AC-E2E-001～005 | 已完成 | 对象关联、事件时间线、底层汇总、审计、67 路由英文残留扫描均通过 | 目标 PDA/浏览器实机验收和敏感信息保留策略确认 |
| AC-OCC-001～020 | 已完成 | 四条件 Gate、Decision 30 分钟回填、Duty/动态授权/冲突、自动任务、PENDING_APPROVAL 阻断、OBI 403 边界已覆盖 | 正式 OCC 手册审批、组织通讯录、两/三班排班和备岗授权 |
| AC-KPI-001～026 | 已完成 | V2 节点、版本、A-E Gate、标签平衡、冻结变更、Incident/CAPA、容量预警、确定性重放、管理摘要已覆盖 | 权威 ETD、216/240 与 240/288 适用范围、阈值和生产绩效审批 |

总计 89 个验收编号均已映射到实现。代码层面没有遗留的 v1.4 P0 空白；不能在开发机替代完成的项目全部归入现场 UAT 或生产配置/审批，而不是标记为已生产验收。

## 4. 自动化测试结果

| 测试 | 结果 | 关键证据 |
|---|---|---|
| Sinoport TypeScript typecheck | 通过 | 7 个 workspace 全部 `tsc --noEmit` 通过 |
| Sinoport API integration | 通过 | 既有平台、站点、移动端 API 回归通过 |
| Sinoport API smoke | 通过 | 健康、认证、核心端点通过 |
| Agent smoke | 通过 | 工具读取通过；未授权 mutation 返回 403 |
| v1.4 acceptance | 通过 | 运行 `1785993373296-62d65262`；前仓/TAS 异常、围栏人工确认、口岸权限/Gate、A-E、标签、自动任务、冻结变更、OBI 边界、确定性重放通过 |
| Frontend production build | 通过 | Vite 构建 3307 modules；仅有大 chunk 警告 |
| Frontend browser smoke | 通过 | 平台、站点、移动端和新增 v1.4 页面真实浏览器冒烟通过 |
| Frontend i18n | 通过 | 67 条中文/英文路由扫描，`findings: []`；移除歧义词条后新增/关键路由再次为零 |
| Skyledger migration | 通过 | 空数据库从初始迁移升级到 `0165` 成功 |
| Skyledger pytest | 通过 | `1141 passed, 1 skipped, 4 xfailed`，0 failed，57.42 秒 |
| Skyledger scoped Ruff | 通过 | 新增 Sinoport 集成模型、服务、路由、脚本全部通过 |
| Skyledger Web build | 通过 | Vite 8 构建 8016 modules；仅有 chunk/timing 警告 |
| 跨系统真实冒烟 | 通过 | 运行 `1785995654738-a4981068`；26/26 反向事件交付，21 checkpoint，当前批次对账 4/4 MATCHED |

说明：Skyledger 全仓 Ruff 仍包含大量既有代码风格债务，本次只对新增集成代码和本次修改的目标文件执行严格检查；这不影响上述 pytest、构建和集成验收结论。

## 5. 双系统数据检查快照

快照时间约为 2026-08-06 13:54～14:00（Asia/Singapore）。

### 5.1 本次验收对象

| 对象 | Skyledger ID | Sinoport ID/结果 |
|---|---|---|
| Flight | `220e2f3a-8dc6-4fd0-a009-9c9ff512faba` | `FLT-SKY-220e2f3a-8dc6-4fd0-a009-9c9ff512faba` |
| AWB | `878e3079-e46e-45b7-a0c2-efe1e64ad2b8` / `999-0205000` | `SHP-SKY-awb:878e3079-e46e-45b7-a0c2-efe1e64ad2b8` |
| Truck | `6ff170ec-e3df-4cf6-a715-b6cd65ac4566` | `TRJ-SKY-6ff170ec-e3df-4cf6-a715-b6cd65ac4566`，最终 `closed` |
| Pre-warehouse | 同一 AWB | `PWR-c72ccf28-39cc-4bc0-a1bc-6af7b2c4e431`，已回传 |
| Border | 同一 Truck | `BDR-66ea7b10-da3c-4846-b49d-98245de20ea2`，双边事件已回传 |
| TAS | 同一 AWB | `TASR-644c26e3-0158-48e7-8444-ff351eb0246d`，已回传 |
| OCC | 同一 Flight | `OCP-a3c5dc0b-e1f9-4b7d-a4f9-142ca0b9438a` |

本次对象在 Sinoport 的 26 个出站事件全部为 `DELIVERED`；Skyledger 对应 26 个事件全部为 `applied`，没有失败。Sinoport 接收的本次 Skyledger 基线事件共 5 个，全部 `APPLIED`。

### 5.2 共享本地测试库历史数据

| 台账 | 当前快照 | 判断 |
|---|---|---|
| Sinoport inbox | `APPLIED 186` | 无当前失败 |
| Sinoport outbox | `DELIVERED 313 / FAILED 313 / PENDING 69` | 失败和后续待处理均来自早期孤立 acceptance fixture，不属于本次批次 |
| Skyledger inbox | `applied 262 / failed 88` | 88 个均为早期缺少父映射的故障注入：69 个 TransportJob、19 个 Shipment |
| Skyledger outbox | `delivered 142` | 无失败或待处理 |
| 全局对账 | Skyledger `126` vs Sinoport `176`，4 类不一致 | 共享库的历史夹具集合不同，不能作为生产基线 |
| 本次作用域对账 | `4` vs `4`，0 差异 | 通过；双方 fingerprint 完全相同 |

Sinoport 历史 313 个失败的分布为：276 个 `EVENT_SEQUENCE_GAP`、21 个 `TRANSPORT_JOB_LINK_NOT_FOUND`、16 个 `SHIPMENT_LINK_NOT_FOUND`；69 个 `PENDING` 是这些旧 aggregate 的后续序号，head-of-line 策略刻意阻止越序发送。没有删除或伪造这些记录，以保留审计证据。

生产切换不得复制这两个共享测试库。应从干净数据库迁移，按批次导入基线，每批使用 scoped reconciliation 达到 `MATCHED` 后再启用持续 worker；详见同步运维手册。

## 6. 上线前仍需业务方完成

以下不是代码遗留，而是指南明确规定的上线输入：

1. 仓库、TAS、车辆、司机、封志、条码、称重和证据规则；
2. GPS/车队供应商接口、认证、频率、车辆映射、失联/偏航阈值；
3. 阿拉山口/多斯特克法定代码、时区、围栏、服务日历、单证、换车/倒装模式和实测样本；
4. OCC-DM、A1/A2/A3、B1/B2、OBI、DQC 主岗/替补/班次/通讯录、兼岗矩阵与审批；
5. 权威 baseline/current ETD、红黄蓝阈值、216H/240H 头程和 240H/288H 产品口径；
6. OCC 手册、V2 路线模板及供应商绩效/对客承诺的正式审批；
7. 真实 PDA、扫码枪、相机、弱网、地图失效和 24 小时值班现场 UAT；
8. 生产密钥托管、URL、告警渠道、保留期、备份、回滚和灾备演练。

上述任一关键项缺失时，不得绕过 `PENDING_APPROVAL`、`UNKNOWN` 或 `BLOCKED`。

## 7. 代码位置

- Sinoport 主工作区：`/Users/lijun/Downloads/Sinoport`，分支 `codex/v14-skyledger-sync`；
- Skyledger 隔离工作区：`/private/tmp/skyledger-sinoport-v14-sync`，分支 `codex/sinoport-v14-sync`；
- 同步运维手册：`docs/Sinoport_Skyledger_同步运维手册.md`。

两个工作区均保留未提交变更，未部署、未推送，也未清理用户已有的 `admin-console/src/sections/auth/jwt/AuthLogin.jsx` 修改。
