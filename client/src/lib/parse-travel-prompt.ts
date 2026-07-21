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
  clarifyingQuestion: string | null;
};

function buildClarifyingQuestion(intent: {
  originIata: string | null;
  destinationIata: string | null;
  destinationCity: string | null;
  departureDate: string | null;
}): string | null {
  const ready =
    intent.originIata &&
    intent.destinationIata &&
    intent.departureDate &&
    intent.originIata !== intent.destinationIata;
  if (ready) {
    return null;
  }
  if (!intent.destinationIata) {
    if (intent.destinationCity) {
      return `I found "${intent.destinationCity}" but could not map it to an airport — which city or airport should we use?`;
    }
    return "Where do you want to go?";
  }
  if (!intent.originIata || intent.originIata === intent.destinationIata) {
    return "Where are you departing from?";
  }
  if (!intent.departureDate) {
    return "What departure date should we use? (for example 25 January)";
  }
  return "Could you add a bit more detail so we can search flights and hotels?";
}

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

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function resolveWeekdayDate(
  weekdayRaw: string,
  reference: Date,
  strictNext: boolean,
): string | null {
  const target = WEEKDAYS[weekdayRaw.toLowerCase()];
  if (target === undefined) return null;
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const day = reference.getUTCDate();
  const current = new Date(Date.UTC(year, month, day)).getUTCDay();
  let delta = (target - current + 7) % 7;
  if (strictNext && delta === 0) delta = 7;
  const resolved = new Date(Date.UTC(year, month, day + delta));
  return toIsoDate(
    resolved.getUTCFullYear(),
    resolved.getUTCMonth() + 1,
    resolved.getUTCDate(),
  );
}

