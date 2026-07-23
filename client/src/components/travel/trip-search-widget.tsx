"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { aiApi } from "@/lib/api/ai";
import { travelApi, FlightOffer, HotelOffer } from "@/lib/api/travel";
import { AirportCombobox } from "@/components/travel/airport-combobox";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findAirportByIata, GEORGIA_ORIGIN_AIRPORTS, resolveAirportQuery } from "@/lib/airports";
import {
  formatDuration,
  formatFlightClock,
  formatFlightDateTime,
  formatHotelStayPrice,
  formatNights,
  nightsBetween,
} from "@/lib/format-travel";
import { parseTravelPrompt } from "@/lib/parse-travel-prompt";

const PAGE_SIZE = 3;

type TripSearchWidgetProps = {
  tripId: string;
  accessToken: string;
  defaultOrigin?: string;
  defaultDestination?: string;
  defaultCity?: string;
  defaultDepart?: string;
  defaultReturn?: string;
  currency?: string;
  onSelectFlight: (offer: FlightOffer) => Promise<void>;
  onSelectHotel: (offer: HotelOffer) => Promise<void>;
  onCriteriaChange?: (criteria: {
    origin: string;
    destination: string;
    destinationCity: string;
    destinationCountry: string | null;
    depart: string;
    returnDate: string;
    tripType: "one_way" | "round_trip";
  }) => Promise<void> | void;
  disabled?: boolean;
};

function sortByPrice<T extends { priceAmount: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = a.priceAmount ?? Number.POSITIVE_INFINITY;
    const pb = b.priceAmount ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  });
}

function cheapestId(
  items: Array<{ id: string; priceAmount: number | null }>,
): string | null {
  const sorted = sortByPrice(items);
  return sorted[0]?.priceAmount != null ? sorted[0].id : null;
}

function hotelImages(offer: HotelOffer): string[] {
  if (offer.images?.length) return offer.images;
  if (offer.thumbnail) return [offer.thumbnail];
  return [];
}

function hotelCardPhoto(offer: HotelOffer): string | null {
  return offer.thumbnail ?? offer.images?.[0] ?? null;
}

function utcTodayIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isPastUtcDate(value: string, today: string): boolean {
  return Boolean(value) && value < today;
}

function sanitizeTravelDate(value: string, today: string): string {
  if (!value) return "";
  return isPastUtcDate(value, today) ? "" : value;
}

