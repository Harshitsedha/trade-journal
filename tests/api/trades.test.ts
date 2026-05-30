import { vi, describe, it, expect } from 'vitest'
import { db } from '@/lib/db'
import { makeRequest, ctx, tradeSeed } from '../helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'test@test.com' } }),
}))

import { GET as GetTrades, POST as PostTrade } from '@/app/api/trades/route'
import { GET as GetTrade, PATCH as PatchTrade } from '@/app/api/trades/[id]/route'

// ── Helpers ─────────────────────────────────────────────────────────────────

async function createTestSetup(name = 'Test Setup') {
  return db.setup.create({ data: { name } })
}

async function createTrade(setupId: string, overrides: Record<string, unknown> = {}) {
  const req = makeRequest('POST', 'http://localhost/api/trades', tradeSeed(setupId, overrides))
  const res = await PostTrade(req)
  expect(res.status).toBe(201)
  return res.json() as Promise<{ id: string; status: string; rMultiple: string | null; pnl: string | null }>
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/trades', () => {
  it('creates a LONG trade with correct values persisted to DB', async () => {
    const setup = await createTestSetup()
    const req = makeRequest('POST', 'http://localhost/api/trades', tradeSeed(setup.id))
    const res = await PostTrade(req)

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.instrument).toBe('NIFTY')
    expect(data.direction).toBe('LONG')
    expect(data.status).toBe('OPEN')

    const row = await db.trade.findUnique({ where: { id: data.id } })
    expect(row).not.toBeNull()
    expect(row!.direction).toBe('LONG')
    expect(row!.entryPrice.toString()).toBe('100')
    expect(row!.stopLoss.toString()).toBe('95')
    expect(row!.status).toBe('OPEN')
  })

  it('creates a SHORT trade with correct direction in DB', async () => {
    const setup = await createTestSetup('Short Setup')
    const data = await createTrade(setup.id, { direction: 'SHORT', entryPrice: '100', stopLoss: '105', targets: ['90'] })

    const row = await db.trade.findUnique({ where: { id: data.id } })
    expect(row!.direction).toBe('SHORT')
    expect(row!.entryPrice.toString()).toBe('100')
    expect(row!.stopLoss.toString()).toBe('105')
  })

  it('creates TradeTrigger rows with correct isPrimary when triggerRules provided', async () => {
    const setup = await createTestSetup('Trigger Setup')
    const rule1 = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 1, name: 'R1', direction: 'BOTH' } })
    const rule2 = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 2, name: 'R2', direction: 'BOTH' } })

    const req = makeRequest('POST', 'http://localhost/api/trades', {
      ...tradeSeed(setup.id),
      triggerRules: [
        { triggerRuleId: rule1.id, isPrimary: true },
        { triggerRuleId: rule2.id, isPrimary: false },
      ],
    })
    const res = await PostTrade(req)
    const trade = await res.json()

    const links = await db.tradeTrigger.findMany({ where: { tradeId: trade.id } })
    expect(links).toHaveLength(2)

    const primary = links.find(l => l.triggerRuleId === rule1.id)
    const confluence = links.find(l => l.triggerRuleId === rule2.id)
    expect(primary!.isPrimary).toBe(true)
    expect(confluence!.isPrimary).toBe(false)
  })
})

describe('PATCH /api/trades/[id] — close with exitPrice', () => {
  it('LONG: entry 100, stop 95, exit 110 → rMultiple +2.0, status CLOSED', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'] })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, { exitPrice: '110' })
    const res = await PatchTrade(req, ctx({ id: trade.id }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('CLOSED')
    expect(Number(data.rMultiple)).toBe(2.0)

    const row = await db.trade.findUnique({ where: { id: trade.id } })
    expect(row!.status).toBe('CLOSED')
    expect(Number(row!.rMultiple)).toBe(2.0)
  })

  it('LONG: entry 100, stop 95, exit 97 → rMultiple ≈ -0.6', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'] })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, { exitPrice: '97' })
    const res = await PatchTrade(req, ctx({ id: trade.id }))
    const data = await res.json()

    expect(Number(data.rMultiple)).toBeCloseTo(-0.6, 5)
  })

  it('SHORT: entry 100, stop 105, exit 90 → rMultiple +2.0', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, {
      direction: 'SHORT',
      entryPrice: '100',
      stopLoss: '105',
      targets: ['90'],
    })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, { exitPrice: '90' })
    const res = await PatchTrade(req, ctx({ id: trade.id }))
    const data = await res.json()

    expect(data.status).toBe('CLOSED')
    expect(Number(data.rMultiple)).toBe(2.0)
  })

  it('SHORT: exit at stop → rMultiple -1.0, pnl negative', async () => {
    const setup = await createTestSetup()
    // entry 100, stop 105, qty 2, exit at stop (105)
    const trade = await createTrade(setup.id, {
      direction: 'SHORT',
      entryPrice: '100',
      stopLoss: '105',
      targets: ['90'],
      quantity: '2',
    })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, { exitPrice: '105' })
    const res = await PatchTrade(req, ctx({ id: trade.id }))
    const data = await res.json()

    expect(Number(data.rMultiple)).toBe(-1.0)
    // pnl = (100 - 105) * 2 = -10
    expect(Number(data.pnl)).toBe(-10)
  })

  it('LONG: pnl computed correctly (entry 100, exit 110, qty 2 → pnl 20)', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, { exitPrice: '110' })
    const res = await PatchTrade(req, ctx({ id: trade.id }))
    const data = await res.json()

    expect(Number(data.pnl)).toBe(20)
    const row = await db.trade.findUnique({ where: { id: trade.id } })
    expect(Number(row!.pnl)).toBe(20)
  })
})

