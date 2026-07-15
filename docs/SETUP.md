# Setup

Prerequisites:

- Node.js 22 LTS (or current LTS)
- npm 10+
- Docker Desktop (for Postgres / full stack)

## 1. Clone and install

```bash
git clone https://github.com/giunashviligigi/seesight.git
cd seesight
git checkout development

cp server/.env.example server/.env
cp client/.env.example client/.env.local

cd server && npm install && npx prisma generate && cd ..
cd client && npm install && cd ..
```

## 2. Start PostgreSQL (recommended)

```bash
docker compose -f docker/docker-compose.yml up postgres -d
```

Connection string (matches `.env.example`):

```
postgresql://seesight:seesight@localhost:5432/seesight?schema=public
```

Apply migrations and seed demo data:

```bash
cd server
npx prisma migrate dev
npm run prisma:seed
```

See [`DATABASE.md`](./DATABASE.md) for the ERD and seed accounts.

## 3. Run API

```bash
cd server
npm run start:dev
```

Verify:

```bash
curl http://localhost:3001/health
```

Expected:

```json
{"status":"ok","service":"seesight-api","timestamp":"..."}
```

Swagger: [http://localhost:3001/docs](http://localhost:3001/docs)

## 4. Run web

```bash
cd client
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Full stack with Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```

- Web: http://localhost:3000  
- API: http://localhost:3001/health  
- Postgres: localhost:5432  

## Scripts

| Location | Script | Purpose |
|----------|--------|---------|
| `client/` | `npm run dev` | Next.js dev server |
| `client/` | `npm run build` | Production build |
| `client/` | `npm run lint` | ESLint |
| `server/` | `npm run start:dev` | NestJS watch mode |
| `server/` | `npm run build` | Compile API |
| `server/` | `npm run lint` | ESLint |
| `server/` | `npm test` | Unit tests |
| `server/` | `npm run prisma:generate` | Generate Prisma Client |

## Environment variables

See:

- `server/.env.example`
- `client/.env.example`

Never commit real secrets. `.env` / `.env.local` are gitignored.
