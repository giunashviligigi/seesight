# Companies (Milestone 4)

## Decisions

| Topic | Choice |
|-------|--------|
| Tenant isolation | Non–super-admin queries must match `user.companyId`; mismatch → `403` |
| Create | Super admin can create any company. Company admin with `companyId = null` creates first company and is auto-linked |
| Soft deactivate | Super admin sets `status = INACTIVE` (row kept, still listable) |
| Soft remove | Super admin `DELETE /companies/:id` sets `deletedAt` (+ inactive); hidden from directory. Activate clears `deletedAt` |
| Assign admin | Super admin only; cannot assign/transform a `SUPER_ADMIN` into company admin |
| Slug | Unique; auto-generated from name when omitted |
| Billing email | Unique among non-deleted companies when provided |
| Default trip budget | `policyJson.defaultBudgetLimit` = suggested max **per trip** (not monthly). Currency: `defaultBudgetCurrency` (`USD` \| `EUR` \| `GEL`) |

## Endpoints

| Method | Path | Roles |
|--------|------|-------|
| POST | `/companies` | SUPER_ADMIN, COMPANY_ADMIN |
| GET | `/companies` | SUPER_ADMIN |
| GET | `/companies/me` | COMPANY_ADMIN, EMPLOYEE, SUPER_ADMIN |
| GET | `/companies/:id` | tenant-scoped |
| PATCH | `/companies/:id` | SUPER_ADMIN, COMPANY_ADMIN (own) |
| POST | `/companies/:id/deactivate` | SUPER_ADMIN |
| POST | `/companies/:id/activate` | SUPER_ADMIN |
| DELETE | `/companies/:id` | SUPER_ADMIN (soft remove) |
| POST | `/companies/:id/assign-admin` | SUPER_ADMIN |

## Frontend

- `/company` — company admin settings / first-company create
- `/companies` — super admin directory (activate/deactivate/remove, employees, unassigned signups)
- `/employees?companyId=` — super admin view of a company’s roster

## Unassigned users (super admin)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/users?unassignedOnly=true` | `COMPANY_ADMIN` accounts with `companyId = null` (registered, no company yet) |

## Helpers

`server/src/common/tenant/tenant.utils.ts` — `assertCompanyAccess`, `assertCanManageCompany`, `isSuperAdmin`
