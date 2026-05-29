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
