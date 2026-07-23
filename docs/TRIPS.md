# Trips (Milestone 7)

Full trip lifecycle for individuals and groups. Approval **enforcement UI** is expanded in Milestone 10; M7 exposes status transitions and approval hooks.

## Status machine

```
DRAFT
  ├─ submit ───────────────▶ PENDING_APPROVAL
  │                            ├─ approve ──▶ APPROVED
  │                            │                 ├─ (auto when startDate ≤ today) ──▶ IN_PROGRESS
  │                            │                 │              └─ complete ──▶ COMPLETED
  │                            │                 └─ cancel ──▶ CANCELLED
  │                            ├─ reject ───▶ REJECTED
  │                            │                 ├─ reopen ──▶ DRAFT
  │                            │                 └─ cancel ──▶ CANCELLED
  │                            └─ cancel ───▶ CANCELLED
  └─ cancel ───────────────▶ CANCELLED
```

| From | Allowed next |
|------|----------------|
| `DRAFT` | `PENDING_APPROVAL`, `CANCELLED` |
| `PENDING_APPROVAL` | `APPROVED`, `REJECTED`, `CANCELLED` |
| `APPROVED` | `IN_PROGRESS` (automatic when `startDate` is due; hourly cron + on trip list/detail), `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` |
| `REJECTED` | `DRAFT`, `CANCELLED` |
| `COMPLETED` | — (terminal) |
| `CANCELLED` | — (terminal; remains in history) |

Invalid transitions return **400** with message `Invalid status transition from X to Y`.

## Decisions

| Topic | Choice |
|-------|--------|
| Create | Always starts as `DRAFT`. Requires ≥1 traveler (`TripTraveler`) and a non-empty **purpose**. Optional `bookingMode` (`FLIGHTS` \| `HOTELS` \| `BOTH`, default `BOTH`). |
| Group travel | Multiple employees; duplicate traveler ids rejected; primary auto-assigned if omitted. |
| Edit lock | Editable in `DRAFT` and `REJECTED` only (locked while pending — M10). |
| Cancel | Soft status only — row kept (`deletedAt` unused for cancel). Visible in list filters. |
| Delete | Soft-delete via `deletedAt`. Allowed in **any** status including `IN_PROGRESS` and `COMPLETED`. Closes open approvals. Hidden from lists. |
| Submit | Requires purpose + offers based on `bookingMode`: `BOTH` → flight + hotel; `FLIGHTS` → flight only; `HOTELS` → hotel only. Creates/updates `Approval` (`PENDING`) + `ApprovalAction.SUBMIT`. |
| Employee scope | List/detail limited to trips they created or travel on; must include self when creating. |
| Tenant | Company admin own company; super admin passes `companyId`. |
| Department filter | Trips that include a traveler in the given department. |
| Travel dates | `startDate` must be **today or later** (UTC). `endDate` must be on or after `startDate`. Enforced on create and when updating `startDate`; search UI blocks past depart/return. |
| In progress | Auto `APPROVED → IN_PROGRESS` when `startDate` ≤ today (UTC). Hourly background job + trip list/detail. No Start button in UI. |

## Endpoints

| Method | Path | Roles |
|--------|------|-------|
| POST | `/trips` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |
| GET | `/trips` | same — `status`, `from`, `to`, `departmentId`, pagination |
| GET | `/trips/:id` | same (scoped) |
| PATCH | `/trips/:id` | same (edit lock applies) |
| POST | `/trips/:id/submit` | same |
| POST | `/trips/:id/cancel` | same |
| DELETE | `/trips/:id` | same — soft-delete (see Decisions) |
| POST | `/trips/:id/approve` | SUPER_ADMIN, COMPANY_ADMIN |
| POST | `/trips/:id/reject` | SUPER_ADMIN, COMPANY_ADMIN |
| POST | `/trips/:id/start` | SUPER_ADMIN, COMPANY_ADMIN — **deprecated** (auto-promote preferred) |
| POST | `/trips/:id/complete` | SUPER_ADMIN, COMPANY_ADMIN |
| POST | `/trips/:id/reopen` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |
| GET | `/trips/:id/invoice` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE — **PDF** invoice after `APPROVED` / `IN_PROGRESS` / `COMPLETED`. Issuer: SeeSight (IBAN `GE24TB7431145061100139`). Bill-to: company `legalName` or `name`. |

## Frontend

- `/trips` — history list + filters
- `/trips/new` — create draft
- `/trips/[id]` — detail, edit, lifecycle actions, **export invoice** (approved+)

## Seed

Acme seed includes Berlin trip in `PENDING_APPROVAL` with two travelers (usable for list/detail demos).
