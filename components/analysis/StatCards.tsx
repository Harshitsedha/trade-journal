'use client'
import type { TradeStat } from './types'
import { fmtPnl, fmtR, fmtPct, fmtPnlPlain } from '@/lib/analytics/format'

interface Props {
  stat: TradeStat
}

function Card({
  label,
  value,
  sub,
  positive,
  large,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean
  large?: boolean
}) {
  const color =
    positive === true
      ? 'var(--color-profit)'
      : positive === false
      ? 'var(--color-loss)'
      : 'var(--color-ink)'

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: large ? 28 : 20,
          fontWeight: 600,
          color,
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>{sub}</span>
      )}
    </div>
  )
}

export function StatCards({ stat }: Props) {
  const pnlPos = stat.totalPnl >= 0
  const eRPos = stat.expectancyR >= 0

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 'var(--space-3)',
      }}
    >
      <Card label="Trades" value={String(stat.trades)} />
      <Card
        label="Win Rate"
        value={fmtPct(stat.winRate)}
        sub={`${stat.wins}W · ${stat.losses}L · ${stat.breakeven}BE`}
        positive={stat.winRate >= 0.5}
      />
      <Card
        label="Expectancy (R)"
        value={fmtR(stat.expectancyR)}
        large
        positive={eRPos}
      />
      <Card
        label="Total PnL"
        value={fmtPnl(stat.totalPnl)}
        sub={`Avg ${fmtPnlPlain(stat.avgPnl)} / trade`}
        positive={pnlPos}
      />
      <Card
        label="Profit Factor"
        value={
          stat.profitFactor === Infinity
            ? '∞'
            : stat.profitFactor === 0 && stat.wins === 0
            ? '—'
            : stat.profitFactor.toFixed(2)
        }
        positive={stat.profitFactor > 1}
      />
      <Card
        label="Avg Win / Loss R"
        value={`${fmtR(stat.avgWinR)} / ${fmtR(stat.avgLossR)}`}
      />
      <Card
        label="Best R"
        value={fmtR(stat.bestR)}
        sub={`Worst: ${fmtR(stat.worstR)}`}
        positive={stat.bestR > 0}
      />
      <Card
        label="Best PnL"
        value={fmtPnl(stat.bestPnl)}
        sub={`Worst: ${fmtPnl(stat.worstPnl)}`}
        positive={stat.bestPnl > 0}
      />
      <Card
        label="Max Win Streak"
        value={String(stat.maxWinStreak)}
        sub={`Max loss streak: ${stat.maxLossStreak}`}
      />
    </div>
  )
}
