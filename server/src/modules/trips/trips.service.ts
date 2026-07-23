import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalActionType,
  ApprovalStatus,
  NotificationType,
  OfferProvider,
  Prisma,
  TravelClass,
  TripStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseCountryCode } from '../../common/geo/country';
import {
  assertCanManageCompany,
  assertCompanyAccess,
  resolveTenantCompanyId,
} from '../../common/tenant/tenant.utils';
import { RequestUser } from '../auth/types/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AttachFlightOfferDto,
  AttachHotelOfferDto,
} from './dto/attach-offer.dto';
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
import {
  decimalToNumber,
  invalidateReportCacheForCompany,
  pickMajorityCurrency,
  roundMoney,
} from '../../common/analytics/spend.utils';
import {
  INVOICEABLE_TRIP_STATUSES,
  SEESIGHT_INVOICE_ISSUER,
} from './invoice.constants';
import {
  buildInvoiceNumber,
  renderTripInvoicePdf,
  type InvoiceLineItem,
} from './trip-invoice';

/** Field edits + offer attach allowed only before submit / after rejection. */
const EDITABLE_STATUSES: TripStatus[] = [
  TripStatus.DRAFT,
  TripStatus.REJECTED,
];

const CANCELABLE_STATUSES: TripStatus[] = [
  TripStatus.DRAFT,
  TripStatus.PENDING_APPROVAL,
  TripStatus.APPROVED,
  TripStatus.IN_PROGRESS,
  TripStatus.REJECTED,
];

