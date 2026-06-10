'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback } from 'react'
import { StrategyCard } from './StrategyCard'
import { StrategyDetail } from './StrategyDetail'
import { Button } from '@/components/ui/Button'
import type { TriggerRule, SubSetup } from '@/generated/prisma/client'

interface SetupStats {
  total: number
  winRate: number
  avgR: number
}

interface SetupWithStats {
  id: string
  name: string
  description: string | null
  pdfUrl: string | null
  pdfCloudinaryId: string | null
  strategyType: 'STANDARD' | 'ORB'
  triggerRules: TriggerRule[]
  subSetups: (SubSetup & { _count: { trades: number } })[]
  _count: { trades: number }
  stats: SetupStats
}

interface PlaybookClientProps {
  setups: SetupWithStats[]
}

export function PlaybookClient({ setups }: PlaybookClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('setup')
  const selectedSetup = setups.find(s => s.id === selectedId) ?? null

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStrategyType, setNewStrategyType] = useState<'STANDARD' | 'ORB'>('STANDARD')
  const [creating, setCreating] = useState(false)

  const selectSetup = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('setup', id)
      router.push(`/playbook?${params.toString()}`)
    },
    [router, searchParams]
  )

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/setups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), strategyType: newStrategyType }),
      })
      if (!res.ok) throw new Error('Failed')
      setNewName('')
      setNewStrategyType('STANDARD')
      setShowCreate(false)
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Left — strategy list */}
      <div
        className="w-72 flex-shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto"
        style={{ borderWidth: '0.5px' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]"
          style={{ borderWidth: '0.5px' }}
        >
          <h1 className="text-sm font-semibold text-[var(--color-ink)]">Playbook</h1>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            + New
          </button>
        </div>

        {showCreate && (
          <div
            className="flex flex-col gap-2 p-3 border-b border-[var(--color-border)]"
            style={{ borderWidth: '0.5px' }}
          >
            <input
              autoFocus
              className="px-2 py-1.5 text-sm rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="Strategy name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            />
            <div className="flex gap-1">
              {(['STANDARD', 'ORB'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewStrategyType(t)}
                  className={`flex-1 py-1 text-xs font-medium rounded-[var(--radius-sm)] border transition-all cursor-pointer ${
                    newStrategyType === t
                      ? 'bg-[var(--color-ink)] text-[var(--color-surface)] border-[var(--color-ink)]'
                      : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)] border-[var(--color-border)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewName('') }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 p-3">
          {setups.length === 0 ? (
            <p className="text-xs text-[var(--color-ink-muted)] text-center py-8">
              No strategies yet. Create one above.
            </p>
          ) : (
            setups.map(setup => (
              <StrategyCard
                key={setup.id}
                setup={setup}
                isSelected={setup.id === selectedId}
                onClick={() => selectSetup(setup.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right — detail panel */}
      <div className="flex-1 overflow-hidden bg-[var(--color-surface-raised)]">
        {selectedSetup ? (
          <StrategyDetail
            key={selectedSetup.id}
            setup={selectedSetup}
            onDeleted={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.delete('setup')
              router.push(`/playbook?${params.toString()}`)
              router.refresh()
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[var(--color-ink-muted)]">Select a strategy to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
