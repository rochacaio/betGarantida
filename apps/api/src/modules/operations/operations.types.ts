import { OperationStatus, Prisma } from "@prisma/client";

export interface OperationLegCommand {
  bookmakerAccountId: string;
  betCreditId?: string;
  stake: Prisma.Decimal;
  odd: Prisma.Decimal;
  commissionPercent: Prisma.Decimal;
  cashbackPercent: Prisma.Decimal;
  increasePercent: Prisma.Decimal;
  usesBetCredit: boolean;
  usesFreeBetCredit: boolean;
  profitFactor: Prisma.Decimal;
  effectiveOdd: Prisma.Decimal;
  projectedPayout: Prisma.Decimal;
  scenarioResult: Prisma.Decimal;
}

export interface OperationWriteCommand {
  userId: string;
  eventName: string;
  notes?: string;
  generatesBetCredit: boolean;
  expectedBetCredit?: Prisma.Decimal;
  realCashInvestment: Prisma.Decimal;
  promotionalStake: Prisma.Decimal;
  protectedReturn: Prisma.Decimal;
  projectedProfit: Prisma.Decimal;
  projectedRoiPercent: Prisma.Decimal;
  engineVersion: string;
  calculationSnapshot: Prisma.InputJsonValue;
  legs: OperationLegCommand[];
  idempotencyKey: string;
  requestHash: string;
}

export interface ListOperationsInput {
  userId: string;
  status?: OperationStatus;
  from?: Date;
  to?: Date;
  bookmakerAccountId?: string;
  search?: string;
  cursor?: string;
  limit: number;
}

export type OperationRecord = Prisma.OperationGetPayload<{
  include: {
    legs: true;
    generatedCredit: { include: { consumerOperation: true } };
    consumedCredits: { include: { sourceOperation: true } };
  };
}>;

export interface OperationsRepository {
  create(command: OperationWriteCommand): Promise<OperationRecord>;
  update(
    command: OperationWriteCommand & { operationId: string; version: number },
  ): Promise<OperationRecord>;
  findById(
    userId: string,
    operationId: string,
  ): Promise<OperationRecord | null>;
  list(
    input: ListOperationsInput,
  ): Promise<{ items: OperationRecord[]; nextCursor: string | null }>;
  cancel(input: {
    userId: string;
    operationId: string;
    version: number;
    reason?: string;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<OperationRecord>;
  settle(input: {
    userId: string;
    operationId: string;
    version: number;
    creditGenerated?: boolean;
    grantedCreditAmount?: Prisma.Decimal;
    legs: Array<{ legId: string; result: "WON" | "LOST" }>;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<OperationRecord>;
  correctGeneratedCredit(input: {
    userId: string;
    operationId: string;
    version: number;
    grantedCreditAmount: Prisma.Decimal;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<OperationRecord>;
  deleteOperation(input: {
    userId: string;
    operationId: string;
    version: number;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<OperationRecord>;
}

export const OPERATIONS_REPOSITORY = Symbol("OPERATIONS_REPOSITORY");

export class OperationNotFoundError extends Error {}
export class OperationNotOpenError extends Error {}
export class OperationStaleVersionError extends Error {}
export class OperationAccountError extends Error {}
export class OperationInsufficientBalanceError extends Error {
  constructor(public readonly bookmakerAccountId: string) {
    super();
  }
}
export class OperationCreditUnavailableError extends Error {}
export class OperationCreditReservedError extends Error {}
export class OperationCreditCorrectionUnavailableError extends Error {}
export class OperationInvalidSettlementError extends Error {}
export class OperationDeleteCreditInUseError extends Error {}
export class OperationIdempotencyConflictError extends Error {}
