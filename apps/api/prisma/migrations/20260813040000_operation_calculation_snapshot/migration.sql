ALTER TABLE "operations"
ADD COLUMN "calculation_snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "operations"
ALTER COLUMN "calculation_snapshot" DROP DEFAULT;
