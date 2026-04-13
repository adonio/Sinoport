export type RoleCode =
  | 'platform_admin'
  | 'station_supervisor'
  | 'document_desk'
  | 'check_worker'
  | 'inbound_operator'
  | 'delivery_desk'
  | 'mobile_operator';

export type ClientSource = 'station-web' | 'mobile-pda' | 'agent-tool';
export type ServiceLevel = 'P1' | 'P2' | 'P3';
export type FlightRuntimeStatus =
  | 'Scheduled'
  | 'Pre-Departure'
  | 'Airborne'
  | 'Pre-Arrival'
  | 'Landed'
  | 'Delayed'
  | 'Diverted'
  | 'Cancelled';

export type GroundFulfillmentStatus =
  | 'Front Warehouse Receiving'
  | 'First-Mile In Transit'
  | 'Origin Terminal Handling'
  | 'Origin Ramp Handling'
  | 'In Flight'
  | 'Destination Ramp Handling'
  | 'Inbound Handling'
  | 'Tail-Linehaul In Transit'
  | 'Delivered'
  | 'Closed';

export type TaskStatus =
  | 'Created'
  | 'Assigned'
  | 'Accepted'
  | 'Arrived at Location'
  | 'Started'
  | 'Evidence Uploaded'
  | 'Completed'
  | 'Verified'
  | 'Escalated'
  | 'Handed Over'
  | 'Closed'
  | 'Rejected'
  | 'Rework'
  | 'Exception Raised';

export type DocumentStatus =
  | 'Draft'
  | 'Uploaded'
  | 'Parsed'
  | 'Validated'
  | 'Missing'
  | 'Replaced'
  | 'Approved'
  | 'Released';

export type ExceptionStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type NoaStatus = 'Pending' | 'Sent' | 'Failed';
export type PodStatus = 'Pending' | 'Uploaded' | 'Released';
export type TransferStatus = 'Pending' | 'Planned' | 'In Transit' | 'Completed';

export interface ListResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface PaginationQuery {
  page?: string;
  page_size?: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    details: Record<string, unknown>;
    message: string;
  };
}

export interface InboundFlightListItem {
  flight_id: string;
  flight_no: string;
  flight_date: string;
  station_id: string;
  origin_code: string;
  destination_code: string;
  eta?: string;
  actual_landed_at?: string;
  runtime_status: FlightRuntimeStatus;
  service_level?: ServiceLevel;
  summary: {
    current_step: GroundFulfillmentStatus | string;
    total_awb_count: number;
    total_pieces: number;
    total_weight: number;
    open_task_count: number;
    open_exception_count: number;
    blocked: boolean;
    blocker_reason?: string;
  };
}

export interface InboundFlightListQuery extends PaginationQuery {
  date_from?: string;
  date_to?: string;
  keyword?: string;
  runtime_status?: FlightRuntimeStatus;
  service_level?: ServiceLevel;
  station_id?: string;
}

export interface InboundFlightDetail {
  flight: {
    flight_id: string;
    flight_no: string;
    flight_date: string;
    station_id: string;
    origin_code: string;
    destination_code: string;
    eta?: string;
    actual_landed_at?: string;
    runtime_status: FlightRuntimeStatus;
    service_level?: ServiceLevel;
  };
  kpis: {
    total_awb_count: number;
    total_pieces: number;
    total_weight: number;
    completed_task_count: number;
    open_task_count: number;
    open_exception_count: number;
  };
  waybill_summary: Array<{
    awb_id: string;
    awb_no: string;
    current_node: GroundFulfillmentStatus | string;
    noa_status: NoaStatus;
    pod_status: PodStatus;
  }>;
  document_summary: Array<{
    document_id: string;
    document_type: string;
    document_status: DocumentStatus;
    required_for_release: boolean;
  }>;
  task_summary: Array<{
    task_id: string;
    task_type: string;
    task_status: TaskStatus;
    assigned_team_id?: string;
  }>;
  exception_summary: Array<{
    exception_id: string;
    exception_type: string;
    exception_status: ExceptionStatus;
    severity: ServiceLevel;
    blocker_flag: boolean;
  }>;
}