describe('PATCH /api/trades/[id] — ruleBreak', () => {
  it('stores ruleBreak with correct pnlImpact and rMultipleImpact', async () => {
    const setup = await createTestSetup()
    // LONG, entry 100, stop 95, qty 2
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', quantity: '2', targets: ['115'] })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      exitPrice: '110',
      ruleBreak: {
        breakType: 'EARLY_EXIT',
        ruleDescription: 'Should have held to T1 at 115',
        actualExitPrice: '110',
        ruleExitPrice: '115',
        notes: null,
      },
    })
    const res = await PatchTrade(req, ctx({ id: trade.id }))
    expect(res.status).toBe(200)

    const rb = await db.ruleBreak.findUnique({ where: { tradeId: trade.id } })
    expect(rb).not.toBeNull()
    expect(rb!.breakType).toBe('EARLY_EXIT')
    // LONG, actual 110, rule 115, qty 2 → pnlImpact -10
    expect(Number(rb!.pnlImpact)).toBe(-10)
    // stopDistance = 100-95=5, priceDelta = 110-115=-5 → rMultipleImpact = -1
    expect(Number(rb!.rMultipleImpact)).toBe(-1)
  })

  it('SHORT ruleBreak pnlImpact: actual 90, rule 85, qty 2 → -10', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, {
      direction: 'SHORT',
      entryPrice: '100',
      stopLoss: '105',
      targets: ['85'],
      quantity: '2',
    })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      exitPrice: '90',
      ruleBreak: {
        breakType: 'EARLY_EXIT',
        ruleDescription: 'Should have held to 85',
        actualExitPrice: '90',
        ruleExitPrice: '85',
        notes: null,
      },
    })
    await PatchTrade(req, ctx({ id: trade.id }))

    const rb = await db.ruleBreak.findUnique({ where: { tradeId: trade.id } })
    expect(Number(rb!.pnlImpact)).toBe(-10)
    expect(Number(rb!.rMultipleImpact)).toBe(-1)
  })
})

describe('GET /api/trades', () => {
  it('returns paginated trades including triggerRules relation', async () => {
    const setup = await createTestSetup()
    const rule = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 1, name: 'R1', direction: 'BOTH' } })

    const req1 = makeRequest('POST', 'http://localhost/api/trades', {
      ...tradeSeed(setup.id),
      triggerRules: [{ triggerRuleId: rule.id, isPrimary: true }],
    })
    const created = await (await PostTrade(req1)).json()

    const req = makeRequest('GET', 'http://localhost/api/trades')
    const res = await GetTrades(req)
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.total).toBeGreaterThanOrEqual(1)
    const found = data.trades.find((t: { id: string }) => t.id === created.id)
    expect(found).toBeDefined()
    // triggerRules included
    expect(Array.isArray(found.triggerRules)).toBe(true)
    expect(found.triggerRules[0].isPrimary).toBe(true)
  })
})

describe('CLOSED trade remains editable', () => {
  it('PATCH thesis and notes on a CLOSED trade succeeds', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id)

    // Close it first
    const closeReq = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, { exitPrice: '110' })
    await PatchTrade(closeReq, ctx({ id: trade.id }))

    // Verify it's closed
    const closed = await db.trade.findUnique({ where: { id: trade.id } })
    expect(closed!.status).toBe('CLOSED')

    // Now edit thesis and notes on the closed trade
    const editReq = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      thesis: 'Updated thesis post-close',
      notes: 'Lesson learned',
    })
    const editRes = await PatchTrade(editReq, ctx({ id: trade.id }))
    expect(editRes.status).toBe(200)
    const edited = await editRes.json()
    expect(edited.thesis).toBe('Updated thesis post-close')
    expect(edited.notes).toBe('Lesson learned')

    // Verify persisted in DB
    const row = await db.trade.findUnique({ where: { id: trade.id } })
    expect(row!.thesis).toBe('Updated thesis post-close')
    expect(row!.notes).toBe('Lesson learned')
    expect(row!.status).toBe('CLOSED')
  })

  it('PATCH triggerRules on a CLOSED trade replaces existing links', async () => {
    const setup = await createTestSetup()
    const rule1 = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 1, name: 'R1', direction: 'BOTH' } })
    const rule2 = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 2, name: 'R2', direction: 'BOTH' } })

    // Create trade with rule1
    const trade = await createTrade(setup.id, { triggerRules: [{ triggerRuleId: rule1.id, isPrimary: true }] } as Record<string, unknown>)

    // Close it
    const closeReq = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, { exitPrice: '108' })
    await PatchTrade(closeReq, ctx({ id: trade.id }))

    // Now update triggerRules to rule2 only
    const editReq = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      triggerRules: [{ triggerRuleId: rule2.id, isPrimary: true }],
    })
    const editRes = await PatchTrade(editReq, ctx({ id: trade.id }))
    expect(editRes.status).toBe(200)

    const links = await db.tradeTrigger.findMany({ where: { tradeId: trade.id } })
    expect(links).toHaveLength(1)
    expect(links[0].triggerRuleId).toBe(rule2.id)
    expect(links[0].isPrimary).toBe(true)
  })
})
