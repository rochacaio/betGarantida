import { Module } from "@nestjs/common";
import { WalletsModule } from "../wallets/wallets.module";
import { BOOKMAKER_ACCOUNTS_REPOSITORY } from "./bookmaker-account.types";
import { BookmakerAccountsController } from "./bookmaker-accounts.controller";
import { BookmakerAccountsService } from "./bookmaker-accounts.service";
import { PrismaBookmakerAccountsRepository } from "./prisma-bookmaker-accounts.repository";

@Module({
  imports: [WalletsModule],
  controllers: [BookmakerAccountsController],
  providers: [
    BookmakerAccountsService,
    PrismaBookmakerAccountsRepository,
    {
      provide: BOOKMAKER_ACCOUNTS_REPOSITORY,
      useExisting: PrismaBookmakerAccountsRepository,
    },
  ],
})
export class BookmakerAccountsModule {}
