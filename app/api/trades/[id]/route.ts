import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { UpdateTradeSchema } from '@/lib/validations/trade'
import {
  getTradeById,
  closeTrade,
  updateTrade,
  deleteTrade,
} from '@/lib/queries/trades'
import { db } from '@/lib/db'
import { computeRuleBreakImpact } from '@/lib/calculations'

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

  const { exitPrice, status, notes, thesis, triggerRules, ruleBreak } = parsed.data

  // exitPrice always triggers closeTrade which recomputes rMultiple/pnl regardless of current status
  let trade
  if (exitPrice) {
    trade = await closeTrade(id, exitPrice, notes)
  } else {
    trade = await updateTrade(id, {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(thesis !== undefined && { thesis }),
    })
  }

  if (ruleBreak && exitPrice) {
    const { breakType, ruleDescription, actualExitPrice, ruleExitPrice, notes: rbNotes } = ruleBreak

    let pnlImpact = '0'
    let rMultipleImpact = '0'

    if (ruleExitPrice) {
      const impact = computeRuleBreakImpact({
        direction: existing.direction,
        entryPrice: existing.entryPrice,
        stopLoss: existing.stopLoss,
        actualExitPrice,
        ruleExitPrice,
        quantity: existing.quantity,
      })
      pnlImpact = impact.pnlImpact.toDecimalPlaces(2).toString()
      rMultipleImpact = impact.rMultipleImpact.toDecimalPlaces(2).toString()
    }

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

    trade = await getTradeById(id)
  }

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
    trade = await getTradeById(id)
  }

  return Response.json(trade)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getTradeById(id)
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  await deleteTrade(id)
  return new Response(null, { status: 204 })
}
