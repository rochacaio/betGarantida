import { Type, Transform } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { trimString } from "../../auth/dto/transforms";
import { OperationLegDto, PreviewOperationLegDto } from "./operation-leg.dto";

export class OperationWriteDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  eventName!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  generatesBetCredit?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,17}(\.\d{1,2})?$/)
  expectedBetCredit?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => OperationLegDto)
  legs!: OperationLegDto[];
}

export class CreateOperationDto extends OperationWriteDto {}

export class PreviewOperationDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PreviewOperationLegDto)
  legs!: PreviewOperationLegDto[];
}

export class UpdateOperationDto extends OperationWriteDto {
  @IsInt()
  @Min(1)
  version!: number;
}
