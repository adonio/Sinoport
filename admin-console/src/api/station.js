import useSWR, { mutate } from 'swr';
import { useMemo } from 'react';

import { stationAxios, stationDeleter, stationFetcher, stationPatcher, stationPoster, stationPublicFetcher, stationPublicPoster, stationPut, stationUpload } from 'utils/stationApi';
import { localizeMobileText, readMobileLanguage } from 'utils/mobile/i18n';

const endpoints = {
  inboundFlights: '/api/v1/station/inbound/flights',
  stationFlightOptions: '/api/v1/station/flights/options',
  inboundFlightCreateOptions: '/api/v1/station/inbound/flight-create/options',
  inboundWaybills: '/api/v1/station/inbound/waybills',
  stationWaybillOptions: '/api/v1/station/waybills/options',
  mobileInboundOverview: '/api/v1/mobile/inbound',
  mobileNodeFlow: (flowKey) => `/api/v1/mobile/node/${encodeURIComponent(flowKey)}`,
  mobileNodeDetail: (flowKey, itemId) => `/api/v1/mobile/node/${encodeURIComponent(flowKey)}/${encodeURIComponent(itemId)}`,
  mobileOutboundOverview: '/api/v1/mobile/outbound',
  mobileOutboundFlightDetail: (flightNo) => `/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}`,
  mobileOutboundOptions: (flightNo) => `/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/options`,
  mobileInboundFlightDetail: (flightNo) => `/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}`,
  mobileSelect: '/api/v1/mobile/select',
  stationInboundOverview: '/api/v1/station/inbound/overview',
  stationInboundMobileOverview: '/api/v1/station/inbound/mobile-overview',
  stationOutboundOverview: '/api/v1/station/outbound/overview',
  stationResourcesOverview: '/api/v1/station/resources/overview',
  stationResourcesVehicles: '/api/v1/station/resources/vehicles',
  stationResourcesVehicleOptions: '/api/v1/station/resources/vehicles/options',
  stationResourcesVehicleDetail: (vehicleId) => `/api/v1/station/resources/vehicles/${encodeURIComponent(vehicleId)}`,
  outboundFlights: '/api/v1/station/outbound/flights',
  outboundWaybills: '/api/v1/station/outbound/waybills',
  stationShipments: '/api/v1/station/shipments',
  stationShipmentOptions: '/api/v1/station/shipments/options',
  stationDocuments: '/api/v1/station/documents',
  stationDocumentOptions: '/api/v1/station/documents/options',
  stationDocumentsOverview: '/api/v1/station/documents/overview',
  stationPodOverview: '/api/v1/station/pod/overview',
  stationTasks: '/api/v1/station/tasks',
  stationTaskOptions: '/api/v1/station/tasks/options',
  stationTasksOverview: '/api/v1/station/tasks/overview',
  stationExceptions: '/api/v1/station/exceptions',
  stationExceptionOptions: '/api/v1/station/exceptions/options',
  stationExceptionsOverview: '/api/v1/station/exceptions/overview',
  stationDashboardOverview: '/api/v1/station/dashboard/overview',
  stationReportsOverview: '/api/v1/station/reports/daily',
  stationNoaOverview: '/api/v1/station/noa/overview',
  auditObject: '/api/v1/platform/audit/object'
};

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = Object.freeze({});
const EMPTY_MOBILE_ROLE_VIEW = Object.freeze({
  label: '',
  taskRoles: [],
  inboundTabs: [],
  outboundTabs: [],
  flowKeys: [],
  actionTypes: []
});
const EMPTY_MANIFEST_SUMMARY = Object.freeze({
  version: '--',
  exchange: '--',
  outboundCount: 0,
  destinationCount: 0
});
const EMPTY_MOBILE_INBOUND_SUMMARY = Object.freeze({
  totalFlights: 0,
  totalTasks: 0,
  queuedTasks: 0,
  activeTasks: 0,
  completedTasks: 0
});
const EMPTY_MOBILE_OUTBOUND_SUMMARY = Object.freeze({
  totalFlights: 0,
  totalTasks: 0,
  queuedTasks: 0,
  activeTasks: 0,
  completedTasks: 0
});

function toArray(value) {
  return Array.isArray(value) ? value : EMPTY_ARRAY;
}

function mapSelectOption(item) {
  return {
    value: item?.value || '',
    label: item?.label || item?.value || '',
    disabled: Boolean(item?.disabled),
    meta: item?.meta || EMPTY_OBJECT
  };
}

