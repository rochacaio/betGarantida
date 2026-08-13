import { IsInt, IsString, Matches, Min } from "class-validator";

export class CorrectGeneratedCreditDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Matches(/^\d{1,17}(\.\d{1,2})?$/)
  grantedCreditAmount!: string;
}
