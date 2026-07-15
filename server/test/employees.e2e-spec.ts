import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { UserRole, UserStatus } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';

describe('Employees (e2e)', () => {
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
  let employeeEmail = '';
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
        name: `Emp Co A ${suffix}`,
        slug: `emp-co-a-${suffix}`,
        billingEmail: `emp-billing-a-${suffix}@example.com`,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Emp Co B ${suffix}`,
        slug: `emp-co-b-${suffix}`,
        billingEmail: `emp-billing-b-${suffix}@example.com`,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    await prisma.user.create({
      data: {
        email: `emp-admin-a-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: companyAId,
      },
    });
    await prisma.user.create({
      data: {
        email: `emp-admin-b-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId: companyBId,
      },
    });

    employeeEmail = `emp-user-${suffix}@example.com`;
    const employeeUser = await prisma.user.create({
      data: {
        email: employeeEmail,
        passwordHash,
        firstName: 'Pat',
        lastName: 'Person',
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        companyId: companyAId,
      },
    });
    employeeUserId = employeeUser.id;

    await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: employeeUserId,
        email: employeeEmail,
        firstName: 'Pat',
        lastName: 'Person',
        jobTitle: 'Analyst',
        status: UserStatus.ACTIVE,
      },
    });

    for (let i = 0; i < 25; i += 1) {
      await prisma.employee.create({
        data: {
          companyId: companyAId,
          email: `roster-${i}-${suffix}@example.com`,
          firstName: `First${i}`,
          lastName: `Last${i}`,
          status: UserStatus.ACTIVE,
        },
      });
    }

    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `emp-admin-a-${suffix}@example.com`, password })
      .expect(200);
    adminAToken = loginA.body.accessToken;

    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `emp-admin-b-${suffix}@example.com`, password })
      .expect(200);
    adminBToken = loginB.body.accessToken;

    const loginEmp = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: employeeEmail, password })
      .expect(200);
    employeeToken = loginEmp.body.accessToken;
  });

  afterAll(async () => {
    await prisma.employee.deleteMany({
      where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } },
    });
    await prisma.department.deleteMany({
      where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { companyId: { in: [companyAId, companyBId].filter(Boolean) } },
          { email: { startsWith: `emp-admin-a-${suffix}` } },
          { email: { startsWith: `emp-admin-b-${suffix}` } },
          { email: { startsWith: `emp-user-${suffix}` } },
        ],
      },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyAId, companyBId].filter(Boolean) } },
    });
    await app.close();
  });

  it('creates department and employee with temporary login', async () => {
    const dept = await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: `Engineering ${suffix}`, code: 'ENG' })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        email: `new-hire-${suffix}@example.com`,
        firstName: 'New',
        lastName: 'Hire',
        departmentId: dept.body.id,
        createLogin: true,
        nationality: 'GE',
        preferredAirport: 'TBS',
      })
      .expect(201);

    expect(created.body.temporaryPassword).toBeDefined();
    expect(created.body.departmentName).toContain('Engineering');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `new-hire-${suffix}@example.com`,
        password: created.body.temporaryPassword,
      })
      .expect(200);
  });

  it('lists employees with pagination', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/employees?page=1&pageSize=10&sortBy=lastName&sortOrder=asc')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(page1.body.pageSize).toBe(10);
    expect(page1.body.items).toHaveLength(10);
    expect(page1.body.total).toBeGreaterThanOrEqual(26);

    const page2 = await request(app.getHttpServer())
      .get('/employees?page=2&pageSize=10')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);
  });

  it('blocks cross-tenant employee list access indirectly via company mismatch', async () => {
    await request(app.getHttpServer())
      .get(`/employees?companyId=${companyAId}`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(403);
  });

  it('allows employee to read own profile and blocks employee create', async () => {
    const me = await request(app.getHttpServer())
      .get('/employees/me')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(me.body.email).toBe(employeeEmail);

    await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        email: `forbidden-${suffix}@example.com`,
        firstName: 'No',
        lastName: 'Access',
      })
      .expect(403);
  });

  it('deactivates employee and blocks login while preserving roster row', async () => {
    const created = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        email: `deactivate-me-${suffix}@example.com`,
        firstName: 'Soon',
        lastName: 'Gone',
        createLogin: true,
      })
      .expect(201);

    const tempPassword = created.body.temporaryPassword as string;

    await request(app.getHttpServer())
      .post(`/employees/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `deactivate-me-${suffix}@example.com`,
        password: tempPassword,
      })
      .expect(401);

    const stillThere = await prisma.employee.findUnique({
      where: { id: created.body.id },
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.status).toBe(UserStatus.INACTIVE);
  });
});
