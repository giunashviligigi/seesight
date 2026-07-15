import { apiRequest } from "./client";

export type UserRole = "SUPER_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE";
export type UserStatus = "ACTIVE" | "INACTIVE";

export type AuthUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  status: UserStatus;
  companyId: string | null;
  createdAt: string;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export type MessageResponse = {
  message: string;
};

export type ForgotPasswordResponse = MessageResponse & {
  resetToken?: string;
  resetUrl?: string;
};

const ACCESS_TOKEN_KEY = "seesight_access_token";

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(token: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

/**
 * Session strategy (Milestone 2):
 * - API sets an httpOnly cookie for credentialed browser calls.
 * - Client also stores the JWT in localStorage so the Next.js middleware
 *   and Authorization header can protect pages across localhost ports.
 * - Prefer cookie-only when API and web share a site (deployment Milestone 12).
 */
export const authApi = {
  register(input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) {
    return apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: input,
    });
  },

  login(input: { email: string; password: string }) {
    return apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: input,
    });
  },

  logout() {
    return apiRequest<MessageResponse>("/auth/logout", { method: "POST" });
  },

  me(accessToken?: string | null) {
    return apiRequest<AuthUser>("/auth/me", {
      accessToken: accessToken ?? getStoredAccessToken(),
    });
  },

  forgotPassword(email: string) {
    return apiRequest<ForgotPasswordResponse>("/auth/forgot-password", {
      method: "POST",
      body: { email },
    });
  },

  resetPassword(input: { token: string; newPassword: string }) {
    return apiRequest<MessageResponse>("/auth/reset-password", {
      method: "POST",
      body: input,
    });
  },

  protectedSample(accessToken?: string | null) {
    return apiRequest<{ message: string; userId: string; role: UserRole }>(
      "/account/protected",
      { accessToken: accessToken ?? getStoredAccessToken() },
    );
  },
};
