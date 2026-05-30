import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface-raised)]">
        {children}
      </main>
    </div>
  )
}
