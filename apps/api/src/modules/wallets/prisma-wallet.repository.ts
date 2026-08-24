import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  BookmakerAccountStatus,
  Prisma,
  WalletTransactionType,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  BookmakerAccountRecord,
  CreateAccountCommand,
  FinancialCommand,
  FinancialCommandResult,
  TransferCommand,
  TransferCommandResult,
  WalletRepository,
  WalletTransactionRecord,
} from "./wallet.types";

interface TransactionMetadata {
  requestHash?: string;
  resultingBalance?: string;
  reason?: string;
  transferId?: string;
  counterpartyBookmakerAccountId?: string;
}

@Injectable()
export class PrismaWalletRepository implements WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAccountWithInitialBalance(command: CreateAccountCommand) {
    const existing = await this.findExistingCommand(
      command.userId,
      command.idempotencyKey,
    );
    if (existing) return this.replayedAccount(existing);

    try {
      const account = await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const created = await tx.bookmakerAccount.create({
              data: {
                userId: command.userId,
                name: command.name,
                ownerName: command.ownerName,
                nickname: command.nickname,
                currency: command.currency,
                cachedBalance: command.initialBalance,
              },
            });
            await tx.walletTransaction.create({
              data: {
                userId: command.userId,
                bookmakerAccountId: created.id,
                type: WalletTransactionType.INITIAL_BALANCE,
                amount: command.initialBalance,
                idempotencyKey: command.idempotencyKey,
                metadata: {
                  requestHash: command.requestHash,
                  resultingBalance: command.initialBalance.toFixed(2),
                },
              },
            });
            return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
      return {
        account: this.accountRecord(account),
        replayed: false,
        requestHash: command.requestHash,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const replay = await this.findExistingCommand(
          command.userId,
          command.idempotencyKey,
        );
        if (replay) return this.replayedAccount(replay);
      }
      throw error;
    }
  }

  async applyFinancialCommand(
    command: FinancialCommand,
  ): Promise<FinancialCommandResult> {
    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT "id" FROM "bookmaker_accounts"
            WHERE "id" = ${command.bookmakerAccountId}::uuid
              AND "user_id" = ${command.userId}::uuid
            FOR UPDATE
          `);
          if (!locked.length) throw new WalletAccountNotFoundError();

          const account = await tx.bookmakerAccount.findUniqueOrThrow({
            where: { id: command.bookmakerAccountId },
          });
          const existing = await tx.walletTransaction.findUnique({
            where: {
              userId_idempotencyKey: {
                userId: command.userId,
                idempotencyKey: command.idempotencyKey,
              },
            },
          });
          if (existing) return this.replayedMovement(existing);
          if (account.status !== BookmakerAccountStatus.ACTIVE) {
            throw new WalletAccountArchivedError();
          }

          const transactionAmount = command.targetBalance
            ? command.targetBalance.sub(account.cachedBalance)
            : command.amount;
          const resultingBalance =
            command.targetBalance ?? account.cachedBalance.add(command.amount);
          if (resultingBalance.isNegative())
            throw new WalletInsufficientBalanceError();
          const metadata: Prisma.InputJsonObject = {
            requestHash: command.requestHash,
            resultingBalance: resultingBalance.toFixed(2),
            ...(command.reason ? { reason: command.reason } : {}),
          };
          const transaction = await tx.walletTransaction.create({
            data: {
              userId: command.userId,
              bookmakerAccountId: command.bookmakerAccountId,
              type: command.type,
              amount: transactionAmount,
              idempotencyKey: command.idempotencyKey,
              metadata,
            },
          });
          await tx.bookmakerAccount.update({
            where: { id: account.id },
            data: {
              cachedBalance: resultingBalance,
              version: { increment: 1 },
            },
          });
          if (command.auditAdjustment) {
            await tx.auditLog.create({
              data: {
                userId: command.userId,
                action: "WALLET_ADJUSTMENT",
                resourceType: "BOOKMAKER_ACCOUNT",
                resourceId: account.id,
                before: { cachedBalance: account.cachedBalance.toFixed(2) },
                after: { cachedBalance: resultingBalance.toFixed(2) },
                metadata: { reason: command.reason ?? "" },
              },
            });
          }
          return {
            transaction: this.transactionRecord(transaction),
            resultingBalance,
            replayed: false,
            requestHash: command.requestHash,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async transfer(command: TransferCommand): Promise<TransferCommandResult> {
    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const accountIds = [
            command.sourceBookmakerAccountId,
            command.destinationBookmakerAccountId,
          ].sort();
          const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT "id" FROM "bookmaker_accounts"
            WHERE "id" IN (${Prisma.join(accountIds.map((id) => Prisma.sql`${id}::uuid`))})
              AND "user_id" = ${command.userId}::uuid
            ORDER BY "id"
            FOR UPDATE
          `);
          if (locked.length !== 2) throw new WalletAccountNotFoundError();

          const existing = await tx.walletTransaction.findUnique({
            where: {
              userId_idempotencyKey: {
                userId: command.userId,
                idempotencyKey: command.idempotencyKey,
              },
            },
          });
          if (existing) return this.replayedTransfer(tx, command, existing);

          const accounts = await tx.bookmakerAccount.findMany({
            where: { id: { in: accountIds }, userId: command.userId },
          });
          const source = accounts.find(
            (account) => account.id === command.sourceBookmakerAccountId,
          );
          const destination = accounts.find(
            (account) => account.id === command.destinationBookmakerAccountId,
          );
          if (!source || !destination) throw new WalletAccountNotFoundError();
          if (
            source.status !== BookmakerAccountStatus.ACTIVE ||
            destination.status !== BookmakerAccountStatus.ACTIVE
          )
            throw new WalletAccountArchivedError();
          const sourceBalance = source.cachedBalance.sub(command.amount);
          if (sourceBalance.isNegative())
            throw new WalletInsufficientBalanceError();
          const destinationBalance = destination.cachedBalance.add(
            command.amount,
          );
          const transferId = randomUUID();
          const destinationKey = `transfer-in:${command.requestHash}`;
          const occurredAt = new Date();
          const debit = await tx.walletTransaction.create({
            data: {
              userId: command.userId,
              bookmakerAccountId: source.id,
              type: WalletTransactionType.TRANSFER_OUT,
              amount: command.amount.negated(),
              idempotencyKey: command.idempotencyKey,
              occurredAt,
              metadata: {
                requestHash: command.requestHash,
                resultingBalance: sourceBalance.toFixed(2),
                transferId,
                counterpartyBookmakerAccountId: destination.id,
                ...(command.description ? { reason: command.description } : {}),
              },
            },
          });
          const credit = await tx.walletTransaction.create({
            data: {
              userId: command.userId,
              bookmakerAccountId: destination.id,
              type: WalletTransactionType.TRANSFER_IN,
              amount: command.amount,
              idempotencyKey: destinationKey,
              occurredAt,
              metadata: {
                requestHash: command.requestHash,
                resultingBalance: destinationBalance.toFixed(2),
                transferId,
                counterpartyBookmakerAccountId: source.id,
                ...(command.description ? { reason: command.description } : {}),
              },
            },
          });
          await Promise.all([
            tx.bookmakerAccount.update({
              where: { id: source.id },
              data: { cachedBalance: sourceBalance, version: { increment: 1 } },
            }),
            tx.bookmakerAccount.update({
              where: { id: destination.id },
              data: {
                cachedBalance: destinationBalance,
                version: { increment: 1 },
              },
            }),
          ]);
          return {
            debitTransaction: this.transactionRecord(debit),
            creditTransaction: this.transactionRecord(credit),
            sourceBalance,
            destinationBalance,
            replayed: false,
            requestHash: command.requestHash,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async listTransactions(input: {
    userId: string;
    bookmakerAccountId: string;
    cursor?: string;
    limit: number;
  }) {
    const account = await this.prisma.bookmakerAccount.findFirst({
      where: { id: input.bookmakerAccountId, userId: input.userId },
      select: { id: true },
    });
    if (!account) return null;
    const rows = await this.prisma.walletTransaction.findMany({
      where: {
        userId: input.userId,
        bookmakerAccountId: input.bookmakerAccountId,
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: { leg: { select: { betType: true } } },
    });
    const hasNextPage = rows.length > input.limit;
    const items = rows.slice(0, input.limit).map((row) => ({
      ...this.transactionRecord(row),
      betType: row.leg?.betType,
    }));
    return {
      items,
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async reconcileUser(userId: string) {
    const [accounts, ledger] = await Promise.all([
      this.prisma.bookmakerAccount.findMany({
        where: { userId },
        select: { id: true, cachedBalance: true },
      }),
      this.prisma.walletTransaction.groupBy({
        by: ["bookmakerAccountId"],
        where: { userId },
        _sum: { amount: true },
      }),
    ]);
    const sums = new Map(
      ledger.map((item) => [
        item.bookmakerAccountId,
        item._sum.amount ?? new Prisma.Decimal(0),
      ]),
    );
    return accounts
      .map((account) => ({
        bookmakerAccountId: account.id,
        cachedBalance: account.cachedBalance,
        ledgerBalance: sums.get(account.id) ?? new Prisma.Decimal(0),
      }))
      .filter((item) => !item.cachedBalance.equals(item.ledgerBalance));
  }

  private async findExistingCommand(userId: string, idempotencyKey: string) {
    return this.prisma.walletTransaction.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: { bookmakerAccount: true },
    });
  }

  private replayedAccount(
    existing: NonNullable<
      Awaited<ReturnType<PrismaWalletRepository["findExistingCommand"]>>
    >,
  ) {
    return {
      account: this.accountRecord(existing.bookmakerAccount),
      replayed: true,
      requestHash: this.metadata(existing.metadata).requestHash ?? "",
    };
  }

  private replayedMovement(
    existing: Prisma.WalletTransactionGetPayload<Record<string, never>>,
  ): FinancialCommandResult {
    const metadata = this.metadata(existing.metadata);
    return {
      transaction: this.transactionRecord(existing),
      resultingBalance: new Prisma.Decimal(metadata.resultingBalance ?? "0"),
      replayed: true,
      requestHash: metadata.requestHash ?? "",
    };
  }

  private metadata(value: Prisma.JsonValue | null): TransactionMetadata {
    if (!value || Array.isArray(value) || typeof value !== "object") return {};
    const requestHash =
      typeof value.requestHash === "string" ? value.requestHash : undefined;
    const resultingBalance =
      typeof value.resultingBalance === "string"
        ? value.resultingBalance
        : undefined;
    const reason = typeof value.reason === "string" ? value.reason : undefined;
    const transferId =
      typeof value.transferId === "string" ? value.transferId : undefined;
    const counterpartyBookmakerAccountId =
      typeof value.counterpartyBookmakerAccountId === "string"
        ? value.counterpartyBookmakerAccountId
        : undefined;
    return {
      requestHash,
      resultingBalance,
      reason,
      transferId,
      counterpartyBookmakerAccountId,
    };
  }

  private async replayedTransfer(
    tx: Prisma.TransactionClient,
    command: TransferCommand,
    debit: Prisma.WalletTransactionGetPayload<Record<string, never>>,
  ): Promise<TransferCommandResult> {
    const debitMetadata = this.metadata(debit.metadata);
    const credit = await tx.walletTransaction.findUniqueOrThrow({
      where: {
        userId_idempotencyKey: {
          userId: command.userId,
          idempotencyKey: `transfer-in:${debitMetadata.requestHash ?? command.requestHash}`,
        },
      },
    });
    const creditMetadata = this.metadata(credit.metadata);
    return {
      debitTransaction: this.transactionRecord(debit),
      creditTransaction: this.transactionRecord(credit),
      sourceBalance: new Prisma.Decimal(debitMetadata.resultingBalance ?? "0"),
      destinationBalance: new Prisma.Decimal(
        creditMetadata.resultingBalance ?? "0",
      ),
      replayed: true,
      requestHash: debitMetadata.requestHash ?? "",
    };
  }

  private accountRecord(
    account: Prisma.BookmakerAccountGetPayload<Record<string, never>>,
  ): BookmakerAccountRecord {
    return { ...account, openStake: new Prisma.Decimal(0) };
  }

  private transactionRecord(
    transaction: Prisma.WalletTransactionGetPayload<Record<string, never>>,
  ): WalletTransactionRecord {
    return transaction;
  }

  private async withSerializableRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (
          attempt < 3 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034"
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new Error("Unreachable transaction retry state");
  }
}

export class WalletAccountNotFoundError extends Error {}
export class WalletAccountArchivedError extends Error {}
export class WalletInsufficientBalanceError extends Error {}
