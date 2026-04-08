export const runtimeStatusDictionary = [
  { key: 'Scheduled', label: 'Scheduled', color: 'default', group: 'runtime' },
  { key: 'Pre-Arrival', label: 'Pre-Arrival', color: 'info', group: 'runtime' },
  { key: 'Landed', label: 'Landed', color: 'secondary', group: 'runtime' },
  { key: 'Airborne', label: 'Airborne', color: 'primary', group: 'runtime' },
  { key: 'Closed', label: 'Closed', color: 'success', group: 'runtime' }
];

export const fulfillmentStatusDictionary = [
  { key: '运达', label: '运达', color: 'info', group: 'fulfillment' },
  { key: '已卸机', label: '已卸机', color: 'secondary', group: 'fulfillment' },
  { key: '已入货站', label: '已入货站', color: 'primary', group: 'fulfillment' },
  { key: '拆板中', label: '拆板中', color: 'warning', group: 'fulfillment' },
  { key: '理货中', label: '理货中', color: 'warning', group: 'fulfillment' },
  { key: 'Inbound Handling', label: 'Inbound Handling', color: 'primary', group: 'fulfillment' },
  { key: '待发送 NOA', label: '待发送 NOA', color: 'warning', group: 'fulfillment' },
  { key: 'NOA 已发送', label: 'NOA 已发送', color: 'info', group: 'fulfillment' },
  { key: '二次转运中', label: '二次转运中', color: 'secondary', group: 'fulfillment' },
  { key: '已交付', label: '已交付', color: 'success', group: 'fulfillment' },
  { key: 'Delivered', label: 'Delivered', color: 'success', group: 'fulfillment' },
  { key: 'Closed', label: 'Closed', color: 'success', group: 'fulfillment' }
];

export const taskStatusDictionary = [
  { key: '待处理', label: '待处理', color: 'warning', group: 'task' },
  { key: '未开始', label: '未开始', color: 'default', group: 'task' },
  { key: '运行中', label: '运行中', color: 'secondary', group: 'task' },
  { key: '点货中', label: '点货中', color: 'secondary', group: 'task' },
  { key: '理货完成', label: '理货完成', color: 'success', group: 'task' },
  { key: '计划', label: '计划', color: 'info', group: 'task' },
  { key: '装车中', label: '装车中', color: 'warning', group: 'task' },
  { key: '已完成', label: '已完成', color: 'success', group: 'task' },
  { key: '已复核', label: '已复核', color: 'success', group: 'task' },
  { key: '暂时挂起', label: '暂时挂起', color: 'warning', group: 'task' },
  { key: '待升级', label: '待升级', color: 'error', group: 'task' },
  { key: '阻塞', label: '阻塞', color: 'error', group: 'task' },
  { key: '待放行', label: '待放行', color: 'warning', group: 'task' },
  { key: '已放行', label: '已放行', color: 'success', group: 'task' },
  { key: '待发车', label: '待发车', color: 'warning', group: 'task' },
  { key: '已发车', label: '已发车', color: 'success', group: 'task' },
  { key: '在途', label: '在途', color: 'secondary', group: 'task' },
  { key: '已到站', label: '已到站', color: 'success', group: 'task' },
  { key: '已接机', label: '已接机', color: 'info', group: 'task' },
  { key: '待签收', label: '待签收', color: 'warning', group: 'task' },
  { key: '已签收', label: '已签收', color: 'success', group: 'task' },
  { key: '已创建', label: '已创建', color: 'info', group: 'task' }
];

export const documentStatusDictionary = [
  { key: '运行中', label: '运行中', color: 'success', group: 'document' },
  { key: '警戒', label: '警戒', color: 'warning', group: 'document' },
  { key: '待处理', label: '待处理', color: 'warning', group: 'document' },
  { key: '待生成', label: '待生成', color: 'warning', group: 'document' },
  { key: '待回传', label: '待回传', color: 'warning', group: 'document' },
  { key: '已接收', label: '已接收', color: 'success', group: 'document' },
  { key: '已预报', label: '已预报', color: 'info', group: 'document' },
  { key: '主单完成', label: '主单完成', color: 'success', group: 'document' },
  { key: '已装载', label: '已装载', color: 'success', group: 'document' },
  { key: '已发送', label: '已发送', color: 'success', group: 'document' },
  { key: '发送失败', label: '发送失败', color: 'error', group: 'document' },
  { key: '待补签', label: '待补签', color: 'warning', group: 'document' },
  { key: '已归档', label: '已归档', color: 'success', group: 'document' },
  { key: '待冻结', label: '待冻结', color: 'warning', group: 'document' },
  { key: '已冻结', label: '已冻结', color: 'success', group: 'document' }
];

export const controlLevelDictionary = [
  { key: '强控制', label: '强控制', color: 'primary', group: 'control' },
  { key: '协同控制', label: '协同控制', color: 'secondary', group: 'control' },
  { key: '接口可视', label: '接口可视', color: 'warning', group: 'control' }
];

export const phaseDictionary = [
  { key: '已上线', label: '已上线', color: 'success', group: 'phase' },
  { key: '样板优先', label: '样板优先', color: 'primary', group: 'phase' },
  { key: '待处理', label: '待处理', color: 'warning', group: 'phase' }
];

export const priorityDictionary = [
  { key: 'P1', label: 'P1', color: 'error', group: 'priority' },
  { key: 'P2', label: 'P2', color: 'warning', group: 'priority' },
  { key: 'P3', label: 'P3', color: 'info', group: 'priority' },
  { key: '高优先级', label: '高优先级', color: 'error', group: 'priority' }
];

const dictionaries = [
  ...runtimeStatusDictionary,
  ...fulfillmentStatusDictionary,
  ...taskStatusDictionary,
  ...documentStatusDictionary,
  ...controlLevelDictionary,
  ...phaseDictionary,
  ...priorityDictionary
];

const dictionaryMap = new Map(dictionaries.map((item) => [item.label, item]));

export function getStatusMeta(label) {
  if (!label) {
    return { label: '', color: 'default', group: 'unknown' };
  }

  return dictionaryMap.get(label) || { label, color: 'default', group: 'unknown' };
}

export function getStatusColor(label, color) {
  if (color) return color;
  return getStatusMeta(label).color;
}
