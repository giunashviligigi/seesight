# Milestone 2 — Authentication — Test Results

**Run date:** 2026-07-15T14:25:42Z  
**Branch:** `development`  
**Overall:** PASSED

## Summary

| Check | Result |
|-------|--------|
| `GET /health` | HTTP 200 |
| `POST /auth/register` | HTTP 201 — `COMPANY_ADMIN` |
| `GET /auth/me` (Bearer) | HTTP 200 |
| `GET /account/protected` | HTTP 200 |
| `GET /auth/me` (no token) | HTTP 401 |
| `POST /auth/login` invalid password | HTTP 401 |
| `POST /auth/forgot-password` unknown email | HTTP 200 generic message (no leak) |
| Web `/login` `/register` `/account` | HTTP 200 |
| Unit tests | 6 passed |
| E2E tests | 5 passed |
| Client build | exit 0 |

## Captured outputs

See files in this folder (`auth-*.txt`, `unit-tests.log`, `e2e-tests.log`, `web-*.txt`).

## Acceptance criteria

| Criterion | Met |
|-----------|-----|
| Protected routes require JWT | Yes |
| Role claim on token / user | Yes (`COMPANY_ADMIN`) |
| Password never plaintext | Yes (bcrypt) |
| Forgot-password does not leak email existence | Yes |

## Notes

- Migration applied: `20260715142221_auth_user_and_password_reset`
- Decisions documented in `docs/AUTH.md`
