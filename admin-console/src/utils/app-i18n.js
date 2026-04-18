import enMessages from 'utils/locales/en.json';
import zhMessages from 'utils/locales/zh.json';

export const DEFAULT_APP_LANGUAGE = 'zh';
export const SUPPORTED_APP_LANGUAGES = ['zh', 'en'];

const exactZhToEnPairs = Object.entries(enMessages)
  .filter(([key, value]) => typeof key === 'string' && typeof value === 'string' && key && value)
  .map(([key, value]) => [key, value]);

const exactEnToZhPairs = exactZhToEnPairs.map(([zh, en]) => [en, zh]);

const sharedPhrasePairs = [
  ['中文', 'Chinese'],
  ['英文', 'English'],
  ['时间', 'Time'],
  ['区域', 'Region'],
  ['班次', 'Shift'],
  ['排班时段', 'Shift Slot'],
  ['人数', 'Headcount'],
  ['角色', 'Role'],
  ['状态', 'Status'],
  ['优先级', 'Priority'],
  ['控制层级', 'Control Level'],
  ['阶段', 'Phase'],
  ['操作', 'Actions'],
  ['创建', 'Create'],
  ['编辑', 'Edit'],
  ['保存', 'Save'],
  ['更新', 'Update'],
  ['取消', 'Cancel'],
  ['关闭', 'Close'],
  ['删除', 'Delete'],
  ['恢复', 'Restore'],
  ['归档', 'Archive'],
  ['领取', 'Accept'],
  ['开始', 'Start'],
  ['证据', 'Evidence'],
  ['完成', 'Complete'],
  ['搜索', 'Search'],
  ['筛选', 'Filter'],
  ['邮箱', 'Email'],
  ['密码', 'Password'],
  ['重置', 'Reset'],
  ['提交', 'Submit'],
  ['查看', 'View'],
  ['详情', 'Details'],
  ['总览', 'Overview'],
  ['说明', 'Description'],
  ['日报区块', 'Daily Section'],
  ['备注', 'Remarks'],
  ['暂无数据。', 'No data available.'],
  ['暂无数据', 'No data available'],
  ['暂无可展示的数据。', 'No data available.'],
  ['暂无可展示的数据', 'No data available'],
  ['名称', 'Name'],
  ['编码', 'Code'],
  ['类型', 'Type'],
  ['来源', 'Source'],
  ['负责人', 'Owner'],
  ['站点', 'Station'],
  ['站点总览', 'Station Overview'],
  ['站点代码', 'Station Code'],
  ['目的地', 'Destination'],
  ['计划件数', 'Planned Pieces'],
  ['计划重量', 'Planned Weight'],
  ['总箱数', 'Total Boxes'],
  ['托盘', 'pallet'],
  ['当前已录入', 'Recorded'],
  ['已装机', 'Loaded'],
  ['已记录拉货', 'Offload recorded'],
  ['班组', 'Team'],
  ['区位', 'Zone'],
  ['设备', 'Device'],
  ['车辆', 'Vehicle'],
  ['航班', 'Flight'],
  ['提单', 'AWB'],
  ['货物', 'Shipment'],
  ['单证', 'Document'],
  ['文件', 'Documents'],
  ['主文件', 'Master Files'],
  ['回执', 'Receipt'],
  ['任务', 'Task'],
  ['异常', 'Exception'],
  ['作业', 'Operations'],
  ['开始时间', 'Start Time'],
  ['结束时间', 'End Time'],
  ['更新时间', 'Updated At'],
  ['创建时间', 'Created At'],
  ['页', 'Page'],
  ['每页', 'Per Page'],
  ['共', 'Total'],
  ['条', 'items'],
  ['票', 'AWBs'],
  ['箱', 'boxes'],
  ['件', 'pieces'],
  ['上一页', 'Previous'],
  ['下一页', 'Next'],
  ['返回', 'Back'],
  ['确定', 'Confirm'],
  ['启用', 'Enabled'],
  ['停用', 'Disabled'],
  ['在线', 'Online'],
  ['离线', 'Offline'],
  ['正常', 'Normal'],
  ['警戒', 'Alert'],
  ['阻塞', 'Blocked'],
  ['待处理', 'Pending'],
  ['运行中', 'Running'],
  ['已完成', 'Completed'],
  ['已复核', 'Reviewed'],
  ['已归档', 'Archived'],
  ['已删除', 'Deleted'],
  ['待上传', 'Pending Upload'],
  ['待签字', 'Pending Signature'],
  ['已签字', 'Signed'],
  ['强控制', 'High Control'],
  ['协同控制', 'Coordinated Control'],
  ['接口可视', 'Visible by Interface'],
  ['样板优先', 'Pilot First'],
  ['已上线', 'Live'],
  ['高优先级', 'High Priority'],
  ['当前角色', 'Current Role'],
  ['进港能力', 'Inbound Capability'],
  ['出港能力', 'Outbound Capability'],
  ['设备', 'Device'],
  ['同步', 'Sync'],
  ['异常', 'Issues'],
  ['挂起', 'Suspended'],
  ['是', 'Yes'],
  ['否', 'No'],
  ['真实任务', 'Live Tasks'],
  ['快捷入口', 'Quick Links'],
  ['健康 / 关注', 'Healthy / Watch'],
  ['日报SECTION', 'Daily Section'],
  ['METRIC', 'Metric'],
  ['CURRENT SAMPLE', 'Current Sample'],
  ['网络Control台', 'Network Control Desk'],
  ['切换人工核对', 'switch to manual verification'],
  ['切人工锁定', 'switch to manual lock'],
  ['切短信兜底', 'switch to SMS fallback'],
  ['生成人工补录清单', 'generate manual completion list'],
  ['Restore回放', 'Resume replay'],
  ['导出VarianCe报告', 'export variance report'],
  ['接口日志', 'Integration Log'],
  ['Inbound机坪', 'Inbound Ramp'],
  ['OutboundStation', 'Outbound Station'],
  ['Station履约', 'Station Fulfillment'],
  ['干线Control', 'Linehaul Control'],
  ['Audit中台', 'Audit Hub'],
  ['值班Verify', 'on-duty review'],
  ['AWBsReCeipt待补', 'AWB receipts still need backfill'],
  ['Manifest 未冻结', 'Manifest is not frozen'],
  ['根据当前AWB Status决定YesNo允许发送', 'whether sending is allowed depends on the current AWB status'],
  ['已满足DoCument Gates', 'document gates are already satisfied'],
  ['Complete Breakdown 并补齐EvidenCe', 'complete breakdown and complete the evidence'],
  ['当前不可open departure arChive', 'departure archive cannot be opened yet'],
  ['继续跟踪开放Issue，并在日报中暴露趋势', 'Keep tracking open issues and expose the trend in the daily report'],
  ['全量重算', 'Full Recompute'],
  ['daily 接口按 reportDate 重新聚合同日ObjeCt、Audit与质量Result', 'The daily endpoint re-aggregates same-day objects, audits, and quality results by report date'],
  ['daily 接口按 reportDate 重新聚合同日ObjeCt、审计与质量Result', 'The daily endpoint re-aggregates same-day objects, audits, and quality results by report date'],
  ['按严重度排序Open日报、治理Page和月度复盘', 'Rank open daily reports, governance pages, and monthly reviews by severity'],
  ['维持开放Issue跟踪，不Triggers导入BloCker', 'Keep tracking open issues without triggering import blockers'],
  ['当日Not RequiredOpen质量Issue复盘', 'No quality issue review needs to be opened today'],
  ['最近异常', 'Latest Issue'],
  ['最近补传结果', 'Latest Sync Result'],
  ['待补传队列', 'Pending Sync Queue'],
  ['queued', 'queued'],
  ['syncing', 'syncing'],
  ['synced', 'synced'],
  ['failed', 'failed'],
  ['恢复在线', 'Back Online'],
  ['模拟离线', 'Go Offline'],
  ['立即补传', 'Sync Now'],
  ['上报异常', 'Report Issue'],
  ['挂起任务', 'Suspend Task'],
  ['恢复任务', 'Resume Task'],
  ['节点', 'Node'],
  ['节点选择', 'Node Selection'],
  ['当前节点', 'Current Node'],
  ['当前阶段', 'Current Stage'],
  ['航班列表', 'Flight List'],
  ['放行角色', 'Release Role'],
  ['推荐', 'Recommended'],
  ['当前角色推荐节点', 'Recommended Nodes'],
  ['全部执行节点', 'All Nodes'],
  ['正在加载', 'Loading'],
  ['正在加载节点配置', 'Loading node configuration'],
  ['正在从后端读取当前角色可用的节点列表和推荐入口。', 'Loading available nodes and recommended entry points for the current role from the backend.'],
  ['按当前角色能力优先显示建议进入的节点，帮助现场人员更快找到自己的任务入口。', 'Recommended nodes are shown first based on the current role so operators can reach the right tasks faster.'],
  ['如果需要跨节点查看任务或支援其它岗位，也可以从全部节点中进入。', 'If cross-node visibility or support is needed, open any node from the full list below.'],
  ['暂无可展示的节点配置。', 'No node configuration available.'],
  ['移动端登录成功', 'Mobile login succeeded'],
  ['移动端登录失败', 'Mobile login failed'],
  ['登录选项加载失败', 'Failed to load login options'],
  ['通用动作层', 'Ops Layer'],
  ['当前对象', 'Current Object'],
  ['显示已归档', 'Show archived'],
  ['新建货站', 'New Station'],
  ['新增货站', 'New Station'],
  ['进入货站系统', 'Open Station'],
  ['当前条件下没有站点数据。', 'No stations found for the current filters.'],
  ['请先补齐站点编码、名称、区域、控制层级和阶段。', 'Complete the station code, name, region, control level, and phase first.'],
  ['站点保存失败，请稍后重试。', 'Failed to save the station. Please try again later.'],
  ['站点归档状态更新失败，请稍后重试。', 'Failed to update the station archive state. Please try again later.'],
  ['表单字段已切到真实数据库写入。', 'Form fields now write directly to the live database.'],
  ['货站名称', 'Station Name'],
  ['货站编码', 'Station Code'],
  ['机场代码', 'Airport Code'],
  ['ICAO 代码', 'ICAO Code'],
  ['默认 Owner', 'Default Owner'],
  ['服务范围', 'Service Scope'],
  ['站点编码创建后不可修改。', 'The station code cannot be changed after creation.'],
  ['建议使用 IATA 站点编码。', 'Use the IATA station code where possible.'],
  ['请选择控制层级', 'Select control level'],
  ['请选择阶段', 'Select phase'],
  ['请选择 Owner', 'Select owner'],
  ['保存站点', 'Save Station'],
  ['创建站点租户', 'Create Station Tenant'],
  ['返回站点总览', 'Back to Station Overview'],
  ['班组映射', 'Team Mapping'],
  ['区位映射', 'Zone Mapping'],
  ['设备映射', 'Device Mapping'],
  ['站点设备映射', 'Station Device Mapping'],
  ['设备台账', 'Device Registry'],
  ['设备对象已切到正式表，平台可以维护站点归属、设备类型、绑定角色、Owner 班组和状态。', 'Devices now come from formal tables, and the platform can maintain station ownership, device type, bound role, owner team, and status.'],
  ['设备列表已切到数据库分页；默认每页 20 条，筛选与表单下拉全部来自后端选项接口。', 'The device registry now uses database pagination with 20 rows per page, and all filters and form selects come from backend option APIs.'],
  ['设备编码 / 站点 / 类型 / 角色 / Owner', 'Device code / station / type / role / owner'],
  ['所属站点', 'Station'],
  ['设备类型', 'Device Type'],
  ['绑定角色', 'Bound Role'],
  ['全部站点', 'All Stations'],
  ['全部类型', 'All Types'],
  ['全部角色', 'All Roles'],
  ['全部状态', 'All Statuses'],
  ['新建设备', 'New Device'],
  ['设备台账加载失败，请检查后端连接。', 'Failed to load the device registry. Check the backend connection.'],
  ['设备编码', 'Device Code'],
  ['未配置备注', 'No remark configured'],
  ['当前条件下没有设备数据。', 'No devices found for the current filters.'],
  ['新增设备', 'New Device'],
  ['所属站点、设备类型、绑定角色、Owner 班组、状态全部来自数据库选项接口；创建和更新都会写审计。', 'Station, device type, bound role, owner team, and status all come from database-backed option APIs; create and update operations both write audit events.'],
  ['请选择站点', 'Select station'],
  ['请选择设备类型', 'Select device type'],
  ['请选择绑定角色', 'Select bound role'],
  ['Owner 班组', 'Owner Team'],
  ['请选择 Owner 班组', 'Select owner team'],
  ['请选择状态', 'Select status'],
  ['保存设备', 'Save Device'],
  ['创建设备', 'Create Device'],
  ['备注', 'Remarks'],
  ['请先补齐设备编码、所属站点、类型、绑定角色、Owner 和状态。', 'Complete the device code, station, type, bound role, owner, and status first.'],
  ['设备保存失败，请稍后重试。', 'Failed to save the device. Please try again later.'],
  ['设备归档状态更新失败，请稍后重试。', 'Failed to update the device archive state. Please try again later.'],
  ['货站后台总览', 'Station Operations Overview'],
  ['货站首页优先展示今天的航班、阻塞节点、NOA/POD 队列、待复核任务和二次转运动作，而不是传统 ERP 菜单。', 'The station home focuses on today’s flights, blocking nodes, NOA/POD queues, review tasks, and transfer actions instead of a traditional ERP menu.'],
  ['看板', 'Overview'],
  ['运达', 'Arrived'],
  ['已卸机', 'Unloaded'],
  ['已入货站', 'Station Received'],
  ['拆板理货中', 'Breakdown Counting'],
  ['NOA 已发送', 'NOA Sent'],
  ['已交付', 'Delivered'],
  ['已Airborne', 'Airborne'],
  ['Loading计划 + 文档回写', 'Loading Plan + Document Backfill'],
  ['到货', 'Arrival'],
  ['个目的港', 'destinations'],
  ['已预报', 'Forecasted'],
  ['已接收', 'Received'],
  ['主单完成', 'Master AWB Completed'],
  ['装载中', 'Loading'],
  ['已飞走', 'Departed'],
  ['Manifest 回传', 'Manifest Returned'],
  ['无差异', 'No Variance'],
  ['DOCUMENT台账', 'Document Registry'],
  ['单证台账', 'Document Registry'],
  ['数据库读源', 'Database Source'],
  ['Restore流程', 'Restore Flow'],
  ['当前Page / 总数', 'Current Page / Total'],
  ['待ACCeptTask', 'Pending Accept Tasks'],
  ['总Task', 'Total Tasks'],
  ['带 Gate 或ExCeption的Task', 'Tasks with Gates or Exceptions'],
  ['到港收货', 'Arrival Receiving'],
  ['理货复核', 'Count Review'],
  ['出港收货', 'Outbound Receiving'],
  ['装机复核', 'Loading Review'],
  ['货站层 KPI / 报表', 'Station KPI / Reports'],
  ['展示货站层 KPI 和班次报表，为第二批主演示链路提供日报 / 周报前端 demo。', 'Show station KPIs and shift reports for daily and weekly reporting demos.'],
  ['按站内TaskComplete时长统计', 'Based on station task completion duration'],
  ['按站内任务完成时长统计', 'Based on station task completion duration'],
  ['装车 / 机坪 / TransferTaskVerify一致率', 'Truck loading / ramp / transfer task verification consistency'],
  ['已签收并CompleteArChive的比例', 'Share of signed and archived completions'],
  ['ExCeption从提出到Restore的平均耗时', 'Average duration from exception raised to restore'],
  ['任务流转', 'Task Flow'],
  ['完成 / 阻断 / 超时', 'Completed / Blocked / Timed Out'],
  ['日报任务已纳入当日范围', 'daily report tasks included in today’s scope'],
  ['异常分布', 'Exception Distribution'],
  ['开放 / 阻断 / 已关闭', 'Open / Blocking / Closed'],
  ['文档闭环', 'Document Closure'],
  ['关键 / 已批 / 缺失', 'Critical / Approved / Missing'],
  ['条审计事件参与文件回看', 'audit events included in document trace-back'],
  ['PDA 关键指标', 'PDA Key Metrics'],
  ['接单 / 到场 / 完成', 'Accepted / Arrived / Completed'],
  ['证据上传完整率', 'Evidence Upload Completeness'],
  ['异常首次反馈', 'First Exception Feedback'],
  ['完成数', 'Completed Count'],
  ['装车准确率', 'Loading Accuracy'],
  ['异常时长', 'Exception Duration'],
  ['关键文件缺失', 'Missing Critical Files'],
  ['文件版本替换', 'Document Version Replacement'],
  ['文件生效时间', 'Document Effective Time'],
  ['下载与预览审计', 'Download and Preview Audit'],
  ['当前只做前端动作记录。', 'Only frontend action logging is currently recorded.'],
  ['会话列表', 'Sessions'],
  ['会话', 'Sessions'],
  ['站点 Copilot', 'Station Copilot'],
  ['货站总览', 'Station Overview'],
  ['建议步骤', 'Suggested Steps'],
  ['正在加载 Copilot 会话。', 'Loading Copilot session.'],
  ['当前没有可用建议步骤。', 'No suggested steps are currently available.'],
  ['当前没有待补传动作。', 'There are no pending sync actions.'],
  ['当前对象还没有审计记录。', 'There are no audit records for the current object yet.'],
  ['工具入参不是合法 JSON。', 'Tool input is not valid JSON.'],
  ['工具执行失败', 'Tool execution failed'],
  ['最近结果', 'Latest Result'],
  ['消息流会记录本地输入、工具执行结果和实时上下文摘要。', 'The message stream records local input, tool results, and live context summaries.'],
  ['Role ReCeipt员', 'Role Receiver'],
  ['前置仓ReCeipt', 'Pre-warehouse Receiving'],
  ['处理前置仓ReCeipt、PieCes / WeightConfirm、ExCeption标记和冻结Release。', 'Handle pre-warehouse receiving, pieces/weight confirmation, exception tagging, and release freeze.'],
  ['处理 CMR、Driver、TruCk Plate、发车和到站交接。', 'Handle CMR, driver, truck plate, dispatch, and arrival handover.'],
  ['沿用现YesOutboundLane，处理ReCeipt、理货、组板、DoCument核对。', 'Use the current outbound lane to handle receiving, counting, pallet building, and document checks.'],
  ['Outbound机坪', 'Outbound Ramp'],
  ['处理Transfer、Loaded Confirm和装机EvidenCe上传。', 'Handle transfer, loaded confirmation, and loading evidence upload.'],
  ['Flight运行', 'Flight Runtime'],
  ['处理 Airborne / Landed 的只读Confirm与ExCeption上报入口。', 'Handle read-only airborne/landed confirmation and exception reporting.'],
  ['处理到港接机、机坪Release和转入Station。', 'Handle arrival ramp receipt, ramp release, and transfer into station.'],
  ['沿用现YesInboundLane，处理拆板、理货、组托和装车。', 'Use the current inbound lane to handle breakdown, counting, palletizing, and truck loading.'],
  ['处理Driver / TruCk Plate登记、装车Verify、发车和交接文件。', 'Handle driver/truck plate registration, loading verification, dispatch, and handover documents.'],
  ['交付仓', 'Delivery Warehouse'],
  ['处理签收、POD 双签、ExCeption签收和Close校验。', 'Handle sign-off, POD dual-signature, exception sign-off, and closure validation.'],
  ['主管 / Verify岗', 'Supervisor / Verify'],
  ['飞走归档', 'Departure Archive'],
  ['已导入', 'Imported'],
  ['待Verify', 'Pending Verify'],
  ['计划', 'Planned'],
  ['目标', 'Target'],
  ['导入闸口状态', 'Import Gate Status'],
  ['当前没有可见的出港航班。', 'No outbound flights are currently visible.'],
  ['任务动作', 'Task Action'],
  ['POD 双签', 'POD Dual Signature'],
  ['处理签收、POD Dual Signature、ExCeption签收和Close校验。', 'Handle sign-off, POD dual-signature, exception sign-off, and closure validation.'],
  ['NOA 门槛', 'NOA Gate'],
  ['航班落地 -> 进港处理', 'Flight landed -> inbound handling'],
  ['允许生成 PMC 拆板、理货、分区任务', 'Allows PMC breakdown, counting, and zoning tasks'],
  ['板号 / 件数核对记录', 'Pallet ID / piece verification record'],
  ['允许 NOA 与二次转运推进', 'Allows NOA and secondary transfer progression'],
  ['补齐差异复核并更新计数结果', 'Complete variance verification and update the counting result'],
  ['装车 / POD -> 交付关闭', 'Truck loading / POD -> delivery closure'],
  ['允许二次转运与交付关闭', 'Allows secondary transfer and delivery closure'],
  ['补齐 POD 双签并回写签收状态', 'Complete POD dual signature and backfill receipt status'],
  ['货物预报 -> 主单冻结', 'Cargo Forecast -> Master Freeze'],
  ['FFM / Manifest / 主单对账', 'FFM / Manifest / Master Reconciliation'],
  ['允许装载编排与飞走归档', 'Allows loading planning and departure archive'],
  ['等待 FFM 与主单数据进入', 'Waiting for FFM and master data to arrive'],
  ['补齐预报并生成主单', 'Complete forecast and generate master'],
  ['主单 -> 装载放行', 'Master -> Loading Release'],
  ['Loaded / 车牌 / 司机', 'Loaded / Truck Plate / Driver'],
  ['允许装载与航空器放行', 'Allows loading and aircraft release'],
  ['补齐车牌、司机与复核记录', 'Complete truck plate, driver, and verification records'],
  ['装载 -> 飞走 / 回传', 'Loading -> Airborne / Return'],
  ['Airborne / 回执 / 对账', 'Airborne / Receipt / Reconciliation'],
  ['允许关闭与目的港对账', 'Allows closure and destination reconciliation'],
  ['补齐回执并回写重量', 'Complete receipts and backfill weight'],
  ['待生成状态，不能进入飞走归档。', 'The status is still pending generation and cannot enter departure archive.'],
  ['缺少 Loaded 照片与独立复核签名。', 'Loaded photos and an independent verification signature are missing.'],
  ['接单时长', 'Acceptance Duration'],
  ['到场时长', 'Arrival Duration'],
  ['任务完成时长', 'Task Completion Duration'],
  ['证据上传完整率', 'Evidence Upload Completeness'],
  ['异常首次反馈时长', 'First Exception Feedback Duration'],
  ['暂无质量问题', 'No quality issues'],
  ['质量检查表', 'Quality Checklist'],
  ['检查项', 'Check Item'],
  ['数据质量', 'Data Quality'],
  ['总量 / 阻断 / 分数', 'Total / Blockers / Score'],
  ['日终锚点', 'End-of-day Anchor'],
  ['默认刷新模式', 'Default Refresh Mode'],
  ['全量重算', 'Full Recompute'],
  ['补算范围', 'Backfill Scope'],
  ['质量回链', 'Quality Backlink'],
  ['对象回链', 'Object Backlink'],
  ['关键指标应可回查到对象详情页', 'Key metrics should link back to object detail pages'],
  ['站点 MME 日报必须显式暴露质量摘要与检查表', 'The Station MME daily report must explicitly expose the quality summary and checklist'],
  ['10 AWBs已OpenInbound处理池', '10 AWBs entered the inbound handling pool'],
  ['6 个待CompleteTask', '6 tasks pending completion'],
  ['0/10 AWBsCompleted POD/交付', '0/10 AWBs completed POD/delivery'],
  ['Flight落地 -> Inbound处理', 'Flight landed -> inbound handling'],
  ['Release Result: 允许生成 PMC 拆板、理货、分区Task', 'Release Result: allows PMC breakdown, counting, and zoning tasks'],
  ['PMC 拆板 -> 理货Complete', 'PMC breakdown -> counting complete'],
  ['Required DoCuments: 板号 / PieCes核对记录', 'Required Documents: pallet ID / piece verification record'],
  ['Release Result: 允许 NOA 与二次Transfer推进', 'Release Result: allows NOA and secondary transfer progression'],
  ['ReCovery ACtion: 补齐VarianCeVerify并Update计数Result', 'Recovery Action: complete variance verification and update the count result'],
  ['装车 / POD -> 交付Close', 'Truck loading / POD -> delivery closure'],
  ['Release Result: 允许二次Transfer与交付Close', 'Release Result: allows secondary transfer and delivery closure'],
  ['BloCking Reason: 9 AWBs POD 仍待ArChive', 'Blocking Reason: 9 AWB POD records are still pending archive'],
  ['ReCovery ACtion: 补齐 POD Dual Signature并回写ReCeipt Status', 'Recovery Action: complete POD dual signature and backfill receipt status'],
  ['LoadingPlanned + 文档回写', 'Loading Planned + document backfill'],
  ['5 AWBs AWB 已OpenForeCast池', '5 AWBs entered the forecast pool'],
  ['1/5 AWBsCompleted接收', '1/5 AWBs completed receiving'],
  ['等待Loading编排', 'Waiting for loading planning'],
  ['HG-01 · ShipmentForeCast -> Master冻结', 'HG-01 · shipment forecast -> master freeze'],
  ['已ReCeipt', 'Received'],
  ['待装机', 'Pending Loading'],
  ['ShipmentForeCast -> Master冻结', 'Shipment Forecast -> master freeze'],
  ['Required DoCuments: FFM / Manifest / Master对账', 'Required Documents: FFM / manifest / master reconciliation'],
  ['Release Result: 允许Loading编排与Departure ArChive', 'Release Result: allows loading planning and departure archive'],
  ['BloCking Reason: 等待 FFM 与Master数据Open', 'Blocking Reason: waiting for FFM and master data opening'],
  ['ReCovery ACtion: 补齐ForeCast并生成Master', 'Recovery Action: complete forecast and generate master'],
  ['Release Result: 允许Loading与航空器Release', 'Release Result: allows loading and aircraft release'],
  ['ReCovery ACtion: 补齐TruCk Plate、Driver与Verify记录', 'Recovery Action: complete truck plate, driver, and verification records'],
  ['Loading -> Airborne / 回传', 'Loading -> airborne / return'],
  ['Required DoCuments: Airborne / 回执 / 对账', 'Required Documents: airborne / receipt / reconciliation'],
  ['Release Result: 允许Close与目的港对账', 'Release Result: allows closure and destination reconciliation'],
  ['BloCking Reason: 4 AWBs回执待补', 'Blocking Reason: 4 AWB receipts still need backfill'],
  ['ReCovery ACtion: 补齐回执并回写Weight', 'Recovery Action: complete receipts and backfill weight'],
  ['SE913 Manifest 最终版待冻结', 'SE913 manifest final version pending freeze'],
  ['Task Flow\tCompleted / BloCked / Timed Out\t3 / 3 / 4\t9 个daily report tasks inCluded in today’s sCope', 'Task Flow\tCompleted / Blocked / Timed Out\t3 / 3 / 4\t9 daily report tasks included in today’s scope'],
  ['接单时长\t1046m\t<= 5m\tTask派发到接单Confirm的平均时长。', 'Acceptance Duration\t1046m\t<= 5m\tAverage time from task dispatch to acceptance confirmation.'],
  ['到场时长\t0m\t<= 10m\tTaskCreate到到场/到站回传的平均时长。', 'Arrival Duration\t0m\t<= 10m\tAverage time from task creation to arrival/station feedback.'],
  ['TaskComplete时长\t1046m\t<= 25m\tStart到Complete的平均时长。', 'Task Completion Duration\t1046m\t<= 25m\tAverage time from start to complete.'],
  ['EvidenCe Upload Completeness\t25%\t>= 95%\t需照片 / Sign / SCan的Task样例口径。', 'Evidence Upload Completeness\t25%\t>= 95%\tSample scope for tasks requiring photos / signatures / scans.'],
  ['First ExCeption FeedbaCk时长\t1046m\t<= 8m\t发现ExCeption到首次反馈的平均时长。', 'First Exception Feedback Duration\t1046m\t<= 8m\tAverage time from exception detection to first feedback.'],
  ['Missing CritiCal Files\tUWS / FLIGHT-SE913-2026-04-09-MME\t4 items未满足Releaseitems件\t覆盖 28 份关键文档。', 'Missing Critical Files\tUWS / FLIGHT-SE913-2026-04-09-MME\t4 items do not meet release conditions\tCovering 28 critical documents.'],
  ['DoCument Version ReplaCement\tManifest / AWB-436-10358585\tv1 生效 / v1 待发布\t最新文件 integration-manifest.pdf', 'Document Version Replacement\tManifest / AWB-436-10358585\tv1 effective / v1 pending release\tLatest file integration-manifest.pdf'],
  ['DoCument EffeCtive Time\tUWS / Manifest\t2026-04-17 13:19 / 2026-04-17 13:19\t按最近Update的关键文件排序。', 'Document Effective Time\tUWS / Manifest\t2026-04-17 13:19 / 2026-04-17 13:19\tSorted by the most recently updated critical file.'],
  ['Download and Preview Audit\tDoCument / 审计\t0 次Preview / 0 次Download\tOnly frontend aCtion logging is Currently reCorded.', 'Download and Preview Audit\tDocument / Audit\t0 previews / 0 downloads\tOnly frontend action logging is currently recorded.'],
  ['数据质量\t总量 / BloCker / 分数\t0 / 0 / 100\t暂None质量Issue', 'Data Quality\tTotal / Blockers / Score\t0 / 0 / 100\tNo quality issues at the moment'],
  ['SECTION\t检查项\tCURRENT VALUE\tACTIONS', 'Section\tCheck Item\tCurrent Value\tActions'],
  ['Quality CheCkList\tImport Gate Status\t当日未发现开放中的质量Issue\t继续执行日报巡检，None需额外BloCking ACtion', 'Quality Checklist\tImport Gate Status\tNo open quality issues found today\tContinue daily inspection; no extra blocking action required'],
  ['Quality CheCkList\tBloCker候选规则\t暂None默认BloCker候选规则命中\t维持开放Issue跟踪，不触发导入BloCker', 'Quality Checklist\tBlocker Candidate Rules\tNo default blocker candidates matched at the moment\tKeep tracking open issues without triggering import blockers'],
  ['Quality CheCkList\tIssue复盘入口\t暂None开放Issue\t当日None需Open质量Issue复盘', 'Quality Checklist\tIssue Review Entry\tNo open issues at the moment\tNo quality issue review needs to be opened today'],
  ['Refresh Rules\t日终AnChor\t2026-04-17T23:59:59.999Z\tStation MME日报按 2026-04-17 日终AnChor冻结统计窗口', 'Refresh Rules\tEnd-of-day Anchor\t2026-04-17T23:59:59.999Z\tStation MME daily report freezes the statistics window at the 2026-04-17 end-of-day anchor'],
  ['Refresh Rules\t默认刷新模式\t全量重算\tdaily 接口按 reportDate 重新聚合同日ObjeCt、审计与质量Result', 'Refresh Rules\tDefault Refresh Mode\tFull Recompute\tThe daily endpoint re-aggregates same-day objects, audits, and quality results by report date'],
  ['Refresh Rules\t补算范围\tStation MME + 日期\t仅允许在同一 reportDate 内补算，不跨日扩散', 'Refresh Rules\tBackfill Scope\tStation MME + date\tBackfill is limited to the same report date and does not expand across days'],
  ['追溯关系\t质量回链\tqualitySummary / qualityChecklist\t站点 MME日报必须显式暴露质量摘要与检查表', 'Traceability\tQuality Backlink\tqualitySummary / qualityChecklist\tThe Station MME daily report must explicitly expose the quality summary and checklist'],
  ['追溯关系\t对象回链\tFlight / AWB / Shipment / Exception\t关键指标应可回查到对象详情页', 'Traceability\tObject Backlink\tFlight / AWB / Shipment / Exception\tKey metrics should link back to object detail pages'],
  ['10 AWBs已the inbound handling pool', '10 AWBs entered the inbound handling pool'],
  ['BloCking Reason: 9 AWBs POD 仍待ArChive', 'Blocking Reason: 9 AWB POD records are still pending archive'],
  ['5 AWBs AWB 已the foreCast pool', '5 AWBs entered the forecast pool'],
  ['等待Loading planning', 'Waiting for loading planning'],
  ['BloCking Reason: 9 AWBs POD 仍待ArChive', 'Blocking Reason: 9 AWB POD records are still pending archive'],
  ['436-10357583\tULD-INT-001\t20\t201\t待装机\tMST', '436-10357583\tULD-INT-001\t20\t201\tPending Loading\tMST'],
  ['Manifest 仍为The status is still pending generation and Cannot enter departure arChive.', 'Manifest is still in pending generation status and cannot enter departure archive.'],
  ['按站内Task Completion Duration统计', 'Based on station task completion duration'],
  ['4 itemsdo not meet release Conditions', '4 items do not meet release conditions'],
  ['v1 生效 / v1 待发布', 'v1 effective / v1 pending release'],
  ['最新文件', 'Latest file'],
  ['0 次Preview / 0 次Download', '0 previews / 0 downloads'],
  ['BloCker候选规则', 'Blocker Candidate Rules'],
  ['Issue复盘入口', 'Issue Review Entry'],
  ['Station MME日报按 2026-04-17 End-of-day AnChor冻结统计窗口', 'Station MME daily report freezes the statistics window at the 2026-04-17 end-of-day anchor'],
  ['daily 接口按 reportDate re-aggregates same-day objeCts, audits, and quality results', 'The daily endpoint re-aggregates same-day objects, audits, and quality results by report date'],
  ['Station MME + 日期', 'Station MME + Date'],
  ['追溯关系', 'Traceability'],
  ['质量回链', 'Quality Backlink'],
  ['审计回链', 'Audit Backlink'],
  ['关键状态变化与导入链必须能回查到审计事件', 'Key status changes and import chains must link back to audit events'],
  ['OutboundACtions深化Summary', 'Outbound Action Deepening Summary'],
  ['覆盖 28 份关键文档。', 'Covering 28 critical documents.'],
  ['5 AWBs AWB 已the foreCast pool', '5 AWBs entered the forecast pool'],
  ['等待Loading planning', 'Waiting for loading planning'],
  ['436-10357583\tULD-INT-001\t20\t201\t待装机\tMST', '436-10357583\tULD-INT-001\t20\t201\tPending Loading\tMST'],
  ['Task Flow\tCompleted / BloCked / Timed Out\t3 / 3 / 4\t9 个daily report tasks inCluded in today’s sCope', 'Task Flow\tCompleted / Blocked / Timed Out\t3 / 3 / 4\t9 daily report tasks included in today’s scope'],
  ['Download and Preview Audit\tDoCument / 审计\t0 previews / 0 downloads\tOnly frontend aCtion logging is Currently reCorded.', 'Download and Preview Audit\tDocument / Audit\t0 previews / 0 downloads\tOnly frontend action logging is currently recorded.'],
  ['Refresh Rules\tDefault Refresh Mode\tFull ReCompute\tdaily 接口按 reportDate re-aggregates same-day objeCts, audits, and quality results', 'Refresh Rules\tDefault Refresh Mode\tFull Recompute\tThe daily endpoint re-aggregates same-day objects, audits, and quality results by report date'],
  ['追溯关系\t质量回链\tqualitySummary / qualityChecklist\t站点 MME日报必须显式暴露质量摘要与检查表', 'Traceability\tQuality Backlink\tqualitySummary / qualityChecklist\tThe Station MME daily report must explicitly expose the quality summary and checklist'],
  ['追溯关系\t对象回链\tFlight / AWB / Shipment / Exception\t关键指标应可回查到对象详情页', 'Traceability\tObject Backlink\tFlight / AWB / Shipment / Exception\tKey metrics should link back to object detail pages'],
  ['追溯关系\t审计回链\taudit/object / audit/events\t关键状态变化与导入链必须能回查到审计事件', 'Traceability\tAudit Backlink\taudit/object / audit/events\tKey status changes and import chains must link back to audit events'],
  ['daily 接口按 reportDate re-aggregates same-day objeCts, audits, and quality results', 'The daily endpoint re-aggregates same-day objects, audits, and quality results by report date'],
  ['Station MME日报Required显式暴露质量Summary与检查表', 'The Station MME daily report must explicitly expose the quality summary and checklist'],
  ['进港管理', 'Inbound Operations'],
  ['出港管理', 'Outbound Operations'],
  ['作业指令中心', 'Task Command Center'],
  ['单证与指令中心', 'Documents & Commands'],
  ['当前执行阻断', 'Current Execution Blockers'],
  ['今日进港航班', 'Today Inbound Flights'],
  ['当前节点', 'Current Node'],
  ['货量', 'Cargo'],
  ['进入', 'Open'],
  ['今日出港航班', 'Today Outbound Flights'],
  ['待复核任务', 'Review Queue'],
  ['阻塞任务', 'Blocked Tasks'],
  ['二次转运待办', 'Transfer Queue'],
  ['转运单号', 'Transfer ID'],
  ['目的站', 'Destination'],
  ['车辆', 'Vehicle'],
  ['返回网络总览', 'Back to Network Overview'],
  ['网络总览', 'Network Overview'],
  ['标准场景', 'Standard Scenarios'],
  ['链路模板', 'Lane Templates'],
  ['链路对象已切到正式表，平台可以直接维护起止站点、节点顺序、SLA、控制深度和链路状态。', 'Lane objects now come from formal tables, and the platform can directly maintain origin and destination stations, node order, SLA, control depth, and lane status.'],
  ['链路台账', 'Lane Registry'],
  ['链路列表已切到数据库分页；默认每页 20 条，筛选和表单下拉均来自后端 options 接口。', 'The lane registry now uses database pagination with 20 rows per page, and all filters and form selects come from backend option APIs.'],
  ['链路编码 / 名称 / 节点顺序 / SLA / 站点', 'Lane code / name / node order / SLA / station'],
  ['关联站点', 'Related Station'],
  ['控制深度', 'Control Depth'],
  ['全部控制深度', 'All Control Depths'],
  ['新建链路', 'New Lane'],
  ['链路台账加载失败，请检查后端连接。', 'Failed to load the lane registry. Check the backend connection.'],
  ['链路编码', 'Lane Code'],
  ['链路', 'Lane'],
  ['站点路径', 'Station Path'],
  ['未配置业务模式', 'No business mode configured'],
  ['当前条件下没有链路数据。', 'No lanes found for the current filters.'],
  ['新增链路', 'New Lane'],
  ['起站、中转站、终站、控制深度和状态全部来自数据库选项源；创建和更新都会写审计。', 'Origin, via, destination, control depth, and status all come from database-backed option sources; create and update operations both write audit events.'],
  ['链路名称', 'Lane Name'],
  ['业务模式', 'Business Mode'],
  ['起站', 'Origin Station'],
  ['请选择起站', 'Select origin station'],
  ['中转站', 'Via Station'],
  ['无中转站', 'No Via Station'],
  ['终站', 'Destination Station'],
  ['请选择终站', 'Select destination station'],
  ['节点顺序', 'Node Order'],
  ['关键事件', 'Key Events'],
  ['请选择控制深度', 'Select control depth'],
  ['保存链路', 'Save Lane'],
  ['创建链路', 'Create Lane'],
  ['请先补齐链路编码、名称、起止站点、节点顺序、SLA、控制深度和状态。', 'Complete the lane code, name, origin and destination stations, node order, SLA, control depth, and status first.'],
  ['链路保存失败，请稍后重试。', 'Failed to save the lane. Please try again later.'],
  ['链路归档状态更新失败，请稍后重试。', 'Failed to update the lane archive state. Please try again later.'],
  ['标准场景模板', 'Standard Scenario Templates'],
  ['场景对象已切到正式表，平台可以直接维护场景分类、链路归属、主站点、进入规则和证据链。', 'Scenario objects now come from formal tables, and the platform can directly maintain scenario category, lane ownership, primary station, entry rules, and evidence chains.'],
  ['场景台账', 'Scenario Registry'],
  ['场景列表已切到数据库分页；默认每页 20 条，筛选和表单下拉均来自后端 options 接口。', 'The scenario registry now uses database pagination with 20 rows per page, and all filters and form selects come from backend option APIs.'],
  ['场景编码 / 名称 / 节点 / 规则 / 证据 / 链路', 'Scenario code / name / nodes / rule / evidence / lane'],
  ['全部链路', 'All Lanes'],
  ['主站点', 'Primary Station'],
  ['分类', 'Category'],
  ['全部分类', 'All Categories'],
  ['新建场景', 'New Scenario'],
  ['场景台账加载失败，请检查后端连接。', 'Failed to load the scenario registry. Check the backend connection.'],
  ['场景编码', 'Scenario Code'],
  ['场景', 'Scenario'],
  ['链路 / 主站点', 'Lane / Primary Station'],
  ['节点与规则', 'Nodes & Rules'],
  ['证据链', 'Evidence Chain'],
  ['当前条件下没有场景数据。', 'No scenarios found for the current filters.'],
  ['新增场景', 'New Scenario'],
  ['链路、主站点、分类和状态全部来自数据库选项源；创建和更新都会写审计。', 'Lane, primary station, category, and status all come from database-backed option sources; create and update operations both write audit events.'],
  ['场景名称', 'Scenario Name'],
  ['场景分类', 'Scenario Category'],
  ['请选择分类', 'Select category'],
  ['关联链路', 'Related Lane'],
  ['请选择链路', 'Select lane'],
  ['请选择主站点', 'Select primary station'],
  ['节点序列', 'Node Sequence'],
  ['进入规则', 'Entry Rule'],
  ['证据要求', 'Evidence Requirements'],
  ['保存场景', 'Save Scenario'],
  ['创建场景', 'Create Scenario'],
  ['请先补齐场景编码、名称、分类、链路、主站点、节点、进入规则、证据要求和状态。', 'Complete the scenario code, name, category, lane, primary station, nodes, entry rule, evidence requirements, and status first.'],
  ['场景保存失败，请稍后重试。', 'Failed to save the scenario. Please try again later.'],
  ['场景归档状态更新失败，请稍后重试。', 'Failed to update the scenario archive state. Please try again later.'],
  ['审计与可信留痕', 'Audit & Traceability'],
  ['规则台账', 'Rule Registry'],
  ['规则列表已切到数据库分页；默认每页 20 条，筛选与表单下拉全部来自后端 options 接口。', 'The rule registry now uses database pagination with 20 rows per page, and all filters and form selects come from backend option APIs.'],
  ['规则编码 / 名称 / 摘要 / 触发条件 / 关联对象', 'Rule code / name / summary / trigger condition / related object'],
  ['规则类型', 'Rule Type'],
  ['全部层级', 'All Levels'],
  ['适用范围', 'Applicability Scope'],
  ['全部范围', 'All Scopes'],
  ['新建规则', 'New Rule'],
  ['规则台账加载失败，请检查后端连接。', 'Failed to load the rule registry. Check the backend connection.'],
  ['正在从数据库加载规则下拉选项…', 'Loading rule options from the database...'],
  ['规则编码', 'Rule Code'],
  ['规则名称', 'Rule Name'],
  ['关联对象', 'Related Object'],
  ['时间线阶段', 'Timeline Stage'],
  ['当前筛选条件下没有规则记录。', 'No rules found for the current filters.'],
  ['规则类型概览', 'Rule Type Overview'],
  ['来自正式表的聚合 DTO。', 'Aggregated DTOs from formal tables.'],
  ['控制层级：', 'Control Level: '],
  ['暂无规则类型统计。', 'No rule type statistics yet.'],
  ['规则时间线', 'Rule Timeline'],
  ['主读源为正式规则表聚合，不再使用 scenarioTimelineRows。', 'The primary source is the formal rule table aggregation, not scenarioTimelineRows.'],
  ['暂无时间线聚合数据。', 'No timeline aggregates yet.'],
  ['规则表单字段全部写入正式 `platform_rules` 表，业务下拉均来自数据库选项源。', 'All rule form fields write to the formal `platform_rules` table, and business selects all come from database-backed option sources.'],
  ['建议使用全大写编码，例如 RULE-GATE-001。', 'Use an uppercase code such as RULE-GATE-001.'],
  ['服务等级', 'Service Level'],
  ['适用站点', 'Applicable Station'],
  ['适用链路', 'Applicable Lane'],
  ['适用场景', 'Applicable Scenario'],
  ['服务等级规则必填。', 'Required for service-level rules.'],
  ['非服务等级规则可留空。', 'Optional for non-service-level rules.'],
  ['无', 'None'],
  ['规则摘要', 'Rule Summary'],
  ['触发条件', 'Trigger Condition'],
  ['触发节点', 'Trigger Node'],
  ['作用对象', 'Action Target'],
  ['阻断动作', 'Blocking Action'],
  ['恢复动作', 'Recovery Action'],
  ['Owner 角色', 'Owner Role'],
  ['保存更新', 'Save Changes'],
  ['创建规则', 'Create Rule'],
  ['请先补齐规则编码、名称、类型、控制层级、适用范围、时间线阶段、状态和摘要。', 'Complete the rule code, name, type, control level, applicability scope, timeline stage, status, and summary first.'],
  ['规则保存失败，请稍后重试。', 'Failed to save the rule. Please try again later.'],
  ['规则归档状态更新失败，请稍后重试。', 'Failed to update the rule archive state. Please try again later.'],
  ['主数据与接口治理', 'Master Data & Interface Governance'],
  ['同步看板', 'Sync Board'],
  ['导入任务', 'Import Jobs'],
  ['对象关系', 'Object Relationships'],
  ['主数据台账', 'Master Data Registry'],
  ['主读源已切正式 `platform_master_data`；legacy sync/jobs/relationships 兼容 payload 保留在各自页面。', 'The primary source now uses formal `platform_master_data`; legacy sync/jobs/relationships compatibility payloads remain only in their own pages.'],
  ['编码 / 对象名称 / 主键规则 / Owner / 备注', 'Code / object name / primary key rule / owner / remarks'],
  ['编码', 'Code'],
  ['对象', 'Object'],
  ['主键规则', 'Primary Key Rule'],
  ['主数据台账加载失败，请检查后端连接。', 'Failed to load the master data registry. Check the backend connection.'],
  ['正在从数据库加载主数据选项…', 'Loading master data options from the database...'],
  ['暂无补充说明', 'No additional notes'],
  ['当前筛选条件下没有主数据记录。', 'No master data records found for the current filters.'],
  ['类型分布', 'Type Distribution'],
  ['来自正式表聚合。', 'Aggregated from formal tables.'],
  ['暂无类型聚合数据。', 'No type aggregates yet.'],
  ['来源分布', 'Source Distribution'],
  ['用于核对主读来源切换。', 'Used to verify primary source cutovers.'],
  ['暂无来源聚合数据。', 'No source aggregates yet.'],
  ['状态分布', 'Status Distribution'],
  ['运行中 / 警戒 / 待处理由 DB options 统一维护。', 'Running / Alert / Pending are maintained by DB options.'],
  ['暂无状态聚合数据。', 'No status aggregates yet.'],
  ['编辑主数据', 'Edit Master Data'],
  ['新建主数据', 'New Master Data'],
  ['新增记录会直接写入正式表并生成审计事件。', 'New records write directly to formal tables and generate audit events.'],
  ['主数据详情加载失败，将继续使用列表中的已知字段。', 'Failed to load master data details. Known list fields will continue to be used.'],
  ['主数据编码', 'Master Data Code'],
  ['例如 MD-FLIGHT', 'For example MD-FLIGHT'],
  ['对象名称', 'Object Name'],
  ['请选择类型', 'Select type'],
  ['请选择来源', 'Select source'],
  ['主数据保存失败，请稍后重试。', 'Failed to save the master data. Please try again later.'],
  ['主数据归档状态更新失败，请稍后重试。', 'Failed to update the master data archive state. Please try again later.'],
  ['主数据 ', 'Master Data '],
  ['最近更新时间：', 'Last updated: '],
  ['提交中…', 'Submitting...'],
  ['创建记录', 'Create Record'],
  ['请先补齐主数据编码、对象名称、类型、来源、状态、主键规则和 Owner。', 'Complete the master data code, object name, type, source, status, primary key rule, and owner first.'],
  ['接口同步看板', 'Interface Sync Board'],
  ['同步配置对象已切换到正式数据库；列表默认后端分页 20 条，筛选下拉来自 DB options，新建/编辑统一走右侧 Drawer。', 'Sync configuration objects now use the formal database; lists default to backend pagination with 20 rows, filter selects come from DB options, and create/edit flows use the right-side drawer.'],
  ['同步配置台账', 'Sync Configuration Registry'],
  ['正式表 `platform_master_data_sync`，默认后端分页 20 条。', 'Formal table `platform_master_data_sync`, with backend pagination of 20 rows by default.'],
  ['编码 / 名称 / 兜底策略 / Owner / 备注', 'Code / name / fallback strategy / owner / remarks'],
  ['对象', 'Object'],
  ['目标模块', 'Target Module'],
  ['全部对象', 'All Objects'],
  ['全部目标', 'All Targets'],
  ['新建同步配置', 'New Sync Configuration'],
  ['同步配置加载失败，请检查后端连接。', 'Failed to load sync configurations. Check the backend connection.'],
  ['正在从数据库加载同步配置选项…', 'Loading sync configuration options from the database...'],
  ['同步项', 'Sync Item'],
  ['最后运行', 'Last Run'],
  ['兜底策略', 'Fallback Strategy'],
  ['当前筛选条件下没有同步配置。', 'No sync configurations found for the current filters.'],
  ['配置对象写入正式表，归档采用软删除。', 'Configuration objects write to formal tables, and archiving uses soft delete.'],
  ['配置编码', 'Configuration Code'],
  ['编码创建后不可修改。', 'The code cannot be changed after creation.'],
  ['建议使用业务前缀，例如 SYNC-FFM。', 'Use a business prefix such as SYNC-FFM.'],
  ['同步名称', 'Sync Name'],
  ['调度说明', 'Schedule Notes'],
  ['最后运行时间', 'Last Run Time'],
  ['主动作文案', 'Primary Action Label'],
  ['兜底动作文案', 'Fallback Action Label'],
  ['创建配置', 'Create Configuration'],
  ['请先补齐配置编码、名称、对象、目标模块、状态、动作文案、兜底策略和 Owner。', 'Complete the configuration code, name, object, target module, status, action labels, fallback strategy, and owner first.'],
  ['同步配置保存失败，请稍后重试。', 'Failed to save the sync configuration. Please try again later.'],
  ['同步配置归档状态更新失败，请稍后重试。', 'Failed to update the sync configuration archive state. Please try again later.'],
  ['导入任务日志', 'Import Job Log'],
  ['运行日志对象已切到正式数据库；默认后端分页 20 条，不开放手工创建，仅保留 retry / replay / archive 动作。', 'Runtime log objects now use the formal database; lists default to backend pagination with 20 rows, manual creation is not allowed, and only retry / replay / archive actions remain.'],
  ['审计事件', 'Audit Events'],
  ['导入日志', 'Import Logs'],
  ['正式表 `platform_master_data_jobs`，默认后端分页 20 条。', 'Formal table `platform_master_data_jobs`, with backend pagination of 20 rows by default.'],
  ['任务编码 / 同步配置 / 摘要 / 错误', 'Job code / sync configuration / summary / error'],
  ['动作', 'Actions'],
  ['全部动作', 'All Actions'],
  ['任务日志加载失败，请检查后端连接。', 'Failed to load job logs. Check the backend connection.'],
  ['正在从数据库加载任务筛选项…', 'Loading job filters from the database...'],
  ['任务', 'Job'],
  ['同步配置', 'Sync Configuration'],
  ['请求时间', 'Requested At'],
  ['详情', 'Details'],
  ['当前筛选条件下没有任务记录。', 'No jobs found for the current filters.'],
  ['任务详情', 'Job Details'],
  ['运行日志对象只读，支持 retry / replay / archive 动作。', 'Runtime log objects are read-only and support retry / replay / archive actions.'],
  ['正在加载任务详情…', 'Loading job details...'],
  ['任务详情加载失败，请稍后重试。', 'Failed to load job details. Please try again later.'],
  ['详情 / 错误', 'Details / Error'],
  ['暂无详情', 'No details available'],
  ['请求 / 处理时间', 'Requested / Processed Time'],
  ['Retry / Replay 次数', 'Retry / Replay Counts'],
  ['对象关系总览', 'Object Relationship Overview'],
  ['对象关系读源已切到正式只读聚合表；列表默认后端分页 20 条，关系链详情通过正式 detail 接口展开。', 'Object relationship sources now use formal read-only aggregate tables; lists default to backend pagination with 20 rows, and relationship details expand through formal detail APIs.'],
  ['主数据治理', 'Master Data Governance'],
  ['规则引擎', 'Rule Engine'],
  ['可信留痕', 'Traceability'],
  ['对象关系链', 'Object Relationship Chain'],
  ['正式聚合读源 `platform_master_data_relationships`，默认后端分页 20 条。', 'Formal aggregate source `platform_master_data_relationships`, with backend pagination of 20 rows by default.'],
  ['关系编码 / Source / Target / 链路摘要', 'Relationship code / source / target / path summary'],
  ['Source 类型', 'Source Type'],
  ['全部 Source', 'All Sources'],
  ['关系', 'Relation'],
  ['全部关系', 'All Relations'],
  ['Target 类型', 'Target Type'],
  ['全部 Target', 'All Targets'],
  ['证据源', 'Evidence Source'],
  ['全部证据', 'All Evidence'],
  ['对象关系加载失败，请检查后端连接。', 'Failed to load object relationships. Check the backend connection.'],
  ['正在从数据库加载关系筛选项…', 'Loading relationship filters from the database...'],
  ['关系编码', 'Relationship Code'],
  ['关系链摘要', 'Path Summary'],
  ['查看链路', 'View Path'],
  ['当前筛选条件下没有关系记录。', 'No relationships found for the current filters.'],
  ['关系链详情', 'Relationship Details'],
  ['只读聚合对象，不开放手工编辑。', 'This is a read-only aggregate object and cannot be edited manually.'],
  ['正在加载关系链详情…', 'Loading relationship details...'],
  ['关系链详情加载失败，请稍后重试。', 'Failed to load relationship details. Please try again later.'],
  ['摘要', 'Summary'],
  ['链路深度', 'Path Depth'],
  ['关联链路', 'Related Path']
  ,['进港航班看板', 'Inbound Flight Board']
  ,['地面履约状态', 'Ground Fulfillment Status']
  ,['当前进港阻断', 'Current Inbound Blockers']
  ,['待复核 / 待发送 NOA', 'Review / Pending NOA']
  ,['进港文件放行', 'Inbound Document Gate']
  ,['二次转运记录', 'Transfer Records']
  ,['航班管理', 'Flight Management']
  ,['提单管理', 'AWB Management']
  ,['PDA 作业终端', 'PDA Terminal']
  ,['出港航班总览', 'Outbound Flight Overview']
  ,['出港状态链', 'Outbound Status Chain']
  ,['当前出港阻断', 'Current Outbound Blockers']
  ,['货物预报 FFM', 'FFM Forecast']
  ,['货物接收', 'Cargo Receipt']
  ,['货物主单', 'Master AWB']
  ,['装载 / 飞走 / 装载信息 UWS', 'Loading / Airborne / UWS']
  ,['出港文件放行', 'Outbound Document Gate']
  ,['出港任务提示', 'Outbound Task Hints']
  ,['出港排班与装载协同中', 'Outbound scheduling and loading coordination in progress']
  ,['来自 UWS 与 Manifest 汇总', 'Aggregated from UWS and Manifest']
  ,['等待目的港回传用于对账', 'Waiting for destination feedback for reconciliation']
  ,['预报', 'Forecast']
  ,['实收', 'Received']
  ,['结果', 'Result']
  ,['差异', 'Variance']
  ,['发货人', 'Shipper']
  ,['收货人', 'Consignee']
  ,['航段', 'Route']
  ,['件数', 'Pieces']
  ,['重量', 'Weight']
  ,['毛重', 'Gross Weight']
  ,['货类', 'Cargo Type']
  ,['待飞走航班', 'Flights Pending Airborne']
  ,['Manifest 已导入', 'Manifest Imported']
  ,['出港货物数量', 'Outbound Cargo Count']
  ,['目的港到货数量', 'Destination Arrival Count']
  ,['单证中心', 'Document Center']
  ,['作业任务', 'Task Queue']
  ,['飞走', 'Airborne']
  ,['进港管理', 'Inbound Operations']
  ,['出港管理', 'Outbound Operations']
  ,['进港管理 / 航班管理', 'Inbound Operations / Flight Management']
  ,['进港航班操作台', 'Inbound Flight Console']
  ,['新建航班', 'New Flight']
  ,['查看', 'View']
  ,['任务', 'Tasks']
  ,['单证', 'Documents']
  ,['链路', 'Flow']
  ,['办公室预排进港执行', 'Inbound Office Pre-Planning']
  ,['后台先完成', 'Office Plan First']
  ,['PDA 现场执行', 'PDA Execution']
  ,['后台托盘预排', 'Office Pallet Planning']
  ,['计划 AWB', 'Planned AWBs']
  ,['总箱数', 'Total Boxes']
  ,['总重量', 'Total Weight']
  ,['存放位置', 'Storage Location']
  ,['保存托盘预排', 'Save Pallet Plan']
  ,['保存后会同步到移动端“历史托盘 / 预计装载目标”。', 'Saved plans will sync to the mobile side as historical pallets and expected loading targets.']
  ,['当前后台托盘', 'Current Office Pallets']
  ,['托盘号', 'Pallet No.']
  ,['后台装车计划编排', 'Office Loading Plan Scheduling']
  ,['车牌', 'Truck Plate']
  ,['司机', 'Driver']
  ,['叉车司机', 'Forklift Driver']
  ,['核对员', 'Checker']
  ,['预定托盘', 'Reserved Pallets']
  ,['到场时间', 'Arrival Time']
  ,['保存装车计划', 'Save Loading Plan']
  ,['保存后会同步到移动端“预定装车计划 / 当前装车计划”。', 'Saved plans will sync to the mobile side as reserved and current loading plans.']
  ,['办公室预排 ULD / 机位 / 文件', 'Office ULD / Stand / Document Planning']
  ,['后台 ULD / 机位预排', 'Office ULD / Stand Planning']
  ,['飞机机位', 'Aircraft Stand']
  ,['保存 ULD 预排', 'Save ULD Plan']
  ,['保存后会同步到移动端“集装器 / 装机 / 出港机坪” demo 数据。', 'Saved plans will sync to the mobile side container, loading, and outbound ramp demo data.']
  ,['办公室预排 ULD 清单', 'Office ULD Plan List']
  ,['机位', 'Stand']
  ,['待编排', 'Pending Planning']
  ,['当前在本站处理的出港航班', 'Outbound flights currently handled at this station']
  ,['来自航班级装载汇总', 'Aggregated from flight-level loading']
  ,['进港管理 / 提单管理', 'Inbound Operations / AWB Management']
  ,['进港提单已收口为正式数据库资源。新增继续走导入链，列表、筛选、人工修正与归档都直接走数据库接口。', 'Inbound waybills are now formal database resources. New records continue through the import pipeline, while listing, filtering, manual correction, and archive recovery all use direct database APIs.']
  ,['进港提单台账', 'Inbound AWB Ledger']
  ,['关键词', 'Keyword']
  ,['AWB / 收货方', 'AWB / Consignee']
  ,['所属航班', 'Assigned Flight']
  ,['全部航班', 'All Flights']
  ,['全部节点', 'All Nodes']
  ,['全部状态', 'All Statuses']
  ,['全部', 'All']
  ,['转运', 'Transfer']
  ,['显示已归档', 'Show Archived']
  ,['进港提单台账加载失败，请检查后端连接。', 'Failed to load inbound waybill ledger. Check the backend connection.']
  ,['收货方', 'Consignee']
  ,['件数 / 重量', 'Pieces / Weight']
  ,['操作', 'Actions']
  ,['已归档', 'Archived']
  ,['编辑', 'Edit']
  ,['恢复', 'Restore']
  ,['归档', 'Archive']
  ,['当前条件下没有提单数据。', 'No waybills match the current filters.']
  ,['编辑提单', 'Edit AWB']
  ,['新增继续走导入链；Drawer 仅负责人工修正、航班绑定和归档恢复。', 'New records continue through the import pipeline. This drawer is only for manual corrections, flight binding, and archive recovery.']
  ,['提单类型', 'AWB Type']
  ,['选择绑定航班', 'Select a flight to bind']
  ,['未绑定', 'Unassigned']
  ,['重量 (kg)', 'Weight (kg)']
  ,['转运状态', 'Transfer Status']
  ,['归档状态', 'Archive Status']
  ,['取消', 'Cancel']
  ,['保存中...', 'Saving...']
  ,['保存提单', 'Save AWB']
  ,['提单', 'AWB']
  ,['已保存。', 'saved.']
  ,['已恢复。', 'restored.']
  ,['已归档。', 'archived.']
  ,['提单保存失败。', 'Failed to save AWB.']
  ,['提单归档失败。', 'Failed to archive AWB.']
  ,['出港管理 / 提单管理', 'Outbound Operations / AWB Management']
  ,['出港提单已收口为正式数据库资源。新增继续走导入链，人工只负责修正、航班绑定和归档恢复。', 'Outbound waybills are now formal database resources. New records continue through the import pipeline, while manual work is limited to correction, flight binding, and archive recovery.']
  ,['出港提单台账', 'Outbound AWB Ledger']
  ,['AWB / 航班', 'AWB / Flight']
  ,['出港提单台账加载失败，请检查后端连接。', 'Failed to load outbound waybill ledger. Check the backend connection.']
  ,['目的站', 'Destination']
  ,['收货', 'Receipt']
  ,['主单', 'Master']
  ,['装载', 'Loading']
  ,['通知方 / 目的站备注', 'Notify Party / Destination Note']
  ,['出港提单新增继续走导入链；Drawer 仅负责人工修正、航班绑定和归档恢复。', 'New outbound waybills continue through the import pipeline. This drawer is only for manual corrections, flight binding, and archive recovery.']
  ,['未找到航班', 'Flight Not Found']
  ,['返回航班列表', 'Back to Flights']
  ,['进港 / 航班 / 详情', 'Inbound / Flights / Detail']
  ,['航班详情', 'Flight Detail']
  ,['航班详情页直接读取真实 Flight、AWB、Task、Document、Exception 链，不再使用本地编排状态。', 'The flight detail page reads the real Flight, AWB, Task, Document, and Exception chain directly, without local planning state.']
  ,['状态', 'Status']
  ,['提单总数', 'Total AWBs']
  ,['开放任务', 'Open Tasks']
  ,['已完成', 'Completed']
  ,['开放异常', 'Open Exceptions']
  ,['实际落地', 'Actual Landing']
  ,['Flight 链路上的阻断项', 'Blocking items on the flight chain']
  ,['航班基础信息', 'Flight Basics']
  ,['航班号', 'Flight No.']
  ,['航班日期', 'Flight Date']
  ,['当前状态', 'Current Status']
  ,['当前航班还没有任务。', 'There are no tasks for this flight yet.']
  ,['班组', 'Team']
  ,['待分派', 'Pending Assignment']
  ,['打开任务中心', 'Open Task Center']
  ,['当前航班没有开放异常。', 'There are no open exceptions for this flight.']
  ,['当前阻断主链', 'Currently Blocking Main Flow']
  ,['仅需跟进', 'Follow-up Only']
  ,['打开异常中心', 'Open Exception Center']
  ,['文件门槛摘要', 'Document Gate Summary']
  ,['提单状态', 'AWB Status']
  ,['查看提单', 'View AWB']
  ,['航班对象审计', 'Flight Audit Trail']
  ,['已执行', 'executed']
  ,['执行失败', 'execution failed']
  ,['出港 / 航班 / 详情', 'Outbound / Flights / Detail']
  ,['出港航班详情页直接读取真实 Flight、AWB、Task、Document、Exception 与对象审计。', 'The outbound flight detail page reads real Flight, AWB, Task, Document, Exception, and audit data directly.']
  ,['Loaded', 'Loaded']
  ,['Finalize Manifest', 'Finalize Manifest']
  ,['Airborne', 'Airborne']
  ,['已装载提单', 'Loaded AWBs']
  ,['待补 Manifest', 'Manifest Pending']
  ,['当前阶段', 'Current Stage']
  ,['计划起飞', 'Planned Departure']
  ,['运行态', 'Runtime Status']
  ,['动作检查表', 'Action Checklist']
  ,['出港航班对象审计', 'Outbound Flight Audit Trail']
  ,['未找到提单', 'AWB Not Found']
  ,['返回提单列表', 'Back to AWBs']
  ,['进港 / 提单 / 详情', 'Inbound / AWB / Detail']
  ,['提单详情', 'AWB Detail']
  ,['提单详情页直接读取真实 AWB、Shipment、Document、Task、Exception 链，不再保留本地办公室状态。', 'The AWB detail page reads the real AWB, Shipment, Document, Task, and Exception chain directly, without local office state.']
  ,['履约链路', 'Fulfillment Flow']
  ,['NOA 动作', 'NOA Actions']
  ,['POD 动作', 'POD Actions']
  ,['通知状态', 'Notification Status']
  ,['签收状态', 'Receipt Status']
  ,['AWB 与 Shipment 信息', 'AWB and Shipment Info']
  ,['件重体', 'Pieces / Weight']
  ,['Shipment 状态', 'Shipment Status']
  ,['当前提单没有关联任务。', 'There are no linked tasks for this AWB.']
  ,['无阻断码', 'No Blocker Code']
  ,['当前提单没有开放异常。', 'There are no open exceptions for this AWB.']
  ,['关联文件', 'Related Documents']
  ,['文件类型', 'Document Type']
  ,['放行要求', 'Release Requirement']
  ,['必须', 'Required']
  ,['可选', 'Optional']
  ,['打开单证中心', 'Open Document Center']
  ,['提单对象审计', 'AWB Audit Trail']
  ,['未找到履约对象', 'Fulfillment Object Not Found']
  ,['返回对象目录', 'Back to Directory']
  ,['Shipment 详情页直接回连真实 AWB、Document、Task、Exception 和对象审计。', 'The shipment detail page links directly to real AWB, Document, Task, Exception, and audit data.']
  ,['单证', 'Documents']
  ,['异常', 'Exceptions']
  ,['返回目录', 'Back to Directory']
  ,['对象摘要', 'Object Summary']
  ,['当前对象的状态和路由全部来自真实后端。', 'The current object state and route are sourced entirely from the real backend.']
  ,['方向', 'Direction']
  ,['站点', 'Station']
  ,['履约时间线', 'Fulfillment Timeline']
  ,['关联任务', 'Related Tasks']
  ,['当前对象没有关联任务。', 'There are no linked tasks for this object.']
  ,['截止', 'Due']
  ,['无 Gate', 'No Gate']
  ,['类型', 'Type']
  ,['文件名', 'File Name']
  ,['说明', 'Notes']
  ,['当前对象命中的门槛', 'Gates Matched by Current Object']
  ,['对象关系', 'Object Relationships']
  ,['关联异常', 'Related Exceptions']
  ,['当前对象暂无异常。', 'There are no exceptions for this object.']
  ,['Shipment 对象审计', 'Shipment Audit Trail']
  ,['异常恢复失败', 'Failed to resolve exception']
  ,['未找到异常', 'Exception Not Found']
  ,['返回异常中心', 'Back to Exceptions']
  ,['异常详情', 'Exception Detail']
  ,['异常详情页直接读取真实 Exception 对象、关联文件、阻断任务与对象审计。', 'The exception detail page reads the real Exception object, linked documents, blocking tasks, and object audit directly.']
  ,['关联对象', 'Related Object']
  ,['当前动作', 'Current Action']
  ,['恢复异常', 'Resolve Exception']
  ,['当前异常对象与阻断信息均来自真实后端。', 'The current exception object and blocker data come directly from the real backend.']
  ,['异常类型', 'Exception Type']
  ,['阻断任务与恢复动作', 'Blocking Tasks and Recovery Actions']
  ,['未挂接任务', 'No Linked Task']
  ,['当前异常阻断主链推进', 'This exception is blocking the main flow']
  ,['当前异常仅需跟进', 'This exception only needs follow-up']
  ,['待补充门槛规则', 'Gate rule pending completion']
  ,['待补充恢复动作', 'Recovery action pending completion']
  ,['请补齐异常原因与恢复动作。', 'Please complete the root cause and recovery action.']
  ,['放行角色', 'Release Role']
  ,['打开关联对象', 'Open Related Object']
  ,['命中的门槛', 'Matched Gates']
  ,['异常对象审计', 'Exception Audit Trail']
  ,['NOA 发送前先校验 HG-03', 'Validate HG-03 before sending NOA']
  ,['理货复核未完成时，只允许停留在待发送或人工放行评审。', 'If tally review is incomplete, the item may only remain pending send or manual release review.']
  ,['待处理', 'Pending']
  ,['NOA 校验通过', 'NOA validation passed']
  ,['NOA 校验未通过', 'NOA validation failed']
  ,['校验完成', 'Validation completed']
  ,['NOA 校验失败', 'NOA validation failed']
  ,['重试成功', 'Retry succeeded']
  ,['NOA 重试成功', 'NOA retry succeeded']
  ,['已从失败态恢复为已发送。', 'was restored from failed to sent.']
  ,['NOA 重试失败', 'NOA retry failed']
  ,['已登记人工补发记录', 'Manual resend recorded']
  ,['人工补发完成', 'Manual resend completed']
  ,['已登记人工补发记录。', 'manual resend has been recorded.']
  ,['人工补发失败', 'Manual resend failed']
  ,['NOA 通知动作', 'NOA Actions']
  ,['展示发送前门槛检查、失败重试和人工补发。当前页统一从 HG 门槛定义读取阻断原因与恢复动作。', 'Shows pre-send gate checks, failed-send retries, and manual resend handling. This page reads blocker reasons and recovery actions from the HG gate definitions.']
  ,['作业指令中心', 'Task Command Center']
  ,['NOA 通知列表', 'NOA Notification List']
  ,['编号', 'ID']
  ,['渠道', 'Channel']
  ,['目标对象', 'Target Object']
  ,['重试策略', 'Retry Policy']
  ,['跳转', 'Jump']
  ,['履约对象', 'Fulfillment Object']
  ,['查看履约对象', 'View Fulfillment Object']
  ,['查看任务', 'View Tasks']
  ,['发送前校验', 'Validate Before Send']
  ,['重试发送', 'Retry Send']
  ,['人工补发', 'Manual Resend']
  ,['触发节点：', 'Trigger Node: ']
  ,['阻断结果：', 'Blocker Result: ']
  ,['恢复动作：', 'Recovery Action: ']
  ,['放行角色：', 'Release Role: ']
  ,['当前说明：', 'Current Note: ']
  ,['当前 Gate 判定', 'Current Gate Evaluation']
  ,['NOA 动作记录', 'NOA Action Log']
  ,['POD 双签前不得 Closed', 'POD cannot be Closed before double sign-off']
  ,['交付签收完成后，仍需完成双签与归档校验才能进入 Closed。', 'After delivery sign-off is complete, double sign-off and archive validation are still required before entering Closed.']
  ,['阻塞', 'Blocked']
  ,['待补签', 'Pending Re-sign']
  ,['Closed 校验通过', 'Closed validation passed']
  ,['Closed 校验未通过', 'Closed validation failed']
  ,['关闭前校验失败', 'Pre-close validation failed']
  ,['已完成补签', 'Re-sign completed']
  ,['POD 双签完成', 'POD double sign-off completed']
  ,['已补齐双签，阻断解除。', 'completed double sign-off and cleared the blocker.']
  ,['POD 补签失败', 'POD re-sign failed']
  ,['已完成归档', 'Archive completed']
  ,['POD 已归档', 'POD archived']
  ,['已完成归档动作。', 'archive action completed.']
  ,['POD 归档失败', 'POD archive failed']
  ,['POD 通知与补签', 'POD Notifications and Re-sign']
  ,['展示双签阻断、补签后状态变化和归档前校验。当前页统一从后端 overview 读取 POD 列表与 HG-06 阻断逻辑。', 'Shows double-sign blockers, status changes after re-sign, and archive-before-close validation. This page reads the POD list and HG-06 blocker logic from the backend overview.']
  ,['POD 通知列表', 'POD Notification List']
  ,['对象', 'Object']
  ,['签收方', 'Signer']
  ,['关闭前校验', 'Validate Before Close']
  ,['补签确认', 'Confirm Re-sign']
  ,['执行归档', 'Run Archive']
  ,['POD 动作记录', 'POD Action Log']
  ,['已更新。', 'updated.']
  ,['任务保存失败，请稍后重试。', 'Failed to save task. Please retry later.']
  ,['任务归档状态更新失败，请稍后重试。', 'Failed to update task archive status. Please retry later.']
  ,['已分派。', 'assigned.']
  ,['任务分派失败，请稍后重试。', 'Failed to assign task. Please retry later.']
  ,['已执行', 'executed']
  ,['失败，请稍后重试。', 'failed. Please retry later.']
  ,['已上报异常。', 'exception reported.']
  ,['异常上报失败，请稍后重试。', 'Failed to report exception. Please retry later.']
  ,['Tasks 已收口成正式数据库资源：列表、详情、元数据更新、归档/恢复和工作流动作都走真实对象链，页面不再以 overview 聚合壳当主真相。', 'Tasks are now formal database resources. Lists, detail, metadata updates, archive/recovery, and workflow actions all use the real object chain instead of overview shells.']
  ,['任务台账', 'Task Ledger']
  ,['任务列表已切到数据库分页；默认每页 20 条。', 'The task list now uses database pagination with a default page size of 20.']
  ,['任务类型 / Gate / 对象', 'Task Type / Gate / Object']
  ,['全部优先级', 'All Priorities']
  ,['全部角色', 'All Roles']
  ,['全部任务类型', 'All Task Types']
  ,['全部对象类型', 'All Object Types']
  ,['任务台账加载失败，请检查后端连接。', 'Failed to load task ledger. Check the backend connection.']
  ,['任务详情加载失败，请检查后端连接。', 'Failed to load task detail. Check the backend connection.']
  ,['责任', 'Owner']
  ,['SLA / 截止', 'SLA / Due']
  ,['异常', 'Exceptions']
  ,['任务详情', 'Task Detail']
  ,['任务对象已切到数据库资源：元数据更新与归档走资源接口，分派/复核/返工/升级继续走工作流动作。', 'Task objects now use database resources. Metadata updates and archive actions go through resource APIs, while assign/verify/rework/escalate remain workflow actions.']
  ,['任务详情加载中…', 'Loading task detail…']
  ,['请选择真实数据库对象', 'Please select a real database object']
  ,['未分配', 'Unassigned']
  ,['截止时间', 'Due Time']
  ,['阻断码', 'Blocker Code']
  ,['要求上传证据', 'Require Evidence Upload']
  ,['标记为已归档', 'Mark as Archived']
  ,['保存任务', 'Save Task']
  ,['分派', 'Assign']
  ,['复核', 'Verify']
  ,['返工', 'Rework']
  ,['升级', 'Escalate']
  ,['严重等级', 'Severity']
  ,['Owner 角色', 'Owner Role']
  ,['Owner 班组', 'Owner Team']
  ,['提交', 'Submit']
  ,['异常保存失败，请稍后重试。', 'Failed to save exception. Please retry later.']
  ,['异常归档状态更新失败，请稍后重试。', 'Failed to update exception archive status. Please retry later.']
  ,['异常恢复失败，请稍后重试。', 'Failed to resolve exception. Please retry later.']
  ,['异常列表、筛选、详情和编辑全部已切真实数据库读源；资源更新与归档边界和 resolve 工作流分开管理。', 'Exception lists, filters, detail, and editing now read from the real database source. Resource updates and archive boundaries are managed separately from the resolve workflow.']
  ,['查看任务池', 'View Task Pool']
  ,['异常列表', 'Exception List']
  ,['异常列表加载失败。', 'Failed to load exception list.']
  ,['关键字', 'Keyword']
  ,['含归档', 'Include Archived']
  ,['异常编号', 'Exception ID']
  ,['阻断', 'Blocker']
  ,['动作', 'Actions']
  ,['阻断中', 'Blocking']
  ,['未阻断', 'Not Blocking']
  ,['有效', 'Active']
  ,['详情', 'Detail']
  ,['当前筛选下没有异常。', 'No exceptions match the current filters.']
  ,['编辑异常', 'Edit Exception']
  ,['表单字段已切到真实数据库写入，异常状态的最终恢复仍需走 resolve 工作流。', 'Form fields now write to the real database. Final recovery of exception status still goes through the resolve workflow.']
  ,['正在加载异常详情…', 'Loading exception detail…']
  ,['异常详情加载失败。', 'Failed to load exception detail.']
  ,['资源状态', 'Resource Status']
  ,['当前关联对象', 'Current Related Object']
  ,['当前责任班组', 'Current Owner Team']
  ,['保存异常', 'Save Exception']
  ,['Copilot 交互层', 'Copilot Interface']
  ,['站内 Copilot 采用独立页面承载会话列表、消息流、工具调用和对象上下文，和业务详情页解耦。', 'The in-station Copilot uses a dedicated page for session list, message stream, tool invocation, and object context, decoupled from detail pages.']
  ,['新建会话', 'New Session']
  ,['应用对象', 'Apply Object']
  ,['打开对象详情', 'Open Object Detail']
  ,['会话列表', 'Session List']
  ,['更新', 'Updated']
  ,['消息流会记录本地输入、工具执行结果和实时上下文摘要。', 'The message stream records local input, tool execution results, and realtime context summaries.']
  ,['刷新上下文', 'Refresh Context']
  ,['输入问题或操作说明', 'Enter a question or operation note']
  ,['例如：检查当前对象的阻断原因，并给出可执行步骤。', 'Example: Check the blocker reason for the current object and provide executable steps.']
  ,['发送消息', 'Send Message']
  ,['对象上下文', 'Object Context']
  ,['当前对象', 'Current Object']
  ,['目标详情页', 'Target Detail Page']
  ,['上下文尚未加载。', 'Context has not been loaded yet.']
  ,['对象留痕', 'Object Audit']
  ,['工具调用器', 'Tool Runner']
  ,['工具', 'Tool']
  ,['请输入工具参数 JSON', 'Enter tool argument JSON']
  ,['填充当前对象', 'Fill Current Object']
  ,['执行中...', 'Running...']
  ,['执行工具', 'Run Tool']
  ,['最近结果', 'Latest Result']
  ,['暂无工具结果。', 'No tool result yet.']
  ,['对象切换器', 'Object Switcher']
  ,['对象类型', 'Object Type']
  ,['对象键', 'Object Key']
  ,['选择对象后点击“应用对象”即可同步消息流与上下文。', 'Select an object and click "Apply Object" to sync the message stream and context.']
  ,['进港 / 航班 / 新建', 'Inbound / Flights / Create']
  ,['创建新的进港航班记录，录入航班号、来源，以及最基础的 ETA / ETD 信息。', 'Create a new inbound flight record with the flight number, origin, and the minimum ETA / ETD fields.']
  ,['航班录入表单', 'Flight Entry Form']
  ,['当前先支持最小必填字段，用于快速建立进港航班主记录。', 'The form currently supports the minimum required fields to create the main inbound flight record quickly.']
  ,['提单管理', 'AWB Management']
  ,['PDA 作业终端', 'PDA Operations']
  ,['例如：SE803', 'Example: SE803']
  ,['服务等级', 'Service Level']
  ,['初始状态', 'Initial Status']
  ,['清空', 'Clear']
  ,['创建中...', 'Creating...']
  ,['创建航班', 'Create Flight']
  ,['录入预览', 'Entry Preview']
  ,['未填写', 'Not entered']
  ,['未选择', 'Not selected']
  ,['航班已正式创建', 'Flight Created']
  ,['表单提示', 'Form Hint']
  ,['填完航班号、来源、ETA、ETD 四个字段后即可创建正式航班记录。', 'Complete the flight number, origin, ETA, and ETD to create the official flight record.']
  ,['提单与履约链路', 'AWB and Fulfillment Chain']
  ,['Shipment 已冻结为 AWB 投影 / 履约聚合对象。列表与详情都直接读取数据库聚合 DTO，不再依赖前端本地适配真相。', 'Shipment has been frozen as an AWB projection / fulfillment aggregate. Both list and detail views read database aggregate DTOs directly instead of frontend-local adapted truth.']
  ,['Read-First Resource', 'Read-First Resource']
  ,['进港提单', 'Inbound AWBs']
  ,['出港提单', 'Outbound AWBs']
  ,['履约对象目录', 'Fulfillment Object Directory']
  ,['Shipment 列表读取失败。', 'Failed to load the shipment list.']
  ,['AWB / 航班 / 收货方', 'AWB / flight / consignee']
  ,['方向', 'Direction']
  ,['全部方向', 'All Directions']
  ,['所属航班', 'Flight']
  ,['全部航班', 'All Flights']
  ,['全部节点', 'All Nodes']
  ,['Fulfillment', 'Fulfillment']
  ,['阻断状态', 'Blocker State']
  ,['显示已归档 AWB 投影', 'Show archived AWB projections']
  ,['履约对象总数', 'Total Fulfillment Objects']
  ,['统一按 Shipment / AWB 聚合观察进港与出港链路', 'Observe inbound and outbound chains through Shipment / AWB aggregates.']
  ,['当前页进港对象', 'Inbound Objects on This Page']
  ,['重点跟踪 Inbound Handling 与 NOA / POD', 'Focus on inbound handling and NOA / POD.']
  ,['当前页出港对象', 'Outbound Objects on This Page']
  ,['重点跟踪 Loaded / Airborne / Manifest', 'Focus on loaded / airborne / manifest.']
  ,['当前页存在阻断', 'Blocked Objects on This Page']
  ,['需要文件、异常或复核解除后才能继续', 'Continue only after documents, exceptions, or reviews are cleared.']
  ,['阻断原因', 'Blocker Reason']
  ,['查看链路', 'View Chain']
  ,['Shipment 正在从数据库聚合读取，请稍候。', 'Loading shipments from the database aggregate.']
  ,['出港 / 提单 / 详情', 'Outbound / AWB / Detail']
  ,['出港提单详情页直接读取真实 AWB、Document、Task、Exception 与对象审计。', 'The outbound AWB detail page reads the real AWB, document, task, exception, and object audit records directly.']
  ,['预报', 'Forecast']
  ,['收货', 'Receipt']
  ,['主单', 'Master AWB']
  ,['装载 / Manifest', 'Loading / Manifest']
  ,['AWB 基础信息', 'AWB Core Information']
  ,['出港恢复摘要', 'Outbound Recovery Summary']
  ,['先解除阻断异常，再推进出港动作', 'Clear blocking exceptions before continuing outbound actions.']
  ,['当前提单仍阻断出港动作链', 'The current AWB still blocks the outbound action chain.']
  ,['当前提单的出港动作链已完成', 'The outbound action chain for this AWB is complete.']
  ,['当前提单可继续推进出港动作', 'The current AWB can continue through outbound actions.']
  ,['阻断与恢复摘要', 'Blockers and Recovery Summary']
  ,['出港提单对象审计', 'Outbound AWB Audit Trail']
  ,['单证中心', 'Document Center']
  ,['Documents 已收口为正式数据库资源：列表、详情、更新、归档/恢复、预览、下载都走统一对象链，前端不再依赖 demo 概览真相。', 'Documents now use formal database resources: list, detail, update, archive/restore, preview, and download all run through one object chain, and the frontend no longer depends on demo overview truth.']
  ,['Object Binding Options', 'Object Binding Options']
  ,['登记文档', 'Register Document']
  ,['文档总数', 'Total Documents']
  ,['数据库分页台账', 'Database Pagination Ledger']
  ,['当前页待处理', 'Pending on This Page']
  ,['需继续校验或放行', 'Still waiting for validation or release']
  ,['当前页已归档', 'Archived on This Page']
  ,['软删除 / 归档状态', 'Soft-delete / archived status']
  ,['需放行文件', 'Release-gated Documents']
  ,['放行前必须满足', 'Must be satisfied before release']
  ,['文档台账', 'Document Registry']
  ,['默认每页 20 条；筛选变更自动回第一页。', 'Default page size is 20; filter changes return to page 1 automatically.']
  ,['文档台账读取失败。', 'Failed to load the document registry.']
  ,['文件名 / 文档编号 / 关联对象', 'File name / document ID / linked object']
  ,['文档类型', 'Document Type']
  ,['关联对象类型', 'Related Object Type']
  ,['全部对象', 'All Objects']
  ,['编号', 'ID']
  ,['文件名', 'File Name']
  ,['关联对象', 'Linked Object']
  ,['版本', 'Version']
  ,['保留策略', 'Retention Policy']
  ,['文档台账正在从数据库读取，请稍候。', 'Loading the document registry from the database.']
  ,['当前文档详情', 'Current Document Details']
  ,['文档详情读取失败。', 'Failed to load document details.']
  ,['当前页没有可查看的文档。', 'No document is available on the current page.']
  ,['保留策略：', 'Retention: ']
  ,['放行要求：', 'Release Requirement: ']
  ,['备注：', 'Remarks: ']
  ,['无', 'None']
  ,['预览加载中…', 'Loading preview...']
  ,['预览', 'Preview']
  ,['下载', 'Download']
  ,['编辑元数据', 'Edit Metadata']
  ,['新窗口打开', 'Open in New Window']
  ,['已启用真实预览：', 'Live preview enabled: ']
  ,['当前文件类型不支持 inline，已回退到下载或元数据预览。', 'This file type does not support inline preview. Falling back to download or metadata preview.']
  ,['版本链', 'Version Chain']
  ,['绑定对象', 'Bind Object']
  ,['放行前必须', 'Required Before Release']
  ,['Storage Key（无文件上传时使用）', 'Storage Key (used when no file is uploaded)']
  ,['已选择文件：', 'Selected file: ']
  ,['选择文件并上传到 R2', 'Select a file and upload it to R2']
  ,['提交中…', 'Submitting...']
  ,['编辑文档元数据', 'Edit Document Metadata']
  ,['文档状态', 'Document Status']
  ,['保存中…', 'Saving...']
  ,['登记文档失败', 'Failed to register the document']
  ,['更新文档失败', 'Failed to update the document']
  ,['文档归档状态更新失败', 'Failed to update the document archive state']
  ,['平台管理后台', 'Platform Back Office']
  ,['货站后台', 'Station Back Office']
  ,['货站看板', 'Station Dashboard']
  ,['进港', 'Inbound']
  ,['出港', 'Outbound']
  ,['放行', 'Release']
  ,['处理中', 'In Progress']
  ,['看板', 'Dashboard']
  ,['待发 NOA', 'Pending NOA']
  ,['待补 POD', 'Pending POD']
  ,['待生成', 'Pending Generation']
  ,['待Verify', 'Pending Verification']
  ,['已到站但未触发 NOA 的 AWB', 'AWBs that have arrived but have not triggered NOA']
  ,['已交付但签收未归档的 AWB', 'Delivered AWBs whose signatures are not archived']
  ,['当前站点入港处理批次', 'Current station inbound processing batches']
  ,['当前站点出港协同批次', 'Current station outbound coordination batches']
  ,['进港作业', 'Inbound Operations']
  ,['出港作业', 'Outbound Operations']
  ,['进港航班看板', 'Inbound Flight Board']
  ,['地面履约状态', 'Ground Fulfillment Status']
  ,['当前进港阻断', 'Current Inbound Blockers']
  ,['待复核 / 待发送 NOA', 'Review / Pending NOA']
  ,['进港文件放行', 'Inbound Document Release']
  ,['二次转运记录', 'Transfer Records']
  ,['覆盖进港航班、地面履约状态、节点任务、文件放行、NOA 与交付闭环，重点围绕对象与状态机执行。', 'Covers inbound flights, ground-fulfillment status, node tasks, document release, NOA, and delivery closure, with execution centered on objects and state transitions.']
  ,['航班看板', 'Flight Board']
  ,['地面履约', 'Ground Fulfillment']
  ,['任务队列', 'Task Queue']
  ,['POD 闭环', 'POD Closure']
  ,['NOA 已发送', 'NOA Sent']
  ,['运达', 'Arrived']
  ,['已卸机', 'Unloaded']
  ,['已入货站', 'Arrived at Station']
  ,['拆板理货中', 'Breakdown in Progress']
  ,['出港后台按 PRD 拆成预报、接收、主单、装载、飞走、UWS 和 Manifest 板块，并补齐文件放行和任务阻断表达。', 'The outbound back office is split into forecast, receipt, master AWB, loading, airborne, UWS, and manifest sections, with document release and task blockers completed.' ]
  ,['门槛控制', 'Gate Control']
  ,['待飞走航班', 'Flights Pending Departure']
  ,['出港排班与装载协同中', 'Outbound planning and loading coordination in progress']
  ,['出港货物数量', 'Outbound Cargo Volume']
  ,['来自 UWS 与 Manifest 汇总', 'Aggregated from UWS and manifest']
  ,['目的港到货数量', 'Destination Arrival Volume']
  ,['等待目的港回传用于对账', 'Waiting for destination feedback for reconciliation']
  ,['出港状态链', 'Outbound Status Chain']
  ,['当前出港阻断', 'Current Outbound Blockers']
  ,['货物预报 FFM', 'FFM Forecast']
  ,['货物接收', 'Cargo Receipt']
  ,['货物主单', 'Master AWB']
  ,['装载 / 飞走 / 装载信息 UWS', 'Loading / Airborne / UWS']
  ,['出港文件放行', 'Outbound Document Release']
  ,['数据库 CRUD', 'Database CRUD']
  ,['数据库选项', 'Database Options']
  ,['工作流动作', 'Workflow Actions']
  ,['软删除', 'Soft Delete']
  ,['执行节点', 'Execution Node']
  ,['到港收货', 'Arrival Receipt']
  ,['出港收货', 'Outbound Receipt']
  ,['装机复核', 'Load Verification']
  ,['货站报表', 'Station Reports']
  ,['STATION报表', 'Station Reports']
  ,['展示货站层 KPI 和班次报表，为第二批主演示链路提供日报 / 周报前端 demo。', 'Shows station-level KPIs and shift reports for the second-phase pilot lane with daily and weekly report demos.']
  ,['12 小时完成率', '12h Completion Rate']
  ,['装车准确率', 'Loading Accuracy']
  ,['异常时长', 'Exception Duration']
  ,['日报生成锚点', 'Daily Report Anchor']
  ,['报表类型', 'Report Type']
  ,['货站日报核心指标', 'Station Daily Core Metrics']
  ,['区块', 'Section']
  ,['当前值', 'Current Value']
  ,['PDA KPI 样例', 'PDA KPI Samples']
  ,['文件报表样例', 'Document Report Samples']
  ,['报表项', 'Report Item']
  ,['当前样例', 'Current Sample']
  ,['数据质量摘要', 'Data Quality Summary']
  ,['质量检查表', 'Quality Checklist']
  ,['刷新规则', 'Refresh Rules']
  ,['站点 Copilot', 'Station Copilot']
  ,['系统', 'System']
  ,['助手', 'Assistant']
  ,['已打开 ', 'Opened ']
  ,[' 的 Copilot 交互层。', ' in the Copilot workspace.']
  ,['建议步骤：', 'Suggested Steps:']
  ,['正在加载 Copilot 会话。', 'Loading Copilot session.']
  ,['建议步骤', 'Suggested Steps']
  ,['已排队', 'Queued']
  ,['当前对象还没有审计记录。', 'There are no audit records for the current object.']
  ,['JSON 参数', 'JSON Payload']
  ,['资源页改为统一的后端总览接口驱动，按班组、区位、设备、车辆分页面展示。', 'Resource pages now use a unified backend overview API and are split into teams, zones, devices, and vehicles.']
  ,['角色：', 'Role: ']
  ,['当前角色：', 'Current Role: ']
  ,['扫码', 'Scan']
  ,['确认', 'Confirm']
  ,['上传证据', 'Upload Evidence']
  ,['签字', 'Sign']
  ,['当前阶段', 'Current Stage']
  ,['飞走归档', 'Airborne Archived']
  ,['待处理', 'Pending']
  ,['Manifest：', 'Manifest: ']
  ,['ETD ', 'ETD ']
  ,['进港总览', 'Inbound Overview']
  ,['进港航班管理', 'Inbound Flight Management']
  ,['进港提单管理', 'Inbound AWB Management']
  ,['出港总览', 'Outbound Overview']
  ,['出港航班管理', 'Outbound Flight Management']
  ,['出港提单管理', 'Outbound AWB Management']
  ,['业务依据', 'Business Reference']
  ,['平台与货站 PRD', 'Platform and Station PRD']
  ,['后台切换', 'Switch Back Office']
  ,['平台', 'Platform']
  ,['货站', 'Station']
  ,['实施基线', 'Implementation Baseline']
  ,['当前后台基于 Mantis 的 dashboard shell 实现，所有页面统一使用它的 drawer、header、card、form 和 table 体系。', 'The current back office is built on the Mantis dashboard shell, and all pages share its drawer, header, card, form, and table system.']
  ,['已接入模块：运行态势中心、货站与资源管理、航线网络与链路配置、规则与指令引擎、主数据与接口治理、货站看板、进港、出港、提单与履约链路、单证与指令中心、作业指令中心、异常中心。', 'Integrated modules: operations center, stations and resources, network and lane configuration, rules engine, master data and integration, station dashboard, inbound, outbound, shipment fulfillment, document center, task center, and exception center.']
  ,['必须文件：', 'Required Documents: ']
  ,['放行结果：', 'Release Result: ']
  ,['阻断原因：', 'Blocking Reason: ']
  ,['恢复动作：', 'Recovery Action: ']
  ,['对象审计', 'Object Audit']
  ,['已留痕', 'Recorded']
  ,['状态迁移', 'State Transitions']
  ,['当前对象还没有审计事件。', 'There are no audit events for the current object.']
  ,['当前对象还没有状态迁移记录。', 'There are no state transition records for the current object.']
  ,['当前阻断', 'Current Blockers']
  ,['必传证据', 'Required Evidence']
  ,['暂无异常记录', 'No issue records yet']
  ,['当前没有待补传动作。', 'There are no pending sync actions right now.']
  ,['运行态势中心', 'Operations Center']
  ,['平台报表', 'Platform Reports']
  ,['Platform侧以链路健康、站点风险、接口告警、待审批ACtions和Key Events为主视角，统一观察全网履约Runtime Status势。', 'The platform side uses lane health, station risk, integration alerts, pending actions, and key events to observe network-wide fulfillment runtime status.']
  ,['Platform侧以链路健康、站点风险、接口告警、待审批动作和关键事件为主视角，统一观察全网履约运行态势。', 'The platform side uses lane health, station risk, integration alerts, pending actions, and key events to observe network-wide fulfillment status.']
  ,['Platform侧以Lane健康、Station风险、接口告警、待审批ACtions和Key Events为主视角，统一观察全网履约Runtime Status势。', 'The platform side uses lane health, station risk, integration alerts, pending actions, and key events to observe network-wide fulfillment runtime status.']
  ,['Platform级当前风险', 'Current Platform Risks']
  ,['Platform级Current Risk', 'Current Platform Risks']
  ,['已接入货站', 'Onboarded Stations']
  ,['健康站点', 'Healthy Stations']
  ,['来自 stations 表的当前接入范围', 'Current onboarded scope from the stations table']
  ,['准备度 >= 80 的站点数', 'Stations with readiness >= 80']
  ,['Open Tasks与未CloseExCeption总数', 'Total open tasks and unresolved exceptions']
  ,['开放任务与未关闭异常总数', 'Total open tasks and unresolved exceptions']
  ,['BloCked点', 'Blocked Items']
  ,['阻塞点', 'Blocked Items']
  ,['带 bloCker 的Task与ExCeption', 'Tasks and exceptions with blockers']
  ,['带 blocker 的任务与异常', 'Tasks and exceptions with blockers']
  ,['Lane与接口告警', 'Lane and Integration Alerts']
  ,['链路与接口告警', 'Lane and Integration Alerts']
  ,['装机Verify', 'Load Verification']
  ,['Key Events回放', 'Key Event Replay']
  ,['关键事件回放', 'Key Event Replay']
  ,['Station健康度矩阵', 'Station Health Matrix']
  ,['站点健康度矩阵', 'Station Health Matrix']
  ,['准备度', 'Readiness']
  ,['当前风险', 'Current Risk']
  ,['接入中', 'Onboarding']
  ,['运行稳定', 'Stable']
  ,['伯恩茅斯航站', 'Bournemouth Station']
  ,['欧陆分拨站', 'Continental Hub Station']
  ,['中亚协同站', 'Central Asia Partner Station']
  ,['中转衔接站', 'Transfer Connection Station']
  ,['货站与资源管理', 'Stations and Resources']
  ,['货站台账', 'Station Ledger']
  ,['平台方在这里维护站点目录、控制层级、服务范围和基础资源入口，为后续班组、区位、设备与站点能力矩阵预留统一基线。', 'The platform maintains the station directory, control level, service scope, and baseline resource entry points here for later team, zone, device, and capability matrix management.']
  ,['台账列表已切到数据库分页；默认每页 20 条，筛选条件变化会自动回到第一页。', 'The ledger now uses backend pagination with 20 rows by default, and filter changes reset the list to the first page.']
  ,['货站能力矩阵', 'Station Capability Matrix']
  ,['站点班组映射', 'Station Team Mapping']
  ,['班组台账', 'Team Ledger']
  ,['中班', 'Mid Shift']
  ,['东欧入口站', 'Eastern Europe Gateway']
  ,['乌鲁木齐前置站', 'Urumqi Forward Station']
  ,['班组对象现在直接从团队正式表读取，平台可以维护站点归属、班次、人数、状态和链路映射。', 'Team objects now come directly from the formal team table, so the platform can maintain station ownership, shifts, headcount, status, and lane mapping.']
  ,['班组列表已切到数据库分页；默认每页 20 条。', 'The team ledger now uses backend pagination with 20 rows by default.']
  ,['新建班组', 'New Team']
  ,['站点区位映射', 'Station Zone Mapping']
  ,['区位台账', 'Zone Ledger']
  ,['区位对象已切到正式表，平台可以维护所属站点、区位类型、链路绑定和区位状态。', 'Zone objects now come from the formal table, so the platform can maintain station ownership, zone type, lane binding, and zone status.']
  ,['区位列表已切到数据库分页；默认每页 20 条，筛选项全部来自后端选项接口。', 'The zone ledger now uses backend pagination with 20 rows by default, and all filter options come from backend option APIs.']
  ,['新建区位', 'New Zone']
  ,['航线网络与链路配置', 'Network and Lane Configuration']
  ,['站点能力情况', 'Station Capability Status']
  ,['班组数量', 'Team Count']
  ,['符号说明', 'Legend']
  ,['以正式 station governance 模板和站点主记录为读源，展示当前治理能力矩阵、准备度和风险项。', 'Using the formal station governance template and station master records as the source, this view shows the current capability matrix, readiness, and risks.']
  ,['平台侧查看单个站点的能力状态、区位映射、设备映射和班组排班情况，作为站点接入和样板站管理的统一详情页。', 'The platform views each station’s capability status, zone mapping, device mapping, and team shift allocation here as the unified detail page for onboarding and pilot station management.']
  ,['有', 'Yes']
  ,['建设中', 'In Progress']
  ,['服务口径', 'Service Scope']
  ,['进港履约、二次转运、NOA、POD', 'Inbound fulfillment, secondary transfer, NOA, and POD']
  ,['当前站点已配置班组', 'Teams configured for the current station']
  ,['区域映射管理', 'Zone Mapping']
  ,['设备映射管理', 'Device Mapping']
  ,['班组排班情况', 'Team Shift Allocation']
  ,['尾程交付区', 'Tailhaul Delivery Zone']
  ,['进港拆板区', 'Inbound Breakdown Zone']
  ,['出口组板区', 'Outbound Build-up Zone']
  ,['机坪缓存区', 'Ramp Buffer Zone']
  ,['尾程交付区', 'Tailhaul Delivery Zone']
  ,['理货复核 / NOA 放行', 'Cargo Check / NOA Release']
  ,['Document放行与Archive', 'Document Release and Archive']
  ,['DoCument放行与ArChive', 'Document Release and Archive']
  ,['到货检查与Verify', 'Arrival Check and Verification']
  ,['Task派发与Owner分配', 'Task Dispatch and Owner Assignment']
  ,['任务派发与责任分配', 'Task Dispatch and Owner Assignment']
  ,['到货检查与复核', 'Arrival Check and Verification']
  ,['单证放行与归档', 'Document Release and Archive']
  ,['进港拆板', 'Inbound Breakdown']
  ,['交付文员', 'Delivery Clerk']
  ,['理货验证', 'Cargo Verification']
  ,['理货复核', 'Cargo Review']
  ,['理货Verify', 'Cargo Verification']
  ,['机坪装卸', 'Ramp Handling']
  ,['Delivery / POD', 'Delivery / POD']
  ,['Inbound Ramp / Tailhaul', 'Inbound Ramp / Tailhaul']
  ,['RZE 接入准备', 'RZE Onboarding Preparation']
  ,['URC -> MME / MST', 'URC -> MME / MST']
  ,['MME -> Integration', 'MME -> Integration']
  ,['白班', 'Day Shift']
  ,['夜班', 'Night Shift']
  ,['待命', 'Standby']
  ,['维护中', 'Under Maintenance']
  ,['班组长', 'Team Lead']
  ,['链路绑定', 'Lane Binding']
  ,['待定', 'TBD']
  ,['新建Team', 'New Team']
  ,['新建Zone', 'New Zone']
  ,['当前任务卡只收口Platform侧Team CRUD；站内资源Page后续再按同一分Page与选项规范推进。', 'This task card only closes the platform-side team CRUD scope; station resource pages will follow the same pagination and option standards later.']
  ,['当前任务卡只收口平台侧班组 CRUD；站内资源页后续再按同一分页与选项规范推进。', 'This task card only closes the platform-side team CRUD scope; station resource pages will follow the same pagination and option standards later.']
  ,['当前没有可展示的能力模板或站点主记录。', 'There are no capability templates or station master records to display.']
  ,['数据源', 'Data Source']
  ,['平台级报表', 'Platform Reports']
  ,['审计事件明细', 'Audit Event Details']
  ,['可信留痕占位', 'Traceability Placeholder']
  ,['站点对比报表', 'Station Comparison Reports']
  ,['对比锚点', 'Comparison Anchor']
  ,['报表日期', 'Report Date']
  ,['生成时间', 'Generated At']
  ,['时区', 'Time Zone']
  ,['控制', 'Control']
  ,['质量门槛', 'Quality Gate']
  ,['锚点', 'Anchor']
  ,['指标', 'Metric']
  ,['主样板站', 'Primary Pilot Station']
  ,['问题回收列表', 'Issue Backlog']
  ,['问题', 'Issue']
  ,['严重级别', 'Severity']
  ,['下一步', 'Next Step']
  ,['追溯Relation', 'Traceability Relation']
  ,['当前最小对比集固定为“MME 真实主站 + RZE 模板对照站”', 'The minimum comparison set is fixed to "MME live hub + RZE template reference station".']
  ,['模板对照', 'Template Reference']
  ,['模板对照站', 'Template Reference Station']
  ,['真实日报', 'Live Daily Report']
  ,['模板对照站，不代表真实试运行日报', 'Template reference station; does not represent a live trial daily report.']
  ,['治理差异指标', 'Governance Variance Metrics']
  ,['差异定位路径', 'Variance Trace Path']
  ,['步骤', 'Step']
  ,['用于比较强控制站、协同控制站和待接入站之间的 SLA、闭环率和准备度差异。', 'Used to compare SLA, closure rate, and readiness differences among high-control, coordinated-control, and pending-onboarding stations.']
  ,['用于比较High Control站、Coordinated Control站和待接入站之间的 SLA、闭环率和ReadinessVarianCe。', 'Used to compare SLA, closure rate, and readiness differences among high-control, coordinated-control, and pending-onboarding stations.']
  ,['真实日报Station', 'Live Daily Report Station']
  ,['比较主样板站与模板对照站的 inbound SLA 展示口径。', 'Compare the inbound SLA display logic between the live pilot station and the template reference station.']
  ,['比较 POD Closure Rate口径YesNo一致。', 'Compare whether the POD closure-rate logic stays consistent across Yes/No cases.']
  ,['比较ExCeptionRestore与闭环时长的治理口径。', 'Compare the governance logic for exception recovery and closure time.']
  ,['比较StationReadiness和接入就绪度。', 'Compare station readiness and onboarding readiness.']
  ,['比较日报中的质量门槛展示与Station接入口径。', 'Compare the quality-gate display in daily reports with the station onboarding standard.']
  ,['Platform日报、接入模板和审计链都Required可追溯。', 'Platform reports, onboarding templates, and the audit chain must all remain traceable.']
  ,['平台日报、接入模板和审计链都必须可追溯。', 'Platform reports, onboarding templates, and the audit chain must all remain traceable.']
  ,['追溯关系', 'Traceability Relation']
  ,['先解除阻断项再继续接入。', 'Resolve blocked items before continuing onboarding.']
  ,['对照模板包、站点覆盖项和日报锚点定位差异。', 'Use the template package, station overrides, and report anchor to locate the variance.']
  ,['确认主样板站和模板对照站使用同一天同一锚点。', 'Confirm that the primary pilot station and the template reference station use the same day and the same anchor.']
  ,['确认 controlLevel、templateKey 与最小接入单元一致。', 'Confirm that the control level, template key, and minimum onboarding unit stay aligned.']
  ,['若存在 blocked，先停止接入验收。', 'If any item is blocked, stop onboarding acceptance first.']
  ,['比较 inbound SLA、POD 闭环率、异常闭环时长、准备度。', 'Compare inbound SLA, POD closure rate, exception closure time, and readiness.']
  ,['回到样板站试运行 SOP 和站点覆盖项定位差异。', 'Return to the pilot-station trial SOP and station override items to locate the variance.']
  ,['比较 POD 闭环率口径是否一致。', 'Compare whether the POD closure-rate logic stays consistent.']
  ,['比较异常恢复与闭环时长的治理口径。', 'Compare the governance logic for exception recovery and closure time.']
  ,['比较站点准备度和接入就绪度。', 'Compare station readiness and onboarding readiness.']
  ,['比较日报中的质量门槛展示与站点接入口径。', 'Compare the quality-gate display in daily reports with the station onboarding standard.']
  ,['最后回链样板 SOP', 'Final Pilot SOP Check']
  ,['接入验收对象标识。', 'Identifier for the onboarding acceptance object.']
  ,['与模板包中的站点编码一致。', 'Must match the station code in the template package.']
  ,['用于接入验收记录归档。', 'Used to archive the onboarding acceptance record.']
  ,['标识本次接入绑定的模板包。', 'Identifies the template package bound for this onboarding.']
  ,['用于确认日报锚点一致。', 'Used to confirm that the daily-report anchor is aligned.']
  ,['与日报日期保持一致。', 'Must stay aligned with the report date.']
  ,['当前固定为 RZE。', 'Currently fixed as RZE.']
  ,['记录主样板站当前指标。', 'Records the current metrics of the primary pilot station.']
  ,['记录模板对照站指标。', 'Records the metrics of the template reference station.']
  ,['记录 clear / warning / blocked 摘要。', 'Records the clear / warning / blocked summary.']
  ,['记录与模板对照站的最小差异集。', 'Records the minimum variance set against the template reference station.']
  ,['若存在 blocked，必须在接入前清零。', 'If any item is blocked, it must be cleared before onboarding.']
  ,['允许存在，但必须人工确认。', 'Allowed to exist, but must be manually acknowledged.']
  ,['固定三态：Accepted / Refine / Blocked。', 'Fixed three states: Accepted / Refine / Blocked.']
  ,['负责冻结接入结论的人。', 'The person responsible for freezing the onboarding decision.']
  ,['记录最终验收时间。', 'Records the final acceptance time.']
  ,['若验收失败，必须显式标记。', 'If acceptance fails, it must be explicitly marked.']
  ,['固定记录模板 + 配置级回滚范围。', 'Records the fixed template + configuration-level rollback scope.']
  ,['指向日报、审计、回放结果或验收附件。', 'Points to daily reports, audit trails, replay results, or acceptance attachments.']
  ,['确认主样板站和Template ReferenCe站使用同一天同一锚点。', 'Confirm that the primary pilot station and the template reference station use the same day and the same anchor.']
  ,['确认 ControlLevel、templateKey 与最小接入单元一致。', 'Confirm that the control level, template key, and minimum onboarding unit stay aligned.']
  ,['若存在 bloCked，先停止接入验收。', 'If any item is blocked, stop onboarding acceptance first.']
  ,['比较 inbound SLA、POD Closure Rate、ExCeption Closure Time、Readiness。', 'Compare inbound SLA, POD closure rate, exception closure time, and readiness.']
  ,['回到样板站试运行 SOP 和Station覆盖项定位VarianCe。', 'Return to the pilot-station trial SOP and station override items to locate the variance.']
  ,['本月允许 warning 带入接入Complete态，但Required在验收记录中明确人工确认。', 'This month allows warning items to move into the onboarding-complete state, but each one must be explicitly confirmed in the acceptance record.']
  ,['记录 warning，并在验收记录中人工确认。', 'Record the warning and confirm it manually in the acceptance record.']
  ,['对照模板包、Station覆盖项和日报锚点定位VarianCe。', 'Use the template package, station overrides, and report anchor to locate the variance.']
  ,['接入验收记录模板', 'Onboarding Acceptance Record Template']
  ,['模板包', 'Template Package']
  ,['验收结论选项', 'Acceptance Decisions']
  ,['字段', 'Field']
  ,['标签', 'Label']
  ,['必填', 'Required']
  ,['站点 ID', 'Station ID']
  ,['站点编码', 'Station Code']
  ,['站点名称', 'Station Name']
  ,['模板包键', 'Template Package Key']
  ,['实际指标快照', 'Actual Metrics Snapshot']
  ,['模板指标快照', 'Template Metrics Snapshot']
  ,['质量检查摘要', 'Quality Checklist Summary']
  ,['差异摘要', 'Variance Summary']
  ,['阻断项', 'Blocked Items']
  ,['Warning 项', 'Warning Items']
  ,['验收结论', 'Acceptance Decision']
  ,['验收人', 'Reviewer']
  ,['验收时间', 'Reviewed At']
  ,['是否需要回滚', 'Rollback Required']
  ,['回滚范围', 'Rollback Scope']
  ,['证据引用', 'Evidence Reference']
  ,['先看日报锚点', 'Check the daily-report anchor first']
  ,['再看治理模板', 'Review the governance template next']
  ,['再看质量门槛', 'Check the quality gate next']
  ,['再看核心指标VarianCe', 'Review the core metric variance next']
  ,['货站后台', 'Station Back Office']
  ,['货站看板', 'Station Dashboard']
  ,['班组 / 区位 / 设备管理', 'Teams / Zones / Devices']
  ,['班组与人员', 'Teams and Staff']
  ,['区位与 Dock', 'Zones and Docks']
  ,['PDA 设备绑定', 'PDA Device Binding']
  ,['车辆与 Collection Note', 'Vehicles and Collection Notes']
  ,['异常中心', 'Exception Center']
  ,['异常详情示例', 'Exception Detail Example']
  ,['POD 补签动作', 'POD Follow-up Actions']
  ,['货站层报表', 'Station Reports']
  ,['货站层 KPI / 报表', 'Station Reports']
  ,['班次报表', 'Shift Reports']
  ,['总览', 'Overview']
  ,['能力矩阵', 'Capability Matrix']
  ,['班组映射', 'Team Mapping']
  ,['区位映射', 'Zone Mapping']
  ,['设备映射', 'Device Mapping']
  ,['规则与指令引擎', 'Rules and Instruction Engine']
  ,['主数据与接口治理', 'Master Data and Integration']
  ,['同步看板', 'Sync Board']
  ,['导入任务', 'Import Jobs']
  ,['对象关系', 'Relationships']
  ,['审计事件', 'Audit Events']
  ,['可信占位', 'Trust Placeholder']
  ,['MME / 货站总览', 'MME / Station Overview']
  ,['URC → MME / 卡转', 'URC → MME / Cross-dock']
  ,['MME → LGG / 补段', 'MME → LGG / Add-on Leg']
  ,['统一按履约对象 / 提单聚合观察进港与出港链路', 'Observe inbound and outbound chains through fulfillment-object and AWB aggregates.']
  ,['重点跟踪进港处理与 NOA / POD', 'Focus on inbound handling together with NOA / POD.']
  ,['重点跟踪已装载 / 已飞走 / Manifest', 'Focus on loaded, airborne, and manifest progress.']
  ,['站点对比', 'Station Comparison']
  ,['站点总览', 'Station Overview']
  ,['再看核心指标差异', 'Review the core metric variance next']
  ,['本月允许 warning 带入接入完成态，但必须在验收记录中明确人工确认。', 'This month allows warning items to move into the onboarding-complete state, but each one must be explicitly confirmed in the acceptance record.']
  ,['POD 闭环率', 'POD Closure Rate']
  ,['异常闭环时长', 'Exception Closure Time']
  ,['进港管理', 'Inbound Operations']
  ,['看板', 'Dashboard']
  ,['航班管理', 'Flight Management']
  ,['提单管理', 'AWB Management']
  ,['Copilot 交互层', 'Copilot Workspace']
  ,['货描', 'Cargo Description']
  ,['路由', 'Route']
  ,['航班对象', 'Flight Object']
  ,['阻断异常', 'Blocking Exception']
  ,['目的站 / ETD', 'Destination / ETD']
  ,['当前状态', 'Current Status']
  ,['动作进度', 'Action Progress']
  ,['最近动作', 'Latest Action']
  ,['对象跳转', 'Open Object']
  ,['扫码后自动回车', 'Scan and submit automatically']
  ,['扫码后自动回车逐件累加', 'Scan and submit automatically to accumulate pieces']
  ,['阶段 ', 'Stage ']
  ,['已创建。', 'has been created.']
  ,['已更新。', 'has been updated.']
  ,['已恢复。', 'has been restored.']
  ,['已归档。', 'has been archived.']
  ,['已登记。', 'has been registered.']
  ,['未找到提单 ', 'AWB ']
  ,['，请返回提单列表重新选择。', ' was not found. Return to the list and choose another one.']
  ,['已创建航班：', 'Created flight: ']
  ,['来源 ', 'source ']
  ,['当前航班', 'Current Flight']
  ,['该航班提单：', 'AWBs for this flight: ']
  ,['当前航班提单数', 'AWB count for current flight']
  ,['理货状态', 'Count Status']
  ,['已完成 / 暂挂', 'Completed / Suspended']
  ,['航班概览', 'Flight Overview']
  ,['提单基础详情', 'AWB Details']
  ,['提单基础明细', 'AWB Details']
  ,['进港任务总览', 'Inbound Task Overview']
  ,['当前航班的拆板、理货、组托、装车和 NOA/POD 全部按统一任务卡组织。', 'All breakdown, counting, palletizing, truck loading, and NOA/POD tasks for the current flight are organized through a unified task card.']
  ,['拆板与理货任务', 'Breakdown and Counting Task']
  ,['围绕航班 SE803 执行拆板和理货，扫码即加 1，并持续校验差异。', 'Execute breakdown and counting for flight SE803, increment with every scan, and keep validating variances.']
  ,['组托任务', 'Palletizing Task']
  ,['围绕航班 SE803 组托，保持同票同托，为后续装车准备标准托盘。', 'Palletize cargo for flight SE803, keep each AWB on aligned pallets, and prepare standard pallets for truck loading.']
  ,['装车计划任务', 'Truck Loading Plan Task']
  ,['为航班 SE803 录入车牌、司机、Collection Note 和复核信息，形成装车计划。', 'Record truck plate, driver, collection note, and checker details for flight SE803 to create the loading plan.']
  ,['装车执行任务', 'Truck Loading Execution Task']
  ,['把托盘或提单装入车辆，持续校验车牌、托盘数量和完成条件。', 'Load pallets or AWBs into the truck and continuously verify truck plate, pallet count, and completion conditions.']
  ,['当前航班计划提单数', 'Planned AWB count for current flight']
  ,['已收货提单', 'Received AWBs']
  ,['当前航班已建集装器', 'Containers created for the current flight']
  ,['计划提单明细', 'Planned AWB Details']
  ,['当前航班还没有已收货提单。', 'There are no received AWBs for this flight yet.']
  ,['当前航班已有集装器', 'Current Flight Containers']
  ,['当前航班还没有集装器。', 'This flight has no containers yet.']
  ,['当前航班没有待装机集装器。', 'This flight has no containers pending loading.']
  ,['当前航班还没有已装机集装器。', 'This flight has no loaded containers yet.']
  ,['收货扫描', 'Receiving Scan']
  ,['扫描提单号', 'Scan AWB']
  ,['录入收货件数', 'Enter Received Pieces']
  ,['保存件数', 'Save Pieces']
  ,['收货件数', 'Received Pieces']
  ,['复核', 'Review']
  ,['点数', 'Count']
  ,['重开', 'Reopen']
  ,['出港收货任务', 'Outbound Receiving Task']
  ,['按 AWB 录入收货件数并完成重量复核。', 'Record received pieces by AWB and complete weight review.']
  ,['SLA 收货后 30 分钟', 'SLA within 30 minutes after receiving']
  ,['未完成收货不得打开组板和机坪放行。', 'Palletizing and ramp release cannot be opened before receiving is completed.']
  ,['组板与集装器任务', 'Pallet and Container Task']
  ,['创建集装器、录入提单并准备机坪转运。', 'Create containers, assign AWBs, and prepare ramp transfer.']
  ,['SLA 装机前 45 分钟', 'SLA 45 minutes before loading']
  ,['无集装器号或复核重量时不得打开装机。', 'Loading cannot be opened without a container code or reviewed weight.']
  ,['新建集装器', 'New Container']
  ,['追加提单', 'Add AWB']
  ,['待装机集装器', 'Containers Pending Loading']
  ,['出港装机任务', 'Outbound Loading Task']
  ,['在机坪完成转运、Loaded 确认和装机证据上传。', 'Complete transfer, loaded confirmation, and loading evidence upload on the ramp.']
  ,['SLA ETD 前 30 分钟', 'SLA 30 minutes before ETD']
  ,['无 UWS / Manifest 时不得标记已装载。', 'Loaded cannot be marked without UWS / Manifest.']
  ,['Loaded 照片', 'Loaded Photos']
  ,['机坪签名', 'Ramp Signature']
  ,['记录转运', 'Record Transfer']
  ,['进港管理 / 航班管理', 'Inbound Operations / Flight Management']
  ,['按航班管理进港作业，逐航班推进落地、进港处理、理货、NOA、交付和二次转运，并为任务和文件联动提供入口。', 'Manage inbound operations by flight, moving each flight through arrival, inbound handling, counting, NOA, delivery, and secondary transfer while linking tasks and documents.']
  ,['航班级作业', 'Flight-level Operations']
  ,['单航班动作', 'Single-flight Actions']
  ,['进港流程', 'Inbound Flow']
  ,['文件门槛', 'Document Gates']
  ,['待到达', 'Awaiting Arrival']
  ,['已落地', 'Landed']
  ,['异常关注', 'Exception Watch']
  ,['ETA 前预排、任务与单证准备', 'Pre-plan before ETA, prepare tasks and documents']
  ,['已进入进港处理 / 理货链', 'Entered inbound handling / counting flow']
  ,['延误 / 备降 / 取消需人工跟进', 'Delays / diversions / cancellations require manual follow-up']
  ,['进港航班操作台', 'Inbound Flight Operations Board']
  ,['办公室预排进港执行', 'Office-planned Inbound Execution']
  ,['后台先完成', 'Prepare in Back Office']
  ,['PDA 现场执行', 'Execute on PDA']
  ,['提前编排理货顺序、托盘规则、装车计划、车牌/司机/提货单号', 'Pre-plan counting sequence, pallet rules, truck loading plan, truck plate / driver / collection note']
  ,['点数、打托盘、按计划装车', 'Count cargo, build pallets, and load by plan']
  ,['确认二次转运优先级、NOA 节点顺序、历史托盘与库位', 'Confirm transfer priority, NOA sequence, and historical pallets / storage positions']
  ,['理货、托盘执行、货物转入下一节点', 'Complete counting, pallet execution, and move cargo to the next node']
  ,['后台托盘预排', 'Back-office Pallet Planning']
  ,['保存后会同步到移动端“历史托盘 / 预计装载目标”。', 'After saving, the result syncs to mobile as historical pallets / expected loading targets.']
  ,['当前后台托盘', 'Current Back-office Pallets']
  ,['后台装车计划编排', 'Back-office Truck Loading Plan']
  ,['预定托盘', 'Reserved Pallets']
  ,['保存装车计划', 'Save Loading Plan']
  ,['保存后会同步到移动端“预定装车计划 / 当前装车计划”。', 'After saving, the result syncs to mobile as reserved / current truck loading plans.']
  ,['出港管理 / 航班管理', 'Outbound Operations / Flight Management']
  ,['按航班管理预报、收货、装载、飞走与 Manifest 归档，并为文件放行、任务分派和对象回连提供统一入口。', 'Manage forecast, receiving, loading, departure, and manifest archiving by flight, with a unified entry for document release, task assignment, and object links.']
  ,['预报', 'Forecast']
  ,['收货', 'Receiving']
  ,['装载', 'Loading']
  ,['门槛控制', 'Gate Control']
  ,['待飞走航班', 'Flights Pending Departure']
  ,['当前在本站处理的出港航班', 'Outbound flights currently handled at this station']
  ,['出港货物数量', 'Outbound Cargo Volume']
  ,['来自航班级装载汇总', 'From flight-level loading summary']
  ,['出港航班操作台', 'Outbound Flight Operations Board']
  ,['出港航班', 'Outbound Flights']
  ,['办公室预排 ULD / 机位 / 文件', 'Office-planned ULD / Stand / Documents']
  ,['提前确认 FFM / UWS / Manifest，预排 ULD、飞机机位和机坪执行顺序', 'Confirm FFM / UWS / Manifest in advance and pre-plan ULDs, aircraft stand, and ramp execution sequence']
  ,['收货、集装器执行、机坪装机', 'Execute receiving, container handling, and ramp loading']
  ,['确认 UWS 修订版、Loaded 节点证据要求和机位绑定', 'Confirm the revised UWS, loaded-node evidence requirements, and stand binding']
  ,['现场继续装机、回填 Loaded 时间戳', 'Continue loading on site and backfill the loaded timestamp']
  ,['后台 ULD / 机位预排', 'Back-office ULD / Stand Planning']
  ,['保存 ULD 预排', 'Save ULD Plan']
  ,['保存后会同步到移动端“集装器 / 装机 / 出港机坪” demo 数据。', 'After saving, the result syncs to mobile container / loading / outbound ramp data.']
  ,['办公室预排 ULD 清单', 'Office-planned ULD List']
  ,['待编排', 'Pending Planning']
  ,['平台侧按链路维护货站协作关系、承诺时效、关键事件覆盖和节点边界。当前页已接入真实免费地图底图，用站点坐标和虚拟航线直接展示当前网络连接。', 'The platform maintains station collaboration, SLA commitments, key-event coverage, and node boundaries by lane. This page uses a live map tile source and visualizes the current network directly from station coordinates and virtual routes.']
  ,['站点连接地图', 'Station Connectivity Map']
  ,['外部协同节点', 'External Collaboration Node']
  ,['虚拟补段 / 卡转连接', 'Virtual Add-on / Cross-dock Link']
  ,['主链路矩阵', 'Primary Lane Matrix']
  ,['承诺口径', 'SLA Promise']
  ,['网络准备度', 'Network Readiness']
  ,['场景覆盖摘要', 'Scenario Coverage Summary']
  ,['场景摘要主读源已切到正式 network_scenarios。', 'Scenario summary now reads from formal `network_scenarios`.']
  ,['当前暂无场景模板。', 'There are no scenario templates right now.']
  ,['样板站优先链路', 'Pilot-station Priority Lane']
  ,['一期样板链路，覆盖 URC 到 MME 的强控制履约。', 'Phase-one pilot lane covering tightly controlled fulfillment from URC to MME.']
  ,['前置仓 -> 头程卡车 -> 出港货站 -> 出港机坪 -> Flight -> 进港机坪 -> 进港货站 -> 尾程装车 -> 交付仓', 'Pre-warehouse -> headhaul truck -> outbound station -> outbound ramp -> flight -> inbound ramp -> inbound station -> final truck loading -> delivery warehouse']
  ,['电商普货主线', 'E-commerce General Cargo Main Lane']
  ,['标准普货协同链路。', 'Standard general-cargo coordination lane.']
  ,['前置仓 -> 出港货站 -> Flight -> 进港货站', 'Pre-warehouse -> outbound station -> flight -> inbound station']
  ,['东欧入口协同链路', 'Eastern Europe Entry Coordination Lane']
  ,['RZE 接入阶段链路，用于平台网络扩展准备。', 'Lane used during the RZE onboarding phase to prepare network expansion.']
  ,['前置仓 -> 出港货站 -> Flight -> 欧陆分拨 -> 东欧入口站', 'Pre-warehouse -> outbound station -> flight -> EU hub -> Eastern Europe entry station']
  ,['标准场景 A：航班落地后拆板到装车', 'Standard Scenario A: Breakdown to truck loading after landing']
  ,['覆盖 MME 进港到尾程装车的标准节点编排。', 'Covers the standard node orchestration from MME inbound handling to final truck loading.']
  ,['关键文件齐全后才能进入下游任务', 'Downstream tasks can start only after critical documents are complete']
  ,['标准场景 B：前置仓到出港文件链', 'Standard Scenario B: Pre-warehouse to outbound document chain']
  ,['用于平台、货站与 PDA 三端对齐文件链与证据链。', 'Used to align document and evidence chains across platform, station, and PDA.']
  ,['标准场景 C：东欧协同补段异常恢复', 'Standard Scenario C: Eastern Europe add-on-leg exception recovery']
  ,['用于东欧入口站接入期的异常恢复样板。', 'Used as the exception-recovery template during Eastern Europe entry-station onboarding.']
  ,['Manifest 回传、入口站确认与异常升级同时满足后放行恢复任务', 'Release the recovery task only after manifest return, entry-station confirmation, and exception escalation are all satisfied']
  ,['Flight Delay -> 欧陆分拨重编排 -> 东欧入口站接力 -> 异常反馈 -> Recovery Dispatch', 'Flight delay -> EU hub replanning -> Eastern Europe entry handoff -> exception feedback -> recovery dispatch']
  ,['Manifest / 异常备注 / 重新编排计划 / Recovery POD', 'Manifest / exception note / replanning plan / recovery POD']
  ,['规则对象已切到正式表，平台现在直接维护规则类型、控制层级、适用范围、时间线阶段和作用对象，列表/下拉/辅助时间线均来自数据库。', 'Rule objects now come from formal tables. The platform directly maintains rule type, control level, applicability scope, timeline stage, and target objects, while lists, selects, and helper timelines all come from the database.']
  ,['交付闭环必须带 POD 证据', 'Delivery closure requires POD evidence']
  ,['尾程交付任务只有在上传 POD 图片或签收凭据后才能闭环。', 'Final-mile delivery can close only after a POD photo or receipt proof is uploaded.']
  ,['NOA 超时自动升级异常', 'NOA timeout auto-escalates to exception']
  ,['NOA 超过目标时限未完成时，自动升级为平台异常并要求站点主管介入。', 'If NOA is not completed within the target SLA, it auto-escalates to a platform exception and requires station-supervisor intervention.']
  ,['关键单证齐套后才能放行下游任务', 'Downstream tasks release only after critical documents are complete']
  ,['Manifest、FFM、UWS、NOA 等关键单证未齐套时，不允许生成或放行下游任务。', 'Downstream tasks cannot be generated or released until critical documents such as Manifest, FFM, UWS, and NOA are complete.']
  ,['FFM/UWS 接口 15 分钟内完成回传', 'FFM/UWS interfaces must return within 15 minutes']
  ,['URC -> MME 样板链路要求 FFM/UWS 在关键节点后 15 分钟内完成回传。', 'The URC -> MME pilot lane requires FFM/UWS return within 15 minutes after the key node.']
  ,['标准场景 A 进入规则模板', 'Standard Scenario A enters the rule template']
  ,['标准场景 A 在航班落地、拆板资源就绪、证据策略满足后自动进入执行编排。', 'Standard Scenario A automatically enters execution once landing, breakdown resources, and evidence policy are all ready.']
  ,['P1 高时效履约优先级', 'P1 High-speed Fulfillment Priority']
  ,['高时效与高优先级货物默认前置抢占收货、装载、进港理货和尾程交付资源。', 'High-speed and high-priority cargo preempts receiving, loading, inbound counting, and final-mile delivery resources by default.']
  ,['P2 标准履约基线', 'P2 Standard Fulfillment Baseline']
  ,['标准履约货物按统一 SLA 推进，异常升级后切换强控制。', 'Standard-fulfillment cargo follows the unified SLA and switches to strict control after escalation.']
  ,['进港拆板自动任务模板', 'Inbound Breakdown Auto-task Template']
  ,['航班落地且 CBA/Manifest 到齐后，自动生成拆板、理货复核和尾程交接任务。', 'Once the flight lands and CBA/Manifest are complete, breakdown, counting review, and final-mile handover tasks are auto-generated.']
  ,['收货准入', 'Receiving Admission']
  ,['主数据台账已切到正式数据库 CRUD；列表默认后端分页 20 条，筛选与表单下拉全部来自 DB options，新建/编辑统一走右侧 Drawer。', 'Master Data Registry now uses formal database CRUD; lists default to backend pagination with 20 rows, filters and form selects all come from DB options, and create/edit flows use the right-side drawer.']
  ,['为状态放行与模板指令提供基础', 'Provides the foundation for state release and template instructions']
  ,['当前仅做前端可信留痕占位', 'Currently only a frontend trust placeholder']
  ,['统一 Runtime / Fulfillment 双状态口径', 'Unifies runtime and fulfillment status semantics']
  ,['贯穿航班、文件、任务、异常、POD', 'Spans flights, documents, tasks, exceptions, and POD']
  ,['尾程与二次转运模型需统一', 'Final-mile and secondary-transfer models need unification']
  ,['部分链路仍缺与 UWS 的统一映射', 'Some lanes still lack a unified mapping to UWS']
  ,['同步看板', 'Sync Board']
  ,['重跑增量同步 / 切换人工核对', 'Rerun incremental sync / switch to manual verification']
  ,['重跑航班抽取 / 切人工锁定', 'Rerun flight extraction / switch to manual lock']
  ,['重放司机状态 / 切短信兜底', 'Replay driver status / switch to SMS fallback']
  ,['补拉主文件 / 生成人工补录清单', 'Refetch master files / generate manual completion list']
  ,['恢复回放 / 导出差异报告', 'Resume replay / export diff report']
  ,['重放队列 / 触发值班复核', 'Replay queue / trigger on-duty review']
  ,['导入任务', 'Import Jobs']
  ,['排队中', 'Queued']
  ,['POD 历史重放已归档', 'POD historical replay archived']
  ,['UWS 装板回放失败', 'UWS loading replay failed']
  ,['FFM 航班增量入库完成', 'FFM flight incremental import completed']
  ,['航班视图重建进行中', 'Flight view rebuild in progress']
  ,['Manifest 批次部分成功', 'Manifest batch partially succeeded']
  ,['重放', 'Replay']
  ,['对象关系', 'Object Relationships']
  ,['签收闭环', 'Receipt Closure']
  ,['承运', 'Carries']
  ,['派车', 'Dispatches']
  ,['集拼', 'Consolidates']
  ,['触发', 'Triggers']
  ,['DoCument佐证', 'Document Evidence']
  ,['AWB 176-12345675 由交接单 DOC-HANDOVER-20260416-01 佐证。', 'AWB 176-12345675 is evidenced by handover note DOC-HANDOVER-20260416-01.']
  ,['AWB 176-12345675 被集拼到 PMC-778812。', 'AWB 176-12345675 is consolidated into PMC-778812.']
  ,['异常事件 EVT-HANDOVER-20260416-08 触发对 AWB 176-12345675 的补录任务。', 'Exception event EVT-HANDOVER-20260416-08 triggers a completion task for AWB 176-12345675.']
  ,['Flight CX138/2026-04-16/MME 直接承运 AWB 176-12345675。', 'Flight CX138/2026-04-16/MME directly carries AWB 176-12345675.']
  ,['航班到货后由 TRUCK-MME-09 承接尾程派送。', 'TRUCK-MME-09 handles final-mile delivery after the flight arrives.']
  ,['POD-20260416-0008 完成 AWB 176-12345675 的签收闭环。', 'POD-20260416-0008 completes receipt closure for AWB 176-12345675.']
  ,['平台与货站的关键动作都应在这里可追溯，包括站点创建、规则修改、文件导入、POD 上传、状态回退和可信字段预留。', 'Key platform and station actions should be traceable here, including station creation, rule changes, document imports, POD uploads, state rollbacks, and reserved trust fields.']
  ,['关键审计事件', 'Key Audit Events']
  ,['时间', 'Time']
  ,['动作人', 'Actor']
  ,['对象', 'Object']
  ,['结果', 'Result']
  ,['回溯对象、变更前后值、文件导入和状态回退等细粒度事件。', 'Review fine-grained events such as object trace-back, before/after values, document imports, and state rollbacks.']
  ,['返回审计总览', 'Back to Audit Overview']
  ,['当前页不做链上公证，但已基于真实审计事件和状态迁移生成可信字段预览，便于后续接签名、公证和哈希存证。', 'This page does not perform on-chain notarization, but it already builds trusted-field previews from real audit events and state transitions for future signature, notarization, and hash references.']
  ,['可信写入说明', 'Trusted Write Description']
  ,['当前字段来自真实 `audit_events` 与 `state_transitions`，哈希与签名引用仍为预览值。', 'The current fields come from real `audit_events` and `state_transitions`, while hash and signature references are still preview values.']
  ,['后续若接签名、公证或对象存证，只需要把当前 `Event ID / Hash / Signature Ref / Notarization Ref` 结构落到正式后端即可。', 'If signatures, notarization, or object evidence are connected later, only the current `Event ID / Hash / Signature Ref / Notarization Ref` structure needs to be persisted in the formal backend.']
  ,['可信字段预览', 'Trusted Field Preview']
  ,['展示平台层 KPI、链路 SLA、接口稳定性、异常分布和站点准备度。', 'Show platform KPIs, lane SLAs, interface stability, exception distribution, and station readiness.']
  ,['平台接入站点', 'Stations on Platform']
  ,['当前参与平台态势视图的站点', 'Stations currently included in the platform overview']
  ,['高可用站点', 'Highly Available Stations']
  ,['按任务完成率与阻断异常计算', 'Calculated from task completion and blocking exceptions']
  ,['平台告警', 'Platform Alerts']
  ,['任务与异常中的阻断项', 'Blocking items in tasks and exceptions']
  ,['最近审计', 'Latest Audits']
  ,['审计事件回放条数', 'Audit event replay count']
  ,['平台日报核心指标', 'Platform Daily Core Metrics']
  ,['日报分组', 'Daily Section']
  ,['当前值', 'Current Sample']
  ,['任务流转', 'Task Flow']
  ,['异常分布', 'Exception Distribution']
  ,['文档闭环', 'Document Closure']
  ,['站点准备度', 'Station Readiness']
  ,['质量检查表', 'Quality Checklist']
  ,['平台闸口状态', 'Platform Gate Status']
  ,['当日平台层无开放质量问题', 'There are no open platform-level quality issues today']
  ,['继续跟踪开放 Issue，并在日报中暴露趋势', 'Keep tracking open issues and expose the trend in the daily report']
  ,['阻断候选站点', 'Blocker Candidate Stations']
  ,['暂无阻断候选站点', 'No blocker candidate stations at the moment']
  ,['无需追加站点级阻断处理', 'No additional station-level blocker handling is required']
  ,['严重度分布', 'Severity Distribution']
  ,['暂无开放质量问题', 'There are no open quality issues at the moment']
  ,['按严重度排序开放日报、治理页和月度复盘', 'Rank open daily reports, governance pages, and monthly reviews by severity']
  ,['刷新规则', 'Refresh Rules']
  ,['补算范围', 'Backfill Scope']
  ,['平台 + 日期', 'Platform + Date']
  ,['质量回链', 'Quality Backlink']
  ,['平台日报必须显式暴露质量摘要与检查表', 'The platform daily report must explicitly expose the quality summary and checklist']
  ,['进港机场货站操作', 'Inbound Airport Station Operations']
  ,['当前航班的拆板、理货、组托、装车和 NOA/POD 全部按统一任务卡组织。', 'All breakdown, counting, palletizing, truck loading, and NOA/POD tasks for the current flight are organized through unified task cards.']
  ,['当前航班提单数', 'Current Flight AWB Count']
  ,['SLA 落地后 12h', 'SLA within 12h after landing']
  ,['关键文件不齐时，只允许展示任务，不允许放行。', 'Tasks may be shown but cannot be released when critical documents are incomplete.']
  ,['任务状态回填', 'Task Status Backfill']
  ,['关键节点时间戳', 'Key Node Timestamps']
  ,['理货完成', 'Counting Complete']
  ,['扫描提单', 'Scan AWB']
  ,['扫描提单号 / 箱号', 'Scan AWB / Box Code']
  ,['件码枪扫描后的回车会直接被识别成一次确认，并自动完成点数加 1。', 'A scanner-enter event is treated as one confirmation and automatically increments the count by 1.']
  ,['使用 PDA 件码枪扫描提单后，会直接打开该票的计数器。', 'After scanning an AWB with the PDA scanner, the counter for that AWB opens immediately.']
  ,['扫描到航班外提单时必须先确认是否纳入统计。', 'When an AWB outside the flight is scanned, confirm whether it should be included first.']
  ,['托盘动作', 'Pallet Actions']
  ,['先浏览该航班已有托盘，再打开新页面新建托盘。每完成一个托盘后，会回到这里继续下一轮动作。', 'Review existing pallets for the flight first, then open a new page to create another one. After each pallet is completed, return here for the next action.']
  ,['打印标签', 'Print Label']
  ,['箱数 / 重量', 'Boxes / Weight']
  ,['托盘标签', 'Pallet Label']
  ,['装车计划', 'Loading Planned']
  ,['装车计划应由后台办公室先完成编排，包括车牌、司机、提货单号与预定托盘；PDA 仅执行已排好的计划。', 'Truck loading plans should be prepared first in the back office, including truck plate, driver, collection note, and reserved pallets; the PDA only executes prepared plans.']
  ,['去后台排计划', 'Open Back-office Planning']
  ,['预定装车计划', 'Reserved Loading Plans']
  ,['待补司机', 'Driver Pending']
  ,['尾程卡车装车与运输', 'Final-mile Truck Loading and Transport']
  ,['当前角色 Supervisor / Verify 仅可查看，不可执行 Check Worker Task。', 'The current role Supervisor / Verify can only view and cannot execute worker tasks.']
  ,['当前角色 Supervisor / Verify 仅可查看，不可执行 Pallet Builder Task。', 'The current role Supervisor / Verify can only view and cannot execute pallet-builder tasks.']
  ,['当前角色 Supervisor / Verify 仅可查看，不可执行 Loading Coordinator Task。', 'The current role Supervisor / Verify can only view and cannot execute loading-coordinator tasks.']
  ,['出港机场货站操作', 'Outbound Airport Station Operations']
  ,['出港货站任务总览', 'Outbound Station Task Overview']
  ,['统一展示航班 SE913 的收货、理货、组板、集装器和装机准备任务。', 'Show receiving, counting, palletizing, container, and loading-preparation tasks for flight SE913 in one place.']
  ,['SLA 飞走前闭环', 'SLA closed before departure']
  ,['Manifest 未冻结前不得飞走归档。', 'Departure archive cannot proceed before the manifest is frozen.']
  ,['主单信息', 'Master Information']
  ,['计划提单明细', 'Planned AWB Details']
  ,['目的地 Integration Notify · Planned Pieces 20 · Planned Weight 200.5 kg', 'Destination Integration Notify · Planned Pieces 20 · Planned Weight 200.5 kg']
  ,['扫描后自动回车', 'Scan and submit automatically']
  ,['先扫描一个提单号，再录入该提单的收货件数。', 'Scan an AWB first, then enter the received pieces for that AWB.']
  ,['当前航班还没有历史托盘记录。', 'There are no historical pallets for this flight yet.']
  ,['当前航班还没有预定装车计划。', 'There are no reserved loading plans for this flight yet.']
  ,['航班管理', 'Flight Management']
  ,['提单管理', 'AWB Management']
  ,['履约状态', 'Fulfillment Status']
  ,['任务中心', 'Task Center']
  ,['门槛检查', 'Gate Check']
  ,['当前门槛判定', 'Current Gate Decision']
  ,['允许补发', 'Retry Allowed']
  ,['无需', 'Not Required']
  ,['已发送', 'Sent']
  ,['等待双签', 'Awaiting Dual Signature']
  ,['双签', 'Dual Signature']
  ,['履约对象已冻结为 AWB 投影 / 履约聚合对象。列表与详情都直接读取数据库聚合 DTO，不再依赖前端本地适配真相。', 'The fulfillment object is frozen as an AWB projection / fulfillment aggregate. Lists and details both read database aggregate DTOs directly and no longer depend on frontend local-adapter truth.']
  ,['履约对象投影', 'Fulfillment Object Projection']
  ,['数据库聚合 DTO', 'Database Aggregate DTO']
  ,['只读优先资源', 'Read-first Resource']
  ,['对象\t方向\t关联航班\t当前节点\t履约状态\t文件\t任务\t阻断原因\t操作', 'Object\tDirection\tAssigned Flight\tCurrent Node\tFulfillment Status\tDocuments\tTasks\tBlocker Reason\tActions']
  ,['Manifest 未冻结，当前不可打开飞走归档', 'Manifest is not frozen; departure archive cannot be opened yet']
  ,['履约详情页直接回连真实 AWB、单证、任务、异常 和对象审计。', 'The fulfillment detail page links directly to real AWBs, documents, tasks, exceptions, and object audit records.']
  ,['Flight 已落地并打开进港处理。', 'The flight has landed and inbound handling is open.']
  ,['拆板、理货与 Verify 按票推进。', 'Breakdown, counting, and verification progress by AWB.']
  ,['命中 Gate 时必须先清阻断。', 'If a gate is hit, the blocker must be cleared first.']
  ,['POD 完成归档后允许关闭。', 'Closure is allowed only after the POD is archived.']
  ,['需要证据', 'Evidence Required']
  ,['理货放行', 'Counting Release']
  ,['Manifest 仍待冻结或补齐。', 'Manifest still needs to be frozen or completed.']
  ,['POD 已归档，可支持交付闭环。', 'POD is archived and can support delivery closure.']
  ,['Manifest 已冻结，可支持后续放行。', 'Manifest is frozen and can support subsequent release.']
  ,['当前 CBA 状态为 Uploaded。', 'The current CBA status is Uploaded.']
  ,['关键文件齐全后才能推进下游动作。', 'Downstream actions can proceed only after critical files are complete.']
  ,['任务围绕 Shipment / AWB / Flight 三个对象分发。', 'Tasks are distributed around the three objects Shipment / AWB / Flight.']
  ,['存在异常时必须先解除阻断。', 'When an exception exists, the blocker must be cleared first.']
  ,['履约对象审计', 'Fulfillment Object Audit']
  ,['改为由站点资源总览 API 驱动，直接展示 Team、Shift、Owner 和 Status。', 'Now driven by the station resource overview API and directly shows team, shift, owner, and status.']
  ,['人员', 'Staff']
  ,['返回资源总览', 'Back to Resource Overview']
  ,['区位与月台', 'Zones and Docks']
  ,['查看站内区位 / 月台类型和状态，作为第二批放行与任务分配基线。', 'Review in-station zone / dock type and status as the baseline for release and task allocation.']
  ,['月台', 'Dock']
  ,['按站点、角色和设备视图 PDA 设备绑定关系。', 'View PDA device bindings by station, role, and device.']
  ,['角色映射', 'Role Mapping']
  ,['设备绑定', 'Device Binding']
  ,['车辆与提货单号', 'Vehicles and Collection Notes']
  ,['车辆对象已切到正式 trucks 表，列表默认走后端分页 20 条，创建和编辑统一在右侧 Drawer 内完成。', 'Vehicle objects now use the formal `trucks` table, lists default to backend pagination with 20 rows, and create/edit operations are completed in the right-side drawer.']
  ,['车辆与提货单号', 'Vehicles and Collection Notes']
  ,['流程 / 路线', 'Flow / Route']
  ,['车辆台账', 'Vehicle Registry']
  ,['筛选与表单下拉全部来自数据库 Options 接口；写动作会落审计。', 'Filters and form selects all come from database-backed option APIs, and write actions generate audit records.']
  ,['头程', 'Headhaul']
  ,['尾程', 'Final Mile']
  ,['待发车', 'Pending Dispatch']
  ,['在途', 'In Transit']
  ,['未配置司机', 'Driver Not Configured']
  ,['Shift 粒度报表', 'Shift-level Reports']
  ,['按 Shift / Team 展示第二批主营演示链路中的日报、周报 demo。', 'Display daily and weekly demos for the phase-two main-operation lane by shift / team.']
  ,['日报 / 周报', 'Daily / Weekly']
  ,['审计', 'Audit']
  ,['状态流转', 'State Transitions']
  ,['进港 / 移动终端', 'Inbound / Mobile Operations Terminal']
  ,['站点后台只展示真实移动任务、状态和快捷入口；具体执行打开真实 PDA 页面完成。', 'The station back office shows only real mobile tasks, status, and quick links; specific execution opens the real PDA page.']
  ,['真实移动任务', 'Live Mobile Tasks']
  ,['打开节点选择', 'Open Node Selection']
  ,['打开进港 PDA', 'Open Inbound PDA']
  ,['任务总数', 'Task Count']
  ,['当前进港移动任务', 'Current Inbound Mobile Tasks']
  ,['待接单/待开始', 'Pending Accept / Pending Start']
  ,['队列', 'Queue']
  ,['已创建 / 已分派 / 已接单', 'Created / Assigned / Accepted']
  ,['执行中', 'In Progress']
  ,['已开始 / 已上传证据', 'Started / Evidence Uploaded']
  ,['已完成 / 已复核 / 已关闭', 'Completed / Reviewed / Closed']
  ,['当前航班没有移动任务。', 'There are no mobile tasks for the current flight.']
  ,['打开航班总览', 'Open Flight Overview']
  ,['拆板理货', 'Breakdown & Counting']
  ,['装车执行', 'Truck Loading Execution']
  ,['进港拆板主终端', 'Primary Inbound Breakdown Terminal']
  ,['交付签收终端', 'Delivery Signature Terminal']
  ,['理货复核备用设备', 'Counting Review Backup Device']
  ,['机坪平板终端', 'Ramp Tablet Terminal']
  ,['平板终端', 'Tablet Terminal']
  ,['RZE 建设期配置工位', 'RZE Build-phase Workstation']
  ,['东欧入口站', 'Eastern Europe Entry Station']
  ,['固定工位终端', 'Fixed Workstation Terminal']
  ,['站点主管', 'Station Supervisor']
  ,['URC 出港收货 PDA', 'URC Outbound Receiving PDA']
  ,['乌鲁木齐前置站', 'Urumqi Pre-warehouse Station']
  ,['URC 机坪扫码枪', 'URC Ramp Scanner']
  ,['扫码枪', 'Scanner']
  ,['场景模板', 'Scenario Templates']
  ,['Manifest、出港数据交换、到港回传', 'Manifest, outbound data exchange, and arrival return']
  ,['飞行在途衔接、卡车分拨、状态回传', 'In-transit flight connection, truck distribution, and status return']
  ,['进港分拨、二次卡车转运、NOA', 'Inbound distribution, secondary truck transfer, and NOA']
  ,['ETA 联动、落地准备、中转计划', 'ETA linkage, landing preparation, and transfer planning']
  ,['进港处理、异常回传、区域交付', 'Inbound handling, exception return, and regional delivery']
  ,['出港前置、预报、收货、主单、发运', 'Outbound preparation, forecast, receiving, master, and dispatch']
  ,['规则对象已切到正式表，平台现在直接维护规则类型、控制层级、适用范围、时间线阶段和作用目标，列表/下拉/辅助时间线均来自数据库。', 'Rule objects now use formal tables; the platform directly maintains rule type, control level, applicability scope, timeline stage, and action target, while lists, selects, and helper timelines all come from the database.']
  ,['任务放行', 'Task Release']
  ,['证据校验', 'Evidence Validation']
  ,['异常恢复', 'Exception Recovery']
  ,['接口同步', 'Interface Sync']
  ,['任务模板', 'Task Template']
  ,['硬门槛', 'Hard Gate']
  ,['异常处置', 'Exception Handling']
  ,['场景编排', 'Scenario Orchestration']
  ,['平台全局', 'Platform Global']
  ,['MME · MME Trial Station', 'MME · MME Trial Station']
  ,['运单 / 提单', 'AWB / Shipment']
  ,['正式业务表', 'Formal Business Table']
  ,['接口导入链', 'Interface Import Chain']
  ,['单证仓', 'Document Repository']
  ,['审计事件流', 'Audit Event Stream']
  ,['同步看板', 'Sync Board']
  ,['失败时保留上一版舱单映射', 'Keep the previous manifest mapping if the sync fails']
  ,['失败时沿用上一航班快照', 'Reuse the previous flight snapshot if the sync fails']
  ,['回落至司机上次确认回执', 'Fallback to the driver’s last confirmed receipt']
  ,['缺字段时保留上一版本 manifest', 'Keep the previous manifest version when fields are missing']
  ,['暂停写入，仅保留事件对账', 'Pause writes and keep only event reconciliation']
  ,['降级到上次成功装板结果', 'Degrade to the last successful loading-board result']
  ,['成功', 'Success']
  ,['部分成功', 'Partial Success']
  ,['重试', 'Retry']
  ,['对象关系', 'Object Relationships']
  ,['事件', 'Event']
  ,['平台与货站的关键动作都应在这里可追溯，包括站点创建、规则修改、文件导入、POD 上传、状态回退和可信字段预留。', 'Key platform and station actions should be traceable here, including station creation, rule changes, document imports, POD uploads, state rollbacks, and reserved trusted fields.']
  ,['时间\t动作人\t动作\t对象\t结果\t备注', 'Time\tActor\tAction\tObject\tResult\tRemarks']
  ,['查看对象回溯、变更前后值、文件导入和状态回退等细粒度事件。', 'Review fine-grained events such as object trace-back, before/after values, document imports, and state rollbacks.']
  ,['未设置', 'Not Set']
  ,['已恢复', 'Restored']
  ,['日表分组\t指标\t当前值\t说明', 'Daily Section\tMetric\tCurrent Sample\tDescription']
  ,['开放 / 阻断 / 已恢复', 'Open / Blocking / Restored']
  ,['28 份文档开放日报范围', '28 documents in the open daily-report scope']
  ,['45 个站点参与平台日报', '45 stations participate in the platform daily report']
  ,['继续跟踪开放 Issue，并在日报中暴露趋势', 'Keep tracking open issues and expose the trend in the daily report']
  ,['暂无阻断候选站点', 'No blocker candidate stations at the moment']
  ,['无需额外站点级阻断处理', 'No additional station-level blocker handling is required']
  ,['按严重度排序开放日报、治理页和月度复盘', 'Rank open daily reports, governance pages, and monthly reviews by severity']
  ,['全量重算', 'Full Recompute']
  ,['平台 + 日期', 'Platform + Date']
  ,['2/10 票已触发 NOA', '2/10 AWBs triggered NOA']
  ,['PMC 拆板 -> 理货完成', 'PMC breakdown -> counting complete']
  ,['必须为 Released / Approved / Validated', 'Must be Released / Approved / Validated']
  ,['达到可放行状态', 'Reach releasable status']
  ,['仍阻断 NOA / POD / 放行链路', 'Still blocks the NOA / POD / release lane']
  ,['Manifest 仍未完成校验', 'Manifest validation is still incomplete']
  ,['CBA 仍未完成校验', 'CBA validation is still incomplete']
  ,['补传或批准后重试对应动作', 'Retry the related action after re-upload or approval']
  ,['Flight 链路上的阻断项', 'Blocking items on the flight lane']
  ,['CBA 仍未达到放行状态', 'CBA has not reached release status']
  ,['补传、校验或批准后再推进后续任务', 'Re-upload, validate, or approve before proceeding to downstream tasks']
  ,['移动终端', 'Mobile Operations Terminal']
  ,['站点后台只展示真实移动任务、状态和快捷入口；具体执行打开真实 PDA 页面完成。', 'The station back office shows only live mobile tasks, status, and quick links; actual execution opens the real PDA page.']
  ,['待接单/待开始', 'Pending Accept / Pending Start']
  ,['已创建 / 已分派 / 已接单', 'Created / Assigned / Accepted']
  ,['进行中', 'In Progress']
  ,['已装载', 'Loaded']
  ,['满足 Loaded 前置条件后执行。', 'Execute after loaded prerequisites are satisfied.']
  ,['先完成 Loaded。 / Manifest 已冻结，可继续执行 Airborne。', 'Complete Loaded first. / Manifest is frozen, so Airborne can continue.']
  ,['先完成 Loaded。 / 当前航班已飞走，无需重复执行。', 'Complete Loaded first. / The current flight has already departed, so no repeat execution is required.']
  ,['继续按 Loaded -> Manifest Finalize -> Airborne 顺序推进', 'Continue in the order Loaded -> Manifest Finalize -> Airborne']
  ,['履约详情页直接回连真实 AWB、单证、任务、异常和对象审计。', 'The fulfillment detail page links directly to real AWBs, documents, tasks, exceptions, and object audit records.']
  ,['Flight 已落地并打开进港处理。', 'The flight has landed and inbound handling is open.']
  ,['POD 完成归档后允许 Closed。', 'Closed is allowed after the POD archive is completed.']
  ,['无门槛 · 需要证据', 'No Gate · Evidence Required']
  ,['类型\t文件名\t门槛\t状态\t关联任务\t说明', 'Type\tFile Name\tGate\tStatus\tRelated Tasks\tDescription']
  ,['PMC 拆板任务', 'PMC Breakdown Task']
  ,['Breakdown Operations门槛', 'Breakdown Operations Gate']
  ,['命中 HG-01 需要先解除阻断。', 'HG-01 is hit and the blocker must be cleared first.']
  ,['完成拆板并补齐证据', 'Complete breakdown and complete the evidence']
  ,['InventoryCheck Operations门槛', 'Inventory Check Operations Gate']
  ,['命中 HG-03 需要先解除阻断。', 'HG-03 is hit and the blocker must be cleared first.']
  ,['完成 InventoryCheck 并补齐证据', 'Complete inventory check and complete the evidence']
  ,['已满足单证门槛', 'Document gates are already satisfied']
  ,['无需补充动作', 'No additional action required']
  ,['Shipment 与 Master 一一关联。', 'Shipment has a one-to-one relationship with the master']
  ,['重试策略', 'Retry Policy']
  ,['根据当前 AWB 状态决定是否允许发送', 'Whether sending is allowed depends on the current AWB status']
  ,['根据签收和 POD 状态决定是否允许关闭', 'Whether close is allowed depends on receipt and POD status']
  ,['PMC 拆板后必须核对板号与件数', 'Pallet ID and pieces must be verified after PMC breakdown']
  ,['完成差异复核并更新理货结论', 'Complete variance review and update the counting conclusion']
  ,['改为由站点资源总览 API 驱动，直接展示 Team、Shift、Owner 和 Status。', 'Now driven by the station resource overview API and directly shows team, shift, owner, and status.']
  ,['按站点、角色和设备视图 PDA 设备绑定关系。', 'View PDA device bindings by station, role, and device.']
  ,['筛选与表单下拉全部来自数据库 Options 接口；写动作会落审计。', 'Filters and form selects all come from database-backed option APIs; write actions create audit records.']
  ,['新建车辆', 'New Vehicle']
  ,['行程号\t流程 / 路线\t车牌 / 司机\t提货单号\t状态\t优先级\t操作', 'Trip ID\tFlow / Route\tTruck Plate / Driver\tCollection Note\tStatus\tPriority\tActions']
  ,['未关联 AWB', 'No AWB Linked']
  ,['继续执行日报巡检，无需额外阻断动作', 'Continue daily inspection; no extra blocking action is required']
  ,['维持开放 Issue 跟踪，不触发导入阻断', 'Keep tracking open issues without triggering import blockers']
  ,['当日无需打开质量 Issue 复盘', 'No quality issue review needs to be opened today']
  ,['按 Shift / Team 展示第二批主营演示链路中的日报、周报 demo。', 'Display daily and weekly demos for the phase-two main-operation lane by shift / team.']
  ,['返回报表总览', 'Back to Report Overview']
  ,['Headhaul卡车', 'Headhaul Truck']
  ,['Final Mile装车', 'Final-mile Loading']
  ,['SLA 落地后 12h', 'SLA within 12h after landing']
  ,['件码枪扫描后的回车会直接被识别成一次确认，并自动完成点数加 1。', 'A scanner-enter event is treated as one confirmation and automatically increments the count by 1.']
  ,['使用 PDA 件码枪扫描 AWB 后，会直接打开该票的计数器。', 'After scanning an AWB with the PDA scanner, the counter for that AWB opens immediately.']
  ,['SLA 理货节点 30 分钟初判', 'SLA initial count assessment within 30 minutes']
  ,['未完成理货不得发送 NOA。', 'NOA cannot be sent before counting is completed.']
  ,['当前角色 Supervisor / Verify 仅可查看，不可执行 Check Worker Task。', 'The current role Supervisor / Verify can only view and cannot execute check-worker tasks.']
  ,['AWB / 箱号扫描记录', 'AWB / Box-code Scan Records']
  ,['托盘动作', 'Pallet Actions']
  ,['先浏览该航班已有托盘，再打开新页面新建托盘。每完成一个托盘后，会回到这里继续下一轮动作。', 'Review the pallets already created for this flight first, then open a new page to create a pallet. After each pallet is completed, return here for the next action.']
  ,['12 箱 / 120.5 kg / 1 票', '12 boxes / 120.5 kg / 1 AWB']
  ,['SLA 理货完成后立即执行', 'SLA execute immediately after counting completion']
  ,['不同 Consignee 不得混托。', 'Different consignees must not be mixed on one pallet.']
  ,['当前角色 Supervisor / Verify 仅可查看，不可执行 Pallet Builder Task。', 'The current role Supervisor / Verify can only view and cannot execute pallet-builder tasks.']
  ,['Loading Planned应由后台办公室先完成编排，包括车牌、司机、提货单号与预定托盘；PDA 仅执行已排好的计划。', 'Loading plans should be prepared first in the back office, including truck plate, driver, collection note, and reserved pallets; the PDA only executes prepared plans.']
  ,['Driver Pending · CN-INT-001 · 1 托盘', 'Driver Pending · CN-INT-001 · 1 pallet']
  ,['SLA 车辆到场后 15 分钟内启动', 'SLA start within 15 minutes after vehicle arrival']
  ,['未录入车牌、提货单号、核对员时不得开始装车。', 'Truck loading cannot start before truck plate, collection note, and checker are entered.']
  ,['当前角色 Supervisor / Verify 仅可查看，不可执行 Loading Coordinator Task。', 'The current role Supervisor / Verify can only view and cannot execute loading-coordinator tasks.']
  ,['来自航班计划数据', 'From flight planned data']
  ,['已开始收货的 AWB', 'AWBs with receiving started']
  ,['SLA 飞走前闭环', 'SLA closed before departure']
  ,['当前角色 Supervisor / Verify 仅可查看，不可执行 Export Receiver Task。', 'The current role Supervisor / Verify can only view and cannot execute export-receiver tasks.']
  ,['ULD / 集装器应由后台办公室先完成预排并分配机位；PDA 仅执行已排好的集装与装机。', 'ULDs / containers should be pre-planned and assigned to stands in the back office; the PDA only executes planned containerization and loading.']
  ,['去后台排 ULD', 'Open Back-office ULD Planning']
  ,['1 AWBs / 20 箱 / 202.1 kg', '1 AWB / 20 boxes / 202.1 kg']
  ,['装货', 'Load']
  ,['无集装器号或复核重量时不得打开装机。', 'Loading cannot be opened without a container number or reviewed weight.']
  ,['集装器号', 'Container Code']
  ,['AWB清单', 'AWB List']
  ,['1 AWBs / 20 箱 / 复核 202.1 kg', '1 AWB / 20 boxes / reviewed 202.1 kg']
  ,['装机', 'Load to Aircraft']
  ,['出港机场机坪操作', 'Outbound Airport Ramp Operations']
  ,['任务入口', 'Task Entry']
  ,['AWB资源', 'AWB Resources']
  ,['出港流程', 'Outbound Flow']
  ,['待到达', 'Awaiting Arrival']
  ,['3 / 9 票', '3 / 9 AWBs']
  ,['4 / 9 票', '4 / 9 AWBs']
  ,['0 / 9 票', '0 / 9 AWBs']
  ,['ETA 前预排、任务与单证准备', 'Pre-plan before ETA, prepare tasks and documents']
  ,['已进入进港处理 / 理货链', 'Entered inbound handling / counting flow']
  ,['异常关注', 'Exception Watch']
  ,['延误 / 备降 / 取消需人工跟进', 'Delays / diversions / cancellations require manual follow-up']
  ,['提货单号', 'Collection Note']
  ,['TRUCK PLATE\t提货单号\tRESERVED PALLETS\tSTATUS\tACTIONS', 'Truck Plate\tCollection Note\tReserved Pallets\tStatus\tActions']
  ,['FlightLane上的阻断项', 'Blocked Items on the Flight Lane']
  ,['FlightLane上的BloCked Items', 'Blocked Items on the Flight Lane']
  ,['INBOUND / 移动终端', 'INBOUND / Mobile Terminal']
  ,['Station Back Office只展示Live Mobile Tasks、Status和Quick Links；具体执行打开真实 PDA 页面完成。', 'The Station Back Office shows only live mobile tasks, status, and quick links; actual execution opens the real PDA page.']
  ,['待接单/待开始', 'Pending Accept / Pending Start']
  ,['已创建 / 已分派 / 已接单', 'Created / Assigned / Accepted']
  ,['标记Loaded', 'Mark Loaded']
  ,['标记Departed', 'Mark Departed']
  ,['Loaded 尚未完成。', 'Loaded is not completed yet.']
  ,['对象\t方向\t关联航班\t当前节点\t履约状态\t文件\t任务\t阻断原因\t操作', 'Object\tDirection\tAssigned Flight\tCurrent Node\tFulfillment Status\tDocuments\tTasks\tBlocker Reason\tActions']
  ,['履约详情页直接回连真实 AWB、单证、任务、异常和对象审计。', 'The fulfillment detail page links directly to real AWBs, documents, tasks, exceptions, and object audit records.']
  ,['FlightLanded并OpenInbound处理。', 'Flight landed and inbound handling is open.']
  ,['拆板、理货与Verify按票推进。', 'Breakdown, counting, and verification progress by AWB.']
  ,['无门槛 · 需要证据', 'No Gate · Evidence Required']
  ,['类型\t文件名\t门槛\t状态\t关联任务\t说明', 'Type\tFile Name\tGate\tStatus\tRelated Tasks\tDescription']
  ,['完成拆板并补齐证据', 'Complete breakdown and complete the evidence']
  ,['已满足单证门槛', 'Document gates are already satisfied']
  ,['Shipment 与Master一一关联。', 'Shipment has a one-to-one relationship with the master.']
  ,['ID\tAWB\tCHANNEL\tTARGET OBJECT\t门槛\tSTATUS\tRETRY POLICY\tJUMP', 'ID\tAWB\tChannel\tTarget Object\tGate\tStatus\tRetry Policy\tJump']
  ,['ID\tOBJECT\tSIGNER\t门槛\tSTATUS\tRETRY POLICY\tJUMP', 'ID\tObject\tSigner\tGate\tStatus\tRetry Policy\tJump']
  ,['当前备注：根据当前AWB状态决定是否允许发送', 'Current Note: whether sending is allowed depends on the current AWB status']
  ,['改为由Station资源Overview API 驱动，直接展示Team、Shift、Owner和Status。', 'Now driven by the Station Resource Overview API and directly shows team, shift, owner, and status.']
  ,['按Station、Role和DeviceView PDA Device绑定Relation。', 'View PDA device bindings by station, role, and device.']
  ,['车辆与提货单号', 'Vehicles and Collection Notes']
  ,['Filter与表单下拉All来自Database Options接口；写Actions会落Audit。', 'Filters and form selects all come from database-backed option APIs; write actions generate audit records.']
  ,['流程', 'Flow']
  ,['行程号\tFLOW / ROUTE\tTRUCK PLATE / DRIVER\t提货单号\tSTATUS\tPRIORITY\tACTIONS', 'Trip ID\tFlow / Route\tTruck Plate / Driver\tCollection Note\tStatus\tPriority\tActions']
  ,['Shift粒度报表', 'Shift-level Reports']
  ,['按Shift / Team展示第二批主营演示Lane中的日报、周报 demo。', 'Display daily and weekly demos for the phase-two main-operation lane by shift / team.']
  ,['处理Transfer、Loaded Confirm和Load to Aircraft Evidence上传。', 'Handle transfer, loaded confirmation, and load-to-aircraft evidence upload.']
  ,['用于Load to Aircraft校验', 'Used for load-to-aircraft validation']
  ,['已StartReceipt的AWB', 'AWBs with receipt started']
  ,['目的地 Integration Notify · PlannedPieces 20 · PlannedWeight 200.5 kg', 'Destination Integration Notify · Planned Pieces 20 · Planned Weight 200.5 kg']
  ,['NoneContainer Code或VerifyWeight时不得OpenLoad to Aircraft。', 'Load to Aircraft cannot be opened without a container code or reviewed weight.']
  ,['已Load to Aircraft集装器', 'Loaded-to-Aircraft Containers']
  ,['1 AWBs / 20 箱 / Verify 202.1 kg', '1 AWB / 20 boxes / reviewed 202.1 kg']
  ,['LANE\tBUSINESS MODE\tSTATION协作\tSLA PROMISE\tKEY EVENTS', 'Lane\tBusiness Mode\tStation Collaboration\tSLA Promise\tKey Events']
  ,['Inbound handling、Exception回传、Region交付', 'Inbound handling, exception return, and regional delivery']
  ,['Hard Gate\tHigh Control\tStation\tMME · MME Trial Station\t任务放行', 'Hard Gate\tHigh Control\tStation\tMME · MME Trial Station\tTask Release']
  ,['Evidence Requirements\tHigh Control\tStation\tMME · MME Trial Station\t证据校验', 'Evidence Requirements\tHigh Control\tStation\tMME · MME Trial Station\tEvidence Validation']
  ,['Exception Handling\tExceptionControl\tStation\tMME · MME Trial Station\t异常恢复', 'Exception Handling\tException Control\tStation\tMME · MME Trial Station\tException Recovery']
  ,['Hard Gate\tHigh Control\tPlatform Global\t平台全局\t任务放行', 'Hard Gate\tHigh Control\tPlatform Global\tPlatform Global\tTask Release']
  ,['Interface Governance\tCoordinated Control\tLane\tLANE-URC-MME-01 · URC -> MME -> Delivery\t接口同步', 'Interface Governance\tCoordinated Control\tLane\tLANE-URC-MME-01 · URC -> MME -> Delivery\tInterface Sync']
  ,['Scenario Orchestration\tCoordinated Control\tScenario\tSCN-A-02 · 标准场景 A：航班落地后拆板到装车\t场景编排', 'Scenario Orchestration\tCoordinated Control\tScenario\tSCN-A-02 · Standard Scenario A: Breakdown to truck loading after landing\tScenario Orchestration']
  ,['Service Level\tHigh Control\tPlatform Global\t平台全局\t收货准入', 'Service Level\tHigh Control\tPlatform Global\tPlatform Global\tReceiving Admission']
  ,['Service Level\tCoordinated Control\tPlatform Global\t平台全局\t收货准入', 'Service Level\tCoordinated Control\tPlatform Global\tPlatform Global\tReceiving Admission']
  ,['Task Template\tCoordinated Control\tStation\tMME · MME Trial Station\t任务放行', 'Task Template\tCoordinated Control\tStation\tMME · MME Trial Station\tTask Release']
  ,['Object Relationships', 'Object Relationships']
  ,['Time\tActor\tAction\tObject\tResult\tRemarks', 'Time\tActor\tAction\tObject\tResult\tRemarks']
  ,['Daily Section\tMetric\tCurrent Sample\tDescription', 'Daily Section\tMetric\tCurrent Sample\tDescription']
  ,['9 items当日报告Task', '9 daily report tasks in scope today']
  ,['28 份文档Open日报范围', '28 documents in the open daily-report scope']
  ,['当日平台层无开放质量问题', 'There are no open platform-level quality issues today']
  ,['Platform与Station的关键Actions都应在这里可追溯，包括StationCreate、规则修改、文件导入、POD 上传、Status回退和可信Field预留。', 'Key platform and station actions should be traceable here, including station creation, rule changes, document imports, POD uploads, state rollbacks, and reserved trust fields.']
  ,['用站点坐标和虚拟航线直接展示当前网络连接。', 'Visualize the current network directly from station coordinates and virtual routes.']
  ,['样板站优先链路', 'Pilot-station Priority Lane']
  ,['一期样板链路，覆盖 URC 到 MME 的强控制履约。', 'Phase-one pilot lane covering tightly controlled fulfillment from URC to MME.']
  ,['电商普货主线', 'E-commerce General Cargo Main Lane']
  ,['标准普货协同链路。', 'Standard general-cargo coordination lane.']
  ,['东欧入口协同链路', 'Eastern Europe Entry Coordination Lane']
  ,['RZE 接入阶段链路，用于平台网络扩展准备。', 'Lane used during the RZE onboarding phase to prepare network expansion.']
  ,['前置仓 -> 头程卡车 -> 出港货站 -> 出港机坪 -> Flight -> 进港机坪 -> 进港货站 -> 尾程装车 -> 交付仓', 'Pre-warehouse -> headhaul truck -> outbound station -> outbound ramp -> flight -> inbound ramp -> inbound station -> final truck loading -> delivery warehouse']
  ,['前置仓 -> 出港货站 -> Flight -> 进港货站', 'Pre-warehouse -> outbound station -> flight -> inbound station']
  ,['前置仓 -> 出港货站 -> Flight -> 欧陆分拨 -> 东欧入口站', 'Pre-warehouse -> outbound station -> flight -> EU hub -> Eastern Europe entry station']
  ,['标准场景 A：航班落地后拆板到装车', 'Standard Scenario A: Breakdown to truck loading after landing']
  ,['覆盖 MME 进港到尾程装车的标准节点编排。', 'Covers the standard node orchestration from MME inbound handling to final truck loading.']
  ,['CBA / Manifest / Handling Plan 触发', 'Triggered by CBA / Manifest / Handling Plan']
  ,['开工照片 / 理货记录 / Collection Note / POD', 'Start photos / count records / collection note / POD']
  ,['文件链路', 'Document Lane']
  ,['标准场景 B：前置仓到出港文件链', 'Standard Scenario B: Pre-warehouse to outbound document chain']
  ,['用于平台、货站与 PDA 三端对齐文件链与证据链。', 'Used to align document and evidence chains across platform, station, and PDA.']
  ,['URC · 乌鲁木齐前置站', 'URC · Urumqi Pre-warehouse Station']
  ,['标准场景 C：东欧协同补段异常恢复', 'Standard Scenario C: Eastern Europe add-on-leg exception recovery']
  ,['用于东欧入口站接入期的异常恢复样板。', 'Used as the exception-recovery template during Eastern Europe entry-station onboarding.']
  ,['RZE · 东欧入口站', 'RZE · Eastern Europe Entry Station']
  ,['刷新规则\tDefault Refresh Mode\tFull Recompute\tdaily 接口按 reportDate 重新聚合同日Object、Audit与质量Result', 'Refresh Rules\tDefault Refresh Mode\tFull Recompute\tThe daily endpoint re-aggregates same-day objects, audits, and quality results by report date']
  ,['进港拆板主终端', 'Inbound Breakdown Primary Terminal']
  ,['交付签收终端', 'Delivery Sign-off Terminal']
  ,['理货复核备用设备', 'Counting Review Backup Device']
  ,['机坪平板终端', 'Ramp Tablet Terminal']
  ,['RZE 建设期配置工位', 'RZE Build-phase Config Station']
  ,['东欧入口站', 'Eastern Europe Entry Station']
  ,['URC 出港收货 PDA', 'URC Outbound Receiving PDA']
  ,['乌鲁木齐前置站', 'Urumqi Pre-warehouse Station']
  ,['URC 机坪扫码枪', 'URC Ramp Scanner']
  ,['LANE\tBUSINESS MODE\tSTATION协作\tSLA PROMISE\tKEY EVENTS', 'Lane\tBusiness Mode\tStation Collaboration\tSLA Promise\tKey Events']
  ,['Inbound handling、ExCeption回传、Region交付', 'Inbound handling, exception return, and regional delivery']
  ,['Hard Gate\tHigh Control\tStation\tMME · MME Trial Station\t任务放行', 'Hard Gate\tHigh Control\tStation\tMME · MME Trial Station\tTask Release']
  ,['EvidenCe Requirements\tHigh Control\tStation\tMME · MME Trial Station\t证据校验', 'Evidence Requirements\tHigh Control\tStation\tMME · MME Trial Station\tEvidence Validation']
  ,['ExCeption Handling\tExCeptionControl\tStation\tMME · MME Trial Station\t异常恢复', 'Exception Handling\tException Control\tStation\tMME · MME Trial Station\tException Recovery']
  ,['Hard Gate\tHigh Control\tPlatform Global\t平台全局\t任务放行', 'Hard Gate\tHigh Control\tPlatform Global\tPlatform Global\tTask Release']
  ,['接口治理\tCoordinated Control\tLane\tLANE-URC-MME-01 · URC -> MME -> Delivery\t接口同步', 'Interface Governance\tCoordinated Control\tLane\tLANE-URC-MME-01 · URC -> MME -> Delivery\tInterface Sync']
  ,['SCenario OrChestration\tCoordinated Control\tSCenario\tSCN-A-02 · 标准场景 A：航班落地后拆板到装车\t场景编排', 'Scenario Orchestration\tCoordinated Control\tScenario\tSCN-A-02 · Standard Scenario A: Breakdown to truck loading after landing\tScenario Orchestration']
  ,['ServiCe Level\tHigh Control\tPlatform Global\t平台全局\t收货准入', 'Service Level\tHigh Control\tPlatform Global\tPlatform Global\tReceiving Admission']
  ,['ServiCe Level\tCoordinated Control\tPlatform Global\t平台全局\t收货准入', 'Service Level\tCoordinated Control\tPlatform Global\tPlatform Global\tReceiving Admission']
  ,['Task Template\tCoordinated Control\tStation\tMME · MME Trial Station\t任务放行', 'Task Template\tCoordinated Control\tStation\tMME · MME Trial Station\tTask Release']
  ,['航班', 'Flight']
  ,['运单 / 提单', 'AWB / Shipment']
  ,['车辆 / 司机', 'Vehicles / Drivers']
  ,['单证', 'Documents']
  ,['事件', 'Events']
  ,['运行中', 'Active']
  ,['警戒', 'Warning']
  ,['待处理', 'Pending']
  ,['同步看板', 'Sync Board']
  ,['重跑增量同步 / 切换人工核对', 'Rerun incremental sync / switch to manual verification']
  ,['Flight\t网络Control台', 'Flight\tNetwork Control Desk']
  ,['2026-04-16 09:30\t失败时保留上一版舱单映射\tPlatform Data Owner', '2026-04-16 09:30\tKeep the previous manifest mapping if the sync fails\tPlatform Data Owner']
  ,['重跑航班抽取 / 切人工锁定', 'Rerun flight extraction / switch to manual lock']
  ,['Flight\tStation履约', 'Flight\tStation Fulfillment']
  ,['2026-04-16 09:42\t失败时沿用上一航班快照\tStation Ops', '2026-04-16 09:42\tReuse the previous flight snapshot if the sync fails\tStation Ops']
  ,['重放司机状态 / 切短信兜底', 'Replay driver status / switch to SMS fallback']
  ,['Last-mile\t干线Control', 'Last-mile\tLinehaul Control']
  ,['2026-04-16 09:05\t回落至司机上次确认回执\tLinehaul Control', '2026-04-16 09:05\tFallback to the driver’s last confirmed receipt\tLinehaul Control']
  ,['补拉主文件 / 生成人工补录清单', 'Refetch master files / generate manual completion list']
  ,['2026-04-16 07:40\t缺字段时保留上一版本 manifest\tDocument Desk', '2026-04-16 07:40\tKeep the previous manifest version when fields are missing\tDocument Desk']
  ,['恢复回放 / 导出差异报告', 'Resume replay / export diff report']
  ,['POD\tAudit中台', 'POD\tAudit Hub']
  ,['暂停', 'Paused']
  ,['2026-04-15 23:15\t暂停写入，仅保留事件对账\tAudit Owner', '2026-04-15 23:15\tPause writes and keep only event reconciliation\tAudit Owner']
  ,['重放队列 / 触发值班复核', 'Replay queue / trigger on-duty review']
  ,['ULD / PMC\tStation履约', 'ULD / PMC\tStation Fulfillment']
  ,['2026-04-16 08:55\t降级到上次成功装板结果\tRamp Team', '2026-04-16 08:55\tDegrade to the last successful loading-board result\tRamp Team']
  ,['导入任务', 'Import Jobs']
  ,['对象关系', 'Object Relationships']
  ,['AWB 176-12345675 由交接单 DOC-HANDOVER-20260416-01 佐证。\tDoCument Repository\t2026-04-17 07:51\tView Path', 'AWB 176-12345675 is evidenced by handover note DOC-HANDOVER-20260416-01.\tDocument Repository\t2026-04-17 07:51\tView Path']
  ,['AWB 176-12345675 被集拼到 PMC-778812。\t接口日志\t2026-04-17 07:51\tView Path', 'AWB 176-12345675 is consolidated into PMC-778812.\tIntegration Log\t2026-04-17 07:51\tView Path']
  ,['异常事件 EVT-HANDOVER-20260416-08 触发对 AWB 176-12345675 的补录任务。\tAudit Events\t2026-04-17 07:51\tView Path', 'Exception event EVT-HANDOVER-20260416-08 triggers a completion task for AWB 176-12345675.\tAudit Events\t2026-04-17 07:51\tView Path']
  ,['Flight CX138/2026-04-16/MME 直接承运 AWB 176-12345675。\tFormal Business Table\t2026-04-17 07:51\tView Path', 'Flight CX138/2026-04-16/MME directly carries AWB 176-12345675.\tFormal Business Table\t2026-04-17 07:51\tView Path']
  ,['航班到货后由 TRUCK-MME-09 承接尾程派送。\tFormal Business Table\t2026-04-17 07:51\tView Path', 'TRUCK-MME-09 handles final-mile delivery after the flight arrives.\tFormal Business Table\t2026-04-17 07:51\tView Path']
  ,['POD-20260416-0008 完成 AWB 176-12345675 的签收闭环。\tDoCument Repository\t2026-04-17 07:51\tView Path', 'POD-20260416-0008 completes receipt closure for AWB 176-12345675.\tDocument Repository\t2026-04-17 07:51\tView Path']
  ,['Platform与Station的关键ACtions都应在这里可追溯，包括StationCreate、规则修改、文件导入、POD 上传、Status回退和可信Field预留。', 'Key platform and station actions should be traceable here, including station creation, rule changes, document imports, POD uploads, state rollbacks, and reserved trusted fields.']
  ,['Platform与Station的关键ACtions都应在这里可追溯，包括StationCreate、规则修改、文pieCes导入、POD 上传、Status回退和可信Field预留。', 'Key platform and station actions should be traceable here, including station creation, rule changes, document imports, POD uploads, state rollbacks, and reserved trusted fields.']
  ,['Platform与Station的关键ACtions都应在这里可追溯，包括StationCreate、规则修改、DoCuments导入、POD 上传、Status回退和可信Field预留。', 'Key platform and station actions should be traceable here, including station creation, rule changes, document imports, POD uploads, state rollbacks, and reserved trusted fields.']
  ,['TIME\tACTIONS人\tACTIONS\tOBJECT\tRESULT\tREMARKS', 'Time\tActor\tAction\tObject\tResult\tRemarks']
  ,['站点协作', 'Station Collaboration']
  ,['操作人', 'Actor']
  ,['目标对象', 'Target Object']
  ,['签收方', 'Signer']
  ,['门槛', 'Gate']
  ,['重试策略', 'Retry Policy']
  ,['跳转', 'Jump']
  ,['行程号', 'Trip ID']
  ,['流程 / 路线', 'Flow / Route']
  ,['车牌 / 司机', 'Truck Plate / Driver']
  ,['提货单号', 'Collection Note']
  ,['日报SECTION\tMETRIC\tCURRENT SAMPLE\tDESCRIPTION', 'Daily Section\tMetric\tCurrent Sample\tDescription']
  ,['LANE\tBUSINESS MODE\tSTATION协作\tSLA PROMISE\tKEY EVENTS', 'Lane\tBusiness Mode\tStation Collaboration\tSLA Promise\tKey Events']
  ,['Pre-warehouse ReCeiving -> Headhaul TruCk -> OutboundStation -> Outbound Ramp -> Flight -> Inbound机坪 -> InboundStation -> Final-mile Loading -> Delivery Warehouse', 'Pre-warehouse Receiving -> Headhaul Truck -> Outbound Station -> Outbound Ramp -> Flight -> Inbound Ramp -> Inbound Station -> Final-mile Loading -> Delivery Warehouse']
  ,['接口治理', 'Interface Governance']
  ,['重跑增量SynC / 切换人工核对', 'Rerun incremental sync / switch to manual verification']
  ,['Flight\t网络Control台', 'Flight\tNetwork Control Desk']
  ,['重跑Flight抽取 / 切人工锁定', 'Rerun flight extraction / switch to manual lock']
  ,['Flight\tStation履约', 'Flight\tStation Fulfillment']
  ,['ReplayDriverStatus / 切短信兜底', 'Replay driver status / switch to SMS fallback']
  ,['Last-mile\t干线Control', 'Last-mile\tLinehaul Control']
  ,['补拉主文件 / 生成人工补录清单', 'Refetch master files / generate manual completion list']
  ,['补拉Master Files / 生成人工补录清单', 'Refetch master files / generate manual completion list']
  ,['Restore回放 / 导出VarianCe报告', 'Resume replay / export variance report']
  ,['POD\tAudit中台', 'POD\tAudit Hub']
  ,['ReplayQueue / Triggers值班Verify', 'Replay queue / trigger on-duty review']
  ,['ULD / PMC\tStation履约', 'ULD / PMC\tStation Fulfillment']
  ,['AWB 176-12345675 is Consolidated into PMC-778812.\t接口日志\t2026-04-17 07:51\tView Path', 'AWB 176-12345675 is consolidated into PMC-778812.\tIntegration Log\t2026-04-17 07:51\tView Path']
  ,['Station Readiness\t健康 / 关注\t0 / 45\t45 stations partiCipate in the platform daily report', 'Station Readiness\tHealthy / Watch\t0 / 45\t45 stations participate in the platform daily report']
  ,['Quality CheCkList\tPlatform Gate Status\t当日平台层无开放质量问题\t继续跟踪开放Issue，并在日报中暴露趋势', 'Quality Checklist\tPlatform Gate Status\tThere are no open platform-level quality issues today\tKeep tracking open issues and expose the trend in the daily report']
  ,['Quality CheCkList\tBloCker Candidate Stations\t暂无阻断候选站点\tNo additional station-Level bloCker handling is required', 'Quality Checklist\tBlocker Candidate Stations\tNo blocker candidate stations at the moment\tNo additional station-level blocker handling is required']
  ,['Quality CheCkList\tSeverity Distribution\t暂无开放质量问题\t按严重度排序Open日报、治理Page和月度复盘', 'Quality Checklist\tSeverity Distribution\tThere are no open quality issues at the moment\tRank open daily reports, governance pages, and monthly reviews by severity']
  ,['Refresh Rules\tDefault Refresh Mode\t全量重算\tdaily 接口按 reportDate 重新聚合同日ObjeCt、Audit与质量Result', 'Refresh Rules\tDefault Refresh Mode\tFull Recompute\tThe daily endpoint re-aggregates same-day objects, audits, and quality results by report date']
  ,['Refresh Rules\tBaCkfill SCope\t平台 + 日期\tBaCkfill is limited to the same report date and does not expand aCross days', 'Refresh Rules\tBackfill Scope\tPlatform + Date\tBackfill is limited to the same report date and does not expand across days']
  ,['INBOUND / 移动OPERATIONS终端', 'INBOUND / Mobile Operations Terminal']
  ,['进港 / 移动作业终端', 'Inbound / Mobile Operations Terminal']
  ,['INBOUND / 移动作业终端', 'Inbound / Mobile Operations Terminal']
  ,['Station BaCk OffiCe只展示Live Mobile Tasks、Status和QuiCk Links；具体执行Open真实 PDA Page面Complete。', 'The Station Back Office shows only live mobile tasks, status, and quick links; actual execution opens the real PDA page to complete the work.']
  ,['待ACCept/待Start', 'Pending Accept / Pending Start']
  ,['已Create / 已Assign / 已ACCept', 'Created / Assigned / Accepted']
  ,['OBJECT\tDIRECTION\tASSIGNED FLIGHT\tCURRENT NODE\tFULFILLMENT STATUS\t文件\tTASK\tBLOCKER REASON\tACTIONS', 'Object\tDirection\tAssigned Flight\tCurrent Node\tFulfillment Status\tDocuments\tTasks\tBlocker Reason\tActions']
  ,['OBJECT\tDIRECTION\tASSIGNED FLIGHT\tCURRENT NODE\tFULFILLMENT STATUS\t文PIECES\tTASK\tBLOCKER REASON\tACTIONS', 'Object\tDirection\tAssigned Flight\tCurrent Node\tFulfillment Status\tDocuments\tTasks\tBlocker Reason\tActions']
  ,['Manifest 未冻结，当前不可open departure arChive', 'Manifest is not frozen; departure archive cannot be opened yet']
  ,['Manifest 未冻结，当前不可打开 departure arChive', 'Manifest is not frozen; departure archive cannot be opened yet']
  ,['履约DetailsPage直接回连真实 AWB、DoCument、Task、ExCeption 和ObjeCt Audit。', 'The fulfillment detail page links directly to real AWBs, documents, tasks, exceptions, and object audit records.']
  ,['拆板、理货与Verify按AWBs推进。', 'Breakdown, counting, and verification progress by AWB.']
  ,['None门槛 · EvidenCe Required', 'No Gate · Evidence Required']
  ,['TYPE\tFILE NAME\t门槛\tSTATUS\tRELATED TASKS\tDESCRIPTION', 'Type\tFile Name\tGate\tStatus\tRelated Tasks\tDescription']
  ,['ReCovery ACtion: Complete Breakdown 并补齐EvidenCe', 'Recovery Action: complete breakdown and complete the evidence']
  ,['Required DoCuments: InventoryCheCk Operations门槛', 'Required Documents: Inventory Check Operations Gate']
  ,['BloCking Reason: 已满足DoCument Gates', 'Blocking Reason: document gates are already satisfied']
  ,['ID\tAWB\tCHANNEL\tTARGET OBJECT\t门槛\tSTATUS\tRETRY POLICY\tJUMP', 'ID\tAWB\tChannel\tTarget Object\tGate\tStatus\tRetry Policy\tJump']
  ,['Current Note: 根据当前AWB Status决定YesNo允许发送', 'Current Note: whether sending is allowed depends on the current AWB status']
  ,['SLA 理货Node 30 分钟初判', 'SLA initial counting judgment within 30 minutes']
  ,['托盘ACtions', 'Pallet Actions']
  ,['SLA Counting Complete后立即执行', 'SLA execute immediately after counting is completed']
  ,['SLA VehiCle到场后 15 分钟内启动', 'SLA start within 15 minutes after vehicle arrival']
  ,['FINAL MILE卡车LOADING与运输', 'Final Mile Truck Loading and Transport']
  ,['ID\tOBJECT\tSIGNER\t门槛\tSTATUS\tRETRY POLICY\tJUMP', 'ID\tObject\tSigner\tGate\tStatus\tRetry Policy\tJump']
  ,['按Station、Role和DeviCeView PDA DeviCe 绑定Relation。', 'View PDA device bindings by station, role, and device.']
  ,['Filter与表单下拉All来自Database Options接口；写ACtions会落Audit。', 'Filters and form selects all come from database-backed option APIs; write actions generate audit records.']
  ,['行程号\tFLOW / ROUTE\tTRUCK PLATE / DRIVER\tCOLLECTION NOTE\tSTATUS\tPRIORITY\tACTIONS', 'Trip ID\tFlow / Route\tTruck Plate / Driver\tCollection Note\tStatus\tPriority\tActions']
  ,['Quality CheCkList\tBloCker Candidate Rules\tNo Default bloCker Candidates matChed at the moment\t维持开放Issue跟踪，不Triggers导入BloCker', 'Quality Checklist\tBlocker Candidate Rules\tNo default blocker candidates matched at the moment\tKeep tracking open issues without triggering import blockers']
  ,['Quality CheCkList\tIssue Review Entry\tNo open issues at the moment\t当日Not RequiredOpen质量Issue复盘', 'Quality Checklist\tIssue Review Entry\tNo open issues at the moment\tNo quality issue review needs to be opened today']
  ,['Refresh Rules\tDefault Refresh Mode\tFull ReCompute\tdaily 接口按 reportDate 重新聚合同日ObjeCt、Audit与质量Result', 'Refresh Rules\tDefault Refresh Mode\tFull Recompute\tThe daily endpoint re-aggregates same-day objects, audits, and quality results by report date']
  ,['Missing CritiCal Files\tUWS / FLIGHT-SE913-2026-04-09-MME\t4 items未满足ReleaseitemspieCes\tCovering 28 CritiCal doCuments.', 'Missing Critical Files\tUWS / FLIGHT-SE913-2026-04-09-MME\t4 items do not meet release conditions\tCovering 28 critical documents.']
  ,['DoCument EffeCtive Time\tUWS / Manifest\t2026-04-17 13:19 / 2026-04-17 13:19\t按最近Update的关键文pieCes排序。', 'Document Effective Time\tUWS / Manifest\t2026-04-17 13:19 / 2026-04-17 13:19\tSorted by the most recently updated critical documents.']
  ,['DoCument EffeCtive Time\tUWS / Manifest\t2026-04-17 13:19 / 2026-04-17 13:19\t按最近Update的关键DoCuments排序。', 'Document Effective Time\tUWS / Manifest\t2026-04-17 13:19 / 2026-04-17 13:19\tSorted by the most recently updated critical documents.']
  ,['BloCking Reason: 4 AWBs回执待补', 'Blocking Reason: 4 AWB receipts still need backfill']
  ,['BloCking Reason: 4 AWBsReCeipt待补', 'Blocking Reason: 4 AWB receipts still need backfill']
  ,['处理Transfer、Loaded Confirm和Load to AirCraftEvidenCe上传。', 'Handle transfer, loaded confirmation, and load-to-aircraft evidence upload.']
  ,['items码枪SCan后的回车会直接被识别成一次Confirm，并自动CompleteCount加 1。', 'A scanner-enter event is treated as one confirmation and automatically increments the count by 1.']
  ,['使用 PDA items码枪SCan AWB后，会直接Open该票的计数器。', 'After scanning an AWB with the PDA scanner, the counter for that AWB opens immediately.']
  ,['围绕航班 SE803 执行拆板和理货，扫码即加 1，并持续校验差异。', 'Execute breakdown and counting around flight SE803; each scan adds 1 and continuously validates variances.']
  ,['Current Role Supervisor / Verify 仅可View，不可执行 CheCk Worker Task。', 'The current role Supervisor / Verify can only view and cannot execute check-worker tasks.']
  ,['AWB / 箱号SCan记录', 'AWB / Box-code Scan Records']
  ,['先浏览该Flight已Yes托盘，再Open新Page面新建托盘。每Complete一个托盘后，会回到这里继续下一轮ACtions。', 'Review existing pallets for the flight first, then open a new page to create another one. After each pallet is completed, return here for the next action.']
  ,['先浏览该Flightexisting pallets，再open a new page新建pallet。每Complete一个pallet后，会回到这里continue with the next actions。', 'Review existing pallets for the flight first, then open a new page to create another one. After each pallet is completed, return here for the next action.']
  ,['先浏览该Flightexisting pallets，再open a new pageNew Pallet。每Complete一个pallet后，会回到这里continue with the next actions。', 'Review existing pallets for the flight first, then open a new page to create another one. After each pallet is completed, return here for the next action.']
  ,['12 箱 / 120.5 kg / 1 票', '12 boxes / 120.5 kg / 1 AWB']
  ,['Current Role Supervisor / Verify 仅可View，不可执行 Pallet Builder Task。', 'The current role Supervisor / Verify can only view and cannot execute pallet-builder tasks.']
  ,['新建Pallet', 'New Pallet']
  ,['新建pallet', 'New Pallet']
  ,['Loading Planned应由后台办公室先Complete编排，包括TruCk Plate、Driver、ColleCtion Note 与Reserved Pallets；PDA 仅执行已排好的Planned。', 'Loading plans should be prepared first in the back office, including truck plate, driver, collection note, and reserved pallets; the PDA only executes prepared plans.']
  ,['Driver Pending · CN-INT-001 · 1 托盘', 'Driver Pending · CN-INT-001 · 1 pallet']
  ,['尾程卡车装车与运输', 'Final-mile Truck Loading and Transport']
  ,['为航班 SE803 录入车牌、司机、Collection Note 和复核信息，形成装车计划。', 'Enter truck plate, driver, collection note, and review details for flight SE803 to form the loading plan.']
  ,['未录入TruCk Plate、ColleCtion Note、CheCker时不得Start装车。', 'Truck loading cannot start before truck plate, collection note, and checker are entered.']
  ,['Current Role Supervisor / Verify 仅可View，不可执行 Loading Coordinator Task。', 'The current role Supervisor / Verify can only view and cannot execute loading-coordinator tasks.']
  ,['用于Load to AirCraft校验', 'Used for load-to-aircraft validation']
  ,['统一展示航班 SE913 的收货、理货、组板、集装器和装机准备任务。', 'Show receiving, counting, palletizing, container, and loading-preparation tasks for flight SE913 in one place.']
  ,['统一展示Flight SE913 的ReCeiving、理货、组板、Container和Load to AirCraft准备Task。', 'Show receiving, counting, palletizing, container, and loading-preparation tasks for flight SE913 in one place.']
  ,['已StartReCeipt的AWB', 'AWBs with receipt started']
  ,['目的地 Integration Notify · PlannedPieCes 20 · PlannedWeight 200.5 kg', 'Destination Integration Notify · Planned Pieces 20 · Planned Weight 200.5 kg']
  ,['SLA Airborne前闭环', 'SLA close before airborne']
  ,['SLA ReCeipt后 30 分钟', 'SLA within 30 minutes after receipt']
  ,['SLA Load to AirCraft前 45 分钟', 'SLA 45 minutes before load to aircraft']
  ,['按 AWB 录入收货件数并完成重量复核。', 'Record received pieces by AWB and complete weight verification.']
  ,['未CompleteReCeipt不得Open组板和机坪Release。', 'Palletizing and ramp release cannot open before receipt is completed.']
  ,['Current Role Supervisor / Verify 仅可View，不可执行 Export ReCeiver Task。', 'The current role Supervisor / Verify can only view and cannot execute export-receiver tasks.']
  ,['处理Driver / TruCk Plate登记、装车Verify、发车和交接DoCuments。', 'Handle driver / truck plate registration, loading verification, dispatch, and handover documents.']
  ,['Refresh Rules\tDefault Refresh Mode\tFull ReCompute\tdaily 接口按 reportDate 重新聚合同日ObjeCt、审计与质量Result', 'Refresh Rules\tDefault Refresh Mode\tFull Recompute\tThe daily endpoint re-aggregates same-day objects, audits, and quality results by report date']
  ,['创建集装器、录入提单并准备机坪转运。', 'Create containers, record AWBs, and prepare ramp transfer.']
  ,['CreateContainer、录入AWB并准备机坪Transfer。', 'Create containers, record AWBs, and prepare ramp transfer.']
  ,['NoneContainer Code或VerifyWeight时不得OpenLoad to AirCraft。', 'Load to Aircraft cannot be opened without a container code or reviewed weight.']
  ,['NoneContainer号或ReviewWeight时不得OpenLoad to AirCraft。', 'Load to Aircraft cannot be opened without a container code or reviewed weight.']
  ,['已Load to AirCraft集装器', 'Loaded-to-Aircraft Containers']
  ,['在机坪完成转运、Loaded 确认和装机证据上传。', 'Complete transfer, loaded confirmation, and loading-evidence upload on the ramp.']
  ,['Inbound能力 overview / Counting', 'Inbound Capability Overview / Counting']
  ,['Outbound能力 overview / reCeipt', 'Outbound Capability Overview / Receipt']
  ,['按Current Role能力优先显示建议Open的Node，帮助现场Staff更快找到自己的Task Entry。', 'Recommended nodes are shown first based on the current role so operators can reach the right task entry faster.']
  ,['到港ReCeiving', 'Arrival Receiving']
  ,['理货Review', 'Count Review']
  ,['Current Flight的拆板、理货、组托、Loading和 NOA/POD All按统一Task卡组织。', 'All breakdown, counting, palletizing, loading, and NOA/POD tasks for the current flight are organized through unified task cards.']
  ,['来自FlightPlanned数据', 'From flight planned data']
  ,['ULD / Container应由后台办公室先Complete预排并分配Stand；PDA 仅执行已排好的集装与Load to AirCraft。', 'ULDs / containers should be pre-planned and assigned to stands in the back office; the PDA only executes planned containerization and loading.']
  ,['组板与ContainerTask', 'Pallet and Container Task']
  ,['Container号', 'Container Code']
  ,['OUTBOUND机场机坪ACTIONS', 'Outbound Airport Ramp Operations']
];

