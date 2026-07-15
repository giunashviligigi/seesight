import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Raw reset token from the reset link/email' })
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token!: string;

  @ApiProperty({ minLength: 8, example: 'NewSecurePass1' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
