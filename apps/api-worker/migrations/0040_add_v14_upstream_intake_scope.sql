-- Keep the legacy Flight/Shipment/AWB projections unchanged. V1.4 ownership
-- is explicit so every intake can be tenant-scoped without partially adding
-- tenant columns to older station CRUD tables.
INSERT OR IGNORE INTO stations (
  station_id, station_name, region, control_level, phase,
  airport_code, icao_code, service_scope, owner_name
) VALUES (
  'SZX', '深圳前置仓控制站', '中国华南', 'strong_control', 'active',
  'SZX', 'ZGSZ', '前置仓收货、逐件清点、跨境卡车交接', 'SZX Station Lead'
);

CREATE TABLE IF NOT EXISTS v14_flight_tenant_scopes (
  flight_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flight_id) REFERENCES flights(flight_id),
  FOREIGN KEY (station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_v14_flight_scopes_tenant_station
  ON v14_flight_tenant_scopes(tenant_id, station_id, flight_id);

CREATE TABLE IF NOT EXISTS v14_awb_intakes (
  awb_intake_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  control_station_id TEXT NOT NULL,
  origin_execution_station_id TEXT NOT NULL DEFAULT 'SZX',
  shipment_id TEXT NOT NULL,
  awb_id TEXT NOT NULL,
  flight_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (control_station_id) REFERENCES stations(station_id),
  FOREIGN KEY (origin_execution_station_id) REFERENCES stations(station_id),
  FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id),
  FOREIGN KEY (awb_id) REFERENCES awbs(awb_id),
  FOREIGN KEY (flight_id) REFERENCES flights(flight_id),
  UNIQUE(tenant_id, awb_id)
);

CREATE INDEX IF NOT EXISTS idx_v14_awb_intakes_tenant_station
  ON v14_awb_intakes(tenant_id, control_station_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v14_awb_intakes_tenant_shipment
  ON v14_awb_intakes(tenant_id, shipment_id);

-- Historical station data belongs to the default tenant. Only flights that
-- already exist at migration time are backfilled; later v1.4 writers must
-- record their authenticated tenant explicitly.
INSERT OR IGNORE INTO v14_flight_tenant_scopes (
  flight_id, tenant_id, station_id, source_type, source_ref, created_by
)
SELECT flight_id, 'sinoport-demo', station_id, 'LEGACY_BACKFILL', flight_id, 'migration-0040'
FROM flights
WHERE deleted_at IS NULL;

INSERT OR IGNORE INTO v14_awb_intakes (
  awb_intake_id, tenant_id, control_station_id, origin_execution_station_id,
  shipment_id, awb_id, flight_id, source_type, source_ref, created_by
)
SELECT 'INTAKE-LEGACY-' || a.awb_id, 'sinoport-demo', a.station_id, 'SZX',
       a.shipment_id, a.awb_id, a.flight_id, 'LEGACY_BACKFILL', a.awb_no, 'migration-0040'
FROM awbs a
JOIN shipments s ON s.shipment_id = a.shipment_id
JOIN v14_flight_tenant_scopes fs
  ON fs.flight_id = a.flight_id AND fs.tenant_id = 'sinoport-demo' AND fs.station_id = a.station_id
WHERE a.deleted_at IS NULL AND a.flight_id IS NOT NULL;
