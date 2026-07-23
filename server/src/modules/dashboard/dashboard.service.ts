import { Injectable } from '@nestjs/common';
import {
  ApprovalStatus,
  Prisma,
  TripStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveTenantCompanyId } from '../../common/tenant/tenant.utils';
import { COMMITTED_TRIP_STATUSES } from '../../common/analytics/spend.utils';
import { RequestUser } from '../auth/types/auth.types';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';
import {
  DashboardSummaryResponseDto,
  DashboardUpcomingTripDto,
} from './dto/dashboard-summary-response.dto';

const UPCOMING_EXCLUDED: TripStatus[] = [
  TripStatus.CANCELLED,
  TripStatus.COMPLETED,
  TripStatus.REJECTED,
];

const UPCOMING_LIST_LIMIT = 8;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    actor: RequestUser,
    query: DashboardSummaryQueryDto,
  ): Promise<DashboardSummaryResponseDto> {
    const companyId = resolveTenantCompanyId(actor, query.companyId);
    const scope = actor.role === UserRole.EMPLOYEE ? 'self' : 'company';
    const { periodFrom, periodTo } = this.resolvePeriod(query.from, query.to);
    const today = startOfUtcDay(new Date());
    const { monthStart, monthEnd } = currentUtcMonthBounds(today);

    const tripScope = await this.buildTripScopeFilter(actor, companyId, scope);

    const baseTripWhere: Prisma.TripWhereInput = {
      companyId,
      deletedAt: null,
      ...tripScope,
    };

    const upcomingWhere: Prisma.TripWhereInput = {
      ...baseTripWhere,
      startDate: { gte: today },
      status: { notIn: UPCOMING_EXCLUDED },
    };

    const periodTripWhere: Prisma.TripWhereInput = {
      ...baseTripWhere,
      startDate: { gte: periodFrom, lte: periodTo },
      status: { in: COMMITTED_TRIP_STATUSES },
    };

    const monthTripWhere: Prisma.TripWhereInput = {
      ...baseTripWhere,
      startDate: { gte: monthStart, lte: monthEnd },
      status: { in: COMMITTED_TRIP_STATUSES },
    };

    const approvalWhere: Prisma.ApprovalWhereInput = {
      status: ApprovalStatus.PENDING,
      trip: {
        companyId,
        deletedAt: null,
        ...tripScope,
      },
    };

    const [
      upcomingTripsCount,
      upcomingTrips,
      activeEmployeesCount,
      pendingApprovalsCount,
      tripsThisMonth,
      periodTrips,
    ] = await Promise.all([
      this.prisma.trip.count({ where: upcomingWhere }),
      this.prisma.trip.findMany({
        where: upcomingWhere,
        orderBy: { startDate: 'asc' },
        take: UPCOMING_LIST_LIMIT,
        select: {
          id: true,
          purpose: true,
          destinationCountry: true,
          destinationCity: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      }),
      this.prisma.employee.count({
        where: {
          companyId,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      }),
      this.prisma.approval.count({ where: approvalWhere }),
      this.prisma.trip.count({ where: monthTripWhere }),
      this.prisma.trip.findMany({
        where: periodTripWhere,
        select: {
          id: true,
          flightOfferSnapshots: {
            where: { selected: true },
            select: { priceAmount: true, currency: true },
          },
          hotelOfferSnapshots: {
            where: { selected: true },
            select: { priceAmount: true, currency: true },
          },
        },
      }),
    ]);

    const { amount, currency, tripsWithSpend } =
      this.aggregateSelectedSpend(periodTrips);

    const averageTripCost =
      tripsWithSpend > 0
        ? roundMoney(amount / tripsWithSpend)
        : 0;

    return {
      companyId,
      scope,
      upcomingTripsCount,
      upcomingTrips: upcomingTrips.map(mapUpcomingTrip),
      totalTravelSpending: {
        amount,
        currency,
        periodFrom: toDateString(periodFrom),
        periodTo: toDateString(periodTo),
      },
      activeEmployeesCount,
      pendingApprovalsCount,
      statistics: {
        tripsThisMonth,
        averageTripCost,
      },
    };
  }

  private async buildTripScopeFilter(
    actor: RequestUser,
    companyId: string,
    scope: 'company' | 'self',
  ): Promise<Prisma.TripWhereInput> {
    if (scope !== 'self') {
      return {};
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        companyId,
        userId: actor.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!employee) {
      return { id: { in: [] } };
    }

    return {
      travelers: {
        some: { employeeId: employee.id },
      },
    };
  }

  private resolvePeriod(
    from?: string,
    to?: string,
  ): { periodFrom: Date; periodTo: Date } {
    const today = startOfUtcDay(new Date());
    const periodTo = to ? startOfUtcDay(new Date(to)) : today;
    const periodFrom = from
      ? startOfUtcDay(new Date(from))
      : new Date(Date.UTC(today.getUTCFullYear(), 0, 1));

    return { periodFrom, periodTo };
  }

  private aggregateSelectedSpend(
    trips: Array<{
      id: string;
      flightOfferSnapshots: Array<{
        priceAmount: Prisma.Decimal | null;
        currency: string | null;
      }>;
      hotelOfferSnapshots: Array<{
        priceAmount: Prisma.Decimal | null;
        currency: string | null;
      }>;
    }>,
  ): { amount: number; currency: string; tripsWithSpend: number } {
    let amount = 0;
    let tripsWithSpend = 0;
    const currencyCounts = new Map<string, number>();

    for (const trip of trips) {
      let tripTotal = 0;
      for (const offer of [
        ...trip.flightOfferSnapshots,
        ...trip.hotelOfferSnapshots,
      ]) {
        const value = decimalToNumber(offer.priceAmount);
        if (value === null) continue;
        tripTotal += value;
        const currency = offer.currency?.trim() || 'EUR';
        currencyCounts.set(currency, (currencyCounts.get(currency) ?? 0) + 1);
      }
      if (tripTotal > 0) {
        amount += tripTotal;
        tripsWithSpend += 1;
      }
    }

    let currency = 'EUR';
    let maxCount = 0;
    for (const [code, count] of currencyCounts) {
      if (count > maxCount) {
        maxCount = count;
        currency = code;
      }
    }

    return { amount: roundMoney(amount), currency, tripsWithSpend };
  }
}

function mapUpcomingTrip(trip: {
  id: string;
  purpose: string;
  destinationCountry: string | null;
  destinationCity: string | null;
  startDate: Date;
  endDate: Date;
  status: TripStatus;
}): DashboardUpcomingTripDto {
  return {
    id: trip.id,
    purpose: trip.purpose,
    destinationCountry: trip.destinationCountry,
    destinationCity: trip.destinationCity,
    startDate: toDateString(trip.startDate),
    endDate: toDateString(trip.endDate),
    status: trip.status,
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function currentUtcMonthBounds(today: Date): {
  monthStart: Date;
  monthEnd: Date;
} {
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const monthEnd = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
  );
  return { monthStart, monthEnd };
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
