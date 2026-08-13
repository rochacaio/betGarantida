import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CALCULATION_ENGINE_VERSION } from "@betgarantida/calculation-engine";
import { Public } from "../auth/public.decorator";
import { PrismaService } from "../../database/prisma.service";
import { ObservabilityService } from "../../observability.service";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: ObservabilityService,
  ) {}
  @Get()
  @ApiOkResponse({ description: "Processo da API disponível" })
  check() {
    return {
      status: "ok" as const,
      service: "betgarantida-api",
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    };
  }

  @Get("readiness")
  async readiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ready" as const, database: "ok" as const };
  }

  @Get("metrics")
  metricsSnapshot() {
    return this.metrics.snapshot();
  }
}
