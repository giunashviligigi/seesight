import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { UserRole, UserStatus } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/common/prisma/prisma.service';
import { SerpApiClient } from './../src/modules/travel-search/serpapi.client';

describe('Travel Search (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let serpApi: { search: jest.Mock };

  const password = 'SecurePass1';
  let passwordHash = '';
  let companyId = '';
  let adminToken = '';
  let tripId = '';
  let employeeId = '';
  let suffix = 0;

  beforeAll(async () => {
    serpApi = {
      search: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SerpApiClient)
      .useValue(serpApi)
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
        name: `Travel Co ${suffix}`,
        slug: `travel-co-${suffix}`,
        billingEmail: `travel-billing-${suffix}@example.com`,
      },
    });
    companyId = company.id;

    await prisma.user.create({
      data: {
        email: `travel-admin-${suffix}@example.com`,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
        companyId,
        firstName: 'Travel',
        lastName: 'Admin',
      },
    });

    const employee = await prisma.employee.create({
      data: {
        companyId,
        email: `travel-emp-${suffix}@example.com`,
        firstName: 'Pat',
        lastName: 'Person',
        status: UserStatus.ACTIVE,
      },
    });
    employeeId = employee.id;

    const trip = await prisma.trip.create({
      data: {
        companyId,
        createdByUserId: (
          await prisma.user.findUniqueOrThrow({
            where: { email: `travel-admin-${suffix}@example.com` },
          })
        ).id,
        purpose: 'Search attach demo',
        destinationCity: 'Berlin',
        destinationCountry: 'DE',
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-14'),
        budgetCurrency: 'EUR',
        travelers: {
          create: [{ employeeId, isPrimary: true }],
        },
      },
    });
    tripId = trip.id;

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `travel-admin-${suffix}@example.com`, password })
      .expect(200);
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.flightOfferSnapshot.deleteMany({ where: { tripId } });
    await prisma.hotelOfferSnapshot.deleteMany({ where: { tripId } });
    await prisma.tripTraveler.deleteMany({ where: { tripId } });
    await prisma.trip.deleteMany({ where: { id: tripId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await app.close();
  });

  it('searches flights via mocked provider and returns normalized DTOs', async () => {
    serpApi.search.mockResolvedValueOnce({
      best_flights: [
        {
          flights: [
            {
              departure_airport: { id: 'TBS', time: '2026-09-10 06:30' },
              arrival_airport: { id: 'BER', time: '2026-09-10 09:10' },
              airline: 'Lufthansa',
              flight_number: 'LH 1',
              travel_class: 'Economy',
            },
          ],
          price: 420,
          booking_token: 'flight-token-1',
        },
      ],
      other_flights: [],
    });

    const res = await request(app.getHttpServer())
      .get(
        '/travel/flights?origin=TBS&destination=BER&departureDate=2026-09-10&adults=1&currency=EUR',
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.provider).toBe('SERPAPI');
    expect(res.body.items[0].origin).toBe('TBS');
    expect(res.body.items[0].providerOfferId).toBe('flight-token-1');
    expect(res.body).not.toHaveProperty('best_flights');
  });

  it('attaches flight and hotel offers and reloads them on trip get', async () => {
    await request(app.getHttpServer())
      .post(`/trips/${tripId}/offers/flight`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        providerOfferId: 'flight-token-1',
        origin: 'TBS',
        destination: 'BER',
        departAt: '2026-09-10T06:30:00.000Z',
        priceAmount: 420,
        currency: 'EUR',
        travelClass: 'ECONOMY',
        rawPayload: { source: 'test' },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/trips/${tripId}/offers/hotel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        providerOfferId: 'hotel-token-1',
        hotelName: 'Berlin Central Inn',
        city: 'Berlin',
        checkIn: '2026-09-10',
        checkOut: '2026-09-14',
        priceAmount: 480,
        currency: 'EUR',
        rawPayload: { source: 'test' },
      })
      .expect(201);

    const trip = await request(app.getHttpServer())
      .get(`/trips/${tripId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(trip.body.flightOffers.some((o: { selected: boolean }) => o.selected)).toBe(
      true,
    );
    expect(trip.body.hotelOffers.some((o: { selected: boolean }) => o.selected)).toBe(
      true,
    );
  });

  it('maps provider downtime to 502', async () => {
    const { BadGatewayException } = await import('@nestjs/common');
    serpApi.search.mockRejectedValueOnce(
      new BadGatewayException('Travel search provider is temporarily unavailable'),
    );

    await request(app.getHttpServer())
      .get('/travel/hotels?city=Berlin&checkIn=2026-09-10&checkOut=2026-09-14')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(502);
  });
});
