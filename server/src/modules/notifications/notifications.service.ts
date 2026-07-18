import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../auth/types/auth.types';
import {
  ListNotificationsQueryDto,
  NotificationListResponseDto,
  NotificationResponseDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(
    inputs: Array<{
      userId: string;
      type: NotificationType;
      title: string;
      body?: string | null;
      tripId?: string | null;
    }>,
  ): Promise<void> {
    const unique = new Map<string, (typeof inputs)[number]>();
    for (const input of inputs) {
      unique.set(`${input.userId}:${input.type}:${input.tripId ?? ''}`, input);
    }
    const rows = [...unique.values()];
    if (rows.length === 0) return;

    await this.prisma.notification.createMany({
      data: rows.map((row) => ({
        userId: row.userId,
        type: row.type,
        title: row.title,
        body: row.body ?? null,
        tripId: row.tripId ?? null,
      })),
    });
  }

  async list(
    actor: RequestUser,
    query: ListNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.NotificationWhereInput = {
      userId: actor.id,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [total, unreadCount, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId: actor.id, readAt: null },
      }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((n) => this.toResponse(n)),
      total,
      unreadCount,
      page,
      pageSize,
    };
  }

  async markRead(
    actor: RequestUser,
    id: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== actor.id) {
      throw new ForbiddenException('Cannot access another user notification');
    }

    if (notification.readAt) {
      return this.toResponse(notification);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toResponse(updated);
  }

  async markAllRead(actor: RequestUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private toResponse(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      tripId: notification.tripId,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
