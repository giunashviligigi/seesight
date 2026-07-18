import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus, TripStatus } from '@prisma/client';

export class TripTravelerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  departmentId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  departmentName!: string | null;

  @ApiProperty()
  isPrimary!: boolean;
}

export class TripApprovalResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ApprovalStatus })
  status!: ApprovalStatus;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  decidedAt!: string | null;
}

export class TripFlightOfferResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  provider!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  providerOfferId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  origin!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  destination!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  departAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  returnAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  priceAmount!: number | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  currency!: string | null;

  @ApiProperty()
  selected!: boolean;
}

export class TripHotelOfferResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  provider!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  providerOfferId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  hotelName!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  city!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date' })
  checkIn!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date' })
  checkOut!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  priceAmount!: number | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  currency!: string | null;

  @ApiProperty()
  selected!: boolean;
}

export class TripResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  createdByUserId!: string;

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

  @ApiPropertyOptional({ nullable: true, type: Number })
  budgetAmount!: number | null;

  @ApiProperty()
  budgetCurrency!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty({ enum: TripStatus })
  status!: TripStatus;

  @ApiProperty({ type: [TripTravelerResponseDto] })
  travelers!: TripTravelerResponseDto[];

  @ApiPropertyOptional({ type: TripApprovalResponseDto, nullable: true })
  approval!: TripApprovalResponseDto | null;

  @ApiProperty({ type: [TripFlightOfferResponseDto] })
  flightOffers!: TripFlightOfferResponseDto[];

  @ApiProperty({ type: [TripHotelOfferResponseDto] })
  hotelOffers!: TripHotelOfferResponseDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class TripListResponseDto {
  @ApiProperty({ type: [TripResponseDto] })
  items!: TripResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
