"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { dashboardApi, DashboardSummary } from "@/lib/api/dashboard";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function destinationLabel(trip: DashboardSummary["upcomingTrips"][number]) {
  const parts = [trip.destinationCity, trip.destinationCountry].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "destination TBD";
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

        const data = await dashboardApi.summary(undefined, token);
        setSummary(data);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          storeAccessToken(null);
          router.replace("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Unable to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading dashboard...</p>
      </main>
    );
  }

  const isEmployee = user?.role === "EMPLOYEE";
  const isEmpty =
    summary &&
    summary.upcomingTripsCount === 0 &&
    summary.pendingApprovalsCount === 0 &&
    summary.totalTravelSpending.amount === 0 &&
    summary.statistics.tripsThisMonth === 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
          Seesight
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-3">
          <Link href="/trips" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            trips
          </Link>
          {!isEmployee ? (
            <Link href="/approvals" className="text-sm text-ss-muted lowercase hover:text-ss-text">
              approvals
            </Link>
          ) : null}
          {!isEmployee ? (
            <Link href="/reports" className="text-sm text-ss-muted lowercase hover:text-ss-text">
              reports
            </Link>
          ) : null}
          <Link href="/notifications" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            notifications
          </Link>
          {isEmployee ? (
            <Link href="/profile" className="text-sm text-ss-muted lowercase hover:text-ss-text">
              profile
            </Link>
          ) : (
            <>
              <Link href="/employees" className="text-sm text-ss-muted lowercase hover:text-ss-text">
                employees
              </Link>
              <Link href="/company" className="text-sm text-ss-muted lowercase hover:text-ss-text">
                company
              </Link>
            </>
          )}
          <Link href="/account" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            account
          </Link>
        </nav>
      </header>

      <section className="mt-12">
        <h1 className="text-3xl font-medium text-ss-text lowercase">dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-ss-muted lowercase">
          {isEmployee
            ? "your upcoming trips, pending approvals, and travel spend."
            : "company overview — upcoming trips, spend, roster, and approvals."}
        </p>

        {error ? (
          <p className="mt-6 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}

        {summary ? (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-3xl border border-white/15 bg-ss-surface p-6 transition duration-300 hover:-translate-y-0.5">
                <p className="text-xs tracking-wide text-ss-muted lowercase">upcoming trips</p>
                <p className="mt-3 text-3xl font-medium text-ss-text">
                  {summary.upcomingTripsCount}
                </p>
              </article>
              <article className="rounded-3xl border border-white/15 bg-ss-surface p-6 transition duration-300 hover:-translate-y-0.5">
                <p className="text-xs tracking-wide text-ss-muted lowercase">travel spend (ytd)</p>
                <p className="mt-3 text-3xl font-medium text-ss-text">
                  {formatMoney(
                    summary.totalTravelSpending.amount,
                    summary.totalTravelSpending.currency,
                  )}
                </p>
                <p className="mt-2 text-xs text-ss-muted lowercase">
                  {summary.totalTravelSpending.periodFrom} →{" "}
                  {summary.totalTravelSpending.periodTo}
                </p>
              </article>
              <article className="rounded-3xl border border-white/15 bg-ss-surface p-6 transition duration-300 hover:-translate-y-0.5">
                <p className="text-xs tracking-wide text-ss-muted lowercase">active employees</p>
                <p className="mt-3 text-3xl font-medium text-ss-text">
                  {summary.activeEmployeesCount}
                </p>
              </article>
              <article className="rounded-3xl border border-white/15 bg-ss-surface p-6 transition duration-300 hover:-translate-y-0.5">
                <p className="text-xs tracking-wide text-ss-muted lowercase">pending approvals</p>
                <p className="mt-3 text-3xl font-medium text-ss-text">
                  {summary.pendingApprovalsCount}
                </p>
                {!isEmployee ? (
                  <Link
                    href="/approvals"
                    className="mt-3 inline-block text-xs text-ss-accent lowercase hover:underline"
                  >
                    review queue
                  </Link>
                ) : null}
              </article>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <article className="rounded-3xl border border-white/15 bg-ss-surface p-6">
                <p className="text-xs tracking-wide text-ss-muted lowercase">trips this month</p>
                <p className="mt-3 text-2xl font-medium text-ss-text">
                  {summary.statistics.tripsThisMonth}
                </p>
              </article>
              <article className="rounded-3xl border border-white/15 bg-ss-surface p-6">
                <p className="text-xs tracking-wide text-ss-muted lowercase">average trip cost</p>
                <p className="mt-3 text-2xl font-medium text-ss-text">
                  {formatMoney(
                    summary.statistics.averageTripCost,
                    summary.totalTravelSpending.currency,
                  )}
                </p>
              </article>
            </div>

            <section className="mt-8 rounded-3xl border border-white/15 bg-ss-surface p-8">
              <h2 className="text-xl font-medium text-ss-text lowercase">upcoming trips</h2>
              <p className="mt-1 text-sm text-ss-muted lowercase">
                {summary.scope === "self"
                  ? "trips where you are a traveler."
                  : "next trips across the company."}
              </p>

              {isEmpty ? (
                <p className="mt-8 text-sm text-ss-muted lowercase">
                  no travel activity yet. once trips are created, spend and approvals will appear
                  here.
                </p>
              ) : null}

              {!isEmpty && summary.upcomingTrips.length === 0 ? (
                <p className="mt-8 text-sm text-ss-muted lowercase">
                  no upcoming trips in the calendar.
                </p>
              ) : null}

              {summary.upcomingTrips.length > 0 ? (
                <ul className="mt-6 divide-y divide-white/10">
                  {summary.upcomingTrips.map((trip) => (
                    <li key={trip.id} className="py-4 first:pt-0 last:pb-0">
                      <Link
                        href={`/trips/${trip.id}`}
                        className="flex flex-col gap-1 transition hover:opacity-90 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-ss-text lowercase">{trip.purpose}</p>
                          <p className="mt-1 text-sm text-ss-muted lowercase">
                            {destinationLabel(trip)}
                          </p>
                        </div>
                        <div className="text-sm text-ss-muted lowercase sm:text-right">
                          <p>
                            {trip.startDate} → {trip.endDate}
                          </p>
                          <p className="mt-1">
                            {trip.status.replaceAll("_", " ").toLowerCase()}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
