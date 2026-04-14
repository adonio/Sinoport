import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { StationServices } from '@sinoport/domain';
import { mapMobileRoleKeyToRoleCodes, signAuthToken } from '@sinoport/auth';
import { handleServiceError, jsonError } from '../lib/http';
import { normalizeStationListQuery } from '../lib/policy';
import type { ApiApp } from '../index';

type RequireRoles = (roles: RoleCode[]) => MiddlewareHandler;

const mobileLoginStationOptions = [
  { value: 'mme', code: 'MME', label: 'MME 样板站' },
  { value: 'urc', code: 'URC', label: 'URC 前置站' },
  { value: 'mst', code: 'MST', label: 'MST 分拨站' },
  { value: 'boh', code: 'BOH', label: 'BoH 航站' },
  { value: 'rze', code: 'RZE', label: 'RZE 协同站' }
];

const mobileLoginRoleOptions = [
  { value: 'receiver', label: '收货员' },
  { value: 'checker', label: '复核员' },
  { value: 'supervisor', label: '主管 / 复核岗' },
  { value: 'document_clerk', label: '单证文员' },
  { value: 'driver', label: '司机 / 车队协调' },
  { value: 'delivery_clerk', label: '交付岗' }
];

const mobileRoleViews = {
  receiver: {
    label: '收货员',
    taskRoles: ['Warehouse Receiver', 'Export Receiver'],
    inboundTabs: ['overview', 'counting'],
    outboundTabs: ['overview', 'receipt'],
    flowKeys: ['preWarehouse'],
    actionTypes: ['scan', 'confirm', 'exception', 'suspend', 'complete']
  },
  checker: {
    label: '复核员',
    taskRoles: ['Check Worker', 'Pallet Builder'],
    inboundTabs: ['overview', 'counting', 'pallet'],
    outboundTabs: ['overview', 'receipt', 'container'],
    flowKeys: ['destinationRamp'],
    actionTypes: ['scan', 'confirm', 'exception', 'suspend', 'complete', 'upload-evidence']
  },
  supervisor: {
    label: '主管 / 复核岗',
    taskRoles: ['Inbound Supervisor', 'Export Supervisor', 'Runtime Monitor', 'Ramp Loader', 'Destination Ramp', 'Build-up Worker'],
    inboundTabs: ['overview', 'counting', 'pallet', 'loading'],
    outboundTabs: ['overview', 'receipt', 'container', 'loading'],
    flowKeys: ['exportRamp', 'runtime', 'destinationRamp'],
    actionTypes: ['scan', 'confirm', 'exception', 'suspend', 'complete', 'upload-evidence', 'sign']
  },
  document_clerk: {
    label: '单证文员',
    taskRoles: ['Document Desk', 'Customer Desk'],
    inboundTabs: ['overview'],
    outboundTabs: ['overview'],
    flowKeys: ['runtime'],
    actionTypes: ['confirm', 'exception', 'upload-evidence', 'sign']
  },
  driver: {
    label: '司机 / 车队协调',
    taskRoles: ['Linehaul Coordinator', 'Loading Coordinator'],
    inboundTabs: ['overview', 'loading'],
    outboundTabs: ['overview', 'loading'],
    flowKeys: ['headhaul', 'tailhaul'],
    actionTypes: ['confirm', 'exception', 'suspend', 'complete']
  },
  delivery_clerk: {
    label: '交付岗',
    taskRoles: ['Delivery Desk'],
    inboundTabs: ['overview'],
    outboundTabs: ['overview'],
    flowKeys: ['delivery'],
    actionTypes: ['confirm', 'exception', 'complete', 'sign', 'upload-evidence']
  }
} as const;

const mobileNodeFlowMap = {
  pre_warehouse: 'preWarehouse',
  headhaul: 'headhaul',
  outbound_station: 'exportRamp',
  export_ramp: 'exportRamp',
  flight_runtime: 'runtime',
  destination_ramp: 'destinationRamp',
  inbound_station: 'destinationRamp',
  tailhaul: 'tailhaul',
  delivery: 'delivery'
} as const;

const mobileNodeOptions = [
  {
    key: 'pre_warehouse',
    title: '前置仓收货',
    description: '处理前置仓收货、件重体确认、异常标记和冻结放行。',
    path: '/mobile/pre-warehouse'
  },
  {
    key: 'headhaul',
    title: '头程卡车',
    description: '处理 CMR、司机、车牌、发车和到站交接。',
    path: '/mobile/headhaul'
  },
  {
    key: 'outbound_station',
    title: '出港货站',
    description: '沿用现有出港链路，处理收货、理货、组板、单证核对。',
    path: '/mobile/outbound'
  },
  {
    key: 'export_ramp',
    title: '出港机坪',
    description: '处理转运、Loaded 确认和装机证据上传。',
    path: '/mobile/export-ramp'
  },
  {
    key: 'flight_runtime',
    title: '航班运行',
    description: '处理 Airborne / Landed 的只读确认与异常上报入口。',
    path: '/mobile/runtime'
  },
  {
    key: 'destination_ramp',
    title: '到港机坪',
    description: '处理到港接机、机坪放行和转入货站。',
    path: '/mobile/destination-ramp'
  },
  {
    key: 'inbound_station',
    title: '进港货站',
    description: '沿用现有进港链路，处理拆板、理货、组托和装车。',
    path: '/mobile/inbound'
  },
  {
    key: 'tailhaul',
    title: '尾程装车',
    description: '处理司机 / 车牌登记、装车复核、发车和交接文件。',
    path: '/mobile/tailhaul'
  },
  {
    key: 'delivery',
    title: '交付仓',
    description: '处理签收、POD 双签、异常签收和关闭校验。',
    path: '/mobile/delivery'
  }
] as const;

const mobileNodeFlowAliasMap = {
  flightRuntime: 'runtime'
} as const;

