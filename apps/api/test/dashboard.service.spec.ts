import { OperationStatus, Prisma } from "@prisma/client";
import { DashboardService } from "../src/modules/dashboard/dashboard.service";
import { PrismaService } from "../src/database/prisma.service";

describe("DashboardService", () => {
  it("agrega métricas, completa dias zerados e mantém decimais como strings", async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        {
          profit: new Prisma.Decimal(20),
          loss: new Prisma.Decimal(5),
          net: new Prisma.Decimal(15),
          investment: new Prisma.Decimal(100),
          settled: 2n,
        },
      ])
      .mockResolvedValueOnce([
        {
          day: "2026-08-02",
          result: new Prisma.Decimal(15),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "account",
          name: "Casa",
          available: new Prisma.Decimal(200),
          open_stake: new Prisma.Decimal(30),
          monthly_result: new Prisma.Decimal(15),
        },
      ]);
    const prisma = {
      $queryRaw: queryRaw,
      operation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "operation",
            sequenceNumber: 1,
            eventName: "A x B",
            status: OperationStatus.SETTLED,
            projectedProfit: new Prisma.Decimal(10),
            realizedProfit: new Prisma.Decimal(15),
            createdAt: new Date(),
            settledAt: new Date(),
          },
        ]),
      },
    } as unknown as PrismaService;
    const result = await new DashboardService(prisma).monthly(
      "user",
      "2026-08",
    );
    expect(result.metrics).toMatchObject({
      realizedProfit: "20.00",
      realizedLoss: "5.00",
      netResult: "15.00",
      roiPercent: "15.000000",
      equity: "230.00",
    });
    expect(result.dailyEvolution).toHaveLength(31);
    expect(result.dailyEvolution[0]).toMatchObject({
      result: "0.00",
      accumulated: "0.00",
    });
    expect(result.dailyEvolution[1]).toMatchObject({
      result: "15.00",
      accumulated: "15.00",
    });
  });
});
