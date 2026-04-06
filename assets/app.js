const airportNetwork = [
  {
    code: "URC",
    region: "中国西部",
    label: "集货与出港前置节点",
    control: "L1 强控制",
    phase: "一期优先",
    note: "承接中国集货仓、前置履约与西向链路起点，负责把业务预报转成业务真相。"
  },
  {
    code: "KGF",
    region: "中亚",
    label: "协同中转节点",
    control: "L2 协同控制",
    phase: "网络扩展",
    note: "作为中亚方向协同站点，重点接入统一字段、统一 SLA 与异常回传。"
  },
  {
    code: "NVI",
    region: "中亚",
    label: "在途与进港衔接节点",
    control: "L2 协同控制",
    phase: "网络扩展",
    note: "承担在途中转与进港衔接，要求飞行状态、到港准备与卡车计划提前联动。"
  },
  {
    code: "RZE",
    region: "欧洲",
    label: "东欧入口节点",
    control: "L2 协同控制",
    phase: "试点规划",
    note: "重点服务东欧方向进港履约与交付分拨，确保异常结构化和责任链可追。"
  },
  {
    code: "MST",
    region: "欧洲",
    label: "欧陆分拨节点",
    control: "L2 协同控制",
    phase: "试点规划",
    note: "负责欧洲干线与交付分拨联动，适合作为区域网络协同站点。"
  },
  {
    code: "BoH",
    region: "英国",
    label: "英国区域节点",
    control: "L3 接口可视",
    phase: "接口先行",
    note: "先纳入末端与交付回传视野，后续按业务量决定是否加深现场控制。"
  },
  {
    code: "MME",
    region: "英国",
    label: "进港样板站",
    control: "L1 强控制",
    phase: "样板优先",
    note: "现有 SOP 最成熟，适合作为进港节点状态机、硬门槛与 KPI 模板的第一站。"
  }
];

const chainSections = [
  {
    step: "01",
    title: "中国集货仓",
    copy: "下单、预约、收货、核件核重、标签与单证校验、异常隔离、打板打托。",
    tags: ["订单", "履约单元", "仓库", "异常"]
  },
  {
    step: "02",
    title: "出港机场履约",
    copy: "交接、入仓、放行、组板、装机前复核、装机与关舱，形成出港真实台账。",
    tags: ["机场交接", "放行", "ULD", "装机前复核"]
  },
  {
    step: "03",
    title: "飞行在途",
    copy: "接入离场、起飞、预计到达、延误、备降、落地等事件，消灭飞行黑箱。",
    tags: ["航班", "预计到达", "延误", "事件"]
  },
  {
    step: "04",
    title: "进港机场履约",
    copy: "拆板、逐箱 AWB 核对、分区、卡车分配、二次复核、装车、POD 双签。",
    tags: ["AWB", "卡车", "POD", "二次复核"]
  },
  {
    step: "05",
    title: "客户签收 / 最后一公里",
    copy: "干线卡车、客户仓签收、第三方派送、妥投或失败原因回传，闭环承诺兑现。",
    tags: ["交付", "承运商", "签收", "失败原因码"]
  }
];

const platformModules = [
  {
    title: "货站网络治理",
    copy: "维护区域、机场代码、控制深度、服务能力和站点负责人，支撑平台新增不同地区货站。"
  },
  {
    title: "主数据与主键体系",
    copy: "统一订单、履约单元、AWB、卡车、航班、POD、合同、事件的归属和引用规则。"
  },
  {
    title: "规则与 SLA 中心",
    copy: "维护 P1/P2/P3 服务等级、节点硬门槛、异常字典、预警阈值和升级路径。"
  },
  {
    title: "接口治理",
    copy: "追踪 ERP、供应链系统、航班状态、末端回传和 POD 接口接入状态与质量。"
  },
  {
    title: "可信层预留",
    copy: "检查事件哈希、签名引用、存证引用等字段的预留完整性。"
  },
  {
    title: "试点推进",
    copy: "以 MME 作为样板站沉淀 SOP 和 KPI 模板，再复制到其他进港与协同站点。"
  }
];