const mobileNodeCatalog = {
  preWarehouse: {
    listTitle: '前置仓收货批次',
    detailTitle: '前置仓收货任务',
    list: [
      {
        id: 'URC-COL-001',
        title: 'URC-COL-001',
        subtitle: 'URC 前置仓 · 3 AWB / 286 箱 / 4,128 kg',
        status: '待处理',
        priority: 'P1'
      },
      {
        id: 'URC-COL-002',
        title: 'URC-COL-002',
        subtitle: 'URC 前置仓 · 2 AWB / 148 箱 / 2,196 kg',
        status: '运行中',
        priority: 'P2'
      }
    ],
    details: {
      'URC-COL-001': {
        title: 'URC-COL-001',
        node: '前置仓收货',
        role: 'Warehouse Receiver',
        status: '待处理',
        priority: 'P1',
        sla: '收货后 15 分钟',
        description: '确认批次收货、件重体、异常件和冻结放行条件。',
        evidence: ['Collection Note', '件重体确认', '异常照片'],
        blockers: ['未确认件重体不得进入头程卡车。'],
        actions: [{ label: '确认收货', variant: 'contained' }, { label: '异常标记' }, { label: '冻结放行' }],
        summaryRows: [
          { label: '站点', value: 'URC 前置仓' },
          { label: 'AWB', value: '436-10357583 / 436-10357896 / 436-10358585' },
          { label: '件数', value: '286 箱' },
          { label: '重量', value: '4,128 kg' }
        ],
        records: ['Collection Note 待补签', '异常件 2 箱待拍照', '完成后生成头程卡车任务']
      },
      'URC-COL-002': {
        title: 'URC-COL-002',
        node: '前置仓收货',
        role: 'Warehouse Receiver',
        status: '运行中',
        priority: 'P2',
        sla: '收货后 30 分钟',
        description: '样例批次已开始收货，用于演示第二批的前置仓节点。',
        evidence: ['件重体确认', '异常备注'],
        blockers: ['存在异常件时只能进入待复核。'],
        actions: [{ label: '继续收货', variant: 'contained' }, { label: '挂起' }, { label: '完成' }],
        summaryRows: [
          { label: '站点', value: 'URC 前置仓' },
          { label: 'AWB', value: '436-10359218 / 436-10359301' },
          { label: '件数', value: '148 箱' },
          { label: '重量', value: '2,196 kg' }
        ],
        records: ['已确认 120 箱', '待补 28 箱', '异常 0 箱']
      }
    }
  },
  headhaul: {
    listTitle: '头程卡车 Trip',
    detailTitle: '头程卡车任务',
    list: [
      { id: 'TRIP-URC-001', title: 'TRIP-URC-001', subtitle: 'URC -> 出港货站 / 车牌 URC-TRK-101', status: '待发车', priority: 'P1' },
      { id: 'TRIP-URC-002', title: 'TRIP-URC-002', subtitle: 'URC -> 出港货站 / 车牌 URC-TRK-205', status: '在途', priority: 'P2' }
    ],
    details: {
      'TRIP-URC-001': {
        title: 'TRIP-URC-001',
        node: '头程卡车运输',
        role: 'Linehaul Coordinator',
        status: '待发车',
        priority: 'P1',
        sla: '收货完成后 20 分钟',
        description: '确认 CMR、司机、车牌和发车状态，完成从前置仓到出港货站交接。',
        evidence: ['CMR', '司机 / 车牌', '发车时间'],
        blockers: ['未确认 CMR 不得发车。'],
        actions: [{ label: '确认 CMR', variant: 'contained' }, { label: '发车' }, { label: '到站交接' }],
        summaryRows: [
          { label: '车牌', value: 'URC-TRK-101' },
          { label: '司机', value: 'H. Zhao' },
          { label: 'CMR', value: 'CMR-URC-001' },
          { label: '预报提单数', value: '3 票' },
          { label: '当前状态', value: '待发车' }
        ],
        forecastWaybills: [
          { awb: '436-10358585', consignee: 'SMDG LOGISTICS', pieces: '50', weight: '700 kg' },
          { awb: '436-10359044', consignee: 'MME FASHION HUB', pieces: '68', weight: '1,028 kg' },
          { awb: '436-10359218', consignee: 'MME ACCESSORY BV', pieces: '42', weight: '756 kg' }
        ],
        records: ['Collection Note 已完成', '司机到场', '出发后进入在途']
      },
      'TRIP-URC-002': {
        title: 'TRIP-URC-002',
        node: '头程卡车运输',
        role: 'Linehaul Coordinator',
        status: '在途',
        priority: 'P2',
        sla: '在途回传每 30 分钟',
        description: '样例 Trip 已发车，用于演示在途与到站交接。',
        evidence: ['位置回传', '到站签收'],
        blockers: ['无到站交接文件时不得进入出港货站收货。'],
        actions: [{ label: '记录在途', variant: 'contained' }, { label: '到站交接' }],
        summaryRows: [
          { label: '车牌', value: 'URC-TRK-205' },
          { label: '司机', value: 'L. Wang' },
          { label: 'CMR', value: 'CMR-URC-002' },
          { label: '预报提单数', value: '2 票' },
          { label: '当前状态', value: '在途' }
        ],
        forecastWaybills: [
          { awb: '436-10359301', consignee: 'MME ECOM DC', pieces: '36', weight: '612 kg' },
          { awb: '436-10359512', consignee: 'MST TEXTILE BV', pieces: '64', weight: '960 kg' }
        ],
        records: ['已发车 35 分钟', '预计 20 分钟后到站']
      }
    }
  },
  exportRamp: {
    listTitle: '出港机坪航班',
    detailTitle: '出港机坪任务',
    list: [
      { id: 'SE913', title: 'SE913', subtitle: 'URC 出港机坪 / Loaded 前检查', status: '待处理', priority: 'P1' },
      { id: 'URO913', title: 'URO913', subtitle: 'URC 出港机坪 / UWS 复核中', status: '运行中', priority: 'P2' }
    ],
    details: {
      SE913: {
        title: 'SE913',
        node: '出港机场机坪操作',
        role: 'Ramp Loader',
        status: '待处理',
        priority: 'P1',
        sla: '飞走前 30 分钟',
        description: '执行机坪转运、Loaded 确认和装机证据上传。',
        evidence: ['Loaded 照片', 'ULD 绑定', '复核签名'],
        blockers: ['Manifest 未冻结不得完成机坪放行。'],
        actions: [{ label: '记录转运', variant: 'contained' }, { label: '确认 Loaded' }, { label: '上传证据' }],
        summaryRows: [
          { label: '航班', value: 'SE913' },
          { label: 'ETD', value: '23:00' },
          { label: 'Manifest', value: '待冻结' },
          { label: 'UWS', value: '已接收' }
        ],
        positionOptions: ['11L', '11R', '13L', '13R', '14P', '15C'],
        uldAssignments: [
          { uld: 'ULD91001', pieces: '31 箱', weight: '2,180.5 kg', destination: 'MST', position: '' },
          { uld: 'ULD91002', pieces: '14 箱', weight: '840.2 kg', destination: 'MST', position: '13L' },
          { uld: 'PMC81793YD', pieces: '12 箱', weight: '904.0 kg', destination: 'MST', position: '' }
        ],
        records: ['待上传 Loaded 照片', '待独立复核签名']
      },
      URO913: {
        title: 'URO913',
        node: '出港机场机坪操作',
        role: 'Ramp Loader',
        status: '运行中',
        priority: 'P2',
        sla: '飞走前 20 分钟',
        description: '样例航班已进入出港机坪处理，用于演示第二批节点。',
        evidence: ['UWS 复核', 'Loaded 时间戳'],
        blockers: ['无 UWS 不得标记已装载。'],
        actions: [{ label: '继续装机', variant: 'contained' }, { label: '完成 Loaded' }],
        summaryRows: [
          { label: '航班', value: 'URO913' },
          { label: 'ETD', value: '01:20' },
          { label: 'Manifest', value: '待回传' },
          { label: 'UWS', value: '运行中' }
        ],
        positionOptions: ['21L', '21R', '22P'],
        uldAssignments: [
          { uld: 'ULD93001', pieces: '18 箱', weight: '1,050.0 kg', destination: 'LGG', position: '21L' },
          { uld: 'ULD93002', pieces: '10 箱', weight: '620.0 kg', destination: 'LGG', position: '' }
        ],
        records: ['已完成 2 个 ULD 绑定', '剩余 1 个 ULD 待复核']
      }
    }
  },
  flightRuntime: {
    listTitle: '航班运行节点',
    detailTitle: '航班运行任务',
    list: [
      { id: 'SE913', title: 'SE913', subtitle: 'URC -> Flight Runtime / Airborne 待确认', status: '待处理', priority: 'P1' },
      { id: 'SE803', title: 'SE803', subtitle: 'Landed 后待目的站准备', status: '运行中', priority: 'P1' }
    ],
    details: {
      SE913: {
        title: 'SE913',
        node: '航班运行',
        role: 'Runtime Monitor',
        status: '待处理',
        priority: 'P1',
        sla: '起飞后即时确认',
        description: '航班运行节点只做只读确认和异常上报，不承接现场执行动作。',
        evidence: ['Flight Runtime', '异常备注'],
        blockers: ['无 Flight Runtime 回填时，只能停留在待处理。'],
        actions: [{ label: '确认 Airborne', variant: 'contained' }, { label: '上报异常' }],
        summaryRows: [
          { label: '航班', value: 'SE913' },
          { label: 'Runtime', value: 'Airborne' },
          { label: '链路', value: 'URC -> MME / MST' },
          { label: '当前口径', value: '只读确认 + 异常上报' }
        ],
        flightInfoRows: [
          { label: '航班号', value: 'SE913' },
          { label: '方向', value: '出港' },
          { label: 'Runtime', value: 'Airborne' },
          { label: '航线', value: 'URC -> MME / MST' },
          { label: 'ETD', value: '23:00' },
          { label: '机型', value: 'B747-400F' },
          { label: '当前阶段', value: '装载中' },
          { label: '货量', value: '26 AWB / 1,396 pcs / 24,452 kg' },
          { label: 'Manifest', value: '待生成' },
          { label: 'UWS', value: '已接收' }
        ],
        flightDocuments: [
          { title: 'FFM', description: 'SE913-FFM-08APR.docx', status: '运行中', meta: '18:22 已完成结构化导入' },
          { title: 'UWS', description: 'SE913-UWS-08APR.xlsx', status: '运行中', meta: '18:34 已接收，可用于 Loaded 对账' },
          { title: 'Manifest', description: 'SE913-MANIFEST-08APR.pdf', status: '待生成', meta: '最终版未冻结，仍阻断机坪放行' }
        ],
        records: ['起飞时间待确认', '异常则升级到 Platform Ops']
      },
      SE803: {
        title: 'SE803',
        node: '航班运行',
        role: 'Runtime Monitor',
        status: '运行中',
        priority: 'P1',
        sla: '落地后 5 分钟内确认',
        description: '航班已进入 Landed，可继续触发到港机坪和目的站准备任务。',
        evidence: ['Landed 确认', '异常备注'],
        blockers: ['无 Landed 确认时，进港机坪节点不应继续。'],
        actions: [{ label: '确认 Landed', variant: 'contained' }, { label: '上报异常' }],
        summaryRows: [
          { label: '航班', value: 'SE803' },
          { label: 'Runtime', value: 'Landed' },
          { label: '链路', value: 'Flight -> MME' },
          { label: '当前口径', value: '只读确认 + 异常上报' }
        ],
        flightInfoRows: [
          { label: '航班号', value: 'SE803' },
          { label: '方向', value: '进港' },
          { label: 'Runtime', value: 'Landed' },
          { label: '来源', value: 'MING PAO CANADA' },
          { label: '目的站', value: 'MME' },
          { label: 'ETA', value: '19:05' },
          { label: 'ETD', value: '17:40' },
          { label: '机型', value: 'B767-300F' },
          { label: '当前阶段', value: '拆板中' },
          { label: '货量', value: '214 pcs / 3,860 kg' }
        ],
        flightDocuments: [
          { title: 'CBA', description: 'SE803-CBA-v2.pdf', status: '警戒', meta: '最终版待上传，拆板任务仅可预排' },
          { title: 'Manifest', description: 'SE803 MANIFEST 08APR.pdf', status: '运行中', meta: '已生效，可继续目的站准备' }
        ],
        records: ['Landed 后允许进入目的站准备', '异常则阻断后续节点']
      }
    }
  },
  destinationRamp: {
    listTitle: '到港机坪航班',
    detailTitle: '到港机坪任务',
    list: [
      { id: 'SE803', title: 'SE803', subtitle: 'MME 到港机坪 / 待放行入货站', status: '待处理', priority: 'P1' },
      { id: 'SE681', title: 'SE681', subtitle: 'MME 到港机坪 / 已接机', status: '已接机', priority: 'P2' }
    ],
    details: {
      SE803: {
        title: 'SE803',
        node: '进港机场机坪操作',
        role: 'Destination Ramp',
        status: '待处理',
        priority: 'P1',
        sla: 'Landed 后 15 分钟',
        description: '处理到港接机、机坪放行和转入货站。',
        evidence: ['接机确认', '放行时间', '转入货站记录'],
        blockers: ['机坪放行前不得进入 Inbound Handling。'],
        actions: [{ label: '确认接机', variant: 'contained' }, { label: '机坪放行' }, { label: '转入货站' }],
        summaryRows: [
          { label: '航班', value: 'SE803' },
          { label: 'ETA', value: '19:05' },
          { label: '机坪状态', value: '待放行' },
          { label: '目标站点', value: 'MME' }
        ],
        unloadTasks: [
          {
            position: '11L',
            uld: 'PMC70018R7',
            cargo: '436-10358585 / 436-10354363',
            requirement: '先拆网并复核板号，再按 MME inbound belt-01 顺序卸载。'
          },
          {
            position: '13R',
            uld: 'PMC54062R7',
            cargo: '436-10359018',
            requirement: '优先转入异常复核区，卸载完成后立即回填到港时间。'
          }
        ],
        records: ['落地已确认', '机坪交接待完成']
      },
      SE681: {
        title: 'SE681',
        node: '进港机场机坪操作',
        role: 'Destination Ramp',
        status: '已接机',
        priority: 'P2',
        sla: 'Landed 后 20 分钟',
        description: '样例到港机坪任务已完成接机，用于演示转入货站前状态。',
        evidence: ['接机时间戳', '交接记录'],
        blockers: ['未完成交接记录不得转入货站。'],
        actions: [{ label: '补交接记录', variant: 'contained' }, { label: '转入货站' }],
        summaryRows: [
          { label: '航班', value: 'SE681' },
          { label: 'ETA', value: '19:20' },
          { label: '机坪状态', value: '已接机' },
          { label: '目标站点', value: 'MME' }
        ],
        unloadTasks: [
          {
            position: '12L',
            uld: 'ULD68101',
            cargo: '436-10360018 / 436-10360027',
            requirement: '按 12L 机位先卸高优货，再回收空板并提交交接记录。'
          }
        ],
        records: ['接机已完成', '待填写放行人']
      }
    }
  },
  tailhaul: {
    listTitle: '尾程装车 Trip',
    detailTitle: '尾程装车与运输任务',
    list: [
      { id: 'TAIL-001', title: 'TAIL-001', subtitle: 'MME -> Delivery / 车牌 MME-6271', status: '待发车', priority: 'P1' },
      { id: 'TAIL-002', title: 'TAIL-002', subtitle: 'MME -> Delivery / 车牌 MME-5198', status: '在途', priority: 'P2' }
    ],
    details: {
      'TAIL-001': {
        title: 'TAIL-001',
        node: '尾程卡车装车与运输',
        role: 'Loading Coordinator',
        status: '待发车',
        priority: 'P1',
        sla: '车辆到场后 15 分钟',
        description: '登记司机、车牌、Collection Note，完成装车复核并发车。',
        evidence: ['司机 / 车牌', 'Collection Note', '装车复核'],
        blockers: ['缺司机、车牌、Collection Note 时不得发车。'],
        actions: [{ label: '登记车辆', variant: 'contained' }, { label: '完成装车复核' }, { label: '发车' }],
        summaryRows: [
          { label: '车牌', value: 'MME-6271' },
          { label: '司机', value: 'J. Kramer' },
          { label: 'Collection Note', value: 'CN-MME-018' },
          { label: 'Pallet', value: '3 托盘' }
        ],
        records: ['待装车复核', '待发车确认']
      },
      'TAIL-002': {
        title: 'TAIL-002',
        node: '尾程卡车装车与运输',
        role: 'Loading Coordinator',
        status: '在途',
        priority: 'P2',
        sla: '在途回传每 20 分钟',
        description: '样例尾程 Trip 已发车，用于演示在途与交接文件。',
        evidence: ['发车时间', '交接文件'],
        blockers: ['无交接文件不得进入交付签收。'],
        actions: [{ label: '记录在途', variant: 'contained' }, { label: '补交接文件' }],
        summaryRows: [
          { label: '车牌', value: 'MME-5198' },
          { label: '司机', value: 'L. Chen' },
          { label: 'Collection Note', value: 'CN-MME-014' },
          { label: 'Pallet', value: '2 托盘' }
        ],
        records: ['已发车 25 分钟', '交接文件待补传']
      }
    }
  },
  delivery: {
    listTitle: '交付仓任务',
    detailTitle: '交付签收任务',
    list: [
      { id: 'DLV-001', title: 'DLV-001', subtitle: 'SMDG LOGISTICS / 待签收', status: '待签收', priority: 'P1' },
      { id: 'DLV-002', title: 'DLV-002', subtitle: 'LUCAROM AIR / 待补签', status: '警戒', priority: 'P2' }
    ],
    details: {
      'DLV-001': {
        title: 'DLV-001',
        node: '交付仓',
        role: 'Delivery Desk',
        status: '待签收',
        priority: 'P1',
        sla: '到仓后 30 分钟',
        description: '处理签收、POD 双签、异常签收与关闭校验。',
        evidence: ['POD 双签', '签收对象', '签收时间'],
        blockers: ['未完成双签不得 Closed。'],
        actions: [{ label: '发起签收', variant: 'contained' }, { label: '记录双签' }, { label: '完成关闭' }],
        summaryRows: [
          { label: '客户', value: 'SMDG LOGISTICS' },
          { label: 'AWB', value: '436-10358585' },
          { label: '车牌', value: 'MME-6271' },
          { label: 'POD', value: '待双签' }
        ],
        records: ['到仓确认已完成', '客户签收待开始']
      },
      'DLV-002': {
        title: 'DLV-002',
        node: '交付仓',
        role: 'Delivery Desk',
        status: '警戒',
        priority: 'P2',
        sla: 'POD 当日闭环',
        description: '样例签收任务已完成交付，但缺 POD 双签。',
        evidence: ['POD 双签', '签收对象'],
        blockers: ['POD 缺双签，阻断 Closed。'],
        actions: [{ label: '补 POD 签字', variant: 'contained' }, { label: '异常签收' }],
        summaryRows: [
          { label: '客户', value: 'LUCAROM AIR' },
          { label: 'AWB', value: '436-10357944' },
          { label: '车牌', value: 'MME-5198' },
          { label: 'POD', value: '待补签' }
        ],
        records: ['交付已完成', '关闭前校验未通过']
      }
    }
  }
} as const;

