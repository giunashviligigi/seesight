import { User, UserRole, UserStatus } from '@prisma/client';
import { UserResponseDto } from '../dto/auth-response.dto';

export type AuthUserPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export type RequestUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  companyId: string | null;
  firstName: string | null;
  lastName: string | null;
  mustChangePassword: boolean;
  createdAt: Date;
};

export function toUserResponse(user: User): UserResponseDto {
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

export function toRequestUser(user: User): RequestUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    companyId: user.companyId,
    firstName: user.firstName,
    lastName: user.lastName,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}
