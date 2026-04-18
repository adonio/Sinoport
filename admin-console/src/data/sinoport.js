// Legacy local fixtures used for replay/sample-import seeding during the
// database migration. Do not treat these exports as formal business truth for
// accepted CRUD pages or production-facing data flows.
export const sinoportFixtureBoundary = Object.freeze({
  role: 'fixture/replay/sample-import-only',
  primaryTruthForbiddenForAcceptedCrud: true
});

export const platformKpis = [
  { title: '已接入货站', value: '7', helper: '覆盖 URC、KGF、NVI、RZE、MST、BoH、MME', chip: 'Network', color: 'primary' },
  { title: 'L1 强控制站点', value: '2', helper: 'URC 与 MME 作为一期样板深度接入', chip: 'L1', color: 'secondary' },
  { title: '本周运行航线', value: '14', helper: '覆盖 URC-MST、URC-MME、BOH-CTU 等链路', chip: 'Routes', color: 'success' },
  { title: '接口在线率', value: '98.4%', helper: 'FFM / UWS / Manifest / POD 导入链路稳定', chip: 'Stable', color: 'success' }
];

export const stationCatalog = [
  { code: 'URC', name: '乌鲁木齐前置站', region: '中国西部', control: '强控制', phase: '已上线', scope: '出港前置、预报、收货、主单、发运', owner: 'Platform Ops CN' },
  { code: 'KGF', name: '中亚协同站', region: '中亚', control: '协同控制', phase: '已上线', scope: '飞行在途衔接、卡车分拨、状态回传', owner: 'Regional Partner' },
  { code: 'NVI', name: '中转衔接站', region: '中亚', control: '协同控制', phase: '已上线', scope: 'ETA 联动、落地准备、中转计划', owner: 'Regional Partner' },
  { code: 'RZE', name: '东欧入口站', region: '欧洲', control: '协同控制', phase: '待处理', scope: '进港 handling、异常回传、区域交付', owner: 'Expansion Team' },
  { code: 'MST', name: '欧陆分拨站', region: '欧洲', control: '协同控制', phase: '已上线', scope: '进港分拨、二次卡车转运、NOA', owner: 'EU Ops' },
  { code: 'BoH', name: '伯恩茅斯航站', region: '英国', control: '接口可视', phase: '已上线', scope: 'Manifest、出港数据交换、到港回传', owner: 'UK Partner' },
  { code: 'MME', name: '马斯特里赫特样板站', region: '欧洲', control: '强控制', phase: '样板优先', scope: '进港履约、二次转运、NOA、POD', owner: 'MME Station Lead' }
];

export const routeMatrix = [
  { lane: 'URC → MST', pattern: '电商普货主线', stations: 'URC / MST', promise: '72h', events: 'FFM, UWS, Manifest, POD' },
  { lane: 'URC → MME', pattern: '样板站优先链路', stations: 'URC / MME', promise: '48-60h', events: 'FFM, UWS, NOA, POD' },
  { lane: 'BOH → CTU', pattern: '回程舱单交换', stations: 'BoH / CTU', promise: 'Flight+Manifest', events: 'Manifest, Destination Count' },
  { lane: 'URC → LGG via MME', pattern: '卡转补段', stations: 'URC / MME / LGG', promise: '二次转运留痕', events: 'Truck, POD, Exception' }
];

export const pendingLaunchItems = [
  { title: 'RZE 站点入网审批', owner: 'Platform Admin', due: '2026-04-12', note: '待补齐站点 SLA 与异常字典' },
  { title: 'MST 货站主数据映射', owner: 'Data Owner', due: '2026-04-09', note: '统一 Flight / AWB / Truck 主键口径' },
  { title: 'BoH Manifest 到港对账', owner: 'Interface Owner', due: '2026-04-10', note: '补齐目的港到货数量回传字段' }
];

export const serviceLevels = [
  { level: 'P1', summary: '高时效与高优先级货物', rules: '前置收货、装载、进港理货、转运和 NOA 全链路优先' },
  { level: 'P2', summary: '标准履约货物', rules: '按标准 SLA 推进，触发异常即升级' },
  { level: 'P3', summary: '协同与低紧急度货物', rules: '保证可见性与回传，不占用强控制资源' }
];

