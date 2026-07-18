import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AttachFlightOfferDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  providerOfferId!: string;

  @ApiProperty({ example: 'TBS' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  origin!: string;

  @ApiProperty({ example: 'BER' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  destination!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  departAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  returnAt?: string | null;

  @ApiPropertyOptional({
    enum: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'],
  })
  @IsOptional()
  @IsString()
  travelClass?: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceAmount?: number | null;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string | null;

  @ApiProperty({ description: 'Normalized/vendor payload for audit snapshot' })
  @IsObject()
  rawPayload!: Record<string, unknown>;
}

export class AttachHotelOfferDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  providerOfferId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  hotelName!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  checkIn!: string;

  @ApiProperty({ example: '2026-09-14' })
  @IsDateString()
  checkOut!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceAmount?: number | null;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string | null;

  @ApiProperty({ description: 'Normalized/vendor payload for audit snapshot' })
  @IsObject()
  rawPayload!: Record<string, unknown>;
}
