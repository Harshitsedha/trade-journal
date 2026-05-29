import { NextRequest } from 'next/server'
import Decimal from 'decimal.js'
import { auth } from '@/lib/auth'
import { UpdateTradeSchema } from '@/lib/validations/trade'
import {
  getTradeById,
  closeTrade,
  updateTrade,
  deleteTrade,
} from '@/lib/queries/trades'
import { db } from '@/lib/db'

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

    const entry = new Decimal(existing.entryPrice.toString())
    const stop = new Decimal(existing.stopLoss.toString())
    const actual = new Decimal(actualExitPrice)
    const ruleExit = ruleExitPrice ? new Decimal(ruleExitPrice) : null
    const qty = new Decimal(existing.quantity.toString())

    const stopDistance =
      existing.direction === 'LONG'
        ? entry.minus(stop)
        : stop.minus(entry)

    let pnlImpact = new Decimal(0)
    let rMultipleImpact = new Decimal(0)

    if (ruleExit) {
      const priceDelta =
        existing.direction === 'LONG'
          ? ruleExit.minus(actual)
          : actual.minus(ruleExit)

      pnlImpact = priceDelta.times(qty)
      rMultipleImpact = stopDistance.isZero()
        ? new Decimal(0)
        : priceDelta.div(stopDistance)
    }

    await db.ruleBreak.create({
      data: {
        tradeId: id,
        breakType,
        ruleDescription,
        actualExitPrice,
        ruleExitPrice: ruleExitPrice ?? null,
        pnlImpact: pnlImpact.toDecimalPlaces(2).toString(),
        rMultipleImpact: rMultipleImpact.toDecimalPlaces(2).toString(),
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
