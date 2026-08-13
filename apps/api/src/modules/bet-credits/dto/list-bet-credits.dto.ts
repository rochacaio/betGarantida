import { BetCreditStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class ListBetCreditsDto {
  @IsOptional()
  @IsEnum(BetCreditStatus)
  status: BetCreditStatus = BetCreditStatus.AVAILABLE;
}
