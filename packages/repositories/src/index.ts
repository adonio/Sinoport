import type { AuthActor } from '@sinoport/auth';
import type {
  AssignTaskInput,
  AssignTaskResult,
  CreateDocumentInput,
  CreateDocumentResult,
  CreateUploadTicketInput,
  CreateUploadTicketResult,
  InboundFlightDetail,
  InboundFlightListItem,
  InboundFlightListQuery,
  InboundWaybillDetail,
  InboundWaybillListItem,
  ListResponse,
  OutboundFlightDetail,
  OutboundFlightActionInput,
  OutboundFlightActionResult,
  OutboundFlightListItem,
  OutboundWaybillDetail,
  OutboundWaybillListItem,
  MobileTaskActionInput,
  MobileTaskActionResult,
  MobileTaskListItem,
  NoaActionInput,
  NoaActionResult,
  PodActionInput,
  PodActionResult,
  RaiseTaskExceptionInput,
  RaiseTaskExceptionResult,
  ResolveExceptionInput,
  ResolveExceptionResult,
  RoleCode,
  StationDocumentListItem,
  StationDocumentPreviewResult,
  StationExceptionDetail,
  StationExceptionListItem,
  StationShipmentDetail,
  StationShipmentListItem,
  StationTaskListItem,
  TaskStatus,
  TaskWorkflowActionInput,
  TaskWorkflowActionResult
} from '@sinoport/contracts';

export class RepositoryNotReadyError extends Error {
  constructor(public readonly repositoryMethod: string) {
    super(`${repositoryMethod} is not implemented yet`);
    this.name = 'RepositoryNotReadyError';
  }
}

export class RepositoryOperationError extends Error {
  constructor(
    public readonly httpStatus: 400 | 401 | 403 | 404 | 409,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'RepositoryOperationError';
  }
}

