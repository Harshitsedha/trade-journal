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
  // Cumulative executionPnl (actual − ideal) across CLOSED + MISSED for this currency.
  executionDrag: number
}

export type DashboardStats = {
  openTrades: number
  // Per-currency subtotals — never a blended cross-currency P&L.
  byCurrency: CurrencyStat[]
}

export type EquityPoint = { date: string; actual: number; ideal: number }
export type CurrencyEquity = { currency: string; points: EquityPoint[] }

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
