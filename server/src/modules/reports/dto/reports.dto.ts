import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ReportsQueryDto {
  @ApiPropertyOptional({ description: 'Required for super admins' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Inclusive period start (ISO date). Defaults to Jan 1 UTC of current year.',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive period end (ISO date). Defaults to today UTC.',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ReportsExportQueryDto extends ReportsQueryDto {
  @ApiPropertyOptional({ enum: ['json', 'csv'], default: 'csv' })
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv' = 'csv';

  @ApiPropertyOptional({
    enum: ['summary', 'monthly', 'departments', 'destinations'],
    default: 'summary',
  })
  @IsOptional()
  @IsIn(['summary', 'monthly', 'departments', 'destinations'])
  dataset?: 'summary' | 'monthly' | 'departments' | 'destinations' = 'summary';
}

export class MonthlySpendRowDto {
  @ApiProperty({ example: '2026-09' })
  month!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  tripCount!: number;
}

export class DepartmentTripRowDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  departmentId!: string | null;

  @ApiProperty()
  departmentName!: string;

  @ApiProperty()
  tripCount!: number;
}

export class DestinationRowDto {
  @ApiProperty()
  label!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  country!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  city!: string | null;

  @ApiProperty()
  tripCount!: number;
}

export class ReportsSummaryResponseDto {
  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  periodFrom!: string;

  @ApiProperty()
  periodTo!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  totalSpend!: number;

  @ApiProperty()
  tripCount!: number;

  @ApiProperty()
  tripsWithSpend!: number;

  @ApiProperty()
  averageTripCost!: number;

  @ApiProperty({ type: [MonthlySpendRowDto] })
  monthlySpending!: MonthlySpendRowDto[];

  @ApiProperty({ type: [DepartmentTripRowDto] })
  tripsByDepartment!: DepartmentTripRowDto[];

  @ApiProperty({ type: [DestinationRowDto] })
  topCountries!: DestinationRowDto[];

  @ApiProperty({ type: [DestinationRowDto] })
  topCities!: DestinationRowDto[];

  @ApiProperty({
    description: 'Hard limit for from/to span in months',
    example: 24,
  })
  maxRangeMonths!: number;
}

export class ListReportsMetaDto {
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
