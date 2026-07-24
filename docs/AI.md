# AI Recommendations (Milestone 9)

Explainable itinerary recommendations using an LLM provider (Groq or Gemini), with a rule-based fallback.

## Decisions

| Topic | Choice |
|-------|--------|
| Primary provider (local default) | **Groq** (`llama-3.3-70b-versatile`) — free tier |
| Alternate provider | Google Gemini (`gemini-2.0-flash`) via `AI_PROVIDER=gemini` |
| Abstraction | `AiProvider` interface; `GroqProvider` / `GeminiProvider` selected by `AI_PROVIDER` |
| Input | Trip constraints + shortlisted offers (request body) **or** attached trip snapshots |
| Output | Structured JSON only (`RecommendationResultDto`) |
| Persistence | `AiRecommendation` rows linked to `tripId` |
| Failure mode | If LLM is down / misconfigured / returns unusable output → **rule-based ranking** |
| Safety | No passwords/tokens/emails/passports in prompts; policy JSON keys containing secrets are stripped |
| Rate limit | ~10 requests / minute / user |
| Token guard | `AI_MAX_OUTPUT_TOKENS` (default 1024); max 8 offers per type |
| NL travel parse | **LLM-first, confirm-only Q&A**: free-text is classified as travel or not. Non-travel prompts set `isTravelRequest=false` and start destination Q&A — never invent cities/dates. Continue answers confirm **one field** at a time. Required before SerpAPI: destination → origin → trip type → departure → return (round-trip) or hotel nights (one-way). IATA via `airports.json`. |

## Environment

```bash
# groq (recommended free tier) or gemini
AI_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta

AI_MAX_OUTPUT_TOKENS=1024
AI_MAX_OFFERS_PER_TYPE=8
AI_RATE_LIMIT_PER_MINUTE=10
AI_TEMPERATURE=0.2
```

Get a free Groq key: https://console.groq.com/keys

## Endpoints

| Method | Path | Roles |
|--------|------|-------|
| POST | `/ai/recommend-itinerary` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |
| POST | `/ai/parse-travel-intent` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |
| GET | `/ai/trips/:tripId/recommendations` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |

### NL travel parse (`POST /ai/parse-travel-intent`)

- Body: `{ prompt, referenceDate?, clarificationAnswer?, clarificationFocus? }`
  - `clarificationFocus`: `origin` | `destination` | `departureDate` | `returnDate` | `tripType` | `hotelNights`
- Response includes `isTravelRequest`, IATA/cities/dates/`tripType`/`hotelNights`/`adults`/`notes`/`source`, plus `clarifyingQuestion` and `clarificationFocus`
- Non-travel prompts: `isTravelRequest=false`, all fields null, question starts destination Q&A (no invented search)
- Continue rounds confirm **one field at a time** (no Gemini invent-on-reparse)
- Client never calls SerpAPI until the confirmed draft is complete
- Status line shows “analyzed by gemini” when applicable

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
