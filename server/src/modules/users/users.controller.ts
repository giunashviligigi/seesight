import { Controller, Get, Query } from '@nestjs/common';
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
import { ListUsersQueryDto, UserListResponseDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'List signed-up company admins with no company yet (super admin)',
  })
  @ApiOkResponse({ type: UserListResponseDto })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<UserListResponseDto> {
    return this.usersService.list(user, query);
  }
}
