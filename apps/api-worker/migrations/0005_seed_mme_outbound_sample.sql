INSERT OR IGNORE INTO flights (
  flight_id,
  station_id,
  flight_no,
  flight_date,
  origin_code,
  destination_code,
  etd_at,
  runtime_status,
  service_level,
  notes
) VALUES (
  'FLIGHT-SE913-2026-04-09-MME',
  'MME',
  'SE913',
  '2026-04-09',
  'MME',
  'MST',
  '2026-04-09T22:30:00Z',
  'Pre-Departure',
  'P1',
  'MME outbound sample flight'
);

INSERT OR IGNORE INTO shipments (
  shipment_id,
  station_id,
  shipment_type,
  current_node,
  fulfillment_status,
  promise_sla,
  service_level,
  total_pieces,
  total_weight
) VALUES (
  'SHIP-OUT-436-10357583',
  'MME',
  'export',
  'Loaded Preparation',
  'Main AWB Completed',
  '36h',
  'P1',
  48,
  812
);

INSERT OR IGNORE INTO awbs (
  awb_id,
  awb_no,
  shipment_id,
  flight_id,
  station_id,
  consignee_name,
  pieces,
  gross_weight,
  current_node,
  noa_status,
  pod_status,
  transfer_status,
  manifest_status
) VALUES (
  'AWB-436-10357583',
  '436-10357583',
  'SHIP-OUT-436-10357583',
  'FLIGHT-SE913-2026-04-09-MME',
  'MME',
  'MST Hub',
  48,
  812,
  'Loaded Preparation',
  'Pending',
  'Pending',
  'Pending',
  'Draft'
);

INSERT OR IGNORE INTO documents (
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
  note
) VALUES
  (
    'DOC-FFM-SE913',
    'MME',
    'FFM',
    'SE913-FFM-09APR.docx',
    'Flight',
    'FLIGHT-SE913-2026-04-09-MME',
    'v1',
    'Approved',
    1,
    'station/MME/documents/SE913/ffm-v1.docx',
    'demo-docdesk',
    'Outbound FFM approved'
  ),
  (
    'DOC-UWS-SE913',
    'MME',
    'UWS',
    'SE913-UWS-09APR.xlsx',
    'Flight',
    'FLIGHT-SE913-2026-04-09-MME',
    'v1',
    'Uploaded',
    1,
    'station/MME/documents/SE913/uws-v1.xlsx',
    'demo-docdesk',
    'Outbound UWS uploaded'
  ),
  (
    'DOC-MANIFEST-SE913',
    'MME',
    'Manifest',
    'SE913-MANIFEST-09APR.pdf',
    'Shipment',
    'SHIP-OUT-436-10357583',
    'v2',
    'Uploaded',
    1,
    'station/MME/documents/SE913/manifest-v2.pdf',
    'demo-docdesk',
    'Manifest final version pending freeze'
  ),
  (
    'DOC-MAWB-436-10357583',
    'MME',
    'MAWB',
    '436-10357583-主单套打模板.xlsx',
    'AWB',
    'AWB-436-10357583',
    'v2',
    'Approved',
    1,
    'station/MME/documents/SE913/mawb-v2.xlsx',
    'demo-docdesk',
    'Outbound MAWB approved'
  );

INSERT OR IGNORE INTO tasks (
  task_id,
  station_id,
  task_type,
  execution_node,
  related_object_type,
  related_object_id,
  assigned_role,
  assigned_team_id,
  assigned_worker_id,
  task_status,
  task_sla,
  due_at,
  blocker_code,
  evidence_required
) VALUES
  (
    'TASK-0409-301',
    'MME',
    '出港收货',
    'Export Receipt',
    'AWB',
    'AWB-436-10357583',
    'document_desk',
    'TEAM-DD-01',
    'WORKER-DOC-001',
    'Completed',
    '2h',
    '2026-04-09T18:30:00Z',
    NULL,
    1
  ),
  (
    'TASK-0409-302',
    'MME',
    '装机复核',
    'Ramp Release',
    'Flight',
    'FLIGHT-SE913-2026-04-09-MME',
    'station_supervisor',
    'TEAM-IN-01',
    'WORKER-SUP-001',
    'Assigned',
    '1h',
    '2026-04-09T21:45:00Z',
    'HG-01',
    1
  );

INSERT OR IGNORE INTO exceptions (
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
  action_taken
) VALUES (
  'EXP-0409-301',
  'MME',
  'MissingDocument',
  'Shipment',
  'SHIP-OUT-436-10357583',
  'TASK-0409-302',
  'P1',
  'document_desk',
  'TEAM-DD-01',
  'Open',
  1,
  'Manifest 最终版待冻结',
  'Document desk to upload final manifest and supervisor to recheck release gate'
);
