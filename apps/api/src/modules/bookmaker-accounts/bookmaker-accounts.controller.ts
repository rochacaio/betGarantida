import {
  Body,
  Controller,
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
import { AdjustmentDto } from "../wallets/dto/adjustment.dto";
import { AmountDto } from "../wallets/dto/amount.dto";
import { ListTransactionsDto } from "../wallets/dto/list-transactions.dto";
import { ReservedBalanceDto } from "../wallets/dto/reserved-balance.dto";
import { TransferDto } from "../wallets/dto/transfer.dto";
import { WalletService } from "../wallets/wallet.service";
import { BookmakerAccountsService } from "./bookmaker-accounts.service";
import { CreateBookmakerAccountDto } from "./dto/create-bookmaker-account.dto";
import { ListBookmakerAccountsDto } from "./dto/list-bookmaker-accounts.dto";
import { UpdateBookmakerAccountDto } from "./dto/update-bookmaker-account.dto";

@ApiTags("bookmaker-accounts")
@ApiCookieAuth("betgarantida_session")
@Controller("bookmaker-accounts")
export class BookmakerAccountsController {
  constructor(
    private readonly accounts: BookmakerAccountsService,
    private readonly wallets: WalletService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookmakerAccountDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.accounts.create(user.id, dto, idempotencyKey);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBookmakerAccountsDto,
  ) {
    return this.accounts.list(user.id, query.status);
  }

  @Get("reserved-balance")
  reservedBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.wallets.getReservedBalance(user.id);
  }

  @Post("reserved-balance/from-bookmaker")
  reserveBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReservedBalanceDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.wallets.moveReservedBalance({
      userId: user.id,
      ...dto,
      direction: "FROM_BOOKMAKER",
      idempotencyKey,
    });
  }

  @Post("reserved-balance/to-bookmaker")
  sendReservedBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReservedBalanceDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.wallets.moveReservedBalance({
      userId: user.id,
      ...dto,
      direction: "TO_BOOKMAKER",
      idempotencyKey,
    });
  }

  @Get(":id")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.accounts.get(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBookmakerAccountDto,
  ) {
    return this.accounts.update(user.id, id, dto);
  }

  @Get(":id/transactions")
  transactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: ListTransactionsDto,
  ) {
    return this.wallets.listTransactions({
      userId: user.id,
      bookmakerAccountId: id,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Post(":id/deposits")
  deposit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AmountDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.wallets.deposit({
      userId: user.id,
      bookmakerAccountId: id,
      amount: dto.amount,
      description: dto.description,
      idempotencyKey,
    });
  }

  @Post(":id/free-winnings")
  freeWinning(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AmountDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.wallets.freeWinning({
      userId: user.id,
      bookmakerAccountId: id,
      amount: dto.amount,
      description: dto.description,
      idempotencyKey,
    });
  }

  @Post(":id/withdrawals")
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AmountDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.wallets.withdraw({
      userId: user.id,
      bookmakerAccountId: id,
      amount: dto.amount,
      description: dto.description,
      idempotencyKey,
    });
  }

  @Post(":id/adjustments")
  adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AdjustmentDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.wallets.adjust({
      userId: user.id,
      bookmakerAccountId: id,
      amount: dto.amount,
      reason: dto.reason,
      idempotencyKey,
    });
  }

  @Post("transfers")
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransferDto,
    @Headers("idempotency-key") idempotencyKey = "",
  ) {
    return this.wallets.transfer({
      userId: user.id,
      ...dto,
      idempotencyKey,
    });
  }
}
