import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { CreateTradeSchema, TradeFilterSchema } from '@/lib/validations/trade'
import { createTrade, getTrades } from '@/lib/queries/trades'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = TradeFilterSchema.safeParse(params)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await getTrades(parsed.data)
  return Response.json(result)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateTradeSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { triggerRules, ...tradeData } = parsed.data
  const trade = await createTrade(tradeData)

  if (triggerRules && triggerRules.length > 0) {
    await db.tradeTrigger.createMany({
      data: triggerRules.map(tr => ({
        tradeId: trade.id,
        triggerRuleId: tr.triggerRuleId,
        isPrimary: tr.isPrimary,
      })),
    })
  }

  return Response.json(trade, { status: 201 })
}