export interface InboundWaybillListItem {
  awb_id: string;
  awb_no: string;
  shipment_id: string;
  flight_id: string;
  flight_no: string;
  consignee_name: string;
  pieces: number;
  gross_weight: number;
  current_node: GroundFulfillmentStatus | string;
  noa_status: NoaStatus;
  pod_status: PodStatus;
  transfer_status: TransferStatus;
  blocked: boolean;
  blocker_reason?: string;
}

export interface InboundWaybillDetail {
  awb: {
    awb_id: string;
    awb_no: string;
    shipment_id: string;
    flight_id: string;
    flight_no: string;
    station_id: string;
    consignee_name: string;
    pieces: number;
    gross_weight: number;
    current_node: GroundFulfillmentStatus | string;
    noa_status: NoaStatus;
    pod_status: PodStatus;
    transfer_status: TransferStatus;
  };
  shipment: {
    shipment_id: string;
    fulfillment_status: GroundFulfillmentStatus;
    service_level: ServiceLevel;
    current_node: GroundFulfillmentStatus | string;
  };
  documents: Array<{
    document_id: string;
    document_type: string;
    document_status: DocumentStatus;
    required_for_release: boolean;
  }>;
  tasks: Array<{
    task_id: string;
    task_type: string;
    task_status: TaskStatus;
    blocker_code?: string;
  }>;
  exceptions: Array<{
    exception_id: string;
    exception_type: string;
    exception_status: ExceptionStatus;
    severity: ServiceLevel;
    blocker_flag: boolean;
  }>;
}

export interface OutboundFlightListItem {
  flight_id: string;
  flight_no: string;
  flight_date: string;
  station_id: string;
  origin_code: string;
  destination_code: string;
  etd?: string;
  runtime_status: FlightRuntimeStatus;
  service_level?: ServiceLevel;
  summary: {
    stage: string;
    manifest_status: string;
    total_awb_count: number;
    total_pieces: number;
    total_weight: number;
  };
}

export interface OutboundFlightDetail {
  flight: {
    flight_id: string;
    flight_no: string;
    flight_date: string;
    station_id: string;
    origin_code: string;
    destination_code: string;
    etd?: string;
    runtime_status: FlightRuntimeStatus;
    service_level?: ServiceLevel;
  };
  kpis: {
    total_awb_count: number;
    total_pieces: number;
    total_weight: number;
    loaded_awb_count: number;
    manifest_pending_count: number;
  };
  waybill_summary: Array<{
    awb_id: string;
    awb_no: string;
    destination_code: string;
    forecast_status: string;
    receipt_status: string;
    master_status: string;
    loading_status: string;
    manifest_status: string;
  }>;
  document_summary: Array<{
    document_id: string;
    document_type: string;
    document_status: DocumentStatus;
    required_for_release: boolean;
  }>;
  task_summary: Array<{
    task_id: string;
    task_type: string;
    task_status: TaskStatus;
    assigned_team_id?: string;
  }>;
  exception_summary: Array<{
    exception_id: string;
    exception_type: string;
    exception_status: ExceptionStatus;
    severity: ServiceLevel;
    blocker_flag: boolean;
  }>;
}

export interface OutboundWaybillListItem {
  awb_id: string;
  awb_no: string;
  shipment_id: string;
  flight_id: string;
  flight_no: string;
  destination_code: string;
  pieces: number;
  gross_weight: number;
  forecast_status: string;
  receipt_status: string;
  master_status: string;
  loading_status: string;
  manifest_status: string;
}

export interface OutboundWaybillDetail {
  awb: {
    awb_id: string;
    awb_no: string;
    shipment_id: string;
    flight_id: string;
    flight_no: string;
    station_id: string;
    destination_code: string;
    pieces: number;
    gross_weight: number;
    forecast_status: string;
    receipt_status: string;
    master_status: string;
    loading_status: string;
    manifest_status: string;
  };
  documents: Array<{
    document_id: string;
    document_type: string;
    document_status: DocumentStatus;
    required_for_release: boolean;
  }>;
  tasks: Array<{
    task_id: string;
    task_type: string;
    task_status: TaskStatus;
    blocker_code?: string;
  }>;
  exceptions: Array<{
    exception_id: string;
    exception_type: string;
    exception_status: ExceptionStatus;
    severity: ServiceLevel;
    blocker_flag: boolean;
  }>;
}

export interface NoaActionInput {
  action: 'validate' | 'retry' | 'manual_send';
  channel?: string;
  note?: string;
}

