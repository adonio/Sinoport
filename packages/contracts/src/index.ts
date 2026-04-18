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

export interface UnifiedOptionItem {
  value: string;
  label: string;
  disabled: boolean;
  meta?: Record<string, unknown>;
}

export interface UnifiedOptionsResponse {
  scope: 'platform' | 'station' | 'mobile';
  resource: string;
  station_id?: string;
  direction?: 'inbound' | 'outbound';
  flight_no?: string;
  role_key?: string;
  groups: Record<string, UnifiedOptionItem[]>;
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
  flight_no?: string;
  include_archived?: string;
  keyword?: string;
  runtime_status?: FlightRuntimeStatus;
  service_level?: ServiceLevel;
  station_id?: string;
}

export interface StationFlightWriteInput {
  station_id?: string;
  flight_no: string;
  flight_date?: string;
  origin_code?: string;
  destination_code?: string;
  std_at?: string;
  etd_at?: string;
  sta_at?: string;
  eta_at?: string;
  runtime_status?: FlightRuntimeStatus;
  service_level?: ServiceLevel;
  aircraft_type?: string;
  notes?: string;
}

export interface StationFlightUpdateInput {
  station_id?: string;
  flight_no?: string;
  flight_date?: string;
  origin_code?: string;
  destination_code?: string;
  std_at?: string;
  etd_at?: string;
  sta_at?: string;
  eta_at?: string;
  runtime_status?: FlightRuntimeStatus;
  service_level?: ServiceLevel;
  aircraft_type?: string;
  notes?: string;
  archived?: boolean;
}

export interface StationFlightMutationResult {
  flight_id: string;
  flight_no: string;
  station_id: string;
  runtime_status: FlightRuntimeStatus;
  archived: boolean;
  audit_action: string;
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
  awb_type?: string;
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
  archived?: boolean;
  blocked: boolean;
  blocker_reason?: string;
}

