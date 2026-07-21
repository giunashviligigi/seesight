/**
 * Builds a compact airports.json from OurAirports CSVs.
 * Run: node scripts/build-airports-json.js
 */
const fs = require('fs');
const path = require('path');

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQ = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    if (row.length) rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ',') {
      pushField();
      i++;
      continue;
    }
    if (c === '\n') {
      pushField();
      pushRow();
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    pushField();
    pushRow();
  }
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, idx) => {
      o[h] = r[idx] ?? '';
    });
    return o;
  });
}

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'src', 'modules', 'ai', 'data');
const airports = parseCsv(
  fs.readFileSync(path.join(dataDir, 'airports-raw.csv'), 'utf8'),
);
const countries = parseCsv(
  fs.readFileSync(path.join(dataDir, 'countries-raw.csv'), 'utf8'),
);

const countryNameByIso = {};
for (const c of countries) {
  if (c.code && c.name) countryNameByIso[c.code] = c.name;
}

const typeRank = { large_airport: 3, medium_airport: 2, small_airport: 1 };
const kept = [];
for (const a of airports) {
  const iata = (a.iata_code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) continue;
  if (
    a.type === 'closed' ||
    a.type === 'heliport' ||
    a.type === 'seaplane_base' ||
    a.type === 'balloonport'
  ) {
    continue;
  }
  const city =
    (a.municipality || '').trim() ||
    (a.name || '').replace(/\s+Airport.*$/i, '').trim();
  if (!city) continue;
  kept.push({
    iata,
    city,
    country: countryNameByIso[a.iso_country] || a.iso_country || '',
    countryCode: a.iso_country || '',
    name: (a.name || '').trim(),
    type: a.type || 'small_airport',
    scheduled: a.scheduled_service === 'yes',
  });
}

const byIata = new Map();
const score = (x) => (x.scheduled ? 10 : 0) + (typeRank[x.type] || 0);
for (const a of kept) {
  const prev = byIata.get(a.iata);
  if (!prev || score(a) > score(prev)) byIata.set(a.iata, a);
}
const list = [...byIata.values()].sort((a, b) => a.iata.localeCompare(b.iata));

const byCountry = new Map();
for (const a of list) {
  if (!a.countryCode) continue;
  const arr = byCountry.get(a.countryCode) || [];
  arr.push(a);
  byCountry.set(a.countryCode, arr);
}

const hubs = {};
for (const [code, arr] of byCountry) {
  arr.sort((a, b) => {
    const sa = (a.scheduled ? 100 : 0) + (typeRank[a.type] || 0) * 10;
    const sb = (b.scheduled ? 100 : 0) + (typeRank[b.type] || 0) * 10;
    return sb - sa || a.iata.localeCompare(b.iata);
  });
  hubs[code] = arr[0].iata;
}

/** Prefer well-known primary hubs when OurAirports ranking picks a secondary. */
const HUB_OVERRIDES = {
  CY: 'LCA',
  GB: 'LHR',
  UK: 'LHR',
  FR: 'CDG',
  US: 'JFK',
  TR: 'IST',
  IT: 'FCO',
  ES: 'MAD',
  DE: 'FRA',
  JP: 'NRT',
  CN: 'PEK',
  AU: 'SYD',
  CA: 'YYZ',
  AE: 'DXB',
  GE: 'TBS',
  ID: 'CGK',
  TH: 'BKK',
  GR: 'ATH',
  PT: 'LIS',
  NL: 'AMS',
  BE: 'BRU',
  CH: 'ZRH',
  AT: 'VIE',
  PL: 'WAW',
  CZ: 'PRG',
  HU: 'BUD',
  RO: 'OTP',
  BG: 'SOF',
  SE: 'ARN',
  NO: 'OSL',
  DK: 'CPH',
  FI: 'HEL',
  IE: 'DUB',
  EG: 'CAI',
  ZA: 'JNB',
  IN: 'DEL',
  KR: 'ICN',
  SG: 'SIN',
  MY: 'KUL',
  PH: 'MNL',
  VN: 'SGN',
  BR: 'GRU',
  MX: 'MEX',
  AR: 'EZE',
  CL: 'SCL',
  RU: 'SVO',
  UA: 'KBP',
  IL: 'TLV',
  QA: 'DOH',
  SA: 'RUH',
  AM: 'EVN',
  AZ: 'GYD',
};
for (const [code, iata] of Object.entries(HUB_OVERRIDES)) {
  if (byIata.has(iata)) hubs[code] = iata;
}

const cityHubs = {};
const byCity = new Map();
for (const a of list) {
  const key = `${a.city}|${a.countryCode}`.toLowerCase();
  const arr = byCity.get(key) || [];
  arr.push(a);
  byCity.set(key, arr);
}
for (const [key, arr] of byCity) {
  arr.sort((a, b) => {
    const sa = (a.scheduled ? 100 : 0) + (typeRank[a.type] || 0) * 10;
    const sb = (b.scheduled ? 100 : 0) + (typeRank[b.type] || 0) * 10;
    return sb - sa || a.iata.localeCompare(b.iata);
  });
  cityHubs[key] = arr[0].iata;
}

/** Prefer primary commercial airports for multi-airport cities. */
const CITY_HUB_OVERRIDES = {
  'london|gb': 'LHR',
  'paris|fr': 'CDG',
  'istanbul|tr': 'IST',
  'new york|us': 'JFK',
  'tokyo|jp': 'NRT',
  'milan|it': 'MXP',
  'rome|it': 'FCO',
  'moscow|ru': 'SVO',
  'seoul|kr': 'ICN',
  'jakarta|id': 'CGK',
  'denpasar|id': 'DPS',
  'bali|id': 'DPS',
};
for (const [key, iata] of Object.entries(CITY_HUB_OVERRIDES)) {
  if (byIata.has(iata)) cityHubs[key] = iata;
}

const out = {
  airports: list.map(({ iata, city, country, countryCode, name }) => ({
    iata,
    city,
    country,
    countryCode,
    name,
  })),
  countryHubs: hubs,
  cityHubs,
  countries: countryNameByIso,
};

const outPath = path.join(dataDir, 'airports.json');
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(
  JSON.stringify(
    {
      airports: list.length,
      countries: Object.keys(countryNameByIso).length,
      hubs: Object.keys(hubs).length,
      cyprusHub: hubs.CY,
      lca: list.find((a) => a.iata === 'LCA'),
      sizeMB: +(fs.statSync(outPath).size / 1024 / 1024).toFixed(2),
    },
    null,
    2,
  ),
);
