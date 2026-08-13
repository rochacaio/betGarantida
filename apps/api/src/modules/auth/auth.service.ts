import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthRateLimitAction, Prisma, UserStatus } from "@prisma/client";
import { AUTH_EMAIL_SERVICE, AUTH_REPOSITORY } from "./auth.constants";
import { AuthEmailService, AuthRepository, SessionResult } from "./auth.types";
import { CryptoService } from "./crypto.service";
import { isValidCpf, normalizeCpf } from "./cpf";
import { LoginDto } from "./dto/login.dto";
import { PasswordRecoveryDto } from "./dto/password-recovery.dto";
import { PasswordResetDto } from "./dto/password-reset.dto";
import { RegisterDto } from "./dto/register.dto";

const RECOVERY_RESPONSE = {
  message:
    "Se os dados corresponderem a uma conta, enviaremos as instruções de recuperação.",
} as const;

@Injectable()
export class AuthService {
  private readonly dummyHash: Promise<string>;

  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    @Inject(AUTH_EMAIL_SERVICE) private readonly emailService: AuthEmailService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {
    this.dummyHash = this.crypto.hashPassword("invalid-user-password");
  }

  async register(dto: RegisterDto, ip: string): Promise<SessionResult> {
    const email = this.crypto.normalizeEmail(dto.email);
    await this.enforceRateLimit(
      AuthRateLimitAction.LOGIN,
      `register:ip:${ip}`,
      10,
    );
    const cpf = normalizeCpf(dto.cpf);
    if (!isValidCpf(cpf)) throw new BadRequestException("CPF inválido.");

    const passwordHash = await this.crypto.hashPassword(dto.password);
    const token = this.crypto.createOpaqueToken();
    const expiresAt = this.sessionExpiration();
    try {
      const created = await this.repository.createUserWithSession({
        email,
        cpfHash: this.crypto.hashCpf(cpf),
        cpfEncrypted: this.crypto.encryptCpf(cpf),
        passwordHash,
        sessionTokenHash: this.crypto.hashToken(token),
        sessionExpiresAt: expiresAt,
      });
      return { id: created.sessionId, token, expiresAt, user: created.user };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("E-mail ou CPF já cadastrado.");
      }
      throw error;
    }
  }

  async login(dto: LoginDto, ip: string): Promise<SessionResult> {
    const email = this.crypto.normalizeEmail(dto.email);
    await this.enforceRateLimit(
      AuthRateLimitAction.LOGIN,
      `login:ip:${ip}`,
      20,
    );
    await this.enforceRateLimit(
      AuthRateLimitAction.LOGIN,
      `login:id:${email}`,
      8,
    );

    const user = await this.repository.findUserByEmail(email);
    const validPassword = await this.crypto.verifyPassword(
      user?.passwordHash ?? (await this.dummyHash),
      dto.password,
    );
    if (!user || !validPassword || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }

    const token = this.crypto.createOpaqueToken();
    const expiresAt = this.sessionExpiration();
    const session = await this.repository.createSession({
      userId: user.id,
      tokenHash: this.crypto.hashToken(token),
      expiresAt,
    });
    const safeUser = {
      id: user.id,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
    };
    return { id: session.id, token, expiresAt, user: safeUser };
  }

  async logout(sessionId: string): Promise<void> {
    await this.repository.revokeSession(sessionId, new Date());
  }

  async requestPasswordRecovery(dto: PasswordRecoveryDto, ip: string) {
    const email = this.crypto.normalizeEmail(dto.email);
    await this.enforceRateLimit(
      AuthRateLimitAction.PASSWORD_RECOVERY,
      `recovery:ip:${ip}`,
      10,
    );
    await this.enforceRateLimit(
      AuthRateLimitAction.PASSWORD_RECOVERY,
      `recovery:id:${email}`,
      3,
    );

    const cpf = normalizeCpf(dto.cpf);
    const user = await this.repository.findUserByEmailAndCpfHash(
      email,
      this.crypto.hashCpf(cpf),
    );
    if (!isValidCpf(cpf)) return RECOVERY_RESPONSE;
    if (!user) return RECOVERY_RESPONSE;

    const token = this.crypto.createOpaqueToken();
    const now = new Date();
    const ttlMinutes =
      this.config.get<number>("PASSWORD_RESET_TTL_MINUTES") ?? 30;
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
    await this.repository.createPasswordResetToken({
      userId: user.id,
      tokenHash: this.crypto.hashToken(token),
      expiresAt,
      now,
    });
    await this.emailService
      .sendPasswordReset({ email: user.email, token, expiresAt })
      .catch(() => undefined);
    return RECOVERY_RESPONSE;
  }

  async resetPassword(
    dto: PasswordResetDto,
    ip: string,
  ): Promise<{ message: string }> {
    await this.enforceRateLimit(
      AuthRateLimitAction.PASSWORD_RESET,
      `reset:ip:${ip}`,
      10,
    );
    const updated = await this.repository.resetPasswordWithToken({
      tokenHash: this.crypto.hashToken(dto.token),
      passwordHash: await this.crypto.hashPassword(dto.newPassword),
      now: new Date(),
    });
    if (!updated) throw new BadRequestException("Token inválido ou expirado.");
    return { message: "Senha atualizada. Entre novamente em sua conta." };
  }

  private sessionExpiration(): Date {
    const days = this.config.get<number>("SESSION_TTL_DAYS") ?? 30;
    return new Date(Date.now() + days * 86_400_000);
  }

  private async enforceRateLimit(
    action: AuthRateLimitAction,
    identifier: string,
    limit: number,
  ): Promise<void> {
    const allowed = await this.repository.consumeRateLimit({
      keyHash: this.crypto.hashRateLimitKey(`${action}:${identifier}`),
      action,
      limit,
      windowMs: 15 * 60_000,
      blockMs: 30 * 60_000,
      now: new Date(),
    });
    if (!allowed) {
      throw new HttpException(
        "Muitas tentativas. Tente novamente mais tarde.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
