'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { TriggerRule, TriggerDirection } from '@/generated/prisma/client'

type OrbDir = 'ORIGINAL' | 'ANTI'

interface TriggerRuleListProps {
  setupId: string
  initialRules: TriggerRule[]
  strategyType: 'STANDARD' | 'ORB'
}

const directionColors: Record<TriggerDirection, string> = {
  LONG: 'bg-[var(--color-profit-bg)] text-[var(--color-profit)]',
  SHORT: 'bg-[var(--color-loss-bg)] text-[var(--color-loss)]',
  BOTH: 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]',
}

const precedenceBg: Record<TriggerDirection, string> = {
  LONG: 'bg-[var(--color-profit-bg)] text-[var(--color-profit)] border-[var(--color-profit)]',
  SHORT: 'bg-[var(--color-loss-bg)] text-[var(--color-loss)] border-[var(--color-loss)]',
  BOTH: 'bg-[var(--color-accent-bg)] text-[var(--color-accent)] border-[var(--color-accent)]',
}

const orbColors: Record<OrbDir, string> = {
  ORIGINAL: 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]',
  ANTI: 'bg-[var(--color-loss-bg)] text-[var(--color-loss)]',
}

const orbPrecedenceBg: Record<OrbDir, string> = {
  ORIGINAL: 'bg-[var(--color-accent-bg)] text-[var(--color-accent)] border-[var(--color-accent)]',
  ANTI: 'bg-[var(--color-loss-bg)] text-[var(--color-loss)] border-[var(--color-loss)]',
}

interface AddRuleForm {
  precedence: string
  name: string
  description: string
  direction: TriggerDirection
  orbDirection: OrbDir | null
}

interface EditState {
  ruleId: string
  name: string
  description: string
  direction: TriggerDirection
  orbDirection: OrbDir | null
}

function getRulePrecedenceBg(isOrb: boolean, direction: TriggerDirection, orbDirection: OrbDir | null): string {
  if (isOrb) return orbPrecedenceBg[orbDirection ?? 'ORIGINAL']
  return precedenceBg[direction]
}

