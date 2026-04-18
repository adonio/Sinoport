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
  OutboundFlightListItem,
  OutboundWaybillDetail,
  OutboundWaybillListItem,
  MobileTaskListItem,
  MobileTaskActionInput,
  MobileTaskActionResult,
  NoaActionInput,
  NoaActionResult,
  OutboundFlightActionInput,
  OutboundFlightActionResult,
  PodActionInput,
  PodActionResult,
  RaiseTaskExceptionInput
  ,
  RaiseTaskExceptionResult,
  ResolveExceptionInput,
  ResolveExceptionResult,
  StationFlightMutationResult,
  StationFlightUpdateInput,
  StationFlightWriteInput,
  StationWaybillMutationResult,
  StationWaybillUpdateInput,
  StationDocumentListItem,
  StationDocumentDetail,
  StationDocumentMutationResult,
  StationDocumentOptions,
  StationDocumentPreviewResult,
  StationDocumentUpdateInput,
  StationExceptionDetail,
  StationExceptionListItem,
  StationExceptionMutationResult,
  StationExceptionOptions,
  StationExceptionUpdateInput,
  StationShipmentDetail,
  StationShipmentListItem,
  StationTaskDetail,
  StationTaskListItem,
  StationTaskMutationResult,
  StationTaskOptions,
  StationTaskUpdateInput,
  TaskWorkflowActionInput,
  TaskWorkflowActionResult
} from '@sinoport/contracts';
import type { RepositoryRegistry } from '@sinoport/repositories';

