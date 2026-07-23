import {
  resolvePlaceQuery,
  type PlaceResolveResult,
} from './city-airports';
import { ParseTravelIntentResponseDto } from './dto/parse-travel-intent.dto';

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
  return String(n).padStart(2, '0');
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
  // Only accept explicit 4-digit years. 2-digit tokens (e.g. "10" from
  // "10 hotel nights" after "departing 20 august") must NOT become 2010.
  const year = yearRaw && /^\d{4}$/.test(yearRaw)
    ? Number(yearRaw)
    : resolveYear(month, day, reference);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null;
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

/** Next occurrence of weekday. `strictNext` skips today when it already is that weekday. */
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
  if (!strictNext && delta === 0) delta = 0;
  const resolved = new Date(Date.UTC(year, month, day + delta));
  return toIsoDate(
    resolved.getUTCFullYear(),
    resolved.getUTCMonth() + 1,
    resolved.getUTCDate(),
  );
}

function resolveRelativeDate(
  text: string,
  reference: Date,
): string | null {
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

/** Normalize "29november" / "21st" before date regexes. */
export function normalizeTravelText(text: string): string {
  let next = text.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
  const monthAlt = MONTH_NAMES.join('|');
  next = next.replace(
    new RegExp(`\\b(\\d{1,2})\\s*(${monthAlt})\\b`, 'gi'),
    '$1 $2',
  );
  // "October5" → "October 5"
  next = next.replace(
    new RegExp(`\\b(${monthAlt})\\s*(\\d{1,2})\\b`, 'gi'),
    '$1 $2',
  );
  return next.replace(/\s+/g, ' ').trim();
}

function extractDates(
  text: string,
  reference: Date,
): { departureDate: string | null; returnDate: string | null } {
  const normalized = normalizeTravelText(text);

  // Day-first range: "from 5 October to 12 October"
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

  // Month-first range: "from October 5 to October 12"
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

  // Shared month day-first: "5-12 October" / "5 to 12 October"
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

  // Shared month month-first: "October 5-12" / "October 5 to 12"
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

  // Day-first single: "on 15 September" / "15 September"
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

  // Month-first single: "on September 15" / "September 15, 2026"
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
  const monthAlt = MONTH_NAMES.join('|');
  return normalized
    .replace(
      /\b(?:from\s+)?\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\s+(?:to|until|-|–)\s+\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\b/gi,
      ' ',
    )
    .replace(
      /\b(?:from\s+)?[A-Za-z]+\s+\d{1,2}(?:\s*,?\s*\d{2,4})?\s+(?:to|until|-|–)\s+[A-Za-z]+\s+\d{1,2}(?:\s*,?\s*\d{2,4})?\b/gi,
      ' ',
    )
    .replace(
      /\b(?:from\s+)?\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\b/gi,
      ' ',
    )
    .replace(
      new RegExp(
        `\\b(?:from\\s+)?(${monthAlt})\\s+\\d{1,2}\\s*(?:-|–|to)\\s*\\d{1,2}(?:\\s*,?\\s*\\d{2,4})?\\b`,
        'gi',
      ),
      ' ',
    )
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\s+[A-Za-z]+(?:\s+\d{2,4})?\b/gi, ' ')
    .replace(
      new RegExp(`\\b(${monthAlt})\\s+\\d{1,2}(?:\\s*,?\\s*\\d{2,4})?\\b`, 'gi'),
      ' ',
    )
    .replace(
      /\b(?:next|this|on)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/gi,
      ' ',
    )
    .replace(/\b(?:today|tomorrow)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTripType(
  text: string,
  hasReturnDate: boolean,
  hasDepartureDate: boolean,
  hasStayNights: boolean,
): 'one_way' | 'round_trip' | null {
  if (/\b(one[\s-]?way|ow)\b/i.test(text)) return 'one_way';
  if (/\b(round[\s-]?trip|return(?:\s+trip)?|two[\s-]?way)\b/i.test(text)) {
    return 'round_trip';
  }
  if (hasReturnDate) return 'round_trip';
  if (hasDepartureDate || hasStayNights) return 'one_way';
  return null;
}

export function clampHotelNights(value: number): number {
  return Math.min(30, Math.max(1, Math.round(value)));
}

export function nightsBetweenIso(
  startIso: string,
  endIso: string,
): number | null {
  const start = startIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const end = endIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!start || !end) return null;
  const a = Date.UTC(
    Number(start[1]),
    Number(start[2]) - 1,
    Number(start[3]),
  );
  const b = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
  const nights = Math.round((b - a) / 86_400_000);
  if (!Number.isFinite(nights) || nights < 1) return null;
  return clampHotelNights(nights);
}

export function deriveHotelNights(intent: {
  tripType: 'one_way' | 'round_trip' | null;
  departureDate: string | null;
  returnDate: string | null;
  hotelNights?: number | null;
  stayNights?: number | null;
}): number | null {
  if (intent.tripType === 'round_trip') return null;
  const explicit =
    intent.hotelNights != null && Number.isFinite(intent.hotelNights)
      ? clampHotelNights(intent.hotelNights)
      : intent.stayNights != null && Number.isFinite(intent.stayNights)
        ? clampHotelNights(intent.stayNights)
        : null;
  if (explicit != null) return explicit;
  if (
    intent.tripType === 'one_way' &&
    intent.departureDate &&
    intent.returnDate
  ) {
    return nightsBetweenIso(intent.departureDate, intent.returnDate);
  }
  return null;
}

export function parseTripTypeAnswer(
  answer: string,
): 'one_way' | 'round_trip' | null {
  const text = answer.trim().toLowerCase();
  if (/\b(one[\s-]?way|ow|oneway)\b/.test(text) || text === 'one') {
    return 'one_way';
  }
  if (
    /\b(round[\s-]?trip|return(?:\s+trip)?|two[\s-]?way|roundtrip)\b/.test(
      text,
    ) ||
    text === 'round' ||
    text === 'return'
  ) {
    return 'round_trip';
  }
  return null;
}

export function parseHotelNightsAnswer(answer: string): number | null {
  const trimmed = answer.trim().toLowerCase();
  const word = parseCountToken(trimmed);
  if (word != null && word >= 1 && word <= 30) return clampHotelNights(word);
  const match = trimmed.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)\b/,
  );
  if (!match) return null;
  const n = parseCountToken(match[1]);
  return n != null && n >= 1 && n <= 30 ? clampHotelNights(n) : null;
}