export interface NoaActionResult {
  awb_id: string;
  awb_no: string;
  noa_status: NoaStatus;
  validation_passed: boolean;
  message: string;
  audit_action?: 'AWB_NOA_SENT';
}

export interface PodActionInput {
  action: 'validate_close' | 'confirm_sign' | 'archive';
  document_name?: string;
  note?: string;
  signer?: string;
  storage_key?: string;
}

export interface PodActionResult {
  awb_id: string;
  awb_no: string;
  pod_status: PodStatus;
  validation_passed: boolean;
  message: string;
  document_id?: string;
  audit_action?: 'AWB_POD_RELEASED';
}

export interface CreateDocumentInput {
  document_type: string;
  document_name: string;
  related_object_type: string;
  related_object_id: string;
  station_id?: string;
  storage_key: string;
  upload_id?: string;
  content_type?: string;
  size_bytes?: number;
  checksum_sha256?: string;
  retention_class?: 'temporary' | 'operational' | 'compliance';
  required_for_release?: boolean;
  version_mode?: 'new' | 'replace';
  replace_document_id?: string;
  trigger_parse?: boolean;
  note?: string;
}

export interface CreateDocumentResult {
  document_id: string;
  document_type: string;
  document_name: string;
  related_object_type: string;
  related_object_id: string;
  version_no: string;
  document_status: DocumentStatus;
  required_for_release: boolean;
  storage_key: string;
  content_type?: string;
  size_bytes?: number;
  checksum_sha256?: string;
  retention_class?: string;
  uploaded_at: string;
  next_actions: string[];
  audit_action: 'DOCUMENT_CREATED';
}

export interface CreateUploadTicketInput {
  station_id?: string;
  related_object_type: string;
  document_name: string;
  content_type?: string;
  size_bytes?: number;
  checksum_sha256?: string;
  retention_class?: 'temporary' | 'operational' | 'compliance';
}

export interface CreateUploadTicketResult {
  upload_id: string;
  upload_url: string;
  method: 'PUT';
  expires_at: string;
  storage_key: string;
  content_type: string;
  document_name: string;
  retention_class: string;
  headers: Record<string, string>;
}

export interface StationDocumentListItem {
  document_id: string;
  document_type: string;
  document_name: string;
  related_object_type: string;
  related_object_id: string;
  related_object_label: string;
  version_no: string;
  document_status: DocumentStatus;
  required_for_release: boolean;
  content_type?: string;
  size_bytes?: number;
  checksum_sha256?: string;
  retention_class?: string;
  deleted_at?: string | null;
  preview_type?: 'pdf' | 'image' | 'office' | 'text' | 'other';
  uploaded_at?: string;
}

export interface StationDocumentPreviewResult {
  document_id: string;
  preview_type: 'pdf' | 'image' | 'office' | 'text' | 'other';
  inline_supported: boolean;
  content_type?: string;
  document_name: string;
  preview_url?: string;
  download_url: string;
  size_bytes?: number;
}

export interface StationShipmentListItem {
  id: string;
  awb: string;
  direction: string;
  flight_no: string;
  route: string;
  primary_status: string;
  task_status: string;
  document_status: string;
  blocker: string;
  consignee: string;
  pieces: string;
  weight: string;
  priority: string;
}

export interface StationShipmentDetail {
  id: string;
  title: string;
  eyebrow: string;
  summary: {
    direction: string;
    route: string;
    runtime_status: string;
    fulfillment_status: string;
    priority: string;
    station: string;
  };
  timeline: Array<{
    label: string;
    note: string;
    status: string;
  }>;
  documents: Array<{
    document_id: string;
    type: string;
    name: string;
    status: string;
    linked_task: string;
    note: string;
    gate_ids: string[];
  }>;
  tasks: Array<{
    id: string;
    title: string;
    owner: string;
    status: string;
    due: string;
    evidence: string;
    jump_to: string;
    gate_ids: string[];
  }>;
  exceptions: Array<{
    id: string;
    type: string;
    status: string;
    note: string;
    jump_to: string;
    gate_id?: string;
  }>;
  relationship_rows: Array<{
    source: string;
    relation: string;
    target: string;
    note: string;
  }>;
}

