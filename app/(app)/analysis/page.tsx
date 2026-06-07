import { getAnalysisOptions } from '@/lib/queries/analysisOptions'
import { getTradesForAnalysis, getExecutionPnlSum } from '@/lib/queries/analytics'
import { computeStat, groupBy, cleanVsBroken, equityCurve } from '@/lib/analytics/compute'
import { AnalysisClient } from '@/components/analysis/AnalysisClient'

export default async function AnalysisPage() {
  const [options, trades, executionPnlSum] = await Promise.all([
    getAnalysisOptions(),
    getTradesForAnalysis({}),
    getExecutionPnlSum({}),
  ])

  const initial = {
    overall: computeStat(trades),
    groups: groupBy(trades, 'setup').sort((a, b) => b.stat.totalPnl - a.stat.totalPnl),
    cleanVsBroken: cleanVsBroken(trades),
    equity: equityCurve(trades),
    rValues: trades.map(t => t.rMultiple),
    tradeCount: trades.length,
    executionPnlSum,
  }

  return <AnalysisClient initial={initial} options={options} />
}
