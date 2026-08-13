import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { validateEnvironment } from "./config/environment";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BetCreditsModule } from "./modules/bet-credits/bet-credits.module";
import { BookmakerAccountsModule } from "./modules/bookmaker-accounts/bookmaker-accounts.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { HealthModule } from "./modules/health/health.module";
import { OperationsModule } from "./modules/operations/operations.module";
import { UsersModule } from "./modules/users/users.module";
import { WalletsModule } from "./modules/wallets/wallets.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    BookmakerAccountsModule,
    WalletsModule,
    OperationsModule,
    BetCreditsModule,
    DashboardModule,
    AuditModule,
    HealthModule,
  ],
})
export class AppModule {}
