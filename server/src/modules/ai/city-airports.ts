import { readFileSync } from 'fs';
import { join } from 'path';

export type AirportRecord = {
  iata: string;
  city: string;
  country: string;
  countryCode: string;
  name: string;
};

export type PlaceResolveResult = {
  iata: string;
  city: string;
  country: string;
  countryCode: string;
  /** How the query was mapped (useful for UX notes). */
  mappedFrom?: string;
};

type AirportsDataset = {
  airports: AirportRecord[];
  countryHubs: Record<string, string>;
  cityHubs: Record<string, string>;
  countries: Record<string, string>;
};

/** Common place aliases → IATA (countries, islands, alternate spellings). */
const PLACE_ALIASES: Record<string, string> = {
  cyprus: 'LCA',
  bali: 'DPS',
  denpasar: 'DPS',
  tbilisi: 'TBS',
  kutaisi: 'KUT',
  batumi: 'BUS',
  nyc: 'JFK',
  'new york': 'JFK',
  'new-york': 'JFK',
  la: 'LAX',
  'los angeles': 'LAX',
  'san francisco': 'SFO',
  tokyo: 'NRT',
  seoul: 'ICN',
  moscow: 'SVO',
  kiev: 'KBP',
  kyiv: 'KBP',
  saigon: 'SGN',
  'ho chi minh': 'SGN',
  'ho chi minh city': 'SGN',
  bombay: 'BOM',
  delhi: 'DEL',
  'new delhi': 'DEL',
  peking: 'PEK',
  beijing: 'PEK',
  constantinople: 'IST',
  istanbul: 'IST',
  munchen: 'MUC',
  münchen: 'MUC',
  wien: 'VIE',
  praha: 'PRG',
  warszawa: 'WAW',
  milano: 'MXP',
  roma: 'FCO',
  lisboa: 'LIS',
  zürich: 'ZRH',
  zurich: 'ZRH',
  dusseldorf: 'DUS',
  düsseldorf: 'DUS',
  'cape town': 'CPT',
  capetown: 'CPT',
};

/** Prefer familiar city labels when OurAirports municipality differs. */
const CITY_LABEL_OVERRIDES: Record<string, string> = {
  KUT: 'Kutaisi',
  BUS: 'Batumi',
  TBS: 'Tbilisi',
  CPT: 'Cape Town',
  DPS: 'Denpasar',
  LCA: 'Larnaca',
};

let dataset: AirportsDataset | null = null;
let byIata: Map<string, AirportRecord> | null = null;
let byCity: Map<string, AirportRecord[]> | null = null;
let byCountryName: Map<string, string> | null = null;
let cityNamesSorted: string[] | null = null;

function loadDataset(): AirportsDataset {
  if (dataset) return dataset;
  const candidates = [
    join(__dirname, 'data', 'airports.json'),
    join(process.cwd(), 'src', 'modules', 'ai', 'data', 'airports.json'),
    join(process.cwd(), 'dist', 'src', 'modules', 'ai', 'data', 'airports.json'),
    // Nest assets without outDir override land here (sourceRoot strips src/).
    join(process.cwd(), 'dist', 'modules', 'ai', 'data', 'airports.json'),
  ];
  let raw: string | null = null;
  for (const p of candidates) {
    try {
      raw = readFileSync(p, 'utf8');
      break;
    } catch {
      // try next
    }
  }
  if (!raw) {
    throw new Error('Global airports dataset (airports.json) not found');
  }
  dataset = JSON.parse(raw) as AirportsDataset;
  return dataset;
}

