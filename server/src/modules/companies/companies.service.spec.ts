import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CompanyStatus, UserRole, UserStatus } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../auth/types/auth.types';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let prisma: {
    company: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
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

  const adminB: RequestUser = {
    ...adminA,
    id: 'user_b',
    email: 'b@beta.example',
    companyId: 'company_b',
  };

  const superAdmin: RequestUser = {
    ...adminA,
    id: 'super',
    email: 'super@seesight.local',
    role: UserRole.SUPER_ADMIN,
    companyId: null,
  };

  beforeEach(async () => {
    prisma = {
      company: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        return arg;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CompaniesService);
  });

  it('blocks company admin from reading another tenant company', async () => {
    await expect(service.getById(adminA, 'company_b')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows company admin to read own company', async () => {
    prisma.company.findFirst.mockResolvedValue({
      id: 'company_a',
      name: 'Acme',
      legalName: null,
      slug: 'acme',
      country: 'GE',
      billingEmail: 'billing@acme.example',
      timezone: 'UTC',
      status: CompanyStatus.ACTIVE,
      policyJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = await service.getById(adminA, 'company_a');
    expect(result.id).toBe('company_a');
  });

  it('blocks company admin from listing all companies', async () => {
    await expect(service.list(adminA, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks assigning super admin as company admin', async () => {
    prisma.company.findFirst.mockResolvedValue({
      id: 'company_a',
      deletedAt: null,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'super',
      email: 'super@seesight.local',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    });

    await expect(
      service.assignAdmin(superAdmin, 'company_a', {
        email: 'super@seesight.local',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents elevating company role checks for employee management path', async () => {
    await expect(service.update(adminB, 'company_a', { name: 'Hack' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
