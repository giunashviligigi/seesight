import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveTenantCompanyId } from '../../common/tenant/tenant.utils';
import { RequestUser } from '../auth/types/auth.types';
import { RejectTripDto } from '../trips/dto/trip.dto';
import { TripResponseDto } from '../trips/dto/trip-response.dto';
import { TripsService } from '../trips/trips.service';
import {
  ApprovalHistoryResponseDto,
  DecideApprovalDto,
  ListPendingApprovalsQueryDto,
  PendingApprovalListResponseDto,
} from './dto/approval.dto';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripsService: TripsService,
  ) {}

  async listPending(
    actor: RequestUser,
    query: ListPendingApprovalsQueryDto,
  ): Promise<PendingApprovalListResponseDto> {
    const companyId = resolveTenantCompanyId(actor, query.companyId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ApprovalWhereInput = {
      status: ApprovalStatus.PENDING,
      trip: {
        companyId,
        deletedAt: null,
      },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.approval.count({ where }),
      this.prisma.approval.findMany({
        where,
        include: {
          trip: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              travelers: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => {
        const name = [row.trip.createdBy.firstName, row.trip.createdBy.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();
        return {
          approvalId: row.id,
          tripId: row.tripId,
          purpose: row.trip.purpose,
          destinationCountry: row.trip.destinationCountry,
          destinationCity: row.trip.destinationCity,
          startDate: toDateString(row.trip.startDate),
          endDate: toDateString(row.trip.endDate),
          tripStatus: row.trip.status,
          approvalStatus: row.status,
          submittedAt: row.createdAt.toISOString(),
          createdByUserId: row.trip.createdByUserId,
          createdByEmail: row.trip.createdBy.email,
          createdByName: name || null,
          travelerCount: row.trip.travelers.length,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async getHistory(
    actor: RequestUser,
    tripId: string,
  ): Promise<ApprovalHistoryResponseDto> {
    // Access check via trips service
    await this.tripsService.getById(actor, tripId);

    const approval = await this.prisma.approval.findUnique({
      where: { tripId },
      include: {
        actions: {
          include: {
            actor: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!approval) {
      return {
        tripId,
        approvalId: null,
        status: null,
        actions: [],
      };
    }

    return {
      tripId,
      approvalId: approval.id,
      status: approval.status,
      actions: approval.actions.map((action) => {
        const name = [action.actor.firstName, action.actor.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();
        return {
          id: action.id,
          action: action.action,
          comment: action.comment,
          actorUserId: action.actorUserId,
          actorEmail: action.actor.email,
          actorName: name || null,
          createdAt: action.createdAt.toISOString(),
        };
      }),
    };
  }

  async approve(
    actor: RequestUser,
    tripId: string,
    dto: DecideApprovalDto,
  ): Promise<TripResponseDto> {
    return this.tripsService.approve(actor, tripId, dto.comment);
  }

  async reject(
    actor: RequestUser,
    tripId: string,
    dto: DecideApprovalDto,
  ): Promise<TripResponseDto> {
    const rejectDto: RejectTripDto = { comment: dto.comment };
    return this.tripsService.reject(actor, tripId, rejectDto);
  }

  async assertTripExists(tripId: string): Promise<void> {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: { id: true },
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
  }
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
