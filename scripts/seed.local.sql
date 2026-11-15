-- Sample contacts for LOCAL development only:
--   npm run db:seed:local
INSERT OR IGNORE INTO "Contact" ("id","name","nicknames","phone","email","isVip","updatedAt") VALUES
  ('seed-mom','Mom','mother, mum, mama','+15550100001',NULL,1,CURRENT_TIMESTAMP),
  ('seed-pepper','Pepper Potts','pepper, boss, ceo','+15550100002','pepper@starkindustries.com',1,CURRENT_TIMESTAMP),
  ('seed-happy','Happy Hogan','happy, driver','+15550100003','happy@starkindustries.com',0,CURRENT_TIMESTAMP);
