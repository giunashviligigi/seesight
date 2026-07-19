import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'TempPass12AbCdEf' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, example: 'MyNewSecurePass1' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
