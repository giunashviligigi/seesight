import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import { TravelSearchService } from './travel-search.service';
import { SerpApiClient } from './serpapi.client';
import { RequestUser } from '../auth/types/auth.types';

describe('TravelSearchService', () => {
  let service: TravelSearchService;
  let serpApi: { search: jest.Mock };

  const actor: RequestUser = {
    id: 'user_1',
    email: 'admin@acme.example',
    role: UserRole.COMPANY_ADMIN,
    status: UserStatus.ACTIVE,
    companyId: 'company_a',
    firstName: 'Ada',
    lastName: 'Admin',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    serpApi = { search: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TravelSearchService,
        { provide: SerpApiClient, useValue: serpApi },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'serpapi.cacheTtlMs') return 60_000;
              if (key === 'serpapi.rateLimitPerMinute') return 30;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get(TravelSearchService);
  });

  it('normalizes flight offers and does not leak vendor-only top-level keys', async () => {
    serpApi.search.mockResolvedValue({
      best_flights: [
        {
          flights: [
            {
              departure_airport: {
                id: 'TBS',
                time: '2026-09-10 06:30',
              },
              arrival_airport: {
                id: 'BER',
                time: '2026-09-10 09:10',
              },
              airline: 'Lufthansa',
              flight_number: 'LH 2547',
              travel_class: 'Economy',
            },
          ],
          total_duration: 160,
          price: 420,
          booking_token: 'token-1',
        },
      ],
      other_flights: [],
      search_parameters: { currency: 'EUR' },
    });

    const result = await service.searchFlights(actor, {
      origin: 'tbs',
      destination: 'ber',
      departureDate: '2026-09-10',
      adults: 1,
      currency: 'EUR',
    });

    expect(result.provider).toBe('SERPAPI');
    expect(result.cached).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      provider: 'SERPAPI',
      origin: 'TBS',
      destination: 'BER',
      priceAmount: 420,
      currency: 'EUR',
      airline: 'Lufthansa',
    });
    expect(result.items[0].rawPayload).toHaveProperty(
      'source',
      'serpapi_google_flights',
    );
    expect(result).not.toHaveProperty('best_flights');
  });

  it('returns cached flight results on identical query', async () => {
    serpApi.search.mockResolvedValue({
      best_flights: [
        {
          flights: [
            {
              departure_airport: { id: 'TBS', time: '2026-09-10 06:30' },
              arrival_airport: { id: 'BER', time: '2026-09-10 09:10' },
              airline: 'Lufthansa',
              flight_number: 'LH 1',
            },
          ],
          price: 100,
          booking_token: 'cached-token',
        },
      ],
    });

    const query = {
      origin: 'TBS',
      destination: 'BER',
      departureDate: '2026-09-10',
      adults: 1,
      currency: 'EUR',
    };

    const first = await service.searchFlights(actor, query);
    const second = await service.searchFlights(actor, query);

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(serpApi.search).toHaveBeenCalledTimes(1);
  });

  it('normalizes hotel offers from properties list', async () => {
    serpApi.search.mockResolvedValue({
      properties: [
        {
          type: 'hotel',
          name: 'Berlin Central Inn',
          property_token: 'prop-1',
          extracted_hotel_class: 4,
          overall_rating: 4.5,
          total_rate: { extracted_lowest: 480 },
          amenities: ['Wi-Fi', 'Pool'],
          images: [{ thumbnail: 'https://example.com/t.jpg' }],
        },
      ],
    });

    const result = await service.searchHotels(actor, {
      city: 'Berlin',
      checkIn: '2026-09-10',
      checkOut: '2026-09-14',
      adults: 2,
      currency: 'EUR',
    });

    expect(result.items[0]).toMatchObject({
      provider: 'SERPAPI',
      hotelName: 'Berlin Central Inn',
      city: 'Berlin',
      priceAmount: 480,
      stars: 4,
    });
  });

  it('maps provider failures to BadGatewayException', async () => {
    serpApi.search.mockRejectedValue(
      new BadGatewayException('Travel search provider is temporarily unavailable'),
    );

    await expect(
      service.searchFlights(actor, {
        origin: 'TBS',
        destination: 'BER',
        departureDate: '2026-09-10',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('enforces per-user rate limiting', async () => {
    const limitedModule = await Test.createTestingModule({
      providers: [
        TravelSearchService,
        { provide: SerpApiClient, useValue: serpApi },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'serpapi.cacheTtlMs') return 60_000;
              if (key === 'serpapi.rateLimitPerMinute') return 2;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    const limited = limitedModule.get(TravelSearchService);
    serpApi.search.mockResolvedValue({ best_flights: [], other_flights: [] });

    await limited.searchFlights(actor, {
      origin: 'TBS',
      destination: 'BER',
      departureDate: '2026-09-10',
    });
    await limited.searchFlights(actor, {
      origin: 'TBS',
      destination: 'MUC',
      departureDate: '2026-09-11',
    });

    await expect(
      limited.searchFlights(actor, {
        origin: 'TBS',
        destination: 'FRA',
        departureDate: '2026-09-12',
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });
});

describe('SerpApiClient', () => {
  it('fails closed when API key is missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SerpApiClient,
        {
          provide: ConfigService,
          useValue: {
            get: () => '',
          },
        },
      ],
    }).compile();

    const client = module.get(SerpApiClient);
    await expect(client.search({ engine: 'google_flights' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
