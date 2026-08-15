import { api, commandHeaders } from "../../lib/api/client";

export type ApiBookmaker = {
  id: string;
  name: string;
  nickname: string | null;
  status: string;
  availableBalance: string;
  openStake: string;
  equity: string;
  version: number;
};
export type ApiWalletTransaction = {
  id: string;
  bookmakerAccountId: string;
  type: string;
  amount: string;
  occurredAt: string;
  metadata?: unknown;
  activity?: "BET_EDIT_REFUND" | "BET_CANCEL_REFUND" | "BET_EDIT_STAKE";
};
export const bookmakersApi = {
  list: () => api<{ data: ApiBookmaker[] }>("/bookmaker-accounts"),
  create: (name: string, initialBalance: string) =>
    api<{ account: ApiBookmaker }>("/bookmaker-accounts", {
      method: "POST",
      headers: commandHeaders(),
      body: JSON.stringify({ name, initialBalance, currency: "BRL" }),
    }),
  transactions: (id: string) =>
    api<{ data: ApiWalletTransaction[] }>(
      `/bookmaker-accounts/${id}/transactions?limit=100`,
    ),
  update: (
    account: { id: string; version: number },
    input: { name?: string; nickname?: string; status?: "ACTIVE" | "ARCHIVED" },
  ) =>
    api<{ account: ApiBookmaker }>(`/bookmaker-accounts/${account.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...input, version: account.version }),
    }),
  deposit: (id: string, amount: string, description?: string) =>
    api(`/bookmaker-accounts/${id}/deposits`, {
      method: "POST",
      headers: commandHeaders(),
      body: JSON.stringify({ amount, description }),
    }),
  freeWinning: (id: string, amount: string, description?: string) =>
    api(`/bookmaker-accounts/${id}/free-winnings`, {
      method: "POST",
      headers: commandHeaders(),
      body: JSON.stringify({ amount, description }),
    }),
  withdraw: (id: string, amount: string, description?: string) =>
    api(`/bookmaker-accounts/${id}/withdrawals`, {
      method: "POST",
      headers: commandHeaders(),
      body: JSON.stringify({ amount, description }),
    }),
  adjust: (id: string, amount: string, reason: string) =>
    api(`/bookmaker-accounts/${id}/adjustments`, {
      method: "POST",
      headers: commandHeaders(),
      body: JSON.stringify({ amount, reason }),
    }),
  transfer: (
    sourceBookmakerAccountId: string,
    destinationBookmakerAccountId: string,
    amount: string,
    description?: string,
  ) =>
    api("/bookmaker-accounts/transfers", {
      method: "POST",
      headers: commandHeaders(),
      body: JSON.stringify({
        sourceBookmakerAccountId,
        destinationBookmakerAccountId,
        amount,
        description,
      }),
    }),
};
