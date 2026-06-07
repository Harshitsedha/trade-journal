export interface TradeForStat {
  id: string
  tradeDate: Date
  direction: 'LONG' | 'SHORT'
  pnl: number
  rMultiple: number
  instrument: string
  setupName: string
  subSetupName: string | null
  tagNames: string[]
  hasRuleBreak: boolean
  ruleBreakPnlImpact?: number
  ruleBreakRImpact?: number
  executionPnl: number | null
  status: string
}

// ── Compute helpers ──────────────────────────────────────────────────────────

export function computeSideCorrect(
  actualDirection: 'LONG' | 'SHORT',
  idealDirection: 'LONG' | 'SHORT' | null | undefined,
): boolean | null {
  if (!idealDirection) return null
  return actualDirection === idealDirection
}

type DecimalLike = { toString(): string } | string | number | null | undefined

export function computeIdealPnl(t: {
  idealEntry?: DecimalLike
  idealExit?: DecimalLike
  idealDirection?: 'LONG' | 'SHORT' | null
  quantity: DecimalLike
}): number | null {
  if (t.idealEntry == null || t.idealExit == null || !t.idealDirection) return null
  const entry = Number(t.idealEntry.toString())
  const exit = Number(t.idealExit.toString())
  const qty = Number((t.quantity ?? 0).toString())
  const diff = t.idealDirection === 'SHORT' ? entry - exit : exit - entry
  return diff * qty
}

export function computeExecutionPnl(
  actualPnl: number,
  idealPnl: number | null,
): number | null {
  if (idealPnl == null) return null
  return actualPnl - idealPnl
}

export interface TradeStat {
  trades: number
  wins: number
  losses: number
  breakeven: number
  winRate: number
  totalPnl: number
  avgPnl: number
  expectancyR: number
  avgWinR: number
  avgLossR: number
  avgWinPnl: number
  avgLossPnl: number
  profitFactor: number
  bestR: number
  worstR: number
  bestPnl: number
  worstPnl: number
  maxWinStreak: number
  maxLossStreak: number
  executionPnlSum: number | null
}

export interface CleanVsBroken {
  clean: TradeStat
  broken: TradeStat
  brokenCostPnl: number
  brokenCostR: number
}

export interface GroupRow {
  key: string
  stat: TradeStat
}

export function computeStat(trades: TradeForStat[]): TradeStat {
  if (trades.length === 0) return emptyStat()

  // executionPnlSum: sum across ALL trades (CLOSED + MISSED), skipping nulls
  const execPnlTrades = trades.filter(t => t.executionPnl != null)
  const executionPnlSum = execPnlTrades.length > 0
    ? execPnlTrades.reduce((sum, t) => sum + t.executionPnl!, 0)
    : null

  // Main P&L / R stats: exclude MISSED (they have pnl=0, no real exit)
  const closedTrades = trades.filter(t => t.status !== 'MISSED')

  const sorted = [...closedTrades].sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime())

  let wins = 0, losses = 0, breakeven = 0
  let grossProfit = 0, grossLoss = 0
  let sumR = 0, sumWinR = 0, sumLossR = 0
  let sumWinPnl = 0, sumLossPnl = 0
  let bestR = -Infinity, worstR = Infinity
  let bestPnl = -Infinity, worstPnl = Infinity

  for (const t of sorted) {
    const pnl = t.pnl
    const r = t.rMultiple
    sumR += r
    bestR = Math.max(bestR, r)
    worstR = Math.min(worstR, r)
    bestPnl = Math.max(bestPnl, pnl)
    worstPnl = Math.min(worstPnl, pnl)
    if (pnl > 0) {
      wins++
      grossProfit += pnl
      sumWinR += r
      sumWinPnl += pnl
    } else if (pnl < 0) {
      losses++
      grossLoss += pnl
      sumLossR += r
      sumLossPnl += pnl
    } else {
      breakeven++
    }
  }

  const tradeable = wins + losses
  const winRate = tradeable > 0 ? wins / tradeable : 0
  const totalPnl = grossProfit + grossLoss
  const n = closedTrades.length

  const profitFactor =
    grossLoss === 0 && grossProfit > 0
      ? Infinity
      : grossLoss === 0
      ? 0
      : grossProfit / Math.abs(grossLoss)

  // Streaks
  let maxWinStreak = 0, maxLossStreak = 0
  let curWin = 0, curLoss = 0
  for (const t of sorted) {
    if (t.pnl > 0) { curWin++; curLoss = 0 }
    else if (t.pnl < 0) { curLoss++; curWin = 0 }
    else { curWin = 0; curLoss = 0 }
    maxWinStreak = Math.max(maxWinStreak, curWin)
    maxLossStreak = Math.max(maxLossStreak, curLoss)
  }

  return {
    trades: n,
    wins,
    losses,
    breakeven,
    winRate,
    totalPnl,
    avgPnl: n > 0 ? totalPnl / n : 0,
    expectancyR: n > 0 ? sumR / n : 0,
    avgWinR: wins > 0 ? sumWinR / wins : 0,
    avgLossR: losses > 0 ? sumLossR / losses : 0,
    avgWinPnl: wins > 0 ? sumWinPnl / wins : 0,
    avgLossPnl: losses > 0 ? sumLossPnl / losses : 0,
    profitFactor,
    bestR: n > 0 ? bestR : 0,
    worstR: n > 0 ? worstR : 0,
    bestPnl: n > 0 ? bestPnl : 0,
    worstPnl: n > 0 ? worstPnl : 0,
    maxWinStreak,
    maxLossStreak,
    executionPnlSum,
  }
}

