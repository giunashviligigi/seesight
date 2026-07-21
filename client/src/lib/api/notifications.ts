import { apiRequest } from "./client";
import { getStoredAccessToken } from "./auth";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  tripId: string | null;
  readAt: string | null;
  createdAt: string;
};

function authToken(token?: string | null) {
  return token ?? getStoredAccessToken();
}

export const notificationsApi = {
  list(
    params?: { unreadOnly?: boolean; page?: number; pageSize?: number },
    accessToken?: string | null,
  ) {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.set("unreadOnly", "true");
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<{
      items: AppNotification[];
      total: number;
      unreadCount: number;
      page: number;
      pageSize: number;
    }>(`/notifications${suffix}`, {
      accessToken: authToken(accessToken),
    });
  },

  markRead(id: string, accessToken?: string | null) {
    return apiRequest<AppNotification>(`/notifications/${id}/read`, {
      method: "PATCH",
      accessToken: authToken(accessToken),
    });
  },

  markAllRead(accessToken?: string | null) {
    return apiRequest<{ updated: number }>("/notifications/read-all", {
      method: "POST",
      accessToken: authToken(accessToken),
    });
  },

  clearAll(accessToken?: string | null) {
    return apiRequest<{ deleted: number }>("/notifications/clear-all", {
      method: "DELETE",
      accessToken: authToken(accessToken),
    });
  },
};
