import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { CreateTradeSchema, TradeFilterSchema } from '@/lib/validations/trade'
import { getTrades } from '@/lib/queries/trades'
import { db } from '@/lib/db'
import { computeRMultiple, computePnl } from '@/lib/calculations'
import { computeSideCorrect, computeIdealPnl, computeExecutionPnl } from '@/lib/analytics/compute'

const TRADE_INCLUDE = {
  setup: true,
  subSetup: true,
  images: true,
  ruleBreak: true,
  triggerRules: { include: { triggerRule: true } },
} as const

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

  const {
    instrument, assetClass, expiry, setupId, subSetupId,
    direction: directionRaw, entryPrice: entryRaw, stopLoss: stopRaw,
    targets: targetsRaw, quantity: qtyRaw, riskAmount: riskRaw,
    thesis, notes, tradeDate, triggerRules, status,
    idealEntry, idealStop, idealExit, idealDirection,
  } = parsed.data

  const isMissed = status === 'MISSED'
  const direction = (directionRaw ?? (idealDirection ?? 'LONG')) as 'LONG' | 'SHORT'
  const entryPrice = entryRaw ?? '0'
  const stopLoss = stopRaw ?? '0'
  const targets = targetsRaw?.length ? targetsRaw : ['0']
  const quantity = qtyRaw ?? '0'
  const riskAmount = riskRaw ?? '0'

  const sideCorrect = computeSideCorrect(direction, idealDirection ?? null)
  const idealPnl = computeIdealPnl({
    idealEntry: idealEntry ?? null,
    idealExit: idealExit ?? null,
    idealDirection: idealDirection ?? null,
    quantity,
  })

  // For MISSED: actualPnl = 0 by definition
  const executionPnlVal = isMissed ? computeExecutionPnl(0, idealPnl) : null

  const tradeData: Record<string, unknown> = {
    instrument: instrument.toUpperCase().trim(),
    assetClass,
    expiry: expiry ? new Date(expiry) : null,
    setupId,
    subSetupId: subSetupId ?? null,
    direction,
    entryPrice,
    stopLoss,
    targets,
    quantity,
    riskAmount,
    thesis: thesis ?? null,
    notes: notes ?? null,
    tradeDate: new Date(tradeDate),
    status: status ?? 'OPEN',
    idealEntry: idealEntry ?? null,
    idealStop: idealStop ?? null,
    idealExit: idealExit ?? null,
    idealDirection: idealDirection ?? null,
    sideCorrect,
    executionPnl: executionPnlVal !== null ? String(executionPnlVal) : null,
  }

  if (isMissed) {
    tradeData.pnl = '0'
  }

  const trade = await db.trade.create({
    data: tradeData as Parameters<typeof db.trade.create>[0]['data'],
    include: TRADE_INCLUDE,
  })

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