export function groupBy(
  trades: TradeForStat[],
  dimension: 'side' | 'subSetup' | 'instrument' | 'setup' | 'tag'
): GroupRow[] {
  const map = new Map<string, TradeForStat[]>()

  for (const t of trades) {
    const keys = getKeys(t, dimension)
    for (const key of keys) {
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
  }

  return Array.from(map.entries()).map(([key, ts]) => ({
    key,
    stat: computeStat(ts),
  }))
}

function getKeys(t: TradeForStat, dimension: 'side' | 'subSetup' | 'instrument' | 'setup' | 'tag'): string[] {
  switch (dimension) {
    case 'side': return [t.direction]
    case 'subSetup': return [t.subSetupName ?? '(no sub-setup)']
    case 'instrument': return [t.instrument]
    case 'setup': return [t.setupName]
    case 'tag': return t.tagNames.length > 0 ? t.tagNames : ['(no tag)']
  }
}

export function cleanVsBroken(trades: TradeForStat[]): CleanVsBroken {
  const clean = trades.filter(t => !t.hasRuleBreak)
  const broken = trades.filter(t => t.hasRuleBreak)

  const brokenCostPnl = broken.reduce((sum, t) => sum + (t.ruleBreakPnlImpact ?? 0), 0)
  const brokenCostR = broken.reduce((sum, t) => sum + (t.ruleBreakRImpact ?? 0), 0)

  return {
    clean: computeStat(clean),
    broken: computeStat(broken),
    brokenCostPnl,
    brokenCostR,
  }
}

export function equityCurve(trades: TradeForStat[]): { date: string; cumPnl: number }[] {
  const sorted = [...trades].sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime())
  let cum = 0
  return sorted.map(t => {
    cum += t.pnl
    return { date: t.tradeDate.toISOString().slice(0, 10), cumPnl: cum }
  })
}

function emptyStat(): TradeStat {
  return {
    trades: 0, wins: 0, losses: 0, breakeven: 0,
    winRate: 0, totalPnl: 0, avgPnl: 0,
    expectancyR: 0, avgWinR: 0, avgLossR: 0,
    avgWinPnl: 0, avgLossPnl: 0,
    profitFactor: 0,
    bestR: 0, worstR: 0, bestPnl: 0, worstPnl: 0,
    maxWinStreak: 0, maxLossStreak: 0,
    executionPnlSum: null,
  }
}
