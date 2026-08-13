import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  calculateOperationSnapshot,
  serializeDecimals,
} from "@betgarantida/calculation-engine";
import { PrismaService } from "../src/database/prisma.service";
import { PrismaOperationsRepository } from "../src/modules/operations/prisma-operations.repository";

const run = process.env.RUN_DB_INTEGRATION === "1" ? describe : describe.skip;

run("operações financeiras com PostgreSQL real", () => {
  const prisma = new PrismaService();
  const repository = new PrismaOperationsRepository(prisma);
  const userId = randomUUID();
  const accountIds = [randomUUID(), randomUUID()];

  beforeAll(async () => {
    if (!(process.env.DATABASE_URL ?? "").includes("_test"))
      throw new Error(
        "Integração financeira exige um banco dedicado com nome terminado em _test.",
      );
    await prisma.$connect();
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@test.local`,
        cpfHash: userId.replaceAll("-", "").padEnd(64, "0"),
        cpfEncrypted: "integration-only",
        passwordHash: "integration-only",
      },
    });
    for (const [index, id] of accountIds.entries()) {
      await prisma.bookmakerAccount.create({
        data: { id, userId, name: `Casa ${index + 1}`, cachedBalance: 500 },
      });
      await prisma.walletTransaction.create({
        data: {
          userId,
          bookmakerAccountId: id,
          type: "INITIAL_BALANCE",
          amount: 500,
          idempotencyKey: `initial:${id}`,
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.operationMutation.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.walletTransaction.deleteMany({ where: { userId } });
    await prisma.betLeg.deleteMany({ where: { operation: { userId } } });
    await prisma.betCredit.deleteMany({ where: { userId } });
    await prisma.operation.deleteMany({ where: { userId } });
    await prisma.bookmakerAccount.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("debita atomicamente, reproduz a chave e estorna uma única vez", async () => {
    const inputs = [
      { stake: "100", odd: "2" },
      { stake: "100", odd: "2" },
    ];
    const snapshot = calculateOperationSnapshot(inputs);
    const command = {
      userId,
      eventName: "Integração A x B",
      generatesBetCredit: false,
      realCashInvestment: new Prisma.Decimal(
        snapshot.realCashInvestment.toString(),
      ),
      promotionalStake: new Prisma.Decimal(0),
      protectedReturn: new Prisma.Decimal(snapshot.protectedReturn.toString()),
      projectedProfit: new Prisma.Decimal(snapshot.projectedProfit.toString()),
      projectedRoiPercent: new Prisma.Decimal(
        snapshot.projectedRoiPercent.toString(),
      ),
      engineVersion: snapshot.engineVersion,
      calculationSnapshot: serializeDecimals(snapshot) as Prisma.InputJsonValue,
      idempotencyKey: `create:${randomUUID()}`,
      requestHash: "a".repeat(64),
      legs: snapshot.legs.map((leg, index) => ({
        bookmakerAccountId: accountIds[index],
        stake: new Prisma.Decimal(leg.stake.toString()),
        odd: new Prisma.Decimal(leg.odd.toString()),
        commissionPercent: new Prisma.Decimal(0),
        cashbackPercent: new Prisma.Decimal(0),
        increasePercent: new Prisma.Decimal(0),
        usesBetCredit: false,
        usesFreeBetCredit: false,
        profitFactor: new Prisma.Decimal(leg.profitFactor.toString()),
        effectiveOdd: new Prisma.Decimal(leg.effectiveOdd.toString()),
        projectedPayout: new Prisma.Decimal(leg.projectedPayout.toString()),
        scenarioResult: new Prisma.Decimal(leg.scenarioResult.toString()),
      })),
    };
    const created = await repository.create(command);
    const replay = await repository.create(command);
    expect(replay.id).toBe(created.id);
    expect(await prisma.operation.count({ where: { userId } })).toBe(1);
    expect(
      (
        await prisma.bookmakerAccount.findUniqueOrThrow({
          where: { id: accountIds[0] },
        })
      ).cachedBalance.toFixed(2),
    ).toBe("400.00");
    await repository.cancel({
      userId,
      operationId: created.id,
      version: created.version,
      idempotencyKey: `cancel:${randomUUID()}`,
      requestHash: "b".repeat(64),
    });
    expect(
      (
        await prisma.bookmakerAccount.findUniqueOrThrow({
          where: { id: accountIds[0] },
        })
      ).cachedBalance.toFixed(2),
    ).toBe("500.00");
  });
});
