"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { aiApi, type ClarificationFocus } from "@/lib/api/ai";
import { travelApi, FlightOffer, HotelOffer } from "@/lib/api/travel";
import { AirportCombobox } from "@/components/travel/airport-combobox";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findAirportByIata, GEORGIA_ORIGIN_AIRPORTS, resolveAirportQuery } from "@/lib/airports";
import type { BookingMode } from "@/lib/api/trips";
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

type IntentDraft = {
  originIata: string | null;
  destinationIata: string | null;
  originCity: string | null;
  destinationCity: string | null;
  departureDate: string | null;
  returnDate: string | null;
  tripType: "one_way" | "round_trip" | null;
  hotelNights: number | null;
  adults: number | null;
};

type ParsedIntent = IntentDraft & {
  notes: string[];
  clarifyingQuestion: string | null;
  clarificationFocus?: ClarificationFocus | null;
  isTravelRequest?: boolean;
  source?: "gemini" | "groq" | "heuristic";
};

function isIntentReady(
  parsed: {
    originIata: string | null;
    destinationIata: string | null;
    destinationCity?: string | null;
    departureDate: string | null;
    returnDate: string | null;
    tripType: "one_way" | "round_trip" | null;
    hotelNights: number | null;
    isTravelRequest?: boolean;
  },
  bookingMode: BookingMode = "BOTH",
): boolean {
  if (parsed.isTravelRequest === false) return false;

  if (bookingMode === "HOTELS") {
    const hasDest = Boolean(
      parsed.destinationIata || parsed.destinationCity?.trim(),
    );
    if (!hasDest || !parsed.departureDate) return false;
    if (
      parsed.returnDate &&
      parsed.returnDate >= parsed.departureDate
    ) {
      return true;
    }
    return (
      parsed.hotelNights != null &&
      Number.isFinite(parsed.hotelNights) &&
      parsed.hotelNights >= 1 &&
      parsed.hotelNights <= 30
    );
  }

  if (
    !parsed.originIata ||
    !parsed.destinationIata ||
    !parsed.departureDate ||
    parsed.originIata === parsed.destinationIata ||
    !parsed.tripType
  ) {
    return false;
  }
  if (parsed.tripType === "round_trip") {
    return Boolean(
      parsed.returnDate && parsed.returnDate >= parsed.departureDate,
    );
  }
  if (bookingMode === "FLIGHTS") return true;
  return (
    parsed.hotelNights != null &&
    Number.isFinite(parsed.hotelNights) &&
    parsed.hotelNights >= 1 &&
    parsed.hotelNights <= 30
  );
}

function inferFocusFromMissing(
  parsed: {
    originIata: string | null;
    destinationIata: string | null;
    destinationCity?: string | null;
    departureDate: string | null;
    returnDate: string | null;
    tripType: "one_way" | "round_trip" | null;
    hotelNights: number | null;
  },
  bookingMode: BookingMode = "BOTH",
): ClarificationFocus {
  const hasDest = Boolean(
    parsed.destinationIata || parsed.destinationCity?.trim(),
  );
  if (!hasDest) return "destination";
  if (bookingMode !== "HOTELS" && !parsed.originIata) return "origin";
  if (bookingMode !== "HOTELS" && !parsed.tripType) return "tripType";
  if (!parsed.departureDate) return "departureDate";
  if (
    (bookingMode === "FLIGHTS" || bookingMode === "BOTH") &&
    parsed.tripType === "round_trip" &&
    (!parsed.returnDate || parsed.returnDate < parsed.departureDate)
  ) {
    return "returnDate";
  }
  if (bookingMode === "HOTELS") {
    if (
      !parsed.returnDate ||
      parsed.returnDate < (parsed.departureDate ?? "")
    ) {
      if (
        parsed.hotelNights == null ||
        parsed.hotelNights < 1 ||
        parsed.hotelNights > 30
      ) {
        return "hotelNights";
      }
    }
    return "hotelNights";
  }
  if (bookingMode !== "FLIGHTS" && parsed.tripType === "one_way") {
    return "hotelNights";
  }
  return "destination";
}

