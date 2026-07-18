import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { TripStatus, UserRole, UserStatus } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';

describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'SecurePass1';
  let companyAId = '';
  let companyBId = '';
  let adminAToken = '';
  let adminBToken = '';
  let employeeToken = '';
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
    const passwordHash = await bcrypt.hash(password, 4);
    suffix = Date.now();

    const companyA = await prisma.company.create({
      data: {
        name: `Rep Co A ${suffix}`,
        slug: `rep-co-a-${suffix}`,
        billingEmail: `rep-a-${suffix}@example.com`,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Rep Co B ${suffix}`,
        slug: `rep-co-b-${suffix}`,
        billingEmail: `rep-b-${suffix}@example.com`,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const adminA = await prisma.user.create({
      data: {
        email: `rep-admin-a-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: companyAId,
      },
    });
    await prisma.user.create({
      data: {
        email: `rep-admin-b-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: companyBId,
      },
    });
    await prisma.user.create({
      data: {
        email: `rep-emp-${suffix}@example.com`,
        passwordHash,
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        companyId: companyAId,
      },
    });

    const dept = await prisma.department.create({
      data: {
        companyId: companyAId,
        name: `Engineering ${suffix}`,
      },
    });
    const employee = await prisma.employee.create({
      data: {
        companyId: companyAId,
        departmentId: dept.id,
        email: `rep-traveler-${suffix}@example.com`,
        firstName: 'Rep',
        lastName: 'Traveler',
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.trip.create({
      data: {
        companyId: companyAId,
        createdByUserId: adminA.id,
        purpose: 'Reports Berlin',
        destinationCountry: 'DE',
        destinationCity: 'Berlin',
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-14'),
        status: TripStatus.APPROVED,
        travelers: {
          create: [{ employeeId: employee.id, isPrimary: true }],
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

    adminAToken = await login(`rep-admin-a-${suffix}@example.com`);
    adminBToken = await login(`rep-admin-b-${suffix}@example.com`);
    employeeToken = await login(`rep-emp-${suffix}@example.com`);
  });

  afterAll(async () => {
    if (prisma && companyAId && companyBId) {
      try {
        await prisma.reportCache.deleteMany({
          where: { companyId: { in: [companyAId, companyBId] } },
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
        await prisma.department.deleteMany({
          where: { companyId: { in: [companyAId, companyBId] } },
        });
        await prisma.user.deleteMany({
          where: { companyId: { in: [companyAId, companyBId] } },
        });
        await prisma.company.deleteMany({
          where: { id: { in: [companyAId, companyBId] } },
        });
      } catch {
        // best-effort
      }
    }
    if (app) await app.close();
  });

  it('returns company summary for admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/reports/summary?from=2026-01-01&to=2026-12-31')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.body.companyId).toBe(companyAId);
    expect(res.body.totalSpend).toBe(1100);
    expect(res.body.averageTripCost).toBe(1100);
    expect(res.body.topCountries[0].label).toBe('DE');
  });

  it('exports CSV download', async () => {
    const res = await request(app.getHttpServer())
      .get('/reports/export?format=csv&dataset=monthly&from=2026-01-01&to=2026-12-31')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.text).toContain('month,amount,tripCount,currency');
    expect(res.text).toContain('1100');
  });

  it('blocks employees from reports', async () => {
    await request(app.getHttpServer())
      .get('/reports/summary')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('blocks cross-tenant export', async () => {
    await request(app.getHttpServer())
      .get(`/reports/export?companyId=${companyBId}&format=csv`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(403);
  });

  it('returns empty metrics for company without trips', async () => {
    const res = await request(app.getHttpServer())
      .get('/reports/summary?from=2026-01-01&to=2026-12-31')
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(200);

    expect(res.body.totalSpend).toBe(0);
    expect(res.body.tripCount).toBe(0);
  });
});
