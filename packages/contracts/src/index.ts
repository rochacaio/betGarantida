export const API_PREFIX = "api/v1" as const;
export const API_VERSION = "1" as const;

export interface ApiErrorField {
  path: string;
  code: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: ApiErrorField[];
    requestId: string;
  };
}

export interface PageInfo {
  nextCursor: string | null;
  hasNextPage: boolean;
}

export type OperationStatus =
  | "OPEN"
  | "WAITING_CREDIT_USE"
  | "SETTLED"
  | "CANCELLED";
export type BetLegResult = "PENDING" | "WON" | "LOST";
export type BetType = "BACK" | "LAY";
export type BetCreditStatus =
  | "EXPECTED"
  | "AVAILABLE"
  | "NOT_GRANTED"
  | "CONSUMED"
  | "EXPIRED"
  | "CANCELLED";

export interface OperationLegInput {
  selectionName?: string;
  bookmakerAccountId: string;
  betType?: BetType;
  stake: string;
  odd: string;
  commissionPercent?: string;
  cashbackPercent?: string;
  increasePercent?: string;
  usesBetCredit?: boolean;
  betCreditId?: string;
}

export interface OperationWriteInput {
  eventName: string;
  notes?: string;
  generatesBetCredit?: boolean;
  expectedBetCredit?: string;
  legs: OperationLegInput[];
}

export interface MonthlyDashboardResponse {
  month: string;
  timezone: string;
  metrics: {
    realizedProfit: string;
    realizedLoss: string;
    netResult: string;
    roiPercent: string;
    realCashInvestmentSettled: string;
    settledOperations: number;
    openStake: string;
    availableBalance: string;
    equity: string;
    previousMonthComparisonPercent: string | null;
  };
}
