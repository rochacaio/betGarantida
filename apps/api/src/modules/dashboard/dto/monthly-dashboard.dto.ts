import { IsString, Matches } from "class-validator";

export class MonthlyDashboardDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;
}
