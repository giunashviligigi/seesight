import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { OfferProvider, UserRole, UserStatus } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';
import {
  AI_PROVIDER,
  AiProvider,
} from './../src/modules/ai/providers/ai-provider.interface';

describe('AI Recommendations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let aiProvider: { name: string; generate: jest.Mock };

  const password = 'SecurePass1';
  let passwordHash = '';
  let companyId = '';
  let adminToken = '';
  let tripId = '';
  let suffix = 0;

  beforeAll(async () => {
    aiProvider = {
      name: 'gemini',
      generate: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_PROVIDER)
      .useValue(aiProvider as AiProvider)
      .compile();

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
        name: `AI Co ${suffix}`,
        slug: `ai-co-${suffix}`,
        billingEmail: `ai-billing-${suffix}@example.com`,
        policyJson: { maxHotelStars: 4 },
      },
    });
    companyId = company.id;

    const admin = await prisma.user.create({
      data: {
        email: `ai-admin-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId,
        firstName: 'AI',
        lastName: 'Admin',
      },
    });

    const employee = await prisma.employee.create({
      data: {
        companyId,
        email: `ai-emp-${suffix}@example.com`,
        firstName: 'Alex',
        lastName: 'Traveler',
        status: UserStatus.ACTIVE,
      },
    });

    const trip = await prisma.trip.create({
      data: {
        companyId,
        createdByUserId: admin.id,
        purpose: 'AI recommend demo',
        destinationCity: 'Berlin',
        destinationCountry: 'DE',
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-14'),
        budgetCurrency: 'EUR',
        budgetAmount: 1500,
        travelers: {
          create: [{ employeeId: employee.id, isPrimary: true }],
        },
        flightOfferSnapshots: {
          create: [
            {
              provider: OfferProvider.SERPAPI,
              providerOfferId: 'flight-a',
              origin: 'TBS',
              destination: 'BER',
              priceAmount: 420,
              currency: 'EUR',
              rawPayload: { source: 'test' },
              selected: true,
            },
          ],
        },
        hotelOfferSnapshots: {
          create: [
            {
              provider: OfferProvider.SERPAPI,
              providerOfferId: 'hotel-a',
              hotelName: 'Berlin Central Inn',
              city: 'Berlin',
              checkIn: new Date('2026-09-10'),
              checkOut: new Date('2026-09-14'),
              priceAmount: 480,
              currency: 'EUR',
              rawPayload: { source: 'test' },
              selected: true,
            },
          ],
        },
      },
      include: {
        flightOfferSnapshots: true,
        hotelOfferSnapshots: true,
      },
    });
    tripId = trip.id;

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `ai-admin-${suffix}@example.com`, password })
      .expect(200);
    adminToken = login.body.accessToken;

    aiProvider.generate.mockResolvedValue({
      text: JSON.stringify({
        recommendedFlightId: trip.flightOfferSnapshots[0].id,
        recommendedHotelId: trip.hotelOfferSnapshots[0].id,
        estimatedTotal: 900,
        currency: 'EUR',
        reasoning: 'Best balance of cost and timing for the kickoff.',
        tradeoffs: null,
        alternatives: [],
      }),
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    });
  });

  afterAll(async () => {
    await prisma.aiRecommendation.deleteMany({ where: { tripId } });
    await prisma.flightOfferSnapshot.deleteMany({ where: { tripId } });
    await prisma.hotelOfferSnapshot.deleteMany({ where: { tripId } });
    await prisma.tripTraveler.deleteMany({ where: { tripId } });
    await prisma.trip.deleteMany({ where: { id: tripId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await app.close();
  });

  it('recommends an itinerary and lists history', async () => {
    const res = await request(app.getHttpServer())
      .post('/ai/recommend-itinerary')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tripId })
      .expect(201);

    expect(res.body.source).toBe('gemini');
    expect(res.body.recommendation.reasoning).toContain('kickoff');
    expect(res.body.recommendation.recommendedFlightId).toBeTruthy();

    const history = await request(app.getHttpServer())
      .get(`/ai/trips/${tripId}/recommendations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(history.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('falls back when provider fails', async () => {
    aiProvider.generate.mockRejectedValueOnce(new Error('provider down'));

    const res = await request(app.getHttpServer())
      .post('/ai/recommend-itinerary')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tripId })
      .expect(201);

    expect(res.body.source).toBe('rule_based');
    expect(res.body.recommendation.recommendedFlightId).toBeTruthy();
  });
});
