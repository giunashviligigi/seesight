import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import type { RequestUser } from '../auth/types/auth.types';
import { AiService } from './ai.service';
import { RecommendItineraryDto } from './dto/recommend-itinerary.dto';
import {
  RecommendationHistoryResponseDto,
  RecommendItineraryResponseDto,
} from './dto/recommendation-response.dto';

@ApiTags('ai')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('recommend-itinerary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({
    summary:
      'Recommend flight/hotel combination for a trip (Gemini with rule-based fallback)',
  })
  @ApiOkResponse({ type: RecommendItineraryResponseDto })
  recommend(
    @CurrentUser() user: RequestUser,
    @Body() dto: RecommendItineraryDto,
  ): Promise<RecommendItineraryResponseDto> {
    return this.aiService.recommendItinerary(user, dto);
  }

  @Get('trips/:tripId/recommendations')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List persisted AI recommendations for a trip' })
  @ApiOkResponse({ type: RecommendationHistoryResponseDto })
  list(
    @CurrentUser() user: RequestUser,
    @Param('tripId') tripId: string,
  ): Promise<RecommendationHistoryResponseDto> {
    return this.aiService.listRecommendations(user, tripId);
  }
}
