import { API_BASE_URL, ApiError, apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";

export type ReportsSummary = {
  companyId: string;
  periodFrom: string;
  periodTo: string;
  currency: string;
  totalSpend: number;
  tripCount: number;
  tripsWithSpend: number;
  averageTripCost: number;
  monthlySpending: Array<{ month: string; amount: number; tripCount: number }>;
  tripsByDepartment: Array<{
    departmentId: string | null;
    departmentName: string;
    tripCount: number;
  }>;
  topCountries: Array<{
    label: string;
    country: string | null;
    city: string | null;
    tripCount: number;
  }>;
  topCities: Array<{
    label: string;
    country: string | null;
    city: string | null;
    tripCount: number;
  }>;
  maxRangeMonths: number;
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

function buildQuery(params?: {
  from?: string;
  to?: string;
  companyId?: string;
  format?: "json" | "csv";
  dataset?: "summary" | "monthly" | "departments" | "destinations";
}) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.companyId) query.set("companyId", params.companyId);
  if (params?.format) query.set("format", params.format);
  if (params?.dataset) query.set("dataset", params.dataset);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return suffix;
}

export const reportsApi = {
  summary(
    params?: { from?: string; to?: string; companyId?: string },
    accessToken?: string | null,
  ) {
    return apiRequest<ReportsSummary>(`/reports/summary${buildQuery(params)}`, {
      accessToken: authToken(accessToken),
    });
  },

  async downloadCsv(
    params?: {
      from?: string;
      to?: string;
      companyId?: string;
      dataset?: "summary" | "monthly" | "departments" | "destinations";
    },
    accessToken?: string | null,
  ) {
    const token = authToken(accessToken);
    const suffix = buildQuery({ ...params, format: "csv" });
    const response = await fetch(`${API_BASE_URL}/reports/export${suffix}`, {
      method: "GET",
      headers: {
        Accept: "text/csv",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });

    if (!response.ok) {
      const text = await response.text();
      let message = "Export failed";
      try {
        const data = JSON.parse(text) as { message?: string | string[] };
        if (typeof data.message === "string") message = data.message;
        else if (Array.isArray(data.message)) message = data.message.join(", ");
      } catch {
        // keep default
      }
      throw new ApiError(message, response.status, text);
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? "seesight-reports.csv";
    return { blob, filename };
  },
};
