import {
  RecommendationAlternativeDto,
  RecommendationResultDto,
} from './dto/recommendation-response.dto';
import {
  ShortlistFlightOfferDto,
  ShortlistHotelOfferDto,
} from './dto/recommend-itinerary.dto';

export function ruleBasedRecommend(
  flights: ShortlistFlightOfferDto[],
  hotels: ShortlistHotelOfferDto[],
  currency: string,
): RecommendationResultDto {
  const cheapestFlight = pickMin(flights, (f) => f.priceAmount ?? Number.POSITIVE_INFINITY);
  const shortestFlight = pickMin(
    flights,
    (f) => f.totalDurationMinutes ?? Number.POSITIVE_INFINITY,
  );
  const cheapestHotel = pickMin(hotels, (h) => h.priceAmount ?? Number.POSITIVE_INFINITY);

  const recommendedFlightId = cheapestFlight?.id ?? shortestFlight?.id ?? null;
  const recommendedHotelId = cheapestHotel?.id ?? null;

  const flightPrice = cheapestFlight?.priceAmount ?? null;
  const hotelPrice = cheapestHotel?.priceAmount ?? null;
  const estimatedTotal =
    flightPrice === null && hotelPrice === null
      ? null
      : (flightPrice ?? 0) + (hotelPrice ?? 0);

  const alternatives: RecommendationAlternativeDto[] = [];

  if (
    shortestFlight &&
    cheapestFlight &&
    shortestFlight.id !== cheapestFlight.id
  ) {
    const shortTotal =
      (shortestFlight.priceAmount ?? 0) + (hotelPrice ?? 0);
    alternatives.push({
      flightOfferId: shortestFlight.id,
      hotelOfferId: recommendedHotelId,
      label: 'shortest flight',
      estimatedTotal:
        shortestFlight.priceAmount == null && hotelPrice == null
          ? null
          : shortTotal,
      rationale:
        'Faster itinerary with a potentially higher flight price than the cheapest option.',
    });
  }

  if (flights.length > 1 || hotels.length > 1) {
    const nextFlight =
      flights.find((f) => f.id !== recommendedFlightId) ?? null;
    const nextHotel = hotels.find((h) => h.id !== recommendedHotelId) ?? null;
    if (nextFlight || nextHotel) {
      const flightPart = (nextFlight ?? cheapestFlight)?.priceAmount ?? null;
      const hotelPart = (nextHotel ?? cheapestHotel)?.priceAmount ?? null;
      alternatives.push({
        flightOfferId: nextFlight?.id ?? recommendedFlightId,
        hotelOfferId: nextHotel?.id ?? recommendedHotelId,
        label: 'alternative combo',
        estimatedTotal:
          flightPart == null && hotelPart == null
            ? null
            : (flightPart ?? 0) + (hotelPart ?? 0),
        rationale:
          'Secondary combination for comparison against the primary pick.',
      });
    }
  }

  const reasoningParts: string[] = [];
  if (cheapestFlight) {
    reasoningParts.push(
      `Selected flight ${cheapestFlight.id} as the lowest-priced option` +
        (cheapestFlight.priceAmount != null
          ? ` (${cheapestFlight.priceAmount} ${cheapestFlight.currency ?? currency})`
          : '') +
        '.',
    );
  }
  if (cheapestHotel) {
    reasoningParts.push(
      `Selected hotel ${cheapestHotel.id} (${cheapestHotel.hotelName}) as the lowest-priced stay` +
        (cheapestHotel.priceAmount != null
          ? ` (${cheapestHotel.priceAmount} ${cheapestHotel.currency ?? currency})`
          : '') +
        '.',
    );
  }
  if (reasoningParts.length === 0) {
    reasoningParts.push(
      'No priced offers were available; returning an empty structured recommendation.',
    );
  }

  let tradeoffs: string | null = null;
  if (
    shortestFlight &&
    cheapestFlight &&
    shortestFlight.id !== cheapestFlight.id
  ) {
    tradeoffs = `Cheapest flight ${cheapestFlight.id} vs shortest flight ${shortestFlight.id}.`;
  }

  return {
    recommendedFlightId,
    recommendedHotelId,
    estimatedTotal,
    currency,
    reasoning: reasoningParts.join(' '),
    tradeoffs,
    alternatives: alternatives.slice(0, 3),
  };
}

function pickMin<T>(
  items: T[],
  score: (item: T) => number,
): T | undefined {
  if (items.length === 0) {
    return undefined;
  }
  let best = items[0];
  let bestScore = score(best);
  for (let i = 1; i < items.length; i += 1) {
    const next = score(items[i]);
    if (next < bestScore) {
      best = items[i];
      bestScore = next;
    }
  }
  if (!Number.isFinite(bestScore)) {
    return items[0];
  }
  return best;
}
