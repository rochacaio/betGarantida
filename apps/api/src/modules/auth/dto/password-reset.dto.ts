import { IsString, MaxLength, MinLength } from "class-validator";

export class PasswordResetDto {
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
