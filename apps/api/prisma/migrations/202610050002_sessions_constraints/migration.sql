CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
ALTER TABLE "User" ADD CONSTRAINT "User_plan_check" CHECK (plan IN ('Free','Pro','Lifetime'));
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK (role IN ('user','admin'));
ALTER TABLE "Record" ADD CONSTRAINT "Record_kind_check" CHECK (kind IN ('transaction','budget','recurring','task','habit','completion','workout','meal','grocery','goal','milestone','notification','automation'));
ALTER TABLE "Record" ADD CONSTRAINT "Record_version_check" CHECK (version > 0);
ALTER TABLE "Record" ADD CONSTRAINT "Record_money_check" CHECK (
  kind NOT IN ('transaction','budget','recurring') OR
  (jsonb_typeof(data->'amount') = 'number' AND (data->>'amount')::numeric BETWEEN 0 AND 1000000000000 AND (data->>'amount')::numeric = trunc((data->>'amount')::numeric))
);
ALTER TABLE "Job" ADD CONSTRAINT "Job_status_check" CHECK (status IN ('pending','leased','done','cancelled','failed'));
