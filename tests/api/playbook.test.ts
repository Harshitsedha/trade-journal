import { vi, describe, it, expect } from 'vitest'
import { db } from '@/lib/db'
import { makeRequest, ctx } from '../helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'test@test.com' } }),
}))

import { POST as PostSetup } from '@/app/api/setups/route'
import { GET as GetById, PATCH as PatchSetup } from '@/app/api/setups/[id]/route'
import { GET as GetTriggerRules, POST as PostTriggerRule } from '@/app/api/setups/[id]/trigger-rules/route'
import { DELETE as DeleteTriggerRule, PATCH as PatchTriggerRule } from '@/app/api/setups/[id]/trigger-rules/[ruleId]/route'
import { GET as GetSubSetups, POST as PostSubSetup } from '@/app/api/setups/[id]/subsetups/route'
import { POST as PostPdf } from '@/app/api/setups/[id]/pdf/route'

describe('Playbook — 3 trigger rules ordered by precedence', () => {
  it('creates 3 rules and GET returns them in precedence order', async () => {
    const setup = await db.setup.create({ data: { name: 'Multi-Rule Setup' } })
    const rules = [
      { precedence: 3, name: 'Volume spike', direction: 'BOTH' as const },
      { precedence: 1, name: 'EMA crossover', direction: 'LONG' as const },
      { precedence: 2, name: 'VWAP reclaim', direction: 'BOTH' as const },
    ]

    for (const rule of rules) {
      const req = makeRequest('POST', `http://localhost/api/setups/${setup.id}/trigger-rules`, rule)
      const res = await PostTriggerRule(req, ctx({ id: setup.id }))
      expect(res.status).toBe(201)
    }

    const req = makeRequest('GET', `http://localhost/api/setups/${setup.id}/trigger-rules`)
    const res = await GetTriggerRules(req, ctx({ id: setup.id }))
    const data = await res.json()

    expect(data).toHaveLength(3)
    expect(data[0].precedence).toBe(1)
    expect(data[0].name).toBe('EMA crossover')
    expect(data[1].precedence).toBe(2)
    expect(data[1].name).toBe('VWAP reclaim')
    expect(data[2].precedence).toBe(3)
    expect(data[2].name).toBe('Volume spike')
  })
})

describe('Playbook — sub-setups', () => {
  it('creates a sub-setup linked to the setup', async () => {
    const setup = await db.setup.create({ data: { name: 'Parent Setup' } })

    const req = makeRequest('POST', `http://localhost/api/setups/${setup.id}/subsetups`, {
      name: 'Intraday Variant',
      description: 'Only during market hours',
    })
    const res = await PostSubSetup(req, ctx({ id: setup.id }))
    expect(res.status).toBe(201)
    const data = await res.json()

    const row = await db.subSetup.findUnique({ where: { id: data.id } })
    expect(row).not.toBeNull()
    expect(row!.setupId).toBe(setup.id)
    expect(row!.name).toBe('Intraday Variant')
  })

  it('GET returns all sub-setups for the setup', async () => {
    const setup = await db.setup.create({ data: { name: 'Sub Setup Parent' } })
    await db.subSetup.createMany({
      data: [
        { setupId: setup.id, name: 'Morning Variant' },
        { setupId: setup.id, name: 'Afternoon Variant' },
      ],
    })

    const req = makeRequest('GET', `http://localhost/api/setups/${setup.id}/subsetups`)
    const res = await GetSubSetups(req, ctx({ id: setup.id }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
  })
})

describe('Playbook — soft delete trigger rule', () => {
  it('soft deletes rule (isActive: false) and GET active rules excludes it', async () => {
    const setup = await db.setup.create({ data: { name: 'Soft Delete Playbook' } })
    const r1 = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 1, name: 'Active', direction: 'BOTH' } })
    const r2 = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 2, name: 'To Delete', direction: 'BOTH' } })

    const req = makeRequest('DELETE', `http://localhost/api/setups/${setup.id}/trigger-rules/${r2.id}`)
    const res = await DeleteTriggerRule(req, ctx({ id: setup.id, ruleId: r2.id }))
    expect(res.status).toBe(200)

    // Still exists in DB
    const row = await db.triggerRule.findUnique({ where: { id: r2.id } })
    expect(row).not.toBeNull()
    expect(row!.isActive).toBe(false)

    // GET active rules does NOT return the deleted rule
    const listReq = makeRequest('GET', `http://localhost/api/setups/${setup.id}/trigger-rules`)
    const listRes = await GetTriggerRules(listReq, ctx({ id: setup.id }))
    const listData = await listRes.json()
    expect(listData).toHaveLength(1)
    expect(listData[0].id).toBe(r1.id)

    // GET all rules (via getSetupById) still includes the inactive one
    const detailReq = makeRequest('GET', `http://localhost/api/setups/${setup.id}`)
    const detailRes = await GetById(detailReq, ctx({ id: setup.id }))
    const detailData = await detailRes.json()
    const allRules = detailData.triggerRules
    expect(allRules).toHaveLength(2)
    expect(allRules.find((r: { id: string }) => r.id === r2.id).isActive).toBe(false)
  })
})

