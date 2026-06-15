'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface SetupLink {
  id: string
  name: string
}

interface Props {
  setups: SetupLink[]
}

// Setup filter links for the sidebar. Each navigates to the dashboard with a
// ?setupId= param that filters the trades table. The currently-active setup
// (read from the live query string) gets a highlighted style.
export function SetupNavLinks({ setups }: Props) {
  const activeId = useSearchParams().get('setupId')

  return (
    <>
      {setups.map((setup) => {
        const active = setup.id === activeId
        return (
          <Link
            key={setup.id}
            href={`/dashboard?setupId=${setup.id}`}
            className={`flex items-center px-3 py-1.5 text-xs rounded-[var(--radius-sm)] transition-colors ${
              active
                ? 'bg-[var(--color-surface-sunken)] text-[var(--color-ink)] font-medium'
                : 'text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]'
            }`}
          >
            {setup.name}
          </Link>
        )
      })}
    </>
  )
}
