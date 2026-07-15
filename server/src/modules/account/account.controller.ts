import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import type { RequestUser } from '../auth/types/auth.types';

class ProtectedSampleDto {
  message!: string;
  userId!: string;
  role!: UserRole;
}

@ApiTags('account')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('account')
export class AccountController {
  @Get('protected')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Sample protected endpoint proving JWT + roles guards',
  })
  @ApiOkResponse({
    schema: {
      example: {
        message: 'Protected resource accessible',
        userId: 'clx...',
        role: 'COMPANY_ADMIN',
      },
    },
  })
  protectedSample(@CurrentUser() user: RequestUser): ProtectedSampleDto {
    return {
      message: 'Protected resource accessible',
      userId: user.id,
      role: user.role,
    };
  }
}
