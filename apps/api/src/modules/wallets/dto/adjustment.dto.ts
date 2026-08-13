import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class AdjustmentDto {
  @IsString()
  @Matches(/^-?\d{1,17}(\.\d{1,2})?$/)
  amount!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