export const hardGateRules = [
  '进港未理货完成不得发送 NOA',
  '进港二次转运无车牌与司机记录不得放行',
  '进港无 POD 不得关闭交付',
  '出港未完成主单不得进入装载作业',
  '出港无 UWS 不得标记已装载',
  '出港无 Manifest 不得标记已归档'
];

export const exceptionTaxonomy = [
  { type: '数量异常', owner: '站内操作组', target: '30 分钟初判' },
  { type: '重量异常', owner: '收货/理货组', target: '同班次闭环' },
  { type: '板位异常', owner: '装载组', target: '飞走前闭环' },
  { type: '单证异常', owner: '单证岗', target: '装载前闭环' },
  { type: '转运异常', owner: '车队协调', target: '15 分钟响应' },
  { type: '签收异常', owner: '交付主管', target: 'POD 当日闭环' }
];

export const interfaceStatus = [
  { name: 'FFM 导入', method: '文件/API 双轨', status: '运行中', sync: '2026-04-06 20:18', note: '支持版本覆盖与差异对比' },
  { name: 'UWS 导入', method: 'Excel 模板', status: '运行中', sync: '2026-04-06 19:52', note: '按 AWB-ULD-PCS-GW 校验' },
  { name: 'Manifest 交换', method: 'PDF / 结构化解析', status: '警戒', sync: '2026-04-06 18:40', note: '目的港到货数量回传待固化' },
  { name: 'POD 回传', method: '上传 / 邮件转入', status: '运行中', sync: '2026-04-06 21:05', note: '与交付关闭状态强绑定' }
];

export const auditEvents = [
  { time: '2026-04-06 21:08', actor: 'Platform Admin', action: '新增货站', object: 'RZE', result: '待处理', note: '等待异常字典确认' },
  { time: '2026-04-06 20:43', actor: 'MME Supervisor', action: '上传 POD', object: 'POD-20260406-013', result: '运行中', note: '绑定 AWB 436-10358585' },
  { time: '2026-04-06 20:16', actor: 'URC Export Lead', action: '导入 UWS', object: 'SE913 06APR UWS', result: '运行中', note: '27 行全部通过校验' },
  { time: '2026-04-06 19:58', actor: 'Data Owner', action: '修改规则', object: 'Manifest 回传阈值', result: '运行中', note: '更新为差异 > 2% 触发预警' }
];

export const stationDashboardKpis = [
  { title: '今日进港航班', value: '6', helper: 'MME 样板站进港处理批次', chip: 'Inbound', color: 'primary' },
  { title: '今日出港航班', value: '4', helper: 'URC / MME 联动出港链路', chip: 'Outbound', color: 'secondary' },
  { title: '待发 NOA', value: '12', helper: '已理货未发送到货通知', chip: 'Queue', color: 'warning' },
  { title: '待补 POD', value: '5', helper: '已交付但签收文件未归档', chip: 'Action', color: 'error' }
];

export const inboundFlights = [
  {
    flightNo: 'SE803',
    eta: '19:05',
    etd: '17:40',
    source: 'MING PAO CANADA',
    status: '运行中',
    step: '拆板中',
    priority: 'P1',
    cargo: '214 pcs / 3,860 kg'
  },
  {
    flightNo: 'SE681',
    eta: '19:20',
    etd: '18:00',
    source: 'MING PAO TORONTO',
    status: '运行中',
    step: '理货中',
    priority: 'P2',
    cargo: '166 pcs / 2,940 kg'
  },
  {
    flightNo: 'URO901',
    eta: '20:10',
    etd: '18:35',
    source: 'MING PAO CANADA',
    status: '待处理',
    step: '待 NOA',
    priority: 'P1',
    cargo: '72 pcs / 1,180 kg'
  }
];

export const inboundFlightSourceOptions = ['MING PAO CANADA', 'MING PAO TORONTO'];

