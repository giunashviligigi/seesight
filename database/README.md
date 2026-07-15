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

Milestone 1 shipped an empty schema. Milestone 2 added `User` and `PasswordResetToken` via migration `20260715142221_auth_user_and_password_reset`.

