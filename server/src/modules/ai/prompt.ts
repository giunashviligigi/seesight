import {
  ShortlistFlightOfferDto,
  ShortlistHotelOfferDto,
} from './dto/recommend-itinerary.dto';

export type PromptTripContext = {
  purpose: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  startDate: string;
  endDate: string;
  budgetAmount: number | null;
  budgetCurrency: string;
  travelerCount: number;
  policyStub: Record<string, unknown> | null;
};

export const SYSTEM_INSTRUCTION = `You are SeeSight's business travel assistant for company trips.
Pick the best flight + hotel combo STRICTLY from the provided shortlist.
Return JSON only — never markdown fences or extra prose.
Rules:
1) Every recommended/alternative id MUST exactly match an input flights[].id or hotels[].id.
2) Prefer the lowest total cost (flight price + hotel price) when quality is similar.
3) Prefer fewer stops and reasonable duration unless the cheaper option is dramatically better value.
4) Prefer hotels with better rating/stars when prices are close.
5) Respect trip budgetAmount when present — flag overspend in tradeoffs.
6) reasoning must name airline/route and hotel by human-readable summary text, not only raw ids.
7) estimatedTotal must equal recommended flight priceAmount + hotel priceAmount when both exist.
8) Never invent offers, prices, airports, or dates.`;

export function buildUserPrompt(input: {
  trip: PromptTripContext;
  flights: ShortlistFlightOfferDto[];
  hotels: ShortlistHotelOfferDto[];
}): string {
  const payload = {
    task: 'Choose one flight id and one hotel id that form the best business itinerary.',
    rankingPriority: [
      'stay within budget when possible',
      'minimize total price',
      'prefer direct or fewer stops',
      'prefer shorter totalDurationMinutes when price delta is small',
      'prefer higher hotel stars/rating when price delta is small',
    ],
    trip: {
      purpose: input.trip.purpose,
      destinationCity: input.trip.destinationCity,
      destinationCountry: input.trip.destinationCountry,
      startDate: input.trip.startDate,
      endDate: input.trip.endDate,
      budgetAmount: input.trip.budgetAmount,
      budgetCurrency: input.trip.budgetCurrency,
      travelerCount: input.trip.travelerCount,
      policyStub: input.trip.policyStub,
    },
    flights: input.flights.map((f) => ({
      id: f.id,
      origin: f.origin ?? null,
      destination: f.destination ?? null,
      airline: f.airline ?? null,
      stops: f.stops ?? null,
      totalDurationMinutes: f.totalDurationMinutes ?? null,
      priceAmount: f.priceAmount ?? null,
      currency: f.currency ?? null,
      travelClass: f.travelClass ?? null,
      summary: f.summary ?? null,
    })),
    hotels: input.hotels.map((h) => ({
      id: h.id,
      hotelName: h.hotelName,
      city: h.city ?? null,
      stars: h.stars ?? null,
      priceAmount: h.priceAmount ?? null,
      currency: h.currency ?? null,
      summary: h.summary ?? null,
    })),
    responseSchema: {
      recommendedFlightId: 'string | null — must match a flights[].id',
      recommendedHotelId: 'string | null — must match a hotels[].id',
      estimatedTotal: 'number | null — sum of chosen flight+hotel prices',
      currency: 'string',
      reasoning:
        'string — plain language explaining why this combo wins; mention airline and hotel name',
      tradeoffs: 'string | null — cheapest vs shortest / convenience',
      alternatives: [
        {
          flightOfferId: 'string | null',
          hotelOfferId: 'string | null',
          label: 'string',
          estimatedTotal: 'number | null',
          rationale: 'string',
        },
      ],
    },
  };

  return `Select the best itinerary for this business trip.\n${JSON.stringify(payload)}`;
}

export function buildPromptSummary(input: {
  tripId: string;
  flightCount: number;
  hotelCount: number;
  destinationCity: string | null;
}): string {
  return `trip=${input.tripId}; dest=${input.destinationCity ?? 'n/a'}; flights=${input.flightCount}; hotels=${input.hotelCount}`;
}