function resolveNamedPlace(raw: string): PlaceResolveResult | null {
  const cleaned = raw
    .replace(/\b(airport|international|intl)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || /^\d/.test(cleaned)) return null;
  return resolvePlaceQuery(cleaned);
}

function extractRoute(text: string): {
  origin: PlaceResolveResult | null;
  destination: PlaceResolveResult | null;
  notes: string[];
} {
  const notes: string[] = [];
  const forCities = stripDatePhrases(text);
  let origin: PlaceResolveResult | null = null;
  let destination: PlaceResolveResult | null = null;

  // Prefer "to X ... from Y" only when BOTH sides resolve.
  // Place names may be multi-word ("cape town"); stop at keywords, not any \b.
  const toFrom = forCities.match(
    /\bto\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)\s+from\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?=\s+(?:on|for|with|and|between|round|one)\b|[.,]|$)/i,
  );
  if (toFrom) {
    const dest = resolveNamedPlace(toFrom[1]);
    const orig = resolveNamedPlace(toFrom[2]);
    if (orig && dest) {
      origin = orig;
      destination = dest;
    }
  }

  // "from X to Y"
  if (!origin || !destination) {
    const fromTo = forCities.match(
      /\bfrom\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)\s+to\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?=\s+(?:from|on|for|with|and|between|round|one)\b|[.,]|$)/i,
    );
    if (fromTo) {
      const orig = resolveNamedPlace(fromTo[1]);
      const dest = resolveNamedPlace(fromTo[2]);
      if (orig && dest) {
        origin = orig;
        destination = dest;
      } else {
        if (!origin && orig) origin = orig;
        if (!destination && dest) destination = dest;
      }
    }
  }

  if (!origin || !destination) {
    const fromOnly = forCities.match(
      /\bfrom\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?=\s+(?:to|into|towards|from|on|for|with|and|trip|round|one|hotel|nights?|depart(?:ing)?|return(?:ing)?)\b|[.,]|$)/i,
    );
    const toOnly = forCities.match(
      /\b(?:to|into|towards)\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?=\s+(?:from|on|for|with|and|between|trip|round|one|hotel|nights?|depart(?:ing)?|return(?:ing)?)\b|[.,]|$)/i,
    );
    if (!origin && fromOnly) origin = resolveNamedPlace(fromOnly[1]);
    if (!destination && toOnly) destination = resolveNamedPlace(toOnly[1]);
  }

  // "hotel in Barcelona" / "flights in Rome" → destination when no explicit to/from pair
  if (!destination) {
    const inCity = forCities.match(
      /\b(?:in|at)\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?=\s+(?:from|on|for|with|and|between|next|this|today|tomorrow)\b|[.,]|$)/i,
    );
    if (inCity) destination = resolveNamedPlace(inCity[1]);
  }

  if (origin && destination) {
    if (destination.mappedFrom) notes.push(destination.mappedFrom);
    if (origin.mappedFrom) notes.push(origin.mappedFrom);
    return { origin, destination, notes };
  }

  // Fallback: resolve leftover place phrases (no full DB scan).
  const STOPWORDS = new Set([
    'need',
    'needs',
    'want',
    'book',
    'flight',
    'flights',
    'hotel',
    'hotels',
    'trip',
    'trips',
    'round',
    'return',
    'please',
    'with',
    'from',
    'into',
    'towards',
    'between',
    'adults',
    'people',
    'person',
    'travel',
    'business',
    'one',
    'way',
    'next',
    'this',
    'that',
    'have',
    'find',
    'search',
    'looking',
    'leave',
    'leaving',
    'depart',
    'departing',
    'arrive',
    'arriving',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'today',
    'tomorrow',
    'august',
    'september',
    'october',
    'november',
    'december',
    'january',
    'february',
    'march',
    'april',
    'june',
    'july',
  ]);

  const candidates = new Set<string>();
  for (const m of forCities.matchAll(
    /\b(?:from|to|into|towards|via|in|at)\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?=\s+(?:from|to|into|towards|via|on|for|with|and|in|at)\b|[.,]|$)/gi,
  )) {
    candidates.add(m[1].trim());
  }
  // Also try bigrams for places like "cape town", "new york"
  const words = forCities.split(/[^A-Za-z]+/).filter((w) => w.length >= 2);
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (
      !STOPWORDS.has(words[i].toLowerCase()) &&
      !STOPWORDS.has(words[i + 1].toLowerCase())
    ) {
      candidates.add(bigram);
    }
  }
  for (const part of words) {
    if (part.length >= 4 && !STOPWORDS.has(part.toLowerCase())) {
      candidates.add(part);
    }
  }

  const mentions: PlaceResolveResult[] = [];
  for (const candidate of candidates) {
    const resolved = resolvePlaceQuery(candidate);
    if (resolved && !mentions.some((m) => m.iata === resolved.iata)) {
      mentions.push(resolved);
    }
  }

  // Do not invent an origin from loose word matches.
  // "from 20 august" is a date cue, not a city — never treat bare "from" as origin evidence.
  if (!destination && mentions[0] && origin?.iata !== mentions[0].iata) {
    destination = mentions[0];
  }
  if (
    origin &&
    destination &&
    origin.iata === destination.iata
  ) {
    origin = null;
  }

  if (destination?.mappedFrom) notes.push(destination.mappedFrom);
  if (origin?.mappedFrom) notes.push(origin.mappedFrom);

  return { origin, destination, notes };
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
};

