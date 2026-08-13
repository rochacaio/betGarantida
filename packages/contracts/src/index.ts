export const API_PREFIX = "api/v1" as const;
export const API_VERSION = "1" as const;

export interface ApiErrorField {
  path: string;
  code: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: ApiErrorField[];
    requestId: string;
  };
}
