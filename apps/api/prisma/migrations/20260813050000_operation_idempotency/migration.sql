CREATE TABLE "operation_mutations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(160) NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operation_mutations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operation_mutations_user_id_idempotency_key_key"
ON "operation_mutations"("user_id", "idempotency_key");
CREATE INDEX "operation_mutations_operation_id_idx"
ON "operation_mutations"("operation_id");

ALTER TABLE "operation_mutations" ADD CONSTRAINT "operation_mutations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operation_mutations" ADD CONSTRAINT "operation_mutations_operation_id_fkey"
FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
