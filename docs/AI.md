# AI Recommendations (Milestone 9)

Explainable itinerary recommendations using Gemini, with a rule-based fallback.

## Decisions

| Topic | Choice |
|-------|--------|
| Primary provider | Google Gemini (`gemini-2.0-flash`) |
| Abstraction | `AiProvider` interface; `GeminiProvider` is the default binding |
| OpenAI | Not wired in M9 — swap via `AI_PROVIDER` / provider token later |
| Input | Trip constraints + shortlisted offers (request body) **or** attached trip snapshots |
| Output | Structured JSON only (`RecommendationResultDto`) |
| Persistence | `AiRecommendation` rows linked to `tripId` |
| Failure mode | If Gemini is down / misconfigured / returns unusable output → **rule-based ranking** |
| Safety | No passwords/tokens/emails/passports in prompts; policy JSON keys containing secrets are stripped |
| Rate limit | ~10 requests / minute / user |
| Token guard | `AI_MAX_OUTPUT_TOKENS` (default 1024); max 8 offers per type |

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
| GET | `/ai/trips/:tripId/recommendations` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |

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
