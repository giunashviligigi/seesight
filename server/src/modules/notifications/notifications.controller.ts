import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
  ListNotificationsQueryDto,
  NotificationListResponseDto,
  NotificationResponseDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List in-app notifications for the current user' })
  @ApiOkResponse({ type: NotificationListResponseDto })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.list(user, query);
  }

  @Post('read-all')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { updated: { type: 'number' } },
    },
  })
  markAllRead(
    @CurrentUser() user: RequestUser,
  ): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':id/read')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiOkResponse({ type: NotificationResponseDto })
  markRead(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markRead(user, id);
  }
}
