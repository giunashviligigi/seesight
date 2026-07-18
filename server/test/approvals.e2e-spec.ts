import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { UserRole, UserStatus } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';

describe('Approvals (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'SecurePass1';
  let passwordHash = '';
  let companyId = '';
  let adminToken = '';
  let otherAdminToken = '';
  let employeeToken = '';
  let employeeId = '';
  let employeeUserId = '';
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

    const company = await prisma.company.create({
      data: {
        name: `Appr Co ${suffix}`,
        slug: `appr-co-${suffix}`,
        billingEmail: `appr-${suffix}@example.com`,
      },
    });
    companyId = company.id;

    await prisma.user.create({
      data: {
        email: `appr-admin-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId,
        firstName: 'Admin',
        lastName: 'One',
      },
    });
    await prisma.user.create({
      data: {
        email: `appr-admin2-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId,
        firstName: 'Admin',
        lastName: 'Two',
      },
    });

    const employeeUser = await prisma.user.create({
      data: {
        email: `appr-emp-${suffix}@example.com`,
        passwordHash,
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        companyId,
        firstName: 'Emp',
        lastName: 'Traveler',
      },
    });
    employeeUserId = employeeUser.id;

    const employee = await prisma.employee.create({
      data: {
        companyId,
        userId: employeeUserId,
        email: `appr-emp-${suffix}@example.com`,
        firstName: 'Emp',
        lastName: 'Traveler',
        status: UserStatus.ACTIVE,
      },
    });
    employeeId = employee.id;

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      return res.body.accessToken as string;
    };

    adminToken = await login(`appr-admin-${suffix}@example.com`);
    otherAdminToken = await login(`appr-admin2-${suffix}@example.com`);
    employeeToken = await login(`appr-emp-${suffix}@example.com`);
  });

  afterAll(async () => {
    if (prisma && companyId) {
      try {
        await prisma.notification.deleteMany({
          where: { user: { companyId } },
        });
        await prisma.approvalAction.deleteMany({
          where: { approval: { trip: { companyId } } },
        });
        await prisma.approval.deleteMany({
          where: { trip: { companyId } },
        });
        await prisma.tripTraveler.deleteMany({
          where: { trip: { companyId } },
        });
        await prisma.trip.deleteMany({ where: { companyId } });
        await prisma.employee.deleteMany({ where: { companyId } });
        await prisma.user.deleteMany({ where: { companyId } });
        await prisma.company.deleteMany({ where: { id: companyId } });
      } catch {
        // best-effort
      }
    }
    if (app) await app.close();
  });

  it('enforces self-approve block, double-approve, history, and notifications', async () => {
    const created = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        purpose: 'Approval workflow demo',
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        travelers: [{ employeeId, isPrimary: true }],
      })
      .expect(201);

    const tripId = created.body.id as string;

    await request(app.getHttpServer())
      .post(`/trips/${tripId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(201);

    const pending = await request(app.getHttpServer())
      .get('/approvals/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      pending.body.items.some((i: { tripId: string }) => i.tripId === tripId),
    ).toBe(true);

    // Employee cannot approve
    await request(app.getHttpServer())
      .post(`/approvals/${tripId}/approve`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    const approved = await request(app.getHttpServer())
      .post(`/approvals/${tripId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ comment: 'Approved for thesis demo' })
      .expect(201);

    expect(approved.body.status).toBe('APPROVED');

    // Double approve blocked
    await request(app.getHttpServer())
      .post(`/approvals/${tripId}/approve`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .expect(400);

    const history = await request(app.getHttpServer())
      .get(`/approvals/${tripId}/history`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(history.body.actions.length).toBeGreaterThanOrEqual(2);
    expect(
      history.body.actions.some(
        (a: { action: string }) => a.action === 'APPROVE',
      ),
    ).toBe(true);

    const notifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(
      notifications.body.items.some(
        (n: { type: string; tripId: string | null }) =>
          n.type === 'TRIP_APPROVED' && n.tripId === tripId,
      ),
    ).toBe(true);
  });

  it('blocks admin from approving own trip', async () => {
    const created = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purpose: 'Admin self trip',
        startDate: '2026-12-10',
        endDate: '2026-12-12',
        travelers: [{ employeeId, isPrimary: true }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/trips/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/approvals/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/approvals/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .expect(201);
  });
});
