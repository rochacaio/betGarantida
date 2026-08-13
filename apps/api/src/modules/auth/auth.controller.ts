import { Body, Controller, Get, HttpCode, Ip, Post, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { serialize } from "cookie";
import { SESSION_COOKIE_NAME } from "./auth.constants";
import { AuthService } from "./auth.service";
import { AuthenticatedUser, SessionResult } from "./auth.types";
import { CurrentUser } from "./current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { PasswordRecoveryDto } from "./dto/password-recovery.dto";
import { PasswordResetDto } from "./dto/password-reset.dto";
import { RegisterDto } from "./dto/register.dto";
import { Public } from "./public.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto, ip);
    this.setSessionCookie(response, result);
    return { user: result.user };
  }

  @Public()
  @HttpCode(200)
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, ip);
    this.setSessionCookie(response, result);
    return { user: result.user };
  }

  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
      },
    };
  }

  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @HttpCode(204)
  @Post("logout")
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(user.sessionId);
    response.setHeader("Set-Cookie", this.clearSessionCookie());
  }

  @Public()
  @HttpCode(200)
  @Post("password-recovery")
  recover(@Body() dto: PasswordRecoveryDto, @Ip() ip: string) {
    return this.authService.requestPasswordRecovery(dto, ip);
  }

  @Public()
  @HttpCode(200)
  @Post("password-reset")
  reset(@Body() dto: PasswordResetDto, @Ip() ip: string) {
    return this.authService.resetPassword(dto, ip);
  }

  private setSessionCookie(response: Response, result: SessionResult): void {
    response.setHeader(
      "Set-Cookie",
      serialize(SESSION_COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: result.expiresAt,
      }),
    );
  }

  private clearSessionCookie(): string {
    return serialize(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }
}
