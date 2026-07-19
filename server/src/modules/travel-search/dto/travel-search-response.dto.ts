import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FlightOfferDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'SERPAPI' })
  provider!: string;

  @ApiProperty()
  providerOfferId!: string;

  @ApiProperty()
  origin!: string;

  @ApiProperty()
  destination!: string;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  departAt!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Arrival time at final destination',
  })
  arriveAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  returnAt!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Return leg departure time (round trip)',
  })
  returnDepartAt!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Return leg arrival time (round trip)',
  })
  returnArriveAt!: string | null;

  @ApiProperty({
    enum: ['one_way', 'round_trip'],
    description: 'Whether this offer is one-way or round-trip',
  })
  tripType!: 'one_way' | 'round_trip';

  @ApiPropertyOptional({ nullable: true, type: String })
  airline!: string | null;

  @ApiProperty({ type: [String] })
  flightNumbers!: string[];

  @ApiProperty()
  stops!: number;

  @ApiPropertyOptional({ nullable: true, type: Number })
  totalDurationMinutes!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'Outbound leg duration in minutes',
  })
  outboundDurationMinutes!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'Return leg duration in minutes (round trip)',
  })
  returnDurationMinutes!: number | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  travelClass!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  priceAmount!: number | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  currency!: string | null;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ description: 'Vendor payload subset for snapshot persistence' })
  rawPayload!: Record<string, unknown>;
}

export class HotelOfferDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'SERPAPI' })
  provider!: string;

  @ApiProperty()
  providerOfferId!: string;

  @ApiProperty()
  hotelName!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  city!: string | null;

  @ApiProperty({ type: String, format: 'date' })
  checkIn!: string;

  @ApiProperty({ type: String, format: 'date' })
  checkOut!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  stars!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  rating!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  priceAmount!: number | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  currency!: string | null;

  @ApiProperty({ type: [String] })
  amenities!: string[];

  @ApiPropertyOptional({ nullable: true, type: String })
  thumbnail!: string | null;

  @ApiProperty({ type: [String], description: 'Hotel photo URLs' })
  images!: string[];

  @ApiPropertyOptional({ nullable: true, type: String })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  address!: string | null;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ description: 'Vendor payload subset for snapshot persistence' })
  rawPayload!: Record<string, unknown>;
}

export class FlightSearchResponseDto {
  @ApiProperty({ type: [FlightOfferDto] })
  items!: FlightOfferDto[];

  @ApiProperty()
  cached!: boolean;

  @ApiProperty()
  provider!: string;
}

export class HotelSearchResponseDto {
  @ApiProperty({ type: [HotelOfferDto] })
  items!: HotelOfferDto[];

  @ApiProperty()
  cached!: boolean;

  @ApiProperty()
  provider!: string;
}
