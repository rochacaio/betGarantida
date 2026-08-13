import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { parse } from "cookie";
import {
  AUTH_REPOSITORY,
  IS_PUBLIC_KEY,
  SESSION_COOKIE_NAME,
} from "./auth.constants";
import { AuthenticatedUser, AuthRepository } from "./auth.types";
import { CryptoService } from "./crypto.service";

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    private readonly crypto: CryptoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = parse(request.headers.cookie ?? "")[SESSION_COOKIE_NAME];
    if (!token) throw new UnauthorizedException("Sessão inválida ou expirada.");

    const now = new Date();
    const session = await this.repository.findActiveSession(
      this.crypto.hashToken(token),
      now,
    );
    if (!session)
      throw new UnauthorizedException("Sessão inválida ou expirada.");

    request.authUser = { ...session.user, sessionId: session.id };
    if (
      !session.lastUsedAt ||
      now.getTime() - session.lastUsedAt.getTime() > 15 * 60_000
    ) {
      await this.repository
        .touchSession(session.id, now)
        .catch(() => undefined);
    }
    return true;
  }
}
