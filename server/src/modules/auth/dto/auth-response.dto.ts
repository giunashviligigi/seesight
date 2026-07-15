import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  firstName!: string | null;

  @ApiPropertyOptional()
  lastName!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiPropertyOptional()
  companyId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class AuthTokensResponseDto {
  @ApiProperty({ description: 'JWT access token (also set as httpOnly cookie)' })
  accessToken!: string;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}

export class MessageResponseDto {
  @ApiProperty()
  message!: string;
}

export class ForgotPasswordResponseDto extends MessageResponseDto {
  @ApiPropertyOptional({
    description:
      'Present only in development to support local testing without email.',
  })
  resetToken?: string;

  @ApiPropertyOptional({
    description: 'Present only in development.',
  })
  resetUrl?: string;
}
