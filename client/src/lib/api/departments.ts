import { apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";

export type Department = {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

export const departmentsApi = {
  list(companyId?: string, accessToken?: string | null) {
    const suffix = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    return apiRequest<Department[]>(`/departments${suffix}`, {
      accessToken: authToken(accessToken),
    });
  },

  create(
    input: { name: string; code?: string; companyId?: string },
    accessToken?: string | null,
  ) {
    return apiRequest<Department>("/departments", {
      method: "POST",
      body: input,
      accessToken: authToken(accessToken),
    });
  },

  update(
    id: string,
    input: { name?: string; code?: string | null },
    accessToken?: string | null,
  ) {
    return apiRequest<Department>(`/departments/${id}`, {
      method: "PATCH",
      body: input,
      accessToken: authToken(accessToken),
    });
  },

  remove(id: string, accessToken?: string | null) {
    return apiRequest<Department>(`/departments/${id}`, {
      method: "DELETE",
      accessToken: authToken(accessToken),
    });
  },
};