function parseCountToken(raw: string): number | null {
  const lower = raw.toLowerCase();
  if (WORD_NUMBERS[lower] != null) return WORD_NUMBERS[lower];
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 && n <= 30 ? n : null;
}

/** "five nights" / "for 5 nights" — used for hotel checkout when only one calendar date exists. */
export function extractStayNights(text: string): number | null {
  const match = text.match(
    /\b(?:for\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)\s*nights?\b/i,
  );
  if (!match) return null;
  return parseCountToken(match[1]);
}

function addDaysIso(isoDate: string, days: number): string | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return toIsoDate(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  );
}

export function applyStayNights(
  departureDate: string | null,
  returnDate: string | null,
  stayNights: number | null,
): string | null {
  if (returnDate || !departureDate || stayNights == null || stayNights < 1) {
    return returnDate;
  }
  return addDaysIso(departureDate, stayNights) ?? returnDate;
}

export type ParseBookingMode = 'FLIGHTS' | 'HOTELS' | 'BOTH';

export const HOTEL_CITY_QUESTION =
  'Which city do you want a hotel in?';

export function isTravelIntentReady(
  intent: {
    originIata: string | null;
    destinationIata: string | null;
    destinationCity?: string | null;
    departureDate: string | null;
    returnDate?: string | null;
    tripType?: 'one_way' | 'round_trip' | null;
    hotelNights?: number | null;
  },
  bookingMode: ParseBookingMode = 'BOTH',
): boolean {
  if (bookingMode === 'HOTELS') {
    const hasDest = Boolean(
      intent.destinationIata || intent.destinationCity?.trim(),
    );
    if (!hasDest || !intent.departureDate) return false;
    if (
      intent.returnDate &&
      intent.returnDate >= intent.departureDate
    ) {
      return true;
    }
    const nights = intent.hotelNights;
    return (
      nights != null &&
      Number.isFinite(nights) &&
      nights >= 1 &&
      nights <= 30
    );
  }

  if (
    !intent.originIata ||
    !intent.destinationIata ||
    !intent.departureDate ||
    intent.originIata === intent.destinationIata ||
    !intent.tripType
  ) {
    return false;
  }
  if (intent.tripType === 'round_trip') {
    return Boolean(
      intent.returnDate && intent.returnDate >= intent.departureDate,
    );
  }
  if (bookingMode === 'FLIGHTS') return true;
  const nights = intent.hotelNights;
  return (
    nights != null &&
    Number.isFinite(nights) &&
    nights >= 1 &&
    nights <= 30
  );
}

export const NON_TRAVEL_QUESTION =
  "That doesn't look like a trip request. Where do you want to go?";

/** Detect explicit travel / booking signals in free text (not place-name invention). */
export function hasTravelSignals(text: string): boolean {
  const normalized = normalizeTravelText(text);
  if (
    /\b(flight|flights|hotel|hotels|trip|trips|travel|travelling|traveling|airport|itinerary|booking|book|one[\s-]?way|round[\s-]?trip|depart(?:ure|ing)?|return(?:ing)?|check[\s-]?in|check[\s-]?out|nights?)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /\bfrom\s+[A-Za-z]/.test(normalized) ||
    /\b(?:to|into|towards)\s+[A-Za-z]/.test(normalized) ||
    /\b(?:in|at)\s+[A-Za-z]{3,}/.test(normalized)
  ) {
    return true;
  }
  const dates = extractDates(normalized, new Date());
  return Boolean(dates.departureDate);
}