export const inboundFlightWaybillDetails = {
  SE803: [
    {
      awb: '436-10358585',
      consignee: 'SMDG LOGISTICS',
      pieces: '50',
      weight: '700 kg',
      currentNode: '拆板中',
      noaStatus: '待处理',
      podStatus: '待处理',
      transferStatus: '待分配卡车'
    },
    {
      awb: '436-10354363',
      consignee: 'LGG Transfer',
      pieces: '132',
      weight: '2,038 kg',
      currentNode: '已入货站',
      noaStatus: '待处理',
      podStatus: '待处理',
      transferStatus: '待理货'
    },
    {
      awb: '436-10359018',
      consignee: 'MME Hub',
      pieces: '32',
      weight: '1,122 kg',
      currentNode: '拆板完成',
      noaStatus: '运行中',
      podStatus: '待处理',
      transferStatus: '待发送 NOA'
    }
  ],
  SE681: [
    {
      awb: '436-10357944',
      consignee: 'LUCAROM AIR',
      pieces: '115',
      weight: '2,029 kg',
      currentNode: '理货中',
      noaStatus: '待处理',
      podStatus: '待处理',
      transferStatus: '待理货完成'
    },
    {
      awb: '436-10358827',
      consignee: 'MST Hub',
      pieces: '24',
      weight: '426 kg',
      currentNode: '已入货站',
      noaStatus: '待处理',
      podStatus: '待处理',
      transferStatus: '待理货'
    },
    {
      awb: '436-10358831',
      consignee: 'RZE Transfer',
      pieces: '27',
      weight: '485 kg',
      currentNode: '拆板完成',
      noaStatus: '运行中',
      podStatus: '待处理',
      transferStatus: '待转运'
    }
  ],
  URO901: [
    {
      awb: '436-10357093',
      consignee: 'MST Hub',
      pieces: '176',
      weight: '2,820 kg',
      currentNode: '待发送 NOA',
      noaStatus: '待处理',
      podStatus: '待处理',
      transferStatus: '待预约提货'
    },
    {
      awb: '436-10359166',
      consignee: 'Birmingham Partner',
      pieces: '18',
      weight: '352 kg',
      currentNode: '已理货',
      noaStatus: '待处理',
      podStatus: '待处理',
      transferStatus: '待发送 NOA'
    }
  ]
};

export const inboundCargoLifecycle = [
  { label: '运达', count: 214, note: '随航班到站并完成接收' },
  { label: '已卸机', count: 196, note: '卸机时间和操作人留痕' },
  { label: '已入货站', count: 188, note: '进入分区与拆板区域' },
  { label: '拆板理货中', count: 102, note: '逐票核对 AWB、件数、重量' },
  { label: 'NOA 已发送', count: 68, note: '已通知收货方预约提货' },
  { label: '已交付', count: 41, note: '已签收并待归档 POD' }
];

export const noaQueue = [
  { awb: '436-10358585', consignee: 'SMDG LOGISTICS', channel: 'Email', eta: '20:30', status: '待处理' },
  { awb: '436-10357944', consignee: 'LUCAROM AIR', channel: 'WhatsApp', eta: '20:45', status: '待处理' },
  { awb: '436-10357093', consignee: 'MST Hub', channel: 'Email', eta: '21:10', status: '运行中' }
];

export const inboundWaybillRows = [
  {
    awb: '436-10358585',
    barcode: '436-10358585',
    flightNo: 'SE803',
    consignee: 'SMDG LOGISTICS',
    pieces: '50',
    weight: '700 kg',
    currentNode: '待发送 NOA',
    noaStatus: '待处理',
    podStatus: '待处理'
  },
  {
    awb: '436-10357944',
    barcode: '436-10357944',
    flightNo: 'SE681',
    consignee: 'LUCAROM AIR',
    pieces: '115',
    weight: '2029 kg',
    currentNode: '理货完成',
    noaStatus: '待处理',
    podStatus: '待处理'
  },
  {
    awb: '436-10357093',
    barcode: '436-10357093',
    flightNo: 'URO901',
    consignee: 'MST Hub',
    pieces: '176',
    weight: '2820 kg',
    currentNode: '二次转运中',
    noaStatus: '运行中',
    podStatus: '待处理'
  },
  {
    awb: '436-10354363',
    barcode: '436-10354363',
    flightNo: 'SE803',
    consignee: 'LGG Transfer',
    pieces: '132',
    weight: '2038 kg',
    currentNode: '已交付',
    noaStatus: '运行中',
    podStatus: '运行中'
  }
];

