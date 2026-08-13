import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class AmountDto {
  @IsString()
  @Matches(/^\d{1,17}(\.\d{1,2})?$/)
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
