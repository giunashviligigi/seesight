# Database workflow

Prisma schema and migrations live in `server/prisma/`.

```
server/prisma/
├── schema.prisma
├── seed.ts
└── migrations/
```

Full ERD and entity dictionary: [`docs/DATABASE.md`](../docs/DATABASE.md)

## Common commands

From `server/`:

```bash
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name <migration_name>
npm run prisma:seed
npx prisma studio
```

## Migrations

| Migration | Purpose |
|-----------|---------|
| `20260715142221_auth_user_and_password_reset` | Milestone 2 auth tables |
| `20260715154202_domain_model_core_entities` | Milestone 3 domain model |

Never edit applied migrations; only add new ones.
