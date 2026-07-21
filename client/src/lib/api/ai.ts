import { apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";

export type RecommendationAlternative = {
  flightOfferId: string | null;
  hotelOfferId: string | null;
  label: string;
  estimatedTotal: number | null;
  rationale: string;
};

export type RecommendationResult = {
  recommendedFlightId: string | null;
  recommendedHotelId: string | null;
  estimatedTotal: number | null;
  currency: string;
  reasoning: string;
  tradeoffs: string | null;
  alternatives: RecommendationAlternative[];
};

export type RecommendItineraryResponse = {
  id: string;
  tripId: string;
  provider: string;
  source: "gemini" | "rule_based";
  promptSummary: string | null;
  recommendation: RecommendationResult;
  createdAt: string;
};

export type RecommendationHistoryResponse = {
  items: RecommendItineraryResponse[];
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

export type ParseTravelIntentResponse = {
  originIata: string | null;
  destinationIata: string | null;
  originCity: string | null;
  destinationCity: string | null;
  departureDate: string | null;
  returnDate: string | null;
  tripType?: "one_way" | "round_trip" | null;
  adults: number | null;
  source: "gemini" | "heuristic";
  notes: string[];
  clarifyingQuestion?: string | null;
};

export const aiApi = {
  recommendItinerary(
    body: {
      tripId: string;
      flights?: Array<{
        id: string;
        providerOfferId?: string;
        origin?: string;
        destination?: string;
        airline?: string;
        stops?: number;
        totalDurationMinutes?: number | null;
        priceAmount?: number | null;
        currency?: string;
        travelClass?: string | null;
        summary?: string;
      }>;
      hotels?: Array<{
        id: string;
        providerOfferId?: string;
        hotelName: string;
        city?: string | null;
        stars?: number | null;
        priceAmount?: number | null;
        currency?: string;
        summary?: string;
      }>;
    },
    accessToken?: string | null,
  ) {
    return apiRequest<RecommendItineraryResponse>("/ai/recommend-itinerary", {
      method: "POST",
      body,
      accessToken: authToken(accessToken),
    });
  },

  parseTravelIntent(
    body: {
      prompt: string;
      referenceDate?: string;
      clarificationAnswer?: string;
      clarificationFocus?: "origin" | "destination" | "departureDate";
    },
    accessToken?: string | null,
  ) {
    return apiRequest<ParseTravelIntentResponse>("/ai/parse-travel-intent", {
      method: "POST",
      body,
      accessToken: authToken(accessToken),
    });
  },

  listRecommendations(tripId: string, accessToken?: string | null) {
    return apiRequest<RecommendationHistoryResponse>(
      `/ai/trips/${tripId}/recommendations`,
      { accessToken: authToken(accessToken) },
    );
  },
};
