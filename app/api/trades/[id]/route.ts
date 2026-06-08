import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { UpdateTradeSchema } from '@/lib/validations/trade'
import { getTradeById } from '@/lib/queries/trades'
import { db } from '@/lib/db'
import { computeRMultiple, computePnl, computeRuleBreakImpact } from '@/lib/calculations'
import { computeIdealPnl, computeExecutionPnl } from '@/lib/analytics/compute'

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
    idealExit, entryRuleCorrect,
  } = parsed.data

  const isMissed = status === 'MISSED'
  const direction = (directionRaw ?? existing.direction) as 'LONG' | 'SHORT'
  const entryPrice = entryRaw ?? existing.entryPrice.toString()
  const stopLoss = stopRaw ?? existing.stopLoss.toString()
  const targets = targetsRaw?.length ? targetsRaw : (existing.targets as { toString(): string }[]).map(t => t.toString())
  const quantity = qtyRaw ?? existing.quantity.toString()
  const riskAmount = riskRaw ?? existing.riskAmount.toString()

  // Resolve idealExit
  const resolvedIdealExit = idealExit !== undefined
    ? (idealExit ?? null)
    : (existing as Record<string, unknown>).idealExit as string | null | undefined ?? null

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
    ...(entryRuleCorrect !== undefined && { entryRuleCorrect }),
    ...(status && { status }),
  }

  // Recompute pnl / rMultiple
  if (exitPrice) {
    const rMultiple = computeRMultiple(direction, entryPrice, stopLoss, exitPrice)
    const pnl = computePnl(direction, entryPrice, exitPrice, quantity)
    updateData.exitPrice = exitPrice
    updateData.status = 'CLOSED'
    updateData.rMultiple = rMultiple.toDecimalPlaces(2).toString()
    updateData.pnl = pnl.toDecimalPlaces(2).toString()
  } else if (existing.exitPrice) {
    const existingExit = existing.exitPrice.toString()
    const rMultiple = computeRMultiple(direction, entryPrice, stopLoss, existingExit)
    const pnl = computePnl(direction, entryPrice, existingExit, quantity)
    updateData.rMultiple = rMultiple.toDecimalPlaces(2).toString()
    updateData.pnl = pnl.toDecimalPlaces(2).toString()
  } else if (isMissed) {
    updateData.pnl = '0'
  }

  // executionPnl: always stored; 0 when no idealExit
  const idealPnl = computeIdealPnl({
    entryPrice,
    idealExit: resolvedIdealExit,
    direction,
    quantity: Number(quantity),
  })
  const resolvedActualPnl = isMissed ? 0
    : (updateData.pnl != null ? Number(String(updateData.pnl))
      : (existing.pnl != null ? Number(existing.pnl.toString()) : null))
  const execPnl = resolvedActualPnl !== null
    ? computeExecutionPnl(resolvedActualPnl, idealPnl)
    : 0  // OPEN trade with no exit yet
  updateData.executionPnl = String(execPnl)

  await db.trade.update({ where: { id }, data: updateData })

  // Handle ruleBreak (upsert: wipe old, write new)
  if (ruleBreak && (exitPrice || existing.exitPrice)) {
    const { breakType, ruleDescription, actualExitPrice, ruleExitPrice, notes: rbNotes } = ruleBreak
    let pnlImpact = '0'
    let rMultipleImpact = '0'
    if (ruleExitPrice) {
      const impact = computeRuleBreakImpact({
        direction,
        entryPrice,
        stopLoss,
        actualExitPrice,
        ruleExitPrice,
        quantity,
      })
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
