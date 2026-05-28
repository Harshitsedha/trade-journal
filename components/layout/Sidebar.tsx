import Link from 'next/link'
import { auth, signOut } from '@/lib/auth'
import { getSetups } from '@/lib/queries/trades'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trades/new', label: 'Log Trade' },
]

export async function Sidebar() {
  const [session, setups] = await Promise.all([auth(), getSetups()])

  return (
    <aside
      className="w-[200px] flex-shrink-0 flex flex-col h-full border-r border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ borderWidth: '0.5px' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[var(--color-border)]" style={{ borderWidth: '0.5px' }}>
        <span className="font-semibold text-sm text-[var(--color-ink)] tracking-tight">
          Trade Journal
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center px-3 py-2 text-sm text-[var(--color-ink-secondary)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)] transition-colors"
          >
            {item.label}
          </Link>
        ))}

        {/* Setups filter */}
        {setups.length > 0 && (
          <div className="mt-4">
            <p className="px-3 mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
              Setups
            </p>
            {setups.map((setup) => (
              <Link
                key={setup.id}
                href={`/dashboard?setup=${setup.id}`}
                className="flex items-center px-3 py-1.5 text-xs text-[var(--color-ink-secondary)] rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)] transition-colors"
              >
                {setup.name}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* User */}
      <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between" style={{ borderWidth: '0.5px' }}>
        <span className="text-xs text-[var(--color-ink-muted)] truncate">
          {session?.user?.email}
        </span>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button
            type="submit"
            className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-loss)] transition-colors cursor-pointer"
          >
            Out
          </button>
        </form>
      </div>
    </aside>
  )
}
