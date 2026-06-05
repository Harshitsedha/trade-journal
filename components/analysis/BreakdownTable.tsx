'use client'
import { useState } from 'react'
import type { GroupRow } from './types'
import { fmtPnl, fmtR, fmtPct } from '@/lib/analytics/format'

interface Props {
  groups: GroupRow[]
}

type SortKey = 'key' | 'trades' | 'winRate' | 'expectancyR' | 'totalPnl' | 'profitFactor'

export function BreakdownTable({ groups }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('totalPnl')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  if (groups.length === 0) {
    return (
      <div
        style={{
          background: 'var(--color-surface)',
          border: '0.5px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          color: 'var(--color-ink-muted)',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        No trades match the current filters.
      </div>
    )
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...groups].sort((a, b) => {
    let av: string | number
    let bv: string | number
    switch (sortKey) {
      case 'key': av = a.key; bv = b.key; break
      case 'trades': av = a.stat.trades; bv = b.stat.trades; break
      case 'winRate': av = a.stat.winRate; bv = b.stat.winRate; break
      case 'expectancyR': av = a.stat.expectancyR; bv = b.stat.expectancyR; break
      case 'totalPnl': av = a.stat.totalPnl; bv = b.stat.totalPnl; break
      case 'profitFactor':
        av = a.stat.profitFactor === Infinity ? 999999 : a.stat.profitFactor
        bv = b.stat.profitFactor === Infinity ? 999999 : b.stat.profitFactor
        break
    }
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function ColHeader({ label, col }: { label: string; col: SortKey }) {
    const active = col === sortKey
    return (
      <th
        onClick={() => handleSort(col)}
        style={{
          padding: 'var(--space-2) var(--space-3)',
          textAlign: 'right',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: active ? 'var(--color-ink)' : 'var(--color-ink-muted)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <p
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '0.5px solid var(--color-border)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-ink-muted)',
        }}
      >
        Breakdown
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--color-border)' }}>
              <th
                onClick={() => handleSort('key')}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: sortKey === 'key' ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                Group {sortKey === 'key' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <ColHeader label="Trades" col="trades" />
              <ColHeader label="Win Rate" col="winRate" />
              <ColHeader label="Exp. R" col="expectancyR" />
              <ColHeader label="Total PnL" col="totalPnl" />
              <ColHeader label="PF" col="profitFactor" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const pnlPos = row.stat.totalPnl >= 0
              const eRPos = row.stat.expectancyR >= 0
              return (
                <tr
                  key={row.key}
                  style={{
                    borderBottom: i < sorted.length - 1 ? '0.5px solid var(--color-border)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-raised)',
                  }}
                >
                  <td
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      fontWeight: 500,
                      color: 'var(--color-ink)',
                    }}
                  >
                    {row.key}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', color: 'var(--color-ink-secondary)' }}>
                    {row.stat.trades}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', color: 'var(--color-ink-secondary)' }}>
                    {fmtPct(row.stat.winRate)}
                  </td>
                  <td
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      color: eRPos ? 'var(--color-profit)' : 'var(--color-loss)',
                      fontWeight: 500,
                    }}
                  >
                    {fmtR(row.stat.expectancyR)}
                  </td>
                  <td
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      color: pnlPos ? 'var(--color-profit)' : 'var(--color-loss)',
                      fontWeight: 500,
                    }}
                  >
                    {fmtPnl(row.stat.totalPnl)}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', color: 'var(--color-ink-secondary)' }}>
                    {row.stat.profitFactor === Infinity
                      ? '∞'
                      : row.stat.profitFactor === 0 && row.stat.wins === 0
                      ? '—'
                      : row.stat.profitFactor.toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