function resolveMobileNodeFlowKey(flowKey: string) {
  if (Object.prototype.hasOwnProperty.call(mobileNodeCatalog, flowKey)) {
    return flowKey as keyof typeof mobileNodeCatalog;
  }

  return null;
}

function resolveMobileNodeRoleFlowKey(flowKey: string) {
  return mobileNodeFlowAliasMap[flowKey as keyof typeof mobileNodeFlowAliasMap] || flowKey;
}

function isMobileNodeFlowAllowed(roleView: any, flowKey: string) {
  const flowKeys = Array.isArray(roleView?.flowKeys) ? roleView.flowKeys : [];
  return flowKeys.includes(resolveMobileNodeRoleFlowKey(flowKey));
}

function isMobileNodeRoleAllowed(roleView: any, role: string) {
  const taskRoles = Array.isArray(roleView?.taskRoles) ? roleView.taskRoles : [];
  return Boolean(role && taskRoles.includes(role));
}

function buildMobileNodeTaskCard(detail: any, roleView: any, allowed: boolean) {
  return {
    title: detail.title,
    node: detail.node,
    role: detail.role,
    status: detail.status,
    priority: detail.priority,
    sla: detail.sla,
    description: detail.description,
    evidence: detail.evidence || [],
    blockers: allowed ? detail.blockers || [] : [...(detail.blockers || []), `当前角色 ${roleView?.label || ''} 仅可查看，不可执行 ${detail.role} 任务。`],
    actions: allowed ? detail.actions || [] : []
  };
}

function buildMobileNodeFlowResponse(actor: any, stationId: string, flowKey: string, itemId?: string) {
  const roleResponse = buildMobileSelectResponse(actor);
  const resolvedFlowKey = resolveMobileNodeFlowKey(flowKey);

  if (!resolvedFlowKey) {
    return null;
  }

  const catalog = mobileNodeCatalog[resolvedFlowKey];
  const flowDetails = catalog.details as Record<string, any>;
  const flowAllowed = isMobileNodeFlowAllowed(roleResponse.roleView, flowKey);
  const items = catalog.list
    .map((item: any) => {
      const detail = flowDetails[item.id];
      const allowed = detail ? flowAllowed || isMobileNodeRoleAllowed(roleResponse.roleView, detail.role) : flowAllowed;
      return {
        ...item,
        allowed
      };
    })
    .filter((item: any) => item.allowed);
  const detail = itemId ? flowDetails[itemId] || null : null;

  if (itemId && !detail) {
    return null;
  }

  const detailAllowed = detail ? flowAllowed || isMobileNodeRoleAllowed(roleResponse.roleView, detail.role) : false;
  const taskCard = detail ? buildMobileNodeTaskCard(detail, roleResponse.roleView, detailAllowed) : null;

  return {
    stationId,
    flowKey,
    listTitle: catalog.listTitle,
    detailTitle: catalog.detailTitle,
    session: roleResponse.session,
    roleView: roleResponse.roleView,
    flowAllowed,
    availableActions: roleResponse.roleView.actionTypes,
    items,
    detail: detail
      ? {
          ...detail,
          allowed: detailAllowed,
          taskCard
        }
      : null,
    taskCard,
    nodeOptions: items,
    mobileNodeLoading: false
  };
}

function isoNow() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function resolveScopedStation(actor: any, requestedStationId?: string) {
  const stationId = requestedStationId || actor.stationScope?.[0] || 'MME';

  if (!actor.stationScope?.includes(stationId)) {
    throw new Error('STATION_SCOPE_DENIED');
  }

  return stationId;
}

async function resolveMobileUserId(c: any, requestedUserId: string | undefined) {
  if (!c.env.DB) {
    return requestedUserId || 'demo-mobile';
  }

  if (requestedUserId) {
    const existing = (await c.env.DB.prepare(`SELECT user_id FROM users WHERE user_id = ? LIMIT 1`)
      .bind(requestedUserId)
      .first()) as { user_id: string } | null;

    if (existing?.user_id) {
      return existing.user_id;
    }
  }

  const fallback = (await c.env.DB.prepare(`SELECT user_id FROM users WHERE user_id = 'demo-mobile' LIMIT 1`).first()) as {
    user_id: string;
  } | null;
  return fallback?.user_id || 'demo-mobile';
}

function resolveMobileRoleKey(actor: any, requestedRoleKey?: string) {
  const normalizedRequestedRoleKey = String(requestedRoleKey || '').trim();

  if (normalizedRequestedRoleKey && Object.prototype.hasOwnProperty.call(mobileRoleViews, normalizedRequestedRoleKey)) {
    return normalizedRequestedRoleKey;
  }

  const roleIds = Array.isArray(actor?.roleIds) ? actor.roleIds : [];

  if (roleIds.includes('station_supervisor')) return 'supervisor';
  if (roleIds.includes('document_desk')) return 'document_clerk';
  if (roleIds.includes('check_worker')) return 'checker';
  if (roleIds.includes('delivery_desk')) return 'delivery_clerk';
  if (roleIds.includes('inbound_operator')) return 'receiver';
  if (roleIds.includes('mobile_operator')) return 'driver';

  return 'supervisor';
}

function buildMobileRoleView(roleKey: keyof typeof mobileRoleViews) {
  return mobileRoleViews[roleKey] || mobileRoleViews.supervisor;
}

function buildMobileSelectResponse(actor: any, requestedRoleKey?: string) {
  const roleKey = resolveMobileRoleKey(actor, requestedRoleKey);
  const roleView = buildMobileRoleView(roleKey as keyof typeof mobileRoleViews);
  const roleFlowKeys = roleView.flowKeys as readonly string[];
  const nodeOptions = mobileNodeOptions.map((item) => {
    const flowKey = mobileNodeFlowMap[item.key as keyof typeof mobileNodeFlowMap] || item.key;

    return {
      key: item.key,
      title: item.title,
      description: item.description,
      path: item.path,
      flowKey,
      recommended: roleFlowKeys.includes(String(flowKey))
    };
  });
  const recommendedNodes = nodeOptions.filter((item) => item.recommended);
  const stationCode = actor?.stationScope?.[0] || 'MME';

  return {
    session: {
      roleKey,
      roleLabel: roleView.label,
      stationCode,
      userId: actor?.userId || 'demo-mobile',
      roleIds: Array.isArray(actor?.roleIds) ? actor.roleIds : [],
      stationScope: Array.isArray(actor?.stationScope) ? actor.stationScope : [stationCode],
      clientSource: actor?.clientSource || 'mobile-pda',
      tenantId: actor?.tenantId || 'sinoport-demo'
    },
    roleView,
    recommendedNode: recommendedNodes[0] || null,
    recommendedNodes,
    nodeOptions
  };
}

