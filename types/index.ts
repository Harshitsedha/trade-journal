import type {
  Trade,
  Setup,
  SubSetup,
  ChartImage,
  RuleBreak,
  AssetClass,
  Direction,
  TradeStatus,
  RuleBreakType,
} from '../generated/prisma/client'

export type {
  Trade,
  Setup,
  SubSetup,
  ChartImage,
  RuleBreak,
  AssetClass,
  Direction,
  TradeStatus,
  RuleBreakType,
}

export type TradeWithRelations = Trade & {
  setup: Setup
  subSetup: SubSetup | null
  images: ChartImage[]
  ruleBreak: RuleBreak | null
}

export type DashboardStats = {
  openTrades: number
  totalClosed: number
  avgRMultiple: number
  totalPnl: number
  winRate: number
}

export type UploadSignatureResponse = {
  timestamp: number
  signature: string
  cloudName: string
  apiKey: string
  folder: string
}

export type PaginatedTrades = {
  trades: TradeWithRelations[]
  total: number
  page: number
  limit: number
}
