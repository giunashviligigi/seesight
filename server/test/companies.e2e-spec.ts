import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { UserRole, UserStatus } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';

describe('Companies (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const password = 'SecurePass1';
  let passwordHash: string;

  let companyAId = '';
  let companyBId = '';
  let adminAToken = '';
  let adminBToken = '';
  let superToken = '';

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

    const suffix = Date.now();

    const companyA = await prisma.company.create({
      data: {
        name: `Company A ${suffix}`,
        slug: `company-a-${suffix}`,
        billingEmail: `billing-a-${suffix}@example.com`,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Company B ${suffix}`,
        slug: `company-b-${suffix}`,
        billingEmail: `billing-b-${suffix}@example.com`,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    await prisma.user.create({
      data: {
        email: `admin-a-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: companyAId,
      },
    });
    await prisma.user.create({
      data: {
        email: `admin-b-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: companyBId,
      },
    });
    await prisma.user.create({
      data: {
        email: `super-${suffix}@seesight.local`,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: null,
      },
    });

    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `admin-a-${suffix}@example.com`, password })
      .expect(200);
    adminAToken = loginA.body.accessToken;

    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `admin-b-${suffix}@example.com`, password })
      .expect(200);
    adminBToken = loginB.body.accessToken;

    const loginSuper = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `super-${suffix}@seesight.local`, password })
      .expect(200);
    superToken = loginSuper.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { companyId: { in: [companyAId, companyBId].filter(Boolean) } },
          { email: { startsWith: 'admin-a-' } },
          { email: { startsWith: 'admin-b-' } },
          { email: { startsWith: 'super-' } },
        ],
      },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyAId, companyBId].filter(Boolean) } },
    });
    await app.close();
  });

  it('blocks cross-tenant company reads with 403', async () => {
    await request(app.getHttpServer())
      .get(`/companies/${companyBId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(403);
  });

  it('allows company admin to read own company', async () => {
    const res = await request(app.getHttpServer())
      .get(`/companies/${companyAId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.body.id).toBe(companyAId);
  });

  it('allows super admin to list companies', async () => {
    const res = await request(app.getHttpServer())
      .get('/companies')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('blocks company admin from listing all companies', async () => {
    await request(app.getHttpServer())
      .get('/companies')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(403);
  });
});
