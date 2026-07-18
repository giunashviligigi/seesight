import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
  ApprovalStatus,
  TripStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { ApprovalsService } from './approvals.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { RequestUser } from '../auth/types/auth.types';

describe('ApprovalsService', () => {
  let service: ApprovalsService;
  let prisma: {
    approval: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tripsService: {
    getById: jest.Mock;
    approve: jest.Mock;
    reject: jest.Mock;
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

  beforeEach(async () => {
    prisma = {
      approval: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (Array.isArray(arg)) return Promise.all(arg);
        return arg;
      }),
    };
    tripsService = {
      getById: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TripsService, useValue: tripsService },
      ],
    }).compile();

    service = module.get(ApprovalsService);
  });

  it('lists pending approvals', async () => {
    prisma.approval.count.mockResolvedValue(1);
    prisma.approval.findMany.mockResolvedValue([
      {
        id: 'appr_1',
        tripId: 'trip_1',
        status: ApprovalStatus.PENDING,
        createdAt: new Date('2026-07-01'),
        trip: {
          purpose: 'Berlin',
          destinationCountry: 'DE',
          destinationCity: 'Berlin',
          startDate: new Date('2026-09-10'),
          endDate: new Date('2026-09-14'),
          status: TripStatus.PENDING_APPROVAL,
          createdByUserId: 'emp_user',
          createdBy: {
            id: 'emp_user',
            email: 't@example.com',
            firstName: 'Taylor',
            lastName: 'Traveler',
          },
          travelers: [{ id: 'tt_1' }],
        },
      },
    ]);

    const result = await service.listPending(admin, {});
    expect(result.total).toBe(1);
    expect(result.items[0].purpose).toBe('Berlin');
    expect(result.items[0].travelerCount).toBe(1);
  });

  it('returns history via trip access check', async () => {
    tripsService.getById.mockResolvedValue({ id: 'trip_1' });
    prisma.approval.findUnique.mockResolvedValue({
      id: 'appr_1',
      status: ApprovalStatus.APPROVED,
      actions: [
        {
          id: 'act_1',
          action: 'APPROVE',
          comment: 'ok',
          actorUserId: 'admin_1',
          createdAt: new Date(),
          actor: {
            id: 'admin_1',
            email: 'admin@acme.example',
            firstName: 'Ada',
            lastName: 'Admin',
          },
        },
      ],
    });

    const result = await service.getHistory(admin, 'trip_1');
    expect(result.actions).toHaveLength(1);
    expect(result.status).toBe(ApprovalStatus.APPROVED);
  });

  it('delegates approve to trips service', async () => {
    tripsService.approve.mockResolvedValue({ status: TripStatus.APPROVED });
    await service.approve(admin, 'trip_1', { comment: 'ok' });
    expect(tripsService.approve).toHaveBeenCalledWith(admin, 'trip_1', 'ok');
  });

  it('propagates self-approve forbidden from trips', async () => {
    tripsService.approve.mockRejectedValue(
      new ForbiddenException('You cannot approve or reject your own trip'),
    );
    await expect(service.approve(admin, 'trip_1', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
