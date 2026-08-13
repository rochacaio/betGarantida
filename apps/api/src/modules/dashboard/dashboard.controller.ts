import { Controller, Get, Query } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { DashboardService } from "./dashboard.service";
import { MonthlyDashboardDto } from "./dto/monthly-dashboard.dto";

@ApiTags("dashboard")
@ApiCookieAuth("betgarantida_session")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("monthly")
  monthly(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MonthlyDashboardDto,
  ) {
    return this.dashboard.monthly(user.id, query.month);
  }
}
