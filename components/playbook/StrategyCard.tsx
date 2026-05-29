'use client'

import type { TriggerRule } from '@/generated/prisma/client'

interface SetupStats {
  total: number
  winRate: number
  avgR: number
}

interface StrategyCardProps {
  setup: {
    id: string
    name: string
    description: string | null
    triggerRules: TriggerRule[]
    _count: { trades: number }
    stats: SetupStats
  }
  isSelected: boolean
  onClick: () => void
}

export function StrategyCard({ setup, isSelected, onClick }: StrategyCardProps) {
  const tradeCount = setup._count.trades
  const isActive = tradeCount > 10
  const firstThree = setup.triggerRules.slice(0, 3)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-[var(--radius-md)] border transition-all cursor-pointer ${
        isSelected
          ? 'border-[var(--color-ink)] bg-[var(--color-surface-sunken)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)]'
      }`}
      style={{ borderWidth: '0.5px' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-[var(--color-ink)] leading-tight">
          {setup.name}
        </span>
        <span
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-medium ${
            isActive
              ? 'bg-[var(--color-profit-bg)] text-[var(--color-profit)]'
              : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)]'
          }`}
        >
          {isActive ? 'Active' : 'Testing'}
        </span>
      </div>

      {setup.description && (
        <p className="text-xs text-[var(--color-ink-secondary)] mb-3 line-clamp-2">
          {setup.description}
        </p>
      )}

      <div className="flex gap-3 mb-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wide">Win%</span>
          <span className="text-xs font-mono font-medium text-[var(--color-ink)]">
            {setup.stats.total > 0 ? `${(setup.stats.winRate * 100).toFixed(0)}%` : '—'}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wide">Avg R</span>
          <span
            className={`text-xs font-mono font-medium ${
              setup.stats.avgR > 0
                ? 'text-[var(--color-profit)]'
                : setup.stats.avgR < 0
                ? 'text-[var(--color-loss)]'
                : 'text-[var(--color-ink)]'
            }`}
          >
            {setup.stats.total > 0 ? `${setup.stats.avgR > 0 ? '+' : ''}${setup.stats.avgR.toFixed(2)}R` : '—'}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wide">Trades</span>
          <span className="text-xs font-mono font-medium text-[var(--color-ink)]">{tradeCount}</span>
        </div>
      </div>

      {firstThree.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {firstThree.map(rule => (
            <span
              key={rule.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-surface-sunken)] text-[var(--color-ink-secondary)] border border-[var(--color-border)]"
              style={{ borderWidth: '0.5px' }}
            >
              R{rule.precedence}
            </span>
          ))}
          {setup.triggerRules.length > 3 && (
            <span className="text-[10px] text-[var(--color-ink-muted)]">
              +{setup.triggerRules.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  )
}
