# Sinoport OS 前端 Demo 冒烟验证报告

## 1. 验证环境

- 本地开发地址：`http://127.0.0.1:3000/`
- 当前范围：第一批、第二批、第三批的前端 demo 基线
- 验证方式：
  - 静态校验
  - 构建校验
  - 关键页面浏览器打开与控制台检查

## 2. 静态校验结果

- `npm run verify:demo`：通过
- `npx eslint "src/**/*.{js,jsx,ts,tsx}" --quiet`：通过
- `npm run build`：通过

说明：

- 当前构建通过，未出现阻塞当前 demo 的构建错误。

## 3. 页面冒烟结果

### 平台端

- [x] `/platform/operations`
- [x] `/platform/stations/capabilities`
- [x] `/platform/audit/events`
- [x] `/platform/master-data/relationships`
- [x] `/platform/reports/stations`

### 货站端

- [x] `/station/dashboard`
- [x] `/station/shipments`
- [x] `/station/documents/pod`
- [x] `/station/exceptions`
- [x] `/station/exceptions/EXP-0408-001`
- [x] `/station/resources/vehicles`
- [x] `/station/reports/shift`

### PDA 端

- [x] `/mobile/select`
- [x] `/mobile/login`
- [x] `/mobile/pre-warehouse`
- [x] `/mobile/headhaul/TRIP-URC-001`
- [x] `/mobile/runtime`
- [x] `/mobile/runtime/SE913`
- [x] `/mobile/delivery/DLV-001`

## 4. 控制台检查结果

本轮重点修复并复核了两类问题：

1. 新增桌面菜单和页面标题的 `MissingTranslationError`
2. 移动端表单字段缺少 `name/id` 的可访问性 issue
3. 移动端角色切换与离线补传队列的基础运行时状态

当前抽查页面控制台结果：

- `/platform/stations/capabilities`：无报错
- `/platform/reports/stations`：无报错
- `/station/documents/pod`：无报错
- `/station/exceptions/EXP-0408-001`：无报错
- `/mobile/headhaul/TRIP-URC-001`：仅保留开发环境正常提示，无业务报错
- `/mobile/login`：角色选择可见，无报错
- `/mobile/pre-warehouse/URC-COL-001`：离线补传面板可见，无业务报错

## 5. 当前结论

当前前端 demo 已达到以下状态：

- 路由、菜单、搜索、workspace 入口基本齐全
- 三批规划内容都已有对应页面或文档载体
- 关键代表页可正常渲染
- 控制台已无明显运行时错误
- 移动端已具备 demo 角色视角与离线补传表达
- 可进入人工验收、演示或合并阶段
