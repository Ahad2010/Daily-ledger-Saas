-- The kind check predates water logs, body metrics, nutrition targets and goal check-ins, so saving any of them failed.
-- tests/migrations.test.ts keeps this list in step with the shared record kinds.
ALTER TABLE "Record" DROP CONSTRAINT IF EXISTS "Record_kind_check";
ALTER TABLE "Record" ADD CONSTRAINT "Record_kind_check" CHECK (kind IN ('transaction','budget','cashPlan','financeCategory','recurring','task','habit','completion','workout','meal','grocery','goal','milestone','notification','announcement','automation','bodyMetric','nutritionTarget','waterLog','goalCheckin'));
