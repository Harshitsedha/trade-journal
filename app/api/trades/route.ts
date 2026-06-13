import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/prisma/client'
import { auth } from '@/auth'
import { CreateTradeSchema, TradeFilterSchema } from '@/lib/validations/trade'
import { getTrades } from '@/lib/queries/trades'
import { db } from '@/lib/db'
import { computeExecutionPnl, type InstrumentFactor } from '@/lib/pnl'

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
    idealExit, clientRequestId, instrumentId,
  } = parsed.data

  // MISSED and SKIP are both not-taken trades: actualPnl = 0, executionPnl = 0 - idealPnl.
  const isMissed = status === 'MISSED' || status === 'SKIP'
  const direction = (directionRaw ?? 'LONG') as 'LONG' | 'SHORT'
  const entryPrice = entryRaw ?? '0'
  const stopLoss = stopRaw ?? '0'
  const targets = targetsRaw?.length ? targetsRaw : ['0']
  const quantity = qtyRaw ?? '0'
  const riskAmount = riskRaw ?? '0'

  // Linked instrument carries the PnL factor; unlinked ⇒ null ⇒ factor-1 fallback.
  const instrumentFactor: InstrumentFactor | null = instrumentId
    ? await db.instrument.findUnique({
        where: { id: instrumentId },
        select: { factor: true, factorOp: true },
      })
    : null

  // executionPnl: always stored, factor-scaled. A new trade has no exit yet, so
  // OPEN ⇒ 0; MISSED/SKIP ⇒ (0 − idealPnl) × factor.
  const executionPnlVal = computeExecutionPnl(instrumentFactor, {
    direction,
    entryPrice,
    idealExit: idealExit ?? null,
    quantity,
    exitPrice: null,
    notTaken: isMissed,
  })

  const tradeData: Record<string, unknown> = {
    clientRequestId: clientRequestId ?? null,
    instrument: instrument.toUpperCase().trim(),
    instrumentId: instrumentId ?? null,
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
    idealExit: idealExit ?? null,
    executionPnl: String(executionPnlVal),
  }

  if (isMissed) {
    tradeData.pnl = '0'
  }

  // Idempotency is keyed on clientRequestId only (see the P2002 catch below).
  // That collapses a true retry of the SAME submit while still allowing
  // genuinely distinct trades — including intentional identical scale-ins at the
  // same levels seconds apart — because each real submit carries its own id.
  // No content/time-window matching: it can't tell a real scale-in from an
  // accidental double-click and would silently swallow legitimate trades.
  let trade
  try {
    trade = await db.trade.create({
      data: tradeData as Parameters<typeof db.trade.create>[0]['data'],
      include: TRADE_INCLUDE,
    })
  } catch (err) {
    // Idempotency: a double-submit reuses the same clientRequestId and collides
    // on the unique index (P2002). Return the row the first request created
    // instead of inserting a duplicate.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      clientRequestId
    ) {
      const existing = await db.trade.findUnique({
        where: { clientRequestId },
        include: TRADE_INCLUDE,
      })
      if (existing) return Response.json(existing, { status: 200 })
    }
    throw err
  }

  if (triggerRules && triggerRules.length > 0) {
    await db.tradeTrigger.createMany({
      data: triggerRules.map(tr => ({
        tradeId: trade.id,
        triggerRuleId: tr.triggerRuleId,
        isPrimary: tr.isPrimary,
      })),
    })
  }

  // Keep server-rendered lists fresh without a client-side router.refresh()
  // (which raced navigation). Safe to call after the write.
  revalidatePath('/dashboard')
  revalidatePath('/trades')

  return Response.json(trade, { status: 201 })
}
