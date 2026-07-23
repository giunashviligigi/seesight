# Dashboard (Milestone 6)

Operational overview for company admins and a self-scoped view for employees.

## Decisions

| Topic | Choice |
|-------|--------|
| Endpoint | Single aggregate `GET /dashboard/summary` (no N+1 list-of-lists endpoints). |
| Spend source | Sum of **selected** flight + hotel offer prices for **committed** trips (`APPROVED`, `IN_PROGRESS`, `COMPLETED`) in the period (not `budgetAmount`). |
| Spend statuses | Draft / pending / rejected / cancelled trips are excluded from money metrics. |
| Default period | UTC year-to-date (`from` = Jan 1, `to` = today). Optional `from` / `to` ISO date query params. |
| Date field | Trip **`startDate`** must fall in the period. |
| Upcoming trips | `startDate >= today`, status not `CANCELLED` / `COMPLETED` / `REJECTED`. List capped at 8. |
| Trips this month | Committed trips whose `startDate` is in the current UTC month. |
| Role scope | `COMPANY_ADMIN` / `SUPER_ADMIN` → company-wide. `EMPLOYEE` → trips where they are a traveler (`scope: "self"`). |
| Active employees | Always company-wide `ACTIVE` + `deletedAt: null` count. |
| Tenant | Same as roster: company admins use own `companyId`; super admins must pass `companyId`. |
| Empty companies | Zeros and empty upcoming list (no fake placeholder metrics). |

## Endpoint

| Method | Path | Roles |
|--------|------|-------|
| GET | `/dashboard/summary` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |

### Query

| Param | Required | Notes |
|-------|----------|-------|
| `companyId` | Super admin only | Tenant selector |
| `from` | No | Inclusive ISO date (`YYYY-MM-DD`) |
| `to` | No | Inclusive ISO date (`YYYY-MM-DD`) |

### Response (shape)

- `scope`: `company` \| `self`
- `upcomingTripsCount` + `upcomingTrips[]`
- `totalTravelSpending` `{ amount, currency, periodFrom, periodTo }`
- `activeEmployeesCount`
- `pendingApprovalsCount`
- `statistics` `{ tripsThisMonth, averageTripCost }`

## Frontend

- `/dashboard` — metric widgets, upcoming list, loading / empty / error states
- Nav links from account, company, employees, and profile pages

## Seed expectations (Acme)

With `prisma db seed` and a company-admin login:

- Active employees ≈ 112+
- Pending approvals ≥ 1 (Berlin seed trip stays pending)
- Upcoming trips ≥ 1 (Berlin Sep seed trip)
- Committed YTD spend = **700 EUR** (Paris June completed: 400 flight + 300 hotel)
