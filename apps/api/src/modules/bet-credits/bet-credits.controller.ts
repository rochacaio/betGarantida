import { Controller, Get, Query } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { BetCreditsService } from "./bet-credits.service";
import { ListBetCreditsDto } from "./dto/list-bet-credits.dto";

@ApiTags("bet-credits")
@ApiCookieAuth("betgarantida_session")
@Controller("bet-credits")
export class BetCreditsController {
  constructor(private readonly credits: BetCreditsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBetCreditsDto,
  ) {
    return this.credits.list(user.id, query.status);
  }
}
