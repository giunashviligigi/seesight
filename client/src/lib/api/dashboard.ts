import { apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";

export type DashboardScope = "company" | "self";

export type DashboardUpcomingTrip = {
  id: string;
  purpose: string;
  destinationCountry: string | null;
  destinationCity: string | null;
  startDate: string;
  endDate: string;
  status: string;
};

export type DashboardSummary = {
  companyId: string;
  scope: DashboardScope;
  upcomingTripsCount: number;
  upcomingTrips: DashboardUpcomingTrip[];
  totalTravelSpending: {
    amount: number;
    currency: string;
    periodFrom: string;
    periodTo: string;
  };
  activeEmployeesCount: number;
  pendingApprovalsCount: number;
  statistics: {
    tripsThisMonth: number;
    averageTripCost: number;
  };
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

export const dashboardApi = {
  summary(
    params?: { from?: string; to?: string; companyId?: string },
    accessToken?: string | null,
  ) {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.companyId) query.set("companyId", params.companyId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<DashboardSummary>(`/dashboard/summary${suffix}`, {
      accessToken: authToken(accessToken),
    });
  },
};
