import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Employee,
  NotificationType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseCountryCode } from '../../common/geo/country';
import {
  assertCanManageCompany,
  assertCompanyAccess,
  resolveTenantCompanyId,
} from '../../common/tenant/tenant.utils';
import { RequestUser } from '../auth/types/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';
import {
  CreateEmployeeResponseDto,
  EmployeeListResponseDto,
  EmployeeResponseDto,
} from './dto/employee-response.dto';

type EmployeeWithDepartment = Employee & {
  department: { name: string } | null;
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    actor: RequestUser,
    dto: CreateEmployeeDto,
  ): Promise<CreateEmployeeResponseDto> {
    assertCanManageCompany(actor);
    const companyId = resolveTenantCompanyId(actor, dto.companyId);
    const email = dto.email.toLowerCase().trim();

    await this.assertDepartmentInCompany(dto.departmentId, companyId);

    const existing = await this.prisma.employee.findFirst({
      where: { companyId, email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Employee email already exists in company');
    }

    let temporaryPassword: string | undefined;

    if (dto.createLogin) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new ConflictException(
          'A user account with this email already exists',
        );
      }
      temporaryPassword = this.generateTemporaryPassword();
    }

    const passwordHash = temporaryPassword
      ? await bcrypt.hash(temporaryPassword, 12)
      : null;

    const employee = await this.prisma.$transaction(async (tx) => {
      let userId: string | null = null;

      if (temporaryPassword && passwordHash) {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            role: UserRole.EMPLOYEE,
            status: UserStatus.ACTIVE,
            companyId,
            mustChangePassword: true,
          },
        });
        userId = user.id;
      }

      return tx.employee.create({
        data: {
          companyId,
          departmentId: dto.departmentId || null,
          userId,
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          jobTitle: dto.jobTitle?.trim() || null,
          phone: dto.phone?.trim() || null,
          nationality: parseCountryCode(dto.nationality),
          passportNumber: dto.passportNumber?.trim() || null,
          preferredAirport: dto.preferredAirport?.toUpperCase() || null,
          status: UserStatus.ACTIVE,
        },
        include: { department: { select: { name: true } } },
      });
    });

    if (temporaryPassword) {
      await this.notificationsService.create({
        userId: actor.id,
        type: NotificationType.EMPLOYEE_TEMP_PASSWORD,
        title: `one-time password for ${employee.firstName} ${employee.lastName}`,
        body: `Account ${employee.email} was created with a temporary password. Share this one-time password (they must change it on first login): ${temporaryPassword}`,
      });
    }

    return {
      ...this.toResponse(employee),
      temporaryPassword,
    };
  }

  async list(
    actor: RequestUser,
    query: ListEmployeesQueryDto,
  ): Promise<EmployeeListResponseDto> {
    const companyId = resolveTenantCompanyId(actor, query.companyId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'lastName';
    const sortOrder = query.sortOrder ?? 'asc';

    const where: Prisma.EmployeeWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { jobTitle: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: { department: { select: { name: true } } },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page,
      pageSize,
    };
  }

  async getMine(actor: RequestUser): Promise<EmployeeResponseDto> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        userId: actor.id,
        deletedAt: null,
      },
      include: { department: { select: { name: true } } },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found');
    }

    return this.toResponse(employee);
  }

  async getById(
    actor: RequestUser,
    id: string,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.findVisibleEmployee(actor, id);
    return this.toResponse(employee);
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    assertCanManageCompany(actor);
    const existing = await this.findVisibleEmployee(actor, id);

    if (dto.departmentId) {
      await this.assertDepartmentInCompany(
        dto.departmentId,
        existing.companyId,
      );
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        jobTitle:
          dto.jobTitle === undefined
            ? undefined
            : dto.jobTitle?.trim() || null,
        phone:
          dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        departmentId:
          dto.departmentId === undefined ? undefined : dto.departmentId,
        nationality:
          dto.nationality === undefined
            ? undefined
            : parseCountryCode(dto.nationality),
        passportNumber:
          dto.passportNumber === undefined
            ? undefined
            : dto.passportNumber?.trim() || null,
        preferredAirport:
          dto.preferredAirport === undefined
            ? undefined
            : dto.preferredAirport?.toUpperCase() || null,
      },
      include: { department: { select: { name: true } } },
    });

    if (updated.userId && (dto.firstName || dto.lastName)) {
      await this.prisma.user.update({
        where: { id: updated.userId },
        data: {
          firstName: updated.firstName,
          lastName: updated.lastName,
        },
      });
    }

    return this.toResponse(updated);
  }

  /**
   * Policy: deactivate sets Employee.status=INACTIVE and linked User.status=INACTIVE
   * so the employee cannot log in. Trip history is preserved (no hard delete).
   */
  async deactivate(
    actor: RequestUser,
    id: string,
  ): Promise<EmployeeResponseDto> {
    assertCanManageCompany(actor);
    const existing = await this.findVisibleEmployee(actor, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (existing.userId) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { status: UserStatus.INACTIVE },
        });
      }

      return tx.employee.update({
        where: { id },
        data: { status: UserStatus.INACTIVE },
        include: { department: { select: { name: true } } },
      });
    });

    return this.toResponse(updated);
  }

  async activate(
    actor: RequestUser,
    id: string,
  ): Promise<EmployeeResponseDto> {
    assertCanManageCompany(actor);
    const existing = await this.findVisibleEmployee(actor, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (existing.userId) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { status: UserStatus.ACTIVE },
        });
      }

      return tx.employee.update({
        where: { id },
        data: { status: UserStatus.ACTIVE },
        include: { department: { select: { name: true } } },
      });
    });

    return this.toResponse(updated);
  }

  /**
   * Soft-delete roster row and disable linked login so the email can be reused.
   * Trip history stays intact (employee traveler links remain).
   */
  async remove(
    actor: RequestUser,
    id: string,
  ): Promise<EmployeeResponseDto> {
    assertCanManageCompany(actor);
    const existing = await this.findVisibleEmployee(actor, id);

    const tombstoneEmail = `deleted+${existing.id}@seesight.local`;
    const deletedAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      if (existing.userId) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            status: UserStatus.INACTIVE,
            email: tombstoneEmail,
            mustChangePassword: false,
          },
        });
      }

      return tx.employee.update({
        where: { id },
        data: {
          deletedAt,
          status: UserStatus.INACTIVE,
          email: tombstoneEmail,
          userId: null,
        },
        include: { department: { select: { name: true } } },
      });
    });

    return this.toResponse(updated);
  }

  private async findVisibleEmployee(
    actor: RequestUser,
    id: string,
  ): Promise<EmployeeWithDepartment> {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: { department: { select: { name: true } } },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (actor.role === UserRole.EMPLOYEE) {
      if (employee.userId !== actor.id) {
        throw new ForbiddenException('Employees can only view their own profile');
      }
      return employee;
    }

    assertCompanyAccess(actor, employee.companyId);
    return employee;
  }

  private async assertDepartmentInCompany(
    departmentId: string | null | undefined,
    companyId: string,
  ): Promise<void> {
    if (!departmentId) {
      return;
    }

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, deletedAt: null },
    });

    if (!department) {
      throw new NotFoundException('Department not found in this company');
    }
  }

  private generateTemporaryPassword(): string {
    return createHash('sha256')
      .update(randomBytes(24))
      .digest('hex')
      .slice(0, 16);
  }

  private toResponse(employee: EmployeeWithDepartment): EmployeeResponseDto {
    return {
      id: employee.id,
      companyId: employee.companyId,
      departmentId: employee.departmentId,
      departmentName: employee.department?.name ?? null,
      userId: employee.userId,
      email: employee.email,
      firstName: employee.firstName,
      lastName: employee.lastName,
      jobTitle: employee.jobTitle,
      phone: employee.phone,
      nationality: employee.nationality,
      passportNumber: employee.passportNumber,
      preferredAirport: employee.preferredAirport,
      status: employee.status,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
