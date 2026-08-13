import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";
import { trimString } from "./transforms";

export class PasswordRecoveryDto {
  @Transform(trimString)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(14)
  cpf!: string;
}