function ensureIndexes(): void {
  if (byIata && byCity && byCountryName && cityNamesSorted) return;
  const data = loadDataset();
  byIata = new Map();
  byCity = new Map();
  for (const a of data.airports) {
    byIata.set(a.iata, a);
    const key = a.city.toLowerCase();
    const list = byCity.get(key) ?? [];
    list.push(a);
    byCity.set(key, list);
  }

  for (const [iata, label] of Object.entries(CITY_LABEL_OVERRIDES)) {
    const a = byIata.get(iata);
    if (!a) continue;
    const key = label.toLowerCase();
    const list = byCity.get(key) ?? [];
    if (!list.some((x) => x.iata === iata)) {
      list.push({ ...a, city: label });
      byCity.set(key, list);
    }
  }

  byCountryName = new Map();
  for (const [iso, name] of Object.entries(data.countries)) {
    byCountryName.set(name.toLowerCase(), iso);
    byCountryName.set(iso.toLowerCase(), iso);
  }
  const extra: Record<string, string> = {
    uk: 'GB',
    'united kingdom': 'GB',
    'great britain': 'GB',
    england: 'GB',
    usa: 'US',
    'united states': 'US',
    'united states of america': 'US',
    holland: 'NL',
    'south korea': 'KR',
    'north korea': 'KP',
    russia: 'RU',
    'czech republic': 'CZ',
    czechia: 'CZ',
    uae: 'AE',
    'united arab emirates': 'AE',
  };
  for (const [name, iso] of Object.entries(extra)) {
    byCountryName.set(name, iso);
  }

  cityNamesSorted = [...byCity.keys()].sort((a, b) => b.length - a.length);
}

function recordFromIata(
  iata: string,
  mappedFrom?: string,
): PlaceResolveResult | null {
  ensureIndexes();
  const a = byIata!.get(iata.toUpperCase());
  if (!a) return null;
  const cityLabel = CITY_LABEL_OVERRIDES[a.iata] ?? a.city;
  return {
    iata: a.iata,
    city: cityLabel,
    country: a.country,
    countryCode: a.countryCode,
    mappedFrom,
  };
}

function pickCityPrimary(candidates: AirportRecord[]): AirportRecord {
  const data = loadDataset();
  if (candidates.length === 1) return candidates[0];
  const key = `${candidates[0].city}|${candidates[0].countryCode}`.toLowerCase();
  const hubIata = data.cityHubs[key];
  if (hubIata) {
    const hub =
      candidates.find((c) => c.iata === hubIata) ?? byIata!.get(hubIata);
    if (hub) return hub;
  }
  return candidates[0];
}

/**
 * Resolve free-text place (IATA, city, country, or alias) to a commercial airport.
 * Worldwide coverage via bundled OurAirports-derived dataset.
 */
export function resolvePlaceQuery(query: string): PlaceResolveResult | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return null;
  ensureIndexes();
  const data = loadDataset();

  if (/^[a-z]{3}$/i.test(q)) {
    const hit = recordFromIata(q.toUpperCase());
    if (hit) return hit;
  }

  const aliasIata = PLACE_ALIASES[q];
  if (aliasIata) {
    const hit = recordFromIata(aliasIata, query.trim());
    if (hit) return hit;
  }

  const iso = byCountryName!.get(q);
  if (iso) {
    const hubIata = data.countryHubs[iso];
    if (hubIata) {
      const hit = recordFromIata(hubIata, query.trim());
      if (hit) {
        return {
          ...hit,
          mappedFrom: `${query.trim()} → ${hit.city} (${hit.iata})`,
        };
      }
    }
  }

  const cityHits = byCity!.get(q);
  if (cityHits && cityHits.length > 0) {
    const primary = pickCityPrimary(cityHits);
    return recordFromIata(primary.iata) ?? {
      iata: primary.iata,
      city: CITY_LABEL_OVERRIDES[primary.iata] ?? primary.city,
      country: primary.country,
      countryCode: primary.countryCode,
    };
  }

  if (q.length >= 4) {
    for (const a of data.airports) {
      if (a.name.toLowerCase().includes(q)) {
        return recordFromIata(a.iata, query.trim());
      }
    }
  }

  if (q.length >= 4) {
    for (const city of cityNamesSorted!) {
      if (city.startsWith(q) || q.startsWith(city)) {
        const hits = byCity!.get(city);
        if (hits?.length) {
          const primary = pickCityPrimary(hits);
          return recordFromIata(primary.iata);
        }
      }
    }
  }

  return null;
}

/** @deprecated Prefer resolvePlaceQuery. */
export function resolveCityQuery(
  query: string,
): { iata: string; city: string } | null {
  const hit = resolvePlaceQuery(query);
  if (!hit) return null;
  return { iata: hit.iata, city: hit.city };
}

export function getAllAirports(): AirportRecord[] {
  return loadDataset().airports;
}
