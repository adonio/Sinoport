import type { AuthActor } from '@sinoport/auth';
import type { D1DatabaseLike } from '@sinoport/repositories';

export class InboundBundleImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'InboundBundleImportError';
  }
}

type ImportDb = D1DatabaseLike & {
  exec?(query: string): Promise<unknown>;
  withSession?(constraintOrBookmark?: unknown): ImportDb;
};

type BundleInput = Record<string, unknown>;

interface NormalizedStation {
  stationId: string;
  stationName: string;
  region: string | null;
  controlLevel: string | null;
  phase: string | null;
}

interface NormalizedFlight {
  flightId: string;
  flightNo: string;
  flightDate: string;
  originCode: string;
  destinationCode: string;
  stdAt: string | null;
  etdAt: string | null;
  staAt: string | null;
  etaAt: string | null;
  actualTakeoffAt: string | null;
  actualLandedAt: string | null;
  runtimeStatus: string;
  serviceLevel: string | null;
  aircraftType: string | null;
  notes: string | null;
}

interface NormalizedShipment {
  shipmentId: string;
  stationId: string;
  orderId: string | null;
  shipmentType: string | null;
  currentNode: string;
  fulfillmentStatus: string;
  promiseSla: string | null;
  serviceLevel: string | null;
  totalPieces: number;
  totalWeight: number;
  exceptionCount: number;
  closedAt: string | null;
}

interface NormalizedAwb {
  awbId: string;
  awbNo: string;
  shipmentId: string;
  flightId: string;
  stationId: string;
  hawbNo: string | null;
  shipperName: string | null;
  consigneeName: string | null;
  notifyName: string | null;
  goodsDescription: string | null;
  pieces: number;
  grossWeight: number;
  currentNode: string;
  noaStatus: string;
  podStatus: string;
  transferStatus: string;
  manifestStatus: string | null;
}

interface NormalizedTask {
  taskId: string;
  stationId: string;
  taskType: string;
  executionNode: string;
  relatedObjectType: string;
  relatedObjectId: string;
  assignedRole: string | null;
  assignedTeamId: string | null;
  assignedWorkerId: string | null;
  pickLocationId: string | null;
  dropLocationId: string | null;
  taskStatus: string;
  taskSla: string | null;
  dueAt: string | null;
  blockerCode: string | null;
  evidenceRequired: number;
  completedAt: string | null;
  verifiedAt: string | null;
}

interface NormalizedBundle {
  requestId: string;
  station: NormalizedStation;
  flight: NormalizedFlight;
  shipments: NormalizedShipment[];
  awbs: NormalizedAwb[];
  tasks: NormalizedTask[];
  source: string | null;
}

interface ImportTableCounts {
  created: number;
  updated: number;
}

export interface InboundBundleImportResult {
  idempotency_status: 'executed' | 'replayed';
  request_id: string;
  station_id: string;
  flight_id: string;
  station: ImportTableCounts;
  flight: ImportTableCounts;
  shipments: ImportTableCounts;
  awbs: ImportTableCounts & { total: number };
  tasks: ImportTableCounts & { total: number };
  audit_events: ImportTableCounts;
}

