import useSWR, { mutate } from 'swr';
import { useMemo } from 'react';

import { exceptionOverview, inboundCargoLifecycle, inboundFlights, inboundWaybillRows } from 'data/sinoport';
import {
  exceptionDetailRows,
  noaNotificationRows,
  podNotificationRows,
  shipmentRows,
  stationDocumentRows,
  stationTaskBoard,
  stationTaskSummary
} from 'data/sinoport-adapters';
import { stationAxios, stationFetcher, stationPatcher, stationPoster, stationPublicPoster, stationPut, stationUpload } from 'utils/stationApi';

const endpoints = {
  inboundFlights: '/api/v1/station/inbound/flights',
  inboundWaybills: '/api/v1/station/inbound/waybills',
  outboundFlights: '/api/v1/station/outbound/flights',
  outboundWaybills: '/api/v1/station/outbound/waybills',
  stationShipments: '/api/v1/station/shipments',
  stationDocuments: '/api/v1/station/documents',
  stationTasks: '/api/v1/station/tasks',
  stationExceptions: '/api/v1/station/exceptions',
  auditObject: '/api/v1/platform/audit/object'
};

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
    flightId: item.flight_id,
    flightNo: item.flight_no,
    consignee: item.consignee_name,
    pieces: String(item.pieces),
    weight: `${item.gross_weight} kg`,
    currentNode: item.current_node,
    noaStatus: item.noa_status,
    podStatus: item.pod_status,
    transferStatus: item.transfer_status,
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
    awb: item.awb_no,
    flightNo: item.flight_no,
    destination: item.destination_code,
    forecast: item.forecast_status,
    receipt: item.receipt_status,
    master: item.master_status,
    loading: item.loading_status,
    manifest: item.manifest_status
  };
}