function resolveRelativeDate(text: string, reference: Date): string | null {
  if (/\btoday\b/i.test(text)) {
    return toIsoDate(
      reference.getUTCFullYear(),
      reference.getUTCMonth() + 1,
      reference.getUTCDate(),
    );
  }
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date(
      Date.UTC(
        reference.getUTCFullYear(),
        reference.getUTCMonth(),
        reference.getUTCDate() + 1,
      ),
    );
    return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  const nextDay = text.match(
    /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i,
  );
  if (nextDay) return resolveWeekdayDate(nextDay[1], reference, true);

  const thisOrOn = text.match(
    /\b(?:this|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i,
  );
  if (thisOrOn) return resolveWeekdayDate(thisOrOn[1], reference, false);

  return null;
}

function normalizeTravelText(text: string): string {
  let next = text.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  const monthAlt = MONTH_NAMES.join("|");
  next = next.replace(
    new RegExp(`\\b(\\d{1,2})\\s*(${monthAlt})\\b`, "gi"),
    "$1 $2",
  );
  next = next.replace(
    new RegExp(`\\b(${monthAlt})\\s*(\\d{1,2})\\b`, "gi"),
    "$1 $2",
  );
  return next.replace(/\s+/g, " ").trim();
}

function extractDates(
  text: string,
  reference: Date,
): { departureDate: string | null; returnDate: string | null } {
  const normalized = normalizeTravelText(text);

  const fromToDayFirst = normalized.match(
    /\b(?:from\s+)?(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?\s+(?:to|until|-|–)\s+(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?\b/i,
  );
  if (fromToDayFirst) {
    const departureDate = parseDayMonth(
      fromToDayFirst[1],
      fromToDayFirst[2],
      fromToDayFirst[3],
      reference,
    );
    const returnDate = parseDayMonth(
      fromToDayFirst[4],
      fromToDayFirst[5],
      fromToDayFirst[6],
      reference,
    );
    if (departureDate) return { departureDate, returnDate };
  }

  const fromToMonthFirst = normalized.match(
    /\b(?:from\s+)?([A-Za-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{2,4}))?\s+(?:to|until|-|–)\s+([A-Za-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{2,4}))?\b/i,
  );
  if (fromToMonthFirst) {
    const departureDate = parseDayMonth(
      fromToMonthFirst[2],
      fromToMonthFirst[1],
      fromToMonthFirst[3],
      reference,
    );
    const returnDate = parseDayMonth(
      fromToMonthFirst[5],
      fromToMonthFirst[4],
      fromToMonthFirst[6],
      reference,
    );
    if (departureDate) return { departureDate, returnDate };
  }

  const rangeDayFirst = normalized.match(
    /\b(?:from\s+)?(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?\b/i,
  );
  if (rangeDayFirst) {
    const month = rangeDayFirst[3];
    const year = rangeDayFirst[4];
    const departureDate = parseDayMonth(
      rangeDayFirst[1],
      month,
      year,
      reference,
    );
    const returnDate = parseDayMonth(rangeDayFirst[2], month, year, reference);
    if (departureDate) return { departureDate, returnDate };
  }

  const rangeMonthFirst = normalized.match(
    /\b(?:from\s+)?([A-Za-z]+)\s+(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})(?:\s*,?\s*(\d{2,4}))?\b/i,
  );
  if (rangeMonthFirst) {
    const month = rangeMonthFirst[1];
    const year = rangeMonthFirst[4];
    const departureDate = parseDayMonth(
      rangeMonthFirst[2],
      month,
      year,
      reference,
    );
    const returnDate = parseDayMonth(
      rangeMonthFirst[3],
      month,
      year,
      reference,
    );
    if (departureDate) return { departureDate, returnDate };
  }

  const isoRange = normalized.match(
    /\b(\d{4}-\d{2}-\d{2})\s*(?:to|-|–)\s*(\d{4}-\d{2}-\d{2})\b/i,
  );
  if (isoRange) {
    return { departureDate: isoRange[1], returnDate: isoRange[2] };
  }

  const singleDayFirst = normalized.match(
    /\b(?:on|depart(?:ing)?|leave|leaving)\s+(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?\b/i,
  );
  if (singleDayFirst) {
    const departureDate = parseDayMonth(
      singleDayFirst[1],
      singleDayFirst[2],
      singleDayFirst[3],
      reference,
    );
    if (departureDate) return { departureDate, returnDate: null };
  }
  const bareDayFirst = normalized.match(
    /\b(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?\b/i,
  );
  if (bareDayFirst) {
    const departureDate = parseDayMonth(
      bareDayFirst[1],
      bareDayFirst[2],
      bareDayFirst[3],
      reference,
    );
    if (departureDate) return { departureDate, returnDate: null };
  }

  const singleMonthFirst = normalized.match(
    /\b(?:on|depart(?:ing)?|leave|leaving)\s+([A-Za-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{2,4}))?\b/i,
  );
  if (singleMonthFirst) {
    const departureDate = parseDayMonth(
      singleMonthFirst[2],
      singleMonthFirst[1],
      singleMonthFirst[3],
      reference,
    );
    if (departureDate) return { departureDate, returnDate: null };
  }
  const bareMonthFirst = normalized.match(
    /\b([A-Za-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{2,4}))?\b/i,
  );
  if (bareMonthFirst) {
    const departureDate = parseDayMonth(
      bareMonthFirst[2],
      bareMonthFirst[1],
      bareMonthFirst[3],
      reference,
    );
    if (departureDate) return { departureDate, returnDate: null };
  }

  const relative = resolveRelativeDate(normalized, reference);
  if (relative) return { departureDate: relative, returnDate: null };

  return { departureDate: null, returnDate: null };
}

function stripDatePhrases(text: string): string {
  const normalized = normalizeTravelText(text);
  const monthAlt = MONTH_NAMES.join("|");
  return normalized
    .replace(
      /\b(?:from\s+)?\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\s+(?:to|until|-|–)\s+\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\b/gi,
      " ",
    )
    .replace(
      /\b(?:from\s+)?[A-Za-z]+\s+\d{1,2}(?:\s*,?\s*\d{2,4})?\s+(?:to|until|-|–)\s+[A-Za-z]+\s+\d{1,2}(?:\s*,?\s*\d{2,4})?\b/gi,
      " ",
    )
    .replace(
      /\b(?:from\s+)?\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\b/gi,
      " ",
    )
    .replace(
      new RegExp(
        `\\b(?:from\\s+)?(${monthAlt})\\s+\\d{1,2}\\s*(?:-|–|to)\\s*\\d{1,2}(?:\\s*,?\\s*\\d{2,4})?\\b`,
        "gi",
      ),
      " ",
    )
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\b/gi, " ")
    .replace(
      new RegExp(`\\b(${monthAlt})\\s+\\d{1,2}(?:\\s*,?\\s*\\d{2,4})?\\b`, "gi"),
      " ",
    )
    .replace(
      /\b(?:next|this|on)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/gi,
      " ",
    )
    .replace(/\b(?:today|tomorrow)\b/gi, " ")
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

  if (!destination) {
    const inCity = forCities.match(
      /\b(?:in|at)\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?=\s+(?:from|on|for|with|and|between|next|this|today|tomorrow)\b|[.,]|$)/i,
    );
    if (inCity) destination = resolveNamedPlace(inCity[1]);
  }

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
      clarifyingQuestion: "Could you describe your trip in a bit more detail?",
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

  const parsed = {
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

  return {
    ...parsed,
    clarifyingQuestion: buildClarifyingQuestion(parsed),
  };
}
