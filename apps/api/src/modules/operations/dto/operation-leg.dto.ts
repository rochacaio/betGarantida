import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";
import { trimString } from "../../auth/dto/transforms";

const decimal = /^\d{1,17}(\.\d{1,6})?$/;
const money = /^\d{1,17}(\.\d{1,2})?$/;

export class OperationLegDto {
  @IsUUID()
  bookmakerAccountId!: string;

  @IsString()
  @Matches(money)
  stake!: string;

  @IsString()
  @Matches(decimal)
  odd!: string;

  @IsOptional()
  @IsString()
  @Matches(decimal)
  commissionPercent?: string;

  @IsOptional()
  @IsString()
  @Matches(decimal)
  cashbackPercent?: string;

  @IsOptional()
  @IsString()
  @Matches(decimal)
  increasePercent?: string;

  @IsOptional()
  @IsBoolean()
  usesBetCredit?: boolean;

  @Transform(trimString)
  @IsOptional()
  @IsUUID()
  betCreditId?: string;

  @IsOptional()
  @IsBoolean()
  manualStake?: boolean;
}

export class PreviewOperationLegDto {
  @IsOptional()
  @IsString()
  @Matches(money)
  stake?: string;

  @IsString()
  @Matches(decimal)
  odd!: string;

  @IsOptional()
  @IsString()
  @Matches(decimal)
  commissionPercent?: string;

  @IsOptional()
  @IsString()
  @Matches(decimal)
  cashbackPercent?: string;

  @IsOptional()
  @IsString()
  @Matches(decimal)
  increasePercent?: string;

  @IsOptional()
  @IsBoolean()
  usesBetCredit?: boolean;

  @IsOptional()
  @IsBoolean()
  manualStake?: boolean;
}
