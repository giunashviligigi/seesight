import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertCompanyAccess } from '../../common/tenant/tenant.utils';
import { RequestUser } from '../auth/types/auth.types';
import { SlidingWindowRateLimiter } from '../travel-search/travel-search.cache';
import {
  RecommendItineraryDto,
  ShortlistFlightOfferDto,
  ShortlistHotelOfferDto,
} from './dto/recommend-itinerary.dto';
import {
  RecommendationHistoryResponseDto,
  RecommendationResultDto,
  RecommendItineraryResponseDto,
} from './dto/recommendation-response.dto';
import {
  AI_PROVIDER,
  type AiProvider,
} from './providers/ai-provider.interface';
import {
  SYSTEM_INSTRUCTION,
  buildPromptSummary,
  buildUserPrompt,
} from './prompt';
import { ruleBasedRecommend } from './rule-based-ranker';
import {
  ParseTravelIntentDto,
  ParseTravelIntentResponseDto,
} from './dto/parse-travel-intent.dto';
import {
  PARSE_TRAVEL_SYSTEM,
  PARSE_TRAVEL_SYSTEM_HOTELS,
  applyClarificationAnswer,
  applyStayNights,
  buildParseTravelPrompt,
  clampHotelNights,
  deriveHotelNights,
  emptyTravelIntent,
  extractStayNights,
  finalizeTravelIntent,
  hasTravelSignals,
  heuristicParseTravelIntent,
  inferClarificationFocus,
  preferConfirmedDraft,
  type ClarificationFocus,
  type ParseBookingMode,
} from './parse-travel-intent';
import { resolvePlaceQuery } from './city-airports';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly rateLimiter: SlidingWindowRateLimiter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {
    const limit =
      this.config.get<number>('ai.rateLimitPerMinute') ?? 10;
    this.rateLimiter = new SlidingWindowRateLimiter(limit);
  }

  async recommendItinerary(
    actor: RequestUser,
    dto: RecommendItineraryDto,
  ): Promise<RecommendItineraryResponseDto> {
    this.assertRateLimit(actor.id);

    const trip = await this.findAccessibleTrip(actor, dto.tripId);
    const company = await this.prisma.company.findFirst({
      where: { id: trip.companyId, deletedAt: null },
      select: { policyJson: true },
    });

    const maxOffers =
      this.config.get<number>('ai.maxOffersPerType') ?? 8;

    const flights = this.resolveFlights(dto, trip).slice(0, maxOffers);
    const hotels = this.resolveHotels(dto, trip).slice(0, maxOffers);

    if (flights.length === 0 && hotels.length === 0) {
      throw new BadRequestException(
        'At least one flight or hotel offer is required for a recommendation',
      );
    }

    const currency = trip.budgetCurrency || 'EUR';
    const policyStub = sanitizePolicy(company?.policyJson ?? null);

    const promptSummary = buildPromptSummary({
      tripId: trip.id,
      flightCount: flights.length,
      hotelCount: hotels.length,
      destinationCity: trip.destinationCity,
    });

    const userPrompt = buildUserPrompt({
      trip: {
        purpose: trip.purpose,
        destinationCity: trip.destinationCity,
        destinationCountry: trip.destinationCountry,
        startDate: toDateString(trip.startDate),
        endDate: toDateString(trip.endDate),
        budgetAmount:
          trip.budgetAmount === null || trip.budgetAmount === undefined
            ? null
            : Number(trip.budgetAmount),
        budgetCurrency: currency,
        travelerCount: trip.travelers.length,
        policyStub,
      },
      flights,
      hotels,
    });

    let recommendation: RecommendationResultDto;
    let source: 'gemini' | 'groq' | 'rule_based' =
      this.aiProvider.name === 'groq' ? 'groq' : 'gemini';
    let providerName = this.aiProvider.name;

    try {
      const maxOutputTokens =
        this.config.get<number>('ai.maxOutputTokens') ?? 1024;
      const temperature = this.config.get<number>('ai.temperature') ?? 0.2;

      const generated = await this.aiProvider.generate({
        systemInstruction: SYSTEM_INSTRUCTION,
        userPrompt,
        maxOutputTokens,
        temperature,
      });

      recommendation = this.parseAndValidate(
        generated.text,
        flights,
        hotels,
        currency,
      );
      providerName = generated.provider;
      source = generated.provider === 'groq' ? 'groq' : 'gemini';
    } catch (error) {
      this.logger.warn(
        `AI provider failed; using rule-based fallback (${error instanceof Error ? error.message : 'unknown'})`,
      );
      recommendation = ruleBasedRecommend(flights, hotels, currency);
      source = 'rule_based';
      providerName = 'rule_based';
    }

    const saved = await this.prisma.aiRecommendation.create({
      data: {
        tripId: trip.id,
        provider: providerName,
        promptSummary,
        responseJson: {
          source,
          ...recommendation,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      id: saved.id,
      tripId: saved.tripId,
      provider: saved.provider,
      source,
      promptSummary: saved.promptSummary,
      recommendation,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async listRecommendations(
    actor: RequestUser,
    tripId: string,
  ): Promise<RecommendationHistoryResponseDto> {
    await this.findAccessibleTrip(actor, tripId);

    const rows = await this.prisma.aiRecommendation.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      items: rows.map((row) => {
        const recommendation = normalizeStoredRecommendation(row.responseJson);
        const rawSource =
          typeof row.responseJson === 'object' &&
          row.responseJson !== null &&
          !Array.isArray(row.responseJson)
            ? (row.responseJson as Record<string, unknown>).source
            : undefined;
        const source =
          rawSource === 'rule_based'
            ? ('rule_based' as const)
            : rawSource === 'groq' || row.provider === 'groq'
              ? ('groq' as const)
              : ('gemini' as const);

        return {
          id: row.id,
          tripId: row.tripId,
          provider: row.provider,
          source,
          promptSummary: row.promptSummary,
          recommendation,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    };
  }

  async parseTravelIntent(
    actor: RequestUser,
    dto: ParseTravelIntentDto,
  ): Promise<ParseTravelIntentResponseDto> {
    this.assertRateLimit(actor.id);

    const reference =
      dto.referenceDate && !Number.isNaN(Date.parse(dto.referenceDate))
        ? new Date(dto.referenceDate)
        : new Date();
    const referenceIso = toDateString(reference);
    const clarificationAnswer = dto.clarificationAnswer?.trim();
    const bookingMode: ParseBookingMode = dto.bookingMode ?? 'BOTH';

    // Continue rounds: keep confirmed draft fields, then apply only the new answer.
    // Do NOT let a fresh LLM pass invent destination/tripType/dates/nights.
    if (clarificationAnswer) {
      const heuristic = heuristicParseTravelIntent(
        dto.prompt,
        reference,
        bookingMode,
      );
      const base = preferConfirmedDraft(
        { ...heuristic, isTravelRequest: true },
        dto.draft,
        bookingMode,
      );
      const focus: ClarificationFocus | null =
        dto.clarificationFocus ??
        inferClarificationFocus(base, bookingMode);
      const parsed = applyClarificationAnswer(
        base,
        clarificationAnswer,
        focus,
        reference,
        dto.prompt,
        bookingMode,
      );
      // Continue rounds are local apply steps; keep the active LLM label so the UI
      // does not flash "offline parse" after a successful Groq/Gemini first pass.
      const withSource: ParseTravelIntentResponseDto = {
        ...parsed,
        source: this.llmSource(),
      };
      this.logger.log(
        `Clarification (${focus ?? 'auto'}): ${withSource.originIata ?? '?'}→${withSource.destinationIata ?? '?'} type=${withSource.tripType ?? '?'} dates=${withSource.departureDate ?? '?'} ready=${!withSource.clarifyingQuestion}`,
      );
      return withSource;
    }

    const fallback = heuristicParseTravelIntent(
      dto.prompt,
      reference,
      bookingMode,
    );

    let parsed: ParseTravelIntentResponseDto;
    try {
      const maxOutputTokens =
        this.config.get<number>('ai.maxOutputTokens') ?? 1024;
      const temperature = Math.min(
        this.config.get<number>('ai.temperature') ?? 0.2,
        0.1,
      );

      const generated = await this.aiProvider.generate({
        systemInstruction:
          bookingMode === 'HOTELS'
            ? PARSE_TRAVEL_SYSTEM_HOTELS
            : PARSE_TRAVEL_SYSTEM,
        userPrompt: buildParseTravelPrompt(
          dto.prompt,
          referenceIso,
          bookingMode,
        ),
        maxOutputTokens,
        temperature,
      });

      parsed = this.parseTravelIntentJson(
        generated.text,
        fallback,
        dto.prompt,
        bookingMode,
      );
      this.logger.log(
        `Travel intent parsed via ${this.llmSource()}: travel=${parsed.isTravelRequest} ${parsed.originIata ?? '?'}→${parsed.destinationIata ?? '?'} dates=${parsed.departureDate ?? '?'}..${parsed.returnDate ?? '?'} type=${parsed.tripType ?? '?'}`,
      );
    } catch (error) {
      this.logger.warn(
        `Travel intent parse failed; using heuristic (${error instanceof Error ? error.message : 'unknown'})`,
      );
      parsed = fallback;
    }

    return parsed;
  }

  private parseTravelIntentJson(
    text: string,
    fallback: ParseTravelIntentResponseDto,
    originalPrompt: string,
    bookingMode: ParseBookingMode = 'BOTH',
  ): ParseTravelIntentResponseDto {
    let obj: Record<string, unknown>;
    try {
      obj = parseJsonObject(text);
    } catch {
      return fallback;
    }

    const travelFlag =
      typeof obj.isTravelRequest === 'boolean' ? obj.isTravelRequest : null;
    if (travelFlag === false || !hasTravelSignals(originalPrompt)) {
      return emptyTravelIntent(
        this.llmSource(),
        ['not a travel request'],
        false,
        bookingMode,
      );
    }

    const originCity =
      typeof obj.originCity === 'string' ? obj.originCity.trim() : null;
    const destinationCity =
      typeof obj.destinationCity === 'string'
        ? obj.destinationCity.trim()
        : null;

    // Validate Gemini IATA against the global DB; resolve city/country text when needed.
    // Do not merge heuristic field values into a successful Gemini parse.
    const originResolved =
      (typeof obj.originIata === 'string'
        ? resolvePlaceQuery(obj.originIata)
        : null) ?? (originCity ? resolvePlaceQuery(originCity) : null);
    const destinationResolved =
      (typeof obj.destinationIata === 'string'
        ? resolvePlaceQuery(obj.destinationIata)
        : null) ??
      (destinationCity ? resolvePlaceQuery(destinationCity) : null);

    const stayNights = extractStayNights(originalPrompt);
    // Prefer LLM fields; backfill null dates/city/nights from heuristic when the
    // prompt clearly had them (LLMs often omit stay windows in hotels mode).
    let departureDate =
      asIsoDate(obj.departureDate) ?? fallback.departureDate ?? null;
    let geminiReturn = asIsoDate(obj.returnDate);
    let returnDate =
      applyStayNights(departureDate, geminiReturn, stayNights) ??
      fallback.returnDate ??
      null;
    if (!departureDate && fallback.departureDate) {
      departureDate = fallback.departureDate;
    }
    if (!returnDate && fallback.returnDate) {
      returnDate = fallback.returnDate;
    }

    const adults =
      typeof obj.adults === 'number' &&
      Number.isFinite(obj.adults) &&
      obj.adults >= 1 &&
      obj.adults <= 9
        ? Math.round(obj.adults)
        : (fallback.adults ?? null);

    const tripTypeRaw =
      typeof obj.tripType === 'string' ? obj.tripType.trim().toLowerCase() : null;
    let tripType: 'one_way' | 'round_trip' | null =
      tripTypeRaw === 'one_way' || tripTypeRaw === 'one-way'
        ? 'one_way'
        : tripTypeRaw === 'round_trip' || tripTypeRaw === 'round-trip'
          ? 'round_trip'
          : null;
    // Only infer trip type from dates that Gemini itself returned (stated in prompt).
    if (!tripType) {
      if ((geminiReturn || returnDate) && departureDate) tripType = 'round_trip';
      else if (departureDate || stayNights != null) tripType = 'one_way';
      else tripType = fallback.tripType;
    }
    if (bookingMode === 'HOTELS' && returnDate && departureDate) {
      tripType = 'round_trip';
    }

    const geminiNights =
      typeof obj.hotelNights === 'number' && Number.isFinite(obj.hotelNights)
        ? clampHotelNights(obj.hotelNights)
        : null;
    const hotelNights =
      deriveHotelNights({
        tripType,
        departureDate,
        returnDate,
        hotelNights: geminiNights,
        stayNights,
      }) ??
      fallback.hotelNights ??
      null;

    const notes = Array.isArray(obj.notes)
      ? obj.notes.filter((n): n is string => typeof n === 'string')
      : [];
    if (originResolved?.mappedFrom) notes.push(originResolved.mappedFrom);
    if (destinationResolved?.mappedFrom) {
      notes.push(destinationResolved.mappedFrom);
    }

    const modelQuestion =
      typeof obj.clarifyingQuestion === 'string'
        ? obj.clarifyingQuestion.trim()
        : null;

    const destinationIata =
      destinationResolved?.iata ?? fallback.destinationIata ?? null;
    const destinationCityResolved =
      destinationResolved?.city ??
      destinationCity ??
      fallback.destinationCity ??
      null;

    const result = finalizeTravelIntent(
      {
        isTravelRequest: true,
        originIata:
          bookingMode === 'HOTELS'
            ? null
            : (originResolved?.iata ?? null),
        destinationIata,
        originCity:
          bookingMode === 'HOTELS'
            ? null
            : (originResolved?.city ?? originCity),
        destinationCity: destinationCityResolved,
        departureDate,
        returnDate,
        tripType,
        hotelNights,
        adults,
        source: this.llmSource(),
        notes,
        clarifyingQuestion: modelQuestion,
      },
      bookingMode,
    );

    // Empty / unusable LLM output → heuristic backup only.
    const hasHotelSignal =
      Boolean(result.destinationIata) ||
      Boolean(result.destinationCity?.trim()) ||
      Boolean(result.departureDate) ||
      Boolean(result.hotelNights);
    if (
      bookingMode === 'HOTELS'
        ? !hasHotelSignal
        : !result.originIata &&
          !result.destinationIata &&
          !result.departureDate &&
          !result.tripType
    ) {
      return fallback;
    }
    return result;
  }

  private llmSource(): 'gemini' | 'groq' {
    return this.aiProvider.name === 'groq' ? 'groq' : 'gemini';
  }

  private resolveFlights(
    dto: RecommendItineraryDto,
    trip: TripForAi,
  ): ShortlistFlightOfferDto[] {
    if (dto.flights && dto.flights.length > 0) {
      return dto.flights;
    }

    return trip.flightOfferSnapshots.map((snap) => ({
      id: snap.id,
      providerOfferId: snap.providerOfferId ?? undefined,
      origin: snap.origin ?? undefined,
      destination: snap.destination ?? undefined,
      priceAmount:
        snap.priceAmount === null || snap.priceAmount === undefined
          ? null
          : Number(snap.priceAmount),
      currency: snap.currency ?? undefined,
      travelClass: snap.travelClass ?? undefined,
      summary:
        snap.origin && snap.destination
          ? `${snap.origin}→${snap.destination}`
          : undefined,
    }));
  }

  private resolveHotels(
    dto: RecommendItineraryDto,
    trip: TripForAi,
  ): ShortlistHotelOfferDto[] {
    if (dto.hotels && dto.hotels.length > 0) {
      return dto.hotels;
    }

    return trip.hotelOfferSnapshots.map((snap) => ({
      id: snap.id,
      providerOfferId: snap.providerOfferId ?? undefined,
      hotelName: snap.hotelName?.trim() || 'Hotel',
      city: snap.city ?? undefined,
      priceAmount:
        snap.priceAmount === null || snap.priceAmount === undefined
          ? null
          : Number(snap.priceAmount),
      currency: snap.currency ?? undefined,
      summary: snap.hotelName ?? undefined,
    }));
  }

  private parseAndValidate(
    text: string,
    flights: ShortlistFlightOfferDto[],
    hotels: ShortlistHotelOfferDto[],
    currency: string,
  ): RecommendationResultDto {
    const parsed = parseJsonObject(text);
    const flightIds = new Set(flights.map((f) => f.id));
    const hotelIds = new Set(hotels.map((h) => h.id));

    const recommendedFlightId = asNullableId(
      parsed.recommendedFlightId,
      flightIds,
    );
    const recommendedHotelId = asNullableId(
      parsed.recommendedHotelId,
      hotelIds,
    );

    if (
      flights.length > 0 &&
      recommendedFlightId === null &&
      typeof parsed.recommendedFlightId === 'string' &&
      parsed.recommendedFlightId.length > 0
    ) {
      throw new BadRequestException(
        'AI returned an unknown recommendedFlightId',
      );
    }

    if (
      hotels.length > 0 &&
      recommendedHotelId === null &&
      typeof parsed.recommendedHotelId === 'string' &&
      parsed.recommendedHotelId.length > 0
    ) {
      throw new BadRequestException(
        'AI returned an unknown recommendedHotelId',
      );
    }

    const reasoning =
      typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : 'Recommendation generated without detailed reasoning.';

    const tradeoffs =
      typeof parsed.tradeoffs === 'string' && parsed.tradeoffs.trim()
        ? parsed.tradeoffs.trim()
        : null;

    const estimatedTotal =
      typeof parsed.estimatedTotal === 'number' &&
      Number.isFinite(parsed.estimatedTotal)
        ? parsed.estimatedTotal
        : null;

    const responseCurrency =
      typeof parsed.currency === 'string' && parsed.currency.trim()
        ? parsed.currency.trim().toUpperCase()
        : currency;

    const alternativesRaw = Array.isArray(parsed.alternatives)
      ? parsed.alternatives
      : [];

    const alternatives = alternativesRaw.slice(0, 5).map((alt, index) => {
      const row =
        typeof alt === 'object' && alt !== null
          ? (alt as Record<string, unknown>)
          : {};
      return {
        flightOfferId: asNullableId(row.flightOfferId, flightIds),
        hotelOfferId: asNullableId(row.hotelOfferId, hotelIds),
        label:
          typeof row.label === 'string' && row.label.trim()
            ? row.label.trim()
            : `alternative ${index + 1}`,
        estimatedTotal:
          typeof row.estimatedTotal === 'number' &&
          Number.isFinite(row.estimatedTotal)
            ? row.estimatedTotal
            : null,
        rationale:
          typeof row.rationale === 'string' && row.rationale.trim()
            ? row.rationale.trim()
            : 'No rationale provided.',
      };
    });

    return {
      recommendedFlightId,
      recommendedHotelId,
      estimatedTotal,
      currency: responseCurrency,
      reasoning,
      tradeoffs,
      alternatives,
    };
  }

  private async findAccessibleTrip(
    actor: RequestUser,
    id: string,
  ): Promise<TripForAi> {
    const trip = await this.prisma.trip.findFirst({
      where: { id, deletedAt: null },
      include: {
        travelers: { select: { id: true, employeeId: true } },
        flightOfferSnapshots: {
          orderBy: { createdAt: 'desc' },
        },
        hotelOfferSnapshots: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    assertCompanyAccess(actor, trip.companyId);

    if (actor.role === UserRole.EMPLOYEE) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          companyId: trip.companyId,
          userId: actor.id,
          deletedAt: null,
        },
        select: { id: true },
      });

      const isTraveler = employee
        ? trip.travelers.some((t) => t.employeeId === employee.id)
        : false;
      const isCreator = trip.createdByUserId === actor.id;

      if (!isTraveler && !isCreator) {
        throw new ForbiddenException('Cross-tenant access is not allowed');
      }
    }

    return trip;
  }

  private assertRateLimit(userId: string): void {
    if (!this.rateLimiter.tryConsume(`ai:${userId}`)) {
      throw new HttpException(
        'AI recommendation rate limit exceeded. Try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

type TripForAi = {
  id: string;
  companyId: string;
  createdByUserId: string;
  purpose: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  startDate: Date;
  endDate: Date;
  budgetAmount: Prisma.Decimal | null;
  budgetCurrency: string;
  travelers: Array<{ id: string; employeeId: string }>;
  flightOfferSnapshots: Array<{
    id: string;
    providerOfferId: string | null;
    origin: string | null;
    destination: string | null;
    priceAmount: Prisma.Decimal | null;
    currency: string | null;
    travelClass: string | null;
  }>;
  hotelOfferSnapshots: Array<{
    id: string;
    providerOfferId: string | null;
    hotelName: string | null;
    city: string | null;
    priceAmount: Prisma.Decimal | null;
    currency: string | null;
  }>;
};

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function asIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const padded = trimmed.replace(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    (_, y, m, d) =>
      `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(padded)) return null;
  const date = new Date(`${padded}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== padded) return null;
  return padded;
}

function sanitizePolicy(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const copy = { ...(value as Record<string, unknown>) };
  for (const key of Object.keys(copy)) {
    const lower = key.toLowerCase();
    if (
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('apiKey'.toLowerCase()) ||
      lower.includes('apikey')
    ) {
      delete copy[key];
    }
  }
  return copy;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new BadRequestException('AI returned non-JSON output');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadRequestException('AI returned invalid JSON shape');
  }

  return parsed as Record<string, unknown>;
}

function asNullableId(
  value: unknown,
  allowed: Set<string>,
): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const id = value.trim();
  return allowed.has(id) ? id : null;
}

function normalizeStoredRecommendation(
  value: Prisma.JsonValue,
): RecommendationResultDto {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      recommendedFlightId: null,
      recommendedHotelId: null,
      estimatedTotal: null,
      currency: 'EUR',
      reasoning: 'Stored recommendation was empty.',
      tradeoffs: null,
      alternatives: [],
    };
  }

  const row = value as Record<string, unknown>;
  return {
    recommendedFlightId:
      typeof row.recommendedFlightId === 'string'
        ? row.recommendedFlightId
        : null,
    recommendedHotelId:
      typeof row.recommendedHotelId === 'string'
        ? row.recommendedHotelId
        : null,
    estimatedTotal:
      typeof row.estimatedTotal === 'number' ? row.estimatedTotal : null,
    currency:
      typeof row.currency === 'string' ? row.currency : 'EUR',
    reasoning:
      typeof row.reasoning === 'string'
        ? row.reasoning
        : 'Stored recommendation.',
    tradeoffs: typeof row.tradeoffs === 'string' ? row.tradeoffs : null,
    alternatives: Array.isArray(row.alternatives)
      ? row.alternatives.map((alt, index) => {
          const item =
            typeof alt === 'object' && alt !== null
              ? (alt as Record<string, unknown>)
              : {};
          return {
            flightOfferId:
              typeof item.flightOfferId === 'string'
                ? item.flightOfferId
                : null,
            hotelOfferId:
              typeof item.hotelOfferId === 'string' ? item.hotelOfferId : null,
            label:
              typeof item.label === 'string'
                ? item.label
                : `alternative ${index + 1}`,
            estimatedTotal:
              typeof item.estimatedTotal === 'number'
                ? item.estimatedTotal
                : null,
            rationale:
              typeof item.rationale === 'string'
                ? item.rationale
                : 'No rationale provided.',
          };
        })
      : [],
  };
}
