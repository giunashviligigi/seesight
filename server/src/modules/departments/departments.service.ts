import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  assertCanManageCompany,
  assertCompanyAccess,
  resolveTenantCompanyId,
} from '../../common/tenant/tenant.utils';
import { RequestUser } from '../auth/types/auth.types';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './dto/department.dto';
import { DepartmentResponseDto } from './dto/department-response.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    actor: RequestUser,
    dto: CreateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    assertCanManageCompany(actor);
    const companyId = resolveTenantCompanyId(actor, dto.companyId);

    const name = dto.name.trim();
    const existing = await this.prisma.department.findFirst({
      where: { companyId, name, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Department name already exists');
    }

    const department = await this.prisma.department.create({
      data: {
        companyId,
        name,
        code: dto.code?.trim() || null,
      },
    });

    return this.toResponse(department);
  }

  async list(
    actor: RequestUser,
    companyIdQuery?: string,
  ): Promise<DepartmentResponseDto[]> {
    const companyId = resolveTenantCompanyId(actor, companyIdQuery);
    const items = await this.prisma.department.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return items.map((item) => this.toResponse(item));
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    assertCanManageCompany(actor);
    const department = await this.findForActor(actor, id);

    if (dto.name) {
      const clash = await this.prisma.department.findFirst({
        where: {
          companyId: department.companyId,
          name: dto.name.trim(),
          deletedAt: null,
          id: { not: id },
        },
      });
      if (clash) {
        throw new ConflictException('Department name already exists');
      }
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code:
          dto.code === undefined ? undefined : dto.code?.trim() || null,
      },
    });

    return this.toResponse(updated);
  }

  async remove(actor: RequestUser, id: string): Promise<DepartmentResponseDto> {
    assertCanManageCompany(actor);
    await this.findForActor(actor, id);

    const updated = await this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.employee.updateMany({
      where: { departmentId: id, deletedAt: null },
      data: { departmentId: null },
    });

    return this.toResponse(updated);
  }

  private async findForActor(
    actor: RequestUser,
    id: string,
  ): Promise<Department> {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    assertCompanyAccess(actor, department.companyId);
    return department;
  }

  private toResponse(department: Department): DepartmentResponseDto {
    return {
      id: department.id,
      companyId: department.companyId,
      name: department.name,
      code: department.code,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }
}
