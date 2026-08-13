import {
  Body,
  Controller,
  Get,
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
  ) {
    return this.operations.create(user.id, dto);
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
  ) {
    return this.operations.update(user.id, id, dto);
  }

  @Post(":id/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CancelOperationDto,
  ) {
    return this.operations.cancel(user.id, id, dto.version, dto.reason);
  }
}
