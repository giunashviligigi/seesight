"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { AppNotification, notificationsApi } from "@/lib/api/notifications";
import {
  AppHeader,
  NOTIFICATIONS_UPDATED_EVENT,
} from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";

function notifyUnreadChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(token: string) {
    const result = await notificationsApi.list({ page: 1, pageSize: 50 }, token);
    setItems(result.items);
    setUnreadCount(result.unreadCount);
    notifyUnreadChanged();
  }

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const me = await authApi.me(token);
        setUser(me);
        if (me.role === "SUPER_ADMIN") {
          router.replace("/companies");
          return;
        }
        if (!me.companyId && me.role !== "EMPLOYEE") {
          router.replace("/company");
          return;
        }
        await load(token);
      } catch (err) {
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Unable to load notifications");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onMarkRead(id: string) {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      await notificationsApi.markRead(id, token);
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to mark read");
    }
  }

  async function onMarkAll() {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      await notificationsApi.markAllRead(token);
      await load(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to mark all read");
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading notifications...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
      <AppHeader user={user} unreadCount={unreadCount} />

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-medium text-ss-text lowercase">notifications</h1>
            <p className="mt-2 text-sm text-ss-muted lowercase">
              {unreadCount} unread · trip submit / approve / reject updates
            </p>
          </div>
          {unreadCount > 0 ? (
            <Button
              onClick={() => void onMarkAll()}
              className="rounded-full border border-white/20 bg-transparent px-4 text-ss-text lowercase hover:bg-white/5"
            >
              mark all read
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className="mt-6 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}

        {items.length === 0 ? (
          <p className="mt-10 text-sm text-ss-muted lowercase">no notifications yet.</p>
        ) : (
          <ul className="mt-8 divide-y divide-white/10">
            {items.map((item) => (
              <li key={item.id} className="py-4 first:pt-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p
                      className={`lowercase ${item.readAt ? "text-ss-muted" : "text-ss-text"}`}
                    >
                      {item.title}
                    </p>
                    {item.body ? (
                      <p className="mt-1 text-sm text-ss-muted lowercase">{item.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-ss-muted lowercase">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {item.tripId ? (
                      <Link
                        href={`/trips/${item.tripId}`}
                        className="text-sm text-ss-accent lowercase hover:underline"
                      >
                        view trip
                      </Link>
                    ) : null}
                    {!item.readAt ? (
                      <button
                        type="button"
                        onClick={() => void onMarkRead(item.id)}
                        className="text-sm text-ss-muted lowercase hover:text-ss-text"
                      >
                        mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
