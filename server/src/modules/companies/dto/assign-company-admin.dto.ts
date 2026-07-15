import { IsBoolean, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class AssignCompanyAdminDto {
  @ApiProperty({
    example: 'admin@acme-travel.example',
    description: 'Existing user email to assign as COMPANY_ADMIN of this company',
  })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description:
      'When true, demote previous company admins of this company to EMPLOYEE',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  replaceExisting?: boolean;
}
