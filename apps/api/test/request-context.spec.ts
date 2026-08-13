import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { SESSION_COOKIE_NAME } from "../src/modules/auth/auth.constants";
import { RequestContextMiddleware } from "../src/request-context.middleware";
import { currentRequestId } from "../src/request-context.store";

describe("RequestContextMiddleware", () => {
  const middleware = new RequestContextMiddleware({
    get: () => "http://localhost:3000",
  } as unknown as ConfigService);

  it("propaga requestId válido pelo contexto e resposta", () => {
    const request = {
      method: "GET",
      headers: { "x-request-id": "request-1234" },
      header: (name: string) =>
        name === "x-request-id" ? "request-1234" : undefined,
    } as unknown as Request;
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    let observed: string | undefined;
    middleware.use(request, response, () => {
      observed = currentRequestId();
    });
    expect(observed).toBe("request-1234");
    expect(setHeader.mock.calls).toContainEqual([
      "X-Request-Id",
      "request-1234",
    ]);
  });

  it("bloqueia mutação com cookie e origem diferente", () => {
    const request = {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=secret` },
      header: (name: string) =>
        name === "origin" ? "https://evil.example" : undefined,
    } as unknown as Request;
    const json = jest.fn();
    const receivedStatuses: number[] = [];
    const status = jest.fn((value: number) => {
      receivedStatuses.push(value);
      return { json };
    });
    const response = { setHeader: jest.fn(), status } as unknown as Response;
    const next = jest.fn();
    middleware.use(request, response, next);
    expect(receivedStatuses).toEqual([403]);
    expect(next.mock.calls).toHaveLength(0);
  });
});
