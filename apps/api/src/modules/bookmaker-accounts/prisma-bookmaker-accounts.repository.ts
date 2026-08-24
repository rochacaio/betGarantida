import { Injectable } from "@nestjs/common";
import {
  BookmakerAccountStatus,
  OperationStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { BookmakerAccountRecord } from "../wallets/wallet.types";
import { BookmakerAccountsRepository } from "./bookmaker-account.types";

type AccountRow = Prisma.BookmakerAccountGetPayload<Record<string, never>>;

@Injectable()
export class PrismaBookmakerAccountsRepository
  implements BookmakerAccountsRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    status?: BookmakerAccountStatus,
  ): Promise<BookmakerAccountRecord[]> {
    const accounts = await this.prisma.bookmakerAccount.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return this.withOpenStake(userId, accounts);
  }

  async findById(
    userId: string,
    id: string,
  ): Promise<BookmakerAccountRecord | null> {
    const account = await this.prisma.bookmakerAccount.findFirst({
      where: { id, userId },
    });
    if (!account) return null;
    return (await this.withOpenStake(userId, [account]))[0] ?? null;
  }

  async updateMetadata(input: {
    userId: string;
    id: string;
    version: number;
    name?: string;
    ownerName?: string | null;
    nickname?: string | null;
    status?: BookmakerAccountStatus;
  }): Promise<
    | { result: "UPDATED"; account: BookmakerAccountRecord }
    | { result: "NOT_FOUND" | "STALE_VERSION" }
  > {
    const updated = await this.prisma.bookmakerAccount.updateMany({
      where: { id: input.id, userId: input.userId, version: input.version },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.ownerName !== undefined
          ? { ownerName: input.ownerName }
          : {}),
        ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      const exists = await this.prisma.bookmakerAccount.findFirst({
        where: { id: input.id, userId: input.userId },
        select: { id: true },
      });
      return { result: exists ? "STALE_VERSION" : "NOT_FOUND" };
    }
    const account = await this.findById(input.userId, input.id);
    if (!account) return { result: "NOT_FOUND" };
    return { result: "UPDATED", account };
  }

  private async withOpenStake(
    userId: string,
    accounts: AccountRow[],
  ): Promise<BookmakerAccountRecord[]> {
    if (!accounts.length) return [];
    const grouped = await this.prisma.betLeg.groupBy({
      by: ["bookmakerAccountId"],
      where: {
        bookmakerAccountId: { in: accounts.map((account) => account.id) },
        usesBetCredit: false,
        result: "PENDING",
        operation: { userId, status: OperationStatus.OPEN },
      },
      _sum: { riskAmount: true },
    });
    const openStake = new Map(
      grouped.map((item) => [
        item.bookmakerAccountId,
        item._sum.riskAmount ?? new Prisma.Decimal(0),
      ]),
    );
    return accounts.map((account) => ({
      ...account,
      openStake: openStake.get(account.id) ?? new Prisma.Decimal(0),
    }));
  }
}
