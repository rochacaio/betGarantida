import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class ExpireGeneratedCreditDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
