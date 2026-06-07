import { vi, describe, it, expect } from 'vitest'
import { db } from '@/lib/db'
import { makeRequest, ctx, tradeSeed } from '../helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'test@test.com' } }),
}))

import { GET as GetTrades, POST as PostTrade } from '@/app/api/trades/route'
import { GET as GetTrade, PATCH as PatchTrade, DELETE as DeleteTrade } from '@/app/api/trades/[id]/route'

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

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'] }),
      exitPrice: '110',
    })
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

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'] }),
      exitPrice: '97',
    })
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

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { direction: 'SHORT', entryPrice: '100', stopLoss: '105', targets: ['90'] }),
      exitPrice: '90',
    })
    const res = await PatchTrade(req, ctx({ id: trade.id }))
    const data = await res.json()

    expect(data.status).toBe('CLOSED')
    expect(Number(data.rMultiple)).toBe(2.0)
  })

  it('SHORT: exit at stop → rMultiple -1.0, pnl negative', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, {
      direction: 'SHORT',
      entryPrice: '100',
      stopLoss: '105',
      targets: ['90'],
      quantity: '2',
    })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { direction: 'SHORT', entryPrice: '100', stopLoss: '105', targets: ['90'], quantity: '2' }),
      exitPrice: '105',
    })
    const res = await PatchTrade(req, ctx({ id: trade.id }))
    const data = await res.json()

    expect(Number(data.rMultiple)).toBe(-1.0)
    expect(Number(data.pnl)).toBe(-10)
  })

  it('LONG: pnl computed correctly (entry 100, exit 110, qty 2 → pnl 20)', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' }),
      exitPrice: '110',
    })
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
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', quantity: '2', targets: ['115'] })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { entryPrice: '100', stopLoss: '95', quantity: '2', targets: ['115'] }),
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
    expect(Number(rb!.pnlImpact)).toBe(-10)
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
      ...tradeSeed(setup.id, { direction: 'SHORT', entryPrice: '100', stopLoss: '105', targets: ['85'], quantity: '2' }),
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

describe('PATCH /api/trades/[id] — full-field recompute', () => {
  it('editing entry price on a CLOSED trade recomputes rMultiple and pnl', async () => {
    const setup = await createTestSetup()
    // Create and close with entry 100, stop 95, exit 110 → +2R, pnl +20
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' })
    await PatchTrade(
      makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
        ...tradeSeed(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' }),
        exitPrice: '110',
      }),
      ctx({ id: trade.id })
    )

    // Edit entry to 102, stop to 97 — exit stays at 110 (existing)
    // rMultiple = (110-102)/(102-97) = 8/5 = 1.6
    // pnl = (110-102)*2 = 16
    const editReq = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { entryPrice: '102', stopLoss: '97', targets: ['110'], quantity: '2' }),
    })
    const editRes = await PatchTrade(editReq, ctx({ id: trade.id }))

    expect(editRes.status).toBe(200)
    const data = await editRes.json()
    expect(Number(data.rMultiple)).toBeCloseTo(1.6, 5)
    expect(Number(data.pnl)).toBe(16)

    const row = await db.trade.findUnique({ where: { id: trade.id } })
    expect(Number(row!.rMultiple)).toBeCloseTo(1.6, 5)
    expect(Number(row!.pnl)).toBe(16)
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
    expect(Array.isArray(found.triggerRules)).toBe(true)
    expect(found.triggerRules[0].isPrimary).toBe(true)
  })
})

describe('CLOSED trade remains editable', () => {
  it('PATCH thesis and notes on a CLOSED trade succeeds', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id)

    // Close it first
    await PatchTrade(
      makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
        ...tradeSeed(setup.id),
        exitPrice: '110',
      }),
      ctx({ id: trade.id })
    )

    const closed = await db.trade.findUnique({ where: { id: trade.id } })
    expect(closed!.status).toBe('CLOSED')

    // Edit thesis and notes on the closed trade
    const editReq = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id),
      thesis: 'Updated thesis post-close',
      notes: 'Lesson learned',
    })
    const editRes = await PatchTrade(editReq, ctx({ id: trade.id }))
    expect(editRes.status).toBe(200)
    const edited = await editRes.json()
    expect(edited.thesis).toBe('Updated thesis post-close')
    expect(edited.notes).toBe('Lesson learned')

    const row = await db.trade.findUnique({ where: { id: trade.id } })
    expect(row!.thesis).toBe('Updated thesis post-close')
    expect(row!.notes).toBe('Lesson learned')
    expect(row!.status).toBe('CLOSED')
  })

  it('PATCH triggerRules on a CLOSED trade replaces existing links', async () => {
    const setup = await createTestSetup()
    const rule1 = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 1, name: 'R1', direction: 'BOTH' } })
    const rule2 = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 2, name: 'R2', direction: 'BOTH' } })

    const trade = await createTrade(setup.id, { triggerRules: [{ triggerRuleId: rule1.id, isPrimary: true }] } as Record<string, unknown>)

    // Close it
    await PatchTrade(
      makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
        ...tradeSeed(setup.id),
        exitPrice: '108',
      }),
      ctx({ id: trade.id })
    )

    // Update triggerRules to rule2 only
    const editReq = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id),
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

