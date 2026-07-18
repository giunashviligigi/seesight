import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ShortlistFlightOfferDto {
  @ApiProperty({ description: 'Stable id used in the recommendation response' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerOfferId?: string;

  @ApiPropertyOptional({ example: 'TBS' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  origin?: string;

  @ApiPropertyOptional({ example: 'BER' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  destination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  airline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stops?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceAmount?: number | null;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  travelClass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string;
}

export class ShortlistHotelOfferDto {
  @ApiProperty({ description: 'Stable id used in the recommendation response' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerOfferId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  hotelName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stars?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceAmount?: number | null;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string;
}

export class RecommendItineraryDto {
  @ApiProperty({ description: 'Trip to recommend for' })
  @IsString()
  @MinLength(1)
  tripId!: string;

  @ApiPropertyOptional({
    type: [ShortlistFlightOfferDto],
    description:
      'Optional shortlist; when omitted, attached trip flight snapshots are used',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ShortlistFlightOfferDto)
  flights?: ShortlistFlightOfferDto[];

  @ApiPropertyOptional({
    type: [ShortlistHotelOfferDto],
    description:
      'Optional shortlist; when omitted, attached trip hotel snapshots are used',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ShortlistHotelOfferDto)
  hotels?: ShortlistHotelOfferDto[];
}
