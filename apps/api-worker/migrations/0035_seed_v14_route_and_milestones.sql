INSERT OR IGNORE INTO route_templates (
  route_template_id, route_template_code, version_no, status, origin_code, destination_code,
  origin_airport_code, cn_exit_port_code, kz_entry_port_code, port_pair_code,
  alternate_port_allowed, domestic_corridor_codes_json, kz_corridor_codes_json,
  schedule_source_status, schedule_approval_status, distance_validation_status,
  geofence_validation_status, operation_mode_validation_status, created_by, retired_at
) VALUES
  (
    'ROUTE-SZX-HORGOS-TAS-LGG-V1', 'SZX_HORGOS_TAS_LGG_V1', 1, 'RETIRED', 'SZX', 'LGG',
    'TAS', 'HORGOS', 'KHORGOS', 'HORGOS_KHORGOS', 0, '[]', '[]',
    'LEGACY', 'RETIRED', 'TO_BE_CONFIRMED', 'TO_BE_CONFIRMED', 'TO_BE_CONFIRMED',
    'system-v14-seed', CURRENT_TIMESTAMP
  ),
  (
    'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V1', 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V1', 1, 'RETIRED', 'SZX', 'LGG',
    'TAS', 'ALASHANKOU', 'DOSTYK', 'ALASHANKOU_DOSTYK', 0, '[]', '[]',
    'LEGACY', 'RETIRED', 'TO_BE_CONFIRMED', 'TO_BE_CONFIRMED', 'TO_BE_CONFIRMED',
    'system-v14-seed', CURRENT_TIMESTAMP
  ),
  (
    'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2', 2, 'PUBLISHED', 'SZX', 'LGG',
    'TAS', 'ALASHANKOU', 'DOSTYK', 'ALASHANKOU_DOSTYK', 0,
    '["SZX","CSX","WUH","XIY","LHW","JGN","HMI","URC","KUITUN","JINGHE","ALASHANKOU"]',
    '["DOSTYK","ALA","TARAZ","SHYMKENT","YALLAMA"]',
    'OCC_MANUAL_BASELINE', 'APPROVED_FOR_PILOT', 'TO_BE_CONFIRMED', 'TO_BE_CONFIRMED', 'TO_BE_CONFIRMED',
    'system-v14-seed', NULL
  );

UPDATE route_templates
SET source_document_refs_json = '["Sinoport_OS_前置仓_卡车节点_TAS机场清点_系统开发指南_v1_4.md"]',
    reviewed_by = 'v14-guide-owner',
    published_by = CASE WHEN status = 'PUBLISHED' THEN 'v14-guide-owner' ELSE published_by END,
    published_at = CASE WHEN status = 'PUBLISHED' THEN CURRENT_TIMESTAMP ELSE published_at END
WHERE route_template_id = 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2';

