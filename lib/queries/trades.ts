import Decimal from 'decimal.js'
import { db } from '@/lib/db'
import type { TradeFilterInput, CreateTradeInput } from '@/lib/validations/trade'

const TRADE_INCLUDE = {
  setup: true,
  subSetup: true,
  images: true,
  ruleBreak: true,
} as const

export async function getTrades(filters: TradeFilterInput) {
  const { status, setupId, assetClass, direction, page, limit } = filters
  const skip = (page - 1) * limit

  const where = {
    ...(status && { status }),
    ...(setupId && { setupId }),
    ...(assetClass && { assetClass }),
    ...(direction && { direction }),
  }

  const [trades, total] = await Promise.all([
    db.trade.findMany({
      where,
      include: TRADE_INCLUDE,
      orderBy: { tradeDate: 'desc' },
      skip,
      take: limit,
    }),
    db.trade.count({ where }),
  ])

  return { trades, total, page, limit }
}

export async function getTradeById(id: string) {
  return db.trade.findUnique({
    where: { id },
    include: TRADE_INCLUDE,
  })
}

export async function createTrade(input: CreateTradeInput) {
  return db.trade.create({
    data: {
      instrument: input.instrument,
      assetClass: input.assetClass,
      expiry: input.expiry ? new Date(input.expiry) : null,
      setupId: input.setupId,
      subSetupId: input.subSetupId ?? null,
      direction: input.direction,
      entryPrice: input.entryPrice,
      stopLoss: input.stopLoss,
      targets: input.targets,
      quantity: input.quantity,
      riskAmount: input.riskAmount,
      thesis: input.thesis ?? null,
      notes: input.notes ?? null,
      tradeDate: new Date(input.tradeDate),
    },
    include: TRADE_INCLUDE,
  })
}

export async function closeTrade(
  id: string,
  exitPrice: string,
  notes?: string | null
) {
  const trade = await db.trade.findUniqueOrThrow({
    where: { id },
    select: {
      entryPrice: true,
      stopLoss: true,
      quantity: true,
      direction: true,
    },
  })

  const entry = new Decimal(trade.entryPrice.toString())
  const stop = new Decimal(trade.stopLoss.toString())
  const exit = new Decimal(exitPrice)
  const qty = new Decimal(trade.quantity.toString())

  const priceDelta =
    trade.direction === 'LONG'
      ? exit.minus(entry)
      : entry.minus(exit)

  const stopDistance =
    trade.direction === 'LONG'
      ? entry.minus(stop)
      : stop.minus(entry)

  const rMultiple = stopDistance.isZero()
    ? new Decimal(0)
    : priceDelta.div(stopDistance)

  const pnl = priceDelta.times(qty)

  return db.trade.update({
    where: { id },
    data: {
      exitPrice,
      status: 'CLOSED',
      rMultiple: rMultiple.toDecimalPlaces(2).toString(),
      pnl: pnl.toDecimalPlaces(2).toString(),
      ...(notes !== undefined && { notes }),
    },
    include: TRADE_INCLUDE,
  })
}

export async function updateTrade(
  id: string,
  data: Partial<{ notes: string | null; thesis: string | null; status: 'OPEN' | 'CLOSED' | 'SCRATCHED' }>
) {
  return db.trade.update({
    where: { id },
    data,
    include: TRADE_INCLUDE,
  })
}

export async function deleteTrade(id: string) {
  return db.trade.delete({ where: { id } })
}

export async function addChartImage(
  tradeId: string,
  cloudinaryId: string,
  url: string,
  label?: string
) {
  return db.chartImage.create({
    data: { tradeId, cloudinaryId, url, label: label ?? null },
  })
}

export async function deleteChartImage(imageId: string) {
  return db.chartImage.delete({ where: { id: imageId } })
}

export async function getSetups() {
  return db.setup.findMany({ orderBy: { name: 'asc' } })
}

export async function getSubSetupsBySetup(setupId: string) {
  return db.subSetup.findMany({
    where: { setupId },
    orderBy: { name: 'asc' },
  })
}

export async function getDashboardStats() {
  const [openTrades, closedStats, recentTrades] = await Promise.all([
    db.trade.count({ where: { status: 'OPEN' } }),
    db.trade.aggregate({
      where: { status: 'CLOSED' },
      _avg: { rMultiple: true, pnl: true },
      _sum: { pnl: true },
      _count: { id: true },
    }),
    db.trade.findMany({
      where: { status: 'CLOSED', rMultiple: { not: null } },
      select: { rMultiple: true },
    }),
  ])

  const closed = closedStats._count.id
  const wins = recentTrades.filter(
    (t) => new Decimal(t.rMultiple!.toString()).gt(0)
  ).length
  const winRate = closed > 0 ? (wins / closed) * 100 : 0

  return {
    openTrades,
    totalClosed: closed,
    avgRMultiple: closedStats._avg.rMultiple
      ? Number(closedStats._avg.rMultiple.toString())
      : 0,
    totalPnl: closedStats._sum.pnl
      ? Number(closedStats._sum.pnl.toString())
      : 0,
    winRate: Number(winRate.toFixed(1)),
  }
}
