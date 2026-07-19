import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestUser } from '../auth/types/auth.types';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: {
    employee: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    department: {
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notifications: { create: jest.Mock; createMany: jest.Mock };

  const adminA: RequestUser = {
    id: 'user_a',
    email: 'a@acme.example',
    role: UserRole.COMPANY_ADMIN,
    status: UserStatus.ACTIVE,
    companyId: 'company_a',
    firstName: 'Ada',
    lastName: 'Admin',
    mustChangePassword: false,
    createdAt: new Date(),
  };

  const adminB: RequestUser = {
    ...adminA,
    id: 'user_b',
    email: 'b@beta.example',
    companyId: 'company_b',
  };

  const employeeUser: RequestUser = {
    ...adminA,
    id: 'emp_user',
    email: 'traveler@acme.example',
    role: UserRole.EMPLOYEE,
  };

  const baseEmployee = {
    id: 'emp_1',
    companyId: 'company_a',
    departmentId: 'dept_1',
    userId: 'emp_user',
    email: 'traveler@acme.example',
    firstName: 'Taylor',
    lastName: 'Traveler',
    jobTitle: 'Engineer',
    phone: null,
    nationality: 'GE',
    passportNumber: null,
    preferredAirport: 'TBS',
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    department: { name: 'Engineering' },
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      department: {
        findFirst: jest.fn(),
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

    notifications = {
      create: jest.fn(),
      createMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(EmployeesService);
  });

  it('creates an employee roster record without login', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    prisma.employee.create.mockResolvedValue(baseEmployee);

    const result = await service.create(adminA, {
      email: 'new@acme.example',
      firstName: 'New',
      lastName: 'Hire',
    });

    expect(result.email).toBe(baseEmployee.email);
    expect(result.temporaryPassword).toBeUndefined();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('blocks company admin from reading another tenant employee', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      ...baseEmployee,
      companyId: 'company_a',
    });

    await expect(service.getById(adminB, 'emp_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows employee to view own profile only', async () => {
    prisma.employee.findFirst.mockResolvedValue(baseEmployee);
    const mine = await service.getById(employeeUser, 'emp_1');
    expect(mine.id).toBe('emp_1');

    prisma.employee.findFirst.mockResolvedValue({
      ...baseEmployee,
      userId: 'someone_else',
    });
    await expect(service.getById(employeeUser, 'emp_2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('deactivates employee and linked user', async () => {
    prisma.employee.findFirst.mockResolvedValue(baseEmployee);
    prisma.employee.update.mockResolvedValue({
      ...baseEmployee,
      status: UserStatus.INACTIVE,
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.deactivate(adminA, 'emp_1');
    expect(result.status).toBe(UserStatus.INACTIVE);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'emp_user' },
      data: { status: UserStatus.INACTIVE },
    });
  });

  it('rejects duplicate employee email in company', async () => {
    prisma.employee.findFirst.mockResolvedValue(baseEmployee);
    await expect(
      service.create(adminA, {
        email: 'traveler@acme.example',
        firstName: 'Dup',
        lastName: 'User',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('paginates list results', async () => {
    prisma.employee.count.mockResolvedValue(105);
    prisma.employee.findMany.mockResolvedValue([baseEmployee]);

    const result = await service.list(adminA, { page: 2, pageSize: 20 });
    expect(result.total).toBe(105);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(20);
    expect(result.items).toHaveLength(1);
  });

  it('returns not found for missing profile on getMine', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(service.getMine(employeeUser)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
