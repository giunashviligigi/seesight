import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RequestUser } from '../auth/types/auth.types';
import { SerpApiClient } from './serpapi.client';
import {
  SlidingWindowRateLimiter,
  TtlCache,
} from './travel-search.cache';
import {
  SearchFlightsQueryDto,
  SearchHotelsQueryDto,
} from './dto/travel-search-query.dto';
import {
  FlightOfferDto,
  FlightSearchResponseDto,
  HotelOfferDto,
  HotelSearchResponseDto,
} from './dto/travel-search-response.dto';

type SerpFlightLeg = {
  departure_airport?: { id?: string; time?: string; name?: string };
  arrival_airport?: { id?: string; time?: string; name?: string };
  airline?: string;
  flight_number?: string;
  travel_class?: string;
  duration?: number;
};

type SerpFlightOption = {
  flights?: SerpFlightLeg[];
  layovers?: unknown[];
  total_duration?: number;
  price?: number;
  type?: string;
  airline_logo?: string;
  booking_token?: string;
  departure_token?: string;
};

type SerpFlightsResponse = {
  best_flights?: SerpFlightOption[];
  other_flights?: SerpFlightOption[];
  search_parameters?: { currency?: string };
};

type SerpHotelProperty = {
  type?: string;
  name?: string;
  property_token?: string;
  extracted_hotel_class?: number;
  hotel_class?: number | string;
  overall_rating?: number;
  rate_per_night?: { extracted_lowest?: number };
  total_rate?: { extracted_lowest?: number };
  amenities?: string[];
  images?: Array<{ thumbnail?: string }>;
  gps_coordinates?: { latitude?: number; longitude?: number };
  description?: string;
};

type SerpHotelsResponse = {
  properties?: SerpHotelProperty[];
  ads?: SerpHotelProperty[];
  search_parameters?: { currency?: string; q?: string };
};

@Injectable()
export class TravelSearchService {
  private readonly logger = new Logger(TravelSearchService.name);
  private readonly cache: TtlCache;
  private readonly rateLimiter: SlidingWindowRateLimiter;

  constructor(
    private readonly serpApi: SerpApiClient,
    private readonly config: ConfigService,
  ) {
    const ttl = this.config.get<number>('serpapi.cacheTtlMs') ?? 60_000;
    const limit =
      this.config.get<number>('serpapi.rateLimitPerMinute') ?? 30;
    this.cache = new TtlCache(ttl);
    this.rateLimiter = new SlidingWindowRateLimiter(limit);
  }

  async searchFlights(
    actor: RequestUser,
    query: SearchFlightsQueryDto,
  ): Promise<FlightSearchResponseDto> {
    this.assertRateLimit(actor.id);

    const origin = query.origin.toUpperCase();
    const destination = query.destination.toUpperCase();
    const adults = query.adults ?? 1;
    const currency = (query.currency ?? 'EUR').toUpperCase();
    const travelClass = query.travelClass ?? 'economy';
    const isRoundTrip = Boolean(query.returnDate);

    const cacheKey = TtlCache.hashKey({
      kind: 'flights',
      origin,
      destination,
      departureDate: query.departureDate,
      returnDate: query.returnDate ?? null,
      adults,
      travelClass,
      currency,
    });

    const cached = this.cache.get<FlightOfferDto[]>(cacheKey);
    if (cached) {
      return { items: cached, cached: true, provider: 'SERPAPI' };
    }

    const travelClassMap: Record<string, number> = {
      economy: 1,
      premium_economy: 2,
      business: 3,
      first: 4,
    };

    const raw = await this.serpApi.search<SerpFlightsResponse>({
      engine: 'google_flights',
      departure_id: origin,
      arrival_id: destination,
      outbound_date: query.departureDate,
      return_date: query.returnDate,
      adults,
      currency,
      hl: 'en',
      type: isRoundTrip ? 1 : 2,
      travel_class: travelClassMap[travelClass] ?? 1,
    });

    const options = [
      ...(raw.best_flights ?? []),
      ...(raw.other_flights ?? []),
    ].slice(0, 20);

    const items = options.map((option, index) =>
      this.normalizeFlight(
        option,
        origin,
        destination,
        currency,
        index,
      ),
    );

    this.cache.set(cacheKey, items);
    return { items, cached: false, provider: 'SERPAPI' };
  }

