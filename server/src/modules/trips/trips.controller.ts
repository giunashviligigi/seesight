import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
  CreateTripDto,
  ListTripsQueryDto,
  ApproveTripDto,
  RejectTripDto,
  UpdateTripDto,
} from './dto/trip.dto';
import {
  AttachFlightOfferDto,
  AttachHotelOfferDto,
} from './dto/attach-offer.dto';
import {
  TripListResponseDto,
  TripResponseDto,
} from './dto/trip-response.dto';
import { TripsService } from './trips.service';

@ApiTags('trips')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a draft trip with travelers' })
  @ApiOkResponse({ type: TripResponseDto })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTripDto,
  ): Promise<TripResponseDto> {
    return this.tripsService.create(user, dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'List trip history (status, date range, department filters)',
  })
  @ApiOkResponse({ type: TripListResponseDto })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListTripsQueryDto,
  ): Promise<TripListResponseDto> {
    return this.tripsService.list(user, query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get trip by id' })
  @ApiOkResponse({ type: TripResponseDto })
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<TripResponseDto> {
    return this.tripsService.getById(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Update trip fields and travelers (locked after APPROVED)',
  })
  @ApiOkResponse({ type: TripResponseDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTripDto,
  ): Promise<TripResponseDto> {
    return this.tripsService.update(user, id, dto);
  }

  @Post(':id/submit')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Submit draft trip for approval' })
  @ApiOkResponse({ type: TripResponseDto })
  submit(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<TripResponseDto> {
    return this.tripsService.submit(user, id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Cancel trip (remains visible in history)' })
  @ApiOkResponse({ type: TripResponseDto })
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<TripResponseDto> {
    return this.tripsService.cancel(user, id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({
    summary:
      'Soft-delete trip (draft, pending, approved, rejected, or cancelled). Hidden from lists.',
  })
  @ApiOkResponse({ type: TripResponseDto })
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<TripResponseDto> {
    return this.tripsService.remove(user, id);
  }

  @Post(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Approve pending trip',
  })
  @ApiOkResponse({ type: TripResponseDto })
  approve(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ApproveTripDto,
  ): Promise<TripResponseDto> {
    return this.tripsService.approve(user, id, dto?.comment);
  }

  @Post(':id/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Reject pending trip',
  })
  @ApiOkResponse({ type: TripResponseDto })
  reject(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RejectTripDto,
  ): Promise<TripResponseDto> {
    return this.tripsService.reject(user, id, dto ?? {});
  }

  @Post(':id/start')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Mark approved trip as in progress' })
  @ApiOkResponse({ type: TripResponseDto })
  start(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<TripResponseDto> {
    return this.tripsService.start(user, id);
  }

  @Post(':id/complete')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Mark in-progress trip as completed' })
  @ApiOkResponse({ type: TripResponseDto })
  complete(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<TripResponseDto> {
    return this.tripsService.complete(user, id);
  }

  @Post(':id/reopen')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Reopen a rejected trip back to draft' })
  @ApiOkResponse({ type: TripResponseDto })
  reopen(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<TripResponseDto> {
    return this.tripsService.reopen(user, id);
  }

  @Post(':id/offers/flight')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Attach a selected flight offer snapshot to a trip',
  })
  @ApiOkResponse({ type: TripResponseDto })
  attachFlight(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AttachFlightOfferDto,
  ): Promise<TripResponseDto> {
    return this.tripsService.attachFlightOffer(user, id, dto);
  }

  @Post(':id/offers/hotel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Attach a selected hotel offer snapshot to a trip',
  })
  @ApiOkResponse({ type: TripResponseDto })
  attachHotel(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AttachHotelOfferDto,
  ): Promise<TripResponseDto> {
    return this.tripsService.attachHotelOffer(user, id, dto);
  }
}
