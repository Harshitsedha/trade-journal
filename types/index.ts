import type {
  Trade,
  Setup,
  SubSetup,
  ChartImage,
  RuleBreak,
  TradeTrigger,
  TriggerRule,
  AssetClass,
  Direction,
  TradeStatus,
  RuleBreakType,
  TriggerDirection,
} from '@/generated/prisma/client'

export type {
  Trade,
  Setup,
  SubSetup,
  ChartImage,
  RuleBreak,
  TradeTrigger,
  TriggerRule,
  AssetClass,
  Direction,
  TradeStatus,
  RuleBreakType,
  TriggerDirection,
}

export type TradeTriggerWithRule = TradeTrigger & { triggerRule: TriggerRule }

export type TradeWithRelations = Trade & {
  setup: Setup
  subSetup: SubSetup | null
  images: ChartImage[]
  ruleBreak: RuleBreak | null
  triggerRules: TradeTriggerWithRule[]
  instrumentRef: { symbol: string; currency: string } | null
}

export type CurrencyStat = {
  currency: string
  totalClosed: number
  winRate: number
  avgRMultiple: number
  totalPnl: number
}

export type DashboardStats = {
  openTrades: number
  // Per-currency subtotals — never a blended cross-currency P&L.
  byCurrency: CurrencyStat[]
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