function formatMobileClock(value: unknown) {
  if (!value) return '--';

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function mapMobileInboundFlightItem(item: any) {
  return {
    flightNo: item.flight_no,
    source: item.origin_code,
    eta: formatMobileClock(item.eta || item.actual_landed_at),
    step: item.summary?.current_step || item.runtime_status,
    priority: item.service_level || 'P2',
    cargo: `${item.summary?.total_pieces || 0} pcs / ${item.summary?.total_weight || 0} kg`,
    status: item.runtime_status,
    taskCount: item.summary?.open_task_count || 0,
    blocked: Boolean(item.summary?.blocked),
    blockerReason: item.summary?.blocker_reason || ''
  };
}

function mapMobileOutboundFlightItem(item: any, tasks: any[] = []) {
  const cargoPieces = Number(item.summary?.total_awb_count ?? 0);
  const cargoBoxes = Number(item.summary?.total_pieces ?? 0);
  const cargoWeight = Number(item.summary?.total_weight ?? 0);

  return {
    flight_id: item.flight_id,
    flight_no: item.flight_no,
    flightNo: item.flight_no,
    source: item.origin_code,
    etd: formatMobileClock(item.etd),
    step: item.summary?.stage || item.runtime_status,
    stage: item.summary?.stage || item.runtime_status,
    priority: item.service_level || 'P2',
    cargo: `${cargoPieces} AWB / ${cargoBoxes} pcs / ${cargoWeight} kg`,
    status: item.runtime_status,
    manifest: item.summary?.manifest_status || '待处理',
    taskCount: tasks.length,
    tasks
  };
}

function mapMobileInboundTaskItem(item: any) {
  return {
    task_id: item.task_id,
    task_type: item.task_type,
    execution_node: item.execution_node,
    task_status: item.task_status,
    related_object_type: item.related_object_type,
    related_object_id: item.related_object_id,
    related_object_label: item.related_object_label,
    awb_no: item.awb_no,
    flight_no: item.flight_no,
    station_id: item.station_id,
    due_at: item.due_at,
    evidence_required: item.evidence_required,
    blockers: item.blockers,
    allowed_actions: item.allowed_actions
  };
}

function buildMobileOutboundOverviewResponse(actor: any, stationId: string, outboundFlightsResult: any, mobileTasksResult: any) {
  const roleResponse = buildMobileSelectResponse(actor);
  const outboundFlights = (outboundFlightsResult?.items || []).map((item: any) => mapMobileOutboundFlightItem(item));
  const mobileTasks = (mobileTasksResult?.items || []).map(mapMobileInboundTaskItem);
  const flightTasks = mobileTasks.filter((item: any) => item.flight_no);
  const tasksByFlightNo = flightTasks.reduce((acc: Record<string, any[]>, task: any) => {
    const flightNo = String(task.flight_no || '').trim();
    if (!flightNo) return acc;
    if (!acc[flightNo]) {
      acc[flightNo] = [];
    }
    acc[flightNo].push(task);
    return acc;
  }, {});

  return {
    stationId,
    session: roleResponse.session,
    roleView: roleResponse.roleView,
    availableTabs: roleResponse.roleView.outboundTabs,
    availableActions: roleResponse.roleView.actionTypes,
    summary: {
      totalFlights: outboundFlights.length,
      totalTasks: flightTasks.length,
      queuedTasks: flightTasks.filter((item: any) => ['Created', 'Assigned', 'Accepted'].includes(item.task_status)).length,
      activeTasks: flightTasks.filter((item: any) => ['Started', 'Evidence Uploaded'].includes(item.task_status)).length,
      completedTasks: flightTasks.filter((item: any) => ['Completed', 'Verified', 'Closed'].includes(item.task_status)).length
    },
    outboundFlights: outboundFlights.map((flight: any) => ({
      ...flight,
      tasks: tasksByFlightNo[flight.flight_no] || [],
      taskCount: (tasksByFlightNo[flight.flight_no] || []).length
    })),
    mobileTasks
  };
}

function mapMobileOutboundWaybillItem(item: any) {
  const pieces = Number(item.pieces ?? 0);
  const totalWeightKg = Number(item.gross_weight ?? 0);

  return {
    awbId: item.awb_id || '',
    awb: item.awb_no,
    flightNo: item.flight_no,
    destination: item.destination_code || '--',
    consignee: item.destination_code || '--',
    pieces,
    totalPieces: pieces,
    totalWeightKg,
    totalWeight: totalWeightKg,
    expectedBoxes: pieces,
    expectedBoxesKnown: true,
    unitWeight: pieces ? totalWeightKg / pieces : 0,
    weight: `${totalWeightKg} kg`,
    barcode: item.awb_no,
    currentNode: '出港收货',
    forecastStatus: item.forecast_status || '待处理',
    receiptStatus: item.receipt_status || '待处理',
    masterStatus: item.master_status || '待处理',
    loadingStatus: item.loading_status || '待装机',
    manifestStatus: item.manifest_status || '待处理',
    noaStatus: item.forecast_status || '待处理',
    podStatus: item.receipt_status || '待处理',
    transferStatus: item.loading_status || '待装机',
    blocked: false,
    blockerReason: ''
  };
}

function mapMobileOutboundForecastAwbItem(item: any) {
  return {
    awb: item.awb,
    flightNo: item.flightNo,
    destination: item.destination,
    pieces: item.pieces,
    totalPieces: item.totalPieces,
    totalWeightKg: item.totalWeightKg,
    totalWeight: item.totalWeight,
    forecastStatus: item.forecastStatus,
    receiptStatus: item.receiptStatus,
    manifestStatus: item.manifestStatus
  };
}

function mapMobileOutboundMasterAwbItem(item: any) {
  return {
    awb: item.awb,
    flightNo: item.flightNo,
    destination: item.destination,
    pieces: item.pieces,
    totalPieces: item.totalPieces,
    totalWeightKg: item.totalWeightKg,
    totalWeight: item.totalWeight,
    masterStatus: item.masterStatus,
    loadingStatus: item.loadingStatus,
    manifestStatus: item.manifestStatus
  };
}

function mapMobileOutboundReceiptItem(row: any, flightNo: string) {
  const receivedPieces = Number(row.received_pieces ?? 0);
  const receivedWeight = Number(row.received_weight ?? 0);
  const status = row.receipt_status || '已收货';

  return {
    flightNo,
    awb: row.awb_no,
    receivedPieces,
    receivedWeight,
    status,
    reviewStatus: status,
    reviewedWeight: receivedWeight,
    receivedAt: row.updated_at || row.created_at || null,
    reviewedAt: row.updated_at || row.created_at || null,
    note: row.note || ''
  };
}

function mapMobileOutboundContainerItem(row: any, items: any[], flightNo: string) {
  return {
    containerId: row.container_id,
    boardCode: row.container_code,
    flightNo,
    entries: items.map((item: any) => ({
      awb: item.awb_no,
      pieces: Number(item.pieces ?? 0),
      boxes: Number(item.boxes ?? 0),
      weight: Number(item.weight ?? 0)
    })),
    totalBoxes: Number(row.total_boxes ?? 0),
    totalWeightKg: Number(row.total_weight ?? 0),
    reviewedWeightKg: Number(row.reviewed_weight ?? 0),
    status: row.container_status || '待装机',
    loadedAt: row.loaded_at || null,
    note: row.note || '',
    offloadBoxes: Number(row.offload_boxes ?? 0),
    offloadStatus: row.offload_status || ''
  };
}

function buildMobileOutboundTaskCards(roleView: any, flightNo: string) {
  const taskRoles = new Set(Array.isArray(roleView?.taskRoles) ? roleView.taskRoles : []);
  const templates = {
    overview: {
      title: '出港货站任务总览',
      node: '出港机场货站操作',
      role: 'Export Supervisor',
      status: '运行中',
      sla: '飞走前闭环',
      description: `统一展示航班 ${flightNo} 的收货、理货、组板、集装器和装机准备任务。`,
      evidence: ['FFM / UWS / Manifest', 'Origin POD', '主单信息'],
      blockers: ['Manifest 未冻结前不得飞走归档。'],
      actions: [{ label: '查看收货', variant: 'contained' }, { label: '上报异常' }]
    },
    receipt: {
      title: '出港收货任务',
      node: '出港机场货站操作',
      role: 'Export Receiver',
      status: '运行中',
      sla: '收货后 30 分钟',
      description: '按 AWB 录入收货件数并完成重量复核。',
      evidence: ['收货件数', '复核重量', 'Origin POD'],
      blockers: ['未完成收货不得进入组板和机坪放行。'],
      actions: [{ label: '收货', variant: 'contained' }, { label: '复核' }, { label: '异常' }]
    },
    container: {
      title: '组板与集装器任务',
      node: '出港机场货站操作',
      role: 'Build-up Worker',
      status: '运行中',
      sla: '装机前 45 分钟',
      description: '创建集装器、录入提单并准备机坪转运。',
      evidence: ['集装器号', '提单清单', '重量复核'],
      blockers: ['无集装器号或复核重量时不得进入装机。'],
      actions: [{ label: '新建集装器', variant: 'contained' }, { label: '追加提单' }]
    },
    loading: {
      title: '出港装机任务',
      node: '出港机场机坪操作',
      role: 'Ramp Loader',
      status: '待处理',
      sla: 'ETD 前 30 分钟',
      description: '在机坪完成转运、Loaded 确认和装机证据上传。',
      evidence: ['Loaded 照片', 'UWS 复核', '机坪签名'],
      blockers: ['无 UWS / Manifest 时不得标记已装载。'],
      actions: [{ label: '记录转运', variant: 'contained' }, { label: '确认 Loaded' }, { label: '上传证据' }]
    }
  };

  return Object.fromEntries(
    Object.entries(templates).map(([key, card]) => {
      const allowed = taskRoles.has(card.role);
      return [
        key,
        {
          ...card,
          blockers: allowed ? card.blockers : [...card.blockers, `当前角色 ${roleView?.label || ''} 仅可查看，不可执行 ${card.role} 任务。`],
          actions: allowed ? card.actions : []
        }
      ];
    })
  );
}

async function loadMobileOutboundDetail(services: StationServices, db: any, stationId: string, actor: any, flightNo: string) {
  const roleResponse = buildMobileSelectResponse(actor);
  const [outboundFlightsResult, waybillsResult, mobileTasksResult] = await Promise.all([
    services.listOutboundFlights(normalizeStationListQuery(actor, { station_id: stationId, flight_no: flightNo, page_size: '1' })),
    services.listOutboundWaybills(normalizeStationListQuery(actor, { station_id: stationId, flight_no: flightNo, page_size: '100' })),
    services.listMobileTasks(normalizeStationListQuery(actor, { station_id: stationId, flight_no: flightNo, page_size: '200' }))
  ]);

  const flight = (outboundFlightsResult?.items || []).find((item: any) => item.flight_no === flightNo);
  if (!flight) return null;

  const flightDetail = await services.getOutboundFlight(flight.flight_id);
  const flightWaybills = (waybillsResult?.items || []).filter((item: any) => item.flight_no === flightNo);
  const flightTasks = (mobileTasksResult?.items || []).filter((item: any) => item.flight_no === flightNo);
  const taskCards = buildMobileOutboundTaskCards(roleResponse.roleView, flightNo);

  const [receiptRows, containerRows] = db
    ? await Promise.all([
        db
          .prepare(
            `
              SELECT awb_no, received_pieces, received_weight, receipt_status, note, created_at, updated_at
              FROM outbound_receipts
              WHERE station_id = ?
                AND flight_no = ?
              ORDER BY awb_no ASC
            `
          )
          .bind(stationId, flightNo)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT container_id, container_code, total_boxes, total_weight, reviewed_weight, container_status, loaded_at, note
              FROM outbound_containers
              WHERE station_id = ?
                AND flight_no = ?
              ORDER BY container_code ASC
            `
          )
          .bind(stationId, flightNo)
          .all()
          .then((rows: any) => (rows?.results || []) as any[])
      ])
    : [[], []];

  const receipts = receiptRows.reduce((acc: Record<string, any>, row: any) => {
    acc[row.awb_no] = mapMobileOutboundReceiptItem(row, flightNo);
    return acc;
  }, {});

  const containers = await Promise.all(
    containerRows.map(async (row: any) => {
      const items = await db
        ?.prepare(
          `
            SELECT awb_no, pieces, boxes, weight
            FROM outbound_container_items
            WHERE container_id = ?
            ORDER BY awb_no ASC
          `
        )
        .bind(row.container_id)
        .all();

      return mapMobileOutboundContainerItem(row, items?.results || [], flightNo);
    })
  );

  const flightTasksByStatus = {
    queuedTasks: flightTasks.filter((item: any) => ['Created', 'Assigned', 'Accepted'].includes(item.task_status)).length,
    activeTasks: flightTasks.filter((item: any) => ['Started', 'Evidence Uploaded'].includes(item.task_status)).length,
    completedTasks: flightTasks.filter((item: any) => ['Completed', 'Verified', 'Closed'].includes(item.task_status)).length
  };

  const waybills = flightWaybills.map(mapMobileOutboundWaybillItem);
  const forecastAwbRows = waybills.map(mapMobileOutboundForecastAwbItem);
  const masterAwbRows = waybills.map(mapMobileOutboundMasterAwbItem);
  const summary = {
    totalFlights: 1,
    totalTasks: flightTasks.length,
    totalWaybills: waybills.length,
    totalReceipts: Object.keys(receipts).length,
    totalContainers: containers.length,
    loadedContainers: containers.filter((item: any) => item.status === '已装机').length,
    totalAwbCount: flightDetail?.kpis?.total_awb_count ?? waybills.length,
    totalPieces: flightDetail?.kpis?.total_pieces ?? waybills.reduce((sum: number, item: any) => sum + Number(item.pieces ?? 0), 0),
    totalWeight: flightDetail?.kpis?.total_weight ?? waybills.reduce((sum: number, item: any) => sum + Number(item.totalWeightKg ?? 0), 0),
    ...flightTasksByStatus
  };

  return {
    stationId,
    session: roleResponse.session,
    roleView: roleResponse.roleView,
    availableTabs: roleResponse.roleView.outboundTabs,
    availableActions: roleResponse.roleView.actionTypes,
    summary,
    forecastAwbRows,
    masterAwbRows,
    flight: {
      flightId: flightDetail?.flight?.flight_id || flight.flight_id,
      flight_id: flightDetail?.flight?.flight_id || flight.flight_id,
      flightNo: flight.flight_no,
      flight_no: flight.flight_no,
      source: flight.origin_code,
      etd: formatMobileClock(flightDetail?.flight?.etd || flight.etd),
      step: flight.summary?.stage || flight.runtime_status,
      stage: flight.summary?.stage || flight.runtime_status,
      priority: flight.service_level || 'P2',
      cargo: `${summary.totalAwbCount} AWB / ${summary.totalPieces} pcs / ${summary.totalWeight} kg`,
      status: flight.runtime_status,
      manifest: flight.summary?.manifest_status || '待处理',
      taskCount: flightTasks.length,
      tasks: flightTasks.map(mapMobileInboundTaskItem)
    },
    waybills,
    outboundFlights: [
      {
        flightId: flightDetail?.flight?.flight_id || flight.flight_id,
        flight_id: flightDetail?.flight?.flight_id || flight.flight_id,
        flightNo: flight.flight_no,
        flight_no: flight.flight_no,
        source: flight.origin_code,
        etd: formatMobileClock(flightDetail?.flight?.etd || flight.etd),
        step: flight.summary?.stage || flight.runtime_status,
        stage: flight.summary?.stage || flight.runtime_status,
        priority: flight.service_level || 'P2',
        cargo: `${summary.totalAwbCount} AWB / ${summary.totalPieces} pcs / ${summary.totalWeight} kg`,
        status: flight.runtime_status,
        manifest: flight.summary?.manifest_status || '待处理',
        taskCount: flightTasks.length,
        tasks: flightTasks.map(mapMobileInboundTaskItem)
      }
    ],
    receipts,
    receiptMap: receipts,
    containers,
    pmcBoards: containers,
    tasks: flightTasks.map(mapMobileInboundTaskItem),
    pageConfig: {
      tabs: roleResponse.roleView.outboundTabs,
      quickLinks: [
        { key: 'overview', label: '航班概览', path: `/mobile/outbound/${encodeURIComponent(flightNo)}` },
        { key: 'receipt', label: '出港收货', path: `/mobile/outbound/${encodeURIComponent(flightNo)}/receipt` },
        { key: 'container', label: '集装器', path: `/mobile/outbound/${encodeURIComponent(flightNo)}/pmc` },
        { key: 'loading', label: '装机', path: `/mobile/outbound/${encodeURIComponent(flightNo)}/loading` }
      ],
      taskCards
    }
  };
}

function mapMobileInboundWaybillItem(item: any) {
  const weight = Number(item.gross_weight ?? item.total_weight ?? 0);

  return {
    awb: item.awb_no,
    consignee: item.consignee_name || '',
    expectedBoxes: Number(item.pieces ?? 0),
    expectedBoxesKnown: true,
    totalWeightKg: weight,
    weight: `${weight} kg`,
    currentNode: item.current_node || '',
    noaStatus: item.noa_status || '',
    podStatus: item.pod_status || '',
    transferStatus: item.transfer_status || '',
    blocked: Boolean(item.blocked),
    blockerReason: item.blocker_reason || '',
    barcode: item.awb_no,
    pieces: Number(item.pieces ?? 0)
  };
}

function mapMobileInboundPalletItem(row: any, items: any[] = []) {
  return {
    palletId: row.pallet_id,
    palletNo: row.pallet_no,
    flightNo: row.flight_no,
    storageLocation: row.storage_location || '',
    totalBoxes: Number(row.total_boxes ?? 0),
    totalWeight: Number(row.total_weight ?? 0),
    status: row.pallet_status || '计划',
    note: row.note || '',
    loadedPlate: row.loaded_plate || '',
    loadedAt: row.loaded_at || '',
    items: items.map((item: any) => ({
      awb: item.awb_no,
      boxes: Number(item.boxes ?? 0),
      weight: Number(item.weight ?? 0)
    }))
  };
}

function mapMobileInboundLoadingPlanItem(row: any, items: any[] = []) {
  return {
    id: row.loading_plan_id,
    flightNo: row.flight_no,
    truckPlate: row.truck_plate,
    vehicleModel: row.vehicle_model || '',
    driverName: row.driver_name || '',
    collectionNote: row.collection_note || '',
    forkliftDriver: row.forklift_driver || '',
    checker: row.checker || '',
    arrivalTime: row.arrival_time || '',
    departTime: row.depart_time || '',
    totalBoxes: Number(row.total_boxes ?? 0),
    totalWeight: Number(row.total_weight ?? 0),
    status: row.plan_status || '计划',
    note: row.note || '',
    pallets: items.map((item: any) => item.pallet_no)
  };
}

function buildMobileInboundTaskCardTemplates(flightNo: string) {
  return {
    overview: {
      title: '进港任务总览',
      node: '进港机场货站操作',
      role: 'Inbound Supervisor',
      status: '运行中',
      sla: '落地后 12h',
      description: '当前航班的拆板、理货、组托、装车和 NOA/POD 全部按统一任务卡组织。',
      evidence: ['CBA / Manifest / Handling Plan', '任务状态回填', '关键节点时间戳'],
      blockers: ['关键文件不齐时，只允许展示任务，不允许放行。'],
      actions: [{ label: '查看任务池', variant: 'contained' }, { label: '上报异常' }]
    },
    counting: {
      title: '拆板与理货任务',
      node: '进港机场货站操作',
      role: 'Check Worker',
      status: '运行中',
      sla: '理货节点 30 分钟初判',
      description: `围绕航班 ${flightNo} 执行拆板和理货，扫码即加 1，并持续校验差异。`,
      evidence: ['提单 / 箱号扫码记录', '差异备注', '理货完成确认'],
      blockers: ['未完成理货不得发送 NOA。', '扫描到航班外提单时必须先确认是否纳入统计。'],
      actions: [{ label: '扫码 +1', variant: 'contained' }, { label: '挂起' }, { label: '上报异常' }]
    },
    pallet: {
      title: '组托任务',
      node: '进港机场货站操作',
      role: 'Pallet Builder',
      status: '运行中',
      sla: '理货完成后立即执行',
      description: `围绕航班 ${flightNo} 组托，保持同票同托，为后续装车准备标准托盘。`,
      evidence: ['托盘号', '箱数 / 重量', '托盘标签'],
      blockers: ['不同 consignee 不得混托。'],
      actions: [{ label: '新建托盘', variant: 'contained' }, { label: '打印标签' }]
    },
    loadingPlan: {
      title: '装车计划任务',
      node: '尾程卡车装车与运输',
      role: 'Loading Coordinator',
      status: '待处理',
      sla: '车辆到场后 15 分钟内启动',
      description: `为航班 ${flightNo} 录入车牌、司机、Collection Note 和复核信息，形成装车计划。`,
      evidence: ['车牌', '司机', 'Collection Note', '叉车司机 / 核对员'],
      blockers: ['未录入车牌、Collection Note、核对员时不得开始装车。'],
      actions: [{ label: '开始装车', variant: 'contained' }, { label: '挂起' }]
    },
    loadingExecution: {
      title: '装车执行任务',
      node: '尾程卡车装车与运输',
      role: 'Loading Worker',
      status: '装车中',
      sla: '装车完成后立即回填',
      description: `把托盘或提单装入车辆，持续校验车牌、托盘数量和完成条件。`,
      evidence: ['托盘绑定', '装车清单', '完成确认'],
      blockers: ['缺车牌 / Collection Note / 复核信息时不得完成装车。'],
      actions: [{ label: '录入托盘', variant: 'contained' }, { label: '完成装车', color: 'success' }]
    }
  };
}

function buildMobileInboundTaskCards(roleView: any, flightNo: string) {
  const taskRoles = Array.isArray(roleView?.taskRoles) ? roleView.taskRoles : [];
  const templates = buildMobileInboundTaskCardTemplates(flightNo);

  return Object.entries(templates).reduce((acc: Record<string, any>, [key, card]) => {
    const allowed = taskRoles.includes(card.role);
    acc[key] = {
      ...card,
      blockers: allowed ? card.blockers : [...card.blockers, `当前角色 ${roleView?.label || ''} 仅可查看，不可执行 ${card.role} 任务。`],
      actions: allowed ? card.actions : []
    };
    return acc;
  }, {});
}

async function loadMobileInboundDetail(services: StationServices, db: any, stationId: string, actor: any, flightNo: string) {
  const roleResponse = buildMobileSelectResponse(actor);
  const [inboundFlightsResult, waybillsResult, mobileTasksResult] = await Promise.all([
    services.listInboundFlights({ station_id: stationId, page_size: '100' }),
    services.listInboundWaybills({ station_id: stationId, page_size: '200' }),
    services.listMobileTasks({ station_id: stationId, page_size: '200' })
  ]);

  const flight = (inboundFlightsResult?.items || []).find((item: any) => item.flight_no === flightNo);

  if (!flight) {
    return null;
  }

  const flightWaybills = (waybillsResult?.items || []).filter((item: any) => item.flight_no === flightNo);
  const flightTasks = (mobileTasksResult?.items || []).filter((item: any) => item.flight_no === flightNo);
  const taskMap = await listInboundCountRecords(db, stationId, flightNo);

  const palletRows = await db
    ?.prepare(
      `
        SELECT pallet_id, pallet_no, flight_no, pallet_status, total_boxes, total_weight, storage_location, note
        FROM inbound_pallets
        WHERE station_id = ?
          AND flight_no = ?
        ORDER BY pallet_no ASC
      `
    )
    .bind(stationId, flightNo)
    .all();

  const pallets = await Promise.all(
    (palletRows?.results || []).map(async (row: any) => {
      const items = await db
        ?.prepare(
          `
            SELECT awb_no, boxes, weight
            FROM inbound_pallet_items
            WHERE pallet_id = ?
            ORDER BY awb_no ASC
          `
        )
        .bind(row.pallet_id)
        .all();

      return mapMobileInboundPalletItem(row, items?.results || []);
    })
  );

  const loadingPlanRows = await db
    ?.prepare(
      `
        SELECT loading_plan_id, flight_no, truck_plate, vehicle_model, driver_name, collection_note, forklift_driver, checker, arrival_time, depart_time, total_boxes, total_weight, plan_status, note
        FROM loading_plans
        WHERE station_id = ?
          AND flight_no = ?
        ORDER BY created_at ASC
      `
    )
    .bind(stationId, flightNo)
    .all();

  const loadingPlans = await Promise.all(
    (loadingPlanRows?.results || []).map(async (row: any) => {
      const items = await db
        ?.prepare(
          `
            SELECT pallet_no
            FROM loading_plan_items
            WHERE loading_plan_id = ?
            ORDER BY pallet_no ASC
          `
        )
        .bind(row.loading_plan_id)
        .all();

      return mapMobileInboundLoadingPlanItem(row, items?.results || []);
    })
  );

  const roleView = roleResponse.roleView;
  const taskCards = buildMobileInboundTaskCards(roleView, flightNo);
  const totalTasks = flightTasks.length;
  const queuedTasks = flightTasks.filter((item: any) => ['Created', 'Assigned', 'Accepted'].includes(item.task_status)).length;
  const activeTasks = flightTasks.filter((item: any) => ['Started', 'Evidence Uploaded'].includes(item.task_status)).length;
  const completedTasks = flightTasks.filter((item: any) => ['Completed', 'Verified', 'Closed'].includes(item.task_status)).length;
  const waybillSummary = flightWaybills.reduce(
    (acc: { totalPieces: number; totalWeight: number }, item: any) => {
      acc.totalPieces += Number(item.pieces ?? 0);
      acc.totalWeight += Number(item.gross_weight ?? item.totalWeightKg ?? 0);
      return acc;
    },
    { totalPieces: 0, totalWeight: 0 }
  );

  return {
    stationId,
    session: roleResponse.session,
    roleView,
    availableTabs: roleView.inboundTabs,
    availableActions: roleView.actionTypes,
    summary: {
      totalFlights: 1,
      totalTasks,
      queuedTasks,
      activeTasks,
      completedTasks
    },
    flight: {
      flightNo: flight.flight_no,
      source: flight.origin_code,
      eta: formatMobileClock(flight.eta || flight.actual_landed_at),
      etd: formatMobileClock((flight as any).etd || (flight as any).actual_departed_at),
      step: flight.summary?.current_step || flight.runtime_status,
      priority: flight.service_level || 'P2',
      cargo: `${flight.summary?.total_pieces ?? waybillSummary.totalPieces ?? 0} pcs / ${flight.summary?.total_weight ?? waybillSummary.totalWeight ?? 0} kg`,
      status: flight.runtime_status,
      taskCount: flight.summary?.open_task_count ?? totalTasks,
      blocked: Boolean(flight.summary?.blocked),
      blockerReason: flight.summary?.blocker_reason || ''
    },
    waybills: flightWaybills.map(mapMobileInboundWaybillItem),
    tasks: flightTasks,
    taskMap,
    pallets,
    loadingPlans,
    pageConfig: {
      tabs: roleView.inboundTabs,
      quickLinks: [
        { key: 'overview', label: '航班概览', path: `/mobile/inbound/${encodeURIComponent(flightNo)}` },
        { key: 'counting', label: '拆板理货', path: `/mobile/inbound/${encodeURIComponent(flightNo)}/breakdown` },
        { key: 'pallet', label: '组托', path: `/mobile/inbound/${encodeURIComponent(flightNo)}/pallet` },
        { key: 'loading', label: '装车', path: `/mobile/inbound/${encodeURIComponent(flightNo)}/loading` }
      ],
      taskCards
    }
  };
}

function buildMobileInboundOverviewResponse(actor: any, stationId: string, inboundFlightsResult: any, mobileTasksResult: any) {
  const roleResponse = buildMobileSelectResponse(actor);
  const inboundFlights = (inboundFlightsResult?.items || []).map(mapMobileInboundFlightItem);
  const mobileTasks = (mobileTasksResult?.items || []).map(mapMobileInboundTaskItem);
  const flightTasks = mobileTasks.filter((item: any) => item.flight_no);

  return {
    stationId,
    session: roleResponse.session,
    roleView: roleResponse.roleView,
    availableTabs: roleResponse.roleView.inboundTabs,
    availableActions: roleResponse.roleView.actionTypes,
    summary: {
      totalFlights: inboundFlights.length,
      totalTasks: flightTasks.length,
      queuedTasks: flightTasks.filter((item: any) => ['Created', 'Assigned', 'Accepted'].includes(item.task_status)).length,
      activeTasks: flightTasks.filter((item: any) => ['Started', 'Evidence Uploaded'].includes(item.task_status)).length,
      completedTasks: flightTasks.filter((item: any) => ['Completed', 'Verified', 'Closed'].includes(item.task_status)).length
    },
    inboundFlights,
    mobileTasks
  };
}

async function listInboundCountRecords(db: any, stationId: string, flightNo: string) {
  const rows = await db
    ?.prepare(
      `
        SELECT awb_no, counted_boxes, status, scanned_serials_json, note, updated_at
        FROM inbound_count_records
        WHERE station_id = ?
          AND flight_no = ?
        ORDER BY awb_no ASC
      `
    )
    .bind(stationId, flightNo)
    .all();

  return (rows?.results || []).reduce((acc: Record<string, any>, row: any) => {
    acc[row.awb_no] = {
      countedBoxes: Number(row.counted_boxes ?? 0),
      status: row.status,
      scannedSerials: parseJsonField(row.scanned_serials_json, []),
      note: row.note || '',
      updatedAt: row.updated_at || null
    };
    return acc;
  }, {});
}

export function registerMobileRoutes(app: ApiApp, getStationServices: (c: any) => StationServices, requireRoles: RequireRoles) {
  app.get('/api/v1/mobile/login', async (c) => {
    return c.json({
      data: {
        station_options: mobileLoginStationOptions,
        role_options: mobileLoginRoleOptions,
        defaults: {
          station: mobileLoginStationOptions[0]?.value || '',
          role_key: mobileLoginRoleOptions[0]?.value || ''
        }
      }
    });
  });

  app.post('/api/v1/mobile/login', async (c) => {
    try {
      const body = await c.req.json();
      const stationCode = body.stationCode || body.station_code || 'MME';
      const roleKey = body.roleKey || body.role_key || 'receiver';
      const roleIds = mapMobileRoleKeyToRoleCodes(roleKey);
      const secret = c.env.AUTH_TOKEN_SECRET || 'sinoport-local-dev-secret';
      const requestedUserId = body.employeeId ? `mobile-${body.employeeId}` : body.userId || body.user_id;
      const userId = await resolveMobileUserId(c, requestedUserId);

      const token = await signAuthToken(
        {
          user_id: userId,
          role_ids: roleIds,
          station_scope: [stationCode],
          tenant_id: 'sinoport-demo',
          client_source: 'mobile-pda'
        },
        secret
      );

      return c.json({
        data: {
          token,
          actor: {
            user_id: userId,
            role_ids: roleIds,
            station_scope: [stationCode],
            tenant_id: 'sinoport-demo',
            client_source: 'mobile-pda'
          }
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/login');
    }
  });

  app.get(
    '/api/v1/mobile/select',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const requestedRoleKey = c.req.query('role_key') || c.req.query('roleKey') || undefined;
        return c.json({
          data: buildMobileSelectResponse(c.var.actor, requestedRoleKey)
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /mobile/select');
      }
    }
  );

  app.get(
    '/api/v1/mobile/inbound',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
        const [inboundFlightsResult, mobileTasksResult] = await Promise.all([
          services.listInboundFlights({ station_id: stationId, page_size: '100' }),
          services.listMobileTasks({ station_id: stationId, page_size: '100' })
        ]);

        return c.json({
          data: buildMobileInboundOverviewResponse(c.var.actor, stationId, inboundFlightsResult, mobileTasksResult)
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
          return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
        }
        return handleServiceError(c, error, 'GET /mobile/inbound');
      }
    }
  );

  app.get(
    '/api/v1/mobile/outbound',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
        const [outboundFlightsResult, mobileTasksResult] = await Promise.all([
          services.listOutboundFlights(normalizeStationListQuery(c.var.actor, { ...c.req.query(), station_id: stationId, page_size: '100' })),
          services.listMobileTasks(normalizeStationListQuery(c.var.actor, { ...c.req.query(), station_id: stationId, page_size: '200' }))
        ]);

        return c.json({
          data: buildMobileOutboundOverviewResponse(c.var.actor, stationId, outboundFlightsResult, mobileTasksResult)
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
          return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
        }
        return handleServiceError(c, error, 'GET /mobile/outbound');
      }
    }
  );

  app.get(
    '/api/v1/mobile/node/:flowKey',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
        const response = buildMobileNodeFlowResponse(c.var.actor, stationId, c.req.param('flowKey'));

        if (!response) {
          return jsonError(c, 404, 'NODE_FLOW_NOT_FOUND', 'Mobile node flow does not exist', {
            flow_key: c.req.param('flowKey')
          });
        }

        return c.json({ data: response });
      } catch (error) {
        if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
          return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
        }
        return handleServiceError(c, error, 'GET /mobile/node/:flowKey');
      }
    }
  );

  app.get(
    '/api/v1/mobile/node/:flowKey/:itemId',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
        const response = buildMobileNodeFlowResponse(c.var.actor, stationId, c.req.param('flowKey'), c.req.param('itemId'));

        if (!response) {
          return jsonError(c, 404, 'NODE_NOT_FOUND', 'Mobile node item does not exist', {
            flow_key: c.req.param('flowKey'),
            item_id: c.req.param('itemId')
          });
        }

        return c.json({ data: response });
      } catch (error) {
        if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
          return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
        }
        return handleServiceError(c, error, 'GET /mobile/node/:flowKey/:itemId');
      }
    }
  );

  app.get(
    '/api/v1/mobile/inbound/:flightNo',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
        const detail = await loadMobileInboundDetail(services, c.env.DB, stationId, c.var.actor, c.req.param('flightNo'));

        if (!detail) {
          return jsonError(c, 404, 'FLIGHT_NOT_FOUND', 'Inbound flight does not exist', {
            flight_no: c.req.param('flightNo')
          });
        }

        return c.json({ data: detail });
      } catch (error) {
        if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
          return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
        }
        return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo');
      }
    }
  );

  app.get('/api/v1/mobile/tasks', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const result = await services.listMobileTasks(normalizeStationListQuery(c.var.actor, c.req.query()));
      return c.json(result);
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/tasks');
    }
  });

  app.get(
    '/api/v1/mobile/state/:scopeKey',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
        const scopeKey = c.req.param('scopeKey');
        const row = (await c.env.DB?.prepare(
          `
            SELECT station_id, scope_key, state_json, updated_at
            FROM mobile_state_store
            WHERE station_id = ?
              AND scope_key = ?
            LIMIT 1
          `
        )
          .bind(stationId, scopeKey)
          .first()) as { station_id: string; scope_key: string; state_json: string; updated_at: string } | null;

        return c.json({
          data: {
            station_id: stationId,
            scope_key: scopeKey,
            state: row ? JSON.parse(row.state_json) : null,
            updated_at: row?.updated_at || null
          }
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
          return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
        }
        return handleServiceError(c, error, 'GET /mobile/state/:scopeKey');
      }
    }
  );

  app.post(
    '/api/v1/mobile/state/:scopeKey',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
        const scopeKey = c.req.param('scopeKey');
        const body = await c.req.json();

        if (typeof body?.state === 'undefined') {
          return jsonError(c, 400, 'VALIDATION_ERROR', 'state is required');
        }

        await c.env.DB?.prepare(
          `
            INSERT INTO mobile_state_store (
              station_id,
              scope_key,
              state_json,
              updated_by,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(station_id, scope_key) DO UPDATE SET
              state_json = excluded.state_json,
              updated_by = excluded.updated_by,
              updated_at = excluded.updated_at
          `
        )
          .bind(
            stationId,
            scopeKey,
            JSON.stringify(body.state),
            c.var.actor.userId,
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();

        return c.json({
          data: {
            station_id: stationId,
            scope_key: scopeKey,
            state: body.state
          }
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
          return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
        }
        return handleServiceError(c, error, 'POST /mobile/state/:scopeKey');
      }
    }
  );

  app.get('/api/v1/mobile/inbound/:flightNo/counts', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const data = await listInboundCountRecords(c.env.DB, stationId, c.req.param('flightNo'));
      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), records: data } });
    } catch (error) {
      if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
        return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
      }
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/counts');
    }
  });

  app.post('/api/v1/mobile/inbound/:flightNo/counts/:awbNo', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const countRecordId = `CNT-${c.req.param('flightNo')}-${c.req.param('awbNo')}`.replace(/[^A-Za-z0-9-]/g, '');
      const now = isoNow();

      await c.env.DB?.prepare(
        `
          INSERT INTO inbound_count_records (
            count_record_id,
            station_id,
            flight_no,
            awb_no,
            counted_boxes,
            status,
            scanned_serials_json,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, awb_no) DO UPDATE SET
            counted_boxes = excluded.counted_boxes,
            status = excluded.status,
            scanned_serials_json = excluded.scanned_serials_json,
            note = excluded.note,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
        .bind(
          countRecordId,
          stationId,
          c.req.param('flightNo'),
          c.req.param('awbNo'),
          body.counted_boxes ?? body.countedBoxes ?? 0,
          body.status || '未开始',
          JSON.stringify(body.scanned_serials ?? body.scannedSerials ?? []),
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      return c.json({
        data: {
          flight_no: c.req.param('flightNo'),
          awb_no: c.req.param('awbNo'),
          counted_boxes: body.counted_boxes ?? body.countedBoxes ?? 0,
          status: body.status || '未开始'
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/inbound/:flightNo/counts/:awbNo');
    }
  });

  app.get('/api/v1/mobile/inbound/:flightNo/pallets', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const rows = await c.env.DB?.prepare(
        `
          SELECT pallet_id, pallet_no, pallet_status, total_boxes, total_weight, storage_location, note
          FROM inbound_pallets
          WHERE station_id = ?
            AND flight_no = ?
          ORDER BY pallet_no ASC
        `
      )
        .bind(stationId, c.req.param('flightNo'))
        .all();

      const pallets = await Promise.all(
        (rows?.results || []).map(async (row: any) => {
          const items = await c.env.DB?.prepare(
            `
              SELECT awb_no, boxes, weight
              FROM inbound_pallet_items
              WHERE pallet_id = ?
              ORDER BY awb_no ASC
            `
          )
            .bind(row.pallet_id)
            .all();

          return {
            palletId: row.pallet_id,
            palletNo: row.pallet_no,
            status: row.pallet_status,
            totalBoxes: Number(row.total_boxes ?? 0),
            totalWeight: Number(row.total_weight ?? 0),
            storageLocation: row.storage_location,
            note: row.note || '',
            items: (items?.results || []).map((item: any) => ({
              awb: item.awb_no,
              boxes: Number(item.boxes ?? 0),
              weight: Number(item.weight ?? 0)
            }))
          };
        })
      );

      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), pallets } });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/pallets');
    }
  });

  app.post('/api/v1/mobile/inbound/:flightNo/pallets', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const existing = await c.env.DB?.prepare(
        `
          SELECT pallet_id
          FROM inbound_pallets
          WHERE station_id = ?
            AND flight_no = ?
            AND pallet_no = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('flightNo'), body.pallet_no || body.palletNo)
        .first<{ pallet_id: string }>();
      const palletId = existing?.pallet_id || body.pallet_id || createId('PLT');
      const items = Array.isArray(body.items) ? body.items : [];
      const now = isoNow();

      await c.env.DB?.prepare(
        `
          INSERT INTO inbound_pallets (
            pallet_id,
            station_id,
            flight_no,
            pallet_no,
            pallet_status,
            total_boxes,
            total_weight,
            storage_location,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, pallet_no) DO UPDATE SET
            pallet_status = excluded.pallet_status,
            total_boxes = excluded.total_boxes,
            total_weight = excluded.total_weight,
            storage_location = excluded.storage_location,
            note = excluded.note,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
        .bind(
          palletId,
          stationId,
          c.req.param('flightNo'),
          body.pallet_no || body.palletNo,
          body.status || body.pallet_status || '计划',
          body.total_boxes ?? body.totalBoxes ?? 0,
          body.total_weight ?? body.totalWeight ?? 0,
          body.storage_location || body.storageLocation || null,
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      await c.env.DB?.prepare(`DELETE FROM inbound_pallet_items WHERE pallet_id = ?`).bind(palletId).run();
      for (const item of items) {
        await c.env.DB?.prepare(
          `
            INSERT INTO inbound_pallet_items (
              pallet_item_id,
              pallet_id,
              awb_no,
              boxes,
              weight,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        )
          .bind(createId('PLI'), palletId, item.awb || item.awb_no, item.boxes ?? 0, item.weight ?? 0, now, now)
          .run();
      }

      return c.json({ data: { pallet_id: palletId } }, 201);
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/inbound/:flightNo/pallets');
    }
  });

  app.patch('/api/v1/mobile/inbound/pallets/:palletNo', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const row = await c.env.DB?.prepare(
        `
          SELECT pallet_id
          FROM inbound_pallets
          WHERE station_id = ?
            AND pallet_no = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('palletNo'))
        .first<{ pallet_id: string }>();

      if (!row) {
        return jsonError(c, 404, 'PALLET_NOT_FOUND', 'Pallet does not exist');
      }

      await c.env.DB?.prepare(
        `
          UPDATE inbound_pallets
          SET pallet_status = COALESCE(?, pallet_status),
              total_boxes = COALESCE(?, total_boxes),
              total_weight = COALESCE(?, total_weight),
              storage_location = COALESCE(?, storage_location),
              note = COALESCE(?, note),
              updated_by = ?,
              updated_at = ?
          WHERE pallet_id = ?
        `
      )
        .bind(
          body.status ?? null,
          body.total_boxes ?? body.totalBoxes ?? null,
          body.total_weight ?? body.totalWeight ?? null,
          body.storage_location ?? body.storageLocation ?? null,
          body.note ?? null,
          c.var.actor.userId,
          isoNow(),
          row.pallet_id
        )
        .run();

      return c.json({ data: { pallet_no: c.req.param('palletNo'), ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/inbound/pallets/:palletNo');
    }
  });

  app.get('/api/v1/mobile/inbound/:flightNo/loading-plans', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const rows = await c.env.DB?.prepare(
        `
          SELECT loading_plan_id, truck_plate, vehicle_model, driver_name, collection_note, forklift_driver, checker, arrival_time, depart_time, total_boxes, total_weight, plan_status, note
          FROM loading_plans
          WHERE station_id = ?
            AND flight_no = ?
          ORDER BY created_at ASC
        `
      )
        .bind(stationId, c.req.param('flightNo'))
        .all();

      const plans = await Promise.all(
        (rows?.results || []).map(async (row: any) => {
          const items = await c.env.DB?.prepare(
            `
              SELECT pallet_no
              FROM loading_plan_items
              WHERE loading_plan_id = ?
              ORDER BY pallet_no ASC
            `
          )
            .bind(row.loading_plan_id)
            .all();
          return {
            id: row.loading_plan_id,
            truckPlate: row.truck_plate,
            vehicleModel: row.vehicle_model,
            driverName: row.driver_name,
            collectionNote: row.collection_note,
            forkliftDriver: row.forklift_driver,
            checker: row.checker,
            arrivalTime: row.arrival_time,
            departTime: row.depart_time,
            totalBoxes: Number(row.total_boxes ?? 0),
            totalWeight: Number(row.total_weight ?? 0),
            status: row.plan_status,
            note: row.note || '',
            pallets: (items?.results || []).map((item: any) => item.pallet_no)
          };
        })
      );

      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), plans } });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/loading-plans');
    }
  });

  app.post('/api/v1/mobile/inbound/:flightNo/loading-plans', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const planId = body.loading_plan_id || body.id || createId('LOD');
      const now = isoNow();
      const pallets = Array.isArray(body.pallets) ? body.pallets : [];

      await c.env.DB?.prepare(
        `
          INSERT INTO loading_plans (
            loading_plan_id,
            station_id,
            flight_no,
            truck_plate,
            vehicle_model,
            driver_name,
            collection_note,
            forklift_driver,
            checker,
            arrival_time,
            depart_time,
            total_boxes,
            total_weight,
            plan_status,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
        .bind(
          planId,
          stationId,
          c.req.param('flightNo'),
          body.truck_plate || body.truckPlate,
          body.vehicle_model || body.vehicleModel || null,
          body.driver_name || body.driverName || null,
          body.collection_note || body.collectionNote || null,
          body.forklift_driver || body.forkliftDriver || null,
          body.checker || null,
          body.arrival_time || body.arrivalTime || null,
          body.depart_time || body.departTime || null,
          body.total_boxes ?? body.totalBoxes ?? 0,
          body.total_weight ?? body.totalWeight ?? 0,
          body.status || body.plan_status || '计划',
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      await c.env.DB?.prepare(`DELETE FROM loading_plan_items WHERE loading_plan_id = ?`).bind(planId).run();
      for (const palletNo of pallets) {
        await c.env.DB?.prepare(
          `
            INSERT INTO loading_plan_items (
              loading_plan_item_id,
              loading_plan_id,
              pallet_no,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?)
          `
        )
          .bind(createId('LPI'), planId, palletNo, now, now)
          .run();
      }

      return c.json({ data: { loading_plan_id: planId } }, 201);
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/inbound/:flightNo/loading-plans');
    }
  });

  app.patch('/api/v1/mobile/inbound/loading-plans/:planId', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const body = await c.req.json();
      await c.env.DB?.prepare(
        `
          UPDATE loading_plans
          SET truck_plate = COALESCE(?, truck_plate),
              vehicle_model = COALESCE(?, vehicle_model),
              driver_name = COALESCE(?, driver_name),
              collection_note = COALESCE(?, collection_note),
              forklift_driver = COALESCE(?, forklift_driver),
              checker = COALESCE(?, checker),
              arrival_time = COALESCE(?, arrival_time),
              depart_time = COALESCE(?, depart_time),
              total_boxes = COALESCE(?, total_boxes),
              total_weight = COALESCE(?, total_weight),
              plan_status = COALESCE(?, plan_status),
              note = COALESCE(?, note),
              updated_by = ?,
              updated_at = ?
          WHERE loading_plan_id = ?
        `
      )
        .bind(
          body.truck_plate ?? body.truckPlate ?? null,
          body.vehicle_model ?? body.vehicleModel ?? null,
          body.driver_name ?? body.driverName ?? null,
          body.collection_note ?? body.collectionNote ?? null,
          body.forklift_driver ?? body.forkliftDriver ?? null,
          body.checker ?? null,
          body.arrival_time ?? body.arrivalTime ?? null,
          body.depart_time ?? body.departTime ?? null,
          body.total_boxes ?? body.totalBoxes ?? null,
          body.total_weight ?? body.totalWeight ?? null,
          body.status ?? body.plan_status ?? null,
          body.note ?? null,
          c.var.actor.userId,
          isoNow(),
          c.req.param('planId')
        )
        .run();

      return c.json({ data: { loading_plan_id: c.req.param('planId'), ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/inbound/loading-plans/:planId');
    }
  });

  app.get(
    '/api/v1/mobile/outbound/:flightNo',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const services = getStationServices(c);
        const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
        const detail = await loadMobileOutboundDetail(services, c.env.DB, stationId, c.var.actor, c.req.param('flightNo'));

        if (!detail) {
          return jsonError(c, 404, 'FLIGHT_NOT_FOUND', 'Outbound flight does not exist', {
            flight_no: c.req.param('flightNo')
          });
        }

        return c.json({ data: detail });
      } catch (error) {
        if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
          return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
        }
        return handleServiceError(c, error, 'GET /mobile/outbound/:flightNo');
      }
    }
  );

  app.get('/api/v1/mobile/outbound/:flightNo/receipts', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const rows = await c.env.DB?.prepare(
        `
          SELECT awb_no, received_pieces, received_weight, receipt_status, note
          FROM outbound_receipts
          WHERE station_id = ?
            AND flight_no = ?
          ORDER BY awb_no ASC
        `
      )
        .bind(stationId, c.req.param('flightNo'))
        .all();

      const receipts = (rows?.results || []).reduce((acc: Record<string, any>, row: any) => {
        acc[row.awb_no] = {
          receivedPieces: Number(row.received_pieces ?? 0),
          receivedWeight: Number(row.received_weight ?? 0),
          status: row.receipt_status,
          note: row.note || ''
        };
        return acc;
      }, {});

      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), receipts } });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/outbound/:flightNo/receipts');
    }
  });

  app.post('/api/v1/mobile/outbound/:flightNo/receipts/:awbNo', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const now = isoNow();

      await c.env.DB?.prepare(
        `
          INSERT INTO outbound_receipts (
            receipt_record_id,
            station_id,
            flight_no,
            awb_no,
            received_pieces,
            received_weight,
            receipt_status,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, awb_no) DO UPDATE SET
            received_pieces = excluded.received_pieces,
            received_weight = excluded.received_weight,
            receipt_status = excluded.receipt_status,
            note = excluded.note,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
        .bind(
          `REC-${c.req.param('flightNo')}-${c.req.param('awbNo')}`.replace(/[^A-Za-z0-9-]/g, ''),
          stationId,
          c.req.param('flightNo'),
          c.req.param('awbNo'),
          body.received_pieces ?? body.receivedPieces ?? 0,
          body.received_weight ?? body.receivedWeight ?? 0,
          body.status || body.receipt_status || '已收货',
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      return c.json({ data: { awb_no: c.req.param('awbNo'), ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/outbound/:flightNo/receipts/:awbNo');
    }
  });

  app.get('/api/v1/mobile/outbound/:flightNo/containers', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const rows = await c.env.DB?.prepare(
        `
          SELECT container_id, container_code, total_boxes, total_weight, reviewed_weight, container_status, loaded_at, note
          FROM outbound_containers
          WHERE station_id = ?
            AND flight_no = ?
          ORDER BY container_code ASC
        `
      )
        .bind(stationId, c.req.param('flightNo'))
        .all();

      const containers = await Promise.all(
        (rows?.results || []).map(async (row: any) => {
          const items = await c.env.DB?.prepare(
            `
              SELECT awb_no, pieces, boxes, weight
              FROM outbound_container_items
              WHERE container_id = ?
              ORDER BY awb_no ASC
            `
          )
            .bind(row.container_id)
            .all();

          return {
            containerId: row.container_id,
            boardCode: row.container_code,
            totalBoxes: Number(row.total_boxes ?? 0),
            totalWeightKg: Number(row.total_weight ?? 0),
            reviewedWeightKg: Number(row.reviewed_weight ?? 0),
            status: row.container_status,
            loadedAt: row.loaded_at || null,
            note: row.note || '',
            entries: (items?.results || []).map((item: any) => ({
              awb: item.awb_no,
              pieces: Number(item.pieces ?? 0),
              boxes: Number(item.boxes ?? 0),
              weight: Number(item.weight ?? 0)
            }))
          };
        })
      );

      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), containers } });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/outbound/:flightNo/containers');
    }
  });

  app.post('/api/v1/mobile/outbound/:flightNo/containers', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const existing = await c.env.DB?.prepare(
        `
          SELECT container_id
          FROM outbound_containers
          WHERE station_id = ?
            AND flight_no = ?
            AND container_code = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('flightNo'), body.container_code || body.boardCode)
        .first<{ container_id: string }>();
      const containerId = existing?.container_id || body.container_id || createId('ULD');
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const now = isoNow();

      await c.env.DB?.prepare(
        `
          INSERT INTO outbound_containers (
            container_id,
            station_id,
            flight_no,
            container_code,
            total_boxes,
            total_weight,
            reviewed_weight,
            container_status,
            loaded_at,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, container_code) DO UPDATE SET
            total_boxes = excluded.total_boxes,
            total_weight = excluded.total_weight,
            reviewed_weight = excluded.reviewed_weight,
            container_status = excluded.container_status,
            loaded_at = excluded.loaded_at,
            note = excluded.note,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
        .bind(
          containerId,
          stationId,
          c.req.param('flightNo'),
          body.container_code || body.boardCode,
          body.total_boxes ?? body.totalBoxes ?? 0,
          body.total_weight ?? body.totalWeightKg ?? 0,
          body.reviewed_weight ?? body.reviewedWeightKg ?? 0,
          body.status || body.container_status || '待装机',
          body.loaded_at || body.loadedAt || null,
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      await c.env.DB?.prepare(`DELETE FROM outbound_container_items WHERE container_id = ?`).bind(containerId).run();
      for (const entry of entries) {
        await c.env.DB?.prepare(
          `
            INSERT INTO outbound_container_items (
              container_item_id,
              container_id,
              awb_no,
              pieces,
              boxes,
              weight,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
          .bind(createId('ULI'), containerId, entry.awb || entry.awb_no, entry.pieces ?? 0, entry.boxes ?? 0, entry.weight ?? 0, now, now)
          .run();
      }

      return c.json({ data: { container_id: containerId } }, 201);
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/outbound/:flightNo/containers');
    }
  });

  app.patch('/api/v1/mobile/outbound/containers/:containerCode', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      await c.env.DB?.prepare(
        `
          UPDATE outbound_containers
          SET total_boxes = COALESCE(?, total_boxes),
              total_weight = COALESCE(?, total_weight),
              reviewed_weight = COALESCE(?, reviewed_weight),
              container_status = COALESCE(?, container_status),
              loaded_at = COALESCE(?, loaded_at),
              note = COALESCE(?, note),
              updated_by = ?,
              updated_at = ?
          WHERE station_id = ?
            AND container_code = ?
        `
      )
        .bind(
          body.total_boxes ?? body.totalBoxes ?? null,
          body.total_weight ?? body.totalWeightKg ?? null,
          body.reviewed_weight ?? body.reviewedWeightKg ?? null,
          body.status ?? body.container_status ?? null,
          body.loaded_at ?? body.loadedAt ?? null,
          body.note ?? null,
          c.var.actor.userId,
          isoNow(),
          stationId,
          c.req.param('containerCode')
        )
        .run();

      return c.json({ data: { container_code: c.req.param('containerCode'), ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/outbound/containers/:containerCode');
    }
  });

  app.post('/api/v1/mobile/tasks/:taskId/accept', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json();
      const result = await services.acceptMobileTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/tasks/:taskId/accept');
    }
  });

  app.post('/api/v1/mobile/tasks/:taskId/start', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json();
      const result = await services.startMobileTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/tasks/:taskId/start');
    }
  });

  app.post('/api/v1/mobile/tasks/:taskId/evidence', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json();
      const result = await services.uploadMobileTaskEvidence(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/tasks/:taskId/evidence');
    }
  });

  app.post('/api/v1/mobile/tasks/:taskId/complete', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json();
      const result = await services.completeMobileTask(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/tasks/:taskId/complete');
    }
  });

  app.post('/api/v1/mobile/tasks/:taskId/exception', requireRoles(['mobile_operator', 'station_supervisor']), async (c) => {
    try {
      const services = getStationServices(c);
      const input = await c.req.json();
      const result = await services.raiseTaskException(c.req.param('taskId'), input);
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/tasks/:taskId/exception');
    }
  });
}