const platformObjects = [
  "订单 ID / 订单",
  "履约单元 ID / 履约单元",
  "AWB / HAWB",
  "ULD / PMC ID",
  "卡车 ID / 车辆",
  "航班 ID / 航班",
  "POD ID / 签收",
  "交付 ID / 交付",
  "合同 ID / 合同",
  "事件 ID / 事件哈希"
];

const stationProfiles = {
  MME: {
    title: "MME 货站管理员看板",
    subtitle: "样板站：直接把既有 SOP 转成节点状态机与硬门槛控制",
    metrics: [
      { label: "今日进港航班", value: "06" },
      { label: "12 小时完成率", value: "96.4%" },
      { label: "装车准确率", value: "100%" },
      { label: "POD 闭环率", value: "98.8%" }
    ],
    flights: [
      ["SZP-208", "已落地", "19:05", "P1", "拆板中"],
      ["SNP-114", "二次复核", "19:20", "P1", "待装车"],
      ["SNP-082", "已分配卡车", "20:10", "P2", "车已到场"],
      ["SNP-075", "POD 已签收", "18:45", "P2", "已闭环"]
    ],
    nodeStates: [
      { title: "已落地", owner: "站点主管", progress: 100, note: "航班落地即开启进港 KPI 计时。" },
      { title: "ULD 拆板", owner: "拆板组", progress: 92, note: "PMC 与组板清单逐项核对，异常直接留痕。" },
      { title: "AWB 已核对", owner: "核对员", progress: 86, note: "逐箱核对 AWB，相同提单号必须同托。" },
      { title: "已分配卡车", owner: "车队协调", progress: 79, note: "提前形成车货关系，减少现场临时判断。" },
      { title: "二次复核", owner: "独立复核人", progress: 74, note: "未复核不得装车，是进港段硬门槛。" },
      { title: "POD 已签收", owner: "交接双方", progress: 61, note: "POD 未闭环不得关单，也是权责基础。" }
    ],
    priorities: [
      { title: "P1 紧急履约", meta: "12 票", note: "仓、港、车三个环节强优先级处理。" },
      { title: "P2 标准履约", meta: "34 票", note: "按标准流程推进并进入全链路 KPI。" },
      { title: "数量异常", meta: "2 起", note: "均已挂接责任主体与整改动作。" },
      { title: "时效预警", meta: "1 起", note: "ETA 偏差触发卡车计划重排。" }
    ],
    tasks: [
      { title: "装车会话管理", copy: "登记叉车司机、核对员、车牌、托盘数，保留双人操作记录。" },
      { title: "POD 双签闭环", copy: "按车辆批次检查签字双方、时间戳和文件编号。" },
      { title: "周报输出", copy: "从事件流派生站点周报，不手工拼凑零散报表。" },
      { title: "异常复盘", copy: "按数量、标签、板位、时效、运输、质量六类统一归档。" }
    ]
  },
  URC: {
    title: "URC 货站管理员看板",
    subtitle: "集货仓与出港前置样板：把预报订单转成真实履约单元",
    metrics: [
      { label: "今日预约入仓", value: "21" },
      { label: "收货准时率", value: "94.2%" },
      { label: "标签校验通过", value: "97.9%" },
      { label: "异常隔离闭环", value: "93.1%" }
    ],
    flights: [
      ["URC-341", "仓内已收货", "15:30", "P1", "待打托"],
      ["URC-352", "已装车", "16:10", "P2", "发往出港站"],
      ["URC-366", "机场已交接", "17:00", "P1", "已交接"],
      ["URC-377", "放行完成", "17:30", "P2", "待装机"]
    ],
    nodeStates: [
      { title: "订单已确认", owner: "客户协调", progress: 100, note: "订单必须回连客户与合同。" },
      { title: "仓库预约", owner: "仓控", progress: 94, note: "预约失控会直接影响机场段资源。" },
      { title: "枢纽已收货", owner: "收货员", progress: 88, note: "实际件重体将预报变成业务真相。" },
      { title: "标签 / 单证已校验", owner: "单证岗", progress: 83, note: "不合格货件必须先隔离。" },
      { title: "已装车", owner: "发运协调", progress: 76, note: "形成仓到机场的物理交接链。" },
      { title: "已到达出港机场", owner: "机场协同", progress: 64, note: "仓段与机场段正式衔接。" }
    ],
    priorities: [
      { title: "P1 高时效货", meta: "7 票", note: "强制优先打托与发车。" },
      { title: "P2 标准货", meta: "28 票", note: "按预约与资源节奏推进。" },
      { title: "标签异常", meta: "3 起", note: "已进入结构化整改状态。" },
      { title: "单证缺失", meta: "1 起", note: "阻断下一节点流转。" }
    ],
    tasks: [
      { title: "入仓预约波次", copy: "按服务等级安排到仓时窗，避免前置拥堵。" },
      { title: "标签与单证复核", copy: "把异常直接编码，而不是靠聊天截图传递。" },
      { title: "打托计划", copy: "提前绑定板位、车辆、目的站和封签信息。" },
      { title: "出港交接", copy: "交接未确认不得进入机场内流程。" }
    ]
  },
  KGF: {
    title: "KGF 货站管理员看板",
    subtitle: "协同中转站：以统一 SLA 和状态回传接入网络",
    metrics: [
      { label: "中转批次", value: "14" },
      { label: "状态回传率", value: "91.8%" },
      { label: "异常响应时效", value: "18 分钟" },
      { label: "接口可见率", value: "95.0%" }
    ],
    flights: [
      ["KGF-101", "在途中", "13:40", "P2", "等待 ETA 更新"],
      ["KGF-119", "已落地", "14:05", "P1", "待分流"],
      ["KGF-122", "已分配卡车", "14:30", "P2", "车已排定"],
      ["KGF-126", "交付完成", "15:10", "P2", "已回传"]
    ],
    nodeStates: [
      { title: "航班事件同步", owner: "接口管理员", progress: 91, note: "先保证事件稳定回传，再加深控制。" },
      { title: "中转分流", owner: "站点协调", progress: 82, note: "中转逻辑按服务等级分配资源。" },
      { title: "卡车分配", owner: "车队协调", progress: 76, note: "中转卡车必须纳入统一调度。" },
      { title: "异常路由", owner: "异常岗", progress: 72, note: "任何晚点和改配都需结构化归因。" },
      { title: "POD 同步", owner: "交付接口", progress: 68, note: "以结果回传保障责任链完整。" },
      { title: "审计链", owner: "站点管理员", progress: 63, note: "协同站点也必须保留关键审计链。" }
    ],
    priorities: [
      { title: "P1 中转时效", meta: "5 票", note: "优先保障转运窗口。" },
      { title: "P2 网络协同", meta: "18 票", note: "以 SLA 驱动上下游衔接。" },
      { title: "ETA 变更", meta: "2 起", note: "已触发后续卡车重排。" },
      { title: "接口重试", meta: "1 起", note: "状态源已切到备援。 " }
    ],
    tasks: [
      { title: "接口状态巡检", copy: "优先监控航班状态和 POD 回传完整性。" },
      { title: "中转车队协同", copy: "统一车辆、线路、收发时间字段。" },
      { title: "服务等级落地", copy: "把 P1/P2 映射到作业优先级。" },
      { title: "异常闭环", copy: "保证协同站点也能回到统一责任链。" }
    ]
  },
  NVI: {
    title: "NVI 货站管理员看板",
    subtitle: "在途中转与进港衔接站：让 ETA 与落地准备提前联动",
    metrics: [
      { label: "ETA 更新及时率", value: "93.6%" },
      { label: "落地准备完成", value: "88.0%" },
      { label: "中转衔接成功", value: "95.4%" },
      { label: "异常闭环时长", value: "42 分钟" }
    ],
    flights: [
      ["NVI-210", "ETA 已更新", "12:30", "P1", "提前 25 分钟"],
      ["NVI-225", "已落地", "13:05", "P2", "待拆板"],
      ["NVI-240", "已完成分区", "13:50", "P2", "已分区"],
      ["NVI-248", "干线已发车", "14:25", "P2", "已发车"]
    ],
    nodeStates: [
      { title: "ETA 预警", owner: "航班监控", progress: 94, note: "ETA 变更必须立即进入预警看板。" },
      { title: "到港预准备", owner: "站点主管", progress: 87, note: "落地前完成人员与车位准备。" },
      { title: "拆板与核对", owner: "拆板核对", progress: 81, note: "落地后快速进入逐箱核对。" },
      { title: "分区分配", owner: "分区协调", progress: 78, note: "同一 AWB 必须同区域，不得混放。" },
      { title: "卡车调度", owner: "车队协调", progress: 73, note: "车货关系尽早形成。" },
      { title: "签收回传", owner: "交付岗", progress: 65, note: "交付结果回传要保持完整。" }
    ],
    priorities: [
      { title: "P1 ETA 异动", meta: "3 起", note: "全部进入预警与排班调整。" },
      { title: "P2 到港任务", meta: "19 票", note: "按落地窗口组织资源。" },
      { title: "区域分区异常", meta: "1 起", note: "已重新划区处理。" },
      { title: "车辆等待", meta: "2 次", note: "正在优化排班衔接。" }
    ],
    tasks: [
      { title: "落地前预准备", copy: "把地面资源准备前置到“已落地”之前。" },
      { title: "分区与卡车联动", copy: "让分区结果直接驱动车辆计划。" },
      { title: "异常升级", copy: "备降或延误直接触发后续节点重排。" },
      { title: "结果回传", copy: "保持进港到交付的状态链闭环。" }
    ]
  },
  RZE: {
    title: "RZE 货站管理员看板",
    subtitle: "东欧入口站：进港、分拣与交付转运协同",
    metrics: [
      { label: "进港处理批次", value: "09" },
      { label: "分拣准确率", value: "98.7%" },
      { label: "卡车准点离场", value: "91.3%" },
      { label: "异常首报时效", value: "14 分钟" }
    ],
    flights: [
      ["RZE-032", "已落地", "09:10", "P1", "已计时"],
      ["RZE-038", "AWB 已核对", "10:05", "P2", "核对完成"],
      ["RZE-041", "二次复核", "10:40", "P2", "待装车"],
      ["RZE-045", "已离场", "11:10", "P2", "离场"]
    ],
    nodeStates: [
      { title: "落地 KPI 启动", owner: "站点主管", progress: 100, note: "落地即启动站点 KPI。" },
      { title: "AWB 核对", owner: "核对员", progress: 89, note: "逐箱核对，杜绝托盘级估算。" },
      { title: "分区与路线准备", owner: "分拨岗", progress: 80, note: "分区和路线要在装车前完成。" },
      { title: "二次复核", owner: "独立复核", progress: 76, note: "是装车前的绝对门槛。" },
      { title: "卡车装载", owner: "装车组", progress: 71, note: "双人操作并记录装车会话。" },
      { title: "离场与 POD", owner: "交接岗", progress: 66, note: "形成对外交付衔接。" }
    ],
    priorities: [
      { title: "P1 重点客户", meta: "4 票", note: "优先过核对和装车。" },
      { title: "P2 标准货", meta: "16 票", note: "按分拨窗口推进。" },
      { title: "板位异常", meta: "1 起", note: "已阻断后续状态。" },
      { title: "卡车改配", meta: "1 起", note: "已重新分车。" }
    ],
    tasks: [
      { title: "进港核对", copy: "逐箱 AWB 核对并保留差异原因。" },
      { title: "车货匹配", copy: "装车前完成路线和卡车绑定。" },
      { title: "复核门槛", copy: "未通过二次复核不得装车。" },
      { title: "交付衔接", copy: "离场与签收必须持续回传。" }
    ]
  },
  MST: {
    title: "MST 货站管理员看板",
    subtitle: "欧陆分拨站：关注区域网络协同与末端交付衔接",
    metrics: [
      { label: "区域分拨单", value: "17" },
      { label: "交付回传率", value: "90.6%" },
      { label: "POD 完整率", value: "97.1%" },
      { label: "异常闭环率", value: "92.4%" }
    ],
    flights: [
      ["MST-118", "已按区域分拣", "08:45", "P2", "已分拨"],
      ["MST-124", "已分配卡车", "09:20", "P1", "待二检"],
      ["MST-137", "已装车", "10:00", "P2", "已装车"],
      ["MST-140", "已送达", "10:55", "P2", "已回传"]
    ],
    nodeStates: [
      { title: "区域分拣", owner: "分拣岗", progress: 90, note: "以区域和客户类型驱动分拨。" },
      { title: "卡车规划", owner: "调度岗", progress: 84, note: "提前分配车辆与线路。" },
      { title: "二次复核", owner: "复核岗", progress: 77, note: "保持车货关系一致。" },
      { title: "装车会话", owner: "装车组", progress: 73, note: "记录双人装车与异常信息。" },
      { title: "POD 闭环", owner: "交接岗", progress: 70, note: "POD 是争议处理基础。" },
      { title: "最后一公里同步", owner: "接口岗", progress: 64, note: "保证最后一公里不脱链。" }
    ],
    priorities: [
      { title: "P1 加急订单", meta: "6 票", note: "优先分拨与发车。" },
      { title: "P2 标准订单", meta: "24 票", note: "按区域批次推进。" },
      { title: "末端失败", meta: "2 起", note: "失败原因已结构化。" },
      { title: "交付重派", meta: "1 起", note: "重新分配承运商。" }
    ],
    tasks: [
      { title: "分区分拨", copy: "让仓内物理分区与系统字段对应。" },
      { title: "交付回传", copy: "已送达 / 失败 / 改派等状态必须可追踪。" },
      { title: "POD 审核", copy: "把签收文件结构化，不只上传图片。" },
      { title: "异常复盘", copy: "从事件流回看区域分拨瓶颈。" }
    ]
  },
  BoH: {
    title: "BoH 货站管理员看板",
    subtitle: "接口优先节点：先保障末端可视，再逐步提升站内控制深度",
    metrics: [
      { label: "末端派送任务", value: "25" },
      { label: "派送中回传率", value: "88.9%" },
      { label: "已送达成功率", value: "94.7%" },
      { label: "失败原因结构化", value: "86.1%" }
    ],
    flights: [
      ["BOH-510", "派送中", "10:20", "P1", "派送中"],
      ["BOH-514", "已送达", "11:05", "P2", "已妥投"],
      ["BOH-518", "派送失败", "11:40", "P2", "地址异常"],
      ["BOH-524", "已改派", "12:10", "P2", "已重派"]
    ],
    nodeStates: [
      { title: "承运商分配", owner: "末端协调", progress: 92, note: "承运商必须进入统一视野。" },
      { title: "派送中", owner: "接口岗", progress: 86, note: "状态回传是最小可用前提。" },
      { title: "送达同步", owner: "交付接口", progress: 81, note: "送达时间戳需稳定回传。" },
      { title: "失败编码", owner: "异常岗", progress: 75, note: "失败原因必须结构化。" },
      { title: "改派跟踪", owner: "调度岗", progress: 70, note: "重派信息要纳入承诺兑现链。" },
      { title: "POD 归档", owner: "文档岗", progress: 62, note: "对可签收场景保留证明链接。" }
    ],
    priorities: [
      { title: "P1 末端加急", meta: "5 票", note: "优先派送并持续追踪状态。" },
      { title: "P2 常规派送", meta: "20 票", note: "保障状态完整回传。" },
      { title: "失败重派", meta: "2 起", note: "已进入重派流程。" },
      { title: "状态缺失", meta: "1 起", note: "接口补偿中。" }
    ],
    tasks: [
      { title: "承运商映射", copy: "统一承运商编号与派送单编号。" },
      { title: "失败原因治理", copy: "把失败原因变成结构化字典。" },
      { title: "状态补偿", copy: "接口不稳定时触发人工补录。" },
      { title: "交付证明留存", copy: "保留签收与争议处理所需引用。" }
    ]
  }
};