export const transferRecords = [
  { transferId: 'TRK-0406-018', awb: '436-10354363', plate: 'MME-6271', driver: 'J. Kramer', destination: 'LGG', departAt: '21:15', status: '运行中' },
  { transferId: 'TRK-0406-014', awb: '436-10357406', plate: 'MME-5198', driver: 'L. Chen', destination: 'MST', departAt: '19:40', status: '运行中' },
  { transferId: 'TRK-0406-011', awb: '436-10358003', plate: 'MME-2204', driver: 'M. Xu', destination: 'RZE', departAt: '18:55', status: '待处理' }
];

export const outboundFlights = [
  { flightNo: 'SE913', etd: '23:00', status: '运行中', stage: '装载中', manifest: '待生成', cargo: '26 AWB / 1,396 pcs / 24,452 kg' },
  { flightNo: 'SE600', etd: '00:10', status: '待处理', stage: '待 Manifest', manifest: '已导入', cargo: '2 AWB / 8 pcs / 3,301 kg' },
  { flightNo: 'URO913', etd: '01:20', status: '运行中', stage: '主单完成', manifest: '待回传', cargo: '11 AWB / 700 pcs / 31,500 kg' }
];

export const ffmForecastRows = [
  { awb: '436-10357583', destination: 'MST', pieces: 185, weight: '2930 kg', goods: 'PHONE', uld: 'PMC08800R7' },
  { awb: '436-10357896', destination: 'MST', pieces: 122, weight: '1944 kg', goods: 'STICKER HAIR', uld: 'PMC81793YD' },
  { awb: '436-10358585', destination: 'MME', pieces: 50, weight: '700 kg', goods: 'TAIL BAG', uld: 'BULK' },
  { awb: '436-10359044', destination: 'MME', pieces: 68, weight: '1028 kg', goods: 'GARMENT', uld: 'ULD88004' },
  { awb: '436-10359218', destination: 'MME', pieces: 42, weight: '756 kg', goods: 'ACCESSORIES', uld: 'ULD88005' },
  { awb: '436-10359301', destination: 'MME', pieces: 36, weight: '612 kg', goods: 'E-COMMERCE', uld: 'ULD88006' },
  { awb: '436-10359477', destination: 'MST', pieces: 75, weight: '1185 kg', goods: 'COSMETIC', uld: 'PMC99001' },
  { awb: '436-10359512', destination: 'MST', pieces: 64, weight: '960 kg', goods: 'TEXTILE', uld: 'PMC99002' }
];

export const receiptRows = [
  { awb: '436-10357583', planned: '185 / 2930', actual: '185 / 2928', result: '运行中', issue: '无差异' },
  { awb: '436-10357896', planned: '122 / 1944', actual: '120 / 1936', result: '警戒', issue: '短少 2 件' },
  { awb: '436-10358585', planned: '50 / 700', actual: '50 / 700', result: '运行中', issue: '无差异' }
];

export const masterAwbRows = [
  { awb: '436-10358585', shipper: 'DONGGUAN PENGXUAN', consignee: 'SMDG LOGISTICS', route: 'URC → MME', pcs: 50, weight: '700 kg' },
  { awb: '436-10359044', shipper: 'SHENZHEN QIHANG', consignee: 'MME FASHION HUB', route: 'URC → MME', pcs: 68, weight: '1028 kg' },
  { awb: '436-10359218', shipper: 'GUANGZHOU HAOYI', consignee: 'MME ACCESSORY BV', route: 'URC → MME', pcs: 42, weight: '756 kg' },
  { awb: '436-10359301', shipper: 'YIWU LINK', consignee: 'MME ECOM DC', route: 'URC → MME', pcs: 36, weight: '612 kg' },
  { awb: '436-10359477', shipper: 'NINGBO BEST', consignee: 'MST COSMETIC NL', route: 'URC → MST', pcs: 75, weight: '1185 kg' },
  { awb: '436-10359512', shipper: 'SUZHOU NOVA', consignee: 'MST TEXTILE BV', route: 'URC → MST', pcs: 64, weight: '960 kg' },
  { awb: '436-10361352', shipper: 'AJ', consignee: 'LHR Partner', route: 'URC → LHR', pcs: 124, weight: '2332 kg' }
];

