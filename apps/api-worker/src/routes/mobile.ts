import type { MiddlewareHandler } from 'hono';
import type { RoleCode } from '@sinoport/contracts';
import type { StationServices } from '@sinoport/domain';
import { allowLocalOnlyAuth, mapMobileRoleKeyToRoleCodes, resolveAuthTokenSecret, signAuthToken, verifyPasswordHash } from '@sinoport/auth';
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

type MobileUnifiedOptionItem = {
  value: string;
  label: string;
  disabled: boolean;
  meta?: Record<string, unknown>;
};

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

function buildMobileNodeFlowResponse(
  actor: any,
  stationId: string,
  flowKey: string,
  options: {
    itemId?: string;
    pageRaw?: string | null;
    pageSizeRaw?: string | null;
    keyword?: string | null;
    status?: string | null;
  } = {}
) {
  const roleResponse = buildMobileSelectResponse(actor);
  const resolvedFlowKey = resolveMobileNodeFlowKey(flowKey);

  if (!resolvedFlowKey) {
    return null;
  }

  const catalog = mobileNodeCatalog[resolvedFlowKey];
  const flowDetails = catalog.details as Record<string, any>;
  const flowAllowed = isMobileNodeFlowAllowed(roleResponse.roleView, flowKey);
  const allItems = catalog.list
    .map((item: any) => {
      const detail = flowDetails[item.id];
      const allowed = detail ? flowAllowed || isMobileNodeRoleAllowed(roleResponse.roleView, detail.role) : flowAllowed;
      return {
        ...item,
        allowed
      };
    })
    .filter((item: any) => item.allowed);
  const statusOptions = Array.from(new Set(allItems.map((item: any) => String(item.status || '').trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
    .map((status) => ({
      value: status,
      label: status,
      disabled: false
    }));
  const normalizedKeyword = String(options.keyword || '').trim().toLowerCase();
  const normalizedStatus = String(options.status || '').trim();
  const filteredItems = allItems.filter((item: any) => {
    const matchesKeyword =
      !normalizedKeyword ||
      [item.id, item.title, item.subtitle].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword));
    const matchesStatus = !normalizedStatus || String(item.status || '').trim() === normalizedStatus;
    return matchesKeyword && matchesStatus;
  });
  const { page, pageSize, offset } = parsePageParams(options.pageRaw, options.pageSizeRaw);
  const items = filteredItems.slice(offset, offset + pageSize);
  const detail = options.itemId ? flowDetails[options.itemId] || null : null;

  if (options.itemId && !detail) {
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
    page,
    page_size: pageSize,
    total: filteredItems.length,
    statusOptions,
    filters: {
      keyword: normalizedKeyword ? String(options.keyword || '').trim() : '',
      status: normalizedStatus
    },
    detail: detail
      ? {
          ...detail,
          allowed: detailAllowed,
          taskCard
        }
      : null,
    taskCard,
    nodeOptions: allItems,
    mobileNodeLoading: false
  };
}

function isoNow() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeBooleanFlag(value: unknown) {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  return null;
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
  const stationScope = Array.isArray(actor?.stationScope) ? actor.stationScope : [];
  const stationId = requestedStationId || stationScope[0] || 'MME';

  if (!stationScope.includes(stationId)) {
    throw new Error('STATION_SCOPE_DENIED');
  }

  return stationId;
}

function parsePageParams(pageRaw?: string | null, pageSizeRaw?: string | null) {
  const page = Math.max(1, Number.parseInt(String(pageRaw || '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(pageSizeRaw || '20'), 10) || 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

async function writeMobileAudit(db: any, actor: any, params: {
  requestId?: string;
  action: string;
  objectType: string;
  objectId: string;
  stationId: string;
  summary: string;
  payload?: Record<string, unknown>;
}) {
  if (!db || !actor?.userId) return null;
  const auditId = createId('AUD');
  await db
    .prepare(
      `
        INSERT INTO audit_events (
          audit_id,
          request_id,
          actor_id,
          actor_role,
          client_source,
          action,
          object_type,
          object_id,
          station_id,
          summary,
          payload_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      auditId,
      params.requestId || null,
      actor.userId,
      actor.roleIds?.[0] || 'mobile_operator',
      actor.clientSource || 'mobile-pda',
      params.action,
      params.objectType,
      params.objectId,
      params.stationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      isoNow()
    )
    .run();
  return auditId;
}

async function writeMobileTransition(db: any, actor: any, params: {
  stationId: string;
  objectType: string;
  objectId: string;
  stateField: string;
  fromValue: string | null;
  toValue: string;
  auditId?: string | null;
  reason?: string | null;
}) {
  if (!db) return;
  await db
    .prepare(
      `
        INSERT INTO state_transitions (
          transition_id,
          station_id,
          object_type,
          object_id,
          state_field,
          from_value,
          to_value,
          triggered_by,
          triggered_at,
          reason,
          audit_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      createId('TRN'),
      params.stationId,
      params.objectType,
      params.objectId,
      params.stateField,
      params.fromValue,
      params.toValue,
      actor?.userId || 'mobile-pda',
      isoNow(),
      params.reason || null,
      params.auditId || null
    )
    .run();
}

async function loadOptionRows(db: any, tableName: string) {
  if (!db) return [];

  const rows = await db
    .prepare(
      `SELECT option_value, option_label, disabled, meta_json
       FROM ${tableName}
       ORDER BY sort_order ASC, option_value ASC`
    )
    .all()
    .catch(() => ({ results: [] }));

  return (rows?.results || []).map((row: any) => ({
    value: row.option_value,
    label: row.option_label,
    disabled: Boolean(row.disabled),
    meta: parseJsonField(row.meta_json, {})
  }));
}

async function loadInboundWaybillOptions(db: any, stationId: string, flightNo: string) {
  if (!db) return [];

  const rows = await db
    .prepare(
      `
        SELECT awb_id, awb_no, consignee_name, pieces, gross_weight
        FROM awbs
        WHERE station_id = ?
          AND flight_no = ?
          AND deleted_at IS NULL
        ORDER BY awb_no ASC
      `
    )
    .bind(stationId, flightNo)
    .all()
    .catch(() => ({ results: [] }));

  return (rows?.results || []).map((row: any) => ({
    value: row.awb_no,
    label: `${row.awb_no} · ${row.consignee_name || '--'}`,
    disabled: false,
    meta: {
      awb_id: row.awb_id,
      awb_no: row.awb_no,
      consignee_name: row.consignee_name || '',
      pieces: Number(row.pieces ?? 0),
      gross_weight: Number(row.gross_weight ?? 0)
    }
  }));
}

async function loadInboundPalletOptions(db: any, stationId: string, flightNo: string) {
  if (!db) return [];

  const rows = await db
    .prepare(
      `
        SELECT pallet_id, pallet_no, pallet_status, total_boxes, total_weight, loaded_plate
        FROM inbound_pallets
        WHERE station_id = ?
          AND flight_no = ?
          AND deleted_at IS NULL
        ORDER BY pallet_no ASC
      `
    )
    .bind(stationId, flightNo)
    .all()
    .catch(() => ({ results: [] }));

  return (rows?.results || []).map((row: any) => ({
    value: row.pallet_no,
    label: `${row.pallet_no} · ${Number(row.total_boxes ?? 0)} 箱 / ${Number(row.total_weight ?? 0)} kg`,
    disabled: row.pallet_status === '已作废',
    meta: {
      pallet_id: row.pallet_id,
      pallet_no: row.pallet_no,
      pallet_status: row.pallet_status,
      total_boxes: Number(row.total_boxes ?? 0),
      total_weight: Number(row.total_weight ?? 0),
      loaded_plate: row.loaded_plate || ''
    }
  }));
}

async function loadInboundTruckOptions(db: any, stationId: string) {
  if (!db) return [];

  const rows = await db
    .prepare(
      `
        SELECT truck_id, plate_no, driver_name, status, truck_type
        FROM trucks
        WHERE station_id = ?
          AND deleted_at IS NULL
        ORDER BY plate_no ASC
      `
    )
    .bind(stationId)
    .all()
    .catch(() => ({ results: [] }));

  return (rows?.results || []).map((row: any) => ({
    value: row.plate_no,
    label: `${row.plate_no} · ${row.driver_name || row.truck_type || '--'}`,
    disabled: row.status === 'archived',
    meta: {
      truck_id: row.truck_id,
      plate_no: row.plate_no,
      driver_name: row.driver_name || '',
      truck_type: row.truck_type || '',
      status: row.status || ''
    }
  }));
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

async function loadMobileOptionRows(
  db: any,
  tableName: string,
  extraMeta: Record<string, unknown> = {}
) {
  if (!db) return [];
  const rows = await db
    .prepare(
      `
        SELECT option_key, option_label, is_disabled
        FROM ${tableName}
        ORDER BY sort_order ASC, option_label ASC
      `
    )
    .all();

  return ((rows?.results || []) as Array<{ option_key: string; option_label: string; is_disabled: number | null }>).map((row) => ({
    value: row.option_key,
    label: row.option_label,
    disabled: Boolean(row.is_disabled),
    meta: extraMeta
  }));
}

async function writeMobileAuditEvent(
  db: any,
  actor: any,
  params: {
    action: string;
    objectType: string;
    objectId: string;
    stationId: string;
    summary: string;
    payload?: Record<string, unknown>;
  }
) {
  if (!db) return;
  await db
    .prepare(
      `
        INSERT INTO audit_events (
          audit_id,
          request_id,
          actor_id,
          actor_role,
          client_source,
          action,
          object_type,
          object_id,
          station_id,
          summary,
          payload_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      createId('AUD'),
      actor?.requestId || `req-${crypto.randomUUID()}`,
      actor?.userId || 'demo-mobile',
      actor?.roleIds?.[0] || 'mobile_operator',
      actor?.clientSource || 'mobile',
      params.action,
      params.objectType,
      params.objectId,
      params.stationId,
      params.summary,
      params.payload ? JSON.stringify(params.payload) : null,
      isoNow()
    )
    .run();
}

async function writeMobileStateTransition(
  db: any,
  actor: any,
  params: {
    objectType: string;
    objectId: string;
    stationId: string;
    stateField: string;
    fromValue: string | null | undefined;
    toValue: string | null | undefined;
    summary: string;
  }
) {
  if (!db || String(params.fromValue ?? '') === String(params.toValue ?? '')) return;
  await db
    .prepare(
      `
        INSERT INTO state_transitions (
          transition_id,
          object_type,
          object_id,
          state_field,
          from_value,
          to_value,
          changed_by,
          station_id,
          summary,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      createId('STR'),
      params.objectType,
      params.objectId,
      params.stateField,
      params.fromValue ?? null,
      params.toValue ?? null,
      actor?.userId || 'demo-mobile',
      params.stationId,
      params.summary,
      isoNow()
    )
    .run();
}

function allowLocalMobileDemoLogin(c: any) {
  return allowLocalOnlyAuth(c.env.ENVIRONMENT, c.env.ENABLE_LOCAL_DEMO_AUTH);
}

async function authenticateMobileUser(c: any, body: any) {
  const email = String(body.email || body.login_name || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return null;
  }

  const credential = (await c.env.DB?.prepare(
    `
      SELECT sc.user_id, sc.password_hash, sc.login_name, u.default_station_id, u.display_name, u.email
      FROM station_credentials sc
      JOIN users u ON u.user_id = sc.user_id
      WHERE LOWER(sc.login_name) = ?
      LIMIT 1
    `
  )
    .bind(email)
    .first()) as
    | { user_id: string; password_hash: string; login_name: string; default_station_id: string | null; display_name: string | null; email: string | null }
    | null;

  if (!credential) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const matched = await verifyPasswordHash(password, credential.password_hash);
  if (!matched) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const stationCode = body.stationCode || body.station_code || credential.default_station_id || 'MME';
  const requestedRoleIds = mapMobileRoleKeyToRoleCodes(body.roleKey || body.role_key || 'receiver');
  const roleRows = (await c.env.DB?.prepare(
    `
      SELECT role_code
      FROM user_roles
      WHERE user_id = ?
        AND (station_id IS NULL OR station_id = ?)
      ORDER BY role_code ASC
    `
  )
    .bind(credential.user_id, stationCode)
    .all()) as { results?: Array<{ role_code: RoleCode }> } | undefined;
  const availableRoleIds = (roleRows?.results || []).map((item) => item.role_code);
  const roleIds = requestedRoleIds.filter((roleCode) => availableRoleIds.includes(roleCode));

  return {
    userId: credential.user_id,
    stationCode,
    roleIds: roleIds.length ? roleIds : availableRoleIds.length ? availableRoleIds : requestedRoleIds,
    user: {
      user_id: credential.user_id,
      display_name: credential.display_name || credential.user_id,
      email: credential.email || credential.login_name
    }
  };
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

function normalizeMobileUnifiedOptionItems(items: unknown): MobileUnifiedOptionItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const value = String(record.value ?? record.key ?? '').trim();

      if (!value) {
        return null;
      }

      const meta =
        record.meta && typeof record.meta === 'object' && !Array.isArray(record.meta)
          ? (record.meta as Record<string, unknown>)
          : undefined;

      return {
        value,
        label: String(record.label ?? record.title ?? value),
        disabled: Boolean(record.disabled),
        meta
      } satisfies MobileUnifiedOptionItem;
    })
    .filter(Boolean) as MobileUnifiedOptionItem[];
}

function buildMobileUnifiedOptionsPayload(
  resource: string,
  groups: Record<string, unknown>,
  context: Record<string, unknown> = {}
) {
  return {
    scope: 'mobile',
    resource,
    ...context,
    groups: Object.fromEntries(
      Object.entries(groups).map(([key, value]) => [key, normalizeMobileUnifiedOptionItems(value)])
    )
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
  const status = row.receipt_status || '待收货';
  const reviewStatus = row.review_status || (status === '已复核' ? '已复核' : '待复核');

  return {
    receiptId: row.receipt_record_id || '',
    flightNo,
    awb: row.awb_no,
    receivedPieces,
    receivedWeight,
    status,
    reviewStatus,
    reviewedWeight: Number(row.reviewed_weight ?? receivedWeight),
    receivedAt: row.updated_at || row.created_at || null,
    reviewedAt: row.reviewed_at || row.updated_at || row.created_at || null,
    note: row.note || '',
    archived: Boolean(row.deleted_at),
    deletedAt: row.deleted_at || null,
    canArchive: !Boolean(row.deleted_at),
    canRestore: Boolean(row.deleted_at),
    canReopen: !Boolean(row.deleted_at) && ['已收货', '已复核'].includes(status)
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
    offloadStatus: row.offload_status || '无拉货',
    offloadRecordedAt: row.offload_recorded_at || null,
    archived: Boolean(row.deleted_at),
    deletedAt: row.deleted_at || null,
    canArchive: !Boolean(row.deleted_at),
    canRestore: Boolean(row.deleted_at),
    canReopen: !Boolean(row.deleted_at) && ['已装机', '已回退'].includes(row.container_status || '待装机')
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
              SELECT receipt_record_id, awb_no, received_pieces, received_weight, receipt_status, review_status, reviewed_weight, reviewed_at, note, deleted_at, created_at, updated_at
              FROM outbound_receipts
              WHERE station_id = ?
                AND flight_no = ?
                AND deleted_at IS NULL
              ORDER BY awb_no ASC
            `
          )
          .bind(stationId, flightNo)
          .all()
          .then((rows: any) => (rows?.results || []) as any[]),
        db
          .prepare(
            `
              SELECT container_id, container_code, total_boxes, total_weight, reviewed_weight, container_status, loaded_at, note, offload_boxes, offload_status, offload_recorded_at, deleted_at
              FROM outbound_containers
              WHERE station_id = ?
                AND flight_no = ?
                AND deleted_at IS NULL
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
    completedAt: row.completed_at || '',
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
        SELECT pallet_id, pallet_no, flight_no, pallet_status, total_boxes, total_weight, storage_location, note, loaded_plate, loaded_at, deleted_at
        FROM inbound_pallets
        WHERE station_id = ?
          AND flight_no = ?
          AND deleted_at IS NULL
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
        SELECT loading_plan_id, flight_no, truck_plate, vehicle_model, driver_name, collection_note, forklift_driver, checker, arrival_time, depart_time, total_boxes, total_weight, plan_status, note, completed_at, deleted_at
        FROM loading_plans
        WHERE station_id = ?
          AND flight_no = ?
          AND deleted_at IS NULL
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
        SELECT count_record_id, awb_no, counted_boxes, status, scanned_serials_json, note, updated_at, deleted_at
        FROM inbound_count_records
        WHERE station_id = ?
          AND flight_no = ?
          AND deleted_at IS NULL
        ORDER BY awb_no ASC
      `
    )
    .bind(stationId, flightNo)
    .all();

  return (rows?.results || []).reduce((acc: Record<string, any>, row: any) => {
    acc[row.awb_no] = {
      countRecordId: row.count_record_id,
      countedBoxes: Number(row.counted_boxes ?? 0),
      status: row.status,
      scannedSerials: parseJsonField(row.scanned_serials_json, []),
      note: row.note || '',
      updatedAt: row.updated_at || null,
      archived: Boolean(row.deleted_at)
    };
    return acc;
  }, {});
}

async function listInboundCountRecordItems(db: any, stationId: string, flightNo: string, pageRaw?: string | null, pageSizeRaw?: string | null, includeArchived = false) {
  const { page, pageSize, offset } = parsePageParams(pageRaw, pageSizeRaw);
  const archivedSql = includeArchived ? '' : 'AND deleted_at IS NULL';
  const totalRow = await db
    ?.prepare(
      `
        SELECT COUNT(*) AS total
        FROM inbound_count_records
        WHERE station_id = ?
          AND flight_no = ?
          ${archivedSql}
      `
    )
    .bind(stationId, flightNo)
    .first();
  const rows = await db
    ?.prepare(
      `
        SELECT count_record_id, awb_no, counted_boxes, status, scanned_serials_json, note, updated_at, deleted_at
        FROM inbound_count_records
        WHERE station_id = ?
          AND flight_no = ?
          ${archivedSql}
        ORDER BY awb_no ASC
        LIMIT ? OFFSET ?
      `
    )
    .bind(stationId, flightNo, pageSize, offset)
    .all();

  return {
    items: (rows?.results || []).map((row: any) => ({
      countRecordId: row.count_record_id,
      awbNo: row.awb_no,
      countedBoxes: Number(row.counted_boxes ?? 0),
      status: row.status,
      scannedSerials: parseJsonField(row.scanned_serials_json, []),
      note: row.note || '',
      updatedAt: row.updated_at || null,
      archived: Boolean(row.deleted_at)
    })),
    page,
    page_size: pageSize,
    total: Number(totalRow?.total ?? 0)
  };
}

async function listInboundPalletItems(db: any, stationId: string, flightNo: string, pageRaw?: string | null, pageSizeRaw?: string | null, includeArchived = false) {
  const { page, pageSize, offset } = parsePageParams(pageRaw, pageSizeRaw);
  const archivedSql = includeArchived ? '' : 'AND deleted_at IS NULL';
  const totalRow = await db
    ?.prepare(
      `
        SELECT COUNT(*) AS total
        FROM inbound_pallets
        WHERE station_id = ?
          AND flight_no = ?
          ${archivedSql}
      `
    )
    .bind(stationId, flightNo)
    .first();

  const rows = await db
    ?.prepare(
      `
        SELECT pallet_id, pallet_no, flight_no, pallet_status, total_boxes, total_weight, storage_location, note, loaded_plate, loaded_at, deleted_at
        FROM inbound_pallets
        WHERE station_id = ?
          AND flight_no = ?
          ${archivedSql}
        ORDER BY pallet_no ASC
        LIMIT ? OFFSET ?
      `
    )
    .bind(stationId, flightNo, pageSize, offset)
    .all();

  const items = await Promise.all(
    (rows?.results || []).map(async (row: any) => {
      const palletItems = await db
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
      return {
        ...mapMobileInboundPalletItem(row, palletItems?.results || []),
        archived: Boolean(row.deleted_at)
      };
    })
  );

  return {
    items,
    page,
    page_size: pageSize,
    total: Number(totalRow?.total ?? 0)
  };
}

async function listInboundLoadingPlanItems(db: any, stationId: string, flightNo: string, pageRaw?: string | null, pageSizeRaw?: string | null, includeArchived = false) {
  const { page, pageSize, offset } = parsePageParams(pageRaw, pageSizeRaw);
  const archivedSql = includeArchived ? '' : 'AND deleted_at IS NULL';
  const totalRow = await db
    ?.prepare(
      `
        SELECT COUNT(*) AS total
        FROM loading_plans
        WHERE station_id = ?
          AND flight_no = ?
          ${archivedSql}
      `
    )
    .bind(stationId, flightNo)
    .first();
  const rows = await db
    ?.prepare(
      `
        SELECT loading_plan_id, flight_no, truck_plate, vehicle_model, driver_name, collection_note, forklift_driver, checker, arrival_time, depart_time, total_boxes, total_weight, plan_status, note, completed_at, deleted_at
        FROM loading_plans
        WHERE station_id = ?
          AND flight_no = ?
          ${archivedSql}
        ORDER BY created_at ASC
        LIMIT ? OFFSET ?
      `
    )
    .bind(stationId, flightNo, pageSize, offset)
    .all();

  const items = await Promise.all(
    (rows?.results || []).map(async (row: any) => {
      const planItems = await db
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

      return {
        ...mapMobileInboundLoadingPlanItem(row, planItems?.results || []),
        completedAt: row.completed_at || '',
        archived: Boolean(row.deleted_at)
      };
    })
  );

  return {
    items,
    page,
    page_size: pageSize,
    total: Number(totalRow?.total ?? 0)
  };
}

export function registerMobileRoutes(app: ApiApp, getStationServices: (c: any) => StationServices, requireRoles: RequireRoles) {
  app.get('/api/v1/mobile/login', async (c) => {
    return c.json({
      data: {
        station_options: mobileLoginStationOptions,
        role_options: mobileLoginRoleOptions,
        requires_formal_auth: !allowLocalMobileDemoLogin(c),
        defaults: {
          station: mobileLoginStationOptions[0]?.value || '',
          role_key: mobileLoginRoleOptions[0]?.value || ''
        }
      }
    });
  });

  app.get('/api/v1/mobile/options/login', async (c) => {
    return c.json({
      data: buildMobileUnifiedOptionsPayload('login', {
        station_options: mobileLoginStationOptions.map((item) => ({
          value: item.value,
          label: item.label,
          disabled: false,
          meta: { code: item.code }
        })),
        role_options: mobileLoginRoleOptions.map((item) => ({
          value: item.value,
          label: item.label,
          disabled: false
        }))
      })
    });
  });

  app.post('/api/v1/mobile/login', async (c) => {
    try {
      const body = await c.req.json();
      const formalLogin = await authenticateMobileUser(c, body).catch((error) => {
        if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
          throw jsonError(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        }

        throw error;
      });

      if (!formalLogin && !allowLocalMobileDemoLogin(c)) {
        return jsonError(c, 401, 'FORMAL_AUTH_REQUIRED', 'Mobile login requires a valid email and password');
      }

      const stationCode = formalLogin?.stationCode || body.stationCode || body.station_code || 'MME';
      const roleKey = body.roleKey || body.role_key || 'receiver';
      const roleIds = formalLogin?.roleIds || mapMobileRoleKeyToRoleCodes(roleKey);
      const secret = resolveAuthTokenSecret(c.env.AUTH_TOKEN_SECRET, c.env.ENVIRONMENT);
      const requestedUserId = body.employeeId ? `mobile-${body.employeeId}` : body.userId || body.user_id;
      const userId = formalLogin?.userId || (await resolveMobileUserId(c, requestedUserId));

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
          },
          user: formalLogin?.user || null
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
    '/api/v1/mobile/options/select',
    requireRoles(['mobile_operator', 'station_supervisor', 'document_desk', 'check_worker', 'delivery_desk', 'inbound_operator']),
    async (c) => {
      try {
        const requestedRoleKey = c.req.query('role_key') || c.req.query('roleKey') || undefined;
        const selectResponse = buildMobileSelectResponse(c.var.actor, requestedRoleKey);
        return c.json({
          data: buildMobileUnifiedOptionsPayload(
            'select',
            {
              node_options: selectResponse.nodeOptions.map((item) => ({
                value: item.key,
                label: item.title,
                disabled: false,
                meta: {
                  description: item.description,
                  path: item.path,
                  flow_key: item.flowKey,
                  recommended: item.recommended
                }
              })),
              recommended_node_options: selectResponse.recommendedNodes.map((item) => ({
                value: item.key,
                label: item.title,
                disabled: false,
                meta: {
                  description: item.description,
                  path: item.path,
                  flow_key: item.flowKey,
                  recommended: true
                }
              }))
            },
            { role_key: selectResponse.session.roleKey, station_id: selectResponse.session.stationCode }
          )
        });
      } catch (error) {
        return handleServiceError(c, error, 'GET /mobile/options/select');
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
        const response = buildMobileNodeFlowResponse(c.var.actor, stationId, c.req.param('flowKey'), {
          pageRaw: c.req.query('page'),
          pageSizeRaw: c.req.query('page_size'),
          keyword: c.req.query('keyword'),
          status: c.req.query('status')
        });

        if (!response) {
          return jsonError(c, 404, 'NODE_FLOW_NOT_FOUND', 'Mobile node flow does not exist', {
            flow_key: c.req.param('flowKey')
          });
        }

        return c.json(response);
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
        const response = buildMobileNodeFlowResponse(c.var.actor, stationId, c.req.param('flowKey'), {
          itemId: c.req.param('itemId')
        });

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
      const includeArchived = ['1', 'true'].includes(String(c.req.query('include_archived') || '').toLowerCase());
      const records = await listInboundCountRecords(c.env.DB, stationId, c.req.param('flightNo'));
      const list = await listInboundCountRecordItems(
        c.env.DB,
        stationId,
        c.req.param('flightNo'),
        c.req.query('page'),
        c.req.query('page_size'),
        includeArchived
      );
      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), records, ...list } });
    } catch (error) {
      if (error instanceof Error && error.message === 'STATION_SCOPE_DENIED') {
        return jsonError(c, 403, 'STATION_SCOPE_DENIED', 'Current actor cannot access the requested station');
      }
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/counts');
    }
  });

  app.get('/api/v1/mobile/inbound/:flightNo/counts/options', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      return c.json({
        data: {
          flight_no: c.req.param('flightNo'),
          statusOptions: await loadOptionRows(c.env.DB, 'station_inbound_count_status_options'),
          awbOptions: await loadInboundWaybillOptions(c.env.DB, stationId, c.req.param('flightNo'))
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/counts/options');
    }
  });

  app.get('/api/v1/mobile/options/inbound/:flightNo/counts', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const flightNo = c.req.param('flightNo');
      return c.json({
        data: buildMobileUnifiedOptionsPayload(
          'inbound_count_records',
          {
            count_status_options: await loadOptionRows(c.env.DB, 'station_inbound_count_status_options'),
            awb_options: await loadInboundWaybillOptions(c.env.DB, stationId, flightNo)
          },
          { station_id: stationId, flight_no: flightNo }
        )
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/options/inbound/:flightNo/counts');
    }
  });

  app.post('/api/v1/mobile/inbound/:flightNo/counts/:awbNo', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const awbNo = c.req.param('awbNo');
      const existing = await c.env.DB?.prepare(
        `
          SELECT count_record_id, status, deleted_at, counted_boxes, scanned_serials_json, note
          FROM inbound_count_records
          WHERE station_id = ?
            AND flight_no = ?
            AND awb_no = ?
          LIMIT 1
        `
      ).bind(stationId, c.req.param('flightNo'), awbNo).first<any>();
      const countRecordId = existing?.count_record_id || `CNT-${c.req.param('flightNo')}-${awbNo}`.replace(/[^A-Za-z0-9-]/g, '');
      const nextStatus = body.status || (Number(body.counted_boxes ?? body.countedBoxes ?? 0) > 0 ? '点货中' : '未开始');
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
            updated_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, awb_no) DO UPDATE SET
            counted_boxes = excluded.counted_boxes,
            status = excluded.status,
            scanned_serials_json = excluded.scanned_serials_json,
            note = excluded.note,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at,
            deleted_at = NULL
        `
      )
        .bind(
          countRecordId,
          stationId,
          c.req.param('flightNo'),
          awbNo,
          body.counted_boxes ?? body.countedBoxes ?? 0,
          nextStatus,
          JSON.stringify(body.scanned_serials ?? body.scannedSerials ?? []),
          body.note ?? null,
          c.var.actor.userId,
          now,
          now,
          null
        )
        .run();

      const auditId = await writeMobileAudit(c.env.DB, c.var.actor, {
        requestId: c.req.header('x-request-id') || undefined,
        action: existing ? 'INBOUND_COUNT_RECORD_UPDATED' : 'INBOUND_COUNT_RECORD_CREATED',
        objectType: 'InboundCountRecord',
        objectId: countRecordId,
        stationId,
        summary: `${existing ? 'Updated' : 'Created'} inbound count record ${awbNo}`,
        payload: {
          flight_no: c.req.param('flightNo'),
          awb_no: awbNo,
          counted_boxes: body.counted_boxes ?? body.countedBoxes ?? 0,
          status: nextStatus
        }
      });

      if (!existing || existing.status !== nextStatus) {
        await writeMobileTransition(c.env.DB, c.var.actor, {
          stationId,
          objectType: 'InboundCountRecord',
          objectId: countRecordId,
          stateField: 'status',
          fromValue: existing?.status || null,
          toValue: nextStatus,
          auditId
        });
      }

      return c.json({
        data: {
          count_record_id: countRecordId,
          flight_no: c.req.param('flightNo'),
          awb_no: awbNo,
          counted_boxes: body.counted_boxes ?? body.countedBoxes ?? 0,
          status: nextStatus
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/inbound/:flightNo/counts/:awbNo');
    }
  });

  app.patch('/api/v1/mobile/inbound/:flightNo/counts/:awbNo', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const awbNo = c.req.param('awbNo');
      const existing = await c.env.DB?.prepare(
        `
          SELECT count_record_id, status, counted_boxes, scanned_serials_json, note, deleted_at
          FROM inbound_count_records
          WHERE station_id = ?
            AND flight_no = ?
            AND awb_no = ?
          LIMIT 1
        `
      ).bind(stationId, c.req.param('flightNo'), awbNo).first<any>();

      if (!existing) {
        return jsonError(c, 404, 'COUNT_RECORD_NOT_FOUND', 'Inbound count record does not exist');
      }

      const lifecycleAction = String(body.lifecycle_action || '').trim();
      const changingPayload =
        Object.prototype.hasOwnProperty.call(body, 'counted_boxes') ||
        Object.prototype.hasOwnProperty.call(body, 'countedBoxes') ||
        Object.prototype.hasOwnProperty.call(body, 'scanned_serials') ||
        Object.prototype.hasOwnProperty.call(body, 'scannedSerials');

      if (existing.deleted_at && body.archived !== false) {
        return jsonError(c, 409, 'COUNT_RECORD_ARCHIVED', 'Archived count record cannot be updated');
      }

      if (existing.status === '理货完成' && lifecycleAction !== 'reopen' && changingPayload) {
        return jsonError(c, 409, 'COUNT_RECORD_LOCKED', 'Completed count record must be reopened before editing boxes or scans');
      }

      const nextStatus =
        body.archived === false
          ? body.status || body.counted_status || '未开始'
          : lifecycleAction === 'reopen'
            ? '点货中'
            : body.status || body.counted_status || existing.status;
      const nextDeletedAt = body.archived === false ? null : existing.deleted_at;

      await c.env.DB?.prepare(
        `
          UPDATE inbound_count_records
          SET counted_boxes = COALESCE(?, counted_boxes),
              status = ?,
              scanned_serials_json = COALESCE(?, scanned_serials_json),
              note = COALESCE(?, note),
              deleted_at = ?,
              updated_by = ?,
              updated_at = ?
          WHERE count_record_id = ?
        `
      )
        .bind(
          body.counted_boxes ?? body.countedBoxes ?? null,
          nextStatus,
          Object.prototype.hasOwnProperty.call(body, 'scanned_serials') || Object.prototype.hasOwnProperty.call(body, 'scannedSerials')
            ? JSON.stringify(body.scanned_serials ?? body.scannedSerials ?? [])
            : null,
          body.note ?? null,
          nextDeletedAt,
          c.var.actor.userId,
          isoNow(),
          existing.count_record_id
        )
        .run();

      const auditAction = lifecycleAction === 'reopen' ? 'INBOUND_COUNT_RECORD_REOPENED' : body.archived === false ? 'INBOUND_COUNT_RECORD_RESTORED' : 'INBOUND_COUNT_RECORD_UPDATED';
      const auditId = await writeMobileAudit(c.env.DB, c.var.actor, {
        requestId: c.req.header('x-request-id') || undefined,
        action: auditAction,
        objectType: 'InboundCountRecord',
        objectId: existing.count_record_id,
        stationId,
        summary: `${auditAction} ${awbNo}`,
        payload: { flight_no: c.req.param('flightNo'), awb_no: awbNo, status: nextStatus }
      });

      if (existing.status !== nextStatus) {
        await writeMobileTransition(c.env.DB, c.var.actor, {
          stationId,
          objectType: 'InboundCountRecord',
          objectId: existing.count_record_id,
          stateField: 'status',
          fromValue: existing.status,
          toValue: nextStatus,
          auditId
        });
      }

      return c.json({ data: { count_record_id: existing.count_record_id, awb_no: awbNo, status: nextStatus, archived: false } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/inbound/:flightNo/counts/:awbNo');
    }
  });

  app.delete('/api/v1/mobile/inbound/:flightNo/counts/:awbNo', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const awbNo = c.req.param('awbNo');
      const existing = await c.env.DB?.prepare(
        `
          SELECT count_record_id, status
          FROM inbound_count_records
          WHERE station_id = ?
            AND flight_no = ?
            AND awb_no = ?
          LIMIT 1
        `
      ).bind(stationId, c.req.param('flightNo'), awbNo).first<any>();

      if (!existing) {
        return jsonError(c, 404, 'COUNT_RECORD_NOT_FOUND', 'Inbound count record does not exist');
      }

      const deletedAt = isoNow();
      await c.env.DB?.prepare(
        `
          UPDATE inbound_count_records
          SET status = '已作废',
              deleted_at = ?,
              updated_by = ?,
              updated_at = ?
          WHERE count_record_id = ?
        `
      ).bind(deletedAt, c.var.actor.userId, deletedAt, existing.count_record_id).run();

      const auditId = await writeMobileAudit(c.env.DB, c.var.actor, {
        requestId: c.req.header('x-request-id') || undefined,
        action: 'INBOUND_COUNT_RECORD_ARCHIVED',
        objectType: 'InboundCountRecord',
        objectId: existing.count_record_id,
        stationId,
        summary: `Archived inbound count record ${awbNo}`
      });
      await writeMobileTransition(c.env.DB, c.var.actor, {
        stationId,
        objectType: 'InboundCountRecord',
        objectId: existing.count_record_id,
        stateField: 'status',
        fromValue: existing.status,
        toValue: '已作废',
        auditId
      });

      return c.json({ data: { count_record_id: existing.count_record_id, awb_no: awbNo, archived: true } });
    } catch (error) {
      return handleServiceError(c, error, 'DELETE /mobile/inbound/:flightNo/counts/:awbNo');
    }
  });

  app.get('/api/v1/mobile/inbound/:flightNo/pallets', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const includeArchived = ['1', 'true'].includes(String(c.req.query('include_archived') || '').toLowerCase());
      const pallets = await listInboundPalletItems(
        c.env.DB,
        stationId,
        c.req.param('flightNo'),
        c.req.query('page'),
        c.req.query('page_size'),
        includeArchived
      );

      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), pallets: pallets.items, ...pallets } });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/pallets');
    }
  });

  app.get('/api/v1/mobile/inbound/:flightNo/pallets/options', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      return c.json({
        data: {
          flight_no: c.req.param('flightNo'),
          statusOptions: await loadOptionRows(c.env.DB, 'station_inbound_pallet_status_options'),
          storageLocationOptions: await loadOptionRows(c.env.DB, 'station_inbound_storage_location_options'),
          awbOptions: await loadInboundWaybillOptions(c.env.DB, stationId, c.req.param('flightNo'))
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/pallets/options');
    }
  });

  app.get('/api/v1/mobile/options/inbound/:flightNo/pallets', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const flightNo = c.req.param('flightNo');
      return c.json({
        data: buildMobileUnifiedOptionsPayload(
          'inbound_pallets',
          {
            pallet_status_options: await loadOptionRows(c.env.DB, 'station_inbound_pallet_status_options'),
            storage_location_options: await loadOptionRows(c.env.DB, 'station_inbound_storage_location_options'),
            awb_options: await loadInboundWaybillOptions(c.env.DB, stationId, flightNo)
          },
          { station_id: stationId, flight_no: flightNo }
        )
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/options/inbound/:flightNo/pallets');
    }
  });

  app.post('/api/v1/mobile/inbound/:flightNo/pallets', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const existing = await c.env.DB?.prepare(
        `
          SELECT pallet_id, pallet_status
          FROM inbound_pallets
          WHERE station_id = ?
            AND flight_no = ?
            AND pallet_no = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('flightNo'), body.pallet_no || body.palletNo)
        .first<{ pallet_id: string; pallet_status: string }>();
      const palletId = existing?.pallet_id || body.pallet_id || createId('PLT');
      const items = Array.isArray(body.items) ? body.items : [];
      const now = isoNow();
      const nextStatus = body.status || body.pallet_status || (items.length ? '组托中' : '计划');

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
            loaded_plate,
            loaded_at,
            updated_by,
            created_at,
            updated_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, pallet_no) DO UPDATE SET
            pallet_status = excluded.pallet_status,
            total_boxes = excluded.total_boxes,
            total_weight = excluded.total_weight,
            storage_location = excluded.storage_location,
            note = excluded.note,
            loaded_plate = excluded.loaded_plate,
            loaded_at = excluded.loaded_at,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at,
            deleted_at = NULL
        `
      )
        .bind(
          palletId,
          stationId,
          c.req.param('flightNo'),
          body.pallet_no || body.palletNo,
          nextStatus,
          body.total_boxes ?? body.totalBoxes ?? 0,
          body.total_weight ?? body.totalWeight ?? 0,
          body.storage_location || body.storageLocation || null,
          body.note ?? null,
          body.loaded_plate ?? body.loadedPlate ?? null,
          body.loaded_at ?? body.loadedAt ?? null,
          c.var.actor.userId,
          now,
          now,
          null
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

      const auditId = await writeMobileAudit(c.env.DB, c.var.actor, {
        requestId: c.req.header('x-request-id') || undefined,
        action: existing ? 'INBOUND_PALLET_UPDATED' : 'INBOUND_PALLET_CREATED',
        objectType: 'InboundPallet',
        objectId: palletId,
        stationId,
        summary: `${existing ? 'Updated' : 'Created'} inbound pallet ${body.pallet_no || body.palletNo}`,
        payload: {
          flight_no: c.req.param('flightNo'),
          pallet_no: body.pallet_no || body.palletNo,
          status: nextStatus
        }
      });
      if (!existing || existing.pallet_status !== nextStatus) {
        await writeMobileTransition(c.env.DB, c.var.actor, {
          stationId,
          objectType: 'InboundPallet',
          objectId: palletId,
          stateField: 'pallet_status',
          fromValue: existing?.pallet_status || null,
          toValue: nextStatus,
          auditId
        });
      }

      return c.json({ data: { pallet_id: palletId, status: nextStatus } }, 201);
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
          SELECT pallet_id, pallet_status, deleted_at
          FROM inbound_pallets
          WHERE station_id = ?
            AND pallet_no = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('palletNo'))
        .first<any>();

      if (!row) {
        return jsonError(c, 404, 'PALLET_NOT_FOUND', 'Pallet does not exist');
      }

      const lifecycleAction = String(body.lifecycle_action || '').trim();
      const changingPayload =
        Object.prototype.hasOwnProperty.call(body, 'items') ||
        Object.prototype.hasOwnProperty.call(body, 'total_boxes') ||
        Object.prototype.hasOwnProperty.call(body, 'totalBoxes') ||
        Object.prototype.hasOwnProperty.call(body, 'total_weight') ||
        Object.prototype.hasOwnProperty.call(body, 'totalWeight') ||
        Object.prototype.hasOwnProperty.call(body, 'storage_location') ||
        Object.prototype.hasOwnProperty.call(body, 'storageLocation');

      if (row.deleted_at && body.archived !== false) {
        return jsonError(c, 409, 'PALLET_ARCHIVED', 'Archived pallet cannot be updated');
      }

      if (row.pallet_status === '已装车' && lifecycleAction !== 'reopen' && changingPayload) {
        return jsonError(c, 409, 'PALLET_LOCKED', 'Loaded pallet must be reopened before changing pallet contents');
      }

      const nextStatus =
        body.archived === false
          ? body.status || body.pallet_status || '计划'
          : lifecycleAction === 'reopen'
            ? '待装车'
            : body.status ?? body.pallet_status ?? row.pallet_status;
      const nextLoadedPlate = lifecycleAction === 'reopen' ? null : body.loaded_plate ?? body.loadedPlate ?? null;
      const nextLoadedAt = lifecycleAction === 'reopen' ? null : body.loaded_at ?? body.loadedAt ?? null;
      const nextDeletedAt = body.archived === false ? null : row.deleted_at;

      await c.env.DB?.prepare(
        `
          UPDATE inbound_pallets
          SET pallet_status = ?,
              total_boxes = COALESCE(?, total_boxes),
              total_weight = COALESCE(?, total_weight),
              storage_location = COALESCE(?, storage_location),
              note = COALESCE(?, note),
              loaded_plate = COALESCE(?, loaded_plate),
              loaded_at = COALESCE(?, loaded_at),
              deleted_at = ?,
              updated_by = ?,
              updated_at = ?
          WHERE pallet_id = ?
        `
      )
        .bind(
          nextStatus,
          body.total_boxes ?? body.totalBoxes ?? null,
          body.total_weight ?? body.totalWeight ?? null,
          body.storage_location ?? body.storageLocation ?? null,
          body.note ?? null,
          nextLoadedPlate,
          nextLoadedAt,
          nextDeletedAt,
          c.var.actor.userId,
          isoNow(),
          row.pallet_id
        )
        .run();

      if (Array.isArray(body.items)) {
        const now = isoNow();
        await c.env.DB?.prepare(`DELETE FROM inbound_pallet_items WHERE pallet_id = ?`).bind(row.pallet_id).run();
        for (const item of body.items) {
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
            .bind(createId('PLI'), row.pallet_id, item.awb || item.awb_no, item.boxes ?? 0, item.weight ?? 0, now, now)
            .run();
        }
      }

      const auditAction = lifecycleAction === 'reopen' ? 'INBOUND_PALLET_REOPENED' : body.archived === false ? 'INBOUND_PALLET_RESTORED' : 'INBOUND_PALLET_UPDATED';
      const auditId = await writeMobileAudit(c.env.DB, c.var.actor, {
        requestId: c.req.header('x-request-id') || undefined,
        action: auditAction,
        objectType: 'InboundPallet',
        objectId: row.pallet_id,
        stationId,
        summary: `${auditAction} ${c.req.param('palletNo')}`,
        payload: { pallet_no: c.req.param('palletNo'), status: nextStatus }
      });
      if (row.pallet_status !== nextStatus) {
        await writeMobileTransition(c.env.DB, c.var.actor, {
          stationId,
          objectType: 'InboundPallet',
          objectId: row.pallet_id,
          stateField: 'pallet_status',
          fromValue: row.pallet_status,
          toValue: nextStatus,
          auditId
        });
      }

      return c.json({ data: { pallet_no: c.req.param('palletNo'), ok: true, status: nextStatus, archived: false } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/inbound/pallets/:palletNo');
    }
  });

  app.delete('/api/v1/mobile/inbound/pallets/:palletNo', requireRoles(['mobile_operator', 'station_supervisor', 'check_worker']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const row = await c.env.DB?.prepare(
        `
          SELECT pallet_id, pallet_status
          FROM inbound_pallets
          WHERE station_id = ?
            AND pallet_no = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('palletNo'))
        .first<any>();

      if (!row) {
        return jsonError(c, 404, 'PALLET_NOT_FOUND', 'Pallet does not exist');
      }

      const deletedAt = isoNow();
      await c.env.DB?.prepare(
        `
          UPDATE inbound_pallets
          SET pallet_status = '已作废',
              deleted_at = ?,
              updated_by = ?,
              updated_at = ?
          WHERE pallet_id = ?
        `
      )
        .bind(deletedAt, c.var.actor.userId, deletedAt, row.pallet_id)
        .run();

      const auditId = await writeMobileAudit(c.env.DB, c.var.actor, {
        requestId: c.req.header('x-request-id') || undefined,
        action: 'INBOUND_PALLET_ARCHIVED',
        objectType: 'InboundPallet',
        objectId: row.pallet_id,
        stationId,
        summary: `Archived inbound pallet ${c.req.param('palletNo')}`
      });
      await writeMobileTransition(c.env.DB, c.var.actor, {
        stationId,
        objectType: 'InboundPallet',
        objectId: row.pallet_id,
        stateField: 'pallet_status',
        fromValue: row.pallet_status,
        toValue: '已作废',
        auditId
      });

      return c.json({ data: { pallet_no: c.req.param('palletNo'), archived: true } });
    } catch (error) {
      return handleServiceError(c, error, 'DELETE /mobile/inbound/pallets/:palletNo');
    }
  });

  app.get('/api/v1/mobile/inbound/:flightNo/loading-plans', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const includeArchived = ['1', 'true'].includes(String(c.req.query('include_archived') || '').toLowerCase());
      const plans = await listInboundLoadingPlanItems(
        c.env.DB,
        stationId,
        c.req.param('flightNo'),
        c.req.query('page'),
        c.req.query('page_size'),
        includeArchived
      );

      return c.json({ data: { station_id: stationId, flight_no: c.req.param('flightNo'), plans: plans.items, ...plans } });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/loading-plans');
    }
  });

  app.get('/api/v1/mobile/inbound/:flightNo/loading-plans/options', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      return c.json({
        data: {
          flight_no: c.req.param('flightNo'),
          statusOptions: await loadOptionRows(c.env.DB, 'station_inbound_loading_plan_status_options'),
          palletOptions: await loadInboundPalletOptions(c.env.DB, stationId, c.req.param('flightNo')),
          truckOptions: await loadInboundTruckOptions(c.env.DB, stationId)
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/inbound/:flightNo/loading-plans/options');
    }
  });

  app.get('/api/v1/mobile/options/inbound/:flightNo/loading-plans', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const flightNo = c.req.param('flightNo');
      return c.json({
        data: buildMobileUnifiedOptionsPayload(
          'loading_plans',
          {
            loading_plan_status_options: await loadOptionRows(c.env.DB, 'station_inbound_loading_plan_status_options'),
            pallet_options: await loadInboundPalletOptions(c.env.DB, stationId, flightNo),
            truck_options: await loadInboundTruckOptions(c.env.DB, stationId)
          },
          { station_id: stationId, flight_no: flightNo }
        )
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/options/inbound/:flightNo/loading-plans');
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
            updated_at,
            completed_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          now,
          body.completed_at ?? body.completedAt ?? null,
          null
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

      const nextStatus = body.status || body.plan_status || '计划';
      const auditId = await writeMobileAudit(c.env.DB, c.var.actor, {
        requestId: c.req.header('x-request-id') || undefined,
        action: 'INBOUND_LOADING_PLAN_CREATED',
        objectType: 'InboundLoadingPlan',
        objectId: planId,
        stationId,
        summary: `Created inbound loading plan ${planId}`,
        payload: { flight_no: c.req.param('flightNo'), status: nextStatus }
      });
      await writeMobileTransition(c.env.DB, c.var.actor, {
        stationId,
        objectType: 'InboundLoadingPlan',
        objectId: planId,
        stateField: 'plan_status',
        fromValue: null,
        toValue: nextStatus,
        auditId
      });

      return c.json({ data: { loading_plan_id: planId, status: nextStatus } }, 201);
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/inbound/:flightNo/loading-plans');
    }
  });

  app.patch('/api/v1/mobile/inbound/loading-plans/:planId', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const existing = await c.env.DB?.prepare(
        `
          SELECT loading_plan_id, plan_status, deleted_at
          FROM loading_plans
          WHERE station_id = ?
            AND loading_plan_id = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('planId'))
        .first<any>();

      if (!existing) {
        return jsonError(c, 404, 'LOADING_PLAN_NOT_FOUND', 'Loading plan does not exist');
      }

      const lifecycleAction = String(body.lifecycle_action || '').trim();
      const changingPayload =
        Object.prototype.hasOwnProperty.call(body, 'pallets') ||
        Object.prototype.hasOwnProperty.call(body, 'truck_plate') ||
        Object.prototype.hasOwnProperty.call(body, 'truckPlate') ||
        Object.prototype.hasOwnProperty.call(body, 'collection_note') ||
        Object.prototype.hasOwnProperty.call(body, 'collectionNote');

      if (existing.deleted_at && body.archived !== false) {
        return jsonError(c, 409, 'LOADING_PLAN_ARCHIVED', 'Archived loading plan cannot be updated');
      }

      if (existing.plan_status === '已完成' && lifecycleAction !== 'reopen' && changingPayload) {
        return jsonError(c, 409, 'LOADING_PLAN_LOCKED', 'Completed loading plan must be reopened before editing plan contents');
      }

      const nextStatus =
        body.archived === false
          ? body.status || body.plan_status || '计划'
          : lifecycleAction === 'reopen'
            ? '装车中'
            : body.status ?? body.plan_status ?? existing.plan_status;
      const nextCompletedAt =
        lifecycleAction === 'reopen'
          ? null
          : body.completed_at ?? body.completedAt ?? (nextStatus === '已完成' ? isoNow() : null);
      const nextDeletedAt = body.archived === false ? null : existing.deleted_at;

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
              plan_status = ?,
              note = COALESCE(?, note),
              completed_at = ?,
              deleted_at = ?,
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
          nextStatus,
          body.note ?? null,
          nextCompletedAt,
          nextDeletedAt,
          c.var.actor.userId,
          isoNow(),
          c.req.param('planId')
        )
        .run();

      if (Array.isArray(body.pallets)) {
        await c.env.DB?.prepare(`DELETE FROM loading_plan_items WHERE loading_plan_id = ?`).bind(c.req.param('planId')).run();
        for (const palletNo of body.pallets) {
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
            .bind(createId('LPI'), c.req.param('planId'), palletNo, isoNow(), isoNow())
            .run();
        }
      }

      const auditAction = lifecycleAction === 'reopen' ? 'INBOUND_LOADING_PLAN_REOPENED' : body.archived === false ? 'INBOUND_LOADING_PLAN_RESTORED' : 'INBOUND_LOADING_PLAN_UPDATED';
      const auditId = await writeMobileAudit(c.env.DB, c.var.actor, {
        requestId: c.req.header('x-request-id') || undefined,
        action: auditAction,
        objectType: 'InboundLoadingPlan',
        objectId: c.req.param('planId'),
        stationId,
        summary: `${auditAction} ${c.req.param('planId')}`,
        payload: { loading_plan_id: c.req.param('planId'), status: nextStatus }
      });
      if (existing.plan_status !== nextStatus) {
        await writeMobileTransition(c.env.DB, c.var.actor, {
          stationId,
          objectType: 'InboundLoadingPlan',
          objectId: c.req.param('planId'),
          stateField: 'plan_status',
          fromValue: existing.plan_status,
          toValue: nextStatus,
          auditId
        });
      }

      return c.json({ data: { loading_plan_id: c.req.param('planId'), ok: true, status: nextStatus, archived: false } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/inbound/loading-plans/:planId');
    }
  });

  app.delete('/api/v1/mobile/inbound/loading-plans/:planId', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const existing = await c.env.DB?.prepare(
        `
          SELECT loading_plan_id, plan_status
          FROM loading_plans
          WHERE station_id = ?
            AND loading_plan_id = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('planId'))
        .first<any>();

      if (!existing) {
        return jsonError(c, 404, 'LOADING_PLAN_NOT_FOUND', 'Loading plan does not exist');
      }

      const deletedAt = isoNow();
      await c.env.DB?.prepare(
        `
          UPDATE loading_plans
          SET plan_status = '已作废',
              deleted_at = ?,
              updated_by = ?,
              updated_at = ?
          WHERE loading_plan_id = ?
        `
      )
        .bind(deletedAt, c.var.actor.userId, deletedAt, c.req.param('planId'))
        .run();

      const auditId = await writeMobileAudit(c.env.DB, c.var.actor, {
        requestId: c.req.header('x-request-id') || undefined,
        action: 'INBOUND_LOADING_PLAN_ARCHIVED',
        objectType: 'InboundLoadingPlan',
        objectId: c.req.param('planId'),
        stationId,
        summary: `Archived inbound loading plan ${c.req.param('planId')}`
      });
      await writeMobileTransition(c.env.DB, c.var.actor, {
        stationId,
        objectType: 'InboundLoadingPlan',
        objectId: c.req.param('planId'),
        stateField: 'plan_status',
        fromValue: existing.plan_status,
        toValue: '已作废',
        auditId
      });

      return c.json({ data: { loading_plan_id: c.req.param('planId'), archived: true } });
    } catch (error) {
      return handleServiceError(c, error, 'DELETE /mobile/inbound/loading-plans/:planId');
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

  app.get('/api/v1/mobile/outbound/:flightNo/options', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const flightNo = c.req.param('flightNo');
      const [receiptStatusOptions, reviewStatusOptions, containerStatusOptions, offloadStatusOptions, awbRows, containerRows] = await Promise.all([
        loadMobileOptionRows(c.env.DB, 'station_mobile_outbound_receipt_status_options', { scope: 'receipt_status' }),
        loadMobileOptionRows(c.env.DB, 'station_mobile_outbound_review_status_options', { scope: 'review_status' }),
        loadMobileOptionRows(c.env.DB, 'station_mobile_outbound_container_status_options', { scope: 'container_status' }),
        loadMobileOptionRows(c.env.DB, 'station_mobile_outbound_offload_status_options', { scope: 'offload_status' }),
        c.env.DB?.prepare(
          `
            SELECT
              a.awb_id AS value,
              a.awb_no AS label,
              a.awb_no,
              COALESCE(a.notify_name, a.consignee_name, f.destination_code) AS destination_code,
              a.deleted_at
            FROM awbs a
            LEFT JOIN flights f ON f.flight_id = a.flight_id
            WHERE a.station_id = ?
              AND f.flight_no = ?
              AND a.deleted_at IS NULL
            ORDER BY a.awb_no ASC
          `
        ).bind(stationId, flightNo).all(),
        c.env.DB?.prepare(
          `
            SELECT container_id AS value, container_code AS label, container_code, container_status, deleted_at
            FROM outbound_containers
            WHERE station_id = ?
              AND flight_no = ?
              AND deleted_at IS NULL
            ORDER BY container_code ASC
          `
        ).bind(stationId, flightNo).all()
      ]);

      return c.json({
        data: {
          station_id: stationId,
          flight_no: flightNo,
          receiptStatusOptions,
          reviewStatusOptions,
          containerStatusOptions,
          offloadStatusOptions,
          awbOptions: ((awbRows?.results || []) as any[]).map((row) => ({
            value: row.value,
            label: row.label,
            disabled: Boolean(row.deleted_at),
            meta: { awb_no: row.awb_no, destination_code: row.destination_code }
          })),
          containerOptions: ((containerRows?.results || []) as any[]).map((row) => ({
            value: row.value,
            label: row.label,
            disabled: Boolean(row.deleted_at),
            meta: { container_code: row.container_code, status: row.container_status }
          }))
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/outbound/:flightNo/options');
    }
  });

  app.get('/api/v1/mobile/options/outbound/:flightNo', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const flightNo = c.req.param('flightNo');
      const [receiptStatusOptions, reviewStatusOptions, containerStatusOptions, offloadStatusOptions, awbRows, containerRows] = await Promise.all([
        loadMobileOptionRows(c.env.DB, 'station_mobile_outbound_receipt_status_options', { scope: 'receipt_status' }),
        loadMobileOptionRows(c.env.DB, 'station_mobile_outbound_review_status_options', { scope: 'review_status' }),
        loadMobileOptionRows(c.env.DB, 'station_mobile_outbound_container_status_options', { scope: 'container_status' }),
        loadMobileOptionRows(c.env.DB, 'station_mobile_outbound_offload_status_options', { scope: 'offload_status' }),
        c.env.DB?.prepare(
          `
            SELECT
              a.awb_id AS value,
              a.awb_no AS label,
              a.awb_no,
              COALESCE(a.notify_name, a.consignee_name, f.destination_code) AS destination_code,
              a.deleted_at
            FROM awbs a
            LEFT JOIN flights f ON f.flight_id = a.flight_id
            WHERE a.station_id = ?
              AND f.flight_no = ?
              AND a.deleted_at IS NULL
            ORDER BY a.awb_no ASC
          `
        ).bind(stationId, flightNo).all(),
        c.env.DB?.prepare(
          `
            SELECT container_id AS value, container_code AS label, container_code, container_status, deleted_at
            FROM outbound_containers
            WHERE station_id = ?
              AND flight_no = ?
              AND deleted_at IS NULL
            ORDER BY container_code ASC
          `
        ).bind(stationId, flightNo).all()
      ]);

      return c.json({
        data: buildMobileUnifiedOptionsPayload(
          'outbound_operations',
          {
            receipt_status_options: receiptStatusOptions,
            review_status_options: reviewStatusOptions,
            container_status_options: containerStatusOptions,
            offload_status_options: offloadStatusOptions,
            awb_options: ((awbRows?.results || []) as any[]).map((row) => ({
              value: row.value,
              label: row.label,
              disabled: Boolean(row.deleted_at),
              meta: { awb_no: row.awb_no, destination_code: row.destination_code }
            })),
            container_options: ((containerRows?.results || []) as any[]).map((row) => ({
              value: row.value,
              label: row.label,
              disabled: Boolean(row.deleted_at),
              meta: { container_code: row.container_code, status: row.container_status }
            }))
          },
          { station_id: stationId, flight_no: flightNo }
        )
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/options/outbound/:flightNo');
    }
  });

  app.get('/api/v1/mobile/outbound/:flightNo/receipts', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const flightNo = c.req.param('flightNo');
      const includeArchived = c.req.query('include_archived') === 'true';
      const page = Math.max(1, Number(c.req.query('page') || '1'));
      const pageSize = Math.min(100, Math.max(1, Number(c.req.query('page_size') || '20')));
      const offset = (page - 1) * pageSize;
      const whereClause = includeArchived
        ? 'station_id = ? AND flight_no = ?'
        : 'station_id = ? AND flight_no = ? AND deleted_at IS NULL';
      const params = [stationId, flightNo];
      const [totalRow, rows] = await Promise.all([
        c.env.DB?.prepare(`SELECT COUNT(*) AS total FROM outbound_receipts WHERE ${whereClause}`).bind(...params).first<{ total: number }>(),
        c.env.DB?.prepare(
          `
            SELECT receipt_record_id, awb_no, received_pieces, received_weight, receipt_status, review_status, reviewed_weight, reviewed_at, note, deleted_at, created_at, updated_at
            FROM outbound_receipts
            WHERE ${whereClause}
            ORDER BY awb_no ASC
            LIMIT ? OFFSET ?
          `
        ).bind(...params, pageSize, offset).all()
      ]);

      const items = ((rows?.results || []) as any[]).map((row) => mapMobileOutboundReceiptItem(row, flightNo));
      return c.json({
        data: {
          station_id: stationId,
          flight_no: flightNo,
          items,
          receipts: Object.fromEntries(items.map((item: any) => [item.awb, item])),
          page,
          page_size: pageSize,
          total: Number(totalRow?.total || 0)
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/outbound/:flightNo/receipts');
    }
  });

  app.post('/api/v1/mobile/outbound/:flightNo/receipts/:awbNo', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const flightNo = c.req.param('flightNo');
      const awbNo = c.req.param('awbNo');
      const body = await c.req.json();
      const now = isoNow();
      const status = body.status || body.receipt_status || '已收货';
      const reviewStatus = body.review_status || body.reviewStatus || (status === '已复核' ? '已复核' : '待复核');
      const existing = await c.env.DB?.prepare(
        `
          SELECT receipt_record_id, deleted_at
          FROM outbound_receipts
          WHERE station_id = ?
            AND flight_no = ?
            AND awb_no = ?
          LIMIT 1
        `
      ).bind(stationId, flightNo, awbNo).first<{ receipt_record_id: string; deleted_at: string | null }>();

      if (existing?.deleted_at) {
        return jsonError(c, 409, 'RECEIPT_ARCHIVED', 'Archived receipt must be restored before write');
      }

      const receiptId = existing?.receipt_record_id || `REC-${flightNo}-${awbNo}`.replace(/[^A-Za-z0-9-]/g, '');
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
            review_status,
            reviewed_weight,
            reviewed_at,
            note,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, awb_no) DO UPDATE SET
            received_pieces = excluded.received_pieces,
            received_weight = excluded.received_weight,
            receipt_status = excluded.receipt_status,
            review_status = excluded.review_status,
            reviewed_weight = excluded.reviewed_weight,
            reviewed_at = excluded.reviewed_at,
            note = excluded.note,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
        .bind(
          receiptId,
          stationId,
          flightNo,
          awbNo,
          body.received_pieces ?? body.receivedPieces ?? 0,
          body.received_weight ?? body.receivedWeight ?? 0,
          status,
          reviewStatus,
          body.reviewed_weight ?? body.reviewedWeight ?? body.received_weight ?? body.receivedWeight ?? 0,
          body.reviewed_at ?? body.reviewedAt ?? (reviewStatus === '已复核' ? now : null),
          body.note ?? null,
          c.var.actor.userId,
          now,
          now
        )
        .run();

      await writeMobileAuditEvent(c.env.DB, c.var.actor, {
        action: existing ? 'MOBILE_OUTBOUND_RECEIPT_UPDATED' : 'MOBILE_OUTBOUND_RECEIPT_CREATED',
        objectType: 'OutboundReceipt',
        objectId: receiptId,
        stationId,
        summary: existing ? `Outbound receipt ${awbNo} updated` : `Outbound receipt ${awbNo} created`,
        payload: { flight_no: flightNo, awb_no: awbNo, receipt_status: status, review_status: reviewStatus }
      });

      return c.json({ data: { receipt_id: receiptId, awb_no: awbNo, ok: true } }, existing ? 200 : 201);
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/outbound/:flightNo/receipts/:awbNo');
    }
  });

  app.patch('/api/v1/mobile/outbound/:flightNo/receipts/:awbNo', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const flightNo = c.req.param('flightNo');
      const awbNo = c.req.param('awbNo');
      const body = await c.req.json();
      const row = await c.env.DB?.prepare(
        `
          SELECT receipt_record_id, received_pieces, received_weight, receipt_status, review_status, reviewed_weight, reviewed_at, note, deleted_at
          FROM outbound_receipts
          WHERE station_id = ?
            AND flight_no = ?
            AND awb_no = ?
          LIMIT 1
        `
      ).bind(stationId, flightNo, awbNo).first<any>();

      if (!row) {
        return jsonError(c, 404, 'RECEIPT_NOT_FOUND', 'Outbound receipt does not exist');
      }

      const archivedFlag = normalizeBooleanFlag(body.archived);
      const reopen = normalizeBooleanFlag(body.reopen) === true;
      if (row.deleted_at && archivedFlag !== false) {
        return jsonError(c, 409, 'RECEIPT_ARCHIVED', 'Archived receipt must be restored before write');
      }

      const nextArchived = archivedFlag === null ? Boolean(row.deleted_at) : archivedFlag;
      let nextStatus = body.status ?? body.receipt_status ?? row.receipt_status;
      let nextReviewStatus = body.review_status ?? body.reviewStatus ?? row.review_status;
      let nextReviewedWeight = body.reviewed_weight ?? body.reviewedWeight ?? row.reviewed_weight;
      let nextReviewedAt = body.reviewed_at ?? body.reviewedAt ?? row.reviewed_at;
      let nextReceivedPieces = body.received_pieces ?? body.receivedPieces ?? row.received_pieces;
      let nextReceivedWeight = body.received_weight ?? body.receivedWeight ?? row.received_weight;

      if (reopen) {
        nextStatus = '待收货';
        nextReviewStatus = '待复核';
        nextReviewedWeight = 0;
        nextReviewedAt = null;
      } else if (row.receipt_status === '已复核' && (body.received_pieces !== undefined || body.receivedPieces !== undefined || body.received_weight !== undefined || body.receivedWeight !== undefined)) {
        return jsonError(c, 409, 'RECEIPT_LOCKED', 'Reviewed receipt must be reopened before quantity or weight changes');
      }

      if (nextReviewStatus === '已复核') {
        nextStatus = '已复核';
        nextReviewedAt = nextReviewedAt || isoNow();
      }

      await c.env.DB?.prepare(
        `
          UPDATE outbound_receipts
          SET received_pieces = ?,
              received_weight = ?,
              receipt_status = ?,
              review_status = ?,
              reviewed_weight = ?,
              reviewed_at = ?,
              note = COALESCE(?, note),
              deleted_at = ?,
              updated_by = ?,
              updated_at = ?
          WHERE receipt_record_id = ?
        `
      )
        .bind(
          nextReceivedPieces,
          nextReceivedWeight,
          nextStatus,
          nextReviewStatus,
          nextReviewedWeight,
          nextReviewedAt,
          body.note ?? null,
          nextArchived ? isoNow() : null,
          c.var.actor.userId,
          isoNow(),
          row.receipt_record_id
        )
        .run();

      await writeMobileAuditEvent(c.env.DB, c.var.actor, {
        action: reopen
          ? 'MOBILE_OUTBOUND_RECEIPT_REOPENED'
          : archivedFlag === true
            ? 'MOBILE_OUTBOUND_RECEIPT_ARCHIVED'
            : archivedFlag === false && row.deleted_at
              ? 'MOBILE_OUTBOUND_RECEIPT_RESTORED'
              : 'MOBILE_OUTBOUND_RECEIPT_UPDATED',
        objectType: 'OutboundReceipt',
        objectId: row.receipt_record_id,
        stationId,
        summary: reopen
          ? `Outbound receipt ${awbNo} reopened`
          : archivedFlag === true
            ? `Outbound receipt ${awbNo} archived`
            : archivedFlag === false && row.deleted_at
              ? `Outbound receipt ${awbNo} restored`
              : `Outbound receipt ${awbNo} updated`,
        payload: { flight_no: flightNo, awb_no: awbNo, receipt_status: nextStatus, review_status: nextReviewStatus, archived: nextArchived }
      });
      await writeMobileStateTransition(c.env.DB, c.var.actor, {
        objectType: 'OutboundReceipt',
        objectId: row.receipt_record_id,
        stationId,
        stateField: 'receipt_status',
        fromValue: row.receipt_status,
        toValue: nextStatus,
        summary: `Outbound receipt ${awbNo} status updated`
      });
      await writeMobileStateTransition(c.env.DB, c.var.actor, {
        objectType: 'OutboundReceipt',
        objectId: row.receipt_record_id,
        stationId,
        stateField: 'review_status',
        fromValue: row.review_status,
        toValue: nextReviewStatus,
        summary: `Outbound receipt ${awbNo} review status updated`
      });
      await writeMobileStateTransition(c.env.DB, c.var.actor, {
        objectType: 'OutboundReceipt',
        objectId: row.receipt_record_id,
        stationId,
        stateField: 'archived',
        fromValue: row.deleted_at ? 'true' : 'false',
        toValue: nextArchived ? 'true' : 'false',
        summary: `Outbound receipt ${awbNo} archive state updated`
      });

      return c.json({ data: { receipt_id: row.receipt_record_id, awb_no: awbNo, ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/outbound/:flightNo/receipts/:awbNo');
    }
  });

  app.delete('/api/v1/mobile/outbound/:flightNo/receipts/:awbNo', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const archived = normalizeBooleanFlag(body.archived);
      const targetArchived = archived === false ? false : true;
      const query = new URL(c.req.url);
      const stationId = resolveScopedStation(c.var.actor, query.searchParams.get('station_id') || undefined);
      const flightNo = c.req.param('flightNo');
      const awbNo = c.req.param('awbNo');
      const row = await c.env.DB?.prepare(
        `
          SELECT receipt_record_id, deleted_at
          FROM outbound_receipts
          WHERE station_id = ?
            AND flight_no = ?
            AND awb_no = ?
          LIMIT 1
        `
      ).bind(stationId, flightNo, awbNo).first<any>();
      if (!row) {
        return jsonError(c, 404, 'RECEIPT_NOT_FOUND', 'Outbound receipt does not exist');
      }

      await c.env.DB?.prepare(
        `UPDATE outbound_receipts SET deleted_at = ?, updated_by = ?, updated_at = ? WHERE receipt_record_id = ?`
      )
        .bind(targetArchived ? isoNow() : null, c.var.actor.userId, isoNow(), row.receipt_record_id)
        .run();

      await writeMobileAuditEvent(c.env.DB, c.var.actor, {
        action: targetArchived ? 'MOBILE_OUTBOUND_RECEIPT_ARCHIVED' : 'MOBILE_OUTBOUND_RECEIPT_RESTORED',
        objectType: 'OutboundReceipt',
        objectId: row.receipt_record_id,
        stationId,
        summary: targetArchived ? `Outbound receipt ${awbNo} archived` : `Outbound receipt ${awbNo} restored`,
        payload: { flight_no: flightNo, awb_no: awbNo, archived: targetArchived }
      });
      await writeMobileStateTransition(c.env.DB, c.var.actor, {
        objectType: 'OutboundReceipt',
        objectId: row.receipt_record_id,
        stationId,
        stateField: 'archived',
        fromValue: row.deleted_at ? 'true' : 'false',
        toValue: targetArchived ? 'true' : 'false',
        summary: `Outbound receipt ${awbNo} archive state updated`
      });

      return c.json({ data: { receipt_id: row.receipt_record_id, awb_no: awbNo, archived: targetArchived } });
    } catch (error) {
      return handleServiceError(c, error, 'DELETE /mobile/outbound/:flightNo/receipts/:awbNo');
    }
  });

  app.get('/api/v1/mobile/outbound/:flightNo/containers', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const flightNo = c.req.param('flightNo');
      const includeArchived = c.req.query('include_archived') === 'true';
      const page = Math.max(1, Number(c.req.query('page') || '1'));
      const pageSize = Math.min(100, Math.max(1, Number(c.req.query('page_size') || '20')));
      const offset = (page - 1) * pageSize;
      const whereClause = includeArchived
        ? 'station_id = ? AND flight_no = ?'
        : 'station_id = ? AND flight_no = ? AND deleted_at IS NULL';
      const params = [stationId, flightNo];
      const [totalRow, rows] = await Promise.all([
        c.env.DB?.prepare(`SELECT COUNT(*) AS total FROM outbound_containers WHERE ${whereClause}`).bind(...params).first<{ total: number }>(),
        c.env.DB?.prepare(
          `
            SELECT container_id, container_code, total_boxes, total_weight, reviewed_weight, container_status, loaded_at, note, offload_boxes, offload_status, offload_recorded_at, deleted_at
            FROM outbound_containers
            WHERE ${whereClause}
            ORDER BY container_code ASC
            LIMIT ? OFFSET ?
          `
        ).bind(...params, pageSize, offset).all()
      ]);

      const items = await Promise.all(
        ((rows?.results || []) as any[]).map(async (row: any) => {
          const containerItems = await c.env.DB?.prepare(
            `
              SELECT awb_no, pieces, boxes, weight
              FROM outbound_container_items
              WHERE container_id = ?
              ORDER BY awb_no ASC
            `
          ).bind(row.container_id).all();
          return mapMobileOutboundContainerItem(row, containerItems?.results || [], flightNo);
        })
      );

      return c.json({
        data: {
          station_id: stationId,
          flight_no: flightNo,
          items,
          containers: items,
          page,
          page_size: pageSize,
          total: Number(totalRow?.total || 0)
        }
      });
    } catch (error) {
      return handleServiceError(c, error, 'GET /mobile/outbound/:flightNo/containers');
    }
  });

  app.post('/api/v1/mobile/outbound/:flightNo/containers', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const flightNo = c.req.param('flightNo');
      const body = await c.req.json();
      const containerCode = body.container_code || body.boardCode;
      const existing = await c.env.DB?.prepare(
        `
          SELECT container_id, deleted_at
          FROM outbound_containers
          WHERE station_id = ?
            AND flight_no = ?
            AND container_code = ?
          LIMIT 1
        `
      )
        .bind(stationId, flightNo, containerCode)
        .first<{ container_id: string; deleted_at: string | null }>();

      if (existing?.deleted_at) {
        return jsonError(c, 409, 'CONTAINER_ARCHIVED', 'Archived container must be restored before write');
      }

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
            offload_boxes,
            offload_status,
            offload_recorded_at,
            updated_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, flight_no, container_code) DO UPDATE SET
            total_boxes = excluded.total_boxes,
            total_weight = excluded.total_weight,
            reviewed_weight = excluded.reviewed_weight,
            container_status = excluded.container_status,
            loaded_at = excluded.loaded_at,
            note = excluded.note,
            offload_boxes = excluded.offload_boxes,
            offload_status = excluded.offload_status,
            offload_recorded_at = excluded.offload_recorded_at,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `
      )
        .bind(
          containerId,
          stationId,
          flightNo,
          containerCode,
          body.total_boxes ?? body.totalBoxes ?? 0,
          body.total_weight ?? body.totalWeightKg ?? 0,
          body.reviewed_weight ?? body.reviewedWeightKg ?? 0,
          body.status || body.container_status || '待装机',
          body.loaded_at || body.loadedAt || null,
          body.note ?? null,
          body.offload_boxes ?? body.offloadBoxes ?? 0,
          body.offload_status ?? body.offloadStatus ?? '无拉货',
          body.offload_recorded_at ?? body.offloadRecordedAt ?? null,
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

      await writeMobileAuditEvent(c.env.DB, c.var.actor, {
        action: existing ? 'MOBILE_OUTBOUND_CONTAINER_UPDATED' : 'MOBILE_OUTBOUND_CONTAINER_CREATED',
        objectType: 'OutboundContainer',
        objectId: containerId,
        stationId,
        summary: existing ? `Outbound container ${containerCode} updated` : `Outbound container ${containerCode} created`,
        payload: { flight_no: flightNo, container_code: containerCode, container_status: body.status || body.container_status || '待装机' }
      });

      return c.json({ data: { container_id: containerId } }, existing ? 200 : 201);
    } catch (error) {
      return handleServiceError(c, error, 'POST /mobile/outbound/:flightNo/containers');
    }
  });

  app.patch('/api/v1/mobile/outbound/containers/:containerCode', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const body = await c.req.json();
      const row = await c.env.DB?.prepare(
        `
          SELECT container_id, flight_no, total_boxes, total_weight, reviewed_weight, container_status, loaded_at, note, offload_boxes, offload_status, offload_recorded_at, deleted_at
          FROM outbound_containers
          WHERE station_id = ?
            AND container_code = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('containerCode'))
        .first<any>();

      if (!row) {
        return jsonError(c, 404, 'CONTAINER_NOT_FOUND', 'Outbound container does not exist');
      }

      const archivedFlag = normalizeBooleanFlag(body.archived);
      const reopen = normalizeBooleanFlag(body.reopen) === true;
      if (row.deleted_at && archivedFlag !== false) {
        return jsonError(c, 409, 'CONTAINER_ARCHIVED', 'Archived container must be restored before write');
      }

      const entriesProvided = Array.isArray(body.entries);
      if (!reopen && row.container_status === '已装机' && (entriesProvided || body.total_boxes !== undefined || body.totalBoxes !== undefined || body.total_weight !== undefined || body.totalWeightKg !== undefined)) {
        return jsonError(c, 409, 'CONTAINER_LOCKED', 'Loaded container must be reopened before cargo changes');
      }

      let nextStatus = body.status ?? body.container_status ?? row.container_status;
      let nextLoadedAt = body.loaded_at ?? body.loadedAt ?? row.loaded_at;
      let nextOffloadBoxes = body.offload_boxes ?? body.offloadBoxes ?? row.offload_boxes;
      let nextOffloadStatus = body.offload_status ?? body.offloadStatus ?? row.offload_status;
      let nextOffloadRecordedAt = body.offload_recorded_at ?? body.offloadRecordedAt ?? row.offload_recorded_at;
      const nextArchived = archivedFlag === null ? Boolean(row.deleted_at) : archivedFlag;

      if (reopen) {
        nextStatus = '待装机';
        nextLoadedAt = null;
        nextOffloadBoxes = 0;
        nextOffloadStatus = '无拉货';
        nextOffloadRecordedAt = null;
      }

      if (Number(nextOffloadBoxes || 0) > 0) {
        if (nextStatus !== '已装机' && !reopen) {
          return jsonError(c, 409, 'CONTAINER_NOT_LOADED', 'Offload can only be recorded after loading');
        }
        nextOffloadStatus = '已拉货';
        nextOffloadRecordedAt = nextOffloadRecordedAt || isoNow();
      }

      const nextTotalBoxes = body.total_boxes ?? body.totalBoxes ?? row.total_boxes;
      const nextTotalWeight = body.total_weight ?? body.totalWeightKg ?? row.total_weight;
      const nextReviewedWeight = body.reviewed_weight ?? body.reviewedWeightKg ?? row.reviewed_weight;
      const nextNote = body.note ?? row.note;

      await c.env.DB?.prepare(
        `
          UPDATE outbound_containers
          SET total_boxes = ?,
              total_weight = ?,
              reviewed_weight = ?,
              container_status = ?,
              loaded_at = ?,
              note = ?,
              offload_boxes = ?,
              offload_status = ?,
              offload_recorded_at = ?,
              deleted_at = ?,
              updated_by = ?,
              updated_at = ?
          WHERE container_id = ?
        `
      )
        .bind(
          nextTotalBoxes,
          nextTotalWeight,
          nextReviewedWeight,
          nextStatus,
          nextLoadedAt,
          nextNote,
          nextOffloadBoxes,
          nextOffloadStatus,
          nextOffloadRecordedAt,
          nextArchived ? isoNow() : null,
          c.var.actor.userId,
          isoNow(),
          row.container_id
        )
        .run();

      if (entriesProvided) {
        await c.env.DB?.prepare(`DELETE FROM outbound_container_items WHERE container_id = ?`).bind(row.container_id).run();
        for (const entry of body.entries) {
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
            .bind(createId('ULI'), row.container_id, entry.awb || entry.awb_no, entry.pieces ?? 0, entry.boxes ?? 0, entry.weight ?? 0, isoNow(), isoNow())
            .run();
        }
      }

      await writeMobileAuditEvent(c.env.DB, c.var.actor, {
        action: reopen
          ? 'MOBILE_OUTBOUND_CONTAINER_REOPENED'
          : archivedFlag === true
            ? 'MOBILE_OUTBOUND_CONTAINER_ARCHIVED'
            : archivedFlag === false && row.deleted_at
              ? 'MOBILE_OUTBOUND_CONTAINER_RESTORED'
              : 'MOBILE_OUTBOUND_CONTAINER_UPDATED',
        objectType: 'OutboundContainer',
        objectId: row.container_id,
        stationId,
        summary: reopen
          ? `Outbound container ${c.req.param('containerCode')} reopened`
          : archivedFlag === true
            ? `Outbound container ${c.req.param('containerCode')} archived`
            : archivedFlag === false && row.deleted_at
              ? `Outbound container ${c.req.param('containerCode')} restored`
              : `Outbound container ${c.req.param('containerCode')} updated`,
        payload: { container_code: c.req.param('containerCode'), flight_no: row.flight_no, container_status: nextStatus, archived: nextArchived }
      });
      await writeMobileStateTransition(c.env.DB, c.var.actor, {
        objectType: 'OutboundContainer',
        objectId: row.container_id,
        stationId,
        stateField: 'container_status',
        fromValue: row.container_status,
        toValue: nextStatus,
        summary: `Outbound container ${c.req.param('containerCode')} status updated`
      });
      await writeMobileStateTransition(c.env.DB, c.var.actor, {
        objectType: 'OutboundContainer',
        objectId: row.container_id,
        stationId,
        stateField: 'offload_status',
        fromValue: row.offload_status,
        toValue: nextOffloadStatus,
        summary: `Outbound container ${c.req.param('containerCode')} offload status updated`
      });
      await writeMobileStateTransition(c.env.DB, c.var.actor, {
        objectType: 'OutboundContainer',
        objectId: row.container_id,
        stationId,
        stateField: 'archived',
        fromValue: row.deleted_at ? 'true' : 'false',
        toValue: nextArchived ? 'true' : 'false',
        summary: `Outbound container ${c.req.param('containerCode')} archive state updated`
      });

      return c.json({ data: { container_code: c.req.param('containerCode'), ok: true } });
    } catch (error) {
      return handleServiceError(c, error, 'PATCH /mobile/outbound/containers/:containerCode');
    }
  });

  app.delete('/api/v1/mobile/outbound/containers/:containerCode', requireRoles(['mobile_operator', 'station_supervisor', 'inbound_operator']), async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const archived = normalizeBooleanFlag(body.archived);
      const targetArchived = archived === false ? false : true;
      const stationId = resolveScopedStation(c.var.actor, c.req.query('station_id'));
      const row = await c.env.DB?.prepare(
        `
          SELECT container_id, flight_no, deleted_at
          FROM outbound_containers
          WHERE station_id = ?
            AND container_code = ?
          LIMIT 1
        `
      )
        .bind(stationId, c.req.param('containerCode'))
        .first<any>();
      if (!row) {
        return jsonError(c, 404, 'CONTAINER_NOT_FOUND', 'Outbound container does not exist');
      }

      await c.env.DB?.prepare(`UPDATE outbound_containers SET deleted_at = ?, updated_by = ?, updated_at = ? WHERE container_id = ?`)
        .bind(targetArchived ? isoNow() : null, c.var.actor.userId, isoNow(), row.container_id)
        .run();

      await writeMobileAuditEvent(c.env.DB, c.var.actor, {
        action: targetArchived ? 'MOBILE_OUTBOUND_CONTAINER_ARCHIVED' : 'MOBILE_OUTBOUND_CONTAINER_RESTORED',
        objectType: 'OutboundContainer',
        objectId: row.container_id,
        stationId,
        summary: targetArchived ? `Outbound container ${c.req.param('containerCode')} archived` : `Outbound container ${c.req.param('containerCode')} restored`,
        payload: { container_code: c.req.param('containerCode'), flight_no: row.flight_no, archived: targetArchived }
      });
      await writeMobileStateTransition(c.env.DB, c.var.actor, {
        objectType: 'OutboundContainer',
        objectId: row.container_id,
        stationId,
        stateField: 'archived',
        fromValue: row.deleted_at ? 'true' : 'false',
        toValue: targetArchived ? 'true' : 'false',
        summary: `Outbound container ${c.req.param('containerCode')} archive state updated`
      });

      return c.json({ data: { container_id: row.container_id, archived: targetArchived } });
    } catch (error) {
      return handleServiceError(c, error, 'DELETE /mobile/outbound/containers/:containerCode');
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
