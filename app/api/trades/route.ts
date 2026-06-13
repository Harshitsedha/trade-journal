import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/prisma/client'
import { auth } from '@/auth'
import { CreateTradeSchema, TradeFilterSchema } from '@/lib/validations/trade'
import { getTrades } from '@/lib/queries/trades'
import { db } from '@/lib/db'
import { computeRMultiple, computePnl } from '@/lib/calculations'
import { computeIdealPnl, computeExecutionPnl } from '@/lib/analytics/compute'

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
    idealExit, clientRequestId,
  } = parsed.data

  // MISSED and SKIP are both not-taken trades: actualPnl = 0, executionPnl = 0 - idealPnl.
  const isMissed = status === 'MISSED' || status === 'SKIP'
  const direction = (directionRaw ?? 'LONG') as 'LONG' | 'SHORT'
  const entryPrice = entryRaw ?? '0'
  const stopLoss = stopRaw ?? '0'
  const targets = targetsRaw?.length ? targetsRaw : ['0']
  const quantity = qtyRaw ?? '0'
  const riskAmount = riskRaw ?? '0'

  // executionPnl: always stored (0 when no idealExit)
  const idealPnl = computeIdealPnl({
    entryPrice,
    idealExit: idealExit ?? null,
    direction,
    quantity: Number(quantity),
  })
  const actualPnl = isMissed ? 0 : null
  const executionPnlVal = actualPnl !== null
    ? computeExecutionPnl(actualPnl, idealPnl)
    : 0  // OPEN trade, no exit yet

  const tradeData: Record<string, unknown> = {
    clientRequestId: clientRequestId ?? null,
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
    idealExit: idealExit ?? null,
    executionPnl: String(executionPnlVal),
  }

  if (isMissed) {
    tradeData.pnl = '0'
  }

  // ── Idempotency backstop (content-based) ────────────────────────────────────
  // The decisive guard. It does NOT depend on the client behaving: if an
  // identical trade was created in the last 10 seconds — same setup, instrument,
  // direction, entry, stop, quantity and status — we treat this POST as a repeat
  // of that submit and return the existing row instead of inserting a duplicate.
  // This survives form re-mounts, a rotated clientRequestId, double-clicks, retries
  // — anything the browser throws at us. A human cannot log two genuinely distinct
  // trades with byte-identical sizing within 10s, so false positives are not real.
  const recentDuplicate = await db.trade.findFirst({
    where: {
      setupId,
      instrument: tradeData.instrument as string,
      direction,
      entryPrice,
      stopLoss,
      quantity,
      status: status ?? 'OPEN',
      createdAt: { gte: new Date(Date.now() - 10_000) },
    },
    orderBy: { createdAt: 'desc' },
    include: TRADE_INCLUDE,
  })
  if (recentDuplicate) {
    return Response.json(recentDuplicate, { status: 200 })
  }

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