function createTags(tags) {
  return tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
}

function renderNetwork() {
  const target = document.querySelector("[data-network-grid]");
  if (!target) return;
  target.innerHTML = airportNetwork
    .map((station) => {
      const statusClass =
        station.control.includes("L1") ? "is-strong" : station.control.includes("L2") ? "is-collab" : "is-visual";
      return `
        <article class="station-card">
          <div class="row-between">
            <h3>${station.code}</h3>
            <span class="tag ${statusClass}">${station.control}</span>
          </div>
          <p class="muted">${station.region} · ${station.label}</p>
          <div class="station-meta">
            <span class="small-tag">${station.phase}</span>
            <span class="small-tag">站点已纳入网络规划</span>
          </div>
          <p class="note">${station.note}</p>
        </article>
      `;
    })
    .join("");
}

function renderTimeline() {
  const target = document.querySelector("[data-timeline]");
  if (!target) return;
  target.innerHTML = chainSections
    .map(
      (item) => `
        <article class="timeline-card" data-step="${item.step}">
          <h3>${item.title}</h3>
          <p>${item.copy}</p>
          <div class="tag-row">${createTags(item.tags)}</div>
        </article>
      `
    )
    .join("");
}

function renderPlatformModules() {
  const target = document.querySelector("[data-platform-modules]");
  if (!target) return;
  target.innerHTML = platformModules
    .map(
      (item) => `
        <article class="doc-card">
          <h3>${item.title}</h3>
          <p>${item.copy}</p>
        </article>
      `
    )
    .join("");
}