export function emptyTravelIntent(
  source: 'gemini' | 'groq' | 'heuristic',
  notes: string[] = [],
  isTravelRequest = true,
  bookingMode: ParseBookingMode = 'BOTH',
): ParseTravelIntentResponseDto {
  return finalizeTravelIntent(
    {
      isTravelRequest,
      originIata: null,
      destinationIata: null,
      originCity: null,
      destinationCity: null,
      departureDate: null,
      returnDate: null,
      tripType: null,
      hotelNights: null,
      adults: null,
      source,
      notes,
      clarifyingQuestion: isTravelRequest
        ? bookingMode === 'HOTELS'
          ? HOTEL_CITY_QUESTION
          : 'Where do you want to go?'
        : NON_TRAVEL_QUESTION,
    },
    bookingMode,
  );
}

/**
 * Drop invented same-city origins (e.g. "hotel in Dubai" wrongly becoming DXB→DXB).
 */
export function sanitizeSameCityOrigin<
  T extends {
    originIata: string | null;
    originCity: string | null;
    destinationIata: string | null;
    notes: string[];
  },
>(intent: T): T {
  if (
    intent.originIata &&
    intent.destinationIata &&
    intent.originIata === intent.destinationIata
  ) {
    return {
      ...intent,
      originIata: null,
      originCity: null,
      notes: [
        ...intent.notes,
        'departure city was missing — ignored same-city origin matching the destination',
      ],
    };
  }
  return intent;
}

/**
 * One natural follow-up for the current missing field.
 * Model text is only accepted when it clearly matches that field (no spoofing).
 */
export function buildClarifyingQuestion(
  intent: {
    originIata: string | null;
    destinationIata: string | null;
    destinationCity: string | null;
    departureDate: string | null;
    returnDate?: string | null;
    tripType?: 'one_way' | 'round_trip' | null;
    hotelNights?: number | null;
    isTravelRequest?: boolean;
  },
  modelQuestion?: string | null,
  bookingMode: ParseBookingMode = 'BOTH',
): string | null {
  if (isTravelIntentReady(intent, bookingMode)) return null;

  const fromModel =
    typeof modelQuestion === 'string' && modelQuestion.trim().length > 0
      ? modelQuestion.trim()
      : null;

  const hasHotelDest = Boolean(
    intent.destinationIata || intent.destinationCity?.trim(),
  );

  if (bookingMode === 'HOTELS') {
    if (!hasHotelDest) {
      if (
        fromModel &&
        /hotel in|which city|want a hotel|destin/i.test(fromModel) &&
        !/departing from/i.test(fromModel)
      ) {
        return fromModel;
      }
      return intent.isTravelRequest === false
        ? NON_TRAVEL_QUESTION
        : HOTEL_CITY_QUESTION;
    }
    if (!intent.departureDate) {
      return fromModel && /check-?in|departure date|what (date|day)/i.test(fromModel)
        ? fromModel
        : 'What check-in date should we use? (for example 25 January)';
    }
    if (
      !(
        intent.returnDate &&
        intent.returnDate >= intent.departureDate
      ) &&
      (intent.hotelNights == null ||
        !Number.isFinite(intent.hotelNights) ||
        intent.hotelNights < 1 ||
        intent.hotelNights > 30)
    ) {
      return fromModel &&
        /check-?out|return date|hotel nights|how many.*night/i.test(fromModel)
        ? fromModel
        : 'What check-out date should we use? (for example 30 January) — or how many hotel nights (1–30)?';
    }
    return 'Could you add a bit more detail so we can search hotels?';
  }

  if (!intent.destinationIata) {
    if (intent.destinationCity) {
      return `I found "${intent.destinationCity}" but could not map it to an airport — which city or airport should we use?`;
    }
    // Require destination-specific wording — do NOT accept bare "where" (origin spoof).
    if (
      fromModel &&
      /want to go|destin|which city or airport|hotel in/i.test(fromModel) &&
      !/departing from/i.test(fromModel)
    ) {
      return fromModel;
    }
    return intent.isTravelRequest === false
      ? NON_TRAVEL_QUESTION
      : 'Where do you want to go?';
  }
  // HOTELS already returned above — origin / trip-type only for FLIGHTS|BOTH.
  if (!intent.originIata) {
    return fromModel &&
      /departing from|where are you departing|origin city|leaving from/i.test(
        fromModel,
      )
      ? fromModel
      : 'Where are you departing from?';
  }
  if (!intent.tripType) {
    return fromModel && /one-way or round|trip type|one way or round/i.test(fromModel)
      ? fromModel
      : 'Is this one-way or round-trip?';
  }
  if (!intent.departureDate) {
    return fromModel &&
      /departure date|what departure|when (do|should) you (leave|depart)/i.test(
        fromModel,
      )
      ? fromModel
      : 'What departure date should we use? (for example 25 January)';
  }
  if (
    intent.tripType === 'round_trip' &&
    (!intent.returnDate || intent.returnDate < intent.departureDate)
  ) {
    return fromModel && /return date|what return|coming back/i.test(fromModel)
      ? fromModel
      : 'What return date should we use? (for example 30 January)';
  }
  if (
    bookingMode !== 'FLIGHTS' &&
    intent.tripType === 'one_way' &&
    (intent.hotelNights == null ||
      !Number.isFinite(intent.hotelNights) ||
      intent.hotelNights < 1 ||
      intent.hotelNights > 30)
  ) {
    return fromModel && /hotel nights|how many.*night/i.test(fromModel)
      ? fromModel
      : 'How many hotel nights (1–30)?';
  }
  return bookingMode === 'FLIGHTS'
    ? 'Could you add a bit more detail so we can search flights?'
    : 'Could you add a bit more detail so we can search flights and hotels?';
}

