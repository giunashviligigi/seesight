import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import {
  ApprovalActionType,
  ApprovalStatus,
  TripStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const password = 'SecurePass1';
  let passwordHash: string;

  let companyAId = '';
  let companyBId = '';
  let adminAToken = '';
  let adminBToken = '';
  let employeeToken = '';
  let employeeUserId = '';
  let employeeId = '';
  let suffix = 0;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    passwordHash = await bcrypt.hash(password, 4);
    suffix = Date.now();

    const companyA = await prisma.company.create({
      data: {
        name: `Dash Co A ${suffix}`,
        slug: `dash-co-a-${suffix}`,
        billingEmail: `dash-billing-a-${suffix}@example.com`,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Dash Co B ${suffix}`,
        slug: `dash-co-b-${suffix}`,
        billingEmail: `dash-billing-b-${suffix}@example.com`,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    await prisma.user.create({
      data: {
        email: `dash-admin-a-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: companyAId,
      },
    });
    await prisma.user.create({
      data: {
        email: `dash-admin-b-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: companyBId,
      },
    });

    const employeeUser = await prisma.user.create({
      data: {
        email: `dash-emp-${suffix}@example.com`,
        passwordHash,
        firstName: 'Dash',
        lastName: 'Traveler',
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        companyId: companyAId,
      },
    });
    employeeUserId = employeeUser.id;

    const employee = await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: employeeUserId,
        email: `dash-emp-${suffix}@example.com`,
        firstName: 'Dash',
        lastName: 'Traveler',
        status: UserStatus.ACTIVE,
      },
    });
    employeeId = employee.id;

    await prisma.employee.create({
      data: {
        companyId: companyAId,
        email: `dash-roster-${suffix}@example.com`,
        firstName: 'Other',
        lastName: 'Person',
        status: UserStatus.ACTIVE,
      },
    });

    const adminA = await prisma.user.findUniqueOrThrow({
      where: { email: `dash-admin-a-${suffix}@example.com` },
    });

    const futureStart = new Date();
    futureStart.setUTCDate(futureStart.getUTCDate() + 30);
    const futureEnd = new Date(futureStart);
    futureEnd.setUTCDate(futureEnd.getUTCDate() + 3);

    await prisma.trip.create({
      data: {
        companyId: companyAId,
        createdByUserId: adminA.id,
        purpose: 'Dashboard demo trip',
        destinationCountry: 'DE',
        destinationCity: 'Berlin',
        startDate: futureStart,
        endDate: futureEnd,
        budgetAmount: 1800,
        budgetCurrency: 'EUR',
        status: TripStatus.PENDING_APPROVAL,
        travelers: {
          create: [{ employeeId, isPrimary: true }],
        },
        approval: {
          create: {
            status: ApprovalStatus.PENDING,
            actions: {
              create: {
                actorUserId: adminA.id,
                action: ApprovalActionType.SUBMIT,
                comment: 'e2e submit',
              },
            },
          },
        },
        flightOfferSnapshots: {
          create: {
            priceAmount: 620,
            currency: 'EUR',
            selected: true,
            rawPayload: { source: 'e2e' },
          },
        },
        hotelOfferSnapshots: {
          create: {
            priceAmount: 480,
            currency: 'EUR',
            selected: true,
            hotelName: 'Test Inn',
            rawPayload: { source: 'e2e' },
          },
        },
      },
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      return res.body.accessToken as string;
    };

    adminAToken = await login(`dash-admin-a-${suffix}@example.com`);
    adminBToken = await login(`dash-admin-b-${suffix}@example.com`);
    employeeToken = await login(`dash-emp-${suffix}@example.com`);
  });

  afterAll(async () => {
    if (prisma && companyAId && companyBId) {
      try {
        await prisma.approvalAction.deleteMany({
          where: {
            approval: {
              trip: { companyId: { in: [companyAId, companyBId] } },
            },
          },
        });
        await prisma.approval.deleteMany({
          where: { trip: { companyId: { in: [companyAId, companyBId] } } },
        });
        await prisma.flightOfferSnapshot.deleteMany({
          where: { trip: { companyId: { in: [companyAId, companyBId] } } },
        });
        await prisma.hotelOfferSnapshot.deleteMany({
          where: { trip: { companyId: { in: [companyAId, companyBId] } } },
        });
        await prisma.tripTraveler.deleteMany({
          where: { trip: { companyId: { in: [companyAId, companyBId] } } },
        });
        await prisma.trip.deleteMany({
          where: { companyId: { in: [companyAId, companyBId] } },
        });
        await prisma.employee.deleteMany({
          where: { companyId: { in: [companyAId, companyBId] } },
        });
        await prisma.user.deleteMany({
          where: { companyId: { in: [companyAId, companyBId] } },
        });
        await prisma.company.deleteMany({
          where: { id: { in: [companyAId, companyBId] } },
        });
      } catch {
        // Cleanup best-effort when DB is unavailable
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('returns company summary for company admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.body.scope).toBe('company');
    expect(res.body.companyId).toBe(companyAId);
    expect(res.body.activeEmployeesCount).toBe(2);
    expect(res.body.pendingApprovalsCount).toBe(1);
    expect(res.body.upcomingTripsCount).toBe(1);
    expect(res.body.upcomingTrips[0].purpose).toBe('Dashboard demo trip');
    expect(res.body.totalTravelSpending.amount).toBe(1100);
    expect(res.body.totalTravelSpending.currency).toBe('EUR');
  });

  it('returns self-scoped summary for employee', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(res.body.scope).toBe('self');
    expect(res.body.upcomingTripsCount).toBe(1);
    expect(res.body.pendingApprovalsCount).toBe(1);
    expect(res.body.totalTravelSpending.amount).toBe(1100);
  });

  it('blocks cross-tenant companyId override', async () => {
    await request(app.getHttpServer())
      .get(`/dashboard/summary?companyId=${companyBId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(403);
  });

  it('returns empty metrics for company with no trips', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(200);

    expect(res.body.companyId).toBe(companyBId);
    expect(res.body.upcomingTripsCount).toBe(0);
    expect(res.body.upcomingTrips).toEqual([]);
    expect(res.body.pendingApprovalsCount).toBe(0);
    expect(res.body.totalTravelSpending.amount).toBe(0);
    expect(res.body.activeEmployeesCount).toBe(0);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/dashboard/summary').expect(401);
  });
});
