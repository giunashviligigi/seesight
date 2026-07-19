import { CITY_AIRPORTS, resolveCityQuery } from './city-airports';
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

function extractDates(
  text: string,
  reference: Date,
): { departureDate: string | null; returnDate: string | null } {
  const normalized = text.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');

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

  const isoRange = normalized.match(
    /\b(\d{4}-\d{2}-\d{2})\s*(?:to|-|–)\s*(\d{4}-\d{2}-\d{2})\b/i,
  );
  if (isoRange) {
    return { departureDate: isoRange[1], returnDate: isoRange[2] };
  }

  return { departureDate: null, returnDate: null };
}

export function heuristicParseTravelIntent(
  prompt: string,
  referenceDate: Date,
): ParseTravelIntentResponseDto {
  const notes: string[] = [];
  const text = prompt.trim();
  const dates = extractDates(text, referenceDate);

  let origin: { iata: string; city: string } | null = null;
  let destination: { iata: string; city: string } | null = null;

  const fromTo = text.match(
    /\bfrom\s+([A-Za-z\s.'-]{2,40}?)\s+to\s+([A-Za-z\s.'-]{2,40}?)(?:\b(?:on|from|between|for|suggest|find|with|and|,|\.|$))/i,
  );
  if (fromTo) {
    origin = resolveCityQuery(fromTo[1].trim());
    destination = resolveCityQuery(fromTo[2].trim());
  }

  if (!origin || !destination) {
    const mentions: Array<{ iata: string; city: string; index: number }> = [];
    for (const row of CITY_AIRPORTS) {
      const names = [row.city, ...(row.aliases ?? [])];
      for (const name of names) {
        const idx = text.toLowerCase().indexOf(name.toLowerCase());
        if (idx >= 0) {
          mentions.push({ iata: row.iata, city: row.city, index: idx });
          break;
        }
      }
    }
    mentions.sort((a, b) => a.index - b.index);
    const unique: Array<{ iata: string; city: string }> = [];
    for (const m of mentions) {
      if (!unique.some((u) => u.city === m.city)) {
        unique.push({ iata: m.iata, city: m.city });
      }
    }
    if (!origin && unique[0]) origin = unique[0];
    if (!destination && unique[1]) destination = unique[1];
    if (!destination && unique[0] && origin?.city !== unique[0].city) {
      destination = unique[0];
    }
  }

  const adultsMatch = text.match(
    /\b(\d+)\s*(?:adults?|travelers?|travellers?|people|persons?|pax)\b/i,
  );
  const adults = adultsMatch ? Number(adultsMatch[1]) : null;

  if (!dates.departureDate) notes.push('could not detect departure date');
  if (!dates.returnDate) notes.push('could not detect return date');
  if (!origin) notes.push('could not detect origin city');
  if (!destination) notes.push('could not detect destination city');

  return {
    originIata: origin?.iata ?? null,
    destinationIata: destination?.iata ?? null,
    originCity: origin?.city ?? null,
    destinationCity: destination?.city ?? null,
    departureDate: dates.departureDate,
    returnDate: dates.returnDate,
    adults:
      adults != null && Number.isFinite(adults) && adults >= 1 && adults <= 9
        ? adults
        : null,
    source: 'heuristic',
    notes,
  };
}

export const PARSE_TRAVEL_SYSTEM = `You are SeeSight's travel intent parser.
Extract structured trip search fields from a user's free-text request.
Return JSON only. Do not invent airports that are not implied.
Dates must be ISO YYYY-MM-DD. If year is missing, use the nearest future date relative to referenceDate.
IATA codes should be primary commercial airports for the cities mentioned.
adults defaults to null if unspecified.`;

export function buildParseTravelPrompt(
  prompt: string,
  referenceDate: string,
): string {
  return JSON.stringify({
    referenceDate,
    userRequest: prompt,
    responseSchema: {
      originIata: 'string | null',
      destinationIata: 'string | null',
      originCity: 'string | null',
      destinationCity: 'string | null',
      departureDate: 'YYYY-MM-DD | null',
      returnDate: 'YYYY-MM-DD | null',
      adults: 'number | null',
      notes: 'string[] — parsing caveats',
    },
  });
}
