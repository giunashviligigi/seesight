# AI Recommendations (Milestone 9)

Explainable itinerary recommendations using Gemini, with a rule-based fallback.

## Decisions

| Topic | Choice |
|-------|--------|
| Primary provider | Google Gemini (`gemini-2.0-flash`) |
| Abstraction | `AiProvider` interface; `GeminiProvider` is the active binding |
| Other LLMs | Not used in production — abstraction allows a future swap without API changes |
| Input | Trip constraints + shortlisted offers (request body) **or** attached trip snapshots |
| Output | Structured JSON only (`RecommendationResultDto`) |
| Persistence | `AiRecommendation` rows linked to `tripId` |
| Failure mode | If Gemini is down / misconfigured / returns unusable output → **rule-based ranking** |
| Safety | No passwords/tokens/emails/passports in prompts; policy JSON keys containing secrets are stripped |
| Rate limit | ~10 requests / minute / user |
| Token guard | `AI_MAX_OUTPUT_TOKENS` (default 1024); max 8 offers per type |
| NL travel parse | Gemini extracts cities/countries/dates; server resolves to IATA via global airport dataset (`airports.json`, ~8.8k commercial airports). Country names map to that country’s primary hub. Incomplete prompts return one `clarifyingQuestion` (e.g. “Where are you departing from?”) instead of a generic failure — the UI collects a follow-up and re-parses. One calendar date → `one_way`; two dates → `round_trip`. Stay phrases like “five nights” set hotel checkout when a departure exists. No model fine-tuning. |

## Environment

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
AI_MAX_OUTPUT_TOKENS=1024
AI_MAX_OFFERS_PER_TYPE=8
AI_RATE_LIMIT_PER_MINUTE=10
AI_TEMPERATURE=0.2
```

## Endpoints

| Method | Path | Roles |
|--------|------|-------|
| POST | `/ai/recommend-itinerary` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |
| POST | `/ai/parse-travel-intent` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |
| GET | `/ai/trips/:tripId/recommendations` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |

### NL travel parse (`POST /ai/parse-travel-intent`)

- Body: `{ prompt, referenceDate? }` (prompt up to 2000 chars; follow-ups may append prior context)
- Response includes IATA/cities/dates/`tripType`/`adults`/`notes`/`source`
- When origin, destination, or departure date is still missing: `clarifyingQuestion` is a single natural question; otherwise `null`
- Client trip search widget soft-fills known fields, shows the question, and re-parses after the traveler answers

### Request body (`POST`)

- `tripId` (required)
- `flights[]` / `hotels[]` (optional shortlists with stable `id`s)
- When shortlists are omitted, attached flight/hotel snapshots on the trip are used
- At least one flight **or** hotel is required

### Response

- `source`: `gemini` or `rule_based`
- `recommendation.recommendedFlightId` / `recommendedHotelId` — concrete offer ids
- `reasoning`, `tradeoffs`, `alternatives[]`, `estimatedTotal`

## Prompt strategy

1. System instruction forces JSON-only output and forbids inventing offer ids.
2. User prompt includes sanitized trip context, offer shortlist, and an explicit response schema.
3. Model output is parsed and validated against known offer ids before persistence.
4. Demo golden fixture: `tests/milestone-09/golden-prompt.json`

## Frontend

- `AskAiPanel` on `/trips/[id]`
- Shows human-readable reasoning (not raw model dump), alternatives, and recent history

## Tests

- Unit tests mock `AiProvider` — no live Gemini calls in CI
- E2E overrides `AI_PROVIDER` token with a mock
