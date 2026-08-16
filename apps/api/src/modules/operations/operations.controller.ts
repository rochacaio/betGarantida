import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { CancelOperationDto } from "./dto/cancel-operation.dto";
import { ListOperationsDto } from "./dto/list-operations.dto";
import {
  CreateOperationDto,
  PreviewOperationDto,
  UpdateOperationDto,
} from "./dto/operation-write.dto";
import { OperationsService } from "./operations.service";
import { SettleOperationDto } from "./dto/settle-operation.dto";
import { CorrectGeneratedCreditDto } from "./dto/correct-generated-credit.dto";
import { DeleteOperationDto } from "./dto/delete-operation.dto";
import { ExpireGeneratedCreditDto } from "./dto/expire-generated-credit.dto";
import { GrantGeneratedCreditDto } from "./dto/grant-generated-credit.dto";

@ApiTags("operations")
@ApiCookieAuth("betgarantida_session")
@Controller("operations")
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Post("preview")
  preview(@Body() dto: PreviewOperationDto) {
    return this.operations.preview(dto);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOperationDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.operations.create(user.id, dto, idempotencyKey);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOperationsDto,
  ) {
    return this.operations.list(user.id, query);
  }

  @Get(":id")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.operations.get(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOperationDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.operations.update(user.id, id, dto, idempotencyKey);
  }

  @Post(":id/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CancelOperationDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.operations.cancel(
      user.id,
      id,
      dto.version,
      dto.reason,
      idempotencyKey,
    );
  }

  @Post(":id/settle")
  settle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: SettleOperationDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.operations.settle(user.id, id, dto, idempotencyKey);
  }

  @Patch(":id/generated-credit")
  correctGeneratedCredit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CorrectGeneratedCreditDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.operations.correctGeneratedCredit(
      user.id,
      id,
      dto,
      idempotencyKey,
    );
  }

  @Post(":id/generated-credit/grant")
  grantGeneratedCredit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: GrantGeneratedCreditDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.operations.grantGeneratedCredit(
      user.id,
      id,
      dto,
      idempotencyKey,
    );
  }

  @Post(":id/generated-credit/expire")
  expireGeneratedCredit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: ExpireGeneratedCreditDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.operations.expireGeneratedCredit(
      user.id,
      id,
      dto.version,
      idempotencyKey,
    );
  }

  @Delete(":id")
  deleteOperation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: DeleteOperationDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.operations.deleteOperation(
      user.id,
      id,
      dto.version,
      idempotencyKey,
    );
  }
}
