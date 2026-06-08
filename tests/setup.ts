import { beforeEach, afterAll } from 'vitest'
import { db } from '@/lib/db'

// ── PRODUCTION GUARD ────────────────────────────────────────────────────────
// Must be the FIRST executable code — aborts the entire run before any
// deleteMany fires if the connection is not the designated test branch.
//
// ALLOWLIST-based (fails closed): an unknown or misconfigured endpoint is
// rejected even if it does not match the production denylist. This prevents
// the guard from silently passing when the project moves to a new endpoint.
//
// ⚠️  If the Neon project moves (new production project or new test branch),
//     update BOTH constants together before running tests:
//       PROD_ENDPOINT — endpoint ID of the production branch (to block)
//       TEST_ENDPOINT — endpoint ID of the designated test branch (to allow)
//
// Guard checks (in order):
//   1. TEST_DATABASE_URL must be set.
//   2. TEST_DATABASE_URL must contain TEST_ENDPOINT (allowlist — rejects any
//      endpoint not explicitly designated as the test branch).
//   3. DATABASE_URL must equal TEST_DATABASE_URL (explicit test-DB assertion).
//   4. DATABASE_URL must NOT contain PROD_ENDPOINT (denylist).
//   5. DATABASE_URL must contain TEST_ENDPOINT (belt-and-suspenders: allowlist
//      applied directly to the URL the Prisma client will actually use).

const PROD_ENDPOINT = 'ep-noisy-brook-aotot7c1' // current production Neon project
const TEST_ENDPOINT = 'ep-young-mud-aoz7e0ak'   // designated test branch on same project

const url = process.env.DATABASE_URL ?? ''
const testUrl = process.env.TEST_DATABASE_URL ?? ''

if (!testUrl) {
  throw new Error(
    '[tests] TEST_DATABASE_URL is not set.\n' +
    'Tests require a dedicated Neon test branch. Set TEST_DATABASE_URL in .env.test\n' +
    '(copy .env.test.example → .env.test and fill in your test-branch connection string).',
  )
}

if (!testUrl.includes(TEST_ENDPOINT)) {
  throw new Error(
    `[tests] TEST_DATABASE_URL does not contain the expected test-branch endpoint (${TEST_ENDPOINT}).\n` +
    'Tests are allowlist-based: only the designated test branch is permitted.\n' +
    'If the test branch changed, update TEST_ENDPOINT in tests/setup.ts.',
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

if (!url.includes(TEST_ENDPOINT)) {
  throw new Error(
    `[tests] DATABASE_URL does not contain the expected test-branch endpoint (${TEST_ENDPOINT}).\n` +
    'Belt-and-suspenders: the URL the Prisma client will use must be the designated test branch.\n' +
    'If the test branch changed, update TEST_ENDPOINT in tests/setup.ts.',
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
