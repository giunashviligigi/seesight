import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { UserRole, UserStatus } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';

describe('Trips (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const password = 'SecurePass1';
  let passwordHash: string;
  let companyAId = '';
  let companyBId = '';
  let adminAToken = '';
  let employeeToken = '';
  let employeeId = '';
  let otherEmployeeId = '';
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
        name: `Trip Co A ${suffix}`,
        slug: `trip-co-a-${suffix}`,
        billingEmail: `trip-a-${suffix}@example.com`,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Trip Co B ${suffix}`,
        slug: `trip-co-b-${suffix}`,
        billingEmail: `trip-b-${suffix}@example.com`,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    await prisma.user.create({
      data: {
        email: `trip-admin-a-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: companyAId,
      },
    });
    await prisma.user.create({
      data: {
        email: `trip-admin-b-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: companyBId,
      },
    });

    const employeeUser = await prisma.user.create({
      data: {
        email: `trip-emp-${suffix}@example.com`,
        passwordHash,
        firstName: 'Trip',
        lastName: 'Traveler',
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        companyId: companyAId,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: employeeUser.id,
        email: `trip-emp-${suffix}@example.com`,
        firstName: 'Trip',
        lastName: 'Traveler',
        status: UserStatus.ACTIVE,
      },
    });
    employeeId = employee.id;

    const other = await prisma.employee.create({
      data: {
        companyId: companyAId,
        email: `trip-other-${suffix}@example.com`,
        firstName: 'Other',
        lastName: 'Person',
        status: UserStatus.ACTIVE,
      },
    });
    otherEmployeeId = other.id;

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      return res.body.accessToken as string;
    };

    adminAToken = await login(`trip-admin-a-${suffix}@example.com`);
    employeeToken = await login(`trip-emp-${suffix}@example.com`);
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
        // best-effort cleanup
      }
    }
    if (app) await app.close();
  });

  it('creates group trip, submits, approves, and rejects invalid transition', async () => {
    const created = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        purpose: 'Group conference',
        destinationCountry: 'DE',
        destinationCity: 'Berlin',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        budgetAmount: 2500,
        travelers: [
          { employeeId, isPrimary: true },
          { employeeId: otherEmployeeId, isPrimary: false },
        ],
      })
      .expect(201);

    expect(created.body.status).toBe('DRAFT');
    expect(created.body.travelers).toHaveLength(2);

    const tripId = created.body.id as string;

    await request(app.getHttpServer())
      .post(`/trips/${tripId}/start`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(400);

    const submitted = await request(app.getHttpServer())
      .post(`/trips/${tripId}/submit`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(201);

    expect(submitted.body.status).toBe('PENDING_APPROVAL');

    const approved = await request(app.getHttpServer())
      .post(`/trips/${tripId}/approve`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(201);

    expect(approved.body.status).toBe('APPROVED');

    await request(app.getHttpServer())
      .patch(`/trips/${tripId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ purpose: 'Should fail' })
      .expect(400);

    const cancelled = await request(app.getHttpServer())
      .post(`/trips/${tripId}/cancel`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(201);

    expect(cancelled.body.status).toBe('CANCELLED');

    const listed = await request(app.getHttpServer())
      .get('/trips?status=CANCELLED')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(listed.body.items.some((t: { id: string }) => t.id === tripId)).toBe(
      true,
    );
  });

  it('allows employee to create trip including self', async () => {
    const created = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        purpose: 'Employee solo trip',
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        travelers: [{ employeeId, isPrimary: true }],
      })
      .expect(201);

    expect(created.body.status).toBe('DRAFT');
  });

  it('rejects trip with zero travelers', async () => {
    await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        purpose: 'Invalid',
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        travelers: [],
      })
      .expect(400);
  });
});
