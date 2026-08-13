import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { trimString } from "../../auth/dto/transforms";

export class CreateBookmakerAccountDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nickname?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string;

  @IsString()
  @Matches(/^\d{1,17}(\.\d{1,2})?$/)
  initialBalance!: string;
}
