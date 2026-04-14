export interface WorkflowDefinition {
  description: string;
  name: string;
  queue: string;
}

export const workflowCatalog: WorkflowDefinition[] = [
  {
    name: 'document-parse',
    queue: 'document-events',
    description: 'Parse uploaded documents and attach structured metadata.'
  },
  {
    name: 'document-validate',
    queue: 'document-events',
    description: 'Validate parsed documents against release gates and required fields.'
  },
  {
    name: 'station-summary-refresh',
    queue: 'analytics-refresh',
    description: 'Refresh station summary snapshots for dashboard and copilot consumption.'
  }
];

export function listWorkflowsForStationContext() {
  return workflowCatalog;
}
