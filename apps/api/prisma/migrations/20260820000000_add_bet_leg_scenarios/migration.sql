ALTER TABLE "bet_legs"
ADD COLUMN "scenario_id" UUID,
ADD COLUMN "group_position" INTEGER NOT NULL DEFAULT 0;

UPDATE "bet_legs"
SET "scenario_id" = "id";

ALTER TABLE "bet_legs"
ALTER COLUMN "scenario_id" SET NOT NULL;

ALTER TABLE "bet_legs"
ADD CONSTRAINT "bet_legs_group_position_check"
CHECK ("group_position" >= 0);

CREATE UNIQUE INDEX "bet_legs_operation_id_scenario_id_group_position_key"
ON "bet_legs"("operation_id", "scenario_id", "group_position");

CREATE INDEX "bet_legs_operation_id_scenario_id_idx"
ON "bet_legs"("operation_id", "scenario_id");