function buildQueryString(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

function formatTimeLabel(value) {
  if (!value) return '--';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function mapInboundFlightToViewModel(item) {
  return {
    flightId: item.flight_id,
    flightNo: item.flight_no,
    eta: formatTimeLabel(item.eta),
    etd: '--',
    source: item.origin_code,
    status: item.runtime_status,
    step: item.summary?.current_step || '--',
    priority: item.service_level || '--',
    cargo: `${item.summary?.total_pieces || 0} pcs / ${item.summary?.total_weight || 0} kg`,
    blocked: item.summary?.blocked || false,
    blockerReason: item.summary?.blocker_reason || ''
  };
}

function mapInboundWaybillToViewModel(item) {
  return {
    awbId: item.awb_id,
    awb: item.awb_no,
    awbType: item.awb_type || 'IMPORT',
    flightId: item.flight_id,
    flightNo: item.flight_no,
    consignee: item.consignee_name,
    pieces: String(item.pieces),
    piecesValue: Number(item.pieces || 0),
    weight: `${item.gross_weight} kg`,
    grossWeight: Number(item.gross_weight || 0),
    currentNode: item.current_node,
    noaStatus: item.noa_status,
    podStatus: item.pod_status,
    transferStatus: item.transfer_status,
    archived: Boolean(item.archived || item.deleted_at),
    blocked: item.blocked,
    blockerReason: item.blocker_reason || ''
  };
}

function mapOutboundFlightToViewModel(item) {
  return {
    flightId: item.flight_id,
    flightNo: item.flight_no,
    etd: formatTimeLabel(item.etd),
    status: item.runtime_status,
    stage: item.summary?.stage || '--',
    manifest: item.summary?.manifest_status || '--',
    cargo: `${item.summary?.total_awb_count || 0} AWB / ${item.summary?.total_pieces || 0} pcs / ${item.summary?.total_weight || 0} kg`
  };
}

function mapOutboundWaybillToViewModel(item) {
  return {
    awbId: item.awb_id,
    awb: item.awb_no,
    awbType: item.awb_type || 'EXPORT',
    flightId: item.flight_id,
    flightNo: item.flight_no,
    destination: item.destination_code,
    piecesValue: Number(item.pieces || 0),
    grossWeight: Number(item.gross_weight || 0),
    forecast: item.forecast_status,
    receipt: item.receipt_status,
    master: item.master_status,
    loading: item.loading_status,
    manifest: item.manifest_status,
    currentNode: item.loading_status === '已装载' ? 'Loaded' : item.loading_status,
    archived: Boolean(item.archived || item.deleted_at)
  };
}

function mapMobileInboundFlightToViewModel(item) {
  return {
    flightNo: item.flightNo || item.flight_no,
    source: item.source,
    eta: item.eta,
    step: item.step,
    priority: item.priority,
    cargo: item.cargo,
    status: item.status,
    taskCount: item.taskCount || item.task_count || 0,
    blocked: Boolean(item.blocked),
    blockerReason: item.blockerReason || item.blocker_reason || ''
  };
}

function mapMobileInboundWaybillToViewModel(item) {
  return {
    awb: item.awb || item.awb_no,
    consignee: item.consignee || item.consignee_name || '',
    expectedBoxes: Number(item.expectedBoxes ?? item.expected_boxes ?? item.pieces ?? 0),
    expectedBoxesKnown: item.expectedBoxesKnown ?? item.expected_boxes_known ?? true,
    totalWeightKg: Number(item.totalWeightKg ?? item.total_weight_kg ?? item.gross_weight ?? 0),
    weight: item.weight || `${Number(item.totalWeightKg ?? item.total_weight_kg ?? item.gross_weight ?? 0)} kg`,
    currentNode: item.currentNode || item.current_node || '',
    noaStatus: item.noaStatus || item.noa_status || '',
    podStatus: item.podStatus || item.pod_status || '',
    transferStatus: item.transferStatus || item.transfer_status || '',
    blocked: Boolean(item.blocked),
    blockerReason: item.blockerReason || item.blocker_reason || '',
    barcode: item.barcode || item.awb_no || item.awb || '',
    pieces: item.pieces ?? item.expectedBoxes ?? item.expected_boxes ?? 0
  };
}

function mapMobileInboundPalletToViewModel(item) {
  const entries = toArray(item.items || item.entries).map((entry) => ({
    awb: entry.awb || entry.awb_no,
    boxes: Number(entry.boxes ?? 0),
    weight: Number(entry.weight ?? 0),
    weightKg: Number(entry.weightKg ?? entry.weight ?? 0),
    consignee: entry.consignee || entry.consignee_name || ''
  }));
  const totalWeight = Number(item.totalWeight ?? item.total_weight ?? item.totalWeightKg ?? 0);
  return {
    palletId: item.palletId || item.pallet_id,
    palletNo: item.palletNo || item.pallet_no,
    flightNo: item.flightNo || item.flight_no,
    storageLocation: item.storageLocation || item.storage_location || '',
    totalBoxes: Number(item.totalBoxes ?? item.total_boxes ?? 0),
    totalWeight,
    totalWeightKg: totalWeight,
    status: item.status || item.pallet_status || '计划',
    note: item.note || '',
    loadedPlate: item.loadedPlate || item.loaded_plate || '',
    loadedAt: item.loadedAt || item.loaded_at || '',
    archived: Boolean(item.archived ?? item.deleted_at),
    items: entries,
    entries
  };
}

function mapMobileInboundLoadingPlanToViewModel(item) {
  return {
    id: item.id || item.loading_plan_id,
    flightNo: item.flightNo || item.flight_no,
    truckPlate: item.truckPlate || item.truck_plate,
    vehicleModel: item.vehicleModel || item.vehicle_model || '',
    driverName: item.driverName || item.driver_name || '',
    collectionNote: item.collectionNote || item.collection_note || '',
    forkliftDriver: item.forkliftDriver || item.forklift_driver || '',
    checker: item.checker || '',
    arrivalTime: item.arrivalTime || item.arrival_time || '',
    departTime: item.departTime || item.depart_time || '',
    pallets: toArray(item.pallets),
    totalBoxes: Number(item.totalBoxes ?? item.total_boxes ?? 0),
    totalWeight: Number(item.totalWeight ?? item.total_weight ?? 0),
    status: item.status || item.plan_status || '计划',
    note: item.note || ''
    ,
    completedAt: item.completedAt || item.completed_at || '',
    archived: Boolean(item.archived ?? item.deleted_at)
  };
}

function mapMobileRoleViewResponse(payload) {
  return {
    label: payload?.label || '',
    taskRoles: toArray(payload?.taskRoles || payload?.task_roles),
    inboundTabs: toArray(payload?.inboundTabs || payload?.inbound_tabs),
    outboundTabs: toArray(payload?.outboundTabs || payload?.outbound_tabs),
    flowKeys: toArray(payload?.flowKeys || payload?.flow_keys),
    actionTypes: toArray(payload?.actionTypes || payload?.action_types)
  };
}

function localizeMobileTaskCardText(value) {
  if (typeof value !== 'string' || !value) return value;

  const language = readMobileLanguage();
  if (language !== 'en') return value;

  const normalized = value
    .replace(/进港机场货站操作/gu, 'Inbound Station Actions')
    .replace(/出港机场货站操作/gu, 'Outbound Station Actions')
    .replace(/OUTBOUND机场STATIONACTIONS/gu, 'Outbound Station Actions')
    .replace(/OUTBOUND机场机坪ACTIONS/gu, 'Outbound Airport Ramp Operations')
    .replace(/FINAL MILE卡车LOADING与运输/gu, 'Final Mile Truck Loading and Transport')
    .replace(
      /围绕航班 ([A-Z0-9-]+) 组托，保持同票同托，为后续装车准备标准托盘。/gu,
      'Build pallets for flight $1, keep each AWB on the correct pallet, and prepare standard pallets for downstream loading.'
    )
    .replace(
      /为Flight ([A-Z0-9-]+) 录入TruCk Plate、Driver、ColleCtion Note 和Review信息，形成Loading Plan。/gu,
      'Record the truck plate, driver, collection note, and review details for flight $1 to create the loading plan.'
    )
    .replace(/落地后 12h/gu, 'within 12h after landing')
    .replace(/理货完成后立即执行/gu, 'Start immediately after counting is completed')
    .replace(/SLA Load to AirCraft前 45 分钟/gu, 'SLA 45 minutes before load to aircraft')
    .replace(/SLA ETD 前 30 分钟/gu, 'SLA 30 minutes before ETD')
    .replace(/SLA Airborne前闭环/gu, 'SLA close before airborne')
    .replace(/托盘号/gu, 'Pallet No.')
    .replace(/Container号/gu, 'Container Code')
    .replace(/待Review/gu, 'Pending Review')
    .replace(/按 AWB Enter ReCeived PieCes并CompleteWeight Review。/gu, 'Enter received pieces by AWB and complete the weight review.')
    .replace(/SLA ReCeiving后 30 分钟/gu, 'SLA 30 minutes after receiving')
    .replace(/未CompleteReCeiving不得Open组板和机坪Release。/gu, 'Do not open pallet build-up or ramp release until receiving is complete.')
    .replace(/NoneContainer Code或ReviewWeight时不得OpenLoad to AirCraft。/gu, 'Load to Aircraft cannot be opened without a container code or reviewed weight.')
    .replace(/NoneContainer号或ReviewWeight时不得OpenLoad to AirCraft。/gu, 'Load to Aircraft cannot be opened without a container code or reviewed weight.')
    .replace(/AWB \/ SerialSCan记录/gu, 'AWB / Serial Scan Records')
    .replace(/SCan到Flight外AWB时Required先ConfirmYesNo纳入统计。/gu, 'When an AWB outside the flight is scanned, confirm whether it should be included before counting it.')
    .replace(/去后台排Planned/gu, 'Plan in Back Office')
    .replace(
      /Loading Plan应由后台办公室先Complete编排，包括TruCk Plate、Driver、ColleCtion Note 与预定pallet；PDA 仅执行已排好的Planned。/gu,
      'The loading plan should be completed by the back office first, including truck plate, driver, collection note, and reserved pallets; the PDA only executes the approved plan.'
    )
    .replace(/未录入TruCk Plate、ColleCtion Note、CheCker时不得Start Loading。/gu, 'Do not start loading until the truck plate, collection note, and checker are recorded.');

  return localizeMobileText(language, normalized);
}

function mapMobileInboundTaskCardResponse(card) {
  if (!card) return null;

  return {
    title: localizeMobileTaskCardText(card.title || ''),
    node: localizeMobileTaskCardText(card.node || ''),
    role: localizeMobileTaskCardText(card.role || ''),
    status: localizeMobileTaskCardText(card.status || ''),
    sla: localizeMobileTaskCardText(card.sla || ''),
    description: localizeMobileTaskCardText(card.description || ''),
    evidence: toArray(card.evidence).map(localizeMobileTaskCardText),
    blockers: toArray(card.blockers).map(localizeMobileTaskCardText),
    actions: toArray(card.actions).map((action) => ({
      label: localizeMobileTaskCardText(action.label || ''),
      variant: action.variant || 'outlined',
      color: action.color || undefined
    }))
  };
}

function mapMobileOutboundFlightToViewModel(item) {
  return {
    flightId: item.flightId || item.flight_id || '',
    flightNo: item.flightNo || item.flight_no || '',
    source: item.source || item.origin_code || '--',
    etd: item.etd || '--',
    step: item.step || item.stage || item.current_step || item.runtime_status || '--',
    stage: item.stage || item.step || item.current_step || item.runtime_status || '--',
    priority: item.priority || item.service_level || 'P2',
    cargo: item.cargo || `${item.total_awb_count || item.summary?.total_awb_count || 0} AWB / ${item.total_pieces || item.summary?.total_pieces || 0} pcs / ${item.total_weight || item.summary?.total_weight || 0} kg`,
    status: item.status || item.runtime_status || '待处理',
    manifest: item.manifest || item.summary?.manifest_status || '--',
    taskCount: Number(item.taskCount ?? item.task_count ?? 0),
    tasks: toArray(item.tasks).map(mapMobileTaskItem)
  };
}

function mapMobileTaskItem(item) {
  return {
    task_id: item.task_id || item.taskId || '',
    task_type: item.task_type || item.taskType || '',
    execution_node: item.execution_node || item.executionNode || '',
    task_status: item.task_status || item.taskStatus || '',
    related_object_type: item.related_object_type || item.relatedObjectType || '',
    related_object_id: item.related_object_id || item.relatedObjectId || '',
    related_object_label: item.related_object_label || item.relatedObjectLabel || '',
    awb_no: item.awb_no || item.awbNo || '',
    flight_no: item.flight_no || item.flightNo || '',
    station_id: item.station_id || item.stationId || '',
    due_at: item.due_at || item.dueAt || '',
    evidence_required: Boolean(item.evidence_required ?? item.evidenceRequired ?? false),
    blockers: toArray(item.blockers),
    allowed_actions: toArray(item.allowed_actions || item.allowedActions)
  };
}

function mapMobileNodeTaskCardResponse(card) {
  if (!card) return null;

  return {
    title: card.title || '',
    node: card.node || '',
    role: card.role || '',
    status: card.status || '',
    priority: card.priority || '',
    sla: card.sla || '',
    description: card.description || '',
    evidence: toArray(card.evidence),
    blockers: toArray(card.blockers),
    actions: toArray(card.actions).map((action) => ({
      label: action.label || '',
      variant: action.variant || 'outlined',
      color: action.color || undefined
    }))
  };
}

function mapMobileNodeItemResponse(item) {
  return {
    id: item?.id || item?.nodeId || '',
    title: item?.title || '',
    subtitle: item?.subtitle || '',
    status: item?.status || '',
    priority: item?.priority || '',
    allowed: Boolean(item?.allowed ?? item?.allowedAction ?? item?.allowedActions ?? true)
  };
}

function mapMobileNodeSessionResponse(session) {
  return {
    roleKey: session?.roleKey || session?.role_key || '',
    roleLabel: session?.roleLabel || session?.role_label || '',
    stationCode: session?.stationCode || session?.station_code || '',
    userId: session?.userId || session?.user_id || '',
    roleIds: toArray(session?.roleIds || session?.role_ids),
    stationScope: toArray(session?.stationScope || session?.station_scope),
    clientSource: session?.clientSource || session?.client_source || '',
    tenantId: session?.tenantId || session?.tenant_id || ''
  };
}

function mapMobileNodeResponse(payload) {
  const roleView = payload?.roleView || payload?.role_view || EMPTY_MOBILE_ROLE_VIEW;
  const detail = payload?.detail || payload?.item || null;
  const taskCard = payload?.taskCard || payload?.task_card || detail?.taskCard || null;
  const items = toArray(payload?.items || payload?.nodes).map(mapMobileNodeItemResponse);

  return {
    stationId: payload?.stationId || payload?.station_id || '',
    flowKey: payload?.flowKey || payload?.flow_key || '',
    listTitle: payload?.listTitle || payload?.list_title || '',
    detailTitle: payload?.detailTitle || payload?.detail_title || '',
    flowAllowed: Boolean(payload?.flowAllowed ?? payload?.flow_allowed ?? false),
    session: mapMobileNodeSessionResponse(payload?.session || payload?.session_data || {}),
    roleView: mapMobileRoleViewResponse(roleView),
    availableActions: toArray(payload?.availableActions || payload?.available_actions),
    items,
    page: Number(payload?.page || 1),
    page_size: Number(payload?.page_size || 20),
    total: Number(payload?.total || items.length),
    statusOptions: toArray(payload?.statusOptions || payload?.status_options).map(mapSelectOption),
    filters: {
      keyword: payload?.filters?.keyword || payload?.filter_state?.keyword || '',
      status: payload?.filters?.status || payload?.filter_state?.status || ''
    },
    detail: detail
      ? {
          id: detail.id || detail.nodeId || '',
          title: detail.title || '',
          node: detail.node || '',
          role: detail.role || '',
          status: detail.status || '',
          priority: detail.priority || '',
          sla: detail.sla || '',
          description: detail.description || '',
          evidence: toArray(detail.evidence),
          blockers: toArray(detail.blockers),
          actions: toArray(detail.actions).map((action) => ({
            label: action.label || '',
            variant: action.variant || 'outlined',
            color: action.color || undefined
          })),
          summaryRows: toArray(detail.summaryRows || detail.summary_rows),
          records: toArray(detail.records),
          flightInfoRows: toArray(detail.flightInfoRows || detail.flight_info_rows),
          flightDocuments: toArray(detail.flightDocuments || detail.flight_documents),
          uldAssignments: toArray(detail.uldAssignments || detail.uld_assignments),
          positionOptions: toArray(detail.positionOptions || detail.position_options),
          unloadTasks: toArray(detail.unloadTasks || detail.unload_tasks),
          forecastWaybills: toArray(detail.forecastWaybills || detail.forecast_waybills),
          taskCard: mapMobileNodeTaskCardResponse(taskCard || detail)
        }
      : null,
    taskCard: mapMobileNodeTaskCardResponse(taskCard || detail),
    mobileNodeLoading: false,
    mobileNodeError: null,
    mobileNodeValidating: false,
    mobileNodeUsingMock: false
  };
}

function mapMobileInboundDetailResponse(payload) {
  const flight = payload?.flight || payload?.inboundFlight || {};
  const pageConfig = payload?.pageConfig || payload?.page_config || {};
  const taskCards = pageConfig.taskCards || pageConfig.task_cards || {};

  return {
    stationId: payload?.stationId || payload?.station_id || '',
    session: {
      roleKey: payload?.session?.roleKey || payload?.session?.role_key || '',
      roleLabel: payload?.session?.roleLabel || payload?.session?.role_label || '',
      stationCode: payload?.session?.stationCode || payload?.session?.station_code || '',
      userId: payload?.session?.userId || payload?.session?.user_id || '',
      roleIds: toArray(payload?.session?.roleIds || payload?.session?.role_ids),
      stationScope: toArray(payload?.session?.stationScope || payload?.session?.station_scope),
      clientSource: payload?.session?.clientSource || payload?.session?.client_source || '',
      tenantId: payload?.session?.tenantId || payload?.session?.tenant_id || ''
    },
    roleView: mapMobileRoleViewResponse(payload?.roleView || payload?.role_view),
    availableTabs: toArray(payload?.availableTabs || payload?.available_tabs),
    availableActions: toArray(payload?.availableActions || payload?.available_actions),
    summary: payload?.summary || {},
    flight: flight
      ? {
          flightNo: flight.flightNo || flight.flight_no || '',
          source: flight.source || flight.origin_code || '--',
          eta: flight.eta || '--',
          etd: flight.etd || '--',
          step: flight.step || flight.current_step || flight.runtime_status || '--',
          priority: flight.priority || flight.service_level || 'P2',
          cargo: flight.cargo || `${flight.total_pieces || flight.pieces || 0} pcs / ${flight.total_weight || flight.gross_weight || 0} kg`,
          status: flight.status || flight.runtime_status || '待加载',
          taskCount: Number(flight.taskCount ?? flight.task_count ?? 0),
          blocked: Boolean(flight.blocked),
          blockerReason: flight.blockerReason || flight.blocker_reason || ''
        }
      : null,
    waybills: toArray(payload?.waybills || payload?.inboundWaybills).map(mapMobileInboundWaybillToViewModel),
    taskMap: payload?.taskMap || payload?.task_map || {},
    pallets: toArray(payload?.pallets).map(mapMobileInboundPalletToViewModel),
    loadingPlans: toArray(payload?.loadingPlans || payload?.loading_plans).map(mapMobileInboundLoadingPlanToViewModel),
    pageConfig: {
      ...pageConfig,
      taskCards: Object.fromEntries(
        Object.entries(taskCards).map(([key, value]) => [key, mapMobileInboundTaskCardResponse(value)])
      )
    }
  };
}

function mapMobileOutboundOverviewResponse(payload) {
  const session = payload?.session || payload?.session_data || {};
  const roleView = payload?.roleView || payload?.role_view || EMPTY_MOBILE_ROLE_VIEW;

  return {
    mobileOutboundSession: {
      roleKey: session.roleKey || session.role_key || '',
      roleLabel: session.roleLabel || session.role_label || '',
      stationCode: session.stationCode || session.station_code || '',
      userId: session.userId || session.user_id || '',
      roleIds: toArray(session.roleIds || session.role_ids),
      stationScope: toArray(session.stationScope || session.station_scope),
      clientSource: session.clientSource || session.client_source || '',
      tenantId: session.tenantId || session.tenant_id || ''
    },
    mobileOutboundRoleView: {
      label: roleView.label || '',
      taskRoles: toArray(roleView.taskRoles || roleView.task_roles),
      inboundTabs: toArray(roleView.inboundTabs || roleView.inbound_tabs),
      outboundTabs: toArray(roleView.outboundTabs || roleView.outbound_tabs),
      flowKeys: toArray(roleView.flowKeys || roleView.flow_keys),
      actionTypes: toArray(roleView.actionTypes || roleView.action_types)
    },
    mobileOutboundAvailableTabs: toArray(payload?.availableTabs || payload?.available_tabs),
    mobileOutboundAvailableActions: toArray(payload?.availableActions || payload?.available_actions),
    mobileOutboundFlights: toArray(payload?.outboundFlights).map(mapMobileOutboundFlightToViewModel),
    mobileOutboundTasks: toArray(payload?.mobileTasks).map(mapMobileTaskItem),
    mobileOutboundSummary: payload?.summary || EMPTY_MOBILE_OUTBOUND_SUMMARY,
    mobileOutboundLoading: false,
    mobileOutboundError: null,
    mobileOutboundValidating: false,
    mobileOutboundUsingMock: false
  };
}

function mapMobileOutboundWaybillToViewModel(item) {
  const pieces = Number(item?.pieces ?? item?.expectedBoxes ?? 0);
  const totalWeightKg = Number(item?.totalWeightKg ?? item?.gross_weight ?? item?.total_weight ?? 0);

  return {
    awbId: item?.awbId || item?.awb_id || '',
    awb: item?.awb || item?.awb_no || '',
    flightNo: item?.flightNo || item?.flight_no || '',
    destination: item?.destination || item?.destination_code || '--',
    consignee: item?.consignee || item?.consignee_name || item?.destination || item?.destination_code || '--',
    pieces,
    totalPieces: Number(item?.totalPieces ?? pieces),
    totalWeightKg,
    totalWeight: totalWeightKg,
    expectedBoxes: Number(item?.expectedBoxes ?? pieces),
    expectedBoxesKnown: Boolean(item?.expectedBoxesKnown ?? true),
    unitWeight: Number(item?.unitWeight ?? (pieces ? totalWeightKg / pieces : 0)),
    weight: item?.weight || `${totalWeightKg} kg`,
    barcode: item?.barcode || item?.awb || item?.awb_no || '',
    currentNode: item?.currentNode || '出港收货',
    forecastStatus: item?.forecastStatus || item?.forecast_status || '待处理',
    receiptStatus: item?.receiptStatus || item?.receipt_status || '待处理',
    masterStatus: item?.masterStatus || item?.master_status || '待处理',
    loadingStatus: item?.loadingStatus || item?.loading_status || '待装机',
    manifestStatus: item?.manifestStatus || item?.manifest_status || '待处理',
    noaStatus: item?.noaStatus || item?.forecast_status || '待处理',
    podStatus: item?.podStatus || item?.receipt_status || '待处理',
    transferStatus: item?.transferStatus || item?.loading_status || '待装机',
    blocked: Boolean(item?.blocked ?? false),
    blockerReason: item?.blockerReason || item?.blocker_reason || ''
  };
}

function mapMobileOutboundReceiptToViewModel(item, flightNo, awbNo) {
  const receivedPieces = Number(item?.receivedPieces ?? item?.received_pieces ?? 0);
  const receivedWeight = Number(item?.receivedWeight ?? item?.received_weight ?? 0);
  const status = item?.status || item?.receipt_status || '待收货';

  return {
    receiptId: item?.receiptId || item?.receipt_record_id || '',
    flightNo: item?.flightNo || item?.flight_no || flightNo || '',
    awb: item?.awb || item?.awb_no || awbNo || '',
    receivedPieces,
    receivedWeight,
    status,
    reviewStatus: item?.reviewStatus || item?.review_status || (status === '已复核' ? '已复核' : '待复核'),
    reviewedWeight: Number(item?.reviewedWeight ?? item?.reviewed_weight ?? receivedWeight),
    receivedAt: item?.receivedAt || item?.received_at || item?.updatedAt || item?.updated_at || null,
    reviewedAt: item?.reviewedAt || item?.reviewed_at || item?.updatedAt || item?.updated_at || null,
    note: item?.note || '',
    archived: Boolean(item?.archived ?? item?.deleted_at),
    deletedAt: item?.deletedAt || item?.deleted_at || null,
    canArchive: Boolean(item?.canArchive ?? item?.can_archive ?? !item?.deleted_at),
    canRestore: Boolean(item?.canRestore ?? item?.can_restore ?? item?.deleted_at),
    canReopen: Boolean(item?.canReopen ?? item?.can_reopen ?? ['已收货', '已复核'].includes(status))
  };
}

function mapMobileOutboundContainerToViewModel(item, flightNo) {
  return {
    containerId: item?.containerId || item?.container_id || '',
    boardCode: item?.boardCode || item?.container_code || '',
    flightNo: item?.flightNo || item?.flight_no || flightNo || '',
    entries: toArray(item?.entries).map((entry) => ({
      awb: entry?.awb || entry?.awb_no || '',
      pieces: Number(entry?.pieces ?? 0),
      boxes: Number(entry?.boxes ?? 0),
      weight: Number(entry?.weight ?? 0)
    })),
    totalBoxes: Number(item?.totalBoxes ?? item?.total_boxes ?? 0),
    totalWeightKg: Number(item?.totalWeightKg ?? item?.total_weight ?? 0),
    reviewedWeightKg: Number(item?.reviewedWeightKg ?? item?.reviewed_weight ?? 0),
    status: item?.status || item?.container_status || '待装机',
    loadedAt: item?.loadedAt || item?.loaded_at || null,
    note: item?.note || '',
    offloadBoxes: Number(item?.offloadBoxes ?? item?.offload_boxes ?? 0),
    offloadStatus: item?.offloadStatus || item?.offload_status || '无拉货',
    offloadRecordedAt: item?.offloadRecordedAt || item?.offload_recorded_at || null,
    archived: Boolean(item?.archived ?? item?.deleted_at),
    deletedAt: item?.deletedAt || item?.deleted_at || null,
    canArchive: Boolean(item?.canArchive ?? item?.can_archive ?? !item?.deleted_at),
    canRestore: Boolean(item?.canRestore ?? item?.can_restore ?? item?.deleted_at),
    canReopen: Boolean(item?.canReopen ?? item?.can_reopen ?? ['已装机', '已回退'].includes(item?.status || item?.container_status || ''))
  };
}

function mapMobileOutboundTaskCardResponse(card) {
  if (!card) return null;

  return {
    title: localizeMobileTaskCardText(card.title || ''),
    node: localizeMobileTaskCardText(card.node || ''),
    role: localizeMobileTaskCardText(card.role || ''),
    status: localizeMobileTaskCardText(card.status || ''),
    sla: localizeMobileTaskCardText(card.sla || ''),
    description: localizeMobileTaskCardText(card.description || ''),
    evidence: toArray(card.evidence).map(localizeMobileTaskCardText),
    blockers: toArray(card.blockers).map(localizeMobileTaskCardText),
    actions: toArray(card.actions).map((action) => ({
      label: localizeMobileTaskCardText(action.label || ''),
      variant: action.variant || 'outlined',
      color: action.color || undefined
    }))
  };
}

function mapMobileOutboundDetailResponse(payload) {
  const session = payload?.session || payload?.session_data || {};
  const roleView = payload?.roleView || payload?.role_view || EMPTY_MOBILE_ROLE_VIEW;
  const pageConfig = payload?.pageConfig || payload?.page_config || {};
  const taskCards = pageConfig.taskCards || pageConfig.task_cards || {};
  const flight = payload?.flight || payload?.outboundFlight || {};
  const waybills = toArray(payload?.waybills || payload?.outboundWaybills).map(mapMobileOutboundWaybillToViewModel);
  const forecastAwbRows = toArray(payload?.forecastAwbRows || payload?.forecast_awb_rows || payload?.waybills || payload?.outboundWaybills).map(mapMobileOutboundWaybillToViewModel);
  const masterAwbRows = toArray(payload?.masterAwbRows || payload?.master_awb_rows || payload?.waybills || payload?.outboundWaybills).map(mapMobileOutboundWaybillToViewModel);
  const receipts = payload?.receipts || payload?.receiptMap || {};
  const containers = toArray(payload?.containers || payload?.pmcBoards).map((item) => mapMobileOutboundContainerToViewModel(item, flight.flightNo || flight.flight_no || ''));
  const tasks = toArray(payload?.tasks || payload?.mobileTasks).map(mapMobileTaskItem);
  const summary = payload?.summary || {};

  return {
    stationId: payload?.stationId || payload?.station_id || '',
    session: {
      roleKey: session.roleKey || session.role_key || '',
      roleLabel: session.roleLabel || session.role_label || '',
      stationCode: session.stationCode || session.station_code || '',
      userId: session.userId || session.user_id || '',
      roleIds: toArray(session.roleIds || session.role_ids),
      stationScope: toArray(session.stationScope || session.station_scope),
      clientSource: session.clientSource || session.client_source || '',
      tenantId: session.tenantId || session.tenant_id || ''
    },
    roleView: {
      label: roleView.label || '',
      taskRoles: toArray(roleView.taskRoles || roleView.task_roles),
      inboundTabs: toArray(roleView.inboundTabs || roleView.inbound_tabs),
      outboundTabs: toArray(roleView.outboundTabs || roleView.outbound_tabs),
      flowKeys: toArray(roleView.flowKeys || roleView.flow_keys),
      actionTypes: toArray(roleView.actionTypes || roleView.action_types)
    },
    availableTabs: toArray(payload?.availableTabs || payload?.available_tabs),
    availableActions: toArray(payload?.availableActions || payload?.available_actions),
    summary,
    forecastAwbRows,
    masterAwbRows,
    flight: flight
      ? {
          flightId: flight.flightId || flight.flight_id || '',
          flight_id: flight.flight_id || flight.flightId || '',
          flightNo: flight.flightNo || flight.flight_no || '',
          flight_no: flight.flight_no || flight.flightNo || '',
          source: flight.source || flight.origin_code || '--',
          etd: flight.etd || '--',
          step: flight.step || flight.stage || flight.current_step || flight.runtime_status || '--',
          stage: flight.stage || flight.step || flight.current_step || flight.runtime_status || '--',
          priority: flight.priority || flight.service_level || 'P2',
          cargo: flight.cargo || `${summary.totalAwbCount || flight.total_awb_count || waybills.length} AWB / ${summary.totalPieces || flight.total_pieces || 0} pcs / ${summary.totalWeight || flight.total_weight || 0} kg`,
          status: flight.status || flight.runtime_status || '待处理',
          manifest: flight.manifest || flight.summary?.manifest_status || '待处理',
          taskCount: Number(flight.taskCount ?? flight.task_count ?? tasks.length),
          tasks: toArray(flight.tasks).map(mapMobileTaskItem)
        }
      : null,
    waybills,
    outboundFlights: toArray(payload?.outboundFlights || payload?.outbound_flights).map(mapMobileOutboundFlightToViewModel),
    receipts: Object.fromEntries(
      Object.entries(receipts).map(([awbNo, value]) => [awbNo, mapMobileOutboundReceiptToViewModel(value, flight.flightNo || flight.flight_no || '', awbNo)])
    ),
    receiptMap: Object.fromEntries(
      Object.entries(receipts).map(([awbNo, value]) => [awbNo, mapMobileOutboundReceiptToViewModel(value, flight.flightNo || flight.flight_no || '', awbNo)])
    ),
    containers,
    pmcBoards: containers,
    tasks,
    pageConfig: {
      ...pageConfig,
      taskCards: Object.fromEntries(Object.entries(taskCards).map(([key, value]) => [key, mapMobileOutboundTaskCardResponse(value)]))
    }
  };
}

function mapStationShipmentToViewModel(item) {
  return {
    id: item.id,
    shipmentId: item.shipment_id,
    awb: item.awb,
    awbId: item.awb_id,
    direction: item.direction,
    flightId: item.flight_id || '',
    flightNo: item.flight_no,
    route: item.route,
    primaryStatus: item.primary_status,
    currentNode: item.current_node,
    fulfillmentStatus: item.fulfillment_status,
    runtimeStatus: item.runtime_status,
    taskStatus: item.task_status,
    documentStatus: item.document_status,
    blocker: item.blocker,
    archived: Boolean(item.archived),
    consignee: item.consignee,
    pieces: item.pieces,
    weight: item.weight,
    priority: item.priority
  };
}

function mapStationShipmentDetailToViewModel(detail) {
  return {
    id: detail.id,
    title: detail.title,
    eyebrow: detail.eyebrow,
    summary: {
      direction: detail.summary.direction,
      route: detail.summary.route,
      runtimeStatus: detail.summary.runtime_status,
      fulfillmentStatus: detail.summary.fulfillment_status,
      priority: detail.summary.priority,
      station: detail.summary.station
    },
    timeline: detail.timeline,
    documents: detail.documents.map((item) => ({
      documentId: item.document_id,
      type: item.type,
      name: item.name,
      status: item.status,
      linkedTask: item.linked_task,
      note: item.note,
      gateIds: item.gate_ids || []
    })),
    tasks: detail.tasks.map((item) => ({
      id: item.id,
      title: item.title,
      owner: item.owner,
      status: item.status,
      due: item.due,
      evidence: item.evidence,
      jumpTo: item.jump_to,
      gateIds: item.gate_ids || []
    })),
    exceptions: detail.exceptions.map((item) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      note: item.note,
      jumpTo: item.jump_to,
      gateId: item.gate_id
    })),
    relationshipRows: detail.relationship_rows,
    gatePolicySummary: Array.isArray(detail.gate_policy_summary)
      ? detail.gate_policy_summary.map((item) => ({
          gateId: item.gate_id,
          node: item.node,
          required: item.required,
          impact: item.impact,
          status: item.status,
          blocker: item.blocker,
          recovery: item.recovery,
          releaseRole: item.release_role
        }))
      : [],
    gatePolicyOverview: detail.gate_policy_overview
      ? {
          total: detail.gate_policy_overview.total,
          blocked: detail.gate_policy_overview.blocked,
          tracked: detail.gate_policy_overview.tracked,
          gateIds: detail.gate_policy_overview.gate_ids || []
        }
      : {
          total: 0,
          blocked: 0,
          tracked: 0,
          gateIds: []
        }
  };
}

