import { ForbiddenException, Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isSuperAdmin } from '../../common/tenant/tenant.utils';
import { RequestUser } from '../auth/types/auth.types';
import {
  ListUsersQueryDto,
  UserListResponseDto,
  UserResponseDto,
} from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: RequestUser,
    query: ListUsersQueryDto,
  ): Promise<UserListResponseDto> {
    if (!isSuperAdmin(actor)) {
      throw new ForbiddenException('Only super admins can list users');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const unassignedOnly = query.unassignedOnly !== false;

    // Signed-up company admins who have not created/linked a company yet.
    const where = {
      role: UserRole.COMPANY_ADMIN,
      ...(unassignedOnly ? { companyId: null } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              {
                firstName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                lastName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((user) => this.toResponse(user)),
      total,
      page,
      pageSize,
    };
  }

  private toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      companyId: user.companyId,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    };
  }
}
