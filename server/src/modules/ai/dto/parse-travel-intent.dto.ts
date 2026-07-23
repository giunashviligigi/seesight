import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export const CLARIFICATION_FOCUSES = [
  'origin',
  'destination',
  'departureDate',
  'returnDate',
  'tripType',
  'hotelNights',
] as const;

export type ClarificationFocusDto = (typeof CLARIFICATION_FOCUSES)[number];

/** Confirmed fields from prior Q&A turns — must not be wiped by re-parsing chat text. */
export class TravelIntentDraftDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  originIata?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  destinationIata?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  originCity?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  destinationCity?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  departureDate?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  returnDate?: string | null;

  @ApiPropertyOptional({ nullable: true, enum: ['one_way', 'round_trip'] })
  @IsOptional()
  @IsIn(['one_way', 'round_trip'])
  tripType?: 'one_way' | 'round_trip' | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  hotelNights?: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  adults?: number | null;
}

export class ParseTravelIntentDto {
  @ApiProperty({
    example:
      'from 1 august to 6 august i want to go from tbilisi to berlin. suggest flights and hotels',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  prompt!: string;

  @ApiPropertyOptional({
    description: 'ISO date used to resolve year-less dates (defaults to today)',
    example: '2026-07-19',
  })
  @IsOptional()
  @IsString()
  referenceDate?: string;

  @ApiPropertyOptional({
    description:
      'Short answer to the previous clarifyingQuestion (e.g. "Tbilisi")',
    example: 'Tbilisi',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  clarificationAnswer?: string;

  @ApiPropertyOptional({
    description: 'Which missing field the clarificationAnswer should fill',
    enum: CLARIFICATION_FOCUSES,
  })
  @IsOptional()
  @IsIn(CLARIFICATION_FOCUSES)
  clarificationFocus?: ClarificationFocusDto;

  @ApiPropertyOptional({
    description:
      'Previously confirmed intent fields from the Q&A draft (continue rounds)',
    type: TravelIntentDraftDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TravelIntentDraftDto)
  draft?: TravelIntentDraftDto;

  @ApiPropertyOptional({
    enum: ['FLIGHTS', 'HOTELS', 'BOTH'],
    default: 'BOTH',
    description:
      'Trip booking mode — hotels-only skips origin/trip-type questions',
  })
  @IsOptional()
  @IsIn(['FLIGHTS', 'HOTELS', 'BOTH'])
  bookingMode?: 'FLIGHTS' | 'HOTELS' | 'BOTH';
}

export class ParseTravelIntentResponseDto {
  @ApiProperty({
    description:
      'False when the prompt is not a flight/hotel trip request; Q&A still starts at destination',
  })
  isTravelRequest!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  originIata!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  destinationIata!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  originCity!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  destinationCity!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  departureDate!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  returnDate!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['one_way', 'round_trip'],
  })
  tripType!: 'one_way' | 'round_trip' | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'Hotel nights (1–30) for one-way trips; null for round-trip',
  })
  hotelNights!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  adults!: number | null;

  @ApiProperty({ enum: ['gemini', 'groq', 'heuristic'] })
  source!: 'gemini' | 'groq' | 'heuristic';

  @ApiProperty({ type: [String] })
  notes!: string[];

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'Natural-language follow-up when a required search field is still missing. Null when ready to search.',
  })
  clarifyingQuestion!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: CLARIFICATION_FOCUSES,
    description: 'Which field clarifyingQuestion is asking for',
  })
  clarificationFocus!: ClarificationFocusDto | null;
}
