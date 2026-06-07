import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { UpdateTradeSchema } from '@/lib/validations/trade'
import { getTradeById } from '@/lib/queries/trades'
import { db } from '@/lib/db'
import { computeRMultiple, computePnl, computeRuleBreakImpact } from '@/lib/calculations'

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
    direction, entryPrice, stopLoss, targets, quantity, riskAmount,
    thesis, notes, tradeDate,
    exitPrice, status, triggerRules, ruleBreak,
  } = parsed.data

  // Update all entry fields
  const updateData: Parameters<typeof db.trade.update>[0]['data'] = {
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
    ...(status && { status }),
  }

  // Recompute derived values
  if (exitPrice) {
    // New exit price provided: close the trade and compute fresh
    const rMultiple = computeRMultiple(direction, entryPrice, stopLoss, exitPrice)
    const pnl = computePnl(direction, entryPrice, exitPrice, quantity)
    updateData.exitPrice = exitPrice
    updateData.status = 'CLOSED'
    updateData.rMultiple = rMultiple.toDecimalPlaces(2).toString()
    updateData.pnl = pnl.toDecimalPlaces(2).toString()
  } else if (existing.exitPrice) {
    // Trade was already closed — recompute from existing exit with potentially new entry data
    const existingExit = existing.exitPrice.toString()
    const rMultiple = computeRMultiple(direction, entryPrice, stopLoss, existingExit)
    const pnl = computePnl(direction, entryPrice, existingExit, quantity)
    updateData.rMultiple = rMultiple.toDecimalPlaces(2).toString()
    updateData.pnl = pnl.toDecimalPlaces(2).toString()
  }

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
