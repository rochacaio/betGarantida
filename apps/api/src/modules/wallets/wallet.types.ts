import {
  BetType,
  BookmakerAccountStatus,
  WalletTransactionType,
  ReservedBalanceTransactionType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface BookmakerAccountRecord {
  id: string;
  userId: string;
  name: string;
  ownerName: string | null;
  nickname: string | null;
  currency: string;
  status: BookmakerAccountStatus;
  cachedBalance: Decimal;
  openStake: Decimal;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransactionRecord {
  id: string;
  bookmakerAccountId: string;
  type: WalletTransactionType;
  amount: Decimal;
  occurredAt: Date;
  metadata: unknown;
  idempotencyKey: string;
  betType?: BetType;
}

export interface FinancialCommand {
  userId: string;
  bookmakerAccountId: string;
  type: WalletTransactionType;
  amount: Decimal;
  targetBalance?: Decimal;
  idempotencyKey: string;
  requestHash: string;
  reason?: string;
  auditAdjustment?: boolean;
}

export interface FinancialCommandResult {
  transaction: WalletTransactionRecord;
  resultingBalance: Decimal;
  replayed: boolean;
  requestHash: string;
}

export interface TransferCommand {
  userId: string;
  sourceBookmakerAccountId: string;
  destinationBookmakerAccountId: string;
  amount: Decimal;
  description?: string;
  idempotencyKey: string;
  requestHash: string;
}

export interface TransferCommandResult {
  debitTransaction: WalletTransactionRecord;
  creditTransaction: WalletTransactionRecord;
  sourceBalance: Decimal;
  destinationBalance: Decimal;
  replayed: boolean;
  requestHash: string;
}

export interface ReservedBalanceCommand {
  userId: string;
  bookmakerAccountId: string;
  direction: "FROM_BOOKMAKER" | "TO_BOOKMAKER";
  amount: Decimal;
  description?: string;
  idempotencyKey: string;
  requestHash: string;
}

export interface ReservedBalanceCommandResult {
  transactionId: string;
  transactionType: ReservedBalanceTransactionType;
  bookmakerTransaction: WalletTransactionRecord;
  reservedBalance: Decimal;
  bookmakerBalance: Decimal;
  replayed: boolean;
  requestHash: string;
}

export interface ReservedBalanceSnapshot {
  balance: Decimal;
  transactions: Array<{
    id: string;
    bookmakerAccountId: string;
    type: ReservedBalanceTransactionType;
    amount: Decimal;
    occurredAt: Date;
    metadata: unknown;
  }>;
}

export interface CreateAccountCommand {
  userId: string;
  name: string;
  ownerName?: string;
  nickname?: string;
  currency: string;
  initialBalance: Decimal;
  idempotencyKey: string;
  requestHash: string;
}

export interface WalletRepository {
  createAccountWithInitialBalance(command: CreateAccountCommand): Promise<{
    account: BookmakerAccountRecord;
    replayed: boolean;
    requestHash: string;
  }>;
  applyFinancialCommand(
    command: FinancialCommand,
  ): Promise<FinancialCommandResult>;
  transfer(command: TransferCommand): Promise<TransferCommandResult>;
  moveReservedBalance(
    command: ReservedBalanceCommand,
  ): Promise<ReservedBalanceCommandResult>;
  getReservedBalance(userId: string): Promise<ReservedBalanceSnapshot>;
  listTransactions(input: {
    userId: string;
    bookmakerAccountId: string;
    cursor?: string;
    limit: number;
  }): Promise<{
    items: WalletTransactionRecord[];
    nextCursor: string | null;
  } | null>;
  reconcileUser(userId: string): Promise<
    Array<{
      bookmakerAccountId: string;
      cachedBalance: Decimal;
      ledgerBalance: Decimal;
    }>
  >;
}

export const WALLET_REPOSITORY = Symbol("WALLET_REPOSITORY");
