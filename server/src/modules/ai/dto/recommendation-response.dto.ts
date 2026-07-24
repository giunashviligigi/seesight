import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecommendationAlternativeDto {
  @ApiPropertyOptional({ nullable: true })
  flightOfferId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  hotelOfferId!: string | null;

  @ApiProperty()
  label!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  estimatedTotal!: number | null;

  @ApiProperty()
  rationale!: string;
}

export class RecommendationResultDto {
  @ApiPropertyOptional({ nullable: true })
  recommendedFlightId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  recommendedHotelId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  estimatedTotal!: number | null;

  @ApiProperty({ example: 'EUR' })
  currency!: string;

  @ApiProperty()
  reasoning!: string;

  @ApiPropertyOptional({ nullable: true })
  tradeoffs!: string | null;

  @ApiProperty({ type: [RecommendationAlternativeDto] })
  alternatives!: RecommendationAlternativeDto[];
}

export class RecommendItineraryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tripId!: string;

  @ApiProperty({
    description: 'Active LLM provider name, or rule_based on fallback',
    example: 'groq',
  })
  provider!: string;

  @ApiProperty({
    description: 'gemini | groq | rule_based — rule_based means LLM fallback',
    enum: ['gemini', 'groq', 'rule_based'],
  })
  source!: 'gemini' | 'groq' | 'rule_based';

  @ApiPropertyOptional({ nullable: true })
  promptSummary!: string | null;

  @ApiProperty({ type: RecommendationResultDto })
  recommendation!: RecommendationResultDto;

  @ApiProperty()
  createdAt!: string;
}

export class RecommendationHistoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tripId!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty({ enum: ['gemini', 'groq', 'rule_based'] })
  source!: 'gemini' | 'groq' | 'rule_based';

  @ApiPropertyOptional({ nullable: true })
  promptSummary!: string | null;

  @ApiProperty({ type: RecommendationResultDto })
  recommendation!: RecommendationResultDto;

  @ApiProperty()
  createdAt!: string;
}

export class RecommendationHistoryResponseDto {
  @ApiProperty({ type: [RecommendationHistoryItemDto] })
  items!: RecommendationHistoryItemDto[];
}