/** Soft-delete allowed in any status (row hidden via deletedAt). */
const DELETABLE_STATUSES: TripStatus[] = [
  TripStatus.DRAFT,
  TripStatus.PENDING_APPROVAL,
  TripStatus.APPROVED,
  TripStatus.IN_PROGRESS,
  TripStatus.COMPLETED,
  TripStatus.REJECTED,
  TripStatus.CANCELLED,
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
    flightOfferSnapshots: true;
    hotelOfferSnapshots: true;
  };
}>;

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    actor: RequestUser,
    dto: CreateTripDto,
  ): Promise<TripResponseDto> {
    const companyId = resolveTenantCompanyId(actor, dto.companyId);
    const today = toDateString(new Date());
    const startDate = dto.startDate ?? today;
    const endDate = dto.endDate ?? startDate;
    this.assertDateRange(startDate, endDate);
    this.assertNotInPast(startDate);

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
        purpose: this.requirePurpose(dto.purpose),
        destinationCountry: parseCountryCode(dto.destinationCountry),
        destinationCity: dto.destinationCity?.trim() || null,
        startDate: startOfUtcDay(new Date(startDate)),
        endDate: startOfUtcDay(new Date(endDate)),
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

    await this.invalidateReports(companyId);
    return this.toResponse(trip);
  }

  async list(
    actor: RequestUser,
    query: ListTripsQueryDto,
  ): Promise<TripListResponseDto> {
    await this.promoteDueTrips();
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
    await this.promoteDueTrips();
    const trip = await this.findAccessibleTrip(actor, id);
    return this.toResponse(trip);
  }

  /**
   * Auto-move APPROVED trips to IN_PROGRESS once startDate (UTC day) is due.
   * Called hourly by cron and on trip list/detail reads.
   */
  async promoteDueTrips(): Promise<number> {
    const today = startOfUtcDay(new Date());
    const due = await this.prisma.trip.findMany({
      where: {
        deletedAt: null,
        status: TripStatus.APPROVED,
        startDate: { lte: today },
      },
      select: { id: true, companyId: true },
    });

    if (due.length === 0) {
      return 0;
    }

    await this.prisma.trip.updateMany({
      where: { id: { in: due.map((trip) => trip.id) } },
      data: { status: TripStatus.IN_PROGRESS },
    });

    const companyIds = [...new Set(due.map((trip) => trip.companyId))];
    await Promise.all(
      companyIds.map((companyId) => this.invalidateReports(companyId)),
    );

    return due.length;
  }

  /**
   * Generate a SeeSight → company invoice PDF for an approved (or later) trip.
   * Available to company admins and employees who can access the trip.
   */
  async exportInvoice(
    actor: RequestUser,
    id: string,
  ): Promise<{ pdf: Buffer; filename: string }> {
    const trip = await this.findAccessibleTrip(actor, id);

    if (!INVOICEABLE_TRIP_STATUSES.includes(trip.status)) {
      throw new BadRequestException(
        'Invoice is available only after the trip is approved',
      );
    }

    const company = await this.prisma.company.findFirst({
      where: { id: trip.companyId, deletedAt: null },
      select: {
        name: true,
        legalName: true,
        country: true,
        billingEmail: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found for this trip');
    }

    const invoiceDate = toDateString(new Date());
    const approvalDate = trip.approval?.decidedAt
      ? toDateString(trip.approval.decidedAt)
      : null;

    const lineItems: InvoiceLineItem[] = [];
    const currencies: string[] = [];

    for (const offer of trip.flightOfferSnapshots.filter((o) => o.selected)) {
      const amount = decimalToNumber(offer.priceAmount);
      if (amount === null) continue;
      const currency = offer.currency?.trim() || trip.budgetCurrency || 'EUR';
      const route =
        offer.origin && offer.destination
          ? `${offer.origin}→${offer.destination}`
          : 'flight';
      lineItems.push({
        description: `Flight · ${route}`,
        amount: roundMoney(amount),
        currency,
      });
      currencies.push(currency);
    }

    for (const offer of trip.hotelOfferSnapshots.filter((o) => o.selected)) {
      const amount = decimalToNumber(offer.priceAmount);
      if (amount === null) continue;
      const currency = offer.currency?.trim() || trip.budgetCurrency || 'EUR';
      const hotel = offer.hotelName?.trim() || 'Hotel stay';
      const city = offer.city?.trim();
      lineItems.push({
        description: city ? `Hotel · ${hotel} (${city})` : `Hotel · ${hotel}`,
        amount: roundMoney(amount),
        currency,
      });
      currencies.push(currency);
    }

    const currency =
      currencies.length > 0
        ? pickMajorityCurrency(currencies)
        : trip.budgetCurrency || 'EUR';
    const totalAmount = roundMoney(
      lineItems.reduce((sum, item) => sum + item.amount, 0),
    );

    const destinationParts = [
      trip.destinationCity,
      trip.destinationCountry,
    ].filter(Boolean);
    const travelers = trip.travelers.map((t) => {
      const name = `${t.employee.firstName} ${t.employee.lastName}`.trim();
      return t.isPrimary ? `${name} (primary)` : name;
    });

    const invoiceNumber = buildInvoiceNumber(trip.id, invoiceDate);
    const pdf = await renderTripInvoicePdf({
      invoiceNumber,
      invoiceDate,
      approvalDate,
      issuerName: SEESIGHT_INVOICE_ISSUER.legalName,
      issuerBankIban: SEESIGHT_INVOICE_ISSUER.bankIban,
      billToName: (company.legalName?.trim() || company.name).trim(),
      billToCountry: company.country,
      billToBillingEmail: company.billingEmail,
      tripId: trip.id,
      tripPurpose: trip.purpose,
      tripDestination:
        destinationParts.length > 0 ? destinationParts.join(', ') : 'TBD',
      tripStartDate: toDateString(trip.startDate),
      tripEndDate: toDateString(trip.endDate),
      tripStatus: trip.status,
      travelers,
      lineItems,
      totalAmount,
      currency,
    });

    return {
      pdf,
      filename: `seesight-invoice-${invoiceNumber.toLowerCase()}.pdf`,
    };
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
    if (dto.startDate !== undefined) {
      this.assertNotInPast(toDateString(startDate));
    }

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
            ? { purpose: this.requirePurpose(dto.purpose) }
            : {}),
          ...(dto.destinationCountry !== undefined
            ? {
                destinationCountry: parseCountryCode(dto.destinationCountry),
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

    await this.invalidateReports(trip.companyId);
    return this.toResponse(updated);
  }

  async submit(actor: RequestUser, id: string): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    this.assertCanMutateTrip(actor, trip);
    this.assertTransition(trip.status, TripStatus.PENDING_APPROVAL);
    this.assertReadyForSubmit(trip);

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

    await this.notifyAdminsOfSubmission(updated, actor.id);
    await this.invalidateReports(updated.companyId);
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

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id: trip.id },
        data: { status: TripStatus.CANCELLED },
      });

      // Close any open approval so cancelled trips leave the pending queue.
      const approval = await tx.approval.findUnique({
        where: { tripId: trip.id },
      });
      if (approval && approval.status === ApprovalStatus.PENDING) {
        await tx.approval.update({
          where: { id: approval.id },
          data: {
            status: ApprovalStatus.REJECTED,
            decidedAt: new Date(),
          },
        });
        await tx.approvalAction.create({
          data: {
            approvalId: approval.id,
            actorUserId: actor.id,
            action: ApprovalActionType.REJECT,
            comment: 'Trip cancelled',
          },
        });
      }

      return tx.trip.findUniqueOrThrow({
        where: { id: trip.id },
        include: tripInclude,
      });
    });

    await this.invalidateReports(trip.companyId);
    return this.toResponse(updated);
  }

  async remove(actor: RequestUser, id: string): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    this.assertCanMutateTrip(actor, trip);

    if (!DELETABLE_STATUSES.includes(trip.status)) {
      throw new BadRequestException(
        `Trip cannot be deleted while status is ${trip.status}`,
      );
    }

    const deletedAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const approval = await tx.approval.findUnique({
        where: { tripId: trip.id },
      });
      if (approval && approval.status === ApprovalStatus.PENDING) {
        await tx.approval.update({
          where: { id: approval.id },
          data: {
            status: ApprovalStatus.REJECTED,
            decidedAt: deletedAt,
          },
        });
        await tx.approvalAction.create({
          data: {
            approvalId: approval.id,
            actorUserId: actor.id,
            action: ApprovalActionType.REJECT,
            comment: 'Trip deleted',
          },
        });
      }

      return tx.trip.update({
        where: { id: trip.id },
        data: { deletedAt },
        include: tripInclude,
      });
    });

    await this.invalidateReports(trip.companyId);
    return this.toResponse(updated);
  }

  async approve(
    actor: RequestUser,
    id: string,
    comment?: string,
  ): Promise<TripResponseDto> {
    assertCanManageCompany(actor);
    return this.transitionWithApproval(
      actor,
      id,
      TripStatus.APPROVED,
      ApprovalStatus.APPROVED,
      ApprovalActionType.APPROVE,
      comment,
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

    await this.invalidateReports(trip.companyId);
    return this.toResponse(updated);
  }

  async attachFlightOffer(
    actor: RequestUser,
    id: string,
    dto: AttachFlightOfferDto,
  ): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    this.assertCanMutateTrip(actor, trip);
    if (!EDITABLE_STATUSES.includes(trip.status)) {
      throw new BadRequestException(
        `Offers cannot be attached while status is ${trip.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.flightOfferSnapshot.updateMany({
        where: { tripId: trip.id, selected: true },
        data: { selected: false },
      });

      await tx.flightOfferSnapshot.create({
        data: {
          tripId: trip.id,
          provider: OfferProvider.SERPAPI,
          providerOfferId: dto.providerOfferId,
          origin: dto.origin.toUpperCase(),
          destination: dto.destination.toUpperCase(),
          departAt: dto.departAt ? new Date(dto.departAt) : null,
          returnAt: dto.returnAt ? new Date(dto.returnAt) : null,
          travelClass: this.mapTravelClass(dto.travelClass),
          priceAmount:
            dto.priceAmount === undefined || dto.priceAmount === null
              ? null
              : dto.priceAmount,
          currency: dto.currency?.toUpperCase() || trip.budgetCurrency,
          rawPayload: dto.rawPayload as Prisma.InputJsonValue,
          selected: true,
        },
      });
    });

    const updated = await this.findAccessibleTrip(actor, id);
    await this.invalidateReports(trip.companyId);
    return this.toResponse(updated);
  }

  async attachHotelOffer(
    actor: RequestUser,
    id: string,
    dto: AttachHotelOfferDto,
  ): Promise<TripResponseDto> {
    const trip = await this.findAccessibleTrip(actor, id);
    this.assertCanMutateTrip(actor, trip);
    if (!EDITABLE_STATUSES.includes(trip.status)) {
      throw new BadRequestException(
        `Offers cannot be attached while status is ${trip.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.hotelOfferSnapshot.updateMany({
        where: { tripId: trip.id, selected: true },
        data: { selected: false },
      });

      await tx.hotelOfferSnapshot.create({
        data: {
          tripId: trip.id,
          provider: OfferProvider.SERPAPI,
          providerOfferId: dto.providerOfferId,
          hotelName: dto.hotelName.trim(),
          city: dto.city?.trim() || null,
          checkIn: startOfUtcDay(new Date(dto.checkIn)),
          checkOut: startOfUtcDay(new Date(dto.checkOut)),
          priceAmount:
            dto.priceAmount === undefined || dto.priceAmount === null
              ? null
              : dto.priceAmount,
          currency: dto.currency?.toUpperCase() || trip.budgetCurrency,
          rawPayload: dto.rawPayload as Prisma.InputJsonValue,
          selected: true,
        },
      });
    });

    const updated = await this.findAccessibleTrip(actor, id);
    await this.invalidateReports(trip.companyId);
    return this.toResponse(updated);
  }

  private mapTravelClass(value?: string | null): TravelClass | null {
    if (!value) {
      return null;
    }
    const normalized = value.toUpperCase().replace(/[\s-]+/g, '_');
    if (normalized === 'PREMIUMECONOMY' || normalized === 'PREMIUM_ECONOMY') {
      return TravelClass.PREMIUM_ECONOMY;
    }
    if (
      normalized === 'ECONOMY' ||
      normalized === 'BUSINESS' ||
      normalized === 'FIRST'
    ) {
      return normalized as TravelClass;
    }
    return null;
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

    if (trip.status !== TripStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Trip must be pending approval (current status: ${trip.status})`,
      );
    }

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

    if (action === ApprovalActionType.APPROVE) {
      await this.notifyTripStakeholders(
        updated,
        actor.id,
        NotificationType.TRIP_APPROVED,
        'Trip approved',
        `Your trip "${updated.purpose}" was approved.`,
      );
    } else if (action === ApprovalActionType.REJECT) {
      await this.notifyTripStakeholders(
        updated,
        actor.id,
        NotificationType.TRIP_REJECTED,
        'Trip rejected',
        comment?.trim()
          ? `Your trip "${updated.purpose}" was rejected: ${comment.trim()}`
          : `Your trip "${updated.purpose}" was rejected.`,
      );
    }

    await this.invalidateReports(updated.companyId);
    if (nextStatus === TripStatus.APPROVED) {
      await this.promoteDueTrips();
      const refreshed = await this.findAccessibleTrip(actor, id);
      return this.toResponse(refreshed);
    }
    return this.toResponse(updated);
  }

  private async notifyAdminsOfSubmission(
    trip: TripRecord,
    submitterId: string,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        companyId: trip.companyId,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        id: { not: submitterId },
      },
      select: { id: true },
    });

    await this.notificationsService.createMany(
      admins.map((admin) => ({
        userId: admin.id,
        type: NotificationType.TRIP_SUBMITTED,
        title: 'Trip submitted for approval',
        body: `"${trip.purpose}" is waiting for review.`,
        tripId: trip.id,
      })),
    );
  }

  private async notifyTripStakeholders(
    trip: TripRecord,
    actorId: string,
    type: NotificationType,
    title: string,
    body: string,
  ): Promise<void> {
    const recipientIds = new Set<string>();
    if (trip.createdByUserId !== actorId) {
      recipientIds.add(trip.createdByUserId);
    }
    for (const traveler of trip.travelers) {
      if (traveler.employee.userId && traveler.employee.userId !== actorId) {
        recipientIds.add(traveler.employee.userId);
      }
    }

    await this.notificationsService.createMany(
      [...recipientIds].map((userId) => ({
        userId,
        type,
        title,
        body,
        tripId: trip.id,
      })),
    );
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

    await this.invalidateReports(trip.companyId);
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

  private async invalidateReports(companyId: string): Promise<void> {
    await invalidateReportCacheForCompany(this.prisma, companyId);
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

  private requirePurpose(raw: string | undefined | null): string {
    const purpose = (raw ?? '').trim().slice(0, 200);
    if (!purpose || purpose.toLowerCase() === 'new trip') {
      throw new BadRequestException('Trip purpose is required');
    }
    return purpose;
  }

  private assertReadyForSubmit(trip: TripRecord): void {
    if (trip.travelers.length < 1) {
      throw new BadRequestException('Trip requires at least one traveler');
    }

    this.requirePurpose(trip.purpose);

    const hasSelectedFlight = trip.flightOfferSnapshots.some((o) => o.selected);
    const hasSelectedHotel = trip.hotelOfferSnapshots.some((o) => o.selected);

    if (!hasSelectedFlight) {
      throw new BadRequestException(
        'Select a flight before submitting for approval',
      );
    }
    if (!hasSelectedHotel) {
      throw new BadRequestException(
        'Select a hotel before submitting for approval',
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

  private assertNotInPast(startDate: string): void {
    const start = startOfUtcDay(new Date(startDate));
    const today = startOfUtcDay(new Date());
    if (start.getTime() < today.getTime()) {
      throw new BadRequestException('startDate must be on or after today');
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
      flightOffers: (trip.flightOfferSnapshots ?? []).map((offer) => ({
        id: offer.id,
        provider: offer.provider,
        providerOfferId: offer.providerOfferId,
        origin: offer.origin,
        destination: offer.destination,
        departAt: offer.departAt ? offer.departAt.toISOString() : null,
        returnAt: offer.returnAt ? offer.returnAt.toISOString() : null,
        priceAmount:
          offer.priceAmount === null || offer.priceAmount === undefined
            ? null
            : Number(offer.priceAmount),
        currency: offer.currency,
        selected: offer.selected,
      })),
      hotelOffers: (trip.hotelOfferSnapshots ?? []).map((offer) => ({
        id: offer.id,
        provider: offer.provider,
        providerOfferId: offer.providerOfferId,
        hotelName: offer.hotelName,
        city: offer.city,
        checkIn: offer.checkIn ? toDateString(offer.checkIn) : null,
        checkOut: offer.checkOut ? toDateString(offer.checkOut) : null,
        priceAmount:
          offer.priceAmount === null || offer.priceAmount === undefined
            ? null
            : Number(offer.priceAmount),
        currency: offer.currency,
        selected: offer.selected,
      })),
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
  flightOfferSnapshots: {
    orderBy: { createdAt: 'desc' as const },
  },
  hotelOfferSnapshots: {
    orderBy: { createdAt: 'desc' as const },
  },
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
