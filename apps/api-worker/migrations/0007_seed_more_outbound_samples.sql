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
) VALUES
  (
    'FLIGHT-SE600-2026-04-09-MME',
    'MME',
    'SE600',
    '2026-04-09',
    'MME',
    'CTU',
    '2026-04-10T00:10:00Z',
    'Scheduled',
    'P2',
    'MME outbound manifest sample'
  ),
  (
    'FLIGHT-URO913-2026-04-10-MME',
    'MME',
    'URO913',
    '2026-04-10',
    'MME',
    'LHR',
    '2026-04-10T01:20:00Z',
    'Pre-Departure',
    'P1',
    'MME outbound URO sample'
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
) VALUES
  ('SHIP-OUT-436-10347676', 'MME', 'export', 'Manifest Imported', 'Manifest Imported', '24h', 'P2', 4, 1763),
  ('SHIP-OUT-436-10347680', 'MME', 'export', 'Manifest Imported', 'Manifest Imported', '24h', 'P2', 4, 1538),
  ('SHIP-OUT-436-10358585', 'MME', 'export', 'Main AWB Completed', 'Main AWB Completed', '30h', 'P1', 50, 700),
  ('SHIP-OUT-436-10359044', 'MME', 'export', 'Main AWB Completed', 'Main AWB Completed', '30h', 'P1', 68, 1028);

INSERT OR IGNORE INTO awbs (
  awb_id,
  awb_no,
  shipment_id,
  flight_id,
  station_id,
  consignee_name,
  notify_name,
  pieces,
  gross_weight,
  current_node,
  noa_status,
  pod_status,
  transfer_status,
  manifest_status
) VALUES
  ('AWB-436-10347676', '436-10347676', 'SHIP-OUT-436-10347676', 'FLIGHT-SE600-2026-04-09-MME', 'MME', 'CTU CONSOL', 'CTU', 4, 1763, 'Manifest Imported', 'Pending', 'Pending', 'Pending', 'Imported'),
  ('AWB-436-10347680', '436-10347680', 'SHIP-OUT-436-10347680', 'FLIGHT-SE600-2026-04-09-MME', 'MME', 'CTU CONSOL', 'CTU', 4, 1538, 'Manifest Imported', 'Pending', 'Pending', 'Pending', 'Imported'),
  ('AWB-436-10358585-OUT', '436-10358585-OUT', 'SHIP-OUT-436-10358585', 'FLIGHT-URO913-2026-04-10-MME', 'MME', 'SMDG LOGISTICS', 'MME', 50, 700, 'Export Receipt', 'Pending', 'Pending', 'Pending', 'Draft'),
  ('AWB-436-10359044-OUT', '436-10359044-OUT', 'SHIP-OUT-436-10359044', 'FLIGHT-URO913-2026-04-10-MME', 'MME', 'MME FASHION HUB', 'MME', 68, 1028, 'Build-up', 'Pending', 'Pending', 'Pending', 'Draft');

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
  ('DOC-MANIFEST-SE600', 'MME', 'Manifest', 'SE600-MANIFEST-09APR.pdf', 'Shipment', 'SHIP-OUT-436-10347676', 'v1', 'Approved', 1, 'station/MME/documents/SE600/manifest-v1.pdf', 'demo-docdesk', 'SE600 manifest imported'),
  ('DOC-FFM-URO913', 'MME', 'FFM', 'URO913-FFM-10APR.docx', 'Flight', 'FLIGHT-URO913-2026-04-10-MME', 'v1', 'Approved', 1, 'station/MME/documents/URO913/ffm-v1.docx', 'demo-docdesk', 'URO913 ffm approved'),
  ('DOC-UWS-URO913', 'MME', 'UWS', 'URO913-UWS-10APR.xlsx', 'Flight', 'FLIGHT-URO913-2026-04-10-MME', 'v1', 'Uploaded', 1, 'station/MME/documents/URO913/uws-v1.xlsx', 'demo-docdesk', 'URO913 uws uploaded'),
  ('DOC-MAWB-436-10358585-OUT', 'MME', 'MAWB', '436-10358585-outbound.xlsx', 'AWB', 'AWB-436-10358585-OUT', 'v1', 'Approved', 1, 'station/MME/documents/URO913/mawb-436-10358585.xlsx', 'demo-docdesk', 'Outbound MAWB approved');

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
  ('TASK-0410-401', 'MME', '出港收货', 'Export Receipt', 'AWB', 'AWB-436-10358585-OUT', 'document_desk', 'TEAM-DD-01', 'WORKER-DOC-001', 'Completed', '2h', '2026-04-10T00:10:00Z', NULL, 1),
  ('TASK-0410-402', 'MME', '装机复核', 'Ramp Release', 'Flight', 'FLIGHT-URO913-2026-04-10-MME', 'station_supervisor', 'TEAM-IN-01', 'WORKER-SUP-001', 'Started', '1h', '2026-04-10T00:50:00Z', 'HG-01', 1);

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
  'EXP-0410-401',
  'MME',
  'MissingDocument',
  'Flight',
  'FLIGHT-URO913-2026-04-10-MME',
  'TASK-0410-402',
  'P1',
  'document_desk',
  'TEAM-DD-01',
  'Open',
  1,
  'UWS final revision still pending',
  'Wait for final UWS upload before loaded confirmation'
);
