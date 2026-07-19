export type Airport = {
  iata: string;
  city: string;
  country: string;
  name: string;
};

/** Common airports for search UI — labels show city names; API still uses IATA. */
export const AIRPORTS: Airport[] = [
  { iata: "TBS", city: "Tbilisi", country: "Georgia", name: "Tbilisi International" },
  { iata: "BUS", city: "Batumi", country: "Georgia", name: "Batumi International" },
  { iata: "KUT", city: "Kutaisi", country: "Georgia", name: "Kutaisi International" },
  { iata: "EVN", city: "Yerevan", country: "Armenia", name: "Zvartnots" },
  { iata: "GYD", city: "Baku", country: "Azerbaijan", name: "Heydar Aliyev" },
  { iata: "IST", city: "Istanbul", country: "Turkey", name: "Istanbul Airport" },
  { iata: "SAW", city: "Istanbul", country: "Turkey", name: "Sabiha Gökçen" },
  { iata: "AYT", city: "Antalya", country: "Turkey", name: "Antalya" },
  { iata: "ESB", city: "Ankara", country: "Turkey", name: "Esenboğa" },
  { iata: "ADB", city: "Izmir", country: "Turkey", name: "Adnan Menderes" },
  { iata: "BER", city: "Berlin", country: "Germany", name: "Berlin Brandenburg" },
  { iata: "MUC", city: "Munich", country: "Germany", name: "Munich" },
  { iata: "FRA", city: "Frankfurt", country: "Germany", name: "Frankfurt" },
  { iata: "HAM", city: "Hamburg", country: "Germany", name: "Hamburg" },
  { iata: "DUS", city: "Düsseldorf", country: "Germany", name: "Düsseldorf" },
  { iata: "CDG", city: "Paris", country: "France", name: "Charles de Gaulle" },
  { iata: "ORY", city: "Paris", country: "France", name: "Orly" },
  { iata: "LHR", city: "London", country: "United Kingdom", name: "Heathrow" },
  { iata: "LGW", city: "London", country: "United Kingdom", name: "Gatwick" },
  { iata: "STN", city: "London", country: "United Kingdom", name: "Stansted" },
  { iata: "AMS", city: "Amsterdam", country: "Netherlands", name: "Schiphol" },
  { iata: "MAD", city: "Madrid", country: "Spain", name: "Barajas" },
  { iata: "BCN", city: "Barcelona", country: "Spain", name: "El Prat" },
  { iata: "FCO", city: "Rome", country: "Italy", name: "Fiumicino" },
  { iata: "MXP", city: "Milan", country: "Italy", name: "Malpensa" },
  { iata: "VIE", city: "Vienna", country: "Austria", name: "Vienna" },
  { iata: "ZRH", city: "Zurich", country: "Switzerland", name: "Zurich" },
  { iata: "GVA", city: "Geneva", country: "Switzerland", name: "Geneva" },
  { iata: "PRG", city: "Prague", country: "Czechia", name: "Václav Havel" },
  { iata: "WAW", city: "Warsaw", country: "Poland", name: "Chopin" },
  { iata: "BUD", city: "Budapest", country: "Hungary", name: "Liszt Ferenc" },
  { iata: "ATH", city: "Athens", country: "Greece", name: "Eleftherios Venizelos" },
  { iata: "SKG", city: "Thessaloniki", country: "Greece", name: "Makedonia" },
  { iata: "OTP", city: "Bucharest", country: "Romania", name: "Otopeni" },
  { iata: "SOF", city: "Sofia", country: "Bulgaria", name: "Sofia" },
  { iata: "RIX", city: "Riga", country: "Latvia", name: "Riga" },
  { iata: "TLL", city: "Tallinn", country: "Estonia", name: "Tallinn" },
  { iata: "VNO", city: "Vilnius", country: "Lithuania", name: "Vilnius" },
  { iata: "HEL", city: "Helsinki", country: "Finland", name: "Helsinki-Vantaa" },
  { iata: "ARN", city: "Stockholm", country: "Sweden", name: "Arlanda" },
  { iata: "CPH", city: "Copenhagen", country: "Denmark", name: "Copenhagen" },
  { iata: "OSL", city: "Oslo", country: "Norway", name: "Gardermoen" },
  { iata: "DUB", city: "Dublin", country: "Ireland", name: "Dublin" },
  { iata: "LIS", city: "Lisbon", country: "Portugal", name: "Humberto Delgado" },
  { iata: "BRU", city: "Brussels", country: "Belgium", name: "Brussels" },
  { iata: "DXB", city: "Dubai", country: "United Arab Emirates", name: "Dubai International" },
  { iata: "AUH", city: "Abu Dhabi", country: "United Arab Emirates", name: "Abu Dhabi" },
  { iata: "DOH", city: "Doha", country: "Qatar", name: "Hamad" },
  { iata: "TLV", city: "Tel Aviv", country: "Israel", name: "Ben Gurion" },
  { iata: "CAI", city: "Cairo", country: "Egypt", name: "Cairo" },
  { iata: "RUH", city: "Riyadh", country: "Saudi Arabia", name: "King Khalid" },
  { iata: "JED", city: "Jeddah", country: "Saudi Arabia", name: "King Abdulaziz" },
  { iata: "DEL", city: "New Delhi", country: "India", name: "Indira Gandhi" },
  { iata: "BOM", city: "Mumbai", country: "India", name: "Chhatrapati Shivaji" },
  { iata: "BKK", city: "Bangkok", country: "Thailand", name: "Suvarnabhumi" },
  { iata: "SIN", city: "Singapore", country: "Singapore", name: "Changi" },
  { iata: "HKG", city: "Hong Kong", country: "Hong Kong", name: "Hong Kong" },
  { iata: "NRT", city: "Tokyo", country: "Japan", name: "Narita" },
  { iata: "HND", city: "Tokyo", country: "Japan", name: "Haneda" },
  { iata: "ICN", city: "Seoul", country: "South Korea", name: "Incheon" },
  { iata: "PEK", city: "Beijing", country: "China", name: "Capital" },
  { iata: "PVG", city: "Shanghai", country: "China", name: "Pudong" },
  { iata: "SYD", city: "Sydney", country: "Australia", name: "Kingsford Smith" },
  { iata: "MEL", city: "Melbourne", country: "Australia", name: "Tullamarine" },
  { iata: "JFK", city: "New York", country: "United States", name: "John F. Kennedy" },
  { iata: "EWR", city: "New York", country: "United States", name: "Newark" },
  { iata: "LGA", city: "New York", country: "United States", name: "LaGuardia" },
  { iata: "LAX", city: "Los Angeles", country: "United States", name: "Los Angeles" },
  { iata: "SFO", city: "San Francisco", country: "United States", name: "San Francisco" },
  { iata: "ORD", city: "Chicago", country: "United States", name: "O'Hare" },
  { iata: "MIA", city: "Miami", country: "United States", name: "Miami" },
  { iata: "ATL", city: "Atlanta", country: "United States", name: "Hartsfield-Jackson" },
  { iata: "YVR", city: "Vancouver", country: "Canada", name: "Vancouver" },
  { iata: "YYZ", city: "Toronto", country: "Canada", name: "Pearson" },
  { iata: "SVO", city: "Moscow", country: "Russia", name: "Sheremetyevo" },
  { iata: "DME", city: "Moscow", country: "Russia", name: "Domodedovo" },
  { iata: "LED", city: "Saint Petersburg", country: "Russia", name: "Pulkovo" },
  { iata: "ALA", city: "Almaty", country: "Kazakhstan", name: "Almaty" },
  { iata: "NQZ", city: "Astana", country: "Kazakhstan", name: "Nursultan Nazarbayev" },
  { iata: "TAS", city: "Tashkent", country: "Uzbekistan", name: "Islam Karimov" },
  { iata: "MSQ", city: "Minsk", country: "Belarus", name: "Minsk" },
  { iata: "KBP", city: "Kyiv", country: "Ukraine", name: "Boryspil" },
  { iata: "ODS", city: "Odesa", country: "Ukraine", name: "Odesa" },
];

