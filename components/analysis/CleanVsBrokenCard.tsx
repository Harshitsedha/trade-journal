'use client'
import type { CleanVsBroken, TradeStat } from './types'
import { fmtPnl, fmtR, fmtPct } from '@/lib/analytics/format'

interface Props {
  data: CleanVsBroken
}

function MiniBlock({ label, stat }: { label: string; stat: TradeStat }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--color-surface-sunken)',
        borderRadius: 'var(--radius-sm)',
        padding: 'var(--space-3) var(--space-4)',
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-ink-muted)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>
        {fmtR(stat.expectancyR)}
        <span style={{ fontSize: 12, color: 'var(--color-ink-muted)', marginLeft: 4 }}>
          expectancy
        </span>
      </p>
      <p style={{ fontSize: 12, color: 'var(--color-ink-secondary)', marginTop: 2 }}>
        {stat.trades} trades · {fmtPct(stat.winRate)} WR · {fmtPnl(stat.totalPnl)}
      </p>
    </div>
  )
}

export function CleanVsBrokenCard({ data }: Props) {
  if (data.broken.trades === 0) return null

  const costPnl = data.brokenCostPnl
  const costR = data.brokenCostR

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-ink)',
          marginBottom: 'var(--space-3)',
        }}
      >
        Rule breaks cost you{' '}
        <span style={{ color: 'var(--color-loss)' }}>
          {fmtPnl(costPnl)} / {fmtR(costR)}
        </span>{' '}
        across {data.broken.trades} trade{data.broken.trades !== 1 ? 's' : ''}
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <MiniBlock label="Clean" stat={data.clean} />
        <MiniBlock label="Broken" stat={data.broken} />
      </div>
    </div>
  )
}
