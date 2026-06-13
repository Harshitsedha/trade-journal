import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { UpdateTradeSchema } from '@/lib/validations/trade'
import { getTradeById } from '@/lib/queries/trades'
import { db } from '@/lib/db'
import { computeRMultiple } from '@/lib/calculations'
import {
  computePnl,
  computeExecutionPnl,
  computeRuleBreakPnlImpact,
  resolvePnlOverride,
  type InstrumentFactor,
} from '@/lib/pnl'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trade = await getTradeById(id)
  if (!trade) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(trade)
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateTradeSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await getTradeById(id)
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const {
    instrument, assetClass, expiry, setupId, subSetupId,
    direction: directionRaw, entryPrice: entryRaw, stopLoss: stopRaw,
    targets: targetsRaw, quantity: qtyRaw, riskAmount: riskRaw,
    thesis, notes, tradeDate,
    exitPrice, status, triggerRules, ruleBreak,
    idealExit, entryRuleCorrect, instrumentId, pnlOverride,
  } = parsed.data

  // MISSED and SKIP are both not-taken trades: actualPnl = 0, executionPnl = 0 - idealPnl.
  const isMissed = status === 'MISSED' || status === 'SKIP'
  const direction = (directionRaw ?? existing.direction) as 'LONG' | 'SHORT'
  const entryPrice = entryRaw ?? existing.entryPrice.toString()
  const stopLoss = stopRaw ?? existing.stopLoss.toString()
  const targets = targetsRaw?.length ? targetsRaw : (existing.targets as { toString(): string }[]).map(t => t.toString())
  const quantity = qtyRaw ?? existing.quantity.toString()
  const riskAmount = riskRaw ?? existing.riskAmount.toString()

  // Resolve the linked instrument (carries the PnL factor). Use the incoming
  // instrumentId when provided, else keep the trade's existing link. Unlinked ⇒
  // null ⇒ factor-1 fallback inside lib/pnl.
  const resolvedInstrumentId = instrumentId !== undefined
    ? (instrumentId ?? null)
    : ((existing as { instrumentId?: string | null }).instrumentId ?? null)
  const instrumentFactor: InstrumentFactor | null = resolvedInstrumentId
    ? await db.instrument.findUnique({
        where: { id: resolvedInstrumentId },
        select: { factor: true, factorOp: true },
      })
    : null

  // Resolve idealExit
  const resolvedIdealExit = idealExit !== undefined
    ? (idealExit ?? null)
    : (existing as Record<string, unknown>).idealExit as string | null | undefined ?? null

  // Sticky pnlOverride: absent from the body ⇒ keep the existing hand-entered
  // value; null ⇒ clear to calculated; number ⇒ set. An edit that doesn't touch
  // the override must never wipe it.
  const resolvedPnlOverride = resolvePnlOverride(
    pnlOverride,
    (existing as { pnlOverride?: number | null }).pnlOverride ?? null,
  )

  const updateData: Parameters<typeof db.trade.update>[0]['data'] = {
    instrument: instrument ? instrument.toUpperCase().trim() : existing.instrument,
    assetClass: assetClass ?? existing.assetClass,
    expiry: expiry !== undefined ? (expiry ? new Date(expiry) : null) : existing.expiry,
    setupId: setupId ?? existing.setupId,
    subSetupId: subSetupId !== undefined ? (subSetupId ?? null) : existing.subSetupId,
    direction,
    entryPrice,
    stopLoss,
    targets,
    quantity,
    riskAmount,
    thesis: thesis !== undefined ? (thesis ?? null) : existing.thesis,
    notes: notes !== undefined ? (notes ?? null) : existing.notes,
    tradeDate: tradeDate ? new Date(tradeDate) : existing.tradeDate,
    idealExit: resolvedIdealExit,
    instrumentId: resolvedInstrumentId,
    pnlOverride: resolvedPnlOverride,
    ...(entryRuleCorrect !== undefined && { entryRuleCorrect }),
    ...(status && { status }),
  }

  // Recompute pnl (factor-scaled) / rMultiple (never scaled). rMultiple stays in
  // calculations.ts; pnl goes through lib/pnl so the instrument factor is applied.
  // Track the actual exit used so executionPnl recomputes its UNSCALED base below.
  let resolvedActualExit: string | null = null
  if (exitPrice) {
    const rMultiple = computeRMultiple(direction, entryPrice, stopLoss, exitPrice)
    // pnl: override value when set, else base × instrument factor.
    const pnl = computePnl(instrumentFactor, { direction, entryPrice, exitPrice, quantity }, resolvedPnlOverride)
    updateData.exitPrice = exitPrice
    updateData.status = 'CLOSED'
    updateData.rMultiple = rMultiple.toDecimalPlaces(2).toString()
    updateData.pnl = pnl.toDecimalPlaces(2).toString()
    resolvedActualExit = exitPrice
  } else if (isMissed) {
    // Not-taken (MISSED/SKIP): override wins if set, else zero the realized pnl.
    updateData.pnl = resolvedPnlOverride != null ? String(resolvedPnlOverride) : '0'
  } else if (existing.exitPrice) {
    const existingExit = existing.exitPrice.toString()
    const rMultiple = computeRMultiple(direction, entryPrice, stopLoss, existingExit)
    const pnl = computePnl(instrumentFactor, { direction, entryPrice, exitPrice: existingExit, quantity }, resolvedPnlOverride)
    updateData.rMultiple = rMultiple.toDecimalPlaces(2).toString()
    updateData.pnl = pnl.toDecimalPlaces(2).toString()
    resolvedActualExit = existingExit
  } else if (resolvedPnlOverride != null) {
    // OPEN with a manual override and no exit: store the hand-entered pnl directly.
    updateData.pnl = String(resolvedPnlOverride)
  }

  // executionPnl: always stored; scaled by the implied (override) or instrument
  // factor, computed from its own UNSCALED base — never from the scaled pnl above.
  updateData.executionPnl = String(
    computeExecutionPnl(instrumentFactor, {
      direction,
      entryPrice,
      idealExit: resolvedIdealExit,
      quantity,
      exitPrice: resolvedActualExit,
      notTaken: isMissed,
    }, resolvedPnlOverride),
  )

  await db.trade.update({ where: { id }, data: updateData })

  // Handle ruleBreak (upsert: wipe old, write new)
  if (ruleBreak && (exitPrice || existing.exitPrice)) {
    const { breakType, ruleDescription, actualExitPrice, ruleExitPrice, notes: rbNotes } = ruleBreak
    let pnlImpact = '0'
    let rMultipleImpact = '0'
    if (ruleExitPrice) {
      // pnlImpact is factor-scaled (currency); rMultipleImpact is returned UNSCALED.
      const impact = computeRuleBreakPnlImpact(instrumentFactor, {
        direction,
        entryPrice,
        stopLoss,
        actualExitPrice,
        ruleExitPrice,
        quantity,
      }, resolvedPnlOverride, resolvedActualExit)
      pnlImpact = impact.pnlImpact.toDecimalPlaces(2).toString()
      rMultipleImpact = impact.rMultipleImpact.toDecimalPlaces(2).toString()
    }
    await db.ruleBreak.deleteMany({ where: { tradeId: id } })
    await db.ruleBreak.create({
      data: {
        tradeId: id,
        breakType,
        ruleDescription,
        actualExitPrice,
        ruleExitPrice: ruleExitPrice ?? null,
        pnlImpact,
        rMultipleImpact,
        notes: rbNotes ?? null,
      },
    })
  }

  // Re-sync trigger rules
  if (triggerRules !== undefined) {
    await db.tradeTrigger.deleteMany({ where: { tradeId: id } })
    if (triggerRules.length > 0) {
      await db.tradeTrigger.createMany({
        data: triggerRules.map(tr => ({
          tradeId: id,
          triggerRuleId: tr.triggerRuleId,
          isPrimary: tr.isPrimary,
        })),
      })
    }
  }

  return Response.json(await getTradeById(id))
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getTradeById(id)
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  await db.tradeTrigger.deleteMany({ where: { tradeId: id } })
  await db.trade.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
