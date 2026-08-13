import { api } from "../../lib/api/client";

export type DashboardData = {
  month: string;
  metrics: {
    realizedProfit: string;
    realizedLoss: string;
    netResult: string;
    roiPercent: string;
    settledOperations: number;
    openStake: string;
    availableBalance: string;
    equity: string;
  };
  dailyEvolution: Array<{ date: string; result: string; accumulated: string }>;
  balancesByBookmaker: Array<{
    id: string;
    name: string;
    availableBalance: string;
    openStake: string;
    equity: string;
    monthlyResult: string;
  }>;
  recentOperations: unknown[];
};
export const dashboardApi = {
  monthly: (month: string) =>
    api<DashboardData>(`/dashboard/monthly?month=${month}`),
};
