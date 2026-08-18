import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

class LegNameDto {
  @IsUUID()
  legId!: string;

  @IsString()
  @MaxLength(160)
  selectionName!: string;
}

export class UpdateLegNamesDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LegNameDto)
  legs!: LegNameDto[];
}
