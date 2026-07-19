import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParseTravelIntentDto {
  @ApiProperty({
    example:
      'from 1 august to 6 august i want to go from tbilisi to berlin. suggest flights and hotels',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  prompt!: string;

  @ApiPropertyOptional({
    description: 'ISO date used to resolve year-less dates (defaults to today)',
    example: '2026-07-19',
  })
  @IsOptional()
  @IsString()
  referenceDate?: string;
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

  @ApiPropertyOptional({ nullable: true, type: Number })
  adults!: number | null;

  @ApiProperty({ enum: ['gemini', 'heuristic'] })
  source!: 'gemini' | 'heuristic';

  @ApiProperty({ type: [String] })
  notes!: string[];
}
