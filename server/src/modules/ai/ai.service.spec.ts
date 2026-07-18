import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiService } from './ai.service';
import {
  AI_PROVIDER,
  AiProvider,
} from './providers/ai-provider.interface';
import { SYSTEM_INSTRUCTION, buildUserPrompt } from './prompt';
import { ruleBasedRecommend } from './rule-based-ranker';

describe('AiService', () => {
  let service: AiService;
  let prisma: {
    trip: { findFirst: jest.Mock };
    company: { findFirst: jest.Mock };
    employee: { findFirst: jest.Mock };
    aiRecommendation: { create: jest.Mock; findMany: jest.Mock };
  };
  let aiProvider: { name: string; generate: jest.Mock };

  const actor = {
    id: 'user-1',
    email: 'admin@example.com',
    role: UserRole.COMPANY_ADMIN,
    companyId: 'co-1',
  };

  const trip = {
    id: 'trip-1',
    companyId: 'co-1',
    createdByUserId: 'user-1',
    purpose: 'Client kickoff',
    destinationCity: 'Berlin',
    destinationCountry: 'DE',
    startDate: new Date('2026-09-10'),
    endDate: new Date('2026-09-14'),
    budgetAmount: 1500,
    budgetCurrency: 'EUR',
    travelers: [{ id: 'tt-1', employeeId: 'emp-1' }],
    flightOfferSnapshots: [
      {
        id: 'fs-1',
        providerOfferId: 'f-token-1',
        origin: 'TBS',
        destination: 'BER',
        priceAmount: 420,
        currency: 'EUR',
        travelClass: 'ECONOMY',
      },
      {
        id: 'fs-2',
        providerOfferId: 'f-token-2',
        origin: 'TBS',
        destination: 'BER',
        priceAmount: 510,
        currency: 'EUR',
        travelClass: 'ECONOMY',
      },
    ],
    hotelOfferSnapshots: [
      {
        id: 'hs-1',
        providerOfferId: 'h-token-1',
        hotelName: 'Berlin Central Inn',
        city: 'Berlin',
        priceAmount: 480,
        currency: 'EUR',
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      trip: { findFirst: jest.fn().mockResolvedValue(trip) },
      company: {
        findFirst: jest.fn().mockResolvedValue({
          policyJson: { maxHotelStars: 4, password: 'secret' },
        }),
      },
      employee: { findFirst: jest.fn() },
      aiRecommendation: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'rec-1',
            tripId: data.tripId,
            provider: data.provider,
            promptSummary: data.promptSummary,
            responseJson: data.responseJson,
            createdAt: new Date('2026-07-18T12:00:00.000Z'),
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    aiProvider = {
      name: 'gemini',
      generate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'ai.rateLimitPerMinute') return 100;
              if (key === 'ai.maxOffersPerType') return 8;
              if (key === 'ai.maxOutputTokens') return 1024;
              if (key === 'ai.temperature') return 0.2;
              return undefined;
            },
          },
        },
        { provide: AI_PROVIDER, useValue: aiProvider as AiProvider },
      ],
    }).compile();

    service = module.get(AiService);
  });

  it('returns structured recommendation from Gemini and persists history', async () => {
    aiProvider.generate.mockResolvedValue({
      text: JSON.stringify({
        recommendedFlightId: 'fs-1',
        recommendedHotelId: 'hs-1',
        estimatedTotal: 900,
        currency: 'EUR',
        reasoning: 'Flight fs-1 is cheapest; hotel hs-1 fits budget.',
        tradeoffs: 'fs-1 cheapest vs fs-2 slightly longer.',
        alternatives: [
          {
            flightOfferId: 'fs-2',
            hotelOfferId: 'hs-1',
            label: 'pricier flight',
            estimatedTotal: 990,
            rationale: 'Higher fare for similar timing.',
          },
        ],
      }),
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    });

    const result = await service.recommendItinerary(actor as never, {
      tripId: 'trip-1',
    });

    expect(result.source).toBe('gemini');
    expect(result.recommendation.recommendedFlightId).toBe('fs-1');
    expect(result.recommendation.recommendedHotelId).toBe('hs-1');
    expect(result.recommendation.reasoning).toContain('fs-1');
    expect(prisma.aiRecommendation.create).toHaveBeenCalled();
    expect(aiProvider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: SYSTEM_INSTRUCTION,
      }),
    );

    const promptArg = aiProvider.generate.mock.calls[0][0].userPrompt as string;
    expect(promptArg).not.toContain('secret');
    expect(promptArg).not.toContain('password');
  });

  it('falls back to rule-based ranking when Gemini is down', async () => {
    aiProvider.generate.mockRejectedValue(new Error('down'));

    const result = await service.recommendItinerary(actor as never, {
      tripId: 'trip-1',
    });

    expect(result.source).toBe('rule_based');
    expect(result.provider).toBe('rule_based');
    expect(result.recommendation.recommendedFlightId).toBe('fs-1');
    expect(result.recommendation.recommendedHotelId).toBe('hs-1');
  });

  it('rejects when no offers are available', async () => {
    prisma.trip.findFirst.mockResolvedValue({
      ...trip,
      flightOfferSnapshots: [],
      hotelOfferSnapshots: [],
    });

    await expect(
      service.recommendItinerary(actor as never, { tripId: 'trip-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts shortlisted offers from the request body', async () => {
    aiProvider.generate.mockResolvedValue({
      text: JSON.stringify({
        recommendedFlightId: 'f-a',
        recommendedHotelId: 'h-a',
        estimatedTotal: 700,
        currency: 'EUR',
        reasoning: 'Pick f-a and h-a.',
        tradeoffs: null,
        alternatives: [],
      }),
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    });

    const result = await service.recommendItinerary(actor as never, {
      tripId: 'trip-1',
      flights: [
        {
          id: 'f-a',
          origin: 'TBS',
          destination: 'BER',
          priceAmount: 300,
          currency: 'EUR',
          totalDurationMinutes: 200,
        },
      ],
      hotels: [
        {
          id: 'h-a',
          hotelName: 'Nest',
          priceAmount: 400,
          currency: 'EUR',
        },
      ],
    });

    expect(result.recommendation.recommendedFlightId).toBe('f-a');
    expect(result.recommendation.recommendedHotelId).toBe('h-a');
  });
});

describe('ruleBasedRecommend', () => {
  it('picks cheapest flight and hotel', () => {
    const result = ruleBasedRecommend(
      [
        {
          id: 'f1',
          priceAmount: 500,
          totalDurationMinutes: 100,
          currency: 'EUR',
        },
        {
          id: 'f2',
          priceAmount: 400,
          totalDurationMinutes: 300,
          currency: 'EUR',
        },
      ],
      [
        { id: 'h1', hotelName: 'A', priceAmount: 200, currency: 'EUR' },
        { id: 'h2', hotelName: 'B', priceAmount: 150, currency: 'EUR' },
      ],
      'EUR',
    );

    expect(result.recommendedFlightId).toBe('f2');
    expect(result.recommendedHotelId).toBe('h2');
    expect(result.estimatedTotal).toBe(550);
    expect(result.tradeoffs).toContain('f1');
  });
});

describe('buildUserPrompt golden shape', () => {
  it('matches demo prompt structure', () => {
    const prompt = buildUserPrompt({
      trip: {
        purpose: 'Client kickoff',
        destinationCity: 'Berlin',
        destinationCountry: 'DE',
        startDate: '2026-09-10',
        endDate: '2026-09-14',
        budgetAmount: 1500,
        budgetCurrency: 'EUR',
        travelerCount: 1,
        policyStub: { maxHotelStars: 4 },
      },
      flights: [
        {
          id: 'flight-1',
          origin: 'TBS',
          destination: 'BER',
          airline: 'Lufthansa',
          stops: 0,
          totalDurationMinutes: 220,
          priceAmount: 420,
          currency: 'EUR',
          travelClass: 'ECONOMY',
          summary: 'TBS→BER nonstop',
        },
      ],
      hotels: [
        {
          id: 'hotel-1',
          hotelName: 'Berlin Central Inn',
          city: 'Berlin',
          stars: 4,
          priceAmount: 480,
          currency: 'EUR',
          summary: 'Central 4-star',
        },
      ],
    });

    expect(prompt).toContain('"recommendedFlightId"');
    expect(prompt).toContain('flight-1');
    expect(prompt).toContain('hotel-1');
    expect(prompt).toContain('Client kickoff');
  });
});
