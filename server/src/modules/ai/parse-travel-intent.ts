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
): 'one_way' | 'round_trip' {
  if (/\b(one[\s-]?way|ow)\b/i.test(text)) return 'one_way';
  if (/\b(round[\s-]?trip|return(?:\s+trip)?|two[\s-]?way)\b/i.test(text)) {
    return 'round_trip';
  }
  return hasReturnDate ? 'round_trip' : 'one_way';
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
      /\bfrom\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?=\s+(?:to|into|towards|from|on|for|with|and)\b|[.,]|$)/i,
    );
    const toOnly = forCities.match(
      /\b(?:to|into|towards)\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?=\s+(?:from|on|for|with|and|between)\b|[.,]|$)/i,
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

export function isTravelIntentReady(intent: {
  originIata: string | null;
  destinationIata: string | null;
  departureDate: string | null;
}): boolean {
  return Boolean(
    intent.originIata &&
      intent.destinationIata &&
      intent.departureDate &&
      intent.originIata !== intent.destinationIata,
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
 * One natural follow-up question for the most important missing search field.
 * Prefer model-authored text when provided; otherwise fall back to a default.
 */
export function buildClarifyingQuestion(
  intent: {
    originIata: string | null;
    destinationIata: string | null;
    destinationCity: string | null;
    departureDate: string | null;
  },
  modelQuestion?: string | null,
): string | null {
  if (isTravelIntentReady(intent)) return null;

  const fromModel =
    typeof modelQuestion === 'string' && modelQuestion.trim().length > 0
      ? modelQuestion.trim()
      : null;
  // Prefer deterministic questions for required search fields so a bad model
  // answer cannot skip "where are you departing from?" after inventing DXB→DXB.
  if (!intent.destinationIata) {
    if (intent.destinationCity) {
      return `I found "${intent.destinationCity}" but could not map it to an airport — which city or airport should we use?`;
    }
    return fromModel && /where|destin|go|city|airport/i.test(fromModel)
      ? fromModel
      : 'Where do you want to go?';
  }
  if (!intent.originIata) {
    return fromModel && /depart|origin|from|leaving|leave/i.test(fromModel)
      ? fromModel
      : 'Where are you departing from?';
  }
  if (!intent.departureDate) {
    return fromModel &&
      /date|when/i.test(fromModel) &&
      !/departing from|origin/i.test(fromModel)
      ? fromModel
      : 'What departure date should we use? (for example 25 January)';
  }
  return (
    fromModel ??
    'Could you add a bit more detail so we can search flights and hotels?'
  );
}

export function finalizeTravelIntent(
  intent: Omit<ParseTravelIntentResponseDto, 'clarifyingQuestion'> & {
    clarifyingQuestion?: string | null;
  },
): ParseTravelIntentResponseDto {
  const sanitized = sanitizeSameCityOrigin(intent);
  return {
    ...sanitized,
    clarifyingQuestion: buildClarifyingQuestion(
      sanitized,
      sanitized.clarifyingQuestion,
    ),
  };
}

export type ClarificationFocus = 'origin' | 'destination' | 'departureDate';

export function inferClarificationFocus(intent: {
  originIata: string | null;
  destinationIata: string | null;
  departureDate: string | null;
}): ClarificationFocus | null {
  if (!intent.destinationIata) return 'destination';
  if (!intent.originIata) return 'origin';
  if (!intent.departureDate) return 'departureDate';
  return null;
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
): ParseTravelIntentResponseDto {
  const trimmed = answer.trim();
  if (!trimmed) return intent;

  const target = focus ?? inferClarificationFocus(intent);
  if (!target) return intent;

  const next: ParseTravelIntentResponseDto = {
    ...intent,
    notes: [...intent.notes],
    clarifyingQuestion: null,
  };

  if (target === 'origin') {
    const place = resolvePlaceQuery(trimmed);
    if (!place) {
      next.notes.push(`could not map departure city "${trimmed}"`);
      return finalizeTravelIntent(next);
    }
    if (place.iata === next.destinationIata) {
      next.notes.push(
        `departure city "${trimmed}" matches destination — please name a different origin`,
      );
      next.originIata = null;
      next.originCity = null;
      return finalizeTravelIntent(next);
    }
    next.originIata = place.iata;
    next.originCity = place.city;
    if (place.mappedFrom) next.notes.push(place.mappedFrom);
    return finalizeTravelIntent(next);
  }

  if (target === 'destination') {
    const place = resolvePlaceQuery(trimmed);
    if (!place) {
      next.notes.push(`could not map destination "${trimmed}"`);
      return finalizeTravelIntent(next);
    }
    if (place.iata === next.originIata) {
      next.notes.push(
        `destination "${trimmed}" matches origin — please name a different city`,
      );
      return finalizeTravelIntent(next);
    }
    next.destinationIata = place.iata;
    next.destinationCity = place.city;
    if (place.mappedFrom) next.notes.push(place.mappedFrom);
    return finalizeTravelIntent(next);
  }

  const fromAnswer = extractDates(trimmed, referenceDate);
  const parsedDates = fromAnswer.departureDate
    ? fromAnswer
    : extractDates(`on ${trimmed}`, referenceDate);
  if (!parsedDates.departureDate) {
    next.notes.push(`could not parse departure date "${trimmed}"`);
    return finalizeTravelIntent(next);
  }

  next.departureDate = parsedDates.departureDate;
  const stayNights =
    extractStayNights(originalPrompt) ?? extractStayNights(trimmed);
  next.returnDate = applyStayNights(
    next.departureDate,
    parsedDates.returnDate ?? next.returnDate,
    stayNights,
  );
  if (parsedDates.returnDate) {
    next.tripType = 'round_trip';
  } else if (!next.tripType) {
    next.tripType = 'one_way';
  }

  return finalizeTravelIntent(next);
}

export function heuristicParseTravelIntent(
  prompt: string,
  referenceDate: Date,
): ParseTravelIntentResponseDto {
  const notes: string[] = [];
  const text = prompt.trim();
  const dates = extractDates(text, referenceDate);
  const route = extractRoute(text);
  const stayNights = extractStayNights(text);
  const returnDate = applyStayNights(
    dates.departureDate,
    dates.returnDate,
    stayNights,
  );
  // Two explicit calendar dates → round trip; a single date (even with "N nights") → one way.
  const tripType = extractTripType(text, Boolean(dates.returnDate));

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

  return finalizeTravelIntent({
    originIata: route.origin?.iata ?? null,
    destinationIata: route.destination?.iata ?? null,
    originCity: route.origin?.city ?? null,
    destinationCity: route.destination?.city ?? null,
    departureDate: dates.departureDate,
    returnDate,
    tripType,
    adults,
    source: 'heuristic',
    notes,
  });
}

export const PARSE_TRAVEL_SYSTEM = `You are SeeSight's travel intent parser for business trips worldwide.
Extract structured search fields from free-text. Return JSON only.

Rules:
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
- Accept glued dates like "29november" as 29 November.
- Stay length: "five nights" / "for 5 nights" with a departure date → set returnDate to departure + N nights (hotel checkout). That alone does NOT make the trip round_trip.
- If the user says "one way" / "one-way", set tripType to "one_way". If they give a date range on a one-way trip, still fill returnDate as the stay end / hotel checkout date.
- If they say "round trip" / "return", set tripType to "round_trip".
- If tripType is omitted: two distinct calendar dates → round_trip; only one calendar date (or date + nights) → one_way.
- Always return concrete IATA codes when possible. Prefer real commercial airport codes.
- Do not invent cities, dates, or airports that were not mentioned.
- adults is null when unspecified.
- When origin, destination, OR departureDate is still unknown after extraction, set clarifyingQuestion to ONE short natural question that asks only for the most important missing piece (e.g. "Where are you departing from?"). Do not dump a list of missing fields. Do not ask about budget.
- When origin, destination, and departureDate are all known, set clarifyingQuestion to null.

Examples:
Input: "i want one way trip to budapest from 21 november to 29november from kutaisi"
→ originIata=KUT, destinationIata=BUD, departureDate≈YYYY-11-21, returnDate≈YYYY-11-29, tripType=one_way, clarifyingQuestion=null

Input: "i want round trip from kutaisi to cyprus from 20 august to 25 august"
→ originIata=KUT, destinationIata=LCA, destinationCity=Larnaca (or Cyprus), departureDate≈YYYY-08-20, returnDate≈YYYY-08-25, tripType=round_trip, clarifyingQuestion=null, notes include mapping cyprus→LCA

Input: "I need flights and a hotel in Barcelona from October 5 to October 12"
→ originIata=null, destinationIata=BCN, departureDate≈YYYY-10-05, returnDate≈YYYY-10-12, tripType=round_trip, clarifyingQuestion="Where are you departing from?"

Input: "My budget is around €500. I need flights for 2 adults and a hotel in Dubai for five nights"
→ originIata=null, destinationIata=DXB, adults=2, departureDate=null, returnDate=null, tripType=one_way, clarifyingQuestion="Where are you departing from?"

Input: "I need flights for 2 adults and a hotel in Dubai for five nights. from 20august to 26 august"
→ originIata=null, destinationIata=DXB, adults=2, departureDate≈YYYY-08-20, returnDate≈YYYY-08-26, tripType=round_trip, clarifyingQuestion="Where are you departing from?"
  (Do NOT set originIata=DXB. Dates are not an origin.)

Input: "Book me a flight from Batumi to Rome next Monday."
→ originIata=BUS, destinationIata=FCO (or CIA), departureDate=next Monday ISO vs referenceDate, tripType=one_way, clarifyingQuestion=null

Input: "Need a one-way flight from Tbilisi to Paris on September 15"
→ originIata=TBS, destinationIata=CDG, departureDate≈YYYY-09-15, tripType=one_way, clarifyingQuestion=null

Input: "from tbilisi to bali 1 september to 10 september"
→ originIata=TBS, destinationIata=DPS, tripType=round_trip, clarifyingQuestion=null

Input: "from 1 august to 6 august from tbilisi to berlin"
→ originIata=TBS, destinationIata=BER, tripType=round_trip, clarifyingQuestion=null

Input: "flight to berlin on 25 january"
→ originIata=null, destinationIata=BER, departureDate≈YYYY-01-25, tripType=one_way, clarifyingQuestion="Where are you departing from?"`;

export function buildParseTravelPrompt(
  prompt: string,
  referenceDate: string,
): string {
  return JSON.stringify({
    referenceDate,
    userRequest: prompt,
    responseSchema: {
      originIata: 'string | null — primary commercial IATA',
      destinationIata: 'string | null — primary commercial IATA',
      originCity: 'string | null',
      destinationCity: 'string | null — city or country as stated / resolved',
      departureDate: 'YYYY-MM-DD | null',
      returnDate:
        'YYYY-MM-DD | null — stay end / return flight date when present',
      tripType: 'one_way | round_trip | null',
      adults: 'number | null',
      notes: 'string[] — mapping caveats e.g. country→hub',
      clarifyingQuestion:
        'string | null — one natural follow-up when origin, destination, or departureDate is missing; otherwise null',
    },
  });
}
