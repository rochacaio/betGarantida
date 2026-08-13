import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
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
import { RequestContextMiddleware } from "./request-context.middleware";
import { RequestLoggingInterceptor } from "./request-logging.interceptor";
import { ObservabilityModule } from "./observability.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    ObservabilityModule,
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
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
