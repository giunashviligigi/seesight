import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { TripResponseDto } from '../trips/dto/trip-response.dto';
import { ApprovalsService } from './approvals.service';
import {
  ApprovalHistoryResponseDto,
  DecideApprovalDto,
  ListPendingApprovalsQueryDto,
  PendingApprovalListResponseDto,
} from './dto/approval.dto';

@ApiTags('approvals')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('pending')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'List pending trip approvals for the company' })
  @ApiOkResponse({ type: PendingApprovalListResponseDto })
  listPending(
    @CurrentUser() user: RequestUser,
    @Query() query: ListPendingApprovalsQueryDto,
  ): Promise<PendingApprovalListResponseDto> {
    return this.approvalsService.listPending(user, query);
  }

  @Get(':tripId/history')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Approval audit trail for a trip' })
  @ApiOkResponse({ type: ApprovalHistoryResponseDto })
  getHistory(
    @CurrentUser() user: RequestUser,
    @Param('tripId') tripId: string,
  ): Promise<ApprovalHistoryResponseDto> {
    return this.approvalsService.getHistory(user, tripId);
  }

  @Post(':tripId/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Approve a pending trip (self-approve forbidden)',
  })
  @ApiOkResponse({ type: TripResponseDto })
  approve(
    @CurrentUser() user: RequestUser,
    @Param('tripId') tripId: string,
    @Body() dto: DecideApprovalDto,
  ): Promise<TripResponseDto> {
    return this.approvalsService.approve(user, tripId, dto ?? {});
  }

  @Post(':tripId/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Reject a pending trip (self-approve forbidden)',
  })
  @ApiOkResponse({ type: TripResponseDto })
  reject(
    @CurrentUser() user: RequestUser,
    @Param('tripId') tripId: string,
    @Body() dto: DecideApprovalDto,
  ): Promise<TripResponseDto> {
    return this.approvalsService.reject(user, tripId, dto ?? {});
  }
}
