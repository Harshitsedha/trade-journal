import { beforeEach, afterAll } from 'vitest'
import { db } from '@/lib/db'

// ── PRODUCTION GUARD ────────────────────────────────────────────────────────
// This must be the FIRST executable code in this file — it aborts the entire
// run before any deleteMany can fire if the connection is not a test database.
//
// The guard has two independent checks:
//   1. TEST_DATABASE_URL must be set AND equal DATABASE_URL, proving the
//      operator explicitly configured a separate test DB.
//   2. DATABASE_URL must NOT contain the production Neon endpoint ID — a
//      belt-and-suspenders block even if env vars are misconfigured.

const PROD_ENDPOINT = 'ep-calm-dawn-ao7a4u2t' // production Neon project, both pooler + direct

const url = process.env.DATABASE_URL ?? ''
const testUrl = process.env.TEST_DATABASE_URL ?? ''

if (!testUrl) {
  throw new Error(
    '[tests] TEST_DATABASE_URL is not set.\n' +
    'Tests require a dedicated Neon test branch. Set TEST_DATABASE_URL in .env.test\n' +
    '(copy .env.test.example → .env.test and fill in your test-branch connection string).',
  )
}

if (url !== testUrl) {
  throw new Error(
    '[tests] DATABASE_URL does not match TEST_DATABASE_URL.\n' +
    'In .env.test both variables must be set to the same test-branch URL so that\n' +
    `the Prisma client connects to the test DB. Currently DATABASE_URL starts with:\n  ${url.slice(0, 60)}…`,
  )
}

if (url.includes(PROD_ENDPOINT)) {
  throw new Error(
    `[tests] DATABASE_URL contains the production Neon endpoint (${PROD_ENDPOINT}).\n` +
    'Tests must use a separate Neon test branch — never the production database.',
  )
}
// ── END GUARD ────────────────────────────────────────────────────────────────

// Clean all business-data tables before every INTEGRATION test (tests/api/**).
// Pure unit tests (tests/unit/**) have no DB dependencies — they are skipped
// so they never open a connection or incur any deleteMany cost.
beforeEach(async (ctx) => {
  const fp = (ctx.task?.file?.filepath ?? '').replace(/\\/g, '/')
  if (fp.includes('/unit/')) return

  await db.tradeTrigger.deleteMany()
  await db.ruleBreak.deleteMany()
  await db.chartImage.deleteMany()
  await db.trade.deleteMany()
  await db.subSetup.deleteMany()
  await db.triggerRule.deleteMany()
  await db.setup.deleteMany()
})

afterAll(async () => {
  // PrismaNeon uses HTTP (stateless) — no persistent connection to close
})