const orderedZhToEnReplacements = [...exactZhToEnPairs, ...sharedPhrasePairs].sort((a, b) => b[0].length - a[0].length);
const orderedEnToZhReplacements = [...exactEnToZhPairs, ...sharedPhrasePairs.map(([zh, en]) => [en, zh])].sort((a, b) => b[0].length - a[0].length);

export function normalizeAppLanguage(language) {
  return SUPPORTED_APP_LANGUAGES.includes(language) ? language : DEFAULT_APP_LANGUAGE;
}

export function getAppLanguageOptions(language) {
  const locale = normalizeAppLanguage(language);
  return [
    { value: 'zh', label: locale === 'en' ? 'Chinese' : '中文' },
    { value: 'en', label: 'English' }
  ];
}

function replaceOrdered(input, replacements) {
  if (!input) return input;

  let output = String(input);
  replacements.forEach(([from, to]) => {
    if (from && to) {
      output = output.split(from).join(to);
    }
  });
  return output;
}

function applyPatternLocalization(language, input) {
  if (typeof input !== 'string' || !input) return input;

  if (language === 'en') {
    return input
      .replace(/(\d+) 会话/gu, '$1 sessions')
      .replace(/(\d+) 个目的港/gu, '$1 destinations')
      .replace(/(\d+)\/(\d+) 班已落地/gu, '$1/$2 flights landed')
      .replace(/(\d+)\/(\d+) 票已触发 NOA/gu, '$1/$2 AWBs triggered NOA')
      .replace(/(\d+)\/(\d+) 票已完成 POD\/交付/gu, '$1/$2 AWBs completed POD/delivery')
      .replace(/(\d+)\/(\d+) 票已完成接收/gu, '$1/$2 AWBs received')
      .replace(/(\d+) \/ (\d+) 票/gu, '$1 / $2 AWBs')
      .replace(/(\d+)\/(\d+) 班已冻结 Manifest/gu, '$1/$2 flights frozen for manifest')
      .replace(/(\d+)\/(\d+) 班已飞走/gu, '$1/$2 flights departed')
      .replace(/(\d+)\/(\d+) 班已回传/gu, '$1/$2 flights returned')
      .replace(/(\d+) 个待接单任务/gu, '$1 pending accept tasks')
      .replace(/(\d+) 个总任务/gu, '$1 total tasks')
      .replace(/(\d+) 个带 Gate 或异常的任务/gu, '$1 tasks with gates or exceptions')
      .replace(/(\d+) 票 POD 仍待归档/gu, '$1 AWB POD records are still pending archive')
      .replace(/(\d+) 票回执待补/gu, '$1 AWB receipts still need backfill')
      .replace(/^(.+?) 存在 (\d+) 个阻断点$/u, '$1 has $2 blockers')
      .replace(/^(.+?) 存在 (\d+) 个BloCker点$/u, '$1 has $2 blockers')
      .replace(/(\d+) 票/gu, '$1 AWBs')
      .replace(/(\d+) 班/gu, '$1 flights')
      .replace(/(\d+) 个待完成任务/gu, '$1 pending tasks')
      .replace(/(\d+) 个日报任务已纳入当日范围/gu, '$1 daily report tasks are included in today\'s scope')
      .replace(/(\d+) 条审计事件参与文件回看/gu, '$1 audit events included in document trace-back')
      .replace(/(\d+) 次预览 \/ (\d+) 次下载/gu, '$1 previews / $2 downloads')
      .replace(/^会话：/gmu, 'Session: ')
      .replace(/^执行人：/gmu, 'Actor: ')
      .replace(/^站点范围：/gmu, 'Station Scope: ')
      .replace(/^Station范围：/gmu, 'Station Scope: ')
      .replace(/^当前焦点：/gmu, 'Current Focus: ')
      .replace(/^可用工具：/gmu, 'Available Tools: ')
      .replace(/^可用Tool：/gmu, 'Available Tools: ')
      .replace(/^可用工作流：/gmu, 'Available Workflows: ')
      .replace(/^会话 (.+)$/gmu, 'Session $1')
      .replace(/^Role：/gmu, 'Role: ')
      .replace(/^Current Role：/gmu, 'Current Role: ')
      .replace(/OpenInbound处理池/gu, 'the inbound handling pool')
      .replace(/日报SECTION/gu, 'Daily Section')
      .replace(/OpenDeparture ArChive/gu, 'open departure archive')
      .replace(/Completed接收/gu, 'completed receiving')
      .replace(/Loading编排/gu, 'loading planning')
      .replace(/Master冻结/gu, 'master freeze')
      .replace(/OpenForeCast池/gu, 'the forecast pool')
      .replace(/已the foreCast pool/gu, 'entered the forecast pool')
      .replace(/Pending GenerationStatus/gu, 'pending generation status')
      .replace(/仍待ArChive/gu, 'still pending archive')
      .replace(/等待Loading planning/gu, 'Waiting for loading planning')
      .replace(/待装机/gu, 'Pending Loading')
      .replace(/Loading Review待Complete/gu, 'Loading review pending completion')
      .replace(/Task派发到接单Confirm的平均时长。/gu, 'Average time from task dispatch to acceptance confirmation.')
      .replace(/TaskCreate到到场\/到站回传的平均时长。/gu, 'Average time from task creation to arrival/station feedback.')
      .replace(/Start到Complete的平均时长。/gu, 'Average time from start to completion.')
      .replace(/需照片 \/ Sign \/ SCan的Task样例口径。/gu, 'Sample scope for tasks requiring photos / signatures / scans.')
      .replace(/发现ExCeption到首次反馈的平均时长。/gu, 'Average time from exception detection to first feedback.')
      .replace(/未满足Releaseitems件/gu, 'do not meet release conditions')
      .replace(/按最近Update的关键文件排序。/gu, 'Sorted by the most recently updated critical file.')
      .replace(/当日未发现开放中的质量Issue/gu, 'No open quality issues found today')
      .replace(/继续执行日报巡检，None需额外BloCking ACtion/gu, 'Continue daily inspection; no extra blocking action required')
      .replace(/暂None默认BloCker候选规则命中/gu, 'No default blocker candidates matched at the moment')
      .replace(/维持开放Issue跟踪，不触发导入BloCker/gu, 'Keep tracking open issues without triggering import blockers')
      .replace(/暂None开放Issue/gu, 'No open issues at the moment')
      .replace(/当日None需Open质量Issue复盘/gu, 'No quality issue review needs to be opened today')
      .replace(/个daily report tasks inCluded in today’s sCope/gu, 'daily report tasks included in today’s scope')
      .replace(/DoCument \/ 审计/gu, 'Document / Audit')
      .replace(/日报按 (\d{4}-\d{2}-\d{2}) End-of-day AnChor冻结统计窗口/gu, 'Daily report freezes the statistics window at the $1 end-of-day anchor')
      .replace(/daily 接口按 reportDate re-aggregates same-day objeCts, audits, and quality results/gu, 'The daily endpoint re-aggregates same-day objects, audits, and quality results by report date')
      .replace(/站点 MME日报必须显式暴露质量摘要与检查表/gu, 'The Station MME daily report must explicitly expose the quality summary and checklist')
      .replace(/关键指标应可回查到对象详情页/gu, 'Key metrics should link back to object detail pages')
      .replace(/关键状态变化与导入链必须能回查到审计事件/gu, 'Key status changes and import chains must link back to audit events')
      .replace(/当前可见的出港航班/gu, 'currently visible outbound flights')
      .replace(/重跑增量SynC/gu, 'Rerun incremental sync')
      .replace(/重跑Flight抽取/gu, 'Rerun flight extraction')
      .replace(/补拉Master Files/gu, 'Refetch master files')
      .replace(/切换人工核对/gu, 'switch to manual verification')
      .replace(/切换人工锁定/gu, 'switch to manual lock')
      .replace(/生成人工补录清单/gu, 'generate manual completion list')
      .replace(/移动OPERATIONS终端/gu, 'Mobile Operations Terminal')
      .replace(/当前不可open departure arChive/gu, 'departure archive cannot be opened yet')
      .replace(/当前不可打开 departure arChive/gu, 'departure archive cannot be opened yet')
      .replace(/按最近Update的关键DoCuments排序。/gu, 'Sorted by the most recently updated critical documents.')
      .replace(/按最近Update的关键文件排序。/gu, 'Sorted by the most recently updated critical documents.')
      .replace(/4 items未满足ReleaseitemspieCes/gu, '4 items do not meet release conditions')
      .replace(/4 items未满足Releaseitems件/gu, '4 items do not meet release conditions')
      .replace(/已OpenInbound处理/gu, 'opened inbound handling')
      .replace(/必须先清BloCker/gu, 'must clear the blocker first')
      .replace(/已归档，可支持交付闭环/gu, 'is archived and can support delivery closure')
      .replace(/已冻结，可支持后续Release/gu, 'is frozen and can support subsequent release')
      .replace(/理货Release/gu, 'counting release')
      .replace(/交付Close/gu, 'delivery closure')
      .replace(/当前不BloCker主链/gu, 'currently does not block the main flow')
      .replace(/当前不会BloCker主链/gu, 'currently will not block the main flow')
      .replace(/当前仍BloCkerReleaseLane/gu, 'still blocks the release lane')
      .replace(/Currently BloCking Main Flow推进/gu, 'currently blocking main-flow progression')
      .replace(/Current ACtion可执行/gu, 'current action can execute')
      .replace(/None需重复执行。/gu, 'No repeat execution is required.')
      .replace(/None需补充ACtions/gu, 'No additional action is required.')
      .replace(/Fulfillment ObjeCt/gu, 'Fulfillment Object')
      .replace(/日报按 (\d{4}-\d{2}-\d{2}) 日终AnChor冻结统计窗口/gu, 'Daily report freezes the statistics window at the $1 end-of-day anchor')
      .replace(/重新聚合同日ObjeCt、审计与质量Result/gu, 're-aggregates same-day objects, audits, and quality results')
      .replace(/仅允许在同一 reportDate 内补算，不跨日扩散/gu, 'Backfill is limited to the same report date and does not expand across days')
      .replace(/^未关闭异常 (\d+) 项$/u, '$1 unresolved exceptions')
      .replace(/^待处理动作 (\d+) 项$/u, '$1 pending actions')
      .replace(/^还有 (\d+) 个待处理动作$/u, '$1 pending actions remaining')
      .replace(/^创建 站点 (.+)$/u, 'Created station $1')
      .replace(/^创建 班组 (.+)$/u, 'Created team $1')
      .replace(/^创建 区位 (.+)$/u, 'Created zone $1')
      .replace(/^站点 (.+) 已更新。$/u, 'Station $1 has been updated.')
      .replace(/^站点 (.+) 已恢复。$/u, 'Station $1 has been restored.')
      .replace(/^站点 (.+) 已归档。$/u, 'Station $1 has been archived.')
      .replace(/^班组 (.+) 已更新。$/u, 'Team $1 has been updated.')
      .replace(/^班组 (.+) 已恢复。$/u, 'Team $1 has been restored.')
      .replace(/^班组 (.+) 已归档。$/u, 'Team $1 has been archived.')
      .replace(/^区位 (.+) 已更新。$/u, 'Zone $1 has been updated.')
      .replace(/^区位 (.+) 已恢复。$/u, 'Zone $1 has been restored.')
      .replace(/^区位 (.+) 已归档。$/u, 'Zone $1 has been archived.');
  }

  return input;
}

export function translateRenderedText(language, input) {
  if (typeof input !== 'string' || !input) return input;

  const locale = normalizeAppLanguage(language);
  if (locale === 'en') {
    return applyPatternLocalization(locale, replaceOrdered(input, orderedZhToEnReplacements));
  }
  return applyPatternLocalization(locale, replaceOrdered(input, orderedEnToZhReplacements));
}

export function localizeUiText(language, input) {
  if (typeof input !== 'string' || !input) return input;

  const locale = normalizeAppLanguage(language);
  if (locale === 'en') {
    const translated = enMessages[input] || translateRenderedText(locale, input);
    return translated === input ? translated : translateRenderedText(locale, translated);
  }

  const translated = zhMessages[input] || translateRenderedText(locale, input);
  return translated === input ? translated : translateRenderedText(locale, translated);
}

export function formatLocalizedMessage(intl, message) {
  if (!intl || typeof message !== 'string' || !message) {
    return message;
  }

  const formatted = intl.formatMessage({ id: message, defaultMessage: message });
  return localizeUiText(intl.locale, formatted);
}
