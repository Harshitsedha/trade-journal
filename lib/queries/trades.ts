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
  // Execution drag also folds in MISSED trades (actual 0, but full ideal missed).
  const [openTrades, closed, execTrades] = await Promise.all([
    db.trade.count({ where: { status: 'OPEN' } }),
    db.trade.findMany({
      where: { status: 'CLOSED', pnl: { not: null }, rMultiple: { not: null } },
      select: {
        pnl: true,
        rMultiple: true,
        instrumentRef: { select: { currency: true } },
      },
    }),
    db.trade.findMany({
      where: { status: { in: ['CLOSED', 'MISSED'] }, executionPnl: { not: null } },
      select: {
        executionPnl: true,
        instrumentRef: { select: { currency: true } },
      },
    }),
  ])

  const groups = new Map<string, { pnl: number; r: number; wins: number; n: number; drag: number }>()
  const get = (ccy: string) => {
    const g = groups.get(ccy) ?? { pnl: 0, r: 0, wins: 0, n: 0, drag: 0 }
    groups.set(ccy, g)
    return g
  }
  for (const t of closed) {
    const ccy = isCurrencyCode(t.instrumentRef?.currency) ? t.instrumentRef!.currency : DEFAULT_CURRENCY
    const g = get(ccy)
    g.pnl += Number(t.pnl!.toString())
    g.r += Number(t.rMultiple!.toString())
    g.n += 1
    if (Number(t.rMultiple!.toString()) > 0) g.wins += 1
  }
  for (const t of execTrades) {
    const ccy = isCurrencyCode(t.instrumentRef?.currency) ? t.instrumentRef!.currency : DEFAULT_CURRENCY
    get(ccy).drag += Number(t.executionPnl!.toString())
  }

  const byCurrency = Array.from(groups.entries())
    .map(([currency, g]) => ({
      currency,
      totalClosed: g.n,
      totalPnl: g.pnl,
      executionDrag: g.drag,
      winRate: g.n > 0 ? Number(((g.wins / g.n) * 100).toFixed(1)) : 0,
      avgRMultiple: g.n > 0 ? g.r / g.n : 0,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency))

  return { openTrades, byCurrency }
}

/**
 * Per-currency dual equity series for the dashboard chart. Trades are ordered
 * chronologically (CLOSED + MISSED). For each point:
 *   actual = cumulative pnl (MISSED contribute 0)
 *   ideal  = cumulative idealPnl, where idealPnl = pnl − executionPnl
 *            (executionPnl = actual − ideal). When no idealExit is recorded
 *            executionPnl is null ⇒ ideal tracks actual (no divergence).
 * The gap between the two lines is "execution drag". Never blends currencies.
 */
export async function getDashboardEquity() {
  const trades = await db.trade.findMany({
    where: { status: { in: ['CLOSED', 'MISSED'] } },
    select: {
      pnl: true,
      executionPnl: true,
      tradeDate: true,
      instrumentRef: { select: { currency: true } },
    },
    orderBy: { tradeDate: 'asc' },
  })

  const series = new Map<string, { date: string; actual: number; ideal: number }[]>()
  const cum = new Map<string, { actual: number; ideal: number }>()

  for (const t of trades) {
    const ccy = isCurrencyCode(t.instrumentRef?.currency) ? t.instrumentRef!.currency : DEFAULT_CURRENCY
    const actual = t.pnl != null ? Number(t.pnl.toString()) : 0
    const exec = t.executionPnl != null ? Number(t.executionPnl.toString()) : 0
    const ideal = actual - exec

    const c = cum.get(ccy) ?? { actual: 0, ideal: 0 }
    c.actual += actual
    c.ideal += ideal
    cum.set(ccy, c)

    if (!series.has(ccy)) series.set(ccy, [])
    series.get(ccy)!.push({
      date: t.tradeDate.toISOString().slice(0, 10),
      actual: c.actual,
      ideal: c.ideal,
    })
  }

  return Array.from(series.entries())
    .map(([currency, points]) => ({ currency, points }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}
