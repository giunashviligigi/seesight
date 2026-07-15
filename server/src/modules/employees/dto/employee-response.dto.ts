import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class EmployeeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiPropertyOptional()
  departmentId!: string | null;

  @ApiPropertyOptional()
  departmentName!: string | null;

  @ApiPropertyOptional()
  userId!: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiPropertyOptional()
  jobTitle!: string | null;

  @ApiPropertyOptional()
  phone!: string | null;

  @ApiPropertyOptional()
  nationality!: string | null;

  @ApiPropertyOptional()
  passportNumber!: string | null;

  @ApiPropertyOptional()
  preferredAirport!: string | null;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class EmployeeListResponseDto {
  @ApiProperty({ type: [EmployeeResponseDto] })
  items!: EmployeeResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class CreateEmployeeResponseDto extends EmployeeResponseDto {
  @ApiPropertyOptional({
    description:
      'Present only when createLogin=true; temporary password for first login',
  })
  temporaryPassword?: string;
}
