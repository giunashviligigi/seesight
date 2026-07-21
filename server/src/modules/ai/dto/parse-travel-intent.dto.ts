import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    enum: ['origin', 'destination', 'departureDate'],
  })
  @IsOptional()
  @IsIn(['origin', 'destination', 'departureDate'])
  clarificationFocus?: 'origin' | 'destination' | 'departureDate';
}

export class ParseTravelIntentResponseDto {
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

  @ApiPropertyOptional({ nullable: true, type: Number })
  adults!: number | null;

  @ApiProperty({ enum: ['gemini', 'heuristic'] })
  source!: 'gemini' | 'heuristic';

  @ApiProperty({ type: [String] })
  notes!: string[];

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'Natural-language follow-up when origin, destination, or departure date is still missing. Null when ready to search.',
  })
  clarifyingQuestion!: string | null;
}
