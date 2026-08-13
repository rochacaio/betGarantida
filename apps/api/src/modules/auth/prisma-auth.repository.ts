import { Injectable } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  ActiveSession,
  AuthRepository,
  CreateSessionInput,
  CreateUserWithSessionInput,
  RateLimitInput,
  SafeUser,
  StoredAuthUser,
} from "./auth.types";

const safeUserSelect = {
  id: true,
  email: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<StoredAuthUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { ...safeUserSelect, passwordHash: true, cpfHash: true },
    });
  }

  findUserByEmailAndCpfHash(
    email: string,
    cpfHash: string,
  ): Promise<SafeUser | null> {
    return this.prisma.user.findFirst({
      where: { email, cpfHash, status: UserStatus.ACTIVE },
      select: safeUserSelect,
    });
  }

  async createUserWithSession(
    input: CreateUserWithSessionInput,
  ): Promise<{ user: SafeUser; sessionId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          cpfHash: input.cpfHash,
          cpfEncrypted: input.cpfEncrypted,
          passwordHash: input.passwordHash,
        },
        select: safeUserSelect,
      });
      const session = await tx.session.create({
        data: {
          userId: user.id,
          tokenHash: input.sessionTokenHash,
          expiresAt: input.sessionExpiresAt,
        },
        select: { id: true },
      });
      return { user, sessionId: session.id };
    });
  }

  createSession(input: CreateSessionInput): Promise<{ id: string }> {
    return this.prisma.session.create({ data: input, select: { id: true } });
  }

  findActiveSession(
    tokenHash: string,
    now: Date,
  ): Promise<ActiveSession | null> {
    return this.prisma.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        expiresAt: true,
        lastUsedAt: true,
        user: { select: safeUserSelect },
      },
    });
  }

  async touchSession(sessionId: string, at: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastUsedAt: at },
    });
  }

  async revokeSession(sessionId: string, at: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: input.userId, usedAt: null, revokedAt: null },
        data: { revokedAt: input.now },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      }),
    ]);
  }

  async resetPasswordWithToken(input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        const token = await tx.passwordResetToken.findFirst({
          where: {
            tokenHash: input.tokenHash,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: input.now },
          },
          select: { id: true, userId: true },
        });
        if (!token) return false;

        const claimed = await tx.passwordResetToken.updateMany({
          where: { id: token.id, usedAt: null, revokedAt: null },
          data: { usedAt: input.now },
        });
        if (claimed.count !== 1) return false;

        await tx.user.update({
          where: { id: token.userId },
          data: { passwordHash: input.passwordHash },
        });
        await tx.session.updateMany({
          where: { userId: token.userId, revokedAt: null },
          data: { revokedAt: input.now },
        });
        await tx.passwordResetToken.updateMany({
          where: {
            userId: token.userId,
            id: { not: token.id },
            revokedAt: null,
          },
          data: { revokedAt: input.now },
        });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async consumeRateLimit(input: RateLimitInput): Promise<boolean> {
    const key = {
      keyHash_action: { keyHash: input.keyHash, action: input.action },
    };
    const record = await this.prisma.authRateLimit.upsert({
      where: key,
      create: {
        keyHash: input.keyHash,
        action: input.action,
        attempts: 0,
        windowStart: input.now,
      },
      update: {},
    });

    if (record.blockedUntil && record.blockedUntil > input.now) return false;

    if (input.now.getTime() - record.windowStart.getTime() >= input.windowMs) {
      await this.prisma.authRateLimit.update({
        where: key,
        data: { attempts: 1, windowStart: input.now, blockedUntil: null },
      });
      return true;
    }

    const updated = await this.prisma.authRateLimit.update({
      where: key,
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    if (updated.attempts <= input.limit) return true;

    await this.prisma.authRateLimit.update({
      where: key,
      data: { blockedUntil: new Date(input.now.getTime() + input.blockMs) },
    });
    return false;
  }
}
