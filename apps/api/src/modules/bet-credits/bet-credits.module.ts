import { Module } from "@nestjs/common";
import { BetCreditsController } from "./bet-credits.controller";
import { BetCreditsService } from "./bet-credits.service";

@Module({ controllers: [BetCreditsController], providers: [BetCreditsService] })
export class BetCreditsModule {}