export interface D1RunResultLike {
  success?: boolean;
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<D1RunResultLike>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

export interface FlightRepository {
  getInboundFlight(flightId: string): Promise<InboundFlightDetail | null>;
  getOutboundFlight(flightId: string): Promise<OutboundFlightDetail | null>;
  listInboundFlights(query: InboundFlightListQuery): Promise<ListResponse<InboundFlightListItem>>;
  listOutboundFlights(query: Record<string, string | undefined>): Promise<ListResponse<OutboundFlightListItem>>;
  markOutboundLoaded(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult>;
  finalizeOutboundManifest(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult>;
  markOutboundAirborne(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult>;
}

export interface WaybillRepository {
  getInboundWaybill(awbId: string): Promise<InboundWaybillDetail | null>;
  getOutboundWaybill(awbId: string): Promise<OutboundWaybillDetail | null>;
  listInboundWaybills(query: Record<string, string | undefined>): Promise<ListResponse<InboundWaybillListItem>>;
  listOutboundWaybills(query: Record<string, string | undefined>): Promise<ListResponse<OutboundWaybillListItem>>;
  processInboundNoa(awbId: string, input: NoaActionInput): Promise<NoaActionResult>;
  processInboundPod(awbId: string, input: PodActionInput): Promise<PodActionResult>;
}

export interface DocumentRepository {
  createDocument(input: CreateDocumentInput): Promise<CreateDocumentResult>;
  createUploadTicket(input: CreateUploadTicketInput): Promise<CreateUploadTicketResult>;
  listStationDocuments(query: Record<string, string | undefined>): Promise<ListResponse<StationDocumentListItem>>;
  getStationDocumentPreview(documentId: string): Promise<StationDocumentPreviewResult | null>;
}

export interface ShipmentRepository {
  getStationShipment(shipmentId: string): Promise<StationShipmentDetail | null>;
  listStationShipments(query: Record<string, string | undefined>): Promise<ListResponse<StationShipmentListItem>>;
}

export interface TaskRepository {
  assignTask(taskId: string, input: AssignTaskInput): Promise<AssignTaskResult>;
  acceptMobileTask(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult>;
  completeMobileTask(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult>;
  verifyTask(taskId: string, input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult>;
  reworkTask(taskId: string, input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult>;
  escalateTask(taskId: string, input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult>;
  listMobileTasks(query: Record<string, string | undefined>): Promise<ListResponse<MobileTaskListItem>>;
  listStationTasks(query: Record<string, string | undefined>): Promise<ListResponse<StationTaskListItem>>;
  startMobileTask(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult>;
  uploadMobileTaskEvidence(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult>;
  raiseTaskException(taskId: string, input: RaiseTaskExceptionInput): Promise<RaiseTaskExceptionResult>;
}

export interface ExceptionRepository {
  getStationException(exceptionId: string): Promise<StationExceptionDetail | null>;
  listStationExceptions(query: Record<string, string | undefined>): Promise<ListResponse<StationExceptionListItem>>;
  resolveStationException(exceptionId: string, input: ResolveExceptionInput): Promise<ResolveExceptionResult>;
}

export interface RepositoryRegistry {
  documents: DocumentRepository;
  exceptions: ExceptionRepository;
  flights: FlightRepository;
  shipments: ShipmentRepository;
  tasks: TaskRepository;
  waybills: WaybillRepository;
}

interface RepositoryFactoryOptions {
  actor?: AuthActor;
  db?: D1DatabaseLike;
  requestId?: string;
}

interface FlightSummaryRow {
  flight_id: string;
  flight_no: string;
  flight_date: string;
  station_id: string;
  origin_code: string;
  destination_code: string;
  eta: string | null;
  actual_landed_at: string | null;
  runtime_status: InboundFlightListItem['runtime_status'];
  service_level: InboundFlightListItem['service_level'] | null;
  current_step: string;
  total_awb_count: number | string | null;
  total_pieces: number | string | null;
  total_weight: number | string | null;
  open_task_count: number | string | null;
  completed_task_count?: number | string | null;
  open_exception_count: number | string | null;
  blocker_reason: string | null;
}

interface WaybillListRow {
  awb_id: string;
  awb_no: string;
  shipment_id: string;
  flight_id: string;
  flight_no: string;
  consignee_name: string;
  pieces: number | string;
  gross_weight: number | string;
  current_node: string;
  noa_status: InboundWaybillListItem['noa_status'];
  pod_status: InboundWaybillListItem['pod_status'];
  transfer_status: InboundWaybillListItem['transfer_status'];
  blocker_reason: string | null;
  blocker_count: number | string | null;
}

interface WaybillSummaryRow {
  awb_id: string;
  awb_no: string;
  current_node: string;
  noa_status: InboundFlightDetail['waybill_summary'][number]['noa_status'];
  pod_status: InboundFlightDetail['waybill_summary'][number]['pod_status'];
}

interface WaybillDetailRow {
  awb_id: string;
  awb_no: string;
  shipment_id: string;
  flight_id: string;
  flight_no: string;
  station_id: string;
  consignee_name: string;
  pieces: number | string;
  gross_weight: number | string;
  current_node: string;
  noa_status: InboundWaybillDetail['awb']['noa_status'];
  pod_status: InboundWaybillDetail['awb']['pod_status'];
  transfer_status: InboundWaybillDetail['awb']['transfer_status'];
  fulfillment_status: InboundWaybillDetail['shipment']['fulfillment_status'];
  shipment_service_level: InboundWaybillDetail['shipment']['service_level'];
  shipment_current_node: string;
}

interface OutboundFlightSummaryRow {
  flight_id: string;
  flight_no: string;
  flight_date: string;
  station_id: string;
  origin_code: string;
  destination_code: string;
  etd: string | null;
  runtime_status: OutboundFlightListItem['runtime_status'];
  service_level: OutboundFlightListItem['service_level'] | null;
  total_awb_count: number | string | null;
  total_pieces: number | string | null;
  total_weight: number | string | null;
  loaded_awb_count?: number | string | null;
  manifest_pending_count?: number | string | null;
  stage: string;
  manifest_status: string;
}

interface OutboundWaybillRow {
  awb_id: string;
  awb_no: string;
  shipment_id: string;
  flight_id: string;
  flight_no: string;
  station_id: string;
  destination_code: string;
  pieces: number | string;
  gross_weight: number | string;
  forecast_status: string;
  receipt_status: string;
  master_status: string;
  loading_status: string;
  manifest_status: string;
}

interface DocumentSummaryRow {
  document_id: string;
  document_type: string;
  document_status: InboundFlightDetail['document_summary'][number]['document_status'];
  required_for_release: number | string | null;
}

interface StationDocumentRow {
  document_id: string;
  document_type: string;
  document_name: string;
  related_object_type: string;
  related_object_id: string;
  related_object_label: string | null;
  version_no: string;
  document_status: StationDocumentListItem['document_status'];
  required_for_release: number | string | null;
  content_type: string | null;
  size_bytes: number | string | null;
  checksum_sha256: string | null;
  retention_class: string | null;
  deleted_at: string | null;
  uploaded_at: string | null;
}

interface StationShipmentRow {
  shipment_id: string;
  shipment_type: string | null;
  current_node: string;
  fulfillment_status: string;
  service_level: string | null;
  total_pieces: number | string | null;
  total_weight: number | string | null;
  awb_id: string;
  awb_no: string;
  flight_id: string | null;
  flight_no: string | null;
  station_id: string;
  origin_code: string | null;
  destination_code: string | null;
  runtime_status: string | null;
  consignee_name: string;
  task_status: string | null;
  document_status: string | null;
  blocker_reason: string | null;
}

interface TaskSummaryRow {
  task_id: string;
  task_type: string;
  task_status: InboundFlightDetail['task_summary'][number]['task_status'];
  assigned_team_id: string | null;
}

interface ExceptionSummaryRow {
  exception_id: string;
  exception_type: string;
  exception_status: InboundFlightDetail['exception_summary'][number]['exception_status'];
  severity: InboundFlightDetail['exception_summary'][number]['severity'];
  blocker_flag: number | string | null;
}

interface StationTaskRow {
  task_id: string;
  task_type: string;
  execution_node: string;
  related_object_type: string;
  related_object_id: string;
  related_object_label: string | null;
  assigned_role: RoleCode | null;
  assigned_team_id: string | null;
  assigned_worker_id: string | null;
  task_status: StationTaskListItem['task_status'];
  task_sla: string | null;
  due_at: string | null;
  blocker_code: string | null;
  evidence_required: number | string | null;
  open_exception_count: number | string | null;
}

interface StationExceptionRow {
  exception_id: string;
  exception_type: string;
  related_object_type: string;
  related_object_id: string;
  related_object_label: string | null;
  severity: StationExceptionListItem['severity'];
  owner_role: StationExceptionListItem['owner_role'];
  owner_team_id: string | null;
  exception_status: StationExceptionListItem['exception_status'];
  blocker_flag: number | string | null;
  root_cause: string | null;
  opened_at: string | null;
}

interface StationExceptionDetailRow extends StationExceptionRow {
  action_taken: string | null;
  linked_task_id: string | null;
  linked_task_label: string | null;
}

interface RelatedFileRow {
  document_id: string;
  document_name: string;
}

interface ShipmentTaskRow {
  task_id: string;
  task_type: string;
  task_status: string;
  due_at: string | null;
  evidence_required: number | string | null;
  blocker_code: string | null;
  assigned_team_name: string | null;
  assigned_worker_name: string | null;
  assigned_role: RoleCode | null;
}

interface ShipmentDocumentRow {
  document_id: string;
  document_type: string;
  document_name: string;
  document_status: string;
  required_for_release: number | string | null;
}

interface TaskLookupRow {
  task_id: string;
  station_id: string;
  task_status: TaskStatus;
  assigned_role: RoleCode | null;
  assigned_team_id: string | null;
  assigned_worker_id: string | null;
}

interface WorkerLookupRow {
  worker_id: string;
  station_id: string;
  role_code: RoleCode;
  worker_status: string;
}

interface TeamLookupRow {
  team_id: string;
  station_id: string;
  team_status: string;
}

interface DocumentLookupRow {
  document_id: string;
  station_id: string;
  version_no: string;
  content_type?: string | null;
  document_name?: string | null;
  storage_key?: string | null;
  size_bytes?: number | string | null;
  checksum_sha256?: string | null;
  retention_class?: string | null;
  deleted_at?: string | null;
  upload_id?: string | null;
}

interface UploadTicketRow {
  upload_id: string;
  station_id: string;
  related_object_type: string;
  document_name: string;
  content_type: string;
  size_bytes: number | string | null;
  checksum_sha256: string | null;
  retention_class: string;
  storage_key: string;
  upload_token: string;
  expires_at: string;
  consumed_at: string | null;
  uploaded_at: string | null;
}

interface FlightLookupRow {
  flight_id: string;
  station_id: string;
  runtime_status: string;
  etd_at: string | null;
  actual_takeoff_at: string | null;
}

interface OutboundFlightActionAwbRow {
  awb_id: string;
  shipment_id: string;
  current_node: string;
}

interface OutboundFlightActionShipmentRow {
  shipment_id: string;
  current_node: string;
  fulfillment_status: string;
}

interface OutboundFlightActionDocumentRow {
  document_id: string;
  document_type: string;
  document_status: string;
  related_object_type: string;
  related_object_id: string;
}

interface OutboundFlightActionTaskRow {
  task_id: string;
  task_type: string;
  task_status: TaskStatus;
  related_object_type: string;
  related_object_id: string;
}

interface OutboundFlightActionState {
  flight: FlightLookupRow;
  awbs: OutboundFlightActionAwbRow[];
  shipments: OutboundFlightActionShipmentRow[];
  documents: OutboundFlightActionDocumentRow[];
  tasks: OutboundFlightActionTaskRow[];
}

class BaseD1Repository {
  constructor(
    protected readonly db: D1DatabaseLike,
    protected readonly actor: AuthActor | undefined,
    protected readonly requestId: string
  ) {}

  protected ensureActor() {
    if (!this.actor) {
      throw new RepositoryOperationError(401, 'UNAUTHORIZED', 'Missing request actor');
    }

    return this.actor;
  }

  protected assertActorStation(stationId: string) {
    const actor = this.ensureActor();

    if (!actor.stationScope.includes(stationId)) {
      throw new RepositoryOperationError(403, 'STATION_SCOPE_DENIED', 'Actor cannot access requested station', {
        station_id: stationId
      });
    }

    return actor;
  }

  protected async writeAudit(params: {
    action: string;
    objectType: string;
    objectId: string;
    stationId: string;
    summary: string;
    payload?: Record<string, unknown>;
  }) {
    const actor = this.ensureActor();
    const auditId = createId('AUD');

    await this.db
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
        this.requestId,
        actor.userId,
        actor.roleIds[0] ?? 'station_supervisor',
        actor.clientSource,
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

  protected async writeStateTransition(params: {
    stationId: string;
    objectType: string;
    objectId: string;
    stateField: string;
    fromValue: string | null;
    toValue: string;
    triggeredBy: string;
    auditId?: string;
    reason?: string;
  }) {
    await this.db
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
        params.triggeredBy,
        isoNow(),
        params.reason ?? null,
        params.auditId ?? null
      )
      .run();
  }
}

class D1FlightRepository extends BaseD1Repository implements FlightRepository {
  async listInboundFlights(query: InboundFlightListQuery): Promise<ListResponse<InboundFlightListItem>> {
    const { page, pageSize, offset } = parsePagination(query.page, query.page_size);
    const { params, whereClause } = buildInboundFlightWhereClause(query);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM flights f
      WHERE ${whereClause}
    `;

    const listSql = `
      SELECT
        f.flight_id,
        f.flight_no,
        f.flight_date,
        f.station_id,
        f.origin_code,
        f.destination_code,
        f.eta_at AS eta,
        f.actual_landed_at,
        f.runtime_status,
        f.service_level,
        CASE
          WHEN f.runtime_status = 'Landed' THEN 'Inbound Handling'
          WHEN f.runtime_status = 'Pre-Arrival' THEN 'Destination Ramp Handling'
          ELSE f.runtime_status
        END AS current_step,
        COALESCE(awb.total_awb_count, 0) AS total_awb_count,
        COALESCE(awb.total_pieces, 0) AS total_pieces,
        COALESCE(awb.total_weight, 0) AS total_weight,
        COALESCE(task.open_task_count, 0) AS open_task_count,
        COALESCE(ex.open_exception_count, 0) AS open_exception_count,
        ex.blocker_reason
      FROM flights f
      LEFT JOIN (
        SELECT
          flight_id,
          COUNT(*) AS total_awb_count,
          SUM(pieces) AS total_pieces,
          SUM(gross_weight) AS total_weight
        FROM awbs
        GROUP BY flight_id
      ) awb ON awb.flight_id = f.flight_id
      LEFT JOIN (
        SELECT
          related_object_id AS flight_id,
          COUNT(*) AS open_task_count
        FROM tasks
        WHERE related_object_type = 'Flight'
          AND task_status NOT IN ('Completed', 'Verified', 'Closed')
        GROUP BY related_object_id
      ) task ON task.flight_id = f.flight_id
      LEFT JOIN (
        SELECT
          related_object_id AS flight_id,
          COUNT(*) AS open_exception_count,
          MAX(root_cause) AS blocker_reason
        FROM exceptions
        WHERE related_object_type = 'Flight'
          AND exception_status NOT IN ('Resolved', 'Closed')
        GROUP BY related_object_id
      ) ex ON ex.flight_id = f.flight_id
      WHERE ${whereClause}
      ORDER BY f.flight_date DESC, f.eta_at ASC, f.flight_no ASC
      LIMIT ? OFFSET ?
    `;

    const [countRow, listRows] = await Promise.all([
      this.db.prepare(countSql).bind(...params).first<{ total: number | string }>(),
      this.db.prepare(listSql).bind(...params, pageSize, offset).all<FlightSummaryRow>()
    ]);

    return {
      items: listRows.results.map(mapFlightSummaryRow),
      page,
      page_size: pageSize,
      total: Number(countRow?.total ?? 0)
    };
  }

  async getInboundFlight(flightId: string): Promise<InboundFlightDetail | null> {
    const flightSql = `
      SELECT
        f.flight_id,
        f.flight_no,
        f.flight_date,
        f.station_id,
        f.origin_code,
        f.destination_code,
        f.eta_at AS eta,
        f.actual_landed_at,
        f.runtime_status,
        f.service_level,
        COALESCE(awb.total_awb_count, 0) AS total_awb_count,
        COALESCE(awb.total_pieces, 0) AS total_pieces,
        COALESCE(awb.total_weight, 0) AS total_weight,
        COALESCE(task.open_task_count, 0) AS open_task_count,
        COALESCE(task.completed_task_count, 0) AS completed_task_count,
        COALESCE(ex.open_exception_count, 0) AS open_exception_count
      FROM flights f
      LEFT JOIN (
        SELECT
          flight_id,
          COUNT(*) AS total_awb_count,
          SUM(pieces) AS total_pieces,
          SUM(gross_weight) AS total_weight
        FROM awbs
        GROUP BY flight_id
      ) awb ON awb.flight_id = f.flight_id
      LEFT JOIN (
        SELECT
          related_object_id AS flight_id,
          SUM(CASE WHEN task_status IN ('Completed', 'Verified', 'Closed') THEN 1 ELSE 0 END) AS completed_task_count,
          SUM(CASE WHEN task_status NOT IN ('Completed', 'Verified', 'Closed') THEN 1 ELSE 0 END) AS open_task_count
        FROM tasks
        WHERE related_object_type = 'Flight'
        GROUP BY related_object_id
      ) task ON task.flight_id = f.flight_id
      LEFT JOIN (
        SELECT
          related_object_id AS flight_id,
          COUNT(*) AS open_exception_count
        FROM exceptions
        WHERE related_object_type = 'Flight'
          AND exception_status NOT IN ('Resolved', 'Closed')
        GROUP BY related_object_id
      ) ex ON ex.flight_id = f.flight_id
      WHERE f.flight_id = ?
      LIMIT 1
    `;

    const flightRow = await this.db.prepare(flightSql).bind(flightId).first<FlightSummaryRow>();

    if (!flightRow) {
      return null;
    }

    const [waybills, documents, tasks, exceptions] = await Promise.all([
      this.db
        .prepare(
          `
            SELECT awb_id, awb_no, current_node, noa_status, pod_status
            FROM awbs
            WHERE flight_id = ?
            ORDER BY awb_no ASC
          `
        )
        .bind(flightId)
        .all<WaybillSummaryRow>(),
      this.db
        .prepare(
          `
            SELECT document_id, document_type, document_status, required_for_release
            FROM documents
            WHERE related_object_type = 'Flight'
              AND related_object_id = ?
              AND document_status != 'Replaced'
            ORDER BY uploaded_at DESC
          `
        )
        .bind(flightId)
        .all<DocumentSummaryRow>(),
      this.db
        .prepare(
          `
            SELECT task_id, task_type, task_status, assigned_team_id
            FROM tasks
            WHERE related_object_type = 'Flight'
              AND related_object_id = ?
            ORDER BY due_at ASC, task_id ASC
          `
        )
        .bind(flightId)
        .all<TaskSummaryRow>(),
      this.db
        .prepare(
          `
            SELECT exception_id, exception_type, exception_status, severity, blocker_flag
            FROM exceptions
            WHERE related_object_type = 'Flight'
              AND related_object_id = ?
            ORDER BY opened_at DESC, exception_id DESC
          `
        )
        .bind(flightId)
        .all<ExceptionSummaryRow>()
    ]);

    return {
      flight: {
        flight_id: flightRow.flight_id,
        flight_no: flightRow.flight_no,
        flight_date: flightRow.flight_date,
        station_id: flightRow.station_id,
        origin_code: flightRow.origin_code,
        destination_code: flightRow.destination_code,
        eta: flightRow.eta ?? undefined,
        actual_landed_at: flightRow.actual_landed_at ?? undefined,
        runtime_status: flightRow.runtime_status,
        service_level: flightRow.service_level ?? undefined
      },
      kpis: {
        total_awb_count: Number(flightRow.total_awb_count ?? 0),
        total_pieces: Number(flightRow.total_pieces ?? 0),
        total_weight: Number(flightRow.total_weight ?? 0),
        completed_task_count: Number(flightRow.completed_task_count ?? 0),
        open_task_count: Number(flightRow.open_task_count ?? 0),
        open_exception_count: Number(flightRow.open_exception_count ?? 0)
      },
      waybill_summary: waybills.results.map((row) => ({
        awb_id: row.awb_id,
        awb_no: row.awb_no,
        current_node: row.current_node,
        noa_status: row.noa_status,
        pod_status: row.pod_status
      })),
      document_summary: documents.results.map((row) => ({
        document_id: row.document_id,
        document_type: row.document_type,
        document_status: row.document_status,
        required_for_release: booleanFromRow(row.required_for_release)
      })),
      task_summary: tasks.results.map((row) => ({
        task_id: row.task_id,
        task_type: row.task_type,
        task_status: row.task_status,
        assigned_team_id: row.assigned_team_id ?? undefined
      })),
      exception_summary: exceptions.results.map((row) => ({
        exception_id: row.exception_id,
        exception_type: row.exception_type,
        exception_status: row.exception_status,
        severity: row.severity,
        blocker_flag: booleanFromRow(row.blocker_flag)
      }))
    };
  }

  async listOutboundFlights(query: Record<string, string | undefined>): Promise<ListResponse<OutboundFlightListItem>> {
    const { page, pageSize, offset } = parsePagination(query.page, query.page_size);
    const { params, whereClause } = buildOutboundFlightWhereClause(query);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM flights f
      WHERE ${whereClause}
    `;

    const listSql = `
      SELECT
        f.flight_id,
        f.flight_no,
        f.flight_date,
        f.station_id,
        f.origin_code,
        f.destination_code,
        f.etd_at AS etd,
        f.runtime_status,
        f.service_level,
        COALESCE(awb.total_awb_count, 0) AS total_awb_count,
        COALESCE(awb.total_pieces, 0) AS total_pieces,
        COALESCE(awb.total_weight, 0) AS total_weight,
        COALESCE(awb.loaded_awb_count, 0) AS loaded_awb_count,
        COALESCE(awb.manifest_pending_count, 0) AS manifest_pending_count,
        COALESCE(doc.manifest_status, '待处理') AS manifest_status,
        COALESCE(task.stage, '待处理') AS stage
      FROM flights f
      LEFT JOIN (
        SELECT
          a.flight_id,
          COUNT(*) AS total_awb_count,
          SUM(a.pieces) AS total_pieces,
          SUM(a.gross_weight) AS total_weight,
          SUM(CASE WHEN t.task_status = 'Completed' THEN 1 ELSE 0 END) AS loaded_awb_count,
          SUM(CASE WHEN COALESCE(d.document_status, 'Missing') NOT IN ('Released', 'Approved') THEN 1 ELSE 0 END) AS manifest_pending_count
        FROM awbs a
        LEFT JOIN tasks t ON t.related_object_type = 'AWB' AND t.related_object_id = a.awb_id AND t.task_type = '出港收货'
        LEFT JOIN documents d ON d.related_object_type = 'Shipment' AND d.related_object_id = a.shipment_id AND d.document_type = 'Manifest'
        GROUP BY a.flight_id
      ) awb ON awb.flight_id = f.flight_id
      LEFT JOIN (
        SELECT
          related_object_id AS flight_id,
          CASE
            WHEN MAX(CASE WHEN task_status = 'Started' THEN 1 ELSE 0 END) = 1 THEN '装载中'
            WHEN MAX(CASE WHEN task_status = 'Assigned' THEN 1 ELSE 0 END) = 1 THEN '主单完成'
            ELSE '待处理'
          END AS stage
        FROM tasks
        WHERE related_object_type = 'Flight'
        GROUP BY related_object_id
      ) task ON task.flight_id = f.flight_id
      LEFT JOIN (
        SELECT
          related_object_id AS flight_id,
          MAX(CASE WHEN document_status IN ('Released', 'Approved') THEN '已导入' ELSE '待生成' END) AS manifest_status
        FROM documents
        WHERE related_object_type = 'Flight'
          AND document_type IN ('FFM', 'UWS', 'Manifest')
        GROUP BY related_object_id
      ) doc ON doc.flight_id = f.flight_id
      WHERE ${whereClause}
      ORDER BY f.flight_date DESC, COALESCE(f.etd_at, '9999-12-31T23:59:59Z') ASC, f.flight_no ASC
      LIMIT ? OFFSET ?
    `;

    const [countRow, listRows] = await Promise.all([
      this.db.prepare(countSql).bind(...params).first<{ total: number | string }>(),
      this.db.prepare(listSql).bind(...params, pageSize, offset).all<OutboundFlightSummaryRow>()
    ]);

    return {
      items: listRows.results.map((row) => ({
        flight_id: row.flight_id,
        flight_no: row.flight_no,
        flight_date: row.flight_date,
        station_id: row.station_id,
        origin_code: row.origin_code,
        destination_code: row.destination_code,
        etd: row.etd ?? undefined,
        runtime_status: row.runtime_status,
        service_level: row.service_level ?? undefined,
        summary: {
          stage: row.runtime_status === 'Airborne' ? '飞走归档' : row.stage,
          manifest_status: row.manifest_status,
          total_awb_count: Number(row.total_awb_count ?? 0),
          total_pieces: Number(row.total_pieces ?? 0),
          total_weight: Number(row.total_weight ?? 0)
        }
      })),
      page,
      page_size: pageSize,
      total: Number(countRow?.total ?? 0)
    };
  }

  async getOutboundFlight(flightId: string): Promise<OutboundFlightDetail | null> {
    const flight = await this.db
      .prepare(
        `
          SELECT
            f.flight_id,
            f.flight_no,
            f.flight_date,
            f.station_id,
            f.origin_code,
            f.destination_code,
            f.etd_at AS etd,
            f.runtime_status,
            f.service_level
          FROM flights f
          WHERE f.flight_id = ?
          LIMIT 1
        `
      )
      .bind(flightId)
      .first<OutboundFlightSummaryRow>();

    if (!flight) {
      return null;
    }

    const [waybills, documents, tasks, exceptions] = await Promise.all([
      this.db
        .prepare(
          `
            SELECT
              a.awb_id,
              a.awb_no,
              a.shipment_id,
              a.flight_id,
              f.flight_no,
              COALESCE(a.notify_name, a.consignee_name, f.destination_code) AS destination_code,
              a.pieces,
              a.gross_weight,
              COALESCE(ffm.document_status, 'Missing') AS ffm_status,
              COALESCE(mawb.document_status, 'Missing') AS mawb_status,
              COALESCE(manifest.document_status, 'Missing') AS manifest_doc_status,
              receipt.task_status AS receipt_task_status,
              loading.task_status AS loading_task_status,
              f.runtime_status
            FROM awbs a
            JOIN flights f ON f.flight_id = a.flight_id
            LEFT JOIN documents ffm ON ffm.related_object_type = 'Flight' AND ffm.related_object_id = a.flight_id AND ffm.document_type = 'FFM'
            LEFT JOIN documents mawb ON mawb.related_object_type = 'AWB' AND mawb.related_object_id = a.awb_id AND mawb.document_type = 'MAWB'
            LEFT JOIN documents manifest ON manifest.related_object_type = 'Shipment' AND manifest.related_object_id = a.shipment_id AND manifest.document_type = 'Manifest'
            LEFT JOIN tasks receipt ON receipt.related_object_type = 'AWB' AND receipt.related_object_id = a.awb_id AND receipt.task_type = '出港收货'
            LEFT JOIN tasks loading ON loading.related_object_type = 'Flight' AND loading.related_object_id = a.flight_id AND loading.task_type = '装机复核'
            WHERE a.flight_id = ?
            ORDER BY a.awb_no ASC
          `
        )
        .bind(flightId)
        .all<OutboundWaybillRow & {
          ffm_status: string | null;
          mawb_status: string | null;
          manifest_doc_status: string | null;
          receipt_task_status: string | null;
          loading_task_status: string | null;
          runtime_status: string | null;
        }>(),
      this.db
        .prepare(
          `
            SELECT document_id, document_type, document_status, required_for_release
            FROM documents
            WHERE document_status != 'Replaced'
              AND (
                (related_object_type = 'Flight' AND related_object_id = ?)
                OR (related_object_type = 'Shipment' AND related_object_id IN (
                  SELECT shipment_id FROM awbs WHERE flight_id = ?
                ))
              )
            ORDER BY uploaded_at DESC, document_id DESC
          `
        )
        .bind(flightId, flightId)
        .all<DocumentSummaryRow>(),
      this.db
        .prepare(
          `
            SELECT task_id, task_type, task_status, assigned_team_id
            FROM tasks
            WHERE related_object_type = 'Flight'
              AND related_object_id = ?
            ORDER BY due_at ASC, task_id ASC
          `
        )
        .bind(flightId)
        .all<TaskSummaryRow>(),
      this.db
        .prepare(
          `
            SELECT exception_id, exception_type, exception_status, severity, blocker_flag
            FROM exceptions
            WHERE related_object_type = 'Flight'
              AND related_object_id = ?
            ORDER BY opened_at DESC, exception_id DESC
          `
        )
        .bind(flightId)
        .all<ExceptionSummaryRow>()
    ]);

    const items = waybills.results.map((row) => {
      const statuses = deriveOutboundStatuses(row);
      return {
        awb_id: row.awb_id,
        awb_no: row.awb_no,
        destination_code: row.destination_code,
        ...statuses
      };
    });

    return {
      flight: {
        flight_id: flight.flight_id,
        flight_no: flight.flight_no,
        flight_date: flight.flight_date,
        station_id: flight.station_id,
        origin_code: flight.origin_code,
        destination_code: flight.destination_code,
        etd: flight.etd ?? undefined,
        runtime_status: flight.runtime_status,
        service_level: flight.service_level ?? undefined
      },
      kpis: {
        total_awb_count: items.length,
        total_pieces: waybills.results.reduce((sum, item) => sum + Number(item.pieces ?? 0), 0),
        total_weight: waybills.results.reduce((sum, item) => sum + Number(item.gross_weight ?? 0), 0),
        loaded_awb_count: items.filter((item) => item.loading_status === '已装载').length,
        manifest_pending_count: items.filter((item) => item.manifest_status !== '运行中').length
      },
      waybill_summary: items,
      document_summary: documents.results.map((item) => ({
        document_id: item.document_id,
        document_type: item.document_type,
        document_status: item.document_status,
        required_for_release: booleanFromRow(item.required_for_release)
      })),
      task_summary: tasks.results.map((item) => ({
        task_id: item.task_id,
        task_type: item.task_type,
        task_status: item.task_status,
        assigned_team_id: item.assigned_team_id ?? undefined
      })),
      exception_summary: exceptions.results.map((item) => ({
        exception_id: item.exception_id,
        exception_type: item.exception_type,
        exception_status: item.exception_status,
        severity: item.severity,
        blocker_flag: booleanFromRow(item.blocker_flag)
      }))
    };
  }

  async markOutboundLoaded(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult> {
    const actor = this.ensureActor();
    const state = await loadOutboundFlightActionState(this.db, flightId);
    const flight = state.flight;

    this.assertActorStation(flight.station_id);

    if (flight.actual_takeoff_at || flight.runtime_status === 'Airborne') {
      throw new RepositoryOperationError(409, 'OUTBOUND_FLIGHT_ALREADY_DEPARTED', 'Outbound flight has already departed', {
        flight_id: flightId,
        runtime_status: flight.runtime_status,
        actual_takeoff_at: flight.actual_takeoff_at
      });
    }

    if (!state.awbs.length) {
      throw new RepositoryOperationError(409, 'OUTBOUND_FLIGHT_EMPTY', 'Outbound flight must have at least one AWB before loaded', {
        flight_id: flightId
      });
    }

    const loadingTasks = state.tasks.filter((task) => task.related_object_type === 'Flight' && task.task_type === '装机复核');
    if (!loadingTasks.length) {
      throw new RepositoryOperationError(409, 'OUTBOUND_LOADING_TASK_MISSING', 'Loaded confirmation task is missing for this flight', {
        flight_id: flightId
      });
    }

    if (loadingTasks.some((task) => task.task_status === 'Completed')) {
      throw new RepositoryOperationError(409, 'OUTBOUND_FLIGHT_ALREADY_LOADED', 'Outbound flight has already been marked loaded', {
        flight_id: flightId,
        task_id: loadingTasks.find((task) => task.task_status === 'Completed')?.task_id
      });
    }

    const receiptTasks = state.tasks.filter(
      (task) => task.related_object_type === 'AWB' && task.task_type === '出港收货'
    );
    if (!receiptTasks.length) {
      throw new RepositoryOperationError(409, 'OUTBOUND_RECEIPT_TASK_MISSING', 'Outbound receipt tasks are missing for this flight', {
        flight_id: flightId
      });
    }

    const incompleteReceiptTask = receiptTasks.find((task) => task.task_status !== 'Completed');
    if (incompleteReceiptTask) {
      throw new RepositoryOperationError(409, 'OUTBOUND_RECEIPT_INCOMPLETE', 'All outbound receipt tasks must be completed before loaded', {
        flight_id: flightId,
        task_id: incompleteReceiptTask.task_id,
        current_status: incompleteReceiptTask.task_status
      });
    }

    const flightDocuments = state.documents.filter((document) => document.related_object_type === 'Flight');
    const requiredDocumentTypes = ['FFM', 'UWS'];
    const missingDocumentTypes = requiredDocumentTypes.filter(
      (documentType) =>
        !flightDocuments.some(
          (document) =>
            document.document_type === documentType &&
            ['Uploaded', 'Validated', 'Approved', 'Released'].includes(document.document_status)
        )
    );

    if (missingDocumentTypes.length) {
      throw new RepositoryOperationError(409, 'OUTBOUND_LOADING_DOCUMENTS_INCOMPLETE', 'Required flight documents must be ready before loaded', {
        flight_id: flightId,
        missing_document_types: missingDocumentTypes
      });
    }

    const now = isoNow();
    await this.db
      .prepare(
        `
          UPDATE tasks
          SET task_status = 'Completed',
              completed_at = COALESCE(completed_at, ?),
              updated_at = ?
          WHERE related_object_type = 'Flight'
            AND related_object_id = ?
            AND task_type = '装机复核'
        `
      )
      .bind(now, now, flightId)
      .run();

    await this.db
      .prepare(
        `
          UPDATE awbs
          SET current_node = 'Loaded',
              updated_at = ?
          WHERE flight_id = ?
        `
      )
      .bind(now, flightId)
      .run();

    await this.db
      .prepare(
        `
          UPDATE shipments
          SET current_node = 'Loaded',
              updated_at = ?
          WHERE shipment_id IN (
            SELECT DISTINCT shipment_id
            FROM awbs
            WHERE flight_id = ?
          )
        `
      )
      .bind(now, flightId)
      .run();

    const auditId = await this.writeAudit({
      action: 'OUTBOUND_FLIGHT_LOADED',
      objectType: 'Flight',
      objectId: flightId,
      stationId: flight.station_id,
      summary: `Outbound flight ${flightId} marked as loaded`,
      payload: {
        note: input.note ?? null,
        document_id: input.document_id ?? null,
        awb_count: state.awbs.length,
        shipment_count: state.shipments.length
      }
    });

    if (flight.runtime_status !== 'Pre-Departure') {
      await this.db
        .prepare(`UPDATE flights SET runtime_status = 'Pre-Departure', updated_at = ? WHERE flight_id = ?`)
        .bind(now, flightId)
        .run();

      await this.writeStateTransition({
        stationId: flight.station_id,
        objectType: 'Flight',
        objectId: flightId,
        stateField: 'runtime_status',
        fromValue: flight.runtime_status,
        toValue: 'Pre-Departure',
        triggeredBy: actor.userId,
        auditId,
        reason: input.note
      });
    }

    for (const shipment of state.shipments) {
      if (shipment.current_node !== 'Loaded') {
        await this.writeStateTransition({
          stationId: flight.station_id,
          objectType: 'Shipment',
          objectId: shipment.shipment_id,
          stateField: 'current_node',
          fromValue: shipment.current_node,
          toValue: 'Loaded',
          triggeredBy: actor.userId,
          auditId,
          reason: input.note
        });
      }
    }

    return {
      flight_id: flightId,
      runtime_status: 'Pre-Departure',
      audit_action: 'OUTBOUND_FLIGHT_LOADED'
    };
  }

  async finalizeOutboundManifest(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult> {
    const actor = this.ensureActor();
    const state = await loadOutboundFlightActionState(this.db, flightId);
    const flight = state.flight;

    this.assertActorStation(flight.station_id);

    if (flight.actual_takeoff_at || flight.runtime_status === 'Airborne') {
      throw new RepositoryOperationError(409, 'OUTBOUND_FLIGHT_ALREADY_DEPARTED', 'Outbound flight has already departed', {
        flight_id: flightId,
        runtime_status: flight.runtime_status,
        actual_takeoff_at: flight.actual_takeoff_at
      });
    }

    const loadingTask = state.tasks.find((task) => task.related_object_type === 'Flight' && task.task_type === '装机复核');
    if (!loadingTask || loadingTask.task_status !== 'Completed') {
      throw new RepositoryOperationError(409, 'OUTBOUND_FLIGHT_NOT_LOADED', 'Loaded confirmation must be completed before manifest finalize', {
        flight_id: flightId,
        task_id: loadingTask?.task_id ?? null,
        task_status: loadingTask?.task_status ?? null
      });
    }

    const flightDocuments: OutboundFlightActionDocumentRow[] = state.documents.filter(
      (document) => document.related_object_type === 'Flight'
    ) as OutboundFlightActionDocumentRow[];
    const manifestDocuments: OutboundFlightActionDocumentRow[] = state.documents.filter(
      (document) => document.document_type === 'Manifest'
    ) as OutboundFlightActionDocumentRow[];
    const requiredDocumentTypes = ['FFM', 'UWS'];
    const missingDocumentTypes = requiredDocumentTypes.filter(
      (documentType) =>
        !flightDocuments.some(
          (document) =>
            document.document_type === documentType &&
            ['Uploaded', 'Validated', 'Approved', 'Released'].includes(document.document_status)
        )
    );
    if (missingDocumentTypes.length) {
      throw new RepositoryOperationError(409, 'OUTBOUND_MANIFEST_DOCUMENTS_INCOMPLETE', 'Required flight documents must be ready before manifest finalize', {
        flight_id: flightId,
        missing_document_types: missingDocumentTypes
      });
    }

    if (!manifestDocuments.length) {
      throw new RepositoryOperationError(409, 'MANIFEST_DOCUMENT_MISSING', 'Manifest document must exist before finalize', {
        flight_id: flightId
      });
    }

    const finalizedManifest = manifestDocuments.find((document) => ['Released', 'Approved'].includes(document.document_status)) as
      | OutboundFlightActionDocumentRow
      | undefined;
    if (finalizedManifest) {
      throw new RepositoryOperationError(409, 'MANIFEST_ALREADY_FINALIZED', 'Manifest is already finalized', {
        flight_id: flightId,
        document_id: finalizedManifest.document_id,
        document_status: finalizedManifest.document_status
      });
    }

    const manifestDocument = (finalizedManifest || (manifestDocuments[0] as OutboundFlightActionDocumentRow | undefined)) ?? null;
    const manifestDocumentId = manifestDocument?.document_id ?? null;
    const manifestDocumentStatus = manifestDocument?.document_status ?? 'Uploaded';
    const now = isoNow();
    await this.db
      .prepare(
        `
          UPDATE documents
          SET document_status = CASE
              WHEN document_type = 'Manifest' THEN 'Released'
              WHEN document_status = 'Uploaded' THEN 'Validated'
              ELSE document_status
            END,
              updated_at = ?
          WHERE document_status != 'Replaced'
            AND (
              (related_object_type = 'Flight' AND related_object_id = ? AND document_type IN ('FFM', 'UWS', 'Manifest'))
              OR (related_object_type = 'Shipment' AND related_object_id IN (
                SELECT shipment_id FROM awbs WHERE flight_id = ?
              ) AND document_type = 'Manifest')
            )
        `
      )
      .bind(now, flightId, flightId)
      .run();

    await this.db
      .prepare(
        `
          UPDATE awbs
          SET manifest_status = 'Released',
              updated_at = ?
          WHERE flight_id = ?
        `
      )
      .bind(now, flightId)
      .run();

    const auditId = await this.writeAudit({
      action: 'OUTBOUND_MANIFEST_FINALIZED',
      objectType: 'Flight',
      objectId: flightId,
      stationId: flight.station_id,
      summary: `Manifest finalized for outbound flight ${flightId}`,
      payload: {
        note: input.note ?? null,
        document_id: input.document_id ?? null,
        manifest_document_id: manifestDocumentId
      }
    });

    await this.writeStateTransition({
      stationId: flight.station_id,
      objectType: 'Flight',
      objectId: flightId,
      stateField: 'manifest_status',
      fromValue: manifestDocumentStatus,
      toValue: 'Released',
      triggeredBy: actor.userId,
      auditId,
      reason: input.note
    });

    return {
      flight_id: flightId,
      runtime_status: (flight.runtime_status as OutboundFlightActionResult['runtime_status']) || 'Pre-Departure',
      manifest_status: 'Released',
      audit_action: 'OUTBOUND_MANIFEST_FINALIZED'
    };
  }

  async markOutboundAirborne(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult> {
    const actor = this.ensureActor();
    const state = await loadOutboundFlightActionState(this.db, flightId);
    const flight = state.flight;

    this.assertActorStation(flight.station_id);

    if (flight.actual_takeoff_at || flight.runtime_status === 'Airborne') {
      throw new RepositoryOperationError(409, 'OUTBOUND_FLIGHT_ALREADY_DEPARTED', 'Outbound flight has already departed', {
        flight_id: flightId,
        runtime_status: flight.runtime_status,
        actual_takeoff_at: flight.actual_takeoff_at
      });
    }

    const loadingTask = state.tasks.find((task) => task.related_object_type === 'Flight' && task.task_type === '装机复核');
    if (!loadingTask || loadingTask.task_status !== 'Completed') {
      throw new RepositoryOperationError(409, 'OUTBOUND_FLIGHT_NOT_LOADED', 'Loaded confirmation must be completed before airborne', {
        flight_id: flightId,
        task_id: loadingTask?.task_id ?? null,
        task_status: loadingTask?.task_status ?? null
      });
    }

    const manifestBlocker = state.documents.find(
      (document) =>
        document.document_status !== 'Replaced' &&
        ((document.related_object_type === 'Flight' &&
          document.related_object_id === flightId &&
          ['FFM', 'UWS', 'Manifest'].includes(document.document_type) &&
          !['Released', 'Approved', 'Validated'].includes(document.document_status)) ||
          (document.related_object_type === 'Shipment' &&
            document.document_type === 'Manifest' &&
            !['Released', 'Approved', 'Validated'].includes(document.document_status)))
    );

    if (manifestBlocker?.document_id) {
      throw new RepositoryOperationError(409, 'MANIFEST_NOT_FINALIZED', 'Manifest must be finalized before airborne', {
        flight_id: flightId,
        blocker_document_id: manifestBlocker.document_id,
        blocker_document_type: manifestBlocker.document_type,
        blocker_document_status: manifestBlocker.document_status
      });
    }

    const finalizedManifestDocument =
      (state.documents.find((document) => document.related_object_type === 'Flight' && document.document_type === 'Manifest') as
        | OutboundFlightActionDocumentRow
        | undefined) ||
      (state.documents.find((document) => document.document_type === 'Manifest') as OutboundFlightActionDocumentRow | undefined);
    const now = isoNow();
    await this.db
      .prepare(
        `
          UPDATE flights
          SET runtime_status = 'Airborne',
              actual_takeoff_at = COALESCE(actual_takeoff_at, ?),
              updated_at = ?
          WHERE flight_id = ?
        `
      )
      .bind(now, now, flightId)
      .run();

    await this.db
      .prepare(
        `
          UPDATE awbs
          SET current_node = 'Airborne',
              updated_at = ?
          WHERE flight_id = ?
        `
      )
      .bind(now, flightId)
      .run();

    await this.db
      .prepare(
        `
          UPDATE shipments
          SET current_node = 'Airborne',
              updated_at = ?
          WHERE shipment_id IN (
            SELECT DISTINCT shipment_id
            FROM awbs
            WHERE flight_id = ?
          )
        `
      )
      .bind(now, flightId)
      .run();

    await this.db
      .prepare(
        `
          UPDATE tasks
          SET task_status = CASE
              WHEN task_type IN ('装机复核', '飞走归档') AND task_status NOT IN ('Verified', 'Closed') THEN 'Verified'
              ELSE task_status
            END,
              verified_at = CASE
                WHEN task_type IN ('装机复核', '飞走归档') THEN ?
                ELSE verified_at
              END,
              updated_at = ?
          WHERE related_object_type = 'Flight'
            AND related_object_id = ?
        `
      )
      .bind(now, now, flightId)
      .run();

    const auditId = await this.writeAudit({
      action: 'OUTBOUND_FLIGHT_AIRBORNE',
      objectType: 'Flight',
      objectId: flightId,
      stationId: flight.station_id,
      summary: `Outbound flight ${flightId} marked airborne`,
      payload: {
        note: input.note ?? null,
        document_id: input.document_id ?? null,
        awb_count: state.awbs.length,
        shipment_count: state.shipments.length,
        manifest_document_id: finalizedManifestDocument?.document_id ?? null
      }
    });

    await this.writeStateTransition({
      stationId: flight.station_id,
      objectType: 'Flight',
      objectId: flightId,
      stateField: 'runtime_status',
      fromValue: flight.runtime_status,
      toValue: 'Airborne',
      triggeredBy: actor.userId,
      auditId,
      reason: input.note
    });

    for (const shipment of state.shipments) {
      if (shipment.current_node !== 'Airborne') {
        await this.writeStateTransition({
          stationId: flight.station_id,
          objectType: 'Shipment',
          objectId: shipment.shipment_id,
          stateField: 'current_node',
          fromValue: shipment.current_node,
          toValue: 'Airborne',
          triggeredBy: actor.userId,
          auditId,
          reason: input.note
        });
      }
    }

    return {
      flight_id: flightId,
      runtime_status: 'Airborne',
      manifest_status: 'Released',
      audit_action: 'OUTBOUND_FLIGHT_AIRBORNE'
    };
  }
}

class D1WaybillRepository extends BaseD1Repository implements WaybillRepository {
  async listInboundWaybills(query: Record<string, string | undefined>): Promise<ListResponse<InboundWaybillListItem>> {
    const { page, pageSize, offset } = parsePagination(query.page, query.page_size);
    const { params, whereClause } = buildInboundWaybillWhereClause(query);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM awbs a
      JOIN shipments s ON s.shipment_id = a.shipment_id
      JOIN flights f ON f.flight_id = a.flight_id
      WHERE ${whereClause}
    `;

    const listSql = `
      SELECT
        a.awb_id,
        a.awb_no,
        a.shipment_id,
        a.flight_id,
        f.flight_no,
        COALESCE(a.consignee_name, '') AS consignee_name,
        a.pieces,
        a.gross_weight,
        a.current_node,
        a.noa_status,
        a.pod_status,
        a.transfer_status,
        (
          SELECT COUNT(*)
          FROM exceptions ex
          WHERE ex.exception_status NOT IN ('Resolved', 'Closed')
            AND (
              (ex.related_object_type = 'AWB' AND ex.related_object_id = a.awb_id)
              OR (ex.related_object_type = 'Shipment' AND ex.related_object_id = a.shipment_id)
              OR (ex.related_object_type = 'Flight' AND ex.related_object_id = a.flight_id)
            )
        ) AS blocker_count,
        (
          SELECT ex.root_cause
          FROM exceptions ex
          WHERE ex.exception_status NOT IN ('Resolved', 'Closed')
            AND (
              (ex.related_object_type = 'AWB' AND ex.related_object_id = a.awb_id)
              OR (ex.related_object_type = 'Shipment' AND ex.related_object_id = a.shipment_id)
              OR (ex.related_object_type = 'Flight' AND ex.related_object_id = a.flight_id)
            )
          ORDER BY ex.opened_at DESC
          LIMIT 1
        ) AS blocker_reason
      FROM awbs a
      JOIN shipments s ON s.shipment_id = a.shipment_id
      JOIN flights f ON f.flight_id = a.flight_id
      WHERE ${whereClause}
      ORDER BY f.flight_date DESC, f.flight_no ASC, a.awb_no ASC
      LIMIT ? OFFSET ?
    `;

    const [countRow, listRows] = await Promise.all([
      this.db.prepare(countSql).bind(...params).first<{ total: number | string }>(),
      this.db.prepare(listSql).bind(...params, pageSize, offset).all<WaybillListRow>()
    ]);

    return {
      items: listRows.results.map((row) => ({
        awb_id: row.awb_id,
        awb_no: row.awb_no,
        shipment_id: row.shipment_id,
        flight_id: row.flight_id,
        flight_no: row.flight_no,
        consignee_name: row.consignee_name,
        pieces: Number(row.pieces ?? 0),
        gross_weight: Number(row.gross_weight ?? 0),
        current_node: row.current_node,
        noa_status: row.noa_status,
        pod_status: row.pod_status,
        transfer_status: row.transfer_status,
        blocked: Number(row.blocker_count ?? 0) > 0,
        blocker_reason: row.blocker_reason ?? undefined
      })),
      page,
      page_size: pageSize,
      total: Number(countRow?.total ?? 0)
    };
  }

  async getInboundWaybill(awbId: string): Promise<InboundWaybillDetail | null> {
    const waybillSql = `
      SELECT
        a.awb_id,
        a.awb_no,
        a.shipment_id,
        a.flight_id,
        f.flight_no,
        a.station_id,
        COALESCE(a.consignee_name, '') AS consignee_name,
        a.pieces,
        a.gross_weight,
        a.current_node,
        a.noa_status,
        a.pod_status,
        a.transfer_status,
        s.fulfillment_status,
        s.service_level AS shipment_service_level,
        s.current_node AS shipment_current_node
      FROM awbs a
      JOIN shipments s ON s.shipment_id = a.shipment_id
      LEFT JOIN flights f ON f.flight_id = a.flight_id
      WHERE a.awb_id = ?
      LIMIT 1
    `;

    const awb = await this.db.prepare(waybillSql).bind(awbId).first<WaybillDetailRow>();

    if (!awb) {
      return null;
    }

    const [documents, tasks, exceptions] = await Promise.all([
      this.db
        .prepare(
          `
            SELECT document_id, document_type, document_status, required_for_release
            FROM documents
            WHERE document_status != 'Replaced'
              AND (
                (related_object_type = 'AWB' AND related_object_id = ?)
                OR (related_object_type = 'Shipment' AND related_object_id = ?)
                OR (related_object_type = 'Flight' AND related_object_id = ?)
              )
            ORDER BY uploaded_at DESC, document_id DESC
          `
        )
        .bind(awb.awb_id, awb.shipment_id, awb.flight_id)
        .all<DocumentSummaryRow>(),
      this.db
        .prepare(
          `
            SELECT task_id, task_type, task_status, blocker_code
            FROM tasks
            WHERE
              (related_object_type = 'AWB' AND related_object_id = ?)
              OR (related_object_type = 'Shipment' AND related_object_id = ?)
              OR (related_object_type = 'Flight' AND related_object_id = ?)
            ORDER BY due_at ASC, task_id ASC
          `
        )
        .bind(awb.awb_id, awb.shipment_id, awb.flight_id)
        .all<{ task_id: string; task_type: string; task_status: TaskStatus; blocker_code: string | null }>(),
      this.db
        .prepare(
          `
            SELECT exception_id, exception_type, exception_status, severity, blocker_flag
            FROM exceptions
            WHERE
              (related_object_type = 'AWB' AND related_object_id = ?)
              OR (related_object_type = 'Shipment' AND related_object_id = ?)
              OR (related_object_type = 'Flight' AND related_object_id = ?)
            ORDER BY opened_at DESC, exception_id DESC
          `
        )
        .bind(awb.awb_id, awb.shipment_id, awb.flight_id)
        .all<ExceptionSummaryRow>()
    ]);

    return {
      awb: {
        awb_id: awb.awb_id,
        awb_no: awb.awb_no,
        shipment_id: awb.shipment_id,
        flight_id: awb.flight_id,
        flight_no: awb.flight_no,
        station_id: awb.station_id,
        consignee_name: awb.consignee_name,
        pieces: Number(awb.pieces ?? 0),
        gross_weight: Number(awb.gross_weight ?? 0),
        current_node: awb.current_node,
        noa_status: awb.noa_status,
        pod_status: awb.pod_status,
        transfer_status: awb.transfer_status
      },
      shipment: {
        shipment_id: awb.shipment_id,
        fulfillment_status: awb.fulfillment_status,
        service_level: awb.shipment_service_level,
        current_node: awb.shipment_current_node
      },
      documents: documents.results.map((row) => ({
        document_id: row.document_id,
        document_type: row.document_type,
        document_status: row.document_status,
        required_for_release: booleanFromRow(row.required_for_release)
      })),
      tasks: tasks.results.map((row) => ({
        task_id: row.task_id,
        task_type: row.task_type,
        task_status: row.task_status,
        blocker_code: row.blocker_code ?? undefined
      })),
      exceptions: exceptions.results.map((row) => ({
        exception_id: row.exception_id,
        exception_type: row.exception_type,
        exception_status: row.exception_status,
        severity: row.severity,
        blocker_flag: booleanFromRow(row.blocker_flag)
      }))
    };
  }

  async listOutboundWaybills(query: Record<string, string | undefined>): Promise<ListResponse<OutboundWaybillListItem>> {
    const { page, pageSize, offset } = parsePagination(query.page, query.page_size);
    const { params, whereClause } = buildOutboundWaybillWhereClause(query);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM awbs a
      JOIN flights f ON f.flight_id = a.flight_id
      WHERE ${whereClause}
    `;

    const listSql = `
      SELECT
        a.awb_id,
        a.awb_no,
        a.shipment_id,
        a.flight_id,
        a.station_id,
        f.flight_no,
        COALESCE(a.notify_name, a.consignee_name, f.destination_code) AS destination_code,
        a.pieces,
        a.gross_weight,
        COALESCE(ffm.document_status, 'Missing') AS ffm_status,
        COALESCE(mawb.document_status, 'Missing') AS mawb_status,
        COALESCE(manifest.document_status, 'Missing') AS manifest_doc_status,
        receipt.task_status AS receipt_task_status,
        loading.task_status AS loading_task_status,
        f.runtime_status
      FROM awbs a
      JOIN flights f ON f.flight_id = a.flight_id
      LEFT JOIN documents ffm ON ffm.related_object_type = 'Flight' AND ffm.related_object_id = a.flight_id AND ffm.document_type = 'FFM'
      LEFT JOIN documents mawb ON mawb.related_object_type = 'AWB' AND mawb.related_object_id = a.awb_id AND mawb.document_type = 'MAWB'
      LEFT JOIN documents manifest ON manifest.related_object_type = 'Shipment' AND manifest.related_object_id = a.shipment_id AND manifest.document_type = 'Manifest'
      LEFT JOIN tasks receipt ON receipt.related_object_type = 'AWB' AND receipt.related_object_id = a.awb_id AND receipt.task_type = '出港收货'
      LEFT JOIN tasks loading ON loading.related_object_type = 'Flight' AND loading.related_object_id = a.flight_id AND loading.task_type = '装机复核'
      WHERE ${whereClause}
      ORDER BY f.flight_date DESC, f.flight_no ASC, a.awb_no ASC
      LIMIT ? OFFSET ?
    `;

    const [countRow, listRows] = await Promise.all([
      this.db.prepare(countSql).bind(...params).first<{ total: number | string }>(),
      this.db.prepare(listSql).bind(...params, pageSize, offset).all<OutboundWaybillRow & {
        ffm_status: string | null;
        mawb_status: string | null;
        manifest_doc_status: string | null;
        receipt_task_status: string | null;
        loading_task_status: string | null;
        runtime_status: string | null;
      }>()
    ]);

    return {
      items: listRows.results.map((row) => {
        const statuses = deriveOutboundStatuses(row);
        return {
          awb_id: row.awb_id,
          awb_no: row.awb_no,
          shipment_id: row.shipment_id,
          flight_id: row.flight_id,
          flight_no: row.flight_no,
          destination_code: row.destination_code,
          pieces: Number(row.pieces ?? 0),
          gross_weight: Number(row.gross_weight ?? 0),
          ...statuses
        };
      }),
      page,
      page_size: pageSize,
      total: Number(countRow?.total ?? 0)
    };
  }

  async getOutboundWaybill(awbId: string): Promise<OutboundWaybillDetail | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            a.awb_id,
            a.awb_no,
            a.shipment_id,
            a.flight_id,
            a.station_id,
            f.flight_no,
            COALESCE(a.notify_name, a.consignee_name, f.destination_code) AS destination_code,
            a.pieces,
            a.gross_weight,
            COALESCE(ffm.document_status, 'Missing') AS ffm_status,
            COALESCE(mawb.document_status, 'Missing') AS mawb_status,
            COALESCE(manifest.document_status, 'Missing') AS manifest_doc_status,
            receipt.task_status AS receipt_task_status,
            loading.task_status AS loading_task_status,
            f.runtime_status
          FROM awbs a
          JOIN flights f ON f.flight_id = a.flight_id
          LEFT JOIN documents ffm ON ffm.related_object_type = 'Flight' AND ffm.related_object_id = a.flight_id AND ffm.document_type = 'FFM'
          LEFT JOIN documents mawb ON mawb.related_object_type = 'AWB' AND mawb.related_object_id = a.awb_id AND mawb.document_type = 'MAWB'
          LEFT JOIN documents manifest ON manifest.related_object_type = 'Shipment' AND manifest.related_object_id = a.shipment_id AND manifest.document_type = 'Manifest'
          LEFT JOIN tasks receipt ON receipt.related_object_type = 'AWB' AND receipt.related_object_id = a.awb_id AND receipt.task_type = '出港收货'
          LEFT JOIN tasks loading ON loading.related_object_type = 'Flight' AND loading.related_object_id = a.flight_id AND loading.task_type = '装机复核'
          WHERE a.awb_id = ?
          LIMIT 1
        `
      )
      .bind(awbId)
      .first<OutboundWaybillRow & {
        ffm_status: string | null;
        mawb_status: string | null;
        manifest_doc_status: string | null;
        receipt_task_status: string | null;
        loading_task_status: string | null;
        runtime_status: string | null;
      }>();

    if (!row) {
      return null;
    }

    const [documents, tasks, exceptions] = await Promise.all([
      this.db
        .prepare(
          `
            SELECT document_id, document_type, document_status, required_for_release
            FROM documents
            WHERE document_status != 'Replaced'
              AND (
                (related_object_type = 'AWB' AND related_object_id = ?)
                OR (related_object_type = 'Shipment' AND related_object_id = ?)
                OR (related_object_type = 'Flight' AND related_object_id = ?)
              )
            ORDER BY uploaded_at DESC, document_id DESC
          `
        )
        .bind(row.awb_id, row.shipment_id, row.flight_id)
        .all<DocumentSummaryRow>(),
      this.db
        .prepare(
          `
            SELECT task_id, task_type, task_status, blocker_code
            FROM tasks
            WHERE
              (related_object_type = 'AWB' AND related_object_id = ?)
              OR (related_object_type = 'Shipment' AND related_object_id = ?)
              OR (related_object_type = 'Flight' AND related_object_id = ?)
            ORDER BY due_at ASC, task_id ASC
          `
        )
        .bind(row.awb_id, row.shipment_id, row.flight_id)
        .all<{ task_id: string; task_type: string; task_status: TaskStatus; blocker_code: string | null }>(),
      this.db
        .prepare(
          `
            SELECT exception_id, exception_type, exception_status, severity, blocker_flag
            FROM exceptions
            WHERE
              (related_object_type = 'AWB' AND related_object_id = ?)
              OR (related_object_type = 'Shipment' AND related_object_id = ?)
              OR (related_object_type = 'Flight' AND related_object_id = ?)
            ORDER BY opened_at DESC, exception_id DESC
          `
        )
        .bind(row.awb_id, row.shipment_id, row.flight_id)
        .all<ExceptionSummaryRow>()
    ]);

    const statuses = deriveOutboundStatuses(row);

    return {
      awb: {
        awb_id: row.awb_id,
        awb_no: row.awb_no,
        shipment_id: row.shipment_id,
        flight_id: row.flight_id,
        flight_no: row.flight_no,
        station_id: row.station_id,
        destination_code: row.destination_code,
        pieces: Number(row.pieces ?? 0),
        gross_weight: Number(row.gross_weight ?? 0),
        ...statuses
      },
      documents: documents.results.map((item) => ({
        document_id: item.document_id,
        document_type: item.document_type,
        document_status: item.document_status,
        required_for_release: booleanFromRow(item.required_for_release)
      })),
      tasks: tasks.results.map((item) => ({
        task_id: item.task_id,
        task_type: item.task_type,
        task_status: item.task_status,
        blocker_code: item.blocker_code ?? undefined
      })),
      exceptions: exceptions.results.map((item) => ({
        exception_id: item.exception_id,
        exception_type: item.exception_type,
        exception_status: item.exception_status,
        severity: item.severity,
        blocker_flag: booleanFromRow(item.blocker_flag)
      }))
    };
  }

  async processInboundNoa(awbId: string, input: NoaActionInput): Promise<NoaActionResult> {
    const actor = this.ensureActor();
    const awb = await this.loadWaybillForAction(awbId);
    this.assertActorStation(awb.station_id);

    const blockerCount = await this.countOpenBlockers(awb);
    const validationPassed = blockerCount === 0;

    if (input.action === 'validate') {
      return {
        awb_id: awb.awb_id,
        awb_no: awb.awb_no,
        noa_status: awb.noa_status,
        validation_passed: validationPassed,
        message: validationPassed ? 'NOA validation passed' : 'NOA gate is still blocked'
      };
    }

    if (!validationPassed) {
      throw new RepositoryOperationError(409, 'NOA_GATE_BLOCKED', 'NOA cannot be sent while blockers are open', {
        awb_id: awb.awb_id,
        awb_no: awb.awb_no
      });
    }

    const nextStatus: NoaActionResult['noa_status'] = 'Sent';
    const auditId = await this.writeAudit({
      action: 'AWB_NOA_SENT',
      objectType: 'AWB',
      objectId: awb.awb_id,
      stationId: awb.station_id,
      summary: `NOA sent for ${awb.awb_no}`,
      payload: {
        action: input.action,
        channel: input.channel ?? 'manual',
        note: input.note ?? null
      }
    });

    if (awb.noa_status !== nextStatus) {
      await this.db
        .prepare(
          `
            UPDATE awbs
            SET noa_status = ?,
                updated_at = ?
            WHERE awb_id = ?
          `
        )
        .bind(nextStatus, isoNow(), awb.awb_id)
        .run();

      await this.writeStateTransition({
        stationId: awb.station_id,
        objectType: 'AWB',
        objectId: awb.awb_id,
        stateField: 'noa_status',
        fromValue: awb.noa_status,
        toValue: nextStatus,
        triggeredBy: actor.userId,
        auditId,
        reason: input.note
      });
    }

    return {
      awb_id: awb.awb_id,
      awb_no: awb.awb_no,
      noa_status: nextStatus,
      validation_passed: true,
      message: input.action === 'retry' ? 'NOA retried successfully' : 'NOA sent successfully',
      audit_action: 'AWB_NOA_SENT'
    };
  }

  async processInboundPod(awbId: string, input: PodActionInput): Promise<PodActionResult> {
    const actor = this.ensureActor();
    const awb = await this.loadWaybillForAction(awbId);
    this.assertActorStation(awb.station_id);

    const latestPod = await this.db
      .prepare(
        `
          SELECT document_id, document_status, document_name, storage_key
          FROM documents
          WHERE related_object_type = 'AWB'
            AND related_object_id = ?
            AND document_type = 'POD'
          ORDER BY uploaded_at DESC, document_id DESC
          LIMIT 1
        `
      )
      .bind(awb.awb_id)
      .first<{ document_id: string; document_status: string; document_name: string | null; storage_key: string | null }>();

    const hasReleasedPod = awb.pod_status === 'Released' || latestPod?.document_status === 'Released';

    if (input.action === 'validate_close') {
      return {
        awb_id: awb.awb_id,
        awb_no: awb.awb_no,
        pod_status: awb.pod_status,
        validation_passed: hasReleasedPod,
        message: hasReleasedPod ? 'POD closure validation passed' : 'POD double-sign is still required'
      };
    }

    let documentId = latestPod?.document_id;

    if (!documentId) {
      documentId = createId('DOC-POD');
      await this.db
        .prepare(
          `
            INSERT INTO documents (
              document_id,
              station_id,
              document_type,
              document_name,
              related_object_type,
              related_object_id,
              version_no,
              document_status,
              required_for_release,
              storage_key,
              uploaded_by,
              uploaded_at,
              created_at,
              updated_at,
              note
            ) VALUES (?, ?, 'POD', ?, 'AWB', ?, 'v1', 'Released', 1, ?, ?, ?, ?, ?, ?)
          `
        )
        .bind(
          documentId,
          awb.station_id,
          input.document_name ?? `${awb.awb_no}-POD.pdf`,
          awb.awb_id,
          input.storage_key ?? `station/${awb.station_id}/pod/${awb.awb_no}-${Date.now()}.pdf`,
          actor.userId,
          isoNow(),
          isoNow(),
          isoNow(),
          input.note ?? null
        )
        .run();
    } else {
      await this.db
        .prepare(
          `
            UPDATE documents
            SET document_status = 'Released',
                updated_at = ?,
                note = COALESCE(?, note)
            WHERE document_id = ?
          `
        )
        .bind(isoNow(), input.note ?? null, documentId)
        .run();
    }

    const auditId = await this.writeAudit({
      action: 'AWB_POD_RELEASED',
      objectType: 'AWB',
      objectId: awb.awb_id,
      stationId: awb.station_id,
      summary: `POD released for ${awb.awb_no}`,
      payload: {
        action: input.action,
        signer: input.signer ?? null,
        document_id: documentId
      }
    });

    if (awb.pod_status !== 'Released') {
      await this.db
        .prepare(
          `
            UPDATE awbs
            SET pod_status = 'Released',
                updated_at = ?
            WHERE awb_id = ?
          `
        )
        .bind(isoNow(), awb.awb_id)
        .run();

      await this.writeStateTransition({
        stationId: awb.station_id,
        objectType: 'AWB',
        objectId: awb.awb_id,
        stateField: 'pod_status',
        fromValue: awb.pod_status,
        toValue: 'Released',
        triggeredBy: actor.userId,
        auditId,
        reason: input.note
      });
    }

    return {
      awb_id: awb.awb_id,
      awb_no: awb.awb_no,
      pod_status: 'Released',
      validation_passed: true,
      message: input.action === 'archive' ? 'POD archived successfully' : 'POD sign-off confirmed',
      document_id: documentId,
      audit_action: 'AWB_POD_RELEASED'
    };
  }

  private async loadWaybillForAction(awbId: string) {
    const awb = await this.db
      .prepare(
        `
          SELECT awb_id, awb_no, shipment_id, flight_id, station_id, noa_status, pod_status
          FROM awbs
          WHERE awb_id = ?
          LIMIT 1
        `
      )
      .bind(awbId)
      .first<{
        awb_id: string;
        awb_no: string;
        shipment_id: string;
        flight_id: string;
        station_id: string;
        noa_status: NoaActionResult['noa_status'];
        pod_status: PodActionResult['pod_status'];
      }>();

    if (!awb) {
      throw new RepositoryOperationError(404, 'AWB_NOT_FOUND', 'Inbound waybill does not exist', {
        awb_id: awbId
      });
    }

    return awb;
  }

  private async countOpenBlockers(awb: { awb_id: string; shipment_id: string; flight_id: string | null }) {
    const row = await this.db
      .prepare(
        `
          SELECT COUNT(*) AS total
          FROM exceptions
          WHERE exception_status NOT IN ('Resolved', 'Closed')
            AND (
              (related_object_type = 'AWB' AND related_object_id = ?)
              OR (related_object_type = 'Shipment' AND related_object_id = ?)
              OR (related_object_type = 'Flight' AND related_object_id = ?)
            )
        `
      )
      .bind(awb.awb_id, awb.shipment_id, awb.flight_id)
      .first<{ total: number | string }>();

    return Number(row?.total ?? 0);
  }
}

class D1ShipmentRepository extends BaseD1Repository implements ShipmentRepository {
  async listStationShipments(
    query: Record<string, string | undefined>
  ): Promise<ListResponse<StationShipmentListItem>> {
    const { page, pageSize, offset } = parsePagination(query.page, query.page_size);
    const { params, whereClause } = buildStationShipmentWhereClause(query);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM shipments s
      JOIN awbs a ON a.shipment_id = s.shipment_id
      LEFT JOIN flights f ON f.flight_id = a.flight_id
      WHERE ${whereClause}
    `;

    const listSql = `
      SELECT
        s.shipment_id,
        s.shipment_type,
        s.current_node,
        s.fulfillment_status,
        s.service_level,
        s.total_pieces,
        s.total_weight,
        a.awb_id,
        a.awb_no,
        a.flight_id,
        COALESCE(a.consignee_name, '') AS consignee_name,
        f.flight_no,
        s.station_id,
        f.origin_code,
        f.destination_code,
        f.runtime_status,
        (
          SELECT t.task_status
          FROM tasks t
          WHERE
            (t.related_object_type = 'Shipment' AND t.related_object_id = s.shipment_id)
            OR (t.related_object_type = 'AWB' AND t.related_object_id = a.awb_id)
            OR (t.related_object_type = 'Flight' AND t.related_object_id = a.flight_id)
          ORDER BY
            CASE WHEN t.task_status IN ('Completed', 'Verified', 'Closed') THEN 2 ELSE 1 END,
            COALESCE(t.due_at, '9999-12-31T23:59:59Z') ASC,
            t.task_id ASC
          LIMIT 1
        ) AS task_status,
        (
          SELECT d.document_status
          FROM documents d
          WHERE d.document_status != 'Replaced'
            AND (
              (d.related_object_type = 'Shipment' AND d.related_object_id = s.shipment_id)
              OR (d.related_object_type = 'AWB' AND d.related_object_id = a.awb_id)
              OR (d.related_object_type = 'Flight' AND d.related_object_id = a.flight_id)
            )
          ORDER BY d.required_for_release DESC, d.uploaded_at DESC, d.document_id DESC
          LIMIT 1
        ) AS document_status,
        (
          SELECT ex.root_cause
          FROM exceptions ex
          WHERE ex.exception_status NOT IN ('Resolved', 'Closed')
            AND (
              (ex.related_object_type = 'Shipment' AND ex.related_object_id = s.shipment_id)
              OR (ex.related_object_type = 'AWB' AND ex.related_object_id = a.awb_id)
              OR (ex.related_object_type = 'Flight' AND ex.related_object_id = a.flight_id)
            )
          ORDER BY ex.opened_at DESC, ex.exception_id DESC
          LIMIT 1
        ) AS blocker_reason
      FROM shipments s
      JOIN awbs a ON a.shipment_id = s.shipment_id
      LEFT JOIN flights f ON f.flight_id = a.flight_id
      WHERE ${whereClause}
      ORDER BY COALESCE(f.flight_date, '9999-12-31') DESC, COALESCE(f.flight_no, '') ASC, a.awb_no ASC
      LIMIT ? OFFSET ?
    `;

    const [countRow, listRows] = await Promise.all([
      this.db.prepare(countSql).bind(...params).first<{ total: number | string }>(),
      this.db.prepare(listSql).bind(...params, pageSize, offset).all<StationShipmentRow>()
    ]);

    return {
      items: listRows.results.map((row) => ({
        id: getShipmentSlug(row.shipment_type, row.awb_no),
        awb: row.awb_no,
        direction: mapShipmentDirection(row.shipment_type),
        flight_no: row.flight_no ?? '--',
        route: inferShipmentRoute(row),
        primary_status: inferOutboundShipmentPrimaryStatus(row),
        task_status: inferShipmentTaskStatus(row),
        document_status: inferShipmentDocumentStatus(row),
        blocker: inferShipmentBlocker(row),
        consignee: row.consignee_name,
        pieces: String(Number(row.total_pieces ?? 0)),
        weight: `${Number(row.total_weight ?? 0)} kg`,
        priority: row.service_level ?? 'P2'
      })),
      page,
      page_size: pageSize,
      total: Number(countRow?.total ?? 0)
    };
  }

  async getStationShipment(shipmentId: string): Promise<StationShipmentDetail | null> {
    const parsed = parseShipmentSlug(shipmentId);
    const params: unknown[] = [parsed.awbNo];
    let shipmentTypeClause = '';

    if (parsed.shipmentType === 'outbound') {
      shipmentTypeClause = ` AND COALESCE(s.shipment_type, 'import') = 'export'`;
    } else if (parsed.shipmentType === 'inbound') {
      shipmentTypeClause = ` AND COALESCE(s.shipment_type, 'import') != 'export'`;
    }

    const shipmentSql = `
      SELECT
        s.shipment_id,
        s.station_id,
        s.shipment_type,
        s.current_node,
        s.fulfillment_status,
        s.service_level,
        a.awb_id,
        a.awb_no,
        a.flight_id,
        COALESCE(a.consignee_name, '') AS consignee_name,
        COALESCE(a.pieces, s.total_pieces) AS total_pieces,
        COALESCE(a.gross_weight, s.total_weight) AS total_weight,
        f.flight_no,
        f.origin_code,
        f.destination_code,
        f.runtime_status
      FROM shipments s
      JOIN awbs a ON a.shipment_id = s.shipment_id
      LEFT JOIN flights f ON f.flight_id = a.flight_id
      WHERE a.awb_no = ?${shipmentTypeClause}
      LIMIT 1
    `;

    const shipment = await this.db.prepare(shipmentSql).bind(...params).first<StationShipmentRow>();

    if (!shipment) {
      return null;
    }

    this.assertActorStation(shipment.station_id);

    const [documents, tasks, exceptions] = await Promise.all([
      this.db
        .prepare(
          `
            SELECT document_id, document_type, document_name, document_status, required_for_release
            FROM documents
            WHERE document_status != 'Replaced'
              AND (
                (related_object_type = 'Shipment' AND related_object_id = ?)
                OR (related_object_type = 'AWB' AND related_object_id = ?)
                OR (related_object_type = 'Flight' AND related_object_id = ?)
              )
            ORDER BY uploaded_at DESC, document_id DESC
          `
        )
        .bind(shipment.shipment_id, shipment.awb_id, shipment.flight_id)
        .all<ShipmentDocumentRow>(),
      this.db
        .prepare(
          `
            SELECT
              t.task_id,
              t.task_type,
              t.task_status,
              t.due_at,
              t.evidence_required,
              t.blocker_code,
              tm.team_name AS assigned_team_name,
              w.worker_name AS assigned_worker_name,
              t.assigned_role
            FROM tasks t
            LEFT JOIN teams tm ON t.assigned_team_id = tm.team_id
            LEFT JOIN workers w ON t.assigned_worker_id = w.worker_id
            WHERE
              (t.related_object_type = 'Shipment' AND t.related_object_id = ?)
              OR (t.related_object_type = 'AWB' AND t.related_object_id = ?)
              OR (t.related_object_type = 'Flight' AND t.related_object_id = ?)
            ORDER BY COALESCE(t.due_at, '9999-12-31T23:59:59Z') ASC, t.task_id ASC
          `
        )
        .bind(shipment.shipment_id, shipment.awb_id, shipment.flight_id)
        .all<ShipmentTaskRow>(),
      this.db
        .prepare(
          `
            SELECT exception_id, exception_type, exception_status, root_cause
            FROM exceptions
            WHERE
              (related_object_type = 'Shipment' AND related_object_id = ?)
              OR (related_object_type = 'AWB' AND related_object_id = ?)
              OR (related_object_type = 'Flight' AND related_object_id = ?)
            ORDER BY opened_at DESC, exception_id DESC
          `
        )
        .bind(shipment.shipment_id, shipment.awb_id, shipment.flight_id)
        .all<{ exception_id: string; exception_type: string; exception_status: string; root_cause: string | null }>()
    ]);

    const direction = mapShipmentDirection(shipment.shipment_type);
    const route =
      shipment.shipment_type === 'export'
        ? `${shipment.origin_code ?? shipment.station_id} -> ${shipment.destination_code ?? '--'}`
        : `${shipment.origin_code ?? '--'} -> ${shipment.station_id} -> Delivery`;
    const outboundLoadingTask = tasks.results.find(
      (row) => row.task_type === '装机复核' || row.task_type === '飞走归档'
    );
    const outboundManifestDocument = documents.results.find((row) => row.document_type === 'Manifest');
    const outboundViewState = {
      shipment_type: shipment.shipment_type,
      runtime_status: shipment.runtime_status ?? null,
      task_status: outboundLoadingTask?.task_status ?? null,
      document_status: outboundManifestDocument?.document_status ?? null,
      current_node: shipment.current_node,
      fulfillment_status: shipment.fulfillment_status
    };

    return {
      id: getShipmentSlug(shipment.shipment_type, shipment.awb_no),
      title: `${shipment.awb_no} / ${shipment.flight_no ?? shipment.station_id} ${direction === '出港' ? 'Export' : 'Inbound'}`,
      eyebrow: 'Shipment / Fulfillment Chain',
      summary: {
        direction,
        route,
        runtime_status: shipment.runtime_status ?? 'Scheduled',
        fulfillment_status: shipment.fulfillment_status,
        priority: shipment.service_level ?? 'P2',
        station: shipment.station_id
      },
      timeline:
        shipment.shipment_type === 'export'
          ? [
              { label: 'Forecast', note: '出港预报与收货准备。', status: '运行中' },
              { label: 'Receipt', note: '按主单完成收货与核对。', status: '运行中' },
              { label: 'Loaded', note: '待文件齐全和装机复核后放行。', status: inferOutboundShipmentTimelineStatus(outboundViewState) },
              { label: 'Airborne', note: '飞走归档后进入闭环。', status: shipment.runtime_status ?? 'Scheduled' }
            ]
          : [
              { label: 'Landed', note: '航班已落地并进入进港处理。', status: shipment.runtime_status ?? 'Landed' },
              { label: 'Inbound Handling', note: '拆板、理货与复核按票推进。', status: shipment.current_node },
              { label: 'Gate Check', note: '命中 Gate 时必须先清阻断。', status: inferShipmentTaskStatus(shipment) },
              { label: 'Delivered', note: 'POD 完成归档后允许 Closed。', status: inferShipmentDocumentStatus(shipment) }
            ],
      documents: documents.results.map((row) => ({
        document_id: row.document_id,
        type: row.document_type,
        name: row.document_name,
        status: row.document_status,
        linked_task: inferShipmentLinkedTask(row.document_type, shipment.shipment_type),
        note: inferShipmentDocumentNote(row.document_type, row.document_status),
        gate_ids: inferShipmentDocumentGateIds(row.document_type)
      })),
      tasks: tasks.results.map((row) => ({
        id: row.task_id,
        title: row.task_type,
        owner: row.assigned_team_name ?? row.assigned_worker_name ?? row.assigned_role ?? '--',
        status: row.task_status,
        due: row.due_at ? new Date(row.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--',
        evidence: booleanFromRow(row.evidence_required) ? '需要证据' : '无需补证据',
        jump_to: '/station/tasks',
        gate_ids: inferShipmentTaskGateIds(row.task_type, row.blocker_code)
      })),
      exceptions: exceptions.results.map((row) => ({
        id: row.exception_id,
        type: row.exception_type,
        status: row.exception_status,
        note: row.root_cause ?? '待补充异常说明',
        jump_to: `/station/exceptions/${row.exception_id}`,
        gate_id: inferGateId({ exception_type: row.exception_type, related_object_type: 'Shipment' })
      })),
      relationship_rows: [
        { source: `Shipment / ${shipment.shipment_id}`, relation: 'covers', target: `AWB / ${shipment.awb_no}`, note: 'Shipment 与主单一一关联。' },
        { source: `AWB / ${shipment.awb_no}`, relation: 'moves_on', target: `Flight / ${shipment.flight_no ?? '--'}`, note: route },
        { source: `Shipment / ${shipment.shipment_id}`, relation: 'requires', target: 'Document', note: '关键文件齐全后才能推进下游动作。' },
        { source: `Shipment / ${shipment.shipment_id}`, relation: 'executes', target: 'Task', note: '任务围绕 Shipment / AWB / Flight 三个对象分发。' },
        { source: `Shipment / ${shipment.shipment_id}`, relation: 'blocked_by', target: 'Exception', note: '存在异常时必须先解除阻断。' }
      ]
    };
  }
}

class D1DocumentRepository extends BaseD1Repository implements DocumentRepository {
  async listStationDocuments(query: Record<string, string | undefined>): Promise<ListResponse<StationDocumentListItem>> {
    const { page, pageSize, offset } = parsePagination(query.page, query.page_size);
    const { params, whereClause } = buildStationDocumentWhereClause(query);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM documents d
      WHERE ${whereClause}
    `;

    const listSql = `
      SELECT
        d.document_id,
        d.document_type,
        d.document_name,
        d.related_object_type,
        d.related_object_id,
        CASE
          WHEN d.related_object_type = 'Flight' THEN COALESCE(f.flight_no || ' / ' || d.station_id, d.related_object_id)
          WHEN d.related_object_type = 'AWB' THEN COALESCE(a.awb_no || ' / ' || d.station_id, d.related_object_id)
          WHEN d.related_object_type = 'Shipment' THEN COALESCE(s.shipment_id, d.related_object_id)
          WHEN d.related_object_type = 'Task' THEN COALESCE(t.task_type || ' / ' || d.related_object_id, d.related_object_id)
          WHEN d.related_object_type = 'Truck' THEN COALESCE(tr.plate_no || ' / ' || d.related_object_id, d.related_object_id)
          ELSE d.related_object_id
        END AS related_object_label,
        d.version_no,
        d.document_status,
        d.required_for_release,
        d.content_type,
        d.size_bytes,
        d.checksum_sha256,
        d.retention_class,
        d.deleted_at,
        d.uploaded_at
      FROM documents d
      LEFT JOIN flights f ON d.related_object_type = 'Flight' AND d.related_object_id = f.flight_id
      LEFT JOIN awbs a ON d.related_object_type = 'AWB' AND d.related_object_id = a.awb_id
      LEFT JOIN shipments s ON d.related_object_type = 'Shipment' AND d.related_object_id = s.shipment_id
      LEFT JOIN tasks t ON d.related_object_type = 'Task' AND d.related_object_id = t.task_id
      LEFT JOIN trucks tr ON d.related_object_type = 'Truck' AND d.related_object_id = tr.truck_id
      WHERE ${whereClause}
      ORDER BY d.uploaded_at DESC, d.document_id DESC
      LIMIT ? OFFSET ?
    `;

    const [countRow, listRows] = await Promise.all([
      this.db.prepare(countSql).bind(...params).first<{ total: number | string }>(),
      this.db.prepare(listSql).bind(...params, pageSize, offset).all<StationDocumentRow>()
    ]);

    return {
      items: listRows.results.map((row) => ({
        document_id: row.document_id,
        document_type: row.document_type,
        document_name: row.document_name,
        related_object_type: row.related_object_type,
        related_object_id: row.related_object_id,
        related_object_label: row.related_object_label ?? row.related_object_id,
        version_no: row.version_no,
        document_status: row.document_status,
        required_for_release: booleanFromRow(row.required_for_release),
        content_type: row.content_type ?? undefined,
        size_bytes: numberFromRow(row.size_bytes),
        checksum_sha256: row.checksum_sha256 ?? undefined,
        retention_class: row.retention_class ?? undefined,
        deleted_at: row.deleted_at ?? undefined,
        preview_type: inferDocumentPreviewType(row.document_name, row.content_type),
        uploaded_at: row.uploaded_at ?? undefined
      })),
      page,
      page_size: pageSize,
      total: Number(countRow?.total ?? 0)
    };
  }

  async createUploadTicket(input: CreateUploadTicketInput): Promise<CreateUploadTicketResult> {
    const actor = this.ensureActor();
    const stationId = input.station_id ?? actor.stationScope[0];

    if (!stationId) {
      throw new RepositoryOperationError(400, 'VALIDATION_ERROR', 'station_id is required');
    }

    this.assertActorStation(stationId);

    const uploadId = createId('UPL');
    const uploadToken = crypto.randomUUID();
    const extension = input.document_name.includes('.') ? input.document_name.slice(input.document_name.lastIndexOf('.')) : '';
    const storageKey = `station/${stationId}/uploads/${input.related_object_type.toUpperCase()}/${uploadId}${extension}`;
    const now = isoNow();
    const expiresAt = isoAfterMinutes(15);

    await this.db
      .prepare(
        `
          INSERT INTO upload_tickets (
            upload_id,
            station_id,
            related_object_type,
            document_name,
            content_type,
            size_bytes,
            checksum_sha256,
            retention_class,
            storage_key,
            upload_token,
            expires_at,
            created_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        uploadId,
        stationId,
        input.related_object_type,
        input.document_name,
        input.content_type || 'application/octet-stream',
        input.size_bytes ?? null,
        input.checksum_sha256 ?? null,
        input.retention_class ?? 'operational',
        storageKey,
        uploadToken,
        expiresAt,
        actor.userId,
        now,
        now
      )
      .run();

    return {
      upload_id: uploadId,
      upload_url: `/api/v1/station/uploads/${uploadId}?token=${encodeURIComponent(uploadToken)}`,
      method: 'PUT',
      expires_at: expiresAt,
      storage_key: storageKey,
      content_type: input.content_type || 'application/octet-stream',
      document_name: input.document_name,
      retention_class: input.retention_class ?? 'operational',
      headers: {
        'Content-Type': input.content_type || 'application/octet-stream'
      }
    };
  }

  async getStationDocumentPreview(documentId: string): Promise<StationDocumentPreviewResult | null> {
    const row = await this.db
      .prepare(
        `
          SELECT document_id, station_id, document_name, content_type, size_bytes
          FROM documents
          WHERE document_id = ?
            AND deleted_at IS NULL
          LIMIT 1
        `
      )
      .bind(documentId)
      .first<DocumentLookupRow>();

    if (!row) {
      return null;
    }

    this.assertActorStation(row.station_id);
    const previewType = inferDocumentPreviewType(row.document_name || documentId, row.content_type);

    return {
      document_id: row.document_id,
      preview_type: previewType,
      inline_supported: ['pdf', 'image', 'text'].includes(previewType),
      content_type: row.content_type ?? undefined,
      document_name: row.document_name || documentId,
      preview_url: `/api/v1/station/documents/${row.document_id}/preview`,
      download_url: `/api/v1/station/documents/${row.document_id}/download`,
      size_bytes: numberFromRow(row.size_bytes)
    };
  }

  async createDocument(input: CreateDocumentInput): Promise<CreateDocumentResult> {
    const actor = this.ensureActor();
    const stationId = input.station_id ?? actor.stationScope[0];

    if (!stationId) {
      throw new RepositoryOperationError(400, 'VALIDATION_ERROR', 'station_id is required');
    }

    this.assertActorStation(stationId);

    await assertRelatedObjectExists(this.db, input.related_object_type, input.related_object_id);

    const uploadTicket = input.upload_id
      ? await this.db
          .prepare(
            `
              SELECT upload_id, station_id, related_object_type, document_name, content_type, size_bytes, checksum_sha256, retention_class, storage_key, expires_at, consumed_at
              FROM upload_tickets
              WHERE upload_id = ?
              LIMIT 1
            `
          )
          .bind(input.upload_id)
          .first<UploadTicketRow>()
      : null;

    if (input.upload_id && !uploadTicket) {
      throw new RepositoryOperationError(404, 'UPLOAD_NOT_FOUND', 'Upload ticket does not exist', {
        upload_id: input.upload_id
      });
    }

    if (uploadTicket?.station_id && uploadTicket.station_id !== stationId) {
      throw new RepositoryOperationError(409, 'UPLOAD_SCOPE_INVALID', 'Upload ticket belongs to another station', {
        upload_id: input.upload_id,
        station_id: stationId
      });
    }

    if (uploadTicket?.consumed_at) {
      throw new RepositoryOperationError(409, 'UPLOAD_ALREADY_CONSUMED', 'Upload ticket was already consumed', {
        upload_id: input.upload_id
      });
    }

    if (uploadTicket?.expires_at && new Date(uploadTicket.expires_at).getTime() < Date.now()) {
      throw new RepositoryOperationError(409, 'UPLOAD_EXPIRED', 'Upload ticket expired', {
        upload_id: input.upload_id
      });
    }

    const previous = input.replace_document_id
      ? await this.db
          .prepare(
            `
              SELECT document_id, station_id, version_no
              FROM documents
              WHERE document_id = ?
              LIMIT 1
            `
          )
          .bind(input.replace_document_id)
          .first<DocumentLookupRow>()
      : null;

    if (input.replace_document_id && !previous) {
      throw new RepositoryOperationError(409, 'DOCUMENT_VERSION_CONFLICT', 'Replacement target does not exist', {
        replace_document_id: input.replace_document_id
      });
    }

    if (previous?.station_id && previous.station_id !== stationId) {
      throw new RepositoryOperationError(409, 'DOCUMENT_VERSION_CONFLICT', 'Replacement target belongs to another station', {
        replace_document_id: input.replace_document_id,
        station_id: stationId
      });
    }

    const versionNumber = previous ? nextVersionNumber(previous.version_no) : 1;
    const versionNo = `v${versionNumber}`;
    const documentId = previous
      ? `${stripVersionSuffix(previous.document_id)}-V${versionNumber}`
      : createId(`DOC-${input.document_type.toUpperCase()}`);
    const uploadedAt = isoNow();

    await this.db
      .prepare(
        `
          INSERT INTO documents (
            document_id,
            station_id,
            document_type,
            document_name,
            related_object_type,
            related_object_id,
            parent_document_id,
            version_no,
            document_status,
            required_for_release,
            storage_key,
            uploaded_by,
            uploaded_at,
            note,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        documentId,
        stationId,
        input.document_type,
        uploadTicket?.document_name ?? input.document_name,
        input.related_object_type,
        input.related_object_id,
        previous?.document_id ?? null,
        versionNo,
        'Uploaded',
        input.required_for_release ? 1 : 0,
        uploadTicket?.storage_key ?? input.storage_key,
        actor.userId,
        uploadedAt,
        input.note ?? null,
        uploadedAt,
        uploadedAt
      )
      .run();

    await this.db
      .prepare(
        `
          UPDATE documents
          SET content_type = ?,
              size_bytes = ?,
              checksum_sha256 = ?,
              retention_class = ?,
              upload_id = ?,
              updated_at = ?
          WHERE document_id = ?
        `
      )
      .bind(
        uploadTicket?.content_type ?? input.content_type ?? null,
        uploadTicket?.size_bytes ?? input.size_bytes ?? null,
        uploadTicket?.checksum_sha256 ?? input.checksum_sha256 ?? null,
        uploadTicket?.retention_class ?? input.retention_class ?? 'operational',
        input.upload_id ?? null,
        uploadedAt,
        documentId
      )
      .run();

    if (uploadTicket?.upload_id) {
      await this.db
        .prepare(`UPDATE upload_tickets SET consumed_at = ?, updated_at = ? WHERE upload_id = ?`)
        .bind(uploadedAt, uploadedAt, uploadTicket.upload_id)
        .run();
    }

    if (previous) {
      await this.db
        .prepare(
          `
            UPDATE documents
            SET document_status = 'Replaced',
                updated_at = ?
            WHERE document_id = ?
          `
        )
        .bind(uploadedAt, previous.document_id)
        .run();
    }

    const auditId = await this.writeAudit({
      action: 'DOCUMENT_CREATED',
      objectType: 'Document',
      objectId: documentId,
      stationId,
      summary: `Document ${input.document_type} uploaded for ${input.related_object_type} ${input.related_object_id}`,
      payload: {
        version_mode: input.version_mode ?? 'new',
        replace_document_id: input.replace_document_id ?? null,
        trigger_parse: input.trigger_parse ?? false
      }
    });

    await this.writeStateTransition({
      stationId,
      objectType: 'Document',
      objectId: documentId,
      stateField: 'document_status',
      fromValue: 'Draft',
      toValue: 'Uploaded',
      triggeredBy: actor.userId,
      auditId,
      reason: input.note
    });

    return {
      document_id: documentId,
      document_type: input.document_type,
      document_name: uploadTicket?.document_name ?? input.document_name,
      related_object_type: input.related_object_type,
      related_object_id: input.related_object_id,
      version_no: versionNo,
      document_status: 'Uploaded',
      required_for_release: Boolean(input.required_for_release),
      storage_key: uploadTicket?.storage_key ?? input.storage_key,
      content_type: uploadTicket?.content_type ?? input.content_type,
      size_bytes: numberFromRow(uploadTicket?.size_bytes ?? input.size_bytes),
      checksum_sha256: uploadTicket?.checksum_sha256 ?? input.checksum_sha256,
      retention_class: uploadTicket?.retention_class ?? input.retention_class ?? 'operational',
      uploaded_at: uploadedAt,
      next_actions: input.trigger_parse ? ['parse', 'validate'] : ['validate'],
      audit_action: 'DOCUMENT_CREATED'
    };
  }
}

class D1TaskRepository extends BaseD1Repository implements TaskRepository {
  async listStationTasks(query: Record<string, string | undefined>): Promise<ListResponse<StationTaskListItem>> {
    const { page, pageSize, offset } = parsePagination(query.page, query.page_size);
    const { params, whereClause } = buildStationTaskWhereClause(query);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM tasks t
      WHERE ${whereClause}
    `;

    const listSql = `
      SELECT
        t.task_id,
        t.task_type,
        t.execution_node,
        t.related_object_type,
        t.related_object_id,
        CASE
          WHEN t.related_object_type = 'Flight' THEN COALESCE(f.flight_no || ' / ' || t.station_id || ' Inbound', t.related_object_id)
          WHEN t.related_object_type = 'AWB' THEN COALESCE(a.awb_no || ' / ' || a.station_id || ' Inbound', t.related_object_id)
          WHEN t.related_object_type = 'Shipment' THEN COALESCE(s.shipment_id, t.related_object_id)
          ELSE t.related_object_id
        END AS related_object_label,
        t.assigned_role,
        t.assigned_team_id,
        t.assigned_worker_id,
        t.task_status,
        t.task_sla,
        t.due_at,
        t.blocker_code,
        t.evidence_required,
        COALESCE(ex.open_exception_count, 0) AS open_exception_count
      FROM tasks t
      LEFT JOIN flights f ON t.related_object_type = 'Flight' AND t.related_object_id = f.flight_id
      LEFT JOIN awbs a ON t.related_object_type = 'AWB' AND t.related_object_id = a.awb_id
      LEFT JOIN shipments s ON t.related_object_type = 'Shipment' AND t.related_object_id = s.shipment_id
      LEFT JOIN (
        SELECT linked_task_id, COUNT(*) AS open_exception_count
        FROM exceptions
        WHERE exception_status NOT IN ('Resolved', 'Closed')
          AND linked_task_id IS NOT NULL
        GROUP BY linked_task_id
      ) ex ON ex.linked_task_id = t.task_id
      WHERE ${whereClause}
      ORDER BY t.due_at ASC, t.task_id ASC
      LIMIT ? OFFSET ?
    `;

    const [countRow, listRows] = await Promise.all([
      this.db.prepare(countSql).bind(...params).first<{ total: number | string }>(),
      this.db.prepare(listSql).bind(...params, pageSize, offset).all<StationTaskRow>()
    ]);

    return {
      items: listRows.results.map(mapStationTaskRow),
      page,
      page_size: pageSize,
      total: Number(countRow?.total ?? 0)
    };
  }

  async listMobileTasks(query: Record<string, string | undefined>): Promise<ListResponse<MobileTaskListItem>> {
    const actor = this.ensureActor();
    const { page, pageSize, offset } = parsePagination(query.page, query.page_size);
    const stationId = query.station_id ?? actor.stationScope[0] ?? 'MME';

    const baseParams: unknown[] = [stationId];
    const clauses = ['t.station_id = ?'];

    if (!actor.roleIds.includes('station_supervisor')) {
      clauses.push(`(
        w.user_id = ?
        OR t.assigned_role IN (${actor.roleIds.map(() => '?').join(', ')})
      )`);
      baseParams.push(actor.userId, ...actor.roleIds);
    }

    if (query.task_status) {
      clauses.push('t.task_status = ?');
      baseParams.push(query.task_status);
    }

    if (query.execution_node) {
      clauses.push('t.execution_node = ?');
      baseParams.push(query.execution_node);
    }

    if (query.flight_id) {
      clauses.push(`
        (
          (t.related_object_type = 'Flight' AND t.related_object_id = ?)
          OR f.flight_id = ?
          OR a.flight_id = ?
        )
      `);
      baseParams.push(query.flight_id, query.flight_id, query.flight_id);
    }

    if (query.flight_no) {
      clauses.push('(f.flight_no = ? OR af.flight_no = ?)');
      baseParams.push(query.flight_no, query.flight_no);
    }

    if (query.awb_no) {
      clauses.push('a.awb_no = ?');
      baseParams.push(query.awb_no);
    }

    const whereClause = clauses.join(' AND ');

    const countSql = `
      SELECT COUNT(DISTINCT t.task_id) AS total
      FROM tasks t
      LEFT JOIN workers w ON w.worker_id = t.assigned_worker_id
      LEFT JOIN flights f ON t.related_object_type = 'Flight' AND t.related_object_id = f.flight_id
      LEFT JOIN awbs a ON t.related_object_type = 'AWB' AND t.related_object_id = a.awb_id
      LEFT JOIN awbs af ON t.related_object_type = 'Flight' AND af.flight_id = t.related_object_id
      WHERE ${whereClause}
    `;

    const listSql = `
      SELECT
        t.task_id,
        t.task_type,
        t.execution_node,
        t.task_status,
        t.related_object_type,
        t.related_object_id,
        CASE
          WHEN t.related_object_type = 'Flight' THEN COALESCE(f.flight_no || ' / ' || t.station_id || ' Inbound', t.related_object_id)
          WHEN t.related_object_type = 'AWB' THEN COALESCE(a.awb_no || ' / ' || a.station_id || ' Inbound', t.related_object_id)
          ELSE t.related_object_id
        END AS related_object_label,
        COALESCE(
          a.awb_no,
          (
            SELECT awb_no
            FROM awbs awb_lookup
            WHERE awb_lookup.flight_id = t.related_object_id
            ORDER BY awb_lookup.awb_no ASC
            LIMIT 1
          )
        ) AS awb_no,
        COALESCE(
          f.flight_no,
          (
            SELECT flight_no
            FROM flights flight_lookup
            WHERE flight_lookup.flight_id = a.flight_id
            LIMIT 1
          )
        ) AS flight_no,
        t.station_id,
        t.due_at,
        t.evidence_required,
        t.blocker_code,
        CASE
          WHEN t.task_status = 'Assigned' THEN 'accept,start,upload_evidence,exception'
          WHEN t.task_status = 'Started' THEN 'upload_evidence,complete,exception'
          WHEN t.task_status = 'Accepted' THEN 'start,upload_evidence,exception'
          ELSE 'view'
        END AS allowed_actions
      FROM tasks t
      LEFT JOIN workers w ON w.worker_id = t.assigned_worker_id
      LEFT JOIN flights f ON t.related_object_type = 'Flight' AND t.related_object_id = f.flight_id
      LEFT JOIN awbs a ON t.related_object_type = 'AWB' AND t.related_object_id = a.awb_id
      WHERE ${whereClause}
      ORDER BY t.due_at ASC, t.task_id ASC
      LIMIT ? OFFSET ?
    `;

    const [countRow, listRows] = await Promise.all([
      this.db.prepare(countSql).bind(...baseParams).first<{ total: number | string }>(),
      this.db.prepare(listSql).bind(...baseParams, pageSize, offset).all<{
        task_id: string;
        task_type: string;
        execution_node: string;
        task_status: TaskStatus;
        related_object_type: string;
        related_object_id: string;
        related_object_label: string | null;
        awb_no: string | null;
        flight_no: string | null;
        station_id: string;
        due_at: string | null;
        evidence_required: number | string | null;
        blocker_code: string | null;
        allowed_actions: string;
      }>()
    ]);

    return {
      items: listRows.results.map((row) => ({
        task_id: row.task_id,
        task_type: row.task_type,
        execution_node: row.execution_node,
        task_status: row.task_status,
        related_object_type: row.related_object_type,
        related_object_id: row.related_object_id,
        related_object_label: row.related_object_label ?? row.related_object_id,
        awb_no: row.awb_no ?? undefined,
        flight_no: row.flight_no ?? undefined,
        station_id: row.station_id,
        due_at: row.due_at ?? undefined,
        evidence_required: booleanFromRow(row.evidence_required),
        blockers: row.blocker_code ? [row.blocker_code] : [],
        allowed_actions: row.allowed_actions.split(',').filter(Boolean)
      })),
      page,
      page_size: pageSize,
      total: Number(countRow?.total ?? 0)
    };
  }

  async acceptMobileTask(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult> {
    return this.processMobileTaskAction(taskId, 'Accepted', 'MOBILE_TASK_ACCEPTED', ['Created', 'Assigned'], input);
  }

  async startMobileTask(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult> {
    return this.processMobileTaskAction(taskId, 'Started', 'MOBILE_TASK_STARTED', ['Assigned', 'Accepted'], input);
  }

  async uploadMobileTaskEvidence(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult> {
    return this.processMobileTaskAction(
      taskId,
      'Evidence Uploaded',
      'MOBILE_TASK_EVIDENCE_UPLOADED',
      ['Started', 'Evidence Uploaded'],
      input
    );
  }

  async completeMobileTask(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult> {
    return this.processMobileTaskAction(
      taskId,
      'Completed',
      'MOBILE_TASK_COMPLETED',
      ['Started', 'Evidence Uploaded', 'Accepted'],
      input
    );
  }

  async verifyTask(taskId: string, input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult> {
    return this.processTaskWorkflowAction(taskId, 'Verified', 'TASK_VERIFIED', ['Completed', 'Evidence Uploaded'], input);
  }

  async reworkTask(taskId: string, input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult> {
    return this.processTaskWorkflowAction(
      taskId,
      'Rework',
      'TASK_REWORK_REQUESTED',
      ['Assigned', 'Accepted', 'Started', 'Evidence Uploaded', 'Completed', 'Verified', 'Escalated'],
      input
    );
  }

  async escalateTask(taskId: string, input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult> {
    return this.processTaskWorkflowAction(
      taskId,
      'Escalated',
      'TASK_ESCALATED',
      ['Created', 'Assigned', 'Accepted', 'Started', 'Evidence Uploaded', 'Completed', 'Rework', 'Exception Raised'],
      input
    );
  }

  async assignTask(taskId: string, input: AssignTaskInput): Promise<AssignTaskResult> {
    const actor = this.ensureActor();
    const task = await this.db
      .prepare(
        `
          SELECT task_id, station_id, task_status, assigned_role, assigned_team_id, assigned_worker_id
          FROM tasks
          WHERE task_id = ?
          LIMIT 1
        `
      )
      .bind(taskId)
      .first<TaskLookupRow>();

    if (!task) {
      throw new RepositoryOperationError(404, 'TASK_NOT_FOUND', 'Task does not exist', {
        task_id: taskId
      });
    }

    this.assertActorStation(task.station_id);

    if (task.task_status === 'Closed') {
      throw new RepositoryOperationError(409, 'TASK_ALREADY_CLOSED', 'Task is already closed', {
        task_id: taskId
      });
    }

    if (input.assigned_team_id) {
      const team = await this.db
        .prepare(
          `
            SELECT team_id, station_id, team_status
            FROM teams
            WHERE team_id = ?
            LIMIT 1
          `
        )
        .bind(input.assigned_team_id)
        .first<TeamLookupRow>();

      if (!team || team.station_id !== task.station_id || team.team_status !== 'active') {
        throw new RepositoryOperationError(409, 'ASSIGNEE_NOT_ELIGIBLE', 'Assigned team is not eligible', {
          assigned_team_id: input.assigned_team_id
        });
      }
    }

    if (input.assigned_worker_id) {
      const worker = await this.db
        .prepare(
          `
            SELECT worker_id, station_id, role_code, worker_status
            FROM workers
            WHERE worker_id = ?
            LIMIT 1
          `
        )
        .bind(input.assigned_worker_id)
        .first<WorkerLookupRow>();

      if (!worker || worker.station_id !== task.station_id || worker.worker_status !== 'active') {
        throw new RepositoryOperationError(409, 'ASSIGNEE_NOT_ELIGIBLE', 'Assigned worker is not eligible', {
          assigned_worker_id: input.assigned_worker_id
        });
      }
    }

    const nextStatus: TaskStatus = task.task_status === 'Created' ? 'Assigned' : task.task_status;
    const now = isoNow();

    await this.db
      .prepare(
        `
          UPDATE tasks
          SET assigned_role = ?,
              assigned_team_id = ?,
              assigned_worker_id = ?,
              due_at = COALESCE(?, due_at),
              task_sla = COALESCE(?, task_sla),
              task_status = ?,
              updated_at = ?
          WHERE task_id = ?
        `
      )
      .bind(
        input.assigned_role,
        input.assigned_team_id ?? null,
        input.assigned_worker_id ?? null,
        input.due_at ?? null,
        input.task_sla ?? null,
        nextStatus,
        now,
        taskId
      )
      .run();

    const auditId = await this.writeAudit({
      action: 'TASK_ASSIGNED',
      objectType: 'Task',
      objectId: taskId,
      stationId: task.station_id,
      summary: `Task assigned to ${input.assigned_role}`,
      payload: {
        previous_role: task.assigned_role,
        previous_team_id: task.assigned_team_id,
        previous_worker_id: task.assigned_worker_id,
        next_role: input.assigned_role,
        next_team_id: input.assigned_team_id ?? null,
        next_worker_id: input.assigned_worker_id ?? null,
        reason: input.reason ?? null
      }
    });

    if (task.task_status !== nextStatus) {
      await this.writeStateTransition({
        stationId: task.station_id,
        objectType: 'Task',
        objectId: taskId,
        stateField: 'task_status',
        fromValue: task.task_status,
        toValue: nextStatus,
        triggeredBy: actor.userId,
        auditId,
        reason: input.reason
      });
    }

    return {
      task_id: taskId,
      task_status: nextStatus,
      assigned_role: input.assigned_role,
      assigned_team_id: input.assigned_team_id,
      assigned_worker_id: input.assigned_worker_id,
      due_at: input.due_at,
      audit_action: 'TASK_ASSIGNED'
    };
  }

  async raiseTaskException(taskId: string, input: RaiseTaskExceptionInput): Promise<RaiseTaskExceptionResult> {
    const actor = this.ensureActor();
    const task = await this.db
      .prepare(
        `
          SELECT task_id, station_id, task_status, assigned_role, assigned_team_id, assigned_worker_id
          FROM tasks
          WHERE task_id = ?
          LIMIT 1
        `
      )
      .bind(taskId)
      .first<TaskLookupRow>();

    if (!task) {
      throw new RepositoryOperationError(404, 'TASK_NOT_FOUND', 'Task does not exist', {
        task_id: taskId
      });
    }

    this.assertActorStation(task.station_id);

    if (task.task_status === 'Closed') {
      throw new RepositoryOperationError(409, 'TASK_STATUS_INVALID', 'Closed task cannot raise exception', {
        task_id: taskId
      });
    }

    const existing = await this.db
      .prepare(
        `
          SELECT exception_id
          FROM exceptions
          WHERE linked_task_id = ?
            AND exception_status NOT IN ('Resolved', 'Closed')
          LIMIT 1
        `
      )
      .bind(taskId)
      .first<{ exception_id: string }>();

    if (existing) {
      throw new RepositoryOperationError(409, 'EXCEPTION_ALREADY_OPEN', 'Open exception already exists for task', {
        task_id: taskId,
        exception_id: existing.exception_id
      });
    }

    const exceptionId = createId('EXP');
    const now = isoNow();

    await this.db
      .prepare(
        `
          INSERT INTO exceptions (
            exception_id,
            station_id,
            exception_type,
            related_object_type,
            related_object_id,
            linked_task_id,
            severity,
            owner_role,
            owner_team_id,
            exception_status,
            blocker_flag,
            root_cause,
            action_taken,
            opened_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        exceptionId,
        task.station_id,
        input.exception_type,
        'Task',
        taskId,
        taskId,
        input.severity,
        input.owner_role,
        input.owner_team_id ?? null,
        'Open',
        input.blocker_flag ? 1 : 0,
        input.root_cause ?? null,
        input.action_taken ?? null,
        now,
        now,
        now
      )
      .run();

    await this.db
      .prepare(
        `
          UPDATE tasks
          SET task_status = 'Exception Raised',
              updated_at = ?
          WHERE task_id = ?
        `
      )
      .bind(now, taskId)
      .run();

    const auditId = await this.writeAudit({
      action: 'TASK_EXCEPTION_RAISED',
      objectType: 'Task',
      objectId: taskId,
      stationId: task.station_id,
      summary: `Exception ${input.exception_type} raised for task ${taskId}`,
      payload: {
        severity: input.severity,
        blocker_flag: input.blocker_flag,
        owner_role: input.owner_role,
        owner_team_id: input.owner_team_id ?? null,
        note: input.note ?? null
      }
    });

    if (task.task_status !== 'Exception Raised') {
      await this.writeStateTransition({
        stationId: task.station_id,
        objectType: 'Task',
        objectId: taskId,
        stateField: 'task_status',
        fromValue: task.task_status,
        toValue: 'Exception Raised',
        triggeredBy: actor.userId,
        auditId,
        reason: input.root_cause
      });
    }

    return {
      exception_id: exceptionId,
      exception_status: 'Open',
      related_object_type: 'Task',
      related_object_id: taskId,
      blocker_flag: input.blocker_flag,
      linked_task_id: taskId,
      task_status: 'Exception Raised',
      audit_action: 'TASK_EXCEPTION_RAISED'
    };
  }

  private async processMobileTaskAction(
    taskId: string,
    nextStatus: TaskStatus,
    auditAction: MobileTaskActionResult['audit_action'],
    allowedCurrentStatuses: TaskStatus[],
    input: MobileTaskActionInput
  ): Promise<MobileTaskActionResult> {
    const actor = this.ensureActor();
    const task = await this.db
      .prepare(
        `
          SELECT task_id, station_id, task_status, assigned_role, assigned_team_id, assigned_worker_id
          FROM tasks
          WHERE task_id = ?
          LIMIT 1
        `
      )
      .bind(taskId)
      .first<TaskLookupRow>();

    if (!task) {
      throw new RepositoryOperationError(404, 'TASK_NOT_FOUND', 'Task does not exist', {
        task_id: taskId
      });
    }

    this.assertActorStation(task.station_id);

    if (!allowedCurrentStatuses.includes(task.task_status)) {
      throw new RepositoryOperationError(409, 'TASK_STATUS_INVALID', `Task cannot transition to ${nextStatus}`, {
        task_id: taskId,
        current_status: task.task_status,
        next_status: nextStatus
      });
    }

    await this.db
      .prepare(
        `
          UPDATE tasks
          SET task_status = ?,
              updated_at = ?,
              completed_at = CASE WHEN ? = 'Completed' THEN ? ELSE completed_at END
          WHERE task_id = ?
        `
      )
      .bind(nextStatus, isoNow(), nextStatus, isoNow(), taskId)
      .run();

    const auditId = await this.writeAudit({
      action: auditAction,
      objectType: 'Task',
      objectId: taskId,
      stationId: task.station_id,
      summary: `Mobile task action ${auditAction} on ${taskId}`,
      payload: {
        note: input.note ?? null,
        evidence_summary: input.evidence_summary ?? null
      }
    });

    await this.writeStateTransition({
      stationId: task.station_id,
      objectType: 'Task',
      objectId: taskId,
      stateField: 'task_status',
      fromValue: task.task_status,
      toValue: nextStatus,
      triggeredBy: actor.userId,
      auditId,
      reason: input.note
    });

    return {
      task_id: taskId,
      task_status: nextStatus,
      audit_action: auditAction
    };
  }

  private async processTaskWorkflowAction(
    taskId: string,
    nextStatus: TaskStatus,
    auditAction: TaskWorkflowActionResult['audit_action'],
    allowedCurrentStatuses: TaskStatus[],
    input: TaskWorkflowActionInput
  ): Promise<TaskWorkflowActionResult> {
    const actor = this.ensureActor();
    const task = await this.db
      .prepare(
        `
          SELECT task_id, station_id, task_status
          FROM tasks
          WHERE task_id = ?
          LIMIT 1
        `
      )
      .bind(taskId)
      .first<TaskLookupRow>();

    if (!task) {
      throw new RepositoryOperationError(404, 'TASK_NOT_FOUND', 'Task does not exist', {
        task_id: taskId
      });
    }

    this.assertActorStation(task.station_id);

    if (!allowedCurrentStatuses.includes(task.task_status)) {
      throw new RepositoryOperationError(409, 'TASK_STATUS_INVALID', `Task cannot transition to ${nextStatus}`, {
        task_id: taskId,
        current_status: task.task_status,
        next_status: nextStatus
      });
    }

    const now = isoNow();
    await this.db
      .prepare(
        `
          UPDATE tasks
          SET task_status = ?,
              verified_at = CASE WHEN ? = 'Verified' THEN ? ELSE verified_at END,
              updated_at = ?
          WHERE task_id = ?
        `
      )
      .bind(nextStatus, nextStatus, now, now, taskId)
      .run();

    const auditId = await this.writeAudit({
      action: auditAction,
      objectType: 'Task',
      objectId: taskId,
      stationId: task.station_id,
      summary: `Task ${taskId} moved to ${nextStatus}`,
      payload: {
        note: input.note ?? null,
        reason: input.reason ?? null
      }
    });

    await this.writeStateTransition({
      stationId: task.station_id,
      objectType: 'Task',
      objectId: taskId,
      stateField: 'task_status',
      fromValue: task.task_status,
      toValue: nextStatus,
      triggeredBy: actor.userId,
      auditId,
      reason: input.reason ?? input.note
    });

    return {
      task_id: taskId,
      task_status: nextStatus,
      audit_action: auditAction
    };
  }
}

class D1ExceptionRepository extends BaseD1Repository implements ExceptionRepository {
  async getStationException(exceptionId: string): Promise<StationExceptionDetail | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            ex.exception_id,
            ex.exception_type,
            ex.related_object_type,
            ex.related_object_id,
            CASE
              WHEN ex.related_object_type = 'Flight' THEN COALESCE(f.flight_no || ' / ' || ex.station_id, ex.related_object_id)
              WHEN ex.related_object_type = 'AWB' THEN COALESCE(a.awb_no || ' / ' || ex.station_id, ex.related_object_id)
              WHEN ex.related_object_type = 'Task' THEN COALESCE(t.task_type || ' / ' || ex.related_object_id, ex.related_object_id)
              ELSE ex.related_object_id
            END AS related_object_label,
            ex.severity,
            ex.owner_role,
            ex.owner_team_id,
            ex.exception_status,
            ex.blocker_flag,
            ex.root_cause,
            ex.action_taken,
            ex.linked_task_id,
            COALESCE(t.task_type || ' / ' || t.task_id, ex.linked_task_id) AS linked_task_label,
            ex.opened_at
          FROM exceptions ex
          LEFT JOIN flights f ON ex.related_object_type = 'Flight' AND ex.related_object_id = f.flight_id
          LEFT JOIN awbs a ON ex.related_object_type = 'AWB' AND ex.related_object_id = a.awb_id
          LEFT JOIN tasks t ON ex.linked_task_id = t.task_id
          WHERE ex.exception_id = ?
          LIMIT 1
        `
      )
      .bind(exceptionId)
      .first<StationExceptionDetailRow>();

    if (!row) {
      return null;
    }

    const relatedFiles = await this.db
      .prepare(
        `
          SELECT document_id, document_name
          FROM documents
          WHERE
            (related_object_type = ? AND related_object_id = ?)
            OR (related_object_type = 'Task' AND related_object_id = ?)
          ORDER BY uploaded_at DESC, document_id DESC
          LIMIT 5
        `
      )
      .bind(row.related_object_type, row.related_object_id, row.linked_task_id)
      .all<RelatedFileRow>();

    return {
      exception_id: row.exception_id,
      exception_type: row.exception_type,
      related_object_type: row.related_object_type,
      related_object_id: row.related_object_id,
      related_object_label: row.related_object_label ?? row.related_object_id,
      severity: row.severity,
      owner_role: row.owner_role,
      owner_team_id: row.owner_team_id ?? undefined,
      exception_status: row.exception_status,
      blocker_flag: booleanFromRow(row.blocker_flag),
      root_cause: row.root_cause ?? undefined,
      action_taken: row.action_taken ?? undefined,
      linked_task_id: row.linked_task_id ?? undefined,
      linked_task_label: row.linked_task_label ?? undefined,
      gate_id: inferGateId(row),
      required_gate: inferRequiredGate(row),
      recovery_action: inferRecoveryAction(row),
      opened_at: row.opened_at ?? undefined,
      related_files: relatedFiles.results.map((file) => ({
        label: file.document_name,
        document_id: file.document_id
      }))
    };
  }

  async listStationExceptions(query: Record<string, string | undefined>): Promise<ListResponse<StationExceptionListItem>> {
    const { page, pageSize, offset } = parsePagination(query.page, query.page_size);
    const { params, whereClause } = buildStationExceptionWhereClause(query);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM exceptions ex
      WHERE ${whereClause}
    `;

    const listSql = `
      SELECT
        ex.exception_id,
        ex.exception_type,
        ex.related_object_type,
        ex.related_object_id,
        CASE
          WHEN ex.related_object_type = 'Flight' THEN COALESCE(f.flight_no || ' / ' || ex.station_id, ex.related_object_id)
          WHEN ex.related_object_type = 'AWB' THEN COALESCE(a.awb_no || ' / ' || ex.station_id, ex.related_object_id)
          WHEN ex.related_object_type = 'Task' THEN COALESCE(t.task_type || ' / ' || ex.related_object_id, ex.related_object_id)
          ELSE ex.related_object_id
        END AS related_object_label,
        ex.severity,
        ex.owner_role,
        ex.owner_team_id,
        ex.exception_status,
        ex.blocker_flag,
        ex.root_cause,
        ex.opened_at
      FROM exceptions ex
      LEFT JOIN flights f ON ex.related_object_type = 'Flight' AND ex.related_object_id = f.flight_id
      LEFT JOIN awbs a ON ex.related_object_type = 'AWB' AND ex.related_object_id = a.awb_id
      LEFT JOIN tasks t ON ex.related_object_type = 'Task' AND ex.related_object_id = t.task_id
      WHERE ${whereClause}
      ORDER BY ex.opened_at DESC, ex.exception_id DESC
      LIMIT ? OFFSET ?
    `;

    const [countRow, listRows] = await Promise.all([
      this.db.prepare(countSql).bind(...params).first<{ total: number | string }>(),
      this.db.prepare(listSql).bind(...params, pageSize, offset).all<StationExceptionRow>()
    ]);

    return {
      items: listRows.results.map((row) => ({
        exception_id: row.exception_id,
        exception_type: row.exception_type,
        related_object_type: row.related_object_type,
        related_object_id: row.related_object_id,
        related_object_label: row.related_object_label ?? row.related_object_id,
        severity: row.severity,
        owner_role: row.owner_role,
        owner_team_id: row.owner_team_id ?? undefined,
        exception_status: row.exception_status,
        blocker_flag: booleanFromRow(row.blocker_flag),
        root_cause: row.root_cause ?? undefined,
        opened_at: row.opened_at ?? undefined
      })),
      page,
      page_size: pageSize,
      total: Number(countRow?.total ?? 0)
    };
  }

  async resolveStationException(exceptionId: string, input: ResolveExceptionInput): Promise<ResolveExceptionResult> {
    const actor = this.ensureActor();
    const row = await this.db
      .prepare(
        `
          SELECT exception_id, station_id, exception_status, linked_task_id
          FROM exceptions
          WHERE exception_id = ?
          LIMIT 1
        `
      )
      .bind(exceptionId)
      .first<{ exception_id: string; station_id: string; exception_status: string; linked_task_id: string | null }>();

    if (!row) {
      throw new RepositoryOperationError(404, 'EXCEPTION_NOT_FOUND', 'Exception does not exist', {
        exception_id: exceptionId
      });
    }

    this.assertActorStation(row.station_id);

    if (['Resolved', 'Closed'].includes(row.exception_status)) {
      throw new RepositoryOperationError(409, 'EXCEPTION_STATUS_INVALID', 'Exception is already resolved', {
        exception_id: exceptionId,
        current_status: row.exception_status
      });
    }

    const now = isoNow();
    await this.db
      .prepare(
        `
          UPDATE exceptions
          SET exception_status = 'Resolved',
              action_taken = COALESCE(?, action_taken),
              closed_at = ?,
              updated_at = ?
          WHERE exception_id = ?
        `
      )
      .bind(input.resolution ?? input.note ?? null, now, now, exceptionId)
      .run();

    if (row.linked_task_id) {
      await this.db
        .prepare(
          `
            UPDATE tasks
            SET task_status = CASE WHEN task_status = 'Exception Raised' THEN 'Assigned' ELSE task_status END,
                updated_at = ?
            WHERE task_id = ?
          `
        )
        .bind(now, row.linked_task_id)
        .run();
    }

    const auditId = await this.writeAudit({
      action: 'EXCEPTION_RESOLVED',
      objectType: 'Exception',
      objectId: exceptionId,
      stationId: row.station_id,
      summary: `Exception ${exceptionId} resolved`,
      payload: {
        note: input.note ?? null,
        resolution: input.resolution ?? null,
        linked_task_id: row.linked_task_id ?? null
      }
    });

    await this.writeStateTransition({
      stationId: row.station_id,
      objectType: 'Exception',
      objectId: exceptionId,
      stateField: 'exception_status',
      fromValue: row.exception_status,
      toValue: 'Resolved',
      triggeredBy: actor.userId,
      auditId,
      reason: input.resolution ?? input.note
    });

    return {
      exception_id: exceptionId,
      exception_status: 'Resolved',
      audit_action: 'EXCEPTION_RESOLVED'
    };
  }
}

class PlaceholderFlightRepository implements FlightRepository {
  async listInboundFlights(_query: InboundFlightListQuery): Promise<ListResponse<InboundFlightListItem>> {
    throw new RepositoryNotReadyError('flights.listInboundFlights');
  }

  async getInboundFlight(_flightId: string): Promise<InboundFlightDetail | null> {
    throw new RepositoryNotReadyError('flights.getInboundFlight');
  }

  async listOutboundFlights(_query: Record<string, string | undefined>): Promise<ListResponse<OutboundFlightListItem>> {
    throw new RepositoryNotReadyError('flights.listOutboundFlights');
  }

  async getOutboundFlight(_flightId: string): Promise<OutboundFlightDetail | null> {
    throw new RepositoryNotReadyError('flights.getOutboundFlight');
  }

  async markOutboundLoaded(_flightId: string, _input: OutboundFlightActionInput): Promise<OutboundFlightActionResult> {
    throw new RepositoryNotReadyError('flights.markOutboundLoaded');
  }

  async finalizeOutboundManifest(_flightId: string, _input: OutboundFlightActionInput): Promise<OutboundFlightActionResult> {
    throw new RepositoryNotReadyError('flights.finalizeOutboundManifest');
  }

  async markOutboundAirborne(_flightId: string, _input: OutboundFlightActionInput): Promise<OutboundFlightActionResult> {
    throw new RepositoryNotReadyError('flights.markOutboundAirborne');
  }
}

class PlaceholderWaybillRepository implements WaybillRepository {
  async listInboundWaybills(
    _query: Record<string, string | undefined>
  ): Promise<ListResponse<InboundWaybillListItem>> {
    throw new RepositoryNotReadyError('waybills.listInboundWaybills');
  }

  async getInboundWaybill(_awbId: string): Promise<InboundWaybillDetail | null> {
    throw new RepositoryNotReadyError('waybills.getInboundWaybill');
  }

  async listOutboundWaybills(_query: Record<string, string | undefined>): Promise<ListResponse<OutboundWaybillListItem>> {
    throw new RepositoryNotReadyError('waybills.listOutboundWaybills');
  }

  async getOutboundWaybill(_awbId: string): Promise<OutboundWaybillDetail | null> {
    throw new RepositoryNotReadyError('waybills.getOutboundWaybill');
  }

  async processInboundNoa(_awbId: string, _input: NoaActionInput): Promise<NoaActionResult> {
    throw new RepositoryNotReadyError('waybills.processInboundNoa');
  }

  async processInboundPod(_awbId: string, _input: PodActionInput): Promise<PodActionResult> {
    throw new RepositoryNotReadyError('waybills.processInboundPod');
  }
}

class PlaceholderDocumentRepository implements DocumentRepository {
  async listStationDocuments(
    _query: Record<string, string | undefined>
  ): Promise<ListResponse<StationDocumentListItem>> {
    throw new RepositoryNotReadyError('documents.listStationDocuments');
  }

  async createDocument(_input: CreateDocumentInput): Promise<CreateDocumentResult> {
    throw new RepositoryNotReadyError('documents.createDocument');
  }

  async createUploadTicket(_input: CreateUploadTicketInput): Promise<CreateUploadTicketResult> {
    throw new RepositoryNotReadyError('documents.createUploadTicket');
  }

  async getStationDocumentPreview(_documentId: string): Promise<StationDocumentPreviewResult | null> {
    throw new RepositoryNotReadyError('documents.getStationDocumentPreview');
  }
}

class PlaceholderShipmentRepository implements ShipmentRepository {
  async getStationShipment(_shipmentId: string): Promise<StationShipmentDetail | null> {
    throw new RepositoryNotReadyError('shipments.getStationShipment');
  }

  async listStationShipments(
    _query: Record<string, string | undefined>
  ): Promise<ListResponse<StationShipmentListItem>> {
    throw new RepositoryNotReadyError('shipments.listStationShipments');
  }
}

class PlaceholderTaskRepository implements TaskRepository {
  async acceptMobileTask(_taskId: string, _input: MobileTaskActionInput): Promise<MobileTaskActionResult> {
    throw new RepositoryNotReadyError('tasks.acceptMobileTask');
  }

  async completeMobileTask(_taskId: string, _input: MobileTaskActionInput): Promise<MobileTaskActionResult> {
    throw new RepositoryNotReadyError('tasks.completeMobileTask');
  }

  async listStationTasks(
    _query: Record<string, string | undefined>
  ): Promise<ListResponse<StationTaskListItem>> {
    throw new RepositoryNotReadyError('tasks.listStationTasks');
  }

  async assignTask(_taskId: string, _input: AssignTaskInput): Promise<AssignTaskResult> {
    throw new RepositoryNotReadyError('tasks.assignTask');
  }

  async verifyTask(_taskId: string, _input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult> {
    throw new RepositoryNotReadyError('tasks.verifyTask');
  }

  async reworkTask(_taskId: string, _input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult> {
    throw new RepositoryNotReadyError('tasks.reworkTask');
  }

  async escalateTask(_taskId: string, _input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult> {
    throw new RepositoryNotReadyError('tasks.escalateTask');
  }

  async startMobileTask(_taskId: string, _input: MobileTaskActionInput): Promise<MobileTaskActionResult> {
    throw new RepositoryNotReadyError('tasks.startMobileTask');
  }

  async uploadMobileTaskEvidence(_taskId: string, _input: MobileTaskActionInput): Promise<MobileTaskActionResult> {
    throw new RepositoryNotReadyError('tasks.uploadMobileTaskEvidence');
  }

  async raiseTaskException(
    _taskId: string,
    _input: RaiseTaskExceptionInput
  ): Promise<RaiseTaskExceptionResult> {
    throw new RepositoryNotReadyError('tasks.raiseTaskException');
  }

  async listMobileTasks(
    _query: Record<string, string | undefined>
  ): Promise<ListResponse<MobileTaskListItem>> {
    throw new RepositoryNotReadyError('tasks.listMobileTasks');
  }
}

class PlaceholderExceptionRepository implements ExceptionRepository {
  async getStationException(_exceptionId: string): Promise<StationExceptionDetail | null> {
    throw new RepositoryNotReadyError('exceptions.getStationException');
  }

  async listStationExceptions(
    _query: Record<string, string | undefined>
  ): Promise<ListResponse<StationExceptionListItem>> {
    throw new RepositoryNotReadyError('exceptions.listStationExceptions');
  }

  async resolveStationException(_exceptionId: string, _input: ResolveExceptionInput): Promise<ResolveExceptionResult> {
    throw new RepositoryNotReadyError('exceptions.resolveStationException');
  }
}

function buildInboundFlightWhereClause(query: InboundFlightListQuery) {
  const clauses = ['f.station_id = ?'];
  const params: unknown[] = [query.station_id ?? 'MME'];

  if (query.runtime_status) {
    clauses.push('f.runtime_status = ?');
    params.push(query.runtime_status);
  }

  if (query.service_level) {
    clauses.push('f.service_level = ?');
    params.push(query.service_level);
  }

  if (query.date_from) {
    clauses.push('f.flight_date >= ?');
    params.push(query.date_from);
  }

  if (query.date_to) {
    clauses.push('f.flight_date <= ?');
    params.push(query.date_to);
  }

  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    clauses.push('(f.flight_no LIKE ? OR f.origin_code LIKE ? OR f.destination_code LIKE ? OR COALESCE(f.notes, \'\') LIKE ?)');
    params.push(keyword, keyword, keyword, keyword);
  }

  return {
    whereClause: clauses.join(' AND '),
    params
  };
}

function buildInboundWaybillWhereClause(query: Record<string, string | undefined>) {
  const clauses = ['a.station_id = ?'];
  const params: unknown[] = [query.station_id ?? 'MME'];

  if (query.flight_id) {
    clauses.push('a.flight_id = ?');
    params.push(query.flight_id);
  }

  if (query.noa_status) {
    clauses.push('a.noa_status = ?');
    params.push(query.noa_status);
  }

  if (query.pod_status) {
    clauses.push('a.pod_status = ?');
    params.push(query.pod_status);
  }

  if (query.transfer_status) {
    clauses.push('a.transfer_status = ?');
    params.push(query.transfer_status);
  }

  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    clauses.push('(a.awb_no LIKE ? OR COALESCE(a.consignee_name, \'\') LIKE ?)');
    params.push(keyword, keyword);
  }

  return {
    whereClause: clauses.join(' AND '),
    params
  };
}

function buildStationTaskWhereClause(query: Record<string, string | undefined>) {
  const clauses = ['t.station_id = ?'];
  const params: unknown[] = [query.station_id ?? 'MME'];

  if (query.task_status) {
    clauses.push('t.task_status = ?');
    params.push(query.task_status);
  }

  if (query.task_type) {
    clauses.push('t.task_type = ?');
    params.push(query.task_type);
  }

  if (query.execution_node) {
    clauses.push('t.execution_node = ?');
    params.push(query.execution_node);
  }

  if (query.assigned_team_id) {
    clauses.push('t.assigned_team_id = ?');
    params.push(query.assigned_team_id);
  }

  if (query.assigned_worker_id) {
    clauses.push('t.assigned_worker_id = ?');
    params.push(query.assigned_worker_id);
  }

  if (query.related_object_type) {
    clauses.push('t.related_object_type = ?');
    params.push(query.related_object_type);
  }

  if (query.related_object_id) {
    clauses.push('t.related_object_id = ?');
    params.push(query.related_object_id);
  }

  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    clauses.push('(t.task_type LIKE ? OR COALESCE(t.blocker_code, \'\') LIKE ? OR t.related_object_id LIKE ?)');
    params.push(keyword, keyword, keyword);
  }

  return {
    whereClause: clauses.join(' AND '),
    params
  };
}

function buildStationExceptionWhereClause(query: Record<string, string | undefined>) {
  const clauses = ['ex.station_id = ?'];
  const params: unknown[] = [query.station_id ?? 'MME'];

  if (query.exception_status) {
    clauses.push('ex.exception_status = ?');
    params.push(query.exception_status);
  }

  if (query.exception_type) {
    clauses.push('ex.exception_type = ?');
    params.push(query.exception_type);
  }

  if (query.severity) {
    clauses.push('ex.severity = ?');
    params.push(query.severity);
  }

  if (query.related_object_type) {
    clauses.push('ex.related_object_type = ?');
    params.push(query.related_object_type);
  }

  if (query.related_object_id) {
    clauses.push('ex.related_object_id = ?');
    params.push(query.related_object_id);
  }

  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    clauses.push('(ex.exception_id LIKE ? OR COALESCE(ex.root_cause, \'\') LIKE ? OR ex.related_object_id LIKE ?)');
    params.push(keyword, keyword, keyword);
  }

  return {
    whereClause: clauses.join(' AND '),
    params
  };
}

function buildStationDocumentWhereClause(query: Record<string, string | undefined>) {
  const clauses = ['d.station_id = ?', 'd.deleted_at IS NULL'];
  const params: unknown[] = [query.station_id ?? 'MME'];

  if (query.document_type) {
    clauses.push('d.document_type = ?');
    params.push(query.document_type);
  }

  if (query.document_status) {
    clauses.push('d.document_status = ?');
    params.push(query.document_status);
  }

  if (query.related_object_type) {
    clauses.push('d.related_object_type = ?');
    params.push(query.related_object_type);
  }

  if (query.related_object_id) {
    clauses.push('d.related_object_id = ?');
    params.push(query.related_object_id);
  }

  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    clauses.push('(d.document_name LIKE ? OR d.document_id LIKE ? OR d.related_object_id LIKE ?)');
    params.push(keyword, keyword, keyword);
  }

  return {
    whereClause: clauses.join(' AND '),
    params
  };
}

function buildStationShipmentWhereClause(query: Record<string, string | undefined>) {
  const clauses = ['s.station_id = ?'];
  const params: unknown[] = [query.station_id ?? 'MME'];

  if (query.direction === '出港' || query.direction === 'outbound') {
    clauses.push(`COALESCE(s.shipment_type, 'import') = 'export'`);
  } else if (query.direction === '进港' || query.direction === 'inbound') {
    clauses.push(`COALESCE(s.shipment_type, 'import') != 'export'`);
  }

  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    clauses.push(
      `(a.awb_no LIKE ? OR COALESCE(a.consignee_name, '') LIKE ? OR COALESCE(f.flight_no, '') LIKE ? OR s.shipment_id LIKE ?)`
    );
    params.push(keyword, keyword, keyword, keyword);
  }

  return {
    whereClause: clauses.join(' AND '),
    params
  };
}

function buildOutboundFlightWhereClause(query: Record<string, string | undefined>) {
  const clauses = [`f.station_id = ?`];
  const params: unknown[] = [query.station_id ?? 'MME'];

  if (query.flight_no) {
    clauses.push('f.flight_no = ?');
    params.push(query.flight_no);
  }

  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    clauses.push('(f.flight_no LIKE ? OR f.origin_code LIKE ? OR f.destination_code LIKE ?)');
    params.push(keyword, keyword, keyword);
  }

  return {
    whereClause: clauses.join(' AND '),
    params
  };
}

function buildOutboundWaybillWhereClause(query: Record<string, string | undefined>) {
  const clauses = ['a.station_id = ?'];
  const params: unknown[] = [query.station_id ?? 'MME'];

  if (query.flight_no) {
    clauses.push('f.flight_no = ?');
    params.push(query.flight_no);
  }

  if (query.awb_no) {
    clauses.push('a.awb_no = ?');
    params.push(query.awb_no);
  }

  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    clauses.push('(a.awb_no LIKE ? OR COALESCE(a.consignee_name, \'\') LIKE ? OR COALESCE(f.flight_no, \'\') LIKE ?)');
    params.push(keyword, keyword, keyword);
  }

  return {
    whereClause: clauses.join(' AND '),
    params
  };
}

function parsePagination(pageInput?: string, pageSizeInput?: string) {
  const page = Math.max(1, Number.parseInt(pageInput ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(pageSizeInput ?? '20', 10) || 20));
  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    offset
  };
}

function mapFlightSummaryRow(row: FlightSummaryRow): InboundFlightListItem {
  return {
    flight_id: row.flight_id,
    flight_no: row.flight_no,
    flight_date: row.flight_date,
    station_id: row.station_id,
    origin_code: row.origin_code,
    destination_code: row.destination_code,
    eta: row.eta ?? undefined,
    actual_landed_at: row.actual_landed_at ?? undefined,
    runtime_status: row.runtime_status,
    service_level: row.service_level ?? undefined,
    summary: {
      current_step: row.current_step,
      total_awb_count: Number(row.total_awb_count ?? 0),
      total_pieces: Number(row.total_pieces ?? 0),
      total_weight: Number(row.total_weight ?? 0),
      open_task_count: Number(row.open_task_count ?? 0),
      open_exception_count: Number(row.open_exception_count ?? 0),
      blocked: Number(row.open_exception_count ?? 0) > 0,
      blocker_reason: row.blocker_reason ?? undefined
    }
  };
}

function mapStationTaskRow(row: StationTaskRow): StationTaskListItem {
  return {
    task_id: row.task_id,
    task_type: row.task_type,
    execution_node: row.execution_node,
    related_object_type: row.related_object_type,
    related_object_id: row.related_object_id,
    related_object_label: row.related_object_label ?? row.related_object_id,
    assigned_role: row.assigned_role ?? undefined,
    assigned_team_id: row.assigned_team_id,
    assigned_worker_id: row.assigned_worker_id,
    task_status: row.task_status,
    task_sla: row.task_sla ?? undefined,
    due_at: row.due_at ?? undefined,
    blocker_code: row.blocker_code ?? undefined,
    evidence_required: booleanFromRow(row.evidence_required),
    open_exception_count: Number(row.open_exception_count ?? 0)
  };
}

function mapShipmentDirection(shipmentType: string | null | undefined) {
  return shipmentType === 'export' ? '出港' : '进港';
}

function getShipmentSlug(shipmentType: string | null | undefined, awbNo: string) {
  return `${shipmentType === 'export' ? 'out' : 'in'}-${awbNo}`;
}

function inferShipmentRoute(row: Pick<StationShipmentRow, 'shipment_type' | 'flight_no' | 'station_id'>) {
  return row.shipment_type === 'export'
    ? `${row.flight_no ?? '--'} / Export`
    : `${row.flight_no ?? '--'} / ${row.station_id} Inbound`;
}

function inferShipmentDocumentStatus(row: Pick<StationShipmentRow, 'document_status'>) {
  return row.document_status ?? 'Pending';
}

function inferShipmentTaskStatus(row: Pick<StationShipmentRow, 'task_status'>) {
  return row.task_status ?? 'Created';
}

function inferShipmentBlocker(row: Pick<StationShipmentRow, 'blocker_reason' | 'shipment_type' | 'document_status'>) {
  if (row.blocker_reason) {
    return row.blocker_reason;
  }

  if (row.shipment_type === 'export' && row.document_status !== 'Released' && row.document_status !== 'Approved') {
    return 'Manifest 未冻结，当前不可进入飞走归档';
  }

  return '无';
}

function inferShipmentDocumentGateIds(documentType: string) {
  if (documentType === 'POD') return ['HG-06'];
  if (['CBA', 'Manifest', 'FFM', 'UWS', 'MAWB'].includes(documentType)) return ['HG-01'];
  return [];
}

function inferShipmentDocumentNote(documentType: string, documentStatus: string) {
  if (documentType === 'POD') {
    return documentStatus === 'Released' ? 'POD 已归档，可支持交付闭环。' : 'POD 尚未完成双签或归档。';
  }

  if (documentType === 'Manifest') {
    return documentStatus === 'Released' || documentStatus === 'Approved'
      ? 'Manifest 已冻结，可支持后续放行。'
      : 'Manifest 仍待冻结或补齐。';
  }

  return `当前 ${documentType} 状态为 ${documentStatus}。`;
}

function deriveOutboundStatuses(row: {
  runtime_status: string | null;
  ffm_status?: string | null;
  mawb_status?: string | null;
  manifest_doc_status?: string | null;
  receipt_task_status?: string | null;
  loading_task_status?: string | null;
}) {
  const forecast_status = row.ffm_status === 'Approved' ? '已预报' : row.ffm_status === 'Uploaded' ? '待处理' : '待处理';
  const receipt_status = row.receipt_task_status === 'Completed' ? '已接收' : row.receipt_task_status ? '运行中' : '待处理';
  const master_status = row.mawb_status === 'Approved' ? '主单完成' : row.mawb_status === 'Uploaded' ? '待处理' : '待处理';
  const loading_status =
    row.loading_task_status === 'Completed'
      ? '已装载'
      : row.loading_task_status === 'Started'
        ? '运行中'
        : row.loading_task_status
          ? '待处理'
          : row.runtime_status === 'Pre-Departure'
            ? '待处理'
            : '运行中';
  const manifest_status =
    row.manifest_doc_status === 'Released' || row.manifest_doc_status === 'Approved'
      ? '运行中'
      : row.manifest_doc_status === 'Uploaded'
        ? '待生成'
        : '待处理';

  return {
    forecast_status,
    receipt_status,
    master_status,
    loading_status,
    manifest_status
  };
}

function deriveOutboundStage(
  row: {
    runtime_status: string | null;
  },
  statuses: ReturnType<typeof deriveOutboundStatuses>
) {
  if (row.runtime_status === 'Airborne') return '飞走归档';
  if (row.runtime_status === 'Cancelled') return '已取消';
  if (statuses.loading_status === '已装载') return '装载中';
  if (statuses.manifest_status === '待生成') return '待 Manifest';
  if (statuses.master_status === '主单完成') return '主单完成';
  return '待处理';
}

function inferOutboundShipmentPrimaryStatus(row: {
  shipment_type: string | null;
  runtime_status: string | null;
  task_status: string | null;
  document_status: string | null;
  current_node: string;
  fulfillment_status: string;
}) {
  if (row.shipment_type !== 'export') {
    return row.fulfillment_status || row.current_node;
  }

  if (row.runtime_status === 'Airborne') return 'Airborne';
  if (row.document_status === 'Released' || row.document_status === 'Approved') return 'Manifest Released';
  if (row.task_status === 'Completed') return 'Loaded';
  if (row.document_status === 'Uploaded') return 'Manifest Pending';

  return row.current_node || row.fulfillment_status;
}

function inferOutboundShipmentTimelineStatus(row: {
  shipment_type: string | null;
  runtime_status: string | null;
  task_status: string | null;
  document_status: string | null;
  current_node: string;
}) {
  if (row.shipment_type !== 'export') {
    return row.current_node;
  }

  if (row.runtime_status === 'Airborne') return '已飞走';
  if (row.task_status === 'Completed') return '已装载';
  if (row.document_status === 'Released' || row.document_status === 'Approved') return '主单已冻结';
  if (row.document_status === 'Uploaded') return '待主单冻结';

  return row.current_node;
}

function inferShipmentLinkedTask(documentType: string, shipmentType: string | null | undefined) {
  if (documentType === 'POD') return '交付关闭';
  if (documentType === 'Manifest') return shipmentType === 'export' ? '飞走归档' : '理货放行';
  if (documentType === 'CBA') return 'PMC 拆板任务';
  if (documentType === 'FFM') return '预报确认';
  if (documentType === 'UWS') return '装机复核';
  return '站内任务';
}

function inferShipmentTaskGateIds(taskType: string, blockerCode: string | null) {
  if (blockerCode) {
    return [blockerCode];
  }

  if (taskType.includes('NOA')) return ['HG-03'];
  if (taskType.includes('POD') || taskType.includes('交付')) return ['HG-06'];
  if (taskType.includes('装机') || taskType.includes('Loaded')) return ['HG-01', 'HG-02'];
  if (taskType.includes('拆板') || taskType.includes('理货')) return ['HG-01'];
  return [];
}

function parseShipmentSlug(shipmentId: string) {
  if (shipmentId.startsWith('in-')) {
    return { awbNo: shipmentId.slice(3), shipmentType: 'inbound' as const };
  }

  if (shipmentId.startsWith('out-')) {
    return { awbNo: shipmentId.slice(4), shipmentType: 'outbound' as const };
  }

  return { awbNo: shipmentId, shipmentType: null };
}

async function loadOutboundFlightActionState(db: D1DatabaseLike, flightId: string): Promise<OutboundFlightActionState> {
  const [flight, awbs, shipments, documents, tasks] = await Promise.all([
    db
      .prepare(
        `
          SELECT flight_id, station_id, runtime_status, etd_at, actual_takeoff_at
          FROM flights
          WHERE flight_id = ?
          LIMIT 1
        `
      )
      .bind(flightId)
      .first<FlightLookupRow>(),
    db
      .prepare(
        `
          SELECT awb_id, shipment_id, current_node
          FROM awbs
          WHERE flight_id = ?
          ORDER BY awb_no ASC
        `
      )
      .bind(flightId)
      .all<OutboundFlightActionAwbRow>(),
    db
      .prepare(
        `
          SELECT DISTINCT s.shipment_id, s.current_node, s.fulfillment_status
          FROM shipments s
          INNER JOIN awbs a ON a.shipment_id = s.shipment_id
          WHERE a.flight_id = ?
          ORDER BY s.shipment_id ASC
        `
      )
      .bind(flightId)
      .all<OutboundFlightActionShipmentRow>(),
    db
      .prepare(
        `
          SELECT
            d.document_id,
            d.document_type,
            d.document_status,
            d.related_object_type,
            d.related_object_id
          FROM documents d
          WHERE d.document_status != 'Replaced'
            AND (
              (d.related_object_type = 'Flight' AND d.related_object_id = ? AND d.document_type IN ('FFM', 'UWS', 'Manifest'))
              OR (d.related_object_type = 'Shipment' AND d.related_object_id IN (
                SELECT DISTINCT shipment_id FROM awbs WHERE flight_id = ?
              ) AND d.document_type = 'Manifest')
            )
          ORDER BY d.uploaded_at DESC, d.document_id DESC
        `
      )
      .bind(flightId, flightId)
      .all<OutboundFlightActionDocumentRow>(),
    db
      .prepare(
        `
          SELECT
            t.task_id,
            t.task_type,
            t.task_status,
            t.related_object_type,
            t.related_object_id
          FROM tasks t
          WHERE (
            (t.related_object_type = 'Flight' AND t.related_object_id = ? AND t.task_type IN ('装机复核', '飞走归档'))
            OR (t.related_object_type = 'AWB' AND t.related_object_id IN (
              SELECT awb_id FROM awbs WHERE flight_id = ?
            ) AND t.task_type = '出港收货')
          )
          ORDER BY t.due_at ASC, t.task_id ASC
        `
      )
      .bind(flightId, flightId)
      .all<OutboundFlightActionTaskRow>()
  ]);

  if (!flight) {
    throw new RepositoryOperationError(404, 'FLIGHT_NOT_FOUND', 'Outbound flight does not exist', { flight_id: flightId });
  }

  return {
    flight,
    awbs: awbs.results,
    shipments: shipments.results,
    documents: documents.results,
    tasks: tasks.results
  };
}

function booleanFromRow(value: number | string | null | undefined) {
  return value === 1 || value === '1';
}

function numberFromRow(value: number | string | null | undefined) {
  return value === null || typeof value === 'undefined' ? undefined : Number(value);
}

function isoNow() {
  return new Date().toISOString();
}

function isoAfterMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function inferDocumentPreviewType(documentName: string, contentType?: string | null) {
  const normalizedName = documentName.toLowerCase();
  const normalizedType = (contentType || '').toLowerCase();

  if (normalizedType.includes('pdf') || normalizedName.endsWith('.pdf')) return 'pdf';
  if (normalizedType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(normalizedName)) return 'image';
  if (normalizedType.startsWith('text/') || /\.(txt|json|csv|md)$/i.test(normalizedName)) return 'text';
  if (
    normalizedType.includes('officedocument') ||
    normalizedType.includes('msword') ||
    /\.(docx?|xlsx?|pptx?)$/i.test(normalizedName)
  ) {
    return 'office';
  }

  return 'other';
}

function nextVersionNumber(versionNo: string | null | undefined) {
  const parsed = Number.parseInt((versionNo ?? 'v0').replace(/^v/i, ''), 10);
  return Number.isFinite(parsed) ? parsed + 1 : 1;
}

function stripVersionSuffix(documentId: string) {
  return documentId.replace(/-V\d+$/i, '');
}

function inferGateId(row: Pick<StationExceptionDetailRow, 'exception_type' | 'related_object_type'>) {
  if (row.exception_type === 'PiecesMismatch') return 'HG-03';
  if (row.exception_type === 'MissingDocument') return 'HG-01';
  if (row.related_object_type === 'Task') return 'HG-06';
  return 'HG-03';
}

function inferRequiredGate(row: Pick<StationExceptionDetailRow, 'exception_type' | 'related_object_type'>) {
  if (row.exception_type === 'PiecesMismatch') return 'PMC 拆板后必须核对板号与件数';
  if (row.exception_type === 'MissingDocument') return 'Manifest 未冻结不得飞走归档';
  if (row.related_object_type === 'Task') return 'POD 双签前不得 Closed';
  return '需补齐阻断项后才可放行';
}

function inferRecoveryAction(row: Pick<StationExceptionDetailRow, 'exception_type' | 'root_cause' | 'related_object_type'>) {
  if (row.exception_type === 'PiecesMismatch') return '完成差异复核并更新理货结论';
  if (row.exception_type === 'MissingDocument') return '补齐缺失文件并完成对账';
  if (row.related_object_type === 'Task') return '补齐签收或执行证据后重新校验';
  return row.root_cause ?? '补齐异常恢复动作并重新校验';
}

async function assertRelatedObjectExists(db: D1DatabaseLike, objectType: string, objectId: string) {
  const mapping: Record<string, { field: string; table: string }> = {
    Flight: { table: 'flights', field: 'flight_id' },
    AWB: { table: 'awbs', field: 'awb_id' },
    Shipment: { table: 'shipments', field: 'shipment_id' },
    Task: { table: 'tasks', field: 'task_id' },
    Truck: { table: 'trucks', field: 'truck_id' }
  };

  const target = mapping[objectType];

  if (!target) {
    throw new RepositoryOperationError(400, 'VALIDATION_ERROR', 'Unsupported related object type', {
      related_object_type: objectType
    });
  }

  const row = await db
    .prepare(`SELECT ${target.field} AS id FROM ${target.table} WHERE ${target.field} = ? LIMIT 1`)
    .bind(objectId)
    .first<{ id: string }>();

  if (!row) {
    throw new RepositoryOperationError(404, 'RELATED_OBJECT_NOT_FOUND', 'Related object does not exist', {
      related_object_type: objectType,
      related_object_id: objectId
    });
  }
}

export function createRepositoryRegistry(options: RepositoryFactoryOptions = {}): RepositoryRegistry {
  if (!options.db) {
    return {
      flights: new PlaceholderFlightRepository(),
      waybills: new PlaceholderWaybillRepository(),
      documents: new PlaceholderDocumentRepository(),
      shipments: new PlaceholderShipmentRepository(),
      tasks: new PlaceholderTaskRepository(),
      exceptions: new PlaceholderExceptionRepository()
    };
  }

  const context = {
    actor: options.actor,
    requestId: options.requestId ?? createId('REQ')
  };

  return {
    flights: new D1FlightRepository(options.db, context.actor, context.requestId),
    waybills: new D1WaybillRepository(options.db, context.actor, context.requestId),
    documents: new D1DocumentRepository(options.db, context.actor, context.requestId),
    shipments: new D1ShipmentRepository(options.db, context.actor, context.requestId),
    tasks: new D1TaskRepository(options.db, context.actor, context.requestId),
    exceptions: new D1ExceptionRepository(options.db, context.actor, context.requestId)
  };
}
