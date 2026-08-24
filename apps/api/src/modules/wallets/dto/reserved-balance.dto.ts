import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
import { trimString } from "../../auth/dto/transforms";

export class ReservedBalanceDto {
  @IsUUID()
  bookmakerAccountId!: string;

  @IsString()
  @Matches(/^\d{1,17}(\.\d{1,2})?$/)
  amount!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}