describe('Playbook — strategyType', () => {
  it('creates setup with STANDARD strategyType by default', async () => {
    const req = makeRequest('POST', 'http://localhost/api/setups', { name: 'Standard Setup' })
    const res = await PostSetup(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.strategyType).toBe('STANDARD')

    const row = await db.setup.findUnique({ where: { id: data.id } })
    expect(row!.strategyType).toBe('STANDARD')
  })

  it('creates setup with ORB strategyType when specified', async () => {
    const req = makeRequest('POST', 'http://localhost/api/setups', { name: 'ORB Setup', strategyType: 'ORB' })
    const res = await PostSetup(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.strategyType).toBe('ORB')
  })

  it('updates strategyType via PATCH', async () => {
    const setup = await db.setup.create({ data: { name: 'Patch Type Setup' } })
    expect(setup.strategyType).toBe('STANDARD')

    const req = makeRequest('PATCH', `http://localhost/api/setups/${setup.id}`, { strategyType: 'ORB' })
    const res = await PatchSetup(req, ctx({ id: setup.id }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.strategyType).toBe('ORB')
  })

  it('rejects invalid strategyType with 400', async () => {
    const req = makeRequest('POST', 'http://localhost/api/setups', { name: 'Bad Type', strategyType: 'INVALID' })
    const res = await PostSetup(req)
    expect(res.status).toBe(400)
  })
})

describe('Playbook — orbDirection on trigger rules', () => {
  it('creates trigger rule with orbDirection for ORB setup', async () => {
    const setup = await db.setup.create({ data: { name: 'ORB Trigger Setup', strategyType: 'ORB' } })

    const req = makeRequest('POST', `http://localhost/api/setups/${setup.id}/trigger-rules`, {
      precedence: 1,
      name: 'Opening Break',
      direction: 'BOTH',
      orbDirection: 'ORIGINAL',
    })
    const res = await PostTriggerRule(req, ctx({ id: setup.id }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.orbDirection).toBe('ORIGINAL')
  })

  it('creates trigger rule with ANTI orbDirection', async () => {
    const setup = await db.setup.create({ data: { name: 'ORB Anti Setup', strategyType: 'ORB' } })

    const req = makeRequest('POST', `http://localhost/api/setups/${setup.id}/trigger-rules`, {
      precedence: 1,
      name: 'Fade the Break',
      direction: 'BOTH',
      orbDirection: 'ANTI',
    })
    const res = await PostTriggerRule(req, ctx({ id: setup.id }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.orbDirection).toBe('ANTI')
  })

  it('standard setup trigger rule has null orbDirection', async () => {
    const setup = await db.setup.create({ data: { name: 'Standard Trigger Setup' } })

    const req = makeRequest('POST', `http://localhost/api/setups/${setup.id}/trigger-rules`, {
      precedence: 1,
      name: 'EMA Cross',
      direction: 'LONG',
    })
    const res = await PostTriggerRule(req, ctx({ id: setup.id }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.orbDirection).toBeNull()
  })

  it('updates orbDirection via PATCH on trigger rule', async () => {
    const setup = await db.setup.create({ data: { name: 'ORB Patch Rule Setup', strategyType: 'ORB' } })
    const rule = await db.triggerRule.create({ data: { setupId: setup.id, precedence: 1, name: 'Break Rule', direction: 'BOTH' } })

    const req = makeRequest('PATCH', `http://localhost/api/setups/${setup.id}/trigger-rules/${rule.id}`, {
      orbDirection: 'ANTI',
    })
    const res = await PatchTriggerRule(req, ctx({ id: setup.id, ruleId: rule.id }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.orbDirection).toBe('ANTI')
  })
})

describe('Playbook — PDF upload', () => {
  it('stores pdfUrl and pdfCloudinaryId on the setup', async () => {
    const setup = await db.setup.create({ data: { name: 'PDF Setup' } })

    const req = makeRequest('POST', `http://localhost/api/setups/${setup.id}/pdf`, {
      cloudinaryId: 'trade-journal/playbook/pdfs/test123',
      url: 'https://res.cloudinary.com/demo/raw/upload/trade-journal/playbook/pdfs/test123',
    })
    const res = await PostPdf(req, ctx({ id: setup.id }))
    expect(res.status).toBe(200)

    const row = await db.setup.findUnique({ where: { id: setup.id } })
    expect(row!.pdfCloudinaryId).toBe('trade-journal/playbook/pdfs/test123')
    expect(row!.pdfUrl).toContain('cloudinary.com')
  })

  it('PATCH /api/setups/[id] stores pdfUrl directly', async () => {
    const setup = await db.setup.create({ data: { name: 'PATCH PDF Setup' } })

    const req = makeRequest('PATCH', `http://localhost/api/setups/${setup.id}`, {
      pdfUrl: 'https://example.com/playbook.pdf',
      pdfCloudinaryId: 'some/cloudinary/id',
    })
    const res = await PatchSetup(req, ctx({ id: setup.id }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.pdfUrl).toBe('https://example.com/playbook.pdf')

    const row = await db.setup.findUnique({ where: { id: setup.id } })
    expect(row!.pdfUrl).toBe('https://example.com/playbook.pdf')
  })
})
