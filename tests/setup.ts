import { beforeEach, afterAll } from 'vitest'
import { db } from '@/lib/db'

// Clean all business-data tables before every test in FK-safe order.
// Auth tables (User, Account, Session, VerificationToken) are intentionally preserved.
beforeEach(async () => {
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