export function TripSearchWidget({
  tripId,
  accessToken,
  defaultOrigin = "",
  defaultDestination = "",
  defaultCity = "",
  defaultDepart = "",
  defaultReturn = "",
  currency = "EUR",
  onSelectFlight,
  onSelectHotel,
  onCriteriaChange,
  disabled = false,
}: TripSearchWidgetProps) {
  const today = useMemo(() => utcTodayIso(), []);
  const [origin, setOrigin] = useState(defaultOrigin.toUpperCase());
  const [destination, setDestination] = useState(
    defaultDestination.toUpperCase(),
  );
  const [city, setCity] = useState(defaultCity);
  const [depart, setDepart] = useState(() =>
    sanitizeTravelDate(defaultDepart, utcTodayIso()),
  );
  const [ret, setRet] = useState(() => {
    const safeToday = utcTodayIso();
    const safeDepart = sanitizeTravelDate(defaultDepart, safeToday);
    const safeReturn = sanitizeTravelDate(defaultReturn, safeToday);
    if (safeReturn && safeDepart && safeReturn < safeDepart) return "";
    return safeReturn;
  });
  const [tripType, setTripType] = useState<"one_way" | "round_trip">(
    defaultReturn ? "round_trip" : "one_way",
  );
  const [adults, setAdults] = useState("1");
  const [nlPrompt, setNlPrompt] = useState("");
  const [nlConversation, setNlConversation] = useState<string | null>(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(
    null,
  );
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [intentDraft, setIntentDraft] = useState<{
    originIata: string | null;
    destinationIata: string | null;
    originCity: string | null;
    destinationCity: string | null;
    departureDate: string | null;
    returnDate: string | null;
    tripType: "one_way" | "round_trip" | null;
    adults: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [flights, setFlights] = useState<FlightOffer[]>([]);
  const [hotels, setHotels] = useState<HotelOffer[]>([]);
  const [flightVisible, setFlightVisible] = useState(PAGE_SIZE);
  const [hotelVisible, setHotelVisible] = useState(PAGE_SIZE);
  const [hasSearched, setHasSearched] = useState(false);
  const [hotelDetail, setHotelDetail] = useState<HotelOffer | null>(null);
  const [hotelPhotoIndex, setHotelPhotoIndex] = useState(0);

  const originLabel = findAirportByIata(origin);
  const destinationLabel = findAirportByIata(destination);
  const cheapestFlightId = useMemo(() => cheapestId(flights), [flights]);
  const cheapestHotelId = useMemo(() => cheapestId(hotels), [hotels]);
  const visibleFlights = flights.slice(0, flightVisible);
  const visibleHotels = hotels.slice(0, hotelVisible);

  useEffect(() => {
    if (!hotelDetail) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setHotelDetail(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotelDetail]);

  useEffect(() => {
    if (isPastUtcDate(depart, today)) {
      setDepart("");
    }
    if (isPastUtcDate(ret, today) || (ret && depart && ret < depart)) {
      setRet("");
    }
  }, [today, depart, ret]);

  function assertTravelDates(
    nextDepart: string,
    nextReturn: string,
    nextTripType: "one_way" | "round_trip",
  ): string | null {
    if (!nextDepart) {
      return "pick a depart date on or after today";
    }
    if (isPastUtcDate(nextDepart, today)) {
      return "depart date must be on or after today";
    }
    if (nextTripType === "round_trip") {
      if (!nextReturn) {
        return "pick a return date for round trip, or switch to one way";
      }
      if (isPastUtcDate(nextReturn, today) || nextReturn < nextDepart) {
        return "return date must be on or after the depart date";
      }
    } else if (nextReturn && nextReturn < nextDepart) {
      return "hotel checkout must be on or after the depart date";
    }
    return null;
  }

  async function runMarketSearch(params: {
    origin: string;
    destination: string;
    depart: string;
    ret: string;
    city: string;
    adults: number;
    tripType: "one_way" | "round_trip";
  }) {
    const hotelCity =
      params.city.trim() ||
      findAirportByIata(params.destination)?.city ||
      params.destination;
    const returnDate =
      params.tripType === "round_trip" && params.ret
        ? params.ret
        : undefined;
    // One-way flights may still include a stay end date for hotel checkout.
    const hotelCheckOut = params.ret || returnDate || params.depart;
    const [flightResult, hotelResult] = await Promise.all([
      travelApi.searchFlights(
        {
          origin: params.origin,
          destination: params.destination,
          departureDate: params.depart,
          returnDate,
          adults: params.adults,
          currency,
        },
        accessToken,
      ),
      travelApi.searchHotels(
        {
          city: hotelCity,
          checkIn: params.depart,
          checkOut: hotelCheckOut,
          adults: params.adults,
          currency,
        },
        accessToken,
      ),
    ]);
    const nextFlights = sortByPrice(flightResult.items);
    const nextHotels = sortByPrice(hotelResult.items);
    setFlights(nextFlights);
    setHotels(nextHotels);
    setFlightVisible(PAGE_SIZE);
    setHotelVisible(PAGE_SIZE);
    setHasSearched(true);

    if (onCriteriaChange) {
      const destAirport = findAirportByIata(params.destination);
      await onCriteriaChange({
        origin: params.origin,
        destination: params.destination,
        destinationCity:
          params.city.trim() || destAirport?.city || params.destination,
        destinationCountry: destAirport?.country ?? null,
        depart: params.depart,
        returnDate: returnDate ?? "",
        tripType: params.tripType,
      });
    }

    return { nextFlights, nextHotels, flightResult, hotelResult };
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    if (origin.length !== 3 || destination.length !== 3) {
      setError("pick a city/airport from the list for from and to");
      return;
    }
    const dateError = assertTravelDates(depart, ret, tripType);
    if (dateError) {
      setError(dateError);
      return;
    }
    setSearching(true);
    setError(null);
    setMessage(null);
    try {
      const adultsCount = Math.max(1, Number(adults) || 1);
      const { nextFlights, nextHotels, flightResult, hotelResult } =
        await runMarketSearch({
          origin,
          destination,
          depart,
          ret,
          city,
          adults: adultsCount,
          tripType,
        });
      setMessage(
        `found ${nextFlights.length} flights (${tripType === "round_trip" ? "round trip" : "one way"}) and ${nextHotels.length} hotels · showing top ${PAGE_SIZE}` +
          (flightResult.cached || hotelResult.cached ? " (cached)" : ""),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function softFillFromParsed(parsed: {
    originIata: string | null;
    destinationIata: string | null;
    destinationCity: string | null;
    departureDate: string | null;
    returnDate: string | null;
    tripType: "one_way" | "round_trip" | null;
    adults: number | null;
  }) {
    if (parsed.originIata) setOrigin(parsed.originIata);
    if (parsed.destinationIata) setDestination(parsed.destinationIata);
    if (parsed.destinationCity) setCity(parsed.destinationCity);
    if (parsed.departureDate) setDepart(parsed.departureDate);
    if (parsed.returnDate) {
      setRet(parsed.returnDate);
      setTripType(parsed.tripType ?? "round_trip");
    } else if (parsed.tripType) {
      setTripType(parsed.tripType);
    }
    if (parsed.adults) setAdults(String(parsed.adults));
  }

  function mergeIntentDraft<T extends {
    originIata: string | null;
    destinationIata: string | null;
    originCity: string | null;
    destinationCity: string | null;
    departureDate: string | null;
    returnDate: string | null;
    tripType: "one_way" | "round_trip" | null;
    adults: number | null;
    notes: string[];
    clarifyingQuestion: string | null;
  }>(parsed: T, draft: typeof intentDraft): T {
    if (!draft) return parsed;
    const merged = {
      ...parsed,
      originIata: parsed.originIata ?? draft.originIata,
      destinationIata: parsed.destinationIata ?? draft.destinationIata,
      originCity: parsed.originCity ?? draft.originCity,
      destinationCity: parsed.destinationCity ?? draft.destinationCity,
      departureDate: parsed.departureDate ?? draft.departureDate,
      returnDate: parsed.returnDate ?? draft.returnDate,
      tripType: parsed.tripType ?? draft.tripType,
      adults: parsed.adults ?? draft.adults,
    };
    const ready =
      Boolean(merged.originIata) &&
      Boolean(merged.destinationIata) &&
      Boolean(merged.departureDate) &&
      merged.originIata !== merged.destinationIata;
    return {
      ...merged,
      clarifyingQuestion: ready
        ? null
        : !merged.destinationIata
          ? "Where do you want to go?"
          : !merged.originIata
            ? "Where are you departing from?"
            : !merged.departureDate
              ? "What departure date should we use? (for example 25 January)"
              : merged.clarifyingQuestion,
    };
  }

  function enrichConversation(
    base: string,
    focus: "origin" | "destination" | "departureDate",
    answer: string,
  ): string {
    if (focus === "origin") return `${base}\nfrom ${answer}`.trim();
    if (focus === "destination") return `${base}\nto ${answer}`.trim();
    return `${base}\ndeparting ${answer}`.trim();
  }

  function saveIntentDraft(parsed: {
    originIata: string | null;
    destinationIata: string | null;
    originCity: string | null;
    destinationCity: string | null;
    departureDate: string | null;
    returnDate: string | null;
    tripType: "one_way" | "round_trip" | null;
    adults: number | null;
  }) {
    setIntentDraft({
      originIata: parsed.originIata,
      destinationIata: parsed.destinationIata,
      originCity: parsed.originCity,
      destinationCity: parsed.destinationCity,
      departureDate: parsed.departureDate,
      returnDate: parsed.returnDate,
      tripType: parsed.tripType,
      adults: parsed.adults,
    });
  }

  async function parsePromptAndSearch(
    promptText: string,
    clarification?: {
      answer: string;
      focus: "origin" | "destination" | "departureDate";
    },
  ) {
    let parsed = parseTravelPrompt(promptText);
    parsed = mergeIntentDraft(parsed, intentDraft);

    try {
      const remote = await aiApi.parseTravelIntent(
        {
          prompt: promptText,
          referenceDate: new Date().toISOString().slice(0, 10),
          clarificationAnswer: clarification?.answer,
          clarificationFocus: clarification?.focus,
        },
        accessToken,
      );
      parsed = {
        originIata: remote.originIata ?? parsed.originIata,
        destinationIata: remote.destinationIata ?? parsed.destinationIata,
        originCity: remote.originCity ?? parsed.originCity,
        destinationCity: remote.destinationCity ?? parsed.destinationCity,
        departureDate: remote.departureDate ?? parsed.departureDate,
        returnDate: remote.returnDate ?? parsed.returnDate,
        tripType: remote.tripType ?? parsed.tripType,
        adults: remote.adults ?? parsed.adults,
        notes: remote.notes?.length ? remote.notes : parsed.notes,
        clarifyingQuestion:
          remote.clarifyingQuestion ?? parsed.clarifyingQuestion,
      };
      // Keep answers from earlier clarification rounds (API is stateless).
      parsed = mergeIntentDraft(parsed, intentDraft);
      if (clarification?.focus === "origin" && clarification.answer.trim()) {
        const place = resolveAirportQuery(clarification.answer);
        if (place && place.iata !== parsed.destinationIata) {
          parsed = {
            ...parsed,
            originIata: place.iata,
            originCity: place.city,
          };
        }
      }
      if (
        clarification?.focus === "destination" &&
        clarification.answer.trim()
      ) {
        const place = resolveAirportQuery(clarification.answer);
        if (place && place.iata !== parsed.originIata) {
          parsed = {
            ...parsed,
            destinationIata: place.iata,
            destinationCity: place.city,
          };
        }
      }
      if (
        clarification?.focus === "departureDate" &&
        clarification.answer.trim() &&
        !parsed.departureDate
      ) {
        // Server should have applied this; keep a client safety net via re-ask.
        parsed = {
          ...parsed,
          clarifyingQuestion:
            "What departure date should we use? (for example 25 January)",
        };
      }
      parsed = mergeIntentDraft(parsed, {
        originIata: parsed.originIata,
        destinationIata: parsed.destinationIata,
        originCity: parsed.originCity,
        destinationCity: parsed.destinationCity,
        departureDate: parsed.departureDate,
        returnDate: parsed.returnDate,
        tripType: parsed.tripType,
        adults: parsed.adults,
      });
    } catch {
      if (clarification?.answer.trim()) {
        const answer = clarification.answer.trim();
        if (clarification.focus === "origin") {
          const place = resolveAirportQuery(answer);
          if (place && place.iata !== parsed.destinationIata) {
            parsed = {
              ...parsed,
              originIata: place.iata,
              originCity: place.city,
            };
          }
        } else if (clarification.focus === "destination") {
          const place = resolveAirportQuery(answer);
          if (place && place.iata !== parsed.originIata) {
            parsed = {
              ...parsed,
              destinationIata: place.iata,
              destinationCity: place.city,
            };
          }
        }
        parsed = mergeIntentDraft(parsed, {
          originIata: parsed.originIata,
          destinationIata: parsed.destinationIata,
          originCity: parsed.originCity,
          destinationCity: parsed.destinationCity,
          departureDate: parsed.departureDate,
          returnDate: parsed.returnDate,
          tripType: parsed.tripType,
          adults: parsed.adults,
        });
      }
    }

    softFillFromParsed(parsed);
    saveIntentDraft(parsed);

    const sameCity =
      Boolean(parsed.originIata) &&
      parsed.originIata === parsed.destinationIata;
    if (sameCity) {
      parsed = {
        ...parsed,
        originIata: null,
        originCity: null,
        clarifyingQuestion: "Where are you departing from?",
        notes: [
          ...parsed.notes,
          "departure city was missing — ignored same-city origin matching the destination",
        ],
      };
      softFillFromParsed(parsed);
      saveIntentDraft(parsed);
      setOrigin("");
    }

    if (!parsed.originIata || !parsed.destinationIata || !parsed.departureDate) {
      if (!nlConversation) setNlConversation(promptText);
      setClarifyingQuestion(
        parsed.clarifyingQuestion ??
          (!parsed.originIata
            ? "Where are you departing from?"
            : !parsed.departureDate
              ? "What departure date should we use? (for example 25 January)"
              : "Could you add a bit more detail so we can search flights and hotels?"),
      );
      setClarifyAnswer("");
      setMessage(
        "understood part of your trip — answer below to continue, or edit the fields.",
      );
      return;
    }

    const nextOrigin = parsed.originIata;
    const nextDestination = parsed.destinationIata;
    const nextDepart = isPastUtcDate(parsed.departureDate, today)
      ? ""
      : parsed.departureDate;
    const rawReturn = parsed.returnDate ?? "";
    const nextReturn =
      rawReturn &&
      !isPastUtcDate(rawReturn, today) &&
      (!nextDepart || rawReturn >= nextDepart)
        ? rawReturn
        : "";
    const nextTripType: "one_way" | "round_trip" =
      parsed.tripType ?? (nextReturn ? "round_trip" : "one_way");
    const nextCity = parsed.destinationCity ?? city;
    const nextAdults = String(parsed.adults ?? Math.max(1, Number(adults) || 1));

    setOrigin(nextOrigin);
    setDestination(nextDestination);
    setDepart(nextDepart);
    setRet(nextReturn);
    setTripType(nextTripType);
    setCity(nextCity);
    setAdults(nextAdults);

    if (isPastUtcDate(parsed.departureDate, today)) {
      setNlConversation(null);
      setClarifyingQuestion(null);
      setClarifyAnswer("");
      setIntentDraft(null);
      setError("depart date must be on or after today — pick a future date");
      setMessage(
        `understood route ${parsed.originCity ?? nextOrigin} → ${parsed.destinationCity ?? nextDestination}, but ${parsed.departureDate} is in the past`,
      );
      return;
    }

    const dateError = assertTravelDates(nextDepart, nextReturn, nextTripType);
    if (dateError) {
      setNlConversation(null);
      setClarifyingQuestion(null);
      setClarifyAnswer("");
      setIntentDraft(null);
      setError(dateError);
      return;
    }

    setNlConversation(null);
    setClarifyingQuestion(null);
    setClarifyAnswer("");
    setIntentDraft(null);

    const { nextFlights, nextHotels } = await runMarketSearch({
      origin: nextOrigin,
      destination: nextDestination,
      depart: nextDepart,
      ret: nextReturn,
      city: nextCity,
      adults: Number(nextAdults) || 1,
      tripType: nextTripType,
    });

    const mappingNote = parsed.notes.find((n) => /→/.test(n));
    setMessage(
      `understood: ${parsed.originCity ?? nextOrigin} (${nextOrigin}) → ${parsed.destinationCity ?? nextDestination} (${nextDestination}) · ${nextDepart}${nextReturn ? ` to ${nextReturn}` : ""} · ${nextTripType === "round_trip" ? "round trip" : "one way"} · found ${nextFlights.length} flights and ${nextHotels.length} hotels${mappingNote ? ` · ${mappingNote}` : ""}`,
    );
  }

  function clarificationFocusFromQuestion(
    question: string | null,
  ): "origin" | "destination" | "departureDate" {
    const q = (question ?? "").toLowerCase();
    if (/destin|want to go|which city or airport/.test(q)) return "destination";
    if (/date|when/.test(q)) return "departureDate";
    return "origin";
  }

  async function onSuggestFromPrompt() {
    if (disabled || suggesting) return;
    const text = nlPrompt.trim();
    if (text.length < 8) {
      setError(
        'describe your trip, e.g. "from 1 august to 6 august from tbilisi to berlin"',
      );
      return;
    }

    setSuggesting(true);
    setError(null);
    setMessage(null);
    setClarifyingQuestion(null);
    setNlConversation(null);
    setIntentDraft(null);

    try {
      await parsePromptAndSearch(text);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not suggest trips",
      );
    } finally {
      setSuggesting(false);
    }
  }

  async function onClarifyContinue() {
    if (disabled || suggesting) return;
    const answer = clarifyAnswer.trim();
    if (answer.length < 2) {
      setError("please answer the question above");
      return;
    }
    const base = (nlConversation ?? nlPrompt).trim();
    const focus = clarificationFocusFromQuestion(clarifyingQuestion);
    const enriched = enrichConversation(base, focus, answer);

    setNlConversation(enriched);
    setSuggesting(true);
    setError(null);
    setMessage(null);
    try {
      await parsePromptAndSearch(enriched, { answer, focus });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not suggest trips",
      );
    } finally {
      setSuggesting(false);
    }
  }

  async function selectFlight(offer: FlightOffer) {
    setAttachingId(offer.id);
    setError(null);
    try {
      await onSelectFlight(offer);
      setMessage(`flight selected · scroll up to see your itinerary summary`);
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
      setMessage(`hotel selected · scroll up to see your itinerary summary`);
      setHotelDetail(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to attach hotel");
    } finally {
      setAttachingId(null);
    }
  }

  function openHotelDetail(offer: HotelOffer) {
    setHotelDetail(offer);
    setHotelPhotoIndex(0);
  }

  const detailPhotos = hotelDetail ? hotelImages(hotelDetail) : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-ss-text lowercase">travel search</h2>
        <p className="mt-1 text-sm text-ss-muted lowercase">
          type a free-text trip request, or fill the fields below. results show 3
          at a time — use load more for more options.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-ss-surface-strong p-4 sm:p-5">
        <Label className="lowercase text-ss-muted">describe your trip</Label>
        <textarea
          value={nlPrompt}
          onChange={(e) => {
            setNlPrompt(e.target.value);
            if (clarifyingQuestion) {
              setClarifyingQuestion(null);
              setNlConversation(null);
              setClarifyAnswer("");
              setIntentDraft(null);
            }
          }}
          disabled={disabled || suggesting}
          rows={3}
          placeholder='i want round trip from kutaisi to cyprus from 20 august to 25 august'
          className="mt-2 w-full resize-y rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-sm lowercase text-ss-text placeholder:text-ss-muted focus:outline-none focus:ring-1 focus:ring-ss-accent"
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={disabled || suggesting}
            onClick={() => void onSuggestFromPrompt()}
            className="h-11 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
          >
            {suggesting && !clarifyingQuestion
              ? "suggesting…"
              : "suggest flights & hotels"}
          </Button>
        </div>

        {clarifyingQuestion ? (
          <div className="mt-4 rounded-2xl border border-ss-accent/40 bg-ss-accent/10 p-4">
            <p className="text-sm lowercase text-ss-text">{clarifyingQuestion}</p>
            <Input
              value={clarifyAnswer}
              onChange={(e) => setClarifyAnswer(e.target.value)}
              disabled={disabled || suggesting}
              placeholder="type your answer…"
              className="mt-3 h-11 rounded-full border-white/20 bg-transparent px-4 text-ss-text lowercase placeholder:text-ss-muted"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onClarifyContinue();
                }
              }}
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={disabled || suggesting}
                onClick={() => void onClarifyContinue()}
                className="h-11 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
              >
                {suggesting ? "continuing…" : "continue"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <form onSubmit={onSearch} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-white/15 bg-ss-surface-strong p-4">
            <Label className="lowercase text-ss-muted">from?</Label>
            <AirportCombobox
              valueIata={origin}
              aria-label="from airport"
              disabled={disabled}
              placeholder="tbilisi, batumi, kutaisi"
              airports={GEORGIA_ORIGIN_AIRPORTS}
              onChange={(airport) => setOrigin(airport?.iata ?? "")}
              inputClassName="text-ss-text placeholder:text-ss-muted"
              className="mt-2"
            />
          </div>
          <div className="rounded-3xl border border-white/15 bg-ss-surface-strong p-4">
            <Label className="lowercase text-ss-muted">to?</Label>
            <AirportCombobox
              valueIata={destination}
              aria-label="to airport"
              disabled={disabled}
              placeholder="berlin, istanbul…"
              onChange={(airport) => {
                setDestination(airport?.iata ?? "");
                if (airport && !city.trim()) {
                  setCity(airport.city);
                }
              }}
              inputClassName="text-ss-text placeholder:text-ss-muted"
              className="mt-2"
            />
          </div>
          <div className="rounded-3xl border border-white/15 bg-ss-surface-strong p-4">
            <Label className="lowercase text-ss-muted">when?</Label>
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setTripType("one_way");
                    setRet("");
                  }}
                  className={`h-9 flex-1 rounded-xl text-xs lowercase transition-colors ${
                    tripType === "one_way"
                      ? "bg-ss-accent text-white"
                      : "border border-white/20 text-ss-muted hover:bg-white/5"
                  }`}
                >
                  one way
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setTripType("round_trip")}
                  className={`h-9 flex-1 rounded-xl text-xs lowercase transition-colors ${
                    tripType === "round_trip"
                      ? "bg-ss-accent text-white"
                      : "border border-white/20 text-ss-muted hover:bg-white/5"
                  }`}
                >
                  round trip
                </button>
              </div>
              <DateInput
                required
                value={depart}
                onChange={setDepart}
                disabled={disabled}
                min={today}
                aria-label="depart date"
                triggerClassName="h-10 border-white/20 bg-black/20 text-ss-text hover:border-white/35"
              />
              {tripType === "round_trip" ? (
                <DateInput
                  required
                  value={ret}
                  onChange={setRet}
                  disabled={disabled}
                  aria-label="return date"
                  min={depart && depart > today ? depart : today}
                  triggerClassName="h-10 border-white/20 bg-black/20 text-ss-text hover:border-white/35"
                />
              ) : null}
            </div>
          </div>
          <div className="rounded-3xl border border-white/15 bg-ss-surface-strong p-4">
            <Label className="lowercase text-ss-muted">hotel city</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={destinationLabel?.city ?? "city name"}
              disabled={disabled}
              className="mt-2 h-10 rounded-xl border-0 bg-transparent text-ss-text placeholder:text-ss-muted"
            />
            <Label className="mt-2 block lowercase text-ss-muted">adults</Label>
            <Input
              type="number"
              min={1}
              max={9}
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
              disabled={disabled}
              className="mt-1 h-10 rounded-xl border-0 bg-transparent text-ss-text"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={disabled || searching}
            className="h-11 rounded-full bg-ss-accent px-8 text-white lowercase hover:bg-ss-accent-hover"
          >
            {searching ? "searching market…" : "search flights & hotels"}
          </Button>
        </div>
      </form>

      {originLabel || destinationLabel ? (
        <p className="text-xs text-ss-muted lowercase">
          route: {originLabel ? `${originLabel.city} (${origin})` : origin || "—"} →{" "}
          {destinationLabel
            ? `${destinationLabel.city} (${destination})`
            : destination || "—"}
        </p>
      ) : null}

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
            <h3 className="text-sm text-ss-muted lowercase">
              flights · cheapest first · showing {visibleFlights.length} of{" "}
              {flights.length}
            </h3>
            {flights.length === 0 ? (
              <p className="mt-3 text-sm text-ss-muted lowercase">no flights found</p>
            ) : (
              <>
                <ul className="mt-3 space-y-3">
                  {visibleFlights.map((offer) => {
                    const isCheapest = offer.id === cheapestFlightId;
                    return (
                      <li
                        key={offer.id}
                        className={`rounded-2xl border p-4 text-sm lowercase ${
                          isCheapest
                            ? "border-ss-accent/50 bg-ss-surface-strong"
                            : "border-white/10 bg-ss-surface-strong"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-ss-text">
                              {offer.airline ?? "airline n/a"}
                            </p>
                            <p className="mt-1 text-ss-muted">
                              {offer.origin} → {offer.destination}
                              {" · "}
                              {offer.tripType === "round_trip"
                                ? "round trip"
                                : "one way"}
                              {offer.travelClass ? ` · ${offer.travelClass}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {isCheapest ? (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] text-ss-muted">
                                cheapest
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 space-y-3">
                        <div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-ss-muted">depart</p>
                              <p className="text-ss-text">
                                {formatFlightClock(offer.departAt)}
                              </p>
                              <p className="text-xs text-ss-muted">
                                {formatFlightDateTime(offer.departAt)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-ss-muted">arrive</p>
                              <p className="text-ss-text">
                                {formatFlightClock(offer.arriveAt)}
                              </p>
                              <p className="text-xs text-ss-muted">
                                {formatFlightDateTime(offer.arriveAt)}
                              </p>
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-ss-muted">
                            duration{" "}
                            {formatDuration(
                              offer.outboundDurationMinutes ??
                                offer.totalDurationMinutes,
                            )}
                          </p>
                        </div>
                        {offer.tripType === "round_trip" ? (
                          <div>
                            <p className="text-xs text-ss-muted">return</p>
                            <div className="mt-1 grid gap-2 sm:grid-cols-2">
                              <div>
                                <p className="text-xs text-ss-muted">depart</p>
                                <p className="text-ss-text">
                                  {formatFlightClock(offer.returnDepartAt)}
                                </p>
                                <p className="text-xs text-ss-muted">
                                  {formatFlightDateTime(offer.returnDepartAt)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-ss-muted">arrive</p>
                                <p className="text-ss-text">
                                  {formatFlightClock(offer.returnArriveAt)}
                                </p>
                                <p className="text-xs text-ss-muted">
                                  {formatFlightDateTime(offer.returnArriveAt)}
                                </p>
                              </div>
                            </div>
                            <p className="mt-1 text-xs text-ss-muted">
                              duration{" "}
                              {formatDuration(offer.returnDurationMinutes)}
                            </p>
                          </div>
                        ) : null}
                      </div>

                        <p className="mt-3 text-ss-muted">
                          {offer.priceAmount != null
                            ? `${offer.priceAmount} ${offer.currency ?? currency}`
                            : "price n/a"}
                          {" · "}
                          {offer.tripType === "round_trip"
                            ? "round trip"
                            : "one way"}
                          {" · "}
                          {offer.stops === 0
                            ? "direct"
                            : `${offer.stops} stop${offer.stops === 1 ? "" : "s"}`}
                        </p>
                        <Button
                          type="button"
                          disabled={disabled || attachingId === offer.id}
                          onClick={() => void selectFlight(offer)}
                          className="mt-3 h-9 rounded-full bg-ss-accent px-4 text-white lowercase hover:bg-ss-accent-hover"
                        >
                          {attachingId === offer.id
                            ? "attaching..."
                            : "select flight"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                {flightVisible < flights.length ? (
                  <Button
                    type="button"
                    onClick={() =>
                      setFlightVisible((n) =>
                        Math.min(n + PAGE_SIZE, flights.length),
                      )
                    }
                    className="mt-3 h-9 rounded-full border border-white/20 bg-transparent px-4 text-ss-text lowercase hover:bg-white/5"
                  >
                    load more flights ({flights.length - flightVisible} left)
                  </Button>
                ) : null}
              </>
            )}
          </div>
          <div>
            <h3 className="text-sm text-ss-muted lowercase">
              hotels · cheapest first · stay total · showing{" "}
              {visibleHotels.length} of {hotels.length}
            </h3>
            {hotels.length === 0 ? (
              <p className="mt-3 text-sm text-ss-muted lowercase">no hotels found</p>
            ) : (
              <>
                <ul className="mt-3 space-y-3">
                  {visibleHotels.map((offer) => {
                    const isCheapest = offer.id === cheapestHotelId;
                    const photos = hotelImages(offer);
                    const cardPhoto = hotelCardPhoto(offer);
                    return (
                      <li
                        key={offer.id}
                        className={`overflow-hidden rounded-2xl border text-sm lowercase ${
                          isCheapest
                            ? "border-ss-accent/50 bg-ss-surface-strong"
                            : "border-white/10 bg-ss-surface-strong"
                        }`}
                      >
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => openHotelDetail(offer)}
                        >
                          {cardPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cardPhoto}
                              alt={offer.hotelName}
                              width={480}
                              height={144}
                              className="h-36 w-full object-cover"
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-24 items-center justify-center bg-white/5 text-xs text-ss-muted">
                              no photo
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="text-ss-text">{offer.hotelName}</p>
                              <div className="flex flex-wrap gap-1">
                                {isCheapest ? (
                                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] text-ss-muted">
                                    cheapest
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <p className="mt-1 text-ss-muted">
                              {formatHotelStayPrice({
                                priceAmount: offer.priceAmount,
                                currency: offer.currency ?? currency,
                                checkIn: offer.checkIn,
                                checkOut: offer.checkOut,
                                nights: offer.nights,
                                pricePerNight: offer.pricePerNight,
                              })}
                              {offer.rating
                                ? ` · ${offer.rating.toFixed(1)} rating`
                                : ""}
                              {photos.length > 1
                                ? ` · ${photos.length} photos`
                                : ""}
                            </p>
                            <p className="mt-2 text-xs text-ss-accent">
                              tap for details & more photos
                            </p>
                          </div>
                        </button>
                        <div className="border-t border-white/10 px-4 py-3">
                          <Button
                            type="button"
                            disabled={disabled || attachingId === offer.id}
                            onClick={() => void selectHotel(offer)}
                            className="h-9 rounded-full bg-ss-accent px-4 text-white lowercase hover:bg-ss-accent-hover"
                          >
                            {attachingId === offer.id
                              ? "attaching..."
                              : "select hotel"}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {hotelVisible < hotels.length ? (
                  <Button
                    type="button"
                    onClick={() =>
                      setHotelVisible((n) =>
                        Math.min(n + PAGE_SIZE, hotels.length),
                      )
                    }
                    className="mt-3 h-9 rounded-full border border-white/20 bg-transparent px-4 text-ss-text lowercase hover:bg-white/5"
                  >
                    load more hotels ({hotels.length - hotelVisible} left)
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {hotelDetail ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={hotelDetail.hotelName}
          onClick={() => setHotelDetail(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-[#071428] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-medium lowercase text-ss-text">
                  {hotelDetail.hotelName}
                </h3>
                <p className="mt-1 text-sm lowercase text-ss-muted">
                  {hotelDetail.city ?? "—"}
                  {hotelDetail.address ? ` · ${hotelDetail.address}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="text-sm lowercase text-ss-muted hover:text-ss-text"
                onClick={() => setHotelDetail(null)}
              >
                close
              </button>
            </div>

            {detailPhotos.length > 0 ? (
              <div className="mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={detailPhotos[hotelPhotoIndex] ?? detailPhotos[0]}
                  alt={`${hotelDetail.hotelName} photo ${hotelPhotoIndex + 1}`}
                  width={800}
                  height={288}
                  className="h-56 w-full rounded-2xl object-cover sm:h-72"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
                {detailPhotos.length > 1 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detailPhotos.slice(0, 8).map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        onClick={() => setHotelPhotoIndex(index)}
                        className={`overflow-hidden rounded-lg border ${
                          index === hotelPhotoIndex
                            ? "border-ss-accent"
                            : "border-white/15"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          width={80}
                          height={56}
                          className="h-14 w-20 object-cover"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 text-sm lowercase sm:grid-cols-2">
              <div>
                <p className="text-ss-muted">stay total</p>
                <p className="text-ss-text">
                  {formatHotelStayPrice({
                    priceAmount: hotelDetail.priceAmount,
                    currency: hotelDetail.currency ?? currency,
                    checkIn: hotelDetail.checkIn,
                    checkOut: hotelDetail.checkOut,
                    nights: hotelDetail.nights,
                    pricePerNight: hotelDetail.pricePerNight,
                  })}
                </p>
              </div>
              <div>
                <p className="text-ss-muted">rating</p>
                <p className="text-ss-text">
                  {hotelDetail.rating != null
                    ? hotelDetail.rating.toFixed(1)
                    : "—"}
                  {hotelDetail.stars != null ? ` · ${hotelDetail.stars}★` : ""}
                </p>
              </div>
              <div>
                <p className="text-ss-muted">check-in</p>
                <p className="text-ss-text">{hotelDetail.checkIn}</p>
              </div>
              <div>
                <p className="text-ss-muted">check-out</p>
                <p className="text-ss-text">{hotelDetail.checkOut}</p>
              </div>
              <div>
                <p className="text-ss-muted">nights</p>
                <p className="text-ss-text">
                  {formatNights(
                    hotelDetail.nights ??
                      nightsBetween(hotelDetail.checkIn, hotelDetail.checkOut),
                  ) || "—"}
                </p>
              </div>
            </div>

            {hotelDetail.description ? (
              <p className="mt-4 text-sm leading-relaxed text-ss-muted lowercase">
                {hotelDetail.description}
              </p>
            ) : null}

            {hotelDetail.amenities.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-ss-muted">
                  amenities
                </p>
                <p className="mt-2 text-sm lowercase text-ss-text">
                  {hotelDetail.amenities.join(" · ")}
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={disabled || attachingId === hotelDetail.id}
                onClick={() => void selectHotel(hotelDetail)}
                className="h-11 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
              >
                {attachingId === hotelDetail.id
                  ? "attaching..."
                  : "select this hotel"}
              </Button>
              <Button
                type="button"
                onClick={() => setHotelDetail(null)}
                className="h-11 rounded-full border border-white/20 bg-transparent px-6 text-ss-text lowercase hover:bg-white/5"
              >
                back
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
