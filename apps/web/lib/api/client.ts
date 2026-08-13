export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Array<{ path: string; code: string }> = [],
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json();
  if (!response.ok) {
    const envelope =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (payload as {
            error?: {
              code?: string;
              message?: string;
              fields?: Array<{ path: string; code: string }>;
              requestId?: string;
            };
          })
        : undefined;
    const error = envelope?.error;
    throw new ApiClientError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "Não foi possível concluir a solicitação.",
      error?.fields,
      error?.requestId,
    );
  }
  return payload as T;
}

export const commandHeaders = () => ({
  "Idempotency-Key": crypto.randomUUID(),
});
