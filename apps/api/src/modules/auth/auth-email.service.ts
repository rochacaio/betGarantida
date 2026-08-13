import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthEmailService } from "./auth.types";

@Injectable()
export class DefaultAuthEmailService implements AuthEmailService {
  private readonly logger = new Logger(DefaultAuthEmailService.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async sendPasswordReset(input: {
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const appOrigin =
      this.config.get<string>("APP_ORIGIN") ?? "http://localhost:3000";
    const resetUrl = `${appOrigin}/recuperar-senha?token=${encodeURIComponent(input.token)}`;

    if (this.config.get("NODE_ENV") !== "production") {
      this.logger.log(
        `Link local de recuperação para ${input.email}: ${resetUrl}`,
      );
      return;
    }

    const apiKey = this.config.get<string>("RESEND_API_KEY");
    const from = this.config.get<string>("EMAIL_FROM");
    if (!apiKey || !from)
      throw new ServiceUnavailableException("Serviço de email indisponível");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: "Recuperação de senha — BetGarantida",
        html: `<p>Use o link abaixo para trocar sua senha. Ele expira em ${input.expiresAt.toISOString()}.</p><p><a href="${resetUrl}">Trocar minha senha</a></p>`,
      }),
    });
    if (!response.ok) {
      this.logger.error(`Falha do provedor de email: HTTP ${response.status}`);
      throw new ServiceUnavailableException("Serviço de email indisponível");
    }
  }
}
