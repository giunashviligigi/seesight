# Employees & Departments (Milestone 5)

## Decisions

| Topic | Choice |
|-------|--------|
| Invite vs temp password | Optional `createLogin: true` creates a linked `User` (`EMPLOYEE`) and returns a **temporary password once**. Roster-only create (default) does not create a login. |
| Deactivate policy | Sets `Employee.status = INACTIVE` and linked `User.status = INACTIVE`. Login rejects inactive users. Trip history rows are **not** deleted. |
| Tenant scope | Company admins operate on their `companyId`. Super admins must pass `companyId` on list/create. |
| One company | `Employee.companyId` is required; email unique per company (`@@unique([companyId, email])`). |
| Soft-delete departments | Sets `deletedAt`; clears `departmentId` on members. |
| Travel placeholders | Optional `nationality`, `passportNumber`, `preferredAirport` on `Employee`. |

## Endpoints

### Departments

| Method | Path | Roles |
|--------|------|-------|
| POST | `/departments` | SUPER_ADMIN, COMPANY_ADMIN |
| GET | `/departments` | SUPER_ADMIN, COMPANY_ADMIN, EMPLOYEE |
| PATCH | `/departments/:id` | SUPER_ADMIN, COMPANY_ADMIN |
| DELETE | `/departments/:id` | SUPER_ADMIN, COMPANY_ADMIN |

### Employees

| Method | Path | Roles |
|--------|------|-------|
| POST | `/employees` | SUPER_ADMIN, COMPANY_ADMIN |
| GET | `/employees` | SUPER_ADMIN, COMPANY_ADMIN — search, `departmentId`, `status`, `sortBy`, `sortOrder`, `page`, `pageSize` |
| GET | `/employees/me` | linked employee profile |
| GET | `/employees/:id` | tenant-scoped; employees own profile only |
| PATCH | `/employees/:id` | SUPER_ADMIN, COMPANY_ADMIN |
| POST | `/employees/:id/deactivate` | SUPER_ADMIN, COMPANY_ADMIN |
| POST | `/employees/:id/activate` | SUPER_ADMIN, COMPANY_ADMIN |

## Frontend

- `/employees` — company admin roster, create/edit, activate/deactivate, departments
- `/profile` — employee self profile (read-only)

## Seed

Acme Travel includes Engineering, Sales, Operations plus **110+** roster employees for pagination demos (`roster001@acme-travel.example` …), in addition to demo traveler/sales records.
