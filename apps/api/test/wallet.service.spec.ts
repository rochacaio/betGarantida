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
  ReservedBalanceCommand,
  TransferCommand,
  WalletRepository,
  WalletTransactionRecord,
} from "../src/modules/wallets/wallet.types";

class MemoryWalletRepository implements WalletRepository {
  balance = new Prisma.Decimal(0);
  reservedBalance = new Prisma.Decimal(0);
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
    const transactionAmount = command.targetBalance
      ? command.targetBalance.sub(this.balance)
      : command.amount;
    this.balance = command.targetBalance ?? this.balance.add(command.amount);
    const result = {
      transaction: this.transaction(command.type, transactionAmount),
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

  transfer(command: TransferCommand) {
    const previous = this.requests.get(command.idempotencyKey);
    if (previous) return Promise.resolve(previous.result);
    const sourceBalance = this.balance.sub(command.amount);
    if (sourceBalance.isNegative())
      return Promise.reject(new Error("insufficient test balance"));
    this.balance = sourceBalance;
    const result = {
      debitTransaction: this.transaction(
        WalletTransactionType.TRANSFER_OUT,
        command.amount.negated(),
      ),
      creditTransaction: this.transaction(
        WalletTransactionType.TRANSFER_IN,
        command.amount,
      ),
      sourceBalance,
      destinationBalance: command.amount,
      replayed: false,
      requestHash: command.requestHash,
    };
    this.requests.set(command.idempotencyKey, {
      hash: command.requestHash,
      result: { ...result, replayed: true },
    });
    return Promise.resolve(result);
  }

  moveReservedBalance(command: ReservedBalanceCommand) {
    const fromBookmaker = command.direction === "FROM_BOOKMAKER";
    this.balance = this.balance.add(
      fromBookmaker ? command.amount.negated() : command.amount,
    );
    this.reservedBalance = this.reservedBalance.add(
      fromBookmaker ? command.amount : command.amount.negated(),
    );
    return Promise.resolve({
      transactionId: "33333333-3333-4333-8333-333333333333",
      transactionType: fromBookmaker
        ? ("FROM_BOOKMAKER" as const)
        : ("TO_BOOKMAKER" as const),
      bookmakerTransaction: this.transaction(
        fromBookmaker
          ? WalletTransactionType.RESERVED_OUT
          : WalletTransactionType.RESERVED_IN,
        fromBookmaker ? command.amount.negated() : command.amount,
      ),
      reservedBalance: this.reservedBalance,
      bookmakerBalance: this.balance,
      replayed: false,
      requestHash: command.requestHash,
    });
  }

  getReservedBalance() {
    return Promise.resolve({ balance: this.reservedBalance, transactions: [] });
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
      ownerName: "Caio",
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
      idempotencyKey: `test:${type}`,
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
      ownerName: "Caio",
      currency: "BRL",
      initialBalance: "100.50",
      idempotencyKey: "create-account-1",
    });
    expect(result.account).toMatchObject({
      ownerName: "Caio",
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

  it("records free winnings as profit without classifying them as deposits", async () => {
    const result = await service.freeWinning({
      userId: "user-1",
      bookmakerAccountId: "account-1",
      amount: "3.00",
      description: "40 giros grátis",
      idempotencyKey: "free-winning-0001",
    });
    expect(result.availableBalance).toBe("3.00");
    expect(repository.lastFinancialCommand).toMatchObject({
      type: WalletTransactionType.BONUS_RECEIVED,
      reason: "40 giros grátis",
    });
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

  it("defines the final balance and records only the difference as adjustment", async () => {
    repository.balance = new Prisma.Decimal("300.00");
    await service.adjust({
      userId: "user-1",
      bookmakerAccountId: "account-1",
      amount: "120.00",
      reason: "Correção de saldo",
      idempotencyKey: "adjustment-02",
    });
    expect(repository.lastFinancialCommand?.auditAdjustment).toBe(true);
    expect(repository.lastFinancialCommand?.targetBalance?.toFixed(2)).toBe(
      "120.00",
    );
    expect(repository.balance.toFixed(2)).toBe("120.00");
  });

  it("permite ajustar o saldo final para zero, mas não para negativo", async () => {
    repository.balance = new Prisma.Decimal("50.00");
    await service.adjust({
      userId: "user-1",
      bookmakerAccountId: "account-1",
      amount: "0.00",
      reason: "Conferência",
      idempotencyKey: "adjustment-zero",
    });
    expect(repository.balance.toFixed(2)).toBe("0.00");
    expect(() =>
      service.adjust({
        userId: "user-1",
        bookmakerAccountId: "account-1",
        amount: "-1.00",
        reason: "Inválido",
        idempotencyKey: "adjustment-negative",
      }),
    ).toThrow(UnprocessableEntityException);
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

  it("transfers the value between different bookmaker accounts", async () => {
    repository.balance = new Prisma.Decimal("200.00");
    const result = await service.transfer({
      userId: "user-1",
      sourceBookmakerAccountId: "11111111-1111-4111-8111-111111111111",
      destinationBookmakerAccountId: "22222222-2222-4222-8222-222222222222",
      amount: "75.50",
      description: "Troca de casa",
      idempotencyKey: "transfer-0001",
    });
    expect(result).toMatchObject({
      sourceBalance: "124.50",
      destinationBalance: "75.50",
      idempotentReplay: false,
    });
    expect(repository.balance.toFixed(2)).toBe("124.50");
  });

  it("moves money from a bookmaker into the reserved balance", async () => {
    repository.balance = new Prisma.Decimal("100.00");
    const result = await service.moveReservedBalance({
      userId: "user-1",
      bookmakerAccountId: "11111111-1111-4111-8111-111111111111",
      direction: "FROM_BOOKMAKER",
      amount: "30.00",
      idempotencyKey: "reserve-from-bookmaker",
    });
    expect(result).toMatchObject({
      bookmakerBalance: "70.00",
      reservedBalance: "30.00",
    });
  });

  it("moves reserved money into a bookmaker", async () => {
    repository.reservedBalance = new Prisma.Decimal("30.00");
    const result = await service.moveReservedBalance({
      userId: "user-1",
      bookmakerAccountId: "11111111-1111-4111-8111-111111111111",
      direction: "TO_BOOKMAKER",
      amount: "20.00",
      idempotencyKey: "reserve-to-bookmaker",
    });
    expect(result).toMatchObject({
      bookmakerBalance: "20.00",
      reservedBalance: "10.00",
    });
  });

  it("rejects transfers to the same bookmaker account", async () => {
    await expect(
      service.transfer({
        userId: "user-1",
        sourceBookmakerAccountId: "11111111-1111-4111-8111-111111111111",
        destinationBookmakerAccountId: "11111111-1111-4111-8111-111111111111",
        amount: "10.00",
        idempotencyKey: "transfer-same-account",
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
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
