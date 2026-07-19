import { apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";

export type PlatformUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "SUPER_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE";
  status: "ACTIVE" | "INACTIVE";
  companyId: string | null;
  mustChangePassword: boolean;
  createdAt: string;
};

export type PlatformUserListResponse = {
  items: PlatformUser[];
  total: number;
  page: number;
  pageSize: number;
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

export const usersApi = {
  list(
    params?: {
      unassignedOnly?: boolean;
      search?: string;
      page?: number;
      pageSize?: number;
    },
    accessToken?: string | null,
  ) {
    const query = new URLSearchParams();
    if (params?.unassignedOnly !== undefined) {
      query.set("unassignedOnly", String(params.unassignedOnly));
    }
    if (params?.search) query.set("search", params.search);
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<PlatformUserListResponse>(`/users${suffix}`, {
      accessToken: authToken(accessToken),
    });
  },
};