function deriveTaskPriority(item) {
  if (item.open_exception_count > 0) return 'P1';
  if (item.blocker_code) return 'P2';
  return 'P3';
}

function mapTaskObjectTo(item) {
  if (item.related_object_type === 'Flight') {
    const flightNo = item.related_object_label?.split(' / ')[0];
    return flightNo ? `/station/inbound/flights/${encodeURIComponent(flightNo)}` : '/station/inbound/flights';
  }

  if (item.related_object_type === 'AWB') {
    const awbNo = item.related_object_label?.split(' / ')[0];
    return awbNo ? `/station/inbound/waybills/${encodeURIComponent(awbNo)}` : '/station/inbound/waybills';
  }

  return '/station/shipments';
}

function mapTaskToViewModel(item) {
  return {
    id: item.task_id,
    title: item.task_type,
    taskType: item.task_type,
    node: item.execution_node,
    executionNode: item.execution_node,
    role: item.assigned_role || '--',
    assignedRole: item.assigned_role || '',
    assignedTeamId: item.assigned_team_id || '',
    assignedWorkerId: item.assigned_worker_id || '',
    assignedTeamName: item.assigned_team_name || '',
    assignedWorkerName: item.assigned_worker_name || '',
    owner: item.assigned_team_name || item.assigned_team_id || item.assigned_worker_name || item.assigned_worker_id || '--',
    due: formatTimeLabel(item.due_at),
    dueAt: item.due_at || '',
    priority: item.task_priority || deriveTaskPriority(item),
    status: item.task_status,
    archived: Boolean(item.archived),
    taskSla: item.task_sla || '',
    gateIds: item.blocker_code ? [item.blocker_code] : [],
    blocker: item.blocker_code || '无',
    evidenceRequired: Boolean(item.evidence_required),
    openExceptionCount: Number(item.open_exception_count || 0),
    relatedObjectType: item.related_object_type,
    relatedObjectId: item.related_object_id,
    relatedObjectLabel: item.related_object_label || item.related_object_id,
    objectTo: mapTaskObjectTo(item)
  };
}

function mapStationTaskDetailToViewModel(detail) {
  if (!detail?.task) return null;

  return {
    taskId: detail.task.task_id,
    stationId: detail.task.station_id,
    taskType: detail.task.task_type,
    executionNode: detail.task.execution_node,
    relatedObjectType: detail.task.related_object_type,
    relatedObjectId: detail.task.related_object_id,
    relatedObjectLabel: detail.task.related_object_label,
    assignedRole: detail.task.assigned_role || '',
    assignedTeamId: detail.task.assigned_team_id || '',
    assignedWorkerId: detail.task.assigned_worker_id || '',
    assignedTeamName: detail.task.assigned_team_name || '',
    assignedWorkerName: detail.task.assigned_worker_name || '',
    taskStatus: detail.task.task_status,
    taskPriority: detail.task.task_priority || 'P3',
    taskSla: detail.task.task_sla || '',
    dueAt: detail.task.due_at || '',
    blockerCode: detail.task.blocker_code || '',
    evidenceRequired: Boolean(detail.task.evidence_required),
    pickLocationId: detail.task.pick_location_id || '',
    dropLocationId: detail.task.drop_location_id || '',
    completedAt: detail.task.completed_at || '',
    verifiedAt: detail.task.verified_at || '',
    archived: Boolean(detail.task.archived),
    lifecycle: detail.lifecycle || {
      can_update: true,
      can_archive: true,
      can_restore: false,
      can_assign: true,
      can_verify: false,
      can_rework: true,
      can_escalate: true,
      can_raise_exception: true
    }
  };
}

function buildTaskSummaryCards(items) {
  const total = items.length;
  const assigned = items.filter((item) => ['Created', 'Assigned', 'Accepted'].includes(item.task_status)).length;
  const inProgress = items.filter((item) => ['Started', 'Evidence Uploaded', 'Exception Raised'].includes(item.task_status)).length;
  const completed = items.filter((item) => ['Completed', 'Verified', 'Closed'].includes(item.task_status)).length;

  return [
    { title: '待领取任务', value: String(assigned), helper: 'Created / Assigned / Accepted', chip: 'Queue', color: 'warning' },
    { title: '处理中任务', value: String(inProgress), helper: 'Started / Evidence / Exception', chip: 'Active', color: 'secondary' },
    { title: '已完成任务', value: String(completed), helper: `总任务 ${total}`, chip: 'Done', color: 'success' },
    {
      title: '阻断任务',
      value: String(items.filter((item) => item.blocker_code || item.open_exception_count > 0).length),
      helper: '带 Gate 或异常的任务',
      chip: 'Block',
      color: 'error'
    }
  ];
}

function mapExceptionToViewModel(item) {
  const objectTo =
    item.related_object_type === 'Flight'
      ? `/station/inbound/flights/${encodeURIComponent(item.related_object_label?.split(' / ')[0] || '')}`
      : item.related_object_type === 'AWB'
        ? `/station/inbound/waybills/${encodeURIComponent(item.related_object_label?.split(' / ')[0] || '')}`
        : '/station/tasks';

  return {
    id: item.exception_id,
    type: item.exception_type,
    object: item.related_object_label,
    owner: [item.owner_role, item.owner_team_id].filter(Boolean).join(' / '),
    sla: item.severity,
    blockedTask: item.blocker_flag ? '阻断中' : '-',
    recoveryAction: item.root_cause || '待补充恢复动作',
    status: item.exception_status,
    objectTo,
    jumpTo: '/station/tasks',
    detailTo: `/station/exceptions/${item.exception_id}`
  };
}

