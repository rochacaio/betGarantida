import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CALCULATION_ENGINE_VERSION } from "@betgarantida/calculation-engine";
import { Public } from "../auth/public.decorator";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  @Get()
  @ApiOkResponse({ description: "Processo da API disponível" })
  check() {
    return {
      status: "ok" as const,
      service: "betgarantida-api",
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    };
  }
}