  async searchHotels(
    actor: RequestUser,
    query: SearchHotelsQueryDto,
  ): Promise<HotelSearchResponseDto> {
    this.assertRateLimit(actor.id);

    const city = query.city.trim();
    const adults = query.adults ?? 1;
    const currency = (query.currency ?? 'EUR').toUpperCase();

    const cacheKey = TtlCache.hashKey({
      kind: 'hotels',
      city: city.toLowerCase(),
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      adults,
      currency,
    });

    const cached = this.cache.get<HotelOfferDto[]>(cacheKey);
    if (cached) {
      return { items: cached, cached: true, provider: 'SERPAPI' };
    }

    const raw = await this.serpApi.search<SerpHotelsResponse>({
      engine: 'google_hotels',
      q: city,
      check_in_date: query.checkIn,
      check_out_date: query.checkOut,
      adults,
      children: 0,
      currency,
      hl: 'en',
      gl: 'us',
    });

    const properties = (raw.properties ?? [])
      .filter((p) => p.name && p.property_token)
      .slice(0, 20);

    const items = properties.map((property) =>
      this.normalizeHotel(
        property,
        city,
        query.checkIn,
        query.checkOut,
        currency,
      ),
    );

    this.cache.set(cacheKey, items);
    return { items, cached: false, provider: 'SERPAPI' };
  }

  private assertRateLimit(userId: string): void {
    if (!this.rateLimiter.tryConsume(userId)) {
      throw new HttpException(
        'Travel search rate limit exceeded. Try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private normalizeFlight(
    option: SerpFlightOption,
    fallbackOrigin: string,
    fallbackDestination: string,
    currency: string,
    index: number,
  ): FlightOfferDto {
    const legs = option.flights ?? [];
    const first = legs[0];
    const last = legs[legs.length - 1];
    const origin = first?.departure_airport?.id ?? fallbackOrigin;
    const destination = last?.arrival_airport?.id ?? fallbackDestination;
    const departAt = first?.departure_airport?.time
      ? this.toIsoDateTime(first.departure_airport.time)
      : null;
    const returnAt =
      option.type?.toLowerCase().includes('round') && last?.arrival_airport?.time
        ? this.toIsoDateTime(last.arrival_airport.time)
        : null;

    const flightNumbers = legs
      .map((leg) => leg.flight_number)
      .filter((v): v is string => Boolean(v));
    const airline = first?.airline ?? null;
    const stops = Math.max(0, legs.length - 1);
    const providerOfferId =
      option.booking_token ||
      option.departure_token ||
      this.hashId(['flight', origin, destination, departAt, index]);

    const summary = [
      airline ?? 'Flight',
      flightNumbers.join(' / ') || null,
      `${origin} → ${destination}`,
      option.price != null ? `${option.price} ${currency}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      id: providerOfferId,
      provider: 'SERPAPI',
      providerOfferId,
      origin,
      destination,
      departAt,
      returnAt,
      airline,
      flightNumbers,
      stops,
      totalDurationMinutes: option.total_duration ?? null,
      travelClass: first?.travel_class ?? null,
      priceAmount: option.price ?? null,
      currency,
      summary,
      rawPayload: {
        source: 'serpapi_google_flights',
        type: option.type ?? null,
        flights: legs,
        layovers: option.layovers ?? [],
        total_duration: option.total_duration ?? null,
        price: option.price ?? null,
        booking_token: option.booking_token ?? null,
      },
    };
  }

  private normalizeHotel(
    property: SerpHotelProperty,
    city: string,
    checkIn: string,
    checkOut: string,
    currency: string,
  ): HotelOfferDto {
    const providerOfferId = property.property_token as string;
    const stars =
      typeof property.extracted_hotel_class === 'number'
        ? property.extracted_hotel_class
        : typeof property.hotel_class === 'number'
          ? property.hotel_class
          : null;
    const priceAmount =
      property.total_rate?.extracted_lowest ??
      property.rate_per_night?.extracted_lowest ??
      null;

    const summary = [
      property.name,
      stars ? `${stars}★` : null,
      priceAmount != null ? `${priceAmount} ${currency}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      id: providerOfferId,
      provider: 'SERPAPI',
      providerOfferId,
      hotelName: property.name ?? 'Hotel',
      city,
      checkIn,
      checkOut,
      stars,
      rating: property.overall_rating ?? null,
      priceAmount,
      currency,
      amenities: property.amenities ?? [],
      thumbnail: property.images?.[0]?.thumbnail ?? null,
      summary,
      rawPayload: {
        source: 'serpapi_google_hotels',
        type: property.type ?? null,
        name: property.name,
        property_token: property.property_token,
        overall_rating: property.overall_rating ?? null,
        rate_per_night: property.rate_per_night ?? null,
        total_rate: property.total_rate ?? null,
        amenities: property.amenities ?? [],
        description: property.description ?? null,
      },
    };
  }

  private toIsoDateTime(value: string): string | null {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      this.logger.warn(`Unable to parse datetime: ${value}`);
      return null;
    }
    return date.toISOString();
  }

  private hashId(parts: Array<string | number | null | undefined>): string {
    return createHash('sha256')
      .update(parts.map((p) => String(p ?? '')).join('|'))
      .digest('hex')
      .slice(0, 24);
  }
}
