import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    passwordResetToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };

  const baseUser = {
    id: 'user_1',
    email: 'admin@acme.com',
    passwordHash: '',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: UserRole.COMPANY_ADMIN,
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
    companyId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                nodeEnv: 'development',
                'app.webOrigin': 'http://localhost:3000',
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    baseUser.passwordHash = await bcrypt.hash('SecurePass1', 4);
  });

  it('registers a company admin and returns access token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(baseUser);

    const result = await service.register({
      email: 'Admin@Acme.com',
      password: 'SecurePass1',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user.email).toBe(baseUser.email);
    expect(result.user.role).toBe(UserRole.COMPANY_ADMIN);
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('rejects duplicate registration', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    await expect(
      service.register({
        email: 'admin@acme.com',
        password: 'SecurePass1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    const result = await service.login({
      email: 'admin@acme.com',
      password: 'SecurePass1',
    });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user.id).toBe(baseUser.id);
  });

  it('rejects invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    await expect(
      service.login({
        email: 'admin@acme.com',
        password: 'WrongPass1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('forgot-password does not reveal missing accounts', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword('missing@acme.com');

    expect(result.message).toMatch(/if an account exists/i);
    expect(result.resetToken).toBeUndefined();
  });
});
