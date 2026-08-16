import { ArrayMinSize, IsArray, IsInt, IsUUID, Min } from "class-validator";

export class RecordEarlyWinsDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  legIds!: string[];
}
