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
  ReferenceLine,
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

// The day before the first trade, as a YYYY-MM-DD string — the x-position of the
// synthetic zero origin so both lines visibly start from 0.
function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// Prepend a zero-origin point so the equity lines start from 0 rather than from
// wherever the first trade landed. Both actual and ideal start at 0.
function withZeroOrigin(rows: Row[]): Row[] {
  if (rows.length === 0) return rows
  const origin: Row = { date: dayBefore(rows[0].date), actual: 0, ideal: 0, lower: 0, gap: 0 }
  return [origin, ...rows]
}

const tooltipContentStyle: React.CSSProperties = {
  background: 'var(--color-surface-raised)',
  border: '0.5px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
}

function ChartHeading({ title, currency }: { title: string; currency: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
        {title}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        {currency || '—'}
      </span>
    </div>
  )
}

function CurrencyCharts({ currency, points }: CurrencyEquity) {
  const sym = currencySymbol(currency)
  const rows = withZeroOrigin(toRows(points))

  // Shared Y domain so the two charts are visually comparable.
  let min = 0
  let max = 0
  for (const r of rows) {
    min = Math.min(min, r.actual, r.ideal)
    max = Math.max(max, r.actual, r.ideal)
  }
  const yDomain: [number, number] = [min, max]

  const yTickFormatter = (v: number) => `${sym}${Number(v).toLocaleString('en-IN')}`
  const xTickFormatter = (d: string) => d.slice(5)
  const valueFormatter = (value: unknown, name: unknown): [string, string] => [
    `${sym}${Number(value).toLocaleString('en-IN')}`,
    String(name),
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* LEFT — Actual PnL only (clean) */}
      <div className="flex flex-col gap-2">
        <ChartHeading title="Actual PnL" currency={currency} />
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} tickFormatter={xTickFormatter} />
            <YAxis domain={yDomain} tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} width={70} tickFormatter={yTickFormatter} />
            <ReferenceLine y={0} stroke="var(--color-border-strong)" />
            <Tooltip contentStyle={tooltipContentStyle} formatter={valueFormatter} labelFormatter={d => `Exit ${d}`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
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

      {/* RIGHT — Actual + Execution PnL (ideal) with execution-drag band */}
      <div className="flex flex-col gap-2">
        <ChartHeading title="Actual + Execution PnL" currency={currency} />
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} tickFormatter={xTickFormatter} />
            <YAxis domain={yDomain} tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} width={70} tickFormatter={yTickFormatter} />
            <ReferenceLine y={0} stroke="var(--color-border-strong)" />
            <Tooltip contentStyle={tooltipContentStyle} formatter={valueFormatter} labelFormatter={d => `Exit ${d}`} />
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
    </div>
  )
}

export function DashboardEquity({ series }: Props) {
  // Only render a currency's chart pair if it has ≥ 2 data points. A single point
  // draws a flat, empty-looking chart (e.g. the lone-INR-trade case) — skip it.
  const withData = series.filter(s => s.points.length >= 2)
  if (withData.length === 0) return null

  return (
    <div className="mx-6 mt-4 flex flex-col gap-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4" style={{ borderWidth: '0.5px' }}>
      {withData.map(s => (
        <CurrencyCharts key={s.currency || 'none'} currency={s.currency} points={s.points} />
      ))}
    </div>
  )
}
