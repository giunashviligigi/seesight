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
                     Amadeus (M8)   OpenAI/Gemini   Google Maps
                                      (M9)            (opt.)
```

## Repository layout

| Path | Responsibility |
|------|----------------|
| `client/` | Next.js App Router UI (Figma + `docs/DESIGN.md`) |
| `server/` | NestJS REST API, Swagger at `/docs`, Prisma |
| `database/` | Database workflow notes (schema lives in `server/prisma`) |
| `docker/` | Dockerfiles + Compose for local stack |
| `docs/` | Architecture, setup, design |

## Backend modules (Milestone 1)

```
server/src/
├── main.ts
├── app.module.ts
├── config/
├── common/prisma/
└── modules/health/    # GET /health
```

Future business modules (`auth`, `companies`, `employees`, `trips`, …) will land under `modules/` following Controller → Service → DTO conventions from `AGENTS.md`.

## Local ports

| Service | Port |
|---------|------|
| Web (`client`) | `3000` |
| API (`server`) | `3001` |
| PostgreSQL | `5432` |
| Swagger UI | `http://localhost:3001/docs` |

## Design

Frontend visual language is defined in Figma and documented in [`DESIGN.md`](./DESIGN.md).
