import { Injectable } from "@nestjs/common";
import {
  BetCreditStatus,
  BetLegResult,
  BookmakerAccountStatus,
  OperationStatus,
  Prisma,
  WalletTransactionType,
} from "@prisma/client";
import { calculateSettlement } from "@betgarantida/calculation-engine";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import {
  ListOperationsInput,
  OperationAccountError,
  OperationCreditUnavailableError,
  OperationIdempotencyConflictError,
  OperationInsufficientBalanceError,
  OperationInvalidSettlementError,
  OperationNotFoundError,
  OperationNotOpenError,
  OperationsRepository,
  OperationStaleVersionError,
  OperationWriteCommand,
} from "./operations.types";

const include = {
  legs: { orderBy: { position: "asc" as const } },
  generatedCredit: { include: { consumerOperation: true } },
  consumedCredits: { include: { sourceOperation: true } },
};

@Injectable()
export class PrismaOperationsRepository implements OperationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(command: OperationWriteCommand) {
    return this.serializable(() =>
      this.prisma.$transaction(
        async (tx) => {
          const replay = await this.idempotentReplay(
            tx,
            command.userId,
            command.idempotencyKey,
            command.requestHash,
          );
          if (replay) return replay;
          await this.lockAndValidateAccounts(tx, command);
          const last = await tx.operation.findFirst({
            where: { userId: command.userId },
            orderBy: { sequenceNumber: "desc" },
            select: { sequenceNumber: true },
          });
          const operation = await tx.operation.create({
            data: {
              userId: command.userId,
              sequenceNumber: (last?.sequenceNumber ?? 0) + 1,
              eventName: command.eventName,
              notes: command.notes,
              generatesBetCredit: command.generatesBetCredit,
              realCashInvestment: command.realCashInvestment,
              promotionalStake: command.promotionalStake,
              protectedReturn: command.protectedReturn,
              projectedProfit: command.projectedProfit,
              projectedRoiPercent: command.projectedRoiPercent,
              engineVersion: command.engineVersion,
              calculationSnapshot: command.calculationSnapshot,
            },
          });
          await this.reserveCredits(tx, command, operation.id);
          await this.createLegsAndDebits(tx, command, operation.id, "create");
          if (command.generatesBetCredit)
            await tx.betCredit.create({
              data: {
                userId: command.userId,
                sourceOperationId: operation.id,
                expectedAmount: command.expectedBetCredit!,
              },
            });
          await this.recordMutation(
            tx,
            command.userId,
            operation.id,
            command.idempotencyKey,
            command.requestHash,
            "CREATE",
          );
          return tx.operation.findUniqueOrThrow({
            where: { id: operation.id },
            include,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  update(
    command: OperationWriteCommand & { operationId: string; version: number },
  ) {
    return this.serializable(() =>
      this.prisma.$transaction(
        async (tx) => {
          const replay = await this.idempotentReplay(
            tx,
            command.userId,
            command.idempotencyKey,
            command.requestHash,
          );
          if (replay) return replay;
          await this.lockOperation(tx, command.userId, command.operationId);
          const old = await tx.operation.findFirst({
            where: { id: command.operationId, userId: command.userId },
            include,
          });
          if (!old) throw new OperationNotFoundError();
          if (old.status !== OperationStatus.OPEN)
            throw new OperationNotOpenError();
          if (old.version !== command.version)
            throw new OperationStaleVersionError();
          await this.lockAndValidateAccounts(tx, command, old.legs);

          for (const leg of old.legs.filter((item) => !item.usesBetCredit)) {
            await this.walletEffect(
              tx,
              command.userId,
              leg.bookmakerAccountId,
              command.operationId,
              leg.id,
              leg.stake,
              WalletTransactionType.BET_REFUND,
              `edit-refund:${randomUUID()}`,
            );
          }
          await tx.betCredit.updateMany({
            where: {
              consumerOperationId: command.operationId,
              status: BetCreditStatus.AVAILABLE,
            },
            data: { consumerOperationId: null },
          });
          await this.reserveCredits(tx, command, command.operationId);
          await tx.betLeg.deleteMany({
            where: { operationId: command.operationId },
          });
          await this.createLegsAndDebits(
            tx,
            command,
            command.operationId,
            `edit-${command.version + 1}`,
          );

          await tx.betCredit.deleteMany({
            where: {
              sourceOperationId: command.operationId,
              status: BetCreditStatus.EXPECTED,
            },
          });
          if (command.generatesBetCredit)
            await tx.betCredit.create({
              data: {
                userId: command.userId,
                sourceOperationId: command.operationId,
                expectedAmount: command.expectedBetCredit!,
              },
            });
          const changed = await tx.operation.updateMany({
            where: {
              id: command.operationId,
              userId: command.userId,
              version: command.version,
              status: OperationStatus.OPEN,
            },
            data: {
              eventName: command.eventName,
              notes: command.notes,
              generatesBetCredit: command.generatesBetCredit,
              realCashInvestment: command.realCashInvestment,
              promotionalStake: command.promotionalStake,
              protectedReturn: command.protectedReturn,
              projectedProfit: command.projectedProfit,
              projectedRoiPercent: command.projectedRoiPercent,
              engineVersion: command.engineVersion,
              calculationSnapshot: command.calculationSnapshot,
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) throw new OperationStaleVersionError();
          await this.recordMutation(
            tx,
            command.userId,
            command.operationId,
            command.idempotencyKey,
            command.requestHash,
            "UPDATE",
          );
          return tx.operation.findUniqueOrThrow({
            where: { id: command.operationId },
            include,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  findById(userId: string, operationId: string) {
    return this.prisma.operation.findFirst({
      where: { id: operationId, userId },
      include,
    });
  }

  async list(input: ListOperationsInput) {
    const rows = await this.prisma.operation.findMany({
      where: {
        userId: input.userId,
        status: input.status,
        createdAt:
          input.from || input.to
            ? { gte: input.from, lte: input.to }
            : undefined,
        eventName: input.search
          ? { contains: input.search, mode: "insensitive" }
          : undefined,
        legs: input.bookmakerAccountId
          ? { some: { bookmakerAccountId: input.bookmakerAccountId } }
          : undefined,
      },
      include,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
  }

  cancel(input: {
    userId: string;
    operationId: string;
    version: number;
    reason?: string;
    idempotencyKey: string;
    requestHash: string;
  }) {
    return this.serializable(() =>
      this.prisma.$transaction(
        async (tx) => {
          const replay = await this.idempotentReplay(
            tx,
            input.userId,
            input.idempotencyKey,
            input.requestHash,
          );
          if (replay) return replay;
          await this.lockOperation(tx, input.userId, input.operationId);
          const operation = await tx.operation.findFirst({
            where: { id: input.operationId, userId: input.userId },
            include,
          });
          if (!operation) throw new OperationNotFoundError();
          if (operation.status !== OperationStatus.OPEN)
            throw new OperationNotOpenError();
          if (operation.version !== input.version)
            throw new OperationStaleVersionError();
          await this.lockAccountIds(
            tx,
            input.userId,
            operation.legs.map((leg) => leg.bookmakerAccountId),
          );
          for (const leg of operation.legs.filter(
            (item) => !item.usesBetCredit,
          ))
            await this.walletEffect(
              tx,
              input.userId,
              leg.bookmakerAccountId,
              operation.id,
              leg.id,
              leg.stake,
              WalletTransactionType.BET_REFUND,
              `cancel:${operation.id}:${leg.id}`,
            );
          await tx.betCredit.updateMany({
            where: {
              consumerOperationId: operation.id,
              status: BetCreditStatus.AVAILABLE,
            },
            data: { consumerOperationId: null },
          });
          await tx.betCredit.updateMany({
            where: {
              sourceOperationId: operation.id,
              status: BetCreditStatus.EXPECTED,
            },
            data: { status: BetCreditStatus.CANCELLED },
          });
          await tx.auditLog.create({
            data: {
              userId: input.userId,
              action: "OPERATION_CANCELLED",
              resourceType: "OPERATION",
              resourceId: operation.id,
              before: { status: operation.status, version: operation.version },
              after: {
                status: OperationStatus.CANCELLED,
                version: operation.version + 1,
              },
              metadata: { reason: input.reason ?? "" },
            },
          });
          await tx.operation.update({
            where: { id: operation.id },
            data: {
              status: OperationStatus.CANCELLED,
              version: { increment: 1 },
            },
          });
          await this.recordMutation(
            tx,
            input.userId,
            operation.id,
            input.idempotencyKey,
            input.requestHash,
            "CANCEL",
          );
          return tx.operation.findUniqueOrThrow({
            where: { id: operation.id },
            include,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  settle(input: {
    userId: string;
    operationId: string;
    version: number;
    creditGenerated?: boolean;
    grantedCreditAmount?: Prisma.Decimal;
    legs: Array<{ legId: string; result: "WON" | "LOST" }>;
    idempotencyKey: string;
    requestHash: string;
  }) {
    return this.serializable(() =>
      this.prisma.$transaction(
        async (tx) => {
          const replay = await this.idempotentReplay(
            tx,
            input.userId,
            input.idempotencyKey,
            input.requestHash,
          );
          if (replay) return replay;
          await this.lockOperation(tx, input.userId, input.operationId);
          const operation = await tx.operation.findFirst({
            where: { id: input.operationId, userId: input.userId },
            include,
          });
          if (!operation) throw new OperationNotFoundError();
          if (operation.status !== OperationStatus.OPEN)
            throw new OperationNotOpenError();
          if (operation.version !== input.version)
            throw new OperationStaleVersionError();
          const byId = new Map(
            input.legs.map((leg) => [leg.legId, leg.result]),
          );
          if (
            byId.size !== operation.legs.length ||
            operation.legs.some((leg) => !byId.has(leg.id)) ||
            !input.legs.some((leg) => leg.result === "WON") ||
            (operation.generatesBetCredit &&
              input.creditGenerated === undefined)
          )
            throw new OperationInvalidSettlementError();

          await this.lockAccountIds(
            tx,
            input.userId,
            operation.legs.map((leg) => leg.bookmakerAccountId),
          );
          const settlement = calculateSettlement(
            operation.legs.map((leg) => ({
              stake: leg.stake.toString(),
              odd: leg.odd.toString(),
              commissionPercent: leg.commissionPercent.toString(),
              cashbackPercent: leg.cashbackPercent.toString(),
              increasePercent: leg.increasePercent.toString(),
              usesBetCredit: leg.usesBetCredit,
            })),
            operation.legs.map((leg) => byId.get(leg.id)!),
          );
          for (const leg of operation.legs) {
            const result = byId.get(leg.id)!;
            const payout =
              result === "WON"
                ? leg.projectedPayout
                : leg.stake
                    .mul(leg.cashbackPercent)
                    .div(100)
                    .toDecimalPlaces(2);
            if (payout.gt(0))
              await this.walletEffect(
                tx,
                input.userId,
                leg.bookmakerAccountId,
                operation.id,
                leg.id,
                payout,
                WalletTransactionType.BET_RETURN,
                `settle:${operation.id}:${leg.id}`,
              );
            await tx.betLeg.update({
              where: { id: leg.id },
              data: {
                result: result === "WON" ? BetLegResult.WON : BetLegResult.LOST,
              },
            });
          }

          const now = new Date();
          let status: OperationStatus = OperationStatus.SETTLED;
          let settledAt: Date | null = now;
          if (operation.generatesBetCredit) {
            if (input.creditGenerated) {
              if (!input.grantedCreditAmount?.gt(0))
                throw new OperationInvalidSettlementError();
              await tx.betCredit.update({
                where: { sourceOperationId: operation.id },
                data: {
                  status: BetCreditStatus.AVAILABLE,
                  grantedAmount: input.grantedCreditAmount,
                },
              });
              status = OperationStatus.WAITING_CREDIT_USE;
              settledAt = null;
            } else {
              await tx.betCredit.update({
                where: { sourceOperationId: operation.id },
                data: { status: BetCreditStatus.NOT_GRANTED },
              });
            }
          }

          const consumedIds = operation.legs.flatMap((leg) =>
            leg.betCreditId ? [leg.betCreditId] : [],
          );
          if (consumedIds.length) {
            const credits = await tx.betCredit.findMany({
              where: {
                id: { in: consumedIds },
                userId: input.userId,
                status: BetCreditStatus.AVAILABLE,
                consumerOperationId: operation.id,
              },
            });
            if (credits.length !== consumedIds.length)
              throw new OperationCreditUnavailableError();
            await tx.betCredit.updateMany({
              where: { id: { in: consumedIds } },
              data: { status: BetCreditStatus.CONSUMED, consumedAt: now },
            });
            await tx.operation.updateMany({
              where: {
                id: {
                  in: credits.map((credit) => credit.sourceOperationId),
                },
                status: OperationStatus.WAITING_CREDIT_USE,
              },
              data: {
                status: OperationStatus.SETTLED,
                settledAt: now,
                version: { increment: 1 },
              },
            });
          }
          await tx.operation.update({
            where: { id: operation.id },
            data: {
              status,
              settledAt,
              realizedReturn: settlement.realizedReturn.toString(),
              realizedProfit: settlement.realizedProfit.toString(),
              realizedRoiPercent: settlement.realizedRoiPercent.toString(),
              version: { increment: 1 },
            },
          });
          await this.recordMutation(
            tx,
            input.userId,
            operation.id,
            input.idempotencyKey,
            input.requestHash,
            "SETTLE",
          );
          return tx.operation.findUniqueOrThrow({
            where: { id: operation.id },
            include,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  private async createLegsAndDebits(
    tx: Prisma.TransactionClient,
    command: OperationWriteCommand,
    operationId: string,
    key: string,
  ) {
    for (const [position, leg] of command.legs.entries()) {
      const created = await tx.betLeg.create({
        data: { operationId, position, ...leg },
      });
      if (!leg.usesBetCredit)
        await this.walletEffect(
          tx,
          command.userId,
          leg.bookmakerAccountId,
          operationId,
          created.id,
          leg.stake.neg(),
          WalletTransactionType.BET_STAKE,
          `operation:${operationId}:${key}:${position}`,
        );
    }
  }

  private async walletEffect(
    tx: Prisma.TransactionClient,
    userId: string,
    accountId: string,
    operationId: string,
    legId: string,
    amount: Prisma.Decimal,
    type: WalletTransactionType,
    idempotencyKey: string,
  ) {
    await tx.walletTransaction.create({
      data: {
        userId,
        bookmakerAccountId: accountId,
        operationId,
        legId,
        type,
        amount,
        idempotencyKey,
      },
    });
    await tx.bookmakerAccount.update({
      where: { id: accountId },
      data: { cachedBalance: { increment: amount }, version: { increment: 1 } },
    });
  }

  private async lockAndValidateAccounts(
    tx: Prisma.TransactionClient,
    command: OperationWriteCommand,
    oldLegs: Array<{
      bookmakerAccountId: string;
      stake: Prisma.Decimal;
      usesBetCredit: boolean;
    }> = [],
  ) {
    const ids = [
      ...command.legs.map((leg) => leg.bookmakerAccountId),
      ...oldLegs.map((leg) => leg.bookmakerAccountId),
    ];
    await this.lockAccountIds(tx, command.userId, ids);
    const accounts = await tx.bookmakerAccount.findMany({
      where: { id: { in: [...new Set(ids)] }, userId: command.userId },
    });
    if (
      accounts.length !== new Set(ids).size ||
      accounts.some(
        (account) => account.status !== BookmakerAccountStatus.ACTIVE,
      )
    )
      throw new OperationAccountError();
    const oldRefunds = this.aggregate(
      oldLegs.filter((leg) => !leg.usesBetCredit),
    );
    const newDebits = this.aggregate(
      command.legs.filter((leg) => !leg.usesBetCredit),
    );
    for (const account of accounts) {
      const available = account.cachedBalance.add(
        oldRefunds.get(account.id) ?? 0,
      );
      if (available.lt(newDebits.get(account.id) ?? 0))
        throw new OperationInsufficientBalanceError(account.id);
    }
  }

  private aggregate(
    legs: Array<{ bookmakerAccountId: string; stake: Prisma.Decimal }>,
  ) {
    const map = new Map<string, Prisma.Decimal>();
    for (const leg of legs)
      map.set(
        leg.bookmakerAccountId,
        (map.get(leg.bookmakerAccountId) ?? new Prisma.Decimal(0)).add(
          leg.stake,
        ),
      );
    return map;
  }

  private async reserveCredits(
    tx: Prisma.TransactionClient,
    command: OperationWriteCommand,
    operationId: string,
  ) {
    for (const leg of command.legs.filter((item) => item.usesBetCredit)) {
      if (!leg.betCreditId) throw new OperationCreditUnavailableError();
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "bet_credits" WHERE "id" = ${leg.betCreditId}::uuid FOR UPDATE`,
      );
      const credit = await tx.betCredit.findFirst({
        where: {
          id: leg.betCreditId,
          userId: command.userId,
          status: BetCreditStatus.AVAILABLE,
          consumerOperationId: null,
        },
      });
      if (
        !credit ||
        credit.sourceOperationId === operationId ||
        !credit.grantedAmount?.eq(leg.stake)
      )
        throw new OperationCreditUnavailableError();
      const reserved = await tx.betCredit.updateMany({
        where: {
          id: credit.id,
          status: BetCreditStatus.AVAILABLE,
          consumerOperationId: null,
        },
        data: { consumerOperationId: operationId },
      });
      if (reserved.count !== 1) throw new OperationCreditUnavailableError();
    }
  }

  private lockOperation(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
  ) {
    return tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "operations" WHERE "id" = ${id}::uuid AND "user_id" = ${userId}::uuid FOR UPDATE`,
    );
  }
  private lockAccountIds(
    tx: Prisma.TransactionClient,
    userId: string,
    ids: string[],
  ) {
    const sorted = [...new Set(ids)].sort();
    return tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "bookmaker_accounts" WHERE "user_id" = ${userId}::uuid AND "id" IN (${Prisma.join(sorted.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`,
    );
  }

  private async serializable<T>(action: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await action();
      } catch (error) {
        if (
          attempt < 3 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2034" || error.code === "P2002")
        )
          continue;
        throw error;
      }
    }
    throw new Error("Unreachable transaction retry state");
  }

  private async idempotentReplay(
    tx: Prisma.TransactionClient,
    userId: string,
    key: string,
    hash: string,
  ) {
    const mutation = await tx.operationMutation.findUnique({
      where: {
        userId_idempotencyKey: { userId, idempotencyKey: key },
      },
    });
    if (!mutation) return null;
    if (mutation.requestHash !== hash)
      throw new OperationIdempotencyConflictError();
    return tx.operation.findUniqueOrThrow({
      where: { id: mutation.operationId },
      include,
    });
  }

  private recordMutation(
    tx: Prisma.TransactionClient,
    userId: string,
    operationId: string,
    idempotencyKey: string,
    requestHash: string,
    action: string,
  ) {
    return tx.operationMutation.create({
      data: {
        userId,
        operationId,
        idempotencyKey,
        requestHash,
        action,
      },
    });
  }
}
