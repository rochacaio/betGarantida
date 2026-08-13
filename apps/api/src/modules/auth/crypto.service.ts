import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Algorithm, hash, verify, Version } from "@node-rs/argon2";
import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

@Injectable()
export class CryptoService {
  constructor(private readonly config: ConfigService) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async hashPassword(password: string): Promise<string> {
    return hash(password, {
      algorithm: Algorithm.Argon2id,
      version: Version.V0x13,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
  }

  async verifyPassword(
    passwordHash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  hashCpf(cpf: string): string {
    return createHmac("sha256", this.secret("CPF_HASH_SECRET"))
      .update(cpf)
      .digest("hex");
  }

  encryptCpf(cpf: string): string {
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(cpf, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
  }

  createOpaqueToken(): string {
    return randomBytes(32).toString("base64url");
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  hashRateLimitKey(value: string): string {
    return createHmac("sha256", this.secret("SESSION_SECRET"))
      .update(value)
      .digest("hex");
  }

  private secret(name: string): string {
    const configured = this.config.get<string>(name);
    if (configured) return configured;
    if (this.config.get("NODE_ENV") !== "production")
      return `development-only-${name}`;
    throw new InternalServerErrorException(
      `Configuração obrigatória ausente: ${name}`,
    );
  }

  private encryptionKey(): Buffer {
    const configured = this.config.get<string>("CPF_ENCRYPTION_KEY");
    if (!configured && this.config.get("NODE_ENV") !== "production") {
      return createHash("sha256").update("development-only-cpf-key").digest();
    }
    const key = Buffer.from(configured ?? "", "base64");
    if (key.length !== 32) {
      throw new InternalServerErrorException(
        "CPF_ENCRYPTION_KEY deve possuir 32 bytes em base64",
      );
    }
    return key;
  }
}
