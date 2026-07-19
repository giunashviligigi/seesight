import { apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";

export type FlightOffer = {
  id: string;
  provider: string;
  providerOfferId: string;
  origin: string;
  destination: string;
  departAt: string | null;
  arriveAt: string | null;
  returnAt: string | null;
  returnDepartAt: string | null;
  returnArriveAt: string | null;
  tripType: "one_way" | "round_trip";
  airline: string | null;
  flightNumbers: string[];
  stops: number;
  totalDurationMinutes: number | null;
  outboundDurationMinutes: number | null;
  returnDurationMinutes: number | null;
  travelClass: string | null;
  priceAmount: number | null;
  currency: string | null;
  summary: string;
  rawPayload: Record<string, unknown>;
};

export type HotelOffer = {
  id: string;
  provider: string;
  providerOfferId: string;
  hotelName: string;
  city: string | null;
  checkIn: string;
  checkOut: string;
  stars: number | null;
  rating: number | null;
  priceAmount: number | null;
  currency: string | null;
  amenities: string[];
  thumbnail: string | null;
  images: string[];
  description: string | null;
  address: string | null;
  summary: string;
  rawPayload: Record<string, unknown>;
};

export type FlightSearchResponse = {
  items: FlightOffer[];
  cached: boolean;
  provider: string;
};

export type HotelSearchResponse = {
  items: HotelOffer[];
  cached: boolean;
  provider: string;
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

export const travelApi = {
  searchFlights(
    params: {
      origin: string;
      destination: string;
      departureDate: string;
      returnDate?: string;
      adults?: number;
      travelClass?: string;
      currency?: string;
    },
    accessToken?: string | null,
  ) {
    const query = new URLSearchParams();
    query.set("origin", params.origin);
    query.set("destination", params.destination);
    query.set("departureDate", params.departureDate);
    if (params.returnDate) query.set("returnDate", params.returnDate);
    if (params.adults) query.set("adults", String(params.adults));
    if (params.travelClass) query.set("travelClass", params.travelClass);
    if (params.currency) query.set("currency", params.currency);
    return apiRequest<FlightSearchResponse>(`/travel/flights?${query.toString()}`, {
      accessToken: authToken(accessToken),
    });
  },

  searchHotels(
    params: {
      city: string;
      checkIn: string;
      checkOut: string;
      adults?: number;
      currency?: string;
    },
    accessToken?: string | null,
  ) {
    const query = new URLSearchParams();
    query.set("city", params.city);
    query.set("checkIn", params.checkIn);
    query.set("checkOut", params.checkOut);
    if (params.adults) query.set("adults", String(params.adults));
    if (params.currency) query.set("currency", params.currency);
    return apiRequest<HotelSearchResponse>(`/travel/hotels?${query.toString()}`, {
      accessToken: authToken(accessToken),
    });
  },
};
