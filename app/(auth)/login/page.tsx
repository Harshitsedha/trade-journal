import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { auth, signIn } from '@/lib/auth'

interface LoginPageProps {
  searchParams: Promise<{ verify?: string; error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, params] = await Promise.all([auth(), searchParams])
  if (session) redirect('/dashboard')

  const verified = params.verify === '1'
  const hasError = params.error

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-raised)]">
      <div
        className="w-full max-w-sm flex flex-col gap-6 p-8 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)]"
        style={{ borderWidth: '0.5px' }}
      >
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-lg font-semibold text-[var(--color-ink)]">Trade Journal</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Your private trading edge.
          </p>
        </div>

        {verified ? (
          <div className="flex flex-col gap-3 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-profit-bg)] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-profit)]">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--color-ink)]">Check your inbox</p>
            <p className="text-xs text-[var(--color-ink-muted)]">
              A magic link has been sent. Click it to sign in.
            </p>
          </div>
        ) : (
          <form
            action={async (formData: FormData) => {
              'use server'
              try {
                await signIn('resend', formData)
              } catch (err) {
                if (err instanceof AuthError) {
                  console.error('[Auth] signIn action error:', err.type, err.message)
                  redirect(`/login?error=${err.type}`)
                }
                throw err
              }
            }}
            className="flex flex-col gap-4"
          >
            {hasError && (
              <p className="text-xs text-[var(--color-loss)] bg-[var(--color-loss-bg)] px-3 py-2 rounded-[var(--radius-md)] text-center">
                Access denied. This journal is private.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium text-[var(--color-ink-secondary)]">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="your@email.com"
                defaultValue={process.env.ALLOWED_EMAIL}
                className="w-full px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-[var(--radius-md)] bg-[var(--color-ink)] text-[var(--color-surface)] text-sm font-medium hover:opacity-80 transition-opacity cursor-pointer"
            >
              Send magic link
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