function mapStationExceptionListItemToViewModel(item) {
  const objectTo =
    item.related_object_type === 'Flight'
      ? `/station/inbound/flights/${encodeURIComponent(item.related_object_label?.split(' / ')[0] || '')}`
      : item.related_object_type === 'AWB'
        ? `/station/inbound/waybills/${encodeURIComponent(item.related_object_label?.split(' / ')[0] || '')}`
        : item.related_object_type === 'Shipment'
          ? `/station/shipments/${encodeURIComponent(item.related_object_id || '')}`
          : item.related_object_type === 'Document'
            ? '/station/documents'
            : '/station/tasks';

  return {
    id: item.exception_id,
    exceptionId: item.exception_id,
    type: item.exception_type,
    relatedObjectType: item.related_object_type,
    relatedObjectId: item.related_object_id,
    object: item.related_object_label,
    severity: item.severity,
    ownerRole: item.owner_role || '',
    ownerTeamId: item.owner_team_id || '',
    owner: [item.owner_role, item.owner_team_id].filter(Boolean).join(' / ') || '--',
    status: item.exception_status,
    blockerFlag: Boolean(item.blocker_flag),
    blockedTask: item.blocker_flag ? '阻断中' : '-',
    rootCause: item.root_cause || '',
    actionTaken: item.action_taken || '',
    linkedTaskId: item.linked_task_id || '',
    openedAt: item.opened_at || '',
    archived: Boolean(item.archived || item.deleted_at),
    objectTo,
    jumpTo: item.linked_task_id ? '/station/tasks' : objectTo,
    detailTo: `/station/exceptions/${item.exception_id}`
  };
}

function buildStationExceptionSummaryCards(items, total) {
  const openCount = items.filter((item) => item.status === 'Open').length;
  const progressCount = items.filter((item) => item.status === 'In Progress').length;
  const blockingCount = items.filter((item) => item.blockerFlag).length;
  const archivedCount = items.filter((item) => item.archived).length;

  return [
    { title: '开放异常', value: String(openCount), helper: `当前页 / 总数 ${total}`, chip: 'Open', color: 'warning' },
    { title: '处理中', value: String(progressCount), helper: 'In Progress', chip: 'Working', color: 'secondary' },
    { title: '阻断异常', value: String(blockingCount), helper: 'Blocker Flag = true', chip: 'Block', color: 'error' },
    { title: '已归档', value: String(archivedCount), helper: '软删除 / 归档状态', chip: 'Archived', color: 'success' }
  ];
}

function mapStationExceptionDetailToViewModel(detail) {
  if (!detail) return null;

  const rawGatePolicySummary = Array.isArray(detail.gate_policy_summary)
    ? detail.gate_policy_summary
    : Array.isArray(detail.gatePolicySummary)
      ? detail.gatePolicySummary
      : [];
  const rawGatePolicyOverview = detail.gate_policy_overview || detail.gatePolicyOverview || null;

  return {
    ...detail,
    gatePolicySummary: rawGatePolicySummary.map((item) => ({
      gateId: item.gate_id || item.gateId,
      node: item.node,
      required: item.required,
      impact: item.impact,
      status: item.status,
      blocker: item.blocker,
      recovery: item.recovery,
      releaseRole: item.release_role || item.releaseRole
    })),
    gatePolicyOverview: rawGatePolicyOverview
      ? {
          total: rawGatePolicyOverview.total,
          blocked: rawGatePolicyOverview.blocked,
          tracked: rawGatePolicyOverview.tracked,
          gateIds: rawGatePolicyOverview.gate_ids || rawGatePolicyOverview.gateIds || []
        }
      : {
          total: 0,
          blocked: 0,
          tracked: 0,
          gateIds: []
        }
  };
}

function buildExceptionOverview(items) {
  const openCount = items.filter((item) => item.exception_status === 'Open').length;
  const blockingCount = items.filter((item) => item.blocker_flag).length;
  const p1Count = items.filter((item) => item.severity === 'P1').length;
  const resolvedCount = items.filter((item) => ['Resolved', 'Closed'].includes(item.exception_status)).length;

  return [
    { title: '开放异常', value: String(openCount), helper: '当前待处理异常', chip: 'Open', color: 'warning' },
    { title: '阻断异常', value: String(blockingCount), helper: '会阻断主链推进', chip: 'Block', color: 'error' },
    { title: 'P1 异常', value: String(p1Count), helper: '高优先级异常', chip: 'Priority', color: 'secondary' },
    { title: '已恢复/关闭', value: String(resolvedCount), helper: `总异常 ${items.length}`, chip: 'Closed', color: 'success' }
  ];
}

function groupRowsByKey(rows, key) {
  return rows.reduce((acc, item) => {
    const groupKey = String(item?.[key] || '').trim();
    if (!groupKey) return acc;
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {});
}

function normalizeStationResourceVehicle(item) {
  const tripId = String(item?.tripId || item?.trip_id || item?.loading_plan_id || item?.id || item?.transferId || '').trim();
  const flowKey = String(item?.flowKey || item?.flow_key || (tripId.toUpperCase().includes('TAIL') ? 'tailhaul' : 'headhaul') || 'headhaul').trim();
  const flowLabel = String(item?.flowLabel || item?.flow_label || '').trim();
  const route = String(item?.route || item?.subtitle || '').trim() || (flowKey === 'tailhaul' ? 'MME -> Delivery' : 'URC -> 出港货站');
  const plate = String(item?.plate || item?.truckPlate || item?.truck_plate || '').trim();
  const driver = String(item?.driver || item?.driverName || item?.driver_name || '').trim();
  const driverPhone = String(item?.driverPhone || item?.driver_phone || '').trim();
  const collectionNote = String(item?.collectionNote || item?.collection_note || '').trim();
  const status = String(item?.status || item?.dispatch_status || item?.plan_status || '').trim() || 'pending_dispatch';
  const statusLabel = String(item?.statusLabel || item?.status_label || item?.stage || '').trim() || status;
  const stage = statusLabel;
  const priority = String(item?.priority || item?.priority_code || '').trim() || 'P2';
  const priorityLabel = String(item?.priorityLabel || item?.priority_label || '').trim() || priority;
  const sla = String(item?.sla || '').trim() || '待补充';
  const officePlan = String(item?.officePlan || item?.office_plan || item?.note || '').trim() || '后台已完成 Trip 编排。';
  const pdaExec = String(item?.pdaExec || item?.pda_exec || '').trim() || '现场执行发车、到站交接';

  return {
    tripId: tripId || 'TRIP-UNKNOWN',
    flowKey,
    flowLabel,
    route,
    plate,
    driver,
    driverPhone,
    collectionNote,
    stage,
    status,
    statusLabel,
    priority,
    priorityLabel,
    sla,
    awbs: Array.isArray(item?.awbs) ? item.awbs : [],
    pallets: Array.isArray(item?.pallets) ? item.pallets : [],
    officePlan,
    pdaExec,
    archived: Boolean(item?.archived || item?.deleted_at),
    updatedAt: item?.updated_at || item?.updatedAt || '',
    createdAt: item?.created_at || item?.createdAt || ''
  };
}

export function useGetInboundFlights(params = {}) {
  const endpoint = `${endpoints.inboundFlights}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = toArray(data?.items).map(mapInboundFlightToViewModel);
  const inboundLifecycle = [
    {
      label: '待到达',
      count: liveItems.filter((item) => ['Scheduled', 'Pre-Arrival'].includes(item.status)).length,
      note: 'ETA 前预排、任务与单证准备'
    },
    {
      label: '已落地',
      count: liveItems.filter((item) => item.status === 'Landed').length,
      note: '已进入进港处理 / 理货链'
    },
    {
      label: '异常关注',
      count: liveItems.filter((item) => ['Delayed', 'Diverted', 'Cancelled'].includes(item.status)).length,
      note: '延误 / 备降 / 取消需人工跟进'
    }
  ];
  const inboundFlightPage = data
    ? {
        items: liveItems,
        page: data.page || 1,
        page_size: data.page_size || 20,
        total: data.total || liveItems.length
      }
    : { items: [], page: 1, page_size: 20, total: 0 };

  return useMemo(
    () => ({
      inboundFlights: liveItems,
      inboundFlightPage,
      inboundLifecycle,
      inboundFlightsLoading: isLoading,
      inboundFlightsError: error,
      inboundFlightsValidating: isValidating,
      inboundFlightsUsingMock: Boolean(error || !liveItems.length)
    }),
    [inboundFlightPage, inboundLifecycle, liveItems, error, isLoading, isValidating]
  );
}

export function useGetInboundFlightCreateOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.inboundFlightCreateOptions, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      inboundFlightCreateOptions: toArray(data?.data?.sourceOptions).map(mapSelectOption),
      inboundFlightServiceLevels: toArray(data?.data?.serviceLevelOptions).map(mapSelectOption),
      inboundFlightRuntimeStatuses: toArray(data?.data?.runtimeStatusOptions).map(mapSelectOption),
      inboundFlightCreateOptionsLoading: isLoading,
      inboundFlightCreateOptionsError: error,
      inboundFlightCreateOptionsValidating: isValidating,
      inboundFlightCreateOptionsUsingMock: Boolean(error || !data?.data?.sourceOptions?.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationWaybillOptions(direction = 'inbound') {
  const endpoint = `${endpoints.stationWaybillOptions}${buildQueryString({ direction })}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      flightOptions: toArray(data?.data?.flightOptions).map(mapSelectOption),
      awbTypeOptions: toArray(data?.data?.awbTypeOptions).map(mapSelectOption),
      currentNodeOptions: toArray(data?.data?.currentNodeOptions).map(mapSelectOption),
      noaStatusOptions: toArray(data?.data?.noaStatusOptions).map(mapSelectOption),
      podStatusOptions: toArray(data?.data?.podStatusOptions).map(mapSelectOption),
      transferStatusOptions: toArray(data?.data?.transferStatusOptions).map(mapSelectOption),
      manifestStatusOptions: toArray(data?.data?.manifestStatusOptions).map(mapSelectOption),
      stationWaybillOptionsLoading: isLoading,
      stationWaybillOptionsError: error,
      stationWaybillOptionsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetInboundWaybills(params = {}) {
  const endpoint = `${endpoints.inboundWaybills}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = toArray(data?.items).map(mapInboundWaybillToViewModel);
  const inboundWaybillPage = data
    ? {
        items: liveItems,
        page: data.page || 1,
        page_size: data.page_size || 20,
        total: data.total || liveItems.length
      }
    : { items: [], page: 1, page_size: 20, total: 0 };

  return useMemo(
    () => ({
      inboundWaybills: liveItems,
      inboundWaybillPage,
      inboundWaybillsLoading: isLoading,
      inboundWaybillsError: error,
      inboundWaybillsValidating: isValidating,
      inboundWaybillsUsingMock: Boolean(error || !liveItems.length)
    }),
    [error, inboundWaybillPage, isLoading, isValidating, liveItems]
  );
}

export function useGetOutboundWaybills(params = {}) {
  const endpoint = `${endpoints.outboundWaybills}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = toArray(data?.items).map(mapOutboundWaybillToViewModel);
  const outboundWaybillPage = data
    ? {
        items: liveItems,
        page: data.page || 1,
        page_size: data.page_size || 20,
        total: data.total || liveItems.length
      }
    : { items: [], page: 1, page_size: 20, total: 0 };

  return useMemo(
    () => ({
      outboundWaybills: liveItems,
      outboundWaybillPage,
      outboundWaybillsLoading: isLoading,
      outboundWaybillsError: error,
      outboundWaybillsValidating: isValidating,
      outboundWaybillsUsingMock: Boolean(error || !liveItems.length)
    }),
    [error, isLoading, isValidating, liveItems, outboundWaybillPage]
  );
}

export function useGetStationDashboardOverview() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationDashboardOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;

  return useMemo(
    () => ({
      stationDashboardCards: toArray(liveData.stationDashboardCards),
      inboundFlights: toArray(liveData.inboundFlights),
      outboundFlights: toArray(liveData.outboundFlights),
      stationBlockerQueue: toArray(liveData.stationBlockerQueue),
      stationReviewQueue: toArray(liveData.stationReviewQueue),
      stationTransferRows: toArray(liveData.stationTransferRows),
      stationDashboardLoading: isLoading,
      stationDashboardError: error,
      stationDashboardValidating: isValidating,
      stationDashboardUsingMock: Boolean(
        error ||
          !liveData?.stationDashboardCards?.length ||
          !liveData?.inboundFlights?.length ||
          !liveData?.outboundFlights?.length
      )
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationInboundOverview() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationInboundOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;

  return useMemo(
    () => ({
      inboundFlights: toArray(liveData.inboundFlights),
      inboundLifecycleRows: toArray(liveData.inboundLifecycleRows),
      stationBlockerQueue: toArray(liveData.stationBlockerQueue),
      stationReviewQueue: toArray(liveData.stationReviewQueue),
      inboundDocumentGates: toArray(liveData.inboundDocumentGates),
      stationTransferRows: toArray(liveData.stationTransferRows),
      stationInboundLoading: isLoading,
      stationInboundError: error,
      stationInboundValidating: isValidating,
      stationInboundUsingMock: Boolean(
        error ||
          !liveData?.inboundFlights?.length ||
          !liveData?.inboundLifecycleRows?.length ||
          !liveData?.stationBlockerQueue?.length ||
          !liveData?.stationReviewQueue?.length ||
          !liveData?.inboundDocumentGates?.length ||
          !liveData?.stationTransferRows?.length
      )
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationInboundMobileOverview() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationInboundMobileOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;

  return useMemo(
    () => ({
      inboundFlights: liveData.inboundFlights || [],
      mobileTasks: liveData.mobileTasks || [],
      inboundMobileSummary: liveData.summary || {
        totalFlights: 0,
        totalTasks: 0,
        queuedTasks: 0,
        activeTasks: 0,
        completedTasks: 0
      },
      stationInboundMobileLoading: isLoading,
      stationInboundMobileError: error,
      stationInboundMobileValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationOutboundOverview() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationOutboundOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;

  return useMemo(
    () => ({
      outboundFlights: toArray(liveData.outboundFlights),
      ffmForecastRows: toArray(liveData.ffmForecastRows),
      manifestRows: toArray(liveData.manifestRows),
      manifestSummary: liveData.manifestSummary || EMPTY_MANIFEST_SUMMARY,
      masterAwbRows: toArray(liveData.masterAwbRows),
      receiptRows: toArray(liveData.receiptRows),
      uwsRows: toArray(liveData.uwsRows),
      outboundDocumentGates: toArray(liveData.outboundDocumentGates),
      outboundLifecycleRows: toArray(liveData.outboundLifecycleRows),
      stationBlockerQueue: toArray(liveData.stationBlockerQueue),
      stationOutboundLoading: isLoading,
      stationOutboundError: error,
      stationOutboundValidating: isValidating,
      stationOutboundUsingMock: Boolean(
        error ||
          !liveData?.outboundFlights?.length ||
          !liveData?.ffmForecastRows?.length ||
          !liveData?.manifestRows?.length ||
          !liveData?.masterAwbRows?.length ||
          !liveData?.receiptRows?.length ||
          !liveData?.uwsRows?.length ||
          !liveData?.outboundDocumentGates?.length ||
          !liveData?.outboundLifecycleRows?.length ||
          !liveData?.stationBlockerQueue?.length
      )
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetOutboundFlights(params = {}) {
  const endpoint = `${endpoints.outboundFlights}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = toArray(data?.items).map(mapOutboundFlightToViewModel);
  const outboundFlightPage = data
    ? {
        items: liveItems,
        page: data.page || 1,
        page_size: data.page_size || 20,
        total: data.total || liveItems.length
      }
    : { items: [], page: 1, page_size: 20, total: 0 };

  return useMemo(
    () => ({
      outboundFlights: liveItems,
      outboundFlightPage,
      outboundFlightsLoading: isLoading,
      outboundFlightsError: error,
      outboundFlightsValidating: isValidating,
      outboundFlightsUsingMock: Boolean(error || !liveItems.length)
    }),
    [error, isLoading, isValidating, liveItems, outboundFlightPage]
  );
}

export function useGetStationResourcesOverview() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationResourcesOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;

  return useMemo(
    () => ({
      resourceTeams: toArray(liveData.resourceTeams),
      resourceZones: toArray(liveData.resourceZones),
      resourceDevices: toArray(liveData.resourceDevices),
      resourcesLoading: isLoading,
      resourcesError: error,
      resourcesValidating: isValidating,
      resourcesUsingMock: Boolean(error || !liveData?.resourceTeams?.length || !liveData?.resourceZones?.length || !liveData?.resourceDevices?.length)
    }),
    [liveData, error, isLoading, isValidating]
  );
}

export function useGetStationReportsOverview() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationReportsOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;

  return useMemo(
    () => ({
      reportMeta: liveData.reportMeta || null,
      stationReportCards: toArray(liveData.stationReportCards),
      shiftReportRows: toArray(liveData.shiftReportRows),
      pdaKpiRows: toArray(liveData.pdaKpiRows),
      stationFileReportRows: toArray(liveData.stationFileReportRows),
      outboundActionRows: toArray(liveData.outboundActionRows),
      stationDailyReportRows: toArray(liveData.stationDailyReportRows),
      qualitySummaryRows: toArray(liveData.qualitySummaryRows),
      qualityChecklistRows: toArray(liveData.qualityChecklistRows),
      refreshPolicyRows: toArray(liveData.refreshPolicyRows),
      traceabilityRows: toArray(liveData.traceabilityRows),
      dailyKeyMetrics: toArray(liveData?.dailyReport?.keyMetrics),
      stationReportsLoading: isLoading,
      stationReportsError: error,
      stationReportsValidating: isValidating,
      stationReportsUsingMock: Boolean(
        error ||
          !liveData?.reportMeta ||
          !liveData?.stationReportCards?.length ||
          !liveData?.shiftReportRows?.length ||
          !liveData?.pdaKpiRows?.length ||
          !liveData?.stationFileReportRows?.length ||
          !liveData?.outboundActionRows?.length
      )
    }),
    [liveData, error, isLoading, isValidating]
  );
}

export function useGetStationResourceVehicleOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationResourcesVehicleOptions, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;

  return useMemo(
    () => ({
      flowOptions: toArray(liveData.flows),
      statusOptions: toArray(liveData.statuses),
      priorityOptions: toArray(liveData.priorities),
      stationVehicleOptionsLoading: isLoading,
      stationVehicleOptionsError: error,
      stationVehicleOptionsValidating: isValidating
    }),
    [liveData, error, isLoading, isValidating]
  );
}

export function useGetStationResourceVehicles(params = {}) {
  const endpoint = `${endpoints.stationResourcesVehicles}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;
  const liveItems = toArray(liveData.vehicleRows || liveData.items).map(normalizeStationResourceVehicle);

  return useMemo(
    () => ({
      stationResourceVehicles: liveItems,
      vehicleRows: liveItems,
      vehiclePage: liveData.vehiclePage || {
        items: liveItems,
        page: 1,
        page_size: 20,
        total: liveItems.length
      },
      stationResourceVehiclesLoading: isLoading,
      stationResourceVehiclesError: error,
      stationResourceVehiclesValidating: isValidating,
      stationResourceVehiclesUsingMock: Boolean(error)
    }),
    [liveData, error, isLoading, isValidating, liveItems]
  );
}

export async function createStationResourceVehicle(payload) {
  const data = await stationPoster(endpoints.stationResourcesVehicles, payload);

  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationResourcesVehicles)),
    mutate(endpoints.stationResourcesVehicleOptions)
  ]);

  return data?.data || data;
}

export async function updateStationResourceVehicle(vehicleId, payload) {
  const data = await stationPatcher(endpoints.stationResourcesVehicleDetail(vehicleId), payload);

  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationResourcesVehicles)),
    mutate(endpoints.stationResourcesVehicleDetail(vehicleId))
  ]);

  return data?.data || data;
}

export async function archiveStationResourceVehicle(vehicleId) {
  const data = await stationDeleter(endpoints.stationResourcesVehicleDetail(vehicleId));

  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationResourcesVehicles)),
    mutate(endpoints.stationResourcesVehicleDetail(vehicleId))
  ]);

  return data?.data || data;
}

export async function upsertStationResourceVehicle(payload) {
  const data = await stationPoster(endpoints.stationResourcesVehicles, payload);

  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationResourcesVehicles)),
    mutate(endpoints.stationResourcesVehicleOptions)
  ]);

  return data?.data || data;
}