export type ClarificationFocus =
  | 'origin'
  | 'destination'
  | 'departureDate'
  | 'returnDate'
  | 'tripType'
  | 'hotelNights';

export function inferClarificationFocus(
  intent: {
    originIata: string | null;
    destinationIata: string | null;
    destinationCity?: string | null;
    departureDate: string | null;
    returnDate?: string | null;
    tripType?: 'one_way' | 'round_trip' | null;
    hotelNights?: number | null;
  },
  bookingMode: ParseBookingMode = 'BOTH',
): ClarificationFocus | null {
  if (bookingMode === 'HOTELS') {
    if (!(intent.destinationIata || intent.destinationCity?.trim())) {
      return 'destination';
    }
    if (!intent.departureDate) return 'departureDate';
    if (
      !(
        intent.returnDate &&
        intent.departureDate &&
        intent.returnDate >= intent.departureDate
      ) &&
      (intent.hotelNights == null ||
        !Number.isFinite(intent.hotelNights) ||
        intent.hotelNights < 1 ||
        intent.hotelNights > 30)
    ) {
      return 'returnDate';
    }
    return null;
  }

  if (!intent.destinationIata) return 'destination';
  if (!intent.originIata) return 'origin';
  if (!intent.tripType) return 'tripType';
  if (!intent.departureDate) return 'departureDate';
  if (
    intent.tripType === 'round_trip' &&
    (!intent.returnDate ||
      (intent.departureDate && intent.returnDate < intent.departureDate))
  ) {
    return 'returnDate';
  }
  if (
    bookingMode !== 'FLIGHTS' &&
    intent.tripType === 'one_way' &&
    (intent.hotelNights == null ||
      !Number.isFinite(intent.hotelNights) ||
      intent.hotelNights < 1 ||
      intent.hotelNights > 30)
  ) {
    return 'hotelNights';
  }
  return null;
}

export function finalizeTravelIntent(
  intent: Omit<
    ParseTravelIntentResponseDto,
    'clarifyingQuestion' | 'clarificationFocus'
  > & {
    clarifyingQuestion?: string | null;
    clarificationFocus?: ClarificationFocus | null;
    isTravelRequest?: boolean;
  },
  bookingMode: ParseBookingMode = 'BOTH',
): ParseTravelIntentResponseDto {
  const withFlag = {
    ...intent,
    isTravelRequest: intent.isTravelRequest ?? true,
  };
  const sanitized =
    bookingMode === 'HOTELS'
      ? {
          ...withFlag,
          // Hotels-only: ignore invented origin; stay window uses dates/nights.
          originIata: null,
          originCity: null,
        }
      : sanitizeSameCityOrigin(withFlag);

  const hotelNights = deriveHotelNights({
    tripType:
      bookingMode === 'HOTELS'
        ? sanitized.returnDate
          ? 'round_trip'
          : 'one_way'
        : sanitized.tripType,
    departureDate: sanitized.departureDate,
    returnDate: sanitized.returnDate,
    hotelNights: sanitized.hotelNights,
  });

  const withNights = {
    ...sanitized,
    hotelNights:
      bookingMode === 'HOTELS'
        ? hotelNights ??
          (sanitized.departureDate && sanitized.returnDate
            ? nightsBetweenIso(sanitized.departureDate, sanitized.returnDate)
            : null)
        : sanitized.tripType === 'round_trip'
          ? null
          : (hotelNights ?? null),
  };
  const clarifyingQuestion = buildClarifyingQuestion(
    withNights,
    sanitized.clarifyingQuestion,
    bookingMode,
  );
  return {
    ...withNights,
    clarifyingQuestion,
    clarificationFocus: inferClarificationFocus(withNights, bookingMode),
  };
}

/**
 * Prefer previously confirmed Q&A draft fields over a fresh heuristic re-parse
 * of the enriched chat (which often drops origin / corrupts dates).
 */
export function preferConfirmedDraft(
  parsed: ParseTravelIntentResponseDto,
  draft?: {
    originIata?: string | null;
    destinationIata?: string | null;
    originCity?: string | null;
    destinationCity?: string | null;
    departureDate?: string | null;
    returnDate?: string | null;
    tripType?: 'one_way' | 'round_trip' | null;
    hotelNights?: number | null;
    adults?: number | null;
  } | null,
  bookingMode: ParseBookingMode = 'BOTH',
): ParseTravelIntentResponseDto {
  if (!draft) {
    return finalizeTravelIntent(parsed, bookingMode);
  }
  return finalizeTravelIntent(
    {
      ...parsed,
      isTravelRequest: true,
      originIata: draft.originIata ?? parsed.originIata,
      destinationIata: draft.destinationIata ?? parsed.destinationIata,
      originCity: draft.originCity ?? parsed.originCity,
      destinationCity: draft.destinationCity ?? parsed.destinationCity,
      departureDate: draft.departureDate ?? parsed.departureDate,
      returnDate: draft.returnDate ?? parsed.returnDate,
      tripType: draft.tripType ?? parsed.tripType,
      hotelNights: draft.hotelNights ?? parsed.hotelNights,
      adults: draft.adults ?? parsed.adults,
      notes: parsed.notes,
      source: parsed.source,
    },
    bookingMode,
  );
}

