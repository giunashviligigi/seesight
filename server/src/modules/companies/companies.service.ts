import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Company,
  CompanyStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  assertCanManageCompany,
  assertCompanyAccess,
  isSuperAdmin,
} from '../../common/tenant/tenant.utils';
import { RequestUser } from '../auth/types/auth.types';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { AssignCompanyAdminDto } from './dto/assign-company-admin.dto';
import {
  CompanyListResponseDto,
  CompanyResponseDto,
} from './dto/company-response.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    actor: RequestUser,
    dto: CreateCompanyDto,
  ): Promise<CompanyResponseDto> {
    assertCanManageCompany(actor);

    if (!isSuperAdmin(actor) && actor.companyId) {
      throw new ForbiddenException(
        'Company admin already belongs to a company',
      );
    }

    const slug = await this.resolveUniqueSlug(dto.slug ?? dto.name);
    await this.assertBillingEmailAvailable(dto.billingEmail);

    const company = await this.prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          name: dto.name.trim(),
          legalName: dto.legalName?.trim() || null,
          slug,
          country: dto.country?.toUpperCase() || null,
          billingEmail: dto.billingEmail?.toLowerCase().trim() || null,
          timezone: dto.timezone?.trim() || 'UTC',
          policyJson: (dto.policyJson as Prisma.InputJsonValue) ?? undefined,
          status: CompanyStatus.ACTIVE,
        },
      });

      if (!isSuperAdmin(actor)) {
        await tx.user.update({
          where: { id: actor.id },
          data: {
            companyId: created.id,
            role: UserRole.COMPANY_ADMIN,
          },
        });
      }

      return created;
    });

    return this.toResponse(company);
  }

  async list(
    actor: RequestUser,
    query: ListCompaniesQueryDto,
  ): Promise<CompanyListResponseDto> {
    if (!isSuperAdmin(actor)) {
      throw new ForbiddenException('Only super admins can list all companies');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();

    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { billingEmail: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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

  async getMine(actor: RequestUser): Promise<CompanyResponseDto> {
    if (!actor.companyId) {
      throw new NotFoundException('No company assigned to this user');
    }

    return this.getById(actor, actor.companyId);
  }

  async getById(
    actor: RequestUser,
    companyId: string,
  ): Promise<CompanyResponseDto> {
    assertCompanyAccess(actor, companyId);

    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return this.toResponse(company);
  }

  async update(
    actor: RequestUser,
    companyId: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    assertCanManageCompany(actor);
    assertCompanyAccess(actor, companyId);

    const existing = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    if (dto.billingEmail !== undefined && dto.billingEmail !== null) {
      await this.assertBillingEmailAvailable(
        dto.billingEmail,
        companyId,
      );
    }

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: dto.name?.trim(),
        legalName:
          dto.legalName === undefined
            ? undefined
            : dto.legalName?.trim() || null,
        country:
          dto.country === undefined
            ? undefined
            : dto.country?.toUpperCase() || null,
        billingEmail:
          dto.billingEmail === undefined
            ? undefined
            : dto.billingEmail?.toLowerCase().trim() || null,
        timezone: dto.timezone?.trim(),
        policyJson:
          dto.policyJson === undefined
            ? undefined
            : ((dto.policyJson as Prisma.InputJsonValue) ?? Prisma.JsonNull),
      },
    });

    return this.toResponse(company);
  }

  async deactivate(
    actor: RequestUser,
    companyId: string,
  ): Promise<CompanyResponseDto> {
    if (!isSuperAdmin(actor)) {
      throw new ForbiddenException('Only super admins can deactivate companies');
    }

    const existing = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        status: CompanyStatus.INACTIVE,
      },
    });

    return this.toResponse(company);
  }

  async activate(
    actor: RequestUser,
    companyId: string,
  ): Promise<CompanyResponseDto> {
    if (!isSuperAdmin(actor)) {
      throw new ForbiddenException('Only super admins can activate companies');
    }

    const existing = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        status: CompanyStatus.ACTIVE,
        deletedAt: null,
      },
    });

    return this.toResponse(company);
  }

  async assignAdmin(
    actor: RequestUser,
    companyId: string,
    dto: AssignCompanyAdminDto,
  ): Promise<{ message: string; userId: string }> {
    if (!isSuperAdmin(actor)) {
      throw new ForbiddenException(
        'Only super admins can assign company admins',
      );
    }

    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Cannot assign a super admin as a company admin',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.replaceExisting) {
        await tx.user.updateMany({
          where: {
            companyId,
            role: UserRole.COMPANY_ADMIN,
            id: { not: user.id },
          },
          data: { role: UserRole.EMPLOYEE },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          companyId,
          role: UserRole.COMPANY_ADMIN,
        },
      });
    });

    return {
      message: 'Company admin assigned successfully',
      userId: user.id,
    };
  }

  private async resolveUniqueSlug(input: string): Promise<string> {
    const base = this.slugify(input);
    let candidate = base;
    let suffix = 1;

    while (
      await this.prisma.company.findUnique({ where: { slug: candidate } })
    ) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    return slug || `company-${Date.now()}`;
  }

  private async assertBillingEmailAvailable(
    billingEmail?: string | null,
    excludeCompanyId?: string,
  ): Promise<void> {
    if (!billingEmail) {
      return;
    }

    const normalized = billingEmail.toLowerCase().trim();
    const existing = await this.prisma.company.findFirst({
      where: {
        billingEmail: normalized,
        deletedAt: null,
        ...(excludeCompanyId ? { id: { not: excludeCompanyId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException('Billing email is already in use');
    }
  }

  private toResponse(company: Company): CompanyResponseDto {
    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      slug: company.slug,
      country: company.country,
      billingEmail: company.billingEmail,
      timezone: company.timezone,
      status: company.status,
      policyJson:
        company.policyJson && typeof company.policyJson === 'object'
          ? (company.policyJson as Record<string, unknown>)
          : null,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      deletedAt: company.deletedAt,
    };
  }
}
