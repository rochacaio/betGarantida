import { BookmakerAccountStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { trimString } from "../../auth/dto/transforms";

export class UpdateBookmakerAccountDto {
  @IsInt()
  @Min(1)
  version!: number;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nickname?: string;

  @IsOptional()
  @IsEnum(BookmakerAccountStatus)
  status?: BookmakerAccountStatus;
}
