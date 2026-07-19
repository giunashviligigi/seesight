import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '../types/auth.types';

/**
 * Blocks access to app APIs until users with temporary passwords
 * complete POST /auth/change-password.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & { user?: RequestUser }
    >();
    const user = request.user;

    if (!user?.mustChangePassword) {
      return true;
    }

    const method = request.method.toUpperCase();
    const url = (request.originalUrl || request.url || '').split('?')[0];
    const allowed =
      (method === 'POST' && /\/auth\/change-password\/?$/.test(url)) ||
      (method === 'GET' && /\/auth\/me\/?$/.test(url)) ||
      (method === 'POST' && /\/auth\/logout\/?$/.test(url));

    if (allowed) {
      return true;
    }

    throw new ForbiddenException(
      'Password change required. Set a new password before continuing.',
    );
  }
}
