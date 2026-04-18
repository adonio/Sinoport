INSERT OR IGNORE INTO stations (
  station_id,
  station_name,
  region,
  control_level,
  phase
) VALUES (
  'MME',
  'Maastricht Sample Station',
  'Europe',
  'strong_control',
  'sample_priority'
);

INSERT OR IGNORE INTO users (
  user_id,
  tenant_id,
  display_name,
  email,
  default_station_id,
  worker_code
) VALUES
  ('demo-supervisor', 'sinoport-demo', 'MME Supervisor', 'supervisor@sinoport.local', 'MME', 'SUP-001'),
  ('demo-docdesk', 'sinoport-demo', 'Document Desk', 'docdesk@sinoport.local', 'MME', 'DOC-001'),
  ('demo-checker', 'sinoport-demo', 'Check Worker', 'checker@sinoport.local', 'MME', 'CHK-007'),
  ('demo-mobile', 'sinoport-demo', 'Inbound Mobile Operator', 'mobile@sinoport.local', 'MME', 'PDA-001');

INSERT OR IGNORE INTO user_roles (user_id, role_code, station_id) VALUES
  ('demo-supervisor', 'station_supervisor', 'MME'),
  ('demo-docdesk', 'document_desk', 'MME'),
  ('demo-checker', 'check_worker', 'MME'),
  ('demo-mobile', 'mobile_operator', 'MME'),
  ('demo-mobile', 'inbound_operator', 'MME');

INSERT OR IGNORE INTO teams (
  team_id,
  station_id,
  team_name,
  owner_name,
  shift_code,
  team_status
) VALUES
  ('TEAM-IN-01', 'MME', 'MME Inbound Team A', 'Inbound Supervisor', 'DAY', 'active'),
  ('TEAM-CK-01', 'MME', 'MME Check Desk', 'QA Lead', 'DAY', 'active'),
  ('TEAM-DD-01', 'MME', 'MME Delivery Desk', 'Delivery Supervisor', 'DAY', 'active');

INSERT OR IGNORE INTO workers (
  worker_id,
  user_id,
  station_id,
  team_id,
  worker_name,
  role_code,
  worker_status,
  can_verify,
  can_release
) VALUES
  ('WORKER-SUP-001', 'demo-supervisor', 'MME', 'TEAM-IN-01', 'MME Supervisor', 'station_supervisor', 'active', 1, 1),
  ('WORKER-DOC-001', 'demo-docdesk', 'MME', 'TEAM-DD-01', 'Document Desk', 'document_desk', 'active', 0, 1),
  ('WORKER-CK-007', 'demo-checker', 'MME', 'TEAM-CK-01', 'Check Worker', 'check_worker', 'active', 1, 0),
  ('WORKER-PDA-001', 'demo-mobile', 'MME', 'TEAM-IN-01', 'Inbound Mobile Operator', 'mobile_operator', 'active', 0, 0);
