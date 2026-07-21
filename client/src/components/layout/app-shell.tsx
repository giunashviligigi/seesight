"use client";

import type { ReactNode } from "react";
import type { AuthUser } from "@/lib/api/auth";
import { AppHeader } from "@/components/layout/app-header";
import { cn } from "@/lib/utils";

/** Shared header rail width — must stay identical on every authenticated page. */
export const APP_HEADER_RAIL_CLASS = "mx-auto w-full max-w-6xl";

type AppShellProps = {
  user: AuthUser;
  children: ReactNode;
  /**
   * Max width for page body only. Header always uses APP_HEADER_RAIL_CLASS
   * so nav links never jump when switching pages.
   */
  contentClassName?: string;
  unreadCount?: number;
  pendingApprovalsCount?: number;
};

/**
 * Authenticated page chrome: fixed-height header on a stable rail,
 * then optional narrower/wider content underneath.
 */
export function AppShell({
  user,
  children,
  contentClassName = "max-w-5xl",
  unreadCount,
  pendingApprovalsCount,
}: AppShellProps) {
  return (
    <main className="flex min-h-screen w-full flex-col">
      <div className="w-full shrink-0 px-6 pt-10">
        <div className={APP_HEADER_RAIL_CLASS}>
          <AppHeader
            user={user}
            unreadCount={unreadCount}
            pendingApprovalsCount={pendingApprovalsCount}
          />
        </div>
      </div>
      <div
        className={cn(
          "mx-auto w-full flex-1 px-6 pb-10",
          contentClassName,
        )}
      >
        {children}
      </div>
    </main>
  );
}
