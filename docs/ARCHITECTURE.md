# Architecture

SeeSight Business is a monorepo with a separated Next.js client and NestJS API, backed by PostgreSQL via Prisma.

```
┌─────────────┐     REST/JSON      ┌─────────────┐     Prisma      ┌────────────┐
│  client/    │ ───────────────▶  │  server/    │ ─────────────▶ │ PostgreSQL │
│  Next.js    │ ◀───────────────  │  NestJS     │                │            │
│  React/TS   │                   │  JWT (M2+)  │                └────────────┘
└─────────────┘                   └──────┬──────┘
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼              ▼
                     SerpAPI (M8)   Gemini (M9)   Google Maps (opt.)
```

## Repository layout

| Path | Responsibility |
|------|----------------|
| `client/` | Next.js App Router UI (Figma + `docs/DESIGN.md`) |
| `server/` | NestJS REST API, Swagger at `/docs`, Prisma |
| `database/` | Database workflow notes (schema lives in `server/prisma`) |
| `docker/` | Dockerfiles + Compose for local stack |
| `docs/` | Architecture, setup, design |

## Backend modules

```
server/src/
├── main.ts
├── app.module.ts
├── config/
├── common/prisma/
├── common/tenant/
└── modules/
    ├── health/           # GET /health
    ├── auth/
    ├── account/
    ├── companies/
    ├── departments/
    ├── employees/
    ├── dashboard/        # GET /dashboard/summary (M6)
    ├── trips/            # Trip CRUD + status machine + offer attach (M7/M8)
    ├── travel-search/    # SerpAPI Google Flights / Hotels (M8)
    └── ai/               # Gemini itinerary recommendations (M9)
```

Business modules follow Controller → Service → DTO conventions from `AGENTS.md`.

## External integrations

| Provider | Used for |
|----------|----------|
| **SerpAPI** | Flight and hotel search |
| **Google Gemini** | AI itinerary recommendations (rule-based fallback if unavailable) |
| Google Maps | Optional / future location features |

Amadeus and OpenAI are **not** used.

## Local ports

| Service | Port |
|---------|------|
| Web (`client`) | `3000` |
| API (`server`) | `3001` |
| PostgreSQL | `5432` |
| Swagger UI | `http://localhost:3001/docs` |

## Design

Frontend visual language is defined in Figma and documented in [`DESIGN.md`](./DESIGN.md).
