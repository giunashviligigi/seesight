import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  AuthTokensResponseDto,
  ForgotPasswordResponseDto,
  MessageResponseDto,
  UserResponseDto,
} from './dto/auth-response.dto';
import {
  AuthUserPayload,
  RequestUser,
  toUserResponse,
} from './types/auth.types';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokensResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: null,
      },
    });

    const accessToken = await this.signAccessToken(user.id, user.email, user.role);

    return {
      accessToken,
      user: toUserResponse(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthTokensResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.signAccessToken(user.id, user.email, user.role);

    return {
      accessToken,
      user: toUserResponse(user),
    };
  }

  async me(user: RequestUser): Promise<UserResponseDto> {
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!current || current.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Authentication required');
    }

    return toUserResponse(current);
  }

  async forgotPassword(emailRaw: string): Promise<ForgotPasswordResponseDto> {
    const email = emailRaw.toLowerCase().trim();
    const genericMessage =
      'If an account exists for this email, password reset instructions have been sent.';

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return { message: genericMessage };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    const webOrigin =
      this.configService.get<string>('app.webOrigin') ?? 'http://localhost:3000';
    const resetUrl = `${webOrigin}/reset-password?token=${rawToken}`;

    this.logger.log(
      `Password reset requested for ${email}. Dev reset URL: ${resetUrl}`,
    );

    const isDev =
      this.configService.get<string>('nodeEnv') === 'development';

    if (isDev) {
      return {
        message: genericMessage,
        resetToken: rawToken,
        resetUrl,
      };
    }

    return { message: genericMessage };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const tokenHash = this.hashToken(dto.token);

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Password has been reset successfully' };
  }

  async changePassword(
    user: RequestUser,
    dto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!current || current.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Authentication required');
    }

    const matches = await bcrypt.compare(
      dto.currentPassword,
      current.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: current.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return { message: 'Password updated successfully' };
  }

  private async signAccessToken(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<string> {
    const payload: AuthUserPayload = {
      sub: userId,
      email,
      role,
    };

    return this.jwtService.signAsync(payload);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
