"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { tripsApi, Trip } from "@/lib/api/trips";
import { FlightOffer, HotelOffer } from "@/lib/api/travel";
import { TripSearchWidget } from "@/components/travel/trip-search-widget";
import { AskAiPanel } from "@/components/travel/ask-ai-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

const EDITABLE = new Set(["DRAFT", "PENDING_APPROVAL", "REJECTED"]);

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tripId = params.id;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [purpose, setPurpose] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function applyTrip(next: Trip) {
    setTrip(next);
    setPurpose(next.purpose);
    setDestinationCountry(next.destinationCountry ?? "");
    setDestinationCity(next.destinationCity ?? "");
    setStartDate(next.startDate);
    setEndDate(next.endDate);
    setBudgetAmount(
      next.budgetAmount === null || next.budgetAmount === undefined
        ? ""
        : String(next.budgetAmount),
    );
    setNotes(next.notes ?? "");
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
        const data = await tripsApi.getById(tripId, token);
        applyTrip(data);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          storeAccessToken(null);
          router.replace("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Unable to load trip");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, tripId]);

  async function runAction(action: () => Promise<Trip>, success: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await action();
      applyTrip(next);
      setMessage(success);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token || !trip) return;
    await runAction(
      () =>
        tripsApi.update(
          trip.id,
          {
            purpose,
            destinationCountry: destinationCountry || null,
            destinationCity: destinationCity || null,
            startDate,
            endDate,
            budgetAmount: budgetAmount ? Number(budgetAmount) : null,
            notes: notes || null,
          },
          token,
        ),
      "trip updated.",
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading trip...</p>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
        <p className="text-ss-muted lowercase">{error ?? "trip not found"}</p>
        <Link href="/trips" className="mt-4 text-sm text-ss-accent lowercase">
          back to trips
        </Link>
      </main>
    );
  }

  const isAdmin = user?.role === "COMPANY_ADMIN";
  const canEdit = EDITABLE.has(trip.status);
  const token = getStoredAccessToken();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
          Seesight
        </Link>
        <Link href="/trips" className="text-sm text-ss-muted lowercase hover:text-ss-text">
          trips
        </Link>
      </header>

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-medium text-ss-text lowercase">{trip.purpose}</h1>
            <p className="mt-2 text-sm text-ss-muted lowercase">
              status: {formatStatus(trip.status)}
              {trip.approval
                ? ` · approval ${formatStatus(trip.approval.status)}`
                : ""}
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-6 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-6 text-sm text-emerald-300 lowercase">{message}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {trip.status === "DRAFT" && token ? (
            <Button
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => tripsApi.submit(trip.id, token),
                  "submitted for approval.",
                )
              }
              className="rounded-full bg-ss-accent px-4 text-white lowercase hover:bg-ss-accent-hover"
            >
              submit
            </Button>
          ) : null}
          {trip.status === "PENDING_APPROVAL" && isAdmin && token ? (
            <>
              <Button
                disabled={busy}
                onClick={() =>
                  void runAction(
                    () => tripsApi.approve(trip.id, token),
                    "trip approved.",
                  )
                }
                className="rounded-full bg-ss-accent px-4 text-white lowercase hover:bg-ss-accent-hover"
              >
                approve
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void runAction(
                    () => tripsApi.reject(trip.id, undefined, token),
                    "trip rejected.",
                  )
                }
                className="rounded-full border border-white/20 bg-transparent px-4 text-ss-text lowercase hover:bg-white/5"
              >
                reject
              </Button>
            </>
          ) : null}
          {trip.status === "APPROVED" && isAdmin && token ? (
            <Button
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => tripsApi.start(trip.id, token),
                  "trip marked in progress.",
                )
              }
              className="rounded-full bg-ss-accent px-4 text-white lowercase hover:bg-ss-accent-hover"
            >
              start
            </Button>
          ) : null}
          {trip.status === "IN_PROGRESS" && isAdmin && token ? (
            <Button
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => tripsApi.complete(trip.id, token),
                  "trip completed.",
                )
              }
              className="rounded-full bg-ss-accent px-4 text-white lowercase hover:bg-ss-accent-hover"
            >
              complete
            </Button>
          ) : null}
          {trip.status === "REJECTED" && token ? (
            <Button
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => tripsApi.reopen(trip.id, token),
                  "reopened as draft.",
                )
              }
              className="rounded-full border border-white/20 bg-transparent px-4 text-ss-text lowercase hover:bg-white/5"
            >
              reopen draft
            </Button>
          ) : null}
          {trip.status !== "CANCELLED" &&
          trip.status !== "COMPLETED" &&
          token ? (
            <Button
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => tripsApi.cancel(trip.id, token),
                  "trip cancelled.",
                )
              }
              className="rounded-full border border-white/20 bg-transparent px-4 text-ss-text lowercase hover:bg-white/5"
            >
              cancel
            </Button>
          ) : null}
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-medium text-ss-text lowercase">travelers</h2>
          <ul className="mt-3 space-y-2 text-sm lowercase text-ss-muted">
            {trip.travelers.map((t) => (
              <li key={t.id}>
                {t.firstName} {t.lastName}
                {t.isPrimary ? " · primary" : ""}
                {t.departmentName ? ` · ${t.departmentName}` : ""}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 grid gap-4 text-sm lowercase sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-ss-surface-strong p-4">
            <p className="text-ss-muted">selected flight</p>
            {trip.flightOffers?.find((o) => o.selected) ? (
              <p className="mt-2 text-ss-text">
                {trip.flightOffers.find((o) => o.selected)?.origin} →{" "}
                {trip.flightOffers.find((o) => o.selected)?.destination}
                {" · "}
                {trip.flightOffers.find((o) => o.selected)?.priceAmount ?? "—"}{" "}
                {trip.flightOffers.find((o) => o.selected)?.currency}
              </p>
            ) : (
              <p className="mt-2 text-ss-muted">none selected</p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-ss-surface-strong p-4">
            <p className="text-ss-muted">selected hotel</p>
            {trip.hotelOffers?.find((o) => o.selected) ? (
              <p className="mt-2 text-ss-text">
                {trip.hotelOffers.find((o) => o.selected)?.hotelName}
                {" · "}
                {trip.hotelOffers.find((o) => o.selected)?.priceAmount ?? "—"}{" "}
                {trip.hotelOffers.find((o) => o.selected)?.currency}
              </p>
            ) : (
              <p className="mt-2 text-ss-muted">none selected</p>
            )}
          </div>
        </div>

        {canEdit && token ? (
          <div className="mt-10 border-t border-white/10 pt-8">
            <TripSearchWidget
              accessToken={token}
              defaultOrigin=""
              defaultDestination=""
              defaultCity={trip.destinationCity ?? ""}
              defaultDepart={trip.startDate}
              defaultReturn={trip.endDate}
              currency={trip.budgetCurrency}
              disabled={busy}
              onSelectFlight={async (offer: FlightOffer) => {
                const next = await tripsApi.attachFlightOffer(
                  trip.id,
                  {
                    providerOfferId: offer.providerOfferId,
                    origin: offer.origin,
                    destination: offer.destination,
                    departAt: offer.departAt,
                    returnAt: offer.returnAt,
                    travelClass: offer.travelClass,
                    priceAmount: offer.priceAmount,
                    currency: offer.currency,
                    rawPayload: offer.rawPayload,
                  },
                  token,
                );
                applyTrip(next);
              }}
              onSelectHotel={async (offer: HotelOffer) => {
                const next = await tripsApi.attachHotelOffer(
                  trip.id,
                  {
                    providerOfferId: offer.providerOfferId,
                    hotelName: offer.hotelName,
                    city: offer.city,
                    checkIn: offer.checkIn,
                    checkOut: offer.checkOut,
                    priceAmount: offer.priceAmount,
                    currency: offer.currency,
                    rawPayload: offer.rawPayload,
                  },
                  token,
                );
                applyTrip(next);
              }}
            />
          </div>
        ) : null}

        {token ? (
          <AskAiPanel
            tripId={trip.id}
            accessToken={token}
            hasOffers={
              (trip.flightOffers?.length ?? 0) > 0 ||
              (trip.hotelOffers?.length ?? 0) > 0
            }
            disabled={busy}
          />
        ) : null}

        {canEdit ? (
          <form className="mt-8 space-y-5" onSubmit={onSave}>
            <h2 className="text-lg font-medium text-ss-text lowercase">edit trip</h2>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">purpose</Label>
              <Input
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">country</Label>
                <Input
                  maxLength={2}
                  value={destinationCountry}
                  onChange={(e) => setDestinationCountry(e.target.value)}
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">city</Label>
                <Input
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">start date</Label>
                <Input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">end date</Label>
                <Input
                  required
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">budget</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
            >
              save changes
            </Button>
          </form>
        ) : (
          <dl className="mt-8 grid gap-4 text-sm lowercase sm:grid-cols-2">
            <div>
              <dt className="text-ss-muted">dates</dt>
              <dd className="mt-1 text-ss-text">
                {trip.startDate} → {trip.endDate}
              </dd>
            </div>
            <div>
              <dt className="text-ss-muted">budget</dt>
              <dd className="mt-1 text-ss-text">
                {trip.budgetAmount ?? "—"} {trip.budgetCurrency}
              </dd>
            </div>
            <div>
              <dt className="text-ss-muted">destination</dt>
              <dd className="mt-1 text-ss-text">
                {[trip.destinationCity, trip.destinationCountry]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-ss-muted">notes</dt>
              <dd className="mt-1 text-ss-text">{trip.notes ?? "—"}</dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  );
}
