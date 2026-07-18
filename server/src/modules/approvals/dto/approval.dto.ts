import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalActionType, ApprovalStatus, TripStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListPendingApprovalsQueryDto {
  @ApiPropertyOptional({ description: 'Required for super admins' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export class DecideApprovalDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class PendingApprovalItemDto {
  @ApiProperty()
  approvalId!: string;

  @ApiProperty()
  tripId!: string;

  @ApiProperty()
  purpose!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  destinationCountry!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  destinationCity!: string | null;

  @ApiProperty()
  startDate!: string;

  @ApiProperty()
  endDate!: string;

  @ApiProperty({ enum: TripStatus })
  tripStatus!: TripStatus;

  @ApiProperty({ enum: ApprovalStatus })
  approvalStatus!: ApprovalStatus;

  @ApiProperty()
  submittedAt!: string;

  @ApiProperty()
  createdByUserId!: string;

  @ApiProperty()
  createdByEmail!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  createdByName!: string | null;

  @ApiProperty()
  travelerCount!: number;
}

export class PendingApprovalListResponseDto {
  @ApiProperty({ type: [PendingApprovalItemDto] })
  items!: PendingApprovalItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class ApprovalHistoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ApprovalActionType })
  action!: ApprovalActionType;

  @ApiPropertyOptional({ nullable: true, type: String })
  comment!: string | null;

  @ApiProperty()
  actorUserId!: string;

  @ApiProperty()
  actorEmail!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  actorName!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class ApprovalHistoryResponseDto {
  @ApiProperty()
  tripId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  approvalId!: string | null;

  @ApiPropertyOptional({ enum: ApprovalStatus, nullable: true })
  status!: ApprovalStatus | null;

  @ApiProperty({ type: [ApprovalHistoryItemDto] })
  actions!: ApprovalHistoryItemDto[];
}
