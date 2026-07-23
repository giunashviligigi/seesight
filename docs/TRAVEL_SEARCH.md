# Travel Search (Milestone 8)

Flight and hotel search via **SerpAPI** (`google_flights` / `google_hotels`).

## Decisions

| Topic | Choice |
|-------|--------|
| Flights | SerpAPI `engine=google_flights` |
| Hotels | SerpAPI `engine=google_hotels` |
| Hotel price | Stay **total** for check-in → check-out. Prefer vendor `total_rate`; if only nightly rate exists, multiply by nights. UI shows night count (e.g. `4 nights`) + optional per-night average. |
| Auth | Single `SERPAPI_API_KEY` |
| Response shape | Normalized DTOs only — vendor keys never returned at top level |
| Cache | In-memory TTL (~60s) for identical searches |
| Rate limit | ~30 requests / minute / user |
| Attach | One selected flight + one selected hotel per trip (`selected=true`) |
| Editable statuses | Attach / field edits allowed in `DRAFT` and `REJECTED` only (locked while `PENDING_APPROVAL` — M10) |
| Provider enum | `OfferProvider.SERPAPI` (enum also retains unused legacy `AMADEUS`) |
| Date bounds | `departureDate` / `checkIn` must be **today or later** (UTC). `returnDate` ≥ `departureDate`; `checkOut` ≥ `checkIn`. |
| One-way hotel | Traveler sets **hotel nights** (1–30). Checkout = depart + nights. Round-trip hotel stay follows return date. |

## Environment

```bash
SERPAPI_API_KEY=
SERPAPI_BASE_URL=https://serpapi.com/search.json
SERPAPI_CACHE_TTL_MS=60000
SERPAPI_RATE_LIMIT_PER_MINUTE=30
```

## Endpoints

| Method | Path | Roles |
|--------|------|-------|
| GET | `/travel/flights` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |
| GET | `/travel/hotels` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |
| POST | `/trips/:id/offers/flight` | trip mutate roles |
| POST | `/trips/:id/offers/hotel` | trip mutate roles |

### Flight query params

`origin`, `destination`, `departureDate` (≥ today), optional `returnDate` (≥ departure), `adults`, `travelClass`, `currency`

### Hotel query params

`city`, `checkIn` (≥ today), `checkOut` (≥ check-in), optional `adults`, `currency`

## Frontend

- `TripSearchWidget` on `/trips/[id]` (empty + filled tile states)
- One-way: **hotel nights** control (1–30); checkout = depart + nights; trip `endDate` syncs to checkout
- Round-trip: hotel stay follows return date
- Selected offers shown on trip detail and survive reload via snapshots

## Tests

Unit tests mock `SerpApiClient` — no live SerpAPI calls in CI.