interface StationRow {
  station_id: string;
  station_name: string;
  region: string | null;
  control_level: string | null;
  phase: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface FlightRow {
  flight_id: string;
  station_id: string;
  flight_no: string;
  flight_date: string;
  origin_code: string;
  destination_code: string;
  std_at: string | null;
  etd_at: string | null;
  sta_at: string | null;
  eta_at: string | null;
  actual_takeoff_at: string | null;
  actual_landed_at: string | null;
  runtime_status: string;
  service_level: string | null;
  aircraft_type: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ShipmentRow {
  shipment_id: string;
  station_id: string;
  order_id: string | null;
  shipment_type: string | null;
  current_node: string;
  fulfillment_status: string;
  promise_sla: string | null;
  service_level: string | null;
  total_pieces: number | null;
  total_weight: number | null;
  exception_count: number | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface AwbRow {
  awb_id: string;
  awb_no: string;
  shipment_id: string;
  flight_id: string | null;
  station_id: string;
  hawb_no: string | null;
  shipper_name: string | null;
  consignee_name: string | null;
  notify_name: string | null;
  goods_description: string | null;
  pieces: number;
  gross_weight: number;
  current_node: string;
  noa_status: string;
  pod_status: string;
  transfer_status: string;
  manifest_status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface TaskRow {
  task_id: string;
  station_id: string;
  task_type: string;
  execution_node: string;
  related_object_type: string;
  related_object_id: string;
  assigned_role: string | null;
  assigned_team_id: string | null;
  assigned_worker_id: string | null;
  pick_location_id: string | null;
  drop_location_id: string | null;
  task_status: string;
  task_sla: string | null;
  due_at: string | null;
  blocker_code: string | null;
  evidence_required: number | null;
  completed_at: string | null;
  verified_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ImportRequestRow {
  request_id: string;
  import_type: string;
  station_id: string | null;
  actor_id: string | null;
  status: string;
  target_object_type: string | null;
  target_object_id: string | null;
  payload_json: string | null;
  result_json: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
}

interface TaskTemplateInput {
  task_id?: unknown;
  task_type?: unknown;
  execution_node?: unknown;
  related_object_type?: unknown;
  related_object_id?: unknown;
  assigned_role?: unknown;
  assigned_team_id?: unknown;
  assigned_worker_id?: unknown;
  pick_location_id?: unknown;
  drop_location_id?: unknown;
  task_status?: unknown;
  task_sla?: unknown;
  due_at?: unknown;
  blocker_code?: unknown;
  evidence_required?: unknown;
  completed_at?: unknown;
  verified_at?: unknown;
}

interface ShipmentInput {
  shipment_id?: unknown;
  order_id?: unknown;
  shipment_type?: unknown;
  current_node?: unknown;
  fulfillment_status?: unknown;
  promise_sla?: unknown;
  service_level?: unknown;
  total_pieces?: unknown;
  total_weight?: unknown;
  exception_count?: unknown;
  closed_at?: unknown;
}

interface AwbInput {
  awb_id?: unknown;
  awb_no?: unknown;
  awbNo?: unknown;
  awb?: Record<string, unknown>;
  shipment_id?: unknown;
  shipmentId?: unknown;
  shipment?: ShipmentInput;
  hawb_no?: unknown;
  shipper_name?: unknown;
  consignee_name?: unknown;
  notify_name?: unknown;
  goods_description?: unknown;
  pieces?: unknown;
  gross_weight?: unknown;
  current_node?: unknown;
  noa_status?: unknown;
  pod_status?: unknown;
  transfer_status?: unknown;
  manifest_status?: unknown;
  tasks?: unknown;
  task?: TaskTemplateInput;
  task_template?: TaskTemplateInput;
}

function nowIso() {
  return new Date().toISOString();
}

function makeGeneratedId(prefix: string, value: string) {
  return `${prefix}-${value}`;
}

function normalizeToken(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stableTaskKey(value: string) {
  const token = normalizeToken(value);
  if (token) {
    return token.slice(0, 40);
  }

  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36).toUpperCase();
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function readTentativeStationId(input: BundleInput, actor: AuthActor) {
  const stationInput = input.station as Record<string, unknown> | undefined;
  return readString(stationInput?.station_id) ?? readString(input.station_id) ?? actor.stationScope?.[0] ?? undefined;
}

function readTentativeFlightId(input: BundleInput) {
  const flightInput = input.flight as Record<string, unknown> | undefined;
  return readString(flightInput?.flight_id) ?? readString(input.flight_id);
}

function requireString(value: unknown, field: string): string {
  const result = readString(value);
  if (!result) {
    throw new InboundBundleImportError('VALIDATION_ERROR', `${field} is required`, { field });
  }

  return result;
}

function readNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 1 || value === '1' || value === 'true' || value === 'TRUE') {
    return true;
  }

  if (value === 0 || value === '0' || value === 'false' || value === 'FALSE') {
    return false;
  }

  return undefined;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readDate(value: unknown): string | undefined {
  const result = readString(value);
  return result && /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : undefined;
}

function readIsoString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = readString(value);
    if (!result) {
      continue;
    }

    const parsed = Date.parse(result);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return undefined;
}

function chooseString(...values: unknown[]) {
  for (const value of values) {
    const result = readString(value);
    if (result) {
      return result;
    }
  }

  return undefined;
}

function toDbBoolean(value: boolean | undefined, fallback: number) {
  return typeof value === 'boolean' ? (value ? 1 : 0) : fallback;
}

function buildFlightId(stationId: string, flightNo: string, flightDate: string) {
  return makeGeneratedId('FLIGHT', `${normalizeToken(flightNo)}-${flightDate}-${normalizeToken(stationId)}`);
}

function buildShipmentId(stationId: string, awbNo: string) {
  return makeGeneratedId('SHIP', `${normalizeToken(stationId)}-${normalizeToken(awbNo)}`);
}

function buildAwbId(awbNo: string) {
  return makeGeneratedId('AWB', normalizeToken(awbNo));
}

function buildTaskId(stationId: string, awbNo: string, taskType: string, index: number) {
  return makeGeneratedId('TASK', `${normalizeToken(stationId)}-${normalizeToken(awbNo)}-${stableTaskKey(taskType)}-${index + 1}`);
}

function normalizeStation(input: BundleInput, actor: AuthActor): NormalizedStation {
  const stationObject = readObject(input.station);
  const stationId = chooseString(input.station_id, input.stationId, stationObject.station_id, stationObject.stationId, actor.stationScope[0]);

  if (!stationId) {
    throw new InboundBundleImportError('VALIDATION_ERROR', 'station_id is required', { field: 'station_id' });
  }

  const stationName = chooseString(stationObject.station_name, stationObject.stationName, input.station_name, input.stationName, stationId) ?? stationId;

  return {
    stationId: stationId.trim(),
    stationName,
    region: chooseString(stationObject.region, input.region) ?? null,
    controlLevel: chooseString(stationObject.control_level, stationObject.controlLevel, input.control_level, input.controlLevel) ?? null,
    phase: chooseString(stationObject.phase, input.phase) ?? null
  };
}

function normalizeFlight(input: BundleInput, station: NormalizedStation): NormalizedFlight {
  const flightObject = readObject(input.flight);
  const flightNo = requireString(chooseString(flightObject.flight_no, flightObject.flightNo, input.flight_no, input.flightNo), 'flight.flight_no');
  const flightDate = requireString(readDate(chooseString(flightObject.flight_date, flightObject.flightDate, input.flight_date, input.flightDate)), 'flight.flight_date');
  const flightId = chooseString(flightObject.flight_id, flightObject.flightId, input.flight_id, input.flightId) ?? buildFlightId(station.stationId, flightNo, flightDate);

  return {
    flightId,
    flightNo,
    flightDate,
    originCode: requireString(chooseString(flightObject.origin_code, flightObject.originCode, input.origin_code, input.originCode), 'flight.origin_code').toUpperCase(),
    destinationCode: requireString(
      chooseString(flightObject.destination_code, flightObject.destinationCode, input.destination_code, input.destinationCode),
      'flight.destination_code'
    ).toUpperCase(),
    stdAt: readIsoString(chooseString(flightObject.std_at, flightObject.stdAt, input.std_at, input.stdAt)) ?? null,
    etdAt: readIsoString(chooseString(flightObject.etd_at, flightObject.etdAt, input.etd_at, input.etdAt)) ?? null,
    staAt: readIsoString(chooseString(flightObject.sta_at, flightObject.staAt, input.sta_at, input.staAt)) ?? null,
    etaAt: readIsoString(chooseString(flightObject.eta_at, flightObject.etaAt, input.eta_at, input.etaAt)) ?? null,
    actualTakeoffAt: readIsoString(chooseString(flightObject.actual_takeoff_at, flightObject.actualTakeoffAt, input.actual_takeoff_at, input.actualTakeoffAt)) ?? null,
    actualLandedAt: readIsoString(chooseString(flightObject.actual_landed_at, flightObject.actualLandedAt, input.actual_landed_at, input.actualLandedAt)) ?? null,
    runtimeStatus: chooseString(flightObject.runtime_status, flightObject.runtimeStatus, input.runtime_status, input.runtimeStatus) ?? 'Landed',
    serviceLevel: chooseString(flightObject.service_level, flightObject.serviceLevel, input.service_level, input.serviceLevel) ?? null,
    aircraftType: chooseString(flightObject.aircraft_type, flightObject.aircraftType, input.aircraft_type, input.aircraftType) ?? null,
    notes: chooseString(flightObject.notes, input.notes) ?? null
  };
}

function normalizeShipment(input: AwbInput, stationId: string, awbNo: string, fallbackPieces: number, fallbackWeight: number): NormalizedShipment {
  const shipmentObject = readObject(input.shipment);
  const shipmentId = chooseString(input.shipment_id, shipmentObject.shipment_id, shipmentObject.shipmentId) ?? buildShipmentId(stationId, awbNo);

  return {
    shipmentId,
    stationId,
    orderId: chooseString(shipmentObject.order_id, shipmentObject.orderId) ?? null,
    shipmentType: chooseString(shipmentObject.shipment_type, shipmentObject.shipmentType) ?? 'import',
    currentNode: chooseString(shipmentObject.current_node, shipmentObject.currentNode) ?? 'Inbound Handling',
    fulfillmentStatus: chooseString(shipmentObject.fulfillment_status, shipmentObject.fulfillmentStatus) ?? 'Inbound Handling',
    promiseSla: chooseString(shipmentObject.promise_sla, shipmentObject.promiseSla) ?? null,
    serviceLevel: chooseString(shipmentObject.service_level, shipmentObject.serviceLevel) ?? null,
    totalPieces: readNumber(shipmentObject.total_pieces, shipmentObject.totalPieces) ?? fallbackPieces,
    totalWeight: readNumber(shipmentObject.total_weight, shipmentObject.totalWeight) ?? fallbackWeight,
    exceptionCount: readNumber(shipmentObject.exception_count, shipmentObject.exceptionCount) ?? 0,
    closedAt: readIsoString(shipmentObject.closed_at, shipmentObject.closedAt) ?? null
  };
}

function normalizeAwb(input: AwbInput, stationId: string, flightId: string, shipment: NormalizedShipment): NormalizedAwb {
  const awbNo = requireString(chooseString(input.awb_no, input.awbNo), 'awb_no');
  const awbObject = readObject(input.awb);
  const awbId = chooseString(input.awb_id, awbObject.awb_id, awbObject.awbId) ?? buildAwbId(awbNo);
  const pieces = readNumber(chooseString(input.pieces, awbObject.pieces)) ?? shipment.totalPieces;
  const grossWeight = readNumber(chooseString(input.gross_weight, awbObject.gross_weight, awbObject.grossWeight)) ?? shipment.totalWeight;

  if (!Number.isFinite(pieces) || !Number.isFinite(grossWeight) || pieces <= 0 || grossWeight <= 0) {
    throw new InboundBundleImportError('VALIDATION_ERROR', `awb ${awbNo} requires pieces and gross_weight`, {
      awb_no: awbNo
    });
  }

  return {
    awbId,
    awbNo,
    shipmentId: shipment.shipmentId,
    flightId,
    stationId,
    hawbNo: chooseString(input.hawb_no, awbObject.hawb_no, awbObject.hawbNo) ?? null,
    shipperName: chooseString(input.shipper_name, awbObject.shipper_name, awbObject.shipperName) ?? null,
    consigneeName: chooseString(input.consignee_name, awbObject.consignee_name, awbObject.consigneeName) ?? null,
    notifyName: chooseString(input.notify_name, awbObject.notify_name, awbObject.notifyName) ?? null,
    goodsDescription: chooseString(input.goods_description, awbObject.goods_description, awbObject.goodsDescription) ?? null,
    pieces,
    grossWeight,
    currentNode: chooseString(input.current_node, awbObject.current_node, awbObject.currentNode) ?? shipment.currentNode,
    noaStatus: chooseString(input.noa_status, awbObject.noa_status, awbObject.noaStatus) ?? 'Pending',
    podStatus: chooseString(input.pod_status, awbObject.pod_status, awbObject.podStatus) ?? 'Pending',
    transferStatus: chooseString(input.transfer_status, awbObject.transfer_status, awbObject.transferStatus) ?? 'Pending',
    manifestStatus: chooseString(input.manifest_status, awbObject.manifest_status, awbObject.manifestStatus) ?? null
  };
}

function normalizeTaskTemplate(input: TaskTemplateInput | undefined, stationId: string, awbId: string, awbNo: string, index: number): NormalizedTask {
  const taskType = chooseString(input?.task_type) ?? '到港收货';
  const executionNode = chooseString(input?.execution_node) ?? 'Inbound Handling';
  const relatedObjectType = chooseString(input?.related_object_type) ?? 'AWB';
  const relatedObjectId = chooseString(input?.related_object_id) ?? awbId;

  return {
    taskId:
      chooseString(input?.task_id) ??
      buildTaskId(stationId, awbNo, taskType, index),
    stationId,
    taskType,
    executionNode,
    relatedObjectType,
    relatedObjectId,
    assignedRole: chooseString(input?.assigned_role) ?? 'document_desk',
    assignedTeamId: chooseString(input?.assigned_team_id) ?? null,
    assignedWorkerId: chooseString(input?.assigned_worker_id) ?? null,
    pickLocationId: chooseString(input?.pick_location_id) ?? null,
    dropLocationId: chooseString(input?.drop_location_id) ?? null,
    taskStatus: chooseString(input?.task_status) ?? 'Created',
    taskSla: chooseString(input?.task_sla) ?? null,
    dueAt: readIsoString(input?.due_at) ?? null,
    blockerCode: chooseString(input?.blocker_code) ?? null,
    evidenceRequired: toDbBoolean(readBoolean(input?.evidence_required), 1),
    completedAt: readIsoString(input?.completed_at) ?? null,
    verifiedAt: readIsoString(input?.verified_at) ?? null
  };
}

function normalizeBundleInput(input: BundleInput, actor: AuthActor, requestId: string): NormalizedBundle {
  const station = normalizeStation(input, actor);
  const flight = normalizeFlight(input, station);
  const awbInputs = readArray(input.awbs).length ? readArray(input.awbs) : readArray(input.items);

  if (!awbInputs.length) {
    throw new InboundBundleImportError('VALIDATION_ERROR', 'awbs is required', { field: 'awbs' });
  }

  const awbs = awbInputs.map((item, index) => {
    const awbInput = readObject(item) as AwbInput;
    const awbNo = requireString(chooseString(awbInput.awb_no, awbInput.awbNo), `awbs[${index}].awb_no`);
    const shipment = normalizeShipment(awbInput, station.stationId, awbNo, readNumber(awbInput.pieces) ?? 0, readNumber(awbInput.gross_weight) ?? 0);
    return normalizeAwb(awbInput, station.stationId, flight.flightId, shipment);
  });

  const shipments = new Map<string, NormalizedShipment>();
  const tasks: NormalizedTask[] = [];
  const taskTemplate = readObject(input.task_template) as TaskTemplateInput;

  for (const [index, rawItem] of awbInputs.entries()) {
    const awbInput = readObject(rawItem) as AwbInput;
    const normalizedAwb = awbs[index];
    const awbNo = requireString(chooseString(awbInput.awb_no, awbInput.awbNo), 'awb_no');
    const shipment = normalizeShipment(awbInput, station.stationId, awbNo, readNumber(awbInput.pieces) ?? 0, readNumber(awbInput.gross_weight) ?? 0);
    shipments.set(shipment.shipmentId, shipment);

    const taskInputs = readArray(awbInput.tasks);
    const explicitTasks = taskInputs.length
      ? taskInputs.map((task, taskIndex) => normalizeTaskTemplate(readObject(task) as TaskTemplateInput, station.stationId, normalizedAwb.awbId, awbNo, taskIndex))
      : [];

    const template = readObject(awbInput.task_template) as TaskTemplateInput;
    const fallbackTemplate = explicitTasks.length
      ? []
      : [normalizeTaskTemplate({ ...taskTemplate, ...template }, station.stationId, normalizedAwb.awbId, awbNo, 0)];

    tasks.push(...explicitTasks, ...fallbackTemplate);
  }

  return {
    requestId,
    station,
    flight,
    shipments: Array.from(shipments.values()),
    awbs,
    tasks,
    source: chooseString(input.source, input.client_source, input.clientSource) ?? null
  };
}

async function selectOne<T>(db: ImportDb, query: string, params: unknown[] = []) {
  return (await db.prepare(query).bind(...params).first<T>()) as T | null;
}

async function runInTransaction<T>(db: ImportDb, handler: (tx: ImportDb) => Promise<T>): Promise<T> {
  const runtimeDb = db as ImportDb & { withSession?(constraintOrBookmark?: unknown): ImportDb };
  const sessionDb = typeof runtimeDb.withSession === 'function' ? runtimeDb.withSession() : db;

  return handler(sessionDb);
}

async function upsertStation(db: ImportDb, station: NormalizedStation): Promise<ImportTableCounts> {
  const existing = await selectOne<StationRow>(db, `SELECT * FROM stations WHERE station_id = ? LIMIT 1`, [station.stationId]);
  const now = nowIso();

  await db
    .prepare(
      `
        INSERT INTO stations (
          station_id,
          station_name,
          region,
          control_level,
          phase,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(station_id) DO UPDATE SET
          station_name = excluded.station_name,
          region = excluded.region,
          control_level = excluded.control_level,
          phase = excluded.phase,
          updated_at = excluded.updated_at
      `
    )
    .bind(
      station.stationId,
      station.stationName,
      station.region,
      station.controlLevel,
      station.phase,
      existing?.created_at ?? now,
      now
    )
    .run();

  return {
    created: existing ? 0 : 1,
    updated: existing ? 1 : 0
  };
}

async function upsertFlight(db: ImportDb, flight: NormalizedFlight, stationId: string): Promise<ImportTableCounts> {
  const existing = await selectOne<FlightRow>(
    db,
    `
      SELECT *
      FROM flights
      WHERE flight_id = ?
         OR (station_id = ? AND flight_no = ? AND flight_date = ?)
      LIMIT 1
    `,
    [flight.flightId, stationId, flight.flightNo, flight.flightDate]
  );
  const now = nowIso();

  await db
    .prepare(
      `
        INSERT INTO flights (
          flight_id,
          station_id,
          flight_no,
          flight_date,
          origin_code,
          destination_code,
          std_at,
          etd_at,
          sta_at,
          eta_at,
          actual_takeoff_at,
          actual_landed_at,
          runtime_status,
          service_level,
          aircraft_type,
          notes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(flight_id) DO UPDATE SET
          station_id = excluded.station_id,
          flight_no = excluded.flight_no,
          flight_date = excluded.flight_date,
          origin_code = excluded.origin_code,
          destination_code = excluded.destination_code,
          std_at = excluded.std_at,
          etd_at = excluded.etd_at,
          sta_at = excluded.sta_at,
          eta_at = excluded.eta_at,
          actual_takeoff_at = excluded.actual_takeoff_at,
          actual_landed_at = excluded.actual_landed_at,
          runtime_status = excluded.runtime_status,
          service_level = excluded.service_level,
          aircraft_type = excluded.aircraft_type,
          notes = excluded.notes,
          updated_at = excluded.updated_at
      `
    )
    .bind(
      flight.flightId,
      stationId,
      flight.flightNo,
      flight.flightDate,
      flight.originCode,
      flight.destinationCode,
      flight.stdAt,
      flight.etdAt,
      flight.staAt,
      flight.etaAt,
      flight.actualTakeoffAt,
      flight.actualLandedAt,
      flight.runtimeStatus,
      flight.serviceLevel,
      flight.aircraftType,
      flight.notes,
      existing?.created_at ?? now,
      now
    )
    .run();

  return {
    created: existing ? 0 : 1,
    updated: existing ? 1 : 0
  };
}

async function upsertShipment(db: ImportDb, shipment: NormalizedShipment): Promise<ImportTableCounts> {
  const existing = await selectOne<ShipmentRow>(db, `SELECT * FROM shipments WHERE shipment_id = ? LIMIT 1`, [shipment.shipmentId]);
  const now = nowIso();

  await db
    .prepare(
      `
        INSERT INTO shipments (
          shipment_id,
          station_id,
          order_id,
          shipment_type,
          current_node,
          fulfillment_status,
          promise_sla,
          service_level,
          total_pieces,
          total_weight,
          exception_count,
          closed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(shipment_id) DO UPDATE SET
          station_id = excluded.station_id,
          order_id = excluded.order_id,
          shipment_type = excluded.shipment_type,
          current_node = excluded.current_node,
          fulfillment_status = excluded.fulfillment_status,
          promise_sla = excluded.promise_sla,
          service_level = excluded.service_level,
          total_pieces = excluded.total_pieces,
          total_weight = excluded.total_weight,
          exception_count = excluded.exception_count,
          closed_at = excluded.closed_at,
          updated_at = excluded.updated_at
      `
    )
    .bind(
      shipment.shipmentId,
      shipment.stationId,
      shipment.orderId,
      shipment.shipmentType,
      shipment.currentNode,
      shipment.fulfillmentStatus,
      shipment.promiseSla,
      shipment.serviceLevel,
      shipment.totalPieces,
      shipment.totalWeight,
      shipment.exceptionCount,
      shipment.closedAt,
      existing?.created_at ?? now,
      now
    )
    .run();

  return {
    created: existing ? 0 : 1,
    updated: existing ? 1 : 0
  };
}

async function upsertAwb(db: ImportDb, awb: NormalizedAwb): Promise<ImportTableCounts> {
  const existing = await selectOne<AwbRow>(db, `SELECT * FROM awbs WHERE awb_no = ? LIMIT 1`, [awb.awbNo]);
  const now = nowIso();

  await db
    .prepare(
      `
        INSERT INTO awbs (
          awb_id,
          awb_no,
          shipment_id,
          flight_id,
          station_id,
          hawb_no,
          shipper_name,
          consignee_name,
          notify_name,
          goods_description,
          pieces,
          gross_weight,
          current_node,
          noa_status,
          pod_status,
          transfer_status,
          manifest_status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(awb_id) DO UPDATE SET
          awb_no = excluded.awb_no,
          shipment_id = excluded.shipment_id,
          flight_id = excluded.flight_id,
          station_id = excluded.station_id,
          hawb_no = excluded.hawb_no,
          shipper_name = excluded.shipper_name,
          consignee_name = excluded.consignee_name,
          notify_name = excluded.notify_name,
          goods_description = excluded.goods_description,
          pieces = excluded.pieces,
          gross_weight = excluded.gross_weight,
          current_node = excluded.current_node,
          noa_status = excluded.noa_status,
          pod_status = excluded.pod_status,
          transfer_status = excluded.transfer_status,
          manifest_status = excluded.manifest_status,
          updated_at = excluded.updated_at
      `
    )
    .bind(
      existing?.awb_id ?? awb.awbId,
      awb.awbNo,
      awb.shipmentId,
      awb.flightId,
      awb.stationId,
      awb.hawbNo,
      awb.shipperName,
      awb.consigneeName,
      awb.notifyName,
      awb.goodsDescription,
      awb.pieces,
      awb.grossWeight,
      awb.currentNode,
      awb.noaStatus,
      awb.podStatus,
      awb.transferStatus,
      awb.manifestStatus,
      existing?.created_at ?? now,
      now
    )
    .run();

  return {
    created: existing ? 0 : 1,
    updated: existing ? 1 : 0
  };
}

async function upsertTask(db: ImportDb, task: NormalizedTask): Promise<ImportTableCounts> {
  const existing = await selectOne<TaskRow>(db, `SELECT * FROM tasks WHERE task_id = ? LIMIT 1`, [task.taskId]);
  const now = nowIso();

  await db
    .prepare(
      `
        INSERT INTO tasks (
          task_id,
          station_id,
          task_type,
          execution_node,
          related_object_type,
          related_object_id,
          assigned_role,
          assigned_team_id,
          assigned_worker_id,
          pick_location_id,
          drop_location_id,
          task_status,
          task_sla,
          due_at,
          blocker_code,
          evidence_required,
          completed_at,
          verified_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          station_id = excluded.station_id,
          task_type = excluded.task_type,
          execution_node = excluded.execution_node,
          related_object_type = excluded.related_object_type,
          related_object_id = excluded.related_object_id,
          assigned_role = excluded.assigned_role,
          assigned_team_id = excluded.assigned_team_id,
          assigned_worker_id = excluded.assigned_worker_id,
          pick_location_id = excluded.pick_location_id,
          drop_location_id = excluded.drop_location_id,
          task_status = excluded.task_status,
          task_sla = excluded.task_sla,
          due_at = excluded.due_at,
          blocker_code = excluded.blocker_code,
          evidence_required = excluded.evidence_required,
          completed_at = excluded.completed_at,
          verified_at = excluded.verified_at,
          updated_at = excluded.updated_at
      `
    )
    .bind(
      existing?.task_id ?? task.taskId,
      task.stationId,
      task.taskType,
      task.executionNode,
      task.relatedObjectType,
      task.relatedObjectId,
      task.assignedRole,
      task.assignedTeamId,
      task.assignedWorkerId,
      task.pickLocationId,
      task.dropLocationId,
      task.taskStatus,
      task.taskSla,
      task.dueAt,
      task.blockerCode,
      task.evidenceRequired,
      task.completedAt,
      task.verifiedAt,
      existing?.created_at ?? now,
      now
    )
    .run();

  return {
    created: existing ? 0 : 1,
    updated: existing ? 1 : 0
  };
}

async function insertAuditEvent(db: ImportDb, params: {
  requestId: string;
  actor: AuthActor;
  stationId: string;
  flightId: string;
  payload: Record<string, unknown>;
}) {
  const auditId = `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

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
      params.requestId,
      params.actor.userId,
      params.actor.roleIds[0] ?? 'station_supervisor',
      params.actor.clientSource,
      'STATION_INBOUND_BUNDLE_IMPORTED',
      'Flight',
      params.flightId,
      params.stationId,
      `Inbound bundle imported for ${params.stationId}`,
      JSON.stringify(params.payload),
      nowIso()
    )
    .run();

  return auditId;
}

const INBOUND_BUNDLE_IMPORT_TYPE = 'station_inbound_bundle';

function parseStoredImportResult(value: string | null | undefined): InboundBundleImportResult | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as InboundBundleImportResult;
  } catch {
    return null;
  }
}

async function selectImportRequest(db: ImportDb, requestId: string) {
  return await selectOne<ImportRequestRow>(
    db,
    `
      SELECT *
      FROM import_requests
      WHERE request_id = ?
        AND import_type = ?
      LIMIT 1
    `,
    [requestId, INBOUND_BUNDLE_IMPORT_TYPE]
  );
}

async function upsertImportRequest(
  db: ImportDb,
  requestId: string,
  actor: AuthActor,
  status: 'pending' | 'completed' | 'failed',
  patch: Partial<Pick<ImportRequestRow, 'station_id' | 'target_object_type' | 'target_object_id' | 'payload_json' | 'result_json' | 'error_code' | 'error_message' | 'completed_at'>>
) {
  const now = nowIso();

  await db
    .prepare(
      `
        INSERT INTO import_requests (
          request_id,
          import_type,
          station_id,
          actor_id,
          status,
          target_object_type,
          target_object_id,
          payload_json,
          result_json,
          error_code,
          error_message,
          created_at,
          updated_at,
          completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(request_id, import_type) DO UPDATE SET
          station_id = excluded.station_id,
          actor_id = excluded.actor_id,
          status = excluded.status,
          target_object_type = excluded.target_object_type,
          target_object_id = excluded.target_object_id,
          payload_json = excluded.payload_json,
          result_json = excluded.result_json,
          error_code = excluded.error_code,
          error_message = excluded.error_message,
          updated_at = excluded.updated_at,
          completed_at = excluded.completed_at
      `
    )
    .bind(
      requestId,
      INBOUND_BUNDLE_IMPORT_TYPE,
      patch.station_id ?? null,
      actor.userId,
      status,
      patch.target_object_type ?? null,
      patch.target_object_id ?? null,
      patch.payload_json ?? null,
      patch.result_json ?? null,
      patch.error_code ?? null,
      patch.error_message ?? null,
      now,
      now,
      patch.completed_at ?? null
    )
    .run();
}

export async function importInboundBundle(db: ImportDb, actor: AuthActor, rawInput: unknown, requestIdInput?: string) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    throw new InboundBundleImportError('VALIDATION_ERROR', 'request body must be a JSON object');
  }

  const input = rawInput as BundleInput;
  const requestId = readString(requestIdInput) ?? readString(input.request_id) ?? readString(input.requestId) ?? crypto.randomUUID();
  const existingRequest = await selectImportRequest(db, requestId);

  if (existingRequest?.status === 'completed') {
    const storedResult = parseStoredImportResult(existingRequest.result_json);

    if (storedResult) {
      return {
        ...storedResult,
        idempotency_status: 'replayed'
      } satisfies InboundBundleImportResult;
    }
  }

  if (existingRequest?.status === 'pending') {
    throw new InboundBundleImportError('IMPORT_IN_PROGRESS', 'An inbound bundle import with this request_id is already running', {
      request_id: requestId
    });
  }

  let normalized: NormalizedBundle;

  try {
    normalized = normalizeBundleInput(input, actor, requestId);
  } catch (error) {
    await upsertImportRequest(db, requestId, actor, 'failed', {
      station_id: readTentativeStationId(input, actor) ?? null,
      target_object_type: 'Flight',
      target_object_id: readTentativeFlightId(input) ?? null,
      payload_json: JSON.stringify(input),
      error_code: error instanceof InboundBundleImportError ? error.code : 'IMPORT_FAILED',
      error_message: error instanceof Error ? error.message : 'Inbound bundle import failed'
    });

    throw error;
  }

  const counts = {
    station: { created: 0, updated: 0 },
    flight: { created: 0, updated: 0 },
    shipments: { created: 0, updated: 0 },
    awbs: { created: 0, updated: 0 },
    tasks: { created: 0, updated: 0 },
    audit_events: { created: 0, updated: 0 }
  };
  const result = {
    idempotency_status: 'executed',
    request_id: normalized.requestId,
    station_id: normalized.station.stationId,
    flight_id: normalized.flight.flightId,
    station: counts.station,
    flight: counts.flight,
    shipments: counts.shipments,
    awbs: {
      ...counts.awbs,
      total: normalized.awbs.length
    },
    tasks: {
      ...counts.tasks,
      total: normalized.tasks.length
    },
    audit_events: counts.audit_events
  } satisfies InboundBundleImportResult;

  await upsertImportRequest(db, normalized.requestId, actor, 'pending', {
    station_id: normalized.station.stationId,
    target_object_type: 'Flight',
    target_object_id: normalized.flight.flightId,
    payload_json: JSON.stringify({
      source: normalized.source,
      station: normalized.station,
      flight: normalized.flight,
      awb_total: normalized.awbs.length,
      task_total: normalized.tasks.length
    })
  });

  try {
    await runInTransaction(db, async (tx) => {
      counts.station = await upsertStation(tx, normalized.station);
      counts.flight = await upsertFlight(tx, normalized.flight, normalized.station.stationId);

      for (const shipment of normalized.shipments) {
        const shipmentResult = await upsertShipment(tx, shipment);
        counts.shipments = {
          created: counts.shipments.created + shipmentResult.created,
          updated: counts.shipments.updated + shipmentResult.updated
        };
      }

      for (const awb of normalized.awbs) {
        const awbResult = await upsertAwb(tx, awb);
        counts.awbs = {
          created: counts.awbs.created + awbResult.created,
          updated: counts.awbs.updated + awbResult.updated
        };
      }

      for (const task of normalized.tasks) {
        const taskResult = await upsertTask(tx, task);
        counts.tasks = {
          created: counts.tasks.created + taskResult.created,
          updated: counts.tasks.updated + taskResult.updated
        };
      }

      await insertAuditEvent(tx, {
        requestId: normalized.requestId,
        actor,
        stationId: normalized.station.stationId,
        flightId: normalized.flight.flightId,
        payload: {
          source: normalized.source,
          station: normalized.station,
          flight: normalized.flight,
          created: counts,
          awb_total: normalized.awbs.length,
          task_total: normalized.tasks.length
        }
      });

      counts.audit_events = { created: 1, updated: 0 };
    });

    result.station = counts.station;
    result.flight = counts.flight;
    result.shipments = counts.shipments;
    result.awbs = {
      ...counts.awbs,
      total: normalized.awbs.length
    };
    result.tasks = {
      ...counts.tasks,
      total: normalized.tasks.length
    };
    result.audit_events = counts.audit_events;

    await upsertImportRequest(db, normalized.requestId, actor, 'completed', {
      station_id: normalized.station.stationId,
      target_object_type: 'Flight',
      target_object_id: normalized.flight.flightId,
      payload_json: JSON.stringify({
        source: normalized.source,
        station: normalized.station,
        flight: normalized.flight,
        awb_total: normalized.awbs.length,
        task_total: normalized.tasks.length
      }),
      result_json: JSON.stringify(result),
      error_code: null,
      error_message: null,
      completed_at: nowIso()
    });

    return result;
  } catch (error) {
    await upsertImportRequest(db, normalized.requestId, actor, 'failed', {
      station_id: normalized.station.stationId,
      target_object_type: 'Flight',
      target_object_id: normalized.flight.flightId,
      payload_json: JSON.stringify({
        source: normalized.source,
        station: normalized.station,
        flight: normalized.flight,
        awb_total: normalized.awbs.length,
        task_total: normalized.tasks.length
      }),
      error_code: error instanceof InboundBundleImportError ? error.code : 'IMPORT_FAILED',
      error_message: error instanceof Error ? error.message : 'Inbound bundle import failed'
    });

    throw error;
  }
}