export interface StationServices {
  assignTask(taskId: string, input: AssignTaskInput): Promise<AssignTaskResult>;
  archiveInboundFlight(flightId: string): Promise<StationFlightMutationResult>;
  archiveInboundWaybill(awbId: string): Promise<StationWaybillMutationResult>;
  archiveOutboundFlight(flightId: string): Promise<StationFlightMutationResult>;
  archiveOutboundWaybill(awbId: string): Promise<StationWaybillMutationResult>;
  createInboundFlight(input: StationFlightWriteInput): Promise<StationFlightMutationResult>;
  createOutboundFlight(input: StationFlightWriteInput): Promise<StationFlightMutationResult>;
  createDocument(input: CreateDocumentInput): Promise<CreateDocumentResult>;
  createUploadTicket(input: CreateUploadTicketInput): Promise<CreateUploadTicketResult>;
  getInboundFlight(flightId: string): Promise<InboundFlightDetail | null>;
  getInboundWaybill(awbId: string): Promise<InboundWaybillDetail | null>;
  getOutboundFlight(flightId: string): Promise<OutboundFlightDetail | null>;
  getOutboundWaybill(awbId: string): Promise<OutboundWaybillDetail | null>;
  getStationDocument(documentId: string): Promise<StationDocumentDetail | null>;
  listStationDocumentOptions(query: Record<string, string | undefined>): Promise<StationDocumentOptions>;
  getStationShipment(shipmentId: string): Promise<StationShipmentDetail | null>;
  getStationTask(taskId: string): Promise<StationTaskDetail | null>;
  listStationTaskOptions(query: Record<string, string | undefined>): Promise<StationTaskOptions>;
  listInboundFlights(query: InboundFlightListQuery): Promise<ListResponse<InboundFlightListItem>>;
  listInboundWaybills(query: Record<string, string | undefined>): Promise<ListResponse<InboundWaybillListItem>>;
  listOutboundFlights(query: Record<string, string | undefined>): Promise<ListResponse<OutboundFlightListItem>>;
  listOutboundWaybills(query: Record<string, string | undefined>): Promise<ListResponse<OutboundWaybillListItem>>;
  listStationDocuments(query: Record<string, string | undefined>): Promise<ListResponse<StationDocumentListItem>>;
  getStationDocumentPreview(documentId: string): Promise<StationDocumentPreviewResult | null>;
  listStationShipments(query: Record<string, string | undefined>): Promise<ListResponse<StationShipmentListItem>>;
  listMobileTasks(query: Record<string, string | undefined>): Promise<ListResponse<MobileTaskListItem>>;
  acceptMobileTask(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult>;
  startMobileTask(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult>;
  uploadMobileTaskEvidence(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult>;
  completeMobileTask(taskId: string, input: MobileTaskActionInput): Promise<MobileTaskActionResult>;
  verifyTask(taskId: string, input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult>;
  reworkTask(taskId: string, input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult>;
  escalateTask(taskId: string, input: TaskWorkflowActionInput): Promise<TaskWorkflowActionResult>;
  getStationException(exceptionId: string): Promise<StationExceptionDetail | null>;
  listStationExceptions(query: Record<string, string | undefined>): Promise<ListResponse<StationExceptionListItem>>;
  listStationExceptionOptions(query: Record<string, string | undefined>): Promise<StationExceptionOptions>;
  resolveStationException(exceptionId: string, input: ResolveExceptionInput): Promise<ResolveExceptionResult>;
  updateStationException(exceptionId: string, input: StationExceptionUpdateInput): Promise<StationExceptionMutationResult>;
  listStationTasks(query: Record<string, string | undefined>): Promise<ListResponse<StationTaskListItem>>;
  processInboundNoa(awbId: string, input: NoaActionInput): Promise<NoaActionResult>;
  processInboundPod(awbId: string, input: PodActionInput): Promise<PodActionResult>;
  updateInboundFlight(flightId: string, input: StationFlightUpdateInput): Promise<StationFlightMutationResult>;
  updateInboundWaybill(awbId: string, input: StationWaybillUpdateInput): Promise<StationWaybillMutationResult>;
  updateOutboundFlight(flightId: string, input: StationFlightUpdateInput): Promise<StationFlightMutationResult>;
  updateOutboundWaybill(awbId: string, input: StationWaybillUpdateInput): Promise<StationWaybillMutationResult>;
  updateStationDocument(documentId: string, input: StationDocumentUpdateInput): Promise<StationDocumentMutationResult>;
  markOutboundLoaded(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult>;
  finalizeOutboundManifest(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult>;
  markOutboundAirborne(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult>;
  raiseTaskException(taskId: string, input: RaiseTaskExceptionInput): Promise<RaiseTaskExceptionResult>;
  updateStationTask(taskId: string, input: StationTaskUpdateInput): Promise<StationTaskMutationResult>;
}

export function createStationServices(repositories: RepositoryRegistry): StationServices {
  return {
    createInboundFlight(input) {
      return repositories.flights.createInboundFlight(input);
    },
    createOutboundFlight(input) {
      return repositories.flights.createOutboundFlight(input);
    },
    listInboundFlights(query) {
      return repositories.flights.listInboundFlights(query);
    },
    getInboundFlight(flightId) {
      return repositories.flights.getInboundFlight(flightId);
    },
    listInboundWaybills(query) {
      return repositories.waybills.listInboundWaybills(query);
    },
    getInboundWaybill(awbId) {
      return repositories.waybills.getInboundWaybill(awbId);
    },
    listOutboundFlights(query) {
      return repositories.flights.listOutboundFlights(query);
    },
    getOutboundFlight(flightId) {
      return repositories.flights.getOutboundFlight(flightId);
    },
    listOutboundWaybills(query) {
      return repositories.waybills.listOutboundWaybills(query);
    },
    getOutboundWaybill(awbId) {
      return repositories.waybills.getOutboundWaybill(awbId);
    },
    listStationShipments(query) {
      return repositories.shipments.listStationShipments(query);
    },
    getStationShipment(shipmentId) {
      return repositories.shipments.getStationShipment(shipmentId);
    },
    getStationTask(taskId) {
      return repositories.tasks.getStationTask(taskId);
    },
    listStationTaskOptions(query) {
      return repositories.tasks.listStationTaskOptions(query);
    },
    processInboundNoa(awbId, input) {
      return repositories.waybills.processInboundNoa(awbId, input);
    },
    processInboundPod(awbId, input) {
      return repositories.waybills.processInboundPod(awbId, input);
    },
    updateInboundWaybill(awbId, input) {
      return repositories.waybills.updateInboundWaybill(awbId, input);
    },
    updateOutboundWaybill(awbId, input) {
      return repositories.waybills.updateOutboundWaybill(awbId, input);
    },
    updateInboundFlight(flightId, input) {
      return repositories.flights.updateInboundFlight(flightId, input);
    },
    updateOutboundFlight(flightId, input) {
      return repositories.flights.updateOutboundFlight(flightId, input);
    },
    archiveInboundFlight(flightId) {
      return repositories.flights.archiveInboundFlight(flightId);
    },
    archiveOutboundFlight(flightId) {
      return repositories.flights.archiveOutboundFlight(flightId);
    },
    archiveInboundWaybill(awbId) {
      return repositories.waybills.archiveInboundWaybill(awbId);
    },
    archiveOutboundWaybill(awbId) {
      return repositories.waybills.archiveOutboundWaybill(awbId);
    },
    createDocument(input) {
      return repositories.documents.createDocument(input);
    },
    createUploadTicket(input) {
      return repositories.documents.createUploadTicket(input);
    },
    listStationDocuments(query) {
      return repositories.documents.listStationDocuments(query);
    },
    listStationDocumentOptions(query) {
      return repositories.documents.listStationDocumentOptions(query);
    },
    getStationDocument(documentId) {
      return repositories.documents.getStationDocument(documentId);
    },
    getStationDocumentPreview(documentId) {
      return repositories.documents.getStationDocumentPreview(documentId);
    },
    updateStationDocument(documentId, input) {
      return repositories.documents.updateStationDocument(documentId, input);
    },
    acceptMobileTask(taskId, input) {
      return repositories.tasks.acceptMobileTask(taskId, input);
    },
    startMobileTask(taskId, input) {
      return repositories.tasks.startMobileTask(taskId, input);
    },
    uploadMobileTaskEvidence(taskId, input) {
      return repositories.tasks.uploadMobileTaskEvidence(taskId, input);
    },
    completeMobileTask(taskId, input) {
      return repositories.tasks.completeMobileTask(taskId, input);
    },
    verifyTask(taskId, input) {
      return repositories.tasks.verifyTask(taskId, input);
    },
    reworkTask(taskId, input) {
      return repositories.tasks.reworkTask(taskId, input);
    },
    escalateTask(taskId, input) {
      return repositories.tasks.escalateTask(taskId, input);
    },
    listStationTasks(query) {
      return repositories.tasks.listStationTasks(query);
    },
    assignTask(taskId, input) {
      return repositories.tasks.assignTask(taskId, input);
    },
    updateStationTask(taskId, input) {
      return repositories.tasks.updateStationTask(taskId, input);
    },
    raiseTaskException(taskId, input) {
      return repositories.tasks.raiseTaskException(taskId, input);
    },
    listStationExceptions(query) {
      return repositories.exceptions.listStationExceptions(query);
    },
    listStationExceptionOptions(query) {
      return repositories.exceptions.listStationExceptionOptions(query);
    },
    getStationException(exceptionId) {
      return repositories.exceptions.getStationException(exceptionId);
    },
    resolveStationException(exceptionId, input) {
      return repositories.exceptions.resolveStationException(exceptionId, input);
    },
    updateStationException(exceptionId, input) {
      return repositories.exceptions.updateStationException(exceptionId, input);
    },
    markOutboundLoaded(flightId, input) {
      return repositories.flights.markOutboundLoaded(flightId, input);
    },
    finalizeOutboundManifest(flightId, input) {
      return repositories.flights.finalizeOutboundManifest(flightId, input);
    },
    markOutboundAirborne(flightId, input) {
      return repositories.flights.markOutboundAirborne(flightId, input);
    },
    listMobileTasks(query) {
      return repositories.tasks.listMobileTasks(query);
    }
  };
}
