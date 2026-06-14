'use client'
import type { AnalysisOptions, FilterState, GroupDimension } from './types'

interface Props {
  filters: FilterState
  options: AnalysisOptions
  onChange: (f: FilterState) => void
}

type DatePreset = 'week' | 'month' | 'last30' | 'all' | 'custom'

function toIso(d: Date): string {
  return d.toISOString()
}

function startOfWeek(): string {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return toIso(d)
}

function startOfMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return toIso(d)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return toIso(d)
}

const GROUP_OPTIONS: { value: GroupDimension; label: string }[] = [
  { value: 'setup', label: 'Setup' },
  { value: 'subSetup', label: 'Sub-Setup' },
  { value: 'instrument', label: 'Instrument' },
  { value: 'side', label: 'Side' },
  { value: 'tag', label: 'Tag' },
  { value: 'quality', label: 'Quality' },
]

const QUALITY_OPTIONS: { value: FilterState['quality']; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'rule_followed', label: 'Followed' },
  { value: 'rule_broken', label: 'Broken' },
  { value: 'missed', label: 'Missed' },
]

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--color-ink-muted)',
  marginBottom: 4,
  display: 'block',
}

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '5px 8px',
  border: '0.5px solid var(--color-border-strong)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface)',
  color: 'var(--color-ink)',
  outline: 'none',
  width: '100%',
}

const toggleGroupStyle: React.CSSProperties = {
  display: 'flex',
  borderRadius: 'var(--radius-sm)',
  border: '0.5px solid var(--color-border-strong)',
  overflow: 'hidden',
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '5px 10px',
        border: 'none',
        background: active ? 'var(--color-accent-bg)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-ink-secondary)',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        borderRight: '0.5px solid var(--color-border)',
        transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  )
}

export function FilterBar({ filters, options, onChange }: Props) {
  function set(patch: Partial<FilterState>) {
    onChange({ ...filters, ...patch })
  }

  function applyPreset(preset: DatePreset) {
    const now = toIso(new Date())
    switch (preset) {
      case 'week': set({ from: startOfWeek(), to: now }); break
      case 'month': set({ from: startOfMonth(), to: now }); break
      case 'last30': set({ from: daysAgo(30), to: now }); break
      case 'all': set({ from: '', to: '' }); break
      case 'custom': break
    }
  }

  const filteredSubSetups = filters.setupId
    ? options.subSetups.filter(s => s.setupId === filters.setupId)
    : options.subSetups

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 'var(--space-3)',
          alignItems: 'end',
        }}
      >
        {/* Date range presets */}
        <div>
          <span style={labelStyle}>Date Range</span>
          <div style={toggleGroupStyle}>
            {(['week', 'month', 'last30', 'all'] as const).map(p => (
              <ToggleBtn key={p} active={false} onClick={() => applyPreset(p)}>
                {p === 'week' ? 'Wk' : p === 'month' ? 'Mo' : p === 'last30' ? '30d' : 'All'}
              </ToggleBtn>
            ))}
          </div>
        </div>

        {/* From / To custom */}
        <div>
          <span style={labelStyle}>From</span>
          <input
            type="date"
            style={inputStyle}
            value={filters.from ? filters.from.slice(0, 10) : ''}
            onChange={e =>
              set({ from: e.target.value ? new Date(e.target.value).toISOString() : '' })
            }
          />
        </div>

        <div>
          <span style={labelStyle}>To</span>
          <input
            type="date"
            style={inputStyle}
            value={filters.to ? filters.to.slice(0, 10) : ''}
            onChange={e =>
              set({ to: e.target.value ? new Date(e.target.value).toISOString() : '' })
            }
          />
        </div>

        {/* Side */}
        <div>
          <span style={labelStyle}>Side</span>
          <div style={toggleGroupStyle}>
            {(['', 'LONG', 'SHORT'] as const).map(s => (
              <ToggleBtn key={s} active={filters.side === s} onClick={() => set({ side: s })}>
                {s || 'All'}
              </ToggleBtn>
            ))}
          </div>
        </div>

        {/* Setup */}
        <div>
          <span style={labelStyle}>Setup</span>
          <select
            style={inputStyle}
            value={filters.setupId}
            onChange={e => set({ setupId: e.target.value, subSetupId: '' })}
          >
            <option value="">All setups</option>
            {options.setups.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Sub-setup */}
        <div>
          <span style={labelStyle}>Sub-Setup</span>
          <select
            style={inputStyle}
            value={filters.subSetupId}
            onChange={e => set({ subSetupId: e.target.value })}
            disabled={filteredSubSetups.length === 0}
          >
            <option value="">All sub-setups</option>
            {filteredSubSetups.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Currency scope — always a single currency so totals never blend */}
        <div>
          <span style={labelStyle}>Currency</span>
          <select
            style={inputStyle}
            value={filters.currency}
            onChange={e => set({ currency: e.target.value })}
          >
            {options.currencies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Instrument */}
        <div>
          <span style={labelStyle}>Instrument</span>
          <select
            style={inputStyle}
            value={filters.instrument}
            onChange={e => set({ instrument: e.target.value })}
          >
            <option value="">All instruments</option>
            {options.instruments.map(inst => (
              <option key={inst} value={inst}>{inst}</option>
            ))}
          </select>
        </div>

        {/* Tag */}
        <div>
          <span style={labelStyle}>Trigger Rule / Tag</span>
          <select
            style={inputStyle}
            value={filters.tagId}
            onChange={e => set({ tagId: e.target.value })}
          >
            <option value="">All tags</option>
            {options.tags.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Trade quality — real 3-way axis: status + entryRuleCorrect */}
        <div>
          <span style={labelStyle}>Trade Quality</span>
          <div style={toggleGroupStyle}>
            {QUALITY_OPTIONS.map(q => (
              <ToggleBtn key={q.value} active={filters.quality === q.value} onClick={() => set({ quality: q.value })}>
                {q.label}
              </ToggleBtn>
            ))}
          </div>
        </div>

        {/* Group by */}
        <div>
          <span style={labelStyle}>Group By</span>
          <select
            style={inputStyle}
            value={filters.groupBy}
            onChange={e => set({ groupBy: e.target.value as GroupDimension })}
          >
            {GROUP_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
