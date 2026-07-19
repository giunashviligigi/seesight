import { apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";

export type CompanyStatus = "ACTIVE" | "INACTIVE";

export type Company = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  country: string | null;
  billingEmail: string | null;
  /** Present on super-admin company list — who manages the tenant. */
  adminEmails?: string[];
  timezone: string;
  status: CompanyStatus;
  policyJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CompanyListResponse = {
  items: Company[];
  total: number;
  page: number;
  pageSize: number;
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

export const companiesApi = {
  create(
    input: {
      name: string;
      legalName?: string;
      slug?: string;
      country?: string;
      billingEmail?: string;
      timezone?: string;
      policyJson?: Record<string, unknown>;
    },
    accessToken?: string | null,
  ) {
    return apiRequest<Company>("/companies", {
      method: "POST",
      body: input,
      accessToken: authToken(accessToken),
    });
  },

  list(params?: { search?: string; page?: number; pageSize?: number }, accessToken?: string | null) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<CompanyListResponse>(`/companies${suffix}`, {
      accessToken: authToken(accessToken),
    });
  },

  me(accessToken?: string | null) {
    return apiRequest<Company>("/companies/me", {
      accessToken: authToken(accessToken),
    });
  },

  getById(id: string, accessToken?: string | null) {
    return apiRequest<Company>(`/companies/${id}`, {
      accessToken: authToken(accessToken),
    });
  },

  update(
    id: string,
    input: {
      name?: string;
      legalName?: string | null;
      country?: string | null;
      billingEmail?: string | null;
      timezone?: string;
      policyJson?: Record<string, unknown> | null;
    },
    accessToken?: string | null,
  ) {
    return apiRequest<Company>(`/companies/${id}`, {
      method: "PATCH",
      body: input,
      accessToken: authToken(accessToken),
    });
  },

  deactivate(id: string, accessToken?: string | null) {
    return apiRequest<Company>(`/companies/${id}/deactivate`, {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  activate(id: string, accessToken?: string | null) {
    return apiRequest<Company>(`/companies/${id}/activate`, {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  remove(id: string, accessToken?: string | null) {
    return apiRequest<Company>(`/companies/${id}`, {
      method: "DELETE",
      accessToken: authToken(accessToken),
    });
  },

  assignAdmin(
    id: string,
    input: { email: string; replaceExisting?: boolean },
    accessToken?: string | null,
  ) {
    return apiRequest<{ message: string; userId: string }>(
      `/companies/${id}/assign-admin`,
      {
        method: "POST",
        body: input,
        accessToken: authToken(accessToken),
      },
    );
  },
};
