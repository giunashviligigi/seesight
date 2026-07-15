import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepartmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  code!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
