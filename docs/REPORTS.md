# Reports (Milestone 11)

Company travel analytics for thesis-ready spend visibility.

## Decisions

| Topic | Choice |
|-------|--------|
| Spend source | Sum of **selected** flight + hotel offer snapshots (same as dashboard) |
| Trip filter | `deletedAt: null`, status in `APPROVED` / `IN_PROGRESS` / `COMPLETED`, `startDate` in range |
| Default period | UTC year-to-date (same as dashboard); UI defaults match |
| Department attribution | Primary traveler’s department (fallback: first traveler; else `unassigned`) |
| Destinations | Group by `destinationCountry` / `destinationCity` |
| Average cost | `totalSpend / tripsWithSpend` (committed trips with selected offer spend only) |
| Max range | **24 months** inclusive |
| Cache | `ReportCache` TTL 15 minutes; **invalidated** when trips are created/updated/deleted/status-changed |
| Roles | `SUPER_ADMIN`, `COMPANY_ADMIN` only (employees use dashboard) |
| Export | JSON + CSV (UTF-8 BOM for Excel) |
| Charts | CSS bar charts using `--chart-*` tokens (no third-party chart theme) |

## Endpoints

| Method | Path | Roles |
|--------|------|-------|
| GET | `/reports/summary` | SUPER_ADMIN, COMPANY_ADMIN |
| GET | `/reports/export` | SUPER_ADMIN, COMPANY_ADMIN |

### Query

| Param | Notes |
|-------|-------|
| `companyId` | Required for super admin |
| `from` / `to` | ISO dates; default YTD |
| `format` | `csv` (default on export) or `json` |
| `dataset` | `summary` \| `monthly` \| `departments` \| `destinations` |

## Frontend

- `/reports` — filters, KPI cards, bar charts, monthly table, CSV download

## Seed baseline

Acme seed includes:

- Berlin (Sep 2026) — Engineering primary — **pending approval** (not in committed spend)
- Paris (Jun 2026) — Sales primary — **completed**, selected spend **700 EUR** (counts in YTD)