function defaultClarifyQuestion(
  parsed: {
    originIata: string | null;
    destinationIata: string | null;
    destinationCity?: string | null;
    departureDate: string | null;
    returnDate: string | null;
    tripType: "one_way" | "round_trip" | null;
    hotelNights: number | null;
    isTravelRequest?: boolean;
  },
  bookingMode: BookingMode = "BOTH",
): string {
  const hasDest = Boolean(
    parsed.destinationIata || parsed.destinationCity?.trim(),
  );
  if (!hasDest) {
    if (parsed.isTravelRequest === false) {
      return "That doesn't look like a trip request. Where do you want to go?";
    }
    return bookingMode === "HOTELS"
      ? "Which city do you want a hotel in?"
      : "Where do you want to go?";
  }
  if (bookingMode !== "HOTELS" && !parsed.originIata) {
    return "Where are you departing from?";
  }
  if (bookingMode !== "HOTELS" && !parsed.tripType) {
    return "Is this one-way or round-trip?";
  }
  if (!parsed.departureDate) {
    return bookingMode === "HOTELS"
      ? "What check-in date should we use? (for example 25 January)"
      : "What departure date should we use? (for example 25 January)";
  }
  if (
    bookingMode !== "HOTELS" &&
    parsed.tripType === "round_trip" &&
    (!parsed.returnDate || parsed.returnDate < parsed.departureDate)
  ) {
    return "What return date should we use? (for example 30 January)";
  }
  if (
    bookingMode === "HOTELS" &&
    (!(parsed.returnDate && parsed.returnDate >= parsed.departureDate) &&
      (parsed.hotelNights == null ||
        parsed.hotelNights < 1 ||
        parsed.hotelNights > 30))
  ) {
    return "How many hotel nights (1–30)?";
  }
  if (
    bookingMode !== "FLIGHTS" &&
    bookingMode !== "HOTELS" &&
    (parsed.hotelNights == null ||
      parsed.hotelNights < 1 ||
      parsed.hotelNights > 30) &&
    !(parsed.returnDate && parsed.departureDate && parsed.returnDate >= parsed.departureDate)
  ) {
    return "How many hotel nights (1–30)?";
  }
  return bookingMode === "FLIGHTS"
    ? "Could you add a bit more detail so we can search flights?"
    : bookingMode === "HOTELS"
      ? "Could you add a bit more detail so we can search hotels?"
      : "Could you add a bit more detail so we can search flights and hotels?";
}

