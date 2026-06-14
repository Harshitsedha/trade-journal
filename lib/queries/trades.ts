import { db } from '@/lib/db'
import { isCurrencyCode, DEFAULT_CURRENCY } from '@/lib/currency'
import type { TradeFilterInput } from '@/lib/validations/trade'

const TRADE_INCLUDE = {
  setup: true,
  subSetup: true,
  images: true,
  ruleBreak: true,
  triggerRules: { include: { triggerRule: true } },
  instrumentRef: { select: { symbol: true, currency: true } },
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
  // Closed trades carry their currency via the linked instrument. We group in JS
  // so the P&L is summed PER CURRENCY — never a single blended USD+INR number.
  const [openTrades, closed] = await Promise.all([
    db.trade.count({ where: { status: 'OPEN' } }),
    db.trade.findMany({
      where: { status: 'CLOSED', pnl: { not: null }, rMultiple: { not: null } },
      select: {
        pnl: true,
        rMultiple: true,
        instrumentRef: { select: { currency: true } },
      },
    }),
  ])

  const groups = new Map<string, { pnl: number; r: number; wins: number; n: number }>()
  for (const t of closed) {
    const ccy = isCurrencyCode(t.instrumentRef?.currency) ? t.instrumentRef!.currency : DEFAULT_CURRENCY
    const g = groups.get(ccy) ?? { pnl: 0, r: 0, wins: 0, n: 0 }
    const pnl = Number(t.pnl!.toString())
    const r = Number(t.rMultiple!.toString())
    g.pnl += pnl
    g.r += r
    g.n += 1
    if (r > 0) g.wins += 1
    groups.set(ccy, g)
  }

  const byCurrency = Array.from(groups.entries())
    .map(([currency, g]) => ({
      currency,
      totalClosed: g.n,
      totalPnl: g.pnl,
      winRate: g.n > 0 ? Number(((g.wins / g.n) * 100).toFixed(1)) : 0,
      avgRMultiple: g.n > 0 ? g.r / g.n : 0,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency))

  return { openTrades, byCurrency }
}
