# SeeSight Business

AI-powered **business travel management** for companies: plan trips, search flights and hotels, approve requests, and get explainable AI recommendations from one dashboard.

Built as a Bachelor's Thesis with a production-style monorepo (Next.js + NestJS + PostgreSQL).

---

## What’s included

| Area | Status |
|------|--------|
| Auth (register, login, JWT, password reset, force change password) | Done |
| Companies & tenant isolation | Done |
| Employees & departments | Done |
| Dashboard summaries | Done |
| Trips lifecycle (draft → submit → approve → complete) | Done |
| Flight & hotel search (SerpAPI) | Done |
| Natural-language trip parse + clarifying questions (Gemini + heuristics) | Done |
| AI itinerary recommendations (Gemini, rule-based fallback) | Done |
| Approvals & in-app notifications | Done |
| Reports + CSV export | Done |
| Trip PDF invoices | Done |
| Docker Compose local stack | Done |
| Public cloud deploy (e.g. Railway) | In progress |

---

## Design

- **Figma:** [Seesight](https://www.figma.com/design/dNZeI8z2Q8Er1CgvjfFrgJ/Seesight)
- **UI rules:** [`docs/DESIGN.md`](docs/DESIGN.md)

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, Prisma, REST, JWT, Swagger (`/docs`) |
| Database | PostgreSQL |
| Search | SerpAPI (Google Flights / Google Hotels) |
| AI | Google Gemini (`gemini-2.0-flash`) |
| Runtime | Docker + Docker Compose |

---

## Repository layout

```
seesight/
├── client/     # Next.js app (port 3000)
├── server/     # NestJS API + Prisma (port 3001)
├── docker/     # Dockerfiles + docker-compose.yml
├── docs/       # Setup, architecture, feature docs
├── tests/      # Milestone verification notes
└── README.md
```

---

## Roles

| Role | Access |
|------|--------|
| **SUPER_ADMIN** | Manage companies |
| **COMPANY_ADMIN** | Employees, approvals, company settings, reports |
| **EMPLOYEE** | Own trips, search, notifications |

---

## Quick start (Docker)

```bash
git clone https://github.com/giunashviligigi/seesight.git
cd seesight
git checkout development

cp server/.env.example server/.env
# Set at least: DATABASE_URL, JWT secrets, SERPAPI_API_KEY, GEMINI_API_KEY

docker compose -f docker/docker-compose.yml up --build
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/docs |

Full local (non-Docker API/web) steps: [`docs/SETUP.md`](docs/SETUP.md).  
Seed accounts and ERD: [`docs/DATABASE.md`](docs/DATABASE.md).

---

## Important env vars

**Server (`server/.env`)**

- `DATABASE_URL` — Postgres connection string  
- `JWT_*` / auth secrets — see `.env.example`  
- `SERPAPI_API_KEY` — flights & hotels  
- `GEMINI_API_KEY` + `AI_PROVIDER=gemini` — AI parse & recommendations  
- `CORS_ORIGIN` — frontend origin (e.g. `http://localhost:3000`)

**Client**

- `NEXT_PUBLIC_API_URL` — API base URL (e.g. `http://localhost:3001`)

Never commit real `.env` files.

---

## Documentation

| Doc | Topic |
|-----|--------|
| [`docs/SETUP.md`](docs/SETUP.md) | Install & run |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System overview |
| [`docs/AUTH.md`](docs/AUTH.md) | Authentication |
| [`docs/COMPANIES.md`](docs/COMPANIES.md) | Companies |
| [`docs/EMPLOYEES.md`](docs/EMPLOYEES.md) | Employees |
| [`docs/TRIPS.md`](docs/TRIPS.md) | Trips & invoices |
| [`docs/TRAVEL_SEARCH.md`](docs/TRAVEL_SEARCH.md) | Flights / hotels |
| [`docs/AI.md`](docs/AI.md) | Gemini recommendations & NL parse |
| [`docs/APPROVALS.md`](docs/APPROVALS.md) | Approvals & notifications |
| [`docs/REPORTS.md`](docs/REPORTS.md) | Analytics |
| [`docs/DASHBOARD.md`](docs/DASHBOARD.md) | Dashboard |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema & seeds |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design system |

---

## Branching

| Branch | Purpose |
|--------|---------|
| `main` | Stable / production-oriented |
| `development` | Active integration (default for day-to-day work) |

---

## Thesis note

SeeSight Business is developed as a **Bachelor's Thesis** project, demonstrating a full-stack SaaS architecture with real vendor integrations (SerpAPI, Gemini), multi-tenant RBAC, and Dockerized deployment.
