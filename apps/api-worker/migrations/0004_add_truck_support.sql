CREATE TABLE IF NOT EXISTS trucks (
  truck_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  plate_no TEXT NOT NULL,
  driver_name TEXT,
  driver_phone TEXT,
  route_type TEXT,
  dispatch_status TEXT NOT NULL DEFAULT 'Planned',
  departure_at TEXT,
  arrival_at TEXT,
  cmr_id TEXT,
  pod_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_trucks_station_status ON trucks(station_id, dispatch_status);

INSERT OR IGNORE INTO trucks (
  truck_id,
  station_id,
  plate_no,
  driver_name,
  route_type,
  dispatch_status
) VALUES (
  'TRK-0406-018',
  'MME',
  'NL-TRK-018',
  'Sample Driver',
  'tailhaul',
  'Planned'
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
) VALUES (
  'DOC-POD-TRK-0406-018',
  'MME',
  'POD',
  'GOFONEW-020426-1 POD.pdf',
  'AWB',
  'AWB-436-10358585',
  'v1',
  'Missing',
  1,
  'station/MME/inbound/se803/pod-missing.pdf',
  'demo-docdesk',
  'Missing POD placeholder for closure gate'
);
