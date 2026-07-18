# Reports (Milestone 11)

Company travel analytics for thesis-ready spend visibility.

## Decisions

| Topic | Choice |
|-------|--------|
| Spend source | Sum of **selected** flight + hotel offer snapshots (same as dashboard) |
| Trip filter | `deletedAt: null`, status not `CANCELLED`, `startDate` in range |
| Department attribution | Primary traveler’s department (fallback: first traveler; else `unassigned`) |
| Destinations | Group by `destinationCountry` / `destinationCity` |
| Average cost | `totalSpend / tripsWithSpend` (trips with selected offer spend only) |
| Max range | **24 months** inclusive |
| Cache | `ReportCache` TTL 15 minutes keyed by period |
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

- Berlin (Sep 2026) — Engineering primary — selected spend **1100 EUR**
- Paris (Oct 2026) — Sales primary — selected spend **700 EUR**
