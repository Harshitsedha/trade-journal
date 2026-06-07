@AGENTS.md

---

# Hard rules — read before touching anything

## Database safety

**NEVER run tests against the production database.**
The production database has been wiped twice by tests running against it.
Tests use `.env.test` pointing at a Neon "test" branch only.
`vitest.config.ts` loads `.env.test` exclusively and throws if it is missing.
`tests/setup.ts` throws before any `deleteMany` fires if `DATABASE_URL` contains the
production endpoint or if `TEST_DATABASE_URL` is unset.

**NEVER run `prisma db push`.**
`db push` bypasses migration history and can destroy data.

**NEVER run `prisma migrate reset`.**
`migrate reset` drops and recreates the entire database.

**NEVER run `prisma db seed` against production.**
The seed script has a production guard, but do not test fate.

**Run `bash scripts/backup-db.sh` before any DB-touching work.**
This dumps the current state to `backups/`. Always do this before
schema changes, seeding, or anything that could mutate production data.

## Safe schema workflow

```
# Local development
prisma migrate dev          # creates a new versioned migration + applies it locally

# Vercel (automated via build script)
prisma migrate deploy       # applies pending migrations, never resets
```

The `package.json` build script is:
```
prisma generate && prisma migrate deploy && next build
```
Do not change `migrate deploy` to `db push` or `migrate reset`.

## Test rules

- Pure unit tests (`tests/unit/**`) must never have DB lifecycle hooks.
  `tests/setup.ts` already skips `deleteMany` for files under `tests/unit/`.
- API/integration tests (`tests/api/**`) run against the Neon **test branch** only.
- To create a test branch: Neon dashboard → your project → Branches → "New branch".
  Set both `DATABASE_URL` and `TEST_DATABASE_URL` in `.env.test` to the test-branch URL.
- `.env.test` is gitignored. Copy `.env.test.example` to get started.
- Never run `vitest` (or `npm test`) without first verifying `.env.test` is in place.

## Gitignore coverage

The following are gitignored and must never be committed with real secrets:
- `.env`
- `.env.test`
- `.env*.local`
- `backups/*.dump`

The example scaffolds (`.env.local.example`, `.env.test.example`) are committed
with empty values — safe to track, useful for onboarding.