export interface StationTaskListItem {
  task_id: string;
  task_type: string;
  execution_node: string;
  related_object_type: string;
  related_object_id: string;
  related_object_label: string;
  assigned_role?: RoleCode;
  assigned_team_id?: string | null;
  assigned_worker_id?: string | null;
  task_status: TaskStatus;
  task_sla?: string;
  due_at?: string;
  blocker_code?: string;
  evidence_required: boolean;
  open_exception_count: number;
}

export interface AssignTaskInput {
  assigned_role: RoleCode;
  assigned_team_id?: string;
  assigned_worker_id?: string;
  due_at?: string;
  task_sla?: string;
  reason?: string;
}

export interface AssignTaskResult {
  task_id: string;
  task_status: TaskStatus;
  assigned_role: RoleCode;
  assigned_team_id?: string;
  assigned_worker_id?: string;
  due_at?: string;
  audit_action: 'TASK_ASSIGNED';
}

export interface RaiseTaskExceptionInput {
  exception_type: string;
  severity: ServiceLevel;
  blocker_flag: boolean;
  owner_role: RoleCode;
  owner_team_id?: string;
  root_cause?: string;
  action_taken?: string;
  note?: string;
}

export interface RaiseTaskExceptionResult {
  exception_id: string;
  exception_status: ExceptionStatus;
  related_object_type: string;
  related_object_id: string;
  blocker_flag: boolean;
  linked_task_id: string;
  task_status: TaskStatus;
  audit_action: 'TASK_EXCEPTION_RAISED';
}

export interface TaskWorkflowActionInput {
  note?: string;
  reason?: string;
}

export interface TaskWorkflowActionResult {
  task_id: string;
  task_status: TaskStatus;
  audit_action: 'TASK_VERIFIED' | 'TASK_REWORK_REQUESTED' | 'TASK_ESCALATED';
}

export interface StationExceptionListItem {
  exception_id: string;
  exception_type: string;
  related_object_type: string;
  related_object_id: string;
  related_object_label: string;
  severity: ServiceLevel;
  owner_role: RoleCode;
  owner_team_id?: string;
  exception_status: ExceptionStatus;
  blocker_flag: boolean;
  root_cause?: string;
  opened_at?: string;
}

export interface StationExceptionDetail {
  exception_id: string;
  exception_type: string;
  related_object_type: string;
  related_object_id: string;
  related_object_label: string;
  severity: ServiceLevel;
  owner_role: RoleCode;
  owner_team_id?: string;
  exception_status: ExceptionStatus;
  blocker_flag: boolean;
  root_cause?: string;
  action_taken?: string;
  linked_task_id?: string;
  linked_task_label?: string;
  gate_id?: string;
  required_gate?: string;
  recovery_action?: string;
  opened_at?: string;
  related_files: Array<{
    label: string;
    document_id: string;
  }>;
}

export interface ResolveExceptionInput {
  note?: string;
  resolution?: string;
}

export interface ResolveExceptionResult {
  exception_id: string;
  exception_status: ExceptionStatus;
  audit_action: 'EXCEPTION_RESOLVED';
}

export interface MobileTaskListItem {
  task_id: string;
  task_type: string;
  execution_node: string;
  task_status: TaskStatus;
  related_object_type: string;
  related_object_id: string;
  related_object_label: string;
  awb_no?: string;
  flight_no?: string;
  station_id: string;
  due_at?: string;
  evidence_required: boolean;
  blockers: string[];
  allowed_actions: string[];
}

export interface MobileTaskActionInput {
  note?: string;
  evidence_summary?: string;
}

export interface MobileTaskActionResult {
  task_id: string;
  task_status: TaskStatus;
  audit_action: 'MOBILE_TASK_ACCEPTED' | 'MOBILE_TASK_STARTED' | 'MOBILE_TASK_EVIDENCE_UPLOADED' | 'MOBILE_TASK_COMPLETED';
}

export interface OutboundFlightActionInput {
  note?: string;
  document_id?: string;
}

export interface OutboundFlightActionResult {
  flight_id: string;
  runtime_status: FlightRuntimeStatus;
  manifest_status?: string;
  audit_action: 'OUTBOUND_FLIGHT_LOADED' | 'OUTBOUND_MANIFEST_FINALIZED' | 'OUTBOUND_FLIGHT_AIRBORNE';
}