function mapStationShipmentToViewModel(item) {
  return {
    id: item.id,
    awb: item.awb,
    direction: item.direction,
    flightNo: item.flight_no,
    route: item.route,
    primaryStatus: item.primary_status,
    taskStatus: item.task_status,
    documentStatus: item.document_status,
    blocker: item.blocker,
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
    relationshipRows: detail.relationship_rows
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
    node: item.execution_node,
    role: item.assigned_role || '--',
    owner: item.assigned_team_id || item.assigned_worker_id || '--',
    due: formatTimeLabel(item.due_at),
    priority: deriveTaskPriority(item),
    status: item.task_status,
    gateIds: item.blocker_code ? [item.blocker_code] : [],
    blocker: item.blocker_code || '无',
    objectTo: mapTaskObjectTo(item)
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
  const fallbackDetail = exceptionDetailRows.find((entry) => entry.id === item.exception_id);
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
    detailTo: fallbackDetail ? `/station/exceptions/${item.exception_id}` : '/station/exceptions'
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

function buildFallbackValue(error, liveItems, fallbackItems) {
  return error || !liveItems?.length ? fallbackItems : liveItems;
}

const fallbackExceptionRows = exceptionDetailRows.map((item) => ({
  ...item,
  detailTo: `/station/exceptions/${item.id}`
}));

export function useGetInboundFlights() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.inboundFlights, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      inboundFlights: buildFallbackValue(error, data?.items?.map(mapInboundFlightToViewModel), inboundFlights),
      inboundLifecycle: inboundCargoLifecycle,
      inboundFlightsLoading: isLoading,
      inboundFlightsError: error,
      inboundFlightsValidating: isValidating,
      inboundFlightsUsingMock: Boolean(error || !data?.items?.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetInboundWaybills() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.inboundWaybills, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      inboundWaybills: buildFallbackValue(error, data?.items?.map(mapInboundWaybillToViewModel), inboundWaybillRows),
      inboundWaybillsLoading: isLoading,
      inboundWaybillsError: error,
      inboundWaybillsValidating: isValidating,
      inboundWaybillsUsingMock: Boolean(error || !data?.items?.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetOutboundFlights() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.outboundFlights, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      outboundFlights: buildFallbackValue(error, data?.items?.map(mapOutboundFlightToViewModel), []),
      outboundFlightsLoading: isLoading,
      outboundFlightsError: error,
      outboundFlightsValidating: isValidating,
      outboundFlightsUsingMock: Boolean(error || !data?.items?.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetOutboundWaybills() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.outboundWaybills, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      outboundWaybills: buildFallbackValue(error, data?.items?.map(mapOutboundWaybillToViewModel), []),
      outboundWaybillsLoading: isLoading,
      outboundWaybillsError: error,
      outboundWaybillsValidating: isValidating,
      outboundWaybillsUsingMock: Boolean(error || !data?.items?.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetInboundFlightDetail(flightNo) {
  const { data: listData, error: listError } = useSWR(endpoints.inboundFlights, stationFetcher, {
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
  const { data: listData, error: listError } = useSWR(endpoints.inboundWaybills, stationFetcher, {
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
  const { data: listData, error: listError } = useSWR(endpoints.outboundFlights, stationFetcher, {
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
  const { data: listData, error: listError } = useSWR(endpoints.outboundWaybills, stationFetcher, {
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

export function useGetStationShipments() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationShipments, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      stationShipments: buildFallbackValue(error, data?.items?.map(mapStationShipmentToViewModel), shipmentRows),
      stationShipmentsLoading: isLoading,
      stationShipmentsError: error,
      stationShipmentsValidating: isValidating,
      stationShipmentsUsingMock: Boolean(error || !data?.items?.length)
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
      stationExceptionDetail: data?.data || null,
      stationExceptionDetailLoading: isLoading,
      stationExceptionDetailError: error,
      stationExceptionDetailValidating: isValidating,
      stationExceptionDetailUsingMock: Boolean(error || !data?.data)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationTasks() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationTasks, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = data?.items || [];

  return useMemo(
    () => ({
      stationTasks: buildFallbackValue(error, liveItems.map(mapTaskToViewModel), stationTaskBoard),
      stationTaskSummaryCards: buildFallbackValue(error, buildTaskSummaryCards(liveItems), stationTaskSummary),
      stationTasksLoading: isLoading,
      stationTasksError: error,
      stationTasksValidating: isValidating,
      stationTasksUsingMock: Boolean(error || !liveItems.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetStationExceptions() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationExceptions, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = data?.items || [];

  return useMemo(
    () => ({
      stationExceptions: buildFallbackValue(error, liveItems.map(mapExceptionToViewModel), fallbackExceptionRows),
      stationExceptionOverview: buildFallbackValue(error, buildExceptionOverview(liveItems), exceptionOverview),
      stationExceptionsLoading: isLoading,
      stationExceptionsError: error,
      stationExceptionsValidating: isValidating,
      stationExceptionsUsingMock: Boolean(error || !liveItems.length)
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
    bindingTargets: [{ label: `${item.related_object_type} / ${item.related_object_label}`, to: inferDocumentRoute(item) }]
  };
}

export function useGetStationDocuments() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.stationDocuments, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = data?.items || [];

  return useMemo(
    () => ({
      stationDocuments: buildFallbackValue(error, liveItems.map(mapDocumentToViewModel), stationDocumentRows),
      stationDocumentsLoading: isLoading,
      stationDocumentsError: error,
      stationDocumentsValidating: isValidating,
      stationDocumentsUsingMock: Boolean(error || !liveItems.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

function mapNoaStatusLabel(status) {
  if (status === 'Sent') return '已发送';
  if (status === 'Failed') return '发送失败';
  return '待处理';
}

function mapPodStatusLabel(status) {
  if (status === 'Released') return '已归档';
  if (status === 'Uploaded') return '已上传';
  return '待补签';
}

export function useGetNoaNotifications() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.inboundWaybills, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = (data?.items || []).map((item, index) => ({
    id: `NOA-${index + 1}`,
    awbId: item.awb_id,
    awb: item.awb_no,
    channel: item.noa_status === 'Failed' ? 'Email' : 'Email',
    target: item.consignee_name,
    status: mapNoaStatusLabel(item.noa_status),
    retry: item.noa_status === 'Failed' ? '可重试' : item.noa_status === 'Sent' ? '无需' : '允许补发',
    note: item.blocker_reason || '根据当前提单状态决定是否允许发送',
    gateId: 'HG-03',
    objectTo: `/station/inbound/waybills/${encodeURIComponent(item.awb_no)}`
  }));

  return useMemo(
    () => ({
      noaNotifications: buildFallbackValue(error, liveItems, noaNotificationRows),
      noaNotificationsLoading: isLoading,
      noaNotificationsError: error,
      noaNotificationsValidating: isValidating,
      noaNotificationsUsingMock: Boolean(error || !liveItems.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

export function useGetPodNotifications() {
  const { data, isLoading, error, isValidating } = useSWR(endpoints.inboundWaybills, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const liveItems = (data?.items || []).map((item, index) => ({
    id: `POD-${index + 1}`,
    awbId: item.awb_id,
    object: item.awb_no,
    signer: item.consignee_name,
    status: mapPodStatusLabel(item.pod_status),
    retry: item.pod_status === 'Released' ? '无需' : '允许人工补传',
    note: item.blocker_reason || '根据签收与 POD 状态决定是否允许关闭',
    gateId: 'HG-06',
    objectTo: `/station/inbound/waybills/${encodeURIComponent(item.awb_no)}`
  }));

  return useMemo(
    () => ({
      podNotifications: buildFallbackValue(error, liveItems, podNotificationRows),
      podNotificationsLoading: isLoading,
      podNotificationsError: error,
      podNotificationsValidating: isValidating,
      podNotificationsUsingMock: Boolean(error || !liveItems.length)
    }),
    [data, error, isLoading, isValidating]
  );
}

export async function assignStationTask(taskId, payload) {
  const data = await stationPoster(`${endpoints.stationTasks}/${taskId}/assign`, payload);

  await Promise.all([mutate(endpoints.stationTasks), mutate(endpoints.stationExceptions)]);

  return data;
}

export async function createStationDocument(payload) {
  const data = await stationPoster(endpoints.stationDocuments, payload);

  await mutate(endpoints.stationDocuments);

  return data;
}

export async function processInboundNoa(awbId, payload) {
  const data = await stationPoster(`${endpoints.inboundWaybills}/${awbId}/noa`, payload);
  await Promise.all([mutate(endpoints.inboundWaybills), mutate(endpoints.stationTasks), mutate(endpoints.stationExceptions)]);
  return data;
}

export async function processInboundPod(awbId, payload) {
  const data = await stationPoster(`${endpoints.inboundWaybills}/${awbId}/pod`, payload);
  await Promise.all([mutate(endpoints.inboundWaybills), mutate(endpoints.stationDocuments), mutate(endpoints.stationExceptions)]);
  return data;
}

export async function mobileLogin(payload) {
  return stationPublicPoster('/api/v1/mobile/login', payload);
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
  await mutate('/api/v1/mobile/tasks');
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

  await Promise.all([mutate(endpoints.stationTasks), mutate(endpoints.stationExceptions)]);

  return data;
}

export async function getInboundCountRecords(flightNo) {
  return stationFetcher(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/counts`);
}

export async function saveInboundCountRecord(flightNo, awbNo, payload) {
  return stationPoster(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/counts/${encodeURIComponent(awbNo)}`, payload);
}

export async function getInboundPallets(flightNo) {
  return stationFetcher(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/pallets`);
}

export async function saveInboundPallet(flightNo, payload) {
  return stationPoster(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/pallets`, payload);
}

export async function updateInboundPallet(palletNo, payload) {
  return stationPatcher(`/api/v1/mobile/inbound/pallets/${encodeURIComponent(palletNo)}`, payload);
}

export async function getInboundLoadingPlans(flightNo) {
  return stationFetcher(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/loading-plans`);
}

export async function saveInboundLoadingPlan(flightNo, payload) {
  return stationPoster(`/api/v1/mobile/inbound/${encodeURIComponent(flightNo)}/loading-plans`, payload);
}

export async function updateInboundLoadingPlan(planId, payload) {
  return stationPatcher(`/api/v1/mobile/inbound/loading-plans/${encodeURIComponent(planId)}`, payload);
}

export async function getOutboundReceipts(flightNo) {
  return stationFetcher(`/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/receipts`);
}

export async function saveOutboundReceipt(flightNo, awbNo, payload) {
  return stationPoster(`/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/receipts/${encodeURIComponent(awbNo)}`, payload);
}

export async function getOutboundContainers(flightNo) {
  return stationFetcher(`/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/containers`);
}

export async function saveOutboundContainer(flightNo, payload) {
  return stationPoster(`/api/v1/mobile/outbound/${encodeURIComponent(flightNo)}/containers`, payload);
}

export async function updateOutboundContainer(containerCode, payload) {
  return stationPatcher(`/api/v1/mobile/outbound/containers/${encodeURIComponent(containerCode)}`, payload);
}

export async function verifyStationTask(taskId, payload = {}) {
  const data = await stationPoster(`${endpoints.stationTasks}/${taskId}/verify`, payload);
  await Promise.all([mutate(endpoints.stationTasks), mutate(endpoints.stationExceptions)]);
  return data;
}

export async function reworkStationTask(taskId, payload = {}) {
  const data = await stationPoster(`${endpoints.stationTasks}/${taskId}/rework`, payload);
  await Promise.all([mutate(endpoints.stationTasks), mutate(endpoints.stationExceptions)]);
  return data;
}

export async function escalateStationTask(taskId, payload = {}) {
  const data = await stationPoster(`${endpoints.stationTasks}/${taskId}/escalate`, payload);
  await Promise.all([mutate(endpoints.stationTasks), mutate(endpoints.stationExceptions)]);
  return data;
}

export async function resolveStationException(exceptionId, payload = {}) {
  const data = await stationPoster(`${endpoints.stationExceptions}/${exceptionId}/resolve`, payload);
  await Promise.all([mutate(endpoints.stationTasks), mutate(endpoints.stationExceptions)]);
  return data;
}

export async function markOutboundLoaded(flightId, payload = {}) {
  const data = await stationPoster(`${endpoints.outboundFlights}/${flightId}/loaded`, payload);
  await Promise.all([mutate(endpoints.outboundFlights), mutate(`${endpoints.outboundFlights}/${flightId}`)]);
  return data;
}

export async function finalizeOutboundManifest(flightId, payload = {}) {
  const data = await stationPoster(`${endpoints.outboundFlights}/${flightId}/manifest/finalize`, payload);
  await Promise.all([mutate(endpoints.outboundFlights), mutate(`${endpoints.outboundFlights}/${flightId}`), mutate(endpoints.stationDocuments)]);
  return data;
}

export async function markOutboundAirborne(flightId, payload = {}) {
  const data = await stationPoster(`${endpoints.outboundFlights}/${flightId}/airborne`, payload);
  await Promise.all([mutate(endpoints.outboundFlights), mutate(`${endpoints.outboundFlights}/${flightId}`), mutate(endpoints.stationTasks)]);
  return data;
}
