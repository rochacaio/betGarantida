import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  Min,
} from "class-validator";
import { trimString } from "../../auth/dto/transforms";
import { BetType } from "@prisma/client";
import { IsEnum } from "class-validator";

const decimal = /^\d{1,17}(\.\d{1,6})?$/;
const money = /^\d{1,17}(\.\d{1,2})?$/;

export class OperationLegDto {
  @IsOptional()
  @IsUUID()
  scenarioId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  groupPosition?: number;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  selectionName?: string;

  @IsUUID()
  bookmakerAccountId!: string;

  @IsOptional()
  @IsEnum(BetType)
  betType?: BetType;

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

  @IsOptional()
  @IsBoolean()
  usesFreeBetCredit?: boolean;

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
  @IsUUID()
  scenarioId?: string;

  @IsOptional()
  @IsEnum(BetType)
  betType?: BetType;

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