INSERT OR IGNORE INTO checkpoint_templates (
  checkpoint_template_id, route_template_id, route_template_version, checkpoint_code,
  name_zh, name_en, sequence, checkpoint_type, timezone, planned_offset_minutes,
  warning_before_minutes, late_after_minutes, stale_location_minutes, confirmation_policy,
  required_fields_json, required_evidence_types_json, blocking_policy
) VALUES
  ('CP-V2-SZX-LOAD', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'PREWH_ARRIVED_FOR_LOADING', '到达深圳前置仓', 'Arrived at SZX pre-warehouse', 10, 'WAREHOUSE', 'Asia/Shanghai', -13020, 60, 30, 60, 'MANUAL_CONFIRM', '["occurred_at","vehicle_plate"]', '["ARRIVAL_PHOTO"]', 'HARD'),
  ('CP-V2-SZX-DEP', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'SZX_TRUCK_DEPARTED', '深圳真实发车', 'Actual truck departure from SZX', 20, 'WAREHOUSE', 'Asia/Shanghai', -12960, 60, 30, 30, 'DUAL_CONFIRM', '["occurred_at","departure_receipt_ref","first_valid_gps_event_id"]', '["WAREHOUSE_RELEASE_RECEIPT","GPS"]', 'HARD'),
  ('CP-V2-CSX', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'CSX_PASSED', '长沙节点', 'Changsha checkpoint', 30, 'ROAD', 'Asia/Shanghai', -12240, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at","place_name"]', '[]', 'NONE'),
  ('CP-V2-WUH', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'WUH_PASSED', '武汉节点', 'Wuhan checkpoint', 40, 'ROAD', 'Asia/Shanghai', -11940, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at","place_name"]', '[]', 'NONE'),
  ('CP-V2-XIY', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'XIY_PASSED', '西安节点', 'Xian checkpoint', 50, 'ROAD', 'Asia/Shanghai', -11280, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at","place_name"]', '[]', 'NONE'),
  ('CP-V2-LHW', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'LHW_PASSED', '兰州节点', 'Lanzhou checkpoint', 60, 'ROAD', 'Asia/Shanghai', -10800, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at","place_name"]', '[]', 'NONE'),
  ('CP-V2-JGN', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'JGN_PASSED', '嘉峪关节点', 'Jiayuguan checkpoint', 70, 'ROAD', 'Asia/Shanghai', -10200, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at","place_name"]', '[]', 'NONE'),
  ('CP-V2-HMI', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'HMI_PASSED', '哈密节点', 'Hami checkpoint', 80, 'ROAD', 'Asia/Urumqi', -9720, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at","place_name"]', '[]', 'NONE'),
  ('CP-V2-URC', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'URC_PASSED', '乌鲁木齐节点', 'Urumqi checkpoint', 90, 'ROAD', 'Asia/Urumqi', -9240, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at","place_name"]', '[]', 'NONE'),
  ('CP-V2-KUITUN', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'KUITUN_PASSED', '奎屯节点', 'Kuitun checkpoint', 100, 'ROAD', 'Asia/Urumqi', -9060, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at","place_name"]', '[]', 'NONE'),
  ('CP-V2-JINGHE', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'JINGHE_PRE_ALERT', '精河预报', 'Jinghe pre-alert', 110, 'ROAD', 'Asia/Urumqi', -9000, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at","agent_confirmation"]', '["PRE_ALERT_ACK"]', 'SOFT'),
  ('CP-V2-ALASHANKOU', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'ALASHANKOU_ARRIVED', '阿拉山口到场', 'Arrived at Alashankou', 120, 'BORDER_CN', 'Asia/Urumqi', -8760, 120, 120, 30, 'DUAL_CONFIRM', '["occurred_at","queue_no"]', '["GATE_IN_EVIDENCE"]', 'HARD'),
  ('CP-V2-CN-EXIT', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'CHINA_EXIT_CONFIRMED', '中国出境', 'China exit confirmed', 130, 'BORDER_CN', 'Asia/Urumqi', -7320, 120, 120, 30, 'DUAL_CONFIRM', '["occurred_at","gate_decision_id"]', '["CN_RELEASE","CMR","SEAL_PHOTO"]', 'HARD'),
  ('CP-V2-DOSTYK-ARR', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'DOSTYK_ARRIVED', '多斯特克到场', 'Arrived at Dostyk', 140, 'BORDER_KZ', 'Asia/Almaty', -6900, 120, 120, 30, 'DUAL_CONFIRM', '["occurred_at"]', '["ARRIVAL_EVIDENCE"]', 'HARD'),
  ('CP-V2-DOSTYK-DEP', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'DOSTYK_DEPARTED', '多斯特克交接发车', 'Departed Dostyk', 150, 'BORDER_KZ', 'Asia/Almaty', -6600, 120, 120, 30, 'DUAL_CONFIRM', '["occurred_at","gate_decision_id"]', '["KZ_RELEASE","CUSTODY_TRANSFER"]', 'HARD'),
  ('CP-V2-ALA', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'ALA_PASSED', '阿拉木图节点', 'Almaty checkpoint', 160, 'ROAD', 'Asia/Almaty', -5760, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at"]', '[]', 'NONE'),
  ('CP-V2-TARAZ', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'TARAZ_PASSED', '塔拉兹节点', 'Taraz checkpoint', 170, 'ROAD', 'Asia/Almaty', -4920, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at"]', '[]', 'NONE'),
  ('CP-V2-SHYMKENT', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'SHYMKENT_PASSED', '奇姆肯特节点', 'Shymkent checkpoint', 180, 'ROAD', 'Asia/Almaty', -4440, 120, 120, 60, 'MANUAL_CONFIRM', '["occurred_at"]', '[]', 'NONE'),
  ('CP-V2-YALLAMA', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'YALLAMA_ARRIVED', 'Yallama节点', 'Yallama checkpoint', 190, 'BORDER', 'Asia/Tashkent', -4200, 120, 120, 30, 'DUAL_CONFIRM', '["occurred_at","queue_status"]', '["QUEUE_EVIDENCE"]', 'HARD'),
  ('CP-V2-UZ-REL', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'UZ_RELEASED', '乌方放行', 'Uzbekistan release', 200, 'BORDER', 'Asia/Tashkent', -3720, 120, 120, 30, 'DUAL_CONFIRM', '["occurred_at"]', '["RELEASE_EVIDENCE"]', 'HARD'),
  ('CP-V2-TAS-STAGING', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'TAS_STAGING_ARRIVED', 'TAS待接收区到场', 'Arrived at TAS staging', 210, 'AIRPORT_STAGING', 'Asia/Tashkent', -3600, 120, 120, 30, 'DUAL_CONFIRM', '["occurred_at"]', '["ARRIVAL_PHOTO"]', 'HARD');

INSERT OR IGNORE INTO milestone_definitions (
  milestone_definition_id, route_template_id, template_version, milestone_code,
  name_zh, name_en, sequence, stage_code, anchor_event_type, offset_minutes,
  deadline_type, closure_expression, owner_role, execution_party_role, next_owner_role,
  responsibility_scope, source_document_ref, source_section_ref, validation_status,
  gate_code, freeze_next_gate_on_red, required_fields_json, required_evidence_types_json
) VALUES
  ('MS-V2-BUSINESS-312', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'CAPACITY_PLAN_RECEIVED', '舱位与收货计划', 'Capacity and receiving plan', 10, 'A1', 'FLIGHT_ETD', -18720, 'TARGET', 'payload_complete', 'A1_CARGO_CONTROLLER', 'BUSINESS', 'A1_CARGO_CONTROLLER', 'A_B', 'v1.4-guide', '5.0', 'ACTIVE', 'OCC_CARGO_POOL_INPUT_GATE', 0, '["flight_id","planned_capacity"]', '[]'),
  ('MS-V2-BUSINESS-288', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'BOOKING_INPUT_RECEIVED', '订舱输入', 'Booking input received', 20, 'A1', 'FLIGHT_ETD', -17280, 'TARGET', 'payload_complete', 'A1_CARGO_CONTROLLER', 'BUSINESS', 'A1_CARGO_CONTROLLER', 'A_B', 'v1.4-guide', '5.0', 'ACTIVE', 'OCC_CARGO_POOL_INPUT_GATE', 0, '["customer","pieces","weight"]', '[]'),
  ('MS-V2-BUSINESS-276', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'ACCEPTANCE_DECISION_RECEIVED', '初审输入', 'Acceptance decision received', 30, 'A1', 'FLIGHT_ETD', -16560, 'TARGET', 'payload_complete', 'A1_CARGO_CONTROLLER', 'BUSINESS', 'A1_CARGO_CONTROLLER', 'A_B', 'v1.4-guide', '5.0', 'ACTIVE', 'OCC_CARGO_POOL_INPUT_GATE', 0, '["decision","evidence"]', '["ACCEPTANCE_EVIDENCE"]'),
  ('MS-V2-BUSINESS-264', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'CARGO_POOL_PUBLISHED', '航班货物池', 'Flight cargo pool published', 40, 'A1', 'FLIGHT_ETD', -15840, 'HARD_DEADLINE', 'cargo_pool_published', 'A1_CARGO_CONTROLLER', 'BUSINESS', 'A1_CARGO_CONTROLLER', 'A_B', 'v1.4-guide', '5.0', 'ACTIVE', 'OCC_CARGO_POOL_INPUT_GATE', 1, '["cargo_pool_version"]', '[]'),
  ('MS-V2-BUSINESS-240', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'CARGO_POOL_ROLLING_UPDATE', '滚动真实货量', 'Rolling actual cargo update', 50, 'A1', 'FLIGHT_ETD', -14400, 'TARGET', 'update_recorded', 'A1_CARGO_CONTROLLER', 'BUSINESS', 'A1_CARGO_CONTROLLER', 'A_B', 'v1.4-guide', '5.0', 'ACTIVE', NULL, 0, '["pieces","weight"]', '[]'),
  ('MS-V2-SZX-DEP', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'SZX_TRUCK_DEPARTED', '深圳真实发车', 'Actual SZX truck departure', 60, 'A1', 'FLIGHT_ETD', -12960, 'HARD_DEADLINE', 'departure_receipt_and_valid_gps', 'A1_CARGO_CONTROLLER', 'PREWH_OPERATOR', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'A_B', 'v1.4-guide', '2A.4', 'ACTIVE', 'A1_A2_DEPARTURE_GATE', 1, '["actual_departure_at","first_valid_gps_event_id"]', '["WAREHOUSE_RELEASE_RECEIPT","GPS"]'),
  ('MS-V2-ALASHANKOU', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'ALASHANKOU_ARRIVED', '阿拉山口到场', 'Arrived Alashankou', 70, 'A2', 'FLIGHT_ETD', -8760, 'HARD_DEADLINE', 'arrival_evidence_complete', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'ALASHANKOU_AGENT', 'A3_CROSS_BORDER_CONTROLLER', 'A_B', 'v1.4-guide', '2A.6', 'ACTIVE', 'ALASHANKOU_ENTRY_GATE', 1, '["actual_cn_arrival_at"]', '["GATE_IN_EVIDENCE"]'),
  ('MS-V2-CN-EXIT', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'CHINA_EXIT_CONFIRMED', '中国出境', 'China exit confirmed', 80, 'A3', 'FLIGHT_ETD', -7320, 'HARD_DEADLINE', 'china_exit_gate_passed', 'A3_CROSS_BORDER_CONTROLLER', 'ALASHANKOU_AGENT', 'A3_CROSS_BORDER_CONTROLLER', 'A_B', 'v1.4-guide', '2A.6', 'ACTIVE', 'CHINA_EXIT_GATE', 1, '["cn_exit_at"]', '["CN_RELEASE","CMR","SEAL_PHOTO"]'),
  ('MS-V2-DOSTYK-DEP', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'DOSTYK_DEPARTED', '多斯特克交接发车', 'Departed Dostyk', 90, 'A3', 'FLIGHT_ETD', -6600, 'HARD_DEADLINE', 'dostyk_departure_gate_passed', 'A3_CROSS_BORDER_CONTROLLER', 'DOSTYK_AGENT', 'A3_CROSS_BORDER_CONTROLLER', 'A_B', 'v1.4-guide', '2A.6', 'ACTIVE', 'DOSTYK_DEPARTURE_GATE', 1, '["dostyk_departure_at"]', '["KZ_RELEASE","CUSTODY_TRANSFER"]'),
  ('MS-V2-YALLAMA', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'YALLAMA_ARRIVED', 'Yallama到场', 'Arrived Yallama', 100, 'A3', 'FLIGHT_ETD', -4200, 'HARD_DEADLINE', 'arrival_evidence_complete', 'A3_CROSS_BORDER_CONTROLLER', 'TRUCK_OPERATOR', 'A3_CROSS_BORDER_CONTROLLER', 'A_B', 'v1.4-guide', '2A.7', 'ACTIVE', NULL, 1, '["actual_completed_at"]', '["QUEUE_EVIDENCE"]'),
  ('MS-V2-UZ-REL', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'UZ_RELEASED', '乌方放行', 'Uzbekistan released', 110, 'A3', 'FLIGHT_ETD', -3720, 'HARD_DEADLINE', 'release_evidence_complete', 'A3_CROSS_BORDER_CONTROLLER', 'TRUCK_OPERATOR', 'A3_CROSS_BORDER_CONTROLLER', 'A_B', 'v1.4-guide', '2A.7', 'ACTIVE', NULL, 1, '["actual_completed_at"]', '["RELEASE_EVIDENCE"]'),
  ('MS-V2-TAS-STAGING', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'TAS_STAGING_ARRIVED', 'TAS待接收区到场', 'Arrived TAS staging', 120, 'A3', 'FLIGHT_ETD', -3600, 'HARD_DEADLINE', 'arrival_only', 'A3_CROSS_BORDER_CONTROLLER', 'TRUCK_OPERATOR', 'B1_TAS_STATION_CONTROLLER', 'A_B', 'v1.4-guide', '7.1', 'ACTIVE', NULL, 1, '["actual_completed_at"]', '["ARRIVAL_PHOTO"]'),
  ('MS-V2-TAS-RECEIVE', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'TAS_RECEIVING_STARTED', 'TAS正式收货', 'TAS receiving started', 130, 'B1', 'FLIGHT_ETD', -1080, 'HARD_DEADLINE', 'b1_confirmed_receiving', 'B1_TAS_STATION_CONTROLLER', 'TAS_OPERATOR', 'B1_TAS_STATION_CONTROLLER', 'A_B', 'v1.4-guide', '7.1', 'ACTIVE', 'TAS_AIRPORT_RECEIPT_GATE', 1, '["actual_started_at"]', '[]'),
  ('MS-V2-LAST-TRUCK', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'TAS_LAST_TRUCK_ARRIVED', 'TAS最后一车到达', 'Last truck arrived TAS', 140, 'B1', 'FLIGHT_ETD', -480, 'HARD_DEADLINE', 'all_trucks_arrived', 'B1_TAS_STATION_CONTROLLER', 'TAS_OPERATOR', 'B1_TAS_STATION_CONTROLLER', 'A_B', 'v1.4-guide', '2A.8', 'ACTIVE', NULL, 1, '["actual_completed_at"]', '["ARRIVAL_EVIDENCE"]'),
  ('MS-V2-BUILDUP', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'TAS_BUILDUP_COMPLETED', '组板完成目标', 'Buildup completion target', 150, 'B1', 'FLIGHT_ETD', -360, 'TARGET', 'buildup_complete', 'B1_TAS_STATION_CONTROLLER', 'TAS_OPERATOR', 'B1_TAS_STATION_CONTROLLER', 'A_B', 'v1.4-guide', '2A.8', 'ACTIVE', 'DATA_GATE_C', 0, '["buildup_pieces"]', '["ULD_BUILDUP_EVIDENCE"]'),
  ('MS-V2-FREEZE', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'MANIFEST_FROZEN', 'Manifest数据冻结', 'Manifest data frozen', 160, 'B1', 'FLIGHT_ETD', -240, 'HARD_DEADLINE', 'cargo_master_frozen', 'B1_TAS_STATION_CONTROLLER', 'DQC_DATA_QUALITY_CONTROLLER', 'B1_TAS_STATION_CONTROLLER', 'A_B', 'v1.4-guide', '2A.8', 'ACTIVE', 'DATA_GATE_D', 1, '["record_hash"]', '["MANIFEST"]'),
  ('MS-V2-AIRLINE', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'ULD_HANDED_TO_AIRLINE', '全部ULD交航司', 'All ULD handed to airline', 170, 'B1', 'FLIGHT_ETD', -180, 'HARD_DEADLINE', 'all_uld_handed_over', 'B1_TAS_STATION_CONTROLLER', 'TAS_OPERATOR', 'B1_TAS_STATION_CONTROLLER', 'A_B', 'v1.4-guide', '2A.8', 'ACTIVE', 'DATA_GATE_D', 1, '["handed_to_airline_pieces"]', '["AIRLINE_HANDOVER"]'),
  ('MS-V2-LOADED', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'AIRCRAFT_LOADING_COMPLETED', '装机完成', 'Aircraft loading completed', 180, 'B1', 'FLIGHT_ETD', -60, 'HARD_DEADLINE', 'manifest_matches_loaded', 'B1_TAS_STATION_CONTROLLER', 'AIRLINE', 'B2_FLIGHT_MONITOR', 'A_B', 'v1.4-guide', '2A.8', 'ACTIVE', 'DATA_GATE_E', 1, '["loaded_pieces"]', '["LOAD_CONFIRMATION"]'),
  ('MS-V2-TAS-DEP', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'TAS_ACTUAL_DEP', 'TAS实际起飞', 'Actual departure TAS', 190, 'B1', 'FLIGHT_ETD', 0, 'HARD_DEADLINE', 'departure_confirmed_and_handover_accepted', 'B1_TAS_STATION_CONTROLLER', 'AIRLINE', 'B2_FLIGHT_MONITOR', 'A_B', 'v1.4-guide', '2A.8', 'ACTIVE', 'TAS_FLIGHT_DEPARTURE_GATE', 1, '["actual_completed_at"]', '["DEP_CONFIRMATION"]'),
  ('MS-V2-LGG-ATA', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'LGG_ATA_CONFIRMED', 'LGG到达', 'LGG arrival confirmed', 200, 'B2', 'FLIGHT_ETD', 420, 'HARD_DEADLINE', 'ata_and_arrival_package_complete', 'B2_FLIGHT_MONITOR', 'AIRLINE', 'OBI_OVERSEAS_INTERFACE', 'A_B', 'v1.4-guide', '2A.12', 'ACTIVE', 'B2_OBI_HANDOVER_GATE', 1, '["actual_completed_at"]', '["ARRIVAL_PACKAGE"]'),
  ('MS-V2-BUP', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'SMDG_BUP_PICKUP', 'SMDG BUP提取', 'SMDG BUP pickup', 210, 'OBI', 'FLIGHT_ETD', 1680, 'OBSERVATION', 'external_status_with_evidence', 'OBI_OVERSEAS_INTERFACE', 'SMDG', 'OBI_OVERSEAS_INTERFACE', 'C_D', 'v1.4-guide', '2A.12', 'TO_BE_CONFIRMED', NULL, 0, '["source_contact_entry_id"]', '["SMDG_STATUS_EVIDENCE"]'),
  ('MS-V2-CUSTOMS', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'SMDG_CUSTOMS_STATUS', 'SMDG清关状态', 'SMDG customs status', 220, 'OBI', 'FLIGHT_ETD', 2100, 'OBSERVATION', 'external_status_with_evidence', 'OBI_OVERSEAS_INTERFACE', 'SMDG', 'OBI_OVERSEAS_INTERFACE', 'C_D', 'v1.4-guide', '2A.12', 'TO_BE_CONFIRMED', NULL, 0, '["source_contact_entry_id"]', '["SMDG_STATUS_EVIDENCE"]'),
  ('MS-V2-POD', 'ROUTE-SZX-ALASHANKOU-DOSTYK-TAS-LGG-V2', 2, 'SMDG_POD', 'SMDG POD', 'SMDG proof of delivery', 230, 'OBI', 'FLIGHT_ETD', 2880, 'OBSERVATION', 'external_status_with_evidence', 'OBI_OVERSEAS_INTERFACE', 'SMDG', 'OBI_OVERSEAS_INTERFACE', 'C_D', 'v1.4-guide', '2A.12', 'TO_BE_CONFIRMED', NULL, 0, '["source_contact_entry_id"]', '["POD"]');

INSERT OR IGNORE INTO port_service_calendars (
  calendar_id, port_pair_code, version_no, valid_from, valid_to, timezone_cn, timezone_kz,
  open_days_json, daily_windows_json, appointment_required, source_type, source_ref,
  next_verify_at, status
) VALUES (
  'CAL-ALASHANKOU-DOSTYK-PILOT-V1', 'ALASHANKOU_DOSTYK', 1,
  '2026-01-01T00:00:00+08:00', '2027-12-31T23:59:59+05:00',
  'Asia/Urumqi', 'Asia/Almaty', '[1,2,3,4,5,6,7]', '[]', 1,
  'V14_PILOT_SEED', 'Requires business confirmation before production',
  '2026-08-05T00:00:00Z', 'UNKNOWN'
);