/**
 * Apply a short follow-up answer (e.g. "Tbilisi") onto the missing field.
 * This is required because bare city names are not picked up by route patterns
 * like "from X to Y".
 */
export function applyClarificationAnswer(
  intent: ParseTravelIntentResponseDto,
  answer: string,
  focus: ClarificationFocus | null | undefined,
  referenceDate: Date,
  originalPrompt = '',
  bookingMode: ParseBookingMode = 'BOTH',
): ParseTravelIntentResponseDto {
  const trimmed = answer.trim();
  if (!trimmed) return intent;

  const target = focus ?? inferClarificationFocus(intent, bookingMode);
  if (!target) return intent;

  const next: ParseTravelIntentResponseDto = {
    ...intent,
    isTravelRequest: true,
    notes: [...intent.notes],
    clarifyingQuestion: null,
    clarificationFocus: null,
  };

  const done = () => finalizeTravelIntent(next, bookingMode);

  if (target === 'origin') {
    const place = resolvePlaceQuery(trimmed);
    if (!place) {
      next.notes.push(`could not map departure city "${trimmed}"`);
      return done();
    }
    if (place.iata === next.destinationIata) {
      next.notes.push(
        `departure city "${trimmed}" matches destination — please name a different origin`,
      );
      next.originIata = null;
      next.originCity = null;
      return done();
    }
    next.originIata = place.iata;
    next.originCity = place.city;
    if (place.mappedFrom) next.notes.push(place.mappedFrom);
    return done();
  }

  if (target === 'destination') {
    const place = resolvePlaceQuery(trimmed);
    if (!place) {
      next.notes.push(`could not map destination "${trimmed}"`);
      return done();
    }
    if (place.iata === next.originIata) {
      next.notes.push(
        `destination "${trimmed}" matches origin — please name a different city`,
      );
      return done();
    }
    next.destinationIata = place.iata;
    next.destinationCity = place.city;
    if (place.mappedFrom) next.notes.push(place.mappedFrom);
    return done();
  }

  if (target === 'tripType') {
    const parsedType = parseTripTypeAnswer(trimmed);
    if (!parsedType) {
      next.notes.push(`could not parse trip type "${trimmed}"`);
      return done();
    }
    next.tripType = parsedType;
    if (parsedType === 'round_trip') {
      next.hotelNights = null;
    } else {
      next.hotelNights = deriveHotelNights({
        tripType: 'one_way',
        departureDate: next.departureDate,
        returnDate: next.returnDate,
        hotelNights: next.hotelNights,
        stayNights:
          extractStayNights(originalPrompt) ?? extractStayNights(trimmed),
      });
      if (next.hotelNights != null && next.departureDate && !next.returnDate) {
        next.returnDate = applyStayNights(
          next.departureDate,
          null,
          next.hotelNights,
        );
      }
    }
    return done();
  }

  if (target === 'hotelNights') {
    const nights = parseHotelNightsAnswer(trimmed);
    if (nights == null) {
      next.notes.push(`could not parse hotel nights "${trimmed}"`);
      return done();
    }
    if (bookingMode !== 'HOTELS' && !next.tripType) {
      next.notes.push('trip type must be chosen before hotel nights');
      return done();
    }
    if (bookingMode === 'HOTELS' && !next.tripType) {
      next.tripType = 'one_way';
    }
    next.hotelNights = nights;
    if (next.departureDate) {
      next.returnDate = applyStayNights(next.departureDate, null, nights);
    }
    return done();
  }

  if (target === 'returnDate') {
    const nightsOnly = parseHotelNightsAnswer(trimmed);
    if (
      bookingMode === 'HOTELS' &&
      nightsOnly != null &&
      !/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})\b/i.test(
        trimmed,
      )
    ) {
      next.tripType = next.tripType ?? 'one_way';
      next.hotelNights = nightsOnly;
      if (next.departureDate) {
        next.returnDate = applyStayNights(next.departureDate, null, nightsOnly);
      }
      return done();
    }
    const fromAnswer = extractDates(trimmed, referenceDate);
    const parsedDates = fromAnswer.departureDate
      ? fromAnswer
      : extractDates(`on ${trimmed}`, referenceDate);
    const returnDate =
      parsedDates.returnDate ?? parsedDates.departureDate ?? null;
    if (!returnDate) {
      next.notes.push(`could not parse return date "${trimmed}"`);
      return done();
    }
    next.tripType = next.tripType ?? 'round_trip';
    next.returnDate = returnDate;
    next.hotelNights =
      bookingMode === 'HOTELS' && next.departureDate
        ? nightsBetweenIso(next.departureDate, returnDate)
        : null;
    return done();
  }

  // departureDate — do NOT invent tripType; ask separately if still null
  const fromAnswer = extractDates(trimmed, referenceDate);
  const parsedDates = fromAnswer.departureDate
    ? fromAnswer
    : extractDates(`on ${trimmed}`, referenceDate);
  if (!parsedDates.departureDate) {
    next.notes.push(`could not parse departure date "${trimmed}"`);
    return done();
  }

  next.departureDate = parsedDates.departureDate;
  const stayNights =
    extractStayNights(originalPrompt) ?? extractStayNights(trimmed);
  if (parsedDates.returnDate) {
    next.returnDate = parsedDates.returnDate;
    if (next.tripType === 'round_trip') {
      next.hotelNights = null;
    } else if (next.tripType === 'one_way') {
      next.hotelNights = deriveHotelNights({
        tripType: 'one_way',
        departureDate: next.departureDate,
        returnDate: next.returnDate,
        hotelNights: next.hotelNights,
        stayNights,
      });
    }
  } else if (next.tripType === 'one_way') {
    next.returnDate = applyStayNights(
      next.departureDate,
      next.returnDate,
      stayNights ?? next.hotelNights,
    );
    next.hotelNights = deriveHotelNights({
      tripType: 'one_way',
      departureDate: next.departureDate,
      returnDate: next.returnDate,
      hotelNights: next.hotelNights,
      stayNights,
    });
  }

  return done();
}

