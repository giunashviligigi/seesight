# Approvals (Milestone 10)

Manager review before travel proceeds. Builds on the M7 trip status machine.

## Policy

| Topic | Choice |
|-------|--------|
| Submit | `DRAFT → PENDING_APPROVAL` creates/resets `Approval` + `SUBMIT` action |
| Decide | Company admins (and super admins) approve/reject with optional comment |
| Self-approve | Allowed for company admins / super admins (they own the approval queue) |
| Edit / attach offers | Only `DRAFT` and `REJECTED` (locked while pending or after approval) |
| Start travel | Still requires `APPROVED → IN_PROGRESS` (cannot skip approval) |
| Rejected trips | Editable + `reopen` to `DRAFT`, then resubmit |
| Notifications | In-app only (no SMTP yet — same as forgot-password) |

## Status reminders

```
DRAFT → PENDING_APPROVAL → APPROVED | REJECTED | CANCELLED
REJECTED → DRAFT (reopen) → …
```

## Endpoints

### Approvals

| Method | Path | Roles |
|--------|------|-------|
| GET | `/approvals/pending` | SUPER_ADMIN, COMPANY_ADMIN |
| GET | `/approvals/:tripId/history` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE (scoped) |
| POST | `/approvals/:tripId/approve` | SUPER_ADMIN, COMPANY_ADMIN |
| POST | `/approvals/:tripId/reject` | SUPER_ADMIN, COMPANY_ADMIN |

Trip aliases remain: `POST /trips/:id/approve|reject|submit`.

### Notifications

| Method | Path | Roles |
|--------|------|-------|
| GET | `/notifications` | authenticated roles |
| POST | `/notifications/read-all` | authenticated roles |
| DELETE | `/notifications/clear-all` | authenticated roles — deletes all notifications for the current user |
| PATCH | `/notifications/:id/read` | owner |

### Notification types

- `TRIP_SUBMITTED` → company admins (except submitter)
- `TRIP_APPROVED` / `TRIP_REJECTED` → trip creator + traveler users

## Frontend

- `/approvals` — pending queue with comment + approve/reject
- `/notifications` — inbox
- Trip detail — decision comment, approval history, link to queue

## Database

Migration `20260718193000_notifications` adds `Notification` + `NotificationType`.
