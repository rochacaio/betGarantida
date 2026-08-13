import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { SESSION_COOKIE_NAME } from "./modules/auth/auth.constants";
import { requestContext } from "./request-context.store";

export interface ContextRequest extends Request {
  requestId?: string;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(request: ContextRequest, response: Response, next: NextFunction) {
    const supplied = request.header("x-request-id");
    const requestId =
      supplied && /^[A-Za-z0-9_-]{8,80}$/.test(supplied)
        ? supplied
        : randomUUID();
    request.requestId = requestId;
    request.headers["x-request-id"] = requestId;
    response.setHeader("X-Request-Id", requestId);

    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    const hasSession = (request.headers.cookie ?? "").includes(
      `${SESSION_COOKIE_NAME}=`,
    );
    if (unsafe && hasSession) {
      const origin = request.header("origin");
      const expected =
        this.config.get<string>("APP_ORIGIN") ?? "http://localhost:3000";
      if (origin !== expected) {
        response.status(403).json({
          error: {
            code: "CSRF_REJECTED",
            message: "Origem da requisição não permitida.",
            requestId,
          },
        });
        return;
      }
    }
    requestContext.run({ requestId }, next);
  }
}
