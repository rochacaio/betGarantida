import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { trimString } from "../../auth/dto/transforms";

export class CancelOperationDto {
  @IsInt()
  @Min(1)
  version!: number;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
