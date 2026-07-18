import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TripStatus, UserRole, UserStatus } from '@prisma/client';
import { TripsService } from './trips.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../auth/types/auth.types';

describe('TripsService', () => {
  let service: TripsService;
  let prisma: {
    trip: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    tripTraveler: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    employee: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    approval: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    approvalAction: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
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

  const employeeUser: RequestUser = {
    ...admin,
    id: 'emp_user',
    email: 'traveler@acme.example',
    role: UserRole.EMPLOYEE,
  };

  const baseTrip = {
    id: 'trip_1',
    companyId: 'company_a',
    createdByUserId: 'admin_1',
    purpose: 'Berlin workshop',
    destinationCountry: 'DE',
    destinationCity: 'Berlin',
    startDate: new Date('2026-09-10'),
    endDate: new Date('2026-09-14'),
    budgetAmount: 1800,
    budgetCurrency: 'EUR',
    notes: null,
    status: TripStatus.DRAFT,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    travelers: [
      {
        id: 'tt_1',
        employeeId: 'emp_1',
        isPrimary: true,
        employee: {
          email: 'traveler@acme.example',
          firstName: 'Taylor',
          lastName: 'Traveler',
          departmentId: 'dept_1',
          userId: 'emp_user',
          department: { name: 'Engineering' },
        },
      },
    ],
    approval: null,
    flightOfferSnapshots: [],
    hotelOfferSnapshots: [],
  };

  beforeEach(async () => {
    prisma = {
      trip: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      tripTraveler: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      approval: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      approvalAction: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return arg;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(TripsService);
  });

  it('creates a draft trip with travelers', async () => {
    prisma.employee.findMany.mockResolvedValue([{ id: 'emp_1' }]);
    prisma.trip.create.mockResolvedValue(baseTrip);

    const result = await service.create(admin, {
      purpose: 'Berlin workshop',
      startDate: '2026-09-10',
      endDate: '2026-09-14',
      budgetAmount: 1800,
      travelers: [{ employeeId: 'emp_1', isPrimary: true }],
    });

    expect(result.status).toBe(TripStatus.DRAFT);
    expect(result.travelers).toHaveLength(1);
    expect(prisma.trip.create).toHaveBeenCalled();
  });

  it('rejects create without travelers', async () => {
    await expect(
      service.create(admin, {
        purpose: 'No travelers',
        startDate: '2026-09-10',
        endDate: '2026-09-14',
        travelers: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid status transition', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      status: TripStatus.DRAFT,
    });

    await expect(service.start(admin, 'trip_1')).rejects.toThrow(
      /Invalid status transition/,
    );
  });

  it('submits draft to pending approval', async () => {
    prisma.trip.findFirst.mockResolvedValue(baseTrip);
    prisma.trip.update.mockResolvedValue({
      ...baseTrip,
      status: TripStatus.PENDING_APPROVAL,
    });
    prisma.approval.findUnique.mockResolvedValue(null);
    prisma.approval.create.mockResolvedValue({
      id: 'appr_1',
      status: 'PENDING',
    });
    prisma.approvalAction.create.mockResolvedValue({});
    prisma.trip.findUniqueOrThrow.mockResolvedValue({
      ...baseTrip,
      status: TripStatus.PENDING_APPROVAL,
      approval: { id: 'appr_1', status: 'PENDING', decidedAt: null },
    });

    const result = await service.submit(admin, 'trip_1');
    expect(result.status).toBe(TripStatus.PENDING_APPROVAL);
  });

  it('cancels trip and keeps it addressable', async () => {
    prisma.trip.findFirst.mockResolvedValue(baseTrip);
    prisma.trip.update.mockResolvedValue({
      ...baseTrip,
      status: TripStatus.CANCELLED,
    });

    const result = await service.cancel(admin, 'trip_1');
    expect(result.status).toBe(TripStatus.CANCELLED);
  });

  it('locks edits after approval', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      status: TripStatus.APPROVED,
    });

    await expect(
      service.update(admin, 'trip_1', { purpose: 'Changed' }),
    ).rejects.toThrow(/cannot be edited/);
  });

  it('blocks employee from other company trip', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      companyId: 'company_b',
      travelers: [],
    });

    await expect(service.getById(employeeUser, 'trip_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('approves pending trip', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      status: TripStatus.PENDING_APPROVAL,
    });
    prisma.trip.update.mockResolvedValue({
      ...baseTrip,
      status: TripStatus.APPROVED,
    });
    prisma.approval.findUnique.mockResolvedValue({
      id: 'appr_1',
      status: 'PENDING',
    });
    prisma.approval.update.mockResolvedValue({});
    prisma.approvalAction.create.mockResolvedValue({});
    prisma.trip.findUniqueOrThrow.mockResolvedValue({
      ...baseTrip,
      status: TripStatus.APPROVED,
      approval: {
        id: 'appr_1',
        status: 'APPROVED',
        decidedAt: new Date(),
      },
    });

    const result = await service.approve(admin, 'trip_1');
    expect(result.status).toBe(TripStatus.APPROVED);
  });
});
