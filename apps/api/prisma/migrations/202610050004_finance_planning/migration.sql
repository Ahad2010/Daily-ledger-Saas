ALTER TABLE "Record" DROP CONSTRAINT "Record_kind_check";
ALTER TABLE "Record" ADD CONSTRAINT "Record_kind_check" CHECK (kind IN ('transaction','budget','cashPlan','financeCategory','recurring','task','habit','completion','workout','meal','grocery','goal','milestone','notification','automation'));
ALTER TABLE "Record" DROP CONSTRAINT "Record_money_check";
ALTER TABLE "Record" ADD CONSTRAINT "Record_money_check" CHECK (
 kind NOT IN ('transaction','budget','cashPlan','recurring') OR
 (jsonb_typeof(data->'amount')='number' AND (data->>'amount')::numeric BETWEEN 0 AND 1000000000000 AND (data->>'amount')::numeric=trunc((data->>'amount')::numeric))
);
UPDATE "Record" SET "uniqueKey"='budget:' || (data->>'month') || ':' || (data->>'currency') || ':all' WHERE kind='budget';