export function heuristicParseTravelIntent(
  prompt: string,
  referenceDate: Date,
  bookingMode: ParseBookingMode = 'BOTH',
): ParseTravelIntentResponseDto {
  const notes: string[] = [];
  const text = prompt.trim();

  if (!hasTravelSignals(text)) {
    return emptyTravelIntent(
      'heuristic',
      ['not a travel request'],
      false,
      bookingMode,
    );
  }

  const dates = extractDates(text, referenceDate);
  const route = extractRoute(text);
  const stayNights = extractStayNights(text);
  const returnDate = applyStayNights(
    dates.departureDate,
    dates.returnDate,
    stayNights,
  );
  // Explicit keywords win; two calendar dates → round trip; one date / nights → one way;
  // no date signal → leave tripType null so the UI can ask.
  const tripType = extractTripType(
    text,
    Boolean(dates.returnDate),
    Boolean(dates.departureDate),
    stayNights != null,
  );

  const adultsMatch = text.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine)\s*(?:adults?|travelers?|travellers?|people|persons?|pax)\b/i,
  );
  const adultsRaw = adultsMatch ? parseCountToken(adultsMatch[1]) : null;
  const adults =
    adultsRaw != null && adultsRaw >= 1 && adultsRaw <= 9 ? adultsRaw : null;

  notes.push(...route.notes);
  if (stayNights != null && dates.departureDate && !dates.returnDate) {
    notes.push(`inferred ${stayNights}-night stay end from departure date`);
  }

  const hotelNights = deriveHotelNights({
    tripType:
      bookingMode === 'HOTELS'
        ? returnDate
          ? 'round_trip'
          : 'one_way'
        : tripType,
    departureDate: dates.departureDate,
    returnDate,
    stayNights,
  });

  return finalizeTravelIntent(
    {
      isTravelRequest: true,
      originIata:
        bookingMode === 'HOTELS' ? null : (route.origin?.iata ?? null),
      destinationIata: route.destination?.iata ?? null,
      originCity:
        bookingMode === 'HOTELS' ? null : (route.origin?.city ?? null),
      destinationCity: route.destination?.city ?? null,
      departureDate: dates.departureDate,
      returnDate,
      tripType: bookingMode === 'HOTELS' ? (returnDate ? 'round_trip' : tripType) : tripType,
      hotelNights,
      adults,
      source: 'heuristic',
      notes,
    },
    bookingMode,
  );
}

