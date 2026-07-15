import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  AuthTokensResponseDto,
  ForgotPasswordResponseDto,
  MessageResponseDto,
  UserResponseDto,
} from './dto/auth-response.dto';
import { CurrentUser, Public } from './decorators/auth.decorators';
import type { RequestUser } from './types/auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a company admin account (self-signup)',
  })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponseDto> {
    const result = await this.authService.register(dto);
    this.setAccessCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensResponseDto> {
    const result = await this.authService.login(dto);
    this.setAccessCookie(res, result.accessToken);
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout by clearing the access cookie (stateless JWT)',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  logout(@Res({ passthrough: true }) res: Response): MessageResponseDto {
    this.clearAccessCookie(res);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Request password reset (response does not reveal whether email exists)',
  })
  @ApiOkResponse({ type: ForgotPasswordResponseDto })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a valid reset token' })
  @ApiOkResponse({ type: MessageResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  me(@CurrentUser() user: RequestUser): Promise<UserResponseDto> {
    return this.authService.me(user);
  }

  private setAccessCookie(res: Response, token: string): void {
    const cookieName =
      this.configService.get<string>('authCookie.name') ??
      'seesight_access_token';
    const isProd =
      this.configService.get<string>('nodeEnv') === 'production';

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  private clearAccessCookie(res: Response): void {
    const cookieName =
      this.configService.get<string>('authCookie.name') ??
      'seesight_access_token';
    const isProd =
      this.configService.get<string>('nodeEnv') === 'production';

    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });
  }
}
