import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Prisma domain schema", () => {
  const schema = readFileSync(
    join(process.cwd(), "prisma", "schema.prisma"),
    "utf8",
  );

  it.each([
    "User",
    "Session",
    "PasswordResetToken",
    "AuthRateLimit",
    "BookmakerAccount",
    "WalletTransaction",
    "ReservedBalanceTransaction",
    "Operation",
    "BetLeg",
    "BetCredit",
    "AuditLog",
  ])("defines model %s", (model) => {
    expect(schema).toContain(`model ${model} {`);
  });

  it("uses UUID identifiers and decimal database types", () => {
    expect(schema).toContain("@default(uuid()) @db.Uuid");
    expect(schema).toContain("@db.Decimal(19, 2)");
    expect(schema).toContain("@db.Decimal(19, 6)");
  });

  it("declares ownership and financial indexes", () => {
    expect(schema).toContain("@@unique([userId, sequenceNumber])");
    expect(schema).toContain("@@unique([userId, idempotencyKey])");
    expect(schema).toContain("@@index([userId, status, createdAt])");
    expect(schema).toContain("@@index([bookmakerAccountId, occurredAt])");
  });

  it("keeps the supported state space explicit", () => {
    expect(schema).toContain("enum OperationStatus {");
    expect(schema).toContain("WAITING_CREDIT_USE");
    expect(schema).toContain("enum BetCreditStatus {");
    expect(schema).toContain("CONSUMED");
    expect(schema).toContain("enum BetType {");
    expect(schema).toContain("riskAmount");
    expect(schema).toContain("selectionName");
  });
});
