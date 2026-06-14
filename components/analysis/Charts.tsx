'use client'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { GroupRow } from './types'

interface EquityProps {
  data: { date: string; cumPnl: number }[]
  sym?: string
}

interface GroupChartProps {
  groups: GroupRow[]
  sym?: string
}

interface RDistProps {
  groups: GroupRow[]
}

function ChartWrap({ title, children }: { title: string; children: React.ReactNode }) {
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
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-ink-muted)',
          marginBottom: 'var(--space-3)',
        }}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

export function EquityCurve({ data, sym = '₹' }: EquityProps) {
  if (data.length === 0) return null
  return (
    <ChartWrap title="Equity Curve">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
            tickFormatter={d => d.slice(5)}
          />
          <YAxis tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} width={70} />
          <Tooltip
            formatter={(v: unknown) => [`${sym}${Number(v).toLocaleString('en-IN')}`, 'Cumulative PnL']}
            contentStyle={{
              background: 'var(--color-surface-raised)',
              border: '0.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="cumPnl"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrap>
  )
}

export function PnlByGroup({ groups, sym = '₹' }: GroupChartProps) {
  if (groups.length === 0) return null
  const data = groups.map(g => ({ key: g.key, pnl: g.stat.totalPnl }))
  return (
    <ChartWrap title="PnL by Group">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} />
          <YAxis
            dataKey="key"
            type="category"
            tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
            width={90}
          />
          <Tooltip
            formatter={(v: unknown) => [`${sym}${Number(v).toLocaleString('en-IN')}`, 'PnL']}
            contentStyle={{
              background: 'var(--color-surface-raised)',
              border: '0.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
            }}
          />
          <Bar dataKey="pnl" radius={2}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrap>
  )
}

export function WinRateByGroup({ groups }: GroupChartProps) {
  if (groups.length === 0) return null
  // NaN win rate (e.g. the Missed quality bucket) → null so Recharts leaves a gap
  // rather than drawing a misleading 0% bar.
  const data = groups.map(g => ({
    key: g.key,
    winRate: Number.isNaN(g.stat.winRate) ? null : Math.round(g.stat.winRate * 100),
  }))
  return (
    <ChartWrap title="Win Rate by Group">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
            tickFormatter={v => `${v}%`}
          />
          <YAxis
            dataKey="key"
            type="category"
            tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
            width={90}
          />
          <Tooltip
            formatter={(v: unknown) => [`${Number(v)}%`, 'Win Rate']}
            contentStyle={{
              background: 'var(--color-surface-raised)',
              border: '0.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
            }}
          />
          <Bar dataKey="winRate" radius={2}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.winRate != null && d.winRate >= 50 ? 'var(--color-profit)' : 'var(--color-loss)'}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrap>
  )
}

const R_BUCKETS = [
  { label: '<−2R', min: -Infinity, max: -2 },
  { label: '−2..−1R', min: -2, max: -1 },
  { label: '−1..0R', min: -1, max: 0 },
  { label: '0..1R', min: 0, max: 1 },
  { label: '1..2R', min: 1, max: 2 },
  { label: '>2R', min: 2, max: Infinity },
]

export function RDistribution({ groups }: RDistProps) {
  // Build a flat list of rMultiples from group stats — we synthesise
  // using bestR/worstR + counts: instead, we pass the raw data through groups
  // groups don't contain individual trade R values; we use the groups stat
  // to reconstruct a histogram from expectancyR × trades as a rough proxy.
  // Better: accept rawR directly. Here we'll pass it in via a separate prop.
  return null // placeholder replaced in parent with rawR variant
}

export function RDistributionRaw({ rValues }: { rValues: number[] }) {
  if (rValues.length === 0) return null

  const counts = R_BUCKETS.map(b => ({
    label: b.label,
    count: rValues.filter(r => r > b.min && r <= b.max).length,
    positive: b.min >= 0,
  }))

  return (
    <ChartWrap title="R Distribution">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={counts}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface-raised)',
              border: '0.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" radius={2}>
            {counts.map((d, i) => (
              <Cell
                key={i}
                fill={d.positive ? 'var(--color-profit)' : 'var(--color-loss)'}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrap>
  )
}
