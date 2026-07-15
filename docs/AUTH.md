# Authentication (Milestone 2)

## Decisions

| Topic | Choice |
|-------|--------|
| Registration | Company-admin self-signup (`COMPANY_ADMIN`). `companyId` stays `null` until Milestone 4. |
| Password hashing | bcrypt (12 rounds) |
| Tokens | Access JWT only (no refresh tokens in M2) |
| Session | httpOnly cookie (`seesight_access_token`) **and** Bearer token body/header for Swagger + cross-port local Next.js |
| Logout | Clears cookie; JWT remains currently stateless (no server blacklist) |
| Reset email | Generic success message always. In `development`, reset URL/token returned in API response and logged (no SMTP yet) |

## Roles

`SUPER_ADMIN` | `COMPANY_ADMIN` | `EMPLOYEE`

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | Public |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/reset-password` | Public |
| GET | `/auth/me` | JWT |
| GET | `/account/protected` | JWT + role |

## Frontend routes

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/account` (protected sample)

## Guards / decorators

- Global `JwtAuthGuard` + `RolesGuard`
- `@Public()` for open routes
- `@Roles(...)` for role checks
- `@CurrentUser()` for request user

## Environment

See `server/.env.example` for `JWT_SECRET`, `JWT_EXPIRES_IN`, `AUTH_COOKIE_NAME`, `WEB_ORIGIN`.
