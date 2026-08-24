import { BookmakerAccountStatus } from "@prisma/client";
import { BookmakerAccountRecord } from "../wallets/wallet.types";

export interface BookmakerAccountsRepository {
  list(
    userId: string,
    status?: BookmakerAccountStatus,
  ): Promise<BookmakerAccountRecord[]>;
  findById(userId: string, id: string): Promise<BookmakerAccountRecord | null>;
  updateMetadata(input: {
    userId: string;
    id: string;
    version: number;
    name?: string;
    ownerName?: string | null;
    nickname?: string | null;
    status?: BookmakerAccountStatus;
  }): Promise<
    | { result: "UPDATED"; account: BookmakerAccountRecord }
    | { result: "NOT_FOUND" | "STALE_VERSION" }
  >;
}

export const BOOKMAKER_ACCOUNTS_REPOSITORY = Symbol(
  "BOOKMAKER_ACCOUNTS_REPOSITORY",
);
