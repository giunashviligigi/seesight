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
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { AssignCompanyAdminDto } from './dto/assign-company-admin.dto';
import {
  CompanyListResponseDto,
  CompanyResponseDto,
} from './dto/company-response.dto';

@ApiTags('companies')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary:
      'Create a company (super admin or company admin without a company yet)',
  })
  @ApiOkResponse({ type: CompanyResponseDto })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return this.companiesService.create(user, dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List and search companies (super admin)' })
  @ApiOkResponse({ type: CompanyListResponseDto })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListCompaniesQueryDto,
  ): Promise<CompanyListResponseDto> {
    return this.companiesService.list(user, query);
  }

  @Get('me')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get the current user company profile' })
  @ApiOkResponse({ type: CompanyResponseDto })
  getMine(@CurrentUser() user: RequestUser): Promise<CompanyResponseDto> {
    return this.companiesService.getMine(user);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get a company by id (tenant-scoped)' })
  @ApiOkResponse({ type: CompanyResponseDto })
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<CompanyResponseDto> {
    return this.companiesService.getById(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update company profile (tenant-scoped)' })
  @ApiOkResponse({ type: CompanyResponseDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return this.companiesService.update(user, id, dto);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-deactivate a company (super admin)' })
  @ApiOkResponse({ type: CompanyResponseDto })
  deactivate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<CompanyResponseDto> {
    return this.companiesService.deactivate(user, id);
  }

  @Post(':id/activate')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Re-activate a company (super admin)' })
  @ApiOkResponse({ type: CompanyResponseDto })
  activate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<CompanyResponseDto> {
    return this.companiesService.activate(user, id);
  }

  @Post(':id/assign-admin')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign a company admin to this company' })
  assignAdmin(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AssignCompanyAdminDto,
  ): Promise<{ message: string; userId: string }> {
    return this.companiesService.assignAdmin(user, id, dto);
  }
}
