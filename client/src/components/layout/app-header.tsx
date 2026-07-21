"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/api/auth";
import { getStoredAccessToken } from "@/lib/api/auth";
import { approvalsApi } from "@/lib/api/approvals";
import { notificationsApi } from "@/lib/api/notifications";
import { getHomeHref, getNavItems, isNavItemActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const NOTIFICATIONS_UPDATED_EVENT = "seesight:notifications-updated";
export const APPROVALS_UPDATED_EVENT = "seesight:approvals-updated";

type AppHeaderProps = {
  user: AuthUser;
  className?: string;
  /** Optional override from pages that already loaded unreadCount. */
  unreadCount?: number;
  /** Optional override from pages that already loaded pending approvals. */
  pendingApprovalsCount?: number;
};

export function AppHeader({
  user,
  className,
  unreadCount: unreadCountProp,
  pendingApprovalsCount: pendingApprovalsCountProp,
}: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = getNavItems(user.role);
  const homeHref = getHomeHref(user.role);
  const showNotificationsBadge = items.some(
    (item) => item.href === "/notifications",
  );
  const showApprovalsBadge = items.some((item) => item.href === "/approvals");
  const [fetchedUnread, setFetchedUnread] = useState(0);
  const [fetchedPendingApprovals, setFetchedPendingApprovals] = useState(0);
  const unreadCount =
    typeof unreadCountProp === "number" ? unreadCountProp : fetchedUnread;
  const pendingApprovalsCount =
    typeof pendingApprovalsCountProp === "number"
      ? pendingApprovalsCountProp
      : fetchedPendingApprovals;

  useEffect(() => {
    if (user.mustChangePassword && pathname !== "/change-password") {
      router.replace("/change-password");
    }
  }, [user.mustChangePassword, pathname, router]);

  useEffect(() => {
    if (!showNotificationsBadge || user.mustChangePassword) {
      setFetchedUnread(0);
      return;
    }

    let cancelled = false;

    async function refreshUnread() {
      const token = getStoredAccessToken();
      if (!token) return;
      try {
        const result = await notificationsApi.list(
          { page: 1, pageSize: 1 },
          token,
        );
        if (!cancelled) setFetchedUnread(result.unreadCount);
      } catch {
        if (!cancelled) setFetchedUnread(0);
      }
    }

    void refreshUnread();

    function onUpdated() {
      void refreshUnread();
    }

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    const intervalId = window.setInterval(() => {
      void refreshUnread();
    }, 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
      window.clearInterval(intervalId);
    };
  }, [showNotificationsBadge, user.mustChangePassword, pathname]);

  useEffect(() => {
    if (!showApprovalsBadge || user.mustChangePassword) {
      setFetchedPendingApprovals(0);
      return;
    }

    let cancelled = false;

    async function refreshPendingApprovals() {
      const token = getStoredAccessToken();
      if (!token) return;
      try {
        const result = await approvalsApi.pending(
          { page: 1, pageSize: 1 },
          token,
        );
        if (!cancelled) setFetchedPendingApprovals(result.total);
      } catch {
        if (!cancelled) setFetchedPendingApprovals(0);
      }
    }

    void refreshPendingApprovals();

    function onUpdated() {
      void refreshPendingApprovals();
    }

    window.addEventListener(APPROVALS_UPDATED_EVENT, onUpdated);
    const intervalId = window.setInterval(() => {
      void refreshPendingApprovals();
    }, 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener(APPROVALS_UPDATED_EVENT, onUpdated);
      window.clearInterval(intervalId);
    };
  }, [showApprovalsBadge, user.mustChangePassword, pathname]);

  return (
    <header
      className={cn(
        "flex h-14 w-full shrink-0 items-center justify-between gap-6",
        className,
      )}
    >
      <Link
        href={homeHref}
        className="shrink-0 text-sm font-semibold tracking-[0.28em] text-ss-text uppercase"
      >
        Seesight
      </Link>
      <nav
        className="flex h-9 flex-nowrap items-center justify-end gap-0.5 sm:gap-1"
        aria-label="Main"
      >
        {items.map((item) => {
          const active = isNavItemActive(pathname, item);
          const isNotifications = item.href === "/notifications";
          const isApprovals = item.href === "/approvals";
          const badgeCount = isNotifications
            ? unreadCount
            : isApprovals
              ? pendingApprovalsCount
              : 0;
          const showBadgeSlot = isNotifications || isApprovals;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-sm lowercase transition-colors hover:text-ss-text",
                showBadgeSlot ? "pr-5" : null,
                active ? "text-ss-text" : "text-ss-muted",
              )}
              aria-current={active ? "page" : undefined}
              aria-label={
                isNotifications && badgeCount > 0
                  ? `notifications, ${badgeCount} unread`
                  : isApprovals && badgeCount > 0
                    ? `approvals, ${badgeCount} pending`
                    : undefined
              }
            >
              {item.label}
              {badgeCount > 0 ? (
                <span
                  className="absolute top-1 right-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] leading-none font-semibold text-white"
                  aria-hidden
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
