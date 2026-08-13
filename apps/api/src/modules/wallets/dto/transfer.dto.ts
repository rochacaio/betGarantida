import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

export class TransferDto {
  @ApiProperty()
  @IsUUID()
  sourceBookmakerAccountId!: string;

  @ApiProperty()
  @IsUUID()
  destinationBookmakerAccountId!: string;

  @ApiProperty({ example: "100.00" })
  @Matches(/^\d{1,17}(\.\d{1,2})?$/)
  amount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}
