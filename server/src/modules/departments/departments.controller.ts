import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './dto/department.dto';
import { DepartmentResponseDto } from './dto/department-response.dto';

@ApiTags('departments')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Create a department' })
  @ApiOkResponse({ type: DepartmentResponseDto })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    return this.departmentsService.create(user, dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List departments for a company' })
  @ApiOkResponse({ type: [DepartmentResponseDto] })
  list(
    @CurrentUser() user: RequestUser,
    @Query('companyId') companyId?: string,
  ): Promise<DepartmentResponseDto[]> {
    return this.departmentsService.list(user, companyId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update a department' })
  @ApiOkResponse({ type: DepartmentResponseDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    return this.departmentsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a department' })
  @ApiOkResponse({ type: DepartmentResponseDto })
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<DepartmentResponseDto> {
    return this.departmentsService.remove(user, id);
  }
}
