import { BetCreditStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../src/database/prisma.service";
import { BetCreditsService } from "../src/modules/bet-credits/bet-credits.service";

describe("BetCreditsService", () => {
  it("lista somente créditos disponíveis e não reservados para o seletor", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "credit",
        expectedAmount: new Prisma.Decimal(50),
        grantedAmount: new Prisma.Decimal(45),
        status: BetCreditStatus.AVAILABLE,
      },
    ]);
    const prisma = { betCredit: { findMany } } as unknown as PrismaService;
    const result = await new BetCreditsService(prisma).list(
      "user",
      BetCreditStatus.AVAILABLE,
    );
    expect(findMany.mock.calls).toHaveLength(1);
    expect(result).toMatchObject({
      data: [{ expectedAmount: "50.00", grantedAmount: "45.00" }],
    });
  });
});
