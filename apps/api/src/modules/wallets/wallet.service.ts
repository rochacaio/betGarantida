import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma, WalletTransactionType } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  WalletAccountArchivedError,
  WalletAccountNotFoundError,
  WalletInsufficientBalanceError,
} from "./prisma-wallet.repository";
import {
  BookmakerAccountRecord,
  CreateAccountCommand,
  FinancialCommandResult,
  WALLET_REPOSITORY,
  WalletRepository,
} from "./wallet.types";

@Injectable()
export class WalletService {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly repository: WalletRepository,
  ) {}

  async createAccount(
    input: Omit<CreateAccountCommand, "initialBalance" | "requestHash"> & {
      initialBalance: string;
    },
  ) {
    this.assertIdempotencyKey(input.idempotencyKey);
    const initialBalance = this.money(input.initialBalance);
    if (initialBalance.isNegative())
      throw new UnprocessableEntityException("Saldo inválido.");
    const requestHash = this.requestHash([
      "CREATE_ACCOUNT",
      input.name,
      input.nickname ?? "",
      input.currency,
      initialBalance.toFixed(2),
    ]);
    const result = await this.repository.createAccountWithInitialBalance({
      ...input,
      initialBalance,
      requestHash,
    });
    this.assertReplayMatches(result.requestHash, requestHash);
    return {
      account: this.accountResponse(result.account),
      idempotentReplay: result.replayed,
    };
  }

  deposit(input: {
    userId: string;
    bookmakerAccountId: string;
    amount: string;
    description?: string;
    idempotencyKey: string;
  }) {
    return this.apply({
      ...input,
      type: WalletTransactionType.DEPOSIT,
      sign: 1,
    });
  }

  freeWinning(input: {
    userId: string;
    bookmakerAccountId: string;
    amount: string;
    description?: string;
    idempotencyKey: string;
  }) {
    return this.apply({
      ...input,
      type: WalletTransactionType.BONUS_RECEIVED,
      sign: 1,
    });
  }

  withdraw(input: {
    userId: string;
    bookmakerAccountId: string;
    amount: string;
    description?: string;
    idempotencyKey: string;
  }) {
    return this.apply({
      ...input,
      type: WalletTransactionType.WITHDRAWAL,
      sign: -1,
    });
  }

  adjust(input: {
    userId: string;
    bookmakerAccountId: string;
    amount: string;
    reason: string;
    idempotencyKey: string;
  }) {
    const targetBalance = this.money(input.amount);
    if (targetBalance.isNegative())
      throw new UnprocessableEntityException(
        "O saldo ajustado não pode ser negativo.",
      );
    return this.execute({
      userId: input.userId,
      bookmakerAccountId: input.bookmakerAccountId,
      amount: targetBalance,
      targetBalance,
      reason: input.reason,
      type: WalletTransactionType.ADJUSTMENT,
      idempotencyKey: input.idempotencyKey,
      auditAdjustment: true,
    });
  }

  async transfer(input: {
    userId: string;
    sourceBookmakerAccountId: string;
    destinationBookmakerAccountId: string;
    amount: string;
    description?: string;
    idempotencyKey: string;
  }) {
    this.assertIdempotencyKey(input.idempotencyKey);
    if (
      input.sourceBookmakerAccountId === input.destinationBookmakerAccountId
    ) {
      throw new UnprocessableEntityException(
        "As casas de origem e destino devem ser diferentes.",
      );
    }
    const amount = this.money(input.amount);
    if (!amount.isPositive())
      throw new UnprocessableEntityException("Valor inválido.");
    const requestHash = this.requestHash([
      "TRANSFER",
      input.sourceBookmakerAccountId,
      input.destinationBookmakerAccountId,
      amount.toFixed(2),
      input.description ?? "",
    ]);
    try {
      const result = await this.repository.transfer({
        ...input,
        amount,
        requestHash,
      });
      this.assertReplayMatches(result.requestHash, requestHash);
      return {
        transfer: {
          debitTransactionId: result.debitTransaction.id,
          creditTransactionId: result.creditTransaction.id,
          amount: amount.toFixed(2),
          sourceBookmakerAccountId: input.sourceBookmakerAccountId,
          destinationBookmakerAccountId: input.destinationBookmakerAccountId,
        },
        sourceBalance: result.sourceBalance.toFixed(2),
        destinationBalance: result.destinationBalance.toFixed(2),
        idempotentReplay: result.replayed,
      };
    } catch (error) {
      if (error instanceof WalletAccountNotFoundError)
        throw new NotFoundException("Casa de aposta não encontrada.");
      if (error instanceof WalletAccountArchivedError)
        throw new ConflictException("Uma das casas de aposta está arquivada.");
      if (error instanceof WalletInsufficientBalanceError)
        throw new UnprocessableEntityException({
          code: "INSUFFICIENT_BALANCE",
          message: "Saldo insuficiente na casa de origem.",
        });
      throw error;
    }
  }

  async listTransactions(input: {
    userId: string;
    bookmakerAccountId: string;
    cursor?: string;
    limit: number;
  }) {
    const result = await this.repository.listTransactions(input);
    if (!result) throw new NotFoundException("Casa de aposta não encontrada.");
    return {
      data: result.items.map((item) => ({
        id: item.id,
        bookmakerAccountId: item.bookmakerAccountId,
        type: item.type,
        amount: item.amount.toFixed(2),
        occurredAt: item.occurredAt.toISOString(),
        metadata: item.metadata,
        betType: item.betType,
        activity: walletActivity(item.type, item.idempotencyKey),
      })),
      pageInfo: {
        nextCursor: result.nextCursor,
        hasNextPage: result.nextCursor !== null,
      },
    };
  }

  reconcile(userId: string) {
    return this.repository.reconcileUser(userId);
  }

  private apply(input: {
    userId: string;
    bookmakerAccountId: string;
    amount: string;
    description?: string;
    type: WalletTransactionType;
    sign: 1 | -1;
    idempotencyKey: string;
  }) {
    const absolute = this.money(input.amount);
    if (!absolute.isPositive())
      throw new UnprocessableEntityException("Valor inválido.");
    return this.execute({
      userId: input.userId,
      bookmakerAccountId: input.bookmakerAccountId,
      amount: absolute.mul(input.sign),
      reason: input.description,
      type: input.type,
      idempotencyKey: input.idempotencyKey,
    });
  }

  private async execute(input: {
    userId: string;
    bookmakerAccountId: string;
    amount: Prisma.Decimal;
    targetBalance?: Prisma.Decimal;
    reason?: string;
    type: WalletTransactionType;
    idempotencyKey: string;
    auditAdjustment?: boolean;
  }) {
    this.assertIdempotencyKey(input.idempotencyKey);
    const requestHash = this.requestHash([
      input.type,
      input.bookmakerAccountId,
      input.amount.toFixed(2),
      input.targetBalance?.toFixed(2) ?? "",
      input.reason ?? "",
    ]);
    let result: FinancialCommandResult;
    try {
      result = await this.repository.applyFinancialCommand({
        ...input,
        requestHash,
      });
    } catch (error) {
      if (error instanceof WalletAccountNotFoundError) {
        throw new NotFoundException("Casa de aposta não encontrada.");
      }
      if (error instanceof WalletAccountArchivedError) {
        throw new ConflictException("A casa de aposta está arquivada.");
      }
      if (error instanceof WalletInsufficientBalanceError) {
        throw new UnprocessableEntityException({
          code: "INSUFFICIENT_BALANCE",
          message: "Saldo insuficiente para concluir a movimentação.",
        });
      }
      throw error;
    }
    this.assertReplayMatches(result.requestHash, requestHash);
    return {
      transaction: {
        id: result.transaction.id,
        bookmakerAccountId: result.transaction.bookmakerAccountId,
        type: result.transaction.type,
        amount: result.transaction.amount.toFixed(2),
        occurredAt: result.transaction.occurredAt.toISOString(),
      },
      availableBalance: result.resultingBalance.toFixed(2),
      idempotentReplay: result.replayed,
    };
  }

  private accountResponse(account: BookmakerAccountRecord) {
    return {
      id: account.id,
      name: account.name,
      nickname: account.nickname,
      currency: account.currency,
      status: account.status,
      availableBalance: account.cachedBalance.toFixed(2),
      openStake: account.openStake.toFixed(2),
      equity: account.cachedBalance.add(account.openStake).toFixed(2),
      version: account.version,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  private money(value: string): Prisma.Decimal {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new UnprocessableEntityException("Valor monetário inválido.");
    }
  }

  private assertIdempotencyKey(key: string): void {
    if (!key || key.length < 8 || key.length > 160) {
      throw new UnprocessableEntityException(
        "Idempotency-Key inválida ou ausente.",
      );
    }
  }

  private assertReplayMatches(storedHash: string, requestHash: string): void {
    if (storedHash !== requestHash) {
      throw new ConflictException({
        code: "IDEMPOTENCY_CONFLICT",
        message: "A chave de idempotência já foi usada com outro conteúdo.",
      });
    }
  }

  private requestHash(parts: string[]): string {
    return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  }
}

const walletActivity = (type: string, idempotencyKey: string) => {
  if (type === "BET_REFUND")
    return idempotencyKey.startsWith("edit-refund:")
      ? "BET_EDIT_REFUND"
      : "BET_CANCEL_REFUND";
  if (type === "BET_STAKE" && idempotencyKey.includes(":edit-"))
    return "BET_EDIT_STAKE";
  return undefined;
};
