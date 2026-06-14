import type { TradeStat, GroupRow, CleanVsBroken } from '@/lib/analytics/compute'
import type { AnalysisOptions } from '@/lib/queries/analysisOptions'

export type { TradeStat, GroupRow, CleanVsBroken, AnalysisOptions }

export interface AnalysisResult {
  overall: TradeStat
  groups: GroupRow[]
  cleanVsBroken: CleanVsBroken
  equity: { date: string; cumPnl: number }[]
  tradeCount: number
  executionPnlSum?: number | null
  currency?: string | null // active single-currency scope
}

export type GroupDimension = 'setup' | 'subSetup' | 'instrument' | 'side' | 'tag' | 'quality'

// '' = all, else one of the 3-way quality slugs.
export type QualityFilterValue = '' | 'rule_followed' | 'rule_broken' | 'missed'

export interface FilterState {
  from: string
  to: string
  side: string
  setupId: string
  subSetupId: string
  instrument: string
  tagId: string
  quality: QualityFilterValue
  currency: string
  groupBy: GroupDimension
}
