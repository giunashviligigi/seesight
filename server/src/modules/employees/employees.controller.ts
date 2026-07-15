import {
  Body,
  Controller,
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
import { EmployeesService } from './employees.service';
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

@ApiTags('employees')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary:
      'Create employee roster record (optional createLogin with temporary password)',
  })
  @ApiOkResponse({ type: CreateEmployeeResponseDto })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateEmployeeDto,
  ): Promise<CreateEmployeeResponseDto> {
    return this.employeesService.create(user, dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'List employees with search, filter, sort, pagination' })
  @ApiOkResponse({ type: EmployeeListResponseDto })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListEmployeesQueryDto,
  ): Promise<EmployeeListResponseDto> {
    return this.employeesService.list(user, query);
  }

  @Get('me')
  @Roles(UserRole.EMPLOYEE, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get the authenticated employee profile' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  getMine(@CurrentUser() user: RequestUser): Promise<EmployeeResponseDto> {
    return this.employeesService.getMine(user);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get employee by id (tenant / self scoped)' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.getById(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update employee profile' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.update(user, id, dto);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary:
      'Deactivate employee (and linked user login) without deleting trip history',
  })
  @ApiOkResponse({ type: EmployeeResponseDto })
  deactivate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.deactivate(user, id);
  }

  @Post(':id/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Re-activate employee and linked user login' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  activate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.activate(user, id);
  }
}
