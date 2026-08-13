import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AUTH_EMAIL_SERVICE, AUTH_REPOSITORY } from "./auth.constants";
import { AuthController } from "./auth.controller";
import { DefaultAuthEmailService } from "./auth-email.service";
import { AuthService } from "./auth.service";
import { CryptoService } from "./crypto.service";
import { PrismaAuthRepository } from "./prisma-auth.repository";
import { SessionGuard } from "./session.guard";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    CryptoService,
    PrismaAuthRepository,
    DefaultAuthEmailService,
    { provide: AUTH_REPOSITORY, useExisting: PrismaAuthRepository },
    { provide: AUTH_EMAIL_SERVICE, useExisting: DefaultAuthEmailService },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [CryptoService, AUTH_REPOSITORY],
})
export class AuthModule {}
