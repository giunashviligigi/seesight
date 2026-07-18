# Travel Search (Milestone 8)

Replaces Amadeus with **SerpAPI** for flight and hotel search.

## Decisions

| Topic | Choice |
|-------|--------|
| Flights | SerpAPI `engine=google_flights` |
| Hotels | SerpAPI `engine=google_hotels` |
| Auth | Single `SERPAPI_API_KEY` |
| Response shape | Normalized DTOs only — vendor keys never returned at top level |
| Cache | In-memory TTL (~60s) for identical searches |
| Rate limit | ~30 requests / minute / user |
| Attach | One selected flight + one selected hotel per trip (`selected=true`) |
| Editable statuses | Attach allowed in `DRAFT`, `PENDING_APPROVAL`, `REJECTED` |
| Provider enum | `OfferProvider.SERPAPI` (legacy `AMADEUS` retained) |

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

`origin`, `destination`, `departureDate`, optional `returnDate`, `adults`, `travelClass`, `currency`

### Hotel query params

`city`, `checkIn`, `checkOut`, optional `adults`, `currency`

## Frontend

- `TripSearchWidget` on `/trips/[id]` (empty + filled tile states)
- Selected offers shown on trip detail and survive reload via snapshots

## Tests

Unit tests mock `SerpApiClient` — no live SerpAPI calls in CI.
