import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  BookmakerAccountStatus,
  Prisma,
  WalletTransactionType,
} from "@prisma/client";
import { WalletService } from "../src/modules/wallets/wallet.service";
import {
  BookmakerAccountRecord,
  CreateAccountCommand,
  FinancialCommand,
  WalletRepository,
  WalletTransactionRecord,
} from "../src/modules/wallets/wallet.types";

class MemoryWalletRepository implements WalletRepository {
  balance = new Prisma.Decimal(0);
  requests = new Map<string, { hash: string; result: any }>();
  lastFinancialCommand?: FinancialCommand;

  createAccountWithInitialBalance(command: CreateAccountCommand) {
    const previous = this.requests.get(command.idempotencyKey);
    if (previous) {
      return Promise.resolve({
        account: previous.result as BookmakerAccountRecord,
        replayed: true,
        requestHash: previous.hash,
      });
    }
    this.balance = command.initialBalance;
    const account = this.account();
    this.requests.set(command.idempotencyKey, {
      hash: command.requestHash,
      result: account,
    });
    return Promise.resolve({
      account,
      replayed: false,
      requestHash: command.requestHash,
    });
  }

  applyFinancialCommand(command: FinancialCommand) {
    this.lastFinancialCommand = command;
    const previous = this.requests.get(command.idempotencyKey);
    if (previous) return Promise.resolve(previous.result);
    this.balance = this.balance.add(command.amount);
    const result = {
      transaction: this.transaction(command.type, command.amount),
      resultingBalance: this.balance,
      replayed: false,
      requestHash: command.requestHash,
    };
    this.requests.set(command.idempotencyKey, {
      hash: command.requestHash,
      result: { ...result, replayed: true },
    });
    return Promise.resolve(result);
  }

  listTransactions() {
    return Promise.resolve({ items: [], nextCursor: null });
  }

  reconcileUser() {
    return Promise.resolve([]);
  }

  private account(): BookmakerAccountRecord {
    return {
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      name: "Bet365",
      nickname: null,
      currency: "BRL",
      status: BookmakerAccountStatus.ACTIVE,
      cachedBalance: this.balance,
      openStake: new Prisma.Decimal(0),
      version: 1,
      createdAt: new Date("2026-08-13T00:00:00Z"),
      updatedAt: new Date("2026-08-13T00:00:00Z"),
    };
  }

  private transaction(
    type: WalletTransactionType,
    amount: Prisma.Decimal,
  ): WalletTransactionRecord {
    return {
      id: "22222222-2222-4222-8222-222222222222",
      bookmakerAccountId: "11111111-1111-4111-8111-111111111111",
      type,
      amount,
      occurredAt: new Date("2026-08-13T00:00:00Z"),
      metadata: null,
    };
  }
}

describe("WalletService", () => {
  let repository: MemoryWalletRepository;
  let service: WalletService;

  beforeEach(() => {
    repository = new MemoryWalletRepository();
    service = new WalletService(repository);
  });

  it("creates an account with decimal balances", async () => {
    const result = await service.createAccount({
      userId: "user-1",
      name: "Bet365",
      currency: "BRL",
      initialBalance: "100.50",
      idempotencyKey: "create-account-1",
    });
    expect(result.account).toMatchObject({
      availableBalance: "100.50",
      openStake: "0.00",
      equity: "100.50",
    });
  });

  it("records deposits as positive amounts", async () => {
    const result = await service.deposit({
      userId: "user-1",
      bookmakerAccountId: "account-1",
      amount: "25.10",
      idempotencyKey: "deposit-0001",
    });
    expect(result.availableBalance).toBe("25.10");
    expect(repository.lastFinancialCommand?.amount.toFixed(2)).toBe("25.10");
  });

  it("records withdrawals as negative amounts", async () => {
    repository.balance = new Prisma.Decimal("100.00");
    await service.withdraw({
      userId: "user-1",
      bookmakerAccountId: "account-1",
      amount: "40.00",
      idempotencyKey: "withdraw-001",
    });
    expect(repository.lastFinancialCommand?.amount.toFixed(2)).toBe("-40.00");
  });

  it("requires a non-zero adjustment and marks it for audit", async () => {
    expect(() =>
      service.adjust({
        userId: "user-1",
        bookmakerAccountId: "account-1",
        amount: "0.00",
        reason: "Correção",
        idempotencyKey: "adjustment-01",
      }),
    ).toThrow(UnprocessableEntityException);

    await service.adjust({
      userId: "user-1",
      bookmakerAccountId: "account-1",
      amount: "10.00",
      reason: "Correção de saldo",
      idempotencyKey: "adjustment-02",
    });
    expect(repository.lastFinancialCommand?.auditAdjustment).toBe(true);
  });

  it("returns the same effect for an idempotent replay", async () => {
    const command = {
      userId: "user-1",
      bookmakerAccountId: "account-1",
      amount: "20.00",
      idempotencyKey: "deposit-replay",
    };
    const first = await service.deposit(command);
    const second = await service.deposit(command);
    expect(first.availableBalance).toBe(second.availableBalance);
    expect(second.idempotentReplay).toBe(true);
  });

  it("rejects reusing an idempotency key with another payload", async () => {
    await service.deposit({
      userId: "user-1",
      bookmakerAccountId: "account-1",
      amount: "20.00",
      idempotencyKey: "deposit-conflict",
    });
    await expect(
      service.deposit({
        userId: "user-1",
        bookmakerAccountId: "account-1",
        amount: "21.00",
        idempotencyKey: "deposit-conflict",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