export function useGetStationFlightOptions(direction = 'inbound') {
  const endpoint = `${endpoints.stationFlightOptions}${buildQueryString({ direction })}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      flightOptions: toArray(data?.data?.flightOptions).map(mapSelectOption),
      sourceOptions: toArray(data?.data?.sourceOptions).map(mapSelectOption),
      destinationOptions: toArray(data?.data?.destinationOptions).map(mapSelectOption),
      serviceLevelOptions: toArray(data?.data?.serviceLevels).map(mapSelectOption),
      runtimeStatusOptions: toArray(data?.data?.runtimeStatuses).map(mapSelectOption),
      stationFlightOptionsLoading: isLoading,
      stationFlightOptionsError: error,
      stationFlightOptionsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export async function createStationInboundFlight(payload) {
  const data = await stationPoster(endpoints.inboundFlights, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.inboundFlights)),
    mutate(`${endpoints.stationFlightOptions}${buildQueryString({ direction: 'inbound' })}`),
    mutate(endpoints.inboundFlightCreateOptions)
  ]);
  return data?.data || data;
}

export async function updateStationInboundFlight(flightId, payload) {
  const data = await stationPatcher(`${endpoints.inboundFlights}/${encodeURIComponent(flightId)}`, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.inboundFlights)),
    mutate(`${endpoints.inboundFlights}/${encodeURIComponent(flightId)}`),
    mutate(`${endpoints.stationFlightOptions}${buildQueryString({ direction: 'inbound' })}`)
  ]);
  return data?.data || data;
}

export async function archiveStationInboundFlight(flightId) {
  const data = await stationDeleter(`${endpoints.inboundFlights}/${encodeURIComponent(flightId)}`);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.inboundFlights)),
    mutate(`${endpoints.inboundFlights}/${encodeURIComponent(flightId)}`),
    mutate(`${endpoints.stationFlightOptions}${buildQueryString({ direction: 'inbound' })}`)
  ]);
  return data?.data || data;
}

export async function createStationOutboundFlight(payload) {
  const data = await stationPoster(endpoints.outboundFlights, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.outboundFlights)),
    mutate(`${endpoints.stationFlightOptions}${buildQueryString({ direction: 'outbound' })}`)
  ]);
  return data?.data || data;
}

export async function updateStationOutboundFlight(flightId, payload) {
  const data = await stationPatcher(`${endpoints.outboundFlights}/${encodeURIComponent(flightId)}`, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.outboundFlights)),
    mutate(`${endpoints.outboundFlights}/${encodeURIComponent(flightId)}`),
    mutate(`${endpoints.stationFlightOptions}${buildQueryString({ direction: 'outbound' })}`)
  ]);
  return data?.data || data;
}

export async function archiveStationOutboundFlight(flightId) {
  const data = await stationDeleter(`${endpoints.outboundFlights}/${encodeURIComponent(flightId)}`);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.outboundFlights)),
    mutate(`${endpoints.outboundFlights}/${encodeURIComponent(flightId)}`),
    mutate(`${endpoints.stationFlightOptions}${buildQueryString({ direction: 'outbound' })}`)
  ]);
  return data?.data || data;
}

export function useGetInboundFlightDetail(flightNo) {
  const listKey = flightNo ? `${endpoints.inboundFlights}${buildQueryString({ flight_no: flightNo, page_size: 1, include_archived: true })}` : null;
  const { data: listData, error: listError } = useSWR(listKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const matchedFlight = listData?.items?.find((item) => item.flight_no === flightNo);
  const detailKey = matchedFlight?.flight_id ? `${endpoints.inboundFlights}/${matchedFlight.flight_id}` : null;
  const { data, isLoading, error, isValidating } = useSWR(detailKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      inboundFlightDetail: data?.data || null,
      inboundFlightDetailLoading: isLoading,
      inboundFlightDetailError: error || listError,
      inboundFlightDetailValidating: isValidating,
      inboundFlightDetailUsingMock: Boolean(error || listError || !data?.data)
    }),
    [data, error, isLoading, isValidating, listError]
  );
}

export function useGetInboundWaybillDetail(awbNo) {
  const listKey = awbNo
    ? `${endpoints.inboundWaybills}${buildQueryString({ awb_no: awbNo, page_size: 1, include_archived: true })}`
    : null;
  const { data: listData, error: listError } = useSWR(listKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const matchedWaybill = listData?.items?.find((item) => item.awb_no === awbNo);
  const detailKey = matchedWaybill?.awb_id ? `${endpoints.inboundWaybills}/${matchedWaybill.awb_id}` : null;
  const { data, isLoading, error, isValidating } = useSWR(detailKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      inboundWaybillDetail: data?.data || null,
      inboundWaybillDetailLoading: isLoading,
      inboundWaybillDetailError: error || listError,
      inboundWaybillDetailValidating: isValidating,
      inboundWaybillDetailUsingMock: Boolean(error || listError || !data?.data)
    }),
    [data, error, isLoading, isValidating, listError]
  );
}

export function useGetOutboundFlightDetail(flightNo) {
  const listKey = flightNo ? `${endpoints.outboundFlights}${buildQueryString({ flight_no: flightNo, page_size: 1, include_archived: true })}` : null;
  const { data: listData, error: listError } = useSWR(listKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const matchedFlight = listData?.items?.find((item) => item.flight_no === flightNo);
  const detailKey = matchedFlight?.flight_id ? `${endpoints.outboundFlights}/${matchedFlight.flight_id}` : null;
  const { data, isLoading, error, isValidating } = useSWR(detailKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      outboundFlightDetail: data?.data || null,
      outboundFlightDetailLoading: isLoading,
      outboundFlightDetailError: error || listError,
      outboundFlightDetailValidating: isValidating,
      outboundFlightDetailUsingMock: Boolean(error || listError || !data?.data)
    }),
    [data, error, isLoading, isValidating, listError]
  );
}

export function useGetOutboundWaybillDetail(awbNo) {
  const listKey = awbNo
    ? `${endpoints.outboundWaybills}${buildQueryString({ awb_no: awbNo, page_size: 1, include_archived: true })}`
    : null;
  const { data: listData, error: listError } = useSWR(listKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const matchedWaybill = listData?.items?.find((item) => item.awb_no === awbNo);
  const detailKey = matchedWaybill?.awb_id ? `${endpoints.outboundWaybills}/${matchedWaybill.awb_id}` : null;
  const { data, isLoading, error, isValidating } = useSWR(detailKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      outboundWaybillDetail: data?.data || null,
      outboundWaybillDetailLoading: isLoading,
      outboundWaybillDetailError: error || listError,
      outboundWaybillDetailValidating: isValidating,
      outboundWaybillDetailUsingMock: Boolean(error || listError || !data?.data)
    }),
    [data, error, isLoading, isValidating, listError]
  );
}

export function useGetStationShipments(params = {}) {
  const endpoint = `${endpoints.stationShipments}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      stationShipments: data?.items?.map(mapStationShipmentToViewModel) || [],
      stationShipmentPage: {
        page: Number(data?.page || params.page || 1),
        pageSize: Number(data?.page_size || params.page_size || 20),
        total: Number(data?.total || 0)
      },
      stationShipmentsLoading: isLoading,
      stationShipmentsError: error,
      stationShipmentsValidating: isValidating,
      stationShipmentsUsingMock: Boolean(error)
    }),
    [data, error, isLoading, isValidating, params.page, params.page_size]
  );
}

