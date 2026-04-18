ALTER TABLE flights ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_flights_station_deleted ON flights(station_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_flights_station_no ON flights(station_id, flight_no);

CREATE TABLE IF NOT EXISTS station_flight_service_level_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_inbound_flight_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_outbound_flight_status_options (
  option_key TEXT PRIMARY KEY,
  option_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_disabled INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO station_flight_service_level_options (option_key, option_label, sort_order) VALUES
  ('P1', 'P1 / 紧急', 10),
  ('P2', 'P2 / 标准', 20),
  ('P3', 'P3 / 低优先级', 30);

INSERT OR IGNORE INTO station_inbound_flight_status_options (option_key, option_label, sort_order) VALUES
  ('Scheduled', '已计划', 10),
  ('Pre-Arrival', '待到达', 20),
  ('Landed', '已落地', 30),
  ('Delayed', '延误', 40),
  ('Diverted', '备降', 50),
  ('Cancelled', '取消', 60);

INSERT OR IGNORE INTO station_outbound_flight_status_options (option_key, option_label, sort_order) VALUES
  ('Scheduled', '已计划', 10),
  ('Pre-Departure', '待起飞', 20),
  ('Airborne', '已飞走', 30),
  ('Delayed', '延误', 40),
  ('Cancelled', '取消', 50);
