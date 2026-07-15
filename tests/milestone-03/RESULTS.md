# Milestone 3 — Database Design — Test Results

**Run date:** 2026-07-15T15:42:00Z  
**Branch:** `development`  
**Overall:** PASSED

## Summary

| Check | Result |
|-------|--------|
| `prisma migrate status` | Database schema is up to date (2 migrations) |
| Migration applied | `20260715154202_domain_model_core_entities` |
| `npm run prisma:seed` | Seeded `acme-travel` demo data |
| Schema integrity unit tests | Passed |
| Auth unit + e2e regression | Passed (8 unit, 5 e2e) |
| `npm run build` (API) | exit 0 |

## Seeded entity counts

From [`entity-counts.json`](./entity-counts.json) after seed (plus any prior e2e users):

| Entity | Count |
|--------|-------|
| Company | 1 |
| User | 4 |
| Department | 2 |
| Employee | 2 |
| Trip | 1 |
| TripTraveler | 2 |
| Approval | 1 |
| ApprovalAction | 1 |
| FlightOfferSnapshot | 1 |
| HotelOfferSnapshot | 1 |
| AiRecommendation | 1 |
| ReportCache | 1 |


## Acceptance criteria

| Criterion | Met |
|-----------|-----|
| Schema migrates cleanly | Yes |
| ERD matches models 1:1 (`docs/DATABASE.md`) | Yes |
| No undocumented circular dependency hacks | Yes |
| Seed for local demos | Yes |

## Captured outputs

- `migrate-status.log`
- `seed.log`
- `entity-counts.json`
- `unit-tests.log`
- `e2e-tests.log`
- `api-build.log`
