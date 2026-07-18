import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '@prisma/client';

export class DashboardUpcomingTripDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  purpose!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  destinationCountry!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  destinationCity!: string | null;

  @ApiProperty({ type: String, format: 'date' })
  startDate!: string;

  @ApiProperty({ type: String, format: 'date' })
  endDate!: string;

  @ApiProperty({ enum: TripStatus })
  status!: TripStatus;
}

export class DashboardSpendingDto {
  @ApiProperty({
    description:
      'Sum of selected flight + hotel offer prices for trips in the period',
  })
  amount!: number;

  @ApiProperty({ example: 'EUR' })
  currency!: string;

  @ApiProperty({ type: String, format: 'date' })
  periodFrom!: string;

  @ApiProperty({ type: String, format: 'date' })
  periodTo!: string;
}

export class DashboardStatisticsDto {
  @ApiProperty({
    description: 'Trips whose startDate falls in the current UTC calendar month',
  })
  tripsThisMonth!: number;

  @ApiProperty({
    description:
      'Average selected-offer spend per trip in the period (0 when no spend trips)',
  })
  averageTripCost!: number;
}

export class DashboardSummaryResponseDto {
  @ApiProperty()
  companyId!: string;

  @ApiProperty({
    description: 'Whether metrics are scoped to the employee or company-wide',
    enum: ['company', 'self'],
  })
  scope!: 'company' | 'self';

  @ApiProperty()
  upcomingTripsCount!: number;

  @ApiProperty({ type: [DashboardUpcomingTripDto] })
  upcomingTrips!: DashboardUpcomingTripDto[];

  @ApiProperty({ type: DashboardSpendingDto })
  totalTravelSpending!: DashboardSpendingDto;

  @ApiProperty({
    description: 'Active employees in the company (not soft-deleted)',
  })
  activeEmployeesCount!: number;

  @ApiProperty()
  pendingApprovalsCount!: number;

  @ApiProperty({ type: DashboardStatisticsDto })
  statistics!: DashboardStatisticsDto;
}
