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

export const SYSTEM_INSTRUCTION = `You are SeeSight's business travel assistant.
Recommend the best flight and hotel combination from the provided shortlist only.
Return JSON only — never markdown or prose outside JSON.
Do not invent offer ids. Every id must come from the input lists.
Never request or echo passwords, tokens, emails, or passport numbers.
Prefer cost efficiency while noting duration/convenience tradeoffs.`;

export function buildUserPrompt(input: {
  trip: PromptTripContext;
  flights: ShortlistFlightOfferDto[];
  hotels: ShortlistHotelOfferDto[];
}): string {
  const payload = {
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
      estimatedTotal: 'number | null',
      currency: 'string',
      reasoning: 'string — human-readable, cite offer ids',
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
