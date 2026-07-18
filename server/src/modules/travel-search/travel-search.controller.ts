import { Controller, Get, Query } from '@nestjs/common';
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
import {
  SearchFlightsQueryDto,
  SearchHotelsQueryDto,
} from './dto/travel-search-query.dto';
import {
  FlightSearchResponseDto,
  HotelSearchResponseDto,
} from './dto/travel-search-response.dto';
import { TravelSearchService } from './travel-search.service';

@ApiTags('travel')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('travel')
export class TravelSearchController {
  constructor(private readonly travelSearchService: TravelSearchService) {}

  @Get('flights')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Search flights via SerpAPI Google Flights (normalized offers)',
  })
  @ApiOkResponse({ type: FlightSearchResponseDto })
  searchFlights(
    @CurrentUser() user: RequestUser,
    @Query() query: SearchFlightsQueryDto,
  ): Promise<FlightSearchResponseDto> {
    return this.travelSearchService.searchFlights(user, query);
  }

  @Get('hotels')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Search hotels via SerpAPI Google Hotels (normalized offers)',
  })
  @ApiOkResponse({ type: HotelSearchResponseDto })
  searchHotels(
    @CurrentUser() user: RequestUser,
    @Query() query: SearchHotelsQueryDto,
  ): Promise<HotelSearchResponseDto> {
    return this.travelSearchService.searchHotels(user, query);
  }
}
