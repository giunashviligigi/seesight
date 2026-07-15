# Database workflow

Prisma schema and migrations live in `server/prisma/`.

```
server/prisma/
├── schema.prisma
└── migrations/   # created starting Milestone 2/3
```

## Common commands

From `server/`:

```bash
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name <migration_name>
npx prisma studio
```

Milestone 1 ships an empty schema (datasource only) so the migration workflow is ready without domain models yet.