/** Georgia departure airports for employee trip search (from?). */
export const GEORGIA_ORIGIN_AIRPORTS: Airport[] = AIRPORTS.filter((a) =>
  ["TBS", "BUS", "KUT"].includes(a.iata),
);

export function formatAirportLabel(airport: Airport): string {
  return `${airport.city} (${airport.iata}) · ${airport.country}`;
}

export function findAirportByIata(iata: string | null | undefined): Airport | null {
  if (!iata) return null;
  const code = iata.trim().toUpperCase();
  return AIRPORTS.find((a) => a.iata === code) ?? null;
}

export function resolveAirportQuery(query: string): Airport | null {
  const q = query.trim();
  if (!q) return null;
  const upper = q.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) {
    return findAirportByIata(upper);
  }
  const key = q.toLowerCase();
  const exactCity = AIRPORTS.find((a) => a.city.toLowerCase() === key);
  if (exactCity) return exactCity;
  const starts = AIRPORTS.find(
    (a) =>
      a.city.toLowerCase().startsWith(key) ||
      a.name.toLowerCase().startsWith(key) ||
      a.country.toLowerCase().startsWith(key),
  );
  return starts ?? null;
}

export function searchAirports(query: string, limit = 12): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return AIRPORTS.slice(0, limit);
  const scored = AIRPORTS.map((airport) => {
    const hay = `${airport.city} ${airport.iata} ${airport.country} ${airport.name}`.toLowerCase();
    let score = 0;
    if (airport.iata.toLowerCase() === q) score += 100;
    if (airport.city.toLowerCase() === q) score += 80;
    if (airport.city.toLowerCase().startsWith(q)) score += 50;
    if (airport.iata.toLowerCase().startsWith(q)) score += 40;
    if (hay.includes(q)) score += 10;
    return { airport, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.airport.city.localeCompare(b.airport.city));
  return scored.slice(0, limit).map((row) => row.airport);
}

/** Best effort: map a trip destination city string to an airport. */
export function airportFromCityName(city: string | null | undefined): Airport | null {
  if (!city?.trim()) return null;
  return resolveAirportQuery(city);
}
