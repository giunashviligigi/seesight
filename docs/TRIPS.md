# Trips (Milestone 7)

Full trip lifecycle for individuals and groups. Approval **enforcement UI** is expanded in Milestone 10; M7 exposes status transitions and approval hooks.

## Status machine

```
DRAFT
  ├─ submit ───────────────▶ PENDING_APPROVAL
  │                            ├─ approve ──▶ APPROVED
  │                            │                 ├─ start ──▶ IN_PROGRESS
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
| `APPROVED` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` |
| `REJECTED` | `DRAFT`, `CANCELLED` |
| `COMPLETED` | — (terminal) |
| `CANCELLED` | — (terminal; remains in history) |

Invalid transitions return **400** with message `Invalid status transition from X to Y`.

## Decisions

| Topic | Choice |
|-------|--------|
| Create | Always starts as `DRAFT`. Requires ≥1 traveler (`TripTraveler`). |
| Group travel | Multiple employees; duplicate traveler ids rejected; primary auto-assigned if omitted. |
| Edit lock | Editable in `DRAFT` and `REJECTED` only (locked while pending — M10). |
| Cancel | Soft status only — row kept (`deletedAt` unused for cancel). Visible in list filters. |
| Submit | Creates/updates `Approval` (`PENDING`) + `ApprovalAction.SUBMIT`. |
| Employee scope | List/detail limited to trips they created or travel on; must include self when creating. |
| Tenant | Company admin own company; super admin passes `companyId`. |
| Department filter | Trips that include a traveler in the given department. |

## Endpoints

| Method | Path | Roles |
|--------|------|-------|
| POST | `/trips` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |
| GET | `/trips` | same — `status`, `from`, `to`, `departmentId`, pagination |
| GET | `/trips/:id` | same (scoped) |
| PATCH | `/trips/:id` | same (edit lock applies) |
| POST | `/trips/:id/submit` | same |
| POST | `/trips/:id/cancel` | same |
| POST | `/trips/:id/approve` | SUPER_ADMIN, COMPANY_ADMIN |
| POST | `/trips/:id/reject` | SUPER_ADMIN, COMPANY_ADMIN |
| POST | `/trips/:id/start` | SUPER_ADMIN, COMPANY_ADMIN |
| POST | `/trips/:id/complete` | SUPER_ADMIN, COMPANY_ADMIN |
| POST | `/trips/:id/reopen` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |

## Frontend

- `/trips` — history list + filters
- `/trips/new` — create draft
- `/trips/[id]` — detail, edit, lifecycle actions

## Seed

Acme seed includes Berlin trip in `PENDING_APPROVAL` with two travelers (usable for list/detail demos).
