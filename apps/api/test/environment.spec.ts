import { validateEnvironment } from "../src/config/environment";

describe("environment validation", () => {
  it("allows local development without production secrets", () => {
    expect(validateEnvironment({ NODE_ENV: "development" })).toEqual({
      NODE_ENV: "development",
    });
  });

  it("rejects an incomplete production environment", () => {
    expect(() => validateEnvironment({ NODE_ENV: "production" })).toThrow(
      "Variáveis obrigatórias ausentes",
    );
  });

  it("accepts a complete production environment", () => {
    const config = {
      NODE_ENV: "production",
      APP_ORIGIN: "https://example.com",
      DATABASE_URL: "postgresql://pooled",
      DIRECT_DATABASE_URL: "postgresql://direct",
      SESSION_SECRET: "session-secret",
      CPF_HASH_SECRET: "cpf-secret",
      CPF_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "noreply@example.com",
    };
    expect(validateEnvironment(config)).toBe(config);
  });

});