function renderPlatformObjects() {
  const target = document.querySelector("[data-platform-objects]");
  if (!target) return;
  target.innerHTML = platformObjects.map((item) => `<span class="tag">${item}</span>`).join("");
}

function renderPlatformTable() {
  const target = document.querySelector("[data-station-table]");
  if (!target) return;
  target.innerHTML = airportNetwork
    .map(
      (station) => `
        <tr>
          <td><strong>${station.code}</strong></td>
          <td>${station.region}</td>
          <td>${station.label}</td>
          <td>${station.control}</td>
          <td>${station.phase}</td>
          <td>${station.code === "MME" || station.code === "URC" ? "运营样板" : "协同接入"}</td>
        </tr>
      `
    )
    .join("");
}

function renderStationSelector() {
  const select = document.querySelector("#station-selector");
  if (!select) return;
  select.innerHTML = Object.keys(stationProfiles)
    .map((code) => `<option value="${code}">${code}</option>`)
    .join("");
  select.value = "MME";
  renderStationProfile("MME");
  select.addEventListener("change", (event) => renderStationProfile(event.target.value));
}

function renderStationProfile(code) {
  const profile = stationProfiles[code];
  if (!profile) return;

  const title = document.querySelector("[data-station-title]");
  const subtitle = document.querySelector("[data-station-subtitle]");
  const metrics = document.querySelector("[data-station-metrics]");
  const flights = document.querySelector("[data-flight-table]");
  const states = document.querySelector("[data-status-list]");
  const priorities = document.querySelector("[data-priority-list]");
  const tasks = document.querySelector("[data-task-list]");

  if (title) title.textContent = profile.title;
  if (subtitle) subtitle.textContent = profile.subtitle;

  if (metrics) {
    metrics.innerHTML = profile.metrics
      .map(
        (item) => `
          <div class="kpi-item">
            <strong>${item.value}</strong>
            <span>${item.label}</span>
          </div>
        `
      )
      .join("");
  }

  if (flights) {
    flights.innerHTML = profile.flights
      .map(
        (row) => `
          <tr>
            <td><strong>${row[0]}</strong></td>
            <td>${row[1]}</td>
            <td>${row[2]}</td>
            <td>${row[3]}</td>
            <td>${row[4]}</td>
          </tr>
        `
      )
      .join("");
  }

  if (states) {
    states.innerHTML = profile.nodeStates
      .map(
        (item) => `
          <article class="status-card">
            <div class="row-between">
              <h3>${item.title}</h3>
              <span class="small-tag">${item.owner}</span>
            </div>
            <div class="progress"><span style="width:${item.progress}%"></span></div>
            <p>${item.note}</p>
          </article>
        `
      )
      .join("");
  }

  if (priorities) {
    priorities.innerHTML = profile.priorities
      .map(
        (item) => `
          <div class="priority-item">
            <strong>${item.meta}</strong>
            <span>${item.title}</span>
            <p>${item.note}</p>
          </div>
        `
      )
      .join("");
  }

  if (tasks) {
    tasks.innerHTML = profile.tasks
      .map(
        (item) => `
          <article class="task-card">
            <h3>${item.title}</h3>
            <p>${item.copy}</p>
          </article>
        `
      )
      .join("");
  }
}

function highlightNav() {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === page) {
      link.classList.add("active");
    }
  });
}

highlightNav();
renderNetwork();
renderTimeline();
renderPlatformModules();
renderPlatformObjects();
renderPlatformTable();
renderStationSelector();
