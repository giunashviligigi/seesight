import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TripStatus, UserRole, UserStatus } from '@prisma/client';
import { TripsService } from './trips.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestUser } from '../auth/types/auth.types';

describe('TripsService', () => {
  let service: TripsService;
  let notifications: { createMany: jest.Mock };
  let prisma: {
    trip: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    tripTraveler: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    employee: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    user: {
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
    reportCache: {
      deleteMany: jest.Mock;
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

  const otherAdmin: RequestUser = {
    ...admin,
    id: 'admin_2',
    email: 'boss@acme.example',
    firstName: 'Bea',
    lastName: 'Boss',
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
    createdByUserId: 'emp_user',
    purpose: 'Berlin workshop',
    destinationCountry: 'DE',
    destinationCity: 'Berlin',
    startDate: new Date('2026-09-10'),
    endDate: new Date('2026-09-14'),
    budgetAmount: 1800,
    budgetCurrency: 'EUR',
    notes: null,
    bookingNeeds: 'BOTH' as const,
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
    flightOfferSnapshots: [
      {
        id: 'flight_1',
        selected: true,
        priceAmount: 400,
        currency: 'EUR',
        origin: 'TBS',
        destination: 'BER',
      },
    ],
    hotelOfferSnapshots: [
      {
        id: 'hotel_1',
        selected: true,
        priceAmount: 600,
        currency: 'EUR',
        hotelName: 'Hotel Berlin',
        city: 'Berlin',
      },
    ],
  };

  beforeEach(async () => {
    notifications = { createMany: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      trip: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      tripTraveler: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      approval: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      approvalAction: {
        create: jest.fn(),
      },
      reportCache: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
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
        { provide: NotificationsService, useValue: notifications },
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

  it('submits draft to pending approval and notifies admins', async () => {
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
    prisma.user.findMany.mockResolvedValue([{ id: 'admin_1' }]);

    const result = await service.submit(admin, 'trip_1');
    expect(result.status).toBe(TripStatus.PENDING_APPROVAL);
    expect(notifications.createMany).toHaveBeenCalled();
  });

  it('blocks submit without selected flight and hotel', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      flightOfferSnapshots: [],
      hotelOfferSnapshots: [],
    });

    await expect(service.submit(admin, 'trip_1')).rejects.toThrow(
      /select a flight/i,
    );
  });

  it('allows flight-only submit without a hotel', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      bookingNeeds: 'FLIGHT_ONLY',
      hotelOfferSnapshots: [],
    });
    prisma.trip.update.mockResolvedValue({
      ...baseTrip,
      bookingNeeds: 'FLIGHT_ONLY',
      hotelOfferSnapshots: [],
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
      bookingNeeds: 'FLIGHT_ONLY',
      hotelOfferSnapshots: [],
      status: TripStatus.PENDING_APPROVAL,
      approval: { id: 'appr_1', status: 'PENDING', decidedAt: null },
    });
    prisma.user.findMany.mockResolvedValue([{ id: 'admin_1' }]);

    const result = await service.submit(admin, 'trip_1');
    expect(result.status).toBe(TripStatus.PENDING_APPROVAL);
  });

  it('allows hotel-only submit without a flight', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      bookingNeeds: 'HOTEL_ONLY',
      flightOfferSnapshots: [],
    });
    prisma.trip.update.mockResolvedValue({
      ...baseTrip,
      bookingNeeds: 'HOTEL_ONLY',
      flightOfferSnapshots: [],
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
      bookingNeeds: 'HOTEL_ONLY',
      flightOfferSnapshots: [],
      status: TripStatus.PENDING_APPROVAL,
      approval: { id: 'appr_1', status: 'PENDING', decidedAt: null },
    });
    prisma.user.findMany.mockResolvedValue([{ id: 'admin_1' }]);

    const result = await service.submit(admin, 'trip_1');
    expect(result.status).toBe(TripStatus.PENDING_APPROVAL);
  });

  it('blocks flight-only submit without a flight', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      bookingNeeds: 'FLIGHT_ONLY',
      flightOfferSnapshots: [],
      hotelOfferSnapshots: [],
    });

    await expect(service.submit(admin, 'trip_1')).rejects.toThrow(
      /select a flight/i,
    );
  });

  it('blocks submit without purpose', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      purpose: '',
    });

    await expect(service.submit(admin, 'trip_1')).rejects.toThrow(
      /purpose is required/i,
    );
  });

  it('cancels trip and keeps it addressable', async () => {
    prisma.trip.findFirst.mockResolvedValue(baseTrip);
    prisma.trip.update.mockResolvedValue({
      ...baseTrip,
      status: TripStatus.CANCELLED,
    });
    prisma.trip.findUniqueOrThrow.mockResolvedValue({
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

    await expect(
      service.getById(employeeUser, 'trip_1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('approves pending trip and notifies stakeholders', async () => {
    const approvedTrip = {
      ...baseTrip,
      status: TripStatus.APPROVED,
      approval: {
        id: 'appr_1',
        status: 'APPROVED',
        decidedAt: new Date(),
      },
    };
    prisma.trip.findFirst
      .mockResolvedValueOnce({
        ...baseTrip,
        status: TripStatus.PENDING_APPROVAL,
      })
      .mockResolvedValueOnce(approvedTrip);
    prisma.trip.update.mockResolvedValue(approvedTrip);
    prisma.approval.findUnique.mockResolvedValue({
      id: 'appr_1',
      status: 'PENDING',
    });
    prisma.approval.update.mockResolvedValue({});
    prisma.approvalAction.create.mockResolvedValue({});
    prisma.trip.findUniqueOrThrow.mockResolvedValue(approvedTrip);

    const result = await service.approve(otherAdmin, 'trip_1', 'Looks good');
    expect(result.status).toBe(TripStatus.APPROVED);
    expect(notifications.createMany).toHaveBeenCalled();
  });

  it('allows company admin to approve their own trip', async () => {
    const approvedTrip = {
      ...baseTrip,
      createdByUserId: 'admin_1',
      status: TripStatus.APPROVED,
      approval: {
        id: 'appr_1',
        status: 'APPROVED',
        decidedAt: new Date(),
      },
    };
    prisma.trip.findFirst
      .mockResolvedValueOnce({
        ...baseTrip,
        createdByUserId: 'admin_1',
        status: TripStatus.PENDING_APPROVAL,
        travelers: [
          {
            ...baseTrip.travelers[0],
            employee: { ...baseTrip.travelers[0].employee, userId: 'admin_1' },
          },
        ],
      })
      .mockResolvedValueOnce(approvedTrip);
    prisma.trip.update.mockResolvedValue(approvedTrip);
    prisma.approval.findUnique.mockResolvedValue({
      id: 'appr_1',
      status: 'PENDING',
    });
    prisma.approval.update.mockResolvedValue({});
    prisma.approvalAction.create.mockResolvedValue({});
    prisma.trip.findUniqueOrThrow.mockResolvedValue(approvedTrip);

    const result = await service.approve(admin, 'trip_1', 'Self-managed');
    expect(result.status).toBe(TripStatus.APPROVED);
  });

  it('soft-deletes a draft trip for its creator', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      createdByUserId: 'emp_user',
      status: TripStatus.DRAFT,
    });
    prisma.approval.findUnique.mockResolvedValue(null);
    prisma.trip.update.mockResolvedValue({
      ...baseTrip,
      deletedAt: new Date(),
      status: TripStatus.DRAFT,
    });

    const result = await service.remove(employeeUser, 'trip_1');
    expect(result.id).toBe('trip_1');
    expect(prisma.trip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('soft-deletes an in-progress trip', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      createdByUserId: 'emp_user',
      status: TripStatus.IN_PROGRESS,
    });
    prisma.approval.findUnique.mockResolvedValue(null);
    prisma.trip.update.mockResolvedValue({
      ...baseTrip,
      deletedAt: new Date(),
      status: TripStatus.IN_PROGRESS,
    });

    const result = await service.remove(employeeUser, 'trip_1');
    expect(result.id).toBe('trip_1');
    expect(prisma.trip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('soft-deletes a completed trip', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...baseTrip,
      createdByUserId: 'emp_user',
      status: TripStatus.COMPLETED,
    });
    prisma.approval.findUnique.mockResolvedValue(null);
    prisma.trip.update.mockResolvedValue({
      ...baseTrip,
      deletedAt: new Date(),
      status: TripStatus.COMPLETED,
    });

    const result = await service.remove(employeeUser, 'trip_1');
    expect(result.id).toBe('trip_1');
  });
});