export interface InboundWaybillDetail {
  awb: {
    awb_id: string;
    awb_no: string;
    awb_type?: string;
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
    archived?: boolean;
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
  action_summary: Array<{
    action_code: 'loaded' | 'manifest_finalize' | 'airborne';
    title: string;
    status: 'ready' | 'blocked' | 'completed';
    blocker_reasons: string[];
    recovery_actions: string[];
  }>;
}

export interface OutboundWaybillListItem {
  awb_id: string;
  awb_no: string;
  awb_type?: string;
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
  archived?: boolean;
}

export interface OutboundWaybillDetail {
  awb: {
    awb_id: string;
    awb_no: string;
    awb_type?: string;
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
    archived?: boolean;
  };
  recovery_summary: {
    gate_status: 'ready' | 'blocked' | 'completed';
    open_blocker_count: number;
    blocker_reasons: string[];
    recovery_actions: string[];
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

export interface StationWaybillUpdateInput {
  awb_no?: string;
  awb_type?: string;
  flight_id?: string | null;
  consignee_name?: string;
  notify_name?: string;
  pieces?: number;
  gross_weight?: number;
  current_node?: string;
  noa_status?: NoaStatus;
  pod_status?: PodStatus;
  transfer_status?: TransferStatus;
  manifest_status?: string;
  archived?: boolean;
}

export interface StationWaybillMutationResult {
  awb_id: string;
  awb_no: string;
  station_id: string;
  direction: 'inbound' | 'outbound';
  archived: boolean;
  audit_action: string;
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

export interface StationDocumentUpdateInput {
  document_type?: string;
  document_name?: string;
  related_object_type?: string;
  related_object_id?: string;
  document_status?: DocumentStatus;
  retention_class?: 'temporary' | 'operational' | 'compliance';
  required_for_release?: boolean;
  archived?: boolean;
  note?: string | null;
}

export interface StationDocumentMutationResult {
  document_id: string;
  station_id: string;
  document_status: DocumentStatus;
  archived: boolean;
  audit_action: string;
}

export interface StationDocumentOptions {
  document_type_options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>;
  document_status_options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>;
  retention_class_options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>;
  related_object_type_options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>;
  related_object_options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>;
}

export interface StationDocumentDetail {
  document: StationDocumentListItem & {
    station_id: string;
    note?: string;
    storage_key?: string;
    upload_id?: string | null;
    archived: boolean;
  };
  versions: Array<{
    document_id: string;
    version_no: string;
    document_status: DocumentStatus;
    document_name: string;
    preview_type: 'pdf' | 'image' | 'office' | 'text' | 'other';
    uploaded_at?: string;
    updated_at?: string;
    replaced_by?: string | null;
    rollback_target?: string | null;
    note?: string;
  }>;
  lifecycle: {
    can_update: boolean;
    can_archive: boolean;
    can_restore: boolean;
    can_download: boolean;
    can_preview: boolean;
  };
}

export interface StationShipmentListItem {
  id: string;
  shipment_id: string;
  awb: string;
  awb_id: string;
  direction: string;
  flight_id?: string | null;
  flight_no: string;
  route: string;
  primary_status: string;
  current_node: string;
  fulfillment_status: string;
  runtime_status: string;
  task_status: string;
  document_status: string;
  blocker: string;
  archived?: boolean;
  consignee: string;
  pieces: string;
  weight: string;
  priority: string;
}

export interface StationShipmentOptions {
  direction_options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>;
  flight_options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>;
  current_node_options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>;
  fulfillment_status_options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>;
  blocker_state_options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    meta?: Record<string, unknown>;
  }>;
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
  gate_policy_summary: Array<{
    gate_id: string;
    node: string;
    required: string;
    impact: string;
    status: string;
    blocker: string;
    recovery: string;
    release_role: string;
  }>;
  gate_policy_overview: {
    total: number;
    blocked: number;
    tracked: number;
    gate_ids: string[];
  };
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
  assigned_team_name?: string | null;
  assigned_worker_name?: string | null;
  task_status: TaskStatus;
  task_priority?: ServiceLevel;
  task_sla?: string;
  due_at?: string;
  blocker_code?: string;
  evidence_required: boolean;
  open_exception_count: number;
  archived?: boolean;
}

export interface StationTaskDetail {
  task: {
    task_id: string;
    station_id: string;
    task_type: string;
    execution_node: string;
    related_object_type: string;
    related_object_id: string;
    related_object_label: string;
    assigned_role?: RoleCode;
    assigned_team_id?: string | null;
    assigned_worker_id?: string | null;
    assigned_team_name?: string | null;
    assigned_worker_name?: string | null;
    task_status: TaskStatus;
    task_priority?: ServiceLevel;
    task_sla?: string;
    due_at?: string;
    blocker_code?: string;
    evidence_required: boolean;
    pick_location_id?: string | null;
    drop_location_id?: string | null;
    completed_at?: string | null;
    verified_at?: string | null;
    deleted_at?: string | null;
    archived: boolean;
  };
  lifecycle: {
    can_update: boolean;
    can_archive: boolean;
    can_restore: boolean;
    can_assign: boolean;
    can_verify: boolean;
    can_rework: boolean;
    can_escalate: boolean;
    can_raise_exception: boolean;
  };
}

export interface StationTaskOptions {
  task_status_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  task_priority_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  assigned_role_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  task_type_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  execution_node_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  related_object_type_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  related_object_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  team_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  worker_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
}

export interface StationTaskUpdateInput {
  task_type?: string;
  execution_node?: string;
  related_object_type?: string;
  related_object_id?: string;
  assigned_role?: RoleCode | null;
  assigned_team_id?: string | null;
  assigned_worker_id?: string | null;
  task_sla?: string | null;
  due_at?: string | null;
  blocker_code?: string | null;
  evidence_required?: boolean;
  pick_location_id?: string | null;
  drop_location_id?: string | null;
  archived?: boolean;
}

export interface StationTaskMutationResult {
  task_id: string;
  station_id: string;
  task_status: TaskStatus;
  archived: boolean;
  audit_action:
    | 'TASK_UPDATED'
    | 'TASK_ARCHIVED'
    | 'TASK_RESTORED';
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
  action_taken?: string;
  linked_task_id?: string;
  opened_at?: string;
  archived?: boolean;
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
  archived?: boolean;
  related_files: Array<{
    label: string;
    document_id: string;
  }>;
}

export interface StationExceptionOptions {
  exception_type_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  severity_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  exception_status_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  owner_role_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  related_object_type_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  related_object_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  team_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
  blocker_state_options: Array<{
    value: string;
    label: string;
    disabled: boolean;
    meta?: Record<string, unknown>;
  }>;
}

export interface StationExceptionUpdateInput {
  exception_type?: string;
  severity?: ServiceLevel;
  owner_role?: RoleCode | null;
  owner_team_id?: string | null;
  exception_status?: ExceptionStatus;
  blocker_flag?: boolean;
  root_cause?: string | null;
  action_taken?: string | null;
  related_object_type?: string;
  related_object_id?: string;
  archived?: boolean;
}

export interface StationExceptionMutationResult {
  exception_id: string;
  station_id: string;
  exception_status: ExceptionStatus;
  archived: boolean;
  audit_action:
    | 'EXCEPTION_UPDATED'
    | 'EXCEPTION_ARCHIVED'
    | 'EXCEPTION_RESTORED'
    | 'EXCEPTION_UNCHANGED';
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

export interface StationCopyPackage {
  package_key: string;
  station_id: string;
  station_name: string;
  template_station_id: string;
  template_station_name: string;
  benchmark_station_id: string;
  benchmark_station_name: string;
  comparison_station_ids: string[];
  comparison_station_labels: Array<{
    station_id: string;
    label: string;
    comparison_type: 'actual' | 'template';
    note: string;
  }>;
  minimum_onboarding_unit: Array<{
    unit_key: string;
    label: string;
    required: boolean;
    note: string;
  }>;
  mandatory_consistency_items: Array<{
    item_key: string;
    label: string;
    source: string;
    note: string;
  }>;
  station_override_items: Array<{
    item_key: string;
    label: string;
    source: string;
    note: string;
  }>;
  readiness_checks: Array<{
    check_key: string;
    label: string;
    gate_status: 'clear' | 'warning' | 'blocked';
    note: string;
  }>;
  rollback_policy: {
    mode: 'template-and-configuration';
    summary: string;
    steps: string[];
  };
}

export interface StationOnboardingPlaybook {
  station_id: string;
  station_name: string;
  template_station_id: string;
  template_station_name: string;
  benchmark_station_id: string;
  benchmark_station_name: string;
  sop: {
    scope: string;
    prerequisites: string[];
    steps: Array<{
      step_key: string;
      label: string;
      action: string;
      success_criteria: string;
    }>;
  };
  conflict_rules: Array<{
    rule_key: string;
    label: string;
    category: 'mandatory_consistency' | 'station_override' | 'data_contract' | 'resource_mapping' | 'import_mapping';
    gate_status: 'warning' | 'blocked';
    note: string;
    resolution: string;
  }>;
  onboarding_checklist: Array<{
    item_key: string;
    label: string;
    category: 'identity' | 'runtime' | 'data' | 'reporting' | 'risk';
    required: boolean;
    gate_status: 'clear' | 'warning' | 'blocked';
    note: string;
  }>;
  replay_acceptance: {
    reference_sop_document: string;
    replay_sample_station_id: string;
    replay_scope: string;
    accepted_when: string[];
    rollback_scope: string[];
    excluded_objects: string[];
  };
  completion_policy: {
    warnings_require_manual_ack: boolean;
    completion_criteria: string[];
  };
}
