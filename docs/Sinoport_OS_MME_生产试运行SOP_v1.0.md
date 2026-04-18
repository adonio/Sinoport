# Sinoport OS MME 生产试运行 SOP v1.0

## 1. 目的

本文件冻结 `M5` 首轮单站真实试运行的执行口径。

当前只覆盖：

1. 站点：`MME`
2. 环境：`production`
3. 范围：`inbound bundle -> flight -> shipment -> awb -> task -> audit`

不在本版范围内：

1. 第二个站点
2. 出港试运行
3. 多站点复制
4. `M6` 数据质量治理扩面

## 2. 试运行对象

- 试运行站点：`MME`
- 试运行环境：`production`
- 登录账号：`supervisor@sinoport.local`
- 试运行角色：`station_supervisor`

## 3. 执行步骤

### 3.1 登录

1. 调用 `POST /api/v1/station/login`
2. 使用正式邮箱密码登录
3. 确认返回 `token`

### 3.2 导入

1. 调用 `POST /api/v1/station/imports/inbound-bundle`
2. 显式传入 `Idempotency-Key`
3. 提交 `MME inbound bundle`
4. 确认返回 `200`

### 3.3 对象链回读

导入成功后，依次回读：

1. `GET /api/v1/station/inbound/flights/:flightId`
2. `GET /api/v1/station/inbound/waybills/:awbId`
3. `GET /api/v1/station/shipments/:shipmentId`
4. `GET /api/v1/station/tasks`
5. `GET /api/v1/platform/audit/object?object_type=Flight&object_id=:flightId`

### 3.4 审计确认

必须确认审计链中存在：

- `STATION_INBOUND_BUNDLE_IMPORTED`

## 4. 通过标准

以下条件同时满足才算通过：

1. 正式登录返回 `200`
2. 正式导入返回 `200`
3. `flight / awb / shipment / tasks / audit` 回读全部返回 `200`
4. 任务列表中能找到导入生成的任务
5. 审计对象链中能找到 `STATION_INBOUND_BUNDLE_IMPORTED`

## 5. 失败处理

### 5.1 登录失败

1. 先检查账号密码
2. 再检查站点作用域是否为 `MME`
3. 若仍失败，暂停试运行，不继续导入

### 5.2 导入失败

1. 若返回 `VALIDATION_ERROR`
   - 判定为导入数据问题
   - 不做现场重试，先记录字段问题
2. 若返回 `IMPORT_IN_PROGRESS`
   - 等待当前请求完成后再重试
3. 其他错误
   - 记录 `request_id`
   - 停止继续试运行
   - 转入问题回收

### 5.3 对象链回读失败

1. 先记录失败对象类型和对象 ID
2. 再回查同一 `request_id` 的导入账本与审计链
3. 若对象读写不一致，停止继续放大试运行范围

## 6. 问题回收格式

每个问题至少记录：

1. `request_id`
2. 站点：`MME`
3. 环境：`production`
4. 对象类型
5. 对象 ID
6. 动作
7. 错误码 / 错误消息
8. 是否阻断后续试运行

## 7. 当前结论

`M5` 首轮单站试运行固定为：

- `MME`
- `production`
- `inbound bundle` 最小闭环

后续若扩大到第二个站点或出港链，必须另起新版 SOP。
