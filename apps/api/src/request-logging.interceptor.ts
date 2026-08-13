import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { Observable, catchError, tap, throwError } from "rxjs";
import { AuthenticatedRequest } from "./modules/auth/session.guard";
import { ObservabilityService } from "./observability.service";
import { ContextRequest } from "./request-context.middleware";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: ObservabilityService,
    private readonly config: ConfigService,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = Date.now();
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & ContextRequest>();
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();
    const log = (status: number) => {
      const durationMs = Date.now() - started;
      this.metrics.record(status, durationMs);
      const userId = request.authUser?.id;
      const userRef = userId
        ? createHash("sha256")
            .update(
              `${this.config.get<string>("SESSION_SECRET") ?? "local"}:${userId}`,
            )
            .digest("hex")
            .slice(0, 16)
        : undefined;
      console.log(
        JSON.stringify({
          level: status >= 500 ? "error" : "info",
          requestId: request.requestId,
          method: request.method,
          route: request.path,
          status,
          durationMs,
          ...(userRef ? { userRef } : {}),
        }),
      );
    };
    return next.handle().pipe(
      tap(() => log(response.statusCode)),
      catchError((error: unknown) => {
        const status =
          typeof error === "object" && error && "getStatus" in error
            ? (error as { getStatus(): number }).getStatus()
            : 500;
        log(status);
        return throwError(() => error);
      }),
    );
  }
}
