import type { TradeStat, GroupRow, CleanVsBroken } from '@/lib/analytics/compute'
import type { AnalysisOptions } from '@/lib/queries/analysisOptions'

export type { TradeStat, GroupRow, CleanVsBroken, AnalysisOptions }

export interface AnalysisResult {
  overall: TradeStat
  groups: GroupRow[]
  cleanVsBroken: CleanVsBroken
  equity: { date: string; cumPnl: number }[]
  tradeCount: number
}

export type GroupDimension = 'setup' | 'subSetup' | 'instrument' | 'side' | 'tag'

export interface FilterState {
  from: string
  to: string
  side: string
  setupId: string
  subSetupId: string
  instrument: string
  tagId: string
  cleanliness: string
  groupBy: GroupDimension
}
