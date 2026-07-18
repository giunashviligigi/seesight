import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalActionType,
  ApprovalStatus,
  Prisma,
  TripStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  assertCanManageCompany,
  assertCompanyAccess,
  resolveTenantCompanyId,
} from '../../common/tenant/tenant.utils';
import { RequestUser } from '../auth/types/auth.types';
import {
  CreateTripDto,
  ListTripsQueryDto,
  RejectTripDto,
  TripTravelerInputDto,
  UpdateTripDto,
} from './dto/trip.dto';
import {
  TripListResponseDto,
  TripResponseDto,
} from './dto/trip-response.dto';

const EDITABLE_STATUSES: TripStatus[] = [
  TripStatus.DRAFT,
  TripStatus.PENDING_APPROVAL,
  TripStatus.REJECTED,
];

const CANCELABLE_STATUSES: TripStatus[] = [
  TripStatus.DRAFT,
  TripStatus.PENDING_APPROVAL,
  TripStatus.APPROVED,
  TripStatus.IN_PROGRESS,
  TripStatus.REJECTED,
];

type TripRecord = Prisma.TripGetPayload<{
  include: {
    travelers: {
      include: {
        employee: {
          include: { department: { select: { name: true } } };
        };
      };
    };
    approval: true;
  };
}>;

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    actor: RequestUser,
    dto: CreateTripDto,
  ): Promise<TripResponseDto> {
    const companyId = resolveTenantCompanyId(actor, dto.companyId);
    this.assertDateRange(dto.startDate, dto.endDate);

    const travelerInputs = this.normalizeTravelers(dto.travelers);
    await this.assertTravelersInCompany(companyId, travelerInputs);

    if (actor.role === UserRole.EMPLOYEE) {
      await this.assertEmployeeIncludesSelf(actor, companyId, travelerInputs);
    } else {
      assertCanManageCompany(actor);
    }

    const trip = await this.prisma.trip.create({
      data: {
        companyId,
        createdByUserId: actor.id,
        purpose: dto.purpose.trim(),
        destinationCountry: dto.destinationCountry?.toUpperCase() || null,
        destinationCity: dto.destinationCity?.trim() || null,
        startDate: startOfUtcDay(new Date(dto.startDate)),
        endDate: startOfUtcDay(new Date(dto.endDate)),
        budgetAmount:
          dto.budgetAmount === undefined ? null : dto.budgetAmount,
        budgetCurrency: (dto.budgetCurrency || 'EUR').toUpperCase(),
        notes: dto.notes?.trim() || null,
        status: TripStatus.DRAFT,
        travelers: {
          create: travelerInputs.map((t) => ({
            employeeId: t.employeeId,
            isPrimary: t.isPrimary ?? false,
          })),
        },
      },
      include: tripInclude,
    });

    return this.toResponse(trip);
  }

  async list(
    actor: RequestUser,
    query: ListTripsQueryDto,
  ): Promise<TripListResponseDto> {
    const companyId = resolveTenantCompanyId(actor, query.companyId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = await this.buildActorTripScope(actor, companyId);

    const where: Prisma.TripWhereInput = {
      companyId,
      deletedAt: null,
      ...scope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startDate: {
              ...(query.from
                ? { gte: startOfUtcDay(new Date(query.from)) }
                : {}),
              ...(query.to ? { lte: startOfUtcDay(new Date(query.to)) } : {}),
            },
          }
        : {}),
      ...(query.departmentId
        ? {
            travelers: {
              some: {
                employee: {
                  departmentId: query.departmentId,
                  deletedAt: null,
                },
              },
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.trip.count({ where }),
      this.prisma.trip.findMany({
        where,
        include: tripInclude,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((trip) => this.toResponse(trip)),
      total,
      page,
      pageSize,
    };
  }

  async getById(actor: RequestUser, id: string): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    return this.toResponse(trip);
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateTripDto,
  ): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    this.assertCanMutateTrip(actor, trip);

    if (!EDITABLE_STATUSES.includes(trip.status)) {
      throw new BadRequestException(
        `Trip cannot be edited while status is ${trip.status}`,
      );
    }

    const startDate = dto.startDate
      ? startOfUtcDay(new Date(dto.startDate))
      : trip.startDate;
    const endDate = dto.endDate
      ? startOfUtcDay(new Date(dto.endDate))
      : trip.endDate;
    this.assertDateRange(toDateString(startDate), toDateString(endDate));

    let travelerInputs: TripTravelerInputDto[] | undefined;
    if (dto.travelers) {
      travelerInputs = this.normalizeTravelers(dto.travelers);
      await this.assertTravelersInCompany(trip.companyId, travelerInputs);
      if (actor.role === UserRole.EMPLOYEE) {
        await this.assertEmployeeIncludesSelf(
          actor,
          trip.companyId,
          travelerInputs,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (travelerInputs) {
        await tx.tripTraveler.deleteMany({ where: { tripId: trip.id } });
        await tx.tripTraveler.createMany({
          data: travelerInputs.map((t) => ({
            tripId: trip.id,
            employeeId: t.employeeId,
            isPrimary: t.isPrimary ?? false,
          })),
        });
      }

      return tx.trip.update({
        where: { id: trip.id },
        data: {
          ...(dto.purpose !== undefined
            ? { purpose: dto.purpose.trim() }
            : {}),
          ...(dto.destinationCountry !== undefined
            ? {
                destinationCountry: dto.destinationCountry
                  ? dto.destinationCountry.toUpperCase()
                  : null,
              }
            : {}),
          ...(dto.destinationCity !== undefined
            ? {
                destinationCity: dto.destinationCity
                  ? dto.destinationCity.trim()
                  : null,
              }
            : {}),
          ...(dto.startDate !== undefined ? { startDate } : {}),
          ...(dto.endDate !== undefined ? { endDate } : {}),
          ...(dto.budgetAmount !== undefined
            ? { budgetAmount: dto.budgetAmount }
            : {}),
          ...(dto.budgetCurrency !== undefined
            ? { budgetCurrency: dto.budgetCurrency.toUpperCase() }
            : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes ? dto.notes.trim() : null }
            : {}),
        },
        include: tripInclude,
      });
    });

    return this.toResponse(updated);
  }

  async submit(actor: RequestUser, id: string): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    this.assertCanMutateTrip(actor, trip);
    this.assertTransition(trip.status, TripStatus.PENDING_APPROVAL);

    if (trip.travelers.length < 1) {
      throw new BadRequestException('Trip requires at least one traveler');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.trip.update({
        where: { id: trip.id },
        data: { status: TripStatus.PENDING_APPROVAL },
        include: tripInclude,
      });

      const approval =
        (await tx.approval.findUnique({ where: { tripId: trip.id } })) ??
        (await tx.approval.create({
          data: {
            tripId: trip.id,
            status: ApprovalStatus.PENDING,
          },
        }));

      if (approval.status !== ApprovalStatus.PENDING) {
        await tx.approval.update({
          where: { id: approval.id },
          data: { status: ApprovalStatus.PENDING, decidedAt: null },
        });
      }

      await tx.approvalAction.create({
        data: {
          approvalId: approval.id,
          actorUserId: actor.id,
          action: ApprovalActionType.SUBMIT,
          comment: 'Submitted for approval',
        },
      });

      return tx.trip.findUniqueOrThrow({
        where: { id: next.id },
        include: tripInclude,
      });
    });

    return this.toResponse(updated);
  }

  async cancel(actor: RequestUser, id: string): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    this.assertCanMutateTrip(actor, trip);

    if (!CANCELABLE_STATUSES.includes(trip.status)) {
      throw new BadRequestException(
        `Trip cannot be cancelled while status is ${trip.status}`,
      );
    }

    this.assertTransition(trip.status, TripStatus.CANCELLED);

    const updated = await this.prisma.trip.update({
      where: { id: trip.id },
      data: { status: TripStatus.CANCELLED },
      include: tripInclude,
    });

    return this.toResponse(updated);
  }

  async approve(actor: RequestUser, id: string): Promise<TripResponseDto> {
    assertCanManageCompany(actor);
    return this.transitionWithApproval(
      actor,
      id,
      TripStatus.APPROVED,
      ApprovalStatus.APPROVED,
      ApprovalActionType.APPROVE,
    );
  }

  async reject(
    actor: RequestUser,
    id: string,
    dto: RejectTripDto,
  ): Promise<TripResponseDto> {
    assertCanManageCompany(actor);
    return this.transitionWithApproval(
      actor,
      id,
      TripStatus.REJECTED,
      ApprovalStatus.REJECTED,
      ApprovalActionType.REJECT,
      dto.comment,
    );
  }

  async start(actor: RequestUser, id: string): Promise<TripResponseDto> {
    assertCanManageCompany(actor);
    return this.simpleTransition(actor, id, TripStatus.IN_PROGRESS);
  }

  async complete(actor: RequestUser, id: string): Promise<TripResponseDto> {
    assertCanManageCompany(actor);
    return this.simpleTransition(actor, id, TripStatus.COMPLETED);
  }

  async reopen(actor: RequestUser, id: string): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    this.assertCanMutateTrip(actor, trip);
    this.assertTransition(trip.status, TripStatus.DRAFT);

    const updated = await this.prisma.trip.update({
      where: { id: trip.id },
      data: { status: TripStatus.DRAFT },
      include: tripInclude,
    });

    return this.toResponse(updated);
  }

  private async transitionWithApproval(
    actor: RequestUser,
    id: string,
    nextStatus: TripStatus,
    approvalStatus: ApprovalStatus,
    action: ApprovalActionType,
    comment?: string,
  ): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    assertCompanyAccess(actor, trip.companyId);
    this.assertTransition(trip.status, nextStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.trip.update({
        where: { id: trip.id },
        data: { status: nextStatus },
      });

      const approval =
        (await tx.approval.findUnique({ where: { tripId: trip.id } })) ??
        (await tx.approval.create({
          data: {
            tripId: trip.id,
            status: approvalStatus,
            decidedAt: new Date(),
          },
        }));

      await tx.approval.update({
        where: { id: approval.id },
        data: {
          status: approvalStatus,
          decidedAt: new Date(),
        },
      });

      await tx.approvalAction.create({
        data: {
          approvalId: approval.id,
          actorUserId: actor.id,
          action,
          comment: comment?.trim() || null,
        },
      });

      return tx.trip.findUniqueOrThrow({
        where: { id: next.id },
        include: tripInclude,
      });
    });

    return this.toResponse(updated);
  }

  private async simpleTransition(
    actor: RequestUser,
    id: string,
    nextStatus: TripStatus,
  ): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    assertCompanyAccess(actor, trip.companyId);
    this.assertTransition(trip.status, nextStatus);

    const updated = await this.prisma.trip.update({
      where: { id: trip.id },
      data: { status: nextStatus },
      include: tripInclude,
    });

    return this.toResponse(updated);
  }

  private async findAccessibleTrip(
    actor: RequestUser,
    id: string,
  ): Promise<TripRecord> {
    const trip = await this.prisma.trip.findFirst({
      where: { id, deletedAt: null },
      include: tripInclude,
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    assertCompanyAccess(actor, trip.companyId);

    if (actor.role === UserRole.EMPLOYEE) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          companyId: trip.companyId,
          userId: actor.id,
          deletedAt: null,
        },
        select: { id: true },
      });

      const isTraveler = employee
        ? trip.travelers.some((t) => t.employeeId === employee.id)
        : false;
      const isCreator = trip.createdByUserId === actor.id;

      if (!isTraveler && !isCreator) {
        throw new ForbiddenException('Cross-tenant access is not allowed');
      }
    }

    return trip;
  }

  private assertCanMutateTrip(actor: RequestUser, trip: TripRecord): void {
    if (
      actor.role === UserRole.COMPANY_ADMIN ||
      actor.role === UserRole.SUPER_ADMIN
    ) {
      assertCanManageCompany(actor);
      assertCompanyAccess(actor, trip.companyId);
      return;
    }

    if (actor.role === UserRole.EMPLOYEE) {
      if (trip.createdByUserId !== actor.id) {
        const isTraveler = trip.travelers.some(
          (t) => t.employee.userId === actor.id,
        );
        if (!isTraveler) {
          throw new ForbiddenException('Insufficient permissions');
        }
      }
      return;
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  private async buildActorTripScope(
    actor: RequestUser,
    companyId: string,
  ): Promise<Prisma.TripWhereInput> {
    if (actor.role !== UserRole.EMPLOYEE) {
      return {};
    }

    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId: actor.id, deletedAt: null },
      select: { id: true },
    });

    if (!employee) {
      return { id: { in: [] } };
    }

    return {
      OR: [
        { createdByUserId: actor.id },
        { travelers: { some: { employeeId: employee.id } } },
      ],
    };
  }

  private normalizeTravelers(
    travelers: TripTravelerInputDto[],
  ): TripTravelerInputDto[] {
    if (!travelers.length) {
      throw new BadRequestException('Trip requires at least one traveler');
    }

    const seen = new Set<string>();
    const normalized: TripTravelerInputDto[] = [];

    for (const traveler of travelers) {
      if (seen.has(traveler.employeeId)) {
        throw new BadRequestException('Duplicate travelers are not allowed');
      }
      seen.add(traveler.employeeId);
      normalized.push({
        employeeId: traveler.employeeId,
        isPrimary: traveler.isPrimary ?? false,
      });
    }

    if (!normalized.some((t) => t.isPrimary)) {
      normalized[0].isPrimary = true;
    }

    return normalized;
  }

  private async assertTravelersInCompany(
    companyId: string,
    travelers: TripTravelerInputDto[],
  ): Promise<void> {
    const ids = travelers.map((t) => t.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: ids },
        companyId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (employees.length !== ids.length) {
      throw new BadRequestException(
        'All travelers must be active employees in the company',
      );
    }
  }

  private async assertEmployeeIncludesSelf(
    actor: RequestUser,
    companyId: string,
    travelers: TripTravelerInputDto[],
  ): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId: actor.id, deletedAt: null },
      select: { id: true },
    });

    if (!employee) {
      throw new ForbiddenException('No employee profile linked to this account');
    }

    if (!travelers.some((t) => t.employeeId === employee.id)) {
      throw new BadRequestException(
        'Employees must include themselves as a traveler',
      );
    }
  }

  private assertDateRange(startDate: string, endDate: string): void {
    const start = startOfUtcDay(new Date(startDate));
    const end = startOfUtcDay(new Date(endDate));
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
  }

  private assertTransition(from: TripStatus, to: TripStatus): void {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  private toResponse(trip: TripRecord): TripResponseDto {
    return {
      id: trip.id,
      companyId: trip.companyId,
      createdByUserId: trip.createdByUserId,
      purpose: trip.purpose,
      destinationCountry: trip.destinationCountry,
      destinationCity: trip.destinationCity,
      startDate: toDateString(trip.startDate),
      endDate: toDateString(trip.endDate),
      budgetAmount:
        trip.budgetAmount === null || trip.budgetAmount === undefined
          ? null
          : Number(trip.budgetAmount),
      budgetCurrency: trip.budgetCurrency,
      notes: trip.notes,
      status: trip.status,
      travelers: trip.travelers.map((t) => ({
        id: t.id,
        employeeId: t.employeeId,
        email: t.employee.email,
        firstName: t.employee.firstName,
        lastName: t.employee.lastName,
        departmentId: t.employee.departmentId,
        departmentName: t.employee.department?.name ?? null,
        isPrimary: t.isPrimary,
      })),
      approval: trip.approval
        ? {
            id: trip.approval.id,
            status: trip.approval.status,
            decidedAt: trip.approval.decidedAt
              ? trip.approval.decidedAt.toISOString()
              : null,
          }
        : null,
      createdAt: trip.createdAt.toISOString(),
      updatedAt: trip.updatedAt.toISOString(),
    };
  }
}

const tripInclude = {
  travelers: {
    include: {
      employee: {
        include: { department: { select: { name: true } } },
      },
    },
  },
  approval: true,
} satisfies Prisma.TripInclude;

const ALLOWED_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  [TripStatus.DRAFT]: [TripStatus.PENDING_APPROVAL, TripStatus.CANCELLED],
  [TripStatus.PENDING_APPROVAL]: [
    TripStatus.APPROVED,
    TripStatus.REJECTED,
    TripStatus.CANCELLED,
  ],
  [TripStatus.APPROVED]: [TripStatus.IN_PROGRESS, TripStatus.CANCELLED],
  [TripStatus.IN_PROGRESS]: [TripStatus.COMPLETED, TripStatus.CANCELLED],
  [TripStatus.REJECTED]: [TripStatus.DRAFT, TripStatus.CANCELLED],
  [TripStatus.COMPLETED]: [],
  [TripStatus.CANCELLED]: [],
};

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
