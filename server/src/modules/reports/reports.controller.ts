import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import type { RequestUser } from '../auth/types/auth.types';
import {
  ReportsExportQueryDto,
  ReportsQueryDto,
  ReportsSummaryResponseDto,
} from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary:
      'Company travel analytics: monthly spend, departments, destinations, averages',
  })
  @ApiOkResponse({ type: ReportsSummaryResponseDto })
  getSummary(
    @CurrentUser() user: RequestUser,
    @Query() query: ReportsQueryDto,
  ): Promise<ReportsSummaryResponseDto> {
    return this.reportsService.getSummary(user, query);
  }

  @Get('export')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Export report dataset as CSV or JSON (tenant-scoped)',
  })
  @ApiProduces('text/csv', 'application/json')
  @Header('Cache-Control', 'no-store')
  async export(
    @CurrentUser() user: RequestUser,
    @Query() query: ReportsExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.reportsService.export(user, query);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    if (result.format === 'json') {
      res.status(200).json(result.body);
      return;
    }
    res.status(200).send(result.body);
  }
}
