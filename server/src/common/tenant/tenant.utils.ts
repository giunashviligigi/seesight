import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RequestUser } from '../../modules/auth/types/auth.types';

export function isSuperAdmin(user: RequestUser): boolean {
  return user.role === UserRole.SUPER_ADMIN;
}

/**
 * Ensures the actor can access the given company tenant.
 * Super admins may access any company. Others must match companyId.
 */
export function assertCompanyAccess(
  user: RequestUser,
  companyId: string,
): void {
  if (isSuperAdmin(user)) {
    return;
  }

  if (!user.companyId || user.companyId !== companyId) {
    throw new ForbiddenException('Cross-tenant access is not allowed');
  }
}

export function assertCanManageCompany(user: RequestUser): void {
  if (
    user.role !== UserRole.SUPER_ADMIN &&
    user.role !== UserRole.COMPANY_ADMIN
  ) {
    throw new ForbiddenException('Insufficient permissions');
  }
}
