export interface TradeForStat {
  id: string
  tradeDate: Date
  direction: 'LONG' | 'SHORT'
  pnl: number
  rMultiple: number
  instrument: string
  currency: string
  setupName: string
  subSetupName: string | null
  tagNames: string[]
  hasRuleBreak: boolean
  ruleBreakPnlImpact?: number
  ruleBreakRImpact?: number
  executionPnl: number | null
  status: string
  entryRuleCorrect?: boolean | null
}

export type GroupDimension = 'setup' | 'subSetup' | 'instrument' | 'side' | 'tag' | 'quality'

// ── Trade quality (the real 3-way axis) ──────────────────────────────────────
// Derived ONLY from status + entryRuleCorrect — there is no "clean/broken" tag.
// A null entryRuleCorrect on a taken trade counts as Rule Broken (unrated → broken).
export type TradeQuality = 'TAKEN_RULE_FOLLOWED' | 'TAKEN_RULE_BROKEN' | 'MISSED'

export const QUALITY_ORDER: TradeQuality[] = [
  'TAKEN_RULE_FOLLOWED',
  'TAKEN_RULE_BROKEN',
  'MISSED',
]

export const QUALITY_LABELS: Record<TradeQuality, string> = {
  TAKEN_RULE_FOLLOWED: 'Rule Followed',
  TAKEN_RULE_BROKEN: 'Rule Broken',
  MISSED: 'Missed',
}

export function tradeQuality(t: {
  status: string
  entryRuleCorrect?: boolean | null
}): TradeQuality {
  if (t.status === 'MISSED') return 'MISSED'
  return t.entryRuleCorrect ? 'TAKEN_RULE_FOLLOWED' : 'TAKEN_RULE_BROKEN'
}

// ── Compute helpers ──────────────────────────────────────────────────────────

export function computeSideCorrect(
  actualDirection: 'LONG' | 'SHORT',
  primaryRuleDirection: 'LONG' | 'SHORT' | 'BOTH' | null | undefined,
): boolean | null {
  if (!primaryRuleDirection || primaryRuleDirection === 'BOTH') return null
  return actualDirection === primaryRuleDirection
}

type DecimalLike = { toString(): string } | string | number | null | undefined

export function computeIdealPnl(t: {
  entryPrice?: DecimalLike
  idealExit?: DecimalLike
  direction?: 'LONG' | 'SHORT' | null
  quantity: number
}): number | null {
  if (t.entryPrice == null || t.idealExit == null || !t.direction) return null
  const diff = t.direction === 'SHORT'
    ? Number(t.entryPrice) - Number(t.idealExit)
    : Number(t.idealExit) - Number(t.entryPrice)
  return diff * t.quantity
}

export function computeExecutionPnl(
  actualPnl: number,
  idealPnl: number | null,
): number {
  if (idealPnl == null) return 0
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

  // executionPnlSum: sum across all trades (executionPnl defaults to 0 when no idealExit)
  const execPnlTrades = trades.filter(t => t.executionPnl != null)
  const executionPnlSum = execPnlTrades.length > 0
    ? execPnlTrades.reduce((sum, t) => sum + t.executionPnl!, 0)
    : null

  // Main P&L / R stats: exclude MISSED and SKIP (they have pnl=0, no real exit)
  const closedTrades = trades.filter(t => t.status !== 'MISSED' && t.status !== 'SKIP')

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

/**
 * Group trades by the 3-way quality axis. MISSED trades are never "taken", so
 * their win-rate is N/A (winRate = NaN) and they contribute no closed P&L — but
 * their count and executionPnl are surfaced (the whole point of tracking misses).
 * Returns groups in a fixed order (Followed, Broken, Missed); empty buckets drop.
 */
export function groupByQuality(trades: TradeForStat[]): GroupRow[] {
  const buckets: Record<TradeQuality, TradeForStat[]> = {
    TAKEN_RULE_FOLLOWED: [],
    TAKEN_RULE_BROKEN: [],
    MISSED: [],
  }
  for (const t of trades) buckets[tradeQuality(t)].push(t)

  const rows: GroupRow[] = []
  for (const q of QUALITY_ORDER) {
    const ts = buckets[q]
    if (ts.length === 0) continue
    const stat = computeStat(ts)
    if (q === 'MISSED') {
      // computeStat excludes MISSED from closed-stats → trades/winRate are 0.
      // Override count to the real number of misses and mark win-rate N/A.
      rows.push({ key: QUALITY_LABELS[q], stat: { ...stat, trades: ts.length, winRate: NaN } })
    } else {
      rows.push({ key: QUALITY_LABELS[q], stat })
    }
  }
  return rows
}

/**
 * Assemble the full analysis payload from a trade list that may include MISSED
 * trades. Non-quality groupings, the equity curve, the R distribution and the
 * rule-break cost card are computed from CLOSED trades only (unchanged), while
 * the overall stat's executionPnlSum and the quality grouping include MISSED.
 */
export function assembleAnalysis(trades: TradeForStat[], dimension: GroupDimension) {
  const closed = trades.filter(t => t.status === 'CLOSED')
  const overall = computeStat(trades) // executionPnlSum spans CLOSED + MISSED
  const groups =
    dimension === 'quality'
      ? groupByQuality(trades)
      : groupBy(closed, dimension).sort((a, b) => b.stat.totalPnl - a.stat.totalPnl)

  return {
    overall,
    groups,
    cleanVsBroken: cleanVsBroken(closed),
    equity: equityCurve(closed),
    rValues: closed.map(t => t.rMultiple),
    tradeCount: closed.length,
    executionPnlSum: overall.executionPnlSum,
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
