import { apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";

export type TripStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type TripTraveler = {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  departmentId: string | null;
  departmentName: string | null;
  isPrimary: boolean;
};

export type Trip = {
  id: string;
  companyId: string;
  createdByUserId: string;
  purpose: string;
  destinationCountry: string | null;
  destinationCity: string | null;
  startDate: string;
  endDate: string;
  budgetAmount: number | null;
  budgetCurrency: string;
  notes: string | null;
  status: TripStatus;
  travelers: TripTraveler[];
  approval: {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    decidedAt: string | null;
  } | null;
  flightOffers: Array<{
    id: string;
    provider: string;
    providerOfferId: string | null;
    origin: string | null;
    destination: string | null;
    departAt: string | null;
    returnAt: string | null;
    priceAmount: number | null;
    currency: string | null;
    selected: boolean;
  }>;
  hotelOffers: Array<{
    id: string;
    provider: string;
    providerOfferId: string | null;
    hotelName: string | null;
    city: string | null;
    checkIn: string | null;
    checkOut: string | null;
    priceAmount: number | null;
    currency: string | null;
    selected: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type TripListResponse = {
  items: Trip[];
  total: number;
  page: number;
  pageSize: number;
};

export type TripTravelerInput = {
  employeeId: string;
  isPrimary?: boolean;
};

export type CreateTripInput = {
  purpose?: string;
  destinationCountry?: string;
  destinationCity?: string;
  startDate?: string;
  endDate?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  notes?: string;
  travelers: TripTravelerInput[];
  companyId?: string;
};

export type UpdateTripInput = {
  purpose?: string;
  destinationCountry?: string | null;
  destinationCity?: string | null;
  startDate?: string;
  endDate?: string;
  budgetAmount?: number | null;
  budgetCurrency?: string;
  notes?: string | null;
  travelers?: TripTravelerInput[];
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

export const tripsApi = {
  list(
    params?: {
      companyId?: string;
      status?: TripStatus;
      from?: string;
      to?: string;
      departmentId?: string;
      page?: number;
      pageSize?: number;
    },
    accessToken?: string | null,
  ) {
    const query = new URLSearchParams();
    if (params?.companyId) query.set("companyId", params.companyId);
    if (params?.status) query.set("status", params.status);
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.departmentId) query.set("departmentId", params.departmentId);
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<TripListResponse>(`/trips${suffix}`, {
      accessToken: authToken(accessToken),
    });
  },

  getById(id: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/trips/${id}`, {
      accessToken: authToken(accessToken),
    });
  },

  create(input: CreateTripInput, accessToken?: string | null) {
    return apiRequest<Trip>("/trips", {
      method: "POST",
      body: input,
      accessToken: authToken(accessToken),
    });
  },

  update(id: string, input: UpdateTripInput, accessToken?: string | null) {
    return apiRequest<Trip>(`/trips/${id}`, {
      method: "PATCH",
      body: input,
      accessToken: authToken(accessToken),
    });
  },

  submit(id: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/trips/${id}/submit`, {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  cancel(id: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/trips/${id}/cancel`, {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  remove(id: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/trips/${id}`, {
      method: "DELETE",
      accessToken: authToken(accessToken),
    });
  },

  approve(id: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/trips/${id}/approve`, {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  reject(id: string, comment?: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/trips/${id}/reject`, {
      method: "POST",
      body: comment ? { comment } : {},
      accessToken: authToken(accessToken),
    });
  },

  start(id: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/trips/${id}/start`, {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  complete(id: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/trips/${id}/complete`, {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  reopen(id: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/trips/${id}/reopen`, {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  attachFlightOffer(
    id: string,
    input: {
      providerOfferId: string;
      origin: string;
      destination: string;
      departAt?: string | null;
      returnAt?: string | null;
      travelClass?: string | null;
      priceAmount?: number | null;
      currency?: string | null;
      rawPayload: Record<string, unknown>;
    },
    accessToken?: string | null,
  ) {
    return apiRequest<Trip>(`/trips/${id}/offers/flight`, {
      method: "POST",
      body: input,
      accessToken: authToken(accessToken),
    });
  },

  attachHotelOffer(
    id: string,
    input: {
      providerOfferId: string;
      hotelName: string;
      city?: string | null;
      checkIn: string;
      checkOut: string;
      priceAmount?: number | null;
      currency?: string | null;
      rawPayload: Record<string, unknown>;
    },
    accessToken?: string | null,
  ) {
    return apiRequest<Trip>(`/trips/${id}/offers/hotel`, {
      method: "POST",
      body: input,
      accessToken: authToken(accessToken),
    });
  },
};
