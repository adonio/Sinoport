CREATE TABLE IF NOT EXISTS inbound_count_records (
  count_record_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  flight_no TEXT NOT NULL,
  awb_no TEXT NOT NULL,
  counted_boxes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '未开始',
  scanned_serials_json TEXT,
  note TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_count_unique
  ON inbound_count_records(station_id, flight_no, awb_no);

CREATE TABLE IF NOT EXISTS inbound_pallets (
  pallet_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  flight_no TEXT NOT NULL,
  pallet_no TEXT NOT NULL,
  pallet_status TEXT NOT NULL DEFAULT '计划',
  total_boxes INTEGER NOT NULL DEFAULT 0,
  total_weight REAL NOT NULL DEFAULT 0,
  storage_location TEXT,
  note TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_pallet_unique
  ON inbound_pallets(station_id, flight_no, pallet_no);

CREATE TABLE IF NOT EXISTS inbound_pallet_items (
  pallet_item_id TEXT PRIMARY KEY,
  pallet_id TEXT NOT NULL,
  awb_no TEXT NOT NULL,
  boxes INTEGER NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pallet_id) REFERENCES inbound_pallets(pallet_id)
);

CREATE TABLE IF NOT EXISTS loading_plans (
  loading_plan_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  flight_no TEXT NOT NULL,
  truck_plate TEXT NOT NULL,
  vehicle_model TEXT,
  driver_name TEXT,
  collection_note TEXT,
  forklift_driver TEXT,
  checker TEXT,
  arrival_time TEXT,
  depart_time TEXT,
  total_boxes INTEGER NOT NULL DEFAULT 0,
  total_weight REAL NOT NULL DEFAULT 0,
  plan_status TEXT NOT NULL DEFAULT '计划',
  note TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS loading_plan_items (
  loading_plan_item_id TEXT PRIMARY KEY,
  loading_plan_id TEXT NOT NULL,
  pallet_no TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loading_plan_id) REFERENCES loading_plans(loading_plan_id)
);

CREATE TABLE IF NOT EXISTS outbound_receipts (
  receipt_record_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  flight_no TEXT NOT NULL,
  awb_no TEXT NOT NULL,
  received_pieces INTEGER NOT NULL DEFAULT 0,
  received_weight REAL NOT NULL DEFAULT 0,
  receipt_status TEXT NOT NULL DEFAULT '待收货',
  note TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outbound_receipt_unique
  ON outbound_receipts(station_id, flight_no, awb_no);

CREATE TABLE IF NOT EXISTS outbound_containers (
  container_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  flight_no TEXT NOT NULL,
  container_code TEXT NOT NULL,
  total_boxes INTEGER NOT NULL DEFAULT 0,
  total_weight REAL NOT NULL DEFAULT 0,
  reviewed_weight REAL NOT NULL DEFAULT 0,
  container_status TEXT NOT NULL DEFAULT '待装机',
  loaded_at TEXT,
  note TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(station_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outbound_container_unique
  ON outbound_containers(station_id, flight_no, container_code);

CREATE TABLE IF NOT EXISTS outbound_container_items (
  container_item_id TEXT PRIMARY KEY,
  container_id TEXT NOT NULL,
  awb_no TEXT NOT NULL,
  pieces INTEGER NOT NULL DEFAULT 0,
  boxes INTEGER NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (container_id) REFERENCES outbound_containers(container_id)
);
