import { vi, describe, it, expect } from 'vitest'
import { db } from '@/lib/db'
import { makeRequest, ctx } from '../helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'test@test.com' } }),
}))

// revalidatePath needs Next's render/store context (absent when route handlers
// are invoked directly in tests). One of these tests creates a trade via PostTrade.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { GET as GetSetups, POST as PostSetup } from '@/app/api/setups/route'
import { GET as GetById, PATCH as PatchSetup, DELETE as DeleteSetup } from '@/app/api/setups/[id]/route'
import { GET as GetTriggerRules, POST as PostTriggerRule } from '@/app/api/setups/[id]/trigger-rules/route'
import { PATCH as PatchTriggerRule, DELETE as DeleteTriggerRule } from '@/app/api/setups/[id]/trigger-rules/[ruleId]/route'
import { POST as PostTrade } from '@/app/api/trades/route'
import { tradeSeed } from '../helpers'

describe('POST /api/setups', () => {
  it('creates a setup and persists to DB', async () => {
    const req = makeRequest('POST', 'http://localhost/api/setups', { name: 'Range Breakout' })
    const res = await PostSetup(req)

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe('Range Breakout')
    expect(data.id).toBeTruthy()

    const row = await db.setup.findUnique({ where: { id: data.id } })
    expect(row).not.toBeNull()
    expect(row!.name).toBe('Range Breakout')
  })

  it('returns 400 for missing name', async () => {
    const req = makeRequest('POST', 'http://localhost/api/setups', {})
    const res = await PostSetup(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/setups', () => {
  it('returns list of all setups', async () => {
    await db.setup.createMany({ data: [{ name: 'Setup A' }, { name: 'Setup B' }] })

    const res = await GetSetups()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(2)
    expect(data.some((s: { name: string }) => s.name === 'Setup A')).toBe(true)
    expect(data.some((s: { name: string }) => s.name === 'Setup B')).toBe(true)
  })
})

describe('GET /api/setups/[id]', () => {
  it('returns single setup with triggerRules', async () => {
    const setup = await db.setup.create({ data: { name: 'Detail Setup' } })
    await db.triggerRule.create({ data: { setupId: setup.id, precedence: 1, name: 'Rule A', direction: 'LONG' } })

    const req = makeRequest('GET', `http://localhost/api/setups/${setup.id}`)
    const res = await GetById(req, ctx({ id: setup.id }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(setup.id)
    expect(data.triggerRules).toHaveLength(1)
    expect(data.triggerRules[0].name).toBe('Rule A')
  })

  it('returns 404 for unknown id', async () => {
    const req = makeRequest('GET', 'http://localhost/api/setups/nonexistentid')
    const res = await GetById(req, ctx({ id: 'nonexistentid' }))
    expect(res.status).toBe(404)
  })
})

describe('Trigger Rules', () => {
  it('POST creates a rule with correct precedence and persists to DB', async () => {
    const setup = await db.setup.create({ data: { name: 'Rule Setup' } })

    const req = makeRequest('POST', `http://localhost/api/setups/${setup.id}/trigger-rules`, {
      precedence: 1,
      name: 'EMA crossover on volume',
      description: 'Price crosses above 20 EMA with volume spike',
      direction: 'LONG',
    })
    const res = await PostTriggerRule(req, ctx({ id: setup.id }))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.precedence).toBe(1)
    expect(data.name).toBe('EMA crossover on volume')
    expect(data.direction).toBe('LONG')
    expect(data.isActive).toBe(true)

    const row = await db.triggerRule.findUnique({ where: { id: data.id } })
    expect(row).not.toBeNull()
    expect(row!.setupId).toBe(setup.id)
    expect(row!.isActive).toBe(true)
  })

  it('POST returns 409 when precedence already exists for setup (@@unique constraint)', async () => {
    const setup = await db.setup.create({ data: { name: 'Conflict Setup' } })
    await db.triggerRule.create({ data: { setupId: setup.id, precedence: 1, name: 'First', direction: 'BOTH' } })

    const req = makeRequest('POST', `http://localhost/api/setups/${setup.id}/trigger-rules`, {
      precedence: 1,
      name: 'Duplicate',
      direction: 'BOTH',
    })
    const res = await PostTriggerRule(req, ctx({ id: setup.id }))
    expect(res.status).toBe(409)

    // Only one rule should exist
    const count = await db.triggerRule.count({ where: { setupId: setup.id } })
    expect(count).toBe(1)
  })

  it('GET returns active rules ordered by precedence', async () => {
    const setup = await db.setup.create({ data: { name: 'Order Setup' } })
    await db.triggerRule.createMany({
      data: [
        { setupId: setup.id, precedence: 3, name: 'Third', direction: 'BOTH' },
        { setupId: setup.id, precedence: 1, name: 'First', direction: 'BOTH' },
        { setupId: setup.id, precedence: 2, name: 'Second', direction: 'BOTH', isActive: false },
      ],
    })

    const req = makeRequest('GET', `http://localhost/api/setups/${setup.id}/trigger-rules`)
    const res = await GetTriggerRules(req, ctx({ id: setup.id }))

    expect(res.status).toBe(200)
    const data = await res.json()
    // Only active rules
    expect(data).toHaveLength(2)
    expect(data[0].precedence).toBe(1)
    expect(data[1].precedence).toBe(3)
  })

  it('DELETE soft-deletes rule (sets isActive: false, row still exists in DB)', async () => {
    const setup = await db.setup.create({ data: { name: 'Soft Delete Setup' } })
    const rule = await db.triggerRule.create({
      data: { setupId: setup.id, precedence: 1, name: 'Rule to deactivate', direction: 'BOTH' },
    })

    const req = makeRequest('DELETE', `http://localhost/api/setups/${setup.id}/trigger-rules/${rule.id}`)
    const res = await DeleteTriggerRule(req, ctx({ id: setup.id, ruleId: rule.id }))

    expect(res.status).toBe(200)

    // Row still exists but isActive is false
    const row = await db.triggerRule.findUnique({ where: { id: rule.id } })
    expect(row).not.toBeNull()
    expect(row!.isActive).toBe(false)

    // GET active rules no longer returns it
    const listReq = makeRequest('GET', `http://localhost/api/setups/${setup.id}/trigger-rules`)
    const listRes = await GetTriggerRules(listReq, ctx({ id: setup.id }))
    const listData = await listRes.json()
    expect(listData.find((r: { id: string }) => r.id === rule.id)).toBeUndefined()
  })

  it('PATCH updates rule name and direction', async () => {
    const setup = await db.setup.create({ data: { name: 'Patch Setup' } })
    const rule = await db.triggerRule.create({
      data: { setupId: setup.id, precedence: 1, name: 'Old Name', direction: 'BOTH' },
    })

    const req = makeRequest('PATCH', `http://localhost/api/setups/${setup.id}/trigger-rules/${rule.id}`, {
      name: 'New Name',
      direction: 'SHORT',
    })
    const res = await PatchTriggerRule(req, ctx({ id: setup.id, ruleId: rule.id }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('New Name')
    expect(data.direction).toBe('SHORT')

    const row = await db.triggerRule.findUnique({ where: { id: rule.id } })
    expect(row!.name).toBe('New Name')
  })
})

describe('DELETE /api/setups/[id]', () => {
  it('returns 409 with SETUP_HAS_TRADES when trades exist', async () => {
    const setup = await db.setup.create({ data: { name: 'Busy Setup' } })
    // Create a trade using this setup
    const req = makeRequest('POST', 'http://localhost/api/trades', tradeSeed(setup.id))
    await PostTrade(req)

    const delReq = makeRequest('DELETE', `http://localhost/api/setups/${setup.id}`)
    const res = await DeleteSetup(delReq, ctx({ id: setup.id }))

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toBe('SETUP_HAS_TRADES')
    expect(data.tradesCount).toBe(1)

    // Setup must still exist
    expect(await db.setup.findUnique({ where: { id: setup.id } })).not.toBeNull()
  })

  it('returns 204 and cascade-deletes trigger rules and sub-setups when no trades', async () => {
    const setup = await db.setup.create({ data: { name: 'Empty Setup' } })
    const rule = await db.triggerRule.create({
      data: { setupId: setup.id, precedence: 1, name: 'R1', direction: 'BOTH' },
    })
    const sub = await db.subSetup.create({ data: { setupId: setup.id, name: 'Sub A' } })

    const delReq = makeRequest('DELETE', `http://localhost/api/setups/${setup.id}`)
    const res = await DeleteSetup(delReq, ctx({ id: setup.id }))

    expect(res.status).toBe(204)
    expect(await db.setup.findUnique({ where: { id: setup.id } })).toBeNull()
    expect(await db.triggerRule.findUnique({ where: { id: rule.id } })).toBeNull()
    expect(await db.subSetup.findUnique({ where: { id: sub.id } })).toBeNull()
  })
})