export const PARSE_TRAVEL_SYSTEM = `You are SeeSight's travel intent parser for business trips worldwide.
Extract structured search fields from free-text. Return JSON only.

Rules:
- First decide isTravelRequest: true only if the user is asking to search/book/plan flights, hotels, or a trip. Unrelated questions (e.g. "what color is my dog", jokes, weather) → isTravelRequest=false, ALL travel fields null, clarifyingQuestion="${NON_TRAVEL_QUESTION.replace(/"/g, '\\"')}". NEVER invent cities, airports, dates, tripType, or hotelNights.
- When isTravelRequest=true: extract ONLY fields the user explicitly stated. Leave unknown fields null and ask ONE clarifyingQuestion.
- origin = departure city/airport/country; destination = arrival city/airport/country.
- Phrases like "to Budapest from Kutaisi" mean origin=Kutaisi, destination=Budapest.
- "from Kutaisi to Cyprus" means origin=Kutaisi, destination=Cyprus (country is allowed).
- "hotel/flights in Barcelona" with no origin → destinationCity=Barcelona, originIata=null.
- NEVER set originIata equal to destinationIata. If only one place is named (e.g. Dubai), that place is the DESTINATION only — leave originIata null and ask where they depart from.
- "from 20 august to 26 august" is a DATE range, not a departure city. Do not invent an origin from date phrases.
- If the user names a COUNTRY (e.g. Cyprus, Spain, Japan), set destinationCity to that country name AND set destinationIata to the country's primary international airport (Cyprus→LCA, Spain→MAD, Italy→FCO, Japan→NRT, UK→LHR, USA→JFK, etc.). Add a note like "mapped Cyprus to Larnaca (LCA)".
- If the user names a multi-airport city, pick the primary commercial airport (London→LHR, Paris→CDG, Istanbul→IST, New York→JFK, Dubai→DXB) unless they named a specific airport.
- Dates must be ISO YYYY-MM-DD only (zero-padded). If year is missing, pick the nearest future date relative to referenceDate.
- Accept BOTH day-first ("5 October") and month-first ("October 5") styles, including ranges ("October 5 to October 12").
- Accept relative dates: "next Monday", "this Friday", "tomorrow" → concrete ISO vs referenceDate.
- Stay length: "five nights" / "for 5 nights" with a departure date → set hotelNights=N and returnDate to departure + N nights. That alone does NOT make the trip round_trip.
- If the user says "one way" / "one-way", set tripType to "one_way". If they say "round trip" / "return", set tripType to "round_trip".
- If tripType is omitted: two distinct calendar dates → round_trip; only one calendar date (or date + nights) → one_way; no date signal → tripType=null and ask.
- adults is null when unspecified.
- Ask clarifyingQuestion for ONE missing piece only, in this priority: destination → origin → trip type → departure date → (round-trip) return date → (one-way) hotel nights.
- When origin, destination, tripType, departureDate, and (returnDate for round-trip OR hotelNights for one-way) are all known, set clarifyingQuestion to null.

Examples:
Input: "what color is my dog"
→ isTravelRequest=false, all fields null, clarifyingQuestion="${NON_TRAVEL_QUESTION.replace(/"/g, '\\"')}"

Input: "i want one way trip to budapest from 21 november to 29november from kutaisi"
→ isTravelRequest=true, originIata=KUT, destinationIata=BUD, departureDate≈YYYY-11-21, returnDate≈YYYY-11-29, tripType=one_way, hotelNights=8, clarifyingQuestion=null

Input: "i want round trip from kutaisi to cyprus from 20 august to 25 august"
→ isTravelRequest=true, originIata=KUT, destinationIata=LCA, tripType=round_trip, hotelNights=null, clarifyingQuestion=null

Input: "I need flights and a hotel in Barcelona from October 5 to October 12"
→ isTravelRequest=true, originIata=null, destinationIata=BCN, tripType=round_trip, clarifyingQuestion="Where are you departing from?"

Input: "flight to berlin on 25 january"
→ isTravelRequest=true, originIata=null, destinationIata=BER, tripType=one_way, hotelNights=null, clarifyingQuestion="Where are you departing from?"

Input: "Need a one-way flight from Tbilisi to Paris on September 15"
→ isTravelRequest=true, originIata=TBS, destinationIata=CDG, tripType=one_way, hotelNights=null, clarifyingQuestion="How many hotel nights (1–30)?"`;

export const PARSE_TRAVEL_SYSTEM_HOTELS = `You are SeeSight's hotel-stay intent parser for business travel.
Extract structured hotel search fields from free-text. Return JSON only.

Rules:
- isTravelRequest=true when the user wants a hotel/stay (even without a city). "i want hotel from 20 september to 25 september" is a travel request.
- Extract check-in as departureDate and check-out as returnDate when a date range is given ("from 20 september to 25 september").
- destinationCity / destinationIata = hotel city only when the user named a place. Do NOT invent a city.
- Always leave originIata and originCity null for hotels-only mode.
- tripType: use round_trip when check-out is known, else one_way; never ask about flight one-way vs round-trip.
- hotelNights: set when user said nights, or derive from check-in/check-out span.
- Ask clarifyingQuestion for ONE missing piece only: hotel city → check-in → check-out (or hotel nights). Never ask origin or flight trip type.
- Hotel city question must be: "${HOTEL_CITY_QUESTION}"
- Dates ISO YYYY-MM-DD; year-less dates resolve to nearest future vs referenceDate.

Examples:
Input: "i want hotel from 20 september to 25 september"
→ isTravelRequest=true, originIata=null, destinationIata=null, departureDate≈YYYY-09-20, returnDate≈YYYY-09-25, tripType=round_trip, clarifyingQuestion="${HOTEL_CITY_QUESTION}"

Input: "hotel in berlin from 20 september to 25 september"
→ isTravelRequest=true, destinationIata=BER, destinationCity=Berlin, departureDate≈YYYY-09-20, returnDate≈YYYY-09-25, clarifyingQuestion=null`;

export function buildParseTravelPrompt(
  prompt: string,
  referenceDate: string,
  bookingMode: ParseBookingMode = 'BOTH',
): string {
  return JSON.stringify({
    referenceDate,
    bookingMode,
    userRequest: prompt,
    responseSchema: {
      isTravelRequest:
        'boolean — false if not a flight/hotel/trip request; then all other fields null',
      originIata:
        bookingMode === 'HOTELS'
          ? 'null — always null for hotels-only'
          : 'string | null — primary commercial IATA; only if user stated it',
      destinationIata: 'string | null — only if user stated it',
      originCity: bookingMode === 'HOTELS' ? 'null' : 'string | null',
      destinationCity: 'string | null — hotel/destination city if stated',
      departureDate: 'YYYY-MM-DD | null — check-in / depart',
      returnDate: 'YYYY-MM-DD | null — check-out / return',
      tripType: 'one_way | round_trip | null',
      hotelNights: 'number | null',
      adults: 'number | null',
      notes: 'string[]',
      clarifyingQuestion:
        'string | null — one follow-up for the next missing field; or non-travel starter question',
    },
  });
}
