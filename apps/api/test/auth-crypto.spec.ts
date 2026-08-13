import { ConfigService } from "@nestjs/config";
import { CryptoService } from "../src/modules/auth/crypto.service";

describe("CryptoService", () => {
  const service = new CryptoService(
    new ConfigService({
      NODE_ENV: "test",
      CPF_HASH_SECRET: "test-hash-secret",
      CPF_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      SESSION_SECRET: "test-session-secret",
    }),
  );

  it("hashes passwords with Argon2id", async () => {
    const hashed = await service.hashPassword("senha-segura");
    expect(hashed).toContain("$argon2id$");
    await expect(service.verifyPassword(hashed, "senha-segura")).resolves.toBe(
      true,
    );
    await expect(service.verifyPassword(hashed, "senha-errada")).resolves.toBe(
      false,
    );
  });

  it("never leaves CPF in plaintext", () => {
    const cpf = "52998224725";
    expect(service.hashCpf(cpf)).not.toContain(cpf);
    expect(service.encryptCpf(cpf)).not.toContain(cpf);
  });

  it("creates opaque tokens and stores only their deterministic hash", () => {
    const token = service.createOpaqueToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(service.hashToken(token)).toHaveLength(64);
    expect(service.hashToken(token)).not.toBe(token);
  });
});
