import { BetLegResult } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";

export class SettleLegDto {
  @IsUUID()
  legId!: string;

  @IsEnum(BetLegResult)
  result!: BetLegResult;
}

export class SettleOperationDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsBoolean()
  creditGenerated?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,17}(\.\d{1,2})?$/)
  grantedCreditAmount?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => SettleLegDto)
  legs!: SettleLegDto[];
}
