import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SearchFlightsQueryDto {
  @ApiProperty({ example: 'TBS', description: 'IATA origin airport' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  origin!: string;

  @ApiProperty({ example: 'BER', description: 'IATA destination airport' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  destination!: string;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  departureDate!: string;

  @ApiPropertyOptional({ example: '2026-09-14' })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  adults?: number = 1;

  @ApiPropertyOptional({
    enum: ['economy', 'premium_economy', 'business', 'first'],
    default: 'economy',
  })
  @IsOptional()
  @IsIn(['economy', 'premium_economy', 'business', 'first'])
  travelClass?: 'economy' | 'premium_economy' | 'business' | 'first';

  @ApiPropertyOptional({ default: 'EUR' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;
}

export class SearchHotelsQueryDto {
  @ApiProperty({
    example: 'Berlin',
    description: 'City or hotel search query',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  checkIn!: string;

  @ApiProperty({ example: '2026-09-14' })
  @IsDateString()
  checkOut!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  adults?: number = 1;

  @ApiPropertyOptional({ default: 'EUR' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;
}
