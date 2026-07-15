import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'seesight-api' })
  service!: string;

  @ApiProperty({ example: '2026-07-15T12:00:00.000Z' })
  timestamp!: string;
}
