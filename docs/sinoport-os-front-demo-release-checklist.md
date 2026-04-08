# Sinoport OS 前端 Demo 发布前检查清单

## 1. 范围

本清单用于当前阶段的前端 demo 发布前检查，不包含任何真实后端上线项。

## 2. 静态校验

- [ ] `npm run verify:demo`
- [ ] `npx eslint "src/**/*.{js,jsx,ts,tsx}" --quiet`
- [ ] `npm run build`
- [ ] 构建产物生成成功

## 3. 路由与页面

- [ ] 平台、货站、PDA 主入口均可访问
- [ ] 第一批、第二批、第三批新增路由无 404
- [ ] 菜单、搜索、workspace 入口无断链

## 4. 数据回连

- [ ] Shipment -> Documents / Tasks / Exceptions 跳转正常
- [ ] Exceptions -> Detail -> 关联页面跳转正常
- [ ] Platform Master Data -> Relationships / Sync / Jobs 跳转正常

## 5. 移动端

- [ ] 登录后可进入节点选择页
- [ ] 登录页可选择 `Demo 角色`
- [ ] 站点切换后本地状态隔离正常
- [ ] 角色切换后底部 tab 和任务动作有明显差异
- [ ] 中英文切换不影响节点壳层标题
- [ ] 第二批、第三批新增 PDA 节点都可进入
- [ ] `TaskOpsPanel` 可显示 `online / offline / queued / synced / failed`
- [ ] 离线动作可进入待补传队列，恢复在线后可看到补传结果

## 6. 关键演示场景

- [ ] `MME` 进港样板链路
- [ ] `URC -> 出港 -> MME -> 交付` 第二批主演示链路
- [ ] 航班运行节点只读确认与异常上报
- [ ] 文件缺失导致阻断
- [ ] `NOA` 发送与 `POD` 补签
- [ ] 角色切换后“收货员 / 复核员 / 文员 / 司机 / 交付岗”只看到各自任务
- [ ] 离线执行一次动作后，恢复在线可看到补传成功或失败

## 7. 文档产物

- [ ] 第一批 QA checklist 存在
- [ ] 第一批 demo script 存在
- [ ] 第二批 QA checklist 存在
- [ ] 第二批 demo script 存在
- [ ] 升级总规划文档存在
- [ ] 覆盖矩阵存在

## 8. 通过标准

满足以上检查项后，当前阶段的前端 demo 可以视为“可演示发布”。
