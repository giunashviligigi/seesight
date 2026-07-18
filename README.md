# SeeSight Business

> AI-powered Business Travel Management Platform

SeeSight Business is a SaaS platform that helps companies plan, optimize, and manage business travel from one centralized dashboard.

Instead of booking flights, hotels, and transportation manually across multiple websites, organizations can create business trips, manage employees, approve travel requests, and receive AI-powered itinerary recommendations while optimizing travel costs.

This project is being developed as a **Bachelor's Thesis** and follows real-world software engineering practices.

---

## Design (Figma)

**Frontend source of truth:** [Figma — Seesight](https://www.figma.com/design/dNZeI8z2Q8Er1CgvjfFrgJ/Seesight)

**Prototype:** [Landing](https://www.figma.com/proto/dNZeI8z2Q8Er1CgvjfFrgJ/Seesight?node-id=49-1498&page-id=0%3A1&scaling=min-zoom&content-scaling=fixed)

| Doc | Purpose |
|-----|---------|
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design system, tokens, components, build rules extracted from Figma |

**Rules for frontend work**

1. Implement public UI against Figma **Landing** frames (`Landing Default`, `Landing after fill`).
2. Follow brand tokens and patterns in `docs/DESIGN.md`.
3. Screens not yet designed in Figma must extend the same dark brand language — do not invent a second theme.

---

## Vision

Business travel today is fragmented.

Companies use Booking.com, Skyscanner, Expedia, emails, Excel spreadsheets, and traditional travel agencies. That leads to:

- Higher costs
- Duplicated work
- No spending visibility
- Difficult approval workflows

**SeeSight Business** centralizes the entire travel management process.

---

## Target Customers

### Primary

- Small & Medium Businesses (SMBs)
- Technology Companies
- Event Agencies
- Sports Organizations

### Personas

| Persona | Goals |
|---------|--------|
| HR Manager | Control travel policy, approvals, and company spend |
| Event Manager | Coordinate group travel for conferences and events |
| Sports Agent | Manage athlete / team travel at scale |

---

## Core Features

### Company Management

- Company registration and profile
- Multi-user organizations
- Roles & permissions

### Employee Management

- Add / edit / remove employees
- Departments and employee profiles

### Trip Management

- Create, edit, and cancel business trips
- Group travel support
- Trip history

### Travel Search

Powered by **Amadeus Flight API** and **Amadeus Hotel API**.

| Now | Future |
|-----|--------|
| Flights | Car rentals |
| Hotels | Activities |

### AI Assistant

- Recommend cheapest / best-value itinerary
- Compare alternatives
- Optimize travel budget
- Explain recommendations in plain language

### Approval Workflow

```
Employee submits trip
        ↓
Manager reviews trip
        ↓
Approves / Rejects
        ↓
Employee notified
```

### Dashboard

- Upcoming trips
- Total travel spending
- Active employees
- Pending approvals
- Travel statistics

### Reports

- Monthly spending
- Trips per department
- Most visited countries
- Average trip cost

---

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui (themed to Figma tokens)

### Backend

- NestJS
- Prisma ORM
- REST API
- JWT Authentication

### Database

- PostgreSQL

### External APIs

| Service | Purpose |
|---------|---------|
| Amadeus | Flight & hotel search |
| Google Maps | Location / maps context |
| OpenAI / Gemini | AI itinerary recommendations |

### Deployment

- Docker
- Docker Compose
- Oracle Cloud VM

---

## Project Structure

```
SeeSight/
├── client/          # Next.js frontend
├── server/          # NestJS backend
├── docs/            # Architecture, design, API, thesis docs
├── database/        # Prisma schema, migrations, seed scripts
├── docker/          # Dockerfiles and Compose overlays
└── README.md
```

---

## User Roles

### Super Admin

Platform administrator. Can manage companies, subscriptions, and users.

### Company Admin

Company-level administrator. Can manage employees, approve trips, and manage company profile.

### Employee

Traveler. Can request trips, view trips, and receive approval notifications.

---

## Functional Requirements

| Area | Requirements |
|------|----------------|
| Authentication | Register, Login, Logout, Forgot Password, JWT |
| Companies | Full CRUD |
| Employees | Full CRUD |
| Trips | Full CRUD |
| Travel Search | Search flights, Search hotels |
| AI | Generate and explain itinerary recommendations |
| Reports | Company spending, Trip analytics |

---

## Non-Functional Requirements

- Responsive and mobile-friendly
- Secure (JWT, validated inputs, least-privilege roles)
- RESTful API design
- Dockerized local and production environments
- Modular, scalable architecture
- Clean, maintainable TypeScript codebase
- UI faithful to Figma (`docs/DESIGN.md`)

---

## Development Methodology

| Practice | Detail |
|----------|--------|
| Method | Agile |
| Sprint length | 1 week |
| Milestone exit criteria | Working backend + working frontend + tested endpoints + updated documentation |

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `develop` | Integration branch |
| `feature/<feature-name>` | Individual features |

**Examples:** `feature/authentication`, `feature/dashboard`, `feature/trips`

### Commit Convention

```
feat:     new feature
fix:      bug fix
docs:     documentation only
style:    formatting / UI that does not change logic
refactor: code change that neither fixes a bug nor adds a feature
test:     adding or updating tests
chore:    tooling, deps, config
```

**Examples:**

```
feat(auth): JWT login
feat(trips): create trip endpoint
fix(api): validation error response
docs(design): sync tokens with Figma landing
```

### Coding Standards

**Backend**

- SOLID principles
- Repository pattern
- DTO validation
- Exception filters / consistent error responses

**Frontend**

- Follow Figma + `docs/DESIGN.md`
- Reusable components
- Custom hooks
- Dedicated API layer
- Strict TypeScript type safety

### Definition of Done

Every completed feature must:

- [x] Compile successfully
- [x] Pass testing
- [x] Have backend implementation
- [x] Have frontend implementation
- [x] Match Figma / design system (for UI work)
- [x] Have API documentation
- [x] Be responsive
- [x] Be committed to Git

---

## Roadmap — Detailed Milestones

> Lead developer view: each milestone is a shippable increment. Do not start the next milestone until the current one meets Definition of Done.

---

### Milestone 1 — Project Setup

**Goal:** Establish a clean, runnable monorepo foundation so every later feature builds on the same architecture.

**Scope**

1. Initialize Git repository (`main` + `develop`) and enforce branch naming.
2. Create folder layout: `client/`, `server/`, `docs/`, `database/`, `docker/`.
3. Scaffold **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** in `client/`.
4. Apply Figma tokens from `docs/DESIGN.md` (CSS variables + Tailwind theme) on day one.
5. Scaffold **NestJS + TypeScript** in `server/` with modular folder structure (`modules/`, `common/`, `config/`).
6. Add **Prisma** with PostgreSQL connection; create empty schema and migration workflow under `database/` (or `server/prisma/` with docs symlink).
7. Dockerize local stack:
   - PostgreSQL service
   - API service
   - Web service (optional for M1; Compose wiring required)
8. Environment strategy: `.env.example` for client and server (no secrets committed).
9. Baseline CI-ready scripts: `lint`, `build`, `start:dev` on both sides.
10. Write `docs/ARCHITECTURE.md` (high-level diagram: client → NestJS → Prisma → PostgreSQL + external APIs).
11. Write `docs/SETUP.md` (prerequisites, install, migrate, run).

**Deliverables**

- Running `client` on localhost (default Next port) with dark brand shell matching tokens
- Running `server` health check endpoint (`GET /health`)
- `docker compose up` brings up Postgres (+ API if ready)
- Documented env vars and setup steps

**Acceptance criteria**

- Fresh clone → follow `docs/SETUP.md` → app builds and health check returns `200`
- TypeScript strict mode enabled on both apps
- No placeholder business logic; only scaffolding, theme tokens, and health/config

**Deps / risks:** Node LTS availability, Docker Desktop on local machine, Oracle Cloud delayed until Milestone 12

---

### Milestone 2 — Authentication

**Goal:** Secure identity and session foundation for all role-based features.

**Scope**

1. Data model: `User` (email, password hash, role, companyId nullable for super admin, status, timestamps).
2. Auth endpoints:
   - `POST /auth/register` (company admin self-signup or invite flow — document chosen approach)
   - `POST /auth/login`
   - `POST /auth/logout` (token invalidate / client clear strategy documented)
   - `POST /auth/forgot-password` + `POST /auth/reset-password`
   - `GET /auth/me`
3. Password hashing (bcrypt/argon2), JWT access tokens (+ refresh strategy if included — document decision).
4. NestJS Auth module: guards, strategies, decorators (`@Roles()`, `@CurrentUser()`).
5. Global validation pipes; consistent error DTOs (`401`, `403`, `400`).
6. Frontend: login, register, forgot/reset password pages using Figma brand language (until dedicated auth frames exist).
7. Persist session securely (httpOnly cookie preferred over localStorage if feasible; document choice).
8. API docs (OpenAPI/Swagger) for all auth routes.
9. Unit/e2e tests for happy path + invalid credentials + expired token.

**Deliverables**

- Working auth API + UI flows
- Role enum: `SUPER_ADMIN | COMPANY_ADMIN | EMPLOYEE`
- Protected sample page proving guard works

**Acceptance criteria**

- Cannot access protected routes without valid JWT
- Role claims correctly attached to token/payload
- Password never stored in plaintext
- Forgot-password flow does not leak whether an email exists (security wording)

**Deps / risks:** Email provider for reset links (use Mailhog/Ethereal in dev if needed)

---

### Milestone 3 — Database Design

**Goal:** Finalize the domain model and migrations that all business modules share.

**Scope**

1. Design and document ERD in `docs/DATABASE.md`.
2. Core entities (minimum):
   - `Company`, `User`, `Department`, `Employee` (or User-as-employee with profile)
   - `Trip`, `TripTraveler`, `TripStatus`, `Approval`, `ApprovalAction`
   - `FlightOfferSnapshot`, `HotelOfferSnapshot` (store search/selection metadata, not live booking unless agreed)
   - `AiRecommendation`, `ReportCache` (optional)
3. Enums: trip status, approval status, user role, travel class, etc.
4. Indexes for frequent queries: companyId, employeeId, trip dates, approval pending.
5. Relations and cascading rules documented (soft delete vs hard delete decision).
6. Seed script: demo company, admins, employees, sample trips.
7. Migration discipline: never edit old migrations; only additive migrations after merge.

**Deliverables**

- Complete Prisma schema + initial migrations
- Seed data for local demos
- ERD diagram and entity dictionary in docs

**Acceptance criteria**

- Schema migrates cleanly on empty DB and seeded DB
- ERD matches implemented models 1:1
- No circular dependency hacks without documented reason

**Deps / risks:** Milestone 2 User model must be reconciled (migrate User → Company link cleanly)

---

### Milestone 4 — Company Management

**Goal:** Multi-tenant company lifecycle for Super Admin and Company Admin.

**Scope**

1. Backend CRUD: create, read, update, soft-deactivate companies.
2. Company profile fields: name, legal name, country, billing email, timezone, policy defaults (budget limits optional stub).
3. Super Admin: list/search companies, enable/disable, assign/reassign company admins.
4. Company Admin: view/update own company profile only.
5. Enforce tenant isolation: every query scoped by `companyId` except Super Admin.
6. Frontend: company settings page; Super Admin companies table (dark brand system).
7. Validation: unique company slug/email rules; DTO validation.
8. Tests: isolation (Admin A cannot read Company B), RBAC on all routes.

**Deliverables**

- Company module API + UI
- Tenant middleware / Prisma scope helpers

**Acceptance criteria**

- Cross-tenant reads/writes fail with `403`
- Company Admin cannot elevate own role to Super Admin
- API docs updated

**Deps / risks:** Depends on Auth (M2) and schema (M3)

---

### Milestone 5 — Employee Management

**Goal:** Company roster that trips and approvals rely on.

**Scope**

1. Employee CRUD within a company (invite by email or create with temporary password — document choice).
2. Departments CRUD (or nested under company).
3. Employee profile: job title, department, phone, passport/nationality placeholders if needed for travel, preferred airports (optional).
4. Activate / deactivate employees without deleting trip history.
5. Company Admin permissions only; Employees can view own profile.
6. Frontend: employees table (search/filter by department), create/edit forms, department management.
7. Pagination + sorting on employee list endpoints.
8. Tests for CRUD, deactivate, and unauthorized access.

**Deliverables**

- Employees & departments API + UI
- Seeded demo roster

**Acceptance criteria**

- Deactivated employees cannot log in (or cannot create trips — document policy)
- Employee belongs to exactly one company
- Lists paginate correctly under load of 100+ seeded users

**Deps / risks:** Company tenant scoping from M4

---

### Milestone 6 — Dashboard

**Goal:** Single operational overview for Company Admins (and scoped view for Employees).

**Scope**

1. Aggregate endpoints, e.g. `GET /dashboard/summary`:
   - Upcoming trips count / list
   - Total travel spending (YTD or period param)
   - Active employees count
   - Pending approvals count
   - Basic travel statistics (trips this month, avg cost)
2. Efficient queries (groupBy / raw SQL only if needed; index-backed).
3. Frontend dashboard page — same dark brand language as Landing; prefer Figma frames when available.
4. Empty states for new companies with no trips yet.
5. Role-aware widgets: Employee sees own upcoming trips; Admin sees company-wide.
6. Manual/API tests for aggregation correctness against seeded data.

**Deliverables**

- Dashboard API + UI wired to real data
- Loading and empty states

**Acceptance criteria**

- Numbers match database for seeded fixtures
- No N+1 query problems on summary endpoint
- Works on mobile and desktop viewports

**Deps / risks:** Meaningful data requires trips later; use seeds + stubs carefully — prefer real trip fields from schema even if full trip UI lands in M7

---

### Milestone 7 — Trip Management

**Goal:** Full trip lifecycle for individuals and groups.

**Scope**

1. Trip CRUD: create draft, update, cancel, list, get by id.
2. Fields: purpose, destination(s), start/end dates, budget, travelers, notes, status.
3. Group travel: multiple employees on one trip (`TripTraveler`).
4. Status machine: `DRAFT → PENDING_APPROVAL → APPROVED → IN_PROGRESS → COMPLETED` + `CANCELLED` / `REJECTED`.
5. History endpoints and UI (filters by status, date range, department).
6. Frontend: trip list, trip detail, create/edit flows aligned with Figma search/date patterns where relevant.
7. Prevent invalid transitions (e.g. edit locked after approval unless policy allows).
8. Tests for status transitions, group travelers, cancel rules.

**Deliverables**

- Trips module API + UI
- Clear status transition diagram in `docs/TRIPS.md`

**Acceptance criteria**

- Invalid state transitions return `400` with clear message
- Group trips require ≥1 traveler
- Cancelled trips remain visible in history

**Deps / risks:** Employees (M5); approvals full enforcement lands in M10 — here support statuses and hooks

---

### Milestone 8 — Travel Search (Amadeus)

**Goal:** Real flight and hotel search integrated into trip planning — wired to the Figma search widget UX.

**Scope**

1. Amadeus auth + client wrapper in NestJS (`TravelSearchModule`).
2. Endpoints:
   - `GET /travel/flights` (origin, destination, dates, adults, cabin class)
   - `GET /travel/hotels` (city/geo, check-in/out, guests)
3. Normalize Amadeus responses into internal DTOs (never leak raw vendor shape to frontend).
4. Rate limiting, caching strategy for identical searches (short TTL), error mapping for vendor downtime.
5. Attach selected offers to a trip (store snapshot JSON + price + currency + provider refs).
6. Frontend: implement Figma `TripSearchWidget` (empty + filled states) calling these APIs.
7. `.env` keys documented; sandbox credentials for thesis demos.
8. Integration tests with mocked Amadeus client (no flaky live calls in CI).

**Deliverables**

- Flight + hotel search API + UI matching Figma search
- Offer snapshot persistence on trips

**Acceptance criteria**

- Search works against Amadeus sandbox with valid params
- Vendor failures surface as controlled API errors
- Attached offers survive trip reload
- Empty/filled search states match Figma frames

**Deps / risks:** Amadeus sandbox quotas; Google Maps optional for city autocomplete if time allows

---

### Milestone 9 — AI Recommendations

**Goal:** Explainable itinerary recommendations that help optimize cost and convenience.

**Scope**

1. AI module integrating OpenAI and/or Gemini (provider abstraction so one can be swapped).
2. Input: trip constraints + shortlisted flight/hotel offers (+ company policy stubs if present).
3. Output: ranked recommendations with rationale, estimated cost, tradeoffs (cheapest vs shortest).
4. Endpoint: `POST /ai/recommend-itinerary` with validation and max token/cost guards.
5. Persist recommendation history linked to trip for audit/thesis demo.
6. Frontend: “Ask AI” panel on trip detail; render explanation clearly (not raw model dump).
7. Safety: no PII over-sharing beyond needed fields; redact passwords/tokens; log prompts carefully.
8. Tests with mocked LLM responses; golden-file examples for demo prompts.

**Deliverables**

- AI recommendation API + UI
- `docs/AI.md` describing prompt strategy and provider config

**Acceptance criteria**

- Recommendation always returns structured JSON matching DTO
- Graceful degradation if AI provider is down
- Explanations are human-readable and tied to concrete offer IDs

**Deps / risks:** API costs; fallback to rule-based ranking if LLM unavailable

---

### Milestone 10 — Approval Workflow

**Goal:** Enforce manager review before travel proceeds.

**Scope**

1. Submit trip for approval (`PENDING_APPROVAL`).
2. Company Admin (or designated approver) lists pending approvals.
3. Approve / reject with optional comment; timestamps and actor recorded.
4. Notify employee (in-app notification minimum; email if provider already wired from M2).
5. Block attaching bookings / marking trip approved travel without approval (policy documented).
6. Frontend: pending queue, review detail, approve/reject actions, status badges.
7. Audit trail endpoint for a trip’s approval history.
8. Tests for double-approve, unauthorized reject, and notification side effects.

**Deliverables**

- Approval API + UI
- Notification mechanism (minimum viable)

**Acceptance criteria**

- Employees cannot approve their own trips
- Only authorized roles change approval status
- Rejected trips can be edited and resubmitted

**Deps / risks:** Trip status machine from M7; email optional

---

### Milestone 11 — Reports

**Goal:** Make travel spend visible and thesis-defensible with real analytics.

**Scope**

1. Report endpoints (company-scoped):
   - Monthly spending (range filters)
   - Trips per department
   - Most visited countries/cities
   - Average trip cost
2. Export options: JSON + CSV (PDF optional if time).
3. Aggregation correctness tests with known seed datasets.
4. Frontend: reports page with charts + tables + export (brand-consistent, not default chart-lib theme).
5. Performance: pre-aggregations or indexed queries; document limits (e.g. max range 24 months).
6. Super Admin optional global overview (only if time; otherwise company-only).

**Deliverables**

- Reports API + UI
- Sample screenshots/data for thesis documentation

**Acceptance criteria**

- Chart values match API totals
- CSV export opens correctly in Excel/Sheets
- Unauthorized roles cannot export other companies’ data

**Deps / risks:** Needs enough trip/spend data from M7–M8 selections

---

### Milestone 12 — Deployment

**Goal:** Production-ready deployment on Oracle Cloud with Docker.

**Scope**

1. Production Dockerfiles (multi-stage builds) for `client` and `server`.
2. `docker-compose.prod.yml`: web, api, postgres, reverse proxy (Caddy/Nginx/Traefik — pick one).
3. Env secrets management on Oracle Cloud VM (never commit secrets).
4. TLS (Let’s Encrypt) and domain wiring.
5. DB backups strategy (script + cron or documented manual process).
6. Migrations on deploy (`prisma migrate deploy`).
7. Health checks and basic uptime verification.
8. `docs/DEPLOYMENT.md`: VM setup, firewall ports, DNS, deploy/rollback steps.
9. Smoke test checklist post-deploy (auth, create trip, search sandbox if keys present).
10. Tag release `v1.0.0` on `main`.

**Deliverables**

- Live demo URL for thesis defense
- Deployment runbook
- Tagged production release

**Acceptance criteria**

- Public HTTPS access to the app
- Fresh deploy + migrate succeeds from clean VM instructions
- Rollback steps verified once

**Deps / risks:** Oracle Cloud quota, DNS propagation, Amadeus/LLM keys in prod vs sandbox

---

## Milestone Dependency Graph

```
M1 Setup (+ design tokens)
 └── M2 Auth
      └── M3 Database Design
           ├── M4 Company Management
           │    └── M5 Employee Management
           │         ├── M6 Dashboard
           │         └── M7 Trip Management
           │              ├── M8 Travel Search (Amadeus + Figma search UI)
           │              │    └── M9 AI Recommendations
           │              ├── M10 Approval Workflow
           │              └── M11 Reports
           └─────────────── M12 Deployment (after M7+ stable; ideally after M11)
```

---

## Cursor AI Instructions

You are the **lead software engineer** of this project.

### Rules

1. Never generate placeholder code unless explicitly requested.
2. Always follow the project architecture.
3. Build production-quality code.
4. Every endpoint must include validation.
5. Every endpoint must include proper error handling.
6. Keep frontend and backend separated.
7. Use TypeScript everywhere.
8. Do not duplicate code.
9. Use reusable components.
10. Follow clean architecture principles.
11. Every feature must compile before moving to the next milestone.
12. Never skip testing existing functionality after implementing a new feature.
13. Always update documentation when new features are added.
14. Never modify unrelated files.
15. Before writing code, explain the implementation plan.
16. **Frontend must follow Figma + `docs/DESIGN.md`.**

---

## Current Status

| Field | Value |
|-------|--------|
| Project stage | In development |
| Current milestone | Milestone 6 — Dashboard **complete** |
| Next milestone | Milestone 7 — Trip Management |
| Version | v0.1.0 |
| Design | Figma Landing + Pitch Deck locked as UI source of truth |
| Active branch | `development` |
