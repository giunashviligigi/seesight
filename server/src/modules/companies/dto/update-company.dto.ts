import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'Acme Travel Co' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Acme Travel Company LLC' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string | null;

  @ApiPropertyOptional({
    example: 'Georgia',
    description: 'Full country name or ISO 3166-1 alpha-2 code (stored as ISO).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @ApiPropertyOptional({ example: 'billing@acme-travel.example' })
  @IsOptional()
  @IsEmail()
  billingEmail?: string | null;

  @ApiPropertyOptional({ example: 'Asia/Tbilisi' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    example: { defaultBudgetLimit: 2500, defaultBudgetCurrency: 'GEL' },
  })
  @IsOptional()
  @IsObject()
  policyJson?: Record<string, unknown> | null;
}
