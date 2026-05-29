import { db } from '@/lib/db'

export async function getSetups() {
  return db.setup.findMany({
    include: {
      triggerRules: {
        where: { isActive: true },
        orderBy: { precedence: 'asc' },
      },
      subSetups: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { trades: true } } },
      },
      _count: { select: { trades: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getSetupById(id: string) {
  return db.setup.findUnique({
    where: { id },
    include: {
      triggerRules: { orderBy: { precedence: 'asc' } },
      subSetups: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { trades: true } } },
      },
      _count: { select: { trades: true } },
    },
  })
}

export async function getSetupStats(setupId: string) {
  const trades = await db.trade.findMany({
    where: { setupId, status: 'CLOSED' },
    select: { rMultiple: true },
  })
  const total = trades.length
  const wins = trades.filter(t => t.rMultiple && Number(t.rMultiple) > 0).length
  const avgR =
    total > 0
      ? trades.reduce((sum, t) => sum + Number(t.rMultiple ?? 0), 0) / total
      : 0
  return { total, winRate: total > 0 ? wins / total : 0, avgR }
}

export async function getTriggerRulesForSetup(setupId: string) {
  return db.triggerRule.findMany({
    where: { setupId, isActive: true },
    orderBy: { precedence: 'asc' },
  })
}
