"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { departmentsApi, Department } from "@/lib/api/departments";
import { tripsApi, Trip, TripStatus } from "@/lib/api/trips";
import { formatCountryLabel } from "@/lib/country";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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
  const parts = [
    trip.destinationCity,
    formatCountryLabel(trip.destinationCountry) || null,
  ].filter(Boolean);
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tripPendingDelete, setTripPendingDelete] = useState<Trip | null>(null);

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

  async function confirmDeleteTrip() {
    const trip = tripPendingDelete;
    const token = getStoredAccessToken();
    if (!trip || !token || deletingId) return;

    setDeletingId(trip.id);
    setError(null);
    try {
      await tripsApi.remove(trip.id, token);
      setTripPendingDelete(null);
      await loadTrips(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to delete trip");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading trips...</p>
      </main>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">{error ?? "redirecting..."}</p>
      </main>
    );
  }

  const isEmployee = user.role === "EMPLOYEE";

  return (
    <AppShell user={user}>
      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-medium text-ss-text lowercase">trips</h1>
            <p className="mt-2 text-sm text-ss-muted lowercase">
              create, filter, and track business trip history. delete removes a
              trip from the list; cancel keeps it visible.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => router.push("/trips/new")}
            className="h-10 rounded-full bg-ss-accent px-5 text-sm text-white lowercase hover:bg-ss-accent-hover"
          >
            new trip
          </Button>
        </div>

        {error ? (
          <p className="mt-6 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}

        <form className="mt-8 grid gap-3 md:grid-cols-5" onSubmit={onFilter}>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as TripStatus | "")}
              aria-label="status"
              options={STATUSES.map((s) => ({
                value: s,
                label: s ? formatStatus(s) : "all",
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">from</Label>
            <DateInput value={from} onChange={setFrom} aria-label="from date" />
          </div>
          <div className="space-y-2">
            <Label className="lowercase text-ss-muted">to</Label>
            <DateInput value={to} onChange={setTo} aria-label="to date" />
          </div>
          {!isEmployee ? (
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">department</Label>
              <Select
                value={departmentId}
                onValueChange={setDepartmentId}
                aria-label="department"
                options={[
                  { value: "", label: "all" },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
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
              <li
                key={trip.id}
                className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/trips/${trip.id}`}
                  className="min-w-0 flex-1 transition hover:opacity-90"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-ss-text lowercase">
                        {trip.purpose || "untitled trip"}
                      </p>
                      <p className="mt-1 text-sm text-ss-muted lowercase">
                        {destinationLabel(trip)} · {trip.travelers.length}{" "}
                        traveler
                        {trip.travelers.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-sm text-ss-muted lowercase sm:text-right">
                      <p>
                        {trip.startDate} → {trip.endDate}
                      </p>
                      <p className="mt-1">{formatStatus(trip.status)}</p>
                    </div>
                  </div>
                </Link>
                <Button
                  type="button"
                  disabled={deletingId === trip.id}
                  onClick={() => setTripPendingDelete(trip)}
                  className="h-9 shrink-0 rounded-full border border-red-400/40 bg-transparent px-4 text-sm text-red-300 lowercase hover:bg-red-400/10"
                >
                  {deletingId === trip.id ? "deleting…" : "delete"}
                </Button>
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

      <ConfirmDialog
        open={tripPendingDelete !== null}
        title="delete this trip?"
        description={
          tripPendingDelete
            ? `"${tripPendingDelete.purpose || "untitled trip"}" will be removed from your trip list. this cannot be undone from here.`
            : ""
        }
        confirmLabel="delete trip"
        cancelLabel="keep trip"
        busy={deletingId !== null}
        onCancel={() => {
          if (deletingId) return;
          setTripPendingDelete(null);
        }}
        onConfirm={() => void confirmDeleteTrip()}
      />
    </AppShell>
  );
}
