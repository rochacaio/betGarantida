import { IsInt, Min } from "class-validator";

export class ReopenOperationDto {
  @IsInt()
  @Min(1)
  version!: number;
}
