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
  StationDocumentListItem,
  StationDocumentPreviewResult,
  StationExceptionDetail,
  StationExceptionListItem,
  StationShipmentDetail,
  StationShipmentListItem,
  StationTaskListItem,
  TaskWorkflowActionInput,
  TaskWorkflowActionResult
} from '@sinoport/contracts';
import type { RepositoryRegistry } from '@sinoport/repositories';

export interface StationServices {
  assignTask(taskId: string, input: AssignTaskInput): Promise<AssignTaskResult>;
  createDocument(input: CreateDocumentInput): Promise<CreateDocumentResult>;
  createUploadTicket(input: CreateUploadTicketInput): Promise<CreateUploadTicketResult>;
  getInboundFlight(flightId: string): Promise<InboundFlightDetail | null>;
  getInboundWaybill(awbId: string): Promise<InboundWaybillDetail | null>;
  getOutboundFlight(flightId: string): Promise<OutboundFlightDetail | null>;
  getOutboundWaybill(awbId: string): Promise<OutboundWaybillDetail | null>;
  getStationShipment(shipmentId: string): Promise<StationShipmentDetail | null>;
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
  resolveStationException(exceptionId: string, input: ResolveExceptionInput): Promise<ResolveExceptionResult>;
  listStationTasks(query: Record<string, string | undefined>): Promise<ListResponse<StationTaskListItem>>;
  processInboundNoa(awbId: string, input: NoaActionInput): Promise<NoaActionResult>;
  processInboundPod(awbId: string, input: PodActionInput): Promise<PodActionResult>;
  markOutboundLoaded(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult>;
  finalizeOutboundManifest(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult>;
  markOutboundAirborne(flightId: string, input: OutboundFlightActionInput): Promise<OutboundFlightActionResult>;
  raiseTaskException(taskId: string, input: RaiseTaskExceptionInput): Promise<RaiseTaskExceptionResult>;
}

export function createStationServices(repositories: RepositoryRegistry): StationServices {
  return {
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
    processInboundNoa(awbId, input) {
      return repositories.waybills.processInboundNoa(awbId, input);
    },
    processInboundPod(awbId, input) {
      return repositories.waybills.processInboundPod(awbId, input);
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
    getStationDocumentPreview(documentId) {
      return repositories.documents.getStationDocumentPreview(documentId);
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
    raiseTaskException(taskId, input) {
      return repositories.tasks.raiseTaskException(taskId, input);
    },
    listStationExceptions(query) {
      return repositories.exceptions.listStationExceptions(query);
    },
    getStationException(exceptionId) {
      return repositories.exceptions.getStationException(exceptionId);
    },
    resolveStationException(exceptionId, input) {
      return repositories.exceptions.resolveStationException(exceptionId, input);
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
