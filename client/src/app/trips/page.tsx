"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { departmentsApi, Department } from "@/lib/api/departments";
import { tripsApi, Trip, TripStatus } from "@/lib/api/trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUSES: Array<TripStatus | ""> = [
  "",
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

function formatStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

function destinationLabel(trip: Trip) {
  const parts = [trip.destinationCity, trip.destinationCountry].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "destination TBD";
}

export default function TripsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<Trip[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [status, setStatus] = useState<TripStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadTrips(
    token: string,
    opts: {
      page?: number;
      status?: TripStatus | "";
      from?: string;
      to?: string;
      departmentId?: string;
    } = {},
  ) {
    const result = await tripsApi.list(
      {
        page: opts.page ?? page,
        pageSize,
        status: (opts.status ?? status) || undefined,
        from: (opts.from ?? from) || undefined,
        to: (opts.to ?? to) || undefined,
        departmentId: (opts.departmentId ?? departmentId) || undefined,
      },
      token,
    );
    setItems(result.items);
    setTotal(result.total);
    setPage(result.page);
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
        if (!me.companyId) {
          router.replace("/company");
          return;
        }
        if (me.role === "COMPANY_ADMIN") {
          const depts = await departmentsApi.list(undefined, token);
          setDepartments(depts);
        }
        await loadTrips(token, { page: 1 });
      } catch (err) {
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Unable to load trips");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token) return;
    setError(null);
    try {
      await loadTrips(token, { page: 1, status, from, to, departmentId });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Filter failed");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading trips...</p>
      </main>
    );
  }

  const isEmployee = user?.role === "EMPLOYEE";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
          Seesight
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-3">
          <Link href="/dashboard" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            dashboard
          </Link>
          {isEmployee ? (
            <Link href="/profile" className="text-sm text-ss-muted lowercase hover:text-ss-text">
              profile
            </Link>
          ) : (
            <Link href="/employees" className="text-sm text-ss-muted lowercase hover:text-ss-text">
              employees
            </Link>
          )}
          <Link href="/account" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            account
          </Link>
        </nav>
      </header>

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-medium text-ss-text lowercase">trips</h1>
            <p className="mt-2 text-sm text-ss-muted lowercase">
              create, filter, and track business trip history — cancelled trips stay visible.
            </p>
          </div>
          <Link
            href="/trips/new"
            className="inline-flex h-10 items-center justify-center rounded-full bg-ss-accent px-5 text-sm text-white lowercase hover:bg-ss-accent-hover"
          >
            new trip
          </Link>
        </div>

        {error ? (
          <p className="mt-6 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}

        <form className="mt-8 grid gap-3 md:grid-cols-5" onSubmit={onFilter}>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TripStatus | "")}
              className="flex h-11 w-full rounded-xl border border-white/20 bg-ss-surface-strong px-3 text-sm text-ss-text lowercase"
            >
              {STATUSES.map((s) => (
                <option key={s || "all"} value={s}>
                  {s ? formatStatus(s) : "all"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">from</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">to</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
            />
          </div>
          {!isEmployee ? (
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">department</Label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-white/20 bg-ss-surface-strong px-3 text-sm text-ss-text lowercase"
              >
                <option value="">all</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-end">
            <Button
              type="submit"
              className="h-11 w-full rounded-full bg-ss-accent text-white lowercase hover:bg-ss-accent-hover"
            >
              filter
            </Button>
          </div>
        </form>

        {items.length === 0 ? (
          <p className="mt-10 text-sm text-ss-muted lowercase">
            no trips match these filters. create a draft to get started.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-white/10">
            {items.map((trip) => (
              <li key={trip.id} className="py-4 first:pt-0">
                <Link
                  href={`/trips/${trip.id}`}
                  className="flex flex-col gap-2 transition hover:opacity-90 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-ss-text lowercase">{trip.purpose}</p>
                    <p className="mt-1 text-sm text-ss-muted lowercase">
                      {destinationLabel(trip)} · {trip.travelers.length} traveler
                      {trip.travelers.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-sm text-ss-muted lowercase sm:text-right">
                    <p>
                      {trip.startDate} → {trip.endDate}
                    </p>
                    <p className="mt-1">{formatStatus(trip.status)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                const token = getStoredAccessToken();
                if (!token) return;
                void loadTrips(token, { page: page - 1 });
              }}
              className="rounded-full border border-white/20 bg-transparent text-ss-text lowercase hover:bg-white/5"
            >
              previous
            </Button>
            <p className="text-sm text-ss-muted lowercase">
              page {page} of {totalPages}
            </p>
            <Button
              type="button"
              disabled={page >= totalPages}
              onClick={() => {
                const token = getStoredAccessToken();
                if (!token) return;
                void loadTrips(token, { page: page + 1 });
              }}
              className="rounded-full border border-white/20 bg-transparent text-ss-text lowercase hover:bg-white/5"
            >
              next
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
