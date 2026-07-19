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
  images?: Array<{ thumbnail?: string; original_image?: string }>;
  gps_coordinates?: { latitude?: number; longitude?: number };
  description?: string;
  link?: string;
  address?: string;
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
    ].slice(0, isRoundTrip ? 6 : 20);

    const items: FlightOfferDto[] = [];
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      let returnOption: SerpFlightOption | null = null;

      if (isRoundTrip && option.departure_token) {
        try {
          const returnRaw = await this.serpApi.search<SerpFlightsResponse>({
            engine: 'google_flights',
            departure_id: origin,
            arrival_id: destination,
            outbound_date: query.departureDate,
            return_date: query.returnDate,
            adults,
            currency,
            hl: 'en',
            type: 1,
            travel_class: travelClassMap[travelClass] ?? 1,
            departure_token: option.departure_token,
          });
          const returns = [
            ...(returnRaw.best_flights ?? []),
            ...(returnRaw.other_flights ?? []),
          ];
          returnOption = this.pickCheapestFlightOption(returns);
        } catch (error) {
          this.logger.warn(
            `Unable to load return flights for outbound #${index}: ${
              error instanceof Error ? error.message : 'unknown'
            }`,
          );
        }
      }

      items.push(
        this.normalizeFlight(
          option,
          origin,
          destination,
          currency,
          index,
          isRoundTrip,
          returnOption,
        ),
      );
    }

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

  private pickCheapestFlightOption(
    options: SerpFlightOption[],
  ): SerpFlightOption | null {
    if (options.length === 0) return null;
    let best = options[0];
    let bestPrice = best.price ?? Number.POSITIVE_INFINITY;
    for (let i = 1; i < options.length; i += 1) {
      const price = options[i].price ?? Number.POSITIVE_INFINITY;
      if (price < bestPrice) {
        best = options[i];
        bestPrice = price;
      }
    }
    return best;
  }

  private normalizeFlight(
    option: SerpFlightOption,
    fallbackOrigin: string,
    fallbackDestination: string,
    currency: string,
    index: number,
    searchIsRoundTrip: boolean,
    returnOption: SerpFlightOption | null = null,
  ): FlightOfferDto {
    const outboundLegs = option.flights ?? [];
    const returnLegs = returnOption?.flights ?? [];
    const first = outboundLegs[0];
    const last = outboundLegs[outboundLegs.length - 1];
    const returnFirst = returnLegs[0];
    const returnLast = returnLegs[returnLegs.length - 1];

    const origin = first?.departure_airport?.id ?? fallbackOrigin;
    const destination = last?.arrival_airport?.id ?? fallbackDestination;
    const departAt = first?.departure_airport?.time
      ? this.toIsoDateTime(first.departure_airport.time)
      : null;
    const arriveAt = last?.arrival_airport?.time
      ? this.toIsoDateTime(last.arrival_airport.time)
      : null;
    const returnDepartAt = returnFirst?.departure_airport?.time
      ? this.toIsoDateTime(returnFirst.departure_airport.time)
      : null;
    const returnArriveAt = returnLast?.arrival_airport?.time
      ? this.toIsoDateTime(returnLast.arrival_airport.time)
      : null;

    const optionType = (option.type ?? '').toLowerCase();
    const tripType: 'one_way' | 'round_trip' =
      searchIsRoundTrip ||
      optionType.includes('round') ||
      optionType.includes('return') ||
      returnLegs.length > 0
        ? 'round_trip'
        : 'one_way';

    const allLegs = [...outboundLegs, ...returnLegs];
    const flightNumbers = allLegs
      .map((leg) => leg.flight_number)
      .filter((v): v is string => Boolean(v));
    const airlines = [
      ...new Set(
        allLegs
          .map((leg) => leg.airline)
          .filter((v): v is string => Boolean(v)),
      ),
    ];
    const airline = airlines.length > 0 ? airlines.join(' / ') : null;
    const stops = Math.max(
      0,
      outboundLegs.length - 1,
    ) + Math.max(0, returnLegs.length - 1);

    const vendorToken =
      returnOption?.booking_token ||
      option.booking_token ||
      option.departure_token ||
      null;
    const providerOfferId = this.hashId([
      'flight',
      origin,
      destination,
      departAt,
      arriveAt,
      returnDepartAt,
      returnArriveAt,
      returnOption?.price ?? option.price ?? null,
      vendorToken,
      index,
    ]);

    const priceAmount = returnOption?.price ?? option.price ?? null;
    const outboundDurationMinutes =
      option.total_duration != null && option.total_duration > 0
        ? option.total_duration
        : null;
    const returnDurationMinutes =
      returnOption?.total_duration != null && returnOption.total_duration > 0
        ? returnOption.total_duration
        : null;

    const tripLabel = tripType === 'round_trip' ? 'round trip' : 'one way';
    const summary = [
      airline ?? 'Flight',
      tripLabel,
      `${origin} → ${destination}`,
      priceAmount != null ? `${priceAmount} ${currency}` : null,
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
      arriveAt,
      returnAt: returnArriveAt,
      returnDepartAt,
      returnArriveAt,
      tripType,
      airline,
      flightNumbers,
      stops,
      totalDurationMinutes: outboundDurationMinutes,
      outboundDurationMinutes,
      returnDurationMinutes,
      travelClass: first?.travel_class ?? null,
      priceAmount,
      currency,
      summary,
      rawPayload: {
        source: 'serpapi_google_flights',
        type: option.type ?? null,
        tripType,
        flights: outboundLegs,
        return_flights: returnLegs,
        layovers: option.layovers ?? [],
        return_layovers: returnOption?.layovers ?? [],
        total_duration: option.total_duration ?? null,
        return_total_duration: returnOption?.total_duration ?? null,
        price: priceAmount,
        booking_token:
          returnOption?.booking_token ?? option.booking_token ?? null,
        departure_token: option.departure_token ?? null,
        airline_logo: option.airline_logo ?? null,
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
    const vendorToken = property.property_token as string;
    const providerOfferId =
      vendorToken.length <= 120
        ? vendorToken
        : this.hashId(['hotel', vendorToken]);
    const stars =
      typeof property.extracted_hotel_class === 'number'
        ? property.extracted_hotel_class
        : typeof property.hotel_class === 'number'
          ? property.hotel_class
          : null;

    const nights = nightsBetween(checkIn, checkOut);
    const totalFromVendor = property.total_rate?.extracted_lowest ?? null;
    const nightlyFromVendor = property.rate_per_night?.extracted_lowest ?? null;

    // Always expose stay total so UI/itinerary totals are comparable.
    let priceAmount: number | null = null;
    let pricePerNight: number | null = null;
    if (totalFromVendor != null) {
      priceAmount = totalFromVendor;
      pricePerNight =
        nightlyFromVendor ??
        Math.round((totalFromVendor / nights) * 100) / 100;
    } else if (nightlyFromVendor != null) {
      pricePerNight = nightlyFromVendor;
      priceAmount = Math.round(nightlyFromVendor * nights * 100) / 100;
    }

    const images = (property.images ?? [])
      .map((img) => img.original_image || img.thumbnail)
      .filter((url): url is string => Boolean(url));
    const thumbnail = images[0] ?? property.images?.[0]?.thumbnail ?? null;

    const summary = [
      property.name,
      stars ? `${stars}★` : null,
      priceAmount != null
        ? `${priceAmount} ${currency} · ${nights} night${nights === 1 ? '' : 's'}`
        : null,
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
      pricePerNight,
      nights,
      currency,
      amenities: property.amenities ?? [],
      thumbnail,
      images,
      description: property.description ?? null,
      address: property.address ?? null,
      summary,
      rawPayload: {
        source: 'serpapi_google_hotels',
        type: property.type ?? null,
        name: property.name,
        property_token: property.property_token,
        overall_rating: property.overall_rating ?? null,
        rate_per_night: property.rate_per_night ?? null,
        total_rate: property.total_rate ?? null,
        nights,
        amenities: property.amenities ?? [],
        description: property.description ?? null,
        address: property.address ?? null,
        link: property.link ?? null,
        images,
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

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00.000Z`);
  const end = Date.parse(`${checkOut}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 1;
  }
  return Math.max(1, Math.round((end - start) / 86_400_000));
}
