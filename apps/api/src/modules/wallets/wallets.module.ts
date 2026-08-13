import { Module } from "@nestjs/common";
import { PrismaWalletRepository } from "./prisma-wallet.repository";
import { WalletService } from "./wallet.service";
import { WALLET_REPOSITORY } from "./wallet.types";

@Module({
  providers: [
    WalletService,
    PrismaWalletRepository,
    { provide: WALLET_REPOSITORY, useExisting: PrismaWalletRepository },
  ],
  exports: [WalletService, WALLET_REPOSITORY],
})
export class WalletsModule {}
