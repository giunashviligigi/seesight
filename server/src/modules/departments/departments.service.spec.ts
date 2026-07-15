import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { DepartmentsService } from './departments.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser } from '../auth/types/auth.types';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: {
    department: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    employee: {
      updateMany: jest.Mock;
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

  const adminB: RequestUser = {
    ...adminA,
    id: 'user_b',
    companyId: 'company_b',
  };

  beforeEach(async () => {
    prisma = {
      department: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      employee: {
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DepartmentsService);
  });

  it('creates department in actor company', async () => {
    prisma.department.findFirst.mockResolvedValue(null);
    prisma.department.create.mockResolvedValue({
      id: 'd1',
      companyId: 'company_a',
      name: 'Finance',
      code: 'FIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(adminA, { name: 'Finance', code: 'FIN' });
    expect(result.name).toBe('Finance');
    expect(prisma.department.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: 'company_a' }),
      }),
    );
  });

  it('blocks cross-tenant department update', async () => {
    prisma.department.findFirst.mockResolvedValue({
      id: 'd1',
      companyId: 'company_a',
      name: 'Engineering',
      code: 'ENG',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await expect(
      service.update(adminB, 'd1', { name: 'Hack' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
