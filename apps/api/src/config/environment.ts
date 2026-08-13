const REQUIRED_PRODUCTION_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "SESSION_SECRET",
  "CPF_HASH_SECRET",
  "CPF_ENCRYPTION_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const;

export function validateEnvironment(config: Record<string, unknown>) {
  if (config.NODE_ENV !== "production") return config;

  const missing = REQUIRED_PRODUCTION_KEYS.filter(
    (key) => typeof config[key] !== "string" || config[key] === "",
  );
  if (missing.length)
    throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(", ")}`);

  const encryptionKey = Buffer.from(
    String(config.CPF_ENCRYPTION_KEY),
    "base64",
  );
  if (encryptionKey.length !== 32) {
    throw new Error("CPF_ENCRYPTION_KEY deve possuir 32 bytes em base64");
  }
  return config;
}
