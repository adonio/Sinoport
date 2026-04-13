-- Password for all seeded local users: Sinoport123!
INSERT OR IGNORE INTO station_credentials (
  user_id,
  password_hash,
  login_name
) VALUES
  ('demo-supervisor', '$2b$10$ptPJ.METGpXWl3EaU56OS.HY8g1xNp0AnoBpi1HczV3e98LJCl.Cu', 'supervisor@sinoport.local'),
  ('demo-docdesk', '$2b$10$yF6mgRsooD5FBmPKmiJ5.OJsvbDFTtxOeCbwLRhlnVD4eeZzvv/.y', 'docdesk@sinoport.local'),
  ('demo-checker', '$2b$10$NYNT4m5ni/ifcQsML4.QleLG/KufR04vPRYJcSRdPB0ov5T0KhFnO', 'checker@sinoport.local'),
  ('demo-mobile', '$2b$10$jtZg/RlXKEut8rxnQQb6QuIQYfBG/KjF.rZbePJrbMR7CGDaG7pSq', 'mobile@sinoport.local');
