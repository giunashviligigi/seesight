import { apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";
import type { Trip } from "./trips";

export type PendingApproval = {
  approvalId: string;
  tripId: string;
  purpose: string;
  destinationCountry: string | null;
  destinationCity: string | null;
  startDate: string;
  endDate: string;
  tripStatus: string;
  approvalStatus: string;
  submittedAt: string;
  createdByUserId: string;
  createdByEmail: string;
  createdByName: string | null;
  travelerCount: number;
};

export type ApprovalHistoryItem = {
  id: string;
  action: string;
  comment: string | null;
  actorUserId: string;
  actorEmail: string;
  actorName: string | null;
  createdAt: string;
};

export type ApprovalHistory = {
  tripId: string;
  approvalId: string | null;
  status: string | null;
  actions: ApprovalHistoryItem[];
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

export const approvalsApi = {
  pending(
    params?: { companyId?: string; page?: number; pageSize?: number },
    accessToken?: string | null,
  ) {
    const query = new URLSearchParams();
    if (params?.companyId) query.set("companyId", params.companyId);
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<{
      items: PendingApproval[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/approvals/pending${suffix}`, {
      accessToken: authToken(accessToken),
    });
  },

  history(tripId: string, accessToken?: string | null) {
    return apiRequest<ApprovalHistory>(`/approvals/${tripId}/history`, {
      accessToken: authToken(accessToken),
    });
  },

  approve(tripId: string, comment?: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/approvals/${tripId}/approve`, {
      method: "POST",
      body: comment ? { comment } : {},
      accessToken: authToken(accessToken),
    });
  },

  reject(tripId: string, comment?: string, accessToken?: string | null) {
    return apiRequest<Trip>(`/approvals/${tripId}/reject`, {
      method: "POST",
      body: comment ? { comment } : {},
      accessToken: authToken(accessToken),
    });
  },
};
