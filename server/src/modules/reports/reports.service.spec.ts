import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TripStatus, UserRole, UserStatus } from '@prisma/client';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../auth/types/auth.types';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    trip: { findMany: jest.Mock };
    reportCache: { findUnique: jest.Mock; upsert: jest.Mock };
  };

  const admin: RequestUser = {
    id: 'admin_1',
    email: 'admin@acme.example',
    role: UserRole.COMPANY_ADMIN,
    status: UserStatus.ACTIVE,
    companyId: 'company_a',
    firstName: 'Ada',
    lastName: 'Admin',
    createdAt: new Date(),
  };

  const trips = [
    {
      id: 'trip_1',
      startDate: new Date('2026-09-10'),
      destinationCountry: 'DE',
      destinationCity: 'Berlin',
      status: TripStatus.PENDING_APPROVAL,
      travelers: [
        {
          isPrimary: true,
          employee: {
            departmentId: 'dept_eng',
            department: { id: 'dept_eng', name: 'Engineering' },
          },
        },
      ],
      flightOfferSnapshots: [{ priceAmount: 620, currency: 'EUR' }],
      hotelOfferSnapshots: [{ priceAmount: 480, currency: 'EUR' }],
    },
    {
      id: 'trip_2',
      startDate: new Date('2026-10-05'),
      destinationCountry: 'FR',
      destinationCity: 'Paris',
      status: TripStatus.COMPLETED,
      travelers: [
        {
          isPrimary: true,
          employee: {
            departmentId: 'dept_sales',
            department: { id: 'dept_sales', name: 'Sales' },
          },
        },
      ],
      flightOfferSnapshots: [{ priceAmount: 400, currency: 'EUR' }],
      hotelOfferSnapshots: [{ priceAmount: 300, currency: 'EUR' }],
    },
  ];

  beforeEach(async () => {
    prisma = {
      trip: { findMany: jest.fn().mockResolvedValue(trips) },
      reportCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  it('aggregates monthly spend, departments, destinations, and average', async () => {
    const result = await service.getSummary(admin, {
      from: '2026-09-01',
      to: '2026-10-31',
    });

    expect(result.totalSpend).toBe(1800);
    expect(result.tripCount).toBe(2);
    expect(result.tripsWithSpend).toBe(2);
    expect(result.averageTripCost).toBe(900);
    expect(result.currency).toBe('EUR');

    const sep = result.monthlySpending.find((m) => m.month === '2026-09');
    const oct = result.monthlySpending.find((m) => m.month === '2026-10');
    expect(sep?.amount).toBe(1100);
    expect(oct?.amount).toBe(700);

    expect(result.tripsByDepartment).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ departmentName: 'Engineering', tripCount: 1 }),
        expect.objectContaining({ departmentName: 'Sales', tripCount: 1 }),
      ]),
    );
    expect(result.topCountries[0].label).toMatch(/DE|FR/);
    expect(result.topCities.some((c) => c.city === 'Berlin')).toBe(true);
    expect(prisma.reportCache.upsert).toHaveBeenCalled();
  });

  it('rejects ranges longer than 24 months', async () => {
    await expect(
      service.getSummary(admin, {
        from: '2024-01-01',
        to: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks cross-tenant companyId override', async () => {
    await expect(
      service.getSummary(admin, { companyId: 'company_b' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exports CSV for monthly dataset', async () => {
    const exported = await service.export(admin, {
      from: '2026-09-01',
      to: '2026-10-31',
      format: 'csv',
      dataset: 'monthly',
    });

    expect(exported.format).toBe('csv');
    expect(exported.contentType).toContain('text/csv');
    expect(String(exported.body)).toContain('month,amount,tripCount,currency');
    expect(String(exported.body)).toContain('2026-09,1100,1,EUR');
  });

  it('returns cached summary when not expired', async () => {
    const cached = {
      companyId: 'company_a',
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
      currency: 'EUR',
      totalSpend: 1100,
      tripCount: 1,
      tripsWithSpend: 1,
      averageTripCost: 1100,
      monthlySpending: [],
      tripsByDepartment: [],
      topCountries: [],
      topCities: [],
      maxRangeMonths: 24,
    };
    prisma.reportCache.findUnique.mockResolvedValue({
      payloadJson: cached,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.getSummary(admin, {});
    expect(result.totalSpend).toBe(1100);
    expect(prisma.trip.findMany).not.toHaveBeenCalled();
  });
});
