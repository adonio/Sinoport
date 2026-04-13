import type { RoleCode } from '@sinoport/contracts';

export interface AgentToolDefinition {
  description: string;
  name: string;
  requiredRoles: RoleCode[];
}

export const agentToolCatalog: AgentToolDefinition[] = [
  {
    name: 'get_flight_context',
    description: 'Load inbound flight context for the current station view.',
    requiredRoles: ['station_supervisor', 'inbound_operator', 'check_worker', 'document_desk']
  },
  {
    name: 'list_blocking_documents',
    description: 'Return release-blocking documents for a flight or AWB.',
    requiredRoles: ['station_supervisor', 'document_desk', 'check_worker']
  },
  {
    name: 'list_open_exceptions',
    description: 'Return open exceptions for the current object context.',
    requiredRoles: ['station_supervisor', 'inbound_operator', 'check_worker', 'delivery_desk']
  },
  {
    name: 'request_task_assignment',
    description: 'Request a task assignment through the formal business API.',
    requiredRoles: ['station_supervisor']
  },
  {
    name: 'get_object_audit',
    description: 'Load object-level audit events and state transitions for the focused object.',
    requiredRoles: ['station_supervisor', 'document_desk', 'check_worker', 'delivery_desk']
  },
  {
    name: 'get_outbound_flight_context',
    description: 'Load outbound flight context for planning, manifest, and release actions.',
    requiredRoles: ['station_supervisor', 'document_desk', 'inbound_operator']
  },
  {
    name: 'get_outbound_waybill_context',
    description: 'Load outbound AWB context for receipt, loading, and exception review.',
    requiredRoles: ['station_supervisor', 'document_desk', 'delivery_desk']
  }
];

export function listAgentToolsForRoles(roleIds: RoleCode[] = []) {
  const uniqueRoles = new Set(roleIds);
  return agentToolCatalog.filter((tool) => tool.requiredRoles.some((role) => uniqueRoles.has(role)));
}
