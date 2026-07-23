import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  COMMITTED_TRIP_STATUSES,
  monthsBetweenInclusive,
  pickMajorityCurrency,
  roundMoney,
  startOfUtcDay,
  toCsv,
  toDateString,
  toMonthKey,
  tripSelectedSpend,
} from '../../common/analytics/spend.utils';
import { toCountryName } from '../../common/geo/country';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveTenantCompanyId } from '../../common/tenant/tenant.utils';
import { RequestUser } from '../auth/types/auth.types';
import {
  ReportsExportQueryDto,
  ReportsQueryDto,
  ReportsSummaryResponseDto,
} from './dto/reports.dto';

const MAX_RANGE_MONTHS = 24;
const CACHE_TTL_MS = 15 * 60 * 1000;

type TripForReport = Prisma.TripGetPayload<{
  include: {
    travelers: {
      include: {
        employee: {
          include: { department: { select: { id: true; name: true } } };
        };
      };
    };
    flightOfferSnapshots: {
      where: { selected: true };
      select: { priceAmount: true; currency: true };
    };
    hotelOfferSnapshots: {
      where: { selected: true };
      select: { priceAmount: true; currency: true };
    };
  };
}>;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    actor: RequestUser,
    query: ReportsQueryDto,
  ): Promise<ReportsSummaryResponseDto> {
    const companyId = resolveTenantCompanyId(actor, query.companyId);
    const { periodFrom, periodTo } = this.resolvePeriod(query.from, query.to);
    this.assertRangeLimit(periodFrom, periodTo);

    const cacheKey = `summary:${toDateString(periodFrom)}:${toDateString(periodTo)}`;
    const cached = await this.readCache(companyId, cacheKey);
    if (cached) {
      return cached;
    }

    const trips = await this.loadTrips(companyId, periodFrom, periodTo);
    const summary = this.buildSummary(
      companyId,
      periodFrom,
      periodTo,
      trips,
    );
    await this.writeCache(companyId, cacheKey, summary);
    return summary;
  }

  async export(
    actor: RequestUser,
    query: ReportsExportQueryDto,
  ): Promise<{
    format: 'json' | 'csv';
    filename: string;
    body: string | object;
    contentType: string;
  }> {
    const summary = await this.getSummary(actor, query);
    const format = query.format ?? 'csv';
    const dataset = query.dataset ?? 'summary';
    const stamp = `${summary.periodFrom}_${summary.periodTo}`;

    if (format === 'json') {
      return {
        format: 'json',
        filename: `seesight-reports-${dataset}-${stamp}.json`,
        body: this.datasetPayload(summary, dataset),
        contentType: 'application/json; charset=utf-8',
      };
    }

    return {
      format: 'csv',
      filename: `seesight-reports-${dataset}-${stamp}.csv`,
      body: this.datasetCsv(summary, dataset),
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private datasetPayload(
    summary: ReportsSummaryResponseDto,
    dataset: string,
  ): object {
    switch (dataset) {
      case 'monthly':
        return summary.monthlySpending;
      case 'departments':
        return summary.tripsByDepartment;
      case 'destinations':
        return {
          countries: summary.topCountries,
          cities: summary.topCities,
        };
      default:
        return summary;
    }
  }

  private datasetCsv(
    summary: ReportsSummaryResponseDto,
    dataset: string,
  ): string {
    switch (dataset) {
      case 'monthly':
        return toCsv([
          ['month', 'amount', 'tripCount', 'currency'],
          ...summary.monthlySpending.map((row) => [
            row.month,
            row.amount,
            row.tripCount,
            summary.currency,
          ]),
        ]);
      case 'departments':
        return toCsv([
          ['departmentId', 'departmentName', 'tripCount'],
          ...summary.tripsByDepartment.map((row) => [
            row.departmentId,
            row.departmentName,
            row.tripCount,
          ]),
        ]);
      case 'destinations':
        return toCsv([
          ['type', 'label', 'country', 'city', 'tripCount'],
          ...summary.topCountries.map((row) => [
            'country',
            row.label,
            row.country,
            null,
            row.tripCount,
          ]),
          ...summary.topCities.map((row) => [
            'city',
            row.label,
            row.country,
            row.city,
            row.tripCount,
          ]),
        ]);
      default:
        return toCsv([
          ['metric', 'value'],
          ['periodFrom', summary.periodFrom],
          ['periodTo', summary.periodTo],
          ['currency', summary.currency],
          ['totalSpend', summary.totalSpend],
          ['tripCount', summary.tripCount],
          ['tripsWithSpend', summary.tripsWithSpend],
          ['averageTripCost', summary.averageTripCost],
          [],
          ['month', 'amount', 'tripCount'],
          ...summary.monthlySpending.map((row) => [
            row.month,
            row.amount,
            row.tripCount,
          ]),
          [],
          ['departmentName', 'tripCount'],
          ...summary.tripsByDepartment.map((row) => [
            row.departmentName,
            row.tripCount,
          ]),
          [],
          ['country', 'tripCount'],
          ...summary.topCountries.map((row) => [row.label, row.tripCount]),
          [],
          ['city', 'country', 'tripCount'],
          ...summary.topCities.map((row) => [
            row.city,
            row.country,
            row.tripCount,
          ]),
        ]);
    }
  }

  private buildSummary(
    companyId: string,
    periodFrom: Date,
    periodTo: Date,
    trips: TripForReport[],
  ): ReportsSummaryResponseDto {
    const monthlyMap = new Map<string, { amount: number; tripCount: number }>();
    const deptMap = new Map<
      string,
      { departmentId: string | null; departmentName: string; tripCount: number }
    >();
    const countryMap = new Map<string, number>();
    const cityMap = new Map<
      string,
      { city: string; country: string | null; tripCount: number }
    >();

    let totalSpend = 0;
    let tripsWithSpend = 0;
    const allCurrencies: string[] = [];

    // Fill empty months in range for stable charts
    const cursor = new Date(
      Date.UTC(periodFrom.getUTCFullYear(), periodFrom.getUTCMonth(), 1),
    );
    const endMonth = new Date(
      Date.UTC(periodTo.getUTCFullYear(), periodTo.getUTCMonth(), 1),
    );
    while (cursor.getTime() <= endMonth.getTime()) {
      monthlyMap.set(toMonthKey(cursor), { amount: 0, tripCount: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    for (const trip of trips) {
      const month = toMonthKey(trip.startDate);
      const spend = tripSelectedSpend(trip);
      const monthRow = monthlyMap.get(month) ?? { amount: 0, tripCount: 0 };
      monthRow.tripCount += 1;
      monthRow.amount = roundMoney(monthRow.amount + spend.amount);
      monthlyMap.set(month, monthRow);

      if (spend.amount > 0) {
        totalSpend = roundMoney(totalSpend + spend.amount);
        tripsWithSpend += 1;
        allCurrencies.push(...spend.currencies);
      }

      const primary =
        trip.travelers.find((t) => t.isPrimary) ?? trip.travelers[0];
      const deptId = primary?.employee.departmentId ?? null;
      const deptName = primary?.employee.department?.name ?? 'unassigned';
      const deptKey = deptId ?? 'unassigned';
      const deptRow = deptMap.get(deptKey) ?? {
        departmentId: deptId,
        departmentName: deptName,
        tripCount: 0,
      };
      deptRow.tripCount += 1;
      deptMap.set(deptKey, deptRow);

      if (trip.destinationCountry) {
        const code = trip.destinationCountry.toUpperCase();
        countryMap.set(code, (countryMap.get(code) ?? 0) + 1);
      }
      if (trip.destinationCity) {
        const city = trip.destinationCity.trim();
        const key = `${city}|${trip.destinationCountry ?? ''}`;
        const existing = cityMap.get(key) ?? {
          city,
          country: trip.destinationCountry
            ? trip.destinationCountry.toUpperCase()
            : null,
          tripCount: 0,
        };
        existing.tripCount += 1;
        cityMap.set(key, existing);
      }
    }

    const currency = pickMajorityCurrency(allCurrencies);
    const averageTripCost =
      tripsWithSpend > 0 ? roundMoney(totalSpend / tripsWithSpend) : 0;

    return {
      companyId,
      periodFrom: toDateString(periodFrom),
      periodTo: toDateString(periodTo),
      currency,
      totalSpend,
      tripCount: trips.length,
      tripsWithSpend,
      averageTripCost,
      monthlySpending: [...monthlyMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, row]) => ({
          month,
          amount: row.amount,
          tripCount: row.tripCount,
        })),
      tripsByDepartment: [...deptMap.values()].sort(
        (a, b) => b.tripCount - a.tripCount || a.departmentName.localeCompare(b.departmentName),
      ),
      topCountries: [...countryMap.entries()]
        .map(([country, tripCount]) => ({
          label: toCountryName(country) ?? country,
          country,
          city: null,
          tripCount,
        }))
        .sort((a, b) => b.tripCount - a.tripCount || a.label.localeCompare(b.label))
        .slice(0, 10),
      topCities: [...cityMap.values()]
        .map((row) => {
          const countryLabel = row.country
            ? (toCountryName(row.country) ?? row.country)
            : null;
          return {
            label: countryLabel ? `${row.city}, ${countryLabel}` : row.city,
            country: row.country,
            city: row.city,
            tripCount: row.tripCount,
          };
        })
        .sort((a, b) => b.tripCount - a.tripCount || a.label.localeCompare(b.label))
        .slice(0, 10),
      maxRangeMonths: MAX_RANGE_MONTHS,
    };
  }

  private async loadTrips(
    companyId: string,
    periodFrom: Date,
    periodTo: Date,
  ): Promise<TripForReport[]> {
    return this.prisma.trip.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: COMMITTED_TRIP_STATUSES },
        startDate: { gte: periodFrom, lte: periodTo },
      },
      include: {
        travelers: {
          include: {
            employee: {
              include: { department: { select: { id: true, name: true } } },
            },
          },
        },
        flightOfferSnapshots: {
          where: { selected: true },
          select: { priceAmount: true, currency: true },
        },
        hotelOfferSnapshots: {
          where: { selected: true },
          select: { priceAmount: true, currency: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });
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

    if (periodTo.getTime() < periodFrom.getTime()) {
      throw new BadRequestException('to must be on or after from');
    }

    return { periodFrom, periodTo };
  }

  private assertRangeLimit(periodFrom: Date, periodTo: Date): void {
    const months = monthsBetweenInclusive(periodFrom, periodTo);
    if (months > MAX_RANGE_MONTHS) {
      throw new BadRequestException(
        `Report range cannot exceed ${MAX_RANGE_MONTHS} months`,
      );
    }
  }

  private async readCache(
    companyId: string,
    reportKey: string,
  ): Promise<ReportsSummaryResponseDto | null> {
    const row = await this.prisma.reportCache.findUnique({
      where: { companyId_reportKey: { companyId, reportKey } },
    });
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return row.payloadJson as unknown as ReportsSummaryResponseDto;
  }

  private async writeCache(
    companyId: string,
    reportKey: string,
    payload: ReportsSummaryResponseDto,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    await this.prisma.reportCache.upsert({
      where: { companyId_reportKey: { companyId, reportKey } },
      create: {
        companyId,
        reportKey,
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
      update: {
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
        expiresAt,
      },
    });
  }
}
