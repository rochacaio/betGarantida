import { AuthRateLimitAction, UserStatus } from "@prisma/client";

export interface SafeUser {
  id: string;
  email: string;
  status: UserStatus;
  createdAt: Date;
}

export interface StoredAuthUser extends SafeUser {
  passwordHash: string;
  cpfHash: string;
}

export interface AuthenticatedUser extends SafeUser {
  sessionId: string;
}

export interface SessionResult {
  id: string;
  token: string;
  expiresAt: Date;
  user: SafeUser;
}

export interface ActiveSession {
  id: string;
  expiresAt: Date;
  lastUsedAt: Date | null;
  user: SafeUser;
}

export interface CreateUserWithSessionInput {
  email: string;
  cpfHash: string;
  cpfEncrypted: string;
  passwordHash: string;
  sessionTokenHash: string;
  sessionExpiresAt: Date;
}

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RateLimitInput {
  keyHash: string;
  action: AuthRateLimitAction;
  limit: number;
  windowMs: number;
  blockMs: number;
  now: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<StoredAuthUser | null>;
  findUserByEmailAndCpfHash(
    email: string,
    cpfHash: string,
  ): Promise<SafeUser | null>;
  createUserWithSession(
    input: CreateUserWithSessionInput,
  ): Promise<{ user: SafeUser; sessionId: string }>;
  createSession(input: CreateSessionInput): Promise<{ id: string }>;
  findActiveSession(
    tokenHash: string,
    now: Date,
  ): Promise<ActiveSession | null>;
  touchSession(sessionId: string, at: Date): Promise<void>;
  revokeSession(sessionId: string, at: Date): Promise<void>;
  createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<void>;
  resetPasswordWithToken(input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }): Promise<boolean>;
  consumeRateLimit(input: RateLimitInput): Promise<boolean>;
}

export interface AuthEmailService {
  sendPasswordReset(input: {
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}
