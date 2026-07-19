"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { tripsApi, Trip } from "@/lib/api/trips";
import { approvalsApi, ApprovalHistory } from "@/lib/api/approvals";
import { FlightOffer, HotelOffer } from "@/lib/api/travel";
import { airportFromCityName, findAirportByIata } from "@/lib/airports";
import { formatCountryLabel, normalizeCountryInput } from "@/lib/country";
import { AppHeader, APPROVALS_UPDATED_EVENT } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripSearchWidget } from "@/components/travel/trip-search-widget";
import {
  formatFlightClock,
  formatFlightDateTime,
  formatHotelStayPrice,
  formatNights,
  nightsBetween,
} from "@/lib/format-travel";

function formatStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

function SelectedItinerarySummary({ trip }: { trip: Trip }) {
  const flight = trip.flightOffers?.find((o) => o.selected) ?? null;
  const hotel = trip.hotelOffers?.find((o) => o.selected) ?? null;
  const flightPrice = flight?.priceAmount ?? null;
  const hotelPrice = hotel?.priceAmount ?? null;
  const currency =
    flight?.currency || hotel?.currency || trip.budgetCurrency || "EUR";
  const total =
    flightPrice == null && hotelPrice == null
      ? null
      : (flightPrice ?? 0) + (hotelPrice ?? 0);
  const originCity = findAirportByIata(flight?.origin)?.city;
  const destCity = findAirportByIata(flight?.destination)?.city;

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-ss-surface-strong p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium lowercase text-ss-text">
            your itinerary
          </h2>
          <p className="mt-1 text-sm lowercase text-ss-muted">
            selected offers for this trip
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs lowercase text-ss-muted">estimated total</p>
          <p className="text-2xl font-medium text-ss-accent">
            {total != null ? `${total} ${currency}` : "—"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 text-sm lowercase sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-ss-muted">flight</p>
          {flight ? (
            <div className="mt-2 space-y-1">
              <p className="text-base text-ss-text">
                {originCity ? `${originCity} (${flight.origin})` : flight.origin}{" "}
                →{" "}
                {destCity
                  ? `${destCity} (${flight.destination})`
                  : flight.destination}
              </p>
              <p className="text-ss-muted">
                depart {formatFlightClock(flight.departAt)}
                {flight.departAt
                  ? ` · ${formatFlightDateTime(flight.departAt)}`
                  : ""}
              </p>
              <p className="pt-1 font-medium text-ss-text">
                {flightPrice != null
                  ? `${flightPrice} ${flight.currency ?? currency}`
                  : "price n/a"}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-ss-muted">none selected yet</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-ss-muted">hotel</p>
          {hotel ? (
            <div className="mt-2 space-y-1">
              <p className="text-base text-ss-text">{hotel.hotelName}</p>
              <p className="text-ss-muted">
                {hotel.city ?? "—"}
                {hotel.checkIn && hotel.checkOut
                  ? ` · ${hotel.checkIn} → ${hotel.checkOut}`
                  : ""}
                {(() => {
                  const nights = nightsBetween(hotel.checkIn, hotel.checkOut);
                  const label = formatNights(nights);
                  return label ? ` · ${label}` : "";
                })()}
              </p>
              <p className="pt-1 font-medium text-ss-text">
                {formatHotelStayPrice({
                  priceAmount: hotelPrice,
                  currency: hotel.currency ?? currency,
                  checkIn: hotel.checkIn,
                  checkOut: hotel.checkOut,
                })}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-ss-muted">none selected yet</p>
          )}
        </div>
      </div>

      {flight && hotel && total != null ? (
        <p className="mt-4 text-xs lowercase text-ss-muted">
          flight {flightPrice ?? 0} + hotel {hotelPrice ?? 0} = {total} {currency}
        </p>
      ) : null}
    </section>
  );
}

const EDITABLE = new Set(["DRAFT", "REJECTED"]);

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tripId = params.id;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [history, setHistory] = useState<ApprovalHistory | null>(null);
  const [decisionComment, setDecisionComment] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function applyTrip(next: Trip) {
    setTrip(next);
    setPurpose(
      !next.purpose || next.purpose === "New trip" ? "" : next.purpose,
    );
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
        try {
          const audit = await approvalsApi.history(tripId, token);
          setHistory(audit);
        } catch {
          setHistory(null);
        }
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
      const token = getStoredAccessToken();
      if (token) {
        try {
          setHistory(await approvalsApi.history(tripId, token));
        } catch {
          // history optional
        }
      }
      if (
        success.includes("submitted") ||
        success.includes("approved") ||
        success.includes("rejected")
      ) {
        window.dispatchEvent(new Event(APPROVALS_UPDATED_EVENT));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function persistPurposeIfNeeded(token: string) {
    if (!trip) return trip;
    const nextPurpose = purpose.trim();
    const current =
      !trip.purpose || trip.purpose === "New trip" ? "" : trip.purpose;
    if (nextPurpose === current) return trip;
    const next = await tripsApi.update(
      trip.id,
      { purpose: nextPurpose },
      token,
    );
    applyTrip(next);
    return next;
  }

  async function syncCriteriaFromSearch(criteria: {
    destinationCity: string;
    destinationCountry: string | null;
    depart: string;
    returnDate: string;
  }) {
    const token = getStoredAccessToken();
    if (!token || !trip) return;
    let countryCode: string | null = trip.destinationCountry;
    if (criteria.destinationCountry) {
      try {
        countryCode =
          normalizeCountryInput(criteria.destinationCountry) || null;
      } catch {
        countryCode = trip.destinationCountry;
      }
    }
    const endDate = criteria.returnDate || criteria.depart;
    try {
      const next = await tripsApi.update(
        trip.id,
        {
          purpose: purpose.trim(),
          destinationCity: criteria.destinationCity || null,
          destinationCountry: countryCode,
          startDate: criteria.depart,
          endDate,
        },
        token,
      );
      applyTrip(next);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to sync trip details from search",
      );
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading trip...</p>
      </main>
    );
  }

  if (!trip || !user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
        <p className="text-ss-muted lowercase">{error ?? "trip not found"}</p>
        <Link href="/trips" className="mt-4 text-sm text-ss-accent lowercase">
          back to trips
        </Link>
      </main>
    );
  }

  const isAdmin = user.role === "COMPANY_ADMIN";
  const canEdit = EDITABLE.has(trip.status);
  const token = getStoredAccessToken();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <AppHeader user={user} />

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ss-muted lowercase">
              status: {formatStatus(trip.status)}
              {trip.approval
                ? ` · approval ${formatStatus(trip.approval.status)}`
                : ""}
            </p>
            {canEdit ? (
              <div className="mt-3 space-y-2">
                <Label className="lowercase text-ss-muted">purpose of trip</Label>
                <Input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. client workshop in berlin"
                  disabled={busy}
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
            ) : (
              <h1 className="mt-2 text-3xl font-medium text-ss-text lowercase">
                {trip.purpose || "untitled trip"}
              </h1>
            )}
            <p className="mt-3 text-sm lowercase text-ss-muted">
              {[
                trip.destinationCity,
                formatCountryLabel(trip.destinationCountry) || null,
              ]
                .filter(Boolean)
                .join(", ") || "destination from search"}
              {" · "}
              {trip.destinationCity
                ? `${trip.startDate} → ${trip.endDate}`
                : "dates from search"}
              {trip.budgetAmount != null
                ? ` · budget ${trip.budgetAmount} ${trip.budgetCurrency}`
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
                void runAction(async () => {
                  await persistPurposeIfNeeded(token);
                  return tripsApi.submit(trip.id, token);
                }, "submitted for approval.")
              }
              className="rounded-full bg-ss-accent px-4 text-white lowercase hover:bg-ss-accent-hover"
            >
              submit
            </Button>
          ) : null}
          {trip.status === "PENDING_APPROVAL" && isAdmin && token ? (
            <div className="w-full space-y-3">
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">decision comment</Label>
                <Input
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                  placeholder="optional note"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () =>
                        approvalsApi.approve(
                          trip.id,
                          decisionComment || undefined,
                          token,
                        ),
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
                      () =>
                        approvalsApi.reject(
                          trip.id,
                          decisionComment || undefined,
                          token,
                        ),
                      "trip rejected.",
                    )
                  }
                  className="rounded-full border border-white/20 bg-transparent px-4 text-ss-text lowercase hover:bg-white/5"
                >
                  reject
                </Button>
                <Link
                  href="/approvals"
                  className="inline-flex items-center text-sm text-ss-muted lowercase hover:text-ss-text"
                >
                  open queue
                </Link>
              </div>
            </div>
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
          {(trip.status === "DRAFT" ||
            trip.status === "PENDING_APPROVAL" ||
            trip.status === "APPROVED" ||
            trip.status === "REJECTED" ||
            trip.status === "CANCELLED") &&
          token ? (
            <Button
              disabled={busy}
              onClick={() => setDeleteOpen(true)}
              className="rounded-full border border-red-400/40 bg-transparent px-4 text-red-300 lowercase hover:bg-red-400/10"
            >
              delete
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

        {history && history.actions.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-lg font-medium text-ss-text lowercase">approval history</h2>
            <ul className="mt-3 space-y-3 text-sm lowercase">
              {history.actions.map((action) => (
                <li key={action.id} className="border-l border-white/15 pl-3">
                  <p className="text-ss-text">
                    {formatStatus(action.action)} · {action.actorName ?? action.actorEmail}
                  </p>
                  {action.comment ? (
                    <p className="mt-1 text-ss-muted">{action.comment}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-ss-muted">
                    {new Date(action.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <SelectedItinerarySummary trip={trip} />

        {canEdit && token ? (
          <div className="mt-10 border-t border-white/10 pt-8">
            <TripSearchWidget
              tripId={trip.id}
              accessToken={token}
              defaultOrigin=""
              defaultDestination={
                airportFromCityName(trip.destinationCity)?.iata ?? ""
              }
              defaultCity={trip.destinationCity ?? ""}
              defaultDepart={trip.destinationCity ? trip.startDate : ""}
              defaultReturn={
                trip.destinationCity && trip.endDate !== trip.startDate
                  ? trip.endDate
                  : ""
              }
              currency={trip.budgetCurrency}
              disabled={busy}
              onCriteriaChange={async (criteria) => {
                await syncCriteriaFromSearch(criteria);
              }}
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
                setMessage("flight attached — see your itinerary summary above");
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
                setMessage("hotel attached — see your itinerary summary above");
              }}
            />
          </div>
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
                {[trip.destinationCity, formatCountryLabel(trip.destinationCountry)]
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

      <ConfirmDialog
        open={deleteOpen}
        title="delete this trip?"
        description={`"${trip.purpose || "untitled trip"}" will be removed from your trip list. this cannot be undone from here.`}
        confirmLabel="delete trip"
        cancelLabel="keep trip"
        busy={busy}
        onCancel={() => {
          if (busy) return;
          setDeleteOpen(false);
        }}
        onConfirm={() => {
          const accessToken = getStoredAccessToken();
          if (!accessToken || busy) return;
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await tripsApi.remove(trip.id, accessToken);
              window.dispatchEvent(new Event(APPROVALS_UPDATED_EVENT));
              router.push("/trips");
            } catch (err) {
              setError(
                err instanceof ApiError
                  ? err.message
                  : "Unable to delete trip",
              );
              setBusy(false);
            }
          })();
        }}
      />
    </main>
  );
}
