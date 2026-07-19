/** Compact city → primary IATA map for travel-intent parsing. */
export const CITY_AIRPORTS: Array<{
  iata: string;
  city: string;
  aliases?: string[];
}> = [
  { iata: 'TBS', city: 'Tbilisi', aliases: ['tbilisi', 'tiflis'] },
  { iata: 'BUS', city: 'Batumi' },
  { iata: 'KUT', city: 'Kutaisi' },
  { iata: 'EVN', city: 'Yerevan' },
  { iata: 'GYD', city: 'Baku' },
  { iata: 'IST', city: 'Istanbul', aliases: ['istanbul', 'constantinople'] },
  { iata: 'AYT', city: 'Antalya' },
  { iata: 'ESB', city: 'Ankara' },
  { iata: 'BER', city: 'Berlin' },
  { iata: 'MUC', city: 'Munich', aliases: ['munchen', 'münchen'] },
  { iata: 'FRA', city: 'Frankfurt' },
  { iata: 'HAM', city: 'Hamburg' },
  { iata: 'DUS', city: 'Düsseldorf', aliases: ['dusseldorf'] },
  { iata: 'CDG', city: 'Paris' },
  { iata: 'LHR', city: 'London' },
  { iata: 'AMS', city: 'Amsterdam' },
  { iata: 'MAD', city: 'Madrid' },
  { iata: 'BCN', city: 'Barcelona' },
  { iata: 'FCO', city: 'Rome', aliases: ['roma'] },
  { iata: 'MXP', city: 'Milan', aliases: ['milano'] },
  { iata: 'VIE', city: 'Vienna', aliases: ['wien'] },
  { iata: 'ZRH', city: 'Zurich', aliases: ['zürich'] },
  { iata: 'PRG', city: 'Prague', aliases: ['praha'] },
  { iata: 'WAW', city: 'Warsaw', aliases: ['warszawa'] },
  { iata: 'BUD', city: 'Budapest' },
  { iata: 'ATH', city: 'Athens' },
  { iata: 'OTP', city: 'Bucharest' },
  { iata: 'SOF', city: 'Sofia' },
  { iata: 'HEL', city: 'Helsinki' },
  { iata: 'ARN', city: 'Stockholm' },
  { iata: 'CPH', city: 'Copenhagen' },
  { iata: 'OSL', city: 'Oslo' },
  { iata: 'DUB', city: 'Dublin' },
  { iata: 'LIS', city: 'Lisbon', aliases: ['lisboa'] },
  { iata: 'BRU', city: 'Brussels' },
  { iata: 'DXB', city: 'Dubai' },
  { iata: 'DOH', city: 'Doha' },
  { iata: 'TLV', city: 'Tel Aviv', aliases: ['tel-aviv', 'telaviv'] },
  { iata: 'CAI', city: 'Cairo' },
  { iata: 'DEL', city: 'New Delhi', aliases: ['delhi'] },
  { iata: 'BOM', city: 'Mumbai', aliases: ['bombay'] },
  { iata: 'BKK', city: 'Bangkok' },
  { iata: 'SIN', city: 'Singapore' },
  { iata: 'NRT', city: 'Tokyo' },
  { iata: 'ICN', city: 'Seoul' },
  { iata: 'JFK', city: 'New York', aliases: ['nyc', 'new-york'] },
  { iata: 'LAX', city: 'Los Angeles', aliases: ['la'] },
  { iata: 'SFO', city: 'San Francisco' },
  { iata: 'ORD', city: 'Chicago' },
  { iata: 'YYZ', city: 'Toronto' },
  { iata: 'SVO', city: 'Moscow', aliases: ['moskva'] },
  { iata: 'ALA', city: 'Almaty' },
  { iata: 'TAS', city: 'Tashkent' },
  { iata: 'KBP', city: 'Kyiv', aliases: ['kiev'] },
];

export function resolveCityQuery(
  query: string,
): { iata: string; city: string } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (/^[a-z]{3}$/i.test(q)) {
    const code = q.toUpperCase();
    const byIata = CITY_AIRPORTS.find((a) => a.iata === code);
    if (byIata) return { iata: byIata.iata, city: byIata.city };
  }
  for (const row of CITY_AIRPORTS) {
    if (row.city.toLowerCase() === q) return { iata: row.iata, city: row.city };
    if (row.aliases?.some((a) => a.toLowerCase() === q)) {
      return { iata: row.iata, city: row.city };
    }
  }
  for (const row of CITY_AIRPORTS) {
    if (
      row.city.toLowerCase().startsWith(q) ||
      q.startsWith(row.city.toLowerCase())
    ) {
      return { iata: row.iata, city: row.city };
    }
  }
  return null;
}
