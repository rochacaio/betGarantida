import { Injectable } from "@nestjs/common";
import { BetCreditStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class BetCreditsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, status: BetCreditStatus) {
    const credits = await this.prisma.betCredit.findMany({
      where: {
        userId,
        status,
        ...(status === BetCreditStatus.AVAILABLE
          ? { consumerOperationId: null }
          : {}),
      },
      include: {
        sourceOperation: {
          select: { id: true, eventName: true, settledAt: true },
        },
        consumerOperation: { select: { id: true, eventName: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return {
      data: credits.map((credit) => ({
        ...credit,
        expectedAmount: credit.expectedAmount.toFixed(2),
        grantedAmount: credit.grantedAmount?.toFixed(2) ?? null,
      })),
    };
  }
}
