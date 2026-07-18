import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
  ApprovalStatus,
  TripStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../auth/types/auth.types';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    trip: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    employee: {
      count: jest.Mock;
      findFirst: jest.Mock;
    };
    approval: {
      count: jest.Mock;
    };
  };

  const adminA: RequestUser = {
    id: 'user_a',
    email: 'a@acme.example',
    role: UserRole.COMPANY_ADMIN,
    status: UserStatus.ACTIVE,
    companyId: 'company_a',
    firstName: 'Ada',
    lastName: 'Admin',
    createdAt: new Date(),
  };

  const employeeUser: RequestUser = {
    ...adminA,
    id: 'emp_user',
    email: 'traveler@acme.example',
    role: UserRole.EMPLOYEE,
  };

  const superAdmin: RequestUser = {
    ...adminA,
    id: 'sa',
    email: 'sa@seesight.local',
    role: UserRole.SUPER_ADMIN,
    companyId: null,
  };

  beforeEach(async () => {
    prisma = {
      trip: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      employee: {
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      approval: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('aggregates company-wide summary for company admin', async () => {
    prisma.trip.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.trip.findMany
      .mockResolvedValueOnce([
        {
          id: 'trip_1',
          purpose: 'Berlin onboarding',
          destinationCountry: 'DE',
          destinationCity: 'Berlin',
          startDate: new Date('2026-09-10'),
          endDate: new Date('2026-09-14'),
          status: TripStatus.PENDING_APPROVAL,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'trip_1',
          flightOfferSnapshots: [
            { priceAmount: 620, currency: 'EUR' },
          ],
          hotelOfferSnapshots: [
            { priceAmount: 480, currency: 'EUR' },
          ],
        },
      ]);
    prisma.employee.count.mockResolvedValue(112);
    prisma.approval.count.mockResolvedValue(1);

    const result = await service.getSummary(adminA, {
      from: '2026-01-01',
      to: '2026-12-31',
    });

    expect(result.scope).toBe('company');
    expect(result.companyId).toBe('company_a');
    expect(result.upcomingTripsCount).toBe(1);
    expect(result.upcomingTrips).toHaveLength(1);
    expect(result.upcomingTrips[0].purpose).toBe('Berlin onboarding');
    expect(result.activeEmployeesCount).toBe(112);
    expect(result.pendingApprovalsCount).toBe(1);
    expect(result.totalTravelSpending.amount).toBe(1100);
    expect(result.totalTravelSpending.currency).toBe('EUR');
    expect(result.statistics.tripsThisMonth).toBe(1);
    expect(result.statistics.averageTripCost).toBe(1100);
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it('scopes trips to the employee traveler profile', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp_1' });
    prisma.trip.count.mockResolvedValue(0).mockResolvedValue(0);
    prisma.trip.findMany.mockResolvedValue([]).mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(112);
    prisma.approval.count.mockResolvedValue(0);

    const result = await service.getSummary(employeeUser, {});

    expect(result.scope).toBe('self');
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company_a',
        userId: 'emp_user',
        deletedAt: null,
      },
      select: { id: true },
    });

    const upcomingWhere = prisma.trip.count.mock.calls[0][0].where;
    expect(upcomingWhere.travelers).toEqual({
      some: { employeeId: 'emp_1' },
    });

    const approvalWhere = prisma.approval.count.mock.calls[0][0].where;
    expect(approvalWhere.status).toBe(ApprovalStatus.PENDING);
    expect(approvalWhere.trip.travelers).toEqual({
      some: { employeeId: 'emp_1' },
    });
  });

  it('blocks company admin from another tenant via companyId query', async () => {
    await expect(
      service.getSummary(adminA, { companyId: 'company_b' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires companyId for super admin', async () => {
    await expect(service.getSummary(superAdmin, {})).rejects.toThrow(
      /companyId/i,
    );
  });

  it('returns empty spend metrics when no selected offers', async () => {
    prisma.trip.count.mockResolvedValue(0).mockResolvedValue(0);
    prisma.trip.findMany.mockResolvedValue([]).mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);
    prisma.approval.count.mockResolvedValue(0);

    const result = await service.getSummary(adminA, {});

    expect(result.upcomingTrips).toEqual([]);
    expect(result.totalTravelSpending.amount).toBe(0);
    expect(result.statistics.averageTripCost).toBe(0);
  });
});
