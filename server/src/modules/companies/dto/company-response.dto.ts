import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyStatus } from '@prisma/client';

export class CompanyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  legalName!: string | null;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  country!: string | null;

  @ApiPropertyOptional()
  billingEmail!: string | null;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ enum: CompanyStatus })
  status!: CompanyStatus;

  @ApiPropertyOptional()
  policyJson!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt!: Date | null;
}

export class CompanyListResponseDto {
  @ApiProperty({ type: [CompanyResponseDto] })
  items!: CompanyResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
