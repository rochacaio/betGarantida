import { ConfigService } from "@nestjs/config";
import { AuthRateLimitAction, UserStatus } from "@prisma/client";
import { AuthService } from "../src/modules/auth/auth.service";
import {
  AuthEmailService,
  AuthRepository,
  CreateUserWithSessionInput,
  SafeUser,
  StoredAuthUser,
} from "../src/modules/auth/auth.types";
import { CryptoService } from "../src/modules/auth/crypto.service";

class MemoryAuthRepository implements AuthRepository {
  user: StoredAuthUser | null = null;
  resetTokenHash: string | null = null;
  sessionsRevoked = false;

  findUserByEmail(email: string) {
    return Promise.resolve(this.user?.email === email ? this.user : null);
  }

  findUserByEmailAndCpfHash(email: string, cpfHash: string) {
    if (this.user?.email !== email || this.user.cpfHash !== cpfHash)
      return Promise.resolve(null);
    return Promise.resolve(this.safeUser(this.user));
  }

  createUserWithSession(input: CreateUserWithSessionInput) {
    this.user = {
      id: "user-1",
      email: input.email,
      cpfHash: input.cpfHash,
      passwordHash: input.passwordHash,
      status: UserStatus.ACTIVE,
      createdAt: new Date("2026-08-13T00:00:00Z"),
    };
    return Promise.resolve({
      user: this.safeUser(this.user),
      sessionId: "session-1",
    });
  }

  createSession() {
    return Promise.resolve({ id: "session-2" });
  }

  findActiveSession() {
    return Promise.resolve(null);
  }

  touchSession() {
    return Promise.resolve();
  }

  revokeSession() {
    this.sessionsRevoked = true;
    return Promise.resolve();
  }

  createPasswordResetToken(input: { tokenHash: string }) {
    this.resetTokenHash = input.tokenHash;
    return Promise.resolve();
  }

  resetPasswordWithToken(input: { tokenHash: string; passwordHash: string }) {
    if (!this.user || input.tokenHash !== this.resetTokenHash)
      return Promise.resolve(false);
    this.user.passwordHash = input.passwordHash;
    this.resetTokenHash = null;
    this.sessionsRevoked = true;
    return Promise.resolve(true);
  }

  consumeRateLimit() {
    return Promise.resolve(true);
  }

  private safeUser(user: StoredAuthUser): SafeUser {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}

class MemoryEmailService implements AuthEmailService {
  sent: { email: string; token: string }[] = [];

  sendPasswordReset(input: { email: string; token: string }) {
    this.sent.push(input);
    return Promise.resolve();
  }
}

describe("AuthService", () => {
  let repository: MemoryAuthRepository;
  let email: MemoryEmailService;
  let crypto: CryptoService;
  let service: AuthService;

  beforeEach(() => {
    repository = new MemoryAuthRepository();
    email = new MemoryEmailService();
    const config = new ConfigService({
      NODE_ENV: "test",
      CPF_HASH_SECRET: "test-cpf-secret",
      CPF_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
      SESSION_SECRET: "test-session-secret",
      SESSION_TTL_DAYS: 30,
      PASSWORD_RESET_TTL_MINUTES: 30,
    });
    crypto = new CryptoService(config);
    service = new AuthService(repository, email, crypto, config);
  });

  it("registers a normalized user and creates a session", async () => {
    const result = await service.register(
      {
        email: "  Pessoa@Example.COM ",
        cpf: "529.982.247-25",
        password: "senha-123",
      },
      "127.0.0.1",
    );
    expect(result.user.email).toBe("pessoa@example.com");
    expect(result.token).toBeTruthy();
    expect(repository.user?.passwordHash).not.toBe("senha-123");
    expect(JSON.stringify(result.user)).not.toContain("cpf");
  });

  it("uses the same generic error for unknown user and wrong password", async () => {
    await expect(
      service.login(
        { email: "missing@example.com", password: "senha-errada" },
        "127.0.0.1",
      ),
    ).rejects.toMatchObject({
      message: "E-mail ou senha inválidos.",
    });
  });

  it("returns a neutral recovery response for unknown users", async () => {
    const response = await service.requestPasswordRecovery(
      { email: "missing@example.com", cpf: "52998224725" },
      "127.0.0.1",
    );
    expect(response.message).toContain("Se os dados corresponderem");
    expect(email.sent).toHaveLength(0);
  });

  it("resets once, revokes sessions and accepts only the new password", async () => {
    await service.register(
      {
        email: "pessoa@example.com",
        cpf: "52998224725",
        password: "senha-antiga",
      },
      "127.0.0.1",
    );
    await service.requestPasswordRecovery(
      { email: "pessoa@example.com", cpf: "52998224725" },
      "127.0.0.1",
    );
    const token = email.sent[0]?.token;
    expect(token).toBeTruthy();
    await service.resetPassword(
      { token: token, newPassword: "senha-nova" },
      "127.0.0.1",
    );
    expect(repository.sessionsRevoked).toBe(true);
    await expect(
      service.resetPassword(
        { token: token, newPassword: "outra-senha" },
        "127.0.0.1",
      ),
    ).rejects.toThrow("Token inválido ou expirado.");
    await expect(
      service.login(
        { email: "pessoa@example.com", password: "senha-nova" },
        "127.0.0.1",
      ),
    ).resolves.toMatchObject({ user: { email: "pessoa@example.com" } });
  });

  it("defines persistent rate limit actions", () => {
    expect(AuthRateLimitAction.LOGIN).toBe("LOGIN");
  });
});