type TripSearchWidgetProps = {
  tripId: string;
  accessToken: string;
  bookingMode?: BookingMode;
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
    hotelCheckOut: string;
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

function addUtcDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function clampHotelNights(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(30, Math.max(1, Math.round(value)));
}

export function TripSearchWidget({
  tripId,
  accessToken,
  bookingMode = "BOTH",
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
  const needsFlights = bookingMode !== "HOTELS";
  const needsHotels = bookingMode !== "FLIGHTS";
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
  const [hotelNights, setHotelNights] = useState(() => {
    const safeToday = utcTodayIso();
    const safeDepart = sanitizeTravelDate(defaultDepart, safeToday);
    const safeEnd = sanitizeTravelDate(defaultReturn, safeToday);
    if (safeDepart && safeEnd && safeEnd > safeDepart) {
      const derived = nightsBetween(safeDepart, safeEnd);
      if (derived != null) return String(clampHotelNights(derived));
    }
    return "1";
  });
  const [adults, setAdults] = useState("1");
  const [nlPrompt, setNlPrompt] = useState("");
  const [nlConversation, setNlConversation] = useState<string | null>(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string | null>(
    null,
  );
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [intentDraft, setIntentDraft] = useState<IntentDraft | null>(null);
  const [activeClarifyFocus, setActiveClarifyFocus] =
    useState<ClarificationFocus | null>(null);
  const [parseSource, setParseSource] = useState<
    "gemini" | "groq" | "heuristic" | null
  >(null);
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
    hotelNights: number;
  }) {
    const hotelCity =
      params.city.trim() ||
      findAirportByIata(params.destination)?.city ||
      params.destination;
    const returnDate =
      params.tripType === "round_trip" && params.ret
        ? params.ret
        : undefined;
    const nights = clampHotelNights(params.hotelNights);
    const hotelCheckOut =
      params.tripType === "round_trip" && returnDate
        ? returnDate
        : addUtcDays(params.depart, nights);

    const flightPromise = needsFlights
      ? travelApi.searchFlights(
          {
            origin: params.origin,
            destination: params.destination,
            departureDate: params.depart,
            returnDate,
            adults: params.adults,
            currency,
          },
          accessToken,
        )
      : Promise.resolve({ items: [] as FlightOffer[], cached: false });
    const hotelPromise = needsHotels
      ? travelApi.searchHotels(
          {
            city: hotelCity,
            checkIn: params.depart,
            checkOut: hotelCheckOut,
            adults: params.adults,
            currency,
          },
          accessToken,
        )
      : Promise.resolve({ items: [] as HotelOffer[], cached: false });

    const [flightResult, hotelResult] = await Promise.all([
      flightPromise,
      hotelPromise,
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
        hotelCheckOut,
        tripType: params.tripType,
      });
    }

    return { nextFlights, nextHotels, flightResult, hotelResult, hotelCheckOut };
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    if (needsFlights && (origin.length !== 3 || destination.length !== 3)) {
      setError("pick a city/airport from the list for from and to");
      return;
    }
    if (needsHotels && !needsFlights) {
      if (!city.trim() && destination.length !== 3) {
        setError("enter a hotel city");
        return;
      }
      if (!depart) {
        setError("pick a check-in date");
        return;
      }
    }
    const searchTripType =
      needsHotels && !needsFlights
        ? ret && ret >= depart
          ? "round_trip"
          : "one_way"
        : tripType;
    const dateError = assertTravelDates(
      depart,
      searchTripType === "round_trip" ? ret : "",
      searchTripType,
    );
    if (dateError) {
      setError(dateError);
      return;
    }
    if (
      needsHotels &&
      searchTripType === "one_way" &&
      (!Number(hotelNights) || Number(hotelNights) < 1)
    ) {
      setError("enter hotel nights (1–30)");
      return;
    }
    setSearching(true);
    setError(null);
    setMessage(null);
    try {
      const adultsCount = Math.max(1, Number(adults) || 1);
      const nightsCount = clampHotelNights(Number(hotelNights) || 1);
      const searchOrigin = needsFlights ? origin : "";
      const searchDestination = needsFlights
        ? destination
        : destination || resolveAirportQuery(city)?.iata || "";
      const hotelCity =
        city.trim() ||
        findAirportByIata(searchDestination)?.city ||
        city.trim();
      const { nextFlights, nextHotels, flightResult, hotelResult } =
        await runMarketSearch({
          origin: searchOrigin,
          destination: searchDestination,
          depart,
          ret,
          city: hotelCity,
          adults: adultsCount,
          tripType: searchTripType,
          hotelNights: nightsCount,
        });
      const parts: string[] = [];
      if (needsFlights) {
        parts.push(
          `${nextFlights.length} flights (${searchTripType === "round_trip" ? "round trip" : "one way"})`,
        );
      }
      if (needsHotels) {
        parts.push(
          `${nextHotels.length} hotels` +
            (searchTripType === "one_way"
              ? ` · ${formatNights(nightsCount)}`
              : ""),
        );
      }
      setMessage(
        `found ${parts.join(" and ")} · showing top ${PAGE_SIZE}` +
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
    hotelNights: number | null;
    adults: number | null;
  }) {
    if (parsed.originIata) setOrigin(parsed.originIata);
    if (parsed.destinationIata) setDestination(parsed.destinationIata);
    if (parsed.destinationCity) setCity(parsed.destinationCity);
    if (parsed.departureDate) setDepart(parsed.departureDate);
    if (bookingMode === "HOTELS") {
      // Soft-fill stay window even while asking for hotel city.
      if (parsed.returnDate) setRet(parsed.returnDate);
      if (parsed.hotelNights != null) {
        setHotelNights(String(clampHotelNights(parsed.hotelNights)));
      } else if (parsed.departureDate && parsed.returnDate) {
        const derived = nightsBetween(parsed.departureDate, parsed.returnDate);
        if (derived != null) setHotelNights(String(clampHotelNights(derived)));
      }
      if (parsed.tripType) setTripType(parsed.tripType);
    } else {
      if (parsed.tripType) setTripType(parsed.tripType);
      if (parsed.tripType === "round_trip" && parsed.returnDate) {
        setRet(parsed.returnDate);
      } else if (parsed.tripType === "one_way") {
        setRet("");
        if (parsed.hotelNights != null) {
          setHotelNights(String(clampHotelNights(parsed.hotelNights)));
        } else if (parsed.departureDate && parsed.returnDate) {
          const derived = nightsBetween(
            parsed.departureDate,
            parsed.returnDate,
          );
          if (derived != null)
            setHotelNights(String(clampHotelNights(derived)));
        }
      } else if (parsed.returnDate) {
        setRet(parsed.returnDate);
      }
    }
    if (parsed.adults) setAdults(String(parsed.adults));
  }

  function mergeIntentDraft(parsed: ParsedIntent, draft: IntentDraft | null): ParsedIntent {
    if (!draft) return parsed;
    const merged: ParsedIntent = {
      ...parsed,
      originIata: parsed.originIata ?? draft.originIata,
      destinationIata: parsed.destinationIata ?? draft.destinationIata,
      originCity: parsed.originCity ?? draft.originCity,
      destinationCity: parsed.destinationCity ?? draft.destinationCity,
      departureDate: parsed.departureDate ?? draft.departureDate,
      returnDate: parsed.returnDate ?? draft.returnDate,
      tripType: parsed.tripType ?? draft.tripType,
      hotelNights: parsed.hotelNights ?? draft.hotelNights,
      adults: parsed.adults ?? draft.adults,
    };
    return {
      ...merged,
      clarifyingQuestion: isIntentReady(merged, bookingMode)
        ? null
        : (merged.clarifyingQuestion ??
          defaultClarifyQuestion(merged, bookingMode)),
    };
  }

  function enrichConversation(
    base: string,
    focus: ClarificationFocus,
    answer: string,
  ): string {
    if (focus === "origin") return `${base}\nfrom ${answer}`.trim();
    if (focus === "destination") return `${base}\nto ${answer}`.trim();
    if (focus === "tripType") return `${base}\ntrip type ${answer}`.trim();
    if (focus === "returnDate") return `${base}\nreturning ${answer}`.trim();
    if (focus === "hotelNights") {
      return `${base}\n${answer} hotel nights`.trim();
    }
    return `${base}\ndeparting ${answer}`.trim();
  }

  function saveIntentDraft(parsed: IntentDraft) {
    setIntentDraft({
      originIata: parsed.originIata,
      destinationIata: parsed.destinationIata,
      originCity: parsed.originCity,
      destinationCity: parsed.destinationCity,
      departureDate: parsed.departureDate,
      returnDate: parsed.returnDate,
      tripType: parsed.tripType,
      hotelNights: parsed.hotelNights,
      adults: parsed.adults,
    });
  }

  function applyLocalClarification(
    parsed: ParsedIntent,
    clarification: { answer: string; focus: ClarificationFocus },
  ): ParsedIntent {
    const answer = clarification.answer.trim();
    if (!answer) return parsed;
    if (clarification.focus === "origin") {
      const place = resolveAirportQuery(answer);
      if (place && place.iata !== parsed.destinationIata) {
        return {
          ...parsed,
          originIata: place.iata,
          originCity: place.city,
        };
      }
    } else if (clarification.focus === "destination") {
      const place = resolveAirportQuery(answer);
      if (place && place.iata !== parsed.originIata) {
        return {
          ...parsed,
          destinationIata: place.iata,
          destinationCity: place.city,
        };
      }
    } else if (clarification.focus === "tripType") {
      const lower = answer.toLowerCase();
      if (/\b(one[\s-]?way|ow)\b/.test(lower) || lower === "one") {
        return { ...parsed, tripType: "one_way", hotelNights: parsed.hotelNights };
      }
      if (
        /\b(round[\s-]?trip|return|two[\s-]?way)\b/.test(lower) ||
        lower === "round"
      ) {
        return { ...parsed, tripType: "round_trip", hotelNights: null };
      }
    } else if (clarification.focus === "hotelNights") {
      const n = Number(answer.match(/\d+/)?.[0]);
      if (Number.isFinite(n) && n >= 1 && n <= 30) {
        return {
          ...parsed,
          tripType: parsed.tripType ?? "one_way",
          hotelNights: clampHotelNights(n),
        };
      }
    }
    return parsed;
  }

  async function parsePromptAndSearch(
    promptText: string,
    clarification?: {
      answer: string;
      focus: ClarificationFocus;
    },
  ) {
    let parsed: ParsedIntent;
    let source: "gemini" | "groq" | "heuristic" = "heuristic";

    try {
      const remote = await aiApi.parseTravelIntent(
        {
          prompt: promptText,
          referenceDate: new Date().toISOString().slice(0, 10),
          clarificationAnswer: clarification?.answer,
          clarificationFocus: clarification?.focus,
          bookingMode,
          draft: intentDraft ?? undefined,
        },
        accessToken,
      );
      source = remote.source;
      parsed = {
        originIata: remote.originIata,
        destinationIata: remote.destinationIata,
        originCity: remote.originCity,
        destinationCity: remote.destinationCity,
        departureDate: remote.departureDate,
        returnDate: remote.returnDate,
        tripType: remote.tripType ?? null,
        hotelNights:
          remote.hotelNights != null
            ? clampHotelNights(remote.hotelNights)
            : null,
        adults: remote.adults,
        notes: remote.notes ?? [],
        clarifyingQuestion: remote.clarifyingQuestion ?? null,
        clarificationFocus: remote.clarificationFocus ?? null,
        isTravelRequest: remote.isTravelRequest !== false,
        source: remote.source,
      };
      parsed = mergeIntentDraft(parsed, intentDraft);
    } catch {
      // Offline / API failure → local heuristic backup only.
      source = "heuristic";
      const local = parseTravelPrompt(promptText);
      parsed = {
        originIata: local.originIata,
        destinationIata: local.destinationIata,
        originCity: local.originCity,
        destinationCity: local.destinationCity,
        departureDate: local.departureDate,
        returnDate: local.returnDate,
        tripType: local.tripType,
        hotelNights: local.hotelNights ?? null,
        adults: local.adults,
        notes: local.notes,
        clarifyingQuestion: local.clarifyingQuestion,
        clarificationFocus: null,
        isTravelRequest: Boolean(
          local.originIata ||
            local.destinationIata ||
            local.departureDate ||
            local.tripType,
        ),
        source: "heuristic",
      };
      parsed = mergeIntentDraft(parsed, intentDraft);
      if (clarification) {
        parsed = applyLocalClarification(parsed, clarification);
        parsed = mergeIntentDraft(parsed, {
          originIata: parsed.originIata,
          destinationIata: parsed.destinationIata,
          originCity: parsed.originCity,
          destinationCity: parsed.destinationCity,
          departureDate: parsed.departureDate,
          returnDate: parsed.returnDate,
          tripType: parsed.tripType,
          hotelNights: parsed.hotelNights,
          adults: parsed.adults,
        });
        parsed = {
          ...parsed,
          clarifyingQuestion: isIntentReady(parsed, bookingMode)
            ? null
            : defaultClarifyQuestion(parsed, bookingMode),
        };
      }
    }

    setParseSource((prev) => {
      // Clarification continues used to return heuristic and wipe a good Groq label.
      if (
        source === "heuristic" &&
        (prev === "groq" || prev === "gemini")
      ) {
        return prev;
      }
      return source;
    });

    // Hotels-only: merge the form city into NL intent before readiness checks.
    if (
      bookingMode === "HOTELS" &&
      !parsed.destinationIata &&
      !parsed.destinationCity?.trim()
    ) {
      const cityTrim = city.trim();
      if (cityTrim) {
        const place = resolveAirportQuery(cityTrim);
        parsed = {
          ...parsed,
          destinationIata: place?.iata ?? null,
          destinationCity: place?.city ?? cityTrim,
        };
      }
    }

    // Never soft-fill invented values for non-travel prompts.
    if (parsed.isTravelRequest !== false) {
      softFillFromParsed(parsed);
    }
    saveIntentDraft(parsed);

    const sameCity =
      bookingMode !== "HOTELS" &&
      Boolean(parsed.originIata) &&
      parsed.originIata === parsed.destinationIata;
    if (sameCity) {
      parsed = {
        ...parsed,
        originIata: null,
        originCity: null,
        clarifyingQuestion: "Where are you departing from?",
        clarificationFocus: "origin",
        notes: [
          ...parsed.notes,
          "departure city was missing — ignored same-city origin matching the destination",
        ],
      };
      softFillFromParsed(parsed);
      saveIntentDraft(parsed);
      setOrigin("");
    }

    if (!isIntentReady(parsed, bookingMode)) {
      if (!nlConversation) setNlConversation(promptText);
      const hasHotelDest = Boolean(
        parsed.destinationIata || parsed.destinationCity?.trim(),
      );
      const preferHotelCityCopy =
        bookingMode === "HOTELS" && !hasHotelDest;
      setClarifyingQuestion(
        preferHotelCityCopy
          ? defaultClarifyQuestion(parsed, bookingMode)
          : (parsed.clarifyingQuestion ??
            defaultClarifyQuestion(parsed, bookingMode)),
      );
      setActiveClarifyFocus(
        parsed.clarificationFocus ??
          inferFocusFromMissing(
            {
              originIata: parsed.originIata,
              destinationIata: parsed.destinationIata,
              destinationCity: parsed.destinationCity,
              departureDate: parsed.departureDate,
              returnDate: parsed.returnDate,
              tripType: parsed.tripType,
              hotelNights: parsed.hotelNights,
            },
            bookingMode,
          ),
      );
      setClarifyAnswer("");
      setMessage(
        parsed.isTravelRequest === false
          ? "let’s plan a trip — answer below to continue."
          : source !== "heuristic"
            ? "analyzed by AI — answer below to continue, or edit the fields."
            : "answer below to continue, or edit the fields.",
      );
      return;
    }

    const nextOrigin = parsed.originIata ?? origin;
    const nextDestination = parsed.destinationIata ?? destination;
    const nextDepart = isPastUtcDate(parsed.departureDate!, today)
      ? ""
      : parsed.departureDate!;
    const rawReturn = parsed.returnDate ?? "";
    const nextReturn =
      rawReturn &&
      !isPastUtcDate(rawReturn, today) &&
      (!nextDepart || rawReturn >= nextDepart)
        ? rawReturn
        : "";
    const nextTripType =
      parsed.tripType ??
      (nextReturn ? "round_trip" : "one_way");
    const nextCity =
      parsed.destinationCity ??
      (city || findAirportByIata(nextDestination)?.city || "");
    const nextAdults = String(parsed.adults ?? Math.max(1, Number(adults) || 1));

    // NL path: hotel nights only when hotels are in scope.
    if (
      needsHotels &&
      nextTripType === "one_way" &&
      !nextReturn &&
      (parsed.hotelNights == null ||
        !Number.isFinite(parsed.hotelNights) ||
        parsed.hotelNights < 1)
    ) {
      if (!nlConversation) setNlConversation(promptText);
      setClarifyingQuestion("How many hotel nights (1–30)?");
      setActiveClarifyFocus("hotelNights");
      setClarifyAnswer("");
      setMessage("need hotel nights before searching.");
      return;
    }
    if (needsFlights && nextTripType === "round_trip" && !nextReturn) {
      if (!nlConversation) setNlConversation(promptText);
      setClarifyingQuestion(
        "What return date should we use? (for example 30 January)",
      );
      setActiveClarifyFocus("returnDate");
      setClarifyAnswer("");
      setMessage("need a return date before searching.");
      return;
    }

    let nextNights = clampHotelNights(parsed.hotelNights ?? 1);
    if (nextDepart && nextReturn) {
      const derived = nightsBetween(nextDepart, nextReturn);
      if (derived != null) nextNights = clampHotelNights(derived);
    }

    if (nextOrigin) setOrigin(nextOrigin);
    if (nextDestination) setDestination(nextDestination);
    setDepart(nextDepart);
    setRet(nextTripType === "round_trip" ? nextReturn : "");
    setTripType(nextTripType);
    if (nextCity) setCity(nextCity);
    setAdults(nextAdults);
    setHotelNights(String(nextNights));

    if (isPastUtcDate(parsed.departureDate!, today)) {
      if (!nlConversation) setNlConversation(promptText);
      setClarifyingQuestion(
        needsHotels && !needsFlights
          ? "What check-in date should we use? (for example 25 January)"
          : "What departure date should we use? (for example 25 January)",
      );
      setActiveClarifyFocus("departureDate");
      setClarifyAnswer("");
      setError(null);
      setMessage(
        `${parsed.departureDate} is in the past — pick a future date.`,
      );
      return;
    }

    if (needsFlights && (!nextOrigin || !nextDestination)) {
      if (!nlConversation) setNlConversation(promptText);
      setClarifyingQuestion(
        !nextDestination
          ? "Where do you want to go?"
          : "Where are you departing from?",
      );
      setActiveClarifyFocus(!nextDestination ? "destination" : "origin");
      setClarifyAnswer("");
      setMessage("need origin and destination before searching flights.");
      return;
    }

    const flightReturn = nextTripType === "round_trip" ? nextReturn : "";
    const dateError = assertTravelDates(nextDepart, flightReturn, nextTripType);
    if (dateError) {
      if (!nlConversation) setNlConversation(promptText);
      setClarifyingQuestion(
        nextTripType === "round_trip" && !nextReturn
          ? "What return date should we use? (for example 30 January)"
          : "What departure date should we use? (for example 25 January)",
      );
      setActiveClarifyFocus(
        nextTripType === "round_trip" && !nextReturn
          ? "returnDate"
          : "departureDate",
      );
      setClarifyAnswer("");
      setError(null);
      setMessage(dateError);
      return;
    }

    setNlConversation(null);
    setClarifyingQuestion(null);
    setActiveClarifyFocus(null);
    setClarifyAnswer("");
    setIntentDraft(null);

    const { nextFlights, nextHotels } = await runMarketSearch({
      origin: nextOrigin,
      destination: nextDestination,
      depart: nextDepart,
      ret: flightReturn,
      city: nextCity,
      adults: Number(nextAdults) || 1,
      tripType: nextTripType,
      hotelNights: nextNights,
    });

    const mappingNote = parsed.notes.find((n) => /→/.test(n));
    const sourceNote = source !== "heuristic" ? "AI" : "offline parse";
    const routeNote = needsFlights
      ? `${parsed.originCity ?? nextOrigin} (${nextOrigin}) → ${parsed.destinationCity ?? nextDestination} (${nextDestination})`
      : `${nextCity || parsed.destinationCity || "hotel stay"}`;
    const foundParts: string[] = [];
    if (needsFlights) foundParts.push(`${nextFlights.length} flights`);
    if (needsHotels) foundParts.push(`${nextHotels.length} hotels`);
    setMessage(
      `${sourceNote}: ${routeNote} · ${nextDepart}${flightReturn ? ` to ${flightReturn}` : needsHotels && nextTripType === "one_way" ? ` · ${formatNights(nextNights)} hotel` : ""} · found ${foundParts.join(" and ")}${mappingNote ? ` · ${mappingNote}` : ""}`,
    );
  }

  function clarificationFocusFromIntent(
    parsedFocus: ClarificationFocus | null | undefined,
    question: string | null,
    draft: IntentDraft | null,
  ): ClarificationFocus {
    if (parsedFocus) return parsedFocus;
    if (draft) {
      return inferFocusFromMissing(
        {
          originIata: draft.originIata,
          destinationIata: draft.destinationIata,
          departureDate: draft.departureDate,
          returnDate: draft.returnDate,
          tripType: draft.tripType,
          hotelNights: draft.hotelNights,
        },
        bookingMode,
      );
    }
    const q = (question ?? "").toLowerCase();
    if (/want to go|destin|which city or airport/.test(q)) return "destination";
    if (/one-way or round|trip type/.test(q)) return "tripType";
    if (/return date/.test(q)) return "returnDate";
    if (/hotel nights|how many/.test(q)) return "hotelNights";
    if (/departure date/.test(q)) return "departureDate";
    if (/departing from/.test(q)) return "origin";
    return "destination";
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
    setActiveClarifyFocus(null);
    setNlConversation(null);
    setIntentDraft(null);
    setParseSource(null);

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
    if (answer.length < 1) {
      setError("please answer the question above");
      return;
    }
    const base = (nlConversation ?? nlPrompt).trim();
    const focus = clarificationFocusFromIntent(
      activeClarifyFocus,
      clarifyingQuestion,
      intentDraft,
    );
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
          {bookingMode === "FLIGHTS"
            ? "type a free-text flight request, or fill the fields below. results show 3 at a time."
            : bookingMode === "HOTELS"
              ? "type a free-text hotel request, or fill the fields below. results show 3 at a time."
              : "type a free-text trip request, or fill the fields below. results show 3 at a time — use load more for more options."}
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
              setActiveClarifyFocus(null);
              setNlConversation(null);
              setClarifyAnswer("");
              setIntentDraft(null);
              setParseSource(null);
            }
          }}
          disabled={disabled || suggesting}
          rows={3}
          placeholder='i want round trip from kutaisi to cyprus from 20 august to 25 august'
          className="mt-2 w-full resize-y rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-sm lowercase text-ss-text placeholder:text-ss-muted focus:outline-none focus:ring-1 focus:ring-ss-accent"
        />
        {parseSource ? (
          <p className="mt-2 text-xs lowercase text-ss-muted">
            {parseSource !== "heuristic"
              ? `analyzed by ${parseSource}`
              : "offline parse (local rules)"}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={disabled || suggesting}
            onClick={() => void onSuggestFromPrompt()}
            className="h-11 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
          >
            {suggesting && !clarifyingQuestion
              ? "suggesting…"
              : bookingMode === "FLIGHTS"
                ? "suggest flights"
                : bookingMode === "HOTELS"
                  ? "suggest hotels"
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
          {needsFlights ? (
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
          ) : null}
          {needsFlights ? (
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
          ) : null}
          <div className="rounded-3xl border border-white/15 bg-ss-surface-strong p-4">
            <Label className="lowercase text-ss-muted">
              {needsFlights ? "when?" : "stay dates?"}
            </Label>
            <div className="mt-2 space-y-2">
              {needsFlights ? (
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
              ) : null}
              <DateInput
                required
                value={depart}
                onChange={setDepart}
                disabled={disabled}
                min={today}
                aria-label={needsFlights ? "depart date" : "check-in date"}
                triggerClassName="h-10 border-white/20 bg-black/20 text-ss-text hover:border-white/35"
              />
              {tripType === "round_trip" || (!needsFlights && needsHotels) ? (
                <DateInput
                  required={needsFlights ? tripType === "round_trip" : false}
                  value={ret}
                  onChange={setRet}
                  disabled={disabled}
                  aria-label={needsFlights ? "return date" : "check-out date"}
                  min={depart && depart > today ? depart : today}
                  triggerClassName="h-10 border-white/20 bg-black/20 text-ss-text hover:border-white/35"
                />
              ) : null}
            </div>
          </div>
          <div className="rounded-3xl border border-white/15 bg-ss-surface-strong p-4">
            {needsHotels ? (
              <>
                <Label className="lowercase text-ss-muted">hotel city</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={destinationLabel?.city ?? "city name"}
                  disabled={disabled}
                  className="mt-2 h-10 rounded-xl border-0 bg-transparent text-ss-text placeholder:text-ss-muted"
                />
              </>
            ) : (
              <Label className="lowercase text-ss-muted">travelers</Label>
            )}
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
            {needsHotels &&
            (tripType === "one_way" || !needsFlights) &&
            !(ret && depart && ret > depart) ? (
              <>
                <Label className="mt-2 block lowercase text-ss-muted">
                  hotel nights
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={hotelNights}
                  onChange={(e) => setHotelNights(e.target.value)}
                  disabled={disabled}
                  aria-label="hotel nights"
                  className="mt-1 h-10 rounded-xl border-0 bg-transparent text-ss-text"
                />
                {depart ? (
                  <p className="mt-1 text-[11px] text-ss-muted lowercase">
                    stay {depart} →{" "}
                    {addUtcDays(
                      depart,
                      clampHotelNights(Number(hotelNights) || 1),
                    )}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={disabled || searching}
            className="h-11 rounded-full bg-ss-accent px-8 text-white lowercase hover:bg-ss-accent-hover"
          >
            {searching
              ? "searching market…"
              : bookingMode === "FLIGHTS"
                ? "search flights"
                : bookingMode === "HOTELS"
                  ? "search hotels"
                  : "search flights & hotels"}
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
        <div
          className={`grid gap-6 ${needsFlights && needsHotels ? "lg:grid-cols-2" : ""}`}
        >
          {needsFlights ? (
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
          ) : null}
          {needsHotels ? (
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
          ) : null}
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