export function TriggerRuleList({ setupId, initialRules, strategyType }: TriggerRuleListProps) {
  const isOrb = strategyType === 'ORB'
  const [rules, setRules] = useState<TriggerRule[]>(initialRules)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [addForm, setAddForm] = useState<AddRuleForm>({
    precedence: String((initialRules.length > 0 ? Math.max(...initialRules.map(r => r.precedence)) + 1 : 1)),
    name: '',
    description: '',
    direction: 'BOTH',
    orbDirection: null,
  })

  async function handleAddRule() {
    if (!addForm.name.trim()) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        precedence: Number(addForm.precedence),
        name: addForm.name.trim(),
        description: addForm.description.trim() || undefined,
      }
      if (isOrb) {
        payload.direction = 'BOTH'
        payload.orbDirection = addForm.orbDirection ?? null
      } else {
        payload.direction = addForm.direction
      }
      const res = await fetch(`/api/setups/${setupId}/trigger-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 409) {
        alert(`Precedence ${addForm.precedence} already exists. Choose a different number.`)
        return
      }
      if (!res.ok) throw new Error('Failed')
      const rule: TriggerRule = await res.json()
      const next = [...rules, rule].sort((a, b) => a.precedence - b.precedence)
      setRules(next)
      setShowAddForm(false)
      setAddForm({
        precedence: String(rule.precedence + 1),
        name: '',
        description: '',
        direction: 'BOTH',
        orbDirection: null,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(ruleId: string) {
    const res = await fetch(`/api/setups/${setupId}/trigger-rules/${ruleId}`, {
      method: 'DELETE',
    })
    if (!res.ok) return
    setRules(prev => prev.map(r => (r.id === ruleId ? { ...r, isActive: false } : r)))
  }

  async function handleSaveEdit() {
    if (!editState || !editState.name.trim()) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: editState.name.trim(),
        description: editState.description.trim() || undefined,
      }
      if (isOrb) {
        payload.orbDirection = editState.orbDirection ?? null
      } else {
        payload.direction = editState.direction
      }
      const res = await fetch(`/api/setups/${setupId}/trigger-rules/${editState.ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed')
      const updated: TriggerRule = await res.json()
      setRules(prev => prev.map(r => (r.id === updated.id ? updated : r)))
      setEditState(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rules.map(rule => {
        const isEditing = editState?.ruleId === rule.id
        const orbDir = (rule as Record<string, unknown>).orbDirection as OrbDir | null

        return (
          <div
            key={rule.id}
            className={`flex flex-col gap-2 p-3 rounded-[var(--radius-md)] border transition-opacity ${
              rule.isActive ? 'opacity-100' : 'opacity-40'
            }`}
            style={{ borderWidth: '0.5px', borderColor: 'var(--color-border)' }}
          >
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border ${getRulePrecedenceBg(isOrb, editState.direction, editState.orbDirection)}`}
                    style={{ borderWidth: '1px' }}
                  >
                    {rule.precedence}
                  </span>
                  <input
                    className="flex-1 px-2 py-1 text-sm rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
                    value={editState.name}
                    onChange={e => setEditState(s => s && { ...s, name: e.target.value })}
                    placeholder="Rule name"
                  />
                  {isOrb ? (
                    <select
                      className="px-2 py-1 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] focus:outline-none cursor-pointer"
                      value={editState.orbDirection ?? ''}
                      onChange={e => setEditState(s => s && { ...s, orbDirection: (e.target.value as OrbDir) || null })}
                    >
                      <option value="">— unset —</option>
                      <option value="ORIGINAL">Original</option>
                      <option value="ANTI">Anti</option>
                    </select>
                  ) : (
                    <select
                      className="px-2 py-1 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] focus:outline-none cursor-pointer"
                      value={editState.direction}
                      onChange={e => setEditState(s => s && { ...s, direction: e.target.value as TriggerDirection })}
                    >
                      <option value="BOTH">Both</option>
                      <option value="LONG">Long</option>
                      <option value="SHORT">Short</option>
                    </select>
                  )}
                </div>
                <input
                  className="px-2 py-1 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
                  value={editState.description}
                  onChange={e => setEditState(s => s && { ...s, description: e.target.value })}
                  placeholder="Description (optional)"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditState(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <span
                  className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border ${getRulePrecedenceBg(isOrb, rule.direction, orbDir)}`}
                  style={{ borderWidth: '1px' }}
                >
                  {rule.precedence}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--color-ink)]">{rule.name}</span>
                    {isOrb ? (
                      orbDir && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${orbColors[orbDir]}`}>
                          {orbDir}
                        </span>
                      )
                    ) : (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${directionColors[rule.direction]}`}>
                        {rule.direction}
                      </span>
                    )}
                    {!rule.isActive && (
                      <span className="text-[10px] text-[var(--color-ink-muted)]">inactive</span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-[var(--color-ink-secondary)] mt-0.5 leading-relaxed">
                      {rule.description}
                    </p>
                  )}
                </div>
                {rule.isActive && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() =>
                        setEditState({
                          ruleId: rule.id,
                          name: rule.name,
                          description: rule.description ?? '',
                          direction: rule.direction,
                          orbDirection: orbDir,
                        })
                      }
                      className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors px-2 py-1 rounded cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeactivate(rule.id)}
                      className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-loss)] transition-colors px-2 py-1 rounded cursor-pointer"
                    >
                      Off
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {showAddForm ? (
        <div
          className="flex flex-col gap-2 p-3 rounded-[var(--radius-md)] border border-dashed"
          style={{ borderWidth: '1px', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="w-16 px-2 py-1 text-sm rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)] font-mono"
              value={addForm.precedence}
              onChange={e => setAddForm(f => ({ ...f, precedence: e.target.value }))}
              min={1}
              placeholder="#"
            />
            <input
              className="flex-1 px-2 py-1 text-sm rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
              value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Rule name"
              autoFocus
            />
            {isOrb ? (
              <select
                className="px-2 py-1 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] focus:outline-none cursor-pointer"
                value={addForm.orbDirection ?? ''}
                onChange={e => setAddForm(f => ({ ...f, orbDirection: (e.target.value as OrbDir) || null }))}
              >
                <option value="">— unset —</option>
                <option value="ORIGINAL">Original</option>
                <option value="ANTI">Anti</option>
              </select>
            ) : (
              <select
                className="px-2 py-1 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] focus:outline-none cursor-pointer"
                value={addForm.direction}
                onChange={e => setAddForm(f => ({ ...f, direction: e.target.value as TriggerDirection }))}
              >
                <option value="BOTH">Both</option>
                <option value="LONG">Long</option>
                <option value="SHORT">Short</option>
              </select>
            )}
          </div>
          <input
            className="px-2 py-1 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
            value={addForm.description}
            onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddRule} disabled={saving || !addForm.name.trim()}>
              {saving ? 'Adding…' : 'Add Rule'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            const maxPrec = rules.length > 0 ? Math.max(...rules.map(r => r.precedence)) + 1 : 1
            setAddForm(f => ({ ...f, precedence: String(maxPrec) }))
            setShowAddForm(true)
          }}
          className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors py-2 text-left cursor-pointer"
        >
          + Add trigger rule
        </button>
      )}
    </div>
  )
}
