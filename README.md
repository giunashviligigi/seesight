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
| Public cloud deploy (Railway + custom domain) | Done |

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
- `CORS_ORIGIN` / `WEB_ORIGIN` — frontend origin(s), comma-separated if needed (no trailing slash)
- Empty `CORS_ORIGIN` is ignored; `WEB_ORIGIN` is always merged into the allow-list

**Client**

- `NEXT_PUBLIC_API_URL` — API base URL (baked in at **build** time)

Never commit real `.env` files.

---

## Production deploy (Railway)

SeeSight runs on **Railway** as three services from this monorepo:

| Service | Root directory | Role |
|---------|----------------|------|
| **Postgres** | — | Managed PostgreSQL |
| **api** | `server` | NestJS (`railway.toml`, Railpack) |
| **web** | `client` | Next.js |

Deploy branch: **`main`** (keep `development` for day-to-day work, then merge to `main`).

### API (server)

- **Build:** `npm ci && npx prisma generate && npm run build`
- **Pre-deploy:** `npx prisma migrate deploy` (applies migrations; does **not** seed users)
- **Start:** `node dist/src/main.js`
- **Health:** `GET /health`
- **Swagger:** `/docs`

Required variables (api):

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Railway Postgres connection (private URL / variable reference) |
| `JWT_SECRET` | Strong secret in production |
| `CORS_ORIGIN` | Exact web origin, e.g. `https://test.seesight.net` |
| `WEB_ORIGIN` | Same as web origin (used for CORS + app links) |
| `SERPAPI_API_KEY` | Flights / hotels |
| `GEMINI_API_KEY` | AI parse & recommendations |
| `AI_PROVIDER` | `gemini` |
| `NODE_ENV` | `production` |

### Web (client)

Required variables (web):

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | Public API URL, e.g. `https://api-test.seesight.net` |

Change this → **redeploy web** (value is compiled into the client).

### Custom domain (example)

| Hostname | Service |
|----------|---------|
| `test.seesight.net` | web |
| `api-test.seesight.net` | api |

1. Add each hostname under Railway → service → **Custom Domain** (CNAME **and** TXT verification).
2. Publish those records at your DNS host (e.g. **Cloudflare**). If the registrar (e.g. Cloud9) only offers nameservers, point NS to Cloudflare and manage records there.
3. Prefer Cloudflare **DNS only** (grey cloud) for Railway CNAMEs; wait for NS propagation if the site does not resolve yet.
4. Set `CORS_ORIGIN` / `WEB_ORIGIN` / `NEXT_PUBLIC_API_URL` to the HTTPS custom hosts (no trailing slash), then redeploy **api** and **web**.

Redeploying does **not** wipe Postgres data; only new Prisma migrations change the schema.

### First production admin

Migrate ≠ seed. Create a `SUPER_ADMIN` once (Railway api shell / one-off script), or run seed only if you intentionally want demo users.

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

SeeSight Business is developed as a **Bachelor's Thesis** project, demonstrating a full-stack SaaS architecture with real vendor integrations (SerpAPI, Gemini), multi-tenant RBAC, Dockerized local development, and a live Railway deployment with custom domains.
