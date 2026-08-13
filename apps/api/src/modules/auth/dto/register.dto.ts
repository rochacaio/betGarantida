import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { trimString } from "./transforms";

export class RegisterDto {
  @ApiProperty({ example: "usuario@example.com" })
  @Transform(trimString)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ example: "000.000.000-00" })
  @IsString()
  @MinLength(11)
  @MaxLength(14)
  cpf!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