export const uwsRows = [
  { awb: '436-10356393', uld: 'CAR0326XJ', pcs: 62, weight: '1065', pod: 'BULK', destination: 'MST' },
  { awb: '436-10357944', uld: 'CAR0822XJ', pcs: 58, weight: '1021', pod: '20', destination: 'MST' },
  { awb: '436-10358003', uld: 'CAR0484XJ', pcs: 52, weight: '951', pod: '15L', destination: 'MST' },
  { awb: '436-10357896', uld: 'CAR1321XJ', pcs: 55, weight: '904', pod: '13L', destination: 'MST' }
];

export const manifestRows = [
  { flightNo: 'SE600', uld: 'PMC70018R7', awb: '436-10347665', pieces: 2, weight: '642.0', route: 'LHR/PVG', type: 'CONSOL' },
  { flightNo: 'SE600', uld: 'PMC70018R7', awb: '436-10347680', pieces: 2, weight: '896.0', route: 'LHR/PVG', type: 'CONSOL' },
  { flightNo: 'SE600', uld: 'PMC54062R7', awb: '436-10347676', pieces: 4, weight: '1763.0', route: 'LHR/PVG', type: 'CONSOL' }
];

export const manifestSummary = {
  outboundCount: '3 AWB / 8 pcs / 3301 kg',
  destinationCount: '待目的港回传',
  version: 'Manifest 01APR',
  exchange: 'PDF 导入 + 对账预留'
};

export const outboundWaybillRows = [
  { awb: '436-10357583', flightNo: 'SE913', destination: 'MST', forecast: '已预报', receipt: '已接收', master: '主单完成', loading: '已装载', manifest: '待生成' },
  { awb: '436-10357896', flightNo: 'SE913', destination: 'MST', forecast: '已预报', receipt: '警戒', master: '主单完成', loading: '待处理', manifest: '待生成' },
  { awb: '436-10358585', flightNo: 'URO913', destination: 'MME', forecast: '已预报', receipt: '已接收', master: '主单完成', loading: '运行中', manifest: '待回传' },
  { awb: '436-10347676', flightNo: 'SE600', destination: 'CTU', forecast: '待处理', receipt: '待处理', master: '待处理', loading: '待处理', manifest: '运行中' }
];

export const fileCenterRows = [
  { type: 'FFM', name: 'SE913FFM报文2026.04.01.docx', linkedTo: 'SE913', version: 'v1', updatedAt: '2026-04-06 18:22', status: '运行中' },
  { type: 'UWS', name: 'SE913 01APR UWS.xlsx', linkedTo: 'SE913', version: 'v1', updatedAt: '2026-04-06 18:34', status: '运行中' },
  { type: 'Manifest', name: 'SE600 MANIFEST 01APR.pdf', linkedTo: 'SE600', version: 'v1', updatedAt: '2026-04-06 18:40', status: '警戒' },
  { type: 'MAWB', name: '436-10358585-主单套打模板.xlsx', linkedTo: '436-10358585', version: 'v2', updatedAt: '2026-04-06 19:12', status: '运行中' },
  { type: 'POD', name: 'GOFONEW-020426-1 POD.pdf', linkedTo: 'TRK-0406-018', version: 'v1', updatedAt: '2026-04-06 20:43', status: '待处理' }
];

export const exceptionOverview = [
  { title: '数量异常', value: '3', helper: '短少与超收均需绑定责任主体', chip: 'Open', color: 'warning' },
  { title: '单证异常', value: '2', helper: '主单与 Manifest 版本差异待确认', chip: 'Review', color: 'secondary' },
  { title: '转运异常', value: '1', helper: '卡车到场晚于计划 22 分钟', chip: 'Delay', color: 'error' },
  { title: '签收异常', value: '1', helper: 'POD 缺双签，禁止关闭', chip: 'Block', color: 'error' }
];

export const exceptionCases = [
  { id: 'EXP-0406-011', type: '数量异常', object: '436-10357896', owner: 'MME Inbound Team', sla: '30 分钟', status: '警戒' },
  { id: 'EXP-0406-009', type: '单证异常', object: 'SE600 Manifest', owner: 'Document Desk', sla: '飞走前', status: '待处理' },
  { id: 'EXP-0406-007', type: '转运异常', object: 'TRK-0406-014', owner: 'Linehaul Control', sla: '15 分钟', status: '运行中' }
];
