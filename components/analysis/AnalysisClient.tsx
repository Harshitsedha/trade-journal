'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { AnalysisResult, AnalysisOptions, FilterState } from './types'
import { FilterBar } from './FilterBar'
import { StatCards } from './StatCards'
import { CleanVsBrokenCard } from './CleanVsBrokenCard'
import { EquityCurve, PnlByGroup, WinRateByGroup, RDistributionRaw } from './Charts'
import { BreakdownTable } from './BreakdownTable'
import { CoachPanel } from './CoachPanel'
import { currencySymbol } from '@/lib/currency'

interface Props {
  initial: AnalysisResult
  options: AnalysisOptions
}

function buildQueryString(f: FilterState): string {
  const p = new URLSearchParams()
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  if (f.side) p.set('side', f.side)
  if (f.setupId) p.set('setupId', f.setupId)
  if (f.subSetupId) p.set('subSetupId', f.subSetupId)
  if (f.instrument) p.set('instrument', f.instrument)
  if (f.tagId) p.set('tagId', f.tagId)
  if (f.cleanliness) p.set('cleanliness', f.cleanliness)
  if (f.currency) p.set('currency', f.currency)
  p.set('groupBy', f.groupBy)
  return p.toString()
}

export function AnalysisClient({ initial, options }: Props) {
  const [filters, setFilters] = useState<FilterState>(() => ({
    from: '', to: '', side: '', setupId: '', subSetupId: '', instrument: '',
    tagId: '', cleanliness: '',
    currency: initial.currency ?? options.currencies[0] ?? 'INR',
    groupBy: 'setup',
  }))
  const [result, setResult] = useState<AnalysisResult>(initial)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Extract rMultiple values for R distribution
  // We derive them from the overall stat by using groups to reconstruct
  // Since we don't pass raw trades to client, we pass rValues via API
  // For now we use the groups expectancyR as a proxy — the API returns groups but not individual rValues.
  // We'll add rValues to the API response shape below. For client use, we'll pass a synthetic array.
  // NOTE: The API doesn't return individual rValues — we'd need to add that.
  // Using a simplified version: if result has rValues we use them, else skip chart.
  const rValues = (result as AnalysisResult & { rValues?: number[] }).rValues ?? []
  const sym = currencySymbol(filters.currency)

  const fetchData = useCallback(async (f: FilterState) => {
    setLoading(true)
    try {
      const qs = buildQueryString(f)
      const res = await fetch(`/api/analysis?${qs}`)
      if (res.ok) {
        const data = await res.json()
        setResult(data)
      }
    } catch {
      // keep existing data on network error
    } finally {
      setLoading(false)
    }
  }, [])

  function handleFiltersChange(f: FilterState) {
    setFilters(f)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchData(f), 300)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div
      style={{
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        maxWidth: 1200,
        width: '100%',
        margin: '0 auto',
        overflowY: 'auto',
        flex: 1,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--color-ink)',
          }}
        >
          Analysis
        </h1>
        <span style={{ fontSize: 12, color: 'var(--color-ink-muted)' }}>
          {loading ? 'Loading…' : `${result.tradeCount} closed trade${result.tradeCount !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} options={options} onChange={handleFiltersChange} />

      {/* Stat cards */}
      <StatCards stat={result.overall} executionPnlSum={result.executionPnlSum} sym={sym} />

      {/* Clean vs broken */}
      <CleanVsBrokenCard data={result.cleanVsBroken} sym={sym} />

      {/* Charts — 2 column on wide screens */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <EquityCurve data={result.equity} sym={sym} />
        <PnlByGroup groups={result.groups} sym={sym} />
        <WinRateByGroup groups={result.groups} />
        {rValues.length > 0 && <RDistributionRaw rValues={rValues} />}
      </div>

      {/* Breakdown table */}
      <BreakdownTable groups={result.groups} sym={sym} />

      {/* AI coach */}
      <CoachPanel result={result} filters={filters} />

      {/* Footnote */}
      <p style={{ fontSize: 11, color: 'var(--color-ink-muted)', textAlign: 'center' }}>
        Only closed trades are included in performance metrics. Open trades are excluded.
      </p>
    </div>
  )
}