export function useGetStationShipmentOptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationShipmentOptions, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      directionOptions: toArray(data?.data?.directionOptions).map(mapSelectOption),
      flightOptions: toArray(data?.data?.flightOptions).map(mapSelectOption),
      currentNodeOptions: toArray(data?.data?.currentNodeOptions).map(mapSelectOption),
      fulfillmentStatusOptions: toArray(data?.data?.fulfillmentStatusOptions).map(mapSelectOption),
      blockerStateOptions: toArray(data?.data?.blockerStateOptions).map(mapSelectOption),
      stationShipmentOptionsLoading: isLoading,
      stationShipmentOptionsError: error,
      stationShipmentOptionsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationShipmentDetail(shipmentId) {
  const detailKey = shipmentId ? `${endpoints.stationShipments}/${shipmentId}` : null;
  const { data, isLoading, error, isValidating } = useSWR(detailKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      stationShipmentDetail: data?.data ? mapStationShipmentDetailToViewModel(data.data) : null,
      stationShipmentDetailLoading: isLoading,
      stationShipmentDetailError: error,
      stationShipmentDetailValidating: isValidating,
      stationShipmentDetailUsingMock: Boolean(error || !data?.data)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetObjectAudit(objectType, objectKey, objectId) {
  const requestKey =
    objectType && (objectKey || objectId)
      ? [
          endpoints.auditObject,
          {
            params: {
              object_type: objectType,
              ...(objectKey ? { object_key: objectKey } : {}),
              ...(objectId ? { object_id: objectId } : {})
            }
          }
        ]
      : null;

  const { data, isLoading, error, isValidating } = useSWR(requestKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      objectAuditEvents: data?.data?.events || [],
      objectAuditTransitions: data?.data?.transitions || [],
      objectAuditLoading: isLoading,
      objectAuditError: error,
      objectAuditValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationExceptionDetail(exceptionId) {
  const detailKey = exceptionId ? `${endpoints.stationExceptions}/${exceptionId}` : null;
  const { data, isLoading, error, isValidating } = useSWR(detailKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      stationExceptionDetail: mapStationExceptionDetailToViewModel(data?.data),
      stationExceptionDetailLoading: isLoading,
      stationExceptionDetailError: error,
      stationExceptionDetailValidating: isValidating,
      stationExceptionDetailUsingMock: Boolean(error || !data?.data)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationExceptionOptions(query = {}) {
  const endpoint = `${endpoints.stationExceptionOptions}${buildQueryString(query)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      exceptionTypeOptions: toArray(data?.data?.exception_type_options).map(mapSelectOption),
      severityOptions: toArray(data?.data?.severity_options).map(mapSelectOption),
      exceptionStatusOptions: toArray(data?.data?.exception_status_options).map(mapSelectOption),
      ownerRoleOptions: toArray(data?.data?.owner_role_options).map(mapSelectOption),
      relatedObjectTypeOptions: toArray(data?.data?.related_object_type_options).map(mapSelectOption),
      relatedObjectOptions: toArray(data?.data?.related_object_options).map(mapSelectOption),
      teamOptions: toArray(data?.data?.team_options).map(mapSelectOption),
      blockerStateOptions: toArray(data?.data?.blocker_state_options).map(mapSelectOption),
      stationExceptionOptionsLoading: isLoading,
      stationExceptionOptionsError: error,
      stationExceptionOptionsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationExceptionList(params = {}) {
  const endpoint = `${endpoints.stationExceptions}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = toArray(data?.items).map(mapStationExceptionListItemToViewModel);

  return useMemo(
    () => ({
      stationExceptionRows: liveItems,
      stationExceptionPage: {
        items: liveItems,
        page: Number(data?.page || params.page || 1),
        page_size: Number(data?.page_size || params.page_size || 20),
        total: Number(data?.total || 0)
      },
      stationExceptionSummaryCards: buildStationExceptionSummaryCards(liveItems, Number(data?.total || 0)),
      stationExceptionListLoading: isLoading,
      stationExceptionListError: error,
      stationExceptionListValidating: isValidating,
      stationExceptionListUsingMock: Boolean(error)
    }),
    [data, error, isLoading, isValidating, liveItems, params.page, params.page_size]
  );
}

export function useGetStationTasks() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationTasksOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || {};

  return useMemo(
    () => ({
      stationTasks: Array.isArray(liveData.stationTasks) ? liveData.stationTasks : EMPTY_ARRAY,
      stationTaskSummaryCards: Array.isArray(liveData.stationTaskSummaryCards) ? liveData.stationTaskSummaryCards : EMPTY_ARRAY,
      stationTaskBlockerQueue: Array.isArray(liveData.stationTaskBlockerQueue) ? liveData.stationTaskBlockerQueue : EMPTY_ARRAY,
      stationTaskReviewQueue: Array.isArray(liveData.stationTaskReviewQueue) ? liveData.stationTaskReviewQueue : EMPTY_ARRAY,
      stationTaskInboundDocumentGates: Array.isArray(liveData.stationTaskInboundDocumentGates) ? liveData.stationTaskInboundDocumentGates : EMPTY_ARRAY,
      stationTaskOutboundDocumentGates: Array.isArray(liveData.stationTaskOutboundDocumentGates) ? liveData.stationTaskOutboundDocumentGates : EMPTY_ARRAY,
      stationTaskTimelineRows: Array.isArray(liveData.stationTaskTimelineRows) ? liveData.stationTaskTimelineRows : EMPTY_ARRAY,
      stationTaskGateEvaluationRows: Array.isArray(liveData.stationTaskGateEvaluationRows) ? liveData.stationTaskGateEvaluationRows : EMPTY_ARRAY,
      stationTaskExceptionRows: Array.isArray(liveData.stationTaskExceptionRows) ? liveData.stationTaskExceptionRows : EMPTY_ARRAY,
      stationTasksLoading: isLoading,
      stationTasksError: error,
      stationTasksValidating: isValidating,
      stationTasksUsingMock: Boolean(error)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationTaskOptions(query = {}) {
  const endpoint = `${endpoints.stationTaskOptions}${buildQueryString(query)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      taskStatusOptions: toArray(data?.data?.task_status_options).map(mapSelectOption),
      taskPriorityOptions: toArray(data?.data?.task_priority_options).map(mapSelectOption),
      assignedRoleOptions: toArray(data?.data?.assigned_role_options).map(mapSelectOption),
      taskTypeOptions: toArray(data?.data?.task_type_options).map(mapSelectOption),
      executionNodeOptions: toArray(data?.data?.execution_node_options).map(mapSelectOption),
      relatedObjectTypeOptions: toArray(data?.data?.related_object_type_options).map(mapSelectOption),
      relatedObjectOptions: toArray(data?.data?.related_object_options).map(mapSelectOption),
      teamOptions: toArray(data?.data?.team_options).map(mapSelectOption),
      workerOptions: toArray(data?.data?.worker_options).map(mapSelectOption),
      stationTaskOptionsLoading: isLoading,
      stationTaskOptionsError: error,
      stationTaskOptionsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationTaskList(params = {}) {
  const endpoint = `${endpoints.stationTasks}${buildQueryString(params)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = toArray(data?.items).map(mapTaskToViewModel);

  return useMemo(
    () => ({
      stationTaskRows: liveItems,
      stationTaskPage: {
        items: liveItems,
        page: Number(data?.page || params.page || 1),
        page_size: Number(data?.page_size || params.page_size || 20),
        total: Number(data?.total || 0)
      },
      stationTaskSummaryCards: buildTaskSummaryCards(toArray(data?.items)),
      stationTaskListLoading: isLoading,
      stationTaskListError: error,
      stationTaskListValidating: isValidating,
      stationTaskListUsingMock: Boolean(error)
    }),
    [data, error, isLoading, isValidating, liveItems, params.page, params.page_size]
  );
}

export function useGetStationTaskDetail(taskId) {
  const detailKey = taskId ? `${endpoints.stationTasks}/${encodeURIComponent(taskId)}` : null;
  const { data, isLoading, error, isValidating } = useSWR(detailKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      stationTaskDetail: mapStationTaskDetailToViewModel(data?.data),
      stationTaskDetailLoading: isLoading,
      stationTaskDetailError: error,
      stationTaskDetailValidating: isValidating,
      stationTaskDetailUsingMock: Boolean(error || !data?.data)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationExceptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationExceptionsOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;

  return useMemo(
    () => ({
      stationExceptions: toArray(liveData.stationExceptions),
      stationExceptionOverview: toArray(liveData.stationExceptionOverview),
      stationBlockerQueue: toArray(liveData.stationBlockerQueue),
      stationRecoveryRows: toArray(liveData.stationRecoveryRows),
      stationExceptionsLoading: isLoading,
      stationExceptionsError: error,
      stationExceptionsValidating: isValidating,
      stationExceptionsUsingMock: Boolean(error)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetMobileTasks() {
  const { data, isLoading, error, isValidating } = useSWR('/api/v1/mobile/tasks', stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      mobileTasks: data?.items || [],
      mobileTasksLoading: isLoading,
      mobileTasksError: error,
      mobileTasksValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetMobileInboundOverview() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.mobileInboundOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;

  return useMemo(
    () => ({
      mobileInboundSession: {
        roleKey: liveData.session?.roleKey || liveData.session?.role_key || '',
        roleLabel: liveData.session?.roleLabel || liveData.session?.role_label || '',
        stationCode: liveData.session?.stationCode || liveData.session?.station_code || '',
        userId: liveData.session?.userId || liveData.session?.user_id || '',
        roleIds: toArray(liveData.session?.roleIds || liveData.session?.role_ids),
        stationScope: toArray(liveData.session?.stationScope || liveData.session?.station_scope),
        clientSource: liveData.session?.clientSource || liveData.session?.client_source || '',
        tenantId: liveData.session?.tenantId || liveData.session?.tenant_id || ''
      },
      mobileInboundRoleView: mapMobileRoleViewResponse(liveData.roleView || liveData.role_view),
      mobileInboundAvailableTabs: toArray(liveData.availableTabs || liveData.available_tabs),
      mobileInboundAvailableActions: toArray(liveData.availableActions || liveData.available_actions),
      mobileInboundFlights: toArray(liveData.inboundFlights).map(mapMobileInboundFlightToViewModel),
      mobileInboundTasks: toArray(liveData.mobileTasks),
      mobileInboundSummary: liveData.summary || EMPTY_MOBILE_INBOUND_SUMMARY,
      mobileInboundLoading: isLoading,
      mobileInboundError: error,
      mobileInboundValidating: isValidating,
      mobileInboundUsingMock: Boolean(error)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetMobileOutboundOverview() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.mobileOutboundOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = mapMobileOutboundOverviewResponse(data?.data || EMPTY_OBJECT);

  return useMemo(
    () => ({
      ...liveData,
      mobileOutboundLoading: isLoading,
      mobileOutboundError: error,
      mobileOutboundValidating: isValidating,
      mobileOutboundUsingMock: Boolean(error || !liveData.mobileOutboundFlights.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetMobileOutboundDetail(flightNo) {
  const requestKey = flightNo ? endpoints.mobileOutboundFlightDetail(flightNo) : null;
  const { data, isLoading, error, isValidating } = useSWR(requestKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = mapMobileOutboundDetailResponse(data?.data || EMPTY_OBJECT);

  return useMemo(
    () => ({
      mobileOutboundFlightDetail: liveData,
      mobileOutboundFlightDetailLoading: isLoading,
      mobileOutboundFlightDetailError: error,
      mobileOutboundFlightDetailValidating: isValidating,
      mobileOutboundFlightDetailUsingMock: Boolean(error || !liveData?.flight?.flightNo)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetMobileOutboundOptions(flightNo) {
  const requestKey = flightNo ? endpoints.mobileOutboundOptions(flightNo) : null;
  const { data, isLoading, error, isValidating } = useSWR(requestKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const payload = data?.data || EMPTY_OBJECT;

  return useMemo(
    () => ({
      mobileOutboundOptions: {
        receiptStatusOptions: toArray(payload?.receiptStatusOptions).map(mapSelectOption),
        reviewStatusOptions: toArray(payload?.reviewStatusOptions).map(mapSelectOption),
        containerStatusOptions: toArray(payload?.containerStatusOptions).map(mapSelectOption),
        offloadStatusOptions: toArray(payload?.offloadStatusOptions).map(mapSelectOption),
        awbOptions: toArray(payload?.awbOptions).map(mapSelectOption),
        containerOptions: toArray(payload?.containerOptions).map(mapSelectOption)
      },
      mobileOutboundOptionsLoading: isLoading,
      mobileOutboundOptionsError: error,
      mobileOutboundOptionsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetMobileInboundDetail(flightNo) {
  const requestKey = flightNo ? endpoints.mobileInboundFlightDetail(flightNo) : null;
  const { data, isLoading, error, isValidating } = useSWR(requestKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = mapMobileInboundDetailResponse(data?.data || EMPTY_OBJECT);

  return useMemo(
    () => ({
      mobileInboundFlightDetail: liveData,
      mobileInboundFlightDetailLoading: isLoading,
      mobileInboundFlightDetailError: error,
      mobileInboundFlightDetailValidating: isValidating,
      mobileInboundFlightDetailUsingMock: Boolean(error || !liveData?.flight?.flightNo)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetMobileNodeFlow(flowKey, params = {}) {
  const requestKey = flowKey ? [endpoints.mobileNodeFlow(flowKey), { params }] : null;
  const { data, isLoading, error, isValidating } = useSWR(requestKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = mapMobileNodeResponse(data?.data || data || EMPTY_OBJECT);

  return useMemo(
    () => ({
      ...liveData,
      mobileNodePage: {
        items: liveData.items,
        page: Number(liveData.page || params.page || 1),
        page_size: Number(liveData.page_size || params.page_size || 20),
        total: Number(liveData.total || 0)
      },
      mobileNodeLoading: isLoading,
      mobileNodeError: error,
      mobileNodeValidating: isValidating,
      mobileNodeUsingMock: Boolean(error || !liveData.items.length)
    }),
    [data, error, isLoading, isValidating, liveData, params.page, params.page_size]
  );
}

export function useGetMobileNodeDetail(flowKey, itemId) {
  const requestKey = flowKey && itemId ? endpoints.mobileNodeDetail(flowKey, itemId) : null;
  const { data, isLoading, error, isValidating } = useSWR(requestKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = mapMobileNodeResponse(data?.data || data || EMPTY_OBJECT);

  return useMemo(
    () => ({
      ...liveData,
      mobileNodeDetailLoading: isLoading,
      mobileNodeDetailError: error,
      mobileNodeDetailValidating: isValidating,
      mobileNodeDetailUsingMock: Boolean(error || !liveData.detail?.id)
    }),
    [data, error, isLoading, isValidating]
  );
}

function mapMobileSelectNode(item) {
  return {
    key: item.key,
    title: item.title,
    description: item.description,
    path: item.path,
    flowKey: item.flowKey || item.flow_key || item.key,
    recommended: Boolean(item.recommended)
  };
}

function mapMobileSelectResponse(payload) {
  const session = payload?.session || {};
  const roleView = payload?.roleView || payload?.role_view || EMPTY_MOBILE_ROLE_VIEW;
  const nodeOptions = toArray(payload?.nodeOptions || payload?.node_options).map(mapMobileSelectNode);
  const recommendedNodes = toArray(payload?.recommendedNodes || payload?.recommended_nodes).map(mapMobileSelectNode);
  const recommendedNode = payload?.recommendedNode || payload?.recommended_node || recommendedNodes[0] || null;

  return {
    mobileSelectSession: {
      roleKey: session.roleKey || session.role_key || '',
      roleLabel: session.roleLabel || session.role_label || '',
      stationCode: session.stationCode || session.station_code || '',
      userId: session.userId || session.user_id || '',
      roleIds: toArray(session.roleIds || session.role_ids),
      stationScope: toArray(session.stationScope || session.station_scope),
      clientSource: session.clientSource || session.client_source || '',
      tenantId: session.tenantId || session.tenant_id || ''
    },
    mobileSelectRoleView: {
      label: roleView.label || '',
      taskRoles: toArray(roleView.taskRoles || roleView.task_roles),
      inboundTabs: toArray(roleView.inboundTabs || roleView.inbound_tabs),
      outboundTabs: toArray(roleView.outboundTabs || roleView.outbound_tabs),
      flowKeys: toArray(roleView.flowKeys || roleView.flow_keys),
      actionTypes: toArray(roleView.actionTypes || roleView.action_types)
    },
    mobileSelectNodeOptions: nodeOptions,
    mobileSelectRecommendedNodes: recommendedNodes.length ? recommendedNodes : nodeOptions.filter((item) => item.recommended),
    mobileSelectRecommendedNode: recommendedNode ? mapMobileSelectNode(recommendedNode) : null,
    mobileSelectLoading: false,
    mobileSelectError: null,
    mobileSelectValidating: false,
    mobileSelectUsingMock: false
  };
}

export function useGetMobileSelect(roleKey) {
  const requestKey = roleKey ? [endpoints.mobileSelect, { params: { role_key: roleKey } }] : endpoints.mobileSelect;
  const { data, isLoading, error, isValidating } = useSWR(requestKey, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = mapMobileSelectResponse(data?.data || EMPTY_OBJECT);

  return useMemo(
    () => ({
      ...liveData,
      mobileSelectLoading: isLoading,
      mobileSelectError: error,
      mobileSelectValidating: isValidating,
      mobileSelectUsingMock: Boolean(error || !liveData.mobileSelectNodeOptions.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

function inferPreviewType(name = '') {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.docx') || lower.endsWith('.doc')) return 'office';
  return 'file';
}

function inferDocumentRoute(item) {
  if (item.related_object_type === 'Flight') {
    const flightNo = item.related_object_label?.split(' / ')[0];
    return flightNo ? `/station/inbound/flights/${encodeURIComponent(flightNo)}` : '/station/inbound/flights';
  }

  if (item.related_object_type === 'AWB') {
    const awbNo = item.related_object_label?.split(' / ')[0];
    return awbNo ? `/station/inbound/waybills/${encodeURIComponent(awbNo)}` : '/station/inbound/waybills';
  }

  if (item.related_object_type === 'Task') {
    return '/station/tasks';
  }

  if (item.related_object_type === 'Truck') {
    return '/station/resources/vehicles';
  }

  return '/station/shipments';
}

function mapDocumentToViewModel(item) {
  return {
    documentId: item.document_id,
    type: item.document_type,
    name: item.document_name,
    linkedTo: item.related_object_label,
    version: item.version_no,
    updatedAt: item.uploaded_at || '--',
    status: item.document_status,
    activeVersionId: `${item.document_id}-${String(item.version_no).toUpperCase()}`,
    previewType: inferPreviewType(item.document_name),
    nextStep: item.required_for_release ? '放行前校验' : '普通归档',
    gateIds: [],
    bindingTargets: [{ label: `${item.related_object_type} / ${item.related_object_label}`, to: inferDocumentRoute(item) }],
    relatedObjectType: item.related_object_type,
    relatedObjectId: item.related_object_id,
    requiredForRelease: Boolean(item.required_for_release),
    retentionClass: item.retention_class || 'operational',
    sizeBytes: Number(item.size_bytes || 0),
    archived: Boolean(item.deleted_at)
  };
}

function mapDocumentVersionToViewModel(item) {
  return {
    versionId: item.versionId || item.version_id || item.documentId || item.document_id,
    version: item.version || item.version_no || 'v1',
    status: item.status || item.documentStatus || item.document_status || 'Pending',
    updatedAt: item.updatedAt || item.updated_at || '--',
    diffSummary: item.diffSummary || item.diff_summary || '首版登记',
    previewSummary: item.previewSummary || item.preview_summary || '',
    previewType: item.previewType || item.preview_type || inferPreviewType(item.documentName || item.document_name || ''),
    sortOrder: Number(item.sortOrder || item.sort_order || 0),
    rollbackTarget: item.rollbackTarget || item.rollback_target || null,
    replacedBy: item.replacedBy || item.replaced_by || null
  };
}

function mapDocumentOverviewResponse(payload) {
  const stationDocuments = Array.isArray(payload?.stationDocuments) ? payload.stationDocuments : EMPTY_ARRAY;
  const documentVersionsByDocumentId = payload?.documentVersionsByDocumentId || {};

  return {
    stationDocuments: stationDocuments.map((item) => ({
      documentId: item.documentId,
      type: item.type,
      name: item.name,
      linkedTo: item.linkedTo,
      version: item.version,
      updatedAt: item.updatedAt,
      status: item.status,
      activeVersionId: item.activeVersionId,
      previewType: item.previewType,
      nextStep: item.nextStep,
      gateIds: Array.isArray(item.gateIds) ? item.gateIds : [],
      bindingTargets: Array.isArray(item.bindingTargets) ? item.bindingTargets : []
    })),
    documentVersionsByDocumentId: Object.fromEntries(
      Object.entries(documentVersionsByDocumentId).map(([documentId, versions]) => [documentId, Array.isArray(versions) ? versions.map(mapDocumentVersionToViewModel) : []])
    ),
    inboundDocumentGates: Array.isArray(payload?.inboundDocumentGates) ? payload.inboundDocumentGates : EMPTY_ARRAY,
    outboundDocumentGates: Array.isArray(payload?.outboundDocumentGates) ? payload.outboundDocumentGates : EMPTY_ARRAY,
    instructionTemplateRows: Array.isArray(payload?.instructionTemplateRows) ? payload.instructionTemplateRows : EMPTY_ARRAY,
    documentGateEvaluationsByDocumentId: payload?.documentGateEvaluationsByDocumentId || {},
    stationDocumentsLoading: false,
    stationDocumentsError: null,
    stationDocumentsValidating: false,
    stationDocumentsUsingMock: false
  };
}

function mapStationDocumentOptions(payload) {
  return {
    documentTypeOptions: toArray(payload?.document_type_options).map(mapSelectOption),
    documentStatusOptions: toArray(payload?.document_status_options).map(mapSelectOption),
    retentionClassOptions: toArray(payload?.retention_class_options).map(mapSelectOption),
    relatedObjectTypeOptions: toArray(payload?.related_object_type_options).map(mapSelectOption),
    relatedObjectOptions: toArray(payload?.related_object_options).map(mapSelectOption)
  };
}

function mapStationDocumentDetail(payload) {
  const document = payload?.document || EMPTY_OBJECT;
  return {
    stationDocumentDetail: {
      documentId: document.document_id || '',
      type: document.document_type || '',
      name: document.document_name || '',
      linkedTo: document.related_object_label || '',
      relatedObjectType: document.related_object_type || '',
      relatedObjectId: document.related_object_id || '',
      version: document.version_no || '',
      updatedAt: document.uploaded_at || '--',
      status: document.document_status || 'Pending',
      previewType: inferPreviewType(document.document_name || ''),
      requiredForRelease: Boolean(document.required_for_release),
      retentionClass: document.retention_class || 'operational',
      note: document.note || '',
      archived: Boolean(document.archived || document.deleted_at),
      bindingTargets: document.document_id
        ? [{ label: `${document.related_object_type} / ${document.related_object_label || document.related_object_id}`, to: inferDocumentRoute(document) }]
        : [],
      versions: toArray(payload?.versions).map((item) => ({
        versionId: item.document_id,
        version: item.version_no,
        status: item.document_status,
        updatedAt: item.updated_at || item.uploaded_at || '--',
        previewSummary: item.note || `${item.document_name || ''} ${item.version_no || ''}`.trim(),
        previewType: item.preview_type || inferPreviewType(item.document_name || ''),
        diffSummary: item.note || '版本更新',
        rollbackTarget: item.rollback_target || null,
        replacedBy: item.replaced_by || null
      })),
      lifecycle: payload?.lifecycle || EMPTY_OBJECT
    }
  };
}

export function useGetStationDocuments(query = {}) {
  const endpoint = `${endpoints.stationDocuments}${buildQueryString(query)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const list = data?.items || data?.data?.items || EMPTY_ARRAY;
  const total = Number(data?.total || data?.data?.total || 0);
  const page = Number(data?.page || data?.data?.page || query.page || 1);
  const pageSize = Number(data?.page_size || data?.data?.page_size || query.page_size || 20);

  return useMemo(
    () => ({
      stationDocuments: list.map(mapDocumentToViewModel),
      stationDocumentsPage: {
        items: list.map(mapDocumentToViewModel),
        page,
        page_size: pageSize,
        total
      },
      stationDocumentsLoading: isLoading,
      stationDocumentsError: error,
      stationDocumentsValidating: isValidating,
      stationDocumentsUsingMock: Boolean(error)
    }),
    [data, error, isLoading, isValidating, list, page, pageSize, total]
  );
}

export function useGetStationDocumentOptions(query = {}) {
  const endpoint = `${endpoints.stationDocumentOptions}${buildQueryString(query)}`;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      ...mapStationDocumentOptions(data?.data || EMPTY_OBJECT),
      stationDocumentOptionsLoading: isLoading,
      stationDocumentOptionsError: error,
      stationDocumentOptionsValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationDocumentDetail(documentId) {
  const endpoint = documentId ? `${endpoints.stationDocuments}/${encodeURIComponent(documentId)}` : null;
  const { data, isLoading, error, isValidating } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      ...mapStationDocumentDetail(data?.data || EMPTY_OBJECT),
      stationDocumentDetailLoading: isLoading,
      stationDocumentDetailError: error,
      stationDocumentDetailValidating: isValidating
    }),
    [data, error, isLoading, isValidating]
  );
}

function mapNoaStatusLabel(status) {
  if (status === 'Sent') return '已发送';
  if (status === 'Failed') return '发送失败';
  return '待处理';
}

function mapNoaRetryLabel(status) {
  if (status === 'Failed') return '可重试';
  if (status === 'Sent') return '无需';
  return '允许补发';
}

function mapNoaNotificationToViewModel(item, index) {
  const awb = String(item?.awb || item?.awb_no || item?.awbNo || '').trim();
  const awbId = String(item?.awbId || item?.awb_id || '').trim();
  const gateId = String(item?.gateId || item?.gate_id || 'HG-03').trim() || 'HG-03';
  const rawStatus = String(item?.rawStatus || item?.noa_status || item?.noaStatus || '').trim();

  return {
    id: String(item?.id || `NOA-${index + 1}`).trim() || `NOA-${index + 1}`,
    awbId,
    awb,
    channel: String(item?.channel || 'Email').trim() || 'Email',
    target: String(item?.target || item?.consignee_name || '').trim() || '--',
    status: String(item?.status || mapNoaStatusLabel(rawStatus)).trim() || mapNoaStatusLabel(rawStatus),
    retry: String(item?.retry || mapNoaRetryLabel(rawStatus)).trim() || mapNoaRetryLabel(rawStatus),
    note: String(item?.note || item?.blocker_reason || '').trim() || '根据当前提单状态决定是否允许发送',
    gateId,
    objectTo: String(item?.objectTo || (awb ? `/station/inbound/waybills/${encodeURIComponent(awb)}` : '/station/inbound/waybills')).trim()
  };
}

function mapGateEvaluationToViewModel(item) {
  return {
    id: String(item?.id || item?.gateEvaluationId || item?.gateId || '').trim(),
    gateId: String(item?.gateId || item?.gate_id || '').trim(),
    node: String(item?.node || '').trim(),
    required: String(item?.required || '').trim(),
    impact: String(item?.impact || '').trim(),
    status: String(item?.status || '').trim(),
    blocker: String(item?.blockingReason || item?.blocker || '').trim(),
    recovery: String(item?.recoveryAction || item?.recovery || '').trim(),
    releaseRole: String(item?.releaseRole || '').trim()
  };
}

function mapHardGatePolicyToViewModel(item) {
  return {
    id: String(item?.id || item?.gateId || '').trim(),
    rule: String(item?.rule || '').trim(),
    triggerNode: String(item?.triggerNode || '').trim(),
    affectedModule: String(item?.affectedModule || '').trim(),
    blocker: String(item?.blocker || '').trim(),
    recovery: String(item?.recovery || '').trim(),
    releaseRole: String(item?.releaseRole || '').trim()
  };
}

function groupRowsByGateId(rows) {
  const grouped = {};

  for (const item of rows) {
    if (!item?.gateId) continue;

    if (!grouped[item.gateId]) {
      grouped[item.gateId] = [];
    }

    grouped[item.gateId].push(item);
  }

  return grouped;
}

function mapNoaOverviewResponse(payload) {
  const noaNotifications = toArray(payload?.noaNotifications);
  const gateEvaluationRows = toArray(payload?.gateEvaluationRows);
  const hardGatePolicyRows = toArray(payload?.hardGatePolicyRows);

  return {
    noaNotifications: noaNotifications.map(mapNoaNotificationToViewModel),
    noaGateEvaluationsByGateId: groupRowsByGateId(gateEvaluationRows.map(mapGateEvaluationToViewModel)),
    noaHardGatePoliciesByGateId: Object.fromEntries(
      hardGatePolicyRows.map((item) => {
        const row = mapHardGatePolicyToViewModel(item);
        return [row.id, row];
      })
    ),
    noaNotificationsLoading: false,
    noaNotificationsError: null,
    noaNotificationsValidating: false,
    noaNotificationsUsingMock: false
  };
}

export function useGetNoaNotifications() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationNoaOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = mapNoaOverviewResponse(data?.data || EMPTY_OBJECT);

  return useMemo(
    () => ({
      noaNotifications: liveData.noaNotifications,
      noaGateEvaluationsByGateId: liveData.noaGateEvaluationsByGateId,
      noaHardGatePoliciesByGateId: liveData.noaHardGatePoliciesByGateId,
      noaNotificationsLoading: isLoading,
      noaNotificationsError: error,
      noaNotificationsValidating: isValidating,
      noaNotificationsUsingMock: Boolean(error || !liveData.noaNotifications.length)
    }),
    [error, isLoading, isValidating, liveData]
  );
}

export function useGetPodNotifications() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationPodOverview, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveData = data?.data || EMPTY_OBJECT;
  const podNotifications = toArray(liveData.podNotifications);
  const gateEvaluationRows = toArray(liveData.gateEvaluationRows);
  const hardGatePolicyRows = toArray(liveData.hardGatePolicyRows);
  const podGateEvaluationsByGateId = useMemo(() => groupRowsByKey(gateEvaluationRows, 'gateId'), [gateEvaluationRows]);
  const podHardGatePoliciesByGateId = useMemo(
    () =>
      hardGatePolicyRows.reduce((acc, item) => {
        const gateId = String(item?.id || '').trim();
        if (!gateId) return acc;
        acc[gateId] = item;
        return acc;
      }, {}),
    [hardGatePolicyRows]
  );

  return useMemo(
    () => ({
      podNotifications,
      podGateEvaluationsByGateId,
      podHardGatePoliciesByGateId,
      podNotificationsLoading: isLoading,
      podNotificationsError: error,
      podNotificationsValidating: isValidating,
      podNotificationsUsingMock: Boolean(error || !podNotifications.length)
    }),
    [error, isLoading, isValidating, podGateEvaluationsByGateId, podHardGatePoliciesByGateId, podNotifications]
  );
}

export async function assignStationTask(taskId, payload) {
  const data = await stationPoster(`${endpoints.stationTasks}/${taskId}/assign`, payload);

  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationTasks)),
    mutate(endpoints.stationTasksOverview),
    mutate(endpoints.stationExceptions)
  ]);

  return data;
}

export async function updateStationTask(taskId, payload) {
  const data = await stationPatcher(`${endpoints.stationTasks}/${encodeURIComponent(taskId)}`, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationTasks)),
    mutate(`${endpoints.stationTaskOptions}${buildQueryString({ related_object_type: payload?.related_object_type })}`),
    mutate(endpoints.stationTasksOverview),
    mutate(endpoints.stationExceptions)
  ]);
  return data?.data || data;
}

export async function archiveStationTask(taskId) {
  const data = await stationDeleter(`${endpoints.stationTasks}/${encodeURIComponent(taskId)}`);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationTasks)),
    mutate(endpoints.stationTasksOverview),
    mutate(endpoints.stationExceptions)
  ]);
  return data?.data || data;
}

export async function createStationDocument(payload) {
  const data = await stationPoster(endpoints.stationDocuments, payload);

  await Promise.all([mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationDocuments)), mutate(endpoints.stationDocumentsOverview)]);

  return data;
}

export async function updateStationDocument(documentId, payload) {
  const data = await stationPatcher(`${endpoints.stationDocuments}/${encodeURIComponent(documentId)}`, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationDocuments)),
    mutate(`${endpoints.stationDocumentOptions}${buildQueryString({ related_object_type: payload?.related_object_type })}`)
  ]);
  return data?.data || data;
}

export async function archiveStationDocument(documentId) {
  const data = await stationDeleter(`${endpoints.stationDocuments}/${encodeURIComponent(documentId)}`);
  await Promise.all([mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationDocuments))]);
  return data?.data || data;
}

export async function processInboundNoa(awbId, payload) {
  const data = await stationPoster(`${endpoints.inboundWaybills}/${awbId}/noa`, payload);
  await Promise.all([
    mutate(endpoints.inboundWaybills),
    mutate(endpoints.stationTasks),
    mutate(endpoints.stationTasksOverview),
    mutate(endpoints.stationExceptions),
    mutate(endpoints.stationNoaOverview)
  ]);
  return data;
}

export async function processInboundPod(awbId, payload) {
  const data = await stationPoster(`${endpoints.inboundWaybills}/${awbId}/pod`, payload);
  await Promise.all([
    mutate(endpoints.inboundWaybills),
    mutate(endpoints.stationDocuments),
    mutate(endpoints.stationDocumentsOverview),
    mutate(endpoints.stationPodOverview),
    mutate(endpoints.stationExceptions)
  ]);
  return data;
}

export async function updateStationInboundWaybill(awbId, payload) {
  const data = await stationPatcher(`${endpoints.inboundWaybills}/${encodeURIComponent(awbId)}`, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.inboundWaybills)),
    mutate(`${endpoints.stationWaybillOptions}${buildQueryString({ direction: 'inbound' })}`)
  ]);
  return data?.data || data;
}

export async function archiveStationInboundWaybill(awbId) {
  const data = await stationDeleter(`${endpoints.inboundWaybills}/${encodeURIComponent(awbId)}`);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.inboundWaybills)),
    mutate(`${endpoints.stationWaybillOptions}${buildQueryString({ direction: 'inbound' })}`)
  ]);
  return data?.data || data;
}

export async function updateStationOutboundWaybill(awbId, payload) {
  const data = await stationPatcher(`${endpoints.outboundWaybills}/${encodeURIComponent(awbId)}`, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.outboundWaybills)),
    mutate(`${endpoints.stationWaybillOptions}${buildQueryString({ direction: 'outbound' })}`)
  ]);
  return data?.data || data;
}

export async function archiveStationOutboundWaybill(awbId) {
  const data = await stationDeleter(`${endpoints.outboundWaybills}/${encodeURIComponent(awbId)}`);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.outboundWaybills)),
    mutate(`${endpoints.stationWaybillOptions}${buildQueryString({ direction: 'outbound' })}`)
  ]);
  return data?.data || data;
}

export async function mobileLogin(payload) {
  return stationPublicPoster('/api/v1/mobile/login', payload);
}

function normalizeMobileLoginOptionsPayload(payload) {
  const data = payload?.data || payload || {};
  const groups = data.groups || {};
  const stationOptions = Array.isArray(groups.station_options)
    ? groups.station_options
    : Array.isArray(data.station_options)
      ? data.station_options
      : [];
  const roleOptions = Array.isArray(groups.role_options) ? groups.role_options : Array.isArray(data.role_options) ? data.role_options : [];
  const defaults = data.defaults || {};

  return {
    data: {
      station_options: stationOptions,
      role_options: roleOptions,
      requires_formal_auth: Boolean(data.requires_formal_auth),
      defaults: {
        station: defaults.station || stationOptions[0]?.value || '',
        role_key: defaults.role_key || roleOptions[0]?.value || ''
      }
    }
  };
}

export async function fetchMobileLoginOptions() {
  try {
    const response = await stationPublicFetcher('/api/v1/mobile/options/login');
    return normalizeMobileLoginOptionsPayload(response);
  } catch {
    const response = await stationPublicFetcher('/api/v1/mobile/login');
    return normalizeMobileLoginOptionsPayload(response);
  }
}

export async function loginStation(payload) {
  return stationPublicPoster('/api/v1/station/login', payload);
}

export async function refreshStation(payload) {
  return stationPublicPoster('/api/v1/station/refresh', payload);
}

export async function getStationMe() {
  return stationFetcher('/api/v1/station/me');
}

export async function logoutStation(payload) {
  return stationPoster('/api/v1/station/logout', payload);
}

export async function uploadStationFile(formData) {
  return stationUpload('/api/v1/station/uploads', formData);
}

export async function createStationUploadTicket(payload) {
  return stationPoster('/api/v1/station/uploads/presign', payload);
}

export async function uploadStationFileByTicket(ticket, file) {
  const url = ticket?.data?.upload_url || ticket?.upload_url;
  const contentType = ticket?.data?.content_type || ticket?.content_type || file.type || 'application/octet-stream';
  return stationPut(url, file, {
    headers: {
      'Content-Type': contentType
    }
  });
}

export function getDocumentDownloadUrl(documentId) {
  return `${endpoints.stationDocuments}/${documentId}/download`;
}

export function getDocumentPreviewUrl(documentId) {
  return `${endpoints.stationDocuments}/${documentId}/preview`;
}

export async function getStationDocumentPreview(documentId) {
  const response = await stationAxios.get(getDocumentPreviewUrl(documentId), {
    responseType: 'blob',
    validateStatus: (status) => status < 500
  });

  const contentType = response.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    return JSON.parse(await response.data.text());
  }

  return {
    data: {
      inline_supported: true,
      preview_url: getDocumentPreviewUrl(documentId),
      content_type: contentType
    }
  };
}

export async function downloadStationDocument(documentId, suggestedName = 'document.bin') {
  const response = await stationAxios.get(getDocumentDownloadUrl(documentId), {
    responseType: 'blob'
  });

  const blobUrl = window.URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(blobUrl);
}

async function postMobileTaskAction(taskId, action, payload = {}) {
  const data = await stationPoster(`/api/v1/mobile/tasks/${taskId}/${action}`, payload);
  await Promise.all([mutate('/api/v1/mobile/tasks'), mutate(endpoints.mobileInboundOverview), mutate(endpoints.mobileOutboundOverview)]);
  return data;
}

export function acceptMobileTask(taskId, payload) {
  return postMobileTaskAction(taskId, 'accept', payload);
}

export function startMobileTask(taskId, payload) {
  return postMobileTaskAction(taskId, 'start', payload);
}

export function uploadMobileTaskEvidence(taskId, payload) {
  return postMobileTaskAction(taskId, 'evidence', payload);
}

export function completeMobileTask(taskId, payload) {
  return postMobileTaskAction(taskId, 'complete', payload);
}

export async function raiseStationTaskException(taskId, payload) {
  const data = await stationPoster(`${endpoints.stationTasks}/${taskId}/exception`, payload);

  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationTasks)),
    mutate(endpoints.stationTasksOverview),
    mutate(endpoints.stationExceptions)
  ]);

  return data;
}

export async function getInboundCountRecords(flightNo) {
  return stationFetcher(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/counts`);
}

export async function getInboundCountRecordOptions(flightNo) {
  return stationFetcher(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/counts/options`);
}

export async function saveInboundCountRecord(flightNo, awbNo, payload) {
  const data = await stationPoster(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/counts/${encodeURIComponent(awbNo)}`, payload);
  await mutate(endpoints.mobileInboundFlightDetail(flightNo));
  return data;
}

export async function updateInboundCountRecord(flightNo, awbNo, payload) {
  const data = await stationPatcher(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/counts/${encodeURIComponent(awbNo)}`, payload);
  await mutate(endpoints.mobileInboundFlightDetail(flightNo));
  return data;
}

export async function archiveInboundCountRecord(flightNo, awbNo) {
  const data = await stationDeleter(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/counts/${encodeURIComponent(awbNo)}`);
  await mutate(endpoints.mobileInboundFlightDetail(flightNo));
  return data;
}

export async function getInboundPallets(flightNo) {
  return stationFetcher(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/pallets`);
}

export async function getInboundPalletOptions(flightNo) {
  return stationFetcher(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/pallets/options`);
}

export async function saveInboundPallet(flightNo, payload) {
  const data = await stationPoster(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/pallets`, payload);
  await Promise.all([mutate(endpoints.mobileInboundFlightDetail(flightNo)), mutate(endpoints.mobileInboundOverview)]);
  return data;
}

export async function updateInboundPallet(palletNo, payload) {
  const data = await stationPatcher(`/api/v1/mobile/inbound/pallets/${encodeURIComponent(palletNo)}`, payload);
  await mutate((key) => typeof key === 'string' && key.startsWith('/api/v1/mobile/inbound/'));
  return data;
}

export async function archiveInboundPallet(palletNo) {
  const data = await stationDeleter(`/api/v1/mobile/inbound/pallets/${encodeURIComponent(palletNo)}`);
  await mutate((key) => typeof key === 'string' && key.startsWith('/api/v1/mobile/inbound/'));
  return data;
}

export async function getInboundLoadingPlans(flightNo) {
  return stationFetcher(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/loading-plans`);
}

export async function getInboundLoadingPlanOptions(flightNo) {
  return stationFetcher(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/loading-plans/options`);
}

export async function saveInboundLoadingPlan(flightNo, payload) {
  const data = await stationPoster(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/loading-plans`, payload);
  await Promise.all([mutate(endpoints.mobileInboundFlightDetail(flightNo)), mutate(endpoints.mobileInboundOverview)]);
  return data;
}

export async function updateInboundLoadingPlan(planId, payload) {
  const data = await stationPatcher(`/api/v1/mobile/inbound/loading-plans/${encodeURIComponent(planId)}`, payload);
  await mutate((key) => typeof key === 'string' && key.startsWith('/api/v1/mobile/inbound/'));
  return data;
}

export async function archiveInboundLoadingPlan(planId) {
  const data = await stationDeleter(`/api/v1/mobile/inbound/loading-plans/${encodeURIComponent(planId)}`);
  await mutate((key) => typeof key === 'string' && key.startsWith('/api/v1/mobile/inbound/'));
  return data;
}

export async function getOutboundReceipts(flightNo) {
  return stationFetcher(`/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/receipts`);
}

export async function saveOutboundReceipt(flightNo, awbNo, payload) {
  const data = await stationPoster(`/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/receipts/${encodeURIComponent(awbNo)}`, payload);
  await Promise.all([mutate(endpoints.mobileOutboundFlightDetail(flightNo)), mutate(endpoints.mobileOutboundOverview)]);
  return data;
}

export async function updateOutboundReceipt(flightNo, awbNo, payload) {
  const data = await stationPatcher(`/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/receipts/${encodeURIComponent(awbNo)}`, payload);
  await Promise.all([mutate(endpoints.mobileOutboundFlightDetail(flightNo)), mutate(endpoints.mobileOutboundOverview)]);
  return data;
}

export async function archiveOutboundReceipt(flightNo, awbNo, archived = true) {
  const data = await stationDeleter(`/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/receipts/${encodeURIComponent(awbNo)}`, { data: { archived } });
  await Promise.all([mutate(endpoints.mobileOutboundFlightDetail(flightNo)), mutate(endpoints.mobileOutboundOverview)]);
  return data;
}

export async function getOutboundContainers(flightNo) {
  return stationFetcher(`/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/containers`);
}

export async function saveOutboundContainer(flightNo, payload) {
  const data = await stationPoster(`/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/containers`, payload);
  await Promise.all([mutate(endpoints.mobileOutboundFlightDetail(flightNo)), mutate(endpoints.mobileOutboundOverview)]);
  return data;
}

export async function updateOutboundContainer(containerCode, payload) {
  const data = await stationPatcher(`/api/v1/mobile/outbound/containers/${encodeURIComponent(containerCode)}`, payload);
  await Promise.all([mutate((key) => typeof key === 'string' && key.startsWith('/api/v1/mobile/outbound/')), mutate(endpoints.mobileOutboundOverview)]);
  return data;
}

export async function archiveOutboundContainer(containerCode, archived = true) {
  const data = await stationDeleter(`/api/v1/mobile/outbound/containers/${encodeURIComponent(containerCode)}`, { data: { archived } });
  await Promise.all([mutate((key) => typeof key === 'string' && key.startsWith('/api/v1/mobile/outbound/')), mutate(endpoints.mobileOutboundOverview)]);
  return data;
}

export async function verifyStationTask(taskId, payload = {}) {
  const data = await stationPoster(`${endpoints.stationTasks}/${taskId}/verify`, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationTasks)),
    mutate(endpoints.stationTasksOverview),
    mutate(endpoints.stationExceptions)
  ]);
  return data;
}

export async function reworkStationTask(taskId, payload = {}) {
  const data = await stationPoster(`${endpoints.stationTasks}/${taskId}/rework`, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationTasks)),
    mutate(endpoints.stationTasksOverview),
    mutate(endpoints.stationExceptions)
  ]);
  return data;
}

export async function escalateStationTask(taskId, payload = {}) {
  const data = await stationPoster(`${endpoints.stationTasks}/${taskId}/escalate`, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationTasks)),
    mutate(endpoints.stationTasksOverview),
    mutate(endpoints.stationExceptions)
  ]);
  return data;
}

export async function resolveStationException(exceptionId, payload = {}) {
  const data = await stationPoster(`${endpoints.stationExceptions}/${exceptionId}/resolve`, payload);
  await Promise.all([
    mutate(endpoints.stationTasks),
    mutate(endpoints.stationTasksOverview),
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationExceptions)),
    mutate(endpoints.stationExceptionsOverview)
  ]);
  return data;
}

export async function updateStationException(exceptionId, payload) {
  const data = await stationPatcher(`${endpoints.stationExceptions}/${encodeURIComponent(exceptionId)}`, payload);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationExceptions)),
    mutate(endpoints.stationExceptionsOverview),
    mutate(`${endpoints.stationExceptionOptions}${buildQueryString({ related_object_type: payload?.related_object_type })}`)
  ]);
  return data?.data || data;
}

export async function archiveStationException(exceptionId) {
  const data = await stationDeleter(`${endpoints.stationExceptions}/${encodeURIComponent(exceptionId)}`);
  await Promise.all([
    mutate((key) => typeof key === 'string' && key.startsWith(endpoints.stationExceptions)),
    mutate(endpoints.stationExceptionsOverview)
  ]);
  return data?.data || data;
}

export async function markOutboundLoaded(flightId, payload = {}) {
  const data = await stationPoster(`${endpoints.outboundFlights}/${flightId}/loaded`, payload);
  await Promise.all([mutate(endpoints.outboundFlights), mutate(`${endpoints.outboundFlights}/${flightId}`)]);
  return data;
}

export async function finalizeOutboundManifest(flightId, payload = {}) {
  const data = await stationPoster(`${endpoints.outboundFlights}/${flightId}/manifest/finalize`, payload);
  await Promise.all([
    mutate(endpoints.outboundFlights),
    mutate(`${endpoints.outboundFlights}/${flightId}`),
    mutate(endpoints.stationDocuments),
    mutate(endpoints.stationDocumentsOverview)
  ]);
  return data;
}

export async function markOutboundAirborne(flightId, payload = {}) {
  const data = await stationPoster(`${endpoints.outboundFlights}/${flightId}/airborne`, payload);
  await Promise.all([mutate(endpoints.outboundFlights), mutate(`${endpoints.outboundFlights}/${flightId}`), mutate(endpoints.stationTasks), mutate(endpoints.stationTasksOverview)]);
  return data;
}
