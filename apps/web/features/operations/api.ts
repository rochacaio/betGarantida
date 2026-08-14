import { api, commandHeaders } from "../../lib/api/client";

export type ApiLeg = {
  id: string;
  bookmakerAccountId: string;
  betCreditId: string | null;
  stake: string;
  odd: string;
  commissionPercent: string;
  cashbackPercent: string;
  increasePercent: string;
  usesBetCredit: boolean;
  usesFreeBetCredit: boolean;
  result: "PENDING" | "WON" | "LOST";
  scenarioResult: string;
};
export type ApiOperation = {
  id: string;
  sequenceNumber: number;
  eventName: string;
  status: "OPEN" | "WAITING_CREDIT_USE" | "SETTLED" | "CANCELLED";
  projectedProfit: string;
  projectedRoiPercent: string;
  realizedProfit: string | null;
  realizedRoiPercent: string | null;
  combinedPromotionProfit: string | null;
  version: number;
  createdAt: string;
  generatesBetCredit: boolean;
  generatedCredit: {
    id: string;
    expectedAmount: string;
    grantedAmount: string | null;
    status: string;
    consumerOperation: { id: string; eventName: string } | null;
  } | null;
  legs: ApiLeg[];
};
export type OperationInput = {
  eventName: string;
  notes?: string;
  generatesBetCredit: boolean;
  expectedBetCredit?: string;
  legs: Array<{
    bookmakerAccountId: string;
    stake: string;
    odd: string;
    commissionPercent: string;
    cashbackPercent: string;
    increasePercent: string;
    usesBetCredit: boolean;
    usesFreeBetCredit: boolean;
    betCreditId?: string;
  }>;
};
export const operationsApi = {
  list: () => api<{ data: ApiOperation[] }>("/operations?limit=100"),
  create: (input: OperationInput) =>
    api<{ operation: ApiOperation }>("/operations", {
      method: "POST",
      headers: commandHeaders(),
      body: JSON.stringify(input),
    }),
  update: (id: string, version: number, input: OperationInput) =>
    api<{ operation: ApiOperation }>(`/operations/${id}`, {
      method: "PATCH",
      headers: commandHeaders(),
      body: JSON.stringify({ ...input, version }),
    }),
  delete: (operation: { id: string; version: number }) =>
    api<{ operation: ApiOperation }>(`/operations/${operation.id}`, {
      method: "DELETE",
      headers: commandHeaders(),
      body: JSON.stringify({ version: operation.version }),
    }),
  settle: (
    operation: { id: string; version: number },
    legs: Array<{ legId: string; result: "WON" | "LOST" }>,
    creditGenerated?: boolean,
    grantedCreditAmount?: string,
  ) =>
    api<{ operation: ApiOperation }>(`/operations/${operation.id}/settle`, {
      method: "POST",
      headers: commandHeaders(),
      body: JSON.stringify({
        version: operation.version,
        legs,
        creditGenerated,
        grantedCreditAmount,
      }),
    }),
  correctGeneratedCredit: (
    operation: { id: string; version: number },
    grantedCreditAmount: string,
  ) =>
    api<{ operation: ApiOperation }>(
      `/operations/${operation.id}/generated-credit`,
      {
        method: "PATCH",
        headers: commandHeaders(),
        body: JSON.stringify({
          version: operation.version,
          grantedCreditAmount,
        }),
      },
    ),
  expireGeneratedCredit: (operation: { id: string; version: number }) =>
    api<{ operation: ApiOperation }>(
      `/operations/${operation.id}/generated-credit/expire`,
      {
        method: "POST",
        headers: commandHeaders(),
        body: JSON.stringify({ version: operation.version }),
      },
    ),
  cancel: (operation: { id: string; version: number }, reason?: string) =>
    api<{ operation: ApiOperation }>(`/operations/${operation.id}/cancel`, {
      method: "POST",
      headers: commandHeaders(),
      body: JSON.stringify({ version: operation.version, reason }),
    }),
  preview: (legs: Array<Record<string, unknown>>) =>
    api<{ stakes: string[]; snapshot: Record<string, unknown> }>(
      "/operations/preview",
      { method: "POST", body: JSON.stringify({ legs }) },
    ),
  credits: () =>
    api<{
      data: Array<{
        id: string;
        grantedAmount: string;
        sourceOperation: { eventName: string };
      }>;
    }>("/bet-credits?status=AVAILABLE"),
};