describe('PATCH /api/trades/[id] — sideCorrect + executionPnl recompute', () => {
  it('sets sideCorrect=true when actual direction matches idealDirection', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' }),
      exitPrice: '110',
      idealDirection: 'LONG',
    })
    const res = await PatchTrade(req, ctx({ id: trade.id }))
    expect(res.status).toBe(200)

    const row = await db.trade.findUnique({ where: { id: trade.id } })
    expect(row!.sideCorrect).toBe(true)
  })

  it('sets sideCorrect=false when actual direction mismatches idealDirection', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' }),
      exitPrice: '110',
      idealDirection: 'SHORT',
    })
    await PatchTrade(req, ctx({ id: trade.id }))

    const row = await db.trade.findUnique({ where: { id: trade.id } })
    expect(row!.sideCorrect).toBe(false)
  })

  it('sets sideCorrect=null when idealDirection not provided', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' }),
      exitPrice: '110',
    })
    await PatchTrade(req, ctx({ id: trade.id }))

    const row = await db.trade.findUnique({ where: { id: trade.id } })
    expect(row!.sideCorrect).toBeNull()
  })

  it('computes executionPnl when ideal fields present on close', async () => {
    const setup = await createTestSetup()
    // LONG, entry 100, stop 95, exit 110, qty 2 → actualPnl = (110-100)*2 = 20
    // idealEntry 99, idealExit 112, idealDirection LONG, qty 2 → idealPnl = (112-99)*2 = 26
    // executionPnl = 20 - 26 = -6
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' }),
      exitPrice: '110',
      idealEntry: '99',
      idealExit: '112',
      idealDirection: 'LONG',
    })
    const res = await PatchTrade(req, ctx({ id: trade.id }))
    expect(res.status).toBe(200)

    const row = await db.trade.findUnique({ where: { id: trade.id } })
    expect(Number(row!.executionPnl)).toBe(-6)
  })

  it('executionPnl is null when ideal fields missing', async () => {
    const setup = await createTestSetup()
    const trade = await createTrade(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' })

    const req = makeRequest('PATCH', `http://localhost/api/trades/${trade.id}`, {
      ...tradeSeed(setup.id, { entryPrice: '100', stopLoss: '95', targets: ['110'], quantity: '2' }),
      exitPrice: '110',
    })
    await PatchTrade(req, ctx({ id: trade.id }))

    const row = await db.trade.findUnique({ where: { id: trade.id } })
    expect(row!.executionPnl).toBeNull()
  })
})

describe('DELETE /api/trades/[id]', () => {
  it('returns 204 and removes the trade and its TradeTrigger children', async () => {
    const setup = await createTestSetup()
    const rule = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 1, name: 'R1', direction: 'BOTH' } })
    const trade = await createTrade(setup.id, {
      triggerRules: [{ triggerRuleId: rule.id, isPrimary: true }],
    } as Record<string, unknown>)

    const req = makeRequest('DELETE', `http://localhost/api/trades/${trade.id}`)
    const res = await DeleteTrade(req, ctx({ id: trade.id }))

    expect(res.status).toBe(204)
    expect(await db.trade.findUnique({ where: { id: trade.id } })).toBeNull()
    expect(await db.tradeTrigger.count({ where: { tradeId: trade.id } })).toBe(0)
  })

  it('returns 404 for unknown id', async () => {
    const req = makeRequest('DELETE', 'http://localhost/api/trades/nonexistent')
    const res = await DeleteTrade(req, ctx({ id: 'nonexistent' }))
    expect(res.status).toBe(404)
  })
})
