import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class DashboardSummaryQueryDto {
  @ApiPropertyOptional({
    description: 'Required for super admins. Ignored for other roles.',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description:
      'Inclusive period start (ISO date). Defaults to January 1 of the current UTC year.',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive period end (ISO date). Defaults to today (UTC).',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
