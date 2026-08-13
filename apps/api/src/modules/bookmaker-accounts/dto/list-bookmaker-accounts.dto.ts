import { BookmakerAccountStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class ListBookmakerAccountsDto {
  @IsOptional()
  @IsEnum(BookmakerAccountStatus)
  status?: BookmakerAccountStatus;
}
