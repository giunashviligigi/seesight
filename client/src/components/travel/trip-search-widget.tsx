"use client";

import { FormEvent, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { travelApi, FlightOffer, HotelOffer } from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TripSearchWidgetProps = {
  accessToken: string;
  defaultOrigin?: string;
  defaultDestination?: string;
  defaultCity?: string;
  defaultDepart?: string;
  defaultReturn?: string;
  currency?: string;
  onSelectFlight: (offer: FlightOffer) => Promise<void>;
  onSelectHotel: (offer: HotelOffer) => Promise<void>;
  disabled?: boolean;
};

export function TripSearchWidget({
  accessToken,
  defaultOrigin = "",
  defaultDestination = "",
  defaultCity = "",
  defaultDepart = "",
  defaultReturn = "",
  currency = "EUR",
  onSelectFlight,
  onSelectHotel,
  disabled = false,
}: TripSearchWidgetProps) {
  const [origin, setOrigin] = useState(defaultOrigin);
  const [destination, setDestination] = useState(defaultDestination);
  const [city, setCity] = useState(defaultCity);
  const [depart, setDepart] = useState(defaultDepart);
  const [ret, setRet] = useState(defaultReturn);
  const [adults, setAdults] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [flights, setFlights] = useState<FlightOffer[]>([]);
  const [hotels, setHotels] = useState<HotelOffer[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const filled =
    origin.trim().length >= 3 &&
    destination.trim().length >= 3 &&
    depart.length > 0;

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setSearching(true);
    setError(null);
    setMessage(null);
    try {
      const adultsCount = Math.max(1, Number(adults) || 1);
      const [flightResult, hotelResult] = await Promise.all([
        travelApi.searchFlights(
          {
            origin: origin.trim(),
            destination: destination.trim(),
            departureDate: depart,
            returnDate: ret || undefined,
            adults: adultsCount,
            currency,
          },
          accessToken,
        ),
        travelApi.searchHotels(
          {
            city: city.trim() || destination.trim(),
            checkIn: depart,
            checkOut: ret || depart,
            adults: adultsCount,
            currency,
          },
          accessToken,
        ),
      ]);
      setFlights(flightResult.items);
      setHotels(hotelResult.items);
      setHasSearched(true);
      setMessage(
        `found ${flightResult.items.length} flights and ${hotelResult.items.length} hotels` +
          (flightResult.cached || hotelResult.cached ? " (cached)" : ""),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function selectFlight(offer: FlightOffer) {
    setAttachingId(offer.id);
    setError(null);
    try {
      await onSelectFlight(offer);
      setMessage(`flight selected: ${offer.summary}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to attach flight");
    } finally {
      setAttachingId(null);
    }
  }

  async function selectHotel(offer: HotelOffer) {
    setAttachingId(offer.id);
    setError(null);
    try {
      await onSelectHotel(offer);
      setMessage(`hotel selected: ${offer.summary}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to attach hotel");
    } finally {
      setAttachingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-ss-text lowercase">travel search</h2>
        <p className="mt-1 text-sm text-ss-muted lowercase">
          serpapi flights + hotels · empty and filled search states
        </p>
      </div>

      <form onSubmit={onSearch} className="space-y-4">
        <div
          className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${
            filled ? "" : ""
          }`}
        >
          <div
            className={`rounded-3xl p-4 ${
              filled
                ? "border border-white/20 bg-ss-surface-strong"
                : "bg-[var(--ss-tile-from)] text-[color:var(--ss-text-on-light)]"
            }`}
          >
            <Label className={`lowercase ${filled ? "text-ss-muted" : "text-black/70"}`}>
              from?
            </Label>
            <Input
              required
              maxLength={3}
              value={origin}
              onChange={(e) => setOrigin(e.target.value.toUpperCase())}
              placeholder="TBS"
              disabled={disabled}
              className={`mt-2 h-11 rounded-xl border-0 ${
                filled
                  ? "bg-transparent text-ss-text"
                  : "bg-white/40 text-[color:var(--ss-text-on-light)] placeholder:text-black/40"
              }`}
            />
          </div>
          <div
            className={`rounded-3xl p-4 ${
              filled
                ? "border border-white/20 bg-ss-surface-strong"
                : "bg-[var(--ss-tile-to)] text-[color:var(--ss-text-on-light)]"
            }`}
          >
            <Label className={`lowercase ${filled ? "text-ss-muted" : "text-black/70"}`}>
              to?
            </Label>
            <Input
              required
              maxLength={3}
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase())}
              placeholder="BER"
              disabled={disabled}
              className={`mt-2 h-11 rounded-xl border-0 ${
                filled
                  ? "bg-transparent text-ss-text"
                  : "bg-white/40 text-[color:var(--ss-text-on-light)] placeholder:text-black/40"
              }`}
            />
          </div>
          <div
            className={`rounded-3xl p-4 ${
              filled
                ? "border border-white/20 bg-ss-surface-strong"
                : "bg-[var(--ss-tile-when)] text-[color:var(--ss-text-on-light)]"
            }`}
          >
            <Label className={`lowercase ${filled ? "text-ss-muted" : "text-black/70"}`}>
              when?
            </Label>
            <div className="mt-2 space-y-2">
              <Input
                required
                type="date"
                value={depart}
                onChange={(e) => setDepart(e.target.value)}
                disabled={disabled}
                className={`h-10 rounded-xl border-0 ${
                  filled
                    ? "bg-white text-[color:var(--ss-text-on-light)]"
                    : "bg-white/80 text-[color:var(--ss-text-on-light)]"
                }`}
              />
              <Input
                type="date"
                value={ret}
                onChange={(e) => setRet(e.target.value)}
                disabled={disabled}
                className={`h-10 rounded-xl ${
                  filled
                    ? "border border-white/30 bg-transparent text-ss-text"
                    : "border border-black/20 bg-transparent text-[color:var(--ss-text-on-light)]"
                }`}
              />
            </div>
          </div>
          <div
            className={`rounded-3xl p-4 ${
              filled
                ? "border border-white/20 bg-ss-surface-strong"
                : "bg-[var(--ss-tile-details)] text-[color:var(--ss-text-on-light)]"
            }`}
          >
            <Label className={`lowercase ${filled ? "text-ss-muted" : "text-black/70"}`}>
              details
            </Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="hotel city"
              disabled={disabled}
              className={`mt-2 h-10 rounded-xl border-0 ${
                filled
                  ? "bg-transparent text-ss-text"
                  : "bg-white/40 text-[color:var(--ss-text-on-light)] placeholder:text-black/40"
              }`}
            />
            <Input
              type="number"
              min={1}
              max={9}
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
              disabled={disabled}
              className={`mt-2 h-10 rounded-xl border-0 ${
                filled
                  ? "bg-transparent text-ss-text"
                  : "bg-white/40 text-[color:var(--ss-text-on-light)]"
              }`}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={disabled || searching}
          className="h-11 rounded-full bg-ss-accent px-8 text-white lowercase hover:bg-ss-accent-hover"
        >
          {searching ? "searching..." : "search"}
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-red-300 lowercase" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-ss-text lowercase" role="status">
          {message}
        </p>
      ) : null}

      {hasSearched ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm text-ss-muted lowercase">flights</h3>
            {flights.length === 0 ? (
              <p className="mt-3 text-sm text-ss-muted lowercase">no flights found</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {flights.map((offer) => (
                  <li
                    key={offer.id}
                    className="rounded-2xl border border-white/10 bg-ss-surface-strong p-4 text-sm lowercase"
                  >
                    <p className="text-ss-text">{offer.summary}</p>
                    <p className="mt-1 text-ss-muted">
                      {offer.stops} stops
                      {offer.totalDurationMinutes
                        ? ` · ${offer.totalDurationMinutes} min`
                        : ""}
                    </p>
                    <Button
                      type="button"
                      disabled={disabled || attachingId === offer.id}
                      onClick={() => void selectFlight(offer)}
                      className="mt-3 h-9 rounded-full bg-ss-accent px-4 text-white lowercase hover:bg-ss-accent-hover"
                    >
                      {attachingId === offer.id ? "attaching..." : "select flight"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm text-ss-muted lowercase">hotels</h3>
            {hotels.length === 0 ? (
              <p className="mt-3 text-sm text-ss-muted lowercase">no hotels found</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {hotels.map((offer) => (
                  <li
                    key={offer.id}
                    className="rounded-2xl border border-white/10 bg-ss-surface-strong p-4 text-sm lowercase"
                  >
                    <p className="text-ss-text">{offer.summary}</p>
                    <p className="mt-1 text-ss-muted">
                      {offer.rating ? `${offer.rating.toFixed(1)} rating · ` : ""}
                      {offer.amenities.slice(0, 3).join(" · ") || "amenities n/a"}
                    </p>
                    <Button
                      type="button"
                      disabled={disabled || attachingId === offer.id}
                      onClick={() => void selectHotel(offer)}
                      className="mt-3 h-9 rounded-full bg-ss-accent px-4 text-white lowercase hover:bg-ss-accent-hover"
                    >
                      {attachingId === offer.id ? "attaching..." : "select hotel"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
