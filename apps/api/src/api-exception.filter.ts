import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

interface ExceptionBody {
  code?: string;
  message?: string | string[];
  fields?: Array<{ path: string; code: string }>;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.body(exception);
    const requestId = this.requestId(request);
    if (status >= 500) this.logUnexpected(exception, request, requestId);
    response.setHeader("X-Request-Id", requestId);
    response.status(status).json({
      error: {
        code: body.code ?? this.defaultCode(status),
        message: this.message(body.message, status),
        ...(body.fields ? { fields: body.fields } : {}),
        requestId,
      },
    });
  }

  private logUnexpected(
    exception: unknown,
    request: Request,
    requestId: string,
  ) {
    const error = exception instanceof Error ? exception : undefined;
    const prismaCode =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? exception.code
        : undefined;
    console.error(
      JSON.stringify({
        level: "error",
        type: "unhandled_exception",
        requestId,
        method: request.method,
        route: request.path,
        errorName: error?.name ?? typeof exception,
        ...(prismaCode ? { prismaCode } : {}),
        message: error?.message ?? "Unknown error",
        stack: error?.stack,
      }),
    );
  }

  private body(exception: unknown): ExceptionBody {
    if (!(exception instanceof HttpException)) return {};
    const response = exception.getResponse();
    return typeof response === "string" ? { message: response } : response;
  }

  private requestId(request: Request): string {
    const received = request.header("x-request-id");
    return received && /^[A-Za-z0-9_-]{8,80}$/.test(received)
      ? received
      : randomUUID();
  }

  private message(message: string | string[] | undefined, status: number) {
    if (Array.isArray(message)) return message.join("; ");
    if (message) return message;
    return status === 500
      ? "Erro interno do servidor."
      : "Não foi possível concluir a solicitação.";
  }

  private defaultCode(status: number): string {
    if (status === 401) return "UNAUTHENTICATED";
    if (status === 404) return "NOT_FOUND";
    if (status === 409) return "CONFLICT";
    if (status === 422 || status === 400) return "VALIDATION_ERROR";
    if (status === 429) return "RATE_LIMITED";
    return "INTERNAL_ERROR";
  }
}
