import { AIRPORTS, resolveAirportQuery, type Airport } from "@/lib/airports";

export type ParsedTravelPrompt = {
  originIata: string | null;
  destinationIata: string | null;
  originCity: string | null;
  destinationCity: string | null;
  departureDate: string | null;
  returnDate: string | null;
  tripType: "one_way" | "round_trip" | null;
  adults: number | null;
  notes: string[];
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function resolveYear(month: number, day: number, reference: Date): number {
  const year = reference.getUTCFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  const today = Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate(),
  );
  return candidate < today ? year + 1 : year;
}

function parseDayMonth(
  dayRaw: string,
  monthRaw: string,
  yearRaw: string | undefined,
  reference: Date,
): string | null {
  const day = Number(dayRaw);
  const month = MONTHS[monthRaw.toLowerCase()];
  if (!Number.isFinite(day) || !month || day < 1 || day > 31) return null;
  const year = yearRaw
    ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw)
    : resolveYear(month, day, reference);
  if (!Number.isFinite(year)) return null;
  return toIsoDate(year, month, day);
}

function normalizeTravelText(text: string): string {
  let next = text.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  const monthAlt = MONTH_NAMES.join("|");
  next = next.replace(
    new RegExp(`\\b(\\d{1,2})\\s*(${monthAlt})\\b`, "gi"),
    "$1 $2",
  );
  return next.replace(/\s+/g, " ").trim();
}

function extractDates(
  text: string,
  reference: Date,
): { departureDate: string | null; returnDate: string | null } {
  const normalized = normalizeTravelText(text);

  const fromToMonths = normalized.match(
    /\b(?:from\s+)?(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?\s+(?:to|until|-|–)\s+(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?\b/i,
  );
  if (fromToMonths) {
    return {
      departureDate: parseDayMonth(
        fromToMonths[1],
        fromToMonths[2],
        fromToMonths[3],
        reference,
      ),
      returnDate: parseDayMonth(
        fromToMonths[4],
        fromToMonths[5],
        fromToMonths[6],
        reference,
      ),
    };
  }

  const rangeMonth = normalized.match(
    /\b(?:from\s+)?(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?\b/i,
  );
  if (rangeMonth) {
    const month = rangeMonth[3];
    const year = rangeMonth[4];
    return {
      departureDate: parseDayMonth(rangeMonth[1], month, year, reference),
      returnDate: parseDayMonth(rangeMonth[2], month, year, reference),
    };
  }

  const isoRange = normalized.match(
    /\b(\d{4}-\d{2}-\d{2})\s*(?:to|-|–)\s*(\d{4}-\d{2}-\d{2})\b/i,
  );
  if (isoRange) {
    return { departureDate: isoRange[1], returnDate: isoRange[2] };
  }

  const single = normalized.match(
    /\b(?:on|depart(?:ing)?|leave|leaving)?\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?\b/i,
  );
  if (single) {
    return {
      departureDate: parseDayMonth(single[1], single[2], single[3], reference),
      returnDate: null,
    };
  }

  return { departureDate: null, returnDate: null };
}

function stripDatePhrases(text: string): string {
  const normalized = normalizeTravelText(text);
  return normalized
    .replace(
      /\b(?:from\s+)?\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\s+(?:to|until|-|–)\s+\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\b/gi,
      " ",
    )
    .replace(
      /\b(?:from\s+)?\d{1,2}\s*[-–to]+\s*\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\b/gi,
      " ",
    )
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTripType(
  text: string,
  hasReturnDate: boolean,
): "one_way" | "round_trip" {
  if (/\b(one[\s-]?way|ow)\b/i.test(text)) return "one_way";
  if (/\b(round[\s-]?trip|return(?:\s+trip)?|two[\s-]?way)\b/i.test(text)) {
    return "round_trip";
  }
  return hasReturnDate ? "round_trip" : "one_way";
}

function resolveNamedPlace(raw: string): Airport | null {
  const cleaned = raw
    .replace(/\b(airport|international|intl)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /^\d/.test(cleaned)) return null;
  return resolveAirportQuery(cleaned);
}

function extractRoute(text: string): {
  origin: Airport | null;
  destination: Airport | null;
} {
  const forCities = stripDatePhrases(text);

  const toFrom = forCities.match(
    /\bto\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)\s+(?:.*?)\bfrom\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?:\b|$)/i,
  );
  if (toFrom) {
    const destination = resolveNamedPlace(toFrom[1]);
    const origin = resolveNamedPlace(toFrom[2]);
    if (origin || destination) {
      return { origin, destination };
    }
  }

  const fromTo = forCities.match(
    /\bfrom\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)\s+to\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?:\b|$)/i,
  );
  if (fromTo) {
    const origin = resolveNamedPlace(fromTo[1]);
    const destination = resolveNamedPlace(fromTo[2]);
    if (origin || destination) {
      return { origin, destination };
    }
  }

  const fromOnly = forCities.match(
    /\bfrom\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?:\b|$)/i,
  );
  const toOnly = forCities.match(
    /\b(?:to|into|towards)\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?:\b|$)/i,
  );
  let origin = fromOnly ? resolveNamedPlace(fromOnly[1]) : null;
  let destination = toOnly ? resolveNamedPlace(toOnly[1]) : null;
  if (origin && destination) {
    return { origin, destination };
  }

  const lower = forCities.toLowerCase();
  const found: Airport[] = [];
  const sorted = [...AIRPORTS].sort(
    (a, b) => b.city.length - a.city.length || a.city.localeCompare(b.city),
  );
  for (const airport of sorted) {
    const city = airport.city.toLowerCase();
    if (city.length < 3) continue;
    const re = new RegExp(
      `\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    if (!re.test(lower)) continue;
    if (found.some((f) => f.city.toLowerCase() === airport.city.toLowerCase())) {
      continue;
    }
    found.push(airport);
  }

  if (!origin && found[0]) origin = found[0];
  if (!destination && found[1]) destination = found[1];
  if (!destination && found[0] && origin?.city !== found[0].city) {
    destination = found[0];
  }

  return { origin, destination };
}

function extractAdults(text: string): number | null {
  const match = text.match(
    /\b(\d+)\s*(?:adults?|travelers?|travellers?|people|persons?|pax)\b/i,
  );
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 1 || n > 9) return null;
  return n;
}

/** Local heuristic parser for free-text trip requests (no API). */
export function parseTravelPrompt(
  prompt: string,
  referenceDate: Date = new Date(),
): ParsedTravelPrompt {
  const notes: string[] = [];
  const text = prompt.trim();
  if (!text) {
    return {
      originIata: null,
      destinationIata: null,
      originCity: null,
      destinationCity: null,
      departureDate: null,
      returnDate: null,
      tripType: null,
      adults: null,
      notes: ["empty prompt"],
    };
  }

  const dates = extractDates(text, referenceDate);
  const route = extractRoute(text);
  const tripType = extractTripType(text, Boolean(dates.returnDate));
  const adults = extractAdults(text);

  if (!dates.departureDate) notes.push("could not detect departure date");
  if (!dates.returnDate && tripType === "round_trip") {
    notes.push("could not detect return date");
  }
  if (!route.origin) notes.push("could not detect origin city");
  if (!route.destination) notes.push("could not detect destination city");

  return {
    originIata: route.origin?.iata ?? null,
    destinationIata: route.destination?.iata ?? null,
    originCity: route.origin?.city ?? null,
    destinationCity: route.destination?.city ?? null,
    departureDate: dates.departureDate,
    returnDate: dates.returnDate,
    tripType,
    adults,
    notes,
  };
}
