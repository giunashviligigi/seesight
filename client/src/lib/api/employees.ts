import { apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";

export type EmployeeStatus = "ACTIVE" | "INACTIVE";

export type Employee = {
  id: string;
  companyId: string;
  departmentId: string | null;
  departmentName: string | null;
  userId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  phone: string | null;
  nationality: string | null;
  passportNumber: string | null;
  preferredAirport: string | null;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
  temporaryPassword?: string;
};

export type EmployeeListResponse = {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

export const employeesApi = {
  list(
    params?: {
      companyId?: string;
      departmentId?: string;
      search?: string;
      status?: EmployeeStatus;
      sortBy?: "firstName" | "lastName" | "email" | "createdAt" | "jobTitle";
      sortOrder?: "asc" | "desc";
      page?: number;
      pageSize?: number;
    },
    accessToken?: string | null,
  ) {
    const query = new URLSearchParams();
    if (params?.companyId) query.set("companyId", params.companyId);
    if (params?.departmentId) query.set("departmentId", params.departmentId);
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    if (params?.sortBy) query.set("sortBy", params.sortBy);
    if (params?.sortOrder) query.set("sortOrder", params.sortOrder);
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<EmployeeListResponse>(`/employees${suffix}`, {
      accessToken: authToken(accessToken),
    });
  },

  me(accessToken?: string | null) {
    return apiRequest<Employee>("/employees/me", {
      accessToken: authToken(accessToken),
    });
  },

  getById(id: string, accessToken?: string | null) {
    return apiRequest<Employee>(`/employees/${id}`, {
      accessToken: authToken(accessToken),
    });
  },

  create(
    input: {
      email: string;
      firstName: string;
      lastName: string;
      jobTitle?: string;
      phone?: string;
      departmentId?: string;
      nationality?: string;
      passportNumber?: string;
      preferredAirport?: string;
      createLogin?: boolean;
      companyId?: string;
    },
    accessToken?: string | null,
  ) {
    return apiRequest<Employee>("/employees", {
      method: "POST",
      body: input,
      accessToken: authToken(accessToken),
    });
  },

  update(
    id: string,
    input: {
      firstName?: string;
      lastName?: string;
      jobTitle?: string | null;
      phone?: string | null;
      departmentId?: string | null;
      nationality?: string | null;
      passportNumber?: string | null;
      preferredAirport?: string | null;
    },
    accessToken?: string | null,
  ) {
    return apiRequest<Employee>(`/employees/${id}`, {
      method: "PATCH",
      body: input,
      accessToken: authToken(accessToken),
    });
  },

  deactivate(id: string, accessToken?: string | null) {
    return apiRequest<Employee>(`/employees/${id}/deactivate`, {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  activate(id: string, accessToken?: string | null) {
    return apiRequest<Employee>(`/employees/${id}/activate`, {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  remove(id: string, accessToken?: string | null) {
    return apiRequest<Employee>(`/employees/${id}`, {
      method: "DELETE",
      accessToken: authToken(accessToken),
    });
  },
};
