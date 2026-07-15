import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const email = `e2e_${Date.now()}@seesight.test`;
  const password = 'SecurePass1';

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
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email } },
    });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers, fetches me, and reaches protected account route', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        firstName: 'E2E',
        lastName: 'Admin',
      })
      .expect(201);

    expect(register.body.accessToken).toBeDefined();
    expect(register.body.user.role).toBe('COMPANY_ADMIN');

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${register.body.accessToken}`)
      .expect(200);

    expect(me.body.email).toBe(email);

    await request(app.getHttpServer())
      .get('/account/protected')
      .set('Authorization', `Bearer ${register.body.accessToken}`)
      .expect(200);
  });

  it('rejects invalid login credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'WrongPass1' })
      .expect(401);
  });

  it('rejects expired tokens on protected routes', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const expired = await jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      { expiresIn: '0s' },
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('forgot-password keeps generic messaging for unknown emails', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'does-not-exist@seesight.test' })
      .expect(200);

    expect(res.body.message).toMatch(/if an account exists/i);
    expect(res.body.resetToken).toBeUndefined();
  });
});
