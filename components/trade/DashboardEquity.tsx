'use client'

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { CurrencyEquity } from '@/types'
import { currencySymbol } from '@/lib/currency'

interface Props {
  series: CurrencyEquity[]
}

interface Row {
  date: string
  actual: number
  ideal: number
  lower: number // baseline of the shaded band
  gap: number // band thickness = |ideal − actual| (execution drag)
}

function toRows(points: CurrencyEquity['points']): Row[] {
  return points.map(p => ({
    date: p.date,
    actual: p.actual,
    ideal: p.ideal,
    lower: Math.min(p.actual, p.ideal),
    gap: Math.abs(p.ideal - p.actual),
  }))
}

function CurrencyChart({ currency, points }: CurrencyEquity) {
  const sym = currencySymbol(currency)
  const rows = toRows(points)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
          Equity Curve
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
          {currency || '—'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
            tickFormatter={d => d.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
            width={70}
            tickFormatter={v => `${sym}${Number(v).toLocaleString('en-IN')}`}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface-raised)',
              border: '0.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
            }}
            formatter={(value: unknown, name: unknown) => [
              `${sym}${Number(value).toLocaleString('en-IN')}`,
              String(name),
            ]}
            labelFormatter={d => `Exit ${d}`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {/* Shaded band between the two lines = execution drag.
              Invisible baseline area stacks the visible gap area on top. */}
          <Area
            type="monotone"
            dataKey="lower"
            name="band-base"
            stackId="band"
            stroke="none"
            fill="none"
            fillOpacity={0}
            isAnimationActive={false}
            legendType="none"
            tooltipType="none"
          />
          <Area
            type="monotone"
            dataKey="gap"
            name="Execution drag"
            stackId="band"
            stroke="none"
            fill="var(--color-loss)"
            fillOpacity={0.12}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="ideal"
            name="Possible (ideal)"
            stroke="var(--color-profit)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DashboardEquity({ series }: Props) {
  const withData = series.filter(s => s.points.length > 0)
  if (withData.length === 0) return null

  return (
    <div className="mx-6 mt-4 flex flex-col gap-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4" style={{ borderWidth: '0.5px' }}>
      {withData.map(s => (
        <CurrencyChart key={s.currency || 'none'} currency={s.currency} points={s.points} />
      ))}
    </div>
  )
}
