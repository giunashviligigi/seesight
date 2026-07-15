# Milestone 1 — Project Setup — Test Results

**Run date:** 2026-07-15T13:54:45Z  
**Branch:** `development`  
**Overall:** PASSED

## Summary

| Check | Command / target | Result |
|-------|------------------|--------|
| API start | `cd server && npm run start:dev` | Passed — Nest started |
| API health | `curl http://localhost:3001/health` | Passed — HTTP 200 |
| API docs | `curl http://localhost:3001/docs` | Passed — HTTP 200 |
| Web start | `cd client && npm run dev` | Passed — Next.js ready |
| Web home | `curl http://localhost:3000` | Passed — HTTP 200 |
| Postgres | `docker compose -f docker/docker-compose.yml up postgres -d` | Passed — healthy |
| Unit tests | `cd server && npm test` | Passed — 1/1 |
| API build | `cd server && npm run build` | Passed — exit 0 |
| Web build | `cd client && npm run build` | Passed — exit 0 |
| Web lint | `cd client && npm run lint` | Passed — exit 0 |

## Captured outputs

| File | Contents |
|------|----------|
| [`api-health.txt`](./api-health.txt) | Health JSON + HTTP status |
| [`api-docs.txt`](./api-docs.txt) | Swagger HTTP status |
| [`api-start-dev.log`](./api-start-dev.log) | Nest watch-mode startup log |
| [`web-home.txt`](./web-home.txt) | Web HTTP status |
| [`web-start-dev.log`](./web-start-dev.log) | Next.js dev startup log |
| [`postgres.log`](./postgres.log) | Compose pull / start log |
| [`postgres-ps.txt`](./postgres-ps.txt) | `docker compose ps` |
| [`unit-tests.log`](./unit-tests.log) | Jest unit test run |
| [`api-build.log`](./api-build.log) | Nest production build |
| [`web-build.log`](./web-build.log) | Next.js production build |
| [`web-lint.log`](./web-lint.log) | ESLint |
| [`run-meta.txt`](./run-meta.txt) | Run timestamp |

## Key responses

### `GET /health`

```json
{"status":"ok","service":"seesight-api","timestamp":"2026-07-15T13:54:45.880Z"}
```

HTTP status: **200**

### Postgres container

```
NAME                IMAGE                STATUS
seesight-postgres   postgres:16-alpine   Up (healthy)
PORTS: 0.0.0.0:5432->5432/tcp
```

### Unit tests

```
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
EXIT:0
```

## Acceptance criteria (Milestone 1)

| Criterion | Met |
|-----------|-----|
| Fresh install builds | Yes (`client` + `server` build exit 0) |
| Health check returns 200 | Yes |
| TypeScript strict builds | Yes |
| Docker Compose brings up Postgres | Yes |
| Docs present (`SETUP`, `ARCHITECTURE`) | Yes (verified separately in milestone work) |

## Notes

- Dev servers were left running after this verification (`api` on `:3001`, `web` on `:3000`, Postgres via Docker).
- No domain migrations yet (empty Prisma schema by design for M1).
